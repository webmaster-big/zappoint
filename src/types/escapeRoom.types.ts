import type { FollowUpRow, GameFollowUp, GameReviewCounts } from './visitFollowUp.types';
import type { KioskAd, WaiverFormContext } from './waiver.types';
import type { PhotoSessionRecord } from './photo.types';

export interface EscapeRoomGuestTime {
  time: string;
  date?: string;
  label: string;
  in_progress: boolean;
  just_finished?: boolean;
}

export interface EscapeRoomGameLink {
  date: string;
  room?: string;
  time?: string;
  sig?: string;
}

export interface EscapeRoomGuestRoom {
  id: number;
  name: string;
  duration_minutes: number;
  times: EscapeRoomGuestTime[];
}

export interface EscapeRoomKioskContext {
  location: { id: number; name: string; logo_path?: string | null };
  date: string;
  date_label: string;
  today?: string;
  ahead?: boolean;
  rooms: EscapeRoomGuestRoom[];
  settings: {
    inactivity_timeout_seconds?: number;
    gps_capture_enabled?: boolean;
  };
}

export interface EscapeRoomFormContext extends WaiverFormContext {
  room: { id: number; name: string; duration_minutes: number };
  times: EscapeRoomGuestTime[];
}

export interface EscapeRoomSubmitResult {
  id: number;
  reference_number: string | null;
  room_name: string;
  session_time: string;
  session_time_label: string;
  ad: KioskAd | null;
}

export type EscapeRoomSlotStatus = 'waiting' | 'signing' | 'photo_ready' | 'sent' | 'send_problem' | 'finished';

export interface EscapeRoomSlotBooking {
  id: number;
  reference_number: string;
  name: string;
  participants: number;
  unsigned: number;
}

export interface EscapeRoomSlot {
  key: string;
  session_id: number | null;
  time: string;
  time_label: string;
  is_past: boolean;
  in_progress?: boolean;
  check_in_open?: boolean;
  bookings: EscapeRoomSlotBooking[];
  players_booked: number;
  signed: number;
  unsigned: number;
  photos: number;
  sent: number;
  not_delivered?: number;
  completed: boolean;
  completion_label: string;
  status: EscapeRoomSlotStatus;
}

export interface EscapeRoomDayRoom {
  id: number;
  name: string;
  is_active: boolean;
  duration_minutes: number;
  has_waiver: boolean;
  slots: EscapeRoomSlot[];
}

export interface EscapeRoomDay {
  date: string;
  is_today: boolean;
  today: string;
  location: { id: number; name: string };
  kiosk_url: string;
  email_available: boolean;
  email_note: string | null;
  rooms: EscapeRoomDayRoom[];
  unsent_earlier?: EscapeRoomUnsentGame[];
}

export interface EscapeRoomUnsentGame {
  session_id: number;
  date: string;
  time: string;
  time_label: string;
  room_name: string | null;
  players: number;
  has_photo: boolean;
}

export type EscapeRoomExcludedReason = 'booking_removed' | 'booking_cancelled' | 'booking_moved' | 'other_location';

export interface EscapeRoomPlayer {
  waiver_id: number;
  reference_number: string | null;
  name: string;
  minors: number;
  email_masked: string | null;
  has_email: boolean;
  photo_release: boolean | null;
  booking_id: number | null;
  booking_reference: string | null;
  is_sign_in: boolean;
  signed_at: string | null;
  sent: boolean;
  delivery: {
    id: number;
    status: string;
    gave_up?: boolean;
    is_duplicate: boolean;
    sent_at: string | null;
    error: string | null;
  } | null;
  excluded_reason: EscapeRoomExcludedReason | null;
  thanks_email?: FollowUpRow | null;
  review?: FollowUpRow | null;
}

export interface EscapeRoomSessionDetail {
  id: number;
  location_id: number;
  location_name: string | null;
  room: {
    id: number | null;
    name: string | null;
    duration_minutes: number | null;
    is_active: boolean;
    has_waiver: boolean;
  };
  session_date: string;
  session_time: string;
  session_time_label: string;
  completed: boolean;
  escaped: boolean | null;
  completion_seconds: number | null;
  completion_label: string;
  completed_at: string | null;
  completed_without_photo?: boolean;
  completed_by_name: string | null;
  bookings: Array<{ id: number; reference_number: string; name: string; participants: number; status: string }>;
  players: EscapeRoomPlayer[];
  excluded_players: EscapeRoomPlayer[];
  unsigned: Array<{ waiver_id: number; reference_number: string | null; booking_id: number | null; booking_reference: string | null }>;
  counts: {
    players: number;
    people?: number;
    with_email: number;
    sent: number;
    emailed: number;
    failed: number;
    retrying: number;
    sending: number;
    stuck: number;
    new_players: number;
    thanks_sent?: number;
    thanks_failed?: number;
    excluded: number;
    unsigned: number;
  };
  photo_session: PhotoSessionRecord | null;
  can_complete: boolean;
  can_send_new: boolean;
  can_email_players?: boolean;
  can_resend?: boolean;
  can_complete_without_photo?: boolean;
  send_blocker?: string | null;
  photo_link?: string | null;
  blockers: string[];
  email_available: boolean;
  kiosk_url: string | null;
  players_booked?: number;
  slideshow?: { enabled: boolean; declined: number; not_asked: number };
  follow_up?: GameFollowUp;
}

export interface EscapeRoomBookingGame {
  session_id: number | null;
  room_id?: number;
  room_name: string;
  date: string;
  time: string;
  time_label: string;
  has_waiver: boolean;
  players_signed: number;
  people_covered?: number;
  players_booked: number;
  shared_time: boolean;
  photo_taken: boolean;
  completed: boolean;
  completed_without_photo?: boolean;
  completion_label: string;
  sent: number;
  booking_cancelled: boolean;
  kiosk_url: string;
  reviews?: GameReviewCounts | null;
}

export interface EscapeRoomOption {
  id: number;
  name: string;
  is_active: boolean;
  duration_minutes: number;
  has_waiver: boolean;
}
