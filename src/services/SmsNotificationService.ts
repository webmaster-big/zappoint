import axios from 'axios';
import { API_BASE_URL, getStoredUser } from '../utils/storage';

export interface SmsNotification {
  id: number;
  company_id: number;
  location_id: number | null;
  name: string;
  description: string | null;
  trigger_type: string;
  entity_type: 'package' | 'attraction' | 'event' | 'all';
  entity_ids: number[] | null;
  body: string | null;
  default_body: string | null;
  effective_body?: string;
  recipient_types: string[];
  custom_phones: string[] | null;
  is_active: boolean;
  is_default: boolean;
  default_key: string | null;
  send_before_hours: number | null;
  send_after_hours: number | null;
  is_body_customized?: boolean;
  character_count?: number;
  segment_count?: number;
  logs_count?: number;
}

export interface SmsOptions {
  trigger_types: Record<string, Record<string, string>>;
  entity_types: Record<string, string>;
  recipient_types: Record<string, string>;
  sms_configured: boolean;
}

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = getStoredUser()?.token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

const BASE = '/sms-notifications';

export const getSmsNotifications = async (params?: Record<string, unknown>) => {
  const res = await api.get(BASE, { params });
  return res.data as { success: boolean; data: { data: SmsNotification[] } };
};

export const getSmsOptions = async () => {
  const res = await api.get(`${BASE}/options`);
  return res.data as { success: boolean; data: SmsOptions };
};

export const updateSmsNotification = async (id: number, payload: Partial<SmsNotification>) => {
  const res = await api.put(`${BASE}/${id}`, payload);
  return res.data as { success: boolean; data: SmsNotification };
};

export const toggleSmsNotification = async (id: number) => {
  const res = await api.patch(`${BASE}/${id}/toggle-status`);
  return res.data as { success: boolean; data: SmsNotification };
};

export const resetSmsNotification = async (id: number) => {
  const res = await api.post(`${BASE}/${id}/reset-default`);
  return res.data as { success: boolean; data: SmsNotification };
};

export const sendTestSms = async (id: number, phone: string) => {
  const res = await api.post(`${BASE}/${id}/send-test`, { phone });
  return res.data as {
    success: boolean;
    message: string;
    data?: { provider_sid: string; segments: number; characters: number };
  };
};

export const seedSmsDefaults = async () => {
  const res = await api.post(`${BASE}/seed-defaults`);
  return res.data as { success: boolean; message: string };
};

/** GSM-7 vs UCS-2 aware segment count, mirrors the backend. */
export const smsSegments = (message: string): number => {
  const length = [...message].length;
  if (length === 0) return 0;
  const unicode = [...message].some((ch) => ch.charCodeAt(0) > 127);
  const single = unicode ? 70 : 160;
  const multi = unicode ? 67 : 153;
  return length <= single ? 1 : Math.ceil(length / multi);
};
