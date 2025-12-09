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
export interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  status: string;
  location_id?: number;
  company_id?: number;
  created_at: string;
  updated_at: string;
}

export interface UserFilters {
  role?: string;
  status?: string;
  location_id?: number;
  company_id?: number;
  search?: string;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
  per_page?: number;
  page?: number;
}

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
}

class UserService {
  /**
   * Get all users with filters
   */
  async getUsers(filters?: UserFilters): Promise<ApiResponse<{ users: User[]; total: number }>> {
    const response = await api.get('/users', { params: filters });
    return response.data;
  }

  /**
   * Get a single user by ID
   */
  async getUser(id: number): Promise<ApiResponse<User>> {
    const response = await api.get(`/users/${id}`);
    return response.data;
  }

  /**
   * Create a new user
   */
  async createUser(data: Partial<User>): Promise<ApiResponse<User>> {
    const response = await api.post('/users', data);
    return response.data;
  }

  /**
   * Update a user
   */
  async updateUser(id: number, data: Partial<User>): Promise<ApiResponse<User>> {
    const response = await api.put(`/users/${id}`, data);
    return response.data;
  }

  /**
   * Delete a user
   */
  async deleteUser(id: number): Promise<ApiResponse<null>> {
    const response = await api.delete(`/users/${id}`);
    return response.data;
  }

  /**
   * Toggle user status (active/inactive)
   */
  async toggleStatus(id: number): Promise<ApiResponse<User>> {
    const response = await api.patch(`/users/${id}/toggle-status`);
    return response.data;
  }

  /**
   * Bulk delete users
   */
  async bulkDelete(ids: number[]): Promise<ApiResponse<null>> {
    const response = await api.post('/users/bulk-delete', { ids });
    return response.data;
  }
}

// Export a singleton instance
export const userService = new UserService();
export default userService;
