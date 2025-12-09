// Types for: Payment processing with Authorize.Net

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
  booking_id?: number;
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

export interface Payment {
  id: number;
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
  created_at: string;
  updated_at: string;
  booking?: any;
  customer?: any;
}

export interface CreatePaymentRequest {
  booking_id?: number;
  customer_id?: number | null;
  amount: number;
  currency?: string;
  method: 'card' | 'cash';
  status?: 'pending' | 'completed' | 'failed' | 'refunded';
  notes?: string;
  payment_id?: string;
  location_id?: number;
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
