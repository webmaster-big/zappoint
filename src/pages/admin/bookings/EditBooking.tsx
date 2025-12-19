import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Calendar, Users, DollarSign, Package, Clock, Mail, Phone, User, Home, Gift, Tag, Plus, Minus, AlertCircle } from 'lucide-react';
import StandardButton from '../../../components/ui/StandardButton';
import { useThemeColor } from '../../../hooks/useThemeColor';
import bookingService, { type Booking } from '../../../services/bookingService';
import packageService from '../../../services/PackageService';
import attractionService from '../../../services/AttractionService';
import type { Package as PackageType } from '../../../services/PackageService';

interface AttractionItem {
  id: string | number;
  name: string;
  price: number;
  pricingType: string;
  quantity: number;
  price_at_booking?: number;
}

interface AddOnItem {
  id: number;
  name: string;
  price: number;
  quantity: number;
  price_at_booking?: number;
}

const EditBooking: React.FC = () => {
  const { themeColor, fullColor } = useThemeColor();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const referenceNumber = searchParams.get('ref');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [originalBooking, setOriginalBooking] = useState<Booking | null>(null);
  const [packageDetails, setPackageDetails] = useState<PackageType | null>(null);
  const [availableAttractions, setAvailableAttractions] = useState<AttractionItem[]>([]);
  const [selectedAttractions, setSelectedAttractions] = useState<AttractionItem[]>([]);
  const [selectedAddOns, setSelectedAddOns] = useState<AddOnItem[]>([]);
  const [originalAmountPaid, setOriginalAmountPaid] = useState<number>(0);
  const [formData, setFormData] = useState({
    customerName: '',
    email: '',
    phone: '',
    date: '',
    time: '',
    participants: 0,
    status: 'pending' as 'pending' | 'confirmed' | 'checked-in' | 'completed' | 'cancelled',
    paymentMethod: 'cash' as 'card' | 'cash',
    paymentStatus: 'pending' as 'paid' | 'partial' | 'pending',
    paymentType: 'full' as 'full' | 'partial',
    roomId: null as number | null,
    notes: '',
    giftCardCode: '',
    promoCode: '',
    guestOfHonorName: '',
    guestOfHonorAge: '',
    guestOfHonorGender: '',
  });

  // Load booking data and package details from backend
  useEffect(() => {
    const loadBookingAndPackage = async () => {
      if (!id && !referenceNumber) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      try {
        let bookingData: Booking | null = null;
        
        // Prefer reference number lookup if available
        console.log('Loading booking with reference number:', referenceNumber);
        if (referenceNumber) {
          const response = await bookingService.getBookings({ reference_number: referenceNumber });
          if (response.success && response.data && response.data.bookings.length > 0) {
            bookingData = response.data.bookings[0];

          }
        } else if (id) {
          // Fallback to ID lookup
          const response = await bookingService.getBookingById(Number(id));
          if (response.success && response.data) {
            bookingData = response.data;
          }
        }

        if (!bookingData) {
          setNotFound(true);
          setLoading(false);
          return;
        }

        setOriginalBooking(bookingData);
        
        // Store original amount paid
        setOriginalAmountPaid(Number(bookingData.amount_paid || 0));

        // Fetch package details to get rooms, add-ons, attractions, etc.
        if (bookingData.package_id) {
          const packageResponse = await packageService.getPackage(bookingData.package_id);
          if (packageResponse.success && packageResponse.data) {
            setPackageDetails(packageResponse.data);
          }
        }

        // Fetch all available attractions
        const attractionsResponse = await attractionService.getAttractions({ is_active: true });
        if (attractionsResponse.success && attractionsResponse.data) {
          const transformedAttractions = attractionsResponse.data.attractions.map((attr) => ({            id: String(attr.id),
            name: attr.name,
            price: Number(attr.price),
            pricingType: attr.pricing_type || 'fixed',
            quantity: 1,
          }));
          setAvailableAttractions(transformedAttractions);
        }

        // Set form data from booking
        setFormData({
          customerName: bookingData.guest_name || '',
          email: bookingData.guest_email || '',
          phone: bookingData.guest_phone || '',
          date: bookingData.booking_date.split('T')[0],
          time: bookingData.booking_time,
          participants: bookingData.participants,
          status: bookingData.status,
          paymentMethod: (bookingData.payment_method || 'cash') as 'card' | 'cash',
          paymentStatus: bookingData.payment_status,
          paymentType: bookingData.payment_status === 'partial' ? 'partial' : 'full',
          roomId: bookingData.room_id || null,
          notes: bookingData.notes || '',
          giftCardCode: '',
          promoCode: '',
          guestOfHonorName: bookingData.guest_of_honor_name || '',
          guestOfHonorAge: bookingData.guest_of_honor_age ? String(bookingData.guest_of_honor_age) : '',
          guestOfHonorGender: bookingData.guest_of_honor_gender || '',
        });

        // Set selected attractions from booking
        if (bookingData.attractions && Array.isArray(bookingData.attractions)) {
          const bookingAttractions = bookingData.attractions.map((attr) => {
            const attrData = attr as {id: number; name: string; price: number; pricing_type?: string; pivot?: {quantity?: number; price_at_booking?: number}};
            const quantity = attrData.pivot?.quantity || 1;
            const currentPrice = Number(attrData.price);
            return {
            id: String(attrData.id),
            name: attrData.name,
            price: currentPrice,
            pricingType: attrData.pricing_type || 'fixed',
            quantity: quantity,
            price_at_booking: attrData.pivot?.price_at_booking || currentPrice,
          }});

          console.log('Loaded booking attractions:', bookingData);
          setSelectedAttractions(bookingAttractions);
        }

        // Set selected add-ons from booking
        if (bookingData.addOns && Array.isArray(bookingData.addOns)) {
          const bookingAddOns = bookingData.addOns.map((addon) => {
            const addonData = addon as {id: number; name: string; price: number; pivot?: {quantity?: number; price_at_booking?: number}};
            const quantity = addonData.pivot?.quantity || 1;
            const currentPrice = Number(addonData.price);
            return {
            id: addonData.id,
            name: addonData.name,
            price: currentPrice,
            quantity: quantity,
            price_at_booking: addonData.pivot?.price_at_booking || currentPrice,
          }});
          setSelectedAddOns(bookingAddOns);
        }

      } catch (error) {
        console.error('Error loading booking:', error);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };

    loadBookingAndPackage();
  }, [id, referenceNumber]);

  // Calculate total based on package, participants, attractions, and add-ons
  const calculateTotal = () => {
    if (!packageDetails) return 0;
    
    let total = Number(packageDetails.price);
    
    // Additional participants cost only if exceeding max_participants
    if (packageDetails.price_per_additional && packageDetails.max_participants && formData.participants > packageDetails.max_participants) {
      const additionalCount = formData.participants - packageDetails.max_participants;
      total += additionalCount * Number(packageDetails.price_per_additional);
    }
    
    // Attractions - all calculated as price × quantity
    selectedAttractions.forEach(({ price, quantity }) => {
      total += price * quantity;
    });
    
    // Add-ons
    selectedAddOns.forEach(({ price, quantity }) => {
      total += price * quantity;
    });
    
    // Apply gift card discount if valid
    if (formData.giftCardCode && packageDetails.gift_cards) {
      const giftCard = packageDetails.gift_cards.find(
        (gc) => (gc as {code?: string; status?: string}).code === formData.giftCardCode && (gc as {status?: string}).status === 'active'
      );
      if (giftCard) {
        const gcData = giftCard as {type?: string; value?: number};
        if (gcData.type === 'percentage') {
          total -= total * (Number(gcData.value) / 100);
        } else {
          total -= Number(gcData.value);
        }
      }
    }
    
    // Apply promo discount if valid
    if (formData.promoCode && packageDetails.promos) {
      const promo = packageDetails.promos.find(
        (p) => (p as {code?: string; status?: string}).code === formData.promoCode && (p as {status?: string}).status === 'active'
      );
      if (promo) {
        const promoData = promo as {type?: string; value?: number};
        if (promoData.type === 'percentage') {
          total -= total * (Number(promoData.value) / 100);
        } else {
          total -= Number(promoData.value);
        }
      }
    }
    
    return Math.max(0, total);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'participants' || name === 'roomId' ? Number(value) : value
    }));
  };

  const handleAttractionToggle = (attractionId: string) => {
    const existingIndex = selectedAttractions.findIndex(a => a.id === attractionId);
    
    if (existingIndex >= 0) {
      setSelectedAttractions(prev => prev.filter(a => a.id !== attractionId));
    } else {
      const attraction = availableAttractions.find(a => a.id === attractionId);
      if (attraction) {
        setSelectedAttractions(prev => [...prev, { ...attraction, quantity: 1 }]);
      }
    }
  };

  const handleAttractionQuantityChange = (attractionId: string, quantity: number) => {
    if (quantity < 1) return;
    setSelectedAttractions(prev =>
      prev.map(a => a.id === attractionId ? { ...a, quantity } : a)
    );
  };

  const handleAddOnToggle = (addOnId: number) => {
    const existingIndex = selectedAddOns.findIndex(a => a.id === addOnId);
    
    if (existingIndex >= 0) {
      setSelectedAddOns(prev => prev.filter(a => a.id !== addOnId));
    } else {
      const addOn = packageDetails?.add_ons?.find((a) => (a as {id?: number}).id === addOnId);
      if (addOn) {
        const addonData = addOn as {id: number; name: string; price: number};
        setSelectedAddOns(prev => [...prev, {
          id: addonData.id,
          name: addonData.name,
          price: Number(addonData.price),
          quantity: 1,
        }]);
      }
    }
  };

  const handleAddOnQuantityChange = (addOnId: number, quantity: number) => {
    if (quantity < 1) return;
    setSelectedAddOns(prev =>
      prev.map(a => a.id === addOnId ? { ...a, quantity } : a)
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!originalBooking) {
      alert('Booking data not found');
      return;
    }

    setSubmitting(true);

    try {
      const totalAmount = calculateTotal();
      // Keep the original amount paid, don't recalculate
      const amountPaid = originalAmountPaid;

      // Prepare attractions data
      const additionalAttractions = selectedAttractions.map(({ id, quantity, price }) => {
        const numId = typeof id === 'number' ? id : parseInt(id, 10);
        const priceAtBooking = price * quantity;
        
        return {
          attraction_id: numId,
          quantity: quantity,
          price_at_booking: Number(priceAtBooking.toFixed(2))
        };
      });

      // Prepare add-ons data
      const additionalAddons = selectedAddOns.map(({ id, quantity, price }) => ({
        addon_id: id,
        quantity: quantity,
        price_at_booking: Number((price * quantity).toFixed(2))
      }));

      // Update the booking via API
      const response = await bookingService.updateBooking(Number(originalBooking.id), {
        guest_name: formData.customerName,
        guest_email: formData.email,
        guest_phone: formData.phone,
        booking_date: formData.date,
        booking_time: formData.time,
        participants: formData.participants,
        status: formData.status,
        total_amount: totalAmount,
        amount_paid: amountPaid,
        payment_method: formData.paymentMethod,
        payment_status: amountPaid >= totalAmount ? 'paid' : 
                       amountPaid > 0 && amountPaid < totalAmount ? 'partial' : 'pending',
        notes: formData.notes || undefined,
        room_id: formData.roomId || undefined,
        additional_attractions: additionalAttractions.length > 0 ? additionalAttractions : undefined,
        additional_addons: additionalAddons.length > 0 ? additionalAddons : undefined,
        guest_of_honor_name: packageDetails?.has_guest_of_honor && formData.guestOfHonorName ? formData.guestOfHonorName : undefined,
        guest_of_honor_age: packageDetails?.has_guest_of_honor && formData.guestOfHonorAge ? parseInt(formData.guestOfHonorAge) : undefined,
        guest_of_honor_gender: packageDetails?.has_guest_of_honor && formData.guestOfHonorGender ? formData.guestOfHonorGender as 'male' | 'female' | 'other' : undefined,
      });

      if (response.success) {
        alert('Booking updated successfully!');
        navigate('/bookings');
      } else {
        alert('Failed to update booking. Please try again.');
        setSubmitting(false);
      }
    } catch (error) {
      console.error('Error updating booking:', error);
      alert('Error updating booking. Please try again.');
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-800 mx-auto"></div>
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-16 w-16 text-red-600 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-gray-800 mb-4">Booking Not Found</h1>
          <p className="text-gray-600 mb-6">The booking you're looking for doesn't exist.</p>
          <StandardButton
            variant="primary"
            size="md"
            onClick={() => navigate('/bookings')}
          >
            Back to Bookings
          </StandardButton>
        </div>
      </div>
    );
  }

  const totalAmount = calculateTotal();

  return (
    <div className="min-h-screen py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-lg overflow-hidden">
          {/* Header */}
          <div className="p-6 border-b border-gray-100">
            <h1 className="text-3xl font-bold text-gray-800">Edit Booking</h1>
            <p className="mt-2 text-gray-600">
              Update booking details for {originalBooking?.reference_number}
            </p>
          </div>

          {/* Customer Information */}
          <div className="p-6 border-b border-gray-100">
            <h2 className="text-xl font-semibold text-gray-800 mb-6 pb-2 border-b border-gray-100 flex items-center gap-2">
              <User size={20} />
              Customer Information
            </h2>
            
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label htmlFor="customerName" className="block text-sm font-medium text-gray-800 mb-2">
                  Customer Name *
                </label>
                <input
                  type="text"
                  name="customerName"
                  id="customerName"
                  required
                  value={formData.customerName}
                  onChange={handleInputChange}
                  className={`w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-transparent`}
                />
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-800 mb-2 flex items-center gap-2">
                  <Mail size={16} />
                  Email *
                </label>
                <input
                  type="email"
                  name="email"
                  id="email"
                  required
                  value={formData.email}
                  onChange={handleInputChange}
                  className={`w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-transparent`}
                />
              </div>

              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-gray-800 mb-2 flex items-center gap-2">
                  <Phone size={16} />
                  Phone *
                </label>
                <input
                  type="tel"
                  name="phone"
                  id="phone"
                  required
                  value={formData.phone}
                  onChange={handleInputChange}
                  className={`w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-transparent`}
                />
              </div>
            </div>
          </div>

          {/* Booking Details */}
          <div className="p-6 border-b border-gray-100">
            <h2 className="text-xl font-semibold text-gray-800 mb-6 pb-2 border-b border-gray-100 flex items-center gap-2">
              <Package size={20} />
              Booking Details
            </h2>
            
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              {packageDetails && (
                <div className="sm:col-span-2 bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm font-medium text-gray-700">Package: <span className="text-gray-900">{packageDetails.name}</span></p>
                  <p className="text-sm text-gray-600 mt-1">{packageDetails.description}</p>
                </div>
              )}

              {/* Room Selection */}
              {packageDetails?.rooms && packageDetails.rooms.length > 0 && (
                <div className="sm:col-span-2">
                  <label htmlFor="roomId" className="block text-sm font-medium text-gray-800 mb-2 flex items-center gap-2">
                    <Home size={16} />
                    Room *
                  </label>
                  <select
                    name="roomId"
                    id="roomId"
                    required
                    value={formData.roomId || ''}
                    onChange={handleInputChange}
                    className={`w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-transparent`}
                  >
                    <option value="">Select a room</option>
                    {packageDetails.rooms.map((room) => {
                      const roomData = room as {id: number; name: string};
                      return (
                      <option key={roomData.id} value={roomData.id}>
                        {roomData.name}
                      </option>
                    )})}
                  </select>
                </div>
              )}

              <div>
                <label htmlFor="date" className="block text-sm font-medium text-gray-800 mb-2 flex items-center gap-2">
                  <Calendar size={16} />
                  Date *
                </label>
                <input
                  type="date"
                  name="date"
                  id="date"
                  required
                  value={formData.date}
                  onChange={handleInputChange}
                  className={`w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-transparent`}
                />
              </div>

              <div>
                <label htmlFor="time" className="block text-sm font-medium text-gray-800 mb-2 flex items-center gap-2">
                  <Clock size={16} />
                  Time *
                </label>
                <input
                  type="time"
                  name="time"
                  id="time"
                  required
                  value={formData.time}
                  onChange={handleInputChange}
                  className={`w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-transparent`}
                />
              </div>

              <div>
                <label htmlFor="participants" className="block text-sm font-medium text-gray-800 mb-2 flex items-center gap-2">
                  <Users size={16} />
                  Participants *
                </label>
                <input
                  type="number"
                  name="participants"
                  id="participants"
                  min="1"
                  required
                  value={formData.participants}
                  onChange={handleInputChange}
                  className={`w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-transparent`}
                />
              </div>
            </div>
          </div>

          {/* Attractions */}
          {availableAttractions.length > 0 && (
            <div className="p-6 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Additional Attractions</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {availableAttractions.map(attraction => {
                  const isSelected = selectedAttractions.some(a => a.id === attraction.id);
                  const selectedAttraction = selectedAttractions.find(a => a.id === attraction.id);
                  
                  return (
                    <div
                      key={attraction.id}
                      className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                        isSelected ? `border-${themeColor}-500 bg-${themeColor}-50` : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => handleAttractionToggle(attraction.id.toString())}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-medium text-gray-900">{attraction.name}</h4>
                          <p className="text-sm text-gray-600 mt-1">
                            ${attraction.price.toFixed(2)} 
                            {attraction.pricingType === 'per_person' ? ' per person' : 
                             attraction.pricingType === 'per_hour' ? ' per hour' : 
                             ' fixed'}
                          </p>
                        </div>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleAttractionToggle(attraction.id.toString())}
                          className={`h-5 w-5 text-${fullColor} rounded focus:ring-${themeColor}-500`}
                        />
                      </div>
                      
                      {isSelected && selectedAttraction && (
                        <div className="mt-3 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                          <label className="text-sm font-medium text-gray-700">Quantity:</label>
                          <StandardButton
                            variant="ghost"
                            size="sm"
                            icon={Minus}
                            onClick={() => handleAttractionQuantityChange(attraction.id.toString(), selectedAttraction.quantity - 1)}
                          >
                            {''}
                          </StandardButton>
                          <span className="w-12 text-center">{selectedAttraction.quantity}</span>
                          <StandardButton
                            variant="ghost"
                            size="sm"
                            icon={Plus}
                            onClick={() => handleAttractionQuantityChange(attraction.id.toString(), selectedAttraction.quantity + 1)}
                          >
                            {''}
                          </StandardButton>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Add-Ons */}
          {packageDetails?.add_ons && packageDetails.add_ons.length > 0 && (
            <div className="p-6 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Package Add-Ons</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {packageDetails.add_ons.map((addOn) => {
                  const addonData = addOn as {id: number; name: string; price: number};
                  const isSelected = selectedAddOns.some(a => a.id === addonData.id);
                  const selectedAddOn = selectedAddOns.find(a => a.id === addonData.id);
                  
                  return (
                    <div
                      key={addonData.id}
                      className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                        isSelected ? `border-${themeColor}-500 bg-${themeColor}-50` : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => handleAddOnToggle(addonData.id)}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-medium text-gray-900">{addonData.name}</h4>
                          <p className="text-sm text-gray-600 mt-1">${Number(addonData.price).toFixed(2)}</p>
                        </div>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleAddOnToggle(addonData.id)}
                          className={`h-5 w-5 text-${fullColor} rounded focus:ring-${themeColor}-500`}
                        />
                      </div>
                      
                      {isSelected && selectedAddOn && (
                        <div className="mt-3 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                          <label className="text-sm font-medium text-gray-700">Quantity:</label>
                          <StandardButton
                            variant="ghost"
                            size="sm"
                            icon={Minus}
                            onClick={() => handleAddOnQuantityChange(addonData.id, selectedAddOn.quantity - 1)}
                          >
                            {''}
                          </StandardButton>
                          <span className="w-12 text-center">{selectedAddOn.quantity}</span>
                          <StandardButton
                            variant="ghost"
                            size="sm"
                            icon={Plus}
                            onClick={() => handleAddOnQuantityChange(addonData.id, selectedAddOn.quantity + 1)}
                          >
                            {''}
                          </StandardButton>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Gift Card & Promo */}
          <div className="p-6 border-b border-gray-100">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Discounts</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-800 mb-2 flex items-center gap-2">
                  <Gift size={16} />
                  Gift Card Code
                </label>
                <input
                  type="text"
                  name="giftCardCode"
                  value={formData.giftCardCode}
                  onChange={handleInputChange}
                  className={`w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-transparent`}
                  placeholder="Enter gift card code"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-800 mb-2 flex items-center gap-2">
                  <Tag size={16} />
                  Promo Code
                </label>
                <input
                  type="text"
                  name="promoCode"
                  value={formData.promoCode}
                  onChange={handleInputChange}
                  className={`w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-transparent`}
                  placeholder="Enter promo code"
                />
              </div>
            </div>
          </div>

          {/* Payment & Status */}
          <div className="p-6 border-b border-gray-100">
            <h2 className="text-xl font-semibold text-gray-800 mb-6 pb-2 border-b border-gray-100 flex items-center gap-2">
              <DollarSign size={20} />
              Payment & Status
            </h2>
            
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <label htmlFor="paymentMethod" className="block text-sm font-medium text-gray-800 mb-2">
                  Payment Method *
                </label>
                <select
                  name="paymentMethod"
                  id="paymentMethod"
                  required
                  value={formData.paymentMethod}
                  onChange={handleInputChange}
                  className={`w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-transparent`}
                >
                  <option value="cash">Cash</option>
                  <option value="card">Card</option>
                </select>
              </div>

              <div>
                <label htmlFor="status" className="block text-sm font-medium text-gray-800 mb-2">
                  Booking Status *
                </label>
                <select
                  name="status"
                  id="status"
                  required
                  value={formData.status}
                  onChange={handleInputChange}
                  className={`w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-transparent`}
                >
                  <option value="pending">Pending</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="checked-in">Checked In</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>

            {/* Price Summary */}
            <div className="mt-6 bg-gray-50 p-4 rounded-lg">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Package Price:</span>
                  <span className="font-medium">${packageDetails?.price || 0}</span>
                </div>
                {packageDetails?.price_per_additional && packageDetails?.max_participants && formData.participants > packageDetails.max_participants && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Additional Participants ({formData.participants - packageDetails.max_participants}):</span>
                    <span className="font-medium">${((formData.participants - packageDetails.max_participants) * Number(packageDetails.price_per_additional)).toFixed(2)}</span>
                  </div>
                )}
                {selectedAttractions.length > 0 && (
                  <div className="flex flex-col gap-1">
                    <div className="flex justify-between text-sm font-semibold text-gray-700">
                      <span>Attractions:</span>
                      <span className="font-medium">
                        ${selectedAttractions.reduce((sum, a) => sum + (a.price * a.quantity), 0).toFixed(2)}
                      </span>
                    </div>
                    {selectedAttractions.map((attr, idx) => {
                      const attrTotal = attr.price * attr.quantity;
                      const priceLabel = `x${attr.quantity}`;
                      
                      return (
                        <div key={idx} className="flex justify-between text-xs text-gray-500 ml-4">
                          <span>• {attr.name} ({priceLabel})</span>
                          <span>${attrTotal.toFixed(2)}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
                {selectedAddOns.length > 0 && (
                  <div className="flex flex-col gap-1">
                    <div className="flex justify-between text-sm font-semibold text-gray-700">
                      <span>Add-Ons:</span>
                      <span className="font-medium">
                        ${selectedAddOns.reduce((sum, a) => sum + a.price * a.quantity, 0).toFixed(2)}
                      </span>
                    </div>
                    {selectedAddOns.map((addon, idx) => {
                      const addonTotal = addon.price * addon.quantity;
                      return (
                        <div key={idx} className="flex justify-between text-xs text-gray-500 ml-4">
                          <span>• {addon.name} (x{addon.quantity})</span>
                          <span>${addonTotal.toFixed(2)}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
                <div className="border-t pt-2 flex justify-between font-bold text-lg">
                  <span>Total Amount:</span>
                  <span className={`text-${fullColor}`}>${totalAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm text-green-700 font-medium">
                  <span>Amount Already Paid:</span>
                  <span>${originalAmountPaid.toFixed(2)}</span>
                </div>
                {totalAmount > originalAmountPaid && (
                  <div className="flex justify-between text-sm text-red-700 font-medium">
                    <span>Balance Due:</span>
                    <span>${(totalAmount - originalAmountPaid).toFixed(2)}</span>
                  </div>
                )}
                {totalAmount < originalAmountPaid && (
                  <div className="flex justify-between text-sm text-blue-700 font-medium">
                    <span>Overpaid (Refund):</span>
                    <span>${(originalAmountPaid - totalAmount).toFixed(2)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="p-6 border-b border-gray-100">
            <label htmlFor="notes" className="block text-sm font-medium text-gray-800 mb-2">
              Notes
            </label>
            <textarea
              name="notes"
              id="notes"
              rows={3}
              value={formData.notes}
              onChange={handleInputChange}
              className={`w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-transparent`}
              placeholder="Any special requests or notes..."
            />
          </div>

          {/* Guest of Honor */}
          {packageDetails?.has_guest_of_honor && (
            <div className="p-6 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Guest of Honor</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label htmlFor="guestOfHonorName" className="block text-sm font-medium text-gray-800 mb-2">
                    Name
                  </label>
                  <input
                    type="text"
                    name="guestOfHonorName"
                    id="guestOfHonorName"
                    value={formData.guestOfHonorName}
                    onChange={handleInputChange}
                    className={`w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-transparent`}
                    placeholder="Guest of Honor's Name"
                  />
                </div>
                <div>
                  <label htmlFor="guestOfHonorAge" className="block text-sm font-medium text-gray-800 mb-2">
                    Age
                  </label>
                  <input
                    type="number"
                    name="guestOfHonorAge"
                    id="guestOfHonorAge"
                    value={formData.guestOfHonorAge}
                    onChange={handleInputChange}
                    min="0"
                    className={`w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-transparent`}
                    placeholder="Age"
                  />
                </div>
                <div>
                  <label htmlFor="guestOfHonorGender" className="block text-sm font-medium text-gray-800 mb-2">
                    Gender
                  </label>
                  <select
                    name="guestOfHonorGender"
                    id="guestOfHonorGender"
                    value={formData.guestOfHonorGender}
                    onChange={handleInputChange}
                    className={`w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-transparent`}
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

          {/* Form Actions */}
          <div className="px-6 py-5 bg-gray-50 text-right space-x-3">
            <StandardButton
              variant="secondary"
              size="md"
              onClick={() => navigate('/bookings')}
              disabled={submitting}
            >
              Cancel
            </StandardButton>
            <StandardButton
              variant="primary"
              size="md"
              type="submit"
              disabled={submitting}
              loading={submitting}
            >
              {submitting ? 'Updating...' : 'Update Booking'}
            </StandardButton>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditBooking;
