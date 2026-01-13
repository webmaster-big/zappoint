import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import QRCode from 'qrcode';
import type { BookPackagePackage } from '../../../types/BookPackage.types';
import bookingService from '../../../services/bookingService';
import timeSlotService, { type TimeSlot } from '../../../services/timeSlotService';
import { dayOffService, type DayOff } from '../../../services/DayOffService';
import { getImageUrl, formatTimeTo12Hour } from "../../../utils/storage";

// Interface for day offs with time info for partial closures
interface DayOffWithTime {
  date: Date;
  time_start?: string | null;
  time_end?: string | null;
  reason?: string;
  package_ids?: number[] | null;  // If set, only applies to these packages
  room_ids?: number[] | null;     // If set, only blocks these rooms
}
import { loadAcceptJS, processCardPayment, validateCardNumber, formatCardNumber, getCardType, updatePayment, PAYMENT_TYPE } from '../../../services/PaymentService';
import { getAuthorizeNetPublicKey } from '../../../services/SettingsService';
import customerService from '../../../services/CustomerService';
import DatePicker from '../../../components/ui/DatePicker';
import { extractIdFromSlug } from '../../../utils/slug';
import { formatDurationDisplay } from '../../../utils/timeFormat';
import StandardButton from '../../../components/ui/StandardButton';

// Helper function to parse ISO date string (YYYY-MM-DD) in local timezone
// Avoids UTC offset issues that cause date to show as previous day
const parseLocalDate = (isoDateString: string): Date => {
  const [year, month, day] = isoDateString.split('-').map(Number);
  return new Date(year, month - 1, day);
};

const countries = [
  'United States', 'Canada', 'United Kingdom', 'Afghanistan', 'Albania', 'Algeria', 'Andorra', 'Angola',
  'Argentina', 'Armenia', 'Australia', 'Austria', 'Azerbaijan', 'Bahamas', 'Bahrain', 'Bangladesh',
  'Barbados', 'Belarus', 'Belgium', 'Belize', 'Benin', 'Bhutan', 'Bolivia', 'Bosnia and Herzegovina',
  'Botswana', 'Brazil', 'Brunei', 'Bulgaria', 'Burkina Faso', 'Burundi', 'Cambodia', 'Cameroon',
  'Cape Verde', 'Central African Republic', 'Chad', 'Chile', 'China', 'Colombia', 'Comoros',
  'Congo', 'Costa Rica', 'Croatia', 'Cuba', 'Cyprus', 'Czech Republic', 'Denmark', 'Djibouti',
  'Dominica', 'Dominican Republic', 'East Timor', 'Ecuador', 'Egypt', 'El Salvador', 'Equatorial Guinea',
  'Eritrea', 'Estonia', 'Ethiopia', 'Fiji', 'Finland', 'France', 'Gabon', 'Gambia', 'Georgia',
  'Germany', 'Ghana', 'Greece', 'Grenada', 'Guatemala', 'Guinea', 'Guinea-Bissau', 'Guyana', 'Haiti',
  'Honduras', 'Hungary', 'Iceland', 'India', 'Indonesia', 'Iran', 'Iraq', 'Ireland', 'Israel', 'Italy',
  'Jamaica', 'Japan', 'Jordan', 'Kazakhstan', 'Kenya', 'Kiribati', 'North Korea', 'South Korea', 'Kuwait',
  'Kyrgyzstan', 'Laos', 'Latvia', 'Lebanon', 'Lesotho', 'Liberia', 'Libya', 'Liechtenstein', 'Lithuania',
  'Luxembourg', 'Macedonia', 'Madagascar', 'Malawi', 'Malaysia', 'Maldives', 'Mali', 'Malta', 'Marshall Islands',
  'Mauritania', 'Mauritius', 'Mexico', 'Micronesia', 'Moldova', 'Monaco', 'Mongolia', 'Montenegro', 'Morocco',
  'Mozambique', 'Myanmar', 'Namibia', 'Nauru', 'Nepal', 'Netherlands', 'New Zealand', 'Nicaragua', 'Niger',
  'Nigeria', 'Norway', 'Oman', 'Pakistan', 'Palau', 'Panama', 'Papua New Guinea', 'Paraguay', 'Peru',
  'Philippines', 'Poland', 'Portugal', 'Qatar', 'Romania', 'Russia', 'Rwanda', 'Saint Kitts and Nevis',
  'Saint Lucia', 'Saint Vincent and the Grenadines', 'Samoa', 'San Marino', 'Sao Tome and Principe',
  'Saudi Arabia', 'Senegal', 'Serbia', 'Seychelles', 'Sierra Leone', 'Singapore', 'Slovakia', 'Slovenia',
  'Solomon Islands', 'Somalia', 'South Africa', 'South Sudan', 'Spain', 'Sri Lanka', 'Sudan', 'Suriname',
  'Swaziland', 'Sweden', 'Switzerland', 'Syria', 'Taiwan', 'Tajikistan', 'Tanzania', 'Thailand', 'Togo',
  'Tonga', 'Trinidad and Tobago', 'Tunisia', 'Turkey', 'Turkmenistan', 'Tuvalu', 'Uganda', 'Ukraine',
  'United Arab Emirates', 'Uruguay', 'Uzbekistan', 'Vanuatu', 'Vatican City', 'Venezuela', 'Vietnam',
  'Yemen', 'Zambia', 'Zimbabwe'
];

const BookPackage: React.FC = () => {
  const { slug } = useParams<{ location: string; slug: string }>();
  const packageId = slug ? extractIdFromSlug(slug) : null;
  const [pkg, setPkg] = useState<BookPackagePackage | null>(null);
  const [loadingPackage, setLoadingPackage] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [selectedAddOns, setSelectedAddOns] = useState<{ [id: number]: number }>({});
  const [selectedAttractions, setSelectedAttractions] = useState<{ [id: number]: number }>({});
  const [promoCode, setPromoCode] = useState("");
  const [giftCardCode, setGiftCardCode] = useState("");
  const [appliedPromo, setAppliedPromo] = useState<BookPackagePackage['promos'][0] | null>(null);
  const [appliedGiftCard, setAppliedGiftCard] = useState<BookPackagePackage['gift_cards'][0] | null>(null);
  const [participants, setParticipants] = useState<number>(pkg?.min_participants || 1);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    notes: "",
    // Billing Information
    address: "",
    address2: "",
    city: "",
    state: "",
    zip: "",
    country: "United States",
    // Guest of Honor
    guestOfHonorName: "",
    guestOfHonorAge: "",
    guestOfHonorGender: ""
  });
  const [paymentType, setPaymentType] = useState<'full' | 'partial' | 'custom'>('full');
  const [customPaymentAmount, setCustomPaymentAmount] = useState<number>(0);
  const [currentStep, setCurrentStep] = useState(1);
  
  // Payment card details
  const [cardNumber, setCardNumber] = useState("");
  const [cardMonth, setCardMonth] = useState("");
  const [cardYear, setCardYear] = useState("");
  const [cardCVV, setCardCVV] = useState("");
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState("");
  const [authorizeApiLoginId, setAuthorizeApiLoginId] = useState("");
  const [authorizeClientKey, setAuthorizeClientKey] = useState("");
  const [authorizeEnvironment, setAuthorizeEnvironment] = useState<'sandbox' | 'production'>('sandbox');
  
  // Date and time selection
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null);
  const [availableDates, setAvailableDates] = useState<Date[]>([]);
  const [availableTimeSlots, setAvailableTimeSlots] = useState<TimeSlot[]>([]);
  const [loadingTimeSlots, setLoadingTimeSlots] = useState(false);
  const [dayOffs, setDayOffs] = useState<Date[]>([]);
  const [dayOffsWithTime, setDayOffsWithTime] = useState<DayOffWithTime[]>([]);
  
  // Confirmation modal state
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [confirmationData, setConfirmationData] = useState<{
    referenceNumber: string;
    qrCode: string;
    bookingId: number;
  } | null>(null);
  const [countrySearch, setCountrySearch] = useState('');
  const [showCountrySuggestions, setShowCountrySuggestions] = useState(false);
  const [customerId, setCustomerId] = useState<number | null>(null);
  const [showAccountModal, setShowAccountModal] = useState(false);

  // Show account modal for non-logged-in users
  useEffect(() => {
    const customerData = localStorage.getItem('zapzone_customer');
    if (!customerData) {
      setShowAccountModal(true);
    }
  }, []);

  // Load package from backend
  useEffect(() => {
    const fetchPackage = async () => {
      if (!packageId) return;
      
      try {
        setLoadingPackage(true);
        const response = await bookingService.getPackageById(Number(packageId));
        console.log('📦 Package data received:', response.data);
        console.log('📷 Package image:', response.data.image);
        console.log('🎨 Add-ons:', response.data.add_ons);
        setPkg(response.data);
        
        // Set default participants to min_participants
        if (response.data.min_participants) {
          setParticipants(response.data.min_participants);
        }
      } catch (err) {
        console.error('Error fetching package:', err);
        setError('Failed to load package details');
      } finally {
        setLoadingPackage(false);
      }
    };
    
    fetchPackage();
  }, [packageId]);
  
  // Auto-fill form if customer is logged in
  useEffect(() => {
    const fetchCustomerData = async () => {
      try {
        const customerData = localStorage.getItem('zapzone_customer');
        if (customerData) {
          const customer: any = JSON.parse(customerData);
          if (customer.id) {
            // Fetch fresh customer data from API
            const response = await customerService.getCustomerById(customer.id);
            if (response.success && response.data) {
              const data: any = response.data;
              setCustomerId(customer.id); // Store customer ID
              setForm(prev => ({
                ...prev,
                firstName: data.first_name || customer.firstName || '',
                lastName: data.last_name || customer.lastName || '',
                email: data.email || customer.email || '',
                phone: data.phone || customer.phone || '',
                address: data.address || customer.address || '',
                address2: data.address2 || customer.address2 || '',
                city: data.city || customer.city || '',
                state: data.state || customer.state || '',
                zip: data.zip || customer.zip || '',
                country: data.country || customer.country || 'United States'
              }));
              console.log('✅ Customer billing information auto-filled from localStorage');
            }
          } else {
            // If no ID but customer data exists in localStorage, use it directly
            setForm(prev => ({
              ...prev,
              firstName: customer.firstName || '',
              lastName: customer.lastName || '',
              email: customer.email || '',
              phone: customer.phone || '',
              address: customer.address || '',
              address2: customer.address2 || '',
              city: customer.city || '',
              state: customer.state || '',
              zip: customer.zip || '',
              country: customer.country || 'United States'
            }));
            console.log('✅ Customer information auto-filled from localStorage (no API call)');
          }
        }
      } catch (error) {
        console.error('Error fetching customer data:', error);
        // Fallback to localStorage data if API fails
        const customerData = localStorage.getItem('zapzone_customer');
        if (customerData) {
          const customer: any = JSON.parse(customerData);
          setForm(prev => ({
            ...prev,
            firstName: customer.firstName || '',
            lastName: customer.lastName || '',
            email: customer.email || '',
            phone: customer.phone || '',
            address: customer.address || '',
            address2: customer.address2 || '',
            city: customer.city || '',
            state: customer.state || '',
            zip: customer.zip || '',
            country: customer.country || 'United States'
          }));
          console.log('✅ Customer information auto-filled from localStorage (fallback)');
        }
      }
    };
    
    fetchCustomerData();
  }, []);
  
  // Initialize Authorize.Net
  useEffect(() => {
    const initializeAuthorizeNet = async () => {
      try {
        const locationId = pkg?.location_id || 1;
        console.log('🔧 Initializing Authorize.Net for location:', locationId);
        
        // Fetch public key from backend
        const response = await getAuthorizeNetPublicKey(locationId);
        console.log('📡 Authorize.Net API Response:', response);
        
        // API returns data directly: { api_login_id, client_key, environment }
        const apiLoginId = response.api_login_id;
        const clientKey = response.client_key;
        const environment = response.environment || 'sandbox';
        
        console.log('📡 Authorize.Net parsed data:', {
          apiLoginId: apiLoginId ? '✅ Present' : '❌ Missing',
          clientKey: clientKey ? '✅ Present' : '⚠️ Missing (will use API Login ID)',
          environment: environment
        });
        
        if (apiLoginId) {
          setAuthorizeApiLoginId(apiLoginId);
          setAuthorizeClientKey(clientKey || apiLoginId); // Fallback to apiLoginId if no clientKey
          setAuthorizeEnvironment(environment as 'sandbox' | 'production');
          console.log('✅ Authorize.Net credentials set:', {
            usingClientKey: !!clientKey,
            environment: environment
          });
        } else {
          console.warn('⚠️ No Authorize.Net credentials found for location:', locationId);
          console.warn('Full response:', response);
        }
        
        // Load Accept.js library
        await loadAcceptJS(authorizeEnvironment);
        console.log('✅ Accept.js loaded successfully');
      } catch (error: any) {
        console.error('❌ Failed to initialize Authorize.Net');
        console.error('Error details:', {
          message: error.message,
          response: error.response?.data,
          status: error.response?.status,
          fullError: error
        });
      }
    };
    
    initializeAuthorizeNet();
  }, [authorizeEnvironment]);

  // Fetch day offs for the package's location
  useEffect(() => {
    const fetchDayOffs = async () => {
      if (!pkg?.location_id) return;
      
      try {
        const response = await dayOffService.getDayOffsByLocation(pkg.location_id);
        if (response.success && response.data) {
          // Convert day off dates to Date objects
          // Also handle recurring day offs (same month/day each year)
          // Store all day offs with their package_ids for filtering
          const allDayOffs: DayOffWithTime[] = [];
          const today = new Date();
          const futureLimit = new Date();
          futureLimit.setFullYear(futureLimit.getFullYear() + 1); // Look 1 year ahead
          
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
  }, [pkg?.location_id]);

  // Helper function to check if a time slot conflicts with a partial day off
  const isTimeSlotRestricted = (slotStartTime: string, slotEndTime: string): boolean => {
    if (!selectedDate || dayOffsWithTime.length === 0 || !pkg) return false;
    
    // Find partial day off for the selected date that applies to this package
    const selectedDateObj = parseLocalDate(selectedDate);
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
        if (!dayOff.package_ids.includes(pkg.id)) {
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
  // dayOffs array only contains location-wide full day offs, so no filtering needed
  // dayOffsWithTime needs to be filtered for package-specific blocks
  const filteredDayOffsWithTime = React.useMemo(() => {
    if (!pkg) return dayOffsWithTime;
    // Filter day offs that apply to the selected package
    return dayOffsWithTime.filter(d => dayOffAppliesToPackage(d, pkg.id));
  }, [dayOffsWithTime, pkg]);

  // Filter available time slots based on partial day offs
  const filteredTimeSlots = availableTimeSlots.filter(slot => 
    !isTimeSlotRestricted(slot.start_time, slot.end_time)
  );

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
    if (!pkg) return;
    
    const today = new Date();
    const dates: Date[] = [];
    
    // Generate available dates for the next 90 days
    for (let i = 0; i < 90; i++) {
      const date = new Date();
      date.setDate(today.getDate() + i);
      
      // Check if date matches any availability schedule
      let isAvailable = false;
      
      if (pkg.availability_schedules && pkg.availability_schedules.length > 0) {
        for (const schedule of pkg.availability_schedules) {
          if (!schedule.is_active) continue;
          
          if (schedule.availability_type === "daily") {
            isAvailable = true;
            break;
          } 
          else if (schedule.availability_type === "weekly") {
            const dayName = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][date.getDay()];
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
    
    setAvailableDates(dates);
  }, [pkg, selectedDate]);

  // Fetch available time slots via SSE when date changes
  // Backend automatically finds available rooms for each time slot
  useEffect(() => {
    if (!pkg || !selectedDate) {
      setAvailableTimeSlots([]);
      return;
    }
    
    setLoadingTimeSlots(true);
    
    // Create SSE connection
    const eventSource = timeSlotService.getAvailableSlotsSSE({
      package_id: pkg.id,
      date: selectedDate,
    });
    
    // Track if first update has been received
    let isFirstUpdate = true;
    
    // Handle incoming messages
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setAvailableTimeSlots(data.available_slots);
        setLoadingTimeSlots(false);
        // console.log('Received SSE data:', data);
        
        // Mark first update as complete (no auto-selection)
        if (isFirstUpdate) {
          isFirstUpdate = false;
        }
      } catch (err) {
        console.error('Error parsing SSE data:', err);
      }
    };
    
    // Handle errors
    eventSource.onerror = (err) => {
      console.error('SSE connection error:', err);
      setLoadingTimeSlots(false);
      eventSource.close();
    };
    
    // Cleanup: close SSE connection when component unmounts or dependencies change
    return () => {
      eventSource.close();
    };
  }, [selectedDate, pkg]);

  // Handle add-on/attraction quantity change with min/max validation
  const handleAddOnQty = (id: number, qty: number) => {
    const addOn = pkg?.add_ons.find(a => a.id === id);
    const minQty = addOn?.min_quantity ?? 0;
    const maxQty = addOn?.max_quantity ?? 99;
    
    // Enforce max limit
    if (qty > maxQty) qty = maxQty;
    
    // If going from 0 to positive and min_quantity is set, use min_quantity
    const currentQty = selectedAddOns[id] || 0;
    if (currentQty === 0 && qty > 0 && minQty > 1) {
      qty = minQty;
    }
    
    setSelectedAddOns((prev) => ({ ...prev, [id]: Math.max(0, qty) }));
  };
  
  const handleAttractionQty = (id: number, qty: number) => {
    const attraction = pkg?.attractions.find(a => a.id === id);
    const minQty = attraction?.min_quantity ?? 0;
    const maxQty = attraction?.max_quantity ?? 99;
    
    // Enforce max limit
    if (qty > maxQty) qty = maxQty;
    
    // If going from 0 to positive and min_quantity is set, use min_quantity
    const currentQty = selectedAttractions[id] || 0;
    if (currentQty === 0 && qty > 0 && minQty > 1) {
      qty = minQty;
    }
    
    setSelectedAttractions((prev) => ({ ...prev, [id]: Math.max(0, qty) }));
  };

  // Handle promo/gift card code apply
  const handleApplyCode = (type: "promo" | "giftcard") => {
    if (!pkg) return;
    if (type === "promo") {
      const found = pkg.promos.find((p) => p.code === promoCode);
      setAppliedPromo(found || null);
    } else {
      const found = pkg.gift_cards.find((g) => g.code === giftCardCode);
      setAppliedGiftCard(found || null);
    }
  };
  
  // Reset form for new booking
  const resetForm = () => {
    setSelectedAddOns({});
    setSelectedAttractions({});
    setSelectedRoomId(null);
    setPromoCode("");
    setGiftCardCode("");
    setAppliedPromo(null);
    setAppliedGiftCard(null);
    setParticipants(pkg?.min_participants || 1);
    setForm({
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      notes: "",
      address: "",
      address2: "",
      city: "",
      state: "",
      zip: "",
      country: "United States",
      guestOfHonorName: "",
      guestOfHonorAge: "",
      guestOfHonorGender: ""
    });
    setPaymentType('full');
    setCustomPaymentAmount(0);
    setCurrentStep(1);
    setSelectedTime("");
    setShowConfirmation(false);
    setConfirmationData(null);
    setCardNumber("");
    setCardMonth("");
    setCardYear("");
    setCardCVV("");
    setPaymentError("");
  };
  
  // Handle card number input with formatting
  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCardNumber(e.target.value);
    if (formatted.replace(/\s/g, '').length <= 16) {
      setCardNumber(formatted);
      setPaymentError("");
    }
  };

  // Calculate base price with additional participants
  const calculateBasePrice = () => {
    if (!pkg) return 0;
    const basePrice = Number(pkg.price);
    const minParticipants = Number(pkg.min_participants || 1);
    const pricePerAdditional = Number(pkg.price_per_additional || 0);
    
    if (participants <= minParticipants) {
      return basePrice;
    } else {
      const additional = participants - minParticipants;
      return basePrice + (additional * pricePerAdditional);
    }
  };

  // Calculate totals first (moved before calculatePartialAmount)
  const basePrice = calculateBasePrice();
  const addOnsTotal = Object.entries(selectedAddOns).reduce((sum, [idStr, qty]) => {
    const id = Number(idStr);
    const found = pkg && pkg.add_ons.find((a) => a.id === id);
    const price = found ? Number(found.price) : 0;
    return sum + price * qty;
  }, 0);
  const attractionsTotal = Object.entries(selectedAttractions).reduce((sum, [idStr, qty]) => {
    const id = Number(idStr);
    const found = pkg && pkg.attractions.find((a) => a.id === id);
    if (!found) return sum;
    const price = Number(found.price);
    const isPerPerson = (found as any).pricing_type === 'per_person';
    return sum + price * qty * (isPerPerson ? participants : 1);
  }, 0);
  
  // Promo and gift card discounts
  const promoDiscount = appliedPromo ? Number(appliedPromo.discount_value || 0) : 0;
  const giftCardDiscount = appliedGiftCard ? Number(appliedGiftCard.discount_value || 0) : 0;
  
  // Calculate subtotal and total
  const subtotal = basePrice + addOnsTotal + attractionsTotal;
  const total = Math.max(0, subtotal - promoDiscount - giftCardDiscount);

  // Calculate partial payment amount based on package settings
  const calculatePartialAmount = () => {
    if (!pkg) return 0;
    
    // Check if package has partial payment percentage (priority)
    if (pkg.partial_payment_percentage != null && pkg.partial_payment_percentage > 0) {
      return Math.round(total * (pkg.partial_payment_percentage / 100) * 100) / 100;
    }
    
    // Check if package has partial payment fixed amount
    if (pkg.partial_payment_fixed != null && pkg.partial_payment_fixed > 0) {
      return Math.min(pkg.partial_payment_fixed, total);
    }
    
    // If both are null or 0, return 0 (no partial payment available)
    return 0;
  };

  // Format duration for display
  const formatDuration = () => {
    if (!pkg || !pkg.duration) return "Not specified";
    return formatDurationDisplay(pkg.duration, pkg.duration_unit);
  };

  const partialAmount = calculatePartialAmount();

  // Handle booking submission with payment processing
  const handlePayNow = async () => {
    if (!pkg) return;
    
    // Validate card information
    if (!cardNumber || !cardMonth || !cardYear || !cardCVV) {
      setPaymentError('Please fill in all card details');
      return;
    }
    
    if (!validateCardNumber(cardNumber)) {
      setPaymentError('Invalid card number');
      return;
    }
    
    // Validate custom payment amount if selected
    if (paymentType === 'custom' && (!customPaymentAmount || customPaymentAmount <= 0)) {
      setPaymentError('Please enter a valid custom payment amount');
      return;
    }
    
    if (!authorizeApiLoginId) {
      setPaymentError('Payment system not initialized. Please refresh the page.');
      return;
    }
    
    setIsProcessingPayment(true);
    setPaymentError('');
    
    try {
      // Calculate payment amount
      let amountToPay = total;
      if (paymentType === 'custom' && customPaymentAmount > 0) {
        amountToPay = Math.min(customPaymentAmount, total);
      } else if (paymentType === 'partial') {
        amountToPay = partialAmount;
      }
      
      // Step 1: Process payment first
      console.log('💳 Processing payment...');
      
      const cardData = {
        cardNumber: cardNumber.replace(/\s/g, ''),
        month: cardMonth,
        year: cardYear,
        cardCode: cardCVV,
      };
      
      // Customer billing data for Authorize.Net
      const customerData = {
        first_name: form.firstName,
        last_name: form.lastName,
        email: form.email,
        phone: form.phone,
        address: form.address,
        address2: form.address2,
        city: form.city,
        state: form.state,
        zip: form.zip,
        country: form.country,
      };
      
      const paymentData = {
        location_id: pkg.location_id || 1,
        amount: amountToPay,
        order_id: `PKG-${pkg.id}-${Date.now()}`,
        description: `Package Booking: ${pkg.name}`,
        customer_id: customerId || undefined,
      };
      
      console.log('🔑 Using Authorize.Net credentials:', {
        apiLoginId: authorizeApiLoginId ? '✅ Set' : '❌ Missing',
        clientKey: authorizeClientKey ? '✅ Set' : '❌ Missing',
        environment: authorizeEnvironment
      });
      
      const paymentResponse = await processCardPayment(
        cardData,
        paymentData,
        authorizeApiLoginId,
        authorizeClientKey, // Pass the client key
        customerData // Pass customer billing data
      );
      
      if (!paymentResponse.success) {
        throw new Error(paymentResponse.message || 'Payment failed');
      }
      
      console.log('✅ Payment successful:', paymentResponse.transaction_id);
      
      // Step 2: Create booking with payment info
      console.log('📦 Building additional attractions/addons...', {
        selectedAttractions,
        selectedAddOns,
        pkgAttractions: pkg.attractions,
        pkgAddOns: pkg.add_ons
      });
      
      const additionalAttractions = Object.entries(selectedAttractions)
        .filter(([, qty]) => qty > 0)
        .map(([id, qty]) => {
          const attraction = pkg.attractions.find(a => a.id === Number(id));
          if (!attraction) {
            console.warn(`⚠️ Attraction not found: ${id}, available:`, pkg.attractions.map(a => a.id));
            return null;
          }
          // price_at_booking should be unit price, backend calculates total
          const unitPrice = Number(attraction.price);
          console.log(`✅ Attraction found: ${attraction.name}, price: ${unitPrice}`);
          return {
            attraction_id: Number(id),
            quantity: qty,
            price_at_booking: unitPrice
          };
        })
        .filter((item): item is { attraction_id: number; quantity: number; price_at_booking: number } => item !== null);
      
      const additionalAddons = Object.entries(selectedAddOns)
        .filter(([, qty]) => qty > 0)
        .map(([id, qty]) => {
          const addon = pkg.add_ons.find(a => a.id === Number(id));
          if (!addon) {
            console.warn(`⚠️ Add-on not found: ${id}, available:`, pkg.add_ons.map(a => a.id));
            return null;
          }
          // price_at_booking should be unit price, backend calculates total
          const unitPrice = Number(addon.price);
          console.log(`✅ Add-on found: ${addon.name}, price: ${unitPrice}`);
          return {
            addon_id: Number(id),
            quantity: qty,
            price_at_booking: unitPrice
          };
        })
        .filter((item): item is { addon_id: number; quantity: number; price_at_booking: number } => item !== null);
      
      const bookingData = {
        guest_name: `${form.firstName} ${form.lastName}`,
        guest_email: form.email,
        guest_phone: form.phone,
        customer_id: customerId || undefined,
        location_id: pkg.location_id || 1,
        package_id: pkg.id,
        room_id: selectedRoomId || undefined,
        type: 'package' as const,
        booking_date: selectedDate,
        booking_time: selectedTime,
        participants,
        duration: pkg.duration,
        duration_unit: pkg.duration_unit,
        total_amount: total,
        amount_paid: amountToPay,
        payment_method: 'card' as const,
        payment_status: (paymentType === 'full' || (paymentType === 'custom' && customPaymentAmount >= total) ? 'paid' : 'partial') as 'paid' | 'partial',
        status: 'confirmed' as const,
        additional_attractions: additionalAttractions.length > 0 ? additionalAttractions : undefined,
        additional_addons: additionalAddons.length > 0 ? additionalAddons : undefined,
        promo_code: appliedPromo ? appliedPromo.code : undefined,
        gift_card_code: appliedGiftCard ? appliedGiftCard.code : undefined,
        notes: form.notes || undefined,
        transaction_id: paymentResponse.transaction_id,
        guest_of_honor_name: pkg.has_guest_of_honor && form.guestOfHonorName ? form.guestOfHonorName : undefined,
        guest_of_honor_age: pkg.has_guest_of_honor && form.guestOfHonorAge ? parseInt(form.guestOfHonorAge) : undefined,
        guest_of_honor_gender: pkg.has_guest_of_honor && form.guestOfHonorGender ? form.guestOfHonorGender as 'male' | 'female' | 'other' : undefined,
      };
      
      console.log('📦 === BOOKING DATA BEING SENT TO BACKEND ===');
      console.log('Full Booking Object:', JSON.stringify(bookingData, null, 2));
      console.log('Guest Information:', {
        name: bookingData.guest_name,
        email: bookingData.guest_email,
        phone: bookingData.guest_phone,
        customer_id: bookingData.customer_id
      });
      console.log('Billing Information:', {
        address: form.address,
        address2: form.address2,
        city: form.city,
        state: form.state,
        zip: form.zip,
        country: form.country
      });
      console.log('\n🔍 === CRITICAL BOOKING FIELDS VALIDATION ===');
      console.log('✅ room_id:', bookingData.room_id ? `${bookingData.room_id} (from selected time slot)` : '❌ MISSING - This will cause booking to fail!');
      console.log('✅ booking_time:', bookingData.booking_time || '❌ MISSING');
      console.log('✅ booking_date:', bookingData.booking_date || '❌ MISSING');
      console.log('📍 Selected time slot details:', availableTimeSlots.find(slot => slot.start_time === selectedTime));
      console.log('Booking Details:', {
        location_id: bookingData.location_id,
        package_id: bookingData.package_id,
        room_id: bookingData.room_id,
        type: bookingData.type,
        date: bookingData.booking_date,
        time: bookingData.booking_time,
        participants: bookingData.participants,
        duration: `${bookingData.duration} ${bookingData.duration_unit}`
      });
      console.log('=========================================\n');
      console.log('Payment Information:', {
        total_amount: bookingData.total_amount,
        amount_paid: bookingData.amount_paid,
        payment_method: bookingData.payment_method,
        payment_status: bookingData.payment_status,
        transaction_id: bookingData.transaction_id
      });
      console.log('Add-ons & Attractions:', {
        attractions: bookingData.additional_attractions,
        addons: bookingData.additional_addons
      });
      console.log('Discounts:', {
        promo_code: bookingData.promo_code,
        gift_card_code: bookingData.gift_card_code
      });
      console.log('Additional Notes:', bookingData.notes);
      console.log('==============================================');
      
      const response = await bookingService.createBooking(bookingData);
      
      if (response.success && response.data) {
        const bookingId = response.data.id;
        const referenceNumber = response.data.reference_number;
        
        console.log('✅ Booking created:', { bookingId, referenceNumber });
        
        // Update payment record with payable_id and payable_type
        if (paymentResponse.payment?.id) {
          try {
            await updatePayment(paymentResponse.payment.id, { 
              payable_id: bookingId,
              payable_type: PAYMENT_TYPE.BOOKING
            });
            console.log('✅ Payment record updated with payable_id:', bookingId);
          } catch (paymentUpdateError) {
            console.error('⚠️ Failed to update payment with payable_id:', paymentUpdateError);
          }
        }
        
        // Generate and store QR code
        const qrCodeBase64 = await QRCode.toDataURL(referenceNumber, {
          width: 300,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#FFFFFF'
          }
        });
        
        try {
          await bookingService.storeQrCode(bookingId, qrCodeBase64);
          console.log('✅ QR code stored');
        } catch (qrError) {
          console.error('⚠️ Failed to store QR code:', qrError);
        }
        
        // Show confirmation modal
        setConfirmationData({
          referenceNumber,
          qrCode: qrCodeBase64,
          bookingId
        });
        setShowConfirmation(true);
      }
    } catch (err: any) {
      console.error('❌ Payment/Booking error:', err);
      setPaymentError(err.message || 'Payment processing failed. Please try again.');
    } finally {
      setIsProcessingPayment(false);
    }
  };

  
  // Confirmation Modal Component
  const ConfirmationModal = () => {
    if (!showConfirmation || !confirmationData) return null;
    
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto animate-backdrop-fade" onClick={() => setShowConfirmation(false)}>
        <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full my-8 max-h-[calc(100vh-4rem)] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
          <div className="p-4 sm:p-8">
            {/* Success Header */}
            <div className="text-center mb-4 sm:mb-6">
              <div className="mx-auto w-12 h-12 sm:w-16 sm:h-16 bg-green-100 rounded-full flex items-center justify-center mb-3 sm:mb-4">
                <svg className="w-7 h-7 sm:w-10 sm:h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                </svg>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Booking Confirmed!</h2>
              <p className="text-sm sm:text-base text-gray-600">Your booking has been successfully created</p>
            </div>
            
            {/* QR Code Display */}
            <div className="bg-gray-50 rounded-xl p-4 sm:p-6 mb-4 sm:mb-6">
              <div className="flex flex-col items-center">
                <img src={confirmationData.qrCode} alt="Booking QR Code" className="w-48 h-48 sm:w-64 sm:h-64 mb-3 sm:mb-4" />
                <div className="text-center">
                  <p className="text-xs sm:text-sm text-gray-600 mb-1">Reference Number</p>
                  <p className="text-xl sm:text-2xl font-bold text-blue-800">{confirmationData.referenceNumber}</p>
                </div>
              </div>
            </div>
            
            {/* Booking Details */}
            <div className="bg-blue-50 rounded-xl p-4 sm:p-6 mb-4 sm:mb-6">
              <h3 className="font-semibold text-base sm:text-lg mb-3 sm:mb-4 text-gray-800">Booking Details</h3>
              <div className="space-y-2 sm:space-y-3">
                <div className="flex justify-between text-sm sm:text-base">
                  <span className="text-gray-600">Package:</span>
                  <span className="font-medium text-gray-900 text-right ml-2">{pkg?.name}</span>
                </div>
                <div className="flex justify-between text-sm sm:text-base">
                  <span className="text-gray-600">Guest Name:</span>
                  <span className="font-medium text-gray-900">{form.firstName} {form.lastName}</span>
                </div>
                <div className="flex justify-between text-sm sm:text-base">
                  <span className="text-gray-600">Email:</span>
                  <span className="font-medium text-gray-900 text-right ml-2 break-all">{form.email}</span>
                </div>
                <div className="flex justify-between text-sm sm:text-base">
                  <span className="text-gray-600">Phone:</span>
                  <span className="font-medium text-gray-900">{form.phone}</span>
                </div>
                <div className="flex justify-between text-sm sm:text-base">
                  <span className="text-gray-600">Date:</span>
                  <span className="font-medium text-gray-900 text-right ml-2">
                    {parseLocalDate(selectedDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                  </span>
                </div>
                <div className="flex justify-between text-sm sm:text-base">
                  <span className="text-gray-600">Time:</span>
                  <span className="font-medium text-gray-900">{formatTimeTo12Hour(selectedTime)}</span>
                </div>
                <div className="flex justify-between text-sm sm:text-base">
                  <span className="text-gray-600">Participants:</span>
                  <span className="font-medium text-gray-900">{participants}</span>
                </div>
                <div className="flex justify-between text-sm sm:text-base">
                  <span className="text-gray-600">Room:</span>
                  <span className="font-medium text-gray-900">Auto-assigned</span>
                </div>
                <div className="flex justify-between text-sm sm:text-base">
                  <span className="text-gray-600">Duration:</span>
                  <span className="font-medium text-gray-900">{formatDuration()}</span>
                </div>
              </div>
            </div>
            
            {/* Billing Address */}
            <div className="bg-gray-50 rounded-xl p-4 sm:p-6 mb-4 sm:mb-6">
              <h3 className="font-semibold text-base sm:text-lg mb-3 text-gray-800">Billing Address</h3>
              <div className="text-sm text-gray-700 space-y-1">
                <p className="font-medium">{form.firstName} {form.lastName}</p>
                <p>{form.address}</p>
                {form.address2 && <p>{form.address2}</p>}
                <p>{form.city}, {form.state} {form.zip}</p>
                <p>{form.country}</p>
              </div>
            </div>
            
            {/* Additional Items */}
            {(Object.entries(selectedAttractions).some(([, qty]) => qty > 0) || Object.entries(selectedAddOns).some(([, qty]) => qty > 0)) && (
              <div className="bg-gray-50 rounded-xl p-4 sm:p-6 mb-4 sm:mb-6">
                <h3 className="font-semibold text-base sm:text-lg mb-3 text-gray-800">Additional Items</h3>
                <div className="space-y-2">
                  {Object.entries(selectedAttractions).filter(([, qty]) => qty > 0).map(([idStr, qty]) => {
                    const attraction = pkg?.attractions.find(a => a.id === Number(idStr));
                    if (!attraction) return null;
                    return (
                      <div key={idStr} className="flex justify-between text-sm">
                        <span className="text-gray-600">{attraction.name} (x{qty})</span>
                        <span className="font-medium text-gray-900">${(Number(attraction.price) * qty).toFixed(2)}</span>
                      </div>
                    );
                  })}
                  {Object.entries(selectedAddOns).filter(([, qty]) => qty > 0).map(([idStr, qty]) => {
                    const addOn = pkg?.add_ons.find(a => a.id === Number(idStr));
                    if (!addOn) return null;
                    return (
                      <div key={idStr} className="flex justify-between text-sm">
                        <span className="text-gray-600">{addOn.name} (x{qty})</span>
                        <span className="font-medium text-gray-900">${(Number(addOn.price) * qty).toFixed(2)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            
            {/* Payment Summary */}
            <div className="bg-blue-50 rounded-xl p-4 sm:p-6 mb-4 sm:mb-6">
              <h3 className="font-semibold text-base sm:text-lg mb-3 text-gray-800">Payment Summary</h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Base Price:</span>
                  <span className="font-medium text-gray-900">${basePrice.toFixed(2)}</span>
                </div>
                {addOnsTotal > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Add-ons Total:</span>
                    <span className="font-medium text-gray-900">${addOnsTotal.toFixed(2)}</span>
                  </div>
                )}
                {attractionsTotal > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Attractions Total:</span>
                    <span className="font-medium text-gray-900">${attractionsTotal.toFixed(2)}</span>
                  </div>
                )}
                {promoDiscount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Promo Discount:</span>
                    <span className="font-medium text-green-600">-${promoDiscount.toFixed(2)}</span>
                  </div>
                )}
                {giftCardDiscount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Gift Card:</span>
                    <span className="font-medium text-green-600">-${giftCardDiscount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t pt-2 sm:pt-3 mt-2 sm:mt-3 text-sm sm:text-base">
                  <span className="text-gray-600 font-semibold">Total Amount:</span>
                  <span className="font-bold text-blue-800 text-lg sm:text-xl">${total.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm sm:text-base">
                  <span className="text-gray-600">Amount Paid:</span>
                  <span className="font-medium text-green-600">${(
                    paymentType === 'full' ? total : 
                    paymentType === 'custom' ? Math.min(customPaymentAmount, total) : 
                    partialAmount
                  ).toFixed(2)}</span>
                </div>
                {(paymentType === 'partial' || (paymentType === 'custom' && customPaymentAmount < total)) && (
                  <div className="flex justify-between text-sm sm:text-base">
                    <span className="text-gray-600">Remaining Balance:</span>
                    <span className="font-medium text-orange-600">${(
                      paymentType === 'custom' ? total - customPaymentAmount : total - partialAmount
                    ).toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Payment Method:</span>
                  <span className="font-medium text-gray-900">Credit/Debit Card</span>
                </div>
              </div>
            </div>
            
            {/* Information Notice */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 sm:p-4 mb-4 sm:mb-6">
              <div className="flex">
                <svg className="w-5 h-5 text-yellow-600 mr-2 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"></path>
                </svg>
                <div className="text-xs sm:text-sm text-yellow-800">
                  <p className="font-semibold mb-1">Important Information</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>A confirmation email has been sent to {form.email}</li>
                    <li>Please present this QR code at check-in</li>
                    <li>Save or screenshot this confirmation for your records</li>
                  </ul>
                </div>
              </div>
            </div>
            
            {/* Action Button */}
            <div className="flex justify-center">
              <StandardButton
                variant="primary"
                size="lg"
                onClick={resetForm}
              >
                <svg className="w-4 h-4 sm:w-5 sm:h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
                </svg>
                New Booking
              </StandardButton>
            </div>
          </div>
        </div>
      </div>
    );
  };
  
  if (loadingPackage) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-800 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading package details...</p>
        </div>
      </div>
    );
  }

  if (error || !pkg) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 text-lg">{error || 'Package not found'}</p>
          <StandardButton
            variant="primary"
            size="md"
            onClick={() => window.history.back()}
            className="mt-4"
          >
            Go Back
          </StandardButton>
        </div>
      </div>
    );
  }

  return (
    <>
      <ConfirmationModal />
      
      {/* Account Modal */}
      {showAccountModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-fade-in" onClick={() => setShowAccountModal(false)}>
          <div 
            className="bg-white max-w-sm w-full p-6 shadow-2xl animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center mb-4">
              <div className="w-12 h-12 bg-blue-100 flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-blue-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Create an Account?</h3>
              <p className="text-sm text-gray-600">Sign up for faster checkout and track your bookings.</p>
            </div>
            <div className="flex flex-col gap-2.5">
              <StandardButton
                variant="primary"
                size="md"
                fullWidth
                onClick={() => window.location.href = '/customer/register'}
              >
                Create Account
              </StandardButton>
              <StandardButton
                variant="secondary"
                size="md"
                fullWidth
                onClick={() => setShowAccountModal(false)}
              >
                Continue as Guest
              </StandardButton>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scale-in {
          from { 
            opacity: 0;
            transform: scale(0.95);
          }
          to { 
            opacity: 1;
            transform: scale(1);
          }
        }
        .animate-fade-in {
          animation: fade-in 0.2s ease-out;
        }
        .animate-scale-in {
          animation: scale-in 0.3s ease-out;
        }
      `}</style>

      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center py-8 px-4">
        <div className="w-full max-w-6xl flex flex-col md:flex-row gap-8">
        {/* Left: Booking Form */}
        <div className="flex-1 min-w-0">
          <div className="mb-6 md:mb-8 bg-white rounded-xl p-4 md:p-6 shadow-sm border border-gray-100">
            <h2 className="text-base md:text-xl font-semibold mb-2 text-gray-800">{pkg.name}</h2>
            <p className="text-gray-600 mb-3 md:mb-4 text-xs md:text-sm">{pkg.description}</p>
            {((pkg.features && Array.isArray(pkg.features) && pkg.features.length > 0) || 
              (typeof pkg.features === 'string' && pkg.features.trim() !== '')) && (
              <div className="mt-4">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Features:</h3>
                <ul className="space-y-1.5">
                  {pkg.features && Array.isArray(pkg.features)
                    ? pkg.features.map((f: string, index: number) => (
                        <li key={index} className="flex items-start text-xs md:text-sm text-gray-600">
                          <svg className="w-4 h-4 text-blue-800 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path>
                          </svg>
                          <span>{f}</span>
                        </li>
                      ))
                    : typeof pkg.features === 'string' && pkg.features.trim() !== ''
                      ? pkg.features.split(',').map((f: string, index: number) => (
                          <li key={index} className="flex items-start text-xs md:text-sm text-gray-600">
                            <svg className="w-4 h-4 text-blue-800 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path>
                            </svg>
                            <span>{f.trim()}</span>
                          </li>
                        ))
                      : null}
                </ul>
              </div>
            )}
          </div>
          
          {/* Step Navigation */}
          <div className="flex mb-4 md:mb-6 bg-white rounded-xl p-3 md:p-4 shadow-sm border border-gray-100">
            <div className="flex-1 flex items-center">
              <div className={`w-7 h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center mr-2 md:mr-3 text-xs md:text-sm ${currentStep >= 1 ? 'bg-blue-800 text-white' : 'bg-gray-200 text-gray-500'}`}>
                1
              </div>
              <span className={`text-xs md:text-sm font-medium hidden sm:inline ${currentStep >= 1 ? 'text-blue-800' : 'text-gray-500'}`}>Booking Details</span>
              <span className={`text-xs font-medium sm:hidden ${currentStep >= 1 ? 'text-blue-800' : 'text-gray-500'}`}>Details</span>
            </div>
            <div className="flex-1 flex items-center">
              <div className={`w-7 h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center mr-2 md:mr-3 text-xs md:text-sm ${currentStep >= 2 ? 'bg-blue-800 text-white' : 'bg-gray-200 text-gray-500'}`}>
                2
              </div>
              <span className={`text-xs md:text-sm font-medium hidden sm:inline ${currentStep >= 2 ? 'text-blue-800' : 'text-gray-500'}`}>Personal Info</span>
              <span className={`text-xs font-medium sm:hidden ${currentStep >= 2 ? 'text-blue-800' : 'text-gray-500'}`}>Info</span>
            </div>
            <div className="flex-1 flex items-center">
              <div className={`w-7 h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center mr-2 md:mr-3 text-xs md:text-sm ${currentStep >= 3 ? 'bg-blue-800 text-white' : 'bg-gray-200 text-gray-500'}`}>
                3
              </div>
              <span className={`text-xs md:text-sm font-medium ${currentStep >= 3 ? 'text-blue-800' : 'text-gray-500'}`}>Payment</span>
            </div>
          </div>
          
          <div className="space-y-4 md:space-y-6 bg-white rounded-xl shadow-sm p-4 md:p-6 border border-gray-100">
            {currentStep === 1 ? (
              <>
                {/* Date and Time Selection */}
                {/* Room will be automatically assigned by backend */}
                <div className="bg-blue-50 p-4 md:p-5 rounded-xl">
                  <h3 className="font-medium mb-3 md:mb-4 text-gray-800 text-xs md:text-sm uppercase tracking-wide">Select Date & Time</h3>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block font-medium mb-2 text-gray-800 text-sm">Date</label>
                      <DatePicker
                        selectedDate={selectedDate}
                        availableDates={availableDates}
                        onChange={(date) => setSelectedDate(date)}
                        dayOffs={dayOffs}
                        dayOffsWithTime={filteredDayOffsWithTime}
                      />
                    </div>
                    
                    <div>
                      <label className="block font-medium mb-2 text-gray-800 text-sm">Time</label>
                      {loadingTimeSlots ? (
                        <div className="flex items-center justify-center p-4">
                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-800"></div>
                          <span className="ml-2 text-sm text-gray-600">Loading available times...</span>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                          {filteredTimeSlots.length > 0 ? (
                            filteredTimeSlots.map((slot) => (
                              <label key={slot.start_time} className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition ${selectedTime === slot.start_time ? 'border-blue-800 bg-blue-50' : 'border-gray-300 bg-white hover:border-blue-400'}`}> 
                                <input
                                  type="radio"
                                  name="timeSelection"
                                  value={slot.start_time}
                                  checked={selectedTime === slot.start_time}
                                  onChange={() => {
                                    setSelectedTime(slot.start_time);
                                    if (slot.room_id) {
                                      setSelectedRoomId(slot.room_id);
                                      console.log('🏠 Room auto-assigned from time slot:', {
                                        time: slot.start_time,
                                        room_id: slot.room_id,
                                        room_name: slot.room_name,
                                        available_rooms_count: slot.available_rooms_count
                                      });
                                    }
                                  }}
                                  className="accent-blue-800"
                                />
                                <div className="flex flex-col">
                                  <span className="text-sm text-gray-800">{formatTimeTo12Hour(slot.start_time)}</span>
                                  <span className="text-xs text-gray-500">{formatTimeTo12Hour(slot.end_time)}</span>
                                </div>
                              </label>
                            ))
                          ) : (
                            <span className="text-xs text-gray-400 col-span-2">No available times for the selected date. Room will be auto-assigned.</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="text-xs text-gray-500">
                    <p>This package is available {pkg.availability_type === 'daily' ? 'on selected days' : 
                      pkg.availability_type === 'weekly' ? 'weekly on selected weekdays' : 
                      'monthly on selected days'}.</p>
                  </div>
                </div>
                
          
                
                <div className="bg-blue-50 p-4 md:p-5 rounded-xl">
                  <label className="block font-medium mb-3 text-gray-800 text-xs md:text-sm uppercase tracking-wide">Participants</label>
                  <div className="flex items-center flex-wrap gap-2">
                    <StandardButton
                      variant="secondary"
                      size="md"
                      onClick={() => setParticipants(Math.max(1, participants - 1))}
                    >
                      -
                    </StandardButton>
                    <input 
                      type="number" 
                      min={1} 
                      max={Number(pkg.max_participants)} 
                      value={participants} 
                      onChange={e => setParticipants(Math.max(1, Math.min(Number(pkg.max_participants), Number(e.target.value))))}
                      onWheel={(e) => e.currentTarget.blur()}
                      className="w-12 md:w-16 text-center rounded-lg border border-gray-300 px-1 md:px-2 py-1.5 md:py-2 text-sm md:text-base font-medium text-gray-800" 
                    />
                    <StandardButton
                      variant="secondary"
                      size="md"
                      onClick={() => setParticipants(Math.min(Number(pkg.max_participants), participants + 1))}
                    >
                      +
                    </StandardButton>
                    <span className="text-xs text-gray-500 w-full sm:w-auto mt-1 sm:mt-0">
                      {pkg.min_participants} included, +${pkg.price_per_additional} per additional (Max: {pkg.max_participants})
                    </span>
                  </div>
                </div>
                
                {pkg.attractions && pkg.attractions.length > 0 && (
                  <div className="border border-gray-200 rounded-xl p-4 md:p-5">
                    <label className="block font-medium mb-3 text-gray-800 text-xs md:text-sm uppercase tracking-wide">Additional Attractions</label>
                    <div className="space-y-4">
                      {pkg.attractions.map((attraction) => {
                        const minQty = attraction.min_quantity ?? 0;
                        const maxQty = attraction.max_quantity ?? 99;
                        const currentQty = selectedAttractions[attraction.id] || 0;
                        
                        return (
                        <div key={attraction.id} className="flex items-center justify-between p-2 md:p-3 bg-gray-50 rounded-lg gap-2 md:gap-4">
                          {attraction.image && (
                            <img 
                              src={getImageUrl(attraction.image)} 
                              alt={attraction.name} 
                              className="w-12 h-12 md:w-16 md:h-16 object-cover rounded-lg border border-gray-200 flex-shrink-0" 
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <span className="font-medium text-gray-800 text-xs md:text-sm block truncate">{attraction.name}</span>
                            <span className="block text-xs text-gray-500 mt-0.5">
                              ${Number(attraction.price).toFixed(2)}
                            </span>
                            {/* Show quantity limits */}
                            {(minQty > 1 || maxQty < 99) && (
                              <span className="block text-xs text-gray-400 mt-0.5">
                                {minQty > 1 && `Min: ${minQty}`}
                                {minQty > 1 && maxQty < 99 && ' • '}
                                {maxQty < 99 && `Max: ${maxQty}`}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1 md:gap-2 flex-shrink-0">
                            <button 
                              className="w-7 h-7 md:w-8 md:h-8 rounded-md bg-white border border-gray-300 text-gray-800 flex items-center justify-center text-sm font-semibold shadow-sm disabled:opacity-50"
                              onClick={() => handleAttractionQty(attraction.id, currentQty - 1)}
                              disabled={currentQty <= 0}
                            >
                              -
                            </button>
                            <input 
                              type="number" 
                              min={0}
                              max={maxQty}
                              value={currentQty} 
                              onChange={e => {
                                let newQty = Number(e.target.value);
                                if (newQty > maxQty) newQty = maxQty;
                                handleAttractionQty(attraction.id, newQty);
                              }} 
                              className="w-10 md:w-12 text-center rounded-md border border-gray-300 px-1 py-1 text-xs md:text-sm" 
                            />
                            <button 
                              className="w-7 h-7 md:w-8 md:h-8 rounded-md bg-white border border-gray-300 text-gray-800 flex items-center justify-center text-sm font-semibold shadow-sm disabled:opacity-50"
                              onClick={() => handleAttractionQty(attraction.id, currentQty + 1)}
                              disabled={currentQty >= maxQty}
                            >
                              +
                            </button>
                          </div>
                        </div>
                      )})}
                    </div>
                  </div>
                )}
                
                {pkg.add_ons && pkg.add_ons.length > 0 && (
                  <div className="border border-gray-200 rounded-xl p-4 md:p-5">
                    <label className="block font-medium mb-3 text-gray-800 text-xs md:text-sm uppercase tracking-wide">Add-ons</label>
                    <div className="space-y-4">
                      {pkg.add_ons.map((addOn) => {
                        const minQty = addOn.min_quantity ?? 0;
                        const maxQty = addOn.max_quantity ?? 99;
                        const currentQty = selectedAddOns[addOn.id] || 0;
                        
                        return (
                        <div key={addOn.id} className="flex items-center justify-between p-2 md:p-3 bg-gray-50 rounded-lg gap-2 md:gap-4">
                          {/* Add-on Image */}
                          <div className="w-12 h-12 md:w-16 md:h-16 flex-shrink-0 flex items-center justify-center bg-gray-100 rounded-md border border-gray-200 overflow-hidden">
                            {addOn.image ? (
                              <img src={getImageUrl(addOn.image)} alt={addOn.name} className="object-cover w-full h-full" />
                            ) : (
                              <span className="text-gray-400 text-xs">No Image</span>
                            )}
                          </div>
                          <div className="flex-1 flex flex-col justify-between min-w-0">
                            <span className="font-medium text-gray-800 text-xs md:text-sm block truncate">{addOn.name}</span>
                            <span className="block text-xs text-gray-500 mt-0.5">
                              ${Number(addOn.price).toFixed(2)} each
                            </span>
                            {/* Show quantity limits */}
                            {(minQty > 1 || maxQty < 99) && (
                              <span className="block text-xs text-gray-400 mt-0.5">
                                {minQty > 1 && `Min: ${minQty}`}
                                {minQty > 1 && maxQty < 99 && ' • '}
                                {maxQty < 99 && `Max: ${maxQty}`}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1 md:gap-2 flex-shrink-0">
                            <button 
                              className="w-7 h-7 md:w-8 md:h-8 rounded-md bg-white border border-gray-300 text-gray-800 flex items-center justify-center text-sm font-semibold shadow-sm disabled:opacity-50"
                              onClick={() => handleAddOnQty(addOn.id, currentQty - 1)}
                              disabled={currentQty <= 0}
                            >
                              -
                            </button>
                            <input 
                              type="number" 
                              min={0}
                              max={maxQty}
                              value={currentQty} 
                              onChange={e => {
                                let newQty = Number(e.target.value);
                                if (newQty > maxQty) newQty = maxQty;
                                handleAddOnQty(addOn.id, newQty);
                              }} 
                              className="w-10 md:w-12 text-center rounded-md border border-gray-300 px-1 py-1 text-xs md:text-sm" 
                            />
                            <button 
                              className="w-7 h-7 md:w-8 md:h-8 rounded-md bg-white border border-gray-300 text-gray-800 flex items-center justify-center text-sm font-semibold shadow-sm disabled:opacity-50"
                              onClick={() => handleAddOnQty(addOn.id, currentQty + 1)}
                              disabled={currentQty >= maxQty}
                            >
                              +
                            </button>
                          </div>
                        </div>
                      )})}
                    </div>
                  </div>
                )}
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* Promo Code Section: Only show if promos exist */}
                  {pkg.promos && pkg.promos.length > 0 && (
                    <div className="border border-gray-200 rounded-xl p-4 md:p-5">
                      <label className="block font-medium mb-3 text-gray-800 text-xs md:text-sm uppercase tracking-wide">Promo Code</label>
                      <div className="flex gap-2 items-center">
                        <input 
                          type="text" 
                          value={promoCode} 
                          onChange={e => setPromoCode(e.target.value)} 
                          className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm" 
                          placeholder="Enter code" 
                        />
                        <StandardButton 
                          type="button"
                          variant="primary"
                          size="md"
                          onClick={() => handleApplyCode("promo")}
                        >
                          Apply
                        </StandardButton>
                      </div>
                      {appliedPromo && (
                        <div className="mt-3 p-2 bg-blue-80 text-blue-800 rounded-md text-xs border border-blue-800">
                          ✅ Applied: {appliedPromo.name}
                        </div>
                      )}
                    </div>
                  )}
                  {/* Gift Card Section: Only show if gift cards exist */}
                  {pkg.gift_cards && pkg.gift_cards.length > 0 && (
                    <div className="border border-gray-200 rounded-xl p-4 md:p-5">
                      <label className="block font-medium mb-3 text-gray-800 text-xs md:text-sm uppercase tracking-wide">Gift Card</label>
                      <div className="flex gap-2 items-center">
                        <input 
                          type="text" 
                          value={giftCardCode} 
                          onChange={e => setGiftCardCode(e.target.value)} 
                          className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm" 
                          placeholder="Enter code" 
                        />
                        <StandardButton 
                          type="button"
                          variant="primary"
                          size="md"
                          onClick={() => handleApplyCode("giftcard")}
                        >
                          Apply
                        </StandardButton>
                      </div>
                      {appliedGiftCard && (
                        <div className="mt-3 p-2 bg-blue-80 text-blue-800 rounded-md text-xs border border-blue-800">
                          ✅ Applied: {appliedGiftCard.name}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                
                <div className="flex justify-end pt-4">
                  <StandardButton 
                    variant="primary"
                    size="md"
                    onClick={() => {
                      setCurrentStep(2);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    disabled={!selectedTime}
                    className="flex items-center"
                  >
                    Continue to Personal Info
                    <svg className="ml-2 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path>
                    </svg>
                  </StandardButton>
                </div>
              </>
            ) : currentStep === 2 ? (
              <>
                <h3 className="text-base md:text-lg font-medium text-gray-800 mb-4 md:mb-6 border-b pb-3">Personal Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="md:col-span-2">
                    <label className="block font-medium mb-2 text-gray-800 text-sm">Email</label>
                    <input 
                      type="email" 
                      placeholder="Email" 
                      className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:ring-2 focus:ring-blue-600 focus:border-blue-600" 
                      value={form.email} 
                      onChange={e => setForm(f => ({ ...f, email: e.target.value }))} 
                    />
                  </div>
                  <div>
                    <label className="block font-medium mb-2 text-gray-800 text-sm">First Name</label>
                    <input 
                      type="text" 
                      placeholder="First Name" 
                      className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:ring-2 focus:ring-blue-600 focus:border-blue-600" 
                      value={form.firstName} 
                      onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} 
                    />
                  </div>
                  <div>
                    <label className="block font-medium mb-2 text-gray-800 text-sm">Last Name</label>
                    <input 
                      type="text" 
                      placeholder="Last Name" 
                      className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:ring-2 focus:ring-blue-600 focus:border-blue-600" 
                      value={form.lastName} 
                      onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} 
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block font-medium mb-2 text-gray-800 text-sm">Phone Number</label>
                    <input 
                      type="tel" 
                      placeholder="Phone Number" 
                      className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:ring-2 focus:ring-blue-600 focus:border-blue-600" 
                      value={form.phone} 
                      onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} 
                    />
                  </div>
                  {/* Additional Notes */}
                  <div className="md:col-span-2">
                    <label className="block font-medium mb-2 text-gray-800 text-sm">Additional Notes <span className="text-gray-400 font-normal">(Optional)</span></label>
                    <textarea
                      placeholder="Any special requests or notes..."
                      className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                      value={form.notes}
                      onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                      rows={3}
                    />
                  </div>
                </div>

                {/* Guest of Honor Section - Only show if package has guest of honor enabled */}
                {pkg?.has_guest_of_honor && (
                  <div className="mt-6 pt-6 border-t border-gray-200">
                    <h4 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                      </svg>
                      Guest of Honor Information
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div className="md:col-span-2">
                        <label className="block font-medium mb-2 text-gray-800 text-sm">Guest of Honor Name</label>
                        <input 
                          type="text" 
                          placeholder="Enter guest of honor name" 
                          className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:ring-2 focus:ring-blue-600 focus:border-blue-600" 
                          value={form.guestOfHonorName} 
                          onChange={e => setForm(f => ({ ...f, guestOfHonorName: e.target.value }))} 
                        />
                      </div>
                      <div>
                        <label className="block font-medium mb-2 text-gray-800 text-sm">Age</label>
                        <input 
                          type="number" 
                          placeholder="Age" 
                          min="0"
                          className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:ring-2 focus:ring-blue-600 focus:border-blue-600" 
                          value={form.guestOfHonorAge} 
                          onChange={e => setForm(f => ({ ...f, guestOfHonorAge: e.target.value }))} 
                        />
                      </div>
                      <div>
                        <label className="block font-medium mb-2 text-gray-800 text-sm">Gender</label>
                        <select
                          className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                          value={form.guestOfHonorGender}
                          onChange={e => setForm(f => ({ ...f, guestOfHonorGender: e.target.value }))}
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

                {/* Billing Information Section */}
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <h4 className="text-base font-semibold text-gray-900 mb-4">Billing Information</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="md:col-span-2">
                      <label className="block font-medium mb-2 text-gray-800 text-sm">Street Address</label>
                      <input 
                        type="text" 
                        placeholder="123 Main Street" 
                        className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:ring-2 focus:ring-blue-600 focus:border-blue-600" 
                        value={form.address} 
                        onChange={e => setForm(f => ({ ...f, address: e.target.value }))} 
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block font-medium mb-2 text-gray-800 text-sm">Apartment, Suite, Unit <span className="text-gray-400 font-normal">(Optional)</span></label>
                      <input 
                        type="text" 
                        placeholder="Apt 4B, Suite 200, etc." 
                        className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:ring-2 focus:ring-blue-600 focus:border-blue-600" 
                        value={form.address2} 
                        onChange={e => setForm(f => ({ ...f, address2: e.target.value }))} 
                      />
                    </div>
                    <div>
                      <label className="block font-medium mb-2 text-gray-800 text-sm">City</label>
                      <input 
                        type="text" 
                        placeholder="City" 
                        className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:ring-2 focus:ring-blue-600 focus:border-blue-600" 
                        value={form.city} 
                        onChange={e => setForm(f => ({ ...f, city: e.target.value }))} 
                      />
                    </div>
                    <div>
                      <label className="block font-medium mb-2 text-gray-800 text-sm">State / Province</label>
                      <input 
                        type="text" 
                        placeholder="State / Province" 
                        className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:ring-2 focus:ring-blue-600 focus:border-blue-600" 
                        value={form.state} 
                        onChange={e => setForm(f => ({ ...f, state: e.target.value }))} 
                      />
                    </div>
                    <div>
                      <label className="block font-medium mb-2 text-gray-800 text-sm">ZIP / Postal Code</label>
                      <input 
                        type="text" 
                        placeholder="12345" 
                        className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:ring-2 focus:ring-blue-600 focus:border-blue-600" 
                        value={form.zip} 
                        onChange={e => setForm(f => ({ ...f, zip: e.target.value }))} 
                      />
                    </div>
                    <div className="relative">
                      <label className="block font-medium mb-2 text-gray-800 text-sm">Country</label>
                      <input
                        type="text"
                        value={countrySearch}
                        onChange={(e) => {
                          const value = e.target.value;
                          setCountrySearch(value);
                          setShowCountrySuggestions(true);
                          
                          // If exact match, auto-select it
                          const exactMatch = countries.find(c => c.toLowerCase() === value.toLowerCase());
                          if (exactMatch) {
                            setForm(f => ({ ...f, country: exactMatch }));
                          }
                        }}
                        onFocus={() => {
                          // If input is empty but country is selected, show the country name
                          if (!countrySearch && form.country) {
                            setCountrySearch(form.country);
                          }
                          setShowCountrySuggestions(true);
                        }}
                        onBlur={() => {
                          setTimeout(() => {
                            setShowCountrySuggestions(false);
                            // If the typed value doesn't match any country, reset to selected country
                            const matchedCountry = countries.find(c => c.toLowerCase() === countrySearch.toLowerCase());
                            if (matchedCountry) {
                              setForm(f => ({ ...f, country: matchedCountry }));
                              setCountrySearch(matchedCountry);
                            } else if (form.country) {
                              setCountrySearch(form.country);
                            }
                          }, 200);
                        }}
                        placeholder="Type to search countries..."
                        className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                        autoComplete="off"
                      />
                      {/* Country Suggestions Dropdown */}
                      {showCountrySuggestions && countrySearch && (
                        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                          {countries
                            .filter(country => 
                              country.toLowerCase().includes(countrySearch.toLowerCase())
                            )
                            .slice(0, 10)
                            .map(country => (
                              <button
                                key={country}
                                type="button"
                                className={`w-full text-left px-4 py-2 hover:bg-blue-50 transition-colors text-sm ${
                                  country === form.country ? 'bg-blue-50 font-medium' : ''
                                }`}
                                onMouseDown={(e) => {
                                  e.preventDefault(); // Prevent blur from firing first
                                  setForm(f => ({ ...f, country }));
                                  setCountrySearch(country);
                                  setShowCountrySuggestions(false);
                                }}
                              >
                                {country}
                              </button>
                            ))}
                          {countries.filter(country => 
                            country.toLowerCase().includes(countrySearch.toLowerCase())
                          ).length === 0 && (
                            <div className="px-4 py-2 text-sm text-gray-500">
                              No countries found
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="flex justify-between pt-6 gap-2">
                  <StandardButton 
                    variant="secondary"
                    size="md"
                    onClick={() => setCurrentStep(1)}
                    className="flex items-center"
                  >
                    <svg className="mr-1 md:mr-2 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path>
                    </svg>
                    <span className="hidden sm:inline">Back</span>
                  </StandardButton>
                  <StandardButton 
                    variant="primary"
                    size="md"
                    onClick={() => {
                      setCurrentStep(3);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    disabled={!form.firstName || !form.lastName || !form.email || !form.phone || !form.address || !form.city || !form.state || !form.zip || !form.country}
                    className="flex items-center"
                  >
                    Continue to Payment
                    <svg className="ml-2 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path>
                    </svg>
                  </StandardButton>
                </div>
              </>
            ) : (
              <>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 md:mb-6 gap-3">
                  <div>
                    <h3 className="text-base md:text-lg font-semibold text-gray-900">Payment Information</h3>
                    <p className="text-xs md:text-sm text-gray-600 mt-1">Secure payment powered by Authorize.Net</p>
                  </div>
                  <div className="flex gap-1.5 md:gap-2">
                    <img src="https://upload.wikimedia.org/wikipedia/commons/5/5e/Visa_Inc._logo.svg" alt="Visa" className="h-5 md:h-6 opacity-80" />
                    <img src="https://upload.wikimedia.org/wikipedia/commons/2/2a/Mastercard-logo.svg" alt="Mastercard" className="h-5 md:h-6 opacity-80" />
                    <img src="https://upload.wikimedia.org/wikipedia/commons/f/fa/American_Express_logo_%282018%29.svg" alt="Amex" className="h-5 md:h-6 opacity-80" />
                    <img src="https://upload.wikimedia.org/wikipedia/commons/5/57/Discover_Card_logo.svg" alt="Discover" className="h-5 md:h-6 opacity-80" />
                  </div>
                </div>
                
                {/* Card Information Form */}
                <div className="space-y-4 mb-6">
                  
                  {/* Card Number */}
                  <div>
                    <label className="block font-medium mb-2 text-gray-800 text-sm">Card Number</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={cardNumber}
                        onChange={handleCardNumberChange}
                        placeholder="1234 5678 9012 3456"
                        className={`w-full rounded-lg border px-4 py-3 text-sm font-mono focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition ${
                          cardNumber && validateCardNumber(cardNumber)
                            ? 'border-green-400 bg-green-50'
                            : cardNumber
                            ? 'border-red-400'
                            : 'border-gray-300'
                        }`}
                        maxLength={19}
                        disabled={isProcessingPayment}
                      />
                      {cardNumber && validateCardNumber(cardNumber) && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path>
                          </svg>
                        </div>
                      )}
                    </div>
                    {cardNumber && (
                      <p className="text-xs mt-2 text-gray-600">{getCardType(cardNumber)}</p>
                    )}
                  </div>
                  
                  {/* Expiration Date and CVV */}
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block font-medium mb-2 text-gray-800 text-sm">Exp Month</label>
                      <select
                        value={cardMonth}
                        onChange={(e) => setCardMonth(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
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
                      <label className="block font-medium mb-2 text-gray-800 text-sm">Exp Year</label>
                      <select
                        value={cardYear}
                        onChange={(e) => setCardYear(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
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
                      <label className="block font-medium mb-2 text-gray-800 text-sm">CVV</label>
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
                        className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm font-mono focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                        maxLength={4}
                        disabled={isProcessingPayment}
                      />
                    </div>
                  </div>
                  
                  {/* Error Message */}
                  {paymentError && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800 flex items-start gap-2">
                      <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"></path>
                      </svg>
                      <span>{paymentError}</span>
                    </div>
                  )}
                  
                  {/* Security Notice */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-2">
                    <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd"></path>
                    </svg>
                    <div className="text-sm text-blue-900">
                      <p className="font-semibold">Secure Payment</p>
                      <p className="text-xs text-blue-800 mt-0.5">256-bit SSL encrypted • PCI compliant • Powered by Authorize.Net</p>
                    </div>
                  </div>
                </div>
                
                {/* Payment Type Selection */}
                <div className="mt-4 md:mt-6 mb-4 border border-gray-200 rounded-xl p-4 md:p-5">
                  <label className="block font-medium mb-3 text-gray-800 text-xs md:text-sm">Select Payment Type</label>
                  <div className="space-y-3">
                    <label className="flex items-start gap-3 cursor-pointer p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition">
                      <input
                        type="radio"
                        name="paymentType"
                        value="full"
                        checked={paymentType === 'full'}
                        onChange={() => setPaymentType('full')}
                        className="mt-1 accent-blue-800"
                      />
                      <div className="flex-1">
                        <div className="font-medium text-sm text-gray-900">Full Payment</div>
                        <div className="text-xs text-gray-600 mt-1">Pay the complete amount now (${total.toFixed(2)})</div>
                      </div>
                    </label>
                    {partialAmount > 0 && (
                      <label className="flex items-start gap-3 cursor-pointer p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition">
                        <input
                          type="radio"
                          name="paymentType"
                          value="partial"
                          checked={paymentType === 'partial'}
                          onChange={() => setPaymentType('partial')}
                          className="mt-1 accent-blue-800"
                        />
                        <div className="flex-1">
                          <div className="font-medium text-sm text-gray-900">
                            Partial Payment {pkg.partial_payment_percentage ? `(${pkg.partial_payment_percentage}%)` : ''}
                          </div>
                          <div className="text-xs text-gray-600 mt-1">
                            Pay <span className="font-semibold text-blue-800">${partialAmount.toFixed(2)}</span> now. 
                            Remaining <span className="font-semibold">${(total - partialAmount).toFixed(2)}</span> will be paid on-site.
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
                        checked={paymentType === 'custom'}
                        onChange={() => setPaymentType('custom')}
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
                    {paymentType === 'custom' && (
                      <div className="ml-8 mt-2 p-3 bg-green-50 rounded-lg border border-green-200">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Enter Custom Amount</label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 font-medium">$</span>
                          <input
                            type="number"
                            min="0.01"
                            max={total}
                            step="0.01"
                            value={customPaymentAmount || ''}
                            onChange={(e) => {
                              const value = parseFloat(e.target.value) || 0;
                              setCustomPaymentAmount(Math.min(Math.max(0, value), total));
                            }}
                            placeholder="0.00"
                            className="w-full pl-8 pr-4 py-2.5 border border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm"
                          />
                        </div>
                        <div className="flex justify-between mt-2 text-xs text-gray-600">
                          <span>Remaining: ${Math.max(0, total - (customPaymentAmount || 0)).toFixed(2)}</span>
                          <span>Total: ${total.toFixed(2)}</span>
                        </div>
                        {customPaymentAmount > 0 && customPaymentAmount >= total && (
                          <p className="mt-2 text-xs text-green-600 font-medium">✓ This covers the full amount</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center pt-6 gap-3">
                  <StandardButton 
                    variant="secondary"
                    size="md"
                    onClick={() => setCurrentStep(2)}
                    className="flex items-center justify-center"
                  >
                    <svg className="mr-1 md:mr-2 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path>
                    </svg>
                    <span className="hidden sm:inline">Back</span>
                    <span className="sm:hidden">Back to Personal Info</span>
                  </StandardButton>
                  
                  <StandardButton
                    variant="primary"
                    size="md"
                    onClick={handlePayNow}
                    disabled={isProcessingPayment || !cardNumber || !cardMonth || !cardYear || !cardCVV || !validateCardNumber(cardNumber) || (paymentType === 'custom' && (!customPaymentAmount || customPaymentAmount <= 0))}
                    className="flex items-center justify-center flex-1 sm:flex-initial"
                  >
                    {isProcessingPayment ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                        Processing Payment...
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
                        </svg>
                        Pay ${paymentType === 'full' ? total.toFixed(2) : paymentType === 'custom' ? Math.min(customPaymentAmount || 0, total).toFixed(2) : partialAmount.toFixed(2)}
                      </>
                    )}
                  </StandardButton>
                </div>
              </>
            )}
          </div>
        </div>
        
        {/* Right: Order Summary */}
        <div className="w-full md:w-80 flex-shrink-0">
            <div className="bg-white rounded-xl shadow-sm p-4 md:p-6 sticky top-6 border border-gray-100">
              <h3 className="font-semibold text-base md:text-lg mb-4 md:mb-5 text-gray-800 border-b pb-3 md:pb-4">Order Summary</h3>
              {/* Package Image in Order Summary */}
              {pkg.image && (
                <div className="mb-4 w-full flex justify-center">
                  <img src={getImageUrl(pkg.image)} alt={pkg.name} className="max-h-32 rounded-lg object-contain border border-gray-200" />
                </div>
              )}
              <div className="mb-5">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-600 text-sm">Package:</span>
                  <span className="font-medium text-gray-800 text-sm">{pkg.name}</span>
                </div>
                <div className="text-xs text-gray-500 mb-4">{participants} participants</div>
                {/* Duration in Order Summary */}
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-600 text-sm">Duration:</span>
                  <span className="font-medium text-gray-800 text-sm">{formatDuration()}</span>
                </div>
                {selectedDate && (
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-gray-600 text-sm">Date:</span>
                    <span className="font-medium text-gray-800 text-sm">
                      {parseLocalDate(selectedDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                )}
                {selectedTime && (
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-gray-600 text-sm">Time:</span>
                    <span className="font-medium text-gray-800 text-sm">{formatTimeTo12Hour(selectedTime)}</span>
                  </div>
                )}
              </div>
            
            <div className="space-y-3 border-t pt-4 text-sm">
              {/* Package Base Price - Detailed */}
              <div className="bg-blue-50 rounded-lg p-3">
                <div className="flex justify-between items-start mb-1">
                  <span className="font-semibold text-gray-800">Base Package</span>
                  <span className="font-bold text-gray-900">${Number(pkg.price).toFixed(2)}</span>
                </div>
                <p className="text-xs text-gray-600">{pkg.name}</p>
                <p className="text-xs text-gray-500 mt-1">
                  ✓ Includes up to {pkg.min_participants || 1} participant{(pkg.min_participants || 1) > 1 ? 's' : ''}
                </p>
                <p className="text-xs text-gray-500">
                  ✓ Duration: {formatDuration()}
                </p>
              </div>
              
              {/* Additional Participants - More Detailed */}
              {participants > (pkg.min_participants || 1) && pkg.price_per_additional && Number(pkg.price_per_additional) > 0 && (
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="font-medium text-gray-800">Additional Participants</span>
                      <p className="text-xs text-gray-500 mt-1">
                        Base covers {pkg.min_participants || 1}, you have {participants} total
                      </p>
                      <p className="text-xs text-gray-600 mt-0.5">
                        {participants - (pkg.min_participants || 1)} extra × ${Number(pkg.price_per_additional).toFixed(2)}/person
                      </p>
                    </div>
                    <span className="font-semibold text-gray-900">
                      +${((participants - (pkg.min_participants || 1)) * Number(pkg.price_per_additional)).toFixed(2)}
                    </span>
                  </div>
                </div>
              )}
              
              {/* Participant Count Summary */}
              <div className="flex justify-between items-center text-xs py-2 px-1 border-b border-gray-200">
                <span className="text-gray-600">Total Participants</span>
                <span className="font-semibold text-gray-800">{participants} people</span>
              </div>
              
              {/* Attractions - Detailed Breakdown */}
              {Object.entries(selectedAttractions).some(([, qty]) => qty > 0) && (
                <div className="pt-2">
                  <div className="font-semibold text-gray-800 mb-2 text-xs uppercase tracking-wide">Attractions</div>
                  {Object.entries(selectedAttractions).filter(([, qty]) => qty > 0).map(([idStr, qty]) => {
                    const id = Number(idStr);
                    const attraction = pkg.attractions.find((a) => a.id === id);
                    if (!attraction) return null;
                    const price = Number(attraction.price);
                    const isPerPerson = (attraction as any).pricing_type === 'per_person';
                    const lineTotal = price * qty * (isPerPerson ? participants : 1);
                    
                    return (
                      <div key={id} className="bg-gray-50 rounded p-2 mb-1">
                        <div className="flex justify-between text-xs">
                          <span className="font-medium text-gray-700">{attraction.name}</span>
                          <span className="font-semibold text-gray-800">+${lineTotal.toFixed(2)}</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {qty} × ${price.toFixed(2)}{isPerPerson ? ` × ${participants} people` : '/unit'}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
              
              {/* Room Info */}
              <div className="flex justify-between text-xs text-gray-500 py-1 border-b border-gray-100">
                <span>Room Assignment</span>
                <span className="text-gray-600">Auto-assigned at booking</span>
              </div>
              
              {/* Add-ons - Detailed Breakdown */}
              {Object.entries(selectedAddOns).some(([, qty]) => qty > 0) && (
                <div className="pt-2">
                  <div className="font-semibold text-gray-800 mb-2 text-xs uppercase tracking-wide">Add-ons</div>
                  {Object.entries(selectedAddOns).filter(([, qty]) => qty > 0).map(([idStr, qty]) => {
                    const id = Number(idStr);
                    const addOn = pkg.add_ons.find((a) => a.id === id);
                    if (!addOn) return null;
                    const price = Number(addOn.price);
                    
                    return (
                      <div key={id} className="bg-gray-50 rounded p-2 mb-1">
                        <div className="flex justify-between text-xs">
                          <span className="font-medium text-gray-700">{addOn.name}</span>
                          <span className="font-semibold text-gray-800">+${(price * qty).toFixed(2)}</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">{qty} × ${price.toFixed(2)}</p>
                      </div>
                    );
                  })}
                </div>
              )}
              
              {appliedPromo && (
                <div className="flex justify-between text-blue-800">
                  <span>Promo Discount</span>
                  <span>-${promoDiscount.toFixed(2)}</span>
                </div>
              )}
              
              {appliedGiftCard && (
                <div className="flex justify-between text-blue-800">
                  <span>Gift Card</span>
                  <span>-${giftCardDiscount.toFixed(2)}</span>
                </div>
              )}
              
              <div className="flex justify-between pt-3 border-t font-semibold text-base">
                <span>Total</span>
                <span className="text-blue-800">${total.toFixed(2)}</span>
              </div>
            </div>
            
            <div className="mt-6 text-xs text-gray-500 text-center border-t pt-4">
              Your booking will be confirmed immediately after payment
            </div>
          </div>
        </div>
      </div>
    </div>
    </>
  );
};

export default BookPackage;