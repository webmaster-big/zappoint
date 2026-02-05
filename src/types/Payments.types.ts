// Types for: src/pages/admin/payments/Payments.tsx

import type { PaymentPayableType, PaymentBooking, PaymentAttractionPurchase } from './Payment.types';

/**
 * Payment record with additional display-friendly fields
 */
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
  // Relationships
  booking?: PaymentBooking | null;
  attractionPurchase?: PaymentAttractionPurchase | null;
  // Display-friendly computed fields
  customerName?: string;
  customerEmail?: string;
  locationName?: string;
  payableReference?: string;
  payableDescription?: string;
  // Additional booking/purchase details for display
  bookingDate?: string;
  bookingTime?: string;
  participants?: number;
  guestName?: string;
}

/**
 * Filter options for the payments page
 */
export interface PaymentsFilterOptions {
  status: 'all' | 'pending' | 'completed' | 'failed' | 'refunded' | 'voided';
  method: 'all' | 'card' | 'cash' | 'authorize.net' | 'in-store';
  payable_type: 'all' | 'booking' | 'attraction_purchase';
  search: string;
  dateRange: 'all' | 'today' | 'week' | 'month' | 'year';
  startDate: string;
  endDate: string;
}

/**
 * Metrics displayed on the payments page
 */
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
