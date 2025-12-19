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
} from 'lucide-react';
import { useThemeColor } from '../../hooks/useThemeColor';
import CounterAnimation from '../../components/ui/CounterAnimation';
import StandardButton from '../../components/ui/StandardButton';
import { getStoredUser } from '../../utils/storage';
import bookingService from '../../services/bookingService';
import MetricsService from '../../services/MetricsService';

const AttendantDashboard: React.FC = () => {
   const { themeColor, fullColor } = useThemeColor();
   const [currentWeek, setCurrentWeek] = useState(new Date());
   const [loading, setLoading] = useState(true);
   const [locationId, setLocationId] = useState<number>(1);
   
   // Data states
   const [weeklyBookings, setWeeklyBookings] = useState<any[]>([]);
   const [ticketPurchases, setTicketPurchases] = useState<any[]>([]);
   const [recentBookings, setRecentBookings] = useState<any[]>([]);
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

   // Fetch metrics data (only on mount and location change)
   useEffect(() => {
     const fetchMetricsData = async () => {
       if (!locationId) return;
       
       try {
         setLoading(true);
         
         // Fetch all-time metrics from API
         const metricsResponse = await MetricsService.getAttendantMetrics({
           location_id: locationId,
         });
         
         console.log('📊 Attendant Metrics Response:', metricsResponse);
         
         // Set metrics from API
         setMetrics(metricsResponse.metrics);
         
         // Set recent purchases from API
         setTicketPurchases(metricsResponse.recentPurchases || []);
         
         // Set recent bookings from API
         setRecentBookings(metricsResponse.recentBookings || []);
         
       } catch (error) {
         console.error('Error fetching metrics data:', error);
       } finally {
         setLoading(false);
       }
     };
     
     fetchMetricsData();
   }, [locationId]);

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

   // Dynamic metrics cards
   const metricsCards = [
     {
       title: 'Total Bookings',
       value: metrics.totalBookings.toString(),
       change: `${metrics.totalParticipants} total participants`,
       icon: Calendar,
       accent: `bg-${themeColor}-100 text-${fullColor}`,
     },
     {
       title: 'Pending Approvals',
       value: metrics.pendingBookings.toString(),
       change: 'Require attention',
       icon: AlertTriangle,
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
       title: 'Total Revenue',
       value: `$${metrics.totalRevenue.toFixed(2)}`,
       change: `Bookings: $${metrics.bookingRevenue.toFixed(2)}`,
       icon: DollarSign,
       accent: `bg-${themeColor}-100 text-${fullColor}`,
     },
     {
       title: 'Ticket Sales',
       value: metrics.totalPurchases.toString(),
       change: `Revenue: $${metrics.purchaseRevenue.toFixed(2)}`,
       icon: Ticket,
       accent: `bg-${themeColor}-100 text-${fullColor}`,
     },
   ];

   // Filter bookings for the current week
   const bookingsThisWeek = weeklyBookings.filter(booking => {
     const bookingDate = new Date(booking.booking_date);
     return weekDates.some(date => date.toDateString() === bookingDate.toDateString());
   });

   // Quick actions for attendant
   const quickActions = [
     { title: 'New Booking', icon: Plus, href: '/bookings/create' },
     { title: 'Check-in', icon: QrCode, href: '/bookings/check-in' },
     { title: 'Attraction Check-in', icon: Ticket, href: '/attractions/check-in' },
     { title: 'Calendar', icon: Calendar, href: '/bookings/calendar' },
     { title: 'Manage Bookings', icon: TrendingUp, href: '/bookings' },
     { title: 'Customers', icon: Users, href: '/customers' },
     { title: 'Manage Packages', icon: DollarSign, href: '/packages' },
     { title: 'Attractions', icon: Ticket, href: '/attractions' },
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

   return (
       <div className=" min-h-screen md:p-8 space-y-8">
         {/* Header */}
         <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-2">
           <div>
             <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2 mb-1">
                Dashboard
             </h1>
             <p className="text-base text-gray-800">Overview of all bookings and sales</p>
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

         {/* Weekly Calendar */}
         <div className="bg-white rounded-xl shadow-sm p-4 md:p-6 border border-gray-100">
           <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
             <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
               <Calendar className={`w-6 h-6 text-${fullColor}`} /> Weekly Calendar
             </h2>
             <div className="flex items-center space-x-2 mt-4 md:mt-0">
               <StandardButton 
                 onClick={goToPreviousWeek}
                 variant="secondary"
                 size="sm"
                 icon={ChevronLeft}
               />
               <span className="text-sm font-medium text-gray-800">
                 {weekDates[0].toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} - 
                 {weekDates[6].toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
               </span>
               <StandardButton 
                 onClick={goToNextWeek}
                 variant="secondary"
                 size="sm"
                 icon={ChevronRight}
               />
               <StandardButton 
                 className="ml-2"
                 variant="primary"
                 size="sm"
                 onClick={() => setCurrentWeek(new Date())}
               >
                 Today
               </StandardButton>
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
         </div>

         {/* Quick Actions */}
         <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
           <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
             <Zap className={`w-5 h-5 text-${fullColor}`} /> Quick Actions
           </h2>
           <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-8 gap-3">
             {quickActions.map((action, index) => {
               const Icon = action.icon;
               return (
                 <Link
                   key={index}
                   to={action.href}
                   className={`flex flex-col items-center justify-center text-white py-6 px-4 rounded-xl font-semibold transition bg-${fullColor} hover:bg-${themeColor}-700 hover:scale-[1.03] active:scale-95`}
                 >
                   <Icon size={24} />
                   <span className="text-sm mt-2 text-center">{action.title}</span>
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
                           {booking.booking_date ? new Date(booking.booking_date).toLocaleDateString('en-US', { 
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