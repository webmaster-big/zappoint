import { useState, useEffect } from 'react';
import { 
  Trash2, 
  Search, 
  Filter, 
  RefreshCcw,
  Download,
  User,
  CreditCard,
  CheckCircle,
  XCircle,
  Clock
} from 'lucide-react';

// Types
interface Purchase {
  id: string;
  type: string;
  attractionName: string;
  customerName: string;
  email: string;
  phone: string;
  quantity: number;
  status: 'confirmed' | 'pending' | 'cancelled' | 'refunded';
  totalAmount: number;
  createdAt: string;
  paymentMethod: string;
  duration: string;
  activity: string;
}

interface FilterOptions {
  status: string;
  paymentMethod: string;
  search: string;
  dateRange: string;
}

const ManagePurchases = () => {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [filteredPurchases, setFilteredPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPurchases, setSelectedPurchases] = useState<string[]>([]);
  const [filters, setFilters] = useState<FilterOptions>({
    status: 'all',
    paymentMethod: 'all',
    search: '',
    dateRange: 'all'
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [showFilters, setShowFilters] = useState(false);

  // Status colors and icons
  const statusConfig = {
    confirmed: { color: 'bg-blue-100 text-blue-800', icon: CheckCircle },
    pending: { color: 'bg-yellow-100 text-yellow-800', icon: Clock },
    cancelled: { color: 'bg-red-100 text-red-800', icon: XCircle },
    refunded: { color: 'bg-blue-100 text-blue-800', icon: CheckCircle }
  };

  // Calculate metrics data
  const metrics = [
    {
      title: 'Total Purchases',
      value: purchases.length.toString(),
      change: `${purchases.filter(p => p.status === 'confirmed').length} confirmed`,
      accent: 'bg-blue-100 text-blue-800',
      icon: CreditCard,
    },
    {
      title: 'Total Revenue',
      value: `$${purchases.reduce((sum, p) => sum + p.totalAmount, 0).toFixed(2)}`,
      change: 'All time revenue',
      accent: 'bg-blue-100 text-blue-800',
      icon: CheckCircle,
    },
    {
      title: 'Avg. Purchase',
      value: purchases.length > 0 
        ? `$${(purchases.reduce((sum, p) => sum + p.totalAmount, 0) / purchases.length).toFixed(2)}` 
        : '$0.00',
      change: 'Per transaction',
      accent: 'bg-blue-100 text-blue-800',
      icon: Download,
    },
    {
      title: 'Unique Customers',
      value: new Set(purchases.map(p => p.email)).size.toString(),
      change: 'Total customers',
      accent: 'bg-blue-100 text-blue-800',
      icon: User,
    }
  ];

  // Load purchases from localStorage
  useEffect(() => {
    loadPurchases();
  }, []);

  // Apply filters when purchases or filters change
  useEffect(() => {
    applyFilters();
  }, [purchases, filters]);

  const loadPurchases = () => {
    try {
      const storedPurchases = localStorage.getItem('zapzone_purchases');
      if (storedPurchases) {
        const parsedPurchases = JSON.parse(storedPurchases);
        setPurchases(parsedPurchases);
      } else {
        // Sample data for demonstration
        const samplePurchases: Purchase[] = [
          {
            id: 'purchase_1',
            type: 'attraction',
            attractionName: 'Laser Tag Arena',
            customerName: 'John Smith',
            email: 'john.smith@example.com',
            phone: '(555) 123-4567',
            quantity: 4,
            status: 'confirmed',
            totalAmount: 100.00,
            createdAt: '2024-01-15T10:30:00Z',
            paymentMethod: 'credit_card',
            duration: '30 minutes',
            activity: 'Laser Tag'
          },
          {
            id: 'purchase_2',
            type: 'attraction',
            attractionName: 'Bowling Lanes',
            customerName: 'Sarah Johnson',
            email: 'sarah.j@example.com',
            phone: '(555) 987-6543',
            quantity: 2,
            status: 'confirmed',
            totalAmount: 40.00,
            createdAt: '2024-01-14T14:45:00Z',
            paymentMethod: 'paypal',
            duration: '60 minutes',
            activity: 'Bowling'
          },
          {
            id: 'purchase_3',
            type: 'attraction',
            attractionName: 'VR Experience',
            customerName: 'Mike Wilson',
            email: 'mike.wilson@example.com',
            phone: '(555) 456-7890',
            quantity: 1,
            status: 'pending',
            totalAmount: 35.00,
            createdAt: '2024-01-13T16:20:00Z',
            paymentMethod: 'credit_card',
            duration: '20 minutes',
            activity: 'VR Experience'
          },
          {
            id: 'purchase_4',
            type: 'attraction',
            attractionName: 'Laser Tag Arena',
            customerName: 'Emily Davis',
            email: 'emily.d@example.com',
            phone: '(555) 234-5678',
            quantity: 6,
            status: 'cancelled',
            totalAmount: 150.00,
            createdAt: '2024-01-12T11:15:00Z',
            paymentMethod: 'credit_card',
            duration: '30 minutes',
            activity: 'Laser Tag'
          },
          {
            id: 'purchase_5',
            type: 'attraction',
            attractionName: 'Bowling Lanes',
            customerName: 'David Brown',
            email: 'david.b@example.com',
            phone: '(555) 876-5432',
            quantity: 3,
            status: 'refunded',
            totalAmount: 60.00,
            createdAt: '2024-01-11T19:30:00Z',
            paymentMethod: 'paypal',
            duration: '60 minutes',
            activity: 'Bowling'
          }
        ];
        setPurchases(samplePurchases);
        localStorage.setItem('zapzone_purchases', JSON.stringify(samplePurchases));
      }
    } catch (error) {
      console.error('Error loading purchases:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let result = [...purchases];

    // Apply search filter
    if (filters.search) {
      const searchTerm = filters.search.toLowerCase();
      result = result.filter(purchase =>
        purchase.customerName.toLowerCase().includes(searchTerm) ||
        purchase.email.toLowerCase().includes(searchTerm) ||
        purchase.attractionName.toLowerCase().includes(searchTerm) ||
        purchase.phone.toLowerCase().includes(searchTerm)
      );
    }

    // Apply status filter
    if (filters.status !== 'all') {
      result = result.filter(purchase => purchase.status === filters.status);
    }

    // Apply payment method filter
    if (filters.paymentMethod !== 'all') {
      result = result.filter(purchase => purchase.paymentMethod === filters.paymentMethod);
    }

    // Apply date range filter
    if (filters.dateRange !== 'all') {
      const now = new Date();
      const startDate = new Date();

      switch (filters.dateRange) {
        case 'today':
          startDate.setHours(0, 0, 0, 0);
          break;
        case 'week':
          startDate.setDate(now.getDate() - 7);
          break;
        case 'month':
          startDate.setMonth(now.getMonth() - 1);
          break;
        default:
          break;
      }

      result = result.filter(purchase => {
        const purchaseDate = new Date(purchase.createdAt);
        return purchaseDate >= startDate;
      });
    }

    setFilteredPurchases(result);
  };

  const handleFilterChange = (key: keyof FilterOptions, value: any) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const clearFilters = () => {
    setFilters({
      status: 'all',
      paymentMethod: 'all',
      search: '',
      dateRange: 'all'
    });
  };

  const handleSelectPurchase = (id: string) => {
    setSelectedPurchases(prev =>
      prev.includes(id)
        ? prev.filter(purchaseId => purchaseId !== id)
        : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedPurchases.length === currentPurchases.length) {
      setSelectedPurchases([]);
    } else {
      setSelectedPurchases(currentPurchases.map(purchase => purchase.id));
    }
  };

  const handleStatusChange = (id: string, newStatus: Purchase['status']) => {
    const updatedPurchases = purchases.map(purchase =>
      purchase.id === id ? { ...purchase, status: newStatus } : purchase
    );
    setPurchases(updatedPurchases);
    localStorage.setItem('zapzone_purchases', JSON.stringify(updatedPurchases));
  };

  const handleDeletePurchase = (id: string) => {
    if (window.confirm('Are you sure you want to delete this purchase record?')) {
      const updatedPurchases = purchases.filter(purchase => purchase.id !== id);
      setPurchases(updatedPurchases);
      localStorage.setItem('zapzone_purchases', JSON.stringify(updatedPurchases));
    }
  };

  const handleBulkDelete = () => {
    if (selectedPurchases.length === 0) return;
    
    if (window.confirm(`Are you sure you want to delete ${selectedPurchases.length} purchase record(s)?`)) {
      const updatedPurchases = purchases.filter(purchase => !selectedPurchases.includes(purchase.id));
      setPurchases(updatedPurchases);
      setSelectedPurchases([]);
      localStorage.setItem('zapzone_purchases', JSON.stringify(updatedPurchases));
    }
  };

  const handleBulkStatusChange = (newStatus: Purchase['status']) => {
    if (selectedPurchases.length === 0) return;
    
    const updatedPurchases = purchases.map(purchase =>
      selectedPurchases.includes(purchase.id) ? { ...purchase, status: newStatus } : purchase
    );
    setPurchases(updatedPurchases);
    setSelectedPurchases([]);
    localStorage.setItem('zapzone_purchases', JSON.stringify(updatedPurchases));
  };

  const exportToCSV = () => {
    const headers = ['ID', 'Customer Name', 'Email', 'Phone', 'Attraction', 'Quantity', 'Total Amount', 'Status', 'Payment Method', 'Date'];
    const csvData = filteredPurchases.map(purchase => [
      purchase.id,
      purchase.customerName,
      purchase.email,
      purchase.phone,
      purchase.attractionName,
      purchase.quantity,
      purchase.totalAmount,
      purchase.status,
      purchase.paymentMethod,
      new Date(purchase.createdAt).toLocaleDateString()
    ]);

    const csvContent = [
      headers.join(','),
      ...csvData.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `purchases-export-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

//   // Get unique statuses and payment methods
//   const getUniqueValues = (key: keyof Purchase) => {
//     const values = purchases.map(purchase => purchase[key]);
//     return [...new Set(values)];
//   };

  // Pagination
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentPurchases = filteredPurchases.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredPurchases.length / itemsPerPage);

  const paginate = (pageNumber: number) => setCurrentPage(pageNumber);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-800"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 px-6 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Manage Purchases</h1>
          <p className="text-gray-600 mt-2">View and manage all customer purchases</p>
        </div>
        <div className="mt-4 sm:mt-0 flex gap-2">
          <button
            onClick={exportToCSV}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Download className="h-5 w-5 mr-2" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {metrics.map((metric, index) => {
          const Icon = metric.icon;
          return (
            <div
              key={index}
              className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex flex-col gap-2 hover:shadow-md transition-shadow min-h-[120px]"
            >
              <div className="flex items-center gap-2 mb-2">
                <div className={`p-2 rounded-lg ${metric.accent}`}>
                  <Icon size={20} />
                </div>
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

      {/* Filters and Search */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-6">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="relative flex-1 max-w-lg">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search purchases..."
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              className="pl-9 pr-3 py-2 border border-gray-200 rounded-lg w-full focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              <Filter className="h-4 w-4 mr-1" />
              Filters
            </button>
            <button
              onClick={loadPurchases}
              className="flex items-center px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              <RefreshCcw className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Advanced Filters */}
        {showFilters && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-800 mb-1">Status</label>
                <select
                  value={filters.status}
                  onChange={(e) => handleFilterChange('status', e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
                >
                  <option value="all">All Statuses</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="pending">Pending</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="refunded">Refunded</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-800 mb-1">Payment Method</label>
                <select
                  value={filters.paymentMethod}
                  onChange={(e) => handleFilterChange('paymentMethod', e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
                >
                  <option value="all">All Methods</option>
                  <option value="credit_card">Credit Card</option>
                  <option value="paypal">PayPal</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-800 mb-1">Date Range</label>
                <select
                  value={filters.dateRange}
                  onChange={(e) => handleFilterChange('dateRange', e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
                >
                  <option value="all">All Time</option>
                  <option value="today">Today</option>
                  <option value="week">Last 7 Days</option>
                  <option value="month">Last 30 Days</option>
                </select>
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <button
                onClick={clearFilters}
                className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800"
              >
                Clear Filters
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bulk Actions */}
      {selectedPurchases.length > 0 && (
        <div className="bg-blue-50 p-4 rounded-lg mb-6 flex flex-wrap items-center gap-4">
          <span className="text-blue-800 font-medium">
            {selectedPurchases.length} purchase(s) selected
          </span>
          <div className="flex gap-2">
            <select
              onChange={(e) => handleBulkStatusChange(e.target.value as Purchase['status'])}
              className="border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-400"
            >
              <option value="">Change Status</option>
              <option value="confirmed">Confirm</option>
              <option value="cancelled">Cancel</option>
              <option value="refunded">Refund</option>
            </select>
            <button
              onClick={handleBulkDelete}
              className="flex items-center px-3 py-2 bg-red-100 text-red-800 rounded-lg hover:bg-red-200"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Delete
            </button>
          </div>
        </div>
      )}

      {/* Purchases Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-gray-800 uppercase bg-gray-50 border-b">
              <tr>
                <th scope="col" className="px-6 py-4 font-medium w-12">
                  <input
                    type="checkbox"
                    checked={selectedPurchases.length === currentPurchases.length && currentPurchases.length > 0}
                    onChange={handleSelectAll}
                    className="rounded border-gray-300 text-blue-800 focus:ring-blue-400"
                  />
                </th>
                <th scope="col" className="px-6 py-4 font-medium">Customer</th>
                <th scope="col" className="px-6 py-4 font-medium">Attraction</th>
                <th scope="col" className="px-6 py-4 font-medium">Quantity</th>
                <th scope="col" className="px-6 py-4 font-medium">Amount</th>
                <th scope="col" className="px-6 py-4 font-medium">Payment</th>
                <th scope="col" className="px-6 py-4 font-medium">Date</th>
                <th scope="col" className="px-6 py-4 font-medium">Status</th>
                <th scope="col" className="px-6 py-4 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {currentPurchases.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-8 text-center text-gray-800">
                    No purchases found
                  </td>
                </tr>
              ) : (
                currentPurchases.map((purchase) => {
                  return (
                    <tr key={purchase.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={selectedPurchases.includes(purchase.id)}
                          onChange={() => handleSelectPurchase(purchase.id)}
                          className="rounded border-gray-300 text-blue-800 focus:ring-blue-400"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <div className="font-medium text-gray-900">{purchase.customerName}</div>
                          <div className="text-xs text-gray-600 mt-1">{purchase.email}</div>
                          <div className="text-xs text-gray-500 mt-1">{purchase.phone}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {purchase.attractionName}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {purchase.quantity}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        ${purchase.totalAmount.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <span className="capitalize">{purchase.paymentMethod.replace('_', ' ')}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDate(purchase.createdAt)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <select
                          value={purchase.status}
                          onChange={(e) => handleStatusChange(purchase.id, e.target.value as Purchase['status'])}
                          className={`text-xs font-medium px-3 py-1 rounded-full ${statusConfig[purchase.status].color} border-none focus:ring-2 focus:ring-blue-400`}
                        >
                          <option value="confirmed">Confirmed</option>
                          <option value="pending">Pending</option>
                          <option value="cancelled">Cancelled</option>
                          <option value="refunded">Refunded</option>
                        </select>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => handleDeletePurchase(purchase.id)}
                            className="text-red-600 hover:text-red-800"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="bg-white px-6 py-4 border-t border-gray-100">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-800">
                Showing <span className="font-medium">{indexOfFirstItem + 1}</span> to{' '}
                <span className="font-medium">
                  {Math.min(indexOfLastItem, filteredPurchases.length)}
                </span>{' '}
                of <span className="font-medium">{filteredPurchases.length}</span> results
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => paginate(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50"
                >
                  Previous
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    onClick={() => paginate(page)}
                    className={`px-3 py-2 border rounded-lg text-sm font-medium ${
                      currentPage === page
                        ? 'border-blue-800 bg-blue-800 text-white'
                        : 'border-gray-200 text-gray-800 hover:bg-gray-50'
                    }`}
                  >
                    {page}
                  </button>
                ))}
                <button
                  onClick={() => paginate(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50"
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

export default ManagePurchases;