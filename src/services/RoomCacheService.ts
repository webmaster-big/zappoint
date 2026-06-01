
import roomService, { type Room, type RoomFilters, type PaginatedResponse } from './RoomService';

const CACHE_NAME = 'zapzone-rooms-cache-v1';
const ROOMS_CACHE_KEY = '/api/rooms/cached';
const CACHE_METADATA_KEY = '/api/rooms/metadata';

let warmupCompleted = false;

interface CacheMetadata {
  lastUpdated: number;
  locationId?: number;
  userId?: number;
  totalRecords: number;
}

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

  private isCacheAvailable(): boolean {
    return 'caches' in window;
  }

  private async getCache(): Promise<Cache | null> {
    if (!this.isCacheAvailable()) {
      console.warn('[RoomCacheService] Cache Storage not available');
      return null;
    }
    return await caches.open(CACHE_NAME);
  }

  async cacheRooms(rooms: Room[], metadata?: Partial<CacheMetadata>): Promise<void> {
    const cache = await this.getCache();
    if (!cache) return;

    try {
      const cacheEntry: RoomsCacheEntry = {
        rooms,
      };

      const response = new Response(JSON.stringify(cacheEntry), {
        headers: {
          'Content-Type': 'application/json',
          'X-Cache-Date': new Date().toISOString(),
        },
      });

      await cache.put(ROOMS_CACHE_KEY, response);

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

  async isCacheStale(maxAgeMinutes: number = 5): Promise<boolean> {
    const metadata = await this.getCacheMetadata();
    if (!metadata) return true;

    const ageMs = Date.now() - metadata.lastUpdated;
    const maxAgeMs = maxAgeMinutes * 60 * 1000;

    return ageMs > maxAgeMs;
  }

  async fetchAndCacheRooms(
    filters?: RoomFilters,
    forceRefresh: boolean = false
  ): Promise<Room[]> {
    if (this.isSyncing && this.syncPromise) {
      return this.syncPromise;
    }

    if (!forceRefresh) {
      const cachedRooms = await this.getCachedRooms();
      const isStale = await this.isCacheStale();

      if (cachedRooms && cachedRooms.length > 0) {
        if (isStale) {
          this.syncInBackground(filters);
        }
        return cachedRooms;
      }
    }

    return this.syncFromAPI(filters);
  }

  private async syncFromAPI(filters?: RoomFilters): Promise<Room[]> {
    this.isSyncing = true;

    this.syncPromise = (async () => {
      try {
        const response: PaginatedResponse<Room> = await roomService.getRooms({
          ...filters,
          per_page: 500, // Get a large batch
        });

        const rooms = response.data?.rooms || (Array.isArray(response.data) ? response.data : []);

        await this.cacheRooms(rooms, {
          locationId: filters?.location_id,
          userId: filters?.user_id,
        });

        window.dispatchEvent(new CustomEvent('rooms-cache-updated', {
          detail: { rooms, source: 'api' }
        }));

        return rooms;
      } catch (error) {
        console.error('[RoomCacheService] Error fetching rooms:', error);
        const cached = await this.getCachedRooms();
        return cached || [];
      } finally {
        this.isSyncing = false;
        this.syncPromise = null;
      }
    })();

    return this.syncPromise;
  }

  syncInBackground(filters?: RoomFilters): void {
    if (this.isSyncing) return;

    setTimeout(async () => {
      try {
        await this.syncFromAPI(filters);
        console.log('[RoomCacheService] Background sync completed');
      } catch (error) {
        console.error('[RoomCacheService] Background sync failed:', error);
      }
    }, 0);
  }

  async updateRoomInCache(updatedRoom: Room): Promise<void> {
    const cachedRooms = await this.getCachedRooms();
    if (!cachedRooms) return;

    const index = cachedRooms.findIndex(r => r.id === updatedRoom.id);
    
    if (index >= 0) {
      cachedRooms[index] = updatedRoom;
    } else {
      cachedRooms.unshift(updatedRoom);
    }

    await this.cacheRooms(cachedRooms);

    window.dispatchEvent(new CustomEvent('rooms-cache-updated', {
      detail: { room: updatedRoom, source: 'update' }
    }));
  }

  async addRoomToCache(newRoom: Room): Promise<void> {
    const cachedRooms = await this.getCachedRooms();
    const rooms = cachedRooms || [];

    const exists = rooms.some(r => r.id === newRoom.id);
    if (!exists) {
      rooms.unshift(newRoom);
      await this.cacheRooms(rooms);
    }

    window.dispatchEvent(new CustomEvent('rooms-cache-updated', {
      detail: { room: newRoom, source: 'create' }
    }));
  }

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

    window.dispatchEvent(new CustomEvent('rooms-cache-updated', {
      detail: { rooms: newRooms, source: 'bulk-create' }
    }));
  }

  async removeRoomFromCache(roomId: number): Promise<void> {
    const cachedRooms = await this.getCachedRooms();
    if (!cachedRooms) return;

    const filteredRooms = cachedRooms.filter(r => r.id !== roomId);
    await this.cacheRooms(filteredRooms);

    window.dispatchEvent(new CustomEvent('rooms-cache-updated', {
      detail: { roomId, source: 'delete' }
    }));
  }

  async removeRoomsFromCache(roomIds: number[]): Promise<void> {
    const cachedRooms = await this.getCachedRooms();
    if (!cachedRooms) return;

    const filteredRooms = cachedRooms.filter(r => !roomIds.includes(r.id));
    await this.cacheRooms(filteredRooms);

    window.dispatchEvent(new CustomEvent('rooms-cache-updated', {
      detail: { roomIds, source: 'bulk-delete' }
    }));
  }

  async getRoomFromCache(roomId: number): Promise<Room | null> {
    const cachedRooms = await this.getCachedRooms();
    if (!cachedRooms) return null;

    return cachedRooms.find(r => r.id === roomId) || null;
  }

  async getFilteredRoomsFromCache(filters: RoomFilters): Promise<Room[]> {
    const cachedRooms = await this.getCachedRooms();
    if (!cachedRooms) return [];

    return cachedRooms.filter(room => {
      if (filters.location_id && room.location_id !== filters.location_id) {
        return false;
      }

      if (filters.is_available !== undefined && room.is_available !== filters.is_available) {
        return false;
      }

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

  async clearCache(): Promise<void> {
    if (!this.isCacheAvailable()) return;

    try {
      const deleted = await caches.delete(CACHE_NAME);
      if (deleted) {
        console.log('[RoomCacheService] Cache cleared successfully');
      }
      
      warmupCompleted = false;

      window.dispatchEvent(new CustomEvent('rooms-cache-cleared'));
    } catch (error) {
      console.error('[RoomCacheService] Error clearing cache:', error);
    }
  }

  async forceRefresh(filters?: RoomFilters): Promise<Room[]> {
    return this.fetchAndCacheRooms(filters, true);
  }

  async warmupCache(filters?: RoomFilters): Promise<void> {
    if (warmupCompleted) {
      console.log('[RoomCacheService] Warmup already completed this session');
      return;
    }
    
    const cachedRooms = await this.getCachedRooms();
    
    if (!cachedRooms || cachedRooms.length === 0) {
      console.log('[RoomCacheService] Warming up cache...');
      await this.syncFromAPI(filters);
      console.log('[RoomCacheService] Cache warmup complete');
    } else {
      console.log('[RoomCacheService] Cache already has data, skipping warmup');
    }
    
    warmupCompleted = true;
  }

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

  async getRooms(filters?: RoomFilters): Promise<Room[]> {
    return this.fetchAndCacheRooms(filters);
  }

  onCacheUpdate(callback: (event: CustomEvent) => void): () => void {
    const handler = (e: Event) => callback(e as CustomEvent);
    window.addEventListener('rooms-cache-updated', handler);
    return () => window.removeEventListener('rooms-cache-updated', handler);
  }

  onCacheCleared(callback: () => void): () => void {
    window.addEventListener('rooms-cache-cleared', callback);
    return () => window.removeEventListener('rooms-cache-cleared', callback);
  }
}

export const roomCacheService = RoomCacheService.getInstance();

export type { RoomsCacheEntry, CacheMetadata };
