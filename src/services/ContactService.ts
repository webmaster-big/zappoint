// src/services/ContactService.ts
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

// Contact type matching backend
export interface Contact {
  id: number;
  company_id: number;
  location_id: number | null;
  email: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  company_name: string | null;
  job_title: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  country: string | null;
  tags: string[] | null;
  source: string | null;
  notes: string | null;
  status: 'active' | 'inactive';
  created_by: number | null;
  created_at: string;
  updated_at: string;
  // Computed/Accessor fields from Laravel model
  full_name?: string;
  full_address?: string | null;
  // Relationships
  company?: {
    id: number;
    name: string;
  };
  location?: {
    id: number;
    name: string;
  };
  creator?: {
    id: number;
    name: string;
  };
}

export interface ContactFilters {
  company_id?: number;
  location_id?: number;
  user_id?: number;
  status?: 'active' | 'inactive';
  tag?: string;
  tags?: string[];
  source?: string;
  active_only?: boolean;
  search?: string;
  sort_by?: 'email' | 'first_name' | 'last_name' | 'company_name' | 'created_at' | 'status';
  sort_order?: 'asc' | 'desc';
  page?: number;
  per_page?: number;
}

export interface ContactCreateData {
  company_id: number;
  location_id?: number;
  email: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  company_name?: string;
  job_title?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  tags?: string[];
  source?: string;
  notes?: string;
  status?: 'active' | 'inactive';
}

export interface ContactUpdateData {
  location_id?: number;
  email?: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  company_name?: string;
  job_title?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  tags?: string[];
  source?: string;
  notes?: string;
  status?: 'active' | 'inactive';
}

export interface BulkImportData {
  company_id: number;
  location_id?: number;
  contacts: Array<{
    email: string;
    first_name?: string;
    last_name?: string;
    phone?: string;
    company_name?: string;
    tags?: string[];
  }>;
  tags?: string[];
  source?: string;
  skip_duplicates?: boolean;
}

export interface BulkUpdateData {
  ids: number[];
  action: 'add_tags' | 'remove_tags' | 'set_status' | 'set_location';
  tags?: string[];
  status?: 'active' | 'inactive';
  location_id?: number;
}

export interface ContactStatistics {
  total: number;
  active: number;
  inactive: number;
  by_source: Record<string, number>;
  recently_added: number;
}

export interface ContactListResponse {
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

export interface ContactResponse {
  success: boolean;
  message?: string;
  data: Contact;
}

export interface BulkImportResponse {
  success: boolean;
  message: string;
  data: {
    imported: number;
    skipped: number;
    errors: Array<{
      row: number;
      email: string;
      error: string;
    }>;
  };
}

export interface BulkDeleteResponse {
  success: boolean;
  message: string;
  data: {
    deleted_count: number;
  };
}

export interface BulkUpdateResponse {
  success: boolean;
  message: string;
  data: {
    updated_count: number;
  };
}

export interface TagsResponse {
  success: boolean;
  data: string[];
}

export interface StatisticsResponse {
  success: boolean;
  data: ContactStatistics;
}

export interface ExportForCampaignData {
  company_id: number;
  location_id?: number;
  tags?: string[];
  status?: 'active' | 'inactive';
  active_only?: boolean;
}

export interface ExportForCampaignResponse {
  success: boolean;
  data: {
    count: number;
    contacts: Array<{
      id: number;
      email: string;
      name: string;
      first_name: string | null;
      last_name: string | null;
      variables: Record<string, string>;
    }>;
  };
}

class ContactService {
  private baseUrl = '/contacts';

  /**
   * Get paginated list of contacts with filtering
   */
  async getContacts(filters: ContactFilters = {}): Promise<ContactListResponse> {
    const params = new URLSearchParams();
    
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        if (Array.isArray(value)) {
          params.append(key, value.join(','));
        } else {
          params.append(key, String(value));
        }
      }
    });

    const response = await api.get(`${this.baseUrl}?${params.toString()}`);
    return response.data;
  }

  /**
   * Get a single contact by ID
   */
  async getContact(id: number): Promise<ContactResponse> {
    const response = await api.get(`${this.baseUrl}/${id}`);
    return response.data;
  }

  /**
   * Create a new contact
   */
  async createContact(data: ContactCreateData): Promise<ContactResponse> {
    const response = await api.post(this.baseUrl, data);
    return response.data;
  }

  /**
   * Update an existing contact
   */
  async updateContact(id: number, data: ContactUpdateData): Promise<ContactResponse> {
    const response = await api.put(`${this.baseUrl}/${id}`, data);
    return response.data;
  }

  /**
   * Delete a contact
   */
  async deleteContact(id: number): Promise<{ success: boolean; message: string }> {
    const response = await api.delete(`${this.baseUrl}/${id}`);
    return response.data;
  }

  /**
   * Bulk import contacts
   */
  async bulkImport(data: BulkImportData): Promise<BulkImportResponse> {
    const response = await api.post(`${this.baseUrl}/bulk-import`, data);
    return response.data;
  }

  /**
   * Bulk delete contacts
   */
  async bulkDelete(ids: number[]): Promise<BulkDeleteResponse> {
    const response = await api.post(`${this.baseUrl}/bulk-delete`, { ids });
    return response.data;
  }

  /**
   * Bulk update contacts (add/remove tags, change status, set location)
   */
  async bulkUpdate(data: BulkUpdateData): Promise<BulkUpdateResponse> {
    const response = await api.post(`${this.baseUrl}/bulk-update`, data);
    return response.data;
  }

  /**
   * Get all unique tags
   */
  async getTags(filters: { company_id?: number; location_id?: number } = {}): Promise<TagsResponse> {
    const params = new URLSearchParams();
    
    if (filters.company_id) params.append('company_id', String(filters.company_id));
    if (filters.location_id) params.append('location_id', String(filters.location_id));

    const response = await api.get(`${this.baseUrl}/tags?${params.toString()}`);
    return response.data;
  }

  /**
   * Get contact statistics
   */
  async getStatistics(filters: { company_id?: number; location_id?: number } = {}): Promise<StatisticsResponse> {
    const params = new URLSearchParams();
    
    if (filters.company_id) params.append('company_id', String(filters.company_id));
    if (filters.location_id) params.append('location_id', String(filters.location_id));

    const response = await api.get(`${this.baseUrl}/statistics?${params.toString()}`);
    return response.data;
  }

  /**
   * Export contacts for email campaign
   */
  async exportForCampaign(data: ExportForCampaignData): Promise<ExportForCampaignResponse> {
    const response = await api.post(`${this.baseUrl}/export-for-campaign`, data);
    return response.data;
  }

  /**
   * Add a tag to a contact
   */
  async addTag(contactId: number, tag: string): Promise<ContactResponse> {
    const response = await api.post(`${this.baseUrl}/${contactId}/add-tag`, { tag });
    return response.data;
  }

  /**
   * Remove a tag from a contact
   */
  async removeTag(contactId: number, tag: string): Promise<ContactResponse> {
    const response = await api.post(`${this.baseUrl}/${contactId}/remove-tag`, { tag });
    return response.data;
  }
}

export const contactService = new ContactService();
export default contactService;
