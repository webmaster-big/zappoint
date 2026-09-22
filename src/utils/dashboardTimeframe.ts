import type { TimeframeType } from '../services/MetricsService';
import { getStoredUser } from './storage';
import { toMichiganDate } from './timeFormat';

export const TIMEFRAME_LABELS: Record<TimeframeType, string> = {
  today: 'Today',
  last_24h: 'Last 24 Hours',
  last_7d: 'Last 7 Days',
  last_30d: 'Last 30 Days',
  all_time: 'All Time',
  custom: 'Custom Range',
};

export const TIMEFRAME_VALUES = Object.keys(TIMEFRAME_LABELS) as TimeframeType[];

export const DEFAULT_TIMEFRAME: TimeframeType = 'today';

const timeframeStorageKey = (): string => {
  const user = getStoredUser();
  return user?.id ? `dashboard_timeframe_${user.id}` : 'dashboard_timeframe';
};

export const readStoredTimeframe = (fallback: TimeframeType = DEFAULT_TIMEFRAME): TimeframeType => {
  try {
    const saved = localStorage.getItem(timeframeStorageKey());
    if (saved && (TIMEFRAME_VALUES as string[]).includes(saved)) {
      return saved as TimeframeType;
    }
  } catch {
    /* localStorage unavailable */
  }
  return fallback;
};

export const storeTimeframe = (timeframe: TimeframeType): void => {
  try {
    localStorage.setItem(timeframeStorageKey(), timeframe);
  } catch {
    /* localStorage unavailable */
  }
};

export const timeframeLabel = (timeframe: TimeframeType): string =>
  TIMEFRAME_LABELS[timeframe] ?? TIMEFRAME_LABELS[DEFAULT_TIMEFRAME];

export const michiganTodayKey = (): string => toMichiganDate(new Date().toISOString());

const ROLLING_HOURS: Partial<Record<TimeframeType, number>> = {
  last_24h: 24,
  last_7d: 24 * 7,
  last_30d: 24 * 30,
};

export const createdWithinTimeframe = (
  createdAt: string | null | undefined,
  timeframe: TimeframeType,
  customFrom?: string,
  customTo?: string
): boolean => {
  if (timeframe === 'all_time') return true;
  if (!createdAt) return false;

  if (timeframe === 'today') {
    return toMichiganDate(createdAt) === michiganTodayKey();
  }

  if (timeframe === 'custom') {
    const day = toMichiganDate(createdAt);
    if (!day) return false;
    if (customFrom && day < customFrom) return false;
    if (customTo && day > customTo) return false;
    return true;
  }

  const hours = ROLLING_HOURS[timeframe];
  if (!hours) return true;

  const created = new Date(createdAt).getTime();
  if (Number.isNaN(created)) return false;
  return created >= Date.now() - hours * 60 * 60 * 1000;
};
