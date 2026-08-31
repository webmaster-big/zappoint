const MINUTES_PER_DAY = 24 * 60;

export function generateTimeSlots(
  startTime: string,
  endTime: string,
  intervalMinutes: number = 60,
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

/**
 * Mirrors GeneratesAvailableTimeSlots::roomDrivenTimeSlots on the server so the
 * admin preview lists the same start times a customer will be offered. Returns
 * null when the spaces cannot drive the grid, meaning the schedule interval applies.
 */
export function generateSpaceDrivenTimeSlots(
  startTime: string,
  endTime: string,
  durationMinutes: number,
  spaceIntervals: number[],
  cleanupMinutes: number = DEFAULT_SLOT_CLEANUP_MINUTES,
): string[] | null {
  if (!startTime || !endTime || durationMinutes <= 0) return null;

  const usableIntervals = spaceIntervals.filter(minutes => Number.isFinite(minutes) && minutes > 0);
  if (usableIntervals.length === 0) return null;

  const [startHours, startMins] = startTime.split(':').map(Number);
  const [endHours, endMins] = endTime.split(':').map(Number);
  if ([startHours, startMins, endHours, endMins].some(n => Number.isNaN(n))) return null;

  const windowStart = startHours * 60 + startMins;
  let windowEnd = endHours * 60 + endMins;
  if (windowEnd <= windowStart) windowEnd += MINUTES_PER_DAY;

  const stagger = Math.min(...usableIntervals);
  const spaceCount = spaceIntervals.length;
  const cycle = Math.max(durationMinutes + Math.max(0, cleanupMinutes), spaceCount * stagger);
  if (cycle <= 0) return null;

  const starts = new Set<number>();
  for (let index = 0; index < spaceCount; index += 1) {
    for (let cursor = windowStart + index * stagger; cursor + durationMinutes <= windowEnd; cursor += cycle) {
      starts.add(cursor);
    }
  }

  return [...starts]
    .sort((a, b) => a - b)
    .map(minutes => {
      const wrapped = minutes % MINUTES_PER_DAY;
      const h = Math.floor(wrapped / 60);
      const m = wrapped % 60;
      return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    });
}
