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
export interface Attraction {
  id: number;
  location_id: number;
  name: string;
  description: string;
  price: number;
  pricing_type: string;
  max_capacity: number;
  category: string;
  unit?: string;
  duration?: number;
  duration_unit?: 'hours' | 'minutes';
  availability?: Record<string, unknown>;
  image?: string | string[]; // Support both single image and array
  rating?: number;
  min_age?: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AttractionFilters {
  location_id?: number;
  category?: string;
  is_active?: boolean;
  search?: string;
  sort_by?: 'name' | 'price' | 'created_at' | 'category' | 'rating';
  sort_order?: 'asc' | 'desc';
  per_page?: number;
  page?: number;
  user_id?: number;
}

export interface CreateAttractionData {
  location_id: number;
  name: string;
  description: string;
  price: number;
  pricing_type: string;
  max_capacity: number;
  category: string;
  unit?: string;
  duration?: number;
  duration_unit?: 'hours' | 'minutes';
  availability?: Record<string, unknown>;
  image?: string | string[]; // Support both single image and array
  rating?: number;
  min_age?: number;
  is_active?: boolean;
}

export type UpdateAttractionData = Partial<CreateAttractionData>;

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: {
    attractions: T[];
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

class AttractionService {
  /**
   * Get all attractions with optional filters
   */
  async getAttractions(filters?: AttractionFilters): Promise<PaginatedResponse<Attraction>> {
    const response = await api.get('/attractions', { params: filters, headers: { 'Accept': 'application/json', 'Authorization': `Bearer ${getStoredUser()?.token}`} });
    return response.data;
  }
  

  /**
   * Get a specific attraction by ID
   */
  async getAttraction(id: number): Promise<ApiResponse<Attraction>> {
    const response = await api.get(`/attractions/${id}`);
    console.log('Attraction response data:', response.data);
    return response.data;
  }

  /**
   * Create a new attraction
   */
  async createAttraction(data: CreateAttractionData): Promise<ApiResponse<Attraction>> {
    const response = await api.post('/attractions', data);
    return response.data;
  }

  /**
   * Update an existing attraction
   */
  async updateAttraction(id: number, data: UpdateAttractionData): Promise<ApiResponse<Attraction>> {
    const response = await api.put(`/attractions/${id}`, data);
    return response.data;
  }

  /**
   * Delete an attraction
   */
  async deleteAttraction(id: number): Promise<ApiResponse<null>> {
    const response = await api.delete(`/attractions/${id}`);
    return response.data;
  }

  /**
   * Activate an attraction
   */
  async activateAttraction(id: number): Promise<ApiResponse<Attraction>> {
    const response = await api.patch(`/attractions/${id}/activate`);
    return response.data;
  }

  /**
   * Deactivate an attraction
   */
  async deactivateAttraction(id: number): Promise<ApiResponse<Attraction>> {
    const response = await api.patch(`/attractions/${id}/deactivate`);
    return response.data;
  }

  /**
   * Bulk delete attractions
   */
  async bulkDelete(ids: number[]): Promise<ApiResponse<null>> {
    const response = await api.post('/attractions/bulk-delete', { ids });
    return response.data;
  }
}

// Export a singleton instance
export const attractionService = new AttractionService();
export default attractionService;
