// src/types/invitation.types.ts

export interface InvitationGuest {
  name: string;
  email: string | null;
  phone: string | null;
  send_via: 'email' | 'text' | 'both';
}

export interface SendInvitationsRequest {
  guests: InvitationGuest[];
}

export interface Invitation {
  id: number;
  booking_id: number;
  guest_name: string;
  guest_email: string | null;
  guest_phone: string | null;
  send_via: 'email' | 'text' | 'both';
  rsvp_token: string;
  rsvp_status: 'pending' | 'attending' | 'declined';
  rsvp_full_name: string | null;
  rsvp_email: string | null;
  rsvp_phone: string | null;
  rsvp_guest_count: number | null;
  rsvp_notes: string | null;
  marketing_opt_in: boolean;
  email_sent_at: string | null;
  sms_sent_at: string | null;
  responded_at: string | null;
  created_at: string;
}

export interface InvitationSummary {
  total_invited: number;
  attending: number;
  declined: number;
  pending: number;
  total_guest_count: number;
  remaining_slots: number;
}

export interface InvitationListResponse {
  invitations: Invitation[];
  summary: InvitationSummary;
}

export interface SendInvitationResult {
  id?: number;
  guest_name: string;
  status: 'sent' | 'skipped';
  reason?: string;
  delivery?: {
    email: 'sent' | 'failed' | null;
    sms: 'sent' | 'failed' | 'not_configured' | null;
  };
}

export interface SendInvitationsResponse {
  message: string;
  results: SendInvitationResult[];
  summary: InvitationSummary;
}

export interface RsvpPageData {
  invitation: {
    guest_name: string;
    rsvp_status: string;
    has_responded: boolean;
    responded_at: string | null;
    rsvp_full_name: string | null;
    rsvp_guest_count: number | null;
  };
  party: {
    host_name: string;
    package_name: string;
    package_description: string;
    date: string;
    time: string;
    guest_of_honor_name: string | null;
    guest_of_honor_age: string | null;
    invitation_download_link: string | null;
  };
  location: {
    name: string;
    address: string;
    phone: string;
    email: string;
  };
  company: {
    name: string;
    logo_url: string | null;
  };
}

export interface RsvpSubmitRequest {
  full_name?: string;
  email?: string;
  phone?: string;
  rsvp_status: 'attending' | 'declined';
  guest_count?: number;
  notes?: string;
  marketing_opt_in: boolean;
}

export interface RsvpSubmitResponse {
  message: string;
  rsvp_status: string;
}

export interface InvitationPreviewResponse {
  subject: string;
  html: string;
  has_invitation_file: boolean;
  has_invitation_download_link: boolean;
}
