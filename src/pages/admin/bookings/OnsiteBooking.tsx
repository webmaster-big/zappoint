// src/pages/onsite-booking/OnsiteBooking.tsx
import React, { useState, useEffect } from 'react';
import { Calendar, Clock, Users, CreditCard, Gift, Tag, Plus, Minus, DollarSign, X } from 'lucide-react';
import QRCode from 'qrcode';
import { useThemeColor } from '../../../hooks/useThemeColor';
import Toast from '../../../components/ui/Toast';
import EmptyStateModal from '../../../components/ui/EmptyStateModal';
import DatePicker from '../../../components/ui/DatePicker';
import LocationSelector from '../../../components/admin/LocationSelector';
import StandardButton from '../../../components/ui/StandardButton';
import type { 
  OnsiteBookingPackage, 
  OnsiteBookingData 
} from '../../../types/onsiteBooking.types';
import bookingService, { type CreateBookingData } from '../../../services/bookingService';
import { bookingCacheService } from '../../../services/BookingCacheService';
import { packageCacheService } from '../../../services/PackageCacheService';
import timeSlotService, { type TimeSlot } from '../../../services/timeSlotService';
import customerService from '../../../services/CustomerService';
import { locationService } from '../../../services/LocationService';
import { dayOffService, type DayOff } from '../../../services/DayOffService';
import { getImageUrl, getStoredUser, formatTimeTo12Hour } from '../../../utils/storage';

// Interface for day offs with time info for partial closures
interface DayOffWithTime {
  date: Date;
  time_start?: string | null;
  time_end?: string | null;
  reason?: string;
  package_ids?: number[] | null;  // If set, only applies to these packages
  room_ids?: number[] | null;     // If set, only blocks these rooms
}
import { formatDurationDisplay } from '../../../utils/timeFormat';
import { loadAcceptJS, processCardPayment, validateCardNumber, formatCardNumber, getCardType, createPayment, linkPaymentWithRetry } from '../../../services/PaymentService';
import { PAYMENT_TYPE } from '../../../types/Payment.types';
import { getAuthorizeNetPublicKey } from '../../../services/SettingsService';
import { globalNoteService, type GlobalNote } from '../../../services/GlobalNoteService';

// Helper function to parse ISO date string (YYYY-MM-DD) in local timezone
// Avoids UTC offset issues that cause date to show as previous day
const parseLocalDate = (isoDateString: string): Date => {
  const [year, month, day] = isoDateString.split('-').map(Number);
  return new Date(year, month - 1, day);
};

// Extended booking data interface for request
interface ExtendedBookingData extends CreateBookingData {
  additional_attractions?: Array<{
    attraction_id: number;
    quantity: number;
    price_at_booking: number;
  }>;
  additional_addons?: Array<{
    addon_id: number;
    quantity: number;
    price_at_booking: number;
  }>;
  created_by?: number;
  guest_of_honor_name?: string;
  guest_of_honor_age?: number;
  guest_of_honor_gender?: 'male' | 'female' | 'other';
  // Optional address fields
  guest_address?: string;
  guest_city?: string;
  guest_state?: string;
  guest_zip?: string;
  guest_country?: string;
  // Email notification flags
  sent_email_to_staff?: boolean;
}

interface BookingData extends Omit<OnsiteBookingData, 'customer'> {
  customer: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
  };
  paymentMethod: 'card' | 'in-store' | 'paylater' | 'authorize.net';
  paymentType: 'full' | 'partial' | 'custom';
  inStoreAmountPaid: number;
  customPaymentAmount: number;
  giftCardCode: string;
  promoCode: string;
  notes: string;
  guestOfHonorName: string;
  guestOfHonorAge: string;
  guestOfHonorGender: string;
  // Optional address fields
  guestAddress: string;
  guestCity: string;
  guestState: string;
  guestZip: string;
  guestCountry: string;
}

const OnsiteBooking: React.FC = () => {
  const { themeColor, fullColor } = useThemeColor();
  const currentUser = getStoredUser();
  const isCompanyAdmin = currentUser?.role === 'company_admin';
  
  // Helper function to scroll to top of the main content container
  const scrollToTop = () => {
    // Try to find the main content container (parent with overflow-y-auto)
    const mainContent = document.querySelector('main');
    if (mainContent) {
      mainContent.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      // Fallback to window scroll
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };
  
  const [locations, setLocations] = useState<Array<{ id: number; name: string; address?: string; city?: string; state?: string }>>([]);
  const [selectedLocation, setSelectedLocation] = useState<number | null>(null);
  const [packages, setPackages] = useState<OnsiteBookingPackage[]>([]);
  const [selectedPackage, setSelectedPackage] = useState<OnsiteBookingPackage | null>(null);
  const [availableDates, setAvailableDates] = useState<Date[]>([]);
  const [availableTimeSlots, setAvailableTimeSlots] = useState<TimeSlot[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null);
  const [dayOffs, setDayOffs] = useState<Date[]>([]);
  const [dayOffsWithTime, setDayOffsWithTime] = useState<DayOffWithTime[]>([]);
  const [loadingTimeSlots, setLoadingTimeSlots] = useState(false);
  const [loadingPackages, setLoadingPackages] = useState(true);
  const [loadingCustomer, setLoadingCustomer] = useState(false);
  const [globalNotes, setGlobalNotes] = useState<GlobalNote[]>([]);
  const [step, setStep] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Card payment details
  const [useAuthorizeNet, setUseAuthorizeNet] = useState(true);
  const [cardNumber, setCardNumber] = useState('');
  const [cardMonth, setCardMonth] = useState('');
  const [cardYear, setCardYear] = useState('');
  const [cardCVV, setCardCVV] = useState('');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [authorizeApiLoginId, setAuthorizeApiLoginId] = useState('');
  const [_authorizeClientKey, setAuthorizeClientKey] = useState('');
  const [authorizeEnvironment, setAuthorizeEnvironment] = useState<'sandbox' | 'production'>('sandbox');
  const [showNoAuthAccountModal, setShowNoAuthAccountModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [showEmptyModal, setShowEmptyModal] = useState(false);
  const [sendEmail, setSendEmail] = useState(true);
  const [sendEmailToStaff, setSendEmailToStaff] = useState(true);
  const [bookingData, setBookingData] = useState<BookingData>({
    packageId: null,
    selectedAttractions: [],
    selectedAddOns: [],
    date: '',
    time: '',
    participants: 0,
    customer: {
      firstName: '',
      lastName: '',
      email: '',
      phone: ''
    },
    room: '',
    paymentMethod: 'authorize.net',
    paymentType: 'partial',
    customPaymentAmount: 0,
    inStoreAmountPaid: 0,
    giftCardCode: '',
    promoCode: '',
    notes: '',
    total: 0,
    guestOfHonorName: '',
    guestOfHonorAge: '',
    guestOfHonorGender: '',
    guestAddress: '',
    guestCity: '',
    guestState: '',
    guestZip: '',
    guestCountry: ''
  });

  // Check if all required fields are filled for final submission
  const isBookingValid = () => {
    return (
      selectedPackage &&
      bookingData.date &&
      bookingData.time &&
      bookingData.participants > 0 &&
      bookingData.customer.firstName.trim() &&
      bookingData.customer.lastName.trim() &&
      bookingData.customer.email.trim() &&
      bookingData.customer.phone.trim()
    );
  };

  // Format duration for display
  const formatDuration = (pkg: OnsiteBookingPackage | null) => {
    if (!pkg || !pkg.duration) return "Not specified";
    return formatDurationDisplay(pkg.duration, pkg.durationUnit);
  };

  // Helper function to check if a time slot conflicts with a partial day off
  const isTimeSlotRestricted = (slotStartTime: string, slotEndTime: string): boolean => {
    if (!bookingData.date || dayOffsWithTime.length === 0 || !selectedPackage) return false;
    
    // Find partial day off for the selected date that applies to this package
    const selectedDateObj = parseLocalDate(bookingData.date);
    const partialDayOff = dayOffsWithTime.find(dayOff => {
      // Check date match
      if (dayOff.date.getFullYear() !== selectedDateObj.getFullYear() ||
          dayOff.date.getMonth() !== selectedDateObj.getMonth() ||
          dayOff.date.getDate() !== selectedDateObj.getDate()) {
        return false;
      }
      
      // Check if this day off applies to the selected package
      // If package_ids is null/empty, it applies to all packages
      if (dayOff.package_ids && dayOff.package_ids.length > 0) {
        if (!dayOff.package_ids.includes(selectedPackage.id)) {
          return false; // This day off doesn't apply to the selected package
        }
      }
      
      return true;
    });
    
    if (!partialDayOff) return false;
    
    // Convert times to comparable format (minutes since midnight)
    const toMinutes = (timeStr: string): number => {
      const [hours, minutes] = timeStr.split(':').map(Number);
      return hours * 60 + minutes;
    };
    
    const slotStart = toMinutes(slotStartTime);
    const slotEnd = toMinutes(slotEndTime);
    
    // If time_start is set (closes at this time), any slot that starts at or after this time is restricted
    if (partialDayOff.time_start) {
      const closesAt = toMinutes(partialDayOff.time_start);
      if (slotStart >= closesAt) return true;
      // Also restrict if slot ends after closing time
      if (slotEnd > closesAt) return true;
    }
    
    // If time_end is set (opens at this time), any slot that starts before this time is restricted
    if (partialDayOff.time_end) {
      const opensAt = toMinutes(partialDayOff.time_end);
      if (slotStart < opensAt) return true;
    }
    
    return false;
  };

  // Helper function to check if a day off applies to the selected package
  const dayOffAppliesToPackage = (dayOff: { package_ids?: number[] | null }, packageId: number): boolean => {
    // If package_ids is null or empty, it applies to all packages (location-wide)
    if (!dayOff.package_ids || dayOff.package_ids.length === 0) {
      return true;
    }
    // Otherwise, check if the package is in the list
    return dayOff.package_ids.includes(packageId);
  };

  // Compute filtered day offs based on selected package
  // This is needed because the DatePicker doesn't know about the package context
  const filteredDayOffs = React.useMemo(() => {
    if (!selectedPackage) return dayOffs;
    // dayOffs array only contains location-wide full day offs, so no filtering needed
    return dayOffs;
  }, [dayOffs, selectedPackage]);

  const filteredDayOffsWithTime = React.useMemo(() => {
    if (!selectedPackage) return dayOffsWithTime;
    // Filter day offs that apply to the selected package
    return dayOffsWithTime.filter(d => dayOffAppliesToPackage(d, selectedPackage.id));
  }, [dayOffsWithTime, selectedPackage]);

  // Filter available time slots based on partial day offs
  const filteredTimeSlots = availableTimeSlots.filter(slot => 
    !isTimeSlotRestricted(slot.start_time, slot.end_time)
  );

  // Fetch locations for company admin
  useEffect(() => {
    if (isCompanyAdmin) {
      const fetchLocations = async () => {
        try {
          const response = await locationService.getLocations();
          console.log('Locations response:', response);
          if (response.success && response.data) {
            setLocations(Array.isArray(response.data) ? response.data : []);
          } else {
            setLocations([]);
          }
        } catch (error) {
          console.error('Error fetching locations:', error);
          setLocations([]);
        }
      };
      fetchLocations();
    }
  }, [isCompanyAdmin]);

  // Load packages from backend
  useEffect(() => {
    const fetchPackages = async () => {
      try {
        setLoadingPackages(true);
        
        // Try cache first for faster loading
        const cacheFilters = selectedLocation !== null 
          ? { location_id: selectedLocation, status: 'active' as const }
          : { status: 'active' as const };
        
        const cachedPackages = await packageCacheService.getFilteredPackagesFromCache(cacheFilters);
        
        if (cachedPackages && cachedPackages.length > 0) {
          console.log('📦 Using cached packages:', cachedPackages.length);
          
          // Filter only active packages from cache
          const activeCachedPackages = cachedPackages.filter((pkg: any) => pkg.is_active === true || pkg.is_active === 1);
          console.log('Active cached packages:', activeCachedPackages.length, 'of', cachedPackages.length);
          
          // Transform cached packages to match OnsiteBookingPackage interface
          const transformedPackages: OnsiteBookingPackage[] = activeCachedPackages.map((pkg: any) => ({
            id: pkg.id,
            name: pkg.name,
            description: pkg.description,
            price: Number(pkg.price),
            minParticipants: pkg.min_participants,
            maxParticipants: pkg.max_participants,
            category: pkg.category,
            features: pkg.features,
            availabilityType: pkg.availability_type,
            availableDays: pkg.available_days || [],
            availableWeekDays: pkg.available_week_days || [],
            availableMonthDays: pkg.available_month_days || [],
            availability_schedules: pkg.availability_schedules || [],
            attractions: pkg.attractions?.map((a: any) => ({
              id: a.id.toString(),
              name: a.name,
              description: a.description || '',
              price: Number(a.price),
              pricingType: a.pricing_type as 'per_person' | 'per_unit',
              category: a.category || '',
              maxCapacity: a.max_capacity || 0,
              image: Array.isArray(a.image) ? a.image[0] : a.image,
              min_quantity: a.min_quantity,
              max_quantity: a.max_quantity
            })) || [],
            addOns: pkg.add_ons?.map((a: any) => ({
              id: a.id,
              name: a.name,
              price: a.price != null ? Number(a.price) : null,
              image: Array.isArray(a.image) ? a.image[0] : a.image,
              min_quantity: a.min_quantity,
              max_quantity: a.max_quantity,
              is_force_add_on: a.is_force_add_on || false,
              price_each_packages: a.price_each_packages || null
            })) || [],
            addOnsOrder: pkg.add_ons_order || [],
            rooms: pkg.rooms?.map((r: any) => ({
              id: r.id,
              name: r.name,
              capacity: r.capacity
            })) || [],
            image: Array.isArray(pkg.image) ? pkg.image[0] : pkg.image,
            giftCards: pkg.gift_cards?.map((gc: any) => ({
              id: gc.id,
              code: gc.code,
              type: gc.type,
              value: gc.discount_value,
              initial_value: gc.discount_value,
              remaining_usage: gc.remaining_usage || 0,
              max_usage: gc.max_usage || 1,
              status: gc.status,
              expiry_date: gc.expiry_date,
              description: gc.description || ''
            })) || [],
            promos: pkg.promos?.map((p: any) => ({
              id: p.id,
              code: p.code,
              type: p.type,
              value: p.discount_value,
              status: p.status,
              start_date: p.start_date,
              end_date: p.end_date,
              usage_limit_per_user: p.usage_limit_per_user || 1,
              usage_limit_total: p.usage_limit_total || 100,
              description: p.description || ''
            })) || [],
            duration: pkg.duration?.toString() || '2',
            durationUnit: pkg.duration_unit || 'hours',
            pricePerAdditional30min: pkg.price_per_additional_30min?.toString() || '0',
            pricePerAdditional1hr: pkg.price_per_additional_1hr?.toString() || '0',
            pricePerAdditional: Number(pkg.price_per_additional || 0),
            partialPaymentPercentage: pkg.partial_payment_percentage || 0,
            partialPaymentFixed: pkg.partial_payment_fixed || 0,
            has_guest_of_honor: pkg.has_guest_of_honor || false,
            customerNotes: pkg.customer_notes || ''
          }));
          
          setPackages(transformedPackages);
          if (transformedPackages.length === 0) {
            setShowEmptyModal(true);
          }
          // Trigger background sync for freshness
          packageCacheService.syncInBackground({ user_id: getStoredUser()?.id });
          return;
        }
        
        // Fetch all packages from backend
        const params: any = {user_id: getStoredUser()?.id};
        if (selectedLocation !== null) {
          params.location_id = selectedLocation;
        }
        const response = await bookingService.getPackages(params);
        
        if (response.success && response.data && response.data.packages) {
          
          // Transform backend package data to match OnsiteBookingPackage interface
          console.log('Fetched packages:', response.data.packages);
          
          // Filter only active packages
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const activePackages = response.data.packages.filter((pkg: any) => pkg.is_active === true || pkg.is_active === 1);
          console.log('Active packages:', activePackages.length, 'of', response.data.packages.length);
          
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const transformedPackages: OnsiteBookingPackage[] = activePackages.map((pkg: any) => {
            console.log('🔍 Transforming package:', {
              id: pkg.id,
              name: pkg.name,
              min_participants: pkg.min_participants,
              max_participants: pkg.max_participants
            });
            
            return {
              id: pkg.id,
              name: pkg.name,
              description: pkg.description,
              price: Number(pkg.price),
              minParticipants: pkg.min_participants,
              maxParticipants: pkg.max_participants,
              category: pkg.category,
              features: pkg.features,
            availabilityType: pkg.availability_type,
            availableDays: pkg.available_days || [],
            availableWeekDays: pkg.available_week_days || [],
            availableMonthDays: pkg.available_month_days || [],
            availability_schedules: pkg.availability_schedules || [],
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            attractions: pkg.attractions?.map((a: any) => ({
              id: a.id.toString(),
              name: a.name,
              description: a.description || '',
              price: Number(a.price),
              pricingType: a.pricing_type as 'per_person' | 'per_unit',
              category: a.category || '',
              maxCapacity: a.max_capacity || 0,
              image: Array.isArray(a.image) ? a.image[0] : a.image,
              min_quantity: a.min_quantity,
              max_quantity: a.max_quantity
            })) || [],
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            addOns: pkg.add_ons?.map((a: any) => ({
              id: a.id,
              name: a.name,
              price: a.price != null ? Number(a.price) : null,
              image: Array.isArray(a.image) ? a.image[0] : a.image,
              min_quantity: a.min_quantity,
              max_quantity: a.max_quantity,
              is_force_add_on: a.is_force_add_on || false,
              price_each_packages: a.price_each_packages || null
            })) || [],
            addOnsOrder: pkg.add_ons_order || [],
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            rooms: pkg.rooms?.map((r: any) => ({
              id: r.id,
              name: r.name,
              capacity: r.capacity
            })) || [],
            image: Array.isArray(pkg.image) ? pkg.image[0] : pkg.image,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            giftCards: pkg.gift_cards?.map((gc: any) => ({
              id: gc.id,
              code: gc.code,
              type: gc.type,
              value: gc.discount_value,
              initial_value: gc.discount_value,
              remaining_usage: gc.remaining_usage || 0,
              max_usage: gc.max_usage || 1,
              status: gc.status,
              expiry_date: gc.expiry_date,
              description: gc.description || ''
            })) || [],
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            promos: pkg.promos?.map((p: any) => ({
              id: p.id,
              code: p.code,
              type: p.type,
              value: p.discount_value,
              status: p.status,
              start_date: p.start_date,
              end_date: p.end_date,
              usage_limit_per_user: p.usage_limit_per_user || 1,
              usage_limit_total: p.usage_limit_total || 100,
              description: p.description || ''
            })) || [],
            duration: pkg.duration?.toString() || '2',
            durationUnit: pkg.duration_unit || 'hours',
            pricePerAdditional30min: pkg.price_per_additional_30min?.toString() || '0',
            pricePerAdditional1hr: pkg.price_per_additional_1hr?.toString() || '0',
            pricePerAdditional: Number(pkg.price_per_additional || 0),
            partialPaymentPercentage: pkg.partial_payment_percentage || 0,
            partialPaymentFixed: pkg.partial_payment_fixed || 0,
            has_guest_of_honor: pkg.has_guest_of_honor || false,
            customerNotes: pkg.customer_notes || ''
            };
          });
          
          console.log('✅ All transformed packages:', transformedPackages);
          setPackages(transformedPackages);
          
          // Cache only active packages for future use
          if (activePackages.length > 0) {
            await packageCacheService.cachePackages(activePackages);
          }
          
          // Show modal if no packages available
          if (transformedPackages.length === 0) {
            setShowEmptyModal(true);
          }
        }
      } catch (error) {
        console.error('❌ Error fetching packages:', error);
        // Set empty array on error
        setPackages([]);
        setShowEmptyModal(true);
      } finally {
        setLoadingPackages(false);
      }
    };

    fetchPackages();
  }, [selectedLocation]);
  
  // Load Authorize.Net settings
  useEffect(() => {
    const loadAuthorizeNetSettings = async () => {
      try {
        const user = JSON.parse(localStorage.getItem('zapzone_user') || '{}');
        const locationId = user.location_id || 1;
        const settings = await getAuthorizeNetPublicKey(locationId);
        if (settings && settings.api_login_id) {
          setAuthorizeApiLoginId(settings.api_login_id);
          setAuthorizeClientKey(settings.client_key || settings.api_login_id);
          const env = (settings.environment || 'sandbox') as 'sandbox' | 'production';
          setAuthorizeEnvironment(env);
          
          // Load Accept.js with the correct environment from API response
          await loadAcceptJS(env);
          console.log('✅ Accept.js loaded successfully for environment:', env);
        } else {
          setShowNoAuthAccountModal(true);
        }
      } catch (error: any) {
        console.error('Failed to load Authorize.Net settings:', error);
        if (error.response?.data?.message?.includes('No active Authorize.Net account')) {
          setShowNoAuthAccountModal(true);
        }
      }
    };
    
    loadAuthorizeNetSettings();
  }, []);

  // Helper function to get week of month (1-5, where 5 is last week)
  const getWeekOfMonth = (date: Date): number => {
    const firstDayOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
    const dayOfMonth = date.getDate();
    const firstDayWeekday = firstDayOfMonth.getDay();
    
    // Calculate which week this day falls into
    return Math.ceil((dayOfMonth + firstDayWeekday) / 7);
  };

  // Helper function to check if date is in last week of month
  const isLastWeekOfMonth = (date: Date): boolean => {
    const lastDayOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    const daysUntilEndOfMonth = lastDayOfMonth.getDate() - date.getDate();
    return daysUntilEndOfMonth < 7;
  };

  // Calculate available dates based on package availability
  useEffect(() => {
    if (!selectedPackage) {
      console.log('⚠️ No selected package, skipping date calculation');
      return;
    }
    
    console.log('📅 Calculating available dates for package:', selectedPackage.name);
    console.log('📅 Availability schedules:', selectedPackage.availability_schedules);
    
    const today = new Date();
    const dates: Date[] = [];
    
    // Determine booking window: package-specific > location-specific > unlimited
    // If both are null/undefined, allow unlimited date selection (730 days = 2 years)
    const packageWindow = selectedPackage.booking_window_days;
    const locationWindow = selectedPackage.location?.booking_window_days;
    const bookingWindowDays = packageWindow ?? locationWindow ?? null;
    // If null, allow unlimited (730 days); otherwise use the configured value
    const maxDays = bookingWindowDays === null ? 730 : Math.max(1, bookingWindowDays);
    
    // Generate available dates for the booking window
    for (let i = 0; i < maxDays; i++) {
      const date = new Date();
      date.setDate(today.getDate() + i);
      
      // Check if date matches any availability schedule
      let isAvailable = false;
      
      if (selectedPackage.availability_schedules && selectedPackage.availability_schedules.length > 0) {
        for (const schedule of selectedPackage.availability_schedules) {
          if (!schedule.is_active) continue;
          
          if (schedule.availability_type === "daily") {
            isAvailable = true;
            break;
          } 
          else if (schedule.availability_type === "weekly") {
            const dayName = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][date.getDay()];
            if (i < 7) {
              console.log(`📅 Checking ${date.toDateString()} (${dayName}) against schedule:`, schedule.day_configuration);
            }
            if (schedule.day_configuration && schedule.day_configuration.includes(dayName)) {
              isAvailable = true;
              break;
            }
          } 
          else if (schedule.availability_type === "monthly") {
            // For monthly, day_configuration contains patterns like "sunday-first", "monday-last", etc.
            const dayName = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][date.getDay()];
            const weekOfMonth = getWeekOfMonth(date);
            const isInLastWeek = isLastWeekOfMonth(date);
            
            if (schedule.day_configuration) {
              for (const pattern of schedule.day_configuration) {
                const [day, week] = pattern.split('-');
                
                if (day === dayName) {
                  if (week === 'last' && isInLastWeek) {
                    isAvailable = true;
                    break;
                  } else if (week === 'first' && weekOfMonth === 1) {
                    isAvailable = true;
                    break;
                  } else if (week === 'second' && weekOfMonth === 2) {
                    isAvailable = true;
                    break;
                  } else if (week === 'third' && weekOfMonth === 3) {
                    isAvailable = true;
                    break;
                  } else if (week === 'fourth' && weekOfMonth === 4) {
                    isAvailable = true;
                    break;
                  }
                }
              }
            }
          }
          
          if (isAvailable) break;
        }
      }
      
      if (isAvailable) {
        dates.push(date);
      }
    }
    
    console.log(`📅 Total available dates found: ${dates.length}`);
    if (dates.length > 0) {
      console.log('📅 First 5 available dates:', dates.slice(0, 5).map(d => d.toDateString()));
    }
    
    setAvailableDates(dates);
    
    if (dates.length === 0) {
      console.warn('⚠️ No available dates found for this package!');
    }
  }, [selectedPackage, bookingData.date]);

  // Fetch day offs for the selected location
  useEffect(() => {
    const fetchDayOffs = async () => {
      // For onsite booking, use the selected location
      const locationId = selectedLocation || (isCompanyAdmin ? null : currentUser?.location_id);
      if (!locationId) return;
      
      try {
        const response = await dayOffService.getDayOffsByLocation(locationId);
        if (response.success && response.data) {
          // Convert day off dates to Date objects
          // Also handle recurring day offs (same month/day each year)
          // Store all day offs with their package_ids for filtering
          const allDayOffs: DayOffWithTime[] = [];
          const today = new Date();
          
          response.data.forEach((dayOff: DayOff) => {
            const offDate = new Date(dayOff.date);
            const hasTimeRestriction = dayOff.time_start || dayOff.time_end;
            
            // Common day off data
            const dayOffData = {
              time_start: hasTimeRestriction ? dayOff.time_start : null,
              time_end: hasTimeRestriction ? dayOff.time_end : null,
              reason: dayOff.reason,
              package_ids: dayOff.package_ids || null,
              room_ids: dayOff.room_ids || null
            };
            
            if (dayOff.is_recurring) {
              // For recurring, add for current year and next year
              const currentYearDate = new Date(today.getFullYear(), offDate.getMonth(), offDate.getDate());
              const nextYearDate = new Date(today.getFullYear() + 1, offDate.getMonth(), offDate.getDate());
              
              if (currentYearDate >= today) {
                allDayOffs.push({ ...dayOffData, date: currentYearDate });
              }
              allDayOffs.push({ ...dayOffData, date: nextYearDate });
            } else {
              // Non-recurring, just add the date if it's not in the past
              if (offDate >= today) {
                allDayOffs.push({ ...dayOffData, date: offDate });
              }
            }
          });
          
          // Separate full day offs (for calendar blocking) and partial day offs (for time slot filtering)
          // Full day offs are those without time restrictions AND apply to all packages (location-wide)
          const fullDayOffDates = allDayOffs
            .filter(d => !d.time_start && !d.time_end && !d.package_ids && !d.room_ids)
            .map(d => d.date);
          
          // Partial or resource-specific day offs need full info for filtering
          const partialOrSpecificDayOffs = allDayOffs.filter(d => 
            d.time_start || d.time_end || d.package_ids || d.room_ids
          );
          
          setDayOffs(fullDayOffDates);
          setDayOffsWithTime(partialOrSpecificDayOffs);
          console.log('📅 Day offs loaded:', fullDayOffDates.length, 'full location-wide days,', partialOrSpecificDayOffs.length, 'partial/resource-specific days');
        }
      } catch (error) {
        console.error('Error fetching day offs:', error);
      }
    };
    
    fetchDayOffs();
  }, [selectedLocation, isCompanyAdmin, currentUser?.location_id]);

  // Fetch available time slots via SSE when date changes (backend auto-finds available rooms)
  useEffect(() => {
    if (!selectedPackage || !bookingData.date) {
      setAvailableTimeSlots([]);
      return;
    }
    
    console.log('🕐 Fetching time slots for:', {
      package_id: selectedPackage.id,
      package_name: selectedPackage.name,
      date: bookingData.date,
    });
    
    setLoadingTimeSlots(true);
    
    // Create SSE connection - backend will automatically find available rooms for each slot
    const eventSource = timeSlotService.getAvailableSlotsSSE({
      package_id: selectedPackage.id,
      date: bookingData.date,
    });
    
    // Track if first update has been received
    let isFirstUpdate = true;
    
    // Handle incoming messages
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        console.log('✅ Received time slots:', {
          available_count: data.available_slots?.length || 0,
          booked_count: data.booked_slots?.length || 0,
          available_slots: data.available_slots,
          booked_slots: data.booked_slots,
        });
        
        setAvailableTimeSlots(data.available_slots);
        setLoadingTimeSlots(false);
        
        // Mark first update as complete (no auto-selection)
        if (isFirstUpdate) {
          isFirstUpdate = false;
        }
      } catch (err) {
        console.error('❌ Error parsing SSE data:', err);
        console.error('Raw event data:', event.data);
      }
    };
    
    // Handle errors
    eventSource.onerror = (err) => {
      console.error('❌ SSE connection error:', err);
      console.error('EventSource readyState:', eventSource.readyState);
      console.error('Failed to fetch time slots for:', {
        package_id: selectedPackage?.id,
        date: bookingData.date,
      });
      setLoadingTimeSlots(false);
      eventSource.close();
    };
    
    // Log when connection opens
    eventSource.onopen = () => {
      console.log('✅ SSE connection established');
    };
    
    // Cleanup: close SSE connection when component unmounts or dependencies change
    return () => {
      console.log('🔌 Closing SSE connection');
      eventSource.close();
    };
  }, [bookingData.date, selectedPackage]);

  // Helper function to get the correct add-on price based on package
  const getAddOnPrice = (addOn: { 
    price: number | null; 
    is_force_add_on?: boolean; 
    price_each_packages?: Array<{ package_id: number; price: number; minimum_quantity: number }> | null 
  }, packageId: number): number => {
    // Check for package-specific pricing
    if (addOn.price_each_packages && addOn.price_each_packages.length > 0) {
      const packagePrice = addOn.price_each_packages.find(p => p.package_id === packageId);
      if (packagePrice) {
        return packagePrice.price;
      }
    }
    // Fall back to default price
    return addOn.price || 0;
  };

  // Helper function to get the minimum quantity for an add-on based on package
  const getAddOnMinQuantity = (addOn: { 
    min_quantity?: number; 
    is_force_add_on?: boolean; 
    price_each_packages?: Array<{ package_id: number; price: number; minimum_quantity: number }> | null 
  }, packageId: number): number => {
    // Check for package-specific minimum quantity
    if (addOn.price_each_packages && addOn.price_each_packages.length > 0) {
      const packagePrice = addOn.price_each_packages.find(p => p.package_id === packageId);
      if (packagePrice) {
        return packagePrice.minimum_quantity;
      }
    }
    // Fall back to default min_quantity
    return addOn.min_quantity || 1;
  };

  const handlePackageSelect = async (pkg: OnsiteBookingPackage) => {
    console.log('📦 Package selected:', {
      id: pkg.id,
      name: pkg.name,
      minParticipants: pkg.minParticipants,
      maxParticipants: pkg.maxParticipants
    });
    
    setSelectedPackage(pkg);
    
    // Fetch global notes for this package
    try {
      const notesResponse = await globalNoteService.getNotesForPackage(pkg.id);
      setGlobalNotes(notesResponse.data || []);
    } catch {
      console.error('Failed to load global notes');
      setGlobalNotes([]);
    }
    
    const initialParticipants = pkg.minParticipants || 1;
    console.log('👥 Setting initial participants to:', initialParticipants);
    
    // Find force add-ons that apply to this package and auto-add them
    const forceAddOns = pkg.addOns
      .filter(addOn => {
        if (!addOn.is_force_add_on) return false;
        // Check if this add-on has package-specific pricing for this package
        if (addOn.price_each_packages && addOn.price_each_packages.length > 0) {
          return addOn.price_each_packages.some(p => p.package_id === pkg.id);
        }
        return false;
      })
      .map(addOn => {
        const minQty = getAddOnMinQuantity(addOn, pkg.id);
        console.log('🔗 Auto-adding force add-on:', { name: addOn.name, id: addOn.id, minQty });
        return {
          id: addOn.id,
          name: addOn.name,
          quantity: minQty,
          isForced: true // Mark as forced so UI can indicate it
        };
      });
    
    setBookingData(prev => ({ 
      ...prev, 
      packageId: pkg.id,
      selectedAttractions: [],
      selectedAddOns: forceAddOns,
      participants: initialParticipants,
      date: '', // Reset date when package changes
      time: '', // Reset time when package changes
      room: '' // Reset room when package changes
    }));
    setSelectedRoomId(null); // Reset selected room ID
    setStep(2); // Move directly to step 2 (Date & Time) after selecting a package
    scrollToTop();
  };

  const handleAttractionToggle = (attractionId: string) => {
    setBookingData(prev => {
      const existingIndex = prev.selectedAttractions.findIndex(a => a.id === attractionId);
      
      if (existingIndex >= 0) {
        // Remove attraction
        return {
          ...prev,
          selectedAttractions: prev.selectedAttractions.filter(a => a.id !== attractionId)
        };
      } else {
        // Find attraction to get min_quantity
        const attraction = selectedPackage?.attractions.find(a => String(a.id) === attractionId);
        const minQty = attraction?.min_quantity ?? 1;
        
        // Add attraction with min_quantity as initial quantity
        return {
          ...prev,
          selectedAttractions: [...prev.selectedAttractions, { id: attractionId, quantity: minQty }]
        };
      }
    });
  };

  const handleAttractionQuantityChange = (attractionId: string, quantity: number) => {
    const attraction = selectedPackage?.attractions.find(a => String(a.id) === attractionId);
    const minQty = attraction?.min_quantity ?? 1;
    const maxQty = attraction?.max_quantity ?? 99;
    
    // Enforce min and max limits
    if (quantity < minQty) quantity = minQty;
    if (quantity > maxQty) quantity = maxQty;
    
    setBookingData(prev => ({
      ...prev,
      selectedAttractions: prev.selectedAttractions.map(a => 
        a.id === attractionId ? { ...a, quantity } : a
      )
    }));
  };

  const handleAddOnToggle = (addOnName: string) => {
    setBookingData(prev => {
      const existingAddOn = prev.selectedAddOns.find(a => a.name === addOnName);
      
      if (existingAddOn) {
        // Check if it's a forced add-on - prevent removal
        if (existingAddOn.isForced) {
          console.log('⚠️ Cannot remove force add-on:', addOnName);
          return prev; // Don't allow removal of forced add-ons
        }
        // Remove add-on
        return {
          ...prev,
          selectedAddOns: prev.selectedAddOns.filter(a => a.name !== addOnName)
        };
      } else {
        // Find the add-on to get its ID and min_quantity
        const addOn = selectedPackage?.addOns.find(a => a.name === addOnName);
        const minQty = selectedPackage ? getAddOnMinQuantity(addOn!, selectedPackage.id) : (addOn?.min_quantity ?? 1);
        
        console.log('🔍 Adding add-on:', { 
          addOnName, 
          foundAddOn: addOn, 
          addOnId: addOn?.id,
          minQty,
          allAddOns: selectedPackage?.addOns 
        });
        
        // Add add-on with ID, name, and min_quantity as initial quantity
        return {
          ...prev,
          selectedAddOns: [...prev.selectedAddOns, { 
            id: addOn?.id, 
            name: addOnName, 
            quantity: minQty,
            isForced: false
          }]
        };
      }
    });
  };

  const handleAddOnQuantityChange = (addOnName: string, quantity: number) => {
    const addOn = selectedPackage?.addOns.find(a => a.name === addOnName);
    const minQty = selectedPackage ? getAddOnMinQuantity(addOn!, selectedPackage.id) : (addOn?.min_quantity ?? 1);
    const maxQty = addOn?.max_quantity ?? 99;
    
    // Enforce min and max limits
    if (quantity < minQty) quantity = minQty;
    if (quantity > maxQty) quantity = maxQty;
    
    setBookingData(prev => ({
      ...prev,
      selectedAddOns: prev.selectedAddOns.map(a => 
        a.name === addOnName ? { ...a, quantity } : a
      )
    }));
  };

  const handleInputChange = async (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    
    if (name.startsWith('customer.')) {
      const field = name.split('.')[1];
      setBookingData(prev => ({
        ...prev,
        customer: {
          ...prev.customer,
          [field]: value
        }
      }));
      
      // Auto-fill customer data when email is entered
      if (field === 'email' && value.includes('@')) {
        await searchCustomerByEmail(value);
      }
    } else if (name === 'time') {
      // When time is selected, also capture the room_id from the time slot
      const selectedSlot = availableTimeSlots.find(slot => slot.start_time === value);
      if (selectedSlot && selectedSlot.room_id) {
        setSelectedRoomId(selectedSlot.room_id);
        console.log('🏠 Room auto-assigned from time slot:', {
          time: value,
          room_id: selectedSlot.room_id,
          room_name: selectedSlot.room_name,
          available_rooms_count: selectedSlot.available_rooms_count
        });
      }
      setBookingData(prev => ({
        ...prev,
        [name]: value
      }));
    } else if (name === 'participants') {
      // Handle participants as a number and enforce min/max constraints
      const numValue = parseInt(value) || 0;
      const maxParticipants = selectedPackage?.maxParticipants || 999;
      const validValue = Math.max(1, Math.min(maxParticipants, numValue));
      
      console.log('👥 Participant input change:', {
        rawValue: value,
        parsedValue: numValue,
        validValue: validValue,
        maxParticipants: maxParticipants,
        minParticipants: selectedPackage?.minParticipants
      });
      
      setBookingData(prev => ({
        ...prev,
        participants: validValue
      }));
    } else {
      setBookingData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };
  
  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCardNumber(e.target.value);
    setCardNumber(formatted);
    setPaymentError('');
  };
  
  const searchCustomerByEmail = async (email: string) => {
    try {
      setLoadingCustomer(true);
      const response = await customerService.searchCustomers(email);
      
      if (response.success && response.data && response.data.length > 0) {
        const customer = response.data[0];
        console.log('✅ Customer found:', customer);
        
        // Auto-fill customer information
        setBookingData(prev => ({
          ...prev,
          customer: {
            firstName: customer.first_name || prev.customer.firstName,
            lastName: customer.last_name || prev.customer.lastName,
            email: customer.email,
            phone: customer.phone || prev.customer.phone
          }
        }));
      }
    } catch {
      console.log('ℹ️ No existing customer found for this email');
    } finally {
      setLoadingCustomer(false);
    }
  };

  const calculatePartialAmount = () => {
    if (!selectedPackage) return 0;
    
    const total = calculateTotal();
    
    // Check if package has partial payment percentage (priority)
    if (selectedPackage.partialPaymentPercentage != null && selectedPackage.partialPaymentPercentage > 0) {
      return Math.round(total * (selectedPackage.partialPaymentPercentage / 100) * 100) / 100;
    }
    
    // Check if package has partial payment fixed amount
    if (selectedPackage.partialPaymentFixed != null && selectedPackage.partialPaymentFixed > 0) {
      return Math.min(selectedPackage.partialPaymentFixed, total);
    }
    
    // If both are null or 0, return 0 (no partial payment available)
    return 0;
  };

  const calculateTotal = () => {
    let total = 0;
    
    // Package price
    if (selectedPackage) {
      const basePrice = selectedPackage.price;
      const minParticipants = selectedPackage.minParticipants || 1;
      const pricePerAdditional = selectedPackage.pricePerAdditional || 0;
      
      // Base price covers min participants, charge extra for participants beyond min
      if (bookingData.participants <= minParticipants) {
        total += basePrice;
      } else {
        const additional = bookingData.participants - minParticipants;
        total += basePrice + (additional * pricePerAdditional);
      }
    }
    
    // Attractions
    bookingData.selectedAttractions.forEach(({ id, quantity }) => {
      const attraction = selectedPackage?.attractions?.find(a => a.id === Number(id));
      if (attraction) {
        if (attraction.pricingType === 'per_person') {
          total += attraction.price * quantity * bookingData.participants;
        } else {
          total += attraction.price * quantity;
        }
      }
    });
    
    // Add-ons
    bookingData.selectedAddOns.forEach(({ name, quantity }) => {
      const addOn = selectedPackage?.addOns.find(a => a.name === name);
      if (addOn && selectedPackage) {
        // Use package-specific price if available
        const addOnPrice = getAddOnPrice(addOn, selectedPackage.id);
        total += addOnPrice * quantity;
      }
    });
    
    // Apply gift card discount if valid
    if (bookingData.giftCardCode && selectedPackage) {
      const giftCard = selectedPackage.giftCards.find(gc => gc.code === bookingData.giftCardCode && gc.status === 'active');
      if (giftCard) {
        if (giftCard.type === 'percentage') {
          total -= total * (giftCard.value / 100);
        } else {
          total -= giftCard.value;
        }
      }
    }
    
    // Apply promo discount if valid
    if (bookingData.promoCode && selectedPackage) {
      const promo = selectedPackage.promos.find(p => p.code === bookingData.promoCode && p.status === 'active');
      if (promo) {
        if (promo.type === 'percentage') {
          total -= total * (promo.value / 100);
        } else {
          total -= promo.value;
        }
      }
    }
    
    return Math.max(0, total);
  };

  const resetForm = () => {
    setSelectedPackage(null);
    setBookingData({
      packageId: null,
      selectedAttractions: [],
      selectedAddOns: [],
      date: '',
      time: '',
      participants: 0,
      customer: {
        firstName: '',
        lastName: '',
        email: '',
        phone: ''
      },
      room: '',
      paymentMethod: 'authorize.net',
      paymentType: 'partial',
      customPaymentAmount: 0,
      inStoreAmountPaid: 0,
      giftCardCode: '',
      promoCode: '',
      notes: '',
      total: 0,
      guestOfHonorName: '',
      guestOfHonorAge: '',
      guestOfHonorGender: '',
      guestAddress: '',
      guestCity: '',
      guestState: '',
      guestZip: '',
      guestCountry: ''
    });
    setCardNumber('');
    setCardMonth('');
    setCardYear('');
    setCardCVV('');
    setUseAuthorizeNet(true);
    setPaymentError('');
    setSelectedRoomId(null);
    setStep(1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedPackage) {
      setToast({ message: 'Please select a package', type: 'error' });
      return;
    }
    
    // Validate custom payment amount if selected
    if (bookingData.paymentType === 'custom' && bookingData.paymentMethod !== 'paylater') {
      if (!bookingData.customPaymentAmount || bookingData.customPaymentAmount <= 0) {
        setToast({ message: 'Please enter a valid custom payment amount', type: 'error' });
        return;
      }
    }
    
    // Validate card details if using Authorize.Net
    if (bookingData.paymentMethod === 'authorize.net' || (bookingData.paymentMethod === 'card' && useAuthorizeNet)) {
      if (!validateCardNumber(cardNumber)) {
        setPaymentError('Please enter a valid card number');
        return;
      }
      if (!cardMonth || !cardYear || !cardCVV) {
        setPaymentError('Please fill in all card details');
        return;
      }
    }
    
    try {
      setSubmitting(true);
      // Calculate duration in hours or days (convert days to hours if needed)
      const durationValue = selectedPackage.duration ? Number(selectedPackage.duration) : 2;
      const durationUnit = selectedPackage.durationUnit || 'hours';
      // Convert days to hours for the API (API only accepts minutes or hours)
      let finalDuration = durationValue;
      let finalDurationUnit: 'minutes' | 'hours' | 'hours and minutes' = 'hours';
      
      if (durationUnit.toLowerCase() === 'days') {
        finalDuration = durationValue * 24;
        finalDurationUnit = 'hours';
      } else if (durationUnit.toLowerCase() === 'minutes') {
        finalDuration = durationValue;
        finalDurationUnit = 'minutes';
      } else if (durationUnit === 'hours and minutes') {
        // Keep as decimal hours for 'hours and minutes' unit
        finalDuration = durationValue;
        finalDurationUnit = 'hours and minutes';
      } else {
        finalDuration = durationValue;
        finalDurationUnit = 'hours';
      }
      
      // Look up promo and gift card IDs from codes
      let promoId: number | undefined;
      let giftCardId: number | undefined;
      
      if (bookingData.promoCode && selectedPackage.promos) {
        const promo = selectedPackage.promos.find(p => p.code === bookingData.promoCode);
        promoId = promo?.id;
      }
      
      if (bookingData.giftCardCode && selectedPackage.giftCards) {
        const giftCard = selectedPackage.giftCards.find(gc => gc.code === bookingData.giftCardCode);
        giftCardId = giftCard?.id;
      }
      
      // Prepare attractions data with quantity and price_at_booking
      console.log('📦 Building additional attractions/addons...', {
        selectedAttractions: bookingData.selectedAttractions,
        selectedAddOns: bookingData.selectedAddOns,
        pkgAttractions: selectedPackage?.attractions,
        pkgAddOns: selectedPackage?.addOns
      });
      
      const additionalAttractions = bookingData.selectedAttractions
        .filter(({ quantity }) => quantity > 0)
        .map(({ id, quantity }) => {
          // attraction.id is stored as string (from toString()), so compare as strings
          const attraction = selectedPackage?.attractions?.find(a => String(a.id) === String(id));
          const numId = typeof id === 'number' ? id : parseInt(id, 10);
          
          if (isNaN(numId) || !attraction) {
            console.warn(`⚠️ Invalid attraction ID or not found: ${id}, available:`, selectedPackage?.attractions?.map(a => a.id));
            return null;
          }
          
          // price_at_booking is unit price, backend calculates total with quantity
          const unitPrice = Number(attraction.price);
          console.log(`✅ Attraction found: ${attraction.name}, price: ${unitPrice}`);
          
          return {
            attraction_id: numId,
            quantity: quantity,
            price_at_booking: unitPrice
          };
        })
        .filter((item): item is { attraction_id: number; quantity: number; price_at_booking: number } => item !== null);
      
      // Prepare add-ons data with quantity and price_at_booking
      const additionalAddons = bookingData.selectedAddOns
        .filter(({ quantity }) => quantity > 0)
        .map(({ id, name, quantity }) => {
          // Try to find by id first, then by name as fallback
          const addOn = selectedPackage.addOns.find(a => a.id === id) || 
                       selectedPackage.addOns.find(a => a.name === name);
          const addonId = id || addOn?.id;
          
          if (!addonId || !addOn) {
            console.warn(`⚠️ Add-on not found or missing ID: ${name}, id: ${id}`);
            return null;
          }
          
          // Use package-specific pricing if available
          const unitPrice = getAddOnPrice(addOn, selectedPackage.id);
          console.log(`✅ Add-on found: ${name}, price: ${unitPrice}, id: ${addonId}`);
          
          return {
            addon_id: addonId,
            quantity: quantity,
            price_at_booking: unitPrice
          };
        })
        .filter((item): item is { addon_id: number; quantity: number; price_at_booking: number } => item !== null);
      
      // Calculate amount paid based on payment type and method
      const totalAmount = calculateTotal();
      const partialAmount = calculatePartialAmount();
      let amountPaid = totalAmount;
      
      if (bookingData.paymentMethod === 'paylater') {
        amountPaid = 0;
      } else if (bookingData.paymentMethod === 'in-store') {
        // If in-store amount was explicitly entered, use that
        // Otherwise fall back to payment type selection
        if (bookingData.inStoreAmountPaid > 0) {
          amountPaid = bookingData.inStoreAmountPaid;
        } else if (bookingData.paymentType === 'custom' && bookingData.customPaymentAmount > 0) {
          amountPaid = Math.min(bookingData.customPaymentAmount, totalAmount);
        } else if (bookingData.paymentType === 'partial' && partialAmount > 0) {
          amountPaid = partialAmount;
        } else if (bookingData.paymentType === 'full') {
          amountPaid = totalAmount;
        } else {
          amountPaid = 0; // No amount specified
        }
      } else if (bookingData.paymentType === 'custom' && bookingData.customPaymentAmount > 0) {
        amountPaid = Math.min(bookingData.customPaymentAmount, totalAmount);
      } else if (bookingData.paymentType === 'partial' && partialAmount > 0) {
        amountPaid = partialAmount;
      }
      
      // Get created_by from localStorage
      const currentUser = getStoredUser();
      const createdBy = currentUser?.id;
      
      // Create booking data matching Laravel BookingController validation
      // room_id comes from the selected time slot (backend pre-assigns available room per slot)
      const bookingData_request: ExtendedBookingData = {
        guest_name: `${bookingData.customer.firstName} ${bookingData.customer.lastName}`,
        guest_email: bookingData.customer.email,
        guest_phone: bookingData.customer.phone,
        location_id: 1,
        package_id: selectedPackage.id,
        room_id: selectedRoomId || undefined,
        type: 'package' as const,
        booking_date: bookingData.date,
        booking_time: bookingData.time,
        participants: bookingData.participants,
        duration: finalDuration,
        duration_unit: finalDurationUnit,
        total_amount: totalAmount,
        amount_paid: amountPaid,
        payment_method: (bookingData.paymentMethod === 'in-store' ? 'in-store' : bookingData.paymentMethod) as 'card' | 'in-store' | 'paylater',
        payment_status: bookingData.paymentMethod === 'paylater' ? 'pending' as const : 
          (bookingData.paymentMethod === 'in-store' && amountPaid < totalAmount) ? (amountPaid > 0 ? 'partial' as const : 'pending' as const) :
          ((bookingData.paymentType === 'partial' && partialAmount > 0) || 
           (bookingData.paymentType === 'custom' && bookingData.customPaymentAmount > 0 && bookingData.customPaymentAmount < totalAmount)) 
            ? 'partial' as const : 'paid' as const,
        status: bookingData.paymentMethod === 'paylater' || 
          (bookingData.paymentMethod === 'in-store' && amountPaid < totalAmount) ||
          ((bookingData.paymentType === 'partial' && partialAmount > 0) ||
           (bookingData.paymentType === 'custom' && bookingData.customPaymentAmount > 0 && bookingData.customPaymentAmount < totalAmount)) 
            ? 'pending' as const : 'confirmed' as const,
        promo_id: promoId,
        gift_card_id: giftCardId,
        notes: bookingData.notes || undefined,
        additional_attractions: additionalAttractions.length > 0 ? additionalAttractions : undefined,
        additional_addons: additionalAddons.length > 0 ? additionalAddons : undefined,
        created_by: createdBy,
        guest_of_honor_name: selectedPackage.has_guest_of_honor && bookingData.guestOfHonorName ? bookingData.guestOfHonorName : undefined,
        guest_of_honor_age: selectedPackage.has_guest_of_honor && bookingData.guestOfHonorAge ? parseInt(bookingData.guestOfHonorAge) : undefined,
        guest_of_honor_gender: selectedPackage.has_guest_of_honor && bookingData.guestOfHonorGender ? bookingData.guestOfHonorGender as 'male' | 'female' | 'other' : undefined,
        // Optional address fields
        guest_address: bookingData.guestAddress || undefined,
        guest_city: bookingData.guestCity || undefined,
        guest_state: bookingData.guestState || undefined,
        guest_zip: bookingData.guestZip || undefined,
        guest_country: bookingData.guestCountry || undefined,
        // Email notification flags
        sent_email_to_staff: sendEmailToStaff,
      };
      
      console.log('📤 Sending on-site booking request:', bookingData_request);
      console.log('🎟️ Additional attractions:', additionalAttractions);
      console.log('➕ Additional add-ons:', additionalAddons);
      console.log('\n🔍 === BOOKING REQUEST VALIDATION ===');
      console.log('✅ room_id:', bookingData_request.room_id ? `${bookingData_request.room_id} (from selected time slot)` : '❌ MISSING - This will cause booking to fail!');
      console.log('✅ booking_time:', bookingData_request.booking_time || '❌ MISSING');
      console.log('✅ booking_date:', bookingData_request.booking_date || '❌ MISSING');
      console.log('📍 Selected time slot details:', availableTimeSlots.find(slot => slot.start_time === bookingData.time));
      console.log('================================\n');
      
      // Determine if using card payment via Authorize.Net
      const isCardPayment = bookingData.paymentMethod === 'authorize.net' || (bookingData.paymentMethod === 'card' && useAuthorizeNet);
      
      let bookingId: number;
      let referenceNumber: string;
      let customerId: number | undefined;

      // ===== CHARGE-THEN-LINK FLOW FOR CARD PAYMENTS =====
      if (isCardPayment && amountPaid > 0) {
        // Step 1: Charge customer FIRST (no booking yet, no payable_id)
        try {
          setIsProcessingPayment(true);
          setPaymentError('');
          
          // Ensure Accept.js library is loaded
          if (!window.Accept) {
            await loadAcceptJS(authorizeEnvironment);
          }
          
          // Customer billing data for Authorize.Net
          const customerData = {
            first_name: bookingData.customer.firstName || '',
            last_name: bookingData.customer.lastName || '',
            email: bookingData.customer.email || '',
            phone: bookingData.customer.phone || '',
          };
          
          const paymentResult = await processCardPayment(
            {
              cardNumber: cardNumber.replace(/\s/g, ''),
              month: cardMonth,
              year: cardYear,
              cardCode: cardCVV
            },
            {
              location_id: bookingData_request.location_id,
              amount: amountPaid,
              customer_id: bookingData_request.customer_id || undefined,
            },
            authorizeApiLoginId,
            undefined, // clientKey
            customerData // Pass customer billing data
          );
          
          if (!paymentResult.success) {
            // Payment failed - no booking was created, so nothing to clean up
            setPaymentError(paymentResult.message || 'Payment processing failed. Please try again.');
            setIsProcessingPayment(false);
            return;
          }
          
          const paymentId = paymentResult.payment?.id;
          const chargeTransactionId = paymentResult.transaction_id;
          console.log('✅ Payment charged successfully, payment ID:', paymentId, 'txn:', chargeTransactionId);
          
          // Step 2: Create booking (customer already charged)
          const response = await bookingService.createBooking(bookingData_request);
          
          if (!response.success || !response.data) {
            // Booking creation failed AFTER charge - this is a critical situation
            // Payment was collected but booking couldn't be created
            console.error('❌ Booking creation failed after successful charge. Payment ID:', paymentId);
            setPaymentError(
              'Your payment was processed successfully, but we encountered an issue creating your booking. ' +
              'Please contact our staff with your payment confirmation. Your payment is safe and will be resolved.'
            );
            setIsProcessingPayment(false);
            return;
          }
          
          bookingId = response.data.id;
          referenceNumber = response.data.reference_number;
          customerId = response.data.customer_id;
          
          console.log('✅ Booking created:', { bookingId, referenceNumber });
          
          // Add the new booking to cache
          await bookingCacheService.addBookingToCache(response.data);
          
          // Step 3: Link payment to booking (with retry for reliability)
          if (paymentId) {
            try {
              await linkPaymentWithRetry(paymentId, bookingId, PAYMENT_TYPE.BOOKING, 3, chargeTransactionId);
              console.log('✅ Payment linked to booking successfully');
            } catch (linkErr) {
              // Non-critical: payment and booking both exist, just not linked yet
              // Staff can see unlinked payments and manually resolve
              console.error('⚠️ Failed to link payment to booking:', linkErr);
            }
          }
          
          console.log('✅ Payment processed successfully:', paymentResult.transaction_id);
        } catch (paymentErr: any) {
          console.error('❌ Payment processing error:', paymentErr);
          
          // Check for HTTPS requirement error
          if (paymentErr?.message?.includes('HTTPS') || paymentErr?.message?.includes('https')) {
            setPaymentError('Authorize.Net requires HTTPS connection. Please use the manual card entry option or access via HTTPS.');
          } else {
            setPaymentError(paymentErr?.message || 'Failed to process payment. Please try again.');
          }
          
          setIsProcessingPayment(false);
          return;
        }
      } else {
        // Non-card payment path: Create booking first, then record payment
        const response = await bookingService.createBooking(bookingData_request);
        
        if (!response.success || !response.data) {
          throw new Error('Failed to create booking');
        }
        
        bookingId = response.data.id;
        referenceNumber = response.data.reference_number;
        customerId = response.data.customer_id;
        
        console.log('✅ Booking created:', { bookingId, referenceNumber });
        
        // Add the new booking to cache
        await bookingCacheService.addBookingToCache(response.data);

        if (amountPaid > 0) {
          // For non-card payments (in-store, pay later), create payment record
          try {
            const paymentData = {
              payable_id: bookingId,
              payable_type: PAYMENT_TYPE.BOOKING,
              customer_id: customerId || null,
              amount: amountPaid,
              currency: 'USD',
              method: (bookingData.paymentMethod === 'in-store' ? 'cash' : bookingData.paymentMethod) as 'card' | 'cash',
              status: 'completed' as const,
              location_id: bookingData_request.location_id,
              notes: bookingData.paymentMethod === 'in-store' 
                ? `In-store payment for booking ${referenceNumber}` 
                : `Payment for booking ${referenceNumber}`,
            };
            
            await createPayment(paymentData);
            console.log('✅ Payment record created for booking:', bookingId);
          } catch (paymentError) {
            console.error('⚠️ Failed to create payment record:', paymentError);
            // Don't fail - booking was created successfully
          }
        }
      }
      
      // Step 3: Generate QR code with the actual reference number
      const qrCodeBase64 = await QRCode.toDataURL(referenceNumber, {
        width: 300,
        margin: 2,
        color: { dark: '#000000', light: '#FFFFFF' }
      });
      
      console.log('📱 QR Code generated for reference:', referenceNumber);
      
      // Step 4: Store QR code with email preference
      try {
        await bookingService.storeQrCode(bookingId, qrCodeBase64, sendEmail);
        console.log('✅ QR code stored with email preference:', sendEmail);
      } catch (qrError) {
        console.error('⚠️ Failed to store QR code, but booking was created:', qrError);
        // Don't fail the entire process if QR storage fails
      }
      
      // Show success toast
      setToast({ 
        message: `Booking created successfully! Reference: ${referenceNumber}`, 
        type: 'success' 
      });
      
      // Reset form for new booking
      resetForm();
    } catch (err) {
      console.error('❌ Error creating booking:', err);
      setToast({ message: 'Failed to create booking. Please try again.', type: 'error' });
    } finally {
      setSubmitting(false);
      setIsProcessingPayment(false);
    }
  };

  // Live Summary Component - visible on all steps
  const renderLiveSummary = () => {
    const total = calculateTotal();
    const partialAmount = calculatePartialAmount();
    
    // Calculate the 4.87% fee that's already included in prices (for display purposes)
    const FEE_RATE = 0.0487;
    const priceBeforeFee = total / (1 + FEE_RATE);
    const includedFee = total - priceBeforeFee;
    
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 sticky top-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"></path>
            <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd"></path>
          </svg>
          Booking Summary
        </h3>
        
        <div className="space-y-4">
          {/* Package Info */}
          {selectedPackage ? (
            <div className="pb-4 border-b border-gray-200">
              <div className="flex gap-3 items-start">
                {selectedPackage.image && (
                  <img 
                    src={getImageUrl(selectedPackage.image)} 
                    alt={selectedPackage.name} 
                    className="w-16 h-16 object-cover rounded-lg border border-gray-200 flex-shrink-0" 
                  />
                )}
                <div className="flex-1 min-w-0">
                  <h4 className={`font-semibold text-sm text-${fullColor} truncate`}>{selectedPackage.name}</h4>
                  <p className="text-xs text-gray-500 mt-0.5">{selectedPackage.category}</p>
                  <p className={`text-lg font-bold text-gray-900 mt-1`}>${selectedPackage.price}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-sm text-gray-500 text-center py-4">
              No package selected yet
            </div>
          )}
          
          {/* Booking Details */}
          {(bookingData.date || bookingData.time || bookingData.participants > 0) && (
            <div className="pb-4 border-b border-gray-200">
              <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Details</h4>
              <div className="space-y-2 text-sm">
                {bookingData.date && (
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-900">
                      {parseLocalDate(bookingData.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  </div>
                )}
                {bookingData.time && (
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-900">{formatTimeTo12Hour(bookingData.time)}</span>
                  </div>
                )}
                {/* Space will be auto-assigned by backend */}
                {bookingData.participants > 0 && (
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-900">{bookingData.participants} {bookingData.participants === 1 ? 'Participant' : 'Participants'}</span>
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* Attractions */}
          {bookingData.selectedAttractions.length > 0 && (
            <div className="pb-4 border-b border-gray-200">
              <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Attractions</h4>
              <div className="space-y-2">
                {bookingData.selectedAttractions.map(({ id, quantity }) => {
                  const attraction = selectedPackage?.attractions?.find(a => String(a.id) === String(id));
                  if (!attraction) return null;
                  const price = attraction.price * quantity * (attraction.pricingType === 'per_person' ? bookingData.participants : 1);
                  return (
                    <div key={id} className="flex gap-2 items-start">
                      {attraction.image && (
                        <img 
                          src={getImageUrl(attraction.image)} 
                          alt={attraction.name}
                          className="w-12 h-12 rounded object-cover flex-shrink-0"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-900 font-medium truncate">{attraction.name}</p>
                        <p className="text-xs text-gray-500">Qty: {quantity} × ${attraction.price.toFixed(2)}</p>
                      </div>
                      <span className="font-medium text-sm text-gray-900 ml-2">${price.toFixed(2)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          
          {/* Add-ons */}
          {bookingData.selectedAddOns.length > 0 && (
            <div className="pb-4 border-b border-gray-200">
              <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Add-ons</h4>
              <div className="space-y-2">
                {bookingData.selectedAddOns.map(({ name, quantity }) => {
                  const addOn = selectedPackage?.addOns.find(a => a.name === name);
                  if (!addOn || !selectedPackage) return null;
                  const addOnPrice = getAddOnPrice(addOn, selectedPackage.id);
                  const price = addOnPrice * quantity;
                  return (
                    <div key={name} className="flex gap-2 items-start">
                      {addOn.image && (
                        <img 
                          src={getImageUrl(addOn.image)} 
                          alt={name}
                          className="w-12 h-12 rounded object-cover flex-shrink-0"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-900 font-medium truncate">{name}</p>
                        <p className="text-xs text-gray-500">Qty: {quantity} × ${addOnPrice.toFixed(2)}</p>
                      </div>
                      <span className="font-medium text-sm text-gray-900 ml-2">${price.toFixed(2)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          
          {/* Customer Info */}
          {(bookingData.customer.firstName || bookingData.customer.email) && (
            <div className="pb-4 border-b border-gray-200">
              <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Customer</h4>
              <div className="space-y-1 text-sm">
                {(bookingData.customer.firstName || bookingData.customer.lastName) && (
                  <p className="text-gray-900">
                    {bookingData.customer.firstName} {bookingData.customer.lastName}
                  </p>
                )}
                {bookingData.customer.email && (
                  <p className="text-gray-600 text-xs truncate">{bookingData.customer.email}</p>
                )}
                {bookingData.customer.phone && (
                  <p className="text-gray-600 text-xs">{bookingData.customer.phone}</p>
                )}
              </div>
            </div>
          )}
          
          {/* Pricing Breakdown */}
          {selectedPackage && (
            <div className="pt-2">
              <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-3">Price Breakdown</h4>
              <div className="space-y-2 text-sm">
                {/* Base Package Price */}
                <div className="bg-gray-50 rounded-lg p-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="font-medium text-gray-800">Base Package</span>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {selectedPackage.name}
                      </p>
                      <p className="text-xs text-gray-400">
                        Covers up to {selectedPackage.minParticipants || 1} participant{(selectedPackage.minParticipants || 1) > 1 ? 's' : ''}
                      </p>
                    </div>
                    <span className="font-semibold text-gray-900">${selectedPackage.price.toFixed(2)}</span>
                  </div>
                </div>
                
                {/* Additional Participants */}
                {bookingData.participants > (selectedPackage.minParticipants || 1) && selectedPackage.pricePerAdditional && selectedPackage.pricePerAdditional > 0 && (
                  <div className="flex justify-between items-start py-1">
                    <div>
                      <span className="text-gray-700">Additional Participants</span>
                      <p className="text-xs text-gray-500">
                        {bookingData.participants - (selectedPackage.minParticipants || 1)} extra × ${selectedPackage.pricePerAdditional.toFixed(2)}/person
                      </p>
                    </div>
                    <span className="font-medium text-gray-900">
                      +${((bookingData.participants - (selectedPackage.minParticipants || 1)) * selectedPackage.pricePerAdditional).toFixed(2)}
                    </span>
                  </div>
                )}
                
                {/* Participant Count Summary */}
                <div className="flex justify-between items-center text-xs py-1 border-t border-gray-200">
                  <span className="text-gray-500">Total Participants</span>
                  <span className="font-medium text-gray-700">{bookingData.participants} people</span>
                </div>
                
                {/* Attractions with full breakdown */}
                {bookingData.selectedAttractions.length > 0 && (
                  <div className="border-t border-gray-200 pt-2">
                    <p className="text-xs font-semibold text-gray-600 uppercase mb-1">Attractions</p>
                    {bookingData.selectedAttractions.map(({ id, quantity }) => {
                      const attraction = selectedPackage?.attractions?.find(a => String(a.id) === String(id));
                      if (!attraction) return null;
                      const isPerPerson = attraction.pricingType === 'per_person';
                      const lineTotal = attraction.price * quantity * (isPerPerson ? bookingData.participants : 1);
                      return (
                        <div key={id} className="flex justify-between text-xs mb-1">
                          <div>
                            <span className="text-gray-700">{attraction.name}</span>
                            <span className="text-gray-400 block">
                              {quantity}× ${attraction.price.toFixed(2)}{isPerPerson ? ` × ${bookingData.participants} people` : '/unit'}
                            </span>
                          </div>
                          <span className="font-medium text-gray-800">+${lineTotal.toFixed(2)}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
                
                {/* Add-ons with full breakdown */}
                {bookingData.selectedAddOns.length > 0 && (
                  <div className="border-t border-gray-200 pt-2">
                    <p className="text-xs font-semibold text-gray-600 uppercase mb-1">Add-ons</p>
                    {bookingData.selectedAddOns.map(({ name, quantity }) => {
                      const addOn = selectedPackage?.addOns.find(a => a.name === name);
                      if (!addOn || !selectedPackage) return null;
                      const addOnPrice = getAddOnPrice(addOn, selectedPackage.id);
                      return (
                        <div key={name} className="flex justify-between text-xs mb-1">
                          <div>
                            <span className="text-gray-700">{name}</span>
                            <span className="text-gray-400 block">{quantity}× ${addOnPrice.toFixed(2)}</span>
                          </div>
                          <span className="font-medium text-gray-800">+${(addOnPrice * quantity).toFixed(2)}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              
              {/* Subtotal */}
              <div className="flex justify-between items-center pt-3 mt-2 border-t border-gray-200 text-sm">
                <span className="text-gray-600">Subtotal (before fee)</span>
                <span className="font-medium text-gray-800">${priceBeforeFee.toFixed(2)}</span>
              </div>
              
              {/* Processing Fee */}
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-600">Processing Fee (4.87%)</span>
                <span className="font-medium text-gray-800">${includedFee.toFixed(2)}</span>
              </div>
              
              {/* Total */}
              <div className="flex justify-between items-center pt-2 mt-1 border-t-2 border-gray-300">
                <span className="font-bold text-gray-900">Total</span>
                <span className="text-xl font-bold text-blue-700">${total.toFixed(2)}</span>
              </div>
              
              {bookingData.paymentType === 'partial' && partialAmount > 0 && (
                <div className="flex justify-between items-center pt-2 mt-2 bg-blue-50 rounded-lg p-2">
                  <span className="text-sm font-semibold text-blue-700">Due Now</span>
                  <span className="text-lg font-bold text-blue-800">${partialAmount.toFixed(2)}</span>
                </div>
              )}
              
              {bookingData.paymentType === 'custom' && bookingData.customPaymentAmount > 0 && (
                <div className="flex justify-between items-center pt-2 mt-2 bg-green-50 rounded-lg p-2">
                  <span className="text-sm font-semibold text-green-700">Custom Amount Due Now</span>
                  <span className="text-lg font-bold text-green-800">${Math.min(bookingData.customPaymentAmount, total).toFixed(2)}</span>
                </div>
              )}
              
              {/* Package Notes */}
              {selectedPackage?.customerNotes && (
                <p className="mt-3 text-xs text-gray-500 whitespace-pre-wrap">{selectedPackage.customerNotes}</p>
              )}
              
              {/* Global Notes */}
              {globalNotes.length > 0 && (
                <div className="mt-2 space-y-1">
                  {globalNotes.map((note) => (
                    <p key={note.id} className="text-xs text-gray-500 whitespace-pre-wrap">
                      {note.title ? `${note.title}: ` : ''}{note.content}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderStep1 = () => {
    // Filter packages based on search query
    const filteredPackages = packages.filter(pkg => 
      pkg.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pkg.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pkg.category.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Select a Package</h2>
          
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            {/* Search Bar */}
            <div className="mb-4">
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search packages by name, category, or description..."
                  className={`w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-${themeColor}-400 focus:border-${themeColor}-500 transition-colors`}
                />
                {searchQuery && (
                  <StandardButton
                    variant="ghost"
                    size="sm"
                    icon={X}
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                  >
                    {''}
                  </StandardButton>
                )}
              </div>
              {searchQuery && (
                <p className="text-sm text-gray-600 mt-2">
                  Found {filteredPackages.length} {filteredPackages.length === 1 ? 'package' : 'packages'}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4">
              {filteredPackages.map(pkg => (
              <div
                key={pkg.id}
                className={`border-2 rounded-lg p-5 cursor-pointer transition-all ${
                  selectedPackage?.id === pkg.id
                    ? `border-${themeColor}-500 bg-${themeColor}-50 shadow-sm`
                    : `border-gray-200 hover:border-${themeColor}-300 hover:bg-gray-50`
                }`}
                onClick={() => handlePackageSelect(pkg)}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-bold text-gray-900">{pkg.name}</h3>
                      {selectedPackage?.id === pkg.id && (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-${themeColor}-100 text-${fullColor}`}>
                          <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"></path>
                          </svg>
                          Selected
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mb-3">{pkg.description}</p>
                    <div className="flex flex-wrap gap-2">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-${the}-50 text-${the}-700 border border-${the}-200">
                        <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                        </svg>
                        {pkg.category}
                      </span>
                      <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200">
                        <Clock className="w-3.5 h-3.5 mr-1" />
                        {formatDuration(pkg)}
                      </span>
                      <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-green-50 text-green-700 border border-green-200">
                        <Users className="w-3.5 h-3.5 mr-1" />
                        Up to {pkg.maxParticipants}
                      </span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="flex items-baseline gap-1 justify-end">
                      <span className="text-sm text-gray-500">$</span>
                      <span className={`text-3xl font-bold text-${fullColor}`}>{pkg.price}</span>
                    </div>
                    <span className="text-xs text-gray-500 mt-1 block">per booking</span>
                  </div>
                </div>
              </div>
            ))}
            
            {loadingPackages && (
              <div className="text-center text-gray-500 py-12">
                <div className={`animate-spin rounded-full h-12 w-12 border-b-2 border-${fullColor} mx-auto mb-4`}></div>
                <p>Loading packages...</p>
              </div>
            )}
            
            {!loadingPackages && filteredPackages.length === 0 && searchQuery && (
              <div className="text-center text-gray-500 py-12">
                <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-lg mb-2">No packages found</p>
                <p className="text-sm">Try adjusting your search terms</p>
              </div>
            )}
            

          </div>
        </div>
        </div>
        
        {/* Right Column - Live Summary */}
        <div className="lg:col-span-1">
          {renderLiveSummary()}
        </div>
      </div>
    );
  };

  // STEP 2: Date & Time (swapped with add-ons)
  const renderStep2 = () => (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Select Space, Date & Time</h2>
      
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-6">
        {/* Room will be automatically assigned by backend based on availability */}


        {/* Date and Time Grid */}
        <div className="grid grid-cols-1 gap-6">
          {/* Date Selection with Calendar */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-3 flex items-center">
              <Calendar className="w-4 h-4 mr-2" />
              Select Date
            </label>
            <DatePicker
              selectedDate={bookingData.date}
              availableDates={availableDates}
              onChange={(date) => setBookingData(prev => ({ ...prev, date }))}
              dayOffs={filteredDayOffs}
              dayOffsWithTime={filteredDayOffsWithTime}
            />
          </div>

          {/* Participants */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-3 flex items-center">
              <Users className="w-4 h-4 mr-2" />
              Number of Participants
            </label>
            <div className="flex items-center gap-3">
              <StandardButton
                type="button"
                variant="secondary"
                size="md"
                onClick={() => setBookingData(prev => ({ 
                  ...prev, 
                  participants: Math.max(1, prev.participants - 1) 
                }))}
              >
                -
              </StandardButton>
              <input
                type="number"
                name="participants"
                min="1"
                max={selectedPackage?.maxParticipants}
                value={bookingData.participants}
                onChange={handleInputChange}
                onWheel={(e) => e.currentTarget.blur()}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                    e.preventDefault();
                  }
                }}
                className={`w-20 text-center border-2 border-gray-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-${themeColor}-400 focus:border-${themeColor}-500 transition-colors font-semibold text-lg`}
                required
              />
              <StandardButton
                type="button"
                variant="secondary"
                size="md"
                onClick={() => setBookingData(prev => ({ 
                  ...prev, 
                  participants: Math.min(selectedPackage?.maxParticipants || 999, prev.participants + 1) 
                }))}
              >
                +
              </StandardButton>
              <span className="text-sm text-gray-600">
                {selectedPackage?.minParticipants && `${selectedPackage.minParticipants} included`}
                {selectedPackage?.minParticipants && selectedPackage?.maxParticipants && ' • '}
                {selectedPackage?.maxParticipants && `Max: ${selectedPackage.maxParticipants}`}
              </span>
            </div>
            {selectedPackage && selectedPackage.minParticipants && bookingData.participants > (selectedPackage.minParticipants || 1) && selectedPackage.pricePerAdditional && selectedPackage.pricePerAdditional > 0 && (
              <div className={`mt-3 text-xs bg-amber-50 border border-amber-200 text-amber-800 rounded-lg p-3`}>
                <strong>Note:</strong> Additional participants beyond {selectedPackage.minParticipants} included will be charged <strong>${selectedPackage.pricePerAdditional}</strong> each. (Max capacity: {selectedPackage.maxParticipants})
              </div>
            )}
          </div>
        </div>

        {/* Time Selection */}
        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-3 flex items-center">
            <Clock className="w-4 h-4 mr-2" />
            Select Time Slot
          </label>
          {loadingTimeSlots ? (
            <div className="flex items-center justify-center p-8 bg-gray-50 rounded-lg">
              <div className={`animate-spin rounded-full h-8 w-8 border-b-2 border-${fullColor}`}></div>
              <span className="ml-3 text-sm text-gray-600">Loading available time slots...</span>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {filteredTimeSlots.length > 0 ? (
                filteredTimeSlots.map((slot) => (
                  <label 
                    key={slot.start_time} 
                    className={`flex flex-col p-3 rounded-lg border-2 cursor-pointer transition-all ${
                      bookingData.time === slot.start_time 
                        ? `border-${themeColor}-500 bg-${themeColor}-50 shadow-sm` 
                        : `border-gray-200 hover:border-${themeColor}-300 hover:bg-gray-50`
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <input
                        type="radio"
                        name="time"
                        value={slot.start_time}
                        checked={bookingData.time === slot.start_time}
                        onChange={handleInputChange}
                        className={`accent-${fullColor} w-4 h-4`}
                      />
                      <span className="font-semibold text-sm text-gray-900">{formatTimeTo12Hour(slot.start_time)}</span>
                    </div>
                    <span className="text-xs text-gray-500 ml-6">to {formatTimeTo12Hour(slot.end_time)}</span>
                  </label>
                ))
              ) : (
                <div className="col-span-full text-sm text-gray-500 bg-gray-50 rounded-lg p-4 text-center">
                  No available time slots for the selected date. Space will be auto-assigned.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Duration Display */}
        {selectedPackage && (
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-600 flex items-center">
                <Clock className="w-4 h-4 mr-2" />
                Session Duration
              </span>
              <span className="text-sm font-semibold text-gray-900">{formatDuration(selectedPackage)}</span>
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-3 pt-4">
        <StandardButton
          type="button"
          variant="secondary"
          onClick={() => setStep(1)}
          className="flex-1"
        >
          Back to Packages
        </StandardButton>
        <StandardButton
          type="button"
          variant="primary"
          onClick={() => { setStep(3); scrollToTop(); }}
          className="flex-2"
        >
          Continue to Attractions & Add-ons
        </StandardButton>
      </div>
      </div>
      
      {/* Right Column - Live Summary */}
      <div className="lg:col-span-1">
        {renderLiveSummary()}
      </div>
    </div>
  );

  // STEP 3: Attractions & Add-ons (swapped with date & time)
  const renderStep3 = () => (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Add Attractions & Add-ons</h2>
      
      {/* Attractions */}
      {selectedPackage?.attractions && selectedPackage.attractions.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Additional Attractions</h3>
          <p className="text-sm text-gray-600 mb-4">Enhance your experience with individual attraction tickets</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {selectedPackage.attractions.map(attraction => {
            const isSelected = bookingData.selectedAttractions.some(a => a.id === String(attraction.id));
            const selectedQty = bookingData.selectedAttractions.find(a => a.id === String(attraction.id))?.quantity || 0;
            
            return (
              <div
                key={attraction.id}
                className={`border-2 rounded-lg p-4 transition-all ${
                  isSelected 
                    ? `border-${themeColor}-500 bg-${themeColor}-50 shadow-sm` 
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                {attraction.image && (
                  <div className="mb-3 -mx-4 -mt-4">
                    <img 
                      src={getImageUrl(attraction.image)} 
                      alt={attraction.name} 
                      className="w-full h-32 object-cover rounded-t-lg" 
                    />
                  </div>
                )}
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900">{attraction.name}</h4>
                    <p className="text-xs text-gray-600 mt-1 line-clamp-2">{attraction.description}</p>
                    <div className="flex items-baseline gap-2 mt-2">
                      <span className={`text-lg font-bold text-${fullColor}`}>${attraction.price}</span>
                      <span className="text-xs text-gray-500">{attraction.pricingType === 'per_person' ? 'per person' : 'per unit'}</span>
                    </div>
                  </div>
                  <StandardButton
                    type="button"
                    variant={isSelected ? 'danger' : 'primary'}
                    size="sm"
                    onClick={() => handleAttractionToggle(String(attraction.id))}
                  >
                    {isSelected ? 'Remove' : 'Add'}
                  </StandardButton>
                </div>
                
                {isSelected && (
                  <div className={`mt-3 pt-3 border-t border-${themeColor}-200 flex items-center justify-between`}>
                    <span className="text-sm font-medium text-gray-700">Quantity:</span>
                    <div className="flex items-center gap-2">
                      <StandardButton
                        type="button"
                        variant="secondary"
                        size="sm"
                        icon={Minus}
                        onClick={() => handleAttractionQuantityChange(String(attraction.id), selectedQty - 1)}
                      >
                        {''}
                      </StandardButton>
                      <input
                        type="number"
                        min="1"
                        value={selectedQty}
                        onChange={(e) => {
                          const newQty = parseInt(e.target.value) || 1;
                          handleAttractionQuantityChange(String(attraction.id), newQty);
                        }}
                        onWheel={(e) => e.currentTarget.blur()}
                        className="w-16 text-center font-bold text-lg text-gray-900 border border-gray-300 rounded px-2 py-1"
                      />
                      <StandardButton
                        type="button"
                        variant="secondary"
                        size="sm"
                        icon={Plus}
                        onClick={() => handleAttractionQuantityChange(String(attraction.id), selectedQty + 1)}
                      >
                        {''}
                      </StandardButton>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          </div>
        </div>
      )}
      
      {/* Add-ons */}
      {selectedPackage?.addOns && selectedPackage.addOns.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Package Add-ons</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[...selectedPackage.addOns].sort((a, b) => {
              // Sort by addOnsOrder if available, otherwise keep original order
              if (!selectedPackage.addOnsOrder || selectedPackage.addOnsOrder.length === 0) return 0;
              const indexA = selectedPackage.addOnsOrder.indexOf(a.name);
              const indexB = selectedPackage.addOnsOrder.indexOf(b.name);
              // Items not in order array go to the end
              if (indexA === -1 && indexB === -1) return 0;
              if (indexA === -1) return 1;
              if (indexB === -1) return -1;
              return indexA - indexB;
            }).map(addOn => {
              const selectedAddOn = bookingData.selectedAddOns.find(a => a.name === addOn.name);
              const isSelected = !!selectedAddOn;
              const isForced = selectedAddOn?.isForced || false;
              const selectedQty = selectedAddOn?.quantity || 0;
              // Get the correct price for this package
              const displayPrice = getAddOnPrice(addOn, selectedPackage.id);
              const minQty = getAddOnMinQuantity(addOn, selectedPackage.id);
              
              return (
                <div
                  key={addOn.name}
                  className={`border-2 rounded-lg p-4 flex gap-4 transition-all ${
                    isSelected 
                      ? isForced 
                        ? `border-amber-500 bg-amber-50 shadow-sm`
                        : `border-${themeColor}-500 bg-${themeColor}-50 shadow-sm` 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {/* Add-on Image */}
                  <div className="w-20 h-20 flex-shrink-0 flex items-center justify-center bg-gray-100 rounded-lg border-2 border-gray-200 overflow-hidden">
                    {addOn.image ? (
                      <img src={getImageUrl(addOn.image)} alt={addOn.name} className="object-cover w-full h-full" />
                    ) : (
                      <span className="text-gray-400 text-xs">No Image</span>
                    )}
                  </div>
                  <div className="flex-1 flex flex-col justify-between">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-gray-900">{addOn.name}</h4>
                          {isForced && (
                            <span className="text-xs px-2 py-0.5 bg-amber-200 text-amber-800 rounded-full font-medium">
                              Required
                            </span>
                          )}
                        </div>
                        <p className={`text-lg font-bold text-${fullColor} mt-1`}>${displayPrice.toFixed(2)}</p>
                        {isForced && (
                          <p className="text-xs text-amber-700 mt-1">Min. {minQty} required for this package</p>
                        )}
                      </div>
                      {isForced ? (
                        <span className="text-xs text-amber-700 font-medium px-2 py-1 bg-amber-100 rounded">
                          Included
                        </span>
                      ) : (
                        <StandardButton
                          type="button"
                          variant={isSelected ? 'danger' : 'primary'}
                          size="sm"
                          onClick={() => handleAddOnToggle(addOn.name)}
                        >
                          {isSelected ? 'Remove' : 'Add'}
                        </StandardButton>
                      )}
                    </div>
                    {isSelected && (
                      <div className={`mt-3 pt-3 border-t ${isForced ? 'border-amber-200' : `border-${themeColor}-200`} flex items-center justify-between`}>
                        <span className="text-sm font-medium text-gray-700">Quantity:</span>
                        <div className="flex items-center gap-2">
                          <StandardButton
                            type="button"
                            variant="secondary"
                            size="sm"
                            icon={Minus}
                            onClick={() => handleAddOnQuantityChange(addOn.name, selectedQty - 1)}
                            disabled={isForced && selectedQty <= minQty}
                          >
                            {''}
                          </StandardButton>
                          <input
                            type="number"
                            min={minQty}
                            value={selectedQty}
                            onChange={(e) => {
                              const newQty = parseInt(e.target.value) || minQty;
                              handleAddOnQuantityChange(addOn.name, newQty);
                            }}
                            onWheel={(e) => e.currentTarget.blur()}
                            className="w-16 text-center font-bold text-lg text-gray-900 border border-gray-300 rounded px-2 py-1"
                          />
                          <StandardButton
                            type="button"
                            variant="secondary"
                            size="sm"
                            icon={Plus}
                            onClick={() => handleAddOnQuantityChange(addOn.name, selectedQty + 1)}
                          >
                            {''}
                          </StandardButton>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      
      <div className="flex gap-3 pt-4">
        <StandardButton
          type="button"
          variant="secondary"
          onClick={() => setStep(2)}
          className="flex-1"
        >
          Back to Date & Time
        </StandardButton>
        <StandardButton
          type="button"
          variant="primary"
          onClick={() => { setStep(4); scrollToTop(); }}
          className="flex-2"
        >
          Continue to Customer Details
        </StandardButton>
      </div>
      </div>
      
      {/* Right Column - Live Summary */}
      <div className="lg:col-span-1">
        {renderLiveSummary()}
      </div>
    </div>
  );

  const renderStep4 = () => (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Customer Information</h2>
      
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-6">
        {/* Customer Details */}
        <div>
          <h3 className="font-semibold text-gray-900 mb-4">Contact Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email Address *
                {loadingCustomer && (
                  <span className="ml-2 text-xs text-${the}-600 animate-pulse">(Searching...)</span>
                )}
              </label>
              <input
                type="email"
                name="customer.email"
                value={bookingData.customer.email}
                onChange={handleInputChange}
                className={`w-full border-2 border-gray-200 rounded-lg px-4 py-3 focus:ring-2 focus:ring-${themeColor}-400 focus:border-${themeColor}-500 transition-colors`}
                placeholder="john.doe@example.com"
                required
              />
              <p className="text-xs text-gray-500 mt-1">We'll auto-fill info if this customer exists</p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">First Name *</label>
              <input
                type="text"
                name="customer.firstName"
                value={bookingData.customer.firstName}
                onChange={handleInputChange}
                className={`w-full border-2 border-gray-200 rounded-lg px-4 py-3 focus:ring-2 focus:ring-${themeColor}-400 focus:border-${themeColor}-500 transition-colors`}
                placeholder="John"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Last Name *</label>
              <input
                type="text"
                name="customer.lastName"
                value={bookingData.customer.lastName}
                onChange={handleInputChange}
                className={`w-full border-2 border-gray-200 rounded-lg px-4 py-3 focus:ring-2 focus:ring-${themeColor}-400 focus:border-${themeColor}-500 transition-colors`}
                placeholder="Doe"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number *</label>
              <input
                type="tel"
                name="customer.phone"
                value={bookingData.customer.phone}
                onChange={handleInputChange}
                className={`w-full border-2 border-gray-200 rounded-lg px-4 py-3 focus:ring-2 focus:ring-${themeColor}-400 focus:border-${themeColor}-500 transition-colors`}
                placeholder="+1 (555) 123-4567"
                required
              />
            </div>
          </div>
        </div>

        {/* Discounts Section */}
        {((selectedPackage?.giftCards && selectedPackage.giftCards.length > 0) || 
          (selectedPackage?.promos && selectedPackage.promos.length > 0)) && (
          <div className="pt-4 border-t border-gray-200">
            <h3 className="font-semibold text-gray-900 mb-4">Discounts & Promotions</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Gift Card */}
              {selectedPackage?.giftCards && selectedPackage.giftCards.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                    <Gift className="w-4 h-4 mr-2" />
                    Gift Card Code
                  </label>
                  <input
                    type="text"
                    name="giftCardCode"
                    value={bookingData.giftCardCode}
                    onChange={handleInputChange}
                    className={`w-full border-2 border-gray-200 rounded-lg px-4 py-3 focus:ring-2 focus:ring-${themeColor}-400 focus:border-${themeColor}-500 transition-colors uppercase`}
                    placeholder="GIFT-XXXX"
                  />
                </div>
              )}
              
              {/* Promo Code */}
              {selectedPackage?.promos && selectedPackage.promos.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                    <Tag className="w-4 h-4 mr-2" />
                    Promo Code
                  </label>
                  <input
                    type="text"
                    name="promoCode"
                    value={bookingData.promoCode}
                    onChange={handleInputChange}
                    className={`w-full border-2 border-gray-200 rounded-lg px-4 py-3 focus:ring-2 focus:ring-${themeColor}-400 focus:border-${themeColor}-500 transition-colors uppercase`}
                    placeholder="PROMO-XXXX"
                  />
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* Notes */}
        <div className="pt-4 border-t border-gray-200">
          <label className="block text-sm font-medium text-gray-700 mb-2">Additional Notes (Optional)</label>
          <textarea
            name="notes"
            value={bookingData.notes}
            onChange={handleInputChange}
            rows={4}
            className={`w-full border-2 border-gray-200 rounded-lg px-4 py-3 focus:ring-2 focus:ring-${themeColor}-400 focus:border-${themeColor}-500 transition-colors resize-none`}
            placeholder="Any special requests, dietary restrictions, or important information..."
          />
        </div>

        {/* Guest of Honor Section - Only show if package has guest of honor enabled */}
        {selectedPackage?.has_guest_of_honor && (
          <div className="pt-6 border-t border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
              Guest of Honor Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">Guest of Honor Name</label>
                <input
                  type="text"
                  name="guestOfHonorName"
                  value={bookingData.guestOfHonorName}
                  onChange={handleInputChange}
                  className={`w-full border-2 border-gray-200 rounded-lg px-4 py-3 focus:ring-2 focus:ring-${themeColor}-400 focus:border-${themeColor}-500 transition-colors`}
                  placeholder="Enter guest of honor name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Age</label>
                <input
                  type="number"
                  name="guestOfHonorAge"
                  value={bookingData.guestOfHonorAge}
                  onChange={handleInputChange}
                  onWheel={(e) => e.currentTarget.blur()}
                  min="0"
                  className={`w-full border-2 border-gray-200 rounded-lg px-4 py-3 focus:ring-2 focus:ring-${themeColor}-400 focus:border-${themeColor}-500 transition-colors`}
                  placeholder="Age"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Gender</label>
                <select
                  name="guestOfHonorGender"
                  value={bookingData.guestOfHonorGender}
                  onChange={handleInputChange}
                  className={`w-full border-2 border-gray-200 rounded-lg px-4 py-3 focus:ring-2 focus:ring-${themeColor}-400 focus:border-${themeColor}-500 transition-colors`}
                >
                  <option value="">Select Gender</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Guest Address Section (Optional) */}
        <div className="pt-6 border-t border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Guest Address (Optional)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Street Address (Optional)</label>
              <input
                type="text"
                name="guestAddress"
                value={bookingData.guestAddress}
                onChange={handleInputChange}
                className={`w-full border-2 border-gray-200 rounded-lg px-4 py-3 focus:ring-2 focus:ring-${themeColor}-400 focus:border-${themeColor}-500 transition-colors`}
                placeholder="Enter street address"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">City (Optional)</label>
              <input
                type="text"
                name="guestCity"
                value={bookingData.guestCity}
                onChange={handleInputChange}
                className={`w-full border-2 border-gray-200 rounded-lg px-4 py-3 focus:ring-2 focus:ring-${themeColor}-400 focus:border-${themeColor}-500 transition-colors`}
                placeholder="City"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">State/Province (Optional)</label>
              <input
                type="text"
                name="guestState"
                value={bookingData.guestState}
                onChange={handleInputChange}
                className={`w-full border-2 border-gray-200 rounded-lg px-4 py-3 focus:ring-2 focus:ring-${themeColor}-400 focus:border-${themeColor}-500 transition-colors`}
                placeholder="State/Province"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">ZIP/Postal Code (Optional)</label>
              <input
                type="text"
                name="guestZip"
                value={bookingData.guestZip}
                onChange={handleInputChange}
                className={`w-full border-2 border-gray-200 rounded-lg px-4 py-3 focus:ring-2 focus:ring-${themeColor}-400 focus:border-${themeColor}-500 transition-colors`}
                placeholder="ZIP/Postal Code"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Country (Optional)</label>
              <input
                type="text"
                name="guestCountry"
                value={bookingData.guestCountry}
                onChange={handleInputChange}
                className={`w-full border-2 border-gray-200 rounded-lg px-4 py-3 focus:ring-2 focus:ring-${themeColor}-400 focus:border-${themeColor}-500 transition-colors`}
                placeholder="Country"
              />
            </div>
          </div>
        </div>
      </div>
      
      <div className="flex gap-3 pt-4">
        <StandardButton
          type="button"
          variant="secondary"
          onClick={() => setStep(3)}
          className="flex-1"
        >
          Back
        </StandardButton>
        <StandardButton
          type="button"
          variant="primary"
          onClick={() => { setStep(5); scrollToTop(); }}
          className="flex-2"
        >
          Continue to Payment
        </StandardButton>
      </div>
      </div>
      
      {/* Right Column - Live Summary */}
      <div className="lg:col-span-1">
        {renderLiveSummary()}
      </div>
    </div>
  );

  const renderStep5 = () => (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left Column - Booking Summary */}
      <div className="lg:col-span-2">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Review & Payment</h2>
        
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-6">
          {/* Package Details */}
          {selectedPackage && (
            <div>
              <div className="flex gap-4 items-start pb-4 border-b border-gray-200">
                {selectedPackage.image && (
                  <img 
                    src={getImageUrl(selectedPackage.image)} 
                    alt={selectedPackage.name} 
                    className="w-24 h-24 object-cover rounded-lg border border-gray-200 flex-shrink-0" 
                  />
                )}
                <div className="flex-1">
                  <h3 className={`font-bold text-xl text-${fullColor} mb-1`}>{selectedPackage.name}</h3>
                  <p className="text-gray-600 text-sm mb-2">{selectedPackage.description}</p>
                  <div className="flex flex-wrap gap-2">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-${the}-100 text-${the}-800">
                      {selectedPackage.category}
                    </span>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                      <Clock className="w-3 h-3 mr-1" />
                      {formatDuration(selectedPackage)}
                    </span>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      <Users className="w-3 h-3 mr-1" />
                      {bookingData.participants} {bookingData.participants > 1 ? 'Participants' : 'Participant'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Booking Details */}
          <div>
            <h4 className="font-semibold text-gray-900 mb-3 flex items-center">
              <Calendar className="w-4 h-4 mr-2" />
              Booking Details
            </h4>
            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Date:</span>
                <span className="font-medium text-gray-900">
                  {parseLocalDate(bookingData.date).toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Time:</span>
                <span className="font-medium text-gray-900">{formatTimeTo12Hour(bookingData.time)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Space:</span>
                <span className="font-medium text-gray-900">Auto-assigned</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Duration:</span>
                <span className="font-medium text-gray-900">{selectedPackage && formatDuration(selectedPackage)}</span>
              </div>
            </div>
          </div>

          {/* Attractions */}
          {bookingData.selectedAttractions.length > 0 && (
            <div>
              <h4 className="font-semibold text-gray-900 mb-3">Additional Attractions</h4>
              <div className="space-y-2">
                {bookingData.selectedAttractions.map(({ id, quantity }) => {
                  const attraction = selectedPackage?.attractions?.find(a => String(a.id) === id);
                  const price = attraction ? attraction.price * quantity * (attraction.pricingType === 'per_person' ? bookingData.participants : 1) : 0;
                  return (
                    <div key={id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900 text-sm">{attraction?.name}</p>
                        <p className="text-xs text-gray-600">
                          Quantity: {quantity} × ${attraction?.price} 
                          {attraction?.pricingType === 'per_person' && ` × ${bookingData.participants} participants`}
                        </p>
                      </div>
                      <span className="font-semibold text-gray-900">${price.toFixed(2)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Add-ons */}
          {bookingData.selectedAddOns.length > 0 && (
            <div>
              <h4 className="font-semibold text-gray-900 mb-3">Add-ons</h4>
              <div className="space-y-2">
                {bookingData.selectedAddOns.map(({ name, quantity }) => {
                  const addOn = selectedPackage?.addOns.find(a => a.name === name);
                  if (!addOn || !selectedPackage) return null;
                  const addOnPrice = getAddOnPrice(addOn, selectedPackage.id);
                  const price = addOnPrice * quantity;
                  return (
                    <div key={name} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3 flex-1">
                        {addOn?.image && (
                          <img src={getImageUrl(addOn.image)} alt={addOn.name} className="w-10 h-10 object-cover rounded border" />
                        )}
                        <div>
                          <p className="font-medium text-gray-900 text-sm">{name}</p>
                          <p className="text-xs text-gray-600">Quantity: {quantity} × ${addOnPrice.toFixed(2)}</p>
                        </div>
                      </div>
                      <span className="font-semibold text-gray-900">${price.toFixed(2)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Customer Information */}
          <div>
            <h4 className="font-semibold text-gray-900 mb-3">Customer Information</h4>
            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Name:</span>
                <span className="font-medium text-gray-900">{bookingData.customer.firstName} {bookingData.customer.lastName}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Email:</span>
                <span className="font-medium text-gray-900">{bookingData.customer.email}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Phone:</span>
                <span className="font-medium text-gray-900">{bookingData.customer.phone}</span>
              </div>
              {bookingData.notes && (
                <div className="pt-2 border-t border-gray-200">
                  <p className="text-xs text-gray-600 font-medium mb-1">Notes:</p>
                  <p className="text-sm text-gray-900">{bookingData.notes}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Right Column - Payment */}
      <div className="lg:col-span-1">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 sticky top-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Payment Details</h2>
          
          {/* Payment Method */}
          <div className="mb-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Payment Method</h3>
            <div className="grid grid-cols-4 gap-2">
              <StandardButton
                type="button"
                variant={bookingData.paymentMethod === 'authorize.net' ? 'primary' : 'secondary'}
                onClick={() => setBookingData(prev => ({ ...prev, paymentMethod: 'authorize.net' }))}
              >
                <CreditCard className="h-5 w-5 mx-auto mb-1" />
                <span className="text-sm font-medium">Online</span>
              </StandardButton>
              
              <StandardButton
                type="button"
                variant={bookingData.paymentMethod === 'in-store' ? 'primary' : 'secondary'}
                onClick={() => setBookingData(prev => ({ ...prev, paymentMethod: 'in-store' }))}
              >
                <DollarSign className="h-5 w-5 mx-auto mb-1" />
                <span className="text-sm font-medium">In-Store</span>
              </StandardButton>
              
              <StandardButton
                type="button"
                variant={bookingData.paymentMethod === 'card' ? 'primary' : 'secondary'}
                onClick={() => setBookingData(prev => ({ ...prev, paymentMethod: 'card' }))}
              >
                <CreditCard className="h-5 w-5 mx-auto mb-1" />
                <span className="text-sm font-medium">Card</span>
              </StandardButton>
              
              <StandardButton
                type="button"
                variant={bookingData.paymentMethod === 'paylater' ? 'primary' : 'secondary'}
                onClick={() => setBookingData(prev => ({ ...prev, paymentMethod: 'paylater' }))}
              >
                <svg className="h-5 w-5 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm font-medium">Pay Later</span>
              </StandardButton>
            </div>
          </div>
      
      {/* Pay Later Notice */}
      {bookingData.paymentMethod === 'paylater' && (
        <div className="mb-4 p-4 bg-orange-50 rounded-lg border border-orange-200">
          <div className="flex items-start gap-2">
            <svg className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <div>
              <p className="text-sm font-medium text-orange-800">Payment will be collected later</p>
              <p className="text-xs text-orange-700 mt-1">No payment is being processed now. Customer will pay at a later time.</p>
            </div>
          </div>
        </div>
      )}
      
      {/* In-Store Payment - Prompt for amount paid */}
      {bookingData.paymentMethod === 'in-store' && (
        <div className="mb-4 p-4 bg-green-50 rounded-lg border border-green-200">
          <div className="flex items-start gap-2 mb-3">
            <DollarSign className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-green-800">In-Store Payment</p>
              <p className="text-xs text-green-700 mt-1">Enter the amount paid in-store to track this payment.</p>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">How much was paid in-store?</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 font-medium">$</span>
              <input
                type="number"
                min="0"
                max={calculateTotal()}
                step="0.01"
                value={bookingData.inStoreAmountPaid || ''}
                onChange={(e) => {
                  const value = parseFloat(e.target.value) || 0;
                  const maxAmount = calculateTotal();
                  setBookingData(prev => ({ 
                    ...prev, 
                    inStoreAmountPaid: Math.min(Math.max(0, value), maxAmount)
                  }));
                }}
                onWheel={(e) => e.currentTarget.blur()}
                placeholder="0.00"
                className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
            <p className="text-xs text-gray-500 mt-2">Total: ${calculateTotal().toFixed(2)} | Remaining: ${(calculateTotal() - (bookingData.inStoreAmountPaid || 0)).toFixed(2)}</p>
          </div>
        </div>
      )}
      
      {/* Card Payment Options - Show when card or authorize.net is selected */}
      {(bookingData.paymentMethod === 'card' || bookingData.paymentMethod === 'authorize.net') && (
        <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Card Details</h3>
              
              {/* Card Number */}
              <div className="mb-3">
                <label className="block text-xs font-medium text-gray-700 mb-1">Card Number</label>
                <div className="relative">
                  <input
                    type="text"
                    value={cardNumber}
                    onChange={handleCardNumberChange}
                    placeholder="1234 5678 9012 3456"
                    className={`w-full rounded-lg border px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 ${cardNumber && validateCardNumber(cardNumber) ? 'border-green-400 bg-green-50' : cardNumber ? 'border-red-400' : 'border-gray-300'}`}
                    maxLength={19}
                    disabled={isProcessingPayment}
                  />
                  {cardNumber && validateCardNumber(cardNumber) && (
                    <div className="absolute right-2 top-1/2 -translate-y-1/2">
                      <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path>
                      </svg>
                    </div>
                  )}
                </div>
                {cardNumber && (
                  <p className="text-xs mt-1 text-gray-600">{getCardType(cardNumber)}</p>
                )}
              </div>
              
              {/* Expiration and CVV */}
              <div className="grid grid-cols-3 gap-2 mb-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Month</label>
                  <select
                    value={cardMonth}
                    onChange={(e) => setCardMonth(e.target.value)}
                    className={`w-full rounded-lg border border-gray-300 px-2 py-2 text-sm focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500`}
                    disabled={isProcessingPayment}
                  >
                    <option value="">MM</option>
                    {Array.from({ length: 12 }, (_, i) => {
                      const month = (i + 1).toString().padStart(2, '0');
                      return <option key={month} value={month}>{month}</option>;
                    })}
                  </select>
                </div>
                
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Year</label>
                  <select
                    value={cardYear}
                    onChange={(e) => setCardYear(e.target.value)}
                    className={`w-full rounded-lg border border-gray-300 px-2 py-2 text-sm focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500`}
                    disabled={isProcessingPayment}
                  >
                    <option value="">YYYY</option>
                    {Array.from({ length: 10 }, (_, i) => {
                      const year = (new Date().getFullYear() + i).toString();
                      return <option key={year} value={year}>{year}</option>;
                    })}
                  </select>
                </div>
                
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">CVV</label>
                  <input
                    type="text"
                    value={cardCVV}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '');
                      if (value.length <= 4) {
                        setCardCVV(value);
                      }
                    }}
                    placeholder="123"
                    className={`w-full rounded-lg border border-gray-300 px-2 py-2 text-sm font-mono focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500`}
                    maxLength={4}
                    disabled={isProcessingPayment}
                  />
                </div>
              </div>
              
              {/* Error Message */}
              {paymentError && (
                <div className="mb-3 bg-red-50 border border-red-200 rounded-lg p-2 text-xs text-red-800">
                  {paymentError}
                </div>
              )}
              
              {/* Security Notice */}
              <div className="flex items-start gap-2 text-xs text-gray-600">
                <svg className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd"></path>
                </svg>
                <span>Secure payment powered by Authorize.Net</span>
              </div>
        </div>
      )}
      
      {/* Payment Type Selection - Only show if not paylater */}
      {bookingData.paymentMethod !== 'paylater' && (
      <div className="mb-4">
        <h3 className="text-sm font-medium text-gray-700 mb-3">Payment Type</h3>
        <div className="space-y-2">
          <label className="flex items-start gap-3 cursor-pointer p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition">
            <input
              type="radio"
              name="paymentType"
              value="full"
              checked={bookingData.paymentType === 'full'}
              onChange={() => setBookingData(prev => ({ ...prev, paymentType: 'full' }))}
              className="mt-1 accent-blue-600"
            />
            <div className="flex-1">
              <div className="font-medium text-sm text-gray-900">Full Payment</div>
              <div className="text-xs text-gray-600 mt-1">Pay the complete amount now</div>
            </div>
          </label>
          {calculatePartialAmount() > 0 && (
            <label className="flex items-start gap-3 cursor-pointer p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition">
              <input
                type="radio"
                name="paymentType"
                value="partial"
                checked={bookingData.paymentType === 'partial'}
                onChange={() => setBookingData(prev => ({ ...prev, paymentType: 'partial' }))}
                className="mt-1 accent-blue-600"
              />
              <div className="flex-1">
                <div className="font-medium text-sm text-gray-900">Partial Payment</div>
                <div className="text-xs text-gray-600 mt-1">
                  Pay ${calculatePartialAmount().toFixed(2)} now, remaining ${(calculateTotal() - calculatePartialAmount()).toFixed(2)} later
                </div>
              </div>
            </label>
          )}
          
          {/* Custom Payment Amount Option */}
          <label className="flex items-start gap-3 cursor-pointer p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition">
            <input
              type="radio"
              name="paymentType"
              value="custom"
              checked={bookingData.paymentType === 'custom'}
              onChange={() => setBookingData(prev => ({ ...prev, paymentType: 'custom' }))}
              className="mt-1 accent-green-600"
            />
            <div className="flex-1">
              <div className="font-medium text-sm text-gray-900">Custom Amount</div>
              <div className="text-xs text-gray-600 mt-1">
                Enter a specific deposit amount
              </div>
            </div>
          </label>
          
          {/* Custom Amount Input - Show when custom is selected */}
          {bookingData.paymentType === 'custom' && (
            <div className="ml-8 mt-2 p-3 bg-green-50 rounded-lg border border-green-200">
              <label className="block text-sm font-medium text-gray-700 mb-2">Enter Custom Amount</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 font-medium">$</span>
                <input
                  type="number"
                  min="0.01"
                  max={calculateTotal()}
                  step="0.01"
                  value={bookingData.customPaymentAmount || ''}
                  onChange={(e) => {
                    const value = parseFloat(e.target.value) || 0;
                    const maxAmount = calculateTotal();
                    setBookingData(prev => ({ 
                      ...prev, 
                      customPaymentAmount: Math.min(Math.max(0, value), maxAmount) 
                    }));
                  }}
                  onWheel={(e) => e.currentTarget.blur()}
                  placeholder="0.00"
                  className="w-full pl-8 pr-4 py-2.5 border border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm"
                />
              </div>
              <div className="flex justify-between mt-2 text-xs text-gray-600">
                <span>Remaining: ${Math.max(0, calculateTotal() - (bookingData.customPaymentAmount || 0)).toFixed(2)}</span>
                <span>Total: ${calculateTotal().toFixed(2)}</span>
              </div>
              {bookingData.customPaymentAmount > 0 && bookingData.customPaymentAmount >= calculateTotal() && (
                <p className="mt-2 text-xs text-green-600 font-medium">✓ This covers the full amount</p>
              )}
            </div>
          )}
        </div>
      </div>
      )}
      
      {/* Pricing Breakdown */}
      <div className="border-t border-gray-200 pt-4 mb-6">
        <h4 className="text-sm font-semibold text-gray-800 mb-3">Price Breakdown</h4>
        <div className="space-y-3">
          {/* Base Package */}
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="flex justify-between text-sm">
              <div>
                <span className="font-medium text-gray-800">Package: {selectedPackage?.name}</span>
                <p className="text-xs text-gray-500 mt-0.5">
                  Includes {selectedPackage?.minParticipants || 1} participant{(selectedPackage?.minParticipants || 1) > 1 ? 's' : ''}
                </p>
              </div>
              <span className="font-semibold text-gray-900">${selectedPackage?.price.toFixed(2)}</span>
            </div>
          </div>
          
          {/* Additional Participants */}
          {selectedPackage && bookingData.participants > (selectedPackage.minParticipants || 1) && selectedPackage.pricePerAdditional && selectedPackage.pricePerAdditional > 0 && (
            <div className="flex justify-between text-sm items-start">
              <div>
                <span className="text-gray-700">Additional Participants</span>
                <p className="text-xs text-gray-500">
                  {bookingData.participants - (selectedPackage.minParticipants || 1)} extra × ${selectedPackage.pricePerAdditional.toFixed(2)} each
                </p>
              </div>
              <span className="font-medium text-gray-900">
                ${((bookingData.participants - (selectedPackage.minParticipants || 1)) * selectedPackage.pricePerAdditional).toFixed(2)}
              </span>
            </div>
          )}
          
          {/* Participants Summary */}
          <div className="flex justify-between text-sm py-2 border-t border-gray-200">
            <span className="text-gray-600">Total Participants</span>
            <span className="font-medium text-gray-800">{bookingData.participants}</span>
          </div>
          
          {/* Attractions */}
          {bookingData.selectedAttractions.length > 0 && (
            <div className="border-t border-gray-200 pt-3">
              <p className="text-xs font-semibold text-gray-600 uppercase mb-2">Attractions</p>
              {bookingData.selectedAttractions.map(({ id, quantity }) => {
                const attraction = selectedPackage?.attractions?.find(a => String(a.id) === String(id));
                if (!attraction) return null;
                const isPerPerson = attraction.pricingType === 'per_person';
                const lineTotal = attraction.price * quantity * (isPerPerson ? bookingData.participants : 1);
                return (
                  <div key={id} className="flex justify-between text-sm mb-1">
                    <div>
                      <span className="text-gray-700">{attraction.name}</span>
                      <span className="text-xs text-gray-500 ml-1">
                        ({quantity} × ${attraction.price.toFixed(2)}{isPerPerson ? ` × ${bookingData.participants} people` : ''})
                      </span>
                    </div>
                    <span className="font-medium">${lineTotal.toFixed(2)}</span>
                  </div>
                );
              })}
            </div>
          )}
          
          {/* Add-ons */}
          {bookingData.selectedAddOns.length > 0 && (
            <div className="border-t border-gray-200 pt-3">
              <p className="text-xs font-semibold text-gray-600 uppercase mb-2">Add-ons</p>
              {bookingData.selectedAddOns.map(({ name, quantity }) => {
                const addOn = selectedPackage?.addOns.find(a => a.name === name);
                if (!addOn || !selectedPackage) return null;
                const addOnPrice = getAddOnPrice(addOn, selectedPackage.id);
                return (
                  <div key={name} className="flex justify-between text-sm mb-1">
                    <div>
                      <span className="text-gray-700">{name}</span>
                      <span className="text-xs text-gray-500 ml-1">({quantity} × ${addOnPrice.toFixed(2)})</span>
                    </div>
                    <span className="font-medium">${(addOnPrice * quantity).toFixed(2)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        
        <div className="flex justify-between font-bold text-lg mt-4 pt-4 border-t border-gray-200">
          <span>Total</span>
          <span>${calculateTotal().toFixed(2)}</span>
        </div>
        
        {bookingData.paymentMethod === 'paylater' ? (
          <div className="flex justify-between font-semibold text-md mt-2 pt-2 border-t border-dashed border-gray-300 text-orange-700">
            <span>Amount Due Now</span>
            <span>$0.00</span>
          </div>
        ) : bookingData.paymentMethod === 'in-store' && bookingData.inStoreAmountPaid > 0 ? (
          <div className="flex justify-between font-semibold text-md mt-2 pt-2 border-t border-dashed border-gray-300 text-green-700">
            <span>In-Store Amount Paid</span>
            <span>${Math.min(bookingData.inStoreAmountPaid, calculateTotal()).toFixed(2)}</span>
          </div>
        ) : bookingData.paymentType === 'partial' && calculatePartialAmount() > 0 ? (
          <div className="flex justify-between font-semibold text-md mt-2 pt-2 border-t border-dashed border-gray-300 text-blue-700">
            <span>Amount Due Now</span>
            <span>${calculatePartialAmount().toFixed(2)}</span>
          </div>
        ) : bookingData.paymentType === 'custom' && bookingData.customPaymentAmount > 0 && (
          <div className="flex justify-between font-semibold text-md mt-2 pt-2 border-t border-dashed border-gray-300 text-green-700">
            <span>Custom Amount Due Now</span>
            <span>${Math.min(bookingData.customPaymentAmount, calculateTotal()).toFixed(2)}</span>
          </div>
        )}
      </div>
      
      {/* Send Email Receipt Checkbox */}
      <div className="mb-4">
        <label className="flex items-center space-x-3 cursor-pointer group">
          <input
            type="checkbox"
            checked={sendEmail}
            onChange={(e) => setSendEmail(e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
          />
          <span className="text-sm text-gray-700 group-hover:text-gray-900">
            Send confirmation email to customer
          </span>
        </label>
        {!sendEmail && (
          <p className="text-xs text-gray-500 mt-1 ml-7">
            Customer will not receive a booking confirmation email
          </p>
        )}
      </div>
      
      {/* Send Email to Staff Checkbox */}
      <div className="mb-4">
        <label className="flex items-center space-x-3 cursor-pointer group">
          <input
            type="checkbox"
            checked={sendEmailToStaff}
            onChange={(e) => setSendEmailToStaff(e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
          />
          <span className="text-sm text-gray-700 group-hover:text-gray-900">
            Send notification email to staff
          </span>
        </label>
        {!sendEmailToStaff && (
          <p className="text-xs text-gray-500 mt-1 ml-7">
            Staff members will not receive booking notification
          </p>
        )}
      </div>
      
      {/* Action Buttons */}
      <div className="flex gap-3">
        <StandardButton
          type="button"
          variant="secondary"
          onClick={() => setStep(4)}
          className="flex-1"
        >
          Back
        </StandardButton>
        <StandardButton
          type="submit"
          variant="primary"
          icon={CreditCard}
          disabled={!isBookingValid() || isProcessingPayment || submitting}
          loading={isProcessingPayment || submitting}
          className="flex-2"
        >
          {isProcessingPayment || submitting ? 'Processing...' : 'Confirm Booking'}
        </StandardButton>
      </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-4 right-4 z-50">
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(null)}
          />
        </div>
      )}

      {/* No Authorize.Net Account Modal */}
      {showNoAuthAccountModal && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center p-4 z-[9999] animate-backdrop-fade" onClick={() => setShowNoAuthAccountModal(false)}>
          <div className="bg-white rounded-xl max-w-md w-full p-6 border-4 border-yellow-400 shadow-2xl animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex flex-col items-center text-center">
              <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center mb-4">
                <svg className="w-12 h-12 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              
              <h3 className="text-2xl font-bold text-gray-900 mb-3">Authorize.Net Not Configured</h3>
              
              <p className="text-gray-700 mb-6">
                This location does not have an active Authorize.Net account. Automated card processing is unavailable.
              </p>
              
              <div className={`bg-${themeColor}-50 border-2 border-${themeColor}-200 rounded-lg p-4 mb-6 w-full`}>
                <p className={`text-sm text-${themeColor}-900 font-medium`}>
                  You can still process bookings
                </p>
                <p className={`text-xs text-${themeColor}-800 mt-2`}>
                  Cash payments and manual card entry are available. For automated Authorize.Net processing, contact your system administrator or use Location Manager Account to configure the merchant account for this location.
                </p>
              </div>
              
              <StandardButton
                variant="primary"
                fullWidth
                onClick={() => setShowNoAuthAccountModal(false)}
              >
                I Understand
              </StandardButton>
            </div>
          </div>
        </div>
      )}

      <div className="py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 px-1">
        <h1 className="text-3xl font-bold text-gray-900 ml-4">On-site Booking</h1>
        
        {isCompanyAdmin && (
          <LocationSelector
            variant="compact"
            locations={locations.map(loc => ({
              id: loc.id.toString(),
              name: loc.name,
              address: loc.address || '',
              city: loc.city || '',
              state: loc.state || ''
            }))}
            selectedLocation={selectedLocation?.toString() || ''}
            onLocationChange={(id) => setSelectedLocation(id ? Number(id) : null)}
            themeColor={themeColor}
            fullColor={fullColor}
            showAllOption={true}
          />
        )}
      </div>
      
      {/* Progress Steps - Updated labels */}
      <div className="mb-8 px-4">
        <div className="flex justify-between mb-2">
          {[1, 2, 3, 4, 5].map(stepNum => (
            <div
              key={stepNum}
              className={`flex-1 h-2 mx-1 rounded-full ${
                step >= stepNum ? `bg-${fullColor}` : 'bg-gray-300'
              }`}
            />
          ))}
        </div>
        <div className="flex justify-between text-xs text-gray-800">
          <span>Package</span>
          <span>Date & Time</span>
          <span>Add-ons</span>
          <span>Customer</span>
          <span>Payment</span>
        </div>
      </div>
      
      {/* Form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm p-6">
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()} {/* Now Date & Time */}
        {step === 3 && renderStep3()} {/* Now Attractions & Add-ons */}
        {step === 4 && renderStep4()}
        {step === 5 && renderStep5()}
      </form>
      </div>

      {/* Empty State Modal */}
      <EmptyStateModal
        type="packages"
        isOpen={showEmptyModal}
        onClose={() => setShowEmptyModal(false)}
      />
    </>
  );
};

export default OnsiteBooking;