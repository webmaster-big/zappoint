/**
 * Global axios interceptor patch.
 *
 * Implements the FE side of the multi-tenant data-isolation hardening
 * described in the backend integration guide:
 *
 *  1. The backend now derives `company_id` / `location_id` from the Sanctum
 *     token. Frontend code must stop sending `?user_id=`. To guarantee that
 *     no stale call leaks `user_id` (or `userId`) we transparently strip it
 *     from every outgoing request.
 *  2. The backend returns `403 Forbidden` on cross-tenant access and `401`
 *     on missing/expired tokens. We install a single response interceptor
 *     that surfaces a friendly notification and, for 401, clears the stored
 *     session and redirects to login.
 *
 * Why monkey-patch `axios.create`?
 *   Each service file in `src/services/*` builds its own axios instance via
 *   `axios.create(...)`. Wrapping `axios.create` once — *before* any service
 *   module is imported — means every instance, current and future, picks up
 *   these interceptors automatically. No per-service edits required.
 *
 * Import this file FIRST in `main.tsx` so the patch is applied before any
 * service module evaluates.
 */
import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';
import { enforceCacheOwnership, purgeAllZapzoneCaches } from './cacheGuard';

const SCOPE_LEAK_KEYS = ['user_id', 'userId'] as const;

// Run at module load — before any service module fires its first request,
// purge any Cache Storage entries that don't belong to the current user.
// This closes the cross-tenant cache leak when a different user logs in on
// the same browser without going through the explicit sign-out flow.
//
// `strict: true` also drops caches that lack ownership metadata (some
// pages call `cacheXxx(list)` without passing `{ userId }`), since we have
// no way to attribute them safely.
void enforceCacheOwnership({ strict: true });

/** Remove tenant-scope params that the backend now ignores. */
const stripScopeParams = (config: InternalAxiosRequestConfig): InternalAxiosRequestConfig => {
  // 1. Object/URLSearchParams form: config.params
  if (config.params) {
    if (config.params instanceof URLSearchParams) {
      for (const key of SCOPE_LEAK_KEYS) config.params.delete(key);
    } else if (typeof config.params === 'object') {
      for (const key of SCOPE_LEAK_KEYS) {
        if (key in (config.params as Record<string, unknown>)) {
          delete (config.params as Record<string, unknown>)[key];
        }
      }
    }
  }

  // 2. Inline query-string form: config.url contains ?user_id=...&...
  if (typeof config.url === 'string' && config.url.includes('?')) {
    const [path, query] = config.url.split('?', 2);
    const sp = new URLSearchParams(query);
    let mutated = false;
    for (const key of SCOPE_LEAK_KEYS) {
      if (sp.has(key)) {
        sp.delete(key);
        mutated = true;
      }
    }
    if (mutated) {
      const remaining = sp.toString();
      config.url = remaining ? `${path}?${remaining}` : path;
    }
  }

  return config;
};

/** Dispatch a DOM event so any toast container in the app can show a message. */
const notify = (message: string, type: 'error' | 'warning' = 'error') => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('api:notify', { detail: { message, type } }));
};

const isAuthEndpoint = (url?: string) => !!url && /\/auth\/(login|register|me)/.test(url);

/** Centralised response handling for 401 / 403. */
const handleAuthError = (error: any) => {
  const status = error?.response?.status;
  const url: string | undefined = error?.config?.url;
  const message: string | undefined = error?.response?.data?.message;

  if (status === 401 && !isAuthEndpoint(url)) {
    // Session expired or token rejected. Clear creds + cached tenant data
    // and bounce to login.
    try {
      localStorage.removeItem('zapzone_user');
      localStorage.removeItem('zapzone_customer');
    } catch {
      /* ignore */
    }
    void purgeAllZapzoneCaches();
    notify(message || 'Your session has expired. Please log in again.', 'warning');
    if (typeof window !== 'undefined') {
      const path = window.location.pathname;
      // Avoid redirect loops on the login screen itself.
      if (!path.startsWith('/login') && !path.startsWith('/auth')) {
        window.location.assign('/login');
      }
    }
  } else if (status === 403) {
    notify(message || 'You do not have access to this resource.', 'error');
  }

  return Promise.reject(error);
};

/** Attach both interceptors to a freshly-created axios instance. */
const attachAuthInterceptors = (instance: AxiosInstance): void => {
  instance.interceptors.request.use(stripScopeParams, (err) => Promise.reject(err));
  instance.interceptors.response.use((r) => r, handleAuthError);
};

// ---- Monkey-patch axios.create so every instance gets the interceptors -----
// Use a sentinel to make the patch idempotent (HMR / multiple imports).
const PATCH_FLAG = Symbol.for('zapzone.axios.create.patched');
const axiosAny = axios as unknown as { create: typeof axios.create; [k: symbol]: unknown };

if (!axiosAny[PATCH_FLAG]) {
  const originalCreate = axios.create.bind(axios);
  axios.create = ((...args: Parameters<typeof axios.create>) => {
    const instance = originalCreate(...args);
    attachAuthInterceptors(instance);
    return instance;
  }) as typeof axios.create;

  // Also cover code paths that use the default axios singleton directly.
  attachAuthInterceptors(axios as unknown as AxiosInstance);

  axiosAny[PATCH_FLAG] = true;
}

export { attachAuthInterceptors, stripScopeParams };
