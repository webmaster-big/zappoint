export interface PartialClosure {
  time_start?: string | null;
  time_end?: string | null;
}

export const closureTimeToMinutes = (time: string): number => {
  const [h, m] = (time ?? '').split(':').map(Number);
  if (!Number.isFinite(h)) return 0;
  return h * 60 + (Number.isFinite(m) ? m : 0);
};

export const isFullDayClosure = (closure: PartialClosure): boolean =>
  !closure.time_start && !closure.time_end;

const isCloseEarlyClosure = (closure: PartialClosure): boolean =>
  !!closure.time_start && !closure.time_end;

const isDelayedOpeningClosure = (closure: PartialClosure): boolean =>
  !closure.time_start && !!closure.time_end;

const isTimeRangeClosure = (closure: PartialClosure): boolean =>
  !!closure.time_start && !!closure.time_end;

const isSlotBlockedBySingleClosure = (
  slotStart: string,
  slotEnd: string | null,
  closure: PartialClosure,
): boolean => {
  if (isFullDayClosure(closure)) return true;

  const start = closureTimeToMinutes(slotStart);
  const rawEnd = slotEnd ? closureTimeToMinutes(slotEnd) : null;
  const end = rawEnd !== null && rawEnd <= start ? rawEnd + 24 * 60 : rawEnd;

  if (isCloseEarlyClosure(closure)) {
    const closesAt = closureTimeToMinutes(closure.time_start as string);
    if (start >= closesAt) return true;
    return end !== null && end > closesAt;
  }

  if (isDelayedOpeningClosure(closure)) {
    return start < closureTimeToMinutes(closure.time_end as string);
  }

  const rangeStart = closureTimeToMinutes(closure.time_start as string);
  const rangeEnd = closureTimeToMinutes(closure.time_end as string);
  if (rangeEnd <= rangeStart) return false;

  if (end !== null) {
    return start < rangeEnd && end > rangeStart;
  }

  return start >= rangeStart && start < rangeEnd;
};

export const isSlotBlockedByClosure = (
  slotStart: string,
  slotEnd: string | null,
  closures: PartialClosure[],
): boolean => closures.some(closure => isSlotBlockedBySingleClosure(slotStart, slotEnd, closure));

const formatClosureTime = (time24: string): string => {
  const [hours, minutes] = time24.split(':').map(Number);
  if (!Number.isFinite(hours)) return time24;
  const period = hours >= 12 ? 'PM' : 'AM';
  const hours12 = hours % 12 || 12;
  return `${hours12}:${(minutes || 0).toString().padStart(2, '0')} ${period}`;
};

export const describeClosure = (closure: PartialClosure): string => {
  if (isFullDayClosure(closure)) return 'Closed all day';
  if (isCloseEarlyClosure(closure)) {
    return `Closed from ${formatClosureTime(closure.time_start as string)}`;
  }
  if (isDelayedOpeningClosure(closure)) {
    return `Closed until ${formatClosureTime(closure.time_end as string)}`;
  }
  return `Closed ${formatClosureTime(closure.time_start as string)} - ${formatClosureTime(closure.time_end as string)}`;
};

export const closureRangeIsValid = (closure: PartialClosure): boolean => {
  if (!isTimeRangeClosure(closure)) return true;
  return closureTimeToMinutes(closure.time_end as string) > closureTimeToMinutes(closure.time_start as string);
};

const MINUTES_PER_DAY = 1440;

const clockMinutes = (time: string | null | undefined): number | null => {
  if (!time || !/^\d{1,2}:\d{2}/.test(time)) return null;
  const [hours, minutes] = time.split(':').map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes) || hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
};

const closingMinutes = (time: string | null | undefined): number | null => {
  const minutes = clockMinutes(time);
  return minutes === 0 ? MINUTES_PER_DAY : minutes;
};

const OVERNIGHT_CLOSE_LIMIT = 6 * 60;

const overnightClose = (opens: number | null, closes: number | null): number | null =>
  opens !== null && closes !== null && closes <= opens && closes <= OVERNIGHT_CLOSE_LIMIT ? closes + MINUTES_PER_DAY : closes;

const formatMinutes = (minutes: number): string => {
  if (minutes === MINUTES_PER_DAY) return 'midnight';
  if (minutes > MINUTES_PER_DAY) return `${formatMinutes(minutes - MINUTES_PER_DAY)} (next morning)`;
  return formatClosureTime(`${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`);
};

export const operatingWindowError = (opensAt: string, closesAt: string): string | null => {
  const opens = clockMinutes(opensAt);
  const closes = overnightClose(opens, closingMinutes(closesAt));

  if (opens === null && closes === null) return 'Enter the time it opens, the time it closes, or both.';
  if (opens !== null && closes !== null && closes <= opens) return 'The closing time must be later than the opening time, or no later than 6:00 AM the next morning.';
  if ((opens === null || opens === 0) && (closes === null || closes >= MINUTES_PER_DAY)) {
    return 'Those hours keep the whole day open, so nothing would be blocked.';
  }
  return null;
};

export const describeOperatingWindow = (opensAt: string, closesAt: string): string => {
  const opens = clockMinutes(opensAt);
  const closes = overnightClose(opens, closingMinutes(closesAt));

  if (opens !== null && closes !== null) return `Open only ${formatMinutes(opens)} – ${formatMinutes(closes)}`;
  if (opens !== null) return `Opens late at ${formatMinutes(opens)}`;
  if (closes !== null) return `Closes early at ${formatMinutes(closes)}`;
  return 'Open all day';
};

export const describeBlockedPeriod = (opensAt: string, closesAt: string): string => {
  const opens = clockMinutes(opensAt);
  const closes = overnightClose(opens, closingMinutes(closesAt));
  const parts: string[] = [];

  if (opens !== null && opens > 0) parts.push(`before ${formatMinutes(opens)}`);
  if (closes !== null && closes !== MINUTES_PER_DAY) parts.push(`from ${formatMinutes(closes)}`);

  return parts.length === 0 ? 'Nothing is blocked' : `Blocked ${parts.join(' and ')}`;
};

export const describeMinuteRange = (startMinutes: number, endMinutes: number): string => {
  if (startMinutes <= 0 && endMinutes >= MINUTES_PER_DAY) return 'All day';
  if (startMinutes <= 0) return `Until ${formatMinutes(endMinutes)}`;
  if (endMinutes >= MINUTES_PER_DAY) return `From ${formatMinutes(startMinutes)}`;
  return `${formatMinutes(startMinutes)} – ${formatMinutes(endMinutes)}`;
};
