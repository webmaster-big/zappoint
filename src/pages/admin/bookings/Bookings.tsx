// src/pages/admin/bookings/Bookings.tsx
import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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
  Plus,
  FileText,
  Check,
  X,
  Edit3,
  Clock,
  Home,
  FileDown
} from 'lucide-react';
import { useThemeColor } from '../../../hooks/useThemeColor';
import StandardButton from '../../../components/ui/StandardButton';
import CounterAnimation from '../../../components/ui/CounterAnimation';
import type { BookingsPageBooking, BookingsPageFilterOptions } from '../../../types/Bookings.types';
import bookingService from '../../../services/bookingService';
import { bookingCacheService } from '../../../services/BookingCacheService';
import { createPayment, PAYMENT_TYPE } from '../../../services/PaymentService';
import { locationService } from '../../../services/LocationService';
import LocationSelector from '../../../components/admin/LocationSelector';
import { getStoredUser, API_BASE_URL } from '../../../utils/storage';
import { formatDurationDisplay } from '../../../utils/timeFormat';
import { MapPin } from 'lucide-react';
import { packageService, type Package as PackageType } from '../../../services/PackageService';
import { roomService, type Room } from '../../../services/RoomService';
import { packageCacheService } from '../../../services/PackageCacheService';
import { roomCacheService } from '../../../services/RoomCacheService';

// Convert 24-hour time to 12-hour format with AM/PM
const formatTime12Hour = (time24: string): string => {
  if (!time24) return '';
  const [hours24, minutes] = time24.split(':');
  const hours = parseInt(hours24, 10);
  const period = hours >= 12 ? 'PM' : 'AM';
  const hours12 = hours % 12 || 12;
  return `${hours12}:${minutes} ${period}`;
};

// Helper function to parse ISO date string (YYYY-MM-DD) in local timezone
// Avoids UTC offset issues that cause date to show as previous day
const parseLocalDate = (isoDateString: string): Date => {
  if (!isoDateString) return new Date();
  const [year, month, day] = isoDateString.split('T')[0].split('-').map(Number);
  return new Date(year, month - 1, day);
};

const Bookings: React.FC = () => {
  const { themeColor, fullColor } = useThemeColor();
  const navigate = useNavigate();
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
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'in-store'>('in-store');
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
  const [showInternalNotesModal, setShowInternalNotesModal] = useState(false);
  const [selectedBookingForNotes, setSelectedBookingForNotes] = useState<BookingsPageBooking | null>(null);
  const [internalNotesText, setInternalNotesText] = useState('');
  const [savingInternalNotes, setSavingInternalNotes] = useState(false);
  
  const currentUser = getStoredUser();
  const isCompanyAdmin = currentUser?.role === 'company_admin';
  const [selectedLocation, setSelectedLocation] = useState<number | null>(null);

  // Inline editing state
  const [editingCell, setEditingCell] = useState<{ bookingId: string; field: string } | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [savingCell, setSavingCell] = useState<{ bookingId: string; field: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Package/Room selection modal states
  const [showPackageModal, setShowPackageModal] = useState(false);
  const [showRoomModal, setShowRoomModal] = useState(false);
  const [selectedBookingForEdit, setSelectedBookingForEdit] = useState<BookingsPageBooking | null>(null);
  const [availablePackages, setAvailablePackages] = useState<PackageType[]>([]);
  const [availableRooms, setAvailableRooms] = useState<Room[]>([]);
  const [loadingPackages, setLoadingPackages] = useState(false);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [savingPackage, setSavingPackage] = useState(false);
  const [savingRoom, setSavingRoom] = useState(false);

  // Duration editing state
  const [showDurationModal, setShowDurationModal] = useState(false);
  const [durationValue, setDurationValue] = useState<number>(2);
  const [durationUnit, setDurationUnit] = useState<'hours' | 'minutes'>('hours');
  const [savingDuration, setSavingDuration] = useState(false);

  // Date/Time editing state
  const [showDateModal, setShowDateModal] = useState(false);
  const [showTimeModal, setShowTimeModal] = useState(false);
  const [dateValue, setDateValue] = useState<string>('');
  const [timeValue, setTimeValue] = useState<string>('');
  const [savingDate, setSavingDate] = useState(false);
  const [savingTime, setSavingTime] = useState(false);

  // Booking Details Report modal state
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportFilters, setReportFilters] = useState({
    packageIds: 'all' as string | number[],
    periodType: 'today' as 'today' | 'weekly' | 'monthly' | 'custom',
    weekOfMonth: 1,
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    startDate: '',
    endDate: '',
    viewMode: 'individual' as 'list' | 'individual',
    status: [] as string[],
    includeCancelled: false
  });
  const [generatingReport, setGeneratingReport] = useState(false);
  const [reportPackages, setReportPackages] = useState<PackageType[]>([]);
  const [loadingReportPackages, setLoadingReportPackages] = useState(false);

  // Editable fields configuration
  const editableFields = [
    { key: 'customerName', label: 'Customer Name', type: 'text', apiField: 'guest_name' },
    { key: 'email', label: 'Email', type: 'email', apiField: 'guest_email' },
    { key: 'phone', label: 'Phone', type: 'tel', apiField: 'guest_phone' },
    { key: 'participants', label: 'Participants', type: 'number', apiField: 'participants' },
    { key: 'totalAmount', label: 'Total Amount', type: 'number', apiField: 'total_amount' },
    { key: 'amountPaid', label: 'Amount Paid', type: 'number', apiField: 'amount_paid' },
    { key: 'notes', label: 'Notes', type: 'text', apiField: 'notes' },
  ];

  // Status and payment colors
  const statusColors = {
    pending: 'bg-yellow-100 text-yellow-800',
    confirmed: `bg-${themeColor}-100 text-${fullColor}`,
    cancelled: 'bg-red-100 text-red-800',
    'checked-in': 'bg-green-100 text-green-800'
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
      value: `$${Number(bookings.reduce((sum, booking) => sum + booking.amountPaid, 0)).toFixed(2)}`,
      change: 'All bookings',
      icon: DollarSign,
      accent: `bg-${themeColor}-100 text-${fullColor}`,
    },
  ];

  // Load bookings from backend API
  useEffect(() => {
    loadLocations();
    
    // Warm up package and room caches in background for faster modal loading
    packageCacheService.warmupCache();
    roomCacheService.warmupCache();
  }, []);
  
  useEffect(() => {
    loadBookings();
  }, [selectedLocation]);

  const loadLocations = async () => {
    try {
      if (isCompanyAdmin) {
        const response = await locationService.getLocations();
        if (response.success && response.data) {
          const locationsArray = Array.isArray(response.data) ? response.data : [];
          setAvailableLocations(locationsArray.map((loc: any) => ({
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
      
      // Check if cache has data first for instant loading
      const hasCachedData = await bookingCacheService.hasCachedData();
      
      if (hasCachedData) {
        console.log('[Bookings] Loading from cache...');
        
        // Build filter for cache
        const cacheFilters: any = {};
        if (selectedLocation !== null) {
          cacheFilters.location_id = selectedLocation;
        }
        
        // Get bookings from cache
        const cachedBookings = await bookingCacheService.getFilteredBookingsFromCache(cacheFilters);
        
        if (cachedBookings && cachedBookings.length > 0) {
          // Transform cached booking data to match BookingsPageBooking interface
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const transformedBookings: BookingsPageBooking[] = cachedBookings.map((booking: any) => ({
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
              ? formatDurationDisplay(booking.duration, booking.duration_unit)
              : '2 hours',
            activity: booking.package?.category || 'Package Booking',
            notes: booking.notes,
            referenceNumber: booking.reference_number,
            location: booking.location?.name || 'N/A',
          }));
          console.log('[Bookings] Loaded from cache:', transformedBookings.length, 'bookings');
          setBookings(transformedBookings);
          setLoading(false);
          return;
        }
      }
      
      // No cache or cache is empty - fetch from API
      console.log('[Bookings] Fetching from API...');
      const params: any = {
        page: 1,
        per_page: 1000,
        user_id: getStoredUser()?.id,
        sort_by: 'booking_date',
        sort_order: 'asc',
      };
      if (selectedLocation !== null) {
        params.location_id = selectedLocation;
      }
      const response = await bookingService.getBookings(params);
      
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
            ? formatDurationDisplay(booking.duration, booking.duration_unit)
            : '2 hours',
          activity: booking.package?.category || 'Package Booking',
          notes: booking.notes,
          referenceNumber: booking.reference_number,
          location: booking.location?.name || 'N/A',
        }));
        console.log('[Bookings] Fetched from API:', transformedBookings.length, 'bookings');
        setBookings(transformedBookings);
        
        // Cache the raw API data for next time
        await bookingCacheService.cacheBookings(response.data.bookings);
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
              ? formatDurationDisplay(booking.duration, booking.duration_unit)
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
      const response = await bookingService.checkInBooking(referenceNumber, userId);
      
      // Update cache with checked-in booking
      if (response?.data) {
        await bookingCacheService.updateBookingInCache(response.data);
      }
      
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
      // Find the booking
      const booking = bookings.find(b => b.id === id);
      if (!booking) return;

      const response = await bookingService.updateBooking(Number(id), { status: newStatus });
      
      // Sync the updated booking to cache
      if (response.data) {
        await bookingCacheService.updateBookingInCache(response.data);
      }
      
      // Log activity
      await logBookingActivity(booking, 'update', `Status changed to ${newStatus}`);
      
      // Update local state
      const updatedBookings = bookings.map(b =>
        b.id === id ? { ...b, status: newStatus } : b
      );
      setBookings(updatedBookings);
    } catch (error) {
      console.error('Error updating booking status:', error);
      alert('Failed to update booking status. Please try again.');
    }
  };

  const handlePaymentStatusChange = async (id: string, newPaymentStatus: BookingsPageBooking['paymentStatus']) => {
    try {
      // Find the booking to get total amount
      const booking = bookings.find(b => b.id === id);
      if (!booking) return;
      
      // If trying to set to 'paid' but amount paid doesn't match total, show payment modal
      if (newPaymentStatus === 'paid' && booking.amountPaid < booking.totalAmount) {
        handleOpenPaymentModal(booking);
        return;
      }
      
      // Build update payload - if setting to 'paid', also update amount_paid to match total
      const updatePayload: Record<string, unknown> = { payment_status: newPaymentStatus };
      
      if (newPaymentStatus === 'paid') {
        // When marking as paid, set amount_paid to full total amount
        updatePayload.amount_paid = booking.totalAmount;
      }
      
      // Update payment status via API
      const response = await bookingService.updateBooking(Number(id), updatePayload);
      
      // Sync the updated booking to cache
      if (response.data) {
        await bookingCacheService.updateBookingInCache(response.data);
      }
      
      // Log activity
      await logBookingActivity(booking, 'update', `Payment status changed to ${newPaymentStatus}`);
      
      // Update local state
      const updatedBookings = bookings.map(b => {
        if (b.id === id) {
          const updates: Partial<BookingsPageBooking> = { paymentStatus: newPaymentStatus };
          if (newPaymentStatus === 'paid') {
            updates.amountPaid = b.totalAmount;
          }
          return { ...b, ...updates };
        }
        return b;
      });
      setBookings(updatedBookings);
    } catch (error) {
      console.error('Error updating payment status:', error);
      alert('Failed to update payment status. Please try again.');
    }
  };

  // Activity logging function
  const logBookingActivity = async (
    booking: BookingsPageBooking, 
    action: string, 
    description: string,
    locationId?: number
  ) => {
    try {
      const user = getStoredUser();
      if (!user) return;

      // Get location_id from booking cache if not provided
      let bookingLocationId = locationId;
      if (!bookingLocationId) {
        const cachedBooking = await bookingCacheService.getBookingFromCache(Number(booking.id));
        bookingLocationId = cachedBooking?.location_id;
      }

      await fetch(`${API_BASE_URL}/activity-logs`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${user.token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          user_id: user.id,
          location_id: bookingLocationId,
          action: action,
          entity_type: 'booking',
          entity_id: Number(booking.id),
          category: 'booking',
          description: description,
          metadata: {
            resource_name: `Booking #${booking.referenceNumber}`,
            customer_name: booking.customerName,
            package_name: booking.packageName
          }
        })
      });
    } catch (error) {
      console.error('Error logging activity:', error);
      // Don't throw - logging errors shouldn't block the main operation
    }
  };

  // Package modal functions
  const handleOpenPackageModal = async (booking: BookingsPageBooking) => {
    setSelectedBookingForEdit(booking);
    setShowPackageModal(true);
    setLoadingPackages(true);
    
    try {
      // Get location_id from booking cache
      const cachedBooking = await bookingCacheService.getBookingFromCache(Number(booking.id));
      const locationId = cachedBooking?.location_id;
      
      if (locationId) {
        // Try to get packages from cache first for faster loading
        const cachedPackages = await packageCacheService.getCachedPackages();
        
        if (cachedPackages && cachedPackages.length > 0) {
          // Filter cached packages by location and active status
          const filteredPackages = cachedPackages.filter(
            (pkg: PackageType) => pkg.location_id === locationId && pkg.is_active
          );
          setAvailablePackages(filteredPackages);
          setLoadingPackages(false);
          
          // Sync in background to keep cache fresh
          packageCacheService.syncInBackground({ location_id: locationId, is_active: true });
        } else {
          // No cache, fetch from API and cache the result
          const packages = await packageCacheService.fetchAndCachePackages({ 
            location_id: locationId, 
            is_active: true 
          });
          const filteredPackages = packages.filter(
            (pkg: PackageType) => pkg.location_id === locationId && pkg.is_active
          );
          setAvailablePackages(filteredPackages);
        }
      }
    } catch (error) {
      console.error('Error loading packages:', error);
      // Fallback to direct API call if cache fails
      try {
        const cachedBooking = await bookingCacheService.getBookingFromCache(Number(booking.id));
        const locationId = cachedBooking?.location_id;
        if (locationId) {
          const response = await packageService.getPackages({ location_id: locationId, is_active: true });
          if (response.success && response.data) {
            setAvailablePackages(response.data.packages || []);
          }
        }
      } catch (fallbackError) {
        console.error('Fallback package loading failed:', fallbackError);
      }
    } finally {
      setLoadingPackages(false);
    }
  };

  const handleClosePackageModal = () => {
    setShowPackageModal(false);
    setSelectedBookingForEdit(null);
    setAvailablePackages([]);
  };

  const handleSelectPackage = async (pkg: PackageType) => {
    if (!selectedBookingForEdit) return;
    
    setSavingPackage(true);
    try {
      const response = await bookingService.updateBooking(Number(selectedBookingForEdit.id), {
        package_id: pkg.id
      });
      
      if (response.success || response.data) {
        if (response.data) {
          await bookingCacheService.updateBookingInCache(response.data);
        }
        
        // Log activity
        await logBookingActivity(
          selectedBookingForEdit, 
          'update', 
          `Package changed to ${pkg.name}`
        );
        
        // Update local state
        setBookings(prev =>
          prev.map(b => 
            b.id === selectedBookingForEdit.id 
              ? { ...b, packageName: pkg.name, activity: pkg.category || 'Package Booking' }
              : b
          )
        );
        
        handleClosePackageModal();
      }
    } catch (error) {
      console.error('Error updating package:', error);
      alert('Failed to update package. Please try again.');
    } finally {
      setSavingPackage(false);
    }
  };

  // Room modal functions
  const handleOpenRoomModal = async (booking: BookingsPageBooking) => {
    setSelectedBookingForEdit(booking);
    setShowRoomModal(true);
    setLoadingRooms(true);
    
    try {
      // Get location_id from booking cache
      const cachedBooking = await bookingCacheService.getBookingFromCache(Number(booking.id));
      const locationId = cachedBooking?.location_id;
      
      if (locationId) {
        // Try to get rooms from cache first for faster loading
        const cachedRooms = await roomCacheService.getCachedRooms();
        
        if (cachedRooms && cachedRooms.length > 0) {
          // Filter cached rooms by location and availability status
          const filteredRooms = cachedRooms.filter(
            (room: Room) => room.location_id === locationId && room.is_available
          );
          setAvailableRooms(filteredRooms);
          setLoadingRooms(false);
          
          // Sync in background to keep cache fresh
          roomCacheService.syncInBackground({ location_id: locationId, is_available: true });
        } else {
          // No cache, fetch from API and cache the result
          const rooms = await roomCacheService.fetchAndCacheRooms({ 
            location_id: locationId, 
            is_available: true 
          });
          const filteredRooms = rooms.filter(
            (room: Room) => room.location_id === locationId && room.is_available
          );
          setAvailableRooms(filteredRooms);
        }
      }
    } catch (error) {
      console.error('Error loading rooms:', error);
      // Fallback to direct API call if cache fails
      try {
        const cachedBooking = await bookingCacheService.getBookingFromCache(Number(booking.id));
        const locationId = cachedBooking?.location_id;
        if (locationId) {
          const response = await roomService.getRooms({ location_id: locationId, is_available: true });
          if (response.success && response.data) {
            setAvailableRooms(response.data.rooms || []);
          }
        }
      } catch (fallbackError) {
        console.error('Fallback room loading failed:', fallbackError);
      }
    } finally {
      setLoadingRooms(false);
    }
  };

  const handleCloseRoomModal = () => {
    setShowRoomModal(false);
    setSelectedBookingForEdit(null);
    setAvailableRooms([]);
  };

  const handleSelectRoom = async (room: Room) => {
    if (!selectedBookingForEdit) return;
    
    setSavingRoom(true);
    try {
      const response = await bookingService.updateBooking(Number(selectedBookingForEdit.id), {
        room_id: room.id
      });
      
      if (response.success || response.data) {
        if (response.data) {
          await bookingCacheService.updateBookingInCache(response.data);
        }
        
        // Log activity
        await logBookingActivity(
          selectedBookingForEdit, 
          'update', 
          `Room changed to ${room.name}`
        );
        
        // Update local state
        setBookings(prev =>
          prev.map(b => 
            b.id === selectedBookingForEdit.id 
              ? { ...b, room: room.name }
              : b
          )
        );
        
        handleCloseRoomModal();
      }
    } catch (error) {
      console.error('Error updating room:', error);
      alert('Failed to update room. Please try again.');
    } finally {
      setSavingRoom(false);
    }
  };

  // Duration modal functions
  const handleOpenDurationModal = (booking: BookingsPageBooking) => {
    setSelectedBookingForEdit(booking);
    // Parse existing duration if available
    const durationMatch = booking.duration?.match(/(\d+)\s*(hour|minute|hr|min)/i);
    if (durationMatch) {
      setDurationValue(parseInt(durationMatch[1], 10));
      setDurationUnit(durationMatch[2].toLowerCase().startsWith('min') ? 'minutes' : 'hours');
    } else {
      setDurationValue(2);
      setDurationUnit('hours');
    }
    setShowDurationModal(true);
  };

  const handleCloseDurationModal = () => {
    setShowDurationModal(false);
    setSelectedBookingForEdit(null);
    setDurationValue(2);
    setDurationUnit('hours');
  };

  const handleSaveDuration = async () => {
    if (!selectedBookingForEdit) return;
    
    setSavingDuration(true);
    try {
      const response = await bookingService.updateBooking(Number(selectedBookingForEdit.id), {
        duration: durationValue,
        duration_unit: durationUnit
      });
      
      if (response.success || response.data) {
        if (response.data) {
          await bookingCacheService.updateBookingInCache(response.data);
        }
        
        // Log activity
        await logBookingActivity(
          selectedBookingForEdit, 
          'update', 
          `Duration changed to ${durationValue} ${durationUnit}`
        );
        
        // Update local state
        const formattedDuration = formatDurationDisplay(durationValue, durationUnit);
        setBookings(prev =>
          prev.map(b => 
            b.id === selectedBookingForEdit.id 
              ? { ...b, duration: formattedDuration }
              : b
          )
        );
        
        handleCloseDurationModal();
      }
    } catch (error) {
      console.error('Error updating duration:', error);
      alert('Failed to update duration. Please try again.');
    } finally {
      setSavingDuration(false);
    }
  };

  // Date modal functions
  const handleOpenDateModal = (booking: BookingsPageBooking) => {
    setSelectedBookingForEdit(booking);
    setDateValue(booking.date);
    setShowDateModal(true);
  };

  const handleCloseDateModal = () => {
    setShowDateModal(false);
    setSelectedBookingForEdit(null);
    setDateValue('');
  };

  const handleSaveDate = async () => {
    if (!selectedBookingForEdit || !dateValue) return;
    
    setSavingDate(true);
    try {
      const response = await bookingService.updateBooking(Number(selectedBookingForEdit.id), {
        booking_date: dateValue
      });
      
      if (response.success || response.data) {
        if (response.data) {
          await bookingCacheService.updateBookingInCache(response.data);
        }
        
        // Log activity
        await logBookingActivity(
          selectedBookingForEdit, 
          'update', 
          `Date changed to ${dateValue}`
        );
        
        // Update local state
        setBookings(prev =>
          prev.map(b => 
            b.id === selectedBookingForEdit.id 
              ? { ...b, date: dateValue }
              : b
          )
        );
        
        handleCloseDateModal();
      }
    } catch (error) {
      console.error('Error updating date:', error);
      alert('Failed to update date. Please try again.');
    } finally {
      setSavingDate(false);
    }
  };

  // Time modal functions
  const handleOpenTimeModal = (booking: BookingsPageBooking) => {
    setSelectedBookingForEdit(booking);
    setTimeValue(booking.time);
    setShowTimeModal(true);
  };

  const handleCloseTimeModal = () => {
    setShowTimeModal(false);
    setSelectedBookingForEdit(null);
    setTimeValue('');
  };

  const handleSaveTime = async () => {
    if (!selectedBookingForEdit || !timeValue) return;
    
    setSavingTime(true);
    try {
      const response = await bookingService.updateBooking(Number(selectedBookingForEdit.id), {
        booking_time: timeValue
      });
      
      if (response.success || response.data) {
        if (response.data) {
          await bookingCacheService.updateBookingInCache(response.data);
        }
        
        // Log activity
        await logBookingActivity(
          selectedBookingForEdit, 
          'update', 
          `Time changed to ${formatTime12Hour(timeValue)}`
        );
        
        // Update local state
        setBookings(prev =>
          prev.map(b => 
            b.id === selectedBookingForEdit.id 
              ? { ...b, time: timeValue }
              : b
          )
        );
        
        handleCloseTimeModal();
      }
    } catch (error) {
      console.error('Error updating time:', error);
      alert('Failed to update time. Please try again.');
    } finally {
      setSavingTime(false);
    }
  };

  // Report modal functions
  const handleOpenReportModal = async () => {
    setShowReportModal(true);
    setLoadingReportPackages(true);
    
    try {
      // Load packages for selection
      const cachedPackages = await packageCacheService.getCachedPackages();
      
      if (cachedPackages && cachedPackages.length > 0) {
        // Filter by selected location if applicable
        const filteredPackages = selectedLocation 
          ? cachedPackages.filter((pkg: PackageType) => pkg.location_id === selectedLocation && pkg.is_active)
          : cachedPackages.filter((pkg: PackageType) => pkg.is_active);
        setReportPackages(filteredPackages);
      } else {
        // Fetch from API
        const params: any = { is_active: true };
        if (selectedLocation) params.location_id = selectedLocation;
        
        const response = await packageService.getPackages(params);
        if (response.success && response.data) {
          setReportPackages(response.data.packages || []);
        }
      }
    } catch (error) {
      console.error('Error loading packages for report:', error);
    } finally {
      setLoadingReportPackages(false);
    }
  };

  const handleCloseReportModal = () => {
    setShowReportModal(false);
    setReportFilters({
      packageIds: 'all',
      periodType: 'today',
      weekOfMonth: 1,
      month: new Date().getMonth() + 1,
      year: new Date().getFullYear(),
      startDate: '',
      endDate: '',
      viewMode: 'individual',
      status: [],
      includeCancelled: false
    });
  };

  const handleGenerateReport = async () => {
    try {
      setGeneratingReport(true);
      
      const user = getStoredUser();
      const params = new URLSearchParams();
      
      // Package IDs
      if (Array.isArray(reportFilters.packageIds)) {
        params.append('package_ids', reportFilters.packageIds.join(','));
      } else {
        params.append('package_ids', reportFilters.packageIds);
      }
      
      // Period type
      params.append('period_type', reportFilters.periodType);
      
      // Conditional parameters based on period type
      if (reportFilters.periodType === 'weekly') {
        params.append('week_of_month', reportFilters.weekOfMonth.toString());
        params.append('month', reportFilters.month.toString());
        params.append('year', reportFilters.year.toString());
      } else if (reportFilters.periodType === 'monthly') {
        params.append('month', reportFilters.month.toString());
        params.append('year', reportFilters.year.toString());
      } else if (reportFilters.periodType === 'custom') {
        if (!reportFilters.startDate || !reportFilters.endDate) {
          alert('Please select both start and end dates for custom date range.');
          setGeneratingReport(false);
          return;
        }
        params.append('start_date', reportFilters.startDate);
        params.append('end_date', reportFilters.endDate);
      }
      
      // View mode
      params.append('view_mode', reportFilters.viewMode);
      
      // Optional filters
      if (selectedLocation) {
        params.append('location_id', selectedLocation.toString());
      }
      
      if (reportFilters.status.length > 0) {
        params.append('status', reportFilters.status.join(','));
      }
      
      if (reportFilters.includeCancelled) {
        params.append('include_cancelled', 'true');
      }
      
      if (user?.id) {
        params.append('user_id', user.id.toString());
      }
      
      // Build the URL and open in new tab to download
      const reportUrl = `${API_BASE_URL}/bookings/details-report?${params.toString()}`;
      
      // Use fetch to handle potential errors
      const response = await fetch(reportUrl, {
        headers: {
          'Authorization': `Bearer ${user?.token}`,
          'Accept': 'application/pdf'
        }
      });
      
      if (!response.ok) {
        if (response.status === 404) {
          const errorData = await response.json();
          alert(errorData.message || 'No bookings found for the specified criteria.');
        } else if (response.status === 422) {
          const errorData = await response.json();
          alert('Validation error: ' + (errorData.message || 'Please check your filters.'));
        } else {
          alert('Failed to generate report. Please try again.');
        }
        return;
      }
      
      // Download the PDF
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      // Extract filename from Content-Disposition header or generate one
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = 'booking-details-report.pdf';
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (filenameMatch) {
          filename = filenameMatch[1].replace(/['"]/g, '');
        }
      }
      
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      handleCloseReportModal();
    } catch (error) {
      console.error('Error generating report:', error);
      alert('Failed to generate report. Please try again.');
    } finally {
      setGeneratingReport(false);
    }
  };

  const getMonthName = (month: number): string => {
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                    'July', 'August', 'September', 'October', 'November', 'December'];
    return months[month - 1] || '';
  };

  const toggleReportPackage = (packageId: number) => {
    if (reportFilters.packageIds === 'all') {
      // When "All" is selected, clicking a package deselects it (selects all others)
      const allOtherIds = reportPackages.filter(pkg => pkg.id !== packageId).map(pkg => pkg.id);
      setReportFilters(prev => ({ 
        ...prev, 
        packageIds: allOtherIds.length === 0 ? 'all' : allOtherIds 
      }));
    } else if (Array.isArray(reportFilters.packageIds)) {
      if (reportFilters.packageIds.includes(packageId)) {
        // Remove package
        const newIds = reportFilters.packageIds.filter(id => id !== packageId);
        setReportFilters(prev => ({ 
          ...prev, 
          packageIds: newIds.length === 0 ? 'all' : newIds 
        }));
      } else {
        // Add package - check if adding this makes it all packages
        const newIds = [...reportFilters.packageIds, packageId];
        const allSelected = reportPackages.every(pkg => newIds.includes(pkg.id));
        setReportFilters(prev => ({ 
          ...prev, 
          packageIds: allSelected ? 'all' : newIds 
        }));
      }
    }
  };

  const toggleReportStatus = (status: string) => {
    setReportFilters(prev => ({
      ...prev,
      status: prev.status.includes(status)
        ? prev.status.filter(s => s !== status)
        : [...prev.status, status]
    }));
  };

  const toggleAllPackages = () => {
    if (reportFilters.packageIds === 'all') {
      // Uncheck all - set to empty array
      setReportFilters(prev => ({ ...prev, packageIds: [] }));
    } else {
      // Check all
      setReportFilters(prev => ({ ...prev, packageIds: 'all' }));
    }
  };

  // Inline editing functions
  const startEditing = (bookingId: string, field: string, currentValue: string | number) => {
    setEditingCell({ bookingId, field });
    setEditValue(String(currentValue ?? ''));
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const cancelEdit = () => {
    setEditingCell(null);
    setEditValue('');
  };

  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveEdit();
    } else if (e.key === 'Escape') {
      cancelEdit();
    }
  };

  const saveEdit = async () => {
    if (!editingCell) return;

    const booking = bookings.find(b => b.id === editingCell.bookingId);
    if (!booking) return;

    const fieldConfig = editableFields.find(f => f.key === editingCell.field);
    if (!fieldConfig) return;

    const oldValue = booking[editingCell.field as keyof BookingsPageBooking];
    const oldValueStr = String(oldValue ?? '');

    // Skip if no change
    if (editValue === oldValueStr) {
      setEditingCell(null);
      setEditValue('');
      return;
    }

    setSavingCell(editingCell);

    try {
      // Prepare update payload
      let updateValue: string | number | null = editValue;
      
      // Handle numeric fields
      if (['participants', 'totalAmount', 'amountPaid'].includes(editingCell.field)) {
        updateValue = editValue ? parseFloat(editValue) : 0;
      } else if (editValue === '') {
        updateValue = null;
      }

      const payload = {
        [fieldConfig.apiField]: updateValue,
      };

      const response = await bookingService.updateBooking(Number(editingCell.bookingId), payload);

      if (response.success || response.data) {
        // Update cache
        if (response.data) {
          await bookingCacheService.updateBookingInCache(response.data);
        }

        // Log activity
        await logBookingActivity(
          booking, 
          'update', 
          `${fieldConfig.label} updated from "${oldValueStr}" to "${editValue}"`
        );

        // Update local state with proper field mapping
        setBookings(prev =>
          prev.map(b => {
            if (b.id === editingCell.bookingId) {
              const updates: Partial<BookingsPageBooking> = {};
              
              // Map API field back to local field
              if (editingCell.field === 'customerName') {
                updates.customerName = editValue;
              } else if (editingCell.field === 'email') {
                updates.email = editValue;
              } else if (editingCell.field === 'phone') {
                updates.phone = editValue;
              } else if (editingCell.field === 'participants') {
                updates.participants = Number(editValue) || 0;
              } else if (editingCell.field === 'totalAmount') {
                updates.totalAmount = Number(editValue) || 0;
              } else if (editingCell.field === 'amountPaid') {
                updates.amountPaid = Number(editValue) || 0;
              } else if (editingCell.field === 'notes') {
                updates.notes = editValue;
              }
              
              return { ...b, ...updates };
            }
            return b;
          })
        );
      }
    } catch (error) {
      console.error('Error updating booking:', error);
      alert('Failed to update booking. Please try again.');
    } finally {
      setSavingCell(null);
      setEditingCell(null);
      setEditValue('');
    }
  };

  // Render editable cell
  const renderEditableCell = (
    booking: BookingsPageBooking, 
    field: string, 
    displayValue: React.ReactNode,
    className: string = ''
  ) => {
    const isEditing = editingCell?.bookingId === booking.id && editingCell?.field === field;
    const isSaving = savingCell?.bookingId === booking.id && savingCell?.field === field;
    const fieldConfig = editableFields.find(f => f.key === field);

    if (isEditing) {
      return (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <input
            ref={inputRef}
            type={fieldConfig?.type || 'text'}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleEditKeyDown}
            className={`w-full px-1.5 py-0.5 text-xs border border-${themeColor}-400 rounded bg-white text-gray-900 focus:outline-none focus:ring-1 focus:ring-${themeColor}-500`}
            disabled={isSaving}
            autoFocus
          />
          <button
            onClick={(e) => { e.stopPropagation(); saveEdit(); }}
            className="p-0.5 text-green-600 hover:text-green-700"
            disabled={isSaving}
          >
            <Check className="w-3 h-3" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); cancelEdit(); }}
            className="p-0.5 text-red-600 hover:text-red-700"
            disabled={isSaving}
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      );
    }

    return (
      <div
        className={`group cursor-pointer flex items-center gap-1 hover:bg-gray-100 rounded px-1 py-0.5 -mx-1 min-h-[20px] ${className}`}
        onClick={() => startEditing(booking.id, field, booking[field as keyof BookingsPageBooking] as string | number)}
        title="Click to edit"
      >
        <span className="truncate">{displayValue || <span className="text-gray-400 italic">—</span>}</span>
        <Edit3 className="w-2.5 h-2.5 text-gray-400 opacity-0 group-hover:opacity-100 flex-shrink-0" />
      </div>
    );
  };

  const handleBulkDelete = async () => {
    if (selectedBookings.length === 0) return;
    
    if (window.confirm(`Are you sure you want to delete ${selectedBookings.length} booking(s)?`)) {
      try {
        // Delete each booking via API
        await Promise.all(
          selectedBookings.map(async (id) => {
            await bookingService.deleteBooking(Number(id));
            // Remove from cache
            await bookingCacheService.removeBookingFromCache(Number(id));
          })
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

  const handleDeleteBooking = async (id: string, referenceNumber: string) => {
    if (window.confirm(`Are you sure you want to delete booking #${referenceNumber}?`)) {
      try {
        await bookingService.deleteBooking(Number(id));
        
        // Remove from cache
        await bookingCacheService.removeBookingFromCache(Number(id));
        
        // Update local state
        const updatedBookings = bookings.filter(booking => booking.id !== id);
        setBookings(updatedBookings);
      } catch (error) {
        console.error('Error deleting booking:', error);
        alert('Failed to delete booking. Please try again.');
      }
    }
  };

  const handleBulkStatusChange = async (newStatus: BookingsPageBooking['status']) => {
    if (selectedBookings.length === 0) return;
    
    try {
      // Update each booking status via API
      await Promise.all(
        selectedBookings.map(async (id) => {
          let response;
          if (newStatus === 'checked-in') {
            response = await bookingService.checkInBooking(id);
          } else if (newStatus === 'cancelled') {
            response = await bookingService.cancelBooking(Number(id));
          } else {
            response = await bookingService.updateBooking(Number(id), { status: newStatus });
          }
          // Sync to cache
          if (response?.data) {
            await bookingCacheService.updateBookingInCache(response.data);
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
    const remainingAmount = Math.max(0, booking.totalAmount - booking.amountPaid);
    // Use Math.floor to ensure we don't exceed the remaining balance due to rounding
    setPaymentAmount((Math.floor(remainingAmount * 100) / 100).toFixed(2));
    setPaymentMethod('in-store');
    setPaymentNotes('');
    setShowPaymentModal(true);
  };

  const handleClosePaymentModal = () => {
    setShowPaymentModal(false);
    setSelectedBookingForPayment(null);
    setPaymentAmount('');
    setPaymentMethod('in-store');
    setPaymentNotes('');
  };

  const handleOpenInternalNotesModal = async (booking: BookingsPageBooking) => {
    setSelectedBookingForNotes(booking);
    // Use cache first for instant loading, fallback to API if needed
    try {
      const cachedBooking = await bookingCacheService.getBookingFromCache(Number(booking.id));
      if (cachedBooking) {
        console.log('[Bookings] Loaded internal notes from cache');
        setInternalNotesText(cachedBooking.internal_notes || '');
      } else {
        // Fallback to API if not in cache
        const response = await bookingService.getBookingById(Number(booking.id));
        if (response.success && response.data) {
          setInternalNotesText(response.data.internal_notes || '');
        }
      }
    } catch (error) {
      console.error('Error fetching booking details:', error);
      setInternalNotesText(booking.internal_notes || '');
    }
    setShowInternalNotesModal(true);
  };

  const handleCloseInternalNotesModal = () => {
    setShowInternalNotesModal(false);
    setSelectedBookingForNotes(null);
    setInternalNotesText('');
  };

  const handleSaveInternalNotes = async () => {
    if (!selectedBookingForNotes) return;
    
    try {
      setSavingInternalNotes(true);
      const response = await bookingService.updateInternalNotes(
        Number(selectedBookingForNotes.id), 
        internalNotesText
      );
      
      if (response.success) {
        // Update local state
        const updatedBookings = bookings.map(booking =>
          booking.id === selectedBookingForNotes.id 
            ? { ...booking, internal_notes: internalNotesText } 
            : booking
        );
        setBookings(updatedBookings);
        
        // Update cache with new internal notes
        if (response.data) {
          await bookingCacheService.updateBookingInCache(response.data);
        }
        
        alert('Internal notes saved successfully!');
        handleCloseInternalNotesModal();
      } else {
        alert(response.message || 'Failed to save internal notes');
      }
    } catch (error) {
      console.error('Error saving internal notes:', error);
      alert('Failed to save internal notes. Please try again.');
    } finally {
      setSavingInternalNotes(false);
    }
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
      booking.booking_time ? formatTime12Hour(booking.booking_time) : '',
      booking.participants || 0,
      booking.duration && booking.duration_unit ? formatDurationDisplay(booking.duration, booking.duration_unit) : '',
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

    // Calculate remaining amount with proper rounding to avoid floating-point precision issues
    const remainingAmount = Math.round((selectedBookingForPayment.totalAmount - selectedBookingForPayment.amountPaid) * 100) / 100;
    const roundedAmount = Math.round(amount * 100) / 100;
    
    // Allow a small tolerance (0.01) for floating-point comparison
    if (roundedAmount > remainingAmount + 0.01) {
      alert(`Payment amount cannot exceed remaining balance of $${remainingAmount.toFixed(2)}`);
      return;
    }

    try {
      setProcessingPayment(true);

      // Get booking details from cache first, fallback to API
      let booking = await bookingCacheService.getBookingFromCache(Number(selectedBookingForPayment.id));
      
      if (!booking) {
        // Fallback to API if not in cache
        const bookingResponse = await bookingService.getBookingById(Number(selectedBookingForPayment.id));
        if (!bookingResponse.success || !bookingResponse.data) {
          throw new Error('Failed to get booking details');
        }
        booking = bookingResponse.data;
      }

      const customerId = booking.customer_id || null; // Allow null for guest bookings
      const locationId = booking.location_id;

      if (!locationId) {
        throw new Error('Location ID not found for this booking');
      }

      // Create payment record using PaymentService
      const paymentResponse = await createPayment({
        payable_id: Number(selectedBookingForPayment.id),
        payable_type: PAYMENT_TYPE.BOOKING,
        customer_id: customerId,
        location_id: locationId,
        amount: amount,
        currency: 'USD',
        method: paymentMethod === 'in-store' ? 'cash' : paymentMethod,
        status: 'completed',
        notes: paymentNotes || (paymentMethod === 'in-store' 
          ? `In-store payment for booking ${selectedBookingForPayment.referenceNumber}`
          : `Partial payment for booking ${selectedBookingForPayment.referenceNumber}`),
      });

      if (!paymentResponse.success) {
        throw new Error(paymentResponse.message || 'Failed to create payment');
      }

      // Update booking's amount_paid and status
      const newAmountPaid = selectedBookingForPayment.amountPaid + amount;
      const newPaymentStatus: BookingsPageBooking['paymentStatus'] = newAmountPaid >= selectedBookingForPayment.totalAmount ? 'paid' : 'partial';

      const updateResponse = await bookingService.updateBooking(Number(selectedBookingForPayment.id), {
        amount_paid: newAmountPaid,
        payment_status: newPaymentStatus,
        status: 'confirmed', // Set status to confirmed when payment is made
      });

      // Update cache with updated booking
      if (updateResponse?.data) {
        await bookingCacheService.updateBookingInCache(updateResponse.data);
      }

      // Log activity
      await logBookingActivity(
        selectedBookingForPayment, 
        'payment', 
        `Payment of $${amount.toFixed(2)} processed via ${paymentMethod}. New total paid: $${newAmountPaid.toFixed(2)}`,
        locationId
      );

      // Update local state
      const updatedBookings = bookings.map(booking =>
        booking.id === selectedBookingForPayment.id
          ? { ...booking, amountPaid: newAmountPaid, paymentStatus: newPaymentStatus, status: 'confirmed' as BookingsPageBooking['status'] }
          : booking
      );
      setBookings(updatedBookings);

      alert('Payment processed successfully!');
      handleClosePaymentModal();
      // No need to reload - cache and local state are already updated
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
            {isCompanyAdmin && (
              <LocationSelector
                variant="compact"
                locations={availableLocations}
                selectedLocation={selectedLocation?.toString() || ''}
                onLocationChange={(id) => setSelectedLocation(id ? Number(id) : null)}
                themeColor={themeColor}
                fullColor={fullColor}
                showAllOption={true}
              />
            )}
            <StandardButton
              variant="primary"
              size="md"
              icon={Plus}
              onClick={() => navigate('/bookings/manual')}
            >
              Record Past Booking
            </StandardButton>
            <StandardButton
              variant="primary"
              size="md"
              icon={Download}
              onClick={() => setShowExportModal(true)}
            >
              Export Bookings
            </StandardButton>
            <StandardButton
              variant="primary"
              size="md"
              icon={FileDown}
              onClick={handleOpenReportModal}
            >
              Generate Report
            </StandardButton>
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
              <StandardButton
                variant="secondary"
                size="sm"
                icon={Filter}
                onClick={() => setShowFilters(!showFilters)}
              >
                Filters
              </StandardButton>
              <StandardButton
                variant="secondary"
                size="sm"
                icon={RefreshCcw}
                onClick={loadBookings}
              >
                {''}
              </StandardButton>
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
                <StandardButton
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                >
                  Clear Filters
                </StandardButton>
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
                <option value="cancelled">Cancel</option>
              </select>
              <StandardButton
                variant="danger"
                size="sm"
                icon={Trash2}
                onClick={handleBulkDelete}
              >
                Delete
              </StandardButton>
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
                    
                    // Use parseLocalDate to avoid timezone issues with ISO date strings
                    const dateA = parseLocalDate(a.date);
                    const dateB = parseLocalDate(b.date);
                    dateA.setHours(0, 0, 0, 0);
                    dateB.setHours(0, 0, 0, 0);
                    
                    const isPastA = dateA < now;
                    const isPastB = dateB < now;
                    
                    // Push past dates to the end
                    if (isPastA && !isPastB) return 1;
                    if (!isPastA && isPastB) return -1;
                    
                    // Define priority order: pending/confirmed first, then checked-in/cancelled last
                    const statusPriority: Record<string, number> = {
                      'pending': 1,
                      'confirmed': 2,
                      'checked-in': 3,
                      'cancelled': 4
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
                        <div 
                          className="font-medium text-gray-900 group cursor-pointer flex items-center gap-1 hover:bg-gray-100 rounded px-1 py-0.5 -mx-1"
                          onClick={() => handleOpenDateModal(booking)}
                          title="Click to change date"
                        >
                          <Calendar className="w-3 h-3 text-gray-400 mr-1" />
                          <span>{parseLocalDate(booking.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                          <Edit3 className="w-2.5 h-2.5 text-gray-400 opacity-0 group-hover:opacity-100 flex-shrink-0" />
                        </div>
                        <div 
                          className="text-xs text-gray-500 group cursor-pointer flex items-center gap-1 hover:bg-gray-100 rounded px-1 py-0.5 -mx-1"
                          onClick={() => handleOpenTimeModal(booking)}
                          title="Click to change time"
                        >
                          <Clock className="w-3 h-3 text-gray-400 mr-1" />
                          <span>{formatTime12Hour(booking.time)}</span>
                          <Edit3 className="w-2.5 h-2.5 text-gray-400 opacity-0 group-hover:opacity-100 flex-shrink-0" />
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="font-medium text-gray-900">
                          {renderEditableCell(booking, 'customerName', booking.customerName)}
                        </div>
                        <div className="text-xs text-gray-500">
                          {renderEditableCell(booking, 'email', booking.email)}
                        </div>
                        <div className="text-xs text-gray-500">
                          {renderEditableCell(booking, 'phone', booking.phone)}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div 
                          className="font-medium text-gray-900 group cursor-pointer flex items-center gap-1 hover:bg-gray-100 rounded px-1 py-0.5 -mx-1"
                          onClick={() => handleOpenPackageModal(booking)}
                          title="Click to change package"
                        >
                          <Package className="w-3 h-3 text-gray-400 mr-1" />
                          <span>{booking.packageName}</span>
                          <Edit3 className="w-2.5 h-2.5 text-gray-400 opacity-0 group-hover:opacity-100 flex-shrink-0" />
                        </div>
                        <div className="text-xs text-gray-500">{booking.activity}</div>
                        <div 
                          className={`text-xs text-${fullColor} group cursor-pointer flex items-center gap-1 hover:bg-gray-100 rounded px-1 py-0.5 -mx-1`}
                          onClick={() => handleOpenRoomModal(booking)}
                          title="Click to change room"
                        >
                          <Home className="w-2.5 h-2.5 text-gray-400 mr-0.5" />
                          <span>{booking.room}</span>
                          <Edit3 className="w-2.5 h-2.5 text-gray-400 opacity-0 group-hover:opacity-100 flex-shrink-0" />
                        </div>
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
                        <div 
                          className="group cursor-pointer flex items-center gap-1 hover:bg-gray-100 rounded px-1 py-0.5 -mx-1"
                          onClick={() => handleOpenDurationModal(booking)}
                          title="Click to edit duration"
                        >
                          <Clock className="w-3 h-3 text-gray-400 mr-1" />
                          <span>{booking.duration || '-'}</span>
                          <Edit3 className="w-2.5 h-2.5 text-gray-400 opacity-0 group-hover:opacity-100 flex-shrink-0" />
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                        {renderEditableCell(booking, 'participants', booking.participants)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <select
                          value={booking.status}
                          onChange={(e) => handleStatusChange(booking.id, e.target.value as BookingsPageBooking['status'])}
                          className={`text-xs font-medium px-2 py-1 rounded-full ${statusColors[booking.status as keyof typeof statusColors] || 'bg-gray-100 text-gray-800'} border-none focus:ring-2 focus:ring-${themeColor}-600`}
                        >
                          <option value="pending">Pending</option>
                          <option value="confirmed">Confirmed</option>
                          <option value="checked-in">Checked In</option>
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
                          <option value="pending">Pending</option>
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
                          {booking.paymentStatus !== 'paid' && (
                            <StandardButton
                              variant="ghost"
                              size="sm"
                              icon={DollarSign}
                              onClick={() => handleOpenPaymentModal(booking)}
                            >
                              {''}
                            </StandardButton>
                          )}
                          {booking.status !== 'checked-in' && booking.paymentStatus === 'paid' && (
                            <StandardButton
                              variant="success"
                              size="sm"
                              icon={CheckCircle2}
                              onClick={() => handleCheckIn(booking.referenceNumber, 'checked-in')}
                            >
                              {''}
                            </StandardButton>
                          )}
                          <button
                            onClick={() => handleOpenInternalNotesModal(booking)}
                            className="p-1 text-amber-600 hover:text-amber-800"
                            title="Internal Notes"
                          >
                            <FileText className="h-4 w-4" />
                          </button>
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
                          <StandardButton
                            variant="danger"
                            size="sm"
                            icon={Trash2}
                            onClick={() => handleDeleteBooking(booking.id, booking.referenceNumber)}
                          >
                            {''}
                          </StandardButton>
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
                  <StandardButton
                    variant="secondary"
                    size="sm"
                    onClick={() => paginate(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                  >
                    Previous
                  </StandardButton>
                  
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <StandardButton
                      key={page}
                      variant={currentPage === page ? 'primary' : 'secondary'}
                      size="sm"
                      onClick={() => paginate(page)}
                    >
                      {page}
                    </StandardButton>
                  ))}
                  
                  <StandardButton
                    variant="secondary"
                    size="sm"
                    onClick={() => paginate(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Next
                  </StandardButton>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Export Modal */}
        {showExportModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-backdrop-fade" onClick={() => setShowExportModal(false)}>
            <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
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
                      <StandardButton
                        variant="secondary"
                        size="sm"
                        onClick={() => setQuickDateRange('today')}
                      >
                        Today
                      </StandardButton>
                      <StandardButton
                        variant="secondary"
                        size="sm"
                        onClick={() => setQuickDateRange('7days')}
                      >
                        7 Days
                      </StandardButton>
                      <StandardButton
                        variant="secondary"
                        size="sm"
                        onClick={() => setQuickDateRange('30days')}
                      >
                        30 Days
                      </StandardButton>
                      <StandardButton
                        variant="secondary"
                        size="sm"
                        onClick={() => setQuickDateRange('year')}
                      >
                        1 Year
                      </StandardButton>
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
                    {['pending', 'confirmed', 'checked-in', 'cancelled'].map(status => (
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
                <StandardButton
                  variant="secondary"
                  size="md"
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
                >
                  Cancel
                </StandardButton>
                <StandardButton
                  variant="primary"
                  size="md"
                  icon={Download}
                  onClick={handleExport}
                  disabled={exporting}
                  loading={exporting}
                >
                  {exporting ? 'Exporting...' : 'Export to CSV'}
                </StandardButton>
              </div>
            </div>
          </div>
        )}

        {/* Payment Modal */}
        {showPaymentModal && selectedBookingForPayment && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-backdrop-fade" onClick={() => { setShowPaymentModal(false); setSelectedBookingForPayment(null); }}>
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
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
                    onChange={(e) => setPaymentMethod(e.target.value as 'card' | 'in-store')}
                    className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-transparent`}
                  >
                    <option value="in-store">In-Store</option>
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
                <StandardButton
                  variant="secondary"
                  size="md"
                  onClick={handleClosePaymentModal}
                  disabled={processingPayment}
                >
                  Cancel
                </StandardButton>
                <StandardButton
                  variant="primary"
                  size="md"
                  onClick={handleSubmitPayment}
                  disabled={processingPayment || !paymentAmount || parseFloat(paymentAmount) <= 0}
                  loading={processingPayment}
                >
                  {processingPayment ? 'Processing...' : 'Process Payment'}
                </StandardButton>
              </div>
            </div>
          </div>
        )}

        {/* Internal Notes Modal */}
        {showInternalNotesModal && selectedBookingForNotes && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-backdrop-fade" onClick={handleCloseInternalNotesModal}>
            <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full mx-4" onClick={(e) => e.stopPropagation()}>
              <div className="p-6 border-b border-gray-100 bg-amber-50">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">Internal Notes</h2>
                    <p className="text-sm text-gray-600 mt-1">
                      Booking: {selectedBookingForNotes.referenceNumber} - {selectedBookingForNotes.customerName}
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold bg-amber-200 text-amber-900 rounded-full">
                    <FileText className="h-3 w-3" />
                    Staff Only
                  </span>
                </div>
              </div>

              <div className="p-6">

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Notes
                  </label>
                  <textarea
                    value={internalNotesText}
                    onChange={(e) => setInternalNotesText(e.target.value)}
                    rows={8}
                    className={`w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent font-mono text-sm`}
                    placeholder="Add internal notes about this booking...&#10;&#10;Examples:&#10;- Customer requested quiet area&#10;- VIP - provide extra attention&#10;- Follow up required after service"
                  />
                </div>
              </div>

              <div className="p-6 border-t border-gray-100 flex gap-3 justify-end">
                <StandardButton
                  variant="secondary"
                  size="md"
                  onClick={handleCloseInternalNotesModal}
                  disabled={savingInternalNotes}
                >
                  Cancel
                </StandardButton>
                <StandardButton
                  variant="primary"
                  size="md"
                  onClick={handleSaveInternalNotes}
                  disabled={savingInternalNotes}
                  loading={savingInternalNotes}
                >
                  {savingInternalNotes ? 'Saving...' : 'Save Notes'}
                </StandardButton>
              </div>
            </div>
          </div>
        )}

        {/* Package Selection Modal */}
        {showPackageModal && selectedBookingForEdit && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-backdrop-fade" onClick={handleClosePackageModal}>
            <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full mx-4 max-h-[80vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <div className={`p-6 border-b border-gray-100 bg-${themeColor}-50`}>
                <h2 className="text-xl font-bold text-gray-900">Select Package</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Booking: {selectedBookingForEdit.referenceNumber}
                </p>
              </div>

              <div className="p-4 max-h-[50vh] overflow-y-auto relative">
                {loadingPackages ? (
                  <div className="flex justify-center items-center py-8">
                    <div className={`animate-spin rounded-full h-8 w-8 border-b-2 border-${fullColor}`}></div>
                  </div>
                ) : availablePackages.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">No packages available</p>
                ) : (
                  <div className="space-y-2">
                    {availablePackages.map((pkg) => (
                      <button
                        key={pkg.id}
                        onClick={() => handleSelectPackage(pkg)}
                        disabled={savingPackage}
                        className={`w-full text-left p-4 rounded-lg border transition-colors ${
                          pkg.name === selectedBookingForEdit.packageName
                            ? `border-${themeColor}-500 bg-${themeColor}-50`
                            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                        } ${savingPackage ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium text-gray-900">{pkg.name}</div>
                            <div className="text-xs text-gray-500">{pkg.category}</div>
                          </div>
                          <div className="text-right">
                            <div className="font-semibold text-gray-900">${Number(pkg.price || 0).toFixed(2)}</div>
                            <div className="text-xs text-gray-500">{pkg.duration} {pkg.duration_unit}</div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                
                {/* Loading Overlay */}
                {savingPackage && (
                  <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center rounded-lg">
                    <div className="text-center">
                      <div className={`animate-spin rounded-full h-10 w-10 border-b-2 border-${fullColor} mx-auto mb-2`}></div>
                      <p className="text-sm font-medium text-gray-700">Updating package...</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-4 border-t border-gray-100 flex justify-end">
                <StandardButton
                  variant="secondary"
                  size="md"
                  onClick={handleClosePackageModal}
                  disabled={savingPackage}
                >
                  Cancel
                </StandardButton>
              </div>
            </div>
          </div>
        )}

        {/* Room Selection Modal */}
        {showRoomModal && selectedBookingForEdit && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-backdrop-fade" onClick={handleCloseRoomModal}>
            <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full mx-4 max-h-[80vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <div className={`p-6 border-b border-gray-100 bg-${themeColor}-50`}>
                <h2 className="text-xl font-bold text-gray-900">Select Room/Table</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Booking: {selectedBookingForEdit.referenceNumber}
                </p>
              </div>

              <div className="p-4 max-h-[50vh] overflow-y-auto relative">
                {loadingRooms ? (
                  <div className="flex justify-center items-center py-8">
                    <div className={`animate-spin rounded-full h-8 w-8 border-b-2 border-${fullColor}`}></div>
                  </div>
                ) : availableRooms.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">No rooms available</p>
                ) : (
                  <div className="space-y-2">
                    {availableRooms
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .map((room) => (
                      <button
                        key={room.id}
                        onClick={() => handleSelectRoom(room)}
                        disabled={savingRoom}
                        className={`w-full text-left p-4 rounded-lg border transition-colors ${
                          room.name === selectedBookingForEdit.room
                            ? `border-${themeColor}-500 bg-${themeColor}-50`
                            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                        } ${savingRoom ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium text-gray-900">{room.name}</div>
                            {room.area_group && (
                              <div className="text-xs text-gray-500">{room.area_group}</div>
                            )}
                          </div>
                          {room.capacity && (
                            <div className="text-sm text-gray-600">
                              <Users className="inline-block w-4 h-4 mr-1" />
                              {room.capacity}
                            </div>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                
                {/* Loading Overlay */}
                {savingRoom && (
                  <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center rounded-lg">
                    <div className="text-center">
                      <div className={`animate-spin rounded-full h-10 w-10 border-b-2 border-${fullColor} mx-auto mb-2`}></div>
                      <p className="text-sm font-medium text-gray-700">Updating room...</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-4 border-t border-gray-100 flex justify-end">
                <StandardButton
                  variant="secondary"
                  size="md"
                  onClick={handleCloseRoomModal}
                  disabled={savingRoom}
                >
                  Cancel
                </StandardButton>
              </div>
            </div>
          </div>
        )}

        {/* Duration Edit Modal */}
        {showDurationModal && selectedBookingForEdit && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-backdrop-fade" onClick={handleCloseDurationModal}>
            <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full mx-4" onClick={(e) => e.stopPropagation()}>
              <div className={`p-6 border-b border-gray-100 bg-${themeColor}-50`}>
                <h2 className="text-xl font-bold text-gray-900">Edit Duration</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Booking: {selectedBookingForEdit.referenceNumber}
                </p>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Duration
                  </label>
                  <div className="flex gap-3">
                    <input
                      type="number"
                      min="1"
                      value={durationValue}
                      onChange={(e) => setDurationValue(parseInt(e.target.value, 10) || 1)}
                      className={`flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-transparent`}
                    />
                    <select
                      value={durationUnit}
                      onChange={(e) => setDurationUnit(e.target.value as 'hours' | 'minutes')}
                      className={`px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-transparent`}
                    >
                      <option value="hours">Hours</option>
                      <option value="minutes">Minutes</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-gray-100 flex gap-3 justify-end">
                <StandardButton
                  variant="secondary"
                  size="md"
                  onClick={handleCloseDurationModal}
                  disabled={savingDuration}
                >
                  Cancel
                </StandardButton>
                <StandardButton
                  variant="primary"
                  size="md"
                  onClick={handleSaveDuration}
                  disabled={savingDuration}
                  loading={savingDuration}
                >
                  {savingDuration ? 'Saving...' : 'Save Duration'}
                </StandardButton>
              </div>
            </div>
          </div>
        )}

        {/* Date Edit Modal */}
        {showDateModal && selectedBookingForEdit && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-backdrop-fade" onClick={handleCloseDateModal}>
            <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full mx-4" onClick={(e) => e.stopPropagation()}>
              <div className={`p-6 border-b border-gray-100 bg-${themeColor}-50`}>
                <h2 className="text-xl font-bold text-gray-900">Edit Date</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Booking: {selectedBookingForEdit.referenceNumber}
                </p>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Booking Date
                  </label>
                  <input
                    type="date"
                    value={dateValue}
                    onChange={(e) => setDateValue(e.target.value)}
                    className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-transparent`}
                  />
                </div>
                <p className="text-sm text-gray-500">
                  Current: {selectedBookingForEdit.date ? parseLocalDate(selectedBookingForEdit.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : 'Not set'}
                </p>
              </div>

              <div className="p-6 border-t border-gray-100 flex gap-3 justify-end">
                <StandardButton
                  variant="secondary"
                  size="md"
                  onClick={handleCloseDateModal}
                  disabled={savingDate}
                >
                  Cancel
                </StandardButton>
                <StandardButton
                  variant="primary"
                  size="md"
                  onClick={handleSaveDate}
                  disabled={savingDate || !dateValue}
                  loading={savingDate}
                >
                  {savingDate ? 'Saving...' : 'Save Date'}
                </StandardButton>
              </div>
            </div>
          </div>
        )}

        {/* Time Edit Modal */}
        {showTimeModal && selectedBookingForEdit && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-backdrop-fade" onClick={handleCloseTimeModal}>
            <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full mx-4" onClick={(e) => e.stopPropagation()}>
              <div className={`p-6 border-b border-gray-100 bg-${themeColor}-50`}>
                <h2 className="text-xl font-bold text-gray-900">Edit Time</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Booking: {selectedBookingForEdit.referenceNumber}
                </p>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Booking Time
                  </label>
                  <input
                    type="time"
                    value={timeValue}
                    onChange={(e) => setTimeValue(e.target.value)}
                    className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-transparent`}
                  />
                </div>
                <p className="text-sm text-gray-500">
                  Current: {selectedBookingForEdit.time ? formatTime12Hour(selectedBookingForEdit.time) : 'Not set'}
                </p>
              </div>

              <div className="p-6 border-t border-gray-100 flex gap-3 justify-end">
                <StandardButton
                  variant="secondary"
                  size="md"
                  onClick={handleCloseTimeModal}
                  disabled={savingTime}
                >
                  Cancel
                </StandardButton>
                <StandardButton
                  variant="primary"
                  size="md"
                  onClick={handleSaveTime}
                  disabled={savingTime || !timeValue}
                  loading={savingTime}
                >
                  {savingTime ? 'Saving...' : 'Save Time'}
                </StandardButton>
              </div>
            </div>
          </div>
        )}

        {/* Booking Details Report Modal */}
        {showReportModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-backdrop-fade" onClick={handleCloseReportModal}>
            <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className={`p-6 border-b border-gray-100 bg-${themeColor}-50`}>
                <h2 className="text-2xl font-bold text-gray-900">Generate Booking Report</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Generate a detailed PDF report of bookings
                </p>
              </div>

              <div className="p-6 space-y-6">
                {/* Package Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Packages
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={reportFilters.packageIds === 'all' || (Array.isArray(reportFilters.packageIds) && reportFilters.packageIds.length === reportPackages.length && reportPackages.length > 0)}
                        onChange={toggleAllPackages}
                        className={`rounded border-gray-300 text-${fullColor} focus:ring-${themeColor}-500`}
                      />
                      <span className="text-sm font-medium text-gray-700">All Packages</span>
                    </label>
                    
                    {loadingReportPackages ? (
                      <div className="flex items-center gap-2 text-sm text-gray-500 py-2">
                        <div className={`animate-spin rounded-full h-4 w-4 border-b-2 border-${fullColor}`}></div>
                        Loading packages...
                      </div>
                    ) : (
                      <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-2 space-y-1">
                        {reportPackages.map(pkg => (
                          <label key={pkg.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded">
                            <input
                              type="checkbox"
                              checked={
                                reportFilters.packageIds === 'all' || 
                                (Array.isArray(reportFilters.packageIds) && reportFilters.packageIds.includes(pkg.id))
                              }
                              onChange={() => toggleReportPackage(pkg.id)}
                              className={`rounded border-gray-300 text-${fullColor} focus:ring-${themeColor}-500`}
                            />
                            <span className="text-sm text-gray-700">
                              {pkg.name}
                            </span>
                          </label>
                        ))}
                        {reportPackages.length === 0 && (
                          <p className="text-sm text-gray-500 py-2 text-center">No packages available</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Period Type Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Time Period
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {(['today', 'weekly', 'monthly', 'custom'] as const).map(period => (
                      <button
                        key={period}
                        type="button"
                        onClick={() => setReportFilters(prev => ({ ...prev, periodType: period }))}
                        className={`px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
                          reportFilters.periodType === period
                            ? `bg-${themeColor}-100 border-${fullColor} text-${fullColor}`
                            : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {period.charAt(0).toUpperCase() + period.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Conditional Inputs based on Period Type */}
                {reportFilters.periodType === 'weekly' && (
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Week</label>
                      <select
                        value={reportFilters.weekOfMonth}
                        onChange={(e) => setReportFilters(prev => ({ ...prev, weekOfMonth: parseInt(e.target.value) }))}
                        className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-transparent text-sm`}
                      >
                        <option value={1}>Week 1 (1-7)</option>
                        <option value={2}>Week 2 (8-14)</option>
                        <option value={3}>Week 3 (15-21)</option>
                        <option value={4}>Week 4 (22-28)</option>
                        <option value={5}>Week 5 (29+)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Month</label>
                      <select
                        value={reportFilters.month}
                        onChange={(e) => setReportFilters(prev => ({ ...prev, month: parseInt(e.target.value) }))}
                        className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-transparent text-sm`}
                      >
                        {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => (
                          <option key={m} value={m}>{getMonthName(m)}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
                      <select
                        value={reportFilters.year}
                        onChange={(e) => setReportFilters(prev => ({ ...prev, year: parseInt(e.target.value) }))}
                        className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-transparent text-sm`}
                      >
                        {[2024, 2025, 2026, 2027, 2028].map(y => (
                          <option key={y} value={y}>{y}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {reportFilters.periodType === 'monthly' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Month</label>
                      <select
                        value={reportFilters.month}
                        onChange={(e) => setReportFilters(prev => ({ ...prev, month: parseInt(e.target.value) }))}
                        className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-transparent text-sm`}
                      >
                        {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => (
                          <option key={m} value={m}>{getMonthName(m)}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
                      <select
                        value={reportFilters.year}
                        onChange={(e) => setReportFilters(prev => ({ ...prev, year: parseInt(e.target.value) }))}
                        className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-transparent text-sm`}
                      >
                        {[2024, 2025, 2026, 2027, 2028].map(y => (
                          <option key={y} value={y}>{y}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {reportFilters.periodType === 'custom' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                      <input
                        type="date"
                        value={reportFilters.startDate}
                        onChange={(e) => setReportFilters(prev => ({ ...prev, startDate: e.target.value }))}
                        className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-transparent text-sm`}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                      <input
                        type="date"
                        value={reportFilters.endDate}
                        onChange={(e) => setReportFilters(prev => ({ ...prev, endDate: e.target.value }))}
                        min={reportFilters.startDate}
                        className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-transparent text-sm`}
                      />
                    </div>
                  </div>
                )}

                {/* View Mode Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Report View
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setReportFilters(prev => ({ ...prev, viewMode: 'individual' }))}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        reportFilters.viewMode === 'individual'
                          ? `border-${fullColor} bg-${themeColor}-50`
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <FileText className={`w-8 h-8 mx-auto mb-2 ${reportFilters.viewMode === 'individual' ? `text-${fullColor}` : 'text-gray-400'}`} />
                      <p className={`text-sm font-medium ${reportFilters.viewMode === 'individual' ? `text-${fullColor}` : 'text-gray-700'}`}>
                        Individual View
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        One booking per page with full details
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setReportFilters(prev => ({ ...prev, viewMode: 'list' }))}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        reportFilters.viewMode === 'list'
                          ? `border-${fullColor} bg-${themeColor}-50`
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <Calendar className={`w-8 h-8 mx-auto mb-2 ${reportFilters.viewMode === 'list' ? `text-${fullColor}` : 'text-gray-400'}`} />
                      <p className={`text-sm font-medium ${reportFilters.viewMode === 'list' ? `text-${fullColor}` : 'text-gray-700'}`}>
                        List View
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Multiple bookings per page (summary)
                      </p>
                    </button>
                  </div>
                </div>

                {/* Status Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Filter by Status (optional)
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {['pending', 'confirmed', 'checked-in', 'completed'].map(status => (
                      <button
                        key={status}
                        type="button"
                        onClick={() => toggleReportStatus(status)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
                          reportFilters.status.includes(status)
                            ? `bg-${themeColor}-100 border-${fullColor} text-${fullColor}`
                            : 'bg-gray-100 border-gray-300 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {status.charAt(0).toUpperCase() + status.slice(1).replace('-', ' ')}
                      </button>
                    ))}
                  </div>
                  {reportFilters.status.length === 0 && (
                    <p className="text-xs text-gray-500 mt-1">No status filter = All statuses included</p>
                  )}
                </div>

                {/* Include Cancelled */}
                <div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={reportFilters.includeCancelled}
                      onChange={(e) => setReportFilters(prev => ({ ...prev, includeCancelled: e.target.checked }))}
                      className={`rounded border-gray-300 text-${fullColor} focus:ring-${themeColor}-500`}
                    />
                    <span className="text-sm text-gray-700">Include cancelled bookings</span>
                  </label>
                </div>
              </div>

              {/* Footer */}
              <div className="p-6 border-t border-gray-100 flex gap-3 justify-end bg-gray-50">
                <StandardButton
                  variant="secondary"
                  size="md"
                  onClick={handleCloseReportModal}
                  disabled={generatingReport}
                >
                  Cancel
                </StandardButton>
                <StandardButton
                  variant="primary"
                  size="md"
                  icon={FileDown}
                  onClick={handleGenerateReport}
                  disabled={generatingReport}
                  loading={generatingReport}
                >
                  {generatingReport ? 'Generating...' : 'Generate PDF Report'}
                </StandardButton>
              </div>
            </div>
          </div>
        )}
      </div>
  );
};

export default Bookings;