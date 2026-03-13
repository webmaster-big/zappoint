import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  Search,
  X,
  Minus,
  Plus,
  ShoppingCart,
  Tag,
  Banknote,
  Mail,
  CreditCard,
  DollarSign,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useThemeColor } from '../../../hooks/useThemeColor';
import { eventService } from '../../../services/EventService';
import { eventCacheService } from '../../../services/EventCacheService';
import { eventPurchaseService } from '../../../services/EventPurchaseService';
import { customerService, type Customer } from '../../../services/CustomerService';
import Toast from '../../../components/ui/Toast';
import StandardButton from '../../../components/ui/StandardButton';
import LocationSelector from '../../../components/admin/LocationSelector';
import { locationService } from '../../../services/LocationService';
import type { Event, EventAddOn } from '../../../types/event.types';
import { ASSET_URL, getStoredUser } from '../../../utils/storage';
import { loadAcceptJS, processCardPayment, validateCardNumber, formatCardNumber, getCardType, createPayment, PAYMENT_TYPE } from '../../../services/PaymentService';
import { getAuthorizeNetPublicKey } from '../../../services/SettingsService';

const OnsitePurchaseEvent = () => {
  const navigate = useNavigate();
  const { themeColor, fullColor } = useThemeColor();
  const currentUser = getStoredUser();
  const isCompanyAdmin = currentUser?.role === 'company_admin';

  // Locations
  const [locations, setLocations] = useState<Array<{ id: number; name: string }>>([]);
  const [selectedLocation, setSelectedLocation] = useState<number | null>(null);

  // Event selection
  const [allEvents, setAllEvents] = useState<Event[]>([]);
  const [eventSearch, setEventSearch] = useState('');
  const [loadingEvents, setLoadingEvents] = useState(true);

  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Date & time
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState('');
  const [timeSlots, setTimeSlots] = useState<string[]>([]);
  const [selectedTime, setSelectedTime] = useState('');
  const [loadingSlots, setLoadingSlots] = useState(false);

  // Purchase details
  const [quantity, setQuantity] = useState(1);
  const [discount, setDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<string>('authorize.net');
  const [notes, setNotes] = useState('');
  const [sendEmail, setSendEmail] = useState(false);

  // Card payment details (Authorize.Net)
  const [cardNumber, setCardNumber] = useState('');
  const [cardMonth, setCardMonth] = useState('');
  const [cardYear, setCardYear] = useState('');
  const [cardCVV, setCardCVV] = useState('');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [authorizeApiLoginId, setAuthorizeApiLoginId] = useState('');
  const [authorizeClientKey, setAuthorizeClientKey] = useState('');
  const [_authorizeEnvironment, setAuthorizeEnvironment] = useState<'sandbox' | 'production'>('sandbox');

  // Pagination for event grid
  const [currentPage, setCurrentPage] = useState(1);
  const eventsPerPage = 6;

  // Customer
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [foundCustomers, setFoundCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [searchingCustomer, setSearchingCustomer] = useState(false);

  // Add-ons
  const [selectedAddOns, setSelectedAddOns] = useState<Record<number, number>>({});

  // Synchronous ref guard to prevent multi-click duplicate submissions
  const isSubmittingRef = useRef(false);
  const lastSubmitTimeRef = useRef(0);

  // Format date helper
  const formatEventDate = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr.includes('T') ? dateStr : dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCardNumber(e.target.value);
    if (formatted.replace(/\s/g, '').length <= 16) {
      setCardNumber(formatted);
      setPaymentError('');
    }
  };

  // Load locations for company admin
  useEffect(() => {
    if (isCompanyAdmin) {
      locationService.getLocations().then(res => {
        if (res.success && Array.isArray(res.data)) {
          setLocations(res.data.map(l => ({ id: l.id, name: l.name })));
        }
      }).catch(() => {});
    }
  }, [isCompanyAdmin]);

  // Load all events on mount
  useEffect(() => {
    const fetchEvents = async () => {
      setLoadingEvents(true);
      try {
        // Try cache first for faster load
        const cached = await eventCacheService.getCachedEvents();
        if (cached && cached.length > 0) {
          setAllEvents(cached.filter(e => e.is_active));
          setLoadingEvents(false);
          eventCacheService.syncInBackground({ user_id: currentUser?.id });
          return;
        }

        const res = await eventService.getEvents({ user_id: currentUser?.id });
        let list: Event[] = [];
        if (Array.isArray(res.data)) {
          list = res.data;
        } else if (res.data && typeof res.data === 'object') {
          const obj = res.data as Record<string, unknown>;
          if (Array.isArray(obj.events)) list = obj.events as Event[];
          else if (Array.isArray(obj.data)) list = obj.data as Event[];
        }
        if (list.length === 0 && Array.isArray(res)) {
          list = res as unknown as Event[];
        }
        await eventCacheService.cacheEvents(list);
        list = list.filter(e => e.is_active);
        setAllEvents(list);
      } catch {
        setToast({ message: 'Failed to load events', type: 'error' });
      } finally {
        setLoadingEvents(false);
      }
    };
    fetchEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedDate && event) loadTimeSlots(selectedDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  const selectEvent = async (ev: Event) => {
    setLoading(true);
    setEvent(ev);
    setSelectedDate('');
    setSelectedTime('');
    setTimeSlots([]);
    setQuantity(1);
    setDiscount(0);
    setSelectedAddOns({});
    setNotes('');
    try {
      const dateRes = await eventService.getAvailableDates(ev.id);
      setAvailableDates(dateRes.dates || []);
      if (ev.date_type === 'one_time' && dateRes.dates?.length === 1) {
        setSelectedDate(dateRes.dates[0]);
      }
    } catch {
      setToast({ message: 'Failed to load available dates', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const changeEvent = () => {
    setEvent(null);
    setSelectedDate('');
    setSelectedTime('');
    setTimeSlots([]);
    setAvailableDates([]);
    setQuantity(1);
    setDiscount(0);
    setSelectedAddOns({});
  };

  const loadTimeSlots = async (date: string) => {
    if (!event) return;
    setLoadingSlots(true);
    try {
      const res = await eventService.getAvailableTimeSlots(event.id, date);
      setTimeSlots(res.time_slots || []);
      setSelectedTime('');
    } catch {
      setTimeSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  };

  // Customer search by email
  useEffect(() => {
    if (guestEmail.length < 2) {
      setFoundCustomers([]);
      setShowCustomerDropdown(false);
      return;
    }
    const t = setTimeout(async () => {
      setSearchingCustomer(true);
      try {
        const res = await customerService.searchCustomers(guestEmail);
        setFoundCustomers(res.data || []);
        setShowCustomerDropdown(true);
      } catch {
        setFoundCustomers([]);
      } finally {
        setSearchingCustomer(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [guestEmail]);

  const handleSelectCustomer = (customer: Customer) => {
    setSelectedCustomerId(customer.id);
    setGuestName(`${customer.first_name} ${customer.last_name}`);
    setGuestEmail(customer.email);
    setGuestPhone(customer.phone || '');
    setShowCustomerDropdown(false);
  };

  // Initialize Authorize.Net when payment method is authorize.net
  useEffect(() => {
    if (paymentMethod !== 'authorize.net') return;
    const initializeAuthorizeNet = async () => {
      try {
        const locationId = event?.location_id || 1;
        const response = await getAuthorizeNetPublicKey(locationId);
        if (response && response.api_login_id) {
          setAuthorizeApiLoginId(response.api_login_id);
          setAuthorizeClientKey(response.client_key || response.api_login_id);
          setAuthorizeEnvironment((response.environment || 'sandbox') as 'sandbox' | 'production');
          await loadAcceptJS((response.environment || 'sandbox') as 'sandbox' | 'production');
        }
      } catch {
        // Authorize.Net not configured — user can still use other methods
      }
    };
    initializeAuthorizeNet();
  }, [event, paymentMethod]);

  const clearCustomer = () => {
    setSelectedCustomerId(null);
    setGuestName('');
    setGuestEmail('');
    setGuestPhone('');
  };

  const handleCustomerInfoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (name === 'email') setGuestEmail(value);
    else if (name === 'name') setGuestName(value);
    else if (name === 'phone') setGuestPhone(value);
  };

  // Add-on helpers
  const handleAddOnQty = (addonId: number, qty: number) => {
    if (qty <= 0) {
      setSelectedAddOns(prev => {
        const copy = { ...prev };
        delete copy[addonId];
        return copy;
      });
    } else {
      setSelectedAddOns(prev => ({ ...prev, [addonId]: qty }));
    }
  };

  // Price calculation
  const eventPrice = event ? parseFloat(event.price) : 0;
  const calculateSubtotal = () => eventPrice * quantity;
  const addOnTotal = event?.add_ons
    ? Object.entries(selectedAddOns).reduce((sum, [addonId, qty]) => {
        const addon = event.add_ons!.find(a => a.id === parseInt(addonId));
        return sum + (addon ? parseFloat(addon.price) * qty : 0);
      }, 0)
    : 0;
  const calculateTotal = () => Math.max(0, calculateSubtotal() + addOnTotal - discount);

  const formatTime = (time: string) => {
    const [h, m] = time.split(':');
    const hour = parseInt(h);
    return `${hour % 12 || 12}:${m} ${hour >= 12 ? 'PM' : 'AM'}`;
  };

  const handleSubmit = async (e: React.FormEvent | React.MouseEvent) => {
    if ('preventDefault' in e) e.preventDefault();
    if ('stopPropagation' in e) e.stopPropagation();

    if (!event) return;
    if (isSubmittingRef.current) return;

    const now = Date.now();
    if (now - lastSubmitTimeRef.current < 3000) return;
    isSubmittingRef.current = true;
    lastSubmitTimeRef.current = now;

    if (!selectedDate) {
      setToast({ message: 'Please select a date', type: 'error' });
      isSubmittingRef.current = false;
      return;
    }
    if (!selectedTime) {
      setToast({ message: 'Please select a time slot', type: 'error' });
      isSubmittingRef.current = false;
      return;
    }
    if (!guestName.trim() && !selectedCustomerId) {
      setToast({ message: 'Please enter guest name or select a customer', type: 'error' });
      isSubmittingRef.current = false;
      return;
    }

    // Validate card if authorize.net
    const isCardPayment = paymentMethod === 'authorize.net';
    if (isCardPayment) {
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
      if (!authorizeApiLoginId) {
        setPaymentError('Payment system not initialized. Please refresh the page.');
        isSubmittingRef.current = false;
        return;
      }
    }

    setSubmitting(true);
    setIsProcessingPayment(true);
    setPaymentError('');

    try {
      const addOnsPayload = Object.entries(selectedAddOns).map(([addonId, qty]) => {
        const addon = event!.add_ons!.find(a => a.id === parseInt(addonId));
        return {
          add_on_id: parseInt(addonId),
          quantity: qty,
          price_at_purchase: addon ? parseFloat(addon.price) : 0,
        };
      });

      const total = calculateTotal();

      const purchaseRes = await eventPurchaseService.createPurchase({
        event_id: event!.id,
        customer_id: selectedCustomerId,
        location_id: event!.location_id,
        guest_name: selectedCustomerId ? undefined : guestName,
        guest_email: selectedCustomerId ? undefined : guestEmail,
        guest_phone: selectedCustomerId ? undefined : guestPhone,
        purchase_date: selectedDate,
        purchase_time: selectedTime,
        quantity,
        total_amount: total,
        amount_paid: paymentMethod === 'paylater' ? 0 : total,
        payment_method: paymentMethod as 'card' | 'in-store' | 'paylater' | 'authorize.net',
        payment_status: paymentMethod === 'paylater' ? 'pending' : 'paid',
        send_email: sendEmail,
        notes: notes || undefined,
        add_ons: addOnsPayload.length > 0 ? addOnsPayload : undefined,
      });

      const createdPurchase = purchaseRes.data || purchaseRes;

      // Process card payment via Authorize.Net
      if (isCardPayment) {
        const cardData = {
          cardNumber: cardNumber.replace(/\s/g, ''),
          month: cardMonth,
          year: cardYear,
          cardCode: cardCVV,
        };
        const customerData = {
          first_name: guestName?.split(' ')[0] || '',
          last_name: guestName?.split(' ').slice(1).join(' ') || '',
          email: guestEmail || '',
          phone: guestPhone || '',
        };
        const paymentData = {
          location_id: event!.location_id || 1,
          amount: total,
          order_id: `E${event!.id}-${Date.now().toString().slice(-8)}`,
          description: `Event Purchase: ${event!.name}`,
          customer_id: selectedCustomerId || undefined,
          payable_id: createdPurchase.id,
          payable_type: PAYMENT_TYPE.EVENT_PURCHASE,
          send_email: sendEmail,
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
          try { await eventPurchaseService.deletePurchase(createdPurchase.id); } catch { /* cleanup */ }
          throw paymentErr;
        }

        if (!paymentResponse.success) {
          try { await eventPurchaseService.deletePurchase(createdPurchase.id); } catch { /* cleanup */ }
          const rawMsg = (paymentResponse.message || '').toLowerCase();
          let friendlyMsg = 'Payment could not be processed. The purchase has been cancelled. Please check your card details and try again.';
          if (rawMsg.includes('declined') || rawMsg.includes('decline')) {
            friendlyMsg = 'Your card was declined. The purchase has been cancelled. Please try a different card.';
          } else if (rawMsg.includes('insufficient')) {
            friendlyMsg = 'Insufficient funds. Please try a different card or payment method.';
          } else if (rawMsg.includes('expired') || rawMsg.includes('expiration')) {
            friendlyMsg = 'Your card appears to be expired. Please use a different card.';
          }
          throw new Error(friendlyMsg);
        }
      } else if (paymentMethod === 'in-store' && total > 0) {
        // Record cash payment
        try {
          await createPayment({
            payable_id: createdPurchase.id,
            payable_type: PAYMENT_TYPE.EVENT_PURCHASE,
            customer_id: selectedCustomerId || null,
            amount: total,
            currency: 'USD',
            method: 'cash' as 'card' | 'cash',
            status: 'completed' as const,
            location_id: event!.location_id || 1,
            notes: `Payment for event purchase: ${event!.name}`,
          });
        } catch {
          // Non-critical
        }
      }

      setToast({ message: 'Purchase created successfully!', type: 'success' });
      setTimeout(() => navigate('/events'), 1500);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message
        || (err as Error)?.message
        || 'Failed to create purchase';
      setPaymentError(msg);
      setToast({ message: msg, type: 'error' });
    } finally {
      setSubmitting(false);
      setIsProcessingPayment(false);
      isSubmittingRef.current = false;
    }
  };

  // Filter events by search
  const filteredEvents = allEvents.filter(ev =>
    ev.name.toLowerCase().includes(eventSearch.toLowerCase()) ||
    (ev.location?.name || '').toLowerCase().includes(eventSearch.toLowerCase())
  );

  // Pagination
  const totalPages = Math.ceil(filteredEvents.length / eventsPerPage);
  const paginatedEvents = filteredEvents.slice(
    (currentPage - 1) * eventsPerPage,
    currentPage * eventsPerPage
  );

  // Reset to page 1 when search changes
  useEffect(() => { setCurrentPage(1); }, [eventSearch]);

  // Order add-ons by add_ons_order
  const orderedAddOns: EventAddOn[] = event
    ? (event.add_ons_order && event.add_ons
        ? event.add_ons_order
            .map(addonId => event.add_ons!.find(a => a.id === addonId))
            .filter(Boolean) as EventAddOn[]
        : event.add_ons || [])
    : [];

  return (
    <div className="px-6 py-8">
      {toast && (
        <div className="fixed top-4 right-4 z-50 animate-fade-in-up">
          <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Onsite Event Purchase</h1>
          <p className="text-gray-600 mt-1">Create a walk-in event purchase</p>
        </div>
        <div className="mt-4 sm:mt-0 flex items-center gap-2">
          {isCompanyAdmin && locations.length > 0 && (
            <LocationSelector
              variant="compact"
              locations={locations}
              selectedLocation={selectedLocation?.toString() || ''}
              onLocationChange={(id) => setSelectedLocation(id ? Number(id) : null)}
              themeColor={themeColor}
              fullColor={fullColor}
              showAllOption={true}
            />
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - All Form Sections */}
        <div className="lg:col-span-2 space-y-6">
          {/* 1. Select Event */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Select Event</h2>

            {event ? (
              <div className={`border rounded-lg p-4 border-${themeColor}-500 bg-${themeColor}-50`}>
                <div className="flex items-start justify-between">
                  <div className="flex gap-4 flex-1">
                    <div className="w-20 h-20 flex-shrink-0 flex items-center justify-center bg-gray-100 rounded-md border border-gray-200 overflow-hidden">
                      {event.image ? (
                        <img src={event.image} alt={event.name} className="object-cover w-full h-full" />
                      ) : (
                        <span className="text-gray-400 text-xs">No Image</span>
                      )}
                    </div>
                    <div className="flex-1 flex flex-col justify-between">
                      <h3 className="font-semibold text-gray-800">{event.name}</h3>
                      <p className="text-sm text-gray-600 mb-2">{event.location?.name || 'No location'}</p>
                      <div className="flex justify-between items-center">
                        <span className={`text-lg font-bold text-${themeColor}-600`}>${parseFloat(event.price).toFixed(2)}</span>
                        <span className="text-xs text-gray-500">
                          {event.date_type === 'one_time' ? 'One Time' : 'Date Range'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <button onClick={changeEvent} className="text-gray-400 hover:text-gray-600 p-0.5">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Search */}
                <div className="relative mb-4">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    placeholder="Search events..."
                    value={eventSearch}
                    onChange={e => setEventSearch(e.target.value)}
                    className={`pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500`}
                  />
                </div>

                {/* Events Grid */}
                {loadingEvents ? (
                  <div className="flex items-center justify-center py-12">
                    <div className={`w-8 h-8 border-4 border-${themeColor}-200 border-t-${themeColor}-600 rounded-full animate-spin`} />
                  </div>
                ) : filteredEvents.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <ShoppingCart className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p>No active events found</p>
                  </div>
                ) : (
                  <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-96 overflow-y-auto">
                    {paginatedEvents.map(ev => (
                      <div
                        key={ev.id}
                        className={`border rounded-lg p-4 cursor-pointer transition-colors flex gap-4 border-gray-200 hover:border-${themeColor}-300`}
                        onClick={() => selectEvent(ev)}
                      >
                        <div className="w-20 h-20 flex-shrink-0 flex items-center justify-center bg-gray-100 rounded-md border border-gray-200 overflow-hidden">
                          {ev.image ? (
                            <img src={ev.image} alt={ev.name} className="object-cover w-full h-full" />
                          ) : (
                            <span className="text-gray-400 text-xs">No Image</span>
                          )}
                        </div>
                        <div className="flex-1 flex flex-col justify-between">
                          <h3 className="font-semibold text-gray-800">{ev.name}</h3>
                          <p className="text-sm text-gray-600 mb-2">{ev.location?.name || 'No location'}</p>
                          <div className="flex justify-between items-center">
                            <span className={`text-lg font-bold text-${themeColor}-600`}>
                              ${parseFloat(ev.price).toFixed(2)}
                            </span>
                            <span className="text-xs text-gray-500">
                              {ev.date_type === 'one_time' ? formatEventDate(ev.start_date || '') : `${formatEventDate(ev.start_date || '')} – ${formatEventDate(ev.end_date || '')}`}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
                      <span className="text-sm text-gray-500">
                        Showing {(currentPage - 1) * eventsPerPage + 1}–{Math.min(currentPage * eventsPerPage, filteredEvents.length)} of {filteredEvents.length}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                          disabled={currentPage === 1}
                          className="p-1.5 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </button>
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                          <button
                            key={page}
                            onClick={() => setCurrentPage(page)}
                            className={`px-3 py-1 rounded-lg text-sm font-medium ${
                              currentPage === page
                                ? `bg-${themeColor}-600 text-white`
                                : 'text-gray-600 hover:bg-gray-100'
                            }`}
                          >
                            {page}
                          </button>
                        ))}
                        <button
                          onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                          disabled={currentPage === totalPages}
                          className="p-1.5 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  )}
                  </>
                )}
              </>
            )}
          </div>

          {/* 2. Customer Information */}
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
                  value={guestEmail}
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

                {/* Customer Dropdown */}
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Customer Name</label>
                <input
                  type="text"
                  name="name"
                  value={guestName}
                  onChange={handleCustomerInfoChange}
                  disabled={!!selectedCustomerId}
                  className={`w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 ${selectedCustomerId ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                  placeholder="Walk-in Customer"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input
                  type="tel"
                  name="phone"
                  value={guestPhone}
                  onChange={handleCustomerInfoChange}
                  disabled={!!selectedCustomerId}
                  className={`w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 ${selectedCustomerId ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                  placeholder="(555) 123-4567"
                />
              </div>
              {selectedCustomerId && (
                <div className="flex items-end">
                  <StandardButton variant="ghost" size="sm" onClick={clearCustomer} icon={X}>
                    Clear Customer
                  </StandardButton>
                </div>
              )}
            </div>
          </div>

          {/* 3. Purchase Details — only when event is selected */}
          {event && !loading && (
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center gap-2 mb-4">
                <Tag className="h-5 w-5 text-gray-500" />
                <h2 className="text-lg font-semibold text-gray-800">Purchase Details</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Quantity */}
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
                      onClick={() => setQuantity(quantity + 1)}
                      icon={Plus}
                    >
                      {''}
                    </StandardButton>
                    <span className="ml-2 text-sm text-gray-500">
                      ${eventPrice.toFixed(2)} × {quantity} = <span className="font-semibold text-gray-800">${calculateSubtotal().toFixed(2)}</span>
                    </span>
                  </div>
                </div>

                {/* Discount */}
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

                {/* Notes */}
                <div className="md:col-span-2">
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

              {/* Date & Time Section */}
              <div className="mt-6 pt-5 border-t border-gray-100">
                <div className="flex items-center gap-2 mb-3">
                  <Calendar className="h-4 w-4 text-gray-500" />
                  <h3 className="text-sm font-medium text-gray-700">Schedule</h3>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Select Date *</label>
                    {event.date_type === 'one_time' ? (
                      <div className="text-sm text-gray-600 bg-gray-50 px-4 py-2 rounded-lg">
                        {new Date(event.start_date.substring(0, 10) + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                      </div>
                    ) : (
                      <select
                        value={selectedDate}
                        onChange={e => setSelectedDate(e.target.value)}
                        className={`w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500`}
                        required
                      >
                        <option value="">Select a date...</option>
                        {availableDates.map(d => (
                          <option key={d} value={d}>
                            {new Date(d.substring(0, 10) + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  {selectedDate && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Select Time Slot *</label>
                      {loadingSlots ? (
                        <div className="flex items-center gap-2 text-sm text-gray-400">
                          <div className={`w-4 h-4 border-2 border-gray-200 border-t-${themeColor}-500 rounded-full animate-spin`} />
                          Loading time slots...
                        </div>
                      ) : timeSlots.length === 0 ? (
                        <p className="text-sm text-gray-400">No available time slots for this date.</p>
                      ) : (
                        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                          {timeSlots.map(slot => (
                            <button
                              key={slot}
                              type="button"
                              onClick={() => setSelectedTime(slot)}
                              className={`px-3 py-2 text-sm rounded-lg border transition ${
                                selectedTime === slot
                                  ? `bg-${themeColor}-600 text-white border-${themeColor}-600`
                                  : `bg-white text-gray-700 border-gray-200 hover:border-${themeColor}-400`
                              }`}
                            >
                              {formatTime(slot)}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Add-ons Selection */}
              {orderedAddOns.length > 0 && (
                <div className="mt-6 pt-5 border-t border-gray-100">
                  <div className="flex items-center gap-2 mb-3">
                    <Tag className="h-4 w-4 text-gray-500" />
                    <h3 className="text-sm font-medium text-gray-700">Add-ons</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {orderedAddOns.map((addon) => {
                      const maxQty = addon.max_quantity ?? 99;
                      const currentQty = selectedAddOns[addon.id] || 0;

                      return (
                        <div key={addon.id} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                          <div className="w-10 h-10 flex-shrink-0 flex items-center justify-center bg-gray-100 rounded-md overflow-hidden">
                            {addon.image ? (
                              <img src={ASSET_URL + addon.image} alt={addon.name} className="object-cover w-full h-full" />
                            ) : (
                              <span className="text-gray-400 text-[8px]">No Img</span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="font-medium text-gray-800 text-xs truncate block">{addon.name}</span>
                            <span className="block text-[10px] text-gray-500">${parseFloat(addon.price).toFixed(2)} each</span>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button
                              type="button"
                              className="w-6 h-6 rounded bg-white border border-gray-300 text-gray-800 flex items-center justify-center text-xs font-semibold disabled:opacity-50"
                              onClick={() => handleAddOnQty(addon.id, currentQty - 1)}
                              disabled={currentQty <= 0}
                            >
                              -
                            </button>
                            <span className="w-6 text-center text-xs font-medium">{currentQty}</span>
                            <button
                              type="button"
                              className="w-6 h-6 rounded bg-white border border-gray-300 text-gray-800 flex items-center justify-center text-xs font-semibold disabled:opacity-50"
                              onClick={() => handleAddOnQty(addon.id, currentQty + 1)}
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
            </div>
          )}

          {/* 4. Payment Method — only when event is selected */}
          {event && !loading && (
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center gap-2 mb-4">
                <Banknote className="h-5 w-5 text-gray-500" />
                <h2 className="text-lg font-semibold text-gray-800">Payment</h2>
              </div>

              <div className="grid grid-cols-3 gap-2 mb-4">
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
                  onClick={() => setPaymentMethod('in-store')}
                  icon={DollarSign}
                >
                  In-Store
                </StandardButton>

                <button
                  type="button"
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

              {/* Pay Later Notice */}
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

              {/* Card Payment Form */}
              {paymentMethod === 'authorize.net' && (
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
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

                  {/* Expiration and CVV */}
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

                  {/* Error Message */}
                  {paymentError && (
                    <div className="mt-3 bg-red-50 border border-red-200 rounded-lg p-2 text-xs text-red-800">
                      {paymentError}
                    </div>
                  )}

                  {/* Security Notice */}
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

        {/* Right Column - Order Summary */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow-sm p-6 sticky top-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Order Summary</h2>

            {event ? (
              <>
                {/* Selected Event Card */}
                <div className="flex items-start gap-3 mb-4 p-3 bg-gray-50 rounded-lg">
                  <div className="w-14 h-14 flex-shrink-0 rounded-md overflow-hidden bg-gray-100 border border-gray-200">
                    {event.image ? (
                      <img src={event.image} alt={event.name} className="object-cover w-full h-full" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">N/A</div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-1">
                      <h3 className="font-semibold text-gray-800 text-sm truncate">{event.name}</h3>
                      <button onClick={changeEvent} className="text-gray-400 hover:text-gray-600 flex-shrink-0 p-0.5">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <p className="text-xs text-gray-500">{event.location?.name || 'No location'}</p>
                    <p className={`text-sm font-bold text-${themeColor}-600 mt-1`}>
                      ${parseFloat(event.price).toFixed(2)}
                    </p>
                  </div>
                </div>

                {/* Line Items */}
                <div className="space-y-2 text-sm mb-4">
                  <div className="flex justify-between text-gray-600">
                    <span>Qty: {quantity} × ${eventPrice.toFixed(2)}</span>
                    <span className="font-medium">${calculateSubtotal().toFixed(2)}</span>
                  </div>
                  {/* Selected Add-ons */}
                  {Object.entries(selectedAddOns).filter(([, qty]) => qty > 0).map(([idStr, qty]) => {
                    const addOn = event.add_ons?.find(a => a.id === Number(idStr));
                    if (!addOn) return null;
                    return (
                      <div key={idStr} className="flex justify-between text-gray-600">
                        <span className="truncate pr-2">{addOn.name} × {qty}</span>
                        <span className="font-medium">${(parseFloat(addOn.price) * qty).toFixed(2)}</span>
                      </div>
                    );
                  })}
                  {discount > 0 && (
                    <div className="flex justify-between text-red-600">
                      <span>Discount</span>
                      <span>-${discount.toFixed(2)}</span>
                    </div>
                  )}
                </div>

                {/* Total */}
                <div className="border-t border-gray-200 pt-3 mb-4">
                  <div className="flex justify-between font-bold text-lg">
                    <span>Total</span>
                    <span>${calculateTotal().toFixed(2)}</span>
                  </div>
                  {paymentMethod === 'paylater' && (
                    <div className="flex justify-between font-semibold text-sm mt-1 text-orange-700">
                      <span>Amount Due Now</span>
                      <span>$0.00</span>
                    </div>
                  )}
                </div>

                {/* Send Email Receipt */}
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

                {/* Complete Purchase */}
                <StandardButton
                  variant="primary"
                  size="lg"
                  onClick={handleSubmit}
                  disabled={submitting}
                  loading={submitting}
                  icon={ShoppingCart}
                  fullWidth
                >
                  {submitting ? 'Processing...' : 'Complete Purchase'}
                </StandardButton>
              </>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <ShoppingCart className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>Select an event to begin</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OnsitePurchaseEvent;
