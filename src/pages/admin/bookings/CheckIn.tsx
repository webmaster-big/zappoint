// src/pages/checkin/CheckIn.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { 
  Camera, 
  CheckCircle, 
  XCircle, 
  Upload,
  RefreshCw,
  User,
  Ticket,
  Calendar,
  DollarSign,
  AlertCircle,
  Smartphone,
  X,
  Search,
  Clock,
  Users,
  Package as PackageIcon,
  Eye,
  Home
} from 'lucide-react';
import { useThemeColor } from '../../../hooks/useThemeColor';
import bookingService, { type Booking } from '../../../services/bookingService';
import { createPayment } from '../../../services/PaymentService';
import Toast from '../../../components/ui/Toast';
import { getStoredUser } from '../../../utils/storage';

interface ScanResult {
  bookingId: number;
  booking: Booking;
  success: boolean;
  message: string;
}

const CheckIn: React.FC = () => {
  const { themeColor, fullColor } = useThemeColor();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [filteredBookings, setFilteredBookings] = useState<Booking[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [processing, setProcessing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [verifiedBooking, setVerifiedBooking] = useState<Booking | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedBookingForPayment, setSelectedBookingForPayment] = useState<Booking | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'cash'>('cash');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [processingPayment, setProcessingPayment] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  // Load bookings function
  const loadBookings = useCallback(async () => {
    try {
      setLoading(true);
      const response = await bookingService.getBookings({
        booking_date: selectedDate,
        per_page: 100,
        user_id: getStoredUser()?.id,
      });
      
      if (response.success && response.data) {
        setBookings(response.data.bookings);
      }
    } catch (error) {
      console.error('Error loading bookings:', error);
      setToast({ message: 'Failed to load bookings', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  // Load bookings from API
  useEffect(() => {
    loadBookings();
  }, [loadBookings]);

  // Filter bookings based on search term
  useEffect(() => {
    // Start with all bookings that match confirmed or checked-in status
    let result = bookings.filter(booking => 
      booking.status === 'confirmed' || booking.status === 'checked-in'
    );

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(booking =>
        booking.guest_name?.toLowerCase().includes(term) ||
        booking.guest_email?.toLowerCase().includes(term) ||
        booking.guest_phone?.includes(term) ||
        booking.reference_number.toLowerCase().includes(term) ||
        booking.package?.name?.toLowerCase().includes(term)
      );
    }

    console.log('Filtered bookings:', result);
    console.log('Selected date:', selectedDate);

    setFilteredBookings(result);
  }, [bookings, searchTerm, selectedDate]);

  // Start scanning
  const startScanning = async () => {
    try {
      setError(null);
      setScanResult(null);
      setShowVerificationModal(false);
      
      // Stop any existing scanner first
      if (scannerRef.current) {
        try {
          const state = await scannerRef.current.getState();
          if (state === 2) { // 2 = SCANNING state
            await scannerRef.current.stop();
          }
          await scannerRef.current.clear();
        } catch (err) {
          console.log('Scanner cleanup:', err);
        }
      }
      
      // Create new scanner instance
      scannerRef.current = new Html5Qrcode('qr-reader');

      const config = {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
      };

      // Set scanning true before starting
      setScanning(true);

      // Use environment camera (back camera on mobile)
      await scannerRef.current.start(
        { facingMode: "environment" },
        config,
        onScanSuccess,
        onScanFailure
      );

    } catch (err) {
      console.error('Error starting scanner:', err);
      setError('Failed to start camera. Please check permissions and try again. Note: Mobile devices work better for scanning.');
      setToast({ message: 'Camera error - Try using a mobile device', type: 'error' });
      setScanning(false);
    }
  };

  // Stop scanning
  const stopScanning = async () => {
    if (scannerRef.current) {
      try {
        const state = await scannerRef.current.getState();
        if (state === 2) { // 2 = SCANNING state
          await scannerRef.current.stop();
        }
        await scannerRef.current.clear();
      } catch (err) {
        console.log('Scanner already stopped or error:', err);
        // Force clear if there's an error
        try {
          if (scannerRef.current) {
            await scannerRef.current.clear();
          }
        } catch (clearErr) {
          console.log('Force clear error:', clearErr);
        }
      } finally {
        setScanning(false);
      }
    } else {
      setScanning(false);
    }
  };

  // Handle successful scan
  const onScanSuccess = async (decodedText: string) => {
    if (processing) return;

    setProcessing(true);
    
    try {
      // Stop scanning while processing
      await stopScanning();

      // Parse QR code data - now expecting reference number as plain text
      let referenceNumber: string;
      let bookingId: number | undefined;
      
      try {
        // Try to parse as JSON first (for backward compatibility)
        const qrData = JSON.parse(decodedText);
        bookingId = qrData.bookingId || qrData.booking_id || qrData.id;
        referenceNumber = qrData.reference_number || qrData.referenceNumber;
      } catch {
        // Not JSON, treat the entire decoded text as reference number
        referenceNumber = decodedText.trim();
        console.log('Scanned reference number:', referenceNumber);
      }

      // Find booking by reference number first (primary method)
      let booking: Booking | undefined;
      
      if (referenceNumber) {
        // Search in current bookings by reference number
        booking = bookings.find(b => b.reference_number === referenceNumber);
        
        // If not found in current bookings, try API search
        if (!booking) {
          try {
            const searchResponse = await bookingService.getBookings({reference_number: referenceNumber});
            if (searchResponse.success && searchResponse.data && searchResponse.data.bookings.length > 0) {
              booking = searchResponse.data.bookings[0];
            }
          } catch (error) {
            console.error('Error searching by reference number:', error);
          }
        }
      } else if (bookingId) {
        // Fallback: Fetch booking by ID
        const response = await bookingService.getBookingById(bookingId);
        if (response.success) {
          booking = response.data;
        }
      }

      if (!booking) {
        setToast({ message: `Invalid QR code - Booking "${referenceNumber}" not found`, type: 'error' });
        setProcessing(false);
        await startScanning();
        return;
      }

      // Check if already checked in
      if (booking.status === 'checked-in') {
        setScanResult({
          bookingId: booking.id,
          booking,
          success: false,
          message: 'This booking has already been checked in'
        });
        setVerifiedBooking(booking);
        setShowVerificationModal(true);
        setToast({ message: 'Already checked in', type: 'error' });
        return;
      }

      // Check if completed
      if (booking.status === 'completed') {
        setScanResult({
          bookingId: booking.id,
          booking,
          success: false,
          message: 'This booking has been completed'
        });
        setVerifiedBooking(booking);
        setShowVerificationModal(true);
        setToast({ message: 'Booking completed', type: 'error' });
        return;
      }

      // Check if cancelled
      if (booking.status === 'cancelled') {
        setScanResult({
          bookingId: booking.id,
          booking,
          success: false,
          message: 'This booking has been cancelled'
        });
        setVerifiedBooking(booking);
        setShowVerificationModal(true);
        setToast({ message: 'Booking cancelled', type: 'error' });
        return;
      }

      // Show modal for confirmation before check-in
      setVerifiedBooking(booking);
      setShowVerificationModal(true);
      setToast({ message: 'Booking verified - Please confirm check-in', type: 'info' });

    } catch (err) {
      console.error('Error processing scan:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to process QR code';
      setToast({ message: errorMessage, type: 'error' });
      await startScanning();
    } finally {
      setProcessing(false);
    }
  };

  // Handle scan failure (ignore - just means no QR detected)
  const onScanFailure = () => {
    // Silently ignore - this fires constantly when no QR is detected
  };

  // Scan from image file
  const scanFromFile = async (file: File) => {
    try {
      setProcessing(true);
      setError(null);
      setScanResult(null);

      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode('qr-reader');
      }

      const result = await scannerRef.current.scanFile(file, false);
      await onScanSuccess(result);
      
    } catch (err) {
      console.error('Error scanning file:', err);
      setError('Failed to scan QR code from image. Please try another image.');
      setToast({ message: 'Failed to scan image', type: 'error' });
    } finally {
      setProcessing(false);
    }
  };

  // Handle file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      scanFromFile(file);
    }
  };

  // Handle check-in confirmation
  const handleConfirmCheckIn = async () => {
    if (!verifiedBooking) return;

    try {
      setProcessing(true);
      const userId = getStoredUser()?.id;
      const checkInResponse = await bookingService.checkInBooking(verifiedBooking.reference_number, userId);
      
      if (checkInResponse.success) {
        setScanResult({
          bookingId: verifiedBooking.id,
          booking: checkInResponse.data,
          success: true,
          message: 'Check-in successful!'
        });
        setToast({ message: 'Check-in successful!', type: 'success' });
        setShowVerificationModal(false);
        setVerifiedBooking(null);
        // Reload bookings
        loadBookings();
      } else {
        setToast({ message: 'Check-in failed. Please try again.', type: 'error' });
      }
    } catch (err) {
      console.error('Error checking in:', err);
      setToast({ message: 'Failed to check in booking', type: 'error' });
    } finally {
      setProcessing(false);
    }
  };

  // Handle cancel/close modal
  const handleCancelCheckIn = () => {
    setShowVerificationModal(false);
    setVerifiedBooking(null);
  };

  const handleCheckIn = async (booking: Booking) => {
    try {
      setProcessing(true);
      const userId = getStoredUser()?.id;
      const response = await bookingService.checkInBooking(booking.reference_number, userId);
      
      if (response.success) {
        setToast({ message: 'Check-in successful!', type: 'success' });
        // Reload bookings
        loadBookings();
      } else {
        setToast({ message: 'Check-in failed. Please try again.', type: 'error' });
      }
    } catch (err) {
      console.error('Error checking in:', err);
      setToast({ message: 'Failed to check in booking', type: 'error' });
    } finally {
      setProcessing(false);
    }
  };

  const viewDetails = (booking: Booking) => {
    setSelectedBooking(booking);
    setShowDetailsModal(true);
  };

  const closeModal = () => {
    setShowDetailsModal(false);
    setSelectedBooking(null);
  };

  const resetScan = () => {
    setScanResult(null);
    setError(null);
  };

  // Payment modal handlers
  const handleOpenPaymentModal = (booking: Booking) => {
    setSelectedBookingForPayment(booking);
    const remainingAmount = Math.max(0, Number(booking.total_amount) - Number(booking.amount_paid || 0));
    setPaymentAmount((Math.floor(remainingAmount * 100) / 100).toFixed(2));
    setPaymentMethod('cash');
    setPaymentNotes('');
    setShowPaymentModal(true);
    setShowVerificationModal(false); // Close verification modal
  };

  const handleClosePaymentModal = () => {
    setShowPaymentModal(false);
    setSelectedBookingForPayment(null);
    setPaymentAmount('');
    setPaymentMethod('cash');
    setPaymentNotes('');
  };

  const handleSubmitPayment = async () => {
    if (!selectedBookingForPayment) return;
    
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      setToast({ message: 'Please enter a valid payment amount', type: 'error' });
      return;
    }

    const remainingAmount = Math.round((Number(selectedBookingForPayment.total_amount) - Number(selectedBookingForPayment.amount_paid || 0)) * 100) / 100;
    const roundedAmount = Math.round(amount * 100) / 100;
    
    if (roundedAmount > remainingAmount + 0.01) {
      setToast({ message: `Payment amount cannot exceed remaining balance of $${remainingAmount.toFixed(2)}`, type: 'error' });
      return;
    }

    try {
      setProcessingPayment(true);

      // Get booking details to find customer_id and location_id
      const bookingResponse = await bookingService.getBookingById(selectedBookingForPayment.id);
      if (!bookingResponse.success || !bookingResponse.data) {
        throw new Error('Failed to get booking details');
      }

      const booking = bookingResponse.data;
      const customerId = booking.customer_id || null;
      const locationId = booking.location_id;

      if (!locationId) {
        throw new Error('Location ID not found for this booking');
      }

      // Create payment record using PaymentService
      const paymentResponse = await createPayment({
        booking_id: selectedBookingForPayment.id,
        customer_id: customerId,
        location_id: locationId,
        amount: amount,
        currency: 'USD',
        method: paymentMethod,
        status: 'completed',
        notes: paymentNotes || `Payment for booking ${selectedBookingForPayment.reference_number}`,
      });

      if (!paymentResponse.success) {
        throw new Error(paymentResponse.message || 'Failed to create payment');
      }

      // Update booking's amount_paid and status
      const newAmountPaid = Number(selectedBookingForPayment.amount_paid || 0) + amount;
      const newPaymentStatus = newAmountPaid >= Number(selectedBookingForPayment.total_amount) ? 'paid' : 'partial';

      await bookingService.updateBooking(selectedBookingForPayment.id, {
        amount_paid: newAmountPaid,
        payment_status: newPaymentStatus,
        status: 'confirmed', // Set status to confirmed when payment is made
      });

      setToast({ message: 'Payment processed successfully!', type: 'success' });
      handleClosePaymentModal();
      
      // Reload bookings
      await loadBookings();
      
      // Reopen verification modal with updated booking if it was from there
      if (verifiedBooking && verifiedBooking.id === selectedBookingForPayment.id) {
        const updatedBookingResponse = await bookingService.getBookingById(selectedBookingForPayment.id);
        if (updatedBookingResponse.success) {
          setVerifiedBooking(updatedBookingResponse.data);
          setShowVerificationModal(true);
        }
      }
    } catch (error) {
      console.error('Error processing payment:', error);
      setToast({ message: 'Failed to process payment. Please try again.', type: 'error' });
    } finally {
      setProcessingPayment(false);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    // Handle navigation/page unload while scanning
    const handleBeforeUnload = () => {
      if (scannerRef.current) {
        try {
          scannerRef.current.stop();
          scannerRef.current.clear();
        } catch (err) {
          console.log('Unload cleanup error:', err);
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      
      // Cleanup scanner on unmount/navigation
      const cleanup = async () => {
        if (scannerRef.current) {
          try {
            const state = await scannerRef.current.getState();
            if (state === 2) { // SCANNING state
              await scannerRef.current.stop();
            }
            await scannerRef.current.clear();
            scannerRef.current = null;
          } catch (err) {
            console.log('Cleanup:', err);
            // Force clear even if there's an error
            try {
              if (scannerRef.current) {
                await scannerRef.current.clear();
                scannerRef.current = null;
              }
            } catch (clearErr) {
              console.log('Force clear error:', clearErr);
            }
          }
        }
      };
      
      cleanup();
    };
  }, []); // Empty dependency array - only cleanup on unmount

  const formatTime = (timeString: string) => {
    return timeString; // Assuming time is already in a readable format
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Camera className="h-6 w-6" />
            Package Booking Check-In
          </h1>
          <p className="text-gray-600 mt-1">Scan QR codes or manually check in customers for their package bookings</p>
          
          {/* Mobile Device Recommendation */}
          <div className="mt-3 flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <Smartphone className="h-5 w-5 text-blue-600 flex-shrink-0" />
            <p className="text-sm text-blue-800">
              <strong>Tip:</strong> For best scanning experience, use a mobile device or tablet with a rear camera
            </p>
          </div>
        </div>

        {/* Scanner Section */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          {/* QR Scanner Container */}
          <div className="relative">
            <div 
              id="qr-reader"
              className={`mx-auto rounded-lg overflow-hidden ${scanning ? 'block' : 'hidden'}`}
              style={{ maxWidth: '500px' }}
            ></div>

            {/* Scanner Placeholder */}
            {!scanning && !scanResult && (
              <div className="flex flex-col items-center justify-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                <Camera className="h-16 w-16 text-gray-400 mb-4" />
                <p className="text-gray-600 mb-2">Ready to scan QR codes</p>
                <p className="text-sm text-gray-500 mb-6 flex items-center gap-1">
                  <Smartphone className="h-4 w-4" />
                  Works best on mobile devices
                </p>
                
                <div className="flex flex-col sm:flex-row gap-4">
                  <button
                    onClick={startScanning}
                    disabled={processing}
                    className={`px-6 py-3 bg-${themeColor}-600 text-white rounded-lg hover:bg-${themeColor}-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed`}
                    title="Start camera to scan QR codes in real-time"
                  >
                    <Camera className="h-5 w-5" />
                    Start Camera
                  </button>

                  <label className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors flex items-center gap-2 cursor-pointer" title="Upload a QR code image from your device">
                    <Upload className="h-5 w-5" />
                    Upload Image
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileUpload}
                      className="hidden"
                      disabled={processing}
                    />
                  </label>
                </div>
              </div>
            )}

            {/* Processing Indicator */}
            {processing && !scanning && (
              <div className="flex flex-col items-center justify-center py-12">
                <RefreshCw className={`h-12 w-12 text-${themeColor}-600 animate-spin mb-4`} />
                <p className="text-gray-600">Processing QR code...</p>
              </div>
            )}
          </div>

          {/* Scanner Controls */}
          {scanning && !processing && (
            <div className="mt-4 flex justify-center">
              <button
                onClick={stopScanning}
                className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Stop Camera
              </button>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-800">Error</p>
                <p className="text-sm text-red-600">{error}</p>
              </div>
            </div>
          )}
        </div>

        {/* Search and Filters */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-800 mb-2">
                <Calendar className="inline mr-2 h-4 w-4" />
                Date
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className={`w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-${themeColor}-400`}
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-800 mb-2">
                <Search className="inline mr-2 h-4 w-4" />
                Search Bookings
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search by name, email, phone, reference, or package..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={`w-full border border-gray-300 rounded-lg pl-10 pr-4 py-2 focus:ring-2 focus:ring-${themeColor}-400`}
                />
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Bookings Table */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className={`h-8 w-8 text-${themeColor}-600 animate-spin`} />
              <span className="ml-3 text-gray-600">Loading bookings...</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Reference / Customer
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Package
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Time
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Participants
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredBookings.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                        No bookings found for selected date
                      </td>
                    </tr>
                  ) : (
                    filteredBookings.map((booking) => (
                      <tr key={booking.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-xs font-medium text-gray-500">#{booking.reference_number}</div>
                          <div className="text-sm font-medium text-gray-900">{booking.guest_name || 'Guest'}</div>
                          <div className="text-xs text-gray-500">Email: {booking.guest_email || 'N/A'}</div>
                          <div className="text-xs text-gray-500">Phone: {booking.guest_phone || 'N/A'}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{booking.package?.name || 'N/A'}</div>
                          <div className="text-xs text-gray-500">
                            ${Number(booking.total_amount).toFixed(2)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{formatTime(booking.booking_time)}</div>
                          <div className="text-xs text-gray-500">{booking.duration} {booking.duration_unit}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {booking.participants}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                            booking.status === 'confirmed' 
                              ? 'bg-yellow-100 text-yellow-800' 
                              : booking.status === 'checked-in'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {booking.status === 'checked-in' ? 'Checked In' : booking.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex items-center space-x-2">
                            {booking.status === 'confirmed' && (
                              <button
                                onClick={() => handleCheckIn(booking)}
                                disabled={processing}
                                className="text-green-600 hover:text-green-800 flex items-center disabled:opacity-50"
                                title="Check In"
                              >
                                <CheckCircle className="h-5 w-5 mr-1" />
                                Check In
                              </button>
                            )}
                            <button
                              onClick={() => viewDetails(booking)}
                              className={`text-${themeColor}-600 hover:text-${fullColor} flex items-center`}
                              title="View Details"
                            >
                              <Eye className="h-5 w-5 mr-1" />
                              Details
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Verification Modal (before check-in) */}
        {showVerificationModal && verifiedBooking && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-2 sm:p-4 z-50" onClick={handleCancelCheckIn}>
            <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              {/* Modal Header */}
              <div className="sticky top-0 bg-white border-b border-gray-200 p-3 sm:p-6 flex items-center justify-between">
                <h2 className="text-base sm:text-xl font-bold text-gray-800">Verify Booking Details</h2>
                <button
                  onClick={handleCancelCheckIn}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="h-5 w-5 text-gray-600" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6">
                {/* Status Alerts */}
                {(() => {
                  console.log('Verified Booking Status:', verifiedBooking.status);
                  console.log('Verified Booking Payment Status:', verifiedBooking.payment_status);
                  console.log('Verified Booking Add-ons:', verifiedBooking.addOns || (verifiedBooking as any).add_ons);
                  return null;
                })()}
                
                {verifiedBooking.status === 'checked-in' && (
                  <div className="mb-3 sm:mb-6 p-2 sm:p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 sm:gap-3">
                    <XCircle className="h-4 w-4 sm:h-5 sm:w-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm sm:text-base font-semibold text-red-800">Already Checked In</p>
                      <p className="text-xs sm:text-sm text-red-600">This booking has already been checked in.</p>
                    </div>
                  </div>
                )}

                {verifiedBooking.status === 'completed' && (
                  <div className="mb-3 sm:mb-6 p-2 sm:p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 sm:gap-3">
                    <XCircle className="h-4 w-4 sm:h-5 sm:w-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm sm:text-base font-semibold text-red-800">Booking Completed</p>
                      <p className="text-xs sm:text-sm text-red-600">This booking has been completed.</p>
                    </div>
                  </div>
                )}

                {verifiedBooking.status === 'cancelled' && (
                  <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                    <XCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-red-800">Booking Cancelled</p>
                      <p className="text-sm text-red-600">This booking has been cancelled.</p>
                    </div>
                  </div>
                )}

                {verifiedBooking.status === 'confirmed' && (
                  <div className="mb-3 sm:mb-6 p-2 sm:p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-2 sm:gap-3">
                    <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm sm:text-base font-semibold text-green-800">Valid Booking</p>
                      <p className="text-xs sm:text-sm text-green-600">This booking is ready to be checked in.</p>
                    </div>
                  </div>
                )}

                {/* Booking Details */}
                <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
                  <h3 className="font-semibold text-gray-800 mb-4">Booking Information</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 bg-${themeColor}-100 rounded-lg`}>
                        <Ticket className={`h-5 w-5 text-${fullColor}`} />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Reference Number</p>
                        <p className="font-medium text-gray-800">#{verifiedBooking.reference_number}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className={`p-2 bg-${themeColor}-100 rounded-lg`}>
                        <User className={`h-5 w-5 text-${fullColor}`} />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Customer</p>
                        <p className="font-medium text-gray-800">{verifiedBooking.guest_name || 'Guest'}</p>
                      </div>
                    </div>

                    {verifiedBooking.package && (
                      <div className="flex items-center gap-3 col-span-full">
                        <div className={`p-2 bg-${themeColor}-100 rounded-lg`}>
                          <PackageIcon className={`h-5 w-5 text-${fullColor}`} />
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Package</p>
                          <p className="font-medium text-gray-800 text-lg">{verifiedBooking.package.name}</p>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-3">
                      <div className={`p-2 bg-${themeColor}-100 rounded-lg`}>
                        <Calendar className={`h-5 w-5 text-${fullColor}`} />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Date & Time</p>
                        <p className="font-medium text-gray-800">
                          {new Date(verifiedBooking.booking_date).toLocaleDateString()} at {verifiedBooking.booking_time}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className={`p-2 bg-${themeColor}-100 rounded-lg`}>
                        <Users className={`h-5 w-5 text-${fullColor}`} />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Participants</p>
                        <p className="font-medium text-gray-800">{verifiedBooking.participants}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className={`p-2 bg-${themeColor}-100 rounded-lg`}>
                        <Clock className={`h-5 w-5 text-${fullColor}`} />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Duration</p>
                        <p className="font-medium text-gray-800">{verifiedBooking.duration} {verifiedBooking.duration_unit}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className={`p-2 bg-${themeColor}-100 rounded-lg`}>
                        <DollarSign className={`h-5 w-5 text-${fullColor}`} />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Total Amount</p>
                        <p className="font-medium text-gray-800">${Number(verifiedBooking.total_amount).toFixed(2)}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className={`p-2 bg-${themeColor}-100 rounded-lg`}>
                        <DollarSign className={`h-5 w-5 text-${fullColor}`} />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Amount Paid</p>
                        <p className="font-medium text-gray-800">${Number(verifiedBooking.amount_paid).toFixed(2)}</p>
                      </div>
                    </div>

                    {verifiedBooking.discount_amount && Number(verifiedBooking.discount_amount) > 0 && (
                      <div className="flex items-center gap-3">
                        <div className={`p-2 bg-${themeColor}-100 rounded-lg`}>
                          <DollarSign className={`h-5 w-5 text-${fullColor}`} />
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Discount Amount</p>
                          <p className="font-medium text-gray-800">${Number(verifiedBooking.discount_amount).toFixed(2)}</p>
                        </div>
                      </div>
                    )}

                    {verifiedBooking.payment_method && (
                      <div className="flex items-center gap-3">
                        <div className={`p-2 bg-${themeColor}-100 rounded-lg`}>
                          <DollarSign className={`h-5 w-5 text-${fullColor}`} />
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Payment Method</p>
                          <p className="font-medium text-gray-800 capitalize">{verifiedBooking.payment_method}</p>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${
                        verifiedBooking.payment_status === 'paid'
                          ? 'bg-green-100' 
                          : verifiedBooking.payment_status === 'partial'
                          ? 'bg-yellow-100'
                          : 'bg-gray-100'
                      }`}>
                        <DollarSign className={`h-5 w-5 ${
                          verifiedBooking.payment_status === 'paid'
                            ? 'text-green-600' 
                            : verifiedBooking.payment_status === 'partial'
                            ? 'text-yellow-600'
                            : 'text-gray-600'
                        }`} />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Payment Status</p>
                        <p className={`font-semibold capitalize ${
                          verifiedBooking.payment_status === 'paid'
                            ? 'text-green-600' 
                            : verifiedBooking.payment_status === 'partial'
                            ? 'text-yellow-600'
                            : 'text-gray-600'
                        }`}>
                          {verifiedBooking.payment_status}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${
                        verifiedBooking.status === 'checked-in' || verifiedBooking.status === 'completed'
                          ? 'bg-green-100' 
                          : verifiedBooking.status === 'cancelled'
                          ? 'bg-red-100'
                          : 'bg-yellow-100'
                      }`}>
                        <CheckCircle className={`h-5 w-5 ${
                          verifiedBooking.status === 'checked-in' || verifiedBooking.status === 'completed'
                            ? 'text-green-600' 
                            : verifiedBooking.status === 'cancelled'
                            ? 'text-red-600'
                            : 'text-yellow-600'
                        }`} />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Booking Status</p>
                        <p className={`font-semibold capitalize ${
                          verifiedBooking.status === 'checked-in' || verifiedBooking.status === 'completed'
                            ? 'text-green-600' 
                            : verifiedBooking.status === 'cancelled'
                            ? 'text-red-600'
                            : 'text-yellow-600'
                        }`}>
                          {verifiedBooking.status}
                        </p>
                      </div>
                    </div>

                    {verifiedBooking.guest_email && (
                      <div className="flex items-center gap-3 col-span-full">
                        <div className={`p-2 bg-${themeColor}-100 rounded-lg`}>
                          <User className={`h-5 w-5 text-${fullColor}`} />
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Email</p>
                          <p className="font-medium text-gray-800">{verifiedBooking.guest_email}</p>
                        </div>
                      </div>
                    )}

                    {verifiedBooking.guest_phone && (
                      <div className="flex items-center gap-3 col-span-full">
                        <div className={`p-2 bg-${themeColor}-100 rounded-lg`}>
                          <Smartphone className={`h-5 w-5 text-${fullColor}`} />
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Phone</p>
                          <p className="font-medium text-gray-800">{verifiedBooking.guest_phone}</p>
                        </div>
                      </div>
                    )}

                    {(verifiedBooking.location && typeof verifiedBooking.location === 'object') ? (
                      <div className="flex items-center gap-3 col-span-full">
                        <div className={`p-2 bg-${themeColor}-100 rounded-lg`}>
                          <Home className={`h-5 w-5 text-${fullColor}`} />
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Location</p>
                          <p className="font-medium text-gray-800">{(verifiedBooking.location as Record<string, string>)?.name}</p>
                          {(verifiedBooking.location as Record<string, string>)?.address && (
                            <p className="text-xs text-gray-600">
                              {(verifiedBooking.location as Record<string, string>)?.address}, {(verifiedBooking.location as Record<string, string>)?.city}, {(verifiedBooking.location as Record<string, string>)?.state} {(verifiedBooking.location as Record<string, string>)?.zip_code}
                            </p>
                          )}
                        </div>
                      </div>
                    ) : null}

                    {(verifiedBooking.room && typeof verifiedBooking.room === 'object') ? (
                      <div className="flex items-center gap-3 col-span-full">
                        <div className={`p-2 bg-${themeColor}-100 rounded-lg`}>
                          <Home className={`h-5 w-5 text-${fullColor}`} />
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Space</p>
                          <p className="font-medium text-gray-800">{(verifiedBooking.room as { name: string })?.name || 'N/A'}</p>
                        </div>
                      </div>
                    ) : null}

                    

                    {verifiedBooking.attractions && Array.isArray(verifiedBooking.attractions) && verifiedBooking.attractions.length > 0 && (
                      <div className="flex items-start gap-3 col-span-full">
                        <div className={`p-2 bg-${themeColor}-100 rounded-lg`}>
                          <PackageIcon className={`h-5 w-5 text-${fullColor}`} />
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Attractions ({verifiedBooking.attractions.length})</p>
                          <div className="space-y-1 mt-1">
                            {(verifiedBooking.attractions as Record<string, unknown>[]).map((attraction, index: number) => (
                              <p key={index} className="font-medium text-gray-800">
                                • {attraction.name as string} - ${Number(attraction.price).toFixed(2)}
                              </p>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {((verifiedBooking.addOns || (verifiedBooking as any).add_ons) && Array.isArray(verifiedBooking.addOns || (verifiedBooking as any).add_ons) && (verifiedBooking.addOns || (verifiedBooking as any).add_ons).length > 0) && (
                      <div className="flex items-start gap-3 col-span-full">
                        <div className={`p-2 bg-${themeColor}-100 rounded-lg`}>
                          <PackageIcon className={`h-5 w-5 text-${fullColor}`} />
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Add-Ons ({(verifiedBooking.addOns || (verifiedBooking as any).add_ons).length})</p>
                          <div className="space-y-1 mt-1">
                            {((verifiedBooking.addOns || (verifiedBooking as any).add_ons) as Record<string, unknown>[]).map((addon, index: number) => (
                              <p key={index} className="font-medium text-gray-800">
                                • {addon.name as string} - ${Number(addon.price).toFixed(2)}
                                {(addon.pivot as any)?.quantity && (addon.pivot as any).quantity > 1 && ` (x${(addon.pivot as any).quantity})`}
                              </p>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {verifiedBooking.special_requests && (
                      <div className="flex items-start gap-3 col-span-full">
                        <div className={`p-2 bg-${themeColor}-100 rounded-lg`}>
                          <AlertCircle className={`h-5 w-5 text-${fullColor}`} />
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Special Requests</p>
                          <p className="font-medium text-gray-800">{verifiedBooking.special_requests}</p>
                        </div>
                      </div>
                    )}

                    {verifiedBooking.notes && (
                      <div className="flex items-start gap-3 col-span-full">
                        <div className={`p-2 bg-${themeColor}-100 rounded-lg`}>
                          <AlertCircle className={`h-5 w-5 text-${fullColor}`} />
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Notes</p>
                          <p className="font-medium text-gray-800">{verifiedBooking.notes}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 p-6 flex gap-4">
                <button
                  onClick={handleCancelCheckIn}
                  className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors font-medium"
                >
                  Cancel
                </button>
                
                {/* Show payment button if not fully paid */}
                {verifiedBooking.payment_status !== 'paid' && (
                  <button
                    onClick={() => handleOpenPaymentModal(verifiedBooking)}
                    disabled={processing || processingPayment}
                    className={`flex-1 px-3 sm:px-6 py-2 sm:py-3 text-sm sm:text-base bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors font-medium flex items-center justify-center gap-1 sm:gap-2 disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    <DollarSign className="h-4 w-4 sm:h-5 sm:w-5" />
                    <span className="hidden sm:inline">Add Payment</span>
                    <span className="sm:hidden">Pay</span>
                  </button>
                )}
                
                {/* Check-in button - only show if paid */}
                {verifiedBooking.payment_status === 'paid' && (
                  <button
                    onClick={handleConfirmCheckIn}
                    disabled={processing}
                    className={`flex-1 px-3 sm:px-6 py-2 sm:py-3 text-sm sm:text-base bg-${themeColor}-600 text-white rounded-lg hover:bg-${themeColor}-700 transition-colors font-medium flex items-center justify-center gap-1 sm:gap-2 disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {processing ? (
                      <>
                        <RefreshCw className="h-4 w-4 sm:h-5 sm:w-5 animate-spin" />
                        <span className="hidden sm:inline">Checking In...</span>
                        <span className="sm:hidden">Wait...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5" />
                        <span className="hidden sm:inline">Confirm Check-In</span>
                        <span className="sm:hidden">Check-In</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Final Result Display (After successful check-in) */}
        {scanResult && (
          <div className={`bg-white rounded-xl shadow-sm p-10 mb-6 mt-6 ${
            scanResult.success 
              ? `border-${themeColor}-500` 
              : 'border-red-500'
          }`}>
            <div className="flex items-start gap-4 mb-6">
              {scanResult.success ? (
                <div className={`p-3 bg-${themeColor}-100 rounded-full`}>
                  <CheckCircle className={`h-8 w-8 text-${fullColor}`} />
                </div>
              ) : (
                <div className="p-3 bg-red-100 rounded-full">
                  <XCircle className="h-8 w-8 text-red-600" />
                </div>
              )}
              
              <div className="flex-1">
                <h3 className={`text-xl font-bold mb-1 ${
                  scanResult.success ? `text-${fullColor}` : 'text-red-600'
                }`}>
                  {scanResult.success ? 'Check-In Successful!' : 'Check-In Failed'}
                </h3>
                <p className="text-gray-600">{scanResult.message}</p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-4">
              <button
                onClick={() => {
                  resetScan();
                  startScanning();
                }}
                className={`flex-1 px-6 py-3 bg-${themeColor}-600 text-white rounded-lg hover:bg-${themeColor}-700 transition-colors flex items-center justify-center gap-2`}
              >
                <Camera className="h-5 w-5" />
                Scan Next Booking
              </button>
              
              <button
                onClick={resetScan}
                className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Reset
              </button>
            </div>
          </div>
        )}

        {/* Booking Details Modal */}
        {showDetailsModal && selectedBooking && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={closeModal}>
            <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              {/* Modal Header */}
              <div className="sticky top-0 bg-white border-b border-gray-200 p-3 sm:p-6 flex items-center justify-between">
                <h2 className="text-base sm:text-xl font-bold text-gray-800">Booking Details</h2>
                <button
                  onClick={closeModal}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="h-5 w-5 text-gray-600" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-3 sm:p-6">
                {/* Status Alerts */}
                {selectedBooking.status === 'checked-in' && (
                  <div className="mb-3 sm:mb-6 p-2 sm:p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-2 sm:gap-3">
                    <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm sm:text-base font-semibold text-green-800">Checked In</p>
                      <p className="text-xs sm:text-sm text-green-600">This booking has been checked in.</p>
                      {selectedBooking.checked_in_at && (
                        <p className="text-xs text-green-600 mt-1">
                          Check-in time: {new Date(selectedBooking.checked_in_at).toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {selectedBooking.status === 'completed' && (
                  <div className="mb-3 sm:mb-6 p-2 sm:p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-2 sm:gap-3">
                    <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm sm:text-base font-semibold text-blue-800">Booking Completed</p>
                      <p className="text-xs sm:text-sm text-blue-600">This booking has been completed.</p>
                    </div>
                  </div>
                )}

                {selectedBooking.status === 'cancelled' && (
                  <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                    <XCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-red-800">Booking Cancelled</p>
                      <p className="text-sm text-red-600">This booking has been cancelled.</p>
                    </div>
                  </div>
                )}

                {selectedBooking.status === 'confirmed' && (
                  <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-yellow-800">Confirmed Booking</p>
                      <p className="text-sm text-yellow-600">This booking is confirmed and ready to be checked in.</p>
                    </div>
                  </div>
                )}

                {/* Booking Details */}
                <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
                  <h3 className="font-semibold text-gray-800 mb-4">Booking Information</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 bg-${themeColor}-100 rounded-lg`}>
                        <Ticket className={`h-5 w-5 text-${fullColor}`} />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Reference Number</p>
                        <p className="font-medium text-gray-800">#{selectedBooking.reference_number}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className={`p-2 bg-${themeColor}-100 rounded-lg`}>
                        <User className={`h-5 w-5 text-${fullColor}`} />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Customer</p>
                        <p className="font-medium text-gray-800">{selectedBooking.guest_name || 'Guest'}</p>
                      </div>
                    </div>

                    {selectedBooking.package && (
                      <div className="flex items-center gap-3 col-span-full">
                        <div className={`p-2 bg-${themeColor}-100 rounded-lg`}>
                          <PackageIcon className={`h-5 w-5 text-${fullColor}`} />
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Package</p>
                          <p className="font-medium text-gray-800 text-lg">{selectedBooking.package.name}</p>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-3">
                      <div className={`p-2 bg-${themeColor}-100 rounded-lg`}>
                        <Calendar className={`h-5 w-5 text-${fullColor}`} />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Date & Time</p>
                        <p className="font-medium text-gray-800">
                          {new Date(selectedBooking.booking_date).toLocaleDateString()} at {selectedBooking.booking_time}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className={`p-2 bg-${themeColor}-100 rounded-lg`}>
                        <Users className={`h-5 w-5 text-${fullColor}`} />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Participants</p>
                        <p className="font-medium text-gray-800">{selectedBooking.participants}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className={`p-2 bg-${themeColor}-100 rounded-lg`}>
                        <Clock className={`h-5 w-5 text-${fullColor}`} />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Duration</p>
                        <p className="font-medium text-gray-800">{selectedBooking.duration} {selectedBooking.duration_unit}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className={`p-2 bg-${themeColor}-100 rounded-lg`}>
                        <DollarSign className={`h-5 w-5 text-${fullColor}`} />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Total Amount</p>
                        <p className="font-medium text-gray-800">${Number(selectedBooking.total_amount).toFixed(2)}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className={`p-2 bg-${themeColor}-100 rounded-lg`}>
                        <DollarSign className={`h-5 w-5 text-${fullColor}`} />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Amount Paid</p>
                        <p className="font-medium text-gray-800">${Number(selectedBooking.amount_paid).toFixed(2)}</p>
                      </div>
                    </div>

                    {selectedBooking.discount_amount && Number(selectedBooking.discount_amount) > 0 && (
                      <div className="flex items-center gap-3">
                        <div className={`p-2 bg-${themeColor}-100 rounded-lg`}>
                          <DollarSign className={`h-5 w-5 text-${fullColor}`} />
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Discount Amount</p>
                          <p className="font-medium text-gray-800">${Number(selectedBooking.discount_amount).toFixed(2)}</p>
                        </div>
                      </div>
                    )}

                    {selectedBooking.payment_method && (
                      <div className="flex items-center gap-3">
                        <div className={`p-2 bg-${themeColor}-100 rounded-lg`}>
                          <DollarSign className={`h-5 w-5 text-${fullColor}`} />
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Payment Method</p>
                          <p className="font-medium text-gray-800 capitalize">{selectedBooking.payment_method}</p>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${
                        selectedBooking.payment_status === 'paid'
                          ? 'bg-green-100' 
                          : selectedBooking.payment_status === 'partial'
                          ? 'bg-yellow-100'
                          : 'bg-gray-100'
                      }`}>
                        <DollarSign className={`h-5 w-5 ${
                          selectedBooking.payment_status === 'paid'
                            ? 'text-green-600' 
                            : selectedBooking.payment_status === 'partial'
                            ? 'text-yellow-600'
                            : 'text-gray-600'
                        }`} />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Payment Status</p>
                        <p className={`font-semibold capitalize ${
                          selectedBooking.payment_status === 'paid'
                            ? 'text-green-600' 
                            : selectedBooking.payment_status === 'partial'
                            ? 'text-yellow-600'
                            : 'text-gray-600'
                        }`}>
                          {selectedBooking.payment_status}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${
                        selectedBooking.status === 'checked-in' || selectedBooking.status === 'completed'
                          ? 'bg-green-100' 
                          : selectedBooking.status === 'cancelled'
                          ? 'bg-red-100'
                          : 'bg-yellow-100'
                      }`}>
                        <CheckCircle className={`h-5 w-5 ${
                          selectedBooking.status === 'checked-in' || selectedBooking.status === 'completed'
                            ? 'text-green-600' 
                            : selectedBooking.status === 'cancelled'
                            ? 'text-red-600'
                            : 'text-yellow-600'
                        }`} />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Booking Status</p>
                        <p className={`font-semibold capitalize ${
                          selectedBooking.status === 'checked-in' || selectedBooking.status === 'completed'
                            ? 'text-green-600' 
                            : selectedBooking.status === 'cancelled'
                            ? 'text-red-600'
                            : 'text-yellow-600'
                        }`}>
                          {selectedBooking.status === 'checked-in' ? 'Checked In' : selectedBooking.status}
                        </p>
                      </div>
                    </div>

                    {selectedBooking.guest_email && (
                      <div className="flex items-center gap-3 col-span-full">
                        <div className={`p-2 bg-${themeColor}-100 rounded-lg`}>
                          <User className={`h-5 w-5 text-${fullColor}`} />
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Email</p>
                          <p className="font-medium text-gray-800">{selectedBooking.guest_email}</p>
                        </div>
                      </div>
                    )}

                    {selectedBooking.guest_phone && (
                      <div className="flex items-center gap-3 col-span-full">
                        <div className={`p-2 bg-${themeColor}-100 rounded-lg`}>
                          <Smartphone className={`h-5 w-5 text-${fullColor}`} />
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Phone</p>
                          <p className="font-medium text-gray-800">{selectedBooking.guest_phone}</p>
                        </div>
                      </div>
                    )}

                    {(selectedBooking.location && typeof selectedBooking.location === 'object') ? (
                      <div className="flex items-center gap-3 col-span-full">
                        <div className={`p-2 bg-${themeColor}-100 rounded-lg`}>
                          <Home className={`h-5 w-5 text-${fullColor}`} />
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Location</p>
                          <p className="font-medium text-gray-800">{(selectedBooking.location as Record<string, string>)?.name}</p>
                          {(selectedBooking.location as Record<string, string>)?.address && (
                            <p className="text-xs text-gray-600">
                              {(selectedBooking.location as Record<string, string>)?.address}, {(selectedBooking.location as Record<string, string>)?.city}, {(selectedBooking.location as Record<string, string>)?.state} {(selectedBooking.location as Record<string, string>)?.zip_code}
                            </p>
                          )}
                        </div>
                      </div>
                    ) : null}

                    {(selectedBooking.room && typeof selectedBooking.room === 'object') ? (
                      <div className="flex items-center gap-3 col-span-full">
                        <div className={`p-2 bg-${themeColor}-100 rounded-lg`}>
                          <Home className={`h-5 w-5 text-${fullColor}`} />
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Space</p>
                          <p className="font-medium text-gray-800">{(selectedBooking.room as { name: string })?.name || 'N/A'}</p>
                        </div>
                      </div>
                    ) : null}

                    {selectedBooking.attractions && Array.isArray(selectedBooking.attractions) && selectedBooking.attractions.length > 0 && (
                      <div className="flex items-start gap-3 col-span-full">
                        <div className={`p-2 bg-${themeColor}-100 rounded-lg`}>
                          <PackageIcon className={`h-5 w-5 text-${fullColor}`} />
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Attractions ({selectedBooking.attractions.length})</p>
                          <div className="space-y-1 mt-1">
                            {(selectedBooking.attractions as Record<string, unknown>[]).map((attraction, index: number) => (
                              <p key={index} className="font-medium text-gray-800">
                                • {attraction.name as string} - ${Number(attraction.price).toFixed(2)}
                              </p>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {((selectedBooking.addOns || (selectedBooking as any).add_ons) && Array.isArray(selectedBooking.addOns || (selectedBooking as any).add_ons) && (selectedBooking.addOns || (selectedBooking as any).add_ons).length > 0) && (
                      <div className="flex items-start gap-3 col-span-full">
                        <div className={`p-2 bg-${themeColor}-100 rounded-lg`}>
                          <PackageIcon className={`h-5 w-5 text-${fullColor}`} />
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Add-Ons ({(selectedBooking.addOns || (selectedBooking as any).add_ons).length})</p>
                          <div className="space-y-1 mt-1">
                            {((selectedBooking.addOns || (selectedBooking as any).add_ons) as Record<string, unknown>[]).map((addon, index: number) => (
                              <p key={index} className="font-medium text-gray-800">
                                • {addon.name as string} - ${Number(addon.price).toFixed(2)}
                                {(addon.pivot as any)?.quantity && (addon.pivot as any).quantity > 1 && ` (x${(addon.pivot as any).quantity})`}
                              </p>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {selectedBooking.special_requests && (
                      <div className="flex items-start gap-3 col-span-full">
                        <div className={`p-2 bg-${themeColor}-100 rounded-lg`}>
                          <AlertCircle className={`h-5 w-5 text-${fullColor}`} />
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Special Requests</p>
                          <p className="font-medium text-gray-800">{selectedBooking.special_requests}</p>
                        </div>
                      </div>
                    )}

                    {selectedBooking.notes && (
                      <div className="flex items-start gap-3 col-span-full">
                        <div className={`p-2 bg-${themeColor}-100 rounded-lg`}>
                          <AlertCircle className={`h-5 w-5 text-${fullColor}`} />
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Notes</p>
                          <p className="font-medium text-gray-800">{selectedBooking.notes}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 p-3 sm:p-6 flex gap-2 sm:gap-4">
                <button
                  onClick={closeModal}
                  className="flex-1 px-3 sm:px-6 py-2 sm:py-3 text-sm sm:text-base border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors font-medium"
                >
                  Close
                </button>
                
                {/* Payment button - shown if not fully paid */}
                {selectedBooking.payment_status !== 'paid' && (
                  <button
                    onClick={() => {
                      handleOpenPaymentModal(selectedBooking);
                      closeModal();
                    }}
                    disabled={processing || processingPayment}
                    className={`flex-1 px-3 sm:px-6 py-2 sm:py-3 text-sm sm:text-base bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors font-medium flex items-center justify-center gap-1 sm:gap-2 disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    <DollarSign className="h-4 w-4 sm:h-5 sm:w-5" />
                    <span className="hidden sm:inline">Add Payment</span>
                    <span className="sm:hidden">Pay</span>
                  </button>
                )}
                
                {/* Check-in button - only show if paid */}
                {selectedBooking.payment_status === 'paid' && (
                  <button
                    onClick={() => {
                      handleCheckIn(selectedBooking);
                      closeModal();
                    }}
                    disabled={processing}
                    className={`flex-1 px-3 sm:px-6 py-2 sm:py-3 text-sm sm:text-base bg-${themeColor}-600 text-white rounded-lg hover:bg-${themeColor}-700 transition-colors font-medium flex items-center justify-center gap-1 sm:gap-2 disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {processing ? (
                      <>
                        <RefreshCw className="h-4 w-4 sm:h-5 sm:w-5 animate-spin" />
                        <span className="hidden sm:inline">Checking In...</span>
                        <span className="sm:hidden">Wait...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5" />
                        <span className="hidden sm:inline">Check In Now</span>
                        <span className="sm:hidden">Check-In</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="bg-blue-50 rounded-lg p-6 border border-blue-200 mt-6">
          <h3 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            How to Use
          </h3>
          <ul className="space-y-2 text-sm text-blue-800">
            <li className="flex items-start gap-2">
              <span className="font-bold">1.</span>
              <span>Click "Start Camera" to begin scanning or upload a QR code image from your device</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold">2.</span>
              <span><strong>Mobile recommended:</strong> Point your phone/tablet camera at the customer's QR code</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold">3.</span>
              <span>Review the booking details in the popup modal and verify customer information</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold">4.</span>
              <span>Click "Confirm Check-In" to mark the booking as checked in, or "Cancel" to scan again</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold">5.</span>
              <span>Alternatively, use the table below to manually search and check in bookings</span>
            </li>
          </ul>
        </div>

        {/* Payment Modal */}
        {showPaymentModal && selectedBookingForPayment && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-backdrop-fade" onClick={() => { setShowPaymentModal(false); setSelectedBookingForPayment(null); }}>
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
              <div className={`p-6 border-b border-gray-100 bg-${themeColor}-50`}>
                <h2 className="text-2xl font-bold text-gray-900">Process Payment</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Booking: {selectedBookingForPayment.reference_number}
                </p>
              </div>

              <div className="p-6 space-y-4">
                {/* Payment Summary */}
                <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Total Amount:</span>
                    <span className="font-semibold">${Number(selectedBookingForPayment.total_amount).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Already Paid:</span>
                    <span className="font-semibold text-green-600">${Number(selectedBookingForPayment.amount_paid || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm pt-2 border-t border-gray-200">
                    <span className="text-gray-900 font-medium">Remaining Balance:</span>
                    <span className="font-bold text-red-600">
                      ${(Number(selectedBookingForPayment.total_amount) - Number(selectedBookingForPayment.amount_paid || 0)).toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Payment Amount */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Payment Amount *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      max={(Number(selectedBookingForPayment.total_amount) - Number(selectedBookingForPayment.amount_paid || 0)).toFixed(2)}
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      className={`w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-transparent`}
                      placeholder="0.00"
                    />
                  </div>
                </div>

                {/* Payment Method */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Payment Method *
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as 'card' | 'cash')}
                    className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-transparent`}
                  >
                    <option value="cash">Cash</option>
                    <option value="card">Card</option>
                  </select>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Notes (Optional)
                  </label>
                  <textarea
                    value={paymentNotes}
                    onChange={(e) => setPaymentNotes(e.target.value)}
                    rows={3}
                    className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-transparent`}
                    placeholder="Add any notes about this payment..."
                  />
                </div>
              </div>

              <div className="p-6 border-t border-gray-100 flex gap-3 justify-end">
                <button
                  onClick={handleClosePaymentModal}
                  disabled={processingPayment}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmitPayment}
                  disabled={processingPayment || !paymentAmount || parseFloat(paymentAmount) <= 0}
                  className={`px-4 py-2 bg-${fullColor} text-white rounded-lg hover:bg-${themeColor}-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2`}
                >
                  {processingPayment ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                      Processing...
                    </>
                  ) : (
                    'Process Payment'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
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

export default CheckIn;