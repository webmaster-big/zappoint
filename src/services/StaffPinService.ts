import axios from 'axios';
import { API_BASE_URL, getStoredUser } from '../utils/storage';
import { getDeviceId } from '../utils/deviceId';
import { terminalHeaders } from '../utils/staffTerminal';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = getStoredUser()?.token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  Object.entries(terminalHeaders()).forEach(([key, value]) => {
    config.headers[key] = value;
  });
  return config;
});

export interface TerminalContext {
  registered: boolean;
  label?: string;
  location_id?: number;
  location_name?: string;
  ceiling_role?: string;
  idle_seconds?: number | null;
  idle_disabled?: boolean;
  elevated_idle_seconds?: number;
  pin_length?: number;
}

export interface PinSession {
  user: Record<string, unknown>;
  role: string;
  token: string;
  data: {
    effective_role: string;
    account_role: string;
    elevated: boolean;
    expires_at: string;
    idle_seconds: number | null;
    idle_disabled: boolean;
    terminal_label: string;
    location_id: number;
  };
}

export interface RosterEntry {
  id: number;
  name: string;
  email: string;
  role: string;
  status: string;
  location_id: number | null;
  has_pin: boolean;
  pin_set_at: string | null;
  locked: boolean;
  locked_until: string | null;
}

export interface TerminalRecord {
  id: number;
  label: string;
  device_id: string;
  location_id: number;
  ceiling_role: string;
  idle_seconds: number | null;
  idle_disabled: boolean;
  elevated_idle_seconds: number | null;
  last_seen_at: string | null;
  location?: { id: number; name: string };
}

export async function getTerminalContext(): Promise<TerminalContext> {
  const response = await api.get('/staff-pin/terminal-context');
  return (response.data?.data ?? { registered: false }) as TerminalContext;
}

export async function unlockWithPin(pin: string): Promise<PinSession> {
  const response = await api.post('/staff-pin/unlock', { pin });
  return response.data as PinSession;
}

export async function lockTerminal(reason = 'idle'): Promise<void> {
  await api.post('/staff-pin/lock', { reason });
}

export async function getPinStatus() {
  const response = await api.get('/staff-pin/status');
  return response.data?.data as {
    has_pin: boolean;
    set_at: string | null;
    locked: boolean;
    pin_length: number;
    can_manage: boolean;
  };
}

export async function setOwnPin(pin: string, currentPassword: string): Promise<void> {
  await api.post('/staff-pin/self', { pin, current_password: currentPassword });
}

export async function getRoster(): Promise<RosterEntry[]> {
  const response = await api.get('/staff-pin/roster');
  return (response.data?.data ?? []) as RosterEntry[];
}

export async function issuePin(userId: number, pin: string): Promise<void> {
  await api.post(`/staff-pin/users/${userId}`, { pin });
}

export async function clearPin(userId: number): Promise<void> {
  await api.delete(`/staff-pin/users/${userId}`);
}

export async function unlockPin(userId: number): Promise<void> {
  await api.post(`/staff-pin/users/${userId}/unlock`);
}

export async function listTerminals(): Promise<TerminalRecord[]> {
  const response = await api.get('/staff-terminals');
  return (response.data?.data ?? []) as TerminalRecord[];
}

export async function enrollTerminal(params: {
  label: string;
  locationId: number;
  idleSeconds?: number | null;
  idleDisabled?: boolean;
}): Promise<{ terminal: TerminalRecord; token: string }> {
  const response = await api.post('/staff-terminals', {
    device_id: getDeviceId(),
    label: params.label,
    location_id: params.locationId,
    idle_seconds: params.idleSeconds ?? null,
    idle_disabled: params.idleDisabled ?? false,
  });
  return response.data?.data as { terminal: TerminalRecord; token: string };
}

export async function updateTerminal(
  id: number,
  changes: Partial<{ label: string; idle_seconds: number | null; idle_disabled: boolean; elevated_idle_seconds: number | null }>
): Promise<TerminalRecord> {
  const response = await api.patch(`/staff-terminals/${id}`, changes);
  return response.data?.data as TerminalRecord;
}

export async function revokeTerminal(id: number): Promise<void> {
  await api.delete(`/staff-terminals/${id}`);
}
