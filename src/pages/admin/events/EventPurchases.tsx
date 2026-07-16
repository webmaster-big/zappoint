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
  Archive,
} from 'lucide-react';
import { convertTo12Hour } from '../../../utils/timeFormat';
import { useThemeColor } from '../../../hooks/useThemeColor';
import CounterAnimation from '../../../components/ui/CounterAnimation';
import { eventPurchaseService } from '../../../services/EventPurchaseService';
import Toast from '../../../components/ui/Toast';
import { getStoredUser } from '../../../utils/storage';
import { useLocationScope } from '../../../contexts/LocationContext';
import StandardButton from '../../../components/ui/StandardButton';
import Pagination from '../../../components/ui/Pagination';
import type { EventPurchase } from '../../../types/event.types';
import {
  AdminDataTable,
  AdminTableToolbar,
  BulkActionsBar,
  exportTableCsv,
  useAdminTable,
} from '../../../components/admin/table';
import type { AdminColumn, AdminFilterDef } from '../../../components/admin/table';

interface DisplayPurchase {
  id: string;
  referenceNumber: string;
  eventName: string;
  customerName: string;
  email: string;
  phone: string;
  quantity: number;
  status: string;
  totalAmount: number;
  amountPaid: number;
  paymentMethod: string;
  paymentStatus: string;
  purchaseDate: string;
  purchaseTime: string;
  createdAt: string;
  locationId: number;
  isGuest: boolean;
  deletedAt?: string;
}

const statusPriority: Record<string, number> = {
  confirmed: 0,
  pending: 1,
  completed: 2,
  'checked-in': 3,
  cancelled: 4,
  refunded: 5,
  voided: 6,
};

const EventPurchases = () => {
  const { themeColor, fullColor } = useThemeColor();
  const currentUser = getStoredUser();
  const { effectiveLocationId, locations: scopeLocations } = useLocationScope();
  const selectedLocation = effectiveLocationId === null ? '' : String(effectiveLocationId);

  const [purchases, setPurchases] = useState<DisplayPurchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const [showTrashed, setShowTrashed] = useState(false);
  const [trashedPurchases, setTrashedPurchases] = useState<DisplayPurchase[]>([]);
  const [trashedLoading, setTrashedLoading] = useState(false);
  const [trashedCurrentPage, setTrashedCurrentPage] = useState(1);
  const [trashedTotalPages, setTrashedTotalPages] = useState(1);
  const [trashedTotal, setTrashedTotal] = useState(0);
  const [selectedTrashed, setSelectedTrashed] = useState<string[]>([]);
  const itemsPerPage = 10;

  const statusConfig: Record<string, { color: string; icon: typeof CheckCircle }> = {
    confirmed: { color: 'bg-blue-100 text-blue-800', icon: CheckCircle },
    'checked-in': { color: 'bg-green-100 text-green-800', icon: CheckCircle },
    pending: { color: 'bg-yellow-100 text-yellow-800', icon: Clock },
    completed: { color: 'bg-emerald-100 text-emerald-800', icon: CheckCircle },
    cancelled: { color: 'bg-gray-100 text-gray-800', icon: XCircle },
    refunded: { color: 'bg-purple-100 text-purple-800', icon: XCircle },
    voided: { color: 'bg-red-100 text-red-800', icon: XCircle },
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
      icon: DollarSign,
    },
    {
      title: 'Unique Customers',
      value: new Set(purchases.map(p => p.email)).size.toString(),
      change: 'Total customers',
      accent: `bg-${themeColor}-100 text-${fullColor}`,
      icon: User,
    },
  ];

  const convertPurchases = (rawPurchases: EventPurchase[]): DisplayPurchase[] => {
    return rawPurchases.map((purchase) => ({
      id: purchase.id.toString(),
      referenceNumber: purchase.reference_number,
      eventName: purchase.event?.name || 'Unknown Event',
      customerName: purchase.customer
        ? `${purchase.customer.first_name} ${purchase.customer.last_name}`
        : purchase.guest_name || 'Walk-in Customer',
      email: purchase.customer?.email || purchase.guest_email || '',
      phone: purchase.customer?.phone || purchase.guest_phone || '',
      quantity: purchase.quantity,
      status: purchase.status,
      totalAmount: Number(purchase.total_amount),
      amountPaid: Number(purchase.amount_paid),
      paymentMethod: purchase.payment_method || 'N/A',
      paymentStatus: purchase.payment_status,
      purchaseDate: purchase.purchase_date,
      purchaseTime: purchase.purchase_time,
      createdAt: purchase.created_at,
      locationId: purchase.location_id,
      isGuest: !purchase.customer,
    }));
  };

  const loadPurchases = async () => {
    try {
      setLoading(true);
      const apiFilters: Record<string, unknown> = {
        per_page: 10000,
        user_id: currentUser?.id,
        ...(selectedLocation && { location_id: Number(selectedLocation) }),
      };
      const result = await eventPurchaseService.getPurchases(apiFilters as never);
      const raw = result as any;
      const rawPurchases: EventPurchase[] = Array.isArray(raw)
        ? raw
        : Array.isArray(raw?.data)
          ? raw.data
          : (raw?.data?.purchases || raw?.data?.event_purchases || []);
      setPurchases(convertPurchases(rawPurchases));
    } catch (error) {
      console.error('Error loading event purchases:', error);
      setToast({ message: 'Failed to load event purchases', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPurchases();
  }, [selectedLocation]);

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      await eventPurchaseService.updateStatus(Number(id), newStatus);
      setToast({ message: 'Status updated successfully', type: 'success' });
      loadPurchases();
    } catch (error) {
      console.error('Error updating status:', error);
      setToast({ message: 'Failed to update status', type: 'error' });
    }
  };

  const handleDeletePurchase = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this purchase record?')) {
      try {
        await eventPurchaseService.deletePurchase(Number(id));
        setToast({ message: 'Purchase deleted successfully', type: 'success' });
        loadPurchases();
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
      minute: '2-digit',
    });
  };

  const columns: AdminColumn<DisplayPurchase>[] = [
    {
      key: 'reference',
      label: 'Reference',
      group: 'Identifiers',
      sortable: true,
      sortValue: p => p.referenceNumber,
      exportValue: p => p.referenceNumber,
      render: p => <span className="whitespace-nowrap text-sm font-mono text-gray-700">{p.referenceNumber}</span>,
    },
    {
      key: 'id',
      label: 'Purchase #',
      group: 'Identifiers',
      sortable: true,
      sortValue: p => Number(p.id),
      exportValue: p => p.id,
      defaultVisible: false,
      render: p => <span className="whitespace-nowrap text-sm text-gray-900">#{p.id}</span>,
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
        </div>
      ),
    },
    {
      key: 'customerType',
      label: 'Customer Type',
      group: 'Customer',
      sortable: true,
      sortValue: p => (p.isGuest ? 'Guest' : 'Registered'),
      exportValue: p => (p.isGuest ? 'Guest' : 'Registered'),
      defaultVisible: false,
      render: p => <span className="whitespace-nowrap text-sm text-gray-700">{p.isGuest ? 'Guest' : 'Registered'}</span>,
    },
    {
      key: 'event',
      label: 'Event',
      group: 'Purchase',
      sortable: true,
      sortValue: p => p.eventName,
      exportValue: p => p.eventName,
      render: p => <span className="whitespace-nowrap text-sm text-gray-900">{p.eventName}</span>,
    },
    {
      key: 'quantity',
      label: 'Qty',
      group: 'Purchase',
      sortable: true,
      sortValue: p => p.quantity,
      exportValue: p => p.quantity,
      render: p => <span className="whitespace-nowrap text-sm text-gray-900">{p.quantity}</span>,
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
      key: 'method',
      label: 'Method',
      group: 'Payment',
      sortable: true,
      sortValue: p => p.paymentMethod || '',
      exportValue: p => p.paymentMethod,
      render: p => (
        <span className="whitespace-nowrap text-sm text-gray-700 capitalize">
          {p.paymentMethod?.replace('_', ' ').replace('.', ' ') || 'N/A'}
        </span>
      ),
    },
    {
      key: 'paymentStatus',
      label: 'Payment Status',
      group: 'Payment',
      sortable: true,
      sortValue: p => p.paymentStatus || '',
      exportValue: p => p.paymentStatus,
      render: p => (
        <span className={`whitespace-nowrap text-xs font-medium px-2 py-1 rounded-full ${
          p.paymentStatus === 'paid' ? 'bg-green-100 text-green-800' :
          p.paymentStatus === 'partial' ? 'bg-orange-100 text-orange-800' :
          p.paymentStatus === 'pending' ? 'bg-yellow-100 text-yellow-800' :
          'bg-gray-100 text-gray-800'
        }`}>
          {p.paymentStatus === 'paid' ? 'Paid' :
           p.paymentStatus === 'partial' ? 'Partial' :
           p.paymentStatus === 'pending' ? 'Pending' :
           p.paymentStatus || 'N/A'}
        </span>
      ),
    },
    {
      key: 'scheduled',
      label: 'Scheduled',
      group: 'Dates',
      sortable: true,
      sortValue: p => (p.purchaseDate ? `${p.purchaseDate.substring(0, 10)} ${p.purchaseTime || ''}` : ''),
      exportValue: p => (p.purchaseDate
        ? `${p.purchaseDate.substring(0, 10)}${p.purchaseTime ? ` ${convertTo12Hour(p.purchaseTime)}` : ''}`
        : ''),
      render: p => p.purchaseDate ? (
        <div className="whitespace-nowrap text-sm text-gray-500">
          <div>{new Date(p.purchaseDate.substring(0, 10) + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
          {p.purchaseTime && (
            <div className="text-xs text-gray-400">{convertTo12Hour(p.purchaseTime)}</div>
          )}
        </div>
      ) : (
        <span className="text-gray-300">—</span>
      ),
    },
    {
      key: 'created',
      label: 'Created',
      group: 'Dates',
      sortable: true,
      sortValue: p => new Date(p.createdAt || 0).getTime(),
      exportValue: p => (p.createdAt ? new Date(p.createdAt).toLocaleString() : ''),
      render: p => <span className="whitespace-nowrap text-sm text-gray-500">{formatDate(p.createdAt)}</span>,
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
          onChange={(e) => handleStatusChange(p.id, e.target.value)}
          className={`text-xs font-medium px-3 py-1 rounded-full ${statusConfig[p.status]?.color || 'bg-gray-100 text-gray-800'} border-none focus:ring-2 focus:ring-${themeColor}-600`}
        >
          <option value="confirmed">Confirmed</option>
          <option value="pending">Pending</option>
          <option value="checked-in">Checked In</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      ),
    },
  ];

  const eventOptions = useMemo(() => {
    const unique = [...new Set(purchases.map(p => p.eventName).filter(Boolean))].sort();
    return unique.map(name => ({ value: name, label: name }));
  }, [purchases]);

  const filterDefs: AdminFilterDef<DisplayPurchase>[] = useMemo(() => [
    {
      type: 'select',
      key: 'status',
      label: 'Status',
      allLabel: 'All Statuses',
      options: [
        { value: 'confirmed', label: 'Confirmed' },
        { value: 'pending', label: 'Pending' },
        { value: 'checked-in', label: 'Checked In' },
        { value: 'completed', label: 'Completed' },
        { value: 'cancelled', label: 'Cancelled' },
        { value: 'refunded', label: 'Refunded' },
        { value: 'voided', label: 'Voided' },
      ],
      predicate: (p, value) => p.status === value,
    },
    {
      type: 'select',
      key: 'event',
      label: 'Event',
      allLabel: 'All Events',
      options: eventOptions,
      predicate: (p, value) => p.eventName === value,
    },
    {
      type: 'select',
      key: 'paymentMethod',
      label: 'Payment Method',
      allLabel: 'All Methods',
      options: [
        { value: 'in-store', label: 'In-Store' },
        { value: 'paylater', label: 'Pay Later' },
        { value: 'authorize.net', label: 'Authorize.net' },
      ],
      predicate: (p, value) => p.paymentMethod === value,
    },
    {
      type: 'select',
      key: 'paymentStatus',
      label: 'Payment Status',
      allLabel: 'All Payment Statuses',
      options: [
        { value: 'paid', label: 'Paid' },
        { value: 'partial', label: 'Partial' },
        { value: 'pending', label: 'Pending' },
      ],
      predicate: (p, value) => p.paymentStatus === value,
    },
    {
      type: 'select',
      key: 'customerType',
      label: 'Customer Type',
      allLabel: 'All Customer Types',
      options: [
        { value: 'registered', label: 'Registered' },
        { value: 'guest', label: 'Guest / Walk-in' },
      ],
      predicate: (p, value) => (value === 'guest' ? p.isGuest : !p.isGuest),
    },
    {
      type: 'select',
      key: 'balance',
      label: 'Balance',
      allLabel: 'All Balances',
      options: [
        { value: 'due', label: 'Balance Due' },
        { value: 'paid', label: 'Paid in Full' },
      ],
      predicate: (p, value) => (value === 'due' ? p.amountPaid < p.totalAmount : p.amountPaid >= p.totalAmount),
    },
    {
      type: 'daterange',
      key: 'createdDate',
      label: 'Created Date',
      getDate: p => p.createdAt,
    },
    {
      type: 'daterange',
      key: 'scheduledDate',
      label: 'Scheduled Date',
      getDate: p => p.purchaseDate,
    },
    {
      type: 'numberrange',
      key: 'amount',
      label: 'Total Amount ($)',
      getValue: p => p.totalAmount,
    },
  ], [eventOptions]);

  const table = useAdminTable<DisplayPurchase>({
    data: purchases,
    columns,
    getRowId: p => p.id,
    storageKey: 'event_purchases',
    filterDefs,
    searchFields: p => [
      p.id,
      p.referenceNumber,
      p.customerName,
      p.email,
      p.phone,
      p.eventName,
      p.paymentMethod,
      p.status,
    ],
    defaultSort: (a, b) => {
      const priorityDiff = (statusPriority[a.status] ?? 3) - (statusPriority[b.status] ?? 3);
      if (priorityDiff !== 0) return priorityDiff;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    },
    itemsPerPage,
  });

  const handleBulkDelete = async () => {
    if (table.selectedIds.length === 0) return;
    if (window.confirm(`Are you sure you want to delete ${table.selectedIds.length} purchase record(s)?`)) {
      try {
        await Promise.all(table.selectedIds.map((id) => eventPurchaseService.deletePurchase(Number(id))));
        setToast({ message: `${table.selectedIds.length} purchase(s) deleted successfully`, type: 'success' });
        table.clearSelection();
        loadPurchases();
      } catch (error) {
        console.error('Error deleting purchases:', error);
        setToast({ message: 'Failed to delete some purchases', type: 'error' });
      }
    }
  };

  const handleBulkStatusChange = async (newStatus: string) => {
    if (table.selectedIds.length === 0 || !newStatus) return;
    try {
      await Promise.all(table.selectedIds.map((id) => eventPurchaseService.updateStatus(Number(id), newStatus)));
      setToast({ message: `${table.selectedIds.length} purchase(s) updated successfully`, type: 'success' });
      table.clearSelection();
      loadPurchases();
    } catch (error) {
      console.error('Error updating purchases:', error);
      setToast({ message: 'Failed to update some purchases', type: 'error' });
    }
  };

  const exportToCSV = () => {
    exportTableCsv({
      filename: `event-purchases-export-${new Date().toISOString().split('T')[0]}.csv`,
      columns,
      rows: table.filteredRows,
      extraColumns: [
        { label: 'Email', value: p => p.email },
        { label: 'Phone', value: p => p.phone },
        { label: 'Balance Due', value: p => (p.totalAmount - p.amountPaid).toFixed(2) },
        { label: 'Location', value: p => scopeLocations.find(l => String(l.id) === String(p.locationId))?.name || p.locationId || '' },
      ],
    });
  };

  const convertTrashedPurchases = (rawPurchases: any[]): DisplayPurchase[] => {
    return rawPurchases.map((purchase: any) => ({
      id: purchase.id.toString(),
      referenceNumber: purchase.reference_number,
      eventName: purchase.event?.name || 'Unknown Event',
      customerName: purchase.customer
        ? `${purchase.customer.first_name} ${purchase.customer.last_name}`
        : purchase.guest_name || 'Walk-in Customer',
      email: purchase.customer?.email || purchase.guest_email || '',
      phone: purchase.customer?.phone || purchase.guest_phone || '',
      quantity: purchase.quantity,
      status: purchase.status,
      totalAmount: Number(purchase.total_amount),
      amountPaid: Number(purchase.amount_paid || 0),
      paymentMethod: purchase.payment_method || 'N/A',
      paymentStatus: purchase.payment_status,
      purchaseDate: purchase.purchase_date,
      purchaseTime: purchase.purchase_time,
      createdAt: purchase.created_at,
      locationId: purchase.location_id,
      isGuest: !purchase.customer,
      deletedAt: purchase.deleted_at,
    }));
  };

  const loadTrashedPurchases = async (page: number = 1) => {
    try {
      setTrashedLoading(true);
      const result = await eventPurchaseService.getTrashedPurchases({
        page,
        per_page: itemsPerPage,
        search: table.searchInput,
        ...(selectedLocation && { location_id: Number(selectedLocation) }),
      });

      const raw = result as any;
      const innerData = Array.isArray(raw) ? raw : (raw?.data ?? raw);
      const rawPurchases = Array.isArray(innerData) ? innerData : (innerData?.purchases || innerData?.data || []);
      const pagination = (innerData as any)?.pagination || (raw as any)?.meta || (result as any)?.meta;

      setTrashedPurchases(convertTrashedPurchases(rawPurchases));
      if (pagination) {
        setTrashedTotalPages(pagination.last_page);
        setTrashedTotal(pagination.total);
        setTrashedCurrentPage(pagination.current_page);
      } else {
        setTrashedTotalPages(1);
        setTrashedTotal(rawPurchases.length);
        setTrashedCurrentPage(1);
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
      const response = await eventPurchaseService.restorePurchase(Number(id));
      if (response.success) {
        setToast({ message: 'Purchase restored successfully', type: 'success' });
        loadTrashedPurchases(trashedCurrentPage);
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
      const response = await eventPurchaseService.bulkRestore(ids);
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
      await eventPurchaseService.forceDeletePurchase(Number(id));
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className={`animate-spin rounded-full h-12 w-12 border-b-2 border-${fullColor}`}></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-6 py-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Event Purchases</h1>
          <p className="text-gray-600 mt-2">View and manage all event ticket purchases</p>
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
            <StandardButton variant="primary" size="md" onClick={exportToCSV} icon={Download}>
              Export CSV
            </StandardButton>
          )}
        </div>
      </div>

      {!showTrashed && (
        <>
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

          <AdminTableToolbar
            table={table}
            searchPlaceholder="Search by name, email, event, or reference..."
            onRefresh={() => loadPurchases()}
          />

          <BulkActionsBar table={table} itemLabel="purchase(s)">
            <select
              onChange={(e) => handleBulkStatusChange(e.target.value)}
              className={`border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-${themeColor}-400`}
              defaultValue=""
            >
              <option value="">Change Status</option>
              <option value="confirmed">Confirm</option>
              <option value="checked-in">Check In</option>
              <option value="completed">Complete</option>
              <option value="cancelled">Cancel</option>
            </select>
            <StandardButton variant="danger" size="md" onClick={handleBulkDelete} icon={Trash2}>
              Delete
            </StandardButton>
          </BulkActionsBar>

          <AdminDataTable
            table={table}
            selectable
            itemLabel="purchases"
            emptyMessage="No event purchases found"
            renderActions={(purchase) => (
              <div className="flex items-center gap-1">
                <Link
                  to={`/events/purchases/${purchase.id}?from=purchases`}
                  className="p-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
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
            <div className={`bg-${themeColor}-50 p-4 rounded-lg mb-6 flex flex-wrap items-center gap-4`}>
              <span className={`text-${fullColor} font-medium`}>
                {selectedTrashed.length} deleted purchase(s) selected
              </span>
              <StandardButton variant="primary" size="md" onClick={handleBulkRestore} icon={RotateCcw}>
                Restore Selected
              </StandardButton>
            </div>
          )}

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            {trashedLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className={`animate-spin rounded-full h-8 w-8 border-b-2 border-${fullColor}`}></div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-red-50 border-b border-red-100">
                    <tr>
                      <th className="px-4 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-12">
                        <input
                          type="checkbox"
                          checked={selectedTrashed.length === trashedPurchases.length && trashedPurchases.length > 0}
                          onChange={handleSelectAllTrashed}
                          className={`rounded border-gray-300 text-${fullColor} focus:ring-${themeColor}-600`}
                        />
                      </th>
                      <th className="px-4 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Customer</th>
                      <th className="px-4 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Event</th>
                      <th className="px-4 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Total</th>
                      <th className="px-4 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                      <th className="px-4 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Deleted At</th>
                      <th className="px-4 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {trashedPurchases.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-12 text-center">
                          <Archive className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                          <p className="text-sm text-gray-500">No deleted purchases found</p>
                        </td>
                      </tr>
                    ) : (
                      trashedPurchases.map((purchase) => (
                        <tr key={purchase.id} className="hover:bg-red-50/50">
                          <td className="px-4 py-4 whitespace-nowrap">
                            <input
                              type="checkbox"
                              checked={selectedTrashed.includes(purchase.id)}
                              onChange={() => handleSelectTrashed(purchase.id)}
                              className={`rounded border-gray-300 text-${fullColor} focus:ring-${themeColor}-600`}
                            />
                          </td>
                          <td className="px-4 py-4">
                            <div>
                              <div className="text-sm font-medium text-gray-900">{purchase.customerName}</div>
                              <div className="text-xs text-gray-500">{purchase.email}</div>
                            </div>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                            {purchase.eventName}
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
                            {purchase.deletedAt ? formatDate(purchase.deletedAt) : '—'}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleRestorePurchase(purchase.id)}
                                className={`p-2 text-${fullColor} hover:bg-${themeColor}-50 rounded-lg transition-colors`}
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

            {!trashedLoading && trashedTotal > 0 && (
              <div className="bg-white px-4 py-4 border-t border-gray-100">
                <Pagination
                  currentPage={trashedCurrentPage}
                  totalPages={trashedTotalPages}
                  onPageChange={(page) => loadTrashedPurchases(page)}
                  totalItems={trashedTotal}
                  showingFrom={(trashedCurrentPage - 1) * itemsPerPage + 1}
                  showingTo={Math.min(trashedCurrentPage * itemsPerPage, trashedTotal)}
                />
              </div>
            )}
          </div>
        </>
      )}

      {toast && (
        <div className="fixed top-4 right-4 z-50">
          <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
        </div>
      )}
    </div>
  );
};

export default EventPurchases;
