/**
 * AttractionCacheService
 * 
 * A service that uses the Cache Storage API to cache attraction data for faster
 * access across management, check-in, and purchase components.
 * 
 * Features:
 * - Store attractions in Cache Storage (not localStorage/sessionStorage)
 * - Provide cached data as primary source for rendering
 * - Update cache when attractions are created/updated/deleted
 * - Background sync on component navigation
 * - Clear cache on logout
 */

import { attractionService, type Attraction, type AttractionFilters } from './AttractionService';

const CACHE_NAME = 'zapzone-attractions-cache-v1';
const ATTRACTIONS_CACHE_KEY = '/api/attractions/cached';
const CACHE_METADATA_KEY = '/api/attractions/metadata';

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
      console.warn('[AttractionCacheService] Cache Storage not available');
      return null;
    }
    return await caches.open(CACHE_NAME);
  }

  /**
   * Store attractions in cache
   */
  async cacheAttractions(attractions: Attraction[], metadata?: Partial<CacheMetadata>): Promise<void> {
    const cache = await this.getCache();
    if (!cache) return;

    try {
      const cacheEntry: AttractionsCacheEntry = {
        attractions,
      };

      // Create a Response object to store in cache
      const response = new Response(JSON.stringify(cacheEntry), {
        headers: {
          'Content-Type': 'application/json',
          'X-Cache-Date': new Date().toISOString(),
        },
      });

      await cache.put(ATTRACTIONS_CACHE_KEY, response);

      // Store metadata
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

  /**
   * Get attractions from cache
   */
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
      console.error('[AttractionCacheService] Error reading cache metadata:', error);
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
   * Fetch attractions from API and update cache
   * Returns cached data immediately if available, then syncs in background
   */
  async fetchAndCacheAttractions(
    filters?: AttractionFilters,
    forceRefresh: boolean = false
  ): Promise<Attraction[]> {
    // If we have cached data and not forcing refresh, return it immediately
    if (!forceRefresh) {
      const cachedAttractions = await this.getCachedAttractions();
      if (cachedAttractions && cachedAttractions.length > 0) {
        return cachedAttractions;
      }
    }

    // No cache or force refresh - fetch from API
    return this.syncFromAPI(filters);
  }

  /**
   * Sync attractions from API
   */
  private async syncFromAPI(filters?: AttractionFilters): Promise<Attraction[]> {
    this.isSyncing = true;

    this.syncPromise = (async () => {
      try {
        // Fetch all attractions with high per_page to get most data
        const response = await attractionService.getAttractions({
          ...filters,
          per_page: 1000, // Get a large batch
        });

        const attractions = response.data.attractions || [];

        // Cache the attractions
        await this.cacheAttractions(attractions, {
          locationId: filters?.location_id,
          userId: filters?.user_id,
        });

        // Dispatch event to notify components
        window.dispatchEvent(new CustomEvent('attractions-cache-updated', {
          detail: { attractions, source: 'api' }
        }));

        return attractions;
      } catch (error) {
        console.error('[AttractionCacheService] Error fetching attractions:', error);
        // Return cached data as fallback
        const cached = await this.getCachedAttractions();
        return cached || [];
      } finally {
        this.isSyncing = false;
        this.syncPromise = null;
      }
    })();

    return this.syncPromise;
  }

  /**
   * Sync attractions in background without blocking
   */
  syncInBackground(filters?: AttractionFilters): void {
    if (this.isSyncing) return;

    // Use setTimeout to ensure it runs in background
    setTimeout(async () => {
      try {
        await this.syncFromAPI(filters);
        console.log('[AttractionCacheService] Background sync completed');
      } catch (error) {
        console.error('[AttractionCacheService] Background sync failed:', error);
      }
    }, 0);
  }

  /**
   * Update a single attraction in cache
   */
  async updateAttractionInCache(updatedAttraction: Attraction): Promise<void> {
    const cachedAttractions = await this.getCachedAttractions();
    if (!cachedAttractions) return;

    const index = cachedAttractions.findIndex(a => a.id === updatedAttraction.id);
    if (index >= 0) {
      cachedAttractions[index] = updatedAttraction;
    } else {
      // Attraction not in cache, add it
      cachedAttractions.push(updatedAttraction);
    }

    await this.cacheAttractions(cachedAttractions);

    // Dispatch event
    window.dispatchEvent(new CustomEvent('attractions-cache-updated', {
      detail: { attractionId: updatedAttraction.id, source: 'update' }
    }));
  }

  /**
   * Add a new attraction to cache
   */
  async addAttractionToCache(newAttraction: Attraction): Promise<void> {
    const cachedAttractions = await this.getCachedAttractions();
    const attractions = cachedAttractions || [];
    
    // Check if already exists
    const exists = attractions.some(a => a.id === newAttraction.id);
    if (!exists) {
      attractions.push(newAttraction);
      await this.cacheAttractions(attractions);
    }

    // Dispatch event
    window.dispatchEvent(new CustomEvent('attractions-cache-updated', {
      detail: { attractionId: newAttraction.id, source: 'add' }
    }));
  }

  /**
   * Remove an attraction from cache
   */
  async removeAttractionFromCache(attractionId: number): Promise<void> {
    const cachedAttractions = await this.getCachedAttractions();
    if (!cachedAttractions) return;

    const filteredAttractions = cachedAttractions.filter(a => a.id !== attractionId);
    await this.cacheAttractions(filteredAttractions);

    // Dispatch event
    window.dispatchEvent(new CustomEvent('attractions-cache-updated', {
      detail: { attractionId, source: 'delete' }
    }));
  }

  /**
   * Get a single attraction from cache by ID
   */
  async getAttractionFromCache(attractionId: number): Promise<Attraction | null> {
    const cachedAttractions = await this.getCachedAttractions();
    if (!cachedAttractions) return null;

    return cachedAttractions.find(a => a.id === attractionId) || null;
  }

  /**
   * Get attractions from cache filtered by criteria
   */
  async getFilteredAttractionsFromCache(filters: AttractionFilters): Promise<Attraction[]> {
    const cachedAttractions = await this.getCachedAttractions();
    console.log('[AttractionCacheService] getFilteredAttractionsFromCache called with filters:', filters);
    console.log('[AttractionCacheService] cachedAttractions count:', cachedAttractions?.length || 0);
    
    if (!cachedAttractions) return [];

    const filtered = cachedAttractions.filter(attraction => {
      // Filter by location
      if (filters.location_id && attraction.location_id !== filters.location_id) {
        return false;
      }

      // Filter by category
      if (filters.category && attraction.category !== filters.category) {
        return false;
      }

      // Filter by is_active
      if (filters.is_active !== undefined && attraction.is_active !== filters.is_active) {
        return false;
      }

      // Filter by search query
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

  /**
   * Clear all attraction cache data
   * Call this on user logout
   */
  async clearCache(): Promise<void> {
    if (!this.isCacheAvailable()) return;

    try {
      const deleted = await caches.delete(CACHE_NAME);
      if (deleted) {
        console.log('[AttractionCacheService] Cache cleared successfully');
      }
      
      // Reset warmup flag so next session will warmup again
      warmupCompleted = false;

      // Dispatch event
      window.dispatchEvent(new CustomEvent('attractions-cache-updated', {
        detail: { source: 'clear' }
      }));
    } catch (error) {
      console.error('[AttractionCacheService] Error clearing cache:', error);
    }
  }

  /**
   * Warmup the cache - call this on app initialization or login
   * This pre-populates the cache so subsequent page loads are instant
   * Only fetches if cache is truly empty (not just stale)
   */
  async warmupCache(filters?: AttractionFilters): Promise<void> {
    // Skip if warmup already happened this session
    if (warmupCompleted) {
      console.log('[AttractionCacheService] Warmup already completed this session');
      return;
    }
    
    const cachedAttractions = await this.getCachedAttractions();
    
    // Only warmup if cache is empty (stale cache is still usable)
    if (!cachedAttractions || cachedAttractions.length === 0) {
      console.log('[AttractionCacheService] Warming up cache...');
      await this.syncFromAPI(filters);
      console.log('[AttractionCacheService] Cache warmup complete');
    } else {
      console.log('[AttractionCacheService] Cache already has data, skipping warmup');
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
      const response = await cache.match(ATTRACTIONS_CACHE_KEY);
      return response !== undefined;
    } catch {
      return false;
    }
  }

  /**
   * Get attractions with automatic cache management
   * - Returns cached data if available and fresh
   * - Syncs in background if cache is stale
   * - Fetches from API if no cache exists
   */
  async getAttractions(filters?: AttractionFilters): Promise<Attraction[]> {
    return this.fetchAndCacheAttractions(filters);
  }

  /**
   * Force refresh attractions from API
   */
  async forceRefresh(filters?: AttractionFilters): Promise<Attraction[]> {
    return this.fetchAndCacheAttractions(filters, true);
  }

  /**
   * Subscribe to cache updates
   */
  onCacheUpdate(callback: (event: CustomEvent) => void): () => void {
    const handler = (e: Event) => callback(e as CustomEvent);
    window.addEventListener('attractions-cache-updated', handler);
    return () => window.removeEventListener('attractions-cache-updated', handler);
  }
}

// Export singleton instance
export const attractionCacheService = AttractionCacheService.getInstance();
export default attractionCacheService;
