import type { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import type { AvailabilityBlock } from '../services/DayOffService';
import { getStoredUser } from './storage';

export const ACKNOWLEDGE_BLOCKED_PERIOD = 'acknowledge_blocked_period';
export const ACKNOWLEDGED_BLOCK_IDS = 'acknowledged_block_ids';

const REMEMBER_FOR_MS = 5 * 60 * 1000;

const TARGET_FIELDS = [
  'location_id',
  'package_id',
  'room_id',
  'booking_date',
  'booking_time',
  'attraction_id',
  'scheduled_date',
  'scheduled_time',
  'event_id',
  'purchase_date',
  'purchase_time',
  'items',
  'customer_id',
  'guest_name',
  'guest_email',
  'guest_phone',
];

export interface BlockedPeriodWarning {
  message: string;
  periods: AvailabilityBlock[];
}

type Handler = (warning: BlockedPeriodWarning) => Promise<boolean>;

let handler: Handler | null = null;

const acknowledgedTargets = new Map<string, { ids: number[]; at: number }>();

export function registerBlockedPeriodHandler(next: Handler): () => void {
  handler = next;
  return () => {
    if (handler === next) handler = null;
  };
}

export function confirmBlockedPeriod(warning: BlockedPeriodWarning): Promise<boolean> {
  if (!handler) return Promise.resolve(false);
  return handler(warning).catch(() => false);
}

export function blockedPeriodWarning(error: unknown): BlockedPeriodWarning | null {
  const response = (error as { response?: { status?: number; data?: { code?: string; message?: string; blocked_periods?: AvailabilityBlock[] } } })?.response;
  if (response?.status !== 409 || response?.data?.code !== 'BLOCKED_PERIOD') return null;

  return {
    message: response.data.message ?? 'This time falls inside a blocked period.',
    periods: Array.isArray(response.data.blocked_periods) ? response.data.blocked_periods : [],
  };
}

type RetryableConfig = InternalAxiosRequestConfig & { _blockedPeriodIds?: number[] };
type HandledError = AxiosError & { _blockedPeriodHandled?: boolean };
type RequestBody = Record<string, unknown> | FormData;

function readBody(data: unknown): RequestBody | null {
  if (typeof FormData !== 'undefined' && data instanceof FormData) return data;
  if (data === undefined || data === null || data === '') return {};
  if (typeof data === 'string') {
    try {
      const parsed = JSON.parse(data);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
  return typeof data === 'object' ? (data as Record<string, unknown>) : null;
}

function targetKey(config: RetryableConfig, body: RequestBody): string {
  const picked: Record<string, unknown> = {};
  TARGET_FIELDS.forEach(field => {
    const value = body instanceof FormData ? body.get(field) : body[field];
    if (value !== undefined && value !== null) picked[field] = value;
  });
  let actor: unknown = 'guest';
  try {
    actor = getStoredUser()?.id ?? 'guest';
  } catch {
    actor = 'guest';
  }
  return `${actor} ${String(config.method ?? 'get').toLowerCase()} ${config.url ?? ''} ${JSON.stringify(picked)}`;
}

function withAcknowledgement(config: RetryableConfig, body: RequestBody, ids: number[]): RetryableConfig {
  if (body instanceof FormData) {
    body.set(ACKNOWLEDGE_BLOCKED_PERIOD, '1');
    body.delete(`${ACKNOWLEDGED_BLOCK_IDS}[]`);
    ids.forEach(id => body.append(`${ACKNOWLEDGED_BLOCK_IDS}[]`, String(id)));
    config.data = body;
  } else {
    config.data = { ...body, [ACKNOWLEDGE_BLOCKED_PERIOD]: true, [ACKNOWLEDGED_BLOCK_IDS]: ids };
  }
  config._blockedPeriodIds = ids;
  return config;
}

export function installBlockedPeriodRetry(instance: AxiosInstance): void {
  instance.interceptors.response.use(
    response => response,
    async (error: AxiosError) => {
      const handled = error as HandledError;
      const config = error?.config as RetryableConfig | undefined;
      const warning = blockedPeriodWarning(error);

      if (!config || !warning || handled._blockedPeriodHandled) {
        return Promise.reject(error);
      }

      handled._blockedPeriodHandled = true;

      const ids = warning.periods.map(period => Number(period.id)).filter(id => Number.isFinite(id));
      const body = readBody(config.data);
      const alreadyAcknowledged = config._blockedPeriodIds ?? [];

      if (body === null || ids.length === 0 || ids.every(id => alreadyAcknowledged.includes(id))) {
        return Promise.reject(error);
      }

      const key = targetKey(config, body);
      const remembered = acknowledgedTargets.get(key);
      const rememberedIds = remembered && Date.now() - remembered.at < REMEMBER_FOR_MS ? remembered.ids : [];

      const confirmed = ids.every(id => rememberedIds.includes(id)) || await confirmBlockedPeriod(warning);

      if (!confirmed) {
        const data = error.response?.data as { message?: string } | undefined;
        if (data && typeof data === 'object') {
          data.message = 'Not saved: that time is inside a blocked period.';
        }
        return Promise.reject(error);
      }

      const acknowledgedIds = Array.from(new Set([...alreadyAcknowledged, ...rememberedIds, ...ids]));
      acknowledgedTargets.set(key, { ids: acknowledgedIds, at: Date.now() });

      return instance.request(withAcknowledgement(config, body, acknowledgedIds));
    }
  );
}
