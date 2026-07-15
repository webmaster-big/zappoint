import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Eye, 
  EyeOff,
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
  FileDown,
  Columns,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  AlertTriangle,
  RotateCcw,
  Archive,
  Upload,
  Loader2,
  CreditCard
} from 'lucide-react';
import { useThemeColor } from '../../../hooks/useThemeColor';
import StandardButton from '../../../components/ui/StandardButton';
import ActionMenu from '../../../components/ui/ActionMenu';
import Pagination from '../../../components/ui/Pagination';
import CounterAnimation from '../../../components/ui/CounterAnimation';
import DateRangeCalendar from '../../../components/ui/DateRangeCalendar';
import type { BookingsPageBooking, BookingsPageFilterOptions, BookingsColumnVisibility, BookingsColumnKey } from '../../../types/Bookings.types';
import { derivePaymentStatus, DEFAULT_COLUMN_ORDER } from '../../../types/Bookings.types';
import bookingService from '../../../services/bookingService';
import type { Booking } from '../../../services/bookingService';
import locationChangeRequestService from '../../../services/LocationChangeRequestService';
import { bookingCacheService } from '../../../services/BookingCacheService';
import { createPayment, PAYMENT_TYPE } from '../../../services/PaymentService';
import { locationService } from '../../../services/LocationService';
import { useLocationScope } from '../../../contexts/LocationContext';
import { getStoredUser, API_BASE_URL } from '../../../utils/storage';
import { formatDurationDisplay } from '../../../utils/timeFormat';
import { MapPin } from 'lucide-react';
import { packageService, type Package as PackageType } from '../../../services/PackageService';
import { roomService, type Room } from '../../../services/RoomService';
import { packageCacheService } from '../../../services/PackageCacheService';
import { roomCacheService } from '../../../services/RoomCacheService';
import BulkImportModal from '../../../components/admin/bookings/BulkImportModal';
import { toCsv } from '../../../components/admin/table';

const formatTime12Hour = (time24: string): string => {
  if (!time24) return '';
  const [hours24, minutes] = time24.split(':');
  const hours = parseInt(hours24, 10);
  const period = hours >= 12 ? 'PM' : 'AM';
  const hours12 = hours % 12 || 12;
  return `${hours12}:${minutes} ${period}`;
};

const parseLocalDate = (isoDateString: string): Date => {
  if (!isoDateString) return new Date();
  const [year, month, day] = isoDateString.split('T')[0].split('-').map(Number);
  return new Date(year, month - 1, day);
};

const Bookings: React.FC = () => {
  const { themeColor, fullColor } = useThemeColor();
  const navigate = useNavigate();

  const transformRawBooking = (booking: any): BookingsPageBooking => {
    const totalAmount = Number(booking.total_amount);
    const amountPaid = Number(booking.amount_paid || 0);
    return {
      id: booking.id.toString(),
      type: 'package',
      packageName: booking.package?.name || 'N/A',
      packageId: booking.package_id,
      room: booking.room?.name || 'N/A',
      roomId: booking.room_id,
      customerName: booking.customer
        ? `${booking.customer.first_name} ${booking.customer.last_name}`
        : booking.guest_name || 'Guest',
      customerId: booking.customer_id,
      email: booking.customer?.email || booking.guest_email || '',
      phone: booking.customer?.phone || booking.guest_phone || '',
      date: booking.booking_date,
      time: booking.booking_time,
      participants: booking.participants,
      status: booking.status as BookingsPageBooking['status'],
      totalAmount,
      amountPaid,
      paymentStatus: derivePaymentStatus(amountPaid, totalAmount),
      createdAt: booking.created_at,
      paymentMethod: booking.payment_method as BookingsPageBooking['paymentMethod'],
      attractions: booking.attractions?.map((attr: any) => ({
        name: attr.name,
        quantity: attr.pivot?.quantity || 1
      })) || [],
      addOns: booking.add_ons?.map((addon: any) => ({
        name: addon.name,
        quantity: addon.pivot?.quantity || 1
      })) || [],
      duration: booking.duration && booking.duration_unit
        ? formatDurationDisplay(booking.duration, booking.duration_unit)
        : '2 hours',
      activity: booking.package?.category || 'Package Booking',
      notes: booking.notes,
      specialRequests: booking.special_requests,
      referenceNumber: booking.reference_number,
      location: booking.location?.name || 'N/A',
      locationId: booking.location_id,
      updatedAt: booking.updated_at,
      transactionId: booking.transaction_id,
      guestOfHonorName: booking.guest_of_honor_name,
      guestOfHonorAge: booking.guest_of_honor_age,
      guestOfHonorGender: booking.guest_of_honor_gender,
      guestAddress: booking.guest_address || booking.customer?.address,
      guestCity: booking.guest_city || booking.customer?.city,
      guestState: booking.guest_state || booking.customer?.state,
      guestZip: booking.guest_zip || booking.customer?.zip,
      guestCountry: booking.guest_country || booking.customer?.country,
      internal_notes: booking.internal_notes,
      appliedFees: booking.applied_fees || null,
    };
  };
  const [bookings, setBookings] = useState<BookingsPageBooking[]>([]);
  const [filteredBookings, setFilteredBookings] = useState<BookingsPageBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingStatusBookingId, setSavingStatusBookingId] = useState<string | null>(null);
  const [selectedBookings, setSelectedBookings] = useState<string[]>([]);
  const [filters, setFilters] = useState<BookingsPageFilterOptions>({
    status: 'all',
    dateRange: {
      start: '',
      end: ''
    },
    search: '',
    payment: 'all',
    packageId: 'all',
    roomId: 'all',
    customerId: 'all'
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [showFilters, setShowFilters] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedBookingForPayment, setSelectedBookingForPayment] = useState<BookingsPageBooking | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'in-store' | 'authorize.net'>('in-store');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [processingPayment, setProcessingPayment] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showBulkImportModal, setShowBulkImportModal] = useState(false);
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
  const [loadingInternalNotes, setLoadingInternalNotes] = useState(false);
  
  const currentUser = getStoredUser();
  const isCompanyAdmin = currentUser?.role === 'company_admin';
  const { effectiveLocationId } = useLocationScope();
  const selectedLocation = effectiveLocationId;

  const getDefaultColumnVisibility = (): BookingsColumnVisibility => {
    const saved = localStorage.getItem('bookings_column_visibility');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
      }
    }
    return {
      id: true,                    // Confirmation #
      referenceNumber: false,      // Reference number (hidden by default)
      
      bookingDate: true,           // Booking date
      bookingTime: true,           // Booking time
      duration: true,              // Duration
      
      guestName: true,             // Guest name
      guestEmail: true,            // Guest email
      guestPhone: true,            // Guest phone
      
      guestAddress: false,         // Address (hidden by default)
      
      packageName: true,           // Package name
      roomName: true,              // Room name
      location: isCompanyAdmin,    // Location (only for company admin)
      
      participants: true,          // Participants
      status: true,                // Status
      
      paymentMethod: true,         // Payment method
      paymentStatus: true,         // Payment status
      totalAmount: true,           // Total amount
      amountPaid: true,            // Amount paid
      fees: false,                 // Applied fees (hidden by default)
      
      guestOfHonor: false,         // Guest of honor (hidden by default)
      
      notes: false,                // Notes (hidden by default)
      specialRequests: false,      // Special requests (hidden by default)
      
      createdAt: false,            // Created date (hidden by default)
      updatedAt: false,            // Updated date (hidden by default)
    };
  };
  
  const [columnVisibility, setColumnVisibility] = useState<BookingsColumnVisibility>(getDefaultColumnVisibility);
  const [showColumnSelector, setShowColumnSelector] = useState(false);
  
  const getDefaultColumnOrder = (): BookingsColumnKey[] => {
    const saved = localStorage.getItem('bookings_column_order');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
      }
    }
    return DEFAULT_COLUMN_ORDER;
  };
  
  const [columnOrder, setColumnOrder] = useState<BookingsColumnKey[]>(getDefaultColumnOrder);
  const [draggedColumn, setDraggedColumn] = useState<BookingsColumnKey | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<BookingsColumnKey | null>(null);
  const draggedColumnRef = useRef<BookingsColumnKey | null>(null);

  const [sortColumn, setSortColumn] = useState<BookingsColumnKey | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const [showCheckInConfirm, setShowCheckInConfirm] = useState<string | null>(null);
  
  const [showTrashed, setShowTrashed] = useState(false);
  const [trashedBookings, setTrashedBookings] = useState<BookingsPageBooking[]>([]);
  const [trashedLoading, setTrashedLoading] = useState(false);
  const [trashedCurrentPage, setTrashedCurrentPage] = useState(1);
  const [trashedTotalPages, setTrashedTotalPages] = useState(1);
  const [trashedTotal, setTrashedTotal] = useState(0);
  const [selectedTrashed, setSelectedTrashed] = useState<string[]>([]);
  
  const handleDragStart = (e: React.DragEvent, columnKey: BookingsColumnKey) => {
    draggedColumnRef.current = columnKey;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', columnKey);
    setTimeout(() => {
      if (draggedColumnRef.current === columnKey) setDraggedColumn(columnKey);
    }, 0);
  };

  const handleDragEnd = () => {
    draggedColumnRef.current = null;
    setDraggedColumn(null);
    setDragOverColumn(null);
  };

  const handleDragOver = (e: React.DragEvent, columnKey: BookingsColumnKey) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (columnKey !== draggedColumnRef.current) {
      setDragOverColumn(columnKey);
    }
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  const handleDrop = (e: React.DragEvent, targetColumnKey: BookingsColumnKey) => {
    e.preventDefault();
    setDragOverColumn(null);

    const sourceKey = (draggedColumnRef.current ||
      e.dataTransfer.getData('text/plain')) as BookingsColumnKey | '';
    draggedColumnRef.current = null;
    setDraggedColumn(null);

    if (!sourceKey || sourceKey === targetColumnKey) return;

    const newOrder = [...columnOrder];
    const draggedIndex = newOrder.indexOf(sourceKey);
    const targetIndex = newOrder.indexOf(targetColumnKey);
    if (draggedIndex === -1 || targetIndex === -1) return;

    newOrder.splice(draggedIndex, 1);
    newOrder.splice(targetIndex, 0, sourceKey);

    setColumnOrder(newOrder);
    localStorage.setItem('bookings_column_order', JSON.stringify(newOrder));
  };

  const resetColumnOrder = () => {
    setColumnOrder(DEFAULT_COLUMN_ORDER);
    localStorage.removeItem('bookings_column_order');
  };
  
  const [filterPackages, setFilterPackages] = useState<Array<{id: number, name: string}>>([]);
  const [filterRooms, setFilterRooms] = useState<Array<{id: number, name: string}>>([]);
  const [filterCustomers, setFilterCustomers] = useState<Array<{id: number, name: string}>>([]);
  
  const updateColumnVisibility = (column: keyof BookingsColumnVisibility, visible: boolean) => {
    const updated = { ...columnVisibility, [column]: visible };
    setColumnVisibility(updated);
    localStorage.setItem('bookings_column_visibility', JSON.stringify(updated));
  };

  const toggleColumnVisibility = (column: keyof BookingsColumnVisibility) => {
    updateColumnVisibility(column, !columnVisibility[column]);
  };

  const [editingCell, setEditingCell] = useState<{ bookingId: string; field: string } | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [savingCell, setSavingCell] = useState<{ bookingId: string; field: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const filterVersionRef = useRef(0);

  const [showPackageModal, setShowPackageModal] = useState(false);
  const [showRoomModal, setShowRoomModal] = useState(false);
  const [selectedBookingForEdit, setSelectedBookingForEdit] = useState<BookingsPageBooking | null>(null);
  const [availablePackages, setAvailablePackages] = useState<PackageType[]>([]);
  const [availableRooms, setAvailableRooms] = useState<Room[]>([]);
  const [loadingPackages, setLoadingPackages] = useState(false);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [savingPackage, setSavingPackage] = useState(false);
  const [savingRoom, setSavingRoom] = useState(false);

  const [showDurationModal, setShowDurationModal] = useState(false);
  const [durationValue, setDurationValue] = useState<number>(2);
  const [durationUnit, setDurationUnit] = useState<'hours' | 'minutes'>('hours');
  const [savingDuration, setSavingDuration] = useState(false);

  const [showDateModal, setShowDateModal] = useState(false);
  const [showTimeModal, setShowTimeModal] = useState(false);
  const [dateValue, setDateValue] = useState<string>('');
  const [timeValue, setTimeValue] = useState<string>('');
  const [savingDate, setSavingDate] = useState(false);
  const [savingTime, setSavingTime] = useState(false);

  const [showLocationModal, setShowLocationModal] = useState(false);
  const [locationValue, setLocationValue] = useState<number | ''>('');
  const [locationRoomValue, setLocationRoomValue] = useState<number | ''>('');
  const [savingLocation, setSavingLocation] = useState(false);
  const [destinationRooms, setDestinationRooms] = useState<Room[]>([]);
  const [loadingDestinationRooms, setLoadingDestinationRooms] = useState(false);
  const [destinationBookings, setDestinationBookings] = useState<Booking[]>([]);
  const [loadingDestinationBookings, setLoadingDestinationBookings] = useState(false);
  const [locationConflicts, setLocationConflicts] = useState<Array<{ type: string; message: string }>>([]);

  const [showLocationRequestModal, setShowLocationRequestModal] = useState(false);
  const [requestLocationValue, setRequestLocationValue] = useState<number | ''>('');
  const [requestReasonValue, setRequestReasonValue] = useState('');
  const [submittingLocationRequest, setSubmittingLocationRequest] = useState(false);
  const [locationRequestError, setLocationRequestError] = useState<string | null>(null);
  const [allLocations, setAllLocations] = useState<Array<{ id: number; name: string }>>([]);

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

  const editableFields = [
    { key: 'customerName', label: 'Customer Name', type: 'text', apiField: 'guest_name' },
    { key: 'email', label: 'Email', type: 'email', apiField: 'guest_email' },
    { key: 'phone', label: 'Phone', type: 'tel', apiField: 'guest_phone' },
    { key: 'participants', label: 'Participants', type: 'number', apiField: 'participants' },
    { key: 'totalAmount', label: 'Total Amount', type: 'number', apiField: 'total_amount' },
    { key: 'amountPaid', label: 'Amount Paid', type: 'number', apiField: 'amount_paid' },
    { key: 'notes', label: 'Notes', type: 'text', apiField: 'notes' },
  ];

  const statusColors = {
    pending: 'bg-yellow-100 text-yellow-800',
    confirmed: `bg-${themeColor}-100 text-${fullColor}`,
    cancelled: 'bg-red-100 text-red-800',
    'checked-in': 'bg-green-100 text-green-800',
    completed: 'bg-blue-100 text-blue-800'
  };

  const paymentColors = {
    card: `bg-${themeColor}-100 text-${fullColor}`,
    'authorize.net': `bg-${themeColor}-100 text-${fullColor}`,
    'in-store': 'bg-green-100 text-green-800',
    paylater: 'bg-orange-100 text-orange-800'
  };

  const paymentStatusColors = {
    paid: 'bg-green-100 text-green-800',
    partial: 'bg-yellow-100 text-yellow-800',
    pending: 'bg-gray-100 text-gray-800',
    refunded: 'bg-purple-100 text-purple-800',
    voided: 'bg-red-100 text-red-800'
  };

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
      value: `$${Number(bookings.filter(b => b.status !== 'cancelled').reduce((sum, booking) => sum + booking.amountPaid, 0)).toFixed(2)}`,
      change: `Excludes ${bookings.filter(b => b.status === 'cancelled').length} cancelled`,
      icon: DollarSign,
      accent: `bg-${themeColor}-100 text-${fullColor}`,
    },
    {
      title: 'Possible Revenue',
      value: `$${Number(bookings.filter(b => b.status !== 'cancelled').reduce((sum, booking) => sum + booking.totalAmount, 0)).toFixed(2)}`,
      change: `Total if all bookings fully paid`,
      icon: DollarSign,
      accent: `bg-${themeColor}-100 text-${fullColor}`,
    },
  ];

  const columnConfig: Record<BookingsColumnKey, { 
    label: string; 
    isVisible: () => boolean;
  }> = {
    id: { label: 'Conf #', isVisible: () => columnVisibility.id },
    referenceNumber: { label: 'Ref #', isVisible: () => columnVisibility.referenceNumber },
    dateTime: { label: 'Date/Time', isVisible: () => columnVisibility.bookingDate || columnVisibility.bookingTime },
    customer: { label: 'Customer', isVisible: () => columnVisibility.guestName || columnVisibility.guestEmail || columnVisibility.guestPhone },
    guestAddress: { label: 'Address', isVisible: () => columnVisibility.guestAddress },
    packageRoom: { label: 'Package/Room', isVisible: () => columnVisibility.packageName || columnVisibility.roomName },
    location: { label: 'Location', isVisible: () => columnVisibility.location },
    duration: { label: 'Duration', isVisible: () => columnVisibility.duration },
    participants: { label: 'Guests', isVisible: () => columnVisibility.participants },
    status: { label: 'Status', isVisible: () => columnVisibility.status },
    paymentMethod: { label: 'Payment', isVisible: () => columnVisibility.paymentMethod },
    paymentStatus: { label: 'Pay Status', isVisible: () => columnVisibility.paymentStatus },
    amountPaid: { label: 'Paid', isVisible: () => columnVisibility.amountPaid },
    totalAmount: { label: 'Total', isVisible: () => columnVisibility.totalAmount },
    fees: { label: 'Fees', isVisible: () => columnVisibility.fees },
    guestOfHonor: { label: 'Guest of Honor', isVisible: () => columnVisibility.guestOfHonor },
    notes: { label: 'Notes', isVisible: () => columnVisibility.notes },
    specialRequests: { label: 'Requests', isVisible: () => columnVisibility.specialRequests },
    createdAt: { label: 'Created', isVisible: () => columnVisibility.createdAt },
    updatedAt: { label: 'Updated', isVisible: () => columnVisibility.updatedAt },
  };

  useEffect(() => {
    loadLocations();

    packageCacheService.warmupCache();
    roomCacheService.warmupCache();
  }, []);

  useEffect(() => {
    if (isCompanyAdmin) return;
    locationService.getLocations({ per_page: 100 })
      .then((res) => {
        if (res.success && res.data) {
          setAllLocations(res.data.map((l) => ({ id: l.id, name: l.name })));
        }
      })
      .catch(() => {});
  }, [isCompanyAdmin]);
  
  useEffect(() => {
    loadBookings();
  }, [selectedLocation]);

  useEffect(() => {
    const unsubscribe = bookingCacheService.onCacheUpdate(async (event: CustomEvent) => {
      if (event.detail?.source === 'api') {
        const cacheFilters: Record<string, number> = {};
        if (selectedLocation !== null) {
          cacheFilters.location_id = selectedLocation;
        }
        const cachedBookings = await bookingCacheService.getFilteredBookingsFromCache(cacheFilters);
        if (cachedBookings) {
          const transformedBookings: BookingsPageBooking[] = cachedBookings.map(transformRawBooking);
          extractFilterOptions(transformedBookings);
          setBookings(transformedBookings);
        }
      }
    });
    return () => unsubscribe();
  }, [selectedLocation]);

  const loadLocations = async () => {
    try {
      if (isCompanyAdmin) {
        const cached = localStorage.getItem('zapzone_locations');
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setAvailableLocations(parsed);
            }
          } catch { /* ignore bad cache */ }
        }
        const response = await locationService.getLocations();
        if (response.success && response.data) {
          const locationsArray = Array.isArray(response.data) ? response.data : [];
          const mapped = locationsArray.map((loc: any) => ({
            id: loc.id,
            name: loc.name
          }));
          setAvailableLocations(mapped);
          localStorage.setItem('zapzone_locations', JSON.stringify(mapped));
        }
      } else if (currentUser?.location_id) {
        const cached = localStorage.getItem('zapzone_locations');
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            const found = parsed.find((l: any) => l.id === currentUser.location_id);
            if (found) {
              setAvailableLocations([found]);
              return; // Cache hit, no API call needed
            }
          } catch { /* ignore */ }
        }
        const response = await locationService.getLocation(currentUser.location_id);
        if (response.success && response.data) {
          const loc = response.data;
          const mapped = [{ id: loc.id, name: loc.name }];
          setAvailableLocations(mapped);
          localStorage.setItem('zapzone_locations', JSON.stringify(mapped));
        }
      }
    } catch (error) {
      console.error('Error loading locations:', error);
    }
  };

  useEffect(() => {
    applyFilters();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookings, filters]);

  const loadBookings = async () => {
    try {
      setLoading(true);
      
      const hasCachedData = await bookingCacheService.hasCachedData();
      const isCacheStale = hasCachedData ? await bookingCacheService.isCacheStale(2) : true;
      
      if (hasCachedData && !isCacheStale) {
        const cacheMeta = await bookingCacheService.getCacheMetadata();
        const cachedScope = cacheMeta?.locationId ?? null;
        const cacheCoversScope = cachedScope === null || cachedScope === selectedLocation;

        if (cacheCoversScope) {
          console.log('[Bookings] Loading from cache...');

          const cacheFilters: any = {};
          if (selectedLocation !== null) {
            cacheFilters.location_id = selectedLocation;
          }

          const cachedBookings = await bookingCacheService.getFilteredBookingsFromCache(cacheFilters);

          if (cachedBookings && cachedBookings.length > 0) {
            const transformedBookings: BookingsPageBooking[] = cachedBookings.map(transformRawBooking);

            extractFilterOptions(transformedBookings);

            console.log('[Bookings] Loaded from cache:', transformedBookings.length, 'bookings');
            setBookings(transformedBookings);
            setLoading(false);
            bookingCacheService.syncInBackground({ user_id: getStoredUser()?.id });
            return;
          }
        }
      }
      
      console.log('[Bookings] Fetching from API...');
      const baseParams: any = {
        per_page: 500,
        user_id: getStoredUser()?.id,
        sort_by: 'booking_date',
        sort_order: 'asc',
      };
      if (selectedLocation !== null) {
        baseParams.location_id = selectedLocation;
      }

      let allRawBookings: any[] = [];
      let currentPage = 1;
      let lastPage = 1;

      do {
        const response = await bookingService.getBookings({ ...baseParams, page: currentPage });
        if (response.success && response.data) {
          allRawBookings = allRawBookings.concat(response.data.bookings);
          lastPage = response.data.pagination?.last_page ?? 1;
        } else {
          break;
        }
        currentPage++;
      } while (currentPage <= lastPage);

      const transformedBookings: BookingsPageBooking[] = allRawBookings.map(transformRawBooking);
      console.log('[Bookings] Fetched from API:', transformedBookings.length, 'bookings across', lastPage, 'page(s)');

      extractFilterOptions(transformedBookings);
      setBookings(transformedBookings);

      if (allRawBookings.length > 0) {
        bookingCacheService.cacheBookings(allRawBookings, { locationId: selectedLocation ?? undefined }).catch(err =>
          console.warn('[Bookings] Background cache write failed:', err)
        );
      }
    } catch (error) {
      console.error('Error loading bookings:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const extractFilterOptions = (bookingsList: BookingsPageBooking[]) => {
    const uniquePackages = new Map<number, string>();
    const uniqueRooms = new Map<number, string>();
    const uniqueCustomers = new Map<number, string>();
    
    bookingsList.forEach(b => {
      if (b.packageId && b.packageName !== 'N/A') {
        uniquePackages.set(b.packageId, b.packageName);
      }
      if (b.roomId && b.room !== 'N/A') {
        uniqueRooms.set(b.roomId, b.room);
      }
      if (b.customerId && b.customerName !== 'Guest') {
        uniqueCustomers.set(b.customerId, b.customerName);
      }
    });
    
    setFilterPackages(Array.from(uniquePackages.entries()).map(([id, name]) => ({ id, name })));
    setFilterRooms(Array.from(uniqueRooms.entries()).map(([id, name]) => ({ id, name })));
    setFilterCustomers(Array.from(uniqueCustomers.entries()).map(([id, name]) => ({ id, name })));
  };

  const applyFilters = async () => {
    const currentVersion = ++filterVersionRef.current;

    if (filters.search && filters.search.length >= 2) {
      try {
        const response = await bookingService.searchBookings(filters.search);
        if (currentVersion !== filterVersionRef.current) return;
        if (response.success && response.data) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const transformedResults = response.data.map((booking: any) => {
            const totalAmount = Number(booking.total_amount);
            const amountPaid = Number(booking.amount_paid || 0);
            return {
              id: booking.id.toString(),
              type: 'package' as const,
              packageName: booking.package?.name || 'N/A',
              packageId: booking.package_id,
              room: booking.room?.name || 'N/A',
              roomId: booking.room_id,
              customerName: booking.customer 
                ? `${booking.customer.first_name} ${booking.customer.last_name}`
                : booking.guest_name || 'Guest',
              customerId: booking.customer_id,
              email: booking.customer?.email || booking.guest_email || '',
              phone: booking.customer?.phone || booking.guest_phone || '',
              date: booking.booking_date,
              time: booking.booking_time,
              participants: booking.participants,
              status: booking.status as BookingsPageBooking['status'],
              totalAmount,
              amountPaid,
              paymentStatus: derivePaymentStatus(amountPaid, totalAmount),
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
              locationId: booking.location_id,
              internal_notes: booking.internal_notes,
              appliedFees: booking.applied_fees || null,
            };
          });
          
          let result: BookingsPageBooking[] = transformedResults;
          
          if (filters.status !== 'all') {
            result = result.filter(booking => booking.status === filters.status);
          }
          if (filters.payment !== 'all') {
            result = result.filter(booking => booking.paymentMethod === filters.payment);
          }
          if (filters.packageId !== 'all') {
            result = result.filter(booking => booking.packageId?.toString() === filters.packageId);
          }
          if (filters.roomId !== 'all') {
            result = result.filter(booking => booking.roomId?.toString() === filters.roomId);
          }
          if (filters.customerId !== 'all') {
            result = result.filter(booking => booking.customerId?.toString() === filters.customerId);
          }
          if (filters.dateRange.start) {
            result = result.filter(booking => {
              const bookingDate = booking.date?.split('T')[0];
              return bookingDate >= filters.dateRange.start;
            });
          }
          if (filters.dateRange.end) {
            result = result.filter(booking => {
              const bookingDate = booking.date?.split('T')[0];
              return bookingDate <= filters.dateRange.end;
            });
          }
          
          result = applyDefaultSort(result);
          
          setFilteredBookings(result);
          setCurrentPage(1);
          return;
        }
      } catch (error) {
        console.error('Error searching bookings:', error);
        if (currentVersion !== filterVersionRef.current) return;
      }
    }
    
    let result = [...bookings];

    if (filters.search) {
      const searchTerm = filters.search.toLowerCase();
      result = result.filter(booking =>
        booking.customerName.toLowerCase().includes(searchTerm) ||
        booking.email.toLowerCase().includes(searchTerm) ||
        booking.packageName.toLowerCase().includes(searchTerm) ||
        booking.phone.includes(searchTerm) ||
        booking.referenceNumber?.toLowerCase().includes(searchTerm) ||
        booking.id.includes(searchTerm)
      );
    }

    if (filters.status !== 'all') {
      result = result.filter(booking => booking.status === filters.status);
    }

    if (filters.payment !== 'all') {
      result = result.filter(booking => booking.paymentMethod === filters.payment);
    }
    
    if (filters.packageId !== 'all') {
      result = result.filter(booking => booking.packageId?.toString() === filters.packageId);
    }
    
    if (filters.roomId !== 'all') {
      result = result.filter(booking => booking.roomId?.toString() === filters.roomId);
    }
    
    if (filters.customerId !== 'all') {
      result = result.filter(booking => booking.customerId?.toString() === filters.customerId);
    }

    if (filters.dateRange.start) {
      result = result.filter(booking => {
        const bookingDate = booking.date?.split('T')[0];
        return bookingDate >= filters.dateRange.start;
      });
    }
    if (filters.dateRange.end) {
      result = result.filter(booking => {
        const bookingDate = booking.date?.split('T')[0];
        return bookingDate <= filters.dateRange.end;
      });
    }

    result = applyDefaultSort(result);

    setFilteredBookings(result);
    setCurrentPage(1);
  };

  const applyDefaultSort = (list: BookingsPageBooking[]): BookingsPageBooking[] => {
    return [...list].sort((a, b) => {
      const isCheckedInA = a.status === 'checked-in';
      const isCheckedInB = b.status === 'checked-in';
      if (isCheckedInA && !isCheckedInB) return 1;
      if (!isCheckedInA && isCheckedInB) return -1;

      const dateA = parseLocalDate(a.date);
      const dateB = parseLocalDate(b.date);
      dateA.setHours(0, 0, 0, 0);
      dateB.setHours(0, 0, 0, 0);
      const dateComparison = dateB.getTime() - dateA.getTime();
      if (dateComparison !== 0) return dateComparison;

      const timeA = (a.time || '00:00').split(':').map(Number);
      const timeB = (b.time || '00:00').split(':').map(Number);
      return (timeB[0] * 60 + (timeB[1] || 0)) - (timeA[0] * 60 + (timeA[1] || 0));
    });
  };

  const handleColumnSort = (columnKey: BookingsColumnKey) => {
    if (sortColumn === columnKey) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else {
        setSortColumn(null);
        setSortDirection('asc');
      }
    } else {
      setSortColumn(columnKey);
      setSortDirection('asc');
    }
  };

  const getSortedBookings = (list: BookingsPageBooking[]): BookingsPageBooking[] => {
    if (!sortColumn) return list;

    return [...list].sort((a, b) => {
      let valA: any;
      let valB: any;
      const dir = sortDirection === 'asc' ? 1 : -1;

      switch (sortColumn) {
        case 'id':
          return (Number(a.id) - Number(b.id)) * dir;
        case 'referenceNumber':
          return (a.referenceNumber || '').localeCompare(b.referenceNumber || '') * dir;
        case 'dateTime':
          valA = parseLocalDate(a.date).getTime();
          valB = parseLocalDate(b.date).getTime();
          if (valA !== valB) return (valA - valB) * dir;
          const tA = (a.time || '00:00').split(':').map(Number);
          const tB = (b.time || '00:00').split(':').map(Number);
          return ((tA[0] * 60 + (tA[1] || 0)) - (tB[0] * 60 + (tB[1] || 0))) * dir;
        case 'customer':
          return (a.customerName || '').localeCompare(b.customerName || '') * dir;
        case 'packageRoom':
          return (a.packageName || '').localeCompare(b.packageName || '') * dir;
        case 'location':
          return (a.location || '').localeCompare(b.location || '') * dir;
        case 'participants':
          return (a.participants - b.participants) * dir;
        case 'status':
          return (a.status || '').localeCompare(b.status || '') * dir;
        case 'paymentMethod':
          return (a.paymentMethod || '').localeCompare(b.paymentMethod || '') * dir;
        case 'paymentStatus':
          return (a.paymentStatus || '').localeCompare(b.paymentStatus || '') * dir;
        case 'amountPaid':
          return (a.amountPaid - b.amountPaid) * dir;
        case 'totalAmount':
          return (a.totalAmount - b.totalAmount) * dir;
        case 'fees':
          const aFees = (a.appliedFees || []).reduce((s, f) => s + f.fee_amount, 0);
          const bFees = (b.appliedFees || []).reduce((s, f) => s + f.fee_amount, 0);
          return (aFees - bFees) * dir;
        case 'createdAt':
          return (new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()) * dir;
        case 'updatedAt':
          return (new Date(a.updatedAt || 0).getTime() - new Date(b.updatedAt || 0).getTime()) * dir;
        default:
          return 0;
      }
    });
  };

  const handleFilterChange = (key: keyof BookingsPageFilterOptions, value: string) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
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
      payment: 'all',
      packageId: 'all',
      roomId: 'all',
      customerId: 'all'
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
      const userId = getStoredUser()?.id;
      const response = await bookingService.checkInBooking(referenceNumber, userId);
      
      if (response?.data) {
        await bookingCacheService.updateBookingInCache(response.data);
      }
      
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
      setSavingStatusBookingId(id);
      
      const booking = bookings.find(b => b.id === id);
      if (!booking) return;

      const response = await bookingService.updateBooking(Number(id), { status: newStatus });
      
      if (response.data) {
        await bookingCacheService.updateBookingInCache(response.data);
      }
      
      const updatedBookings = bookings.map(b =>
        b.id === id ? { ...b, status: newStatus } : b
      );
      setBookings(updatedBookings);
      
      logBookingActivity(booking, 'Booking Status Update', `Status changed to ${newStatus}`);
    } catch (error) {
      console.error('Error updating booking status:', error);
      alert('Failed to update booking status. Please try again.');
    } finally {
      setSavingStatusBookingId(null);
    }
  };


  const logBookingActivity = async (
    booking: BookingsPageBooking, 
    action: string, 
    description: string,
    locationId?: number
  ) => {
    try {
      const user = getStoredUser();
      if (!user) return;

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
          category: ['create', 'update', 'delete', 'view', 'export', 'import'].includes(action) ? action : 'other',
          description: description,
          metadata: {
            resource_name: `Booking #${booking.referenceNumber}`,
            reference_number: booking.referenceNumber,
            customer_name: booking.customerName,
            package_name: booking.packageName,
            booking_date: booking.date,
            status: booking.status,
            performed_by: user.name || user.email || `User #${user.id}`,
          }
        })
      });
    } catch (error) {
      console.error('Error logging activity:', error);
    }
  };

  const handleOpenPackageModal = async (booking: BookingsPageBooking) => {
    setSelectedBookingForEdit(booking);
    setShowPackageModal(true);
    setLoadingPackages(true);
    
    try {
      const cachedBooking = await bookingCacheService.getBookingFromCache(Number(booking.id));
      const locationId = cachedBooking?.location_id;
      
      if (locationId) {
        const cachedPackages = await packageCacheService.getCachedPackages();
        
        if (cachedPackages && cachedPackages.length > 0) {
          const filteredPackages = cachedPackages.filter(
            (pkg: PackageType) => pkg.location_id === locationId && pkg.is_active
          );
          setAvailablePackages(filteredPackages);
          setLoadingPackages(false);
          
          packageCacheService.syncInBackground({ location_id: locationId, is_active: true });
        } else {
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
        
        logBookingActivity(
          selectedBookingForEdit, 
          'update', 
          `Package changed to ${pkg.name}`
        );
        
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

  const handleOpenRoomModal = async (booking: BookingsPageBooking) => {
    setSelectedBookingForEdit(booking);
    setShowRoomModal(true);
    setLoadingRooms(true);
    
    try {
      const cachedBooking = await bookingCacheService.getBookingFromCache(Number(booking.id));
      const locationId = cachedBooking?.location_id;
      
      if (locationId) {
        const cachedRooms = await roomCacheService.getFilteredRoomsFromCache({ location_id: locationId, is_available: true });

        if (cachedRooms && cachedRooms.length > 0) {
          const filteredRooms = cachedRooms.filter(
            (room: Room) => room.location_id === locationId && room.is_available
          );
          setAvailableRooms(filteredRooms);
          setLoadingRooms(false);
          
          roomCacheService.syncInBackground({ location_id: locationId, is_available: true });
        } else {
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
        
        logBookingActivity(
          selectedBookingForEdit, 
          'update', 
          `Room changed to ${room.name}`
        );
        
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

  const handleOpenDurationModal = (booking: BookingsPageBooking) => {
    setSelectedBookingForEdit(booking);
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
        
        logBookingActivity(
          selectedBookingForEdit, 
          'update', 
          `Duration changed to ${durationValue} ${durationUnit}`
        );
        
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
        
        logBookingActivity(
          selectedBookingForEdit, 
          'update', 
          `Date changed to ${dateValue}`
        );
        
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
        
        logBookingActivity(
          selectedBookingForEdit, 
          'update', 
          `Time changed to ${formatTime12Hour(timeValue)}`
        );
        
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

  const handleOpenLocationModal = (booking: BookingsPageBooking) => {
    setSelectedBookingForEdit(booking);
    setLocationValue(booking.locationId ?? '');
    setLocationRoomValue('');
    setLocationConflicts([]);
    setDestinationBookings([]);
    setDestinationRooms([]);
    setShowLocationModal(true);
  };

  const handleCloseLocationModal = () => {
    setShowLocationModal(false);
    setSelectedBookingForEdit(null);
    setLocationValue('');
    setLocationRoomValue('');
    setLocationConflicts([]);
    setDestinationBookings([]);
    setDestinationRooms([]);
  };

  const handleOpenLocationRequestModal = (booking: BookingsPageBooking) => {
    setSelectedBookingForEdit(booking);
    setRequestLocationValue('');
    setRequestReasonValue('');
    setLocationRequestError(null);
    setShowLocationRequestModal(true);
  };

  const handleCloseLocationRequestModal = () => {
    setShowLocationRequestModal(false);
    setSelectedBookingForEdit(null);
    setRequestLocationValue('');
    setRequestReasonValue('');
    setLocationRequestError(null);
  };

  const handleSubmitLocationRequest = async () => {
    if (!selectedBookingForEdit || requestLocationValue === '') return;
    setSubmittingLocationRequest(true);
    setLocationRequestError(null);
    try {
      const response = await locationChangeRequestService.create(Number(selectedBookingForEdit.id), {
        to_location_id: Number(requestLocationValue),
        reason: requestReasonValue.trim() || undefined,
      });
      if (response.success) {
        handleCloseLocationRequestModal();
      }
    } catch (error) {
      const axiosError = error as { response?: { data?: { message?: string } } };
      setLocationRequestError(axiosError?.response?.data?.message || 'Failed to submit request. Please try again.');
    } finally {
      setSubmittingLocationRequest(false);
    }
  };

  useEffect(() => {
    if (!showLocationModal || !selectedBookingForEdit || !locationValue) {
      setDestinationBookings([]);
      setDestinationRooms([]);
      return;
    }

    const destId = Number(locationValue);
    let cancelled = false;

    const loadDestinationPreview = async () => {
      setLoadingDestinationBookings(true);
      try {
        const dateStr = selectedBookingForEdit.date?.split('T')[0];
        const response = await bookingService.getBookingsByLocationAndDate(destId, dateStr);
        if (!cancelled && response.success) {
          setDestinationBookings(response.data || []);
        }
      } catch (error) {
        console.error('Error loading destination bookings:', error);
        if (!cancelled) setDestinationBookings([]);
      } finally {
        if (!cancelled) setLoadingDestinationBookings(false);
      }

      setLoadingDestinationRooms(true);
      try {
        const cachedRooms = await roomCacheService.getFilteredRoomsFromCache({ location_id: destId, is_available: true });
        let rooms: Room[];
        if (cachedRooms && cachedRooms.length > 0) {
          roomCacheService.syncInBackground({ location_id: destId, is_available: true });
          rooms = cachedRooms;
        } else {
          rooms = await roomCacheService.fetchAndCacheRooms({ location_id: destId, is_available: true });
        }
        if (!cancelled) {
          setDestinationRooms(rooms.filter((room: Room) => room.location_id === destId && room.is_available));
        }
      } catch (error) {
        console.error('Error loading destination rooms:', error);
        if (!cancelled) setDestinationRooms([]);
      } finally {
        if (!cancelled) setLoadingDestinationRooms(false);
      }
    };

    loadDestinationPreview();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showLocationModal, selectedBookingForEdit, locationValue]);

  const handleSaveLocation = async (force: boolean = false) => {
    if (!selectedBookingForEdit || !locationValue) return;

    const destId = Number(locationValue);
    setSavingLocation(true);
    try {
      const payload: { location_id: number; room_id?: number | null; force?: boolean } = {
        location_id: destId,
        room_id: locationRoomValue !== '' ? Number(locationRoomValue) : null,
      };
      if (force) {
        payload.force = true;
      }

      const response = await bookingService.updateBookingLocation(Number(selectedBookingForEdit.id), payload);

      if (response.data) {
        await bookingCacheService.updateBookingInCache(response.data);
      }

      const destName =
        availableLocations.find(l => l.id === destId)?.name ||
        (response.data?.location as { name?: string } | undefined)?.name ||
        'Location';
      const destRoom = locationRoomValue !== ''
        ? destinationRooms.find(r => r.id === Number(locationRoomValue))
        : null;

      logBookingActivity(
        selectedBookingForEdit,
        'update',
        `Location changed to ${destName}`,
        destId
      );

      setBookings(prev =>
        prev.map(b =>
          b.id === selectedBookingForEdit.id
            ? {
                ...b,
                location: destName,
                locationId: destId,
                room: destRoom ? destRoom.name : '',
                roomId: destRoom ? destRoom.id : undefined,
              }
            : b
        )
      );

      handleCloseLocationModal();
    } catch (error) {
      const axiosError = error as { response?: { status?: number; data?: { conflicts?: Array<{ type: string; message: string }> } } };
      if (axiosError?.response?.status === 409) {
        setLocationConflicts(axiosError.response.data?.conflicts || []);
      } else {
        console.error('Error updating location:', error);
        alert('Failed to update location. Please try again.');
      }
    } finally {
      setSavingLocation(false);
    }
  };

  const handleOpenReportModal = async () => {
    setShowReportModal(true);
    setLoadingReportPackages(true);
    
    try {
      const cachedPackages = await packageCacheService.getCachedPackages();
      
      if (cachedPackages && cachedPackages.length > 0) {
        const filteredPackages = selectedLocation 
          ? cachedPackages.filter((pkg: PackageType) => pkg.location_id === selectedLocation && pkg.is_active)
          : cachedPackages.filter((pkg: PackageType) => pkg.is_active);
        setReportPackages(filteredPackages);
      } else {
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
      
      if (Array.isArray(reportFilters.packageIds)) {
        params.append('package_ids', reportFilters.packageIds.join(','));
      } else {
        params.append('package_ids', reportFilters.packageIds);
      }
      
      params.append('period_type', reportFilters.periodType);
      
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
      
      params.append('view_mode', reportFilters.viewMode);
      
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
      
      const reportUrl = `${API_BASE_URL}/bookings/details-report?${params.toString()}`;
      
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
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
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
      const allOtherIds = reportPackages.filter(pkg => pkg.id !== packageId).map(pkg => pkg.id);
      setReportFilters(prev => ({ 
        ...prev, 
        packageIds: allOtherIds.length === 0 ? 'all' : allOtherIds 
      }));
    } else if (Array.isArray(reportFilters.packageIds)) {
      if (reportFilters.packageIds.includes(packageId)) {
        const newIds = reportFilters.packageIds.filter(id => id !== packageId);
        setReportFilters(prev => ({ 
          ...prev, 
          packageIds: newIds.length === 0 ? 'all' : newIds 
        }));
      } else {
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
      setReportFilters(prev => ({ ...prev, packageIds: [] }));
    } else {
      setReportFilters(prev => ({ ...prev, packageIds: 'all' }));
    }
  };

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

    if (editValue === oldValueStr) {
      setEditingCell(null);
      setEditValue('');
      return;
    }

    setSavingCell(editingCell);

    try {
      let updateValue: string | number | null = editValue;
      
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
        if (response.data) {
          await bookingCacheService.updateBookingInCache(response.data);
        }

        logBookingActivity(
          booking, 
          'update', 
          `${fieldConfig.label} updated from "${oldValueStr}" to "${editValue}"`
        );

        setBookings(prev =>
          prev.map(b => {
            if (b.id === editingCell.bookingId) {
              const updates: Partial<BookingsPageBooking> = {};
              
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

  const renderColumnCell = (booking: BookingsPageBooking, columnKey: BookingsColumnKey): React.ReactNode => {
    switch (columnKey) {
      case 'id':
        return (
          <td key={columnKey} className="px-4 py-3 whitespace-nowrap">
            <span className={`text-xs font-semibold text-${fullColor} bg-${themeColor}-50 px-2 py-1 rounded`}>
              #{booking.id}
            </span>
          </td>
        );
      case 'referenceNumber':
        return (
          <td key={columnKey} className="px-4 py-3 whitespace-nowrap">
            <span className="text-xs font-mono text-gray-600 bg-gray-100 px-2 py-1 rounded">
              {booking.referenceNumber || '-'}
            </span>
          </td>
        );
      case 'dateTime':
        return (
          <td key={columnKey} className="px-4 py-3 whitespace-nowrap">
            {columnVisibility.bookingDate && (
              <div 
                className="font-medium text-gray-900 group cursor-pointer flex items-center gap-1 hover:bg-gray-100 rounded px-1 py-0.5 -mx-1"
                onClick={() => handleOpenDateModal(booking)}
                title="Click to change date"
              >
                <Calendar className="w-3 h-3 text-gray-400 mr-1" />
                <span>{parseLocalDate(booking.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                <Edit3 className="w-2.5 h-2.5 text-gray-400 opacity-0 group-hover:opacity-100 flex-shrink-0" />
              </div>
            )}
            {columnVisibility.bookingTime && (
              <div 
                className="text-xs text-gray-500 group cursor-pointer flex items-center gap-1 hover:bg-gray-100 rounded px-1 py-0.5 -mx-1"
                onClick={() => handleOpenTimeModal(booking)}
                title="Click to change time"
              >
                <Clock className="w-3 h-3 text-gray-400 mr-1" />
                <span>{formatTime12Hour(booking.time)}</span>
                <Edit3 className="w-2.5 h-2.5 text-gray-400 opacity-0 group-hover:opacity-100 flex-shrink-0" />
              </div>
            )}
          </td>
        );
      case 'customer':
        return (
          <td key={columnKey} className="px-4 py-3 whitespace-nowrap">
            <div className="relative group/customer">
              <Link
                to={`/bookings/edit/${booking.id}?from=bookings`}
                className="absolute -top-1 -right-1 p-1 rounded bg-white border border-gray-200 shadow-sm opacity-0 group-hover/customer:opacity-100 transition-opacity hover:bg-gray-50 hover:border-gray-300 z-10"
                title="Edit Booking"
                onClick={(e) => e.stopPropagation()}
              >
                <Pencil className={`w-3 h-3 text-${fullColor}`} />
              </Link>
              
              {columnVisibility.guestName && (
                <div className="font-medium text-gray-900">
                  {renderEditableCell(booking, 'customerName', booking.customerName)}
                </div>
              )}
              {columnVisibility.guestEmail && (
                <div className="text-xs text-gray-500">
                  {renderEditableCell(booking, 'email', booking.email)}
                </div>
              )}
              {columnVisibility.guestPhone && (
                <div className="text-xs text-gray-500">
                  {renderEditableCell(booking, 'phone', booking.phone)}
                </div>
              )}
            </div>
          </td>
        );
      case 'guestAddress':
        const addressParts = [
          booking.guestAddress,
          booking.guestCity,
          booking.guestState,
          booking.guestZip,
          booking.guestCountry
        ].filter(Boolean);
        const fullAddress = addressParts.join(', ');
        return (
          <td key={columnKey} className="px-4 py-3 text-xs text-gray-600 max-w-[200px] truncate" title={fullAddress}>
            {fullAddress || <span className="text-gray-400">-</span>}
          </td>
        );
      case 'packageRoom':
        return (
          <td key={columnKey} className="px-4 py-3 whitespace-nowrap">
            {columnVisibility.packageName && (
              <div 
                className="font-medium text-gray-900 group cursor-pointer flex items-center gap-1 hover:bg-gray-100 rounded px-1 py-0.5 -mx-1"
                onClick={() => handleOpenPackageModal(booking)}
                title="Click to change package"
              >
                <Package className="w-3 h-3 text-gray-400 mr-1" />
                <span>{booking.packageName}</span>
                <Edit3 className="w-2.5 h-2.5 text-gray-400 opacity-0 group-hover:opacity-100 flex-shrink-0" />
              </div>
            )}
            {columnVisibility.roomName && (
              <div 
                className={`text-xs text-${fullColor} group cursor-pointer flex items-center gap-1 hover:bg-gray-100 rounded px-1 py-0.5 -mx-1`}
                onClick={() => handleOpenRoomModal(booking)}
                title="Click to change room"
              >
                <Home className="w-2.5 h-2.5 text-gray-400 mr-0.5" />
                <span>{booking.room}</span>
                <Edit3 className="w-2.5 h-2.5 text-gray-400 opacity-0 group-hover:opacity-100 flex-shrink-0" />
              </div>
            )}
            {booking.attractions && booking.attractions.length > 0 && columnVisibility.packageName && (
              <div className="text-xs text-gray-500 mt-1">
                +{booking.attractions.length} attraction(s)
              </div>
            )}
          </td>
        );
      case 'location':
        return (
          <td key={columnKey} className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
            {isCompanyAdmin ? (
              <div
                className="group cursor-pointer flex items-center gap-1 hover:bg-gray-100 rounded px-1 py-0.5 -mx-1"
                onClick={() => handleOpenLocationModal(booking)}
                title="Click to change location"
              >
                <MapPin className={`text-${fullColor} h-4 w-4 flex-shrink-0`} />
                <span>{booking.location || <span className="text-gray-400">-</span>}</span>
                <Edit3 className="w-2.5 h-2.5 text-gray-400 opacity-0 group-hover:opacity-100 flex-shrink-0" />
              </div>
            ) : (
              <div
                className="group cursor-pointer flex items-center gap-1 hover:bg-gray-100 rounded px-1 py-0.5 -mx-1"
                onClick={() => handleOpenLocationRequestModal(booking)}
                title="Click to request a location change"
              >
                <MapPin className={`text-${fullColor} h-4 w-4 flex-shrink-0`} />
                <span>{booking.location || <span className="text-gray-400">-</span>}</span>
                <Edit3 className="w-2.5 h-2.5 text-gray-400 opacity-0 group-hover:opacity-100 flex-shrink-0" />
              </div>
            )}
          </td>
        );
      case 'duration':
        return (
          <td key={columnKey} className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
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
        );
      case 'participants':
        return (
          <td key={columnKey} className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
            {renderEditableCell(booking, 'participants', booking.participants)}
          </td>
        );
      case 'status': {
        const isStatusSaving = savingStatusBookingId === booking.id;
        return (
          <td key={columnKey} className="px-4 py-3 whitespace-nowrap">
            <div className="relative inline-flex items-center">
              <select
                value={booking.status}
                onChange={(e) => handleStatusChange(booking.id, e.target.value as BookingsPageBooking['status'])}
                disabled={isStatusSaving}
                className={`text-xs font-medium px-2 py-1 rounded-full ${statusColors[booking.status as keyof typeof statusColors] || 'bg-gray-100 text-gray-800'} border-none focus:ring-2 focus:ring-${themeColor}-600 ${isStatusSaving ? 'opacity-50 cursor-wait' : ''}`}
              >
                <option value="pending">Pending</option>
                <option value="confirmed">Confirmed</option>
                <option value="checked-in">Checked In</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
              {isStatusSaving && (
                <div className="absolute -right-5 top-1/2 -translate-y-1/2">
                  <div className={`animate-spin rounded-full h-3.5 w-3.5 border-2 border-gray-200 border-t-${fullColor}`}></div>
                </div>
              )}
            </div>
          </td>
        );
      }
      case 'paymentMethod':
        return (
          <td key={columnKey} className="px-4 py-3 whitespace-nowrap">
            <span className={`text-xs font-medium px-2 py-1 rounded-full ${paymentColors[booking.paymentMethod as keyof typeof paymentColors] || 'bg-gray-100 text-gray-800'}`}>
              {(booking.paymentMethod ?? 'N/A').replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </span>
          </td>
        );
      case 'paymentStatus':
        return (
          <td key={columnKey} className="px-4 py-3 whitespace-nowrap">
            <span className={`text-xs font-medium px-2 py-1 rounded-full ${paymentStatusColors[(booking.paymentStatus || 'pending') as keyof typeof paymentStatusColors]}`}>
              {(booking.paymentStatus || 'pending').charAt(0).toUpperCase() + (booking.paymentStatus || 'pending').slice(1)}
            </span>
          </td>
        );
      case 'amountPaid':
        return (
          <td key={columnKey} className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
            ${typeof booking.amountPaid === 'number' && !isNaN(booking.amountPaid) ? booking.amountPaid.toFixed(2) : '0.00'}
          </td>
        );
      case 'totalAmount':
        return (
          <td key={columnKey} className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
            ${typeof booking.totalAmount === 'number' && !isNaN(booking.totalAmount) ? booking.totalAmount.toFixed(2) : '0.00'}
          </td>
        );
      case 'fees':
        const fees = booking.appliedFees;
        if (!fees || fees.length === 0) {
          return (
            <td key={columnKey} className="px-4 py-3 whitespace-nowrap text-sm text-gray-400">
              —
            </td>
          );
        }
        const feesTotal = fees.reduce((sum, f) => sum + f.fee_amount, 0);
        return (
          <td key={columnKey} className="px-4 py-3 whitespace-nowrap text-sm text-gray-900" title={fees.map(f => `${f.fee_name}: $${f.fee_amount.toFixed(2)} (${f.fee_application_type})`).join(', ')}>
            <span className="underline decoration-dotted cursor-help">${feesTotal.toFixed(2)}</span>
          </td>
        );
      case 'guestOfHonor':
        const gohParts = [];
        if (booking.guestOfHonorName) gohParts.push(booking.guestOfHonorName);
        if (booking.guestOfHonorAge) gohParts.push(`${booking.guestOfHonorAge}yo`);
        if (booking.guestOfHonorGender) gohParts.push(booking.guestOfHonorGender);
        const gohDisplay = gohParts.length > 0 ? gohParts.join(', ') : null;
        return (
          <td key={columnKey} className="px-4 py-3 whitespace-nowrap text-xs text-gray-600">
            {gohDisplay || <span className="text-gray-400">-</span>}
          </td>
        );
      case 'notes':
        return (
          <td key={columnKey} className="px-4 py-3 text-xs text-gray-600 max-w-[150px] truncate" title={booking.notes || ''}>
            {booking.notes || <span className="text-gray-400">-</span>}
          </td>
        );
      case 'specialRequests':
        return (
          <td key={columnKey} className="px-4 py-3 text-xs text-gray-600 max-w-[150px] truncate" title={booking.specialRequests || ''}>
            {booking.specialRequests || <span className="text-gray-400">-</span>}
          </td>
        );
      case 'createdAt':
        return (
          <td key={columnKey} className="px-4 py-3 whitespace-nowrap text-xs text-gray-500">
            {booking.createdAt ? (
              <>
                <div>{new Date(booking.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}</div>
                <div className="text-gray-400">{new Date(booking.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</div>
              </>
            ) : '-'}
          </td>
        );
      case 'updatedAt':
        return (
          <td key={columnKey} className="px-4 py-3 whitespace-nowrap text-xs text-gray-500">
            {booking.updatedAt ? (
              <>
                <div>{new Date(booking.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}</div>
                <div className="text-gray-400">{new Date(booking.updatedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</div>
              </>
            ) : <span className="text-gray-400">-</span>}
          </td>
        );
      default:
        return null;
    }
  };

  const handleBulkDelete = async () => {
    if (selectedBookings.length === 0) return;
    
    if (window.confirm(`Are you sure you want to delete ${selectedBookings.length} booking(s)?`)) {
      try {
        await Promise.all(
          selectedBookings.map(async (id) => {
            await bookingService.deleteBooking(Number(id));
            await bookingCacheService.removeBookingFromCache(Number(id));
          })
        );
        
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
        
        await bookingCacheService.removeBookingFromCache(Number(id));
        
        const updatedBookings = bookings.filter(booking => booking.id !== id);
        setBookings(updatedBookings);
      } catch (error) {
        console.error('Error deleting booking:', error);
        alert('Failed to delete booking. Please try again.');
      }
    }
  };


  const transformTrashedBooking = (booking: any): BookingsPageBooking & { deletedAt?: string } => {
    const transformed = transformRawBooking(booking);
    return {
      ...transformed,
      deletedAt: booking.deleted_at,
    };
  };

  const loadTrashedBookings = async (page: number = 1) => {
    try {
      setTrashedLoading(true);
      const response = await bookingService.getTrashedBookings({
        page,
        per_page: itemsPerPage,
        search: filters.search,
        user_id: currentUser?.id,
        ...(selectedLocation && { location_id: selectedLocation })
      });

      if (response.success && response.data) {
        const transformed = response.data.bookings.map(transformTrashedBooking);
        setTrashedBookings(transformed);
        setTrashedTotalPages(response.data.pagination.last_page);
        setTrashedTotal(response.data.pagination.total);
        setTrashedCurrentPage(response.data.pagination.current_page);
      }
    } catch (error) {
      console.error('Error loading trashed bookings:', error);
      alert('Failed to load deleted bookings');
    } finally {
      setTrashedLoading(false);
    }
  };

  const handleRestoreBooking = async (id: string) => {
    try {
      const response = await bookingService.restoreBooking(Number(id));
      if (response.success) {
        alert('Booking restored successfully');
        loadTrashedBookings(trashedCurrentPage);
        if (response.data) {
          await bookingCacheService.updateBookingInCache(response.data);
        }
      }
    } catch (error) {
      console.error('Error restoring booking:', error);
      alert('Failed to restore booking');
    }
  };

  const handleBulkRestoreBookings = async () => {
    if (selectedTrashed.length === 0) return;

    try {
      const ids = selectedTrashed.map(id => Number(id));
      const response = await bookingService.bulkRestore(ids);
      if (response.success) {
        alert(`${response.data.restored_count} booking(s) restored successfully`);
        setSelectedTrashed([]);
        loadTrashedBookings(trashedCurrentPage);
      }
    } catch (error) {
      console.error('Error bulk restoring bookings:', error);
      alert('Failed to restore some bookings');
    }
  };

  const handleForceDeleteBooking = async (id: string, referenceNumber: string) => {
    if (!window.confirm(`Are you sure you want to PERMANENTLY delete booking #${referenceNumber}? This action cannot be undone.`)) {
      return;
    }

    try {
      await bookingService.forceDeleteBooking(Number(id));
      alert('Booking permanently deleted');
      loadTrashedBookings(trashedCurrentPage);
    } catch (error) {
      console.error('Error force deleting booking:', error);
      alert('Failed to permanently delete booking');
    }
  };

  const toggleTrashedView = () => {
    setShowTrashed(!showTrashed);
    if (!showTrashed) {
      loadTrashedBookings(1);
    }
    setSelectedTrashed([]);
  };

  const handleSelectTrashedBooking = (id: string) => {
    setSelectedTrashed(prev =>
      prev.includes(id)
        ? prev.filter(bookingId => bookingId !== id)
        : [...prev, id]
    );
  };

  const handleSelectAllTrashed = () => {
    if (selectedTrashed.length === trashedBookings.length) {
      setSelectedTrashed([]);
    } else {
      setSelectedTrashed(trashedBookings.map(b => b.id));
    }
  };

  const handleBulkStatusChange = async (newStatus: BookingsPageBooking['status']) => {
    if (selectedBookings.length === 0) return;
    
    try {
      await Promise.all(
        selectedBookings.map(async (id) => {
          let response;
          if (newStatus === 'checked-in') {
            const userId = getStoredUser()?.id;
            response = await bookingService.checkInBooking(id, userId);
          } else if (newStatus === 'cancelled') {
            response = await bookingService.cancelBooking(Number(id));
          } else {
            response = await bookingService.updateBooking(Number(id), { status: newStatus });
          }
          if (response?.data) {
            await bookingCacheService.updateBookingInCache(response.data);
          }
        })
      );
      
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
    setInternalNotesText(booking.internal_notes || '');
    setShowInternalNotesModal(true);
    setLoadingInternalNotes(true);
    try {
      const response = await bookingService.getBookingById(Number(booking.id));
      if (response.success && response.data) {
        setInternalNotesText(response.data.internal_notes || '');
      }
    } catch (error) {
      console.error('Error fetching booking details:', error);
    } finally {
      setLoadingInternalNotes(false);
    }
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
        const updatedBookings = bookings.map(booking =>
          booking.id === selectedBookingForNotes.id 
            ? { ...booking, internal_notes: internalNotesText } 
            : booking
        );
        setBookings(updatedBookings);
        
        if (response.data) {
          await bookingCacheService.updateBookingInCache(response.data);
        } else {
          try {
            const cachedBooking = await bookingCacheService.getBookingFromCache(Number(selectedBookingForNotes.id));
            if (cachedBooking) {
              await bookingCacheService.updateBookingInCache({
                ...cachedBooking,
                internal_notes: internalNotesText
              });
            }
          } catch (cacheErr) {
            console.error('[Bookings] Failed to patch cache for internal notes:', cacheErr);
          }
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
    if (customerSearchDebounce) {
      clearTimeout(customerSearchDebounce);
    }

    if (!searchTerm || searchTerm.length < 2) {
      setFoundCustomersForExport([]);
      setSearchingCustomers(false);
      return;
    }

    setSearchingCustomers(true);

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
        const csvData = convertToCSV(response.data.bookings);
        
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
      'Booking ID',
      'Reference Number',
      'Customer Name',
      'Email',
      'Phone',
      'Address',
      'City',
      'State',
      'Zip',
      'Country',
      'Package',
      'Room',
      'Location',
      'Booking Date',
      'Booking Time',
      'Participants',
      'Duration',
      'Status',
      'Payment Method',
      'Payment Status',
      'Transaction ID',
      'Total Amount',
      'Amount Paid',
      'Discount Amount',
      'Applied Fees',
      'Attractions',
      'Add-ons',
      'Guest of Honor',
      'Guest of Honor Age',
      'Guest of Honor Gender',
      'Notes',
      'Special Requests',
      'Internal Notes',
      'Checked In At',
      'Checked In By',
      'Created By',
      'Created Date',
      'Created Time',
      'Updated At'
    ];

    const formatDateCell = (value: any): string => {
      if (!value) return '';
      return String(value).split('T')[0];
    };
    const formatDateTimeCell = (value: any): string => {
      if (!value) return '';
      const d = new Date(value);
      return isNaN(d.getTime()) ? String(value) : d.toLocaleString();
    };

    const rows = bookings.map(booking => [
      booking.id ?? '',
      booking.reference_number || '',
      booking.customer ? `${booking.customer.first_name} ${booking.customer.last_name}` : booking.guest_name || '',
      booking.customer?.email || booking.guest_email || '',
      booking.customer?.phone || booking.guest_phone || '',
      booking.guest_address || '',
      booking.guest_city || '',
      booking.guest_state || '',
      booking.guest_zip || '',
      booking.guest_country || '',
      booking.package?.name || '',
      booking.room?.name || '',
      booking.location?.name || '',
      formatDateCell(booking.booking_date),
      booking.booking_time ? formatTime12Hour(booking.booking_time) : '',
      booking.participants || 0,
      booking.duration && booking.duration_unit ? formatDurationDisplay(booking.duration, booking.duration_unit) : '',
      booking.status || '',
      booking.payment_method || '',
      booking.payment_status || derivePaymentStatus(Number(booking.amount_paid || 0), Number(booking.total_amount || 0)),
      booking.transaction_id || '',
      booking.total_amount || 0,
      booking.amount_paid || 0,
      booking.discount_amount || 0,
      (Array.isArray(booking.applied_fees) ? booking.applied_fees : [])
        .map((f: any) => `${f.fee_name}: ${f.fee_amount}`).join('; '),
      booking.attractions?.map((a: any) => `${a.name} (${a.pivot?.quantity || 1})`).join('; ') || '',
      booking.add_ons?.map((a: any) => `${a.name} (${a.pivot?.quantity || 1})`).join('; ') || '',
      booking.guest_of_honor_name || '',
      booking.guest_of_honor_age ?? '',
      booking.guest_of_honor_gender || '',
      booking.notes || '',
      booking.special_requests || '',
      booking.internal_notes || '',
      formatDateTimeCell(booking.checked_in_at),
      booking.checked_in_by_user
        ? `${booking.checked_in_by_user.first_name || ''} ${booking.checked_in_by_user.last_name || ''}`.trim() || booking.checked_in_by_user.name || ''
        : '',
      booking.creator ? `${booking.creator.first_name || ''} ${booking.creator.last_name || ''}`.trim() : '',
      booking.created_at ? new Date(booking.created_at).toLocaleDateString() : '',
      booking.created_at ? new Date(booking.created_at).toLocaleTimeString() : '',
      formatDateTimeCell(booking.updated_at)
    ]);

    return toCsv(headers, rows);
  };

  const handleSubmitPayment = async () => {
    if (!selectedBookingForPayment) return;
    
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      alert('Please enter a valid payment amount');
      return;
    }

    const remainingAmount = Math.round((selectedBookingForPayment.totalAmount - selectedBookingForPayment.amountPaid) * 100) / 100;
    const roundedAmount = Math.round(amount * 100) / 100;
    
    if (roundedAmount > remainingAmount + 0.01) {
      alert(`Payment amount cannot exceed remaining balance of $${remainingAmount.toFixed(2)}`);
      return;
    }

    try {
      setProcessingPayment(true);

      let booking = await bookingCacheService.getBookingFromCache(Number(selectedBookingForPayment.id));
      
      if (!booking) {
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

      const paymentResponse = await createPayment({
        payable_id: Number(selectedBookingForPayment.id),
        payable_type: PAYMENT_TYPE.BOOKING,
        customer_id: customerId,
        location_id: locationId,
        amount: amount,
        currency: 'USD',
        method: paymentMethod,
        status: 'completed',
        notes: paymentNotes || (paymentMethod === 'in-store' 
          ? `In-store payment for booking ${selectedBookingForPayment.referenceNumber}`
          : `Authorize.net payment for booking ${selectedBookingForPayment.referenceNumber}`),
      });

      if (!paymentResponse.success) {
        throw new Error(paymentResponse.message || 'Failed to create payment');
      }

      const newAmountPaid = selectedBookingForPayment.amountPaid + amount;
      const newPaymentStatus: BookingsPageBooking['paymentStatus'] = newAmountPaid >= selectedBookingForPayment.totalAmount ? 'paid' : 'partial';

      const updateResponse = await bookingService.updateBooking(Number(selectedBookingForPayment.id), {
        amount_paid: newAmountPaid,
        payment_status: newPaymentStatus,
        status: 'confirmed', // Set status to confirmed when payment is made
      });

      if (updateResponse?.data) {
        await bookingCacheService.updateBookingInCache(updateResponse.data);
      }

      logBookingActivity(
        selectedBookingForPayment, 
        'payment', 
        `Payment of $${amount.toFixed(2)} processed via ${paymentMethod}. New total paid: $${newAmountPaid.toFixed(2)}`,
        locationId
      );

      const updatedBookings = bookings.map(booking =>
        booking.id === selectedBookingForPayment.id
          ? { ...booking, amountPaid: newAmountPaid, paymentStatus: newPaymentStatus, status: 'confirmed' as BookingsPageBooking['status'] }
          : booking
      );
      setBookings(updatedBookings);

      alert('Payment processed successfully!');
      handleClosePaymentModal();
    } catch (error) {
      console.error('Error processing payment:', error);
      alert('Failed to process payment. Please try again.');
    } finally {
      setProcessingPayment(false);
    }
  };

  const sortedBookings = getSortedBookings(filteredBookings);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentBookings = sortedBookings.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(sortedBookings.length / itemsPerPage);

  const paginate = (pageNumber: number) => setCurrentPage(pageNumber);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className={`animate-spin rounded-full h-12 w-12 border-b-2 border-${fullColor}`}></div>
      </div>
    );
  }

  return (
      <div className="px-6 py-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Bookings</h1>
            <p className="text-gray-800 mt-2">Manage all bookings</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mt-4 sm:mt-0">
            <StandardButton
              variant="primary"
              size="md"
              icon={Plus}
              onClick={() => navigate('/bookings/manual')}
            >
              Manual Booking
            </StandardButton>
            <ActionMenu
              items={[
                { label: 'Bulk Import', icon: Upload, onClick: () => setShowBulkImportModal(true) },
                { label: 'Export Bookings', icon: Download, onClick: () => setShowExportModal(true) },
                { label: 'Generate Report', icon: FileDown, onClick: handleOpenReportModal },
                {
                  label: showTrashed ? 'View Active' : 'View Deleted',
                  icon: showTrashed ? RefreshCcw : Archive,
                  onClick: toggleTrashedView,
                  dividerBefore: true,
                },
              ]}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-6">
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
                {(() => {
                  const count = [filters.status !== 'all', filters.payment !== 'all', filters.packageId !== 'all', filters.roomId !== 'all', filters.customerId !== 'all', !!filters.dateRange.start || !!filters.dateRange.end].filter(Boolean).length;
                  return count > 0 ? <span className={`ml-1.5 inline-flex items-center justify-center w-4 h-4 text-[10px] font-bold rounded-full bg-${themeColor}-600 text-white`}>{count}</span> : null;
                })()}
              </StandardButton>
              <div className="relative">
                <StandardButton
                  variant="secondary"
                  size="sm"
                  icon={showColumnSelector ? EyeOff : Columns}
                  onClick={() => setShowColumnSelector(!showColumnSelector)}
                >
                  Columns
                </StandardButton>
                {showColumnSelector && (
                  <div className="absolute right-0 mt-1 w-64 bg-white rounded-lg shadow-lg border border-gray-200 z-50 p-3 max-h-[80vh] overflow-y-auto">
                    <div className="text-xs font-semibold text-gray-700 mb-2">Toggle Columns</div>
                    
                    <div className="mb-2">
                      <div className="text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-1">Identifiers</div>
                      {(['id', 'referenceNumber'] as const).map(key => (
                        <label key={key} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded text-sm">
                          <input type="checkbox" checked={columnVisibility[key]} onChange={() => toggleColumnVisibility(key)} className={`rounded border-gray-300 text-${fullColor} focus:ring-${themeColor}-600 w-3.5 h-3.5`} />
                          <span className="text-gray-700">{key === 'id' ? 'Confirmation #' : 'Reference #'}</span>
                        </label>
                      ))}
                    </div>
                    
                    <div className="mb-2">
                      <div className="text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-1">Date & Time</div>
                      {(['bookingDate', 'bookingTime', 'duration'] as const).map(key => (
                        <label key={key} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded text-sm">
                          <input type="checkbox" checked={columnVisibility[key]} onChange={() => toggleColumnVisibility(key)} className={`rounded border-gray-300 text-${fullColor} focus:ring-${themeColor}-600 w-3.5 h-3.5`} />
                          <span className="text-gray-700">{key === 'bookingDate' ? 'Date' : key === 'bookingTime' ? 'Time' : 'Duration'}</span>
                        </label>
                      ))}
                    </div>
                    
                    <div className="mb-2">
                      <div className="text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-1">Customer</div>
                      {(['guestName', 'guestEmail', 'guestPhone', 'guestAddress'] as const).map(key => (
                        <label key={key} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded text-sm">
                          <input type="checkbox" checked={columnVisibility[key]} onChange={() => toggleColumnVisibility(key)} className={`rounded border-gray-300 text-${fullColor} focus:ring-${themeColor}-600 w-3.5 h-3.5`} />
                          <span className="text-gray-700">{key === 'guestName' ? 'Name' : key === 'guestEmail' ? 'Email' : key === 'guestPhone' ? 'Phone' : 'Address'}</span>
                        </label>
                      ))}
                    </div>
                    
                    <div className="mb-2">
                      <div className="text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-1">Package & Location</div>
                      {(['packageName', 'roomName', 'location'] as const).map(key => (
                        <label key={key} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded text-sm">
                          <input type="checkbox" checked={columnVisibility[key]} onChange={() => toggleColumnVisibility(key)} className={`rounded border-gray-300 text-${fullColor} focus:ring-${themeColor}-600 w-3.5 h-3.5`} />
                          <span className="text-gray-700">{key === 'packageName' ? 'Package' : key === 'roomName' ? 'Room' : 'Location'}</span>
                        </label>
                      ))}
                    </div>
                    
                    <div className="mb-2">
                      <div className="text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-1">Details</div>
                      {(['participants', 'status'] as const).map(key => (
                        <label key={key} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded text-sm">
                          <input type="checkbox" checked={columnVisibility[key]} onChange={() => toggleColumnVisibility(key)} className={`rounded border-gray-300 text-${fullColor} focus:ring-${themeColor}-600 w-3.5 h-3.5`} />
                          <span className="text-gray-700">{key === 'participants' ? 'Guests' : 'Status'}</span>
                        </label>
                      ))}
                    </div>
                    
                    <div className="mb-2">
                      <div className="text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-1">Payment</div>
                      {(['paymentMethod', 'paymentStatus', 'totalAmount', 'amountPaid'] as const).map(key => (
                        <label key={key} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded text-sm">
                          <input type="checkbox" checked={columnVisibility[key]} onChange={() => toggleColumnVisibility(key)} className={`rounded border-gray-300 text-${fullColor} focus:ring-${themeColor}-600 w-3.5 h-3.5`} />
                          <span className="text-gray-700">{key === 'paymentMethod' ? 'Method' : key === 'paymentStatus' ? 'Status' : key === 'totalAmount' ? 'Total' : 'Paid'}</span>
                        </label>
                      ))}
                    </div>
                    
                    <div className="mb-2">
                      <div className="text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-1">Additional</div>
                      {(['guestOfHonor', 'notes', 'specialRequests'] as const).map(key => (
                        <label key={key} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded text-sm">
                          <input type="checkbox" checked={columnVisibility[key]} onChange={() => toggleColumnVisibility(key)} className={`rounded border-gray-300 text-${fullColor} focus:ring-${themeColor}-600 w-3.5 h-3.5`} />
                          <span className="text-gray-700">{key === 'guestOfHonor' ? 'Guest of Honor' : key === 'notes' ? 'Notes' : 'Special Requests'}</span>
                        </label>
                      ))}
                    </div>
                    
                    <div className="mb-2">
                      <div className="text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-1">Timestamps</div>
                      {(['createdAt', 'updatedAt'] as const).map(key => (
                        <label key={key} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded text-sm">
                          <input type="checkbox" checked={columnVisibility[key]} onChange={() => toggleColumnVisibility(key)} className={`rounded border-gray-300 text-${fullColor} focus:ring-${themeColor}-600 w-3.5 h-3.5`} />
                          <span className="text-gray-700">{key === 'createdAt' ? 'Created' : 'Updated'}</span>
                        </label>
                      ))}
                    </div>
                    
                    <div className="mt-2 pt-2 border-t border-gray-100 flex gap-2">
                      <button
                        onClick={() => {
                          const allVisible = Object.fromEntries(
                            Object.keys(columnVisibility).map(k => [k, true])
                          ) as unknown as BookingsColumnVisibility;
                          setColumnVisibility(allVisible);
                          localStorage.setItem('bookings_column_visibility', JSON.stringify(allVisible));
                        }}
                        className={`text-xs text-${themeColor}-600 hover:text-${themeColor}-800`}
                      >
                        Show All
                      </button>
                      <button
                        onClick={() => {
                          const defaults = getDefaultColumnVisibility();
                          setColumnVisibility(defaults);
                          localStorage.setItem('bookings_column_visibility', JSON.stringify(defaults));
                        }}
                        className="text-xs text-gray-500 hover:text-gray-700"
                      >
                        Reset
                      </button>
                    </div>
                  </div>
                )}
              </div>
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

          {(() => {
            const chips: { label: string; onClear: () => void }[] = [];
            if (filters.status !== 'all') chips.push({ label: `Status: ${filters.status}`, onClear: () => handleFilterChange('status', 'all') });
            if (filters.payment !== 'all') chips.push({ label: `Payment: ${filters.payment}`, onClear: () => handleFilterChange('payment', 'all') });
            if (filters.packageId !== 'all') {
              const pkg = filterPackages.find(p => p.id.toString() === filters.packageId);
              chips.push({ label: `Package: ${pkg?.name || filters.packageId}`, onClear: () => handleFilterChange('packageId', 'all') });
            }
            if (filters.roomId !== 'all') {
              const room = filterRooms.find(r => r.id.toString() === filters.roomId);
              chips.push({ label: `Room: ${room?.name || filters.roomId}`, onClear: () => handleFilterChange('roomId', 'all') });
            }
            if (filters.customerId !== 'all') {
              const customer = filterCustomers.find(c => c.id.toString() === filters.customerId);
              chips.push({ label: `Customer: ${customer?.name || filters.customerId}`, onClear: () => handleFilterChange('customerId', 'all') });
            }
            if (filters.dateRange.start || filters.dateRange.end) {
              const label = filters.dateRange.start && filters.dateRange.end
                ? `Date: ${filters.dateRange.start} — ${filters.dateRange.end}`
                : `Date: ${filters.dateRange.start || '...'} — ${filters.dateRange.end || '...'}`;
              chips.push({ label, onClear: () => setFilters(prev => ({ ...prev, dateRange: { start: '', end: '' } })) });
            }
            if (chips.length === 0) return null;
            return (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {chips.map((chip, i) => (
                  <span key={i} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-${themeColor}-50 text-${themeColor}-700 border border-${themeColor}-200`}>
                    {chip.label}
                    <button type="button" onClick={chip.onClear} className={`hover:text-${themeColor}-900 ml-0.5`}>
                      <X size={11} />
                    </button>
                  </span>
                ))}
                {chips.length > 1 && (
                  <button type="button" onClick={clearFilters} className="text-xs text-gray-500 hover:text-gray-700 ml-1">
                    Clear all
                  </button>
                )}
              </div>
            );
          })()}

          {showFilters && (
            <div className="mt-3 p-3 bg-gray-50 rounded-lg">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
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
                    <option value="card">Card</option>
                    <option value="authorize.net">Authorize.net</option>
                    <option value="in-store">In-Store</option>
                    <option value="paylater">Pay Later</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-800 mb-1">Date Range</label>
                  <DateRangeCalendar
                    
                    startDate={filters.dateRange.start}
                    endDate={filters.dateRange.end}
                    onChange={(start, end) => {
                      setFilters(prev => ({
                        ...prev,
                        dateRange: { start, end }
                      }));
                    }}
                    themeColor={themeColor}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
                <div>
                  <label className="block text-xs font-medium text-gray-800 mb-1">Package</label>
                  <select
                    value={filters.packageId || ''}
                    onChange={(e) => handleFilterChange('packageId', e.target.value || 'all')}
                    className={`w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-${themeColor}-600 focus:border-${themeColor}-600`}
                  >
                    <option value="">All Packages</option>
                    {filterPackages.map(pkg => (
                      <option key={pkg.id} value={pkg.id}>{pkg.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-800 mb-1">Room/Space</label>
                  <select
                    value={filters.roomId || ''}
                    onChange={(e) => handleFilterChange('roomId', e.target.value || 'all')}
                    className={`w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-${themeColor}-600 focus:border-${themeColor}-600`}
                  >
                    <option value="">All Rooms</option>
                    {filterRooms.map(room => (
                      <option key={room.id} value={room.id}>{room.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-800 mb-1">Customer</label>
                  <select
                    value={filters.customerId || ''}
                    onChange={(e) => handleFilterChange('customerId', e.target.value || 'all')}
                    className={`w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-${themeColor}-600 focus:border-${themeColor}-600`}
                  >
                    <option value="">All Customers</option>
                    {filterCustomers.map(customer => (
                      <option key={customer.id} value={customer.id}>{customer.name}</option>
                    ))}
                  </select>
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
                <option value="completed">Complete</option>
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

        {!showTrashed && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
            <span className="text-xs text-gray-500">
              <span className="font-medium">Tip:</span> Drag column headers to reorder
            </span>
            <button
              onClick={resetColumnOrder}
              className={`text-xs text-${themeColor}-600 hover:text-${fullColor} flex items-center gap-1`}
            >
              <RefreshCcw className="w-3 h-3" />
              Reset Order
            </button>
          </div>
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
                  {columnOrder.map((columnKey) => {
                    const config = columnConfig[columnKey];
                    if (!config || !config.isVisible()) return null;
                    
                    const sortableColumns: BookingsColumnKey[] = [
                      'id', 'referenceNumber', 'dateTime', 'customer', 'packageRoom',
                      'location', 'participants', 'status', 'paymentMethod', 'paymentStatus',
                      'amountPaid', 'totalAmount', 'createdAt', 'updatedAt'
                    ];
                    const isSortable = sortableColumns.includes(columnKey);
                    const isActivelySorted = sortColumn === columnKey;

                    return (
                      <th
                        key={columnKey}
                        scope="col"
                        draggable
                        onDragStart={(e) => handleDragStart(e, columnKey)}
                        onDragEnd={handleDragEnd}
                        onDragOver={(e) => handleDragOver(e, columnKey)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, columnKey)}
                        onClick={() => isSortable && handleColumnSort(columnKey)}
                        className={`px-4 py-3 font-medium select-none transition-all duration-150 ${
                          isSortable ? 'cursor-pointer hover:bg-gray-100' : 'cursor-grab active:cursor-grabbing'
                        } ${
                          draggedColumn === columnKey ? 'opacity-50' : ''
                        } ${
                          dragOverColumn === columnKey ? `bg-${themeColor}-100 border-l-2 border-${themeColor}-400` : ''
                        } ${
                          isActivelySorted ? `bg-${themeColor}-50 text-${fullColor}` : ''
                        }`}
                      >
                        <div className="flex items-center gap-1">
                          <span>{config.label}</span>
                          {isSortable ? (
                            isActivelySorted ? (
                              sortDirection === 'asc' ? (
                                <ChevronUp className={`w-3.5 h-3.5 text-${fullColor}`} />
                              ) : (
                                <ChevronDown className={`w-3.5 h-3.5 text-${fullColor}`} />
                              )
                            ) : (
                              <ArrowUpDown className="w-3 h-3 text-gray-300" />
                            )
                          ) : (
                            <svg className="w-3 h-3 text-gray-300" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z"/>
                            </svg>
                          )}
                        </div>
                      </th>
                    );
                  })}
                  <th scope="col" className="px-4 py-3 font-medium w-20">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {currentBookings.length === 0 ? (
                  <tr>
                    <td colSpan={Object.values(columnVisibility).filter(Boolean).length + 2} className="px-6 py-8 text-center text-gray-500">
                      No package bookings found
                    </td>
                  </tr>
                ) : (
                  currentBookings.map((booking) => (
                    <tr key={booking.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={selectedBookings.includes(booking.id)}
                          onChange={() => handleSelectBooking(booking.id)}
                          className={`rounded border-gray-300 text-${fullColor} focus:ring-${themeColor}-600`}
                        />
                      </td>
                      {columnOrder.map((columnKey) => {
                        const config = columnConfig[columnKey];
                        if (!config || !config.isVisible()) return null;
                        return renderColumnCell(booking, columnKey);
                      })}
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium">
                        <div className="flex items-center gap-1 relative">
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
                            <div className="relative">
                              <button
                                onClick={() => setShowCheckInConfirm(
                                  showCheckInConfirm === booking.referenceNumber ? null : booking.referenceNumber
                                )}
                                className="p-1.5 rounded text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                                title="Check In"
                              >
                                <CheckCircle2 className="h-4 w-4" />
                              </button>
                              {showCheckInConfirm === booking.referenceNumber && (
                                <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 p-3 w-52">
                                  <div className="flex items-center gap-2 mb-2">
                                    <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                                    <p className="text-xs text-gray-700 font-medium">Check in this booking?</p>
                                  </div>
                                  <p className="text-xs text-gray-500 mb-3">This marks the party as arrived.</p>
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => setShowCheckInConfirm(null)}
                                      className="flex-1 px-2 py-1 text-xs border border-gray-200 rounded hover:bg-gray-50"
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      onClick={() => {
                                        handleCheckIn(booking.referenceNumber, 'checked-in');
                                        setShowCheckInConfirm(null);
                                      }}
                                      className="flex-1 px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                                    >
                                      Confirm
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                          <button
                            onClick={() => handleOpenInternalNotesModal(booking)}
                            className="p-1 text-amber-600 hover:text-amber-800"
                            title="Internal Notes"
                          >
                            <FileText className="h-4 w-4" />
                          </button>
                          <Link
                            to={`/bookings/${booking.id}?ref=${booking.referenceNumber}&from=bookings`}
                            className="p-1 text-gray-800 hover:text-gray-800"
                            title="View Details"
                          >
                            <Eye className="h-4 w-4" />
                          </Link>
                          <Link
                            to={`/bookings/edit/${booking.id}?ref=${booking.referenceNumber}&from=bookings`}
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

          <div className="bg-white px-6 py-4 border-t border-gray-100">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={paginate}
              totalItems={sortedBookings.length}
              showingFrom={indexOfFirstItem + 1}
              showingTo={Math.min(indexOfLastItem, sortedBookings.length)}
            />
          </div>
        </div>
        )}

        {showTrashed && (
          <>
            {selectedTrashed.length > 0 && (
              <div className="bg-orange-50 p-4 rounded-lg mb-6 flex flex-wrap items-center gap-4">
                <span className="text-orange-700 font-medium">
                  {selectedTrashed.length} deleted booking(s) selected
                </span>
                <StandardButton
                  variant="primary"
                  size="md"
                  onClick={handleBulkRestoreBookings}
                  icon={RotateCcw}
                >
                  Restore Selected
                </StandardButton>
              </div>
            )}

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              {trashedLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className={`animate-spin rounded-full h-8 w-8 border-b-2 border-${fullColor}`}></div>
                  <span className="ml-3 text-gray-600">Loading deleted bookings...</span>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs text-gray-500 uppercase bg-red-50 border-b">
                      <tr>
                        <th scope="col" className="px-4 py-3 font-medium w-12">
                          <input
                            type="checkbox"
                            checked={selectedTrashed.length === trashedBookings.length && trashedBookings.length > 0}
                            onChange={handleSelectAllTrashed}
                            className="rounded border-gray-300 text-red-600 focus:ring-red-600"
                          />
                        </th>
                        <th scope="col" className="px-4 py-3 font-medium">Reference</th>
                        <th scope="col" className="px-4 py-3 font-medium">Customer</th>
                        <th scope="col" className="px-4 py-3 font-medium">Package</th>
                        <th scope="col" className="px-4 py-3 font-medium">Date</th>
                        <th scope="col" className="px-4 py-3 font-medium">Total</th>
                        <th scope="col" className="px-4 py-3 font-medium">Status</th>
                        <th scope="col" className="px-4 py-3 font-medium">Deleted At</th>
                        <th scope="col" className="px-4 py-3 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {trashedBookings.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="px-4 py-8 text-center text-sm text-gray-600">
                            <Archive className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                            No deleted bookings found
                          </td>
                        </tr>
                      ) : (
                        trashedBookings.map((booking: any) => (
                          <tr key={booking.id} className="hover:bg-red-50/50">
                            <td className="px-4 py-3">
                              <input
                                type="checkbox"
                                checked={selectedTrashed.includes(booking.id)}
                                onChange={() => handleSelectTrashedBooking(booking.id)}
                                className="rounded border-gray-300 text-red-600 focus:ring-red-600"
                              />
                            </td>
                            <td className="px-4 py-3 font-medium text-gray-900">
                              {booking.referenceNumber}
                            </td>
                            <td className="px-4 py-3">
                              <div>
                                <div className="font-medium text-gray-900">{booking.customerName}</div>
                                <div className="text-xs text-gray-500">{booking.email}</div>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-gray-900">
                              {booking.packageName}
                            </td>
                            <td className="px-4 py-3 text-gray-900">
                              {booking.date ? parseLocalDate(booking.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'}
                            </td>
                            <td className="px-4 py-3 text-gray-900">
                              ${booking.totalAmount.toFixed(2)}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                                booking.status === 'confirmed' ? 'bg-blue-100 text-blue-800' :
                                booking.status === 'checked-in' ? 'bg-green-100 text-green-800' :
                                booking.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                booking.status === 'cancelled' ? 'bg-gray-100 text-gray-800' :
                                'bg-purple-100 text-purple-800'
                              }`}>
                                {booking.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-red-600 text-xs">
                              {booking.deletedAt ? new Date(booking.deletedAt).toLocaleDateString('en-US', {
                                month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
                              }) : 'N/A'}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => handleRestoreBooking(booking.id)}
                                  className="p-2 text-green-600 hover:text-green-700 hover:bg-green-50 rounded-lg transition-colors"
                                  title="Restore"
                                >
                                  <RotateCcw className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => handleForceDeleteBooking(booking.id, booking.referenceNumber)}
                                  className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                                  title="Permanently Delete"
                                >
                                  <Trash2 className="h-4 w-4" />
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

              <div className="bg-white px-6 py-4 border-t border-gray-100">
                <Pagination
                  currentPage={trashedCurrentPage}
                  totalPages={trashedTotalPages}
                  onPageChange={(page) => loadTrashedBookings(page)}
                  totalItems={trashedTotal}
                  itemsPerPage={itemsPerPage}
                />
              </div>
            </div>
          </>
        )}

        <BulkImportModal
          isOpen={showBulkImportModal}
          onClose={() => setShowBulkImportModal(false)}
          locations={availableLocations}
          onImportComplete={loadBookings}
          isCompanyAdmin={isCompanyAdmin}
          userLocationId={currentUser?.location_id ?? null}
        />

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

                <div className={`bg-${themeColor}-50 border-2 border-${themeColor}-200 rounded-lg p-4`}>
                  <div className="flex items-start gap-3">
                    <Download className={`h-5 w-5 text-${fullColor} flex-shrink-0 mt-0.5`} />
                    <div>
                      <p className={`text-sm font-medium text-${themeColor}-900`}>
                        CSV Export Format
                      </p>
                      <p className={`text-xs text-${themeColor}-800 mt-1`}>
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

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Payment Method
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('in-store')}
                      className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                        paymentMethod === 'in-store'
                          ? `border-${themeColor}-500 bg-${themeColor}-50 text-${themeColor}-700 ring-2 ring-${themeColor}-200`
                          : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <DollarSign className="h-4 w-4" />
                      In-Store
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('authorize.net')}
                      className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                        paymentMethod === 'authorize.net'
                          ? `border-${themeColor}-500 bg-${themeColor}-50 text-${themeColor}-700 ring-2 ring-${themeColor}-200`
                          : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <CreditCard className="h-4 w-4" />
                      Authorize.net
                    </button>
                  </div>
                </div>

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
                {loadingInternalNotes ? (
                  <div className="flex items-center justify-center py-10">
                    <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
                    <span className="ml-2 text-sm text-gray-500">Loading notes...</span>
                  </div>
                ) : (
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
                )}
              </div>

              <div className="p-6 border-t border-gray-100 flex gap-3 justify-end">
                <StandardButton
                  variant="secondary"
                  size="md"
                  onClick={handleCloseInternalNotesModal}
                  disabled={savingInternalNotes || loadingInternalNotes}
                >
                  Cancel
                </StandardButton>
                <StandardButton
                  variant="primary"
                  size="md"
                  onClick={handleSaveInternalNotes}
                  disabled={savingInternalNotes || loadingInternalNotes}
                  loading={savingInternalNotes}
                >
                  {savingInternalNotes ? 'Saving...' : 'Save Notes'}
                </StandardButton>
              </div>
            </div>
          </div>
        )}

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

        {showLocationModal && selectedBookingForEdit && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-backdrop-fade" onClick={handleCloseLocationModal}>
            <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full mx-4 max-h-[85vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <div className={`p-6 border-b border-gray-100 bg-${themeColor}-50`}>
                <h2 className="text-xl font-bold text-gray-900">Change Location</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Booking: {selectedBookingForEdit.referenceNumber}
                </p>
              </div>

              <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto relative">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Destination Location
                  </label>
                  <select
                    value={locationValue}
                    onChange={(e) => {
                      setLocationValue(e.target.value ? Number(e.target.value) : '');
                      setLocationRoomValue('');
                      setLocationConflicts([]);
                    }}
                    className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-transparent`}
                  >
                    <option value="">Select a location</option>
                    {availableLocations.map((loc) => (
                      <option key={loc.id} value={loc.id}>{loc.name}</option>
                    ))}
                  </select>
                  <p className="text-sm text-gray-500 mt-1">
                    Current: {selectedBookingForEdit.location || 'Not set'}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Destination Room/Table {selectedBookingForEdit.roomId ? '(required)' : '(optional)'}
                  </label>
                  <select
                    value={locationRoomValue}
                    onChange={(e) => { setLocationRoomValue(e.target.value ? Number(e.target.value) : ''); setLocationConflicts([]); }}
                    disabled={loadingDestinationRooms || !locationValue}
                    className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-400`}
                  >
                    <option value="">
                      {loadingDestinationRooms
                        ? 'Loading rooms...'
                        : (locationValue && destinationRooms.length === 0
                          ? 'No rooms at this location'
                          : (selectedBookingForEdit.roomId ? 'Select a room' : 'Keep unassigned'))}
                    </option>
                    {destinationRooms
                      .slice()
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .map((room) => (
                        <option key={room.id} value={room.id}>{room.name}</option>
                      ))}
                  </select>
                  {selectedBookingForEdit.roomId ? (
                    <p className="text-xs text-amber-600 mt-1">
                      Rooms are specific to each location, so pick a room at the destination — otherwise this booking would be left unassigned.
                    </p>
                  ) : null}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Existing bookings at destination
                    </label>
                    {selectedBookingForEdit.date && (
                      <span className="text-xs text-gray-500">
                        {parseLocalDate(selectedBookingForEdit.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    )}
                  </div>
                  {!locationValue ? (
                    <p className="text-sm text-gray-400 italic">Select a location to preview.</p>
                  ) : loadingDestinationBookings ? (
                    <div className="flex justify-center items-center py-6">
                      <div className={`animate-spin rounded-full h-6 w-6 border-b-2 border-${fullColor}`}></div>
                    </div>
                  ) : destinationBookings.length === 0 ? (
                    <p className="text-sm text-gray-500">No bookings at this location on this date.</p>
                  ) : (
                    <div className="space-y-1 max-h-40 overflow-y-auto border border-gray-100 rounded-lg p-2">
                      {destinationBookings.map((b) => {
                        const bRoom = (b.room as { name?: string } | undefined)?.name;
                        return (
                          <div key={b.id} className="text-xs text-gray-700 flex items-center justify-between gap-2 border-b border-gray-50 last:border-0 pb-1 last:pb-0">
                            <span className="flex items-center gap-1 flex-shrink-0">
                              <Clock className="w-3 h-3 text-gray-400" />
                              {formatTime12Hour(b.booking_time)}
                            </span>
                            <span className="truncate flex-1 text-center">{b.package?.name || 'Package'}</span>
                            {bRoom && <span className="text-gray-500 flex-shrink-0">{bRoom}</span>}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {locationConflicts.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
                      <p className="text-sm font-semibold text-red-700">Scheduling conflict</p>
                    </div>
                    <ul className="list-disc list-inside space-y-1 mb-2">
                      {locationConflicts.map((conflict, index) => (
                        <li key={index} className="text-xs text-red-600">{conflict.message}</li>
                      ))}
                    </ul>
                    <p className="text-xs text-gray-600">You can change the location anyway to override these conflicts.</p>
                  </div>
                )}

                {savingLocation && (
                  <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center rounded-lg">
                    <div className="text-center">
                      <div className={`animate-spin rounded-full h-10 w-10 border-b-2 border-${fullColor} mx-auto mb-2`}></div>
                      <p className="text-sm font-medium text-gray-700">Updating location...</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-6 border-t border-gray-100 flex gap-3 justify-end">
                <StandardButton
                  variant="secondary"
                  size="md"
                  onClick={handleCloseLocationModal}
                  disabled={savingLocation}
                >
                  Cancel
                </StandardButton>
                {locationConflicts.length > 0 ? (
                  <StandardButton
                    variant="danger"
                    size="md"
                    onClick={() => handleSaveLocation(true)}
                    disabled={savingLocation}
                    loading={savingLocation}
                  >
                    {savingLocation ? 'Saving...' : 'Change anyway'}
                  </StandardButton>
                ) : (
                  <StandardButton
                    variant="primary"
                    size="md"
                    onClick={() => handleSaveLocation(false)}
                    disabled={savingLocation || !locationValue || (Number(locationValue) === selectedBookingForEdit.locationId && locationRoomValue === '') || (!!selectedBookingForEdit.roomId && locationRoomValue === '')}
                    loading={savingLocation}
                  >
                    {savingLocation ? 'Saving...' : 'Save Location'}
                  </StandardButton>
                )}
              </div>
            </div>
          </div>
        )}

        {showLocationRequestModal && selectedBookingForEdit && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-backdrop-fade" onClick={handleCloseLocationRequestModal}>
            <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full mx-4 max-h-[85vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <div className={`p-6 border-b border-gray-100 bg-${themeColor}-50`}>
                <h2 className="text-xl font-bold text-gray-900">Request Location Change</h2>
                <p className="text-sm text-gray-600 mt-1">Booking: {selectedBookingForEdit.referenceNumber}</p>
              </div>

              <div className="p-6 space-y-4">
                <p className="text-sm text-gray-500">
                  The booking stays at <span className="font-medium text-gray-700">{selectedBookingForEdit.location || 'its current location'}</span> until a manager at the destination or an admin approves your request.
                </p>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Destination Location</label>
                  <select
                    value={requestLocationValue}
                    onChange={(e) => { setRequestLocationValue(e.target.value ? Number(e.target.value) : ''); setLocationRequestError(null); }}
                    className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-transparent`}
                  >
                    <option value="">Select a location</option>
                    {allLocations.filter((loc) => loc.id !== selectedBookingForEdit.locationId).map((loc) => (
                      <option key={loc.id} value={loc.id}>{loc.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Reason (optional)</label>
                  <textarea
                    value={requestReasonValue}
                    onChange={(e) => setRequestReasonValue(e.target.value)}
                    rows={3}
                    placeholder="Why should this booking move?"
                    className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-transparent`}
                  />
                </div>
                {locationRequestError && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600">{locationRequestError}</div>
                )}
              </div>

              <div className="p-6 border-t border-gray-100 flex gap-3 justify-end">
                <StandardButton variant="secondary" size="md" onClick={handleCloseLocationRequestModal} disabled={submittingLocationRequest}>
                  Cancel
                </StandardButton>
                <StandardButton
                  variant="primary"
                  size="md"
                  onClick={handleSubmitLocationRequest}
                  disabled={submittingLocationRequest || requestLocationValue === ''}
                  loading={submittingLocationRequest}
                >
                  {submittingLocationRequest ? 'Submitting...' : 'Submit Request'}
                </StandardButton>
              </div>
            </div>
          </div>
        )}

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
