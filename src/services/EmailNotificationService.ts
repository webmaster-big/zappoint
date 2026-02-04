// src/services/EmailNotificationService.ts
import axios from 'axios';
import { API_BASE_URL, getStoredUser } from '../utils/storage';
import type {
  EmailNotification,
  EmailNotificationFilters,
  CreateEmailNotificationData,
  UpdateEmailNotificationData,
  SendTestEmailData,
  PaginatedEmailNotificationsResponse,
  PaginatedEmailNotificationLogsResponse,
  EmailNotificationApiResponse,
  TriggerTypesResponse,
  VariablesResponse,
  EntityTypesResponse,
  RecipientTypesResponse,
  EntitiesResponse,
  EntityType,
} from '../types/EmailNotification.types';

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

const BASE_URL = '/email-notifications';

// =============================================================================
// EMAIL NOTIFICATIONS CRUD
// =============================================================================

/**
 * Get all email notifications with optional filters
 * @param filters - Optional filters (location_id, trigger_type, is_active, search, per_page, page)
 * @returns Paginated list of email notifications
 */
export const getEmailNotifications = async (
  filters?: EmailNotificationFilters
): Promise<PaginatedEmailNotificationsResponse> => {
  const response = await api.get<PaginatedEmailNotificationsResponse>(BASE_URL, {
    params: filters,
  });
  return response.data;
};

/**
 * Get a single email notification by ID
 * @param id - Email notification ID
 * @returns Email notification details
 */
export const getEmailNotification = async (
  id: number
): Promise<EmailNotificationApiResponse<EmailNotification>> => {
  const response = await api.get<EmailNotificationApiResponse<EmailNotification>>(
    `${BASE_URL}/${id}`
  );
  return response.data;
};

/**
 * Create a new email notification
 * @param data - Email notification creation data
 * @returns Created email notification
 */
export const createEmailNotification = async (
  data: CreateEmailNotificationData
): Promise<EmailNotificationApiResponse<EmailNotification>> => {
  const response = await api.post<EmailNotificationApiResponse<EmailNotification>>(
    BASE_URL,
    data
  );
  return response.data;
};

/**
 * Update an existing email notification
 * @param id - Email notification ID
 * @param data - Update data
 * @returns Updated email notification
 */
export const updateEmailNotification = async (
  id: number,
  data: UpdateEmailNotificationData
): Promise<EmailNotificationApiResponse<EmailNotification>> => {
  const response = await api.put<EmailNotificationApiResponse<EmailNotification>>(
    `${BASE_URL}/${id}`,
    data
  );
  return response.data;
};

/**
 * Delete an email notification
 * @param id - Email notification ID
 * @returns Success response
 */
export const deleteEmailNotification = async (
  id: number
): Promise<EmailNotificationApiResponse<null>> => {
  const response = await api.delete<EmailNotificationApiResponse<null>>(
    `${BASE_URL}/${id}`
  );
  return response.data;
};

// =============================================================================
// UTILITY ENDPOINTS
// =============================================================================

/**
 * Get all available trigger types (categorized)
 * @returns Trigger types grouped by category
 */
export const getTriggerTypes = async (): Promise<TriggerTypesResponse> => {
  const response = await api.get<TriggerTypesResponse>(`${BASE_URL}/trigger-types`);
  return response.data;
};

/**
 * Get all entity types
 * @returns Entity types (all, package, attraction)
 */
export const getEntityTypes = async (): Promise<EntityTypesResponse> => {
  const response = await api.get<EntityTypesResponse>(`${BASE_URL}/entity-types`);
  return response.data;
};

/**
 * Get all recipient types
 * @returns Recipient types (customer, staff, company_admin, location_manager, custom)
 */
export const getRecipientTypes = async (): Promise<RecipientTypesResponse> => {
  const response = await api.get<RecipientTypesResponse>(`${BASE_URL}/recipient-types`);
  return response.data;
};

/**
 * Get available template variables for a trigger type
 * @param triggerType - The trigger type to get variables for
 * @returns Variables grouped by category (specific and common)
 */
export const getVariables = async (
  triggerType: string
): Promise<VariablesResponse> => {
  const response = await api.get<VariablesResponse>(`${BASE_URL}/variables`, {
    params: { trigger_type: triggerType },
  });
  return response.data;
};

/**
 * Get entities (packages or attractions) for selection
 * @param entityType - 'package' or 'attraction'
 * @param locationId - Optional location ID filter
 * @returns List of entities
 */
export const getEntities = async (
  entityType: EntityType,
  locationId?: number
): Promise<EntitiesResponse> => {
  const response = await api.get<EntitiesResponse>(`${BASE_URL}/entities`, {
    params: { entity_type: entityType, location_id: locationId },
  });
  return response.data;
};

/**
 * Toggle notification active/inactive status
 * @param id - Email notification ID
 * @returns Updated email notification
 */
export const toggleNotificationStatus = async (
  id: number
): Promise<EmailNotificationApiResponse<EmailNotification>> => {
  const response = await api.patch<EmailNotificationApiResponse<EmailNotification>>(
    `${BASE_URL}/${id}/toggle-status`
  );
  return response.data;
};

/**
 * Duplicate an email notification
 * @param id - Email notification ID to duplicate
 * @returns New duplicated email notification
 */
export const duplicateNotification = async (
  id: number
): Promise<EmailNotificationApiResponse<EmailNotification>> => {
  const response = await api.post<EmailNotificationApiResponse<EmailNotification>>(
    `${BASE_URL}/${id}/duplicate`
  );
  return response.data;
};

/**
 * Send a test email for a notification
 * @param id - Email notification ID
 * @param data - Test email data (test_email, optional real data IDs)
 * @returns Success response
 */
export const sendTestEmail = async (
  id: number,
  data: SendTestEmailData
): Promise<EmailNotificationApiResponse<{ message: string }>> => {
  const response = await api.post<EmailNotificationApiResponse<{ message: string }>>(
    `${BASE_URL}/${id}/send-test`,
    data
  );
  return response.data;
};

// =============================================================================
// NOTIFICATION LOGS
// =============================================================================

/**
 * Get notification logs for an email notification
 * @param id - Email notification ID
 * @param params - Pagination params
 * @returns Paginated list of logs
 */
export const getNotificationLogs = async (
  id: number,
  params?: { page?: number; per_page?: number }
): Promise<PaginatedEmailNotificationLogsResponse> => {
  const response = await api.get<PaginatedEmailNotificationLogsResponse>(
    `${BASE_URL}/${id}/logs`,
    { params }
  );
  return response.data;
};

/**
 * Resend a failed notification log
 * @param notificationId - Email notification ID
 * @param logId - Log ID to resend
 * @returns Success response
 */
export const resendNotificationLog = async (
  notificationId: number,
  logId: number
): Promise<EmailNotificationApiResponse<{ message: string }>> => {
  const response = await api.post<EmailNotificationApiResponse<{ message: string }>>(
    `${BASE_URL}/${notificationId}/logs/${logId}/resend`
  );
  return response.data;
};

// =============================================================================
// SERVICE EXPORT
// =============================================================================

export const emailNotificationService = {
  // CRUD
  getAll: getEmailNotifications,
  getById: getEmailNotification,
  create: createEmailNotification,
  update: updateEmailNotification,
  delete: deleteEmailNotification,
  
  // Utility
  getTriggerTypes,
  getEntityTypes,
  getRecipientTypes,
  getVariables,
  getEntities,
  toggleStatus: toggleNotificationStatus,
  duplicate: duplicateNotification,
  sendTestEmail,
  
  // Logs
  getLogs: getNotificationLogs,
  resendLog: resendNotificationLog,
};

export default emailNotificationService;
