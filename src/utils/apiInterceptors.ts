import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';
import { enforceCacheOwnership, purgeAllZapzoneCaches } from './cacheGuard';

const SCOPE_LEAK_KEYS = ['user_id', 'userId'] as const;

void enforceCacheOwnership({ strict: true });

const stripScopeParams = (config: InternalAxiosRequestConfig): InternalAxiosRequestConfig => {
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

const notify = (message: string, type: 'error' | 'warning' = 'error') => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('api:notify', { detail: { message, type } }));
};

const isAuthEndpoint = (url?: string) => !!url && /\/auth\/(login|register|me)/.test(url);

const ADMIN_ROUTE_PREFIXES = ['/admin', '/manager', '/attendant', '/accounts', '/dashboard'];

const isAdminRoute = (path: string): boolean =>
  ADMIN_ROUTE_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));

const handleAuthError = (error: any) => {
  const status = error?.response?.status;
  const url: string | undefined = error?.config?.url;
  const message: string | undefined = error?.response?.data?.message;

  if (status === 401 && !isAuthEndpoint(url)) {
    let hadSession = false;
    try {
      hadSession = !!localStorage.getItem('zapzone_user');
    } catch {
    }

    const path = typeof window !== 'undefined' ? window.location.pathname : '';
    const onAdminRoute = isAdminRoute(path);

    if (hadSession && onAdminRoute) {
      try {
        localStorage.removeItem('zapzone_user');
        localStorage.removeItem('zapzone_customer');
      } catch {
      }
      void purgeAllZapzoneCaches();
      notify(message || 'Your session has expired. Please log in again.', 'warning');
      if (path !== '/admin' && !path.startsWith('/admin/register')) {
        window.location.assign('/admin');
      }
    }
  } else if (status === 403) {
    notify(message || 'You do not have access to this resource.', 'error');
  }

  return Promise.reject(error);
};

const attachAuthInterceptors = (instance: AxiosInstance): void => {
  instance.interceptors.request.use(stripScopeParams, (err) => Promise.reject(err));
  instance.interceptors.response.use((r) => r, handleAuthError);
};

const PATCH_FLAG = Symbol.for('zapzone.axios.create.patched');
const axiosAny = axios as unknown as { create: typeof axios.create; [k: symbol]: unknown };

if (!axiosAny[PATCH_FLAG]) {
  const originalCreate = axios.create.bind(axios);
  axios.create = ((...args: Parameters<typeof axios.create>) => {
    const instance = originalCreate(...args);
    attachAuthInterceptors(instance);
    return instance;
  }) as typeof axios.create;

  attachAuthInterceptors(axios as unknown as AxiosInstance);

  axiosAny[PATCH_FLAG] = true;
}

export { attachAuthInterceptors, stripScopeParams };
