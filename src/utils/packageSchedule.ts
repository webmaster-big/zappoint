export interface ScheduleDaysLike {
  availability_type?: string | null;
  day_configuration?: unknown;
}

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const OCCURRENCES = ['first', 'second', 'third', 'fourth'];

const capitalize = (value: string): string => value.charAt(0).toUpperCase() + value.slice(1);

export const matchesMonthlyPattern = (pattern: unknown, date: Date): boolean => {
  if (typeof pattern !== 'string') return false;

  const [occurrence, dayName] = pattern.toLowerCase().split('-');
  if (!dayName || dayName !== WEEKDAYS[date.getDay()]) return false;

  if (occurrence === 'last') {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 7).getMonth() !== date.getMonth();
  }

  const position = OCCURRENCES.indexOf(occurrence);
  return position >= 0 && position + 1 === Math.ceil(date.getDate() / 7);
};

const dayEntries = (value: unknown): unknown[] => {
  if (Array.isArray(value)) return value;
  return value !== null && typeof value === 'object' ? Object.values(value) : [];
};

export const scheduleMatchesDate = (schedule: ScheduleDaysLike, date: Date): boolean => {
  const entries = dayEntries(schedule.day_configuration);

  switch (schedule.availability_type) {
    case 'daily':
      return true;
    case 'weekly':
      return entries.some(day => typeof day === 'string' && day.toLowerCase() === WEEKDAYS[date.getDay()]);
    case 'monthly':
      return entries.some(entry => matchesMonthlyPattern(entry, date));
    default:
      return false;
  }
};

export const monthlyPatternLabel = (pattern: string, short = false): string => {
  const [occurrence, dayName] = String(pattern ?? '').toLowerCase().split('-');
  if (!occurrence || !dayName) return pattern;

  return `${capitalize(occurrence)} ${short ? capitalize(dayName).slice(0, 3) : capitalize(dayName)}`;
};
