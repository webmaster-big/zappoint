import { resolvePaymentState } from '../types/Bookings.types';

interface CheckInCandidate {
  status?: string | null;
  payment_status?: string | null;
  total_amount?: number | string | null;
  amount_paid?: number | string | null;
}

export const isCheckInEligible = (booking: CheckInCandidate): boolean =>
  String(booking.status ?? '').toLowerCase() === 'confirmed';

export const outstandingBalanceOf = (booking: CheckInCandidate): number | null => {
  const payment = resolvePaymentState(booking);
  return !payment.isSettled && payment.balance > 0 ? payment.balance : null;
};
