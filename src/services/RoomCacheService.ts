/**
 * RoomCacheService
 * 
 * A service that uses the Cache Storage API to cache room/space data for faster
 * access across package management, booking, and schedule components.
 * 
 * Features:
 * - Store rooms in Cache Storage (not localStorage/sessionStorage)
 * - Provide cached data as primary source for rendering
 * - Update cache when rooms are created/updated/deleted
 * - Background sync on component navigation
 * - Clear cache on logout
 */

import roomService, { type Room, type RoomFilters, type PaginatedResponse } from './RoomService';

const CACHE_NAME = 'zapzone-rooms-cache-v1';
const ROOMS_CACHE_KEY = '/api/rooms/cached';
const CACHE_METADATA_KEY = '/api/rooms/metadata';

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
interface RoomsCacheEntry {
  rooms: Room[];
  pagination?: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
  filters?: RoomFilters;
}

class RoomCacheService {
  private static instance: RoomCacheService;
  private isSyncing: boolean = false;
  private syncPromise: Promise<Room[]> | null = null;

  private constructor() {}

  static getInstance(): RoomCacheService {
    if (!RoomCacheService.instance) {
      RoomCacheService.instance = new RoomCacheService();
    }
    return RoomCacheService.instance;
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
      console.warn('[RoomCacheService] Cache Storage not available');
      return null;
    }
    return await caches.open(CACHE_NAME);
  }

  /**
   * Store rooms in cache
   */
  async cacheRooms(rooms: Room[], metadata?: Partial<CacheMetadata>): Promise<void> {
    const cache = await this.getCache();
    if (!cache) return;

    try {
      const cacheEntry: RoomsCacheEntry = {
        rooms,
      };

      // Create a Response object to store in cache
      const response = new Response(JSON.stringify(cacheEntry), {
        headers: {
          'Content-Type': 'application/json',
          'X-Cache-Date': new Date().toISOString(),
        },
      });

      await cache.put(ROOMS_CACHE_KEY, response);

      // Store metadata
      const fullMetadata: CacheMetadata = {
        lastUpdated: Date.now(),
        totalRecords: rooms.length,
        ...metadata,
      };

      const metadataResponse = new Response(JSON.stringify(fullMetadata), {
        headers: { 'Content-Type': 'application/json' },
      });

      await cache.put(CACHE_METADATA_KEY, metadataResponse);

      console.log(`[RoomCacheService] Cached ${rooms.length} rooms`);
    } catch (error) {
      console.error('[RoomCacheService] Error caching rooms:', error);
    }
  }

  /**
   * Get rooms from cache
   */
  async getCachedRooms(): Promise<Room[] | null> {
    const cache = await this.getCache();
    if (!cache) return null;

    try {
      const response = await cache.match(ROOMS_CACHE_KEY);
      if (!response) return null;

      const data: RoomsCacheEntry = await response.json();
      console.log(`[RoomCacheService] Retrieved ${data.rooms.length} rooms from cache`);
      return data.rooms;
    } catch (error) {
      console.error('[RoomCacheService] Error reading cached rooms:', error);
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
      console.error('[RoomCacheService] Error reading cache metadata:', error);
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
   * Fetch rooms from API and update cache
   * Returns cached data immediately if available, then syncs in background
   */
  async fetchAndCacheRooms(
    filters?: RoomFilters,
    forceRefresh: boolean = false
  ): Promise<Room[]> {
    // If already syncing, return the existing promise
    if (this.isSyncing && this.syncPromise) {
      return this.syncPromise;
    }

    // Check cache first (unless force refresh)
    if (!forceRefresh) {
      const cachedRooms = await this.getCachedRooms();
      const isStale = await this.isCacheStale();

      if (cachedRooms && cachedRooms.length > 0) {
        // If cache is stale, sync in background
        if (isStale) {
          this.syncInBackground(filters);
        }
        return cachedRooms;
      }
    }

    // No cache or force refresh - fetch from API
    return this.syncFromAPI(filters);
  }

  /**
   * Sync rooms from API
   */
  private async syncFromAPI(filters?: RoomFilters): Promise<Room[]> {
    this.isSyncing = true;

    this.syncPromise = (async () => {
      try {
        // Fetch all rooms with high per_page to get most data
        const response: PaginatedResponse<Room> = await roomService.getRooms({
          ...filters,
          per_page: 500, // Get a large batch
        });

        const rooms = response.data?.rooms || (Array.isArray(response.data) ? response.data : []);

        // Cache the rooms
        await this.cacheRooms(rooms, {
          locationId: filters?.location_id,
          userId: filters?.user_id,
        });

        // Dispatch event to notify components
        window.dispatchEvent(new CustomEvent('rooms-cache-updated', {
          detail: { rooms, source: 'api' }
        }));

        return rooms;
      } catch (error) {
        console.error('[RoomCacheService] Error fetching rooms:', error);
        // Return cached data as fallback
        const cached = await this.getCachedRooms();
        return cached || [];
      } finally {
        this.isSyncing = false;
        this.syncPromise = null;
      }
    })();

    return this.syncPromise;
  }

  /**
   * Sync rooms in background without blocking
   */
  syncInBackground(filters?: RoomFilters): void {
    if (this.isSyncing) return;

    // Use setTimeout to ensure it runs in background
    setTimeout(async () => {
      try {
        await this.syncFromAPI(filters);
        console.log('[RoomCacheService] Background sync completed');
      } catch (error) {
        console.error('[RoomCacheService] Background sync failed:', error);
      }
    }, 0);
  }

  /**
   * Update a single room in cache
   */
  async updateRoomInCache(updatedRoom: Room): Promise<void> {
    const cachedRooms = await this.getCachedRooms();
    if (!cachedRooms) return;

    const index = cachedRooms.findIndex(r => r.id === updatedRoom.id);
    
    if (index >= 0) {
      // Update existing room
      cachedRooms[index] = updatedRoom;
    } else {
      // Add new room at the beginning
      cachedRooms.unshift(updatedRoom);
    }

    await this.cacheRooms(cachedRooms);

    // Dispatch update event
    window.dispatchEvent(new CustomEvent('rooms-cache-updated', {
      detail: { room: updatedRoom, source: 'update' }
    }));
  }

  /**
   * Add a new room to cache
   */
  async addRoomToCache(newRoom: Room): Promise<void> {
    const cachedRooms = await this.getCachedRooms();
    const rooms = cachedRooms || [];

    // Check if room already exists
    const exists = rooms.some(r => r.id === newRoom.id);
    if (!exists) {
      rooms.unshift(newRoom);
      await this.cacheRooms(rooms);
    }

    // Dispatch update event
    window.dispatchEvent(new CustomEvent('rooms-cache-updated', {
      detail: { room: newRoom, source: 'create' }
    }));
  }

  /**
   * Add multiple rooms to cache (for bulk creation)
   */
  async addRoomsToCache(newRooms: Room[]): Promise<void> {
    const cachedRooms = await this.getCachedRooms();
    const rooms = cachedRooms || [];

    for (const newRoom of newRooms) {
      const exists = rooms.some(r => r.id === newRoom.id);
      if (!exists) {
        rooms.unshift(newRoom);
      }
    }

    await this.cacheRooms(rooms);

    // Dispatch update event
    window.dispatchEvent(new CustomEvent('rooms-cache-updated', {
      detail: { rooms: newRooms, source: 'bulk-create' }
    }));
  }

  /**
   * Remove a room from cache
   */
  async removeRoomFromCache(roomId: number): Promise<void> {
    const cachedRooms = await this.getCachedRooms();
    if (!cachedRooms) return;

    const filteredRooms = cachedRooms.filter(r => r.id !== roomId);
    await this.cacheRooms(filteredRooms);

    // Dispatch update event
    window.dispatchEvent(new CustomEvent('rooms-cache-updated', {
      detail: { roomId, source: 'delete' }
    }));
  }

  /**
   * Remove multiple rooms from cache (for bulk deletion)
   */
  async removeRoomsFromCache(roomIds: number[]): Promise<void> {
    const cachedRooms = await this.getCachedRooms();
    if (!cachedRooms) return;

    const filteredRooms = cachedRooms.filter(r => !roomIds.includes(r.id));
    await this.cacheRooms(filteredRooms);

    // Dispatch update event
    window.dispatchEvent(new CustomEvent('rooms-cache-updated', {
      detail: { roomIds, source: 'bulk-delete' }
    }));
  }

  /**
   * Get a single room from cache by ID
   */
  async getRoomFromCache(roomId: number): Promise<Room | null> {
    const cachedRooms = await this.getCachedRooms();
    if (!cachedRooms) return null;

    return cachedRooms.find(r => r.id === roomId) || null;
  }

  /**
   * Get rooms from cache filtered by criteria
   */
  async getFilteredRoomsFromCache(filters: RoomFilters): Promise<Room[]> {
    const cachedRooms = await this.getCachedRooms();
    if (!cachedRooms) return [];

    return cachedRooms.filter(room => {
      // Filter by location
      if (filters.location_id && room.location_id !== filters.location_id) {
        return false;
      }

      // Filter by availability
      if (filters.is_available !== undefined && room.is_available !== filters.is_available) {
        return false;
      }

      // Filter by search query
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const roomName = room.name?.toLowerCase() || '';
        const areaGroup = room.area_group?.toLowerCase() || '';
        
        if (!roomName.includes(searchLower) && !areaGroup.includes(searchLower)) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Clear all room cache data
   * Call this on user logout
   */
  async clearCache(): Promise<void> {
    if (!this.isCacheAvailable()) return;

    try {
      const deleted = await caches.delete(CACHE_NAME);
      if (deleted) {
        console.log('[RoomCacheService] Cache cleared successfully');
      }
      
      // Reset warmup flag so next session will warmup again
      warmupCompleted = false;

      // Dispatch event
      window.dispatchEvent(new CustomEvent('rooms-cache-cleared'));
    } catch (error) {
      console.error('[RoomCacheService] Error clearing cache:', error);
    }
  }

  /**
   * Force a full refresh of the cache
   */
  async forceRefresh(filters?: RoomFilters): Promise<Room[]> {
    return this.fetchAndCacheRooms(filters, true);
  }

  /**
   * Warmup the cache - call this on app initialization or login
   * This pre-populates the cache so subsequent page loads are instant
   * Only fetches if cache is truly empty (not just stale)
   */
  async warmupCache(filters?: RoomFilters): Promise<void> {
    // Skip if warmup already happened this session
    if (warmupCompleted) {
      console.log('[RoomCacheService] Warmup already completed this session');
      return;
    }
    
    const cachedRooms = await this.getCachedRooms();
    
    // Only warmup if cache is empty (stale cache is still usable)
    if (!cachedRooms || cachedRooms.length === 0) {
      console.log('[RoomCacheService] Warming up cache...');
      await this.syncFromAPI(filters);
      console.log('[RoomCacheService] Cache warmup complete');
    } else {
      console.log('[RoomCacheService] Cache already has data, skipping warmup');
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
      const response = await cache.match(ROOMS_CACHE_KEY);
      return response !== undefined;
    } catch {
      return false;
    }
  }

  /**
   * Get rooms with automatic cache management
   * - Returns cached data if available and fresh
   * - Syncs in background if cache is stale
   * - Fetches from API if no cache exists
   */
  async getRooms(filters?: RoomFilters): Promise<Room[]> {
    return this.fetchAndCacheRooms(filters);
  }

  /**
   * Subscribe to cache updates
   */
  onCacheUpdate(callback: (event: CustomEvent) => void): () => void {
    const handler = (e: Event) => callback(e as CustomEvent);
    window.addEventListener('rooms-cache-updated', handler);
    return () => window.removeEventListener('rooms-cache-updated', handler);
  }

  /**
   * Subscribe to cache cleared events
   */
  onCacheCleared(callback: () => void): () => void {
    window.addEventListener('rooms-cache-cleared', callback);
    return () => window.removeEventListener('rooms-cache-cleared', callback);
  }
}

// Export singleton instance
export const roomCacheService = RoomCacheService.getInstance();

// Export types for consumers
export type { RoomsCacheEntry, CacheMetadata };
