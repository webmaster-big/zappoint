export type RegistrationFormStatus = 'open' | 'closed' | 'past';

export interface RegistrationNextEditionLink {
  name: string;
  url: string;
}

export interface RegistrationFormPage {
  code: string;
  name: string;
  description: string | null;
  event_date: string;
  starts_on: string | null;
  status: RegistrationFormStatus;
  location_name: string | null;
  location_logo_path: string | null;
  header_image_path: string | null;
  header_image_width: number | null;
  header_image_height: number | null;
  confirmation_message: string | null;
  next_edition: RegistrationNextEditionLink | null;
}

export interface RegistrationSubmission {
  name: string;
  phone: string;
  email: string;
  submission_key: string;
}

export interface RegistrationSubmitResult {
  event_name: string;
  confirmation_message: string | null;
}

export interface RegistrationEventEdition {
  id: number;
  name: string;
  event_date: string;
}

export interface RegistrationLinkedEvent {
  id: number;
  name: string;
  start_date: string | null;
  end_date: string | null;
}

export interface RegistrationEventOption {
  id: number;
  name: string;
  location_id: number;
  location_name: string | null;
  description: string | null;
  image: string | null;
  has_image: boolean;
  date_type: string;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
  registration_form_ids: number[];
}

export interface RegistrationCounts {
  total_entries: number;
  unique_registrations: number;
  duplicate_groups: number;
  entries_in_duplicate_groups: number;
  returning_contacts: number;
  previous_edition_registrants: number;
  hidden_entries: number;
}

export interface RegistrationEventSummary {
  id: number;
  name: string;
  public_code: string;
  public_url: string;
  event_date: string;
  status: RegistrationFormStatus;
  is_open: boolean;
  description: string | null;
  confirmation_message: string | null;
  header_image_path: string | null;
  header_image_width: number | null;
  header_image_height: number | null;
  location_id: number;
  location_name: string | null;
  event: RegistrationLinkedEvent | null;
  previous_edition: RegistrationEventEdition | null;
  next_edition: RegistrationEventEdition | null;
  total_entries: number;
  unique_registrations: number;
  created_at: string | null;
  updated_at: string | null;
}

export interface RegistrationEventDetail extends RegistrationEventSummary {
  counts: RegistrationCounts;
  location_locked: boolean;
}

export interface RegistrationEventInput {
  name: string;
  location_id?: number;
  location_ids?: number[];
  event_id?: number | null;
  event_links?: Record<number, number>;
  use_event_image?: boolean;
  copy_header_image_from?: number | null;
  event_date: string;
  description: string;
  confirmation_message: string;
  previous_edition_id: number | null;
  is_open: boolean;
  header_image?: File | null;
  remove_header_image?: boolean;
}

export interface RegistrationCreateResult {
  event: RegistrationEventDetail;
  created: RegistrationEventSummary[];
}

export type RegistrationListFilter = 'all' | 'duplicates' | 'returning' | 'previous_edition' | 'hidden';

export interface RegistrationEntryRow {
  id: number;
  name: string;
  email: string;
  phone: string;
  registered_at: string;
  returning: boolean;
  registered_previous_edition: boolean;
  hidden_at: string | null;
}

export interface RegistrationGroup {
  contact_id: number;
  entry_count: number;
  is_duplicate: boolean;
  first_registered_at: string;
  last_registered_at: string;
  email: string;
  phone: string;
  names: string[];
  returning: boolean;
  registered_previous_edition: boolean;
  registered_before_other_name: boolean;
  other_event_count: number;
  entries: RegistrationEntryRow[];
}

export interface RegistrationPagination {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

export interface RegistrationGroupsResponse {
  groups: RegistrationGroup[];
  pagination: RegistrationPagination;
  counts: RegistrationCounts;
}

export interface RegistrationGroupsQuery {
  search?: string;
  filter?: RegistrationListFilter;
  page?: number;
  per_page?: number;
}

export interface RegistrationExportRow {
  entry_id: number;
  registered_at: string;
  name: string;
  email: string;
  phone: string;
  contact_id: number;
  same_contact_entries: number;
  is_duplicate: boolean;
  returning: boolean;
  registered_previous_edition: boolean;
}

export interface RegistrationExportResponse {
  rows: RegistrationExportRow[];
  total: number;
  capped: boolean;
}

export interface RegistrationHistoryContact {
  id: number;
  email: string;
  phone: string;
  first_registered_at: string | null;
  last_registered_at: string | null;
}

export interface RegistrationHistoryItem {
  entry_id: number;
  event_id: number;
  event_name: string;
  event_date: string;
  location_name: string | null;
  registered_at: string;
  name: string;
  is_current_event: boolean;
  is_previous_edition: boolean;
}

export interface RegistrationHistoryResponse {
  contact: RegistrationHistoryContact;
  history: RegistrationHistoryItem[];
  other_location_registrations: number;
}

export interface RegistrationEntryActionResult {
  counts: RegistrationCounts;
}
