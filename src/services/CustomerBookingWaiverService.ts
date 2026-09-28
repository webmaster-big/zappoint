import axios from 'axios';
import { API_BASE_URL } from '../utils/storage';

export interface CustomerBookingWaiver {
  booking_id: number;
  waiver: {
    status: string;
    signing_url: string | null;
    signed_at: string | null;
  } | null;
  escape_room: {
    room_name: string;
    date: string;
    time_label: string;
    check_in_link: string | null;
    players_signed: number | null;
    people_covered?: number | null;
    players_booked: number;
    completed: boolean;
    completed_without_photo?: boolean;
    completion_label: string;
    photo_sent: boolean;
    players_sent: number;
    photo_link: string | null;
  } | null;
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

const customerBookingWaiverService = {
  getForBookings: async (bookingIds: number[]): Promise<CustomerBookingWaiver[]> => {
    if (bookingIds.length === 0 || !getCustomerToken()) return [];
    const response = await api.get('/customer-bookings/waivers', { params: { ids: bookingIds } });
    return response.data?.data?.bookings ?? [];
  },
};

export default customerBookingWaiverService;
