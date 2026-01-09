/**
 * MetricsCacheService - Cache service for dashboard metrics
 * 
 * Features:
 * - Cache-first loading for instant display
 * - Background refresh with smooth UI updates
 * - Separate caches for different dashboard types
 * - Automatic cache expiration
 */

const CACHE_NAME = 'metrics-cache-v1';
const CACHE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

export interface AttendantMetrics {
  totalBookings: number;
  totalRevenue: number;
  totalCustomers: number;
  confirmedBookings: number;
  pendingBookings: number;
  completedBookings: number;
  cancelledBookings: number;
  totalParticipants: number;
  bookingRevenue: number;
  purchaseRevenue: number;
  totalPurchases: number;
}

export interface CompanyMetrics extends AttendantMetrics {
  // Additional company-specific metrics can be added here
}

export interface ManagerMetrics extends AttendantMetrics {
  // Additional manager-specific metrics can be added here
}

export interface CachedMetricsData<T> {
  metrics: T;
  recentBookings?: any[];
  recentPurchases?: any[];
  locationStats?: any;
  timestamp: number;
}

type DashboardType = 'attendant' | 'company' | 'manager';

class MetricsCacheService {
  private memoryCache: Map<string, CachedMetricsData<any>> = new Map();

  /**
   * Generate cache key based on dashboard type and optional location
   */
  private getCacheKey(dashboardType: DashboardType, locationId?: number | 'all'): string {
    return `metrics_${dashboardType}_${locationId || 'all'}`;
  }

  /**
   * Check if cache is still valid (not expired)
   */
  private isCacheValid(timestamp: number): boolean {
    return Date.now() - timestamp < CACHE_EXPIRY_MS;
  }

  /**
   * Get cached metrics from memory or Cache API
   */
  async getCachedMetrics<T>(
    dashboardType: DashboardType,
    locationId?: number | 'all'
  ): Promise<CachedMetricsData<T> | null> {
    const cacheKey = this.getCacheKey(dashboardType, locationId);

    // Check memory cache first (fastest)
    const memoryData = this.memoryCache.get(cacheKey);
    if (memoryData && this.isCacheValid(memoryData.timestamp)) {
      console.log(`[MetricsCache] Memory hit for ${cacheKey}`);
      return memoryData as CachedMetricsData<T>;
    }

    // Fall back to Cache API
    try {
      if ('caches' in window) {
        const cache = await caches.open(CACHE_NAME);
        const response = await cache.match(cacheKey);
        
        if (response) {
          const data = await response.json() as CachedMetricsData<T>;
          
          if (this.isCacheValid(data.timestamp)) {
            console.log(`[MetricsCache] Cache API hit for ${cacheKey}`);
            // Store in memory for faster subsequent access
            this.memoryCache.set(cacheKey, data);
            return data;
          } else {
            console.log(`[MetricsCache] Cache expired for ${cacheKey}`);
            // Cache is expired, delete it
            await cache.delete(cacheKey);
          }
        }
      }
    } catch (error) {
      console.error('[MetricsCache] Error reading from cache:', error);
    }

    return null;
  }

  /**
   * Cache metrics data
   */
  async cacheMetrics<T>(
    dashboardType: DashboardType,
    data: Omit<CachedMetricsData<T>, 'timestamp'>,
    locationId?: number | 'all'
  ): Promise<void> {
    const cacheKey = this.getCacheKey(dashboardType, locationId);
    const cachedData: CachedMetricsData<T> = {
      ...data,
      timestamp: Date.now(),
    };

    // Always update memory cache
    this.memoryCache.set(cacheKey, cachedData);
    console.log(`[MetricsCache] Memory cached ${cacheKey}`);

    // Also persist to Cache API
    try {
      if ('caches' in window) {
        const cache = await caches.open(CACHE_NAME);
        const response = new Response(JSON.stringify(cachedData), {
          headers: { 'Content-Type': 'application/json' },
        });
        await cache.put(cacheKey, response);
        console.log(`[MetricsCache] Cache API persisted ${cacheKey}`);
      }
    } catch (error) {
      console.error('[MetricsCache] Error writing to cache:', error);
    }
  }

  /**
   * Check if we have any cached data (even if expired)
   */
  async hasCachedData(
    dashboardType: DashboardType,
    locationId?: number | 'all'
  ): Promise<boolean> {
    const cacheKey = this.getCacheKey(dashboardType, locationId);

    // Check memory first
    if (this.memoryCache.has(cacheKey)) {
      return true;
    }

    // Check Cache API
    try {
      if ('caches' in window) {
        const cache = await caches.open(CACHE_NAME);
        const response = await cache.match(cacheKey);
        return !!response;
      }
    } catch (error) {
      console.error('[MetricsCache] Error checking cache:', error);
    }

    return false;
  }

  /**
   * Invalidate cache for a specific dashboard/location
   */
  async invalidateCache(
    dashboardType: DashboardType,
    locationId?: number | 'all'
  ): Promise<void> {
    const cacheKey = this.getCacheKey(dashboardType, locationId);

    // Clear memory cache
    this.memoryCache.delete(cacheKey);

    // Clear Cache API
    try {
      if ('caches' in window) {
        const cache = await caches.open(CACHE_NAME);
        await cache.delete(cacheKey);
        console.log(`[MetricsCache] Invalidated ${cacheKey}`);
      }
    } catch (error) {
      console.error('[MetricsCache] Error invalidating cache:', error);
    }
  }

  /**
   * Clear all metrics caches
   */
  async clearAllCaches(): Promise<void> {
    this.memoryCache.clear();

    try {
      if ('caches' in window) {
        await caches.delete(CACHE_NAME);
        console.log('[MetricsCache] All caches cleared');
      }
    } catch (error) {
      console.error('[MetricsCache] Error clearing caches:', error);
    }
  }

  /**
   * Get default/empty metrics object
   */
  getDefaultMetrics(): AttendantMetrics {
    return {
      totalBookings: 0,
      totalRevenue: 0,
      totalCustomers: 0,
      confirmedBookings: 0,
      pendingBookings: 0,
      completedBookings: 0,
      cancelledBookings: 0,
      totalParticipants: 0,
      bookingRevenue: 0,
      purchaseRevenue: 0,
      totalPurchases: 0,
    };
  }
}

// Export singleton instance
export const metricsCacheService = new MetricsCacheService();
export default metricsCacheService;
