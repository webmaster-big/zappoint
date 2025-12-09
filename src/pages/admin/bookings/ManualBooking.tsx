import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Package, Users, Save, Plus, Minus } from 'lucide-react';
import { useThemeColor } from '../../../hooks/useThemeColor';
import bookingService from '../../../services/bookingService';
import { getStoredUser, getImageUrl } from '../../../utils/storage';

const ManualBooking: React.FC = () => {
  const navigate = useNavigate();
  const { fullColor } = useThemeColor();
  const [loading, setLoading] = useState(false);
  const [pkg, setPkg] = useState<any>(null);
  const [packages, setPackages] = useState<any[]>([]);
  const [selectedAddOns, setSelectedAddOns] = useState<{ [id: number]: number }>({});
  const [selectedAttractions, setSelectedAttractions] = useState<{ [id: number]: number }>({});
  const [form, setForm] = useState({
    customerName: '',
    email: '',
    phone: '',
    packageId: '',
    roomId: '',
    bookingDate: '',
    bookingTime: '',
    participants: 1,
    paymentMethod: 'cash' as const,
    paymentStatus: 'paid' as const,
    status: 'completed' as const,
    notes: '',
    totalAmount: '',
    amountPaid: ''
  });

  useEffect(() => {
    loadPackages();
  }, []);

  useEffect(() => {
    if (form.packageId) {
      loadPackageDetails(parseInt(form.packageId));
    } else {
      setPkg(null);
    }
  }, [form.packageId]);

  const loadPackages = async () => {
    try {
      const user = getStoredUser();
      
      if (!user) {
        console.error('No user found');
        return;
      }

      // Use the same method as OnsiteBooking - backend will filter based on user role
      const response = await bookingService.getPackages({user_id: user.id});
      
      console.log('📦 Packages response:', response);
      
      if (response.success && response.data && response.data.packages) {
        setPackages(Array.isArray(response.data.packages) ? response.data.packages : []);
      } else {
        setPackages([]);
      }
    } catch (error) {
      console.error('Error loading packages:', error);
      setPackages([]);
    }
  };

  const loadPackageDetails = async (packageId: number) => {
    try {
      const response = await bookingService.getPackageById(packageId);
      console.log('📦 Package data received:', response.data);
      setPkg(response.data);
    } catch (error) {
      console.error('Error loading package details:', error);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleAddOnChange = (addOnId: number, change: number) => {
    setSelectedAddOns(prev => {
      const newValue = (prev[addOnId] || 0) + change;
      if (newValue <= 0) {
        const { [addOnId]: removed, ...rest } = prev;
        return rest;
      }
      return { ...prev, [addOnId]: newValue };
    });
  };

  const handleAttractionChange = (attractionId: number, change: number) => {
    setSelectedAttractions(prev => {
      const newValue = (prev[attractionId] || 0) + change;
      if (newValue <= 0) {
        const { [attractionId]: removed, ...rest } = prev;
        return rest;
      }
      return { ...prev, [attractionId]: newValue };
    });
  };

  const calculateTotal = () => {
    if (!pkg) return 0;

    let total = 0;

    if (pkg.pricing_type === 'per_person') {
      total += Number(pkg.price) * form.participants;
    } else {
      // Fixed pricing: base price + additional charge for extra participants
      total += Number(pkg.price);
      const extraParticipants = Math.max(0, form.participants - (pkg.max_participants || 0));
      if (extraParticipants > 0 && pkg.additional_participant_price) {
        total += Number(pkg.additional_participant_price) * extraParticipants;
      }
    }

    Object.entries(selectedAddOns).forEach(([id, quantity]) => {
      const addOn = pkg.add_ons?.find((a: any) => a.id === parseInt(id));
      if (addOn) {
        if (addOn.pricing_type === 'per_person') {
          total += Number(addOn.price) * quantity * form.participants;
        } else {
          total += Number(addOn.price) * quantity;
        }
      }
    });

    Object.entries(selectedAttractions).forEach(([id, quantity]) => {
      const attraction = pkg.attractions?.find((a: any) => a.id === parseInt(id));
      if (attraction) {
        if (attraction.pricing_type === 'per_person') {
          total += Number(attraction.price) * quantity * form.participants;
        } else {
          total += Number(attraction.price) * quantity;
        }
      }
    });

    return total;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!form.customerName || !form.email || !form.packageId || !form.bookingDate || !form.bookingTime) {
      alert('Please fill in all required fields');
      return;
    }

    if (!pkg) {
      alert('Please select a valid package');
      return;
    }

    try {
      setLoading(true);
      
      const user = getStoredUser();
      const calculatedTotal = calculateTotal();
      const finalTotalAmount = form.totalAmount ? Number(form.totalAmount) : calculatedTotal;
      const finalAmountPaid = form.amountPaid ? Number(form.amountPaid) : 
        (form.paymentStatus === 'paid' ? finalTotalAmount : (form.paymentStatus === 'partial' ? finalTotalAmount / 2 : 0));
      
      // Prepare add-ons with price_at_booking
      const additionalAddons = Object.entries(selectedAddOns).map(([id, quantity]) => {
        const addOn = pkg.add_ons?.find((a: any) => a.id === parseInt(id));
        return {
          addon_id: parseInt(id),
          quantity: quantity,
          price_at_booking: addOn?.price || 0
        };
      });

      // Prepare attractions with price_at_booking
      const additionalAttractions = Object.entries(selectedAttractions).map(([id, quantity]) => {
        const attraction = pkg.attractions?.find((a: any) => a.id === parseInt(id));
        return {
          attraction_id: parseInt(id),
          quantity: quantity,
          price_at_booking: attraction?.price || 0
        };
      });
      
      const bookingData = {
        guest_name: form.customerName,
        guest_email: form.email,
        guest_phone: form.phone,
        package_id: parseInt(form.packageId),
        room_id: form.roomId ? parseInt(form.roomId) : undefined,
        type: 'package' as const,
        booking_date: form.bookingDate,
        booking_time: form.bookingTime,
        participants: form.participants,
        duration: pkg.duration,
        duration_unit: pkg.duration_unit,
        total_amount: finalTotalAmount,
        amount_paid: finalAmountPaid,
        payment_method: form.paymentMethod,
        payment_status: form.paymentStatus,
        status: form.status,
        notes: form.notes,
        location_id: user?.location_id,
        created_by: user?.id,
        additional_addons: additionalAddons.length > 0 ? additionalAddons : undefined,
        additional_attractions: additionalAttractions.length > 0 ? additionalAttractions : undefined
      };

      console.log('Creating past booking record:', bookingData);
      
      const response = await bookingService.createBooking(bookingData);
      
      if (response.success) {
        alert('Past booking recorded successfully!');
        navigate('/bookings');
      } else {
        alert('Failed to create booking: ' + (response.message || 'Unknown error'));
      }
    } catch (error: any) {
      console.error('Error creating past booking:', error);
      alert('Error creating booking: ' + (error.response?.data?.message || error.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <button
            onClick={() => navigate('/bookings')}
            className="flex items-center text-gray-600 hover:text-gray-900 mb-3 transition-colors"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Bookings
          </button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Record Past Booking</h1>
              <p className="text-sm text-gray-500 mt-1">Add historical booking records without validation</p>
            </div>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Main Content - Left Side */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Step 1: Package Selection */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-6 py-4" style={{ background: `linear-gradient(to right, ${fullColor}, ${fullColor}dd)` }}>
                <div className="flex items-center gap-3">
                  <div className="bg-white rounded-full p-2">
                    <Package className="h-5 w-5" style={{ color: fullColor }} />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-white">Step 1: Select Package</h2>
                    <p className="text-xs text-white opacity-90">Choose the package for this booking</p>
                  </div>
                </div>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {Array.isArray(packages) && packages.map((p: any) => (
                    <div
                      key={p.id}
                      onClick={() => {
                        const event = {
                          target: { name: 'packageId', value: p.id.toString() }
                        } as any;
                        handleInputChange(event);
                      }}
                      className={`relative cursor-pointer rounded-xl overflow-hidden transition-all duration-200 ${
                        form.packageId === p.id.toString()
                          ? 'ring-4 shadow-xl scale-105'
                          : 'hover:shadow-lg hover:scale-102 border-2 border-gray-200'
                      }`}
                      style={form.packageId === p.id.toString() ? { '--tw-ring-color': fullColor } as any : {}}
                    >
                      {p.image && (
                        <div className="relative h-32">
                          <img
                            src={getImageUrl(p.image)}
                            alt={p.name}
                            className="w-full h-full object-cover"
                          />
                          {form.packageId === p.id.toString() && (
                            <div className="absolute inset-0 flex items-center justify-center" style={{ backgroundColor: `${fullColor}33` }}>
                              <div className="text-white rounded-full p-2" style={{ backgroundColor: fullColor }}>
                                <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                      <div className="p-3 bg-white">
                        <h3 className="font-semibold text-sm text-gray-900 line-clamp-1 mb-1">{p.name}</h3>
                        <div className="flex items-baseline gap-2">
                          <span className="text-lg font-bold" style={{ color: fullColor }}>${p.price}</span>
                          <span className="text-xs text-gray-500">{p.pricing_type === 'per_person' ? 'per person' : 'fixed'}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {pkg && (
              <>
                {/* Step 2: Customer & Booking Info */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                  <div className="px-6 py-4" style={{ background: `linear-gradient(to right, ${fullColor}dd, ${fullColor}bb)` }}>
                    <div className="flex items-center gap-3">
                      <div className="bg-white rounded-full p-2">
                        <Users className="h-5 w-5" style={{ color: fullColor }} />
                      </div>
                      <div>
                        <h2 className="text-lg font-semibold text-white">Step 2: Customer & Booking Details</h2>
                        <p className="text-xs text-white opacity-90">Enter customer information and booking schedule</p>
                      </div>
                    </div>
                  </div>
                  <div className="p-6 space-y-6">
                    {/* Customer Info */}
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <div className="h-1 w-1 rounded-full" style={{ backgroundColor: fullColor }}></div>
                        Customer Information
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-2">Full Name *</label>
                          <input
                            type="text"
                            name="customerName"
                            value={form.customerName}
                            onChange={handleInputChange}
                            required
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent transition-all"
                            style={{ '--tw-ring-color': fullColor } as any}
                            placeholder="John Doe"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Email Address *</label>
                          <input
                            type="email"
                            name="email"
                            value={form.email}
                            onChange={handleInputChange}
                            required
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent transition-all"
                            style={{ '--tw-ring-color': fullColor } as any}
                            placeholder="john@example.com"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number</label>
                          <input
                            type="tel"
                            name="phone"
                            value={form.phone}
                            onChange={handleInputChange}
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent transition-all"
                            style={{ '--tw-ring-color': fullColor } as any}
                            placeholder="+1 (555) 123-4567"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="border-t border-gray-200"></div>

                    {/* Booking Details */}
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <div className="h-1 w-1 rounded-full" style={{ backgroundColor: fullColor }}></div>
                        Booking Schedule
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Date *</label>
                          <input
                            type="date"
                            name="bookingDate"
                            value={form.bookingDate}
                            onChange={handleInputChange}
                            required
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent transition-all"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Time *</label>
                          <input
                            type="time"
                            name="bookingTime"
                            value={form.bookingTime}
                            onChange={handleInputChange}
                            required
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent transition-all"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Participants *</label>
                          <input
                            type="number"
                            name="participants"
                            value={form.participants}
                            onChange={handleInputChange}
                            min="1"
                            required
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent transition-all"
                            style={{ '--tw-ring-color': fullColor } as any}
                          />
                          {pkg && pkg.pricing_type === 'fixed' && form.participants > (pkg.max_participants || 0) && pkg.additional_participant_price && (
                            <p className="text-xs text-amber-600 mt-1.5 flex items-center gap-1">
                              <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                              </svg>
                              {form.participants - pkg.max_participants} extra @ ${pkg.additional_participant_price} each
                            </p>
                          )}
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Booking Status *</label>
                          <select
                            name="status"
                            value={form.status}
                            onChange={handleInputChange}
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent transition-all"
                            style={{ '--tw-ring-color': fullColor } as any}
                          >
                            <option value="completed">Completed</option>
                            <option value="confirmed">Confirmed</option>
                            <option value="checked-in">Checked In</option>
                            <option value="cancelled">Cancelled</option>
                            <option value="pending">Pending</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Room Selection */}
                    {pkg.rooms && pkg.rooms.length > 0 && (
                      <>
                        <div className="border-t border-gray-200"></div>
                        <div>
                          <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                            <div className="h-1 w-1 rounded-full" style={{ backgroundColor: fullColor }}></div>
                            Room Selection
                            <span className="text-xs font-normal text-gray-500">(Optional)</span>
                          </h3>
                          <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
                            <div
                              onClick={() => {
                                const event = {
                                  target: { name: 'roomId', value: '' }
                                } as any;
                                handleInputChange(event);
                              }}
                              className={`cursor-pointer p-3 rounded-lg border-2 text-center transition-all ${
                                form.roomId === ''
                                  ? 'shadow-md'
                                  : 'border-gray-200 hover:bg-gray-50'
                              }`}
                              style={form.roomId === '' ? { borderColor: fullColor, backgroundColor: `${fullColor}15` } : {}}
                            >
                              <p className="font-medium text-sm text-gray-900">Any Room</p>
                            </div>
                            {Array.isArray(pkg.rooms) && pkg.rooms.map((room: any) => (
                              <div
                                key={room.id}
                                onClick={() => {
                                  const event = {
                                    target: { name: 'roomId', value: room.id.toString() }
                                  } as any;
                                  handleInputChange(event);
                                }}
                                className={`cursor-pointer p-3 rounded-lg border-2 transition-all ${
                                  form.roomId === room.id.toString()
                                    ? 'shadow-md'
                                    : 'border-gray-200 hover:bg-gray-50'
                                }`}
                                style={form.roomId === room.id.toString() ? { borderColor: fullColor, backgroundColor: `${fullColor}15` } : {}}
                              >
                                <h4 className="font-semibold text-sm text-gray-900 mb-1 truncate">{room.name}</h4>
                                <div className="flex items-center justify-center gap-1 text-xs text-gray-600">
                                  <Users className="h-3 w-3" />
                                  <span>{room.capacity}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Step 3: Add-ons & Attractions */}
                {((pkg.add_ons && pkg.add_ons.length > 0) || (pkg.attractions && pkg.attractions.length > 0)) && (
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="bg-gradient-to-r from-green-600 to-teal-600 px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="bg-white rounded-full p-2">
                          <Plus className="h-5 w-5 text-green-600" />
                        </div>
                        <div>
                          <h2 className="text-lg font-semibold text-white">Step 3: Add-ons & Attractions</h2>
                          <p className="text-xs text-green-100">Optional extras to enhance the experience</p>
                        </div>
                      </div>
                    </div>
                    <div className="p-6">
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {Array.isArray(pkg.add_ons) && pkg.add_ons.map((addOn: any) => {
                          const isSelected = selectedAddOns[addOn.id] > 0;
                          const quantity = selectedAddOns[addOn.id] || 0;
                          
                          return (
                            <div
                              key={addOn.id}
                              className={`rounded-xl overflow-hidden border-2 transition-all ${
                                isSelected 
                                  ? 'border-green-500 shadow-lg' 
                                  : 'border-gray-200 hover:border-green-300'
                              }`}
                            >
                              {addOn.image && (
                                <img 
                                  src={getImageUrl(addOn.image)} 
                                  alt={addOn.name} 
                                  className="w-full h-24 object-cover" 
                                />
                              )}
                              <div className="p-3">
                                <h4 className="font-semibold text-sm text-gray-900 line-clamp-1 mb-1">{addOn.name}</h4>
                                <div className="flex items-baseline gap-2 mb-3">
                                  <span className="text-base font-bold text-green-600">${addOn.price}</span>
                                  <span className="text-xs text-gray-500">{addOn.pricing_type === 'per_person' ? 'per person' : 'per unit'}</span>
                                </div>
                                
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => handleAddOnChange(addOn.id, -1)}
                                    disabled={!isSelected}
                                    className="p-1.5 rounded-lg bg-gray-100 border border-gray-300 hover:bg-gray-200 disabled:opacity-40 transition-colors"
                                  >
                                    <Minus className="h-3.5 w-3.5 text-gray-600" />
                                  </button>
                                  <span className="font-bold text-sm text-gray-900 min-w-[30px] text-center">{quantity}</span>
                                  <button
                                    type="button"
                                    onClick={() => handleAddOnChange(addOn.id, 1)}
                                    className="p-1.5 rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors"
                                  >
                                    <Plus className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                        
                        {Array.isArray(pkg.attractions) && pkg.attractions.map((attraction: any) => {
                          const isSelected = selectedAttractions[attraction.id] > 0;
                          const quantity = selectedAttractions[attraction.id] || 0;
                          
                          return (
                            <div
                              key={attraction.id}
                              className={`rounded-xl overflow-hidden border-2 transition-all ${
                                isSelected 
                                  ? 'border-green-500 shadow-lg' 
                                  : 'border-gray-200 hover:border-green-300'
                              }`}
                            >
                              {attraction.image && (
                                <img 
                                  src={getImageUrl(attraction.image)} 
                                  alt={attraction.name} 
                                  className="w-full h-24 object-cover" 
                                />
                              )}
                              <div className="p-3">
                                <h4 className="font-semibold text-sm text-gray-900 line-clamp-1 mb-1">{attraction.name}</h4>
                                <div className="flex items-baseline gap-2 mb-3">
                                  <span className="text-base font-bold text-green-600">${attraction.price}</span>
                                  <span className="text-xs text-gray-500">{attraction.pricing_type === 'per_person' ? 'per person' : 'per unit'}</span>
                                </div>
                                
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => handleAttractionChange(attraction.id, -1)}
                                    disabled={!isSelected}
                                    className="p-1.5 rounded-lg bg-gray-100 border border-gray-300 hover:bg-gray-200 disabled:opacity-40 transition-colors"
                                  >
                                    <Minus className="h-3.5 w-3.5 text-gray-600" />
                                  </button>
                                  <span className="font-bold text-sm text-gray-900 min-w-[30px] text-center">{quantity}</span>
                                  <button
                                    type="button"
                                    onClick={() => handleAttractionChange(attraction.id, 1)}
                                    className="p-1.5 rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors"
                                  >
                                    <Plus className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Sidebar - Right Side */}
          <div className="lg:col-span-1">
            <div className="sticky top-6 space-y-6">
              
              {/* Package Summary */}
              {pkg && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                  <div className="px-5 py-4" style={{ background: `linear-gradient(to right, ${fullColor}, ${fullColor}dd)` }}>
                    <h3 className="text-base font-semibold text-white">Selected Package</h3>
                  </div>
                  <div className="p-5">
                    {pkg.image && (
                      <img
                        src={getImageUrl(pkg.image)}
                        alt={pkg.name}
                        className="w-full h-32 object-cover rounded-lg mb-4"
                      />
                    )}
                    <h3 className="font-bold text-gray-900 mb-2">{pkg.name}</h3>
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <div className="bg-gray-50 rounded-lg p-2">
                        <p className="text-xs text-gray-500">Duration</p>
                        <p className="text-sm font-semibold text-gray-900">{pkg.duration} {pkg.duration_unit}</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-2">
                        <p className="text-xs text-gray-500">Capacity</p>
                        <p className="text-sm font-semibold text-gray-900">{pkg.max_participants} max</p>
                      </div>
                    </div>
                    {pkg.description && (
                      <p className="text-xs text-gray-600 line-clamp-3">{pkg.description}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Payment Summary */}
              {pkg && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                  <div className="bg-gradient-to-r from-amber-600 to-orange-600 px-5 py-4">
                    <h3 className="text-base font-semibold text-white">Payment Details</h3>
                  </div>
                  <div className="p-5 space-y-4">
                    {/* Calculated Total */}
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-gray-700">Calculated Total</span>
                        <span className="text-2xl font-bold text-amber-600">${Number(calculateTotal() || 0).toFixed(2)}</span>
                      </div>
                    </div>

                    {/* Manual Inputs */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Total Amount</label>
                      <input
                        type="number"
                        name="totalAmount"
                        value={form.totalAmount}
                        onChange={handleInputChange}
                        step="0.01"
                        min="0"
                        placeholder={`${Number(calculateTotal() || 0).toFixed(2)}`}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent"
                        style={{ '--tw-ring-color': fullColor } as any}
                      />
                      <p className="text-xs text-gray-500 mt-1">Leave blank to use calculated total</p>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Amount Paid</label>
                      <input
                        type="number"
                        name="amountPaid"
                        value={form.amountPaid}
                        onChange={handleInputChange}
                        step="0.01"
                        min="0"
                        placeholder="Auto-calculated"
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent"
                        style={{ '--tw-ring-color': fullColor } as any}
                      />
                      <p className="text-xs text-gray-500 mt-1">Leave blank for auto-calculation</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Payment Method</label>
                      <select
                        name="paymentMethod"
                        value={form.paymentMethod}
                        onChange={handleInputChange}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent"
                      >
                        <option value="cash">Cash</option>
                        <option value="card">Card</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Payment Status</label>
                      <select
                        name="paymentStatus"
                        value={form.paymentStatus}
                        onChange={handleInputChange}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent"
                      >
                        <option value="paid">Paid</option>
                        <option value="partial">Partial</option>
                        <option value="pending">Pending</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Additional Notes</label>
                      <textarea
                        name="notes"
                        value={form.notes}
                        onChange={handleInputChange}
                        rows={4}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent"
                        style={{ '--tw-ring-color': fullColor } as any}
                        placeholder="Add any additional notes..."
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              {pkg && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
                  <div className="flex flex-col gap-3">
                    <button
                      type="submit"
                      disabled={loading || !form.packageId}
                      className="w-full px-6 py-3 text-white font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all shadow-lg hover:opacity-90"
                      style={{ backgroundColor: fullColor }}
                    >
                      {loading ? (
                        <>
                          <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                          Processing...
                        </>
                      ) : (
                        <>
                          <Save className="h-5 w-5" />
                          Record Booking
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate('/bookings')}
                      disabled={loading}
                      className="w-full px-6 py-3 bg-white border-2 border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-all"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};

export default ManualBooking;
