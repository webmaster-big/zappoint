// src/pages/admin/bookings/CalendarView.tsx
import React, { useState, useEffect } from 'react';
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
  Zap,
  Gift,
  Ticket
} from 'lucide-react';

// Types
interface Booking {
  id: string;
  type: 'package' | 'attraction';
  packageName?: string;
  attractionName?: string;
  customerName: string;
  email: string;
  phone: string;
  date: string;
  time: string;
  participants: number;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'checked-in';
  totalAmount: number;
  amountPaid: number;
  createdAt: string;
  paymentMethod: string;
  attractions?: { name: string; quantity: number }[];
  addOns?: { name: string; quantity: number; price: number }[];
  duration?: string;
  activity?: string;
  notes?: string;
}

interface FilterOptions {
  view: 'day' | 'week' | 'month' | 'range';
  activities: string[];
  packages: string[];
  attractions: string[];
  dateRange: {
    start: string;
    end: string;
  };
  search: string;
  type: string;
}

const CalendarView: React.FC = () => {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [filteredBookings, setFilteredBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [filters, setFilters] = useState<FilterOptions>({
    view: 'month',
    activities: [],
    packages: [],
    attractions: [],
    dateRange: {
      start: '',
      end: ''
    },
    search: '',
    type: 'all'
  });
  const [showFilters, setShowFilters] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);

  // Load bookings from localStorage
  useEffect(() => {
    loadBookings();
  }, []);

  // Apply filters when bookings or filters change
  useEffect(() => {
    applyFilters();
  }, [bookings, filters, currentDate]);

  const loadBookings = () => {
    try {
      const storedBookings = localStorage.getItem('zapzone_bookings');
      if (storedBookings) {
        const parsedBookings = JSON.parse(storedBookings);
        setBookings(parsedBookings);
        
        // Set current date to the first booking date if available
        if (parsedBookings.length > 0) {
          const firstBookingDate = new Date(parsedBookings[0].date);
          if (!isNaN(firstBookingDate.getTime())) {
            setCurrentDate(firstBookingDate);
          }
        }
      } else {
        // Sample data for 2025 with both package and attraction bookings
        const sampleBookings: Booking[] = [
          {
            id: '1',
            type: 'package',
            packageName: 'Family Fun Package',
            customerName: 'John Doe',
            email: 'john@example.com',
            phone: '555-1234',
            date: '2025-03-15',
            time: '2:00 PM',
            participants: 4,
            status: 'confirmed',
            totalAmount: 199.99,
            amountPaid: 199.99,
            createdAt: '2025-01-10T10:30:00Z',
            paymentMethod: 'credit_card',
            attractions: [
              { name: 'Laser Tag', quantity: 2 },
              { name: 'Bowling', quantity: 1 }
            ],
            addOns: [
              { name: 'Extra Pizza', quantity: 1, price: 12.99 }
            ],
            duration: '2 hours',
            activity: 'Family Entertainment',
            notes: 'Allergy: None'
          },
          {
            id: '2',
            type: 'package',
            packageName: 'Corporate Event',
            customerName: 'Jane Smith',
            email: 'jane@company.com',
            phone: '555-5678',
            date: '2025-03-15',
            time: '6:00 PM',
            participants: 12,
            status: 'pending',
            totalAmount: 599.99,
            amountPaid: 300.00,
            createdAt: '2025-01-12T14:45:00Z',
            paymentMethod: 'paypal',
            attractions: [
              { name: 'Arcade', quantity: 5 },
              { name: 'Axe Throwing', quantity: 3 }
            ],
            addOns: [],
            duration: '4 hours',
            activity: 'Team Building',
            notes: 'Need projector for presentation'
          },
          {
            id: '3',
            type: 'attraction',
            attractionName: 'Laser Tag',
            customerName: 'Mike Johnson',
            email: 'mike@example.com',
            phone: '555-9012',
            date: '2025-03-18',
            time: '3:00 PM',
            participants: 8,
            status: 'completed',
            totalAmount: 120.00,
            amountPaid: 120.00,
            createdAt: '2025-01-05T09:15:00Z',
            paymentMethod: 'cash',
            duration: '1 hour',
            activity: 'Laser Tag',
            notes: 'Group of 8 friends'
          },
          {
            id: '4',
            type: 'attraction',
            attractionName: 'Bowling',
            customerName: 'Sarah Wilson',
            email: 'sarah@example.com',
            phone: '555-3456',
            date: '2025-03-15',
            time: '1:00 PM',
            participants: 6,
            status: 'confirmed',
            totalAmount: 90.00,
            amountPaid: 90.00,
            createdAt: '2025-01-15T16:20:00Z',
            paymentMethod: 'e-wallet',
            duration: '2 hours',
            activity: 'Bowling',
            notes: '2 lanes requested'
          },
          {
            id: '5',
            type: 'package',
            packageName: 'Birthday Party',
            customerName: 'Robert Brown',
            email: 'robert@example.com',
            phone: '555-7890',
            date: '2025-03-25',
            time: '1:00 PM',
            participants: 10,
            status: 'checked-in',
            totalAmount: 350.00,
            amountPaid: 350.00,
            createdAt: '2025-01-18T11:45:00Z',
            paymentMethod: 'credit_card',
            attractions: [
              { name: 'Party Room', quantity: 1 },
              { name: 'Laser Tag', quantity: 2 }
            ],
            addOns: [
              { name: 'Birthday Cake', quantity: 1, price: 25.99 },
              { name: 'Balloons', quantity: 1, price: 15.99 }
            ],
            duration: '3 hours',
            activity: 'Birthday Celebration',
            notes: 'Birthday boy is 10 years old'
          },
          {
            id: '6',
            type: 'attraction',
            attractionName: 'Arcade Games',
            customerName: 'Alex Chen',
            email: 'alex@example.com',
            phone: '555-2468',
            date: '2025-03-20',
            time: '5:00 PM',
            participants: 3,
            status: 'confirmed',
            totalAmount: 45.00,
            amountPaid: 45.00,
            createdAt: '2025-02-10T14:30:00Z',
            paymentMethod: 'credit_card',
            duration: '1.5 hours',
            activity: 'Arcade',
            notes: 'Unlimited play package'
          }
        ];
        setBookings(sampleBookings);
        localStorage.setItem('zapzone_bookings', JSON.stringify(sampleBookings));
        
        // Set current date to March 2025 to match the sample data
        setCurrentDate(new Date(2025, 2, 1)); // March 2025
      }
    } catch (error) {
      console.error('Error loading bookings:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let result = [...bookings];

    // Apply search filter
    if (filters.search) {
      const searchTerm = filters.search.toLowerCase();
      result = result.filter(booking =>
        booking.customerName.toLowerCase().includes(searchTerm) ||
        booking.email.toLowerCase().includes(searchTerm) ||
        (booking.packageName && booking.packageName.toLowerCase().includes(searchTerm)) ||
        (booking.attractionName && booking.attractionName.toLowerCase().includes(searchTerm)) ||
        booking.phone.includes(searchTerm)
      );
    }

    // Apply type filter
    if (filters.type !== 'all') {
      result = result.filter(booking => booking.type === filters.type);
    }

    // Apply activities filter
    if (filters.activities.length > 0) {
      result = result.filter(booking => 
        booking.activity && filters.activities.includes(booking.activity)
      );
    }

    // Apply packages filter
    if (filters.packages.length > 0) {
      result = result.filter(booking => 
        booking.packageName && filters.packages.includes(booking.packageName)
      );
    }

    // Apply attractions filter
    if (filters.attractions.length > 0) {
      result = result.filter(booking => 
        booking.attractionName && filters.attractions.includes(booking.attractionName)
      );
    }

    // Apply date range filter based on view
    if (filters.view === 'range' && filters.dateRange.start && filters.dateRange.end) {
      result = result.filter(booking => 
        booking.date >= filters.dateRange.start && booking.date <= filters.dateRange.end
      );
    } else {
      // Filter based on current view (day, week, month)
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
      }

      const startDateString = startDate.toISOString().split('T')[0];
      const endDateString = endDate.toISOString().split('T')[0];

      result = result.filter(booking => {
        return booking.date >= startDateString && booking.date <= endDateString;
      });
    }

    setFilteredBookings(result);
  };

  const handleFilterChange = (key: keyof FilterOptions, value: any) => {
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

  const handleActivityToggle = (activity: string) => {
    setFilters(prev => {
      const activities = prev.activities.includes(activity)
        ? prev.activities.filter(a => a !== activity)
        : [...prev.activities, activity];
      
      return { ...prev, activities };
    });
  };

  const handlePackageToggle = (packageName: string) => {
    setFilters(prev => {
      const packages = prev.packages.includes(packageName)
        ? prev.packages.filter(p => p !== packageName)
        : [...prev.packages, packageName];
      
      return { ...prev, packages };
    });
  };

  const handleAttractionToggle = (attractionName: string) => {
    setFilters(prev => {
      const attractions = prev.attractions.includes(attractionName)
        ? prev.attractions.filter(a => a !== attractionName)
        : [...prev.attractions, attractionName];
      
      return { ...prev, attractions };
    });
  };

  const clearFilters = () => {
    setFilters({
      view: 'month',
      activities: [],
      packages: [],
      attractions: [],
      dateRange: {
        start: '',
        end: ''
      },
      search: '',
      type: 'all'
    });
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
    const dateString = date.toISOString().split('T')[0];
    return filteredBookings.filter(booking => booking.date === dateString);
  };

  const getUniqueActivities = () => {
    const activities = bookings
      .map(booking => booking.activity)
      .filter((activity): activity is string => !!activity);
    
    return [...new Set(activities)];
  };

  const getUniquePackages = () => {
    const packages = bookings
      .map(booking => booking.packageName)
      .filter((pkg): pkg is string => !!pkg);
    
    return [...new Set(packages)];
  };

  const getUniqueAttractions = () => {
    const attractions = bookings
      .map(booking => booking.attractionName)
      .filter((attraction): attraction is string => !!attraction);
    
    return [...new Set(attractions)];
  };

  const getBookingTitle = (booking: Booking) => {
    if (booking.type === 'package') {
      return booking.packageName || 'Package Booking';
    } else {
      return booking.attractionName || 'Attraction Booking';
    }
  };

  const getBookingColor = (booking: Booking) => {
    if (booking.type === 'package') {
      return 'bg-blue-100 text-blue-800';
    } else {
      return 'bg-green-100 text-green-800';
    }
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
                    <h4 className="font-medium text-gray-900">{booking.customerName}</h4>
                    <p className="text-sm text-gray-500">{getBookingTitle(booking)}</p>
                    <p className="text-sm text-gray-500">{booking.time}</p>
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
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getBookingColor(booking)}`}>
                      {booking.type === 'package' ? 'Package' : 'Attraction'}
                    </span>
                  </div>
                </div>
                <div className="mt-2 text-sm">
                  <p>Participants: {booking.participants}</p>
                  <p>Activity: {booking.activity || 'N/A'}</p>
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
            <div key={day.toISOString()} className="text-center font-medium text-gray-700 py-2">
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
                  day.toDateString() === new Date().toDateString() ? 'bg-blue-50' : ''
                }`}
              >
                <div className="text-sm font-medium mb-2">
                  {day.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </div>
                {dayBookings.slice(0, 3).map(booking => (
                  <div 
                    key={booking.id} 
                    className={`text-xs rounded p-2 mb-2 cursor-pointer ${getBookingColor(booking)}`}
                    title={`${booking.customerName} - ${booking.time}`}
                    onClick={() => setSelectedBooking(booking)}
                  >
                    <div className="font-medium truncate">{booking.time} - {booking.customerName}</div>
                    <div className="truncate">{getBookingTitle(booking)}</div>
                  </div>
                ))}
                {dayBookings.length > 3 && (
                  <div className="text-xs text-gray-500 mt-2 text-center">
                    +{dayBookings.length - 3} more
                  </div>
                )}
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
            <div key={day} className="text-center font-medium text-gray-700 py-2">
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
                className={`border border-gray-200 rounded-lg p-3 h-32 overflow-hidden ${
                  day.toDateString() === new Date().toDateString() ? 'bg-blue-50' : ''
                }`}
                onClick={() => setSelectedDate(day.toISOString().split('T')[0])}
              >
                <div className="text-sm font-medium mb-2">
                  {day.getDate()}
                </div>
                
                {dayBookings.slice(0, 2).map(booking => (
                  <div 
                    key={booking.id} 
                    className={`text-xs rounded p-2 mb-2 cursor-pointer ${getBookingColor(booking)}`}
                    title={`${booking.customerName} - ${booking.time}`}
                    onClick={e => {
                      e.stopPropagation();
                      setSelectedBooking(booking);
                    }}
                  >
                    <div className="font-medium truncate">{booking.time} - {booking.customerName}</div>
                    <div className="truncate">{getBookingTitle(booking)}</div>
                  </div>
                ))}
                
                {dayBookings.length > 2 && (
                  <div className="text-xs text-gray-500 text-center">
                    +{dayBookings.length - 2} more
                  </div>
                )}
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
                    <h4 className="font-medium text-gray-900">{booking.customerName}</h4>
                    <p className="text-sm text-gray-500">{getBookingTitle(booking)}</p>
                    <p className="text-sm text-gray-500">
                      {new Date(booking.date).toLocaleDateString()} at {booking.time}
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
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getBookingColor(booking)}`}>
                      {booking.type === 'package' ? 'Package' : 'Attraction'}
                    </span>
                  </div>
                </div>
                <div className="mt-2 text-sm">
                  <p>Participants: {booking.participants}</p>
                  <p>Activity: {booking.activity || 'N/A'}</p>
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
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-700"></div>
        </div>
    );
  }

  return (
      <div className="px-6 py-8 h-full flex flex-col">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Booking Calendar</h1>
            <p className="text-gray-600 mt-2">View and manage package and attraction bookings</p>
          </div>
          <div className="flex gap-2 mt-4 sm:mt-0">
            <Link
              to="/bookings"
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              {/* <List className="h-5 w-5 mr-2" /> */}
              List View
            </Link>
            <div className="flex gap-2">
              <Link
                to="/packages"
                className="inline-flex items-center px-4 py-2 bg-blue-700 text-white rounded-lg hover:bg-blue-700"
              >
                <PackageIcon className="h-5 w-5 mr-2" />
                Packages
              </Link>
              <Link
                to="/book/attractions"
                className="inline-flex items-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
              >
                <Ticket className="h-5 w-5 mr-2" />
                Attractions
              </Link>
            </div>
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
                className="border border-gray-300 rounded-lg px-3 py-1 text-sm focus:ring-2 focus:ring-blue-700"
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
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-4 w-4 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    placeholder="Search bookings..."
                    value={filters.search}
                    onChange={(e) => handleFilterChange('search', e.target.value)}
                    className="pl-9 pr-3 py-2 border border-gray-300 rounded-lg w-full text-sm focus:ring-2 focus:ring-blue-700"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Booking Type</label>
                <select
                  value={filters.type}
                  onChange={(e) => handleFilterChange('type', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-700"
                >
                  <option value="all">All Types</option>
                  <option value="package">Packages</option>
                  <option value="attraction">Attractions</option>
                </select>
              </div>
              
              {filters.view === 'range' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
                    <input
                      type="date"
                      value={filters.dateRange.start}
                      onChange={(e) => handleDateRangeChange('start', e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-700"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
                    <input
                      type="date"
                      value={filters.dateRange.end}
                      onChange={(e) => handleDateRangeChange('end', e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-700"
                    />
                  </div>
                </>
              )}
            </div>
            
            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Activities</label>
                <div className="flex flex-wrap gap-2">
                  {getUniqueActivities().map(activity => (
                    <button
                      key={activity}
                      onClick={() => handleActivityToggle(activity)}
                      className={`px-3 py-1 rounded-full text-xs ${
                        filters.activities.includes(activity)
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {activity}
                    </button>
                  ))}
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Packages</label>
                <div className="flex flex-wrap gap-2">
                  {getUniquePackages().map(pkg => (
                    <button
                      key={pkg}
                      onClick={() => handlePackageToggle(pkg)}
                      className={`px-3 py-1 rounded-full text-xs ${
                        filters.packages.includes(pkg)
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {pkg}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Attractions</label>
                <div className="flex flex-wrap gap-2">
                  {getUniqueAttractions().map(attraction => (
                    <button
                      key={attraction}
                      onClick={() => handleAttractionToggle(attraction)}
                      className={`px-3 py-1 rounded-full text-xs ${
                        filters.attractions.includes(attraction)
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {attraction}
                    </button>
                  ))}
                </div>
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
          {renderView()}
        </div>

        {/* Day Detail Modal (month view) */}
        {selectedDate && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold">
                    Bookings for {new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                  </h3>
                  <button
                    onClick={() => setSelectedDate(null)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                {getBookingsForDate(new Date(selectedDate)).length === 0 ? (
                  <div className="text-center text-gray-500 py-8">
                    No bookings for this day
                  </div>
                ) : (
                  <div className="space-y-6">
                    {getBookingsForDate(new Date(selectedDate)).map(booking => (
                      <div key={booking.id} className="border border-gray-200 rounded-lg p-6">
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <h4 className="font-medium text-gray-900 text-lg">{booking.customerName}</h4>
                            <p className="text-sm text-gray-500">{booking.email}</p>
                            <p className="text-sm text-gray-500">{booking.phone}</p>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <span className={`px-3 py-1 text-sm font-medium rounded-full ${
                              booking.status === 'confirmed' ? 'bg-green-100 text-green-800' :
                              booking.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                              booking.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                              booking.status === 'checked-in' ? 'bg-blue-100 text-blue-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {booking.status}
                            </span>
                            <span className={`px-3 py-1 text-sm font-medium rounded-full ${getBookingColor(booking)}`}>
                              {booking.type === 'package' ? 'Package' : booking.type === 'attraction' ? 'Attraction' : booking.type}
                            </span>
                            <span className="text-xs text-gray-500 mt-1">
                              {booking.type === 'package' && booking.packageName}
                              {booking.type === 'attraction' && booking.attractionName}
                            </span>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                          <div className="flex items-center">
                            <Clock className="h-5 w-5 text-gray-400 mr-2" />
                            <span className="text-sm">{booking.time} • {booking.duration}</span>
                          </div>
                          <div className="flex items-center">
                            <Users className="h-5 w-5 text-gray-400 mr-2" />
                            <span className="text-sm">{booking.participants} participants</span>
                          </div>
                          <div className="flex items-center">
                            {booking.type === 'package' ? (
                              <PackageIcon className="h-5 w-5 text-gray-400 mr-2" />
                            ) : (
                              <Ticket className="h-5 w-5 text-gray-400 mr-2" />
                            )}
                            <span className="text-sm">
                              {booking.type === 'package' && booking.packageName}
                              {booking.type === 'attraction' && booking.attractionName}
                            </span>
                          </div>
                          <div className="flex items-center">
                            <Zap className="h-5 w-5 text-gray-400 mr-2" />
                            <span className="text-sm">{booking.activity || 'N/A'}</span>
                          </div>
                        </div>
                        {booking.attractions && booking.attractions.length > 0 && (
                          <div className="mb-4">
                            <h5 className="font-medium text-gray-700 mb-2">Attractions</h5>
                            <div className="flex flex-wrap gap-2">
                              {booking.attractions.map((attraction, index) => (
                                <span key={index} className="bg-gray-100 text-gray-800 text-xs px-2 py-1 rounded">
                                  {attraction.name} ({attraction.quantity})
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        {booking.addOns && booking.addOns.length > 0 && (
                          <div className="mb-4">
                            <h5 className="font-medium text-gray-700 mb-2 flex items-center">
                              <Gift className="h-4 w-4 mr-1" /> Add-ons
                            </h5>
                            <ul className="space-y-1">
                              {booking.addOns.map((addOn, index) => (
                                <li key={index} className="text-sm flex justify-between">
                                  <span>{addOn.name} ({addOn.quantity})</span>
                                  <span>${addOn.price.toFixed(2)}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        <div className="border-t pt-4">
                          <div className="flex justify-between items-center mb-2">
                            <div className="flex items-center">
                              <CreditCard className="h-5 w-5 text-gray-400 mr-2" />
                              <span className="text-sm font-medium">Payment</span>
                            </div>
                            <div className="text-right">
                              <div className="text-sm">
                                {booking.paymentMethod.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                              </div>
                              {booking.status === 'pending' ? (
                                <div className="text-xs text-yellow-600">
                                  Partial payment: ${booking.amountPaid.toFixed(2)} of ${booking.totalAmount.toFixed(2)}
                                </div>
                              ) : (
                                <div className="text-xs text-green-600">
                                  Paid: ${booking.totalAmount.toFixed(2)}
                                </div>
                              )}
                            </div>
                          </div>
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
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold">
                    Booking Details
                  </h3>
                  <button
                    onClick={() => setSelectedBooking(null)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <div className="space-y-2">
                  <div className="font-medium text-gray-900 text-lg">{selectedBooking.customerName}</div>
                  <div className="text-sm text-gray-500">{selectedBooking.email}</div>
                  <div className="text-sm text-gray-500">{selectedBooking.phone}</div>
                  <div className="text-sm text-gray-500">{selectedBooking.date} {selectedBooking.time}</div>
                  <div className="text-sm text-gray-500">{getBookingTitle(selectedBooking)}</div>
                  <div className="text-sm text-gray-500">Activity: {selectedBooking.activity || 'N/A'}</div>
                  <div className="text-sm text-gray-500">Participants: {selectedBooking.participants}</div>
                  <div className="text-sm text-gray-500">Status: <span className={`font-semibold ${
                    selectedBooking.status === 'confirmed' ? 'text-green-600' :
                    selectedBooking.status === 'pending' ? 'text-yellow-600' :
                    selectedBooking.status === 'cancelled' ? 'text-red-600' :
                    selectedBooking.status === 'checked-in' ? 'text-blue-700' :
                    'text-gray-600'
                  }`}>{selectedBooking.status}</span></div>
                  <div className="text-sm text-gray-500">Type: <span className={`font-semibold ${selectedBooking.type === 'package' ? 'text-blue-700' : 'text-green-600'}`}>
                    {selectedBooking.type === 'package' ? 'Package' : 'Attraction'}
                  </span></div>
                </div>
                {selectedBooking.attractions && selectedBooking.attractions.length > 0 && (
                  <div className="mt-4">
                    <h5 className="font-medium text-gray-700 mb-2">Attractions</h5>
                    <div className="flex flex-wrap gap-2">
                      {selectedBooking.attractions.map((attraction, index) => (
                        <span key={index} className="bg-gray-100 text-gray-800 text-xs px-2 py-1 rounded">
                          {attraction.name} ({attraction.quantity})
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {selectedBooking.addOns && selectedBooking.addOns.length > 0 && (
                  <div className="mt-4">
                    <h5 className="font-medium text-gray-700 mb-2 flex items-center">
                      <Gift className="h-4 w-4 mr-1" /> Add-ons
                    </h5>
                    <ul className="space-y-1">
                      {selectedBooking.addOns.map((addOn, index) => (
                        <li key={index} className="text-sm flex justify-between">
                          <span>{addOn.name} ({addOn.quantity})</span>
                          <span>${addOn.price.toFixed(2)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="border-t pt-4 mt-4">
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center">
                      <CreditCard className="h-5 w-5 text-gray-400 mr-2" />
                      <span className="text-sm font-medium">Payment</span>
                    </div>
                    <div className="text-right">
                      <div className="text-sm">
                        {selectedBooking.paymentMethod.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </div>
                      {selectedBooking.status === 'pending' ? (
                        <div className="text-xs text-yellow-600">
                          Partial payment: ${selectedBooking.amountPaid.toFixed(2)} of ${selectedBooking.totalAmount.toFixed(2)}
                        </div>
                      ) : (
                        <div className="text-xs text-green-600">
                          Paid: ${selectedBooking.totalAmount.toFixed(2)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
  );
};

export default CalendarView;