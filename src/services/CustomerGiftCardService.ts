import axios from 'axios';
import { API_BASE_URL } from '../utils/storage';

// Helper to get customer token from localStorage
const getCustomerToken = (): string | null => {
  try {
    const stored = localStorage.getItem('zapzone_customer');
    if (stored) {
      const customer = JSON.parse(stored);
      return customer?.token || null;
    }
  } catch {
    // ignore parse errors
  }
  return null;
};

// Helper to get customer ID from localStorage
const getCustomerId = (): number | null => {
  try {
    const stored = localStorage.getItem('zapzone_customer');
    if (stored) {
      const customer = JSON.parse(stored);
      return customer?.id || customer?.user?.id || null;
    }
  } catch {
    // ignore parse errors
  }
  return null;
};

// Authenticated axios instance (customer token)
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = getCustomerToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Types ──────────────────────────────────────────────────────────────

export interface CustomerGiftCard {
  id: number;
  code: string;
  type: 'fixed' | 'percentage';
  initial_value: number;
  balance: number;
  max_usage: number;
  description?: string;
  status: 'active' | 'inactive' | 'expired' | 'redeemed' | 'cancelled' | 'deleted';
  expiry_date?: string | null;
  created_by: number;
  location_id?: number;
  deleted: boolean;
  created_at: string;
  updated_at: string;
  pivot?: {
    customer_id: number;
    gift_card_id: number;
    purchased_at?: string;
    redeemed_at?: string;
  };
}

export interface GiftCardFilters {
  status?: string;
  type?: 'fixed' | 'percentage';
  search?: string;
  location_id?: number;
  sort_by?: 'code' | 'initial_value' | 'balance' | 'created_at';
  sort_order?: 'asc' | 'desc';
  per_page?: number;
  page?: number;
}

export interface GiftCardPagination {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  from: number | null;
  to: number | null;
}

export interface GiftCardsResponse {
  success: boolean;
  data: {
    gift_cards: CustomerGiftCard[];
    pagination: GiftCardPagination;
  };
}

export interface SingleGiftCardResponse {
  success: boolean;
  data: CustomerGiftCard;
  message?: string;
}

export interface ValidateCodeResponse {
  success: boolean;
  data: {
    valid: boolean;
    gift_card?: CustomerGiftCard;
    message?: string;
  };
}

// ── Service ────────────────────────────────────────────────────────────

class CustomerGiftCardService {
  /**
   * Get all available (active) gift cards — the "browse" tab
   */
  async getAvailableGiftCards(filters?: GiftCardFilters): Promise<GiftCardsResponse> {
    const params: Record<string, unknown> = { status: 'active', ...filters };
    const response = await api.get('/gift-cards', { params });
    return response.data;
  }

  /**
   * Get gift cards owned by the current customer — "My Gift Cards" tab.
   * Requires backend to support `customer_id` filter or a dedicated endpoint.
   */
  async getMyGiftCards(filters?: GiftCardFilters): Promise<GiftCardsResponse> {
    const customerId = getCustomerId();
    const params: Record<string, unknown> = { customer_id: customerId, ...filters };
    const response = await api.get('/gift-cards', { params });
    return response.data;
  }

  /**
   * Get a single gift card by ID
   */
  async getGiftCard(id: number): Promise<SingleGiftCardResponse> {
    const response = await api.get(`/gift-cards/${id}`);
    return response.data;
  }

  /**
   * Validate a gift card by code
   */
  async validateCode(code: string): Promise<ValidateCodeResponse> {
    const response = await api.post('/gift-cards/validate-code', { code });
    return response.data;
  }

  /**
   * Redeem a gift card
   */
  async redeemGiftCard(
    id: number,
    amount: number,
    bookingId?: number
  ): Promise<SingleGiftCardResponse> {
    const response = await api.post(`/gift-cards/${id}/redeem`, {
      amount,
      booking_id: bookingId,
    });
    return response.data;
  }
}

export const customerGiftCardService = new CustomerGiftCardService();
export default customerGiftCardService;
