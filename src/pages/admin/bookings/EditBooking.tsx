import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Calendar, Package, User, Home, AlertCircle, ArrowLeft, Bell, BellOff, Save } from 'lucide-react';
import StandardButton from '../../../components/ui/StandardButton';
import { useThemeColor } from '../../../hooks/useThemeColor';
import bookingService, { type Booking } from '../../../services/bookingService';
import packageService from '../../../services/PackageService';
import type { Package as PackageType } from '../../../services/PackageService';
import roomService from '../../../services/RoomService';

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
  const [availablePackages, setAvailablePackages] = useState<PackageType[]>([]);
  const [availableRooms, setAvailableRooms] = useState<Array<{id: number; name: string}>>([]);
  const [formData, setFormData] = useState({
    customerName: '',
    email: '',
    phone: '',
    date: '',
    time: '',
    participants: 0,
    status: 'pending' as 'pending' | 'confirmed' | 'checked-in' | 'completed' | 'cancelled',
    packageId: null as number | null,
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

            console.log('Loaded booking by reference number:', bookingData);
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

        // Load available packages
        const packagesResponse = await packageService.getPackages({ location_id: bookingData.location_id });
        if (packagesResponse.success && packagesResponse.data) {
          setAvailablePackages(packagesResponse.data.packages || []);
        }

        // Load all rooms from location
        const roomsResponse = await roomService.getRooms({ location_id: bookingData.location_id });
        if (roomsResponse.success && roomsResponse.data) {
          const rooms = roomsResponse.data.rooms || roomsResponse.data;
          setAvailableRooms(Array.isArray(rooms) ? rooms.map((room: any) => ({
            id: room.id,
            name: room.name
          })) : []);
        }

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
          packageId: bookingData.package_id || null,
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

  // Handle package change
  const handlePackageChange = async (packageId: number) => {
    setFormData(prev => ({ ...prev, packageId }));
    
    try {
      const packageResponse = await packageService.getPackage(packageId);
      if (packageResponse.success && packageResponse.data) {
        setPackageDetails(packageResponse.data);
      }
    } catch (error) {
      console.error('Error loading package:', error);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    if (name === 'packageId') {
      handlePackageChange(Number(value));
      return;
    }
    
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
        package_id: formData.packageId || undefined,
        room_id: formData.roomId || undefined,
        notes: formData.notes || undefined,
        internal_notes: formData.internalNotes || undefined,
        send_notification: formData.sendNotification,
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
    <div className="w-full mx-auto sm:px-4 md:mt-8 pb-6 flex flex-col md:flex-row gap-8 md:gap-12">
      {/* Form Section */}
      <div className="flex-1 mx-auto">
        <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6 md:p-8">
          <div className="flex items-center gap-3 mb-6">
            <button
              onClick={() => navigate('/bookings')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft size={24} />
            </button>
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-neutral-900 tracking-tight">Edit Booking</h2>
              <p className="text-sm text-gray-500 mt-1">
                Reference: <span className="font-medium text-gray-700">{originalBooking?.reference_number}</span>
              </p>
            </div>
            <span className={`ml-auto px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(formData.status)}`}>
              {formData.status.charAt(0).toUpperCase() + formData.status.slice(1).replace('-', ' ')}
            </span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Package Selection */}
            <div>
              <h3 className={`text-xl font-bold mb-4 text-neutral-900 flex items-center gap-2`}>
                <Package className={`w-5 h-5 text-${themeColor}-600`} /> Package / Party
              </h3>
              <div className="space-y-3">
                <select
                  name="packageId"
                  value={formData.packageId || ''}
                  onChange={handleInputChange}
                  required
                  className={`w-full rounded-md border border-gray-200 px-4 py-2 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 bg-white text-neutral-900 text-base transition-all`}
                >
                  <option value="">Select a package</option>
                  {availablePackages.map((pkg) => (
                    <option key={pkg.id} value={pkg.id}>
                      {pkg.name} - ${Number(pkg.price).toFixed(2)}
                    </option>
                  ))}
                </select>
                {packageDetails && (
                  <div className={`bg-${themeColor}-50 border border-${themeColor}-100 rounded-lg p-3`}>
                    <p className="text-sm text-gray-700">
                      <span className="font-medium">Selected:</span> {packageDetails.name} • ${Number(packageDetails.price).toFixed(2)}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Space Assignment */}
            <div>
              <h3 className={`text-xl font-bold mb-4 text-neutral-900 flex items-center gap-2`}>
                <Home className={`w-5 h-5 text-${themeColor}-600`} /> Space Assignment
              </h3>
              {availableRooms.length > 0 ? (
                <select
                  name="roomId"
                  value={formData.roomId || ''}
                  onChange={handleInputChange}
                  className={`w-full rounded-md border border-gray-200 px-4 py-2 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 bg-white text-neutral-900 text-base transition-all`}
                >
                  <option value="">Select a space</option>
                  {availableRooms.map((room) => (
                    <option key={room.id} value={room.id}>{room.name}</option>
                  ))}
                </select>
              ) : (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <p className="text-sm text-gray-600">
                    No spaces available for this location
                  </p>
                </div>
              )}
            </div>

            {/* Customer Information */}
            <div>
              <h3 className={`text-xl font-bold mb-4 text-neutral-900 flex items-center gap-2`}>
                <User className={`w-5 h-5 text-${themeColor}-600`} /> Customer Information
              </h3>
              <div className="space-y-5">
                <div>
                  <label className="block font-semibold mb-2 text-base text-neutral-800">Full Name</label>
                  <input
                    type="text"
                    name="customerName"
                    required
                    value={formData.customerName}
                    onChange={handleInputChange}
                    className={`w-full rounded-md border border-gray-200 px-4 py-2 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 bg-white text-neutral-900 text-base transition-all placeholder:text-gray-400`}
                    placeholder="Enter customer name"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-semibold mb-2 text-base text-neutral-800">
                      Email
                    </label>
                    <input
                      type="email"
                      name="email"
                      required
                      value={formData.email}
                      onChange={handleInputChange}
                      className={`w-full rounded-md border border-gray-200 px-4 py-2 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 bg-white text-neutral-900 text-base transition-all placeholder:text-gray-400`}
                      placeholder="customer@example.com"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-2 text-base text-neutral-800">
                      Phone
                    </label>
                    <input
                      type="tel"
                      name="phone"
                      required
                      value={formData.phone}
                      onChange={handleInputChange}
                      className={`w-full rounded-md border border-gray-200 px-4 py-2 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 bg-white text-neutral-900 text-base transition-all placeholder:text-gray-400`}
                      placeholder="(555) 123-4567"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Booking Details */}
            <div>
              <h3 className={`text-xl font-bold mb-4 text-neutral-900 flex items-center gap-2`}>
                <Calendar className={`w-5 h-5 text-${themeColor}-600`} /> Booking Details
              </h3>
              <div className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-semibold mb-2 text-base text-neutral-800">Date</label>
                    <input
                      type="date"
                      name="date"
                      required
                      value={formData.date}
                      onChange={handleInputChange}
                      className={`w-full rounded-md border border-gray-200 px-4 py-2 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 bg-white text-neutral-900 text-base transition-all`}
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-2 text-base text-neutral-800">
                      Time
                    </label>
                    <input
                      type="time"
                      name="time"
                      required
                      value={formData.time}
                      onChange={handleInputChange}
                      className={`w-full rounded-md border border-gray-200 px-4 py-2 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 bg-white text-neutral-900 text-base transition-all`}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-semibold mb-2 text-base text-neutral-800">
                      Participants
                    </label>
                    <input
                      type="number"
                      name="participants"
                      min="1"
                      required
                      value={formData.participants}
                      onChange={handleInputChange}
                      className={`w-full rounded-md border border-gray-200 px-4 py-2 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 bg-white text-neutral-900 text-base transition-all`}
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-2 text-base text-neutral-800">Status</label>
                    <select
                      name="status"
                      required
                      value={formData.status}
                      onChange={handleInputChange}
                      className={`w-full rounded-md border border-gray-200 px-4 py-2 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 bg-white text-neutral-900 text-base transition-all`}
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
            </div>

            {/* Guest of Honor */}
            {packageDetails?.has_guest_of_honor && (
              <div>
                <h3 className={`text-xl font-bold mb-4 text-neutral-900 flex items-center gap-2`}>
                  <User className={`w-5 h-5 text-${themeColor}-600`} /> Guest of Honor
                </h3>
                <div className="space-y-5">
                  <div>
                    <label className="block font-semibold mb-2 text-base text-neutral-800">Name</label>
                    <input
                      type="text"
                      name="guestOfHonorName"
                      value={formData.guestOfHonorName}
                      onChange={handleInputChange}
                      className={`w-full rounded-md border border-gray-200 px-4 py-2 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 bg-white text-neutral-900 text-base transition-all placeholder:text-gray-400`}
                      placeholder="Guest name"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block font-semibold mb-2 text-base text-neutral-800">Age</label>
                      <input
                        type="number"
                        name="guestOfHonorAge"
                        value={formData.guestOfHonorAge}
                        onChange={handleInputChange}
                        min="0"
                        className={`w-full rounded-md border border-gray-200 px-4 py-2 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 bg-white text-neutral-900 text-base transition-all`}
                      />
                    </div>
                    <div>
                      <label className="block font-semibold mb-2 text-base text-neutral-800">Gender</label>
                      <select
                        name="guestOfHonorGender"
                        value={formData.guestOfHonorGender}
                        onChange={handleInputChange}
                        className={`w-full rounded-md border border-gray-200 px-4 py-2 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 bg-white text-neutral-900 text-base transition-all`}
                      >
                        <option value="">Select</option>
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Notes */}
            <div>
              <h3 className={`text-xl font-bold mb-4 text-neutral-900`}>Customer Notes</h3>
              <textarea
                name="notes"
                rows={3}
                value={formData.notes}
                onChange={handleInputChange}
                className={`w-full rounded-md border border-gray-200 px-4 py-2 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 bg-white text-neutral-900 text-base transition-all placeholder:text-gray-400 resize-none`}
                placeholder="Special requests or notes from the customer..."
              />
            </div>

            {/* Internal Staff Notes */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <AlertCircle className={`w-5 h-5 text-amber-600`} />
                <h3 className="text-xl font-bold text-neutral-900">Internal Staff Notes</h3>
                <span className="text-xs text-amber-700 font-medium bg-amber-100 px-2 py-0.5 rounded">Staff Only</span>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-3">Private notes visible only to staff. Never shown to customers.</p>
                <textarea
                  name="internalNotes"
                  rows={3}
                  value={formData.internalNotes}
                  onChange={handleInputChange}
                  className={`w-full rounded-md border border-amber-200 px-4 py-2 focus:ring-2 focus:ring-amber-400 focus:border-transparent resize-none bg-white text-base placeholder:text-gray-400`}
                  placeholder="e.g., VIP customer, dietary restrictions, special arrangements..."
                />
              </div>
            </div>

            {/* Email Notification Toggle */}
            <div>
              <h3 className={`text-xl font-bold mb-4 text-neutral-900`}>Email Notification</h3>
              <div className="flex items-center justify-between bg-white border border-gray-200 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  {formData.sendNotification ? (
                    <Bell size={18} className="text-green-600" />
                  ) : (
                    <BellOff size={18} className="text-gray-400" />
                  )}
                  <span className="text-sm text-gray-700">
                    {formData.sendNotification ? 'Customer will receive update' : 'Silent update (no email)'}
                  </span>
                </div>
                <div className="flex items-center">
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, sendNotification: false }))}
                    className={`px-3 py-1 text-xs font-medium rounded-l-lg border transition-colors ${
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
                    className={`px-3 py-1 text-xs font-medium rounded-r-lg border-t border-r border-b transition-colors ${
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

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-4">
              <StandardButton
                variant="secondary"
                size="lg"
                onClick={() => navigate('/bookings')}
                disabled={submitting}
              >
                Cancel
              </StandardButton>
              <StandardButton
                variant="primary"
                size="lg"
                icon={Save}
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

      {/* Live Preview Section */}
      <div className="w-full md:w-96 md:sticky md:top-8 md:self-start">
        <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-6 md:p-8 shadow-none">
          <h2 className={`text-xl font-bold mb-4 text-${fullColor} pb-2`}>Booking Summary</h2>
          
          <div className="space-y-4">
            {/* Package Info */}
            {packageDetails && (
              <div className="pb-4 border-b border-gray-100">
                <p className="text-sm text-gray-500 mb-1">Package</p>
                <p className="font-semibold text-gray-900">{packageDetails.name}</p>
                <p className="text-sm text-gray-600 mt-1">${Number(packageDetails.price).toFixed(2)}</p>
              </div>
            )}

            {/* Space Info */}
            <div className="pb-4 border-b border-gray-100">
              <p className="text-sm text-gray-500 mb-1">Space</p>
              <p className="font-medium text-gray-900">
                {formData.roomId 
                  ? availableRooms.find(r => r.id === formData.roomId)?.name || 'Selected' 
                  : 'Not assigned'}
              </p>
            </div>

            {/* Customer */}
            <div className="pb-4 border-b border-gray-100">
              <p className="text-sm text-gray-500 mb-1">Customer</p>
              <p className="font-medium text-gray-900">{formData.customerName || 'Not specified'}</p>
              <p className="text-sm text-gray-600">{formData.email || 'No email'}</p>
              <p className="text-sm text-gray-600">{formData.phone || 'No phone'}</p>
            </div>

            {/* Date & Time */}
            <div className="pb-4 border-b border-gray-100">
              <p className="text-sm text-gray-500 mb-1">Date & Time</p>
              <p className="font-medium text-gray-900">
                {formData.date ? new Date(formData.date + 'T00:00:00').toLocaleDateString('en-US', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                }) : 'Not set'}
              </p>
              <p className="text-sm text-gray-600">
                {formData.time ? new Date(`2000-01-01T${formData.time}`).toLocaleTimeString('en-US', { 
                  hour: 'numeric', 
                  minute: '2-digit', 
                  hour12: true 
                }) : 'Not set'}
              </p>
            </div>

            {/* Participants */}
            <div className="pb-4 border-b border-gray-100">
              <p className="text-sm text-gray-500 mb-1">Participants</p>
              <p className="font-medium text-gray-900">{formData.participants || 0} people</p>
            </div>

            {/* Status */}
            <div className="pb-4 border-b border-gray-100">
              <p className="text-sm text-gray-500 mb-1">Status</p>
              <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(formData.status)}`}>
                {formData.status.charAt(0).toUpperCase() + formData.status.slice(1).replace('-', ' ')}
              </span>
            </div>

            {/* Payment Summary */}
            <div>
              <p className="text-sm text-gray-500 mb-3">Payment Breakdown</p>
              <div className="space-y-2">
                {/* Package Price */}
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Package</span>
                  <span className="font-medium text-gray-900">
                    ${packageDetails ? Number(packageDetails.price).toFixed(2) : '0.00'}
                  </span>
                </div>
                
                {/* Attractions List */}
                {originalBooking?.attractions && originalBooking.attractions.length > 0 && (
                  <div className="pt-2 border-t border-gray-100">
                    <p className="text-xs text-gray-500 mb-2">Attractions</p>
                    {originalBooking.attractions.map((attr, idx) => {
                      const price = Number(attr.pivot?.price_at_booking || 0);
                      const qty = Number(attr.pivot?.quantity || 1);
                      return (
                        <div key={idx} className="flex justify-between text-sm">
                          <span className="text-gray-600">
                            {attr.name} {qty > 1 && `×${qty}`}
                          </span>
                          <span className="text-gray-900">${(price * qty).toFixed(2)}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
                
                {/* Add-ons List */}
                {originalBooking?.add_ons && originalBooking.add_ons.length > 0 && (
                  <div className="pt-2 border-t border-gray-100">
                    <p className="text-xs text-gray-500 mb-2">Add-ons</p>
                    {originalBooking.add_ons.map((addon, idx) => {
                      const price = Number(addon.pivot?.price_at_booking || 0);
                      const qty = Number(addon.pivot?.quantity || 1);
                      return (
                        <div key={idx} className="flex justify-between text-sm">
                          <span className="text-gray-600">
                            {addon.name} {qty > 1 && `×${qty}`}
                          </span>
                          <span className="text-gray-900">${(price * qty).toFixed(2)}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
                
                {/* Calculated Totals */}
                {(() => {
                  const packagePrice = packageDetails ? Number(packageDetails.price) : 0;
                  
                  const attractionsTotal = (originalBooking?.attractions || []).reduce((sum, attr) => {
                    const price = Number(attr.pivot?.price_at_booking || 0);
                    const qty = Number(attr.pivot?.quantity || 1);
                    return sum + (price * qty);
                  }, 0);
                  
                  const addonsTotal = (originalBooking?.add_ons || []).reduce((sum, addon) => {
                    const price = Number(addon.pivot?.price_at_booking || 0);
                    const qty = Number(addon.pivot?.quantity || 1);
                    return sum + (price * qty);
                  }, 0);
                  
                  const originalTotal = Number(originalBooking?.total_amount || 0);
                  const calculatedTotal = packagePrice + attractionsTotal + addonsTotal;
                  
                  // Use calculated total if package changed, otherwise use original
                  const isPackageChanged = formData.packageId !== originalBooking?.package_id;
                  const displayTotal = isPackageChanged ? calculatedTotal : originalTotal;
                  const balance = displayTotal - originalAmountPaid;
                  
                  return (
                    <>
                      {/* Total */}
                      <div className="flex justify-between pt-3 border-t border-gray-200">
                        <span className="text-sm font-semibold text-gray-900">Total Amount</span>
                        <span className="font-bold text-gray-900">
                          ${displayTotal.toFixed(2)}
                          {isPackageChanged && (
                            <span className="text-xs text-orange-600 ml-1">(Updated)</span>
                          )}
                        </span>
                      </div>
                      
                      {/* Amount Paid */}
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Amount Paid</span>
                        <span className="font-semibold text-green-600">${originalAmountPaid.toFixed(2)}</span>
                      </div>
                      
                      {/* Balance Due */}
                      {balance > 0 && (
                        <div className="flex justify-between pt-2 border-t border-gray-100">
                          <span className="text-sm font-medium text-red-700">Balance Due</span>
                          <span className="font-bold text-red-600">${balance.toFixed(2)}</span>
                        </div>
                      )}
                      
                      {balance <= 0 && (
                        <div className="flex justify-between pt-2 border-t border-gray-100">
                          <span className="text-sm font-medium text-green-700">Payment Status</span>
                          <span className="font-bold text-green-600">Fully Paid</span>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditBooking;
