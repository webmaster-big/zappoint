import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Plus, Minus } from 'lucide-react';
import { useThemeColor } from '../../../hooks/useThemeColor';
import bookingService from '../../../services/bookingService';
import roomService from '../../../services/RoomService';
import { getStoredUser, getImageUrl } from '../../../utils/storage';

const ManualBooking: React.FC = () => {
  const navigate = useNavigate();
  const { themeColor, fullColor } = useThemeColor();
  const [loading, setLoading] = useState(false);
  const [pkg, setPkg] = useState<any>(null);
  const [packages, setPackages] = useState<any[]>([]);
  const [selectedAddOns, setSelectedAddOns] = useState<{ [id: number]: number }>({});
  const [selectedAttractions, setSelectedAttractions] = useState<{ [id: number]: number }>({});
  const [creatingRoom, setCreatingRoom] = useState(false);
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

  const handleCreateRoom = async (roomName: string) => {
    if (!roomName.trim()) return;
    
    try {
      setCreatingRoom(true);
      const user = getStoredUser();
      
      if (!user?.location_id) {
        alert('User location not found');
        return;
      }

      const response = await roomService.createRoom({
        location_id: user.location_id,
        name: roomName.trim(),
        is_available: true
      });

      if (response.success && response.data) {
        // Update the package's rooms list
        setPkg((prev: any) => ({
          ...prev,
          rooms: [...(prev.rooms || []), response.data]
        }));

        // Set the newly created room as selected
        setForm(prev => ({
          ...prev,
          roomId: response.data.id.toString()
        }));

        // Reload package details to get updated rooms
        if (form.packageId) {
          await loadPackageDetails(parseInt(form.packageId));
        }
      }
    } catch (error: any) {
      console.error('Error creating room:', error);
      alert('Failed to create room: ' + (error.response?.data?.message || error.message));
    } finally {
      setCreatingRoom(false);
    }
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
        <div className={`grid gap-6 transition-all duration-500 ${
          form.packageId 
            ? 'grid-cols-1 lg:grid-cols-3' 
            : 'grid-cols-1'
        }`}>
          
          {/* Main Content - Left Side */}
          <div className={`space-y-6 transition-all duration-500 ${
            form.packageId ? 'lg:col-span-2' : 'col-span-1'
          }`}>
            
            {/* Step 1: Package Selection */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-1">Select Package</h2>
                <p className="text-sm text-gray-600">Choose the package for this booking</p>
              </div>
              <div className="grid grid-cols-1 gap-4">
                {Array.isArray(packages) && packages.map((p: any) => (
                  <div
                    key={p.id}
                    onClick={() => {
                      const event = {
                        target: { name: 'packageId', value: form.packageId === p.id.toString() ? '' : p.id.toString() }
                      } as any;
                      handleInputChange(event);
                    }}
                    className={`border-2 rounded-lg p-5 cursor-pointer transition-all ${
                      form.packageId === p.id.toString()
                        ? `border-${themeColor}-500 bg-${themeColor}-50 shadow-sm`
                        : `border-gray-200 hover:border-${themeColor}-300 hover:bg-gray-50`
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-bold text-gray-900">{p.name}</h3>
                          {form.packageId === p.id.toString() && (
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-${themeColor}-100 text-${themeColor}-700`}>
                              <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"></path>
                              </svg>
                              Selected
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 mb-3">{p.description}</p>
                        <div className="flex flex-wrap gap-2">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-${themeColor}-50 text-${themeColor}-700 border border-${themeColor}-200`}>
                            {p.category || 'Package'}
                          </span>
                          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-700">
                            {p.duration} {p.duration_unit}
                          </span>
                          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-700">
                            Up to {p.max_participants} people
                          </span>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="flex items-baseline gap-1 justify-end">
                          <span className="text-sm text-gray-500">$</span>
                          <span className={`text-3xl font-bold text-${themeColor}-600`}>{p.price}</span>
                        </div>
                        <span className="text-xs text-gray-500 mt-1 block">{p.pricing_type === 'per_person' ? 'per person' : 'per booking'}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {pkg && (
              <>
                {/* Step 2: Customer & Booking Info */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <div className="mb-6">
                    <h2 className="text-2xl font-bold text-gray-900 mb-1">Customer & Booking Details</h2>
                    <p className="text-sm text-gray-600">Enter customer information and booking schedule</p>
                  </div>
                  <div className="space-y-6">
                    {/* Customer Info */}
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <div className={`h-1 w-1 rounded-full bg-${themeColor}-600`}></div>
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
                            className={`w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-transparent transition-all`}
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
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring--500 focus:border-transparent transition-all"
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
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring--500 focus:border-transparent transition-all"
                            placeholder="+1 (555) 123-4567"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="border-t border-gray-200"></div>

                    {/* Booking Details */}
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <div className={`h-1 w-1 rounded-full bg-${themeColor}-600`}></div>
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
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring--500 focus:border-transparent transition-all"
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
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring--500 focus:border-transparent transition-all"
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
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring--500 focus:border-transparent transition-all"
                          />
                          {pkg && form.participants > (pkg.max_participants || 0) && pkg.additional_participant_price && (
                            <p className="text-xs text-amber-600 mt-1.5 flex items-center gap-1">
                              <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                              </svg>
                              {form.participants - pkg.max_participants} additional participant{form.participants - pkg.max_participants > 1 ? 's' : ''} @ ${pkg.additional_participant_price} each
                            </p>
                          )}
                          {pkg && (
                            <p className="text-xs text-gray-500 mt-1">Max: {pkg.max_participants} participants</p>
                          )}
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Booking Status *</label>
                          <select
                            name="status"
                            value={form.status}
                            onChange={handleInputChange}
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring--500 focus:border-transparent transition-all"
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
                            <div className={`h-1 w-1 rounded-full bg-${themeColor}-600`}></div>
                            Room Selection *
                          </h3>
                          <div className="flex flex-wrap gap-2">
                            {Array.isArray(pkg.rooms) && pkg.rooms.map((room: any) => (
                              <button
                                type="button"
                                key={room.id}
                                onClick={() => {
                                  const event = {
                                    target: { name: 'roomId', value: room.id.toString() }
                                  } as any;
                                  handleInputChange(event);
                                }}
                                className={`px-4 py-2 rounded-lg border-2 text-sm font-medium transition-all ${
                                  form.roomId === room.id.toString()
                                    ? `border-${themeColor}-500 bg-${themeColor}-50 text-${fullColor}`
                                    : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-300'
                                }`}
                              >
                                {room.name}
                              </button>
                            ))}
                            <input
                              type="text"
                              placeholder="Type new room name"
                              id="new-room-name"
                              className="rounded-lg border border-gray-300 px-4 py-2 text-sm bg-white transition-all placeholder:text-gray-400 focus:ring-2 focus:ring-${themeColor}-500 focus:border-transparent"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  const input = e.target as HTMLInputElement;
                                  handleCreateRoom(input.value);
                                  input.value = '';
                                }
                              }}
                            />
                            <button
                              type="button"
                              className={`p-2 rounded-lg transition-colors ${creatingRoom ? 'opacity-50 cursor-not-allowed' : 'hover:bg-${themeColor}-50'}`}
                              title="Add new room"
                              disabled={creatingRoom}
                              onClick={() => {
                                const input = document.getElementById('new-room-name') as HTMLInputElement;
                                if (input?.value) {
                                  handleCreateRoom(input.value);
                                  input.value = '';
                                }
                              }}
                            >
                              {creatingRoom ? (
                                <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-400 border-t-transparent"></div>
                              ) : (
                                <Plus className={`w-4 h-4 text-${themeColor}-600`} />
                              )}
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Step 3: Add-ons & Attractions */}
                {((pkg.add_ons && pkg.add_ons.length > 0) || (pkg.attractions && pkg.attractions.length > 0)) && (
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <div className="mb-6">
                      <h2 className="text-2xl font-bold text-gray-900 mb-1">Add-ons & Attractions</h2>
                      <p className="text-sm text-gray-600">Optional extras to enhance the experience</p>
                    </div>
                    <div>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {Array.isArray(pkg.add_ons) && pkg.add_ons.map((addOn: any) => {
                          const isSelected = selectedAddOns[addOn.id] > 0;
                          const quantity = selectedAddOns[addOn.id] || 0;
                          
                          return (
                            <div
                              key={addOn.id}
                              className={`rounded-xl overflow-hidden border-2 transition-all ${
                                isSelected 
                                  ? `border-${themeColor}-500 shadow-lg` 
                                  : 'border-gray-200'
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
                                  <span className={`text-base font-bold text-${themeColor}-600`}>${addOn.price}</span>
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
                                    className={`p-1.5 rounded-lg text-white transition-colors bg-${themeColor}-600 hover:bg-${themeColor}-700`}
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
                                  ? `border-${themeColor}-500 shadow-lg` 
                                  : 'border-gray-200'
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
                                  <span className={`text-base font-bold text-${themeColor}-600`}>${attraction.price}</span>
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
                                    className={`p-1.5 rounded-lg text-white transition-colors bg-${themeColor}-600 hover:bg-${themeColor}-700`}
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

          {/* Sidebar - Right Side - Only shows when package is selected */}
          {form.packageId && (
            <div className="lg:col-span-1 transition-all duration-500">
              <div className="sticky top-6 space-y-6">
              
              {/* Package Summary */}
              {pkg && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Selected Package</h3>
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
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Payment Details</h3>
                  <div className="space-y-4">
                    {/* Price Breakdown */}
                    <div className="space-y-2 text-sm">
                      {/* Package Price */}
                      {pkg.pricing_type === 'per_person' ? (
                        <div className="flex justify-between text-gray-700">
                          <span>Package ({form.participants} × ${pkg.price})</span>
                          <span className="font-medium">${(Number(pkg.price) * form.participants).toFixed(2)}</span>
                        </div>
                      ) : (
                        <>
                          <div className="flex justify-between text-gray-700">
                            <span>Package (base price)</span>
                            <span className="font-medium">${Number(pkg.price).toFixed(2)}</span>
                          </div>
                          {form.participants > (pkg.max_participants || 0) && pkg.additional_participant_price && (
                            <div className="flex justify-between text-amber-700">
                              <span>Additional participants ({form.participants - pkg.max_participants} × ${pkg.additional_participant_price})</span>
                              <span className="font-medium">${(Number(pkg.additional_participant_price) * (form.participants - pkg.max_participants)).toFixed(2)}</span>
                            </div>
                          )}
                        </>
                      )}

                      {/* Add-ons */}
                      {Object.entries(selectedAddOns).map(([id, quantity]) => {
                        const addOn = pkg.add_ons?.find((a: any) => a.id === parseInt(id));
                        if (!addOn) return null;
                        const price = addOn.pricing_type === 'per_person' 
                          ? Number(addOn.price) * quantity * form.participants
                          : Number(addOn.price) * quantity;
                        return (
                          <div key={id} className="flex justify-between text-gray-600 text-xs">
                            <span>{addOn.name} ({quantity}{addOn.pricing_type === 'per_person' ? ` × ${form.participants} people` : ''})</span>
                            <span className="font-medium">${price.toFixed(2)}</span>
                          </div>
                        );
                      })}

                      {/* Attractions */}
                      {Object.entries(selectedAttractions).map(([id, quantity]) => {
                        const attraction = pkg.attractions?.find((a: any) => a.id === parseInt(id));
                        if (!attraction) return null;
                        const price = attraction.pricing_type === 'per_person'
                          ? Number(attraction.price) * quantity * form.participants
                          : Number(attraction.price) * quantity;
                        return (
                          <div key={id} className="flex justify-between text-gray-600 text-xs">
                            <span>{attraction.name} ({quantity}{attraction.pricing_type === 'per_person' ? ` × ${form.participants} people` : ''})</span>
                            <span className="font-medium">${price.toFixed(2)}</span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Calculated Total */}
                    <div className={`bg-${themeColor}-50 border border-${themeColor}-200 rounded-lg p-4`}>
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-gray-700">Calculated Total</span>
                        <span className={`text-2xl font-bold text-${fullColor}`}>${Number(calculateTotal() || 0).toFixed(2)}</span>
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
                        placeholder="Add any additional notes..."
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              {pkg && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
                  <div className="flex flex-col gap-3">
                    <button
                      type="submit"
                      disabled={loading || !form.packageId}
                      className={`w-full px-6 py-3 text-white font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all shadow-lg bg-${themeColor}-600 hover:bg-${themeColor}-700`}
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
          )}
        </div>
      </form>
    </div>
  );
};

export default ManualBooking;
