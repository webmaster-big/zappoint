
import { attractionPurchaseService, type AttractionPurchase, type PurchaseFilters } from './AttractionPurchaseService';

const CACHE_NAME = 'zapzone-attraction-purchases-cache-v1';
const PURCHASES_CACHE_KEY = '/api/attraction-purchases/cached';
const CACHE_METADATA_KEY = '/api/attraction-purchases/metadata';

let warmupCompleted = false;

interface CacheMetadata {
  lastUpdated: number;
  locationId?: number;
  userId?: number;
  totalRecords: number;
}

interface PurchasesCacheEntry {
  purchases: AttractionPurchase[];
  pagination?: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
  filters?: PurchaseFilters;
}

class AttractionPurchaseCacheService {
  private static instance: AttractionPurchaseCacheService;
  private isSyncing: boolean = false;
  private syncPromise: Promise<AttractionPurchase[]> | null = null;

  private constructor() {}

  static getInstance(): AttractionPurchaseCacheService {
    if (!AttractionPurchaseCacheService.instance) {
      AttractionPurchaseCacheService.instance = new AttractionPurchaseCacheService();
    }
    return AttractionPurchaseCacheService.instance;
  }

  private isCacheAvailable(): boolean {
    return 'caches' in window;
  }

  private async getCache(): Promise<Cache | null> {
    if (!this.isCacheAvailable()) {
      console.warn('[PurchaseCacheService] Cache Storage not available');
      return null;
    }
    return await caches.open(CACHE_NAME);
  }

  async cachePurchases(purchases: AttractionPurchase[], metadata?: Partial<CacheMetadata>): Promise<void> {
    const cache = await this.getCache();
    if (!cache) return;

    try {
      const cacheEntry: PurchasesCacheEntry = { purchases };

      const response = new Response(JSON.stringify(cacheEntry), {
        headers: {
          'Content-Type': 'application/json',
          'X-Cache-Date': new Date().toISOString(),
        },
      });

      await cache.put(PURCHASES_CACHE_KEY, response);

      const fullMetadata: CacheMetadata = {
        lastUpdated: Date.now(),
        totalRecords: purchases.length,
        ...metadata,
      };

      const metadataResponse = new Response(JSON.stringify(fullMetadata), {
        headers: { 'Content-Type': 'application/json' },
      });

      await cache.put(CACHE_METADATA_KEY, metadataResponse);

      console.log(`[PurchaseCacheService] Cached ${purchases.length} purchases`);
    } catch (error) {
      console.error('[PurchaseCacheService] Error caching purchases:', error);
    }
  }

  async getCachedPurchases(): Promise<AttractionPurchase[] | null> {
    const cache = await this.getCache();
    if (!cache) return null;

    try {
      const response = await cache.match(PURCHASES_CACHE_KEY);
      if (!response) return null;

      const data: PurchasesCacheEntry = await response.json();
      console.log(`[PurchaseCacheService] Retrieved ${data.purchases.length} purchases from cache`);
      return data.purchases;
    } catch (error) {
      console.error('[PurchaseCacheService] Error reading cached purchases:', error);
      return null;
    }
  }

  async getCacheMetadata(): Promise<CacheMetadata | null> {
    const cache = await this.getCache();
    if (!cache) return null;

    try {
      const response = await cache.match(CACHE_METADATA_KEY);
      if (!response) return null;

      return await response.json();
    } catch (error) {
      console.error('[PurchaseCacheService] Error reading cache metadata:', error);
      return null;
    }
  }

  async isCacheStale(maxAgeMinutes: number = 5): Promise<boolean> {
    const metadata = await this.getCacheMetadata();
    if (!metadata) return true;

    const ageMs = Date.now() - metadata.lastUpdated;
    const maxAgeMs = maxAgeMinutes * 60 * 1000;

    return ageMs > maxAgeMs;
  }

  async fetchAndCachePurchases(
    filters?: PurchaseFilters,
    forceRefresh: boolean = false
  ): Promise<AttractionPurchase[]> {
    if (this.isSyncing && this.syncPromise) {
      return this.syncPromise;
    }

    if (!forceRefresh) {
      const cachedPurchases = await this.getCachedPurchases();
      const isStale = await this.isCacheStale();

      if (cachedPurchases && cachedPurchases.length > 0) {
        if (isStale) {
          this.syncInBackground(filters);
        }
        return cachedPurchases;
      }
    }

    return this.syncFromAPI(filters);
  }

  private async syncFromAPI(filters?: PurchaseFilters): Promise<AttractionPurchase[]> {
    this.isSyncing = true;

    this.syncPromise = (async () => {
      try {
        const response = await attractionPurchaseService.getPurchases({
          ...filters,
          per_page: 500,
        });

        const purchases = response.data.purchases || [];

        await this.cachePurchases(purchases, {
          locationId: filters?.location_id,
          userId: filters?.user_id,
        });

        window.dispatchEvent(new CustomEvent('purchases-cache-updated', {
          detail: { purchases, source: 'api' }
        }));

        return purchases;
      } catch (error) {
        console.error('[PurchaseCacheService] Error fetching purchases:', error);
        const cached = await this.getCachedPurchases();
        return cached || [];
      } finally {
        this.isSyncing = false;
        this.syncPromise = null;
      }
    })();

    return this.syncPromise;
  }

  syncInBackground(filters?: PurchaseFilters): void {
    if (this.isSyncing) return;

    setTimeout(async () => {
      try {
        await this.syncFromAPI(filters);
        console.log('[PurchaseCacheService] Background sync completed');
      } catch (error) {
        console.error('[PurchaseCacheService] Background sync failed:', error);
      }
    }, 0);
  }

  async updatePurchaseInCache(updatedPurchase: AttractionPurchase): Promise<void> {
    const cachedPurchases = await this.getCachedPurchases();
    if (!cachedPurchases) return;

    const index = cachedPurchases.findIndex(p => p.id === updatedPurchase.id);
    
    if (index >= 0) {
      cachedPurchases[index] = updatedPurchase;
    } else {
      cachedPurchases.unshift(updatedPurchase);
    }

    await this.cachePurchases(cachedPurchases);

    window.dispatchEvent(new CustomEvent('purchases-cache-updated', {
      detail: { purchase: updatedPurchase, source: 'update' }
    }));
  }

  async addPurchaseToCache(newPurchase: AttractionPurchase): Promise<void> {
    const cachedPurchases = await this.getCachedPurchases();
    const purchases = cachedPurchases || [];

    const exists = purchases.some(p => p.id === newPurchase.id);
    if (!exists) {
      purchases.unshift(newPurchase);
      await this.cachePurchases(purchases);
    }

    window.dispatchEvent(new CustomEvent('purchases-cache-updated', {
      detail: { purchase: newPurchase, source: 'create' }
    }));
  }

  async removePurchaseFromCache(purchaseId: number): Promise<void> {
    const cachedPurchases = await this.getCachedPurchases();
    if (!cachedPurchases) return;

    const filteredPurchases = cachedPurchases.filter(p => p.id !== purchaseId);
    await this.cachePurchases(filteredPurchases);

    window.dispatchEvent(new CustomEvent('purchases-cache-updated', {
      detail: { purchaseId, source: 'delete' }
    }));
  }

  async getPurchaseFromCache(purchaseId: number): Promise<AttractionPurchase | null> {
    const cachedPurchases = await this.getCachedPurchases();
    if (!cachedPurchases) return null;

    return cachedPurchases.find(p => p.id === purchaseId) || null;
  }

  async getFilteredPurchasesFromCache(filters: PurchaseFilters): Promise<AttractionPurchase[]> {
    const cachedPurchases = await this.getCachedPurchases();
    if (!cachedPurchases) return [];

    return cachedPurchases.filter(purchase => {
      if (filters.location_id && purchase.location_id !== filters.location_id) {
        return false;
      }

      if (filters.status && purchase.status !== filters.status) {
        return false;
      }

      if (filters.attraction_id && purchase.attraction_id !== filters.attraction_id) {
        return false;
      }

      if (filters.customer_id && purchase.customer_id !== filters.customer_id) {
        return false;
      }

      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const customerName = purchase.guest_name?.toLowerCase() || '';
        const customerEmail = purchase.guest_email?.toLowerCase() || '';
        const attractionName = purchase.attraction?.name?.toLowerCase() || '';

        if (
          !customerName.includes(searchLower) &&
          !customerEmail.includes(searchLower) &&
          !attractionName.includes(searchLower)
        ) {
          return false;
        }
      }

      return true;
    });
  }

  async clearCache(): Promise<void> {
    if (!this.isCacheAvailable()) return;

    try {
      const deleted = await caches.delete(CACHE_NAME);
      if (deleted) {
        console.log('[PurchaseCacheService] Cache cleared successfully');
      }

      warmupCompleted = false;

      window.dispatchEvent(new CustomEvent('purchases-cache-cleared'));
    } catch (error) {
      console.error('[PurchaseCacheService] Error clearing cache:', error);
    }
  }

  async forceRefresh(filters?: PurchaseFilters): Promise<AttractionPurchase[]> {
    return this.fetchAndCachePurchases(filters, true);
  }

  async warmupCache(filters?: PurchaseFilters): Promise<void> {
    if (warmupCompleted) {
      console.log('[PurchaseCacheService] Warmup already completed this session');
      return;
    }

    const cachedPurchases = await this.getCachedPurchases();

    if (!cachedPurchases || cachedPurchases.length === 0) {
      console.log('[PurchaseCacheService] Warming up cache...');
      await this.syncFromAPI(filters);
      console.log('[PurchaseCacheService] Cache warmup complete');
    } else {
      console.log('[PurchaseCacheService] Cache already has data, skipping warmup');
    }

    warmupCompleted = true;
  }

  async hasCachedData(): Promise<boolean> {
    const cache = await this.getCache();
    if (!cache) return false;

    try {
      const response = await cache.match(PURCHASES_CACHE_KEY);
      return response !== undefined;
    } catch {
      return false;
    }
  }

  async getPurchases(filters?: PurchaseFilters): Promise<AttractionPurchase[]> {
    return this.fetchAndCachePurchases(filters);
  }

  onCacheUpdate(callback: (event: CustomEvent) => void): () => void {
    const handler = (e: Event) => callback(e as CustomEvent);
    window.addEventListener('purchases-cache-updated', handler);
    return () => window.removeEventListener('purchases-cache-updated', handler);
  }

  onCacheCleared(callback: () => void): () => void {
    window.addEventListener('purchases-cache-cleared', callback);
    return () => window.removeEventListener('purchases-cache-cleared', callback);
  }
}

export const attractionPurchaseCacheService = AttractionPurchaseCacheService.getInstance();

export type { PurchasesCacheEntry, CacheMetadata };
