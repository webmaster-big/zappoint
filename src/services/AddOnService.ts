import axios from 'axios';
import { API_BASE_URL, getStoredUser } from '../utils/storage';

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
export interface PackageSpecificPrice {
  package_id: number;
  price: number;
  minimum_quantity: number;
}

export interface AddOn {
  id: number;
  location_id?: number;
  name: string;
  price: number | null;
  description?: string;
  image?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  location?: string;
  min_quantity?: number;
  max_quantity?: number;
  is_force_add_on?: boolean;
  price_each_packages?: PackageSpecificPrice[] | null;
}

export interface AddOnFilters {
  location_id?: number;
  is_active?: boolean;
  search?: string;
  sort_by?: 'name' | 'price' | 'created_at';
  sort_order?: 'asc' | 'desc';
  per_page?: number;
  page?: number;
  user_id?: number;
}

export interface CreateAddOnData {
  location_id?: number;
  name: string;
  price?: number | null;
  description?: string;
  image?: string;
  is_active?: boolean;
  min_quantity?: number;
  max_quantity?: number;
  is_force_add_on?: boolean;
  price_each_packages?: PackageSpecificPrice[] | null;
}

export type UpdateAddOnData = Partial<CreateAddOnData>;

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: {
    add_ons: T[];
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

class AddOnService {
  /**
   * Get all addons with optional filters
   */
  async getAddOns(filters?: AddOnFilters): Promise<PaginatedResponse<AddOn>> {
    const response = await api.get('/addons', { params: filters });
    return response.data;
  }

  /**
   * Get a specific add-on by ID
   */
  async getAddOn(id: number): Promise<ApiResponse<AddOn>> {
    const response = await api.get(`/addons/${id}`);
    return response.data;
  }

  /**
   * Create a new add-on
   */
  async createAddOn(data: CreateAddOnData): Promise<ApiResponse<AddOn>> {
    const response = await api.post('/addons', data);
    return response.data;
  }

  /**
   * Create a new add-on with image (using FormData)
   */
  async createAddOnWithImage(formData: FormData): Promise<ApiResponse<AddOn>> {
    const token = getStoredUser()?.token;
    const response = await api.post('/addons', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
        'Authorization': `Bearer ${token}`,
      },
    });
    return response.data;
  }

  /**
   * Update an existing add-on
   */
  async updateAddOn(id: number, data: UpdateAddOnData): Promise<ApiResponse<AddOn>> {
    const response = await api.put(`/addons/${id}`, data);
    return response.data;
  }

  /**
   * Update an existing add-on with image (using FormData)
   */
  async updateAddOnWithImage(id: number, formData: FormData): Promise<ApiResponse<AddOn>> {
    const token = getStoredUser()?.token;
    // Laravel doesn't support PUT with FormData, so we use POST with _method override
    formData.append('_method', 'PUT');
    const response = await api.post(`/addons/${id}`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
        'Authorization': `Bearer ${token}`,
      },
    });
    return response.data;
  }

  /**
   * Delete an add-on
   */
  async deleteAddOn(id: number): Promise<ApiResponse<null>> {
    const response = await api.delete(`/addons/${id}`);
    return response.data;
  }

  /**
   * Bulk delete add-ons
   */
  async bulkDelete(ids: number[]): Promise<ApiResponse<null>> {
    const response = await api.post('/addons/bulk-delete', { ids });
    return response.data;
  }

  /**
   * Bulk import add-ons
   */
  async bulkImport(addOns: Array<{
    location_id?: number;
    name: string;
    price: number;
    description?: string;
    image?: string;
    is_active?: boolean;
    min_quantity?: number;
    max_quantity?: number;
  }>): Promise<ApiResponse<{ imported: AddOn[]; imported_count: number; failed_count: number }>> {
    const response = await api.post('/addons/bulk-import', { add_ons: addOns });
    return response.data;
  }
}

// Export a singleton instance
export const addOnService = new AddOnService();
export default addOnService;
