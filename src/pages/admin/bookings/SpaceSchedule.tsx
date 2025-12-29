import { useState, useEffect, useCallback } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Clock, Users, Package as PackageIcon, X, Coffee, Info } from 'lucide-react';
import { useThemeColor } from '../../../hooks/useThemeColor';
import bookingService from '../../../services/bookingService';
import { roomService, type BreakTime } from '../../../services/RoomService';
import StandardButton from '../../../components/ui/StandardButton';
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
  const calculateEndTime = (startTime: string, duration: number, unit: 'hours' | 'minutes' | 'hours and minutes'): string => {
    const [hourStr, minuteStr] = startTime.split(':');
    let hour = parseInt(hourStr);
    let minute = parseInt(minuteStr);
    
    // For 'hours and minutes', duration is a decimal (e.g., 1.75 = 1 hr 45 min)
    let durationInMinutes: number;
    if (unit === 'hours and minutes') {
      const hours = Math.floor(duration);
      const mins = Math.round((duration % 1) * 60);
      durationInMinutes = hours * 60 + mins;
    } else {
      durationInMinutes = unit === 'hours' ? duration * 60 : duration;
    }
    
    minute += durationInMinutes;
    hour += Math.floor(minute / 60);
    minute = minute % 60;
    hour = hour % 24;
    
    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  };

  // Format duration based on unit
  const formatDuration = (duration: number, unit: 'hours' | 'minutes' | 'hours and minutes'): string => {
    // Handle 'hours and minutes' unit with decimal value (e.g., 1.75 = 1 hr 45 min)
    if (unit === 'hours and minutes') {
      const hours = Math.floor(duration);
      const minutes = Math.round((duration % 1) * 60);
      if (hours > 0 && minutes > 0) return `${hours} hr ${minutes} min`;
      if (hours > 0) return `${hours} hr`;
      return `${minutes} min`;
    }
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

  // Get day name from date (e.g., 'monday', 'tuesday')
  const getDayName = (date: Date): string => {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    return days[date.getDay()];
  };

  // Check if a time slot is during a break time for a specific room
  const isBreakTime = (space: Room, slot: TimeSlot): boolean => {
    if (!space.break_time || space.break_time.length === 0) return false;
    
    const dayName = getDayName(selectedDate);
    const slotMinutes = slot.hour * 60 + slot.minute;
    
    for (const breakTime of space.break_time) {
      // Check if today is in the break time days
      if (!breakTime.days.includes(dayName)) continue;
      
      // Parse break start and end times
      const [startHour, startMinute] = breakTime.start_time.split(':').map(Number);
      const [endHour, endMinute] = breakTime.end_time.split(':').map(Number);
      const breakStartMinutes = startHour * 60 + startMinute;
      const breakEndMinutes = endHour * 60 + endMinute;
      
      // Check if slot falls within break time
      if (slotMinutes >= breakStartMinutes && slotMinutes < breakEndMinutes) {
        return true;
      }
    }
    
    return false;
  };

  // Check if this is the first slot of a break (for showing the break info)
  const isBreakTimeStart = (space: Room, slot: TimeSlot): { isStart: boolean; rowSpan: number; breakTime: BreakTime | null } => {
    if (!space.break_time || space.break_time.length === 0) {
      return { isStart: false, rowSpan: 0, breakTime: null };
    }
    
    const dayName = getDayName(selectedDate);
    const slotMinutes = slot.hour * 60 + slot.minute;
    
    for (const breakTime of space.break_time) {
      if (!breakTime.days.includes(dayName)) continue;
      
      const [startHour, startMinute] = breakTime.start_time.split(':').map(Number);
      const [endHour, endMinute] = breakTime.end_time.split(':').map(Number);
      const breakStartMinutes = startHour * 60 + startMinute;
      const breakEndMinutes = endHour * 60 + endMinute;
      
      // Check if this slot is the start of the break
      if (slotMinutes === breakStartMinutes) {
        const breakDurationMinutes = breakEndMinutes - breakStartMinutes;
        const rowSpan = Math.ceil(breakDurationMinutes / timeInterval);
        return { isStart: true, rowSpan, breakTime };
      }
    }
    
    return { isStart: false, rowSpan: 0, breakTime: null };
  };

  // Filter time slots to only show rows with bookings or breaks
  const getVisibleTimeSlots = (): TimeSlot[] => {
    return timeSlots.filter(slot => {
      // Check if any space has a booking or break at this time
      return spaces.some(space => {
        const cellData = getBookingForCell(space, slot);
        const hasBreak = isBreakTime(space, slot);
        return cellData !== null || hasBreak;
      });
    });
  };

  // Natural sort function: alphabetical first, then numerical
  const naturalSort = (a: Room, b: Room): number => {
    const nameA = a.name;
    const nameB = b.name;
    
    // Split into chunks of text and numbers
    const chunksA = nameA.match(/(\d+|\D+)/g) || [];
    const chunksB = nameB.match(/(\d+|\D+)/g) || [];
    
    const maxLength = Math.max(chunksA.length, chunksB.length);
    
    for (let i = 0; i < maxLength; i++) {
      const chunkA = chunksA[i] || '';
      const chunkB = chunksB[i] || '';
      
      // Check if both chunks are numeric
      const isNumA = /^\d+$/.test(chunkA);
      const isNumB = /^\d+$/.test(chunkB);
      
      if (isNumA && isNumB) {
        // Both are numbers, compare numerically
        const diff = parseInt(chunkA) - parseInt(chunkB);
        if (diff !== 0) return diff;
      } else {
        // At least one is text, compare as strings (case-insensitive)
        const comparison = chunkA.toLowerCase().localeCompare(chunkB.toLowerCase());
        if (comparison !== 0) return comparison;
      }
    }
    
    return 0;
  };

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      
      // Fetch spaces
      const spacesResponse = await roomService.getRooms();
      const fetchedSpaces = Array.isArray(spacesResponse.data) ? spacesResponse.data : spacesResponse.data.rooms || [];
      
      // Sort spaces: alphabetical first, then numerical
      const sortedSpaces = [...fetchedSpaces].sort(naturalSort);
      setSpaces(sortedSpaces);

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
        // Calculate duration in minutes - handle 'hours and minutes' unit with decimal value
        let durationInMinutes: number;
        if (booking.duration_unit === 'hours and minutes') {
          const hours = Math.floor(booking.duration);
          const mins = Math.round((booking.duration % 1) * 60);
          durationInMinutes = hours * 60 + mins;
        } else {
          durationInMinutes = booking.duration_unit === 'hours' 
            ? booking.duration * 60 
            : booking.duration;
        }
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
      // Handle 'hours and minutes' unit with decimal value
      let durationInMinutes: number;
      if (booking.duration_unit === 'hours and minutes') {
        const hours = Math.floor(booking.duration);
        const mins = Math.round((booking.duration % 1) * 60);
        durationInMinutes = hours * 60 + mins;
      } else {
        durationInMinutes = booking.duration_unit === 'hours' 
          ? booking.duration * 60 
          : booking.duration;
      }
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
            <StandardButton
              variant="ghost"
              size="sm"
              icon={ChevronLeft}
              onClick={goToPreviousDay}
            >
              {''}
            </StandardButton>
            
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

            <StandardButton
              variant="ghost"
              size="sm"
              icon={ChevronRight}
              onClick={goToNextDay}
            >
              {''}
            </StandardButton>
          </div>

          {/* Right Side Controls */}
          <div className="flex items-center gap-2">
            <StandardButton
              variant="primary"
              onClick={goToToday}
            >
              Today
            </StandardButton>

            {/* Legend Tooltip */}
            <div className="relative group">
              <button className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition">
                <Info className="w-5 h-5" />
              </button>
              <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 p-3 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-20">
                <div className="text-xs font-medium text-gray-700 mb-2">Legend</div>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-green-100 rounded"></div>
                    <span className="text-gray-600">Confirmed</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-yellow-100 rounded"></div>
                    <span className="text-gray-600">Pending</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-blue-100 rounded"></div>
                    <span className="text-gray-600">Checked In</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-gray-200 rounded border border-dashed border-gray-400 flex items-center justify-center">
                      <Coffee className="w-1.5 h-1.5 text-gray-500" />
                    </div>
                    <span className="text-gray-600">Break Time</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
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
                    const breakTimeData = isBreakTimeStart(space, slot);
                    const isInBreak = isBreakTime(space, slot);
                    
                    // Skip if this slot is occupied by a booking that started earlier
                    if (cellData && cellData.rowSpan === 0) {
                      return null;
                    }

                    // Skip if this slot is occupied by a break that started earlier (not the start slot)
                    if (isInBreak && !breakTimeData.isStart) {
                      return null;
                    }

                    // Render break time cell
                    if (breakTimeData.isStart && breakTimeData.breakTime) {
                      return (
                        <td
                          key={space.id}
                          rowSpan={breakTimeData.rowSpan}
                          className="px-2 py-2 border-r border-gray-200 bg-gray-100"
                          style={{ verticalAlign: 'middle' }}
                        >
                          <div className="h-full min-h-full flex flex-col items-center justify-center p-2 bg-gray-200/50 rounded-lg border-2 border-dashed border-gray-300">
                            <Coffee className="w-6 h-6 text-gray-500 mb-2" />
                            <div className="font-semibold text-sm text-gray-700">Break Time</div>
                            <div className="text-xs text-gray-500 mt-1">
                              {formatTime12Hour(breakTimeData.breakTime.start_time)} - {formatTime12Hour(breakTimeData.breakTime.end_time)}
                            </div>
                          </div>
                        </td>
                      );
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
                <StandardButton
                  variant="ghost"
                  size="sm"
                  icon={X}
                  onClick={() => setSelectedBooking(null)}
                >
                  {''}
                </StandardButton>
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

              {/* Guest of Honor Section - Only show if data exists */}
              {(selectedBooking as any).guest_of_honor_name && (
                <div className="mb-6">
                  <h4 className="text-sm font-semibold text-gray-700 uppercase mb-3">Guest of Honor</h4>
                  <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Name</span>
                      <span className="text-sm font-medium text-gray-900">{(selectedBooking as any).guest_of_honor_name}</span>
                    </div>
                    {(selectedBooking as any).guest_of_honor_age && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Age</span>
                        <span className="text-sm font-medium text-gray-900">{(selectedBooking as any).guest_of_honor_age} years old</span>
                      </div>
                    )}
                    {(selectedBooking as any).guest_of_honor_gender && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Gender</span>
                        <span className="text-sm font-medium text-gray-900 capitalize">{(selectedBooking as any).guest_of_honor_gender}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

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
                <StandardButton
                  variant="secondary"
                  onClick={() => setSelectedBooking(null)}
                  fullWidth
                >
                  Close
                </StandardButton>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SpaceSchedule;
