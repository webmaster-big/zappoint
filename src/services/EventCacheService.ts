/**
 * EventCacheService
 * 
 * A service that uses the Cache Storage API to cache event data for faster
 * access across management, fee support, special pricing, and purchase components.
 * 
 * Features:
 * - Store events in Cache Storage (not localStorage/sessionStorage)
 * - Provide cached data as primary source for rendering
 * - Update cache when events are created/updated/deleted
 * - Background sync on component navigation
 * - Clear cache on logout
 */

import { eventService } from './EventService';
import type { Event, EventFilters } from '../types/event.types';

const CACHE_NAME = 'zapzone-events-cache-v1';
const EVENTS_CACHE_KEY = '/api/events/cached';
const CACHE_METADATA_KEY = '/api/events/metadata';

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
interface EventsCacheEntry {
  events: Event[];
}

class EventCacheService {
  private static instance: EventCacheService;
  private isSyncing: boolean = false;
  private syncPromise: Promise<Event[]> | null = null;

  private constructor() {}

  static getInstance(): EventCacheService {
    if (!EventCacheService.instance) {
      EventCacheService.instance = new EventCacheService();
    }
    return EventCacheService.instance;
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
      console.warn('[EventCacheService] Cache Storage not available');
      return null;
    }
    return await caches.open(CACHE_NAME);
  }

  /**
   * Store events in cache
   */
  async cacheEvents(events: Event[], metadata?: Partial<CacheMetadata>): Promise<void> {
    const cache = await this.getCache();
    if (!cache) return;

    try {
      const cacheEntry: EventsCacheEntry = { events };

      const response = new Response(JSON.stringify(cacheEntry), {
        headers: {
          'Content-Type': 'application/json',
          'X-Cache-Date': new Date().toISOString(),
        },
      });

      await cache.put(EVENTS_CACHE_KEY, response);

      // Store metadata
      const fullMetadata: CacheMetadata = {
        lastUpdated: Date.now(),
        totalRecords: events.length,
        ...metadata,
      };

      const metadataResponse = new Response(JSON.stringify(fullMetadata), {
        headers: { 'Content-Type': 'application/json' },
      });

      await cache.put(CACHE_METADATA_KEY, metadataResponse);

      console.log(`[EventCacheService] Cached ${events.length} events`);
    } catch (error) {
      console.error('[EventCacheService] Error caching events:', error);
    }
  }

  /**
   * Get events from cache
   */
  async getCachedEvents(): Promise<Event[] | null> {
    const cache = await this.getCache();
    if (!cache) return null;

    try {
      const response = await cache.match(EVENTS_CACHE_KEY);
      if (!response) return null;

      const data: EventsCacheEntry = await response.json();
      console.log(`[EventCacheService] Retrieved ${data.events.length} events from cache`);
      return data.events;
    } catch (error) {
      console.error('[EventCacheService] Error reading cached events:', error);
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
      console.error('[EventCacheService] Error reading cache metadata:', error);
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
   * Parse events from various API response shapes
   */
  private parseEventsFromResponse(res: unknown): Event[] {
    const response = res as Record<string, unknown>;
    let list: Event[] = [];

    if (Array.isArray(response.data)) {
      list = response.data;
    } else if (response.data && typeof response.data === 'object') {
      const obj = response.data as Record<string, unknown>;
      if (Array.isArray(obj.events)) list = obj.events as Event[];
      else if (Array.isArray(obj.data)) list = obj.data as Event[];
    }
    if (list.length === 0 && Array.isArray(response)) {
      list = response as unknown as Event[];
    }

    return list;
  }

  /**
   * Fetch events from API and update cache
   * Returns cached data immediately if available, then syncs in background
   */
  async fetchAndCacheEvents(
    filters?: EventFilters,
    forceRefresh: boolean = false
  ): Promise<Event[]> {
    // If already syncing, return the existing promise
    if (this.isSyncing && this.syncPromise) {
      return this.syncPromise;
    }

    // Check cache first (unless force refresh)
    if (!forceRefresh) {
      const cachedEvents = await this.getCachedEvents();
      const isStale = await this.isCacheStale();

      if (cachedEvents && cachedEvents.length > 0) {
        if (isStale) {
          this.syncInBackground(filters);
        }
        return cachedEvents;
      }
    }

    // No cache or force refresh - fetch from API
    return this.syncFromAPI(filters);
  }

  /**
   * Sync events from API
   */
  private async syncFromAPI(filters?: EventFilters): Promise<Event[]> {
    this.isSyncing = true;

    this.syncPromise = (async () => {
      try {
        const response = await eventService.getEvents({
          ...filters,
          per_page: 1000,
        });

        const events = this.parseEventsFromResponse(response);

        // Cache the events
        await this.cacheEvents(events, {
          locationId: filters?.location_id,
          userId: filters?.user_id,
        });

        // Dispatch event to notify components
        window.dispatchEvent(new CustomEvent('events-cache-updated', {
          detail: { events, source: 'api' }
        }));

        return events;
      } catch (error) {
        console.error('[EventCacheService] Error fetching events:', error);
        const cached = await this.getCachedEvents();
        return cached || [];
      } finally {
        this.isSyncing = false;
        this.syncPromise = null;
      }
    })();

    return this.syncPromise;
  }

  /**
   * Sync events in background without blocking
   */
  syncInBackground(filters?: EventFilters): void {
    if (this.isSyncing) return;

    setTimeout(async () => {
      try {
        await this.syncFromAPI(filters);
        console.log('[EventCacheService] Background sync completed');
      } catch (error) {
        console.error('[EventCacheService] Background sync failed:', error);
      }
    }, 0);
  }

  /**
   * Update a single event in cache
   */
  async updateEventInCache(updatedEvent: Event): Promise<void> {
    const cachedEvents = await this.getCachedEvents();
    if (!cachedEvents) return;

    const index = cachedEvents.findIndex(e => e.id === updatedEvent.id);
    if (index >= 0) {
      cachedEvents[index] = updatedEvent;
    } else {
      cachedEvents.push(updatedEvent);
    }

    await this.cacheEvents(cachedEvents);

    window.dispatchEvent(new CustomEvent('events-cache-updated', {
      detail: { eventId: updatedEvent.id, source: 'update' }
    }));
  }

  /**
   * Add a new event to cache
   */
  async addEventToCache(newEvent: Event): Promise<void> {
    const cachedEvents = await this.getCachedEvents();
    const events = cachedEvents || [];

    const exists = events.some(e => e.id === newEvent.id);
    if (!exists) {
      events.push(newEvent);
      await this.cacheEvents(events);
    }

    window.dispatchEvent(new CustomEvent('events-cache-updated', {
      detail: { eventId: newEvent.id, source: 'add' }
    }));
  }

  /**
   * Remove an event from cache
   */
  async removeEventFromCache(eventId: number): Promise<void> {
    const cachedEvents = await this.getCachedEvents();
    if (!cachedEvents) return;

    const filteredEvents = cachedEvents.filter(e => e.id !== eventId);
    await this.cacheEvents(filteredEvents);

    window.dispatchEvent(new CustomEvent('events-cache-updated', {
      detail: { eventId, source: 'delete' }
    }));
  }

  /**
   * Get a single event from cache by ID
   */
  async getEventFromCache(eventId: number): Promise<Event | null> {
    const cachedEvents = await this.getCachedEvents();
    if (!cachedEvents) return null;

    return cachedEvents.find(e => e.id === eventId) || null;
  }

  /**
   * Get events from cache filtered by criteria
   */
  async getFilteredEventsFromCache(filters: EventFilters & { search?: string; is_active?: boolean }): Promise<Event[]> {
    const cachedEvents = await this.getCachedEvents();
    if (!cachedEvents) return [];

    return cachedEvents.filter(event => {
      if (filters.location_id && event.location_id !== filters.location_id) {
        return false;
      }

      if (filters.is_active !== undefined && event.is_active !== filters.is_active) {
        return false;
      }

      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const name = event.name?.toLowerCase() || '';
        const description = event.description?.toLowerCase() || '';
        if (!name.includes(searchLower) && !description.includes(searchLower)) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Clear all event cache data
   */
  async clearCache(): Promise<void> {
    if (!this.isCacheAvailable()) return;

    try {
      const deleted = await caches.delete(CACHE_NAME);
      if (deleted) {
        console.log('[EventCacheService] Cache cleared successfully');
      }

      warmupCompleted = false;

      window.dispatchEvent(new CustomEvent('events-cache-updated', {
        detail: { source: 'clear' }
      }));
    } catch (error) {
      console.error('[EventCacheService] Error clearing cache:', error);
    }
  }

  /**
   * Warmup the cache - call this on app initialization or login
   */
  async warmupCache(filters?: EventFilters): Promise<void> {
    if (warmupCompleted) {
      console.log('[EventCacheService] Warmup already completed this session');
      return;
    }

    const cachedEvents = await this.getCachedEvents();

    if (!cachedEvents || cachedEvents.length === 0) {
      console.log('[EventCacheService] Warming up cache...');
      await this.syncFromAPI(filters);
      console.log('[EventCacheService] Cache warmup complete');
    } else {
      console.log('[EventCacheService] Cache already has data, skipping warmup');
    }

    warmupCompleted = true;
  }

  /**
   * Check if cache has data
   */
  async hasCachedData(): Promise<boolean> {
    const cache = await this.getCache();
    if (!cache) return false;

    try {
      const response = await cache.match(EVENTS_CACHE_KEY);
      return response !== undefined;
    } catch {
      return false;
    }
  }

  /**
   * Get events with automatic cache management
   */
  async getEvents(filters?: EventFilters): Promise<Event[]> {
    return this.fetchAndCacheEvents(filters);
  }

  /**
   * Force refresh events from API
   */
  async forceRefresh(filters?: EventFilters): Promise<Event[]> {
    return this.fetchAndCacheEvents(filters, true);
  }

  /**
   * Subscribe to cache updates
   */
  onCacheUpdate(callback: (event: CustomEvent) => void): () => void {
    const handler = (e: globalThis.Event) => callback(e as CustomEvent);
    window.addEventListener('events-cache-updated', handler);
    return () => window.removeEventListener('events-cache-updated', handler);
  }
}

// Export singleton instance
export const eventCacheService = EventCacheService.getInstance();
export default eventCacheService;
