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
export interface Contact {
  id: number;
  location_id: number | null;
  name: string;
  email: string;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  country: string | null;
  source: 'booking' | 'attraction_purchase' | 'manual';
  total_bookings: number;
  total_purchases: number;
  total_spent: number;
  last_activity_at: string | null;
  status: 'active' | 'inactive';
  notes: string | null;
  created_at: string;
  updated_at: string;
  location?: {
    id: number;
    name: string;
  };
}

export interface ContactListFilters {
  user_id?: number;
  location_id?: number;
  status?: string | string[];
  source?: string;
  search?: string;
  start_date?: string;
  end_date?: string;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
  per_page?: number;
  page?: number;
}

export interface ContactCreatePayload {
  location_id?: number | null;
  name: string;
  email: string;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  country?: string | null;
  source?: 'booking' | 'attraction_purchase' | 'manual';
  status?: 'active' | 'inactive';
  notes?: string | null;
}

export interface ContactUpdatePayload {
  location_id?: number | null;
  name?: string;
  email?: string;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  country?: string | null;
  source?: 'booking' | 'attraction_purchase' | 'manual';
  status?: 'active' | 'inactive';
  notes?: string | null;
}

export interface PaginatedResponse {
  success: boolean;
  data: {
    contacts: Contact[];
    pagination: {
      current_page: number;
      last_page: number;
      per_page: number;
      total: number;
      from: number | null;
      to: number | null;
    };
  };
}

export interface ContactStatistics {
  total_contacts: number;
  active_contacts: number;
  inactive_contacts: number;
  from_bookings: number;
  from_purchases: number;
  from_manual: number;
  total_bookings: number;
  total_purchases: number;
  total_revenue: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

class ContactService {
  /**
   * Fetch paginated list of contacts
   */
  async fetchContacts(filters: ContactListFilters = {}): Promise<PaginatedResponse> {
    try {
      const params = new URLSearchParams();
      
      if (filters.user_id) params.append('user_id', filters.user_id.toString());
      if (filters.location_id) params.append('location_id', filters.location_id.toString());
      if (filters.status) {
        if (Array.isArray(filters.status)) {
          filters.status.forEach(s => params.append('status[]', s));
        } else {
          params.append('status', filters.status);
        }
      }
      if (filters.source) params.append('source', filters.source);
      if (filters.search) params.append('search', filters.search);
      if (filters.start_date) params.append('start_date', filters.start_date);
      if (filters.end_date) params.append('end_date', filters.end_date);
      if (filters.sort_by) params.append('sort_by', filters.sort_by);
      if (filters.sort_order) params.append('sort_order', filters.sort_order);
      if (filters.per_page) params.append('per_page', filters.per_page.toString());
      if (filters.page) params.append('page', filters.page.toString());

      const response = await api.get(`/contacts?${params.toString()}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching contacts:', error);
      throw error;
    }
  }

  /**
   * Get a single contact by ID
   */
  async getContact(id: number): Promise<ApiResponse<Contact>> {
    try {
      const response = await api.get(`/contacts/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching contact:', error);
      throw error;
    }
  }

  /**
   * Create a new contact
   */
  async createContact(payload: ContactCreatePayload): Promise<ApiResponse<Contact>> {
    try {
      const response = await api.post('/contacts', payload);
      return response.data;
    } catch (error) {
      console.error('Error creating contact:', error);
      throw error;
    }
  }

  /**
   * Update an existing contact
   */
  async updateContact(id: number, payload: ContactUpdatePayload): Promise<ApiResponse<Contact>> {
    try {
      const response = await api.put(`/contacts/${id}`, payload);
      return response.data;
    } catch (error) {
      console.error('Error updating contact:', error);
      throw error;
    }
  }

  /**
   * Delete a contact
   */
  async deleteContact(id: number): Promise<ApiResponse<null>> {
    try {
      const response = await api.delete(`/contacts/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error deleting contact:', error);
      throw error;
    }
  }

  /**
   * Toggle contact status (active/inactive)
   */
  async toggleStatus(id: number): Promise<ApiResponse<Contact>> {
    try {
      const response = await api.patch(`/contacts/${id}/toggle-status`);
      return response.data;
    } catch (error) {
      console.error('Error toggling contact status:', error);
      throw error;
    }
  }

  /**
   * Bulk delete contacts
   */
  async bulkDelete(ids: number[]): Promise<ApiResponse<null>> {
    try {
      const response = await api.post('/contacts/bulk-delete', { ids });
      return response.data;
    } catch (error) {
      console.error('Error bulk deleting contacts:', error);
      throw error;
    }
  }

  /**
   * Find contact by email
   */
  async findByEmail(email: string): Promise<ApiResponse<Contact>> {
    try {
      const response = await api.post('/contacts/find-by-email', { email });
      return response.data;
    } catch (error) {
      console.error('Error finding contact by email:', error);
      throw error;
    }
  }

  /**
   * Get contact statistics
   */
  async getStatistics(filters: { user_id?: number; location_id?: number } = {}): Promise<ApiResponse<ContactStatistics>> {
    try {
      const params = new URLSearchParams();
      if (filters.user_id) params.append('user_id', filters.user_id.toString());
      if (filters.location_id) params.append('location_id', filters.location_id.toString());

      const response = await api.get(`/contacts/statistics?${params.toString()}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching contact statistics:', error);
      throw error;
    }
  }

  /**
   * Export contacts
   */
  async exportContacts(filters: ContactListFilters = {}): Promise<ApiResponse<{ contacts: Contact[]; total: number }>> {
    try {
      const params = new URLSearchParams();
      
      if (filters.user_id) params.append('user_id', filters.user_id.toString());
      if (filters.location_id) params.append('location_id', filters.location_id.toString());
      if (filters.status) {
        if (Array.isArray(filters.status)) {
          filters.status.forEach(s => params.append('status[]', s));
        } else {
          params.append('status', filters.status);
        }
      }
      if (filters.source) params.append('source', filters.source);
      if (filters.search) params.append('search', filters.search);

      const response = await api.get(`/contacts/export?${params.toString()}`);
      return response.data;
    } catch (error) {
      console.error('Error exporting contacts:', error);
      throw error;
    }
  }
}

export const contactService = new ContactService();
export default contactService;
