/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect } from 'react';
import {
  Calendar,
  DollarSign,
  ChevronRight,
  ChevronLeft,
  Plus,
  Search,
  Filter,
  X,
  Activity,
  MapPin,
  Users,
  BarChart3,
  Building,
  CreditCard,
  TrendingUp,
  Target,
  Clock,
  PackageIcon,
  House,
  Grid,
  List,
  Sparkles,
  CalendarDays,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useThemeColor } from '../../hooks/useThemeColor';
import StandardButton from '../../components/ui/StandardButton';
import CounterAnimation from '../../components/ui/CounterAnimation';
import LocationSelector from '../../components/admin/LocationSelector';
import bookingService from '../../services/bookingService';
import { bookingCacheService } from '../../services/BookingCacheService';
import { locationService, type Location } from '../../services/LocationService';
import { metricsService, type TimeframeType } from '../../services/MetricsService';
import { metricsCacheService } from '../../services/MetricsCacheService';
import { formatDurationDisplay, convertTo12Hour, parseLocalDate } from '../../utils/timeFormat';
import { roomService, type Room } from '../../services/RoomService';
import { roomCacheService } from '../../services/RoomCacheService';

const CompanyDashboard: React.FC = () => {
  const { themeColor, fullColor } = useThemeColor();
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [currentDay, setCurrentDay] = useState(new Date());
  const [calendarView, setCalendarView] = useState<'day' | 'week' | 'month'>('month');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedLocation, setSelectedLocation] = useState<number | 'all'>('all');
  const [calendarFilter, setCalendarFilter] = useState({
    type: 'all',
    value: ''
  });
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const itemsPerPage = 10;
  const [loading, setLoading] = useState(true);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<{ date: Date; time: string; bookings: any[] } | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<any | null>(null);
  const [selectedDayBookings, setSelectedDayBookings] = useState<{ date: Date; bookings: any[] } | null>(null);
  const [monthlyBookings, setMonthlyBookings] = useState<any[]>([]);

  // Timeframe selector for metrics
  const [metricsTimeframe, setMetricsTimeframe] = useState<TimeframeType>('last_30d');
  const [timeframeDescription, setTimeframeDescription] = useState('Last 30 Days');
  
  // Rooms for daily view
  const [rooms, setRooms] = useState<Room[]>([]);
  
  // New bookings tracking
  const [newBookings, setNewBookings] = useState<any[]>([]);

  // Data states
  const [locations, setLocations] = useState<Location[]>([]);
  const [weeklyBookings, setWeeklyBookings] = useState<any[]>([]);
  const [dailyBookings, setDailyBookings] = useState<any[]>([]);
  // All data (unfiltered) for location performance
  const [allWeeklyBookings, setAllWeeklyBookings] = useState<any[]>([]);
  const [allTicketPurchases] = useState<any[]>([]);
  // Location stats from API (for company_admin)
  const [apiLocationStats, setApiLocationStats] = useState<any>(null);
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

  // Get dates for the current week - moved up to avoid dependency issues
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
    newDate.setMonth(newDate.getMonth() - 1);
    setCurrentMonth(newDate);
  };

  const goToNextMonth = () => {
    const newDate = new Date(currentMonth);
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

  // Fetch monthly calendar data (changes when month changes) - USE CACHE FIRST
  useEffect(() => {
    const fetchMonthlyData = async () => {
      if (calendarView !== 'month') return;
      
      try {
        const year = currentMonth.getFullYear();
        const month = currentMonth.getMonth();
        const monthStart = new Date(year, month, 1);
        const monthEnd = new Date(year, month + 1, 0);
        
        const dateParams = {
          date_from: monthStart.toISOString().split('T')[0],
          date_to: monthEnd.toISOString().split('T')[0],
        };
        
        // Try cache first for instant loading
        let bookings = await bookingCacheService.getFilteredBookingsFromCache(dateParams);
        
        if (bookings && bookings.length > 0) {
          // Filter by location if needed
          if (selectedLocation !== 'all') {
            bookings = bookings.filter(b => b.location_id === selectedLocation);
          }
          setMonthlyBookings(bookings);
        } else {
          // No cache, fetch from API
          const bookingsResponse = await bookingService.getBookings({
            location_id: selectedLocation === 'all' ? undefined : selectedLocation,
            ...dateParams,
            per_page: 500,
          });
          
          bookings = bookingsResponse.data.bookings || [];
          setMonthlyBookings(bookings);
          // Cache for next time
          await bookingCacheService.cacheBookings(bookings);
        }
        
      } catch (error) {
        console.error('Error fetching monthly data:', error);
      }
    };
    
    fetchMonthlyData();
  }, [currentMonth, calendarView, selectedLocation]);

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

  // Generate time slots for the SpaceSchedule-style daily view (30-min intervals from 8 AM to 10 PM)
  const generateTimeSlots = () => {
    const slots: { time: string; slot: string }[] = [];
    for (let hour = 8; hour <= 22; hour++) {
      const slot00 = `${hour.toString().padStart(2, '0')}:00`;
      const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
      const ampm = hour >= 12 ? 'PM' : 'AM';
      slots.push({ time: `${displayHour}:00 ${ampm}`, slot: slot00 });
      if (hour < 22) {
        const slot30 = `${hour.toString().padStart(2, '0')}:30`;
        slots.push({ time: `${displayHour}:30 ${ampm}`, slot: slot30 });
      }
    }
    return slots;
  };

  const dailyTimeSlots = generateTimeSlots();

  // Filter to only show time slots that have bookings
  const visibleTimeSlots = dailyTimeSlots.filter(slotObj => {
    return sortedRooms.some(space => {
      return dailyBookings.some(booking => {
        if (booking.room_id !== space.id) return false;
        const bookingTime = booking.booking_time?.substring(0, 5);
        if (!bookingTime) return false;
        const startMinutes = parseInt(bookingTime.split(':')[0]) * 60 + parseInt(bookingTime.split(':')[1]);
        const slotMinutes = parseInt(slotObj.slot.split(':')[0]) * 60 + parseInt(slotObj.slot.split(':')[1]);
        let durationMinutes = 60;
        if (booking.duration && booking.duration_unit) {
          if (booking.duration_unit === 'hours') durationMinutes = booking.duration * 60;
          else if (booking.duration_unit === 'minutes') durationMinutes = booking.duration;
          else durationMinutes = Math.floor(booking.duration) * 60 + Math.round((booking.duration % 1) * 60);
        }
        const endMinutes = startMinutes + durationMinutes;
        return slotMinutes >= startMinutes && slotMinutes < endMinutes;
      });
    });
  });

  // Get booking that starts at a specific time slot for a space
  const getBookingForSlot = (spaceId: number, slot: string) => {
    return dailyBookings.find(booking => {
      if (booking.room_id !== spaceId) return false;
      const bookingTime = booking.booking_time?.substring(0, 5);
      return bookingTime === slot;
    });
  };

  // Check if a slot is occupied by a booking that started earlier
  const isSlotOccupied = (spaceId: number, slot: string) => {
    const slotMinutes = parseInt(slot.split(':')[0]) * 60 + parseInt(slot.split(':')[1]);
    return dailyBookings.some(booking => {
      if (booking.room_id !== spaceId) return false;
      const startTime = booking.start_time?.substring(0, 5);
      if (!startTime) return false;
      const startMinutes = parseInt(startTime.split(':')[0]) * 60 + parseInt(startTime.split(':')[1]);
      const durationMinutes = booking.duration_unit === 'hours' 
        ? (booking.duration || 1) * 60 
        : (booking.duration || 60);
      const endMinutes = startMinutes + durationMinutes;
      return slotMinutes > startMinutes && slotMinutes < endMinutes;
    });
  };

  // Calculate row span based on booking duration
  const getBookingRowSpan = (booking: any) => {
    const durationMinutes = booking.duration_unit === 'hours' 
      ? (booking.duration || 1) * 60 
      : (booking.duration || 60);
    return Math.ceil(durationMinutes / 30);
  };

  // Format time to 12-hour format
  const formatTime12Hour = (time: string) => {
    const [hours, minutes] = time.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const hour12 = hours % 12 || 12;
    return `${hour12}:${minutes.toString().padStart(2, '0')} ${period}`;
  };

  // Calculate end time based on start time and duration
  const calculateEndTime = (startTime: string, duration: number, unit: string) => {
    const [hours, minutes] = startTime.split(':').map(Number);
    const durationMinutes = unit === 'hours' ? duration * 60 : duration;
    const totalMinutes = hours * 60 + minutes + durationMinutes;
    const endHours = Math.floor(totalMinutes / 60) % 24;
    const endMins = totalMinutes % 60;
    return `${endHours.toString().padStart(2, '0')}:${endMins.toString().padStart(2, '0')}`;
  };

  // Fetch all locations on mount
  useEffect(() => {
    const fetchLocations = async () => {
      try {
        console.log('Fetching locations...');
        const response = await locationService.getLocations();
        console.log('Locations response:', response);
        // Handle both response formats: response.data.locations or response.data
        const locationsList = Array.isArray(response.data) ? response.data : [];
        console.log('Locations list:', locationsList);
        setLocations(locationsList);
      } catch (error) {
        console.error('Error fetching locations:', error);
        console.error('Error details:', (error as { response?: unknown; message?: string }).response || (error as { response?: unknown; message?: string }).message);
      }
    };
    
    fetchLocations();
  }, []);

  // Fetch rooms/spaces for daily view - use cache for faster loading
  useEffect(() => {
    const fetchRooms = async () => {
      try {
        // Try cache first for instant loading
        const cachedRooms = await roomCacheService.getCachedRooms();
        if (cachedRooms && cachedRooms.length > 0) {
          setRooms(cachedRooms);
          console.log('📦 [CompanyDashboard] Loaded', cachedRooms.length, 'spaces from cache');
          return;
        }
        // Fallback to API if cache empty
        const response = await roomService.getRooms({ per_page: 100 });
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
  }, []);

  // Fetch new bookings (created in last 24-48 hours) - use cache for faster loading
  useEffect(() => {
    const fetchNewBookings = async () => {
      try {
        const now = new Date();
        const twoDaysAgo = new Date(now);
        twoDaysAgo.setDate(now.getDate() - 2);
        
        // Try cache first for instant loading
        const cachedBookings = await bookingCacheService.getFilteredBookingsFromCache({});
        
        if (cachedBookings && cachedBookings.length > 0) {
          const recentlyCreated = cachedBookings.filter((booking: any) => {
            const createdAt = new Date(booking.created_at);
            return createdAt >= twoDaysAgo;
          });
          setNewBookings(recentlyCreated);
          console.log('📦 [CompanyDashboard] Loaded', recentlyCreated.length, 'new bookings from cache');
          return;
        }
        
        // Fallback to API if cache empty
        const response = await bookingService.getBookings({
          per_page: 50,
        });
        
        const allBookings = response.data.bookings || [];
        // Filter bookings created in the last 48 hours
        const recentlyCreated = allBookings.filter((booking: any) => {
          const createdAt = new Date(booking.created_at);
          return createdAt >= twoDaysAgo;
        });
        
        setNewBookings(recentlyCreated);
      } catch (error) {
        console.error('Error fetching new bookings:', error);
      }
    };
    fetchNewBookings();
  }, []);

  // Fetch daily calendar data
  useEffect(() => {
    const fetchDailyData = async () => {
      if (calendarView !== 'day') return;
      
      try {
        const dateStr = currentDay.toISOString().split('T')[0];
        console.log('📅 [CompanyDashboard] Fetching daily bookings for:', dateStr);
        
        const bookingParams: any = {
          booking_date: dateStr,
        };
        
        if (selectedLocation !== 'all') {
          bookingParams.location_id = selectedLocation;
        }
        
        // Try to get from cache first - filter by exact date
        const cachedBookings = await bookingCacheService.getFilteredBookingsFromCache(bookingParams);
        
        if (cachedBookings && cachedBookings.length > 0) {
          console.log('📦 [CompanyDashboard] Using cached bookings:', cachedBookings.length);
          setDailyBookings(cachedBookings);
        } else {
          // Fetch from API for specific date
          console.log('🔄 [CompanyDashboard] Fetching from API...');
          const bookingsResponse = await bookingService.getBookings({
            booking_date: dateStr,
            location_id: selectedLocation === 'all' ? undefined : selectedLocation,
            per_page: 100,
          });
          const bookings = bookingsResponse.data.bookings || [];
          console.log('✅ [CompanyDashboard] Fetched', bookings.length, 'bookings');
          setDailyBookings(bookings);
          // Cache the fetched bookings
          if (bookings.length > 0) {
            await bookingCacheService.cacheBookings(bookings);
          }
        }
        
      } catch (error) {
        console.error('Error fetching daily data:', error);
      }
    };
    
    fetchDailyData();
  }, [currentDay, calendarView, selectedLocation]);

  // Background sync: Fetch fresh bookings data on component mount
  // This ensures the cache is always up-to-date when user visits the dashboard
  useEffect(() => {
    const syncBookingsInBackground = async () => {
      try {
        console.log('🔄 [CompanyDashboard] Background sync: Fetching fresh bookings...');
        
        // Fetch all bookings from API (last 30 days + next 30 days for comprehensive cache)
        const today = new Date();
        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(today.getDate() - 30);
        const thirtyDaysAhead = new Date(today);
        thirtyDaysAhead.setDate(today.getDate() + 30);
        
        const bookingsResponse = await bookingService.getBookings({
          date_from: thirtyDaysAgo.toISOString().split('T')[0],
          date_to: thirtyDaysAhead.toISOString().split('T')[0],
          per_page: 500,
        });
        
        const bookings = bookingsResponse.data.bookings || [];
        console.log('✅ [CompanyDashboard] Background sync: Fetched', bookings.length, 'bookings');
        
        // Update cache with fresh data
        if (bookings.length > 0) {
          await bookingCacheService.cacheBookings(bookings);
          console.log('✅ [CompanyDashboard] Background sync: Cache updated');
        }
      } catch (error) {
        console.error('⚠️ [CompanyDashboard] Background sync failed:', error);
        // Don't throw - this is a background operation
      }
    };
    
    // Run sync in background (don't block UI)
    syncBookingsInBackground();
  }, []);

  // Fetch metrics data when selectedLocation or timeframe changes
  // PERFORMANCE OPTIMIZATION: Cache-first loading with background refresh
  // - Display cached metrics instantly
  // - Fetch fresh data in background
  // - Smooth update when new data arrives
  useEffect(() => {
    const fetchMetricsData = async () => {
      try {
        console.log('🔄 Starting metrics fetch for location:', selectedLocation, 'timeframe:', metricsTimeframe);
        
        // Step 1: Try to load from cache first for instant display (with timeframe)
        const cachedData = await metricsCacheService.getCachedMetrics<typeof metrics>('company', selectedLocation, metricsTimeframe);
        
        if (cachedData) {
          console.log('📦 [CompanyDashboard] Loaded metrics from cache for timeframe:', metricsTimeframe);
          setMetrics(cachedData.metrics);
          if (cachedData.locationStats) {
            setApiLocationStats(cachedData.locationStats);
          }
          setLoading(false);
        }
        
        // Step 2: Fetch fresh data from API in background with timeframe
        console.log('📊 Fetching metrics from API with timeframe:', metricsTimeframe);
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
        
        // Update timeframe description from API
        if (metricsResponse.timeframe) {
          setTimeframeDescription(metricsResponse.timeframe.description);
        }
        
        // For company_admin, we get locationStats directly from API
        if (metricsResponse.locationStats) {
          setApiLocationStats(metricsResponse.locationStats);
          console.log('📍 Location stats from API (company_admin):', Object.keys(metricsResponse.locationStats).length, 'locations');
        } else if (metricsResponse.locationDetails) {
          console.log('📍 Location details from API (manager/attendant):', metricsResponse.locationDetails.name);
        }
        
        // Step 4: Cache the fresh data for next time (with timeframe)
        await metricsCacheService.cacheMetrics('company', {
          metrics: metricsResponse.metrics,
          locationStats: metricsResponse.locationStats,
        }, selectedLocation, metricsTimeframe);
        
        console.log('✅ [CompanyDashboard] Metrics cached successfully for timeframe:', metricsTimeframe);
        
        // Get current week for calendar and location performance
        const today = new Date();
        const weekStart = new Date(today);
        const day = weekStart.getDay();
        const diff = weekStart.getDate() - day + (day === 0 ? -6 : 1);
        weekStart.setDate(diff);
        
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        
        console.log('📅 Current week range:', weekStart.toISOString().split('T')[0], 'to', weekEnd.toISOString().split('T')[0]);
        
        // Fetch bookings for calendar view - USE CACHE FIRST for faster loading
        const bookingParams = {
          date_from: weekStart.toISOString().split('T')[0],
          date_to: weekEnd.toISOString().split('T')[0],
        };
        
        // Try cache first for instant loading
        let allBookings = await bookingCacheService.getFilteredBookingsFromCache(bookingParams);
        
        if (allBookings && allBookings.length > 0) {
          console.log('📋 Using cached bookings:', allBookings.length);
          // Filter by location if needed
          if (selectedLocation !== 'all') {
            allBookings = allBookings.filter(b => b.location_id === selectedLocation);
          }
          setAllWeeklyBookings(allBookings);
        } else {
          // No cache, fetch from API
          console.log('📋 No cache, fetching from API...');
          const allBookingsParams: any = {
            date_from: weekStart.toISOString().split('T')[0],
            date_to: weekEnd.toISOString().split('T')[0],
            per_page: 500,
          };
          
          if (selectedLocation !== 'all') {
            allBookingsParams.location_id = selectedLocation;
          }
          
          const allBookingsResponse = await bookingService.getBookings(allBookingsParams);
          allBookings = allBookingsResponse.data.bookings || [];
          setAllWeeklyBookings(allBookings);
          // Cache for next time
          await bookingCacheService.cacheBookings(allBookings);
        }
        
        console.log('✅ Loaded', allBookings.length, 'bookings');
        
      } catch (error: any) {
        console.error('❌ Error fetching metrics data:', error);
        console.error('Error details:', error.message || error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchMetricsData();
  }, [selectedLocation, metricsTimeframe]);

  // Fetch weekly calendar data when currentWeek changes
  // Uses cache service for faster loading, syncs in background
  useEffect(() => {
    const fetchWeeklyData = async () => {
      try {
        const weekStart = weekDates[0];
        const weekEnd = weekDates[6];
        
        // Build query params WITHOUT location filter
        const bookingParams: any = {
          date_from: weekStart.toISOString().split('T')[0],
          date_to: weekEnd.toISOString().split('T')[0],
        };
        
        // Try to get from cache first, then sync in background
        const cachedBookings = await bookingCacheService.getFilteredBookingsFromCache(bookingParams);
        
        if (cachedBookings && cachedBookings.length > 0) {
          setWeeklyBookings(cachedBookings);
        } else {
          // No cache, fetch from API
          const bookingsResponse = await bookingService.getBookings({
            ...bookingParams,
            per_page: 500,
          });
          const bookings = bookingsResponse.data.bookings || [];
          setWeeklyBookings(bookings);
          // Cache the fetched bookings
          await bookingCacheService.cacheBookings(bookings);
        }
        
      } catch (error) {
        console.error('Error fetching weekly data:', error);
      }
    };
    
    fetchWeeklyData();
  }, [currentWeek]);

  // Dynamic metrics cards
  const metricsCards = [
    {
      title: 'Total Bookings',
      value: metrics.totalBookings.toString(),
      change: `${metrics.totalParticipants} total participants`,
      trend: 'up',
      icon: Calendar,
      accent: `bg-${themeColor}-100 text-${fullColor}`,
      timeframe: timeframeDescription,
    },
    {
      title: 'New Bookings',
      value: newBookings.length.toString(),
      change: 'Created in last 48 hours',
      trend: newBookings.length > 0 ? 'up' : 'stable',
      icon: Sparkles,
      accent: 'bg-yellow-100 text-yellow-700',
      timeframe: 'Last 48h',
    },
    {
      title: 'Active Locations',
      value: locations.length.toString(),
      change: 'All locations operational',
      trend: 'stable',
      icon: Building,
      accent: `bg-${themeColor}-100 text-${fullColor}`,
      timeframe: 'All Time',
    },
    {
      title: 'Total Revenue',
      value: `$${metrics.totalRevenue.toFixed(2)}`,
      change: `Bookings: $${metrics.bookingRevenue.toFixed(2)} | Tickets: $${metrics.purchaseRevenue.toFixed(2)}`,
      trend: 'up',
      icon: DollarSign,
      accent: `bg-${themeColor}-100 text-${fullColor}`,
      timeframe: timeframeDescription,
    },
    {
      title: 'Participants',
      value: metrics.totalParticipants.toString(),
      change: `${metrics.totalCustomers} unique customers`,
      trend: 'up',
      icon: Users,
      accent: `bg-${themeColor}-100 text-${fullColor}`,
      timeframe: timeframeDescription,
    },
    {
      title: 'Avg. Booking Value',
      value: metrics.totalBookings > 0 ? `$${(metrics.bookingRevenue / metrics.totalBookings).toFixed(2)}` : '$0.00',
      change: `${metrics.totalPurchases} tickets sold`,
      trend: 'up',
      icon: CreditCard,
      accent: `bg-${themeColor}-100 text-${fullColor}`,
      timeframe: timeframeDescription,
    },
  ];

  // Only show bookings for the current week in the calendar and table
  // Filter by selectedLocation in the component (not in the API call)
  const bookingsThisWeek = weeklyBookings.filter(booking => {
    const bookingDate = parseLocalDate(booking.booking_date);
    const isInCurrentWeek = weekDates.some(date => date.toDateString() === bookingDate.toDateString());
    const matchesLocation = selectedLocation === 'all' || booking.location_id === selectedLocation;
    return isInCurrentWeek && matchesLocation;
  });

  // Get unique activities and packages for filter options
  const allActivities = Array.from(new Set(weeklyBookings
    .map(booking => booking.attraction?.name)
    .filter(activity => activity !== null && activity !== undefined))) as string[];
  
  const allPackages = Array.from(new Set(weeklyBookings
    .map(booking => booking.package?.name)
    .filter(pkg => pkg !== null && pkg !== undefined))) as string[];

  // Apply calendar filter
  const filteredCalendarBookings = bookingsThisWeek.filter(booking => {
    if (calendarFilter.type === 'all') return true;
    if (calendarFilter.type === 'activity' && booking.attraction?.name === calendarFilter.value) return true;
    if (calendarFilter.type === 'package' && booking.package?.name === calendarFilter.value) return true;
    if (calendarFilter.type === 'location' && booking.location_id?.toString() === calendarFilter.value) return true;
    return false;
  });

  // Helper function to convert 24-hour time to 12-hour format
  const convertTo12HourFormat = (time24: string): string => {
    // Handle both "HH:MM:SS" and "HH:MM" formats
    const [hourStr, minuteStr] = time24.split(':');
    const hour = parseInt(hourStr);
    const minute = minuteStr;
    
    const isPM = hour >= 12;
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    
    return `${displayHour}:${minute} ${isPM ? 'PM' : 'AM'}`;
  };

  // Get unique time slots from bookings and sort them
  const getBookingTimeSlots = () => {
    const timeSlotsSet = new Set<string>();
    
    filteredCalendarBookings.forEach(booking => {
      const time12Hour = convertTo12HourFormat(booking.booking_time);
      timeSlotsSet.add(time12Hour);
    });
    
    // Convert to array and sort chronologically
    const timeSlotsArray = Array.from(timeSlotsSet);
    
    return timeSlotsArray.sort((a, b) => {
      // Parse time strings to compare
      const parseTime = (timeStr: string) => {
        const [time, period] = timeStr.split(' ');
        const [hourStr, minuteStr] = time.split(':');
        let hour = parseInt(hourStr);
        const minute = parseInt(minuteStr);
        
        if (period === 'PM' && hour !== 12) hour += 12;
        if (period === 'AM' && hour === 12) hour = 0;
        
        return hour * 60 + minute;
      };
      
      return parseTime(a) - parseTime(b);
    });
  };

  const timeSlots = getBookingTimeSlots();

  // Group bookings by time slot and day
  const groupBookingsByTimeAndDay = () => {
    const grouped: {[key: string]: {[key: string]: any[]}} = {};
    
    // Initialize structure with only time slots that have bookings
    timeSlots.forEach(time => {
      grouped[time] = {};
      weekDates.forEach(date => {
        const dateStr = date.toDateString();
        grouped[time][dateStr] = [];
      });
    });
    
    // Populate with bookings
    filteredCalendarBookings.forEach(booking => {
      const bookingDate = parseLocalDate(booking.booking_date);
      const dateStr = bookingDate.toDateString();
      // Convert booking time from 24-hour to 12-hour format to match our time slots
      const time = convertTo12HourFormat(booking.booking_time);
      
      if (grouped[time] && grouped[time][dateStr]) {
        grouped[time][dateStr].push(booking);
      }
    });
    
    return grouped;
  };

  const groupedBookings = groupBookingsByTimeAndDay();

  // Quick actions - 8 items for clean grid
  const quickActions = [
    { title: 'New Booking', icon: Plus, link: '/bookings/create' },
    { title: 'Calendar', icon: Calendar, link: '/bookings/calendar' },
    { title: 'Check-in', icon: Activity, link: '/bookings/check-in' },
    { title: 'Packages', icon: PackageIcon, link: '/packages' },
    { title: 'Attractions', icon: MapPin, link: '/attractions' },
    { title: 'Customers', icon: Users, link: '/customers' },
    { title: 'Analytics', icon: BarChart3, link: '/admin/analytics' },
    { title: 'Locations', icon: Building, link: '/admin/activity' },
  ];

  // Status colors (supporting both capitalized display and lowercase API values)
  const statusColors = {
    Confirmed: 'bg-emerald-100 text-emerald-800',
    Pending: 'bg-amber-100 text-amber-800',
    Cancelled: 'bg-rose-100 text-rose-800',
    Completed: 'bg-blue-100 text-blue-800',
  };

  // Payment status colors
  const paymentColors = {
    Paid: 'bg-emerald-100 text-emerald-800',
    Partial: 'bg-amber-100 text-amber-800',
    Refunded: 'bg-rose-100 text-rose-800',
    Pending: 'bg-amber-100 text-amber-800',
  };

  // Filter bookings by status, location, and search for the table
  const filteredBookings = bookingsThisWeek.filter(booking => {
    const statusMatch = selectedStatus === 'all' || booking.status.toLowerCase() === selectedStatus.toLowerCase();
    const locationMatch = selectedLocation === 'all' || booking.location_id === selectedLocation;
    
    const customerName = booking.customer ? `${booking.customer.first_name} ${booking.customer.last_name}` : booking.guest_name || '';
    const customerEmail = booking.customer?.email || booking.guest_email || '';
    const attractionName = booking.attraction?.name || '';
    const packageName = booking.package?.name || '';
    
    const searchMatch = searchQuery === '' || 
      customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      customerEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
      attractionName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      packageName.toLowerCase().includes(searchQuery.toLowerCase());
    
    return statusMatch && locationMatch && searchMatch;
  });

  // Pagination
  const totalPages = Math.ceil(filteredBookings.length / itemsPerPage);
  const currentBookings = filteredBookings.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Clear calendar filter
  const clearCalendarFilter = () => {
    setCalendarFilter({ type: 'all', value: '' });
  };

  // Get location stats (including both bookings and purchases)
  // Uses API data if available (preferred), otherwise falls back to client-side calculation
  const getLocationStats = () => {
    // If we have API location stats, use them directly (much faster!)
    if (apiLocationStats) {
      console.log('Using API location stats:', apiLocationStats);
      return apiLocationStats;
    }
    
    // Fallback to client-side calculation (for when API data not available)
    const stats: {[key: number]: {name: string, bookings: number, purchases: number, revenue: number, participants: number, utilization: number}} = {};
    
    console.log('=== LOCATION STATS CALCULATION (CLIENT-SIDE FALLBACK) ===');
    console.log('Total locations:', locations.length);
    console.log('Locations:', locations);
    
    locations.forEach(location => {
      stats[location.id] = { name: location.name, bookings: 0, purchases: 0, revenue: 0, participants: 0, utilization: 0 };
    });
    
    console.log('Initialized stats:', stats);
    console.log('All weekly bookings count:', allWeeklyBookings.length);
    console.log('All ticket purchases count:', allTicketPurchases.length);
    
    // Filter all bookings for current week
    const currentWeekAllBookings = allWeeklyBookings.filter(booking => {
      const bookingDate = parseLocalDate(booking.booking_date);
      return weekDates.some(date => date.toDateString() === bookingDate.toDateString());
    });
    
    console.log('Current week bookings:', currentWeekAllBookings.length);
    
    // Add bookings data from ALL bookings (not filtered by location)
    currentWeekAllBookings.forEach(booking => {
      console.log('Processing booking:', booking.id, 'Location ID:', booking.location_id);
      if (booking.location_id && stats[booking.location_id]) {
        stats[booking.location_id].bookings += 1;
        stats[booking.location_id].revenue += parseFloat(String(booking.total_amount || 0));
        stats[booking.location_id].participants += parseInt(String(booking.participants || 0)) || 0;
        console.log(`Updated stats for location ${booking.location_id}:`, stats[booking.location_id]);
      } else {
        console.log('Booking skipped - invalid location_id or location not in stats');
      }
    });
    
    // Add attraction purchases data from ALL purchases (not filtered by location)
    console.log('Total purchases to process:', allTicketPurchases.length);
    
    // Filter purchases for current week
    const currentWeekAllPurchases = allTicketPurchases.filter(purchase => {
      if (!purchase.purchase_date && !purchase.created_at) return false;
      const purchaseDate = new Date(purchase.purchase_date || purchase.created_at);
      return weekDates.some(date => date.toDateString() === purchaseDate.toDateString());
    });
    
    console.log('Purchases for current week:', currentWeekAllPurchases.length);
    
    currentWeekAllPurchases.forEach(purchase => {
      console.log('Processing purchase:', purchase.id);
      // Check if purchase has attraction with location_id
      const locationId = purchase.attraction?.location_id || purchase.location_id;
      console.log('Purchase location_id:', locationId, 'Attraction:', purchase.attraction);
      
      if (locationId && stats[locationId]) {
        stats[locationId].purchases += 1;
        stats[locationId].revenue += parseFloat(String(purchase.total_amount || 0));
        stats[locationId].participants += parseInt(String(purchase.quantity || 0)) || 0;
        console.log(`Added purchase to location ${locationId}:`, stats[locationId]);
      } else {
        console.log('Purchase skipped - no valid location_id or location not in stats');
      }
    });
    
    // Calculate utilization (percentage of max capacity)
    Object.keys(stats).forEach(locationId => {
      const maxCapacity = 200; // Assuming each location has a max capacity of 200
      stats[parseInt(locationId)].utilization = Math.min(100, Math.round((stats[parseInt(locationId)].participants / maxCapacity) * 100));
    });
    
    console.log('Final stats:', stats);
    console.log('=== END LOCATION STATS ===');
    
    return stats;
  };

  const locationStats = getLocationStats();


  // Get top performing locations (top 3)
  const getTopLocations = () => {
    return Object.entries(locationStats)
      .sort(([, a], [, b]) => (b as { revenue: number }).revenue - (a as { revenue: number }).revenue)
      .slice(0, 3);
  };
  const topLocations = getTopLocations();

  console.log('Location Stats:', locationStats);
  console.log('Top Locations:', topLocations);

  // For All Locations Overview: show top 6 by revenue, with expand/collapse
  const [showAllLocations, setShowAllLocations] = useState(false);
  const sortedLocations = Object.entries(locationStats).sort(([, a], [, b]) => (b as { revenue: number }).revenue - (a as { revenue: number }).revenue);
  const displayedLocations = showAllLocations ? sortedLocations : sortedLocations.slice(0, 4);

  // Pagination controls
  const paginate = (pageNumber: number) => setCurrentPage(pageNumber);
  const nextPage = () => setCurrentPage(prev => Math.min(prev + 1, totalPages));
  const prevPage = () => setCurrentPage(prev => Math.max(prev - 1, 1));

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 flex items-center gap-2 mb-1">
            Company Dashboard
          </h1>
          <p className="text-sm md:text-base text-gray-500">Multi-location booking overview and management</p>
        </div>
        <div className="flex items-center gap-3 mt-4 md:mt-0">
          {/* Timeframe Selector */}
          <div className="relative">
            <select
              value={metricsTimeframe}
              onChange={(e) => setMetricsTimeframe(e.target.value as TimeframeType)}
              className={`appearance-none bg-white border border-gray-200 text-gray-700 py-2 px-3 pr-8 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-${fullColor} focus:border-transparent cursor-pointer`}
            >
              <option value="last_24h">Last 24 Hours</option>
              <option value="last_7d">Last 7 Days</option>
              <option value="last_30d">Last 30 Days</option>
              <option value="all_time">All Time</option>
            </select>
            <Clock className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
          <LocationSelector
            locations={locations.map(loc => ({
              id: loc.id.toString(),
              name: loc.name,
              address: loc.address || '',
              city: loc.city || '',
              state: loc.state || ''
            }))}
            selectedLocation={selectedLocation === 'all' ? '' : selectedLocation.toString()}
            onLocationChange={(locationId) => {
              setSelectedLocation(locationId === '' ? 'all' : parseInt(locationId));
              setCurrentPage(1);
            }}
            variant="compact"
            showAllOption={true}
          />
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {metricsCards.map((metric, index) => {
          const Icon = metric.icon;
          return (
            <div
              key={index}
              className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 md:p-5 flex flex-col gap-2 hover:shadow-md transition-shadow min-h-[100px] md:min-h-[120px]"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`p-2 rounded-lg ${metric.accent}`}><Icon size={18} className="md:size-5" /></div>
                  <span className="text-sm md:text-base font-semibold text-gray-800">{metric.title}</span>
                </div>
                {metric.timeframe && (
                  <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{metric.timeframe}</span>
                )}
              </div>
              <div className="flex items-end gap-2 mt-2">
                {loading ? (
                  <div className="h-8 bg-gray-200 rounded w-20 animate-pulse"></div>
                ) : (
                  <CounterAnimation value={metric.value} className="text-xl md:text-2xl font-bold text-gray-900" />
                )}
              </div>
              <p className="text-xs mt-1 text-gray-400">{loading ? '' : metric.change}</p>
            </div>
          );
        })}
      </div>

      {/* Location Performance - Modern Leaderboard & Grid */}
      <div className="bg-white rounded-xl shadow-sm p-4 md:p-6 border border-gray-100">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4 md:mb-6">
          <h2 className="text-lg md:text-xl font-bold text-gray-900 flex items-center gap-2">
            <Target className={`w-5 h-5 md:w-6 md:h-6 text-${fullColor}`} /> Location Performance
          </h2>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Modern Leaderboard for Top Locations */}
          <div className="flex-1">
            <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <TrendingUp className={`w-4 h-4 text-${fullColor}`} /> Top Performing Locations
            </h3>
            {topLocations.length > 0 ? (
              <div className="space-y-4">
                {topLocations.map(([locationId, stats], index) => {
                  const typedStats = stats as { name: string; bookings: number; purchases: number; participants: number; revenue: number; utilization: number };
                  return (
                  <div key={locationId} className={`flex items-center justify-between p-4 rounded-xl shadow-sm border-2 transition-all bg-${themeColor}-50 border-${fullColor}`}>
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-lg bg-${fullColor}`}>
                        {index + 1}
                      </div>
                      <div>
                        <div className="font-bold text-gray-900 text-lg">{typedStats.name}</div>
                        <div className="text-xs text-gray-500">{typedStats.bookings} bookings • {typedStats.purchases} tickets • {typedStats.participants} guests</div>
                      </div>
                    </div>
                    <div className="text-right min-w-[120px]">
                      <div className={`font-bold text-lg text-${fullColor}`}>${typedStats.revenue.toFixed(2)}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-xs font-semibold text-${fullColor}`}>{typedStats.utilization}%</span>
                        <div className={`w-24 h-2 rounded-full overflow-hidden bg-${themeColor}-200`}>
                          <div className={`h-2 rounded-full bg-${fullColor}`} style={{ width: `${typedStats.utilization}%` }}></div>
                        </div>
                      </div>
                    </div>
                  </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <p>No location data available yet</p>
                <p className="text-sm mt-2">Add bookings or ticket purchases to see performance metrics</p>
              </div>
            )}
          </div>

          {/* Compact Grid for All Locations (limit to 6, expandable) */}
          <div className="flex-1">
            <h3 className="font-semibold text-gray-800 mb-4">All Locations Overview</h3>
            {displayedLocations.length > 0 ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {displayedLocations.map(([locationId, stats]) => {
                    const typedStats = stats as { name: string; bookings: number; purchases: number; participants: number; revenue: number; utilization: number };
                    return (
                    <div key={locationId} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow bg-gray-50">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-gray-900 text-sm">{typedStats.name}</span>
                        <div className={`w-3 h-3 rounded-full bg-${fullColor}`} title={`${typedStats.utilization}% utilization`}></div>
                      </div>
                      <div className="flex items-center gap-4 mb-2">
                        <div className="flex-1">
                          <div className="text-xs text-gray-500">Bookings</div>
                          <div className={`font-bold text-lg text-${fullColor}`}>{typedStats.bookings}</div>
                        </div>
                        <div className="flex-1">
                          <div className="text-xs text-gray-500">Tickets</div>
                          <div className={`font-bold text-lg text-${fullColor}`}>{typedStats.purchases}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 mb-2">
                        <div className="flex-1">
                          <div className="text-xs text-gray-500">Revenue</div>
                          <div className={`font-bold text-lg text-${fullColor}`}>${typedStats.revenue.toFixed(2)}</div>
                        </div>
                        <div className="flex-1">
                          <div className="text-xs text-gray-500">Utilization</div>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-semibold text-${fullColor}`}>{typedStats.utilization}%</span>
                            <div className={`w-16 h-2 rounded-full overflow-hidden bg-${themeColor}-200`}>
                              <div className={`h-2 rounded-full bg-${fullColor}`} style={{ width: `${typedStats.utilization}%` }}></div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    );
                  })}
                </div>
                {sortedLocations.length > 4 && (
                  <div className="flex justify-center mt-4">
                    <StandardButton
                      variant="secondary"
                      size="sm"
                      onClick={() => setShowAllLocations(v => !v)}
                    >
                      {showAllLocations ? 'Show Less' : `Show All (${sortedLocations.length})`}
                    </StandardButton>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <p>No locations configured</p>
                <p className="text-sm mt-2">Add locations to track performance</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Calendar */}
      <div className="bg-white rounded-xl shadow-sm p-4 md:p-6 border border-gray-100">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4 md:mb-6">
          <div className="flex items-center gap-4">
            <h2 className="text-xl md:text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Calendar className={`w-5 h-5 md:w-6 md:h-6 text-${fullColor}`} /> Calendar
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
              variant="secondary"
              size="sm"
              icon={ChevronLeft}
              onClick={calendarView === 'day' ? goToPreviousDay : calendarView === 'week' ? goToPreviousWeek : goToPreviousMonth}
            />
            <span className="text-sm font-medium text-gray-800 min-w-[200px] text-center">
              {calendarView === 'day'
                ? currentDay.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
                : calendarView === 'week' 
                  ? `${weekDates[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekDates[6].toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`
                  : currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
              }
            </span>
            <StandardButton 
              variant="secondary"
              size="sm"
              icon={ChevronRight}
              onClick={calendarView === 'day' ? goToNextDay : calendarView === 'week' ? goToNextWeek : goToNextMonth}
            />
            <StandardButton 
              variant="secondary" 
              size="sm" 
              className="ml-2"
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
            
            {/* Calendar Filter Toggle - Only show for week view */}
            {calendarView === 'week' && (
            <StandardButton 
              variant={calendarFilter.type !== 'all' ? 'primary' : 'secondary'}
              size="sm"
              className="ml-2"
              onClick={() => setShowFilterPanel(!showFilterPanel)}
            >
              <Filter size={16} className="mr-1" />
              Filter
              {calendarFilter.type !== 'all' && (
                <span className="ml-1 bg-white text-gray-800 rounded-full w-4 h-4 flex items-center justify-center text-xs">
                  !
                </span>
              )}
            </StandardButton>
            )}
          </div>
        </div>
        
        {/* Filter Panel - Only for week view */}
        {showFilterPanel && calendarView === 'week' && (
          <div className="mb-4 md:mb-6 p-3 md:p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-medium text-gray-800 text-sm md:text-base">Filter Calendar</h3>
              <StandardButton 
                variant="ghost"
                size="sm"
                icon={X}
                onClick={() => setShowFilterPanel(false)}
              />
            </div>
            
            <div className="flex flex-wrap gap-3 md:gap-4">
              <div className="flex items-center">
                <input
                  type="radio"
                  id="filter-all"
                  name="calendar-filter"
                  checked={calendarFilter.type === 'all'}
                  onChange={() => setCalendarFilter({ type: 'all', value: '' })}
                  className="mr-2"
                />
                <label htmlFor="filter-all" className="text-sm text-gray-800">
                  Show All
                </label>
              </div>
              
              <div className="flex items-center">
                <input
                  type="radio"
                  id="filter-activity"
                  name="calendar-filter"
                  checked={calendarFilter.type === 'activity'}
                  onChange={() => setCalendarFilter({ type: 'activity', value: allActivities[0] || '' })}
                  className="mr-2"
                />
                <label htmlFor="filter-activity" className="text-sm text-gray-800 mr-2">
                  By Activity
                </label>
                
                {calendarFilter.type === 'activity' && (
                  <select
                    value={calendarFilter.value}
                    onChange={(e) => setCalendarFilter({ type: 'activity', value: e.target.value })}
                    className="px-2 py-1 border border-gray-300 rounded text-sm"
                  >
                    {allActivities.map(activity => (
                      <option key={activity} value={activity}>{activity}</option>
                    ))}
                  </select>
                )}
              </div>
              
              <div className="flex items-center">
                <input
                  type="radio"
                  id="filter-package"
                  name="calendar-filter"
                  checked={calendarFilter.type === 'package'}
                  onChange={() => setCalendarFilter({ type: 'package', value: allPackages[0] || '' })}
                  className="mr-2"
                />
                <label htmlFor="filter-package" className="text-sm text-gray-800 mr-2">
                  By Package
                </label>
                
                {calendarFilter.type === 'package' && (
                  <select
                    value={calendarFilter.value}
                    onChange={(e) => setCalendarFilter({ type: 'package', value: e.target.value })}
                    className="px-2 py-1 border border-gray-300 rounded text-sm"
                  >
                    {allPackages.map(pkg => (
                      <option key={pkg} value={pkg}>{pkg}</option>
                    ))}
                  </select>
                )}
              </div>
              
              <div className="flex items-center">
                <input
                  type="radio"
                  id="filter-location"
                  name="calendar-filter"
                  checked={calendarFilter.type === 'location'}
                  onChange={() => setCalendarFilter({ type: 'location', value: locations[0]?.id.toString() || '' })}
                  className="mr-2"
                />
                <label htmlFor="filter-location" className="text-sm text-gray-800 mr-2">
                  By Location
                </label>
                
                {calendarFilter.type === 'location' && (
                  <select
                    value={calendarFilter.value}
                    onChange={(e) => setCalendarFilter({ type: 'location', value: e.target.value })}
                    className="px-2 py-1 border border-gray-300 rounded text-sm"
                  >
                    {locations.map(location => (
                      <option key={location.id} value={location.id.toString()}>{location.name}</option>
                    ))}
                  </select>
                )}
              </div>
              
              {calendarFilter.type !== 'all' && (
                <StandardButton
                  variant="ghost"
                  size="sm"
                  className="ml-auto"
                  onClick={clearCalendarFilter}
                >
                  <X size={14} className="mr-1" />
                  Clear Filter
                </StandardButton>
              )}
            </div>
            
            {calendarFilter.type !== 'all' && (
              <div className="mt-3 text-sm text-gray-800">
                Showing: {calendarFilter.type === 'activity' ? 'Activity' : calendarFilter.type === 'package' ? 'Package' : 'Location'} - {
                  calendarFilter.type === 'location' 
                    ? locations.find(loc => loc.id.toString() === calendarFilter.value)?.name || calendarFilter.value
                    : calendarFilter.value
                }
              </div>
            )}
          </div>
        )}
        
        {/* Week View - Table-based calendar */}
        {calendarView === 'week' && (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="w-20 md:w-24 px-2 md:px-3 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200">
                  Time
                </th>
                {weekDates.map((date, index) => (
                  <th key={index} className="px-2 md:px-3 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200 last:border-r-0">
                    <div>{date.toLocaleDateString('en-US', { weekday: 'short' })}</div>
                    <div className="text-xs text-gray-400">{date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {timeSlots.length > 0 ? (
                timeSlots.map((time, timeIndex) => (
                  <tr key={timeIndex} className="hover:bg-gray-50">
                    <td className="px-2 md:px-3 py-1 md:py-2 whitespace-nowrap text-xs md:text-sm font-medium text-gray-900 border-r border-gray-200">
                      {time}
                    </td>
                    {weekDates.map((date, dateIndex) => {
                      const dateStr = date.toDateString();
                      const bookingsForCell = groupedBookings[time]?.[dateStr] || [];
                      
                      return (
                        <td key={dateIndex} className="px-2 md:px-3 py-1 md:py-2 text-xs md:text-sm text-gray-500 border-r border-gray-200 last:border-r-0 align-top min-w-[120px] md:min-w-[180px]">
                          {bookingsForCell.length > 0 ? (
                            <div
                              className={`w-full p-2 rounded-lg border transition-all duration-200 ${
                                bookingsForCell.some(b => b.status === 'confirmed')
                                  ? 'bg-emerald-50 border-emerald-200'
                                  : bookingsForCell.some(b => b.status === 'pending')
                                  ? 'bg-amber-50 border-amber-200'
                                  : 'bg-rose-50 border-rose-200'
                              }`}
                            >
                              {/* First booking preview */}
                              <div className="text-xs space-y-1">
                                <div className="font-semibold text-gray-900 truncate">
                                  {bookingsForCell[0].customer ? `${bookingsForCell[0].customer.first_name} ${bookingsForCell[0].customer.last_name}` : bookingsForCell[0].guest_name || 'Guest'}
                                </div>
                                <div className="text-gray-600 truncate">
                                  {bookingsForCell[0].attraction?.name || bookingsForCell[0].package?.name || 'Booking'}
                                </div>
                                <div className="flex items-center gap-1 text-gray-500">
                                  <MapPin size={10} />
                                  <span className="truncate">{bookingsForCell[0].location?.name || 'N/A'}</span>
                                </div>
                                <div className="flex items-center gap-1 text-gray-500">
                                  <Users size={10} />
                                  <span>{bookingsForCell[0].participants}</span>
                                </div>
                              </div>
                              
                              {/* View more button */}
                              {bookingsForCell.length > 1 && (
                                <StandardButton
                                  variant="ghost"
                                  size="sm"
                                  className={`w-full mt-2 pt-2 border-t text-xs font-medium ${
                                    bookingsForCell.some(b => b.status === 'confirmed')
                                      ? 'border-emerald-200 text-emerald-700'
                                      : bookingsForCell.some(b => b.status === 'pending')
                                      ? 'border-amber-200 text-amber-700'
                                      : 'border-rose-200 text-rose-700'
                                  }`}
                                  onClick={() => setSelectedTimeSlot({ date, time, bookings: bookingsForCell })}
                                >
                                  +{bookingsForCell.length - 1} more
                                </StandardButton>
                              )}
                              
                              {/* Single booking - click to view details */}
                              {bookingsForCell.length === 1 && (
                                <StandardButton
                                  variant="ghost"
                                  size="sm"
                                  className={`w-full mt-2 pt-2 border-t text-xs font-medium ${
                                    bookingsForCell[0].status === 'confirmed'
                                      ? 'border-emerald-200 text-emerald-700'
                                      : bookingsForCell[0].status === 'pending'
                                      ? 'border-amber-200 text-amber-700'
                                      : 'border-rose-200 text-rose-700'
                                  }`}
                                  onClick={() => setSelectedBooking(bookingsForCell[0])}
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
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-gray-500">
                    No bookings for this week
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        )}

        {/* Day View - All spaces for a single day */}
        {calendarView === 'day' && (
          <div className="rounded-lg border border-gray-200 overflow-hidden">
            <div className="bg-gray-50 border-b border-gray-200 px-4 py-3">
              <h3 className="font-semibold text-gray-800">
                {currentDay.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
              </h3>
              <p className="text-sm text-gray-500">{dailyBookings.length} bookings across {sortedRooms.length} spaces</p>
            </div>
            
            {sortedRooms.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <House className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>No spaces found for selected location</p>
              </div>
            ) : visibleTimeSlots.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <p>No bookings for {currentDay.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse min-w-[800px]">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="sticky left-0 z-10 bg-gray-100 px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-r border-gray-200 w-24">
                        Time
                      </th>
                      {sortedRooms.map((room) => (
                        <th key={room.id} className="px-3 py-2 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider border-r border-gray-200 min-w-[150px]">
                          <div className="flex flex-col items-center gap-1">
                            <House className={`w-4 h-4 text-${fullColor}`} />
                            <span>{room.name}</span>
                            <span className="text-[10px] font-normal text-gray-400">Cap: {room.capacity || 'N/A'}</span>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {visibleTimeSlots.map((slotObj) => (
                      <tr key={slotObj.slot} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="sticky left-0 z-10 bg-white px-3 py-2 text-xs font-medium text-gray-500 border-r border-gray-200 whitespace-nowrap">
                          {slotObj.time}
                        </td>
                        {sortedRooms.map((room) => {
                          const booking = getBookingForSlot(room.id, slotObj.slot);
                          const isOccupied = isSlotOccupied(room.id, slotObj.slot);
                          
                          if (isOccupied) return null; // Skip cells covered by rowSpan
                          
                          if (booking) {
                            const rowSpan = getBookingRowSpan(booking);
                            const startTime = booking.booking_time?.substring(0, 5) || '';
                            const endTime = calculateEndTime(startTime, booking.duration || 1, booking.duration_unit || 'hours');
                            const isNew = new Date(booking.created_at) > new Date(Date.now() - 48 * 60 * 60 * 1000);
                            
                            return (
                              <td 
                                key={room.id} 
                                rowSpan={rowSpan}
                                className="px-2 py-1 border-r border-gray-200 align-top"
                              >
                                <Link
                                  to={`/admin/bookings/${booking.id}`}
                                  className={`block h-full p-2 rounded-lg text-xs cursor-pointer transition-all hover:shadow-md ${
                                    booking.status === 'confirmed' 
                                      ? 'bg-green-100 border border-green-300 text-green-800'
                                      : booking.status === 'pending'
                                      ? 'bg-yellow-100 border border-yellow-300 text-yellow-800'
                                      : booking.status === 'checked_in'
                                      ? 'bg-blue-100 border border-blue-300 text-blue-800'
                                      : booking.status === 'cancelled'
                                      ? 'bg-red-100 border border-red-300 text-red-800'
                                      : 'bg-gray-100 border border-gray-300 text-gray-800'
                                  }`}
                                >
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="font-semibold truncate">{booking.guest_name || (booking.customer ? `${booking.customer.first_name} ${booking.customer.last_name}` : 'Guest')}</span>
                                    {isNew && (
                                      <span className="flex items-center gap-0.5 text-[9px] font-bold bg-yellow-200 text-yellow-700 px-1 py-0.5 rounded">
                                        <Sparkles size={8} />
                                        NEW
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[10px] opacity-75">
                                    {formatTime12Hour(startTime)} - {formatTime12Hour(endTime)}
                                  </div>
                                  <div className="text-[10px] opacity-75 truncate mt-0.5">
                                    {booking.package?.name || booking.attraction?.name || 'No package'}
                                  </div>
                                  <div className="mt-1">
                                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${
                                      booking.status === 'confirmed' ? 'bg-green-200' :
                                      booking.status === 'pending' ? 'bg-yellow-200' :
                                      booking.status === 'checked_in' ? 'bg-blue-200' :
                                      'bg-gray-200'
                                    }`}>
                                      {booking.status}
                                    </span>
                                  </div>
                                </Link>
                              </td>
                            );
                          }
                          
                          return (
                            <td key={room.id} className="px-2 py-1 border-r border-gray-200 h-10">
                              {/* Empty slot */}
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

      {/* Quick Actions */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <h2 className="text-base font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <Activity className={`w-4 h-4 text-${fullColor}`} /> Quick Actions
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


      {/* Bookings Table */}
      <div className="bg-white rounded-xl shadow-sm p-4 md:p-6 border border-gray-100">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4 md:mb-6">
          <h2 className="text-lg md:text-xl font-semibold text-gray-900">Weekly Bookings</h2>
          <div className="flex flex-wrap gap-2 mt-4 md:mt-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="text"
                placeholder="Search bookings..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full md:w-auto"
              />
            </div>
            <select 
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Statuses</option>
              <option value="confirmed">Confirmed</option>
              <option value="pending">Pending</option>
              <option value="cancelled">Cancelled</option>
              <option value="completed">Completed</option>
            </select>
            <div className="min-w-[200px]">
              <LocationSelector
                locations={locations.map(loc => ({
                  id: loc.id.toString(),
                  name: loc.name,
                  address: loc.address || '',
                  city: loc.city || '',
                  state: loc.state || ''
                }))}
                selectedLocation={selectedLocation === 'all' ? '' : selectedLocation.toString()}
                onLocationChange={(locationId) => {
                  setSelectedLocation(locationId === '' ? 'all' : parseInt(locationId));
                  setCurrentPage(1);
                }}
                variant="compact"
                showAllOption={true}
              />
            </div>
            <StandardButton 
              variant="secondary" 
              size="sm"
            >
              <Filter size={16} className="mr-1" />
              Filter
            </StandardButton>
          </div>
        </div>
      
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b">
              <tr>
                <th className="px-3 md:px-4 py-2 md:py-3 font-medium">Date & Time</th>
                <th className="px-3 md:px-4 py-2 md:py-3 font-medium">Customer</th>
                <th className="px-3 md:px-4 py-2 md:py-3 font-medium">Activity/Package</th>
                <th className="px-3 md:px-4 py-2 md:py-3 font-medium">Location</th>
                <th className="px-3 md:px-4 py-2 md:py-3 font-medium">Participants</th>
                <th className="px-3 md:px-4 py-2 md:py-3 font-medium">Status</th>
                <th className="px-3 md:px-4 py-2 md:py-3 font-medium">Payment</th>
                <th className="px-3 md:px-4 py-2 md:py-3 font-medium">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {currentBookings.length > 0 ? currentBookings.map(booking => {
                const bookingDate = parseLocalDate(booking.booking_date);
                const customerName = booking.customer ? `${booking.customer.first_name} ${booking.customer.last_name}` : booking.guest_name || 'Guest';
                const customerEmail = booking.customer?.email || booking.guest_email || '';
                const activityName = booking.attraction?.name || booking.package?.name || '-';
                const locationName = booking.location?.name || '-';
                const paymentStatus = booking.payment_status === 'paid' ? 'Paid' : 
                                    booking.payment_status === 'partial' ? 'Partial' : 
                                    booking.payment_status === 'refunded' ? 'Refunded' : 'Pending';
                const bookingStatus = booking.status.charAt(0).toUpperCase() + booking.status.slice(1);
                
                return (
                  <tr key={booking.id} className="hover:bg-gray-50">
                    <td className="px-3 md:px-4 py-2 md:py-3">
                      <div className="font-medium text-gray-900 text-xs md:text-sm">
                        {bookingDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </div>
                      <div className="text-xs text-gray-500">{convertTo12Hour(booking.booking_time)}</div>
                    </td>
                    <td className="px-3 md:px-4 py-2 md:py-3">
                      <div>
                        <div className="font-medium text-gray-900 text-xs md:text-sm">{customerName}</div>
                        <div className="text-xs text-gray-500">{customerEmail}</div>
                      </div>
                    </td>
                    <td className="px-3 md:px-4 py-2 md:py-3">
                      <div className="text-xs md:text-sm">
                        {activityName}
                      </div>
                    </td>
                    <td className="px-3 md:px-4 py-2 md:py-3">
                      <span className="text-xs md:text-sm">{locationName}</span>
                    </td>
                    <td className="px-3 md:px-4 py-2 md:py-3">
                      <span className="text-xs md:text-sm">{booking.participants}</span>
                    </td>
                    <td className="px-3 md:px-4 py-2 md:py-3">
                      <span className={`text-xs px-2 py-1 rounded-full ${statusColors[bookingStatus as keyof typeof statusColors]}`}>
                        {bookingStatus}
                      </span>
                    </td>
                    <td className="px-3 md:px-4 py-2 md:py-3">
                      <span className={`text-xs px-2 py-1 rounded-full ${paymentColors[paymentStatus as keyof typeof paymentColors]}`}>
                        {paymentStatus}
                      </span>
                    </td>
                    <td className="px-3 md:px-4 py-2 md:py-3">
                      <span className="font-medium text-xs md:text-sm">${parseFloat(String(booking.total_amount || 0)).toFixed(2)}</span>
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                    No bookings found matching your criteria
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {filteredBookings.length > 0 && (
          <div className="flex items-center justify-between mt-4 md:mt-6">
            <div className="text-sm text-gray-800">
              Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredBookings.length)} of {filteredBookings.length} results
            </div>
            <div className="flex space-x-2">
              <StandardButton
                variant="secondary"
                size="sm"
                onClick={prevPage}
                disabled={currentPage === 1}
              >
                Previous
              </StandardButton>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                // Show pages around current page
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }
                
                return (
                  <StandardButton
                    key={pageNum}
                    variant={currentPage === pageNum ? 'primary' : 'secondary'}
                    size="sm"
                    onClick={() => paginate(pageNum)}
                  >
                    {pageNum}
                  </StandardButton>
                );
              })}
              <StandardButton
                variant="secondary"
                size="sm"
                onClick={nextPage}
                disabled={currentPage === totalPages}
              >
                Next
              </StandardButton>
            </div>
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
                    {selectedTimeSlot.time} - {selectedTimeSlot.bookings.length} Booking{selectedTimeSlot.bookings.length > 1 ? 's' : ''}
                  </p>
                </div>
                <StandardButton
                  variant="ghost"
                  size="sm"
                  icon={X}
                  onClick={() => setSelectedTimeSlot(null)}
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
                          {booking.package?.name || booking.attraction?.name || 'Booking'}
                        </h4>
                        <p className="text-sm text-gray-600 mt-1">
                          {booking.customer ? `${booking.customer.first_name} ${booking.customer.last_name}` : booking.guest_name || 'Guest'}
                        </p>
                        <div className="flex gap-4 mt-2 text-sm text-gray-500">
                          <span className="flex items-center gap-1">
                            <MapPin size={14} />
                            {booking.location?.name || 'N/A'}
                          </span>
                          <span className="flex items-center gap-1">
                            <Users size={14} />
                            {booking.participants} participants
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock size={14} />
                            {convertTo12Hour(booking.booking_time)}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <span className={`px-3 py-1 text-xs font-medium rounded-full ${
                          booking.status === 'confirmed'
                            ? 'bg-emerald-100 text-emerald-800'
                            : booking.status === 'pending'
                            ? 'bg-amber-100 text-amber-800'
                            : booking.status === 'completed'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}>
                          {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                        </span>
                        <span className="text-sm font-semibold text-gray-900">
                          ${parseFloat(String(booking.total_amount || 0)).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Bottom Close Button */}
              <div className="mt-6 pt-4 border-t border-gray-200">
                <StandardButton
                  variant="secondary"
                  size="md"
                  className="w-full"
                  onClick={() => setSelectedTimeSlot(null)}
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
                            <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                              <span className="flex items-center gap-1">
                                <MapPin size={14} />
                                {booking.location?.name || 'N/A'}
                              </span>
                              <span className="flex items-center gap-1">
                                <Users size={14} />
                                {booking.participants} participants
                              </span>
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
                  variant="ghost"
                  size="sm"
                  icon={X}
                  onClick={() => setSelectedBooking(null)}
                />
              </div>

              {/* Customer Information */}
              <div className="mb-6">
                <h4 className="text-sm font-semibold text-gray-700 uppercase mb-3">Customer Information</h4>
                <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                  <div className="flex items-center">
                    <Users className="h-4 w-4 text-gray-400 mr-3" />
                    <span className="font-medium text-gray-900">
                      {selectedBooking.customer ? `${selectedBooking.customer.first_name} ${selectedBooking.customer.last_name}` : selectedBooking.guest_name || 'Guest'}
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
                      selectedBooking.status === 'confirmed'
                        ? 'bg-emerald-100 text-emerald-800'
                        : selectedBooking.status === 'pending'
                        ? 'bg-amber-100 text-amber-800'
                        : selectedBooking.status === 'completed'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}>
                      {selectedBooking.status.charAt(0).toUpperCase() + selectedBooking.status.slice(1)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Type</span>
                    <span className="px-3 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                      {selectedBooking.package ? 'Package Booking' : 'Activity Booking'}
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

              {/* Package/Activity Details */}
              <div className="mb-6">
                <h4 className="text-sm font-semibold text-gray-700 uppercase mb-3">{selectedBooking.package ? 'Package' : 'Activity'}</h4>
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <PackageIcon className="h-4 w-4 text-gray-400 mr-3" />
                      <span className="font-medium text-gray-900">{selectedBooking.package?.name || selectedBooking.attraction?.name || 'N/A'}</span>
                    </div>
                    {(selectedBooking.package?.price || selectedBooking.attraction?.price) && (
                      <span className="text-sm font-medium text-gray-900">${Number(selectedBooking.package?.price || selectedBooking.attraction?.price).toFixed(2)}</span>
                    )}
                  </div>
                  {(selectedBooking.package?.description || selectedBooking.attraction?.description) && (
                    <p className="text-sm text-gray-600 mt-2 ml-7">{selectedBooking.package?.description || selectedBooking.attraction?.description}</p>
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
                    {selectedBooking.location.address && (
                      <p className="text-sm text-gray-600 mt-2 ml-7">{selectedBooking.location.address}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Room */}
              {selectedBooking.room && (
                <div className="mb-6">
                  <h4 className="text-sm font-semibold text-gray-700 uppercase mb-3">Space</h4>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <House className="h-4 w-4 text-gray-400 mr-3" />
                        <span className="font-medium text-gray-900">{selectedBooking.room.name || 'N/A'}</span>
                      </div>
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
                    <span className="text-lg font-bold text-gray-900">${parseFloat(String(selectedBooking.total_amount || 0)).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Payment Status</span>
                    <span className={`px-3 py-1 text-xs font-medium rounded-full ${
                      selectedBooking.payment_status === 'paid'
                        ? 'bg-emerald-100 text-emerald-800'
                        : selectedBooking.payment_status === 'partial'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}>
                      {selectedBooking.payment_status ? selectedBooking.payment_status.charAt(0).toUpperCase() + selectedBooking.payment_status.slice(1) : 'Pending'}
                    </span>
                  </div>
                  {selectedBooking.payment_method && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Payment Method</span>
                      <span className="text-sm font-medium text-gray-900">{selectedBooking.payment_method}</span>
                    </div>
                  )}
                  {selectedBooking.amount_paid && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Amount Paid</span>
                      <span className="text-sm font-medium text-gray-900">${parseFloat(String(selectedBooking.amount_paid || 0)).toFixed(2)}</span>
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
                  variant="secondary"
                  size="md"
                  className="w-full"
                  onClick={() => setSelectedBooking(null)}
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

export default CompanyDashboard;