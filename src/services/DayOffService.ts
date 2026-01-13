import axios from 'axios';
import { API_BASE_URL, getStoredUser } from '../utils/storage';

// Create axios instance with base configuration
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

// Add request interceptor to include auth token
api.interceptors.request.use(
  (config) => {
    const token = getStoredUser()?.token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Blocking scope type for UI
export type BlockingScope = 'location' | 'packages' | 'rooms' | 'both';

// Types
export interface DayOff {
  id: number;
  location_id: number;
  date: string;
  reason?: string;
  is_recurring: boolean;
  time_start?: string | null;  // Close starting at this time (e.g., "16:00" for close at 4 PM)
  time_end?: string | null;    // Delayed opening until this time (e.g., "16:00" for open at 4 PM)
  package_ids?: number[] | null;  // Array of package IDs to block, null = all packages
  room_ids?: number[] | null;     // Array of room IDs to block, null = all rooms
  created_at: string;
  updated_at: string;
  location?: {
    id: number;
    name: string;
  };
}

export interface DayOffFilters {
  location_id?: number;
  date?: string;
  start_date?: string;
  end_date?: string;
  is_recurring?: boolean;
  upcoming_only?: boolean;
  sort_by?: 'date' | 'created_at';
  sort_order?: 'asc' | 'desc';
  per_page?: number;
  page?: number;
  user_id?: number;
  package_id?: number;         // Filter day offs that apply to this package
  room_id?: number;            // Filter day offs that apply to this room
  location_wide_only?: boolean; // Only return location-wide blocks
}

export interface CreateDayOffData {
  location_id: number;
  date: string;
  reason?: string;
  is_recurring?: boolean;
  time_start?: string | null;  // Close starting at this time
  time_end?: string | null;    // Delayed opening until this time
  package_ids?: number[] | null;  // Array of package IDs to block
  room_ids?: number[] | null;     // Array of room IDs to block
}

export interface UpdateDayOffData {
  location_id?: number;
  date?: string;
  reason?: string;
  is_recurring?: boolean;
  time_start?: string | null;  // Close starting at this time
  time_end?: string | null;    // Delayed opening until this time
  package_ids?: number[] | null;  // Array of package IDs to block
  room_ids?: number[] | null;     // Array of room IDs to block
}

export interface CheckDateData {
  location_id: number;
  date: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: {
    day_offs: T[];
    pagination: {
      current_page: number;
      last_page: number;
      per_page: number;
      total: number;
      from: number;
      to: number;
    };
  };
}

export interface CheckDateResponse {
  success: boolean;
  data: {
    is_blocked: boolean;
    day_off: DayOff | null;
  };
}

// Cache configuration
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const CACHE_TTL = 60000; // 1 minute cache TTL

class DayOffService {
  private cache: Map<string, CacheEntry<unknown>> = new Map();

  /**
   * Get cached data or fetch fresh
   */
  private getCached<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (entry && Date.now() - entry.timestamp < CACHE_TTL) {
      return entry.data as T;
    }
    this.cache.delete(key);
    return null;
  }

  /**
   * Set cache data
   */
  private setCache<T>(key: string, data: T): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  /**
   * Invalidate all cache entries
   */
  invalidateCache(): void {
    this.cache.clear();
  }

  /**
   * Invalidate cache entries matching a pattern
   */
  invalidateCacheByPattern(pattern: string): void {
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Get all day offs with optional filters
   */
  async getDayOffs(filters?: DayOffFilters): Promise<PaginatedResponse<DayOff>> {
    const cacheKey = `dayoffs_list_${JSON.stringify(filters || {})}`;
    const cached = this.getCached<PaginatedResponse<DayOff>>(cacheKey);
    if (cached) {
      console.log('📦 Returning cached day offs list');
      return cached;
    }

    const response = await api.get('/day-offs', { params: filters });
    this.setCache(cacheKey, response.data);
    return response.data;
  }

  /**
   * Get a specific day off by ID
   */
  async getDayOff(id: number): Promise<ApiResponse<DayOff>> {
    const cacheKey = `dayoff_${id}`;
    const cached = this.getCached<ApiResponse<DayOff>>(cacheKey);
    if (cached) {
      return cached;
    }

    const response = await api.get(`/day-offs/${id}`);
    this.setCache(cacheKey, response.data);
    return response.data;
  }

  /**
   * Create a new day off
   */
  async createDayOff(data: CreateDayOffData): Promise<ApiResponse<DayOff>> {
    const response = await api.post('/day-offs', data);
    this.invalidateCacheByPattern('dayoffs_');
    return response.data;
  }

  /**
   * Update an existing day off
   */
  async updateDayOff(id: number, data: UpdateDayOffData): Promise<ApiResponse<DayOff>> {
    const response = await api.put(`/day-offs/${id}`, data);
    this.invalidateCache(); // Invalidate all cache on update
    return response.data;
  }

  /**
   * Delete a day off
   */
  async deleteDayOff(id: number): Promise<ApiResponse<null>> {
    const response = await api.delete(`/day-offs/${id}`);
    this.invalidateCache(); // Invalidate all cache on delete
    return response.data;
  }

  /**
   * Get day offs by location
   */
  async getDayOffsByLocation(locationId: number): Promise<ApiResponse<DayOff[]>> {
    const cacheKey = `dayoffs_location_${locationId}`;
    const cached = this.getCached<ApiResponse<DayOff[]>>(cacheKey);
    if (cached) {
      console.log('📦 Returning cached day offs for location', locationId);
      return cached;
    }

    const response = await api.get(`/day-offs/location/${locationId}`);
    this.setCache(cacheKey, response.data);
    return response.data;
  }

  /**
   * Check if a specific date is blocked
   */
  async checkDate(data: CheckDateData): Promise<CheckDateResponse> {
    const response = await api.post('/day-offs/check-date', data);
    return response.data;
  }

  /**
   * Bulk delete day offs
   */
  async bulkDeleteDayOffs(ids: number[]): Promise<ApiResponse<{ deleted_count: number }>> {
    const response = await api.post('/day-offs/bulk-delete', { ids });
    this.invalidateCache(); // Invalidate all cache on bulk delete
    return response.data;
  }
}

// Export a singleton instance
export const dayOffService = new DayOffService();
export default dayOffService;
