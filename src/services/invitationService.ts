
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

const getAuthToken = (): string | null => {
  const user = getStoredUser();
  if (user?.token) return user.token;

  try {
    const stored = localStorage.getItem('zapzone_customer');
    if (stored) {
      const customer = JSON.parse(stored);
      return customer?.token || null;
    }
  } catch {
  }
  return null;
};

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

const publicApi = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

const invitationService = {
  sendInvitations: async (
    bookingId: number,
    data: SendInvitationsRequest
  ): Promise<SendInvitationsResponse> => {
    const response = await api.post(`/bookings/${bookingId}/invitations`, data);
    return response.data;
  },

  getInvitations: async (bookingId: number): Promise<InvitationListResponse> => {
    const response = await api.get(`/bookings/${bookingId}/invitations`);
    return response.data;
  },

  resendInvitation: async (bookingId: number, invitationId: number): Promise<{ message: string }> => {
    const response = await api.post(`/bookings/${bookingId}/invitations/${invitationId}/resend`);
    return response.data;
  },

  deleteInvitation: async (bookingId: number, invitationId: number): Promise<{ message: string }> => {
    const response = await api.delete(`/bookings/${bookingId}/invitations/${invitationId}`);
    return response.data;
  },

  getRsvpData: async (token: string): Promise<RsvpPageData> => {
    const response = await publicApi.get(`/rsvp/${token}`);
    return response.data;
  },

  submitRsvp: async (token: string, data: RsvpSubmitRequest): Promise<RsvpSubmitResponse> => {
    const response = await publicApi.post(`/rsvp/${token}`, data);
    return response.data;
  },

  getPreview: async (bookingId: number): Promise<InvitationPreviewResponse> => {
    const response = await api.get(`/bookings/${bookingId}/invitation-preview`);
    return response.data;
  },
};

export default invitationService;
