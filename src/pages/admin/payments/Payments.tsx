// src/pages/admin/payments/Payments.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Filter,
  RefreshCcw,
  Download,
  CreditCard,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  DollarSign,
  FileText,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Package,
  Ticket,
  Printer,
  CheckSquare,
  Square,
  X,
  Calendar,
  RotateCcw,
  Ban,
  MoreVertical
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
  type InvoiceExportFilters,
  type PackageInvoiceFilters
} from '../../../services/PaymentService';
import { locationService } from '../../../services/LocationService';
import { packageService } from '../../../services/PackageService';
import LocationSelector from '../../../components/admin/LocationSelector';
import StandardButton from '../../../components/ui/StandardButton';
import Toast from '../../../components/ui/Toast';
import CounterAnimation from '../../../components/ui/CounterAnimation';
import RefundModal from '../../../components/admin/payments/RefundModal';
import VoidDialog from '../../../components/admin/payments/VoidDialog';
import ManualRefundModal from '../../../components/admin/payments/ManualRefundModal';
import { getStoredUser } from '../../../utils/storage';
import type { PaymentsPagePayment, PaymentsFilterOptions, PaymentsMetrics } from '../../../types/Payments.types';
import type { Payment, PaymentFilters, RefundResponse, VoidResponse, ManualRefundResponse } from '../../../types/Payment.types';

const Payments: React.FC = () => {
  const navigate = useNavigate();
  const { themeColor, fullColor } = useThemeColor();
  const currentUser = getStoredUser();
  const isCompanyAdmin = currentUser?.role === 'company_admin';
  const isLocationManager = currentUser?.role === 'location_manager';
  
  // State
  const [payments, setPayments] = useState<PaymentsPagePayment[]>([]);
  const [filteredPayments, setFilteredPayments] = useState<PaymentsPagePayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  const [locations, setLocations] = useState<Array<{ id: number; name: string }>>([]);
  const [filters, setFilters] = useState<PaymentsFilterOptions>({
    status: 'all',
    method: 'all',
    payable_type: 'all',
    search: '',
    dateRange: 'all',
    startDate: '',
    endDate: ''
  });
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [sortField, setSortField] = useState<'created_at' | 'amount' | 'status'>('created_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [totalPages, setTotalPages] = useState(1);
  
  // Selection state for bulk actions
  const [selectedPayments, setSelectedPayments] = useState<Set<number>>(new Set());
  const [isExporting, setIsExporting] = useState(false);
  
  // Invoice Export Modal state
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportMode, setExportMode] = useState<'custom' | 'today' | 'week' | 'current_week' | 'last_week'>('custom');
  const [exportFilters, setExportFilters] = useState<InvoiceExportFilters>({
    view_mode: 'report'
  });
  const [exportDate, setExportDate] = useState<string>(new Date().toISOString().split('T')[0]);

  // Package Invoice Export Modal state
  const [showPackageInvoiceModal, setShowPackageInvoiceModal] = useState(false);
  const [packageInvoiceFilters, setPackageInvoiceFilters] = useState<PackageInvoiceFilters>({
    package_id: 0
  });
  const [availablePackages, setAvailablePackages] = useState<Array<{ id: number; name: string }>>([]);
  const [loadingPackages, setLoadingPackages] = useState(false);

  // Status and method configuration
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
    attraction_purchase: { icon: Ticket, label: 'Attraction Purchase', color: 'bg-purple-100 text-purple-800' }
  };

  // Calculate metrics
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

  // Load payments from backend
  const loadPayments = useCallback(async () => {
    try {
      setLoading(true);
      
      const params: PaymentFilters = {
        per_page: 1000, // Load all for client-side filtering
      };
      
      // Apply location filter
      if (selectedLocation) {
        params.location_id = parseInt(selectedLocation);
      } else if (isLocationManager && currentUser?.location_id) {
        params.location_id = currentUser.location_id;
      }

      const response = await getPayments(params);

      console.log('Payments response:', response);
      
      if (response.success && response.data) {
        const transformedPayments: PaymentsPagePayment[] = response.data.payments.map((payment: Payment) => {
          // Get booking or attraction purchase details
          const booking = payment.booking;
          const attractionPurchase = payment.attractionPurchase || payment.attraction_purchase;
          
          // Determine customer name from payment relationships or booking/purchase
          let customerName = 'Guest';
          let customerEmail = 'N/A';
          
          if (payment.customer) {
            customerName = `${payment.customer.first_name} ${payment.customer.last_name}`;
            customerEmail = payment.customer.email || 'N/A';
          } else if (payment.payable_type === PAYMENT_TYPE.BOOKING && booking) {
            customerName = booking.guest_name || 'Guest';
            customerEmail = booking.guest_email || 'N/A';
          } else if (payment.payable_type === PAYMENT_TYPE.ATTRACTION_PURCHASE && attractionPurchase) {
            customerName = attractionPurchase.guest_name || 'Guest';
            customerEmail = attractionPurchase.guest_email || 'N/A';
          }
          
          // Build reference string with more details
          let payableReference = 'N/A';
          let payableDescription = 'Unknown';
          
          if (payment.payable_type === PAYMENT_TYPE.BOOKING && booking) {
            payableReference = booking.reference_number || `Booking #${payment.payable_id}`;
            payableDescription = `Package Booking • ${booking.participants || 0} guests`;
          } else if (payment.payable_type === PAYMENT_TYPE.BOOKING) {
            payableReference = `Booking #${payment.payable_id}`;
            payableDescription = 'Package Booking';
          } else if (payment.payable_type === PAYMENT_TYPE.ATTRACTION_PURCHASE && attractionPurchase) {
            payableReference = attractionPurchase.transaction_id || `Purchase #${payment.payable_id}`;
            payableDescription = `Attraction • Qty: ${attractionPurchase.quantity || 1}`;
          } else if (payment.payable_type === PAYMENT_TYPE.ATTRACTION_PURCHASE) {
            payableReference = `Purchase #${payment.payable_id}`;
            payableDescription = 'Attraction Purchase';
          }
          
          return {
            id: payment.id,
            payable_id: payment.payable_id,
            payable_type: payment.payable_type,
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
            // Relationships
            booking: booking,
            attractionPurchase: attractionPurchase,
            // Display-friendly fields
            customerName,
            customerEmail,
            locationName: payment.location?.name || 'N/A',
            payableReference,
            payableDescription,
            // Additional details
            bookingDate: booking?.booking_date,
            bookingTime: booking?.booking_time,
            participants: booking?.participants,
            guestName: booking?.guest_name || attractionPurchase?.guest_name,
          };
        });

        setPayments(transformedPayments);
      }
    } catch (error) {
      console.error('Error loading payments:', error);
      setToast({ message: 'Failed to load payments', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [selectedLocation, isLocationManager, currentUser?.location_id]);

  // Apply filters to payments
  const applyFilters = useCallback(() => {
    let result = [...payments];

    // Apply search filter
    if (filters.search) {
      const searchTerm = filters.search.toLowerCase();
      result = result.filter(payment =>
        payment.transaction_id?.toLowerCase().includes(searchTerm) ||
        payment.customerName?.toLowerCase().includes(searchTerm) ||
        payment.customerEmail?.toLowerCase().includes(searchTerm) ||
        payment.notes?.toLowerCase().includes(searchTerm) ||
        payment.payableReference?.toLowerCase().includes(searchTerm)
      );
    }

    // Apply status filter
    if (filters.status !== 'all') {
      result = result.filter(payment => payment.status === filters.status);
    }

    // Apply method filter
    if (filters.method !== 'all') {
      result = result.filter(payment => payment.method === filters.method);
    }

    // Apply payable type filter
    if (filters.payable_type !== 'all') {
      result = result.filter(payment => payment.payable_type === filters.payable_type);
    }

    // Apply date range filter
    if (filters.dateRange !== 'all') {
      const now = new Date();
      let startDate: Date;

      switch (filters.dateRange) {
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

      result = result.filter(payment => new Date(payment.created_at) >= startDate);
    }

    // Apply custom date range
    if (filters.startDate) {
      result = result.filter(payment => new Date(payment.created_at) >= new Date(filters.startDate));
    }
    if (filters.endDate) {
      const endDate = new Date(filters.endDate);
      endDate.setHours(23, 59, 59, 999);
      result = result.filter(payment => new Date(payment.created_at) <= endDate);
    }

    // Apply sorting
    result.sort((a, b) => {
      let aVal: string | number, bVal: string | number;
      switch (sortField) {
        case 'amount':
          aVal = a.amount;
          bVal = b.amount;
          break;
        case 'status':
          aVal = a.status;
          bVal = b.status;
          break;
        default:
          aVal = new Date(a.created_at).getTime();
          bVal = new Date(b.created_at).getTime();
      }

      if (sortDirection === 'asc') {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });

    setFilteredPayments(result);
    setTotalPages(Math.ceil(result.length / itemsPerPage));
  }, [payments, filters, sortField, sortDirection, itemsPerPage]);

  // Load locations for company admin
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

  // Effects
  useEffect(() => {
    loadLocations();
  }, [loadLocations]);

  useEffect(() => {
    loadPayments();
  }, [loadPayments]);

  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filters]);

  // Handlers
  const handleFilterChange = (key: keyof PaymentsFilterOptions, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({
      status: 'all',
      method: 'all',
      payable_type: 'all',
      search: '',
      dateRange: 'all',
      startDate: '',
      endDate: ''
    });
  };

  const handleSort = (field: 'created_at' | 'amount' | 'status') => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // Selection handlers
  const togglePaymentSelection = (paymentId: number) => {
    setSelectedPayments(prev => {
      const newSet = new Set(prev);
      if (newSet.has(paymentId)) {
        newSet.delete(paymentId);
      } else {
        newSet.add(paymentId);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedPayments.size === currentPayments.length) {
      setSelectedPayments(new Set());
    } else {
      setSelectedPayments(new Set(currentPayments.map(p => p.id)));
    }
  };

  const clearSelection = () => {
    setSelectedPayments(new Set());
  };

  // Invoice handlers - using unified getInvoice function
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

  const handleBulkExportInvoices = async (stream: boolean = false) => {
    if (selectedPayments.size === 0) {
      setToast({ message: 'Please select payments to export', type: 'error' });
      return;
    }

    try {
      setIsExporting(true);
      setToast({ message: `${stream ? 'Opening' : 'Exporting'} ${selectedPayments.size} invoice(s)...`, type: 'info' });
      await exportBulkInvoices(Array.from(selectedPayments), !stream);
      setToast({ message: `Invoices ${stream ? 'opened' : 'exported'} successfully`, type: 'success' });
      setSelectedPayments(new Set());
    } catch (error) {
      console.error('Error exporting invoices:', error);
      setToast({ message: 'Failed to export invoices', type: 'error' });
    } finally {
      setIsExporting(false);
    }
  };

  // Open export modal
  const openExportModal = () => {
    // Pre-fill export filters from current page filters
    const newExportFilters: InvoiceExportFilters = {
      view_mode: 'report'
    };
    
    if (selectedLocation) {
      newExportFilters.location_id = parseInt(selectedLocation);
    } else if (isLocationManager && currentUser?.location_id) {
      newExportFilters.location_id = currentUser.location_id;
    }
    
    if (filters.status !== 'all') newExportFilters.status = filters.status as InvoiceExportFilters['status'];
    if (filters.method !== 'all') newExportFilters.method = filters.method as InvoiceExportFilters['method'];
    if (filters.payable_type !== 'all') newExportFilters.payable_type = filters.payable_type as InvoiceExportFilters['payable_type'];
    if (filters.startDate) newExportFilters.start_date = filters.startDate;
    if (filters.endDate) newExportFilters.end_date = filters.endDate;
    
    setExportFilters(newExportFilters);
    setShowExportModal(true);
  };

  // Handle export from modal
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
        // Calculate a date from last week (7 days ago)
        const lastWeekDate = new Date();
        lastWeekDate.setDate(lastWeekDate.getDate() - 7);
        await exportInvoicesForWeek(lastWeekDate.toISOString().split('T')[0], stream);
      } else if (exportMode === 'week') {
        await exportInvoicesForWeek(exportDate, stream);
      } else {
        // Custom mode - use all filters
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

  // Open Package Invoice Modal
  const handleOpenPackageInvoiceModal = async () => {
    setShowPackageInvoiceModal(true);
    setLoadingPackages(true);
    
    try {
      // Get location_id for filtering packages
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
    
    // Reset filters
    setPackageInvoiceFilters({
      package_id: 0
    });
  };

  // Handle Package Invoice Export
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

  const exportToCSV = () => {
    const headers = ['ID', 'Transaction ID', 'Type', 'Customer', 'Email', 'Amount', 'Method', 'Status', 'Location', 'Date'];
    const csvData = filteredPayments.map(payment => [
      payment.id,
      payment.transaction_id,
      payment.payable_type === PAYMENT_TYPE.BOOKING ? 'Booking' : 'Attraction Purchase',
      payment.customerName,
      payment.customerEmail,
      payment.amount.toFixed(2),
      payment.method,
      payment.status,
      payment.locationName,
      new Date(payment.created_at).toLocaleString()
    ]);

    const csvContent = [
      headers.join(','),
      ...csvData.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `payments-export-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    
    setToast({ message: 'Payments exported successfully', type: 'success' });
  };

  // Refund/Void state
  const [selectedPaymentForAction, setSelectedPaymentForAction] = useState<PaymentsPagePayment | null>(null);
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [showVoidDialog, setShowVoidDialog] = useState(false);
  const [showManualRefundModal, setShowManualRefundModal] = useState(false);
  const [openActionsMenu, setOpenActionsMenu] = useState<number | null>(null);

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
    // Update the payments list:
    // 1. Update the original payment (notes changed)
    // 2. Add the new refund payment record to the list
    setPayments((prev) => {
      const updated = prev.map((p) =>
        p.id === response.data.original_payment.id
          ? { ...p, notes: response.data.original_payment.notes ?? p.notes }
          : p
      );
      // Create a new display-friendly refund record
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
      // Insert the refund record right after the original
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
    // Update the payments list:
    // 1. Update the original payment (status → voided)
    // 2. Add the new void payment record
    setPayments((prev) => {
      const updated = prev.map((p) =>
        p.id === response.data.original_payment.id
          ? { ...p, status: 'voided' as const, notes: response.data.original_payment.notes ?? p.notes }
          : p
      );
      // Create a void audit record
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
    // Same pattern as handleRefundComplete — update original + add refund record
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Pagination
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentPayments = filteredPayments.slice(indexOfFirstItem, indexOfLastItem);

  const paginate = (pageNumber: number) => setCurrentPage(pageNumber);

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
        </div>
      </div>

      {/* Metrics Grid */}
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

      {/* Filters and Search */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-6">
        {/* Bulk Actions Bar - Shows when items are selected */}
        {selectedPayments.size > 0 && (
          <div className={`flex items-center justify-between p-3 mb-4 rounded-lg bg-${themeColor}-50 border border-${themeColor}-200`}>
            <div className="flex items-center gap-3">
              <span className={`text-sm font-medium text-${themeColor}-800`}>
                {selectedPayments.size} payment(s) selected
              </span>
              <button
                onClick={clearSelection}
                className={`text-sm text-${themeColor}-600 hover:text-${themeColor}-800 underline`}
              >
                Clear selection
              </button>
            </div>
            <div className="flex items-center gap-2">
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
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="relative flex-1 max-w-lg">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-600" />
            </div>
            <input
              type="text"
              placeholder="Search payments..."
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              className={`pl-9 pr-3 py-1.5 border border-gray-200 rounded-lg w-full text-sm focus:ring-2 focus:ring-${themeColor}-600 focus:border-${themeColor}-600`}
            />
          </div>
          <div className="flex gap-1">
            <StandardButton
              variant="secondary"
              size="sm"
              icon={Filter}
              onClick={() => setShowFilters(!showFilters)}
            >
              Filters
            </StandardButton>
            <StandardButton
              variant="secondary"
              size="sm"
              icon={RefreshCcw}
              onClick={loadPayments}
            >
              {''}
            </StandardButton>
          </div>
        </div>

        {/* Advanced Filters */}
        {showFilters && (
          <div className="mt-3 p-3 bg-gray-50 rounded-lg">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-800 mb-1">Status</label>
                <select
                  value={filters.status}
                  onChange={(e) => handleFilterChange('status', e.target.value)}
                  className={`w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-${themeColor}-600 focus:border-${themeColor}-600`}
                >
                  <option value="all">All Statuses</option>
                  <option value="completed">Completed</option>
                  <option value="pending">Pending</option>
                  <option value="failed">Failed</option>
                  <option value="refunded">Refunded</option>
                  <option value="voided">Voided</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-800 mb-1">Payment Method</label>
                <select
                  value={filters.method}
                  onChange={(e) => handleFilterChange('method', e.target.value)}
                  className={`w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-${themeColor}-600 focus:border-${themeColor}-600`}
                >
                  <option value="all">All Methods</option>
                  <option value="card">Card</option>
                  <option value="cash">Cash</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-800 mb-1">Payment Type</label>
                <select
                  value={filters.payable_type}
                  onChange={(e) => handleFilterChange('payable_type', e.target.value)}
                  className={`w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-${themeColor}-600 focus:border-${themeColor}-600`}
                >
                  <option value="all">All Types</option>
                  <option value="booking">Bookings</option>
                  <option value="attraction_purchase">Attractions</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-800 mb-1">Date Range</label>
                <select
                  value={filters.dateRange}
                  onChange={(e) => handleFilterChange('dateRange', e.target.value)}
                  className={`w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-${themeColor}-600 focus:border-${themeColor}-600`}
                >
                  <option value="all">All Time</option>
                  <option value="today">Today</option>
                  <option value="week">This Week</option>
                  <option value="month">This Month</option>
                  <option value="year">This Year</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-3">
              <div>
                <label className="block text-xs font-medium text-gray-800 mb-1">From Date</label>
                <input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => handleFilterChange('startDate', e.target.value)}
                  className={`w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-${themeColor}-600 focus:border-${themeColor}-600`}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-800 mb-1">To Date</label>
                <input
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => handleFilterChange('endDate', e.target.value)}
                  className={`w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-${themeColor}-600 focus:border-${themeColor}-600`}
                />
              </div>
            </div>
            <div className="mt-3 flex justify-end">
              <StandardButton
                variant="ghost"
                size="sm"
                onClick={clearFilters}
              >
                Clear Filters
              </StandardButton>
            </div>
          </div>
        )}
      </div>

      {/* Payments Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-4 py-4 text-left">
                  <button
                    onClick={toggleSelectAll}
                    className={`p-1 rounded hover:bg-${themeColor}-100 transition-colors`}
                    title={selectedPayments.size === currentPayments.length ? 'Deselect all' : 'Select all'}
                  >
                    {selectedPayments.size === currentPayments.length && currentPayments.length > 0 ? (
                      <CheckSquare className={`w-5 h-5 text-${fullColor}`} />
                    ) : (
                      <Square className="w-5 h-5 text-gray-400" />
                    )}
                  </button>
                </th>
                <th className="px-4 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Transaction
                </th>
                <th className="px-4 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-4 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Customer
                </th>
                <th 
                  className="px-4 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => handleSort('amount')}
                >
                  <div className="flex items-center gap-1">
                    Amount
                    <ArrowUpDown className={`w-4 h-4 ${sortField === 'amount' ? `text-${fullColor}` : ''}`} />
                  </div>
                </th>
                <th className="px-4 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Method
                </th>
                <th 
                  className="px-4 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => handleSort('status')}
                >
                  <div className="flex items-center gap-1">
                    Status
                    <ArrowUpDown className={`w-4 h-4 ${sortField === 'status' ? `text-${fullColor}` : ''}`} />
                  </div>
                </th>
                {isCompanyAdmin && (
                  <th className="px-4 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Location
                  </th>
                )}
                <th 
                  className="px-4 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors min-w-[180px]"
                  onClick={() => handleSort('created_at')}
                >
                  <div className="flex items-center gap-1">
                    Date
                    <ArrowUpDown className={`w-4 h-4 ${sortField === 'created_at' ? `text-${fullColor}` : ''}`} />
                  </div>
                </th>
                <th className="px-4 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {currentPayments.length === 0 ? (
                <tr>
                  <td colSpan={isCompanyAdmin ? 10 : 9} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center">
                      <CreditCard className="w-12 h-12 text-gray-300 mb-3" />
                      <p className="text-gray-500 text-lg font-medium">No payments found</p>
                      <p className="text-gray-400 text-sm mt-1">Try adjusting your filters</p>
                    </div>
                  </td>
                </tr>
              ) : (
                currentPayments.map((payment, paymentIndex) => {
                  const StatusIcon = statusConfig[payment.status]?.icon || Clock;
                  const MethodIcon = methodConfig[payment.method]?.icon || CreditCard;
                  const TypeIcon = payment.payable_type ? payableTypeConfig[payment.payable_type]?.icon : FileText;
                  const isSelected = selectedPayments.has(payment.id);
                  const isRefund = isRefundRecord(payment);
                  const isVoid = isVoidRecord(payment);
                  const originalId = extractOriginalPaymentId(payment.notes);
                  
                  return (
                    <tr 
                      key={payment.id} 
                      className={`hover:bg-gray-50 transition-colors ${
                        isSelected ? `bg-${themeColor}-50` : 
                        isRefund ? 'bg-orange-50/50' : 
                        isVoid ? 'bg-red-50/50' : ''
                      }`}
                    >
                      <td className="px-4 py-4">
                        <button
                          onClick={() => togglePaymentSelection(payment.id)}
                          className={`p-1 rounded hover:bg-${themeColor}-100 transition-colors`}
                        >
                          {isSelected ? (
                            <CheckSquare className={`w-5 h-5 text-${fullColor}`} />
                          ) : (
                            <Square className="w-5 h-5 text-gray-400" />
                          )}
                        </button>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-900">
                            {payment.transaction_id || `TXN-${payment.id}`}
                          </span>
                          <span className="text-xs text-gray-500">
                            ID: {payment.id}
                            {isRefund && originalId && (
                              <span className="ml-1 text-orange-600">(↩ from #{originalId})</span>
                            )}
                            {isVoid && originalId && (
                              <span className="ml-1 text-red-600">(✕ from #{originalId})</span>
                            )}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <div className={`p-1.5 rounded-lg ${
                            isRefund ? 'bg-orange-100 text-orange-600' :
                            isVoid ? 'bg-red-100 text-red-600' :
                            payment.payable_type ? payableTypeConfig[payment.payable_type]?.color : 'bg-gray-100 text-gray-600'
                          }`}>
                            {isRefund ? <RotateCcw className="w-4 h-4" /> :
                             isVoid ? <Ban className="w-4 h-4" /> :
                             TypeIcon && <TypeIcon className="w-4 h-4" />}
                          </div>
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-gray-900">
                              {payment.payableReference}
                            </span>
                            <span className="text-xs text-gray-500">
                              {isRefund ? 'Refund Record' : isVoid ? 'Void Record' : payment.payableDescription}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-900">{payment.customerName}</span>
                          <span className="text-xs text-gray-500">{payment.customerEmail}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        {payment.status === 'refunded' || payment.status === 'voided' ? (
                          <span className="text-sm font-bold text-red-600">
                            -${payment.amount.toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-sm font-bold text-gray-900">
                            ${payment.amount.toFixed(2)}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <MethodIcon className="w-4 h-4 text-gray-500" />
                          <span className="text-sm text-gray-600 capitalize">{payment.method}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${statusConfig[payment.status]?.color}`}>
                          <StatusIcon className="w-3.5 h-3.5" />
                          {statusConfig[payment.status]?.label}
                        </span>
                      </td>
                      {isCompanyAdmin && (
                        <td className="px-4 py-4">
                          <span className="text-sm text-gray-600">{payment.locationName}</span>
                        </td>
                      )}
                      <td className="px-4 py-4 min-w-[180px]">
                        <span className="text-sm text-gray-900 whitespace-nowrap">{formatDate(payment.created_at)}</span>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <div className="relative flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleInvoice(payment.id, false)}
                            className={`p-2 text-gray-400 hover:text-${themeColor}-600 hover:bg-${themeColor}-50 rounded-lg transition-colors`}
                            title="Download Invoice"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                          {/* Actions dropdown for refund/void/manual-refund */}
                          {(canRefund(payment) || canVoid(payment) || canManualRefund(payment)) && (
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
                                  <div className={`absolute right-0 w-56 bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1 ${paymentIndex >= currentPayments.length - 3 ? 'bottom-full mb-1' : 'top-full mt-1'}`}>
                                    {canRefund(payment) && (
                                      <button
                                        onClick={() => handleRefundClick(payment)}
                                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-orange-600 hover:bg-orange-50 transition-colors"
                                      >
                                        <RotateCcw className="w-4 h-4" />
                                        Refund (Authorize.Net)
                                      </button>
                                    )}
                                    {canVoid(payment) && (
                                      <button
                                        onClick={() => handleVoidClick(payment)}
                                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                                      >
                                        <Ban className="w-4 h-4" />
                                        Void Transaction
                                      </button>
                                    )}
                                    {canManualRefund(payment) && (
                                      <button
                                        onClick={() => handleManualRefundClick(payment)}
                                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-orange-600 hover:bg-orange-50 transition-colors"
                                      >
                                        <RotateCcw className="w-4 h-4" />
                                        Manual Refund ({payment.method === 'in-store' ? 'In-Store' : payment.method === 'cash' ? 'Cash' : 'Card'})
                                      </button>
                                    )}
                                    {payment.payable_id && (
                                      <button
                                        onClick={() => {
                                          if (payment.payable_type === PAYMENT_TYPE.BOOKING) {
                                            navigate(`/bookings/${payment.payable_id}`);
                                          } else if (payment.payable_type === PAYMENT_TYPE.ATTRACTION_PURCHASE) {
                                            navigate(`/attractions/purchases/${payment.payable_id}`);
                                          }
                                          setOpenActionsMenu(null);
                                        }}
                                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                                      >
                                        <FileText className="w-4 h-4" />
                                        View Details
                                      </button>
                                    )}
                                  </div>
                                </>
                              )}
                            </div>
                          )}
                          {/* Simple details button for non-actionable payments */}
                          {!canRefund(payment) && !canVoid(payment) && !canManualRefund(payment) && payment.payable_id && (
                            <button
                              onClick={() => {
                                if (payment.payable_type === PAYMENT_TYPE.BOOKING) {
                                  navigate(`/bookings/${payment.payable_id}`);
                                } else if (payment.payable_type === PAYMENT_TYPE.ATTRACTION_PURCHASE) {
                                  navigate(`/attractions/purchases/${payment.payable_id}`);
                                }
                              }}
                              className={`p-2 text-gray-400 hover:text-${themeColor}-600 hover:bg-${themeColor}-50 rounded-lg transition-colors`}
                              title="View Details"
                            >
                              <FileText className="w-4 h-4" />
                            </button>
                          )}
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
        {filteredPayments.length > 0 && (
          <div className="px-6 py-4 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-sm text-gray-500">
              Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, filteredPayments.length)} of {filteredPayments.length} payments
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => paginate(currentPage - 1)}
                disabled={currentPage === 1}
                className="p-2 rounded-lg border border-gray-200 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum;
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
                    onClick={() => paginate(pageNum)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      currentPage === pageNum
                        ? `bg-${fullColor} text-white`
                        : `text-gray-600 hover:bg-${themeColor}-50`
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
              
              <button
                onClick={() => paginate(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="p-2 rounded-lg border border-gray-200 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
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

      {/* Invoice Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
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

            {/* Modal Body */}
            <div className="px-6 py-4 space-y-4">
              {/* Export Mode Selection */}
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

              {/* Week by Date */}
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

              {/* Custom Filters */}
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
                      <option value="cash">Cash</option>
                    </select>
                  </div>
                </div>
              )}

              {/* View Mode Selection */}
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

            {/* Modal Footer */}
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

      {/* Package Invoice Export Modal */}
      {showPackageInvoiceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
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

            {/* Modal Body */}
            <div className="px-6 py-4 space-y-4">
              {/* Package Selection */}
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

              {/* Date Filters */}
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

            {/* Modal Footer */}
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

      {/* Refund Modal */}
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

      {/* Void Dialog */}
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

      {/* Manual Refund Modal */}
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
    </div>
  );
};

export default Payments;
