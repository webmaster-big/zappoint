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
export interface GiftCard {
  id: number;
  code: string;
  type: 'fixed' | 'percentage';
  initial_value: number;
  balance: number;
  max_usage: number;
  description?: string;
  status: 'active' | 'inactive' | 'expired' | 'redeemed' | 'cancelled' | 'deleted';
  expiry_date?: string;
  created_by: number;
  deleted: boolean;
  created_at: string;
  updated_at: string;
}

export interface GiftCardFilters {
  status?: 'active' | 'inactive' | 'expired' | 'redeemed' | 'cancelled' | 'deleted';
  type?: 'fixed' | 'percentage';
  search?: string;
  sort_by?: 'code' | 'initial_value' | 'balance' | 'created_at';
  sort_order?: 'asc' | 'desc';
  per_page?: number;
  page?: number;
}

export interface CreateGiftCardData {
  code: string;
  type: 'fixed' | 'percentage';
  initial_value: number;
  balance: number;
  max_usage?: number;
  description?: string;
  status?: 'active' | 'inactive' | 'expired' | 'redeemed' | 'cancelled' | 'deleted';
  expiry_date?: string;
  created_by: number;
}

export type UpdateGiftCardData = Partial<CreateGiftCardData>;

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: {
    gift_cards: T[];
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

class GiftCardService {
  /**
   * Get all gift cards with optional filters
   */
  async getGiftCards(filters?: GiftCardFilters): Promise<PaginatedResponse<GiftCard>> {
    const response = await api.get('/gift-cards', { params: filters });
    return response.data;
  }

  /**
   * Get a specific gift card by ID
   */
  async getGiftCard(id: number): Promise<ApiResponse<GiftCard>> {
    const response = await api.get(`/gift-cards/${id}`);
    return response.data;
  }

  /**
   * Create a new gift card
   */
  async createGiftCard(data: CreateGiftCardData): Promise<ApiResponse<GiftCard>> {
    const response = await api.post('/gift-cards', data);
    return response.data;
  }

  /**
   * Update an existing gift card
   */
  async updateGiftCard(id: number, data: UpdateGiftCardData): Promise<ApiResponse<GiftCard>> {
    const response = await api.put(`/gift-cards/${id}`, data);
    return response.data;
  }

  /**
   * Delete a gift card
   */
  async deleteGiftCard(id: number): Promise<ApiResponse<null>> {
    const response = await api.delete(`/gift-cards/${id}`);
    return response.data;
  }
}

// Export a singleton instance
export const giftCardService = new GiftCardService();
export default giftCardService;
