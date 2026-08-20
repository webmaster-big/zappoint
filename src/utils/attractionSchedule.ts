import { generateTimeSlots } from './timeSlots';
import type { DayOff } from '../services/DayOffService';

export interface AvailabilitySlot {
  days: string[];
  start_time: string;
  end_time: string;
}

export interface PartialClosure {
  time_start?: string | null;
  time_end?: string | null;
}

export interface DayOffSets {
  blocked: Set<string>;
  partial: Record<string, PartialClosure[]>;
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const timeToMinutes = (time: string): number => {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + (m || 0);
};

export const addMinutesToTime = (time: string, minutes: number): string => {
  const total = timeToMinutes(time) + minutes;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};

export const isSlotBlockedByClosure = (
  slotStart: string,
  slotEnd: string,
  closures: PartialClosure[],
): boolean => {
  const start = timeToMinutes(slotStart);
  const end = timeToMinutes(slotEnd);
  return closures.some(({ time_start, time_end }) => {
    if (!time_start && !time_end) return true;
    if (time_start && !time_end) {
      const close = timeToMinutes(time_start);
      return start >= close || end > close;
    }
    if (!time_start && time_end) {
      const open = timeToMinutes(time_end);
      return start < open;
    }
    const rangeStart = timeToMinutes(time_start as string);
    const rangeEnd = timeToMinutes(time_end as string);
    return start < rangeEnd && end > rangeStart;
  });
};

export const normalizeAvailability = (raw: unknown): AvailabilitySlot[] => {
  if (Array.isArray(raw)) {
    return raw as AvailabilitySlot[];
  }

  if (typeof raw === 'object' && raw !== null) {
    const enabledDays = Object.entries(raw as Record<string, unknown>)
      .filter(([, isAvailable]) => Boolean(isAvailable))
      .map(([day]) => day.toLowerCase());
    if (enabledDays.length === 0) return [];
    return [{ days: enabledDays, start_time: '09:00', end_time: '17:00' }];
  }

  return [];
};

export const buildDayOffSets = (dayOffs: DayOff[], attractionId: number): DayOffSets => {
  const blocked = new Set<string>();
  const partial: Record<string, PartialClosure[]> = {};
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const toDateStr = (d: Date) => {
    const y = d.getFullYear();
    const m = (d.getMonth() + 1).toString().padStart(2, '0');
    const day = d.getDate().toString().padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  dayOffs.forEach(dayOff => {
    const isLocationWide =
      !dayOff.package_ids?.length &&
      !dayOff.room_ids?.length &&
      !dayOff.attraction_ids?.length &&
      !dayOff.event_ids?.length;
    const appliesToAttraction = !!dayOff.attraction_ids?.includes(attractionId);
    if (!isLocationWide && !appliesToAttraction) return;

    const normalizedDate = dayOff.date.split('T')[0];
    const offDate = new Date(normalizedDate + 'T00:00:00');
    const hasTimeRestriction = !!(dayOff.time_start || dayOff.time_end);
    const targetDates: string[] = [];

    if (dayOff.is_recurring) {
      const currYear = new Date(now.getFullYear(), offDate.getMonth(), offDate.getDate());
      const nextYear = new Date(now.getFullYear() + 1, offDate.getMonth(), offDate.getDate());
      if (currYear >= now) targetDates.push(toDateStr(currYear));
      targetDates.push(toDateStr(nextYear));
    } else if (offDate >= now) {
      targetDates.push(normalizedDate);
    }

    targetDates.forEach(dateStr => {
      if (hasTimeRestriction) {
        if (!partial[dateStr]) partial[dateStr] = [];
        partial[dateStr].push({ time_start: dayOff.time_start, time_end: dayOff.time_end });
      } else {
        blocked.add(dateStr);
      }
    });
  });

  return { blocked, partial };
};

export const slotsForDate = (
  availability: AvailabilitySlot[],
  dateStr: string,
  partial: Record<string, PartialClosure[]>,
): string[] => {
  if (!dateStr) return [];
  const date = new Date(dateStr + 'T00:00:00');
  if (Number.isNaN(date.getTime())) return [];

  const dayName = DAY_NAMES[date.getDay()].toLowerCase();
  const dayAvailability = availability.find(slot => slot.days.map(d => d.toLowerCase()).includes(dayName));
  if (!dayAvailability) return [];

  const slots = generateTimeSlots(dayAvailability.start_time, dayAvailability.end_time, 60);
  const closures = partial[dateStr] || [];
  if (closures.length === 0) return slots;

  return slots.filter(slot => !isSlotBlockedByClosure(slot, addMinutesToTime(slot, 60), closures));
};

/** Partial-closure days collapse into fully blocked when nothing survives the closures. */
export const effectiveBlockedDates = (
  availability: AvailabilitySlot[],
  sets: DayOffSets,
): { blocked: Set<string>; partialDays: Set<string> } => {
  const blocked = new Set<string>(sets.blocked);
  const partialDays = new Set<string>();

  Object.keys(sets.partial).forEach(dateStr => {
    if (blocked.has(dateStr)) return;
    if (slotsForDate(availability, dateStr, sets.partial).length === 0) {
      blocked.add(dateStr);
    } else {
      partialDays.add(dateStr);
    }
  });

  return { blocked, partialDays };
};
