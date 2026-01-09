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
