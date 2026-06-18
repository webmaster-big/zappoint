
import { membershipService } from './MembershipService';
import type { Membership, MembershipPlan } from '../types/Membership.types';
import { getStoredUser } from '../utils/storage';

const CACHE_NAME = 'zapzone-memberships-cache-v2';

const KEYS = {
  plans: '/api/membership-plans/cached',
  publicPlans: '/api/membership-plans/public/cached',
  list: '/api/memberships/cached',
  mine: '/api/memberships/me/cached',
  metadata: '/api/memberships/metadata',
} as const;

interface CacheMetadata {
  lastUpdated: number;
  userId?: number;
}

type CacheKey = keyof typeof KEYS;

// ─── In-memory store for instant synchronous reads ───────────────────────────
// Populated after the first async CacheStorage read so that subsequent
// page navigations within the same session can access data synchronously.
const memStore = new Map<string, unknown>();

// Track which keys are currently being refreshed so pages can show a
// subtle "syncing" indicator rather than a full loading overlay.
const syncingKeys = new Set<string>();

function setMemory(key: string, data: unknown): void {
  memStore.set(key, data);
}

function getMemory<T>(key: string): T | null {
  const val = memStore.get(key);
  return val !== undefined ? (val as T) : null;
}

// ─── Stale timestamps per key (updated when data is written) ─────────────────
const staleTimestamps = new Map<string, number>();

function isKeyStale(key: string, maxAgeMinutes: number): boolean {
  const ts = staleTimestamps.get(key);
  if (!ts) return true;
  return Date.now() - ts > maxAgeMinutes * 60 * 1000;
}

function touchKey(key: string): void {
  staleTimestamps.set(key, Date.now());
}

// ─── CacheStorage helpers ─────────────────────────────────────────────────────
const isCacheAvailable = (): boolean =>
  typeof window !== 'undefined' && 'caches' in window;

async function openCache(): Promise<Cache | null> {
  if (!isCacheAvailable()) return null;
  try {
    return await caches.open(CACHE_NAME);
  } catch {
    return null;
  }
}

async function readJson<T>(key: string): Promise<T | null> {
  // Check memory first (synchronous, fast)
  const mem = getMemory<T>(key);
  if (mem !== null) return mem;

  const cache = await openCache();
  if (!cache) return null;
  try {
    const res = await cache.match(key);
    if (!res) return null;
    const data = (await res.json()) as T;
    // Populate memory on first read from disk
    setMemory(key, data);
    return data;
  } catch {
    return null;
  }
}

async function writeJson(key: string, data: unknown): Promise<void> {
  setMemory(key, data); // Always update memory immediately
  touchKey(key);
  const cache = await openCache();
  if (!cache) return;
  try {
    const res = new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json' },
    });
    await cache.put(key, res);
  } catch {
  }
}

async function touchMetadata(): Promise<void> {
  const meta: CacheMetadata = {
    lastUpdated: Date.now(),
    userId: getStoredUser()?.id,
  };
  await writeJson(KEYS.metadata, meta);
}

function isStaleSync(key: string, maxAgeMinutes: number): boolean {
  return isKeyStale(key, maxAgeMinutes);
}

function emit(detail: Record<string, unknown> = {}): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('memberships-cache-updated', { detail }));
}

const inflight = new Map<CacheKey, Promise<unknown>>();

function emitSyncing(key: CacheKey, syncing: boolean): void {
  if (syncing) syncingKeys.add(key);
  else syncingKeys.delete(key);
  emit({ key, source: syncing ? 'syncing' : 'synced' });
}

async function fetchAndStore<T>(
  key: CacheKey,
  fetcher: () => Promise<T>
): Promise<T> {
  if (inflight.has(key)) {
    return inflight.get(key) as Promise<T>;
  }
  const p = (async () => {
    emitSyncing(key, true);
    try {
      const data = await fetcher();
      await writeJson(KEYS[key], data);
      await touchMetadata();
      emit({ key, source: 'updated' });
      return data;
    } finally {
      emitSyncing(key, false);
      inflight.delete(key);
    }
  })();
  inflight.set(key, p);
  return p;
}

function backgroundRefresh<T>(key: CacheKey, fetcher: () => Promise<T>): void {
  if (inflight.has(key)) return;
  setTimeout(() => {
    fetchAndStore(key, fetcher).catch(() => {});
  }, 0);
}


export const membershipCache = {
  // ── Sync reads (from in-memory store — available after first async load) ──

  getPlansSync(): MembershipPlan[] | null {
    return getMemory<MembershipPlan[]>(KEYS.plans);
  },

  getListSync(): { data: Membership[]; meta?: Record<string, unknown> } | null {
    return getMemory<{ data: Membership[]; meta?: Record<string, unknown> }>(KEYS.list);
  },

  getMineSync(): Membership | null {
    return getMemory<Membership>(KEYS.mine);
  },

  getPublicPlansSync(): MembershipPlan[] | null {
    return getMemory<MembershipPlan[]>(KEYS.publicPlans);
  },

  isSyncing(key?: CacheKey): boolean {
    if (key) return syncingKeys.has(key);
    return syncingKeys.size > 0;
  },

  // ── Async reads (CacheStorage → network fallback) ─────────────────────────

  async getPlans(forceRefresh = false): Promise<MembershipPlan[]> {
    if (!forceRefresh) {
      const cached = await readJson<MembershipPlan[]>(KEYS.plans);
      if (cached && Array.isArray(cached)) {
        if (isStaleSync('plans', 10)) {
          backgroundRefresh('plans', () => membershipService.listPlans());
        }
        return cached;
      }
    }
    return fetchAndStore('plans', () => membershipService.listPlans());
  },

  async getPublicPlans(forceRefresh = false): Promise<MembershipPlan[]> {
    if (!forceRefresh) {
      const cached = await readJson<MembershipPlan[]>(KEYS.publicPlans);
      if (cached && Array.isArray(cached)) {
        if (isStaleSync('publicPlans', 15)) {
          backgroundRefresh('publicPlans', () => membershipService.publicPlans());
        }
        return cached;
      }
    }
    return fetchAndStore('publicPlans', () => membershipService.publicPlans());
  },

  async getList(
    params: Record<string, unknown> = {},
    forceRefresh = false
  ): Promise<{ data: Membership[]; meta?: Record<string, unknown> }> {
    const hasFilters = Object.values(params).some(
      (v) => v !== undefined && v !== '' && v !== null
    );
    if (hasFilters) {
      return membershipService.listMemberships(params);
    }
    if (!forceRefresh) {
      const cached = await readJson<{ data: Membership[]; meta?: Record<string, unknown> }>(
        KEYS.list
      );
      if (cached && Array.isArray(cached.data)) {
        if (isStaleSync('list', 3)) {
          backgroundRefresh('list', () => membershipService.listMemberships(params));
        }
        return cached;
      }
    }
    return fetchAndStore('list', () => membershipService.listMemberships(params));
  },

  async getMine(forceRefresh = false): Promise<Membership | null> {
    if (!forceRefresh) {
      const cached = await readJson<Membership | null>(KEYS.mine);
      if (cached !== null) {
        if (isStaleSync('mine', 3)) {
          backgroundRefresh('mine', () => membershipService.myMembership());
        }
        return cached;
      }
    }
    return fetchAndStore('mine', () => membershipService.myMembership());
  },

  async invalidate(key?: CacheKey): Promise<void> {
    // Clear from memory immediately so pages don't show stale data
    if (key) {
      memStore.delete(KEYS[key]);
      staleTimestamps.delete(key);
    } else {
      memStore.clear();
      staleTimestamps.clear();
    }
    const cache = await openCache();
    if (!cache) {
      emit({ key: key ?? 'all', source: 'invalidate' });
      return;
    }
    try {
      if (key) {
        await cache.delete(KEYS[key]);
      } else {
        await Promise.all(Object.values(KEYS).map((k) => cache.delete(k)));
      }
      emit({ key: key ?? 'all', source: 'invalidate' });
    } catch {
    }
  },

  async updateMembershipInCache(updated: Membership): Promise<void> {
    const cached = await readJson<{ data: Membership[]; meta?: Record<string, unknown> }>(
      KEYS.list
    );
    if (cached?.data) {
      const idx = cached.data.findIndex((m) => m.id === updated.id);
      if (idx >= 0) {
        cached.data[idx] = updated;
        await writeJson(KEYS.list, cached);
        emit({ key: 'list', source: 'update', id: updated.id });
      }
    }
    const mine = await readJson<Membership | null>(KEYS.mine);
    if (mine && mine.id === updated.id) {
      await writeJson(KEYS.mine, updated);
      emit({ key: 'mine', source: 'update', id: updated.id });
    }
  },

  // Returns the individual membership from the list cache (no network call).
  getMembershipFromCache(id: number): Membership | null {
    const list = getMemory<{ data: Membership[] }>(KEYS.list);
    return list?.data?.find((m) => m.id === id) ?? null;
  },

  onUpdate(handler: (detail: Record<string, unknown>) => void): () => void {
    const wrapped = (e: Event) => handler((e as CustomEvent).detail || {});
    window.addEventListener('memberships-cache-updated', wrapped);
    return () => window.removeEventListener('memberships-cache-updated', wrapped);
  },
};

export default membershipCache;
