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
   const [metricsTimeframe, setMetricsTimeframe] = useState<TimeframeType>('last_30d');
   const [timeframeDescription, setTimeframeDescription] = useState('Last 30 Days');
   
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
         // Step 1: Try to load from cache first for instant display
         const cachedData = await metricsCacheService.getCachedMetrics<typeof metrics>('attendant', locationId);
         
         if (cachedData) {
           console.log('📦 [AttendantDashboard] Loaded metrics from cache');
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
         
         // Step 4: Cache the fresh data for next time
         await metricsCacheService.cacheMetrics('attendant', {
           metrics: metricsResponse.metrics,
           recentPurchases: metricsResponse.recentPurchases || [],
           recentBookings: metricsResponse.recentBookings || [],
         }, locationId);
         
         console.log('✅ [AttendantDashboard] Metrics cached successfully');
         
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
         const dateStr = currentDay.toISOString().split('T')[0];
         
         const bookingParams = {
           location_id: locationId,
           date_from: dateStr,
           date_to: dateStr,
         };
         
         // Try to get from cache first
         const cachedBookings = await bookingCacheService.getFilteredBookingsFromCache(bookingParams);
         
         if (cachedBookings && cachedBookings.length > 0) {
           setDailyBookings(cachedBookings);
         } else {
           // No cache, fetch from API
           const bookingsResponse = await bookingService.getBookings({
             ...bookingParams,
             per_page: 100,
           });
           const bookings = bookingsResponse.data.bookings || [];
           setDailyBookings(bookings);
           // Cache the fetched bookings
           await bookingCacheService.cacheBookings(bookings, { locationId });
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

   // Get bookings grouped by room for daily view
   const getBookingsForRoom = (roomId: number) => {
     return dailyBookings.filter(booking => booking.room_id === roomId);
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

         {/* New Bookings Alert - Show if there are new bookings */}
         {newBookings.length > 0 && (
           <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
             <div className="flex items-center gap-3 mb-3">
               <div className="p-2 bg-blue-100 rounded-lg">
                 <Sparkles size={20} className="text-blue-600" />
               </div>
               <div>
                 <h3 className="font-semibold text-blue-900">New Bookings</h3>
                 <p className="text-sm text-blue-700">{newBookings.length} booking(s) created in the last 48 hours</p>
               </div>
             </div>
             <div className="space-y-2 max-h-[200px] overflow-y-auto">
               {newBookings.slice(0, 5).map((booking: any) => (
                 <div key={booking.id} className="flex items-center justify-between bg-white rounded-lg p-3 border border-blue-100">
                   <div className="flex items-center gap-3">
                     <div>
                       <p className="font-medium text-gray-900">
                         {booking.guest_name || (booking.customer ? `${booking.customer.first_name} ${booking.customer.last_name}` : 'Guest')}
                       </p>
                       <p className="text-sm text-gray-500">
                         {booking.package?.name || 'Package'} • {booking.participants} guests • {new Date(booking.booking_date).toLocaleDateString()}
                       </p>
                     </div>
                   </div>
                   <div className="flex items-center gap-2">
                     <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(booking.status)}`}>
                       {booking.status}
                     </span>
                     <Link to={`/bookings/${booking.id}`} className={`text-sm text-${fullColor} hover:underline`}>
                       View →
                     </Link>
                   </div>
                 </div>
               ))}
               {newBookings.length > 5 && (
                 <Link to="/bookings" className={`block text-center text-sm text-${fullColor} hover:underline py-2`}>
                   View all {newBookings.length} new bookings →
                 </Link>
               )}
             </div>
           </div>
         )}

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
           
           {/* Day View - Shows all spaces */}
           {calendarView === 'day' && (
             <div className="overflow-x-auto rounded-lg border border-gray-200">
               {rooms.length === 0 ? (
                 <div className="p-8 text-center text-gray-500">
                   <p>No spaces configured for this location.</p>
                   <p className="text-sm mt-2">Add spaces in the Spaces section to see the daily schedule.</p>
                 </div>
               ) : dailyBookings.length === 0 ? (
                 <div className="p-8 text-center text-gray-500">
                   No bookings for {currentDay.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                 </div>
               ) : (
                 <table className="w-full">
                   <thead className="bg-gray-50">
                     <tr>
                       <th className="w-32 px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200">
                         Space
                       </th>
                       <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                         Bookings
                       </th>
                     </tr>
                   </thead>
                   <tbody className="bg-white divide-y divide-gray-200">
                     {rooms.map((room) => {
                       const roomBookings = getBookingsForRoom(room.id);
                       return (
                         <tr key={room.id} className="hover:bg-gray-50">
                           <td className="px-3 py-3 whitespace-nowrap text-sm font-medium text-gray-900 border-r border-gray-200 align-top">
                             <div className="font-semibold">{room.name}</div>
                             {room.capacity && (
                               <div className="text-xs text-gray-500">Capacity: {room.capacity}</div>
                             )}
                             {room.area_group && (
                               <div className="text-xs text-gray-400">{room.area_group}</div>
                             )}
                           </td>
                           <td className="px-3 py-3 text-sm">
                             {roomBookings.length === 0 ? (
                               <span className="text-gray-400 italic">No bookings</span>
                             ) : (
                               <div className="flex flex-wrap gap-2">
                                 {roomBookings.sort((a, b) => a.booking_time.localeCompare(b.booking_time)).map((booking) => {
                                   const [hourStr, minuteStr] = booking.booking_time.split(':');
                                   const hour = parseInt(hourStr);
                                   const isPM = hour >= 12;
                                   const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
                                   const time12 = `${displayHour}:${minuteStr} ${isPM ? 'PM' : 'AM'}`;
                                   
                                   return (
                                     <div
                                       key={booking.id}
                                       className={`p-2 rounded-lg border min-w-[180px] ${
                                         booking.status === 'confirmed' || booking.status === 'Confirmed'
                                           ? 'bg-emerald-50 border-emerald-200'
                                           : booking.status === 'pending' || booking.status === 'Pending'
                                           ? 'bg-amber-50 border-amber-200'
                                           : 'bg-rose-50 border-rose-200'
                                       }`}
                                     >
                                       <div className="flex items-center gap-2 mb-1">
                                         <Clock size={12} className="text-gray-500" />
                                         <span className="text-xs font-medium text-gray-700">{time12}</span>
                                         <span className={`ml-auto px-1.5 py-0.5 text-xs font-medium rounded ${getStatusColor(booking.status)}`}>
                                           {booking.status}
                                         </span>
                                       </div>
                                       <div className="text-sm font-medium text-gray-900 truncate">
                                         {booking.guest_name || (booking.customer ? `${booking.customer.first_name} ${booking.customer.last_name}` : 'Guest')}
                                       </div>
                                       <div className="text-xs text-gray-600 truncate">{booking.package?.name || 'Package'}</div>
                                       <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                                         <Users size={10} />
                                         <span>{booking.participants} guests</span>
                                       </div>
                                     </div>
                                   );
                                 })}
                               </div>
                             )}
                           </td>
                         </tr>
                       );
                     })}
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