import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle,
  Ticket,
  Calendar,
  CreditCard,
  Pencil,
  MapPin,
  User,
  QrCode,
  X,
  Download,
  DollarSign,
  AlertCircle,
} from 'lucide-react';
import ticketOrderService, { type TicketOrder, type OrderLine } from '../../../services/TicketOrderService';
import { getPayments, createPayment } from '../../../services/PaymentService';
import { PAYMENT_TYPE, type Payment } from '../../../types/Payment.types';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import Toast from '../../../components/ui/Toast';
import StandardButton from '../../../components/ui/StandardButton';
import { useThemeColor } from '../../../hooks/useThemeColor';
import { convertTo12Hour } from '../../../utils/timeFormat';
import WaiverConnectionPanel from '../../../components/waiver/WaiverConnectionPanel';
import { generateOrderQRCode } from '../../../utils/qrcode';

const money = (v: number) => `$${Number(v ?? 0).toFixed(2)}`;

const statusConfig: Record<string, { label: string; color: string }> = {
  draft: { label: 'Draft', color: 'bg-gray-100 text-gray-800' },
  pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-800' },
  confirmed: { label: 'Confirmed', color: 'bg-blue-100 text-blue-800' },
  'checked-in': { label: 'Checked In', color: 'bg-green-100 text-green-800' },
  cancelled: { label: 'Cancelled', color: 'bg-gray-100 text-gray-800' },
  refunded: { label: 'Refunded', color: 'bg-purple-100 text-purple-800' },
};

const TicketOrderDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { fullColor } = useThemeColor();

  const [order, setOrder] = useState<TicketOrder | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checkingIn, setCheckingIn] = useState<number | 'all' | null>(null);
  const [acting, setActing] = useState<'pay' | 'cancel' | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [showQRModal, setShowQRModal] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const fetched = await ticketOrderService.get(Number(id));
      setOrder(fetched);
      try {
        const res = await getPayments({ payable_type: PAYMENT_TYPE.TICKET_ORDER, payable_id: fetched.id });
        setPayments(res.data?.payments ?? []);
      } catch {
        setPayments([]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'We could not load that order.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!order) return;
    let cancelled = false;
    generateOrderQRCode(order.id)
      .then(img => { if (!cancelled) setQrImage(img); })
      .catch(() => { if (!cancelled) setQrImage(null); });
    return () => { cancelled = true; };
  }, [order]);

  const checkIn = async (lineIds?: number[]) => {
    if (!order) return;
    setCheckingIn(lineIds ? lineIds[0] : 'all');
    try {
      const res = await ticketOrderService.checkIn(order.id, lineIds);
      const skipped = res.skipped.length
        ? ` — skipped: ${res.skipped.map(s => s.reason).join(', ')}`
        : '';
      setToast({ message: `Checked in ${res.checked_in}${skipped}`, type: res.checked_in > 0 ? 'success' : 'error' });
      await load();
    } catch (e) {
      setToast({ message: e instanceof Error ? e.message : 'Check-in failed', type: 'error' });
    } finally {
      setCheckingIn(null);
    }
  };

  const recordVenuePayment = async () => {
    if (!order || order.remaining_balance <= 0) return;
    if (!window.confirm(`Record ${money(order.remaining_balance)} collected at the venue for ${order.reference_number}?`)) return;
    setActing('pay');
    try {
      await createPayment({
        payable_id: order.id,
        payable_type: PAYMENT_TYPE.TICKET_ORDER,
        amount: order.remaining_balance,
        method: 'in-store',
        status: 'completed',
        location_id: order.location_id,
        notes: `Venue payment for order ${order.reference_number}`,
      });
      setToast({ message: 'Payment recorded — every ticket on the order is settled.', type: 'success' });
      await load();
    } catch (e) {
      setToast({ message: e instanceof Error ? e.message : 'Payment failed', type: 'error' });
    } finally {
      setActing(null);
    }
  };

  const cancelOrder = async () => {
    if (!order) return;
    if (!window.confirm(`Cancel order ${order.reference_number}? Every ticket on it will be cancelled.`)) return;
    setActing('cancel');
    try {
      await ticketOrderService.cancel(order.id);
      setToast({ message: 'Order cancelled.', type: 'success' });
      await load();
    } catch (e) {
      setToast({ message: e instanceof Error ? e.message : 'Cancel failed', type: 'error' });
    } finally {
      setActing(null);
    }
  };

  const editPath = (line: OrderLine) =>
    line.type === 'attraction'
      ? `/attractions/purchases/${line.id}/edit?from=order`
      : `/events/purchases/${line.id}/edit?from=order`;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="medium" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-3" />
          <h2 className="text-2xl font-bold text-gray-900 mb-4">{error ?? 'Order not found'}</h2>
          <StandardButton variant="primary" onClick={() => navigate('/orders')}>
            Back to Bulk Orders
          </StandardButton>
        </div>
      </div>
    );
  }

  const status = statusConfig[order.status] ?? statusConfig.pending;
  const allIn = order.lines.length > 0 && order.lines.every(l => l.checked_in_at);
  const themeBg = fullColor.replace('-600', '');

  return (
    <div className="p-4 sm:p-6 md:p-8">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
          <div className="flex items-center gap-3">
            <StandardButton variant="ghost" size="sm" onClick={() => navigate('/orders')} icon={ArrowLeft}>
              {''}
            </StandardButton>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Order Details</h1>
              <p className="text-gray-600 mt-1">Order: <span className="font-mono font-medium">{order.reference_number}</span></p>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {order.remaining_balance > 0 && !['cancelled', 'refunded'].includes(order.status) && (
              <StandardButton
                variant="secondary"
                icon={DollarSign}
                onClick={() => void recordVenuePayment()}
                disabled={acting !== null}
              >
                {acting === 'pay' ? 'Recording…' : `Record Payment ${money(order.remaining_balance)}`}
              </StandardButton>
            )}
            {order.amount_paid === 0 && !['cancelled', 'refunded', 'checked-in'].includes(order.status) && !order.lines.some(l => l.checked_in_at) && (
              <StandardButton
                variant="secondary"
                icon={X}
                onClick={() => void cancelOrder()}
                disabled={acting !== null}
              >
                {acting === 'cancel' ? 'Cancelling…' : 'Cancel Order'}
              </StandardButton>
            )}
            <StandardButton
              variant="primary"
              icon={QrCode}
              onClick={() => setShowQRModal(true)}
              disabled={!qrImage}
            >
              View QR Code
            </StandardButton>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Order Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex items-start gap-3">
                <div className={`p-2 bg-${themeBg}-100 rounded-lg`}>
                  <User className={`h-5 w-5 text-${fullColor}`} />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Customer</p>
                  <p className="font-medium text-gray-900">{order.customer_name}</p>
                  {order.customer_email && <p className="text-sm text-gray-600">{order.customer_email}</p>}
                  {order.customer_phone && <p className="text-sm text-gray-600">{order.customer_phone}</p>}
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className={`p-2 bg-${themeBg}-100 rounded-lg`}>
                  <Calendar className={`h-5 w-5 text-${fullColor}`} />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Order Date</p>
                  <p className="font-medium text-gray-900">{order.purchase_date ?? '—'}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className={`p-2 bg-${themeBg}-100 rounded-lg`}>
                  <CheckCircle className={`h-5 w-5 text-${fullColor}`} />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Status</p>
                  <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${status.color}`}>
                    {status.label}
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className={`p-2 bg-${themeBg}-100 rounded-lg`}>
                  <MapPin className={`h-5 w-5 text-${fullColor}`} />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Location</p>
                  <p className="font-medium text-gray-900">{order.location_name ?? '—'}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className={`p-2 bg-${themeBg}-100 rounded-lg`}>
                  <CreditCard className={`h-5 w-5 text-${fullColor}`} />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Payment Method</p>
                  <p className="font-medium text-gray-900">
                    {order.payment_method === 'authorize.net' ? 'Card (Authorize.Net)' : order.payment_method === 'paylater' ? 'Pay Later' : 'In-Store'}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className={`p-2 bg-${themeBg}-100 rounded-lg`}>
                  <Ticket className={`h-5 w-5 text-${fullColor}`} />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Items</p>
                  <p className="font-medium text-gray-900">
                    {order.item_count} {order.item_count === 1 ? 'item' : 'items'} · {order.ticket_count} tickets
                    {allIn ? ' · all checked in' : ''}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="p-6 border-b border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Tickets on this Order</h2>
              <StandardButton
                variant="primary"
                size="sm"
                onClick={() => void checkIn()}
                disabled={checkingIn !== null || allIn || order.status === 'cancelled' || order.remaining_balance > 0}
              >
                {allIn ? 'All Checked In' : checkingIn === 'all' ? 'Checking In…' : 'Check In All'}
              </StandardButton>
            </div>

            <div className="space-y-4">
              {order.lines.map(line => (
                <div key={line.id} className="bg-gray-50 rounded-lg p-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className={`p-2 bg-${themeBg}-100 rounded-lg`}>
                      {line.type === 'attraction'
                        ? <Ticket className={`h-5 w-5 text-${fullColor}`} />
                        : <Calendar className={`h-5 w-5 text-${fullColor}`} />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-gray-900">{line.position}. {line.name}</p>
                      <p className="text-sm text-gray-600">
                        {line.unit_price != null
                          ? `${line.quantity} × ${money(line.unit_price)}`
                          : `${line.quantity} ${line.quantity === 1 ? 'ticket' : 'tickets'}`}
                        {line.scheduled_date ? ` · ${line.scheduled_date}` : ''}
                        {line.scheduled_time ? ` at ${convertTo12Hour(line.scheduled_time)}` : ''}
                        {line.reference_number ? ` · ${line.reference_number}` : ''}
                      </p>
                      {(line.applied_discounts ?? []).map((d, i) => (
                        <p key={i} className="text-sm text-green-600">
                          {(d.name ?? d.discount_name) ?? 'Special pricing'}
                          {d.discount_label ? ` (${d.discount_label} off)` : ''}
                        </p>
                      ))}
                      {(line.add_ons ?? []).map((a, i) => (
                        <p key={`a${i}`} className="text-sm text-gray-600">
                          + {a.quantity}× {a.name} · {money(a.line_total ?? a.price_at_purchase * a.quantity)}
                        </p>
                      ))}
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-gray-900">{money(line.total_amount)}</p>
                      {line.amount_paid < line.total_amount && (
                        <p className="text-sm text-yellow-700">{money(line.total_amount - line.amount_paid)} due</p>
                      )}
                    </div>
                    {line.checked_in_at ? (
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                        <CheckCircle className="w-4 h-4" /> Checked In
                      </span>
                    ) : (
                      <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${(statusConfig[line.status] ?? statusConfig.pending).color}`}>
                        {(statusConfig[line.status] ?? statusConfig.pending).label}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 mt-3">
                    {!line.checked_in_at && (
                      <StandardButton
                        variant="primary"
                        size="sm"
                        onClick={() => void checkIn([line.id])}
                        disabled={checkingIn !== null || order.status === 'cancelled' || line.amount_paid < line.total_amount}
                      >
                        {checkingIn === line.id ? 'Checking In…' : 'Check In'}
                      </StandardButton>
                    )}
                    <StandardButton
                      variant="secondary"
                      size="sm"
                      icon={Pencil}
                      onClick={() => navigate(editPath(line))}
                    >
                      Edit Schedule & Notes
                    </StandardButton>
                  </div>

                  {line.type === 'attraction' && (
                    <div className="mt-3">
                      <WaiverConnectionPanel type="attraction_purchase" id={line.id} title="Waivers" compact emptyMessage="Covered by this order's waiver — one signature per visit day (see the ticket holding it)." />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Payment Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className="flex items-start gap-3">
                <div className={`p-2 bg-${themeBg}-100 rounded-lg`}>
                  <DollarSign className={`h-5 w-5 text-${fullColor}`} />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Subtotal</p>
                  <p className="font-medium text-gray-900">{money(order.subtotal)}</p>
                  {order.discount_amount > 0 && (
                    <p className="text-sm text-green-600">−{money(order.discount_amount)} discounts</p>
                  )}
                  {order.fee_total > 0 && (
                    <p className="text-sm text-gray-600">+{money(order.fee_total)} fees</p>
                  )}
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className={`p-2 bg-${themeBg}-100 rounded-lg`}>
                  <CreditCard className={`h-5 w-5 text-${fullColor}`} />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total / Paid</p>
                  <p className="font-medium text-gray-900">{money(order.total_amount)} / {money(order.amount_paid)}</p>
                  {order.remaining_balance > 0 && !['cancelled', 'refunded'].includes(order.status) && (
                    <p className="text-sm text-yellow-700 font-medium">{money(order.remaining_balance)} due at the venue</p>
                  )}
                </div>
              </div>
            </div>

            {payments.length === 0 ? (
              <p className="text-sm text-gray-500">
                {order.remaining_balance > 0
                  ? 'No payments recorded yet — the balance is collected at the venue.'
                  : 'No payment rows found for this order.'}
              </p>
            ) : (
              <div className="space-y-2">
                {payments.map(p => (
                  <div key={p.id} className="flex flex-wrap items-center gap-3 p-3 bg-gray-50 rounded-lg text-sm">
                    <span className="font-semibold text-gray-900">{money(p.amount)}</span>
                    <span className="text-gray-600 capitalize">{p.method}</span>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${p.status === 'completed' ? 'bg-green-100 text-green-800' : p.status === 'refunded' || p.status === 'voided' ? 'bg-purple-100 text-purple-800' : 'bg-yellow-100 text-yellow-800'}`}>
                      {p.status}
                    </span>
                    {p.transaction_id && <span className="text-xs text-gray-500 font-mono truncate">{p.transaction_id}</span>}
                    <span className="text-xs text-gray-500 ml-auto">{new Date(p.created_at).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {showQRModal && qrImage && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowQRModal(false)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">Order QR Code</h3>
              <button onClick={() => setShowQRModal(false)} className="p-1.5 hover:bg-gray-100 rounded-lg transition">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="flex flex-col items-center">
              <img
                src={qrImage}
                alt="Order QR Code"
                className="w-64 h-64 mb-4 border-2 border-gray-200 rounded-lg"
              />
              <p className="text-sm text-gray-600 mb-2 text-center">
                Order: <span className="font-semibold font-mono">{order.reference_number}</span>
              </p>
              <p className="text-sm text-gray-500 mb-4 text-center">
                One code for the whole order — {order.ticket_count} tickets
              </p>
              <StandardButton
                variant="primary"
                icon={Download}
                onClick={() => {
                  const link = document.createElement('a');
                  link.download = `order-${order.reference_number}.png`;
                  link.href = qrImage;
                  link.click();
                }}
                fullWidth
              >
                Download QR Code
              </StandardButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TicketOrderDetails;
