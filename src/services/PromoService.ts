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
export interface Promo {
  id: number;
  code: string;
  name: string;
  type: 'fixed' | 'percentage';
  value: number;
  start_date: string;
  end_date: string;
  usage_limit_total?: number;
  usage_limit_per_user: number;
  current_usage: number;
  status: 'active' | 'inactive' | 'expired' | 'exhausted';
  description?: string;
  created_by: number;
  deleted: boolean;
  created_at: string;
  updated_at: string;
}

export interface PromoFilters {
  status?: 'active' | 'inactive' | 'expired' | 'exhausted';
  type?: 'fixed' | 'percentage';
  search?: string;
  sort_by?: 'code' | 'name' | 'value' | 'start_date' | 'end_date' | 'created_at';
  sort_order?: 'asc' | 'desc';
  per_page?: number;
  page?: number;
}

export interface CreatePromoData {
  code: string;
  name: string;
  type: 'fixed' | 'percentage';
  value: number;
  start_date: string;
  end_date: string;
  usage_limit_total?: number;
  usage_limit_per_user?: number;
  status?: 'active' | 'inactive' | 'expired' | 'exhausted';
  description?: string;
  created_by: number;
}

export type UpdatePromoData = Partial<CreatePromoData>;

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: {
    promos: T[];
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

class PromoService {
  /**
   * Get all promos with optional filters
   */
  async getPromos(filters?: PromoFilters): Promise<PaginatedResponse<Promo>> {
    const response = await api.get('/promos', { params: filters });
    return response.data;
  }

  /**
   * Get a specific promo by ID
   */
  async getPromo(id: number): Promise<ApiResponse<Promo>> {
    const response = await api.get(`/promos/${id}`);
    return response.data;
  }

  /**
   * Create a new promo
   */
  async createPromo(data: CreatePromoData): Promise<ApiResponse<Promo>> {
    const response = await api.post('/promos', data);
    return response.data;
  }

  /**
   * Update an existing promo
   */
  async updatePromo(id: number, data: UpdatePromoData): Promise<ApiResponse<Promo>> {
    const response = await api.put(`/promos/${id}`, data);
    return response.data;
  }

  /**
   * Delete a promo
   */
  async deletePromo(id: number): Promise<ApiResponse<null>> {
    const response = await api.delete(`/promos/${id}`);
    return response.data;
  }
}

// Export a singleton instance
export const promoService = new PromoService();
export default promoService;
