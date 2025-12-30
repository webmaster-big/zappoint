// Types for: Payment processing with Authorize.Net

/**
 * Payment type constants matching backend Payment model
 */
export const PAYMENT_TYPE = {
  BOOKING: 'booking',
  ATTRACTION_PURCHASE: 'attraction_purchase',
} as const;

export type PaymentPayableType = typeof PAYMENT_TYPE[keyof typeof PAYMENT_TYPE];

export interface PaymentOpaqueData {
  dataDescriptor: string;
  dataValue: string;
}

export interface PaymentChargeRequest {
  location_id: number;
  opaqueData: PaymentOpaqueData;
  amount: number;
  order_id?: string;
  customer_id?: number;
  // New polymorphic fields
  payable_id?: number;
  payable_type?: PaymentPayableType;
  // Backward compatibility (will be converted to payable_id/payable_type on backend)
  booking_id?: number;
  attraction_purchase_id?: number;
  description?: string;
  customer?: {
    first_name?: string;
    last_name?: string;
    email?: string;
    phone?: string;
    address?: string;
    address2?: string; // Apartment, suite, unit number
    city?: string;
    state?: string;
    zip?: string;
    country?: string;
  };
}

export interface PaymentChargeResponse {
  success: boolean;
  message: string;
  transaction_id?: string;
  auth_code?: string;
  payment?: Payment;
}

// Booking details returned from API
export interface PaymentBooking {
  id: number;
  reference_number?: string;
  guest_name?: string;
  guest_email?: string;
  guest_phone?: string;
  booking_date?: string;
  booking_time?: string;
  participants?: number;
  total_amount?: string | number;
  amount_paid?: string | number;
  status?: string;
  payment_status?: string;
  payment_method?: string;
  package_id?: number;
  location_id?: number;
  customer_id?: number;
  created_at?: string;
}

// Attraction purchase details returned from API
export interface PaymentAttractionPurchase {
  id: number;
  transaction_id?: string;
  guest_name?: string;
  guest_email?: string;
  guest_phone?: string;
  purchase_date?: string;
  quantity?: number;
  amount?: string | number;
  amount_paid?: string | number;
  status?: string;
  payment_method?: string;
  attraction_id?: number;
  location_id?: number;
  customer_id?: number;
  created_at?: string;
}

export interface Payment {
  id: number;
  // Polymorphic relationship fields
  payable_id?: number;
  payable_type?: PaymentPayableType;
  // Backward compatibility
  booking_id?: number;
  customer_id?: number;
  location_id: number;
  amount: number;
  currency: string;
  method: 'card' | 'cash';
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  transaction_id: string;
  payment_id?: string;
  notes?: string;
  paid_at?: string;
  refunded_at?: string;
  created_at: string;
  updated_at: string;
  // Relationships
  booking?: PaymentBooking | null;
  attractionPurchase?: PaymentAttractionPurchase | null;
  attraction_purchase?: PaymentAttractionPurchase | null;
  customer?: {
    id: number;
    first_name: string;
    last_name: string;
    email?: string;
    phone?: string;
  } | null;
  location?: {
    id: number;
    name: string;
  } | null;
  // Computed payable details (when loaded)
  payable?: PaymentBooking | PaymentAttractionPurchase | null;
}

export interface CreatePaymentRequest {
  // New polymorphic fields (preferred)
  payable_id?: number;
  payable_type?: PaymentPayableType;
  // Backward compatibility (will be converted to payable_id/payable_type on backend)
  booking_id?: number;
  attraction_purchase_id?: number;
  customer_id?: number | null;
  amount: number;
  currency?: string;
  method: 'card' | 'cash';
  status?: 'pending' | 'completed' | 'failed' | 'refunded';
  notes?: string;
  payment_id?: string;
  location_id?: number;
}

/**
 * Filters for fetching payments
 */
export interface PaymentFilters {
  payable_id?: number;
  payable_type?: PaymentPayableType;
  booking_id?: number;
  attraction_purchase_id?: number;
  customer_id?: number;
  location_id?: number;
  status?: 'pending' | 'completed' | 'failed' | 'refunded';
  method?: 'card' | 'cash';
  start_date?: string;
  end_date?: string;
  per_page?: number;
  page?: number;
}

/**
 * Paginated payments response
 */
export interface PaginatedPaymentsResponse {
  success: boolean;
  data: {
    payments: Payment[];
    pagination: {
      current_page: number;
      last_page: number;
      per_page: number;
      total: number;
    };
  };
}

export interface PaymentApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
}

// Accept.js types for Authorize.Net frontend integration
export interface AcceptJSAuthData {
  clientKey: string;
  apiLoginID: string;
}

export interface AcceptJSCardData {
  cardNumber: string;
  month: string;
  year: string;
  cardCode: string;
}

export interface AcceptJSSecureData {
  authData: AcceptJSAuthData;
  cardData: AcceptJSCardData;
}

export interface AcceptJSResponse {
  opaqueData: PaymentOpaqueData;
  messages: {
    resultCode: string;
    message: Array<{
      code: string;
      text: string;
    }>;
  };
}

// Window extension for Accept.js library
declare global {
  interface Window {
    Accept?: {
      dispatchData: (
        secureData: AcceptJSSecureData,
        callback: (response: AcceptJSResponse) => void
      ) => void;
    };
  }
}
