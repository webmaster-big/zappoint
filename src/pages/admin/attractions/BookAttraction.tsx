import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Clock, 
  Users, 
  MapPin, 
  Calendar, 
  CheckCircle,
  Star,
  Shield,
  Zap,
  CreditCard,
  Wallet
} from 'lucide-react';

// Define interfaces for our data structures
interface Attraction {
  id: string;
  name: string;
  description: string;
  location: string;
  duration: number;
  durationUnit: string;
  maxCapacity: number;
  price: number;
  pricingType: 'per_person' | 'fixed' | 'group';
  availability: Record<string, boolean>;
  timeSlots: string[];
  images: string[];
}

interface CustomerInfo {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}

const BookingAttraction = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [attraction, setAttraction] = useState<Attraction | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [participants, setParticipants] = useState(1);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo>({
    firstName: '',
    lastName: '',
    email: '',
    phone: ''
  });
  const [paymentMethod, setPaymentMethod] = useState('credit_card');
  const [currentStep, setCurrentStep] = useState(1);
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [availableTimes, setAvailableTimes] = useState<string[]>([]);

  // Load attraction data
  useEffect(() => {
    const loadAttraction = () => {
      try {
        const attractions = JSON.parse(localStorage.getItem('zapzone_attractions') || '[]');
        const foundAttraction = attractions.find((a: Attraction) => a.id === id);
        
        if (foundAttraction) {
          setAttraction(foundAttraction);
          
          // Generate available dates (next 30 days)
          const dates: string[] = [];
          const today = new Date();
          for (let i = 0; i < 30; i++) {
            const date = new Date();
            date.setDate(today.getDate() + i);
            
            // Check if the attraction is available on this day
            const dayName = date.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
            if (foundAttraction.availability[dayName]) {
              dates.push(date.toISOString().split('T')[0]);
            }
          }
          setAvailableDates(dates);
          
          // Set default selected date to first available date
          if (dates.length > 0 && !selectedDate) {
            setSelectedDate(dates[0]);
          }
        } else {
          navigate('/attractions');
        }
      } catch (error) {
        console.error('Error loading attraction:', error);
      } finally {
        setLoading(false);
      }
    };

    loadAttraction();
  }, [id, navigate, selectedDate]);

  // Update available times when date changes
  useEffect(() => {
    if (attraction && selectedDate) {
      // Filter times based on selected date's day of week
      const dateObj = new Date(selectedDate);
      const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
      
      if (attraction.availability[dayName]) {
        setAvailableTimes(attraction.timeSlots || []);
        
        // Set default selected time to first available time
        if (attraction.timeSlots.length > 0 && !selectedTime) {
          setSelectedTime(attraction.timeSlots[0]);
        }
      } else {
        setAvailableTimes([]);
        setSelectedTime('');
      }
    }
  }, [selectedDate, attraction, selectedTime]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setCustomerInfo(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const calculateTotal = () => {
    if (!attraction) return 0;
    
    let total = parseFloat(attraction.price.toString());
    
    // Apply pricing logic based on pricing type
    if (attraction.pricingType === 'per_person') {
      total = total * participants;
    }
    
    return total;
  };

  const handleBooking = () => {
    if (!attraction) return;

    // Create booking object with the correct structure
    const booking = {
      id: `booking_${Date.now()}`,
      type: 'attraction' as const,
      attractionName: attraction.name,
      customerName: `${customerInfo.firstName} ${customerInfo.lastName}`,
      email: customerInfo.email,
      phone: customerInfo.phone,
      date: selectedDate,
      time: selectedTime,
      participants: participants,
      status: 'confirmed' as const,
      totalAmount: calculateTotal(),
      createdAt: new Date().toISOString(),
      paymentMethod: paymentMethod,
      duration: `${attraction.duration} ${attraction.durationUnit}`,
      activity: attraction.name
    };
    
    // Save to localStorage
    const existingBookings = JSON.parse(localStorage.getItem('zapzone_bookings') || '[]');
    localStorage.setItem('zapzone_bookings', JSON.stringify([...existingBookings, booking]));
    
    setCurrentStep(5); // Move to confirmation step

    // Show confirmation dialog
    setTimeout(() => {
      window.alert("Booking confirmed!\nYour booking for " + attraction.name + " is complete.");
    }, 300); // slight delay to allow UI update
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!attraction) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900">Attraction not found</h2>
          <button 
            onClick={() => navigate('/attractions')}
            className="mt-4 text-blue-600 hover:text-blue-800"
          >
            Back to Attractions
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
    
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Booking Form */}
          <div className="lg:col-span-2">
            <div className="bg-white shadow-sm rounded-lg overflow-hidden">
              {/* Progress Steps */}
              <div className="border-b border-gray-200">
                <div className="px-6 py-4">
                  <div className="flex items-center justify-between mb-2">
                    {[1, 2, 3, 4, 5].map(step => (
                      <div key={step} className="flex items-center">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          currentStep >= step 
                            ? 'bg-blue-600 text-white' 
                            : 'bg-gray-200 text-gray-500'
                        }`}>
                          {step}
                        </div>
                        {step < 5 && (
                          <div className={`w-16 h-1 mx-2 ${currentStep > step ? 'bg-blue-600' : 'bg-gray-200'}`}></div>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Date & Time</span>
                    <span>Participants</span>
                    <span>Your Info</span>
                    <span>Payment</span>
                    <span>Confirmation</span>
                  </div>
                </div>
              </div>

              {/* Step 1: Date & Time Selection */}
              {currentStep === 1 && (
                <div className="p-6">
                  <h2 className="text-xl font-semibold text-gray-900 mb-6">Select Date & Time</h2>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        <Calendar className="inline h-5 w-5 mr-1 text-blue-600" />
                        Select Date
                      </label>
                      <select
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        required
                      >
                        {availableDates.map(date => (
                          <option key={date} value={date}>
                            {new Date(date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                          </option>
                        ))}
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        <Clock className="inline h-5 w-5 mr-1 text-blue-600" />
                        Select Time
                      </label>
                      <select
                        value={selectedTime}
                        onChange={(e) => setSelectedTime(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        required
                        disabled={availableTimes.length === 0}
                      >
                        {availableTimes.length === 0 ? (
                          <option>No available times</option>
                        ) : (
                          availableTimes.map(time => (
                            <option key={time} value={time}>{time}</option>
                          ))
                        )}
                      </select>
                    </div>
                  </div>
                  
                  <div className="flex justify-end">
                    <button
                      onClick={() => setCurrentStep(2)}
                      disabled={!selectedDate || !selectedTime}
                      className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Continue
                    </button>
                  </div>
                </div>
              )}

              {/* Step 2: Participants */}
              {currentStep === 2 && (
                <div className="p-6">
                  <h2 className="text-xl font-semibold text-gray-900 mb-6">Number of Participants</h2>
                  
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-4">
                      <Users className="inline h-5 w-5 mr-1 text-blue-600" />
                      How many people?
                    </label>
                    <div className="flex items-center justify-center space-x-4">
                      <button
                        onClick={() => setParticipants(Math.max(1, participants - 1))}
                        className="w-12 h-12 rounded-full bg-gray-100 text-gray-700 flex items-center justify-center text-xl hover:bg-gray-200"
                      >
                        -
                      </button>
                      <span className="text-2xl font-bold w-12 text-center">{participants}</span>
                      <button
                        onClick={() => setParticipants(Math.min(attraction.maxCapacity, participants + 1))}
                        className="w-12 h-12 rounded-full bg-gray-100 text-gray-700 flex items-center justify-center text-xl hover:bg-gray-200"
                      >
                        +
                      </button>
                    </div>
                    <p className="text-center text-sm text-gray-500 mt-2">
                      Maximum: {attraction.maxCapacity} participants
                    </p>
                  </div>
                  
                  <div className="flex justify-between">
                    <button
                      onClick={() => setCurrentStep(1)}
                      className="bg-gray-200 text-gray-800 px-6 py-2 rounded-lg hover:bg-gray-300"
                    >
                      Back
                    </button>
                    <button
                      onClick={() => setCurrentStep(3)}
                      className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
                    >
                      Continue
                    </button>
                  </div>
                </div>
              )}

              {/* Step 3: Customer Information */}
              {currentStep === 3 && (
                <div className="p-6">
                  <h2 className="text-xl font-semibold text-gray-900 mb-6">Your Information</h2>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        First Name *
                      </label>
                      <input
                        type="text"
                        name="firstName"
                        value={customerInfo.firstName}
                        onChange={handleInputChange}
                        className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        required
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Last Name *
                      </label>
                      <input
                        type="text"
                        name="lastName"
                        value={customerInfo.lastName}
                        onChange={handleInputChange}
                        className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        required
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Email Address *
                      </label>
                      <input
                        type="email"
                        name="email"
                        value={customerInfo.email}
                        onChange={handleInputChange}
                        className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        required
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Phone Number
                      </label>
                      <input
                        type="tel"
                        name="phone"
                        value={customerInfo.phone}
                        onChange={handleInputChange}
                        className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>
                  
                  <div className="flex justify-between">
                    <button
                      onClick={() => setCurrentStep(2)}
                      className="bg-gray-200 text-gray-800 px-6 py-2 rounded-lg hover:bg-gray-300"
                    >
                      Back
                    </button>
                    <button
                      onClick={() => setCurrentStep(4)}
                      disabled={!customerInfo.firstName || !customerInfo.lastName || !customerInfo.email}
                      className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Continue to Payment
                    </button>
                  </div>
                </div>
              )}

              {/* Step 4: Payment Method */}
              {currentStep === 4 && (
                <div className="p-6">
                  <h2 className="text-xl font-semibold text-gray-900 mb-6">Payment Method</h2>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <div 
                      className={`border-2 rounded-lg p-4 cursor-pointer ${
                        paymentMethod === 'credit_card' 
                          ? 'border-blue-600 bg-blue-50' 
                          : 'border-gray-300 hover:border-gray-400'
                      }`}
                      onClick={() => setPaymentMethod('credit_card')}
                    >
                      <div className="flex items-center">
                        <CreditCard className="h-6 w-6 mr-2 text-gray-600" />
                        <span className="font-medium">Credit/Debit Card</span>
                      </div>
                      <p className="text-sm text-gray-500 mt-1">Pay securely with your card</p>
                    </div>
                    
                    <div 
                      className={`border-2 rounded-lg p-4 cursor-pointer ${
                        paymentMethod === 'paypal' 
                          ? 'border-blue-600 bg-blue-50' 
                          : 'border-gray-300 hover:border-gray-400'
                      }`}
                      onClick={() => setPaymentMethod('paypal')}
                    >
                      <div className="flex items-center">
                        <Wallet className="h-6 w-6 mr-2 text-blue-600" />
                        <span className="font-medium">PayPal</span>
                      </div>
                      <p className="text-sm text-gray-500 mt-1">Pay with your PayPal account</p>
                    </div>
                  
                  </div>
                  
                  <div className="flex justify-between">
                    <button
                      onClick={() => setCurrentStep(3)}
                      className="bg-gray-200 text-gray-800 px-6 py-2 rounded-lg hover:bg-gray-300"
                    >
                      Back
                    </button>
                    <button
                      onClick={handleBooking}
                      className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
                    >
                      Complete Booking
                    </button>
                  </div>
                </div>
              )}

              {/* Step 5: Confirmation */}
              {currentStep === 5 && (
                <div className="p-6 text-center">
                  <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">Booking Confirmed!</h2>
                  <p className="text-gray-600 mb-6">
                    Your booking for {attraction.name} has been confirmed. A confirmation email has been sent to {customerInfo.email}.
                  </p>
                  
                  <div className="bg-gray-50 rounded-lg p-4 mb-6 text-left">
                    <h3 className="font-semibold text-gray-900 mb-2">Booking Details</h3>
                    <p><strong>Date:</strong> {new Date(selectedDate).toLocaleDateString()}</p>
                    <p><strong>Time:</strong> {selectedTime}</p>
                    <p><strong>Participants:</strong> {participants}</p>
                    <p><strong>Payment Method:</strong> {paymentMethod.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}</p>
                    <p><strong>Total:</strong> ${calculateTotal().toFixed(2)}</p>
                  </div>
                  
                  <div className="flex justify-center space-x-4">
                    <button
                      onClick={() => navigate('/')}
                      className="bg-gray-200 text-gray-800 px-6 py-2 rounded-lg hover:bg-gray-300"
                    >
                      Home
                    </button>
                    <button
                      onClick={() => navigate('/my-bookings')}
                      className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
                    >
                      View My Bookings
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Attraction Summary */}
          <div className="lg:col-span-1">
            <div className="bg-white shadow-sm rounded-lg overflow-hidden sticky top-8">
              {attraction.images && attraction.images.length > 0 && (
                <img 
                  src={attraction.images[0]} 
                  alt={attraction.name}
                  className="w-full h-48 object-cover"
                />
              )}
              
              <div className="p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-2">{attraction.name}</h2>
                <p className="text-gray-600 mb-4">{attraction.description}</p>
                
                <div className="space-y-3 mb-6">
                  <div className="flex items-center">
                    <MapPin className="h-5 w-5 text-gray-400 mr-2" />
                    <span className="text-sm text-gray-600">{attraction.location}</span>
                  </div>
                  
                  <div className="flex items-center">
                    <Clock className="h-5 w-5 text-gray-400 mr-2" />
                    <span className="text-sm text-gray-600">
                      {attraction.duration} {attraction.durationUnit}
                    </span>
                  </div>
                  
                  <div className="flex items-center">
                    <Users className="h-5 w-5 text-gray-400 mr-2" />
                    <span className="text-sm text-gray-600">
                      Up to {attraction.maxCapacity} participants
                    </span>
                  </div>
                </div>
                
                <div className="border-t border-gray-200 pt-4">
                  <h3 className="font-semibold text-gray-900 mb-2">Pricing</h3>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm text-gray-600">
                      {attraction.pricingType === 'per_person' ? 'Per person' : 'Fixed price'}
                    </span>
                    <span className="font-semibold">${attraction.price.toFixed(2)}</span>
                  </div>
                  
                  {currentStep >= 2 && (
                    <>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm text-gray-600">Participants</span>
                        <span className="font-semibold">{participants}</span>
                      </div>
                      
                      {attraction.pricingType === 'per_person' && (
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-sm text-gray-600">Subtotal</span>
                          <span className="font-semibold">${(attraction.price * participants).toFixed(2)}</span>
                        </div>
                      )}
                    </>
                  )}
                  
                  <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-200">
                    <span className="font-bold text-gray-900">Total</span>
                    <span className="text-xl font-bold text-blue-600">${calculateTotal().toFixed(2)}</span>
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
    </div>
  );
};

export default BookingAttraction;