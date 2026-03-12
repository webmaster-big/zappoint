/**
 * CustomerDataCacheService
 * 
 * Caches grouped customer-facing data (attractions, packages, events) using
 * the Cache Storage API. Follows the same stale-while-revalidate pattern
 * used by admin cache services (PackageCacheService, AttractionCacheService).
 *
 * - Loads cached data instantly on mount
 * - Background-fetches fresh data from the API
 * - Dispatches CustomEvent when cache is updated so components can re-render
 */

import { customerService, type GroupedAttraction, type GroupedPackage, type GroupedEvent } from './CustomerService';

const CACHE_NAME = 'zapzone-customer-data-v1';
const ATTRACTIONS_KEY = '/customer/attractions/cached';
const PACKAGES_KEY = '/customer/packages/cached';
const EVENTS_KEY = '/customer/events/cached';
const METADATA_KEY = '/customer/metadata';

export const CUSTOMER_CACHE_EVENT = 'customer-data-cache-updated';

interface CacheMetadata {
  lastUpdated: number;
}

interface CustomerDataCache {
  attractions: GroupedAttraction[];
  packages: GroupedPackage[];
  events: GroupedEvent[];
}

class CustomerDataCacheService {
  private static instance: CustomerDataCacheService;
  private isSyncing = false;

  private constructor() {}

  static getInstance(): CustomerDataCacheService {
    if (!CustomerDataCacheService.instance) {
      CustomerDataCacheService.instance = new CustomerDataCacheService();
    }
    return CustomerDataCacheService.instance;
  }

  private isCacheAvailable(): boolean {
    return 'caches' in window;
  }

  private async getCache(): Promise<Cache | null> {
    if (!this.isCacheAvailable()) return null;
    return caches.open(CACHE_NAME);
  }

  private async putJSON(cache: Cache, key: string, data: unknown): Promise<void> {
    await cache.put(key, new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json' },
    }));
  }

  private async getJSON<T>(cache: Cache, key: string): Promise<T | null> {
    const response = await cache.match(key);
    if (!response) return null;
    return response.json();
  }

  // ── Cache read/write ───────────────────────────────────────────

  async getCachedAttractions(): Promise<GroupedAttraction[] | null> {
    const cache = await this.getCache();
    if (!cache) return null;
    return this.getJSON<GroupedAttraction[]>(cache, ATTRACTIONS_KEY);
  }

  async getCachedPackages(): Promise<GroupedPackage[] | null> {
    const cache = await this.getCache();
    if (!cache) return null;
    return this.getJSON<GroupedPackage[]>(cache, PACKAGES_KEY);
  }

  async getCachedEvents(): Promise<GroupedEvent[] | null> {
    const cache = await this.getCache();
    if (!cache) return null;
    return this.getJSON<GroupedEvent[]>(cache, EVENTS_KEY);
  }

  async getCachedAll(): Promise<CustomerDataCache | null> {
    const cache = await this.getCache();
    if (!cache) return null;

    const [attractions, packages, events] = await Promise.all([
      this.getJSON<GroupedAttraction[]>(cache, ATTRACTIONS_KEY),
      this.getJSON<GroupedPackage[]>(cache, PACKAGES_KEY),
      this.getJSON<GroupedEvent[]>(cache, EVENTS_KEY),
    ]);

    if (!attractions && !packages && !events) return null;

    return {
      attractions: attractions || [],
      packages: packages || [],
      events: events || [],
    };
  }

  async hasCachedData(): Promise<boolean> {
    const cache = await this.getCache();
    if (!cache) return false;
    const meta = await this.getJSON<CacheMetadata>(cache, METADATA_KEY);
    return !!meta;
  }

  async isCacheStale(maxAgeMinutes = 5): Promise<boolean> {
    const cache = await this.getCache();
    if (!cache) return true;
    const meta = await this.getJSON<CacheMetadata>(cache, METADATA_KEY);
    if (!meta) return true;
    return Date.now() - meta.lastUpdated > maxAgeMinutes * 60 * 1000;
  }

  // ── Fetch from API and update cache ────────────────────────────

  async fetchAndCache(): Promise<CustomerDataCache> {
    const [attractionsResult, packagesResult, eventsResult] = await Promise.allSettled([
      customerService.getGroupedAttractions(),
      customerService.getGroupedPackages(),
      customerService.getGroupedEvents(),
    ]);

    const attractions = attractionsResult.status === 'fulfilled' && attractionsResult.value.success
      ? attractionsResult.value.data : [];
    const packages = packagesResult.status === 'fulfilled' && packagesResult.value.success
      ? packagesResult.value.data : [];
    const events = eventsResult.status === 'fulfilled' && eventsResult.value.success
      ? eventsResult.value.data : [];

    const cache = await this.getCache();
    if (cache) {
      await Promise.all([
        this.putJSON(cache, ATTRACTIONS_KEY, attractions),
        this.putJSON(cache, PACKAGES_KEY, packages),
        this.putJSON(cache, EVENTS_KEY, events),
        this.putJSON(cache, METADATA_KEY, { lastUpdated: Date.now() } as CacheMetadata),
      ]);
    }

    const data: CustomerDataCache = { attractions, packages, events };

    window.dispatchEvent(new CustomEvent(CUSTOMER_CACHE_EVENT, {
      detail: { data, source: 'api' },
    }));

    return data;
  }

  syncInBackground(): void {
    if (this.isSyncing) return;
    this.isSyncing = true;

    setTimeout(async () => {
      try {
        await this.fetchAndCache();
      } catch (error) {
        console.error('[CustomerDataCacheService] Background sync failed:', error);
      } finally {
        this.isSyncing = false;
      }
    }, 0);
  }

  async clearCache(): Promise<void> {
    if (this.isCacheAvailable()) {
      await caches.delete(CACHE_NAME);
    }
  }

  onCacheUpdate(callback: (event: CustomEvent) => void): () => void {
    const handler = (e: Event) => callback(e as CustomEvent);
    window.addEventListener(CUSTOMER_CACHE_EVENT, handler);
    return () => window.removeEventListener(CUSTOMER_CACHE_EVENT, handler);
  }
}

export const customerDataCacheService = CustomerDataCacheService.getInstance();
