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
  ArrowUpDown
} from 'lucide-react';
import QRCodeLib from 'qrcode';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import type { Reservation, SortBy, SortOrder } from '../../types/customer';

const CustomerReservations = () => {
  const [allReservations, setAllReservations] = useState<Reservation[]>([]);
  const [filteredReservations, setFilteredReservations] = useState<Reservation[]>([]);
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showRefundPolicy, setShowRefundPolicy] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [expandedReservation, setExpandedReservation] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);

  // Sample reservations data
  const sampleReservations: Reservation[] = [
    {
      id: '1',
      referenceNumber: 'ZAP-2024-001',
      package: {
        id: '1',
        name: 'Birthday Bash Package',
        price: 299,
        duration: '2 hours',
        participants: 'Up to 10 guests',
        includes: ['Unlimited Attractions', 'Private Party Room', 'Dedicated Host', 'Birthday Cake', 'Decorations']
      },
      location: 'Brighton',
      bookingDate: '2024-12-25',
      bookingTime: '14:00',
      status: 'confirmed',
      paymentId: 'pay_123456789',
      totalAmount: 299,
      participantsCount: 8,
      specialRequests: 'Please include a chocolate birthday cake',
      createdAt: '2024-12-15T10:30:00Z'
    },
    {
      id: '2',
      referenceNumber: 'ZAP-2024-002',
      package: {
        id: '2',
        name: 'Family Fun Package',
        price: 149,
        duration: '2 hours',
        participants: 'Up to 6 family members',
        includes: ['Mixed Attractions', 'Meal Vouchers', 'Photo Package', 'Priority Access']
      },
      location: 'Canton',
      bookingDate: '2024-12-20',
      bookingTime: '16:00',
      status: 'pending',
      paymentId: 'pay_123456790',
      totalAmount: 149,
      participantsCount: 4,
      createdAt: '2024-12-16T14:20:00Z'
    },
    {
      id: '3',
      referenceNumber: 'ZAP-2024-003',
      package: {
        id: '3',
        name: 'Corporate Team Building',
        price: 499,
        duration: '3 hours',
        participants: 'Up to 20 employees',
        includes: ['Team Building Activities', 'Meeting Space', 'Catering Options', 'Dedicated Coordinator']
      },
      location: 'Sterling Heights',
      bookingDate: '2024-12-18',
      bookingTime: '10:00',
      status: 'cancelled',
      paymentId: 'pay_123456791',
      totalAmount: 499,
      participantsCount: 15,
      createdAt: '2024-12-10T09:15:00Z'
    }
  ];

  useEffect(() => {
    // In a real app, this would fetch from an API
    setAllReservations(sampleReservations);
    setFilteredReservations(sampleReservations);
  }, []);

  // Filter, sort, and paginate reservations
  useEffect(() => {
    const filtered = allReservations.filter(reservation => 
      reservation.package.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      reservation.referenceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      reservation.location.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Sort reservations
    filtered.sort((a, b) => {
      let aValue: string | number;
      let bValue: string | number;

      switch (sortBy) {
        case 'date':
          aValue = new Date(a.bookingDate).getTime();
          bValue = new Date(b.bookingDate).getTime();
          break;
        case 'status':
          aValue = a.status;
          bValue = b.status;
          break;
        case 'amount':
          aValue = a.totalAmount;
          bValue = b.totalAmount;
          break;
        default:
          aValue = a.bookingDate;
          bValue = b.bookingDate;
      }

      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    // Pagination
    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    let page = currentPage;
    if (page > totalPages) page = totalPages;
    const startIdx = (page - 1) * pageSize;
    const endIdx = startIdx + pageSize;
    setFilteredReservations(filtered.slice(startIdx, endIdx));
  }, [allReservations, searchTerm, sortBy, sortOrder, currentPage, pageSize]);

  const handleViewDetails = (reservation: Reservation) => {
    setSelectedReservation(reservation);
    setShowDetailsModal(true);
  };

  const handleDownloadReceipt = async (reservation: Reservation) => {
    try {
      const receiptElement = document.createElement('div');
      receiptElement.innerHTML = generateReceiptContent(reservation);
      receiptElement.style.width = '800px';
      receiptElement.style.padding = '20px';
      receiptElement.style.backgroundColor = 'white';
      
      document.body.appendChild(receiptElement);
      
      const canvas = await html2canvas(receiptElement, {
        backgroundColor: 'white',
        scale: 2
      });
      
      document.body.removeChild(receiptElement);
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF();
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
      
      pdf.save(`receipt-${reservation.referenceNumber}.pdf`);
    } catch (error) {
      console.error('Error generating receipt:', error);
    }
  };

  const handleDownloadQRCode = async (reservation: Reservation) => {
    try {
      const qrData = {
        type: 'reservation',
        id: reservation.id,
        reference: reservation.referenceNumber,
        package: reservation.package.name,
        location: reservation.location,
        date: reservation.bookingDate,
        time: reservation.bookingTime,
        participants: reservation.participantsCount
      };
      
      const qrCodeDataURL = await QRCodeLib.toDataURL(JSON.stringify(qrData), {
        width: 512,
        margin: 2,
        color: {
          dark: '#1e40af',
          light: '#ffffff'
        }
      });
      
      const link = document.createElement('a');
      link.download = `qrcode-${reservation.referenceNumber}.png`;
      link.href = qrCodeDataURL;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error generating QR code:', error);
    }
  };

  const handleCancelReservation = (reservation: Reservation) => {
    setSelectedReservation(reservation);
    setShowRefundPolicy(true);
  };

  const proceedWithCancellation = () => {
    setShowRefundPolicy(false);
    setShowCancelModal(true);
  };

  const confirmCancellation = () => {
    if (selectedReservation && cancelReason.trim()) {
      // Update reservation status to cancelled
      const updatedReservations = allReservations.map((res: Reservation) => 
        res.id === selectedReservation.id 
          ? { ...res, status: 'cancelled' as const }
          : res
      );
      setAllReservations(updatedReservations);
      
      // In real app, send cancellation request to API
      console.log('Cancellation request:', {
        reservationId: selectedReservation.id,
        reason: cancelReason
      });

      setShowCancelModal(false);
      setCancelReason('');
      setSelectedReservation(null);
    }
  };

  const generateReceiptContent = (reservation: Reservation) => {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; border-bottom: 2px solid #1e40af; padding-bottom: 20px; margin-bottom: 20px;">
          <h1 style="color: #1e40af; margin: 0;">ZapZone</h1>
          <p style="color: #6b7280; margin: 5px 0;">Entertainment Center</p>
        </div>
        
        <div style="margin-bottom: 20px;">
          <h2 style="color: #1e40af; border-bottom: 1px solid #e5e7eb; padding-bottom: 10px;">Booking Receipt</h2>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <div>
              <strong>Reference Number:</strong><br>
              ${reservation.referenceNumber}
            </div>
            <div>
              <strong>Booking Date:</strong><br>
              ${new Date(reservation.createdAt).toLocaleDateString()}
            </div>
            <div>
              <strong>Payment ID:</strong><br>
              ${reservation.paymentId}
            </div>
            <div>
              <strong>Status:</strong><br>
              <span style="text-transform: capitalize; color: ${
                reservation.status === 'confirmed' ? '#059669' : 
                reservation.status === 'pending' ? '#d97706' : 
                '#dc2626'
              };">${reservation.status}</span>
            </div>
          </div>
        </div>

        <div style="margin-bottom: 20px;">
          <h3 style="color: #374151;">Package Details</h3>
          <div style="background: #f8fafc; padding: 15px; border-radius: 0;">
            <h4 style="margin: 0 0 10px 0; color: #1e40af;">${reservation.package.name}</h4>
            <p style="margin: 5px 0;"><strong>Location:</strong> ${reservation.location}</p>
            <p style="margin: 5px 0;"><strong>Date & Time:</strong> ${reservation.bookingDate} at ${reservation.bookingTime}</p>
            <p style="margin: 5px 0;"><strong>Duration:</strong> ${reservation.package.duration}</p>
            <p style="margin: 5px 0;"><strong>Participants:</strong> ${reservation.participantsCount} people</p>
          </div>
        </div>

        <div style="margin-bottom: 20px;">
          <h3 style="color: #374151;">Inclusions</h3>
          <ul style="margin: 0; padding-left: 20px;">
            ${reservation.package.includes.map(item => `<li>${item}</li>`).join('')}
          </ul>
        </div>

        ${reservation.specialRequests ? `
        <div style="margin-bottom: 20px;">
          <h3 style="color: #374151;">Special Requests</h3>
          <p style="background: #f0f9ff; padding: 10px; border-left: 4px solid #1e40af; margin: 0;">
            ${reservation.specialRequests}
          </p>
        </div>
        ` : ''}

        <div style="border-top: 2px solid #1e40af; padding-top: 20px; text-align: right;">
          <h2 style="color: #1e40af; margin: 0;">Total: $${reservation.totalAmount}</h2>
          <p style="color: #6b7280; margin: 5px 0;">Thank you for choosing ZapZone!</p>
        </div>

        <div style="margin-top: 30px; text-align: center; color: #6b7280; font-size: 12px;">
          <p>For any questions, contact us at info@zapzone.com or (555) 123-4567</p>
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
      case 'refunded': return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
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

          {/* Reservations List */}
          <div className="space-y-4">
            {filteredReservations.length === 0 ? (
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
              filteredReservations.map((reservation: Reservation) => (
                <div key={reservation.id} className="bg-white border border-gray-200">
                  {/* Reservation Header */}
                  <div className="p-6">
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-4 mb-2">
                          <h3 className="text-base font-medium text-gray-900">
                            {reservation.package.name}
                          </h3>
                          <span className={`px-2 py-0.5 text-xs font-medium border ${getStatusColor(reservation.status)}`}>
                            {reservation.status.charAt(0).toUpperCase() + reservation.status.slice(1)}
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
                          <div className="flex items-center gap-2">
                            <MapPin size={16} className="text-blue-800" />
                            <span>{reservation.location}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Calendar size={16} className="text-blue-800" />
                            <span>{reservation.bookingDate} at {reservation.bookingTime}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Users size={16} className="text-blue-800" />
                            <span>{reservation.participantsCount} participants</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row gap-2">
                        <button
                          onClick={() => handleViewDetails(reservation)}
                          className="flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-300 text-gray-700 hover:bg-gray-50 transition font-medium"
                        >
                          <Eye size={14} />
                          View Details
                        </button>
                        
                        {reservation.status === 'confirmed' && (
                          <button
                            onClick={() => handleCancelReservation(reservation)}
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
                      onClick={() => toggleReservationExpand(reservation.id)}
                      className="w-full mt-4 flex items-center justify-between p-2 bg-gray-50 hover:bg-gray-100 transition text-sm"
                    >
                      <span className="font-medium text-gray-700">Quick Actions & Details</span>
                      {expandedReservation === reservation.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                  </div>

                  {/* Expanded Content */}
                  {expandedReservation === reservation.id && (
                    <div className="border-t border-gray-200 p-6 bg-gray-50">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <h4 className="font-medium text-gray-900 mb-2 text-sm">Booking Information</h4>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-gray-600">Reference Number:</span>
                              <span className="font-medium">{reservation.referenceNumber}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Payment ID:</span>
                              <span className="font-medium">{reservation.paymentId}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Total Amount:</span>
                              <span className="font-medium text-green-600">${reservation.totalAmount}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Booked On:</span>
                              <span className="font-medium">{new Date(reservation.createdAt).toLocaleDateString()}</span>
                            </div>
                          </div>
                        </div>

                        <div>
                          <h4 className="font-medium text-gray-900 mb-2 text-sm">Downloads</h4>
                          <div className="flex flex-col gap-2">
                            <button
                              onClick={() => handleDownloadReceipt(reservation)}
                              className="flex items-center gap-1 px-3 py-1.5 text-sm bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 transition font-medium"
                            >
                              <FileText size={14} />
                              Download Receipt
                            </button>
                            <button
                              onClick={() => handleDownloadQRCode(reservation)}
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

          {/* Pagination Controls */}
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
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-2 py-1 text-sm border border-gray-300 rounded disabled:opacity-50"
              >
                Prev
              </button>
              <span className="text-sm text-gray-700">Page {currentPage}</span>
              <button
                onClick={() => setCurrentPage(p => p + 1)}
                disabled={filteredReservations.length < pageSize}
                className="px-2 py-1 text-sm border border-gray-300 rounded disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Reservation Details Modal */}
      {showDetailsModal && selectedReservation && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Reservation Details</h3>
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
              <div>
                <h4 className="font-medium text-gray-900 mb-2 text-sm">Package Information</h4>
                <div className="bg-gray-50 p-4 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Package:</span>
                    <span className="font-medium">{selectedReservation.package.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Duration:</span>
                    <span className="font-medium">{selectedReservation.package.duration}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Max Participants:</span>
                    <span className="font-medium">{selectedReservation.package.participants}</span>
                  </div>
                </div>
              </div>

              {/* Booking Details */}
              <div>
                <h4 className="font-medium text-gray-900 mb-2 text-sm">Booking Details</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <MapPin size={16} className="text-blue-800" />
                    <span><strong>Location:</strong> {selectedReservation.location}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar size={16} className="text-blue-800" />
                    <span><strong>Date:</strong> {selectedReservation.bookingDate}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock size={16} className="text-blue-800" />
                    <span><strong>Time:</strong> {selectedReservation.bookingTime}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users size={16} className="text-blue-800" />
                    <span><strong>Participants:</strong> {selectedReservation.participantsCount}</span>
                  </div>
                </div>
              </div>

              {/* Inclusions */}
              <div>
                <h4 className="font-medium text-gray-900 mb-2 text-sm">Package Inclusions</h4>
                <ul className="space-y-2">
                  {selectedReservation.package.includes.map((item, index) => (
                    <li key={index} className="flex items-center gap-2">
                      <CheckCircle size={16} className="text-green-500" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Payment Information */}
              <div>
                <h4 className="font-medium text-gray-900 mb-2 text-sm">Payment Information</h4>
                <div className="bg-gray-50 p-4 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Reference Number:</span>
                    <span className="font-medium">{selectedReservation.referenceNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Payment ID:</span>
                    <span className="font-medium">{selectedReservation.paymentId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total Amount:</span>
                    <span className="font-medium text-green-600">${selectedReservation.totalAmount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Status:</span>
                    <span className={`px-2 py-1 text-sm font-medium ${getStatusColor(selectedReservation.status)}`}>
                      {selectedReservation.status.charAt(0).toUpperCase() + selectedReservation.status.slice(1)}
                    </span>
                  </div>
                </div>
              </div>

              {selectedReservation.specialRequests && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-2 text-sm">Special Requests</h4>
                  <p className="bg-blue-50 p-4 border-l-4 border-blue-800">
                    {selectedReservation.specialRequests}
                  </p>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button
                onClick={() => handleDownloadReceipt(selectedReservation)}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm bg-blue-800 text-white font-medium hover:bg-blue-900 transition"
              >
                <FileText size={16} />
                Download Receipt
              </button>
              <button
                onClick={() => handleDownloadQRCode(selectedReservation)}
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white max-w-2xl w-full max-h-[80vh] overflow-y-auto">
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

      {/* Cancel Reservation Modal */}
      {showCancelModal && selectedReservation && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white max-w-md w-full">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Cancel Reservation</h3>
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
                <p><strong>Reference:</strong> {selectedReservation.referenceNumber}</p>
                <p><strong>Package:</strong> {selectedReservation.package.name}</p>
                <p><strong>Location:</strong> {selectedReservation.location}</p>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button
                onClick={() => setShowCancelModal(false)}
                className="flex-1 px-3 py-2 text-sm border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition"
              >
                Keep Reservation
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