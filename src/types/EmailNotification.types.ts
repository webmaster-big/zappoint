// src/types/EmailNotification.types.ts

// Trigger Types - Categorized by event type
export type BookingTriggerType =
  | 'booking_created'
  | 'booking_confirmed'
  | 'booking_updated'
  | 'booking_rescheduled'
  | 'booking_cancelled'
  | 'booking_checked_in'
  | 'booking_completed'
  | 'booking_reminder'
  | 'booking_followup'
  | 'booking_no_show';

export type PaymentTriggerType =
  | 'payment_received'
  | 'payment_failed'
  | 'payment_refunded'
  | 'payment_partial'
  | 'payment_pending';

export type PurchaseTriggerType =
  | 'purchase_created'
  | 'purchase_confirmed'
  | 'purchase_cancelled'
  | 'purchase_completed'
  | 'purchase_checked_in'
  | 'purchase_refunded'
  | 'purchase_reminder'
  | 'purchase_followup';

export type TriggerType = BookingTriggerType | PaymentTriggerType | PurchaseTriggerType;

// Entity Types
export type EntityType = 'all' | 'package' | 'attraction';

// Recipient Types
export type RecipientType = 'customer' | 'staff' | 'company_admin' | 'location_manager' | 'custom';

// Notification Log Status
export type NotificationLogStatus = 'pending' | 'sent' | 'failed';

// Main Email Notification Interface
export interface EmailNotification {
  id: number;
  company_id: number;
  location_id: number | null;
  name: string;
  trigger_type: TriggerType;
  entity_type: EntityType;
  entity_ids: number[];
  email_template_id: number | null;
  subject: string | null;
  body: string | null;
  recipient_types: RecipientType[];
  custom_emails: string[];
  include_qr_code: boolean;
  is_active: boolean;
  send_before_hours: number | null;
  send_after_hours: number | null;
  created_at: string;
  updated_at: string;
  // Relations
  location?: {
    id: number;
    name: string;
    address?: string;
  };
  email_template?: {
    id: number;
    name: string;
    subject: string;
  };
  logs_count?: number;
}

// Email Notification Log Interface
export interface EmailNotificationLog {
  id: number;
  email_notification_id: number;
  recipient_email: string;
  recipient_type: RecipientType;
  subject: string;
  body: string;
  status: NotificationLogStatus;
  error_message: string | null;
  sent_at: string | null;
  created_at: string;
  // Polymorphic relations
  notifiable_type: string;
  notifiable_id: number;
  // Optional expanded relations
  email_notification?: EmailNotification;
}

// Create/Update Data Interfaces
export interface CreateEmailNotificationData {
  name: string;
  trigger_type: TriggerType;
  entity_type: EntityType;
  entity_ids?: number[];
  location_id?: number | null;
  email_template_id?: number | null;
  subject?: string | null;
  body?: string | null;
  recipient_types: RecipientType[];
  custom_emails?: string[];
  include_qr_code?: boolean;
  is_active?: boolean;
  send_before_hours?: number | null;
  send_after_hours?: number | null;
}

export interface UpdateEmailNotificationData extends Partial<CreateEmailNotificationData> {}

// Send Test Email Data
export interface SendTestEmailData {
  test_email: string;
  booking_id?: number;
  purchase_id?: number;
  customer_id?: number;
  package_id?: number;
  attraction_id?: number;
}

// Filter Interface
export interface EmailNotificationFilters {
  page?: number;
  per_page?: number;
  location_id?: number;
  trigger_type?: TriggerType;
  entity_type?: EntityType;
  is_active?: boolean;
  search?: string;
}

// API Response Types
export interface TriggerTypesResponse {
  success: boolean;
  data: {
    booking: Record<string, string>;
    payment: Record<string, string>;
    purchase: Record<string, string>;
  };
  flat: Record<string, string>;
}

export interface VariablesResponse {
  success: boolean;
  data: {
    specific: Record<string, Record<string, string>>;
    common: Record<string, Record<string, string>>;
  };
}

export interface EntityTypesResponse {
  success: boolean;
  data: Record<string, string>;
}

export interface RecipientTypesResponse {
  success: boolean;
  data: Record<string, string>;
}

export interface EntitiesResponse {
  success: boolean;
  data: Array<{
    id: number;
    name: string;
    slug?: string;
  }>;
}

// Paginated Response
export interface PaginatedEmailNotificationsResponse {
  success: boolean;
  data: {
    current_page: number;
    data: EmailNotification[];
    first_page_url: string;
    from: number;
    last_page: number;
    last_page_url: string;
    next_page_url: string | null;
    path: string;
    per_page: number;
    prev_page_url: string | null;
    to: number;
    total: number;
  };
}

export interface PaginatedEmailNotificationLogsResponse {
  success: boolean;
  data: {
    current_page: number;
    data: EmailNotificationLog[];
    first_page_url: string;
    from: number;
    last_page: number;
    last_page_url: string;
    next_page_url: string | null;
    path: string;
    per_page: number;
    prev_page_url: string | null;
    to: number;
    total: number;
  };
}

export interface EmailNotificationApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

// Trigger Type Configuration for UI
export interface TriggerTypeConfig {
  value: TriggerType;
  label: string;
  category: 'booking' | 'payment' | 'purchase';
  description: string;
  showSendBefore?: boolean;
  showSendAfter?: boolean;
}

// Recipient Type Configuration for UI
export interface RecipientTypeConfig {
  value: RecipientType;
  label: string;
  description: string;
}

// Entity Type Configuration for UI
export interface EntityTypeConfig {
  value: EntityType;
  label: string;
  description: string;
}
