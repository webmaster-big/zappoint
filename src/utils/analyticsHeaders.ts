import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';

const VISITOR_KEY = 'analytics_visitor_id';
const SESSION_KEY = 'analytics_session_id';
const SESSION_TTL_KEY = 'analytics_session_exp';
const SESSION_TTL_MS = 30 * 60 * 1000; // 30 min idle window
const DNT_KEY = 'analytics_dnt';

const safeUuid = (): string => {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch {
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

const getOrMake = (key: string, store: Storage): string => {
  try {
    let v = store.getItem(key);
    if (!v) {
      v = safeUuid();
      store.setItem(key, v);
    }
    return v;
  } catch {
    return safeUuid();
  }
};

export const getVisitorId = (): string => {
  if (typeof window === 'undefined') return safeUuid();
  return getOrMake(VISITOR_KEY, window.localStorage);
};

export const getSessionId = (): string => {
  if (typeof window === 'undefined') return safeUuid();
  try {
    const exp = Number(sessionStorage.getItem(SESSION_TTL_KEY) ?? 0);
    if (!exp || Date.now() > exp) {
      sessionStorage.removeItem(SESSION_KEY);
    }
    const id = getOrMake(SESSION_KEY, sessionStorage);
    sessionStorage.setItem(SESSION_TTL_KEY, String(Date.now() + SESSION_TTL_MS));
    return id;
  } catch {
    return safeUuid();
  }
};

export const isAnalyticsDnt = (): boolean => {
  try {
    return typeof window !== 'undefined' && localStorage.getItem(DNT_KEY) === '1';
  } catch {
    return false;
  }
};

let pendingTrackingId: string | null = null;

export const setNextTrackingId = (id?: string): string => {
  pendingTrackingId = id ?? safeUuid();
  return pendingTrackingId;
};

export const peekPendingTrackingId = (): string | null => pendingTrackingId;

const consumePendingTrackingId = (): string | null => {
  const id = pendingTrackingId;
  pendingTrackingId = null;
  return id;
};

const setHeader = (config: InternalAxiosRequestConfig, name: string, value: string): void => {
  const headers = config.headers as unknown as Record<string, unknown> | undefined;
  if (!headers) return;
  if (typeof (headers as { set?: (k: string, v: string) => void }).set === 'function') {
    (headers as { set: (k: string, v: string) => void }).set(name, value);
  } else {
    (headers as Record<string, unknown>)[name] = value;
  }
};

const attachAnalyticsHeaders = (instance: AxiosInstance): void => {
  instance.interceptors.request.use(
    (config) => {
      try {
        if (isAnalyticsDnt()) return config;
        setHeader(config, 'X-Visitor-Id', getVisitorId());
        setHeader(config, 'X-Session-Id', getSessionId());
        const headers = config.headers as unknown as Record<string, unknown> | undefined;
        const hasSource = !!headers && (
          'X-Analytics-Source' in headers ||
          'x-analytics-source' in headers
        );
        if (!hasSource) setHeader(config, 'X-Analytics-Source', 'web');

        const tracking = consumePendingTrackingId();
        if (tracking) setHeader(config, 'X-Tracking-Id', tracking);
      } catch {
      }
      return config;
    },
    (err) => Promise.reject(err)
  );
};

const PATCH_FLAG = Symbol.for('zapzone.axios.create.analytics-patched');
const axiosAny = axios as unknown as { create: typeof axios.create; [k: symbol]: unknown };

if (!axiosAny[PATCH_FLAG]) {
  const originalCreate = axios.create.bind(axios);
  axios.create = ((...args: Parameters<typeof axios.create>) => {
    const instance = originalCreate(...args);
    attachAnalyticsHeaders(instance);
    return instance;
  }) as typeof axios.create;

  attachAnalyticsHeaders(axios as unknown as AxiosInstance);

  axiosAny[PATCH_FLAG] = true;
}

export { attachAnalyticsHeaders };
