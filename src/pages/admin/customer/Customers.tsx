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
  Plus,
  Tag,
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
          <div className="flex gap-2">
            <button className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg font-semibold whitespace-nowrap flex items-center gap-2">
              <Download className="w-4 h-4" />
              Export
            </button>
            <button className={`bg-${fullColor} hover:bg-${themeColor}-900 text-white px-6 py-2 rounded-lg font-semibold whitespace-nowrap inline-flex items-center gap-2`}>
              <Plus className="h-5 w-5" />
              Add Customer
            </button>
          </div>
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
    </div>
  );
};

export default CustomerListing;