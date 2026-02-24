import axios from 'axios';
import { API_BASE_URL } from '../utils/storage';

// Helper to get customer token from localStorage
const getCustomerToken = (): string | null => {
  try {
    const stored = localStorage.getItem('zapzone_customer');
    if (stored) {
      const customer = JSON.parse(stored);
      return customer?.token || null;
    }
  } catch {
    // ignore parse errors
  }
  return null;
};

// Helper to get customer ID from localStorage
const getCustomerId = (): number | null => {
  try {
    const stored = localStorage.getItem('zapzone_customer');
    if (stored) {
      const customer = JSON.parse(stored);
      return customer?.id || customer?.user?.id || null;
    }
  } catch {
    // ignore parse errors
  }
  return null;
};

// Authenticated axios instance (customer token)
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = getCustomerToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Types ──────────────────────────────────────────────────────────────

export type CustomerNotificationType =
  | 'booking'
  | 'payment'
  | 'promotion'
  | 'gift_card'
  | 'reminder'
  | 'general'
  | 'attraction';

export type CustomerNotificationStatus = 'unread' | 'read' | 'archived';
export type CustomerNotificationPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface CustomerNotification {
  id: number;
  customer_id: number;
  location_id?: number | null;
  type: CustomerNotificationType;
  title: string;
  message: string;
  data?: Record<string, unknown> | null;
  priority: CustomerNotificationPriority;
  read_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface NotificationFilters {
  customer_id?: number;
  type?: CustomerNotificationType;
  is_read?: boolean;
  priority?: CustomerNotificationPriority;
  per_page?: number;
  page?: number;
}

export interface NotificationPagination {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  from: number | null;
  to: number | null;
}

export interface NotificationsResponse {
  success: boolean;
  data: {
    notifications: CustomerNotification[];
    pagination: NotificationPagination;
  };
}

export interface SingleNotificationResponse {
  success: boolean;
  data: CustomerNotification;
  message?: string;
}

export interface UnreadCountResponse {
  success: boolean;
  data: {
    unread_count: number;
  };
}

// ── Service ────────────────────────────────────────────────────────────

class CustomerNotificationService {
  /**
   * Get notifications for the current customer (with optional filters & pagination)
   */
  async getNotifications(filters?: NotificationFilters): Promise<NotificationsResponse> {
    const customerId = filters?.customer_id ?? getCustomerId();
    const params: Record<string, unknown> = { ...filters };
    if (customerId) params.customer_id = customerId;

    const response = await api.get('/customer-notifications', { params });
    return response.data;
  }

  /**
   * Get a single notification by ID
   */
  async getNotification(id: number): Promise<SingleNotificationResponse> {
    const response = await api.get(`/customer-notifications/${id}`);
    return response.data;
  }

  /**
   * Mark a single notification as read
   */
  async markAsRead(id: number): Promise<SingleNotificationResponse> {
    const response = await api.patch(`/customer-notifications/${id}/mark-as-read`);
    return response.data;
  }

  /**
   * Mark all notifications as read for the current customer
   */
  async markAllAsRead(customerId?: number): Promise<{ success: boolean; message: string }> {
    const id = customerId ?? getCustomerId();
    const response = await api.patch(`/customer-notifications/mark-all-as-read/${id}`);
    return response.data;
  }

  /**
   * Delete a notification
   */
  async deleteNotification(id: number): Promise<{ success: boolean; message: string }> {
    const response = await api.delete(`/customer-notifications/${id}`);
    return response.data;
  }

  /**
   * Get unread count for the current customer
   */
  async getUnreadCount(customerId?: number): Promise<UnreadCountResponse> {
    const id = customerId ?? getCustomerId();
    const response = await api.get(`/customer-notifications/unread-count/${id}`);
    return response.data;
  }
}

export const customerNotificationService = new CustomerNotificationService();
export default customerNotificationService;
