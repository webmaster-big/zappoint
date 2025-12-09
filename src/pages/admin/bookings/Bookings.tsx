// src/pages/admin/bookings/Bookings.tsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Eye, 
  Pencil, 
  Trash2, 
  Search, 
  Filter, 
  RefreshCcw, 
  CheckCircle2, 
  Calendar,
  Package,
  DollarSign,
  Users,
  Download,
  Plus
} from 'lucide-react';
import { useThemeColor } from '../../../hooks/useThemeColor';
import CounterAnimation from '../../../components/ui/CounterAnimation';
import type { BookingsPageBooking, BookingsPageFilterOptions } from '../../../types/Bookings.types';
import bookingService from '../../../services/bookingService';
import { getStoredUser, API_BASE_URL } from '../../../utils/storage';
import { MapPin } from 'lucide-react';

const Bookings: React.FC = () => {
  const { themeColor, fullColor } = useThemeColor();
  const [bookings, setBookings] = useState<BookingsPageBooking[]>([]);
  const [filteredBookings, setFilteredBookings] = useState<BookingsPageBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBookings, setSelectedBookings] = useState<string[]>([]);
  const [filters, setFilters] = useState<BookingsPageFilterOptions>({
    status: 'all',
    dateRange: {
      start: '',
      end: ''
    },
    search: '',
    payment: 'all'
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [showFilters, setShowFilters] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedBookingForPayment, setSelectedBookingForPayment] = useState<BookingsPageBooking | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'cash'>('cash');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [processingPayment, setProcessingPayment] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFilters, setExportFilters] = useState({
    locations: [] as number[],
    customers: [] as number[],
    statuses: [] as string[],
    startDate: '',
    endDate: '',
    minAmount: '',
    maxAmount: ''
  });
  const [exporting, setExporting] = useState(false);
  const [availableLocations, setAvailableLocations] = useState<Array<{id: number, name: string}>>([]);
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const [foundCustomersForExport, setFoundCustomersForExport] = useState<Array<{id: number, name: string, email: string}>>([]);
  const [searchingCustomers, setSearchingCustomers] = useState(false);
  const [customerSearchDebounce, setCustomerSearchDebounce] = useState<NodeJS.Timeout | null>(null);

  // Status and payment colors
  const statusColors = {
    pending: 'bg-yellow-100 text-yellow-800',
    confirmed: `bg-${themeColor}-100 text-${fullColor}`,
    cancelled: 'bg-red-100 text-red-800',
    completed: 'bg-green-100 text-green-800',
    'checked-in': `bg-${themeColor}-100 text-${fullColor}`
  };

  const paymentColors = {
    credit_card: `bg-${themeColor}-100 text-${fullColor}`,
    paypal: `bg-${themeColor}-100 text-${fullColor}`,
    cash: 'bg-green-100 text-green-800',
    'e-wallet': 'bg-orange-100 text-orange-800'
  };

  const paymentStatusColors = {
    paid: 'bg-green-100 text-green-800',
    partial: 'bg-yellow-100 text-yellow-800',
    pending: 'bg-gray-100 text-gray-800'
  };

  // Calculate metrics data
  const metrics = [
    {
      title: 'Total Bookings',
      value: bookings.length.toString(),
      change: `${bookings.length} total bookings`,
      icon: Calendar,
      accent: `bg-${themeColor}-100 text-${fullColor}`,
    },
    {
      title: 'Package Bookings',
      value: bookings.length.toString(),
      change: `${bookings.filter(b => b.status === 'confirmed').length} confirmed`,
      icon: Package,
      accent: `bg-${themeColor}-100 text-${fullColor}`,
    },
    {
      title: 'Participants',
      value: bookings.reduce((sum, booking) => sum + booking.participants, 0).toString(),
      change: `${bookings.length} bookings`,
      icon: Users,
      accent: `bg-${themeColor}-100 text-${fullColor}`,
    },
    {
      title: 'Revenue',
      value: `$${Number(bookings.reduce((sum, booking) => sum + booking.totalAmount, 0)).toFixed(2)}`,
      change: 'All bookings',
      icon: DollarSign,
      accent: `bg-${themeColor}-100 text-${fullColor}`,
    },
  ];

  // Load bookings from backend API
  useEffect(() => {
    loadBookings();
    loadLocations();
  }, []);

  const loadLocations = async () => {
    try {
      const user = getStoredUser();
      if (user?.role === 'company_admin') {
        // Fetch all locations for company admin
        const response = await fetch(`${API_BASE_URL}/locations`, {
          headers: {
            'Authorization': `Bearer ${user.token}`,
            'Accept': 'application/json'
          }
        });
        const data = await response.json();
        if (data.success && data.data) {
          setAvailableLocations(data.data.map((loc: any) => ({
            id: loc.id,
            name: loc.name
          })));
        }
      }
    } catch (error) {
      console.error('Error loading locations:', error);
    }
  };

  // Apply filters when bookings or filters change
  useEffect(() => {
    applyFilters();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookings, filters]);

  const loadBookings = async () => {
    try {
      setLoading(true);
      
      // Fetch bookings from backend with filters
      const response = await bookingService.getBookings({
        page: 1,
        per_page: 1000,
        user_id: getStoredUser()?.id,
        sort_by: 'booking_date',
        sort_order: 'asc',
      });
      
      if (response.success && response.data) {
        // Transform backend booking data to match BookingsPageBooking interface
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const transformedBookings: BookingsPageBooking[] = response.data.bookings.map((booking: any) => ({
          id: booking.id.toString(),
          type: 'package',
          packageName: booking.package?.name || 'N/A',
          room: booking.room?.name || 'N/A',
          customerName: booking.customer 
            ? `${booking.customer.first_name} ${booking.customer.last_name}`
            : booking.guest_name || 'Guest',
          email: booking.customer?.email || booking.guest_email || '',
          phone: booking.customer?.phone || booking.guest_phone || '',
          date: booking.booking_date,
          time: booking.booking_time,
          participants: booking.participants,
          status: booking.status as BookingsPageBooking['status'],
          totalAmount: Number(booking.total_amount),
          amountPaid: Number(booking.amount_paid || booking.total_amount),
          paymentStatus: (booking.payment_status || 'pending') as BookingsPageBooking['paymentStatus'],
          createdAt: booking.created_at,
          paymentMethod: booking.payment_method as BookingsPageBooking['paymentMethod'],
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          attractions: booking.attractions?.map((attr: any) => ({
            name: attr.name,
            quantity: attr.pivot?.quantity || 1
          })) || [],
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          addOns: booking.add_ons?.map((addon: any) => ({
            name: addon.name,
            quantity: addon.pivot?.quantity || 1
          })) || [],
          duration: booking.duration && booking.duration_unit 
            ? `${booking.duration} ${booking.duration_unit}`
            : '2 hours',
          activity: booking.package?.category || 'Package Booking',
          notes: booking.notes,
          referenceNumber: booking.reference_number,
          location: booking.location?.name || 'N/A',
        }));
        console.log('Transformed Bookings:', transformedBookings);
        setBookings(transformedBookings);
      }
    } catch (error) {
      console.error('Error loading bookings:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = async () => {
    // If search term exists, use backend search
    if (filters.search && filters.search.length >= 2) {
      try {
        const response = await bookingService.searchBookings(filters.search);
        if (response.success && response.data) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const transformedResults = response.data.map((booking: any) => ({
            id: booking.id.toString(),
            type: 'package' as const,
            packageName: booking.package?.name || 'N/A',
              room: booking.room?.name || 'N/A',
            customerName: booking.customer 
              ? `${booking.customer.first_name} ${booking.customer.last_name}`
              : booking.guest_name || 'Guest',
            email: booking.customer?.email || booking.guest_email || '',
            phone: booking.customer?.phone || booking.guest_phone || '',
            date: booking.booking_date,
            time: booking.booking_time,
            participants: booking.participants,
            status: booking.status as BookingsPageBooking['status'],
            totalAmount: Number(booking.total_amount),
            amountPaid: Number(booking.amount_paid || booking.total_amount),
            paymentStatus: (booking.payment_status || 'pending') as BookingsPageBooking['paymentStatus'],
            createdAt: booking.created_at,
            paymentMethod: booking.payment_method as BookingsPageBooking['paymentMethod'],
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            attractions: booking.attractions?.map((attr: any) => ({
              name: attr.name,
              quantity: attr.pivot?.quantity || 1
            })) || [],
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            addOns: booking.add_ons?.map((addon: any) => ({
              name: addon.name,
              quantity: addon.pivot?.quantity || 1
            })) || [],
            duration: booking.duration && booking.duration_unit 
              ? `${booking.duration} ${booking.duration_unit}`
              : '2 hours',
            activity: booking.package?.category || 'Package Booking',
            notes: booking.notes,
            referenceNumber: booking.reference_number,
            location: booking.location.name || 'N/A'
          }));
          
          let result: BookingsPageBooking[] = transformedResults;
          
          // Apply additional client-side filters
          if (filters.status !== 'all') {
            result = result.filter(booking => booking.status === filters.status);
          }
          if (filters.payment !== 'all') {
            result = result.filter(booking => booking.paymentMethod === filters.payment);
          }
          if (filters.dateRange.start) {
            result = result.filter(booking => booking.date >= filters.dateRange.start);
          }
          if (filters.dateRange.end) {
            result = result.filter(booking => booking.date <= filters.dateRange.end);
          }
          
          setFilteredBookings(result);
          return;
        }
      } catch (error) {
        console.error('Error searching bookings:', error);
      }
    }
    
    // Client-side filtering when no search or search fails
    let result = [...bookings];

    // Apply search filter
    if (filters.search) {
      const searchTerm = filters.search.toLowerCase();
      result = result.filter(booking =>
        booking.customerName.toLowerCase().includes(searchTerm) ||
        booking.email.toLowerCase().includes(searchTerm) ||
        booking.packageName.toLowerCase().includes(searchTerm) ||
        booking.phone.includes(searchTerm)
      );
    }

    // Apply status filter
    if (filters.status !== 'all') {
      result = result.filter(booking => booking.status === filters.status);
    }

    // Apply payment filter
    if (filters.payment !== 'all') {
      result = result.filter(booking => booking.paymentMethod === filters.payment);
    }

    // Apply date range filter
    if (filters.dateRange.start) {
      result = result.filter(booking => booking.date >= filters.dateRange.start);
    }
    if (filters.dateRange.end) {
      result = result.filter(booking => booking.date <= filters.dateRange.end);
    }

    setFilteredBookings(result);
  };

  const handleFilterChange = (key: keyof BookingsPageFilterOptions, value: string) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleDateRangeChange = (key: 'start' | 'end', value: string) => {
    setFilters(prev => ({
      ...prev,
      dateRange: {
        ...prev.dateRange,
        [key]: value
      }
    }));
  };

  const clearFilters = () => {
    setFilters({
      status: 'all',
      dateRange: {
        start: '',
        end: ''
      },
      search: '',
      payment: 'all'
    });
  };

  const handleSelectBooking = (id: string) => {
    setSelectedBookings(prev =>
      prev.includes(id)
        ? prev.filter(bookingId => bookingId !== id)
        : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedBookings.length === currentBookings.length) {
      setSelectedBookings([]);
    } else {
      setSelectedBookings(currentBookings.map(booking => booking.id));
    }
  };

  const handleCheckIn = async (referenceNumber: string, checkInStatus: 'checked-in') => {
    try {
      // Call API to check in booking
      const userId = getStoredUser()?.id;
      await bookingService.checkInBooking(referenceNumber, userId);
      
      // Update local state
      const updatedBookings = bookings.map(booking =>
        booking.referenceNumber === referenceNumber ? { ...booking, status: checkInStatus } : booking
      );
      setBookings(updatedBookings);
    } catch (error) {
      console.error('Error checking in booking:', error);
      alert('Failed to check in booking. Please try again.');
    }
  };

  const handleStatusChange = async (id: string, newStatus: BookingsPageBooking['status']) => {
    try {

        await bookingService.updateBooking(Number(id), { status: newStatus });
      
      
      // Update local state
      const updatedBookings = bookings.map(booking =>
        booking.id === id ? { ...booking, status: newStatus } : booking
      );
      setBookings(updatedBookings);
    } catch (error) {
      console.error('Error updating booking status:', error);
      alert('Failed to update booking status. Please try again.');
    }
  };

  const handlePaymentStatusChange = async (id: string, newPaymentStatus: BookingsPageBooking['paymentStatus']) => {
    try {
      // Update payment status via API
      await bookingService.updateBooking(Number(id), { payment_status: newPaymentStatus });
      
      // Update local state
      const updatedBookings = bookings.map(booking =>
        booking.id === id ? { ...booking, paymentStatus: newPaymentStatus } : booking
      );
      setBookings(updatedBookings);
    } catch (error) {
      console.error('Error updating payment status:', error);
      alert('Failed to update payment status. Please try again.');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedBookings.length === 0) return;
    
    if (window.confirm(`Are you sure you want to delete ${selectedBookings.length} booking(s)?`)) {
      try {
        // Delete each booking via API
        await Promise.all(
          selectedBookings.map(id => bookingService.deleteBooking(Number(id)))
        );
        
        // Update local state
        const updatedBookings = bookings.filter(booking => !selectedBookings.includes(booking.id));
        setBookings(updatedBookings);
        setSelectedBookings([]);
      } catch (error) {
        console.error('Error deleting bookings:', error);
        alert('Failed to delete some bookings. Please try again.');
      }
    }
  };

  const handleBulkStatusChange = async (newStatus: BookingsPageBooking['status']) => {
    if (selectedBookings.length === 0) return;
    
    try {
      // Update each booking status via API
      await Promise.all(
        selectedBookings.map(async (id) => {
          if (newStatus === 'checked-in') {
            return bookingService.checkInBooking(id);
          } else if (newStatus === 'completed') {
            return bookingService.completeBooking(Number(id));
          } else if (newStatus === 'cancelled') {
            return bookingService.cancelBooking(Number(id));
          } else {
            return bookingService.updateBooking(Number(id), { status: newStatus });
          }
        })
      );
      
      // Update local state
      const updatedBookings = bookings.map(booking =>
        selectedBookings.includes(booking.id) ? { ...booking, status: newStatus } : booking
      );
      setBookings(updatedBookings);
      setSelectedBookings([]);
    } catch (error) {
      console.error('Error updating booking statuses:', error);
      alert('Failed to update some bookings. Please try again.');
    }
  };

  const handleOpenPaymentModal = (booking: BookingsPageBooking) => {
    setSelectedBookingForPayment(booking);
    const remainingAmount = booking.totalAmount - booking.amountPaid;
    setPaymentAmount(remainingAmount.toFixed(2));
    setPaymentMethod('cash');
    setPaymentNotes('');
    setShowPaymentModal(true);
  };

  const handleClosePaymentModal = () => {
    setShowPaymentModal(false);
    setSelectedBookingForPayment(null);
    setPaymentAmount('');
    setPaymentMethod('cash');
    setPaymentNotes('');
  };

  const searchCustomersForExport = async (searchTerm: string) => {
    // Clear previous debounce timer
    if (customerSearchDebounce) {
      clearTimeout(customerSearchDebounce);
    }

    if (!searchTerm || searchTerm.length < 2) {
      setFoundCustomersForExport([]);
      setSearchingCustomers(false);
      return;
    }

    setSearchingCustomers(true);

    // Set new debounce timer
    const timer = setTimeout(async () => {
      try {
        const user = getStoredUser();
        const response = await fetch(`${API_BASE_URL}/customers/search?query=${encodeURIComponent(searchTerm)}`, {
          headers: {
            'Authorization': `Bearer ${user?.token}`,
            'Accept': 'application/json'
          }
        });
        const data = await response.json();
        if (data.success && data.data) {
          setFoundCustomersForExport(data.data.map((customer: any) => ({
            id: customer.id,
            name: `${customer.first_name} ${customer.last_name}`,
            email: customer.email
          })));
        }
      } catch (error) {
        console.error('Error searching customers:', error);
      } finally {
        setSearchingCustomers(false);
      }
    }, 500); // 500ms debounce delay

    setCustomerSearchDebounce(timer);
  };

  const setQuickDateRange = (range: 'today' | '7days' | '30days' | 'year') => {
    const today = new Date();
    const endDate = today.toISOString().split('T')[0];
    let startDate = '';

    switch (range) {
      case 'today':
        startDate = endDate;
        break;
      case '7days':
        const sevenDaysAgo = new Date(today);
        sevenDaysAgo.setDate(today.getDate() - 7);
        startDate = sevenDaysAgo.toISOString().split('T')[0];
        break;
      case '30days':
        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(today.getDate() - 30);
        startDate = thirtyDaysAgo.toISOString().split('T')[0];
        break;
      case 'year':
        const oneYearAgo = new Date(today);
        oneYearAgo.setFullYear(today.getFullYear() - 1);
        startDate = oneYearAgo.toISOString().split('T')[0];
        break;
    }

    setExportFilters(prev => ({ ...prev, startDate, endDate }));
  };

  const handleExport = async () => {
    try {
      setExporting(true);
      
      const params: any = {
        user_id: getStoredUser()?.id,
        sort_by: 'booking_date',
        sort_order: 'desc'
      };

      if (exportFilters.locations.length > 0) {
        params.location_id = exportFilters.locations;
      }

      if (exportFilters.statuses.length > 0) {
        params.status = exportFilters.statuses;
      }

      if (exportFilters.customers.length > 0) {
        params.customer_id = exportFilters.customers;
      }

      if (exportFilters.startDate) {
        params.start_date = exportFilters.startDate;
      }

      if (exportFilters.endDate) {
        params.end_date = exportFilters.endDate;
      }

      if (exportFilters.minAmount) {
        params.min_amount = parseFloat(exportFilters.minAmount);
      }

      if (exportFilters.maxAmount) {
        params.max_amount = parseFloat(exportFilters.maxAmount);
      }

      const response = await bookingService.exportBookings(params);
      
      if (response.success && response.data.bookings) {
        // Convert to CSV
        const csvData = convertToCSV(response.data.bookings);
        
        // Download CSV
        const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `bookings-export-${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        setShowExportModal(false);
        // Reset filters
        setExportFilters({
          locations: [],
          customers: [],
          statuses: [],
          startDate: '',
          endDate: '',
          minAmount: '',
          maxAmount: ''
        });
        setCustomerSearchTerm('');
        setFoundCustomersForExport([]);
        if (customerSearchDebounce) {
          clearTimeout(customerSearchDebounce);
        }
      }
    } catch (error) {
      console.error('Error exporting bookings:', error);
      alert('Failed to export bookings. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const convertToCSV = (bookings: any[]): string => {
    const headers = [
      'Reference Number',
      'Customer Name',
      'Email',
      'Phone',
      'Package',
      'Room',
      'Location',
      'Date',
      'Time',
      'Participants',
      'Duration',
      'Status',
      'Payment Method',
      'Payment Status',
      'Total Amount',
      'Amount Paid',
      'Attractions',
      'Add-ons',
      'Notes',
      'Created At'
    ];

    const rows = bookings.map(booking => [
      booking.reference_number || '',
      booking.customer ? `${booking.customer.first_name} ${booking.customer.last_name}` : booking.guest_name || '',
      booking.customer?.email || booking.guest_email || '',
      booking.customer?.phone || booking.guest_phone || '',
      booking.package?.name || '',
      booking.room?.name || '',
      booking.location?.name || '',
      booking.booking_date || '',
      booking.booking_time || '',
      booking.participants || 0,
      booking.duration && booking.duration_unit ? `${booking.duration} ${booking.duration_unit}` : '',
      booking.status || '',
      booking.payment_method || '',
      booking.payment_status || '',
      booking.total_amount || 0,
      booking.amount_paid || 0,
      booking.attractions?.map((a: any) => `${a.name} (${a.pivot?.quantity || 1})`).join('; ') || '',
      booking.add_ons?.map((a: any) => `${a.name} (${a.pivot?.quantity || 1})`).join('; ') || '',
      booking.notes || '',
      booking.created_at || ''
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => 
        row.map(cell => 
          `"${String(cell).replace(/"/g, '""')}"`
        ).join(',')
      )
    ].join('\n');

    return csvContent;
  };

  const handleSubmitPayment = async () => {
    if (!selectedBookingForPayment) return;
    
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      alert('Please enter a valid payment amount');
      return;
    }

    const remainingAmount = selectedBookingForPayment.totalAmount - selectedBookingForPayment.amountPaid;
    if (amount > remainingAmount) {
      alert(`Payment amount cannot exceed remaining balance of $${remainingAmount.toFixed(2)}`);
      return;
    }

    try {
      setProcessingPayment(true);

      // Get booking details to find customer_id and location_id
      const bookingResponse = await bookingService.getBookingById(Number(selectedBookingForPayment.id));
      if (!bookingResponse.success || !bookingResponse.data) {
        throw new Error('Failed to get booking details');
      }

      const booking = bookingResponse.data;
      const customerId = booking.customer_id;
      const locationId = booking.location_id;
      
      if (!customerId) {
        throw new Error('Customer ID not found for this booking');
      }

      if (!locationId) {
        throw new Error('Location ID not found for this booking');
      }

      // Get auth token
      const user = getStoredUser();
      if (!user?.token) {
        throw new Error('Authentication token not found');
      }

      // Create payment record
      const paymentResponse = await fetch(`${API_BASE_URL}/payments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${user.token}`,
        },
        body: JSON.stringify({
          booking_id: Number(selectedBookingForPayment.id),
          customer_id: customerId,
          location_id: locationId,
          amount: amount,
          currency: 'USD',
          method: paymentMethod,
          status: 'completed',
          notes: paymentNotes || `Partial payment for booking ${selectedBookingForPayment.referenceNumber}`,
        }),
      });

      if (!paymentResponse.ok) {
        const errorData = await paymentResponse.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to create payment');
      }

      // Update booking's amount_paid
      const newAmountPaid = selectedBookingForPayment.amountPaid + amount;
      const newPaymentStatus: BookingsPageBooking['paymentStatus'] = newAmountPaid >= selectedBookingForPayment.totalAmount ? 'paid' : 'partial';

      await bookingService.updateBooking(Number(selectedBookingForPayment.id), {
        amount_paid: newAmountPaid,
        payment_status: newPaymentStatus,
      });

      // Update local state
      const updatedBookings = bookings.map(booking =>
        booking.id === selectedBookingForPayment.id
          ? { ...booking, amountPaid: newAmountPaid, paymentStatus: newPaymentStatus }
          : booking
      );
      setBookings(updatedBookings);

      alert('Payment processed successfully!');
      handleClosePaymentModal();
      loadBookings(); // Reload to get fresh data
    } catch (error) {
      console.error('Error processing payment:', error);
      alert('Failed to process payment. Please try again.');
    } finally {
      setProcessingPayment(false);
    }
  };

  // Pagination
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentBookings = filteredBookings.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredBookings.length / itemsPerPage);

  const paginate = (pageNumber: number) => setCurrentPage(pageNumber);

  if (loading) {
    return (
        <div className="flex justify-center items-center h-64">
          <div className={`animate-spin rounded-full h-12 w-12 border-b-2 border-${fullColor}`}></div>
        </div>
    );
  }

  return (
      <div className="px-6 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Bookings</h1>
            <p className="text-gray-800 mt-2">Manage all bookings</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mt-4 sm:mt-0">
            <button
              onClick={() => window.location.href = '/bookings/manual'}
              className={`flex items-center px-4 py-2 bg-${fullColor} text-white rounded-lg hover:bg-${themeColor}-700 shadow-sm transition-colors`}
            >
              <Plus className="h-4 w-4 mr-2" />
              Record Past Booking
            </button>
            <button
              onClick={() => setShowExportModal(true)}
              className={`flex items-center px-4 py-2 bg-${fullColor} text-white rounded-lg hover:bg-${themeColor}-700 shadow-sm transition-colors`}
            >
              <Download className="h-4 w-4 mr-2" />
              Export Bookings
            </button>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {metrics.map((metric, index) => {
            const Icon = metric.icon;
            return (
              <div
                key={index}
                className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex flex-col gap-2 hover:shadow-md transition-shadow min-h-[120px]"
              >
                <div className="flex items-center gap-2">
                  <div className={`p-2 rounded-lg ${metric.accent}`}><Icon size={20} /></div>
                  <span className="text-base font-semibold text-gray-800">{metric.title}</span>
                </div>
                <div className="flex items-end gap-2 mt-2">
                  <CounterAnimation value={metric.value} className="text-2xl font-bold text-gray-900" />
                </div>
                <p className="text-xs mt-1 text-gray-600 ">{metric.change}</p>
              </div>
            );
          })}
        </div>

        {/* Filters and Search */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-6">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <div className="relative flex-1 max-w-lg">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-gray-600 " />
              </div>
              <input
                type="text"
                placeholder="Search package bookings..."
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                className={`pl-9 pr-3 py-1.5 border border-gray-200 rounded-lg w-full text-sm focus:ring-2 focus:ring-${themeColor}-600 focus:border-${themeColor}-600`}
              />
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 text-sm"
              >
                <Filter className="h-4 w-4 mr-1" />
                Filters
              </button>
              <button
                onClick={loadBookings}
                className="flex items-center px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 text-sm"
              >
                <RefreshCcw className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Advanced Filters */}
          {showFilters && (
            <div className="mt-3 p-3 bg-gray-50 rounded-lg">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-800 mb-1">Status</label>
                  <select
                    value={filters.status}
                    onChange={(e) => handleFilterChange('status', e.target.value)}
                    className={`w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-${themeColor}-600 focus:border-${themeColor}-600`}
                  >
                    <option value="all">All Statuses</option>
                    <option value="pending">Pending</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="checked-in">Checked In</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-800 mb-1">Payment Method</label>
                  <select
                    value={filters.payment}
                    onChange={(e) => handleFilterChange('payment', e.target.value)}
                    className={`w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-${themeColor}-600 focus:border-${themeColor}-600`}
                  >
                    <option value="all">All Methods</option>
                    <option value="credit_card">Card</option>
                    <option value="cash">Cash</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-800 mb-1">From Date</label>
                  <input
                    type="date"
                    value={filters.dateRange.start}
                    onChange={(e) => handleDateRangeChange('start', e.target.value)}
                    className={`w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-${themeColor}-600 focus:border-${themeColor}-600`}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-800 mb-1">To Date</label>
                  <input
                    type="date"
                    value={filters.dateRange.end}
                    onChange={(e) => handleDateRangeChange('end', e.target.value)}
                    className={`w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-${themeColor}-600 focus:border-${themeColor}-600`}
                  />
                </div>
              </div>
              <div className="mt-3 flex justify-end">
                <button
                  onClick={clearFilters}
                  className="px-3 py-1.5 text-sm text-gray-800 hover:text-gray-800"
                >
                  Clear Filters
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Bulk Actions */}
        {selectedBookings.length > 0 && (
          <div className={`bg-${themeColor}-50 p-4 rounded-lg mb-6 flex flex-wrap items-center gap-4`}>
            <span className={`text-${fullColor} font-medium`}>
              {selectedBookings.length} booking(s) selected
            </span>
            <div className="flex gap-2">
              <select
                onChange={(e) => handleBulkStatusChange(e.target.value as BookingsPageBooking['status'])}
                className={`border border-gray-200 rounded-lg px-3 py-1 focus:ring-2 focus:ring-${themeColor}-600`}
              >
                <option value="">Change Status</option>
                <option value="confirmed">Confirm</option>
                <option value="checked-in">Check In</option>
                <option value="completed">Mark Complete</option>
                <option value="cancelled">Cancel</option>
              </select>
              <button
                onClick={handleBulkDelete}
                className="flex items-center px-3 py-1 bg-red-100 text-red-800 rounded-lg hover:bg-red-200"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Delete
              </button>
            </div>
          </div>
        )}

        {/* Bookings Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium w-12">
                    <input
                      type="checkbox"
                      checked={selectedBookings.length === currentBookings.length && currentBookings.length > 0}
                      onChange={handleSelectAll}
                      className={`rounded border-gray-300 text-${fullColor} focus:ring-${themeColor}-600`}
                    />
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium w-40">Date & Time</th>
                  <th scope="col" className="px-4 py-3 font-medium w-48">Customer</th>
                  <th scope="col" className="px-4 py-3 font-medium w-48">Package Details</th>
                  <th scope="col" className="px-4 py-3 font-medium w-48">Location</th>
                  <th scope="col" className="px-4 py-3 font-medium w-40">Duration</th>
                  <th scope="col" className="px-4 py-3 font-medium w-20">Participants</th>
                  <th scope="col" className="px-4 py-3 font-medium w-24">Status</th>
                  <th scope="col" className="px-4 py-3 font-medium w-24">Payment</th>
                  <th scope="col" className="px-4 py-3 font-medium w-28">Payment Status</th>
                  <th scope="col" className="px-4 py-3 font-medium w-28">Paid Amount</th>
                  <th scope="col" className="px-4 py-3 font-medium w-28">Total Amount</th>
                  <th scope="col" className="px-4 py-3 font-medium w-20">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {currentBookings.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="px-6 py-8 text-center text-gray-500">
                      No package bookings found
                    </td>
                  </tr>
                ) : (
                  currentBookings.sort((a, b) => {
                    const now = new Date();
                    now.setHours(0, 0, 0, 0); // Reset to start of today
                    
                    const dateA = new Date(a.date);
                    const dateB = new Date(b.date);
                    dateA.setHours(0, 0, 0, 0);
                    dateB.setHours(0, 0, 0, 0);
                    
                    const isPastA = dateA < now;
                    const isPastB = dateB < now;
                    
                    // Push past dates to the end
                    if (isPastA && !isPastB) return 1;
                    if (!isPastA && isPastB) return -1;
                    
                    // Define priority order: pending/confirmed first, then checked-in/completed/cancelled last
                    const statusPriority: Record<string, number> = {
                      'pending': 1,
                      'confirmed': 2,
                      'checked-in': 3,
                      'completed': 4,
                      'cancelled': 5
                    };
                    
                    const priorityA = statusPriority[a.status] || 999;
                    const priorityB = statusPriority[b.status] || 999;
                    
                    // Then sort by status priority
                    if (priorityA !== priorityB) {
                      return priorityA - priorityB;
                    }
                    
                    // Then sort by date
                    const dateComparison = dateA.getTime() - dateB.getTime();
                    if (dateComparison !== 0) return dateComparison;
                    
                    // If dates are equal, sort by time
                    const timeA = a.time.split(':').map(Number);
                    const timeB = b.time.split(':').map(Number);
                    const minutesA = timeA[0] * 60 + timeA[1];
                    const minutesB = timeB[0] * 60 + timeB[1];
                    return minutesA - minutesB;
                  }).map((booking) => (
                    <tr key={booking.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={selectedBookings.includes(booking.id)}
                          onChange={() => handleSelectBooking(booking.id)}
                          className={`rounded border-gray-300 text-${fullColor} focus:ring-${themeColor}-600`}
                        />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="font-medium text-gray-900">
                          {new Date(booking.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </div>
                        <div className="text-xs text-gray-500">{booking.time}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="font-medium text-gray-900">{booking.customerName}</div>
                        <div className="text-xs text-gray-500">{booking.email}</div>
                        <div className="text-xs text-gray-500">{booking.phone}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="font-medium text-gray-900">{booking.packageName}</div>
                        <div className="text-xs text-gray-500">{booking.activity}</div>
                        <div className={`text-xs text-${fullColor}`}>{booking.room}</div>
                        {booking.attractions && booking.attractions.length > 0 && (
                          <div className="text-xs text-gray-500 mt-1">
                            Includes: {booking.attractions.map(a => `${a.name} (${a.quantity})`).join(', ')}
                          </div>
                        )}
                      </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                          {/* small size mappin */}

                        <MapPin className={`inline-block mr-1 text-${fullColor} h-4 w-4 `} /> {booking.location || <span className="text-gray-600 ">-</span>}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                        {booking.duration || <span className="text-gray-600 ">-</span>}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                        {booking.participants}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <select
                          value={booking.status}
                          onChange={(e) => handleStatusChange(booking.id, e.target.value as BookingsPageBooking['status'])}
                          className={`text-xs font-medium px-2 py-1 rounded-full ${statusColors[booking.status]} border-none focus:ring-2 focus:ring-${themeColor}-600`}
                        >
                          <option value="pending">Pending</option>
                          <option value="confirmed">Confirmed</option>
                          <option value="checked-in">Checked In</option>
                          <option value="completed">Completed</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`text-xs font-medium px-2 py-1 rounded-full ${paymentColors[booking.paymentMethod as keyof typeof paymentColors] || 'bg-gray-100 text-gray-800'}`}>
                          {(booking.paymentMethod ?? 'N/A').replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <select
                          value={booking.paymentStatus || 'pending'}
                          onChange={(e) => handlePaymentStatusChange(booking.id, e.target.value as BookingsPageBooking['paymentStatus'])}
                          className={`text-xs font-medium px-2 py-1 rounded-full ${paymentStatusColors[(booking.paymentStatus || 'pending') as keyof typeof paymentStatusColors]} border-none focus:ring-2 focus:ring-${themeColor}-600`}
                        >
                          <option value="partial">Partial</option>
                          <option value="paid">Paid</option>
                        </select>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                        ${typeof booking.amountPaid === 'number' && !isNaN(booking.amountPaid) ? booking.amountPaid.toFixed(2) : '0.00'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                        ${typeof booking.totalAmount === 'number' && !isNaN(booking.totalAmount) ? booking.totalAmount.toFixed(2) : '0.00'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium">
                        <div className="flex items-center gap-2">
                          {booking.status !== 'checked-in' && booking.status !== 'completed' && (
                            <button
                              onClick={() => handleCheckIn(booking.referenceNumber, 'checked-in')}
                              className="p-1 text-green-800 hover:text-green-800"
                              title="Check-in"
                            >
                              <CheckCircle2 className="h-4 w-4" />
                            </button>
                          )}
                          {booking.amountPaid < booking.totalAmount && (
                            <button
                              onClick={() => handleOpenPaymentModal(booking)}
                              className={`p-1 text-${fullColor} hover:text-${themeColor}-800`}
                              title="Make Payment"
                            >
                              <DollarSign className="h-4 w-4" />
                            </button>
                          )}
                          <Link
                            to={`/bookings/${booking.id}?ref=${booking.referenceNumber}`}
                            className="p-1 text-gray-800 hover:text-gray-800"
                            title="View Details"
                          >
                            <Eye className="h-4 w-4" />
                          </Link>
                          <Link
                            to={`/bookings/edit/${booking.id}?ref=${booking.referenceNumber}`}
                            className={`p-1 text-${themeColor}-600 hover:text-${fullColor}`}
                            title="Edit"
                          >
                            <Pencil className="h-4 w-4" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="bg-white px-6 py-4 border-t border-gray-100">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-800">
                  Showing <span className="font-medium">{indexOfFirstItem + 1}</span> to{' '}
                  <span className="font-medium">
                    {Math.min(indexOfLastItem, filteredBookings.length)}
                  </span>{' '}
                  of <span className="font-medium">{filteredBookings.length}</span> results
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => paginate(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1 border border-gray-200 rounded-lg text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Previous
                  </button>
                  
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <button
                      key={page}
                      onClick={() => paginate(page)}
                      className={`px-3 py-1 border rounded-lg text-sm font-medium ${
                        currentPage === page
                          ? `border-${themeColor}-500 bg-${themeColor}-500 text-white`
                          : 'border-gray-200 text-gray-800 hover:bg-gray-50'
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                  
                  <button
                    onClick={() => paginate(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 border border-gray-200 rounded-lg text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Export Modal */}
        {showExportModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-backdrop-fade">
            <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
              <div className={`p-6 border-b border-gray-100 bg-${themeColor}-50`}>
                <h2 className="text-2xl font-bold text-gray-900">Export Bookings</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Select filters to export booking data to CSV
                </p>
              </div>

              <div className="p-6 space-y-6">
                {/* Location Filter - Only for Company Admin */}
                {availableLocations.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 mb-3">Locations</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-32 overflow-y-auto border border-gray-200 rounded-lg p-3">
                      {availableLocations.map(location => (
                        <label key={location.id} className="flex items-center">
                          <input
                            type="checkbox"
                            checked={exportFilters.locations.includes(location.id)}
                            onChange={(e) => {
                              setExportFilters(prev => ({
                                ...prev,
                                locations: e.target.checked
                                  ? [...prev.locations, location.id]
                                  : prev.locations.filter(id => id !== location.id)
                              }));
                            }}
                            className={`rounded border-gray-300 text-${fullColor} focus:ring-${themeColor}-500 mr-2`}
                          />
                          <span className="text-sm text-gray-700">
                            {location.name}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* Customer Filter */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Customers</h3>
                  <div className="space-y-3">
                    <div className="relative">
                      <input
                        type="text"
                        value={customerSearchTerm}
                        onChange={(e) => {
                          setCustomerSearchTerm(e.target.value);
                          searchCustomersForExport(e.target.value);
                        }}
                        placeholder="Search customers by name or email..."
                        className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-transparent`}
                      />
                      {searchingCustomers && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-400 border-t-transparent"></div>
                        </div>
                      )}
                    </div>
                    {foundCustomersForExport.length > 0 && (
                      <div className="border border-gray-200 rounded-lg p-3 max-h-40 overflow-y-auto">
                        {foundCustomersForExport.map(customer => (
                          <label key={customer.id} className="flex items-start py-2 hover:bg-gray-50 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={exportFilters.customers.includes(customer.id)}
                              onChange={(e) => {
                                setExportFilters(prev => ({
                                  ...prev,
                                  customers: e.target.checked
                                    ? [...prev.customers, customer.id]
                                    : prev.customers.filter(id => id !== customer.id)
                                }));
                              }}
                              className={`rounded border-gray-300 text-${fullColor} focus:ring-${themeColor}-500 mr-2 mt-1`}
                            />
                            <div>
                              <p className="text-sm font-medium text-gray-900">{customer.name}</p>
                              <p className="text-xs text-gray-500">{customer.email}</p>
                            </div>
                          </label>
                        ))}
                      </div>
                    )}
                    {exportFilters.customers.length > 0 && (
                      <div className="text-sm text-gray-600">
                        {exportFilters.customers.length} customer(s) selected
                      </div>
                    )}
                  </div>
                </div>

                {/* Date Range */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-gray-900">Date Range</h3>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setQuickDateRange('today')}
                        className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50"
                      >
                        Today
                      </button>
                      <button
                        type="button"
                        onClick={() => setQuickDateRange('7days')}
                        className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50"
                      >
                        7 Days
                      </button>
                      <button
                        type="button"
                        onClick={() => setQuickDateRange('30days')}
                        className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50"
                      >
                        30 Days
                      </button>
                      <button
                        type="button"
                        onClick={() => setQuickDateRange('year')}
                        className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50"
                      >
                        1 Year
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Start Date
                      </label>
                      <input
                        type="date"
                        value={exportFilters.startDate}
                        onChange={(e) => setExportFilters(prev => ({ ...prev, startDate: e.target.value }))}
                        className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-transparent`}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        End Date
                      </label>
                      <input
                        type="date"
                        value={exportFilters.endDate}
                        onChange={(e) => setExportFilters(prev => ({ ...prev, endDate: e.target.value }))}
                        className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-transparent`}
                      />
                    </div>
                  </div>
                </div>

                {/* Status Filter */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Status</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {['pending', 'confirmed', 'checked-in', 'completed', 'cancelled'].map(status => (
                      <label key={status} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={exportFilters.statuses.includes(status)}
                          onChange={(e) => {
                            setExportFilters(prev => ({
                              ...prev,
                              statuses: e.target.checked
                                ? [...prev.statuses, status]
                                : prev.statuses.filter(s => s !== status)
                            }));
                          }}
                          className={`rounded border-gray-300 text-${fullColor} focus:ring-${themeColor}-500 mr-2`}
                        />
                        <span className="text-sm text-gray-700 capitalize">
                          {status === 'checked-in' ? 'Checked In' : status}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Amount Range */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Amount Range</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Min Amount ($)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={exportFilters.minAmount}
                        onChange={(e) => setExportFilters(prev => ({ ...prev, minAmount: e.target.value }))}
                        className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-transparent`}
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Max Amount ($)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={exportFilters.maxAmount}
                        onChange={(e) => setExportFilters(prev => ({ ...prev, maxAmount: e.target.value }))}
                        className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-transparent`}
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                </div>

                {/* Export Info */}
                <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <Download className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-blue-900">
                        CSV Export Format
                      </p>
                      <p className="text-xs text-blue-800 mt-1">
                        Your data will be exported in CSV format including all booking details, customer information, attractions, add-ons, and payment information.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-gray-100 flex gap-3 justify-end">
                <button
                  onClick={() => {
                    setShowExportModal(false);
                    setExportFilters({
                      locations: [],
                      customers: [],
                      statuses: [],
                      startDate: '',
                      endDate: '',
                      minAmount: '',
                      maxAmount: ''
                    });
                    setCustomerSearchTerm('');
                    setFoundCustomersForExport([]);
                    if (customerSearchDebounce) {
                      clearTimeout(customerSearchDebounce);
                    }
                  }}
                  disabled={exporting}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleExport}
                  disabled={exporting}
                  className={`px-6 py-2 bg-${fullColor} text-white rounded-lg hover:bg-${themeColor}-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2`}
                >
                  {exporting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                      Exporting...
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4" />
                      Export to CSV
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Payment Modal */}
        {showPaymentModal && selectedBookingForPayment && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-backdrop-fade">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4">
              <div className={`p-6 border-b border-gray-100 bg-${themeColor}-50`}>
                <h2 className="text-2xl font-bold text-gray-900">Process Payment</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Booking: {selectedBookingForPayment.referenceNumber}
                </p>
              </div>

              <div className="p-6 space-y-4">
                {/* Payment Summary */}
                <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Total Amount:</span>
                    <span className="font-semibold">${selectedBookingForPayment.totalAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Already Paid:</span>
                    <span className="font-semibold text-green-600">${selectedBookingForPayment.amountPaid.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm pt-2 border-t border-gray-200">
                    <span className="text-gray-900 font-medium">Remaining Balance:</span>
                    <span className="font-bold text-red-600">
                      ${(selectedBookingForPayment.totalAmount - selectedBookingForPayment.amountPaid).toFixed(2)}
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
                      max={(selectedBookingForPayment.totalAmount - selectedBookingForPayment.amountPaid).toFixed(2)}
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
  );
};

export default Bookings;