import axios from 'axios';
import { API_BASE_URL } from './storage';
import { getSessionId, getVisitorId, isAnalyticsDnt, isTrackingSilencedHost } from './analyticsHeaders';

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
  visitor_id?: string;
  session_id?: string;
  entity_type?: AnalyticsEntityType;
  entity_id?: number;
  location_id?: number;
  location_slug?: string;
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
let armedPath: string | null = null;

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

const flushDuration = (): void => {
  if (lastViewId == null || isAnalyticsDnt()) return;
  try {
    const body = JSON.stringify({
      id: lastViewId,
      duration_ms: Date.now() - lastViewStartedAt,
      scroll_depth: maxScroll,
    });
    lastViewId = null;
    const blob = new Blob([body], { type: 'application/json' });
    if (navigator.sendBeacon && navigator.sendBeacon(DURATION_URL, blob)) {
    } else {
      void fetch(DURATION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true,
      }).catch(() => undefined);
    }
  } catch {
  }
};

export async function trackPageView(p: TrackPayload = {}): Promise<void> {
  if (isAnalyticsDnt() || isTrackingSilencedHost() || typeof window === 'undefined') return;
  flushDuration();
  armedPath = window.location.pathname;
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
    if ((body.event_type ?? 'page_view') === 'page_view') {
      const id = r?.data?.data?.id;
      if (typeof id === 'number') {
        lastViewId = id;
        lastViewStartedAt = Date.now();
        maxScroll = 0;
      }
    }
  } catch {
  }
}

let listenersInstalled = false;

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
      }
    },
    { passive: true }
  );

  window.addEventListener('pagehide', flushDuration);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushDuration();
  });

  document.addEventListener('click', recordClick, { capture: true, passive: true });
  window.addEventListener('pagehide', flushClicks);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushClicks();
  });
}

const CLICK_FLUSH_SIZE = 10;
const CLICK_FLUSH_DELAY_MS = 10000;
const CLICK_LABEL_MAX = 80;

let pendingClicks: TrackPayload[] = [];
let clickFlushTimer: ReturnType<typeof setTimeout> | null = null;

const flushClicks = (): void => {
  if (clickFlushTimer) {
    clearTimeout(clickFlushTimer);
    clickFlushTimer = null;
  }
  if (!pendingClicks.length) return;
  const events = pendingClicks;
  pendingClicks = [];
  for (let i = 0; i < events.length; i += 50) {
    sendAnalyticsBatch(events.slice(i, i + 50));
  }
};

const recordClick = (event: MouseEvent): void => {
  try {
    if (isAnalyticsDnt() || isTrackingSilencedHost() || typeof window === 'undefined') return;
    if (!armedPath || armedPath !== window.location.pathname) return;

    const target = event.target instanceof Element
      ? event.target.closest('button, a, [role="button"], input[type="submit"]')
      : null;
    if (!target) return;

    const label = (
      target.getAttribute('aria-label') ||
      (target as HTMLElement).innerText ||
      target.textContent ||
      (target as HTMLInputElement).value ||
      ''
    )
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, CLICK_LABEL_MAX);
    if (!label) return;

    const metadata: Record<string, unknown> = {
      label,
      tag: target.tagName.toLowerCase(),
    };
    const href = target instanceof HTMLAnchorElement ? target.getAttribute('href') : null;
    if (href) metadata.href = href.slice(0, 200);

    pendingClicks.push({
      event_type: 'engagement',
      event_name: 'click',
      page_url: window.location.href,
      page_path: window.location.pathname,
      page_title: document.title,
      visitor_id: getVisitorId(),
      session_id: getSessionId(),
      metadata,
    });

    if (pendingClicks.length >= CLICK_FLUSH_SIZE) {
      flushClicks();
    } else if (!clickFlushTimer) {
      clickFlushTimer = setTimeout(flushClicks, CLICK_FLUSH_DELAY_MS);
    }
  } catch {
  }
};

export function sendAnalyticsBatch(events: TrackPayload[]): void {
  if (!events?.length || isAnalyticsDnt() || isTrackingSilencedHost() || typeof navigator === 'undefined') return;
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
  }
}
