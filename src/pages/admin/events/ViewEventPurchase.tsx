import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  User,
  Calendar,
  CreditCard,
  MapPin,
  CheckCircle,
  XCircle,
  Clock,
  Ticket,
  DollarSign,
  FileText,
  Hash,
} from 'lucide-react';
import { formatLocalDateTime, convertTo12Hour } from '../../../utils/timeFormat';
import { useThemeColor } from '../../../hooks/useThemeColor';
import { eventPurchaseService } from '../../../services/EventPurchaseService';
import Toast from '../../../components/ui/Toast';
import StandardButton from '../../../components/ui/StandardButton';
import { AppliedFeesDisplay } from '../../../components/AppliedFeesDisplay';
import { AppliedDiscountsDisplay } from '../../../components/AppliedDiscountsDisplay';
import type { EventPurchase } from '../../../types/event.types';
import { getStoredUser } from '../../../utils/storage';

const ViewEventPurchase = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const from = searchParams.get('from');

  const getBackPath = () => {
    const user = getStoredUser();
    switch (from) {
      case 'notifications':
        return '/notifications';
      case 'dashboard':
        return -1 as unknown as string;
      case 'payments': {
        if (user?.role === 'location_manager') return '/manager/payments';
        if (user?.role === 'company_admin') return '/admin/payments';
        return '/payments';
      }
      default:
        return '/events/purchases';
    }
  };

  const getBackLabel = () => {
    switch (from) {
      case 'notifications': return 'Notifications';
      case 'dashboard': return 'Dashboard';
      case 'payments': return 'Payments';
      default: return 'Event Purchases';
    }
  };

  const { themeColor, fullColor } = useThemeColor();
  const [purchase, setPurchase] = useState<EventPurchase | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const statusConfig: Record<string, { color: string; icon: typeof CheckCircle; label: string }> = {
    confirmed: { color: 'bg-blue-100 text-blue-800', icon: CheckCircle, label: 'Confirmed' },
    'checked-in': { color: 'bg-green-100 text-green-800', icon: CheckCircle, label: 'Checked In' },
    pending: { color: 'bg-yellow-100 text-yellow-800', icon: Clock, label: 'Pending' },
    completed: { color: 'bg-emerald-100 text-emerald-800', icon: CheckCircle, label: 'Completed' },
    cancelled: { color: 'bg-red-100 text-red-800', icon: XCircle, label: 'Cancelled' },
  };

  const paymentStatusConfig: Record<string, { color: string; label: string }> = {
    paid: { color: 'bg-green-100 text-green-800', label: 'Paid' },
    partial: { color: 'bg-orange-100 text-orange-800', label: 'Partial' },
    pending: { color: 'bg-yellow-100 text-yellow-800', label: 'Pending' },
  };

  useEffect(() => {
    loadPurchaseDetails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const loadPurchaseDetails = async () => {
    try {
      setLoading(true);
      const result = await eventPurchaseService.getPurchase(Number(id));
      const raw = result as any;
      const purchaseData: EventPurchase | null = raw?.data ? raw.data : (raw?.id ? raw : null);
      setPurchase(purchaseData);
    } catch (error) {
      console.error('Error loading purchase details:', error);
      setToast({ message: 'Failed to load purchase details', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => formatLocalDateTime(dateString);

  const iconBg = `bg-${themeColor}-100`;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className={`animate-spin rounded-full h-12 w-12 border-b-2 border-${fullColor}`}></div>
      </div>
    );
  }

  if (!purchase) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Purchase not found</h2>
          <StandardButton variant="ghost" size="md" onClick={() => navigate(getBackPath())}>
            Back to {getBackLabel()}
          </StandardButton>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-6 py-8 animate-fade-in-up">
      <style>{`
        @keyframes fade-in-up {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-up { animation: fade-in-up 0.4s ease-out; }
      `}</style>
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <StandardButton variant="ghost" size="sm" onClick={() => navigate(getBackPath())} icon={ArrowLeft}>
              {''}
            </StandardButton>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Event Purchase Details</h1>
              <p className="text-gray-600 mt-1">Reference: {purchase.reference_number}</p>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          {/* Purchase Information */}
          <div className="p-6 border-b border-gray-100">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Purchase Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Customer */}
              <div className="flex items-start gap-3">
                <div className={`p-2 ${iconBg} rounded-lg`}>
                  <User className={`h-5 w-5 text-${fullColor}`} />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Customer</p>
                  <p className="font-medium text-gray-900">
                    {purchase.customer
                      ? `${purchase.customer.first_name} ${purchase.customer.last_name}`
                      : purchase.guest_name || 'Walk-in Customer'}
                  </p>
                  {(purchase.customer?.email || purchase.guest_email) && (
                    <p className="text-sm text-gray-600">{purchase.customer?.email || purchase.guest_email}</p>
                  )}
                  {(purchase.customer?.phone || purchase.guest_phone) && (
                    <p className="text-sm text-gray-600">{purchase.customer?.phone || purchase.guest_phone}</p>
                  )}
                </div>
              </div>

              {/* Reference Number */}
              <div className="flex items-start gap-3">
                <div className={`p-2 ${iconBg} rounded-lg`}>
                  <Hash className={`h-5 w-5 text-${fullColor}`} />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Reference Number</p>
                  <p className="font-medium text-gray-900 font-mono">{purchase.reference_number}</p>
                </div>
              </div>

              {/* Purchase Date */}
              <div className="flex items-start gap-3">
                <div className={`p-2 ${iconBg} rounded-lg`}>
                  <Calendar className={`h-5 w-5 text-${fullColor}`} />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Created At</p>
                  <p className="font-medium text-gray-900">{formatDate(purchase.created_at)}</p>
                </div>
              </div>

              {/* Status */}
              <div className="flex items-start gap-3">
                <div className={`p-2 ${iconBg} rounded-lg`}>
                  <CheckCircle className={`h-5 w-5 text-${fullColor}`} />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Status</p>
                  <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${statusConfig[purchase.status]?.color || 'bg-gray-100 text-gray-800'}`}>
                    {statusConfig[purchase.status]?.label || purchase.status}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Event Details */}
          <div className="p-6 border-b border-gray-100">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Event Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Event Name */}
              <div className="flex items-start gap-3">
                <div className={`p-2 ${iconBg} rounded-lg`}>
                  <MapPin className={`h-5 w-5 text-${fullColor}`} />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Event Name</p>
                  <p className="font-medium text-gray-900">{purchase.event?.name || 'Unknown Event'}</p>
                  {purchase.location?.name && (
                    <p className="text-sm text-gray-600">{purchase.location.name}</p>
                  )}
                </div>
              </div>

              {/* Quantity */}
              <div className="flex items-start gap-3">
                <div className={`p-2 ${iconBg} rounded-lg`}>
                  <Ticket className={`h-5 w-5 text-${fullColor}`} />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Quantity</p>
                  <p className="font-medium text-gray-900">{purchase.quantity} ticket{purchase.quantity > 1 ? 's' : ''}</p>
                </div>
              </div>

              {/* Scheduled Date & Time */}
              <div className="flex items-start gap-3">
                <div className={`p-2 ${iconBg} rounded-lg`}>
                  <Calendar className={`h-5 w-5 text-${fullColor}`} />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Scheduled</p>
                  <p className="font-medium text-gray-900">
                    {new Date(purchase.purchase_date.substring(0, 10) + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                    {purchase.purchase_time && (
                      <span className="ml-2 text-gray-600">at {convertTo12Hour(purchase.purchase_time)}</span>
                    )}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Purchased Add-ons */}
          {purchase.add_ons && purchase.add_ons.length > 0 && (
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Purchased Add-ons</h2>
              <div className="space-y-3">
                {purchase.add_ons.map((addOn, index) => (
                  <div key={addOn.id || index} className="flex items-center justify-between border border-gray-200 rounded-lg p-4 bg-gray-50">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900">{addOn.name}</p>
                      <p className="text-sm text-gray-500">
                        Qty: {addOn.pivot?.quantity || 1} × ${Number(addOn.pivot?.price_at_purchase || addOn.price || 0).toFixed(2)}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-semibold text-gray-900">
                        ${((addOn.pivot?.quantity || 1) * Number(addOn.pivot?.price_at_purchase || addOn.price || 0)).toFixed(2)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Event Features */}
          {purchase.event?.features && purchase.event.features.length > 0 && (
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Event Features</h2>
              <ul className="list-disc list-inside space-y-1">
                {purchase.event.features.map((feature, index) => (
                  <li key={index} className="text-sm text-gray-700">{feature}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Payment Information */}
          <div className="p-6 border-b border-gray-100 bg-gray-50">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Payment Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Total Amount */}
              <div className="flex items-start gap-3">
                <div className={`p-2 ${iconBg} rounded-lg`}>
                  <DollarSign className={`h-5 w-5 text-${fullColor}`} />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total Amount</p>
                  <p className="font-medium text-gray-900 text-2xl">
                    ${Number(purchase.total_amount || 0).toFixed(2)}
                  </p>
                </div>
              </div>

              {/* Amount Paid */}
              <div className="flex items-start gap-3">
                <div className={`p-2 ${iconBg} rounded-lg`}>
                  <DollarSign className={`h-5 w-5 text-${fullColor}`} />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Amount Paid</p>
                  <p className={`font-medium text-2xl ${Number(purchase.amount_paid) >= Number(purchase.total_amount) ? 'text-green-600' : 'text-orange-600'}`}>
                    ${Number(purchase.amount_paid || 0).toFixed(2)}
                  </p>
                </div>
              </div>

              {/* Payment Method */}
              <div className="flex items-start gap-3">
                <div className={`p-2 ${iconBg} rounded-lg`}>
                  <CreditCard className={`h-5 w-5 text-${fullColor}`} />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Payment Method</p>
                  <p className="font-medium text-gray-900 capitalize">
                    {purchase.payment_method?.replace('_', ' ').replace('.', ' ') || 'N/A'}
                  </p>
                </div>
              </div>

              {/* Payment Status */}
              <div className="flex items-start gap-3">
                <div className={`p-2 ${iconBg} rounded-lg`}>
                  <CheckCircle className={`h-5 w-5 text-${fullColor}`} />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Payment Status</p>
                  <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${paymentStatusConfig[purchase.payment_status]?.color || 'bg-gray-100 text-gray-800'}`}>
                    {paymentStatusConfig[purchase.payment_status]?.label || purchase.payment_status}
                  </span>
                </div>
              </div>

              {/* Transaction ID */}
              {purchase.transaction_id && (
                <div className="flex items-start gap-3">
                  <div className={`p-2 ${iconBg} rounded-lg`}>
                    <FileText className={`h-5 w-5 text-${fullColor}`} />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Transaction ID</p>
                    <p className="font-medium text-gray-900 font-mono text-sm">{purchase.transaction_id}</p>
                  </div>
                </div>
              )}

              {/* Discount */}
              {purchase.discount_amount && Number(purchase.discount_amount) > 0 && (
                <div className="flex items-start gap-3">
                  <div className={`p-2 ${iconBg} rounded-lg`}>
                    <DollarSign className={`h-5 w-5 text-${fullColor}`} />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Discount</p>
                    <p className="font-medium text-green-600">-${Number(purchase.discount_amount).toFixed(2)}</p>
                  </div>
                </div>
              )}

              {/* Applied Fees */}
              {purchase.applied_fees && purchase.applied_fees.length > 0 && (
                <div className="md:col-span-2">
                  <AppliedFeesDisplay appliedFees={purchase.applied_fees} />
                </div>
              )}

              {/* Applied Discounts */}
              {purchase.applied_discounts && purchase.applied_discounts.length > 0 && (
                <div className="md:col-span-2">
                  <AppliedDiscountsDisplay appliedDiscounts={purchase.applied_discounts} />
                </div>
              )}
            </div>
          </div>

          {/* Notes / Special Requests */}
          {(purchase.notes || purchase.special_requests) && (
            <div className="p-6 bg-gray-50">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Notes</h2>
              {purchase.notes && (
                <div className="mb-3">
                  <p className="text-sm font-medium text-gray-500">Notes</p>
                  <p className="text-gray-700">{purchase.notes}</p>
                </div>
              )}
              {purchase.special_requests && (
                <div>
                  <p className="text-sm font-medium text-gray-500">Special Requests</p>
                  <p className="text-gray-700">{purchase.special_requests}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 animate-fade-in-up">
          <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
        </div>
      )}
    </div>
  );
};

export default ViewEventPurchase;
