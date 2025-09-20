import React, { useState } from 'react';
import {
  Calendar,
  DollarSign,
  ChevronRight,
  ChevronLeft,
  Plus,
  Search,
  Filter,
  Download,
  X,
  Activity,
  Star,
  MapPin,
  Users,
  BarChart3,
  Building,
  CreditCard,
  Eye,
  Edit,
  Trash2,
  TrendingUp,
  Target
} from 'lucide-react';
import { Link } from 'react-router-dom';

const CompanyDashboard: React.FC = () => {
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedLocation, setSelectedLocation] = useState('all');
  const [calendarFilter, setCalendarFilter] = useState({
    type: 'all',
    value: ''
  });
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const itemsPerPage = 10;

  // Sample locations
  const locations = [
    'Brighton', 'Canton', 'Lansing', 'Farmington', 'Taylor', 
    'Sterling Heights', 'Ann Arbor', 'Bowlero', 'EscapeRoomZone'
  ];

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

  // Metrics data - now includes location stats
  const metrics = [
    {
      title: 'Total Bookings',
      value: '1,248',
      change: '+18% from last month',
      trend: 'up',
      icon: Calendar,
      accent: 'bg-blue-100 text-blue-800',
    },
    {
      title: 'Active Locations',
      value: '9',
      change: 'All locations operational',
      trend: 'stable',
      icon: Building,
      accent: 'bg-blue-100 text-blue-800',
    },
    {
      title: 'Total Revenue',
      value: '$89,652',
      change: '+15% from last month',
      trend: 'up',
      icon: DollarSign,
      accent: 'bg-blue-100 text-blue-800',
    },
    {
      title: 'Participants',
      value: '3,842',
      change: '+12% from last month',
      trend: 'up',
      icon: Users,
      accent: 'bg-blue-100 text-blue-800',
    },
    {
      title: 'Avg. Booking Value',
      value: '$71.84',
      change: '+3% from last month',
      trend: 'up',
      icon: CreditCard,
      accent: 'bg-blue-100 text-blue-800',
    },
  ];

  // Bookings with location data
  const weeklyBookings = [
    { id: 1, date: new Date('2025-09-16'), time: '9:00 AM', duration: 2, activity: 'Laser Tag', package: null, participants: 12, status: 'Confirmed', payment: 'Paid', customer: 'Tech Solutions Inc.', contact: 'John Smith', phone: '(555) 123-4567', email: 'john@techsolutions.com', amount: '$480', location: 'Brighton', specialRequests: 'Team building event' },
    { id: 2, date: new Date('2025-09-17'), time: '10:30 AM', duration: 1.5, activity: null, package: 'Adventure Package', participants: 6, status: 'Confirmed', payment: 'Paid', customer: 'Sarah Johnson', contact: 'Sarah Johnson', phone: '(555) 987-6543', email: 'sarahj@email.com', amount: '$180', location: 'Canton', specialRequests: 'Celebrating birthday' },
    { id: 3, date: new Date('2025-09-18'), time: '12:00 PM', duration: 2, activity: 'Bowling', package: null, participants: 4, status: 'Pending', payment: 'Partial', customer: 'Mike Thompson', contact: 'Mike Thompson', phone: '(555) 456-7890', email: 'mike.t@email.com', amount: '$180', location: 'Lansing', specialRequests: 'First time visitors' },
    { id: 4, date: new Date('2025-09-16'), time: '2:00 PM', duration: 3, activity: null, package: 'Birthday Package', participants: 15, status: 'Confirmed', payment: 'Paid', customer: 'Lisa Williams', contact: 'Lisa Williams', phone: '(555) 234-5678', email: 'lisa.w@email.com', amount: '$450', location: 'Farmington', specialRequests: 'Birthday cake will be brought in' },
    { id: 5, date: new Date('2025-09-17'), time: '4:30 PM', duration: 2, activity: 'Bowling', package: null, participants: 8, status: 'Cancelled', payment: 'Refunded', customer: 'David Miller', contact: 'David Miller', phone: '(555) 876-5432', email: 'davidm@email.com', amount: '$200', location: 'Taylor', specialRequests: 'Need two lanes' },
    { id: 6, date: new Date('2025-09-20'), time: '11:00 AM', duration: 1.5, activity: null, package: 'Corporate Package', participants: 10, status: 'Confirmed', payment: 'Paid', customer: 'XYZ Corp', contact: 'Robert Brown', phone: '(555) 345-6789', email: 'rbrown@xyz.com', amount: '$500', location: 'Sterling Heights', specialRequests: 'Executive team' },
    { id: 7, date: new Date('2025-09-19'), time: '3:00 PM', duration: 2, activity: 'Arcade', package: null, participants: 6, status: 'Confirmed', payment: 'Partial', customer: 'Jennifer Lee', contact: 'Jennifer Lee', phone: '(555) 765-4321', email: 'jennifer@email.com', amount: '$150', location: 'Ann Arbor', specialRequests: 'Family outing' },
    { id: 8, date: new Date('2025-09-16'), time: '9:00 AM', duration: 1, activity: 'VR Experience', package: null, participants: 4, status: 'Confirmed', payment: 'Paid', customer: 'Innovate Tech', contact: 'Alex Johnson', phone: '(555) 111-2222', email: 'alex@innovatetech.com', amount: '$120', location: 'Bowlero', specialRequests: 'VR setup needed' },
    { id: 9, date: new Date('2025-09-17'), time: '10:30 AM', duration: 2, activity: 'Escape Room', package: null, participants: 8, status: 'Confirmed', payment: 'Paid', customer: 'Team Builders Co.', contact: 'Maria Garcia', phone: '(555) 333-4444', email: 'maria@teambuilders.com', amount: '$240', location: 'EescapeRoomZone', specialRequests: 'Beginner level room' },
    { id: 10, date: new Date('2025-09-18'), time: '1:00 PM', duration: 2, activity: 'Laser Tag', package: null, participants: 10, status: 'Confirmed', payment: 'Paid', customer: 'Marketing Pros', contact: 'Tom Wilson', phone: '(555) 555-6666', email: 'tom@marketingpros.com', amount: '$400', location: 'Brighton', specialRequests: 'Marketing team outing' },
    { id: 11, date: new Date('2025-09-19'), time: '5:00 PM', duration: 2, activity: 'Bowling', package: null, participants: 6, status: 'Confirmed', payment: 'Paid', customer: 'Family Smith', contact: 'Robert Smith', phone: '(555) 777-8888', email: 'rsmith@email.com', amount: '$150', location: 'Canton', specialRequests: 'Family night' },
    { id: 12, date: new Date('2025-09-20'), time: '2:30 PM', duration: 3, activity: null, package: 'Corporate Package', participants: 12, status: 'Confirmed', payment: 'Paid', customer: 'Finance Corp', contact: 'Susan Lee', phone: '(555) 999-0000', email: 'slee@financecorp.com', amount: '$800', location: 'Lansing', specialRequests: 'Board meeting follow-up' },
    { id: 13, date: new Date('2025-09-21'), time: '6:00 PM', duration: 2, activity: 'Laser Tag', package: null, participants: 8, status: 'Confirmed', payment: 'Paid', customer: 'Gaming Club', contact: 'Mark Taylor', phone: '(555) 123-7890', email: 'mark@gamingclub.com', amount: '$320', location: 'Brighton', specialRequests: 'Monthly tournament' },
    { id: 14, date: new Date('2025-09-22'), time: '1:30 PM', duration: 1.5, activity: 'Bowling', package: null, participants: 5, status: 'Pending', payment: 'Pending', customer: 'Sarah Wilson', contact: 'Sarah Wilson', phone: '(555) 456-1234', email: 'sarahw@email.com', amount: '$125', location: 'Taylor', specialRequests: 'Need bumpers for kids' },
    { id: 15, date: new Date('2025-09-23'), time: '3:30 PM', duration: 2, activity: 'Escape Room', package: null, participants: 6, status: 'Confirmed', payment: 'Paid', customer: 'Tech Team', contact: 'James Brown', phone: '(555) 789-4561', email: 'james@techteam.com', amount: '$180', location: 'EscapeRoomZone', specialRequests: 'Advanced level room' },
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
    { title: 'New Booking', icon: Plus, accent: 'bg-blue-500 hover:bg-blue-800' },
    { title: 'View Reports', icon: BarChart3, accent: 'bg-blue-500 hover:bg-blue-800' },
    { title: 'Manage Locations', icon: MapPin, accent: 'bg-blue-500 hover:bg-blue-800' },
    { title: 'Export Data', icon: Download, accent: 'bg-blue-500 hover:bg-blue-800' },
  ];

  // Status colors
  const statusColors = {
    Confirmed: 'bg-emerald-100 text-emerald-800',
    Pending: 'bg-amber-100 text-amber-800',
    Cancelled: 'bg-rose-100 text-rose-800',
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
    const statusMatch = selectedStatus === 'all' || booking.status === selectedStatus;
    const locationMatch = selectedLocation === 'all' || booking.location === selectedLocation;
    const searchMatch = searchQuery === '' || 
      booking.customer.toLowerCase().includes(searchQuery.toLowerCase()) ||
      booking.contact.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (booking.activity && booking.activity.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (booking.package && booking.package.toLowerCase().includes(searchQuery.toLowerCase()));
    
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

  // Get location stats
  const getLocationStats = () => {
    const stats: {[key: string]: {bookings: number, revenue: number, participants: number, utilization: number}} = {};
    
    locations.forEach(location => {
      stats[location] = { bookings: 0, revenue: 0, participants: 0, utilization: 0 };
    });
    
    bookingsThisWeek.forEach(booking => {
      if (stats[booking.location]) {
        stats[booking.location].bookings += 1;
        stats[booking.location].revenue += parseFloat(booking.amount.replace('$', ''));
        stats[booking.location].participants += booking.participants;
      }
    });

    // Calculate utilization (percentage of max capacity)
    Object.keys(stats).forEach(location => {
      const maxCapacity = 200; // Assuming each location has a max capacity of 200
      stats[location].utilization = Math.min(100, Math.round((stats[location].participants / maxCapacity) * 100));
    });
    
    return stats;
  };

  const locationStats = getLocationStats();

  // Get top performing locations
  const getTopLocations = () => {
    return Object.entries(locationStats)
      .sort(([, a], [, b]) => b.revenue - a.revenue)
      .slice(0, 3);
  };

  const topLocations = getTopLocations();

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
          <select 
            value={selectedLocation}
            onChange={(e) => {
              setSelectedLocation(e.target.value);
              setCurrentPage(1);
            }}
            className="px-3 py-2 md:px-4 md:py-2.5 border border-gray-200 rounded-lg md:rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            <option value="all">All Locations</option>
            {locations.map(location => (
              <option key={location} value={location}>{location}</option>
            ))}
          </select>
          <button className="px-3 py-2 md:px-5 md:py-2.5 bg-blue-800 text-white rounded-lg md:rounded-xl flex items-center gap-2 hover:bg-blue-800 transition font-semibold shadow-sm text-sm md:text-base">
            <Plus size={16} className="md:size-5" />
            <Link to="/bookings">New Booking</Link>
          </button>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {metrics.map((metric, index) => {
          const Icon = metric.icon;
          return (
            <div
              key={index}
              className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 md:p-5 flex flex-col gap-2 hover:shadow-md transition-shadow min-h-[100px] md:min-h-[120px]"
            >
              <div className="flex items-center gap-2">
                <div className={`p-2 rounded-lg ${metric.accent}`}><Icon size={18} className="md:size-5" /></div>
                <span className="text-sm md:text-base font-semibold text-gray-800">{metric.title}</span>
              </div>
              <div className="flex items-end gap-2 mt-2">
                <h3 className="text-xl md:text-2xl font-bold text-gray-900">{metric.value}</h3>
              </div>
              <p className="text-xs mt-1 text-gray-400">{metric.change}</p>
            </div>
          );
        })}
      </div>

      {/* Location Performance - Redesigned */}
      <div className="bg-white rounded-xl shadow-sm p-4 md:p-6 border border-gray-100">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4 md:mb-6">
          <h2 className="text-lg md:text-xl font-bold text-gray-900 flex items-center gap-2">
            <Target className="w-5 h-5 md:w-6 md:h-6 text-blue-800" /> Location Performance
          </h2>
          <div className="flex items-center gap-2 mt-2 md:mt-0">
            <span className="text-sm text-gray-500">Week of {weekDates[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
          </div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Performing Locations */}
          <div>
            <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-green-600" /> Top Performing Locations
            </h3>
            <div className="space-y-4">
              {topLocations.map(([location, stats], index) => (
                <div key={location} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${
                      index === 0 ? 'bg-gradient-to-r from-yellow-400 to-yellow-500' :
                      index === 1 ? 'bg-gradient-to-r from-gray-400 to-gray-500' :
                      'bg-gradient-to-r from-amber-600 to-amber-700'
                    }`}>
                      {index + 1}
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">{location}</div>
                      <div className="text-sm text-gray-500">{stats.bookings} bookings</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-gray-900">${stats.revenue}</div>
                    <div className="text-sm text-green-600">{stats.utilization}% utilization</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Location Metrics Grid */}
          <div>
            <h3 className="font-semibold text-gray-800 mb-4">All Locations Overview</h3>
            <div className="grid grid-cols-2 gap-4">
              {Object.entries(locationStats).map(([location, stats]) => (
                <div key={location} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-gray-900 text-sm">{location}</span>
                    <div className={`w-3 h-3 rounded-full ${
                      stats.utilization >= 80 ? 'bg-green-500' :
                      stats.utilization >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                    }`} title={`${stats.utilization}% utilization`}></div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <div className="text-lg font-bold text-blue-800">{stats.bookings}</div>
                      <div className="text-xs text-gray-500">Bookings</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-blue-800">${stats.revenue}</div>
                      <div className="text-xs text-gray-500">Revenue</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-blue-800">{stats.participants}</div>
                      <div className="text-xs text-gray-500">Guests</div>
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                      <span>Capacity Utilization</span>
                      <span>{stats.utilization}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full ${
                          stats.utilization >= 80 ? 'bg-green-500' :
                          stats.utilization >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${stats.utilization}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Weekly Calendar */}
      <div className="bg-white rounded-xl shadow-sm p-4 md:p-6 border border-gray-100">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4 md:mb-6">
          <h2 className="text-xl md:text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Calendar className="w-5 h-5 md:w-6 md:h-6 text-blue-800" /> Weekly Calendar
          </h2>
          <div className="flex items-center space-x-2 mt-4 md:mt-0">
            <button 
              onClick={goToPreviousWeek}
              className="p-2 rounded-lg border border-gray-200 hover:bg-gray-100"
            >
              <ChevronLeft size={16} className="md:size-5" />
            </button>
            <span className="text-sm font-medium text-gray-800">
              {weekDates[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - 
              {weekDates[6].toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </span>
            <button 
              onClick={goToNextWeek}
              className="p-2 rounded-lg border border-gray-200 hover:bg-gray-100"
            >
              <ChevronRight size={16} className="md:size-5" />
            </button>
            <button className="ml-2 px-3 py-2 text-sm bg-blue-100 text-blue-800 rounded-lg hover:bg-blue-200" onClick={() => setCurrentWeek(new Date())}>
              Today
            </button>
            
            {/* Calendar Filter Toggle */}
            <button 
              onClick={() => setShowFilterPanel(!showFilterPanel)}
              className={`ml-2 px-3 py-2 text-sm rounded-lg flex items-center ${
                calendarFilter.type !== 'all' 
                  ? 'bg-blue-100 text-blue-800 border border-blue-300' 
                  : 'bg-gray-100 text-gray-800 border border-gray-200'
              }`}
            >
              <Filter size={16} className="mr-1" />
              Filter
              {calendarFilter.type !== 'all' && (
                <span className="ml-1 bg-blue-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-xs">
                  !
                </span>
              )}
            </button>
          </div>
        </div>
        
        {/* Filter Panel */}
        {showFilterPanel && (
          <div className="mb-4 md:mb-6 p-3 md:p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-medium text-gray-800 text-sm md:text-base">Filter Calendar</h3>
              <button 
                onClick={() => setShowFilterPanel(false)}
                className="text-gray-500 hover:text-gray-800"
              >
                <X size={16} className="md:size-5" />
              </button>
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
              
              {calendarFilter.type !== 'all' && (
                <button
                  onClick={clearCalendarFilter}
                  className="ml-auto text-sm text-blue-800 hover:text-blue-800 flex items-center"
                >
                  <X size={14} className="mr-1" />
                  Clear Filter
                </button>
              )}
            </div>
            
            {calendarFilter.type !== 'all' && (
              <div className="mt-3 text-sm text-gray-800">
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
              {timeSlots.map((time, timeIndex) => (
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
                          <div className="space-y-1 md:space-y-2">
                            {bookingsForCell.map((booking, bookingIndex) => (
                              <div
                                key={bookingIndex}
                                className={`p-1 md:p-2 rounded border cursor-pointer ${
                                  booking.status === 'Confirmed'
                                    ? 'bg-emerald-50 border-emerald-200'
                                    : booking.status === 'Pending'
                                    ? 'bg-amber-50 border-amber-200'
                                    : 'bg-rose-50 border-rose-200'
                                }`}
                                title={`${booking.activity || booking.package} - ${booking.customer} (${booking.location})`}
                              >
                                <div className="font-medium text-gray-900 text-xs">
                                  {booking.activity || booking.package}
                                </div>
                                <div className="text-xs text-gray-500 mt-1">
                                  {booking.customer}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {booking.location} • {booking.participants} participants
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        {/* Quick Actions */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 md:p-5 flex flex-col gap-3 md:gap-4">
          <h2 className="text-lg md:text-xl font-bold text-gray-900 mb-2 md:mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-800" /> Quick Actions
          </h2>
          <div className="grid grid-cols-2 gap-2 md:gap-3">
            {quickActions.map((action, index) => {
              const Icon = action.icon;
              return (
                <button
                  key={index}
                  className={`flex flex-col items-center justify-center text-white py-3 md:py-4 px-2 rounded-lg md:rounded-xl font-semibold transition ${action.accent} hover:scale-[1.03] active:scale-95 text-xs md:text-sm`}
                >
                  <Icon size={18} className="md:size-5" />
                  <span className="mt-1 text-center">{action.title}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm p-4 md:p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg md:text-xl font-bold text-gray-900 flex items-center gap-2">
              <Star className="w-5 h-5 text-blue-800" /> Recent Activity
            </h2>
            <button className="text-sm text-blue-800 hover:text-blue-800 font-medium flex items-center gap-1">
              <ChevronRight size={16} /> View all
            </button>
          </div>
        
          <div className="space-y-3 md:space-y-4">
            <div className="p-3 md:p-4 border border-gray-100 rounded-lg flex gap-3 md:gap-4 items-center bg-gray-50">
              <Star className="w-5 h-5 md:w-6 md:h-6 text-yellow-400" />
              <div className="flex-1">
                <h4 className="font-semibold text-gray-900 text-sm md:text-base">New Booking</h4>
                <p className="text-xs md:text-sm text-gray-500">Laser Tag - Corporate Event</p>
                <p className="text-xs text-gray-400 mt-1">Tech Solutions Inc. • Brighton</p>
              </div>
              <div className="text-right min-w-[70px] md:min-w-[90px]">
                <span className="text-xs text-gray-500">Today, 10:30 AM</span>
                <span className="block text-xs font-semibold text-emerald-800 mt-1">Confirmed</span>
              </div>
            </div>
          
            <div className="p-3 md:p-4 border border-gray-100 rounded-lg flex gap-3 md:gap-4 items-center bg-gray-50">
              <DollarSign className="w-5 h-5 md:w-6 md:h-6 text-blue-500" />
              <div className="flex-1">
                <h4 className="font-semibold text-gray-900 text-sm md:text-base">Payment Received</h4>
                <p className="text-xs md:text-sm text-gray-500">Birthday Package - $450</p>
                <p className="text-xs text-gray-400 mt-1">Lisa Williams • Farmington</p>
              </div>
              <div className="text-right min-w-[70px] md:min-w-[90px]">
                <span className="text-xs text-gray-500">Today, 9:45 AM</span>
                <span className="block text-xs font-semibold text-emerald-800 mt-1">Paid</span>
              </div>
            </div>
          
            <div className="p-3 md:p-4 border border-gray-100 rounded-lg flex gap-3 md:gap-4 items-center bg-gray-50">
              <MapPin className="w-5 h-5 md:w-6 md:h-6 text-blue-500" />
              <div className="flex-1">
                <h4 className="font-semibold text-gray-900 text-sm md:text-base">Location Update</h4>
                <p className="text-xs md:text-sm text-gray-500">New Package Created</p>
                <p className="text-xs text-gray-400 mt-1">Ann Arbor location</p>
              </div>
              <div className="text-right min-w-[70px] md:min-w-[90px]">
                <span className="text-xs text-gray-500">Today, 8:15 AM</span>
                <span className="block text-xs font-semibold text-blue-800 mt-1">Completed</span>
              </div>
            </div>
          </div>
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
                className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 w-full md:w-auto"
              />
            </div>
            <select 
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              <option value="all">All Statuses</option>
              <option value="Confirmed">Confirmed</option>
              <option value="Pending">Pending</option>
              <option value="Cancelled">Cancelled</option>
            </select>
            <select 
              value={selectedLocation}
              onChange={(e) => {
                setSelectedLocation(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              <option value="all">All Locations</option>
              {locations.map(location => (
                <option key={location} value={location}>{location}</option>
              ))}
            </select>
            <button className="px-3 py-2 border border-gray-200 rounded-lg text-sm flex items-center">
              <Filter size={16} className="mr-1" />
              Filter
            </button>
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
                <th className="px-3 md:px-4 py-2 md:py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {currentBookings.length > 0 ? currentBookings.map(booking => (
                <tr key={booking.id} className="hover:bg-gray-50">
                  <td className="px-3 md:px-4 py-2 md:py-3">
                    <div className="font-medium text-gray-900 text-xs md:text-sm">
                      {booking.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </div>
                    <div className="text-xs text-gray-500">{booking.time}</div>
                  </td>
                  <td className="px-3 md:px-4 py-2 md:py-3">
                    <div>
                      <div className="font-medium text-gray-900 text-xs md:text-sm">{booking.customer}</div>
                      <div className="text-xs text-gray-500">{booking.contact}</div>
                    </div>
                  </td>
                  <td className="px-3 md:px-4 py-2 md:py-3">
                    <div className="text-xs md:text-sm">
                      {booking.activity || booking.package || <span className="text-gray-400">-</span>}
                    </div>
                  </td>
                  <td className="px-3 md:px-4 py-2 md:py-3">
                    <span className="text-xs md:text-sm">{booking.location}</span>
                  </td>
                  <td className="px-3 md:px-4 py-2 md:py-3">
                    <span className="text-xs md:text-sm">{booking.participants}</span>
                  </td>
                  <td className="px-3 md:px-4 py-2 md:py-3">
                    <span className={`text-xs px-2 py-1 rounded-full ${statusColors[booking.status as keyof typeof statusColors]}`}>
                      {booking.status}
                    </span>
                  </td>
                  <td className="px-3 md:px-4 py-2 md:py-3">
                    <span className={`text-xs px-2 py-1 rounded-full ${paymentColors[booking.payment as keyof typeof paymentColors]}`}>
                      {booking.payment}
                    </span>
                  </td>
                  <td className="px-3 md:px-4 py-2 md:py-3">
                    <span className="font-medium text-xs md:text-sm">{booking.amount}</span>
                  </td>
                  <td className="px-3 md:px-4 py-2 md:py-3">
                    <div className="flex space-x-2">
                      <button className="text-blue-800 hover:text-blue-800">
                        <Eye size={16} />
                      </button>
                      <button className="text-blue-800 hover:text-blue-800">
                        <Edit size={16} />
                      </button>
                      <button className="text-red-800 hover:text-red-800">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              )) : (
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
              <button
                onClick={prevPage}
                disabled={currentPage === 1}
                className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
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
                  <button
                    key={pageNum}
                    onClick={() => paginate(pageNum)}
                    className={`px-3 py-1 border rounded-md text-sm ${
                      currentPage === pageNum
                        ? 'bg-blue-800 text-white border-blue-800'
                        : 'border-gray-300'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
              <button
                onClick={nextPage}
                disabled={currentPage === totalPages}
                className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CompanyDashboard;