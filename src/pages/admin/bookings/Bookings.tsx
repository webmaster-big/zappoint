// src/pages/admin/bookings/Bookings.tsx
import React, { useState, useEffect } from 'react';
import { 
  Eye, 
  Pencil, 
  Trash2, 
  Search, 
  Filter, 
  RefreshCcw, 
  CheckCircle2, 
  Calendar,
  Package,
  DollarSign,
  Users,
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
  createdAt: string;
  paymentMethod: string;
  attractions?: { name: string; quantity: number }[];
  addOns?: { name: string; quantity: number }[];
  duration?: string;
  activity?: string;
}

interface FilterOptions {
  status: string;
  dateRange: {
    start: string;
    end: string;
  };
  search: string;
  payment: string;
  type: string;
}

const Bookings: React.FC = () => {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [filteredBookings, setFilteredBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBookings, setSelectedBookings] = useState<string[]>([]);
  const [filters, setFilters] = useState<FilterOptions>({
    status: 'all',
    dateRange: {
      start: '',
      end: ''
    },
    search: '',
    payment: 'all',
    type: 'all'
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [showFilters, setShowFilters] = useState(false);

  // Status and payment colors
  const statusColors = {
    pending: 'bg-yellow-100 text-yellow-800',
    confirmed: 'bg-blue-100 text-blue-800',
    cancelled: 'bg-red-100 text-red-800',
    completed: 'bg-green-100 text-green-800',
    'checked-in': 'bg-blue-100 text-blue-800'
  };

  const paymentColors = {
    credit_card: 'bg-blue-100 text-blue-800',
    paypal: 'bg-blue-100 text-blue-800',
    cash: 'bg-green-100 text-green-800',
    'e-wallet': 'bg-orange-100 text-orange-800'
  };

  // Calculate metrics data
  const packageBookings = bookings.filter(b => b.type === 'package');
  const attractionBookings = bookings.filter(b => b.type === 'attraction');
  
  const metrics = [
    {
      title: 'Total Bookings',
      value: bookings.length.toString(),
      change: `${bookings.length} total bookings`,
      icon: Calendar,
      accent: 'bg-blue-100 text-blue-800',
    },
    {
      title: 'Package Bookings',
      value: packageBookings.length.toString(),
      change: `${packageBookings.filter(b => b.status === 'confirmed').length} confirmed`,
      icon: Package,
      accent: 'bg-blue-100 text-blue-800',
    },
    {
      title: 'Attraction Bookings',
      value: attractionBookings.length.toString(),
      change: `${attractionBookings.filter(b => b.status === 'confirmed').length} confirmed`,
      icon: Ticket,
      accent: 'bg-green-100 text-green-800',
    },
    {
      title: 'Participants',
      value: bookings.reduce((sum, booking) => sum + booking.participants, 0).toString(),
      change: `${bookings.length} bookings`,
      icon: Users,
      accent: 'bg-orange-100 text-orange-800',
    },
    {
      title: 'Revenue',
      value: `$${Number(bookings.reduce((sum, booking) => sum + booking.totalAmount, 0)).toFixed(2)}`,
      change: 'All bookings',
      icon: DollarSign,
      accent: 'bg-indigo-100 text-indigo-800',
    },
  ];

  // Load bookings from localStorage
  useEffect(() => {
    loadBookings();
  }, []);

  // Apply filters when bookings or filters change
  useEffect(() => {
    applyFilters();
  }, [bookings, filters]);

  const loadBookings = () => {
    try {
      const storedBookings = localStorage.getItem('zapzone_bookings');
      if (storedBookings) {
        const parsedBookings = JSON.parse(storedBookings);
        setBookings(parsedBookings);
      } else {
        // Sample data for demonstration
        const sampleBookings: Booking[] = [
          {
            id: '1',
            type: 'package',
            packageName: 'Family Fun Package',
            customerName: 'John Doe',
            email: 'john@example.com',
            phone: '555-1234',
            date: '2024-01-15',
            time: '2:00 PM',
            participants: 4,
            status: 'confirmed',
            totalAmount: 199.99,
            createdAt: '2024-01-10T10:30:00Z',
            paymentMethod: 'credit_card',
            attractions: [
              { name: 'Laser Tag', quantity: 2 },
              { name: 'Bowling', quantity: 1 }
            ],
            addOns: [
              { name: 'Extra Pizza', quantity: 1 }
            ],
            duration: '2 hours',
            activity: 'Family Entertainment'
          },
          {
            id: '2',
            type: 'package',
            packageName: 'Corporate Event',
            customerName: 'Jane Smith',
            email: 'jane@company.com',
            phone: '555-5678',
            date: '2024-01-20',
            time: '6:00 PM',
            participants: 12,
            status: 'pending',
            totalAmount: 599.99,
            createdAt: '2024-01-12T14:45:00Z',
            paymentMethod: 'paypal',
            attractions: [
              { name: 'Arcade', quantity: 5 },
              { name: 'Axe Throwing', quantity: 3 }
            ],
            addOns: [],
            duration: '4 hours',
            activity: 'Team Building'
          },
          {
            id: '3',
            type: 'attraction',
            attractionName: 'Laser Tag',
            customerName: 'Mike Johnson',
            email: 'mike@example.com',
            phone: '555-9012',
            date: '2024-01-18',
            time: '3:00 PM',
            participants: 8,
            status: 'completed',
            totalAmount: 120.00,
            createdAt: '2024-01-05T09:15:00Z',
            paymentMethod: 'cash',
            duration: '1 hour',
            activity: 'Laser Tag'
          },
          {
            id: '4',
            type: 'attraction',
            attractionName: 'Bowling',
            customerName: 'Sarah Wilson',
            email: 'sarah@example.com',
            phone: '555-3456',
            date: '2024-01-22',
            time: '7:00 PM',
            participants: 6,
            status: 'confirmed',
            totalAmount: 90.00,
            createdAt: '2024-01-15T16:20:00Z',
            paymentMethod: 'e-wallet',
            duration: '2 hours',
            activity: 'Bowling'
          },
          {
            id: '5',
            type: 'package',
            packageName: 'Birthday Party',
            customerName: 'Robert Brown',
            email: 'robert@example.com',
            phone: '555-7890',
            date: '2024-01-25',
            time: '1:00 PM',
            participants: 10,
            status: 'checked-in',
            totalAmount: 350.00,
            createdAt: '2024-01-18T11:45:00Z',
            paymentMethod: 'credit_card',
            attractions: [
              { name: 'Party Room', quantity: 1 },
              { name: 'Laser Tag', quantity: 2 }
            ],
            addOns: [
              { name: 'Birthday Cake', quantity: 1 },
              { name: 'Balloons', quantity: 1 }
            ],
            duration: '3 hours',
            activity: 'Birthday Celebration'
          }
        ];
        setBookings(sampleBookings);
        localStorage.setItem('zapzone_bookings', JSON.stringify(sampleBookings));
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

    // Apply status filter
    if (filters.status !== 'all') {
      result = result.filter(booking => booking.status === filters.status);
    }

    // Apply payment filter
    if (filters.payment !== 'all') {
      result = result.filter(booking => booking.paymentMethod === filters.payment);
    }

    // Apply type filter
    if (filters.type !== 'all') {
      result = result.filter(booking => booking.type === filters.type);
    }

    // Apply date range filter
    if (filters.dateRange.start) {
      result = result.filter(booking => booking.date >= filters.dateRange.start);
    }
    if (filters.dateRange.end) {
      result = result.filter(booking => booking.date <= filters.dateRange.end);
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

  const clearFilters = () => {
    setFilters({
      status: 'all',
      dateRange: {
        start: '',
        end: ''
      },
      search: '',
      payment: 'all',
      type: 'all'
    });
  };

  const handleSelectBooking = (id: string) => {
    setSelectedBookings(prev =>
      prev.includes(id)
        ? prev.filter(bookingId => bookingId !== id)
        : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedBookings.length === currentBookings.length) {
      setSelectedBookings([]);
    } else {
      setSelectedBookings(currentBookings.map(booking => booking.id));
    }
  };

  const handleStatusChange = (id: string, newStatus: Booking['status']) => {
    const updatedBookings = bookings.map(booking =>
      booking.id === id ? { ...booking, status: newStatus } : booking
    );
    setBookings(updatedBookings);
    localStorage.setItem('zapzone_bookings', JSON.stringify(updatedBookings));
  };

  const handleCheckIn = (id: string) => {
    const updatedBookings = bookings.map(booking =>
      booking.id === id ? { ...booking, status: 'checked-in' } : booking
    );
    setBookings(updatedBookings);
    localStorage.setItem('zapzone_bookings', JSON.stringify(updatedBookings));
  };

  const handleBulkDelete = () => {
    if (selectedBookings.length === 0) return;
    
    if (window.confirm(`Are you sure you want to delete ${selectedBookings.length} booking(s)?`)) {
      const updatedBookings = bookings.filter(booking => !selectedBookings.includes(booking.id));
      setBookings(updatedBookings);
      setSelectedBookings([]);
      localStorage.setItem('zapzone_bookings', JSON.stringify(updatedBookings));
    }
  };

  const handleBulkStatusChange = (newStatus: Booking['status']) => {
    if (selectedBookings.length === 0) return;
    
    const updatedBookings = bookings.map(booking =>
      selectedBookings.includes(booking.id) ? { ...booking, status: newStatus } : booking
    );
    setBookings(updatedBookings);
    setSelectedBookings([]);
    localStorage.setItem('zapzone_bookings', JSON.stringify(updatedBookings));
  };

  // Pagination
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentBookings = filteredBookings.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredBookings.length / itemsPerPage);

  const paginate = (pageNumber: number) => setCurrentPage(pageNumber);

  if (loading) {
    return (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-800"></div>
        </div>
    );
  }

  return (
      <div className="px-6 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Bookings Management</h1>
            <p className="text-gray-800 mt-2">Manage all package and attraction bookings</p>
          </div> 
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-6">
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
                <p className="text-xs mt-1 text-gray-600 ">{metric.change}</p>
              </div>
            );
          })}
        </div>

        {/* Filters and Search */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-6">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <div className="relative flex-1 max-w-lg">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-gray-600 " />
              </div>
              <input
                type="text"
                placeholder="Search bookings..."
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                className="pl-9 pr-3 py-1.5 border border-gray-200 rounded-lg w-full text-sm focus:ring-2 focus:ring-blue-600  focus:border-blue-600 "
              />
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 text-sm"
              >
                <Filter className="h-4 w-4 mr-1" />
                Filters
              </button>
              <button
                onClick={loadBookings}
                className="flex items-center px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 text-sm"
              >
                <RefreshCcw className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Advanced Filters */}
          {showFilters && (
            <div className="mt-3 p-3 bg-gray-50 rounded-lg">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Type</label>
                  <select
                    value={filters.type}
                    onChange={(e) => handleFilterChange('type', e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-600  focus:border-blue-600 "
                  >
                    <option value="all">All Types</option>
                    <option value="package">Packages</option>
                    <option value="attraction">Attractions</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
                  <select
                    value={filters.status}
                    onChange={(e) => handleFilterChange('status', e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-600  focus:border-blue-600 "
                  >
                    <option value="all">All Statuses</option>
                    <option value="pending">Pending</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="checked-in">Checked In</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Payment Method</label>
                  <select
                    value={filters.payment}
                    onChange={(e) => handleFilterChange('payment', e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-600  focus:border-blue-600 "
                  >
                    <option value="all">All Methods</option>
                    <option value="credit_card">Credit Card</option>
                    <option value="paypal">PayPal</option>
                    <option value="cash">Cash</option>
                    <option value="e-wallet">E-Wallet</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">From Date</label>
                  <input
                    type="date"
                    value={filters.dateRange.start}
                    onChange={(e) => handleDateRangeChange('start', e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-600  focus:border-blue-600 "
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">To Date</label>
                  <input
                    type="date"
                    value={filters.dateRange.end}
                    onChange={(e) => handleDateRangeChange('end', e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-600  focus:border-blue-600 "
                  />
                </div>
              </div>
              <div className="mt-3 flex justify-end">
                <button
                  onClick={clearFilters}
                  className="px-3 py-1.5 text-sm text-gray-800 hover:text-gray-800"
                >
                  Clear Filters
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Bulk Actions */}
        {selectedBookings.length > 0 && (
          <div className="bg-blue-50 p-4 rounded-lg mb-6 flex flex-wrap items-center gap-4">
            <span className="text-blue-800 font-medium">
              {selectedBookings.length} booking(s) selected
            </span>
            <div className="flex gap-2">
              <select
                onChange={(e) => handleBulkStatusChange(e.target.value as Booking['status'])}
                className="border border-gray-200 rounded-lg px-3 py-1 focus:ring-2 focus:ring-blue-600 "
              >
                <option value="">Change Status</option>
                <option value="confirmed">Confirm</option>
                <option value="checked-in">Check In</option>
                <option value="completed">Mark Complete</option>
                <option value="cancelled">Cancel</option>
              </select>
              <button
                onClick={handleBulkDelete}
                className="flex items-center px-3 py-1 bg-red-100 text-red-700 rounded-lg hover:bg-red-200"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Delete
              </button>
            </div>
          </div>
        )}

        {/* Bookings Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium w-12">
                    <input
                      type="checkbox"
                      checked={selectedBookings.length === currentBookings.length && currentBookings.length > 0}
                      onChange={handleSelectAll}
                      className="rounded border-gray-300 text-blue-800 focus:ring-blue-600 "
                    />
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium w-20">Type</th>
                  <th scope="col" className="px-4 py-3 font-medium w-40">Date & Time</th>
                  <th scope="col" className="px-4 py-3 font-medium w-48">Customer</th>
                  <th scope="col" className="px-4 py-3 font-medium w-48">Booking Details</th>
                  <th scope="col" className="px-4 py-3 font-medium w-40">Duration</th>
                  <th scope="col" className="px-4 py-3 font-medium w-20">Participants</th>
                  <th scope="col" className="px-4 py-3 font-medium w-24">Status</th>
                  <th scope="col" className="px-4 py-3 font-medium w-24">Payment</th>
                  <th scope="col" className="px-4 py-3 font-medium w-28">Amount</th>
                  <th scope="col" className="px-4 py-3 font-medium w-20">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {currentBookings.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-6 py-8 text-center text-gray-500">
                      No bookings found
                    </td>
                  </tr>
                ) : (
                  currentBookings.map((booking) => (
                    <tr key={booking.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={selectedBookings.includes(booking.id)}
                          onChange={() => handleSelectBooking(booking.id)}
                          className="rounded border-gray-300 text-blue-800 focus:ring-blue-600 "
                        />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                          
                          booking.type === 'package' 
                            ? 'bg-blue-100 text-blue-800' 
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {booking.type === 'package' ? 'Package' : 'Attraction'}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="font-medium text-gray-900">
                          {new Date(booking.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </div>
                        <div className="text-xs text-gray-500">{booking.time}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="font-medium text-gray-900">{booking.customerName}</div>
                        <div className="text-xs text-gray-500">{booking.email}</div>
                        <div className="text-xs text-gray-500">{booking.phone}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="font-medium text-gray-900">
                          {booking.type === 'package' ? booking.packageName : booking.attractionName}
                        </div>
                        <div className="text-xs text-gray-500">{booking.activity}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                        {booking.duration || <span className="text-gray-600 ">-</span>}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                        {booking.participants}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <select
                          value={booking.status}
                          onChange={(e) => handleStatusChange(booking.id, e.target.value as Booking['status'])}
                          className={`text-xs font-medium px-2 py-1 rounded-full ${statusColors[booking.status]} border-none focus:ring-2 focus:ring-blue-600 `}
                        >
                          <option value="pending">Pending</option>
                          <option value="confirmed">Confirmed</option>
                          <option value="checked-in">Checked In</option>
                          <option value="completed">Completed</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`text-xs font-medium px-2 py-1 rounded-full ${paymentColors[booking.paymentMethod as keyof typeof paymentColors] || 'bg-gray-100 text-gray-800'}`}>
                          {(booking.paymentMethod ?? 'N/A').replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                        ${typeof booking.totalAmount === 'number' && !isNaN(booking.totalAmount) ? booking.totalAmount.toFixed(2) : '0.00'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium">
                        <div className="flex items-center gap-2">
                          {booking.status !== 'checked-in' && booking.status !== 'completed' && (
                            <button
                              onClick={() => handleCheckIn(booking.id)}
                              className="p-1 text-green-800 hover:text-green-800"
                              title="Check-in"
                            >
                              <CheckCircle2 className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            onClick={() => {/* View details */}}
                            className="p-1 text-gray-800 hover:text-gray-800"
                            title="View Details"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => {/* Edit booking */}}
                            className="p-1 text-gray-800 hover:text-gray-800"
                            title="Edit"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                         
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="bg-white px-6 py-4 border-t border-gray-100">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-700">
                  Showing <span className="font-medium">{indexOfFirstItem + 1}</span> to{' '}
                  <span className="font-medium">
                    {Math.min(indexOfLastItem, filteredBookings.length)}
                  </span>{' '}
                  of <span className="font-medium">{filteredBookings.length}</span> results
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => paginate(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Previous
                  </button>
                  
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <button
                      key={page}
                      onClick={() => paginate(page)}
                      className={`px-3 py-1 border rounded-lg text-sm font-medium ${
                        currentPage === page
                          ? 'border-blue-500 bg-blue-500 text-white'
                          : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                  
                  <button
                    onClick={() => paginate(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
  );
};

export default Bookings;