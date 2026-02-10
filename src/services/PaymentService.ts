import axios from 'axios';
import { API_BASE_URL, getStoredUser } from '../utils/storage';
import type {
  PaymentChargeRequest,
  PaymentChargeResponse,
  CreatePaymentRequest,
  Payment,
  PaymentApiResponse,
  AcceptJSSecureData,
  AcceptJSResponse,
  PaymentOpaqueData,
  PaymentFilters,
  PaginatedPaymentsResponse,
  RefundRequest,
  RefundResponse,
  VoidResponse,
  ManualRefundRequest,
  ManualRefundResponse,
  LinkPayableRequest,
  LinkPayableResponse,
} from '../types/Payment.types';
import { PAYMENT_TYPE } from '../types/Payment.types';

// Create axios instance with base configuration
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

// Add request interceptor to include auth token
api.interceptors.request.use(
  (config) => {
    const token = getStoredUser()?.token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

/**
 * Payment Processing Service
 */

/**
 * Process payment using Accept.js (Authorize.Net)
 * This method receives tokenized payment data from the frontend
 * 
 * @param data - Payment charge request with opaque data
 * @returns Payment charge response with transaction details
 */
export const chargePayment = async (
  data: PaymentChargeRequest
): Promise<PaymentChargeResponse> => {
  const response = await api.post<PaymentChargeResponse>('/payments/charge', data);
  return response.data;
};

/**
 * Create a payment record
 * 
 * @param data - Payment creation data
 * @returns Created payment record
 */
export const createPayment = async (
  data: CreatePaymentRequest
): Promise<PaymentApiResponse<Payment>> => {
  const response = await api.post<PaymentApiResponse<Payment>>('/payments', data);
  return response.data;
};

/**
 * Get payment by ID
 * 
 * @param id - Payment ID
 * @returns Payment details
 */
export const getPayment = async (id: number): Promise<PaymentApiResponse<Payment>> => {
  const response = await api.get<PaymentApiResponse<Payment>>(`/payments/${id}`);
  return response.data;
};

/**
 * Get all payments with optional filters
 * 
 * @param filters - Optional filters (payable_id, payable_type, customer_id, status, etc.)
 * @returns Paginated list of payments
 */
export const getPayments = async (filters?: PaymentFilters): Promise<PaginatedPaymentsResponse> => {
  const response = await api.get<PaginatedPaymentsResponse>('/payments', { params: filters });
  return response.data;
};

/**
 * Get payments for a specific booking
 * 
 * @param bookingId - Booking ID
 * @returns List of payments for the booking
 */
export const getPaymentsForBooking = async (bookingId: number): Promise<PaginatedPaymentsResponse> => {
  return getPayments({
    payable_id: bookingId,
    payable_type: PAYMENT_TYPE.BOOKING,
  });
};

/**
 * Get payments for a specific attraction purchase
 * 
 * @param purchaseId - Attraction purchase ID
 * @returns List of payments for the attraction purchase
 */
export const getPaymentsForAttractionPurchase = async (purchaseId: number): Promise<PaginatedPaymentsResponse> => {
  return getPayments({
    payable_id: purchaseId,
    payable_type: PAYMENT_TYPE.ATTRACTION_PURCHASE,
  });
};

/**
 * Update payment status
 * 
 * @param id - Payment ID
 * @param data - Update data
 * @returns Updated payment
 */
export const updatePayment = async (
  id: number,
  data: Partial<CreatePaymentRequest>
): Promise<PaymentApiResponse<Payment>> => {
  const response = await api.put<PaymentApiResponse<Payment>>(`/payments/${id}`, data);
  return response.data;
};

/**
 * Delete payment
 * 
 * @param id - Payment ID
 * @returns Success response
 */
export const deletePayment = async (id: number): Promise<PaymentApiResponse> => {
  const response = await api.delete<PaymentApiResponse>(`/payments/${id}`);
  return response.data;
};

/**
 * Refund & Void Functions
 */

/**
 * Refund a payment (creates a new refund payment record)
 * The original payment stays "completed" — a new record with status "refunded" is created.
 * Supports partial refunds (specify amount < original).
 * 
 * @param paymentId - The ID of the original completed payment to refund
 * @param data - Optional refund details (amount, notes, cancel)
 * @returns Refund response with original and new refund payment records
 */
export const refundPayment = async (
  paymentId: number,
  data: RefundRequest = {}
): Promise<RefundResponse> => {
  const response = await api.patch<RefundResponse>(`/payments/${paymentId}/refund`, data);
  return response.data;
};

/**
 * Void a payment (cancels an unsettled transaction)
 * The original payment becomes "voided" and a new audit record is created.
 * Void is for unsettled transactions only (typically same day as charge).
 * 
 * @param paymentId - The ID of the original payment to void
 * @returns Void response with original and new void payment records
 */
export const voidPayment = async (
  paymentId: number
): Promise<VoidResponse> => {
  const response = await api.patch<VoidResponse>(`/payments/${paymentId}/void`);
  return response.data;
};

/**
 * Manually refund a non-gateway payment (in-store, cash, card)
 * The original payment stays "completed" — a new record with status "refunded" is created.
 * Notes are REQUIRED for manual refunds to document offline processing.
 * 
 * @param paymentId - The ID of the original completed payment to refund
 * @param data - Manual refund details (amount, notes (required), cancel)
 * @returns Manual refund response with original and new refund payment records
 */
export const manualRefundPayment = async (
  paymentId: number,
  data: ManualRefundRequest
): Promise<ManualRefundResponse> => {
  const response = await api.patch<ManualRefundResponse>(`/payments/${paymentId}/manual-refund`, data);
  return response.data;
};

/**
 * Link a payment to a booking or attraction purchase
 * Used in the charge-then-link flow: charge first, create entity, then link
 * 
 * @param paymentId - The ID of the payment to link
 * @param data - The payable_id and payable_type to link to
 * @returns Response with updated payment and payable entity
 */
export const linkPaymentToPayable = async (
  paymentId: number,
  data: LinkPayableRequest
): Promise<LinkPayableResponse> => {
  const response = await api.patch<LinkPayableResponse>(`/payments/${paymentId}/payable`, data);
  return response.data;
};

/**
 * Link payment to payable with retry logic
 * Safe to retry - the PATCH /payments/{id}/payable endpoint is idempotent
 * 
 * @param paymentId - The payment ID  
 * @param payableId - The booking or purchase ID
 * @param payableType - 'booking' or 'attraction_purchase'
 * @param maxRetries - Maximum number of retry attempts (default: 3)
 * @returns Link response
 */
export const linkPaymentWithRetry = async (
  paymentId: number,
  payableId: number,
  payableType: 'booking' | 'attraction_purchase',
  maxRetries: number = 3
): Promise<LinkPayableResponse> => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await linkPaymentToPayable(paymentId, {
        payable_id: payableId,
        payable_type: payableType,
      });
      return response;
    } catch (err) {
      console.warn(`⚠️ Link payment attempt ${attempt}/${maxRetries} failed:`, err);
      if (attempt === maxRetries) throw err;
      // Exponential backoff: 1s, 2s, 3s
      await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }
  throw new Error('Failed to link payment after maximum retries');
};

/** Common payment shape used by action helpers */
type ActionablePayment = {
  status: string;
  method: string;
  payable_id?: number | null;
  payable_type?: string | null;
  created_at?: string;
  paid_at?: string | null;
};

/** Returns true when the payment has a valid payable link */
const hasPayable = (payment: ActionablePayment): boolean => {
  return !!payment.payable_id && !!payment.payable_type;
};

/**
 * Helper: Check if a payment can be refunded via Authorize.Net gateway
 * Only completed authorize.net payments with a valid payable can be gateway-refunded
 */
export const canRefund = (payment: ActionablePayment): boolean => {
  return hasPayable(payment) &&
    payment.status === 'completed' &&
    payment.method === 'authorize.net';
};

/**
 * Helper: Check if a payment can be voided
 * Void is for unsettled Authorize.Net transactions only.
 * Not available if payable is missing or more than 2 days have passed since payment.
 */
export const canVoid = (payment: ActionablePayment): boolean => {
  if (!hasPayable(payment)) return false;
  if (
    !(payment.status === 'completed' || payment.status === 'pending') ||
    payment.method !== 'authorize.net'
  ) {
    return false;
  }
  // Void window: 2 days from payment creation
  const paymentDate = payment.paid_at || payment.created_at;
  if (paymentDate) {
    const twoDaysMs = 2 * 24 * 60 * 60 * 1000;
    if (Date.now() - new Date(paymentDate).getTime() > twoDaysMs) {
      return false;
    }
  }
  return true;
};

/**
 * Helper: Check if a payment can be manually refunded (non-gateway)
 * For in-store, cash, and card payments that were completed with a valid payable
 */
export const canManualRefund = (payment: ActionablePayment): boolean => {
  return hasPayable(payment) &&
    payment.status === 'completed' &&
    ['in-store', 'cash', 'card'].includes(payment.method);
};

/**
 * Helper: Check if a payment is a refund record (created by refund action)
 */
export const isRefundRecord = (payment: { status: string; notes?: string | null }): boolean => {
  return payment.status === 'refunded' && (payment.notes?.includes('Refund from Payment #') ?? false);
};

/**
 * Helper: Check if a payment is a void record (created by void action)
 */
export const isVoidRecord = (payment: { status: string; notes?: string | null }): boolean => {
  return payment.status === 'voided' && (payment.notes?.includes('Void of Payment #') ?? false);
};

/**
 * Extract the original payment ID from refund/void notes
 * Notes format: "Refund from Payment #123 ..." or "Void of Payment #123 ..."
 */
export const extractOriginalPaymentId = (notes: string | null | undefined): string | null => {
  if (!notes) return null;
  const match = notes.match(/(?:Refund from|Void of) Payment #(\d+)/);
  return match ? match[1] : null;
};

/**
 * Invoice Generation Functions
 */

/**
 * Invoice export filter options
 */
export interface InvoiceExportFilters {
  payment_ids?: number[];
  payable_type?: 'booking' | 'attraction_purchase';
  date?: string; // Single date Y-m-d
  start_date?: string;
  end_date?: string;
  week?: 'current' | 'next' | string; // 'current', 'next', or date string
  location_id?: number;
  customer_id?: number;
  status?: 'pending' | 'completed' | 'failed' | 'refunded';
  method?: 'card' | 'cash';
  view_mode?: 'report' | 'individual';
}

/**
 * Export invoices with comprehensive filtering options
 * This is the main function that uses the unified /payments/invoices/export endpoint
 * 
 * @param filters - Export filters
 * @param stream - true to view in browser, false to download
 */
export const exportInvoices = async (
  filters: InvoiceExportFilters,
  stream: boolean = false
): Promise<void> => {
  const token = getStoredUser()?.token;
  const params = new URLSearchParams();
  
  if (filters.payment_ids?.length) {
    filters.payment_ids.forEach(id => params.append('payment_ids[]', id.toString()));
  }
  if (filters.payable_type) params.append('payable_type', filters.payable_type);
  if (filters.date) params.append('date', filters.date);
  if (filters.start_date) params.append('start_date', filters.start_date);
  if (filters.end_date) params.append('end_date', filters.end_date);
  if (filters.week) params.append('week', filters.week);
  if (filters.location_id) params.append('location_id', filters.location_id.toString());
  if (filters.customer_id) params.append('customer_id', filters.customer_id.toString());
  if (filters.status) params.append('status', filters.status);
  if (filters.method) params.append('method', filters.method);
  if (filters.view_mode) params.append('view_mode', filters.view_mode);
  if (stream) params.append('stream', 'true');
  
  const response = await fetch(`${API_BASE_URL}/payments/invoices/export?${params.toString()}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || 'Failed to export invoices');
  }
  
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  
  if (stream) {
    window.open(url, '_blank');
  } else {
    const link = document.createElement('a');
    link.href = url;
    // Generate filename based on filters
    let filename = 'invoices';
    if (filters.payable_type) {
      filename += '-' + filters.payable_type.replace('_', '-');
    }
    if (filters.date) {
      filename += '-' + filters.date;
    } else if (filters.start_date && filters.end_date) {
      filename += '-' + filters.start_date + '-to-' + filters.end_date;
    } else if (filters.week) {
      filename += '-week-' + filters.week;
    }
    filename += '.pdf';
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }
};

/**
 * Export invoices for a specific day
 * 
 * @param date - Date string (Y-m-d)
 * @param stream - true to view in browser, false to download
 */
export const exportInvoicesForDay = async (
  date: string,
  stream: boolean = false
): Promise<void> => {
  const token = getStoredUser()?.token;
  const params = new URLSearchParams();
  if (stream) params.append('stream', 'true');
  
  const url = `${API_BASE_URL}/payments/invoices/day/${date}${params.toString() ? '?' + params.toString() : ''}`;
  
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || 'No invoices found for this date');
  }
  
  const blob = await response.blob();
  const blobUrl = URL.createObjectURL(blob);
  
  if (stream) {
    window.open(blobUrl, '_blank');
  } else {
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = `invoices-${date}.pdf`;
    link.click();
    URL.revokeObjectURL(blobUrl);
  }
};

/**
 * Export invoices for a week
 * 
 * @param week - 'current', 'next', or date string for week containing that date
 * @param stream - true to view in browser, false to download
 */
export const exportInvoicesForWeek = async (
  week: 'current' | 'next' | string = 'current',
  stream: boolean = false
): Promise<void> => {
  const token = getStoredUser()?.token;
  const params = new URLSearchParams();
  if (stream) params.append('stream', 'true');
  
  const url = `${API_BASE_URL}/payments/invoices/week/${week}${params.toString() ? '?' + params.toString() : ''}`;
  
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || 'No invoices found for this week');
  }
  
  const blob = await response.blob();
  const blobUrl = URL.createObjectURL(blob);
  
  if (stream) {
    window.open(blobUrl, '_blank');
  } else {
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = `invoices-week-${week}.pdf`;
    link.click();
    URL.revokeObjectURL(blobUrl);
  }
};

/**
 * Download or view single invoice PDF
 * Uses the unified export endpoint with single payment ID
 * 
 * @param paymentId - Payment ID
 * @param stream - true to view in browser, false to download
 */
export const getInvoice = async (paymentId: number, stream: boolean = false): Promise<void> => {
  return exportInvoices({ payment_ids: [paymentId], view_mode: 'individual' }, stream);
};

/**
 * Download single invoice PDF (backward compatibility)
 * 
 * @param paymentId - Payment ID
 */
export const downloadInvoice = async (paymentId: number): Promise<void> => {
  return getInvoice(paymentId, false);
};

/**
 * View single invoice PDF in browser (backward compatibility)
 * 
 * @param paymentId - Payment ID
 */
export const viewInvoice = async (paymentId: number): Promise<void> => {
  return getInvoice(paymentId, true);
};

/**
 * Generate filtered invoices report PDF
 * Uses the unified export endpoint with view_mode: 'report'
 * 
 * @param filters - Report filters
 * @param download - Whether to download or view in browser
 */
export const generateInvoicesReport = async (
  filters: {
    location_id?: number;
    status?: 'pending' | 'completed' | 'failed' | 'refunded';
    method?: 'card' | 'cash';
    payable_type?: 'booking' | 'attraction_purchase';
    customer_id?: number;
    start_date?: string;
    end_date?: string;
    payment_ids?: number[];
  },
  download: boolean = false
): Promise<void> => {
  return exportInvoices({
    ...filters,
    view_mode: 'report',
  }, !download); // stream = !download (true to view, false to download)
};

/**
 * Export multiple invoices as bulk PDF (one invoice per page)
 * Uses the unified export endpoint with view_mode: 'individual'
 * 
 * @param paymentIds - Array of payment IDs
 * @param download - Whether to download or view in browser
 */
export const exportBulkInvoices = async (
  paymentIds: number[],
  download: boolean = true
): Promise<void> => {
  return exportInvoices({
    payment_ids: paymentIds,
    view_mode: 'individual',
  }, !download); // stream = !download (true to view, false to download)
};

/**
 * Accept.js Helper Functions
 */

// Track which Accept.js environment is currently loaded
let loadedAcceptJSEnvironment: 'sandbox' | 'production' | null = null;

/**
 * Load Accept.js library dynamically
 * 
 * @param environment - 'sandbox' or 'production'
 * @returns Promise that resolves when script is loaded
 */
export const loadAcceptJS = (environment: 'sandbox' | 'production' = 'sandbox'): Promise<void> => {
  return new Promise((resolve, reject) => {
    // Check if already loaded with the correct environment
    if (window.Accept && loadedAcceptJSEnvironment === environment) {
      resolve();
      return;
    }
    
    // If loaded with different environment, proceed with existing
    if (window.Accept && loadedAcceptJSEnvironment !== environment) {
      resolve();
      return;
    }

    // Create script element
    const script = document.createElement('script');
    script.type = 'text/javascript';
    
    // Use appropriate Accept.js URL based on environment
    if (environment === 'production') {
      script.src = 'https://js.authorize.net/v1/Accept.js';
    } else {
      script.src = 'https://jstest.authorize.net/v1/Accept.js';
    }

    script.charset = 'utf-8';
    script.async = true;

    script.onload = () => {
      loadedAcceptJSEnvironment = environment;
      resolve();
    };

    script.onerror = () => {
      reject(new Error('Failed to load Accept.js library'));
    };

    document.head.appendChild(script);
  });
};

/**
 * Tokenize card data using Accept.js
 * 
 * @param cardData - Card information
 * @param apiLoginID - Authorize.Net API Login ID (public key)
 * @param clientKey - Public client key (optional, can use API Login ID)
 * @returns Promise with opaque data token
 */
export const tokenizeCard = (
  cardData: {
    cardNumber: string;
    month: string;
    year: string;
    cardCode: string;
  },
  apiLoginID: string,
  clientKey?: string
): Promise<PaymentOpaqueData> => {
  return new Promise((resolve, reject) => {
    // Check if running on HTTPS (required by Authorize.Net Accept.js)
    if (window.location.protocol !== 'https:' && !window.location.hostname.includes('localhost')) {
      reject(new Error('HTTPS connection required. Authorize.Net Accept.js only works on HTTPS or localhost.'));
      return;
    }
    
    if (!window.Accept) {
      reject(new Error('Accept.js library not loaded'));
      return;
    }

    const secureData: AcceptJSSecureData = {
      authData: {
        clientKey: clientKey || apiLoginID,
        apiLoginID: apiLoginID,
      },
      cardData: cardData,
    };

    window.Accept.dispatchData(secureData, (response: AcceptJSResponse) => {
      if (response.messages.resultCode === 'Error') {
        const errorMessage = response.messages.message
          .map((msg) => `${msg.code}: ${msg.text}`)
          .join(', ');
        reject(new Error(errorMessage));
      } else {
        resolve(response.opaqueData);
      }
    });
  });
};

/**
 * Complete payment flow: tokenize card and charge
 * 
 * @param cardData - Card information
 * @param paymentData - Payment details (amount, booking_id, etc.)
 * @param apiLoginID - Authorize.Net API Login ID
 * @param clientKey - Public client key (optional)
 * @param customerData - Customer billing information (optional)
 * @returns Payment charge response
 */
export const processCardPayment = async (
  cardData: {
    cardNumber: string;
    month: string;
    year: string;
    cardCode: string;
  },
  paymentData: Omit<PaymentChargeRequest, 'opaqueData'>,
  apiLoginID: string,
  clientKey?: string,
  customerData?: {
    first_name?: string;
    last_name?: string;
    email?: string;
    phone?: string;
    address?: string;
    city?: string;
    state?: string;
    zip?: string;
    country?: string;
  }
): Promise<PaymentChargeResponse> => {
  try {
    // Step 1: Tokenize card data
    const opaqueData = await tokenizeCard(cardData, apiLoginID, clientKey);
    
    // Step 2: Charge payment with token
    const chargeRequest: PaymentChargeRequest = {
      ...paymentData,
      opaqueData,
      customer: customerData, // Include customer billing info if provided
    };
    
    const response = await chargePayment(chargeRequest);
    
    return response;
  } catch (error: unknown) {
    throw error;
  }
};

/**
 * Party Summary Export Filter Options
 */
export interface PartySummaryFilters {
  date?: string; // Single date Y-m-d
  start_date?: string;
  end_date?: string;
  week?: 'current' | 'next' | string;
  location_id?: number;
  package_id?: number;
  room_id?: number;
  status?: string;
  view_mode?: 'detailed' | 'compact';
}

/**
 * Export party summaries for staff organization (full booking details + notes)
 * Provides detailed printable summaries for staff to organize and prepare for parties
 * 
 * @param filters - Export filters
 * @param stream - true to view in browser, false to download
 */
export const exportPartySummaries = async (
  filters: PartySummaryFilters,
  stream: boolean = false
): Promise<void> => {
  const token = getStoredUser()?.token;
  const params = new URLSearchParams();
  
  if (filters.date) params.append('date', filters.date);
  if (filters.start_date) params.append('start_date', filters.start_date);
  if (filters.end_date) params.append('end_date', filters.end_date);
  if (filters.week) params.append('week', filters.week);
  if (filters.location_id) params.append('location_id', filters.location_id.toString());
  if (filters.package_id) params.append('package_id', filters.package_id.toString());
  if (filters.room_id) params.append('room_id', filters.room_id.toString());
  if (filters.status) params.append('status', filters.status);
  if (filters.view_mode) params.append('view_mode', filters.view_mode);
  if (stream) params.append('stream', 'true');
  
  const response = await fetch(`${API_BASE_URL}/payments/party-summaries/export?${params.toString()}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || 'Failed to export party summaries');
  }
  
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  
  if (stream) {
    window.open(url, '_blank');
  } else {
    const link = document.createElement('a');
    link.href = url;
    // Generate filename based on filters
    let filename = 'party-summaries';
    if (filters.date) {
      filename += '-' + filters.date;
    } else if (filters.start_date && filters.end_date) {
      filename += '-' + filters.start_date + '-to-' + filters.end_date;
    } else if (filters.week) {
      filename += '-week-' + filters.week;
    }
    filename += '.pdf';
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }
};

/**
 * Export party summaries for a specific day (shortcut)
 * 
 * @param date - Date string (Y-m-d)
 * @param stream - true to view in browser, false to download
 */
export const exportPartySummariesForDay = async (
  date: string,
  stream: boolean = false
): Promise<void> => {
  const token = getStoredUser()?.token;
  const params = new URLSearchParams();
  if (stream) params.append('stream', 'true');
  
  const url = `${API_BASE_URL}/payments/party-summaries/day/${date}${params.toString() ? '?' + params.toString() : ''}`;
  
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || 'Failed to export party summaries for day');
  }
  
  const blob = await response.blob();
  const blobUrl = URL.createObjectURL(blob);
  
  if (stream) {
    window.open(blobUrl, '_blank');
  } else {
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = `party-summaries-${date}.pdf`;
    link.click();
    URL.revokeObjectURL(blobUrl);
  }
};

/**
 * Export party summaries for a specific week (shortcut)
 * 
 * @param week - 'current', 'next', or date string
 * @param stream - true to view in browser, false to download
 */
export const exportPartySummariesForWeek = async (
  week: 'current' | 'next' | string = 'current',
  stream: boolean = false
): Promise<void> => {
  const token = getStoredUser()?.token;
  const params = new URLSearchParams();
  if (stream) params.append('stream', 'true');
  
  const url = `${API_BASE_URL}/payments/party-summaries/week/${week}${params.toString() ? '?' + params.toString() : ''}`;
  
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || 'Failed to export party summaries for week');
  }
  
  const blob = await response.blob();
  const blobUrl = URL.createObjectURL(blob);
  
  if (stream) {
    window.open(blobUrl, '_blank');
  } else {
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = `party-summaries-week-${week}.pdf`;
    link.click();
    URL.revokeObjectURL(blobUrl);
  }
};

/**
 * Package Invoice Export Filter Options
 */
export interface PackageInvoiceFilters {
  package_id: number; // Required
  date?: string;
  start_date?: string;
  end_date?: string;
  location_id?: number;
  status?: 'pending' | 'completed' | 'failed' | 'refunded';
}

/**
 * Export package-specific invoices (all invoices for bookings of a specific package)
 * Lists all payment invoices grouped by package in a consistent invoice format
 * 
 * @param filters - Export filters (package_id is required)
 * @param stream - true to view in browser, false to download
 */
export const exportPackageInvoices = async (
  filters: PackageInvoiceFilters,
  stream: boolean = false
): Promise<void> => {
  const token = getStoredUser()?.token;
  const params = new URLSearchParams();
  
  // package_id is required
  params.append('package_id', filters.package_id.toString());
  
  if (filters.date) params.append('date', filters.date);
  if (filters.start_date) params.append('start_date', filters.start_date);
  if (filters.end_date) params.append('end_date', filters.end_date);
  if (filters.location_id) params.append('location_id', filters.location_id.toString());
  if (filters.status) params.append('status', filters.status);
  if (stream) params.append('stream', 'true');
  
  const response = await fetch(`${API_BASE_URL}/payments/package-invoices/export?${params.toString()}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || 'Failed to export package invoices');
  }
  
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  
  if (stream) {
    window.open(url, '_blank');
  } else {
    const link = document.createElement('a');
    link.href = url;
    // Generate filename based on filters
    let filename = `package-invoices-${filters.package_id}`;
    if (filters.date) {
      filename += '-' + filters.date;
    } else if (filters.start_date && filters.end_date) {
      filename += '-' + filters.start_date + '-to-' + filters.end_date;
    }
    filename += '.pdf';
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }
};

/**
 * Validate card number using Luhn algorithm
 * 
 * @param cardNumber - Card number to validate
 * @returns true if valid, false otherwise
 */
export const validateCardNumber = (cardNumber: string): boolean => {
  const cleaned = cardNumber.replace(/\s+/g, '');
  
  if (!/^\d+$/.test(cleaned)) {
    return false;
  }

  let sum = 0;
  let isEven = false;

  for (let i = cleaned.length - 1; i >= 0; i--) {
    let digit = parseInt(cleaned.charAt(i), 10);

    if (isEven) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }

    sum += digit;
    isEven = !isEven;
  }

  return sum % 10 === 0;
};

/**
 * Format card number with spaces
 * 
 * @param cardNumber - Card number to format
 * @returns Formatted card number (e.g., "1234 5678 9012 3456")
 */
export const formatCardNumber = (cardNumber: string): string => {
  const cleaned = cardNumber.replace(/\s+/g, '');
  const groups = cleaned.match(/.{1,4}/g);
  return groups ? groups.join(' ') : cleaned;
};

/**
 * Get card type from card number
 * 
 * @param cardNumber - Card number
 * @returns Card type (Visa, Mastercard, Amex, Discover, etc.)
 */
export const getCardType = (cardNumber: string): string => {
  const cleaned = cardNumber.replace(/\s+/g, '');
  
  if (/^4/.test(cleaned)) {
    return 'Visa';
  } else if (/^5[1-5]/.test(cleaned)) {
    return 'Mastercard';
  } else if (/^3[47]/.test(cleaned)) {
    return 'American Express';
  } else if (/^6(?:011|5)/.test(cleaned)) {
    return 'Discover';
  }
  
  return 'Unknown';
};

export default {
  chargePayment,
  createPayment,
  getPayment,
  getPayments,
  getPaymentsForBooking,
  getPaymentsForAttractionPurchase,
  updatePayment,
  deletePayment,
  refundPayment,
  voidPayment,
  manualRefundPayment,
  linkPaymentToPayable,
  linkPaymentWithRetry,
  canRefund,
  canVoid,
  canManualRefund,
  isRefundRecord,
  isVoidRecord,
  extractOriginalPaymentId,
  downloadInvoice,
  viewInvoice,
  generateInvoicesReport,
  exportBulkInvoices,
  loadAcceptJS,
  tokenizeCard,
  processCardPayment,
  validateCardNumber,
  formatCardNumber,
  getCardType,
  // Party Summary exports
  exportPartySummaries,
  exportPartySummariesForDay,
  exportPartySummariesForWeek,
  // Package Invoice exports
  exportPackageInvoices,
  PAYMENT_TYPE,
};

// Re-export PAYMENT_TYPE for convenience
export { PAYMENT_TYPE };
