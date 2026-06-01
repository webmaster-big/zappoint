
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
  const cache = await openCache();
  if (!cache) return null;
  try {
    const res = await cache.match(key);
    if (!res) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

async function writeJson(key: string, data: unknown): Promise<void> {
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

async function getMetadata(): Promise<CacheMetadata | null> {
  return readJson<CacheMetadata>(KEYS.metadata);
}

async function isStale(maxAgeMinutes: number): Promise<boolean> {
  const meta = await getMetadata();
  if (!meta) return true;
  return Date.now() - meta.lastUpdated > maxAgeMinutes * 60 * 1000;
}

function emit(detail: Record<string, unknown> = {}): void {
  window.dispatchEvent(new CustomEvent('memberships-cache-updated', { detail }));
}

const inflight = new Map<CacheKey, Promise<unknown>>();

async function fetchAndStore<T>(
  key: CacheKey,
  fetcher: () => Promise<T>
): Promise<T> {
  if (inflight.has(key)) {
    return inflight.get(key) as Promise<T>;
  }
  const p = (async () => {
    try {
      const data = await fetcher();
      await writeJson(KEYS[key], data);
      await touchMetadata();
      emit({ key });
      return data;
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, p);
  return p;
}

function backgroundRefresh<T>(key: CacheKey, fetcher: () => Promise<T>): void {
  if (inflight.has(key)) return;
  setTimeout(() => {
    fetchAndStore(key, fetcher).catch(() => {
    });
  }, 0);
}


export const membershipCache = {
  async getPlans(forceRefresh = false): Promise<MembershipPlan[]> {
    if (!forceRefresh) {
      const cached = await readJson<MembershipPlan[]>(KEYS.plans);
      if (cached && Array.isArray(cached)) {
        if (await isStale(10)) {
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
        if (await isStale(15)) {
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
        if (await isStale(5)) {
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
        if (await isStale(5)) {
          backgroundRefresh('mine', () => membershipService.myMembership());
        }
        return cached;
      }
    }
    return fetchAndStore('mine', () => membershipService.myMembership());
  },

  async invalidate(key?: CacheKey): Promise<void> {
    const cache = await openCache();
    if (!cache) return;
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

  onUpdate(handler: (detail: Record<string, unknown>) => void): () => void {
    const wrapped = (e: Event) => handler((e as CustomEvent).detail || {});
    window.addEventListener('memberships-cache-updated', wrapped);
    return () => window.removeEventListener('memberships-cache-updated', wrapped);
  },
};

export default membershipCache;
