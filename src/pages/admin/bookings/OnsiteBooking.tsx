// src/pages/onsite-booking/OnsiteBooking.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Clock, Users, CreditCard, Gift, Tag, Plus, Minus } from 'lucide-react';
import { useThemeColor } from '../../../hooks/useThemeColor';
import type { 
  OnsiteBookingRoom, 
  OnsiteBookingPackage, 
  OnsiteBookingAttraction, 
  OnsiteBookingData 
} from '../../../types/onsiteBooking.types';

interface BookingData extends Omit<OnsiteBookingData, 'customer'> {
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
  const { themeColor, fullColor } = useThemeColor();
  const [packages, setPackages] = useState<OnsiteBookingPackage[]>([]);
  const [attractions, setAttractions] = useState<OnsiteBookingAttraction[]>([]);
  const [selectedPackage, setSelectedPackage] = useState<OnsiteBookingPackage | null>(null);
  const [availableDates, setAvailableDates] = useState<Date[]>([]);
  const [availableTimes, setAvailableTimes] = useState<string[]>([]);
  const [step, setStep] = useState(1);
  const [selectedRoom, setSelectedRoom] = useState<string>("");
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

  // Load packages and attractions
  useEffect(() => {
    // Load packages (sample or from localStorage)
    const samplePackages: OnsiteBookingPackage[] = [
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
          { name: 'Soda', price: 50, image: '/soda.png' },
          { name: 'Pizza', price: 350, image: '/pizza.png' }
        ],
        rooms: [
          { name: 'Party Room A', capacity: 30 },
          { name: 'Party Room B', capacity: 40 },
          { name: 'VIP Lounge', capacity: 20 }
        ],
        image: '/zapzone.png',
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
        ],
        duration: '2',
        durationUnit: 'hours',
  pricePerAdditional30min: '50',
  pricePerAdditional1hr: '90'
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
          { name: 'Coffee Break', price: 150, image: '/coffee.png' },
          { name: 'Lunch Buffet', price: 750, image: '/lunch.png' }
        ],
        rooms: [
          { name: 'Conference Room 1', capacity: 20 },
          { name: 'Conference Room 2', capacity: 30 }
        ],
        image: '/Zap-Zone.png',
        giftCards: [],
        promos: [],
        duration: '4',
        durationUnit: 'hours',
  pricePerAdditional30min: '75',
  pricePerAdditional1hr: '125'
      }
    ];

    setPackages(samplePackages);

    // Load attractions from localStorage
    const storedAttractions = localStorage.getItem("zapzone_attractions");
    if (storedAttractions) {
      try {
        setAttractions(JSON.parse(storedAttractions));
      } catch {
        setAttractions([]);
      }
    } else {
      setAttractions([]);
    }
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
        // Add add-on with default quantity 1 and price
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
      type: 'package',
      packageName: selectedPackage?.name || null,
      customerName: `${bookingData.customer.firstName} ${bookingData.customer.lastName}`,
      email: bookingData.customer.email,
      phone: bookingData.customer.phone,
      date: bookingData.date,
      time: bookingData.time,
      participants: bookingData.participants,
      status: 'confirmed',
      totalAmount: calculateTotal(),
      amountPaid: calculateTotal(),
      createdAt: new Date().toISOString(),
      paymentMethod: bookingData.paymentMethod,
      attractions: bookingData.selectedAttractions.map(({ id, quantity }) => {
        const attraction = attractions.find(a => a.id === id);
        return { name: attraction?.name || 'Unknown', quantity };
      }),
      addOns: bookingData.selectedAddOns,
      duration: selectedPackage ? formatDuration(selectedPackage) : '2 hours',
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
                ? `border-${themeColor}-600 bg-${themeColor}-50`
                : `border-gray-200 hover:border-${themeColor}-300`
            }`}
            onClick={() => handlePackageSelect(pkg)}
          >
            <h3 className="text-xl font-semibold text-gray-900">{pkg.name}</h3>
            <p className="text-gray-800 mt-2">{pkg.description}</p>
            <div className="mt-4">
              <p className={`text-2xl font-bold text-${fullColor}`}>${pkg.price}</p>
              <p className="text-sm text-gray-600">Max {pkg.maxParticipants} participants</p>
              <p className="text-sm text-gray-600 mt-1">
                <Clock className="inline mr-1 h-4 w-4" />
                Duration: {formatDuration(pkg)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // STEP 2: Date & Time (swapped with add-ons)
  const renderStep2 = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Select Room, Date & Time</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Room Selection */}
        {selectedPackage?.rooms && selectedPackage.rooms.length > 0 && (
          <div className="border border-gray-200 rounded-xl p-5 md:col-span-2">
            <label className="block font-medium mb-3 text-gray-800 text-sm uppercase tracking-wide">Room Selection</label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {selectedPackage.rooms.map((r) => {
                let room: { name: string };
                if (typeof r === "string") {
                  room = { name: r };
                } else {
                  const { name } = r as OnsiteBookingRoom;
                  room = { name };
                }
                return (
                  <label key={room.name} className={`flex items-center gap-3 p-3 bg-${themeColor}-50 rounded-lg cursor-pointer`}>
                    <input
                      type="radio"
                      name="roomSelection"
                      value={room.name}
                      checked={selectedRoom === room.name}
                      onChange={() => setSelectedRoom(room.name)}
                      className={`accent-${fullColor}`}
                    />
                    <span className="font-medium text-gray-800 text-sm">{room.name}</span>
                  </label>
                );
              })}
            </div>
          </div>
        )}
        {/* Date Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-800 mb-2">
            <Calendar className="inline mr-2 h-4 w-4" />
            Select Date
          </label>
          <select
            name="date"
            value={bookingData.date}
            onChange={handleInputChange}
            className={`w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-${themeColor}-400`}
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
        {/* Time Selection as Radio Group */}
        <div>
          <label className="block text-sm font-medium text-gray-800 mb-2">
            <Clock className="inline mr-2 h-4 w-4" />
            Select Time
          </label>
          {selectedPackage?.rooms && selectedPackage.rooms.length > 0 && !selectedRoom ? (
            <div className="text-xs text-gray-400 col-span-2">Select a room first to see available times</div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {availableTimes.length > 0 ? (
                availableTimes.map((time) => (
                  <label key={time} className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition ${bookingData.time === time ? `border-${fullColor} bg-${themeColor}-50` : `border-gray-300 bg-white hover:border-${themeColor}-400`}`}>
                    <input
                      type="radio"
                      name="time"
                      value={time}
                      checked={bookingData.time === time}
                      onChange={handleInputChange}
                      className={`accent-${fullColor}`}
                      disabled={selectedPackage?.rooms && selectedPackage.rooms.length > 0 && !selectedRoom}
                    />
                    <span className="text-sm text-gray-800">{time}</span>
                  </label>
                ))
              ) : (
                <span className="text-xs text-gray-400 col-span-2">No available times</span>
              )}
            </div>
          )}
        </div>
        {/* Participants */}
        <div>
          <label className="block text-sm font-medium text-gray-800 mb-2">
            <Users className="inline mr-2 h-4 w-4" />
            Number of Participants
          </label>
          <input
            type="number"
            name="participants"
            min="1"
            value={bookingData.participants}
            onChange={handleInputChange}
            className={`w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-${themeColor}-400`}
            required
          />
          {selectedPackage && bookingData.participants > selectedPackage.maxParticipants && selectedPackage.pricePerAdditional && (
            <div className={`mt-2 text-xs text-${fullColor} bg-${themeColor}-50 rounded p-2`}>
              Additional participants beyond {selectedPackage.maxParticipants} will be charged <b>${selectedPackage.pricePerAdditional}</b> each.
            </div>
          )}
        </div>
        {/* Duration Display */}
        {selectedPackage && (
          <div>
            <label className="block text-sm font-medium text-gray-800 mb-2">
              <Clock className="inline mr-2 h-4 w-4" />
              Duration
            </label>
            <div className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-gray-50">
              <span className="text-gray-800">{formatDuration(selectedPackage)}</span>
            </div>
          </div>
        )}
      </div>
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
          className={`px-6 py-3 rounded-lg transition-colors ${selectedPackage?.rooms && selectedPackage.rooms.length > 0 && !selectedRoom ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : `bg-${fullColor} text-white hover:bg-${themeColor}-900`}`}
          disabled={selectedPackage?.rooms && selectedPackage.rooms.length > 0 && !selectedRoom}
        >
          Continue to Attractions & Add-ons
        </button>
      </div>
    </div>
  );

  // STEP 3: Attractions & Add-ons (swapped with date & time)
  const renderStep3 = () => (
    <div className="space-y-8">
      <h2 className="text-2xl font-bold text-gray-900">Add Attractions & Add-ons</h2>
      
      {/* Attractions */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Additional Attractions</h3>
        <p className="text-sm text-gray-600 mb-4">Add individual attraction tickets to your package</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {attractions.map(attraction => {
            const isSelected = bookingData.selectedAttractions.some(a => a.id === attraction.id);
            const selectedQty = bookingData.selectedAttractions.find(a => a.id === attraction.id)?.quantity || 0;
            
            return (
              <div
                key={attraction.id}
                className={`border rounded-lg p-4 ${
                  isSelected ? `border-${themeColor}-600 bg-${themeColor}-50` : 'border-gray-200'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-medium text-gray-900">{attraction.name}</h4>
                    <p className="text-sm text-gray-800">{attraction.description}</p>
                    <p className="text-sm text-gray-800 mt-1">
                      ${attraction.price} {attraction.pricingType === 'per_person' ? 'per person' : 'per unit'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleAttractionToggle(attraction.id)}
                    className={`px-3 py-1 rounded text-sm ${
                      isSelected
                        ? 'bg-red-100 text-red-800 hover:bg-red-200'
                        : `bg-${themeColor}-100 text-${fullColor} hover:bg-${themeColor}-200`
                    }`}
                  >
                    {isSelected ? 'Remove' : 'Add'}
                  </button>
                </div>
                
                {isSelected && (
                  <div className="mt-3 flex items-center">
                    <span className="text-sm text-gray-800 mr-3">Quantity:</span>
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
                  className={`border rounded-lg p-4 flex gap-4 ${
                    isSelected ? `border-${themeColor}-600 bg-${themeColor}-50` : 'border-gray-200'
                  }`}
                >
                  {/* Add-on Image */}
                  <div className="w-20 h-20 flex-shrink-0 flex items-center justify-center bg-gray-100 rounded-md border border-gray-200 overflow-hidden">
                    {addOn.image ? (
                      <img src={addOn.image} alt={addOn.name} className="object-cover w-full h-full" />
                    ) : (
                      <span className="text-gray-400 text-xs">No Image</span>
                    )}
                  </div>
                  <div className="flex-1 flex flex-col justify-between">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-medium text-gray-900">{addOn.name}</h4>
                        <p className="text-sm text-gray-800">${addOn.price}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleAddOnToggle(addOn.name)}
                        className={`px-3 py-1 rounded text-sm ${
                          isSelected
                            ? 'bg-red-100 text-red-800 hover:bg-red-200'
                            : `bg-${themeColor}-100 text-${fullColor} hover:bg-${themeColor}-200`
                        }`}
                      >
                        {isSelected ? 'Remove' : 'Add'}
                      </button>
                    </div>
                    {isSelected && (
                      <div className="mt-3 flex items-center">
                        <span className="text-sm text-gray-800 mr-3">Quantity:</span>
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
                </div>
              );
            })}
          </div>
        </div>
      )}
      
      <div className="flex justify-between">
        <button
          type="button"
          onClick={() => setStep(2)}
          className="bg-gray-200 text-gray-800 px-6 py-3 rounded-lg hover:bg-gray-300"
        >
          Back to Date & Time
        </button>
        <button
          type="button"
          onClick={() => setStep(4)}
          className={`px-6 py-3 rounded-lg transition-colors bg-${fullColor} text-white hover:bg-${themeColor}-900`}
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
          <label className="block text-sm font-medium text-gray-800 mb-2">First Name</label>
          <input
            type="text"
            name="customer.firstName"
            value={bookingData.customer.firstName}
            onChange={handleInputChange}
            className={`w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-${themeColor}-400`}
            required
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-800 mb-2">Last Name</label>
          <input
            type="text"
            name="customer.lastName"
            value={bookingData.customer.lastName}
            onChange={handleInputChange}
            className={`w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-${themeColor}-400`}
            required
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-800 mb-2">Email</label>
          <input
            type="email"
            name="customer.email"
            value={bookingData.customer.email}
            onChange={handleInputChange}
            className={`w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-${themeColor}-400`}
            required
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-800 mb-2">Phone Number</label>
          <input
            type="tel"
            name="customer.phone"
            value={bookingData.customer.phone}
            onChange={handleInputChange}
            className={`w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-${themeColor}-400`}
            required
          />
        </div>
      </div>
      
      {/* Gift Card */}
      <div>
        <label className="block text-sm font-medium text-gray-800 mb-2">
          <Gift className="inline mr-2 h-4 w-4" />
          Gift Card Code (Optional)
        </label>
        <input
          type="text"
          name="giftCardCode"
          value={bookingData.giftCardCode}
          onChange={handleInputChange}
          className={`w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-${themeColor}-400`}
          placeholder="Enter gift card code"
        />
      </div>
      
      {/* Promo Code */}
      <div>
        <label className="block text-sm font-medium text-gray-800 mb-2">
          <Tag className="inline mr-2 h-4 w-4" />
          Promo Code (Optional)
        </label>
        <input
          type="text"
          name="promoCode"
          value={bookingData.promoCode}
          onChange={handleInputChange}
          className={`w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-${themeColor}-400`}
          placeholder="Enter promo code"
        />
      </div>
      
      {/* Notes */}
      <div>
        <label className="block text-sm font-medium text-gray-800 mb-2">Additional Notes</label>
        <textarea
          name="notes"
          value={bookingData.notes}
          onChange={handleInputChange}
          rows={3}
          className={`w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-${themeColor}-400`}
          placeholder="Any special requests or notes..."
        />
      </div>
      
      <div className="flex justify-between">
        <button
          type="button"
          onClick={() => setStep(3)}
          className="bg-gray-200 text-gray-800 px-6 py-3 rounded-lg hover:bg-gray-300"
        >
          Back to Attractions & Add-ons
        </button>
        <button
          type="button"
          onClick={() => setStep(5)}
          className={`px-6 py-3 rounded-lg transition-colors bg-${fullColor} text-white hover:bg-${themeColor}-900`}
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
        <div className="space-y-4">
          {/* Package Details */}
          {selectedPackage && (
            <div className="flex gap-4 items-center border-b pb-3 mb-3">
              {selectedPackage.image && (
                <img src={selectedPackage.image} alt={selectedPackage.name} className="w-20 h-20 object-cover rounded-md border" />
              )}
              <div>
                <div className={`font-bold text-lg text-${fullColor}`}>{selectedPackage.name}</div>
                <div className="text-gray-700 text-sm">{selectedPackage.description}</div>
                <div className="text-xs text-gray-500 mt-1">Category: {selectedPackage.category}</div>
              </div>
            </div>
          )}

          {/* Date, Time, Room */}
          <div className="flex flex-col gap-1 border-b pb-3 mb-3">
            <div className="flex justify-between">
              <span>Date & Time:</span>
              <span className="font-medium">
                {new Date(bookingData.date).toLocaleDateString()} at {bookingData.time}
              </span>
            </div>
            {selectedRoom && (
              <div className="flex justify-between">
                <span>Room:</span>
                <span className="font-medium">{selectedRoom}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span>Participants:</span>
              <span className="font-medium">{bookingData.participants}</span>
            </div>
            {selectedPackage && bookingData.participants > selectedPackage.maxParticipants && selectedPackage.pricePerAdditional && (
              <div className={`flex justify-between text-sm text-${fullColor}`}>
                <span>Additional ({bookingData.participants - selectedPackage.maxParticipants} x ${selectedPackage.pricePerAdditional}):</span>
                <span>${(bookingData.participants - selectedPackage.maxParticipants) * selectedPackage.pricePerAdditional}</span>
              </div>
            )}
            {selectedPackage && (
              <div className="flex justify-between">
                <span>Duration:</span>
                <span className="font-medium">{formatDuration(selectedPackage)}</span>
              </div>
            )}
          </div>

          {/* Attractions */}
          {bookingData.selectedAttractions.length > 0 && (
            <div className="border-b pb-3 mb-3">
              <div className={`font-medium mb-1 text-${fullColor}`}>Attractions:</div>
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

          {/* Add-ons */}
          {bookingData.selectedAddOns.length > 0 && (
            <div className="border-b pb-3 mb-3">
              <div className={`font-medium mb-1 text-${fullColor}`}>Add-ons:</div>
              {bookingData.selectedAddOns.map(({ name, quantity }) => {
                const addOn = selectedPackage?.addOns.find(a => a.name === name);
                return (
                  <div key={name} className="flex items-center justify-between text-sm ml-2 gap-2">
                    <div className="flex items-center gap-2">
                      {addOn?.image && (
                        <img src={addOn.image} alt={addOn.name} className="w-8 h-8 object-cover rounded border" />
                      )}
                      <span>{name} (x{quantity})</span>
                    </div>
                    <span>${addOn ? addOn.price * quantity : 0}</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Customer Info */}
          <div className="border-b pb-3 mb-3">
            <div className={`font-medium mb-1 text-${fullColor}`}>Customer Info:</div>
            <div className="flex flex-col gap-1 ml-2 text-sm">
              <div><span className="font-medium">Name:</span> {bookingData.customer.firstName} {bookingData.customer.lastName}</div>
              <div><span className="font-medium">Email:</span> {bookingData.customer.email}</div>
              <div><span className="font-medium">Phone:</span> {bookingData.customer.phone}</div>
              {bookingData.notes && <div><span className="font-medium">Notes:</span> {bookingData.notes}</div>}
            </div>
          </div>

          {/* Total */}
          <div className="pt-3">
            <div className="flex justify-between text-lg font-bold">
              <span>Total:</span>
              <span>${calculateTotal().toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-800 mb-2">
          <CreditCard className="inline mr-2 h-4 w-4" />
          Payment Method
        </label>
        <select
          name="paymentMethod"
          value={bookingData.paymentMethod}
          onChange={handleInputChange}
          className={`w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-${themeColor}-400`}
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
          className={`px-6 py-3 rounded-lg transition-colors ${!isBookingValid() ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-green-800 text-white hover:bg-green-800'}`}
          disabled={!isBookingValid()}
        >
          Confirm Booking
        </button>
      </div>
    </div>
  );

  return (
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
  );
};

export default OnsiteBooking;