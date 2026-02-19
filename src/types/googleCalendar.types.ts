// Types for Google Calendar Integration

export interface GoogleCalendarStatus {
  location_id: number;
  credentials_configured: boolean;
  is_connected: boolean;
  google_account_email: string | null;
  calendar_id: string | null;
  last_synced_at: string | null;
  sync_from_date: string | null;
  redirect_uri: string;
}

export interface GoogleCalendarAuthUrl {
  auth_url: string;
}

export interface GoogleCalendar {
  id: string;
  summary: string;
  primary?: boolean;
  description?: string;
  backgroundColor?: string;
}

export interface GoogleCalendarSyncResult {
  created: number;
  skipped: number;
  failed: number;
}

export interface GoogleCalendarSetCalendarData {
  location_id: number;
  calendar_id: string;
}

export interface GoogleCalendarSyncData {
  location_id: number;
  from_date: string;
}
