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
export type ActivityCategory = 'create' | 'update' | 'delete' | 'view' | 'login' | 'logout' | 'export' | 'import' | 'other';

export interface ActivityLogPayload {
  user_id?: number | null;
  location_id?: number | null;
  action: string;
  category: ActivityCategory;
  entity_type?: string | null;
  entity_id?: number | null;
  description: string;
  ip_address?: string | null;
  user_agent?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface ActivityLog {
  id: number;
  user_id: number | null;
  location_id: number | null;
  action: string;
  category: ActivityCategory;
  entity_type: string | null;
  entity_id: number | null;
  description: string;
  ip_address: string | null;
  user_agent: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  user?: {
    id: number;
    name: string;
  };
  location?: {
    id: number;
    name: string;
  };
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

class ActivityLogService {
  /**
   * Create a new activity log
   */
  async log(payload: ActivityLogPayload): Promise<ApiResponse<ActivityLog>> {
    try {
      const response = await api.post('/activity-logs', payload);
      return response.data;
    } catch (error) {
      console.error('Error creating activity log:', error);
      throw error;
    }
  }

  /**
   * Log a customer update
   */
  async logCustomerUpdate(
    userId: number | null,
    contactId: number,
    contactName: string,
    field: string,
    oldValue: string | null,
    newValue: string | null
  ): Promise<void> {
    try {
      await this.log({
        user_id: userId,
        action: `Updated customer ${field}`,
        category: 'update',
        entity_type: 'contact',
        entity_id: contactId,
        description: `Updated ${field} for customer "${contactName}" from "${oldValue || 'empty'}" to "${newValue || 'empty'}"`,
        metadata: {
          field,
          old_value: oldValue,
          new_value: newValue,
        },
      });
    } catch (error) {
      // Don't throw - logging should not break the main flow
      console.error('Failed to log customer update:', error);
    }
  }

  /**
   * Log a customer creation
   */
  async logCustomerCreate(
    userId: number | null,
    contactId: number,
    contactName: string,
    contactEmail: string
  ): Promise<void> {
    try {
      await this.log({
        user_id: userId,
        action: 'Created new customer',
        category: 'create',
        entity_type: 'contact',
        entity_id: contactId,
        description: `Created new customer "${contactName}" (${contactEmail})`,
        metadata: {
          contact_name: contactName,
          contact_email: contactEmail,
        },
      });
    } catch (error) {
      console.error('Failed to log customer creation:', error);
    }
  }

  /**
   * Log a customer deletion
   */
  async logCustomerDelete(
    userId: number | null,
    contactId: number,
    contactName: string
  ): Promise<void> {
    try {
      await this.log({
        user_id: userId,
        action: 'Deleted customer',
        category: 'delete',
        entity_type: 'contact',
        entity_id: contactId,
        description: `Deleted customer "${contactName}"`,
        metadata: {
          contact_name: contactName,
        },
      });
    } catch (error) {
      console.error('Failed to log customer deletion:', error);
    }
  }

  /**
   * Log a customer export
   */
  async logCustomerExport(
    userId: number | null,
    count: number,
    filters?: Record<string, unknown>
  ): Promise<void> {
    try {
      await this.log({
        user_id: userId,
        action: 'Exported customers',
        category: 'export',
        entity_type: 'contact',
        description: `Exported ${count} customers to CSV`,
        metadata: {
          count,
          filters,
        },
      });
    } catch (error) {
      console.error('Failed to log customer export:', error);
    }
  }
}

export const activityLogService = new ActivityLogService();
export default activityLogService;
