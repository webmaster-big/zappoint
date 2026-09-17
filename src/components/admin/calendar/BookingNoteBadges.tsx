import { MessageSquare, StickyNote } from 'lucide-react';
import type { BookingNoteFlags } from '../../../utils/bookingNotes';

interface BookingNoteBadgesProps {
  flags: BookingNoteFlags;
  /** how tall the block is, so a sliver does not try to carry an icon */
  height: number;
}

/**
 * The note indicators on a day-view block. Icon only, never a label — the words live in the hover
 * card and the modal, and a label here would eat the guest name on a short booking.
 */
const BookingNoteBadges: React.FC<BookingNoteBadgesProps> = ({ flags, height }) => {
  if (!flags.guest && !flags.staff) return null;
  // below this the block's own text is already clipped, so an icon would only steal from it
  if (height < 20) return null;

  // a very short block has room for one: the staff note wins, being rarer and written for staff
  const tight = height < 30 && flags.guest && flags.staff;

  return (
    <>
      {flags.staff && (
        <span
          className="flex items-center rounded bg-amber-100 px-0.5 py-px text-amber-700"
          title="Staff note — not shown to the guest"
        >
          <StickyNote className="h-2.5 w-2.5 shrink-0" strokeWidth={2.5} />
        </span>
      )}
      {flags.guest && !tight && (
        <span
          className="flex items-center rounded bg-blue-100 px-0.5 py-px text-blue-700"
          title="Note from the guest"
        >
          <MessageSquare className="h-2.5 w-2.5 shrink-0" strokeWidth={2.5} />
        </span>
      )}
    </>
  );
};

export default BookingNoteBadges;
