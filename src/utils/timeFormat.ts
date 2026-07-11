export function parseLocalDate(isoDateString: string): Date {
  if (!isoDateString) return new Date();
  const [year, month, day] = isoDateString.split('T')[0].split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function parseLocalDateTime(dateTimeString: string): Date {
  if (!dateTimeString) return new Date();
  const cleaned = dateTimeString.replace('T', ' ').replace(/[Z]$/, '');
  const [datePart, timePart] = cleaned.split(' ');
  const [year, month, day] = datePart.split('-').map(Number);
  if (!timePart) return new Date(year, month - 1, day);
  const timeParts = timePart.split(':');
  const hour = parseInt(timeParts[0], 10) || 0;
  const minute = parseInt(timeParts[1], 10) || 0;
  const second = parseInt(timeParts[2], 10) || 0;
  return new Date(year, month - 1, day, hour, minute, second);
}

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

export function convertTo12Hour(time24: string): string {
  if (!time24) return '';
  
  const timeWithoutSeconds = time24.substring(0, 5);
  
  const [hourStr, minuteStr] = timeWithoutSeconds.split(':');
  let hour = parseInt(hourStr, 10);
  const minute = minuteStr || '00';
  
  const period = hour >= 12 ? 'PM' : 'AM';
  
  if (hour === 0) {
    hour = 12; // Midnight
  } else if (hour > 12) {
    hour = hour - 12;
  }
  
  return `${hour}:${minute} ${period}`;
}

export function formatTimeRange(startTime: string, endTime: string): string {
  if (!startTime || !endTime) return '';
  return `${convertTo12Hour(startTime)} - ${convertTo12Hour(endTime)}`;
}

export function formatDurationDisplay(
  duration: number | string | undefined,
  durationUnit: string | undefined
): string {
  if (duration === undefined || duration === null || duration === '') return 'Not specified';
  
  const durationValue = typeof duration === 'string' ? parseFloat(duration) : duration;
  
  if (isNaN(durationValue)) return 'Not specified';
  
  if (durationValue === 0) return 'Unlimited';
  
  if (durationUnit === 'hours and minutes') {
    const hours = Math.floor(durationValue);
    const minutes = Math.round((durationValue % 1) * 60);
    if (hours > 0 && minutes > 0) return `${hours} hr ${minutes} min`;
    if (hours > 0) return hours === 1 ? '1 hour' : `${hours} hours`;
    if (minutes > 0) return `${minutes} min`;
    return 'Not specified';
  }
  
  if (durationUnit === 'hours') {
    const wholeHours = Math.floor(durationValue);
    const decimalPart = durationValue % 1;
    if (decimalPart < 0.01) {
      return wholeHours === 1 ? '1 hour' : `${wholeHours} hours`;
    }
    return durationValue === 1 ? '1 hour' : `${durationValue} hours`;
  }
  
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
  
  const wholeValue = Math.floor(durationValue);
  const decimalPart = durationValue % 1;
  if (decimalPart < 0.01) {
    return `${wholeValue} ${durationUnit || 'hours'}`;
  }
  return `${durationValue} ${durationUnit || 'hours'}`;
}

const MICHIGAN_TZ = 'America/Detroit';

export function getMichiganNow(): { year: number; month: number; day: number; hour: number; minute: number; dayOfWeek: number; date: Date } {
  const now = new Date();
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
  
  const date = new Date(year, month - 1, day, hour, minute);
  
  return { year, month, day, hour, minute, dayOfWeek, date };
}

export function formatDateLong(dateStr?: string | null): string {
  if (!dateStr) return '—';
  const date = parseLocalDate(dateStr);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

export function formatDateTimeET(iso?: string | null): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-US', {
    timeZone: MICHIGAN_TZ,
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }) + ' ET';
}

export interface UpcomingSession {
  label: string;
  startTime: string;
  endTime: string;
  sortDate: Date;
  isToday: boolean;
  hasEnded: boolean;
  hasStarted: boolean;
}

const DAY_NAMES_FULL = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const DAY_NAMES_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function timeToMinutes(time: string): number {
  if (!time) return 0;
  const [h, m] = time.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function getUpcomingAttractionSessions(
  schedules: { days: string[]; start_time: string; end_time: string }[],
  count = 5,
): UpcomingSession[] {
  if (!schedules || schedules.length === 0) return [];
  
  const mi = getMichiganNow();
  const currentMinutes = mi.hour * 60 + mi.minute;
  const sessions: UpcomingSession[] = [];
  
  for (let offset = 0; offset < 14 && sessions.length < count; offset++) {
    const targetDate = new Date(mi.year, mi.month - 1, mi.day + offset);
    const targetDow = targetDate.getDay(); // 0=Sun
    const dayNameFull = DAY_NAMES_FULL[targetDow];
    
    for (const schedule of schedules) {
      if (!schedule.days || !Array.isArray(schedule.days)) continue;
      
      const matchesDay = schedule.days.some(d => d.toLowerCase() === dayNameFull);
      if (!matchesDay) continue;
      
      const endMin = timeToMinutes(schedule.end_time);
      const startMin = timeToMinutes(schedule.start_time);
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
        startTime: convertTo12Hour(schedule.start_time),
        endTime: convertTo12Hour(schedule.end_time),
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

export function getUpcomingPackageSessions(
  schedules: { day_configuration: string[]; time_slot_start: string; time_slot_end: string; is_active?: boolean }[],
  count = 5,
): UpcomingSession[] {
  if (!schedules || schedules.length === 0) return [];
  
  const mi = getMichiganNow();
  const currentMinutes = mi.hour * 60 + mi.minute;
  const sessions: UpcomingSession[] = [];
  
  for (let offset = 0; offset < 14 && sessions.length < count; offset++) {
    const targetDate = new Date(mi.year, mi.month - 1, mi.day + offset);
    const targetDow = targetDate.getDay();
    const dayNameFull = DAY_NAMES_FULL[targetDow];
    
    for (const schedule of schedules) {
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
