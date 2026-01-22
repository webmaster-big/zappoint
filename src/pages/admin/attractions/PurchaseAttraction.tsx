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
import { loadAcceptJS, processCardPayment, validateCardNumber, formatCardNumber, getCardType } from '../../../services/PaymentService';
import { getAuthorizeNetPublicKey } from '../../../services/SettingsService';
import { extractIdFromSlug } from '../../../utils/slug';
import StandardButton from '../../../components/ui/StandardButton';

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

  // Get auth token from localStorage
  const getAuthToken = () => {
    const userData = localStorage.getItem('zapzone_user');
    if (userData) {
      try {
        const user = JSON.parse(userData);
        return user.token;
      } catch (error) {
        console.error('Error parsing user data:', error);
        return null;
      }
    }
    return null;
  };
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
  
  // Payment type selection
  const [paymentType, setPaymentType] = useState<'full' | 'custom'>('full');
  const [customAmount, setCustomAmount] = useState<number>(0);
  const [authorizeApiLoginId, setAuthorizeApiLoginId] = useState('');
  const [authorizeClientKey, setAuthorizeClientKey] = useState('');
  const [authorizeEnvironment, setAuthorizeEnvironment] = useState<'sandbox' | 'production'>('sandbox');
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
            console.log('✅ Customer info auto-filled from localStorage');
            
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
                console.log('✅ Customer info refreshed from API');
              }
            } catch (apiError) {
              console.log('⚠️ API refresh skipped, using localStorage data');
            }
          } else {
            console.log('✅ Customer info auto-filled from localStorage (guest)');
          }
        }
      } catch (error) {
        console.error('Error loading customer data:', error);
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
        const authToken = getAuthToken();
        console.log('🔐 Loading attraction - Auth Token:', authToken ? 'Present' : 'Missing');
        
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
        console.log('Loaded attraction:', convertedAttraction);
        setAttraction(convertedAttraction);
      } catch (error) {
        console.error('Error loading attraction:', error);
        setToast({ message: 'Failed to load attraction', type: 'error' });
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
        console.log('🔧 Initializing Authorize.Net for location:', locationId);
        
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
          
          // Load Accept.js with the correct environment from API response
          await loadAcceptJS(environment as 'sandbox' | 'production');
          console.log('✅ Accept.js loaded successfully for environment:', environment);
        } else {
          console.warn('⚠️ No Authorize.Net credentials found for location:', locationId);
          console.warn('Response:', response);
        }
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
      } catch (error) {
        console.error('Error searching customer:', error);
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

  const calculateTotal = () => {
    if (!attraction) return 0;
    
    let total = parseFloat(attraction.price.toString());
    
      total = total * quantity;
    
    return total;
  };

  const handlePurchase = async () => {
    if (!attraction) return;

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
      const authToken = getAuthToken();
      console.log('🔐 Creating purchase - Auth Token:', authToken ? 'Present' : 'Missing');

      const totalAmount = calculateTotal();
      let transactionId: string | undefined;

      // Process card payment
      console.log('💳 Processing payment...');
      
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
      
      // Calculate amount to charge based on payment type
      const chargeAmount = paymentType === 'full' ? totalAmount : customAmount;
      
      const paymentData = {
        location_id: attraction.locationId || 1, // Use attraction's location_id or default to 1
        amount: chargeAmount, // Charge based on payment type selection
        order_id: `A${attraction.id}-${Date.now().toString().slice(-8)}`, // Max 20 chars for Authorize.Net
        description: `Attraction Purchase: ${attraction.name}${paymentType === 'custom' ? ' (Partial Payment)' : ''}`,
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
      
      transactionId = paymentResponse.transaction_id;
      console.log('✅ Payment successful:', transactionId);

      // Create purchase data matching backend Payment model
      const purchaseData = {
        attraction_id: Number(attraction.id),
        customer_id: selectedCustomerId || undefined,
        guest_name: `${customerInfo.firstName} ${customerInfo.lastName}`,
        guest_email: customerInfo.email,
        guest_phone: customerInfo.phone || undefined,
        quantity: quantity,
        amount: totalAmount,
        amount_paid: chargeAmount, // Based on payment type selection (full, partial, or custom)
        currency: 'USD',
        method: 'card',
        payment_method: 'card' as 'card' | 'cash',
        status: 'completed' as 'pending' | 'completed' | 'cancelled',
        payment_id: transactionId,
        location_id: attraction.locationId || 1, // Use attraction's location_id from API
        purchase_date: new Date().toISOString().split('T')[0],
        notes: `Attraction Purchase: ${attraction.name} (${quantity} ticket${quantity > 1 ? 's' : ''})`,
        // transaction_id is auto-generated by backend
      };

      console.log('🎫 === PURCHASE DATA BEING SENT TO BACKEND ===');
      console.log('Full Purchase Object:', JSON.stringify(purchaseData, null, 2));
      console.log('Guest Information:', {
        name: purchaseData.guest_name,
        email: purchaseData.guest_email,
        phone: purchaseData.guest_phone,
        customer_id: purchaseData.customer_id
      });
      console.log('Billing Information:', {
        address: customerInfo.address,
        address2: customerInfo.address2,
        city: customerInfo.city,
        state: customerInfo.state,
        zip: customerInfo.zip,
        country: customerInfo.country
      });
      console.log('Purchase Details:', {
        attraction_id: purchaseData.attraction_id,
        attraction_name: attraction.name,
        location_id: purchaseData.location_id,
        quantity: purchaseData.quantity,
        purchase_date: purchaseData.purchase_date
      });
      console.log('Payment Information:', {
        amount: purchaseData.amount,
        currency: purchaseData.currency,
        method: purchaseData.payment_method,
        status: purchaseData.status,
        payment_id: purchaseData.payment_id,
        transaction_id: transactionId
      });
      console.log('Additional Notes:', purchaseData.notes);
      console.log('==============================================');

      // Create purchase via API
      const response = await attractionPurchaseService.createPurchase(purchaseData);
      const createdPurchase = response.data;

      // Generate QR code
      const qrData = await generatePurchaseQRCode(createdPurchase.id);
      setQrCodeImage(qrData);

      // Send receipt email with QR code
      try {
        await attractionPurchaseService.sendReceipt(createdPurchase.id, qrData);
        setToast({ message: 'Purchase completed! Receipt sent to your email.', type: 'success' });
      } catch (emailError) {
        console.error('Error sending email:', emailError);
        setToast({ message: 'Purchase completed! (Email failed to send)', type: 'info' });
      }

      setPurchaseComplete(true);
      setCurrentStep(4);
      setShowQRModal(true);

    } catch (error: any) {
      console.error('❌ Payment/Purchase error:', error);
      setPaymentError(error.message || 'Payment processing failed. Please try again.');
      setToast({ message: error.message || 'Failed to complete purchase. Please try again.', type: 'error' });
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
    <div className="min-h-screen bg-gray-50">
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
              <p className="text-sm text-gray-600">Sign up for faster checkout and track your purchases.</p>
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
      `}</style>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
          {/* Left Column - Purchase Form */}
          <div className="lg:col-span-2">
            <div className="bg-white shadow-sm rounded-lg overflow-hidden">
              {/* Progress Steps */}
              <div className="border-b border-gray-200">
                <div className="px-4 md:px-6 py-3 md:py-4">
                  <div className="flex items-center justify-between mb-2">
                    {[1, 2, 3, 4].map(step => (
                      <div key={step} className="flex items-center">
                        <div className={`w-7 h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center text-xs md:text-sm ${
                          currentStep >= step 
                            ? 'bg-blue-800 text-white' 
                            : 'bg-gray-200 text-gray-500'
                        }`}>
                          {step}
                        </div>
                        {step < 4 && (
                          <div className={`w-8 md:w-16 h-1 mx-1 md:mx-2 ${currentStep > step ? 'bg-blue-800' : 'bg-gray-200'}`}></div>
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
                  
                  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 rounded-xl p-6 md:p-8">
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
                        <div className="text-4xl md:text-5xl font-bold text-blue-800 mb-1">{quantity}</div>
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
                  <div className="mt-6 pt-6 border-t border-gray-200">
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
                      <img src="https://upload.wikimedia.org/wikipedia/commons/5/5e/Visa_Inc._logo.svg" alt="Visa" className="h-4 md:h-5 lg:h-6 opacity-80" />
                      <img src="https://upload.wikimedia.org/wikipedia/commons/2/2a/Mastercard-logo.svg" alt="Mastercard" className="h-4 md:h-5 lg:h-6 opacity-80" />
                      <img src="https://upload.wikimedia.org/wikipedia/commons/f/fa/American_Express_logo_%282018%29.svg" alt="Amex" className="h-4 md:h-5 lg:h-6 opacity-80" />
                      <img src="https://upload.wikimedia.org/wikipedia/commons/5/57/Discover_Card_logo.svg" alt="Discover" className="h-4 md:h-5 lg:h-6 opacity-80" />
                    </div>
                  </div>

                  {/* Payment Type Selection */}
                  <div className="space-y-3">
                    <label className="block font-medium text-gray-800 text-xs md:text-sm">Payment Amount</label>
                    <div className="grid grid-cols-2 gap-2 md:gap-3">
                      <button
                        type="button"
                        onClick={() => setPaymentType('full')}
                        className={`p-3 rounded-lg border-2 text-center transition-all ${
                          paymentType === 'full'
                            ? 'border-blue-600 bg-blue-50 text-blue-800'
                            : 'border-gray-200 hover:border-gray-300 text-gray-600'
                        }`}
                      >
                        <div className="text-xs md:text-sm font-semibold">Full Payment</div>
                        <div className="text-xs text-gray-500 mt-0.5">${calculateTotal().toFixed(2)}</div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setPaymentType('custom')}
                        className={`p-3 rounded-lg border-2 text-center transition-all ${
                          paymentType === 'custom'
                            ? 'border-blue-600 bg-blue-50 text-blue-800'
                            : 'border-gray-200 hover:border-gray-300 text-gray-600'
                        }`}
                      >
                        <div className="text-xs md:text-sm font-semibold">Custom Amount</div>
                        <div className="text-xs text-gray-500 mt-0.5">Enter amount</div>
                      </button>
                    </div>
                    
                    {/* Custom Amount Input */}
                    {paymentType === 'custom' && (
                      <div className="mt-3">
                        <label className="block font-medium mb-2 text-gray-800 text-xs md:text-sm">Amount to Pay</label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                          <input
                            type="number"
                            value={customAmount}
                            onChange={(e) => {
                              const value = parseFloat(e.target.value) || 0;
                              setCustomAmount(Math.min(value, calculateTotal()));
                            }}
                            min="0"
                            max={calculateTotal()}
                            step="0.01"
                            className="w-full rounded-lg border border-gray-300 pl-7 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                            placeholder="0.00"
                          />
                        </div>
                        <p className="text-xs text-gray-500 mt-1">Max: ${calculateTotal().toFixed(2)}</p>
                      </div>
                    )}
                    
                    {/* Amount Being Charged Notice */}
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-green-800 font-medium">Amount to be charged:</span>
                        <span className="text-lg font-bold text-green-700">
                          ${paymentType === 'full' ? calculateTotal().toFixed(2) : customAmount.toFixed(2)}
                        </span>
                      </div>
                      {paymentType === 'custom' && customAmount < calculateTotal() && (
                        <p className="text-xs text-green-600 mt-1">
                          Remaining balance: ${(calculateTotal() - customAmount).toFixed(2)}
                        </p>
                      )}
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
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-2.5 md:p-3 flex items-start gap-2">
                      <svg className="w-4 h-4 md:w-5 md:h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd"></path>
                      </svg>
                      <div className="text-xs md:text-sm text-blue-900">
                        <p className="font-semibold">Secure Payment</p>
                        <p className="text-[10px] md:text-xs text-blue-800 mt-0.5">256-bit SSL encrypted • PCI compliant • Powered by Authorize.Net</p>
                      </div>
                    </div>
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
                              <span className="hidden sm:inline">Pay ${paymentType === 'full' ? calculateTotal().toFixed(2) : customAmount.toFixed(2)}</span>
                              <span className="sm:hidden">${paymentType === 'full' ? calculateTotal().toFixed(2) : customAmount.toFixed(2)}</span>
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
                      <div className="border-t border-gray-300 pt-2 mt-2 flex justify-between">
                        <span className="text-gray-900 font-semibold">Total Paid:</span>
                        <span className="text-lg font-bold text-green-600">${calculateTotal().toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Billing Address */}
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
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
            <div className="bg-white shadow-sm rounded-lg overflow-hidden lg:sticky lg:top-8">
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
                  <p className="text-sm md:text-base text-gray-600 leading-relaxed">{attraction.description}</p>
                </div>
                
                {/* Attraction Details Grid */}
                <div className="grid grid-cols-2 gap-3 mb-6 pb-4 border-b border-gray-200">
                  <div className="flex items-start gap-2">
                    <div className="p-2 bg-blue-50 rounded-lg">
                      <MapPin className="h-4 w-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Location</p>
                      <p className="text-sm font-medium text-gray-900">{attraction.location}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-2">
                    <div className="p-2 bg-blue-50 rounded-lg">
                      <Clock className="h-4 w-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Duration</p>
                      <p className="text-sm font-medium text-gray-900">
                        {attraction.duration === '0' || !attraction.duration ? 'Unlimited' : formatDurationDisplay(parseFloat(attraction.duration), attraction.durationUnit)}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-2">
                    <div className="p-2 bg-blue-50 rounded-lg">
                      <Users className="h-4 w-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Capacity</p>
                      <p className="text-sm font-medium text-gray-900">Up to {attraction.maxCapacity}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-2">
                    <div className="p-2 bg-blue-50 rounded-lg">
                      <DollarSign className="h-4 w-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Pricing</p>
                      <p className="text-sm font-medium text-gray-900">
                        {attraction.pricingType === 'per_person' ? 'Per Person' : 
                         attraction.pricingType === 'per_group' ? 'Per Group' :
                         attraction.pricingType === 'per_hour' ? 'Per Hour' :
                         attraction.pricingType === 'per_game' ? 'Per Game' : 'Fixed'}
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="border-t border-gray-200 pt-4">
                  <h3 className="font-semibold text-gray-900 mb-3 text-sm md:text-base">Order Summary</h3>
                  <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs md:text-sm text-gray-600">
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
                        <span className="text-xs md:text-sm text-gray-600">Quantity</span>
                        <span className="font-medium text-sm md:text-base">{quantity}</span>
                      </div>
                      
                      {attraction.pricingType === 'per_person' && (
                        <div className="flex justify-between items-center">
                          <span className="text-xs md:text-sm text-gray-600">Subtotal</span>
                          <span className="font-medium text-sm md:text-base">${(attraction.price * quantity).toFixed(2)}</span>
                        </div>
                      )}
                    </>
                  )}
                  </div>
                  
                  <div className="flex justify-between items-center mt-4 pt-4 border-t-2 border-gray-300">
                    <span className="font-bold text-gray-900 text-base md:text-lg">Total</span>
                    <span className="text-xl md:text-2xl font-bold text-blue-800">${calculateTotal().toFixed(2)}</span>
                  </div>
                </div>
                
                {/* Trust badges */}
                <div className="mt-6 pt-4 border-t border-gray-200">
                  <div className="flex items-center justify-around text-xs text-gray-500">
                    <div className="text-center">
                      <Shield className="h-6 w-6 mx-auto mb-1" />
                      <span>Secure Payment</span>
                    </div>
                    <div className="text-center">
                      <Zap className="h-6 w-6 mx-auto mb-1" />
                      <span>Instant Confirmation</span>
                    </div>
                    <div className="text-center">
                      <Star className="h-6 w-6 mx-auto mb-1" />
                      <span>Best Price Guarantee</span>
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-backdrop-fade" onClick={() => setShowQRModal(false)}>
          <div className="bg-white rounded-xl max-w-2xl w-full p-4 sm:p-6 max-h-[calc(100vh-2rem)] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="text-center mb-4">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
              <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">Purchase Complete!</h3>
              <p className="text-sm text-gray-600">Your tickets have been confirmed</p>
            </div>
            
            {/* QR Code Display */}
            <div className="bg-gray-50 rounded-xl p-4 sm:p-6 mb-4">
              <div className="flex flex-col items-center">
                <img 
                  src={qrCodeImage} 
                  alt="Purchase QR Code"
                  className="w-48 h-48 sm:w-64 sm:h-64 border border-gray-200 rounded-lg mb-3"
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
                <div className="flex justify-between border-t pt-2 mt-2 text-sm sm:text-base">
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
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
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