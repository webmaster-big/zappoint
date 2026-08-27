import { normalizeAvailability } from './attractionSchedule';

export interface PackageScheduleLike {
  availability_type?: string;
  day_configuration?: string[] | null;
  time_slot_start?: string | null;
  time_slot_end?: string | null;
  is_active?: boolean;
}

export const attractionIsCallToBook = (availability: unknown): boolean => {
  const blocks = normalizeAvailability(availability);
  return !blocks.some(
    block => Array.isArray(block.days) && block.days.length > 0 && Boolean(block.start_time) && Boolean(block.end_time),
  );
};

export const packageIsCallToBook = (schedules: PackageScheduleLike[] | null | undefined): boolean => {
  if (!Array.isArray(schedules) || schedules.length === 0) return true;

  return !schedules.some(schedule => {
    if (schedule?.is_active === false) return false;
    if (!schedule?.time_slot_start || !schedule?.time_slot_end) return false;
    if (schedule.availability_type === 'weekly' || schedule.availability_type === 'monthly') {
      return Array.isArray(schedule.day_configuration) && schedule.day_configuration.length > 0;
    }
    return true;
  });
};

export const eventIsCallToBook = (
  event: { time_start?: string | null; time_end?: string | null } | null | undefined,
): boolean => !event?.time_start || !event?.time_end;

export const itemCallToBookAt = (
  byLocation: Record<number, boolean> | undefined,
  groupFallback: boolean,
  locationId?: number | null,
): boolean => {
  if (locationId != null && byLocation && locationId in byLocation) return byLocation[locationId];
  if (byLocation) {
    const values = Object.values(byLocation);
    if (values.length > 0) return values.every(Boolean);
  }
  return groupFallback;
};
