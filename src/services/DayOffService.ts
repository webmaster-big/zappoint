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

// Types
export interface DayOff {
  id: number;
  location_id: number;
  date: string;
  reason?: string;
  is_recurring: boolean;
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
}

export interface CreateDayOffData {
  location_id: number;
  date: string;
  reason?: string;
  is_recurring?: boolean;
}

export interface UpdateDayOffData {
  location_id?: number;
  date?: string;
  reason?: string;
  is_recurring?: boolean;
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

class DayOffService {
  /**
   * Get all day offs with optional filters
   */
  async getDayOffs(filters?: DayOffFilters): Promise<PaginatedResponse<DayOff>> {
    const response = await api.get('/day-offs', { params: filters });
    return response.data;
  }

  /**
   * Get a specific day off by ID
   */
  async getDayOff(id: number): Promise<ApiResponse<DayOff>> {
    const response = await api.get(`/day-offs/${id}`);
    return response.data;
  }

  /**
   * Create a new day off
   */
  async createDayOff(data: CreateDayOffData): Promise<ApiResponse<DayOff>> {
    const response = await api.post('/day-offs', data);
    return response.data;
  }

  /**
   * Update an existing day off
   */
  async updateDayOff(id: number, data: UpdateDayOffData): Promise<ApiResponse<DayOff>> {
    const response = await api.put(`/day-offs/${id}`, data);
    return response.data;
  }

  /**
   * Delete a day off
   */
  async deleteDayOff(id: number): Promise<ApiResponse<null>> {
    const response = await api.delete(`/day-offs/${id}`);
    return response.data;
  }

  /**
   * Get day offs by location
   */
  async getDayOffsByLocation(locationId: number): Promise<ApiResponse<DayOff[]>> {
    const response = await api.get(`/day-offs/location/${locationId}`);
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
    return response.data;
  }
}

// Export a singleton instance
export const dayOffService = new DayOffService();
export default dayOffService;
