import axios from 'axios';
import { API_BASE_URL, getStoredUser } from '../utils/storage';
import type {
  EventPurchase,
  CreateEventPurchaseData,
  UpdateEventPurchaseData,
  EventPurchaseFilters,
} from '../types/event.types';

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
  (error) => Promise.reject(error)
);

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

class EventPurchaseService {
  private _createInFlight = false;
  private _lastCreateKey = '';
  private _lastCreateTime = 0;

  /** List all event purchases (admin) */
  async getPurchases(filters?: EventPurchaseFilters): Promise<ApiResponse<EventPurchase[]>> {
    const response = await api.get('/event-purchases', { params: filters });
    return response.data;
  }

  /** Get a single purchase */
  async getPurchase(id: number): Promise<ApiResponse<EventPurchase>> {
    const response = await api.get(`/event-purchases/${id}`);
    return response.data;
  }

  /** Create a new event purchase (with dedup guard) */
  async createPurchase(data: CreateEventPurchaseData): Promise<ApiResponse<EventPurchase>> {
    const dedupKey = `${data.event_id}-${data.guest_email || data.customer_id || ''}-${data.quantity}-${data.purchase_date}-${data.purchase_time}`;
    const now = Date.now();

    if (this._createInFlight && dedupKey === this._lastCreateKey) {
      throw new Error('Purchase is already being processed. Please wait.');
    }
    if (dedupKey === this._lastCreateKey && now - this._lastCreateTime < 5000) {
      throw new Error('A similar purchase was just created. Please wait a moment before trying again.');
    }

    this._createInFlight = true;
    this._lastCreateKey = dedupKey;
    try {
      const response = await api.post('/event-purchases', data);
      this._lastCreateTime = Date.now();
      return response.data;
    } finally {
      this._createInFlight = false;
    }
  }

  /** Update a purchase */
  async updatePurchase(id: number, data: UpdateEventPurchaseData): Promise<ApiResponse<EventPurchase>> {
    const response = await api.put(`/event-purchases/${id}`, data);
    return response.data;
  }

  /** Delete a purchase (soft delete) */
  async deletePurchase(id: number): Promise<ApiResponse<null>> {
    const response = await api.delete(`/event-purchases/${id}`);
    return response.data;
  }

  /** Cancel a purchase */
  async cancelPurchase(id: number): Promise<ApiResponse<EventPurchase>> {
    const response = await api.patch(`/event-purchases/${id}/cancel`);
    return response.data;
  }

  /** Update purchase status */
  async updateStatus(id: number, status: string): Promise<ApiResponse<EventPurchase>> {
    const response = await api.patch(`/event-purchases/${id}/status`, { status });
    return response.data;
  }

  /** Get customer's event purchases (public) */
  async getCustomerPurchases(customerId: number, filters?: Record<string, unknown>): Promise<ApiResponse<EventPurchase[]>> {
    const response = await api.get('/event-purchases/customer', { params: { customer_id: customerId, ...filters } });
    return response.data;
  }

  /** Get customer's event purchases by email (public, no auth required) */
  async getCustomerPurchasesByEmail(email: string, filters?: Record<string, unknown>): Promise<{ success: boolean; data: { purchases: EventPurchase[]; pagination: { current_page: number; last_page: number; per_page: number; total: number } } }> {
    const response = await api.get('/event-purchases/customer', { params: { guest_email: email, ...filters } });
    return response.data;
  }
}

export const eventPurchaseService = new EventPurchaseService();
export default eventPurchaseService;
