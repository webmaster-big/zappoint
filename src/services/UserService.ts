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

// ---- Direct staff-account creation (POST /api/users/staff) ----------------
// See BACKEND_PROMPT_DIRECT_ACCOUNT_PROVISIONING.md (Section 4).
// `company_id` is forced from the bearer token and must NOT be sent.
export interface CreateStaffAccountData {
  first_name: string;
  last_name: string;
  email: string;
  role: 'location_manager' | 'attendant' | 'company_admin';
  /** Required when role is location_manager or attendant. */
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
  /** Required when password_mode = 'custom'. Min 8 chars. */
  password?: string;
  send_email?: boolean;
  /** When true the response includes the plain password — use only over HTTPS. */
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

  /**
   * Create a staff account directly (company_admin only).
   * Backend endpoint: POST /api/users/staff
   *
   * The backend forces `company_id` from the auth token, validates the
   * `location_id` belongs to the caller's company, hashes the password,
   * and (by default) emails the credentials to the new user.
   *
   * Pass `return_password: true` to receive the plain password in the
   * response so the admin UI can show it once. Treat that field as
   * sensitive — do not log it.
   */
  async createStaff(data: CreateStaffAccountData): Promise<ApiResponse<StaffAccountResult>> {
    const response = await api.post('/users/staff', data);
    return response.data;
  }

  /**
   * Reset and re-email a staff user's credentials (company_admin only).
   * Backend endpoint: POST /api/users/{user}/resend-credentials
   */
  async resendCredentials(
    userId: number,
    data: ResendCredentialsData = { password_mode: 'generate', send_email: true },
  ): Promise<ApiResponse<Omit<StaffAccountResult, 'generated_password'> & { generated_password?: string }>> {
    const response = await api.post(`/users/${userId}/resend-credentials`, data);
    return response.data;
  }
}

// Export a singleton instance
export const userService = new UserService();
export default userService;
