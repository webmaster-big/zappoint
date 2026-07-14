// Waiver module types — mirror the Laravel API payloads.

export type WaiverStatus = 'pending' | 'completed' | 'expired' | 'replaced' | 'deleted';
export type TemplateStatus = 'draft' | 'active' | 'inactive' | 'archived';
export type DuplicateRule = 'none' | 'allow' | 'manager_only';
export type MarketingConsentStatus = 'not_opted_in' | 'opted_in' | 'withdrawn';
export type WaiverSource =
  | 'checkout' | 'confirmation_email' | 'sms_link' | 'kiosk' | 'staff_sent' | 'bulk_invite';
export type RecipientStatus = 'not_sent' | 'sent' | 'complete' | 'not_complete' | 'failed';
export type ActivityType = 'package' | 'attraction' | 'event' | 'party_type';

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  errors?: Record<string, unknown>;
}

export interface Pagination {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  from: number | null;
  to: number | null;
}

export interface Paginated<T> {
  success: boolean;
  data: Record<string, T[]> & { pagination: Pagination };
}

export interface WaiverMinor {
  id?: number;
  first_name: string;
  last_name: string;
  date_of_birth?: string | null;
  relationship?: string | null;
}

export interface WaiverTemplate {
  id: number;
  company_id: number;
  location_id: number | null;
  title: string;
  internal_description?: string | null;
  status: TemplateStatus;
  is_default: boolean;
  current_version: number;
  body_text: string;
  validity_duration_days: number | null;
  max_minors: number;
  duplicate_rule: DuplicateRule;
  reminder_eligible: boolean;
  assigned_package_ids: number[] | null;
  assigned_attraction_ids: number[] | null;
  assigned_event_ids: number[] | null;
  assigned_party_types: string[] | null;
  minor_section_enabled: boolean;
  dob_required: boolean;
  relationship_required: boolean;
  photo_video_release_enabled: boolean;
  medical_ack_enabled: boolean;
  property_damage_enabled: boolean;
  group_leader_clause_enabled: boolean;
  electronic_consent_enabled: boolean;
  marketing_consent_enabled: boolean;
  marketing_consent_text?: string | null;
  marketing_helper_text?: string | null;
  crm_sync_allowed: boolean;
  crm_sync_birthday: boolean;
  crm_sync_minor: boolean;
  attorney_reviewed: boolean;
  updated_at?: string;
  deleted_at?: string | null;
}

export type WaiverTemplatePayload = Partial<Omit<WaiverTemplate, 'id' | 'company_id' | 'current_version'>>;

export interface Waiver {
  id: number;
  status: WaiverStatus;
  selected_date: string;
  adult_first_name?: string | null;
  adult_last_name?: string | null;
  adult_email?: string | null;
  adult_phone?: string | null;
  adult_dob?: string | null;
  relationship?: string | null;
  typed_legal_name?: string | null;
  agreement_accepted: boolean;
  electronic_consent_accepted: boolean;
  photo_video_consent?: boolean | null;
  marketing_consent_status: MarketingConsentStatus;
  source: WaiverSource;
  submitted_at?: string | null;
  checked_in_at?: string | null;
  checked_in_by?: number | null;
  template?: { id: number; title: string };
  version?: { id: number; version: number };
  location?: { id: number; name: string };
  minors?: WaiverMinor[];
  booking?: { id: number; reference_number?: string };
  attraction_purchase?: { id: number };
  event?: { id: number; name: string };
}

// Public form context returned by GET /waivers/access/{token}
export interface WaiverFormTemplate {
  id: number;
  title: string;
  version: number | null;
  max_minors: number;
  minor_section_enabled: boolean;
  dob_required: boolean;
  relationship_required: boolean;
  photo_video_release_enabled: boolean;
  electronic_consent_enabled: boolean;
  marketing_consent_enabled: boolean;
  marketing_consent_text?: string | null;
  marketing_helper_text?: string | null;
  clause_config: Record<string, unknown>;
}

export interface WaiverFormContext {
  status: WaiverStatus | 'completed';
  message?: string;
  submitted_at?: string;
  template?: WaiverFormTemplate;
  body?: string;
  prefill?: Partial<{
    adult_first_name: string;
    adult_last_name: string;
    adult_email: string;
    adult_phone: string;
    adult_dob: string;
  }>;
  selected_date?: string;
  kiosk?: boolean;
  settings?: { inactivity_timeout_seconds: number; disable_autofill: boolean };
}

export interface WaiverSubmission {
  adult_first_name: string;
  adult_last_name: string;
  adult_email?: string;
  adult_phone?: string;
  adult_dob?: string;
  relationship?: string;
  typed_legal_name: string;
  agreement_accepted: boolean;
  electronic_consent_accepted?: boolean;
  photo_video_consent?: boolean;
  marketing_consent?: boolean;
  minors?: WaiverMinor[];
  selected_date?: string;
}

export interface BulkRecipientView {
  id: number;
  name: string | null;
  status: RecipientStatus;
  complete: boolean;
  resent_count: number;
}

export interface BulkChaperoneView {
  chaperone_name: string;
  selected_date: string;
  allow_shareable_link: boolean;
  recipients: BulkRecipientView[];
  summary: { total: number; complete: number };
}

export interface AvailableActivities {
  type: ActivityType;
  claimed_ids: Array<number | string>;
  available: Array<{ id: number; name: string; location_id: number | null; location_name: string | null }>;
}

export interface WaiverSettings {
  default_validity_days: number | null;
  waivers_expire: boolean;
  default_expiration_days: number | null;
  require_new_on_text_change: boolean;
  default_duplicate_rule: DuplicateRule;
  reminder_window_hours: number;
  always_include_link_in_confirmation: boolean;
  search_auto_refresh_seconds: number;
  kiosk_inactivity_timeout_seconds: number;
  kiosk_disable_autofill: boolean;
  admin_delete_enabled: boolean;
  manager_print_export_enabled: boolean;
  manager_can_build_templates: boolean;
  manager_can_view_deletion_log: boolean;
  marketing_consent_enabled: boolean;
  crm_sync_only_when_consented: boolean;
  minor_marketing_disabled: boolean;
}

export interface ConnectedWaiver {
  id: number;
  status: WaiverStatus;
  adult_name: string;
  adult_email?: string | null;
  adult_phone?: string | null;
  selected_date: string;
  template?: string | null;
  location?: string | null;
  source: WaiverSource;
  marketing_consent_status: MarketingConsentStatus;
  submitted_at?: string | null;
  checked_in_at?: string | null;
  minors: string[];
  signing_url?: string | null;
}

export interface EntityWaiverSummary {
  total: number;
  completed: number;
  pending: number;
  checked_in?: number;
}

export interface WaiverSearchFilters {
  date?: string;
  all?: boolean | number;
  status?: WaiverStatus;
  adult_name?: string;
  minor_name?: string;
  email?: string;
  phone?: string;
  phone_last4?: string;
  booking_id?: number;
  event_id?: number;
  customer_id?: number;
  source?: WaiverSource;
  marketing_consent_status?: MarketingConsentStatus;
  per_page?: number;
  page?: number;
}
