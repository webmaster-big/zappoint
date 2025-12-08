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
} from '../types/Payment.types';

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
 * @param filters - Optional filters (booking_id, customer_id, status, etc.)
 * @returns List of payments
 */
export const getPayments = async (filters?: Record<string, any>): Promise<PaymentApiResponse<Payment[]>> => {
  const response = await api.get<PaymentApiResponse<Payment[]>>('/payments', { params: filters });
  return response.data;
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
 * Accept.js Helper Functions
 */

/**
 * Load Accept.js library dynamically
 * 
 * @param environment - 'sandbox' or 'production'
 * @returns Promise that resolves when script is loaded
 */
export const loadAcceptJS = (environment: 'sandbox' | 'production' = 'sandbox'): Promise<void> => {
  return new Promise((resolve, reject) => {
    // Check if already loaded
    if (window.Accept) {
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
      console.log('✅ Accept.js loaded successfully');
      resolve();
    };

    script.onerror = () => {
      console.error('❌ Failed to load Accept.js');
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
          .map((msg) => msg.text)
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
    console.log('🔐 Tokenizing card data...');
    const opaqueData = await tokenizeCard(cardData, apiLoginID, clientKey);
    
    // Step 2: Charge payment with token
    console.log('💳 Processing payment...');
    const chargeRequest: PaymentChargeRequest = {
      ...paymentData,
      opaqueData,
      customer_data: customerData, // Include customer billing info if provided
    };
    
    const response = await chargePayment(chargeRequest);
    console.log('✅ Payment processed successfully');
    
    return response;
  } catch (error: any) {
    console.error('❌ Payment processing failed:', error);
    throw error;
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
  updatePayment,
  deletePayment,
  loadAcceptJS,
  tokenizeCard,
  processCardPayment,
  validateCardNumber,
  formatCardNumber,
  getCardType,
};
