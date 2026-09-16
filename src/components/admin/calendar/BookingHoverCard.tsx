import { createPortal } from 'react-dom';
import { AlertTriangle, Users } from 'lucide-react';

const CARD_WIDTH = 248;
const GAP = 10;
const MARGIN = 8;

export interface BookingHoverCardProps {
  anchor: DOMRect;
  guestName: string;
  timeLabel: string;
  packageName: string;
  participants: number;
  amount: number;
  paymentLabel: string;
  paymentClass: string;
  status: string;
  reference?: string | null;
  overlapLabel?: string | null;
  overlapTitle?: string;
  overlapTone?: 'overlap' | 'tight';
  flag?: { label: string; tone: 'red' | 'emerald' } | null;
}

const statusTone = (status: string): string => {
  if (status === 'confirmed') return 'bg-green-500';
  if (status === 'pending') return 'bg-yellow-500';
  if (status === 'checked-in') return 'bg-emerald-600';
  if (status === 'cancelled') return 'bg-gray-400';
  return 'bg-blue-500';
};

/**
 * Anchored to the block but rendered at the document root, so a short booking can show its
 * whole detail without growing inside the column — where it would be a few pixels wide, clipped
 * by the scroller, and sitting over the bookings underneath it.
 */
const BookingHoverCard: React.FC<BookingHoverCardProps> = ({
  anchor,
  guestName,
  timeLabel,
  packageName,
  participants,
  amount,
  paymentLabel,
  paymentClass,
  status,
  reference,
  overlapLabel,
  overlapTitle = 'Overlaps',
  overlapTone = 'overlap',
  flag,
}) => {
  if (typeof document === 'undefined') return null;

  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  const spaceRight = viewportWidth - anchor.right;
  const left = spaceRight >= CARD_WIDTH + GAP + MARGIN
    ? anchor.right + GAP
    : Math.max(MARGIN, anchor.left - CARD_WIDTH - GAP);

  const top = Math.min(
    Math.max(MARGIN, anchor.top),
    Math.max(MARGIN, viewportHeight - MARGIN - 200)
  );

  return createPortal(
    <div
      role="tooltip"
      className="pointer-events-none fixed z-[70] rounded-lg border border-gray-200 bg-white p-3 shadow-xl"
      style={{ left, top, width: CARD_WIDTH, maxHeight: viewportHeight - top - MARGIN, overflow: 'hidden' }}
    >
      <div className="mb-1.5 flex items-center gap-1.5">
        <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase text-white ${statusTone(status)}`}>
          {status}
        </span>
        {flag && (
          <span
            className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase text-white ${
              flag.tone === 'red' ? 'bg-red-500' : 'bg-emerald-500'
            }`}
          >
            {flag.label}
          </span>
        )}
        {reference && (
          <span className="ml-auto truncate text-[10px] font-medium text-gray-400">#{reference.slice(-6)}</span>
        )}
      </div>

      <p className="text-xs font-bold tabular-nums text-gray-700">{timeLabel}</p>
      <p className="text-sm font-semibold break-words text-gray-900">{guestName}</p>
      <p className="text-xs break-words text-gray-600">{packageName}</p>

      <p className="mt-1 flex items-center gap-1 text-xs text-gray-600">
        <Users className="h-3 w-3 shrink-0" />
        {participants} {participants === 1 ? 'guest' : 'guests'}
      </p>

      {overlapLabel && (
        <p
          className={`mt-1.5 flex items-start gap-1 rounded border px-1.5 py-1 text-[10px] leading-snug break-words ${
            overlapTone === 'overlap'
              ? 'border-rose-200 bg-rose-50 text-rose-800'
              : 'border-amber-200 bg-amber-50 text-amber-800'
          }`}
        >
          <AlertTriangle className="mt-px h-3 w-3 shrink-0" />
          <span>
            <span className="font-bold uppercase">{overlapTitle}</span> {overlapLabel}
          </span>
        </p>
      )}

      <div className="mt-2 flex items-center justify-between gap-2 border-t border-gray-100 pt-1.5 text-xs">
        <span className="font-bold text-gray-900">${amount.toFixed(2)}</span>
        <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${paymentClass}`}>{paymentLabel}</span>
      </div>
    </div>,
    document.body
  );
};

export default BookingHoverCard;
