import axios, { type AxiosInstance } from 'axios';
import { API_BASE_URL, getStoredUser } from '../utils/storage';

const api: AxiosInstance = axios.create({
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

api.interceptors.request.use((config) => {
  try {
    const TRACKING_HEADERS = [
      'X-Visitor-Id', 'x-visitor-id',
      'X-Session-Id', 'x-session-id',
      'X-Analytics-Source', 'x-analytics-source',
      'X-Tracking-Id', 'x-tracking-id',
    ];
    const h = config.headers;
    if (typeof (h as { delete?: (k: string) => void }).delete === 'function') {
      const del = (h as { delete: (k: string) => void }).delete.bind(h);
      TRACKING_HEADERS.forEach(del);
    } else {
      const plain = h as Record<string, unknown>;
      TRACKING_HEADERS.forEach((k) => { delete plain[k]; });
    }
  } catch {
  }
  return config;
});


export type AnalyticsEntityType =
  | 'package'
  | 'attraction'
  | 'event'
  | 'booking'
  | 'attraction_purchase'
  | 'event_purchase'
  | 'gift_card'
  | 'promo';

export type Bucket = 'hour' | 'day' | 'week' | 'month';

export interface DateRangeFilter {
  from?: string; // YYYY-MM-DD
  to?: string;   // YYYY-MM-DD
  location_id?: number;
}

export interface OverviewMetrics {
  page_views: number;
  unique_visitors: number;
  new_visitors?: number;
  returning_visitors?: number;
  sessions: number;
  conversions: number;
  conversion_rate: number;
  conversion_value: number;
  bounce_rate: number;
  avg_duration_ms: number;
}

export interface TimeseriesPoint {
  bucket: string;
  page_views: number;
  conversions: number;
  revenue: number;
}

export interface TimeseriesResponse {
  bucket: Bucket;
  series: TimeseriesPoint[];
}

export interface TopPageRow {
  page_path: string;
  page_title?: string | null;
  page_type?: string | null;
  views: number;
  unique_visitors: number;
  avg_duration_ms: number;
  conversions: number;
  revenue: number;
  conversion_rate: number;
}

export interface TopEntityRow {
  entity_type: AnalyticsEntityType;
  entity_id: number;
  name?: string | null;
  views: number;
  unique_visitors: number;
  conversions?: number;
  revenue?: number;
}

export interface LeaderboardRow {
  entity_type: AnalyticsEntityType;
  entity_id: number;
  name?: string | null;
  views: number;
  unique_visitors: number;
  sessions: number;
  form_starts: number;
  conversions: number;
  revenue: number;
  conversion_rate: number;
  avg_duration_ms: number;
}

export interface SourceRow {
  source?: string | null;
  medium?: string | null;
  campaign?: string | null;
  visits: number;
  conversions: number;
  revenue: number;
}

export interface ReferrerRow {
  referrer: string;
  visits: number;
  conversions: number;
  revenue: number;
}

export interface SourcesResponse {
  utm: SourceRow[];
  direct: SourceRow[];
  referrers: ReferrerRow[];
}

export interface DeviceRow {
  name: string;
  visits: number;
  share?: number;
}

export interface DevicesResponse {
  devices: DeviceRow[];
  browsers: DeviceRow[];
  oses: DeviceRow[];
  sources: DeviceRow[];
}

export interface FunnelStep {
  step: string;
  count: number;
  rate?: number;
}

export interface ConversionRow {
  id: number;
  event_name: string;
  entity_type?: AnalyticsEntityType | null;
  entity_id?: number | null;
  entity_name?: string | null;
  conversion_value: number;
  page_path?: string | null;
  created_at: string;
  visitor_id?: string | null;
  session_id?: string | null;
  utm_source?: string | null;
  utm_campaign?: string | null;
}

export interface PaginatedResponse<T> {
  data: T[];
  current_page: number;
  per_page: number;
  total: number;
  last_page: number;
}

export interface LiveResponse {
  active_visitors: number;
  active_sessions: number;
  by_page: Array<{ page_path: string; page_title?: string | null; visitors: number }>;
}

export interface LandingPageRow {
  page_path: string;
  page_title?: string | null;
  entries: number;
  bounces: number;
  bounce_rate: number;
  conversions: number;
  revenue: number;
}

export interface SessionDetailResponse {
  session_id: string;
  visitor_id?: string | null;
  started_at: string;
  ended_at?: string | null;
  totals: {
    page_views: number;
    engagements: number;
    conversions: number;
    revenue: number;
    duration_ms: number;
  };
  events: Array<{
    id: number;
    event_type: string;
    event_name: string;
    page_path?: string | null;
    page_title?: string | null;
    value?: number;
    created_at: string;
  }>;
}

export interface SearchesResponse {
  top_queries: Array<{ query: string; searches: number; results_avg: number }>;
  zero_result_queries: Array<{ query: string; searches: number }>;
}

export interface PromoPerformanceRow {
  promo_id: number;
  code: string;
  validations: number;
  applications: number;
  failures: number;
  revenue: number;
}

export interface GiftCardPerformanceRow {
  entity_id: number;
  code: string;
  redemptions: number;
  amount_redeemed: number;
  balance: number;
  initial_value: number;
}

export interface AttributionRow {
  source?: string | null;
  medium?: string | null;
  campaign?: string | null;
  first_touch_revenue: number;
  last_touch_revenue: number;
}

export interface EntityDetailResponse {
  entity_type: AnalyticsEntityType;
  entity_id: number;
  name?: string | null;
  totals: OverviewMetrics & {
    form_starts?: number;
    form_start_rate?: number;
    form_finish_rate?: number;
  };
  timeseries: TimeseriesPoint[];
  by_path: Array<{
    page_path: string;
    location_id?: number | null;
    location_name?: string | null;
    views: number;
    conversions: number;
    revenue: number;
  }>;
  sources: SourcesResponse;
  devices: DevicesResponse;
  countries: Array<{ country: string | null; visits: number }>;
  recent_conversions: ConversionRow[];
}


const buildParams = (filter: DateRangeFilter, extra: Record<string, unknown> = {}) => {
  const out: Record<string, unknown> = {};
  if (filter.from) out.from = filter.from;
  if (filter.to) out.to = filter.to;
  if (filter.location_id) out.location_id = filter.location_id;
  for (const [k, v] of Object.entries(extra)) {
    if (v !== undefined && v !== null && v !== '') out[k] = v;
  }
  return out;
};

const unwrap = <T,>(payload: unknown): T => {
  if (payload && typeof payload === 'object' && 'data' in (payload as Record<string, unknown>)) {
    return (payload as { data: T }).data;
  }
  return payload as T;
};

const pick = <T = unknown>(row: Record<string, unknown>, keys: string[], fallback?: T): T => {
  for (const k of keys) {
    const v = row[k];
    if (v !== undefined && v !== null) return v as T;
  }
  return fallback as T;
};

const toNumber = (v: unknown, def = 0): number => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : def;
};

const normalizeLeaderboardRow = (raw: unknown, defaultEntityType: AnalyticsEntityType): LeaderboardRow => {
  const r = (raw && typeof raw === 'object') ? (raw as Record<string, unknown>) : {};
  return {
    entity_type: pick<AnalyticsEntityType>(r, ['entity_type', 'type'], defaultEntityType),
    entity_id: toNumber(pick(r, ['entity_id', 'id'])),
    name: pick<string | null>(r, ['name', 'title', 'label'], null),
    views: toNumber(pick(r, ['views', 'page_views', 'view_count'])),
    unique_visitors: toNumber(pick(r, ['unique_visitors', 'visitors', 'visitor_count'])),
    sessions: toNumber(pick(r, ['sessions', 'session_count'])),
    form_starts: toNumber(pick(r, ['form_starts', 'starts'])),
    conversions: toNumber(pick(r, ['conversions', 'conversion_count'])),
    revenue: toNumber(pick(r, ['revenue', 'conversion_value', 'value'])),
    conversion_rate: toNumber(pick(r, ['conversion_rate', 'cvr', 'rate'])),
    avg_duration_ms: toNumber(pick(r, ['avg_duration_ms', 'avg_duration', 'duration_ms'])),
  };
};

const normalizeFunnelStep = (raw: unknown): FunnelStep => {
  const r = (raw && typeof raw === 'object') ? (raw as Record<string, unknown>) : {};
  const rawStep = String(pick(r, ['step', 'name', 'label', 'stage'], ''));
  const step = rawStep
    ? rawStep.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
    : '';
  return {
    step,
    count: toNumber(pick(r, ['count', 'visitors', 'value', 'visits', 'total'])),
    rate: r.rate !== undefined ? toNumber(r.rate) : undefined,
  };
};

const normalizeDeviceRow = (raw: unknown): DeviceRow => {
  const r = (raw && typeof raw === 'object') ? (raw as Record<string, unknown>) : {};
  return {
    name: String(pick(r, ['name', 'device_type', 'device', 'label', 'browser', 'os', 'source'], 'Unknown')),
    visits: toNumber(pick(r, ['visits', 'views', 'count', 'value', 'sessions'])),
    share: r.share !== undefined ? toNumber(r.share) : undefined,
  };
};


const PageAnalyticsService = {
  async getOverview(filter: DateRangeFilter): Promise<OverviewMetrics> {
    const r = await api.get('/page-analytics/overview', { params: buildParams(filter) });
    return unwrap<OverviewMetrics>(r.data);
  },

  async getTimeseries(filter: DateRangeFilter, bucket: Bucket = 'day'): Promise<TimeseriesResponse> {
    const r = await api.get('/page-analytics/timeseries', { params: buildParams(filter, { bucket }) });
    return unwrap<TimeseriesResponse>(r.data);
  },

  async getTopPages(filter: DateRangeFilter, limit = 10): Promise<TopPageRow[]> {
    const r = await api.get('/page-analytics/top-pages', { params: buildParams(filter, { limit }) });
    const d = unwrap<TopPageRow[] | { rows: TopPageRow[] }>(r.data);
    return Array.isArray(d) ? d : d.rows ?? [];
  },

  async getTopEntities(
    filter: DateRangeFilter,
    entityType: AnalyticsEntityType,
    limit = 10
  ): Promise<TopEntityRow[]> {
    const r = await api.get('/page-analytics/top-entities', {
      params: buildParams(filter, { entity_type: entityType, limit }),
    });
    const d = unwrap<TopEntityRow[] | { rows: TopEntityRow[] }>(r.data);
    return Array.isArray(d) ? d : d.rows ?? [];
  },

  async getEntitiesLeaderboard(
    filter: DateRangeFilter,
    entityType: AnalyticsEntityType,
    sort: 'views' | 'unique_visitors' | 'conversions' | 'revenue' | 'conversion_rate' | 'form_starts' = 'revenue',
    limit = 50
  ): Promise<LeaderboardRow[]> {
    const r = await api.get('/page-analytics/entities-leaderboard', {
      params: buildParams(filter, { entity_type: entityType, sort, limit }),
    });
    const d = unwrap<{ rows: LeaderboardRow[] } | LeaderboardRow[]>(r.data);
    const list = Array.isArray(d) ? d : (d?.rows ?? []);
    return (Array.isArray(list) ? list : []).map((row) => normalizeLeaderboardRow(row, entityType));
  },

  async getEntityDetail(
    entityType: AnalyticsEntityType,
    entityId: number,
    filter: DateRangeFilter,
    bucket: Bucket = 'day'
  ): Promise<EntityDetailResponse> {
    const r = await api.get(`/page-analytics/entities/${entityType}/${entityId}`, {
      params: buildParams(filter, { bucket }),
    });
    const d = unwrap<Record<string, unknown>>(r.data) as Record<string, unknown> ?? {};
    const totals = (d.totals ?? {}) as Record<string, unknown>;
    const entityInfo = d.entity as Record<string, unknown> | undefined;
    const normSrc = (row: unknown): SourceRow => {
      const s = (row && typeof row === 'object') ? row as Record<string, unknown> : {};
      return {
        source:      (s.source   ?? s.utm_source   ?? null) as string | null,
        medium:      (s.medium   ?? s.utm_medium   ?? null) as string | null,
        campaign:    (s.campaign ?? s.utm_campaign ?? null) as string | null,
        visits:      toNumber(s.visits ?? s.views ?? s.count),
        conversions: toNumber(s.conversions),
        revenue:     toNumber(s.revenue),
      };
    };
    const normRef = (row: unknown): ReferrerRow => {
      const s = (row && typeof row === 'object') ? row as Record<string, unknown> : {};
      return { referrer: String(s.referrer ?? ''), visits: toNumber(s.visits ?? s.views), conversions: toNumber(s.conversions), revenue: toNumber(s.revenue) };
    };
    const srcObj = (d.sources ?? {}) as Record<string, unknown>;
    const rawDirect = srcObj.direct;
    const directArr: SourceRow[] = rawDirect
      ? (Array.isArray(rawDirect) ? rawDirect : [rawDirect]).map(normSrc)
      : [];
    const tsRaw = d.timeseries as { series?: TimeseriesPoint[] } | TimeseriesPoint[] | undefined;
    const timeseries: TimeseriesPoint[] = Array.isArray(tsRaw)
      ? tsRaw
      : (Array.isArray((tsRaw as { series?: TimeseriesPoint[] })?.series) ? (tsRaw as { series: TimeseriesPoint[] }).series : []);
    return {
      entity_type: ((entityInfo?.type ?? d.entity_type ?? entityType) as AnalyticsEntityType),
      entity_id:   toNumber(entityInfo?.id ?? d.entity_id ?? entityId),
      name:        ((entityInfo?.name ?? d.name ?? null) as string | null),
      totals: {
        page_views:       toNumber(totals.page_views),
        unique_visitors:  toNumber(totals.unique_visitors),
        sessions:         toNumber(totals.sessions),
        conversions:      toNumber(totals.conversions),
        conversion_value: toNumber(totals.conversion_value),
        conversion_rate:  toNumber(totals.conversion_rate),
        bounce_rate:      toNumber(totals.bounce_rate),
        avg_duration_ms:  toNumber(totals.avg_duration_ms),
        new_visitors:     toNumber(totals.new_visitors),
        form_starts:      totals.form_starts !== undefined ? toNumber(totals.form_starts) : undefined,
        form_start_rate:  totals.form_start_rate !== undefined ? toNumber(totals.form_start_rate) : undefined,
        form_finish_rate: totals.form_finish_rate !== undefined ? toNumber(totals.form_finish_rate) : undefined,
      },
      timeseries,
      by_path: Array.isArray(d.by_path)
        ? (d.by_path as Array<Record<string, unknown>>).map((p) => ({
            page_path:     String(p.page_path ?? ''),
            location_id:   p.location_id != null ? toNumber(p.location_id) : null,
            location_name: (p.location_name ?? null) as string | null,
            views:         toNumber(p.views),
            conversions:   toNumber(p.conversions),
            revenue:       toNumber(p.revenue),
          }))
        : [],
      sources: {
        utm:       Array.isArray(srcObj.utm)       ? (srcObj.utm as unknown[]).map(normSrc) : [],
        direct:    directArr,
        referrers: Array.isArray(srcObj.referrers) ? (srcObj.referrers as unknown[]).map(normRef) : [],
      },
      devices: (() => {
        const raw = d.devices as unknown;
        if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
          const obj = raw as Partial<DevicesResponse>;
          return {
            devices:  (Array.isArray(obj.devices)  ? obj.devices  : []).map(normalizeDeviceRow),
            browsers: (Array.isArray(obj.browsers) ? obj.browsers : []).map(normalizeDeviceRow),
            oses:     (Array.isArray(obj.oses)     ? obj.oses     : []).map(normalizeDeviceRow),
            sources:  (Array.isArray(obj.sources)  ? obj.sources  : []).map(normalizeDeviceRow),
          };
        }
        return {
          devices:  Array.isArray(raw) ? (raw as unknown[]).map(normalizeDeviceRow) : [],
          browsers: [],
          oses:     [],
          sources:  [],
        };
      })(),
      countries: Array.isArray(d.countries)
        ? (d.countries as Array<Record<string, unknown>>).map((c) => ({
            country: (c.country ?? null) as string | null,
            visits:  toNumber(c.visits ?? c.views),
          }))
        : [],
      recent_conversions: Array.isArray(d.recent_conversions) ? d.recent_conversions as ConversionRow[] : [],
    };
  },

  async getSources(filter: DateRangeFilter): Promise<SourcesResponse> {
    const r = await api.get('/page-analytics/sources', { params: buildParams(filter) });
    const d = unwrap<Record<string, unknown>>(r.data) as Record<string, unknown> || {};
    const normalizeSourceRow = (row: unknown): SourceRow => {
      const s = (row && typeof row === 'object') ? row as Record<string, unknown> : {};
      return {
        source:   (s.source   ?? s.utm_source   ?? null) as string | null,
        medium:   (s.medium   ?? s.utm_medium   ?? null) as string | null,
        campaign: (s.campaign ?? s.utm_campaign ?? null) as string | null,
        visits:   toNumber(s.visits ?? s.views ?? s.count),
        conversions: toNumber(s.conversions),
        revenue:  toNumber(s.revenue),
      };
    };
    const rawDirect = d.direct;
    const directArr: SourceRow[] = rawDirect
      ? (Array.isArray(rawDirect) ? rawDirect : [rawDirect]).map(normalizeSourceRow)
      : [];
    const normalizeReferrer = (row: unknown): ReferrerRow => {
      const s = (row && typeof row === 'object') ? row as Record<string, unknown> : {};
      return {
        referrer:    String(s.referrer ?? ''),
        visits:      toNumber(s.visits ?? s.views ?? s.count),
        conversions: toNumber(s.conversions),
        revenue:     toNumber(s.revenue),
      };
    };
    return {
      utm:       Array.isArray(d.utm)       ? (d.utm as unknown[]).map(normalizeSourceRow) : [],
      direct:    directArr,
      referrers: Array.isArray(d.referrers) ? (d.referrers as unknown[]).map(normalizeReferrer) : [],
    };
  },

  async getDevices(filter: DateRangeFilter): Promise<DevicesResponse> {
    const r = await api.get('/page-analytics/devices', { params: buildParams(filter) });
    const d = unwrap<Partial<DevicesResponse>>(r.data) || {};
    return {
      devices:  (Array.isArray(d.devices)  ? d.devices  : []).map(normalizeDeviceRow),
      browsers: (Array.isArray(d.browsers) ? d.browsers : []).map(normalizeDeviceRow),
      oses:     (Array.isArray(d.oses)     ? d.oses     : []).map(normalizeDeviceRow),
      sources:  (Array.isArray(d.sources)  ? d.sources  : []).map(normalizeDeviceRow),
    };
  },

  async getFunnel(filter: DateRangeFilter): Promise<FunnelStep[]> {
    const r = await api.get('/page-analytics/funnel', { params: buildParams(filter) });
    const d = unwrap<FunnelStep[] | { steps: FunnelStep[] }>(r.data);
    const list = Array.isArray(d) ? d : (d?.steps ?? []);
    return (Array.isArray(list) ? list : []).map(normalizeFunnelStep);
  },

  async getConversions(
    filter: DateRangeFilter,
    page = 1,
    perPage = 20
  ): Promise<PaginatedResponse<ConversionRow>> {
    const r = await api.get('/page-analytics/conversions', {
      params: buildParams(filter, { page, per_page: perPage }),
    });
    const raw = r.data as Record<string, unknown>;
    if (raw && Array.isArray(raw.data) && raw.pagination && typeof raw.pagination === 'object') {
      const pg = raw.pagination as { current_page?: number; last_page?: number; per_page?: number; total?: number };
      return {
        data: raw.data as ConversionRow[],
        current_page: pg.current_page ?? 1,
        last_page: pg.last_page ?? 1,
        per_page: pg.per_page ?? perPage,
        total: pg.total ?? 0,
      };
    }
    const d = unwrap<PaginatedResponse<ConversionRow> | ConversionRow[]>(r.data);
    if (Array.isArray(d)) {
      return { data: d, current_page: 1, per_page: d.length || perPage, total: d.length, last_page: 1 };
    }
    return { ...d, data: Array.isArray(d.data) ? d.data : [] };
  },

  async getEvents(
    filter: DateRangeFilter,
    page = 1,
    perPage = 50,
    eventType?: string,
    eventName?: string
  ): Promise<PaginatedResponse<ConversionRow>> {
    const r = await api.get('/page-analytics/events', {
      params: buildParams(filter, {
        page,
        per_page: perPage,
        event_type: eventType,
        event_name: eventName,
      }),
    });
    return unwrap<PaginatedResponse<ConversionRow>>(r.data);
  },

  async getLive(minutes = 5, locationId?: number): Promise<LiveResponse> {
    const r = await api.get('/page-analytics/live', {
      params: { minutes, ...(locationId ? { location_id: locationId } : {}) },
    });
    const d = unwrap<Record<string, unknown>>(r.data) as Record<string, unknown> || {};
    const byPage = Array.isArray(d.by_page)
      ? (d.by_page as Array<Record<string, unknown>>).map((p) => ({
          page_path:  String(p.page_path ?? ''),
          page_title: (p.page_title ?? null) as string | null,
          visitors:   toNumber(p.visitors ?? p.active_sessions),
        }))
      : [];
    return {
      active_visitors: toNumber(d.active_visitors),
      active_sessions: toNumber(d.active_sessions),
      by_page: byPage,
    };
  },

  async getLandingPages(filter: DateRangeFilter, limit = 10): Promise<LandingPageRow[]> {
    const r = await api.get('/page-analytics/landing-pages', { params: buildParams(filter, { limit }) });
    const d = unwrap<LandingPageRow[] | { rows: LandingPageRow[] }>(r.data);
    const rows = Array.isArray(d) ? d : (d as { rows?: LandingPageRow[] }).rows ?? [];
    return rows.map((row) => {
      const raw = row as unknown as Record<string, unknown>;
      return {
        page_path:   String(raw.page_path ?? ''),
        page_title:  (raw.page_title ?? null) as string | null,
        entries:     toNumber(raw.entries ?? raw.sessions),
        bounces:     toNumber(raw.bounces),
        bounce_rate: toNumber(raw.bounce_rate),
        conversions: toNumber(raw.conversions),
        revenue:     toNumber(raw.revenue),
      };
    });
  },

  async getSession(sessionId: string): Promise<SessionDetailResponse> {
    const r = await api.get(`/page-analytics/sessions/${encodeURIComponent(sessionId)}`);
    return unwrap<SessionDetailResponse>(r.data);
  },

  async getSearches(filter: DateRangeFilter): Promise<SearchesResponse> {
    const r = await api.get('/page-analytics/searches', { params: buildParams(filter) });
    const d = unwrap<Record<string, unknown>>(r.data) as Record<string, unknown> || {};
    const normalizeQuery = (arr: unknown[]): Array<{ query: string; searches: number; results_avg: number }> =>
      arr.map((item) => {
        const row = (item && typeof item === 'object') ? item as Record<string, unknown> : {};
        return {
          query:       String(row.query ?? row.q ?? ''),
          searches:    toNumber(row.searches),
          results_avg: toNumber(row.results_avg ?? row.avg_results),
        };
      });
    const topRaw     = (d.top_queries ?? d.top) as unknown[];
    const zeroRaw    = (d.zero_result_queries ?? d.zero_result) as unknown[];
    return {
      top_queries: Array.isArray(topRaw)
        ? normalizeQuery(topRaw)
        : [],
      zero_result_queries: Array.isArray(zeroRaw)
        ? zeroRaw.map((item) => {
            const row = (item && typeof item === 'object') ? item as Record<string, unknown> : {};
            return { query: String(row.query ?? row.q ?? ''), searches: toNumber(row.searches) };
          })
        : [],
    };
  },

  async getPromoPerformance(filter: DateRangeFilter): Promise<PromoPerformanceRow[]> {
    const r = await api.get('/page-analytics/promo-performance', { params: buildParams(filter) });
    const d = unwrap<PromoPerformanceRow[] | { rows: PromoPerformanceRow[] }>(r.data);
    const rows = Array.isArray(d) ? d : (d as { rows?: PromoPerformanceRow[] }).rows ?? [];
    return rows.map((row) => {
      const raw = row as unknown as Record<string, unknown>;
      return {
        promo_id:     toNumber(raw.promo_id ?? raw.entity_id),
        code:         String(raw.code ?? ''),
        validations:  toNumber(raw.validations),
        applications: toNumber(raw.applications),
        failures:     toNumber(raw.failures),
        revenue:      toNumber(raw.revenue ?? raw.revenue_attributed),
      };
    });
  },

  async getGiftCardPerformance(filter: DateRangeFilter): Promise<GiftCardPerformanceRow[]> {
    const r = await api.get('/page-analytics/gift-card-performance', { params: buildParams(filter) });
    const d = unwrap<GiftCardPerformanceRow[] | { rows: GiftCardPerformanceRow[] }>(r.data);
    const rows = Array.isArray(d) ? d : (d as { rows?: GiftCardPerformanceRow[] }).rows ?? [];
    return rows.map((row) => {
      const raw = row as unknown as Record<string, unknown>;
      return {
        entity_id:       toNumber(raw.entity_id),
        code:            String(raw.code ?? ''),
        redemptions:     toNumber(raw.redemptions),
        amount_redeemed: toNumber(raw.amount_redeemed),
        balance:         toNumber(raw.balance),
        initial_value:   toNumber(raw.initial_value),
      };
    });
  },

  async getAttribution(filter: DateRangeFilter): Promise<AttributionRow[]> {
    const r = await api.get('/page-analytics/attribution', { params: buildParams(filter) });
    const d = unwrap<Record<string, unknown>>(r.data) as Record<string, unknown>;
    if (d && !Array.isArray(d) && ('first_touch' in d || 'last_touch' in d)) {
      type TouchRow = { source?: string | null; medium?: string | null; campaign?: string | null; revenue?: number };
      const firstArr = Array.isArray(d.first_touch) ? d.first_touch as TouchRow[] : [];
      const lastArr  = Array.isArray(d.last_touch)  ? d.last_touch  as TouchRow[] : [];
      const merged = new Map<string, AttributionRow>();
      firstArr.forEach((row) => {
        const key = `${row.source ?? ''}|${row.medium ?? ''}|${row.campaign ?? ''}`;
        merged.set(key, {
          source: row.source ?? null,
          medium: row.medium ?? null,
          campaign: row.campaign ?? null,
          first_touch_revenue: toNumber(row.revenue),
          last_touch_revenue: 0,
        });
      });
      lastArr.forEach((row) => {
        const key = `${row.source ?? ''}|${row.medium ?? ''}|${row.campaign ?? ''}`;
        const existing = merged.get(key);
        if (existing) {
          existing.last_touch_revenue = toNumber(row.revenue);
        } else {
          merged.set(key, {
            source: row.source ?? null,
            medium: row.medium ?? null,
            campaign: row.campaign ?? null,
            first_touch_revenue: 0,
            last_touch_revenue: toNumber(row.revenue),
          });
        }
      });
      return Array.from(merged.values()).sort(
        (a, b) => (b.first_touch_revenue + b.last_touch_revenue) - (a.first_touch_revenue + a.last_touch_revenue)
      );
    }
    const list = Array.isArray(d) ? d : (d as { rows?: AttributionRow[] }).rows ?? [];
    return Array.isArray(list) ? list as AttributionRow[] : [];
  },
};

export default PageAnalyticsService;
