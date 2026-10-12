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

export type BlockingScope = 'location' | 'packages' | 'rooms' | 'attractions' | 'events';

export type BlockType = 'full_day' | 'operating_window' | 'legacy_closure';

export type BlockScopeKey = BlockingScope | 'mixed';

export interface BlockPerson {
  id: number;
  name: string;
  role?: string | null;
}

export interface BlockedRange {
  start_minutes: number;
  end_minutes: number;
}

export interface DayOff {
  id: number;
  location_id: number;
  date: string;
  reason?: string;
  group_name?: string;
  is_recurring: boolean;
  block_type?: BlockType;
  time_start?: string | null;
  time_end?: string | null;
  opens_at?: string | null;
  closes_at?: string | null;
  package_ids?: number[] | null;
  room_ids?: number[] | null;
  attraction_ids?: number[] | null;
  event_ids?: number[] | null;
  window_label?: string;
  scope_label?: string;
  set_by?: BlockPerson | null;
  created_at?: string;
  updated_at?: string;
  location?: {
    id: number;
    name: string;
  } | null;
}

export interface AvailabilityBlock {
  id: number;
  location_id: number;
  location_name: string | null;
  date: string;
  occurrence_date?: string;
  is_recurring: boolean;
  block_type: BlockType;
  opens_at: string | null;
  closes_at: string | null;
  time_start: string | null;
  time_end: string | null;
  window_label: string;
  blocked_ranges: BlockedRange[];
  scope: BlockScopeKey;
  scope_label: string;
  package_ids: number[] | null;
  room_ids: number[] | null;
  attraction_ids: number[] | null;
  event_ids: number[] | null;
  reason: string | null;
  group_name: string | null;
  set_by: BlockPerson | null;
  last_changed_by: BlockPerson | null;
  created_at?: string | null;
  updated_at?: string | null;
  location?: { id: number; name: string } | null;
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
  search?: string;
  package_id?: number;
  room_id?: number;
  attraction_id?: number;
  event_id?: number;
  location_wide_only?: boolean;
}

export interface BlockPayload {
  location_id: number;
  date: string;
  block_type: Exclude<BlockType, 'legacy_closure'>;
  opens_at?: string | null;
  closes_at?: string | null;
  scope: BlockingScope;
  package_ids?: number[] | null;
  room_ids?: number[] | null;
  attraction_ids?: number[] | null;
  event_ids?: number[] | null;
  reason: string;
  group_name: string;
  is_recurring?: boolean;
}

export type CreateDayOffData = BlockPayload;

export type UpdateDayOffData = Partial<BlockPayload>;

export interface CheckDateData {
  location_id: number;
  date: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface Pagination {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  from: number | null;
  to: number | null;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: {
    day_offs: T[];
    pagination: Pagination;
  };
}

export type ChangeAction = 'created' | 'updated' | 'deleted' | 'booked_inside_block' | 'booking_removed';

export interface BlockSnapshot {
  id: number | null;
  location_id: number | null;
  date: string | null;
  is_recurring: boolean;
  block_type: BlockType;
  opens_at: string | null;
  closes_at: string | null;
  time_start: string | null;
  time_end: string | null;
  reason: string | null;
  group_name: string | null;
  package_ids: number[] | null;
  room_ids: number[] | null;
  attraction_ids: number[] | null;
  event_ids: number[] | null;
  created_by: number | null;
  updated_by: number | null;
}

export interface AvailabilityChange {
  id: number;
  day_off_id: number | null;
  location_id: number | null;
  location_name: string | null;
  previous_location_id?: number | null;
  previous_location_name?: string | null;
  action: ChangeAction;
  summary: string;
  changed_by: (BlockPerson & { email?: string | null }) | null;
  before: BlockSnapshot | null;
  after: BlockSnapshot | null;
  changed_fields: string[] | null;
  context: Record<string, unknown> | null;
  created_at: string | null;
}

export interface ChangeLogFilters {
  day_off_id?: number;
  location_id?: number;
  action?: ChangeAction;
  page?: number;
  per_page?: number;
}

export interface CalendarRange {
  start_date: string;
  end_date: string;
  location_id?: number | null;
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const CACHE_TTL = 60000;

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

  async getDayOffs(filters?: DayOffFilters): Promise<PaginatedResponse<AvailabilityBlock>> {
    const response = await api.get('/day-offs', { params: filters });
    return response.data;
  }

  async getDayOff(id: number): Promise<ApiResponse<AvailabilityBlock>> {
    const response = await api.get(`/day-offs/${id}`);
    return response.data;
  }

  async createDayOff(data: CreateDayOffData): Promise<ApiResponse<AvailabilityBlock>> {
    const response = await api.post('/day-offs', data);
    this.invalidateCache();
    return response.data;
  }

  async updateDayOff(id: number, data: UpdateDayOffData): Promise<ApiResponse<AvailabilityBlock> & { merged_day_off_ids?: number[] }> {
    const response = await api.put(`/day-offs/${id}`, data);
    this.invalidateCache();
    return response.data;
  }

  async deleteDayOff(id: number): Promise<ApiResponse<null>> {
    const response = await api.delete(`/day-offs/${id}`);
    this.invalidateCache();
    return response.data;
  }

  async getDayOffsByLocation(locationId: number): Promise<ApiResponse<DayOff[]>> {
    const cacheKey = `dayoffs_location_${locationId}`;
    const cached = this.getCached<ApiResponse<DayOff[]>>(cacheKey);
    if (cached) {
      return cached;
    }

    const response = await api.get(`/day-offs/location/${locationId}`);
    this.setCache(cacheKey, response.data);
    return response.data;
  }

  async getCalendar(range: CalendarRange): Promise<ApiResponse<{ start_date: string; end_date: string; occurrences: AvailabilityBlock[] }>> {
    const params: Record<string, string | number> = {
      start_date: range.start_date,
      end_date: range.end_date,
    };
    if (range.location_id) params.location_id = range.location_id;

    const cacheKey = `dayoffs_calendar_${JSON.stringify(params)}`;
    const cached = this.getCached<ApiResponse<{ start_date: string; end_date: string; occurrences: AvailabilityBlock[] }>>(cacheKey);
    if (cached) {
      return cached;
    }

    const response = await api.get('/day-offs/calendar', { params });
    this.setCache(cacheKey, response.data);
    return response.data;
  }

  async getChangeLog(filters: ChangeLogFilters = {}): Promise<ApiResponse<{ changes: AvailabilityChange[]; pagination: Pagination }>> {
    const response = await api.get('/day-offs/change-log', { params: filters });
    return response.data;
  }

  async checkDate(data: CheckDateData) {
    const response = await api.post('/day-offs/check-date', data);
    return response.data;
  }

  async bulkDeleteDayOffs(ids: number[]): Promise<ApiResponse<{ deleted_count: number }>> {
    const response = await api.post('/day-offs/bulk-delete', { ids });
    this.invalidateCache();
    return response.data;
  }
}

export const dayOffService = new DayOffService();
export default dayOffService;
