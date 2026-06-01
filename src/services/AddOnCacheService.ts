
import addOnService, { type AddOn, type AddOnFilters, type PaginatedResponse } from './AddOnService';

const CACHE_NAME = 'zapzone-addons-cache-v1';
const ADDONS_CACHE_KEY = '/api/addons/cached';
const CACHE_METADATA_KEY = '/api/addons/metadata';

let warmupCompleted = false;

interface CacheMetadata {
  lastUpdated: number;
  locationId?: number;
  userId?: number;
  totalRecords: number;
}

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

  private isCacheAvailable(): boolean {
    return 'caches' in window;
  }

  private async getCache(): Promise<Cache | null> {
    if (!this.isCacheAvailable()) {
      console.warn('[AddOnCacheService] Cache Storage not available');
      return null;
    }
    return await caches.open(CACHE_NAME);
  }

  async cacheAddOns(addOns: AddOn[], metadata?: Partial<CacheMetadata>): Promise<void> {
    const cache = await this.getCache();
    if (!cache) return;

    try {
      const cacheEntry: AddOnsCacheEntry = {
        addOns,
      };

      const response = new Response(JSON.stringify(cacheEntry), {
        headers: {
          'Content-Type': 'application/json',
          'X-Cache-Date': new Date().toISOString(),
        },
      });

      await cache.put(ADDONS_CACHE_KEY, response);

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

  async isCacheStale(maxAgeMinutes: number = 5): Promise<boolean> {
    const metadata = await this.getCacheMetadata();
    if (!metadata) return true;

    const ageMs = Date.now() - metadata.lastUpdated;
    const maxAgeMs = maxAgeMinutes * 60 * 1000;

    return ageMs > maxAgeMs;
  }

  async fetchAndCacheAddOns(
    filters?: AddOnFilters,
    forceRefresh: boolean = false
  ): Promise<AddOn[]> {
    if (this.isSyncing && this.syncPromise) {
      return this.syncPromise;
    }

    if (!forceRefresh) {
      const cachedAddOns = await this.getCachedAddOns();
      const isStale = await this.isCacheStale();

      if (cachedAddOns && cachedAddOns.length > 0) {
        if (isStale) {
          this.syncInBackground(filters);
        }
        return cachedAddOns;
      }
    }

    return this.syncFromAPI(filters);
  }

  private async syncFromAPI(filters?: AddOnFilters): Promise<AddOn[]> {
    this.isSyncing = true;

    this.syncPromise = (async () => {
      try {
        const response: PaginatedResponse<AddOn> = await addOnService.getAddOns({
          ...filters,
          per_page: 1000, // Get a large batch
        });

        const addOns = response.data.add_ons || [];

        await this.cacheAddOns(addOns, {
          locationId: filters?.location_id,
          userId: filters?.user_id,
        });

        window.dispatchEvent(new CustomEvent('addons-cache-updated', {
          detail: { addOns, source: 'api' }
        }));

        return addOns;
      } catch (error) {
        console.error('[AddOnCacheService] Error fetching add-ons:', error);
        const cached = await this.getCachedAddOns();
        return cached || [];
      } finally {
        this.isSyncing = false;
        this.syncPromise = null;
      }
    })();

    return this.syncPromise;
  }

  syncInBackground(filters?: AddOnFilters): void {
    if (this.isSyncing) return;

    setTimeout(async () => {
      try {
        await this.syncFromAPI(filters);
        console.log('[AddOnCacheService] Background sync completed');
      } catch (error) {
        console.error('[AddOnCacheService] Background sync failed:', error);
      }
    }, 0);
  }

  async updateAddOnInCache(updatedAddOn: AddOn): Promise<void> {
    const cachedAddOns = await this.getCachedAddOns();
    if (!cachedAddOns) return;

    const index = cachedAddOns.findIndex(a => a.id === updatedAddOn.id);
    if (index >= 0) {
      cachedAddOns[index] = updatedAddOn;
    } else {
      cachedAddOns.push(updatedAddOn);
    }

    await this.cacheAddOns(cachedAddOns);

    window.dispatchEvent(new CustomEvent('addons-cache-updated', {
      detail: { addOnId: updatedAddOn.id, source: 'update' }
    }));
  }

  async addAddOnToCache(newAddOn: AddOn): Promise<void> {
    const cachedAddOns = await this.getCachedAddOns();
    const addOns = cachedAddOns || [];
    
    const exists = addOns.some(a => a.id === newAddOn.id);
    if (!exists) {
      addOns.push(newAddOn);
      await this.cacheAddOns(addOns);
    }

    window.dispatchEvent(new CustomEvent('addons-cache-updated', {
      detail: { addOnId: newAddOn.id, source: 'add' }
    }));
  }

  async removeAddOnFromCache(addOnId: number): Promise<void> {
    const cachedAddOns = await this.getCachedAddOns();
    if (!cachedAddOns) return;

    const filteredAddOns = cachedAddOns.filter(a => a.id !== addOnId);
    await this.cacheAddOns(filteredAddOns);

    window.dispatchEvent(new CustomEvent('addons-cache-updated', {
      detail: { addOnId, source: 'delete' }
    }));
  }

  async getAddOnFromCache(addOnId: number): Promise<AddOn | null> {
    const cachedAddOns = await this.getCachedAddOns();
    if (!cachedAddOns) return null;

    return cachedAddOns.find(a => a.id === addOnId) || null;
  }

  async getFilteredAddOnsFromCache(filters: AddOnFilters): Promise<AddOn[]> {
    const cachedAddOns = await this.getCachedAddOns();
    console.log('[AddOnCacheService] getFilteredAddOnsFromCache called with filters:', filters);
    console.log('[AddOnCacheService] cachedAddOns count:', cachedAddOns?.length || 0);
    
    if (!cachedAddOns) return [];

    const filtered = cachedAddOns.filter(addOn => {
      if (filters.location_id && addOn.location_id !== filters.location_id) {
        return false;
      }

      if (filters.is_active !== undefined && addOn.is_active !== filters.is_active) {
        return false;
      }

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

  async clearCache(): Promise<void> {
    if (!this.isCacheAvailable()) return;

    try {
      const deleted = await caches.delete(CACHE_NAME);
      if (deleted) {
        console.log('[AddOnCacheService] Cache cleared successfully');
      }
      
      warmupCompleted = false;

      window.dispatchEvent(new CustomEvent('addons-cache-updated', {
        detail: { source: 'clear' }
      }));
    } catch (error) {
      console.error('[AddOnCacheService] Error clearing cache:', error);
    }
  }

  async warmupCache(filters?: AddOnFilters): Promise<void> {
    if (warmupCompleted) {
      console.log('[AddOnCacheService] Warmup already completed this session');
      return;
    }
    
    const cachedAddOns = await this.getCachedAddOns();
    
    if (!cachedAddOns || cachedAddOns.length === 0) {
      console.log('[AddOnCacheService] Warming up cache...');
      await this.syncFromAPI(filters);
      console.log('[AddOnCacheService] Cache warmup complete');
    } else {
      console.log('[AddOnCacheService] Cache already has data, skipping warmup');
    }
    
    warmupCompleted = true;
  }

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

  async getAddOns(filters?: AddOnFilters): Promise<AddOn[]> {
    return this.fetchAndCacheAddOns(filters);
  }

  async forceRefresh(filters?: AddOnFilters): Promise<AddOn[]> {
    return this.fetchAndCacheAddOns(filters, true);
  }

  onCacheUpdate(callback: (event: CustomEvent) => void): () => void {
    const handler = (e: Event) => callback(e as CustomEvent);
    window.addEventListener('addons-cache-updated', handler);
    return () => window.removeEventListener('addons-cache-updated', handler);
  }
}

export const addOnCacheService = AddOnCacheService.getInstance();
export default addOnCacheService;
