
import packageService, { type Package, type PackageFilters, type PaginatedResponse } from './PackageService';

const CACHE_NAME = 'zapzone-packages-cache-v1';
const PACKAGES_CACHE_KEY = '/api/packages/cached';
const CACHE_METADATA_KEY = '/api/packages/metadata';

let warmupCompleted = false;

interface CacheMetadata {
  lastUpdated: number;
  locationId?: number;
  userId?: number;
  totalRecords: number;
}

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

  private isCacheAvailable(): boolean {
    return 'caches' in window;
  }

  private async getCache(): Promise<Cache | null> {
    if (!this.isCacheAvailable()) {
      console.warn('[PackageCacheService] Cache Storage not available');
      return null;
    }
    return await caches.open(CACHE_NAME);
  }

  async cachePackages(packages: Package[], metadata?: Partial<CacheMetadata>): Promise<void> {
    const cache = await this.getCache();
    if (!cache) return;

    try {
      const cacheEntry: PackagesCacheEntry = {
        packages,
      };

      const response = new Response(JSON.stringify(cacheEntry), {
        headers: {
          'Content-Type': 'application/json',
          'X-Cache-Date': new Date().toISOString(),
        },
      });

      await cache.put(PACKAGES_CACHE_KEY, response);

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

  async isCacheStale(maxAgeMinutes: number = 5): Promise<boolean> {
    const metadata = await this.getCacheMetadata();
    if (!metadata) return true;

    const ageMs = Date.now() - metadata.lastUpdated;
    const maxAgeMs = maxAgeMinutes * 60 * 1000;

    return ageMs > maxAgeMs;
  }

  async fetchAndCachePackages(
    filters?: PackageFilters,
    forceRefresh: boolean = false
  ): Promise<Package[]> {
    if (this.isSyncing && this.syncPromise) {
      return this.syncPromise;
    }

    if (!forceRefresh) {
      const cachedPackages = await this.getCachedPackages();
      const isStale = await this.isCacheStale();

      if (cachedPackages && cachedPackages.length > 0) {
        if (isStale) {
          this.syncInBackground(filters);
        }
        return cachedPackages;
      }
    }

    return this.syncFromAPI(filters);
  }

  private async syncFromAPI(filters?: PackageFilters): Promise<Package[]> {
    this.isSyncing = true;

    this.syncPromise = (async () => {
      try {
        const response: PaginatedResponse<Package> = await packageService.getPackages({
          ...filters,
          per_page: 1000, // Get a large batch
        });

        const packages = response.data.packages || [];

        await this.cachePackages(packages, {
          locationId: filters?.location_id,
          userId: filters?.user_id,
        });

        window.dispatchEvent(new CustomEvent('packages-cache-updated', {
          detail: { packages, source: 'api' }
        }));

        return packages;
      } catch (error) {
        console.error('[PackageCacheService] Error fetching packages:', error);
        const cached = await this.getCachedPackages();
        return cached || [];
      } finally {
        this.isSyncing = false;
        this.syncPromise = null;
      }
    })();

    return this.syncPromise;
  }

  syncInBackground(filters?: PackageFilters): void {
    if (this.isSyncing) return;

    setTimeout(async () => {
      try {
        await this.syncFromAPI(filters);
        console.log('[PackageCacheService] Background sync completed');
      } catch (error) {
        console.error('[PackageCacheService] Background sync failed:', error);
      }
    }, 0);
  }

  async updatePackageInCache(updatedPackage: Package): Promise<void> {
    const cachedPackages = await this.getCachedPackages();
    if (!cachedPackages) return;

    const index = cachedPackages.findIndex(p => p.id === updatedPackage.id);
    if (index >= 0) {
      cachedPackages[index] = updatedPackage;
    } else {
      cachedPackages.push(updatedPackage);
    }

    await this.cachePackages(cachedPackages);

    window.dispatchEvent(new CustomEvent('packages-cache-updated', {
      detail: { packageId: updatedPackage.id, source: 'update' }
    }));
  }

  async addPackageToCache(newPackage: Package): Promise<void> {
    const cachedPackages = await this.getCachedPackages();
    const packages = cachedPackages || [];
    
    const exists = packages.some(p => p.id === newPackage.id);
    if (!exists) {
      packages.push(newPackage);
      await this.cachePackages(packages);
    }

    window.dispatchEvent(new CustomEvent('packages-cache-updated', {
      detail: { packageId: newPackage.id, source: 'add' }
    }));
  }

  async removePackageFromCache(packageId: number): Promise<void> {
    const cachedPackages = await this.getCachedPackages();
    if (!cachedPackages) return;

    const filteredPackages = cachedPackages.filter(p => p.id !== packageId);
    await this.cachePackages(filteredPackages);

    window.dispatchEvent(new CustomEvent('packages-cache-updated', {
      detail: { packageId, source: 'delete' }
    }));
  }

  async getPackageFromCache(packageId: number): Promise<Package | null> {
    const cachedPackages = await this.getCachedPackages();
    if (!cachedPackages) return null;

    return cachedPackages.find(p => p.id === packageId) || null;
  }

  async getFilteredPackagesFromCache(filters: PackageFilters): Promise<Package[]> {
    const cachedPackages = await this.getCachedPackages();
    console.log('[PackageCacheService] getFilteredPackagesFromCache called with filters:', filters);
    console.log('[PackageCacheService] cachedPackages count:', cachedPackages?.length || 0);
    
    if (!cachedPackages) return [];

    const filtered = cachedPackages.filter(pkg => {
      if (filters.location_id && pkg.location_id !== filters.location_id) {
        return false;
      }

      if (filters.category && pkg.category !== filters.category) {
        return false;
      }

      if (filters.package_type && pkg.package_type !== filters.package_type) {
        return false;
      }

      if (filters.is_active !== undefined && pkg.is_active !== filters.is_active) {
        return false;
      }

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

  async clearCache(): Promise<void> {
    if (!this.isCacheAvailable()) return;

    try {
      const deleted = await caches.delete(CACHE_NAME);
      if (deleted) {
        console.log('[PackageCacheService] Cache cleared successfully');
      }
      
      warmupCompleted = false;

      window.dispatchEvent(new CustomEvent('packages-cache-updated', {
        detail: { source: 'clear' }
      }));
    } catch (error) {
      console.error('[PackageCacheService] Error clearing cache:', error);
    }
  }

  async warmupCache(filters?: PackageFilters): Promise<void> {
    if (warmupCompleted) {
      console.log('[PackageCacheService] Warmup already completed this session');
      return;
    }
    
    const cachedPackages = await this.getCachedPackages();
    
    if (!cachedPackages || cachedPackages.length === 0) {
      console.log('[PackageCacheService] Warming up cache...');
      await this.syncFromAPI(filters);
      console.log('[PackageCacheService] Cache warmup complete');
    } else {
      console.log('[PackageCacheService] Cache already has data, skipping warmup');
    }
    
    warmupCompleted = true;
  }

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

  async getPackages(filters?: PackageFilters): Promise<Package[]> {
    return this.fetchAndCachePackages(filters);
  }

  async forceRefresh(filters?: PackageFilters): Promise<Package[]> {
    return this.fetchAndCachePackages(filters, true);
  }

  onCacheUpdate(callback: (event: CustomEvent) => void): () => void {
    const handler = (e: Event) => callback(e as CustomEvent);
    window.addEventListener('packages-cache-updated', handler);
    return () => window.removeEventListener('packages-cache-updated', handler);
  }
}

export const packageCacheService = PackageCacheService.getInstance();
export default packageCacheService;
