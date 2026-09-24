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
  const end = slotEnd ? closureTimeToMinutes(slotEnd) : null;

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
