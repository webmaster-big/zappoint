import { useState } from 'react';
import { X, Ban, AlertTriangle } from 'lucide-react';
import StandardButton from '../../ui/StandardButton';
import { voidPayment } from '../../../services/PaymentService';
import type { VoidResponse } from '../../../types/Payment.types';
import type { PaymentsPagePayment } from '../../../types/Payments.types';

interface VoidDialogProps {
  payment: PaymentsPagePayment | null;
  open: boolean;
  onClose: () => void;
  onVoidComplete: (response: VoidResponse) => void;
  onToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

const VoidDialog: React.FC<VoidDialogProps> = ({
  payment,
  open,
  onClose,
  onVoidComplete,
  onToast,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open || !payment) return null;

  const paymentAmount = payment.amount;

  const handleVoid = async () => {
    if (!payment) return;

    setLoading(true);
    setError(null);

    try {
      const response = await voidPayment(payment.id);

      onToast(
        `Payment #${payment.id} voided successfully ($${paymentAmount.toFixed(2)}). The related booking has been cancelled.`,
        'success'
      );

      onVoidComplete(response);
      onClose();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string; error_code?: string } } };
      const errorData = axiosErr.response?.data;
      let message = errorData?.message || 'Void failed. Please try again.';

      // If the transaction is already settled, suggest refund instead
      if (errorData?.error_code === '310') {
        message = 'This transaction has already been settled. Use "Refund" instead of "Void".';
      }

      setError(message);
      onToast(message, 'error');
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
        className="bg-white rounded-xl shadow-2xl max-w-md w-full relative animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-100">
              <Ban className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-red-600">Void Payment #{payment.id}</h3>
              <p className="text-xs text-gray-500">Cancel an unsettled transaction</p>
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

        <div className="px-6 py-4 space-y-4">
          {/* Payment Summary */}
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-gray-500">Amount:</span>
                <span className="ml-2 font-semibold text-gray-900">${paymentAmount.toFixed(2)}</span>
              </div>
              <div>
                <span className="text-gray-500">Method:</span>
                <span className="ml-2 capitalize text-gray-700">{payment.method}</span>
              </div>
              <div>
                <span className="text-gray-500">Customer:</span>
                <span className="ml-2 text-gray-700">{payment.customerName || 'Guest'}</span>
              </div>
              <div>
                <span className="text-gray-500">Transaction:</span>
                <span className="ml-2 font-mono text-xs text-gray-700">
                  {payment.transaction_id ? payment.transaction_id.slice(0, 16) + (payment.transaction_id.length > 16 ? '...' : '') : 'N/A'}
                </span>
              </div>
            </div>
          </div>

          {/* Description */}
          <p className="text-sm text-gray-600">
            This will void the entire transaction of{' '}
            <strong className="text-gray-900">${paymentAmount.toFixed(2)}</strong>{' '}
            and <strong className="text-red-600">cancel the related booking</strong>.
          </p>

          {/* Warning */}
          <div className="flex items-start gap-3 p-3 rounded-lg bg-yellow-50 border border-yellow-200">
            <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-yellow-800">
              <p className="font-semibold mb-0.5">Important</p>
              <p>
                <strong>Void</strong> is for <strong>unsettled</strong> transactions only 
                (typically within 24 hours of the charge). If the transaction has already 
                settled, use <strong>Refund</strong> instead.
              </p>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-3 p-3 rounded-lg bg-red-50 border border-red-200">
              <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
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
            variant="danger"
            onClick={handleVoid}
            disabled={loading}
            loading={loading}
            icon={Ban}
          >
            {loading ? 'Voiding...' : `Void $${paymentAmount.toFixed(2)}`}
          </StandardButton>
        </div>
      </div>
    </div>
  );
};

export default VoidDialog;
