import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams, Link } from 'react-router-dom';
import { 
  DollarSign, 
  User,
  MapPin,
  CheckCircle,
  AlertCircle,
  ArrowLeft,
  Calendar,
  CreditCard,
  Clock,
  FileText,
  Package,
  Ticket,
  RefreshCw
} from 'lucide-react';
import { useThemeColor } from '../../../hooks/useThemeColor';
import { getPayment, canRefund, canVoid, canManualRefund } from '../../../services/PaymentService';
import type { Payment } from '../../../types/Payment.types';
import type { PaymentsPagePayment } from '../../../types/Payments.types';
import StandardButton from '../../../components/ui/StandardButton';
import Toast from '../../../components/ui/Toast';
import { getImageUrl } from '../../../utils/storage';
import RefundModal from '../../../components/admin/payments/RefundModal';
import VoidDialog from '../../../components/admin/payments/VoidDialog';
import ManualRefundModal from '../../../components/admin/payments/ManualRefundModal';

const ViewPayment: React.FC = () => {
  const { themeColor, fullColor } = useThemeColor();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const from = searchParams.get('from');
  const getBackPath = () => {
    switch (from) {
      case 'notifications': return '/notifications';
      case 'dashboard': return -1 as any;
      case 'bookings': return '/bookings';
      default: return '/payments';
    }
  };
  const getBackLabel = () => {
    switch (from) {
      case 'notifications': return 'Notifications';
      case 'dashboard': return 'Dashboard';
      case 'bookings': return 'Bookings';
      default: return 'Payments';
    }
  };
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Refund/Void modal state
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [showVoidDialog, setShowVoidDialog] = useState(false);
  const [showManualRefundModal, setShowManualRefundModal] = useState(false);

  // Convert Payment to PaymentsPagePayment for modal compatibility
  const toPaymentsPagePayment = (p: Payment): PaymentsPagePayment => ({
    id: p.id,
    payable_id: p.payable_id,
    payable_type: p.payable_type,
    customer_id: p.customer_id ?? undefined,
    location_id: p.location_id,
    amount: Number(p.amount),
    currency: p.currency,
    method: p.method as PaymentsPagePayment['method'],
    status: p.status as PaymentsPagePayment['status'],
    transaction_id: p.transaction_id,
    payment_id: p.payment_id ?? undefined,
    notes: p.notes ?? undefined,
    paid_at: p.paid_at ?? undefined,
    refunded_at: p.refunded_at ?? undefined,
    created_at: p.created_at,
    updated_at: p.updated_at,
    booking: p.booking,
    attractionPurchase: p.attractionPurchase || p.attraction_purchase,
    customerName: p.customer ? `${p.customer.first_name} ${p.customer.last_name}` : p.booking?.guest_name || undefined,
    customerEmail: p.customer?.email || p.booking?.guest_email || undefined,
    signature_image: p.signature_image,
    terms_accepted: p.terms_accepted,
  });

  const handleRefundComplete = () => {
    setShowRefundModal(false);
    setToast({ message: 'Payment refunded successfully', type: 'success' });
    reloadPayment();
  };

  const handleVoidComplete = () => {
    setShowVoidDialog(false);
    setToast({ message: 'Payment voided successfully', type: 'success' });
    reloadPayment();
  };

  const handleManualRefundComplete = () => {
    setShowManualRefundModal(false);
    setToast({ message: 'Manual refund processed successfully', type: 'success' });
    reloadPayment();
  };

  const reloadPayment = async () => {
    if (!id) return;
    try {
      const response = await getPayment(Number(id));
      if (response.success && response.data) {
        setPayment(response.data);
      }
    } catch (error) {
      console.error('Error reloading payment:', error);
    }
  };

  // Load payment data
  useEffect(() => {
    const loadPayment = async () => {
      if (!id) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      try {
        const response = await getPayment(Number(id));
        if (response.success && response.data) {
          setPayment(response.data);
        } else {
          setNotFound(true);
        }
      } catch (error) {
        console.error('Error loading payment:', error);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };

    loadPayment();
  }, [id]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className={`animate-spin rounded-full h-12 w-12 border-b-2 border-${fullColor}`}></div>
      </div>
    );
  }

  if (notFound || !payment) {
    return (
      <div className="px-6 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <AlertCircle className="h-12 w-12 text-red-600 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-red-800 mb-2">Payment Not Found</h2>
            <p className="text-red-600 mb-4">The payment you're looking for doesn't exist.</p>
            <StandardButton
              variant="primary"
              onClick={() => navigate(getBackPath())}
            >
              Back to {getBackLabel()}
            </StandardButton>
          </div>
        </div>
      </div>
    );
  }

  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    completed: 'bg-green-100 text-green-800',
    failed: 'bg-red-100 text-red-800',
    refunded: 'bg-purple-100 text-purple-800',
    voided: 'bg-gray-100 text-gray-800'
  };

  const methodLabels: Record<string, string> = {
    card: 'Credit Card',
    cash: 'Cash',
    'authorize.net': 'Authorize.Net',
    'in-store': 'In-Store'
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Determine payable type and details
  const payableType = payment.payable_type || (payment.booking_id ? 'App\\Models\\Booking' : null);
  const isBooking = payableType?.includes('Booking');
  const isPurchase = payableType?.includes('AttractionPurchase');
  const payableData = payment.booking || payment.attractionPurchase || payment.attraction_purchase || payment.payable;

  return (
    <div className="px-6 py-8 animate-fade-in-up">
      <style>{`
        @keyframes fade-in-up {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in-up {
          animation: fade-in-up 0.4s ease-out;
        }
      `}</style>
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <StandardButton
              variant="ghost"
              size="sm"
              icon={ArrowLeft}
              onClick={() => navigate(getBackPath())}
            >
              {''}
            </StandardButton>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Payment Details</h1>
              <p className="text-gray-600 mt-1">Transaction ID: {payment.transaction_id || 'N/A'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {isBooking && payableData && (
              <Link
                to={`/bookings/${payment.payable_id || payment.booking_id}`}
                className={`flex items-center gap-2 px-4 py-2 bg-${themeColor}-600 text-white rounded-lg hover:bg-${themeColor}-700`}
              >
                <Package className="h-4 w-4" />
                View Booking
              </Link>
            )}
            {isPurchase && payableData && (
              <Link
                to={`/attraction-purchases/${payment.payable_id}`}
                className={`flex items-center gap-2 px-4 py-2 bg-${themeColor}-600 text-white rounded-lg hover:bg-${themeColor}-700`}
              >
                <Ticket className="h-4 w-4" />
                View Purchase
              </Link>
            )}
          </div>
        </div>

        {/* Status Alerts */}
        {payment.status === 'refunded' && (
          <div className="mb-6 p-4 bg-purple-50 border border-purple-200 rounded-lg flex items-start gap-3">
            <RefreshCw className="h-5 w-5 text-purple-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-purple-800">Refunded Payment</p>
              <p className="text-sm text-purple-600">
                This payment was refunded{payment.refunded_at ? ` on ${formatDate(payment.refunded_at)}` : ''}.
              </p>
            </div>
          </div>
        )}

        {payment.status === 'voided' && (
          <div className="mb-6 p-4 bg-gray-100 border border-gray-300 rounded-lg flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-gray-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-gray-800">Voided Payment</p>
              <p className="text-sm text-gray-600">This payment has been voided.</p>
            </div>
          </div>
        )}

        {payment.status === 'failed' && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-red-800">Failed Payment</p>
              <p className="text-sm text-red-600">This payment failed to process.</p>
            </div>
          </div>
        )}

        {payment.status === 'completed' && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
            <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-green-800">Completed Payment</p>
              <p className="text-sm text-green-600">This payment was processed successfully.</p>
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          {/* Payment Information */}
          <div className="p-6 border-b border-gray-100">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Payment Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Amount */}
              <div className="flex items-start gap-3">
                <div className={`p-2 bg-${themeColor}-100 rounded-lg`}>
                  <DollarSign className={`h-5 w-5 text-${fullColor}`} />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Amount</p>
                  <p className="font-medium text-gray-900 text-2xl">
                    ${Number(payment.amount).toFixed(2)} {payment.currency}
                  </p>
                </div>
              </div>

              {/* Status */}
              <div className="flex items-start gap-3">
                <div className={`p-2 bg-${themeColor}-100 rounded-lg`}>
                  <CheckCircle className={`h-5 w-5 text-${fullColor}`} />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Status</p>
                  <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${statusColors[payment.status]}`}>
                    {payment.status.charAt(0).toUpperCase() + payment.status.slice(1)}
                  </span>
                </div>
              </div>

              {/* Payment Method */}
              <div className="flex items-start gap-3">
                <div className={`p-2 bg-${themeColor}-100 rounded-lg`}>
                  <CreditCard className={`h-5 w-5 text-${fullColor}`} />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Payment Method</p>
                  <p className="font-medium text-gray-900">{methodLabels[payment.method] || payment.method}</p>
                </div>
              </div>

              {/* Transaction ID */}
              <div className="flex items-start gap-3">
                <div className={`p-2 bg-${themeColor}-100 rounded-lg`}>
                  <FileText className={`h-5 w-5 text-${fullColor}`} />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Transaction ID</p>
                  <p className="font-medium text-gray-900 font-mono text-sm">{payment.transaction_id || 'N/A'}</p>
                </div>
              </div>

              {/* Payment ID (if different from transaction_id) */}
              {payment.payment_id && payment.payment_id !== payment.transaction_id && (
                <div className="flex items-start gap-3">
                  <div className={`p-2 bg-${themeColor}-100 rounded-lg`}>
                    <FileText className={`h-5 w-5 text-${fullColor}`} />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Payment ID</p>
                    <p className="font-medium text-gray-900 font-mono text-sm">{payment.payment_id}</p>
                  </div>
                </div>
              )}

              {/* Date */}
              <div className="flex items-start gap-3">
                <div className={`p-2 bg-${themeColor}-100 rounded-lg`}>
                  <Calendar className={`h-5 w-5 text-${fullColor}`} />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Payment Date</p>
                  <p className="font-medium text-gray-900">{formatDate(payment.paid_at || payment.created_at)}</p>
                </div>
              </div>

              {/* Location */}
              {payment.location && (
                <div className="flex items-start gap-3">
                  <div className={`p-2 bg-${themeColor}-100 rounded-lg`}>
                    <MapPin className={`h-5 w-5 text-${fullColor}`} />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Location</p>
                    <p className="font-medium text-gray-900">{payment.location.name}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Customer Information */}
          {(() => {
            // Get customer info from payment.customer, booking guest, or purchase guest
            const customerName = payment.customer 
              ? `${payment.customer.first_name} ${payment.customer.last_name}`
              : payment.booking?.guest_name || (payment.attractionPurchase || payment.attraction_purchase)?.guest_name;
            
            const customerEmail = payment.customer?.email 
              || payment.booking?.guest_email 
              || (payment.attractionPurchase || payment.attraction_purchase)?.guest_email;
            
            const customerPhone = payment.customer?.phone 
              || payment.booking?.guest_phone 
              || (payment.attractionPurchase || payment.attraction_purchase)?.guest_phone;

            if (!customerName) return null;

            return (
              <div className="p-6 border-b border-gray-100 bg-gray-50">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Customer Information</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="flex items-start gap-3">
                    <div className={`p-2 bg-${themeColor}-100 rounded-lg`}>
                      <User className={`h-5 w-5 text-${fullColor}`} />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Customer</p>
                      <p className="font-medium text-gray-900">{customerName}</p>
                      {customerEmail && (
                        <p className="text-sm text-gray-600">{customerEmail}</p>
                      )}
                      {customerPhone && (
                        <p className="text-sm text-gray-600">{customerPhone}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Related Booking/Purchase Information */}
          {payableData && (
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                {isBooking ? 'Booking Information' : 'Purchase Information'}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {isBooking && payment.booking && (
                  <>
                    <div className="flex items-start gap-3">
                      <div className={`p-2 bg-${themeColor}-100 rounded-lg`}>
                        <Package className={`h-5 w-5 text-${fullColor}`} />
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Reference Number</p>
                        <p className="font-medium text-gray-900">{payment.booking.reference_number || 'N/A'}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className={`p-2 bg-${themeColor}-100 rounded-lg`}>
                        <User className={`h-5 w-5 text-${fullColor}`} />
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Guest Name</p>
                        <p className="font-medium text-gray-900">{payment.booking.guest_name || 'N/A'}</p>
                      </div>
                    </div>
                    {payment.booking.booking_date && (
                      <div className="flex items-start gap-3">
                        <div className={`p-2 bg-${themeColor}-100 rounded-lg`}>
                          <Calendar className={`h-5 w-5 text-${fullColor}`} />
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Booking Date</p>
                          <p className="font-medium text-gray-900">
                            {new Date(payment.booking.booking_date).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    )}
                    <div className="flex items-start gap-3">
                      <div className={`p-2 bg-${themeColor}-100 rounded-lg`}>
                        <DollarSign className={`h-5 w-5 text-${fullColor}`} />
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Booking Total</p>
                        <p className="font-medium text-gray-900">
                          ${Number(payment.booking.total_amount || 0).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </>
                )}
                {isPurchase && (payment.attractionPurchase || payment.attraction_purchase) && (
                  <>
                    {(() => {
                      const purchase = payment.attractionPurchase || payment.attraction_purchase;
                      return (
                        <>
                          <div className="flex items-start gap-3">
                            <div className={`p-2 bg-${themeColor}-100 rounded-lg`}>
                              <Ticket className={`h-5 w-5 text-${fullColor}`} />
                            </div>
                            <div>
                              <p className="text-sm text-gray-500">Transaction ID</p>
                              <p className="font-medium text-gray-900">{purchase?.transaction_id || 'N/A'}</p>
                            </div>
                          </div>
                          <div className="flex items-start gap-3">
                            <div className={`p-2 bg-${themeColor}-100 rounded-lg`}>
                              <User className={`h-5 w-5 text-${fullColor}`} />
                            </div>
                            <div>
                              <p className="text-sm text-gray-500">Guest Name</p>
                              <p className="font-medium text-gray-900">{purchase?.guest_name || 'N/A'}</p>
                            </div>
                          </div>
                        </>
                      );
                    })()}
                  </>
                )}
              </div>
            </div>
          )}

          {/* Notes */}
          {payment.notes && (
            <div className="p-6 border-b border-gray-100 bg-gray-50">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Notes</h2>
              <p className="text-gray-700 whitespace-pre-wrap">{payment.notes}</p>
            </div>
          )}

          {/* Signature & Terms */}
          {(payment.signature_image || payment.terms_accepted) && (
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Signature & Terms</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {payment.terms_accepted && (
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <span className="text-gray-700">Terms & Conditions Accepted</span>
                  </div>
                )}
                {payment.signature_image && (
                  <div>
                    <p className="text-sm text-gray-500 mb-2">Customer Signature</p>
                    <div className="border border-gray-200 rounded-lg p-4 bg-white inline-block">
                      <img 
                        src={getImageUrl(payment.signature_image)} 
                        alt="Customer Signature" 
                        className="max-h-24"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="p-6 bg-gray-50">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Actions</h2>
            <div className="flex gap-3">
              {canRefund(payment) && (
                <StandardButton variant="secondary" icon={RefreshCw} onClick={() => setShowRefundModal(true)}>
                  Refund Payment
                </StandardButton>
              )}
              {canVoid(payment) && (
                <StandardButton variant="secondary" icon={AlertCircle} onClick={() => setShowVoidDialog(true)}>
                  Void Payment
                </StandardButton>
              )}
              {canManualRefund(payment) && (
                <StandardButton variant="secondary" icon={RefreshCw} onClick={() => setShowManualRefundModal(true)}>
                  Manual Refund
                </StandardButton>
              )}
              {!canRefund(payment) && !canVoid(payment) && !canManualRefund(payment) && (
                <p className="text-gray-500 text-sm">No actions available for this payment.</p>
              )}
            </div>
          </div>

          {/* Timestamps */}
          <div className="p-6 bg-gray-100 border-t border-gray-200">
            <div className="flex items-center gap-6 text-sm text-gray-500">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                <span>Created: {formatDate(payment.created_at)}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                <span>Updated: {formatDate(payment.updated_at)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Refund Modal */}
      <RefundModal
        payment={toPaymentsPagePayment(payment)}
        open={showRefundModal}
        onClose={() => setShowRefundModal(false)}
        onRefundComplete={handleRefundComplete}
        onToast={(message, type) => setToast({ message, type })}
      />

      {/* Void Dialog */}
      <VoidDialog
        payment={toPaymentsPagePayment(payment)}
        open={showVoidDialog}
        onClose={() => setShowVoidDialog(false)}
        onVoidComplete={handleVoidComplete}
        onToast={(message, type) => setToast({ message, type })}
      />

      {/* Manual Refund Modal */}
      <ManualRefundModal
        payment={toPaymentsPagePayment(payment)}
        open={showManualRefundModal}
        onClose={() => setShowManualRefundModal(false)}
        onRefundComplete={handleManualRefundComplete}
        onToast={(message, type) => setToast({ message, type })}
      />

      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 animate-fade-in-up">
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(null)}
          />
        </div>
      )}
    </div>
  );
};

export default ViewPayment;
