import { useState, useEffect } from 'react';
import {
  Calendar,
  MapPin,
  Users,
  Clock,
  Eye,
  X,
  FileText,
  QrCode,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  Package,
  Search,
  ArrowUpDown,
  Loader2,
  AlertCircle
} from 'lucide-react';
import QRCode from 'qrcode';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import type { SortBy, SortOrder } from '../../types/customer';
import bookingService, { type Booking } from '../../services/bookingService';
import type { BookPackagePackage } from '../../types/BookPackage.types';
import { formatDurationDisplay, convertTo12Hour } from '../../utils/timeFormat';
import SendInvitationsModal from '../../components/invitations/SendInvitationsModal';
import InvitationTracker from '../../components/invitations/InvitationTracker';

const CustomerReservations = () => {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [expandedReservation, setExpandedReservation] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const [totalPages, setTotalPages] = useState(1);
  const [totalBookings, setTotalBookings] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showInvitationModal, setShowInvitationModal] = useState(false);
  const [invitationBooking, setInvitationBooking] = useState<Booking | null>(null);

  useEffect(() => {
    fetchBookings();
  }, [currentPage, pageSize, searchTerm, sortBy, sortOrder]);

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

  const handleDownloadReceipt = async (booking: Booking) => {
    try {
      const receiptElement = document.createElement('div');
      receiptElement.innerHTML = generateReceiptContent(booking);
      receiptElement.style.width = '800px';
      receiptElement.style.padding = '40px';
      receiptElement.style.backgroundColor = 'white';
      receiptElement.style.fontFamily = 'Arial, sans-serif';

      document.body.appendChild(receiptElement);

      const canvas = await html2canvas(receiptElement, {
        backgroundColor: 'white',
        scale: 2,
        logging: false,
        useCORS: true
      });

      document.body.removeChild(receiptElement);

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 210;
      const pageHeight = 295;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(`zapzone-receipt-${booking.reference_number}.pdf`);
    } catch (error) {
      console.error('Error generating receipt:', error);
      alert('Failed to generate receipt. Please try again.');
    }
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
    } catch (error) {
      console.error('Error generating QR code:', error);
      alert('Failed to generate QR code. Please try again.');
    }
  };

  const generateReceiptContent = (booking: Booking) => {
    const pkg = booking.package as BookPackagePackage | undefined;
    const location = booking.location as any;
    const customerName = booking.guest_name || (booking.customer as any)?.name || 'Guest';
    const customerEmail = booking.guest_email || (booking.customer as any)?.email || '';
    const totalAmount = typeof booking.total_amount === 'string' ? parseFloat(booking.total_amount) : booking.total_amount;
    const amountPaid = typeof booking.amount_paid === 'string' ? parseFloat(booking.amount_paid) : booking.amount_paid;

    return `
      <div style="max-width: 700px; margin: 0 auto; padding: 0; background: #ffffff;">
        <div style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); padding: 30px; text-align: center; color: white;">
          <h1 style="margin: 0 0 5px 0; font-size: 32px; font-weight: bold; letter-spacing: 1px;">ZAPZONE</h1>
          <p style="margin: 0; font-size: 14px; opacity: 0.9;">Entertainment Center - Official Receipt</p>
        </div>
        <div style="background: #f8fafc; padding: 15px 30px; border-bottom: 1px solid #e2e8f0;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
              <div style="font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">Receipt Number</div>
              <div style="font-size: 16px; font-weight: bold; color: #1e293b; margin-top: 2px;">${booking.reference_number}</div>
            </div>
            <div style="text-align: right;">
              <div style="font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">Issue Date</div>
              <div style="font-size: 14px; font-weight: 600; color: #1e293b; margin-top: 2px;">${new Date(booking.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })} at ${new Date(booking.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</div>
            </div>
          </div>
        </div>
        <div style="padding: 30px;">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px;">
            <div style="background: #f8fafc; padding: 20px;">
              <h3 style="margin: 0 0 12px 0; font-size: 13px; color: #1e40af; text-transform: uppercase; letter-spacing: 0.5px;">Customer Information</h3>
              <div style="font-size: 15px; font-weight: 600; color: #1e293b; margin-bottom: 4px;">${customerName}</div>
              ${customerEmail ? `<div style="font-size: 13px; color: #64748b;">${customerEmail}</div>` : ''}
              ${booking.guest_phone ? `<div style="font-size: 13px; color: #64748b; margin-top: 2px;">${booking.guest_phone}</div>` : ''}
            </div>
            <div style="background: #f8fafc; padding: 20px;">
              <h3 style="margin: 0 0 12px 0; font-size: 13px; color: #1e40af; text-transform: uppercase; letter-spacing: 0.5px;">Booking Details</h3>
              <div style="margin-bottom: 6px;">
                <span style="font-size: 12px; color: #64748b;">Location:</span>
                <span style="font-size: 14px; font-weight: 600; color: #1e293b; margin-left: 5px;">${location?.name || 'N/A'}</span>
              </div>
              <div style="margin-bottom: 6px;">
                <span style="font-size: 12px; color: #64748b;">Date:</span>
                <span style="font-size: 14px; font-weight: 600; color: #1e293b; margin-left: 5px;">${booking.booking_date}</span>
              </div>
              <div style="margin-bottom: 6px;">
                <span style="font-size: 12px; color: #64748b;">Time:</span>
                <span style="font-size: 14px; font-weight: 600; color: #1e293b; margin-left: 5px;">${convertTo12Hour(booking.booking_time)}</span>
              </div>
              <div>
                <span style="font-size: 12px; color: #64748b;">Participants:</span>
                <span style="font-size: 14px; font-weight: 600; color: #1e293b; margin-left: 5px;">${booking.participants} people</span>
              </div>
            </div>
          </div>
          ${pkg ? `
          <div style="margin-bottom: 25px; border: 2px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
            <div style="background: #1e40af; color: white; padding: 12px 20px; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Package Details</div>
            <div style="padding: 20px;">
              <h4 style="margin: 0 0 10px 0; font-size: 18px; color: #1e293b; font-weight: 700;">${pkg.name}</h4>
              ${pkg.description ? `<p style="margin: 0 0 15px 0; font-size: 14px; color: #64748b; line-height: 1.5;">${pkg.description}</p>` : ''}
              <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-top: 15px;">
                <div style="background: #f1f5f9; padding: 10px; border-radius: 4px;">
                  <div style="font-size: 11px; color: #64748b; text-transform: uppercase;">Duration</div>
                  <div style="font-size: 14px; font-weight: 600; color: #1e293b; margin-top: 2px;">${formatDurationDisplay(booking.duration, booking.duration_unit)}</div>
                </div>
                <div style="background: #f1f5f9; padding: 10px; border-radius: 4px;">
                  <div style="font-size: 11px; color: #64748b; text-transform: uppercase;">Package Price</div>
                  <div style="font-size: 14px; font-weight: 600; color: #1e293b; margin-top: 2px;">$${typeof pkg.price === 'string' ? parseFloat(pkg.price).toFixed(2) : (pkg.price as number).toFixed(2)}</div>
                </div>
              </div>
            </div>
          </div>
          ` : ''}
          ${booking.attractions && (booking.attractions as any[]).length > 0 ? `
          <div style="margin-bottom: 20px; background: #f8fafc; padding: 15px;">
            <h4 style="margin: 0 0 10px 0; font-size: 13px; color: #1e40af; text-transform: uppercase; letter-spacing: 0.5px;">Included Attractions</h4>
            <ul style="margin: 0; padding-left: 20px; font-size: 13px; color: #1e40af;">
              ${(booking.attractions as any[]).map(attr => `<li style="margin-bottom: 5px;">${attr.name}${attr.pivot?.quantity ? ` (x${attr.pivot.quantity})` : ''}</li>`).join('')}
            </ul>
          </div>
          ` : ''}
          ${booking.add_ons && (booking.add_ons as any[]).length > 0 ? `
          <div style="margin-bottom: 20px; background: #f8fafc; padding: 15px;">
            <h4 style="margin: 0 0 10px 0; font-size: 13px; color: #1e40af; text-transform: uppercase; letter-spacing: 0.5px;">Add-ons</h4>
            <ul style="margin: 0; padding-left: 20px; font-size: 13px; color: #1e40af;">
              ${(booking.add_ons as any[]).map(addon => `<li style="margin-bottom: 5px;">${addon.name}${addon.pivot?.quantity ? ` (x${addon.pivot.quantity})` : ''}</li>`).join('')}
            </ul>
          </div>
          ` : ''}
          ${(booking as any).guest_of_honor_name ? `
          <div style="margin-bottom: 25px; background: #f8fafc; padding: 15px;">
            <h4 style="margin: 0 0 10px 0; font-size: 13px; color: #1e40af; text-transform: uppercase; letter-spacing: 0.5px;">Guest of Honor</h4>
            <div style="font-size: 14px; color: #1e293b;">
              <div style="margin-bottom: 4px;"><span style="color: #64748b;">Name:</span> <strong>${(booking as any).guest_of_honor_name}</strong></div>
              ${(booking as any).guest_of_honor_age ? `<div style="margin-bottom: 4px;"><span style="color: #64748b;">Age:</span> <strong>${(booking as any).guest_of_honor_age} years old</strong></div>` : ''}
              ${(booking as any).guest_of_honor_gender ? `<div><span style="color: #64748b;">Gender:</span> <strong style="text-transform: capitalize;">${(booking as any).guest_of_honor_gender}</strong></div>` : ''}
            </div>
          </div>
          ` : ''}
          ${booking.special_requests ? `
          <div style="margin-bottom: 25px; background: #f8fafc; padding: 15px;">
            <h4 style="margin: 0 0 8px 0; font-size: 13px; color: #1e40af; text-transform: uppercase; letter-spacing: 0.5px;">Special Requests</h4>
            <p style="margin: 0; font-size: 13px; color: #1e40af; line-height: 1.5;">${booking.special_requests}</p>
          </div>
          ` : ''}
          <div style="border: 2px solid #e2e8f0; border-radius: 8px; overflow: hidden; margin-bottom: 25px;">
            <div style="background: #f8fafc; padding: 12px 20px; border-bottom: 2px solid #e2e8f0;">
              <h3 style="margin: 0; font-size: 14px; color: #1e293b; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">Payment Summary</h3>
            </div>
            <div style="padding: 20px;">
              <div style="display: flex; justify-content: space-between; margin-bottom: 10px; padding-bottom: 10px; border-bottom: 1px solid #e2e8f0;">
                <span style="font-size: 14px; color: #64748b;">Subtotal</span>
                <span style="font-size: 14px; font-weight: 600; color: #1e293b;">$${totalAmount.toFixed(2)}</span>
              </div>
              ${booking.discount_amount && parseFloat(booking.discount_amount as string) > 0 ? `
              <div style="display: flex; justify-content: space-between; margin-bottom: 10px; padding-bottom: 10px; border-bottom: 1px solid #e2e8f0;">
                <span style="font-size: 14px; color: #10b981;">Discount</span>
                <span style="font-size: 14px; font-weight: 600; color: #10b981;">-$${parseFloat(booking.discount_amount as string).toFixed(2)}</span>
              </div>
              ` : ''}
              <div style="display: flex; justify-content: space-between; padding: 15px 0; background: #f1f5f9; margin: 0 -20px; padding-left: 20px; padding-right: 20px;">
                <span style="font-size: 16px; font-weight: 700; color: #1e293b; text-transform: uppercase;">Total Amount</span>
                <span style="font-size: 20px; font-weight: 700; color: #1e40af;">$${totalAmount.toFixed(2)}</span>
              </div>
              <div style="display: flex; justify-content: space-between; margin-top: 12px;">
                <span style="font-size: 13px; color: #64748b;">Amount Paid</span>
                <span style="font-size: 14px; font-weight: 600; color: #10b981;">$${amountPaid.toFixed(2)}</span>
              </div>
              <div style="display: flex; justify-content: space-between; margin-top: 8px;">
                <span style="font-size: 13px; color: #64748b;">Payment Method</span>
                <span style="font-size: 14px; font-weight: 600; color: #1e293b; text-transform: capitalize;">${booking.payment_method || 'Card'}</span>
              </div>
              <div style="display: flex; justify-content: space-between; margin-top: 8px;">
                <span style="font-size: 13px; color: #64748b;">Payment Status</span>
                <span style="font-size: 14px; font-weight: 600; color: ${booking.payment_status === 'paid' ? '#10b981' : booking.payment_status === 'partial' ? '#f59e0b' : '#ef4444'}; text-transform: capitalize;">${booking.payment_status}</span>
              </div>
            </div>
          </div>
          <div style="text-align: center; margin-bottom: 20px;">
            <span style="display: inline-block; padding: 8px 24px; background: ${
              booking.status === 'confirmed' ? '#dcfce7' :
              booking.status === 'pending' ? '#fef3c7' :
              booking.status === 'completed' ? '#dbeafe' :
              '#fee2e2'
            }; color: ${
              booking.status === 'confirmed' ? '#15803d' :
              booking.status === 'pending' ? '#92400e' :
              booking.status === 'completed' ? '#1e40af' :
              '#991b1b'
            }; border-radius: 20px; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">
              ${booking.status}
            </span>
          </div>
        </div>
        <div style="background: #f8fafc; padding: 25px 30px; border-top: 2px solid #e2e8f0; text-align: center;">
          <p style="margin: 0 0 8px 0; font-size: 14px; color: #1e293b; font-weight: 600;">Thank you for choosing ZapZone!</p>
          <p style="margin: 0 0 15px 0; font-size: 12px; color: #64748b; line-height: 1.5;">For inquiries or support, contact us at info@zapzone.com or call (555) 123-4567</p>
          <div style="font-size: 11px; color: #94a3b8; margin-top: 15px; padding-top: 15px; border-top: 1px solid #e2e8f0;">
            This is an official receipt generated on ${new Date().toLocaleString('en-US')} | ZapZone Entertainment Centers
          </div>
        </div>
      </div>
    `;
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
      case 'checked-in': return 'bg-violet-50 text-violet-700 border-violet-200';
      default: return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  const getStatusDot = (status: string) => {
    switch (status) {
      case 'confirmed': return 'bg-emerald-500';
      case 'pending': return 'bg-amber-500';
      case 'cancelled': return 'bg-red-500';
      case 'completed': return 'bg-blue-500';
      case 'checked-in': return 'bg-violet-500';
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
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.97); } to { opacity: 1; transform: scale(1); } }
        .fade-in { animation: fadeIn 0.25s ease-out; }
        .slide-up { animation: slideUp 0.35s ease-out both; }
        .scale-in { animation: scaleIn 0.25s ease-out; }
        .hover-lift { transition: all 0.2s ease; }
        .hover-lift:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,0,0,0.06); }
        .no-scrollbar { scrollbar-width: none; -ms-overflow-style: none; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
      `}</style>

      <div className="min-h-screen bg-gray-50/80">
        {/* Compact Hero */}
        <section className="relative bg-gradient-to-br from-blue-900 via-blue-800 to-violet-700 text-white py-6 md:py-8 overflow-hidden">
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
          {/* Search & Sort Bar */}
          <div className="flex flex-col sm:flex-row gap-3 mb-5 slide-up">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search bookings..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition"
              />
            </div>
            <div className="flex gap-2">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortBy)}
                className="px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
              >
                <option value="date">Date</option>
                <option value="status">Status</option>
                <option value="amount">Amount</option>
              </select>
              <button
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                className="px-3 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition text-sm flex items-center gap-1.5 text-gray-600"
              >
                <ArrowUpDown className="w-3.5 h-3.5" />
                {sortOrder === 'asc' ? 'Asc' : 'Desc'}
              </button>
            </div>
          </div>

          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
              <span className="ml-2.5 text-sm text-gray-500">Loading bookings...</span>
            </div>
          )}

          {/* Error */}
          {error && !loading && (
            <div className="bg-red-50 border border-red-100 rounded-lg p-4 mb-5 flex items-start gap-3">
              <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-red-800">Failed to load bookings</p>
                <p className="text-xs text-red-600 mt-0.5">{error}</p>
              </div>
            </div>
          )}

          {/* Booking Cards */}
          {!loading && !error && (
            <div className="space-y-3">
              {bookings.length === 0 ? (
                <div className="text-center py-16 bg-white border border-gray-100 rounded-xl">
                  <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <h3 className="text-base font-semibold text-gray-800 mb-1">No reservations yet</h3>
                  <p className="text-sm text-gray-500 mb-5">Book a package to get started</p>
                  <a
                    href="/"
                    className="inline-flex items-center text-sm px-5 py-2 bg-blue-700 text-white font-medium rounded-lg hover:bg-blue-800 transition"
                  >
                    Explore Packages
                  </a>
                </div>
              ) : (
                bookings.map((booking, idx) => (
                  <div
                    key={booking.id}
                    className="bg-white border border-gray-100 rounded-xl hover-lift slide-up overflow-hidden"
                    style={{ animationDelay: `${idx * 0.04}s` }}
                  >
                    {/* Card Content */}
                    <div className="p-4 sm:p-5">
                      <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                        {/* Booking Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2.5 mb-2.5">
                            <h3 className="text-base font-semibold text-gray-900 truncate">
                              {getPackageName(booking)}
                            </h3>
                            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-semibold rounded-full border ${getStatusColor(booking.status)}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${getStatusDot(booking.status)}`} />
                              {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                            </span>
                          </div>

                          <div className="flex flex-wrap gap-2 text-sm text-gray-500">
                            <span className="inline-flex items-center gap-1.5 bg-gray-50 px-2.5 py-1.5 rounded-md">
                              <MapPin size={13} className="text-blue-600" />
                              <span className="text-gray-700 font-medium">{getLocationName(booking)}</span>
                            </span>
                            <span className="inline-flex items-center gap-1.5 bg-gray-50 px-2.5 py-1.5 rounded-md">
                              <Calendar size={12} className="text-blue-600" />
                              <span className="text-gray-700 font-medium">{booking.booking_date.split('T')[0]} at {convertTo12Hour(booking.booking_time)}</span>
                            </span>
                            <span className="inline-flex items-center gap-1.5 bg-gray-50 px-2.5 py-1.5 rounded-md">
                              <Users size={12} className="text-blue-600" />
                              <span className="text-gray-700 font-medium">{booking.participants} guests</span>
                            </span>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => handleViewDetails(booking)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition"
                          >
                            <Eye size={13} />
                            Details
                          </button>
                          {(booking.status === 'confirmed' || booking.status === 'pending') && booking.package && (
                            <button
                              onClick={() => handleSendInvitations(booking)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium border border-blue-200 text-blue-600 rounded-lg hover:bg-blue-50 transition"
                            >
                              Invitations
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Expand Toggle */}
                      <button
                        onClick={() => toggleReservationExpand(booking.id.toString())}
                        className="w-full mt-3 flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 transition text-sm rounded-lg"
                      >
                        <span className="font-medium text-gray-600">Quick Actions</span>
                        {expandedReservation === booking.id.toString() ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                      </button>
                    </div>

                    {/* Expanded Content */}
                    {expandedReservation === booking.id.toString() && (
                      <div className="border-t border-gray-100 p-4 sm:p-5 bg-gray-50/60 fade-in">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Booking Info Card */}
                          <div className="bg-white p-4 rounded-lg border border-gray-100">
                            <h4 className="text-sm font-semibold text-gray-800 mb-3 uppercase tracking-wide">Booking Info</h4>
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-gray-500">Reference</span>
                                <span className="font-mono font-semibold text-gray-800 bg-gray-50 px-1.5 py-0.5 rounded">{booking.reference_number}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-500">Total</span>
                                <span className="font-semibold text-emerald-600">${typeof booking.total_amount === 'string' ? parseFloat(booking.total_amount).toFixed(2) : booking.total_amount.toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-500">Booked</span>
                                <span className="text-gray-700">{new Date(booking.created_at).toLocaleDateString()} {new Date(booking.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-500">Payment</span>
                                <span className="text-gray-700 capitalize">{booking.payment_status}</span>
                              </div>
                            </div>
                          </div>

                          {/* Downloads Card */}
                          <div className="bg-white p-4 rounded-lg border border-gray-100">
                            <h4 className="text-sm font-semibold text-gray-800 mb-3 uppercase tracking-wide">Downloads</h4>
                            <div className="flex flex-col gap-2">
                              <button
                                onClick={() => handleDownloadReceipt(booking)}
                                className="flex items-center gap-2 px-3 py-2 text-sm bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium"
                              >
                                <FileText size={13} />
                                Download Receipt
                              </button>
                              <button
                                onClick={() => handleDownloadQRCode(booking)}
                                className="flex items-center gap-2 px-3 py-2 text-sm bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium"
                              >
                                <QrCode size={13} />
                                Download QR Code
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Invitation Tracker */}
                        {booking.package && (booking.status === 'confirmed' || booking.status === 'pending') && (
                          <div className="mt-4">
                            <InvitationTracker bookingId={booking.id} participants={booking.participants} />
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
          {!loading && bookings.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-6 bg-white border border-gray-100 rounded-xl p-3">
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span>Rows:</span>
                <select
                  value={pageSize}
                  onChange={e => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                  className="border border-gray-200 rounded-md px-2 py-1 text-xs bg-gray-50"
                >
                  {[5, 10, 20, 50].map(size => (
                    <option key={size} value={size}>{size}</option>
                  ))}
                </select>
                <span className="ml-2 text-gray-400">
                  {((currentPage - 1) * pageSize) + 1}–{Math.min(currentPage * pageSize, totalBookings)} of {totalBookings}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 text-xs border border-gray-200 rounded-md disabled:opacity-40 hover:bg-gray-50 font-medium transition"
                >
                  Prev
                </button>
                <span className="text-xs text-gray-500">{currentPage} / {totalPages}</span>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 text-xs border border-gray-200 rounded-md disabled:opacity-40 hover:bg-gray-50 font-medium transition"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Booking Details Modal */}
      {showDetailsModal && selectedBooking && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 fade-in" onClick={() => setShowDetailsModal(false)}>
          <div className="rounded-xl max-w-lg w-full max-h-[85vh] overflow-hidden scale-in shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="max-h-[85vh] overflow-y-auto no-scrollbar">
              {/* Modal Header */}
              <div className="sticky top-0 z-10 bg-gradient-to-r from-blue-900 via-blue-800 to-violet-700 px-5 py-3.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold" style={{ color: 'white' }}>Booking Details</h3>
                  <button
                    onClick={() => setShowDetailsModal(false)}
                    className="p-1 hover:bg-white/15 rounded-md transition text-white"
                  >
                    <X size={15} />
                  </button>
                </div>
              </div>

              {/* Modal Body */}
              <div className="p-5 space-y-4 bg-white">
                {/* Package Info */}
                {selectedBooking.package && (
                  <div>
                    <h4 className="text-xs font-semibold text-gray-800 mb-2 uppercase tracking-wide">Package</h4>
                    <div className="bg-gray-50 p-3.5 rounded-lg space-y-2 text-xs">
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
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex items-center gap-2 bg-gray-50 p-3 rounded-lg">
                      <MapPin size={13} className="text-blue-600 shrink-0" />
                      <span className="text-gray-700">{getLocationName(selectedBooking)}</span>
                    </div>
                    <div className="flex items-center gap-2 bg-gray-50 p-3 rounded-lg">
                      <Calendar size={13} className="text-blue-600 shrink-0" />
                      <span className="text-gray-700">{selectedBooking.booking_date}</span>
                    </div>
                    <div className="flex items-center gap-2 bg-gray-50 p-3 rounded-lg">
                      <Clock size={13} className="text-blue-600 shrink-0" />
                      <span className="text-gray-700">{convertTo12Hour(selectedBooking.booking_time)}</span>
                    </div>
                    <div className="flex items-center gap-2 bg-gray-50 p-3 rounded-lg">
                      <Users size={13} className="text-blue-600 shrink-0" />
                      <span className="text-gray-700">{selectedBooking.participants} guests</span>
                    </div>
                  </div>
                </div>

                {/* Attractions */}
                {selectedBooking.attractions && (selectedBooking.attractions as any[]).length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-gray-800 mb-2 uppercase tracking-wide">Attractions</h4>
                    <div className="space-y-1.5">
                      {(selectedBooking.attractions as any[]).map((attr, index) => (
                        <div key={index} className="flex items-center gap-2 text-xs text-gray-700">
                          <CheckCircle size={13} className="text-emerald-500 shrink-0" />
                          <span>{attr.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Add-ons */}
                {selectedBooking.add_ons && (selectedBooking.add_ons as any[]).length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-gray-800 mb-2 uppercase tracking-wide">Add-ons</h4>
                    <div className="space-y-1.5">
                      {(selectedBooking.add_ons as any[]).map((addon, index) => (
                        <div key={index} className="flex items-center gap-2 text-xs text-gray-700">
                          <CheckCircle size={13} className="text-blue-500 shrink-0" />
                          <span>{addon.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Payment */}
                <div>
                  <h4 className="text-xs font-semibold text-gray-800 mb-2 uppercase tracking-wide">Payment</h4>
                  <div className="bg-gray-50 p-3.5 rounded-lg space-y-2 text-xs">
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
                      <span className={`px-2 py-0.5 text-[11px] font-semibold rounded-full border ${getStatusColor(selectedBooking.payment_status)}`}>
                        {selectedBooking.payment_status}
                      </span>
                    </div>
                    <div className="flex justify-between items-center pt-1 border-t border-gray-200">
                      <span className="text-gray-500">Booking Status</span>
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-semibold rounded-full border ${getStatusColor(selectedBooking.status)}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${getStatusDot(selectedBooking.status)}`} />
                        {selectedBooking.status.charAt(0).toUpperCase() + selectedBooking.status.slice(1)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Guest of Honor */}
                {(selectedBooking as any).guest_of_honor_name && (
                  <div>
                    <h4 className="text-xs font-semibold text-gray-800 mb-2 uppercase tracking-wide">Guest of Honor</h4>
                    <div className="bg-gray-50 p-3.5 rounded-lg space-y-1.5 text-xs">
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
                    <p className="text-xs text-gray-700 bg-blue-50 p-3 rounded-lg border-l-3 border-blue-600 leading-relaxed">
                      {selectedBooking.special_requests}
                    </p>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-gray-100 flex gap-2 bg-white">
                <button
                  onClick={() => handleDownloadReceipt(selectedBooking)}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs bg-blue-700 text-white font-medium rounded-lg hover:bg-blue-800 transition"
                >
                  <FileText size={13} />
                  Receipt
                </button>
                <button
                  onClick={() => handleDownloadQRCode(selectedBooking)}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs border border-gray-200 text-gray-600 font-medium rounded-lg hover:bg-gray-50 transition"
                >
                  <QrCode size={13} />
                  QR Code
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
        />
      )}
    </>
  );
};

export default CustomerReservations;
