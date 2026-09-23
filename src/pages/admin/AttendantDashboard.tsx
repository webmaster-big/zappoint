import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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
  Eye,
  Edit,
  LogIn,
  Loader2,
  PackageIcon,
  House,
  IdCard,
  FileSignature,
  EyeOff,
} from 'lucide-react';
import StandardButton from '../../components/ui/StandardButton';
import DateRangeCalendar from '../../components/ui/DateRangeCalendar';
import { getStoredUser } from '../../utils/storage';
import { useQuickActions } from '../../hooks/useQuickActions';
import bookingService, { type Booking } from '../../services/bookingService';
import { bookingCacheService } from '../../services/BookingCacheService';
import { createPayment, PAYMENT_TYPE } from '../../services/PaymentService';
import {
  useScheduledExtras,
  formatDateKey,
  attractionsForDate,
  eventsForDate,
  getDaySummary,
  DateActivityBreakdown,
  AttractionScheduleCard,
  EventScheduleCard,
} from '../../components/admin/calendar/ScheduledActivity';
import { buildCalendarCategories, useCategoryFilter } from '../../components/admin/calendar/useCategoryFilter';
import { CalendarCategoryTabs } from '../../components/admin/calendar/CategoryFilter';
import CalendarDatePicker from '../../components/admin/calendar/CalendarDatePicker';
import { fetchDayBookings } from '../../components/admin/calendar/fetchDayBookings';
import { useHideEmptySpaces, useScheduleDayWindow } from '../../components/admin/calendar/useDayScheduleView';
import CustomerSearch from '../../components/admin/calendar/CustomerSearch';
import DayScheduleGrid from '../../components/admin/calendar/DayScheduleGrid';
import { matchesBookingSearch } from '../../utils/bookingSearch';
import MetricsService, { type TimeframeType, type DashboardBreakdowns } from '../../services/MetricsService';
import { metricsCacheService } from '../../services/MetricsCacheService';
import {
  TIMEFRAME_VALUES,
  createdWithinTimeframe,
  readStoredTimeframe,
  storeTimeframe,
  timeframeLabel,
} from '../../utils/dashboardTimeframe';
import { useThemeColor } from '../../hooks/useThemeColor';
import { parseLocalDate, convertTo12Hour, formatDurationDisplay, formatLocalDateTime, michiganToday } from '../../utils/timeFormat';
import { guestNoteOf } from '../../utils/bookingNotes';
import { roomService, type Room } from '../../services/RoomService';
import { roomCacheService } from '../../services/RoomCacheService';
import { cardFromPayments } from '../../utils/cardLabel';
import { attractionPurchaseCacheService } from '../../services/AttractionPurchaseCacheService';
import { resolvePaymentState } from '../../types/Bookings.types';
import InternalNotesLog from '../../components/admin/bookings/InternalNotesLog';
import MetricCardGrid, { type MetricCardDef } from '../../components/admin/dashboard/MetricCardGrid';
import { buildBreakdown, rescaleBreakdown } from '../../components/admin/dashboard/breakdowns';

const AttendantDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { themeColor, fullColor } = useThemeColor();
   const [currentWeek, setCurrentWeek] = useState(() => michiganToday());
   const [currentMonth, setCurrentMonth] = useState(() => michiganToday());
   const [currentDay, setCurrentDay] = useState(() => michiganToday());
   const [calendarView, setCalendarView] = useState<'day' | 'week' | 'month'>('day');
   const [scheduleSearch, setScheduleSearch] = useState('');
   const [hideEmptySpaces, setHideEmptySpaces] = useHideEmptySpaces('attendant_dashboard_hide_empty_spaces');
   const [loading, setLoading] = useState(true);
   const [metricsLoading, setMetricsLoading] = useState(false);
   const [locationId, setLocationId] = useState<number | null>(() => getStoredUser()?.location_id ?? null);
   const { dayWindow, windowLoading } = useScheduleDayWindow(currentDay, locationId);
   const [selectedDayBookings, setSelectedDayBookings] = useState<{ date: Date; bookings: any[] } | null>(null);
   const [selectedBooking, setSelectedBooking] = useState<any | null>(null);
   
   const [metricsTimeframe, setMetricsTimeframe] = useState<TimeframeType>(readStoredTimeframe);
   const timeframeDescription = timeframeLabel(metricsTimeframe);

   const handleTimeframeChange = (timeframe: TimeframeType) => {
     setMetricsTimeframe(timeframe);
     storeTimeframe(timeframe);
   };
   const [customDateFrom, setCustomDateFrom] = useState('');
   const [customDateTo, setCustomDateTo] = useState('');
   
   const [rooms, setRooms] = useState<Room[]>([]);
   const [roomsLoading, setRoomsLoading] = useState(true);
   const [dayLoading, setDayLoading] = useState(true);
   
   const [allBookings, setAllBookings] = useState<any[]>([]); // All-time bookings for this location
   const [recentlyCreatedBookings, setRecentlyCreatedBookings] = useState<any[]>([]);
   const [weeklyBookings, setWeeklyBookings] = useState<any[]>([]);
   const [dailyBookings, setDailyBookings] = useState<any[]>([]);
   const [monthlyBookings, setMonthlyBookings] = useState<any[]>([]);
   const [ticketPurchases, setTicketPurchases] = useState<any[]>([]);
   const [recentBookings, setRecentBookings] = useState<any[]>([]);
   const [recentEventPurchases, setRecentEventPurchases] = useState<any[]>([]);
   const [newBookings, setNewBookings] = useState<any[]>([]);

   const [checkInLoading, setCheckInLoading] = useState(false);
   const [showCheckInConfirm, setShowCheckInConfirm] = useState(false);

   const [showPaymentModal, setShowPaymentModal] = useState(false);
   const [paymentAmount, setPaymentAmount] = useState('');
   const [paymentMethod, setPaymentMethod] = useState<'card' | 'in-store'>('in-store');
   const [paymentNotes, setPaymentNotes] = useState('');
   const [processingPayment, setProcessingPayment] = useState(false);
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
     eventPurchaseRevenue: 0,
     totalEventPurchases: 0,
     totalEventTickets: 0,
   } as import('../../services/MetricsService').DashboardMetrics);
   const [dashboardBreakdowns, setDashboardBreakdowns] = useState<DashboardBreakdowns | null>(null);

   useEffect(() => {
     const user = getStoredUser();
     if (user?.location_id) {
       setLocationId(user.location_id);
     }
   }, []);

   useEffect(() => {
     if (!locationId) return;
     
     const loadAllBookings = async () => {
       try {
         console.log('📦 [AttendantDashboard] Loading all bookings for location:', locationId);
         
         const cachedBookings = await bookingCacheService.getFilteredBookingsFromCache({
           location_id: locationId,
         });
         
         if (cachedBookings && cachedBookings.length > 0) {
           console.log('📦 [AttendantDashboard] Loaded', cachedBookings.length, 'bookings from cache');
           setAllBookings(cachedBookings);
           setLoading(false);
         }
         
         console.log('🔄 [AttendantDashboard] Background sync: Fetching fresh bookings...');
         const bookingsResponse = await bookingService.getBookings({
           location_id: locationId,
           per_page: 500, // Get all bookings (500 max to avoid backend limits)
         });
         
         const bookings = bookingsResponse.data.bookings || [];
         console.log('✅ [AttendantDashboard] Fetched', bookings.length, 'bookings from API');
         
         setAllBookings(bookings);
         bookingCacheService.syncInBackground();

         const recentResponse = await bookingService.getBookings({
           location_id: locationId,
           sort_by: 'created_at',
           sort_order: 'desc',
           per_page: 100,
         });
         setRecentlyCreatedBookings(recentResponse.data.bookings || []);
       } catch (error) {
         console.error('⚠️ [AttendantDashboard] Error loading bookings:', error);
       } finally {
         setLoading(false);
       }
     };
     
     loadAllBookings();
   }, [locationId]);

   useEffect(() => {
     const fetchRooms = async () => {
       if (!locationId) {
         setRoomsLoading(false);
         return;
       }
       setRoomsLoading(true);
       try {
         const cachedRooms = await roomCacheService.getCachedRooms();
         if (cachedRooms && cachedRooms.length > 0) {
           const filteredRooms = cachedRooms.filter(r => r.location_id === locationId);
           if (filteredRooms.length > 0) {
             setRooms(filteredRooms);
           }
         }
         const response = await roomService.getRooms({ location_id: locationId, per_page: 100, include_unavailable: true });
         const fetchedRooms: Room[] = response.data.rooms || [];
         setRooms(fetchedRooms);
         const bookableRooms = fetchedRooms.filter(room => room.is_available !== false);
         if (bookableRooms.length > 0) {
           await roomCacheService.cacheRooms(bookableRooms);
         }
       } catch (error) {
         console.error('Error fetching spaces:', error);
       } finally {
         setRoomsLoading(false);
       }
     };
     fetchRooms();
   }, [locationId]);

   useEffect(() => {
     if (recentlyCreatedBookings.length === 0) {
       setNewBookings([]);
       return;
     }

     const recentlyCreated = recentlyCreatedBookings.filter((booking: any) =>
       String(booking.status).toLowerCase() !== 'cancelled' &&
       createdWithinTimeframe(booking.created_at, metricsTimeframe, customDateFrom, customDateTo)
     );

     setNewBookings(recentlyCreated);
     console.log(`📅 [AttendantDashboard] New bookings (${timeframeDescription}) derived:`, recentlyCreated.length);
     // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [recentlyCreatedBookings, metricsTimeframe, customDateFrom, customDateTo]);

   useEffect(() => {
     const fetchMetricsData = async () => {
       if (!locationId) return;
       
       setMetricsLoading(true);
       
       try {
         const cachedData = await metricsCacheService.getCachedMetrics<typeof metrics>('attendant', locationId, metricsTimeframe);
         
         if (cachedData) {
           console.log('📦 [AttendantDashboard] Loaded metrics from cache for timeframe:', metricsTimeframe);
           setMetrics(cachedData.metrics);
           if (cachedData.breakdowns) {
             setDashboardBreakdowns(cachedData.breakdowns);
           }
           setTicketPurchases(cachedData.recentPurchases || []);
           setRecentBookings(cachedData.recentBookings || []);
           if (cachedData.recentEventPurchases) {
             setRecentEventPurchases(cachedData.recentEventPurchases);
           }
           setLoading(false);
         }

         
         console.log('🔄 [AttendantDashboard] Fetching fresh metrics from API...');
         const metricsParams: any = {
           location_id: locationId,
           timeframe: metricsTimeframe,
         };
         
         if (metricsTimeframe === 'custom' && customDateFrom && customDateTo) {
           metricsParams.date_from = customDateFrom;
           metricsParams.date_to = customDateTo;
         }
         
         const metricsResponse = await MetricsService.getAttendantMetrics(metricsParams);
         
         console.log('📊 Attendant Metrics Response:', metricsResponse);
         
         setMetrics(metricsResponse.metrics);
         if (metricsResponse.breakdowns) {
           setDashboardBreakdowns(metricsResponse.breakdowns);
         }
         setTicketPurchases(metricsResponse.recentPurchases || []);
         setRecentBookings(metricsResponse.recentBookings || []);
         if (metricsResponse.recentEventPurchases) {
           setRecentEventPurchases(metricsResponse.recentEventPurchases as any);
         }

         if (metricsResponse.recentPurchases?.length) {
           await attractionPurchaseCacheService.cachePurchases(metricsResponse.recentPurchases as any);
         }
         
         await metricsCacheService.cacheMetrics('attendant', {
           metrics: metricsResponse.metrics,
           recentPurchases: metricsResponse.recentPurchases || [],
           recentBookings: metricsResponse.recentBookings || [],
           recentEventPurchases: metricsResponse.recentEventPurchases || [],
           breakdowns: metricsResponse.breakdowns,
         }, locationId, metricsTimeframe);
         
         console.log('✅ [AttendantDashboard] Metrics cached successfully for timeframe:', metricsTimeframe);
         
       } catch (error) {
         console.error('Error fetching metrics data:', error);
       } finally {
         setLoading(false);
         setMetricsLoading(false);
       }
     };
     
     fetchMetricsData();
   }, [locationId, metricsTimeframe, customDateFrom, customDateTo]);

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

   useEffect(() => {
     if (allBookings.length === 0) {
       setWeeklyBookings(prev => (prev.length === 0 ? prev : []));
       return;
     }
     
     const weekStart = weekDates[0];
     const weekEnd = weekDates[6];
     
     const weekly = allBookings.filter(booking => {
       const bookingDate = parseLocalDate(booking.booking_date);
       return bookingDate >= weekStart && bookingDate <= weekEnd;
     });
     
     setWeeklyBookings(weekly);
     console.log('📅 [AttendantDashboard] Weekly bookings filtered:', weekly.length);
   }, [allBookings, currentWeek]);
   
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

   // Mutations (check-in, payment, notes) update `selectedBooking`, so mirror from THAT rather
   // than from allBookings: allBookings is capped at the 100 newest booking_dates by the API, so
   // a booking on any older day is absent from it and the grid would never repaint.
   useEffect(() => {
     if (calendarView !== 'day') return;
     const fresh: any = selectedBooking;
     if (!fresh?.id) return;

     setDailyBookings(prev => {
       if (prev.length === 0) return prev;
       let touched = false;
       const merged = prev.map((booking: any) => {
         if (booking.id !== fresh.id) return booking;
         const patch: any = {};
         for (const key of ['status', 'payment_status', 'amount_paid', 'internal_notes', 'checked_in_at', 'checked_in_by_user']) {
           if (fresh[key] !== undefined && fresh[key] !== booking[key]) patch[key] = fresh[key];
         }
         if (Object.keys(patch).length === 0) return booking;
         touched = true;
         return { ...booking, ...patch };
       });
       return touched ? merged : prev;
     });
   }, [selectedBooking, calendarView]);

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

   useEffect(() => {
     if (calendarView !== 'day') return;
     if (!locationId) {
       setDailyBookings(prev => (prev.length === 0 ? prev : []));
       setDayLoading(false);
       return;
     }

     let cancelled = false;
     const dateStr = formatDateKey(currentDay);

     setDayLoading(true);
     setDailyBookings(prev => (prev.length === 0 ? prev : []));
     fetchDayBookings(dateStr, locationId)
       .then(list => {
         if (!cancelled) setDailyBookings(list);
       })
       .catch(error => {
         console.error('⚠️ [AttendantDashboard] Error loading the day schedule:', error);
         if (!cancelled) setDailyBookings(prev => (prev.length === 0 ? prev : []));
       })
       .finally(() => {
         if (!cancelled) setDayLoading(false);
       });

     return () => {
       cancelled = true;
     };
   }, [calendarView, currentDay, locationId]);

   const getMonthDays = (date: Date) => {
     const year = date.getFullYear();
     const month = date.getMonth();
     const firstDay = new Date(year, month, 1);
     const lastDay = new Date(year, month + 1, 0);
     const daysInMonth = lastDay.getDate();
     const startDayOfWeek = firstDay.getDay();
     
     const days: (Date | null)[] = [];
     
     for (let i = 0; i < startDayOfWeek; i++) {
       days.push(null);
     }
     
     for (let i = 1; i <= daysInMonth; i++) {
       days.push(new Date(year, month, i));
     }
     
     return days;
   };

   const monthDays = getMonthDays(currentMonth);

   useEffect(() => {
     if (calendarView !== 'month') return;
     if (allBookings.length === 0) {
       setMonthlyBookings(prev => (prev.length === 0 ? prev : []));
       return;
     }
     
     const year = currentMonth.getFullYear();
     const month = currentMonth.getMonth();
     const monthStart = new Date(year, month, 1);
     const monthEnd = new Date(year, month + 1, 0);
     
     const monthly = allBookings.filter(booking => {
       const bookingDate = parseLocalDate(booking.booking_date);
       return bookingDate >= monthStart && bookingDate <= monthEnd;
     });
     
     setMonthlyBookings(monthly);
     console.log('📅 [AttendantDashboard] Monthly bookings filtered:', monthly.length);
   }, [allBookings, currentMonth, calendarView]);

   const searchedMonthlyBookings = useMemo(
     () => monthlyBookings.filter((booking: any) => matchesBookingSearch(booking, scheduleSearch)),
     [monthlyBookings, scheduleSearch]
   );

   const getBookingsForDay = (date: Date) => {
     return searchedMonthlyBookings
       .filter(booking => {
         const bookingDate = parseLocalDate(booking.booking_date);
         return bookingDate.toDateString() === date.toDateString();
       })
       .sort((a, b) => (a.booking_time || '').localeCompare(b.booking_time || ''));
   };

   const calendarDate =
     calendarView === 'day' ? currentDay : calendarView === 'week' ? currentWeek : currentMonth;

   const calendarLabel =
     calendarView === 'day'
       ? currentDay.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
       : calendarView === 'week'
         ? `${weekDates[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} \u2013 ${weekDates[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
         : currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

   const jumpToDate = (date: Date) => {
     setCurrentDay(date);
     setCurrentWeek(date);
     setCurrentMonth(date);
   };

   const openBookingFromSearch = (booking: Booking) => {
     const bookingDate = parseLocalDate(booking.booking_date);
     if (!Number.isNaN(bookingDate.getTime())) {
       jumpToDate(bookingDate);
       setCalendarView('day');
     }
     setSelectedBooking(booking);
   };

   const activeRange = useMemo(() => {
     if (calendarView === 'day') {
       const d = formatDateKey(currentDay);
       return { from: d, to: d };
     }
     if (calendarView === 'week') {
       const wd = getWeekDates(currentWeek);
       return { from: formatDateKey(wd[0]), to: formatDateKey(wd[6]) };
     }
     const year = currentMonth.getFullYear();
     const month = currentMonth.getMonth();
     return {
       from: formatDateKey(new Date(year, month, 1)),
       to: formatDateKey(new Date(year, month + 1, 0)),
     };
   }, [calendarView, currentDay, currentWeek, currentMonth]);

   const { attractions: scheduledAttractions, events: scheduledEvents } = useScheduledExtras(activeRange, locationId);

   const getAttractionsForDay = (date: Date) => attractionsForDate(scheduledAttractions, date);
   const getEventsForDay = (date: Date) => eventsForDate(scheduledEvents, date);

   const newBookingStatusCounts = new Map<string, number>();
   const newBookingPackageCounts = new Map<string, number>();
   newBookings.forEach((booking: any) => {
     const rawStatus = String(booking.status || 'pending').toLowerCase();
     const statusLabel = rawStatus.charAt(0).toUpperCase() + rawStatus.slice(1);
     newBookingStatusCounts.set(statusLabel, (newBookingStatusCounts.get(statusLabel) ?? 0) + 1);

     const packageLabel = booking.package?.name || booking.package_name || 'Other';
     newBookingPackageCounts.set(packageLabel, (newBookingPackageCounts.get(packageLabel) ?? 0) + 1);
   });

   const revenueBreakdown = buildBreakdown([
     { label: 'Package bookings', count: Number(metrics.bookingRevenue || 0) },
     { label: 'Attraction tickets', count: Number(metrics.purchaseRevenue || 0) },
     { label: 'Event tickets', count: Number(metrics.eventPurchaseRevenue || 0) },
   ]);

   const asMoney = (value: number) => `$${value.toFixed(2)}`;

   const metricsCards: MetricCardDef[] = [
     {
       key: 'totalBookings',
       title: 'Total Bookings',
       value: metrics.totalBookings.toString(),
       change: `${metrics.totalParticipants} participants`,
       icon: Calendar,
       accent: `bg-${themeColor}-100 text-${fullColor}`,
       explanation: 'Package bookings placed in the period (counted by the date the booking was made), excluding cancelled ones. The subtitle shows total participants across those bookings.',
       sections: [
         { title: 'By status', items: dashboardBreakdowns?.packageStatusBreakdown ?? [] },
         { title: 'By package', items: dashboardBreakdowns?.packageBreakdown ?? [] },
       ],
     },
     {
       key: 'newBookings',
       title: 'New Bookings',
       value: newBookings.length.toString(),
       change: 'Created in this period',
       icon: Sparkles,
       accent: 'bg-blue-100 text-blue-600',
       explanation: 'Bookings created within the selected timeframe, based on the loaded booking list.',
       sections: [
         { title: 'By status', items: buildBreakdown(Array.from(newBookingStatusCounts, ([label, count]) => ({ label, count }))) },
         { title: 'By package', items: buildBreakdown(Array.from(newBookingPackageCounts, ([label, count]) => ({ label, count }))) },
       ],
     },
     {
       key: 'pendingApprovals',
       title: 'Pending Approvals',
       value: metrics.pendingBookings.toString(),
       change: `Require attention`,
       icon: AlertTriangle,
       accent: 'bg-amber-100 text-amber-600',
       explanation: 'Bookings still sitting at pending for this location in the period. They are included in Total Bookings.',
     },
     {
       key: 'confirmed',
       title: 'Confirmed',
       value: metrics.confirmedBookings.toString(),
       change: `Completed: ${metrics.completedBookings}`,
       icon: CheckCircle,
       accent: 'bg-emerald-100 text-emerald-600',
       explanation: 'Package bookings that were confirmed, including those that have since checked in or completed. The subtitle shows how many of them are fully completed.',
       sections: [
         { title: 'How far along', items: rescaleBreakdown(dashboardBreakdowns?.packageStatusBreakdown, ['Confirmed', 'Checked-in', 'Completed']) },
       ],
     },
     {
       key: 'totalRevenue',
       title: 'Total Revenue',
       value: `$${metrics.totalRevenue.toFixed(2)}`,
       change: `Bkgs: $${Math.round(metrics.bookingRevenue)} • Tix: $${Math.round(metrics.purchaseRevenue)}${metrics.eventPurchaseRevenue > 0 ? ` • Events: $${Math.round(metrics.eventPurchaseRevenue)}` : ''}`,
       icon: DollarSign,
       accent: 'bg-green-100 text-green-600',
       explanation: 'Money actually collected (amount paid) on package bookings, attraction orders, and event orders placed in the period. Cancelled/refunded orders are excluded. Outstanding balances are not included.',
       sections: [
         { title: 'Where it came from', items: revenueBreakdown, formatValue: asMoney, totalLabel: 'Collected' },
       ],
     },
     {
       key: 'ticketSales',
       title: 'Ticket Sales',
       value: metrics.totalPurchases.toString(),
       change: `${metrics.totalAttractionTickets ?? 0} tickets • $${metrics.purchaseRevenue.toFixed(2)}`,
       icon: Ticket,
       accent: 'bg-purple-100 text-purple-600',
       explanation: 'Attraction orders placed in the period, counted by purchase date. Cancelled and refunded orders are excluded. The card counts orders; the breakdown counts the tickets inside them.',
       sections: [
         { title: 'Attraction tickets by category', items: dashboardBreakdowns?.attractionBreakdown ?? [], totalLabel: 'Tickets' },
         { title: 'Event tickets', items: dashboardBreakdowns?.eventBreakdown ?? [], totalLabel: 'Tickets' },
       ],
     },
   ];

   const bookingsThisWeek = weeklyBookings.filter(booking => {
     const bookingDate = parseLocalDate(booking.booking_date);
     return weekDates.some(date => date.toDateString() === bookingDate.toDateString());
   });

   const calendarViewBookings = calendarView === 'day' ? dailyBookings : calendarView === 'week' ? bookingsThisWeek : monthlyBookings;

   const calendarCategories = useMemo(
     () => buildCalendarCategories({
       bookings: calendarViewBookings,
       attractions: scheduledAttractions,
       events: scheduledEvents,
     }),
     [calendarViewBookings, scheduledAttractions, scheduledEvents]
   );

   const calendarFilter = useCategoryFilter(calendarCategories);

   const shownBookingsThisWeek = bookingsThisWeek
     .filter(calendarFilter.showsBooking)
     .filter((booking: any) => matchesBookingSearch(booking, scheduleSearch));

   const selectedDayAttractions = useMemo(
     () => (selectedDayBookings ? attractionsForDate(scheduledAttractions, selectedDayBookings.date) : []),
     [scheduledAttractions, selectedDayBookings]
   );

   const selectedDayEvents = useMemo(
     () => (selectedDayBookings ? eventsForDate(scheduledEvents, selectedDayBookings.date) : []),
     [scheduledEvents, selectedDayBookings]
   );

   const dayModalCategories = useMemo(
     () => buildCalendarCategories({
       bookings: selectedDayBookings?.bookings ?? [],
       attractions: selectedDayAttractions,
       events: selectedDayEvents,
     }),
     [selectedDayBookings, selectedDayAttractions, selectedDayEvents]
   );

   const dayModalFilter = useCategoryFilter(dayModalCategories, calendarFilter.selected, selectedDayBookings?.date.toDateString() ?? null);

   const shownDayModalBookings = (selectedDayBookings?.bookings ?? []).filter(dayModalFilter.showsBooking);

   const allQuickActions = [
     { title: 'New Booking', icon: Plus, link: '/bookings/create' },
     { title: 'Calendar', icon: Calendar, link: '/bookings/calendar' },
     { title: 'Check-In / Waivers', icon: QrCode, link: '/check-in' },
     { title: 'Packages', icon: DollarSign, link: '/packages' },
     { title: 'Attractions', icon: Ticket, link: '/attractions' },
      { title: 'Customers', icon: Users, link: '/customers' },
     { title: 'Memberships', icon: IdCard, link: '/memberships' },
     { title: 'Waivers', icon: FileSignature, link: '/waivers' },
     { title: 'Bookings', icon: TrendingUp, link: '/bookings' },
   ];

   const { visible: quickActions, hidden: hiddenQuickActions, toggle: toggleQuickAction, isAdmin: canEditQuickActions } = useQuickActions(allQuickActions);

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

   const getPaymentColor = (payment: string) => {
     const colors: Record<string, string> = {
       Paid: 'bg-emerald-100 text-emerald-800',
       paid: 'bg-emerald-100 text-emerald-800',
       Partial: 'bg-amber-100 text-amber-800',
       partial: 'bg-amber-100 text-amber-800',
       Refunded: 'bg-rose-100 text-rose-800',
       refunded: 'bg-rose-100 text-rose-800',
       card: 'bg-blue-100 text-blue-800',
       'authorize.net': 'bg-blue-100 text-blue-800',
       'in-store': 'bg-green-100 text-green-800',
       cash: 'bg-green-100 text-green-800',
       paylater: 'bg-orange-100 text-orange-800',
     };
     return colors[payment] || 'bg-gray-100 text-gray-800';
   };

   const filteredBookings = recentBookings;

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

   const sortedRooms = [...rooms].sort(naturalSort);

   const shownDailyBookings = dailyBookings
     .filter(calendarFilter.showsBooking)
     .filter((booking: any) => matchesBookingSearch(booking, scheduleSearch));

   const formatTime12Hour = (time: string): string => {
     const [hourStr, minuteStr] = time.split(':');
     let hour = parseInt(hourStr);
     const minute = minuteStr?.substring(0, 2) || '00';
     const ampm = hour >= 12 ? 'PM' : 'AM';
     hour = hour % 12 || 12;
     return `${hour}:${minute} ${ampm}`;
   };

   const handleOpenPaymentModal = () => {
     if (!selectedBooking) return;
     const remainingAmount = Math.max(0, Number(selectedBooking.total_amount || 0) - Number(selectedBooking.amount_paid || 0));
     setPaymentAmount((Math.floor(remainingAmount * 100) / 100).toFixed(2));
     setPaymentMethod('in-store');
     setPaymentNotes('');
     setShowPaymentModal(true);
   };

   const handleClosePaymentModal = () => {
     setShowPaymentModal(false);
     setPaymentAmount('');
     setPaymentMethod('in-store');
     setPaymentNotes('');
   };

   const handleSubmitPayment = async () => {
     if (!selectedBooking) return;
     const amount = parseFloat(paymentAmount);
     if (isNaN(amount) || amount <= 0) return;

     const remainingAmount = Math.round((Number(selectedBooking.total_amount || 0) - Number(selectedBooking.amount_paid || 0)) * 100) / 100;
     if (Math.round(amount * 100) / 100 > remainingAmount + 0.01) return;

     try {
       setProcessingPayment(true);
       const bookingResponse = await bookingService.getBookingById(selectedBooking.id);
       if (!bookingResponse.success || !bookingResponse.data) throw new Error('Failed to get booking details');

       const booking = bookingResponse.data;
       await createPayment({
         payable_id: selectedBooking.id,
         payable_type: PAYMENT_TYPE.BOOKING,
         customer_id: booking.customer_id || null,
         location_id: booking.location_id,
         amount,
         currency: 'USD',
         method: paymentMethod === 'in-store' ? 'cash' : paymentMethod,
         status: 'completed',
         notes: paymentNotes || `In-store payment for booking ${selectedBooking.reference_number}`,
       });

       const newAmountPaid = Number(selectedBooking.amount_paid || 0) + amount;
       const newPaymentStatus = resolvePaymentState({
         payment_status: selectedBooking.payment_status,
         amount_paid: newAmountPaid,
         total_amount: selectedBooking.total_amount,
       }).state;
       const updateResponse = await bookingService.updateBooking(selectedBooking.id, {
         amount_paid: newAmountPaid,
         status: 'confirmed',
       });

       if (updateResponse.success && updateResponse.data) {
         await bookingCacheService.updateBookingInCache(updateResponse.data);
       }

       setSelectedBooking({ ...selectedBooking, amount_paid: newAmountPaid, payment_status: newPaymentStatus });
       setAllBookings(prev => prev.map(b => b.id === selectedBooking.id ? { ...b, amount_paid: newAmountPaid, payment_status: newPaymentStatus } : b));
       handleClosePaymentModal();
     } catch (error) {
       console.error('Error processing payment:', error);
     } finally {
       setProcessingPayment(false);
     }
   };

   return (
       <div className=" min-h-screen md:p-8 space-y-8">
         <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-2">
           <div>
             <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-2 mb-1">
                Dashboard
             </h1>
             <p className="text-base text-gray-800">Overview of all bookings and sales</p>
           </div>
           
           <div className="flex flex-col md:flex-row items-start md:items-center gap-2 mt-4 md:mt-0">
             <div className="flex items-center gap-2">
               <Clock size={16} className="text-gray-500" />
               <select
                 value={metricsTimeframe}
                 onChange={(e) => handleTimeframeChange(e.target.value as TimeframeType)}
                 className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
               >
                 {TIMEFRAME_VALUES.map(value => (
                   <option key={value} value={value}>{timeframeLabel(value)}</option>
                 ))}
               </select>
               {metricsLoading && (
                 <div className="w-3 h-3 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin"></div>
               )}
             </div>
             
             {metricsTimeframe === 'custom' && (
               <div className="w-56">
                 <DateRangeCalendar
                   startDate={customDateFrom}
                   endDate={customDateTo}
                   onChange={(start, end) => {
                     setCustomDateFrom(start);
                     setCustomDateTo(end);
                   }}
                 />
               </div>
             )}
           </div>
         </div>

         <MetricCardGrid cards={metricsCards} columns={6} loading={loading} />

         <div className="bg-white rounded-xl shadow-sm p-4 md:p-6 border border-gray-100">
           <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
             <div className="flex items-center gap-4">
               <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                 <Calendar className={`w-6 h-6 text-${fullColor}`} /> Calendar
               </h2>
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
             <div className="flex flex-wrap items-center gap-2 mt-4 md:mt-0">
               <StandardButton 
                 onClick={calendarView === 'day' ? goToPreviousDay : calendarView === 'week' ? goToPreviousWeek : goToPreviousMonth}
                 variant="secondary"
                 size="sm"
                 icon={ChevronLeft}
               />
               <CalendarDatePicker
                 value={calendarDate}
                 onChange={jumpToDate}
                 label={calendarLabel}
                 highlight={calendarView}
                 themeColor={themeColor}
                 fullColor={fullColor}
                 buttonClassName={`flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-800 hover:bg-${themeColor}-50 transition-colors min-w-0 sm:min-w-[220px]`}
               />
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
                 onClick={() => jumpToDate(michiganToday())}
               >
                 Today
               </StandardButton>
             </div>
           </div>

           <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
             <CustomerSearch
               locationId={locationId}
               onSelect={openBookingFromSearch}
               className="w-full sm:max-w-sm"
               themeColor={themeColor}
               fullColor={fullColor}
             />
             <input
               type="search"
               value={scheduleSearch}
               onChange={event => setScheduleSearch(event.target.value)}
               placeholder="Filter this view by name or phone"
               aria-label="Filter the visible calendar by customer name or phone number"
               className={`w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 [&::-webkit-search-cancel-button]:appearance-none focus:border-${fullColor} focus:outline-none focus:ring-1 focus:ring-${fullColor} sm:max-w-xs`}
             />
             {calendarView === 'day' && (
               <button
                 type="button"
                 onClick={() => setHideEmptySpaces(prev => !prev)}
                 aria-pressed={hideEmptySpaces}
                 title={hideEmptySpaces ? 'Show spaces with no bookings' : 'Hide spaces with no bookings'}
                 className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                   hideEmptySpaces
                     ? `border-${themeColor}-200 bg-${themeColor}-50 text-${fullColor}`
                     : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                 }`}
               >
                 {hideEmptySpaces ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                 <span className="hidden sm:inline">{hideEmptySpaces ? 'Empty spaces hidden' : 'All spaces shown'}</span>
               </button>
             )}
           </div>

           <CalendarCategoryTabs filter={calendarFilter} className="mb-6" />

           {calendarView === 'day' && (
             <DayScheduleGrid
               date={currentDay}
               dayWindow={dayWindow}
               rooms={sortedRooms}
               bookings={shownDailyBookings}

               allDayBookings={dailyBookings}
               hideEmptySpaces={hideEmptySpaces}
               loading={roomsLoading || dayLoading || windowLoading}
               onSelectBooking={setSelectedBooking}
               themeColor={themeColor}
               fullColor={fullColor}
               emptyMessage={`No bookings for ${currentDay.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}${
                 scheduleSearch.trim() ? ` matching "${scheduleSearch.trim()}"` : calendarFilter.isAll ? '' : ' in the selected categories'
               }.`}
             />
           )}

           {calendarView === 'day' && (() => {
             const dayAttractions = getAttractionsForDay(currentDay).filter(calendarFilter.showsAttraction);
             const dayEvents = calendarFilter.showsEvents() ? getEventsForDay(currentDay) : [];
             if (dayAttractions.length === 0 && dayEvents.length === 0) return null;
             return (
               <div className="mt-4 space-y-4">
                 {dayAttractions.length > 0 && (
                   <div>
                     <div className="flex items-center gap-2 mb-3 text-sm font-semibold text-gray-700">
                       <Ticket className="h-4 w-4 text-purple-600" /> Attraction Purchases ({dayAttractions.length})
                     </div>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                       {dayAttractions.map(p => <AttractionScheduleCard key={`attraction-${p.id}`} purchase={p} />)}
                     </div>
                   </div>
                 )}
                 {dayEvents.length > 0 && (
                   <div>
                     <div className="flex items-center gap-2 mb-3 text-sm font-semibold text-gray-700">
                       <Sparkles className="h-4 w-4 text-amber-600" /> Event Registrations ({dayEvents.length})
                     </div>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                       {dayEvents.map(p => <EventScheduleCard key={`event-${p.id}`} purchase={p} />)}
                     </div>
                   </div>
                 )}
               </div>
             );
           })()}

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
                 {(() => {
                   const bookingTimes = new Set<string>();
                   shownBookingsThisWeek.forEach(booking => {
                     const [hour, minute] = booking.booking_time.split(':');
                     bookingTimes.add(`${hour}:${minute}`);
                   });
                   
                   const sortedTimes = Array.from(bookingTimes).sort((a, b) => {
                     const [hourA, minA] = a.split(':').map(Number);
                     const [hourB, minB] = b.split(':').map(Number);
                     return (hourA * 60 + minA) - (hourB * 60 + minB);
                   });
                   
                   if (sortedTimes.length === 0) {
                     return (
                       <tr>
                         <td colSpan={8} className="px-3 py-8 text-center text-gray-500">
                           No bookings for this week{calendarFilter.isAll ? '' : ' in the selected categories'}
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
                           const bookingsForCell = shownBookingsThisWeek.filter(
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
                                   
                                   {bookingsForCell.length > 1 && (
                                     <StandardButton
                                       onClick={() => navigate(`/bookings/${bookingsForCell[0].id}?from=dashboard`)}
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
                                   
                                   {bookingsForCell.length === 1 && (
                                     <StandardButton
                                       onClick={() => navigate(`/bookings/${bookingsForCell[0].id}?from=dashboard`)}
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

           {calendarView === 'week' && (() => {
             const weekAttractions = weekDates.flatMap(d => getAttractionsForDay(d)).filter(calendarFilter.showsAttraction);
             const weekEvents = calendarFilter.showsEvents() ? weekDates.flatMap(d => getEventsForDay(d)) : [];
             if (weekAttractions.length === 0 && weekEvents.length === 0) return null;
             return (
               <div className="mt-4 space-y-4">
                 {weekAttractions.length > 0 && (
                   <div>
                     <div className="flex items-center gap-2 mb-3 text-sm font-semibold text-gray-700">
                       <Ticket className="h-4 w-4 text-purple-600" /> Attraction Purchases ({weekAttractions.length})
                     </div>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                       {weekAttractions.map(p => <AttractionScheduleCard key={`attraction-${p.id}`} purchase={p} />)}
                     </div>
                   </div>
                 )}
                 {weekEvents.length > 0 && (
                   <div>
                     <div className="flex items-center gap-2 mb-3 text-sm font-semibold text-gray-700">
                       <Sparkles className="h-4 w-4 text-amber-600" /> Event Registrations ({weekEvents.length})
                     </div>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                       {weekEvents.map(p => <EventScheduleCard key={`event-${p.id}`} purchase={p} />)}
                     </div>
                   </div>
                 )}
               </div>
             );
           })()}

           {calendarView === 'month' && (
             <div className="rounded-lg border border-gray-200">
               <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-200">
                 {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                   <div key={day} className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                     {day}
                   </div>
                 ))}
               </div>
               
               <div className="grid grid-cols-7">
                 {monthDays.map((day, index) => {
                   if (!day) {
                     return (
                       <div key={`empty-${index}`} className="min-h-[100px] bg-gray-50 border-b border-r border-gray-200" />
                     );
                   }
                   
                   const dayBookings = getBookingsForDay(day);
                   const dayAttractions = getAttractionsForDay(day);
                   const dayEvents = getEventsForDay(day);
                   const shownBookings = dayBookings.filter(calendarFilter.showsBooking);
                   const shownAttractions = dayAttractions.filter(calendarFilter.showsAttraction);
                   const shownEvents = calendarFilter.showsEvents() ? dayEvents : [];
                   const isToday = day.toDateString() === new Date().toDateString();
                   const summary = getDaySummary(shownBookings.length, shownAttractions, shownEvents);
                   const hasActivity = summary.total > 0;

                   return (
                     <div
                       key={day.toISOString()}
                       onClick={() => hasActivity && setSelectedDayBookings({ date: day, bookings: dayBookings })}
                       className={`min-h-[100px] p-2 border-b border-r border-gray-200 transition-all ${
                         hasActivity ? 'cursor-pointer hover:bg-gray-50' : ''
                       } ${isToday ? `bg-${themeColor}-50` : 'bg-white'}`}
                     >
                       <div className={`text-sm font-medium mb-2 ${isToday ? `text-${fullColor}` : 'text-gray-900'}`}>
                         {day.getDate()}
                       </div>

                       {hasActivity && <DateActivityBreakdown summary={summary} />}
                     </div>
                   );
                 })}
               </div>
             </div>
           )}
         </div>

         {newBookings.length > 0 && (
           <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
             <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
               <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                 <Sparkles className={`w-5 h-5 text-${fullColor}`} /> New Bookings
                 <span className="ml-2 text-xs font-medium bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                   {newBookings.length} • {timeframeDescription}
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
                           {parseLocalDate(booking.booking_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
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
                         <Link to={`/bookings/${booking.id}?from=dashboard`} className={`text-sm text-${fullColor} hover:underline`}>
                           View
                         </Link>
                       </td>
                     </tr>
                   ))}
                   {newBookings.length === 0 && (
                     <tr>
                       <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                         No new bookings for {timeframeDescription.toLowerCase()}.
                       </td>
                     </tr>
                   )}
                 </tbody>
               </table>
             </div>
           </div>
         )}

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
                       {(() => {
                         const s = getDaySummary(
                           selectedDayBookings.bookings.length,
                           getAttractionsForDay(selectedDayBookings.date),
                           getEventsForDay(selectedDayBookings.date)
                         );
                         const parts: string[] = [];
                         if (s.bookings > 0) parts.push(`${s.bookings} booking${s.bookings !== 1 ? 's' : ''}`);
                         if (s.attractionTickets > 0) parts.push(`${s.attractionTickets} attraction ticket${s.attractionTickets !== 1 ? 's' : ''}`);
                         if (s.eventRegistrations > 0) parts.push(`${s.eventRegistrations} event registration${s.eventRegistrations !== 1 ? 's' : ''}`);
                         return parts.join(' • ') || 'No scheduled activity';
                       })()}
                     </p>
                     <CalendarCategoryTabs filter={dayModalFilter} size="sm" className="mt-3" />
                   </div>
                   <StandardButton
                     onClick={() => setSelectedDayBookings(null)}
                     variant="ghost"
                     size="sm"
                     icon={X}
                   />
                 </div>

                 {shownDayModalBookings.length > 0 && (
                 <div className="space-y-3">
                   {shownDayModalBookings
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
                           className={`p-4 rounded-lg border transition-all cursor-pointer hover:shadow-md ${
                             booking.status === 'confirmed' || booking.status === 'Confirmed'
                               ? 'bg-emerald-50 border-emerald-200 hover:border-emerald-300'
                               : booking.status === 'pending' || booking.status === 'Pending'
                               ? 'bg-amber-50 border-amber-200 hover:border-amber-300'
                               : booking.status === 'checked-in'
                               ? 'bg-blue-50 border-blue-200 hover:border-blue-300'
                               : 'bg-rose-50 border-rose-200 hover:border-rose-300'
                           }`}
                           onClick={() => { setSelectedBooking(booking); setShowCheckInConfirm(false); }}
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
                               <div className={`text-xs mt-1 ${resolvePaymentState(booking).amountClass}`}>
                                 {resolvePaymentState(booking).label}
                               </div>
                             </div>
                           </div>
                         </div>
                       );
                     })}
                 </div>
                 )}

                 {(() => {
                   const dayAttractions = selectedDayAttractions.filter(dayModalFilter.showsAttraction);
                   const dayEvents = dayModalFilter.showsEvents() ? selectedDayEvents : [];
                   return (
                     <>
                       {dayAttractions.length > 0 && (
                         <div className="mt-6">
                           <div className="flex items-center gap-2 mb-3 text-sm font-semibold text-gray-700">
                             <Ticket className="h-4 w-4 text-purple-600" />
                             Attraction Purchases ({dayAttractions.length})
                           </div>
                           <div className="space-y-3">
                             {dayAttractions.map(p => <AttractionScheduleCard key={`attraction-${p.id}`} purchase={p} />)}
                           </div>
                         </div>
                       )}
                       {dayEvents.length > 0 && (
                         <div className="mt-6">
                           <div className="flex items-center gap-2 mb-3 text-sm font-semibold text-gray-700">
                             <Sparkles className="h-4 w-4 text-amber-600" />
                             Event Registrations ({dayEvents.length})
                           </div>
                           <div className="space-y-3">
                             {dayEvents.map(p => <EventScheduleCard key={`event-${p.id}`} purchase={p} />)}
                           </div>
                         </div>
                       )}
                     </>
                   );
                 })()}

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

         {selectedBooking && (
           <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4 animate-in fade-in duration-200" onClick={() => { setSelectedBooking(null); setShowCheckInConfirm(false); }}>
             <div className="bg-white rounded-xl shadow-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto transform transition-all duration-300 scale-100 animate-in zoom-in-95" onClick={(e) => e.stopPropagation()}>
               <div className="p-6">
                 <div className="flex justify-between items-center mb-6">
                   <h3 className="text-xl font-semibold text-gray-900">Booking Details</h3>
                   <StandardButton variant="ghost" size="sm" icon={X} onClick={() => { setSelectedBooking(null); setShowCheckInConfirm(false); }} />
                 </div>

                 <div className="mb-6">
                   <h4 className="text-sm font-semibold text-gray-700 uppercase mb-3">Customer Information</h4>
                   <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                     <div className="flex items-center">
                       <Users className="h-4 w-4 text-gray-400 mr-3" />
                       <span className="font-medium text-gray-900">
                         {selectedBooking.customer ? `${selectedBooking.customer.first_name} ${selectedBooking.customer.last_name}` : selectedBooking.guest_name || 'Guest'}
                       </span>
                     </div>
                     <div className="text-sm text-gray-600 ml-7">{selectedBooking.guest_email || selectedBooking.customer?.email || 'No email'}</div>
                     <div className="text-sm text-gray-600 ml-7">{selectedBooking.guest_phone || selectedBooking.customer?.phone || 'No phone'}</div>
                   </div>
                 </div>
                 {/* directly under the customer, because it is what the desk needs before they speak */}
                 <div className="mb-6">
                   <InternalNotesLog
                     bookingId={Number(selectedBooking.id)}
                     compact
                     onNoteAdded={summary => {
                       setSelectedBooking((current: any) =>
                         current && current.id === selectedBooking.id
                           ? ({ ...current, internal_notes: summary ?? undefined })
                           : current
                       );
                       setAllBookings(prev =>
                         prev.map((booking: any) =>
                           booking.id === selectedBooking.id
                             ? ({ ...booking, internal_notes: summary ?? undefined })
                             : booking
                         )
                       );
                     }}
                   />
                 </div>

                 <div className="mb-6">
                   <h4 className="text-sm font-semibold text-gray-700 uppercase mb-3">Booking Information</h4>
                   <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                     <div className="flex justify-between items-center">
                       <span className="text-sm text-gray-600">Reference</span>
                       <span className="font-mono font-medium text-gray-900">#{selectedBooking.reference_number}</span>
                     </div>
                     <div className="flex justify-between items-center">
                       <span className="text-sm text-gray-600">Status</span>
                       <span className={`px-3 py-1 text-xs font-medium rounded-full ${
                         selectedBooking.status === 'confirmed' ? 'bg-emerald-100 text-emerald-800'
                           : selectedBooking.status === 'pending' ? 'bg-amber-100 text-amber-800'
                           : selectedBooking.status === 'checked-in' ? 'bg-blue-100 text-blue-800'
                           : selectedBooking.status === 'completed' ? 'bg-emerald-100 text-emerald-800'
                           : 'bg-rose-100 text-rose-800'
                       }`}>
                         {selectedBooking.status?.charAt(0).toUpperCase() + selectedBooking.status?.slice(1)}
                       </span>
                     </div>
                   </div>
                 </div>

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
                   </div>
                 </div>

                 {selectedBooking.room && (
                   <div className="mb-6">
                     <h4 className="text-sm font-semibold text-gray-700 uppercase mb-3">Space</h4>
                     <div className="bg-gray-50 rounded-lg p-4">
                       <div className="flex items-center">
                         <House className="h-4 w-4 text-gray-400 mr-3" />
                         <span className="font-medium text-gray-900">{selectedBooking.room.name || 'N/A'}</span>
                       </div>
                     </div>
                   </div>
                 )}

                 <div className="mb-6">
                   <h4 className="text-sm font-semibold text-gray-700 uppercase mb-3">Payment</h4>
                   <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                     <div className="flex justify-between items-center">
                       <span className="text-sm text-gray-600">Total Amount</span>
                       <span className="text-lg font-bold text-gray-900">${parseFloat(String(selectedBooking.total_amount || 0)).toFixed(2)}</span>
                     </div>
                     <div className="flex justify-between items-center">
                       <span className="text-sm text-gray-600">Payment Status</span>
                       <span className={`px-3 py-1 text-xs font-medium rounded-full ${resolvePaymentState(selectedBooking).pillClass}`}>
                         {resolvePaymentState(selectedBooking).label}
                       </span>
                     </div>
                     {cardFromPayments(selectedBooking.payments) && (
                       <div className="flex justify-between items-center">
                         <span className="text-sm text-gray-600">Card</span>
                         <span className="text-sm font-medium text-gray-900">{cardFromPayments(selectedBooking.payments)?.label}</span>
                       </div>
                     )}
                     {selectedBooking.applied_fees && selectedBooking.applied_fees.length > 0 && (
                       <div className="pt-2 border-t border-gray-100">
                         <p className="text-xs text-gray-500 mb-1">Applied Fees</p>
                         {selectedBooking.applied_fees.map((fee: { fee_name: string; fee_amount: number; fee_application_type: string }, i: number) => (
                           <div key={i} className="flex justify-between text-xs">
                             <span className="text-gray-600">{fee.fee_name} <span className="text-gray-400">({fee.fee_application_type})</span></span>
                             <span className="text-gray-900">${fee.fee_amount.toFixed(2)}</span>
                           </div>
                         ))}
                       </div>
                     )}
                     {(selectedBooking as any).applied_discounts && (selectedBooking as any).applied_discounts.length > 0 && (
                       <div className="pt-2 border-t border-gray-100">
                         <p className="text-xs text-gray-500 mb-1">Applied Discounts</p>
                         {(selectedBooking as any).applied_discounts.map((d: { discount_name: string; discount_amount: number; discount_type: string }, i: number) => (
                           <div key={i} className="flex justify-between text-xs">
                             <span className="text-gray-600">{d.discount_name} <span className="text-gray-400">({d.discount_type})</span></span>
                             <span className="text-green-600">-${d.discount_amount.toFixed(2)}</span>
                           </div>
                         ))}
                       </div>
                     )}
                   </div>
                 </div>

                 {guestNoteOf(selectedBooking) && (
                   <div className="mb-6">
                     <h4 className="text-sm font-semibold text-gray-700 uppercase mb-3">From the guest</h4>
                     <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                       <p className="text-sm whitespace-pre-line text-blue-900">{guestNoteOf(selectedBooking)}</p>
                     </div>
                   </div>
                 )}


                 <div className="mt-6 pt-4 border-t border-gray-200 space-y-2">
                   <div className="flex gap-2">
                     <Link
                       to={`/bookings/${selectedBooking.id}?from=dashboard`}
                       className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                       onClick={() => { setSelectedBooking(null); }}
                     >
                       <Eye size={15} />
                       View
                     </Link>
                     <Link
                       to={`/bookings/edit/${selectedBooking.id}?from=dashboard`}
                       className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                       onClick={() => { setSelectedBooking(null); }}
                     >
                       <Edit size={15} />
                       Edit
                     </Link>
                     {selectedBooking.status?.toLowerCase() !== 'checked-in' && selectedBooking.status?.toLowerCase() !== 'completed' && selectedBooking.status?.toLowerCase() !== 'cancelled' && selectedBooking.payment_status?.toLowerCase() === 'paid' && (
                       !showCheckInConfirm ? (
                         <button
                           onClick={() => setShowCheckInConfirm(true)}
                           className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-emerald-700 bg-white border border-emerald-300 rounded-lg hover:bg-emerald-50 transition-colors"
                         >
                           <LogIn size={15} />
                           Check In
                         </button>
                       ) : null
                     )}
                     {selectedBooking.status?.toLowerCase() !== 'checked-in' && selectedBooking.status?.toLowerCase() !== 'completed' && selectedBooking.status?.toLowerCase() !== 'cancelled' && selectedBooking.payment_status?.toLowerCase() !== 'paid' && (
                       <button
                         onClick={handleOpenPaymentModal}
                         className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-amber-700 bg-white border border-amber-300 rounded-lg hover:bg-amber-50 transition-colors"
                       >
                         <DollarSign size={15} />
                         Process Payment
                       </button>
                     )}
                     {selectedBooking.status?.toLowerCase() === 'checked-in' && (
                       <div className="flex-1 flex flex-col items-center gap-1">
                         <div className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg">
                           <CheckCircle size={15} />
                           Checked In
                         </div>
                         {selectedBooking.checked_in_at && (
                           <p className="text-xs text-emerald-600">
                             {new Date(selectedBooking.checked_in_at).toLocaleString()}
                             {selectedBooking.checked_in_by_user && (
                               <span> by {selectedBooking.checked_in_by_user.name}</span>
                             )}
                           </p>
                         )}
                       </div>
                     )}
                   </div>

                   {showCheckInConfirm && (
                     <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                       <p className="text-sm text-amber-800 font-medium mb-2">Confirm check-in for this party?</p>
                       <div className="flex gap-2">
                         <button
                           onClick={() => setShowCheckInConfirm(false)}
                           className="flex-1 px-3 py-2 text-sm font-medium rounded-lg bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
                         >
                           Cancel
                         </button>
                         <button
                           disabled={checkInLoading}
                           onClick={async () => {
                             setCheckInLoading(true);
                             try {
                               await bookingService.checkInBooking(selectedBooking.reference_number, getStoredUser()?.id);
                               setSelectedBooking({ ...selectedBooking, status: 'checked-in' });
                               setAllBookings(prev => prev.map(b => b.id === selectedBooking.id ? { ...b, status: 'checked-in' } : b));
                               setShowCheckInConfirm(false);
                             } catch (err) {
                               console.error('Check-in failed:', err);
                             } finally {
                               setCheckInLoading(false);
                             }
                           }}
                           className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
                         >
                           {checkInLoading ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                           {checkInLoading ? 'Checking in...' : 'Confirm'}
                         </button>
                       </div>
                     </div>
                   )}

                   <StandardButton
                     onClick={() => { setSelectedBooking(null); setShowCheckInConfirm(false); }}
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

         {showPaymentModal && selectedBooking && (
           <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={handleClosePaymentModal}>
             <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
               <div className={`p-6 border-b border-gray-100 bg-${themeColor}-50`}>
                 <h2 className="text-xl font-bold text-gray-900">Process Payment</h2>
                 <p className="text-sm text-gray-600 mt-1">Booking: {selectedBooking.reference_number}</p>
               </div>
               <div className="p-6 space-y-4">
                 <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                   <div className="flex justify-between text-sm">
                     <span className="text-gray-600">Total Amount:</span>
                     <span className="font-semibold">${Number(selectedBooking.total_amount || 0).toFixed(2)}</span>
                   </div>
                   <div className="flex justify-between text-sm">
                     <span className="text-gray-600">Already Paid:</span>
                     <span className="font-semibold text-green-600">${Number(selectedBooking.amount_paid || 0).toFixed(2)}</span>
                   </div>
                   <div className="flex justify-between text-sm pt-2 border-t border-gray-200">
                     <span className="text-gray-900 font-medium">Remaining Balance:</span>
                     <span className="font-bold text-red-600">${(Number(selectedBooking.total_amount || 0) - Number(selectedBooking.amount_paid || 0)).toFixed(2)}</span>
                   </div>
                 </div>
                 <div>
                   <label className="block text-sm font-medium text-gray-700 mb-2">Payment Amount *</label>
                   <div className="relative">
                     <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                     <input type="number" step="0.01" min="0.01"
                       max={(Number(selectedBooking.total_amount || 0) - Number(selectedBooking.amount_paid || 0)).toFixed(2)}
                       value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)}
                       className={`w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-transparent`}
                       placeholder="0.00" />
                   </div>
                 </div>
                 <div>
                   <label className="block text-sm font-medium text-gray-700 mb-2">Payment Method *</label>
                   <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as 'card' | 'in-store')}
                     className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-transparent`}>
                     <option value="in-store">In-Store</option>
                     <option value="card">Card</option>
                   </select>
                 </div>
                 <div>
                   <label className="block text-sm font-medium text-gray-700 mb-2">Notes (Optional)</label>
                   <textarea value={paymentNotes} onChange={(e) => setPaymentNotes(e.target.value)} rows={3}
                     className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-transparent`}
                     placeholder="Add any notes about this payment..." />
                 </div>
               </div>
               <div className="p-6 border-t border-gray-100 flex gap-3 justify-end">
                 <StandardButton variant="secondary" onClick={handleClosePaymentModal} disabled={processingPayment}>Cancel</StandardButton>
                 <StandardButton variant="primary" onClick={handleSubmitPayment}
                   disabled={processingPayment || !paymentAmount || parseFloat(paymentAmount) <= 0}
                   loading={processingPayment}>
                   {processingPayment ? 'Processing...' : 'Process Payment'}
                 </StandardButton>
               </div>
             </div>
           </div>
         )}

         <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
           <h2 className="text-base font-semibold text-gray-900 mb-3 flex items-center gap-2">
             <Zap className={`w-4 h-4 text-${fullColor}`} /> Quick Actions
           </h2>
           {canEditQuickActions && (
             <div className="mb-3 flex flex-wrap items-center gap-2">
               <span className="text-xs text-gray-500 mr-1">Shown to staff:</span>
               {allQuickActions.map((a) => {
                 const shown = !hiddenQuickActions.includes(a.title);
                 return (
                   <button
                     key={`qa-toggle-${a.title}`}
                     type="button"
                     onClick={() => void toggleQuickAction(a.title)}
                     className={`text-xs px-2 py-1 rounded-full border transition ${
                       shown
                         ? 'bg-white border-gray-300 text-gray-700'
                         : 'bg-gray-100 border-gray-200 text-gray-400 line-through'
                     }`}
                     title={shown ? `Hide ${a.title} from staff` : `Show ${a.title} to staff`}
                   >
                     {a.title}
                   </button>
                 );
               })}
             </div>
           )}
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
                         {purchase.purchase_date ? formatLocalDateTime(purchase.purchase_date, { 
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

         {recentEventPurchases.length > 0 && (
           <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
             <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
               <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                 <CalendarDays className={`w-5 h-5 text-${fullColor}`} /> Recent Event Purchases
               </h2>
             </div>
             <div className="overflow-x-auto">
               <table className="w-full text-sm text-left">
                 <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b">
                   <tr>
                     <th className="px-4 py-3 font-medium">Customer</th>
                     <th className="px-4 py-3 font-medium">Event</th>
                     <th className="px-4 py-3 font-medium">Qty</th>
                     <th className="px-4 py-3 font-medium">Amount</th>
                     <th className="px-4 py-3 font-medium">Paid</th>
                     <th className="px-4 py-3 font-medium">Date</th>
                     <th className="px-4 py-3 font-medium">Status</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-gray-100">
                   {recentEventPurchases.slice(0, 5).map((ep: any) => (
                     <tr key={ep.id} className="hover:bg-gray-50">
                       <td className="px-4 py-3 font-medium text-gray-900">{ep.customer_name || 'Guest'}</td>
                       <td className="px-4 py-3 text-gray-900">{ep.event_name || 'Event'}</td>
                       <td className="px-4 py-3 text-center">{ep.quantity}</td>
                       <td className="px-4 py-3 font-bold text-gray-900">${parseFloat(String(ep.total_amount || 0)).toFixed(2)}</td>
                       <td className="px-4 py-3 text-gray-700">${parseFloat(String(ep.amount_paid || 0)).toFixed(2)}</td>
                       <td className="px-4 py-3 text-gray-500">
                         {formatLocalDateTime(ep.purchase_date || ep.created_at, { month: 'short', day: 'numeric', year: 'numeric' })}
                       </td>
                       <td className="px-4 py-3">
                         <span className={`px-2 py-1 text-xs font-medium rounded-full capitalize ${
                           ep.status === 'completed' ? 'bg-green-100 text-green-700' :
                           ep.status === 'confirmed' ? 'bg-blue-100 text-blue-700' :
                           ep.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                           ep.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                           'bg-gray-100 text-gray-700'
                         }`}>
                           {ep.status}
                         </span>
                       </td>
                     </tr>
                   ))}
                 </tbody>
               </table>
             </div>
           </div>
         )}

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
                   <th className="px-4 py-3 font-medium">Created</th>
                   <th className="px-4 py-3 font-medium">Participants</th>
                   <th className="px-4 py-3 font-medium">Amount</th>
                   <th className="px-4 py-3 font-medium">Payment</th>
                   <th className="px-4 py-3 font-medium">Status</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-gray-100">
                 {filteredBookings.slice(0, 5).map((booking: any, index: number) => (
                   <tr key={index} className="hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/bookings/${booking.id}?from=dashboard`)}>
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
                           {booking.booking_time ? convertTo12Hour(booking.booking_time) : 'N/A'}
                         </span>
                       </div>
                     </td>
                     <td className="px-4 py-3">
                       <div className="flex flex-col">
                         <span className="text-sm text-gray-900">
                           {booking.created_at ? formatLocalDateTime(booking.created_at, { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'}
                         </span>
                         <span className="text-xs text-gray-500">
                           {booking.created_at ? formatLocalDateTime(booking.created_at, { hour: '2-digit', minute: '2-digit' }) : ''}
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
                       <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${resolvePaymentState(booking).pillClass}`}>
                         {resolvePaymentState(booking).label}
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
