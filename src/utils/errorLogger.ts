import { API_BASE_URL } from './storage';

export type ClientErrorKind = 'api' | 'render' | 'window' | 'promise';

export interface ClientErrorReport {
  message: string;
  kind: ClientErrorKind;
  action?: string;
  status?: number;
  requestId?: string;
  stack?: string;
}

const ENDPOINT = `${API_BASE_URL}/client-errors`;
const MAX_REPORTS_PER_SESSION = 25;
const REPEAT_WINDOW_MS = 60_000;

const lastSeen = new Map<string, number>();
let sent = 0;

const appVersion = (): string => {
  try {
    return (import.meta as { env?: Record<string, string> }).env?.VITE_APP_VERSION || 'dev';
  } catch {
    return 'dev';
  }
};

const shouldSend = (key: string, now: number): boolean => {
  if (sent >= MAX_REPORTS_PER_SESSION) return false;
  const previous = lastSeen.get(key);
  if (previous !== undefined && now - previous < REPEAT_WINDOW_MS) return false;
  lastSeen.set(key, now);
  return true;
};

export const reportClientError = (report: ClientErrorReport): void => {
  if (typeof window === 'undefined') return;

  const page = window.location?.pathname || '';
  const key = `${report.kind}|${report.status ?? ''}|${report.message}|${page}`;
  const now = Date.now();

  if (!shouldSend(key, now)) return;
  sent += 1;

  const body = JSON.stringify({
    message: report.message.slice(0, 500),
    kind: report.kind,
    page,
    action: report.action,
    status: report.status,
    request_id: report.requestId,
    stack: report.stack?.slice(0, 2000),
    app_version: appVersion(),
  });

  try {
    void fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body,
      keepalive: true,
      credentials: 'omit',
    }).catch(() => undefined);
  } catch {
    /* reporting must never break the page */
  }
};

export const isReportingEndpoint = (url?: string): boolean => !!url && url.includes('client-errors');

let installed = false;

export const installGlobalErrorReporting = (): void => {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  window.addEventListener('error', (event) => {
    const error = event.error as Error | undefined;
    reportClientError({
      kind: 'window',
      message: error?.message || event.message || 'Unknown window error',
      stack: error?.stack,
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason as { message?: string; stack?: string } | undefined;
    reportClientError({
      kind: 'promise',
      message: reason?.message || String(event.reason ?? 'Unhandled rejection').slice(0, 500),
      stack: reason?.stack,
    });
  });
};
