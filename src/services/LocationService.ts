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

export interface Location {
  id: number;
  name: string;
  /** Drives the public storefront URL, /<slug>. Derived from the city unless set by hand. */
  slug?: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  latitude?: number | string | null;
  longitude?: number | string | null;
  /** How exact the stored pin is: address, street, or city. */
  geocode_precision?: string | null;
  geocoded_at?: string | null;
  phone?: string;
  email?: string;
  capacity?: number;
  operating_hours?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface LocationFilters {
  is_active?: boolean;
  search?: string;
  sort_by?: 'name' | 'city' | 'created_at';
  sort_order?: 'asc' | 'desc';
  per_page?: number;
  page?: number;
}

export interface CreateLocationData {
  name: string;
  /** Send null to have the server rebuild it from the city. */
  slug?: string | null;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  latitude?: number | null;
  longitude?: number | null;
  phone?: string;
  email?: string;
  capacity?: number;
  operating_hours?: string;
  timezone?: string;
  is_active?: boolean;
}

export type UpdateLocationData = Partial<CreateLocationData>;

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[]; // Backend returns direct array for locations
}

class LocationService {
  async getLocations(filters?: LocationFilters): Promise<PaginatedResponse<Location>> {
    const response = await api.get('/locations', { params: filters });
    return response.data;
  }

  async getLocation(id: number): Promise<ApiResponse<Location>> {
    const response = await api.get(`/locations/${id}`);
    return response.data;
  }

  async createLocation(data: CreateLocationData): Promise<ApiResponse<Location>> {
    const response = await api.post('/locations', data);
    return response.data;
  }

  async updateLocation(id: number, data: UpdateLocationData): Promise<ApiResponse<Location>> {
    const response = await api.put(`/locations/${id}`, data);
    return response.data;
  }

  async deleteLocation(id: number): Promise<ApiResponse<null>> {
    const response = await api.delete(`/locations/${id}`);
    return response.data;
  }
}

export const locationService = new LocationService();
export default locationService;
