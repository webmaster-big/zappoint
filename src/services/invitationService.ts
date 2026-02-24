// src/services/invitationService.ts

import axios from 'axios';
import { API_BASE_URL, getStoredUser } from '../utils/storage';
import type {
  SendInvitationsRequest,
  SendInvitationsResponse,
  InvitationListResponse,
  RsvpPageData,
  RsvpSubmitRequest,
  RsvpSubmitResponse,
  InvitationPreviewResponse,
} from '../types/invitation.types';

// Helper to get the best available auth token.
// Prefer the admin/user token (same as bookingService) since invitation
// endpoints are nested under /bookings and share the same auth scope.
// Fall back to customer token so the service also works from pure-customer contexts.
const getAuthToken = (): string | null => {
  // 1. Admin / user token (used by bookingService)
  const user = getStoredUser();
  if (user?.token) return user.token;

  // 2. Customer token
  try {
    const stored = localStorage.getItem('zapzone_customer');
    if (stored) {
      const customer = JSON.parse(stored);
      return customer?.token || null;
    }
  } catch {
    // ignore
  }
  return null;
};

// Authenticated axios instance (customer token)
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    const token = getAuthToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Public axios instance (no auth)
const publicApi = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

const invitationService = {
  // Send invitations for a booking (authenticated - customer)
  sendInvitations: async (
    bookingId: number,
    data: SendInvitationsRequest
  ): Promise<SendInvitationsResponse> => {
    const response = await api.post(`/bookings/${bookingId}/invitations`, data);
    return response.data;
  },

  // Get all invitations for a booking (authenticated - customer)
  getInvitations: async (bookingId: number): Promise<InvitationListResponse> => {
    const response = await api.get(`/bookings/${bookingId}/invitations`);
    return response.data;
  },

  // Resend a specific invitation (authenticated - customer)
  resendInvitation: async (bookingId: number, invitationId: number): Promise<{ message: string }> => {
    const response = await api.post(`/bookings/${bookingId}/invitations/${invitationId}/resend`);
    return response.data;
  },

  // Delete/cancel an invitation (authenticated - customer)
  deleteInvitation: async (bookingId: number, invitationId: number): Promise<{ message: string }> => {
    const response = await api.delete(`/bookings/${bookingId}/invitations/${invitationId}`);
    return response.data;
  },

  // Get RSVP page data (public - no auth)
  getRsvpData: async (token: string): Promise<RsvpPageData> => {
    const response = await publicApi.get(`/rsvp/${token}`);
    return response.data;
  },

  // Submit RSVP (public - no auth)
  submitRsvp: async (token: string, data: RsvpSubmitRequest): Promise<RsvpSubmitResponse> => {
    const response = await publicApi.post(`/rsvp/${token}`, data);
    return response.data;
  },

  // Get invitation email/text preview (authenticated - customer)
  getPreview: async (bookingId: number): Promise<InvitationPreviewResponse> => {
    const response = await api.get(`/bookings/${bookingId}/invitation-preview`);
    return response.data;
  },
};

export default invitationService;
