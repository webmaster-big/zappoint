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

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    const token = getStoredUser()?.token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    } else {
      try {
        const customerData = localStorage.getItem('zapzone_customer');
        if (customerData) {
          const customer = JSON.parse(customerData);
          if (customer?.token) {
            config.headers.Authorization = `Bearer ${customer.token}`;
          }
        }
      } catch {
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);


export const chargePayment = async (
  data: PaymentChargeRequest
): Promise<PaymentChargeResponse> => {
  const response = await api.post<PaymentChargeResponse>('/payments/charge', data);
  return response.data;
};

export const createPayment = async (
  data: CreatePaymentRequest
): Promise<PaymentApiResponse<Payment>> => {
  const response = await api.post<PaymentApiResponse<Payment>>('/payments', data);
  return response.data;
};

export const getPayment = async (id: number): Promise<PaymentApiResponse<Payment>> => {
  const response = await api.get<PaymentApiResponse<Payment>>(`/payments/${id}`);
  return response.data;
};

export const getPayments = async (filters?: PaymentFilters): Promise<PaginatedPaymentsResponse> => {
  const response = await api.get<PaginatedPaymentsResponse>('/payments', { params: filters });
  return response.data;
};

export const getPaymentsForBooking = async (bookingId: number): Promise<PaginatedPaymentsResponse> => {
  return getPayments({
    payable_id: bookingId,
    payable_type: PAYMENT_TYPE.BOOKING,
  });
};

export const getPaymentsForAttractionPurchase = async (purchaseId: number): Promise<PaginatedPaymentsResponse> => {
  return getPayments({
    payable_id: purchaseId,
    payable_type: PAYMENT_TYPE.ATTRACTION_PURCHASE,
  });
};

export const getPaymentsForEventPurchase = async (purchaseId: number): Promise<PaginatedPaymentsResponse> => {
  return getPayments({
    payable_id: purchaseId,
    payable_type: PAYMENT_TYPE.EVENT_PURCHASE,
  });
};

export const updatePayment = async (
  id: number,
  data: Partial<CreatePaymentRequest>
): Promise<PaymentApiResponse<Payment>> => {
  const response = await api.put<PaymentApiResponse<Payment>>(`/payments/${id}`, data);
  return response.data;
};

export const deletePayment = async (id: number): Promise<PaymentApiResponse> => {
  const response = await api.delete<PaymentApiResponse>(`/payments/${id}`);
  return response.data;
};

export const restorePayment = async (id: number): Promise<PaymentApiResponse<Payment>> => {
  const response = await api.patch<PaymentApiResponse<Payment>>(`/payments/${id}/restore`);
  return response.data;
};

export const forceDeletePayment = async (id: number): Promise<PaymentApiResponse> => {
  const response = await api.delete<PaymentApiResponse>(`/payments/${id}/force-delete`);
  return response.data;
};

export const getTrashedPayments = async (filters?: PaymentFilters): Promise<PaginatedPaymentsResponse> => {
  const params = new URLSearchParams();
  if (filters) {
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, String(value));
      }
    });
  }
  const queryString = params.toString() ? `?${params.toString()}` : '';
  const response = await api.get<PaginatedPaymentsResponse>(`/payments/trashed${queryString}`);
  return response.data;
};


export const refundPayment = async (
  paymentId: number,
  data: RefundRequest = {}
): Promise<RefundResponse> => {
  const response = await api.patch<RefundResponse>(`/payments/${paymentId}/refund`, data);
  return response.data;
};

export const voidPayment = async (
  paymentId: number
): Promise<VoidResponse> => {
  const response = await api.patch<VoidResponse>(`/payments/${paymentId}/void`);
  return response.data;
};

export const manualRefundPayment = async (
  paymentId: number,
  data: ManualRefundRequest
): Promise<ManualRefundResponse> => {
  const response = await api.patch<ManualRefundResponse>(`/payments/${paymentId}/manual-refund`, data);
  return response.data;
};

export const linkPaymentToPayable = async (
  paymentId: number,
  data: LinkPayableRequest,
  transactionId?: string
): Promise<LinkPayableResponse> => {
  const params = new URLSearchParams();
  if (transactionId) params.append('transaction_id', transactionId);
  if (data.payable_id) params.append('payable_id', data.payable_id.toString());
  if (data.payable_type) params.append('payable_type', data.payable_type);
  const queryString = params.toString() ? `?${params.toString()}` : '';
  const response = await api.patch<LinkPayableResponse>(`/payments/${paymentId}/payable${queryString}`, data);
  return response.data;
};

export const linkPaymentWithRetry = async (
  paymentId: number,
  payableId: number,
  payableType: 'booking' | 'attraction_purchase' | 'event_purchase',
  maxRetries: number = 3,
  transactionId?: string
): Promise<LinkPayableResponse> => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await linkPaymentToPayable(paymentId, {
        payable_id: payableId,
        payable_type: payableType,
      }, transactionId);
      return response;
    } catch (err) {
      console.warn(`⚠️ Link payment attempt ${attempt}/${maxRetries} failed:`, err);
      if (attempt === maxRetries) throw err;
      await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }
  throw new Error('Failed to link payment after maximum retries');
};

type ActionablePayment = {
  status: string;
  method: string;
  payable_id?: number | null;
  payable_type?: string | null;
  created_at?: string;
  paid_at?: string | null;
};

const hasPayable = (payment: ActionablePayment): boolean => {
  return !!payment.payable_id && !!payment.payable_type;
};

export const canRefund = (payment: ActionablePayment): boolean => {
  return hasPayable(payment) &&
    payment.status === 'completed' &&
    payment.method === 'authorize.net';
};

export const canVoid = (payment: ActionablePayment): boolean => {
  if (!hasPayable(payment)) return false;
  if (
    !(payment.status === 'completed' || payment.status === 'pending') ||
    payment.method !== 'authorize.net'
  ) {
    return false;
  }
  const paymentDate = payment.paid_at || payment.created_at;
  if (paymentDate) {
    const twoDaysMs = 2 * 24 * 60 * 60 * 1000;
    if (Date.now() - new Date(paymentDate).getTime() > twoDaysMs) {
      return false;
    }
  }
  return true;
};

export const canManualRefund = (payment: ActionablePayment): boolean => {
  return hasPayable(payment) &&
    payment.status === 'completed' &&
    ['in-store', 'cash', 'card'].includes(payment.method);
};

export const isRefundRecord = (payment: { status: string; notes?: string | null }): boolean => {
  return payment.status === 'refunded' && (payment.notes?.includes('Refund from Payment #') ?? false);
};

export const isVoidRecord = (payment: { status: string; notes?: string | null }): boolean => {
  return payment.status === 'voided' && (payment.notes?.includes('Void of Payment #') ?? false);
};

export const extractOriginalPaymentId = (notes: string | null | undefined): string | null => {
  if (!notes) return null;
  const match = notes.match(/(?:Refund from|Void of) Payment #(\d+)/);
  return match ? match[1] : null;
};


export interface InvoiceExportFilters {
  payment_ids?: number[];
  payable_type?: 'booking' | 'attraction_purchase' | 'event_purchase';
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

export const getInvoice = async (paymentId: number, stream: boolean = false): Promise<void> => {
  return exportInvoices({ payment_ids: [paymentId], view_mode: 'individual' }, stream);
};

export const downloadInvoice = async (paymentId: number): Promise<void> => {
  return getInvoice(paymentId, false);
};

export const viewInvoice = async (paymentId: number): Promise<void> => {
  return getInvoice(paymentId, true);
};

export const generateInvoicesReport = async (
  filters: {
    location_id?: number;
    status?: 'pending' | 'completed' | 'failed' | 'refunded';
    method?: 'card' | 'cash';
    payable_type?: 'booking' | 'attraction_purchase' | 'event_purchase';
    date_from?: string;
    date_to?: string;
  },
  download: boolean = true
): Promise<void> => {
  return exportInvoices({
    ...filters,
    view_mode: 'report',
  }, !download); // stream = !download (true to view, false to download)
};

export const exportBulkInvoices = async (
  paymentIds: number[],
  download: boolean = true
): Promise<void> => {
  return exportInvoices({
    payment_ids: paymentIds,
    view_mode: 'individual',
  }, !download); // stream = !download (true to view, false to download)
};


let loadedAcceptJSEnvironment: 'sandbox' | 'production' | null = null;

export const loadAcceptJS = (environment: 'sandbox' | 'production' = 'sandbox'): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (window.Accept && loadedAcceptJSEnvironment === environment) {
      resolve();
      return;
    }
    
    if (window.Accept && loadedAcceptJSEnvironment !== environment) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.type = 'text/javascript';
    
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
    const opaqueData = await tokenizeCard(cardData, apiLoginID, clientKey);
    
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

export interface PackageInvoiceFilters {
  package_id: number; // Required
  date?: string;
  start_date?: string;
  end_date?: string;
  location_id?: number;
  status?: 'pending' | 'completed' | 'failed' | 'refunded';
}

export const exportPackageInvoices = async (
  filters: PackageInvoiceFilters,
  stream: boolean = false
): Promise<void> => {
  const token = getStoredUser()?.token;
  const params = new URLSearchParams();
  
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

const TEST_CARD_NUMBERS = new Set([
  '4242424242424242', // Visa
  '4000056655665556', // Visa (debit)
  '5555555555554444', // Mastercard
  '2223003122003222', // Mastercard (2-series)
  '5200828282828210', // Mastercard (debit)
  '5105105105105100', // Mastercard (prepaid)
  '378282246310005',  // American Express
  '371449635398431',  // American Express
  '6011111111111117', // Discover
  '6011000990139424', // Discover
  '6011981111111113', // Discover (debit)
  '3056930009020004', // Diners Club
  '36227206271667',   // Diners Club (14-digit)
  '6555900060004105', // BCcard / DinaCard
  '3566002020360505', // JCB
  '6200000000000005', // UnionPay
  '6200000000000047', // UnionPay (debit)
  '6205500000000000004', // UnionPay (19-digit)
  '4111111111111111', // Authorize.Net test Visa
  '4007000000027',    // Authorize.Net test Visa (13-digit)
  '370000000000002',  // Authorize.Net test Amex
  '6011000000000012', // Authorize.Net test Discover
  '3088000000000017', // Authorize.Net test JCB
  '38000000000006',   // Authorize.Net test Diners Club
  '5424000000000015', // Authorize.Net test Mastercard
]);

export const isTestCardNumber = (cardNumber: string): boolean => {
  const cleaned = cardNumber.replace(/\s+/g, '');
  return TEST_CARD_NUMBERS.has(cleaned);
};

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

export const formatCardNumber = (cardNumber: string): string => {
  const cleaned = cardNumber.replace(/\s+/g, '');
  const groups = cleaned.match(/.{1,4}/g);
  return groups ? groups.join(' ') : cleaned;
};

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
  restorePayment,
  forceDeletePayment,
  getTrashedPayments,
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
  exportPartySummaries,
  exportPartySummariesForDay,
  exportPartySummariesForWeek,
  exportPackageInvoices,
  PAYMENT_TYPE,
};

export { PAYMENT_TYPE };
