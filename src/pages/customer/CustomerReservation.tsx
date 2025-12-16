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
  Shield,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  Package,
  Search,
  ArrowUpDown,
  Loader2
} from 'lucide-react';
import QRCode from 'qrcode';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import type { SortBy, SortOrder } from '../../types/customer';
import bookingService, { type Booking } from '../../services/bookingService';
import type { BookPackagePackage } from '../../types/BookPackage.types';

const CustomerReservations = () => {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showRefundPolicy, setShowRefundPolicy] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
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

  // Fetch bookings from API
  useEffect(() => {
    fetchBookings();
  }, [currentPage, pageSize, searchTerm, sortBy, sortOrder]);

  const fetchBookings = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Get customer data from localStorage
      const customerData = localStorage.getItem('zapzone_customer');
      const customer = customerData ? JSON.parse(customerData) : null;
      
      // Validate that we have valid customer identification
      if (!customer?.id && !customer?.email) {
        console.warn('No valid customer identification found in localStorage');
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

      // Add search filter
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
      // Generate QR code from reference number (matching BookPackage.tsx)
      const qrCodeDataURL = await QRCode.toDataURL(booking.reference_number, {
        width: 512,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
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

  const handleCancelReservation = (booking: Booking) => {
    setSelectedBooking(booking);
    setShowRefundPolicy(true);
  };

  const proceedWithCancellation = () => {
    setShowRefundPolicy(false);
    setShowCancelModal(true);
  };

  const confirmCancellation = async () => {
    if (selectedBooking && cancelReason.trim()) {
      try {
        // Update booking status to cancelled via API
        await bookingService.updateBooking(selectedBooking.id, {
          status: 'cancelled',
          notes: `Cancellation reason: ${cancelReason}`
        });
        
        // Refresh bookings list
        await fetchBookings();
        
        alert('Booking cancelled successfully. Refund will be processed according to our policy.');
      } catch (error) {
        console.error('Error cancelling booking:', error);
        alert('Failed to cancel booking. Please contact support.');
      } finally {
        setShowCancelModal(false);
        setCancelReason('');
        setSelectedBooking(null);
      }
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
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); padding: 30px; text-align: center; color: white;">
          <h1 style="margin: 0 0 5px 0; font-size: 32px; font-weight: bold; letter-spacing: 1px;">ZAPZONE</h1>
          <p style="margin: 0; font-size: 14px; opacity: 0.9;">Entertainment Center - Official Receipt</p>
        </div>

        <!-- Receipt Info Bar -->
        <div style="background: #f8fafc; padding: 15px 30px; border-bottom: 1px solid #e2e8f0;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
              <div style="font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">Receipt Number</div>
              <div style="font-size: 16px; font-weight: bold; color: #1e293b; margin-top: 2px;">${booking.reference_number}</div>
            </div>
            <div style="text-align: right;">
              <div style="font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">Issue Date</div>
              <div style="font-size: 14px; font-weight: 600; color: #1e293b; margin-top: 2px;">${new Date(booking.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
            </div>
          </div>
        </div>

        <!-- Customer & Booking Info -->
        <div style="padding: 30px;">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px;">
            <!-- Customer Info -->
            <div style="background: #f8fafc; padding: 20px;">
              <h3 style="margin: 0 0 12px 0; font-size: 13px; color: #1e40af; text-transform: uppercase; letter-spacing: 0.5px;">Customer Information</h3>
              <div style="font-size: 15px; font-weight: 600; color: #1e293b; margin-bottom: 4px;">${customerName}</div>
              ${customerEmail ? `<div style="font-size: 13px; color: #64748b;">${customerEmail}</div>` : ''}
              ${booking.guest_phone ? `<div style="font-size: 13px; color: #64748b; margin-top: 2px;">${booking.guest_phone}</div>` : ''}
            </div>

            <!-- Booking Details -->
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
                <span style="font-size: 14px; font-weight: 600; color: #1e293b; margin-left: 5px;">${booking.booking_time}</span>
              </div>
              <div>
                <span style="font-size: 12px; color: #64748b;">Participants:</span>
                <span style="font-size: 14px; font-weight: 600; color: #1e293b; margin-left: 5px;">${booking.participants} people</span>
              </div>
            </div>
          </div>

          <!-- Package Details -->
          ${pkg ? `
          <div style="margin-bottom: 25px; border: 2px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
            <div style="background: #1e40af; color: white; padding: 12px 20px; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
              Package Details
            </div>
            <div style="padding: 20px;">
              <h4 style="margin: 0 0 10px 0; font-size: 18px; color: #1e293b; font-weight: 700;">${pkg.name}</h4>
              ${pkg.description ? `<p style="margin: 0 0 15px 0; font-size: 14px; color: #64748b; line-height: 1.5;">${pkg.description}</p>` : ''}
              
              <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-top: 15px;">
                <div style="background: #f1f5f9; padding: 10px; border-radius: 4px;">
                  <div style="font-size: 11px; color: #64748b; text-transform: uppercase;">Duration</div>
                  <div style="font-size: 14px; font-weight: 600; color: #1e293b; margin-top: 2px;">${booking.duration} ${booking.duration_unit}</div>
                </div>
                <div style="background: #f1f5f9; padding: 10px; border-radius: 4px;">
                  <div style="font-size: 11px; color: #64748b; text-transform: uppercase;">Package Price</div>
                  <div style="font-size: 14px; font-weight: 600; color: #1e293b; margin-top: 2px;">$${typeof pkg.price === 'string' ? parseFloat(pkg.price).toFixed(2) : (pkg.price as number).toFixed(2)}</div>
                </div>
              </div>
            </div>
          </div>
          ` : ''}

          <!-- Attractions & Add-ons -->
          ${booking.attractions && (booking.attractions as any[]).length > 0 ? `
          <div style="margin-bottom: 20px; background: #f8fafc; padding: 15px;">
            <h4 style="margin: 0 0 10px 0; font-size: 13px; color: #1e40af; text-transform: uppercase; letter-spacing: 0.5px;">Included Attractions</h4>
            <ul style="margin: 0; padding-left: 20px; font-size: 13px; color: #1e40af;">
              ${(booking.attractions as any[]).map(attr => `<li style="margin-bottom: 5px;">${attr.name}${attr.pivot?.quantity ? ` (x${attr.pivot.quantity})` : ''}</li>`).join('')}
            </ul>
          </div>
          ` : ''}

          ${booking.addOns && (booking.addOns as any[]).length > 0 ? `
          <div style="margin-bottom: 20px; background: #f8fafc; padding: 15px;">
            <h4 style="margin: 0 0 10px 0; font-size: 13px; color: #1e40af; text-transform: uppercase; letter-spacing: 0.5px;">Add-ons</h4>
            <ul style="margin: 0; padding-left: 20px; font-size: 13px; color: #1e40af;">
              ${(booking.addOns as any[]).map(addon => `<li style="margin-bottom: 5px;">${addon.name}${addon.pivot?.quantity ? ` (x${addon.pivot.quantity})` : ''}</li>`).join('')}
            </ul>
          </div>
          ` : ''}

          <!-- Special Requests -->
          ${booking.special_requests ? `
          <div style="margin-bottom: 25px; background: #f8fafc; padding: 15px;">
            <h4 style="margin: 0 0 8px 0; font-size: 13px; color: #1e40af; text-transform: uppercase; letter-spacing: 0.5px;">Special Requests</h4>
            <p style="margin: 0; font-size: 13px; color: #1e40af; line-height: 1.5;">${booking.special_requests}</p>
          </div>
          ` : ''}

          <!-- Payment Summary -->
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

          <!-- Status Badge -->
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

        <!-- Footer -->
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
      case 'confirmed': return 'bg-green-100 text-green-800 border-green-200';
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'cancelled': return 'bg-red-100 text-red-800 border-red-200';
      case 'completed': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'checked-in': return 'bg-purple-100 text-purple-800 border-purple-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
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
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-3">
              My Reservations
            </h1>
            <p className="text-gray-600 mt-1 text-sm">Manage your package bookings and view reservation details</p>
          </div>

          {/* Search and Sort Controls */}
          <div className="bg-white p-4 border border-gray-200 mb-6">
            <div className="flex flex-col md:flex-row gap-4">
              {/* Search */}
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Search by package name, reference number, or location..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-800 focus:border-blue-800"
                  />
                </div>
              </div>

              {/* Sort Controls */}
              <div className="flex gap-2">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortBy)}
                  className="px-3 py-2 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-800 focus:border-blue-800"
                >
                  <option value="date">Sort by Date</option>
                  <option value="status">Sort by Status</option>
                  <option value="amount">Sort by Amount</option>
                </select>
                
                <button
                  onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                  className="px-3 py-2 border border-gray-300 hover:bg-gray-50 transition flex items-center gap-2"
                  title={`Currently ${sortOrder === 'asc' ? 'ascending' : 'descending'}`}
                >
                  <ArrowUpDown className="w-4 h-4" />
                  {sortOrder === 'asc' ? 'A-Z' : 'Z-A'}
                </button>
              </div>
            </div>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="flex justify-center items-center py-12">
              <Loader2 className="w-8 h-8 text-blue-800 animate-spin" />
              <span className="ml-3 text-gray-600">Loading bookings...</span>
            </div>
          )}

          {/* Error State */}
          {error && !loading && (
            <div className="bg-red-50 border border-red-200 p-4 mb-6">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-600" />
                <span className="text-red-800 font-medium">Error loading bookings</span>
              </div>
              <p className="text-red-700 text-sm mt-1">{error}</p>
            </div>
          )}

          {/* Reservations List */}
          {!loading && !error && (
            <div className="space-y-4">
              {bookings.length === 0 ? (
                <div className="text-center py-12 bg-white border border-gray-200">
                  <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No reservations yet</h3>
                  <p className="text-gray-600 mb-4">Start by booking a package from our entertainment offerings</p>
                  <a 
                    href="/" 
                    className="inline-flex items-center px-6 py-3 bg-blue-800 text-white font-semibold hover:bg-blue-900 transition"
                  >
                    Explore Packages
                  </a>
                </div>
              ) : (
                bookings.map((booking) => (
                  <div key={booking.id} className="bg-white border border-gray-200">
                    {/* Booking Header */}
                    <div className="p-6">
                      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-4 mb-2">
                            <h3 className="text-base font-medium text-gray-900">
                              {getPackageName(booking)}
                            </h3>
                            <span className={`px-2 py-0.5 text-xs font-medium border ${getStatusColor(booking.status)}`}>
                              {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                            </span>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
                            <div className="flex items-center gap-2">
                              <MapPin size={16} className="text-blue-800" />
                              <span>{getLocationName(booking)}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Calendar size={16} className="text-blue-800" />
                              <span>{booking.booking_date.split('T')[0]} at {booking.booking_time}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Users size={16} className="text-blue-800" />
                              <span>{booking.participants} participants</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-2">
                          <button
                            onClick={() => handleViewDetails(booking)}
                            className="flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-300 text-gray-700 hover:bg-gray-50 transition font-medium"
                          >
                            <Eye size={14} />
                            View Details
                          </button>
                          
                          {booking.status === 'confirmed' && (
                            <button
                              onClick={() => handleCancelReservation(booking)}
                              className="flex items-center gap-1 px-3 py-1.5 text-sm border border-red-300 text-red-700 hover:bg-red-50 transition font-medium"
                            >
                              <X size={14} />
                              Cancel
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Expandable Section */}
                      <button
                        onClick={() => toggleReservationExpand(booking.id.toString())}
                        className="w-full mt-4 flex items-center justify-between p-2 bg-gray-50 hover:bg-gray-100 transition text-sm"
                      >
                        <span className="font-medium text-gray-700">Quick Actions & Details</span>
                        {expandedReservation === booking.id.toString() ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>
                    </div>

                    {/* Expanded Content */}
                    {expandedReservation === booking.id.toString() && (
                      <div className="border-t border-gray-200 p-6 bg-gray-50">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div>
                            <h4 className="font-medium text-gray-900 mb-2 text-sm">Booking Information</h4>
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-gray-600">Reference Number:</span>
                                <span className="font-medium">{booking.reference_number}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">Total Amount:</span>
                                <span className="font-medium text-green-600">${typeof booking.total_amount === 'string' ? parseFloat(booking.total_amount).toFixed(2) : booking.total_amount.toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">Booked On:</span>
                                <span className="font-medium">{new Date(booking.created_at).toLocaleDateString()}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">Payment Status:</span>
                                <span className="font-medium text-capitalize">{booking.payment_status}</span>
                              </div>
                            </div>
                          </div>

                          <div>
                            <h4 className="font-medium text-gray-900 mb-2 text-sm">Downloads</h4>
                            <div className="flex flex-col gap-2">
                              <button
                                onClick={() => handleDownloadReceipt(booking)}
                                className="flex items-center gap-1 px-3 py-1.5 text-sm bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 transition font-medium"
                              >
                                <FileText size={14} />
                                Download Receipt
                              </button>
                              <button
                                onClick={() => handleDownloadQRCode(booking)}
                                className="flex items-center gap-1 px-3 py-1.5 text-sm bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 transition font-medium"
                              >
                                <QrCode size={14} />
                                Download QR Code
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* Pagination Controls */}
          {!loading && bookings.length > 0 && (
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 mt-8">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Rows per page:</span>
                <select
                  value={pageSize}
                  onChange={e => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="border border-gray-300 rounded px-2 py-1 text-sm"
                >
                  {[5, 10, 20, 50].map(size => (
                    <option key={size} value={size}>{size}</option>
                  ))}
                </select>
                <span className="text-sm text-gray-600 ml-4">
                  Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, totalBookings)} of {totalBookings}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 text-sm border border-gray-300 rounded disabled:opacity-50 hover:bg-gray-50"
                >
                  Previous
                </button>
                <span className="text-sm text-gray-700">Page {currentPage} of {totalPages}</span>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 text-sm border border-gray-300 rounded disabled:opacity-50 hover:bg-gray-50"
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-backdrop-fade" onClick={() => setShowDetailsModal(false)}>
          <div className="bg-white max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Booking Details</h3>
                <button
                  onClick={() => setShowDetailsModal(false)}
                  className="p-2 hover:bg-gray-100 transition"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Package Details */}
              {selectedBooking.package && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-2 text-sm">Package Information</h4>
                  <div className="bg-gray-50 p-4 space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Package:</span>
                      <span className="font-medium">{getPackageName(selectedBooking)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Duration:</span>
                      <span className="font-medium">{selectedBooking.duration} {selectedBooking.duration_unit}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Participants:</span>
                      <span className="font-medium">{selectedBooking.participants}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Booking Details */}
              <div>
                <h4 className="font-medium text-gray-900 mb-2 text-sm">Booking Details</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <MapPin size={16} className="text-blue-800" />
                    <span><strong>Location:</strong> {getLocationName(selectedBooking)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar size={16} className="text-blue-800" />
                    <span><strong>Date:</strong> {selectedBooking.booking_date}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock size={16} className="text-blue-800" />
                    <span><strong>Time:</strong> {selectedBooking.booking_time}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users size={16} className="text-blue-800" />
                    <span><strong>Participants:</strong> {selectedBooking.participants}</span>
                  </div>
                </div>
              </div>

              {/* Attractions */}
              {selectedBooking.attractions && (selectedBooking.attractions as any[]).length > 0 && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-2 text-sm">Included Attractions</h4>
                  <ul className="space-y-2">
                    {(selectedBooking.attractions as any[]).map((attr, index) => (
                      <li key={index} className="flex items-center gap-2">
                        <CheckCircle size={16} className="text-green-500" />
                        <span>{attr.name}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Add-ons */}
              {selectedBooking.addOns && (selectedBooking.addOns as any[]).length > 0 && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-2 text-sm">Add-ons</h4>
                  <ul className="space-y-2">
                    {(selectedBooking.addOns as any[]).map((addon, index) => (
                      <li key={index} className="flex items-center gap-2">
                        <CheckCircle size={16} className="text-blue-500" />
                        <span>{addon.name}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Payment Information */}
              <div>
                <h4 className="font-medium text-gray-900 mb-2 text-sm">Payment Information</h4>
                <div className="bg-gray-50 p-4 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Reference Number:</span>
                    <span className="font-medium">{selectedBooking.reference_number}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total Amount:</span>
                    <span className="font-medium text-green-600">${typeof selectedBooking.total_amount === 'string' ? parseFloat(selectedBooking.total_amount).toFixed(2) : selectedBooking.total_amount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Amount Paid:</span>
                    <span className="font-medium">${typeof selectedBooking.amount_paid === 'string' ? parseFloat(selectedBooking.amount_paid).toFixed(2) : selectedBooking.amount_paid.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Payment Status:</span>
                    <span className={`px-2 py-1 text-sm font-medium capitalize ${getStatusColor(selectedBooking.payment_status)}`}>
                      {selectedBooking.payment_status}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Status:</span>
                    <span className={`px-2 py-1 text-sm font-medium ${getStatusColor(selectedBooking.status)}`}>
                      {selectedBooking.status.charAt(0).toUpperCase() + selectedBooking.status.slice(1)}
                    </span>
                  </div>
                </div>
              </div>

              {selectedBooking.special_requests && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-2 text-sm">Special Requests</h4>
                  <p className="bg-blue-50 p-4 border-l-4 border-blue-800">
                    {selectedBooking.special_requests}
                  </p>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button
                onClick={() => handleDownloadReceipt(selectedBooking)}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm bg-blue-800 text-white font-medium hover:bg-blue-900 transition"
              >
                <FileText size={16} />
                Download Receipt
              </button>
              <button
                onClick={() => handleDownloadQRCode(selectedBooking)}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition"
              >
                <QrCode size={16} />
                QR Code
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Refund Policy Modal */}
      {showRefundPolicy && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-backdrop-fade" onClick={() => setShowRefundPolicy(false)}>
          <div className="bg-white max-w-2xl w-full max-h-[80vh] overflow-y-auto animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <Shield className="w-5 h-5 text-blue-800" />
                <h3 className="text-lg font-semibold text-gray-900">Refund Policy</h3>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-yellow-50 border border-yellow-200 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle size={20} className="text-yellow-600" />
                  <span className="font-semibold text-yellow-800">Important Information</span>
                </div>
                <p className="text-yellow-700 text-sm">
                  Please read our refund policy carefully before proceeding with cancellation.
                </p>
              </div>

              <div className="space-y-3 text-sm text-gray-600">
                <div className="border-b border-gray-200 pb-3">
                  <h4 className="font-medium text-gray-900 mb-1 text-sm">Cancellation Timeframe</h4>
                  <ul className="list-disc list-inside space-y-1">
                    <li>48+ hours before booking: Full refund</li>
                    <li>24-48 hours before booking: 50% refund</li>
                    <li>Less than 24 hours: No refund available</li>
                  </ul>
                </div>

                <div className="border-b border-gray-200 pb-3">
                  <h4 className="font-medium text-gray-900 mb-1 text-sm">Refund Processing</h4>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Refunds are processed within 5-7 business days</li>
                    <li>Refunds will be issued to the original payment method</li>
                    <li>A refund confirmation email will be sent upon processing</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-medium text-gray-900 mb-1 text-sm">Special Circumstances</h4>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Weather-related cancellations may be eligible for rescheduling</li>
                    <li>Medical emergencies require documentation for full refund</li>
                    <li>Group bookings (10+ people) have different cancellation terms</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button
                onClick={() => setShowRefundPolicy(false)}
                className="flex-1 px-3 py-2 text-sm border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition"
              >
                Go Back
              </button>
              <button
                onClick={proceedWithCancellation}
                className="flex-1 px-3 py-2 text-sm bg-blue-800 text-white font-medium hover:bg-blue-900 transition"
              >
                I Understand, Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Booking Modal */}
      {showCancelModal && selectedBooking && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-backdrop-fade" onClick={() => setShowCancelModal(false)}>
          <div className="bg-white max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Cancel Booking</h3>
              <p className="text-gray-600 mt-1 text-sm">Are you sure you want to cancel this booking?</p>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-red-50 border border-red-200 p-4">
                <div className="flex items-center gap-2">
                  <AlertCircle size={20} className="text-red-600" />
                  <span className="font-semibold text-red-800">Cancellation Warning</span>
                </div>
                <p className="text-red-700 text-sm mt-1">
                  This action cannot be undone. Refund eligibility depends on cancellation time.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Reason for cancellation *
                </label>
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Please provide a reason for cancellation..."
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-800 focus:border-blue-800"
                  required
                />
              </div>

              <div className="bg-gray-50 p-3 text-sm text-gray-600">
                <p><strong>Reference:</strong> {selectedBooking.reference_number}</p>
                <p><strong>Package:</strong> {getPackageName(selectedBooking)}</p>
                <p><strong>Location:</strong> {getLocationName(selectedBooking)}</p>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button
                onClick={() => setShowCancelModal(false)}
                className="flex-1 px-3 py-2 text-sm border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition"
              >
                Keep Booking
              </button>
              <button
                onClick={confirmCancellation}
                disabled={!cancelReason.trim()}
                className="flex-1 px-3 py-2 text-sm bg-red-600 text-white font-medium hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Confirm Cancellation
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default CustomerReservations;
