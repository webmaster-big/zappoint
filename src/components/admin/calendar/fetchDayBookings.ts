import bookingService, { type Booking } from '../../../services/bookingService';

const SCHEDULE_STATUSES = ['confirmed', 'pending', 'checked-in'];
const PER_PAGE = 100;
const MAX_PAGES = 20;

export function isScheduleBooking(booking: Pick<Booking, 'status'>): boolean {
  return SCHEDULE_STATUSES.includes(String(booking.status || '').toLowerCase());
}

export async function fetchDayBookings(dateKey: string, locationId?: number | null): Promise<Booking[]> {
  const collected: Booking[] = [];
  let page = 1;
  let lastPage = 1;

  do {
    const response = await bookingService.getBookings({
      booking_date: dateKey,
      per_page: PER_PAGE,
      page,
      sort_by: 'booking_time',
      sort_order: 'asc',
      ...(locationId ? { location_id: locationId } : {}),
    });
    collected.push(...(response?.data?.bookings ?? []));
    lastPage = response?.data?.pagination?.last_page ?? 1;
    page += 1;
  } while (page <= lastPage && page <= MAX_PAGES);

  const unique = new Map();
  for (const booking of collected) unique.set(booking.id, booking);
  return [...unique.values()].filter(isScheduleBooking);
}
