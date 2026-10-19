import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Loader2, LogIn } from 'lucide-react';
import bookingService, { type Booking } from '../../../services/bookingService';
import { resolvePaymentState } from '../../../types/Bookings.types';
import { outstandingBalanceOf } from '../../../utils/bookingCheckIn';
import { formatMoney } from '../../../utils/cardLabel';
import { getStoredUser } from '../../../utils/storage';

interface CheckInTarget {
  reference_number: string;
  status?: string | null;
  payment_status?: string | null;
  total_amount?: number | string | null;
  amount_paid?: number | string | null;
}

export interface CheckedInPatch {
  status: 'checked-in';
  checked_in_at?: Booking['checked_in_at'];
}

interface BookingCheckInActionProps {
  booking: CheckInTarget;
  /** Called only after the API has confirmed the check-in. */
  onCheckedIn: (patch: CheckedInPatch) => void;
}

const FAILED = 'Check-in failed. Please try again.';

const messageOf = (err: unknown): string => {
  const e = err as { response?: { data?: { message?: string } } };
  return e.response?.data?.message || FAILED;
};

/**
 * The quick view's Check In button and its confirmation. The dialog closes as soon as staff confirm,
 * so a change-reason prompt raised by the request is never hidden behind it; progress and any
 * refusal from the server are shown on the button instead.
 */
const BookingCheckInAction: React.FC<BookingCheckInActionProps> = ({ booking, onCheckedIn }) => {
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submittingRef = useRef(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const helpId = useId();

  const payment = resolvePaymentState(booking);
  const balance = outstandingBalanceOf(booking);
  const owing = !payment.isSettled;

  const dismiss = useCallback(() => {
    setConfirming(false);
    window.setTimeout(() => triggerRef.current?.focus(), 0);
  }, []);

  useEffect(() => {
    if (!confirming) return;
    cancelRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopImmediatePropagation();
        event.preventDefault();
        dismiss();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled])'));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !dialogRef.current.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !dialogRef.current.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [confirming, dismiss]);

  const checkIn = async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setConfirming(false);
    setSubmitting(true);
    setError(null);
    try {
      const response = await bookingService.checkInBooking(booking.reference_number, getStoredUser()?.id);
      if (!response?.success) {
        setError(response?.message || FAILED);
        return;
      }
      onCheckedIn({ status: 'checked-in', checked_in_at: response.data?.checked_in_at });
    } catch (err) {
      setError(messageOf(err));
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col gap-1">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setConfirming(true)}
        disabled={submitting}
        className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-emerald-700 bg-white border border-emerald-300 rounded-lg hover:bg-emerald-50 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? <Loader2 size={15} className="animate-spin" /> : <LogIn size={15} />}
        {submitting ? 'Checking in...' : 'Check In'}
      </button>
      {error && (
        <p role="alert" className="text-xs text-red-600">
          {error}
        </p>
      )}

      {confirming &&
        createPortal(
          <div
            className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4"
            onClick={event => {
              event.stopPropagation();
              dismiss();
            }}
          >
            <div
              ref={dialogRef}
              role="alertdialog"
              aria-modal="true"
              aria-labelledby={titleId}
              aria-describedby={helpId}
              className="w-full max-w-md rounded-xl bg-white shadow-2xl"
              onClick={event => event.stopPropagation()}
            >
              <div className="px-5 py-4">
                <h3 id={titleId} className="flex items-center gap-2 text-base font-semibold text-gray-900">
                  {owing && <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />}
                  {owing ? 'Check in with a balance due?' : 'Confirm check-in for this party?'}
                </h3>
                <div id={helpId} className="mt-2 space-y-2 text-sm text-gray-700">
                  {owing ? (
                    <>
                      <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900">
                        This booking is <span className="font-semibold">{payment.label.toLowerCase()}</span>
                        {balance !== null ? (
                          <>
                            {' '}and has an outstanding balance of <span className="font-semibold">{formatMoney(balance)}</span>
                            {payment.amountPaid > 0 ? ` (${formatMoney(payment.amountPaid)} of ${formatMoney(payment.total)} paid)` : ''}.
                          </>
                        ) : (
                          '.'
                        )}
                      </p>
                      <p>Checking in does not take or record a payment. The balance stays due until it is collected with Process Payment.</p>
                    </>
                  ) : (
                    <p>Booking {booking.reference_number} will be marked as checked in.</p>
                  )}
                </div>
              </div>
              <div className="flex flex-col-reverse gap-2 border-t border-gray-100 px-5 py-3 sm:flex-row sm:justify-end">
                <button
                  ref={cancelRef}
                  type="button"
                  onClick={dismiss}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void checkIn()}
                  className={`rounded-lg px-4 py-2 text-sm font-medium text-white transition ${
                    owing ? 'bg-amber-600 hover:bg-amber-700' : 'bg-emerald-600 hover:bg-emerald-700'
                  }`}
                >
                  {owing ? 'Check in anyway' : 'Check in'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};

export default BookingCheckInAction;
