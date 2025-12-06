// src/pages/onsite-booking/OnsiteBooking.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Clock, Users, CreditCard, Gift, Tag, Plus, Minus, DollarSign } from 'lucide-react';
import QRCode from 'qrcode';
import { useThemeColor } from '../../../hooks/useThemeColor';
import type { 
  OnsiteBookingRoom, 
  OnsiteBookingPackage, 
  OnsiteBookingData 
} from '../../../types/onsiteBooking.types';
import bookingService, { type CreateBookingData } from '../../../services/bookingService';
import timeSlotService, { type TimeSlot } from '../../../services/timeSlotService';
import customerService from '../../../services/CustomerService';
import { ASSET_URL, getStoredUser, formatTimeTo12Hour } from '../../../utils/storage';
import { Link } from 'react-router-dom';
import { loadAcceptJS, processCardPayment, validateCardNumber, formatCardNumber, getCardType } from '../../../services/PaymentService';
import { getAuthorizeNetPublicKey } from '../../../services/SettingsService';

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
}

interface BookingData extends Omit<OnsiteBookingData, 'customer'> {
  customer: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
  };
  paymentMethod: 'card' | 'cash';
  paymentType: 'full' | 'partial';
  giftCardCode: string;
  promoCode: string;
  notes: string;
}

const OnsiteBooking: React.FC = () => {
  const navigate = useNavigate();
  const { themeColor, fullColor } = useThemeColor();
  const [packages, setPackages] = useState<OnsiteBookingPackage[]>([]);
  const [selectedPackage, setSelectedPackage] = useState<OnsiteBookingPackage | null>(null);
  const [availableDates, setAvailableDates] = useState<Date[]>([]);
  const [availableTimeSlots, setAvailableTimeSlots] = useState<TimeSlot[]>([]);
  const [loadingTimeSlots, setLoadingTimeSlots] = useState(false);
  const [loadingPackages, setLoadingPackages] = useState(true);
  const [loadingCustomer, setLoadingCustomer] = useState(false);
  const [step, setStep] = useState(1);
  const [selectedRoom, setSelectedRoom] = useState<string>("");
  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Card payment details
  const [useAuthorizeNet, setUseAuthorizeNet] = useState(false);
  const [cardNumber, setCardNumber] = useState('');
  const [cardMonth, setCardMonth] = useState('');
  const [cardYear, setCardYear] = useState('');
  const [cardCVV, setCardCVV] = useState('');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [authorizeApiLoginId, setAuthorizeApiLoginId] = useState('');
  const [authorizeEnvironment, setAuthorizeEnvironment] = useState<'sandbox' | 'production'>('sandbox');
  const [showNoAuthAccountModal, setShowNoAuthAccountModal] = useState(false);
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
    paymentMethod: 'cash',
    paymentType: 'full',
    giftCardCode: '',
    promoCode: '',
    notes: '',
    total: 0
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
      bookingData.customer.phone.trim() &&
      (!selectedPackage.rooms || selectedPackage.rooms.length === 0 || selectedRoom)
    );
  };

  // Format duration for display
  const formatDuration = (pkg: OnsiteBookingPackage | null) => {
    if (!pkg || !pkg.duration) return "Not specified";
    return `${pkg.duration} ${pkg.durationUnit}`;
  };

  // Load packages from backend
  useEffect(() => {
    const fetchPackages = async () => {
      try {
        setLoadingPackages(true);
        // Fetch all packages from backend
        const response = await bookingService.getPackages({user_id: getStoredUser()?.id});
        
        if (response.success && response.data && response.data.packages) {
          
          // Transform backend package data to match OnsiteBookingPackage interface
          console.log('Fetched packages:', response.data.packages);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const transformedPackages: OnsiteBookingPackage[] = response.data.packages.map((pkg: any) => ({
            id: pkg.id,
            name: pkg.name,
            description: pkg.description,
            price: Number(pkg.price),
            maxParticipants: pkg.max_participants,
            category: pkg.category,
            features: pkg.features,
            availabilityType: pkg.availability_type,
            availableDays: pkg.available_days || [],
            availableWeekDays: pkg.available_week_days || [],
            availableMonthDays: pkg.available_month_days || [],
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            attractions: pkg.attractions?.map((a: any) => ({
              id: a.id.toString(),
              name: a.name,
              description: a.description || '',
              price: Number(a.price),
              pricingType: a.pricing_type as 'per_person' | 'per_unit',
              category: a.category || '',
              maxCapacity: a.max_capacity || 0,
              image: Array.isArray(a.image) ? a.image[0] : a.image
            })) || [],
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            addOns: pkg.add_ons?.map((a: any) => ({
              id: a.id,
              name: a.name,
              price: Number(a.price),
              image: a.image || null
            })) || [],
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            rooms: pkg.rooms?.map((r: any) => ({
              id: r.id,
              name: r.name,
              capacity: r.capacity
            })) || [],
            image: pkg.image?.[0] || null,
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
            partialPaymentFixed: pkg.partial_payment_fixed || 0
          }));
          
          setPackages(transformedPackages);
        }
      } catch (error) {
        console.error('❌ Error fetching packages:', error);
        // Set empty array on error
        setPackages([]);
      } finally {
        setLoadingPackages(false);
      }
    };

    fetchPackages();
  }, []);
  
  // Load Authorize.Net settings
  useEffect(() => {
    const loadAuthorizeNetSettings = async () => {
      try {
        const user = JSON.parse(localStorage.getItem('zapzone_user') || '{}');
        const locationId = user.location_id || 1;
        const settings = await getAuthorizeNetPublicKey(locationId);
        if (settings && settings.data) {
          setAuthorizeApiLoginId(settings.data.api_login_id);
          setAuthorizeEnvironment(settings.data.environment);
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
    
    const today = new Date();
    const dates: Date[] = [];
    
    // Generate available dates for the next 90 days
    for (let i = 0; i < 90; i++) {
      const date = new Date();
      date.setDate(today.getDate() + i);
      
      // Check if date matches package availability
      let isAvailable = false;
      
      if (selectedPackage.availabilityType === "daily") {
        // Daily: Check if the day of week is in available_days
        const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
        isAvailable = selectedPackage.availableDays.includes(dayName);
      } 
      else if (selectedPackage.availabilityType === "weekly") {
        // Weekly: Check if the day of week is in available_week_days (every week)
        const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
        isAvailable = selectedPackage.availableWeekDays.includes(dayName);
      } 
      else if (selectedPackage.availabilityType === "monthly") {
        // Monthly: Check patterns like "Sunday-last", "Monday-1st", "15", etc.
        const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
        const weekOfMonth = getWeekOfMonth(date);
        const isInLastWeek = isLastWeekOfMonth(date);
        const dayOfMonth = date.getDate();
        
        for (const pattern of selectedPackage.availableMonthDays) {
          // Check for specific day number (e.g., "15", "1", "30")
          if (!isNaN(Number(pattern)) && dayOfMonth === Number(pattern)) {
            isAvailable = true;
            break;
          }
          
          // Check for day-week patterns (e.g., "Sunday-last", "Monday-1st")
          if (pattern.includes('-')) {
            const [patternDay, patternWeek] = pattern.split('-');
            
            if (patternDay === dayName) {
              if (patternWeek === 'last' && isInLastWeek) {
                isAvailable = true;
                break;
              } else if (patternWeek === '1st' && weekOfMonth === 1) {
                isAvailable = true;
                break;
              } else if (patternWeek === '2nd' && weekOfMonth === 2) {
                isAvailable = true;
                break;
              } else if (patternWeek === '3rd' && weekOfMonth === 3) {
                isAvailable = true;
                break;
              } else if (patternWeek === '4th' && weekOfMonth === 4) {
                isAvailable = true;
                break;
              }
            }
          }
          
          // Check for "last" (last day of month)
          if (pattern === 'last') {
            const lastDayOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);
            if (dayOfMonth === lastDayOfMonth.getDate()) {
              isAvailable = true;
              break;
            }
          }
        }
      }
      
      if (isAvailable) {
        dates.push(date);
      }
    }
    
    setAvailableDates(dates);
    
    // Set default selected date to first available date
    if (dates.length > 0 && !bookingData.date) {
      const firstDate = dates[0].toISOString().split('T')[0];
      setBookingData(prev => ({ ...prev, date: firstDate }));
    } else if (dates.length === 0) {
      console.warn('⚠️ No available dates found for this package!');
    }
  }, [selectedPackage, bookingData.date]);

  // Fetch available time slots via SSE when date or room changes
  useEffect(() => {
    if (!selectedPackage || !bookingData.date || !selectedRoomId) {
      setAvailableTimeSlots([]);
      return;
    }
    
    console.log('🕐 Fetching time slots for:', {
      package_id: selectedPackage.id,
      package_name: selectedPackage.name,
      room_id: selectedRoomId,
      room_name: selectedRoom,
      date: bookingData.date,
    });
    
    setLoadingTimeSlots(true);
    
    // Create SSE connection
    const eventSource = timeSlotService.getAvailableSlotsSSE({
      package_id: selectedPackage.id,
      room_id: selectedRoomId,
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
        
        // Auto-select first available time slot only on initial load
        if (isFirstUpdate && data.available_slots.length > 0) {
          setBookingData((prev) => {
            // Only set if no time is currently selected
            if (!prev.time) {
              return { ...prev, time: data.available_slots[0].start_time };
            }
            
            // Check if previously selected time is still available
            const timeIsAvailable = data.available_slots.some(
              (slot: TimeSlot) => slot.start_time === prev.time
            );
            
            // If not available, select first available slot
            if (!timeIsAvailable) {
              return { ...prev, time: data.available_slots[0]?.start_time || "" };
            }
            
            return prev;
          });
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
        room_id: selectedRoomId,
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
  }, [bookingData.date, selectedRoomId, selectedPackage]);

  const handlePackageSelect = (pkg: OnsiteBookingPackage) => {
    setSelectedPackage(pkg);
    setSelectedRoom("");
    setBookingData(prev => ({ 
      ...prev, 
      packageId: pkg.id,
      selectedAttractions: [],
      selectedAddOns: [],
      participants: pkg.maxParticipants
    }));
    setStep(2); // Move directly to step 2 (Date & Time) after selecting a package
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
        // Add attraction with default quantity 1
        return {
          ...prev,
          selectedAttractions: [...prev.selectedAttractions, { id: attractionId, quantity: 1 }]
        };
      }
    });
  };

  const handleAttractionQuantityChange = (attractionId: string, quantity: number) => {
    if (quantity < 1) return;
    
    setBookingData(prev => ({
      ...prev,
      selectedAttractions: prev.selectedAttractions.map(a => 
        a.id === attractionId ? { ...a, quantity } : a
      )
    }));
  };

  const handleAddOnToggle = (addOnName: string) => {
    setBookingData(prev => {
      const existingIndex = prev.selectedAddOns.findIndex(a => a.name === addOnName);
      if (existingIndex >= 0) {
        // Remove add-on
        return {
          ...prev,
          selectedAddOns: prev.selectedAddOns.filter(a => a.name !== addOnName)
        };
      } else {
        // Find the add-on to get its ID
        const addOn = selectedPackage?.addOns.find(a => a.name === addOnName);
        
        console.log('🔍 Adding add-on:', { 
          addOnName, 
          foundAddOn: addOn, 
          addOnId: addOn?.id,
          allAddOns: selectedPackage?.addOns 
        });
        
        // Add add-on with ID, name, default quantity 1
        return {
          ...prev,
          selectedAddOns: [...prev.selectedAddOns, { 
            id: addOn?.id, 
            name: addOnName, 
            quantity: 1 
          }]
        };
      }
    });
  };

  const handleAddOnQuantityChange = (addOnName: string, quantity: number) => {
    if (quantity < 1) return;
    
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
      total += selectedPackage.price;
      
      // Additional participants cost only if exceeding max_participants
      if (selectedPackage.pricePerAdditional && bookingData.participants > selectedPackage.maxParticipants) {
        const additionalCount = bookingData.participants - selectedPackage.maxParticipants;
        total += additionalCount * selectedPackage.pricePerAdditional;
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
      if (addOn) {
        total += addOn.price * quantity;
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedPackage) {
      alert('Please select a package');
      return;
    }
    
    // Validate card details if using Authorize.Net
    if (bookingData.paymentMethod === 'card' && useAuthorizeNet) {
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
      // Calculate duration in hours or days (convert days to hours if needed)
      const durationValue = selectedPackage.duration ? Number(selectedPackage.duration) : 2;
      const durationUnit = selectedPackage.durationUnit || 'hours';
      // Convert days to hours for the API (API only accepts minutes or hours)
      let finalDuration = durationValue;
      let finalDurationUnit: 'minutes' | 'hours' = 'hours';
      
      if (durationUnit.toLowerCase() === 'days') {
        finalDuration = durationValue * 24;
        finalDurationUnit = 'hours';
      } else if (durationUnit.toLowerCase() === 'minutes') {
        finalDuration = durationValue;
        finalDurationUnit = 'minutes';
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
      const additionalAttractions = bookingData.selectedAttractions
        .filter(({ quantity }) => quantity > 0)
        .map(({ id, quantity }) => {
          const attraction = selectedPackage?.attractions?.find(a => a.id === Number(id));
          const numId = typeof id === 'number' ? id : parseInt(id, 10);
          
          if (isNaN(numId) || !attraction) {
            console.warn(`⚠️ Invalid attraction ID or not found: ${id}`);
            return null;
          }
          
          // Calculate price based on pricing type
          const priceAtBooking = attraction.pricingType === 'per_person'
            ? attraction.price * quantity * bookingData.participants
            : attraction.price * quantity;
          
          return {
            attraction_id: numId,
            quantity: quantity,
            price_at_booking: Number(priceAtBooking.toFixed(2))
          };
        })
        .filter((item): item is { attraction_id: number; quantity: number; price_at_booking: number } => item !== null);
      
      // Prepare add-ons data with quantity and price_at_booking
      const additionalAddons = bookingData.selectedAddOns
        .filter(({ quantity }) => quantity > 0)
        .map(({ id, name, quantity }) => {
          const addonId = id || selectedPackage.addOns.find(a => a.name === name)?.id;
          const addOn = selectedPackage.addOns.find(a => a.name === name);
          
          if (!addonId || !addOn) {
            console.warn(`⚠️ Add-on not found or missing ID: ${name}`);
            return null;
          }
          
          const priceAtBooking = addOn.price * quantity;
          
          return {
            addon_id: addonId,
            quantity: quantity,
            price_at_booking: Number(priceAtBooking.toFixed(2))
          };
        })
        .filter((item): item is { addon_id: number; quantity: number; price_at_booking: number } => item !== null);
      
      // Calculate amount paid based on payment type
      const totalAmount = calculateTotal();
      const partialAmount = calculatePartialAmount();
      const amountPaid = bookingData.paymentType === 'partial' && partialAmount > 0 
        ? partialAmount 
        : totalAmount;
      
      // Create booking data matching Laravel BookingController validation
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
        payment_method: bookingData.paymentMethod as 'cash' | 'card',
        payment_status: bookingData.paymentType === 'partial' && partialAmount > 0 ? 'partial' as const : 'paid' as const,
        status: bookingData.paymentType === 'partial' && partialAmount > 0 ? 'pending' as const : 'confirmed' as const,
        promo_id: promoId,
        gift_card_id: giftCardId,
        notes: bookingData.notes || undefined,
        additional_attractions: additionalAttractions.length > 0 ? additionalAttractions : undefined,
        additional_addons: additionalAddons.length > 0 ? additionalAddons : undefined,
      };
      
      console.log('📤 Sending on-site booking request:', bookingData_request);
      console.log('🎟️ Additional attractions:', additionalAttractions);
      console.log('➕ Additional add-ons:', additionalAddons);
      
      // Step 1: Process card payment if using Authorize.Net
      if (bookingData.paymentMethod === 'card' && useAuthorizeNet) {
        try {
          setIsProcessingPayment(true);
          setPaymentError('');
          
          // Load Accept.js library
          await loadAcceptJS(authorizeEnvironment);
          
          // Process payment
        const paymentResult = await processCardPayment(
          {
            cardNumber: cardNumber.replace(/\s/g, ''),
            month: cardMonth,
            year: cardYear,
            cardCode: cardCVV
          },
          {
            location_id: 1,
            amount: amountPaid
          },
          authorizeApiLoginId
        );          if (!paymentResult.success) {
            setPaymentError(paymentResult.message || 'Payment processing failed');
            setIsProcessingPayment(false);
            return;
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
      }
      
      // Step 2: Create booking via API (backend handles time slot creation)
      const response = await bookingService.createBooking(bookingData_request);
      
      if (response.success && response.data) {
        const bookingId = response.data.id;
        const referenceNumber = response.data.reference_number;
        
        console.log('✅ Booking created:', { bookingId, referenceNumber });
        
        // Step 3: Generate QR code with the actual reference number
        const qrCodeBase64 = await QRCode.toDataURL(referenceNumber, {
          width: 300,
          margin: 2,
          color: { dark: '#000000', light: '#FFFFFF' }
        });
        
        console.log('📱 QR Code generated for reference:', referenceNumber);
        
        // Step 4: Store QR code via separate API call
        try {
          const qrResponse = await bookingService.storeQrCode(bookingId, qrCodeBase64);
          console.log('✅ QR code stored:', qrResponse);
        } catch (qrError) {
          console.error('⚠️ Failed to store QR code, but booking was created:', qrError);
          // Don't fail the entire process if QR storage fails
        }
        
        // Navigate to success page
        navigate('/bookings', { 
          state: { 
            message: 'On-site booking created successfully!',
            bookingId: bookingId,
            referenceNumber: referenceNumber
          } 
        });
      }
    } catch (err) {
      console.error('❌ Error creating booking:', err);
      alert('Failed to create booking. Please try again.');
    }
  };

  // Live Summary Component - visible on all steps
  const renderLiveSummary = () => {
    const total = calculateTotal();
    const partialAmount = calculatePartialAmount();
    
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
                    src={ASSET_URL + selectedPackage.image} 
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
          {(bookingData.date || bookingData.time || selectedRoom || bookingData.participants > 0) && (
            <div className="pb-4 border-b border-gray-200">
              <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Details</h4>
              <div className="space-y-2 text-sm">
                {bookingData.date && (
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-900">
                      {new Date(bookingData.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  </div>
                )}
                {bookingData.time && (
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-900">{bookingData.time}</span>
                  </div>
                )}
                {selectedRoom && (
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"></path>
                    </svg>
                    <span className="text-gray-900">{selectedRoom}</span>
                  </div>
                )}
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
              <div className="space-y-1.5">
                {bookingData.selectedAttractions.map(({ id, quantity }) => {
                  const attraction = selectedPackage?.attractions?.find(a => a.id === Number(id));
                  if (!attraction) return null;
                  const price = attraction.price * quantity * (attraction.pricingType === 'per_person' ? bookingData.participants : 1);
                  return (
                    <div key={id} className="flex justify-between items-start text-sm">
                      <div className="flex-1 min-w-0">
                        <p className="text-gray-900 truncate">{attraction.name}</p>
                        <p className="text-xs text-gray-500">Qty: {quantity}</p>
                      </div>
                      <span className="font-medium text-gray-900 ml-2">${price.toFixed(2)}</span>
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
              <div className="space-y-1.5">
                {bookingData.selectedAddOns.map(({ name, quantity }) => {
                  const addOn = selectedPackage?.addOns.find(a => a.name === name);
                  if (!addOn) return null;
                  const price = addOn.price * quantity;
                  return (
                    <div key={name} className="flex justify-between items-start text-sm">
                      <div className="flex-1 min-w-0">
                        <p className="text-gray-900 truncate">{name}</p>
                        <p className="text-xs text-gray-500">Qty: {quantity}</p>
                      </div>
                      <span className="font-medium text-gray-900 ml-2">${price.toFixed(2)}</span>
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
          
          {/* Total */}
          {selectedPackage && (
            <div className="pt-2">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-gray-600">Subtotal</span>
                <span className="text-sm font-semibold text-gray-900">${total.toFixed(2)}</span>
              </div>
              
              {bookingData.paymentType === 'partial' && partialAmount > 0 && (
                <div className={`flex justify-between items-center pt-2 mt-2 border-t border-dashed border-gray-300`}>
                  <span className={`text-sm font-semibold text-${themeColor}-700`}>Due Now</span>
                  <span className={`text-lg font-bold text-${fullColor}`}>${partialAmount.toFixed(2)}</span>
                </div>
              )}
              
              {bookingData.paymentType !== 'partial' && (
                <div className="flex justify-between items-center pt-2 mt-2 border-t border-gray-300">
                  <span className="font-semibold text-gray-900">Total</span>
                  <span className={`text-xl font-bold text-${fullColor}`}>${total.toFixed(2)}</span>
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
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
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
            
            {!loadingPackages && packages.length === 0 && !searchQuery && (
              <div className="text-center text-gray-500 py-12">
                <p className="mb-4 text-lg">No packages available. Please create packages.</p>
                <Link to="/packages/create"
                  className={`inline-flex items-center bg-${fullColor} hover:bg-${themeColor}-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors`}
                >
                  Create Package
                </Link>
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
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Select Room, Date & Time</h2>
      
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-6">
        {/* Room Selection */}
        {selectedPackage?.rooms && selectedPackage.rooms.length > 0 && (
          <div>
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center">
              <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"></path>
              </svg>
              Room Selection
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {selectedPackage.rooms.map((r) => {
                const room = r as OnsiteBookingRoom;
                const isSelected = room.id ? selectedRoomId === room.id : selectedRoom === room.name;
                return (
                  <label 
                    key={room.id || room.name} 
                    className={`flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                      isSelected 
                        ? `border-${themeColor}-500 bg-${themeColor}-50 shadow-sm` 
                        : `border-gray-200 hover:border-${themeColor}-300 hover:bg-gray-50`
                    }`}
                  >
                    <input
                      type="radio"
                      name="roomSelection"
                      value={room.id?.toString() || room.name}
                      checked={isSelected}
                      onChange={() => {
                        if (room.id) {
                          setSelectedRoomId(room.id);
                          setSelectedRoom(room.name);
                        } else {
                          setSelectedRoom(room.name);
                        }
                      }}
                      className={`accent-${fullColor} w-4 h-4`}
                    />
                    <div className="flex-1">
                      <span className="font-medium text-gray-900 text-sm">{room.name}</span>
                      {room.capacity && (
                        <p className="text-xs text-gray-500 mt-0.5">Capacity: {room.capacity}</p>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        )}


        {/* Date and Time Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Date Selection */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-3 flex items-center">
              <Calendar className="w-4 h-4 mr-2" />
              Select Date
            </label>
            <select
              name="date"
              value={bookingData.date}
              onChange={handleInputChange}
              className={`w-full border-2 border-gray-200 rounded-lg px-4 py-3 focus:ring-2 focus:ring-${themeColor}-400 focus:border-${themeColor}-500 transition-colors`}
              required
            >
              {availableDates.map(date => (
                <option key={date.toISOString()} value={date.toISOString().split('T')[0]}>
                  {date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                </option>
              ))}
            </select>
          </div>

          {/* Participants */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-3 flex items-center">
              <Users className="w-4 h-4 mr-2" />
              Number of Participants
            </label>
            <input
              type="number"
              name="participants"
              min="1"
              value={bookingData.participants}
              onChange={handleInputChange}
              className={`w-full border-2 border-gray-200 rounded-lg px-4 py-3 focus:ring-2 focus:ring-${themeColor}-400 focus:border-${themeColor}-500 transition-colors`}
              required
            />
            {selectedPackage && bookingData.participants > selectedPackage.maxParticipants && selectedPackage.pricePerAdditional && (
              <div className={`mt-3 text-xs bg-amber-50 border border-amber-200 text-amber-800 rounded-lg p-3`}>
                <strong>Note:</strong> Additional participants beyond {selectedPackage.maxParticipants} will be charged <strong>${selectedPackage.pricePerAdditional}</strong> each.
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
          {selectedPackage?.rooms && selectedPackage.rooms.length > 0 && !selectedRoom ? (
            <div className="text-sm text-gray-500 bg-gray-50 rounded-lg p-4 text-center">
              Please select a room first to see available time slots
            </div>
          ) : loadingTimeSlots ? (
            <div className="flex items-center justify-center p-8 bg-gray-50 rounded-lg">
              <div className={`animate-spin rounded-full h-8 w-8 border-b-2 border-${fullColor}`}></div>
              <span className="ml-3 text-sm text-gray-600">Loading available time slots...</span>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {availableTimeSlots.length > 0 ? (
                availableTimeSlots.map((slot) => (
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
                        disabled={!selectedRoomId}
                      />
                      <span className="font-semibold text-sm text-gray-900">{formatTimeTo12Hour(slot.start_time)}</span>
                    </div>
                    <span className="text-xs text-gray-500 ml-6">to {formatTimeTo12Hour(slot.end_time)}</span>
                  </label>
                ))
              ) : (
                <div className="col-span-full text-sm text-gray-500 bg-gray-50 rounded-lg p-4 text-center">
                  {!selectedRoomId ? 'Select a room first' : 'No available time slots for this room on the selected date'}
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
        <button
          type="button"
          onClick={() => setStep(1)}
          className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
        >
          Back to Packages
        </button>
        <button
          type="button"
          onClick={() => setStep(3)}
          className={`flex-2 px-8 py-3 rounded-lg font-semibold transition-colors ${
            selectedPackage?.rooms && selectedPackage.rooms.length > 0 && !selectedRoom
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : `bg-${fullColor} text-white hover:bg-${themeColor}-700 shadow-sm`
          }`}
          disabled={selectedPackage?.rooms && selectedPackage.rooms.length > 0 && !selectedRoom}
        >
          Continue to Attractions & Add-ons
        </button>
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
                      src={attraction.image} 
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
                  <button
                    type="button"
                    onClick={() => handleAttractionToggle(String(attraction.id))}
                    className={`ml-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isSelected
                        ? 'bg-red-100 text-red-700 hover:bg-red-200'
                        : `bg-${themeColor}-100 text-${themeColor}-700 hover:bg-${themeColor}-200`
                    }`}
                  >
                    {isSelected ? 'Remove' : 'Add'}
                  </button>
                </div>
                
                {isSelected && (
                  <div className={`mt-3 pt-3 border-t border-${themeColor}-200 flex items-center justify-between`}>
                    <span className="text-sm font-medium text-gray-700">Quantity:</span>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => handleAttractionQuantityChange(String(attraction.id), selectedQty - 1)}
                        className={`p-2 rounded-lg bg-white border-2 border-gray-300 hover:border-${themeColor}-400 transition-colors`}
                      >
                        <Minus size={16} className="text-gray-600" />
                      </button>
                      <span className="font-bold text-lg text-gray-900 w-8 text-center">{selectedQty}</span>
                      <button
                        type="button"
                        onClick={() => handleAttractionQuantityChange(String(attraction.id), selectedQty + 1)}
                        className={`p-2 rounded-lg bg-white border-2 border-gray-300 hover:border-${themeColor}-400 transition-colors`}
                      >
                        <Plus size={16} className="text-gray-600" />
                      </button>
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
            {selectedPackage.addOns.map(addOn => {
              const isSelected = bookingData.selectedAddOns.some(a => a.name === addOn.name);
              const selectedQty = bookingData.selectedAddOns.find(a => a.name === addOn.name)?.quantity || 0;
              return (
                <div
                  key={addOn.name}
                  className={`border-2 rounded-lg p-4 flex gap-4 transition-all ${
                    isSelected 
                      ? `border-${themeColor}-500 bg-${themeColor}-50 shadow-sm` 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {/* Add-on Image */}
                  <div className="w-20 h-20 flex-shrink-0 flex items-center justify-center bg-gray-100 rounded-lg border-2 border-gray-200 overflow-hidden">
                    {addOn.image ? (
                      <img src={addOn.image} alt={addOn.name} className="object-cover w-full h-full" />
                    ) : (
                      <span className="text-gray-400 text-xs">No Image</span>
                    )}
                  </div>
                  <div className="flex-1 flex flex-col justify-between">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-900">{addOn.name}</h4>
                        <p className={`text-lg font-bold text-${fullColor} mt-1`}>${addOn.price}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleAddOnToggle(addOn.name)}
                        className={`ml-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                          isSelected
                            ? 'bg-red-100 text-red-700 hover:bg-red-200'
                            : `bg-${themeColor}-100 text-${themeColor}-700 hover:bg-${themeColor}-200`
                        }`}
                      >
                        {isSelected ? 'Remove' : 'Add'}
                      </button>
                    </div>
                    {isSelected && (
                      <div className={`mt-3 pt-3 border-t border-${themeColor}-200 flex items-center justify-between`}>
                        <span className="text-sm font-medium text-gray-700">Quantity:</span>
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => handleAddOnQuantityChange(addOn.name, selectedQty - 1)}
                            className={`p-2 rounded-lg bg-white border-2 border-gray-300 hover:border-${themeColor}-400 transition-colors`}
                          >
                            <Minus size={16} className="text-gray-600" />
                          </button>
                          <span className="font-bold text-lg text-gray-900 w-8 text-center">{selectedQty}</span>
                          <button
                            type="button"
                            onClick={() => handleAddOnQuantityChange(addOn.name, selectedQty + 1)}
                            className={`p-2 rounded-lg bg-white border-2 border-gray-300 hover:border-${themeColor}-400 transition-colors`}
                          >
                            <Plus size={16} className="text-gray-600" />
                          </button>
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
        <button
          type="button"
          onClick={() => setStep(2)}
          className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
        >
          Back to Date & Time
        </button>
        <button
          type="button"
          onClick={() => setStep(4)}
          className={`flex-2 px-8 py-3 rounded-lg font-semibold transition-colors bg-${fullColor} text-white hover:bg-${themeColor}-700 shadow-sm`}
        >
          Continue to Customer Details
        </button>
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
      </div>
      
      <div className="flex gap-3 pt-4">
        <button
          type="button"
          onClick={() => setStep(3)}
          className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
        >
          Back
        </button>
        <button
          type="button"
          onClick={() => setStep(5)}
          className={`flex-2 px-8 py-3 rounded-lg font-semibold transition-colors bg-${fullColor} text-white hover:bg-${themeColor}-700 shadow-sm`}
        >
          Continue to Payment
        </button>
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
                    src={ASSET_URL + selectedPackage.image} 
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
                  {new Date(bookingData.date).toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Time:</span>
                <span className="font-medium text-gray-900">{bookingData.time}</span>
              </div>
              {selectedRoom && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Room:</span>
                  <span className="font-medium text-gray-900">{selectedRoom}</span>
                </div>
              )}
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
                  const price = addOn ? addOn.price * quantity : 0;
                  return (
                    <div key={name} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3 flex-1">
                        {addOn?.image && (
                          <img src={addOn.image} alt={addOn.name} className="w-10 h-10 object-cover rounded border" />
                        )}
                        <div>
                          <p className="font-medium text-gray-900 text-sm">{name}</p>
                          <p className="text-xs text-gray-600">Quantity: {quantity} × ${addOn?.price}</p>
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
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setBookingData(prev => ({ ...prev, paymentMethod: 'cash' }))}
                className={`p-3 border rounded-lg text-center transition-colors ${
                  bookingData.paymentMethod === 'cash'
                    ? `border-${themeColor}-500 bg-${themeColor}-50 text-${themeColor}-700`
                    : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                <DollarSign className="h-5 w-5 mx-auto mb-1" />
                <span className="text-sm font-medium">Cash</span>
              </button>
              
              <button
                type="button"
                onClick={() => setBookingData(prev => ({ ...prev, paymentMethod: 'card' }))}
                className={`p-3 border rounded-lg text-center transition-colors ${
                  bookingData.paymentMethod === 'card'
                    ? `border-${themeColor}-500 bg-${themeColor}-50 text-${themeColor}-700`
                    : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                <CreditCard className="h-5 w-5 mx-auto mb-1" />
                <span className="text-sm font-medium">Card</span>
              </button>
            </div>
          </div>
      
      {/* Card Payment Options - Show only when card is selected */}
      {bookingData.paymentMethod === 'card' && (
        <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div className="mb-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Card Payment Type</h3>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setUseAuthorizeNet(false)}
                className={`flex-1 px-3 py-2 text-xs rounded-lg border transition-colors ${!useAuthorizeNet ? `border-${themeColor}-500 bg-${themeColor}-50 text-${themeColor}-700 font-medium` : 'border-gray-300 text-gray-600 hover:border-gray-400'}`}
              >
                Manual Card
              </button>
              <button
                type="button"
                onClick={() => setUseAuthorizeNet(true)}
                className={`flex-1 px-3 py-2 text-xs rounded-lg border transition-colors ${useAuthorizeNet ? `border-${themeColor}-500 bg-${themeColor}-50 text-${themeColor}-700 font-medium` : 'border-gray-300 text-gray-600 hover:border-gray-400'}`}
              >
                Process with Authorize.Net
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {useAuthorizeNet ? 'Process payment online with Authorize.Net' : 'Customer paid by card - no online processing'}
            </p>
          </div>
          
          {useAuthorizeNet && (
            <>
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
            </>
          )}
        </div>
      )}
      
      {/* Payment Type Selection */}
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
              className={`mt-1 accent-${fullColor}`}
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
                className={`mt-1 accent-${fullColor}`}
              />
              <div className="flex-1">
                <div className="font-medium text-sm text-gray-900">Partial Payment</div>
                <div className="text-xs text-gray-600 mt-1">
                  Pay ${calculatePartialAmount().toFixed(2)} now, remaining ${(calculateTotal() - calculatePartialAmount()).toFixed(2)} later
                </div>
              </div>
            </label>
          )}
        </div>
      </div>
      
      {/* Pricing Breakdown */}
      <div className="border-t border-gray-200 pt-4 mb-6">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Package Price</span>
            <span className="font-medium">${selectedPackage?.price.toFixed(2)}</span>
          </div>
          {selectedPackage && bookingData.participants > selectedPackage.maxParticipants && selectedPackage.pricePerAdditional && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Additional Participants ({bookingData.participants - selectedPackage.maxParticipants})</span>
              <span className="font-medium">${((bookingData.participants - selectedPackage.maxParticipants) * selectedPackage.pricePerAdditional).toFixed(2)}</span>
            </div>
          )}
          {bookingData.selectedAttractions.length > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Attractions</span>
              <span className="font-medium">
                ${bookingData.selectedAttractions.reduce((sum, { id, quantity }) => {
                  const attraction = selectedPackage?.attractions?.find(a => String(a.id) === id);
                  return sum + (attraction ? attraction.price * quantity * (attraction.pricingType === 'per_person' ? bookingData.participants : 1) : 0);
                }, 0).toFixed(2)}
              </span>
            </div>
          )}
          {bookingData.selectedAddOns.length > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Add-ons</span>
              <span className="font-medium">
                ${bookingData.selectedAddOns.reduce((sum, { name, quantity }) => {
                  const addOn = selectedPackage?.addOns.find(a => a.name === name);
                  return sum + (addOn ? addOn.price * quantity : 0);
                }, 0).toFixed(2)}
              </span>
            </div>
          )}
        </div>
        
        <div className="flex justify-between font-bold text-lg mt-4 pt-4 border-t border-gray-200">
          <span>Total</span>
          <span>${calculateTotal().toFixed(2)}</span>
        </div>
        
        {bookingData.paymentType === 'partial' && calculatePartialAmount() > 0 && (
          <div className={`flex justify-between font-semibold text-md mt-2 pt-2 border-t border-dashed border-gray-300 text-${themeColor}-700`}>
            <span>Amount Due Now</span>
            <span>${calculatePartialAmount().toFixed(2)}</span>
          </div>
        )}
      </div>
      
      {/* Action Buttons */}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => setStep(4)}
          className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
        >
          Back
        </button>
        <button
          type="submit"
          disabled={!isBookingValid() || isProcessingPayment}
          className={`flex-2 px-6 py-3 rounded-lg font-semibold transition-colors flex items-center justify-center ${
            !isBookingValid() || isProcessingPayment
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : `bg-${themeColor}-600 text-white hover:bg-${themeColor}-700`
          }`}
        >
          {isProcessingPayment ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Processing...
            </>
          ) : (
            <>
              <CreditCard className="h-5 w-5 mr-2" />
              Confirm Booking
            </>
          )}
        </button>
      </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* No Authorize.Net Account Modal */}
      {showNoAuthAccountModal && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center p-4 z-[9999] animate-backdrop-fade">
          <div className="bg-white rounded-xl max-w-md w-full p-6 border-4 border-yellow-400 shadow-2xl animate-scale-in">
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
              
              <button
                onClick={() => setShowNoAuthAccountModal(false)}
                className={`w-full px-6 py-3 bg-${fullColor} text-white rounded-lg hover:bg-${fullColor} font-semibold shadow-lg`}
              >
                I Understand
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="py-8">
      {/* Header */}
      <div className="flex items-center mb-8 px-1">
        <h1 className="text-3xl font-bold text-gray-900 ml-4">On-site Booking</h1>
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
    </>
  );
};

export default OnsiteBooking;