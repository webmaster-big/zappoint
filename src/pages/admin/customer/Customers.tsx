import React, { useState, useEffect } from 'react';
import {
  Users,
  Search,
  Mail,
  Phone,
  Calendar,
  DollarSign,
  Edit,
  Trash2,
  Eye,
  ChevronLeft,
  ChevronRight,
  Download,
  Tag,
  X,
} from 'lucide-react';
import { useThemeColor } from '../../../hooks/useThemeColor';
import type { CustomersCustomer } from '../../../types/Customers.types';
import { customerService, type CustomerListItem } from '../../../services/CustomerService';
import { getStoredUser } from '../../../utils/storage';

const CustomerListing: React.FC = () => {
  const { themeColor, fullColor } = useThemeColor();
  const [filteredCustomers, setFilteredCustomers] = useState<CustomersCustomer[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [loading, setLoading] = useState(false);
  const [totalCustomers, setTotalCustomers] = useState(0);
  const currentUser = getStoredUser();
  const [showExportModal, setShowExportModal] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportFilters, setExportFilters] = useState({
    statuses: [] as string[],
    startDate: '',
    endDate: '',
    minSpent: '',
    maxSpent: '',
    minBookings: '',
    maxBookings: ''
  });

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Fetch customers from API
  const fetchCustomers = async () => {
    if (!currentUser?.id) return;
    
    try {
      setLoading(true);
      const filters: any = {
        page: currentPage,
        per_page: itemsPerPage,
      };

      if (debouncedSearchTerm) {
        filters.search = debouncedSearchTerm;
      }

      if (statusFilter !== 'all') {
        filters.status = statusFilter;
      }

      // Map frontend sort fields to backend
      const sortMapping: { [key: string]: string } = {
        'name': 'first_name',
        'joinDate': 'created_at',
        'totalSpent': 'total_spent',
        'bookings': 'total_bookings',
        'ticketsPurchased': 'total_ticket_quantity'
      };

      filters.sort_by = sortMapping[sortBy] || 'first_name';
      filters.sort_order = sortOrder;

      const response = await customerService.fetchCustomerList(currentUser.id, filters);
      
      if (response.success && response.data) {
        // Transform backend data to frontend format
        const formattedCustomers: CustomersCustomer[] = response.data.customers
          .filter((customer: CustomerListItem) => customer && (customer.id || customer.email)) // Filter customers with ID or email
          .map((customer: CustomerListItem) => ({
            id: customer.id ? customer.id.toString() : `guest_${customer.email}`, // Use email-based ID for guests
            name: `${customer.first_name || ''} ${customer.last_name || ''}`.trim() || 'Unknown',
            email: customer.email || 'No email',
            phone: customer.phone || 'N/A',
            joinDate: customer.created_at || new Date().toISOString(),
            lastActivity: customer.last_visit || customer.created_at || new Date().toISOString(),
            totalSpent: customer.total_spent || 0,
            bookings: customer.total_bookings || 0,
            ticketsPurchased: customer.total_ticket_quantity || 0,
            status: determineStatus(customer) as 'active' | 'inactive' | 'new' | 'guest',
            satisfaction: customer.satisfaction || 0,
            tags: customer.status === 'guest' ? ['Guest'] : (customer.tags || [])
          }));

        setFilteredCustomers(formattedCustomers);
        setTotalCustomers(response.data.pagination.total);
      }
    } catch (error) {
      console.error('Error fetching customers:', error);
    } finally {
      setLoading(false);
    }
  };

  // Determine customer status based on activity
  const determineStatus = (customer: CustomerListItem): string => {
    if (customer.status) return customer.status;
    
    const lastVisit = customer.last_visit ? new Date(customer.last_visit) : new Date(customer.created_at);
    const daysSinceVisit = Math.floor((new Date().getTime() - lastVisit.getTime()) / (1000 * 60 * 60 * 24));
    
    if (customer.total_bookings === 0) return 'new';
    if (daysSinceVisit > 90) return 'inactive';
    return 'active';
  };

  // Initialize customers
  useEffect(() => {
    fetchCustomers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, itemsPerPage, debouncedSearchTerm, statusFilter, sortBy, sortOrder]);

  // Export functionality
  const handleExport = async () => {
    try {
      setExporting(true);
      
      const filters: any = {
        sort_by: sortMapping[sortBy] || 'first_name',
        sort_order: sortOrder
      };

      if (exportFilters.statuses.length > 0) {
        filters.status = exportFilters.statuses;
      }

      if (exportFilters.startDate) {
        filters.created_after = exportFilters.startDate;
      }

      if (exportFilters.endDate) {
        filters.created_before = exportFilters.endDate;
      }

      if (exportFilters.minSpent) {
        filters.min_spent = parseFloat(exportFilters.minSpent);
      }

      if (exportFilters.maxSpent) {
        filters.max_spent = parseFloat(exportFilters.maxSpent);
      }

      if (exportFilters.minBookings) {
        filters.min_bookings = parseInt(exportFilters.minBookings);
      }

      if (exportFilters.maxBookings) {
        filters.max_bookings = parseInt(exportFilters.maxBookings);
      }

      // Fetch all customers matching filters (without pagination)
      const response = await customerService.fetchCustomerList(currentUser!.id, { ...filters, per_page: 10000 });
      
      if (response.success && response.data) {
        // Convert to CSV
        const csvData = convertToCSV(response.data.customers);
        
        // Download CSV
        const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `customers-export-${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        setShowExportModal(false);
        setExportFilters({
          statuses: [],
          startDate: '',
          endDate: '',
          minSpent: '',
          maxSpent: '',
          minBookings: '',
          maxBookings: ''
        });
      }
    } catch (error) {
      console.error('Error exporting customers:', error);
      alert('Failed to export customers. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const sortMapping: { [key: string]: string } = {
    'name': 'first_name',
    'joinDate': 'created_at',
    'totalSpent': 'total_spent',
    'bookings': 'total_bookings',
    'ticketsPurchased': 'total_ticket_quantity'
  };

  const convertToCSV = (customers: CustomerListItem[]): string => {
    const headers = [
      'Name',
      'Email',
      'Phone',
      'Join Date',
      'Last Activity',
      'Total Spent',
      'Total Bookings',
      'Tickets Purchased',
      'Status',
      'Tags'
    ];
    
    const rows = customers.map(customer => [
      `${customer.first_name || ''} ${customer.last_name || ''}`.trim() || 'Unknown',
      customer.email || 'No email',
      customer.phone || 'N/A',
      customer.created_at ? new Date(customer.created_at).toLocaleDateString() : 'N/A',
      customer.last_visit ? new Date(customer.last_visit).toLocaleDateString() : new Date(customer.created_at).toLocaleDateString(),
      customer.total_spent?.toFixed(2) || '0.00',
      customer.total_bookings || '0',
      customer.total_ticket_quantity || '0',
      determineStatus(customer),
      customer.tags?.join('; ') || ''
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');
    
    return csvContent;
  };

  // Note: Filtering and sorting is now handled by the backend API

  // Pagination calculations (backend handles pagination)
  const totalPages = Math.ceil(totalCustomers / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentCustomers = filteredCustomers; // Already paginated from backend

  // Handle page change
  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  // Handle items per page change
  const handleItemsPerPageChange = (value: number) => {
    setItemsPerPage(value);
    setCurrentPage(1);
    // Fetch will trigger automatically via useEffect
  };

  // Handle sort
  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
    setCurrentPage(1); // Reset to first page when sorting changes
  };

  // Status badge component
  const StatusBadge = ({ status }: { status: string }) => {
    const statusConfig = {
      active: { color: 'bg-green-100 text-green-800', label: 'Active' },
      inactive: { color: 'bg-gray-100 text-gray-800', label: 'Inactive' },
      new: { color: `bg-${themeColor}-100 text-${fullColor}`, label: 'New' },
      guest: { color: 'bg-blue-100 text-blue-800', label: 'Guest' }
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.new;
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
        {config.label}
      </span>
    );
  };

  return (
    <div className="w-full mx-auto px-4 pb-6 flex flex-col items-center">
      <div className="bg-white rounded-xl p-6 w-full shadow-sm border border-gray-100 mt-8 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900">Customers</h2>
            <p className="text-gray-500 mt-1">Manage and view all customer information</p>
          </div>
          <button 
            onClick={() => setShowExportModal(true)}
            className={`bg-${fullColor} hover:bg-${themeColor}-700 text-white px-4 py-2 rounded-lg font-medium whitespace-nowrap flex items-center gap-2`}
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>

        {/* Filters and Search */}
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search customers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 outline-none`}
              />
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className={`px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 outline-none min-w-[150px]`}
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="new">New</option>
            </select>

            {/* Items Per Page */}
            <select
              value={itemsPerPage}
              onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}
              className={`px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 outline-none min-w-[130px]`}
            >
              <option value="5">5 per page</option>
              <option value="10">10 per page</option>
              <option value="20">20 per page</option>
              <option value="50">50 per page</option>
            </select>

            {/* Sort Dropdown */}
            <select
              value={`${sortBy}-${sortOrder}`}
              onChange={(e) => {
                const [column, order] = e.target.value.split('-');
                setSortBy(column);
                setSortOrder(order as 'asc' | 'desc');
              }}
              className={`px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 outline-none min-w-[180px]`}
            >
              <option value="name-asc">Name (A-Z)</option>
              <option value="name-desc">Name (Z-A)</option>
              <option value="joinDate-desc">Newest First</option>
              <option value="joinDate-asc">Oldest First</option>
              <option value="totalSpent-desc">Highest Spent</option>
              <option value="totalSpent-asc">Lowest Spent</option>
              <option value="bookings-desc">Most Bookings</option>
              <option value="bookings-asc">Fewest Bookings</option>
              <option value="ticketsPurchased-desc">Most Tickets</option>
              <option value="ticketsPurchased-asc">Fewest Tickets</option>
            </select>
          </div>
          
          {/* Results count */}
          <div className="text-sm text-gray-500">
            {loading ? 'Loading...' : `Showing ${totalCustomers > 0 ? startIndex + 1 : 0}-${Math.min(startIndex + itemsPerPage, totalCustomers)} of ${totalCustomers} customer${totalCustomers !== 1 ? 's' : ''}`}
          </div>
        </div>

        {/* Customers Table */}
        <div className="overflow-x-auto mb-6">
          <table className="min-w-full w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th 
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => handleSort('name')}
                >
                  <div className="flex items-center gap-1">
                    Customer
                    {sortBy === 'name' && (
                      <span className={`text-${themeColor}-600`}>{sortOrder === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Contact
                </th>
                <th 
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => handleSort('joinDate')}
                >
                  <div className="flex items-center gap-1">
                    Join Date
                    {sortBy === 'joinDate' && (
                      <span className={`text-${themeColor}-600`}>{sortOrder === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th 
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => handleSort('totalSpent')}
                >
                  <div className="flex items-center gap-1">
                    Total Spent
                    {sortBy === 'totalSpent' && (
                      <span className={`text-${themeColor}-600`}>{sortOrder === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th 
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => handleSort('bookings')}
                >
                  <div className="flex items-center gap-1">
                    Bookings
                    {sortBy === 'bookings' && (
                      <span className={`text-${themeColor}-600`}>{sortOrder === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th 
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => handleSort('ticketsPurchased')}
                >
                  <div className="flex items-center gap-1">
                    Tickets
                    {sortBy === 'ticketsPurchased' && (
                      <span className={`text-${themeColor}-600`}>{sortOrder === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <div className={`animate-spin rounded-full h-10 w-10 border-b-2 border-${themeColor}-600`}></div>
                      <span className="text-gray-500 text-sm">Loading customers...</span>
                    </div>
                  </td>
                </tr>
              ) : currentCustomers.length > 0 ? (
                currentCustomers.map((customer, index) => (
                  <tr 
                    key={customer.id} 
                    className="hover:bg-gray-50 transition-colors animate-fade-in-up"
                    style={{ animationDelay: `${index * 0.02}s` }}
                  >
                    <td className="px-4 py-4">
                      <div>
                        <div className="font-medium text-gray-900">{customer.name}</div>
                        {customer.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {customer.tags.map((tag, idx) => (
                              <span
                                key={idx}
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-${themeColor}-50 text-${themeColor}-700 border border-${themeColor}-200`}
                              >
                                <Tag className="w-3 h-3" />
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Mail className="w-3.5 h-3.5 text-gray-400" />
                          <span className="truncate max-w-[200px]">{customer.email}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Phone className="w-3.5 h-3.5 text-gray-400" />
                          {customer.phone}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-600">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-3.5 h-3.5 text-gray-400" />
                        {new Date(customer.joinDate).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-1.5 font-semibold text-gray-900">
                        <DollarSign className={`w-4 h-4 text-${themeColor}-600`} />
                        ${customer.totalSpent.toLocaleString()}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-600 font-medium">
                      {customer.bookings}
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-600 font-medium text-center">
                      {customer.ticketsPurchased}
                    </td>
                    <td className="px-4 py-4">
                      <StatusBadge status={customer.status} />
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-1">
                        <button 
                          className={`p-2 text-${themeColor}-600 hover:bg-${themeColor}-50 rounded-lg transition-colors`} 
                          title="View Customer"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button 
                          className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors" 
                          title="Edit Customer"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button 
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors" 
                          title="Delete Customer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <div className={`inline-flex p-4 rounded-full bg-${themeColor}-50 mb-4`}>
                        <Users className={`h-12 w-12 text-${themeColor}-400`} />
                      </div>
                      <h3 className="text-lg font-medium text-gray-900 mb-2">No customers found</h3>
                      <p className="text-gray-500">
                        {searchTerm || statusFilter !== 'all' 
                          ? 'Try adjusting your search or filters' 
                          : 'No customers have been created yet'}
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && totalCustomers > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-gray-100">
            <div className="text-sm text-gray-700">
              Page <span className="font-medium">{currentPage}</span> of <span className="font-medium">{totalPages}</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage === 1}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              {/* Page numbers */}
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum: number;
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
                    onClick={() => goToPage(pageNum)}
                    className={`px-3 py-2 border rounded-lg text-sm font-medium transition-colors ${
                      currentPage === pageNum
                        ? `border-${themeColor}-700 bg-${themeColor}-700 text-white`
                        : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}

              <button
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className={`p-6 border-b border-gray-100 bg-${themeColor}-50 sticky top-0`}>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Export Customers</h2>
                  <p className="text-sm text-gray-600 mt-1">
                    Configure filters to export customer data
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowExportModal(false);
                    setExportFilters({
                      statuses: [],
                      startDate: '',
                      endDate: '',
                      minSpent: '',
                      maxSpent: '',
                      minBookings: '',
                      maxBookings: ''
                    });
                  }}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="h-5 w-5 text-gray-500" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Date Range */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Registration Date Range</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={exportFilters.startDate}
                      onChange={(e) => setExportFilters(prev => ({ ...prev, startDate: e.target.value }))}
                      className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-transparent`}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      End Date
                    </label>
                    <input
                      type="date"
                      value={exportFilters.endDate}
                      onChange={(e) => setExportFilters(prev => ({ ...prev, endDate: e.target.value }))}
                      className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-transparent`}
                    />
                  </div>
                </div>
              </div>

              {/* Status Filter */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Customer Status</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {['active', 'inactive', 'new', 'guest'].map(status => (
                    <label key={status} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={exportFilters.statuses.includes(status)}
                        onChange={(e) => {
                          setExportFilters(prev => ({
                            ...prev,
                            statuses: e.target.checked
                              ? [...prev.statuses, status]
                              : prev.statuses.filter(s => s !== status)
                          }));
                        }}
                        className={`rounded border-gray-300 text-${fullColor} focus:ring-${themeColor}-500 mr-2`}
                      />
                      <span className="text-sm text-gray-700 capitalize">{status}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Total Spent Range */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Total Spent Range</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Min Amount ($)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={exportFilters.minSpent}
                      onChange={(e) => setExportFilters(prev => ({ ...prev, minSpent: e.target.value }))}
                      className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-transparent`}
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Max Amount ($)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={exportFilters.maxSpent}
                      onChange={(e) => setExportFilters(prev => ({ ...prev, maxSpent: e.target.value }))}
                      className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-transparent`}
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </div>

              {/* Bookings Range */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Booking Count Range</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Min Bookings
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={exportFilters.minBookings}
                      onChange={(e) => setExportFilters(prev => ({ ...prev, minBookings: e.target.value }))}
                      className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-transparent`}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Max Bookings
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={exportFilters.maxBookings}
                      onChange={(e) => setExportFilters(prev => ({ ...prev, maxBookings: e.target.value }))}
                      className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-transparent`}
                      placeholder="0"
                    />
                  </div>
                </div>
              </div>

              {/* Export Info */}
              <div className={`bg-${themeColor}-50 border-2 border-${themeColor}-200 rounded-lg p-4`}>
                <div className="flex items-start gap-3">
                  <Download className={`h-5 w-5 text-${fullColor} flex-shrink-0 mt-0.5`} />
                  <div>
                    <p className={`text-sm font-medium text-${fullColor}`}>
                      CSV Export Format
                    </p>
                    <p className="text-xs text-gray-700 mt-1">
                      Your data will be exported in CSV format including customer name, contact information, registration date, activity, spending, bookings, tickets, status, and tags.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-100 flex gap-3 justify-end sticky bottom-0 bg-white">
              <button
                onClick={() => {
                  setShowExportModal(false);
                  setExportFilters({
                    statuses: [],
                    startDate: '',
                    endDate: '',
                    minSpent: '',
                    maxSpent: '',
                    minBookings: '',
                    maxBookings: ''
                  });
                }}
                disabled={exporting}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleExport}
                disabled={exporting}
                className={`px-6 py-2 bg-${fullColor} text-white rounded-lg hover:bg-${themeColor}-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2`}
              >
                {exporting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    Exporting...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4" />
                    Export to CSV
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerListing;