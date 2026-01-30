/**
 * BookingCacheService
 * 
 * A service that uses the Cache Storage API to cache booking data for faster
 * access across dashboard components, calendar views, and booking management pages.
 * 
 * Features:
 * - Store bookings in Cache Storage (not localStorage/sessionStorage)
 * - Provide cached data as primary source for rendering
 * - Update cache when bookings are created/updated
 * - Background sync on dashboard navigation
 * - Clear cache on logout
 */

import bookingService, { type Booking, type BookingFilters, type PaginatedBookingResponse } from './bookingService';

const CACHE_NAME = 'zapzone-bookings-cache-v1';
const BOOKINGS_CACHE_KEY = '/api/bookings/cached';
const CACHE_METADATA_KEY = '/api/bookings/metadata';

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
      console.warn('[BookingCacheService] Cache Storage not available');
      return null;
    }
    return await caches.open(CACHE_NAME);
  }

  /**
   * Store bookings in cache
   */
  async cacheBookings(bookings: Booking[], metadata?: Partial<CacheMetadata>): Promise<void> {
    const cache = await this.getCache();
    if (!cache) return;

    try {
      const cacheEntry: BookingsCacheEntry = {
        bookings,
      };

      // Create a Response object to store in cache
      const response = new Response(JSON.stringify(cacheEntry), {
        headers: {
          'Content-Type': 'application/json',
          'X-Cache-Date': new Date().toISOString(),
        },
      });

      await cache.put(BOOKINGS_CACHE_KEY, response);

      // Store metadata
      const fullMetadata: CacheMetadata = {
        lastUpdated: Date.now(),
        totalRecords: bookings.length,
        ...metadata,
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

  /**
   * Get bookings from cache
   */
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
      console.error('[BookingCacheService] Error reading cache metadata:', error);
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
   * Fetch bookings from API and update cache
   * Returns cached data immediately if available, then syncs in background
   */
  async fetchAndCacheBookings(
    filters?: BookingFilters,
    forceRefresh: boolean = false
  ): Promise<Booking[]> {
    // If already syncing, return the existing promise
    if (this.isSyncing && this.syncPromise) {
      return this.syncPromise;
    }

    // Check cache first (unless force refresh)
    if (!forceRefresh) {
      const cachedBookings = await this.getCachedBookings();
      const isStale = await this.isCacheStale();

      if (cachedBookings && cachedBookings.length > 0) {
        // If cache is stale, sync in background
        if (isStale) {
          this.syncInBackground(filters);
        }
        return cachedBookings;
      }
    }

    // No cache or force refresh - fetch from API
    return this.syncFromAPI(filters);
  }

  /**
   * Sync bookings from API
   */
  private async syncFromAPI(filters?: BookingFilters): Promise<Booking[]> {
    this.isSyncing = true;

    this.syncPromise = (async () => {
      try {
        // Fetch all bookings with high per_page to get most data
        const response: PaginatedBookingResponse = await bookingService.getBookings({
          ...filters,
          per_page: 500, // Get a large batch (500 max to avoid backend limits)
        });

        const bookings = response.data.bookings || [];

        // Cache the bookings
        await this.cacheBookings(bookings, {
          locationId: filters?.location_id,
          userId: filters?.user_id,
        });

        // Dispatch event to notify components
        window.dispatchEvent(new CustomEvent('bookings-cache-updated', {
          detail: { bookings, source: 'api' }
        }));

        return bookings;
      } catch (error) {
        console.error('[BookingCacheService] Error fetching bookings:', error);
        // Return cached data as fallback
        const cached = await this.getCachedBookings();
        return cached || [];
      } finally {
        this.isSyncing = false;
        this.syncPromise = null;
      }
    })();

    return this.syncPromise;
  }

  /**
   * Sync bookings in background without blocking
   */
  syncInBackground(filters?: BookingFilters): void {
    if (this.isSyncing) return;

    // Use setTimeout to ensure it runs in background
    setTimeout(async () => {
      try {
        await this.syncFromAPI(filters);
        console.log('[BookingCacheService] Background sync completed');
      } catch (error) {
        console.error('[BookingCacheService] Background sync failed:', error);
      }
    }, 0);
  }

  /**
   * Update a single booking in cache
   */
  async updateBookingInCache(updatedBooking: Booking): Promise<void> {
    const cachedBookings = await this.getCachedBookings();
    if (!cachedBookings) return;

    const index = cachedBookings.findIndex(b => b.id === updatedBooking.id);
    
    if (index >= 0) {
      // Update existing booking
      cachedBookings[index] = updatedBooking;
    } else {
      // Add new booking at the beginning
      cachedBookings.unshift(updatedBooking);
    }

    await this.cacheBookings(cachedBookings);

    // Dispatch update event
    window.dispatchEvent(new CustomEvent('bookings-cache-updated', {
      detail: { booking: updatedBooking, source: 'update' }
    }));
  }

  /**
   * Add a new booking to cache
   */
  async addBookingToCache(newBooking: Booking): Promise<void> {
    const cachedBookings = await this.getCachedBookings();
    const bookings = cachedBookings || [];

    // Check if booking already exists
    const exists = bookings.some(b => b.id === newBooking.id);
    if (!exists) {
      bookings.unshift(newBooking);
      await this.cacheBookings(bookings);
    }

    // Dispatch update event
    window.dispatchEvent(new CustomEvent('bookings-cache-updated', {
      detail: { booking: newBooking, source: 'create' }
    }));
  }

  /**
   * Remove a booking from cache
   */
  async removeBookingFromCache(bookingId: number): Promise<void> {
    const cachedBookings = await this.getCachedBookings();
    if (!cachedBookings) return;

    const filteredBookings = cachedBookings.filter(b => b.id !== bookingId);
    await this.cacheBookings(filteredBookings);

    // Dispatch update event
    window.dispatchEvent(new CustomEvent('bookings-cache-updated', {
      detail: { bookingId, source: 'delete' }
    }));
  }

  /**
   * Get a single booking from cache by ID
   */
  async getBookingFromCache(bookingId: number): Promise<Booking | null> {
    const cachedBookings = await this.getCachedBookings();
    if (!cachedBookings) return null;

    return cachedBookings.find(b => b.id === bookingId) || null;
  }

  /**
   * Get bookings from cache filtered by criteria
   */
  async getFilteredBookingsFromCache(filters: BookingFilters): Promise<Booking[]> {
    const cachedBookings = await this.getCachedBookings();
    console.log('[BookingCacheService] getFilteredBookingsFromCache called with filters:', filters);
    console.log('[BookingCacheService] cachedBookings count:', cachedBookings?.length || 0);
    
    if (!cachedBookings) return [];

    const filtered = cachedBookings.filter(booking => {
      // Filter by location
      if (filters.location_id && booking.location_id !== filters.location_id) {
        return false;
      }

      // Filter by status
      if (filters.status && booking.status !== filters.status) {
        return false;
      }

      // Filter by date range
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

      // Filter by specific date (handle both "YYYY-MM-DD" and "YYYY-MM-DDTHH:mm:ss" formats)
      if (filters.booking_date) {
        const bookingDatePart = booking.booking_date.split('T')[0];
        if (bookingDatePart !== filters.booking_date) {
          return false;
        }
      }

      // Filter by customer
      if (filters.customer_id && booking.customer_id !== filters.customer_id) {
        return false;
      }

      // Filter by search query
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

  /**
   * Clear all booking cache data
   * Call this on user logout
   */
  async clearCache(): Promise<void> {
    if (!this.isCacheAvailable()) return;

    try {
      const deleted = await caches.delete(CACHE_NAME);
      if (deleted) {
        console.log('[BookingCacheService] Cache cleared successfully');
      }
      
      // Reset warmup flag so next session will warmup again
      warmupCompleted = false;

      // Dispatch event
      window.dispatchEvent(new CustomEvent('bookings-cache-cleared'));
    } catch (error) {
      console.error('[BookingCacheService] Error clearing cache:', error);
    }
  }

  /**
   * Force a full refresh of the cache
   */
  async forceRefresh(filters?: BookingFilters): Promise<Booking[]> {
    return this.fetchAndCacheBookings(filters, true);
  }

  /**
   * Warmup the cache - call this on app initialization or login
   * This pre-populates the cache so subsequent page loads are instant
   * Only fetches if cache is truly empty (not just stale)
   */
  async warmupCache(filters?: BookingFilters): Promise<void> {
    // Skip if warmup already happened this session
    if (warmupCompleted) {
      console.log('[BookingCacheService] Warmup already completed this session');
      return;
    }
    
    const cachedBookings = await this.getCachedBookings();
    
    // Only warmup if cache is empty (stale cache is still usable)
    if (!cachedBookings || cachedBookings.length === 0) {
      console.log('[BookingCacheService] Warming up cache...');
      await this.syncFromAPI(filters);
      console.log('[BookingCacheService] Cache warmup complete');
    } else {
      console.log('[BookingCacheService] Cache already has data, skipping warmup');
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
      const response = await cache.match(BOOKINGS_CACHE_KEY);
      return response !== undefined;
    } catch {
      return false;
    }
  }

  /**
   * Get bookings with automatic cache management
   * - Returns cached data if available and fresh
   * - Syncs in background if cache is stale
   * - Fetches from API if no cache exists
   */
  async getBookings(filters?: BookingFilters): Promise<Booking[]> {
    return this.fetchAndCacheBookings(filters);
  }

  /**
   * Subscribe to cache updates
   */
  onCacheUpdate(callback: (event: CustomEvent) => void): () => void {
    const handler = (e: Event) => callback(e as CustomEvent);
    window.addEventListener('bookings-cache-updated', handler);
    return () => window.removeEventListener('bookings-cache-updated', handler);
  }

  /**
   * Subscribe to cache cleared events
   */
  onCacheCleared(callback: () => void): () => void {
    window.addEventListener('bookings-cache-cleared', callback);
    return () => window.removeEventListener('bookings-cache-cleared', callback);
  }
}

// Export singleton instance
export const bookingCacheService = BookingCacheService.getInstance();

// Export types for consumers
export type { BookingsCacheEntry, CacheMetadata };
