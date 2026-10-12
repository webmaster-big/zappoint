const MINUTES_PER_DAY = 24 * 60;

export function generateTimeSlots(
  startTime: string,
  endTime: string,
  intervalMinutes: number = 60,
  durationMinutes: number = 0,
): string[] {
  const slots: string[] = [];
  if (!startTime || !endTime || intervalMinutes <= 0) return slots;

  const [startHours, startMins] = startTime.split(':').map(Number);
  const [endHours, endMins] = endTime.split(':').map(Number);
  if ([startHours, startMins, endHours, endMins].some((n) => Number.isNaN(n))) return slots;

  const startMinutes = startHours * 60 + startMins;
  let endMinutes = endHours * 60 + endMins;
  if (endMinutes <= startMinutes) endMinutes += MINUTES_PER_DAY;

  for (let cur = startMinutes; cur < endMinutes; cur += intervalMinutes) {
    // mirrors PackageAvailabilitySchedule::getTimeSlotsForDate — a start must finish before closing
    if (durationMinutes > 0 && cur + durationMinutes > endMinutes) break;

    const wrapped = cur % MINUTES_PER_DAY;
    const h = Math.floor(wrapped / 60);
    const m = wrapped % 60;
    slots.push(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
  }

  return slots;
}

export function scheduleWindowMinutes(startTime: string, endTime: string): number | null {
  if (!startTime || !endTime) return null;

  const [startHours, startMins] = startTime.split(':').map(Number);
  const [endHours, endMins] = endTime.split(':').map(Number);
  if ([startHours, startMins, endHours, endMins].some((n) => Number.isNaN(n))) return null;

  const diff = endHours * 60 + endMins - (startHours * 60 + startMins);
  if (diff === 0) return 0;
  return diff < 0 ? diff + MINUTES_PER_DAY : diff;
}

export const DEFAULT_SLOT_CLEANUP_MINUTES = 15;

const AFTER_MIDNIGHT_LIMIT = 6 * 60;

const slotMinutes = (slot: string): number => {
  const [hours, minutes] = slot.split(':').map(Number);
  return (Number.isFinite(hours) ? hours : 0) * 60 + (Number.isFinite(minutes) ? minutes : 0);
};

export function orderClockSlots(slots: string[]): string[] {
  const sorted = Array.from(new Set(slots)).sort();
  if (sorted.length < 2) return sorted;

  const minutes = sorted.map(slotMinutes);
  let widestGap = minutes[0] + MINUTES_PER_DAY - minutes[minutes.length - 1];
  let startIndex = 0;

  for (let index = 1; index < minutes.length; index++) {
    const gap = minutes[index] - minutes[index - 1];
    if (gap > widestGap) {
      widestGap = gap;
      startIndex = index;
    }
  }

  if (startIndex === 0 || minutes[startIndex - 1] >= AFTER_MIDNIGHT_LIMIT) return sorted;

  return [...sorted.slice(startIndex), ...sorted.slice(0, startIndex)];
}

export function orderByClockStart<T extends { start_time: string }>(slots: T[]): T[] {
  const rank = new Map(orderClockSlots(slots.map(slot => slot.start_time)).map((time, index) => [time, index]));
  return [...slots].sort((a, b) => (rank.get(a.start_time) ?? 0) - (rank.get(b.start_time) ?? 0));
}
