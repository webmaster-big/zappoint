import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

// Types
interface Attraction { name: string; price: number; unit?: string; }
interface PromoOrGiftCard { name: string; code: string; description?: string; }
interface Package {
  id: string;
  name: string;
  description: string;
  category: string;
  features: string;
  attractions: (string | { name: string; price: number; unit?: string })[];
  price: string;
  maxParticipants: string;
  pricePerAdditional: string;
  duration: string;
  durationUnit: "hours" | "minutes";
  pricePerAdditional30min: string;
  pricePerAdditional1hr: string;
  promos: PromoOrGiftCard[];
  giftCards: PromoOrGiftCard[];
  addOns: { name: string; price: number; unit?: string }[];
  availabilityType: "daily" | "weekly" | "monthly";
  availableDays: string[];
  availableWeekDays: string[];
  availableMonthDays: string[];
}

// Time slots for booking
const TIME_SLOTS = [
  "9:00 AM", "10:00 AM", "11:00 AM", "12:00 PM", 
  "1:00 PM", "2:00 PM", "3:00 PM", "4:00 PM", 
  "5:00 PM", "6:00 PM", "7:00 PM", "8:00 PM"
];

const BookPackage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [pkg, setPkg] = useState<Package | null>(null);
  const [attractions, setAttractions] = useState<Attraction[]>([]);
  const [selectedAddOns, setSelectedAddOns] = useState<{ [name: string]: number }>({});
  const [selectedAttractions, setSelectedAttractions] = useState<{ [name: string]: number }>({});
  const [promoCode, setPromoCode] = useState("");
  const [giftCardCode, setGiftCardCode] = useState("");
  const [appliedPromo, setAppliedPromo] = useState<PromoOrGiftCard | null>(null);
  const [appliedGiftCard, setAppliedGiftCard] = useState<PromoOrGiftCard | null>(null);
  const [participants, setParticipants] = useState(1);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
  });
  const [paymentMethod, setPaymentMethod] = useState("stripe");
  const [paymentType, setPaymentType] = useState<'full' | 'partial'>('full');
  const [currentStep, setCurrentStep] = useState(1);
  
  // Date and time selection
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [availableDates, setAvailableDates] = useState<Date[]>([]);
  const [availableTimes, setAvailableTimes] = useState<string[]>([]);

  // Load package and options from localStorage
  useEffect(() => {
    const packages = JSON.parse(localStorage.getItem("zapzone_packages") || "[]");
    const found = packages.find((p: Package) => p.id === id);
    setPkg(found || null);
    setAttractions(JSON.parse(localStorage.getItem("zapzone_attractions") || "[]"));
  }, [id]);

  // Calculate available dates based on package availability
  useEffect(() => {
    if (!pkg) return;
    
    const today = new Date();
    const dates: Date[] = [];
    
    // Generate available dates for the next 60 days
    for (let i = 0; i < 60; i++) {
      const date = new Date();
      date.setDate(today.getDate() + i);
      
      // Check if date matches package availability
      let isAvailable = false;
      
      if (pkg.availabilityType === "daily") {
        const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
        isAvailable = pkg.availableDays.includes(dayName);
      } 
      else if (pkg.availabilityType === "weekly") {
        const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
        isAvailable = pkg.availableWeekDays.includes(dayName);
      } 
      else if (pkg.availabilityType === "monthly") {
        const dayOfMonth = date.getDate();
        const isLastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate() === dayOfMonth;
        
        isAvailable = pkg.availableMonthDays.includes(dayOfMonth.toString()) || 
                     (isLastDay && pkg.availableMonthDays.includes("last"));
      }
      
      if (isAvailable) {
        dates.push(date);
      }
    }
    
    setAvailableDates(dates);
    
    // Set default selected date to first available date
    if (dates.length > 0 && !selectedDate) {
      const firstDate = dates[0].toISOString().split('T')[0];
      setSelectedDate(firstDate);
    }
  }, [pkg, selectedDate]);

  // Set available times when date is selected
  useEffect(() => {
    if (selectedDate) {
      // For demo purposes, all time slots are available
      // In a real app, you might check against existing bookings
      setAvailableTimes(TIME_SLOTS);
      
      // Set default selected time to first available time
      if (TIME_SLOTS.length > 0 && !selectedTime) {
        setSelectedTime(TIME_SLOTS[0]);
      }
    }
  }, [selectedDate, selectedTime]);

  // Handle add-on/attraction quantity change
  const handleAddOnQty = (name: string, qty: number) => {
    setSelectedAddOns((prev) => ({ ...prev, [name]: Math.max(0, qty) }));
  };
  const handleAttractionQty = (name: string, qty: number) => {
    setSelectedAttractions((prev) => ({ ...prev, [name]: Math.max(0, qty) }));
  };

  // Handle promo/gift card code apply
  const handleApplyCode = (type: "promo" | "giftcard") => {
    if (!pkg) return;
    if (type === "promo") {
      const found = (pkg.promos as PromoOrGiftCard[]).find((p) => p.code === promoCode);
      setAppliedPromo(found || null);
    } else {
      const found = (pkg.giftCards as PromoOrGiftCard[]).find((g) => g.code === giftCardCode);
      setAppliedGiftCard(found || null);
    }
  };

  // Calculate base price with additional participants
  const calculateBasePrice = () => {
    if (!pkg) return 0;
    const basePrice = Number(pkg.price);
    const maxParticipants = Number(pkg.maxParticipants);
    const pricePerAdditional = Number(pkg.pricePerAdditional);
    
    if (participants <= maxParticipants) {
      return basePrice;
    } else {
      const additional = participants - maxParticipants;
      return basePrice + (additional * pricePerAdditional);
    }
  };

  // Format duration for display
  const formatDuration = () => {
    if (!pkg || !pkg.duration) return "Not specified";
    return `${pkg.duration} ${pkg.durationUnit}`;
  };

  // Calculate totals
  const basePrice = calculateBasePrice();
  const addOnsTotal = Object.entries(selectedAddOns).reduce((sum, [name, qty]) => {
    const found = pkg && pkg.addOns.find((a) => (typeof a === "string" ? a : a.name) === name);
    const price = found ? (typeof found === "string" ? 0 : found.price || 0) : 0;
    return sum + price * qty;
  }, 0);
  const attractionsTotal = Object.entries(selectedAttractions).reduce((sum, [name, qty]) => {
    // Find the attraction in package attractions
    let price = 0;
    if (pkg) {
      for (const a of pkg.attractions) {
        if (typeof a === "string" && a === name) {
          // Look up in master attractions list
          const masterAttraction = attractions.find(attr => attr.name === name);
          price = masterAttraction ? masterAttraction.price : 0;
          break;
        } else if (typeof a === "object" && a.name === name) {
          price = a.price || 0;
          break;
        }
      }
    }
    return sum + price * qty;
  }, 0);
  
  // Promo and gift card discounts (simplified for demo)
  const promoDiscount = appliedPromo ? 10 : 0;
  const giftCardDiscount = appliedGiftCard ? 10 : 0;
  
  // Calculate subtotal and tax (Michigan tax rate: 6%)
  const subtotal = basePrice + addOnsTotal + attractionsTotal;
  const taxRate = 0.06; // Michigan tax
  const tax = (subtotal - promoDiscount - giftCardDiscount) * taxRate;
  const total = Math.max(0, subtotal - promoDiscount - giftCardDiscount + tax);
  const partialAmount = Math.round(total * 0.2 * 100) / 100;

  if (!pkg) return <div className="p-8 text-center text-gray-500">Package not found.</div>;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center py-8 px-4">
      <div className="w-full max-w-6xl flex flex-col md:flex-row gap-8">
        {/* Left: Booking Form */}
        <div className="flex-1 min-w-0">
          <div className="mb-8 bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <h2 className="text-xl font-semibold mb-2 text-gray-800">{pkg.name}</h2>
            <p className="text-gray-600 mb-4 text-sm">{pkg.description}</p>
            <div className="flex flex-wrap gap-2">
              {pkg.features && Array.isArray(pkg.features)
                ? <>{pkg.features.map((f: string) => (
                    <span key={f} className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">{f}</span>
                  ))}</>
                : typeof pkg.features === 'string' && pkg.features.trim() !== ''
                  ? <>{pkg.features.split(',').map((f: string) => (
                      <span key={f.trim()} className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">{f.trim()}</span>
                    ))}</>
                  : null}
            </div>
          </div>
          
          {/* Step Navigation */}
          <div className="flex mb-6 bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex-1 flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-3 ${currentStep >= 1 ? 'bg-blue-700 text-white' : 'bg-gray-200 text-gray-500'}`}>
                1
              </div>
              <span className={`text-sm font-medium ${currentStep >= 1 ? 'text-blue-700' : 'text-gray-500'}`}>Booking Details</span>
            </div>
            <div className="flex-1 flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-3 ${currentStep >= 2 ? 'bg-blue-700 text-white' : 'bg-gray-200 text-gray-500'}`}>
                2
              </div>
              <span className={`text-sm font-medium ${currentStep >= 2 ? 'text-blue-700' : 'text-gray-500'}`}>Personal Info</span>
            </div>
            <div className="flex-1 flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-3 ${currentStep >= 3 ? 'bg-blue-700 text-white' : 'bg-gray-200 text-gray-500'}`}>
                3
              </div>
              <span className={`text-sm font-medium ${currentStep >= 3 ? 'text-blue-700' : 'text-gray-500'}`}>Payment</span>
            </div>
          </div>
          
          <div className="space-y-6 bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            {currentStep === 1 ? (
              <>
                {/* Date and Time Selection */}
                <div className="bg-blue-50 p-5 rounded-xl">
                  <h3 className="font-medium mb-4 text-gray-700 text-sm uppercase tracking-wide">Select Date & Time</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block font-medium mb-2 text-gray-700 text-sm">Date</label>
                      <select
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                      >
                        {availableDates.map((date) => (
                          <option key={date.toISOString()} value={date.toISOString().split('T')[0]}>
                            {date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                          </option>
                        ))}
                      </select>
                    </div>
                    
                    <div>
                      <label className="block font-medium mb-2 text-gray-700 text-sm">Time</label>
                      <select
                        value={selectedTime}
                        onChange={(e) => setSelectedTime(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                      >
                        {availableTimes.map((time) => (
                          <option key={time} value={time}>{time}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  
                  <div className="text-xs text-gray-500">
                    <p>This package is available {pkg.availabilityType === 'daily' ? 'on selected days' : 
                      pkg.availabilityType === 'weekly' ? 'weekly on selected weekdays' : 
                      'monthly on selected days'}.</p>
                  </div>
                </div>
                
                {/* Duration Display */}
                <div className="bg-blue-50 p-5 rounded-xl">
                  <label className="block font-medium mb-3 text-gray-700 text-sm uppercase tracking-wide">Duration</label>
                  <div className="flex items-center">
                    <svg className="w-5 h-5 text-gray-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                    <span className="text-gray-700 font-medium">{formatDuration()}</span>
                  </div>
                </div>
                
                <div className="bg-blue-50 p-5 rounded-xl">
                  <label className="block font-medium mb-3 text-gray-700 text-sm uppercase tracking-wide">Participants</label>
                  <div className="flex items-center">
                    <button 
                      className="w-10 h-10 rounded-lg bg-white border border-gray-300 text-gray-700 flex items-center justify-center shadow-sm"
                      onClick={() => setParticipants(Math.max(1, participants - 1))}
                    >
                      -
                    </button>
                    <input 
                      type="number" 
                      min={1} 
                      max={Number(pkg.maxParticipants) + 10} 
                      value={participants} 
                      onChange={e => setParticipants(Math.max(1, Math.min(Number(pkg.maxParticipants) + 10, Number(e.target.value))))} 
                      className="w-16 text-center mx-3 rounded-lg border border-gray-300 px-2 py-2 text-base font-medium text-gray-700" 
                    />
                    <button 
                      className="w-10 h-10 rounded-lg bg-white border border-gray-300 text-gray-700 flex items-center justify-center shadow-sm"
                      onClick={() => setParticipants(Math.min(Number(pkg.maxParticipants) + 10, participants + 1))}
                    >
                      +
                    </button>
                    <span className="ml-4 text-sm text-gray-500">
                      Max: {pkg.maxParticipants} included, then ${pkg.pricePerAdditional} per additional
                    </span>
                  </div>
                </div>
                
                {pkg.attractions && pkg.attractions.length > 0 && (
                  <div className="border border-gray-200 rounded-xl p-5">
                    <label className="block font-medium mb-3 text-gray-700 text-sm uppercase tracking-wide">Additional Attractions</label>
                    <div className="space-y-4">
                      {pkg.attractions.map((a) => {
                        // If a is an object, use its properties; if string, use all available from attractions array
                        let attraction: { name: string; price?: number; unit?: string };
                        if (typeof a === "string") {
                          // Try to find the full object in attractions array if available
                          const found = attractions.find(attr => attr.name === a);
                          if (found) {
                            attraction = found;
                          } else {
                            attraction = { name: a };
                          }
                        } else {
                          const { name, price, unit } = a as { name: string; price?: number; unit?: string };
                          attraction = { name, price, unit };
                        }
                        return (
                          <div key={attraction.name} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div>
                              <span className="font-medium text-gray-800 text-sm">{attraction.name}</span>
                              <span className="block text-xs text-gray-500 mt-1">
                                {typeof attraction.price === "number"
                                  ? `$${attraction.price}${attraction.unit ? ` ${attraction.unit}` : ''}`
                                  : <span className="text-red-500">No price set</span>}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <button 
                                className="w-8 h-8 rounded-md bg-white border border-gray-300 text-gray-700 flex items-center justify-center text-sm shadow-sm"
                                onClick={() => handleAttractionQty(attraction.name, (selectedAttractions[attraction.name] || 0) - 1)}
                              >
                                -
                              </button>
                              <input 
                                type="number" 
                                min={0} 
                                value={selectedAttractions[attraction.name] || 0} 
                                onChange={e => handleAttractionQty(attraction.name, Number(e.target.value))} 
                                className="w-12 text-center rounded-md border border-gray-300 px-1 py-1 text-sm" 
                              />
                              <button 
                                className="w-8 h-8 rounded-md bg-white border border-gray-300 text-gray-700 flex items-center justify-center text-sm shadow-sm"
                                onClick={() => handleAttractionQty(attraction.name, (selectedAttractions[attraction.name] || 0) + 1)}
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
                
                {pkg.addOns && pkg.addOns.length > 0 && (
                  <div className="border border-gray-200 rounded-xl p-5">
                    <label className="block font-medium mb-3 text-gray-700 text-sm uppercase tracking-wide">Add-ons</label>
                    <div className="space-y-4">
                      {pkg.addOns.map((a) => {
                        const addOn = typeof a === "string" ? { name: a, price: undefined } : a;
                        return (
                          <div key={addOn.name} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div>
                              <span className="font-medium text-gray-800 text-sm">{addOn.name}</span>
                              <span className="block text-xs text-gray-500 mt-1">
                                {typeof addOn.price === "number" && addOn.price > 0 
                                  ? `$${addOn.price}${addOn.unit ? ` ${addOn.unit}` : ' each'}` 
                                  : <span className="text-red-500">No price set</span>}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <button 
                                className="w-8 h-8 rounded-md bg-white border border-gray-300 text-gray-700 flex items-center justify-center text-sm shadow-sm"
                                onClick={() => handleAddOnQty(addOn.name, (selectedAddOns[addOn.name] || 0) - 1)}
                              >
                                -
                              </button>
                              <input 
                                type="number" 
                                min={0} 
                                value={selectedAddOns[addOn.name] || 0} 
                                onChange={e => handleAddOnQty(addOn.name, Number(e.target.value))} 
                                className="w-12 text-center rounded-md border border-gray-300 px-1 py-1 text-sm" 
                              />
                              <button 
                                className="w-8 h-8 rounded-md bg-white border border-gray-300 text-gray-700 flex items-center justify-center text-sm shadow-sm"
                                onClick={() => handleAddOnQty(addOn.name, (selectedAddOns[addOn.name] || 0) + 1)}
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
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="border border-gray-200 rounded-xl p-5">
                    <label className="block font-medium mb-3 text-gray-700 text-sm uppercase tracking-wide">Promo Code</label>
                    <div className="flex gap-2 items-center">
                      <input 
                        type="text" 
                        value={promoCode} 
                        onChange={e => setPromoCode(e.target.value)} 
                        className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm" 
                        placeholder="Enter code" 
                      />
                      <button 
                        type="button" 
                        onClick={() => handleApplyCode("promo")}
                        className="px-4 py-2.5 rounded-lg bg-blue-700 text-white font-medium hover:bg-blue-700 transition text-sm shadow-sm"
                      >
                        Apply
                      </button>
                    </div>
                    {appliedPromo && (
                      <div className="mt-3 p-2 bg-green-50 text-green-700 rounded-md text-xs border border-green-200">
                        ✅ Applied: {appliedPromo.name}
                      </div>
                    )}
                  </div>
                  
                  <div className="border border-gray-200 rounded-xl p-5">
                    <label className="block font-medium mb-3 text-gray-700 text-sm uppercase tracking-wide">Gift Card</label>
                    <div className="flex gap-2 items-center">
                      <input 
                        type="text" 
                        value={giftCardCode} 
                        onChange={e => setGiftCardCode(e.target.value)} 
                        className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm" 
                        placeholder="Enter code" 
                      />
                      <button 
                        type="button" 
                        onClick={() => handleApplyCode("giftcard")}
                        className="px-4 py-2.5 rounded-lg bg-green-600 text-white font-medium hover:bg-green-700 transition text-sm shadow-sm"
                      >
                        Apply
                      </button>
                    </div>
                    {appliedGiftCard && (
                      <div className="mt-3 p-2 bg-green-50 text-green-700 rounded-md text-xs border border-green-200">
                        ✅ Applied: {appliedGiftCard.name}
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="flex justify-end pt-4">
                  <button 
                    className="py-3 px-6 rounded-lg bg-blue-700 text-white font-medium hover:bg-blue-700 transition shadow-sm flex items-center"
                    onClick={() => setCurrentStep(2)}
                  >
                    Continue to Personal Info
                    <svg className="ml-2 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path>
                    </svg>
                  </button>
                </div>
              </>
            ) : currentStep === 2 ? (
              <>
                <h3 className="text-lg font-medium text-gray-800 mb-6 border-b pb-3">Personal Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block font-medium mb-2 text-gray-700 text-sm">First Name</label>
                    <input 
                      type="text" 
                      placeholder="First Name" 
                      className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:ring-2 focus:ring-blue-600 focus:border-blue-600" 
                      value={form.firstName} 
                      onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} 
                    />
                  </div>
                  <div>
                    <label className="block font-medium mb-2 text-gray-700 text-sm">Last Name</label>
                    <input 
                      type="text" 
                      placeholder="Last Name" 
                      className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:ring-2 focus:ring-blue-600 focus:border-blue-600" 
                      value={form.lastName} 
                      onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} 
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block font-medium mb-2 text-gray-700 text-sm">Email</label>
                    <input 
                      type="email" 
                      placeholder="Email" 
                      className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:ring-2 focus:ring-blue-600 focus:border-blue-600" 
                      value={form.email} 
                      onChange={e => setForm(f => ({ ...f, email: e.target.value }))} 
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block font-medium mb-2 text-gray-700 text-sm">Phone Number</label>
                    <input 
                      type="tel" 
                      placeholder="Phone Number" 
                      className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:ring-2 focus:ring-blue-600 focus:border-blue-600" 
                      value={form.phone} 
                      onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} 
                    />
                  </div>
                </div>
                
                <div className="flex justify-between pt-6">
                  <button 
                    className="py-3 px-6 rounded-lg bg-gray-200 text-gray-700 font-medium hover:bg-gray-300 transition flex items-center"
                    onClick={() => setCurrentStep(1)}
                  >
                    <svg className="mr-2 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path>
                    </svg>
                    Back
                  </button>
                  <button 
                    className="py-3 px-6 rounded-lg bg-blue-700 text-white font-medium hover:bg-blue-700 transition shadow-sm flex items-center"
                    onClick={() => setCurrentStep(3)}
                  >
                    Continue to Payment
                    <svg className="ml-2 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path>
                    </svg>
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3 className="text-lg font-medium text-gray-800 mb-6 border-b pb-3">Payment Method</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
                  <div 
                    className={`border rounded-xl p-5 cursor-pointer transition ${paymentMethod === "stripe" ? "border-blue-600 bg-blue-50" : "border-gray-300 hover:border-gray-400 bg-white"}`}
                    onClick={() => setPaymentMethod("stripe")}
                  >
                    <div className="flex items-center">
                      <div className={`w-5 h-5 rounded-full border flex items-center justify-center mr-3 ${paymentMethod === "stripe" ? "border-blue-600 bg-blue-600" : "border-gray-400 bg-white"}`}>
                        {paymentMethod === "stripe" && <div className="w-2 h-2 rounded-full bg-white"></div>}
                      </div>
                      <span className="font-medium text-sm">Credit/Debit Card</span>
                      <div className="ml-auto flex">
                        <div className="bg-gray-100 rounded-sm p-1">
                          <svg className="w-6 h-4" viewBox="0 0 24 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M21.5 0H2.5C1.125 0 0 1.125 0 2.5V13.5C0 14.875 1.125 16 2.5 16H21.5C22.875 16 24 14.875 24 13.5V2.5C24 1.125 22.875 0 21.5 0Z" fill="#172B85"/>
                            <path d="M24 5.5H0V10.5H24V5.5Z" fill="#FF5F00"/>
                            <path d="M9 8C9 6.625 9.75 5.5 11 5.5C10.125 4.5 8.875 4 7.5 4C4.75 4 2.5 6.25 2.5 9C2.5 11.75 4.75 14 7.5 14C8.875 14 10.125 13.5 11 12.5C9.75 12.5 9 11.375 9 10" fill="#EB001B"/>
                            <path d="M21.5 8C21.5 6.25 19.75 4 17 4C15.625 4 14.375 4.5 13.5 5.5C14.75 5.5 15.5 6.625 15.5 8C15.5 9.375 14.75 10.5 13.5 10.5C14.375 11.5 15.625 12 17 12C19.75 12 21.5 9.75 21.5 8Z" fill="#F79E1B"/>
                          </svg>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div 
                    className={`border rounded-xl p-5 cursor-pointer transition ${paymentMethod === "paypal" ? "border-blue-600 bg-blue-50" : "border-gray-300 hover:border-gray-400 bg-white"}`}
                    onClick={() => setPaymentMethod("paypal")}
                  >
                    <div className="flex items-center">
                      <div className={`w-5 h-5 rounded-full border flex items-center justify-center mr-3 ${paymentMethod === "paypal" ? "border-blue-600 bg-blue-600" : "border-gray-400 bg-white"}`}>
                        {paymentMethod === "paypal" && <div className="w-2 h-2 rounded-full bg-white"></div>}
                      </div>
                      <span className="font-medium text-sm">PayPal</span>
                      <div className="ml-auto flex">
                        <div className="bg-gray-100 rounded-sm p-1">
                          <svg className="w-6 h-4" viewBox="0 0 24 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M20 0H4C1.75 0 0 1.75 0 4V12C0 14.25 1.75 16 4 16H20C22.25 16 24 14.25 24 12V4C24 1.75 22.25 0 20 0Z" fill="#27346A"/>
                            <path d="M19.25 4.75C19.25 6.5 17.75 8 16 8H12.5L11.5 12H9.75L11 7.25H15.5C16 7.25 16.5 6.75 16.5 6.25C16.5 5.75 16 5.25 15.5 5.25H11.25L11 4H16C17.75 4 19.25 5.5 19.25 7.25V4.75Z" fill="#2790C3"/>
                            <path d="M17.75 7.25C17.75 5.5 16.25 4 14.5 4H10.25L9.25 8H7.5L8.75 3.25H13.25C13.75 3.25 14.25 3.75 14.25 4.25C14.25 4.75 13.75 5.25 13.25 5.25H9L8.75 4H13.25C14.75 4 16 5.25 16 6.75C16 8.25 14.75 9.5 13.25 9.5H11.75L11 12.75H9.25L10.25 8.75H11.75C13.5 8.75 15 7.25 15 5.5C15 5.5 17.75 5.5 17.75 7.25Z" fill="#2790C3"/>
                          </svg>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                {/* Payment Type Selection */}
                <div className="mt-6 mb-4">
                  <label className="block font-medium mb-2 text-gray-700 text-sm">Select Payment Type</label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="paymentType"
                        value="full"
                        checked={paymentType === 'full'}
                        onChange={() => setPaymentType('full')}
                        className="accent-blue-700"
                      />
                      <span className="text-sm">Full Payment</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="paymentType"
                        value="partial"
                        checked={paymentType === 'partial'}
                        onChange={() => setPaymentType('partial')}
                        className="accent-blue-700"
                      />
                      <span className="text-sm">Partial Payment (20%)</span>
                    </label>
                  </div>
                  {paymentType === 'partial' && (
                    <div className="mt-2 text-xs text-gray-600">
                      You will pay <span className="font-semibold text-blue-700">${partialAmount.toFixed(2)}</span> now. Remaining balance will be paid on site.
                    </div>
                  )}
                </div>
                
                <div className="flex justify-between pt-6">
                  <button 
                    className="py-3 px-6 rounded-lg bg-gray-200 text-gray-700 font-medium hover:bg-gray-300 transition flex items-center"
                    onClick={() => setCurrentStep(2)}
                  >
                    <svg className="mr-2 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path>
                    </svg>
                    Back
                  </button>
                  <button className="py-3 px-8 rounded-lg bg-blue-700 text-white font-medium hover:bg-blue-700 transition shadow-sm">
                    Pay Now
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
        
        {/* Right: Order Summary */}
        <div className="w-full md:w-80 flex-shrink-0">
          <div className="bg-white rounded-xl shadow-sm p-6 sticky top-6 border border-gray-100">
            <h3 className="font-semibold text-lg mb-5 text-gray-800 border-b pb-4">Order Summary</h3>
            
            <div className="mb-5">
              <div className="flex justify-between items-center mb-2">
                <span className="text-gray-600 text-sm">Package:</span>
                <span className="font-medium text-gray-800 text-sm">{pkg.name}</span>
              </div>
              <div className="text-xs text-gray-500 mb-4">{participants} participants</div>
              
              {/* Duration in Order Summary */}
              <div className="flex justify-between items-center mb-2">
                <span className="text-gray-600 text-sm">Duration:</span>
                <span className="font-medium text-gray-800 text-sm">{formatDuration()}</span>
              </div>
              
              {selectedDate && (
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-600 text-sm">Date:</span>
                  <span className="font-medium text-gray-800 text-sm">
                    {new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                  </span>
                </div>
              )}
              
              {selectedTime && (
                <div className="flex justify-between items-center mb-4">
                  <span className="text-gray-600 text-sm">Time:</span>
                  <span className="font-medium text-gray-800 text-sm">{selectedTime}</span>
                </div>
              )}
            </div>
            
            <div className="space-y-4 border-t pt-4 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Base Price</span>
                <span className="font-medium">${basePrice.toFixed(2)}</span>
              </div>
              
              {Object.entries(selectedAttractions).some(([, qty]) => qty > 0) && (
                <div>
                  <div className="font-medium text-gray-700 mb-2 text-sm">Attractions</div>
                  {Object.entries(selectedAttractions).filter(([, qty]) => qty > 0).map(([name, qty]) => {
                    let price = 0;
                    let unit = '';
                    if (pkg) {
                      for (const a of pkg.attractions) {
                        if (typeof a === "string" && a === name) {
                          // Look up in master attractions list
                          const masterAttraction = attractions.find(attr => attr.name === name);
                          if (masterAttraction) {
                            price = masterAttraction.price || 0;
                            unit = masterAttraction.unit || '';
                          }
                          break;
                        } else if (typeof a === "object" && a.name === name) {
                          price = a.price || 0;
                          unit = a.unit || '';
                          break;
                        }
                      }
                    }
                    return (
                      <div key={name} className="flex justify-between text-gray-600 pl-2 text-xs mb-1">
                        <span>{name} x{qty}</span>
                        <span>${(price * qty).toFixed(2)}{unit && ` (${unit})`}</span>
                      </div>
                    );
                  })}
                </div>
              )}
              
              {Object.entries(selectedAddOns).some(([, qty]) => qty > 0) && (
                <div>
                  <div className="font-medium text-gray-700 mb-2 text-sm">Add-ons</div>
                  {Object.entries(selectedAddOns).filter(([, qty]) => qty > 0).map(([name, qty]) => {
                    let price = 0;
                    let unit = '';
                    if (pkg) {
                      for (const a of pkg.addOns) {
                        if ((typeof a === "string" && a === name) || (typeof a === "object" && a.name === name)) {
                          price = typeof a === "object" && typeof a.price === "number" ? a.price : 0;
                          unit = typeof a === "object" && a.unit ? a.unit : '';
                          break;
                        }
                      }
                    }
                    return (
                      <div key={name} className="flex justify-between text-gray-600 pl-2 text-xs mb-1">
                        <span>{name} x{qty}</span>
                        <span>${(price * qty).toFixed(2)}{unit && ` (${unit})`}</span>
                      </div>
                    );
                  })}
                </div>
              )}
              
              {appliedPromo && (
                <div className="flex justify-between text-green-600">
                  <span>Promo Discount</span>
                  <span>-${promoDiscount.toFixed(2)}</span>
                </div>
              )}
              
              {appliedGiftCard && (
                <div className="flex justify-between text-green-600">
                  <span>Gift Card</span>
                  <span>-${giftCardDiscount.toFixed(2)}</span>
                </div>
              )}
              
              <div className="flex justify-between text-gray-600 pt-2 border-t">
                <span>Tax (6%)</span>
                <span>${tax.toFixed(2)}</span>
              </div>
              
              <div className="flex justify-between pt-3 border-t font-semibold text-base">
                <span>Total</span>
                <span className="text-blue-700">${total.toFixed(2)}</span>
              </div>
            </div>
            
            <div className="mt-6 text-xs text-gray-500 text-center border-t pt-4">
              Your booking will be confirmed immediately after payment
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BookPackage;