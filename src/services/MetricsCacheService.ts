
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
}

export interface ManagerMetrics extends AttendantMetrics {
}

export interface CachedMetricsData<T> {
  metrics: T;
  recentBookings?: any[];
  recentPurchases?: any[];
  recentEventPurchases?: any[];
  locationStats?: any;
  timestamp: number;
}

type DashboardType = 'attendant' | 'company' | 'manager';

class MetricsCacheService {
  private memoryCache: Map<string, CachedMetricsData<any>> = new Map();

  private getCacheKey(dashboardType: DashboardType, locationId?: number | 'all', timeframe?: string): string {
    return `metrics_${dashboardType}_${locationId || 'all'}_${timeframe || 'last_30d'}`;
  }

  private isCacheValid(timestamp: number): boolean {
    return Date.now() - timestamp < CACHE_EXPIRY_MS;
  }

  async getCachedMetrics<T>(
    dashboardType: DashboardType,
    locationId?: number | 'all',
    timeframe?: string
  ): Promise<CachedMetricsData<T> | null> {
    const cacheKey = this.getCacheKey(dashboardType, locationId, timeframe);

    const memoryData = this.memoryCache.get(cacheKey);
    if (memoryData && this.isCacheValid(memoryData.timestamp)) {
      console.log(`[MetricsCache] Memory hit for ${cacheKey}`);
      return memoryData as CachedMetricsData<T>;
    }

    try {
      if ('caches' in window) {
        const cache = await caches.open(CACHE_NAME);
        const response = await cache.match(cacheKey);
        
        if (response) {
          const data = await response.json() as CachedMetricsData<T>;
          
          if (this.isCacheValid(data.timestamp)) {
            console.log(`[MetricsCache] Cache API hit for ${cacheKey}`);
            this.memoryCache.set(cacheKey, data);
            return data;
          } else {
            console.log(`[MetricsCache] Cache expired for ${cacheKey}`);
            await cache.delete(cacheKey);
          }
        }
      }
    } catch (error) {
      console.error('[MetricsCache] Error reading from cache:', error);
    }

    return null;
  }

  async cacheMetrics<T>(
    dashboardType: DashboardType,
    data: Omit<CachedMetricsData<T>, 'timestamp'>,
    locationId?: number | 'all',
    timeframe?: string
  ): Promise<void> {
    const cacheKey = this.getCacheKey(dashboardType, locationId, timeframe);
    const cachedData: CachedMetricsData<T> = {
      ...data,
      timestamp: Date.now(),
    };

    this.memoryCache.set(cacheKey, cachedData);
    console.log(`[MetricsCache] Memory cached ${cacheKey}`);

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

  async hasCachedData(
    dashboardType: DashboardType,
    locationId?: number | 'all',
    timeframe?: string
  ): Promise<boolean> {
    const cacheKey = this.getCacheKey(dashboardType, locationId, timeframe);

    if (this.memoryCache.has(cacheKey)) {
      return true;
    }

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

  async invalidateCache(
    dashboardType: DashboardType,
    locationId?: number | 'all',
    timeframe?: string
  ): Promise<void> {
    const cacheKey = this.getCacheKey(dashboardType, locationId, timeframe);

    this.memoryCache.delete(cacheKey);

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

export const metricsCacheService = new MetricsCacheService();
export default metricsCacheService;
