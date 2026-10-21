import { isAxiosError } from 'axios';
import type { RegistrationEventOption, RegistrationFormStatus } from '../../../types/eventRegistration.types';
import { requestErrorMessage } from '../../../utils/requestError';
import { formatDateLong } from '../../../utils/timeFormat';

export const STATUS_LABELS: Record<RegistrationFormStatus, string> = {
  open: 'Open',
  closed: 'Closed',
  past: 'Date passed',
};

export const statusPillClass = (status: RegistrationFormStatus, themeColor: string, fullColor: string): string =>
  `text-xs font-medium px-3 py-1 rounded-full ${status === 'open' ? `bg-${themeColor}-100 text-${fullColor}` : 'bg-gray-100 text-gray-800'}`;

export const SAME_CONTACT_CHIP = 'text-xs font-medium px-2.5 py-0.5 rounded-full amber-tone bg-amber-100 text-amber-800';
export const registeredBeforeChip = (themeColor: string, fullColor: string): string =>
  `text-xs font-medium px-2.5 py-0.5 rounded-full bg-${themeColor}-100 text-${fullColor}`;
export const LAST_YEAR_CHIP = 'text-xs font-medium px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-800';
export const THIS_FORM_CHIP = 'text-[10px] font-semibold uppercase tracking-wide px-2 py-1 rounded bg-gray-100 text-gray-500';

export const MODULE_UNAVAILABLE_MESSAGE = 'Registration forms are not set up yet.';

export interface StaffRequestFailure {
  message: string;
  unavailable: boolean;
  switchLocationId: number | null;
  status: number | null;
}

export const describeFailure = (error: unknown, fallback: string): StaffRequestFailure => {
  const response = isAxiosError<{ code?: string; message?: string; switch_location_id?: number }>(error) ? error.response : undefined;
  const unavailable = response?.data?.code === 'MODULE_UNAVAILABLE';
  const switchLocationId = typeof response?.data?.switch_location_id === 'number' ? response.data.switch_location_id : null;

  return {
    message: unavailable ? MODULE_UNAVAILABLE_MESSAGE : requestErrorMessage(error, fallback),
    unavailable,
    switchLocationId,
    status: response?.status ?? null,
  };
};

export const fieldErrorsFrom = (error: unknown): Record<string, string> => {
  const errors = isAxiosError<{ errors?: Record<string, string[]> }>(error) ? error.response?.data?.errors : undefined;
  const mapped: Record<string, string> = {};
  if (errors) {
    Object.entries(errors).forEach(([field, messages]) => {
      if (messages?.[0]) mapped[field] = messages[0];
    });
  }
  return mapped;
};

export const fileSlug = (value: string, fallback: string): string =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || fallback;

export const themedClasses = (themeColor: string, fullColor: string) => ({
  input: `w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-${themeColor}-800 focus:border-${themeColor}-800`,
  invalidInput: 'w-full rounded-lg border border-red-500 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500',
  link: `text-${fullColor} hover:underline font-medium`,
  icon: `text-${fullColor}`,
  accent: `accent-${themeColor}-700`,
  softPanel: `border border-${themeColor}-200 bg-${themeColor}-50`,
});

export const MATCH_WINDOW_DAYS = 21;

interface DatedEvent {
  start_date: string | null;
  end_date: string | null;
}

const dayIndex = (value: string): number => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? Math.round(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) / 86_400_000) : Number.NaN;
};

export const eventFirstDay = (event: DatedEvent): string => event.start_date ?? event.end_date ?? '';

export const eventLastDay = (event: DatedEvent): string => event.end_date ?? event.start_date ?? '';

export const formatEventDates = (event: DatedEvent): string => {
  const first = eventFirstDay(event);
  const last = eventLastDay(event);
  if (!first) return '';
  return last && last !== first ? `${formatDateLong(first)} – ${formatDateLong(last)}` : formatDateLong(first);
};

export const eventNameKey = (value: string): string => value.trim().replace(/\s+/g, ' ').toLowerCase();

const gapDays = (a: DatedEvent, b: DatedEvent): number => {
  const aStart = dayIndex(eventFirstDay(a));
  const aEnd = dayIndex(eventLastDay(a));
  const bStart = dayIndex(eventFirstDay(b));
  const bEnd = dayIndex(eventLastDay(b));
  if ([aStart, aEnd, bStart, bEnd].some(Number.isNaN)) return Number.POSITIVE_INFINITY;
  if (aStart <= bEnd && bStart <= aEnd) return 0;
  return aStart > bEnd ? aStart - bEnd : bStart - aEnd;
};

export const matchingEventAt = (
  source: RegistrationEventOption,
  locationId: number,
  options: RegistrationEventOption[],
  today = '',
): RegistrationEventOption | null => {
  if (source.location_id === locationId) return source;
  const key = eventNameKey(source.name);
  const sourceStart = dayIndex(eventFirstDay(source));
  const preferUpcoming = today !== '' && eventLastDay(source) >= today;
  const finished = (option: RegistrationEventOption): number => (preferUpcoming && eventLastDay(option) < today ? 1 : 0);
  const ranked = options
    .filter((option) => option.location_id === locationId && option.id !== source.id && eventNameKey(option.name) === key)
    .map((option) => ({ option, gap: gapDays(source, option), shift: Math.abs(dayIndex(eventFirstDay(option)) - sourceStart) }))
    .filter((candidate) => candidate.gap <= MATCH_WINDOW_DAYS)
    .sort((a, b) => finished(a.option) - finished(b.option)
      || a.gap - b.gap
      || Number(b.option.is_active) - Number(a.option.is_active)
      || a.shift - b.shift
      || a.option.id - b.option.id);
  return ranked[0]?.option ?? null;
};

export const yearShift = (value: string, years: number): string =>
  value.replace(/\b(19|20)\d{2}\b/g, (year) => String(Number(year) + years));

export const nextYearDate = (value: string): string => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;
  const year = Number(match[1]) + 1;
  const month = match[2];
  const day = month === '02' && match[3] === '29' ? '28' : match[3];
  return `${year}-${month}-${day}`;
};
