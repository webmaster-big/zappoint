import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  User, 
  Mail, 
  Phone, 
  Calendar, 
  CreditCard, 
  MapPin,
  CheckCircle,
  XCircle,
  Clock,
  Ticket,
  DollarSign,
  FileText
} from 'lucide-react';
import { useThemeColor } from '../../../hooks/useThemeColor';
import { attractionPurchaseService } from '../../../services/AttractionPurchaseService';
import Toast from '../../../components/ui/Toast';

const PurchaseDetails = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

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
  const { themeColor, fullColor } = useThemeColor();
  const [purchase, setPurchase] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const statusConfig = {
    completed: { color: `bg-green-100 text-green-800`, icon: CheckCircle, label: 'Confirmed' },
    pending: { color: 'bg-yellow-100 text-yellow-800', icon: Clock, label: 'Pending' },
    cancelled: { color: 'bg-red-100 text-red-800', icon: XCircle, label: 'Cancelled' },
    refunded: { color: 'bg-purple-100 text-purple-800', icon: CheckCircle, label: 'Refunded' }
  };

  useEffect(() => {
    loadPurchaseDetails();
  }, [id]);

  const loadPurchaseDetails = async () => {
    try {
      setLoading(true);
      const authToken = getAuthToken();
      console.log('🔐 Loading purchase details - Auth Token:', authToken ? 'Present' : 'Missing');
      const response = await attractionPurchaseService.getPurchase(Number(id));
      setPurchase(response.data);
    } catch (error) {
      console.error('Error loading purchase details:', error);
      setToast({ message: 'Failed to load purchase details', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    try {
      await attractionPurchaseService.updatePurchase(Number(id), { status: newStatus as 'pending' | 'completed' | 'cancelled' });
      setToast({ message: 'Status updated successfully', type: 'success' });
      loadPurchaseDetails();
    } catch (error) {
      console.error('Error updating status:', error);
      setToast({ message: 'Failed to update status', type: 'error' });
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

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
          <button
            onClick={() => navigate('/attractions/purchases')}
            className={`text-${fullColor} hover:underline`}
          >
            Back to Purchases
          </button>
        </div>
      </div>
    );
  }

  const status = purchase.status === 'completed' ? 'completed' : purchase.status;

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
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => navigate('/attractions/purchases')}
          className={`flex items-center text-gray-600 hover:text-${fullColor} mb-4 transition-colors`}
        >
          <ArrowLeft className="h-5 w-5 mr-2" />
          Back to Purchases
        </button>
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Purchase Details</h1>
            <p className="text-gray-600 mt-2">Purchase ID: #{purchase.id}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`px-4 py-2 rounded-full text-sm font-medium ${statusConfig[status as keyof typeof statusConfig]?.color}`}>
              {statusConfig[status as keyof typeof statusConfig]?.label}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Customer Information */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className={`text-xl font-bold text-${fullColor} mb-4 flex items-center`}>
              <User className="h-5 w-5 mr-2" />
              Customer Information
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-gray-600">Name</label>
                <p className="text-gray-900 font-medium">
                  {purchase.customer 
                    ? `${purchase.customer.first_name} ${purchase.customer.last_name}`
                    : purchase.guest_name || 'Walk-in Customer'}
                </p>
              </div>
              <div>
                <label className="text-sm text-gray-600 flex items-center">
                  <Mail className="h-4 w-4 mr-1" />
                  Email
                </label>
                <p className="text-gray-900 font-medium">
                  {purchase.customer?.email || purchase.guest_email || 'N/A'}
                </p>
              </div>
              <div>
                <label className="text-sm text-gray-600 flex items-center">
                  <Phone className="h-4 w-4 mr-1" />
                  Phone
                </label>
                <p className="text-gray-900 font-medium">
                  {purchase.customer?.phone || purchase.guest_phone || 'N/A'}
                </p>
              </div>
              <div>
                <label className="text-sm text-gray-600 flex items-center">
                  <Calendar className="h-4 w-4 mr-1" />
                  Purchase Date
                </label>
                <p className="text-gray-900 font-medium">{formatDate(purchase.created_at)}</p>
              </div>
            </div>
          </div>

          {/* Attraction Details */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className={`text-xl font-bold text-${fullColor} mb-4 flex items-center`}>
              <MapPin className="h-5 w-5 mr-2" />
              Attraction Details
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-gray-600">Attraction Name</label>
                <p className="text-gray-900 font-medium">{purchase.attraction?.name || 'Unknown'}</p>
              </div>
              <div>
                <label className="text-sm text-gray-600">Category</label>
                <p className="text-gray-900 font-medium">{purchase.attraction?.category || 'N/A'}</p>
              </div>
              <div>
                <label className="text-sm text-gray-600 flex items-center">
                  <Ticket className="h-4 w-4 mr-1" />
                  Quantity
                </label>
                <p className="text-gray-900 font-medium">{purchase.quantity} ticket{purchase.quantity > 1 ? 's' : ''}</p>
              </div>
              <div>
                <label className="text-sm text-gray-600">Duration</label>
                <p className="text-gray-900 font-medium">
                  {purchase.attraction?.duration 
                    ? `${purchase.attraction.duration} ${purchase.attraction.duration_unit || 'minutes'}`
                    : 'N/A'}
                </p>
              </div>
            </div>
          </div>

          {/* Payment Information */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className={`text-xl font-bold text-${fullColor} mb-4 flex items-center`}>
              <CreditCard className="h-5 w-5 mr-2" />
              Payment Information
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-gray-600">Payment Method</label>
                <p className="text-gray-900 font-medium capitalize">
                  {purchase.payment_method?.replace('_', ' ') || 'N/A'}
                </p>
              </div>
              <div>
                <label className="text-sm text-gray-600 flex items-center">
                  <DollarSign className="h-4 w-4 mr-1" />
                  Total Amount
                </label>
                <p className="text-gray-900 font-medium text-lg">
                  ${Number(purchase.total_amount || 0).toFixed(2)}
                </p>
              </div>
              {purchase.transaction_id && (
                <div>
                  <label className="text-sm text-gray-600">Transaction ID</label>
                  <p className="text-gray-900 font-medium font-mono text-sm">
                    {purchase.transaction_id}
                  </p>
                </div>
              )}
              {purchase.payment_id && (
                <div>
                  <label className="text-sm text-gray-600">Payment ID</label>
                  <p className="text-gray-900 font-medium font-mono text-sm">
                    {purchase.payment_id}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Notes */}
          {purchase.notes && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h2 className={`text-xl font-bold text-${fullColor} mb-4 flex items-center`}>
                <FileText className="h-5 w-5 mr-2" />
                Notes
              </h2>
              <p className="text-gray-700">{purchase.notes}</p>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Status Management */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className={`text-lg font-bold text-${fullColor} mb-4`}>Status Management</h2>
            <div className="space-y-3">
              <button
                onClick={() => handleStatusChange('completed')}
                disabled={status === 'completed'}
                className={`w-full py-2 px-4 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
                  status === 'completed'
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-green-600 text-white hover:bg-green-700'
                }`}
              >
                <CheckCircle className="h-4 w-4" />
                Mark as Confirmed
              </button>
              <button
                onClick={() => handleStatusChange('pending')}
                disabled={status === 'pending'}
                className={`w-full py-2 px-4 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
                  status === 'pending'
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-yellow-600 text-white hover:bg-yellow-700'
                }`}
              >
                <Clock className="h-4 w-4" />
                Mark as Pending
              </button>
              <button
                onClick={() => handleStatusChange('cancelled')}
                disabled={status === 'cancelled'}
                className={`w-full py-2 px-4 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
                  status === 'cancelled'
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-red-600 text-white hover:bg-red-700'
                }`}
              >
                <XCircle className="h-4 w-4" />
                Mark as Cancelled
              </button>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className={`text-lg font-bold text-${fullColor} mb-4`}>Quick Stats</h2>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Price per Ticket</span>
                <span className="font-medium text-gray-900">
                  ${purchase.attraction?.price 
                    ? Number(purchase.attraction.price).toFixed(2) 
                    : (Number(purchase.total_amount || 0) / purchase.quantity).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Quantity</span>
                <span className="font-medium text-gray-900">{purchase.quantity}</span>
              </div>
              <div className={`flex justify-between items-center pt-3 border-t border-${themeColor}-200`}>
                <span className="text-sm font-semibold text-gray-900">Total</span>
                <span className={`font-bold text-${fullColor} text-lg`}>
                  ${Number(purchase.total_amount || 0).toFixed(2)}
                </span>
              </div>
            </div>
          </div>
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
    </div>
  );
};

export default PurchaseDetails;
