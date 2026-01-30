import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Users,
  DollarSign,
  CheckCircle,
  ChevronRight,
  ChevronLeft,
  Plus,
  Zap,
  TrendingUp,
  Ticket,
  Package,
  X,
  Clock,
  MapPin,
  PackageIcon,
  House,
  Grid,
  List,
  Sparkles,
  CalendarDays,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useThemeColor } from '../../hooks/useThemeColor';
import CounterAnimation from '../../components/ui/CounterAnimation';
import StandardButton from '../../components/ui/StandardButton';
import { getStoredUser } from '../../utils/storage';
import bookingService from '../../services/bookingService';
import { bookingCacheService } from '../../services/BookingCacheService';
import { locationService } from '../../services/LocationService';
import { metricsService, type TimeframeType } from '../../services/MetricsService';
import { metricsCacheService } from '../../services/MetricsCacheService';
import { formatDurationDisplay, convertTo12Hour, parseLocalDate } from '../../utils/timeFormat';
import { roomService, type Room } from '../../services/RoomService';
import { roomCacheService } from '../../services/RoomCacheService';

const LocationManagerDashboard: React.FC = () => {
  const { themeColor, fullColor } = useThemeColor();
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [currentDay, setCurrentDay] = useState(new Date());
  const [calendarView, setCalendarView] = useState<'day' | 'week' | 'month'>('month');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [loading, setLoading] = useState(true);
  const [locationId, setLocationId] = useState<number>(1);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<{ date: Date; hour: number; minute: string; bookings: any[] } | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<any | null>(null);
  const [selectedDayBookings, setSelectedDayBookings] = useState<{ date: Date; bookings: any[] } | null>(null);
  const [monthlyBookings, setMonthlyBookings] = useState<any[]>([]);

  // Timeframe selector for metrics
  const [metricsTimeframe, setMetricsTimeframe] = useState<TimeframeType>('all_time');
  const [timeframeDescription, setTimeframeDescription] = useState('All Time');
  
  // Rooms for daily view
  const [rooms, setRooms] = useState<Room[]>([]);
  
  // New bookings tracking
  const [newBookings, setNewBookings] = useState<any[]>([]);

  // Data states
  const [allBookings, setAllBookings] = useState<any[]>([]); // All-time bookings for this location
  const [weeklyBookings, setWeeklyBookings] = useState<any[]>([]);
  const [dailyBookings, setDailyBookings] = useState<any[]>([]);
  const [ticketPurchases, setTicketPurchases] = useState<any[]>([]);
  const [metrics, setMetrics] = useState({
    totalBookings: 0,
    totalRevenue: 0,
    totalCustomers: 0,
    confirmedBookings: 0,
    pendingBookings: 0,
    completedBookings: 0,
    cancelledBookings: 0,
    totalParticipants: 0,
    bookingRevenue: 0,
    purchaseRevenue: 0,
    totalPurchases: 0,
  });

  // Get dates for the current week
  const getWeekDates = (date: Date): Date[] => {
    const start = new Date(date);
    const day = start.getDay();
    const diff = start.getDate() - day + (day === 0 ? -6 : 1);
    start.setDate(diff);
    
    const weekDates = [];
    for (let i = 0; i < 7; i++) {
      const current = new Date(start);
      current.setDate(start.getDate() + i);
      weekDates.push(current);
    }
    return weekDates;
  };

  const weekDates = getWeekDates(currentWeek);

  // Get user location on mount
  useEffect(() => {
    const user = getStoredUser();
    if (user?.location_id) {
      setLocationId(user.location_id);
    }
  }, []);

  // Load ALL bookings for this location (cache-first, then background sync)
  // This is the primary data source for the table and calendar views
  useEffect(() => {
    if (!locationId) return;
    
    const loadAllBookings = async () => {
      try {
        console.log('📦 [ManagerDashboard] Loading all bookings for location:', locationId);
        
        // Step 1: Try cache first for instant loading
        const cachedBookings = await bookingCacheService.getFilteredBookingsFromCache({
          location_id: locationId,
        });
        
        if (cachedBookings && cachedBookings.length > 0) {
          console.log('📦 [ManagerDashboard] Loaded', cachedBookings.length, 'bookings from cache');
          setAllBookings(cachedBookings);
          setLoading(false);
        }
        
        // Step 2: Fetch fresh data from API in background (ALL bookings for location, no date filter)
        console.log('🔄 [ManagerDashboard] Background sync: Fetching fresh bookings...');
        const bookingsResponse = await bookingService.getBookings({
          location_id: locationId,
          per_page: 500, // Get all bookings (500 max to avoid backend limits)
        });
        
        const bookings = bookingsResponse.data.bookings || [];
        console.log('✅ [ManagerDashboard] Fetched', bookings.length, 'bookings from API');
        
        // Update state and cache
        setAllBookings(bookings);
        if (bookings.length > 0) {
          await bookingCacheService.cacheBookings(bookings, { locationId });
          console.log('✅ [ManagerDashboard] Cache updated');
        }
      } catch (error) {
        console.error('⚠️ [ManagerDashboard] Error loading bookings:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadAllBookings();
  }, [locationId]);

  // Fetch rooms/spaces for daily view - use cache for faster loading
  useEffect(() => {
    const fetchRooms = async () => {
      if (!locationId) return;
      try {
        // Try cache first for instant loading
        const cachedRooms = await roomCacheService.getCachedRooms();
        if (cachedRooms && cachedRooms.length > 0) {
          const filteredRooms = cachedRooms.filter(r => r.location_id === locationId);
          if (filteredRooms.length > 0) {
            setRooms(filteredRooms);
            console.log('📦 [ManagerDashboard] Loaded', filteredRooms.length, 'spaces from cache');
            return;
          }
        }
        // Fallback to API if cache empty
        const response = await roomService.getRooms({ location_id: locationId, per_page: 100 });
        const fetchedRooms = response.data.rooms || [];
        setRooms(fetchedRooms);
        // Update cache with fetched rooms
        if (fetchedRooms.length > 0) {
          await roomCacheService.cacheRooms(fetchedRooms);
        }
      } catch (error) {
        console.error('Error fetching spaces:', error);
      }
    };
    fetchRooms();
  }, [locationId]);

  // Derive new bookings (created in last 48 hours) from allBookings - no separate API call
  useEffect(() => {
    if (allBookings.length === 0) return;
    
    const now = new Date();
    const twoDaysAgo = new Date(now);
    twoDaysAgo.setDate(now.getDate() - 2);
    
    const recentlyCreated = allBookings.filter((booking: any) => {
      const createdAt = new Date(booking.created_at);
      return createdAt >= twoDaysAgo;
    });
    
    setNewBookings(recentlyCreated);
    console.log('📅 [ManagerDashboard] New bookings (last 48h) derived:', recentlyCreated.length);
  }, [allBookings]);

  // Fetch metrics data (when location or timeframe changes)
  // PERFORMANCE OPTIMIZATION: Cache-first loading with background refresh
  // - Display cached metrics instantly
  // - Fetch fresh data in background
  // - Smooth update when new data arrives
  useEffect(() => {
    const fetchMetricsData = async () => {
      if (!locationId) return;
      
      try {
        console.log('🔄 Starting metrics fetch for location:', locationId);
        
        // Step 1: Try to load from cache first for instant display (with timeframe)
        const cachedData = await metricsCacheService.getCachedMetrics<typeof metrics>('manager', locationId, metricsTimeframe);
        
        if (cachedData) {
          console.log('📦 [ManagerDashboard] Loaded metrics from cache for timeframe:', metricsTimeframe);
          setMetrics(cachedData.metrics);
          if (cachedData.recentPurchases) {
            setTicketPurchases(cachedData.recentPurchases);
          }
          setLoading(false);
        }
        
        // Step 2: Fetch fresh data from API in background with timeframe
        console.log('📊 Fetching metrics from API with timeframe:', metricsTimeframe);
        
        // Fetch location details
        await locationService.getLocation(locationId);
        
        // Fetch metrics with timeframe filter
        const metricsResponse = await metricsService.getDashboardMetrics({
          timeframe: metricsTimeframe,
        });
        
        console.log('✅ Metrics API response:', metricsResponse);
        console.log('📊 Metrics:', metricsResponse.metrics);
        console.log('🎫 Recent purchases:', metricsResponse.recentPurchases?.length || 0);
        
        // Step 3: Update state with fresh data (smooth transition)
        if (metricsResponse.metrics) {
          setMetrics(metricsResponse.metrics);
        } else {
          console.error('⚠️ No metrics in API response');
        }
        
        // Set recent purchases from API response
        if (metricsResponse.recentPurchases) {
          setTicketPurchases(metricsResponse.recentPurchases as any);
        }
        
        if (metricsResponse.locationDetails) {
          console.log('📍 Location details from API:', metricsResponse.locationDetails.name);
        }
        
        // Step 4: Cache the fresh data for next time (with timeframe)
        await metricsCacheService.cacheMetrics('manager', {
          metrics: metricsResponse.metrics,
          recentPurchases: metricsResponse.recentPurchases || [],
        }, locationId, metricsTimeframe);
        
        // Update timeframe description from API
        if (metricsResponse.timeframe) {
          setTimeframeDescription(metricsResponse.timeframe.description);
        }
        
        console.log('✅ [ManagerDashboard] Metrics cached successfully for timeframe:', metricsTimeframe);
        
      } catch (error: any) {
        console.error('❌ Error fetching metrics data:', error);
        console.error('Error details:', error.message || error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchMetricsData();
  }, [locationId, metricsTimeframe]);

  // Weekly calendar data - derived from allBookings (no API call needed)
  useEffect(() => {
    if (allBookings.length === 0) return;
    
    const weekStart = weekDates[0];
    const weekEnd = weekDates[6];
    
    const weekly = allBookings.filter(booking => {
      const bookingDate = parseLocalDate(booking.booking_date);
      return bookingDate >= weekStart && bookingDate <= weekEnd;
    });
    
    setWeeklyBookings(weekly);
    console.log('📅 [ManagerDashboard] Weekly bookings filtered:', weekly.length);
  }, [allBookings, currentWeek]);
  
  // Daily calendar data - derived from allBookings (no API call needed)
  // Matches SpaceSchedule: only show confirmed, pending, and checked-in bookings
  useEffect(() => {
    if (calendarView !== 'day' || allBookings.length === 0) return;
    
    const year = currentDay.getFullYear();
    const month = String(currentDay.getMonth() + 1).padStart(2, '0');
    const day = String(currentDay.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    
    const validStatuses = ['confirmed', 'pending', 'checked-in'];
    const daily = allBookings.filter(booking => {
      const bookingDatePart = booking.booking_date.split('T')[0];
      const status = booking.status?.toLowerCase();
      return bookingDatePart === dateStr && validStatuses.includes(status);
    });
    
    setDailyBookings(daily);
    console.log('📅 [ManagerDashboard] Daily bookings filtered for', dateStr, ':', daily.length);
  }, [allBookings, currentDay, calendarView]);
  
  // Navigate to previous/next day
  const goToPreviousDay = () => {
    const newDate = new Date(currentDay);
    newDate.setDate(newDate.getDate() - 1);
    setCurrentDay(newDate);
  };

  const goToNextDay = () => {
    const newDate = new Date(currentDay);
    newDate.setDate(newDate.getDate() + 1);
    setCurrentDay(newDate);
  };

  // Navigate to previous/next week
  const goToPreviousWeek = () => {
    const newDate = new Date(currentWeek);
    newDate.setDate(newDate.getDate() - 7);
    setCurrentWeek(newDate);
  };

  const goToNextWeek = () => {
    const newDate = new Date(currentWeek);
    newDate.setDate(newDate.getDate() + 7);
    setCurrentWeek(newDate);
  };

  // Navigate to previous/next month
  const goToPreviousMonth = () => {
    const newDate = new Date(currentMonth);
    newDate.setDate(1); // Set to first day to avoid month overflow
    newDate.setMonth(newDate.getMonth() - 1);
    setCurrentMonth(newDate);
  };

  const goToNextMonth = () => {
    const newDate = new Date(currentMonth);
    newDate.setDate(1); // Set to first day to avoid month overflow
    newDate.setMonth(newDate.getMonth() + 1);
    setCurrentMonth(newDate);
  };

  // Get all days in the current month for calendar grid
  const getMonthDays = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = firstDay.getDay();
    
    const days: (Date | null)[] = [];
    
    // Add empty slots for days before the first of the month
    for (let i = 0; i < startDayOfWeek; i++) {
      days.push(null);
    }
    
    // Add all days of the month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }
    
    return days;
  };

  const monthDays = getMonthDays(currentMonth);

  // Monthly calendar data - derived from allBookings (no API call needed)
  useEffect(() => {
    if (calendarView !== 'month' || allBookings.length === 0) return;
    
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const monthStart = new Date(year, month, 1);
    const monthEnd = new Date(year, month + 1, 0);
    
    const monthly = allBookings.filter(booking => {
      const bookingDate = parseLocalDate(booking.booking_date);
      return bookingDate >= monthStart && bookingDate <= monthEnd;
    });
    
    setMonthlyBookings(monthly);
    console.log('📅 [ManagerDashboard] Monthly bookings filtered:', monthly.length);
  }, [allBookings, currentMonth, calendarView]);

  // Get bookings for a specific day
  const getBookingsForDay = (date: Date) => {
    return monthlyBookings.filter(booking => {
      const bookingDate = parseLocalDate(booking.booking_date);
      return bookingDate.toDateString() === date.toDateString();
    });
  };

  // Natural sort function: alphabetical first, then numerical (Table 1, 2, 3 not 1, 10, 2)
  const naturalSort = (a: Room, b: Room): number => {
    const nameA = a.name;
    const nameB = b.name;
    const chunksA = nameA.match(/(\d+|\D+)/g) || [];
    const chunksB = nameB.match(/(\d+|\D+)/g) || [];
    const maxLength = Math.max(chunksA.length, chunksB.length);
    for (let i = 0; i < maxLength; i++) {
      const chunkA = chunksA[i] || '';
      const chunkB = chunksB[i] || '';
      const isNumA = /^\d+$/.test(chunkA);
      const isNumB = /^\d+$/.test(chunkB);
      if (isNumA && isNumB) {
        const diff = parseInt(chunkA) - parseInt(chunkB);
        if (diff !== 0) return diff;
      } else {
        const comparison = chunkA.toLowerCase().localeCompare(chunkB.toLowerCase());
        if (comparison !== 0) return comparison;
      }
    }
    return 0;
  };

  // Sorted rooms for display
  const sortedRooms = [...rooms].sort(naturalSort);

  // Generate time slots for daily view (matching SpaceSchedule)
  const generateTimeSlots = () => {
    const slots: { time: string; hour: number; minute: number }[] = [];
    const startHour = 8; // 8 AM
    const endHour = 22; // 10 PM
    const interval = 15; // 15-minute intervals to match SpaceSchedule
    
    for (let hour = startHour; hour <= endHour; hour++) {
      for (let minute = 0; minute < 60; minute += interval) {
        if (hour === endHour && minute > 0) break;
        const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const timeString = `${displayHour}:${minute.toString().padStart(2, '0')} ${ampm}`;
        slots.push({ time: timeString, hour, minute });
      }
    }
    return slots;
  };

  const dailyTimeSlots = generateTimeSlots();

  // Check if there are any bookings without a room assigned
  const unassignedBookings = dailyBookings.filter(b => !b.room_id);

  // Filter to show time slots that have bookings (including unassigned bookings)
  const visibleTimeSlots = dailyTimeSlots.filter(slot => {
    // Check if any booking (with or without room) covers this slot
    return dailyBookings.some(booking => {
      const [bookingHour, bookingMin] = (booking.booking_time || '00:00').split(':').map(Number);
      const startInMinutes = bookingHour * 60 + bookingMin;
      const slotInMinutes = slot.hour * 60 + slot.minute;
      let durationMinutes = 60;
      if (booking.duration && booking.duration_unit) {
        if (booking.duration_unit === 'hours') durationMinutes = booking.duration * 60;
        else if (booking.duration_unit === 'minutes') durationMinutes = booking.duration;
        else durationMinutes = Math.floor(booking.duration) * 60 + Math.round((booking.duration % 1) * 60);
      }
      const endInMinutes = startInMinutes + durationMinutes;
      return slotInMinutes >= startInMinutes && slotInMinutes < endInMinutes;
    });
  });

  // Get booking for a specific space and time slot (spaceId = 0 means unassigned)
  const getBookingForSlot = (spaceId: number, slot: { hour: number; minute: number }) => {
    return dailyBookings.find(booking => {
      // For unassigned column (spaceId = 0), check for bookings without room
      if (spaceId === 0) {
        if (booking.room_id) return false; // Has a room, skip
      } else {
        if (booking.room_id !== spaceId) return false;
      }
      const [bookingHour, bookingMin] = (booking.booking_time || '00:00').split(':').map(Number);
      return bookingHour === slot.hour && bookingMin === slot.minute;
    });
  };

  // Check if a slot is occupied by a booking that started earlier (spaceId = 0 means unassigned)
  const isSlotOccupied = (spaceId: number, slot: { hour: number; minute: number }) => {
    return dailyBookings.some(booking => {
      // For unassigned column (spaceId = 0), check for bookings without room
      if (spaceId === 0) {
        if (booking.room_id) return false; // Has a room, skip
      } else {
        if (booking.room_id !== spaceId) return false;
      }
      const [startHour, startMin] = (booking.booking_time || '00:00').split(':').map(Number);
      const startInMinutes = startHour * 60 + startMin;
      const slotInMinutes = slot.hour * 60 + slot.minute;
      
      let durationMinutes = 60;
      if (booking.duration && booking.duration_unit) {
        if (booking.duration_unit === 'hours') durationMinutes = booking.duration * 60;
        else if (booking.duration_unit === 'minutes') durationMinutes = booking.duration;
        else durationMinutes = Math.floor(booking.duration) * 60 + Math.round((booking.duration % 1) * 60);
      }
      
      const endInMinutes = startInMinutes + durationMinutes;
      return slotInMinutes > startInMinutes && slotInMinutes < endInMinutes;
    });
  };

  // Calculate row span for a booking (based on 15-minute intervals)
  const getBookingRowSpan = (booking: any) => {
    let durationMinutes = 60;
    if (booking.duration && booking.duration_unit) {
      if (booking.duration_unit === 'hours') durationMinutes = booking.duration * 60;
      else if (booking.duration_unit === 'minutes') durationMinutes = booking.duration;
      else durationMinutes = Math.floor(booking.duration) * 60 + Math.round((booking.duration % 1) * 60);
    }
    return Math.max(1, Math.ceil(durationMinutes / 15));
  };

  // Format time for display
  const formatTime12Hour = (time: string): string => {
    const [hourStr, minuteStr] = time.split(':');
    let hour = parseInt(hourStr);
    const minute = minuteStr?.substring(0, 2) || '00';
    const ampm = hour >= 12 ? 'PM' : 'AM';
    hour = hour % 12 || 12;
    return `${hour}:${minute} ${ampm}`;
  };

  // Calculate end time
  const calculateEndTime = (startTime: string, duration: number, unit: string): string => {
    const [hourStr, minuteStr] = startTime.split(':');
    let hour = parseInt(hourStr);
    let minute = parseInt(minuteStr);
    
    let durationInMinutes = unit === 'hours' ? duration * 60 : unit === 'minutes' ? duration : Math.floor(duration) * 60 + Math.round((duration % 1) * 60);
    
    minute += durationInMinutes;
    hour += Math.floor(minute / 60);
    minute = minute % 60;
    hour = hour % 24;
    
    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  };

  // Dynamic metrics cards
  const metricsCards = [
    {
      title: 'Total Bookings',
      value: metrics.totalBookings.toString(),
      change: `${metrics.totalParticipants} participants • ${timeframeDescription}`,
      icon: Package,
      accent: `bg-${themeColor}-100 text-${fullColor}`,
    },
    {
      title: 'New Bookings',
      value: newBookings.length.toString(),
      change: 'Created in last 48h',
      icon: Sparkles,
      accent: 'bg-blue-100 text-blue-600',
    },
    {
      title: 'Total Revenue',
      value: `$${metrics.totalRevenue.toFixed(2)}`,
      change: `${timeframeDescription}`,
      icon: DollarSign,
      accent: `bg-${themeColor}-100 text-${fullColor}`,
    },
    {
      title: 'Unique Customers',
      value: metrics.totalCustomers.toString(),
      change: timeframeDescription,
      icon: Users,
      accent: `bg-${themeColor}-100 text-${fullColor}`,
    },
    {
      title: 'Confirmed',
      value: metrics.confirmedBookings.toString(),
      change: `Completed: ${metrics.completedBookings} • ${timeframeDescription}`,
      icon: CheckCircle,
      accent: `bg-${themeColor}-100 text-${fullColor}`,
    },
    {
      title: 'Avg Booking',
      value: metrics.totalBookings > 0 ? `$${(metrics.bookingRevenue / metrics.totalBookings).toFixed(2)}` : '$0.00',
      change: `${metrics.totalPurchases} tickets sold • ${timeframeDescription}`,
      icon: TrendingUp,
      accent: `bg-${themeColor}-100 text-${fullColor}`,
    },
  ];

  // Filter bookings for the current week
  const bookingsThisWeek = weeklyBookings.filter(booking => {
    const bookingDate = parseLocalDate(booking.booking_date);
    return weekDates.some(date => date.toDateString() === bookingDate.toDateString());
  });

  // Quick actions for Location Manager - 8 items for clean grid
  const quickActions = [
    { title: 'New Booking', icon: Plus, link: '/bookings/create' },
    { title: 'Calendar', icon: Calendar, link: '/bookings/calendar' },
    { title: 'Check-in', icon: CheckCircle, link: '/bookings/check-in' },
    { title: 'Packages', icon: Package, link: '/packages' },
    { title: 'Attractions', icon: Ticket, link: '/attractions' },
    { title: 'Attendants', icon: Users, link: '/manager/attendants' },
    { title: 'Analytics', icon: TrendingUp, link: '/manager/analytics' },
    { title: 'Payments', icon: DollarSign, link: '/manager/payments' },
  ];

  // Status colors (for bookings)
  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      Confirmed: 'bg-emerald-100 text-emerald-800',
      confirmed: 'bg-emerald-100 text-emerald-800',
      Pending: 'bg-amber-100 text-amber-800',
      pending: 'bg-amber-100 text-amber-800',
      Cancelled: 'bg-rose-100 text-rose-800',
      cancelled: 'bg-rose-100 text-rose-800',
      Completed: 'bg-emerald-100 text-emerald-800',
      completed: 'bg-emerald-100 text-emerald-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  // Payment status colors
  const getPaymentColor = (payment: string) => {
    const colors: Record<string, string> = {
      Paid: 'bg-emerald-100 text-emerald-800',
      Partial: 'bg-amber-100 text-amber-800',
      Refunded: 'bg-rose-100 text-rose-800',
      'Credit Card': 'bg-blue-100 text-blue-800',
      PayPal: 'bg-blue-100 text-blue-800',
      Cash: 'bg-gray-100 text-gray-800',
    };
    return colors[payment] || 'bg-gray-100 text-gray-800';
  };

  // Filter all bookings by status for the table (shows ALL bookings for this location, not just this week)
  const filteredBookings = selectedStatus === 'all' 
    ? allBookings 
    : allBookings.filter(booking => booking.status.toLowerCase() === selectedStatus.toLowerCase());

  return (
    <div className="min-h-screen p-4 md:p-8 space-y-8">
      {/* Header with Timeframe Selector */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-2">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-1">
            Dashboard
          </h1>
          <p className="text-sm text-gray-600">
          Manage your location's bookings and operations efficiently
          </p>
        </div>
        
        {/* Timeframe Selector */}
        <div className="flex items-center gap-2 mt-4 md:mt-0">
          <Clock size={16} className="text-gray-500" />
          <select
            value={metricsTimeframe}
            onChange={(e) => setMetricsTimeframe(e.target.value as TimeframeType)}
            className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="last_24h">Last 24 Hours</option>
            <option value="last_7d">Last 7 Days</option>
            <option value="last_30d">Last 30 Days</option>
            <option value="all_time">All Time</option>
          </select>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {metricsCards.map((metric, index) => {
          const Icon = metric.icon;
          return (
            <div
              key={index}
              className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex flex-col gap-2 hover:shadow-md transition-shadow min-h-[120px]"
            >
              <div className="flex items-center gap-2">
                <div className={`p-2 rounded-lg ${metric.accent}`}><Icon size={20} /></div>
                <span className="text-base font-semibold text-gray-800">{metric.title}</span>
              </div>
              {loading ? (
                <div className="animate-pulse space-y-2 mt-2">
                  <div className="h-8 bg-gray-200 rounded w-16"></div>
                  <div className="h-3 bg-gray-200 rounded w-20"></div>
                </div>
              ) : (
                <>
                  <div className="flex items-end gap-2 mt-2">
                    <CounterAnimation value={metric.value} className="text-2xl font-bold text-gray-900" />
                  </div>
                  <p className="text-xs mt-1 text-gray-400">{metric.change}</p>
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Quick Actions Card */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <h2 className="text-base font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <Zap className={`w-4 h-4 text-${fullColor}`} /> Quick Actions
        </h2>
        <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
          {quickActions.map((action, index) => {
            const Icon = action.icon;
            return (
              <Link
                key={index}
                to={action.link}
                className={`flex flex-col items-center justify-center bg-${fullColor} text-white py-2.5 px-1.5 rounded-lg text-xs font-medium transition hover:opacity-90 hover:scale-[1.02] active:scale-95`}
              >
                <Icon size={16} />
                <span className="mt-1 text-center leading-tight">{action.title}</span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Calendar */}
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Calendar className={`w-5 h-5 text-${fullColor}`} /> Calendar
            </h2>
            {/* View Toggle */}
            <div className="flex items-center bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setCalendarView('day')}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  calendarView === 'day' 
                    ? `bg-white text-${fullColor} shadow-sm` 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <CalendarDays size={14} />
                Day
              </button>
              <button
                onClick={() => setCalendarView('week')}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  calendarView === 'week' 
                    ? `bg-white text-${fullColor} shadow-sm` 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <List size={14} />
                Week
              </button>
              <button
                onClick={() => setCalendarView('month')}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  calendarView === 'month' 
                    ? `bg-white text-${fullColor} shadow-sm` 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Grid size={14} />
                Month
              </button>
            </div>
          </div>
          <div className="flex items-center space-x-2 mt-4 md:mt-0">
            <StandardButton 
              onClick={calendarView === 'day' ? goToPreviousDay : calendarView === 'week' ? goToPreviousWeek : goToPreviousMonth}
              variant="secondary"
              size="sm"
              icon={ChevronLeft}
            />
            <span className="text-sm font-medium text-gray-800 min-w-[200px] text-center">
              {calendarView === 'day'
                ? currentDay.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
                : calendarView === 'week' 
                  ? `${weekDates[0].toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} - ${weekDates[6].toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`
                  : currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
              }
            </span>
            <StandardButton 
              onClick={calendarView === 'day' ? goToNextDay : calendarView === 'week' ? goToNextWeek : goToNextMonth}
              variant="secondary"
              size="sm"
              icon={ChevronRight}
            />
            <StandardButton 
              className="ml-2"
              variant="secondary"
              size="sm"
              onClick={() => {
                if (calendarView === 'day') {
                  setCurrentDay(new Date());
                } else if (calendarView === 'week') {
                  setCurrentWeek(new Date());
                } else {
                  setCurrentMonth(new Date());
                }
              }}
            >
              Today
            </StandardButton>
          </div>
        </div>
        
        {/* Day View - Space Schedule Style (Time on left, Spaces as columns) */}
        {calendarView === 'day' && (
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            {sortedRooms.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <p>No spaces configured for this location.</p>
                <p className="text-sm mt-2">Add spaces in the Spaces section to see the daily schedule.</p>
              </div>
            ) : visibleTimeSlots.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <p>No bookings for {currentDay.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}.</p>
              </div>
            ) : (
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b-2 border-gray-200">
                    <th className="sticky left-0 bg-gray-50 z-10 px-4 py-3 text-left text-sm font-semibold text-gray-700 border-r border-gray-200 w-24">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        Time
                      </div>
                    </th>
                    {sortedRooms.map(space => (
                      <th 
                        key={space.id} 
                        className="px-4 py-3 text-center text-sm font-semibold text-gray-700 border-r border-gray-200 min-w-[200px]"
                      >
                        <div className="flex flex-col items-center gap-1">
                          <span>{space.name}</span>
                          <span className="text-xs font-normal text-gray-500 flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            Max {space.capacity || 'N/A'}
                          </span>
                        </div>
                      </th>
                    ))}
                    {/* Unassigned bookings column */}
                    {unassignedBookings.length > 0 && (
                      <th className="px-4 py-3 text-center text-sm font-semibold text-amber-700 border-r border-gray-200 min-w-[200px] bg-amber-50">
                        <div className="flex flex-col items-center gap-1">
                          <span>⚠️ No Room</span>
                          <span className="text-xs font-normal text-amber-600">
                            {unassignedBookings.length} booking{unassignedBookings.length > 1 ? 's' : ''} unassigned
                          </span>
                        </div>
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {visibleTimeSlots.map((slot, slotIndex) => (
                    <tr key={slotIndex} className="border-b border-gray-100 hover:bg-gray-50" style={{ height: '60px' }}>
                      <td className="sticky left-0 bg-white z-10 px-4 py-2 text-sm text-gray-600 border-r border-gray-200 font-medium" style={{ height: '60px' }}>
                        {slot.time}
                      </td>
                      {sortedRooms.map(space => {
                        const booking = getBookingForSlot(space.id, slot);
                        const isOccupied = isSlotOccupied(space.id, slot);
                        
                        if (isOccupied) return null;
                        
                        if (booking) {
                          const rowSpan = getBookingRowSpan(booking);
                          const getBgColor = () => {
                            const status = booking.status?.toLowerCase();
                            if (status === 'confirmed') return 'bg-green-100';
                            if (status === 'pending') return 'bg-yellow-100';
                            if (status === 'checked-in') return 'bg-blue-100';
                            if (status === 'cancelled') return 'bg-red-100';
                            return 'bg-gray-100';
                          };
                          
                          return (
                            <td
                              key={space.id}
                              rowSpan={rowSpan}
                              className={`px-2 py-2 border-r border-gray-200 cursor-pointer hover:opacity-80 transition ${getBgColor()}`}
                              style={{ verticalAlign: 'top' }}
                              onClick={() => setSelectedBooking(booking)}
                            >
                              <div className="flex flex-col p-2 h-full">
                                <div className="font-bold text-xs text-gray-900 mb-1">
                                  {formatTime12Hour(booking.booking_time)} - {formatTime12Hour(calculateEndTime(booking.booking_time, booking.duration || 1, booking.duration_unit || 'hours'))}
                                </div>
                                <div className="font-semibold text-sm text-gray-900 mb-0.5 line-clamp-1">
                                  {booking.guest_name || (booking.customer ? `${booking.customer.first_name} ${booking.customer.last_name}` : 'Guest')}
                                </div>
                                <div className="text-xs text-gray-600 line-clamp-1">{booking.package?.name || 'N/A'}</div>
                                <div className="text-xs text-gray-500 mt-1">{booking.participants} guests</div>
                                <div className="mt-auto pt-1 flex items-center justify-between text-xs border-t border-gray-300/50">
                                  <span className={`font-semibold ${
                                    booking.payment_status === 'paid' ? 'text-green-700' :
                                    booking.payment_status === 'partial' ? 'text-yellow-700' : 'text-red-700'
                                  }`}>
                                    ${parseFloat(String(booking.total_amount || 0)).toFixed(2)}
                                  </span>
                                  <span className="text-gray-600 capitalize">{booking.status}</span>
                                </div>
                              </div>
                            </td>
                          );
                        }
                        
                        return (
                          <td
                            key={space.id}
                            className="px-2 py-2 border-r border-gray-200 text-center text-gray-300 hover:bg-blue-50 transition"
                            style={{ height: '60px' }}
                          >
                            —
                          </td>
                        );
                      })}
                      {/* Unassigned bookings column */}
                      {unassignedBookings.length > 0 && (() => {
                        const booking = getBookingForSlot(0, slot);
                        const isOccupied = isSlotOccupied(0, slot);
                        
                        if (isOccupied) return null;
                        
                        if (booking) {
                          const rowSpan = getBookingRowSpan(booking);
                          return (
                            <td
                              key="unassigned"
                              rowSpan={rowSpan}
                              className="px-2 py-2 border-r border-gray-200 cursor-pointer hover:opacity-80 transition bg-amber-50"
                              style={{ verticalAlign: 'top' }}
                              onClick={() => setSelectedBooking(booking)}
                            >
                              <div className="flex flex-col p-2 h-full">
                                <div className="font-bold text-xs text-amber-900 mb-1">
                                  {formatTime12Hour(booking.booking_time)} - {formatTime12Hour(calculateEndTime(booking.booking_time, booking.duration || 1, booking.duration_unit || 'hours'))}
                                </div>
                                <div className="font-semibold text-sm text-gray-900 mb-0.5 line-clamp-1">
                                  {booking.guest_name || (booking.customer ? `${booking.customer.first_name} ${booking.customer.last_name}` : 'Guest')}
                                </div>
                                <div className="text-xs text-gray-600 line-clamp-1">{booking.package?.name || 'N/A'}</div>
                                <div className="text-xs text-gray-500 mt-1">{booking.participants} guests</div>
                                <div className="text-xs text-amber-600 mt-1 font-medium">⚠️ No room assigned</div>
                                <div className="mt-auto pt-1 flex items-center justify-between text-xs border-t border-amber-300/50">
                                  <span className={`font-semibold ${
                                    booking.payment_status === 'paid' ? 'text-green-700' :
                                    booking.payment_status === 'partial' ? 'text-yellow-700' : 'text-red-700'
                                  }`}>
                                    ${parseFloat(String(booking.total_amount || 0)).toFixed(2)}
                                  </span>
                                  <span className="text-gray-600 capitalize">{booking.status}</span>
                                </div>
                              </div>
                            </td>
                          );
                        }
                        
                        return (
                          <td
                            key="unassigned"
                            className="px-2 py-2 border-r border-gray-200 text-center text-amber-300 bg-amber-50/50"
                            style={{ height: '60px' }}
                          >
                            —
                          </td>
                        );
                      })()}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Week View */}
        {calendarView === 'week' && (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="w-24 px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200">
                  Time
                </th>
                {weekDates.map((date, index) => (
                  <th key={index} className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200 last:border-r-0">
                    <div>{date.toLocaleDateString('en-US', { weekday: 'short' })}</div>
                    <div className="text-xs text-gray-400">{date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {/* Generate time slots based on actual bookings */}
              {(() => {
                // Get all unique time slots (hour:minute) from bookings
                const bookingTimes = new Set<string>();
                bookingsThisWeek.forEach(booking => {
                  const [hour, minute] = booking.booking_time.split(':');
                  bookingTimes.add(`${hour}:${minute}`);
                });
                
                // Sort times chronologically
                const sortedTimes = Array.from(bookingTimes).sort((a, b) => {
                  const [hourA, minA] = a.split(':').map(Number);
                  const [hourB, minB] = b.split(':').map(Number);
                  return (hourA * 60 + minA) - (hourB * 60 + minB);
                });
                
                // If no bookings, show message
                if (sortedTimes.length === 0) {
                  return (
                    <tr>
                      <td colSpan={8} className="px-3 py-8 text-center text-gray-500">
                        No bookings for this week
                      </td>
                    </tr>
                  );
                }
                
                return sortedTimes.map((timeSlot) => {
                  const [hourStr, minuteStr] = timeSlot.split(':');
                  const hour = parseInt(hourStr);
                  const minute = minuteStr;
                  const isPM = hour >= 12;
                  const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
                  const time = `${displayHour}:${minute} ${isPM ? 'PM' : 'AM'}`;
                  
                  return (
                    <tr key={timeSlot} className="hover:bg-gray-50">
                      <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-gray-900 border-r border-gray-200">
                        {time}
                      </td>
                      {weekDates.map((date, dateIndex) => {
                        const dateStr = date.toDateString();
                        const bookingsForCell = bookingsThisWeek.filter(
                          booking => {
                            const bookingDate = parseLocalDate(booking.booking_date);
                            const [bookingHour, bookingMinute] = booking.booking_time.split(':');
                            return bookingDate.toDateString() === dateStr && 
                                   `${bookingHour}:${bookingMinute}` === timeSlot;
                          }
                        );
                        
                        return (
                          <td key={dateIndex} className="px-3 py-2 text-sm text-gray-500 border-r border-gray-200 last:border-r-0 align-top min-w-[150px]">
                            {bookingsForCell.length > 0 ? (
                              <div
                                className={`w-full p-2 rounded-lg border transition-all duration-200 ${
                                  bookingsForCell.some(b => b.status === 'confirmed' || b.status === 'Confirmed')
                                    ? 'bg-emerald-50 border-emerald-200'
                                    : bookingsForCell.some(b => b.status === 'pending' || b.status === 'Pending')
                                    ? 'bg-amber-50 border-amber-200'
                                    : 'bg-rose-50 border-rose-200'
                                }`}
                              >
                                {/* First booking preview */}
                                <div className="text-xs space-y-1">
                                  <div className="font-semibold text-gray-900 truncate">
                                    {bookingsForCell[0].guest_name || (bookingsForCell[0].customer ? `${bookingsForCell[0].customer.first_name} ${bookingsForCell[0].customer.last_name}` : 'Guest')}
                                  </div>
                                  <div className="text-gray-600 truncate">
                                    {bookingsForCell[0].package?.name || 'Package'}
                                  </div>
                                  <div className="flex items-center gap-1 text-gray-500">
                                    <Users size={10} />
                                    <span>{bookingsForCell[0].participants}</span>
                                  </div>
                                </div>
                                
                                {/* View more button */}
                                {bookingsForCell.length > 1 && (
                                  <StandardButton
                                    onClick={() => setSelectedTimeSlot({ date, hour, minute, bookings: bookingsForCell })}
                                    variant="ghost"
                                    size="sm"
                                    className={`w-full mt-2 pt-2 border-t text-xs font-medium ${
                                      bookingsForCell.some(b => b.status === 'confirmed' || b.status === 'Confirmed')
                                        ? 'border-emerald-200 text-emerald-700'
                                        : bookingsForCell.some(b => b.status === 'pending' || b.status === 'Pending')
                                        ? 'border-amber-200 text-amber-700'
                                        : 'border-rose-200 text-rose-700'
                                    }`}
                                  >
                                    +{bookingsForCell.length - 1} more
                                  </StandardButton>
                                )}
                                
                                {/* Single booking - click to view details */}
                                {bookingsForCell.length === 1 && (
                                  <StandardButton
                                    onClick={() => setSelectedBooking(bookingsForCell[0])}
                                    variant="ghost"
                                    size="sm"
                                    className={`w-full mt-2 pt-2 border-t text-xs font-medium ${
                                      bookingsForCell[0].status === 'confirmed' || bookingsForCell[0].status === 'Confirmed'
                                        ? 'border-emerald-200 text-emerald-700'
                                        : bookingsForCell[0].status === 'pending' || bookingsForCell[0].status === 'Pending'
                                        ? 'border-amber-200 text-amber-700'
                                        : 'border-rose-200 text-rose-700'
                                    }`}
                                  >
                                    View details
                                  </StandardButton>
                                )}
                              </div>
                            ) : (
                              <span className="text-gray-300">-</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                });
              })()}
            </tbody>
          </table>
        </div>
        )}

        {/* Month View */}
        {calendarView === 'month' && (
          <div className="rounded-lg border border-gray-200">
            {/* Days of week header */}
            <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-200">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                <div key={day} className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {day}
                </div>
              ))}
            </div>
            
            {/* Calendar grid */}
            <div className="grid grid-cols-7">
              {monthDays.map((day, index) => {
                if (!day) {
                  return (
                    <div key={`empty-${index}`} className="min-h-[100px] bg-gray-50 border-b border-r border-gray-200" />
                  );
                }
                
                const dayBookings = getBookingsForDay(day);
                const isToday = day.toDateString() === new Date().toDateString();
                const hasBookings = dayBookings.length > 0;
                
                // Count by status
                const confirmedCount = dayBookings.filter(b => b.status === 'confirmed' || b.status === 'Confirmed').length;
                const pendingCount = dayBookings.filter(b => b.status === 'pending' || b.status === 'Pending').length;
                const cancelledCount = dayBookings.filter(b => b.status === 'cancelled' || b.status === 'Cancelled').length;
                
                return (
                  <div
                    key={day.toISOString()}
                    onClick={() => hasBookings && setSelectedDayBookings({ date: day, bookings: dayBookings })}
                    className={`min-h-[100px] p-2 border-b border-r border-gray-200 transition-all ${
                      hasBookings ? 'cursor-pointer hover:bg-gray-50' : ''
                    } ${isToday ? `bg-${themeColor}-50` : 'bg-white'}`}
                  >
                    <div className={`text-sm font-medium mb-2 ${isToday ? `text-${fullColor}` : 'text-gray-900'}`}>
                      {day.getDate()}
                    </div>
                    
                    {hasBookings && (
                      <div className="space-y-1">
                        {confirmedCount > 0 && (
                          <div className="flex items-center gap-1 text-xs">
                            <div className="w-2 h-2 rounded-full bg-emerald-500" />
                            <span className="text-gray-600">{confirmedCount} confirmed</span>
                          </div>
                        )}
                        {pendingCount > 0 && (
                          <div className="flex items-center gap-1 text-xs">
                            <div className="w-2 h-2 rounded-full bg-amber-500" />
                            <span className="text-gray-600">{pendingCount} pending</span>
                          </div>
                        )}
                        {cancelledCount > 0 && (
                          <div className="flex items-center gap-1 text-xs">
                            <div className="w-2 h-2 rounded-full bg-rose-500" />
                            <span className="text-gray-600">{cancelledCount} cancelled</span>
                          </div>
                        )}
                        <div className={`text-xs font-medium text-${fullColor} mt-1`}>
                          {dayBookings.length} total
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* New Bookings Table - Below Calendar */}
      {newBookings.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Sparkles className={`w-5 h-5 text-${fullColor}`} /> New Bookings
              <span className="ml-2 text-xs font-medium bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                {newBookings.length} in last 48 hours
              </span>
            </h2>
            <Link to="/bookings" className={`px-4 py-2 text-sm bg-${themeColor}-100 text-${fullColor} rounded-lg hover:bg-${themeColor}-200 transition`}>
              View All
            </Link>
          </div>
         
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 font-medium">Customer</th>
                  <th className="px-4 py-3 font-medium">Package</th>
                  <th className="px-4 py-3 font-medium">Date & Time</th>
                  <th className="px-4 py-3 font-medium">Guests</th>
                  <th className="px-4 py-3 font-medium">Amount</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {newBookings.slice(0, 10).map((booking: any) => (
                  <tr key={booking.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">
                        {booking.guest_name || (booking.customer ? `${booking.customer.first_name} ${booking.customer.last_name}` : 'Guest')}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-gray-900">{booking.package?.name || 'N/A'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-gray-900">
                        {new Date(booking.booking_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </div>
                      <div className="text-xs text-gray-500">
                        {booking.booking_time ? formatTime12Hour(booking.booking_time) : 'N/A'}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-900">{booking.participants || 0}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      ${parseFloat(String(booking.total_amount || 0)).toFixed(2)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(booking.status)}`}>
                        {booking.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Link to={`/admin/bookings/${booking.id}`} className={`text-sm text-${fullColor} hover:underline`}>
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Ticket Purchases Table */}
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Ticket className={`w-5 h-5 text-${fullColor}`} /> Recent Ticket Purchases
          </h2>
        </div>
      
        {ticketPurchases.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 font-medium">Purchase Date</th>
                  <th className="px-4 py-3 font-medium">Customer</th>
                  <th className="px-4 py-3 font-medium">Attraction</th>
                  <th className="px-4 py-3 font-medium">Quantity</th>
                  <th className="px-4 py-3 font-medium">Amount</th>
                  <th className="px-4 py-3 font-medium">Payment Method</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {ticketPurchases.map(purchase => (
                  <tr key={purchase.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">
                        {new Date(purchase.purchase_date || purchase.created_at).toLocaleDateString('en-US', { 
                          month: 'short', 
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(purchase.purchase_date || purchase.created_at).toLocaleTimeString('en-US', { 
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">
                        {purchase.customer_name || purchase.guest_name || (purchase.customer ? `${purchase.customer.first_name} ${purchase.customer.last_name}` : 'Guest')}
                      </div>
                      <div className="text-xs text-gray-500">
                        {purchase.location_name || purchase.location?.name || 'N/A'}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">
                        {purchase.attraction_name || purchase.attraction?.name || 'Attraction'}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="font-medium text-gray-900">{purchase.quantity}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-bold text-gray-900">${parseFloat(String(purchase.total_amount)).toFixed(2)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-900 capitalize">
                        {purchase.payment_method ? purchase.payment_method.replace('_', ' ') : 'N/A'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={getStatusColor(purchase.status) + ' px-2 py-1 text-xs font-medium rounded-full capitalize'}>
                        {purchase.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            No ticket purchases found for this week
          </div>
        )}
      </div>

      {/* Bookings Table */}
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-900">All Bookings</h2>
          <div className="flex flex-wrap gap-2 mt-4 md:mt-0">
            <select 
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className={`px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-${themeColor}-400`}
            >
              <option value="all">All Statuses</option>
              <option value="confirmed">Confirmed</option>
              <option value="pending">Pending</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>
      
        {filteredBookings.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 font-medium w-32">Date & Time</th>
                  <th className="px-4 py-3 font-medium w-48">Customer</th>
                  <th className="px-4 py-3 font-medium w-40">Package</th>
                  <th className="px-4 py-3 font-medium w-20">Participants</th>
                  <th className="px-4 py-3 font-medium w-24">Status</th>
                  <th className="px-4 py-3 font-medium w-24">Payment</th>
                  <th className="px-4 py-3 font-medium w-28">Amount</th>
                  <th className="px-4 py-3 font-medium w-28">Paid Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredBookings.map(booking => (
                  <tr key={booking.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">
                        {parseLocalDate(booking.booking_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </div>
                      <div className="text-xs text-gray-500">{convertTo12Hour(booking.booking_time)}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <div className="font-medium text-gray-900">
                          {booking.guest_name || (booking.customer ? `${booking.customer.first_name} ${booking.customer.last_name}` : 'Guest')}
                        </div>
                        <div className="text-xs text-gray-500">{booking.guest_email || booking.customer?.email}</div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {booking.package?.name || <span className="text-gray-400">-</span>}
                    </td>
                    <td className="px-4 py-3">{booking.participants}</td>
                    <td className="px-4 py-3">
                      <span className={getStatusColor(booking.status) + ' px-2 py-1 text-xs font-medium rounded-full'}>
                        {booking.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={getPaymentColor(booking.payment_status) + ' px-2 py-1 text-xs font-medium rounded-full'}>
                        {booking.payment_status}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium">${parseFloat(String(booking.total_amount || 0)).toFixed(2)}</td>
                    <td className="px-4 py-3 font-medium">${parseFloat(String(booking.amount_paid || 0)).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            No bookings found for the selected criteria
          </div>
        )}
      </div>

      {/* Time Slot Modal - Shows all bookings for a specific date/time */}
      {selectedTimeSlot && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200" onClick={() => setSelectedTimeSlot(null)}>
          <div className="bg-white rounded-xl shadow-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto transform transition-all duration-300 scale-100 animate-in zoom-in-95" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">
                    {selectedTimeSlot.date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    {(() => {
                      const isPM = selectedTimeSlot.hour >= 12;
                      const displayHour = selectedTimeSlot.hour > 12 ? selectedTimeSlot.hour - 12 : selectedTimeSlot.hour === 0 ? 12 : selectedTimeSlot.hour;
                      // Get the first booking's minutes to display accurate time
                      const firstBooking = selectedTimeSlot.bookings[0];
                      const minutes = firstBooking.booking_time.split(':')[1];
                      return `${displayHour}:${minutes} ${isPM ? 'PM' : 'AM'}`;
                    })()} - {selectedTimeSlot.bookings.length} Booking{selectedTimeSlot.bookings.length > 1 ? 's' : ''}
                  </p>
                </div>
                <StandardButton
                  onClick={() => setSelectedTimeSlot(null)}
                  variant="ghost"
                  size="sm"
                  icon={X}
                />
              </div>

              <div className="space-y-3">
                {selectedTimeSlot.bookings.map((booking, index) => (
                  <div
                    key={index}
                    onClick={() => {
                      setSelectedBooking(booking);
                      setSelectedTimeSlot(null);
                    }}
                    className="border border-gray-200 rounded-lg p-4 hover:shadow-lg transition-all duration-300 cursor-pointer hover:border-gray-300 transform hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-900">
                          {booking.package?.name || 'Package Booking'}
                        </h4>
                        <p className="text-sm text-gray-600 mt-1">
                          {booking.guest_name || (booking.customer ? `${booking.customer.first_name} ${booking.customer.last_name}` : 'Guest')}
                        </p>
                        <div className="flex gap-4 mt-2 text-sm text-gray-500">
                          {/* selected room */}
                          <span className="flex items-center gap-1">
                            <House size={14} />
                            {booking.room ? booking.room.name : 'N/A'}
                          </span>
      
                          <span className="flex items-center gap-1">
                            <Users size={14} />
                            {booking.participants} participants
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock size={14} />
                            {(() => {
                              const [hours, minutes] = booking.booking_time.split(':');
                              const hour = parseInt(hours);
                              const isPM = hour >= 12;
                              const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
                              return `${displayHour}:${minutes} ${isPM ? 'PM' : 'AM'}`;
                            })()}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <span className={`px-3 py-1 text-xs font-medium rounded-full ${
                          booking.status === 'confirmed' || booking.status === 'Confirmed'
                            ? 'bg-emerald-100 text-emerald-800'
                            : booking.status === 'pending' || booking.status === 'Pending'
                            ? 'bg-amber-100 text-amber-800'
                            : booking.status === 'completed' || booking.status === 'Completed'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}>
                          {booking.status}
                        </span>
                        <span className="text-sm font-semibold text-gray-900">
                          ${parseFloat(booking.total_amount).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Bottom Close Button */}
              <div className="mt-6 pt-4 border-t border-gray-200">
                <StandardButton
                  onClick={() => setSelectedTimeSlot(null)}
                  variant="secondary"
                  size="md"
                  className="w-full"
                >
                  Close
                </StandardButton>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Day Bookings Modal - Shows all bookings for a specific day (Month View) */}
      {selectedDayBookings && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200" 
          onClick={() => setSelectedDayBookings(null)}
        >
          <div 
            className="bg-white rounded-xl shadow-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto transform transition-all duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">
                    {selectedDayBookings.date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    {selectedDayBookings.bookings.length} booking{selectedDayBookings.bookings.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <StandardButton
                  onClick={() => setSelectedDayBookings(null)}
                  variant="ghost"
                  size="sm"
                  icon={X}
                />
              </div>

              <div className="space-y-3">
                {selectedDayBookings.bookings
                  .sort((a, b) => a.booking_time.localeCompare(b.booking_time))
                  .map((booking, index) => {
                    const [hourStr, minuteStr] = booking.booking_time.split(':');
                    const hour = parseInt(hourStr);
                    const isPM = hour >= 12;
                    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
                    const timeDisplay = `${displayHour}:${minuteStr} ${isPM ? 'PM' : 'AM'}`;
                    
                    return (
                      <div 
                        key={index}
                        onClick={() => {
                          setSelectedBooking(booking);
                          setSelectedDayBookings(null);
                        }}
                        className={`p-4 rounded-lg border transition-all cursor-pointer hover:shadow-md ${
                          booking.status === 'confirmed' || booking.status === 'Confirmed'
                            ? 'bg-emerald-50 border-emerald-200 hover:border-emerald-300'
                            : booking.status === 'pending' || booking.status === 'Pending'
                            ? 'bg-amber-50 border-amber-200 hover:border-amber-300'
                            : 'bg-rose-50 border-rose-200 hover:border-rose-300'
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <Clock size={14} className="text-gray-400" />
                              <span className="text-sm font-medium text-gray-900">{timeDisplay}</span>
                            </div>
                            <h4 className="font-semibold text-gray-900 mt-2">
                              {booking.package?.name || 'Package Booking'}
                            </h4>
                            <p className="text-sm text-gray-600 mt-1">
                              {booking.guest_name || (booking.customer ? `${booking.customer.first_name} ${booking.customer.last_name}` : 'Guest')}
                            </p>
                            <div className="flex items-center gap-2 mt-2 text-sm text-gray-500">
                              <Users size={14} />
                              <span>{booking.participants} participants</span>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <span className={`px-3 py-1 text-xs font-medium rounded-full ${
                              booking.status === 'confirmed' || booking.status === 'Confirmed'
                                ? 'bg-emerald-100 text-emerald-800'
                                : booking.status === 'pending' || booking.status === 'Pending'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}>
                              {booking.status}
                            </span>
                            <span className="text-sm font-semibold text-gray-900">
                              ${parseFloat(booking.total_amount).toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>

              <div className="mt-6 pt-4 border-t border-gray-200">
                <StandardButton
                  onClick={() => setSelectedDayBookings(null)}
                  variant="secondary"
                  size="md"
                  className="w-full"
                >
                  Close
                </StandardButton>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Booking Detail Modal */}
      {selectedBooking && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200" onClick={() => setSelectedBooking(null)}>
          <div className="bg-white rounded-xl shadow-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto transform transition-all duration-300 scale-100 animate-in zoom-in-95" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-semibold text-gray-900">
                  Booking Details
                </h3>
                <StandardButton
                  onClick={() => setSelectedBooking(null)}
                  variant="ghost"
                  size="sm"
                  icon={X}
                />
              </div>

              {/* Customer Information */}
              <div className="mb-6">
                <h4 className="text-sm font-semibold text-gray-700 uppercase mb-3">Customer Information</h4>
                <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                  <div className="flex items-center">
                    <Users className="h-4 w-4 text-gray-400 mr-3" />
                    <span className="font-medium text-gray-900">
                      {selectedBooking.guest_name || (selectedBooking.customer ? `${selectedBooking.customer.first_name} ${selectedBooking.customer.last_name}` : 'Guest')}
                    </span>
                  </div>
                  <div className="text-sm text-gray-600 ml-7">{selectedBooking.guest_email || selectedBooking.customer?.email || 'No email provided'}</div>
                  <div className="text-sm text-gray-600 ml-7">{selectedBooking.guest_phone || selectedBooking.customer?.phone || 'No phone provided'}</div>
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
                      selectedBooking.status === 'confirmed' || selectedBooking.status === 'Confirmed'
                        ? 'bg-emerald-100 text-emerald-800'
                        : selectedBooking.status === 'pending' || selectedBooking.status === 'Pending'
                        ? 'bg-amber-100 text-amber-800'
                        : selectedBooking.status === 'completed' || selectedBooking.status === 'Completed'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}>
                      {selectedBooking.status}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Type</span>
                    <span className="px-3 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                      Package Booking
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
                    <span className="text-sm text-gray-900">
                      {parseLocalDate(selectedBooking.booking_date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </span>
                  </div>
                  <div className="flex items-center">
                    <Clock className="h-4 w-4 text-gray-400 mr-3" />
                    <span className="text-sm text-gray-900">{convertTo12Hour(selectedBooking.booking_time)}</span>
                  </div>
                  {selectedBooking.duration && (
                    <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                      <span className="text-sm text-gray-600">Duration</span>
                      <span className="text-sm font-medium text-gray-900">{formatDurationDisplay(selectedBooking.duration, selectedBooking.duration_unit)}</span>
                    </div>
                  )}
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

              {/* Location */}
              {selectedBooking.location && (
                <div className="mb-6">
                  <h4 className="text-sm font-semibold text-gray-700 uppercase mb-3">Location</h4>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center">
                      <MapPin className="h-4 w-4 text-gray-400 mr-3" />
                      <span className="font-medium text-gray-900">{selectedBooking.location.name || 'N/A'}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Room */}
              {selectedBooking.room && (
                <div className="mb-6">
                  <h4 className="text-sm font-semibold text-gray-700 uppercase mb-3">Space</h4>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-900">{selectedBooking.room.name || 'N/A'}</span>
                      {selectedBooking.room.capacity && (
                        <span className="text-sm text-gray-600">Capacity: {selectedBooking.room.capacity}</span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Guest of Honor Section - Only show if data exists */}
              {selectedBooking.guest_of_honor_name && (
                <div className="mb-6">
                  <h4 className="text-sm font-semibold text-gray-700 uppercase mb-3">Guest of Honor</h4>
                  <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Name</span>
                      <span className="text-sm font-medium text-gray-900">{selectedBooking.guest_of_honor_name}</span>
                    </div>
                    {selectedBooking.guest_of_honor_age && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Age</span>
                        <span className="text-sm font-medium text-gray-900">{selectedBooking.guest_of_honor_age} years old</span>
                      </div>
                    )}
                    {selectedBooking.guest_of_honor_gender && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Gender</span>
                        <span className="text-sm font-medium text-gray-900 capitalize">{selectedBooking.guest_of_honor_gender}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Attractions */}
              {selectedBooking.attractions && Array.isArray(selectedBooking.attractions) && selectedBooking.attractions.length > 0 && (
                <div className="mb-6">
                  <h4 className="text-sm font-semibold text-gray-700 uppercase mb-3">Additional Attractions</h4>
                  <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                    {selectedBooking.attractions.map((attraction: any, index: number) => (
                      <div key={index} className="flex items-center justify-between py-2 border-b border-gray-200 last:border-0">
                        <div className="flex-1">
                          <span className="text-sm font-medium text-gray-900">{attraction.name || 'Unknown Attraction'}</span>
                          {attraction.description && (
                            <p className="text-xs text-gray-500 mt-1">{attraction.description}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-4 ml-4">
                          {(attraction.quantity || attraction.pivot?.quantity) && (
                            <span className="text-sm text-gray-600">Qty: {attraction.quantity || attraction.pivot?.quantity}</span>
                          )}
                          {attraction.price && (
                            <span className="text-sm font-medium text-gray-900">${Number(attraction.price).toFixed(2)}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Add-Ons */}
              {((selectedBooking.addOns || (selectedBooking as any).add_ons) && Array.isArray(selectedBooking.addOns || (selectedBooking as any).add_ons) && (selectedBooking.addOns || (selectedBooking as any).add_ons).length > 0) && (
                <div className="mb-6">
                  <h4 className="text-sm font-semibold text-gray-700 uppercase mb-3">Add-Ons</h4>
                  <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                    {(selectedBooking.addOns || (selectedBooking as any).add_ons).map((addon: any, index: number) => (
                      <div key={index} className="flex items-center justify-between py-2 border-b border-gray-200 last:border-0">
                        <div className="flex-1">
                          <span className="text-sm font-medium text-gray-900">{addon.name || 'Unknown Add-On'}</span>
                          {addon.description && (
                            <p className="text-xs text-gray-500 mt-1">{addon.description}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-4 ml-4">
                          {(addon.quantity || addon.pivot?.quantity) && (
                            <span className="text-sm text-gray-600">Qty: {addon.quantity || addon.pivot?.quantity}</span>
                          )}
                          {addon.price && (
                            <span className="text-sm font-medium text-gray-900">${Number(addon.price).toFixed(2)}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Payment Information */}
              <div className="mb-6">
                <h4 className="text-sm font-semibold text-gray-700 uppercase mb-3">Payment</h4>
                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Total Amount</span>
                    <span className="text-lg font-bold text-gray-900">${parseFloat(selectedBooking.total_amount).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Payment Status</span>
                    <span className={`px-3 py-1 text-xs font-medium rounded-full ${
                      selectedBooking.payment_status === 'Paid' || selectedBooking.payment_status === 'paid'
                        ? 'bg-emerald-100 text-emerald-800'
                        : selectedBooking.payment_status === 'Partial' || selectedBooking.payment_status === 'partial'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}>
                      {selectedBooking.payment_status}
                    </span>
                  </div>
                  {selectedBooking.payment_method && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Payment Method</span>
                      <span className="text-sm font-medium text-gray-900">{selectedBooking.payment_method}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Special Requests */}
              {selectedBooking.special_requests && (
                <div className="mb-6">
                  <h4 className="text-sm font-semibold text-gray-700 uppercase mb-3">Special Requests</h4>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-gray-900">{selectedBooking.special_requests}</p>
                  </div>
                </div>
              )}

              {/* Bottom Close Button */}
              <div className="mt-6 pt-4 border-t border-gray-200">
                <StandardButton
                  onClick={() => setSelectedBooking(null)}
                  variant="secondary"
                  size="md"
                  className="w-full"
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

export default LocationManagerDashboard;