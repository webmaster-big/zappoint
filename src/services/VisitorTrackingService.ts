import axios from 'axios';
import { API_BASE_URL, getStoredUser } from '../utils/storage';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = getStoredUser()?.token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export interface VisitorSession {
  visitor_id: string;
  session_date: string;
  date_label: string;
  first_seen: string;
  last_seen: string;
  reached_checkout: boolean;
  guest_name: string | null;
  guest_phone: string | null;
  guest_email: string | null;
  first_seen_label: string;
  last_seen_label: string;
  page_views: number;
  clicks: number;
  conversions: number;
  duration_ms: number;
  entry_page: string | null;
  entry_title: string | null;
  exit_page: string | null;
  exit_title: string | null;
  device_type: string | null;
  browser: string | null;
}

export interface VisitorSessionExportRow extends VisitorSession {
  actions: string;
}

export interface VisitorSessionFilters {
  location_id?: number;
  date_from?: string;
  date_to?: string;
  identified?: 'known' | 'anonymous';
  device_type?: 'desktop' | 'mobile' | 'tablet';
  activity?: 'purchased' | 'clicked' | 'multi_page' | 'reached_checkout';
  search?: string;
  page?: number;
  per_page?: number;
  all?: boolean | number;
  limit?: number;
}

export interface VisitorSessionPage {
  sessions: VisitorSession[];
  pagination: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    capped?: boolean;
  };
}

export interface VisitorSessionStats {
  sessions_today: number;
  sessions_week: number;
  identified_today: number;
  identified_total: number;
}

export interface VisitorTimelineEvent {
  id: number;
  event_type: string;
  event_name: string;
  label: string | null;
  page_type: string | null;
  page_path: string | null;
  page_title: string | null;
  entity_type: string | null;
  entity_id: number | null;
  duration_ms: number | null;
  scroll_depth: number | null;
  conversion_value: number | null;
  time_label: string;
  created_at: string;
}

export interface VisitorSessionDetail {
  visitor_id: string;
  session_date: string;
  date_label: string;
  guest: { name: string; phone: string; email: string | null } | null;
  device: { device_type: string | null; browser: string | null; os: string | null };
  referrer: string | null;
  summary: {
    page_views: number;
    clicks: number;
    conversions: number;
    duration_ms: number;
    first_seen_label: string;
    last_seen_label: string;
  };
  timeline: VisitorTimelineEvent[];
}

const strip = (params: object): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '' || value === false) continue;
    out[key] = value === true ? 1 : value;
  }
  return out;
};

const ALL_SESSIONS_TTL_MS = 3 * 60 * 1000;
const allSessionsCache = new Map<string, { at: number; page: VisitorSessionPage }>();

class VisitorTrackingService {
  async list(filters: VisitorSessionFilters = {}): Promise<VisitorSessionPage> {
    const { data } = await api.get('/visitor-sessions', { params: strip(filters) });
    return data.data;
  }

  peekAll(filters: VisitorSessionFilters = {}, limit = 3000): VisitorSessionPage | null {
    const hit = allSessionsCache.get(JSON.stringify({ ...strip(filters), limit }));
    return hit && Date.now() - hit.at < ALL_SESSIONS_TTL_MS ? hit.page : null;
  }

  async listAll(filters: VisitorSessionFilters = {}, limit = 3000): Promise<VisitorSessionPage> {
    const { data } = await api.get('/visitor-sessions', { params: { ...strip(filters), all: 1, limit } });
    const page = data.data as VisitorSessionPage;
    allSessionsCache.set(JSON.stringify({ ...strip(filters), limit }), { at: Date.now(), page });
    return page;
  }

  async statistics(locationId?: number): Promise<VisitorSessionStats> {
    const { data } = await api.get('/visitor-sessions/statistics', {
      params: strip({ location_id: locationId }),
    });
    return data.data;
  }

  async detail(visitorId: string, date: string): Promise<VisitorSessionDetail> {
    const { data } = await api.get('/visitor-sessions/detail', {
      params: { visitor_id: visitorId, date },
    });
    return data.data;
  }

  async export(filters: VisitorSessionFilters = {}): Promise<{ sessions: VisitorSessionExportRow[]; truncated: boolean; max_sessions: number }> {
    const { data } = await api.get('/visitor-sessions/export', { params: strip(filters) });
    return data.data;
  }
}

export const visitorTrackingService = new VisitorTrackingService();
export default visitorTrackingService;
