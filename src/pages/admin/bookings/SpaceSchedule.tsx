import { useState, useEffect, useCallback } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Clock, Users, Package as PackageIcon } from 'lucide-react';
import { useThemeColor } from '../../../hooks/useThemeColor';
import bookingService from '../../../services/bookingService';
import { roomService } from '../../../services/RoomService';
import type { Booking } from '../../../services/bookingService';
import type { Room } from '../../../services/RoomService';

interface TimeSlot {
  time: string;
  hour: number;
  minute: number;
}

interface BookingCell {
  booking: Booking;
  rowSpan: number;
}

const SpaceSchedule = () => {
  const { themeColor, fullColor } = useThemeColor();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [spaces, setSpaces] = useState<Room[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [timeInterval, setTimeInterval] = useState(15);

  // Generate time slots based on package time interval
  const generateTimeSlots = (interval: number = 15): TimeSlot[] => {
    const slots: TimeSlot[] = [];
    const startHour = 12; // 12 PM
    const endHour = 22; // 10 PM
    
    for (let hour = startHour; hour <= endHour; hour++) {
      for (let minute = 0; minute < 60; minute += interval) {
        if (hour === endHour && minute > 0) break; // Stop at 10:00 PM
        
        const displayHour = hour > 12 ? hour - 12 : hour;
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const timeString = `${displayHour}:${minute.toString().padStart(2, '0')} ${ampm}`;
        
        slots.push({
          time: timeString,
          hour,
          minute
        });
      }
    }
    return slots;
  };

  const timeSlots = generateTimeSlots(timeInterval);

  // Format time to 12-hour format
  const formatTime12Hour = (time: string): string => {
    const [hourStr, minuteStr] = time.split(':');
    let hour = parseInt(hourStr);
    const minute = minuteStr || '00';
    const ampm = hour >= 12 ? 'PM' : 'AM';
    hour = hour % 12 || 12;
    return `${hour}:${minute} ${ampm}`;
  };

  // Calculate end time based on start time and duration
  const calculateEndTime = (startTime: string, duration: number, unit: 'hours' | 'minutes'): string => {
    const [hourStr, minuteStr] = startTime.split(':');
    let hour = parseInt(hourStr);
    let minute = parseInt(minuteStr);
    
    const durationInMinutes = unit === 'hours' ? duration * 60 : duration;
    
    minute += durationInMinutes;
    hour += Math.floor(minute / 60);
    minute = minute % 60;
    hour = hour % 24;
    
    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  };

  // Format duration based on unit
  const formatDuration = (duration: number, unit: 'hours' | 'minutes'): string => {
    if (unit === 'hours') {
      return duration === 1 ? '1 hour' : `${duration} hours`;
    }
    // Convert minutes to hours if >= 60 minutes
    if (duration >= 60) {
      const hours = Math.floor(duration / 60);
      const mins = duration % 60;
      if (mins === 0) {
        return hours === 1 ? '1 hour' : `${hours} hours`;
      }
      return `${hours}h ${mins}m`;
    }
    return `${duration} min`;
  };

  // Filter time slots to only show rows with bookings
  const getVisibleTimeSlots = (): TimeSlot[] => {
    return timeSlots.filter(slot => {
      // Check if any space has a booking at this time or continuing through this time
      return spaces.some(space => {
        const cellData = getBookingForCell(space, slot);
        return cellData !== null;
      });
    });
  };

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      
      // Fetch spaces
      const spacesResponse = await roomService.getRooms();
      setSpaces(Array.isArray(spacesResponse.data) ? spacesResponse.data : spacesResponse.data.rooms || []);

      // Format date as YYYY-MM-DD for booking_date filter
      const year = selectedDate.getFullYear();
      const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const day = String(selectedDate.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;

      const bookingsResponse = await bookingService.getBookings({
        booking_date: dateStr
      });
      
      const fetchedBookings = bookingsResponse.data.bookings || [];
      console.log('Fetched bookings for Space Schedule:', dateStr, fetchedBookings);
      setBookings(fetchedBookings);

      // Extract time interval from the first booking's package
      if (fetchedBookings.length > 0 && fetchedBookings[0].package) {
        const packageInterval = fetchedBookings[0].package.time_slot_interval;
        if (packageInterval && packageInterval > 0) {
          setTimeInterval(packageInterval);
        }
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  // Fetch spaces and bookings
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Navigate dates
  const goToPreviousDay = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() - 1);
    setSelectedDate(newDate);
  };

  const goToNextDay = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + 1);
    setSelectedDate(newDate);
  };

  const goToToday = () => {
    setSelectedDate(new Date());
  };

  // Check if a booking occupies a specific time slot for a space
  const getBookingForCell = (space: Room, slot: TimeSlot): BookingCell | null => {
    const spaceBookings = bookings.filter(b => 
      b.room_id === space.id && 
      (b.status === 'confirmed' || b.status === 'checked-in' || b.status === 'pending')
    );

    for (const booking of spaceBookings) {
      // Parse booking time (format: "HH:mm" or "HH:mm:ss")
      const [bookingHour, bookingMinute] = booking.booking_time.split(':').map(Number);
      
      // Check if this slot matches the booking start time
      if (bookingHour === slot.hour && bookingMinute === slot.minute) {
        // Calculate duration in minutes
        const durationInMinutes = booking.duration_unit === 'hours' 
          ? booking.duration * 60 
          : booking.duration;
        // Use the booking's package interval if available, otherwise use state interval
        const interval = booking.package?.time_slot_interval || timeInterval;
        const durationInSlots = Math.ceil(durationInMinutes / interval);
        return {
          booking,
          rowSpan: durationInSlots
        };
      }

      // Check if booking continues through this slot (but don't render it)
      // Calculate if current slot is within the booking duration
      const bookingStartMinutes = bookingHour * 60 + bookingMinute;
      const slotMinutes = slot.hour * 60 + slot.minute;
      const durationInMinutes = booking.duration_unit === 'hours' 
        ? booking.duration * 60 
        : booking.duration;
      const bookingEndMinutes = bookingStartMinutes + durationInMinutes;
      
      if (slotMinutes > bookingStartMinutes && slotMinutes < bookingEndMinutes) {
        return { booking, rowSpan: 0 }; // Return 0 rowSpan to indicate slot is occupied but shouldn't render
      }
    }

    return null;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className={`animate-spin rounded-full h-12 w-12 border-b-2 border-${fullColor}`}></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Space Schedule</h1>
        <p className="text-gray-600">Daily space allocation and booking timeline</p>
      </div>

      {/* Date Navigation */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={goToPreviousDay}
              className="p-2 hover:bg-gray-100 rounded-lg transition"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            
            <div className="flex items-center gap-2">
              <Calendar className={`w-5 h-5 text-${fullColor}`} />
              <h2 className="text-xl font-semibold text-gray-900">
                {selectedDate.toLocaleDateString('en-US', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </h2>
            </div>

            <button
              onClick={goToNextDay}
              className="p-2 hover:bg-gray-100 rounded-lg transition"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          <button
            onClick={goToToday}
            className={`px-4 py-2 bg-${fullColor} text-white rounded-lg hover:opacity-90 transition font-medium`}
          >
            Today
          </button>
        </div>
      </div>

      {/* Schedule Grid */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        {bookings.length === 0 ? (
          // Empty State
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <div className={`w-20 h-20 rounded-full bg-${themeColor}-100 flex items-center justify-center mb-4`}>
              <Calendar className={`w-10 h-10 text-${fullColor}`} />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Bookings Found</h3>
            <p className="text-gray-600 text-center max-w-md">
              There are no bookings scheduled for {selectedDate.toLocaleDateString('en-US', { 
                month: 'long', 
                day: 'numeric',
                year: 'numeric'
              })}. The schedule will appear here once bookings are made.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b-2 border-gray-200">
                  <th className="sticky left-0 bg-gray-50 z-10 px-4 py-3 text-left text-sm font-semibold text-gray-700 border-r border-gray-200 w-24">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      Time
                    </div>
                  </th>
                  {spaces.length === 0 ? (
                    <th className="px-4 py-3 text-center text-gray-500" colSpan={100}>
                      No spaces available
                    </th>
                  ) : (
                    spaces.map(space => (
                      <th 
                        key={space.id} 
                        className="px-4 py-3 text-center text-sm font-semibold text-gray-700 border-r border-gray-200 min-w-[200px]"
                      >
                        <div className="flex flex-col items-center gap-1">
                          <span>{space.name}</span>
                          <span className="text-xs font-normal text-gray-500 flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            Max {space.capacity}
                          </span>
                        </div>
                      </th>
                    ))
                  )}
                </tr>
              </thead>
              <tbody>
                {getVisibleTimeSlots().map((slot, index) => (
                <tr key={index} className="border-b border-gray-100 hover:bg-gray-50" style={{ height: '60px' }}>
                  <td className="sticky left-0 bg-white z-10 px-4 py-2 text-sm text-gray-600 border-r border-gray-200 font-medium" style={{ height: '60px' }}>
                    {slot.time}
                  </td>
                  {spaces.map(space => {
                    const cellData = getBookingForCell(space, slot);
                    
                    // Skip if this slot is occupied by a booking that started earlier
                    if (cellData && cellData.rowSpan === 0) {
                      return null;
                    }

                    // Render booking cell
                    if (cellData && cellData.rowSpan > 0) {
                      const { booking, rowSpan } = cellData;
                      const totalAmount = parseFloat(String(booking.total_amount));
                      
                      // Get color based on status
                      const getBgColor = () => {
                        switch (booking.status) {
                          case 'confirmed': return 'bg-green-100';
                          case 'pending': return 'bg-yellow-100';
                          case 'checked-in': return 'bg-blue-100';
                          case 'cancelled': return 'bg-red-100';
                          default: return 'bg-gray-100';
                        }
                      };
                      
                      return (
                        <td
                          key={space.id}
                          rowSpan={rowSpan}
                          className={`px-2 py-2 border-r border-gray-200 cursor-pointer hover:bg-gray-50 transition ${getBgColor()}`}
                          style={{ verticalAlign: 'top' }}
                          onClick={() => setSelectedBooking(booking)}
                        >
                          <div className="h-full min-h-full flex flex-col p-2">
                            {/* Time Range */}
                            <div className="font-bold text-sm text-gray-900 mb-2">
                              {formatTime12Hour(booking.booking_time)} - {formatTime12Hour(calculateEndTime(booking.booking_time, booking.duration, booking.duration_unit))}
                            </div>

                            {/* Customer Name */}
                            <div className="font-semibold text-sm text-gray-900 mb-1 line-clamp-1">
                              {booking.guest_name || 'Walk-in'}
                            </div>

                            {/* Package */}
                            <div className="text-xs text-gray-700 mb-1 line-clamp-1">
                              {booking.package?.name || 'N/A'}
                            </div>

                            {/* Guests */}
                            <div className="text-xs text-gray-600 mb-2">
                              {booking.participants} {booking.participants === 1 ? 'guest' : 'guests'}
                            </div>

                            {/* Payment & Status */}
                            <div className="mt-auto pt-2 border-t border-gray-300 flex items-center justify-between text-xs">
                              <span className={`font-semibold ${
                                booking.payment_status === 'paid' ? 'text-green-700' :
                                booking.payment_status === 'partial' ? 'text-yellow-700' :
                                'text-red-700'
                              }`}>
                                ${totalAmount.toFixed(2)}
                              </span>
                              <span className="text-gray-600 capitalize">
                                {booking.status}
                              </span>
                            </div>
                          </div>
                        </td>
                      );
                    }

                    // Empty cell
                    return (
                      <td
                        key={space.id}
                        className="px-2 py-2 border-r border-gray-200 text-center text-gray-400 text-xs hover:bg-blue-50 cursor-pointer transition"
                        style={{ height: '60px' }}
                      >
                        —
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        )}
      </div>

      {/* Booking Details Modal */}
      {selectedBooking && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-backdrop-fade" onClick={() => setSelectedBooking(null)}>
          <div className="bg-white rounded-lg shadow-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-semibold text-gray-900">Booking Details</h3>
                <button
                  onClick={() => setSelectedBooking(null)}
                  className="text-gray-500 hover:text-gray-800"
                >
                  <span className="text-2xl leading-none">&times;</span>
                </button>
              </div>

              {/* Customer Information */}
              <div className="mb-6">
                <h4 className="text-sm font-semibold text-gray-700 uppercase mb-3">Customer Information</h4>
                <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                  <div className="flex items-center">
                    <Users className="h-4 w-4 text-gray-400 mr-3" />
                    <span className="font-medium text-gray-900">{selectedBooking.guest_name || 'Guest'}</span>
                  </div>
                  {selectedBooking.guest_email && (
                    <div className="text-sm text-gray-600 ml-7">{selectedBooking.guest_email}</div>
                  )}
                  {selectedBooking.guest_phone && (
                    <div className="text-sm text-gray-600 ml-7">{selectedBooking.guest_phone}</div>
                  )}
                </div>
              </div>

              {/* Booking Information */}
              <div className="mb-6">
                <h4 className="text-sm font-semibold text-gray-700 uppercase mb-3">Booking Information</h4>
                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Reference Number</span>
                    <span className="font-mono font-medium text-gray-900">#{selectedBooking.reference_number}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Status</span>
                    <span className={`px-3 py-1 text-xs font-medium rounded-full ${
                      selectedBooking.status === 'confirmed' ? 'bg-green-100 text-green-800' :
                      selectedBooking.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                      selectedBooking.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                      selectedBooking.status === 'checked-in' ? `bg-${themeColor}-100 text-${fullColor}` :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {selectedBooking.status}
                    </span>
                  </div>
                </div>
              </div>

              {/* Date & Time */}
              <div className="mb-6">
                <h4 className="text-sm font-semibold text-gray-700 uppercase mb-3">Date & Time</h4>
                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  <div className="flex items-center">
                    <Calendar className="h-4 w-4 text-gray-400 mr-3" />
                    <span className="text-sm text-gray-900">{new Date(selectedBooking.booking_date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                  </div>
                  <div className="flex items-center">
                    <Clock className="h-4 w-4 text-gray-400 mr-3" />
                    <span className="text-sm font-medium text-gray-900">
                      {formatTime12Hour(selectedBooking.booking_time)} - {formatTime12Hour(calculateEndTime(selectedBooking.booking_time, selectedBooking.duration, selectedBooking.duration_unit))}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                    <span className="text-sm text-gray-600">Duration</span>
                    <span className="text-sm font-medium text-gray-900">{formatDuration(selectedBooking.duration, selectedBooking.duration_unit)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Participants</span>
                    <span className="text-sm font-medium text-gray-900">{selectedBooking.participants}</span>
                  </div>
                </div>
              </div>

              {/* Package Details */}
              <div className="mb-6">
                <h4 className="text-sm font-semibold text-gray-700 uppercase mb-3">Package</h4>
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <PackageIcon className="h-4 w-4 text-gray-400 mr-3" />
                      <span className="font-medium text-gray-900">{selectedBooking.package?.name || 'N/A'}</span>
                    </div>
                    {selectedBooking.package?.price && (
                      <span className="text-sm font-medium text-gray-900">${Number(selectedBooking.package.price).toFixed(2)}</span>
                    )}
                  </div>
                  {selectedBooking.package?.description && (
                    <p className="text-sm text-gray-600 mt-2 ml-7">{selectedBooking.package.description}</p>
                  )}
                </div>
              </div>

              {/* Special Requests & Notes */}
              {(selectedBooking.special_requests || selectedBooking.notes) && (
                <div className="mb-6">
                  <h4 className="text-sm font-semibold text-gray-700 uppercase mb-3">Notes & Requests</h4>
                  <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                    {selectedBooking.special_requests && (
                      <div>
                        <span className="text-xs font-medium text-gray-600 uppercase">Special Requests</span>
                        <p className="text-sm text-gray-900 mt-1">{selectedBooking.special_requests}</p>
                      </div>
                    )}
                    {selectedBooking.notes && (
                      <div className={selectedBooking.special_requests ? 'pt-3 border-t border-gray-200' : ''}>
                        <span className="text-xs font-medium text-gray-600 uppercase">Internal Notes</span>
                        <p className="text-sm text-gray-900 mt-1">{selectedBooking.notes}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Payment Information */}
              <div className="border-t pt-6">
                <h4 className="text-sm font-semibold text-gray-700 uppercase mb-3">Payment Details</h4>
                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Payment Method</span>
                    <span className="text-sm font-medium text-gray-900 capitalize">{selectedBooking.payment_method || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Payment Status</span>
                    <span className={`px-3 py-1 text-xs font-medium rounded-full ${
                      selectedBooking.payment_status === 'paid' ? 'bg-green-100 text-green-800' :
                      selectedBooking.payment_status === 'partial' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {selectedBooking.payment_status}
                    </span>
                  </div>
                  <div className="pt-3 border-t border-gray-200">
                    <div className="flex justify-between items-center text-base">
                      <span className="font-medium text-gray-900">Total Amount</span>
                      <span className="font-semibold text-gray-900 text-lg">${parseFloat(String(selectedBooking.total_amount)).toFixed(2)}</span>
                    </div>
                    {selectedBooking.payment_status === 'partial' && (
                      <div className="flex justify-between items-center mt-2 text-sm">
                        <span className="text-gray-600">Amount Paid</span>
                        <span className="text-gray-900">${parseFloat(String(selectedBooking.amount_paid)).toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Footer Buttons */}
              <div className="mt-6 pt-4 border-t border-gray-200">
                <button
                  onClick={() => setSelectedBooking(null)}
                  className="w-full px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium rounded-lg transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SpaceSchedule;
