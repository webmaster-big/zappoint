import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Calendar,
  Clock,
  MapPin,
  CheckCircle,
  ShoppingCart,
  Users,
  Star,
  Shield,
  Zap,
  Tag,
  DollarSign,
} from 'lucide-react';
import { eventService } from '../../services/EventService';
import { eventPurchaseService } from '../../services/EventPurchaseService';
import { customerService, type Customer } from '../../services/CustomerService';
import { getImageUrl, ASSET_URL } from '../../utils/storage';
import { loadAcceptJS, processCardPayment, validateCardNumber, formatCardNumber, getCardType, PAYMENT_TYPE } from '../../services/PaymentService';
import { getAuthorizeNetPublicKey } from '../../services/SettingsService';
import { generatePurchaseQRCode } from '../../utils/qrcode';
import { extractIdFromSlug } from '../../utils/slug';
import Toast from '../../components/ui/Toast';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import SignatureCapture from '../../components/SignatureCapture';
import TermsAndConditionsCheckbox from '../../components/TermsAndConditionsCheckbox';
import StandardButton from '../../components/ui/StandardButton';
import type { FeeBreakdown } from '../../types/FeeSupport.types';
import { buildAppliedFees } from '../../utils/fees';
import { buildAppliedDiscounts } from '../../utils/discounts';
import { feeSupportService } from '../../services/FeeSupportService';
import { specialPricingService } from '../../services/SpecialPricingService';
import type { SpecialPricingBreakdown } from '../../types/SpecialPricing.types';
import type { Event, EventAddOn } from '../../types/event.types';

// Country codes (ISO 3166-1 alpha-2) with display names
const countries: { code: string; name: string }[] = [
  { code: 'US', name: 'United States' },
  { code: 'CA', name: 'Canada' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'AU', name: 'Australia' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'IT', name: 'Italy' },
  { code: 'ES', name: 'Spain' },
  { code: 'MX', name: 'Mexico' },
  { code: 'BR', name: 'Brazil' },
  { code: 'JP', name: 'Japan' },
  { code: 'CN', name: 'China' },
  { code: 'IN', name: 'India' },
  { code: 'KR', name: 'South Korea' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'BE', name: 'Belgium' },
  { code: 'CH', name: 'Switzerland' },
  { code: 'AT', name: 'Austria' },
  { code: 'SE', name: 'Sweden' },
  { code: 'NO', name: 'Norway' },
  { code: 'DK', name: 'Denmark' },
  { code: 'FI', name: 'Finland' },
  { code: 'IE', name: 'Ireland' },
  { code: 'PT', name: 'Portugal' },
  { code: 'PL', name: 'Poland' },
  { code: 'NZ', name: 'New Zealand' },
  { code: 'SG', name: 'Singapore' },
  { code: 'HK', name: 'Hong Kong' },
  { code: 'PH', name: 'Philippines' },
  { code: 'TH', name: 'Thailand' },
  { code: 'MY', name: 'Malaysia' },
  { code: 'ID', name: 'Indonesia' },
  { code: 'VN', name: 'Vietnam' },
  { code: 'AE', name: 'United Arab Emirates' },
  { code: 'SA', name: 'Saudi Arabia' },
  { code: 'IL', name: 'Israel' },
  { code: 'ZA', name: 'South Africa' },
  { code: 'AR', name: 'Argentina' },
  { code: 'CL', name: 'Chile' },
  { code: 'CO', name: 'Colombia' },
  { code: 'PE', name: 'Peru' },
];

// Helper function to parse payment errors into user-friendly messages
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getPaymentErrorMessage = (error: any): string => {
  const errorMessage = error?.message?.toLowerCase() || '';
  const responseMessage = error?.response?.data?.message?.toLowerCase() || '';
  const combinedMessage = `${errorMessage} ${responseMessage}`;

  if (combinedMessage.includes('declined') || combinedMessage.includes('decline')) {
    return 'Your card was declined. Please check your card details or try a different payment method.';
  }
  if (combinedMessage.includes('expired') || combinedMessage.includes('expiration')) {
    return 'Your card has expired. Please use a different card.';
  }
  if (combinedMessage.includes('cvv') || combinedMessage.includes('security code') || combinedMessage.includes('cvc')) {
    return 'Invalid security code (CVV). Please check the 3 or 4 digit code on your card.';
  }
  if (combinedMessage.includes('authentication') || combinedMessage.includes('3d secure')) {
    return 'Card authentication failed. Please try again or use a different card.';
  }
  if (combinedMessage.includes('network') || combinedMessage.includes('connection') || combinedMessage.includes('timeout')) {
    return 'Connection error. Please check your internet and try again.';
  }
  if (combinedMessage.includes('fraud') || combinedMessage.includes('suspicious')) {
    return 'Transaction blocked for security reasons. Please contact your bank or try a different card.';
  }
  if (combinedMessage.includes('too many') || combinedMessage.includes('rate limit')) {
    return 'Too many attempts. Please wait a moment and try again.';
  }
  return error?.message || 'Payment could not be processed. Please check your card details and try again.';
};



const PurchaseEvent = () => {
  const { eventId: rawEventId, slug } = useParams<{ eventId?: string; slug?: string }>();
  const eventId = rawEventId ?? (slug ? String(extractIdFromSlug(slug)) : undefined);
  const navigate = useNavigate();

  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Date & time
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState('');
  const [timeSlots, setTimeSlots] = useState<string[]>([]);
  const [selectedTime, setSelectedTime] = useState('');
  const [loadingSlots, setLoadingSlots] = useState(false);

  // Purchase
  const [quantity, setQuantity] = useState(1);
  const [selectedAddOns, setSelectedAddOns] = useState<Record<number, number>>({});

  // Customer info
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [specialRequests, setSpecialRequests] = useState('');

  // Payment card details
  const [cardNumber, setCardNumber] = useState('');
  const [cardMonth, setCardMonth] = useState('');
  const [cardYear, setCardYear] = useState('');
  const [cardCVV, setCardCVV] = useState('');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [authorizeApiLoginId, setAuthorizeApiLoginId] = useState('');
  const [authorizeClientKey, setAuthorizeClientKey] = useState('');
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_authorizeEnvironment, setAuthorizeEnvironment] = useState<'sandbox' | 'production'>('sandbox');

  // Signature & Terms
  const [signatureImage, setSignatureImage] = useState<string | null>(null);
  const [termsAccepted, setTermsAccepted] = useState<boolean>(false);
  const [signatureTermsErrors, setSignatureTermsErrors] = useState<Record<string, string>>({});

  // Toast
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Dedup guard
  const isSubmittingRef = useRef(false);
  const lastSubmitTimeRef = useRef(0);

  // Billing address
  const [billingAddress, setBillingAddress] = useState('');
  const [billingAddress2, setBillingAddress2] = useState('');
  const [billingCity, setBillingCity] = useState('');
  const [billingState, setBillingState] = useState('');
  const [billingZip, setBillingZip] = useState('');
  const [billingCountry, setBillingCountry] = useState('US');

  // Multi-step form
  const [currentStep, setCurrentStep] = useState(1);
  const [purchaseComplete, setPurchaseComplete] = useState(false);

  // QR code confirmation
  const [qrCodeImage, setQrCodeImage] = useState<string | null>(null);
  const [showQRModal, setShowQRModal] = useState(false);

  // Account modal + mobile summary
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showMobileSummary, setShowMobileSummary] = useState(false);

  // Customer search
  const [foundCustomers, setFoundCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [searchingCustomer, setSearchingCustomer] = useState(false);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);

  // Country search
  const [countrySearch, setCountrySearch] = useState('');
  const [showCountrySuggestions, setShowCountrySuggestions] = useState(false);

  // SMS consent
  const [smsConsent, setSmsConsent] = useState(false);

  // Fee breakdown & special pricing
  const [feeBreakdown, setFeeBreakdown] = useState<FeeBreakdown | null>(null);
  const [specialPricingBreakdown, setSpecialPricingBreakdown] = useState<SpecialPricingBreakdown | null>(null);

  // Check if customer is logged in
  const customerData = (() => {
    try {
      const data = localStorage.getItem('zapzone_customer');
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  })();

  // Show account modal for non-logged-in users
  useEffect(() => {
    const data = localStorage.getItem('zapzone_customer');
    if (!data) {
      setShowAccountModal(true);
    }
  }, []);

  useEffect(() => {
    if (eventId) loadEvent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, slug]);

  useEffect(() => {
    if (selectedDate && event) loadTimeSlots(selectedDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  // Pre-fill customer info if logged in
  useEffect(() => {
    if (customerData) {
      setGuestName(customerData.name || `${customerData.first_name || ''} ${customerData.last_name || ''}`.trim() || '');
      setGuestEmail(customerData.email || '');
      setGuestPhone(customerData.phone || '');
      if (customerData.id) setSelectedCustomerId(customerData.id);
      // Billing
      if (customerData.address) setBillingAddress(customerData.address);
      if (customerData.address2) setBillingAddress2(customerData.address2);
      if (customerData.city) setBillingCity(customerData.city);
      if (customerData.state) setBillingState(customerData.state);
      if (customerData.zip) setBillingZip(customerData.zip);
      if (customerData.country) {
        setBillingCountry(customerData.country);
        const match = countries.find(c => c.code === customerData.country);
        if (match) setCountrySearch(match.name);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced customer search by email
  useEffect(() => {
    const searchCustomer = async () => {
      const email = guestEmail.trim();
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
        const exactMatch = response.data.find((c: Customer) => c.email.toLowerCase() === email.toLowerCase());
        if (exactMatch) {
          setSelectedCustomerId(exactMatch.id);
          setGuestName(`${exactMatch.first_name} ${exactMatch.last_name}`);
          setGuestPhone(exactMatch.phone || guestPhone);
        } else {
          setSelectedCustomerId(null);
        }
      } catch {
        setFoundCustomers([]);
        setShowCustomerDropdown(false);
      } finally {
        setSearchingCustomer(false);
      }
    };
    const timeoutId = setTimeout(searchCustomer, 500);
    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guestEmail]);

  // Initialize Authorize.Net
  useEffect(() => {
    const initializeAuthorizeNet = async () => {
      if (!event) return;
      try {
        const locationId = event.location_id || 1;
        const response = await getAuthorizeNetPublicKey(locationId);
        const apiLoginId = response.api_login_id;
        const clientKey = response.client_key;
        const environment = response.environment || 'sandbox';

        if (apiLoginId) {
          setAuthorizeApiLoginId(apiLoginId);
          setAuthorizeClientKey(clientKey || apiLoginId);
          setAuthorizeEnvironment(environment as 'sandbox' | 'production');
          await loadAcceptJS(environment as 'sandbox' | 'production');
        }
      } catch {
        // Payment system initialization failed - will show error when user tries to pay
      }
    };
    initializeAuthorizeNet();
  }, [event]);

  // Fetch fee breakdown when event or quantity/add-ons change
  useEffect(() => {
    if (!event) {
      setFeeBreakdown(null);
      return;
    }
    const timeoutId = setTimeout(async () => {
      try {
        const basePrice = (parseFloat(event.price) * quantity) +
          Object.entries(selectedAddOns).reduce((sum, [id, qty]) => {
            const addon = event.add_ons?.find(a => a.id === parseInt(id));
            return sum + (addon ? parseFloat(addon.price) * qty : 0);
          }, 0);
        const response = await feeSupportService.getForEntity({
          entity_type: 'event',
          entity_id: event.id,
          base_price: basePrice,
          location_id: event.location_id,
        });
        if (response.success && response.data) {
          setFeeBreakdown(response.data);
        }
      } catch {
        setFeeBreakdown(null);
      }
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [event, quantity, selectedAddOns]);

  // Fetch special pricing breakdown for event
  useEffect(() => {
    if (!event) {
      setSpecialPricingBreakdown(null);
      return;
    }
    const timeoutId = setTimeout(async () => {
      try {
        const pricingDate = selectedDate || new Date().toISOString().split('T')[0];
        const basePrice = (parseFloat(event.price) * quantity) +
          Object.entries(selectedAddOns).reduce((sum, [id, qty]) => {
            const addon = event.add_ons?.find(a => a.id === parseInt(id));
            return sum + (addon ? parseFloat(addon.price) * qty : 0);
          }, 0);
        const breakdown = await specialPricingService.getPriceBreakdown({
          entity_type: 'event',
          entity_id: event.id,
          base_price: basePrice,
          date: pricingDate,
          location_id: event.location_id,
        });
        if (breakdown.has_special_pricing) {
          setSpecialPricingBreakdown(breakdown);
        } else {
          setSpecialPricingBreakdown(null);
        }
      } catch {
        setSpecialPricingBreakdown(null);
      }
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [event, quantity, selectedAddOns, selectedDate]);

  const loadEvent = async () => {
    setLoading(true);
    try {
      const res = await eventService.getPublicEvent(parseInt(eventId!));
      if (!res.success || !res.data) {
        setError('Event not found');
        setLoading(false);
        return;
      }

      // Filter out past/inactive events
      const eventData = res.data;
      if (!eventData.is_active) {
        setError('This event is no longer available');
        setLoading(false);
        return;
      }
      const endDate = eventData.end_date || eventData.start_date;
      if (new Date(endDate) < new Date(new Date().toISOString().split('T')[0])) {
        setError('This event has already ended');
        setLoading(false);
        return;
      }

      setEvent(res.data);

      const dateRes = await eventService.getAvailableDates(parseInt(eventId!));
      setAvailableDates(dateRes.dates || []);

      if (res.data.date_type === 'one_time' && dateRes.dates?.length === 1) {
        setSelectedDate(dateRes.dates[0]);
      }
    } catch {
      setError('Failed to load event details');
    } finally {
      setLoading(false);
    }
  };

  const loadTimeSlots = async (date: string) => {
    setLoadingSlots(true);
    try {
      const res = await eventService.getAvailableTimeSlots(parseInt(eventId!), date);
      setTimeSlots(res.time_slots || []);
      setSelectedTime('');
    } catch {
      setTimeSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  };

  // Price
  const eventPrice = event ? parseFloat(event.price) : 0;
  const ticketSubtotal = eventPrice * quantity;
  const addOnTotal = event?.add_ons
    ? Object.entries(selectedAddOns).reduce((sum, [id, qty]) => {
        const addon = event.add_ons!.find(a => a.id === parseInt(id));
        return sum + (addon ? parseFloat(addon.price) * qty : 0);
      }, 0)
    : 0;
  const baseTotal = ticketSubtotal + addOnTotal;
  const specialPricingDiscount = specialPricingBreakdown?.has_special_pricing ? specialPricingBreakdown.total_discount : 0;
  const totalAfterSpecialPricing = Math.max(0, baseTotal - specialPricingDiscount);
  const totalAmount = feeBreakdown ? feeBreakdown.total - specialPricingDiscount : totalAfterSpecialPricing;

  const formatTime = (t: string) => {
    const [h, m] = t.split(':');
    const hour = parseInt(h);
    return `${hour % 12 || 12}:${m} ${hour >= 12 ? 'PM' : 'AM'}`;
  };

  const formatDate = (d: string) =>
    new Date(d.substring(0, 10) + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCardNumber(e.target.value);
    if (formatted.replace(/\s/g, '').length <= 16) {
      setCardNumber(formatted);
    }
  };

  const handlePurchase = async (e?: React.MouseEvent) => {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    setError('');
    setPaymentError('');

    if (!selectedDate || !selectedTime) {
      setError('Please select a date and time slot');
      return;
    }
    if (!guestName.trim()) {
      setError('Please enter your name');
      return;
    }
    if (!guestEmail.trim()) {
      setError('Please enter your email');
      return;
    }

    // Dedup guard
    const now = Date.now();
    if (isSubmittingRef.current) return;
    if (purchaseComplete) return;
    if (now - lastSubmitTimeRef.current < 3000) {
      setError('Please wait a moment before trying again.');
      return;
    }

    // localStorage-based dedup to survive page reloads
    const dedupFingerprint = `${eventId}-${guestEmail}-${quantity}-${totalAmount.toFixed(2)}`;
    const lastPurchaseKey = localStorage.getItem('_lastEventPurchaseKey');
    const lastPurchaseTime = Number(localStorage.getItem('_lastEventPurchaseTime') || '0');
    if (dedupFingerprint === lastPurchaseKey && now - lastPurchaseTime < 60000) {
      setToast({ message: 'This purchase was already submitted. Please wait before trying again.', type: 'error' });
      return;
    }

    // Validate signature and terms
    const stErrors: Record<string, string> = {};
    if (!signatureImage) {
      stErrors.signature = 'Please provide your signature before proceeding.';
    }
    if (!termsAccepted) {
      stErrors.terms = 'You must agree to the Terms & Conditions to proceed.';
    }
    if (Object.keys(stErrors).length > 0) {
      setSignatureTermsErrors(stErrors);
      isSubmittingRef.current = false;
      return;
    }
    setSignatureTermsErrors({});

    // Validate card information
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

    isSubmittingRef.current = true;
    lastSubmitTimeRef.current = now;

    try {
      setSubmitting(true);
      setIsProcessingPayment(true);
      setPaymentError('');

      const addOnsPayload = Object.entries(selectedAddOns).map(([id, qty]) => {
        const addon = event!.add_ons!.find(a => a.id === parseInt(id));
        return {
          add_on_id: parseInt(id),
          quantity: qty,
          price_at_purchase: addon ? parseFloat(addon.price) : 0,
        };
      });

      // Card data
      const cardData = {
        cardNumber: cardNumber.replace(/\s/g, ''),
        month: cardMonth,
        year: cardYear,
        cardCode: cardCVV,
      };

      // Customer billing data
      const [firstName, ...rest] = guestName.trim().split(' ');
      const customerBillingData = {
        first_name: firstName || guestName,
        last_name: rest.join(' ') || '',
        email: guestEmail,
        phone: guestPhone,
        address: billingAddress,
        address2: billingAddress2,
        city: billingCity,
        state: billingState,
        zip: billingZip,
        country: billingCountry,
      };

      // Step 1: Create event purchase FIRST (no charge yet)
      let response;
      try {
        response = await eventPurchaseService.createPurchase({
          event_id: parseInt(eventId!),
          customer_id: selectedCustomerId || customerData?.id || undefined,
          location_id: event!.location_id,
          guest_name: guestName,
          guest_email: guestEmail,
          guest_phone: guestPhone || undefined,
          sms_consent: smsConsent,
          purchase_date: selectedDate,
          purchase_time: selectedTime,
          quantity,
          total_amount: totalAmount,
          amount_paid: totalAmount,
          discount_amount: specialPricingDiscount > 0 ? specialPricingDiscount : undefined,
          payment_method: 'authorize.net',
          payment_status: 'pending',
          special_requests: specialRequests || undefined,
          send_email: false,
          applied_fees: buildAppliedFees(feeBreakdown).length > 0 ? buildAppliedFees(feeBreakdown) : undefined,
          applied_discounts: buildAppliedDiscounts(specialPricingBreakdown).length > 0 ? buildAppliedDiscounts(specialPricingBreakdown) : undefined,
          add_ons: addOnsPayload.length > 0 ? addOnsPayload : undefined,
        });
      } catch (createErr) {
        console.error('Purchase creation failed:', createErr);
        throw new Error('We couldn\'t process your order right now. No charges were made. Please try again.');
      }

      const createdPurchase = response.data;

      // Step 2: Generate QR code
      let qrData = '';
      try {
        qrData = await generatePurchaseQRCode(createdPurchase.id);
      } catch (qrErr) {
        console.error('QR code generation failed:', qrErr);
      }

      // Step 3: Charge payment WITH payable_id
      const paymentData = {
        location_id: event!.location_id,
        amount: totalAmount,
        order_id: `E${event!.id}-${Date.now().toString().slice(-8)}`,
        description: `Event Purchase: ${event!.name}`,
        customer_id: selectedCustomerId || customerData?.id || undefined,
        signature_image: signatureImage || undefined,
        terms_accepted: termsAccepted,
        payable_id: createdPurchase.id,
        payable_type: PAYMENT_TYPE.EVENT_PURCHASE,
        send_email: true,
        qr_code: qrData || undefined,
        applied_fees: buildAppliedFees(feeBreakdown).length > 0 ? buildAppliedFees(feeBreakdown) : null,
      };

      let paymentResponse;
      try {
        paymentResponse = await processCardPayment(
          cardData,
          paymentData,
          authorizeApiLoginId,
          authorizeClientKey,
          customerBillingData
        );
      } catch (paymentErr) {
        console.error('❌ Payment processing error, deleting purchase:', createdPurchase.id);
        try {
          await eventPurchaseService.deletePurchase(createdPurchase.id);
          console.log('🗑️ Purchase deleted due to payment processing error');
        } catch (deleteErr) {
          console.error('⚠️ Failed to delete purchase after payment error:', deleteErr);
        }
        throw paymentErr;
      }

      if (!paymentResponse.success) {
        console.error('❌ Payment failed, deleting purchase:', createdPurchase.id);
        try {
          await eventPurchaseService.deletePurchase(createdPurchase.id);
          console.log('🗑️ Purchase deleted due to payment failure');
        } catch (deleteErr) {
          console.error('⚠️ Failed to delete purchase after payment failure:', deleteErr);
        }
        throw new Error(paymentResponse.message || 'Your payment could not be processed. No charges were made. Please check your card details and try again.');
      }

      setQrCodeImage(qrData);
      setToast({ message: 'Purchase confirmed! Receipt sent to your email.', type: 'success' });

      // Store dedup fingerprint to prevent duplicate submissions
      localStorage.setItem('_lastEventPurchaseKey', dedupFingerprint);
      localStorage.setItem('_lastEventPurchaseTime', Date.now().toString());

      setPurchaseComplete(true);
      setCurrentStep(4);
      setShowQRModal(true);
    } catch (err: unknown) {
      const errorMsg = getPaymentErrorMessage(err);
      setPaymentError(errorMsg);
      setToast({ message: errorMsg, type: 'error' });
    } finally {
      setSubmitting(false);
      setIsProcessingPayment(false);
      isSubmittingRef.current = false;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner size="medium" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 text-lg">Event not found</p>
          <button onClick={() => navigate('/')} className="mt-4 text-blue-600 hover:underline">Go Home</button>
        </div>
      </div>
    );
  }

  // Ordered add-ons
  const orderedAddOns: EventAddOn[] = event
    ? (event.add_ons_order && event.add_ons
        ? event.add_ons_order.map(id => event.add_ons!.find(a => a.id === id)).filter(Boolean) as EventAddOn[]
        : event.add_ons || [])
    : [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50/40">

      {/* Account Modal */}
      {showAccountModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-fade-in" onClick={() => setShowAccountModal(false)}>
          <div className="bg-white max-w-sm w-full p-6 rounded-2xl shadow-2xl animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <div className="text-center mb-4">
              <div className="w-14 h-14 bg-gradient-to-br from-blue-100 to-blue-200 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <svg className="w-7 h-7 text-blue-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Create an Account?</h3>
              <p className="text-sm text-gray-500 leading-relaxed">Sign up for faster checkout and track your purchases.</p>
            </div>
            <div className="flex flex-col gap-2.5">
              <StandardButton variant="primary" size="md" onClick={() => navigate('/customer/register')} fullWidth>
                Create Account
              </StandardButton>
              <StandardButton variant="secondary" size="md" onClick={() => setShowAccountModal(false)} fullWidth>
                Continue as Guest
              </StandardButton>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes scale-in { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        .animate-fade-in { animation: fade-in 0.2s ease-out; }
        .animate-scale-in { animation: scale-in 0.3s ease-out; }
        @keyframes mobile-summary-fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes mobile-summary-slide-in { from { transform: translateX(-100%); } to { transform: translateX(0); } }
        .animate-mobile-summary-fade-in { animation: mobile-summary-fade-in 0.25s ease-out both; }
        .animate-mobile-summary-slide-in { animation: mobile-summary-slide-in 0.3s cubic-bezier(0.32,0.72,0,1) both; }
      `}</style>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">

          {/* Left Column - Purchase Form */}
          <div className="lg:col-span-2">
            <div className="bg-white shadow-md rounded-2xl overflow-hidden">

              {/* Progress Steps */}
              <div className="bg-gradient-to-r from-gray-50 to-white">
                <div className="px-4 md:px-6 py-4 md:py-5">
                  <div className="flex items-center justify-between mb-2">
                    {[1, 2, 3, 4].map(step => (
                      <div key={step} className="flex items-center">
                        <div className={`w-8 h-8 md:w-9 md:h-9 rounded-full flex items-center justify-center text-xs md:text-sm font-semibold transition-all ${
                          currentStep >= step
                            ? 'bg-gradient-to-br from-blue-700 to-blue-900 text-white shadow-md'
                            : 'bg-gray-100 text-gray-400'
                        }`}>
                          {currentStep > step ? '✓' : step}
                        </div>
                        {step < 4 && (
                          <div className={`w-8 md:w-16 h-1 mx-1 md:mx-2 rounded-full transition-all ${currentStep > step ? 'bg-blue-600' : 'bg-gray-200'}`} />
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between text-xs text-gray-500">
                    <span className="hidden sm:inline">Tickets</span><span className="sm:hidden">Qty</span>
                    <span className="hidden sm:inline">Your Info</span><span className="sm:hidden">Info</span>
                    <span>Payment</span>
                    <span className="hidden sm:inline">Confirmation</span><span className="sm:hidden">Done</span>
                  </div>
                </div>
              </div>

              {/* ── STEP 1: Date / Time / Quantity / Add-ons ── */}
              {currentStep === 1 && (
                <div className="p-4 md:p-6 space-y-4 md:space-y-6">
                  <div>
                    <h2 className="text-lg md:text-xl font-semibold text-gray-900 mb-1">Select Tickets</h2>
                    <p className="text-xs md:text-sm text-gray-600">Choose your date, time, and quantity</p>
                  </div>

                  {/* Date selection (date_range events) */}
                  {event.date_type === 'date_range' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-900 mb-2 flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-blue-500" /> Select Date
                      </label>
                      <select
                        value={selectedDate}
                        onChange={e => setSelectedDate(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition"
                      >
                        <option value="">Choose a date…</option>
                        {availableDates.map(d => (
                          <option key={d} value={d}>{formatDate(d)}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Time slots */}
                  {selectedDate && (
                    <div>
                      <label className="block text-sm font-medium text-gray-900 mb-2 flex items-center gap-2">
                        <Clock className="h-4 w-4 text-blue-500" /> Select Time
                      </label>
                      {loadingSlots ? (
                        <div className="flex items-center gap-2 text-sm text-gray-400 py-4">
                          <div className="w-4 h-4 border-2 border-gray-200 border-t-blue-500 rounded-full animate-spin" />
                          Loading…
                        </div>
                      ) : timeSlots.length === 0 ? (
                        <p className="text-sm text-gray-400 py-4">No available time slots for this date.</p>
                      ) : (
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                          {timeSlots.map(slot => (
                            <button
                              key={slot}
                              type="button"
                              onClick={() => setSelectedTime(slot)}
                              className={`px-3 py-2.5 text-sm rounded-lg border transition ${
                                selectedTime === slot
                                  ? 'bg-blue-700 text-white border-blue-700 shadow-sm'
                                  : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
                              }`}
                            >
                              {formatTime(slot)}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Quantity */}
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 md:p-8 shadow-sm">
                    <div className="flex items-center justify-center mb-4">
                      <ShoppingCart className="h-8 w-8 md:h-10 md:w-10 text-blue-600" />
                    </div>
                    <div className="flex items-center justify-center space-x-6 md:space-x-8">
                      <button
                        type="button"
                        onClick={() => setQuantity(Math.max(1, quantity - 1))}
                        disabled={quantity <= 1}
                        className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-white shadow-md text-gray-800 flex items-center justify-center text-xl md:text-2xl font-bold hover:bg-gray-50 hover:shadow-lg transition-all active:scale-95 disabled:opacity-40"
                      >−</button>
                      <div className="text-center">
                        <input
                          type="number"
                          value={quantity}
                          onChange={e => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                          onWheel={e => (e.target as HTMLInputElement).blur()}
                          min="1"
                          className="w-20 md:w-24 text-4xl md:text-5xl font-bold text-blue-800 text-center bg-transparent border-2 border-transparent hover:border-blue-300 focus:border-blue-500 focus:outline-none rounded-lg transition-colors mb-1"
                        />
                        <div className="text-xs md:text-sm text-gray-600">{quantity === 1 ? 'ticket' : 'tickets'}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setQuantity(quantity + 1)}
                        className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-white shadow-md text-gray-800 flex items-center justify-center text-xl md:text-2xl font-bold hover:bg-gray-50 hover:shadow-lg transition-all active:scale-95"
                      >+</button>
                    </div>
                  </div>

                  {/* Add-ons */}
                  {orderedAddOns.length > 0 && (
                    <div className="bg-gray-50/80 rounded-xl p-4 md:p-5">
                      <label className="block font-medium mb-3 text-gray-800 text-xs md:text-sm uppercase tracking-wide">Add-ons</label>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {orderedAddOns.map(addon => {
                          const maxQty = addon.max_quantity ?? 99;
                          const currentQty = selectedAddOns[addon.id] || 0;
                          return (
                            <div key={addon.id} className="flex items-center gap-2 p-2 md:p-3 rounded-lg bg-white">
                              {addon.image && (
                                <div className="w-10 h-10 md:w-12 md:h-12 flex-shrink-0 rounded-md overflow-hidden bg-gray-100">
                                  <img src={ASSET_URL + addon.image} alt={addon.name} className="object-cover w-full h-full" />
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <span className="font-medium text-gray-800 text-xs md:text-sm truncate block">{addon.name}</span>
                                <span className="text-[10px] md:text-xs text-gray-500">+${parseFloat(addon.price).toFixed(2)} each</span>
                              </div>
                              <div className="flex items-center gap-1 flex-shrink-0">
                                <button
                                  type="button"
                                  className="w-6 h-6 md:w-7 md:h-7 rounded-md bg-white border border-gray-300 flex items-center justify-center text-xs shadow-sm disabled:opacity-50"
                                  onClick={() => {
                                    const newQty = currentQty - 1;
                                    setSelectedAddOns(prev => {
                                      const copy = { ...prev };
                                      if (newQty <= 0) delete copy[addon.id]; else copy[addon.id] = newQty;
                                      return copy;
                                    });
                                  }}
                                  disabled={currentQty <= 0}
                                >−</button>
                                <span className="w-6 md:w-8 text-center text-xs md:text-sm font-medium">{currentQty}</span>
                                <button
                                  type="button"
                                  className="w-6 h-6 md:w-7 md:h-7 rounded-md bg-white border border-gray-300 flex items-center justify-center text-xs shadow-sm disabled:opacity-50"
                                  onClick={() => setSelectedAddOns(prev => ({ ...prev, [addon.id]: Math.min(maxQty, currentQty + 1) }))}
                                  disabled={currentQty >= maxQty}
                                >+</button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end">
                    <StandardButton
                      variant="primary"
                      size="md"
                      onClick={() => {
                        if (!selectedDate || !selectedTime) {
                          setError('Please select a date and time slot before continuing.');
                          return;
                        }
                        setError('');
                        setCurrentStep(2);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                    >
                      Continue →
                    </StandardButton>
                  </div>
                  {error && (
                    <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{error}</div>
                  )}
                </div>
              )}

              {/* ── STEP 2: Customer Info + Billing ── */}
              {currentStep === 2 && (
                <div className="p-4 md:p-6 space-y-4 md:space-y-6">
                  <div>
                    <h2 className="text-lg md:text-xl font-semibold text-gray-900 mb-1">Your Information</h2>
                    <p className="text-xs md:text-sm text-gray-600">Please provide your contact details for ticket delivery</p>
                  </div>

                  <div className="space-y-4">
                    {/* Email with customer search */}
                    <div className="relative">
                      <label className="block text-sm font-medium text-gray-900 mb-2">
                        Email Address <span className="text-red-500">*</span>
                        {selectedCustomerId && <span className="ml-2 text-emerald-600 text-xs font-normal">✓ Existing customer found</span>}
                      </label>
                      <input
                        type="email"
                        value={guestEmail}
                        onChange={e => setGuestEmail(e.target.value)}
                        onFocus={() => foundCustomers.length > 0 && setShowCustomerDropdown(true)}
                        onBlur={() => setTimeout(() => setShowCustomerDropdown(false), 200)}
                        placeholder="john.doe@example.com"
                        className={`w-full border rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition ${selectedCustomerId ? 'border-emerald-400 bg-emerald-50' : 'border-gray-300'}`}
                        required
                      />
                      {searchingCustomer && (
                        <div className="absolute right-3 top-11 text-gray-400">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400" />
                        </div>
                      )}
                      {showCustomerDropdown && foundCustomers.length > 0 && (
                        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                          {foundCustomers.map(customer => (
                            <div
                              key={customer.id}
                              onClick={() => {
                                setSelectedCustomerId(customer.id);
                                setGuestName(`${customer.first_name} ${customer.last_name}`);
                                setGuestEmail(customer.email);
                                setGuestPhone(customer.phone || '');
                                setShowCustomerDropdown(false);
                              }}
                              className={`p-3 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0 transition ${selectedCustomerId === customer.id ? 'bg-emerald-50' : ''}`}
                            >
                              <div className="font-medium text-gray-900">{customer.first_name} {customer.last_name}</div>
                              <div className="text-sm text-gray-600">{customer.email}</div>
                              {customer.phone && <div className="text-xs text-gray-500">{customer.phone}</div>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Name */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-900 mb-2">First Name <span className="text-red-500">*</span></label>
                        <input
                          type="text"
                          value={guestName.split(' ')[0] || ''}
                          onChange={e => setGuestName(`${e.target.value} ${guestName.split(' ').slice(1).join(' ')}`.trim())}
                          placeholder="John"
                          className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-900 mb-2">Last Name <span className="text-red-500">*</span></label>
                        <input
                          type="text"
                          value={guestName.split(' ').slice(1).join(' ') || ''}
                          onChange={e => setGuestName(`${guestName.split(' ')[0] || ''} ${e.target.value}`.trim())}
                          placeholder="Doe"
                          className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition"
                          required
                        />
                      </div>
                    </div>

                    {/* Phone + SMS */}
                    <div>
                      <label className="block text-sm font-medium text-gray-900 mb-2">Phone Number</label>
                      <input
                        type="tel"
                        value={guestPhone}
                        onChange={e => setGuestPhone(e.target.value)}
                        placeholder="+1 (555) 123-4567"
                        className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition"
                      />
                      <label className="flex items-start gap-2 cursor-pointer mt-2">
                        <input type="checkbox" checked={smsConsent} onChange={e => setSmsConsent(e.target.checked)} className="mt-1" />
                        <span className="text-xs text-gray-500">
                          I agree to receive automated delivery notifications and promotional text messages from Zap Zone at the phone number provided. Consent is not a condition of purchase. Message and data rates may apply. Reply STOP to cancel.
                        </span>
                      </label>
                    </div>

                    {/* Special requests */}
                    <div>
                      <label className="block text-sm font-medium text-gray-900 mb-2">Special Requests <span className="text-gray-400 text-xs">(Optional)</span></label>
                      <textarea
                        value={specialRequests}
                        onChange={e => setSpecialRequests(e.target.value)}
                        rows={2}
                        placeholder="Any special requirements…"
                        className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition"
                      />
                    </div>
                  </div>

                  {/* Billing Information */}
                  <div className="mt-6 pt-6 border-t border-gray-100">
                    <h4 className="text-base font-semibold text-gray-900 mb-4">Billing Information</h4>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-900 mb-2">Street Address <span className="text-red-500">*</span></label>
                        <input type="text" value={billingAddress} onChange={e => setBillingAddress(e.target.value)} placeholder="123 Main Street" className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition" required />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-900 mb-2">Apartment, Suite <span className="text-gray-400 text-xs">(Optional)</span></label>
                        <input type="text" value={billingAddress2} onChange={e => setBillingAddress2(e.target.value)} placeholder="Apt 4B, Suite 200, etc." className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition" />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-900 mb-2">City <span className="text-red-500">*</span></label>
                          <input type="text" value={billingCity} onChange={e => setBillingCity(e.target.value)} placeholder="City" className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition" required />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-900 mb-2">State / Province <span className="text-red-500">*</span></label>
                          <input type="text" value={billingState} onChange={e => setBillingState(e.target.value)} placeholder="State / Province" className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition" required />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-900 mb-2">ZIP / Postal Code <span className="text-red-500">*</span></label>
                          <input type="text" value={billingZip} onChange={e => setBillingZip(e.target.value)} placeholder="12345" className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition" required />
                        </div>
                        <div className="relative">
                          <label className="block text-sm font-medium text-gray-900 mb-2">Country <span className="text-red-500">*</span></label>
                          <input
                            type="text"
                            value={countrySearch}
                            onChange={e => {
                              setCountrySearch(e.target.value);
                              setShowCountrySuggestions(true);
                              const exact = countries.find(c => c.name.toLowerCase() === e.target.value.toLowerCase());
                              if (exact) setBillingCountry(exact.code);
                            }}
                            onFocus={() => {
                              if (!countrySearch && billingCountry) {
                                const sel = countries.find(c => c.code === billingCountry);
                                if (sel) setCountrySearch(sel.name);
                              }
                              setShowCountrySuggestions(true);
                            }}
                            onBlur={() => {
                              setTimeout(() => {
                                setShowCountrySuggestions(false);
                                const matched = countries.find(c => c.name.toLowerCase() === countrySearch.toLowerCase());
                                if (matched) { setBillingCountry(matched.code); setCountrySearch(matched.name); }
                                else if (billingCountry) {
                                  const sel = countries.find(c => c.code === billingCountry);
                                  if (sel) setCountrySearch(sel.name);
                                }
                              }, 200);
                            }}
                            placeholder="Type to search countries…"
                            className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition"
                            autoComplete="off"
                          />
                          {showCountrySuggestions && countrySearch && (
                            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                              {countries.filter(c => c.name.toLowerCase().includes(countrySearch.toLowerCase())).slice(0, 10).map(c => (
                                <button
                                  key={c.code}
                                  type="button"
                                  className={`w-full text-left px-4 py-2 hover:bg-blue-50 text-sm transition-colors ${c.code === billingCountry ? 'bg-blue-50 font-medium' : ''}`}
                                  onMouseDown={e => {
                                    e.preventDefault();
                                    setBillingCountry(c.code);
                                    setCountrySearch(c.name);
                                    setShowCountrySuggestions(false);
                                  }}
                                >{c.name}</button>
                              ))}
                              {countries.filter(c => c.name.toLowerCase().includes(countrySearch.toLowerCase())).length === 0 && (
                                <div className="px-4 py-2 text-sm text-gray-500">No countries found</div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-between gap-2 pt-4">
                    <StandardButton variant="secondary" size="md" onClick={() => setCurrentStep(1)}>
                      <span className="sm:hidden">←</span><span className="hidden sm:inline">← Back</span>
                    </StandardButton>
                    <StandardButton
                      variant="primary"
                      size="md"
                      onClick={() => {
                        setCurrentStep(3);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      disabled={!guestName.trim() || !guestEmail.trim() || !billingAddress || !billingCity || !billingState || !billingZip || !billingCountry}
                    >
                      Continue to Payment →
                    </StandardButton>
                  </div>
                </div>
              )}

              {/* ── STEP 3: Payment ── */}
              {currentStep === 3 && (
                <div className="p-4 md:p-6 space-y-4 md:space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h2 className="text-base md:text-lg font-semibold text-gray-900">Payment Information</h2>
                      <p className="text-xs md:text-sm text-gray-600 mt-0.5">Secure payment powered by Authorize.Net</p>
                    </div>
                    <div className="flex gap-1.5 md:gap-2">
                      <div className="h-5 md:h-6 lg:h-7 px-1.5 md:px-2 bg-gradient-to-br from-blue-800 to-blue-950 rounded flex items-center justify-center" title="Visa">
                        <span className="text-white text-[9px] md:text-[10px] lg:text-[11px] font-extrabold italic">VISA</span>
                      </div>
                      <div className="h-5 md:h-6 lg:h-7 w-8 md:w-10 lg:w-11 bg-gray-100 rounded flex items-center justify-center" title="Mastercard">
                        <svg viewBox="0 0 32 20" className="h-3.5 md:h-4 lg:h-5"><circle cx="12" cy="10" r="7" fill="#EB001B"/><circle cx="20" cy="10" r="7" fill="#F79E1B"/><path d="M16 4.6a7 7 0 010 10.8 7 7 0 010-10.8z" fill="#FF5F00"/></svg>
                      </div>
                      <div className="h-5 md:h-6 lg:h-7 px-1 md:px-1.5 bg-blue-500 rounded flex items-center justify-center" title="Amex">
                        <span className="text-white text-[7px] md:text-[8px] lg:text-[9px] font-bold">AMEX</span>
                      </div>
                      <div className="h-5 md:h-6 lg:h-7 px-1 md:px-1.5 bg-orange-500 rounded flex items-center justify-center" title="Discover">
                        <span className="text-white text-[6px] md:text-[7px] lg:text-[8px] font-bold">DISC</span>
                      </div>
                    </div>
                  </div>

                  {/* Card Form */}
                  <div className="space-y-4">
                    <div>
                      <label className="block font-medium mb-2 text-gray-800 text-xs md:text-sm">Card Number</label>
                      <div className="relative">
                        <input
                          type="text"
                          value={cardNumber}
                          onChange={handleCardNumberChange}
                          placeholder="1234 5678 9012 3456"
                          className={`w-full rounded-lg border px-3 md:px-4 py-2.5 md:py-3 text-xs md:text-sm font-mono focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition ${
                            cardNumber && validateCardNumber(cardNumber) ? 'border-emerald-400 bg-emerald-50' : cardNumber ? 'border-red-400' : 'border-gray-300'
                          }`}
                          maxLength={19}
                          disabled={isProcessingPayment}
                        />
                        {cardNumber && validateCardNumber(cardNumber) && (
                          <div className="absolute right-2 md:right-3 top-1/2 -translate-y-1/2">
                            <svg className="w-4 h-4 md:w-5 md:h-5 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                          </div>
                        )}
                      </div>
                      {cardNumber && <p className="text-xs mt-2 text-gray-600">{getCardType(cardNumber)}</p>}
                    </div>

                    <div className="grid grid-cols-3 gap-2 md:gap-4">
                      <div>
                        <label className="block font-medium mb-2 text-gray-800 text-xs md:text-sm">Exp Month</label>
                        <select value={cardMonth} onChange={e => setCardMonth(e.target.value)} className="w-full rounded-lg border border-gray-300 px-2 md:px-4 py-2.5 md:py-3 text-xs md:text-sm focus:ring-2 focus:ring-blue-600 focus:border-blue-600" disabled={isProcessingPayment}>
                          <option value="">MM</option>
                          {Array.from({ length: 12 }, (_, i) => { const m = (i + 1).toString().padStart(2, '0'); return <option key={m} value={m}>{m}</option>; })}
                        </select>
                      </div>
                      <div>
                        <label className="block font-medium mb-2 text-gray-800 text-xs md:text-sm">Exp Year</label>
                        <select value={cardYear} onChange={e => setCardYear(e.target.value)} className="w-full rounded-lg border border-gray-300 px-2 md:px-4 py-2.5 md:py-3 text-xs md:text-sm focus:ring-2 focus:ring-blue-600 focus:border-blue-600" disabled={isProcessingPayment}>
                          <option value="">YYYY</option>
                          {Array.from({ length: 10 }, (_, i) => { const y = (new Date().getFullYear() + i).toString(); return <option key={y} value={y}>{y}</option>; })}
                        </select>
                      </div>
                      <div>
                        <label className="block font-medium mb-2 text-gray-800 text-xs md:text-sm">CVV</label>
                        <input
                          type="text"
                          value={cardCVV}
                          onChange={e => { const v = e.target.value.replace(/\D/g, ''); if (v.length <= 4) setCardCVV(v); }}
                          placeholder="123"
                          className="w-full rounded-lg border border-gray-300 px-2 md:px-4 py-2.5 md:py-3 text-xs md:text-sm font-mono focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                          maxLength={4}
                          disabled={isProcessingPayment}
                        />
                      </div>
                    </div>

                    {paymentError && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-2.5 md:p-3 text-xs md:text-sm text-red-800 flex items-start gap-2">
                        <svg className="w-4 h-4 md:w-5 md:h-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                        <span>{paymentError}</span>
                      </div>
                    )}

                    <div className="bg-blue-50 rounded-lg p-2.5 md:p-3 flex items-start gap-2">
                      <svg className="w-4 h-4 md:w-5 md:h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                      </svg>
                      <div className="text-xs md:text-sm text-blue-900">
                        <p className="font-semibold">Secure Payment</p>
                        <p className="text-[10px] md:text-xs text-blue-800 mt-0.5">256-bit SSL encrypted • PCI compliant • Powered by Authorize.Net</p>
                      </div>
                    </div>
                  </div>

                  {/* Signature & Terms */}
                  <div className="space-y-4 mt-6 pt-6 border-t border-gray-100">
                    <h3 className="text-lg font-semibold">Signature & Agreement</h3>
                    <SignatureCapture
                      onSignatureChange={base64 => {
                        setSignatureImage(base64);
                        if (base64) setSignatureTermsErrors(prev => ({ ...prev, signature: '' }));
                      }}
                      required
                      error={signatureTermsErrors.signature}
                    />
                    <TermsAndConditionsCheckbox
                      checked={termsAccepted}
                      onChange={checked => {
                        setTermsAccepted(checked);
                        if (checked) setSignatureTermsErrors(prev => ({ ...prev, terms: '' }));
                      }}
                      required
                      error={signatureTermsErrors.terms}
                    />
                  </div>

                  <div className="flex justify-between gap-2 pt-2">
                    <StandardButton variant="secondary" size="md" onClick={() => setCurrentStep(2)} disabled={submitting}>
                      <span className="sm:hidden">←</span><span className="hidden sm:inline">← Back</span>
                    </StandardButton>
                    <button
                      type="button"
                      onClick={handlePurchase}
                      disabled={purchaseComplete || submitting || isProcessingPayment || !cardNumber || !cardMonth || !cardYear || !cardCVV || !validateCardNumber(cardNumber)}
                      className="py-2.5 md:py-3 px-3 md:px-6 rounded-lg bg-blue-800 text-white font-medium hover:bg-blue-900 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center text-xs md:text-base shadow-sm hover:shadow-md"
                    >
                      {isProcessingPayment ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 md:h-5 md:w-5 border-b-2 border-white mr-1.5 md:mr-2" />
                          <span className="hidden sm:inline">Processing Payment…</span><span className="sm:hidden">Processing…</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4 md:w-5 md:h-5 mr-1.5 md:mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                          </svg>
                          {submitting ? (
                            <><span className="hidden sm:inline">Processing…</span><span className="sm:hidden">Wait…</span></>
                          ) : (
                            <><span className="hidden sm:inline">Pay ${totalAmount.toFixed(2)}</span><span className="sm:hidden">${totalAmount.toFixed(2)}</span></>
                          )}
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* ── STEP 4: Confirmation ── */}
              {currentStep === 4 && purchaseComplete && (
                <div className="p-4 md:p-6">
                  <div className="text-center mb-6">
                    <CheckCircle className="h-16 w-16 text-emerald-500 mx-auto mb-4" />
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Purchase Confirmed!</h2>
                    <p className="text-gray-600 mb-2">Your tickets for <span className="font-semibold text-gray-900">{event.name}</span> have been confirmed.</p>
                    <p className="text-sm text-gray-500">A confirmation email has been sent to <span className="font-medium text-gray-700">{guestEmail}</span></p>
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                    <h3 className="font-semibold text-blue-900 mb-3 flex items-center">
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                      Customer Information
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                      <p><span className="text-gray-600">Name:</span> <span className="font-medium text-gray-900">{guestName}</span></p>
                      <p><span className="text-gray-600">Email:</span> <span className="font-medium text-gray-900">{guestEmail}</span></p>
                      {guestPhone && <p><span className="text-gray-600">Phone:</span> <span className="font-medium text-gray-900">{guestPhone}</span></p>}
                    </div>
                  </div>

                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
                    <h3 className="font-semibold text-gray-900 mb-3 flex items-center">
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                      Purchase Details
                    </h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between"><span className="text-gray-600">Event:</span><span className="font-medium text-gray-900">{event.name}</span></div>
                      {event.location && <div className="flex justify-between"><span className="text-gray-600">Location:</span><span className="font-medium text-gray-900">{event.location.name}</span></div>}
                      <div className="flex justify-between"><span className="text-gray-600">Date:</span><span className="font-medium text-gray-900">{formatDate(selectedDate)}</span></div>
                      <div className="flex justify-between"><span className="text-gray-600">Time:</span><span className="font-medium text-gray-900">{formatTime(selectedTime)}</span></div>
                      <div className="flex justify-between"><span className="text-gray-600">Tickets:</span><span className="font-medium text-gray-900">{quantity}</span></div>
                      <div className="flex justify-between"><span className="text-gray-600">Payment Method:</span><span className="font-medium text-gray-900">Credit/Debit Card</span></div>
                      <div className="pt-3 mt-3 flex justify-between"><span className="text-gray-900 font-semibold">Total Paid:</span><span className="text-lg font-bold text-emerald-600">${totalAmount.toFixed(2)}</span></div>
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded-xl p-4 mb-6">
                    <h3 className="font-semibold text-gray-900 mb-3 flex items-center">
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                      Billing Address
                    </h3>
                    <div className="text-sm text-gray-700">
                      <p className="font-medium">{billingAddress}</p>
                      {billingAddress2 && <p>{billingAddress2}</p>}
                      <p>{billingCity}, {billingState} {billingZip}</p>
                      <p>{countries.find(c => c.code === billingCountry)?.name || billingCountry}</p>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row justify-center gap-3">
                    <StandardButton variant="secondary" size="md" onClick={() => navigate('/')}>Back to Home</StandardButton>
                    <StandardButton variant="primary" size="md" onClick={() => navigate('/my-purchases')}>View My Purchases</StandardButton>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Event Summary (hidden on mobile, shown on lg+) */}
          <div className="lg:col-span-1 hidden lg:block">
            <div className="bg-white shadow-md rounded-2xl overflow-hidden lg:sticky lg:top-8">
              {event.image && (
                <div className="h-48 overflow-hidden bg-gray-100">
                  <img src={getImageUrl(event.image)} alt={event.name} className="w-full h-full object-cover" />
                </div>
              )}
              <div className="p-4 md:p-6">
                <div className="mb-4">
                  <h2 className="text-lg md:text-xl font-bold text-gray-900 mb-1">{event.name}</h2>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {event.location && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        <MapPin className="h-3 w-3 mr-1" />{event.location.name}
                      </span>
                    )}
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                      <Calendar className="h-3 w-3 mr-1" />
                      {event.date_type === 'one_time' ? formatDate(event.start_date) : `${formatDate(event.start_date)} – ${formatDate(event.end_date!)}`}
                    </span>
                  </div>
                  {event.description && <p className="text-sm text-gray-500 leading-relaxed whitespace-pre-line">{event.description}</p>}
                </div>

                {/* Event details */}
                <div className="grid grid-cols-2 gap-3 mb-5">
                  <div className="flex items-start gap-2">
                    <div className="p-2 bg-blue-50 rounded-xl"><Clock className="h-4 w-4 text-blue-600" /></div>
                    <div><p className="text-xs text-gray-400">Time</p><p className="text-sm font-medium text-gray-900">{formatTime(event.time_start)} – {formatTime(event.time_end)}</p></div>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="p-2 bg-blue-50 rounded-xl"><DollarSign className="h-4 w-4 text-blue-600" /></div>
                    <div><p className="text-xs text-gray-400">Price</p><p className="text-sm font-medium text-gray-900">${eventPrice.toFixed(2)} / ticket</p></div>
                  </div>
                  {event.max_bookings_per_slot && (
                    <div className="flex items-start gap-2">
                      <div className="p-2 bg-blue-50 rounded-xl"><Users className="h-4 w-4 text-blue-600" /></div>
                      <div><p className="text-xs text-gray-400">Capacity</p><p className="text-sm font-medium text-gray-900">Up to {event.max_bookings_per_slot}</p></div>
                    </div>
                  )}
                </div>

                {/* Features list */}
                {event.features && event.features.length > 0 && (
                  <div className="mb-5">
                    <div className="flex items-center gap-2 mb-2">
                      <Tag className="h-4 w-4 text-blue-600" />
                      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Features</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {event.features.map((feature, i) => (
                        <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
                          <CheckCircle className="h-3 w-3 flex-shrink-0" />
                          {feature}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Order Summary */}
                <div className="pt-4 border-t border-gray-100">
                  <h3 className="font-bold text-gray-900 mb-3 text-sm md:text-base">Order Summary</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs md:text-sm text-gray-500">Price per ticket</span>
                      <span className="font-medium text-sm md:text-base">${eventPrice.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs md:text-sm text-gray-500">Quantity</span>
                      <span className="font-medium text-sm md:text-base">{quantity}</span>
                    </div>
                    {selectedDate && (
                      <div className="flex justify-between items-center">
                        <span className="text-xs md:text-sm text-gray-500">Date</span>
                        <span className="font-medium text-xs md:text-sm">{formatDate(selectedDate)}</span>
                      </div>
                    )}
                    {selectedTime && (
                      <div className="flex justify-between items-center">
                        <span className="text-xs md:text-sm text-gray-500">Time</span>
                        <span className="font-medium text-xs md:text-sm">{formatTime(selectedTime)}</span>
                      </div>
                    )}
                    {Object.entries(selectedAddOns).filter(([, qty]) => qty > 0).length > 0 && (
                      <div className="mt-2 pt-2 border-t border-gray-200 space-y-1.5">
                        <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">Add-ons</span>
                        {Object.entries(selectedAddOns).filter(([, qty]) => qty > 0).map(([idStr, qty]) => {
                          const addon = event.add_ons?.find(a => a.id === Number(idStr));
                          if (!addon) return null;
                          return (
                            <div key={idStr} className="flex justify-between items-center">
                              <span className="text-xs text-gray-500 truncate pr-2">{addon.name} × {qty}</span>
                              <span className="font-medium text-xs md:text-sm">${(parseFloat(addon.price) * qty).toFixed(2)}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <div className="bg-gradient-to-r from-blue-800 to-blue-900 rounded-xl p-3.5 mt-4">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-white text-sm">Total</span>
                      <span className="text-xl md:text-2xl font-extrabold text-white">${totalAmount.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* Trust badges */}
                <div className="mt-5 bg-gray-50 rounded-xl p-3">
                  <div className="flex items-center justify-around text-xs text-gray-500">
                    <div className="text-center"><Shield className="h-4 w-4 mx-auto mb-1" /><span>Secure</span></div>
                    <div className="text-center"><Zap className="h-4 w-4 mx-auto mb-1" /><span>Instant</span></div>
                    <div className="text-center"><Star className="h-4 w-4 mx-auto mb-1" /><span>Best Price</span></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Floating Summary Button */}
      <button
        onClick={() => setShowMobileSummary(true)}
        className="fixed top-4 left-4 z-40 lg:hidden bg-gradient-to-r from-blue-800 to-blue-900 text-white px-4 py-2.5 rounded-full shadow-lg flex items-center gap-2 hover:from-blue-900 hover:to-blue-950 active:scale-95 transition-all duration-200"
        aria-label="View Order Summary"
      >
        <ShoppingCart className="w-4 h-4" />
        <span className="text-sm font-medium">${totalAmount.toFixed(2)}</span>
      </button>

      {/* Mobile Order Summary Sidebar */}
      {showMobileSummary && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50 animate-mobile-summary-fade-in" onClick={() => setShowMobileSummary(false)} />
          <div className="absolute top-0 left-0 h-full w-[85vw] max-w-sm bg-white shadow-2xl animate-mobile-summary-slide-in overflow-y-auto rounded-r-2xl">
            <div className="sticky top-0 bg-gradient-to-r from-blue-800 to-blue-900 px-4 py-4 flex items-center justify-between z-10 rounded-tr-2xl">
              <h3 className="font-bold text-lg text-white">Order Summary</h3>
              <button onClick={() => setShowMobileSummary(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/20 transition-colors">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-4">
              {event.image && (
                <div className="relative h-48 rounded-xl overflow-hidden mb-4">
                  <img src={getImageUrl(event.image)} alt={event.name} className="w-full h-full object-cover" />
                </div>
              )}
              <div className="mb-4">
                <h2 className="text-lg font-bold text-gray-900 mb-1">{event.name}</h2>
                {event.location && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    <MapPin className="h-3 w-3 mr-1" />{event.location.name}
                  </span>
                )}
              </div>
              <div className="pt-4 border-t border-gray-100">
                <div className="space-y-2">
                  <div className="flex justify-between items-center"><span className="text-xs text-gray-500">Price per ticket</span><span className="font-medium text-sm">${eventPrice.toFixed(2)}</span></div>
                  <div className="flex justify-between items-center"><span className="text-xs text-gray-500">Quantity</span><span className="font-medium text-sm">{quantity}</span></div>
                  {selectedDate && <div className="flex justify-between items-center"><span className="text-xs text-gray-500">Date</span><span className="font-medium text-xs">{formatDate(selectedDate)}</span></div>}
                  {selectedTime && <div className="flex justify-between items-center"><span className="text-xs text-gray-500">Time</span><span className="font-medium text-xs">{formatTime(selectedTime)}</span></div>}
                  {Object.entries(selectedAddOns).filter(([, qty]) => qty > 0).length > 0 && (
                    <div className="mt-2 pt-2 border-t border-gray-200 space-y-1.5">
                      <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">Add-ons</span>
                      {Object.entries(selectedAddOns).filter(([, qty]) => qty > 0).map(([idStr, qty]) => {
                        const addon = event.add_ons?.find(a => a.id === Number(idStr));
                        if (!addon) return null;
                        return (
                          <div key={idStr} className="flex justify-between items-center">
                            <span className="text-xs text-gray-500 truncate pr-2">{addon.name} × {qty}</span>
                            <span className="font-medium text-xs">${(parseFloat(addon.price) * qty).toFixed(2)}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                <div className="bg-gradient-to-r from-blue-800 to-blue-900 rounded-xl p-3.5 mt-4">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-white text-sm">Total</span>
                    <span className="text-xl font-extrabold text-white">${totalAmount.toFixed(2)}</span>
                  </div>
                </div>
              </div>
              <div className="mt-5 bg-gray-50 rounded-xl p-3">
                <div className="flex items-center justify-around text-xs text-gray-500">
                  <div className="text-center"><Shield className="h-4 w-4 mx-auto mb-1" /><span>Secure</span></div>
                  <div className="text-center"><Zap className="h-4 w-4 mx-auto mb-1" /><span>Instant</span></div>
                  <div className="text-center"><Star className="h-4 w-4 mx-auto mb-1" /><span>Best Price</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* QR Code Confirmation Modal */}
      {showQRModal && qrCodeImage && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-4 sm:p-6 max-h-[calc(100vh-2rem)] overflow-y-auto shadow-2xl">
            <div className="text-center mb-4">
              <div className="mx-auto w-14 h-14 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-2xl flex items-center justify-center mb-3 shadow-lg">
                <CheckCircle className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-xl sm:text-2xl font-extrabold text-gray-900 mb-2">Purchase Confirmed!</h3>
              <p className="text-sm text-gray-500">Your tickets have been confirmed</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-4 sm:p-6 mb-4">
              <div className="flex flex-col items-center">
                <img src={qrCodeImage} alt="Purchase QR Code" className="w-48 h-48 sm:w-64 sm:h-64 rounded-xl shadow-sm mb-3" />
                <p className="text-xs sm:text-sm text-gray-600">Scan this QR code at the entrance</p>
              </div>
            </div>
            <div className="bg-blue-50 rounded-xl p-4 sm:p-6 mb-4">
              <h3 className="font-semibold text-base sm:text-lg mb-3 text-gray-800">Purchase Details</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-gray-600">Event:</span><span className="font-medium text-gray-900 text-right ml-2">{event.name}</span></div>
                {event.location && <div className="flex justify-between"><span className="text-gray-600">Location:</span><span className="font-medium text-gray-900">{event.location.name}</span></div>}
                <div className="flex justify-between"><span className="text-gray-600">Guest Name:</span><span className="font-medium text-gray-900">{guestName}</span></div>
                <div className="flex justify-between"><span className="text-gray-600">Email:</span><span className="font-medium text-gray-900 text-right ml-2 break-all">{guestEmail}</span></div>
                <div className="flex justify-between"><span className="text-gray-600">Date:</span><span className="font-medium text-gray-900">{formatDate(selectedDate)}</span></div>
                <div className="flex justify-between"><span className="text-gray-600">Time:</span><span className="font-medium text-gray-900">{formatTime(selectedTime)}</span></div>
                <div className="flex justify-between"><span className="text-gray-600">Quantity:</span><span className="font-medium text-gray-900">{quantity} {quantity === 1 ? 'ticket' : 'tickets'}</span></div>
                <div className="flex justify-between pt-3 mt-3"><span className="text-gray-600 font-semibold">Total Paid:</span><span className="font-bold text-emerald-600 text-lg sm:text-xl">${totalAmount.toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-gray-600">Payment Method:</span><span className="font-medium text-gray-900">Credit/Debit Card</span></div>
              </div>
            </div>
            <div className="bg-yellow-50 rounded-lg p-3 mb-4">
              <div className="flex">
                <svg className="w-5 h-5 text-yellow-600 mr-2 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                <div className="text-xs sm:text-sm text-yellow-800">
                  <p className="font-semibold mb-1">Important Information</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Receipt sent to {guestEmail}</li>
                    <li>Please present this QR code at the entrance</li>
                    <li>Save or screenshot this confirmation for your records</li>
                  </ul>
                </div>
              </div>
            </div>
            <div className="flex justify-center">
              <StandardButton variant="primary" size="md" onClick={() => { setShowQRModal(false); navigate('/'); }}>Done</StandardButton>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </div>
  );
};

export default PurchaseEvent;
