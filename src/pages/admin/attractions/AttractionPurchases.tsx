import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Trash2,
  RefreshCcw,
  Download,
  User,
  CreditCard,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  DollarSign,
  RotateCcw,
  Archive
} from 'lucide-react';
import { formatDurationDisplay, convertTo12Hour } from '../../../utils/timeFormat';
import { useThemeColor } from '../../../hooks/useThemeColor';
import CounterAnimation from '../../../components/ui/CounterAnimation';
import type { AttractionPurchasesPurchase } from '../../../types/AttractionPurchases.types';
import { attractionPurchaseService } from '../../../services/AttractionPurchaseService';
import { attractionPurchaseCacheService } from '../../../services/AttractionPurchaseCacheService';
import { createPayment, PAYMENT_TYPE } from '../../../services/PaymentService';
import Toast from '../../../components/ui/Toast';
import { getStoredUser } from '../../../utils/storage';
import { useLocationScope } from '../../../contexts/LocationContext';
import StandardButton from '../../../components/ui/StandardButton';
import Pagination from '../../../components/ui/Pagination';
import {
  AdminDataTable,
  AdminTableToolbar,
  BulkActionsBar,
  exportTableCsv,
  useAdminTable,
} from '../../../components/admin/table';
import type { AdminColumn, AdminFilterDef } from '../../../components/admin/table';

const ManagePurchases = () => {
  const { themeColor, fullColor } = useThemeColor();
  const currentUser = getStoredUser();
  const { effectiveLocationId, locations: scopeLocations } = useLocationScope();
  const selectedLocation = effectiveLocationId === null ? '' : String(effectiveLocationId);

  const [purchases, setPurchases] = useState<AttractionPurchasesPurchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedPurchaseForPayment, setSelectedPurchaseForPayment] = useState<AttractionPurchasesPurchase | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'in-store'>('in-store');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [processingPayment, setProcessingPayment] = useState(false);

  const [showTrashed, setShowTrashed] = useState(false);
  const [trashedPurchases, setTrashedPurchases] = useState<AttractionPurchasesPurchase[]>([]);
  const [trashedLoading, setTrashedLoading] = useState(false);
  const [trashedCurrentPage, setTrashedCurrentPage] = useState(1);
  const [trashedTotalPages, setTrashedTotalPages] = useState(1);
  const [trashedTotal, setTrashedTotal] = useState(0);
  const [selectedTrashed, setSelectedTrashed] = useState<string[]>([]);
  const itemsPerPage = 10;

  const statusConfig: Record<string, { color: string; icon: typeof CheckCircle }> = {
    confirmed: { color: `bg-blue-100 text-blue-800`, icon: CheckCircle },
    'checked-in': { color: 'bg-green-100 text-green-800', icon: CheckCircle },
    pending: { color: 'bg-yellow-100 text-yellow-800', icon: Clock },
    cancelled: { color: 'bg-gray-100 text-gray-800', icon: XCircle },
    refunded: { color: 'bg-purple-100 text-purple-800', icon: XCircle },
    voided: { color: 'bg-red-100 text-red-800', icon: XCircle }
  };

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
      value: `$${purchases.reduce((sum, p) => sum + p.amountPaid, 0).toFixed(2)}`,
      change: 'All time revenue',
      accent: `bg-${themeColor}-100 text-${fullColor}`,
      icon: CheckCircle,
    },
    {
      title: 'Avg. Purchase',
      value: purchases.length > 0
        ? `$${(purchases.reduce((sum, p) => sum + p.amountPaid, 0) / purchases.length).toFixed(2)}`
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

  const convertPurchases = (rawPurchases: any[]): AttractionPurchasesPurchase[] => {
    return rawPurchases.map((purchase: any) => ({
      id: purchase.id.toString(),
      type: 'attraction',
      attractionName: purchase.attraction?.name || 'Unknown Attraction',
      customerName: purchase.customer
        ? `${purchase.customer.first_name} ${purchase.customer.last_name}`
        : purchase.guest_name || 'Walk-in Customer',
      email: purchase.customer?.email || purchase.guest_email || '',
      phone: purchase.customer?.phone || purchase.guest_phone || '',
      quantity: purchase.quantity,
      status: purchase.status === 'completed' ? 'confirmed' : purchase.status as 'confirmed' | 'pending' | 'checked-in' | 'cancelled' | 'refunded',
      totalAmount: Number(purchase.total_amount),
      amountPaid: Number(purchase.amount_paid || 0),
      createdAt: purchase.created_at,
      paymentMethod: purchase.payment_method as string,
      duration: purchase.attraction?.duration ? formatDurationDisplay(purchase.attraction.duration, purchase.attraction.duration_unit) : '',
      activity: purchase.attraction?.category || '',
      locationId: purchase.location_id,
      scheduledDate: purchase.scheduled_date || null,
      scheduledTime: purchase.scheduled_time || null,
    }));
  };

  const loadPurchases = async (skipCache: boolean = false) => {
    const params: any = {
      per_page: 100,
      user_id: getStoredUser()?.id,
      ...(selectedLocation && { location_id: Number(selectedLocation) })
    };

    try {
      setLoading(true);

      if (!skipCache) {
        const cacheFilters: any = {};
        if (selectedLocation) cacheFilters.location_id = Number(selectedLocation);
        const cached = Object.keys(cacheFilters).length > 0
          ? await attractionPurchaseCacheService.getFilteredPurchasesFromCache(cacheFilters)
          : await attractionPurchaseCacheService.getCachedPurchases();
        if (cached && cached.length > 0) {
          setPurchases(convertPurchases(cached));
          setLoading(false);
        }
      }

      let allRawPurchases: any[] = [];
      let currentPage = 1;
      let lastPage = 1;

      do {
        const response = await attractionPurchaseService.getPurchases({ ...params, page: currentPage });
        const batch = response.data.purchases || [];
        allRawPurchases = allRawPurchases.concat(batch);
        lastPage = response.data.pagination?.last_page ?? 1;
        currentPage++;
      } while (currentPage <= lastPage);

      await attractionPurchaseCacheService.cachePurchases(allRawPurchases, {
        locationId: selectedLocation ? Number(selectedLocation) : undefined,
        userId: getStoredUser()?.id,
      });

      setPurchases(convertPurchases(allRawPurchases));
    } catch (error) {
      console.error('Error loading purchases:', error);
      const cached = await attractionPurchaseCacheService.getCachedPurchases();
      if (cached && cached.length > 0) {
        setPurchases(convertPurchases(cached));
      } else {
        setToast({ message: 'Failed to load purchases', type: 'error' });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPurchases();
  }, [selectedLocation]);

  useEffect(() => {
    const unsubscribe = attractionPurchaseCacheService.onCacheUpdate(async () => {
      const cacheFilters: any = {};
      if (selectedLocation) cacheFilters.location_id = Number(selectedLocation);
      const cached = Object.keys(cacheFilters).length > 0
        ? await attractionPurchaseCacheService.getFilteredPurchasesFromCache(cacheFilters)
        : await attractionPurchaseCacheService.getCachedPurchases();
      if (cached) {
        setPurchases(convertPurchases(cached));
      }
    });
    return unsubscribe;
  }, [selectedLocation]);

  const handleStatusChange = async (id: string, newStatus: AttractionPurchasesPurchase['status']) => {
    try {
      const updateResponse = await attractionPurchaseService.updatePurchase(Number(id), {
        status: newStatus as any,
      });

      if (updateResponse.data) {
        await attractionPurchaseCacheService.updatePurchaseInCache(updateResponse.data);
      }

      setToast({ message: 'Status updated successfully', type: 'success' });
      loadPurchases(true);
    } catch (error) {
      console.error('Error updating status:', error);
      setToast({ message: 'Failed to update status', type: 'error' });
    }
  };

  const handleDeletePurchase = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this purchase record?')) {
      try {
        await attractionPurchaseService.deletePurchase(Number(id));
        await attractionPurchaseCacheService.removePurchaseFromCache(Number(id));
        setToast({ message: 'Purchase deleted successfully', type: 'success' });
        loadPurchases(true);
      } catch (error) {
        console.error('Error deleting purchase:', error);
        setToast({ message: 'Failed to delete purchase', type: 'error' });
      }
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const columns: AdminColumn<AttractionPurchasesPurchase>[] = [
    {
      key: 'id',
      label: 'Purchase #',
      group: 'Identifiers',
      sortable: true,
      sortValue: p => Number(p.id),
      exportValue: p => p.id,
      defaultVisible: false,
      render: p => <span className="text-sm text-gray-900">#{p.id}</span>,
    },
    {
      key: 'customer',
      label: 'Customer',
      group: 'Customer',
      sortable: true,
      sortValue: p => p.customerName,
      exportValue: p => p.customerName,
      render: p => (
        <div>
          <div className="text-sm font-medium text-gray-900">{p.customerName}</div>
          <div className="text-xs text-gray-600 mt-1">{p.email}</div>
          <div className="text-xs text-gray-500 mt-1">{p.phone}</div>
        </div>
      ),
    },
    {
      key: 'attraction',
      label: 'Attraction',
      group: 'Purchase',
      sortable: true,
      sortValue: p => p.attractionName,
      exportValue: p => p.attractionName,
      render: p => <span className="whitespace-nowrap text-sm text-gray-900">{p.attractionName}</span>,
    },
    {
      key: 'category',
      label: 'Category',
      group: 'Purchase',
      sortable: true,
      sortValue: p => p.activity,
      exportValue: p => p.activity,
      defaultVisible: false,
      render: p => <span className="whitespace-nowrap text-sm text-gray-900">{p.activity || '—'}</span>,
    },
    {
      key: 'quantity',
      label: 'Quantity',
      group: 'Purchase',
      sortable: true,
      sortValue: p => p.quantity,
      exportValue: p => p.quantity,
      render: p => <span className="whitespace-nowrap text-sm text-gray-900">{p.quantity}</span>,
    },
    {
      key: 'duration',
      label: 'Duration',
      group: 'Purchase',
      sortValue: p => p.duration,
      exportValue: p => p.duration,
      defaultVisible: false,
      render: p => <span className="whitespace-nowrap text-sm text-gray-900">{p.duration || '—'}</span>,
    },
    {
      key: 'total',
      label: 'Total',
      group: 'Payment',
      sortable: true,
      sortValue: p => p.totalAmount,
      exportValue: p => p.totalAmount.toFixed(2),
      render: p => <span className="whitespace-nowrap text-sm text-gray-900">${p.totalAmount.toFixed(2)}</span>,
    },
    {
      key: 'paid',
      label: 'Paid',
      group: 'Payment',
      sortable: true,
      sortValue: p => p.amountPaid,
      exportValue: p => p.amountPaid.toFixed(2),
      render: p => (
        <span className={`whitespace-nowrap text-sm ${p.amountPaid >= p.totalAmount ? 'text-green-600 font-semibold' : 'text-orange-600'}`}>
          ${p.amountPaid.toFixed(2)}
        </span>
      ),
    },
    {
      key: 'paymentMethod',
      label: 'Payment',
      group: 'Payment',
      sortable: true,
      sortValue: p => p.paymentMethod || '',
      exportValue: p => p.paymentMethod,
      render: p => <span className="capitalize whitespace-nowrap text-sm text-gray-900">{(p.paymentMethod || '').replace('_', ' ')}</span>,
    },
    {
      key: 'purchaseDate',
      label: 'Purchase Date',
      group: 'Dates',
      sortable: true,
      sortValue: p => new Date(p.createdAt || 0).getTime(),
      exportValue: p => p.createdAt ? new Date(p.createdAt).toLocaleString() : '',
      render: p => <span className="whitespace-nowrap text-sm text-gray-500">{formatDate(p.createdAt)}</span>,
    },
    {
      key: 'scheduled',
      label: 'Scheduled',
      group: 'Dates',
      sortable: true,
      sortValue: p => (p.scheduledDate ? `${p.scheduledDate.substring(0, 10)} ${p.scheduledTime || ''}` : ''),
      exportValue: p => (p.scheduledDate
        ? `${p.scheduledDate.substring(0, 10)}${p.scheduledTime ? ` ${convertTo12Hour(p.scheduledTime)}` : ''}`
        : ''),
      render: p => p.scheduledDate ? (
        <div className="whitespace-nowrap text-sm text-gray-500">
          <div>{new Date(p.scheduledDate.substring(0, 10) + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
          {p.scheduledTime && (
            <div className="text-xs text-gray-400">{convertTo12Hour(p.scheduledTime)}</div>
          )}
        </div>
      ) : (
        <span className="text-gray-300">—</span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      group: 'Status',
      sortable: true,
      sortValue: p => p.status,
      exportValue: p => p.status,
      render: p => (
        <select
          value={p.status}
          onChange={(e) => handleStatusChange(p.id, e.target.value as AttractionPurchasesPurchase['status'])}
          className={`text-xs font-medium px-3 py-1 rounded-full ${statusConfig[p.status]?.color || 'bg-gray-100 text-gray-800'} border-none focus:ring-2 focus:ring-${themeColor}-600`}
          disabled={p.status === 'checked-in'}
        >
          <option value="confirmed">Confirmed</option>
          <option value="pending">Pending</option>
          <option value="checked-in">Checked In</option>
          <option value="cancelled">Cancelled</option>
          <option value="refunded">Refunded</option>
        </select>
      ),
    },
  ];

  const attractionOptions = useMemo(() => {
    const unique = [...new Set(purchases.map(p => p.attractionName).filter(Boolean))].sort();
    return unique.map(name => ({ value: name, label: name }));
  }, [purchases]);

  const filterDefs: AdminFilterDef<AttractionPurchasesPurchase>[] = useMemo(() => [
    {
      type: 'select',
      key: 'status',
      label: 'Status',
      allLabel: 'All Statuses',
      options: [
        { value: 'confirmed', label: 'Confirmed' },
        { value: 'pending', label: 'Pending' },
        { value: 'checked-in', label: 'Checked In' },
        { value: 'cancelled', label: 'Cancelled' },
        { value: 'refunded', label: 'Refunded' },
      ],
      predicate: (p, value) => p.status === value,
    },
    {
      type: 'select',
      key: 'paymentMethod',
      label: 'Payment Method',
      allLabel: 'All Methods',
      options: [
        { value: 'card', label: 'Card' },
        { value: 'authorize.net', label: 'Authorize.net' },
        { value: 'in-store', label: 'In-Store' },
        { value: 'paylater', label: 'Pay Later' },
      ],
      predicate: (p, value) => p.paymentMethod === value,
    },
    {
      type: 'select',
      key: 'attraction',
      label: 'Attraction',
      allLabel: 'All Attractions',
      options: attractionOptions,
      predicate: (p, value) => p.attractionName === value,
    },
    {
      type: 'daterange',
      key: 'purchaseDate',
      label: 'Purchase Date',
      getDate: p => p.createdAt,
    },
    {
      type: 'daterange',
      key: 'scheduledDate',
      label: 'Scheduled Date',
      getDate: p => p.scheduledDate,
    },
    {
      type: 'numberrange',
      key: 'amount',
      label: 'Total Amount ($)',
      getValue: p => p.totalAmount,
    },
  ], [attractionOptions]);

  const table = useAdminTable<AttractionPurchasesPurchase>({
    data: purchases,
    columns,
    getRowId: p => p.id,
    storageKey: 'attraction_purchases',
    filterDefs,
    searchFields: p => [
      p.id,
      p.customerName,
      p.email,
      p.phone,
      p.attractionName,
      p.activity,
      p.paymentMethod,
      p.status,
    ],
    defaultSort: (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime(),
    itemsPerPage,
  });

  const handleBulkDelete = async () => {
    if (table.selectedIds.length === 0) return;

    if (window.confirm(`Are you sure you want to delete ${table.selectedIds.length} purchase record(s)?`)) {
      try {
        await Promise.all(
          table.selectedIds.map(id => attractionPurchaseService.deletePurchase(Number(id)))
        );
        await Promise.all(
          table.selectedIds.map(id => attractionPurchaseCacheService.removePurchaseFromCache(Number(id)))
        );
        setToast({ message: `${table.selectedIds.length} purchase(s) deleted successfully`, type: 'success' });
        table.clearSelection();
        loadPurchases(true);
      } catch (error) {
        console.error('Error deleting purchases:', error);
        setToast({ message: 'Failed to delete some purchases', type: 'error' });
      }
    }
  };

  const handleBulkStatusChange = async (newStatus: AttractionPurchasesPurchase['status']) => {
    if (table.selectedIds.length === 0) return;

    try {
      await Promise.all(
        table.selectedIds.map(id =>
          attractionPurchaseService.updatePurchase(Number(id), {
            status: newStatus as any,
          })
        )
      );
      setToast({ message: `${table.selectedIds.length} purchase(s) updated successfully`, type: 'success' });
      table.clearSelection();
      loadPurchases(true);
    } catch (error) {
      console.error('Error updating purchases:', error);
      setToast({ message: 'Failed to update some purchases', type: 'error' });
    }
  };

  const exportToCSV = () => {
    exportTableCsv({
      filename: `purchases-export-${new Date().toISOString().split('T')[0]}.csv`,
      columns,
      rows: table.filteredRows,
      extraColumns: [
        { label: 'Email', value: p => p.email },
        { label: 'Phone', value: p => p.phone },
        { label: 'Location', value: p => scopeLocations.find(l => String(l.id) === String(p.locationId))?.name || p.locationId || '' },
      ],
    });
  };

  const handleOpenPaymentModal = (purchase: AttractionPurchasesPurchase) => {
    setSelectedPurchaseForPayment(purchase);
    setPaymentAmount(purchase.totalAmount.toFixed(2));
    setPaymentMethod('in-store');
    setPaymentNotes('');
    setShowPaymentModal(true);
  };

  const handleClosePaymentModal = () => {
    setShowPaymentModal(false);
    setSelectedPurchaseForPayment(null);
    setPaymentAmount('');
    setPaymentMethod('in-store');
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

      const purchaseResponse = await attractionPurchaseService.getPurchaseById(Number(selectedPurchaseForPayment.id));
      if (!purchaseResponse.success || !purchaseResponse.data) {
        throw new Error('Failed to get purchase details');
      }

      const purchase = purchaseResponse.data;
      const customerId = purchase.customer_id || null;
      const locationId = purchase.location_id ||
                        (selectedLocation ? Number(selectedLocation) : null) ||
                        currentUser?.location_id;

      if (!locationId) {
        throw new Error('Location ID not found. Please select a location or contact support.');
      }

      const paymentResponse = await createPayment({
        payable_id: Number(selectedPurchaseForPayment.id),
        payable_type: PAYMENT_TYPE.ATTRACTION_PURCHASE,
        customer_id: customerId,
        location_id: locationId,
        amount: amount,
        currency: 'USD',
        method: paymentMethod === 'in-store' ? 'cash' : paymentMethod,
        status: 'completed',
        notes: paymentNotes || (paymentMethod === 'in-store'
          ? `In-store payment for attraction purchase #${selectedPurchaseForPayment.id}`
          : `Payment for attraction purchase #${selectedPurchaseForPayment.id}`),
      });

      if (!paymentResponse.success) {
        throw new Error(paymentResponse.message || 'Failed to create payment');
      }

      await attractionPurchaseService.updatePurchase(Number(selectedPurchaseForPayment.id), {
        amount_paid: amount,
        payment_method: paymentMethod,
      });

      setToast({ message: 'Payment processed successfully!', type: 'success' });
      handleClosePaymentModal();
      loadPurchases(true);
    } catch (error) {
      console.error('Error processing payment:', error);
      setToast({ message: 'Failed to process payment. Please try again.', type: 'error' });
    } finally {
      setProcessingPayment(false);
    }
  };

  const convertTrashedPurchases = (rawPurchases: any[]): AttractionPurchasesPurchase[] => {
    return rawPurchases.map((purchase: any) => ({
      id: purchase.id.toString(),
      type: 'attraction',
      attractionName: purchase.attraction?.name || 'Unknown Attraction',
      customerName: purchase.customer
        ? `${purchase.customer.first_name} ${purchase.customer.last_name}`
        : purchase.guest_name || 'Walk-in Customer',
      email: purchase.customer?.email || purchase.guest_email || '',
      phone: purchase.customer?.phone || purchase.guest_phone || '',
      quantity: purchase.quantity,
      status: purchase.status as 'confirmed' | 'pending' | 'checked-in' | 'cancelled' | 'refunded',
      totalAmount: Number(purchase.total_amount),
      amountPaid: Number(purchase.amount_paid || 0),
      createdAt: purchase.created_at,
      deletedAt: purchase.deleted_at,
      paymentMethod: purchase.payment_method as string,
      duration: purchase.attraction?.duration ? formatDurationDisplay(purchase.attraction.duration, purchase.attraction.duration_unit) : '',
      activity: purchase.attraction?.category || '',
      locationId: purchase.location_id,
      scheduledDate: purchase.scheduled_date || null,
      scheduledTime: purchase.scheduled_time || null,
    })) as AttractionPurchasesPurchase[];
  };

  const loadTrashedPurchases = async (page: number = 1) => {
    try {
      setTrashedLoading(true);
      const response = await attractionPurchaseService.getTrashedPurchases({
        page,
        per_page: itemsPerPage,
        search: table.searchInput,
        user_id: getStoredUser()?.id,
        ...(selectedLocation && { location_id: Number(selectedLocation) })
      });

      if (response.success && response.data) {
        setTrashedPurchases(convertTrashedPurchases(response.data.purchases));
        setTrashedTotalPages(response.data.pagination.last_page);
        setTrashedTotal(response.data.pagination.total);
        setTrashedCurrentPage(response.data.pagination.current_page);
      }
    } catch (error) {
      console.error('Error loading trashed purchases:', error);
      setToast({ message: 'Failed to load deleted purchases', type: 'error' });
    } finally {
      setTrashedLoading(false);
    }
  };

  const handleRestorePurchase = async (id: string) => {
    try {
      const response = await attractionPurchaseService.restorePurchase(Number(id));
      if (response.success) {
        setToast({ message: 'Purchase restored successfully', type: 'success' });
        loadTrashedPurchases(trashedCurrentPage);
        if (response.data) {
          await attractionPurchaseCacheService.updatePurchaseInCache(response.data);
        }
      }
    } catch (error) {
      console.error('Error restoring purchase:', error);
      setToast({ message: 'Failed to restore purchase', type: 'error' });
    }
  };

  const handleBulkRestore = async () => {
    if (selectedTrashed.length === 0) return;

    try {
      const ids = selectedTrashed.map(id => Number(id));
      const response = await attractionPurchaseService.bulkRestore(ids);
      if (response.success) {
        setToast({ message: `${response.data.restored_count} purchase(s) restored successfully`, type: 'success' });
        setSelectedTrashed([]);
        loadTrashedPurchases(trashedCurrentPage);
      }
    } catch (error) {
      console.error('Error bulk restoring purchases:', error);
      setToast({ message: 'Failed to restore some purchases', type: 'error' });
    }
  };

  const handleForceDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to PERMANENTLY delete this purchase? This action cannot be undone.')) {
      return;
    }

    try {
      await attractionPurchaseService.forceDeletePurchase(Number(id));
      setToast({ message: 'Purchase permanently deleted', type: 'success' });
      loadTrashedPurchases(trashedCurrentPage);
    } catch (error) {
      console.error('Error force deleting purchase:', error);
      setToast({ message: 'Failed to permanently delete purchase', type: 'error' });
    }
  };

  const toggleTrashedView = () => {
    setShowTrashed(!showTrashed);
    if (!showTrashed) {
      loadTrashedPurchases(1);
    }
    setSelectedTrashed([]);
  };

  const handleSelectTrashed = (id: string) => {
    setSelectedTrashed(prev =>
      prev.includes(id)
        ? prev.filter(purchaseId => purchaseId !== id)
        : [...prev, id]
    );
  };

  const handleSelectAllTrashed = () => {
    if (selectedTrashed.length === trashedPurchases.length) {
      setSelectedTrashed([]);
    } else {
      setSelectedTrashed(trashedPurchases.map(p => p.id));
    }
  };

  return (
    <div className="min-h-screen px-6 py-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Manage Purchases</h1>
          <p className="text-gray-600 mt-2">View and manage all customer purchases</p>
        </div>
        <div className="mt-4 sm:mt-0 flex gap-2">
          <StandardButton
            variant={showTrashed ? 'primary' : 'secondary'}
            size="md"
            onClick={toggleTrashedView}
            icon={showTrashed ? RefreshCcw : Archive}
          >
            {showTrashed ? 'View Active' : 'View Deleted'}
          </StandardButton>
          {!showTrashed && (
            <StandardButton
              variant="primary"
              size="md"
              onClick={exportToCSV}
              icon={Download}
            >
              Export CSV
            </StandardButton>
          )}
        </div>
      </div>

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

      {!showTrashed && (
        <>
          <AdminTableToolbar
            table={table}
            searchPlaceholder="Search purchases..."
            onRefresh={() => loadPurchases(true)}
          />

          <BulkActionsBar table={table} itemLabel="purchase(s)">
            <select
              onChange={(e) => handleBulkStatusChange(e.target.value as AttractionPurchasesPurchase['status'])}
              className={`border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-${themeColor}-400`}
            >
              <option value="">Change Status</option>
              <option value="confirmed">Confirm</option>
              <option value="checked-in">Check In</option>
              <option value="cancelled">Cancel</option>
              <option value="refunded">Refund</option>
            </select>
            <StandardButton
              variant="danger"
              size="md"
              onClick={handleBulkDelete}
              icon={Trash2}
            >
              Delete
            </StandardButton>
          </BulkActionsBar>

          <AdminDataTable
            table={table}
            loading={loading && purchases.length === 0}
            selectable
            itemLabel="purchases"
            emptyMessage="No purchases found"
            renderActions={(purchase) => (
              <div className="flex items-center gap-1">
                {purchase.status === 'pending' && purchase.amountPaid < purchase.totalAmount && (
                  <button
                    onClick={() => handleOpenPaymentModal(purchase)}
                    className="p-2 text-green-600 hover:text-green-700 hover:bg-green-50 rounded-lg transition-colors"
                    title="Process Payment"
                  >
                    <DollarSign className="h-4 w-4" />
                  </button>
                )}
                <Link
                  to={`/attractions/purchases/${purchase.id}?from=purchases`}
                  className={`p-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors`}
                  title="View Details"
                >
                  <Eye className="h-4 w-4" />
                </Link>
                <button
                  onClick={() => handleDeletePurchase(purchase.id)}
                  className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                  title="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            )}
          />
        </>
      )}

      {showTrashed && (
        <>
          {selectedTrashed.length > 0 && (
            <div className="bg-orange-50 p-4 rounded-lg mb-6 flex flex-wrap items-center gap-4">
              <span className="text-orange-700 font-medium">
                {selectedTrashed.length} deleted purchase(s) selected
              </span>
              <StandardButton
                variant="primary"
                size="md"
                onClick={handleBulkRestore}
                icon={RotateCcw}
              >
                Restore Selected
              </StandardButton>
            </div>
          )}

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            {trashedLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className={`animate-spin rounded-full h-8 w-8 border-b-2 border-${fullColor}`}></div>
                <span className="ml-3 text-gray-600">Loading deleted purchases...</span>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-red-50 border-b border-red-100">
                    <tr>
                      <th scope="col" className="px-4 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-12">
                        <input
                          type="checkbox"
                          checked={selectedTrashed.length === trashedPurchases.length && trashedPurchases.length > 0}
                          onChange={handleSelectAllTrashed}
                          className="rounded border-gray-300 text-red-600 focus:ring-red-600"
                        />
                      </th>
                      <th scope="col" className="px-4 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Customer</th>
                      <th scope="col" className="px-4 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Attraction</th>
                      <th scope="col" className="px-4 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Total</th>
                      <th scope="col" className="px-4 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                      <th scope="col" className="px-4 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Deleted At</th>
                      <th scope="col" className="px-4 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {trashedPurchases.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-600">
                          <Archive className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                          No deleted purchases found
                        </td>
                      </tr>
                    ) : (
                      trashedPurchases.map((purchase: any) => (
                        <tr key={purchase.id} className="hover:bg-red-50/50">
                          <td className="px-4 py-4 whitespace-nowrap">
                            <input
                              type="checkbox"
                              checked={selectedTrashed.includes(purchase.id)}
                              onChange={() => handleSelectTrashed(purchase.id)}
                              className="rounded border-gray-300 text-red-600 focus:ring-red-600"
                            />
                          </td>
                          <td className="px-4 py-4">
                            <div>
                              <div className="text-sm font-medium text-gray-900">{purchase.customerName}</div>
                              <div className="text-xs text-gray-600 mt-1">{purchase.email}</div>
                            </div>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                            {purchase.attractionName}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                            ${purchase.totalAmount.toFixed(2)}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            <span className={`text-xs font-medium px-3 py-1 rounded-full ${statusConfig[purchase.status]?.color || 'bg-gray-100 text-gray-800'}`}>
                              {purchase.status}
                            </span>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-red-600">
                            {purchase.deletedAt ? formatDate(purchase.deletedAt) : 'N/A'}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleRestorePurchase(purchase.id)}
                                className="p-2 text-green-600 hover:text-green-700 hover:bg-green-50 rounded-lg transition-colors"
                                title="Restore"
                              >
                                <RotateCcw className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleForceDelete(purchase.id)}
                                className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                                title="Permanently Delete"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            <div className="bg-white px-4 py-4 border-t border-gray-100">
              <Pagination
                currentPage={trashedCurrentPage}
                totalPages={trashedTotalPages}
                onPageChange={(page) => loadTrashedPurchases(page)}
                totalItems={trashedTotal}
                itemsPerPage={itemsPerPage}
              />
            </div>
          </div>
        </>
      )}

      {toast && (
        <div className="fixed top-4 right-4 z-50 animate-fade-in-up">
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(null)}
          />
        </div>
      )}

      {showPaymentModal && selectedPurchaseForPayment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-backdrop-fade" onClick={() => { setShowPaymentModal(false); setSelectedPurchaseForPayment(null); }}>
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className={`p-6 border-b border-gray-100 bg-${themeColor}-50`}>
              <h2 className="text-2xl font-bold text-gray-900">Process Payment</h2>
              <p className="text-sm text-gray-600 mt-1">
                Purchase ID: {selectedPurchaseForPayment.id}
              </p>
            </div>

            <div className="p-6 space-y-4">
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

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Payment Method
                </label>
                <div className={`w-full px-4 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-700 text-sm`}>
                  In-Store
                </div>
              </div>

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
              <StandardButton
                variant="secondary"
                size="md"
                onClick={handleClosePaymentModal}
                disabled={processingPayment}
              >
                Cancel
              </StandardButton>
              <StandardButton
                variant="primary"
                size="md"
                onClick={handleSubmitPayment}
                disabled={processingPayment || !paymentAmount || parseFloat(paymentAmount) <= 0}
                loading={processingPayment}
              >
                Process Payment
              </StandardButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManagePurchases;
