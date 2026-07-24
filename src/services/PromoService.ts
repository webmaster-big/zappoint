import axios from 'axios';
import { API_BASE_URL, getStoredUser } from '../utils/storage';
import type { GenerateBulkPayload, GenerateBulkResponseData, PromoBatch, BatchDetailResponse, BatchDetailFilters } from '../types/Promo.types';

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

export interface Promo {
  id: number;
  code: string;
  code_mode: 'single' | 'unique';
  batch_id: string | null;
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
  creator?: { id: number; first_name: string; last_name: string };
  location_ids?: number[] | null;
  package_ids?: number[] | null;
  attraction_ids?: number[] | null;
  event_ids?: number[] | null;
}

export interface PromoFilters {
  status?: 'active' | 'inactive' | 'expired' | 'exhausted';
  type?: 'fixed' | 'percentage';
  location_id?: number;
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
  location_ids?: number[] | null;
  package_ids?: number[] | null;
  attraction_ids?: number[] | null;
  event_ids?: number[] | null;
}

export type UpdatePromoData = Partial<CreatePromoData>;

export interface DiscountValidationContextItem {
  type: 'package' | 'attraction' | 'event';
  id: number;
}

export interface DiscountValidationContext {
  location_id?: number | null;
  subtotal?: number;
  items?: DiscountValidationContextItem[];
  customer_id?: number | null;
}

export interface CodeValidationResult {
  success: boolean;
  message?: string;
  data: {
    is_valid: boolean;
    discount_amount?: number;
    discount_type?: 'fixed' | 'percentage';
    eligible_subtotal?: number;
    applied_discount?: Record<string, unknown> | null;
    promo?: Promo | null;
  };
}

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
  async getPromos(filters?: PromoFilters): Promise<PaginatedResponse<Promo>> {
    const response = await api.get('/promos', { params: filters });
    return response.data;
  }

  async getPromo(id: number): Promise<ApiResponse<Promo>> {
    const response = await api.get(`/promos/${id}`);
    return response.data;
  }

  async createPromo(data: CreatePromoData): Promise<ApiResponse<Promo>> {
    const response = await api.post('/promos', data);
    return response.data;
  }

  async updatePromo(id: number, data: UpdatePromoData): Promise<ApiResponse<Promo>> {
    const response = await api.patch(`/promos/${id}`, data);
    return response.data;
  }

  async deletePromo(id: number): Promise<ApiResponse<null>> {
    const response = await api.delete(`/promos/${id}`);
    return response.data;
  }

  async togglePromoStatus(id: number): Promise<ApiResponse<Promo>> {
    const response = await api.patch(`/promos/${id}/toggle-status`);
    return response.data;
  }

  async validateCode(code: string, context: DiscountValidationContext = {}): Promise<CodeValidationResult> {
    const response = await api.post('/promos/validate-code', { code, ...context });
    return response.data;
  }


  async generateBulkCodes(data: GenerateBulkPayload): Promise<ApiResponse<GenerateBulkResponseData>> {
    const response = await api.post('/promos/generate-bulk', data);
    return response.data;
  }

  async getBatches(): Promise<{ success: boolean; data: PromoBatch[] }> {
    const response = await api.get('/promos/batches');
    return response.data;
  }

  async getBatchDetail(batchId: string, filters?: BatchDetailFilters): Promise<{ success: boolean; data: BatchDetailResponse }> {
    const response = await api.get(`/promos/batches/${batchId}`, { params: filters });
    return response.data;
  }

  async exportBatchCsv(batchId: string): Promise<Blob> {
    const response = await api.get(`/promos/batches/${batchId}/export-csv`, {
      responseType: 'blob',
    });
    return response.data;
  }

  async deactivateBatch(batchId: string): Promise<ApiResponse<{ deactivated_count: number }>> {
    const response = await api.patch(`/promos/batches/${batchId}/deactivate`);
    return response.data;
  }

  async deleteBatch(batchId: string): Promise<ApiResponse<{ deleted_count: number }>> {
    const response = await api.delete(`/promos/batches/${batchId}`);
    return response.data;
  }
}

export const promoService = new PromoService();
export default promoService;
