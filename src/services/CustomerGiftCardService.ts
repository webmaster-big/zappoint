import axios from 'axios';
import { API_BASE_URL } from '../utils/storage';

const getCustomerToken = (): string | null => {
  try {
    const stored = localStorage.getItem('zapzone_customer');
    if (stored) {
      const customer = JSON.parse(stored);
      return customer?.token || null;
    }
  } catch {
  }
  return null;
};

const getCustomerId = (): number | null => {
  try {
    const stored = localStorage.getItem('zapzone_customer');
    if (stored) {
      const customer = JSON.parse(stored);
      return customer?.id || customer?.user?.id || null;
    }
  } catch {
  }
  return null;
};

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


class CustomerGiftCardService {
  async getAvailableGiftCards(filters?: GiftCardFilters): Promise<GiftCardsResponse> {
    const params: Record<string, unknown> = { status: 'active', ...filters };
    const response = await api.get('/gift-cards', { params });
    return response.data;
  }

  async getMyGiftCards(filters?: GiftCardFilters): Promise<GiftCardsResponse> {
    const customerId = getCustomerId();
    const params: Record<string, unknown> = { customer_id: customerId, ...filters };
    const response = await api.get('/gift-cards', { params });
    return response.data;
  }

  async getGiftCard(id: number): Promise<SingleGiftCardResponse> {
    const response = await api.get(`/gift-cards/${id}`);
    return response.data;
  }

  async validateCode(code: string): Promise<ValidateCodeResponse> {
    const response = await api.post('/gift-cards/validate-code', { code });
    return response.data;
  }

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
