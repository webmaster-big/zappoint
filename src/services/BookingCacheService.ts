
import bookingService, { type Booking, type BookingFilters, type PaginatedBookingResponse } from './bookingService';
import { metricsCacheService } from './MetricsCacheService';
import { fetchAllPages } from '../utils/fetchAllPages';
import { getStoredUser } from '../utils/storage';

const CACHE_NAME = 'zapzone-bookings-cache-v1';
const BOOKINGS_CACHE_KEY = '/api/bookings/cached';
const CACHE_METADATA_KEY = '/api/bookings/metadata';

let warmupCompleted = false;

interface CacheMetadata {
  lastUpdated: number;
  locationId?: number;
  userId?: number;
  totalRecords: number;
}

interface BookingsCacheEntry {
  bookings: Booking[];
  pagination?: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
  filters?: BookingFilters;
}

class BookingCacheService {
  private static instance: BookingCacheService;
  private isSyncing: boolean = false;
  private syncPromise: Promise<Booking[]> | null = null;

  private constructor() {}

  static getInstance(): BookingCacheService {
    if (!BookingCacheService.instance) {
      BookingCacheService.instance = new BookingCacheService();
    }
    return BookingCacheService.instance;
  }

  private isCacheAvailable(): boolean {
    return 'caches' in window;
  }

  private async getCache(): Promise<Cache | null> {
    if (!this.isCacheAvailable()) {
      console.warn('[BookingCacheService] Cache Storage not available');
      return null;
    }
    return await caches.open(CACHE_NAME);
  }

  async cacheBookings(bookings: Booking[], metadata?: Partial<CacheMetadata>): Promise<void> {
    const cache = await this.getCache();
    if (!cache) return;

    try {
      const cacheEntry: BookingsCacheEntry = {
        bookings,
      };

      const response = new Response(JSON.stringify(cacheEntry), {
        headers: {
          'Content-Type': 'application/json',
          'X-Cache-Date': new Date().toISOString(),
        },
      });

      await cache.put(BOOKINGS_CACHE_KEY, response);

      const fullMetadata: CacheMetadata = {
        lastUpdated: Date.now(),
        totalRecords: bookings.length,
        ...metadata,
        userId: metadata?.userId ?? getStoredUser()?.id,
      };

      const metadataResponse = new Response(JSON.stringify(fullMetadata), {
        headers: { 'Content-Type': 'application/json' },
      });

      await cache.put(CACHE_METADATA_KEY, metadataResponse);

      console.log(`[BookingCacheService] Cached ${bookings.length} bookings`);
    } catch (error) {
      console.error('[BookingCacheService] Error caching bookings:', error);
    }
  }

  async getCachedBookings(): Promise<Booking[] | null> {
    const cache = await this.getCache();
    if (!cache) return null;

    try {
      const response = await cache.match(BOOKINGS_CACHE_KEY);
      if (!response) return null;

      const data: BookingsCacheEntry = await response.json();
      console.log(`[BookingCacheService] Retrieved ${data.bookings.length} bookings from cache`);
      return data.bookings;
    } catch (error) {
      console.error('[BookingCacheService] Error reading cached bookings:', error);
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
      console.error('[BookingCacheService] Error reading cache metadata:', error);
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

  async fetchAndCacheBookings(
    filters?: BookingFilters,
    forceRefresh: boolean = false
  ): Promise<Booking[]> {
    if (this.isSyncing && this.syncPromise) {
      return this.syncPromise;
    }

    if (!forceRefresh) {
      const cachedBookings = await this.getCachedBookings();
      const isStale = await this.isCacheStale();

      if (cachedBookings && cachedBookings.length > 0) {
        if (isStale) {
          this.syncInBackground(filters);
        }
        return cachedBookings;
      }
    }

    return this.syncFromAPI(filters);
  }

  private async syncFromAPI(filters?: BookingFilters): Promise<Booking[]> {
    if (this.isSyncing && this.syncPromise) {
      return this.syncPromise;
    }

    this.isSyncing = true;
    const startedAt = Date.now();

    this.syncPromise = (async () => {
      try {
        const bookings = await fetchAllPages<Booking>(async (page) => {
          const response: PaginatedBookingResponse = await bookingService.getBookings({
            ...(filters?.user_id ? { user_id: filters.user_id } : {}),
            sort_by: 'id',
            sort_order: 'desc',
            per_page: 100,
            page,
          });
          return { items: response.data?.bookings || [], lastPage: response.data?.pagination?.last_page ?? 1 };
        }, 1000);
        bookings.sort((a, b) => String(b.booking_date || '').localeCompare(String(a.booking_date || '')) || b.id - a.id);

        await this.cacheBookings(bookings, {
          userId: filters?.user_id,
        });

        window.dispatchEvent(new CustomEvent('bookings-cache-updated', {
          detail: { bookings, source: 'api', startedAt }
        }));

        return bookings;
      } catch (error) {
        console.error('[BookingCacheService] Error fetching bookings:', error);
        const cached = await this.getCachedBookings();
        return cached || [];
      } finally {
        this.isSyncing = false;
        this.syncPromise = null;
      }
    })();

    return this.syncPromise;
  }

  private syncScheduled: boolean = false;

  syncInBackground(filters?: BookingFilters): void {
    if (this.isSyncing || this.syncScheduled) return;
    this.syncScheduled = true;

    setTimeout(async () => {
      try {
        const metadata = await this.getCacheMetadata();
        if (metadata && Date.now() - metadata.lastUpdated < 60 * 1000) {
          return;
        }
        await this.syncFromAPI(filters);
        console.log('[BookingCacheService] Background sync completed');
      } catch (error) {
        console.error('[BookingCacheService] Background sync failed:', error);
      } finally {
        this.syncScheduled = false;
      }
    }, 0);
  }

  async updateBookingInCache(updatedBooking: Booking): Promise<void> {
    const cachedBookings = await this.getCachedBookings();
    if (!cachedBookings) return;

    const index = cachedBookings.findIndex(b => b.id === updatedBooking.id);
    
    if (index >= 0) {
      cachedBookings[index] = { ...cachedBookings[index], ...updatedBooking };
    } else {
      cachedBookings.unshift(updatedBooking);
    }

    await this.cacheBookings(cachedBookings);

    window.dispatchEvent(new CustomEvent('bookings-cache-updated', {
      detail: { booking: updatedBooking, source: 'update' }
    }));
    void metricsCacheService.clearAllCaches();
  }

  async addBookingToCache(newBooking: Booking): Promise<void> {
    const cachedBookings = await this.getCachedBookings();
    const bookings = cachedBookings || [];

    const exists = bookings.some(b => b.id === newBooking.id);
    if (!exists) {
      bookings.unshift(newBooking);
      await this.cacheBookings(bookings);
    }

    window.dispatchEvent(new CustomEvent('bookings-cache-updated', {
      detail: { booking: newBooking, source: 'create' }
    }));
    void metricsCacheService.clearAllCaches();
  }

  async removeBookingFromCache(bookingId: number): Promise<void> {
    const cachedBookings = await this.getCachedBookings();
    if (!cachedBookings) return;

    const filteredBookings = cachedBookings.filter(b => b.id !== bookingId);
    await this.cacheBookings(filteredBookings);

    window.dispatchEvent(new CustomEvent('bookings-cache-updated', {
      detail: { bookingId, source: 'delete' }
    }));
    void metricsCacheService.clearAllCaches();
  }

  async getBookingFromCache(bookingId: number): Promise<Booking | null> {
    const cachedBookings = await this.getCachedBookings();
    if (!cachedBookings) return null;

    return cachedBookings.find(b => b.id === bookingId) || null;
  }

  async getFilteredBookingsFromCache(filters: BookingFilters): Promise<Booking[]> {
    const cachedBookings = await this.getCachedBookings();
    console.log('[BookingCacheService] getFilteredBookingsFromCache called with filters:', filters);
    console.log('[BookingCacheService] cachedBookings count:', cachedBookings?.length || 0);
    
    if (!cachedBookings) return [];

    const filtered = cachedBookings.filter(booking => {
      if (filters.location_id && booking.location_id !== filters.location_id) {
        return false;
      }

      if (filters.status && booking.status !== filters.status) {
        return false;
      }

      if (filters.date_from) {
        const bookingDate = new Date(booking.booking_date);
        const fromDate = new Date(filters.date_from);
        if (bookingDate < fromDate) return false;
      }

      if (filters.date_to) {
        const bookingDate = new Date(booking.booking_date);
        const toDate = new Date(filters.date_to);
        if (bookingDate > toDate) return false;
      }

      if (filters.booking_date) {
        const bookingDatePart = booking.booking_date.split('T')[0];
        if (bookingDatePart !== filters.booking_date) {
          return false;
        }
      }

      if (filters.customer_id && booking.customer_id !== filters.customer_id) {
        return false;
      }

      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const customerName = booking.guest_name?.toLowerCase() || '';
        const customerEmail = booking.guest_email?.toLowerCase() || '';
        const refNumber = booking.reference_number?.toLowerCase() || '';
        
        if (!customerName.includes(searchLower) && 
            !customerEmail.includes(searchLower) && 
            !refNumber.includes(searchLower)) {
          return false;
        }
      }

      return true;
    });
    
    console.log('[BookingCacheService] Filtered bookings count:', filtered.length);
    return filtered;
  }

  async clearCache(): Promise<void> {
    if (!this.isCacheAvailable()) return;

    try {
      const deleted = await caches.delete(CACHE_NAME);
      if (deleted) {
        console.log('[BookingCacheService] Cache cleared successfully');
      }
      
      warmupCompleted = false;

      window.dispatchEvent(new CustomEvent('bookings-cache-cleared'));
    } catch (error) {
      console.error('[BookingCacheService] Error clearing cache:', error);
    }
  }

  async forceRefresh(filters?: BookingFilters): Promise<Booking[]> {
    return this.fetchAndCacheBookings(filters, true);
  }

  async warmupCache(filters?: BookingFilters): Promise<void> {
    if (warmupCompleted) {
      console.log('[BookingCacheService] Warmup already completed this session');
      return;
    }
    
    const cachedBookings = await this.getCachedBookings();
    
    if (!cachedBookings || cachedBookings.length === 0) {
      console.log('[BookingCacheService] Warming up cache...');
      await this.syncFromAPI(filters);
      console.log('[BookingCacheService] Cache warmup complete');
    } else {
      console.log('[BookingCacheService] Cache already has data, skipping warmup');
    }
    
    warmupCompleted = true;
  }

  async hasCachedData(): Promise<boolean> {
    const cache = await this.getCache();
    if (!cache) return false;
    
    try {
      const response = await cache.match(BOOKINGS_CACHE_KEY);
      return response !== undefined;
    } catch {
      return false;
    }
  }

  async getBookings(filters?: BookingFilters): Promise<Booking[]> {
    return this.fetchAndCacheBookings(filters);
  }

  onCacheUpdate(callback: (event: CustomEvent) => void): () => void {
    const handler = (e: Event) => callback(e as CustomEvent);
    window.addEventListener('bookings-cache-updated', handler);
    return () => window.removeEventListener('bookings-cache-updated', handler);
  }

  onCacheCleared(callback: () => void): () => void {
    window.addEventListener('bookings-cache-cleared', callback);
    return () => window.removeEventListener('bookings-cache-cleared', callback);
  }
}

export const bookingCacheService = BookingCacheService.getInstance();

export type { BookingsCacheEntry, CacheMetadata };
