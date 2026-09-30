export type VisitType = 'booking' | 'escape_room_session' | 'event_purchase';

export type FollowUpKind = 'thanks' | 'review';

export type FollowUpStatus = 'scheduled' | 'sending' | 'sent' | 'failed' | 'skipped' | 'canceled';

export type FollowUpReason =
  | 'reopened'
  | 'switched_off'
  | 'visit_date'
  | 'opted_out'
  | 'asked_recently'
  | 'redirected'
  | 'left_game'
  | 'recipient_changed'
  | 'visit_gone'
  | 'staff';

export interface FollowUpRow {
  id: number;
  kind: FollowUpKind;
  visit_type: VisitType;
  visit_id: number;
  recipient_name: string | null;
  recipient_email_masked: string;
  waiver_id: number | null;
  status: FollowUpStatus;
  gave_up: boolean;
  due_at: string | null;
  sent_at: string | null;
  attempts: number;
  error: string | null;
  reason: FollowUpReason | null;
  rating: number | null;
  comment: string | null;
  rated_at: string | null;
  email_notification_id: number | null;
  sent_in_this_action?: boolean;
  is_current_recipient?: boolean;
}

export interface FollowUpPromoInfo {
  id: number;
  code: string | null;
  offer: string | null;
  name: string | null;
  ends_on: string | null;
  terms?: string;
  location_note?: string | null;
  problem: string | null;
}

export interface FollowUpEmailInfo {
  active: boolean;
  id: number | null;
  name: string | null;
  hours: number | null;
  promo: FollowUpPromoInfo | null;
}

export interface VisitFollowUpSummary {
  available: boolean;
  visit_type: VisitType;
  visit_id: number;
  completed: boolean;
  handled_by_game: boolean;
  is_ticket_order_line?: boolean;
  recipient_email_masked: string | null;
  max_visit_age_days?: number;
  thanks_email: FollowUpEmailInfo;
  review_email: FollowUpEmailInfo;
  thanks: FollowUpRow[];
  reviews: FollowUpRow[];
  can_send_thanks: boolean;
}

export interface GameReviewCounts {
  scheduled: number;
  sent: number;
  skipped: number;
  failed: number;
  rated: number;
  average_rating: number | null;
  next_due_at: string | null;
}

export interface GameFollowUp {
  available: boolean;
  thanks_email: FollowUpEmailInfo;
  review_email: FollowUpEmailInfo;
  reviews: GameReviewCounts | null;
}

export interface GuestRatingRow extends FollowUpRow {
  location_name: string | null;
  visit_path: string;
}

export interface GuestRatingsResponse {
  summary: {
    requested: number;
    rated: number;
    average: number | null;
    distribution: Record<string, number>;
  };
  ratings: GuestRatingRow[];
  pagination: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
}

export interface GuestRatingFilters {
  location_id?: number;
  start_date?: string;
  end_date?: string;
  max_rating?: number;
  per_page?: number;
  page?: number;
}

export interface VisitFeedbackPage {
  opt_out_only?: boolean;
  activity_name: string | null;
  location_name: string | null;
  company_name: string | null;
  brand_name?: string | null;
  visit_date: string | null;
  first_name: string | null;
  rating: number | null;
  comment: string | null;
  rated_at: string | null;
  review_url: string | null;
  unsubscribed: boolean;
}
