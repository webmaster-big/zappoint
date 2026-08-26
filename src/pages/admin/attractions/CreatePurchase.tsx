import React, { useState, useEffect, useRef } from 'react';
import { 
  ShoppingCart, 
  CreditCard, 
  DollarSign,
  Plus,
  Minus,
  Search,
  X,
  Pencil,
  Tag,
  Calendar,
  Banknote,
  Mail
} from 'lucide-react';
import { formatDurationDisplay } from '../../../utils/timeFormat';
import { useThemeColor } from '../../../hooks/useThemeColor';
import type { CreatePurchaseAttraction, CreatePurchaseCustomerInfo, CreatePurchaseAddOn } from '../../../types/CreatePurchase.types';
import { attractionService, type Attraction } from '../../../services/AttractionService';
import { attractionCacheService } from '../../../services/AttractionCacheService';
import { attractionPurchaseService } from '../../../services/AttractionPurchaseService';
import { attractionPurchaseCacheService } from '../../../services/AttractionPurchaseCacheService';
import { metricsCacheService } from '../../../services/MetricsCacheService';
import { customerService, type Customer } from '../../../services/CustomerService';
import { useLocationScope } from '../../../contexts/LocationContext';
import Toast from '../../../components/ui/Toast';
import EmptyStateModal from '../../../components/ui/EmptyStateModal';
import { ASSET_URL, getStoredUser } from '../../../utils/storage';
import { loadAcceptJS, processCardPayment, validateCardNumber, isTestCardNumber, formatCardNumber, getCardType, createPayment, PAYMENT_TYPE } from '../../../services/PaymentService';
import { getAuthorizeNetPublicKey } from '../../../services/SettingsService';
import { generatePurchaseQRCode } from '../../../utils/qrcode';
import StandardButton from '../../../components/ui/StandardButton';
import { feeSupportService } from '../../../services/FeeSupportService';
import type { FeeBreakdown } from '../../../types/FeeSupport.types';
import PriceBreakdownDisplay from '../../../components/ui/PriceBreakdownDisplay';
import { specialPricingService } from '../../../services/SpecialPricingService';
import type { SpecialPricingBreakdown } from '../../../types/SpecialPricing.types';
import { dayOffService, type DayOff } from '../../../services/DayOffService';
import { useNavigate, useSearchParams } from 'react-router-dom';
import ScheduleCalendar from '../../../components/ui/ScheduleCalendar';
import { convertTo12Hour } from '../../../utils/timeFormat';
import ticketOrderService, { type CartItem, type CartQuote } from '../../../services/TicketOrderService';
import { generateOrderQRCode } from '../../../utils/qrcode';
import { eventService } from '../../../services/EventService';
import CustomFieldChecks from '../../../components/customer/CustomFieldChecks';
import customFieldService, {
  pruneCustomFieldAnswers,
  firstMissingRequired,
  toCustomFieldPayload,
  type ApplicableCustomField,
} from '../../../services/CustomFieldService';
import type { Event as ZapEvent } from '../../../types/event.types';
import { buildAppliedFees } from '../../../utils/fees';
import { buildAppliedDiscounts } from '../../../utils/discounts';
import { generateTimeSlots } from '../../../utils/timeSlots';

const CreatePurchase = () => {
  const { themeColor } = useThemeColor();

  const [attractions, setAttractions] = useState<CreatePurchaseAttraction[]>([]);
  const [filteredAttractions, setFilteredAttractions] = useState<CreatePurchaseAttraction[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAttraction, setSelectedAttraction] = useState<CreatePurchaseAttraction | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [customerInfo, setCustomerInfo] = useState<CreatePurchaseCustomerInfo>({
    name: '',
    email: '',
    phone: ''
  });
  const [paymentMethod, setPaymentMethod] = useState('authorize.net');
  const [discount, setDiscount] = useState(0);
  const [notes, setNotes] = useState('');
  const [amountPaid, setAmountPaid] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [foundCustomers, setFoundCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [searchingCustomer, setSearchingCustomer] = useState(false);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  
  const [cardNumber, setCardNumber] = useState('');
  const [cardMonth, setCardMonth] = useState('');
  const [cardYear, setCardYear] = useState('');
  const [cardCVV, setCardCVV] = useState('');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [authorizeApiLoginId, setAuthorizeApiLoginId] = useState('');
  const [authorizeClientKey, setAuthorizeClientKey] = useState('');
  const [_authorizeEnvironment, setAuthorizeEnvironment] = useState<'sandbox' | 'production'>('sandbox');
  const [showNoAuthAccountModal, setShowNoAuthAccountModal] = useState(false);
  const [showEmptyModal, setShowEmptyModal] = useState(false);
  const [sendEmail, setSendEmail] = useState(true);
  const [feeBreakdown, setFeeBreakdown] = useState<FeeBreakdown | null>(null);
  const [specialPricingBreakdown, setSpecialPricingBreakdown] = useState<SpecialPricingBreakdown | null>(null);
  
  const [scheduledDate, setScheduledDate] = useState<string>('');
  const [scheduledTime, setScheduledTime] = useState<string>('');
  const [availableTimeSlots, setAvailableTimeSlots] = useState<string[]>([]);
  const [slotRemaining, setSlotRemaining] = useState<Record<string, number> | null>(null);
  const [dayOffDates, setDayOffDates] = useState<Set<string>>(new Set());
  
  const [selectedAddOns, setSelectedAddOns] = useState<{ [id: number]: number }>({});
  const [orderLines, setOrderLines] = useState<CartItem[]>([]);
  const [orderQuote, setOrderQuote] = useState<CartQuote | null>(null);
  const [eventsCatalog, setEventsCatalog] = useState<ZapEvent[]>([]);
  const [eventsCatalogLocation, setEventsCatalogLocation] = useState<number | null>(null);
  const [eventDate, setEventDate] = useState('');
  const [eventTime, setEventTime] = useState('');
  const [eventSlots, setEventSlots] = useState<string[]>([]);
  const [eventSlotsLeft, setEventSlotsLeft] = useState<Record<string, number> | null>(null);
  const [showAddOnDetailsModal, setShowAddOnDetailsModal] = useState(false);
  const [selectedAddOnForDetails, setSelectedAddOnForDetails] = useState<CreatePurchaseAddOn | null>(null);
  
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [bulkMode, setBulkMode] = useState(searchParams.get('bulk') === '1');
  const [itemTab, setItemTab] = useState<'attractions' | 'events'>('attractions');
  const [customFields, setCustomFields] = useState<ApplicableCustomField[]>([]);
  const [customFieldAnswers, setCustomFieldAnswers] = useState<Record<number, boolean>>({});
  const [customFieldsUnavailable, setCustomFieldsUnavailable] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<ZapEvent | null>(null);
  const [eventQty, setEventQty] = useState(1);
  const { effectiveLocationId } = useLocationScope();
  const selectedLocation = effectiveLocationId;

  useEffect(() => {
    const loadAttractions = async () => {
      try {
        setLoading(true);
        
        const cachedAttractions = await attractionCacheService.getCachedAttractions();
        
        if (cachedAttractions && cachedAttractions.length > 0) {
          const filteredCached = cachedAttractions.filter((attr: Attraction) => {
            if (!attr.is_active) return false;
            if (selectedLocation !== null && attr.location_id !== selectedLocation) return false;
            return true;
          });
          
          const convertedAttractions: CreatePurchaseAttraction[] = filteredCached.map((attr: Attraction & { location?: { id: number; name: string } }) => ({
            id: attr.id.toString(),
            name: attr.name,
            description: attr.description,
            category: attr.category,
            price: attr.price,
            pricingType: attr.pricing_type,
            maxCapacity: attr.max_capacity,
            duration: attr.duration?.toString() || '',
            durationUnit: attr.duration_unit || 'minutes',
            location: attr.location?.name || '',
            locationId: attr.location?.id || attr.location_id,
            images: attr.image ? (Array.isArray(attr.image) ? attr.image : [attr.image]) : [],
            status: attr.is_active ? 'active' : 'inactive',
            createdAt: attr.created_at,
            availability: (attr.availability || {}) as CreatePurchaseAttraction['availability'],
            addOns: (attr as any).add_ons?.map((a: any) => ({
              id: a.id,
              name: a.name,
              price: Number(a.price),
              description: a.description,
              image: a.image,
              is_active: a.is_active,
              min_quantity: a.min_quantity,
              max_quantity: a.max_quantity,
            })) || [],
            addOnsOrder: (attr as any).add_ons_order || [],
          }));
          
          setAttractions(convertedAttractions);
          setFilteredAttractions(convertedAttractions);
          
          if (convertedAttractions.length === 0) {
            setShowEmptyModal(true);
          }
          setLoading(false);
          attractionCacheService.syncInBackground({ user_id: getStoredUser()?.id });
          return;
        }
        
        const params: any = {
          is_active: true,
          per_page: 100,
          user_id: getStoredUser()?.id
        };
        if (selectedLocation !== null) {
          params.location_id = selectedLocation;
        }
        const response = await attractionService.getAttractions(params);
        
        await attractionCacheService.cacheAttractions(response.data.attractions);
        
        const convertedAttractions: CreatePurchaseAttraction[] = response.data.attractions.map((attr: Attraction & { location?: { id: number; name: string } }) => ({
          id: attr.id.toString(),
          name: attr.name,
          description: attr.description,
          category: attr.category,
          price: attr.price,
          pricingType: attr.pricing_type,
          maxCapacity: attr.max_capacity,
          duration: attr.duration?.toString() || '',
          durationUnit: attr.duration_unit || 'minutes',
          location: attr.location?.name || '',
          locationId: attr.location?.id || attr.location_id, // Store location_id from API
          images: attr.image ? (Array.isArray(attr.image) ? attr.image : [attr.image]) : [],
          status: attr.is_active ? 'active' : 'inactive',
          createdAt: attr.created_at,
          availability: (attr.availability || {}) as CreatePurchaseAttraction['availability'],
          addOns: (attr as any).add_ons?.map((a: any) => ({
            id: a.id,
            name: a.name,
            price: Number(a.price),
            description: a.description,
            image: a.image,
            is_active: a.is_active,
            min_quantity: a.min_quantity,
            max_quantity: a.max_quantity,
          })) || [],
          addOnsOrder: (attr as any).add_ons_order || [],
        }));
        
        setAttractions(convertedAttractions);
        setFilteredAttractions(convertedAttractions);
        
        if (convertedAttractions.length === 0) {
          setShowEmptyModal(true);
        }
      } catch {
        setToast({ message: 'Failed to load attractions', type: 'error' });
        setShowEmptyModal(true);
      } finally {
        setLoading(false);
      }
    };

    loadAttractions();
  }, [selectedLocation]);

  useEffect(() => {
    if (searchTerm) {
      const filtered = attractions.filter(attraction =>
        attraction.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        attraction.category.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredAttractions(filtered);
    } else {
      setFilteredAttractions(attractions);
    }
  }, [searchTerm, attractions]);

  useEffect(() => {
    const searchCustomer = async () => {
      const email = customerInfo.email.trim();
      
      if (!email || email.length < 3) {
        setFoundCustomers([]);
        setShowCustomerDropdown(false);
        setSelectedCustomerId(null);
        return;
      }

      try {
        setSearchingCustomer(true);
        const response = await customerService.searchCustomers(email);
        setFoundCustomers(response.data);
        setShowCustomerDropdown(response.data.length > 0);
        
        const exactMatch = response.data.find(c => c.email.toLowerCase() === email.toLowerCase());
        if (exactMatch) {
          setSelectedCustomerId(exactMatch.id);
          setCustomerInfo(prev => ({
            ...prev,
            name: `${exactMatch.first_name} ${exactMatch.last_name}`,
            phone: exactMatch.phone || prev.phone,
          }));
        } else {
          setSelectedCustomerId(null);
        }
      } catch {
        setFoundCustomers([]);
        setShowCustomerDropdown(false);
        setSelectedCustomerId(null);
      } finally {
        setSearchingCustomer(false);
      }
    };

    const timeoutId = setTimeout(searchCustomer, 500);
    return () => clearTimeout(timeoutId);
  }, [customerInfo.email]);

  useEffect(() => {
    if (paymentMethod !== 'authorize.net') {
      return;
    }

    const gatewayLocationId = orderLines[0]?.locationId
      ?? selectedAttraction?.locationId
      ?? (selectedEvent ? Number(selectedEvent.location_id) : null)
      ?? selectedLocation
      ?? null;

    if (!gatewayLocationId) {
      return;
    }

    const initializeAuthorizeNet = async () => {
      try {
        const response = await getAuthorizeNetPublicKey(gatewayLocationId);
        if (response && response.api_login_id) {
          setAuthorizeApiLoginId(response.api_login_id);
          setAuthorizeClientKey(response.client_key || response.api_login_id);
          setAuthorizeEnvironment((response.environment || 'sandbox') as 'sandbox' | 'production');
          setShowNoAuthAccountModal(false);
          
          await loadAcceptJS((response.environment || 'sandbox') as 'sandbox' | 'production');
        } else {
          setShowNoAuthAccountModal(true);
        }
      } catch (error: any) {
        if (error.response?.data?.message?.includes('No active Authorize.Net account')) {
          setShowNoAuthAccountModal(true);
        }
      }
    };
    initializeAuthorizeNet();
  }, [selectedAttraction, selectedEvent, orderLines, selectedLocation, paymentMethod]);

  const handleCustomerInfoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setCustomerInfo(prev => ({
      ...prev,
      [name]: value
    }));
    
    if (name === 'email') {
      setSelectedCustomerId(null);
    }
  };

  const handleSelectCustomer = (customer: Customer) => {
    setSelectedCustomerId(customer.id);
    setCustomerInfo({
      name: `${customer.first_name} ${customer.last_name}`,
      email: customer.email,
      phone: customer.phone || '',
    });
    setShowCustomerDropdown(false);
  };

  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCardNumber(e.target.value);
    if (formatted.replace(/\s/g, '').length <= 16) {
      setCardNumber(formatted);
      setPaymentError('');
    }
  };

  const calculateSubtotal = () => {
    if (!selectedAttraction) return 0;
    return selectedAttraction.price * quantity;
  };

  const calculateAddOnsTotal = () => {
    if (!selectedAttraction || !selectedAttraction.addOns) return 0;
    return Object.entries(selectedAddOns).reduce((sum, [idStr, qty]) => {
      const addOn = selectedAttraction.addOns?.find(a => a.id === Number(idStr));
      return sum + (addOn ? addOn.price * qty : 0);
    }, 0);
  };

  const calculateTotal = () => {
    const subtotal = calculateSubtotal();
    const addOnsTotal = calculateAddOnsTotal();
    return Math.max(0, subtotal + addOnsTotal - discount);
  };

  const handleAddOnQty = (addOnId: number, qty: number) => {
    const addOn = selectedAttraction?.addOns?.find(a => a.id === addOnId);
    const minQty = 0;
    const maxQty = addOn?.max_quantity ?? 99;
    const clamped = Math.max(minQty, Math.min(maxQty, qty));
    setSelectedAddOns(prev => ({ ...prev, [addOnId]: clamped }));
  };
  
  const currentTotal = calculateTotal();
  const specialPricingDiscount = specialPricingBreakdown?.has_special_pricing ? specialPricingBreakdown.total_discount : 0;
  const totalAfterSpecialPricing = Math.max(0, currentTotal - specialPricingDiscount);
  const finalTotal = feeBreakdown ? feeBreakdown.total - specialPricingDiscount : totalAfterSpecialPricing;

  useEffect(() => {
    if (!selectedAttraction) {
      setFeeBreakdown(null);
      return;
    }
    const timeoutId = setTimeout(async () => {
      try {
        const basePrice = calculateTotal();
        const response = await feeSupportService.getForEntity({
          entity_type: 'attraction',
          entity_id: Number(selectedAttraction.id),
          base_price: basePrice,
          location_id: selectedAttraction.locationId || selectedLocation || undefined,
        });
        if (response.success && response.data) {
          setFeeBreakdown(response.data);
        }
      } catch (error) {
        console.error('Error fetching fee breakdown:', error);
        setFeeBreakdown(null);
      }
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [selectedAttraction, quantity, discount, selectedLocation, selectedAddOns]);

  useEffect(() => {
    if (!selectedAttraction) {
      setSpecialPricingBreakdown(null);
      return;
    }
    const timeoutId = setTimeout(async () => {
      try {
        const pricingDate = scheduledDate || (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })();
        const basePrice = selectedAttraction.price * quantity;
        const breakdown = await specialPricingService.getPriceBreakdown({
          entity_type: 'attraction',
          entity_id: Number(selectedAttraction.id),
          base_price: basePrice,
          date: pricingDate,
        });
        if (breakdown.has_special_pricing) {
          setSpecialPricingBreakdown(breakdown);
        } else {
          setSpecialPricingBreakdown(null);
        }
      } catch (error) {
        console.error('Error fetching special pricing breakdown:', error);
        setSpecialPricingBreakdown(null);
      }
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [selectedAttraction, quantity, scheduledDate]);

  const handleAddToCart = (attraction: CreatePurchaseAttraction) => {
    setSelectedAttraction(attraction);
    setQuantity(1);
    setDiscount(0);
    setScheduledDate('');
    setScheduledTime('');
    setSelectedAddOns({});
  };

  const dayNumberToName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  const getAttractionAvailability = (): Array<{ days: string[]; start_time: string; end_time: string }> => {
    if (!selectedAttraction) return [];
    const raw = selectedAttraction.availability;
    if (Array.isArray(raw)) return raw as Array<{ days: string[]; start_time: string; end_time: string }>;
    if (typeof raw === 'object' && raw !== null) {
      const enabledDays = Object.entries(raw).filter(([, v]) => v).map(([d]) => d.toLowerCase());
      if (enabledDays.length === 0) return [];
      return [{ days: enabledDays, start_time: '09:00', end_time: '17:00' }];
    }
    return [];
  };


  useEffect(() => {
    const fetchDayOffs = async () => {
      if (!selectedAttraction) {
        setDayOffDates(new Set());
        return;
      }
      const locationId = selectedAttraction.locationId || selectedLocation;
      if (!locationId) return;
      try {
        const response = await dayOffService.getDayOffsByLocation(locationId);
        if (response.success && response.data) {
          const blocked = new Set<string>();
          const now = new Date();
          now.setHours(0, 0, 0, 0);
          response.data.forEach((dayOff: DayOff) => {
            const isLocationWide = !dayOff.package_ids?.length && !dayOff.room_ids?.length && !dayOff.attraction_ids?.length && !dayOff.event_ids?.length;
            const appliesToAttraction = !!dayOff.attraction_ids?.includes(Number(selectedAttraction.id));
            if (!isLocationWide && !appliesToAttraction) return;
            const normalizedDate = dayOff.date.split('T')[0];
            const offDate = new Date(normalizedDate + 'T00:00:00');
            const hasTimeRestriction = dayOff.time_start || dayOff.time_end;
            if (hasTimeRestriction) return;
            if (dayOff.is_recurring) {
              const currYear = new Date(now.getFullYear(), offDate.getMonth(), offDate.getDate());
              const nextYear = new Date(now.getFullYear() + 1, offDate.getMonth(), offDate.getDate());
              if (currYear >= now) blocked.add(`${currYear.getFullYear()}-${(currYear.getMonth() + 1).toString().padStart(2, '0')}-${currYear.getDate().toString().padStart(2, '0')}`);
              blocked.add(`${nextYear.getFullYear()}-${(nextYear.getMonth() + 1).toString().padStart(2, '0')}-${nextYear.getDate().toString().padStart(2, '0')}`);
            } else {
              if (offDate >= now) blocked.add(normalizedDate);
            }
          });
          setDayOffDates(blocked);
        }
      } catch {
      }
    };
    fetchDayOffs();
  }, [selectedAttraction, selectedLocation]);

  useEffect(() => {
    if (!scheduledDate || !selectedAttraction) {
      setAvailableTimeSlots([]);
      return;
    }
    const date = new Date(scheduledDate + 'T00:00:00');
    const dayName = dayNumberToName[date.getDay()].toLowerCase();
    const availability = getAttractionAvailability();
    const daySlot = availability.find(slot => slot.days.map(d => d.toLowerCase()).includes(dayName));
    if (daySlot) {
      const slots = generateTimeSlots(daySlot.start_time, daySlot.end_time, 60);
      setAvailableTimeSlots(slots);
      if (!slots.includes(scheduledTime)) setScheduledTime('');
    } else {
      setAvailableTimeSlots([]);
      setScheduledTime('');
    }
  }, [scheduledDate, selectedAttraction]);

  useEffect(() => {
    if (!scheduledDate || !selectedAttraction?.id) {
      setSlotRemaining(null);
      return;
    }
    let cancelled = false;
    attractionService.getSlotAvailability(Number(selectedAttraction.id), scheduledDate)
      .then(res => {
        if (cancelled) return;
        if (res.max_tickets_per_slot == null) { setSlotRemaining(null); return; }
        const map: Record<string, number> = {};
        Object.entries(res.remaining_by_slot ?? {}).forEach(([slot, left]) => { map[slot] = left as number; });
        setSlotRemaining({ __cap: res.max_tickets_per_slot, ...map });
      })
      .catch(() => { if (!cancelled) setSlotRemaining(null); });
    return () => { cancelled = true; };
  }, [scheduledDate, selectedAttraction?.id]);

  const isSubmittingRef = useRef(false);
  const lastSubmitTimeRef = useRef(0);

  const orderLocationId = orderLines[0]?.locationId ?? selectedAttraction?.locationId ?? selectedEvent?.location_id ?? selectedLocation ?? null;

  const buildCurrentLine = (): CartItem | null => {
    if (itemTab === 'events') {
      if (!selectedEvent) return null;
      const today = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })();
      const evStart = String(selectedEvent.start_date ?? '').split('T')[0];
      const evDate = eventDate || (evStart > today ? evStart : today);
      if ((selectedEvent.max_tickets_per_slot != null || selectedEvent.max_bookings_per_slot != null) && !eventTime) return null;
      return {
        key: `event-${selectedEvent.id}-${evDate}-${eventTime || 'any'}-${orderLines.length}`,
        type: 'event',
        id: Number(selectedEvent.id),
        name: selectedEvent.name,
        locationId: Number(selectedEvent.location_id),
        unitPrice: Number(selectedEvent.price ?? 0),
        quantity: eventQty,
        scheduledDate: evDate,
        scheduledTime: eventTime || null,
      };
    }

    if (!selectedAttraction || !scheduledDate || !scheduledTime) return null;
    return {
      key: `attraction-${selectedAttraction.id}-${scheduledDate}-${scheduledTime}-${orderLines.length}`,
      type: 'attraction',
      id: Number(selectedAttraction.id),
      name: selectedAttraction.name,
      locationId: Number(selectedAttraction.locationId || selectedLocation || 0),
      unitPrice: Number(selectedAttraction.price),
      quantity,
      scheduledDate,
      scheduledTime,
      addOns: Object.entries(selectedAddOns)
        .filter(([, qty]) => qty > 0)
        .map(([idStr, qty]) => {
          const addOn = selectedAttraction.addOns?.find(x => x.id === Number(idStr));
          return { id: Number(idStr), name: addOn?.name ?? '', price: Number(addOn?.price ?? 0), quantity: qty };
        }),
    };
  };

  const addCurrentToOrder = () => {
    const line = buildCurrentLine();
    if (!line) {
      setToast({
        message: itemTab === 'events'
          ? (selectedEvent ? `Pick a time for ${selectedEvent.name} first.` : 'Pick an event first.')
          : 'Pick an attraction with a visit date and time first.',
        type: 'error',
      });
      return;
    }
    setOrderLines(prev => [...prev, line]);
    if (itemTab === 'events') {
      setSelectedEvent(null);
      setEventQty(1);
      setEventDate('');
      setEventTime('');
    } else {
      setSelectedAttraction(null);
      setQuantity(1);
      setScheduledDate('');
      setScheduledTime('');
      setSelectedAddOns({});
    }
    setToast({ message: `${line.quantity}× ${line.name} added — configure the next item or complete the order.`, type: 'success' });
  };

  const removeOrderLine = (key: string) => setOrderLines(prev => prev.filter(l => l.key !== key));

  const editOrderLine = (key: string) => {
    const line = orderLines.find(l => l.key === key);
    if (!line) return;

    if (line.type === 'event') {
      const ev = eventsCatalog.find(x => Number(x.id) === line.id);
      if (!ev) {
        setToast({ message: `${line.name} is no longer in the catalog here — remove the line instead if it should not be sold.`, type: 'error' });
        return;
      }
      setOrderLines(prev => prev.filter(l => l.key !== key));
      setItemTab('events');
      setSelectedEvent(ev);
      setEventQty(line.quantity);
      setEventDate(line.scheduledDate ?? '');
      setEventTime(line.scheduledTime ?? '');
    } else {
      const attr = attractions.find(x => Number(x.id) === line.id);
      if (!attr) {
        setToast({ message: `${line.name} is no longer in the catalog here — remove the line instead if it should not be sold.`, type: 'error' });
        return;
      }
      setOrderLines(prev => prev.filter(l => l.key !== key));
      setItemTab('attractions');
      setSelectedAttraction(attr);
      setQuantity(line.quantity);
      setScheduledDate(line.scheduledDate ?? '');
      setScheduledTime(line.scheduledTime ?? '');
      setSelectedAddOns((line.addOns ?? []).reduce<{ [id: number]: number }>((acc, ao) => {
        acc[ao.id] = ao.quantity;
        return acc;
      }, {}));
    }

    setToast({ message: `Editing ${line.name} — adjust it below, then press "Add item to order" to put it back.`, type: 'info' });
  };

  useEffect(() => {
    const current = buildCurrentLine();
    const items = current ? [...orderLines, current] : orderLines;

    if (!(bulkMode || orderLines.length > 0) || items.length === 0) {
      setOrderQuote(null);
      return;
    }
    let cancelled = false;
    const t = setTimeout(() => {
      ticketOrderService.quote(items)
        .then(q => { if (!cancelled) setOrderQuote(q); })
        .catch(() => undefined);
    }, 400);
    return () => { cancelled = true; clearTimeout(t); };
  }, [orderLines, selectedAttraction, quantity, scheduledDate, scheduledTime, selectedAddOns, bulkMode, itemTab, selectedEvent, eventQty, eventDate, eventTime]);

  useEffect(() => {
    if (!orderLocationId || !(bulkMode || orderLines.length > 0 || itemTab === 'events')) return;
    if (eventsCatalogLocation === Number(orderLocationId)) return;
    eventService.getEventsByLocation(Number(orderLocationId))
      .then(res => {
        const raw = res as unknown;
        const inner = (raw as { data?: ZapEvent[] | { events?: ZapEvent[]; data?: ZapEvent[] } })?.data;
        const list = Array.isArray(raw)
          ? (raw as ZapEvent[])
          : Array.isArray(inner)
            ? inner
            : ((inner as { events?: ZapEvent[]; data?: ZapEvent[] })?.events ?? (inner as { data?: ZapEvent[] })?.data ?? []);
        const todayStr = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })();
        setEventsCatalog(list.filter(ev => {
          if (ev.is_active === false) return false;
          const last = String(ev.end_date ?? ev.start_date ?? '').split('T')[0];
          return !last || last >= todayStr;
        }));
        setEventsCatalogLocation(Number(orderLocationId));
      })
      .catch(() => undefined);
  }, [orderLocationId, orderLines.length, eventsCatalogLocation, bulkMode, itemTab]);

  useEffect(() => {
    const today = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })();
    const evStart = String(selectedEvent?.start_date ?? '').split('T')[0];
    const evDate = eventDate || (evStart > today ? evStart : today);
    if (!selectedEvent?.id || !evDate) {
      setEventSlots([]);
      setEventSlotsLeft(null);
      setEventTime('');
      return;
    }
    let cancelled = false;
    eventService.getAvailableTimeSlots(Number(selectedEvent.id), evDate)
      .then(res => {
        if (cancelled) return;
        setEventSlots(res.time_slots || []);
        setEventSlotsLeft(res.remaining_tickets ?? null);
        setEventTime(prev => {
          const kept = (res.time_slots || []).includes(prev) ? prev : '';
          const left = kept && res.remaining_tickets ? res.remaining_tickets[kept] : null;
          if (left != null) setEventQty(q => Math.min(q, Math.max(1, left)));
          return kept;
        });
      })
      .catch(() => { if (!cancelled) { setEventSlots([]); setEventSlotsLeft(null); } });
    return () => { cancelled = true; };
  }, [selectedEvent?.id, eventDate]);

  const customFieldItems = (() => {
    const items = orderLines.map(line => ({ type: line.type, id: line.id }));
    if (itemTab === 'events' && selectedEvent) items.push({ type: 'event' as const, id: Number(selectedEvent.id) });
    if (itemTab === 'attractions' && selectedAttraction) items.push({ type: 'attraction' as const, id: Number(selectedAttraction.id) });
    return items.filter((item, index, all) => all.findIndex(x => x.type === item.type && x.id === item.id) === index);
  })();
  const customFieldKey = customFieldItems.map(item => `${item.type}:${item.id}`).sort().join(',');

  useEffect(() => {
    if (!customFieldItems.length) {
      setCustomFields([]);
      return;
    }
    let cancelled = false;
    customFieldService
      .applicableForItems(customFieldItems)
      .then(list => {
        if (cancelled) return;
        setCustomFieldsUnavailable(list === null);
        const fields = list ?? [];
        setCustomFields(fields);
        setCustomFieldAnswers(prev => pruneCustomFieldAnswers(prev, fields));
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customFieldKey]);

  const currentReady = buildCurrentLine() !== null;
  const readyNudgeRef = useRef(false);

  useEffect(() => {
    if (bulkMode && currentReady && !readyNudgeRef.current) {
      const line = buildCurrentLine();
      if (line) setToast({ message: `${line.name} is ready — press "Add item to order" to put it on the order.`, type: 'info' });
    }
    readyNudgeRef.current = currentReady;
  }, [currentReady, bulkMode]);

  const customerReady = Boolean(selectedCustomerId || customerInfo.name.trim());
  const receiptEmailOk = bulkMode || !sendEmail || Boolean(customerInfo.email.trim());
  const cardDetailsReady = paymentMethod !== 'authorize.net'
    || Boolean(cardNumber && cardMonth && cardYear && cardCVV && validateCardNumber(cardNumber));
  const itemsReady = bulkMode
    ? (orderLines.length > 0 || currentReady)
    : Boolean(selectedAttraction && scheduledDate && scheduledTime);

  const submitBlockers: string[] = [];
  if (!itemsReady) submitBlockers.push(bulkMode ? 'Add at least one item to the order.' : 'Pick an attraction and set its visit date & time.');
  if (!customerReady) submitBlockers.push('Enter the customer name.');
  if (!receiptEmailOk) submitBlockers.push('Add an email for the receipt, or untick "Send email receipt".');
  if (!cardDetailsReady) submitBlockers.push('Complete the card details.');
  const missingCustomField = firstMissingRequired(customFields, customFieldAnswers);
  if (missingCustomField) submitBlockers.push(`Please confirm: ${missingCustomField.label}`);
  const canSubmit = submitBlockers.length === 0;

  const handleCompletePurchase = async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    if (!selectedAttraction && !selectedEvent && orderLines.length === 0) return;
    if (isSubmittingRef.current) return;

    const now = Date.now();
    if (now - lastSubmitTimeRef.current < 3000) {
      console.warn('⚠️ Purchase submission blocked (cooldown)');
      return;
    }

    isSubmittingRef.current = true;
    lastSubmitTimeRef.current = now;

    if (selectedAttraction && (!scheduledDate || !scheduledTime) && orderLines.length === 0) {
      setToast({ message: 'Please select a visit date and time before purchasing.', type: 'error' });
      isSubmittingRef.current = false;
      return;
    }

    if (paymentMethod === 'authorize.net') {
      if (!cardNumber || !cardMonth || !cardYear || !cardCVV) {
        setPaymentError('Please fill in all card details');
        isSubmittingRef.current = false;
        return;
      }
      if (!validateCardNumber(cardNumber)) {
        setPaymentError('Invalid card number');
        isSubmittingRef.current = false;
        return;
      }
      if (isTestCardNumber(cardNumber)) {
        setPaymentError('Test card numbers are not allowed. Please use a real card.');
        isSubmittingRef.current = false;
        return;
      }
      if (!authorizeApiLoginId) {
        setPaymentError('Payment system not initialized. Please refresh the page.');
        isSubmittingRef.current = false;
        return;
      }
    }

    try {
      setSubmitting(true);
      setIsProcessingPayment(true);
      setPaymentError('');

      if (bulkMode || orderLines.length > 0) {
        const currentLine = buildCurrentLine();
        const items = currentLine ? [...orderLines, currentLine] : [...orderLines];

        if (items.length === 0) {
          setToast({ message: 'Add at least one configured item to the order first.', type: 'error' });
          isSubmittingRef.current = false;
          setSubmitting(false);
          setIsProcessingPayment(false);
          return;
        }


        const order = await ticketOrderService.checkout(items, {
          customer_id: selectedCustomerId || undefined,
          guest_name: customerInfo.name || 'Walk-in Customer',
          guest_email: customerInfo.email || undefined,
          guest_phone: customerInfo.phone || undefined,
          payment_method: paymentMethod as 'in-store' | 'paylater' | 'authorize.net',
          notes: notes || `Staff order — ${items.length} items`,
          custom_fields: toCustomFieldPayload(customFieldAnswers),
        });

        try {
          const orderQr = await generateOrderQRCode(order.id);
          await ticketOrderService.storeQrCode(order.id, orderQr);
        } catch { void 0; }

        if (paymentMethod === 'authorize.net') {
          try {
            await processCardPayment(
              { cardNumber: cardNumber.replace(/\s/g, ''), month: cardMonth, year: cardYear, cardCode: cardCVV },
              {
                location_id: order.location_id,
                payable_id: order.id,
                payable_type: PAYMENT_TYPE.TICKET_ORDER,
                amount: order.total_amount,
                order_id: order.reference_number.slice(0, 20),
                send_email: false,
              },
              authorizeApiLoginId,
              authorizeClientKey,
              {
                first_name: customerInfo.name?.split(' ')[0] || '',
                last_name: customerInfo.name?.split(' ').slice(1).join(' ') || '',
                email: customerInfo.email || '',
                phone: customerInfo.phone || '',
              },
            );
          } catch (chargeErr) {
            await ticketOrderService.rollback(order.id).catch(() => undefined);
            throw chargeErr instanceof Error ? chargeErr : new Error('Card payment failed — the order was rolled back.');
          }
        } else if (paymentMethod === 'in-store') {
          const collect = amountPaid > 0 ? Math.min(amountPaid, order.total_amount) : order.total_amount;
          try {
            await createPayment({
              payable_id: order.id,
              payable_type: PAYMENT_TYPE.TICKET_ORDER,
              amount: collect,
              method: 'in-store',
              status: 'completed',
              location_id: order.location_id,
              notes: `Collected at creation for order ${order.reference_number}`,
            });
          } catch {
            void attractionPurchaseCacheService.clearCache();
            void metricsCacheService.clearAllCaches();
            setToast({ message: `Order ${order.reference_number} was created, but recording the payment failed. Record it from the order page.`, type: 'error' });
            navigate(`/orders/${order.id}`);
            return;
          }
        }

        void attractionPurchaseCacheService.clearCache();
        void metricsCacheService.clearAllCaches();
        setToast({ message: `Order ${order.reference_number} created.`, type: 'success' });
        navigate(`/orders/${order.id}`);
        return;
      }

      if (!selectedAttraction) {
        isSubmittingRef.current = false;
        return;
      }

      const totalAmount = finalTotal;
      let transactionId: string | undefined;
      
      const isCardPayment = paymentMethod === 'authorize.net';

      const cashAmountPaid = amountPaid > 0 ? amountPaid : totalAmount;

      const additionalAddons = Object.entries(selectedAddOns)
        .filter(([, qty]) => qty > 0)
        .map(([idStr, qty]) => {
          const addOn = selectedAttraction.addOns?.find(a => a.id === Number(idStr));
          if (!addOn) return null;
          return {
            addon_id: Number(idStr),
            quantity: qty,
            price_at_purchase: addOn.price,
          };
        })
        .filter((item): item is { addon_id: number; quantity: number; price_at_purchase: number } => item !== null);

      const purchaseData = {
        attraction_id: Number(selectedAttraction.id),
        customer_id: selectedCustomerId || undefined,
        guest_name: customerInfo.name || 'Walk-in Customer',
        guest_email: customerInfo.email || undefined,
        guest_phone: customerInfo.phone || undefined,
        quantity: quantity,
        amount: totalAmount,
        total_amount: totalAmount, // Include fees in total_amount
        amount_paid: paymentMethod === 'paylater' ? 0 : (isCardPayment ? totalAmount : cashAmountPaid),
        currency: 'USD',
        method: paymentMethod === 'in-store' ? 'cash' : paymentMethod as 'paylater' | 'authorize.net',
        payment_method: paymentMethod as 'in-store' | 'paylater' | 'authorize.net',
        ...(paymentMethod === 'in-store' ? {
          status: 'confirmed' as const,
        } : {}),
        location_id: selectedAttraction.locationId || 1,
        purchase_date: (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })(),
        scheduled_date: scheduledDate || undefined,
        scheduled_time: scheduledTime || undefined,
        notes: notes || `Attraction Purchase: ${selectedAttraction.name} (${quantity} ticket${quantity > 1 ? 's' : ''})`,
        send_email: paymentMethod === 'in-store' ? sendEmail : false,
        additional_addons: additionalAddons.length > 0 ? additionalAddons : undefined,
        applied_fees: buildAppliedFees(feeBreakdown).length > 0 ? buildAppliedFees(feeBreakdown) : null,
        discount_amount: specialPricingDiscount > 0 ? specialPricingDiscount : undefined,
        applied_discounts: buildAppliedDiscounts(specialPricingBreakdown).length > 0 ? buildAppliedDiscounts(specialPricingBreakdown) : null,
        custom_fields: toCustomFieldPayload(customFieldAnswers),
      };

      const response = await attractionPurchaseService.createPurchase(purchaseData);
      const createdPurchase = response.data;
      void attractionPurchaseCacheService.clearCache();
      void metricsCacheService.clearAllCaches();

      if (isCardPayment) {
        const cardData = {
          cardNumber: cardNumber.replace(/\s/g, ''),
          month: cardMonth,
          year: cardYear,
          cardCode: cardCVV,
        };
        
        const customerData = {
          first_name: customerInfo.name?.split(' ')[0] || '',
          last_name: customerInfo.name?.split(' ').slice(1).join(' ') || '',
          email: customerInfo.email || '',
          phone: customerInfo.phone || '',
        };
        
        let qrCodeData = '';
        try {
          qrCodeData = await generatePurchaseQRCode(createdPurchase.id);
        } catch (qrError) {
          console.error('⚠️ QR code generation failed:', qrError);
        }
        
        const paymentData = {
          location_id: selectedAttraction.locationId || 1,
          amount: totalAmount,
          order_id: `A${selectedAttraction.id}-${Date.now().toString().slice(-8)}`,
          description: `Attraction Purchase: ${selectedAttraction.name}`,
          customer_id: selectedCustomerId || undefined,
          payable_id: createdPurchase.id,
          payable_type: PAYMENT_TYPE.ATTRACTION_PURCHASE,
          send_email: sendEmail,
          qr_code: qrCodeData || undefined,
        };
        
        let paymentResponse;
        try {
          paymentResponse = await processCardPayment(
            cardData,
            paymentData,
            authorizeApiLoginId,
            authorizeClientKey,
            customerData
          );
        } catch (paymentErr) {
          try {
            await attractionPurchaseService.forceDeletePurchase(createdPurchase.id);
            console.log('🗑️ Purchase force deleted due to payment processing error');
          } catch (deleteErr) {
            console.error('⚠️ Failed to delete purchase after payment error:', deleteErr);
          }
          throw paymentErr; // Re-throw to outer catch for error display
        }
        
        if (!paymentResponse.success) {
          try {
            await attractionPurchaseService.forceDeletePurchase(createdPurchase.id);
            console.log('🗑️ Purchase force deleted due to payment failure');
          } catch (deleteErr) {
            console.error('⚠️ Failed to delete purchase after payment failure:', deleteErr);
          }
          const rawMsg = (paymentResponse.message || '').toLowerCase();
          let friendlyMsg = 'Payment could not be processed. The purchase has been cancelled and no charges were made. Please check your card details and try again.';
          if (rawMsg.includes('declined') || rawMsg.includes('decline')) {
            friendlyMsg = 'Your card was declined. The purchase has been cancelled and no charges were made. Please check your card details or try a different card.';
          } else if (rawMsg.includes('insufficient')) {
            friendlyMsg = 'Insufficient funds on your card. The purchase has been cancelled. Please try a different card or payment method.';
          } else if (rawMsg.includes('expired') || rawMsg.includes('expiration')) {
            friendlyMsg = 'Your card appears to be expired. The purchase has been cancelled and no charges were made. Please use a different card.';
          } else if (rawMsg.includes('cvv') || rawMsg.includes('security code')) {
            friendlyMsg = 'Invalid security code (CVV). The purchase has been cancelled. Please check the code on your card and try again.';
          }
          throw new Error(friendlyMsg);
        }
        
        transactionId = paymentResponse.transaction_id;
        console.log('✅ Payment charged and linked successfully, txn:', transactionId);
        
        if (sendEmail) {
          setToast({ message: 'Purchase confirmed! Receipt sent to email.', type: 'success' });
        } else {
          setToast({ message: 'Purchase confirmed! (Email not sent per request)', type: 'info' });
        }
      } else if (cashAmountPaid > 0 && paymentMethod !== 'paylater') {
        try {
          const paymentData = {
            payable_id: createdPurchase.id,
            payable_type: PAYMENT_TYPE.ATTRACTION_PURCHASE,
            customer_id: selectedCustomerId || null,
            amount: cashAmountPaid,
            currency: 'USD',
            method: 'cash' as const,
            status: 'completed' as const,
            location_id: selectedAttraction.locationId || 1,
            notes: `Payment for attraction purchase: ${selectedAttraction.name}`,
          };
          
          await createPayment(paymentData);
        } catch (paymentError) {
        }
      }

      if (!isCardPayment) {
        let qrCodeData = '';
        try {
          qrCodeData = await generatePurchaseQRCode(createdPurchase.id);
        } catch (qrError) {
          console.error('⚠️ QR code generation failed:', qrError);
        }

        if (qrCodeData) {
          try {
            await attractionPurchaseService.sendReceipt(
              createdPurchase.id,
              qrCodeData,
              sendEmail
            );
            if (sendEmail) {
              setToast({ message: 'Purchase confirmed! Receipt sent to email.', type: 'success' });
            } else {
              setToast({ message: 'Purchase confirmed! (Email not sent per request)', type: 'info' });
            }
          } catch {
            setToast({ message: 'Purchase confirmed! (Email failed to send)', type: 'info' });
          }
        } else {
          setToast({ message: 'Purchase confirmed! (Email not sent - QR code generation failed)', type: 'info' });
        }
      }

      setSelectedAttraction(null);
      setQuantity(1);
      setCustomFieldAnswers({});
      setCustomerInfo({ name: '', email: '', phone: '' });
      setDiscount(0);
      setNotes('');
      setAmountPaid(0);
      setPaymentMethod('authorize.net');
      setSelectedCustomerId(null);
      setCardNumber('');
      setCardMonth('');
      setCardYear('');
      setCardCVV('');
      setPaymentError('');
      setSendEmail(true);
      setScheduledDate('');
      setScheduledTime('');
      setSelectedAddOns({});

    } catch (error: any) {
      // The server's wording first — a rejected purchase (capacity, a required
      // confirmation) otherwise reads as "Request failed with status code 422".
      const serverMessage = error?.response?.data?.message;
      setPaymentError(serverMessage || error.message || 'Payment processing failed. Please try again.');
      setToast({ message: serverMessage || error.message || 'Failed to complete purchase. Please try again.', type: 'error' });
    } finally {
      setSubmitting(false);
      setIsProcessingPayment(false);
      isSubmittingRef.current = false;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className={`animate-spin rounded-full h-12 w-12 border-b-2 border-${themeColor}-600`}></div>
      </div>
    );
  }


  return (
    <div className="min-h-screen p-4 sm:p-6">
      <div className="mx-auto">
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Create New Purchase</h1>
              <p className="text-gray-600">Process on-site ticket purchases for customers</p>
              <div className="mt-3 inline-flex rounded-lg border border-gray-200 bg-gray-50 p-1">
                <button
                  type="button"
                  onClick={() => {
                    if (bulkMode && orderLines.length > 0 && !window.confirm('Switch to single purchase? The items in this order will be discarded.')) return;
                    setBulkMode(false);
                    setOrderLines([]);
                    setSelectedEvent(null);
                    setItemTab('attractions');
                  }}
                  className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-colors ${!bulkMode ? `bg-white shadow text-${themeColor}-700` : 'text-gray-500 hover:text-gray-700'}`}
                >
                  Single purchase
                </button>
                <button
                  type="button"
                  onClick={() => setBulkMode(true)}
                  className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-colors ${bulkMode ? `bg-white shadow text-${themeColor}-700` : 'text-gray-500 hover:text-gray-700'}`}
                >
                  Bulk order
                </button>
              </div>
          {(bulkMode || orderLines.length > 0) && (
            <div className="mt-3 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-3">
              <ShoppingCart className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-blue-800">Bulk order mode</p>
                <p className="text-sm text-blue-600">Configure an item below, press "Add item to order" in the Order panel, repeat for every ticket, then press "Create order" — one order, one payment, one QR code.</p>
              </div>
            </div>
          )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-800">{itemTab === 'events' ? 'Select Event' : 'Select Attraction'}</h2>
                {bulkMode && (
                  <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5">
                    <button
                      type="button"
                      onClick={() => setItemTab('attractions')}
                      className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${itemTab === 'attractions' ? `bg-white shadow text-${themeColor}-700` : 'text-gray-500 hover:text-gray-700'}`}
                    >
                      Attractions
                    </button>
                    <button
                      type="button"
                      onClick={() => setItemTab('events')}
                      className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${itemTab === 'events' ? `bg-white shadow text-${themeColor}-700` : 'text-gray-500 hover:text-gray-700'}`}
                    >
                      Events
                    </button>
                  </div>
                )}
              </div>

              {itemTab === 'events' ? (
                selectedEvent ? (
                  <div className={`border rounded-lg p-4 border-${themeColor}-500 bg-${themeColor}-50`}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-800">{selectedEvent.name}</h3>
                        <p className="text-sm text-gray-600 mb-2">Event</p>
                        <span className={`text-lg font-bold text-${themeColor}-600`}>${Number(selectedEvent.price ?? 0).toFixed(2)}<span className="text-xs font-normal text-gray-500 ml-1">/ticket</span></span>
                        <div className="mt-3 flex flex-wrap items-center gap-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Event date</label>
                            <input
                              type="date"
                              value={eventDate || (() => { const t = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })(); const st = String(selectedEvent.start_date ?? '').split('T')[0]; return st > t ? st : t; })()}
                              min={(() => { const t = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })(); const st = String(selectedEvent.start_date ?? '').split('T')[0]; return st > t ? st : t; })()}
                              max={String(selectedEvent.end_date ?? selectedEvent.start_date ?? '').split('T')[0]}
                              onChange={(e) => setEventDate(e.target.value)}
                              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
                            />
                          </div>
                          {eventSlots.length > 0 && (
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">Time</label>
                              <select
                                value={eventTime}
                                onChange={(e) => {
                                  setEventTime(e.target.value);
                                  const left = eventSlotsLeft?.[e.target.value];
                                  if (left != null) setEventQty(prev => Math.min(prev, Math.max(1, left)));
                                }}
                                className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
                              >
                                <option value="">Pick a time…</option>
                                {eventSlots.map(slot => (
                                  <option key={slot} value={slot}>
                                    {convertTo12Hour(slot)}{eventSlotsLeft?.[slot] != null ? ` — ${eventSlotsLeft[slot]} left` : ''}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Tickets</label>
                            <div className="flex items-center gap-2">
                              <StandardButton variant="ghost" size="sm" onClick={() => setEventQty(Math.max(1, eventQty - 1))} icon={Minus}>{''}</StandardButton>
                              <span className="w-8 text-center font-semibold">{eventQty}</span>
                              <StandardButton variant="ghost" size="sm" onClick={() => {
                                const left = eventTime && eventSlotsLeft ? eventSlotsLeft[eventTime] : null;
                                setEventQty(left != null ? Math.min(Math.max(1, left), eventQty + 1) : eventQty + 1);
                              }} icon={Plus}>{''}</StandardButton>
                            </div>
                          </div>
                        </div>
                      </div>
                      <button onClick={() => setSelectedEvent(null)} className="text-gray-400 hover:text-gray-600 p-0.5">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-96 overflow-y-auto">
                    {eventsCatalog.length === 0 && (
                      <p className="col-span-full text-sm text-gray-400 text-center py-8">
                        {orderLocationId ? 'No active events at this location.' : 'Select a location (or an attraction) first to load its events.'}
                      </p>
                    )}
                    {eventsCatalog.map(ev => (
                      <div
                        key={ev.id}
                        className={`border rounded-lg p-4 cursor-pointer transition-colors border-gray-200 hover:border-${themeColor}-300`}
                        onClick={() => { setSelectedEvent(ev); setEventQty(1); setEventDate(String(ev.start_date ?? '').split('T')[0]); }}
                      >
                        <h3 className="font-semibold text-gray-800">{ev.name}</h3>
                        <p className="text-sm text-gray-600 mb-2">{String(ev.start_date ?? '').split('T')[0]}{ev.end_date ? ` – ${String(ev.end_date).split('T')[0]}` : ''}</p>
                        <span className={`text-lg font-bold text-${themeColor}-600`}>${Number(ev.price ?? 0).toFixed(2)}<span className="text-xs font-normal text-gray-500 ml-1">/ticket</span></span>
                      </div>
                    ))}
                  </div>
                )
              ) : selectedAttraction ? (
                <div className={`border rounded-lg p-4 border-${themeColor}-500 bg-${themeColor}-50`}>
                  <div className="flex items-start justify-between">
                    <div className="flex gap-4 flex-1">
                      <div className="w-20 h-20 flex-shrink-0 flex items-center justify-center bg-gray-100 rounded-md border border-gray-200 overflow-hidden">
                        {selectedAttraction.images && selectedAttraction.images.length > 0 ? (
                          <img src={ASSET_URL + selectedAttraction.images[0]} alt={selectedAttraction.name} className="object-cover w-full h-full" />
                        ) : (
                          <span className="text-gray-400 text-xs">No Image</span>
                        )}
                      </div>
                      <div className="flex-1 flex flex-col justify-between">
                        <h3 className="font-semibold text-gray-800">{selectedAttraction.name}</h3>
                        <p className="text-sm text-gray-600 mb-2">{selectedAttraction.category}</p>
                        <div className="flex justify-between items-center">
                          <span className={`text-lg font-bold text-${themeColor}-600`}>
                            ${selectedAttraction.price}
                            <span className="text-xs font-normal text-gray-500 ml-1">
                              {selectedAttraction.pricingType === 'per_person' ? '/person' : 
                               selectedAttraction.pricingType === 'per_group' ? '/group' : 
                               selectedAttraction.pricingType === 'per_hour' ? '/hour' : ''}
                            </span>
                          </span>
                          <span className="text-xs text-gray-500">
                            {selectedAttraction.duration === '0' || !selectedAttraction.duration ? 'Unlimited' : formatDurationDisplay(parseFloat(selectedAttraction.duration), selectedAttraction.durationUnit)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <button onClick={() => setSelectedAttraction(null)} className="text-gray-400 hover:text-gray-600 p-0.5">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="relative mb-4">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Search className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="text"
                      placeholder="Search attractions..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className={`pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500`}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-96 overflow-y-auto">
                    {filteredAttractions.filter(a => a.status === 'active').map(attraction => (
                      <div
                        key={attraction.id}
                        className={`border rounded-lg p-4 cursor-pointer transition-colors flex gap-4 border-gray-200 hover:border-${themeColor}-300`}
                        onClick={() => handleAddToCart(attraction)}
                      >
                        <div className="w-20 h-20 flex-shrink-0 flex items-center justify-center bg-gray-100 rounded-md border border-gray-200 overflow-hidden">
                          {attraction.images && attraction.images.length > 0 ? (
                            <img src={ASSET_URL + attraction.images[0]} alt={attraction.name} className="object-cover w-full h-full" />
                          ) : (
                            <span className="text-gray-400 text-xs">No Image</span>
                          )}
                        </div>
                        <div className="flex-1 flex flex-col justify-between">
                          <h3 className="font-semibold text-gray-800">{attraction.name}</h3>
                          <p className="text-sm text-gray-600 mb-2">{attraction.category}</p>
                          <div className="flex justify-between items-center">
                            <span className={`text-lg font-bold text-${themeColor}-600`}>
                              ${attraction.price}
                              <span className="text-xs font-normal text-gray-500 ml-1">
                                {attraction.pricingType === 'per_person' ? '/person' : 
                                 attraction.pricingType === 'per_group' ? '/group' : 
                                 attraction.pricingType === 'per_hour' ? '/hour' : ''}
                              </span>
                            </span>
                            <span className="text-xs text-gray-500">
                              {attraction.duration === '0' || !attraction.duration ? 'Unlimited' : formatDurationDisplay(parseFloat(attraction.duration), attraction.durationUnit)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {itemTab === 'attractions' && selectedAttraction && (
              <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Tag className="h-5 w-5 text-gray-500" />
                  <h2 className="text-lg font-semibold text-gray-800">Purchase Details</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Quantity</label>
                    <div className="flex items-center gap-2">
                      <StandardButton
                        variant="ghost"
                        size="sm"
                        onClick={() => setQuantity(Math.max(1, quantity - 1))}
                        icon={Minus}
                      >
                        {''}
                      </StandardButton>
                      <span className="w-10 text-center font-semibold text-lg">{quantity}</span>
                      <StandardButton
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const left = scheduledTime && slotRemaining ? (slotRemaining[scheduledTime] ?? slotRemaining['__cap']) : null;
                          setQuantity(left != null ? Math.min(Math.max(1, left), quantity + 1) : quantity + 1);
                        }}
                        icon={Plus}
                      >
                        {''}
                      </StandardButton>
                      <span className="ml-2 text-sm text-gray-500">
                        ${selectedAttraction.price} × {quantity} = <span className="font-semibold text-gray-800">${calculateSubtotal().toFixed(2)}</span>
                      </span>
                    </div>
                  </div>

                  {!bulkMode && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Discount ($)</label>
                      <input
                        type="number"
                        min="0"
                        max={calculateSubtotal()}
                        value={discount}
                        onChange={(e) => setDiscount(Number(e.target.value))}
                        onWheel={(e) => (e.target as HTMLInputElement).blur()}
                        className={`w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500`}
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Amount Paid {paymentMethod === 'paylater' && <span className="text-gray-500 text-xs">(Auto: $0.00)</span>}
                    </label>
                    <input
                      type="number"
                      min="0"
                      max={calculateTotal()}
                      value={paymentMethod === 'paylater' ? 0 : amountPaid}
                      onChange={(e) => setAmountPaid(Number(e.target.value))}
                      onWheel={(e) => (e.target as HTMLInputElement).blur()}
                      disabled={paymentMethod === 'paylater'}
                      className={`w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 ${paymentMethod === 'paylater' ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                      placeholder="0.00"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={2}
                      className={`w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500`}
                      placeholder="Additional notes..."
                    />
                  </div>
                </div>

                {selectedAttraction.addOns && selectedAttraction.addOns.length > 0 && (
                  <div className="mt-6 pt-5 border-t border-gray-100">
                    <div className="flex items-center gap-2 mb-3">
                      <Tag className="h-4 w-4 text-gray-500" />
                      <h3 className="text-sm font-medium text-gray-700">Add-ons</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {[...selectedAttraction.addOns].sort((a, b) => {
                        if (!selectedAttraction.addOnsOrder || selectedAttraction.addOnsOrder.length === 0) return 0;
                        const indexA = selectedAttraction.addOnsOrder.indexOf(a.name);
                        const indexB = selectedAttraction.addOnsOrder.indexOf(b.name);
                        if (indexA === -1 && indexB === -1) return 0;
                        if (indexA === -1) return 1;
                        if (indexB === -1) return -1;
                        return indexA - indexB;
                      }).map((addOn) => {
                        const maxQty = addOn.max_quantity ?? 99;
                        const currentQty = selectedAddOns[addOn.id] || 0;

                        return (
                          <div key={addOn.id} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                            <div className="w-10 h-10 flex-shrink-0 flex items-center justify-center bg-gray-100 rounded-md overflow-hidden">
                              {addOn.image ? (
                                <img src={ASSET_URL + addOn.image} alt={addOn.name} className="object-cover w-full h-full" />
                              ) : (
                                <span className="text-gray-400 text-[8px]">No Img</span>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1">
                                <span className="font-medium text-gray-800 text-xs truncate">{addOn.name}</span>
                                {addOn.description && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedAddOnForDetails(addOn);
                                      setShowAddOnDetailsModal(true);
                                    }}
                                    className="text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors font-medium flex-shrink-0"
                                  >
                                    Details
                                  </button>
                                )}
                              </div>
                              <span className="block text-[10px] text-gray-500">${addOn.price.toFixed(2)} each</span>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <button
                                className="w-6 h-6 rounded bg-white border border-gray-300 text-gray-800 flex items-center justify-center text-xs font-semibold disabled:opacity-50"
                                onClick={() => handleAddOnQty(addOn.id, currentQty - 1)}
                                disabled={currentQty <= 0}
                              >
                                -
                              </button>
                              <span className="w-6 text-center text-xs font-medium">{currentQty}</span>
                              <button
                                className="w-6 h-6 rounded bg-white border border-gray-300 text-gray-800 flex items-center justify-center text-xs font-semibold disabled:opacity-50"
                                onClick={() => handleAddOnQty(addOn.id, currentQty + 1)}
                                disabled={currentQty >= maxQty}
                              >
                                +
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {getAttractionAvailability().length > 0 && (
                  <div className="mt-6 pt-5 border-t border-gray-100">
                    <div className="flex items-center gap-2 mb-3">
                      <Calendar className="h-4 w-4 text-gray-500" />
                      <h3 className="text-sm font-medium text-gray-700">Schedule <span className="text-red-500">*</span></h3>
                    </div>
                    <p className="text-xs text-gray-500 mb-3">A visit date and time are required.</p>
                    <ScheduleCalendar
                      availability={getAttractionAvailability()}
                      dayOffDates={dayOffDates}
                      scheduledDate={scheduledDate}
                      scheduledTime={scheduledTime}
                      availableTimeSlots={availableTimeSlots}
                      slotRemaining={slotRemaining}
                      onDateSelect={(dateStr) => setScheduledDate(dateStr)}
                      onTimeSelect={(time) => {
                        setScheduledTime(time);
                        const left = slotRemaining ? (slotRemaining[time] ?? slotRemaining['__cap']) : null;
                        if (left != null) setQuantity(prev => Math.min(prev, Math.max(1, left)));
                      }}
                      themeColor={themeColor}
                    />
                  </div>
                )}
              </div>
            )}

            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">Customer Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email {selectedCustomerId && <span className="text-green-600 text-xs">(Customer Found)</span>}
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={customerInfo.email}
                    onChange={handleCustomerInfoChange}
                    onFocus={() => foundCustomers.length > 0 && setShowCustomerDropdown(true)}
                    onBlur={() => setTimeout(() => setShowCustomerDropdown(false), 200)}
                    className={`w-full border ${selectedCustomerId ? 'border-green-500' : 'border-gray-300'} rounded-lg px-3 py-2 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500`}
                    placeholder="customer@example.com"
                  />
                  {searchingCustomer && (
                    <div className="absolute right-3 top-9 text-gray-400">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400"></div>
                    </div>
                  )}
                  
                  {showCustomerDropdown && foundCustomers.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {foundCustomers.map((customer) => (
                        <div
                          key={customer.id}
                          onClick={() => handleSelectCustomer(customer)}
                          className={`p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0 ${
                            selectedCustomerId === customer.id ? 'bg-green-50' : ''
                          }`}
                        >
                          <div className="font-medium text-gray-900">
                            {customer.first_name} {customer.last_name}
                          </div>
                          <div className="text-sm text-gray-600">{customer.email}</div>
                          {customer.phone && (
                            <div className="text-xs text-gray-500">{customer.phone}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Customer Name 
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={customerInfo.name}
                    onChange={handleCustomerInfoChange}
                    className={`w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500`}
                    placeholder="Walk-in Customer"
                  />
                </div>
              
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    value={customerInfo.phone}
                    onChange={handleCustomerInfoChange}
                    className={`w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500`}
                    placeholder="(555) 123-4567"
                  />
                </div>
              </div>
            </div>

            {((bulkMode && (orderLines.length > 0 || buildCurrentLine() !== null)) || (!bulkMode && itemTab === 'attractions' && selectedAttraction)) && (
              <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Banknote className="h-5 w-5 text-gray-500" />
                  <h2 className="text-lg font-semibold text-gray-800">Payment</h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-4">
                  <StandardButton
                    variant={paymentMethod === 'authorize.net' ? 'primary' : 'secondary'}
                    size="md"
                    onClick={() => setPaymentMethod('authorize.net')}
                    icon={CreditCard}
                  >
                    Authorize.Net
                  </StandardButton>
                  
                  <StandardButton
                    variant={paymentMethod === 'in-store' ? 'primary' : 'secondary'}
                    size="md"
                    onClick={() => {
                      setPaymentMethod('in-store');
                      setAmountPaid(finalTotal);
                    }}
                    icon={DollarSign}
                  >
                    In-Store
                  </StandardButton>
                  
                  <button
                    onClick={() => setPaymentMethod('paylater')}
                    className={`p-3 border rounded-lg text-center transition-colors ${
                      paymentMethod === 'paylater'
                        ? `border-${themeColor}-500 bg-${themeColor}-50 text-${themeColor}-700`
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    <svg className="h-5 w-5 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-sm">Pay Later</span>
                  </button>
                </div>

                {paymentMethod === 'paylater' && (
                  <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
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

                {paymentMethod === 'authorize.net' && (
                  <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <h3 className="text-sm font-medium text-gray-700 mb-3">Card Details</h3>
                    
                    <div className="mb-3">
                      <label className="block text-xs font-medium text-gray-700 mb-1">Card Number</label>
                      <div className="relative">
                        <input
                          type="text"
                          value={cardNumber}
                          onChange={handleCardNumberChange}
                          placeholder="1234 5678 9012 3456"
                          className={`w-full rounded-lg border px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 ${
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
                    
                    <div className="grid grid-cols-3 gap-2">
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
                    
                    {paymentError && (
                      <div className="mt-3 bg-red-50 border border-red-200 rounded-lg p-2 text-xs text-red-800">
                        {paymentError}
                      </div>
                    )}
                    
                    <div className="mt-3 flex items-start gap-2 text-xs text-gray-600">
                      <svg className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd"></path>
                      </svg>
                      <span>Secure payment powered by Authorize.Net</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm p-6 sticky top-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">{(bulkMode || orderLines.length > 0) ? 'Order' : 'Order Summary'}</h2>

              {(bulkMode || orderLines.length > 0) ? (
                <>
                  <div className="divide-y divide-gray-100 border border-gray-100 rounded-lg mb-4">
                    {orderLines.length === 0 && !buildCurrentLine() && (
                      <p className="p-4 text-sm text-gray-400 text-center">No items yet — pick an attraction on the left to start the order.</p>
                    )}
                    {orderLines.map((l, i) => {
                      const priced = orderQuote?.lines.find(x => x.position === i + 1);
                      return (
                        <div key={l.key} className="p-3 flex items-center gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-gray-900 truncate">{l.quantity}× {l.name}</p>
                            <p className="text-xs text-gray-500">
                              {l.scheduledDate ?? ''}{l.scheduledTime ? ` · ${convertTo12Hour(l.scheduledTime)}` : ''}
                            </p>
                          </div>
                          <span className="text-sm font-semibold text-gray-900 tabular-nums">{priced ? `$${priced.total_amount.toFixed(2)}` : '—'}</span>
                          <button type="button" onClick={() => editOrderLine(l.key)} className={`p-1 text-${themeColor}-600 hover:bg-${themeColor}-50 rounded`} aria-label={`Edit ${l.name}`}>
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button type="button" onClick={() => removeOrderLine(l.key)} className="p-1 text-red-500 hover:bg-red-50 rounded" aria-label={`Remove ${l.name}`}>
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      );
                    })}
                    {buildCurrentLine() && (
                      <div className="p-3 flex items-center gap-2 bg-blue-50/60">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-gray-900 truncate">{buildCurrentLine()!.quantity}× {buildCurrentLine()!.name}</p>
                          <p className="text-xs text-blue-700">configuring below — included when you create the order</p>
                        </div>
                        <span className="text-sm font-semibold text-gray-900 tabular-nums">
                          {orderQuote?.lines.find(x => x.position === orderLines.length + 1)
                            ? `$${orderQuote.lines.find(x => x.position === orderLines.length + 1)!.total_amount.toFixed(2)}`
                            : '—'}
                        </span>
                      </div>
                    )}
                  </div>

                  {orderQuote && (
                    <div className="space-y-1.5 text-sm mb-4">
                      <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span className="tabular-nums">${orderQuote.subtotal.toFixed(2)}</span></div>
                      {orderQuote.discount_amount > 0 && (
                        <div className="flex justify-between text-green-600"><span>Discounts</span><span className="tabular-nums">−${orderQuote.discount_amount.toFixed(2)}</span></div>
                      )}
                      {orderQuote.fee_total > 0 && (
                        <div className="flex justify-between"><span className="text-gray-500">Fees</span><span className="tabular-nums">${orderQuote.fee_total.toFixed(2)}</span></div>
                      )}
                      <div className="flex justify-between pt-2 border-t border-gray-100 text-base font-bold text-gray-900">
                        <span>Total ({orderQuote.ticket_count} tickets)</span><span className="tabular-nums">${orderQuote.total_amount.toFixed(2)}</span>
                      </div>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={addCurrentToOrder}
                    disabled={submitting || (itemTab === 'events' ? !selectedEvent : !selectedAttraction)}
                    className={`w-full mb-2 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border-2 border-dashed text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${currentReady ? 'border-blue-600 text-blue-800 bg-blue-50 ring-2 ring-blue-200' : 'border-blue-400 text-blue-700 hover:bg-blue-50 hover:border-blue-500'}`}
                  >
                    <Plus className="h-4 w-4" />
                    Add item to order
                  </button>
                  {itemTab === 'attractions' && selectedAttraction && (!scheduledDate || !scheduledTime) && (
                    <p className="text-[11px] text-gray-500 mb-2">Needs a visit date &amp; time — set them in Purchase Details.</p>
                  )}

                  <p className="flex items-center gap-2 mb-3 text-xs text-gray-500">
                    <Mail className="h-3.5 w-3.5 text-gray-400" />
                    The receipt emails automatically when the customer has an email on file.
                  </p>

                  {(customFields.length > 0 || customFieldsUnavailable) && (
                    <div className="mb-4 p-3 border border-gray-200 rounded-lg">
                      <p className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">Before you continue</p>
                      <CustomFieldChecks
                        fields={customFields}
                        unavailable={customFieldsUnavailable}
                        answers={customFieldAnswers}
                        onChange={(id, value) => setCustomFieldAnswers(prev => ({ ...prev, [id]: value }))}
                      />
                    </div>
                  )}

                  <StandardButton
                    variant="primary"
                    size="lg"
                    onClick={handleCompletePurchase}
                    disabled={submitting || !canSubmit}
                    loading={submitting}
                    icon={ShoppingCart}
                    fullWidth
                  >
                    {submitting
                      ? 'Processing...'
                      : `Create order${orderQuote ? ` · $${orderQuote.total_amount.toFixed(2)}` : ''}`}
                  </StandardButton>
                  {!canSubmit && !submitting && (
                    <p className="text-[11px] text-amber-700 mt-2 text-center">{submitBlockers[0]}</p>
                  )}

                  {orderLines.length > 0 && (
                    <button type="button" onClick={() => setOrderLines([])} className="w-full mt-2 text-xs text-gray-400 hover:text-red-500">
                      Clear order
                    </button>
                  )}
                </>
              ) : selectedAttraction ? (
                <>
                  <div className="flex items-start gap-3 mb-4 p-3 bg-gray-50 rounded-lg">
                    <div className="w-14 h-14 flex-shrink-0 rounded-md overflow-hidden bg-gray-100 border border-gray-200">
                      {selectedAttraction.images && selectedAttraction.images.length > 0 ? (
                        <img src={ASSET_URL + selectedAttraction.images[0]} alt={selectedAttraction.name} className="object-cover w-full h-full" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">N/A</div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-1">
                        <h3 className="font-semibold text-gray-800 text-sm truncate">{selectedAttraction.name}</h3>
                        <button onClick={() => setSelectedAttraction(null)} className="text-gray-400 hover:text-gray-600 flex-shrink-0 p-0.5">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <p className="text-xs text-gray-500">{selectedAttraction.category}</p>
                      <p className={`text-sm font-bold text-${themeColor}-600 mt-1`}>
                        ${selectedAttraction.price}
                        <span className="text-xs font-normal text-gray-500 ml-1">
                          {selectedAttraction.pricingType === 'per_person' ? '/person' : 
                           selectedAttraction.pricingType === 'per_group' ? '/group' : 
                           selectedAttraction.pricingType === 'per_hour' ? '/hour' : ''}
                        </span>
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2 text-sm mb-4">
                    <div className="flex justify-between text-gray-600">
                      <span>Qty: {quantity} × ${selectedAttraction.price}</span>
                      <span className="font-medium">${calculateSubtotal().toFixed(2)}</span>
                    </div>
                    {Object.entries(selectedAddOns).filter(([, qty]) => qty > 0).map(([idStr, qty]) => {
                      const addOn = selectedAttraction.addOns?.find(a => a.id === Number(idStr));
                      if (!addOn) return null;
                      return (
                        <div key={idStr} className="flex justify-between text-gray-600">
                          <span className="truncate pr-2">{addOn.name} × {qty}</span>
                          <span className="font-medium">${(addOn.price * qty).toFixed(2)}</span>
                        </div>
                      );
                    })}
                    {discount > 0 && (
                      <div className="flex justify-between text-red-600">
                        <span>Discount</span>
                        <span>-${discount.toFixed(2)}</span>
                      </div>
                    )}
                    {specialPricingBreakdown && specialPricingBreakdown.has_special_pricing && (
                      <>
                        {specialPricingBreakdown.discounts_applied.map((spDiscount, index) => (
                          <div key={index} className="flex justify-between text-green-700">
                            <span>{spDiscount.name}</span>
                            <span>-${spDiscount.discount_amount.toFixed(2)}</span>
                          </div>
                        ))}
                      </>
                    )}
                    {feeBreakdown && feeBreakdown.fees.length > 0 && (
                      <PriceBreakdownDisplay breakdown={feeBreakdown} compact className="!text-sm" />
                    )}
                  </div>

                  <div className="border-t border-gray-200 pt-3 mb-4">
                    <div className="flex justify-between font-bold text-lg">
                      <span>Total</span>
                      <span>${finalTotal.toFixed(2)}</span>
                    </div>
                    {paymentMethod === 'paylater' && (
                      <div className="flex justify-between font-semibold text-sm mt-1 text-orange-700">
                        <span>Amount Due Now</span>
                        <span>$0.00</span>
                      </div>
                    )}
                  </div>

                  <div className="mb-4">
                    <label className="flex items-center gap-2 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={sendEmail}
                        onChange={(e) => setSendEmail(e.target.checked)}
                        className={`w-4 h-4 rounded border-gray-300 text-${themeColor}-600 focus:ring-${themeColor}-500 cursor-pointer`}
                      />
                      <Mail className="h-3.5 w-3.5 text-gray-400" />
                      <span className="text-sm text-gray-700 group-hover:text-gray-900">
                        Send email receipt
                      </span>
                    </label>
                  </div>


                  {(customFields.length > 0 || customFieldsUnavailable) && (
                    <div className="mb-4 p-3 border border-gray-200 rounded-lg">
                      <p className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">Before you continue</p>
                      <CustomFieldChecks
                        fields={customFields}
                        unavailable={customFieldsUnavailable}
                        answers={customFieldAnswers}
                        onChange={(id, value) => setCustomFieldAnswers(prev => ({ ...prev, [id]: value }))}
                      />
                    </div>
                  )}

                  <StandardButton
                    variant="primary"
                    size="lg"
                    onClick={handleCompletePurchase}
                    disabled={submitting || !canSubmit}
                    loading={submitting}
                    icon={ShoppingCart}
                    fullWidth
                  >
                    {submitting ? 'Processing...' : 'Complete Purchase'}
                  </StandardButton>
                  {!canSubmit && !submitting && (
                    <p className="text-[11px] text-amber-700 mt-2 text-center">{submitBlockers[0]}</p>
                  )}
                </>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <ShoppingCart className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>{itemTab === 'events' ? 'Select an event to begin' : 'Select an attraction to begin'}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {showAddOnDetailsModal && selectedAddOnForDetails && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-backdrop-fade" onClick={() => setShowAddOnDetailsModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white p-4 flex justify-between items-center border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-800">{selectedAddOnForDetails.name}</h3>
              <button
                onClick={() => setShowAddOnDetailsModal(false)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-6">
              <div className="mb-6 flex justify-center">
                {selectedAddOnForDetails.image ? (
                  <img
                    src={ASSET_URL + selectedAddOnForDetails.image}
                    alt={selectedAddOnForDetails.name}
                    className="max-w-full max-h-64 object-contain rounded-lg shadow-sm"
                  />
                ) : (
                  <div className="w-full h-48 bg-gray-100 rounded-lg flex items-center justify-center">
                    <span className="text-gray-400">No image available</span>
                  </div>
                )}
              </div>
              <div className="mb-4 flex items-center justify-between">
                <span className="text-gray-600 text-sm">Price:</span>
                <span className={`text-lg font-semibold text-${themeColor}-600`}>${selectedAddOnForDetails.price.toFixed(2)}</span>
              </div>
              <div className="pt-4 border-t border-gray-100">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Description</h4>
                {selectedAddOnForDetails.description ? (
                  <p className="text-sm text-gray-600 whitespace-pre-wrap">{selectedAddOnForDetails.description}</p>
                ) : (
                  <p className="text-sm text-gray-400 italic">No description available</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

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
                  You can still process purchases
                </p>
                <p className={`text-xs text-${themeColor}-800 mt-2`}>
                  Cash payments and manual card entry are available. For automated Authorize.Net processing, contact your system administrator or use Location Manager Account to configure the merchant account for this location.
                </p>
              </div>
              
              <StandardButton
                variant="primary"
                size="lg"
                onClick={() => setShowNoAuthAccountModal(false)}
                fullWidth
              >
                I Understand
              </StandardButton>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed top-4 right-4 z-50 animate-fade-in-up">
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(null)}
          />
        </div>
      )}

      <EmptyStateModal
        type="attractions"
        isOpen={showEmptyModal}
        onClose={() => setShowEmptyModal(false)}
      />
    </div>
  );
};

export default CreatePurchase;
