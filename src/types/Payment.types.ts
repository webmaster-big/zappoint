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
  // Signature & Terms fields
  signature_image?: string; // base64 data URI of customer signature
  terms_accepted?: boolean; // Whether customer accepted Terms & Conditions
}

/**
 * Request to link a payment to a booking or attraction purchase
 * Used after charge-then-link flow: charge first, create entity, then link
 */
export interface LinkPayableRequest {
  payable_id: number;
  payable_type: PaymentPayableType;
}

/**
 * Response from linking a payment to a payable entity
 */
export interface LinkPayableResponse {
  success: boolean;
  message: string;
  data: Payment;
  payable?: {
    id: number;
    amount_paid: number;
    total_amount: number;
    status: string;
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

export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded' | 'voided';
export type PaymentMethod = 'card' | 'cash' | 'authorize.net' | 'in-store';

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
  method: PaymentMethod;
  status: PaymentStatus;
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
  // Signature & Terms
  signature_image?: string | null;
  terms_accepted?: boolean | null;
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
  method: PaymentMethod;
  status?: PaymentStatus;
  notes?: string;
  payment_id?: string;
  location_id?: number;
  // Signature & Terms fields
  signature_image?: string; // base64 data URI of customer signature
  terms_accepted?: boolean; // Whether customer accepted Terms & Conditions
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
  status?: PaymentStatus;
  method?: PaymentMethod;
  start_date?: string;
  end_date?: string;
  per_page?: number;
  page?: number;
}

/**
 * Refund request payload
 */
export interface RefundRequest {
  amount?: number;
  notes?: string;
  cancel?: boolean;
}

/**
 * Refund response from the API
 */
export interface RefundResponse {
  success: boolean;
  message: string;
  data: {
    original_payment: Payment;
    refund_payment: Payment;
  };
  refund_transaction_id: string;
  refund_amount: number;
  total_refunded: number;
  remaining_balance: number;
  is_full_refund: boolean;
  payable_cancelled: boolean;
  payable: PaymentBooking | PaymentAttractionPurchase | null;
}

/**
 * Void response from the API
 */
export interface VoidResponse {
  success: boolean;
  message: string;
  data: {
    original_payment: Payment;
    void_payment: Payment;
  };
  void_amount: number;
  payable_cancelled: boolean;
  payable: PaymentBooking | PaymentAttractionPurchase | null;
}

/**
 * Error data returned when a refund exceeds available balance
 */
export interface RefundErrorData {
  original_amount: number;
  total_already_refunded: number;
  max_refundable: number;
}

/**
 * Manual refund request payload (for non-Authorize.Net payments: in-store, cash, card)
 * Notes field is REQUIRED for manual refunds to document offline processing
 */
export interface ManualRefundRequest {
  amount?: number;
  notes: string;
  cancel?: boolean;
}

/**
 * Manual refund response from the API
 */
export interface ManualRefundResponse {
  success: boolean;
  message: string;
  data: {
    original_payment: Payment;
    refund_payment: Payment;
  };
  refund_amount: number;
  total_refunded: number;
  remaining_balance: number;
  is_full_refund: boolean;
  payable_cancelled: boolean;
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
