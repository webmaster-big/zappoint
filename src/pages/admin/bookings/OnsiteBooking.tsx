// src/pages/onsite-booking/OnsiteBooking.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {  Calendar, Clock, Users, CreditCard, Gift, Tag, Plus, Minus } from 'lucide-react';
import MainLayout from '../../../layouts/AdminMainLayout';

// Types
interface Package {
  id: string;
  name: string;
  description: string;
  price: number;
  pricePerAdditional?: number;
  maxParticipants: number;
  category: string;
  features: string;
  availabilityType: string;
  availableDays: string[];
  availableWeekDays: string[];
  availableMonthDays: string[];
  attractions: string[];
  addOns: { name: string; price: number }[];
  giftCards: GiftCard[];
  promos: Promo[];
}

interface GiftCard {
  code: string;
  type: 'fixed' | 'percentage';
  value: number;
  initial_value: number;
  remaining_usage: number;
  max_usage: number;
  status: string;
  expiry_date: string;
  description: string;
}

interface Promo {
  code: string;
  type: 'fixed' | 'percentage';
  value: number;
  status: string;
  start_date: string;
  end_date: string;
  usage_limit_per_user: number;
  usage_limit_total: number;
  description: string;
}

interface Attraction {
  id: string;
  name: string;
  description: string;
  price: number;
  pricingType: 'per_person' | 'per_unit' | 'fixed' | 'per_lane';
  maxCapacity: number;
  category: string;
}

interface BookingData {
  packageId: string | null;
  selectedAttractions: { id: string; quantity: number }[];
  selectedAddOns: { name: string; quantity: number }[];
  date: string;
  time: string;
  participants: number;
  customer: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
  };
  paymentMethod: 'credit' | 'debit' | 'cash' | 'e-wallet';
  giftCardCode: string;
  promoCode: string;
  notes: string;
}

const TIME_SLOTS = [
  '9:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', 
  '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', 
  '5:00 PM', '6:00 PM', '7:00 PM', '8:00 PM'
];

const OnsiteBooking: React.FC = () => {
  const navigate = useNavigate();
  const [packages, setPackages] = useState<Package[]>([]);
  const [attractions, setAttractions] = useState<Attraction[]>([]);
  const [selectedPackage, setSelectedPackage] = useState<Package | null>(null);
  const [availableDates, setAvailableDates] = useState<Date[]>([]);
  const [availableTimes, setAvailableTimes] = useState<string[]>([]);
  const [step, setStep] = useState(1);
  const [bookingData, setBookingData] = useState<BookingData>({
    packageId: null,
    selectedAttractions: [],
    selectedAddOns: [],
    date: '',
    time: '',
    participants: 1,
    customer: {
      firstName: '',
      lastName: '',
      email: '',
      phone: ''
    },
    paymentMethod: 'cash',
    giftCardCode: '',
    promoCode: '',
    notes: ''
  });

  // Load packages and attractions
  useEffect(() => {
    // In a real app, this would be an API call
    const samplePackages: Package[] = [
      {
        id: 'pkg_1757977625822_92891',
        name: 'Family Fun Package',
        description: 'Perfect for family gatherings and fun activities',
        price: 306,
        maxParticipants: 68,
        category: 'Arcade Party',
        features: 'Et sint sint cum ma',
        availabilityType: 'monthly',
        availableDays: [],
        availableWeekDays: [],
        availableMonthDays: ['15', '16', '17', '18', '19', '20', '21', '22', '23', '24', '25', '26', '27', '28'],
        attractions: ['Laser Tag', 'Arcade Games', 'Bowling'],
        addOns: [
          { name: 'Soda', price: 50 },
          { name: 'Pizza', price: 350 }
        ],
        giftCards: [
          {
            code: 'GC-PTM5JG-7060',
            type: 'percentage',
            value: 10,
            initial_value: 69,
            remaining_usage: 10,
            max_usage: 10,
            status: 'active',
            expiry_date: '2025-09-16T00:00:00.000Z',
            description: '10% off on Family Fun Package'
          }
        ],
        promos: [
          {
            code: 'FAMILY25',
            type: 'percentage',
            value: 25,
            status: 'active',
            start_date: '2025-01-01T00:00:00.000Z',
            end_date: '2025-12-31T00:00:00.000Z',
            usage_limit_per_user: 1,
            usage_limit_total: 100,
            description: '25% off for family bookings'
          }
        ]
      },
      {
        id: 'pkg_1757977625822_92892',
        name: 'Corporate Team Building',
        description: 'Great for corporate events and team activities',
        price: 599,
        maxParticipants: 30,
        category: 'Corporate',
        features: 'Team building activities and meeting space',
        availabilityType: 'weekly',
        availableDays: [],
        availableWeekDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        availableMonthDays: [],
        attractions: ['Axe Throwing', 'Escape Room', 'Conference Room'],
        addOns: [
          { name: 'Coffee Break', price: 150 },
          { name: 'Lunch Buffet', price: 750 }
        ],
        giftCards: [],
        promos: []
      }
    ];

    const sampleAttractions: Attraction[] = [
      {
        id: 'attr_1',
        name: 'Laser Tag',
        description: 'Exciting laser tag arena for all ages',
        price: 250,
        pricingType: 'per_person',
        maxCapacity: 20,
        category: 'Adventure'
      },
      {
        id: 'attr_2',
        name: 'Bowling',
        description: 'Standard bowling lanes',
        price: 200,
        pricingType: 'per_lane',
        maxCapacity: 6,
        category: 'Sports'
      },
      {
        id: 'attr_3',
        name: 'Arcade Games',
        description: 'Unlimited arcade games',
        price: 150,
        pricingType: 'per_person',
        maxCapacity: 50,
        category: 'Arcade'
      }
    ];

    setPackages(samplePackages);
    setAttractions(sampleAttractions);
  }, []);

  // Calculate available dates based on package availability
  useEffect(() => {
    if (!selectedPackage) return;
    
    const today = new Date();
    const dates: Date[] = [];
    
    // Generate available dates for the next 60 days
    for (let i = 0; i < 60; i++) {
      const date = new Date();
      date.setDate(today.getDate() + i);
      
      // Check if date matches package availability
      let isAvailable = false;
      
      if (selectedPackage.availabilityType === "daily") {
        const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
        isAvailable = selectedPackage.availableDays.includes(dayName);
      } 
      else if (selectedPackage.availabilityType === "weekly") {
        const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
        isAvailable = selectedPackage.availableWeekDays.includes(dayName);
      } 
      else if (selectedPackage.availabilityType === "monthly") {
        const dayOfMonth = date.getDate();
        const isLastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate() === dayOfMonth;
        
        isAvailable = selectedPackage.availableMonthDays.includes(dayOfMonth.toString()) || 
                     (isLastDay && selectedPackage.availableMonthDays.includes("last"));
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
    }
  }, [selectedPackage, bookingData.date]);

  // Set available times when date is selected
  useEffect(() => {
    if (bookingData.date) {
      // For demo purposes, all time slots are available
      // In a real app, you might check against existing bookings
      setAvailableTimes(TIME_SLOTS);
      
      // Set default selected time to first available time
      if (TIME_SLOTS.length > 0 && !bookingData.time) {
        setBookingData(prev => ({ ...prev, time: TIME_SLOTS[0] }));
      }
    }
  }, [bookingData.date, bookingData.time]);

  const handlePackageSelect = (pkg: Package) => {
    setSelectedPackage(pkg);
    setBookingData(prev => ({ 
      ...prev, 
      packageId: pkg.id,
      selectedAttractions: [],
      selectedAddOns: []
    }));
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
        // Add add-on with default quantity 1
        return {
          ...prev,
          selectedAddOns: [...prev.selectedAddOns, { name: addOnName, quantity: 1 }]
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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
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
    } else {
      setBookingData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const calculateTotal = () => {
    let total = 0;
    
    // Package price
    if (selectedPackage) {
      total += selectedPackage.price;
      
      // Additional participants cost if applicable
      if (selectedPackage.pricePerAdditional && bookingData.participants > 1) {
        total += (bookingData.participants - 1) * selectedPackage.pricePerAdditional;
      }
    }
    
    // Attractions
    bookingData.selectedAttractions.forEach(({ id, quantity }) => {
      const attraction = attractions.find(a => a.id === id);
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Create the booking object
    const booking = {
      id: `booking_${Date.now()}`,
      packageName: selectedPackage?.name || 'Custom Booking',
      customerName: `${bookingData.customer.firstName} ${bookingData.customer.lastName}`,
      email: bookingData.customer.email,
      phone: bookingData.customer.phone,
      date: bookingData.date,
      time: bookingData.time,
      participants: bookingData.participants,
      status: 'confirmed' as const,
      totalAmount: calculateTotal(),
      amountPaid: calculateTotal(),
      createdAt: new Date().toISOString(),
      paymentMethod: bookingData.paymentMethod,
      attractions: bookingData.selectedAttractions.map(({ id, quantity }) => {
        const attraction = attractions.find(a => a.id === id);
        return { name: attraction?.name || 'Unknown', quantity };
      }),
      addOns: bookingData.selectedAddOns,
      duration: '2 hours', // Default duration, could be dynamic
      activity: selectedPackage?.category,
      notes: bookingData.notes
    };
    
    // Save to localStorage (in a real app, this would be an API call)
    const existingBookings = JSON.parse(localStorage.getItem('zapzone_bookings') || '[]');
    const updatedBookings = [...existingBookings, booking];
    localStorage.setItem('zapzone_bookings', JSON.stringify(updatedBookings));
    
    // Navigate to success page or bookings list
    navigate('/admin/bookings', { state: { message: 'Booking created successfully!' } });
  };

  const renderStep1 = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Select a Package</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {packages.map(pkg => (
          <div
            key={pkg.id}
            className={`border rounded-lg p-6 cursor-pointer transition-all ${
              selectedPackage?.id === pkg.id
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-blue-300'
            }`}
            onClick={() => handlePackageSelect(pkg)}
          >
            <h3 className="text-xl font-semibold text-gray-900">{pkg.name}</h3>
            <p className="text-gray-600 mt-2">{pkg.description}</p>
            <div className="mt-4">
              <p className="text-2xl font-bold text-blue-600">${pkg.price}</p>
              <p className="text-sm text-gray-500">Max {pkg.maxParticipants} participants</p>
            </div>
          </div>
        ))}
      </div>
      
      {selectedPackage && (
        <div className="mt-8">
          <button
            type="button"
            onClick={() => setStep(2)}
            className="w-full md:w-auto bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700"
          >
            Continue to Attractions & Add-ons
          </button>
        </div>
      )}
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-8">
      <h2 className="text-2xl font-bold text-gray-900">Add Attractions & Add-ons</h2>
      
      {/* Attractions */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Additional Attractions</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {attractions.map(attraction => {
            const isSelected = bookingData.selectedAttractions.some(a => a.id === attraction.id);
            const selectedQty = bookingData.selectedAttractions.find(a => a.id === attraction.id)?.quantity || 0;
            
            return (
              <div
                key={attraction.id}
                className={`border rounded-lg p-4 ${
                  isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-medium text-gray-900">{attraction.name}</h4>
                    <p className="text-sm text-gray-600">{attraction.description}</p>
                    <p className="text-sm text-gray-600 mt-1">
                      ${attraction.price} {attraction.pricingType === 'per_person' ? 'per person' : 'per unit'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleAttractionToggle(attraction.id)}
                    className={`px-3 py-1 rounded text-sm ${
                      isSelected
                        ? 'bg-red-100 text-red-700 hover:bg-red-200'
                        : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                    }`}
                  >
                    {isSelected ? 'Remove' : 'Add'}
                  </button>
                </div>
                
                {isSelected && (
                  <div className="mt-3 flex items-center">
                    <span className="text-sm text-gray-700 mr-3">Quantity:</span>
                    <div className="flex items-center">
                      <button
                        type="button"
                        onClick={() => handleAttractionQuantityChange(attraction.id, selectedQty - 1)}
                        className="p-1 rounded bg-gray-200"
                      >
                        <Minus size={14} />
                      </button>
                      <span className="mx-2 w-8 text-center">{selectedQty}</span>
                      <button
                        type="button"
                        onClick={() => handleAttractionQuantityChange(attraction.id, selectedQty + 1)}
                        className="p-1 rounded bg-gray-200"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      
      {/* Add-ons */}
      {selectedPackage?.addOns && selectedPackage.addOns.length > 0 && (
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-4">Package Add-ons</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {selectedPackage.addOns.map(addOn => {
              const isSelected = bookingData.selectedAddOns.some(a => a.name === addOn.name);
              const selectedQty = bookingData.selectedAddOns.find(a => a.name === addOn.name)?.quantity || 0;
              
              return (
                <div
                  key={addOn.name}
                  className={`border rounded-lg p-4 ${
                    isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-medium text-gray-900">{addOn.name}</h4>
                      <p className="text-sm text-gray-600">${addOn.price}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAddOnToggle(addOn.name, addOn.price)}
                      className={`px-3 py-1 rounded text-sm ${
                        isSelected
                          ? 'bg-red-100 text-red-700 hover:bg-red-200'
                          : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                      }`}
                    >
                      {isSelected ? 'Remove' : 'Add'}
                    </button>
                  </div>
                  
                  {isSelected && (
                    <div className="mt-3 flex items-center">
                      <span className="text-sm text-gray-700 mr-3">Quantity:</span>
                      <div className="flex items-center">
                        <button
                          type="button"
                          onClick={() => handleAddOnQuantityChange(addOn.name, selectedQty - 1)}
                          className="p-1 rounded bg-gray-200"
                        >
                          <Minus size={14} />
                        </button>
                        <span className="mx-2 w-8 text-center">{selectedQty}</span>
                        <button
                          type="button"
                          onClick={() => handleAddOnQuantityChange(addOn.name, selectedQty + 1)}
                          className="p-1 rounded bg-gray-200"
                        >
                          <Plus size={14} />
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
      
      <div className="flex justify-between">
        <button
          type="button"
          onClick={() => setStep(1)}
          className="bg-gray-200 text-gray-800 px-6 py-3 rounded-lg hover:bg-gray-300"
        >
          Back to Packages
        </button>
        <button
          type="button"
          onClick={() => setStep(3)}
          className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700"
        >
          Continue to Date & Time
        </button>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Select Date & Time</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Date Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <Calendar className="inline mr-2 h-4 w-4" />
            Select Date
          </label>
          <select
            name="date"
            value={bookingData.date}
            onChange={handleInputChange}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-400"
            required
          >
            <option value="">Select a date</option>
            {availableDates.map(date => (
              <option key={date.toISOString()} value={date.toISOString().split('T')[0]}>
                {date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
              </option>
            ))}
          </select>
        </div>
        
        {/* Time Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <Clock className="inline mr-2 h-4 w-4" />
            Select Time
          </label>
          <select
            name="time"
            value={bookingData.time}
            onChange={handleInputChange}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-400"
            required
          >
            <option value="">Select a time</option>
            {availableTimes.map(time => (
              <option key={time} value={time}>{time}</option>
            ))}
          </select>
        </div>
        
        {/* Participants */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <Users className="inline mr-2 h-4 w-4" />
            Number of Participants
          </label>
          <input
            type="number"
            name="participants"
            min="1"
            max={selectedPackage?.maxParticipants || 50}
            value={bookingData.participants}
            onChange={handleInputChange}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-400"
            required
          />
        </div>
      </div>
      
      <div className="flex justify-between">
        <button
          type="button"
          onClick={() => setStep(2)}
          className="bg-gray-200 text-gray-800 px-6 py-3 rounded-lg hover:bg-gray-300"
        >
          Back to Attractions
        </button>
        <button
          type="button"
          onClick={() => setStep(4)}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700"
          >
            Continue to Customer Details
          </button>
        </div>
      </div>
    );

    const renderStep4 = () => (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900">Customer Information</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">First Name</label>
            <input
              type="text"
              name="customer.firstName"
              value={bookingData.customer.firstName}
              onChange={handleInputChange}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-400"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Last Name</label>
            <input
              type="text"
              name="customer.lastName"
              value={bookingData.customer.lastName}
              onChange={handleInputChange}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-400"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
            <input
              type="email"
              name="customer.email"
              value={bookingData.customer.email}
              onChange={handleInputChange}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-400"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number</label>
            <input
              type="tel"
              name="customer.phone"
              value={bookingData.customer.phone}
              onChange={handleInputChange}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-400"
              required
            />
          </div>
        </div>
        
        {/* Gift Card */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <Gift className="inline mr-2 h-4 w-4" />
            Gift Card Code (Optional)
          </label>
          <input
            type="text"
            name="giftCardCode"
            value={bookingData.giftCardCode}
            onChange={handleInputChange}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-400"
            placeholder="Enter gift card code"
          />
        </div>
        
        {/* Promo Code */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <Tag className="inline mr-2 h-4 w-4" />
            Promo Code (Optional)
          </label>
          <input
            type="text"
            name="promoCode"
            value={bookingData.promoCode}
            onChange={handleInputChange}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-400"
            placeholder="Enter promo code"
          />
        </div>
        
        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Additional Notes</label>
          <textarea
            name="notes"
            value={bookingData.notes}
            onChange={handleInputChange}
            rows={3}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-400"
            placeholder="Any special requests or notes..."
          />
        </div>
        
        <div className="flex justify-between">
          <button
            type="button"
            onClick={() => setStep(3)}
            className="bg-gray-200 text-gray-800 px-6 py-3 rounded-lg hover:bg-gray-300"
          >
            Back to Date & Time
          </button>
          <button
            type="button"
            onClick={() => setStep(5)}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700"
          >
            Continue to Payment
          </button>
        </div>
      </div>
    );

    const renderStep5 = () => (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900">Payment Details</h2>
        
        <div className="bg-gray-50 p-6 rounded-lg">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Booking Summary</h3>
          
          <div className="space-y-3">
            <div className="flex justify-between">
              <span>Package:</span>
              <span className="font-medium">{selectedPackage?.name}</span>
            </div>
            
            <div className="flex justify-between">
              <span>Date & Time:</span>
              <span className="font-medium">
                {new Date(bookingData.date).toLocaleDateString()} at {bookingData.time}
              </span>
            </div>
            
            <div className="flex justify-between">
              <span>Participants:</span>
              <span className="font-medium">{bookingData.participants}</span>
            </div>
            
            {bookingData.selectedAttractions.length > 0 && (
              <div>
                <div className="font-medium mb-1">Attractions:</div>
                {bookingData.selectedAttractions.map(({ id, quantity }) => {
                  const attraction = attractions.find(a => a.id === id);
                  return (
                    <div key={id} className="flex justify-between text-sm ml-2">
                      <span>{attraction?.name} (x{quantity})</span>
                      <span>
                        ${attraction ? attraction.price * quantity * (attraction.pricingType === 'per_person' ? bookingData.participants : 1) : 0}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
            
            {bookingData.selectedAddOns.length > 0 && (
              <div>
                <div className="font-medium mb-1">Add-ons:</div>
                {bookingData.selectedAddOns.map(({ name, quantity }) => {
                  const addOn = selectedPackage?.addOns.find(a => a.name === name);
                  return (
                    <div key={name} className="flex justify-between text-sm ml-2">
                      <span>{name} (x{quantity})</span>
                      <span>${addOn ? addOn.price * quantity : 0}</span>
                    </div>
                  );
                })}
              </div>
            )}
            
            <div className="border-t pt-3 mt-3">
              <div className="flex justify-between text-lg font-bold">
                <span>Total:</span>
                <span>${calculateTotal().toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <CreditCard className="inline mr-2 h-4 w-4" />
            Payment Method
          </label>
          <select
            name="paymentMethod"
            value={bookingData.paymentMethod}
            onChange={handleInputChange}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-400"
            required
          >
            <option value="cash">Cash</option>
            <option value="credit">Credit Card</option>
            <option value="debit">Debit Card</option>
            <option value="e-wallet">E-Wallet</option>
          </select>
        </div>
        
        <div className="flex justify-between">
          <button
            type="button"
            onClick={() => setStep(4)}
            className="bg-gray-200 text-gray-800 px-6 py-3 rounded-lg hover:bg-gray-300"
          >
            Back to Customer Details
          </button>
          <button
            type="submit"
            className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700"
          >
            Confirm Booking
          </button>
        </div>
      </div>
    );

    return (
      <MainLayout>
        <div className=" py-8">
          {/* Header */}
          <div className="flex items-center mb-8 px-1">
            
            <h1 className="text-3xl font-bold text-gray-900 ml-4">On-site Booking</h1>
          </div>
          
          {/* Progress Steps */}
          <div className="mb-8 px-4">
            <div className="flex justify-between mb-2">
              {[1, 2, 3, 4, 5].map(stepNum => (
                <div
                  key={stepNum}
                  className={`flex-1 h-2 mx-1 rounded-full ${
                    step >= stepNum ? 'bg-blue-600' : 'bg-gray-300'
                  }`}
                />
              ))}
            </div>
            <div className="flex justify-between text-xs text-gray-600">
              <span>Package</span>
              <span>Add-ons</span>
              <span>Date & Time</span>
              <span>Customer</span>
              <span>Payment</span>
            </div>
          </div>
          
          {/* Form */}
          <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm p-6">
            {step === 1 && renderStep1()}
            {step === 2 && renderStep2()}
            {step === 3 && renderStep3()}
            {step === 4 && renderStep4()}
            {step === 5 && renderStep5()}
          </form>
        </div>
      </MainLayout>
    );
  };

  export default OnsiteBooking;