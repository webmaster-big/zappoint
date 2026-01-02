// src/services/EmailCampaignService.ts
import axios from 'axios';
import { API_BASE_URL, getStoredUser } from '../utils/storage';
import type {
  EmailTemplate,
  EmailTemplateFilters,
  CreateEmailTemplateData,
  UpdateEmailTemplateData,
  EmailTemplateApiResponse,
  PaginatedEmailTemplatesResponse,
  EmailTemplateVariablesResponse,
  PreviewTemplateRequest,
  PreviewTemplateResponse,
  EmailCampaign,
  EmailCampaignFilters,
  CreateEmailCampaignData,
  EmailCampaignApiResponse,
  PaginatedEmailCampaignsResponse,
  PreviewRecipientsRequest,
  PreviewRecipientsResponse,
  SendTestEmailRequest,
  EmailCampaignStatistics,
  EmailCampaignStatisticsFilters,
  EmailTemplateStatus,
  ImageUploadResponse,
} from '../types/EmailCampaign.types';

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

// =============================================================================
// EMAIL TEMPLATES API
// =============================================================================

/**
 * Get all email templates with optional filters
 * @param filters - Optional filters (location_id, status, category, search, per_page, page)
 * @returns Paginated list of email templates
 */
export const getEmailTemplates = async (
  filters?: EmailTemplateFilters
): Promise<PaginatedEmailTemplatesResponse> => {
  const response = await api.get<PaginatedEmailTemplatesResponse>('/email-templates', {
    params: filters,
  });
  return response.data;
};

/**
 * Get a single email template by ID
 * @param id - Email template ID
 * @returns Email template details
 */
export const getEmailTemplate = async (
  id: number
): Promise<EmailTemplateApiResponse<EmailTemplate>> => {
  const response = await api.get<EmailTemplateApiResponse<EmailTemplate>>(
    `/email-templates/${id}`
  );
  return response.data;
};

/**
 * Create a new email template
 * @param data - Email template creation data
 * @returns Created email template
 */
export const createEmailTemplate = async (
  data: CreateEmailTemplateData
): Promise<EmailTemplateApiResponse<EmailTemplate>> => {
  const response = await api.post<EmailTemplateApiResponse<EmailTemplate>>(
    '/email-templates',
    data
  );
  return response.data;
};

/**
 * Update an existing email template
 * @param id - Email template ID
 * @param data - Update data
 * @returns Updated email template
 */
export const updateEmailTemplate = async (
  id: number,
  data: UpdateEmailTemplateData
): Promise<EmailTemplateApiResponse<EmailTemplate>> => {
  const response = await api.put<EmailTemplateApiResponse<EmailTemplate>>(
    `/email-templates/${id}`,
    data
  );
  return response.data;
};

/**
 * Delete an email template
 * @param id - Email template ID
 * @returns Success response
 */
export const deleteEmailTemplate = async (
  id: number
): Promise<EmailTemplateApiResponse> => {
  const response = await api.delete<EmailTemplateApiResponse>(
    `/email-templates/${id}`
  );
  return response.data;
};

/**
 * Duplicate an email template
 * Creates a copy with "(Copy)" appended to the name
 * @param id - Email template ID to duplicate
 * @returns Duplicated email template
 */
export const duplicateEmailTemplate = async (
  id: number
): Promise<EmailTemplateApiResponse<EmailTemplate>> => {
  const response = await api.post<EmailTemplateApiResponse<EmailTemplate>>(
    `/email-templates/${id}/duplicate`
  );
  return response.data;
};

/**
 * Update email template status
 * @param id - Email template ID
 * @param status - New status (draft, active, archived)
 * @returns Updated email template
 */
export const updateEmailTemplateStatus = async (
  id: number,
  status: EmailTemplateStatus
): Promise<EmailTemplateApiResponse<EmailTemplate>> => {
  const response = await api.patch<EmailTemplateApiResponse<EmailTemplate>>(
    `/email-templates/${id}/status`,
    { status }
  );
  return response.data;
};

/**
 * Get all available template variables
 * @returns Variables grouped by category (default, customer, user)
 */
export const getEmailTemplateVariables = async (): Promise<EmailTemplateVariablesResponse> => {
  const response = await api.get<EmailTemplateVariablesResponse>(
    '/email-templates/variables'
  );
  return response.data;
};

/**
 * Preview a template with sample data
 * @param id - Email template ID
 * @returns Template with sample data replacing variables
 */
export const previewEmailTemplate = async (
  id: number
): Promise<PreviewTemplateResponse> => {
  const response = await api.get<PreviewTemplateResponse>(
    `/email-templates/${id}/preview`
  );
  return response.data;
};

/**
 * Preview custom content with sample data
 * @param data - Subject and body to preview
 * @returns Content with sample data replacing variables
 */
export const previewCustomContent = async (
  data: PreviewTemplateRequest
): Promise<PreviewTemplateResponse> => {
  const response = await api.post<PreviewTemplateResponse>(
    '/email-templates/preview',
    data
  );
  return response.data;
};

// =============================================================================
// EMAIL CAMPAIGNS API
// =============================================================================

/**
 * Get all email campaigns with optional filters
 * @param filters - Optional filters (location_id, status, search, per_page, page)
 * @returns Paginated list of email campaigns
 */
export const getEmailCampaigns = async (
  filters?: EmailCampaignFilters
): Promise<PaginatedEmailCampaignsResponse> => {
  const response = await api.get<PaginatedEmailCampaignsResponse>('/email-campaigns', {
    params: filters,
  });
  return response.data;
};

/**
 * Get a single email campaign by ID
 * @param id - Email campaign ID
 * @returns Email campaign details with statistics and logs
 */
export const getEmailCampaign = async (
  id: number
): Promise<EmailCampaignApiResponse<EmailCampaign>> => {
  const response = await api.get<EmailCampaignApiResponse<EmailCampaign>>(
    `/email-campaigns/${id}`
  );
  return response.data;
};

/**
 * Create and optionally send an email campaign
 * Uses FormData to support file attachments
 * @param data - Email campaign creation data (may include attachments)
 * @returns Created email campaign
 */
export const createEmailCampaign = async (
  data: CreateEmailCampaignData
): Promise<EmailCampaignApiResponse<EmailCampaign>> => {
  // Use FormData to support file attachments
  const formData = new FormData();
  
  // Add basic fields
  formData.append('name', data.name);
  formData.append('subject', data.subject);
  formData.append('body', data.body);
  
  // Add recipient_types as individual array items
  data.recipient_types.forEach((type, index) => {
    formData.append(`recipient_types[${index}]`, type);
  });
  
  // Add custom_emails if present
  if (data.custom_emails && data.custom_emails.length > 0) {
    data.custom_emails.forEach((email, index) => {
      formData.append(`custom_emails[${index}]`, email);
    });
  }
  
  // Add recipient_filters if present
  if (data.recipient_filters) {
    Object.entries(data.recipient_filters).forEach(([key, value]) => {
      if (value !== undefined) {
        formData.append(`recipient_filters[${key}]`, String(value));
      }
    });
  }
  
  // Add optional fields
  if (data.email_template_id) {
    formData.append('email_template_id', String(data.email_template_id));
  }
  if (data.send_now !== undefined) {
    formData.append('send_now', data.send_now ? '1' : '0');
  }
  if (data.scheduled_at) {
    formData.append('scheduled_at', data.scheduled_at);
  }
  if (data.location_id) {
    formData.append('location_id', String(data.location_id));
  }
  
  // Add attachments if present
  if (data.attachments && data.attachments.length > 0) {
    data.attachments.forEach((file, index) => {
      formData.append(`attachments[${index}]`, file);
    });
  }
  
  const response = await api.post<EmailCampaignApiResponse<EmailCampaign>>(
    '/email-campaigns',
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }
  );
  return response.data;
};

/**
 * Cancel a pending or sending campaign
 * @param id - Email campaign ID
 * @returns Updated email campaign
 */
export const cancelEmailCampaign = async (
  id: number
): Promise<EmailCampaignApiResponse<EmailCampaign>> => {
  const response = await api.post<EmailCampaignApiResponse<EmailCampaign>>(
    `/email-campaigns/${id}/cancel`
  );
  return response.data;
};

/**
 * Resend an email campaign
 * @param id - Email campaign ID
 * @param type - 'failed' (resend to failed recipients only) or 'all' (resend to all)
 * @returns Updated email campaign
 */
export const resendEmailCampaign = async (
  id: number,
  type: 'failed' | 'all' = 'failed'
): Promise<EmailCampaignApiResponse<EmailCampaign>> => {
  const response = await api.post<EmailCampaignApiResponse<EmailCampaign>>(
    `/email-campaigns/${id}/resend`,
    { type }
  );
  return response.data;
};

/**
 * Delete an email campaign
 * @param id - Email campaign ID
 * @returns Success response
 */
export const deleteEmailCampaign = async (
  id: number
): Promise<EmailCampaignApiResponse> => {
  const response = await api.delete<EmailCampaignApiResponse>(
    `/email-campaigns/${id}`
  );
  return response.data;
};

/**
 * Preview recipients before sending
 * @param data - Recipient types, filters, and custom emails
 * @returns Total recipients count and breakdown by type
 */
export const previewRecipients = async (
  data: PreviewRecipientsRequest
): Promise<PreviewRecipientsResponse> => {
  const response = await api.post<PreviewRecipientsResponse>(
    '/email-campaigns/preview-recipients',
    data
  );
  return response.data;
};

/**
 * Send a test email
 * @param data - Subject, body, and test email address
 * @returns Success response
 */
export const sendTestEmail = async (
  data: SendTestEmailRequest
): Promise<EmailCampaignApiResponse> => {
  const response = await api.post<EmailCampaignApiResponse>(
    '/email-campaigns/send-test',
    data
  );
  return response.data;
};

/**
 * Get email campaign statistics
 * @param filters - Optional filters (location_id, start_date, end_date)
 * @returns Campaign statistics
 */
export const getEmailCampaignStatistics = async (
  filters?: EmailCampaignStatisticsFilters
): Promise<{ success: boolean; data: EmailCampaignStatistics }> => {
  const response = await api.get<{ success: boolean; data: EmailCampaignStatistics }>(
    '/email-campaigns/statistics',
    { params: filters }
  );
  return response.data;
};

/**
 * Upload an image for use in email body
 * Returns a public URL that can be embedded with an <img> tag
 * @param image - Image file to upload (PNG, JPG, JPEG, GIF, WebP, max 5MB)
 * @returns Upload response with URL
 */
export const uploadEmailImage = async (
  image: File
): Promise<ImageUploadResponse> => {
  const formData = new FormData();
  formData.append('image', image);
  
  const response = await api.post<ImageUploadResponse>(
    '/email-campaigns/upload-image',
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }
  );
  return response.data;
};

// Export as a service object for consistency with other services
export const emailCampaignService = {
  // Templates
  getTemplates: getEmailTemplates,
  getTemplate: getEmailTemplate,
  createTemplate: createEmailTemplate,
  updateTemplate: updateEmailTemplate,
  deleteTemplate: deleteEmailTemplate,
  duplicateTemplate: duplicateEmailTemplate,
  updateTemplateStatus: updateEmailTemplateStatus,
  getTemplateVariables: getEmailTemplateVariables,
  previewTemplate: previewEmailTemplate,
  previewContent: previewCustomContent,
  
  // Campaigns
  getCampaigns: getEmailCampaigns,
  getCampaign: getEmailCampaign,
  createCampaign: createEmailCampaign,
  cancelCampaign: cancelEmailCampaign,
  resendCampaign: resendEmailCampaign,
  deleteCampaign: deleteEmailCampaign,
  previewRecipients: previewRecipients,
  sendTestEmail: sendTestEmail,
  getStatistics: getEmailCampaignStatistics,
  
  // Image Upload
  uploadImage: uploadEmailImage,
};

export default emailCampaignService;
