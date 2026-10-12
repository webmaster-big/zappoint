import { buildBookingUrl } from './bookingPrefill';

export type BlockBookingKind = 'package' | 'space' | 'attraction' | 'event';

export const blockBookingPath = (kind: BlockBookingKind, locationId: number | null, date: string): string => {
  if (kind === 'space') return '/bookings/manual';
  if (kind === 'attraction') return '/attractions/purchases/create';
  if (kind === 'event') return '/events/onsite-purchase';
  return buildBookingUrl({ locationId, date, minute: Number.NaN });
};
