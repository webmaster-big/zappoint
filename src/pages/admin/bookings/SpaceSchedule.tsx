import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Clock, Users, Package as PackageIcon, X, Coffee, Info, Loader2 } from 'lucide-react';
import { useThemeColor } from '../../../hooks/useThemeColor';
import bookingService from '../../../services/bookingService';
import { bookingCacheService } from '../../../services/BookingCacheService';
import { roomService, type BreakTime } from '../../../services/RoomService';
import { roomCacheService } from '../../../services/RoomCacheService';
import { getStoredUser } from '../../../utils/storage';
import StandardButton from '../../../components/ui/StandardButton';
import { formatDurationDisplay } from '../../../utils/timeFormat';
import type { Booking } from '../../../services/bookingService';
import type { Room } from '../../../services/RoomService';

// Helper function to parse ISO date string (YYYY-MM-DD) in local timezone
// Avoids UTC offset issues that cause date to show as previous day
const parseLocalDate = (isoDateString: string): Date => {
  if (!isoDateString) return new Date();
  const [year, month, day] = isoDateString.split('T')[0].split('-').map(Number);
  return new Date(year, month - 1, day);
};

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
  const [initialLoading, setInitialLoading] = useState(true); // Only for first load
  const [bookingsLoading, setBookingsLoading] = useState(false); // For date changes
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [timeInterval, setTimeInterval] = useState(15);
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const spacesLoadedRef = useRef(false); // Track if spaces have been loaded

  // Memoize time slots to avoid regenerating on every render
  const timeSlots = useMemo(() => {
    const slots: TimeSlot[] = [];
    const startHour = 12; // 12 PM
    const endHour = 22; // 10 PM
    
    for (let hour = startHour; hour <= endHour; hour++) {
      for (let minute = 0; minute < 60; minute += timeInterval) {
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
  }, [timeInterval]);

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
    return formatDurationDisplay(duration, unit);
  };

  // Get day name from date (e.g., 'monday', 'tuesday')
  const getDayName = (date: Date): string => {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    return days[date.getDay()];
  };

  // Memoize the current day name to avoid recalculating
  const currentDayName = useMemo(() => getDayName(selectedDate), [selectedDate]);

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

  // Load spaces only once on mount (they don't change with date) - with cache support
  const loadSpaces = useCallback(async () => {
    if (spacesLoadedRef.current) return; // Already loaded
    try {
      const user = getStoredUser();

      // Check if cache has any data first
      const hasCachedRooms = await roomCacheService.hasCachedData();
      
      if (hasCachedRooms) {
        // Use cached data immediately for instant loading
        const cachedRooms = await roomCacheService.getCachedRooms();
        if (cachedRooms) {
          const sortedSpaces = [...cachedRooms].sort(naturalSort);
          setSpaces(sortedSpaces);
          spacesLoadedRef.current = true;
          return;
        }
      }
      
      // No cache available, fetch from API
      const spacesResponse = await roomService.getRooms({
        user_id: user?.id,
        per_page: 100
      });
      const fetchedSpaces = Array.isArray(spacesResponse.data) ? spacesResponse.data : spacesResponse.data.rooms || [];
      // Cache for next time
      await roomCacheService.cacheRooms(fetchedSpaces);
      const sortedSpaces = [...fetchedSpaces].sort(naturalSort);
      setSpaces(sortedSpaces);
      spacesLoadedRef.current = true;
    } catch (error) {
      console.error('Error loading spaces:', error);
    }
  }, []);

  // Load bookings for the selected date with cache support
  const loadBookings = useCallback(async () => {
    try {
      setBookingsLoading(true);
      
      // Format date as YYYY-MM-DD for booking_date filter
      const year = selectedDate.getFullYear();
      const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const day = String(selectedDate.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;

      let fetchedBookings: Booking[];
      
      // Check if cache has any data first
      const hasCachedBookings = await bookingCacheService.hasCachedData();
      
      if (hasCachedBookings) {
        // Cache exists - use filtered results immediately (even if empty for this date)
        console.log('[SpaceSchedule] Cache exists, filtering for date:', dateStr);
        const cachedBookings = await bookingCacheService.getFilteredBookingsFromCache({
          booking_date: dateStr,
        });
        console.log('[SpaceSchedule] Filtered bookings from cache:', cachedBookings?.length || 0);
        fetchedBookings = (cachedBookings || []) as Booking[];
        setBookings(fetchedBookings);
      } else {
        // No cache available, fetch from API
        const bookingsResponse = await bookingService.getBookings({
          booking_date: dateStr,
          user_id: getStoredUser()?.id
        });
        
        fetchedBookings = bookingsResponse.data.bookings || [];
        setBookings(fetchedBookings);
        // Cache for next time
        await bookingCacheService.cacheBookings(fetchedBookings);
      }

      // Extract time interval from the first booking's package
      if (fetchedBookings.length > 0 && fetchedBookings[0].package) {
        const packageInterval = fetchedBookings[0].package.time_slot_interval;
        if (packageInterval && packageInterval > 0) {
          setTimeInterval(packageInterval);
        }
      }
    } catch (error) {
      console.error('Error loading bookings:', error);
    } finally {
      setBookingsLoading(false);
    }
  }, [selectedDate]);

  // Initial load: fetch spaces and bookings in parallel for faster loading
  useEffect(() => {
    const init = async () => {
      await Promise.all([loadSpaces(), loadBookings()]);
      setInitialLoading(false);
    };
    init();
  }, []); // Only run once on mount

  // Fetch bookings when date changes (fast - only one API call)
  useEffect(() => {
    if (!initialLoading) {
      loadBookings();
    }
  }, [selectedDate]); // eslint-disable-line react-hooks/exhaustive-deps

  // Navigate dates
  const goToPreviousDay = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() - 1);
    setSelectedDate(newDate);
    setCalendarMonth(newDate);
  };

  const goToNextDay = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + 1);
    setSelectedDate(newDate);
    setCalendarMonth(newDate);
  };

  const goToToday = () => {
    const today = new Date();
    setSelectedDate(today);
    setCalendarMonth(today);
  };

  // Calendar navigation
  const goToPreviousMonth = () => {
    const newMonth = new Date(calendarMonth);
    newMonth.setMonth(newMonth.getMonth() - 1);
    setCalendarMonth(newMonth);
  };

  const goToNextMonth = () => {
    const newMonth = new Date(calendarMonth);
    newMonth.setMonth(newMonth.getMonth() + 1);
    setCalendarMonth(newMonth);
  };

  const selectDate = (date: Date) => {
    setSelectedDate(date);
    setShowCalendar(false);
  };

  // Generate calendar days for the current month view
  const getCalendarDays = (): (Date | null)[] => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    
    // First day of the month
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    // Days in month
    const daysInMonth = lastDay.getDate();
    
    // Starting day of week (0 = Sunday)
    const startingDayOfWeek = firstDay.getDay();
    
    // Build calendar array
    const days: (Date | null)[] = [];
    
    // Add empty slots for days before the month starts
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    
    // Add all days in the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }
    
    return days;
  };

  const isSameDay = (date1: Date, date2: Date): boolean => {
    return date1.getDate() === date2.getDate() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getFullYear() === date2.getFullYear();
  };

  const isToday = (date: Date): boolean => {
    return isSameDay(date, new Date());
  };

  // Pre-compute booking map for O(1) lookups - grouped by room_id
  const bookingsByRoom = useMemo(() => {
    const map = new Map<number, Booking[]>();
    for (const booking of bookings) {
      if (booking.room_id && (booking.status === 'confirmed' || booking.status === 'checked-in' || booking.status === 'pending')) {
        const roomBookings = map.get(booking.room_id) || [];
        roomBookings.push(booking);
        map.set(booking.room_id, roomBookings);
      }
    }
    return map;
  }, [bookings]);

  // Pre-compute ALL cell data once to avoid recalculating during render
  // This is the key optimization - compute once, use everywhere
  const cellDataCache = useMemo(() => {
    const cache = new Map<string, BookingCell | null>();
    const breakCache = new Map<string, { isStart: boolean; rowSpan: number; breakTime: BreakTime | null }>();
    const isBreakCache = new Map<string, boolean>();
    
    for (const slot of timeSlots) {
      for (const space of spaces) {
        const key = `${space.id}-${slot.hour}-${slot.minute}`;
        
        // Calculate booking for cell
        const spaceBookings = bookingsByRoom.get(space.id) || [];
        let cellData: BookingCell | null = null;
        
        for (const booking of spaceBookings) {
          const [bookingHour, bookingMinute] = booking.booking_time.split(':').map(Number);
          
          if (bookingHour === slot.hour && bookingMinute === slot.minute) {
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
            const interval = booking.package?.time_slot_interval || timeInterval;
            const durationInSlots = Math.ceil(durationInMinutes / interval);
            cellData = { booking, rowSpan: durationInSlots };
            break;
          }

          const bookingStartMinutes = bookingHour * 60 + bookingMinute;
          const slotMinutes = slot.hour * 60 + slot.minute;
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
            cellData = { booking, rowSpan: 0 };
            break;
          }
        }
        cache.set(key, cellData);
        
        // Calculate break time
        let isInBreak = false;
        let breakStart: { isStart: boolean; rowSpan: number; breakTime: BreakTime | null } = { isStart: false, rowSpan: 0, breakTime: null };
        
        if (space.break_time && space.break_time.length > 0) {
          const slotMinutes = slot.hour * 60 + slot.minute;
          
          for (const breakTime of space.break_time) {
            if (!breakTime.days.includes(currentDayName)) continue;
            
            const [startHour, startMinute] = breakTime.start_time.split(':').map(Number);
            const [endHour, endMinute] = breakTime.end_time.split(':').map(Number);
            const breakStartMinutes = startHour * 60 + startMinute;
            const breakEndMinutes = endHour * 60 + endMinute;
            
            if (slotMinutes >= breakStartMinutes && slotMinutes < breakEndMinutes) {
              isInBreak = true;
            }
            
            if (slotMinutes === breakStartMinutes) {
              const breakDurationMinutes = breakEndMinutes - breakStartMinutes;
              const rowSpan = Math.ceil(breakDurationMinutes / timeInterval);
              breakStart = { isStart: true, rowSpan, breakTime };
            }
          }
        }
        
        isBreakCache.set(key, isInBreak);
        breakCache.set(key, breakStart);
      }
    }
    
    return { cache, breakCache, isBreakCache };
  }, [timeSlots, spaces, bookingsByRoom, currentDayName, timeInterval]);

  // Fast lookups from cache
  const getCellData = useCallback((spaceId: number, slot: TimeSlot): BookingCell | null => {
    return cellDataCache.cache.get(`${spaceId}-${slot.hour}-${slot.minute}`) || null;
  }, [cellDataCache]);

  const getBreakStart = useCallback((spaceId: number, slot: TimeSlot) => {
    return cellDataCache.breakCache.get(`${spaceId}-${slot.hour}-${slot.minute}`) || { isStart: false, rowSpan: 0, breakTime: null };
  }, [cellDataCache]);

  const getIsBreak = useCallback((spaceId: number, slot: TimeSlot): boolean => {
    return cellDataCache.isBreakCache.get(`${spaceId}-${slot.hour}-${slot.minute}`) || false;
  }, [cellDataCache]);

  // Memoize visible time slots using cached data - much faster now
  const visibleTimeSlots = useMemo(() => {
    return timeSlots.filter(slot => {
      return spaces.some(space => {
        const key = `${space.id}-${slot.hour}-${slot.minute}`;
        const hasBooking = cellDataCache.cache.get(key) !== null;
        const hasBreak = cellDataCache.isBreakCache.get(key) || false;
        return hasBooking || hasBreak;
      });
    });
  }, [timeSlots, spaces, cellDataCache]);

  if (initialLoading) {
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
            
            {/* Calendar Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowCalendar(!showCalendar)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-${themeColor}-50 transition-colors`}
              >
                <Calendar className={`w-5 h-5 text-${fullColor}`} />
                <h2 className="text-xl font-semibold text-gray-900">
                  {selectedDate.toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}
                </h2>
              </button>

              {/* Calendar Dropdown */}
              {showCalendar && (
                <>
                  {/* Backdrop */}
                  <div 
                    className="fixed inset-0 z-30"
                    onClick={() => setShowCalendar(false)}
                  />
                  
                  {/* Calendar Popover */}
                  <div className="absolute top-full left-0 mt-2 bg-white rounded-lg shadow-xl border border-gray-200 p-4 z-40 animate-scale-in">
                    {/* Month Navigation */}
                    <div className="flex items-center justify-between mb-4">
                      <button
                        onClick={goToPreviousMonth}
                        className="p-2 hover:bg-gray-100 rounded-lg transition"
                      >
                        <ChevronLeft className="w-5 h-5 text-gray-600" />
                      </button>
                      <div className="text-base font-semibold text-gray-900">
                        {calendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                      </div>
                      <button
                        onClick={goToNextMonth}
                        className="p-2 hover:bg-gray-100 rounded-lg transition"
                      >
                        <ChevronRight className="w-5 h-5 text-gray-600" />
                      </button>
                    </div>

                    {/* Day Labels */}
                    <div className="grid grid-cols-7 gap-1 mb-2">
                      {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
                        <div key={day} className="text-center text-xs font-medium text-gray-500 py-2">
                          {day}
                        </div>
                      ))}
                    </div>

                    {/* Calendar Grid */}
                    <div className="grid grid-cols-7 gap-1">
                      {getCalendarDays().map((day, index) => {
                        if (!day) {
                          return <div key={`empty-${index}`} className="aspect-square" />;
                        }

                        const isSelected = isSameDay(day, selectedDate);
                        const isTodayDate = isToday(day);
                        const isPast = day < new Date(new Date().setHours(0, 0, 0, 0));

                        return (
                          <button
                            key={index}
                            onClick={() => selectDate(day)}
                            className={`
                              aspect-square flex items-center justify-center rounded-lg text-sm font-medium transition-all
                              ${isSelected 
                                ? `bg-${fullColor} text-white shadow-md` 
                                : isTodayDate
                                ? `bg-${themeColor}-100 text-${fullColor} font-semibold`
                                : isPast
                                ? 'text-gray-400 hover:bg-gray-100'
                                : 'text-gray-700 hover:bg-gray-100'
                              }
                            `}
                          >
                            {day.getDate()}
                          </button>
                        );
                      })}
                    </div>

                    {/* Quick Actions */}
                    <div className="mt-4 pt-4 border-t border-gray-200 flex gap-2">
                      <button
                        onClick={goToToday}
                        className={`flex-1 px-3 py-2 text-sm font-medium text-${fullColor} bg-${themeColor}-50 hover:bg-${themeColor}-100 rounded-lg transition`}
                      >
                        Today
                      </button>
                      <button
                        onClick={() => setShowCalendar(false)}
                        className="flex-1 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                </>
              )}
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

            {/* Loading indicator for date changes */}
            {bookingsLoading && (
              <div className="flex items-center gap-2 text-gray-500">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Loading...</span>
              </div>
            )}

            {/* Legend Tooltip */}
            <div className="relative group">
              <button className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition">
                <Info className="w-5 h-5" />
              </button>
              <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 p-4 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-20">
                <div className="text-xs font-semibold text-gray-800 mb-3">Legend</div>
                
                {/* Status Indicators */}
                <div className="mb-3">
                  <div className="text-xs font-medium text-gray-600 mb-2">Booking Status</div>
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-green-500 text-white rounded-full text-[10px] font-semibold">Confirmed</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-yellow-500 text-white rounded-full text-[10px] font-semibold">Pending</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-blue-500 text-white rounded-full text-[10px] font-semibold">Checked-in</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-gray-500 text-white rounded-full text-[10px] font-semibold">Completed</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-red-500 text-white rounded-full text-[10px] font-semibold">Cancelled</span>
                    </div>
                  </div>
                </div>
                
                {/* Color Coding */}
                <div className="pt-3 border-t border-gray-200">
                  <div className="text-xs font-medium text-gray-600 mb-2">Color Coding</div>
                  <p className="text-xs text-gray-500 mb-2">Each package has a unique color</p>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-gray-200 rounded border border-dashed border-gray-400 flex items-center justify-center">
                      <Coffee className="w-1.5 h-1.5 text-gray-500" />
                    </div>
                    <span className="text-gray-600 text-xs">Break Time</span>
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
                {visibleTimeSlots.map((slot, index) => (
                <tr key={index} className="border-b border-gray-100 hover:bg-gray-50" style={{ height: '60px' }}>
                  <td className="sticky left-0 bg-white z-10 px-4 py-2 text-sm text-gray-600 border-r border-gray-200 font-medium" style={{ height: '60px' }}>
                    {slot.time}
                  </td>
                  {spaces.map(space => {
                    // Use cached data - no recalculation needed
                    const cellData = getCellData(space.id, slot);
                    const breakTimeData = getBreakStart(space.id, slot);
                    const isInBreak = getIsBreak(space.id, slot);
                    
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
                      
                      // Package color palette (same as CalendarView for consistency)
                      const packageColors = [
                        { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-200' },
                        { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-200' },
                        { bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-200' },
                        { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-200' },
                        { bg: 'bg-pink-100', text: 'text-pink-800', border: 'border-pink-200' },
                        { bg: 'bg-teal-100', text: 'text-teal-800', border: 'border-teal-200' },
                        { bg: 'bg-indigo-100', text: 'text-indigo-800', border: 'border-indigo-200' },
                        { bg: 'bg-amber-100', text: 'text-amber-800', border: 'border-amber-200' },
                        { bg: 'bg-cyan-100', text: 'text-cyan-800', border: 'border-cyan-200' },
                        { bg: 'bg-rose-100', text: 'text-rose-800', border: 'border-rose-200' },
                        { bg: 'bg-lime-100', text: 'text-lime-800', border: 'border-lime-200' },
                        { bg: 'bg-fuchsia-100', text: 'text-fuchsia-800', border: 'border-fuchsia-200' },
                      ];
                      
                      // Generate consistent hash from package name for fixed colors
                      const getPackageNameHash = (packageName: string): number => {
                        if (!packageName) return 0;
                        let hash = 0;
                        for (let i = 0; i < packageName.length; i++) {
                          const char = packageName.charCodeAt(i);
                          hash = ((hash << 5) - hash) + char;
                          hash = hash & hash;
                        }
                        return Math.abs(hash);
                      };
                      
                      // Get color based on package name (fixed, consistent across views)
                      const packageName = booking.package?.name || '';
                      const colorIndex = getPackageNameHash(packageName) % packageColors.length;
                      const packageColor = packageColors[colorIndex];
                      
                      return (
                        <td
                          key={space.id}
                          rowSpan={rowSpan}
                          className={`px-2 py-2 border-r border-gray-200 cursor-pointer hover:opacity-80 transition ${packageColor.bg}`}
                          style={{ verticalAlign: 'top' }}
                          onClick={() => setSelectedBooking(booking)}
                        >
                          <div className="h-full min-h-full flex flex-col p-2">
                            {/* Status Badge - Prominent at top */}
                            <div className="flex items-center justify-between mb-2">
                              <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-full ${
                                booking.status === 'confirmed' ? 'bg-green-500 text-white' :
                                booking.status === 'pending' ? 'bg-yellow-500 text-white' :
                                booking.status === 'checked-in' ? 'bg-blue-500 text-white' :
                                booking.status === 'completed' ? 'bg-gray-500 text-white' :
                                booking.status === 'cancelled' ? 'bg-red-500 text-white' :
                                'bg-gray-400 text-white'
                              }`}>
                                {booking.status}
                              </span>
                              <span className={`text-[10px] font-medium ${packageColor.text} opacity-70`}>
                                #{booking.reference_number?.slice(-6)}
                              </span>
                            </div>
                            
                            {/* Time Range */}
                            <div className={`font-bold text-sm ${packageColor.text} mb-1`}>
                              {formatTime12Hour(booking.booking_time)} - {formatTime12Hour(calculateEndTime(booking.booking_time, booking.duration, booking.duration_unit))}
                            </div>

                            {/* Customer Name */}
                            <div className={`font-semibold text-sm ${packageColor.text} mb-1 line-clamp-1`}>
                              {booking.guest_name || 'Walk-in'}
                            </div>

                            {/* Package */}
                            <div className={`text-xs ${packageColor.text} opacity-80 mb-1 line-clamp-1`}>
                              {booking.package?.name || 'N/A'}
                            </div>

                            {/* Guests */}
                            <div className={`text-xs ${packageColor.text} opacity-70 mb-1`}>
                              <Users className="w-3 h-3 inline mr-1" />
                              {booking.participants} {booking.participants === 1 ? 'guest' : 'guests'}
                            </div>

                            {/* Payment Info */}
                            <div className={`mt-auto pt-2 border-t ${packageColor.border} flex items-center justify-between text-xs`}>
                              <span className={`font-bold ${packageColor.text}`}>
                                ${totalAmount.toFixed(2)}
                              </span>
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                booking.payment_status === 'paid' ? 'bg-green-100 text-green-700' :
                                booking.payment_status === 'partial' ? 'bg-yellow-100 text-yellow-700' :
                                'bg-red-100 text-red-700'
                              }`}>
                                {booking.payment_status}
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
                    <span className="text-sm text-gray-900">{parseLocalDate(selectedBooking.booking_date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
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
