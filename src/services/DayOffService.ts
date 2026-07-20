import axios from 'axios';
import { API_BASE_URL, getStoredUser } from '../utils/storage';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

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

export type BlockingScope = 'location' | 'packages' | 'rooms' | 'attractions' | 'events' | 'both';

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
  attraction_ids?: number[] | null;
  event_ids?: number[] | null;
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
  attraction_id?: number;
  event_id?: number;
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
  attraction_ids?: number[] | null;
  event_ids?: number[] | null;
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
  attraction_ids?: number[] | null;
  event_ids?: number[] | null;
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

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const CACHE_TTL = 60000; // 1 minute cache TTL

class DayOffService {
  private cache: Map<string, CacheEntry<unknown>> = new Map();

  private getCached<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (entry && Date.now() - entry.timestamp < CACHE_TTL) {
      return entry.data as T;
    }
    this.cache.delete(key);
    return null;
  }

  private setCache<T>(key: string, data: T): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  invalidateCache(): void {
    this.cache.clear();
  }

  invalidateCacheByPattern(pattern: string): void {
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
  }

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

  async createDayOff(data: CreateDayOffData): Promise<ApiResponse<DayOff>> {
    const response = await api.post('/day-offs', data);
    this.invalidateCacheByPattern('dayoffs_');
    return response.data;
  }

  async updateDayOff(id: number, data: UpdateDayOffData): Promise<ApiResponse<DayOff>> {
    const response = await api.put(`/day-offs/${id}`, data);
    this.invalidateCache(); // Invalidate all cache on update
    return response.data;
  }

  async deleteDayOff(id: number): Promise<ApiResponse<null>> {
    const response = await api.delete(`/day-offs/${id}`);
    this.invalidateCache(); // Invalidate all cache on delete
    return response.data;
  }

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

  async checkDate(data: CheckDateData): Promise<CheckDateResponse> {
    const response = await api.post('/day-offs/check-date', data);
    return response.data;
  }

  async bulkDeleteDayOffs(ids: number[]): Promise<ApiResponse<{ deleted_count: number }>> {
    const response = await api.post('/day-offs/bulk-delete', { ids });
    this.invalidateCache(); // Invalidate all cache on bulk delete
    return response.data;
  }
}

export const dayOffService = new DayOffService();
export default dayOffService;
