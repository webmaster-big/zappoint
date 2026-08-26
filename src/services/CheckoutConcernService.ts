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

export type ConcernKind = 'schedule_help' | 'abandoned_checkout';
export type ConcernStatus = 'new' | 'contacted' | 'resolved';
export type ConcernEntityType = 'package' | 'attraction' | 'event';

export interface CheckoutConcernContext {
  step_label?: string;
  estimated_total?: number;
  page_url?: string;
  items?: { name: string; quantity: number }[];
  [key: string]: unknown;
}

export interface ScheduleConcernPayload {
  location_id: number;
  name: string;
  phone: string;
  email?: string;
  message?: string;
  entity_type?: ConcernEntityType;
  entity_id?: number;
  entity_name?: string;
  preferred_date?: string;
  preferred_time?: string;
  context?: CheckoutConcernContext;
}

export type AbandonedCheckoutPayload = Omit<ScheduleConcernPayload, 'message'>;

export interface CheckoutConcern {
  id: number;
  company_id: number;
  location_id: number;
  contact_id: number | null;
  kind: ConcernKind;
  name: string;
  phone: string;
  email: string | null;
  message: string | null;
  entity_type: ConcernEntityType | null;
  entity_id: number | null;
  entity_name: string | null;
  preferred_date: string | null;
  preferred_time: string | null;
  context: CheckoutConcernContext | null;
  status: ConcernStatus;
  handled_by: number | null;
  handled_at: string | null;
  resolution_note: string | null;
  alerted: {
    emails_sent?: string[];
    emails_failed?: { to: string; error: string }[];
    sms_sent?: string[];
    sms_failed?: { to: string; error: string }[];
  } | null;
  created_at: string;
  updated_at: string;
  location?: { id: number; name: string } | null;
  contact?: { id: number; email: string } | null;
  handler?: { id: number; first_name: string; last_name: string } | null;
}

export interface CheckoutConcernFilters {
  location_id?: number;
  kind?: ConcernKind;
  status?: ConcernStatus;
  open_only?: boolean;
  search?: string;
  page?: number;
  per_page?: number;
}

export interface CheckoutConcernPage {
  concerns: CheckoutConcern[];
  pagination: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
}

export interface CheckoutConcernStats {
  open: number;
  schedule_help: number;
  abandoned_checkout: number;
  today: number;
}

const strip = <T extends object>(payload: T): T => {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (value !== undefined && value !== null && value !== '') out[key] = value;
  }
  return out as T;
};

class CheckoutConcernService {
  async submitScheduleConcern(payload: ScheduleConcernPayload): Promise<string> {
    try {
      const { data } = await api.post('/checkout-concerns', strip(payload));
      return data?.message ?? 'Thanks — the team will contact you about this.';
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const body = err.response?.data as { message?: string; errors?: Record<string, string[]> } | undefined;
        const firstFieldError = body?.errors ? Object.values(body.errors)[0]?.[0] : undefined;
        throw new Error(firstFieldError || body?.message || 'We could not send that. Please call the venue directly.');
      }
      throw err;
    }
  }

  reportAbandonedCheckout(payload: AbandonedCheckoutPayload): void {
    const url = `${API_BASE_URL}/checkout-concerns/abandoned`;
    const body = JSON.stringify(strip(payload));

    try {
      if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
        const blob = new Blob([body], { type: 'text/plain;charset=UTF-8' });
        if (navigator.sendBeacon(url, blob)) return;
      }
    } catch {
      void 0;
    }

    try {
      void fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
        body,
        keepalive: true,
      }).catch(() => undefined);
    } catch {
      void 0;
    }
  }

  async list(filters: CheckoutConcernFilters = {}): Promise<CheckoutConcernPage> {
    const { data } = await api.get('/checkout-concerns', { params: strip(filters) });
    return data.data;
  }

  async get(id: number): Promise<CheckoutConcern> {
    const { data } = await api.get(`/checkout-concerns/${id}`);
    return data.data;
  }

  async updateStatus(id: number, status: ConcernStatus, resolutionNote?: string): Promise<CheckoutConcern> {
    const { data } = await api.put(`/checkout-concerns/${id}`, {
      status,
      ...(resolutionNote ? { resolution_note: resolutionNote } : {}),
    });
    return data.data;
  }

  async statistics(locationId?: number): Promise<CheckoutConcernStats> {
    const { data } = await api.get('/checkout-concerns/statistics', {
      params: locationId ? { location_id: locationId } : {},
    });
    return data.data;
  }
}

export const checkoutConcernService = new CheckoutConcernService();
export default checkoutConcernService;
