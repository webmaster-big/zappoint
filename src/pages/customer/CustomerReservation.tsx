import { useState, useEffect } from 'react';
import {
  Calendar,
  MapPin,
  Users,
  Clock,
  Eye,
  X,
  QrCode,
  ChevronDown,
  ChevronUp,
  RefreshCcw,
  DollarSign,
  CheckCircle,
  Package,
  Search,
  ArrowUpDown,
  AlertCircle
} from 'lucide-react';
import QRCode from 'qrcode';
import type { SortBy, SortOrder } from '../../types/customer';
import bookingService, { type Booking } from '../../services/bookingService';
import type { BookPackagePackage } from '../../types/BookPackage.types';
import { formatDurationDisplay, convertTo12Hour } from '../../utils/timeFormat';
import SendInvitationsModal from '../../components/invitations/SendInvitationsModal';
import InvitationTracker from '../../components/invitations/InvitationTracker';
import Toast from '../../components/ui/Toast';
import Pagination from '../../components/ui/Pagination';
import { AppliedFeesDisplay } from '../../components/AppliedFeesDisplay';

const CustomerReservations = () => {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [expandedReservation, setExpandedReservation] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(5);
  const [totalPages, setTotalPages] = useState(1);
  const [totalBookings, setTotalBookings] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showInvitationModal, setShowInvitationModal] = useState(false);
  const [invitationBooking, setInvitationBooking] = useState<Booking | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    fetchBookings();
  }, [currentPage, pageSize, searchTerm, sortBy, sortOrder, statusFilter]);

  const fetchBookings = async () => {
    try {
      setLoading(true);
      setError(null);

      const customerData = localStorage.getItem('zapzone_customer');
      const customer = customerData ? JSON.parse(customerData) : null;

      if (!customer?.id && !customer?.email) {
        setBookings([]);
        setTotalPages(1);
        setTotalBookings(0);
        setError('Please log in to view your reservations');
        setLoading(false);
        return;
      }

      const filters: any = {
        page: currentPage,
        per_page: pageSize,
        sort_by: sortBy === 'date' ? 'booking_date' : sortBy === 'amount' ? 'total_amount' : 'status',
        sort_order: sortOrder,
        customer_id: customer.id,
        guest_email: customer.email
      };

      if (searchTerm) {
        filters.search = searchTerm;
      }

      if (statusFilter && statusFilter !== 'all') {
        filters.status = statusFilter;
      }

      const response = await bookingService.getBookings(filters);

      if (response.success) {
        setBookings(response.data.bookings);
        setTotalPages(response.data.pagination.last_page);
        setTotalBookings(response.data.pagination.total);
      }
    } catch (err: any) {
      console.error('Error fetching bookings:', err);
      setError(err.message || 'Failed to load bookings');
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = (booking: Booking) => {
    setSelectedBooking(booking);
    setShowDetailsModal(true);
  };

  const handleSendInvitations = (booking: Booking) => {
    setInvitationBooking(booking);
    setShowInvitationModal(true);
  };

  const handleDownloadQRCode = async (booking: Booking) => {
    try {
      const qrCodeDataURL = await QRCode.toDataURL(booking.reference_number, {
        width: 512,
        margin: 2,
        color: { dark: '#000000', light: '#FFFFFF' }
      });

      const link = document.createElement('a');
      link.download = `zapzone-qrcode-${booking.reference_number}.png`;
      link.href = qrCodeDataURL;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast('QR code downloaded successfully', 'success');
    } catch (error) {
      console.error('Error generating QR code:', error);
      showToast('Failed to generate QR code. Please try again.', 'error');
    }
  };

  const toggleReservationExpand = (reservationId: string) => {
    setExpandedReservation(expandedReservation === reservationId ? null : reservationId);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'pending': return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'cancelled': return 'bg-red-50 text-red-700 border-red-200';
      case 'completed': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'checked-in': return 'bg-blue-50 text-blue-700 border-blue-200';
      default: return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  const getStatusDot = (status: string) => {
    switch (status) {
      case 'confirmed': return 'bg-emerald-500';
      case 'pending': return 'bg-amber-500';
      case 'cancelled': return 'bg-red-500';
      case 'completed': return 'bg-blue-500';
      case 'checked-in': return 'bg-blue-500';
      default: return 'bg-gray-500';
    }
  };

  const getLocationName = (booking: Booking): string => {
    const location = booking.location as any;
    return location?.name || 'N/A';
  };

  const getPackageName = (booking: Booking): string => {
    const pkg = booking.package as BookPackagePackage | undefined;
    return pkg?.name || 'N/A';
  };

  return (
    <>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.97); } to { opacity: 1; transform: scale(1); } }
        @keyframes shimmer { 0% { background-position: -400px 0; } 100% { background-position: 400px 0; } }
        .fade-in { animation: fadeIn 0.25s ease-out; }
        .slide-up { animation: slideUp 0.35s ease-out both; }
        .scale-in { animation: scaleIn 0.25s ease-out; }
        .no-scrollbar { scrollbar-width: none; -ms-overflow-style: none; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .skeleton { background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%); background-size: 800px 100%; animation: shimmer 1.5s infinite linear; border-radius: 8px; }
        [data-tooltip] { position: relative; }
        [data-tooltip]:hover::after { content: attr(data-tooltip); position: absolute; bottom: calc(100% + 6px); left: 50%; transform: translateX(-50%); padding: 4px 10px; font-size: 11px; font-weight: 500; color: #fff; background: #1e293b; border-radius: 6px; white-space: nowrap; z-index: 50; pointer-events: none; animation: fadeIn 0.15s ease-out; }
        [data-tooltip]:hover::before { content: ''; position: absolute; bottom: calc(100% + 2px); left: 50%; transform: translateX(-50%); border: 4px solid transparent; border-top-color: #1e293b; z-index: 50; pointer-events: none; animation: fadeIn 0.15s ease-out; }
      `}</style>

      <div className="min-h-screen bg-gray-50/80">
        {/* Compact Hero */}
        <section className="relative bg-gradient-to-br from-blue-900 via-blue-800 to-blue-700 text-white py-6 md:py-8 overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.06),transparent_60%)]" />
          <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 slide-up">
            <div className="flex items-end justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="p-1.5 bg-white/10 backdrop-blur rounded-lg border border-white/10">
                    <Calendar className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-blue-200/70 text-xs font-semibold uppercase tracking-widest">Reservations</span>
                </div>
                <h1 className="text-xl font-bold" style={{ color: 'white' }}>My Reservations</h1>
                <p className="text-blue-200/60 text-sm mt-0.5">View and manage your bookings</p>
              </div>
              {totalBookings > 0 && (
                <span className="text-xs font-medium bg-white/10 border border-white/10 backdrop-blur px-3 py-1 rounded-full text-blue-100">
                  {totalBookings} total
                </span>
              )}
            </div>
          </div>
        </section>

        {/* Main Content */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {/* Search, Filter & Sort Card */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-5 slide-up">
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
              <div className="flex-1 relative max-w-md w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by reference, package..."
                  value={searchTerm}
                  onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                  className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition"
                />
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortBy)}
                  className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white"
                >
                  <option value="date">Sort by Date</option>
                  <option value="status">Sort by Status</option>
                  <option value="amount">Sort by Amount</option>
                </select>
                <button
                  onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                  className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition text-gray-500"
                  data-tooltip={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
                >
                  <ArrowUpDown className="w-4 h-4" />
                </button>
                <button
                  onClick={() => { setSearchTerm(''); setStatusFilter('all'); setSortBy('date'); setSortOrder('desc'); setCurrentPage(1); }}
                  className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition text-gray-500"
                  data-tooltip="Reset filters"
                >
                  <RefreshCcw className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Status Filter Tabs */}
            <div className="flex items-center gap-1 mt-3 pt-3 border-t border-gray-100 overflow-x-auto no-scrollbar">
              {[
                { key: 'all', label: 'All' },
                { key: 'confirmed', label: 'Confirmed' },
                { key: 'pending', label: 'Pending' },
                { key: 'completed', label: 'Completed' },
                { key: 'checked-in', label: 'Checked In' },
                { key: 'cancelled', label: 'Cancelled' },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => { setStatusFilter(tab.key); setCurrentPage(1); }}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-all ${
                    statusFilter === tab.key
                      ? 'bg-blue-700 text-white shadow-sm'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Loading Skeleton */}
          {loading && (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 slide-up" style={{ animationDelay: `${i * 0.06}s` }}>
                  <div className="flex flex-col lg:flex-row lg:items-start gap-4">
                    <div className="flex-1 space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="skeleton h-5 w-44" />
                        <div className="skeleton h-5 w-20 rounded-full" />
                      </div>
                      <div className="flex gap-4">
                        <div className="skeleton h-4 w-24" />
                        <div className="skeleton h-4 w-36" />
                        <div className="skeleton h-4 w-20" />
                      </div>
                      <div className="skeleton h-4 w-28" />
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="skeleton h-9 w-24 rounded-lg" />
                      <div className="skeleton h-9 w-28 rounded-lg" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Error */}
          {error && !loading && (
            <div className="bg-white rounded-xl shadow-sm border border-red-100 p-5 mb-5 flex items-start gap-3">
              <div className="p-2 rounded-lg bg-red-50">
                <AlertCircle className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Failed to load bookings</p>
                <p className="text-sm text-gray-500 mt-0.5">{error}</p>
                <button
                  onClick={() => { setError(null); fetchBookings(); }}
                  className="mt-2 text-sm font-medium text-blue-700 hover:text-blue-800 transition"
                >
                  Try again
                </button>
              </div>
            </div>
          )}

          {/* Booking Cards */}
          {!loading && !error && (
            <div className="space-y-3">
              {bookings.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-xl shadow-sm border border-gray-100">
                  <div className="inline-flex p-4 rounded-full bg-blue-50 mb-4">
                    <Package className="w-10 h-10 text-blue-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">No reservations found</h3>
                  <p className="text-sm text-gray-500 mb-5">
                    {statusFilter !== 'all' ? `No ${statusFilter} bookings to show` : 'Book a package to get started'}
                  </p>
                  {statusFilter !== 'all' ? (
                    <button
                      onClick={() => { setStatusFilter('all'); setCurrentPage(1); }}
                      className="inline-flex items-center text-sm px-5 py-2 border border-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition"
                    >
                      Clear Filter
                    </button>
                  ) : (
                    <a
                      href="/"
                      className="inline-flex items-center text-sm px-5 py-2 bg-blue-700 text-white font-medium rounded-lg hover:bg-blue-800 transition"
                    >
                      Explore Packages
                    </a>
                  )}
                </div>
              ) : (
                bookings.map((booking, idx) => (
                  <div
                    key={booking.id}
                    className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow slide-up"
                    style={{ animationDelay: `${idx * 0.04}s` }}
                  >
                    {/* Card Header */}
                    <div className="p-4 sm:p-5">
                      <div className="flex flex-col lg:flex-row lg:items-start gap-4">
                        {/* Left: Info */}
                        <div className="flex-1 min-w-0">
                          {/* Row 1: Package + Status */}
                          <div className="flex items-center gap-2.5 mb-2">
                            <h3 className="text-base font-semibold text-gray-900 truncate">
                              {getPackageName(booking)}
                            </h3>
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-medium rounded-full ${getStatusColor(booking.status)}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${getStatusDot(booking.status)}`} />
                              {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                            </span>
                          </div>

                          {/* Row 2: Meta info */}
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-gray-500">
                            <span className="inline-flex items-center gap-1.5">
                              <MapPin size={13} className="text-gray-400" />
                              {getLocationName(booking)}
                            </span>
                            <span className="inline-flex items-center gap-1.5">
                              <Calendar size={13} className="text-gray-400" />
                              {booking.booking_date.split('T')[0]} at {convertTo12Hour(booking.booking_time)}
                            </span>
                            <span className="inline-flex items-center gap-1.5">
                              <Users size={13} className="text-gray-400" />
                              {booking.participants} guests
                            </span>
                          </div>

                          {/* Row 3: Amount */}
                          <div className="flex items-center gap-3 mt-2">
                            <span className="inline-flex items-center gap-1 text-sm font-semibold text-gray-900">
                              <DollarSign size={13} className="text-emerald-500" />
                              {typeof booking.total_amount === 'string' ? parseFloat(booking.total_amount).toFixed(2) : booking.total_amount.toFixed(2)}
                            </span>
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${getStatusColor(booking.payment_status)}`}>
                              {booking.payment_status}
                            </span>
                          </div>
                        </div>

                        {/* Right: Actions */}
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => handleViewDetails(booking)}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                          >
                            <Eye size={14} />
                            View
                          </button>
                          {(booking.status === 'confirmed' || booking.status === 'pending') && booking.package && (
                            <button
                              onClick={() => handleSendInvitations(booking)}
                              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium bg-blue-700 text-white rounded-lg hover:bg-blue-800 transition"
                            >
                              Invite
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Expand Toggle */}
                    <button
                      onClick={() => toggleReservationExpand(booking.id.toString())}
                      className="w-full flex items-center justify-between px-5 py-2.5 bg-gray-50 hover:bg-gray-100 transition text-sm border-t border-gray-100"
                    >
                      <span className="font-medium text-gray-500">
                        {expandedReservation === booking.id.toString() ? 'Hide details' : 'More details'}
                      </span>
                      {expandedReservation === booking.id.toString() ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
                    </button>

                    {/* Expanded Content */}
                    {expandedReservation === booking.id.toString() && (
                      <div className="p-4 sm:p-5 bg-gray-50/50 fade-in">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Booking Info Card */}
                          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                            <h4 className="text-xs font-semibold text-gray-500 mb-3 uppercase tracking-wider">Booking Info</h4>
                            <div className="space-y-2.5 text-sm">
                              <div className="flex justify-between">
                                <span className="text-gray-500">Reference</span>
                                <span className="font-mono font-semibold text-gray-800 bg-gray-50 px-2 py-0.5 rounded text-xs">{booking.reference_number}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-500">Total Amount</span>
                                <span className="font-semibold text-gray-900">${typeof booking.total_amount === 'string' ? parseFloat(booking.total_amount).toFixed(2) : booking.total_amount.toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-500">Created</span>
                                <span className="text-gray-700">{new Date(booking.created_at).toLocaleDateString()} {new Date(booking.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-gray-500">Payment</span>
                                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${getStatusColor(booking.payment_status)}`}>
                                  {booking.payment_status}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* QR Code Card */}
                          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                            <h4 className="text-xs font-semibold text-gray-500 mb-3 uppercase tracking-wider">QR Code</h4>
                            <button
                              onClick={() => handleDownloadQRCode(booking)}
                              className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium"
                              data-tooltip="Download QR code"
                            >
                              <QrCode size={14} className="text-blue-600" />
                              Download QR Code
                            </button>
                          </div>
                        </div>

                        {/* Invitation Tracker */}
                        {booking.package && (booking.status === 'confirmed' || booking.status === 'pending') && (
                          <div className="mt-4">
                            <InvitationTracker bookingId={booking.id} participants={booking.participants} onToast={showToast} />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* Pagination */}
          {!loading && bookings.length > 0 && totalPages > 1 && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
                totalItems={totalBookings}
                itemsPerPage={pageSize}
                compact
              />
            </div>
          )}
        </div>
      </div>

      {/* Booking Details Modal */}
      {showDetailsModal && selectedBooking && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 fade-in" onClick={() => setShowDetailsModal(false)}>
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[85vh] overflow-hidden scale-in shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="max-h-[85vh] overflow-y-auto no-scrollbar">
              {/* Modal Header */}
              <div className="sticky top-0 z-10 bg-gradient-to-r from-blue-900 via-blue-800 to-blue-700 px-5 py-4 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-semibold" style={{ color: '#ffffff' }}>Booking Details</h3>
                    <p className="text-xs mt-0.5" style={{ color: 'rgba(191,219,254,0.8)' }}>{selectedBooking.reference_number}</p>
                  </div>
                  <button
                    onClick={() => setShowDetailsModal(false)}
                    className="p-1.5 hover:bg-white/15 rounded-lg transition text-white"
                  >
                    <X size={15} />
                  </button>
                </div>
              </div>

              {/* Modal Body */}
              <div className="p-5 space-y-5 bg-white">
                {/* Status + Amount Hero */}
                <div className="flex items-center justify-between bg-gray-50 rounded-xl p-4">
                  <div>
                    <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">Status</span>
                    <div className="mt-1">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full border ${getStatusColor(selectedBooking.status)}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${getStatusDot(selectedBooking.status)}`} />
                        {selectedBooking.status.charAt(0).toUpperCase() + selectedBooking.status.slice(1)}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">Total</span>
                    <div className="text-xl font-bold text-gray-900 mt-0.5">
                      ${typeof selectedBooking.total_amount === 'string' ? parseFloat(selectedBooking.total_amount).toFixed(2) : selectedBooking.total_amount.toFixed(2)}
                    </div>
                  </div>
                </div>

                {/* Package Info */}
                {selectedBooking.package && (
                  <div>
                    <h4 className="text-xs font-semibold text-gray-800 mb-2 uppercase tracking-wide">Package</h4>
                    <div className="bg-gray-50 p-4 rounded-xl space-y-2.5 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Name</span>
                        <span className="font-semibold text-gray-900">{getPackageName(selectedBooking)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Duration</span>
                        <span className="font-semibold text-gray-900">{formatDurationDisplay(selectedBooking.duration, selectedBooking.duration_unit)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Participants</span>
                        <span className="font-semibold text-gray-900">{selectedBooking.participants}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Schedule & Location */}
                <div>
                  <h4 className="text-xs font-semibold text-gray-800 mb-2 uppercase tracking-wide">Schedule</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex items-center gap-2.5 bg-gray-50 p-3 rounded-xl">
                      <MapPin size={14} className="text-blue-600 shrink-0" />
                      <span className="text-gray-700">{getLocationName(selectedBooking)}</span>
                    </div>
                    <div className="flex items-center gap-2.5 bg-gray-50 p-3 rounded-xl">
                      <Calendar size={14} className="text-blue-600 shrink-0" />
                      <span className="text-gray-700">{selectedBooking.booking_date.split('T')[0]}</span>
                    </div>
                    <div className="flex items-center gap-2.5 bg-gray-50 p-3 rounded-xl">
                      <Clock size={14} className="text-blue-600 shrink-0" />
                      <span className="text-gray-700">{convertTo12Hour(selectedBooking.booking_time)}</span>
                    </div>
                    <div className="flex items-center gap-2.5 bg-gray-50 p-3 rounded-xl">
                      <Users size={14} className="text-blue-600 shrink-0" />
                      <span className="text-gray-700">{selectedBooking.participants} guests</span>
                    </div>
                  </div>
                </div>

                {/* Attractions */}
                {selectedBooking.attractions && (selectedBooking.attractions as any[]).length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-gray-800 mb-2 uppercase tracking-wide">Attractions</h4>
                    <div className="flex flex-wrap gap-2">
                      {(selectedBooking.attractions as any[]).map((attr, index) => (
                        <span key={index} className="inline-flex items-center gap-1.5 text-xs text-gray-700 bg-gray-50 px-3 py-1.5 rounded-full">
                          <CheckCircle size={12} className="text-emerald-500 shrink-0" />
                          {attr.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Add-ons */}
                {selectedBooking.add_ons && (selectedBooking.add_ons as any[]).length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-gray-800 mb-2 uppercase tracking-wide">Add-ons</h4>
                    <div className="flex flex-wrap gap-2">
                      {(selectedBooking.add_ons as any[]).map((addon, index) => (
                        <span key={index} className="inline-flex items-center gap-1.5 text-xs text-gray-700 bg-gray-50 px-3 py-1.5 rounded-full">
                          <CheckCircle size={12} className="text-blue-500 shrink-0" />
                          {addon.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Payment */}
                <div>
                  <h4 className="text-xs font-semibold text-gray-800 mb-2 uppercase tracking-wide">Payment</h4>
                  <div className="bg-gray-50 p-4 rounded-xl space-y-2.5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Reference</span>
                      <span className="font-mono font-medium text-gray-800">{selectedBooking.reference_number}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Total</span>
                      <span className="font-semibold text-emerald-600">${typeof selectedBooking.total_amount === 'string' ? parseFloat(selectedBooking.total_amount).toFixed(2) : selectedBooking.total_amount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Paid</span>
                      <span className="font-medium text-gray-800">${typeof selectedBooking.amount_paid === 'string' ? parseFloat(selectedBooking.amount_paid).toFixed(2) : selectedBooking.amount_paid.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500">Payment Status</span>
                      <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full border ${getStatusColor(selectedBooking.payment_status)}`}>
                        {selectedBooking.payment_status}
                      </span>
                    </div>
                    {selectedBooking.applied_fees && selectedBooking.applied_fees.length > 0 && (
                      <div className="pt-2.5 border-t border-gray-200">
                        <AppliedFeesDisplay appliedFees={selectedBooking.applied_fees} />
                      </div>
                    )}
                  </div>
                </div>

                {/* Guest of Honor */}
                {(selectedBooking as any).guest_of_honor_name && (
                  <div>
                    <h4 className="text-xs font-semibold text-gray-800 mb-2 uppercase tracking-wide">Guest of Honor</h4>
                    <div className="bg-gray-50 p-4 rounded-xl space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Name</span>
                        <span className="font-medium text-gray-900">{(selectedBooking as any).guest_of_honor_name}</span>
                      </div>
                      {(selectedBooking as any).guest_of_honor_age && (
                        <div className="flex justify-between">
                          <span className="text-gray-500">Age</span>
                          <span className="font-medium text-gray-900">{(selectedBooking as any).guest_of_honor_age} years old</span>
                        </div>
                      )}
                      {(selectedBooking as any).guest_of_honor_gender && (
                        <div className="flex justify-between">
                          <span className="text-gray-500">Gender</span>
                          <span className="font-medium text-gray-900 capitalize">{(selectedBooking as any).guest_of_honor_gender}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Special Requests */}
                {selectedBooking.special_requests && (
                  <div>
                    <h4 className="text-xs font-semibold text-gray-800 mb-2 uppercase tracking-wide">Special Requests</h4>
                    <p className="text-xs text-gray-700 bg-gray-50 p-3 rounded-lg leading-relaxed">
                      {selectedBooking.special_requests}
                    </p>
                  </div>
                )}

                {/* Scheduled Time Highlight */}
                <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4 text-center">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <Clock size={18} className="text-blue-600" />
                    <span className="text-lg font-bold text-blue-800">
                      Scheduled for {convertTo12Hour(selectedBooking.booking_time)}
                    </span>
                  </div>
                  <p className="text-sm text-blue-600">
                    {new Date(selectedBooking.booking_date.split('T')[0] + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                  </p>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="sticky bottom-0 px-5 py-3.5 border-t border-gray-100 bg-white">
                <button
                  onClick={() => handleDownloadQRCode(selectedBooking)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm border border-gray-200 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition"
                >
                  <QrCode size={14} className="text-blue-600" />
                  Download QR Code
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Send Invitations Modal */}
      {showInvitationModal && invitationBooking && (
        <SendInvitationsModal
          booking={invitationBooking}
          onClose={() => {
            setShowInvitationModal(false);
            setInvitationBooking(null);
          }}
          onSuccess={() => {
            fetchBookings();
          }}
          onToast={showToast}
        />
      )}
    </>
  );
};

export default CustomerReservations;
