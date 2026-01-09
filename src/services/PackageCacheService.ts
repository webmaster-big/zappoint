/**
 * PackageCacheService
 * 
 * A service that uses the Cache Storage API to cache package data for faster
 * access across booking, schedule, and management components.
 * 
 * Features:
 * - Store packages in Cache Storage (not localStorage/sessionStorage)
 * - Provide cached data as primary source for rendering
 * - Update cache when packages are created/updated/deleted
 * - Background sync on component navigation
 * - Clear cache on logout
 */

import packageService, { type Package, type PackageFilters, type PaginatedResponse } from './PackageService';

const CACHE_NAME = 'zapzone-packages-cache-v1';
const PACKAGES_CACHE_KEY = '/api/packages/cached';
const CACHE_METADATA_KEY = '/api/packages/metadata';

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
interface PackagesCacheEntry {
  packages: Package[];
  pagination?: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
  filters?: PackageFilters;
}

class PackageCacheService {
  private static instance: PackageCacheService;
  private isSyncing: boolean = false;
  private syncPromise: Promise<Package[]> | null = null;

  private constructor() {}

  static getInstance(): PackageCacheService {
    if (!PackageCacheService.instance) {
      PackageCacheService.instance = new PackageCacheService();
    }
    return PackageCacheService.instance;
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
      console.warn('[PackageCacheService] Cache Storage not available');
      return null;
    }
    return await caches.open(CACHE_NAME);
  }

  /**
   * Store packages in cache
   */
  async cachePackages(packages: Package[], metadata?: Partial<CacheMetadata>): Promise<void> {
    const cache = await this.getCache();
    if (!cache) return;

    try {
      const cacheEntry: PackagesCacheEntry = {
        packages,
      };

      // Create a Response object to store in cache
      const response = new Response(JSON.stringify(cacheEntry), {
        headers: {
          'Content-Type': 'application/json',
          'X-Cache-Date': new Date().toISOString(),
        },
      });

      await cache.put(PACKAGES_CACHE_KEY, response);

      // Store metadata
      const fullMetadata: CacheMetadata = {
        lastUpdated: Date.now(),
        totalRecords: packages.length,
        ...metadata,
      };

      const metadataResponse = new Response(JSON.stringify(fullMetadata), {
        headers: { 'Content-Type': 'application/json' },
      });

      await cache.put(CACHE_METADATA_KEY, metadataResponse);

      console.log(`[PackageCacheService] Cached ${packages.length} packages`);
    } catch (error) {
      console.error('[PackageCacheService] Error caching packages:', error);
    }
  }

  /**
   * Get packages from cache
   */
  async getCachedPackages(): Promise<Package[] | null> {
    const cache = await this.getCache();
    if (!cache) return null;

    try {
      const response = await cache.match(PACKAGES_CACHE_KEY);
      if (!response) return null;

      const data: PackagesCacheEntry = await response.json();
      console.log(`[PackageCacheService] Retrieved ${data.packages.length} packages from cache`);
      return data.packages;
    } catch (error) {
      console.error('[PackageCacheService] Error reading cached packages:', error);
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
      console.error('[PackageCacheService] Error reading cache metadata:', error);
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
   * Fetch packages from API and update cache
   * Returns cached data immediately if available, then syncs in background
   */
  async fetchAndCachePackages(
    filters?: PackageFilters,
    forceRefresh: boolean = false
  ): Promise<Package[]> {
    // If we have cached data and not forcing refresh, return it immediately
    if (!forceRefresh) {
      const cachedPackages = await this.getCachedPackages();
      if (cachedPackages && cachedPackages.length > 0) {
        return cachedPackages;
      }
    }

    // No cache or force refresh - fetch from API
    return this.syncFromAPI(filters);
  }

  /**
   * Sync packages from API
   */
  private async syncFromAPI(filters?: PackageFilters): Promise<Package[]> {
    this.isSyncing = true;

    this.syncPromise = (async () => {
      try {
        // Fetch all packages with high per_page to get most data
        const response: PaginatedResponse<Package> = await packageService.getPackages({
          ...filters,
          per_page: 1000, // Get a large batch
        });

        const packages = response.data.packages || [];

        // Cache the packages
        await this.cachePackages(packages, {
          locationId: filters?.location_id,
          userId: filters?.user_id,
        });

        // Dispatch event to notify components
        window.dispatchEvent(new CustomEvent('packages-cache-updated', {
          detail: { packages, source: 'api' }
        }));

        return packages;
      } catch (error) {
        console.error('[PackageCacheService] Error fetching packages:', error);
        // Return cached data as fallback
        const cached = await this.getCachedPackages();
        return cached || [];
      } finally {
        this.isSyncing = false;
        this.syncPromise = null;
      }
    })();

    return this.syncPromise;
  }

  /**
   * Sync packages in background without blocking
   */
  syncInBackground(filters?: PackageFilters): void {
    if (this.isSyncing) return;

    // Use setTimeout to ensure it runs in background
    setTimeout(async () => {
      try {
        await this.syncFromAPI(filters);
        console.log('[PackageCacheService] Background sync completed');
      } catch (error) {
        console.error('[PackageCacheService] Background sync failed:', error);
      }
    }, 0);
  }

  /**
   * Update a single package in cache
   */
  async updatePackageInCache(updatedPackage: Package): Promise<void> {
    const cachedPackages = await this.getCachedPackages();
    if (!cachedPackages) return;

    const index = cachedPackages.findIndex(p => p.id === updatedPackage.id);
    if (index >= 0) {
      cachedPackages[index] = updatedPackage;
    } else {
      // Package not in cache, add it
      cachedPackages.push(updatedPackage);
    }

    await this.cachePackages(cachedPackages);

    // Dispatch event
    window.dispatchEvent(new CustomEvent('packages-cache-updated', {
      detail: { packageId: updatedPackage.id, source: 'update' }
    }));
  }

  /**
   * Add a new package to cache
   */
  async addPackageToCache(newPackage: Package): Promise<void> {
    const cachedPackages = await this.getCachedPackages();
    const packages = cachedPackages || [];
    
    // Check if already exists
    const exists = packages.some(p => p.id === newPackage.id);
    if (!exists) {
      packages.push(newPackage);
      await this.cachePackages(packages);
    }

    // Dispatch event
    window.dispatchEvent(new CustomEvent('packages-cache-updated', {
      detail: { packageId: newPackage.id, source: 'add' }
    }));
  }

  /**
   * Remove a package from cache
   */
  async removePackageFromCache(packageId: number): Promise<void> {
    const cachedPackages = await this.getCachedPackages();
    if (!cachedPackages) return;

    const filteredPackages = cachedPackages.filter(p => p.id !== packageId);
    await this.cachePackages(filteredPackages);

    // Dispatch event
    window.dispatchEvent(new CustomEvent('packages-cache-updated', {
      detail: { packageId, source: 'delete' }
    }));
  }

  /**
   * Get a single package from cache by ID
   */
  async getPackageFromCache(packageId: number): Promise<Package | null> {
    const cachedPackages = await this.getCachedPackages();
    if (!cachedPackages) return null;

    return cachedPackages.find(p => p.id === packageId) || null;
  }

  /**
   * Get packages from cache filtered by criteria
   */
  async getFilteredPackagesFromCache(filters: PackageFilters): Promise<Package[]> {
    const cachedPackages = await this.getCachedPackages();
    console.log('[PackageCacheService] getFilteredPackagesFromCache called with filters:', filters);
    console.log('[PackageCacheService] cachedPackages count:', cachedPackages?.length || 0);
    
    if (!cachedPackages) return [];

    const filtered = cachedPackages.filter(pkg => {
      // Filter by location
      if (filters.location_id && pkg.location_id !== filters.location_id) {
        return false;
      }

      // Filter by category
      if (filters.category && pkg.category !== filters.category) {
        return false;
      }

      // Filter by package_type
      if (filters.package_type && pkg.package_type !== filters.package_type) {
        return false;
      }

      // Filter by is_active
      if (filters.is_active !== undefined && pkg.is_active !== filters.is_active) {
        return false;
      }

      // Filter by search query
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const name = pkg.name?.toLowerCase() || '';
        const description = pkg.description?.toLowerCase() || '';
        const category = pkg.category?.toLowerCase() || '';
        
        if (!name.includes(searchLower) && 
            !description.includes(searchLower) && 
            !category.includes(searchLower)) {
          return false;
        }
      }

      return true;
    });

    console.log('[PackageCacheService] Filtered packages count:', filtered.length);
    return filtered;
  }

  /**
   * Clear all package cache data
   * Call this on user logout
   */
  async clearCache(): Promise<void> {
    if (!this.isCacheAvailable()) return;

    try {
      const deleted = await caches.delete(CACHE_NAME);
      if (deleted) {
        console.log('[PackageCacheService] Cache cleared successfully');
      }
      
      // Reset warmup flag so next session will warmup again
      warmupCompleted = false;

      // Dispatch event
      window.dispatchEvent(new CustomEvent('packages-cache-updated', {
        detail: { source: 'clear' }
      }));
    } catch (error) {
      console.error('[PackageCacheService] Error clearing cache:', error);
    }
  }

  /**
   * Warmup the cache - call this on app initialization or login
   * This pre-populates the cache so subsequent page loads are instant
   * Only fetches if cache is truly empty (not just stale)
   */
  async warmupCache(filters?: PackageFilters): Promise<void> {
    // Skip if warmup already happened this session
    if (warmupCompleted) {
      console.log('[PackageCacheService] Warmup already completed this session');
      return;
    }
    
    const cachedPackages = await this.getCachedPackages();
    
    // Only warmup if cache is empty (stale cache is still usable)
    if (!cachedPackages || cachedPackages.length === 0) {
      console.log('[PackageCacheService] Warming up cache...');
      await this.syncFromAPI(filters);
      console.log('[PackageCacheService] Cache warmup complete');
    } else {
      console.log('[PackageCacheService] Cache already has data, skipping warmup');
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
      const response = await cache.match(PACKAGES_CACHE_KEY);
      return response !== undefined;
    } catch {
      return false;
    }
  }

  /**
   * Get packages with automatic cache management
   * - Returns cached data if available and fresh
   * - Syncs in background if cache is stale
   * - Fetches from API if no cache exists
   */
  async getPackages(filters?: PackageFilters): Promise<Package[]> {
    return this.fetchAndCachePackages(filters);
  }

  /**
   * Force refresh packages from API
   */
  async forceRefresh(filters?: PackageFilters): Promise<Package[]> {
    return this.fetchAndCachePackages(filters, true);
  }

  /**
   * Subscribe to cache updates
   */
  onCacheUpdate(callback: (event: CustomEvent) => void): () => void {
    const handler = (e: Event) => callback(e as CustomEvent);
    window.addEventListener('packages-cache-updated', handler);
    return () => window.removeEventListener('packages-cache-updated', handler);
  }
}

// Export singleton instance
export const packageCacheService = PackageCacheService.getInstance();
export default packageCacheService;
