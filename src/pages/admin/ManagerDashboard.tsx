import React, { useState } from 'react';
import {
  Calendar,
  Users,
  DollarSign,
  CheckCircle,
  ChevronRight,
  ChevronLeft,
  Plus,
  Search,
  Download,
  Mail,
  Zap,
  MapPin,
  TrendingUp,
  AlertCircle,
  Ticket
} from 'lucide-react';
import { Link } from 'react-router-dom';

const LocationManagerDashboard: React.FC = () => {
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [selectedStatus, setSelectedStatus] = useState('all');

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

  // Metrics data for Location Manager with customer focus
  const metrics = [
    {
      title: 'Total Customers',
      value: '542',
      change: '+15% from last week',
      trend: 'up',
      icon: Users,
      accent: 'bg-blue-100 text-blue-800',
    },
    {
      title: 'New Customers',
      value: '87',
      change: '23% conversion rate',
      trend: 'up',
      icon: TrendingUp,
      accent: 'bg-blue-100 text-blue-800',
    },
    {
      title: 'Revenue',
      value: '$12,845',
      change: '+8% from last week',
      trend: 'up',
      icon: DollarSign,
      accent: 'bg-blue-100 text-blue-800',
    },
    {
      title: 'Repeat Customers',
      value: '65%',
      change: 'High loyalty rate',
      trend: 'neutral',
      icon: Users,
      accent: 'bg-blue-100 text-blue-800',
    },
    {
      title: 'Customer Satisfaction',
      value: '4.8/5',
      change: 'Based on 142 reviews',
      trend: 'neutral',
      icon: AlertCircle,
      accent: 'bg-blue-100 text-blue-800',
    },
  ];

  // Sample data for the location
  const locationInfo = {
    name: 'Downtown Entertainment Center',
    address: '123 Main Street, Cityville',
    manager: 'Sarah Johnson',
    capacity: 200,
    operatingHours: '9:00 AM - 10:00 PM',
    contact: '(555) 123-4567'
  };

  // Bookings data
  const weeklyBookings = [
  { id: 1, date: new Date('2025-09-25'), time: '9:00 AM', duration: 2, package: 'Corporate Package', participants: 12, status: 'Confirmed', payment: 'Paid', customer: 'Tech Solutions Inc.', contact: 'John Smith', phone: '(555) 123-4567', email: 'john@techsolutions.com', amount: '$480', specialRequests: 'Team building event' },
  { id: 2, date: new Date('2025-09-25'), time: '9:00 AM', duration: 1.5, package: 'Adventure Package', participants: 6, status: 'Confirmed', payment: 'Paid', customer: 'Sarah Johnson', contact: 'Sarah Johnson', phone: '(555) 987-6543', email: 'sarahj@email.com', amount: '$180', specialRequests: 'Celebrating birthday' },
  { id: 3, date: new Date('2025-09-26'), time: '12:00 PM', duration: 2, package: 'Family Package', participants: 4, status: 'Pending', payment: 'Partial', customer: 'Mike Thompson', contact: 'Mike Thompson', phone: '(555) 456-7890', email: 'mike.t@email.com', amount: '$180', specialRequests: 'First time visitors' },
  { id: 4, date: new Date('2025-09-26'), time: '2:00 PM', duration: 3, package: 'Birthday Package', participants: 15, status: 'Confirmed', payment: 'Paid', customer: 'Lisa Williams', contact: 'Lisa Williams', phone: '(555) 234-5678', email: 'lisa.w@email.com', amount: '$450', specialRequests: 'Birthday cake will be brought in' },
  { id: 5, date: new Date('2025-09-27'), time: '4:30 PM', duration: 2, package: 'Group Package', participants: 8, status: 'Cancelled', payment: 'Refunded', customer: 'David Miller', contact: 'David Miller', phone: '(555) 876-5432', email: 'davidm@email.com', amount: '$200', specialRequests: 'Need two lanes' },
  { id: 6, date: new Date('2025-09-27'), time: '11:00 AM', duration: 1.5, package: 'Corporate Package', participants: 10, status: 'Confirmed', payment: 'Paid', customer: 'XYZ Corp', contact: 'Robert Brown', phone: '(555) 345-6789', email: 'rbrown@xyz.com', amount: '$500', specialRequests: 'Executive team' },
  { id: 7, date: new Date('2025-09-27'), time: '11:00 AM', duration: 2, package: 'Family Package', participants: 6, status: 'Confirmed', payment: 'Partial', customer: 'Jennifer Lee', contact: 'Jennifer Lee', phone: '(555) 765-4321', email: 'jennifer@email.com', amount: '$150', specialRequests: 'Family outing' },
  ];

  // Only show bookings for the current week in the calendar and table
  const bookingsThisWeek = weeklyBookings.filter(booking => {
    return weekDates.some(date => date.toDateString() === booking.date.toDateString());
  });

  // Customer statistics
  const customerStats = {
    total: 542,
    newThisWeek: 87,
    returning: 455, // total - newThisWeek
    satisfaction: 4.8, // out of 5
  };

  // Ticket purchases data
  const ticketPurchases = [
    { id: 1, customer: 'John Smith', attraction: 'Laser Tag', date: new Date('2025-09-16'), quantity: 3, amount: '$45', status: 'Completed', payment: 'Credit Card' },
    { id: 2, customer: 'Sarah Johnson', attraction: 'VR Experience', date: new Date('2025-09-17'), quantity: 2, amount: '$30', status: 'Completed', payment: 'PayPal' },
    { id: 3, customer: 'Mike Thompson', attraction: 'Bowling', date: new Date('2025-09-18'), quantity: 4, amount: '$60', status: 'Pending', payment: 'Credit Card' },
    { id: 4, customer: 'Lisa Williams', attraction: 'Arcade', date: new Date('2025-09-16'), quantity: 5, amount: '$75', status: 'Completed', payment: 'Cash' },
    { id: 5, customer: 'David Miller', attraction: 'Mini Golf', date: new Date('2025-09-17'), quantity: 2, amount: '$30', status: 'Cancelled', payment: 'Credit Card' },
    { id: 6, customer: 'Jennifer Lee', attraction: 'Escape Room', date: new Date('2025-09-19'), quantity: 6, amount: '$120', status: 'Completed', payment: 'Credit Card' },
  ];

  // Quick actions for Location Manager
  const quickActions = [
  { title: 'New Booking', icon: Plus, accent: 'bg-blue-800 hover:bg-blue-800' },
  { title: 'Check-in', icon: CheckCircle, accent: 'bg-blue-800 hover:bg-blue-800' },
  { title: 'Customer Insights', icon: Users, accent: 'bg-blue-800 hover:bg-blue-800' },
  { title: 'Generate Report', icon: Download, accent: 'bg-blue-800 hover:bg-blue-800' },
  { title: 'View Calendar', icon: Calendar, accent: 'bg-blue-800 hover:bg-blue-800' },
  { title: 'Manage Attendants', icon: Users, accent: 'bg-blue-800 hover:bg-blue-800' },
  ];

  // Status colors
  const statusColors = {
    Confirmed: 'bg-emerald-100 text-emerald-800',
    Pending: 'bg-blue-100 text-blue-800',
    Cancelled: 'bg-rose-100 text-rose-800',
    Completed: 'bg-emerald-100 text-emerald-800',
  };

  // Payment status colors
  const paymentColors = {
    Paid: 'bg-emerald-100 text-emerald-800',
    Partial: 'bg-blue-100 text-blue-800',
    Refunded: 'bg-rose-100 text-rose-800',
    'Credit Card': 'bg-blue-100 text-blue-800',
    PayPal: 'bg-blue-100 text-blue-800',
    Cash: 'bg-gray-100 text-gray-800',
  };

  // Filter bookings by status for the table
  const filteredBookings = selectedStatus === 'all' 
    ? bookingsThisWeek 
    : bookingsThisWeek.filter(booking => booking.status === selectedStatus);

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-2">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-1">
            Location Manager Dashboard
          </h1>
          <div className="flex items-center text-gray-600 mb-2">
            <MapPin className="h-4 w-4 mr-1" />
            <span>{locationInfo.name}</span>
          </div>
        </div>
        <button className="mt-4 md:mt-0 px-5 py-2.5 bg-blue-800 text-white rounded-xl flex items-center gap-2 hover:bg-blue-800 transition font-semibold shadow-sm">
          <Plus size={20} />
          <Link to="/bookings/create">New Booking</Link>
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
                <span className="text-base font-semibold text-gray-800">{metric.title}</span>
              </div>
              <div className="flex items-end gap-2 mt-2">
                <h3 className="text-2xl font-bold text-gray-900">{metric.value}</h3>
              </div>
              <p className="text-xs mt-1 text-gray-400">{metric.change}</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Location Info Card */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-blue-800" /> Location Details
          </h2>
          <div className="grid grid-cols-1 gap-4">
            <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
              <MapPin className="w-5 h-5 text-blue-800" />
              <div>
                <p className="text-xs font-semibold text-blue-800">Address</p>
                <p className="text-sm text-gray-900">{locationInfo.address}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
              <Calendar className="w-5 h-5 text-blue-800" />
              <div>
                <p className="text-xs font-semibold text-blue-800">Operating Hours</p>
                <p className="text-sm text-gray-900">{locationInfo.operatingHours}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
              <Users className="w-5 h-5 text-blue-800" />
              <div>
                <p className="text-xs font-semibold text-blue-800">Capacity</p>
                <p className="text-sm text-gray-900">{locationInfo.capacity} people</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
              <Mail className="w-5 h-5 text-blue-800" />
              <div>
                <p className="text-xs font-semibold text-blue-800">Contact</p>
                <p className="text-sm text-gray-900">{locationInfo.contact}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Customer Statistics */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-800" /> Customer Statistics
          </h2>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-blue-50 p-3 rounded-lg">
                <p className="text-xs text-blue-800">Total Customers</p>
                <p className="text-2xl font-bold text-blue-800">{customerStats.total}</p>
              </div>
              <div className="bg-blue-50 p-3 rounded-lg">
                <p className="text-xs text-blue-800">New This Week</p>
                <p className="text-2xl font-bold text-blue-800">+{customerStats.newThisWeek}</p>
              </div>
              <div className="bg-blue-50 p-3 rounded-lg col-span-2">
                <p className="text-xs text-blue-800">Returning Customers</p>
                <p className="text-2xl font-bold text-blue-800">{customerStats.returning}</p>
              </div>
              <div className="bg-blue-50 p-3 rounded-lg col-span-2">
                <p className="text-xs text-blue-800">Avg. Satisfaction</p>
                <p className="text-2xl font-bold text-blue-800">{customerStats.satisfaction}/5</p>
              </div>
            </div>
            
         
           
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex flex-col gap-4">
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Zap className="w-5 h-5 text-blue-800" /> Quick Actions
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
      </div>

      {/* Weekly Calendar */}
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-800" /> Weekly Calendar
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
            <button className="ml-2 px-3 py-2 text-sm bg-blue-100 text-blue-800 rounded-lg hover:bg-blue-200" onClick={() => setCurrentWeek(new Date())}>
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
              {/* Generate time slots from 8 AM to 8 PM */}
              {Array.from({ length: 13 }, (_, i) => {
                const hour = i + 8;
                const time = `${hour > 12 ? hour - 12 : hour}:00 ${hour >= 12 ? 'PM' : 'AM'}`;
                
                return (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-gray-900 border-r border-gray-200">
                      {time}
                    </td>
                    {weekDates.map((date, dateIndex) => {
                      const dateStr = date.toDateString();
                      const bookingsForCell = bookingsThisWeek.filter(
                        booking => 
                          booking.date.toDateString() === dateStr && 
                          booking.time.includes(time.split(':')[0])
                      );
                      
                      return (
                        <td key={dateIndex} className="px-3 py-2 text-sm text-gray-500 border-r border-gray-200 last:border-r-0 align-top min-w-[180px]">
                          {bookingsForCell.length > 0 ? (
                            <div className="space-y-2">
                              {bookingsForCell.map((booking, bookingIndex) => (
                                <div
                                  key={bookingIndex}
                                  className={`p-2 rounded border cursor-pointer ${
                                    booking.status === 'Confirmed'
                                      ? 'bg-emerald-50 border-emerald-200'
                                      : booking.status === 'Pending'
                                      ? 'bg-blue-50 border-blue-200'
                                      : 'bg-rose-50 border-rose-200'
                                  }`}
                                >
                                  <div className="font-medium text-gray-900 text-xs">
                                    {booking.package}
                                  </div>
                                  <div className="text-xs text-gray-500 mt-1">
                                    {booking.customer}
                                  </div>
                                  <div className="text-xs text-gray-500">
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
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Ticket Purchases Table */}
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Ticket className="w-5 h-5 text-blue-800" /> Recent Ticket Purchases
          </h2>
          <div className="flex flex-wrap gap-2 mt-4 md:mt-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="text"
                placeholder="Search purchases..."
                className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
          </div>
        </div>
      
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Attraction</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Quantity</th>
                <th className="px-4 py-3 font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Payment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {ticketPurchases.map(purchase => (
                <tr key={purchase.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{purchase.customer}</div>
                  </td>
                  <td className="px-4 py-3">
                    {purchase.attraction}
                  </td>
                  <td className="px-4 py-3">
                    {purchase.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </td>
                  <td className="px-4 py-3">{purchase.quantity}</td>
                  <td className="px-4 py-3 font-medium">{purchase.amount}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusColors[purchase.status as keyof typeof statusColors]}`}>
                      {purchase.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${paymentColors[purchase.payment as keyof typeof paymentColors]}`}>
                      {purchase.payment}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
                className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
            <select 
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              <option value="all">All Statuses</option>
              <option value="Confirmed">Confirmed</option>
              <option value="Pending">Pending</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>
        </div>
      
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
                    <div className="text-xs text-gray-500">{booking.time}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div>
                      <div className="font-medium text-gray-900">{booking.customer}</div>
                      <div className="text-xs text-gray-500">{booking.contact}</div>
                    </div>
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
                      <button className="p-1 text-blue-800 hover:text-blue-800" title="Check-in">
                        <CheckCircle size={16} />
                      </button>
                      <button className="p-1 text-gray-600 hover:text-gray-800" title="Send reminder">
                        <Mail size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={8} className="px-4 py-3 text-center text-gray-500">
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

export default LocationManagerDashboard;