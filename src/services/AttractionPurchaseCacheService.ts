/**
 * AttractionPurchaseCacheService
 * 
 * A service that uses the Cache Storage API to cache attraction purchase data for faster
 * access across dashboard components and purchase management pages.
 * 
 * Features:
 * - Store purchases in Cache Storage (not localStorage/sessionStorage)
 * - Provide cached data as primary source for rendering
 * - Update cache when purchases are created/updated/deleted
 * - Background sync on dashboard navigation
 * - Clear cache on logout
 */

import { attractionPurchaseService, type AttractionPurchase, type PurchaseFilters } from './AttractionPurchaseService';

const CACHE_NAME = 'zapzone-attraction-purchases-cache-v1';
const PURCHASES_CACHE_KEY = '/api/attraction-purchases/cached';
const CACHE_METADATA_KEY = '/api/attraction-purchases/metadata';

// Track if warmup already happened this session
let warmupCompleted = false;

// Cache metadata for tracking staleness
interface CacheMetadata {
  lastUpdated: number;
  locationId?: number;
  userId?: number;
  totalRecords: number;
}

// Cache entry structure
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

  /**
   * Check if Cache Storage is available
   */
  private isCacheAvailable(): boolean {
    return 'caches' in window;
  }

  /**
   * Get the cache instance
   */
  private async getCache(): Promise<Cache | null> {
    if (!this.isCacheAvailable()) {
      console.warn('[PurchaseCacheService] Cache Storage not available');
      return null;
    }
    return await caches.open(CACHE_NAME);
  }

  /**
   * Store purchases in cache
   */
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

      // Store metadata
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

  /**
   * Get purchases from cache
   */
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

  /**
   * Get cache metadata
   */
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

  /**
   * Check if cache is stale (older than specified minutes)
   */
  async isCacheStale(maxAgeMinutes: number = 5): Promise<boolean> {
    const metadata = await this.getCacheMetadata();
    if (!metadata) return true;

    const ageMs = Date.now() - metadata.lastUpdated;
    const maxAgeMs = maxAgeMinutes * 60 * 1000;

    return ageMs > maxAgeMs;
  }

  /**
   * Fetch purchases from API and update cache
   * Returns cached data immediately if available, then syncs in background
   */
  async fetchAndCachePurchases(
    filters?: PurchaseFilters,
    forceRefresh: boolean = false
  ): Promise<AttractionPurchase[]> {
    // If already syncing, return the existing promise
    if (this.isSyncing && this.syncPromise) {
      return this.syncPromise;
    }

    // Check cache first (unless force refresh)
    if (!forceRefresh) {
      const cachedPurchases = await this.getCachedPurchases();
      const isStale = await this.isCacheStale();

      if (cachedPurchases && cachedPurchases.length > 0) {
        // If cache is stale, sync in background
        if (isStale) {
          this.syncInBackground(filters);
        }
        return cachedPurchases;
      }
    }

    // No cache or force refresh - fetch from API
    return this.syncFromAPI(filters);
  }

  /**
   * Sync purchases from API
   */
  private async syncFromAPI(filters?: PurchaseFilters): Promise<AttractionPurchase[]> {
    this.isSyncing = true;

    this.syncPromise = (async () => {
      try {
        const response = await attractionPurchaseService.getPurchases({
          ...filters,
          per_page: 500,
        });

        const purchases = response.data.purchases || [];

        // Cache the purchases
        await this.cachePurchases(purchases, {
          locationId: filters?.location_id,
          userId: filters?.user_id,
        });

        // Dispatch event to notify components
        window.dispatchEvent(new CustomEvent('purchases-cache-updated', {
          detail: { purchases, source: 'api' }
        }));

        return purchases;
      } catch (error) {
        console.error('[PurchaseCacheService] Error fetching purchases:', error);
        // Return cached data as fallback
        const cached = await this.getCachedPurchases();
        return cached || [];
      } finally {
        this.isSyncing = false;
        this.syncPromise = null;
      }
    })();

    return this.syncPromise;
  }

  /**
   * Sync purchases in background without blocking
   */
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

  /**
   * Update a single purchase in cache
   */
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

  /**
   * Add a new purchase to cache
   */
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

  /**
   * Remove a purchase from cache
   */
  async removePurchaseFromCache(purchaseId: number): Promise<void> {
    const cachedPurchases = await this.getCachedPurchases();
    if (!cachedPurchases) return;

    const filteredPurchases = cachedPurchases.filter(p => p.id !== purchaseId);
    await this.cachePurchases(filteredPurchases);

    window.dispatchEvent(new CustomEvent('purchases-cache-updated', {
      detail: { purchaseId, source: 'delete' }
    }));
  }

  /**
   * Get a single purchase from cache by ID
   */
  async getPurchaseFromCache(purchaseId: number): Promise<AttractionPurchase | null> {
    const cachedPurchases = await this.getCachedPurchases();
    if (!cachedPurchases) return null;

    return cachedPurchases.find(p => p.id === purchaseId) || null;
  }

  /**
   * Get purchases from cache filtered by criteria
   */
  async getFilteredPurchasesFromCache(filters: PurchaseFilters): Promise<AttractionPurchase[]> {
    const cachedPurchases = await this.getCachedPurchases();
    if (!cachedPurchases) return [];

    return cachedPurchases.filter(purchase => {
      // Filter by location
      if (filters.location_id && purchase.location_id !== filters.location_id) {
        return false;
      }

      // Filter by status
      if (filters.status && purchase.status !== filters.status) {
        return false;
      }

      // Filter by attraction
      if (filters.attraction_id && purchase.attraction_id !== filters.attraction_id) {
        return false;
      }

      // Filter by customer
      if (filters.customer_id && purchase.customer_id !== filters.customer_id) {
        return false;
      }

      // Filter by search query
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

  /**
   * Clear all purchase cache data
   * Call this on user logout
   */
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

  /**
   * Force a full refresh of the cache
   */
  async forceRefresh(filters?: PurchaseFilters): Promise<AttractionPurchase[]> {
    return this.fetchAndCachePurchases(filters, true);
  }

  /**
   * Warmup the cache - call this on app initialization or login
   */
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

  /**
   * Check if cache has data
   */
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

  /**
   * Get purchases with automatic cache management
   */
  async getPurchases(filters?: PurchaseFilters): Promise<AttractionPurchase[]> {
    return this.fetchAndCachePurchases(filters);
  }

  /**
   * Subscribe to cache updates
   */
  onCacheUpdate(callback: (event: CustomEvent) => void): () => void {
    const handler = (e: Event) => callback(e as CustomEvent);
    window.addEventListener('purchases-cache-updated', handler);
    return () => window.removeEventListener('purchases-cache-updated', handler);
  }

  /**
   * Subscribe to cache cleared events
   */
  onCacheCleared(callback: () => void): () => void {
    window.addEventListener('purchases-cache-cleared', callback);
    return () => window.removeEventListener('purchases-cache-cleared', callback);
  }
}

// Export singleton instance
export const attractionPurchaseCacheService = AttractionPurchaseCacheService.getInstance();

// Export types for consumers
export type { PurchasesCacheEntry, CacheMetadata };
