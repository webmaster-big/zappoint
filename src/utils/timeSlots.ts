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
