import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Calendar, Users, DollarSign, Package, Clock, Mail, Phone, User, Home, AlertCircle, ArrowLeft, Bell, BellOff } from 'lucide-react';
import StandardButton from '../../../components/ui/StandardButton';
import { useThemeColor } from '../../../hooks/useThemeColor';
import bookingService, { type Booking } from '../../../services/bookingService';
import packageService from '../../../services/PackageService';
import type { Package as PackageType } from '../../../services/PackageService';

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
  const [originalAmountPaid, setOriginalAmountPaid] = useState<number>(0);
  const [formData, setFormData] = useState({
    customerName: '',
    email: '',
    phone: '',
    date: '',
    time: '',
    participants: 0,
    status: 'pending' as 'pending' | 'confirmed' | 'checked-in' | 'completed' | 'cancelled',
    roomId: null as number | null,
    notes: '',
    internalNotes: '',
    sendNotification: true,
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
        
        if (referenceNumber) {
          const response = await bookingService.getBookings({ reference_number: referenceNumber });
          if (response.success && response.data && response.data.bookings.length > 0) {
            bookingData = response.data.bookings[0];
          }
        } else if (id) {
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
        setOriginalAmountPaid(Number(bookingData.amount_paid || 0));

        if (bookingData.package_id) {
          const packageResponse = await packageService.getPackage(bookingData.package_id);
          if (packageResponse.success && packageResponse.data) {
            setPackageDetails(packageResponse.data);
          }
        }

        setFormData({
          customerName: bookingData.guest_name || '',
          email: bookingData.guest_email || '',
          phone: bookingData.guest_phone || '',
          date: bookingData.booking_date.split('T')[0],
          time: bookingData.booking_time,
          participants: bookingData.participants,
          status: bookingData.status,
          roomId: bookingData.room_id || null,
          notes: bookingData.notes || '',
          internalNotes: bookingData.internal_notes || '',
          sendNotification: true,
          guestOfHonorName: bookingData.guest_of_honor_name || '',
          guestOfHonorAge: bookingData.guest_of_honor_age ? String(bookingData.guest_of_honor_age) : '',
          guestOfHonorGender: bookingData.guest_of_honor_gender || '',
        });

      } catch (error) {
        console.error('Error loading booking:', error);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };

    loadBookingAndPackage();
  }, [id, referenceNumber]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'participants' || name === 'roomId' ? Number(value) : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!originalBooking) {
      alert('Booking data not found');
      return;
    }

    setSubmitting(true);

    try {
      const response = await bookingService.updateBooking(Number(originalBooking.id), {
        guest_name: formData.customerName,
        guest_email: formData.email,
        guest_phone: formData.phone,
        booking_date: formData.date,
        booking_time: formData.time,
        participants: formData.participants,
        status: formData.status,
        notes: formData.notes || undefined,
        internal_notes: formData.internalNotes || undefined,
        send_notification: formData.sendNotification,
        room_id: formData.roomId || undefined,
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

  // Status badge colors
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'checked-in': return `bg-${themeColor}-100 text-${fullColor}`;
      case 'completed': return 'bg-blue-100 text-blue-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className={`animate-spin rounded-full h-10 w-10 border-b-2 border-${fullColor}`}></div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-3" />
          <h1 className="text-xl font-bold text-gray-800 mb-2">Booking Not Found</h1>
          <p className="text-gray-500 text-sm mb-4">The booking you're looking for doesn't exist.</p>
          <StandardButton variant="primary" size="sm" onClick={() => navigate('/bookings')}>
            Back to Bookings
          </StandardButton>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-6 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => navigate('/bookings')}
            className="flex items-center gap-2 text-gray-500 hover:text-gray-700 text-sm mb-3"
          >
            <ArrowLeft size={16} />
            Back to Bookings
          </button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Edit Booking</h1>
              <p className="text-sm text-gray-500 mt-1">
                Reference: <span className="font-medium text-gray-700">{originalBooking?.reference_number}</span>
              </p>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(formData.status)}`}>
              {formData.status.charAt(0).toUpperCase() + formData.status.slice(1).replace('-', ' ')}
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Package Info Card */}
          {packageDetails && (
            <div className={`bg-${themeColor}-50 border border-${themeColor}-100 rounded-lg p-4`}>
              <div className="flex items-center gap-3">
                <div className={`p-2 bg-${themeColor}-100 rounded-lg`}>
                  <Package size={18} className={`text-${fullColor}`} />
                </div>
                <div>
                  <p className="font-medium text-gray-900">{packageDetails.name}</p>
                  <p className="text-xs text-gray-500">Package • ${Number(packageDetails.price).toFixed(2)}</p>
                </div>
              </div>
            </div>
          )}

          {/* Customer Information */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <User size={16} className="text-gray-400" />
              Customer Information
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Full Name *</label>
                <input
                  type="text"
                  name="customerName"
                  required
                  value={formData.customerName}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1 flex items-center gap-1">
                  <Mail size={12} /> Email *
                </label>
                <input
                  type="email"
                  name="email"
                  required
                  value={formData.email}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1 flex items-center gap-1">
                  <Phone size={12} /> Phone *
                </label>
                <input
                  type="tel"
                  name="phone"
                  required
                  value={formData.phone}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* Booking Details */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <Calendar size={16} className="text-gray-400" />
              Booking Details
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Date *</label>
                <input
                  type="date"
                  name="date"
                  required
                  value={formData.date}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1 flex items-center gap-1">
                  <Clock size={12} /> Time *
                </label>
                <input
                  type="time"
                  name="time"
                  required
                  value={formData.time}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1 flex items-center gap-1">
                  <Users size={12} /> Participants *
                </label>
                <input
                  type="number"
                  name="participants"
                  min="1"
                  required
                  value={formData.participants}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Status *</label>
                <select
                  name="status"
                  required
                  value={formData.status}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="pending">Pending</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="checked-in">Checked In</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>

            {/* Room Selection */}
            {packageDetails?.rooms && packageDetails.rooms.length > 0 && (
              <div className="mt-3">
                <label className="block text-xs font-medium text-gray-600 mb-1 flex items-center gap-1">
                  <Home size={12} /> Room
                </label>
                <select
                  name="roomId"
                  value={formData.roomId || ''}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select a room</option>
                  {packageDetails.rooms.map((room) => {
                    const roomData = room as {id: number; name: string};
                    return (
                      <option key={roomData.id} value={roomData.id}>{roomData.name}</option>
                    );
                  })}
                </select>
              </div>
            )}
          </div>

          {/* Guest of Honor */}
          {packageDetails?.has_guest_of_honor && (
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">Guest of Honor</h2>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
                  <input
                    type="text"
                    name="guestOfHonorName"
                    value={formData.guestOfHonorName}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Name"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Age</label>
                  <input
                    type="number"
                    name="guestOfHonorAge"
                    value={formData.guestOfHonorAge}
                    onChange={handleInputChange}
                    min="0"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Gender</label>
                  <select
                    name="guestOfHonorGender"
                    value={formData.guestOfHonorGender}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Select</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Customer Notes</h2>
            <textarea
              name="notes"
              rows={2}
              value={formData.notes}
              onChange={handleInputChange}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              placeholder="Special requests or notes from the customer..."
            />
          </div>

          {/* Internal Staff Notes */}
          <div className="bg-amber-50 rounded-lg border border-amber-200 p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle size={14} className="text-amber-600" />
              <h2 className="text-sm font-semibold text-gray-700">Internal Staff Notes</h2>
              <span className="text-[10px] text-amber-700 font-medium bg-amber-100 px-1.5 py-0.5 rounded">Staff Only</span>
            </div>
            <p className="text-xs text-gray-500 mb-2">Private notes visible only to staff. Never shown to customers.</p>
            <textarea
              name="internalNotes"
              rows={2}
              value={formData.internalNotes}
              onChange={handleInputChange}
              className="w-full px-3 py-2 text-sm border border-amber-200 rounded-lg focus:ring-2 focus:ring-amber-400 focus:border-transparent resize-none bg-white"
              placeholder="e.g., VIP customer, dietary restrictions, special arrangements..."
            />
          </div>

          {/* Email Notification Toggle */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {formData.sendNotification ? (
                  <div className="p-2 bg-green-100 rounded-lg">
                    <Bell size={16} className="text-green-600" />
                  </div>
                ) : (
                  <div className="p-2 bg-gray-100 rounded-lg">
                    <BellOff size={16} className="text-gray-400" />
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium text-gray-800">Email Notification</p>
                  <p className="text-xs text-gray-500">
                    {formData.sendNotification 
                      ? 'Customer will receive an update email' 
                      : 'No email will be sent to customer'}
                  </p>
                </div>
              </div>
              <div className="flex items-center">
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, sendNotification: false }))}
                  className={`px-3 py-1.5 text-xs font-medium rounded-l-lg border transition-colors ${
                    !formData.sendNotification 
                      ? 'bg-gray-700 text-white border-gray-700' 
                      : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  Don't Send
                </button>
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, sendNotification: true }))}
                  className={`px-3 py-1.5 text-xs font-medium rounded-r-lg border-t border-r border-b transition-colors ${
                    formData.sendNotification 
                      ? 'bg-green-600 text-white border-green-600' 
                      : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  Send Email
                </button>
              </div>
            </div>
          </div>

          {/* Payment Summary (Read-only) */}
          <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
            <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <DollarSign size={16} className="text-gray-400" />
              Payment Summary
            </h2>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500">Total Amount</p>
                <p className="text-lg font-bold text-gray-900">${Number(originalBooking?.total_amount || 0).toFixed(2)}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500">Amount Paid</p>
                <p className="text-lg font-bold text-green-600">${originalAmountPaid.toFixed(2)}</p>
              </div>
              {Number(originalBooking?.total_amount || 0) > originalAmountPaid && (
                <div className="text-right">
                  <p className="text-xs text-gray-500">Balance Due</p>
                  <p className="text-lg font-bold text-red-600">
                    ${(Number(originalBooking?.total_amount || 0) - originalAmountPaid).toFixed(2)}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
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
              {submitting ? 'Saving...' : 'Save Changes'}
            </StandardButton>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditBooking;
