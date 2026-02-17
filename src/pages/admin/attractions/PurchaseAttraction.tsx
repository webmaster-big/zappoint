import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Users, 
  MapPin, 
  CheckCircle,
  Star,
  Shield,
  Zap,
  ShoppingCart,
  ChevronLeft,
  ChevronRight,
  Tag,
  Clock,
  DollarSign
} from 'lucide-react';
import { formatDurationDisplay } from '../../../utils/timeFormat';
import type { PurchaseAttractionAttraction, PurchaseAttractionCustomerInfo } from '../../../types/PurchaseAttraction.types';
import { attractionService, type Attraction } from '../../../services/AttractionService';
import { attractionPurchaseService } from '../../../services/AttractionPurchaseService';
import { customerService, type Customer } from '../../../services/CustomerService';
import { generatePurchaseQRCode } from '../../../utils/qrcode';
import Toast from '../../../components/ui/Toast';
import { ASSET_URL } from '../../../utils/storage';
import { loadAcceptJS, processCardPayment, validateCardNumber, formatCardNumber, getCardType, PAYMENT_TYPE } from '../../../services/PaymentService';
import { getAuthorizeNetPublicKey } from '../../../services/SettingsService';
import { extractIdFromSlug } from '../../../utils/slug';
import StandardButton from '../../../components/ui/StandardButton';
import SignatureCapture from '../../../components/SignatureCapture';
import TermsAndConditionsCheckbox from '../../../components/TermsAndConditionsCheckbox';
import { feeSupportService } from '../../../services/FeeSupportService';
import type { FeeBreakdown } from '../../../types/FeeSupport.types';
import PriceBreakdownDisplay from '../../../components/ui/PriceBreakdownDisplay';
import { specialPricingService } from '../../../services/SpecialPricingService';
import type { SpecialPricingBreakdown } from '../../../types/SpecialPricing.types';

// Helper function to parse payment errors into user-friendly messages
const getPaymentErrorMessage = (error: any): string => {
  const errorMessage = error?.message?.toLowerCase() || '';
  const responseMessage = error?.response?.data?.message?.toLowerCase() || '';
  const combinedMessage = `${errorMessage} ${responseMessage}`;
  
  // Card declined errors
  if (combinedMessage.includes('declined') || combinedMessage.includes('decline')) {
    return 'Your card was declined. Please check your card details or try a different payment method.';
  }
  
  // Insufficient funds
  if (combinedMessage.includes('insufficient') || combinedMessage.includes('nsf')) {
    return 'Insufficient funds. Please try a different card or payment method.';
  }
  
  // Invalid card number
  if (combinedMessage.includes('invalid card') || combinedMessage.includes('card number')) {
    return 'Invalid card number. Please check and re-enter your card details.';
  }
  
  // Expired card
  if (combinedMessage.includes('expired') || combinedMessage.includes('expiration')) {
    return 'Your card has expired. Please use a different card.';
  }
  
  // CVV/Security code errors
  if (combinedMessage.includes('cvv') || combinedMessage.includes('security code') || combinedMessage.includes('cvc')) {
    return 'Invalid security code (CVV). Please check the 3 or 4 digit code on your card.';
  }
  
  // Authentication errors
  if (combinedMessage.includes('authentication') || combinedMessage.includes('3d secure')) {
    return 'Card authentication failed. Please try again or use a different card.';
  }
  
  // Network/connection errors
  if (combinedMessage.includes('network') || combinedMessage.includes('connection') || combinedMessage.includes('timeout')) {
    return 'Connection error. Please check your internet and try again.';
  }
  
  // Fraud detection
  if (combinedMessage.includes('fraud') || combinedMessage.includes('suspicious')) {
    return 'Transaction blocked for security reasons. Please contact your bank or try a different card.';
  }
  
  // Rate limiting
  if (combinedMessage.includes('too many') || combinedMessage.includes('rate limit')) {
    return 'Too many attempts. Please wait a moment and try again.';
  }
  
  // Default fallback
  return error?.message || 'Payment could not be processed. Please check your card details and try again.';
};

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

const PurchaseAttraction = () => {
  const { slug } = useParams<{ location: string; slug: string }>();
  const attractionId = slug ? extractIdFromSlug(slug) : null;
  const navigate = useNavigate();

  const [attraction, setAttraction] = useState<PurchaseAttractionAttraction | null>(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [customerInfo, setCustomerInfo] = useState<PurchaseAttractionCustomerInfo>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    // Billing Information (optional)
    address: '',
    address2: '',
    city: '',
    state: '', // 2-letter state code
    zip: '',
    country: '' // 2-letter country code
  });
  const [currentStep, setCurrentStep] = useState(1);
  const [purchaseComplete, setPurchaseComplete] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  // Payment card details
  const [cardNumber, setCardNumber] = useState('');
  const [cardMonth, setCardMonth] = useState('');
  const [cardYear, setCardYear] = useState('');
  const [cardCVV, setCardCVV] = useState('');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  
  const [authorizeApiLoginId, setAuthorizeApiLoginId] = useState('');
  const [authorizeClientKey, setAuthorizeClientKey] = useState('');
  const [_authorizeEnvironment, setAuthorizeEnvironment] = useState<'sandbox' | 'production'>('sandbox');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [qrCodeImage, setQrCodeImage] = useState<string | null>(null);
  const [showQRModal, setShowQRModal] = useState(false);
  const [foundCustomers, setFoundCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [searchingCustomer, setSearchingCustomer] = useState(false);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  const [showCountrySuggestions, setShowCountrySuggestions] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // Signature & Terms state
  const [signatureImage, setSignatureImage] = useState<string | null>(null);
  const [termsAccepted, setTermsAccepted] = useState<boolean>(false);
  const [signatureTermsErrors, setSignatureTermsErrors] = useState<Record<string, string>>({});
  const [feeBreakdown, setFeeBreakdown] = useState<FeeBreakdown | null>(null);
  const [specialPricingBreakdown, setSpecialPricingBreakdown] = useState<SpecialPricingBreakdown | null>(null);

  // Show account modal for non-logged-in users (optional, doesn't block access)
  useEffect(() => {
    const customerData = localStorage.getItem('zapzone_customer');
    if (!customerData) {
      // Show modal but don't block access
      setShowAccountModal(true);
    }
  }, []);

  // Auto-fill form if customer is logged in
  useEffect(() => {
    const fetchCustomerData = async () => {
      try {
        const customerData = localStorage.getItem('zapzone_customer');
        if (customerData) {
          const customer: any = JSON.parse(customerData);
          
          // Immediately autofill from localStorage (instant feedback)
          setCustomerInfo(prev => ({
            ...prev,
            firstName: customer.firstName || customer.first_name || prev.firstName,
            lastName: customer.lastName || customer.last_name || prev.lastName,
            email: customer.email || prev.email,
            phone: customer.phone || prev.phone,
            address: customer.address || prev.address,
            address2: customer.address2 || prev.address2,
            city: customer.city || prev.city,
            state: customer.state || prev.state,
            zip: customer.zip || prev.zip,
            country: customer.country || prev.country || 'US'
          }));
          
          if (customer.id) {
            setSelectedCustomerId(customer.id);
            
            // Optionally refresh from API for latest data
            try {
              const response = await customerService.getCustomerById(customer.id);
              if (response.success && response.data) {
                const data: any = response.data;
                setCustomerInfo(prev => ({
                  ...prev,
                  firstName: data.first_name || prev.firstName,
                  lastName: data.last_name || prev.lastName,
                  email: data.email || prev.email,
                  phone: data.phone || prev.phone,
                  address: data.address || prev.address,
                  address2: data.address2 || prev.address2,
                  city: data.city || prev.city,
                  state: data.state || prev.state,
                  zip: data.zip || prev.zip,
                  country: data.country || prev.country
                }));
              }
            } catch {
              // API refresh skipped, using localStorage data
            }
          }
        }
      } catch {
        // Error loading customer data - silent fail
      }
    };
    
    fetchCustomerData();
  }, []);

  // Load attraction data from backend
  useEffect(() => {
    const loadAttraction = async () => {
      if (!attractionId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        // If location parameter exists, use it (future enhancement for location-based filtering)
        // For now, we fetch by ID directly
        const response = await attractionService.getAttraction(Number(attractionId));
        const attr = response.data as Attraction & { location?: { id: number; name: string } };
        
        // Convert API format to component format
        const convertedAttraction: PurchaseAttractionAttraction = {
          id: attr.id.toString(),
          name: attr.name,
          description: attr.description,
          category: attr.category,
          price: attr.price,
          pricingType: attr.pricing_type as 'per_person' | 'fixed' | 'per_group' | 'per_hour' | 'per_game',
          maxCapacity: attr.max_capacity,
          duration: attr.duration?.toString() || '',
          durationUnit: attr.duration_unit || 'minutes',
          location: attr.location?.name || '', // Use attraction's location or URL param
          locationId: attr.location?.id || attr.location_id, // Store location_id from API
          images: attr.image ? (Array.isArray(attr.image) ? attr.image.map(img => ASSET_URL + img) : [ASSET_URL + attr.image]) : [],
          status: attr.is_active ? 'active' : 'inactive',
          createdAt: attr.created_at,
          availability: typeof attr.availability === 'object' ? attr.availability as Record<string, boolean> : {},
        };
        setAttraction(convertedAttraction);
      } catch {
        setToast({ message: 'Failed to load attraction. Please refresh the page.', type: 'error' });
      } finally {
        setLoading(false);
      }
    };

    loadAttraction();
  }, [attractionId]);

  // Initialize Authorize.Net
  useEffect(() => {
    const initializeAuthorizeNet = async () => {
      if (!attraction) return;
      
      try {
        const locationId = attraction.locationId || 1;
        
        const response = await getAuthorizeNetPublicKey(locationId);
        
        // API returns data directly: { api_login_id, client_key, environment }
        const apiLoginId = response.api_login_id;
        const clientKey = response.client_key;
        const environment = response.environment || 'sandbox';
        
        if (apiLoginId) {
          setAuthorizeApiLoginId(apiLoginId);
          setAuthorizeClientKey(clientKey || apiLoginId); // Fallback to apiLoginId if no clientKey
          setAuthorizeEnvironment(environment as 'sandbox' | 'production');
          
          // Load Accept.js with the correct environment from API response
          await loadAcceptJS(environment as 'sandbox' | 'production');
        }
      } catch {
        // Payment system initialization failed - will show error when user tries to pay
      }
    };
    initializeAuthorizeNet();
  }, [attraction]);

  // Debounced customer search by email
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
        
        // Auto-select if exact email match
        const exactMatch = response.data.find(c => c.email.toLowerCase() === email.toLowerCase());
        if (exactMatch) {
          setSelectedCustomerId(exactMatch.id);
          setCustomerInfo(prev => ({
            ...prev,
            firstName: exactMatch.first_name,
            lastName: exactMatch.last_name,
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

    // Debounce search by 500ms
    const timeoutId = setTimeout(searchCustomer, 500);
    return () => clearTimeout(timeoutId);
  }, [customerInfo.email]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setCustomerInfo(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Reset customer selection when email changes
    if (name === 'email') {
      setSelectedCustomerId(null);
    }
  };

  const handleSelectCustomer = (customer: Customer) => {
    setSelectedCustomerId(customer.id);
    setCustomerInfo({
      firstName: customer.first_name,
      lastName: customer.last_name,
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

  // Calculate total
  const calculateTotal = () => {
    if (!attraction) return 0;
    return parseFloat(attraction.price.toString()) * quantity;
  };
  
  // Use dynamic fee breakdown if available - no fallback to hardcoded rate
  const baseTotal = calculateTotal();
  const specialPricingDiscount = specialPricingBreakdown?.has_special_pricing ? specialPricingBreakdown.total_discount : 0;
  const totalAfterSpecialPricing = Math.max(0, baseTotal - specialPricingDiscount);
  const total = feeBreakdown ? feeBreakdown.total - specialPricingDiscount : totalAfterSpecialPricing;

  // Fetch fee breakdown when attraction or quantity changes
  useEffect(() => {
    const fetchFeeBreakdown = async () => {
      if (!attraction) {
        setFeeBreakdown(null);
        return;
      }
      try {
        const basePrice = parseFloat(attraction.price.toString()) * quantity;
        const response = await feeSupportService.getForEntity({
          entity_type: 'attraction',
          entity_id: Number(attraction.id),
          base_price: basePrice,
          location_id: attraction.locationId || undefined,
        });
        if (response.success && response.data) {
          setFeeBreakdown(response.data);
        }
      } catch (error) {
        console.error('Error fetching fee breakdown:', error);
        setFeeBreakdown(null);
      }
    };
    fetchFeeBreakdown();
  }, [attraction, quantity]);

  // Fetch special pricing breakdown for attraction (use today's date for immediate purchases)
  useEffect(() => {
    const fetchSpecialPricing = async () => {
      if (!attraction) {
        setSpecialPricingBreakdown(null);
        return;
      }
      try {
        // Use today's date for immediate attraction purchases
        const today = new Date().toISOString().split('T')[0];
        const basePrice = parseFloat(attraction.price.toString()) * quantity;
        const breakdown = await specialPricingService.getPriceBreakdown({
          entity_type: 'attraction',
          entity_id: Number(attraction.id),
          base_price: basePrice,
          date: today,
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
    };
    fetchSpecialPricing();
  }, [attraction, quantity]);

  const handlePurchase = async () => {
    if (!attraction) return;

    // Validate signature and terms acceptance
    const stErrors: Record<string, string> = {};
    if (!signatureImage) {
      stErrors.signature = 'Please provide your signature before proceeding.';
    }
    if (!termsAccepted) {
      stErrors.terms = 'You must agree to the Terms & Conditions to proceed.';
    }
    if (Object.keys(stErrors).length > 0) {
      setSignatureTermsErrors(stErrors);
      return;
    }
    setSignatureTermsErrors({});

    // Validate card information
    if (!cardNumber || !cardMonth || !cardYear || !cardCVV) {
      setPaymentError('Please fill in all card details');
      return;
    }
    if (!validateCardNumber(cardNumber)) {
      setPaymentError('Invalid card number');
      return;
    }
    if (!authorizeApiLoginId) {
      setPaymentError('Payment system not initialized. Please refresh the page.');
      return;
    }

    try {
      setSubmitting(true);
      setIsProcessingPayment(true);
      setPaymentError('');

      const totalAmount = calculateTotal();

      // Prepare card data
      const cardData = {
        cardNumber: cardNumber.replace(/\s/g, ''),
        month: cardMonth,
        year: cardYear,
        cardCode: cardCVV,
      };
      
      // Customer billing data for Authorize.Net
      const customerData = {
        first_name: customerInfo.firstName,
        last_name: customerInfo.lastName,
        email: customerInfo.email,
        phone: customerInfo.phone,
        address: customerInfo.address,
        address2: customerInfo.address2,
        city: customerInfo.city,
        state: customerInfo.state,
        zip: customerInfo.zip,
        country: customerInfo.country,
      };
      
      // ===== CREATE-FIRST FLOW =====
      // Step 1: Create attraction purchase FIRST (no charge yet)
      const purchaseData = {
        attraction_id: Number(attraction.id),
        customer_id: selectedCustomerId || undefined,
        guest_name: `${customerInfo.firstName} ${customerInfo.lastName}`,
        guest_email: customerInfo.email,
        guest_phone: customerInfo.phone || undefined,
        quantity: quantity,
        amount: totalAmount,
        amount_paid: totalAmount,
        currency: 'USD',
        method: 'card',
        payment_method: 'authorize.net' as 'card' | 'in-store' | 'paylater' | 'authorize.net',
        location_id: attraction.locationId || 1,
        purchase_date: new Date().toISOString().split('T')[0],
        notes: `Attraction Purchase: ${attraction.name} (${quantity} ticket${quantity > 1 ? 's' : ''})`,
      };

      let response;
      try {
        response = await attractionPurchaseService.createPurchase(purchaseData);
      } catch (createErr) {
        console.error('❌ Purchase creation failed:', createErr);
        throw new Error('We couldn\'t process your order right now. No charges were made. Please try again or contact us for help.');
      }
      const createdPurchase = response.data;
      console.log('✅ Purchase created, ID:', createdPurchase.id);

      // Step 2: Generate QR code
      const qrData = await generatePurchaseQRCode(createdPurchase.id);

      // Step 3: Charge payment WITH payable_id — backend links payment + sends email + stores QR
      const paymentData = {
        location_id: attraction.locationId || 1,
        amount: totalAmount,
        order_id: `A${attraction.id}-${Date.now().toString().slice(-8)}`,
        description: `Attraction Purchase: ${attraction.name}`,
        customer_id: selectedCustomerId || undefined,
        signature_image: signatureImage || undefined,
        terms_accepted: termsAccepted,
        payable_id: createdPurchase.id,
        payable_type: PAYMENT_TYPE.ATTRACTION_PURCHASE,
        send_email: true,
        qr_code: qrData,
      };

      const paymentResponse = await processCardPayment(
        cardData,
        paymentData,
        authorizeApiLoginId,
        authorizeClientKey,
        customerData
      );
      
      if (!paymentResponse.success) {
        // Payment failed — clean up the purchase we created
        console.error('❌ Payment failed, deleting purchase:', createdPurchase.id);
        try {
          await attractionPurchaseService.deletePurchase(createdPurchase.id);
          console.log('🗑️ Purchase deleted due to payment failure');
        } catch (deleteErr) {
          console.error('⚠️ Failed to delete purchase after payment failure:', deleteErr);
        }
        // Throw with the raw message — getPaymentErrorMessage in catch will make it friendly
        const rawMsg = paymentResponse.message || '';
        throw new Error(rawMsg || 'Your payment could not be processed. No charges were made to your card. Please check your card details and try again.');
      }
      
      console.log('✅ Payment charged successfully, txn:', paymentResponse.transaction_id);

      setQrCodeImage(qrData);
      setToast({ message: 'Purchase confirmed! Receipt sent to your email.', type: 'success' });

      setPurchaseComplete(true);
      setCurrentStep(4);
      setShowQRModal(true);

    } catch (error: any) {
      const userFriendlyMessage = getPaymentErrorMessage(error);
      setPaymentError(userFriendlyMessage);
      setToast({ message: userFriendlyMessage, type: 'error' });
    } finally {
      setSubmitting(false);
      setIsProcessingPayment(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-800"></div>
      </div>
    );
  }

  if (!attraction) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900">Attraction not found</h2>
          <StandardButton 
            variant="ghost"
            size="md"
            onClick={() => navigate('/')}
          >
            Back to Attractions
          </StandardButton>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50/40">
      {/* Account Modal */}
      {showAccountModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-fade-in" onClick={() => setShowAccountModal(false)}>
          <div 
            className="bg-white max-w-sm w-full p-6 rounded-2xl shadow-2xl animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
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
              <StandardButton
                variant="primary"
                size="md"
                onClick={() => navigate('/customer/register')}
                fullWidth
              >
                Create Account
              </StandardButton>
              <StandardButton
                variant="secondary"
                size="md"
                onClick={() => setShowAccountModal(false)}
                fullWidth
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
        @keyframes backdrop-fade {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .animate-backdrop-fade {
          animation: backdrop-fade 0.2s ease-out;
        }
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
                          {currentStep > step ? '\u2713' : step}
                        </div>
                        {step < 4 && (
                          <div className={`w-8 md:w-16 h-1 mx-1 md:mx-2 rounded-full transition-all ${currentStep > step ? 'bg-blue-600' : 'bg-gray-200'}`}></div>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between text-xs text-gray-500">
                    <span className="hidden sm:inline">Quantity</span>
                    <span className="sm:hidden">Qty</span>
                    <span className="hidden sm:inline">Your Info</span>
                    <span className="sm:hidden">Info</span>
                    <span>Payment</span>
                    <span className="hidden sm:inline">Confirmation</span>
                    <span className="sm:hidden">Done</span>
                  </div>
                </div>
              </div>

              {/* Step 1: Quantity Selection */}
              {currentStep === 1 && (
                <div className="p-4 md:p-6 space-y-4 md:space-y-6">
                  <div>
                    <h2 className="text-lg md:text-xl font-semibold text-gray-900 mb-1">Select Quantity</h2>
                    <p className="text-xs md:text-sm text-gray-600">How many tickets would you like to purchase?</p>
                  </div>
                  
                  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 md:p-8 shadow-sm">
                    <div className="flex items-center justify-center mb-4">
                      <ShoppingCart className="h-8 w-8 md:h-10 md:w-10 text-blue-600" />
                    </div>
                    <div className="flex items-center justify-center space-x-6 md:space-x-8">
                      <button
                        onClick={() => setQuantity(Math.max(1, quantity - 1))}
                        className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-white shadow-md text-gray-800 flex items-center justify-center text-xl md:text-2xl font-bold hover:bg-gray-50 hover:shadow-lg transition-all active:scale-95"
                        disabled={quantity <= 1}
                      >
                        −
                      </button>
                      <div className="text-center">
                        <input
                          type="number"
                          value={quantity}
                          onChange={(e) => {
                            const value = parseInt(e.target.value) || 1;
                            setQuantity(Math.max(1, value));
                          }}
                          onBlur={(e) => {
                            if (!e.target.value || parseInt(e.target.value) < 1) {
                              setQuantity(1);
                            }
                          }}
                          onWheel={(e) => (e.target as HTMLInputElement).blur()}
                          min="1"
                          className="w-20 md:w-24 text-4xl md:text-5xl font-bold text-blue-800 text-center bg-transparent border-2 border-transparent hover:border-blue-300 focus:border-blue-500 focus:outline-none rounded-lg transition-colors mb-1"
                        />
                        <div className="text-xs md:text-sm text-gray-600">{quantity === 1 ? 'ticket' : 'tickets'}</div>
                      </div>
                      <button
                        onClick={() => setQuantity(quantity + 1)}
                        className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-white shadow-md text-gray-800 flex items-center justify-center text-xl md:text-2xl font-bold hover:bg-gray-50 hover:shadow-lg transition-all active:scale-95"
                      >
                        +
                      </button>
                    </div>
                  </div>
                  
                  <div className="flex justify-end">
                    <StandardButton
                      variant="primary"
                      size="md"
                      onClick={() => {
                        setCurrentStep(2);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                    >
                      Continue →
                    </StandardButton>
                  </div>
                </div>
              )}

              {/* Step 2: Customer Information */}
              {currentStep === 2 && (
                <div className="p-4 md:p-6 space-y-4 md:space-y-6">
                  <div>
                    <h2 className="text-lg md:text-xl font-semibold text-gray-900 mb-1">Your Information</h2>
                    <p className="text-xs md:text-sm text-gray-600">Please provide your contact details for ticket delivery</p>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="relative">
                      <label className="block text-sm font-medium text-gray-900 mb-2">
                        Email Address <span className="text-red-500">*</span>
                        {selectedCustomerId && <span className="ml-2 text-green-600 text-xs font-normal">✓ Existing customer found</span>}
                      </label>
                      <input
                        type="email"
                        name="email"
                        value={customerInfo.email}
                        onChange={handleInputChange}
                        onFocus={() => foundCustomers.length > 0 && setShowCustomerDropdown(true)}
                        onBlur={() => setTimeout(() => setShowCustomerDropdown(false), 200)}
                        placeholder="john.doe@example.com"
                        className={`w-full border rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition ${
                          selectedCustomerId ? 'border-green-400 bg-green-50' : 'border-gray-300'
                        }`}
                        required
                      />
                      {searchingCustomer && (
                        <div className="absolute right-3 top-11 text-gray-400">
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
                              className={`p-3 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0 transition ${
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
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-900 mb-2">
                          First Name <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          name="firstName"
                          value={customerInfo.firstName}
                          onChange={handleInputChange}
                          placeholder="John"
                          className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition"
                          required
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-900 mb-2">
                          Last Name <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          name="lastName"
                          value={customerInfo.lastName}
                          onChange={handleInputChange}
                          placeholder="Doe"
                          className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition"
                          required
                        />
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-900 mb-2">
                        Phone Number
                      </label>
                      <input
                        type="tel"
                        name="phone"
                        value={customerInfo.phone}
                        onChange={handleInputChange}
                        placeholder="+1 (555) 123-4567"
                        className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition"
                      />
                    </div>
                  </div>
                  
                  {/* Billing Information Section */}
                  <div className="mt-6 pt-6">
                    <h4 className="text-base font-semibold text-gray-900 mb-4">Billing Information</h4>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-900 mb-2">Street Address <span className="text-red-500">*</span></label>
                        <input
                          type="text"
                          name="address"
                          value={customerInfo.address}
                          onChange={handleInputChange}
                          placeholder="123 Main Street"
                          className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-900 mb-2">Apartment, Suite, Unit <span className="text-gray-500 text-xs">(Optional)</span></label>
                        <input
                          type="text"
                          name="address2"
                          value={customerInfo.address2}
                          onChange={handleInputChange}
                          placeholder="Apt 4B, Suite 200, etc."
                          className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition"
                        />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-900 mb-2">City <span className="text-red-500">*</span></label>
                          <input
                            type="text"
                            name="city"
                            value={customerInfo.city}
                            onChange={handleInputChange}
                            placeholder="City"
                            className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-900 mb-2">State / Province <span className="text-red-500">*</span></label>
                          <input
                            type="text"
                            name="state"
                            value={customerInfo.state}
                            onChange={handleInputChange}
                            placeholder="State / Province"
                            className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition"
                            required
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-900 mb-2">ZIP / Postal Code <span className="text-red-500">*</span></label>
                          <input
                            type="text"
                            name="zip"
                            value={customerInfo.zip}
                            onChange={handleInputChange}
                            placeholder="12345"
                            className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition"
                            required
                          />
                        </div>
                        <div className="relative">
                          <label className="block text-sm font-medium text-gray-900 mb-2">Country <span className="text-red-500">*</span></label>
                          <input
                            type="text"
                            name="country"
                            value={countrySearch}
                            onChange={(e) => {
                              const value = e.target.value;
                              setCountrySearch(value);
                              setShowCountrySuggestions(true);
                              
                              // If exact match by name, auto-select it
                              const exactMatch = countries.find(c => c.name.toLowerCase() === value.toLowerCase());
                              if (exactMatch) {
                                setCustomerInfo(prev => ({ ...prev, country: exactMatch.code }));
                              }
                            }}
                            onFocus={() => {
                              // If input is empty but country is selected, show the country name
                              if (!countrySearch && customerInfo.country) {
                                const selectedCountry = countries.find(c => c.code === customerInfo.country);
                                if (selectedCountry) setCountrySearch(selectedCountry.name);
                              }
                              setShowCountrySuggestions(true);
                            }}
                            onBlur={() => {
                              setTimeout(() => {
                                setShowCountrySuggestions(false);
                                // If the typed value doesn't match any country, reset to selected country
                                const matchedCountry = countries.find(c => c.name.toLowerCase() === countrySearch.toLowerCase());
                                if (matchedCountry) {
                                  setCustomerInfo(prev => ({ ...prev, country: matchedCountry.code }));
                                  setCountrySearch(matchedCountry.name);
                                } else if (customerInfo.country) {
                                  const selectedCountry = countries.find(c => c.code === customerInfo.country);
                                  if (selectedCountry) setCountrySearch(selectedCountry.name);
                                }
                              }, 200);
                            }}
                            placeholder="Type to search countries..."
                            className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition"
                            required
                            autoComplete="off"
                          />
                          {/* Country Suggestions Dropdown */}
                          {showCountrySuggestions && countrySearch && (
                            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                              {countries
                                .filter(country => 
                                  country.name.toLowerCase().includes(countrySearch.toLowerCase())
                                )
                                .slice(0, 10)
                                .map(country => (
                                  <button
                                    key={country.code}
                                    type="button"
                                    className={`w-full text-left px-4 py-2 hover:bg-blue-50 transition-colors text-sm ${
                                      country.code === customerInfo.country ? 'bg-blue-50 font-medium' : ''
                                    }`}
                                    onMouseDown={(e) => {
                                      e.preventDefault(); // Prevent blur from firing first
                                      setCustomerInfo(prev => ({ ...prev, country: country.code }));
                                      setCountrySearch(country.name);
                                      setShowCountrySuggestions(false);
                                    }}
                                  >
                                    {country.name}
                                  </button>
                                ))}
                              {countries.filter(country => 
                                country.name.toLowerCase().includes(countrySearch.toLowerCase())
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
                  </div>
                  
                  <div className="flex justify-between gap-2 pt-4">
                    <StandardButton
                      variant="secondary"
                      size="md"
                      onClick={() => setCurrentStep(1)}
                    >
                      <span className="sm:hidden">←</span>
                      <span className="hidden sm:inline">← Back</span>
                    </StandardButton>
                    <StandardButton
                      variant="primary"
                      size="md"
                      onClick={() => {
                        setCurrentStep(3);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      disabled={!customerInfo.firstName || !customerInfo.lastName || !customerInfo.email || !customerInfo.address || !customerInfo.city || !customerInfo.state || !customerInfo.zip || !customerInfo.country}
                    >
                      Continue to Payment →
                    </StandardButton>
                  </div>
                </div>
              )}

              {/* Step 3: Payment Method */}
              {currentStep === 3 && (
                <div className="p-4 md:p-6 space-y-4 md:space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h2 className="text-base md:text-lg font-semibold text-gray-900">Payment Information</h2>
                      <p className="text-xs md:text-sm text-gray-600 mt-0.5 md:mt-1">Secure payment powered by Authorize.Net</p>
                    </div>
                    <div className="flex gap-1.5 md:gap-2">
                      <div className="h-5 md:h-6 lg:h-7 px-1.5 md:px-2 bg-gradient-to-br from-blue-800 to-blue-950 rounded flex items-center justify-center" title="Visa">
                        <span className="text-white text-[9px] md:text-[10px] lg:text-[11px] font-extrabold italic">VISA</span>
                      </div>
                      <div className="h-5 md:h-6 lg:h-7 w-8 md:w-10 lg:w-11 bg-gray-100 rounded flex items-center justify-center" title="Mastercard">
                        <svg viewBox="0 0 32 20" className="h-3.5 md:h-4 lg:h-5">
                          <circle cx="12" cy="10" r="7" fill="#EB001B"/>
                          <circle cx="20" cy="10" r="7" fill="#F79E1B"/>
                          <path d="M16 4.6a7 7 0 010 10.8 7 7 0 010-10.8z" fill="#FF5F00"/>
                        </svg>
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
                    {/* Card Number */}
                    <div>
                      <label className="block font-medium mb-2 text-gray-800 text-xs md:text-sm">Card Number</label>
                      <div className="relative">
                        <input
                          type="text"
                          value={cardNumber}
                          onChange={handleCardNumberChange}
                          placeholder="1234 5678 9012 3456"
                          className={`w-full rounded-lg border px-3 md:px-4 py-2.5 md:py-3 text-xs md:text-sm font-mono focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition ${
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
                          <div className="absolute right-2 md:right-3 top-1/2 -translate-y-1/2">
                            <svg className="w-4 h-4 md:w-5 md:h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path>
                            </svg>
                          </div>
                        )}
                      </div>
                      {cardNumber && (
                        <p className="text-xs mt-2 text-gray-600">{getCardType(cardNumber)}</p>
                      )}
                    </div>
                    
                    {/* Expiration and CVV */}
                    <div className="grid grid-cols-3 gap-2 md:gap-4">
                      <div>
                        <label className="block font-medium mb-2 text-gray-800 text-xs md:text-sm">Exp Month</label>
                        <select
                          value={cardMonth}
                          onChange={(e) => setCardMonth(e.target.value)}
                          className="w-full rounded-lg border border-gray-300 px-2 md:px-4 py-2.5 md:py-3 text-xs md:text-sm focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
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
                        <label className="block font-medium mb-2 text-gray-800 text-xs md:text-sm">Exp Year</label>
                        <select
                          value={cardYear}
                          onChange={(e) => setCardYear(e.target.value)}
                          className="w-full rounded-lg border border-gray-300 px-2 md:px-4 py-2.5 md:py-3 text-xs md:text-sm focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
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
                        <label className="block font-medium mb-2 text-gray-800 text-xs md:text-sm">CVV</label>
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
                          className="w-full rounded-lg border border-gray-300 px-2 md:px-4 py-2.5 md:py-3 text-xs md:text-sm font-mono focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                          maxLength={4}
                          disabled={isProcessingPayment}
                        />
                      </div>
                    </div>
                    
                    {/* Error Message */}
                    {paymentError && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-2.5 md:p-3 text-xs md:text-sm text-red-800 flex items-start gap-2">
                        <svg className="w-4 h-4 md:w-5 md:h-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"></path>
                        </svg>
                        <span>{paymentError}</span>
                      </div>
                    )}
                    
                    {/* Security Notice */}
                    <div className="bg-blue-50 rounded-lg p-2.5 md:p-3 flex items-start gap-2">
                      <svg className="w-4 h-4 md:w-5 md:h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd"></path>
                      </svg>
                      <div className="text-xs md:text-sm text-blue-900">
                        <p className="font-semibold">Secure Payment</p>
                        <p className="text-[10px] md:text-xs text-blue-800 mt-0.5">256-bit SSL encrypted • PCI compliant • Powered by Authorize.Net</p>
                      </div>
                    </div>
                  </div>
                  
                  {/* Signature & Terms Section */}
                  <div className="space-y-4 mt-6 pt-6">
                    <h3 className="text-lg font-semibold">Signature & Agreement</h3>

                    <SignatureCapture
                      onSignatureChange={(base64) => {
                        setSignatureImage(base64);
                        if (base64) {
                          setSignatureTermsErrors((prev) => ({ ...prev, signature: '' }));
                        }
                      }}
                      required={true}
                      error={signatureTermsErrors.signature}
                    />

                    <TermsAndConditionsCheckbox
                      checked={termsAccepted}
                      onChange={(checked) => {
                        setTermsAccepted(checked);
                        if (checked) {
                          setSignatureTermsErrors((prev) => ({ ...prev, terms: '' }));
                        }
                      }}
                      required={true}
                      error={signatureTermsErrors.terms}
                    />
                  </div>

                  <div className="flex justify-between gap-2 pt-2">
                    <StandardButton
                      variant="secondary"
                      size="md"
                      onClick={() => setCurrentStep(2)}
                      disabled={submitting}
                    >
                      <span className="sm:hidden">←</span>
                      <span className="hidden sm:inline">← Back</span>
                    </StandardButton>
                    <button
                      onClick={handlePurchase}
                      disabled={submitting || !cardNumber || !cardMonth || !cardYear || !cardCVV || !validateCardNumber(cardNumber)}
                      className="py-2.5 md:py-3 px-3 md:px-6 rounded-lg bg-blue-800 text-white font-medium hover:bg-blue-900 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center text-xs md:text-base shadow-sm hover:shadow-md"
                    >
                      {isProcessingPayment ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 md:h-5 md:w-5 border-b-2 border-white mr-1.5 md:mr-2"></div>
                          <span className="hidden sm:inline">Processing Payment...</span>
                          <span className="sm:hidden">Processing...</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4 md:w-5 md:h-5 mr-1.5 md:mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
                          </svg>
                          {submitting ? (
                            <>
                              <span className="hidden sm:inline">Processing...</span>
                              <span className="sm:hidden">Wait...</span>
                            </>
                          ) : (
                            <>
                              <span className="hidden sm:inline">Pay ${calculateTotal().toFixed(2)}</span>
                              <span className="sm:hidden">${calculateTotal().toFixed(2)}</span>
                            </>
                          )}
                        </>
                      )}
                    </button>
                  </div>
                </div>

              )}

              {/* Step 4: Confirmation */}
              {currentStep === 4 && purchaseComplete && (
                <div className="p-4 md:p-6">
                  <div className="text-center mb-6">
                    <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Purchase Confirmed!</h2>
                    <p className="text-gray-600 mb-2">
                      Your tickets for <span className="font-semibold text-gray-900">{attraction.name}</span> have been confirmed.
                    </p>
                    <p className="text-sm text-gray-500">
                      A confirmation email has been sent to <span className="font-medium text-gray-700">{customerInfo.email}</span>
                    </p>
                  </div>
                  
                  {/* Customer Information */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                    <h3 className="font-semibold text-blue-900 mb-3 flex items-center">
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
                      </svg>
                      Customer Information
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                      <p><span className="text-gray-600">Name:</span> <span className="font-medium text-gray-900">{customerInfo.firstName} {customerInfo.lastName}</span></p>
                      <p><span className="text-gray-600">Email:</span> <span className="font-medium text-gray-900">{customerInfo.email}</span></p>
                      {customerInfo.phone && (
                        <p><span className="text-gray-600">Phone:</span> <span className="font-medium text-gray-900">{customerInfo.phone}</span></p>
                      )}
                      {selectedCustomerId && (
                        <p><span className="text-gray-600">Customer ID:</span> <span className="font-medium text-gray-900">#{selectedCustomerId}</span></p>
                      )}
                    </div>
                  </div>

                  {/* Purchase Details */}
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
                    <h3 className="font-semibold text-gray-900 mb-3 flex items-center">
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path>
                      </svg>
                      Purchase Details
                    </h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Attraction:</span>
                        <span className="font-medium text-gray-900">{attraction.name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Location:</span>
                        <span className="font-medium text-gray-900">{attraction.location}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Quantity:</span>
                        <span className="font-medium text-gray-900">{quantity} {quantity === 1 ? 'ticket' : 'tickets'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Purchase Date:</span>
                        <span className="font-medium text-gray-900">{new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Payment Method:</span>
                        <span className="font-medium text-gray-900">Credit/Debit Card</span>
                      </div>
                      <div className="pt-3 mt-3 flex justify-between">
                        <span className="text-gray-900 font-semibold">Total Paid:</span>
                        <span className="text-lg font-bold text-green-600">${calculateTotal().toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Billing Address */}
                  <div className="bg-gray-50 rounded-xl p-4 mb-6">
                    <h3 className="font-semibold text-gray-900 mb-3 flex items-center">
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path>
                      </svg>
                      Billing Address
                    </h3>
                    <div className="text-sm text-gray-700">
                      <p className="font-medium">{customerInfo.address}</p>
                      {customerInfo.address2 && <p>{customerInfo.address2}</p>}
                      <p>{customerInfo.city}, {customerInfo.state} {customerInfo.zip}</p>
                      <p>{customerInfo.country}</p>
                    </div>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row justify-center gap-3">
                    <StandardButton
                      variant="secondary"
                      size="md"
                      onClick={() => navigate('/')}
                    >
                      Back to Home
                    </StandardButton>
                    <StandardButton
                      variant="primary"
                      size="md"
                      onClick={() => navigate('/my-purchases')}
                    >
                      View My Purchases
                    </StandardButton>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Attraction Summary */}
          <div className="lg:col-span-1">
            <div className="bg-white shadow-md rounded-2xl overflow-hidden lg:sticky lg:top-8">
              {/* Image Carousel */}
              {attraction.images && attraction.images.length > 0 && (
                <div className="relative group">
                  <div className="relative h-64 overflow-hidden bg-gray-100">
                    <img 
                      src={attraction.images[currentImageIndex]} 
                      alt={`${attraction.name} - Image ${currentImageIndex + 1}`}
                      className="w-full h-full object-cover transition-opacity duration-300"
                    />
                    
                    {/* Navigation Arrows */}
                    {attraction.images.length > 1 && (
                      <>
                        <button
                          onClick={() => setCurrentImageIndex((prev) => 
                            prev === 0 ? attraction.images!.length - 1 : prev - 1
                          )}
                          className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-200"
                          aria-label="Previous image"
                        >
                          <ChevronLeft className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => setCurrentImageIndex((prev) => 
                            prev === attraction.images!.length - 1 ? 0 : prev + 1
                          )}
                          className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-200"
                          aria-label="Next image"
                        >
                          <ChevronRight className="h-5 w-5" />
                        </button>
                      </>
                    )}
                  </div>
                  
                  {/* Image Indicators */}
                  {attraction.images.length > 1 && (
                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                      {attraction.images.map((_, index) => (
                        <button
                          key={index}
                          onClick={() => setCurrentImageIndex(index)}
                          className={`h-2 rounded-full transition-all duration-200 ${
                            index === currentImageIndex 
                              ? 'w-6 bg-white' 
                              : 'w-2 bg-white/50 hover:bg-white/75'
                          }`}
                          aria-label={`Go to image ${index + 1}`}
                        />
                      ))}
                    </div>
                  )}
                  
                  {/* Image Counter */}
                  {attraction.images.length > 1 && (
                    <div className="absolute top-3 right-3 bg-black/60 text-white text-xs px-2.5 py-1 rounded-full">
                      {currentImageIndex + 1} / {attraction.images.length}
                    </div>
                  )}
                </div>
              )}
              
              <div className="p-4 md:p-6">
                {/* Attraction Header */}
                <div className="mb-4">
                  <h2 className="text-lg md:text-xl font-bold text-gray-900 mb-1">{attraction.name}</h2>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      <Tag className="h-3 w-3 mr-1" />
                      {attraction.category}
                    </span>
                  </div>
                  <p className="text-sm md:text-base text-gray-500 leading-relaxed">{attraction.description}</p>
                </div>
                
                {/* Attraction Details Grid */}
                <div className="grid grid-cols-2 gap-3 mb-5">
                  <div className="flex items-start gap-2">
                    <div className="p-2 bg-blue-50 rounded-xl">
                      <MapPin className="h-4 w-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Location</p>
                      <p className="text-sm font-medium text-gray-900">{attraction.location}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-2">
                    <div className="p-2 bg-blue-50 rounded-xl">
                      <Clock className="h-4 w-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Duration</p>
                      <p className="text-sm font-medium text-gray-900">
                        {attraction.duration === '0' || !attraction.duration ? 'Unlimited' : formatDurationDisplay(parseFloat(attraction.duration), attraction.durationUnit)}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-2">
                    <div className="p-2 bg-blue-50 rounded-xl">
                      <Users className="h-4 w-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Capacity</p>
                      <p className="text-sm font-medium text-gray-900">Up to {attraction.maxCapacity}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-2">
                    <div className="p-2 bg-blue-50 rounded-xl">
                      <DollarSign className="h-4 w-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Pricing</p>
                      <p className="text-sm font-medium text-gray-900">
                        {attraction.pricingType === 'per_person' ? 'Per Person' : 
                         attraction.pricingType === 'per_group' ? 'Per Group' :
                         attraction.pricingType === 'per_hour' ? 'Per Hour' :
                         attraction.pricingType === 'per_game' ? 'Per Game' : 'Fixed'}
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="pt-4">
                  <h3 className="font-bold text-gray-900 mb-3 text-sm md:text-base">Order Summary</h3>
                  <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs md:text-sm text-gray-500">
                      {attraction.pricingType === 'per_person' ? 'Per person' : 
                       attraction.pricingType === 'per_group' ? 'Per group' :
                       attraction.pricingType === 'per_hour' ? 'Per hour' :
                       attraction.pricingType === 'per_game' ? 'Per game' : 'Fixed price'}
                    </span>
                    <span className="font-medium text-sm md:text-base">${Number(attraction.price).toFixed(2)}</span>
                  </div>
                  
                  {currentStep >= 1 && (
                    <>
                      <div className="flex justify-between items-center">
                        <span className="text-xs md:text-sm text-gray-500">Quantity</span>
                        <span className="font-medium text-sm md:text-base">{quantity}</span>
                      </div>
                    </>
                  )}
                  </div>
                  
                  {/* Special pricing discount */}
                  {specialPricingBreakdown && specialPricingBreakdown.has_special_pricing && (
                    <div className="mt-3 space-y-1">
                      {specialPricingBreakdown.discounts_applied.map((discount, index) => (
                        <div key={index} className="flex justify-between text-green-600 text-sm">
                          <span>{discount.name}</span>
                          <span>-${discount.discount_amount.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {/* Fee breakdown */}
                  {feeBreakdown && feeBreakdown.fees.length > 0 && (
                    <div className="mt-3 pt-1">
                      <PriceBreakdownDisplay breakdown={feeBreakdown} compact />
                    </div>
                  )}
                  
                  {/* Total */}
                  <div className="bg-gradient-to-r from-blue-800 to-blue-900 rounded-xl p-3.5 mt-4">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-white text-sm">Total</span>
                      <span className="text-xl md:text-2xl font-extrabold text-white">${total.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
                
                {/* Trust badges */}
                <div className="mt-5 bg-gray-50 rounded-xl p-3">
                  <div className="flex items-center justify-around text-xs text-gray-500">
                    <div className="text-center">
                      <Shield className="h-4 w-4 mx-auto mb-1" />
                      <span>Secure</span>
                    </div>
                    <div className="text-center">
                      <Zap className="h-4 w-4 mx-auto mb-1" />
                      <span>Instant</span>
                    </div>
                    <div className="text-center">
                      <Star className="h-4 w-4 mx-auto mb-1" />
                      <span>Best Price</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>



      {/* QR Code Modal */}
      {showQRModal && qrCodeImage && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-backdrop-fade">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-4 sm:p-6 max-h-[calc(100vh-2rem)] overflow-y-auto shadow-2xl">
            <div className="text-center mb-4">
              <div className="mx-auto w-14 h-14 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-2xl flex items-center justify-center mb-3 shadow-lg">
                <CheckCircle className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-xl sm:text-2xl font-extrabold text-gray-900 mb-2">Purchase Confirmed!</h3>
              <p className="text-sm text-gray-500">Your tickets have been confirmed</p>
            </div>
            
            {/* QR Code Display */}
            <div className="bg-gray-50 rounded-xl p-4 sm:p-6 mb-4">
              <div className="flex flex-col items-center">
                <img 
                  src={qrCodeImage} 
                  alt="Purchase QR Code"
                  className="w-48 h-48 sm:w-64 sm:h-64 rounded-xl shadow-sm mb-3"
                />
                <p className="text-xs sm:text-sm text-gray-600 mb-1">Scan this QR code at the entrance</p>
              </div>
            </div>
            
            {/* Purchase Details */}
            <div className="bg-blue-50 rounded-xl p-4 sm:p-6 mb-4">
              <h3 className="font-semibold text-base sm:text-lg mb-3 text-gray-800">Purchase Details</h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm sm:text-base">
                  <span className="text-gray-600">Attraction:</span>
                  <span className="font-medium text-gray-900 text-right ml-2">{attraction.name}</span>
                </div>
                <div className="flex justify-between text-sm sm:text-base">
                  <span className="text-gray-600">Location:</span>
                  <span className="font-medium text-gray-900">{attraction.location}</span>
                </div>
                <div className="flex justify-between text-sm sm:text-base">
                  <span className="text-gray-600">Guest Name:</span>
                  <span className="font-medium text-gray-900">{customerInfo.firstName} {customerInfo.lastName}</span>
                </div>
                <div className="flex justify-between text-sm sm:text-base">
                  <span className="text-gray-600">Email:</span>
                  <span className="font-medium text-gray-900 text-right ml-2 break-all">{customerInfo.email}</span>
                </div>
                {customerInfo.phone && (
                  <div className="flex justify-between text-sm sm:text-base">
                    <span className="text-gray-600">Phone:</span>
                    <span className="font-medium text-gray-900">{customerInfo.phone}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm sm:text-base">
                  <span className="text-gray-600">Quantity:</span>
                  <span className="font-medium text-gray-900">{quantity} {quantity === 1 ? 'ticket' : 'tickets'}</span>
                </div>
                <div className="flex justify-between text-sm sm:text-base">
                  <span className="text-gray-600">Purchase Date:</span>
                  <span className="font-medium text-gray-900">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</span>
                </div>
                <div className="flex justify-between text-sm sm:text-base">
                  <span className="text-gray-600">Duration:</span>
                  <span className="font-medium text-gray-900">{attraction.duration === '0' || !attraction.duration ? 'Unlimited' : formatDurationDisplay(parseFloat(attraction.duration), attraction.durationUnit)}</span>
                </div>
              </div>
            </div>
            
            {/* Billing Address */}
            <div className="bg-gray-50 rounded-xl p-4 sm:p-6 mb-4">
              <h3 className="font-semibold text-base sm:text-lg mb-3 text-gray-800">Billing Address</h3>
              <div className="text-sm text-gray-700 space-y-1">
                <p className="font-medium">{customerInfo.firstName} {customerInfo.lastName}</p>
                <p>{customerInfo.address}</p>
                {customerInfo.address2 && <p>{customerInfo.address2}</p>}
                <p>{customerInfo.city}, {customerInfo.state} {customerInfo.zip}</p>
                <p>{customerInfo.country}</p>
              </div>
            </div>
            
            {/* Payment Summary */}
            <div className="bg-blue-50 rounded-xl p-4 sm:p-6 mb-4">
              <h3 className="font-semibold text-base sm:text-lg mb-3 text-gray-800">Payment Summary</h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Price per {attraction.pricingType === 'per_person' ? 'person' : attraction.pricingType === 'per_group' ? 'group' : attraction.pricingType === 'per_hour' ? 'hour' : attraction.pricingType === 'per_game' ? 'game' : 'item'}:</span>
                  <span className="font-medium text-gray-900">${Number(attraction.price).toFixed(2)}</span>
                </div>
                {quantity > 1 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Quantity:</span>
                    <span className="font-medium text-gray-900">x{quantity}</span>
                  </div>
                )}
                <div className="flex justify-between pt-3 mt-3 text-sm sm:text-base">
                  <span className="text-gray-600 font-semibold">Total Paid:</span>
                  <span className="font-bold text-green-600 text-lg sm:text-xl">${calculateTotal().toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Payment Method:</span>
                  <span className="font-medium text-gray-900">Credit/Debit Card</span>
                </div>
              </div>
            </div>
            
            {/* Information Notice */}
            <div className="bg-yellow-50 rounded-lg p-3 mb-4">
              <div className="flex">
                <svg className="w-5 h-5 text-yellow-600 mr-2 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"></path>
                </svg>
                <div className="text-xs sm:text-sm text-yellow-800">
                  <p className="font-semibold mb-1">Important Information</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Receipt sent to {customerInfo.email}</li>
                    <li>Please present this QR code at the entrance</li>
                    <li>Save or screenshot this confirmation for your records</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="flex justify-center">
              <StandardButton
                variant="primary"
                size="md"
                onClick={() => {
                  setShowQRModal(false);
                  navigate('/');
                }}
              >
                Done
              </StandardButton>
            </div>
          </div>
        </div>
      )}

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

export default PurchaseAttraction;