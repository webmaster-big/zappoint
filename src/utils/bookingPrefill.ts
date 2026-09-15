export interface SlotPrefill {
  locationId?: number | null;
  date: string;
  minute: number;
  roomId?: number | null;
  packageId?: number | null;
  packageIds?: number[];
  walkIn?: boolean;
}

export interface BookingPrefill {
  locationId: number | null;
  date: string | null;
  time: string | null;
  roomId: number | null;
  packageId: number | null;
  packageIds: number[];
  walkIn: boolean;
  hasAny: boolean;
}

export const BOOKING_CREATE_PATH = '/bookings/create';

export function minutesToClock(minute: number): string {
  if (!Number.isFinite(minute)) return '00:00';
  const wrapped = ((Math.round(minute) % 1440) + 1440) % 1440;
  return `${String(Math.floor(wrapped / 60)).padStart(2, '0')}:${String(wrapped % 60).padStart(2, '0')}`;
}

export function clockToMinutes(clock?: string | null): number | null {
  if (!clock) return null;
  const [h, m] = String(clock).split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  const minute = h * 60 + m;
  return minute >= 0 && minute < 1440 ? minute : null;
}

export function snapToInterval(minute: number, intervalMinutes: number, floorMinute?: number): number {
  const interval = Math.max(1, Math.round(intervalMinutes) || 15);
  const safe = Number.isFinite(minute) ? minute : 0;
  let snapped = Math.floor(safe / interval) * interval;

  if (floorMinute !== undefined && Number.isFinite(floorMinute) && snapped < floorMinute) {
    snapped = Math.ceil(floorMinute / interval) * interval;
  }

  return Math.max(0, snapped);
}

export function buildBookingUrl(prefill: SlotPrefill): string {
  const params = new URLSearchParams();

  if (prefill.locationId != null) params.set('location_id', String(prefill.locationId));
  if (prefill.date) params.set('date', prefill.date);
  if (Number.isFinite(prefill.minute)) params.set('time', minutesToClock(prefill.minute));
  if (prefill.roomId != null) params.set('room_id', String(prefill.roomId));
  if (prefill.packageId != null) params.set('package_id', String(prefill.packageId));

  const candidates = (prefill.packageIds ?? []).filter(id => Number.isInteger(id) && id > 0);
  if (candidates.length > 1) params.set('package_ids', Array.from(new Set(candidates)).join(','));

  if (prefill.walkIn) params.set('walk_in', '1');

  const query = params.toString();
  return query ? `${BOOKING_CREATE_PATH}?${query}` : BOOKING_CREATE_PATH;
}

const toId = (value: string | null): number | null => {
  if (!value) return null;
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
};

const toIdList = (value: string | null): number[] => {
  if (!value) return [];
  const ids = value
    .split(',')
    .map(part => Number(part.trim()))
    .filter(id => Number.isInteger(id) && id > 0);
  return Array.from(new Set(ids));
};

const toDate = (value: string | null): string | null =>
  value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;

export function readBookingPrefill(params: URLSearchParams): BookingPrefill {
  const minute = clockToMinutes(params.get('time'));
  const prefill: BookingPrefill = {
    locationId: toId(params.get('location_id')),
    date: toDate(params.get('date')),
    time: minute === null ? null : minutesToClock(minute),
    roomId: toId(params.get('room_id')),
    packageId: toId(params.get('package_id')),
    packageIds: toIdList(params.get('package_ids')),
    walkIn: params.get('walk_in') === '1',
    hasAny: false,
  };

  prefill.hasAny =
    prefill.locationId !== null ||
    prefill.date !== null ||
    prefill.time !== null ||
    prefill.roomId !== null ||
    prefill.packageId !== null ||
    prefill.packageIds.length > 0;

  return prefill;
}
