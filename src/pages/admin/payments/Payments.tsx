import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  RefreshCcw,
  Download,
  CreditCard,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  DollarSign,
  FileText,
  Package,
  Ticket,
  Printer,
  X,
  Calendar,
  RotateCcw,
  Ban,
  MoreVertical,
  PenLine,
  Trash2,
  Undo2,
  AlertTriangle,
  Archive
} from 'lucide-react';
import { useThemeColor } from '../../../hooks/useThemeColor';
import {
  getPayments,
  PAYMENT_TYPE,
  getInvoice,
  exportInvoices,
  exportInvoicesForDay,
  exportInvoicesForWeek,
  exportBulkInvoices,
  exportPackageInvoices,
  canRefund,
  canVoid,
  canManualRefund,
  isRefundRecord,
  isVoidRecord,
  extractOriginalPaymentId,
  deletePayment,
  restorePayment,
  forceDeletePayment,
  getTrashedPayments,
  type InvoiceExportFilters,
  type PackageInvoiceFilters
} from '../../../services/PaymentService';
import { locationService } from '../../../services/LocationService';
import { packageService } from '../../../services/PackageService';
import LocationSelector from '../../../components/admin/LocationSelector';
import StandardButton from '../../../components/ui/StandardButton';
import Pagination from '../../../components/ui/Pagination';
import Toast from '../../../components/ui/Toast';
import CounterAnimation from '../../../components/ui/CounterAnimation';
import RefundModal from '../../../components/admin/payments/RefundModal';
import VoidDialog from '../../../components/admin/payments/VoidDialog';
import ManualRefundModal from '../../../components/admin/payments/ManualRefundModal';
import {
  AdminDataTable,
  AdminTableToolbar,
  BulkActionsBar,
  exportTableCsv,
  useAdminTable,
} from '../../../components/admin/table';
import type { AdminColumn, AdminFilterDef, DateRangeValue } from '../../../components/admin/table';
import { getStoredUser, getImageUrl } from '../../../utils/storage';
import type { PaymentsPagePayment, PaymentsMetrics } from '../../../types/Payments.types';
import type { Payment, PaymentFilters, RefundResponse, VoidResponse, ManualRefundResponse } from '../../../types/Payment.types';
import type { PaymentPayableType } from '../../../types/Payment.types';

const normalizePayableType = (type?: string | null): PaymentPayableType | undefined => {
  if (!type) return undefined;
  const lower = type.toLowerCase();
  if (lower === PAYMENT_TYPE.BOOKING || lower.includes('booking')) return PAYMENT_TYPE.BOOKING;
  if (lower === PAYMENT_TYPE.ATTRACTION_PURCHASE || lower.includes('attractionpurchase') || lower.includes('attraction_purchase')) return PAYMENT_TYPE.ATTRACTION_PURCHASE;
  if (lower === PAYMENT_TYPE.EVENT_PURCHASE || lower.includes('eventpurchase') || lower.includes('event_purchase')) return PAYMENT_TYPE.EVENT_PURCHASE;
  return type as PaymentPayableType;
};

const transformPayment = (payment: Payment): PaymentsPagePayment => {
  const payableType = normalizePayableType(payment.payable_type as string);

  const booking = payment.booking;
  const attractionPurchase = payment.attractionPurchase || payment.attraction_purchase;
  const eventPurchase = payment.eventPurchase || payment.event_purchase;

  let customerName = 'Guest';
  let customerEmail = 'N/A';

  if (payment.customer) {
    customerName = `${payment.customer.first_name} ${payment.customer.last_name}`;
    customerEmail = payment.customer.email || 'N/A';
  } else if (payableType === PAYMENT_TYPE.BOOKING && booking) {
    customerName = booking.guest_name || 'Guest';
    customerEmail = booking.guest_email || 'N/A';
  } else if (payableType === PAYMENT_TYPE.ATTRACTION_PURCHASE && attractionPurchase) {
    customerName = attractionPurchase.guest_name || 'Guest';
    customerEmail = attractionPurchase.guest_email || 'N/A';
  } else if (payableType === PAYMENT_TYPE.EVENT_PURCHASE && eventPurchase) {
    customerName = eventPurchase.guest_name || 'Guest';
    customerEmail = eventPurchase.guest_email || 'N/A';
  }

  let payableReference = 'N/A';
  let payableDescription = 'Unknown';

  if (payableType === PAYMENT_TYPE.BOOKING && booking) {
    payableReference = booking.reference_number || `Booking #${payment.payable_id}`;
    payableDescription = `Package Booking • ${booking.participants || 0} guests`;
  } else if (payableType === PAYMENT_TYPE.BOOKING) {
    payableReference = `Booking #${payment.payable_id}`;
    payableDescription = 'Package Booking';
  } else if (payableType === PAYMENT_TYPE.ATTRACTION_PURCHASE && attractionPurchase) {
    payableReference = attractionPurchase.transaction_id || `Purchase #${payment.payable_id}`;
    payableDescription = `Attraction • Qty: ${attractionPurchase.quantity || 1}`;
  } else if (payableType === PAYMENT_TYPE.ATTRACTION_PURCHASE) {
    payableReference = `Purchase #${payment.payable_id}`;
    payableDescription = 'Attraction Purchase';
  } else if (payableType === PAYMENT_TYPE.EVENT_PURCHASE && eventPurchase) {
    payableReference = eventPurchase.reference_number || `Event #${payment.payable_id}`;
    payableDescription = `Event Purchase • Qty: ${eventPurchase.quantity || 1}`;
  } else if (payableType === PAYMENT_TYPE.EVENT_PURCHASE) {
    payableReference = `Event #${payment.payable_id}`;
    payableDescription = 'Event Purchase';
  }

  return {
    id: payment.id,
    payable_id: payment.payable_id,
    payable_type: payableType,
    customer_id: payment.customer_id,
    location_id: payment.location_id,
    amount: Number(payment.amount),
    currency: payment.currency,
    method: payment.method,
    status: payment.status,
    transaction_id: payment.transaction_id,
    payment_id: payment.payment_id,
    notes: payment.notes,
    paid_at: payment.paid_at,
    refunded_at: payment.refunded_at,
    created_at: payment.created_at,
    updated_at: payment.updated_at,
    deleted_at: payment.deleted_at,
    booking: booking,
    attractionPurchase: attractionPurchase,
    customerName,
    customerEmail,
    locationName: payment.location?.name || 'N/A',
    payableReference,
    payableDescription,
    bookingDate: booking?.booking_date,
    bookingTime: booking?.booking_time,
    participants: booking?.participants,
    guestName: booking?.guest_name || attractionPurchase?.guest_name,
    signature_image: payment.signature_image || null,
    terms_accepted: payment.terms_accepted ?? null,
  };
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

const Payments = () => {
  const navigate = useNavigate();
  const { themeColor, fullColor } = useThemeColor();
  const currentUser = getStoredUser();
  const isCompanyAdmin = currentUser?.role === 'company_admin';
  const isLocationManager = currentUser?.role === 'location_manager';
  const itemsPerPage = 10;

  const [payments, setPayments] = useState<PaymentsPagePayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  const [locations, setLocations] = useState<Array<{ id: number; name: string }>>([]);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const [viewMode, setViewMode] = useState<'active' | 'trashed'>('active');
  const [trashedPayments, setTrashedPayments] = useState<PaymentsPagePayment[]>([]);
  const [loadingTrashed, setLoadingTrashed] = useState(false);
  const [trashedCurrentPage, setTrashedCurrentPage] = useState(1);
  const [confirmDialog, setConfirmDialog] = useState<{
    type: 'soft-delete' | 'restore' | 'force-delete';
    payment: PaymentsPagePayment;
  } | null>(null);

  const [isExporting, setIsExporting] = useState(false);

  const [showExportModal, setShowExportModal] = useState(false);
  const [exportMode, setExportMode] = useState<'custom' | 'today' | 'week' | 'current_week' | 'last_week'>('custom');
  const [exportFilters, setExportFilters] = useState<InvoiceExportFilters>({
    view_mode: 'report'
  });
  const [exportDate, setExportDate] = useState<string>(new Date().toISOString().split('T')[0]);

  const [showPackageInvoiceModal, setShowPackageInvoiceModal] = useState(false);
  const [packageInvoiceFilters, setPackageInvoiceFilters] = useState<PackageInvoiceFilters>({
    package_id: 0
  });
  const [availablePackages, setAvailablePackages] = useState<Array<{ id: number; name: string }>>([]);
  const [loadingPackages, setLoadingPackages] = useState(false);

  const [selectedPaymentForAction, setSelectedPaymentForAction] = useState<PaymentsPagePayment | null>(null);
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [showVoidDialog, setShowVoidDialog] = useState(false);
  const [showManualRefundModal, setShowManualRefundModal] = useState(false);
  const [openActionsMenu, setOpenActionsMenu] = useState<number | null>(null);

  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [signatureModalPayment, setSignatureModalPayment] = useState<PaymentsPagePayment | null>(null);

  const statusConfig = {
    pending: { color: 'bg-yellow-100 text-yellow-800', icon: Clock, label: 'Pending' },
    completed: { color: 'bg-green-100 text-green-800', icon: CheckCircle, label: 'Completed' },
    failed: { color: 'bg-red-100 text-red-800', icon: XCircle, label: 'Failed' },
    refunded: { color: 'bg-orange-100 text-orange-800', icon: RotateCcw, label: 'Refunded' },
    voided: { color: 'bg-red-100 text-red-800', icon: Ban, label: 'Voided' }
  };

  const methodConfig: Record<string, { icon: typeof CreditCard; label: string }> = {
    card: { icon: CreditCard, label: 'Card' },
    cash: { icon: DollarSign, label: 'Cash' },
    'authorize.net': { icon: CreditCard, label: 'Authorize.Net' },
    'in-store': { icon: DollarSign, label: 'In-Store' }
  };

  const payableTypeConfig = {
    booking: { icon: Package, label: 'Package Booking', color: `bg-${themeColor}-100 text-${fullColor}` },
    attraction_purchase: { icon: Ticket, label: 'Attraction Purchase', color: 'bg-purple-100 text-purple-800' },
    event_purchase: { icon: Calendar, label: 'Event Purchase', color: 'bg-amber-100 text-amber-800' }
  };

  const metrics: PaymentsMetrics = {
    totalPayments: payments.length,
    totalRevenue: payments.reduce((sum, p) => sum + p.amount, 0),
    completedPayments: payments.filter(p => p.status === 'completed').length,
    completedRevenue: payments.filter(p => p.status === 'completed').reduce((sum, p) => sum + p.amount, 0),
    pendingPayments: payments.filter(p => p.status === 'pending').length,
    pendingRevenue: payments.filter(p => p.status === 'pending').reduce((sum, p) => sum + p.amount, 0),
    refundedPayments: payments.filter(p => p.status === 'refunded').length,
    refundedAmount: payments.filter(p => p.status === 'refunded').reduce((sum, p) => sum + p.amount, 0),
    voidedPayments: payments.filter(p => p.status === 'voided').length,
    voidedAmount: payments.filter(p => p.status === 'voided').reduce((sum, p) => sum + p.amount, 0)
  };

  const metricCards = [
    {
      title: 'Total Payments',
      value: metrics.totalPayments.toString(),
      change: `$${metrics.totalRevenue.toFixed(2)} total revenue`,
      icon: CreditCard,
      accent: `bg-${themeColor}-100 text-${fullColor}`
    },
    {
      title: 'Completed',
      value: metrics.completedPayments.toString(),
      change: `$${metrics.completedRevenue.toFixed(2)} collected`,
      icon: CheckCircle,
      accent: `bg-${themeColor}-100 text-${fullColor}`
    },
    {
      title: 'Pending',
      value: metrics.pendingPayments.toString(),
      change: `$${metrics.pendingRevenue.toFixed(2)} awaiting`,
      icon: Clock,
      accent: `bg-${themeColor}-100 text-${fullColor}`
    },
    {
      title: 'Refunded / Voided',
      value: (metrics.refundedPayments + metrics.voidedPayments).toString(),
      change: `$${(metrics.refundedAmount + metrics.voidedAmount).toFixed(2)} returned`,
      icon: RotateCcw,
      accent: 'bg-orange-100 text-orange-600'
    }
  ];

  const loadPayments = useCallback(async () => {
    try {
      setLoading(true);

      const params: PaymentFilters = {
        per_page: 1000,
      };

      if (selectedLocation) {
        params.location_id = parseInt(selectedLocation);
      } else if (isLocationManager && currentUser?.location_id) {
        params.location_id = currentUser.location_id;
      }

      const response = await getPayments(params);

      if (response.success && response.data) {
        setPayments(response.data.payments.map(transformPayment));
      }
    } catch (error) {
      console.error('Error loading payments:', error);
      setToast({ message: 'Failed to load payments', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [selectedLocation, isLocationManager, currentUser?.location_id]);

  const loadLocations = useCallback(async () => {
    if (isCompanyAdmin) {
      try {
        const response = await locationService.getLocations();
        if (response.success && response.data) {
          const locationsArray = Array.isArray(response.data) ? response.data : [];
          setLocations(locationsArray.map((loc: { id: number; name: string }) => ({
            id: loc.id,
            name: loc.name
          })));
        }
      } catch (error) {
        console.error('Error loading locations:', error);
      }
    }
  }, [isCompanyAdmin]);

  const loadTrashedPayments = useCallback(async () => {
    try {
      setLoadingTrashed(true);
      const params: PaymentFilters = { per_page: 1000 };
      if (selectedLocation) {
        params.location_id = parseInt(selectedLocation);
      } else if (isLocationManager && currentUser?.location_id) {
        params.location_id = currentUser.location_id;
      }
      const response = await getTrashedPayments(params);
      if (response.success && response.data) {
        setTrashedPayments(response.data.payments.map(transformPayment));
      }
    } catch (error) {
      console.error('Error loading trashed payments:', error);
      setToast({ message: 'Failed to load deleted payments', type: 'error' });
    } finally {
      setLoadingTrashed(false);
    }
  }, [selectedLocation, isLocationManager, currentUser?.location_id]);

  useEffect(() => {
    loadLocations();
  }, [loadLocations]);

  useEffect(() => {
    loadPayments();
  }, [loadPayments]);

  useEffect(() => {
    if (viewMode === 'trashed') {
      loadTrashedPayments();
    }
  }, [viewMode, loadTrashedPayments]);

  const handleInvoice = async (paymentId: number, stream: boolean = true) => {
    try {
      setToast({ message: stream ? 'Opening invoice...' : 'Downloading invoice...', type: 'info' });
      await getInvoice(paymentId, stream);
      if (!stream) {
        setToast({ message: 'Invoice downloaded successfully', type: 'success' });
      }
    } catch (error) {
      console.error('Error with invoice:', error);
      setToast({ message: 'Failed to process invoice', type: 'error' });
    }
  };

  const handleOpenPackageInvoiceModal = async () => {
    setShowPackageInvoiceModal(true);
    setLoadingPackages(true);

    try {
      const locationId = selectedLocation
        ? parseInt(selectedLocation)
        : (isLocationManager && currentUser?.location_id ? currentUser.location_id : undefined);

      const response = await packageService.getPackages({
        location_id: locationId,
        is_active: true,
        per_page: 100
      });

      if (response.success && response.data) {
        setAvailablePackages(
          (response.data.packages || []).map((pkg: { id: number; name: string }) => ({
            id: pkg.id,
            name: pkg.name
          }))
        );
      }
    } catch (error) {
      console.error('Error loading packages:', error);
      setToast({ message: 'Failed to load packages', type: 'error' });
    } finally {
      setLoadingPackages(false);
    }

    setPackageInvoiceFilters({
      package_id: 0
    });
  };

  const handlePackageInvoiceExport = async (stream: boolean = false) => {
    if (!packageInvoiceFilters.package_id) {
      setToast({ message: 'Please select a package', type: 'error' });
      return;
    }

    try {
      setIsExporting(true);
      setToast({ message: stream ? 'Opening package invoices...' : 'Generating package invoices...', type: 'info' });

      await exportPackageInvoices(packageInvoiceFilters, stream);

      setToast({ message: `Package invoices ${stream ? 'opened' : 'downloaded'} successfully`, type: 'success' });
      setShowPackageInvoiceModal(false);
    } catch (error: unknown) {
      console.error('Error exporting package invoices:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to export package invoices';
      setToast({ message: errorMessage, type: 'error' });
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportFromModal = async (stream: boolean = false) => {
    try {
      setIsExporting(true);
      setToast({ message: stream ? 'Opening invoices...' : 'Generating invoices...', type: 'info' });

      if (exportMode === 'today') {
        const today = new Date().toISOString().split('T')[0];
        await exportInvoicesForDay(today, stream);
      } else if (exportMode === 'current_week') {
        await exportInvoicesForWeek('current', stream);
      } else if (exportMode === 'last_week') {
        const lastWeekDate = new Date();
        lastWeekDate.setDate(lastWeekDate.getDate() - 7);
        await exportInvoicesForWeek(lastWeekDate.toISOString().split('T')[0], stream);
      } else if (exportMode === 'week') {
        await exportInvoicesForWeek(exportDate, stream);
      } else {
        await exportInvoices(exportFilters, stream);
      }

      setToast({ message: `Invoices ${stream ? 'opened' : 'downloaded'} successfully`, type: 'success' });
      setShowExportModal(false);
    } catch (error: unknown) {
      console.error('Error exporting invoices:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to export invoices';
      setToast({ message: errorMessage, type: 'error' });
    } finally {
      setIsExporting(false);
    }
  };

  const handleRefundClick = (payment: PaymentsPagePayment) => {
    setSelectedPaymentForAction(payment);
    setShowRefundModal(true);
    setOpenActionsMenu(null);
  };

  const handleVoidClick = (payment: PaymentsPagePayment) => {
    setSelectedPaymentForAction(payment);
    setShowVoidDialog(true);
    setOpenActionsMenu(null);
  };

  const handleManualRefundClick = (payment: PaymentsPagePayment) => {
    setSelectedPaymentForAction(payment);
    setShowManualRefundModal(true);
    setOpenActionsMenu(null);
  };

  const handleRefundComplete = (response: RefundResponse) => {
    setPayments((prev) => {
      const updated = prev.map((p) =>
        p.id === response.data.original_payment.id
          ? { ...p, notes: response.data.original_payment.notes ?? p.notes }
          : p
      );
      const refundPmt = response.data.refund_payment;
      const originalPayment = prev.find(p => p.id === response.data.original_payment.id);
      const refundRecord: PaymentsPagePayment = {
        id: refundPmt.id,
        payable_id: refundPmt.payable_id,
        payable_type: refundPmt.payable_type,
        customer_id: refundPmt.customer_id ?? undefined,
        location_id: refundPmt.location_id,
        amount: Number(refundPmt.amount),
        currency: refundPmt.currency,
        method: refundPmt.method,
        status: refundPmt.status,
        transaction_id: refundPmt.transaction_id,
        payment_id: refundPmt.payment_id ?? undefined,
        notes: refundPmt.notes ?? undefined,
        paid_at: refundPmt.paid_at ?? undefined,
        refunded_at: refundPmt.refunded_at ?? undefined,
        created_at: refundPmt.created_at,
        updated_at: refundPmt.updated_at,
        customerName: originalPayment?.customerName || 'Guest',
        customerEmail: originalPayment?.customerEmail || 'N/A',
        locationName: originalPayment?.locationName || 'N/A',
        payableReference: `Refund #${refundPmt.id}`,
        payableDescription: `Refund from Payment #${response.data.original_payment.id}`,
      };
      const originalIndex = updated.findIndex(p => p.id === response.data.original_payment.id);
      if (originalIndex >= 0) {
        updated.splice(originalIndex + 1, 0, refundRecord);
      } else {
        updated.unshift(refundRecord);
      }
      return updated;
    });
  };

  const handleVoidComplete = (response: VoidResponse) => {
    setPayments((prev) => {
      const updated = prev.map((p) =>
        p.id === response.data.original_payment.id
          ? { ...p, status: 'voided' as const, notes: response.data.original_payment.notes ?? p.notes }
          : p
      );
      const voidPmt = response.data.void_payment;
      const originalPayment = prev.find(p => p.id === response.data.original_payment.id);
      const voidRecord: PaymentsPagePayment = {
        id: voidPmt.id,
        payable_id: voidPmt.payable_id,
        payable_type: voidPmt.payable_type,
        customer_id: voidPmt.customer_id ?? undefined,
        location_id: voidPmt.location_id,
        amount: Number(voidPmt.amount),
        currency: voidPmt.currency,
        method: voidPmt.method,
        status: voidPmt.status,
        transaction_id: voidPmt.transaction_id,
        payment_id: voidPmt.payment_id ?? undefined,
        notes: voidPmt.notes ?? undefined,
        paid_at: voidPmt.paid_at ?? undefined,
        refunded_at: voidPmt.refunded_at ?? undefined,
        created_at: voidPmt.created_at,
        updated_at: voidPmt.updated_at,
        customerName: originalPayment?.customerName || 'Guest',
        customerEmail: originalPayment?.customerEmail || 'N/A',
        locationName: originalPayment?.locationName || 'N/A',
        payableReference: `Void #${voidPmt.id}`,
        payableDescription: `Void of Payment #${response.data.original_payment.id}`,
      };
      const originalIndex = updated.findIndex(p => p.id === response.data.original_payment.id);
      if (originalIndex >= 0) {
        updated.splice(originalIndex + 1, 0, voidRecord);
      } else {
        updated.unshift(voidRecord);
      }
      return updated;
    });
  };

  const handleManualRefundComplete = (response: ManualRefundResponse) => {
    setPayments((prev) => {
      const updated = prev.map((p) =>
        p.id === response.data.original_payment.id
          ? { ...p, notes: response.data.original_payment.notes ?? p.notes }
          : p
      );
      const refundPmt = response.data.refund_payment;
      const originalPayment = prev.find(p => p.id === response.data.original_payment.id);
      const refundRecord: PaymentsPagePayment = {
        id: refundPmt.id,
        payable_id: refundPmt.payable_id,
        payable_type: refundPmt.payable_type,
        customer_id: refundPmt.customer_id ?? undefined,
        location_id: refundPmt.location_id,
        amount: Number(refundPmt.amount),
        currency: refundPmt.currency,
        method: refundPmt.method,
        status: refundPmt.status,
        transaction_id: refundPmt.transaction_id,
        payment_id: refundPmt.payment_id ?? undefined,
        notes: refundPmt.notes ?? undefined,
        paid_at: refundPmt.paid_at ?? undefined,
        refunded_at: refundPmt.refunded_at ?? undefined,
        created_at: refundPmt.created_at,
        updated_at: refundPmt.updated_at,
        customerName: originalPayment?.customerName || 'Guest',
        customerEmail: originalPayment?.customerEmail || 'N/A',
        locationName: originalPayment?.locationName || 'N/A',
        payableReference: `Refund #${refundPmt.id}`,
        payableDescription: `Manual Refund from Payment #${response.data.original_payment.id}`,
      };
      const originalIndex = updated.findIndex(p => p.id === response.data.original_payment.id);
      if (originalIndex >= 0) {
        updated.splice(originalIndex + 1, 0, refundRecord);
      } else {
        updated.unshift(refundRecord);
      }
      return updated;
    });
  };

  const handleSoftDelete = async (payment: PaymentsPagePayment) => {
    try {
      const response = await deletePayment(payment.id);
      if (response.success) {
        setPayments(prev => prev.filter(p => p.id !== payment.id));
        setToast({ message: 'Payment deleted successfully. It can be restored later.', type: 'success' });
        if (viewMode === 'trashed') loadTrashedPayments();
      } else {
        setToast({ message: 'Failed to delete payment', type: 'error' });
      }
    } catch (error) {
      console.error('Error deleting payment:', error);
      setToast({ message: 'Failed to delete payment', type: 'error' });
    }
    setConfirmDialog(null);
    setOpenActionsMenu(null);
  };

  const handleRestore = async (payment: PaymentsPagePayment) => {
    try {
      const response = await restorePayment(payment.id);
      if (response.success) {
        setTrashedPayments(prev => prev.filter(p => p.id !== payment.id));
        setToast({ message: 'Payment restored successfully. Linked totals recalculated.', type: 'success' });
        loadPayments();
      } else {
        setToast({ message: 'Failed to restore payment', type: 'error' });
      }
    } catch (error) {
      console.error('Error restoring payment:', error);
      setToast({ message: 'Failed to restore payment', type: 'error' });
    }
    setConfirmDialog(null);
  };

  const handleForceDelete = async (payment: PaymentsPagePayment) => {
    try {
      const response = await forceDeletePayment(payment.id);
      if (response.success) {
        setTrashedPayments(prev => prev.filter(p => p.id !== payment.id));
        setToast({ message: 'Payment permanently deleted.', type: 'success' });
      } else {
        setToast({ message: 'Failed to permanently delete payment', type: 'error' });
      }
    } catch (error) {
      console.error('Error permanently deleting payment:', error);
      setToast({ message: 'Failed to permanently delete payment', type: 'error' });
    }
    setConfirmDialog(null);
  };

  const navigateToPayable = (payment: PaymentsPagePayment) => {
    if (payment.payable_type === PAYMENT_TYPE.BOOKING) {
      navigate(`/bookings/${payment.payable_id}?from=payments`);
    } else if (payment.payable_type === PAYMENT_TYPE.ATTRACTION_PURCHASE) {
      navigate(`/attractions/purchases/${payment.payable_id}?from=payments`);
    } else if (payment.payable_type === PAYMENT_TYPE.EVENT_PURCHASE) {
      navigate(`/events/purchases/${payment.payable_id}?from=payments`);
    }
  };

  const columns: AdminColumn<PaymentsPagePayment>[] = [
    {
      key: 'paymentId',
      label: 'Payment ID',
      group: 'Identifiers',
      sortable: true,
      sortValue: p => p.id,
      exportValue: p => p.id,
      defaultVisible: false,
      render: p => <span className="text-sm font-mono text-gray-600">#{p.id}</span>,
    },
    {
      key: 'transaction',
      label: 'Transaction',
      group: 'Identifiers',
      sortable: true,
      sortValue: p => p.transaction_id || `TXN-${p.id}`,
      exportValue: p => p.transaction_id || `TXN-${p.id}`,
      render: p => {
        const isRefund = isRefundRecord(p);
        const isVoid = isVoidRecord(p);
        const originalId = extractOriginalPaymentId(p.notes);
        return (
          <div className="flex flex-col">
            <span className="text-sm font-medium text-gray-900">
              {p.transaction_id || `TXN-${p.id}`}
            </span>
            <span className="text-xs text-gray-500">
              ID: {p.id}
              {isRefund && originalId && (
                <span className="ml-1 text-orange-600">(↩ from #{originalId})</span>
              )}
              {isVoid && originalId && (
                <span className="ml-1 text-red-600">(✕ from #{originalId})</span>
              )}
            </span>
          </div>
        );
      },
    },
    {
      key: 'type',
      label: 'Type',
      group: 'Source',
      sortable: true,
      sortValue: p => p.payableReference || '',
      exportValue: p => p.payableReference || '',
      render: p => {
        const isRefund = isRefundRecord(p);
        const isVoid = isVoidRecord(p);
        const TypeIcon = p.payable_type ? payableTypeConfig[p.payable_type]?.icon : FileText;
        return (
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded-lg ${
              isRefund ? 'bg-orange-100 text-orange-600' :
              isVoid ? 'bg-red-100 text-red-600' :
              p.payable_type ? payableTypeConfig[p.payable_type]?.color : 'bg-gray-100 text-gray-600'
            }`}>
              {isRefund ? <RotateCcw className="w-4 h-4" /> :
               isVoid ? <Ban className="w-4 h-4" /> :
               TypeIcon && <TypeIcon className="w-4 h-4" />}
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium text-gray-900">
                {p.payableReference}
              </span>
              <span className="text-xs text-gray-500">
                {isRefund ? 'Refund Record' : isVoid ? 'Void Record' : p.payableDescription}
              </span>
            </div>
          </div>
        );
      },
    },
    {
      key: 'customer',
      label: 'Customer',
      group: 'Customer',
      sortable: true,
      sortValue: p => p.customerName || '',
      exportValue: p => p.customerName || '',
      render: p => (
        <div className="flex flex-col">
          <span className="text-sm font-medium text-gray-900">{p.customerName}</span>
          <span className="text-xs text-gray-500">{p.customerEmail}</span>
        </div>
      ),
    },
    {
      key: 'amount',
      label: 'Amount',
      group: 'Payment',
      sortable: true,
      sortValue: p => p.amount,
      exportValue: p => p.amount.toFixed(2),
      render: p => (
        p.status === 'refunded' || p.status === 'voided' ? (
          <span className="text-sm font-bold text-red-600">
            -${p.amount.toFixed(2)}
          </span>
        ) : (
          <span className="text-sm font-bold text-gray-900">
            ${p.amount.toFixed(2)}
          </span>
        )
      ),
    },
    {
      key: 'method',
      label: 'Method',
      group: 'Payment',
      sortable: true,
      sortValue: p => p.method,
      exportValue: p => p.method,
      render: p => {
        const MethodIcon = methodConfig[p.method]?.icon || CreditCard;
        return (
          <div className="flex items-center gap-2">
            <MethodIcon className="w-4 h-4 text-gray-500" />
            <span className="text-sm text-gray-600 capitalize">{p.method}</span>
          </div>
        );
      },
    },
    {
      key: 'status',
      label: 'Status',
      group: 'Status',
      sortable: true,
      sortValue: p => p.status,
      exportValue: p => p.status,
      render: p => {
        const StatusIcon = statusConfig[p.status]?.icon || Clock;
        return (
          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${statusConfig[p.status]?.color}`}>
            <StatusIcon className="w-3.5 h-3.5" />
            {statusConfig[p.status]?.label}
          </span>
        );
      },
    },
    ...(isCompanyAdmin ? [{
      key: 'location',
      label: 'Location',
      group: 'Location',
      sortable: true,
      sortValue: (p: PaymentsPagePayment) => p.locationName || '',
      exportValue: (p: PaymentsPagePayment) => p.locationName || '',
      render: (p: PaymentsPagePayment) => <span className="text-sm text-gray-600">{p.locationName}</span>,
    }] : []),
    {
      key: 'createdAt',
      label: 'Date',
      group: 'Dates',
      sortable: true,
      sortValue: p => new Date(p.created_at).getTime(),
      exportValue: p => new Date(p.created_at).toLocaleString(),
      cellClassName: 'min-w-[180px]',
      render: p => <span className="text-sm text-gray-900 whitespace-nowrap">{formatDate(p.created_at)}</span>,
    },
    {
      key: 'paidAt',
      label: 'Paid At',
      group: 'Dates',
      sortable: true,
      sortValue: p => p.paid_at ? new Date(p.paid_at).getTime() : 0,
      exportValue: p => p.paid_at ? new Date(p.paid_at).toLocaleString() : '',
      defaultVisible: false,
      render: p => p.paid_at
        ? <span className="text-sm text-gray-600 whitespace-nowrap">{formatDate(p.paid_at)}</span>
        : <span className="text-gray-300">—</span>,
    },
    {
      key: 'refundedAt',
      label: 'Refunded At',
      group: 'Dates',
      sortable: true,
      sortValue: p => p.refunded_at ? new Date(p.refunded_at).getTime() : 0,
      exportValue: p => p.refunded_at ? new Date(p.refunded_at).toLocaleString() : '',
      defaultVisible: false,
      render: p => p.refunded_at
        ? <span className="text-sm text-gray-600 whitespace-nowrap">{formatDate(p.refunded_at)}</span>
        : <span className="text-gray-300">—</span>,
    },
    {
      key: 'updatedAt',
      label: 'Updated At',
      group: 'Dates',
      sortable: true,
      sortValue: p => p.updated_at ? new Date(p.updated_at).getTime() : 0,
      exportValue: p => p.updated_at ? new Date(p.updated_at).toLocaleString() : '',
      defaultVisible: false,
      render: p => p.updated_at
        ? <span className="text-sm text-gray-600 whitespace-nowrap">{formatDate(p.updated_at)}</span>
        : <span className="text-gray-300">—</span>,
    },
    {
      key: 'notes',
      label: 'Notes',
      group: 'Details',
      sortable: true,
      sortValue: p => p.notes || '',
      exportValue: p => p.notes || '',
      defaultVisible: false,
      render: p => p.notes
        ? <span className="text-xs text-gray-600 block max-w-[240px] truncate" title={p.notes}>{p.notes}</span>
        : <span className="text-gray-300">—</span>,
    },
  ];

  const filterDefs: AdminFilterDef<PaymentsPagePayment>[] = useMemo(() => [
    {
      type: 'select',
      key: 'status',
      label: 'Status',
      allLabel: 'All Statuses',
      options: [
        { value: 'completed', label: 'Completed' },
        { value: 'pending', label: 'Pending' },
        { value: 'failed', label: 'Failed' },
        { value: 'refunded', label: 'Refunded' },
        { value: 'voided', label: 'Voided' },
      ],
      predicate: (p, value) => p.status === value,
    },
    {
      type: 'select',
      key: 'method',
      label: 'Payment Method',
      allLabel: 'All Methods',
      options: [
        { value: 'card', label: 'Card' },
        { value: 'authorize.net', label: 'Authorize.net' },
        { value: 'cash', label: 'Cash' },
        { value: 'in-store', label: 'In-Store' },
      ],
      predicate: (p, value) => p.method === value,
    },
    {
      type: 'select',
      key: 'payableType',
      label: 'Payment Type',
      allLabel: 'All Types',
      options: [
        { value: 'booking', label: 'Bookings' },
        { value: 'attraction_purchase', label: 'Attractions' },
        { value: 'event_purchase', label: 'Events' },
      ],
      predicate: (p, value) => p.payable_type === value,
    },
    {
      type: 'select',
      key: 'recordType',
      label: 'Record Type',
      allLabel: 'All Records',
      options: [
        { value: 'payment', label: 'Payments' },
        { value: 'refund', label: 'Refund Records' },
        { value: 'void', label: 'Void Records' },
      ],
      predicate: (p, value) => {
        if (value === 'refund') return isRefundRecord(p);
        if (value === 'void') return isVoidRecord(p);
        return !isRefundRecord(p) && !isVoidRecord(p);
      },
    },
    {
      type: 'select',
      key: 'period',
      label: 'Time Period',
      allLabel: 'All Time',
      options: [
        { value: 'today', label: 'Today' },
        { value: 'week', label: 'This Week' },
        { value: 'month', label: 'This Month' },
        { value: 'year', label: 'This Year' },
      ],
      predicate: (p, value) => {
        const now = new Date();
        let startDate: Date;
        switch (value) {
          case 'today':
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            break;
          case 'week':
            startDate = new Date(now);
            startDate.setDate(now.getDate() - 7);
            break;
          case 'month':
            startDate = new Date(now);
            startDate.setMonth(now.getMonth() - 1);
            break;
          case 'year':
            startDate = new Date(now);
            startDate.setFullYear(now.getFullYear() - 1);
            break;
          default:
            startDate = new Date(0);
        }
        return new Date(p.created_at) >= startDate;
      },
    },
    {
      type: 'daterange',
      key: 'createdDate',
      label: 'Payment Date',
      getDate: p => p.created_at,
    },
    {
      type: 'numberrange',
      key: 'amount',
      label: 'Amount ($)',
      getValue: p => p.amount,
    },
  ], []);

  const table = useAdminTable<PaymentsPagePayment>({
    data: payments,
    columns,
    getRowId: p => String(p.id),
    storageKey: 'payments',
    filterDefs,
    searchFields: p => [
      p.id,
      p.transaction_id,
      p.payment_id,
      p.customerName,
      p.customerEmail,
      p.notes,
      p.payableReference,
    ],
    defaultSort: (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    itemsPerPage,
  });

  const handleBulkExportInvoices = async (stream: boolean = false) => {
    if (table.selectedIds.length === 0) {
      setToast({ message: 'Please select payments to export', type: 'error' });
      return;
    }

    try {
      setIsExporting(true);
      setToast({ message: `${stream ? 'Opening' : 'Exporting'} ${table.selectedIds.length} invoice(s)...`, type: 'info' });
      await exportBulkInvoices(table.selectedIds.map(Number), !stream);
      setToast({ message: `Invoices ${stream ? 'opened' : 'exported'} successfully`, type: 'success' });
      table.clearSelection();
    } catch (error) {
      console.error('Error exporting invoices:', error);
      setToast({ message: 'Failed to export invoices', type: 'error' });
    } finally {
      setIsExporting(false);
    }
  };

  const openExportModal = () => {
    const newExportFilters: InvoiceExportFilters = {
      view_mode: 'report'
    };

    if (selectedLocation) {
      newExportFilters.location_id = parseInt(selectedLocation);
    } else if (isLocationManager && currentUser?.location_id) {
      newExportFilters.location_id = currentUser.location_id;
    }

    const statusValue = table.filterValues['status'];
    if (typeof statusValue === 'string' && statusValue !== 'all') {
      newExportFilters.status = statusValue as InvoiceExportFilters['status'];
    }
    const methodValue = table.filterValues['method'];
    if (typeof methodValue === 'string' && methodValue !== 'all') {
      newExportFilters.method = methodValue as InvoiceExportFilters['method'];
    }
    const typeValue = table.filterValues['payableType'];
    if (typeof typeValue === 'string' && typeValue !== 'all') {
      newExportFilters.payable_type = typeValue as InvoiceExportFilters['payable_type'];
    }
    const dateValue = table.filterValues['createdDate'] as DateRangeValue | undefined;
    if (dateValue?.start) newExportFilters.start_date = dateValue.start;
    if (dateValue?.end) newExportFilters.end_date = dateValue.end;

    setExportFilters(newExportFilters);
    setShowExportModal(true);
  };

  const exportToCSV = () => {
    exportTableCsv({
      filename: `payments-export-${new Date().toISOString().split('T')[0]}.csv`,
      columns,
      rows: table.filteredRows,
      extraColumns: [
        { label: 'Payable Type', value: p => p.payable_type || '' },
        { label: 'Payable ID', value: p => p.payable_id ?? '' },
        { label: 'Description', value: p => p.payableDescription || '' },
        { label: 'Customer Email', value: p => p.customerEmail || '' },
        { label: 'Currency', value: p => p.currency },
        { label: 'Gateway Payment ID', value: p => p.payment_id || '' },
        { label: 'Record Type', value: p => isRefundRecord(p) ? 'Refund' : isVoidRecord(p) ? 'Void' : 'Payment' },
        { label: 'Original Payment ID', value: p => extractOriginalPaymentId(p.notes) || '' },
        ...(!isCompanyAdmin ? [{ label: 'Location', value: (p: PaymentsPagePayment) => p.locationName || '' }] : []),
        { label: 'Booking Date', value: p => p.bookingDate || '' },
        { label: 'Booking Time', value: p => p.bookingTime || '' },
        { label: 'Participants', value: p => p.participants ?? '' },
        { label: 'Guest Name', value: p => p.guestName || '' },
        { label: 'Terms Accepted', value: p => p.terms_accepted === true ? 'Yes' : p.terms_accepted === false ? 'No' : '' },
        { label: 'Signature On File', value: p => p.signature_image ? 'Yes' : 'No' },
      ],
    });

    setToast({ message: 'Payments exported successfully', type: 'success' });
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
          <h1 className="text-3xl font-bold text-gray-900">Payments</h1>
          <p className="text-gray-600 mt-2">View and manage all payment transactions</p>
        </div>
        <div className="mt-4 sm:mt-0 flex flex-wrap gap-2">
          {isCompanyAdmin && (
            <LocationSelector
              variant="compact"
              locations={locations}
              selectedLocation={selectedLocation}
              onLocationChange={setSelectedLocation}
              themeColor={themeColor}
              fullColor={fullColor}
              showAllOption={true}
            />
          )}
          <StandardButton
            variant="secondary"
            size="md"
            onClick={exportToCSV}
            icon={Download}
          >
            Export CSV
          </StandardButton>
          <StandardButton
            variant="secondary"
            size="md"
            onClick={handleOpenPackageInvoiceModal}
            icon={Package}
            disabled={isExporting}
          >
            Package Invoices
          </StandardButton>
          <StandardButton
            variant="primary"
            size="md"
            onClick={openExportModal}
            icon={FileText}
            disabled={isExporting}
          >
            Export Invoices
          </StandardButton>
          <StandardButton
            variant={viewMode === 'trashed' ? 'primary' : 'secondary'}
            size="md"
            onClick={() => {
              const next = viewMode === 'trashed' ? 'active' : 'trashed';
              setViewMode(next);
              if (next === 'trashed') loadTrashedPayments();
            }}
            icon={viewMode === 'trashed' ? RefreshCcw : Archive}
          >
            {viewMode === 'trashed' ? 'View Active' : 'View Deleted'}
          </StandardButton>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {metricCards.map((metric, index) => {
          const Icon = metric.icon;
          return (
            <div
              key={index}
              className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex flex-col gap-2 hover:shadow-md transition-shadow min-h-[120px]"
            >
              <div className="flex items-center gap-2">
                <div className={`p-2 rounded-lg ${metric.accent}`}><Icon size={20} /></div>
                <span className="text-base font-semibold text-gray-800">{metric.title}</span>
              </div>
              <div className="flex items-end gap-2 mt-2">
                <CounterAnimation value={metric.value} className="text-2xl font-bold text-gray-900" />
              </div>
              <p className="text-xs mt-1 text-gray-600">{metric.change}</p>
            </div>
          );
        })}
      </div>

      {viewMode === 'trashed' ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-red-500" />
              <h2 className="text-lg font-semibold text-gray-900">Deleted Payments</h2>
              <span className="text-sm text-gray-500">({trashedPayments.length} total)</span>
            </div>
            <StandardButton
              variant="secondary"
              size="sm"
              icon={RefreshCcw}
              onClick={loadTrashedPayments}
            >
              Refresh
            </StandardButton>
          </div>

          {loadingTrashed ? (
            <div className="flex items-center justify-center py-16">
              <div className={`animate-spin rounded-full h-8 w-8 border-b-2 border-${fullColor}`}></div>
            </div>
          ) : trashedPayments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <Trash2 className="w-12 h-12 mb-3 text-gray-300" />
              <p className="text-lg font-medium text-gray-500">No deleted payments</p>
              <p className="text-sm text-gray-400 mt-1">Soft-deleted payments will appear here</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Method</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Deleted At</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trashedPayments
                      .slice((trashedCurrentPage - 1) * itemsPerPage, trashedCurrentPage * itemsPerPage)
                      .map((payment) => {
                        const methodInfo = methodConfig[payment.method] || { icon: CreditCard, label: payment.method };
                        const MethodIcon = methodInfo.icon;
                        const statusInfo = statusConfig[payment.status as keyof typeof statusConfig] || statusConfig.pending;
                        const StatusIcon = statusInfo.icon;
                        return (
                          <tr key={payment.id} className="border-b border-gray-50 hover:bg-red-50/30 transition-colors">
                            <td className="px-4 py-3">
                              <span className="text-sm font-mono text-gray-600">#{payment.id}</span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex flex-col">
                                <span className="text-sm font-medium text-gray-900">{payment.customerName}</span>
                                <span className="text-xs text-gray-500">{payment.customerEmail}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex flex-col">
                                <span className="text-xs text-gray-500">{payment.payableDescription}</span>
                                <span className="text-xs font-mono text-gray-400">{payment.payableReference}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-sm font-semibold text-gray-900">${payment.amount.toFixed(2)}</span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1.5">
                                <MethodIcon className="w-3.5 h-3.5 text-gray-500" />
                                <span className="text-sm text-gray-700">{methodInfo.label}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${statusInfo.color}`}>
                                <StatusIcon className="w-3 h-3" />
                                {statusInfo.label}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-sm text-red-600">{payment.deleted_at ? formatDate(payment.deleted_at) : 'N/A'}</span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  onClick={() => setConfirmDialog({ type: 'restore', payment })}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 rounded-lg transition-colors"
                                  title="Restore this payment"
                                >
                                  <Undo2 className="w-3.5 h-3.5" />
                                  Restore
                                </button>
                                <button
                                  onClick={() => setConfirmDialog({ type: 'force-delete', payment })}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors"
                                  title="Permanently delete this payment"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  Delete Forever
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
              {trashedPayments.length > itemsPerPage && (
                <div className="px-6 py-4 border-t border-gray-100">
                  <Pagination
                    currentPage={trashedCurrentPage}
                    totalPages={Math.ceil(trashedPayments.length / itemsPerPage)}
                    onPageChange={setTrashedCurrentPage}
                    totalItems={trashedPayments.length}
                    showingFrom={(trashedCurrentPage - 1) * itemsPerPage + 1}
                    showingTo={Math.min(trashedCurrentPage * itemsPerPage, trashedPayments.length)}
                    itemLabel="deleted payments"
                  />
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        <>
          <AdminTableToolbar
            table={{
              ...table,
              clearFilters: () => {
                table.clearFilters();
                table.setSearchInput('');
              },
            }}
            searchPlaceholder="Search payments..."
            onRefresh={loadPayments}
          />

          <BulkActionsBar table={table} itemLabel="payment(s)">
            <StandardButton
              onClick={() => handleBulkExportInvoices(true)}
              variant="secondary"
              icon={Eye}
              disabled={isExporting}
              size="sm"
            >
              View Selected
            </StandardButton>
            <StandardButton
              onClick={() => handleBulkExportInvoices(false)}
              variant="primary"
              icon={Printer}
              disabled={isExporting}
              size="sm"
            >
              Download Selected
            </StandardButton>
          </BulkActionsBar>

          <AdminDataTable
            table={table}
            loading={loading}
            selectable
            itemLabel="payments"
            emptyState={
              <div className="flex flex-col items-center">
                <CreditCard className="w-12 h-12 text-gray-300 mb-3" />
                <p className="text-gray-500 text-lg font-medium">No payments found</p>
                <p className="text-gray-400 text-sm mt-1">Try adjusting your filters</p>
              </div>
            }
            rowClassName={(p) =>
              table.selectedIds.includes(String(p.id)) ? `bg-${themeColor}-50` :
              isRefundRecord(p) ? 'bg-orange-50/50' :
              isVoidRecord(p) ? 'bg-red-50/50' : ''
            }
            renderActions={(payment) => {
              const rowIndex = table.rows.indexOf(payment);
              return (
                <div className="relative flex items-center justify-end gap-1">
                  <button
                    onClick={() => {
                      setSignatureModalPayment(payment);
                      setShowSignatureModal(true);
                    }}
                    className={`p-2 text-gray-400 hover:text-${themeColor}-600 hover:bg-${themeColor}-50 rounded-lg transition-colors`}
                    title="View Signature & Terms"
                  >
                    <PenLine className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleInvoice(payment.id, false)}
                    className={`p-2 text-gray-400 hover:text-${themeColor}-600 hover:bg-${themeColor}-50 rounded-lg transition-colors`}
                    title="Download Invoice"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                  {(canRefund(payment) || canVoid(payment) || canManualRefund(payment) || payment.status === 'completed') && (
                    <div className="relative">
                      <button
                        onClick={() => setOpenActionsMenu(openActionsMenu === payment.id ? null : payment.id)}
                        className={`p-2 text-gray-400 hover:text-${themeColor}-600 hover:bg-${themeColor}-50 rounded-lg transition-colors`}
                        title="More actions"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                      {openActionsMenu === payment.id && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={() => setOpenActionsMenu(null)} />
                          <div className={`absolute right-0 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1 ${rowIndex >= table.rows.length - 3 ? 'bottom-full mb-1' : 'top-full mt-1'}`}>
                            {canRefund(payment) && (
                              <button
                                onClick={() => handleRefundClick(payment)}
                                className="w-full flex items-start gap-2 px-3 py-2 text-sm hover:bg-orange-50 transition-colors"
                              >
                                <RotateCcw className="w-4 h-4 mt-0.5 text-orange-600 shrink-0" />
                                <span className="text-left">
                                  <span className="block font-medium text-orange-600">Refund (Authorize.Net)</span>
                                  <span className="block text-xs text-gray-500 mt-0.5">Returns money to the original card via the payment gateway. Use for settled transactions.</span>
                                </span>
                              </button>
                            )}
                            {canVoid(payment) && (
                              <button
                                onClick={() => handleVoidClick(payment)}
                                className="w-full flex items-start gap-2 px-3 py-2 text-sm hover:bg-red-50 transition-colors"
                              >
                                <Ban className="w-4 h-4 mt-0.5 text-red-600 shrink-0" />
                                <span className="text-left">
                                  <span className="block font-medium text-red-600">Void Transaction</span>
                                  <span className="block text-xs text-gray-500 mt-0.5">Cancels the transaction before it settles. No money moves — the charge is simply removed.</span>
                                </span>
                              </button>
                            )}
                            {canManualRefund(payment) && (
                              <button
                                onClick={() => handleManualRefundClick(payment)}
                                className="w-full flex items-start gap-2 px-3 py-2 text-sm hover:bg-orange-50 transition-colors"
                              >
                                <RotateCcw className="w-4 h-4 mt-0.5 text-orange-600 shrink-0" />
                                <span className="text-left">
                                  <span className="block font-medium text-orange-600">Manual Refund ({payment.method === 'in-store' ? 'In-Store' : payment.method === 'cash' ? 'Cash' : 'Card'})</span>
                                  <span className="block text-xs text-gray-500 mt-0.5">Records a cash/in-store refund. No gateway involved — marks the refund in the system only.</span>
                                </span>
                              </button>
                            )}
                            {payment.payable_id && (
                              <button
                                onClick={() => {
                                  navigateToPayable(payment);
                                  setOpenActionsMenu(null);
                                }}
                                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                              >
                                <FileText className="w-4 h-4" />
                                View Details
                              </button>
                            )}
                            <button
                              onClick={() => {
                                setConfirmDialog({ type: 'soft-delete', payment });
                                setOpenActionsMenu(null);
                              }}
                              className="w-full flex items-start gap-2 px-3 py-2 text-sm hover:bg-red-50 transition-colors border-t border-gray-100"
                            >
                              <Trash2 className="w-4 h-4 mt-0.5 text-red-500 shrink-0" />
                              <span className="text-left">
                                <span className="block font-medium text-red-600">Delete Payment</span>
                                <span className="block text-xs text-gray-500 mt-0.5">Soft delete — can be restored later. Linked totals will be recalculated.</span>
                              </span>
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                  {!canRefund(payment) && !canVoid(payment) && !canManualRefund(payment) && payment.status !== 'completed' && payment.payable_id && (
                    <button
                      onClick={() => navigateToPayable(payment)}
                      className={`p-2 text-gray-400 hover:text-${themeColor}-600 hover:bg-${themeColor}-50 rounded-lg transition-colors`}
                      title="View Details"
                    >
                      <FileText className="w-4 h-4" />
                    </button>
                  )}
                </div>
              );
            }}
          />
        </>
      )}

      {confirmDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setConfirmDialog(null)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <div className={`p-6 border-b border-gray-100 ${
              confirmDialog.type === 'force-delete' ? 'bg-red-50' :
              confirmDialog.type === 'restore' ? 'bg-green-50' : 'bg-amber-50'
            }`}>
              <div className="flex items-center gap-3">
                {confirmDialog.type === 'force-delete' ? (
                  <AlertTriangle className="w-6 h-6 text-red-600" />
                ) : confirmDialog.type === 'restore' ? (
                  <Undo2 className="w-6 h-6 text-green-600" />
                ) : (
                  <Trash2 className="w-6 h-6 text-amber-600" />
                )}
                <h2 className="text-lg font-bold text-gray-900">
                  {confirmDialog.type === 'soft-delete' && 'Delete Payment'}
                  {confirmDialog.type === 'restore' && 'Restore Payment'}
                  {confirmDialog.type === 'force-delete' && 'Permanently Delete Payment'}
                </h2>
              </div>
            </div>
            <div className="p-6">
              <div className="bg-gray-50 rounded-lg p-4 mb-4 text-sm space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-500">Payment ID</span>
                  <span className="font-medium text-gray-900">#{confirmDialog.payment.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Customer</span>
                  <span className="font-medium text-gray-900">{confirmDialog.payment.customerName || 'Guest'}</span>
                </div>
                {confirmDialog.payment.customerEmail && confirmDialog.payment.customerEmail !== 'N/A' && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Email</span>
                    <span className="font-medium text-gray-900">{confirmDialog.payment.customerEmail}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-500">Amount</span>
                  <span className="font-semibold text-gray-900">${confirmDialog.payment.amount.toFixed(2)} {confirmDialog.payment.currency}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Method</span>
                  <span className="font-medium text-gray-900">{(methodConfig[confirmDialog.payment.method] || { label: confirmDialog.payment.method }).label}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Status</span>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${(statusConfig[confirmDialog.payment.status as keyof typeof statusConfig] || statusConfig.pending).color}`}>
                    {(statusConfig[confirmDialog.payment.status as keyof typeof statusConfig] || statusConfig.pending).label}
                  </span>
                </div>
                {confirmDialog.payment.payableReference && confirmDialog.payment.payableReference !== 'N/A' && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Reference</span>
                    <span className="font-medium text-gray-900">{confirmDialog.payment.payableReference}</span>
                  </div>
                )}
                {confirmDialog.payment.locationName && confirmDialog.payment.locationName !== 'N/A' && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Location</span>
                    <span className="font-medium text-gray-900">{confirmDialog.payment.locationName}</span>
                  </div>
                )}
              </div>
              <p className="text-sm text-gray-600">
                {confirmDialog.type === 'soft-delete' && 'Are you sure you want to delete this payment? It can be restored later. The linked booking/purchase totals will be recalculated.'}
                {confirmDialog.type === 'restore' && 'Are you sure you want to restore this payment? The linked booking/purchase totals will be recalculated.'}
                {confirmDialog.type === 'force-delete' && 'Are you sure you want to permanently delete this payment? This action cannot be undone.'}
              </p>
            </div>
            <div className="p-6 border-t border-gray-100 flex gap-3 justify-end">
              <StandardButton variant="secondary" size="md" onClick={() => setConfirmDialog(null)}>
                Cancel
              </StandardButton>
              {confirmDialog.type === 'soft-delete' && (
                <StandardButton variant="primary" size="md" onClick={() => handleSoftDelete(confirmDialog.payment)}>
                  Delete
                </StandardButton>
              )}
              {confirmDialog.type === 'restore' && (
                <StandardButton variant="primary" size="md" onClick={() => handleRestore(confirmDialog.payment)}>
                  Restore
                </StandardButton>
              )}
              {confirmDialog.type === 'force-delete' && (
                <button
                  onClick={() => handleForceDelete(confirmDialog.payment)}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                >
                  Delete Permanently
                </button>
              )}
            </div>
          </div>
        </div>
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

      {showExportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg bg-${themeColor}-100`}>
                  <FileText className={`w-5 h-5 text-${fullColor}`} />
                </div>
                <h2 className="text-lg font-semibold text-gray-900">Export Invoices</h2>
              </div>
              <button
                onClick={() => setShowExportModal(false)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Export Mode</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setExportMode('custom')}
                    className={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
                      exportMode === 'custom'
                        ? `bg-${fullColor} text-white border-${fullColor}`
                        : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    Custom Filters
                  </button>
                  <button
                    onClick={() => setExportMode('today')}
                    className={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
                      exportMode === 'today'
                        ? `bg-${fullColor} text-white border-${fullColor}`
                        : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    Today Only
                  </button>
                  <button
                    onClick={() => setExportMode('current_week')}
                    className={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
                      exportMode === 'current_week'
                        ? `bg-${fullColor} text-white border-${fullColor}`
                        : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    Current Week
                  </button>
                  <button
                    onClick={() => setExportMode('last_week')}
                    className={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
                      exportMode === 'last_week'
                        ? `bg-${fullColor} text-white border-${fullColor}`
                        : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    Last Week
                  </button>
                </div>
              </div>

              {exportMode === 'week' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Calendar className="w-4 h-4 inline mr-1" />
                    Select Date (week containing this date)
                  </label>
                  <input
                    type="date"
                    value={exportDate}
                    onChange={(e) => setExportDate(e.target.value)}
                    className={`w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-${themeColor}-600 focus:border-${themeColor}-600`}
                  />
                </div>
              )}

              {exportMode === 'custom' && (
                <div className="space-y-3 p-4 bg-gray-50 rounded-lg">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Start Date</label>
                      <input
                        type="date"
                        value={exportFilters.start_date || ''}
                        onChange={(e) => setExportFilters(prev => ({ ...prev, start_date: e.target.value }))}
                        className={`w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-${themeColor}-600 focus:border-${themeColor}-600`}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">End Date</label>
                      <input
                        type="date"
                        value={exportFilters.end_date || ''}
                        onChange={(e) => setExportFilters(prev => ({ ...prev, end_date: e.target.value }))}
                        className={`w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-${themeColor}-600 focus:border-${themeColor}-600`}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Payment Type</label>
                      <select
                        value={exportFilters.payable_type || ''}
                        onChange={(e) => setExportFilters(prev => ({
                          ...prev,
                          payable_type: e.target.value as InvoiceExportFilters['payable_type'] || undefined
                        }))}
                        className={`w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-${themeColor}-600 focus:border-${themeColor}-600`}
                      >
                        <option value="">All Types</option>
                        <option value="booking">Bookings</option>
                        <option value="attraction_purchase">Attractions</option>
                        <option value="event_purchase">Events</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
                      <select
                        value={exportFilters.status || ''}
                        onChange={(e) => setExportFilters(prev => ({
                          ...prev,
                          status: e.target.value as InvoiceExportFilters['status'] || undefined
                        }))}
                        className={`w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-${themeColor}-600 focus:border-${themeColor}-600`}
                      >
                        <option value="">All Statuses</option>
                        <option value="completed">Completed</option>
                        <option value="pending">Pending</option>
                        <option value="failed">Failed</option>
                        <option value="refunded">Refunded</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Payment Method</label>
                    <select
                      value={exportFilters.method || ''}
                      onChange={(e) => setExportFilters(prev => ({
                        ...prev,
                        method: e.target.value as InvoiceExportFilters['method'] || undefined
                      }))}
                      className={`w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-${themeColor}-600 focus:border-${themeColor}-600`}
                    >
                      <option value="">All Methods</option>
                      <option value="card">Card</option>
                      <option value="authorize.net">Authorize.net</option>
                      <option value="cash">Cash</option>
                      <option value="in-store">In-Store</option>
                    </select>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Report Format</label>
                <div className="flex gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="viewMode"
                      value="report"
                      checked={exportFilters.view_mode === 'report'}
                      onChange={() => setExportFilters(prev => ({ ...prev, view_mode: 'report' }))}
                      className={`text-${fullColor} focus:ring-${themeColor}-600`}
                    />
                    <span className="text-sm text-gray-700">Summary Report</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="viewMode"
                      value="individual"
                      checked={exportFilters.view_mode === 'individual'}
                      onChange={() => setExportFilters(prev => ({ ...prev, view_mode: 'individual' }))}
                      className={`text-${fullColor} focus:ring-${themeColor}-600`}
                    />
                    <span className="text-sm text-gray-700">Individual Invoices</span>
                  </label>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {exportFilters.view_mode === 'report'
                    ? 'Single page with table summary of all payments'
                    : 'One invoice per page for each payment'}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50">
              <StandardButton
                variant="ghost"
                onClick={() => setShowExportModal(false)}
                disabled={isExporting}
              >
                Cancel
              </StandardButton>
              <StandardButton
                variant="secondary"
                onClick={() => handleExportFromModal(true)}
                icon={Eye}
                disabled={isExporting}
              >
                View in Browser
              </StandardButton>
              <StandardButton
                variant="primary"
                onClick={() => handleExportFromModal(false)}
                icon={Download}
                disabled={isExporting}
              >
                {isExporting ? 'Exporting...' : 'Download PDF'}
              </StandardButton>
            </div>
          </div>
        </div>
      )}

      {showPackageInvoiceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg bg-${themeColor}-100`}>
                  <Package className={`w-5 h-5 text-${fullColor}`} />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Package Invoices</h2>
                  <p className="text-xs text-gray-500">Export all invoices for a specific package</p>
                </div>
              </div>
              <button
                onClick={() => setShowPackageInvoiceModal(false)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Select Package *</label>
                {loadingPackages ? (
                  <div className="flex items-center justify-center py-4">
                    <div className={`animate-spin rounded-full h-6 w-6 border-b-2 border-${fullColor}`}></div>
                  </div>
                ) : (
                  <select
                    value={packageInvoiceFilters.package_id || ''}
                    onChange={(e) => setPackageInvoiceFilters(prev => ({
                      ...prev,
                      package_id: parseInt(e.target.value) || 0
                    }))}
                    className={`w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-${themeColor}-600 focus:border-${themeColor}-600`}
                  >
                    <option value="">-- Select a package --</option>
                    {availablePackages.map((pkg) => (
                      <option key={pkg.id} value={pkg.id}>{pkg.name}</option>
                    ))}
                  </select>
                )}
              </div>

              <div className="space-y-3 p-4 bg-gray-50 rounded-lg">
                <p className="text-xs font-medium text-gray-600 uppercase">Optional Filters</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Start Date</label>
                    <input
                      type="date"
                      value={packageInvoiceFilters.start_date || ''}
                      onChange={(e) => setPackageInvoiceFilters(prev => ({ ...prev, start_date: e.target.value || undefined }))}
                      className={`w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-${themeColor}-600 focus:border-${themeColor}-600`}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">End Date</label>
                    <input
                      type="date"
                      value={packageInvoiceFilters.end_date || ''}
                      onChange={(e) => setPackageInvoiceFilters(prev => ({ ...prev, end_date: e.target.value || undefined }))}
                      className={`w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-${themeColor}-600 focus:border-${themeColor}-600`}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Payment Status</label>
                  <select
                    value={packageInvoiceFilters.status || ''}
                    onChange={(e) => setPackageInvoiceFilters(prev => ({
                      ...prev,
                      status: e.target.value as PackageInvoiceFilters['status'] || undefined
                    }))}
                    className={`w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-${themeColor}-600 focus:border-${themeColor}-600`}
                  >
                    <option value="">All Statuses</option>
                    <option value="completed">Completed</option>
                    <option value="pending">Pending</option>
                    <option value="failed">Failed</option>
                    <option value="refunded">Refunded</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50">
              <StandardButton
                variant="ghost"
                onClick={() => setShowPackageInvoiceModal(false)}
                disabled={isExporting}
              >
                Cancel
              </StandardButton>
              <StandardButton
                variant="secondary"
                onClick={() => handlePackageInvoiceExport(true)}
                icon={Eye}
                disabled={isExporting || !packageInvoiceFilters.package_id}
              >
                View in Browser
              </StandardButton>
              <StandardButton
                variant="primary"
                onClick={() => handlePackageInvoiceExport(false)}
                icon={Download}
                disabled={isExporting || !packageInvoiceFilters.package_id}
              >
                {isExporting ? 'Exporting...' : 'Download PDF'}
              </StandardButton>
            </div>
          </div>
        </div>
      )}

      <RefundModal
        payment={selectedPaymentForAction}
        open={showRefundModal}
        onClose={() => {
          setShowRefundModal(false);
          setSelectedPaymentForAction(null);
        }}
        onRefundComplete={handleRefundComplete}
        onToast={(message, type) => setToast({ message, type })}
      />

      <VoidDialog
        payment={selectedPaymentForAction}
        open={showVoidDialog}
        onClose={() => {
          setShowVoidDialog(false);
          setSelectedPaymentForAction(null);
        }}
        onVoidComplete={handleVoidComplete}
        onToast={(message, type) => setToast({ message, type })}
      />

      <ManualRefundModal
        payment={selectedPaymentForAction}
        open={showManualRefundModal}
        onClose={() => {
          setShowManualRefundModal(false);
          setSelectedPaymentForAction(null);
        }}
        onRefundComplete={handleManualRefundComplete}
        onToast={(message, type) => setToast({ message, type })}
      />

      {showSignatureModal && signatureModalPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowSignatureModal(false)}>
          <div
            className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg bg-${themeColor}-100`}>
                  <PenLine className={`w-5 h-5 text-${fullColor}`} />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Signature & Terms</h2>
                  <p className="text-xs text-gray-500">Payment #{signatureModalPayment.id} &mdash; {signatureModalPayment.customerName}</p>
                </div>
              </div>
              <button
                onClick={() => setShowSignatureModal(false)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-5">
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Terms & Conditions</h3>
                {signatureModalPayment.terms_accepted === true ? (
                  <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg">
                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                    <span className="text-sm text-green-800 font-medium">Accepted</span>
                  </div>
                ) : signatureModalPayment.terms_accepted === false ? (
                  <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg">
                    <XCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                    <span className="text-sm text-red-800 font-medium">Not Accepted</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg">
                    <Clock className="w-5 h-5 text-gray-400 flex-shrink-0" />
                    <span className="text-sm text-gray-500">No data available</span>
                  </div>
                )}
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Signature</h3>
                {signatureModalPayment.signature_image ? (
                  <div className="border-2 border-gray-200 rounded-lg p-4 bg-white">
                    <img
                      src={getImageUrl(signatureModalPayment.signature_image)}
                      alt="Customer signature"
                      className="max-h-[200px] w-full object-contain"
                    />
                  </div>
                ) : (
                  <div className="flex items-center gap-2 px-3 py-6 bg-gray-50 border border-gray-200 rounded-lg justify-center">
                    <PenLine className="w-5 h-5 text-gray-400" />
                    <span className="text-sm text-gray-500">No signature provided</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end px-6 py-4 border-t border-gray-100 bg-gray-50">
              <StandardButton
                variant="secondary"
                size="md"
                onClick={() => setShowSignatureModal(false)}
              >
                Close
              </StandardButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Payments;
