export type PhotoSessionSource = 'staff' | 'kiosk';

export type PhotoSessionStatus = 'in_progress' | 'awaiting_preview' | 'processing' | 'ready';

export type PhotoDeliveryMethod = 'waiver_message' | 'staff_qr' | 'kiosk_qr';

export type PhotoDeliverySchedule = 'immediate' | 'next_day_9am';

export type PhotoProcessingStatus = 'pending' | 'processing' | 'ready' | 'failed';

export type SlideshowState = 'visible' | 'hidden' | 'removed';

export type SlideshowApprovalStatus = 'pending' | 'approved' | 'rejected';

export type PhotoChannel = 'email' | 'sms';

export type PhotoDeliveryKind = 'immediate' | 'next_day' | 'kiosk' | 'backend' | 'escape_room';

export type PhotoDeliveryStatus = 'queued' | 'scheduled' | 'sent' | 'failed' | 'canceled' | 'skipped';

export type PhotoDeliveryOutcome =
  | 'received'
  | 'delivered'
  | 'awaiting_carrier'
  | 'unconfirmed'
  | 'not_delivered'
  | 'sent'
  | 'failed'
  | 'skipped'
  | 'duplicate'
  | 'scheduled'
  | 'queued'
  | 'canceled';

export type PhotoOutcomeTone = 'success' | 'info' | 'warning' | 'danger' | 'muted';

export type PhotoTextingState = 'not_configured' | 'unverified' | 'verified' | 'failing';

export interface PhotoSendOutcome {
  result: 'sent' | 'partial' | 'failed' | 'scheduled';
  headline: string;
  message: string;
  carrier_pending: number;
  delivery_ids: number[];
  confirmable_ids: number[];
  texting_state: PhotoTextingState;
  ask_for_receipt: boolean;
  texts_blocked?: boolean;
}

export interface PhotoTextingStatus {
  state: PhotoTextingState;
  headline: string;
  note: string | null;
  sender: string | null;
  sender_kind: 'toll_free' | 'standard' | 'short_code' | 'none';
  verified: {
    at: string | null;
    method: 'staff_confirmed' | 'guest_opened_link';
    by_name: string | null;
    location_name: string | null;
    photo_delivery_id: number | null;
  } | null;
  problem: { code: string | null; meaning: string; seen_at: string | null } | null;
  pending_receipt?: { photo_delivery_id: number; at: string | null; at_label: string; settles_after: string | null } | null;
  recent: {
    days: number;
    attempted: number;
    received: number;
    delivered: number;
    awaiting_carrier: number;
    unconfirmed: number;
    not_delivered: number;
    failed: number;
    skipped: number;
    top_problem: { code: string; meaning: string | null; count: number } | null;
  };
}

export type SessionDeliveryStatus =
  | 'none'
  | 'pending'
  | 'scheduled'
  | 'delivered'
  | 'partially_delivered'
  | 'failed';

export interface PhotoRecord {
  id: number;
  photo_session_id: number;
  position: number;
  source: 'camera' | 'upload' | 'kiosk';
  processing_status: PhotoProcessingStatus;
  processing_error: string | null;
  delivery_url: string | null;
  slideshow_url: string | null;
  thumbnail_url: string | null;
  width: number | null;
  height: number | null;
  bytes: number | null;
  captured_at: string | null;
  capture_date: string | null;
  operating_day: string | null;
  slideshow_eligible: boolean;
  slideshow_state: SlideshowState;
  slideshow_approval_status: SlideshowApprovalStatus;
  slideshow_approved_at: string | null;
  slideshow_approved_by_name: string | null;
  shows_in_slideshow: boolean;
  awaiting_approval: boolean;
  slideshow_priority: number;
  download_count: number;
  purged: boolean;
  overlay: { id: number; name: string } | null;
  session?: {
    id: number | null;
    source: PhotoSessionSource | null;
    delivery_status: SessionDeliveryStatus | null;
    access_status: 'active' | 'expired' | null;
    access_expires_at: string | null;
    photo_link: string | null;
  };
  session_source?: PhotoSessionSource | null;
  location_name?: string | null;
}

export type PhotoRecipientSource = 'waiver' | 'registration';

export interface PhotoDeliveryRecord {
  id: number;
  photo_session_id: number;
  waiver_id: number | null;
  registration_entry_id?: number | null;
  recipient_source?: PhotoRecipientSource | null;
  kind: PhotoDeliveryKind;
  channel: PhotoChannel;
  destination_masked: string;
  recipient_name: string | null;
  status: PhotoDeliveryStatus;
  is_duplicate: boolean;
  duplicate_of_id: number | null;
  scheduled_for: string | null;
  sent_at: string | null;
  opened_at: string | null;
  attempts: number;
  error: string | null;
  outcome: PhotoDeliveryOutcome;
  outcome_tone: PhotoOutcomeTone;
  outcome_label: string;
  outcome_detail: string | null;
  provider_reference: string | null;
  provider_status: string | null;
  provider_error_code: string | null;
  delivered_at: string | null;
  receipt_confirmed_at: string | null;
  receipt_confirmed_via: 'staff' | 'link' | null;
  receipt_confirmed_by_name: string | null;
  awaiting_carrier: boolean;
  carrier_pending?: boolean;
  can_confirm_receipt: boolean;
  retry_useful?: boolean;
  can_retry: boolean;
  can_cancel: boolean;
  created_at: string | null;
  location_name?: string | null;
  session_source?: PhotoSessionSource | null;
  session_delivery_status?: SessionDeliveryStatus | null;
  photo_link?: string | null;
  sent_by_name?: string | null;
  escape_room?: {
    id: number;
    room_id: number;
    room_name: string | null;
    session_date: string;
    session_time: string;
    completed: boolean;
    completion_label: string;
  } | null;
}

export interface PhotoSessionRecord {
  id: number;
  source: PhotoSessionSource;
  status: PhotoSessionStatus;
  location_id: number;
  location_name: string | null;
  timezone: string;
  delivery_method: PhotoDeliveryMethod | null;
  delivery_schedule: PhotoDeliverySchedule | null;
  slideshow_opt_in: boolean;
  verbal_consent_at: string | null;
  photo_count: number;
  max_photos: number;
  photos: PhotoRecord[];
  qr_status: 'active' | 'expired';
  qr_expires_at: string | null;
  qr_target_url: string;
  qr_scan_count: number;
  access_status: 'active' | 'expired';
  access_expires_at: string | null;
  photo_link: string;
  delivery_status: SessionDeliveryStatus;
  deliveries: PhotoDeliveryRecord[];
  waivers: Array<{ id: number; name: string }>;
  registrations?: Array<{ id: number; name: string; event_name: string | null }>;
  captured_at: string | null;
  capture_date: string | null;
  operating_day: string | null;
  created_by_name: string | null;
  created_at: string | null;
  escape_room?: {
    id: number;
    room_id: number;
    room_name: string | null;
    session_date: string;
    session_time: string;
    completed: boolean;
    completion_label: string;
  } | null;
  kiosk_contact?: {
    name: string | null;
    email: string | null;
    phone: string | null;
    marketing_consent: boolean | null;
    submitted_at: string | null;
  };
}

export interface PhotoChannelDiagnostics {
  sms_available: boolean;
  email_available: boolean;
  email_transport: string;
  sms_status?: PhotoTextingStatus;
  sms_note: string | null;
  email_note: string | null;
  photo_link_base: string;
  photo_link_note: string | null;
}

export interface PhotoWaiverMatch {
  id: number;
  name: string;
  email_masked: string | null;
  phone_masked: string | null;
  has_email: boolean;
  has_phone: boolean;
  contactable: boolean;
  unavailable_reason: string | null;
  photo_video_consent: boolean | null;
  status: string;
  location_name: string | null;
  signed_on: string | null;
  visit_date: string | null;
}

export interface PhotoWaiverRecipient extends PhotoWaiverMatch {
  kind: 'waiver';
}

export interface PhotoRegistrationMatch {
  kind: 'registration';
  id: number;
  name: string;
  email_masked: string | null;
  phone_masked: string | null;
  has_email: boolean;
  has_phone: boolean;
  can_email: boolean;
  can_text: boolean;
  contactable: boolean;
  unavailable_reason: string | null;
  photo_video_consent: boolean | null;
  event_name: string | null;
  first_day: string | null;
  event_date: string | null;
  covers_photo_day: boolean;
  registered_on: string | null;
}

export type PhotoRecipientMatch = PhotoWaiverRecipient | PhotoRegistrationMatch;

export interface PhotoPeopleSearchResult {
  reference_day: string | null;
  waivers: PhotoWaiverRecipient[];
  registrations: PhotoRegistrationMatch[];
}

export interface PhotoCaptureContext {
  location: { id: number; name: string; city: string | null; state: string | null; timezone: string };
  operating_day: string;
  local_time: string;
  active_overlay: { id: number; name: string } | null;
  has_overlay: boolean;
  slideshow_queue_id: number;
  slideshow_enabled: boolean;
  slideshow_requires_approval: boolean;
  slideshow_auto_add_staff: boolean;
  limits: {
    staff_max_photos: number;
    kiosk_max_photos: number;
    qr_valid_hours: number;
    access_valid_days: number;
    kiosk_countdown_seconds: number;
    kiosk_idle_seconds: number;
  };
  channels: PhotoChannelDiagnostics;
  retention_days: number;
}

export interface PhotoLibraryDay {
  operating_day: string;
  label: string;
  photo_count: number;
  kiosk_count: number;
  staff_count: number;
  photos: PhotoRecord[];
}

export interface PhotoLibraryResponse {
  days: PhotoLibraryDay[];
  total_photos: number;
  truncated: boolean;
}

export interface SlideshowQueueRecord {
  id: number;
  operating_day: string | null;
  label: string | null;
  status: 'active' | 'closed';
  is_paused: boolean;
  opened_at: string | null;
  closed_at: string | null;
  closes_at: string | null;
  total_photos: number;
  visible_photos: number;
  awaiting_approval: number;
  photos: PhotoRecord[];
}

export interface SlideshowQueueResponse {
  active: SlideshowQueueRecord;
  past: SlideshowQueueRecord[];
  settings: {
    slideshow_enabled: boolean;
    slideshow_requires_approval: boolean;
    slideshow_auto_add_kiosk: boolean;
    slideshow_auto_add_staff: boolean;
    slideshow_duration_seconds: number;
    slideshow_url: string;
    slideshow_passcode: string;
    durations: number[];
    last_seen_at: string | null;
    display_online: boolean;
  };
  operating_day: string;
  local_time: string;
  cutoff_hour: number;
}

export interface PhotoOverlayEvent {
  id: number;
  name: string;
  first_day: string;
  event_date: string;
  day_count: number;
  window_start: string | null;
  window_end: string | null;
  effective_start: string | null;
  effective_end: string | null;
  location_form_removed: boolean;
  never_runs: boolean;
}

export interface PhotoOverlayRecord {
  id: number;
  location_id: number;
  package_id?: number | null;
  room_name?: string | null;
  registration_event_id?: number | null;
  event?: PhotoOverlayEvent | null;
  name: string;
  image_url: string | null;
  starts_at: string | null;
  ends_at: string | null;
  is_enabled: boolean;
  priority: number;
  status: 'active' | 'scheduled' | 'expired' | 'disabled';
  is_active: boolean;
  created_by_name: string | null;
  created_at: string | null;
}

export interface PhotoOverlayConflict {
  overlay_id: number;
  overlay_name: string;
  conflicts_with_id: number;
  conflicts_with_name: string;
  winner_id: number;
  winner_name?: string | null;
  location_id?: number;
}

export interface PhotoOverlayCopies {
  created: Array<{ overlay_id: number; location_name: string | null }>;
  skipped: Array<{ location_name: string | null; reason: string | null }>;
}

export interface PhotoEventDaySibling {
  form_id: number;
  location_id: number;
  location_name: string | null;
  first_day: string;
  event_date: string;
  usable: boolean;
  reason: string | null;
}

export interface PhotoEventDay {
  id: number;
  name: string;
  event_date: string;
  first_day: string;
  day_count: number;
  group_id: number | null;
  window_start: string | null;
  window_end: string | null;
  has_frame: boolean;
  siblings: PhotoEventDaySibling[];
}

export interface PhotoEventDaysResponse {
  available: boolean;
  forms: PhotoEventDay[];
}

export interface PhotoOverlayResponse {
  overlays: PhotoOverlayRecord[];
  active_overlay_id: number | null;
  conflicts: PhotoOverlayConflict[];
  date_layer_note: string;
}

export interface LocationPhotoSettingRecord {
  id: number;
  location_id: number;
  kiosk_enabled: boolean;
  slideshow_enabled: boolean;
  kiosk_passcode: string;
  slideshow_passcode: string;
  kiosk_url: string;
  slideshow_url: string;
  kiosk_countdown_seconds: number;
  slideshow_duration_seconds: number;
  slideshow_requires_approval: boolean;
  slideshow_auto_add_kiosk: boolean;
  slideshow_auto_add_staff: boolean;
  retention_days: number;
  date_format: string;
  date_position: 'top_left' | 'top_right' | 'bottom_left' | 'bottom_right';
  date_font_size: number;
  date_margin: number;
  date_background: 'none' | 'solid' | 'shadow';
  failure_notify_email: string | null;
  slideshow_seen_at: string | null;
}

export interface PhotoSettingsResponse {
  setting: LocationPhotoSettingRecord;
  location: { id: number; name: string; timezone: string; timezone_stored: string | null };
  locked: {
    qr_valid_hours: number;
    access_valid_days: number;
    staff_max_photos: number;
    kiosk_max_photos: number;
    kiosk_idle_seconds: number;
    operating_day_cutoff_hour: number;
    next_day_delivery_hour: number;
  };
  channels: PhotoChannelDiagnostics;
  options: {
    date_formats: Array<{ value: string; preview: string }>;
    date_positions: string[];
    date_backgrounds: string[];
    slideshow_durations: number[];
    countdown_options: number[];
  };
}

export interface PhotoMessageTemplateRecord {
  id: number;
  company_id: number | null;
  kind: 'immediate' | 'next_day' | 'kiosk' | 'escape_room';
  email_subject: string;
  email_body: string;
  sms_body: string;
  is_active: boolean;
}

export interface PhotoTemplatesResponse {
  templates: PhotoMessageTemplateRecord[];
  variables: string[];
  variables_by_kind?: Record<string, string[]>;
  kinds: string[];
  escape_room_email?: { id: number; name: string; is_active: boolean; rooms_without_email?: string[]; emails?: Array<{ id: number; name: string; rooms: string[] }> } | null;
}

export interface KioskContext {
  location: { id: number; name: string; city: string | null; state: string | null; logo_path?: string | null; timezone: string };
  business_name: string;
  local_time: string;
  operating_day: string;
  countdown_seconds: number;
  idle_seconds: number;
  max_photos: number;
  qr_valid_hours: number;
  access_valid_days: number;
  has_overlay: boolean;
  overlay_name: string | null;
  capture_date_label: string;
  slideshow_offered: boolean;
  slideshow_default_on: boolean;
  slideshow_requires_approval: boolean;
  slideshow_tooltip: string;
  consent_text: string;
}

export interface KioskSessionHandle {
  session_id: number;
  session_secret: string;
  countdown_seconds: number;
  idle_seconds: number;
}

export interface KioskCaptureResult {
  photo_id: number;
  preview_url: string;
  capture_date_label: string | null;
  status: PhotoSessionStatus;
}

export interface KioskAcceptResult {
  qr_target_url: string;
  qr_expires_at: string | null;
  qr_valid_hours: number;
  idle_seconds: number;
}

export interface SlideshowFeed {
  location_name: string;
  location_logo_path?: string | null;
  business_name: string;
  queue_id: number;
  operating_day: string | null;
  is_paused: boolean;
  duration_seconds: number;
  closes_at: string | null;
  local_time: string;
  photos: Array<{ id: number; url: string; captured_at: string | null }>;
}

export interface QrResolution {
  mode: 'direct' | 'contact_required';
  access_token: string;
  location_name: string | null;
  location_logo_path?: string | null;
  photo_count: number;
  source: PhotoSessionSource;
}

export interface CustomerPhotoPage {
  state: 'ready' | 'contact_required';
  location_name: string | null;
  location_logo_path?: string | null;
  business_name: string | null;
  source?: PhotoSessionSource;
  greeting_name?: string | null;
  asked_for_details?: boolean;
  link_sent_by?: { email: boolean; sms: boolean; sms_reliable?: boolean } | null;
  photo_date?: string;
  photo_count?: number;
  expires_at: string | null;
  expires_on_label?: string;
  allow_download_all?: boolean;
  photos?: Array<{ id: number; url: string; width: number | null; height: number | null }>;
  escape_room?: {
    room_name: string | null;
    session_date: string | null;
    session_time: string | null;
    completed: boolean;
    escaped: boolean | null;
    completion_label: string;
    result: string;
  } | null;
}

export interface PhotoActivityReport {
  sessions_total: number;
  sessions_staff: number;
  sessions_kiosk: number;
  photos_total: number;
  photos_camera: number;
  photos_uploaded: number;
  photos_kiosk: number;
  processing_failures: number;
  retakes: number;
  discarded_sessions: number;
}

export interface PhotoAuditEntry {
  id: number;
  action: string;
  description: string;
  user_name: string;
  location_name: string | null;
  entity_type: string | null;
  entity_id: number | null;
  metadata: Record<string, unknown> | null;
  created_at: string | null;
}
