// src/pages/admin/bookings/CalendarView.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon,
  Filter,
  Search,
  X,
  Clock,
  Users,
  CreditCard,
  PackageIcon,
  RefreshCw,
  MapPin
} from 'lucide-react';
import { useThemeColor } from '../../../hooks/useThemeColor';
import bookingService from '../../../services/bookingService';
import { locationService } from '../../../services/LocationService';
import type { Booking } from '../../../services/bookingService';
import type { CalendarViewFilterOptions } from '../../../types/calendarView.types';
import Toast from '../../../components/ui/Toast';
import type { ToastMessage } from './../../../types/Toast';
import { getStoredUser } from '../../../utils/storage';


interface UserData {
  name: string;
  company: string;
  subcompany?: string;
  position: string;
  role: 'attendant' | 'location_manager' | 'company_admin';
}

const CalendarView: React.FC = () => {
  const { themeColor, fullColor } = useThemeColor();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [filteredBookings, setFilteredBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [filters, setFilters] = useState<CalendarViewFilterOptions>({
    view: 'month',
    packages: [],
    dateRange: {
      start: '',
      end: ''
    },
    search: ''
  });
  const [showFilters, setShowFilters] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [filterLocation, setFilterLocation] = useState<string>('all');
  const [locations, setLocations] = useState<Array<{ id: number; name: string }>>([]);

  // Load user data from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('zapzone_user');
    if (stored) {
      setUserData(JSON.parse(stored));
    }
  }, []);
  
  // Fetch locations for company_admin
  useEffect(() => {
    const fetchLocations = async () => {
      if (userData?.role === 'company_admin') {
        try {
          const response = await locationService.getLocations();
          if (response.success && response.data) {
            setLocations(response.data.locations);
          }
        } catch (error) {
          console.error('Error fetching locations:', error);
        }
      }
    };
    fetchLocations();
  }, [userData]);

  // Load bookings from API
  const loadBookings = useCallback(async () => {
    try {
      setLoading(true);
      
      // Calculate date range based on current view
      const startDate = new Date(currentDate);
      let endDate = new Date(currentDate);

      if (filters.view === 'day') {
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
      } else if (filters.view === 'week') {
        const day = startDate.getDay();
        const diff = startDate.getDate() - day + (day === 0 ? -6 : 1);
        startDate.setDate(diff);
        startDate.setHours(0, 0, 0, 0);
        
        endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 6);
        endDate.setHours(23, 59, 59, 999);
      } else if (filters.view === 'month') {
        startDate.setDate(1);
        startDate.setHours(0, 0, 0, 0);
        
        endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);
        endDate.setHours(23, 59, 59, 999);
      } else if (filters.view === 'range' && filters.dateRange.start && filters.dateRange.end) {
        // Use custom range
        const response = await bookingService.getBookings({
          date_from: filters.dateRange.start,
          date_to: filters.dateRange.end,
          per_page: 1000,
        });
        
        if (response.success && response.data) {
          setBookings(response.data.bookings);
        }
        return;
      }

      const response = await bookingService.getBookings({
        date_from: startDate.toISOString().split('T')[0],
        date_to: endDate.toISOString().split('T')[0],
        per_page: 1000,
        user_id: getStoredUser()?.id,
      });
      
      if (response.success && response.data) {
        console.log('Loaded Bookings:', response.data.bookings);
        console.log('Date range:', startDate.toISOString().split('T')[0], 'to', endDate.toISOString().split('T')[0]);
        console.log('Total bookings loaded:', response.data.bookings.length);
        setBookings(response.data.bookings);
      } else {
        console.log('No bookings data in response');
        setBookings([]);
      }
    } catch (error) {
      console.error('Error loading bookings:', error);
      setToast({ message: 'Failed to load bookings', type: 'error' });
      setBookings([]);
    } finally {
      setLoading(false);
    }
  }, [currentDate, filters.view, filters.dateRange]);

  useEffect(() => {
    loadBookings();
  }, [loadBookings]);

  // Apply filters when bookings or filters change
  useEffect(() => {
    let result = [...bookings];

    // Filter by location (for company-admin users)
    if (filterLocation !== 'all') {
      const locationId = parseInt(filterLocation);
      result = result.filter(booking => booking.location_id === locationId);
    }

    // Apply search filter
    if (filters.search) {
      const searchTerm = filters.search.toLowerCase();
      result = result.filter(booking =>
        (booking.guest_name?.toLowerCase().includes(searchTerm) ||
        booking.guest_email?.toLowerCase().includes(searchTerm) ||
        booking.guest_phone?.includes(searchTerm) ||
        booking.reference_number.toLowerCase().includes(searchTerm) ||
        booking.package?.name?.toLowerCase().includes(searchTerm))
      );
    }

    // Apply packages filter
    if (filters.packages.length > 0) {
      result = result.filter(booking => 
        booking.package?.name && filters.packages.includes(booking.package.name)
      );
    }

    setFilteredBookings(result);
    console.log('Filtered bookings:', result.length, 'of', bookings.length);
  }, [bookings, filters.search, filters.packages, filterLocation]);

  const handleFilterChange = (key: keyof CalendarViewFilterOptions, value: string | string[]) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleDateRangeChange = (key: 'start' | 'end', value: string) => {
    setFilters(prev => ({
      ...prev,
      dateRange: {
        ...prev.dateRange,
        [key]: value
      }
    }));
  };

  const handlePackageToggle = (packageName: string) => {
    setFilters(prev => {
      const packages = prev.packages.includes(packageName)
        ? prev.packages.filter(p => p !== packageName)
        : [...prev.packages, packageName];
      
      return { ...prev, packages };
    });
  };

  const clearFilters = () => {
    setFilters({
      view: 'month',
      packages: [],
      dateRange: {
        start: '',
        end: ''
      },
      search: ''
    });
    setFilterLocation('all');
  };

  const navigateDate = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    
    if (filters.view === 'day') {
      newDate.setDate(newDate.getDate() + (direction === 'next' ? 1 : -1));
    } else if (filters.view === 'week') {
      newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7));
    } else if (filters.view === 'month') {
      newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1));
    }
    
    setCurrentDate(newDate);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const getHeaderText = () => {
    if (filters.view === 'day') {
      return currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    } else if (filters.view === 'week') {
      const startDate = new Date(currentDate);
      const day = startDate.getDay();
      const diff = startDate.getDate() - day + (day === 0 ? -6 : 1);
      startDate.setDate(diff);
      
      const endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 6);
      
      return `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    } else if (filters.view === 'month') {
      return currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    } else if (filters.view === 'range') {
      if (filters.dateRange.start && filters.dateRange.end) {
        const start = new Date(filters.dateRange.start);
        const end = new Date(filters.dateRange.end);
        return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
      }
      return 'Select Date Range';
    }
  };

  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (year: number, month: number) => {
    return new Date(year, month, 1).getDay();
  };

  const getWeekDays = () => {
    const startDate = new Date(currentDate);
    const day = startDate.getDay();
    const diff = startDate.getDate() - day + (day === 0 ? -6 : 1);
    startDate.setDate(diff);
    
    const weekDays = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      weekDays.push(date);
    }
    
    return weekDays;
  };

  const getBookingsForDate = (date: Date) => {
    // Use local date string to avoid timezone issues
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateString = `${year}-${month}-${day}`;
    
    const bookingsForDate = filteredBookings.filter(booking => {
      // Extract date part from booking_date (handles both "2025-11-29" and "2025-11-29T00:00:00.000000Z" formats)
      const bookingDatePart = booking.booking_date.split('T')[0];
      return bookingDatePart === dateString;
    });
    console.log(`Bookings for ${dateString}:`, bookingsForDate.length, bookingsForDate.map(b => ({ ref: b.reference_number, date: b.booking_date })));
    return bookingsForDate;
  };

  const getUniquePackages = () => {
    const packages = bookings
      .map(booking => booking.package?.name)
      .filter((pkg): pkg is string => !!pkg);
    
    return [...new Set(packages)];
  };

  // Get unique locations for filtering (for company-admin)
  // Use fetched locations instead of extracting from bookings
  const getUniqueLocations = () => {
    return locations;
  };

  const isCompanyAdmin = userData?.role === 'company_admin';

  const getBookingTitle = (booking: Booking) => {
    return booking.package?.name || 'Package Booking';
  };

  const getBookingColor = () => {
    return `bg-${themeColor}-100 text-${fullColor}`;
  };

  const renderDayView = () => {
    const dayBookings = getBookingsForDate(currentDate);
    return (
      <div className="bg-white rounded-lg shadow-sm p-6 h-full overflow-y-auto">
        <h3 className="text-lg font-semibold mb-4">
          Bookings for {currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </h3>
        {dayBookings.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            No bookings for this day
          </div>
        ) : (
          <div className="space-y-4">
            {dayBookings.map(booking => (
              <div key={booking.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer" onClick={() => setSelectedBooking(booking)}>
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-medium text-gray-900">{booking.guest_name || 'Guest'}</h4>
                    <p className="text-sm text-gray-500">{getBookingTitle(booking)}</p>
                    <p className="text-sm text-gray-500">{booking.booking_time}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      booking.status === 'confirmed' ? 'bg-green-100 text-green-800' :
                      booking.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                      booking.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                      booking.status === 'checked-in' ? `bg-${themeColor}-100 text-${fullColor}` :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {booking.status}
                    </span>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getBookingColor()}`}>
                      Package
                    </span>
                  </div>
                </div>
                <div className="mt-2 text-sm space-y-1">
                  <p>Participants: {booking.participants}</p>
                  {booking.location ? (
                    <p className="flex items-center text-gray-600">
                      <MapPin className="h-3 w-3 mr-1" />
                      {String((booking.location as { name?: string }).name || 'N/A')}
                    </p>
                  ) : null}
                  <p>Ref: #{booking.reference_number}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderWeekView = () => {
    const weekDays = getWeekDays();
    return (
      <div className="bg-white rounded-lg shadow-sm p-6 h-full overflow-y-auto">
        <div className="grid grid-cols-7 gap-2 mb-4">
          {weekDays.map(day => (
            <div key={day.toISOString()} className="text-center font-medium text-gray-800 py-2">
              {day.toLocaleDateString('en-US', { weekday: 'short' })}
              <div className="text-sm text-gray-500 mt-1">{day.getDate()}</div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-2">
          {weekDays.map(day => {
            const dayBookings = getBookingsForDate(day);
            return (
              <div 
                key={day.toISOString()} 
                className={`border border-gray-200 rounded-lg p-3 min-h-40 ${
                  day.toDateString() === new Date().toDateString() ? `bg-${themeColor}-50` : ''
                }`}
              >
                <div className="text-sm font-medium mb-2">
                  {day.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </div>
                {dayBookings.map(booking => (
                  <div 
                    key={booking.id} 
                    className={`text-xs rounded p-2 mb-2 cursor-pointer ${getBookingColor()}`}
                    title={`${booking.guest_name || 'Guest'} - ${booking.booking_time}`}
                    onClick={() => setSelectedBooking(booking)}
                  >
                    <div className="font-medium truncate">{booking.booking_time} - {booking.guest_name || 'Guest'}</div>
                    <div className="truncate">{getBookingTitle(booking)}</div>
                  </div>
                ))}
               
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderMonthView = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDayOfMonth = getFirstDayOfMonth(year, month);
    
    const days = [];
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < firstDayOfMonth; i++) {
      days.push(null);
    }
    
    // Add cells for each day of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      days.push(date);
    }
    
    return (
      <div className="bg-white rounded-lg shadow-sm p-6 h-full overflow-y-auto">
        <div className="grid grid-cols-7 gap-2 mb-4">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="text-center font-medium text-gray-800 py-2">
              {day}
            </div>
          ))}
        </div>
        
        <div className="grid grid-cols-7 gap-2">
          {days.map((day, index) => {
            if (!day) {
              return <div key={`empty-${index}`} className="border border-gray-100 rounded-lg p-2 h-32" />;
            }
            
            const dayBookings = getBookingsForDate(day);
            
            return (
              <div 
                key={day.toISOString()} 
                className={`border border-gray-200 rounded-lg p-3 h-32 overflow-y-auto ${
                  day.toDateString() === new Date().toDateString() ? `bg-${themeColor}-50` : ''
                }`}
                onClick={() => setSelectedDate(day.toISOString().split('T')[0])}
              >
                <div className="text-sm font-medium mb-2 sticky top-0">
                  {day.getDate()}
                </div>
                
                {dayBookings.map(booking => (
                  <div 
                    key={booking.id} 
                    className={`text-xs rounded p-2 mb-2 cursor-pointer ${getBookingColor()}`}
                    title={`${booking.guest_name || 'Guest'} - ${booking.booking_time}`}
                    onClick={e => {
                      e.stopPropagation();
                      setSelectedBooking(booking);
                    }}
                  >
                    <div className="font-medium truncate">{booking.booking_time} - {booking.guest_name || 'Guest'}</div>
                    <div className="truncate">{getBookingTitle(booking)}</div>
                  </div>
                ))}
                
                {/* {dayBookings.length > 2 && (
                  <div className="text-xs text-gray-500 text-center">
                    +{dayBookings.length - 2} more
                  </div>
                )} */}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderRangeView = () => {
    if (!filters.dateRange.start || !filters.dateRange.end) {
      return (
        <div className="bg-white rounded-lg shadow-sm p-8 text-center">
          <CalendarIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-4 text-lg font-medium text-gray-900">Select a date range</h3>
          <p className="mt-2 text-gray-500">Choose a start and end date to view bookings in that range.</p>
        </div>
      );
    }
    
    const start = new Date(filters.dateRange.start);
    const end = new Date(filters.dateRange.end);
    const rangeBookings = filteredBookings;
    
    return (
      <div className="bg-white rounded-lg shadow-sm p-6 h-full overflow-y-auto">
        <h3 className="text-lg font-semibold mb-4">
          Bookings from {start.toLocaleDateString()} to {end.toLocaleDateString()}
        </h3>
        
        {rangeBookings.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            No bookings in this date range
          </div>
        ) : (
          <div className="space-y-4">
            {rangeBookings.map(booking => (
              <div key={booking.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer" onClick={() => setSelectedBooking(booking)}>
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-medium text-gray-900">{booking.guest_name || 'Guest'}</h4>
                    <p className="text-sm text-gray-500">{getBookingTitle(booking)}</p>
                    <p className="text-sm text-gray-500">
                      {new Date(booking.booking_date).toLocaleDateString()} at {booking.booking_time}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      booking.status === 'confirmed' ? 'bg-green-100 text-green-800' :
                      booking.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                      booking.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                      booking.status === 'checked-in' ? 'bg-blue-100 text-blue-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {booking.status}
                    </span>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getBookingColor()}`}>
                      Package
                    </span>
                  </div>
                </div>
                <div className="mt-2 text-sm space-y-1">
                  <p>Participants: {booking.participants}</p>
                  {booking.location ? (
                    <p className="flex items-center text-gray-600">
                      <MapPin className="h-3 w-3 mr-1" />
                      {String((booking.location as { name?: string }).name || 'N/A')}
                    </p>
                  ) : null}
                  <p>Ref: #{booking.reference_number}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderView = () => {
    switch (filters.view) {
      case 'day':
        return renderDayView();
      case 'week':
        return renderWeekView();
      case 'month':
        return renderMonthView();
      case 'range':
        return renderRangeView();
      default:
        return renderMonthView();
    }
  };

  if (loading) {
    return (
      <div className="px-6 py-8">
        <div className="flex justify-center items-center h-64">
          <div className={`animate-spin rounded-full h-12 w-12 border-b-2 border-${fullColor}`}></div>
        </div>
      </div>
    );
  }

  return (
      <div className="px-6 py-8 h-full flex flex-col">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Booking Calendar</h1>
            <p className="text-gray-600 mt-2">
              View and manage bookings
              {filteredBookings.length > 0 && (
                <span className={`ml-2 px-2 py-1 text-xs font-medium rounded-full bg-${themeColor}-100 text-${fullColor}`}>
                  {filteredBookings.length} booking{filteredBookings.length !== 1 ? 's' : ''} found
                </span>
              )}
            </p>
          </div>
          <div className="flex gap-2 mt-4 sm:mt-0">
            <button
              onClick={loadBookings}
              disabled={loading}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-gray-800 hover:bg-gray-50 disabled:opacity-50"
              title="Refresh bookings"
            >
              <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <Link
              to="/bookings"
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-gray-800 hover:bg-gray-50"
            >
              List View
            </Link>
            <Link
              to="/packages"
              className={`inline-flex items-center px-4 py-2 bg-${fullColor} text-white rounded-lg hover:bg-${themeColor}-900`}
            >
              <PackageIcon className="h-5 w-5 mr-2" />
              Packages
            </Link>
          </div>
        </div>

        {/* Calendar Controls */}
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 mb-6">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigateDate('prev')}
                className="p-2 rounded-lg hover:bg-gray-100"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              
              <h2 className="text-xl font-semibold min-w-[250px] text-center">
                {getHeaderText()}
              </h2>
              
              <button
                onClick={() => navigateDate('next')}
                className="p-2 rounded-lg hover:bg-gray-100"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
              
              <button
                onClick={goToToday}
                className="ml-2 px-3 py-1 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
              >
                Today
              </button>
            </div>
            
            <div className="flex gap-2">
              <select
                value={filters.view}
                onChange={(e) => handleFilterChange('view', e.target.value as 'day' | 'week' | 'month' | 'range')}
                className={`border border-gray-300 rounded-lg px-3 py-1 text-sm focus:ring-2 focus:ring-${fullColor}`}
              >
                <option value="day">Day</option>
                <option value="week">Week</option>
                <option value="month">Month</option>
                <option value="range">Date Range</option>
              </select>
              
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center px-3 py-1 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
              >
                <Filter className="h-4 w-4 mr-1" />
                Filters
              </button>
            </div>
          </div>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 mb-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-medium text-lg">Filter Bookings</h3>
              <button
                onClick={() => setShowFilters(false)}
                className="text-gray-500 hover:text-gray-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Location Filter (Company Admin only) */}
              {isCompanyAdmin && getUniqueLocations().length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-800 mb-2">
                    <MapPin className="h-4 w-4 inline mr-1" />
                    Location
                  </label>
                  <select
                    value={filterLocation}
                    onChange={(e) => setFilterLocation(e.target.value)}
                    className={`w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-${fullColor}`}
                  >
                    <option value="all">All Locations</option>
                    {getUniqueLocations().map((location) => (
                      <option key={location.id} value={location.id}>
                        {location.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Search */}
              <div>
                <label className="block text-sm font-medium text-gray-800 mb-2">Search</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-4 w-4 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    placeholder="Search bookings..."
                    value={filters.search}
                    onChange={(e) => handleFilterChange('search', e.target.value)}
                    className={`pl-9 pr-3 py-2 border border-gray-300 rounded-lg w-full text-sm focus:ring-2 focus:ring-${fullColor}`}
                  />
                </div>
              </div>
              
              {filters.view === 'range' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-800 mb-2">Start Date</label>
                    <input
                      type="date"
                      value={filters.dateRange.start}
                      onChange={(e) => handleDateRangeChange('start', e.target.value)}
                      className={`w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-${fullColor}`}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-800 mb-2">End Date</label>
                    <input
                      type="date"
                      value={filters.dateRange.end}
                      onChange={(e) => handleDateRangeChange('end', e.target.value)}
                      className={`w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-${fullColor}`}
                    />
                  </div>
                </>
              )}
            </div>
            
            <div className="mt-6">
              <label className="block text-sm font-medium text-gray-800 mb-2">Packages</label>
              <div className="flex flex-wrap gap-2">
                {getUniquePackages().map(pkg => (
                  <button
                    key={pkg}
                    onClick={() => handlePackageToggle(pkg)}
                    className={`px-3 py-1 rounded-full text-xs ${
                      filters.packages.includes(pkg)
                        ? `bg-${themeColor}-100 text-${fullColor}`
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {pkg}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="mt-6 flex justify-end">
              <button
                onClick={clearFilters}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
              >
                Clear All Filters
              </button>
            </div>
          </div>
        )}

        {/* Calendar View */}
        <div className="flex-1 overflow-hidden">
          {bookings.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm p-8 text-center">
              <CalendarIcon className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-4 text-lg font-medium text-gray-900">No bookings found</h3>
              <p className="mt-2 text-gray-500">
                There are no package bookings in the selected date range.
              </p>
              <button
                onClick={() => setCurrentDate(new Date())}
                className="mt-4 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                Go to Today
              </button>
            </div>
          ) : filteredBookings.length === 0 && filters.search ? (
            <div className="bg-white rounded-lg shadow-sm p-8 text-center">
              <Search className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-4 text-lg font-medium text-gray-900">No matching bookings</h3>
              <p className="mt-2 text-gray-500">
                Try adjusting your search or filters.
              </p>
              <button
                onClick={clearFilters}
                className="mt-4 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                Clear Filters
              </button>
            </div>
          ) : (
            renderView()
          )}
        </div>

        {/* Day Detail Modal (month view) */}
        {selectedDate && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-backdrop-fade">
            <div className="bg-white rounded-lg shadow-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto animate-scale-in">
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-semibold text-gray-900">
                    Bookings for {new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                  </h3>
                  <button
                    onClick={() => setSelectedDate(null)}
                    className="text-gray-500 hover:text-gray-800"
                  >
                    <X className="h-6 w-6" />
                  </button>
                </div>
                {getBookingsForDate(new Date(selectedDate)).length === 0 ? (
                  <div className="text-center text-gray-500 py-8">
                    <CalendarIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                    <p>No bookings for this day</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {getBookingsForDate(new Date(selectedDate)).map(booking => (
                      <div 
                        key={booking.id} 
                        className="border border-gray-200 rounded-lg p-5 hover:shadow-md transition-shadow cursor-pointer"
                        onClick={() => {
                          setSelectedDate(null);
                          setSelectedBooking(booking);
                        }}
                      >
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <h4 className="font-medium text-gray-900 text-base">{booking.guest_name || 'Guest'}</h4>
                            <p className="text-sm text-gray-500">{booking.guest_email || 'No email'}</p>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <span className={`px-3 py-1 text-xs font-medium rounded-full ${
                              booking.status === 'confirmed' ? 'bg-green-100 text-green-800' :
                              booking.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                              booking.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                              booking.status === 'checked-in' ? `bg-${themeColor}-100 text-${fullColor}` :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {booking.status}
                            </span>
                            <span className="text-xs text-gray-500 font-mono">
                              #{booking.reference_number}
                            </span>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                          <div className="flex items-center text-gray-600">
                            <Clock className="h-4 w-4 text-gray-400 mr-2" />
                            <span>{booking.booking_time}</span>
                          </div>
                          <div className="flex items-center text-gray-600">
                            <Users className="h-4 w-4 text-gray-400 mr-2" />
                            <span>{booking.participants} participants</span>
                          </div>
                          <div className="flex items-center text-gray-600">
                            <PackageIcon className="h-4 w-4 text-gray-400 mr-2" />
                            <span className="truncate">{booking.package?.name || 'N/A'}</span>
                          </div>
                          {booking.location ? (
                            <div className="flex items-center text-gray-600">
                              <MapPin className="h-4 w-4 text-gray-400 mr-2" />
                              <span className="truncate">{String((booking.location as { name?: string }).name || 'N/A')}</span>
                            </div>
                          ) : null}
                        </div>

                        {(booking.attractions?.length || (booking.addOns || (booking as any).add_ons)?.length) && (
                          <div className="mt-3 pt-3 border-t border-gray-100">
                            <div className="flex flex-wrap gap-2 text-xs">
                              {booking.attractions && booking.attractions.length > 0 && (
                                <span className="bg-purple-50 text-purple-700 px-2 py-1 rounded">
                                  {booking.attractions.length} attraction{booking.attractions.length !== 1 ? 's' : ''}
                                </span>
                              )}
                              {(booking.addOns || (booking as any).add_ons) && (booking.addOns || (booking as any).add_ons).length > 0 && (
                                <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded">
                                  {(booking.addOns || (booking as any).add_ons).length} add-on{(booking.addOns || (booking as any).add_ons).length !== 1 ? 's' : ''}
                                </span>
                              )}
                            </div>
                          </div>
                        )}

                        <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between items-center">
                          <div className="text-sm text-gray-600">
                            <CreditCard className="h-4 w-4 inline text-gray-400 mr-1" />
                            <span className="capitalize">{booking.payment_method || 'N/A'}</span>
                          </div>
                          <div className="text-right">
                            <div className={`text-sm font-medium ${
                              booking.payment_status === 'paid' ? 'text-green-600' : 'text-yellow-600'
                            }`}>
                              ${Number(booking.total_amount).toFixed(2)}
                            </div>
                            {booking.payment_status === 'partial' && (
                              <div className="text-xs text-gray-500">
                                (Paid: ${Number(booking.amount_paid).toFixed(2)})
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="mt-3 text-xs text-gray-400 text-center">
                          Click to view full details
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        {/* Booking Detail Modal for daily/weekly view */}
        {selectedBooking && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-backdrop-fade">
            <div className="bg-white rounded-lg shadow-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto animate-scale-in">
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
                      <span className="font-medium text-gray-900">{selectedBooking.guest_name || 'Guest'}</span>
                    </div>
                    <div className="text-sm text-gray-600 ml-7">{selectedBooking.guest_email || 'No email provided'}</div>
                    <div className="text-sm text-gray-600 ml-7">{selectedBooking.guest_phone || 'No phone provided'}</div>
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
                        selectedBooking.status === 'confirmed' ? 'bg-green-100 text-green-800' :
                        selectedBooking.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        selectedBooking.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                        selectedBooking.status === 'checked-in' ? `bg-${themeColor}-100 text-${fullColor}` :
                        'bg-gray-100 text-gray-800'
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
                      <CalendarIcon className="h-4 w-4 text-gray-400 mr-3" />
                      <span className="text-sm text-gray-900">{new Date(selectedBooking.booking_date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                    </div>
                    <div className="flex items-center">
                      <Clock className="h-4 w-4 text-gray-400 mr-3" />
                      <span className="text-sm text-gray-900">{selectedBooking.booking_time}</span>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                      <span className="text-sm text-gray-600">Duration</span>
                      <span className="text-sm font-medium text-gray-900">{selectedBooking.duration} {selectedBooking.duration_unit}</span>
                    </div>
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
                {selectedBooking.location ? (
                  <div className="mb-6">
                    <h4 className="text-sm font-semibold text-gray-700 uppercase mb-3">Location</h4>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="flex items-center">
                        <MapPin className="h-4 w-4 text-gray-400 mr-3" />
                        <span className="font-medium text-gray-900">{String((selectedBooking.location as { name?: string }).name || 'N/A')}</span>
                      </div>
                    </div>
                  </div>
                ) : null}

                {/* Room */}
                {selectedBooking.room ? (
                  <div className="mb-6">
                    <h4 className="text-sm font-semibold text-gray-700 uppercase mb-3">Room</h4>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-gray-900">{String((selectedBooking.room as { name?: string }).name || 'N/A')}</span>
                        {(selectedBooking.room as { capacity?: number }).capacity && (
                          <span className="text-sm text-gray-600">Capacity: {(selectedBooking.room as { capacity?: number }).capacity}</span>
                        )}
                      </div>
                    </div>
                  </div>
                ) : null}

                {/* Attractions */}
                {selectedBooking.attractions && Array.isArray(selectedBooking.attractions) && selectedBooking.attractions.length > 0 && (
                  <div className="mb-6">
                    <h4 className="text-sm font-semibold text-gray-700 uppercase mb-3">Additional Attractions</h4>
                    <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                      {(selectedBooking.attractions as Array<{ name?: string; description?: string; quantity?: number; price?: string | number; pivot?: { quantity?: number } }>).map((attraction, index: number) => (
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
                      {((selectedBooking.addOns || (selectedBooking as any).add_ons) as Array<{ name?: string; description?: string; quantity?: number; price?: string | number; pivot?: { quantity?: number } }>).map((addon, index: number) => (
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

                {/* Special Requests & Notes */}
                {(selectedBooking.special_requests || selectedBooking.notes) && (
                  <div className="mb-6">
                    <h4 className="text-sm font-semibold text-gray-700 uppercase mb-3">Notes & Requests</h4>
                    <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                      {selectedBooking.special_requests && (
                        <div>
                          <span className="text-xs font-medium text-gray-600 uppercase">Special Requests</span>
                          <p className="text-sm text-gray-900 mt-1">{selectedBooking.special_requests}</p>
                        </div>
                      )}
                      {selectedBooking.notes && (
                        <div className={selectedBooking.special_requests ? 'pt-3 border-t border-gray-200' : ''}>
                          <span className="text-xs font-medium text-gray-600 uppercase">Internal Notes</span>
                          <p className="text-sm text-gray-900 mt-1">{selectedBooking.notes}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Payment Information */}
                <div className="border-t pt-6">
                  <h4 className="text-sm font-semibold text-gray-700 uppercase mb-3">Payment Details</h4>
                  <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <CreditCard className="h-4 w-4 text-gray-400 mr-3" />
                        <span className="text-sm text-gray-600">Payment Method</span>
                      </div>
                      <span className="text-sm font-medium text-gray-900 capitalize">
                        {selectedBooking.payment_method || 'N/A'}
                      </span>
                    </div>
                    
                    <div className="flex justify-between items-center pt-3 border-t border-gray-200">
                      <span className="text-sm text-gray-600">Subtotal</span>
                      <span className="text-sm text-gray-900">${Number(selectedBooking.total_amount).toFixed(2)}</span>
                    </div>
                    
                    {selectedBooking.discount_amount && Number(selectedBooking.discount_amount) > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Discount</span>
                        <span className="text-sm text-red-600">-${Number(selectedBooking.discount_amount).toFixed(2)}</span>
                      </div>
                    )}
                    
                    <div className="flex justify-between items-center pt-3 border-t border-gray-200">
                      <span className="text-base font-semibold text-gray-900">Total Amount</span>
                      <span className="text-base font-bold text-gray-900">${Number(selectedBooking.total_amount).toFixed(2)}</span>
                    </div>
                    
                    <div className="flex justify-between items-center pt-3 border-t border-gray-200">
                      <span className="text-sm text-gray-600">Amount Paid</span>
                      <span className={`text-sm font-medium ${
                        selectedBooking.payment_status === 'paid' ? 'text-green-600' : 'text-yellow-600'
                      }`}>
                        ${Number(selectedBooking.amount_paid).toFixed(2)}
                      </span>
                    </div>
                    
                    {selectedBooking.payment_status === 'partial' && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Balance Due</span>
                        <span className="text-sm font-medium text-red-600">
                          ${(Number(selectedBooking.total_amount) - Number(selectedBooking.amount_paid)).toFixed(2)}
                        </span>
                      </div>
                    )}
                    
                    <div className="flex justify-between items-center pt-3 border-t border-gray-200">
                      <span className="text-sm text-gray-600">Payment Status</span>
                      <span className={`px-3 py-1 text-xs font-medium rounded-full ${
                        selectedBooking.payment_status === 'paid' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {selectedBooking.payment_status === 'paid' ? 'Fully Paid' : 'Partial Payment'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Toast Notification */}
        {toast && (
          <div className="fixed top-4 right-4 z-50 animate-fade-in-up">
            <Toast
              message={toast.message}
              type={toast.type}
              onClose={() => setToast(null)}
            />
          </div>
        )}
      </div>
  );
};

export default CalendarView;