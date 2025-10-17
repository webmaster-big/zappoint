import React, { useState, useEffect } from 'react';
import {
  Users,
  Search,
  Mail,
  Phone,
  Calendar,
  DollarSign,
  Star,
  Edit,
  Trash2,
  Eye,
  ChevronLeft,
  ChevronRight,
  Download,
  Plus,
  Tag,
} from 'lucide-react';
import type { CustomersCustomer } from '../../../types/Customers.types';

const CustomerListing: React.FC = () => {
  const [customers, setCustomers] = useState<CustomersCustomer[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<CustomersCustomer[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Sample customer data
  const sampleCustomers: CustomersCustomer[] = [
    {
      id: '1',
      name: 'John Smith',
      email: 'john.smith@email.com',
      phone: '(555) 123-4567',
      joinDate: '2024-01-15',
      lastActivity: '2024-09-20',
      totalSpent: 1250,
      bookings: 8,
      ticketsPurchased: 15,
      status: 'active',
      satisfaction: 4.8,
      tags: ['VIP', 'Regular']
    },
    {
      id: '2',
      name: 'Sarah Johnson',
      email: 'sarah.j@email.com',
      phone: '(555) 987-6543',
      joinDate: '2024-02-20',
      lastActivity: '2024-09-18',
      totalSpent: 850,
      bookings: 5,
      ticketsPurchased: 10,
      status: 'active',
      satisfaction: 4.5,
      tags: ['Regular']
    },
    {
      id: '3',
      name: 'Michael Brown',
      email: 'm.brown@email.com',
      phone: '(555) 456-7890',
      joinDate: '2024-03-10',
      lastActivity: '2024-09-15',
      totalSpent: 420,
      bookings: 3,
      ticketsPurchased: 5,
      status: 'active',
      satisfaction: 4.2,
      tags: ['New']
    },
    {
      id: '4',
      name: 'Emily Davis',
      email: 'emily.davis@email.com',
      phone: '(555) 234-5678',
      joinDate: '2024-04-05',
      lastActivity: '2024-09-10',
      totalSpent: 680,
      bookings: 4,
      ticketsPurchased: 8,
      status: 'active',
      satisfaction: 4.9,
      tags: ['VIP']
    },
    {
      id: '5',
      name: 'David Wilson',
      email: 'd.wilson@email.com',
      phone: '(555) 876-5432',
      joinDate: '2024-05-12',
      lastActivity: '2024-08-28',
      totalSpent: 320,
      bookings: 2,
      ticketsPurchased: 3,
      status: 'inactive',
      satisfaction: 3.8,
      tags: []
    },
    {
      id: '6',
      name: 'Jennifer Lee',
      email: 'j.lee@email.com',
      phone: '(555) 345-6789',
      joinDate: '2024-06-18',
      lastActivity: '2024-09-22',
      totalSpent: 950,
      bookings: 6,
      ticketsPurchased: 12,
      status: 'active',
      satisfaction: 4.7,
      tags: ['Regular', 'Corporate']
    },
    {
      id: '7',
      name: 'Robert Taylor',
      email: 'r.taylor@email.com',
      phone: '(555) 765-4321',
      joinDate: '2024-07-22',
      lastActivity: '2024-09-19',
      totalSpent: 580,
      bookings: 3,
      ticketsPurchased: 7,
      status: 'active',
      satisfaction: 4.3,
      tags: ['New']
    },
    {
      id: '8',
      name: 'Amanda Clark',
      email: 'a.clark@email.com',
      phone: '(555) 111-2222',
      joinDate: '2024-08-05',
      lastActivity: '2024-09-21',
      totalSpent: 1200,
      bookings: 7,
      ticketsPurchased: 14,
      status: 'active',
      satisfaction: 4.6,
      tags: ['VIP', 'Regular']
    },
    {
      id: '9',
      name: 'Christopher Martinez',
      email: 'c.martinez@email.com',
      phone: '(555) 333-4444',
      joinDate: '2024-08-15',
      lastActivity: '2024-09-16',
      totalSpent: 750,
      bookings: 4,
      ticketsPurchased: 9,
      status: 'active',
      satisfaction: 4.4,
      tags: ['Regular']
    },
    {
      id: '10',
      name: 'Jessica Anderson',
      email: 'j.anderson@email.com',
      phone: '(555) 555-6666',
      joinDate: '2024-09-01',
      lastActivity: '2024-09-23',
      totalSpent: 180,
      bookings: 1,
      ticketsPurchased: 1,
      status: 'new',
      satisfaction: 0,
      tags: ['New']
    },
    {
      id: '11',
      name: 'Daniel Thompson',
      email: 'd.thompson@email.com',
      phone: '(555) 777-8888',
      joinDate: '2024-09-05',
      lastActivity: '2024-09-20',
      totalSpent: 420,
      bookings: 2,
      ticketsPurchased: 6,
      status: 'active',
      satisfaction: 4.1,
      tags: ['New']
    },
    {
      id: '12',
      name: 'Michelle White',
      email: 'm.white@email.com',
      phone: '(555) 999-0000',
      joinDate: '2024-09-10',
      lastActivity: '2024-09-18',
      totalSpent: 890,
      bookings: 5,
      ticketsPurchased: 11,
      status: 'active',
      satisfaction: 4.8,
      tags: ['Regular']
    },
    {
      id: '13',
      name: 'Kevin Harris',
      email: 'k.harris@email.com',
      phone: '(555) 123-7890',
      joinDate: '2024-09-12',
      lastActivity: '2024-09-22',
      totalSpent: 310,
      bookings: 2,
      ticketsPurchased: 4,
      status: 'active',
      satisfaction: 4.0,
      tags: ['New']
    },
    {
      id: '14',
      name: 'Lisa Garcia',
      email: 'l.garcia@email.com',
      phone: '(555) 456-1234',
      joinDate: '2024-09-15',
      lastActivity: '2024-09-21',
      totalSpent: 670,
      bookings: 3,
      ticketsPurchased: 8,
      status: 'active',
      satisfaction: 4.5,
      tags: ['Regular']
    },
    {
      id: '15',
      name: 'Matthew Robinson',
      email: 'm.robinson@email.com',
      phone: '(555) 789-4561',
      joinDate: '2024-09-18',
      lastActivity: '2024-09-23',
      totalSpent: 230,
      bookings: 1,
      ticketsPurchased: 2,
      status: 'new',
      satisfaction: 0,
      tags: ['New']
    }
  ];

  // Initialize customers
  useEffect(() => {
    setCustomers(sampleCustomers);
    setFilteredCustomers(sampleCustomers);
  }, []);

  // Filter and sort customers
  useEffect(() => {
    let result = [...customers];

    // Apply search filter
    if (searchTerm) {
      result = result.filter(customer =>
        customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      result = result.filter(customer => customer.status === statusFilter);
    }

    // Apply sorting
    result.sort((a, b) => {
      // If not filtering by status and status is different, push 'inactive' to last
      if (statusFilter === 'all' && a.status !== b.status) {
        if (a.status === 'inactive') return 1;
        if (b.status === 'inactive') return -1;
      }
      let aValue: any = a[sortBy as keyof CustomersCustomer];
      let bValue: any = b[sortBy as keyof CustomersCustomer];

      if (sortBy === 'joinDate' || sortBy === 'lastActivity') {
        aValue = new Date(aValue).getTime();
        bValue = new Date(bValue).getTime();
      }

      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    setFilteredCustomers(result);
    setCurrentPage(1); // Reset to first page when filters change
  }, [customers, searchTerm, statusFilter, sortBy, sortOrder]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredCustomers.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentCustomers = filteredCustomers.slice(startIndex, startIndex + itemsPerPage);

  // Handle page change
  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  // Handle items per page change
  const handleItemsPerPageChange = (value: number) => {
    setItemsPerPage(value);
    setCurrentPage(1);
  };

  // Handle sort
  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
  };

  // Status badge component
  const StatusBadge = ({ status }: { status: string }) => {
    const statusConfig = {
      active: { color: 'bg-green-100 text-green-800', label: 'Active' },
      inactive: { color: 'bg-gray-100 text-gray-800', label: 'Inactive' },
      new: { color: 'bg-blue-100 text-blue-800', label: 'New' }
    };

    const config = statusConfig[status as keyof typeof statusConfig];
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
        {config.label}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 p-2 sm:p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 flex items-center gap-2 mb-1">
            <Users className="w-6 h-6 text-blue-600" />
            Customers
          </h1>
          <p className="text-sm md:text-base text-gray-600">
            Manage and view all customer information
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-3 mt-4 md:mt-0">
          <button className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm flex items-center gap-2 hover:bg-gray-50 w-full sm:w-auto">
            <Download className="w-4 h-4" />
            Export
          </button>
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm flex items-center gap-2 hover:bg-blue-700 w-full sm:w-auto">
            <Plus className="w-4 h-4" />
            Add Customer
          </button>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-white rounded-lg p-3 sm:p-4 mb-6 shadow-sm border border-gray-200">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search customers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
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
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
          >
            <option value="5">5 per page</option>
            <option value="10">10 per page</option>
            <option value="20">20 per page</option>
            <option value="50">50 per page</option>
          </select>
        </div>
      </div>

      {/* Results Count */}
      <div className="flex flex-col sm:flex-row items-center justify-between mb-4 gap-2">
        <p className="text-sm text-gray-600">
          Showing {startIndex + 1}-{Math.min(startIndex + itemsPerPage, filteredCustomers.length)} of{' '}
          {filteredCustomers.length} customers
        </p>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <span>Sort by:</span>
          <select
            value={`${sortBy}-${sortOrder}`}
            onChange={(e) => {
              const [column, order] = e.target.value.split('-');
              setSortBy(column);
              setSortOrder(order as 'asc' | 'desc');
            }}
            className="px-2 py-1 border border-gray-300 rounded text-sm"
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
      </div>

      {/* Customers Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-x-auto">
        <table className="min-w-[700px] w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th 
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                onClick={() => handleSort('name')}
              >
                <div className="flex items-center gap-1">
                  Customer
                  {sortBy === 'name' && (
                    <span className="text-blue-600">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                  )}
                </div>
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Contact
              </th>
              <th 
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                onClick={() => handleSort('joinDate')}
              >
                <div className="flex items-center gap-1">
                  Join Date
                  {sortBy === 'joinDate' && (
                    <span className="text-blue-600">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                  )}
                </div>
              </th>
              <th 
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                onClick={() => handleSort('totalSpent')}
              >
                <div className="flex items-center gap-1">
                  Total Spent
                  {sortBy === 'totalSpent' && (
                    <span className="text-blue-600">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                  )}
                </div>
              </th>
              <th 
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                onClick={() => handleSort('bookings')}
              >
                <div className="flex items-center gap-1">
                  Bookings
                  {sortBy === 'bookings' && (
                    <span className="text-blue-600">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                  )}
                </div>
              </th>
              <th 
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                onClick={() => handleSort('ticketsPurchased')}
              >
                <div className="flex items-center gap-1">
                  Tickets <br/> Purchased
                  {sortBy === 'ticketsPurchased' && (
                    <span className="text-blue-600">{sortOrder === 'asc' ? '↑' : '↓'}</span>
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
          <tbody className="divide-y divide-gray-200">
            {currentCustomers.length > 0 ? (
              currentCustomers.map((customer) => (
                <tr key={customer.id} className="hover:bg-gray-50">
                  <td className="px-4 py-4">
                    <div>
                      <div className="font-medium text-gray-900">{customer.name}</div>
                      <div className="flex items-center gap-1 mt-1">
                        <Star className="w-3 h-3 text-yellow-400 fill-current" />
                        <span className="text-xs text-gray-500">
                          {customer.satisfaction > 0 ? customer.satisfaction : 'No rating'}
                        </span>
                      </div>
                      {customer.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {customer.tags.map((tag, index) => (
                            <span
                              key={index}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-800"
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
                        <Mail className="w-3 h-3" />
                        {customer.email}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Phone className="w-3 h-3" />
                        {customer.phone}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-600">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3 h-3" />
                      {new Date(customer.joinDate).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2 font-medium text-gray-900">
                      <DollarSign className="w-3 h-3 text-green-600" />
                      ${customer.totalSpent.toLocaleString()}
                    </div>
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-600">
                    {customer.bookings} bookings
                  </td>
                  <td className="px-4 py-4 text-sm text-center text-gray-600">
                    {customer.ticketsPurchased}
                  </td>
                  <td className="px-4 py-4">
                    <StatusBadge status={customer.status} />
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <button className="p-1 text-blue-600 hover:text-blue-800" title="View">
                        <Eye className="w-4 h-4" />
                      </button>
                      <button className="p-1 text-gray-600 hover:text-gray-800" title="Edit">
                        <Edit className="w-4 h-4" />
                      </button>
                      <button className="p-1 text-red-600 hover:text-red-800" title="Delete">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                  No customers found matching your criteria
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {filteredCustomers.length > 0 && (
        <div className="px-4 py-3 bg-gray-50 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Page {currentPage} of {totalPages}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage === 1}
                className="p-2 border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
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
                    className={`px-3 py-1 border rounded-md text-sm ${
                      currentPage === pageNum
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'border-gray-300 hover:bg-gray-100'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}

              <button
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="p-2 border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerListing;