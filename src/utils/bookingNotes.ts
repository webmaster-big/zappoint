/**
 * Which booking note belongs to whom.
 *
 * `notes` is the guest's: it is rendered into the confirmation and update emails, so whatever is in
 * it has already been read by the customer — even on the occasions a staff member typed it for them.
 * `special_requests` is the same audience and is effectively retired (no writer remains), so it is
 * folded in rather than given an indicator of its own.
 *
 * `internal_notes` is the desk's. It appears in no guest email and its only write route is staff-gated.
 * Label these by AUDIENCE, never by author.
 */

const clean = (value?: string | null): string => (typeof value === 'string' ? value.trim() : '');

type NotedBooking = {
  notes?: string | null;
  internal_notes?: string | null;
  special_requests?: string | null;
};

export const guestNoteOf = (booking: unknown): string => {
  const source = (booking ?? {}) as NotedBooking;
  const parts = [clean(source.notes), clean(source.special_requests)].filter(Boolean);

  return parts.join('\n\n');
};

export const staffNoteOf = (booking: unknown): string => clean(((booking ?? {}) as NotedBooking).internal_notes);

export interface BookingNoteFlags {
  guest: boolean;
  staff: boolean;
}

export const noteFlagsOf = (booking: unknown): BookingNoteFlags => ({
  guest: guestNoteOf(booking).length > 0,
  staff: staffNoteOf(booking).length > 0,
});

/** For a screen reader and the block's tooltip — says which kinds exist, not what they say. */
export const noteSummaryOf = (booking: unknown): string | null => {
  const { guest, staff } = noteFlagsOf(booking);

  if (guest && staff) return 'has a guest note and a staff note';
  if (guest) return 'has a guest note';
  if (staff) return 'has a staff note';

  return null;
};
