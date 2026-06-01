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
  PreviewEmailNotificationData,
  PreviewEmailNotificationResponse,
  ResetDefaultResponse,
} from '../types/EmailNotification.types';

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

const BASE_URL = '/email-notifications';


export const getEmailNotifications = async (
  filters?: EmailNotificationFilters
): Promise<PaginatedEmailNotificationsResponse> => {
  const response = await api.get<PaginatedEmailNotificationsResponse>(BASE_URL, {
    params: filters,
  });
  return response.data;
};

export const getEmailNotification = async (
  id: number
): Promise<EmailNotificationApiResponse<EmailNotification>> => {
  const response = await api.get<EmailNotificationApiResponse<EmailNotification>>(
    `${BASE_URL}/${id}`
  );
  return response.data;
};

export const createEmailNotification = async (
  data: CreateEmailNotificationData
): Promise<EmailNotificationApiResponse<EmailNotification>> => {
  const response = await api.post<EmailNotificationApiResponse<EmailNotification>>(
    BASE_URL,
    data
  );
  return response.data;
};

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

export const deleteEmailNotification = async (
  id: number
): Promise<EmailNotificationApiResponse<null>> => {
  const response = await api.delete<EmailNotificationApiResponse<null>>(
    `${BASE_URL}/${id}`
  );
  return response.data;
};

export const previewEmailNotification = async (
  id: number,
  data?: PreviewEmailNotificationData
): Promise<PreviewEmailNotificationResponse> => {
  const response = await api.post<PreviewEmailNotificationResponse>(
    `${BASE_URL}/${id}/preview`,
    data ?? {}
  );
  return response.data;
};

export const resetDefaultNotification = async (
  id: number
): Promise<ResetDefaultResponse> => {
  const response = await api.post<ResetDefaultResponse>(
    `${BASE_URL}/${id}/reset-default`
  );
  return response.data;
};

export const getDefaultEmailNotifications = async (
  filters?: EmailNotificationFilters
): Promise<PaginatedEmailNotificationsResponse> => {
  const response = await api.get<PaginatedEmailNotificationsResponse>(
    `${BASE_URL}/defaults`,
    { params: filters }
  );
  return response.data;
};

export const seedDefaultNotifications = async (): Promise<
  EmailNotificationApiResponse<{ created: number }>
> => {
  const response = await api.post<EmailNotificationApiResponse<{ created: number }>>(
    `${BASE_URL}/seed-defaults`
  );
  return response.data;
};

export const getDefaultKeys = async (): Promise<
  EmailNotificationApiResponse<Record<string, string>>
> => {
  const response = await api.get<EmailNotificationApiResponse<Record<string, string>>>(
    `${BASE_URL}/default-keys`
  );
  return response.data;
};


export const getTriggerTypes = async (): Promise<TriggerTypesResponse> => {
  const response = await api.get<TriggerTypesResponse>(`${BASE_URL}/trigger-types`);
  return response.data;
};

export const getEntityTypes = async (): Promise<EntityTypesResponse> => {
  const response = await api.get<EntityTypesResponse>(`${BASE_URL}/entity-types`);
  return response.data;
};

export const getRecipientTypes = async (): Promise<RecipientTypesResponse> => {
  const response = await api.get<RecipientTypesResponse>(`${BASE_URL}/recipient-types`);
  return response.data;
};

export const getVariables = async (
  triggerType: string
): Promise<VariablesResponse> => {
  const response = await api.get<VariablesResponse>(`${BASE_URL}/variables`, {
    params: { trigger_type: triggerType },
  });
  return response.data;
};

export const getEntities = async (
  entityType: EntityType,
  locationId?: number
): Promise<EntitiesResponse> => {
  const response = await api.get<EntitiesResponse>(`${BASE_URL}/entities`, {
    params: { entity_type: entityType, location_id: locationId },
  });
  return response.data;
};

export const toggleNotificationStatus = async (
  id: number
): Promise<EmailNotificationApiResponse<EmailNotification>> => {
  const response = await api.patch<EmailNotificationApiResponse<EmailNotification>>(
    `${BASE_URL}/${id}/toggle-status`
  );
  return response.data;
};

export const duplicateNotification = async (
  id: number
): Promise<EmailNotificationApiResponse<EmailNotification>> => {
  const response = await api.post<EmailNotificationApiResponse<EmailNotification>>(
    `${BASE_URL}/${id}/duplicate`
  );
  return response.data;
};

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

export const resendNotificationLog = async (
  notificationId: number,
  logId: number
): Promise<EmailNotificationApiResponse<{ message: string }>> => {
  const response = await api.post<EmailNotificationApiResponse<{ message: string }>>(
    `${BASE_URL}/${notificationId}/logs/${logId}/resend`
  );
  return response.data;
};


export const emailNotificationService = {
  getAll: getEmailNotifications,
  getById: getEmailNotification,
  create: createEmailNotification,
  update: updateEmailNotification,
  delete: deleteEmailNotification,
  preview: previewEmailNotification,
  resetDefault: resetDefaultNotification,
  getDefaults: getDefaultEmailNotifications,
  seedDefaults: seedDefaultNotifications,
  getDefaultKeys,
  
  getTriggerTypes,
  getEntityTypes,
  getRecipientTypes,
  getVariables,
  getEntities,
  toggleStatus: toggleNotificationStatus,
  duplicate: duplicateNotification,
  sendTestEmail,
  
  getLogs: getNotificationLogs,
  resendLog: resendNotificationLog,
};

export default emailNotificationService;
