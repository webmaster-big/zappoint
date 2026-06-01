
import { attractionService, type Attraction, type AttractionFilters } from './AttractionService';

const CACHE_NAME = 'zapzone-attractions-cache-v1';
const ATTRACTIONS_CACHE_KEY = '/api/attractions/cached';
const CACHE_METADATA_KEY = '/api/attractions/metadata';

let warmupCompleted = false;

interface CacheMetadata {
  lastUpdated: number;
  locationId?: number;
  userId?: number;
  totalRecords: number;
}

interface AttractionsCacheEntry {
  attractions: Attraction[];
  pagination?: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
  filters?: AttractionFilters;
}

class AttractionCacheService {
  private static instance: AttractionCacheService;
  private isSyncing: boolean = false;
  private syncPromise: Promise<Attraction[]> | null = null;

  private constructor() {}

  static getInstance(): AttractionCacheService {
    if (!AttractionCacheService.instance) {
      AttractionCacheService.instance = new AttractionCacheService();
    }
    return AttractionCacheService.instance;
  }

  private isCacheAvailable(): boolean {
    return 'caches' in window;
  }

  private async getCache(): Promise<Cache | null> {
    if (!this.isCacheAvailable()) {
      console.warn('[AttractionCacheService] Cache Storage not available');
      return null;
    }
    return await caches.open(CACHE_NAME);
  }

  async cacheAttractions(attractions: Attraction[], metadata?: Partial<CacheMetadata>): Promise<void> {
    const cache = await this.getCache();
    if (!cache) return;

    try {
      const cacheEntry: AttractionsCacheEntry = {
        attractions,
      };

      const response = new Response(JSON.stringify(cacheEntry), {
        headers: {
          'Content-Type': 'application/json',
          'X-Cache-Date': new Date().toISOString(),
        },
      });

      await cache.put(ATTRACTIONS_CACHE_KEY, response);

      const fullMetadata: CacheMetadata = {
        lastUpdated: Date.now(),
        totalRecords: attractions.length,
        ...metadata,
      };

      const metadataResponse = new Response(JSON.stringify(fullMetadata), {
        headers: { 'Content-Type': 'application/json' },
      });

      await cache.put(CACHE_METADATA_KEY, metadataResponse);

      console.log(`[AttractionCacheService] Cached ${attractions.length} attractions`);
    } catch (error) {
      console.error('[AttractionCacheService] Error caching attractions:', error);
    }
  }

  async getCachedAttractions(): Promise<Attraction[] | null> {
    const cache = await this.getCache();
    if (!cache) return null;

    try {
      const response = await cache.match(ATTRACTIONS_CACHE_KEY);
      if (!response) return null;

      const data: AttractionsCacheEntry = await response.json();
      console.log(`[AttractionCacheService] Retrieved ${data.attractions.length} attractions from cache`);
      return data.attractions;
    } catch (error) {
      console.error('[AttractionCacheService] Error reading cached attractions:', error);
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
      console.error('[AttractionCacheService] Error reading cache metadata:', error);
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

  async fetchAndCacheAttractions(
    filters?: AttractionFilters,
    forceRefresh: boolean = false
  ): Promise<Attraction[]> {
    if (this.isSyncing && this.syncPromise) {
      return this.syncPromise;
    }

    if (!forceRefresh) {
      const cachedAttractions = await this.getCachedAttractions();
      const isStale = await this.isCacheStale();

      if (cachedAttractions && cachedAttractions.length > 0) {
        if (isStale) {
          this.syncInBackground(filters);
        }
        return cachedAttractions;
      }
    }

    return this.syncFromAPI(filters);
  }

  private async syncFromAPI(filters?: AttractionFilters): Promise<Attraction[]> {
    this.isSyncing = true;

    this.syncPromise = (async () => {
      try {
        const response = await attractionService.getAttractions({
          ...filters,
          per_page: 1000, // Get a large batch
        });

        const attractions = response.data.attractions || [];

        await this.cacheAttractions(attractions, {
          locationId: filters?.location_id,
          userId: filters?.user_id,
        });

        window.dispatchEvent(new CustomEvent('attractions-cache-updated', {
          detail: { attractions, source: 'api' }
        }));

        return attractions;
      } catch (error) {
        console.error('[AttractionCacheService] Error fetching attractions:', error);
        const cached = await this.getCachedAttractions();
        return cached || [];
      } finally {
        this.isSyncing = false;
        this.syncPromise = null;
      }
    })();

    return this.syncPromise;
  }

  syncInBackground(filters?: AttractionFilters): void {
    if (this.isSyncing) return;

    setTimeout(async () => {
      try {
        await this.syncFromAPI(filters);
        console.log('[AttractionCacheService] Background sync completed');
      } catch (error) {
        console.error('[AttractionCacheService] Background sync failed:', error);
      }
    }, 0);
  }

  async updateAttractionInCache(updatedAttraction: Attraction): Promise<void> {
    const cachedAttractions = await this.getCachedAttractions();
    if (!cachedAttractions) return;

    const index = cachedAttractions.findIndex(a => a.id === updatedAttraction.id);
    if (index >= 0) {
      cachedAttractions[index] = updatedAttraction;
    } else {
      cachedAttractions.push(updatedAttraction);
    }

    await this.cacheAttractions(cachedAttractions);

    window.dispatchEvent(new CustomEvent('attractions-cache-updated', {
      detail: { attractionId: updatedAttraction.id, source: 'update' }
    }));
  }

  async addAttractionToCache(newAttraction: Attraction): Promise<void> {
    const cachedAttractions = await this.getCachedAttractions();
    const attractions = cachedAttractions || [];
    
    const exists = attractions.some(a => a.id === newAttraction.id);
    if (!exists) {
      attractions.push(newAttraction);
      await this.cacheAttractions(attractions);
    }

    window.dispatchEvent(new CustomEvent('attractions-cache-updated', {
      detail: { attractionId: newAttraction.id, source: 'add' }
    }));
  }

  async removeAttractionFromCache(attractionId: number): Promise<void> {
    const cachedAttractions = await this.getCachedAttractions();
    if (!cachedAttractions) return;

    const filteredAttractions = cachedAttractions.filter(a => a.id !== attractionId);
    await this.cacheAttractions(filteredAttractions);

    window.dispatchEvent(new CustomEvent('attractions-cache-updated', {
      detail: { attractionId, source: 'delete' }
    }));
  }

  async getAttractionFromCache(attractionId: number): Promise<Attraction | null> {
    const cachedAttractions = await this.getCachedAttractions();
    if (!cachedAttractions) return null;

    return cachedAttractions.find(a => a.id === attractionId) || null;
  }

  async getFilteredAttractionsFromCache(filters: AttractionFilters): Promise<Attraction[]> {
    const cachedAttractions = await this.getCachedAttractions();
    console.log('[AttractionCacheService] getFilteredAttractionsFromCache called with filters:', filters);
    console.log('[AttractionCacheService] cachedAttractions count:', cachedAttractions?.length || 0);
    
    if (!cachedAttractions) return [];

    const filtered = cachedAttractions.filter(attraction => {
      if (filters.location_id && attraction.location_id !== filters.location_id) {
        return false;
      }

      if (filters.category && attraction.category !== filters.category) {
        return false;
      }

      if (filters.is_active !== undefined && attraction.is_active !== filters.is_active) {
        return false;
      }

      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const name = attraction.name?.toLowerCase() || '';
        const description = attraction.description?.toLowerCase() || '';
        const category = attraction.category?.toLowerCase() || '';
        
        if (!name.includes(searchLower) && 
            !description.includes(searchLower) && 
            !category.includes(searchLower)) {
          return false;
        }
      }

      return true;
    });

    console.log('[AttractionCacheService] Filtered attractions count:', filtered.length);
    return filtered;
  }

  async clearCache(): Promise<void> {
    if (!this.isCacheAvailable()) return;

    try {
      const deleted = await caches.delete(CACHE_NAME);
      if (deleted) {
        console.log('[AttractionCacheService] Cache cleared successfully');
      }
      
      warmupCompleted = false;

      window.dispatchEvent(new CustomEvent('attractions-cache-updated', {
        detail: { source: 'clear' }
      }));
    } catch (error) {
      console.error('[AttractionCacheService] Error clearing cache:', error);
    }
  }

  async warmupCache(filters?: AttractionFilters): Promise<void> {
    if (warmupCompleted) {
      console.log('[AttractionCacheService] Warmup already completed this session');
      return;
    }
    
    const cachedAttractions = await this.getCachedAttractions();
    
    if (!cachedAttractions || cachedAttractions.length === 0) {
      console.log('[AttractionCacheService] Warming up cache...');
      await this.syncFromAPI(filters);
      console.log('[AttractionCacheService] Cache warmup complete');
    } else {
      console.log('[AttractionCacheService] Cache already has data, skipping warmup');
    }
    
    warmupCompleted = true;
  }

  async hasCachedData(): Promise<boolean> {
    const cache = await this.getCache();
    if (!cache) return false;
    
    try {
      const response = await cache.match(ATTRACTIONS_CACHE_KEY);
      return response !== undefined;
    } catch {
      return false;
    }
  }

  async getAttractions(filters?: AttractionFilters): Promise<Attraction[]> {
    return this.fetchAndCacheAttractions(filters);
  }

  async forceRefresh(filters?: AttractionFilters): Promise<Attraction[]> {
    return this.fetchAndCacheAttractions(filters, true);
  }

  onCacheUpdate(callback: (event: CustomEvent) => void): () => void {
    const handler = (e: Event) => callback(e as CustomEvent);
    window.addEventListener('attractions-cache-updated', handler);
    return () => window.removeEventListener('attractions-cache-updated', handler);
  }
}

export const attractionCacheService = AttractionCacheService.getInstance();
export default attractionCacheService;
