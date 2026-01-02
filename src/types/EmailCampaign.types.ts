// src/types/EmailCampaign.types.ts

// Email Template Types
export interface EmailTemplate {
  id: number;
  name: string;
  subject: string;
  body: string;
  status: EmailTemplateStatus;
  category?: string;
  company_id: number;
  location_id?: number;
  created_by?: number;
  created_at: string;
  updated_at: string;
  company?: {
    id: number;
    company_name: string;
  };
  location?: {
    id: number;
    name: string;
    address?: string;
  };
  creator?: {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
  };
}

export type EmailTemplateStatus = 'draft' | 'active' | 'archived';

export interface CreateEmailTemplateData {
  name: string;
  subject: string;
  body: string;
  status?: EmailTemplateStatus;
  category?: string;
  location_id?: number;
}

export interface UpdateEmailTemplateData {
  name?: string;
  subject?: string;
  body?: string;
  status?: EmailTemplateStatus;
  category?: string;
  location_id?: number;
}

export interface EmailTemplateFilters {
  location_id?: number;
  status?: EmailTemplateStatus;
  category?: string;
  search?: string;
  per_page?: number;
  page?: number;
}

export interface EmailTemplateVariable {
  name: string;
  description: string;
}

export interface EmailTemplateVariablesResponse {
  success: boolean;
  data: {
    default: EmailTemplateVariable[];
    customer: EmailTemplateVariable[];
    user: EmailTemplateVariable[];
  };
}

export interface PreviewTemplateRequest {
  subject: string;
  body: string;
}

export interface PreviewTemplateResponse {
  success: boolean;
  data: {
    subject: string;
    body: string;
  };
}

// Email Campaign Types
export interface EmailCampaign {
  id: number;
  name: string;
  subject: string;
  body: string;
  recipient_types: RecipientType[];
  custom_emails?: string[];
  recipient_filters?: RecipientFilters;
  email_template_id?: number;
  total_recipients: number;
  sent_count: number;
  failed_count: number;
  status: EmailCampaignStatus;
  scheduled_at?: string;
  sent_at?: string;
  completed_at?: string;
  company_id: number;
  location_id?: number;
  created_by?: number;
  created_at: string;
  updated_at: string;
  company?: {
    id: number;
    company_name: string;
  };
  location?: {
    id: number;
    name: string;
  };
  creator?: {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
  };
  template?: EmailTemplate;
  logs?: EmailCampaignLog[];
}

export type EmailCampaignStatus = 'pending' | 'sending' | 'completed' | 'failed' | 'cancelled';

export type RecipientType = 'customers' | 'attendants' | 'company_admin' | 'location_managers' | 'custom';

export interface RecipientFilters {
  status?: string;
  location_id?: number;
  [key: string]: string | number | boolean | undefined;
}

export interface CreateEmailCampaignData {
  name: string;
  subject: string;
  body: string;
  recipient_types: RecipientType[];
  custom_emails?: string[];
  recipient_filters?: RecipientFilters;
  email_template_id?: number;
  send_now?: boolean;
  scheduled_at?: string;
  location_id?: number;
}

export interface EmailCampaignFilters {
  location_id?: number;
  status?: EmailCampaignStatus;
  search?: string;
  per_page?: number;
  page?: number;
}

export interface EmailCampaignLog {
  id: number;
  email_campaign_id: number;
  recipient_email: string;
  recipient_type: string;
  recipient_id?: number;
  status: 'pending' | 'sent' | 'failed';
  error_message?: string;
  sent_at?: string;
  created_at: string;
}

export interface PreviewRecipientsRequest {
  recipient_types: RecipientType[];
  recipient_filters?: RecipientFilters;
  custom_emails?: string[];
  location_id?: number;
}

export interface PreviewRecipientsResponse {
  success: boolean;
  data: {
    total_recipients: number;
    by_type: {
      [key: string]: number;
    };
    sample_recipients?: Array<{
      email: string;
      name: string;
      type: string;
    }>;
  };
}

export interface SendTestEmailRequest {
  subject: string;
  body: string;
  test_email: string;
}

export interface EmailCampaignStatistics {
  total_campaigns: number;
  total_emails_sent: number;
  total_emails_failed: number;
  success_rate: number;
  status_breakdown: {
    pending: number;
    sending: number;
    completed: number;
    failed: number;
    cancelled: number;
  };
  recent_campaigns: EmailCampaign[];
}

export interface EmailCampaignStatisticsFilters {
  location_id?: number;
  start_date?: string;
  end_date?: string;
}

// API Response Types
export interface EmailTemplateApiResponse<T = EmailTemplate> {
  success: boolean;
  message?: string;
  data: T;
}

export interface PaginatedEmailTemplatesResponse {
  success: boolean;
  data: {
    data: EmailTemplate[];
    current_page: number;
    per_page: number;
    total: number;
    last_page: number;
  };
}

export interface EmailCampaignApiResponse<T = EmailCampaign> {
  success: boolean;
  message?: string;
  data: T;
}

export interface PaginatedEmailCampaignsResponse {
  success: boolean;
  data: {
    data: EmailCampaign[];
    current_page: number;
    per_page: number;
    total: number;
    last_page: number;
  };
}
