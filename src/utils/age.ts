export const ADULT_AGE = 18;

const VENUE_TIME_ZONE = 'America/Detroit';

const parseDateParts = (value?: string | null): { year: number; month: number; day: number } | null => {
  if (!value) return null;
  const [year, month, day] = value.split('T')[0].split('-').map(Number);
  if (!year || !month || !day) return null;
  const parsed = new Date(year, month - 1, day);
  if (Number.isNaN(parsed.getTime()) || parsed.getMonth() !== month - 1 || parsed.getDate() !== day) return null;
  return { year, month, day };
};

export const todayAtVenue = (): Date => {
  const now = new Date();
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: VENUE_TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(now);
    const value = (type: string) => Number(parts.find((part) => part.type === type)?.value);
    const year = value('year');
    const month = value('month');
    const day = value('day');
    if (year && month && day) return new Date(year, month - 1, day);
  } catch {
    // Intl or the zone is unavailable — fall back to the device date below.
  }
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};

export const calculateAge = (dateOfBirth?: string | null, asOf: Date = todayAtVenue()): number | null => {
  const parts = parseDateParts(dateOfBirth);
  if (!parts) return null;

  const { year, month, day } = parts;
  const born = new Date(year, month - 1, day);
  if (born > asOf) return null;

  let age = asOf.getFullYear() - year;
  const monthDiff = asOf.getMonth() - (month - 1);
  if (monthDiff < 0 || (monthDiff === 0 && asOf.getDate() < day)) age -= 1;

  return age;
};

export const isFutureDate = (date?: string | null, asOf: Date = todayAtVenue()): boolean => {
  const parts = parseDateParts(date);
  if (!parts) return false;
  return new Date(parts.year, parts.month - 1, parts.day) > asOf;
};
