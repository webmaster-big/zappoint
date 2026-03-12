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
  QrCode,
  Download,
  X
} from 'lucide-react';
import { formatDurationDisplay, formatLocalDateTime, convertTo12Hour } from '../../../utils/timeFormat';
import { useThemeColor } from '../../../hooks/useThemeColor';
import { attractionPurchaseService } from '../../../services/AttractionPurchaseService';
import Toast from '../../../components/ui/Toast';
import StandardButton from '../../../components/ui/StandardButton';
import { AppliedFeesDisplay } from '../../../components/AppliedFeesDisplay';
import { AppliedDiscountsDisplay } from '../../../components/AppliedDiscountsDisplay';
import { getStoredUser } from '../../../utils/storage';
import { generatePurchaseQRCode } from '../../../utils/qrcode';

const PurchaseDetails = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const from = searchParams.get('from');
  const getPaymentsPath = () => {
    const user = getStoredUser();
    if (user?.role === 'location_manager') return '/manager/payments';
    if (user?.role === 'company_admin') return '/admin/payments';
    return '/payments';
  };
  const getBackPath = () => {
    switch (from) {
      case 'notifications': return '/notifications';
      case 'dashboard': return -1 as any;
      case 'payments': return getPaymentsPath();
      default: return '/attractions/purchases';
    }
  };
  const getBackLabel = () => {
    switch (from) {
      case 'notifications': return 'Notifications';
      case 'dashboard': return 'Dashboard';
      case 'payments': return 'Payments';
      default: return 'Purchases';
    }
  };

  // Get auth token from localStorage
  const getAuthToken = () => {
    const userData = localStorage.getItem('zapzone_user');
    if (userData) {
      try {
        const user = JSON.parse(userData);
        return user.token;
      } catch (error) {
        console.error('Error parsing user data:', error);
        return null;
      }
    }
    return null;
  };
  const { fullColor } = useThemeColor();
  const [purchase, setPurchase] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [qrCodeData, setQrCodeData] = useState<string | null>(null);
  const [showQRModal, setShowQRModal] = useState(false);

  const statusConfig = {
    confirmed: { color: 'bg-blue-100 text-blue-800', icon: CheckCircle, label: 'Confirmed' },
    'checked-in': { color: 'bg-green-100 text-green-800', icon: CheckCircle, label: 'Checked In' },
    pending: { color: 'bg-yellow-100 text-yellow-800', icon: Clock, label: 'Pending' },
    cancelled: { color: 'bg-red-100 text-red-800', icon: XCircle, label: 'Cancelled' },
    refunded: { color: 'bg-purple-100 text-purple-800', icon: CheckCircle, label: 'Refunded' }
  };

  useEffect(() => {
    loadPurchaseDetails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const loadPurchaseDetails = async () => {
    try {
      setLoading(true);
      const authToken = getAuthToken();
      console.log('🔐 Loading purchase details - Auth Token:', authToken ? 'Present' : 'Missing');
      const response = await attractionPurchaseService.getPurchase(Number(id));
      setPurchase(response.data);
      // Generate QR code
      if (response.data?.id) {
        try {
          const qrCode = await generatePurchaseQRCode(response.data.id);
          setQrCodeData(qrCode);
        } catch (qrErr) {
          console.error('QR code generation failed:', qrErr);
        }
      }
    } catch (error) {
      console.error('Error loading purchase details:', error);
      setToast({ message: 'Failed to load purchase details', type: 'error' });
    } finally {
      setLoading(false);
    }
  };


  const formatDate = (dateString: string) => formatLocalDateTime(dateString);

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
          <StandardButton
            variant="ghost"
            size="md"
            onClick={() => navigate(getBackPath())}
          >
            Back to {getBackLabel()}
          </StandardButton>
        </div>
      </div>
    );
  }

  const status = purchase.status === 'completed' ? 'confirmed' : purchase.status;

  return (
    <div className="min-h-screen px-6 py-8 animate-fade-in-up">
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
              onClick={() => navigate(getBackPath())}
              icon={ArrowLeft}
            >
              {''}
            </StandardButton>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Purchase Details</h1>
              <p className="text-gray-600 mt-1">Purchase ID: #{purchase.id}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <StandardButton
              variant="primary"
              icon={QrCode}
              onClick={() => setShowQRModal(true)}
              disabled={!qrCodeData}
            >
              View QR Code
            </StandardButton>
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
                <div className={`p-2 bg-${fullColor.replace('-600', '')}-100 rounded-lg`}>
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

              {/* Purchase Date */}
              <div className="flex items-start gap-3">
                <div className={`p-2 bg-${fullColor.replace('-600', '')}-100 rounded-lg`}>
                  <Calendar className={`h-5 w-5 text-${fullColor}`} />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Purchase Date</p>
                  <p className="font-medium text-gray-900">{formatDate(purchase.created_at)}</p>
                </div>
              </div>

              {/* Status */}
              <div className="flex items-start gap-3">
                <div className={`p-2 bg-${fullColor.replace('-600', '')}-100 rounded-lg`}>
                  <CheckCircle className={`h-5 w-5 text-${fullColor}`} />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Status</p>
                  <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${statusConfig[status as keyof typeof statusConfig]?.color}`}>
                    {statusConfig[status as keyof typeof statusConfig]?.label}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Attraction Details */}
          <div className="p-6 border-b border-gray-100">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Attraction Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Attraction */}
              <div className="flex items-start gap-3">
                <div className={`p-2 bg-${fullColor.replace('-600', '')}-100 rounded-lg`}>
                  <MapPin className={`h-5 w-5 text-${fullColor}`} />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Attraction Name</p>
                  <p className="font-medium text-gray-900">{purchase.attraction?.name || 'Unknown'}</p>
                  {purchase.attraction?.category && (
                    <p className="text-sm text-gray-600">{purchase.attraction.category}</p>
                  )}
                </div>
              </div>

              {/* Quantity */}
              <div className="flex items-start gap-3">
                <div className={`p-2 bg-${fullColor.replace('-600', '')}-100 rounded-lg`}>
                  <Ticket className={`h-5 w-5 text-${fullColor}`} />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Quantity</p>
                  <p className="font-medium text-gray-900">{purchase.quantity} ticket{purchase.quantity > 1 ? 's' : ''}</p>
                </div>
              </div>

              {/* Scheduled Date & Time */}
              {purchase.scheduled_date && (
                <div className="flex items-start gap-3">
                  <div className={`p-2 bg-${fullColor.replace('-600', '')}-100 rounded-lg`}>
                    <Calendar className={`h-5 w-5 text-${fullColor}`} />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Scheduled</p>
                    <p className="font-medium text-gray-900">
                      {new Date(purchase.scheduled_date.substring(0, 10) + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                      {purchase.scheduled_time && (
                        <span className="ml-2 text-gray-600">at {convertTo12Hour(purchase.scheduled_time)}</span>
                      )}
                    </p>
                  </div>
                </div>
              )}

              {/* Duration */}
              {purchase.attraction?.duration && (
                <div className="flex items-start gap-3">
                  <div className={`p-2 bg-${fullColor.replace('-600', '')}-100 rounded-lg`}>
                    <Clock className={`h-5 w-5 text-${fullColor}`} />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Duration</p>
                    <p className="font-medium text-gray-900">
                      {formatDurationDisplay(purchase.attraction.duration, purchase.attraction.duration_unit)}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Purchased Add-ons */}
          {purchase.add_ons && purchase.add_ons.length > 0 && (
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Purchased Add-ons</h2>
              <div className="space-y-3">
                {purchase.add_ons.map((addOn: any, index: number) => (
                  <div key={addOn.id || index} className="flex items-center justify-between border border-gray-200 rounded-lg p-4 bg-gray-50">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900">{addOn.name || addOn.add_on?.name || 'Add-on'}</p>
                      <p className="text-sm text-gray-500">
                        Qty: {addOn.quantity || addOn.pivot?.quantity || 1} × ${Number(addOn.price_at_purchase || addOn.pivot?.price_at_purchase || addOn.price || 0).toFixed(2)}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-semibold text-gray-900">
                        ${(
                          (addOn.quantity || addOn.pivot?.quantity || 1) *
                          Number(addOn.price_at_purchase || addOn.pivot?.price_at_purchase || addOn.price || 0)
                        ).toFixed(2)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Payment Information */}
          <div className="p-6 border-b border-gray-100 bg-gray-50">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Payment Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Total Amount */}
              <div className="flex items-start gap-3">
                <div className={`p-2 bg-${fullColor.replace('-600', '')}-100 rounded-lg`}>
                  <DollarSign className={`h-5 w-5 text-${fullColor}`} />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total Amount</p>
                  <p className="font-medium text-gray-900 text-2xl">
                    ${Number(purchase.total_amount || 0).toFixed(2)}
                  </p>
                </div>
              </div>

              {/* Payment Method */}
              <div className="flex items-start gap-3">
                <div className={`p-2 bg-${fullColor.replace('-600', '')}-100 rounded-lg`}>
                  <CreditCard className={`h-5 w-5 text-${fullColor}`} />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Payment Method</p>
                  <p className="font-medium text-gray-900 capitalize">
                    {purchase.payment_method?.replace('_', ' ') || 'N/A'}
                  </p>
                </div>
              </div>

              {/* Transaction ID */}
              {purchase.transaction_id && (
                <div className="flex items-start gap-3">
                  <div className={`p-2 bg-${fullColor.replace('-600', '')}-100 rounded-lg`}>
                    <FileText className={`h-5 w-5 text-${fullColor}`} />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Transaction ID</p>
                    <p className="font-medium text-gray-900 font-mono text-sm">
                      {purchase.transaction_id}
                    </p>
                  </div>
                </div>
              )}
              {purchase.payment_id && (
                <div className="flex items-start gap-3">
                  <div className={`p-2 bg-${fullColor.replace('-600', '')}-100 rounded-lg`}>
                    <FileText className={`h-5 w-5 text-${fullColor}`} />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Payment ID</p>
                    <p className="font-medium text-gray-900 font-mono text-sm">
                      {purchase.payment_id}
                    </p>
                  </div>
                </div>
              )}

              {purchase.applied_fees && purchase.applied_fees.length > 0 && (
                <div className="md:col-span-2">
                  <AppliedFeesDisplay appliedFees={purchase.applied_fees} />
                </div>
              )}

              {(purchase as any).applied_discounts && (purchase as any).applied_discounts.length > 0 && (
                <div className="md:col-span-2">
                  <AppliedDiscountsDisplay appliedDiscounts={(purchase as any).applied_discounts} />
                </div>
              )}
            </div>
          </div>

          {/* Notes */}
          {purchase.notes && (
            <div className="p-6 bg-gray-50">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Notes</h2>
              <p className="text-gray-700">{purchase.notes}</p>
            </div>
          )}
        </div>
      </div>

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

      {/* QR Code Modal */}
      {showQRModal && qrCodeData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowQRModal(false)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">Attraction Ticket QR Code</h3>
              <button onClick={() => setShowQRModal(false)} className="p-1.5 hover:bg-gray-100 rounded-lg transition">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            
            <div className="flex flex-col items-center">
              <img 
                src={qrCodeData} 
                alt="Attraction Ticket QR Code" 
                className="w-64 h-64 mb-4 border-2 border-gray-200 rounded-lg"
              />
              <p className="text-sm text-gray-600 mb-2 text-center">
                Purchase ID: <span className="font-semibold">#{purchase.id}</span>
              </p>
              {purchase.attraction?.name && (
                <p className="text-sm text-gray-500 mb-4 text-center">{purchase.attraction.name}</p>
              )}
              <StandardButton
                variant="primary"
                icon={Download}
                onClick={() => {
                  const link = document.createElement('a');
                  link.download = `attraction-ticket-${purchase.id}.png`;
                  link.href = qrCodeData;
                  link.click();
                }}
                fullWidth
              >
                Download QR Code
              </StandardButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PurchaseDetails;
