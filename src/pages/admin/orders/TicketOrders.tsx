import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  ShoppingCart,
  RefreshCcw,
  Download,
  CheckCircle,
  XCircle,
  Clock,
  DollarSign,
  Ticket,
  Eye,
  Plus,
} from 'lucide-react';
import ticketOrderService, { type TicketOrder } from '../../../services/TicketOrderService';
import { useLocationScope } from '../../../contexts/LocationContext';
import { useThemeColor } from '../../../hooks/useThemeColor';
import CounterAnimation from '../../../components/ui/CounterAnimation';
import StandardButton from '../../../components/ui/StandardButton';
import Toast from '../../../components/ui/Toast';
import {
  AdminDataTable,
  AdminTableToolbar,
  exportTableCsv,
  useAdminTable,
} from '../../../components/admin/table';
import type { AdminColumn, AdminFilterDef } from '../../../components/admin/table';

const money = (v: number) => `$${Number(v ?? 0).toFixed(2)}`;

interface DisplayOrder {
  id: string;
  reference: string;
  customerName: string;
  email: string;
  phone: string;
  locationName: string;
  purchaseDate: string;
  itemCount: number;
  ticketCount: number;
  subtotal: number;
  discount: number;
  fees: number;
  total: number;
  paid: number;
  balance: number;
  method: string;
  status: string;
  allCheckedIn: boolean;
}

const statusConfig: Record<string, { color: string; icon: typeof CheckCircle }> = {
  draft: { color: 'bg-gray-100 text-gray-800', icon: Clock },
  pending: { color: 'bg-yellow-100 text-yellow-800', icon: Clock },
  confirmed: { color: 'bg-blue-100 text-blue-800', icon: CheckCircle },
  'checked-in': { color: 'bg-green-100 text-green-800', icon: CheckCircle },
  cancelled: { color: 'bg-gray-100 text-gray-800', icon: XCircle },
  refunded: { color: 'bg-purple-100 text-purple-800', icon: XCircle },
};

const TicketOrders = () => {
  const navigate = useNavigate();
  const { themeColor, fullColor } = useThemeColor();
  const { effectiveLocationId } = useLocationScope();

  const [orders, setOrders] = useState<DisplayOrder[]>([]);
  const [rawOrders, setRawOrders] = useState<TicketOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkingIn, setCheckingIn] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const convert = (list: TicketOrder[]): DisplayOrder[] =>
    list.map(o => ({
      id: String(o.id),
      reference: o.reference_number,
      customerName: o.customer_name,
      email: o.customer_email ?? '',
      phone: o.customer_phone ?? '',
      locationName: o.location_name ?? '',
      purchaseDate: o.purchase_date ?? '',
      itemCount: o.item_count,
      ticketCount: o.ticket_count,
      subtotal: o.subtotal,
      discount: o.discount_amount,
      fees: o.fee_total,
      total: o.total_amount,
      paid: o.amount_paid,
      balance: o.remaining_balance,
      method: o.payment_method === 'authorize.net' ? 'Authorize.Net' : (o.payment_method ?? 'N/A'),
      status: o.status,
      allCheckedIn: o.lines.length > 0 && o.lines.every(l => l.checked_in_at),
    }));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await ticketOrderService.list({
        location_id: effectiveLocationId,
        page: 1,
        per_page: 1000,
      });
      setRawOrders(result.orders);
      setOrders(convert(result.orders));
    } catch (e) {
      setToast({ message: e instanceof Error ? e.message : 'Failed to load orders', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [effectiveLocationId]);

  useEffect(() => {
    void load();
  }, [load]);

  const checkInOrder = async (row: DisplayOrder) => {
    setCheckingIn(row.id);
    try {
      const res = await ticketOrderService.checkIn(Number(row.id));
      const skipped = res.skipped.length ? ` (${res.skipped.length} skipped)` : '';
      setToast({ message: `Checked in ${res.checked_in} ticket line(s)${skipped}`, type: 'success' });
      await load();
    } catch (e) {
      setToast({ message: e instanceof Error ? e.message : 'Check-in failed', type: 'error' });
    } finally {
      setCheckingIn(null);
    }
  };

  const metrics = [
    {
      title: 'Total Orders',
      value: orders.length.toString(),
      change: `${orders.reduce((n, o) => n + o.itemCount, 0)} ticket lines`,
      accent: `bg-${themeColor}-100 text-${fullColor}`,
      icon: ShoppingCart,
    },
    {
      title: 'Collected',
      value: `$${orders.reduce((s, o) => s + o.paid, 0).toFixed(2)}`,
      change: 'Payments received on orders',
      accent: `bg-${themeColor}-100 text-${fullColor}`,
      icon: CheckCircle,
    },
    {
      title: 'Outstanding',
      value: `$${orders.filter(o => !['cancelled', 'refunded'].includes(o.status)).reduce((s, o) => s + o.balance, 0).toFixed(2)}`,
      change: 'Due at the venue',
      accent: `bg-${themeColor}-100 text-${fullColor}`,
      icon: DollarSign,
    },
    {
      title: 'Tickets',
      value: orders.reduce((n, o) => n + o.ticketCount, 0).toString(),
      change: 'Across all orders',
      accent: `bg-${themeColor}-100 text-${fullColor}`,
      icon: Ticket,
    },
  ];

  const columns: AdminColumn<DisplayOrder>[] = [
    {
      key: 'reference',
      label: 'Order',
      group: 'Identifiers',
      sortable: true,
      sortValue: o => o.reference,
      exportValue: o => o.reference,
      render: o => (
        <Link to={`/orders/${o.id}`} className="whitespace-nowrap text-sm font-mono font-semibold text-gray-900 hover:underline">
          {o.reference}
        </Link>
      ),
    },
    {
      key: 'customer',
      label: 'Customer',
      group: 'Customer',
      sortable: true,
      sortValue: o => o.customerName,
      exportValue: o => o.customerName,
      render: o => (
        <div className="flex flex-col">
          <span className="text-sm font-medium text-gray-900">{o.customerName}</span>
          <span className="text-xs text-gray-500">{o.email}</span>
        </div>
      ),
    },
    {
      key: 'location',
      label: 'Location',
      group: 'Purchase',
      sortable: true,
      sortValue: o => o.locationName,
      exportValue: o => o.locationName,
      render: o => <span className="whitespace-nowrap text-sm text-gray-700">{o.locationName}</span>,
    },
    {
      key: 'date',
      label: 'Date',
      group: 'Purchase',
      sortable: true,
      sortValue: o => o.purchaseDate,
      exportValue: o => o.purchaseDate,
      render: o => <span className="whitespace-nowrap text-sm text-gray-700">{o.purchaseDate}</span>,
    },
    {
      key: 'items',
      label: 'Items',
      group: 'Purchase',
      sortable: true,
      sortValue: o => o.ticketCount,
      exportValue: o => `${o.itemCount} items / ${o.ticketCount} tickets`,
      render: o => (
        <span className="whitespace-nowrap text-sm text-gray-700">
          {o.itemCount} {o.itemCount === 1 ? 'item' : 'items'} · {o.ticketCount} tickets
        </span>
      ),
    },
    {
      key: 'total',
      label: 'Total',
      group: 'Payment',
      sortable: true,
      sortValue: o => o.total,
      exportValue: o => o.total.toFixed(2),
      render: o => (
        <div className="flex flex-col">
          <span className="text-sm font-bold text-gray-900">{money(o.total)}</span>
          {o.balance > 0 && !['cancelled', 'refunded'].includes(o.status) && (
            <span className="text-xs text-amber-700">{money(o.balance)} due</span>
          )}
        </div>
      ),
    },
    {
      key: 'method',
      label: 'Method',
      group: 'Payment',
      sortable: true,
      sortValue: o => o.method,
      exportValue: o => o.method,
      render: o => <span className="whitespace-nowrap text-sm text-gray-700 capitalize">{o.method}</span>,
    },
    {
      key: 'status',
      label: 'Status',
      group: 'Status',
      sortable: true,
      sortValue: o => o.status,
      exportValue: o => o.status,
      render: o => {
        const cfg = statusConfig[o.status] ?? statusConfig.pending;
        const Icon = cfg.icon;
        return (
          <span className={`inline-flex items-center gap-1 text-xs font-medium px-3 py-1 rounded-full capitalize ${cfg.color}`}>
            <Icon size={12} />
            {o.status.replace('-', ' ')}
          </span>
        );
      },
    },
    {
      key: 'subtotal',
      label: 'Subtotal',
      group: 'Payment',
      defaultVisible: false,
      sortable: true,
      sortValue: o => o.subtotal,
      exportValue: o => o.subtotal.toFixed(2),
      render: o => <span className="text-sm text-gray-700">{money(o.subtotal)}</span>,
    },
    {
      key: 'discount',
      label: 'Discounts',
      group: 'Payment',
      defaultVisible: false,
      sortable: true,
      sortValue: o => o.discount,
      exportValue: o => o.discount.toFixed(2),
      render: o => <span className="text-sm text-emerald-700">−{money(o.discount)}</span>,
    },
    {
      key: 'fees',
      label: 'Fees',
      group: 'Payment',
      defaultVisible: false,
      sortable: true,
      sortValue: o => o.fees,
      exportValue: o => o.fees.toFixed(2),
      render: o => <span className="text-sm text-gray-700">{money(o.fees)}</span>,
    },
  ];

  const filterDefs: AdminFilterDef<DisplayOrder>[] = useMemo(() => [
    {
      type: 'select',
      key: 'status',
      label: 'Status',
      options: Object.keys(statusConfig).map(sVal => ({ value: sVal, label: sVal.replace('-', ' ') })),
      predicate: (o: DisplayOrder, value: string) => !value || o.status === value,
    },
    {
      type: 'select',
      key: 'method',
      label: 'Payment Method',
      options: [
        { value: 'Authorize.Net', label: 'Authorize.Net' },
        { value: 'in-store', label: 'In-Store' },
        { value: 'paylater', label: 'Pay Later' },
      ],
      predicate: (o: DisplayOrder, value: string) => !value || o.method === value,
    },
  ], []);

  const table = useAdminTable<DisplayOrder>({
    data: orders,
    columns,
    getRowId: o => o.id,
    storageKey: 'ticket_orders',
    filterDefs,
    searchFields: o => [o.reference, o.customerName, o.email, o.phone, o.locationName, o.method, o.status],
    defaultSort: (a, b) => b.purchaseDate.localeCompare(a.purchaseDate),
  });

  const exportToCSV = () => {
    exportTableCsv({
      filename: `bulk-orders-export-${new Date().toISOString().split('T')[0]}.csv`,
      columns,
      rows: table.filteredRows,
      extraColumns: [
        { label: 'Phone', value: o => o.phone },
        { label: 'Paid', value: o => o.paid.toFixed(2) },
        { label: 'Balance Due', value: o => o.balance.toFixed(2) },
        {
          label: 'Lines',
          value: o => {
            const raw = rawOrders.find(r => String(r.id) === o.id);
            return raw ? raw.lines.map(l => `${l.quantity}x ${l.name}`).join('; ') : '';
          },
        },
      ],
    });
  };

  return (
    <div className="p-4 md:p-6 lg:p-8">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Bulk Orders</h1>
          <p className="text-gray-600 mt-1">View and manage all bulk orders</p>
        </div>
        <div className="flex items-center gap-2">
          <StandardButton variant="secondary" size="md" onClick={() => navigate('/attractions/purchases/create?bulk=1')} icon={Plus}>
            New Order
          </StandardButton>
          <StandardButton variant="secondary" size="md" onClick={() => void load()} icon={RefreshCcw}>
            Refresh
          </StandardButton>
          <StandardButton variant="primary" size="md" onClick={exportToCSV} icon={Download}>
            Export CSV
          </StandardButton>
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

      <AdminTableToolbar
        table={table}
        searchPlaceholder="Search by reference, customer, email, phone..."
        onRefresh={() => void load()}
      />

      <AdminDataTable
        table={table}
        loading={loading && orders.length === 0}
        itemLabel="orders"
        emptyMessage="No bulk orders yet — orders placed from the cart or Create Purchase appear here"
        renderActions={(o) => (
          <div className="flex items-center gap-1">
            {!o.allCheckedIn && !['cancelled', 'refunded'].includes(o.status) && o.balance <= 0 && (
              <button
                onClick={() => void checkInOrder(o)}
                disabled={checkingIn === o.id}
                className="p-2 text-green-600 hover:text-green-700 hover:bg-green-50 rounded-lg transition-colors"
                title="Check in every ticket on this order"
              >
                <CheckCircle className="h-4 w-4" />
              </button>
            )}
            <Link
              to={`/orders/${o.id}`}
              className={`p-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors`}
              title="View Order"
            >
              <Eye className="h-4 w-4" />
            </Link>
          </div>
        )}
      />
    </div>
  );
};

export default TicketOrders;
