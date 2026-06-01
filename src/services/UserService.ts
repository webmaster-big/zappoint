import axios from 'axios';
import { API_BASE_URL, getStoredUser } from '../utils/storage';

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

export interface CreateStaffAccountData {
  first_name: string;
  last_name: string;
  email: string;
  role: 'location_manager' | 'attendant' | 'company_admin';
  location_id?: number | null;
  phone?: string;
  employee_id?: string;
  department?: string;
  position?: string;
  shift?: string;
  assigned_areas?: string[];
  hire_date?: string; // YYYY-MM-DD
  status?: 'active' | 'inactive';
  password_mode?: 'custom' | 'generate';
  password?: string;
  send_email?: boolean;
  return_password?: boolean;
  login_url?: string;
}

export interface StaffAccountResult {
  user: User & {
    first_name?: string;
    last_name?: string;
    company?: { id: number; company_name: string };
    location?: { id: number; name: string };
  };
  email_sent: boolean;
  email_error: string | null;
  generated_password?: string;
}

export interface ResendCredentialsData {
  password_mode?: 'custom' | 'generate';
  password?: string;
  send_email?: boolean;
  return_password?: boolean;
  login_url?: string;
}

class UserService {
  async getUsers(filters?: UserFilters): Promise<ApiResponse<{ users: User[]; total: number }>> {
    const response = await api.get('/users', { params: filters });
    return response.data;
  }

  async getUser(id: number): Promise<ApiResponse<User>> {
    const response = await api.get(`/users/${id}`);
    return response.data;
  }

  async createUser(data: Partial<User>): Promise<ApiResponse<User>> {
    const response = await api.post('/users', data);
    return response.data;
  }

  async updateUser(id: number, data: Partial<User>): Promise<ApiResponse<User>> {
    const response = await api.put(`/users/${id}`, data);
    return response.data;
  }

  async deleteUser(id: number): Promise<ApiResponse<null>> {
    const response = await api.delete(`/users/${id}`);
    return response.data;
  }

  async toggleStatus(id: number): Promise<ApiResponse<User>> {
    const response = await api.patch(`/users/${id}/toggle-status`);
    return response.data;
  }

  async bulkDelete(ids: number[]): Promise<ApiResponse<null>> {
    const response = await api.post('/users/bulk-delete', { ids });
    return response.data;
  }

  async createStaff(data: CreateStaffAccountData): Promise<ApiResponse<StaffAccountResult>> {
    const response = await api.post('/users/staff', data);
    return response.data;
  }

  async resendCredentials(
    userId: number,
    data: ResendCredentialsData = { password_mode: 'generate', send_email: true },
  ): Promise<ApiResponse<Omit<StaffAccountResult, 'generated_password'> & { generated_password?: string }>> {
    const response = await api.post(`/users/${userId}/resend-credentials`, data);
    return response.data;
  }
}

export const userService = new UserService();
export default userService;
