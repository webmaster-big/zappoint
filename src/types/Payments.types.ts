
import type { PaymentPayableType, PaymentBooking, PaymentAttractionPurchase } from './Payment.types';

export interface PaymentsPagePayment {
  id: number;
  payable_id?: number;
  payable_type?: PaymentPayableType;
  customer_id?: number;
  location_id: number;
  amount: number;
  currency: string;
  method: 'card' | 'cash' | 'authorize.net' | 'in-store';
  status: 'pending' | 'completed' | 'failed' | 'refunded' | 'voided';
  transaction_id: string;
  payment_id?: string;
  notes?: string;
  paid_at?: string;
  refunded_at?: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  booking?: PaymentBooking | null;
  attractionPurchase?: PaymentAttractionPurchase | null;
  customerName?: string;
  customerEmail?: string;
  locationName?: string;
  payableReference?: string;
  payableDescription?: string;
  bookingDate?: string;
  bookingTime?: string;
  participants?: number;
  guestName?: string;
  signature_image?: string | null;
  terms_accepted?: boolean | null;
}

export interface PaymentsFilterOptions {
  status: 'all' | 'pending' | 'completed' | 'failed' | 'refunded' | 'voided';
  method: 'all' | 'card' | 'cash' | 'authorize.net' | 'in-store';
  payable_type: 'all' | 'booking' | 'attraction_purchase';
  search: string;
  dateRange: 'all' | 'today' | 'week' | 'month' | 'year';
  startDate: string;
  endDate: string;
}

export interface PaymentsMetrics {
  totalPayments: number;
  totalRevenue: number;
  completedPayments: number;
  completedRevenue: number;
  pendingPayments: number;
  pendingRevenue: number;
  refundedPayments: number;
  refundedAmount: number;
  voidedPayments: number;
  voidedAmount: number;
}
