export type PhotoSessionSource = 'staff' | 'kiosk';

export type PhotoSessionStatus = 'in_progress' | 'awaiting_preview' | 'processing' | 'ready';

export type PhotoDeliveryMethod = 'waiver_message' | 'staff_qr' | 'kiosk_qr';

export type PhotoDeliverySchedule = 'immediate' | 'next_day_9am';

export type PhotoProcessingStatus = 'pending' | 'processing' | 'ready' | 'failed';

export type SlideshowState = 'visible' | 'hidden' | 'removed';

export type PhotoChannel = 'email' | 'sms';

export type PhotoDeliveryKind = 'immediate' | 'next_day' | 'kiosk' | 'backend';

export type PhotoDeliveryStatus = 'queued' | 'scheduled' | 'sent' | 'failed' | 'canceled' | 'skipped';

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

export interface PhotoDeliveryRecord {
  id: number;
  photo_session_id: number;
  waiver_id: number | null;
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
  can_retry: boolean;
  can_cancel: boolean;
  created_at: string | null;
  location_name?: string | null;
  session_source?: PhotoSessionSource | null;
  session_delivery_status?: SessionDeliveryStatus | null;
  photo_link?: string | null;
  sent_by_name?: string | null;
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
  captured_at: string | null;
  capture_date: string | null;
  operating_day: string | null;
  created_by_name: string | null;
  created_at: string | null;
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
  sms_note: string | null;
  email_note: string | null;
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

export interface PhotoCaptureContext {
  location: { id: number; name: string; city: string | null; state: string | null; timezone: string };
  operating_day: string;
  local_time: string;
  active_overlay: { id: number; name: string } | null;
  has_overlay: boolean;
  slideshow_queue_id: number;
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
  photos: PhotoRecord[];
}

export interface SlideshowQueueResponse {
  active: SlideshowQueueRecord;
  past: SlideshowQueueRecord[];
  settings: {
    slideshow_enabled: boolean;
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

export interface PhotoOverlayRecord {
  id: number;
  location_id: number;
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
  location_id?: number;
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
  kind: 'immediate' | 'next_day' | 'kiosk';
  email_subject: string;
  email_body: string;
  sms_body: string;
  is_active: boolean;
}

export interface PhotoTemplatesResponse {
  templates: PhotoMessageTemplateRecord[];
  variables: string[];
  kinds: string[];
}

export interface KioskContext {
  location: { id: number; name: string; city: string | null; state: string | null; timezone: string };
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
  photo_count: number;
  source: PhotoSessionSource;
}

export interface CustomerPhotoPage {
  state: 'ready' | 'contact_required';
  location_name: string | null;
  business_name: string | null;
  source?: PhotoSessionSource;
  greeting_name?: string | null;
  asked_for_details?: boolean;
  photo_date?: string;
  photo_count?: number;
  expires_at: string | null;
  expires_on_label?: string;
  allow_download_all?: boolean;
  photos?: Array<{ id: number; url: string; width: number | null; height: number | null }>;
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
