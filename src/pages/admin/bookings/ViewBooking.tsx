import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams, Link } from 'react-router-dom';
import QRCode from 'qrcode';
import { 
  Calendar, 
  Users, 
  DollarSign, 
  Package, 
  Clock, 
  User,
  MapPin,
  Home,
  CheckCircle,
  AlertCircle,
  ArrowLeft,
  Pencil,
  Download,
  QrCode
} from 'lucide-react';
import { useThemeColor } from '../../../hooks/useThemeColor';
import bookingService, { type Booking } from '../../../services/bookingService';
import { bookingCacheService } from '../../../services/BookingCacheService';
import { getStoredUser } from '../../../utils/storage';
import { formatDurationDisplay, convertTo12Hour, parseLocalDate, formatLocalDateTime } from '../../../utils/timeFormat';
import StandardButton from '../../../components/ui/StandardButton';

const ViewBooking: React.FC = () => {
  const { themeColor, fullColor } = useThemeColor();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const referenceNumber = searchParams.get('ref');
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
      case 'calendar': return '/bookings/calendar';
      case 'space-schedule': return '/bookings/space-schedule';
      default: return '/bookings';
    }
  };
  const getBackLabel = () => {
    switch (from) {
      case 'notifications': return 'Notifications';
      case 'dashboard': return 'Dashboard';
      case 'payments': return 'Payments';
      case 'calendar': return 'Calendar';
      case 'space-schedule': return 'Space Schedule';
      default: return 'Bookings';
    }
  };
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [qrCodeData, setQrCodeData] = useState<string | null>(null);
  const [showQRModal, setShowQRModal] = useState(false);

  // Load booking data - try cache first, then API
  useEffect(() => {
    const loadBooking = async () => {
      if (!id && !referenceNumber) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      try {
        let bookingData: Booking | null = null;
        
        // Try to get from cache first by ID
        if (id) {
          const cached = await bookingCacheService.getBookingFromCache(Number(id));
          if (cached) {
            bookingData = cached as Booking;
          }
        }
        
        // If not in cache, fetch from API
        if (!bookingData) {
          // Prefer reference number lookup if available
          if (referenceNumber) {
            const response = await bookingService.getBookings({ reference_number: referenceNumber });
            if (response.success && response.data && response.data.bookings.length > 0) {
              bookingData = response.data.bookings[0];
            }
          } else if (id) {
            // Fallback to ID lookup
            const response = await bookingService.getBookingById(Number(id));
            if (response.success && response.data) {
              bookingData = response.data;
            }
          }
        }

        if (bookingData) {
          setBooking(bookingData);
          // Generate QR code
          if (bookingData.reference_number) {
            const qrCode = await QRCode.toDataURL(bookingData.reference_number, {
              width: 300,
              margin: 2,
              errorCorrectionLevel: 'M',
            });
            setQrCodeData(qrCode);
          }
        } else {
          setNotFound(true);
        }
      } catch (error) {
        console.error('Error loading booking:', error);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };

    loadBooking();
  }, [id, referenceNumber]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className={`animate-spin rounded-full h-12 w-12 border-b-2 border-${fullColor}`}></div>
      </div>
    );
  }

  if (notFound || !booking) {
    return (
      <div className="px-6 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <AlertCircle className="h-12 w-12 text-red-600 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-red-800 mb-2">Booking Not Found</h2>
            <p className="text-red-600 mb-4">The booking you're looking for doesn't exist.</p>
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

  const statusColors = {
    pending: 'bg-yellow-100 text-yellow-800',
    confirmed: `bg-${themeColor}-100 text-${fullColor}`,
    cancelled: 'bg-red-100 text-red-800',
    completed: 'bg-green-100 text-green-800',
    'checked-in': `bg-${themeColor}-100 text-${fullColor}`
  };

  const handleDownloadQRCode = () => {
    if (!qrCodeData || !booking) return;
    
    const link = document.createElement('a');
    link.download = `booking-qrcode-${booking.reference_number}.png`;
    link.href = qrCodeData;
    link.click();
  };

  const paymentStatusColors = {
    paid: 'bg-green-100 text-green-800',
    partial: 'bg-yellow-100 text-yellow-800',
    pending: 'bg-gray-100 text-gray-800'
  };

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
              <h1 className="text-3xl font-bold text-gray-900">Booking Details</h1>
              <p className="text-gray-600 mt-1">Reference: #{booking.reference_number}</p>
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
            <Link
              to={`/bookings/edit/${booking.id}?ref=${booking.reference_number}`}
              className={`flex items-center gap-2 px-4 py-2 bg-${themeColor}-600 text-white rounded-lg hover:bg-${themeColor}-700`}
            >
              <Pencil className="h-4 w-4" />
              Edit Booking
            </Link>
          </div>
        </div>

        {/* Status Alerts */}
        {booking.status === 'cancelled' && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-red-800">Cancelled Booking</p>
              <p className="text-sm text-red-600">This booking has been cancelled.</p>
            </div>
          </div>
        )}

        {booking.status === 'completed' && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
            <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-green-800">Completed Booking</p>
              <p className="text-sm text-green-600">This booking has been completed successfully.</p>
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          {/* Booking Information */}
          <div className="p-6 border-b border-gray-100">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Booking Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Customer */}
              <div className="flex items-start gap-3">
                <div className={`p-2 bg-${themeColor}-100 rounded-lg`}>
                  <User className={`h-5 w-5 text-${fullColor}`} />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Customer</p>
                  <p className="font-medium text-gray-900">{booking.guest_name || 'Guest'}</p>
                  {booking.guest_email && <p className="text-sm text-gray-600">{booking.guest_email}</p>}
                  {booking.guest_phone && <p className="text-sm text-gray-600">{booking.guest_phone}</p>}
                </div>
              </div>

              {/* Package */}
              {booking.package ? (
                <div className="flex items-start gap-3">
                  <div className={`p-2 bg-${themeColor}-100 rounded-lg`}>
                    <Package className={`h-5 w-5 text-${fullColor}`} />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Package</p>
                    <p className="font-medium text-gray-900">{booking.package.name}</p>
                    {booking.package.category && <p className="text-sm text-gray-600">{booking.package.category}</p>}
                  </div>
                </div>
              ) : null}

              {/* Date & Time */}
              <div className="flex items-start gap-3">
                <div className={`p-2 bg-${themeColor}-100 rounded-lg`}>
                  <Calendar className={`h-5 w-5 text-${fullColor}`} />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Date & Time</p>
                  <p className="font-medium text-gray-900">
                    {parseLocalDate(booking.booking_date).toLocaleDateString('en-US', { 
                      weekday: 'long', 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric' 
                    })}
                  </p>
                  <p className="text-sm text-gray-600">{convertTo12Hour(booking.booking_time)}</p>
                </div>
              </div>

              {/* Duration */}
              <div className="flex items-start gap-3">
                <div className={`p-2 bg-${themeColor}-100 rounded-lg`}>
                  <Clock className={`h-5 w-5 text-${fullColor}`} />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Duration</p>
                  <p className="font-medium text-gray-900">{formatDurationDisplay(booking.duration, booking.duration_unit)}</p>
                </div>
              </div>

              {/* Participants */}
              <div className="flex items-start gap-3">
                <div className={`p-2 bg-${themeColor}-100 rounded-lg`}>
                  <Users className={`h-5 w-5 text-${fullColor}`} />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Participants</p>
                  <p className="font-medium text-gray-900">{booking.participants} people</p>
                </div>
              </div>

              {/* Location */}
              {(booking.location && typeof booking.location === 'object') ? (
                <div className="flex items-start gap-3">
                  <div className={`p-2 bg-${themeColor}-100 rounded-lg`}>
                    <MapPin className={`h-5 w-5 text-${fullColor}`} />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Location</p>
                    <p className="font-medium text-gray-900">{(booking.location as any)?.name}</p>
                    {(booking.location as any)?.address && (
                      <p className="text-sm text-gray-600">
                        {(booking.location as any)?.address}, {(booking.location as any)?.city}, {(booking.location as any)?.state}
                      </p>
                    )}
                  </div>
                </div>
              ) : null}

              {/* Room */}
              {(booking.room && typeof booking.room === 'object') ? (
                <div className="flex items-start gap-3">
                  <div className={`p-2 bg-${themeColor}-100 rounded-lg`}>
                    <Home className={`h-5 w-5 text-${fullColor}`} />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Space</p>
                    <p className="font-medium text-gray-900">{(booking.room as any)?.name}</p>
                  </div>
                </div>
              ) : null}

              {/* Status */}
              <div className="flex items-start gap-3">
                <div className={`p-2 bg-${themeColor}-100 rounded-lg`}>
                  <CheckCircle className={`h-5 w-5 text-${fullColor}`} />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Booking Status</p>
                  <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${statusColors[booking.status]}`}>
                    {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                  </span>
                </div>
              </div>

              {/* Guest of Honor Section - Only show if data exists */}
              {(booking as any).guest_of_honor_name && (
                <>
                  <div className="col-span-2">
                    <div className="border-t border-gray-200 my-4"></div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Guest of Honor</h3>
                  </div>
                  
                  <div className="flex items-start gap-3">
                    <div className={`p-2 bg-${themeColor}-100 rounded-lg`}>
                      <User className={`h-5 w-5 text-${fullColor}`} />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Name</p>
                      <p className="font-medium text-gray-900">{(booking as any).guest_of_honor_name}</p>
                    </div>
                  </div>

                  {(booking as any).guest_of_honor_age && (
                    <div className="flex items-start gap-3">
                      <div className={`p-2 bg-${themeColor}-100 rounded-lg`}>
                        <User className={`h-5 w-5 text-${fullColor}`} />
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Age</p>
                        <p className="font-medium text-gray-900">{(booking as any).guest_of_honor_age} years old</p>
                      </div>
                    </div>
                  )}

                  {(booking as any).guest_of_honor_gender && (
                    <div className="flex items-start gap-3">
                      <div className={`p-2 bg-${themeColor}-100 rounded-lg`}>
                        <User className={`h-5 w-5 text-${fullColor}`} />
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Gender</p>
                        <p className="font-medium text-gray-900 capitalize">{(booking as any).guest_of_honor_gender}</p>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Payment Information */}
          <div className="p-6 border-b border-gray-100 bg-gray-50">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Payment Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex items-start gap-3">
                <div className={`p-2 bg-${themeColor}-100 rounded-lg`}>
                  <DollarSign className={`h-5 w-5 text-${fullColor}`} />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total Amount</p>
                  <p className="font-medium text-gray-900 text-2xl">${Number(booking.total_amount).toFixed(2)}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className={`p-2 bg-${themeColor}-100 rounded-lg`}>
                  <DollarSign className={`h-5 w-5 text-${fullColor}`} />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Amount Paid</p>
                  <p className="font-medium text-gray-900 text-2xl">${Number(booking.amount_paid).toFixed(2)}</p>
                </div>
              </div>

              {Number(booking.total_amount) - Number(booking.amount_paid) > 0 && (
                <div className="flex items-start gap-3">
                  <div className={`p-2 bg-red-100 rounded-lg`}>
                    <DollarSign className={`h-5 w-5 text-red-600`} />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Remaining Balance</p>
                    <p className="font-medium text-red-600 text-2xl">${(Number(booking.total_amount) - Number(booking.amount_paid)).toFixed(2)}</p>
                  </div>
                </div>
              )}

              {booking.discount_amount && Number(booking.discount_amount) > 0 && (
                <div className="flex items-start gap-3">
                  <div className={`p-2 bg-${themeColor}-100 rounded-lg`}>
                    <DollarSign className={`h-5 w-5 text-${fullColor}`} />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Discount</p>
                    <p className="font-medium text-gray-900">${Number(booking.discount_amount).toFixed(2)}</p>
                  </div>
                </div>
              )}

              {(booking as any).promo && (
                <div className="flex items-start gap-3">
                  <div className={`p-2 bg-green-100 rounded-lg`}>
                    <CheckCircle className={`h-5 w-5 text-green-600`} />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Promo Code</p>
                    <p className="font-medium text-gray-900">{(booking as any).promo.code}</p>
                    {(booking as any).promo.discount_percentage && (
                      <p className="text-sm text-gray-600">{(booking as any).promo.discount_percentage}% off</p>
                    )}
                  </div>
                </div>
              )}

              {(booking as any).gift_card && (
                <div className="flex items-start gap-3">
                  <div className={`p-2 bg-purple-100 rounded-lg`}>
                    <CheckCircle className={`h-5 w-5 text-purple-600`} />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Gift Card</p>
                    <p className="font-medium text-gray-900">{(booking as any).gift_card.code}</p>
                    <p className="text-sm text-gray-600">Balance: ${Number((booking as any).gift_card.balance).toFixed(2)}</p>
                  </div>
                </div>
              )}

              {booking.payment_method && (
                <div className="flex items-start gap-3">
                  <div className={`p-2 bg-${themeColor}-100 rounded-lg`}>
                    <DollarSign className={`h-5 w-5 text-${fullColor}`} />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Payment Method</p>
                    <p className="font-medium text-gray-900 capitalize">{booking.payment_method.replace('_', ' ')}</p>
                  </div>
                </div>
              )}

              <div className="flex items-start gap-3">
                <div className={`p-2 bg-${themeColor}-100 rounded-lg`}>
                  <CheckCircle className={`h-5 w-5 text-${fullColor}`} />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Payment Status</p>
                  <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${paymentStatusColors[booking.payment_status]}`}>
                    {booking.payment_status.charAt(0).toUpperCase() + booking.payment_status.slice(1)}
                  </span>
                </div>
              </div>
            </div>

            {/* Payment History */}
            {(booking as any).payments && (booking as any).payments.length > 0 && (
              <div className="mt-6 pt-6 border-t border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Payment History</h3>
                <div className="space-y-3">
                  {(booking as any).payments.map((payment: any, index: number) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 ${payment.status === 'completed' ? 'bg-green-100' : 'bg-gray-100'} rounded-lg`}>
                          <DollarSign className={`h-4 w-4 ${payment.status === 'completed' ? 'text-green-600' : 'text-gray-600'}`} />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">${Number(payment.amount).toFixed(2)}</p>
                          <p className="text-sm text-gray-600">
                            {payment.method ? payment.method.replace('_', ' ').charAt(0).toUpperCase() + payment.method.slice(1).replace('_', ' ') : 'N/A'}
                            {' • '}
                            {formatLocalDateTime(payment.created_at, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </p>
                          {payment.notes && (
                            <p className="text-xs text-gray-500 mt-1">{payment.notes}</p>
                          )}
                        </div>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        payment.status === 'completed' ? 'bg-green-100 text-green-800' : 
                        payment.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {payment.status.charAt(0).toUpperCase() + payment.status.slice(1)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Attractions & Add-ons */}
          {((booking.attractions && booking.attractions.length > 0) || ((booking as any).add_ons && (booking as any).add_ons.length > 0)) && (
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Additional Services</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {booking.attractions && booking.attractions.length > 0 && (
                  <div>
                    <h3 className="font-medium text-gray-900 mb-2">Attractions ({booking.attractions.length})</h3>
                    <ul className="space-y-2">
                      {booking.attractions.map((attraction: any, index: number) => {
                        const unitPrice = attraction.pivot?.price !== undefined ? Number(attraction.pivot.price) : Number(attraction.price);
                        const quantity = attraction.pivot?.quantity || 1;
                        const totalPrice = unitPrice * quantity;
                        
                        return (
                          <li key={index} className="flex items-start justify-between text-gray-700">
                            <div className="flex items-start">
                              <span className="w-2 h-2 bg-gray-400 rounded-full mr-2 mt-2"></span>
                              <div>
                                <p className="font-medium">{attraction.name}</p>
                                <p className="text-sm text-gray-500">
                                  {quantity > 1 ? (
                                    <>{quantity} × ${unitPrice.toFixed(2)}</>
                                  ) : (
                                    <>Quantity: {quantity}</>
                                  )}
                                </p>
                              </div>
                            </div>
                            <span className="font-medium">${totalPrice.toFixed(2)}</span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}

                {((booking as any).add_ons && (booking as any).add_ons.length > 0) && (
                  <div>
                    <h3 className="font-medium text-gray-900 mb-2">Add-Ons ({(booking as any).add_ons.length})</h3>
                    <ul className="space-y-2">
                      {(booking as any).add_ons.map((addon: any, index: number) => {
                        let unitPrice = 0;
                        
                        // For force add-ons, check price_each_packages for the package-specific price
                        if (addon.is_force_add_on && addon.price_each_packages && Array.isArray(addon.price_each_packages) && booking.package_id) {
                          const packagePrice = addon.price_each_packages.find((p: any) => p.package_id === booking.package_id);
                          if (packagePrice) {
                            unitPrice = Number(packagePrice.price);
                          }
                        }
                        
                        // Fallback to pivot price or addon price
                        if (unitPrice === 0) {
                          unitPrice = addon.pivot?.price !== undefined ? Number(addon.pivot.price) : (addon.price !== null ? Number(addon.price) : 0);
                        }
                        
                        const quantity = addon.pivot?.quantity || 1;
                        const totalPrice = unitPrice * quantity;
                        
                        return (
                          <li key={index} className="flex items-start justify-between text-gray-700">
                            <div className="flex items-start">
                              <span className="w-2 h-2 bg-gray-400 rounded-full mr-2 mt-2"></span>
                              <div>
                                <p className="font-medium">
                                  {addon.name}
                                  {addon.is_force_add_on && (
                                    <span className="ml-2 px-1.5 py-0.5 text-[10px] font-medium bg-amber-100 text-amber-700 rounded">
                                      Forced
                                    </span>
                                  )}
                                </p>
                                <p className="text-sm text-gray-500">
                                  {quantity > 1 ? (
                                    <>{quantity} × ${unitPrice.toFixed(2)}</>
                                  ) : (
                                    <>Quantity: {quantity}</>
                                  )}
                                </p>
                              </div>
                            </div>
                            <span className="font-medium">${totalPrice.toFixed(2)}</span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Notes & Special Requests */}
          {(booking.notes || booking.special_requests) && (
            <div className="p-6">
              {booking.special_requests && (
                <div className="mb-4">
                  <h3 className="font-medium text-gray-900 mb-2">Special Requests</h3>
                  <p className="text-gray-700">{booking.special_requests}</p>
                </div>
              )}
              {booking.notes && (
                <div>
                  <h3 className="font-medium text-gray-900 mb-2">Customer Notes</h3>
                  <p className="text-gray-700">{booking.notes}</p>
                </div>
              )}
            </div>
          )}

          {/* Internal Staff Notes */}
          {booking.internal_notes && (
            <div className="p-6 bg-amber-50/50 border-t border-amber-100">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle size={16} className="text-amber-600" />
                <h3 className="font-medium text-gray-900">Internal Staff Notes</h3>
                <span className="text-xs text-amber-600 font-medium bg-amber-100 px-2 py-0.5 rounded">Staff Only</span>
              </div>
              <p className="text-gray-700">{booking.internal_notes}</p>
            </div>
          )}

          {/* Timestamps */}
          <div className="p-6 bg-gray-100 border-t border-gray-200">
            <div className="flex items-center gap-6 text-sm text-gray-500">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                <span>Created: {formatLocalDateTime(booking.created_at, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            </div>
          </div>
        </div>

        {/* QR Code Modal */}
        {showQRModal && qrCodeData && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowQRModal(false)}>
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 p-6" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-900">Booking QR Code</h3>
                <StandardButton
                  variant="ghost"
                  size="sm"
                  icon={AlertCircle}
                  onClick={() => setShowQRModal(false)}
                >
                  {''}
                </StandardButton>
              </div>
              
              <div className="flex flex-col items-center">
                <img 
                  src={qrCodeData} 
                  alt="Booking QR Code" 
                  className="w-64 h-64 mb-4 border-2 border-gray-200 rounded-lg"
                />
                <p className="text-sm text-gray-600 mb-4 text-center">
                  Reference: <span className="font-semibold">#{booking.reference_number}</span>
                </p>
                <StandardButton
                  variant="primary"
                  icon={Download}
                  onClick={handleDownloadQRCode}
                  fullWidth
                >
                  Download QR Code
                </StandardButton>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ViewBooking;
