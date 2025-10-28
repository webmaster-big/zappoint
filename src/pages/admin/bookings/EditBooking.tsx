import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Calendar, Users, DollarSign, Package, Clock, Mail, Phone, User } from 'lucide-react';
import { useThemeColor } from '../../../hooks/useThemeColor';
import type { BookingsPageBooking } from '../../../types/Bookings.types';

const EditBooking: React.FC = () => {
  const { themeColor, fullColor } = useThemeColor();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [formData, setFormData] = useState<BookingsPageBooking>({
    id: '',
    type: 'package',
    packageName: '',
    customerName: '',
    email: '',
    phone: '',
    date: '',
    time: '',
    participants: 0,
    status: 'pending',
    totalAmount: 0,
    createdAt: '',
    paymentMethod: 'credit_card',
    attractions: [],
    addOns: [],
    duration: '',
    activity: ''
  });

  // Load booking data
  useEffect(() => {
    if (!id) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    try {
      const storedBookings = localStorage.getItem('zapzone_bookings');
      if (storedBookings) {
        const bookings: BookingsPageBooking[] = JSON.parse(storedBookings);
        const booking = bookings.find((b) => b.id === id);
        
        if (booking) {
          setFormData(booking);
        } else {
          setNotFound(true);
        }
      } else {
        setNotFound(true);
      }
    } catch (error) {
      console.error('Error loading booking:', error);
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [id]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'participants' || name === 'totalAmount' ? Number(value) : value
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const storedBookings = localStorage.getItem('zapzone_bookings');
      if (!storedBookings) {
        alert('No bookings found');
        return;
      }

      const bookings: BookingsPageBooking[] = JSON.parse(storedBookings);
      const bookingIndex = bookings.findIndex((b) => b.id === id);

      if (bookingIndex === -1) {
        alert('Booking not found');
        return;
      }

      // Update the booking
      bookings[bookingIndex] = {
        ...formData,
        id: id || formData.id
      };

      localStorage.setItem('zapzone_bookings', JSON.stringify(bookings));

      alert('Booking updated successfully!');
      navigate('/bookings');
    } catch (error) {
      console.error('Error updating booking:', error);
      alert('Failed to update booking. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className={`animate-spin rounded-full h-12 w-12 border-b-2 border-${fullColor}`}></div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-800 mb-4">Booking Not Found</h1>
          <p className="text-gray-600 mb-6">The booking you're looking for doesn't exist.</p>
          <button
            onClick={() => navigate('/bookings')}
            className={`px-6 py-2 bg-${fullColor} text-white rounded-lg hover:bg-${themeColor}-900`}
          >
            Back to Bookings
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-lg overflow-hidden">
          {/* Header */}
          <div className="p-6 border-b border-gray-100">
            <div className="text-center mb-6">
              <h1 className="text-3xl font-bold text-gray-800">Edit Booking</h1>
              <p className="mt-2 text-gray-600">
                Update booking details and information
              </p>
            </div>
          </div>

          {/* Customer Information Section */}
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
                  className={`w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-transparent transition-colors`}
                  placeholder="John Doe"
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
                  className={`w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-transparent transition-colors`}
                  placeholder="john@example.com"
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
                  className={`w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-transparent transition-colors`}
                  placeholder="555-1234"
                />
              </div>
            </div>
          </div>

          {/* Booking Details Section */}
          <div className="p-6 border-b border-gray-100">
            <h2 className="text-xl font-semibold text-gray-800 mb-6 pb-2 border-b border-gray-100 flex items-center gap-2">
              <Package size={20} />
              Booking Details
            </h2>
            
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label htmlFor="packageName" className="block text-sm font-medium text-gray-800 mb-2">
                  Package Name *
                </label>
                <input
                  type="text"
                  name="packageName"
                  id="packageName"
                  required
                  value={formData.packageName}
                  onChange={handleInputChange}
                  className={`w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-transparent transition-colors`}
                  placeholder="Family Fun Package"
                />
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="activity" className="block text-sm font-medium text-gray-800 mb-2">
                  Activity Type
                </label>
                <input
                  type="text"
                  name="activity"
                  id="activity"
                  value={formData.activity}
                  onChange={handleInputChange}
                  className={`w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-transparent transition-colors`}
                  placeholder="Family Entertainment"
                />
              </div>

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
                  className={`w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-transparent transition-colors`}
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
                  className={`w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-transparent transition-colors`}
                />
              </div>

              <div>
                <label htmlFor="duration" className="block text-sm font-medium text-gray-800 mb-2">
                  Duration
                </label>
                <input
                  type="text"
                  name="duration"
                  id="duration"
                  value={formData.duration}
                  onChange={handleInputChange}
                  className={`w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-transparent transition-colors`}
                  placeholder="2 hours"
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
                  className={`w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-transparent transition-colors`}
                  placeholder="4"
                />
              </div>
            </div>
          </div>

          {/* Payment & Status Section */}
          <div className="p-6 border-b border-gray-100">
            <h2 className="text-xl font-semibold text-gray-800 mb-6 pb-2 border-b border-gray-100 flex items-center gap-2">
              <DollarSign size={20} />
              Payment & Status
            </h2>
            
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
              <div>
                <label htmlFor="totalAmount" className="block text-sm font-medium text-gray-800 mb-2">
                  Total Amount *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-gray-500">$</span>
                  </div>
                  <input
                    type="number"
                    name="totalAmount"
                    id="totalAmount"
                    min="0"
                    step="0.01"
                    required
                    value={formData.totalAmount}
                    onChange={handleInputChange}
                    className={`w-full pl-8 px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-transparent transition-colors`}
                    placeholder="0.00"
                  />
                </div>
              </div>

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
                  className={`w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-transparent transition-colors`}
                >
                  <option value="credit_card">Credit Card</option>
                  <option value="paypal">PayPal</option>
                  <option value="cash">Cash</option>
                  <option value="e-wallet">E-Wallet</option>
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
                  className={`w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-transparent transition-colors`}
                >
                  <option value="pending">Pending</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="checked-in">Checked In</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>
          </div>

          {/* Additional Information Section */}
          <div className="p-6 border-b border-gray-100">
            <h2 className="text-xl font-semibold text-gray-800 mb-6 pb-2 border-b border-gray-100">
              Additional Information
            </h2>
            
            <div className="space-y-4">
              {/* Attractions */}
              {formData.attractions && formData.attractions.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-800 mb-2">
                    Included Attractions
                  </label>
                  <div className="bg-gray-50 rounded-lg p-4">
                    {formData.attractions.map((attraction, index) => (
                      <div key={index} className="flex justify-between items-center py-2 border-b border-gray-200 last:border-0">
                        <span className="text-gray-800">{attraction.name}</span>
                        <span className="text-gray-600 text-sm">Qty: {attraction.quantity}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Add-ons */}
              {formData.addOns && formData.addOns.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-800 mb-2">
                    Add-ons
                  </label>
                  <div className="bg-gray-50 rounded-lg p-4">
                    {formData.addOns.map((addOn, index) => (
                      <div key={index} className="flex justify-between items-center py-2 border-b border-gray-200 last:border-0">
                        <span className="text-gray-800">{addOn.name}</span>
                        <span className="text-gray-600 text-sm">Qty: {addOn.quantity}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Booking metadata */}
              <div className={`bg-${themeColor}-50 rounded-lg p-4`}>
                <div className={`text-sm text-${themeColor}-900`}>
                  <p><strong>Booking ID:</strong> {formData.id}</p>
                  <p><strong>Created:</strong> {new Date(formData.createdAt).toLocaleString()}</p>
                  <p><strong>Type:</strong> {formData.type}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="px-6 py-5 bg-gray-50 text-right space-x-3">
            <button
              type="button"
              onClick={() => navigate('/bookings')}
              className={`px-5 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-800 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-${themeColor}-500 transition-colors`}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={`px-5 py-2.5 bg-${fullColor} border border-transparent rounded-lg shadow-sm text-sm font-medium text-white hover:bg-${themeColor}-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-${themeColor}-500 transition-all`}
            >
              Update Booking
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditBooking;
