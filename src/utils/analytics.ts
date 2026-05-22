/**
 * Customer-side page-view + engagement event tracking.
 *
 * Server-side conversions (booking_completed, purchase_completed, signup,
 * rsvp_submitted, refund_issued, …) are fired automatically by the backend,
 * so the FE only has to send page_view + the few engagement events the
 * backend can't infer (form_started, login, promo_validated, search_performed).
 */
import axios from 'axios';
import { API_BASE_URL } from './storage';
import { isAnalyticsDnt } from './analyticsHeaders';

export type AnalyticsEntityType =
  | 'package'
  | 'attraction'
  | 'event'
  | 'booking'
  | 'attraction_purchase'
  | 'event_purchase'
  | 'gift_card'
  | 'promo';

export type AnalyticsEventType = 'page_view' | 'engagement' | 'conversion';

export interface TrackPayload {
  event_type?: AnalyticsEventType;
  event_name?: string;
  page_type?: string;
  page_url?: string;
  page_path?: string;
  page_title?: string;
  referrer?: string | null;
  entity_type?: AnalyticsEntityType;
  entity_id?: number;
  location_id?: number;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
  metadata?: Record<string, unknown>;
}

const TRACK_URL = `${API_BASE_URL}/analytics/track`;
const DURATION_URL = `${API_BASE_URL}/analytics/duration`;
const BATCH_URL = `${API_BASE_URL}/analytics/track/batch`;

let lastViewId: number | null = null;
let lastViewStartedAt = 0;
let maxScroll = 0;

const readUtmFromQuery = (): Partial<TrackPayload> => {
  if (typeof window === 'undefined') return {};
  const q = new URLSearchParams(window.location.search);
  const out: Partial<TrackPayload> = {};
  const map: Array<[string, keyof TrackPayload]> = [
    ['utm_source', 'utm_source'],
    ['utm_medium', 'utm_medium'],
    ['utm_campaign', 'utm_campaign'],
    ['utm_term', 'utm_term'],
    ['utm_content', 'utm_content'],
  ];
  for (const [k, prop] of map) {
    const v = q.get(k);
    if (v) (out as Record<string, string>)[prop] = v;
  }
  return out;
};

/**
 * Fire a page_view (default) or any other analytics event. Safe to await or
 * fire-and-forget — failures never throw.
 */
export async function trackPageView(p: TrackPayload = {}): Promise<void> {
  if (isAnalyticsDnt() || typeof window === 'undefined') return;
  const utm = readUtmFromQuery();
  const body = {
    event_type: 'page_view' as AnalyticsEventType,
    event_name: 'page_view',
    page_url: window.location.href,
    page_path: window.location.pathname,
    page_title: document.title,
    referrer: document.referrer || null,
    ...utm,
    ...p,
  };

  try {
    const r = await axios.post(TRACK_URL, body);
    // Only retain the id when this was an actual page_view — engagement
    // events shouldn't overwrite the duration/scroll target.
    if ((body.event_type ?? 'page_view') === 'page_view') {
      const id = r?.data?.data?.id;
      if (typeof id === 'number') {
        lastViewId = id;
        lastViewStartedAt = Date.now();
        maxScroll = 0;
      }
    }
  } catch {
    /* swallow — analytics must never break the app */
  }
}

let listenersInstalled = false;

/**
 * Install the global scroll-depth + pagehide-duration listeners. Idempotent —
 * safe to call multiple times. Call once from `main.tsx`.
 */
export function setupAnalytics(): void {
  if (listenersInstalled || typeof window === 'undefined') return;
  listenersInstalled = true;

  window.addEventListener(
    'scroll',
    () => {
      try {
        const docHeight = document.body.scrollHeight || 1;
        const s = Math.round(((window.scrollY + window.innerHeight) / docHeight) * 100);
        if (s > maxScroll) maxScroll = Math.min(s, 100);
      } catch {
        /* ignore */
      }
    },
    { passive: true }
  );

  const flushDuration = () => {
    if (lastViewId == null || isAnalyticsDnt()) return;
    try {
      const body = JSON.stringify({
        id: lastViewId,
        duration_ms: Date.now() - lastViewStartedAt,
        scroll_depth: maxScroll,
      });
      const blob = new Blob([body], { type: 'application/json' });
      if (navigator.sendBeacon && navigator.sendBeacon(DURATION_URL, blob)) {
        // sent
      } else {
        // Fallback — best-effort fetch with keepalive.
        void fetch(DURATION_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
          keepalive: true,
        }).catch(() => undefined);
      }
    } catch {
      /* ignore */
    }
  };

  window.addEventListener('pagehide', flushDuration);
  // Some browsers don't fire `pagehide` reliably; visibility-change is a
  // safety net for mobile tab-switch scenarios.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushDuration();
  });
}

/**
 * Batch-send queued events. Currently exposed for parity with the backend
 * spec; the FE doesn't queue events by default.
 */
export function sendAnalyticsBatch(events: TrackPayload[]): void {
  if (!events?.length || isAnalyticsDnt() || typeof navigator === 'undefined') return;
  try {
    const blob = new Blob([JSON.stringify({ events })], { type: 'application/json' });
    if (!navigator.sendBeacon || !navigator.sendBeacon(BATCH_URL, blob)) {
      void fetch(BATCH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events }),
        keepalive: true,
      }).catch(() => undefined);
    }
  } catch {
    /* ignore */
  }
}
