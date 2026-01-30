/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Calendar,
  AlertTriangle,
  DollarSign,
  CheckCircle,
  ChevronRight,
  ChevronLeft,
  Plus,
  Zap,
  Ticket,
  Users,
  TrendingUp,
  QrCode,
  Grid,
  List,
  X,
  Sparkles,
  Clock,
  CalendarDays,
} from 'lucide-react';
import CounterAnimation from '../../components/ui/CounterAnimation';
import StandardButton from '../../components/ui/StandardButton';
import { getStoredUser } from '../../utils/storage';
import bookingService from '../../services/bookingService';
import { bookingCacheService } from '../../services/BookingCacheService';
import MetricsService, { type TimeframeType } from '../../services/MetricsService';
import { metricsCacheService } from '../../services/MetricsCacheService';
import { useThemeColor } from '../../hooks/useThemeColor';
import { parseLocalDate } from '../../utils/timeFormat';
import { roomService, type Room } from '../../services/RoomService';
import { roomCacheService } from '../../services/RoomCacheService';

const AttendantDashboard: React.FC = () => {
  const { themeColor, fullColor } = useThemeColor();
   const [currentWeek, setCurrentWeek] = useState(new Date());
   const [currentMonth, setCurrentMonth] = useState(new Date());
   const [currentDay, setCurrentDay] = useState(new Date());
   const [calendarView, setCalendarView] = useState<'day' | 'week' | 'month'>('month');
   const [loading, setLoading] = useState(true);
   const [locationId, setLocationId] = useState<number>(1);
   const [selectedDayBookings, setSelectedDayBookings] = useState<{ date: Date; bookings: any[] } | null>(null);
   
   // Timeframe selector for metrics
   const [metricsTimeframe, setMetricsTimeframe] = useState<TimeframeType>('all_time');
   const [timeframeDescription, setTimeframeDescription] = useState('All Time');
   
   // Rooms for daily view
   const [rooms, setRooms] = useState<Room[]>([]);
   
   // Data states
   const [weeklyBookings, setWeeklyBookings] = useState<any[]>([]);
   const [dailyBookings, setDailyBookings] = useState<any[]>([]);
   const [monthlyBookings, setMonthlyBookings] = useState<any[]>([]);
   const [ticketPurchases, setTicketPurchases] = useState<any[]>([]);
   const [recentBookings, setRecentBookings] = useState<any[]>([]);
   const [newBookings, setNewBookings] = useState<any[]>([]);
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

   // Get user location on mount
   useEffect(() => {
     const user = getStoredUser();
     if (user?.location_id) {
       setLocationId(user.location_id);
     }
   }, []);

   // Background sync: Fetch fresh bookings data on component mount
   // This ensures the cache is always up-to-date when user visits the dashboard
   useEffect(() => {
     if (!locationId) return;
     
     const syncBookingsInBackground = async () => {
       try {
         console.log('🔄 [AttendantDashboard] Background sync: Fetching fresh bookings...');
         
         // Fetch all bookings from API (last 30 days + next 30 days for comprehensive cache)
         const today = new Date();
         const thirtyDaysAgo = new Date(today);
         thirtyDaysAgo.setDate(today.getDate() - 30);
         const thirtyDaysAhead = new Date(today);
         thirtyDaysAhead.setDate(today.getDate() + 30);
         
         const bookingsResponse = await bookingService.getBookings({
           location_id: locationId,
           date_from: thirtyDaysAgo.toISOString().split('T')[0],
           date_to: thirtyDaysAhead.toISOString().split('T')[0],
           per_page: 500,
         });
         
         const bookings = bookingsResponse.data.bookings || [];
         console.log('✅ [AttendantDashboard] Background sync: Fetched', bookings.length, 'bookings');
         
         // Update cache with fresh data
         if (bookings.length > 0) {
           await bookingCacheService.cacheBookings(bookings, { locationId });
           console.log('✅ [AttendantDashboard] Background sync: Cache updated');
         }
       } catch (error) {
         console.error('⚠️ [AttendantDashboard] Background sync failed:', error);
         // Don't throw - this is a background operation
       }
     };
     
     // Run sync in background (don't block UI)
     syncBookingsInBackground();
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
             console.log('📦 [AttendantDashboard] Loaded', filteredRooms.length, 'spaces from cache');
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

   // Fetch new bookings (created in last 24-48 hours) - use cache for faster loading
   useEffect(() => {
     const fetchNewBookings = async () => {
       if (!locationId) return;
       try {
         const now = new Date();
         const twoDaysAgo = new Date(now);
         twoDaysAgo.setDate(now.getDate() - 2);
         
         // Try cache first for instant loading
         const cachedBookings = await bookingCacheService.getFilteredBookingsFromCache({
           location_id: locationId,
         });
         
         if (cachedBookings && cachedBookings.length > 0) {
           const recentlyCreated = cachedBookings.filter((booking: any) => {
             const createdAt = new Date(booking.created_at);
             return createdAt >= twoDaysAgo;
           });
           setNewBookings(recentlyCreated);
           console.log('📦 [AttendantDashboard] Loaded', recentlyCreated.length, 'new bookings from cache');
           return;
         }
         
         // Fallback to API if cache empty
         const response = await bookingService.getBookings({
           location_id: locationId,
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
   }, [locationId]);

   // Fetch metrics data (when location or timeframe changes)
   // Uses cache-first approach: display cached data instantly, then refresh in background
   useEffect(() => {
     const fetchMetricsData = async () => {
       if (!locationId) return;
       
       try {
         // Step 1: Try to load from cache first for instant display (with timeframe)
         const cachedData = await metricsCacheService.getCachedMetrics<typeof metrics>('attendant', locationId, metricsTimeframe);
         
         if (cachedData) {
           console.log('📦 [AttendantDashboard] Loaded metrics from cache for timeframe:', metricsTimeframe);
           setMetrics(cachedData.metrics);
           setTicketPurchases(cachedData.recentPurchases || []);
           setRecentBookings(cachedData.recentBookings || []);
           setLoading(false);
         }
         
         // Step 2: Fetch fresh data from API in background with timeframe
         console.log('🔄 [AttendantDashboard] Fetching fresh metrics from API...');
         const metricsResponse = await MetricsService.getAttendantMetrics({
           location_id: locationId,
           timeframe: metricsTimeframe,
         });
         
         console.log('📊 Attendant Metrics Response:', metricsResponse);
         
         // Update timeframe description from API
         if (metricsResponse.timeframe) {
           setTimeframeDescription(metricsResponse.timeframe.description);
         }
         
         // Step 3: Update state with fresh data (smooth transition)
         setMetrics(metricsResponse.metrics);
         setTicketPurchases(metricsResponse.recentPurchases || []);
         setRecentBookings(metricsResponse.recentBookings || []);
         
         // Step 4: Cache the fresh data for next time (with timeframe)
         await metricsCacheService.cacheMetrics('attendant', {
           metrics: metricsResponse.metrics,
           recentPurchases: metricsResponse.recentPurchases || [],
           recentBookings: metricsResponse.recentBookings || [],
         }, locationId, metricsTimeframe);
         
         console.log('✅ [AttendantDashboard] Metrics cached successfully for timeframe:', metricsTimeframe);
         
       } catch (error) {
         console.error('Error fetching metrics data:', error);
       } finally {
         setLoading(false);
       }
     };
     
     fetchMetricsData();
   }, [locationId, metricsTimeframe]);

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

   // Fetch weekly calendar data (changes when week changes)
   // Uses cache service for faster loading, syncs in background
   useEffect(() => {
     const fetchWeeklyData = async () => {
       if (!locationId) return;
       
       try {
         const weekStart = weekDates[0];
         const weekEnd = weekDates[6];
         
         const bookingParams = {
           location_id: locationId,
           date_from: weekStart.toISOString().split('T')[0],
           date_to: weekEnd.toISOString().split('T')[0],
         };
         
         // Try to get from cache first
         const cachedBookings = await bookingCacheService.getFilteredBookingsFromCache(bookingParams);
         
         if (cachedBookings && cachedBookings.length > 0) {
           setWeeklyBookings(cachedBookings);
         } else {
           // No cache, fetch from API
           const bookingsResponse = await bookingService.getBookings({
             ...bookingParams,
             per_page: 100,
           });
           const bookings = bookingsResponse.data.bookings || [];
           setWeeklyBookings(bookings);
           // Cache the fetched bookings
           await bookingCacheService.cacheBookings(bookings, { locationId });
         }
         
       } catch (error) {
         console.error('Error fetching weekly data:', error);
       }
     };
     
     fetchWeeklyData();
   }, [locationId, currentWeek, weekDates]);
   
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

   // Fetch daily calendar data
   useEffect(() => {
     const fetchDailyData = async () => {
       if (!locationId || calendarView !== 'day') return;
       
       try {
         // Format date as YYYY-MM-DD for booking_date filter
         const year = currentDay.getFullYear();
         const month = String(currentDay.getMonth() + 1).padStart(2, '0');
         const day = String(currentDay.getDate()).padStart(2, '0');
         const dateStr = `${year}-${month}-${day}`;
         console.log('📅 [AttendantDashboard] Fetching daily bookings for:', dateStr);
         
         // Check if cache has any data first (like SpaceSchedule)
         const hasCachedBookings = await bookingCacheService.hasCachedData();
         
         if (hasCachedBookings) {
           // Cache exists - use filtered results by date only
           console.log('[AttendantDashboard] Cache exists, filtering for date:', dateStr);
           const cachedBookings = await bookingCacheService.getFilteredBookingsFromCache({
             booking_date: dateStr,
           });
           console.log('[AttendantDashboard] Filtered bookings from cache:', cachedBookings?.length || 0);
           setDailyBookings((cachedBookings || []) as any[]);
         } else {
           // No cache available, fetch from API
           console.log('🔄 [AttendantDashboard] No cache, fetching from API...');
           const bookingsResponse = await bookingService.getBookings({
             booking_date: dateStr,
             user_id: getStoredUser()?.id,
             per_page: 100,
           });
           const bookings = bookingsResponse.data.bookings || [];
           console.log('✅ [AttendantDashboard] Fetched', bookings.length, 'bookings');
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
   }, [locationId, currentDay, calendarView]);

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
       if (!locationId || calendarView !== 'month') return;
       
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
           // Filter by location
           bookings = bookings.filter(b => b.location_id === locationId);
           setMonthlyBookings(bookings);
         } else {
           // No cache, fetch from API
           const bookingsResponse = await bookingService.getBookings({
             location_id: locationId,
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
   }, [locationId, currentMonth, calendarView]);

   // Get bookings count for a specific day
   const getBookingsForDay = (date: Date) => {
     return monthlyBookings.filter(booking => {
       const bookingDate = parseLocalDate(booking.booking_date);
       return bookingDate.toDateString() === date.toDateString();
     });
   };

   // Dynamic metrics cards
   const metricsCards = [
     {
       title: 'Total Bookings',
       value: metrics.totalBookings.toString(),
       change: `${metrics.totalParticipants} participants • ${timeframeDescription}`,
       icon: Calendar,
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
       title: 'Pending Approvals',
       value: metrics.pendingBookings.toString(),
       change: `Require attention • ${timeframeDescription}`,
       icon: AlertTriangle,
       accent: 'bg-amber-100 text-amber-600',
     },
     {
       title: 'Confirmed',
       value: metrics.confirmedBookings.toString(),
       change: `Completed: ${metrics.completedBookings} • ${timeframeDescription}`,
       icon: CheckCircle,
       accent: 'bg-emerald-100 text-emerald-600',
     },
     {
       title: 'Total Revenue',
       value: `$${metrics.totalRevenue.toFixed(2)}`,
       change: `Bookings: $${metrics.bookingRevenue.toFixed(2)} • ${timeframeDescription}`,
       icon: DollarSign,
       accent: 'bg-green-100 text-green-600',
     },
     {
       title: 'Ticket Sales',
       value: metrics.totalPurchases.toString(),
       change: `Revenue: $${metrics.purchaseRevenue.toFixed(2)} • ${timeframeDescription}`,
       icon: Ticket,
       accent: 'bg-purple-100 text-purple-600',
     },
   ];

   // Filter bookings for the current week
   const bookingsThisWeek = weeklyBookings.filter(booking => {
     const bookingDate = parseLocalDate(booking.booking_date);
     return weekDates.some(date => date.toDateString() === bookingDate.toDateString());
   });

   // Quick actions for attendant - 8 items for clean grid
   const quickActions = [
     { title: 'New Booking', icon: Plus, link: '/bookings/create' },
     { title: 'Calendar', icon: Calendar, link: '/bookings/calendar' },
     { title: 'Check-in', icon: QrCode, link: '/bookings/check-in' },
     { title: 'Packages', icon: DollarSign, link: '/packages' },
     { title: 'Attractions', icon: Ticket, link: '/attractions' },
     { title: 'Ticket Check-in', icon: Ticket, link: '/attractions/check-in' },
     { title: 'Customers', icon: Users, link: '/customers' },
     { title: 'Bookings', icon: TrendingUp, link: '/bookings' },
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
       paid: 'bg-emerald-100 text-emerald-800',
       Partial: 'bg-amber-100 text-amber-800',
       partial: 'bg-amber-100 text-amber-800',
       Refunded: 'bg-rose-100 text-rose-800',
       refunded: 'bg-rose-100 text-rose-800',
       'Credit Card': 'bg-blue-100 text-blue-800',
       credit_card: 'bg-blue-100 text-blue-800',
       PayPal: 'bg-blue-100 text-blue-800',
       paypal: 'bg-blue-100 text-blue-800',
       Cash: 'bg-gray-100 text-gray-800',
       cash: 'bg-gray-100 text-gray-800',
     };
     return colors[payment] || 'bg-gray-100 text-gray-800';
   };

   // Filter bookings by status for the table
   const filteredBookings = recentBookings;

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
     const interval = 30; // 30-minute intervals
     
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

   // Filter to only show time slots that have bookings (like SpaceSchedule)
   const visibleTimeSlots = dailyTimeSlots.filter(slot => {
     return sortedRooms.some(space => {
       return dailyBookings.some(booking => {
         if (booking.room_id !== space.id) return false;
         const [bookingHour, bookingMin] = booking.booking_time.split(':').map(Number);
         // Check if this slot is start of a booking or covered by a booking
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
   });

   // Get booking for a specific space and time slot
   const getBookingForSlot = (spaceId: number, slot: { hour: number; minute: number }) => {
     return dailyBookings.find(booking => {
       if (booking.room_id !== spaceId) return false;
       const [bookingHour, bookingMin] = booking.booking_time.split(':').map(Number);
       return bookingHour === slot.hour && bookingMin === slot.minute;
     });
   };

   // Check if a slot is occupied by a booking that started earlier
   const isSlotOccupied = (spaceId: number, slot: { hour: number; minute: number }) => {
     return dailyBookings.some(booking => {
       if (booking.room_id !== spaceId) return false;
       const [startHour, startMin] = booking.booking_time.split(':').map(Number);
       const startInMinutes = startHour * 60 + startMin;
       const slotInMinutes = slot.hour * 60 + slot.minute;
       
       // Calculate duration in minutes
       let durationMinutes = 60; // Default 1 hour
       if (booking.duration && booking.duration_unit) {
         if (booking.duration_unit === 'hours') durationMinutes = booking.duration * 60;
         else if (booking.duration_unit === 'minutes') durationMinutes = booking.duration;
         else durationMinutes = Math.floor(booking.duration) * 60 + Math.round((booking.duration % 1) * 60);
       }
       
       const endInMinutes = startInMinutes + durationMinutes;
       return slotInMinutes > startInMinutes && slotInMinutes < endInMinutes;
     });
   };

   // Calculate row span for a booking
   const getBookingRowSpan = (booking: any) => {
     let durationMinutes = 60;
     if (booking.duration && booking.duration_unit) {
       if (booking.duration_unit === 'hours') durationMinutes = booking.duration * 60;
       else if (booking.duration_unit === 'minutes') durationMinutes = booking.duration;
       else durationMinutes = Math.floor(booking.duration) * 60 + Math.round((booking.duration % 1) * 60);
     }
     return Math.max(1, Math.ceil(durationMinutes / 30));
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

   return (
       <div className=" min-h-screen md:p-8 space-y-8">
         {/* Header with Timeframe Selector */}
         <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-2">
           <div>
             <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2 mb-1">
                Dashboard
             </h1>
             <p className="text-base text-gray-800">Overview of all bookings and sales</p>
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

         {/* Calendar */}
         <div className="bg-white rounded-xl shadow-sm p-4 md:p-6 border border-gray-100">
           <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
             <div className="flex items-center gap-4">
               <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                 <Calendar className={`w-6 h-6 text-${fullColor}`} /> Calendar
               </h2>
               {/* View Toggle */}
               <div className="flex bg-gray-100 rounded-lg p-1">
                 <button
                   onClick={() => setCalendarView('day')}
                   className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                     calendarView === 'day'
                       ? `bg-white text-${fullColor} shadow-sm`
                       : 'text-gray-600 hover:text-gray-900'
                   }`}
                 >
                   <CalendarDays size={16} />
                   Day
                 </button>
                 <button
                   onClick={() => setCalendarView('week')}
                   className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                     calendarView === 'week'
                       ? `bg-white text-${fullColor} shadow-sm`
                       : 'text-gray-600 hover:text-gray-900'
                   }`}
                 >
                   <List size={16} />
                   Week
                 </button>
                 <button
                   onClick={() => setCalendarView('month')}
                   className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                     calendarView === 'month'
                       ? `bg-white text-${fullColor} shadow-sm`
                       : 'text-gray-600 hover:text-gray-900'
                   }`}
                 >
                   <Grid size={16} />
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
                 variant="primary"
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
                           className="px-4 py-3 text-center text-sm font-semibold text-gray-700 border-r border-gray-200 min-w-[180px]"
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
                     </tr>
                   </thead>
                   <tbody>
                     {visibleTimeSlots.map((slot, slotIndex) => (
                       <tr key={slotIndex} className="border-b border-gray-100 hover:bg-gray-50" style={{ height: '50px' }}>
                         <td className="sticky left-0 bg-white z-10 px-4 py-2 text-sm text-gray-600 border-r border-gray-200 font-medium">
                           {slot.time}
                         </td>
                         {sortedRooms.map(space => {
                           const booking = getBookingForSlot(space.id, slot);
                           const isOccupied = isSlotOccupied(space.id, slot);
                           
                           // Skip rendering if slot is occupied by an earlier booking
                           if (isOccupied) return null;
                           
                           // Render booking cell
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
                               >
                                 <Link to={`/admin/bookings/${booking.id}`} className="block h-full">
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
                                 </Link>
                               </td>
                             );
                           }
                           
                           // Empty cell
                           return (
                             <td
                               key={space.id}
                               className="px-2 py-2 border-r border-gray-200 text-center text-gray-300 hover:bg-blue-50 transition"
                               style={{ height: '50px' }}
                             >
                               —
                             </td>
                           );
                         })}
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
                                       onClick={() => console.log('View more:', bookingsForCell)}
                                       variant="ghost"
                                       size="sm"
                                       className={`w-full mt-2 pt-2 border-t text-xs font-medium hover:underline ${
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
                                       onClick={() => console.log('View booking:', bookingsForCell[0])}
                                       variant="ghost"
                                       size="sm"
                                       className={`w-full mt-2 pt-2 border-t text-xs font-medium hover:underline ${
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
                   {newBookings.length === 0 && (
                     <tr>
                       <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                         No new bookings in the last 48 hours.
                       </td>
                     </tr>
                   )}
                 </tbody>
               </table>
             </div>
           </div>
         )}

         {/* Day Bookings Modal */}
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
                           className={`p-4 rounded-lg border transition-all ${
                             booking.status === 'confirmed' || booking.status === 'Confirmed'
                               ? 'bg-emerald-50 border-emerald-200'
                               : booking.status === 'pending' || booking.status === 'Pending'
                               ? 'bg-amber-50 border-amber-200'
                               : 'bg-rose-50 border-rose-200'
                           }`}
                         >
                           <div className="flex justify-between items-start">
                             <div>
                               <div className="flex items-center gap-2">
                                 <span className="font-semibold text-gray-900">
                                   {booking.guest_name || (booking.customer ? `${booking.customer.first_name} ${booking.customer.last_name}` : 'Guest')}
                                 </span>
                                 <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                                   booking.status === 'confirmed' || booking.status === 'Confirmed'
                                     ? 'bg-emerald-100 text-emerald-800'
                                     : booking.status === 'pending' || booking.status === 'Pending'
                                     ? 'bg-amber-100 text-amber-800'
                                     : 'bg-rose-100 text-rose-800'
                                 }`}>
                                   {booking.status}
                                 </span>
                               </div>
                               <p className="text-sm text-gray-600 mt-1">
                                 {booking.package?.name || 'Package'}
                               </p>
                               <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                                 <span className="flex items-center gap-1">
                                   <Calendar size={14} />
                                   {timeDisplay}
                                 </span>
                                 <span className="flex items-center gap-1">
                                   <Users size={14} />
                                   {booking.participants} participants
                                 </span>
                               </div>
                             </div>
                             <div className="text-right">
                               <div className="font-semibold text-gray-900">
                                 ${parseFloat(booking.total_amount || 0).toFixed(2)}
                               </div>
                               <div className={`text-xs mt-1 ${
                                 booking.payment_status === 'paid' ? 'text-emerald-600' : 'text-amber-600'
                               }`}>
                                 {booking.payment_status}
                               </div>
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

         {/* Quick Actions */}
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

         {/* Recent Attraction Ticket Purchases */}
         <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
           <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
             <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
               <Ticket className={`w-5 h-5 text-${fullColor}`} /> Recent Attraction Ticket Purchases
             </h2>
             <Link to="/attractions/purchases" className={`px-4 py-2 text-sm bg-${themeColor}-100 text-${fullColor} rounded-lg hover:bg-${themeColor}-200 transition`}>
               View All
             </Link>
           </div>
          
           <div className="overflow-x-auto">
             <table className="w-full text-sm text-left">
               <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b">
                 <tr>
                   <th className="px-4 py-3 font-medium">Purchase Date</th>
                   <th className="px-4 py-3 font-medium">Customer</th>
                   <th className="px-4 py-3 font-medium">Attraction</th>
                   <th className="px-4 py-3 font-medium">Quantity</th>
                   <th className="px-4 py-3 font-medium">Amount</th>
                   <th className="px-4 py-3 font-medium">Payment</th>
                   <th className="px-4 py-3 font-medium">Status</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-gray-100">
                 {ticketPurchases.slice(0, 5).map((purchase: any, index: number) => (
                   <tr key={index} className="hover:bg-gray-50">
                     <td className="px-4 py-3">
                       <span className="text-sm text-gray-900">
                         {purchase.purchase_date ? new Date(purchase.purchase_date).toLocaleDateString('en-US', { 
                           year: 'numeric', 
                           month: 'short', 
                           day: 'numeric'
                         }) : 'N/A'}
                       </span>
                     </td>
                     <td className="px-4 py-3">
                       <div className="flex flex-col">
                         <span className="text-sm font-medium text-gray-900">
                           {purchase.customer_name || 'Guest'}
                         </span>
                         <span className="text-xs text-gray-500">{purchase.location_name || 'N/A'}</span>
                       </div>
                     </td>
                     <td className="px-4 py-3">
                       <span className="text-sm text-gray-900">
                         {purchase.attraction_name || 'N/A'}
                       </span>
                     </td>
                     <td className="px-4 py-3">
                       <span className="text-sm text-gray-900">{purchase.quantity || 1}</span>
                     </td>
                     <td className="px-4 py-3">
                       <span className="text-sm font-medium text-gray-900">
                         ${parseFloat(String(purchase.total_amount || 0)).toFixed(2)}
                       </span>
                     </td>
                     <td className="px-4 py-3">
                       <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                         getPaymentColor(purchase.payment_method || 'N/A')
                       }`}>
                         {purchase.payment_method ? purchase.payment_method.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()) : 'N/A'}
                       </span>
                     </td>
                     <td className="px-4 py-3">
                       <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                         getStatusColor(purchase.status || 'N/A')
                       }`}>
                         {purchase.status || 'N/A'}
                       </span>
                     </td>
                   </tr>
                 ))}
                 {ticketPurchases.length === 0 && (
                   <tr>
                     <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                       No recent purchases found.
                     </td>
                   </tr>
                 )}
               </tbody>
             </table>
           </div>
         </div>

         {/* Bookings Table */}
         <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
           <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
             <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
               <TrendingUp className={`w-5 h-5 text-${fullColor}`} /> Recent Bookings
             </h2>
             <Link to="/bookings" className={`px-4 py-2 text-sm bg-${themeColor}-100 text-${fullColor} rounded-lg hover:bg-${themeColor}-200 transition`}>
               View All
             </Link>
           </div>
          
           <div className="overflow-x-auto">
             <table className="w-full text-sm text-left">
               <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b">
                 <tr>
                   <th className="px-4 py-3 font-medium">Reference</th>
                   <th className="px-4 py-3 font-medium">Customer</th>
                   <th className="px-4 py-3 font-medium">Package</th>
                   <th className="px-4 py-3 font-medium">Date & Time</th>
                   <th className="px-4 py-3 font-medium">Participants</th>
                   <th className="px-4 py-3 font-medium">Amount</th>
                   <th className="px-4 py-3 font-medium">Payment</th>
                   <th className="px-4 py-3 font-medium">Status</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-gray-100">
                 {filteredBookings.slice(0, 5).map((booking: any, index: number) => (
                   <tr key={index} className="hover:bg-gray-50 cursor-pointer" onClick={() => console.log('View booking:', booking)}>
                     <td className="px-4 py-3">
                       <span className="text-sm font-medium text-gray-900">
                         {booking.reference_number || 'N/A'}
                       </span>
                     </td>
                     <td className="px-4 py-3">
                       <div className="flex flex-col">
                         <span className="text-sm font-medium text-gray-900">
                           {booking.customer_name || 'Guest'}
                         </span>
                         <span className="text-xs text-gray-500">{booking.location_name || 'N/A'}</span>
                       </div>
                     </td>
                     <td className="px-4 py-3">
                       <div className="flex flex-col">
                         <span className="text-sm text-gray-900">{booking.package_name || 'N/A'}</span>
                         <span className="text-xs text-gray-500">{booking.room_name || 'N/A'}</span>
                       </div>
                     </td>
                     <td className="px-4 py-3">
                       <div className="flex flex-col">
                         <span className="text-sm text-gray-900">
                           {booking.booking_date ? parseLocalDate(booking.booking_date).toLocaleDateString('en-US', { 
                             month: 'short', 
                             day: 'numeric',
                             year: 'numeric'
                           }) : 'N/A'}
                         </span>
                         <span className="text-xs text-gray-500">
                           {booking.booking_time ? new Date(booking.booking_time).toLocaleTimeString('en-US', {
                             hour: '2-digit',
                             minute: '2-digit'
                           }) : 'N/A'}
                         </span>
                       </div>
                     </td>
                     <td className="px-4 py-3">
                       <span className="text-sm text-gray-900">{booking.participants || 0}</span>
                     </td>
                     <td className="px-4 py-3">
                       <span className="text-sm font-medium text-gray-900">
                         ${parseFloat(String(booking.total_amount || 0)).toFixed(2)}
                       </span>
                     </td>
                     <td className="px-4 py-3">
                       <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                         getPaymentColor(booking.payment_status || 'N/A')
                       }`}>
                         {booking.payment_status ? booking.payment_status.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()) : 'N/A'}
                       </span>
                     </td>
                     <td className="px-4 py-3">
                       <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                         getStatusColor(booking.status || 'N/A')
                       }`}>
                         {booking.status || 'N/A'}
                       </span>
                     </td>
                   </tr>
                 ))}
                 {filteredBookings.length === 0 && (
                   <tr>
                     <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                       No bookings found.
                     </td>
                   </tr>
                 )}
               </tbody>
             </table>
           </div>
         </div>
       </div>
   );
};

export default AttendantDashboard;