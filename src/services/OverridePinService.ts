import axios from 'axios';
import { API_BASE_URL, getStoredUser } from '../utils/storage';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
});

api.interceptors.request.use(config => {
  const token = getStoredUser()?.token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export interface OverridePinStatus {
  can_hold_pin: boolean;
  has_pin: boolean;
  set_at: string | null;
}

export interface OverrideApproval {
  token: string;
  approved_by: string;
  expires_in: number;
}

export async function getOverridePinStatus(): Promise<OverridePinStatus> {
  const response = await api.get('/override-pin');
  return response.data?.data as OverridePinStatus;
}

export async function setOverridePin(pin: string, currentPassword: string): Promise<void> {
  await api.post('/override-pin', { pin, current_password: currentPassword });
}

/**
 * Checks a manager's PIN and returns a short-lived token the booking write will accept. The token
 * is what proves the approval — a flag in the payload could simply be set by whoever is at the desk.
 */
export async function verifyOverridePin(
  pin: string,
  locationId: number,
  reason?: string
): Promise<OverrideApproval> {
  const response = await api.post('/override-pin/verify', { pin, location_id: locationId, reason });
  return response.data?.data as OverrideApproval;
}
