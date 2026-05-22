/**
 * Analytics request headers — injects X-Visitor-Id, X-Session-Id,
 * X-Analytics-Source (and optional X-Tracking-Id) into every axios request.
 *
 * Hooks into the same `axios.create` monkey-patch pattern used by
 * `apiInterceptors.ts` so every service-layer axios instance picks up the
 * headers automatically.
 *
 * Import this file from `main.tsx` AFTER `./utils/apiInterceptors` so both
 * patches stack.
 */
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
    /* fall through */
  }
  // RFC4122 v4 fallback
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
    // Storage may be unavailable (privacy mode). Fall back to a per-call UUID.
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

// ---------------------------------------------------------------------------
// One-shot per-conversion tracking ID. Call `setNextTrackingId()` from your
// "place order" / "submit RSVP" handler immediately before the POST that
// creates the booking / purchase. The next outgoing axios request consumes
// the value and clears it, so a stale ID can't leak into unrelated calls.
// ---------------------------------------------------------------------------
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
  // AxiosHeaders has a `.set()` method; plain objects don't.
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
        // Only set source if the caller hasn't already chosen one.
        const headers = config.headers as unknown as Record<string, unknown> | undefined;
        const hasSource = !!headers && (
          'X-Analytics-Source' in headers ||
          'x-analytics-source' in headers
        );
        if (!hasSource) setHeader(config, 'X-Analytics-Source', 'web');

        const tracking = consumePendingTrackingId();
        if (tracking) setHeader(config, 'X-Tracking-Id', tracking);
      } catch {
        /* never block a request because of analytics */
      }
      return config;
    },
    (err) => Promise.reject(err)
  );
};

// ---- Monkey-patch axios.create so every instance gets the headers ---------
const PATCH_FLAG = Symbol.for('zapzone.axios.create.analytics-patched');
const axiosAny = axios as unknown as { create: typeof axios.create; [k: symbol]: unknown };

if (!axiosAny[PATCH_FLAG]) {
  const originalCreate = axios.create.bind(axios);
  axios.create = ((...args: Parameters<typeof axios.create>) => {
    const instance = originalCreate(...args);
    attachAnalyticsHeaders(instance);
    return instance;
  }) as typeof axios.create;

  // Cover the default singleton too.
  attachAnalyticsHeaders(axios as unknown as AxiosInstance);

  axiosAny[PATCH_FLAG] = true;
}

export { attachAnalyticsHeaders };
