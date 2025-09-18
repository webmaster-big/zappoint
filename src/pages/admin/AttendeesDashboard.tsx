import React, { useState } from 'react';
import {
  Calendar,
  AlertTriangle,
  Package,
  DollarSign,
  CheckCircle,
  ChevronRight,
  ChevronLeft,
  Plus,
  Search,
  Filter,
  Download,
  Mail,
  Zap,
  X,
  Activity,
  Star,
} from 'lucide-react';

const AttendantDashboard: React.FC = () => {
   const [currentWeek, setCurrentWeek] = useState(new Date());
   const [selectedStatus, setSelectedStatus] = useState('all');
   const [calendarFilter, setCalendarFilter] = useState({
     type: 'all', // 'all', 'package', 'activity'
     value: '' // specific package/activity name
   });
   const [showFilterPanel, setShowFilterPanel] = useState(false);

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

   // Metrics data
   const metrics = [
     {
       title: 'Weekly Bookings',
       value: '142',
       change: '+12% from last week',
       trend: 'up',
       icon: Calendar,
       accent: 'bg-blue-100 text-blue-700',
     },
     {
       title: 'Pending Approvals',
       value: '5',
       change: '2 require urgent attention',
       trend: 'neutral',
       icon: AlertTriangle,
       accent: 'bg-blue-100 text-blue-700',
     },
     {
       title: 'Activities Scheduled',
       value: '87',
       change: 'Laser Tag most popular',
       trend: 'up',
       icon: Zap,
       accent: 'bg-blue-100 text-blue-700',
     },
     {
       title: 'Packages Booked',
       value: '55',
       change: 'Corporate leading',
       trend: 'up',
       icon: Package,
       accent: 'bg-blue-100 text-blue-700',
     },
     {
       title: 'Weekly Revenue',
       value: '$12,845',
       change: '+8% from last week',
       trend: 'up',
       icon: DollarSign,
       accent: 'bg-blue-100 text-blue-700',
     },
   ];

   // Bookings have real, fixed dates
   const weeklyBookings = [
     { id: 1, date: new Date('2025-09-16'), time: '9:00 AM', duration: 2, activity: 'Laser Tag', package: null, participants: 12, status: 'Confirmed', payment: 'Paid', customer: 'Tech Solutions Inc.', contact: 'John Smith', phone: '(555) 123-4567', email: 'john@techsolutions.com', amount: '$480', specialRequests: 'Team building event' },
     { id: 2, date: new Date('2025-09-17'), time: '10:30 AM', duration: 1.5, activity: null, package: 'Adventure Package', participants: 6, status: 'Confirmed', payment: 'Paid', customer: 'Sarah Johnson', contact: 'Sarah Johnson', phone: '(555) 987-6543', email: 'sarahj@email.com', amount: '$180', specialRequests: 'Celebrating birthday' },
     { id: 3, date: new Date('2025-09-18'), time: '12:00 PM', duration: 2, activity: 'Bowling', package: null, participants: 4, status: 'Pending', payment: 'Partial', customer: 'Mike Thompson', contact: 'Mike Thompson', phone: '(555) 456-7890', email: 'mike.t@email.com', amount: '$180', specialRequests: 'First time visitors' },
     { id: 4, date: new Date('2025-09-16'), time: '2:00 PM', duration: 3, activity: null, package: 'Birthday Package', participants: 15, status: 'Confirmed', payment: 'Paid', customer: 'Lisa Williams', contact: 'Lisa Williams', phone: '(555) 234-5678', email: 'lisa.w@email.com', amount: '$450', specialRequests: 'Birthday cake will be brought in' },
     { id: 5, date: new Date('2025-09-17'), time: '4:30 PM', duration: 2, activity: 'Bowling', package: null, participants: 8, status: 'Cancelled', payment: 'Refunded', customer: 'David Miller', contact: 'David Miller', phone: '(555) 876-5432', email: 'davidm@email.com', amount: '$200', specialRequests: 'Need two lanes' },
     { id: 6, date: new Date('2025-09-20'), time: '11:00 AM', duration: 1.5, activity: null, package: 'Corporate Package', participants: 10, status: 'Confirmed', payment: 'Paid', customer: 'XYZ Corp', contact: 'Robert Brown', phone: '(555) 345-6789', email: 'rbrown@xyz.com', amount: '$700', specialRequests: 'Executive team' },
     { id: 7, date: new Date('2025-09-19'), time: '3:00 PM', duration: 2, activity: 'Arcade', package: null, participants: 6, status: 'Confirmed', payment: 'Partial', customer: 'Jennifer Lee', contact: 'Jennifer Lee', phone: '(555) 765-4321', email: 'jennifer@email.com', amount: '$150', specialRequests: 'Family outing' },
     // Additional bookings to demonstrate same time slots
     { id: 8, date: new Date('2025-09-16'), time: '9:00 AM', duration: 1, activity: 'VR Experience', package: null, participants: 4, status: 'Confirmed', payment: 'Paid', customer: 'Innovate Tech', contact: 'Alex Johnson', phone: '(555) 111-2222', email: 'alex@innovatetech.com', amount: '$120', specialRequests: 'VR setup needed' },
     { id: 9, date: new Date('2025-09-17'), time: '10:30 AM', duration: 2, activity: 'Escape Room', package: null, participants: 8, status: 'Confirmed', payment: 'Paid', customer: 'Team Builders Co.', contact: 'Maria Garcia', phone: '(555) 333-4444', email: 'maria@teambuilders.com', amount: '$240', specialRequests: 'Beginner level room' },
   ];

   // Only show bookings for the current week in the calendar and table
   const bookingsThisWeek = weeklyBookings.filter(booking => {
     return weekDates.some(date => date.toDateString() === booking.date.toDateString());
   });

   // Get unique activities and packages for filter options
   const allActivities = Array.from(new Set(weeklyBookings
     .map(booking => booking.activity)
     .filter(activity => activity !== null))) as string[];
   
   const allPackages = Array.from(new Set(weeklyBookings
     .map(booking => booking.package)
     .filter(pkg => pkg !== null))) as string[];

   // Apply calendar filter
   const filteredCalendarBookings = bookingsThisWeek.filter(booking => {
     if (calendarFilter.type === 'all') return true;
     if (calendarFilter.type === 'activity' && booking.activity === calendarFilter.value) return true;
     if (calendarFilter.type === 'package' && booking.package === calendarFilter.value) return true;
     return false;
   });

   // Generate time slots from 8:00 AM to 8:00 PM in 30-minute intervals
   const generateTimeSlots = () => {
     const slots = [];
     for (let hour = 8; hour <= 20; hour++) {
       for (let minute = 0; minute < 60; minute += 30) {
         const timeString = `${hour > 12 ? hour - 12 : hour}:${minute === 0 ? '00' : minute} ${hour >= 12 ? 'PM' : 'AM'}`;
         slots.push(timeString);
       }
     }
     return slots;
   };

   const timeSlots = generateTimeSlots();

   // Group bookings by time slot and day
   const groupBookingsByTimeAndDay = () => {
     const grouped: {[key: string]: {[key: string]: any[]}} = {};
     
     // Initialize structure
     timeSlots.forEach(time => {
       grouped[time] = {};
       weekDates.forEach(date => {
         const dateStr = date.toDateString();
         grouped[time][dateStr] = [];
       });
     });
     
     // Populate with bookings
     filteredCalendarBookings.forEach(booking => {
       const dateStr = booking.date.toDateString();
       const time = booking.time;
       
       if (grouped[time] && grouped[time][dateStr]) {
         grouped[time][dateStr].push(booking);
       }
     });
     
     return grouped;
   };

   const groupedBookings = groupBookingsByTimeAndDay();

   // Quick actions
   const quickActions = [
     { title: 'New Booking', icon: Plus, accent: 'bg-blue-700 hover:bg-blue-800' },
     { title: 'Check-in', icon: CheckCircle, accent: 'bg-blue-700 hover:bg-blue-800' },
     { title: 'Send Reminders', icon: Mail, accent: 'bg-blue-700 hover:bg-blue-800' },
     { title: 'Export Data', icon: Download, accent: 'bg-blue-700 hover:bg-blue-800' },
   ];

   // Status colors
   const statusColors = {
     Confirmed: 'bg-emerald-100 text-emerald-700',
     Pending: 'bg-amber-100 text-amber-700',
     Cancelled: 'bg-rose-100 text-rose-700',
   };

   // Payment status colors
   const paymentColors = {
     Paid: 'bg-emerald-100 text-emerald-700',
     Partial: 'bg-amber-100 text-amber-700',
     Refunded: 'bg-rose-100 text-rose-700',
   };

   // Filter bookings by status for the table
   const filteredBookings = selectedStatus === 'all' 
     ? bookingsThisWeek 
     : bookingsThisWeek.filter(booking => booking.status === selectedStatus);

   // Clear calendar filter
   const clearCalendarFilter = () => {
     setCalendarFilter({ type: 'all', value: '' });
   };

   return (
       <div className=" min-h-screen md:p-8 space-y-8">
         {/* Header */}
         <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-2">
           <div>
             <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2 mb-1">
                Attendant Dashboard
             </h1>
             <p className="text-base text-gray-700">Weekly overview of bookings and activities</p>
           </div>
           <button className="mt-4 md:mt-0 px-5 py-2.5 bg-blue-700 text-white rounded-xl flex items-center gap-2 hover:bg-blue-700 transition font-semibold shadow-sm">
             <Plus size={20} />
             <span>New Booking</span>
           </button>
         </div>

         {/* Metrics Grid */}
         <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
           {metrics.map((metric, index) => {
             const Icon = metric.icon;
             return (
               <div
                 key={index}
                 className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex flex-col gap-2 hover:shadow-md transition-shadow min-h-[120px]"
               >
                 <div className="flex items-center gap-2">
                   <div className={`p-2 rounded-lg ${metric.accent}`}><Icon size={20} /></div>
                   <span className="text-base font-semibold text-gray-700">{metric.title}</span>
                 </div>
                 <div className="flex items-end gap-2 mt-2">
                   <h3 className="text-2xl font-bold text-gray-900">{metric.value}</h3>
                 </div>
                 <p className="text-xs mt-1 text-gray-400">{metric.change}</p>
               </div>
             );
           })}
         </div>

         {/* Weekly Calendar */}
         <div className="bg-white rounded-xl shadow-sm p-4 md:p-6 border border-gray-100">
           <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
             <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
               <Calendar className="w-6 h-6 text-blue-700" /> Weekly Calendar
             </h2>
             <div className="flex items-center space-x-2 mt-4 md:mt-0">
               <button 
                 onClick={goToPreviousWeek}
                 className="p-2 rounded-lg border border-gray-200 hover:bg-gray-100"
               >
                 <ChevronLeft size={18} />
               </button>
               <span className="text-sm font-medium text-gray-700">
                 {weekDates[0].toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} - 
                 {weekDates[6].toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
               </span>
               <button 
                 onClick={goToNextWeek}
                 className="p-2 rounded-lg border border-gray-200 hover:bg-gray-100"
               >
                 <ChevronRight size={18} />
               </button>
               <button className="ml-2 px-3 py-2 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-400" onClick={() => setCurrentWeek(new Date())}>
                 Today
               </button>
               
               {/* Calendar Filter Toggle */}
               <button 
                 onClick={() => setShowFilterPanel(!showFilterPanel)}
                 className={`ml-2 px-3 py-2 text-sm rounded-lg flex items-center ${
                   calendarFilter.type !== 'all' 
                     ? 'bg-blue-100 text-blue-700 border border-blue-300' 
                     : 'bg-gray-100 text-gray-700 border border-gray-200'
                 }`}
               >
                 <Filter size={16} className="mr-1" />
                 Filter
                 {calendarFilter.type !== 'all' && (
                   <span className="ml-1 bg-blue-700 text-white rounded-full w-4 h-4 flex items-center justify-center text-xs">
                     !
                   </span>
                 )}
               </button>
             </div>
           </div>
           
           {/* Filter Panel */}
           {showFilterPanel && (
             <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
               <div className="flex justify-between items-center mb-3">
                 <h3 className="font-medium text-gray-700">Filter Calendar</h3>
                 <button 
                   onClick={() => setShowFilterPanel(false)}
                   className="text-gray-700 hover:text-gray-700"
                 >
                   <X size={18} />
                 </button>
               </div>
               
               <div className="flex flex-wrap gap-4">
                 <div className="flex items-center">
                   <input
                     type="radio"
                     id="filter-all"
                     name="calendar-filter"
                     checked={calendarFilter.type === 'all'}
                     onChange={() => setCalendarFilter({ type: 'all', value: '' })}
                     className="mr-2"
                   />
                   <label htmlFor="filter-all" className="text-sm text-gray-700">
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
                   <label htmlFor="filter-activity" className="text-sm text-gray-700 mr-2">
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
                   <label htmlFor="filter-package" className="text-sm text-gray-700 mr-2">
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
                 
                 {calendarFilter.type !== 'all' && (
                   <button
                     onClick={clearCalendarFilter}
                     className="ml-auto text-sm text-blue-700 hover:text-blue-700 flex items-center"
                   >
                     <X size={14} className="mr-1" />
                     Clear Filter
                   </button>
                 )}
               </div>
               
               {calendarFilter.type !== 'all' && (
                 <div className="mt-3 text-sm text-gray-600">
                   Showing: {calendarFilter.type === 'activity' ? 'Activity' : 'Package'} - {calendarFilter.value}
                 </div>
               )}
             </div>
           )}
           
           {/* Table-based calendar */}
           <div className="overflow-x-auto rounded-lg border border-gray-200">
             <table className="w-full">
               <thead className="bg-gray-50">
                 <tr>
                   <th className="w-24 px-3 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider border-r border-gray-200">
                     Time
                   </th>
                   {weekDates.map((date, index) => (
                     <th key={index} className="px-3 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider border-r border-gray-200 last:border-r-0">
                       <div>{date.toLocaleDateString('en-US', { weekday: 'short' })}</div>
                       <div className="text-xs text-gray-400">{date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                     </th>
                   ))}
                 </tr>
               </thead>
               <tbody className="bg-white divide-y divide-gray-200">
                 {timeSlots.map((time, timeIndex) => (
                   <tr key={timeIndex} className="hover:bg-gray-50">
                     <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-gray-900 border-r border-gray-200">
                       {time}
                     </td>
                     {weekDates.map((date, dateIndex) => {
                       const dateStr = date.toDateString();
                       const bookingsForCell = groupedBookings[time]?.[dateStr] || [];
                       
                       return (
                         <td key={dateIndex} className="px-3 py-2 text-sm text-gray-700 border-r border-gray-200 last:border-r-0 align-top min-w-[180px]">
                           {bookingsForCell.length > 0 ? (
                             <div className="space-y-2">
                               {bookingsForCell.map((booking, bookingIndex) => (
                                 <div
                                   key={bookingIndex}
                                   className={`p-2 rounded border cursor-pointer ${
                                     booking.status === 'Confirmed'
                                       ? 'bg-emerald-50 border-emerald-200'
                                       : booking.status === 'Pending'
                                       ? 'bg-amber-50 border-amber-200'
                                       : 'bg-rose-50 border-rose-200'
                                   }`}
                                 >
                                   <div className="font-medium text-gray-900 text-xs">
                                     {booking.activity || booking.package}
                                   </div>
                                   <div className="text-xs text-gray-700 mt-1">
                                     {booking.customer}
                                   </div>
                                   <div className="text-xs text-gray-700">
                                     {booking.participants} participants
                                   </div>
                                 </div>
                               ))}
                             </div>
                           ) : (
                             <span className="text-gray-300">-</span>
                           )}
                         </td>
                       );
                     })}
                   </tr>
                 ))}
               </tbody>
             </table>
           </div>
         </div>

         {/* Rest of the component remains the same */}
         <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
           {/* Quick Actions */}
           <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex flex-col gap-4">
             <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
               <Zap className="w-5 h-5 text-blue-700" /> Quick Actions
             </h2>
             <div className="grid grid-cols-2 gap-3">
               {quickActions.map((action, index) => {
                 const Icon = action.icon;
                 return (
                   <button
                     key={index}
                     className={`flex flex-col items-center justify-center text-white py-4 px-2 rounded-xl font-semibold transition ${action.accent} hover:scale-[1.03] active:scale-95`}
                   >
                     <Icon size={22} />
                     <span className="text-xs mt-1 text-center">{action.title}</span>
                   </button>
                 );
               })}
             </div>
           </div>

           {/* Recent Activity */}
           <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm p-5">
             <div className="flex items-center justify-between mb-4">
               <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                 <Activity className="w-5 h-5 text-blue-700" /> Recent Activity
               </h2>
               <button className="text-sm text-blue-700 hover:text-blue-700 font-medium flex items-center gap-1">
                 <ChevronRight size={16} /> View all
               </button>
             </div>
            
             <div className="space-y-4">
               <div className="p-4 border border-gray-100 rounded-lg flex gap-4 items-center bg-gray-50">
                 <Star className="w-6 h-6 text-yellow-400" />
                 <div className="flex-1">
                   <h4 className="font-semibold text-gray-900 text-base">New Booking</h4>
                   <p className="text-sm text-gray-700">Laser Tag - Corporate Event</p>
                   <p className="text-xs text-gray-400 mt-1">Tech Solutions Inc.</p>
                 </div>
                 <div className="text-right min-w-[90px]">
                   <span className="text-xs text-gray-700">Today, 10:30 AM</span>
                   <span className="block text-xs font-semibold text-emerald-600 mt-1">Confirmed</span>
                 </div>
               </div>
              
               <div className="p-4 border border-gray-100 rounded-lg flex gap-4 items-center bg-gray-50">
                 <DollarSign className="w-6 h-6 text-green-700" />
                 <div className="flex-1">
                   <h4 className="font-semibold text-gray-900 text-base">Payment Received</h4>
                   <p className="text-sm text-gray-700">Birthday Package - $450</p>
                   <p className="text-xs text-gray-400 mt-1">Lisa Williams</p>
                 </div>
                 <div className="text-right min-w-[90px]">
                   <span className="text-xs text-gray-700">Today, 9:45 AM</span>
                   <span className="block text-xs font-semibold text-emerald-600 mt-1">Paid</span>
                 </div>
               </div>
              
               <div className="p-4 border border-gray-100 rounded-lg flex gap-4 items-center bg-gray-50">
                 <AlertTriangle className="w-6 h-6 text-amber-700" />
                 <div className="flex-1">
                   <h4 className="font-semibold text-gray-900 text-base">Booking Updated</h4>
                   <p className="text-sm text-gray-700">VR Experience - Time change</p>
                   <p className="text-xs text-gray-400 mt-1">Mike Thompson</p>
                 </div>
                 <div className="text-right min-w-[90px]">
                   <span className="text-xs text-gray-700">Today, 8:15 AM</span>
                   <span className="block text-xs font-semibold text-amber-600 mt-1">Pending</span>
                 </div>
               </div>
             </div>
           </div>
         </div>

         {/* Bookings Table */}
         <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
           <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
             <h2 className="text-lg font-semibold text-gray-900">Weekly Bookings</h2>
             <div className="flex flex-wrap gap-2 mt-4 md:mt-0">
               <div className="relative">
                 <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                 <input
                   type="text"
                   placeholder="Search bookings..."
                   className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                 />
               </div>
               <select 
                 value={selectedStatus}
                 onChange={(e) => setSelectedStatus(e.target.value)}
                 className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
               >
                 <option value="all">All Statuses</option>
                 <option value="Confirmed">Confirmed</option>
                 <option value="Pending">Pending</option>
                 <option value="Cancelled">Cancelled</option>
               </select>
               <button className="px-3 py-2 border border-gray-200 rounded-lg text-sm flex items-center">
                 <Filter size={16} className="mr-1" />
                 Filter
               </button>
             </div>
           </div>
          
           <div className="overflow-x-auto">
             <table className="w-full text-sm text-left">
               <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b">
                 <tr>
                   <th className="px-4 py-3 font-medium w-32">Date & Time</th>
                   <th className="px-4 py-3 font-medium w-48">Customer</th>
                   <th className="px-4 py-3 font-medium w-32">Activity</th>
                   <th className="px-4 py-3 font-medium w-40">Package</th>
                   <th className="px-4 py-3 font-medium w-20">Participants</th>
                   <th className="px-4 py-3 font-medium w-24">Status</th>
                   <th className="px-4 py-3 font-medium w-24">Payment</th>
                   <th className="px-4 py-3 font-medium w-28">Amount</th>
                   <th className="px-4 py-3 font-medium w-20">Actions</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-gray-100">
                 {filteredBookings.length > 0 ? filteredBookings.map(booking => (
                   <tr key={booking.id} className="hover:bg-gray-50">
                     <td className="px-4 py-3">
                       <div className="font-medium text-gray-900">
                         {booking.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                       </div>
                       <div className="text-xs text-gray-700">{booking.time}</div>
                     </td>
                     <td className="px-4 py-3">
                       <div>
                         <div className="font-medium text-gray-900">{booking.customer}</div>
                         <div className="text-xs text-gray-700">{booking.contact}</div>
                       </div>
                     </td>
                     <td className="px-4 py-3">
                       {booking.activity || <span className="text-gray-400">-</span>}
                     </td>
                     <td className="px-4 py-3">
                       {booking.package || <span className="text-gray-400">-</span>}
                     </td>
                     <td className="px-4 py-3">{booking.participants}</td>
                     <td className="px-4 py-3">
                       <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusColors[booking.status as keyof typeof statusColors]}`}>
                         {booking.status}
                       </span>
                     </td>
                     <td className="px-4 py-3">
                       <span className={`px-2 py-1 text-xs font-medium rounded-full ${paymentColors[booking.payment as keyof typeof paymentColors]}`}>
                         {booking.payment}
                       </span>
                     </td>
                     <td className="px-4 py-3 font-medium">{booking.amount}</td>
                     <td className="px-4 py-3">
                       <div className="flex space-x-2">
                         <button className="p-1 text-blue-700 hover:text-blue-700" title="Check-in">
                           <CheckCircle size={16} />
                         </button>
                         <button className="p-1 text-gray-600 hover:text-gray-700" title="Send reminder">
                           <Mail size={16} />
                         </button>
                       </div>
                     </td>
                   </tr>
                 )) : (
                   <tr>
                     <td colSpan={9} className="px-4 py-3 text-center text-gray-700">
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