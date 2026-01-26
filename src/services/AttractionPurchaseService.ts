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
export interface AttractionPurchase {
  id: number;
  attraction_id: number;
  customer_id?: number;
  location_id?: number;
  guest_name?: string;
  guest_email?: string;
  guest_phone?: string;
  quantity: number;
  total_amount: number;
  payment_method: 'card' | 'in-store' | 'paylater';
  status: 'pending' | 'completed' | 'cancelled';
  purchase_date: string;
  notes?: string;
  created_by?: number;
  created_at: string;
  updated_at: string;
  attraction?: {
    id: number;
    name: string;
    price: number;
    pricing_type: string;
  };
  customer?: {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
  };
}

export interface CreatePurchaseData {
  attraction_id: number;
  customer_id?: number;
  guest_name?: string;
  guest_email?: string;
  guest_phone?: string;
  quantity: number;
  payment_method: 'card' | 'in-store' | 'paylater';
  purchase_date: string;
  notes?: string;
  // Optional fields for payment tracking
  amount?: number;
  amount_paid?: number;
  currency?: string;
  method?: string;
  status?: 'pending' | 'completed' | 'cancelled';
  payment_id?: string;
  location_id?: number;
}

export interface UpdatePurchaseData extends Partial<CreatePurchaseData> {
  status?: 'pending' | 'completed' | 'cancelled';
}

export interface PurchaseFilters {
  attraction_id?: number;
  customer_id?: number;
  status?: string;
  payment_method?: string;
  start_date?: string;
  end_date?: string;
  search?: string;
  sort_by?: 'purchase_date' | 'total_amount' | 'quantity' | 'status' | 'created_at';
  sort_order?: 'asc' | 'desc';
  per_page?: number;
  page?: number;
  user_id?: number;
  location_id?: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: {
    purchases: T[];
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

export interface PurchaseStatistics {
  total_purchases: number;
  total_revenue: number;
  pending_purchases: number;
  completed_purchases: number;
  cancelled_purchases: number;
  total_quantity_sold: number;
  by_payment_method: Array<{
    payment_method: string;
    count: number;
    revenue: number;
  }>;
  top_attractions: Array<{
    attraction_id: number;
    purchase_count: number;
    total_quantity: number;
    total_revenue: number;
    attraction?: {
      id: number;
      name: string;
    };
  }>;
}

class AttractionPurchaseService {
  /**
   * Get all attraction purchases with optional filters
   */
  async getPurchases(filters?: PurchaseFilters): Promise<PaginatedResponse<AttractionPurchase>> {
    const response = await api.get('/attraction-purchases', { params: filters });
    return response.data;
  }

  /**
   * Get a specific purchase by ID
   */
  async getPurchase(id: number): Promise<ApiResponse<AttractionPurchase>> {
    const response = await api.get(`/attraction-purchases/${id}`);
    return response.data;
  }

  /**
   * Alias for getPurchase - Get a specific purchase by ID
   */
  async getPurchaseById(id: number): Promise<ApiResponse<AttractionPurchase>> {
    return this.getPurchase(id);
  }

  /**
   * Create a new attraction purchase
   */
  async createPurchase(data: CreatePurchaseData): Promise<ApiResponse<AttractionPurchase>> {
    const response = await api.post('/attraction-purchases', data);
    return response.data;
  }

  /**
   * Update an existing purchase
   */
  async updatePurchase(id: number, data: UpdatePurchaseData): Promise<ApiResponse<AttractionPurchase>> {
    const response = await api.put(`/attraction-purchases/${id}`, data);
    return response.data;
  }

  /**
   * Delete a purchase
   */
  async deletePurchase(id: number): Promise<ApiResponse<null>> {
    const response = await api.delete(`/attraction-purchases/${id}`);
    return response.data;
  }

  /**
   * Mark purchase as completed
   */
  async markAsCompleted(id: number): Promise<ApiResponse<AttractionPurchase>> {
    const response = await api.patch(`/attraction-purchases/${id}/complete`);
    return response.data;
  }

  /**
   * Cancel a purchase
   */
  async cancelPurchase(id: number): Promise<ApiResponse<AttractionPurchase>> {
    const response = await api.patch(`/attraction-purchases/${id}/cancel`);
    return response.data;
  }

  /**
   * Get purchase statistics
   */
  async getStatistics(filters?: { start_date?: string; end_date?: string }): Promise<ApiResponse<PurchaseStatistics>> {
    const response = await api.get('/attraction-purchases/statistics', { params: filters });
    return response.data;
  }

  /**
   * Get purchases by customer
   */
  async getPurchasesByCustomer(customerId: number): Promise<ApiResponse<AttractionPurchase[]>> {
    const response = await api.get(`/attraction-purchases/customer/${customerId}`);
    return response.data;
  }

  /**
   * Get purchases by attraction
   */
  async getPurchasesByAttraction(attractionId: number): Promise<ApiResponse<AttractionPurchase[]>> {
    const response = await api.get(`/attraction-purchases/attraction/${attractionId}`);
    return response.data;
  }

  /**
   * Send receipt email with QR code
   * Backend determines recipient email from purchase record (customer email or guest_email)
   */
  async sendReceipt(id: number, qrCode: string, sendEmail: boolean = true): Promise<ApiResponse<{ email_sent_to: string }>> {
    const response = await api.post(`/attraction-purchases/${id}/qrcode`, {
      qr_code: qrCode,
      send_email: sendEmail,
    });
    return response.data;
  }

  /**
   * Check-in / Mark purchase as used by scanning QR code
   */
  async checkInPurchase(id: number): Promise<ApiResponse<AttractionPurchase>> {
    const response = await api.patch(`/attraction-purchases/${id}/check-in`);
    return response.data;
  }

  /**
   * Verify purchase by QR code data
   */
  async verifyPurchase(purchaseId: number): Promise<ApiResponse<AttractionPurchase>> {
    const user = getStoredUser();
    const params = user?.id ? { user_id: user.id } : {};
    const response = await api.get(`/attraction-purchases/${purchaseId}/verify`, { params });
    return response.data;
  }

  /**
   * Bulk delete attraction purchases
   */
  async bulkDelete(ids: number[]): Promise<ApiResponse<null>> {
    const response = await api.post('/attraction-purchases/bulk-delete', { ids });
    return response.data;
  }
}

// Export a singleton instance
export const attractionPurchaseService = new AttractionPurchaseService();
export default attractionPurchaseService;
