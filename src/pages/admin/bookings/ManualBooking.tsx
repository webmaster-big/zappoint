import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, Package, Users, Save, Plus, Minus } from 'lucide-react';
import { useThemeColor } from '../../../hooks/useThemeColor';
import bookingService from '../../../services/bookingService';
import { getStoredUser, getImageUrl } from '../../../utils/storage';

const ManualBooking: React.FC = () => {
  const navigate = useNavigate();
  const { themeColor, fullColor } = useThemeColor();
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
    <div className="px-6 py-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <button
          onClick={() => navigate('/bookings')}
          className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Bookings
        </button>
        <h1 className="text-3xl font-bold text-gray-900">Record Past Booking</h1>
        <p className="text-gray-600 mt-2">Add historical booking records without payment processing or slot validation</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Package Selection */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Package className={`h-4 w-4 text-${fullColor}`} />
            Select Package
          </h2>
          
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-2.5">
            {Array.isArray(packages) && packages.map((p: any) => (
              <div
                key={p.id}
                onClick={() => {
                  const event = {
                    target: { name: 'packageId', value: p.id.toString() }
                  } as any;
                  handleInputChange(event);
                }}
                className={`cursor-pointer border-2 rounded-lg overflow-hidden transition-all hover:scale-105 ${
                  form.packageId === p.id.toString()
                    ? `border-${themeColor}-500 shadow-lg ring-2 ring-${themeColor}-200`
                    : 'border-gray-200 hover:border-gray-300 hover:shadow-md'
                }`}
              >
                {p.image && (
                  <div className="relative">
                    <img
                      src={getImageUrl(p.image)}
                      alt={p.name}
                      className="w-full h-20 object-cover"
                    />
                    {form.packageId === p.id.toString() && (
                      <div className={`absolute top-1 right-1 bg-${fullColor} text-white rounded-full p-1 shadow-lg`}>
                        <svg className="h-2.5 w-2.5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                  </div>
                )}
                <div className="p-2">
                  <h3 className="font-semibold text-xs text-gray-900 mb-0.5 line-clamp-1">{p.name}</h3>
                  <div className="flex items-baseline gap-1">
                    <span className={`text-sm font-bold text-${fullColor}`}>${p.price}</span>
                    <span className="text-[9px] text-gray-500">{p.pricing_type === 'per_person' ? '/p' : 'fix'}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {pkg && (
          <>
            {/* Combined Form Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              
              {/* Left Column - Customer & Booking Details */}
              <div className="lg:col-span-2 space-y-5">
                
                {/* Customer Information */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                  <h2 className="text-base font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Users className={`h-4 w-4 text-${fullColor}`} />
                    Customer Information
                  </h2>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-gray-700 mb-1.5">Customer Name *</label>
                      <input
                        type="text"
                        name="customerName"
                        value={form.customerName}
                        onChange={handleInputChange}
                        required
                        className={`w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-transparent`}
                        placeholder="John Doe"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1.5">Email *</label>
                      <input
                        type="email"
                        name="email"
                        value={form.email}
                        onChange={handleInputChange}
                        required
                        className={`w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-transparent`}
                        placeholder="john@example.com"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1.5">Phone</label>
                      <input
                        type="tel"
                        name="phone"
                        value={form.phone}
                        onChange={handleInputChange}
                        className={`w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-transparent`}
                        placeholder="+1 (555) 123-4567"
                      />
                    </div>
                  </div>
                </div>

                {/* Booking Details */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                  <h2 className="text-base font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Calendar className={`h-4 w-4 text-${fullColor}`} />
                    Booking Details
                  </h2>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1.5">Booking Date *</label>
                      <input
                        type="date"
                        name="bookingDate"
                        value={form.bookingDate}
                        onChange={handleInputChange}
                        required
                        className={`w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-transparent`}
                      />
                    </div>
                    
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1.5">Booking Time *</label>
                      <input
                        type="time"
                        name="bookingTime"
                        value={form.bookingTime}
                        onChange={handleInputChange}
                        required
                        className={`w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-transparent`}
                      />
                    </div>
                    
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1.5">Participants *</label>
                      <input
                        type="number"
                        name="participants"
                        value={form.participants}
                        onChange={handleInputChange}
                        min="1"
                        required
                        className={`w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-transparent`}
                      />
                      {pkg && pkg.pricing_type === 'fixed' && form.participants > (pkg.max_participants || 0) && pkg.additional_participant_price && (
                        <p className="text-[10px] text-amber-600 mt-1">
                          +{form.participants - pkg.max_participants} extra @ ${pkg.additional_participant_price}
                        </p>
                      )}
                    </div>
                    
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1.5">Status *</label>
                      <select
                        name="status"
                        value={form.status}
                        onChange={handleInputChange}
                        className={`w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-transparent`}
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
                  <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                    <h3 className="text-sm font-semibold text-gray-900 mb-2.5">Select Room <span className="text-xs font-normal text-gray-500">(optional)</span></h3>
                    <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
                      <div
                        onClick={() => {
                          const event = {
                            target: { name: 'roomId', value: '' }
                          } as any;
                          handleInputChange(event);
                        }}
                        className={`cursor-pointer border-2 rounded-lg p-2 text-center transition-all hover:scale-105 ${
                          form.roomId === ''
                            ? `border-${themeColor}-500 bg-${themeColor}-50 shadow-md`
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <p className="font-medium text-xs text-gray-900">Any</p>
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
                          className={`cursor-pointer border-2 rounded-lg p-2 transition-all hover:scale-105 ${
                            form.roomId === room.id.toString()
                              ? `border-${themeColor}-500 bg-${themeColor}-50 shadow-md`
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <h4 className="font-semibold text-xs text-gray-900 mb-0.5 truncate">{room.name}</h4>
                          <div className="flex items-center justify-center gap-0.5 text-[10px] text-gray-600">
                            <Users className="h-2.5 w-2.5" />
                            <span>{room.capacity}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Add-ons & Attractions in compact grid */}
                {(pkg.add_ons && pkg.add_ons.length > 0) || (pkg.attractions && pkg.attractions.length > 0) ? (
                  <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                    <h3 className="text-sm font-semibold text-gray-900 mb-2.5">Add-ons & Attractions <span className="text-xs font-normal text-gray-500">(optional)</span></h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {Array.isArray(pkg.add_ons) && pkg.add_ons.map((addOn: any) => {
                        const isSelected = selectedAddOns[addOn.id] > 0;
                        const quantity = selectedAddOns[addOn.id] || 0;
                        
                        return (
                          <div
                            key={addOn.id}
                            className={`border-2 rounded-lg overflow-hidden transition-all ${
                              isSelected 
                                ? `border-${themeColor}-500 shadow-md ring-1 ring-${themeColor}-200` 
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            {addOn.image && (
                              <img 
                                src={getImageUrl(addOn.image)} 
                                alt={addOn.name} 
                                className="w-full h-16 object-cover" 
                              />
                            )}
                            <div className="p-2">
                              <h4 className="font-semibold text-xs text-gray-900 line-clamp-1 mb-0.5">{addOn.name}</h4>
                              <div className="flex items-baseline gap-1 mb-1.5">
                                <span className={`text-xs font-bold text-${fullColor}`}>${addOn.price}</span>
                                <span className="text-[9px] text-gray-500">{addOn.pricing_type === 'per_person' ? '/p' : '/u'}</span>
                              </div>
                              
                              <div className="flex items-center justify-between gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleAddOnChange(addOn.id, -1)}
                                  disabled={!isSelected}
                                  className={`p-1 rounded bg-white border border-gray-300 hover:border-${themeColor}-400 disabled:opacity-40`}
                                >
                                  <Minus className="h-2.5 w-2.5 text-gray-600" />
                                </button>
                                <span className="font-bold text-xs text-gray-900 min-w-[20px] text-center">{quantity}</span>
                                <button
                                  type="button"
                                  onClick={() => handleAddOnChange(addOn.id, 1)}
                                  className={`p-1 rounded bg-${fullColor} text-white hover:opacity-90`}
                                >
                                  <Plus className="h-2.5 w-2.5" />
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
                            className={`border-2 rounded-lg overflow-hidden transition-all ${
                              isSelected 
                                ? `border-${themeColor}-500 shadow-md ring-1 ring-${themeColor}-200` 
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            {attraction.image && (
                              <img 
                                src={getImageUrl(attraction.image)} 
                                alt={attraction.name} 
                                className="w-full h-16 object-cover" 
                              />
                            )}
                            <div className="p-2">
                              <h4 className="font-semibold text-xs text-gray-900 line-clamp-1 mb-0.5">{attraction.name}</h4>
                              <div className="flex items-baseline gap-1 mb-1.5">
                                <span className={`text-xs font-bold text-${fullColor}`}>${attraction.price}</span>
                                <span className="text-[9px] text-gray-500">{attraction.pricing_type === 'per_person' ? '/p' : '/u'}</span>
                              </div>
                              
                              <div className="flex items-center justify-between gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleAttractionChange(attraction.id, -1)}
                                  disabled={!isSelected}
                                  className={`p-1 rounded bg-white border border-gray-300 hover:border-${themeColor}-400 disabled:opacity-40`}
                                >
                                  <Minus className="h-2.5 w-2.5 text-gray-600" />
                                </button>
                                <span className="font-bold text-xs text-gray-900 min-w-[20px] text-center">{quantity}</span>
                                <button
                                  type="button"
                                  onClick={() => handleAttractionChange(attraction.id, 1)}
                                  className={`p-1 rounded bg-${fullColor} text-white hover:opacity-90`}
                                >
                                  <Plus className="h-2.5 w-2.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

              </div>

              {/* Right Column - Package Info & Payment */}
              <div className="space-y-5">
                
                {/* Package Summary */}
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-100 p-4 sticky top-4">
                  <div className="flex items-start gap-3 mb-3">
                    {pkg.image && (
                      <img
                        src={getImageUrl(pkg.image)}
                        alt={pkg.name}
                        className="w-16 h-16 object-cover rounded-lg shadow-sm"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-bold text-gray-900 mb-1 line-clamp-2">{pkg.name}</h3>
                      <div className="flex gap-3 text-xs text-gray-600">
                        <div>
                          <span className="font-medium">{pkg.duration} {pkg.duration_unit}</span>
                        </div>
                        <div>
                          <span className="font-medium">Max: {pkg.max_participants}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Payment Section */}
                  <div className="space-y-3 pt-3 border-t border-blue-200">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-medium text-gray-700">Calculated:</span>
                      <span className="text-lg font-bold text-blue-600">${Number(calculateTotal() || 0).toFixed(2)}</span>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Total Amount</label>
                      <input
                        type="number"
                        name="totalAmount"
                        value={form.totalAmount}
                        onChange={handleInputChange}
                        step="0.01"
                        min="0"
                        placeholder={`${Number(calculateTotal() || 0).toFixed(2)}`}
                        className={`w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-${themeColor}-500`}
                      />
                    </div>
                    
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Amount Paid</label>
                      <input
                        type="number"
                        name="amountPaid"
                        value={form.amountPaid}
                        onChange={handleInputChange}
                        step="0.01"
                        min="0"
                        placeholder="Auto"
                        className={`w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-${themeColor}-500`}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Payment Method</label>
                      <select
                        name="paymentMethod"
                        value={form.paymentMethod}
                        onChange={handleInputChange}
                        className={`w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-${themeColor}-500`}
                      >
                        <option value="cash">Cash</option>
                        <option value="card">Card</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Payment Status</label>
                      <select
                        name="paymentStatus"
                        value={form.paymentStatus}
                        onChange={handleInputChange}
                        className={`w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-${themeColor}-500`}
                      >
                        <option value="paid">Paid</option>
                        <option value="partial">Partial</option>
                        <option value="pending">Pending</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
                      <textarea
                        name="notes"
                        value={form.notes}
                        onChange={handleInputChange}
                        rows={3}
                        className={`w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-${themeColor}-500`}
                        placeholder="Additional notes..."
                      />
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={() => navigate('/bookings')}
            disabled={loading}
            className="px-5 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading || !form.packageId}
            className={`px-5 py-2.5 bg-${fullColor} text-white rounded-lg text-sm font-medium hover:bg-${themeColor}-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2`}
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                Creating...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Record Booking
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ManualBooking;
