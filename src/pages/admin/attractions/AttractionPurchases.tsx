import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
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
  Clock,
  Eye,
  DollarSign
} from 'lucide-react';
import { useThemeColor } from '../../../hooks/useThemeColor';
import CounterAnimation from '../../../components/ui/CounterAnimation';
import type { AttractionPurchasesPurchase, AttractionPurchasesFilterOptions } from '../../../types/AttractionPurchases.types';
import { attractionPurchaseService } from '../../../services/AttractionPurchaseService';
import { createPayment } from '../../../services/PaymentService';
import Toast from '../../../components/ui/Toast';
import { getStoredUser } from '../../../utils/storage';
import { locationService } from '../../../services';
import type { Location } from '../../../services/LocationService';
import LocationSelector from '../../../components/admin/LocationSelector';

const ManagePurchases = () => {
  const { themeColor, fullColor } = useThemeColor();
  const currentUser = getStoredUser();
  const isCompanyAdmin = currentUser?.role === 'company_admin';

  // Get auth token from localStorage
  const getAuthToken = () => {
    const userData = localStorage.getItem('zapzone_user');
    if (userData) {
      try {
        const user = JSON.parse(userData);
        return user.token;
      } catch (error) {
        console.error('Error parsing user data:', error);
        return null;
      }
    }
    return null;
  };

  const [purchases, setPurchases] = useState<AttractionPurchasesPurchase[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  const [filteredPurchases, setFilteredPurchases] = useState<AttractionPurchasesPurchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPurchases, setSelectedPurchases] = useState<string[]>([]);
  const [filters, setFilters] = useState<AttractionPurchasesFilterOptions>({
    status: 'all',
    paymentMethod: 'all',
    search: '',
    dateRange: 'all'
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [showFilters, setShowFilters] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedPurchaseForPayment, setSelectedPurchaseForPayment] = useState<AttractionPurchasesPurchase | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'cash'>('cash');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [processingPayment, setProcessingPayment] = useState(false);

  // Status colors and icons
  const statusConfig = {
    confirmed: { color: `bg-${themeColor}-100 text-${fullColor}`, icon: CheckCircle },
    pending: { color: 'bg-yellow-100 text-yellow-800', icon: Clock },
    cancelled: { color: 'bg-red-100 text-red-800', icon: XCircle },
    refunded: { color: `bg-${themeColor}-100 text-${fullColor}`, icon: CheckCircle }
  };

  // Calculate metrics data
  const metrics = [
    {
      title: 'Total Purchases',
      value: purchases.length.toString(),
      change: `${purchases.filter(p => p.status === 'confirmed').length} confirmed`,
      accent: `bg-${themeColor}-100 text-${fullColor}`,
      icon: CreditCard,
    },
    {
      title: 'Total Revenue',
      value: `$${purchases.reduce((sum, p) => sum + p.totalAmount, 0).toFixed(2)}`,
      change: 'All time revenue',
      accent: `bg-${themeColor}-100 text-${fullColor}`,
      icon: CheckCircle,
    },
    {
      title: 'Avg. Purchase',
      value: purchases.length > 0 
        ? `$${(purchases.reduce((sum, p) => sum + p.totalAmount, 0) / purchases.length).toFixed(2)}` 
        : '$0.00',
      change: 'Per transaction',
      accent: `bg-${themeColor}-100 text-${fullColor}`,
      icon: Download,
    },
    {
      title: 'Unique Customers',
      value: new Set(purchases.map(p => p.email)).size.toString(),
      change: 'Total customers',
      accent: `bg-${themeColor}-100 text-${fullColor}`,
      icon: User,
    }
  ];

  const loadPurchases = async () => {
    try {
      setLoading(true);
      const authToken = getAuthToken();
      console.log('🔐 Loading purchases - Auth Token:', authToken ? 'Present' : 'Missing');
      const response = await attractionPurchaseService.getPurchases({
        per_page: 100,
        user_id: getStoredUser()?.id,
        ...(selectedLocation && { location_id: Number(selectedLocation) })
      });

      // Convert API format to component format
      const convertedPurchases: AttractionPurchasesPurchase[] = response.data.purchases.map((purchase: any) => ({
        id: purchase.id.toString(),
        type: 'attraction',
        attractionName: purchase.attraction?.name || 'Unknown Attraction',
        customerName: purchase.customer 
          ? `${purchase.customer.first_name} ${purchase.customer.last_name}`
          : purchase.guest_name || 'Walk-in Customer',
        email: purchase.customer?.email || purchase.guest_email || '',
        phone: purchase.customer?.phone || purchase.guest_phone || '',
        quantity: purchase.quantity,
        status: purchase.status === 'completed' ? 'confirmed' : purchase.status as 'confirmed' | 'pending' | 'cancelled' | 'refunded',
        totalAmount: Number(purchase.total_amount),
        amountPaid: Number(purchase.amount_paid || 0),
        createdAt: purchase.created_at,
        paymentMethod: purchase.payment_method === 'e-wallet' ? 'paypal' : 
                      purchase.payment_method === 'credit' ? 'credit_card' : 
                      purchase.payment_method as 'credit_card' | 'paypal',
        duration: purchase.attraction?.duration ? `${purchase.attraction.duration} ${purchase.attraction.duration_unit || 'minutes'}` : '',
        activity: purchase.attraction?.category || '',
        locationId: purchase.location_id,
      }));

      setPurchases(convertedPurchases);
    } catch (error) {
      console.error('Error loading purchases:', error);
      setToast({ message: 'Failed to load purchases', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const fetchLocations = async () => {
    if (!isCompanyAdmin) return;
    
    try {
      const response = await locationService.getLocations();
      const locationsArray = Array.isArray(response.data) ? response.data : [];
      setLocations(locationsArray);
    } catch (error) {
      console.error('Error fetching locations:', error);
      setLocations([]);
    }
  };

  const applyFilters = useCallback(() => {
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
  }, [purchases, filters]);

  // Load purchases from backend
  useEffect(() => {
    loadPurchases();
  }, [selectedLocation]);

  // Fetch locations on mount
  useEffect(() => {
    fetchLocations();
  }, []);

  // Apply filters when purchases or filters change
  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  const handleFilterChange = (key: keyof AttractionPurchasesFilterOptions, value: string) => {
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

  const handleStatusChange = async (id: string, newStatus: AttractionPurchasesPurchase['status']) => {
    try {
      // Map frontend status to backend status
      let backendStatus: 'pending' | 'completed' | 'cancelled';
      if (newStatus === 'confirmed') {
        backendStatus = 'completed';
      } else if (newStatus === 'refunded') {
        backendStatus = 'cancelled'; // Map refunded to cancelled in backend
      } else {
        backendStatus = newStatus as 'pending' | 'cancelled';
      }

      await attractionPurchaseService.updatePurchase(Number(id), {
        status: backendStatus,
      });

      setToast({ message: 'Status updated successfully', type: 'success' });
      loadPurchases(); // Reload the list
    } catch (error) {
      console.error('Error updating status:', error);
      setToast({ message: 'Failed to update status', type: 'error' });
    }
  };

  const handleDeletePurchase = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this purchase record?')) {
      try {
        await attractionPurchaseService.deletePurchase(Number(id));
        setToast({ message: 'Purchase deleted successfully', type: 'success' });
        loadPurchases(); // Reload the list
      } catch (error) {
        console.error('Error deleting purchase:', error);
        setToast({ message: 'Failed to delete purchase', type: 'error' });
      }
    }
  };

  const handleBulkDelete = async () => {
    if (selectedPurchases.length === 0) return;
    
    if (window.confirm(`Are you sure you want to delete ${selectedPurchases.length} purchase record(s)?`)) {
      try {
        // Delete each purchase
        await Promise.all(
          selectedPurchases.map(id => attractionPurchaseService.deletePurchase(Number(id)))
        );
        setToast({ message: `${selectedPurchases.length} purchase(s) deleted successfully`, type: 'success' });
        setSelectedPurchases([]);
        loadPurchases(); // Reload the list
      } catch (error) {
        console.error('Error deleting purchases:', error);
        setToast({ message: 'Failed to delete some purchases', type: 'error' });
      }
    }
  };

  const handleBulkStatusChange = async (newStatus: AttractionPurchasesPurchase['status']) => {
    if (selectedPurchases.length === 0) return;
    
    try {
      // Map frontend status to backend status
      let backendStatus: 'pending' | 'completed' | 'cancelled';
      if (newStatus === 'confirmed') {
        backendStatus = 'completed';
      } else if (newStatus === 'refunded') {
        backendStatus = 'cancelled';
      } else {
        backendStatus = newStatus as 'pending' | 'cancelled';
      }

      // Update each purchase's status
      await Promise.all(
        selectedPurchases.map(id => 
          attractionPurchaseService.updatePurchase(Number(id), {
            status: backendStatus,
          })
        )
      );
      setToast({ message: `${selectedPurchases.length} purchase(s) updated successfully`, type: 'success' });
      setSelectedPurchases([]);
      loadPurchases(); // Reload the list
    } catch (error) {
      console.error('Error updating purchases:', error);
      setToast({ message: 'Failed to update some purchases', type: 'error' });
    }
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

  const handleOpenPaymentModal = (purchase: AttractionPurchasesPurchase) => {
    setSelectedPurchaseForPayment(purchase);
    setPaymentAmount(purchase.totalAmount.toFixed(2));
    setPaymentMethod('cash');
    setPaymentNotes('');
    setShowPaymentModal(true);
  };

  const handleClosePaymentModal = () => {
    setShowPaymentModal(false);
    setSelectedPurchaseForPayment(null);
    setPaymentAmount('');
    setPaymentMethod('cash');
    setPaymentNotes('');
  };

  const handleSubmitPayment = async () => {
    if (!selectedPurchaseForPayment) return;
    
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      setToast({ message: 'Please enter a valid payment amount', type: 'error' });
      return;
    }

    if (amount > selectedPurchaseForPayment.totalAmount) {
      setToast({ message: `Payment amount cannot exceed total amount of $${selectedPurchaseForPayment.totalAmount.toFixed(2)}`, type: 'error' });
      return;
    }

    try {
      setProcessingPayment(true);

      // Get purchase details to find customer_id and location_id
      const purchaseResponse = await attractionPurchaseService.getPurchaseById(Number(selectedPurchaseForPayment.id));
      if (!purchaseResponse.success || !purchaseResponse.data) {
        throw new Error('Failed to get purchase details');
      }

      const purchase = purchaseResponse.data;
      const customerId = purchase.customer_id || null;
      // Use purchase location_id, or fallback to selected location, or user's location_id
      const locationId = purchase.location_id || 
                        (selectedLocation ? Number(selectedLocation) : null) || 
                        currentUser?.location_id;

      if (!locationId) {
        throw new Error('Location ID not found. Please select a location or contact support.');
      }

      // Create payment record using PaymentService
      const paymentResponse = await createPayment({
        attraction_purchase_id: Number(selectedPurchaseForPayment.id),
        customer_id: customerId,
        location_id: locationId,
        amount: amount,
        currency: 'USD',
        method: paymentMethod,
        status: 'completed',
        notes: paymentNotes || `Payment for attraction purchase #${selectedPurchaseForPayment.id}`,
      });

      if (!paymentResponse.success) {
        throw new Error(paymentResponse.message || 'Failed to create payment');
      }

      // Update purchase status, amount paid, and payment method
      await attractionPurchaseService.updatePurchase(Number(selectedPurchaseForPayment.id), {
        status: 'completed',
        amount_paid: amount,
        payment_method: paymentMethod,
      });

      setToast({ message: 'Payment processed successfully!', type: 'success' });
      handleClosePaymentModal();
      loadPurchases(); // Reload to get fresh data
    } catch (error) {
      console.error('Error processing payment:', error);
      setToast({ message: 'Failed to process payment. Please try again.', type: 'error' });
    } finally {
      setProcessingPayment(false);
    }
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
      <div className="min-h-screen flex items-center justify-center">
        <div className={`animate-spin rounded-full h-12 w-12 border-b-2 border-${fullColor}`}></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-6 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Manage Purchases</h1>
          <p className="text-gray-600 mt-2">View and manage all customer purchases</p>
        </div>
        <div className="mt-4 sm:mt-0 flex gap-2">
          {isCompanyAdmin && (
            <LocationSelector
              locations={locations}
              selectedLocation={selectedLocation}
              onLocationChange={setSelectedLocation}
              themeColor={themeColor}
              fullColor={fullColor}
              variant="compact"
              showAllOption={true}
            />
          )}
          <button
            onClick={exportToCSV}
            className={`inline-flex items-center px-4 py-2 bg-${themeColor}-600 text-white rounded-lg hover:bg-${themeColor}-700 transition-colors`}
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
                <CounterAnimation value={metric.value} className="text-2xl font-bold text-gray-900" />
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
              className={`pl-9 pr-3 py-2 border border-gray-200 rounded-lg w-full focus:ring-2 focus:ring-${themeColor}-400 focus:border-${themeColor}-400`}
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
                  className={`w-full border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-${themeColor}-400 focus:border-${themeColor}-400`}
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
                  className={`w-full border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-${themeColor}-400 focus:border-${themeColor}-400`}
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
                  className={`w-full border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-${themeColor}-400 focus:border-${themeColor}-400`}
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
        <div className={`bg-${themeColor}-50 p-4 rounded-lg mb-6 flex flex-wrap items-center gap-4`}>
          <span className={`text-${fullColor} font-medium`}>
            {selectedPurchases.length} purchase(s) selected
          </span>
          <div className="flex gap-2">
            <select
              onChange={(e) => handleBulkStatusChange(e.target.value as AttractionPurchasesPurchase['status'])}
              className={`border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-${themeColor}-400`}
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
                    className={`rounded border-gray-300 text-${fullColor} focus:ring-${themeColor}-400`}
                  />
                </th>
                <th scope="col" className="px-6 py-4 font-medium">Customer</th>
                <th scope="col" className="px-6 py-4 font-medium">Attraction</th>
                <th scope="col" className="px-6 py-4 font-medium">Quantity</th>
                <th scope="col" className="px-6 py-4 font-medium">Total</th>
                <th scope="col" className="px-6 py-4 font-medium">Paid</th>
                <th scope="col" className="px-6 py-4 font-medium">Payment</th>
                <th scope="col" className="px-6 py-4 font-medium">Date</th>
                <th scope="col" className="px-6 py-4 font-medium">Status</th>
                <th scope="col" className="px-6 py-4 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {currentPurchases.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-6 py-8 text-center text-gray-800">
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
                          className={`rounded border-gray-300 text-${fullColor} focus:ring-${themeColor}-400`}
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
                        <span className={purchase.amountPaid >= purchase.totalAmount ? 'text-green-600 font-semibold' : 'text-orange-600'}>
                          ${purchase.amountPaid.toFixed(2)}
                        </span>
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
                          onChange={(e) => handleStatusChange(purchase.id, e.target.value as AttractionPurchasesPurchase['status'])}
                          className={`text-xs font-medium px-3 py-1 rounded-full ${statusConfig[purchase.status].color} border-none focus:ring-2 focus:ring-${themeColor}-400`}
                        >
                          <option value="confirmed">Confirmed</option>
                          <option value="pending">Pending</option>
                          <option value="cancelled">Cancelled</option>
                          <option value="refunded">Refunded</option>
                        </select>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          {purchase.status === 'pending' && (
                            <button
                              onClick={() => handleOpenPaymentModal(purchase)}
                              className={`text-${fullColor} hover:text-${themeColor}-900`}
                              title="Process Payment"
                            >
                              <DollarSign className="h-4 w-4" />
                            </button>
                          )}
                          <Link
                            to={`/attractions/purchases/${purchase.id}`}
                            className={`text-${fullColor} hover:text-${themeColor}-900`}
                            title="View Details"
                          >
                            <Eye className="h-4 w-4" />
                          </Link>
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
                        ? `border-${fullColor} bg-${fullColor} text-white`
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

      {/* Payment Modal */}
      {showPaymentModal && selectedPurchaseForPayment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-backdrop-fade">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4">
            <div className={`p-6 border-b border-gray-100 bg-${themeColor}-50`}>
              <h2 className="text-2xl font-bold text-gray-900">Process Payment</h2>
              <p className="text-sm text-gray-600 mt-1">
                Purchase ID: {selectedPurchaseForPayment.id}
              </p>
            </div>

            <div className="p-6 space-y-4">
              {/* Payment Summary */}
              <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Customer:</span>
                  <span className="font-semibold">{selectedPurchaseForPayment.customerName}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Attraction:</span>
                  <span className="font-semibold">{selectedPurchaseForPayment.attractionName}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Quantity:</span>
                  <span className="font-semibold">{selectedPurchaseForPayment.quantity}</span>
                </div>
                <div className="flex justify-between text-sm pt-2 border-t border-gray-200">
                  <span className="text-gray-900 font-medium">Total Amount:</span>
                  <span className="font-bold text-green-600">
                    ${selectedPurchaseForPayment.totalAmount.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Payment Amount */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Payment Amount *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={selectedPurchaseForPayment.totalAmount.toFixed(2)}
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    className={`w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-transparent`}
                    placeholder="0.00"
                  />
                </div>
              </div>

              {/* Payment Method */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Payment Method *
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as 'card' | 'cash')}
                  className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-transparent`}
                >
                  <option value="cash">Cash</option>
                  <option value="card">Card</option>
                </select>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notes (Optional)
                </label>
                <textarea
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  rows={3}
                  className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-transparent`}
                  placeholder="Add any notes about this payment..."
                />
              </div>
            </div>

            <div className="p-6 border-t border-gray-100 flex gap-3 justify-end">
              <button
                onClick={handleClosePaymentModal}
                disabled={processingPayment}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitPayment}
                disabled={processingPayment || !paymentAmount || parseFloat(paymentAmount) <= 0}
                className={`px-4 py-2 bg-${fullColor} text-white rounded-lg hover:bg-${themeColor}-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2`}
              >
                {processingPayment ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    Processing...
                  </>
                ) : (
                  'Process Payment'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManagePurchases;