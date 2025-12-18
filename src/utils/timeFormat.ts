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
