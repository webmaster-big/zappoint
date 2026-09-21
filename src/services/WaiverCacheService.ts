import waiverService from './waiverService';
import type { Waiver, WaiverSearchFilters } from '../types/waiver.types';

const CACHE_NAME = 'zapzone-waivers-cache-v1';
const CACHE_METADATA_KEY = '/api/waivers/metadata';

// The endpoint puts no ceiling on per_page, so ask for a lot and make few calls.
const PER_PAGE = 1000;
// Bounded fan-out: a venue with a very long history should not open 100 sockets at once.
const CONCURRENCY = 5;
// A hard stop so an enormous "all time" range cannot hang the screen indefinitely.
const MAX_PAGES = 40;

interface CacheMetadata {
  lastUpdated: number;
  userId?: number;
  locationId?: number;
  signature: string;
}

/**
 * The records screen is filtered by timeframe, status and location, and those sets do not
 * overlap — "today, completed, Brighton" is not a subset of "all time, all statuses". So each
 * filter combination gets its own cache entry rather than one blob that would serve the wrong
 * period to whoever looked next.
 */
const signatureFor = (filters: WaiverSearchFilters): string =>
  JSON.stringify({
    all: filters.all ?? null,
    timeframe: filters.timeframe ?? null,
    start_date: filters.start_date ?? null,
    end_date: filters.end_date ?? null,
    status: filters.status ?? null,
    location_id: filters.location_id ?? null,
  });

const keyFor = (signature: string): string =>
  `/api/waivers/cached?sig=${encodeURIComponent(signature)}`;

const getStoredUserId = (): number | undefined => {
  try {
    const raw = localStorage.getItem('zapzone_user');
    if (!raw) return undefined;
    const parsed = JSON.parse(raw);
    return typeof parsed?.id === 'number' ? parsed.id : undefined;
  } catch {
    return undefined;
  }
};

class WaiverCacheService {
  private isSyncing = false;
  private syncPromise: Promise<Waiver[]> | null = null;
  private syncScheduled = false;

  private async getCache(): Promise<Cache | null> {
    if (typeof window === 'undefined' || !('caches' in window)) return null;
    try {
      return await caches.open(CACHE_NAME);
    } catch {
      return null;
    }
  }

  async cacheWaivers(waivers: Waiver[], filters: WaiverSearchFilters): Promise<void> {
    const cache = await this.getCache();
    if (!cache) return;
    const signature = signatureFor(filters);
    try {
      await cache.put(
        keyFor(signature),
        new Response(JSON.stringify(waivers), { headers: { 'Content-Type': 'application/json' } }),
      );
      const metadata: CacheMetadata = {
        lastUpdated: Date.now(),
        userId: getStoredUserId(),
        locationId: filters.location_id,
        signature,
      };
      await cache.put(
        CACHE_METADATA_KEY,
        new Response(JSON.stringify(metadata), { headers: { 'Content-Type': 'application/json' } }),
      );
    } catch {
      /* quota or private browsing — the screen still works, it just refetches */
    }
  }

  async getCachedWaivers(filters: WaiverSearchFilters): Promise<Waiver[] | null> {
    const cache = await this.getCache();
    if (!cache) return null;
    try {
      const res = await cache.match(keyFor(signatureFor(filters)));
      if (!res) return null;
      return (await res.json()) as Waiver[];
    } catch {
      return null;
    }
  }

  async getCacheMetadata(): Promise<CacheMetadata | null> {
    const cache = await this.getCache();
    if (!cache) return null;
    try {
      const res = await cache.match(CACHE_METADATA_KEY);
      if (!res) return null;
      return (await res.json()) as CacheMetadata;
    } catch {
      return null;
    }
  }

  /** Waivers are signed continuously at the desk, so this window is deliberately short. */
  async isCacheStale(filters: WaiverSearchFilters, maxAgeSeconds = 60): Promise<boolean> {
    const metadata = await this.getCacheMetadata();
    if (!metadata) return true;
    if (metadata.signature !== signatureFor(filters)) return true;
    return Date.now() - metadata.lastUpdated > maxAgeSeconds * 1000;
  }

  /**
   * Stale-while-revalidate: hand back whatever is cached immediately so the table paints, and
   * refresh behind it. Only a cold cache waits on the network.
   */
  async fetchAndCacheWaivers(filters: WaiverSearchFilters, forceRefresh = false): Promise<Waiver[]> {
    if (this.isSyncing && this.syncPromise) return this.syncPromise;

    if (!forceRefresh) {
      const cached = await this.getCachedWaivers(filters);
      if (cached && cached.length > 0) {
        if (await this.isCacheStale(filters)) this.syncInBackground(filters);
        return cached;
      }
    }

    return this.syncFromAPI(filters);
  }

  private async syncFromAPI(filters: WaiverSearchFilters): Promise<Waiver[]> {
    this.isSyncing = true;

    this.syncPromise = (async () => {
      try {
        // Page one tells us how many there are; the rest go out together. Walking them one at a
        // time was the whole delay — 3k waivers at 200/page is 16 sequential round-trips, each
        // paying Laravel boot and ~130ms of eager-loaded query before the next one even starts.
        const first = await waiverService.list({ ...filters, per_page: PER_PAGE, page: 1 });
        if (!first.success) return [];

        const collected: Waiver[] = [...((first.data.waivers as Waiver[]) || [])];
        const lastPage = Math.min(first.data.pagination?.last_page ?? 1, MAX_PAGES);

        for (let page = 2; page <= lastPage; page += CONCURRENCY) {
          const batch = [];
          for (let i = page; i < page + CONCURRENCY && i <= lastPage; i++) {
            batch.push(waiverService.list({ ...filters, per_page: PER_PAGE, page: i }));
          }
          const results = await Promise.all(batch);
          for (const res of results) {
            if (res.success) collected.push(...((res.data.waivers as Waiver[]) || []));
          }
        }

        await this.cacheWaivers(collected, filters);

        window.dispatchEvent(
          new CustomEvent('waivers-cache-updated', {
            detail: { waivers: collected, signature: signatureFor(filters) },
          }),
        );

        return collected;
      } catch {
        const cached = await this.getCachedWaivers(filters);
        return cached || [];
      } finally {
        this.isSyncing = false;
        this.syncPromise = null;
      }
    })();

    return this.syncPromise;
  }

  syncInBackground(filters: WaiverSearchFilters): void {
    if (this.isSyncing || this.syncScheduled) return;
    this.syncScheduled = true;

    setTimeout(async () => {
      try {
        await this.syncFromAPI(filters);
      } catch {
        /* the cached copy stays on screen */
      } finally {
        this.syncScheduled = false;
      }
    }, 0);
  }

  async forceRefresh(filters: WaiverSearchFilters): Promise<Waiver[]> {
    return this.syncFromAPI(filters);
  }

  /** Signing, checking in or deleting a waiver invalidates every cached period at once. */
  async clearCache(): Promise<void> {
    if (typeof window === 'undefined' || !('caches' in window)) return;
    try {
      await caches.delete(CACHE_NAME);
    } catch {
      /* ignore */
    }
  }
}

export const waiverCacheService = new WaiverCacheService();
export default waiverCacheService;
