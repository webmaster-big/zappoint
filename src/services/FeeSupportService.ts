import axios from 'axios';
import { API_BASE_URL, getStoredUser } from '../utils/storage';
import type { FeeSupport, FeeSupportFormData, FeeSupportFilters, FeeBreakdown } from '../types/FeeSupport.types';

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

// Response types
interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

interface PaginatedFeeSupportResponse {
  success: boolean;
  data: {
    fee_supports: FeeSupport[];
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

class FeeSupportService {
  /**
   * List all fee supports with optional filters
   */
  async getFeeSupports(filters?: FeeSupportFilters): Promise<PaginatedFeeSupportResponse> {
    const response = await api.get('/fee-supports', { params: filters });
    return response.data;
  }

  /**
   * Get a specific fee support by ID
   */
  async getFeeSupport(id: number): Promise<ApiResponse<FeeSupport>> {
    const response = await api.get(`/fee-supports/${id}`);
    return response.data;
  }

  /**
   * Create a new fee support
   */
  async createFeeSupport(data: FeeSupportFormData): Promise<ApiResponse<FeeSupport>> {
    const response = await api.post('/fee-supports', data);
    return response.data;
  }

  /**
   * Update a fee support
   */
  async updateFeeSupport(id: number, data: Partial<FeeSupportFormData>): Promise<ApiResponse<FeeSupport>> {
    const response = await api.put(`/fee-supports/${id}`, data);
    return response.data;
  }

  /**
   * Delete a fee support
   */
  async deleteFeeSupport(id: number): Promise<ApiResponse<null>> {
    const response = await api.delete(`/fee-supports/${id}`);
    return response.data;
  }

  /**
   * Toggle active/inactive status
   */
  async toggleStatus(id: number): Promise<ApiResponse<FeeSupport>> {
    const response = await api.patch(`/fee-supports/${id}/toggle-status`);
    return response.data;
  }

  /**
   * Bulk delete fee supports
   */
  async bulkDelete(ids: number[]): Promise<ApiResponse<null>> {
    const response = await api.post('/fee-supports/bulk-delete', { ids });
    return response.data;
  }

  /**
   * Get price breakdown with all applicable fees for an entity
   * This is the key endpoint for booking/purchase flows
   */
  async getForEntity(params: {
    entity_type: 'package' | 'attraction';
    entity_id: number;
    base_price: number;
    location_id?: number;
  }): Promise<ApiResponse<FeeBreakdown>> {
    const response = await api.get('/fee-supports/for-entity', { params });
    return response.data;
  }

  /**
   * Get all active fee supports for a location
   */
  async getByLocation(locationId: number): Promise<ApiResponse<FeeSupport[]>> {
    const response = await api.get(`/fee-supports/location/${locationId}`);
    return response.data;
  }
}

// Export singleton instance
export const feeSupportService = new FeeSupportService();
export default feeSupportService;
