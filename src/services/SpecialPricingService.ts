/**
 * Special Pricing Service
 * 
 * Handles all API calls for the Special Pricing system including
 * CRUD operations and price breakdown calculations.
 */

import axios from 'axios';
import { API_BASE_URL, getStoredUser } from '../utils/storage';
import type {
  SpecialPricing,
  SpecialPricingBreakdown,
  CreateSpecialPricingData,
  SpecialPricingListParams,
  SpecialPricingApiResponse,
  EntityType,
} from '../types/SpecialPricing.types';

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

interface UpcomingDatesResponse {
  success: boolean;
  data: {
    dates: Record<string, Array<{ id: number; name: string; discount_label: string }>>;
    count: number;
  };
}

interface CheckDateResponse {
  success: boolean;
  data: {
    date: string;
    has_special_pricing: boolean;
    special_pricings: Array<{
      id: number;
      name: string;
      description: string | null;
      discount_label: string;
      discount_type: string;
      discount_amount: string;
      entity_type: string;
      recurrence_display: string;
    }>;
  };
}

class SpecialPricingService {
  /**
   * List all special pricings with optional filters
   */
  async getSpecialPricings(params?: SpecialPricingListParams): Promise<SpecialPricingApiResponse> {
    const response = await api.get<SpecialPricingApiResponse>('/special-pricings', { params });
    return response.data;
  }

  /**
   * Get a single special pricing by ID
   */
  async getSpecialPricing(id: number): Promise<ApiResponse<SpecialPricing>> {
    const response = await api.get<ApiResponse<SpecialPricing>>(`/special-pricings/${id}`);
    return response.data;
  }

  /**
   * Create a new special pricing
   */
  async createSpecialPricing(data: CreateSpecialPricingData): Promise<ApiResponse<SpecialPricing>> {
    const response = await api.post<ApiResponse<SpecialPricing>>('/special-pricings', data);
    return response.data;
  }

  /**
   * Update an existing special pricing
   */
  async updateSpecialPricing(id: number, data: Partial<CreateSpecialPricingData>): Promise<ApiResponse<SpecialPricing>> {
    const response = await api.put<ApiResponse<SpecialPricing>>(`/special-pricings/${id}`, data);
    return response.data;
  }

  /**
   * Delete a special pricing
   */
  async deleteSpecialPricing(id: number): Promise<ApiResponse<null>> {
    const response = await api.delete<ApiResponse<null>>(`/special-pricings/${id}`);
    return response.data;
  }

  /**
   * Toggle active status
   */
  async toggleStatus(id: number): Promise<ApiResponse<SpecialPricing>> {
    const response = await api.patch<ApiResponse<SpecialPricing>>(`/special-pricings/${id}/toggle-status`);
    return response.data;
  }

  /**
   * Get special pricings by location
   */
  async getByLocation(locationId: number): Promise<ApiResponse<SpecialPricing[]>> {
    const response = await api.get<ApiResponse<SpecialPricing[]>>(`/special-pricings/location/${locationId}`);
    return response.data;
  }

  /**
   * Get price breakdown for an entity (MAIN BOOKING ENDPOINT)
   * This is used in booking flows to calculate automatic discounts
   */
  async getPriceBreakdown(params: {
    entity_type: 'package' | 'attraction';
    entity_id: number;
    base_price: number;
    date?: string; // YYYY-MM-DD
    time?: string; // HH:mm
    location_id?: number;
  }): Promise<SpecialPricingBreakdown> {
    const response = await api.get<ApiResponse<SpecialPricingBreakdown>>('/special-pricings/for-entity', { params });
    return response.data.data;
  }

  /**
   * Check a specific date for special pricing
   */
  async checkDate(params: {
    date: string;
    location_id?: number;
    entity_type?: EntityType;
  }): Promise<CheckDateResponse> {
    const response = await api.post<CheckDateResponse>('/special-pricings/check-date', params);
    return response.data;
  }

  /**
   * Get upcoming special pricing dates for calendar highlighting
   */
  async getUpcomingDates(params?: {
    location_id?: number;
    days?: number;
    entity_type?: EntityType;
  }): Promise<UpcomingDatesResponse> {
    const response = await api.get<UpcomingDatesResponse>('/special-pricings/upcoming-dates', { params });
    return response.data;
  }

  /**
   * Bulk delete multiple special pricings
   */
  async bulkDelete(ids: number[]): Promise<ApiResponse<{ deleted_count: number }>> {
    const response = await api.post<ApiResponse<{ deleted_count: number }>>('/special-pricings/bulk-delete', { ids });
    return response.data;
  }
}

export const specialPricingService = new SpecialPricingService();
export default specialPricingService;
