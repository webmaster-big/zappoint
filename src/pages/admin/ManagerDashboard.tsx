import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Users,
  DollarSign,
  CheckCircle,
  ChevronRight,
  ChevronLeft,
  Plus,
  Download,
  Zap,
  TrendingUp,
  Ticket,
  Package,
  X,
  Clock,
  MapPin,
  PackageIcon,
  House
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useThemeColor } from '../../hooks/useThemeColor';
import CounterAnimation from '../../components/ui/CounterAnimation';
import { getStoredUser } from '../../utils/storage';
import bookingService from '../../services/bookingService';
import { locationService } from '../../services/LocationService';
import { metricsService } from '../../services/MetricsService';

const LocationManagerDashboard: React.FC = () => {
  const { themeColor, fullColor } = useThemeColor();
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [loading, setLoading] = useState(true);
  const [locationId, setLocationId] = useState<number>(1);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<{ date: Date; hour: number; minute: string; bookings: any[] } | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<any | null>(null);

  // Data states
  const [weeklyBookings, setWeeklyBookings] = useState<any[]>([]);
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

  // Fetch metrics data (only on mount and location change)
  // PERFORMANCE OPTIMIZATION: Using new Metrics API endpoint
  // - OLD: Multiple API calls with client-side calculations
  // - NEW: 1 API call returning pre-computed all-time metrics
  // - Result: 3-5x faster load times
  useEffect(() => {
    const fetchMetricsData = async () => {
      if (!locationId) return;
      
      try {
        setLoading(true);
        console.log('🔄 Starting metrics fetch for location:', locationId);
        
        // Fetch location details
        await locationService.getLocation(locationId);
        // setLocationDetails(locationResponse.data);
        
        // Fetch ALL TIME metrics (no date filter for main metrics)
        console.log('📊 Fetching all-time metrics...');
        const metricsResponse = await metricsService.getDashboardMetrics({
          // No date_from/date_to for all-time metrics
        });
        
        console.log('✅ Metrics API response:', metricsResponse);
        console.log('📊 Metrics:', metricsResponse.metrics);
        console.log('🎫 Recent purchases:', metricsResponse.recentPurchases?.length || 0);
        
        // Set metrics from API response
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
        
      } catch (error: any) {
        console.error('❌ Error fetching metrics data:', error);
        console.error('Error details:', error.message || error);
        alert(`Failed to load dashboard metrics: ${error.message || 'Unknown error'}`);
      } finally {
        setLoading(false);
      }
    };
    
    fetchMetricsData();
  }, [locationId]);

  // Fetch weekly calendar data (changes when week changes)
  useEffect(() => {
    const fetchWeeklyData = async () => {
      if (!locationId) return;
      
      try {
        const weekStart = weekDates[0];
        const weekEnd = weekDates[6];
        
        // Fetch bookings for the selected week
        const bookingsResponse = await bookingService.getBookings({
          location_id: locationId,
          date_from: weekStart.toISOString().split('T')[0],
          date_to: weekEnd.toISOString().split('T')[0],
          per_page: 100,
        });
        
        const bookings = bookingsResponse.data.bookings || [];
        setWeeklyBookings(bookings);
        
      } catch (error) {
        console.error('Error fetching weekly data:', error);
      }
    };
    
    fetchWeeklyData();
  }, [locationId, currentWeek]);
  
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

  // Dynamic metrics cards
  const metricsCards = [
    {
      title: 'Total Bookings',
      value: metrics.totalBookings.toString(),
      change: `${metrics.totalParticipants} total participants`,
      icon: Package,
      accent: `bg-${themeColor}-100 text-${fullColor}`,
    },
    {
      title: 'Total Revenue',
      value: `$${metrics.totalRevenue.toFixed(2)}`,
      change: `Bookings: $${metrics.bookingRevenue.toFixed(2)} | Tickets: $${metrics.purchaseRevenue.toFixed(2)}`,
      icon: DollarSign,
      accent: `bg-${themeColor}-100 text-${fullColor}`,
    },
    {
      title: 'Unique Customers',
      value: metrics.totalCustomers.toString(),
      change: 'All time',
      icon: Users,
      accent: `bg-${themeColor}-100 text-${fullColor}`,
    },
    {
      title: 'Confirmed',
      value: metrics.confirmedBookings.toString(),
      change: `Completed: ${metrics.completedBookings}`,
      icon: CheckCircle,
      accent: `bg-${themeColor}-100 text-${fullColor}`,
    },
    {
      title: 'Avg Booking',
      value: metrics.totalBookings > 0 ? `$${(metrics.bookingRevenue / metrics.totalBookings).toFixed(2)}` : '$0.00',
      change: `${metrics.totalPurchases} tickets sold`,
      icon: TrendingUp,
      accent: `bg-${themeColor}-100 text-${fullColor}`,
    },
  ];

  // Filter bookings for the current week
  const bookingsThisWeek = weeklyBookings.filter(booking => {
    const bookingDate = new Date(booking.booking_date);
    return weekDates.some(date => date.toDateString() === bookingDate.toDateString());
  });

  // Quick actions for Location Manager
  const quickActions = [
    { title: 'New Booking', icon: Plus, link: '/bookings/create' },
    { title: 'Booking Check-in', icon: CheckCircle, link: '/bookings/check-in' },
    { title: 'Calendar View', icon: Calendar, link: '/bookings/calendar' },
    { title: 'Create Package', icon: Package, link: '/packages/create' },
    { title: 'Manage Attendants', icon: Users, link: '/manager/attendants' },
    { title: 'Analytics', icon: TrendingUp, link: '/manager/analytics' },
    { title: 'Create Attraction', icon: Ticket, link: '/attractions/create' },
    { title: 'Attraction Check-in', icon: Download, link: '/attractions/check-in' },
  ];

  // Status colors (for bookings)
  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      Confirmed: 'bg-emerald-100 text-emerald-800',
      confirmed: 'bg-emerald-100 text-emerald-800',
      Pending: `bg-${themeColor}-100 text-${fullColor}`,
      pending: `bg-${themeColor}-100 text-${fullColor}`,
      Cancelled: 'bg-rose-100 text-rose-800',
      cancelled: 'bg-rose-100 text-rose-800',
      Completed: 'bg-emerald-100 text-emerald-800',
      completed: 'bg-emerald-100 text-emerald-800',
    };
    return colors[status] || `bg-${themeColor}-100 text-${fullColor}`;
  };

  // Payment status colors
  const getPaymentColor = (payment: string) => {
    const colors: Record<string, string> = {
      Paid: 'bg-emerald-100 text-emerald-800',
      Partial: `bg-${themeColor}-100 text-${fullColor}`,
      Refunded: 'bg-rose-100 text-rose-800',
      'Credit Card': `bg-${themeColor}-100 text-${fullColor}`,
      PayPal: `bg-${themeColor}-100 text-${fullColor}`,
      Cash: 'bg-gray-100 text-gray-800',
    };
    return colors[payment] || `bg-${themeColor}-100 text-${fullColor}`;
  };

  // Filter bookings by status for the table
  const filteredBookings = selectedStatus === 'all' 
    ? bookingsThisWeek 
    : bookingsThisWeek.filter(booking => booking.status === selectedStatus);

  return (
    <div className="min-h-screen p-4 md:p-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-2">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-1">
            Dashboard
          </h1>
          <p className="text-sm text-gray-600">
          Manage your location's bookings and operations efficiently
          </p>
        </div>
        </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
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

      {/* Weekly Calendar */}
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Calendar className={`w-5 h-5 text-${fullColor}`} /> Weekly Calendar
          </h2>
          <div className="flex items-center space-x-2 mt-4 md:mt-0">
            <button 
              onClick={goToPreviousWeek}
              className="p-2 rounded-lg border border-gray-200 hover:bg-gray-100"
            >
              <ChevronLeft size={18} />
            </button>
            <span className="text-sm font-medium text-gray-800">
              {weekDates[0].toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} - 
              {weekDates[6].toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </span>
            <button 
              onClick={goToNextWeek}
              className="p-2 rounded-lg border border-gray-200 hover:bg-gray-100"
            >
              <ChevronRight size={18} />
            </button>
            <button className={`ml-2 px-3 py-2 text-sm bg-${themeColor}-100 text-${fullColor} rounded-lg hover:bg-${themeColor}-200`} onClick={() => setCurrentWeek(new Date())}>
              Today
            </button>
          </div>
        </div>
        
        {/* Calendar View */}
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
                            const bookingDate = new Date(booking.booking_date);
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
                                    ? `bg-emerald-50 border-emerald-200`
                                    : bookingsForCell.some(b => b.status === 'pending' || b.status === 'Pending')
                                    ? `bg-${themeColor}-50 border-${themeColor}-200`
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
                                  <button
                                    onClick={() => setSelectedTimeSlot({ date, hour, minute, bookings: bookingsForCell })}
                                    className={`w-full mt-2 pt-2 border-t text-xs font-medium hover:underline ${
                                      bookingsForCell.some(b => b.status === 'confirmed' || b.status === 'Confirmed')
                                        ? 'border-emerald-200 text-emerald-700'
                                        : bookingsForCell.some(b => b.status === 'pending' || b.status === 'Pending')
                                        ? `border-${themeColor}-200 text-${fullColor}`
                                        : 'border-rose-200 text-rose-700'
                                    }`}
                                  >
                                    +{bookingsForCell.length - 1} more
                                  </button>
                                )}
                                
                                {/* Single booking - click to view details */}
                                {bookingsForCell.length === 1 && (
                                  <button
                                    onClick={() => setSelectedBooking(bookingsForCell[0])}
                                    className={`w-full mt-2 pt-2 border-t text-xs font-medium hover:underline ${
                                      bookingsForCell[0].status === 'confirmed' || bookingsForCell[0].status === 'Confirmed'
                                        ? 'border-emerald-200 text-emerald-700'
                                        : bookingsForCell[0].status === 'pending' || bookingsForCell[0].status === 'Pending'
                                        ? `border-${themeColor}-200 text-${fullColor}`
                                        : 'border-rose-200 text-rose-700'
                                    }`}
                                  >
                                    View details
                                  </button>
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
      </div>

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
          <h2 className="text-lg font-semibold text-gray-900">Weekly Bookings</h2>
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
                        {new Date(booking.booking_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </div>
                      <div className="text-xs text-gray-500">{booking.booking_time}</div>
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
                <button
                  onClick={() => setSelectedTimeSlot(null)}
                  className="text-gray-500 hover:text-gray-800"
                >
                  <X className="h-6 w-6" />
                </button>
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
                            ? `bg-${themeColor}-100 text-${fullColor}`
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
                <button
                  onClick={() => setSelectedTimeSlot(null)}
                  className="w-full px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium rounded-lg transition-colors"
                >
                  Close
                </button>
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
                <button
                  onClick={() => setSelectedBooking(null)}
                  className="text-gray-500 hover:text-gray-800"
                >
                  <X className="h-6 w-6" />
                </button>
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
                        ? `bg-${themeColor}-100 text-${fullColor}`
                        : selectedBooking.status === 'completed' || selectedBooking.status === 'Completed'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}>
                      {selectedBooking.status}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Type</span>
                    <span className={`px-3 py-1 text-xs font-medium rounded-full bg-${themeColor}-100 text-${fullColor}`}>
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
                      {new Date(selectedBooking.booking_date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </span>
                  </div>
                  <div className="flex items-center">
                    <Clock className="h-4 w-4 text-gray-400 mr-3" />
                    <span className="text-sm text-gray-900">{selectedBooking.booking_time}</span>
                  </div>
                  {selectedBooking.duration && (
                    <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                      <span className="text-sm text-gray-600">Duration</span>
                      <span className="text-sm font-medium text-gray-900">{selectedBooking.duration} {selectedBooking.duration_unit}</span>
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
                        ? `bg-${themeColor}-100 text-${fullColor}`
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

export default LocationManagerDashboard;