/**
 * AddOnCacheService
 * 
 * A service that uses the Cache Storage API to cache add-on data for faster
 * access across booking and management components.
 * 
 * Features:
 * - Store add-ons in Cache Storage (not localStorage/sessionStorage)
 * - Provide cached data as primary source for rendering
 * - Update cache when add-ons are created/updated/deleted
 * - Background sync on component navigation
 * - Clear cache on logout
 */

import addOnService, { type AddOn, type AddOnFilters, type PaginatedResponse } from './AddOnService';

const CACHE_NAME = 'zapzone-addons-cache-v1';
const ADDONS_CACHE_KEY = '/api/addons/cached';
const CACHE_METADATA_KEY = '/api/addons/metadata';

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
interface AddOnsCacheEntry {
  addOns: AddOn[];
  pagination?: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
  filters?: AddOnFilters;
}

class AddOnCacheService {
  private static instance: AddOnCacheService;
  private isSyncing: boolean = false;
  private syncPromise: Promise<AddOn[]> | null = null;

  private constructor() {}

  static getInstance(): AddOnCacheService {
    if (!AddOnCacheService.instance) {
      AddOnCacheService.instance = new AddOnCacheService();
    }
    return AddOnCacheService.instance;
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
      console.warn('[AddOnCacheService] Cache Storage not available');
      return null;
    }
    return await caches.open(CACHE_NAME);
  }

  /**
   * Store add-ons in cache
   */
  async cacheAddOns(addOns: AddOn[], metadata?: Partial<CacheMetadata>): Promise<void> {
    const cache = await this.getCache();
    if (!cache) return;

    try {
      const cacheEntry: AddOnsCacheEntry = {
        addOns,
      };

      // Create a Response object to store in cache
      const response = new Response(JSON.stringify(cacheEntry), {
        headers: {
          'Content-Type': 'application/json',
          'X-Cache-Date': new Date().toISOString(),
        },
      });

      await cache.put(ADDONS_CACHE_KEY, response);

      // Store metadata
      const fullMetadata: CacheMetadata = {
        lastUpdated: Date.now(),
        totalRecords: addOns.length,
        ...metadata,
      };

      const metadataResponse = new Response(JSON.stringify(fullMetadata), {
        headers: { 'Content-Type': 'application/json' },
      });

      await cache.put(CACHE_METADATA_KEY, metadataResponse);

      console.log(`[AddOnCacheService] Cached ${addOns.length} add-ons`);
    } catch (error) {
      console.error('[AddOnCacheService] Error caching add-ons:', error);
    }
  }

  /**
   * Get add-ons from cache
   */
  async getCachedAddOns(): Promise<AddOn[] | null> {
    const cache = await this.getCache();
    if (!cache) return null;

    try {
      const response = await cache.match(ADDONS_CACHE_KEY);
      if (!response) return null;

      const data: AddOnsCacheEntry = await response.json();
      console.log(`[AddOnCacheService] Retrieved ${data.addOns.length} add-ons from cache`);
      return data.addOns;
    } catch (error) {
      console.error('[AddOnCacheService] Error reading cached add-ons:', error);
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
      console.error('[AddOnCacheService] Error reading cache metadata:', error);
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
   * Fetch add-ons from API and update cache
   * Returns cached data immediately if available, then syncs in background
   */
  async fetchAndCacheAddOns(
    filters?: AddOnFilters,
    forceRefresh: boolean = false
  ): Promise<AddOn[]> {
    // If already syncing, return the existing promise
    if (this.isSyncing && this.syncPromise) {
      return this.syncPromise;
    }

    // Check cache first (unless force refresh)
    if (!forceRefresh) {
      const cachedAddOns = await this.getCachedAddOns();
      const isStale = await this.isCacheStale();

      if (cachedAddOns && cachedAddOns.length > 0) {
        // If cache is stale, sync in background
        if (isStale) {
          this.syncInBackground(filters);
        }
        return cachedAddOns;
      }
    }

    // No cache or force refresh - fetch from API
    return this.syncFromAPI(filters);
  }

  /**
   * Sync add-ons from API
   */
  private async syncFromAPI(filters?: AddOnFilters): Promise<AddOn[]> {
    this.isSyncing = true;

    this.syncPromise = (async () => {
      try {
        // Fetch all add-ons with high per_page to get most data
        const response: PaginatedResponse<AddOn> = await addOnService.getAddOns({
          ...filters,
          per_page: 1000, // Get a large batch
        });

        const addOns = response.data.add_ons || [];

        // Cache the add-ons
        await this.cacheAddOns(addOns, {
          locationId: filters?.location_id,
          userId: filters?.user_id,
        });

        // Dispatch event to notify components
        window.dispatchEvent(new CustomEvent('addons-cache-updated', {
          detail: { addOns, source: 'api' }
        }));

        return addOns;
      } catch (error) {
        console.error('[AddOnCacheService] Error fetching add-ons:', error);
        // Return cached data as fallback
        const cached = await this.getCachedAddOns();
        return cached || [];
      } finally {
        this.isSyncing = false;
        this.syncPromise = null;
      }
    })();

    return this.syncPromise;
  }

  /**
   * Sync add-ons in background without blocking
   */
  syncInBackground(filters?: AddOnFilters): void {
    if (this.isSyncing) return;

    // Use setTimeout to ensure it runs in background
    setTimeout(async () => {
      try {
        await this.syncFromAPI(filters);
        console.log('[AddOnCacheService] Background sync completed');
      } catch (error) {
        console.error('[AddOnCacheService] Background sync failed:', error);
      }
    }, 0);
  }

  /**
   * Update a single add-on in cache
   */
  async updateAddOnInCache(updatedAddOn: AddOn): Promise<void> {
    const cachedAddOns = await this.getCachedAddOns();
    if (!cachedAddOns) return;

    const index = cachedAddOns.findIndex(a => a.id === updatedAddOn.id);
    if (index >= 0) {
      cachedAddOns[index] = updatedAddOn;
    } else {
      // Add-on not in cache, add it
      cachedAddOns.push(updatedAddOn);
    }

    await this.cacheAddOns(cachedAddOns);

    // Dispatch event
    window.dispatchEvent(new CustomEvent('addons-cache-updated', {
      detail: { addOnId: updatedAddOn.id, source: 'update' }
    }));
  }

  /**
   * Add a new add-on to cache
   */
  async addAddOnToCache(newAddOn: AddOn): Promise<void> {
    const cachedAddOns = await this.getCachedAddOns();
    const addOns = cachedAddOns || [];
    
    // Check if already exists
    const exists = addOns.some(a => a.id === newAddOn.id);
    if (!exists) {
      addOns.push(newAddOn);
      await this.cacheAddOns(addOns);
    }

    // Dispatch event
    window.dispatchEvent(new CustomEvent('addons-cache-updated', {
      detail: { addOnId: newAddOn.id, source: 'add' }
    }));
  }

  /**
   * Remove an add-on from cache
   */
  async removeAddOnFromCache(addOnId: number): Promise<void> {
    const cachedAddOns = await this.getCachedAddOns();
    if (!cachedAddOns) return;

    const filteredAddOns = cachedAddOns.filter(a => a.id !== addOnId);
    await this.cacheAddOns(filteredAddOns);

    // Dispatch event
    window.dispatchEvent(new CustomEvent('addons-cache-updated', {
      detail: { addOnId, source: 'delete' }
    }));
  }

  /**
   * Get a single add-on from cache by ID
   */
  async getAddOnFromCache(addOnId: number): Promise<AddOn | null> {
    const cachedAddOns = await this.getCachedAddOns();
    if (!cachedAddOns) return null;

    return cachedAddOns.find(a => a.id === addOnId) || null;
  }

  /**
   * Get add-ons from cache filtered by criteria
   */
  async getFilteredAddOnsFromCache(filters: AddOnFilters): Promise<AddOn[]> {
    const cachedAddOns = await this.getCachedAddOns();
    console.log('[AddOnCacheService] getFilteredAddOnsFromCache called with filters:', filters);
    console.log('[AddOnCacheService] cachedAddOns count:', cachedAddOns?.length || 0);
    
    if (!cachedAddOns) return [];

    const filtered = cachedAddOns.filter(addOn => {
      // Filter by location
      if (filters.location_id && addOn.location_id !== filters.location_id) {
        return false;
      }

      // Filter by is_active
      if (filters.is_active !== undefined && addOn.is_active !== filters.is_active) {
        return false;
      }

      // Filter by search query
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const name = addOn.name?.toLowerCase() || '';
        const description = addOn.description?.toLowerCase() || '';
        
        if (!name.includes(searchLower) && !description.includes(searchLower)) {
          return false;
        }
      }

      return true;
    });

    console.log('[AddOnCacheService] Filtered add-ons count:', filtered.length);
    return filtered;
  }

  /**
   * Clear all add-on cache data
   * Call this on user logout
   */
  async clearCache(): Promise<void> {
    if (!this.isCacheAvailable()) return;

    try {
      const deleted = await caches.delete(CACHE_NAME);
      if (deleted) {
        console.log('[AddOnCacheService] Cache cleared successfully');
      }
      
      // Reset warmup flag so next session will warmup again
      warmupCompleted = false;

      // Dispatch event
      window.dispatchEvent(new CustomEvent('addons-cache-updated', {
        detail: { source: 'clear' }
      }));
    } catch (error) {
      console.error('[AddOnCacheService] Error clearing cache:', error);
    }
  }

  /**
   * Warmup the cache - call this on app initialization or login
   * This pre-populates the cache so subsequent page loads are instant
   * Only fetches if cache is truly empty (not just stale)
   */
  async warmupCache(filters?: AddOnFilters): Promise<void> {
    // Skip if warmup already happened this session
    if (warmupCompleted) {
      console.log('[AddOnCacheService] Warmup already completed this session');
      return;
    }
    
    const cachedAddOns = await this.getCachedAddOns();
    
    // Only warmup if cache is empty (stale cache is still usable)
    if (!cachedAddOns || cachedAddOns.length === 0) {
      console.log('[AddOnCacheService] Warming up cache...');
      await this.syncFromAPI(filters);
      console.log('[AddOnCacheService] Cache warmup complete');
    } else {
      console.log('[AddOnCacheService] Cache already has data, skipping warmup');
    }
    
    warmupCompleted = true;
  }

  /**
   * Check if cache has data (for instant loading checks)
   * Returns true if cache entry exists (even if empty array - that's valid cached data)
   */
  async hasCachedData(): Promise<boolean> {
    const cache = await this.getCache();
    if (!cache) return false;
    
    try {
      const response = await cache.match(ADDONS_CACHE_KEY);
      return response !== undefined;
    } catch {
      return false;
    }
  }

  /**
   * Get add-ons with automatic cache management
   * - Returns cached data if available and fresh
   * - Syncs in background if cache is stale
   * - Fetches from API if no cache exists
   */
  async getAddOns(filters?: AddOnFilters): Promise<AddOn[]> {
    return this.fetchAndCacheAddOns(filters);
  }

  /**
   * Force refresh add-ons from API
   */
  async forceRefresh(filters?: AddOnFilters): Promise<AddOn[]> {
    return this.fetchAndCacheAddOns(filters, true);
  }

  /**
   * Subscribe to cache updates
   */
  onCacheUpdate(callback: (event: CustomEvent) => void): () => void {
    const handler = (e: Event) => callback(e as CustomEvent);
    window.addEventListener('addons-cache-updated', handler);
    return () => window.removeEventListener('addons-cache-updated', handler);
  }
}

// Export singleton instance
export const addOnCacheService = AddOnCacheService.getInstance();
export default addOnCacheService;
