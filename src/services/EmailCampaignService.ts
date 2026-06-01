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


export const getEmailTemplates = async (
  filters?: EmailTemplateFilters
): Promise<PaginatedEmailTemplatesResponse> => {
  const response = await api.get<PaginatedEmailTemplatesResponse>('/email-templates', {
    params: filters,
  });
  return response.data;
};

export const getEmailTemplate = async (
  id: number
): Promise<EmailTemplateApiResponse<EmailTemplate>> => {
  const response = await api.get<EmailTemplateApiResponse<EmailTemplate>>(
    `/email-templates/${id}`
  );
  return response.data;
};

export const createEmailTemplate = async (
  data: CreateEmailTemplateData
): Promise<EmailTemplateApiResponse<EmailTemplate>> => {
  const response = await api.post<EmailTemplateApiResponse<EmailTemplate>>(
    '/email-templates',
    data
  );
  return response.data;
};

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

export const deleteEmailTemplate = async (
  id: number
): Promise<EmailTemplateApiResponse> => {
  const response = await api.delete<EmailTemplateApiResponse>(
    `/email-templates/${id}`
  );
  return response.data;
};

export const duplicateEmailTemplate = async (
  id: number
): Promise<EmailTemplateApiResponse<EmailTemplate>> => {
  const response = await api.post<EmailTemplateApiResponse<EmailTemplate>>(
    `/email-templates/${id}/duplicate`
  );
  return response.data;
};

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

export const getEmailTemplateVariables = async (): Promise<EmailTemplateVariablesResponse> => {
  const response = await api.get<EmailTemplateVariablesResponse>(
    '/email-templates/variables'
  );
  return response.data;
};

export const previewEmailTemplate = async (
  id: number
): Promise<PreviewTemplateResponse> => {
  const response = await api.get<PreviewTemplateResponse>(
    `/email-templates/${id}/preview`
  );
  return response.data;
};

export const previewCustomContent = async (
  data: PreviewTemplateRequest
): Promise<PreviewTemplateResponse> => {
  const response = await api.post<PreviewTemplateResponse>(
    '/email-templates/preview',
    data
  );
  return response.data;
};


export const getEmailCampaigns = async (
  filters?: EmailCampaignFilters
): Promise<PaginatedEmailCampaignsResponse> => {
  const response = await api.get<PaginatedEmailCampaignsResponse>('/email-campaigns', {
    params: filters,
  });
  return response.data;
};

export const getEmailCampaign = async (
  id: number
): Promise<EmailCampaignApiResponse<EmailCampaign>> => {
  const response = await api.get<EmailCampaignApiResponse<EmailCampaign>>(
    `/email-campaigns/${id}`
  );
  return response.data;
};

export const createEmailCampaign = async (
  data: CreateEmailCampaignData
): Promise<EmailCampaignApiResponse<EmailCampaign>> => {
  const formData = new FormData();
  
  formData.append('name', data.name);
  formData.append('subject', data.subject);
  formData.append('body', data.body);
  
  data.recipient_types.forEach((type, index) => {
    formData.append(`recipient_types[${index}]`, type);
  });
  
  if (data.custom_emails && data.custom_emails.length > 0) {
    data.custom_emails.forEach((email, index) => {
      formData.append(`custom_emails[${index}]`, email);
    });
  }
  
  if (data.recipient_filters) {
    Object.entries(data.recipient_filters).forEach(([key, value]) => {
      if (value !== undefined) {
        formData.append(`recipient_filters[${key}]`, String(value));
      }
    });
  }
  
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

export const cancelEmailCampaign = async (
  id: number
): Promise<EmailCampaignApiResponse<EmailCampaign>> => {
  const response = await api.post<EmailCampaignApiResponse<EmailCampaign>>(
    `/email-campaigns/${id}/cancel`
  );
  return response.data;
};

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

export const deleteEmailCampaign = async (
  id: number
): Promise<EmailCampaignApiResponse> => {
  const response = await api.delete<EmailCampaignApiResponse>(
    `/email-campaigns/${id}`
  );
  return response.data;
};

export const previewRecipients = async (
  data: PreviewRecipientsRequest
): Promise<PreviewRecipientsResponse> => {
  const response = await api.post<PreviewRecipientsResponse>(
    '/email-campaigns/preview-recipients',
    data
  );
  return response.data;
};

export const sendTestEmail = async (
  data: SendTestEmailRequest
): Promise<EmailCampaignApiResponse> => {
  const response = await api.post<EmailCampaignApiResponse>(
    '/email-campaigns/send-test',
    data
  );
  return response.data;
};

export const getEmailCampaignStatistics = async (
  filters?: EmailCampaignStatisticsFilters
): Promise<{ success: boolean; data: EmailCampaignStatistics }> => {
  const response = await api.get<{ success: boolean; data: EmailCampaignStatistics }>(
    '/email-campaigns/statistics',
    { params: filters }
  );
  return response.data;
};

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

export const emailCampaignService = {
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
  
  getCampaigns: getEmailCampaigns,
  getCampaign: getEmailCampaign,
  createCampaign: createEmailCampaign,
  cancelCampaign: cancelEmailCampaign,
  resendCampaign: resendEmailCampaign,
  deleteCampaign: deleteEmailCampaign,
  previewRecipients: previewRecipients,
  sendTestEmail: sendTestEmail,
  getStatistics: getEmailCampaignStatistics,
  
  uploadImage: uploadEmailImage,
};

export default emailCampaignService;
