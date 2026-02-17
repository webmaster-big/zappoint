/**
 * Parses an ISO date string (YYYY-MM-DD) as a local date to avoid timezone issues.
 * Using new Date("2026-01-06") parses as UTC midnight, which can show as the previous day
 * in timezones behind UTC (like EST). This function parses in local timezone instead.
 * @param isoDateString - Date in ISO format (e.g., "2026-01-06" or "2026-01-06T00:00:00")
 * @returns Date object in local timezone
 */
export function parseLocalDate(isoDateString: string): Date {
  if (!isoDateString) return new Date();
  // Strip time portion if present and split the date part
  const [year, month, day] = isoDateString.split('T')[0].split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Parses a datetime string from the database WITHOUT timezone conversion.
 * Accepts formats like "2026-02-13T15:30:00.000000Z", "2026-02-13 15:30:00", or "2026-02-13".
 * Returns a Date that represents the exact date/time stored in the DB regardless of browser timezone.
 */
export function parseLocalDateTime(dateTimeString: string): Date {
  if (!dateTimeString) return new Date();
  // Replace 'T' with space and strip trailing 'Z' / timezone offset / microseconds
  const cleaned = dateTimeString.replace('T', ' ').replace(/[Z]$/, '');
  // Split into date and time portions
  const [datePart, timePart] = cleaned.split(' ');
  const [year, month, day] = datePart.split('-').map(Number);
  if (!timePart) return new Date(year, month - 1, day);
  const timeParts = timePart.split(':');
  const hour = parseInt(timeParts[0], 10) || 0;
  const minute = parseInt(timeParts[1], 10) || 0;
  const second = parseInt(timeParts[2], 10) || 0;
  return new Date(year, month - 1, day, hour, minute, second);
}

/**
 * Formats a database datetime string for display WITHOUT timezone conversion.
 * The date/time shown will match exactly what's in the database.
 * @param dateTimeString - DateTime from DB (e.g., "2026-02-13T15:30:00.000000Z")
 * @param options - Intl.DateTimeFormat options (defaults to long format with time)
 * @returns Formatted date string (e.g., "February 13, 2026, 3:30 PM")
 */
export function formatLocalDateTime(
  dateTimeString: string,
  options?: Intl.DateTimeFormatOptions
): string {
  if (!dateTimeString) return 'N/A';
  const date = parseLocalDateTime(dateTimeString);
  const defaultOptions: Intl.DateTimeFormatOptions = options || {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  };
  return date.toLocaleDateString('en-US', defaultOptions);
}

/**
 * Converts 24-hour time format to 12-hour format with AM/PM
 * @param time24 - Time in 24-hour format (e.g., "17:00" or "17:00:00")
 * @returns Time in 12-hour format (e.g., "5:00 PM")
 */
export function convertTo12Hour(time24: string): string {
  if (!time24) return '';
  
  // Strip seconds if present (17:00:00 -> 17:00)
  const timeWithoutSeconds = time24.substring(0, 5);
  
  // Parse hours and minutes
  const [hourStr, minuteStr] = timeWithoutSeconds.split(':');
  let hour = parseInt(hourStr, 10);
  const minute = minuteStr || '00';
  
  // Determine AM/PM
  const period = hour >= 12 ? 'PM' : 'AM';
  
  // Convert to 12-hour format
  if (hour === 0) {
    hour = 12; // Midnight
  } else if (hour > 12) {
    hour = hour - 12;
  }
  
  return `${hour}:${minute} ${period}`;
}

/**
 * Formats a time range in 12-hour format
 * @param startTime - Start time in 24-hour format
 * @param endTime - End time in 24-hour format
 * @returns Formatted time range (e.g., "9:00 AM - 5:00 PM")
 */
export function formatTimeRange(startTime: string, endTime: string): string {
  if (!startTime || !endTime) return '';
  return `${convertTo12Hour(startTime)} - ${convertTo12Hour(endTime)}`;
}

/**
 * Formats duration for display based on unit type
 * Handles 'hours and minutes' unit with decimal values (e.g., 1.90 = 1 hr 54 min)
 * @param duration - Duration value (can be number or string)
 * @param durationUnit - Unit type: 'hours', 'minutes', or 'hours and minutes'
 * @returns Formatted duration string (e.g., "1 hr 54 min", "2 hours", "30 minutes")
 */
export function formatDurationDisplay(
  duration: number | string | undefined,
  durationUnit: string | undefined
): string {
  if (duration === undefined || duration === null || duration === '') return 'Not specified';
  
  const durationValue = typeof duration === 'string' ? parseFloat(duration) : duration;
  
  if (isNaN(durationValue)) return 'Not specified';
  
  // 0 duration means unlimited
  if (durationValue === 0) return 'Unlimited';
  
  // Handle 'hours and minutes' unit with decimal value (e.g., 1.90 = 1 hr 54 min)
  if (durationUnit === 'hours and minutes') {
    const hours = Math.floor(durationValue);
    const minutes = Math.round((durationValue % 1) * 60);
    if (hours > 0 && minutes > 0) return `${hours} hr ${minutes} min`;
    if (hours > 0) return hours === 1 ? '1 hour' : `${hours} hours`;
    if (minutes > 0) return `${minutes} min`;
    return 'Not specified';
  }
  
  // Handle regular hours - also handle decimal values that should be whole numbers (e.g., 2.00)
  if (durationUnit === 'hours') {
    const wholeHours = Math.floor(durationValue);
    const decimalPart = durationValue % 1;
    // If decimal part is very small (like 0.00), treat as whole hours
    if (decimalPart < 0.01) {
      return wholeHours === 1 ? '1 hour' : `${wholeHours} hours`;
    }
    // Otherwise show decimal
    return durationValue === 1 ? '1 hour' : `${durationValue} hours`;
  }
  
  // Handle minutes - convert to hours if >= 60
  if (durationUnit === 'minutes') {
    if (durationValue >= 60) {
      const hours = Math.floor(durationValue / 60);
      const mins = Math.round(durationValue % 60);
      if (mins === 0) {
        return hours === 1 ? '1 hour' : `${hours} hours`;
      }
      return `${hours} hr ${mins} min`;
    }
    return `${Math.round(durationValue)} min`;
  }
  
  // Default fallback - try to format nicely
  const wholeValue = Math.floor(durationValue);
  const decimalPart = durationValue % 1;
  if (decimalPart < 0.01) {
    return `${wholeValue} ${durationUnit || 'hours'}`;
  }
  return `${durationValue} ${durationUnit || 'hours'}`;
}

/**
 * Michigan timezone identifier (Eastern Time)
 */
const MICHIGAN_TZ = 'America/Detroit';

/**
 * Gets the current date/time in Michigan timezone
 * @returns Object with year, month, day, hour, minute, dayOfWeek
 */
export function getMichiganNow(): { year: number; month: number; day: number; hour: number; minute: number; dayOfWeek: number; date: Date } {
  const now = new Date();
  // Get Michigan time parts using Intl
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: MICHIGAN_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    weekday: 'long',
  });
  const parts = formatter.formatToParts(now);
  const get = (type: string) => parts.find(p => p.type === type)?.value || '';
  
  const year = parseInt(get('year'), 10);
  const month = parseInt(get('month'), 10);
  const day = parseInt(get('day'), 10);
  const hour = parseInt(get('hour'), 10);
  const minute = parseInt(get('minute'), 10);
  const weekdayName = get('weekday').toLowerCase();
  
  const dayMap: Record<string, number> = {
    sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
    thursday: 4, friday: 5, saturday: 6,
  };
  const dayOfWeek = dayMap[weekdayName] ?? 0;
  
  // Build a synthetic Date representing Michigan "wall clock" time
  const date = new Date(year, month - 1, day, hour, minute);
  
  return { year, month, day, hour, minute, dayOfWeek, date };
}

export interface UpcomingSession {
  /** Display label – e.g. "Today (Tue)", "Wed, Feb 19" */
  label: string;
  /** Start time in 12-hour format */
  startTime: string;
  /** End time in 12-hour format */
  endTime: string;
  /** Raw date for sorting (Michigan wall-clock, midnight of that day) */
  sortDate: Date;
  /** Whether this session is happening today */
  isToday: boolean;
  /** Whether the session has already ended today (Michigan time) — only relevant if isToday */
  hasEnded: boolean;
  /** Whether the session has already started today (Michigan time) — only relevant if isToday */
  hasStarted: boolean;
}

const DAY_NAMES_FULL = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const DAY_NAMES_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Parses "HH:MM" or "HH:MM:SS" to total minutes since midnight.
 */
function timeToMinutes(time: string): number {
  if (!time) return 0;
  const [h, m] = time.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/**
 * Computes the next N upcoming sessions for an attraction based on its schedule.
 * Uses Michigan (Eastern) timezone.
 *
 * @param schedules - Array of { days: string[], start_time: string, end_time: string }
 * @param count - Number of upcoming sessions to return (default 5)
 */
export function getUpcomingAttractionSessions(
  schedules: { days: string[]; start_time: string; end_time: string }[],
  count = 5,
): UpcomingSession[] {
  if (!schedules || schedules.length === 0) return [];
  
  const mi = getMichiganNow();
  const currentMinutes = mi.hour * 60 + mi.minute;
  const sessions: UpcomingSession[] = [];
  
  // Look ahead up to 14 days
  for (let offset = 0; offset < 14 && sessions.length < count; offset++) {
    const targetDate = new Date(mi.year, mi.month - 1, mi.day + offset);
    const targetDow = targetDate.getDay(); // 0=Sun
    const dayNameFull = DAY_NAMES_FULL[targetDow];
    
    for (const schedule of schedules) {
      if (!schedule.days || !Array.isArray(schedule.days)) continue;
      
      // Check if this schedule includes the target day
      const matchesDay = schedule.days.some(d => d.toLowerCase() === dayNameFull);
      if (!matchesDay) continue;
      
      const endMin = timeToMinutes(schedule.end_time);
      const startMin = timeToMinutes(schedule.start_time);
      const isToday = offset === 0;
      const hasEnded = isToday && currentMinutes >= endMin;
      const hasStarted = isToday && currentMinutes >= startMin;
      
      // Build label
      let label: string;
      if (isToday) {
        label = `Today (${DAY_NAMES_SHORT[targetDow]})`;
      } else if (offset === 1) {
        label = `Tomorrow (${DAY_NAMES_SHORT[targetDow]})`;
      } else {
        label = `${DAY_NAMES_SHORT[targetDow]}, ${MONTH_NAMES_SHORT[targetDate.getMonth()]} ${targetDate.getDate()}`;
      }
      
      sessions.push({
        label,
        startTime: convertTo12Hour(schedule.start_time),
        endTime: convertTo12Hour(schedule.end_time),
        sortDate: targetDate,
        isToday,
        hasEnded,
        hasStarted,
      });
    }
  }
  
  // Sort by date then start time, non-ended sessions first for today
  sessions.sort((a, b) => {
    if (a.isToday && !a.hasEnded && b.isToday && b.hasEnded) return -1;
    if (a.isToday && a.hasEnded && b.isToday && !b.hasEnded) return 1;
    return a.sortDate.getTime() - b.sortDate.getTime();
  });
  
  return sessions.slice(0, count);
}

/**
 * Computes the next N upcoming sessions for a package based on its availability schedules.
 * Uses Michigan (Eastern) timezone.
 *
 * @param schedules - Array of PackageAvailabilitySchedule-like objects
 * @param count - Number of upcoming sessions to return (default 5)
 */
export function getUpcomingPackageSessions(
  schedules: { day_configuration: string[]; time_slot_start: string; time_slot_end: string; is_active?: boolean }[],
  count = 5,
): UpcomingSession[] {
  if (!schedules || schedules.length === 0) return [];
  
  const mi = getMichiganNow();
  const currentMinutes = mi.hour * 60 + mi.minute;
  const sessions: UpcomingSession[] = [];
  
  // Look ahead up to 14 days
  for (let offset = 0; offset < 14 && sessions.length < count; offset++) {
    const targetDate = new Date(mi.year, mi.month - 1, mi.day + offset);
    const targetDow = targetDate.getDay();
    const dayNameFull = DAY_NAMES_FULL[targetDow];
    
    for (const schedule of schedules) {
      // Skip inactive schedules
      if (schedule.is_active === false) continue;
      if (!schedule.day_configuration || !Array.isArray(schedule.day_configuration)) continue;
      
      const matchesDay = schedule.day_configuration.some(d => d.toLowerCase() === dayNameFull);
      if (!matchesDay) continue;
      
      const endMin = timeToMinutes(schedule.time_slot_end);
      const startMin = timeToMinutes(schedule.time_slot_start);
      const isToday = offset === 0;
      const hasEnded = isToday && currentMinutes >= endMin;
      const hasStarted = isToday && currentMinutes >= startMin;
      
      let label: string;
      if (isToday) {
        label = `Today (${DAY_NAMES_SHORT[targetDow]})`;
      } else if (offset === 1) {
        label = `Tomorrow (${DAY_NAMES_SHORT[targetDow]})`;
      } else {
        label = `${DAY_NAMES_SHORT[targetDow]}, ${MONTH_NAMES_SHORT[targetDate.getMonth()]} ${targetDate.getDate()}`;
      }
      
      sessions.push({
        label,
        startTime: convertTo12Hour(schedule.time_slot_start),
        endTime: convertTo12Hour(schedule.time_slot_end),
        sortDate: targetDate,
        isToday,
        hasEnded,
        hasStarted,
      });
    }
  }
  
  sessions.sort((a, b) => {
    if (a.isToday && !a.hasEnded && b.isToday && b.hasEnded) return -1;
    if (a.isToday && a.hasEnded && b.isToday && !b.hasEnded) return 1;
    return a.sortDate.getTime() - b.sortDate.getTime();
  });
  
  return sessions.slice(0, count);
}
