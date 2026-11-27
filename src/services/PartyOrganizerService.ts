import axios from 'axios';
import { API_BASE_URL } from '../utils/storage';

export interface PartyGuest {
  id: number;
  name: string | null;
  email?: string | null;
  phone?: string | null;
  invitation_status: 'Not sent yet' | 'Invite sent' | 'Not delivered';
  waiver_status: 'Signed' | 'Not signed yet';
  signed: boolean;
  not_delivered: boolean;
  resent_count: number;
}

export interface PartyOrganizerView {
  booking: {
    id: number;
    reference_number: string;
    package_name: string | null;
    location_name: string | null;
    booking_date: string;
    booking_time: string;
    guest_of_honor_name: string | null;
    cancelled: boolean;
  };
  guests: PartyGuest[];
  summary: { added: number; signed: number; not_signed: number; not_delivered: number };
}

export interface PartyGuestInput {
  name?: string;
  email?: string;
  phone?: string;
}

export interface PartyAddResult {
  message: string;
  needsAttention: boolean;
}

const getCustomerToken = (): string | null => {
  try {
    const stored = localStorage.getItem('zapzone_customer');
    return stored ? JSON.parse(stored)?.token || null : null;
  } catch {
    return null;
  }
};

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = getCustomerToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

const keyParams = (key?: string | null) => (key ? { params: { k: key } } : {});

const partyOrganizerService = {
  async get(bookingId: number, key?: string | null): Promise<PartyOrganizerView> {
    const response = await api.get(`/customer/party/${bookingId}`, keyParams(key));
    return response.data.data;
  },

  async addGuests(bookingId: number, guests: PartyGuestInput[], key?: string | null): Promise<PartyAddResult> {
    const response = await api.post(`/customer/party/${bookingId}/guests`, { recipients: guests }, keyParams(key));
    const data = response.data?.data ?? {};
    return {
      message: response.data?.message ?? '',
      needsAttention: (data.failed ?? 0) > 0 || (data.phones_not_saved ?? 0) > 0 || (data.skipped ?? 0) > 0,
    };
  },

  async resend(bookingId: number, guestId: number, key?: string | null): Promise<{ message: string }> {
    const response = await api.post(`/customer/party/${bookingId}/guests/${guestId}/resend`, {}, keyParams(key));
    return { message: response.data?.message ?? '' };
  },

  async update(bookingId: number, guestId: number, guest: PartyGuestInput, key?: string | null): Promise<{ message: string; success: boolean }> {
    const response = await api.patch(`/customer/party/${bookingId}/guests/${guestId}`, guest, keyParams(key));
    return { message: response.data?.message ?? '', success: response.data?.success !== false };
  },
};

export const partyErrorStatus = (error: unknown): number | undefined =>
  (error as { response?: { status?: number } })?.response?.status;

export const partyErrorMessage = (error: unknown, fallback: string): string => {
  const response = (error as { response?: { status?: number; data?: { success?: boolean; message?: string } } })?.response;
  if (response?.data?.success === false && response.data.message) return response.data.message;
  if (response?.status === 429) return 'Too many tries in a row. Please wait a minute and try again.';
  if (response?.status === 422) return 'Check each email address and mobile number, then try again.';
  return fallback;
};

export default partyOrganizerService;
