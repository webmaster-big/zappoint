import { MessageSquare, StickyNote } from 'lucide-react';
import type { BookingNoteFlags } from '../../../utils/bookingNotes';

interface BookingNoteBadgesProps {
  flags: BookingNoteFlags;
}

/**
 * The note indicators on a day-view block. Icon only — the words themselves are printed on the
 * block once it is tall enough, because the hover card that used to carry them never opens on a
 * tablet or a phone, which is what the desk actually uses.
 */
const BookingNoteBadges: React.FC<BookingNoteBadgesProps> = ({ flags }) => {
  if (!flags.guest && !flags.staff) return null;

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
      {flags.guest && (
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
