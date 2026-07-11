import axios from 'axios';
import { API_BASE_URL, getStoredUser } from '../utils/storage';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = getStoredUser()?.token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export type LocationChangeRequestStatus = 'pending' | 'approved' | 'rejected';

export interface LocationChangeRequest {
  id: number;
  booking_id: number;
  from_location_id: number;
  to_location_id: number;
  room_id: number | null;
  reason: string | null;
  status: LocationChangeRequestStatus;
  review_notes: string | null;
  requested_by: number | null;
  reviewed_by: number | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  booking?: {
    id: number;
    reference_number?: string;
    booking_date?: string;
    booking_time?: string;
    room_id?: number | null;
    guest_name?: string | null;
    customer?: { first_name?: string; last_name?: string } | null;
    package?: { name?: string } | null;
  } | null;
  from_location?: { id: number; name: string } | null;
  to_location?: { id: number; name: string } | null;
  room?: { id: number; name: string } | null;
  requester?: { id: number; name?: string } | null;
  reviewer?: { id: number; name?: string } | null;
}

export interface ConflictInfo {
  type: string;
  message: string;
}

export interface LocationChangeRequestResponse {
  success: boolean;
  message?: string;
  data?: LocationChangeRequest;
  conflict?: boolean;
  conflicts?: ConflictInfo[];
  had_conflict?: boolean;
}

const locationChangeRequestService = {
  async list(status?: LocationChangeRequestStatus): Promise<{ success: boolean; data: LocationChangeRequest[] }> {
    const response = await api.get('/location-change-requests', { params: status ? { status } : {} });
    return response.data;
  },

  async create(
    bookingId: number,
    data: { to_location_id: number; room_id?: number | null; reason?: string }
  ): Promise<LocationChangeRequestResponse> {
    const response = await api.post(`/bookings/${bookingId}/location-change-requests`, data);
    return response.data;
  },

  async approve(
    id: number,
    data?: { force?: boolean; review_notes?: string; room_id?: number | null }
  ): Promise<LocationChangeRequestResponse> {
    const response = await api.patch(`/location-change-requests/${id}/approve`, data || {});
    return response.data;
  },

  async reject(id: number, review_notes: string): Promise<LocationChangeRequestResponse> {
    const response = await api.patch(`/location-change-requests/${id}/reject`, { review_notes });
    return response.data;
  },
};

export default locationChangeRequestService;
