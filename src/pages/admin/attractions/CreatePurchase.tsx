import React, { useState, useEffect } from 'react';
import { 
  ShoppingCart, 
  CreditCard, 
  DollarSign,
  Plus,
  Minus,
  Search,
  X
} from 'lucide-react';
import { formatDurationDisplay } from '../../../utils/timeFormat';
import { useThemeColor } from '../../../hooks/useThemeColor';
import type { CreatePurchaseAttraction, CreatePurchaseCustomerInfo } from '../../../types/CreatePurchase.types';
import { attractionService, type Attraction } from '../../../services/AttractionService';
import { attractionCacheService } from '../../../services/AttractionCacheService';
import { attractionPurchaseService } from '../../../services/AttractionPurchaseService';
import { customerService, type Customer } from '../../../services/CustomerService';
import { locationService } from '../../../services/LocationService';
import LocationSelector from '../../../components/admin/LocationSelector';
import Toast from '../../../components/ui/Toast';
import EmptyStateModal from '../../../components/ui/EmptyStateModal';
import { ASSET_URL, getStoredUser } from '../../../utils/storage';
import { loadAcceptJS, processCardPayment, validateCardNumber, formatCardNumber, getCardType, createPayment } from '../../../services/PaymentService';
import { PAYMENT_TYPE } from '../../../types/Payment.types';
import { getAuthorizeNetPublicKey } from '../../../services/SettingsService';
import { generatePurchaseQRCode } from '../../../utils/qrcode';
import StandardButton from '../../../components/ui/StandardButton';

const CreatePurchase = () => {
  const { themeColor, fullColor } = useThemeColor();

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
  const [paymentMethod, setPaymentMethod] = useState('cash');
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
  
  // Card payment details
  const [useAuthorizeNet, setUseAuthorizeNet] = useState(false); // Toggle for Authorize.Net vs manual card
  const [cardNumber, setCardNumber] = useState('');
  const [cardMonth, setCardMonth] = useState('');
  const [cardYear, setCardYear] = useState('');
  const [cardCVV, setCardCVV] = useState('');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [authorizeApiLoginId, setAuthorizeApiLoginId] = useState('');
  const [_authorizeClientKey, setAuthorizeClientKey] = useState('');
  const [_authorizeEnvironment, setAuthorizeEnvironment] = useState<'sandbox' | 'production'>('sandbox');
  const [showNoAuthAccountModal, setShowNoAuthAccountModal] = useState(false);
  const [showEmptyModal, setShowEmptyModal] = useState(false);
  const [sendEmail, setSendEmail] = useState(true);
  
  const currentUser = getStoredUser();
  const isCompanyAdmin = currentUser?.role === 'company_admin';
  const [locations, setLocations] = useState<Array<{ id: number; name: string; address?: string; city?: string; state?: string }>>([]);
  const [selectedLocation, setSelectedLocation] = useState<number | null>(null);

  // Fetch locations for company admin
  useEffect(() => {
    if (isCompanyAdmin) {
      const fetchLocations = async () => {
        try {
          const response = await locationService.getLocations();
          if (response.success && response.data) {
            setLocations(Array.isArray(response.data) ? response.data : []);
          }
        } catch (error) {
          console.error('Error fetching locations:', error);
        }
      };
      fetchLocations();
    }
  }, [isCompanyAdmin]);

  // Load attractions from backend
  useEffect(() => {
    const loadAttractions = async () => {
      try {
        setLoading(true);
        
        // Check cache first for instant loading
        const cachedAttractions = await attractionCacheService.getCachedAttractions();
        
        if (cachedAttractions && cachedAttractions.length > 0) {
          // Filter to active attractions only and apply location filter
          const filteredCached = cachedAttractions.filter((attr: Attraction) => {
            if (!attr.is_active) return false;
            if (selectedLocation !== null && attr.location_id !== selectedLocation) return false;
            return true;
          });
          
          // Convert cached API format to component format
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
            availability: typeof attr.availability === 'object' ? attr.availability as Record<string, boolean> : {},
          }));
          
          setAttractions(convertedAttractions);
          setFilteredAttractions(convertedAttractions);
          
          if (convertedAttractions.length === 0) {
            setShowEmptyModal(true);
          }
          setLoading(false);
          return;
        }
        
        // If no cache, fetch from API
        const params: any = {
          is_active: true,
          per_page: 100,
          user_id: getStoredUser()?.id
        };
        if (selectedLocation !== null) {
          params.location_id = selectedLocation;
        }
        const response = await attractionService.getAttractions(params);
        
        // Cache the fetched attractions
        await attractionCacheService.cacheAttractions(response.data.attractions);
        
        // Convert API format to component format
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
          availability: typeof attr.availability === 'object' ? attr.availability as Record<string, boolean> : {},
        }));

        console.log('Loaded attractions for purchase:', convertedAttractions);
        
        setAttractions(convertedAttractions);
        setFilteredAttractions(convertedAttractions);
        
        // Show modal if no attractions available
        if (convertedAttractions.length === 0) {
          setShowEmptyModal(true);
        }
      } catch (error) {
        console.error('Error loading attractions:', error);
        setToast({ message: 'Failed to load attractions', type: 'error' });
        setShowEmptyModal(true);
      } finally {
        setLoading(false);
      }
    };

    loadAttractions();
  }, [selectedLocation]);

  // Filter attractions based on search term
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
            name: `${exactMatch.first_name} ${exactMatch.last_name}`,
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

  // Initialize Authorize.Net only when needed
  useEffect(() => {
    // Only initialize if card payment and Authorize.Net is selected
    if (paymentMethod !== 'card' || !useAuthorizeNet) {
      return;
    }

    const initializeAuthorizeNet = async () => {
      try {
        const locationId = selectedAttraction?.locationId || 1;
        const response = await getAuthorizeNetPublicKey(locationId);
        if (response && response.api_login_id) {
          setAuthorizeApiLoginId(response.api_login_id);
          setAuthorizeClientKey(response.client_key || response.api_login_id);
          setAuthorizeEnvironment((response.environment || 'sandbox') as 'sandbox' | 'production');
          setShowNoAuthAccountModal(false);
          
          // Load Accept.js with the correct environment from API response
          await loadAcceptJS((response.environment || 'sandbox') as 'sandbox' | 'production');
          console.log('✅ Accept.js loaded successfully for environment:', response.environment);
        } else {
          setShowNoAuthAccountModal(true);
        }
      } catch (error: any) {
        console.error('❌ Failed to initialize Authorize.Net:', error);
        if (error.response?.data?.message?.includes('No active Authorize.Net account')) {
          setShowNoAuthAccountModal(true);
        }
      }
    };
    initializeAuthorizeNet();
  }, [selectedAttraction, paymentMethod, useAuthorizeNet]);

  const handleCustomerInfoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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

  const calculateTotal = () => {
    const subtotal = calculateSubtotal();
    return Math.max(0, subtotal - discount);
  };

  const handleAddToCart = (attraction: CreatePurchaseAttraction) => {
    setSelectedAttraction(attraction);
    setQuantity(1);
    setDiscount(0);
  };

  const handleCompletePurchase = async () => {
    if (!selectedAttraction) return;

    // Validate card information if payment method is card AND using Authorize.Net
    if (paymentMethod === 'card' && useAuthorizeNet) {
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
    }

    try {
      setSubmitting(true);
      setIsProcessingPayment(true);
      setPaymentError('');

      const totalAmount = calculateTotal();
      let transactionId: string | undefined;

      // Process card payment if payment method is card AND using Authorize.Net
      if (paymentMethod === 'card' && useAuthorizeNet) {
        console.log('💳 Processing card payment with Authorize.Net...');
        
        const cardData = {
          cardNumber: cardNumber.replace(/\s/g, ''),
          month: cardMonth,
          year: cardYear,
          cardCode: cardCVV,
        };
        
        // Customer billing data for Authorize.Net
        const customerData = {
          first_name: customerInfo.name?.split(' ')[0] || '',
          last_name: customerInfo.name?.split(' ').slice(1).join(' ') || '',
          email: customerInfo.email || '',
          phone: customerInfo.phone || '',
        };
        
        const paymentData = {
          location_id: selectedAttraction.locationId || 1,
          amount: totalAmount,
          order_id: `A${selectedAttraction.id}-${Date.now().toString().slice(-8)}`, // Max 20 chars for Authorize.Net
          description: `Attraction Purchase: ${selectedAttraction.name}`,
        };
        
        const paymentResponse = await processCardPayment(
          cardData,
          paymentData,
          authorizeApiLoginId,
          undefined, // No client key for this flow
          customerData // Pass customer billing data
        );
        
        if (!paymentResponse.success) {
          throw new Error(paymentResponse.message || 'Payment failed');
        }
        
        transactionId = paymentResponse.transaction_id;
        console.log('✅ Payment successful:', transactionId);
      }

      // Create purchase data matching backend Payment model
      const purchaseData = {
        attraction_id: Number(selectedAttraction.id),
        customer_id: selectedCustomerId || undefined,
        guest_name: customerInfo.name || 'Walk-in Customer',
        guest_email: customerInfo.email || undefined,
        guest_phone: customerInfo.phone || undefined,
        quantity: quantity,
        amount: totalAmount,
        amount_paid: paymentMethod === 'paylater' ? 0 : (paymentMethod === 'card' ? totalAmount : amountPaid),
        currency: 'USD',
        method: paymentMethod as 'card' | 'cash' | 'paylater',
        payment_method: paymentMethod as 'card' | 'cash' | 'paylater',
        status: (paymentMethod === 'paylater' || paymentMethod === 'cash' ? 'pending' : 'completed') as 'pending' | 'completed' | 'cancelled',
        payment_id: transactionId, // Only present if Authorize.Net was used
        location_id: selectedAttraction.locationId || 1,
        purchase_date: new Date().toISOString().split('T')[0],
        notes: notes || `Attraction Purchase: ${selectedAttraction.name} (${quantity} ticket${quantity > 1 ? 's' : ''})`,
        send_email: sendEmail,
        // transaction_id is auto-generated by backend
      };

      const authToken = getAuthToken();
      console.log('🔐 Creating manual purchase - Auth Token:', authToken ? 'Present' : 'Missing');

      // Create purchase via API
      const response = await attractionPurchaseService.createPurchase(purchaseData);
      const createdPurchase = response.data;

      // Generate QR code for email (not displayed in UI)
      let qrCodeData = '';
      try {
        qrCodeData = await generatePurchaseQRCode(createdPurchase.id);
        console.log('✅ QR code generated successfully');
      } catch (qrError) {
        console.error('❌ QR code generation failed:', qrError);
      }

      // Create payment record if amount_paid > 0
      const actualAmountPaid = paymentMethod === 'paylater' ? 0 : (paymentMethod === 'card' ? totalAmount : amountPaid);
      if (actualAmountPaid > 0) {
        try {
          const paymentData = {
            payable_id: createdPurchase.id,
            payable_type: PAYMENT_TYPE.ATTRACTION_PURCHASE,
            customer_id: selectedCustomerId || null,
            amount: actualAmountPaid,
            currency: 'USD',
            method: paymentMethod as 'card' | 'cash',
            status: 'completed' as const,
            location_id: selectedAttraction.locationId || 1,
            notes: `Payment for attraction purchase: ${selectedAttraction.name}`,
          };
          
          await createPayment(paymentData);
          console.log('✅ Payment record created for purchase:', createdPurchase.id);
        } catch (paymentError) {
          console.error('⚠️ Failed to create payment record:', paymentError);
          // Don't fail the entire process if payment record creation fails
        }
      }

      // Send receipt email with QR code only if QR code was generated
      if (qrCodeData) {
        try {
          await attractionPurchaseService.sendReceipt(
            createdPurchase.id,
            qrCodeData,
            sendEmail
          );
          if (sendEmail) {
            setToast({ message: 'Purchase completed! Receipt sent to email.', type: 'success' });
          } else {
            setToast({ message: 'Purchase completed! (Email not sent per request)', type: 'info' });
          }
        } catch (emailError) {
          console.error('❌ Error sending email:', emailError);
          setToast({ message: 'Purchase completed! (Email failed to send)', type: 'info' });
        }
      } else {
        console.warn('⚠️ Skipping email - QR code not generated');
        setToast({ message: 'Purchase completed! (Email not sent - QR code generation failed)', type: 'info' });
      }

      // Reset form immediately
      setSelectedAttraction(null);
      setQuantity(1);
      setCustomerInfo({ name: '', email: '', phone: '' });
      setDiscount(0);
      setNotes('');
      setAmountPaid(0);
      setPaymentMethod('cash');
      setSelectedCustomerId(null);
      setCardNumber('');
      setCardMonth('');
      setCardYear('');
      setCardCVV('');
      setPaymentError('');
      setUseAuthorizeNet(false);
      setSendEmail(true);

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
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className={`animate-spin rounded-full h-12 w-12 border-b-2 border-${themeColor}-600`}></div>
      </div>
    );
  }


  return (
    <div className="min-h-screen p-6">
      <div className="mx-auto">
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Create New Purchase</h1>
              <p className="text-gray-600">Process on-site ticket purchases for customers</p>
            </div>
            
            {isCompanyAdmin && (
              <LocationSelector
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
                variant="compact"
                showAllOption={true}
              />
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Attraction Selection */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">Select Attraction</h2>
              
              {/* Search */}
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

              {/* Attractions Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-96 overflow-y-auto">
                {filteredAttractions.filter(a => a.status === 'active').map(attraction => (
                  <div
                    key={attraction.id}
                    className={`border rounded-lg p-4 cursor-pointer transition-colors flex gap-4 ${
                      selectedAttraction?.id === attraction.id
                        ? `border-${themeColor}-500 bg-${themeColor}-50`
                        : `border-gray-200 hover:border-${themeColor}-300`
                    }`}
                    onClick={() => handleAddToCart(attraction)}
                  >
                    {/* Attraction Image */}
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
            </div>

            {/* Customer Information */}
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
          </div>

          {/* Right Column - Purchase Summary */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm p-6 sticky top-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">Purchase Summary</h2>
              
              {selectedAttraction ? (
                <>
                  {/* Selected Attraction */}
                  <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-semibold text-gray-800">{selectedAttraction.name}</h3>
                      <StandardButton
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedAttraction(null)}
                        icon={X}
                      >
                        {''}
                      </StandardButton>
                    </div>
                    {/* Attraction Image */}
                    <div className="mb-3 w-full flex justify-center">
                      {selectedAttraction.images && selectedAttraction.images.length > 0 ? (
                        <img src={ASSET_URL + selectedAttraction.images[0]}  alt={selectedAttraction.name} className="max-h-32 rounded-lg object-contain border border-gray-200" />
                      ) : (
                        <span className="text-gray-400 text-xs">No Image</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mb-3">{selectedAttraction.category}</p>
                    {/* Quantity Selector */}
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Quantity</label>
                      <div className="flex items-center">
                        <StandardButton
                          variant="ghost"
                          size="sm"
                          onClick={() => setQuantity(Math.max(1, quantity - 1))}
                          icon={Minus}
                        >
                          {''}
                        </StandardButton>
                        <span className="mx-3 font-semibold transition-all duration-300">{quantity}</span>
                        <StandardButton
                          variant="ghost"
                          size="sm"
                          onClick={() => setQuantity(quantity + 1)}
                          icon={Plus}
                        >
                          {''}
                        </StandardButton>
                      </div>
                      {/* Live subtotal preview */}
                      <div className="mt-2 text-sm text-gray-600">
                        ${selectedAttraction.price} × {quantity} = <span className="font-semibold text-gray-800 transition-all duration-300">${calculateSubtotal().toFixed(2)}</span>
                      </div>
                    </div>

                    {/* Discount */}
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Discount ($)</label>
                      <input
                        type="number"
                        min="0"
                        max={calculateSubtotal()}
                        value={discount}
                        onChange={(e) => setDiscount(Number(e.target.value))}
                        className={`w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500`}
                      />
                    </div>

                    {/* Amount Paid */}
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Amount Paid {paymentMethod === 'paylater' && <span className="text-gray-500 text-xs">(Auto: $0.00)</span>}
                      </label>
                      <input
                        type="number"
                        min="0"
                        max={calculateTotal()}
                        value={paymentMethod === 'paylater' ? 0 : amountPaid}
                        onChange={(e) => setAmountPaid(Number(e.target.value))}
                        disabled={paymentMethod === 'paylater'}
                        className={`w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 ${paymentMethod === 'paylater' ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                        placeholder="0.00"
                      />
                    </div>

                    {/* Notes */}
                    <div className="mb-4">
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

                  {/* Payment Method */}
                  <div className="mb-6">
                    <h3 className="text-sm font-medium text-gray-700 mb-3">Payment Method</h3>
                    <div className="grid grid-cols-3 gap-2">
                      <StandardButton
                        variant={paymentMethod === 'cash' ? 'primary' : 'secondary'}
                        size="md"
                        onClick={() => setPaymentMethod('cash')}
                        icon={DollarSign}
                      >
                        Cash
                      </StandardButton>
                   
                      <StandardButton
                        variant={paymentMethod === 'card' ? 'primary' : 'secondary'}
                        size="md"
                        onClick={() => setPaymentMethod('card')}
                        icon={CreditCard}
                      >
                        Card
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
                  </div>

                  {/* Pay Later Notice */}
                  {paymentMethod === 'paylater' && (
                    <div className="mb-6 p-4 bg-orange-50 rounded-lg border border-orange-200">
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

                  {/* Card Payment Form - Show only when card is selected */}
                  {paymentMethod === 'card' && (
                    <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="mb-4">
                        <h3 className="text-sm font-medium text-gray-700 mb-3">Card Payment Type</h3>
                        <div className="flex gap-2">
                          <StandardButton
                            variant={!useAuthorizeNet ? 'primary' : 'secondary'}
                            size="sm"
                            onClick={() => setUseAuthorizeNet(false)}
                            fullWidth
                          >
                            Manual Card
                          </StandardButton>
                          <StandardButton
                            variant={useAuthorizeNet ? 'primary' : 'secondary'}
                            size="sm"
                            onClick={() => setUseAuthorizeNet(true)}
                            fullWidth
                          >
                            Process with Authorize.Net
                          </StandardButton>
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                          {useAuthorizeNet 
                            ? 'Process payment online with Authorize.Net' 
                            : 'Customer paid by card - no online processing'}
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
                              const value = e.target.value.replace(/\\D/g, '');
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
                        </>
                      )}
                    </div>
                  )}

                  {/* Pricing Breakdown */}
                  <div className="border-t border-gray-200 pt-4 mb-6">
                    <div className="flex justify-between mb-2">
                      <span className="text-gray-600">Subtotal</span>
                      <span className="font-medium transition-all duration-300">${calculateSubtotal().toFixed(2)}</span>
                    </div>
                    {discount > 0 && (
                      <div className="flex justify-between mb-2 text-red-600 transition-all duration-300">
                        <span>Discount</span>
                        <span>-${discount.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold text-lg mt-3 pt-3 border-t border-gray-200">
                      <span>Total</span>
                      <span className="transition-all duration-300">${calculateTotal().toFixed(2)}</span>
                    </div>
                    
                    {paymentMethod === 'paylater' && (
                      <div className="flex justify-between font-semibold text-md mt-2 pt-2 border-t border-dashed border-gray-300 text-orange-700">
                        <span>Amount Due Now</span>
                        <span>$0.00</span>
                      </div>
                    )}
                  </div>

                  {/* Send Email Receipt Checkbox */}
                  <div className="mb-6">
                    <label className="flex items-center space-x-3 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={sendEmail}
                        onChange={(e) => setSendEmail(e.target.checked)}
                        className={`w-4 h-4 rounded border-gray-300 text-${themeColor}-600 focus:ring-${themeColor}-500 cursor-pointer`}
                      />
                      <span className="text-sm text-gray-700 group-hover:text-gray-900">
                        Send email receipt to customer
                      </span>
                    </label>
                    {!sendEmail && (
                      <p className="text-xs text-gray-500 mt-1 ml-7">
                        Customer will not receive a purchase confirmation email
                      </p>
                    )}
                  </div>

                  {/* Complete Purchase Button */}
                  <StandardButton
                    variant="primary"
                    size="lg"
                    onClick={handleCompletePurchase}
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
                  <p>Select an attraction to begin</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

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

      {/* Empty State Modal */}
      <EmptyStateModal
        type="attractions"
        isOpen={showEmptyModal}
        onClose={() => setShowEmptyModal(false)}
      />
    </div>
  );
};

export default CreatePurchase;