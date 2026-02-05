// src/components/admin/payments/ManualRefundModal.tsx
import React, { useState, useEffect } from 'react';
import {
  RotateCcw,
  X,
  DollarSign,
  AlertTriangle,
  Info,
} from 'lucide-react';
import { useThemeColor } from '../../../hooks/useThemeColor';
import StandardButton from '../../ui/StandardButton';
import { manualRefundPayment } from '../../../services/PaymentService';
import type { ManualRefundResponse, RefundErrorData } from '../../../types/Payment.types';
import type { PaymentsPagePayment } from '../../../types/Payments.types';

interface ManualRefundModalProps {
  payment: PaymentsPagePayment | null;
  open: boolean;
  onClose: () => void;
  onRefundComplete: (response: ManualRefundResponse) => void;
  onToast: (message: string, type: 'success' | 'error') => void;
}

const METHOD_LABELS: Record<string, string> = {
  'in-store': 'In-Store',
  'cash': 'Cash',
  'card': 'Card',
};

const ManualRefundModal: React.FC<ManualRefundModalProps> = ({
  payment,
  open,
  onClose,
  onRefundComplete,
  onToast,
}) => {
  const { themeColor, fullColor } = useThemeColor();
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [cancelBooking, setCancelBooking] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [maxRefundable, setMaxRefundable] = useState(0);

  // Reset form when payment changes
  useEffect(() => {
    if (payment) {
      setAmount(payment.amount.toFixed(2));
      setNotes('');
      setCancelBooking(false);
      setError(null);
      setMaxRefundable(payment.amount);
    }
  }, [payment]);

  // Auto-set cancel when full refund
  useEffect(() => {
    if (payment) {
      const refundAmt = parseFloat(amount) || 0;
      const paymentAmt = payment.amount;
      setCancelBooking(refundAmt >= paymentAmt);
    }
  }, [amount, payment]);

  if (!open || !payment) return null;

  const paymentAmount = payment.amount;
  const refundAmount = parseFloat(amount) || 0;
  const isFullRefund = refundAmount >= paymentAmount;
  const isPartialRefund = refundAmount > 0 && refundAmount < paymentAmount;
  const remainingAfterRefund = paymentAmount - refundAmount;
  const methodLabel = METHOD_LABELS[payment.method] || payment.method;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payment) return;

    if (refundAmount <= 0) {
      setError('Refund amount must be greater than $0.00');
      return;
    }

    if (refundAmount > maxRefundable) {
      setError(`Refund amount cannot exceed $${maxRefundable.toFixed(2)}`);
      return;
    }

    if (!notes.trim()) {
      setError('Notes are required for manual refunds. Please describe how the refund was processed.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await manualRefundPayment(payment.id, {
        amount: refundAmount,
        notes: notes.trim(),
        cancel: cancelBooking,
      });

      onToast(
        `Manual refund of $${refundAmount.toFixed(2)} recorded successfully. Refund Payment #${response.data.refund_payment.id}`,
        'success'
      );

      onRefundComplete(response);
      onClose();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string; data?: RefundErrorData } } };
      const errorData = axiosErr.response?.data;

      if (errorData?.data?.max_refundable !== undefined) {
        const refundErrorData = errorData.data as RefundErrorData;
        setMaxRefundable(refundErrorData.max_refundable);
        setAmount(refundErrorData.max_refundable.toFixed(2));
        setError(
          `${errorData.message}. Previously refunded: $${refundErrorData.total_already_refunded.toFixed(2)}`
        );
      } else {
        setError(errorData?.message || 'Manual refund failed. Please try again.');
      }

      onToast(errorData?.message || 'Manual refund failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-backdrop-fade"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto relative animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-orange-100">
              <RotateCcw className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">Manual Refund — {methodLabel}</h3>
              <p className="text-xs text-gray-500">Payment #{payment.id} • A new refund record will be created</p>
            </div>
          </div>
          <StandardButton
            onClick={onClose}
            variant="ghost"
            size="sm"
            icon={X}
            className="text-gray-400 hover:text-gray-600"
          />
        </div>

        <form onSubmit={handleSubmit}>
          <div className="px-6 py-4 space-y-4">
            {/* Staff Reminder Banner */}
            <div className="flex items-start gap-3 p-3 rounded-lg bg-blue-50 border border-blue-200">
              <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-medium">Staff Reminder</p>
                <p className="mt-1">
                  This records a manual refund — <strong>no automatic payment processing occurs</strong>.
                  Please ensure the {methodLabel.toLowerCase()} refund has been physically returned to the customer
                  before confirming.
                </p>
              </div>
            </div>

            {/* Payment Summary Card */}
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-2">
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Original Payment Details
              </h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-gray-500">Payment ID:</span>
                  <span className="ml-2 font-mono font-medium text-gray-900">#{payment.id}</span>
                </div>
                <div>
                  <span className="text-gray-500">Method:</span>
                  <span className="ml-2 font-medium text-gray-700">{methodLabel}</span>
                </div>
                <div>
                  <span className="text-gray-500">Amount:</span>
                  <span className="ml-2 font-semibold text-green-600">${paymentAmount.toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-gray-500">Customer:</span>
                  <span className="ml-2 text-gray-700">{payment.customerName || 'Guest'}</span>
                </div>
                <div>
                  <span className="text-gray-500">Date:</span>
                  <span className="ml-2 text-gray-700">
                    {new Date(payment.created_at).toLocaleDateString()}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">Status:</span>
                  <span className="ml-2 capitalize text-gray-700">{payment.status}</span>
                </div>
              </div>
            </div>

            {/* Error Alert */}
            {error && (
              <div className="flex items-start gap-3 p-3 rounded-lg bg-red-50 border border-red-200">
                <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {/* Refund Amount Input */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Refund Amount
                <span className="ml-2 text-xs text-gray-500">(Max: ${maxRefundable.toFixed(2)})</span>
              </label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={maxRefundable}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className={`w-full pl-8 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500`}
                  placeholder="0.00"
                  required
                />
              </div>

              {/* Quick amount buttons */}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setAmount(paymentAmount.toFixed(2))}
                  className={`px-3 py-1 text-xs font-medium rounded-lg border transition-colors ${
                    isFullRefund
                      ? 'border-orange-400 bg-orange-50 text-orange-700'
                      : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  Full (${paymentAmount.toFixed(2)})
                </button>
                <button
                  type="button"
                  onClick={() => setAmount((paymentAmount * 0.75).toFixed(2))}
                  className="px-3 py-1 text-xs font-medium rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  75% (${(paymentAmount * 0.75).toFixed(2)})
                </button>
                <button
                  type="button"
                  onClick={() => setAmount((paymentAmount * 0.5).toFixed(2))}
                  className="px-3 py-1 text-xs font-medium rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  50% (${(paymentAmount * 0.5).toFixed(2)})
                </button>
                <button
                  type="button"
                  onClick={() => setAmount((paymentAmount * 0.25).toFixed(2))}
                  className="px-3 py-1 text-xs font-medium rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  25% (${(paymentAmount * 0.25).toFixed(2)})
                </button>
              </div>
            </div>

            {/* Partial Refund Breakdown */}
            {isPartialRefund && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                <h5 className="text-sm font-medium text-amber-800">Partial Refund Breakdown</h5>
                <div className="mt-2 space-y-1 text-sm text-amber-700">
                  <div className="flex justify-between">
                    <span>Original payment:</span>
                    <span>${paymentAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-red-600">
                    <span>Refund amount:</span>
                    <span>-${refundAmount.toFixed(2)}</span>
                  </div>
                  <hr className="border-amber-300" />
                  <div className="flex justify-between font-semibold">
                    <span>Remaining on original:</span>
                    <span>${remainingAfterRefund.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Notes (Required) */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Refund Notes <span className="text-red-500">*</span>
                <span className="ml-2 text-xs text-gray-500">(Required — describe how refund was processed)</span>
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className={`w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500`}
                placeholder="e.g., Cash returned to customer at front desk, Card refund processed via POS terminal..."
                rows={3}
                required
              />
            </div>

            {/* Cancel Booking Checkbox */}
            <div className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 border border-gray-200">
              <input
                type="checkbox"
                id="manual-cancel-booking"
                checked={cancelBooking}
                onChange={(e) => setCancelBooking(e.target.checked)}
                className={`mt-0.5 h-4 w-4 rounded border-gray-300 text-${fullColor} focus:ring-${themeColor}-500`}
              />
              <div>
                <label htmlFor="manual-cancel-booking" className="text-sm font-medium text-gray-700 cursor-pointer">
                  Cancel the related booking / attraction purchase
                </label>
                {!cancelBooking && isPartialRefund && (
                  <p className="text-xs text-gray-500 mt-1">
                    ℹ️ The booking will stay active. The amount_paid on the booking will be reduced by ${refundAmount.toFixed(2)}.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
            <StandardButton
              variant="secondary"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </StandardButton>
            <StandardButton
              type="submit"
              variant="danger"
              disabled={loading || refundAmount <= 0 || refundAmount > maxRefundable || !notes.trim()}
              loading={loading}
              icon={RotateCcw}
            >
              {loading ? 'Processing...' : `Record Refund $${refundAmount.toFixed(2)}`}
            </StandardButton>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ManualRefundModal;
