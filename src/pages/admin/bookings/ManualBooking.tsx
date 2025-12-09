import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, Package, Users, DollarSign, Save, Plus, Minus } from 'lucide-react';
import { useThemeColor } from '../../../hooks/useThemeColor';
import bookingService from '../../../services/bookingService';
import { getStoredUser, getImageUrl } from '../../../utils/storage';

const ManualBooking: React.FC = () => {
  const navigate = useNavigate();
  const { themeColor, fullColor } = useThemeColor();
  const [loading, setLoading] = useState(false);
  const [pkg, setPkg] = useState<any>(null);
  const [packages, setPackages] = useState<any[]>([]);
  const [loadingPackages, setLoadingPackages] = useState(true);
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
    notes: ''
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
      setLoadingPackages(true);
      const user = getStoredUser();
      
      if (!user) {
        console.error('No user found');
        setLoadingPackages(false);
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
    } finally {
      setLoadingPackages(false);
    }
  };

  const loadPackageDetails = async (packageId: number) => {
    try {
      const response = await bookingService.getPackageById(packageId);
      console.log('📦 Package data received:', response.data);
      setPkg(response.data);
      
      if (response.data.max_participants) {
        setForm(prev => ({ ...prev, participants: response.data.max_participants }));
      }
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
      total += pkg.price * form.participants;
    } else {
      total += pkg.price;
    }

    Object.entries(selectedAddOns).forEach(([id, quantity]) => {
      const addOn = pkg.add_ons?.find((a: any) => a.id === parseInt(id));
      if (addOn) {
        if (addOn.pricing_type === 'per_person') {
          total += addOn.price * quantity * form.participants;
        } else {
          total += addOn.price * quantity;
        }
      }
    });

    Object.entries(selectedAttractions).forEach(([id, quantity]) => {
      const attraction = pkg.attractions?.find((a: any) => a.id === parseInt(id));
      if (attraction) {
        if (attraction.pricing_type === 'per_person') {
          total += attraction.price * quantity * form.participants;
        } else {
          total += attraction.price * quantity;
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
      const totalAmount = calculateTotal();
      
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
        total_amount: totalAmount,
        amount_paid: form.paymentStatus === 'paid' ? totalAmount : (form.paymentStatus === 'partial' ? totalAmount / 2 : 0),
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

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Package className={`h-5 w-5 text-${fullColor}`} />
            <h2 className="text-xl font-semibold text-gray-900">Select Package</h2>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Package *
            </label>
            <select
              name="packageId"
              value={form.packageId}
              onChange={handleInputChange}
              required
              disabled={loadingPackages}
              className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-transparent`}
            >
              <option value="">Select a package</option>
              {Array.isArray(packages) && packages.map((p: any) => (
                <option key={p.id} value={p.id}>
                  {p.name} - ${p.price} {p.pricing_type === 'per_person' ? '(per person)' : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        {pkg && (
          <>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Package Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {pkg.image && (
                  <div className="md:col-span-2">
                    <img
                      src={getImageUrl(pkg.image)}
                      alt={pkg.name}
                      className="w-full h-48 object-cover rounded-lg"
                    />
                  </div>
                )}
                <div>
                  <p className="text-sm text-gray-600">Duration</p>
                  <p className="font-medium">{pkg.duration} {pkg.duration_unit}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Max Participants</p>
                  <p className="font-medium">{pkg.max_participants}</p>
                </div>
                <div className="md:col-span-2">
                  <p className="text-sm text-gray-600">Description</p>
                  <p className="text-gray-700">{pkg.description}</p>
                </div>
              </div>
            </div>

            {pkg.rooms && pkg.rooms.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Select Room</h3>
                <select
                  name="roomId"
                  value={form.roomId}
                  onChange={handleInputChange}
                  className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-transparent`}
                >
                  <option value="">No room preference</option>
                  {Array.isArray(pkg.rooms) && pkg.rooms.map((room: any) => (
                    <option key={room.id} value={room.id}>
                      {room.name} - Capacity: {room.capacity}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {pkg.add_ons && pkg.add_ons.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Add-ons (Optional)</h3>
                <div className="space-y-4">
                  {Array.isArray(pkg.add_ons) && pkg.add_ons.map((addOn: any) => (
                    <div key={addOn.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900">{addOn.name}</h4>
                        <p className="text-sm text-gray-600">{addOn.description}</p>
                        <p className="text-sm font-semibold text-gray-900 mt-1">
                          ${addOn.price} {addOn.pricing_type === 'per_person' ? '(per person)' : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleAddOnChange(addOn.id, -1)}
                          disabled={!selectedAddOns[addOn.id]}
                          className={`p-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50`}
                        >
                          <Minus className="h-4 w-4" />
                        </button>
                        <span className="w-12 text-center font-medium">
                          {selectedAddOns[addOn.id] || 0}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleAddOnChange(addOn.id, 1)}
                          className={`p-2 rounded-lg border border-${themeColor}-500 bg-${themeColor}-500 text-white hover:bg-${themeColor}-600`}
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {pkg.attractions && pkg.attractions.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Attractions (Optional)</h3>
                <div className="space-y-4">
                  {Array.isArray(pkg.attractions) && pkg.attractions.map((attraction: any) => (
                    <div key={attraction.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900">{attraction.name}</h4>
                        <p className="text-sm text-gray-600">{attraction.description}</p>
                        <p className="text-sm font-semibold text-gray-900 mt-1">
                          ${attraction.price} {attraction.pricing_type === 'per_person' ? '(per person)' : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleAttractionChange(attraction.id, -1)}
                          disabled={!selectedAttractions[attraction.id]}
                          className={`p-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50`}
                        >
                          <Minus className="h-4 w-4" />
                        </button>
                        <span className="w-12 text-center font-medium">
                          {selectedAttractions[attraction.id] || 0}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleAttractionChange(attraction.id, 1)}
                          className={`p-2 rounded-lg border border-${themeColor}-500 bg-${themeColor}-500 text-white hover:bg-${themeColor}-600`}
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Users className={`h-5 w-5 text-${fullColor}`} />
            <h2 className="text-xl font-semibold text-gray-900">Customer Information</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Customer Name *
              </label>
              <input
                type="text"
                name="customerName"
                value={form.customerName}
                onChange={handleInputChange}
                required
                className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-transparent`}
                placeholder="John Doe"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email *
              </label>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleInputChange}
                required
                className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-transparent`}
                placeholder="john@example.com"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Phone
              </label>
              <input
                type="tel"
                name="phone"
                value={form.phone}
                onChange={handleInputChange}
                className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-transparent`}
                placeholder="+1 (555) 123-4567"
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Calendar className={`h-5 w-5 text-${fullColor}`} />
            <h2 className="text-xl font-semibold text-gray-900">Booking Details</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Booking Date *
              </label>
              <input
                type="date"
                name="bookingDate"
                value={form.bookingDate}
                onChange={handleInputChange}
                required
                className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-transparent`}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Booking Time *
              </label>
              <input
                type="time"
                name="bookingTime"
                value={form.bookingTime}
                onChange={handleInputChange}
                required
                className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-transparent`}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Participants *
              </label>
              <input
                type="number"
                name="participants"
                value={form.participants}
                onChange={handleInputChange}
                min="1"
                max={pkg?.max_participants}
                required
                className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-transparent`}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Booking Status *
              </label>
              <select
                name="status"
                value={form.status}
                onChange={handleInputChange}
                className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-transparent`}
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

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-2 mb-4">
            <DollarSign className={`h-5 w-5 text-${fullColor}`} />
            <h2 className="text-xl font-semibold text-gray-900">Payment Information</h2>
          </div>
          
          <div className="mb-4 p-4 bg-blue-50 rounded-lg">
            <div className="flex justify-between items-center">
              <span className="text-lg font-semibold text-gray-900">Total Amount:</span>
              <span className="text-2xl font-bold text-blue-600">${calculateTotal().toFixed(2)}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Payment Method *
              </label>
              <select
                name="paymentMethod"
                value={form.paymentMethod}
                onChange={handleInputChange}
                className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-transparent`}
              >
                <option value="cash">Cash</option>
                <option value="card">Card</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Payment Status *
              </label>
              <select
                name="paymentStatus"
                value={form.paymentStatus}
                onChange={handleInputChange}
                className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-transparent`}
              >
                <option value="paid">Paid</option>
                <option value="partial">Partial</option>
                <option value="pending">Pending</option>
              </select>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Additional Notes</h2>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notes
            </label>
            <textarea
              name="notes"
              value={form.notes}
              onChange={handleInputChange}
              rows={4}
              className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-transparent`}
              placeholder="Add any additional notes about this booking..."
            />
          </div>
        </div>

        <div className="flex gap-4 justify-end">
          <button
            type="button"
            onClick={() => navigate('/bookings')}
            disabled={loading}
            className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading || !form.packageId}
            className={`px-6 py-3 bg-${fullColor} text-white rounded-lg hover:bg-${themeColor}-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2`}
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                Creating...
              </>
            ) : (
              <>
                <Save className="h-5 w-5" />
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
