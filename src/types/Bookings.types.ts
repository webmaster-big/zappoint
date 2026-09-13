
export interface BookingsPageBooking {
  id: string;
  type: 'package';
  packageName: string;
  packageId?: number;
  room: string;
  roomId?: number;
  customerName: string;
  customerId?: number;
  email: string;
  phone: string;
  date: string;
  time: string;
  participants: number;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'checked-in';
  totalAmount: number;
  amountPaid: number;
  paymentStatus: 'paid' | 'partial' | 'pending' | 'refunded' | 'voided';
  createdAt: string;
  updatedAt?: string;
  paymentMethod: string;
  transactionId?: string;
  attractions?: { name: string; quantity: number }[];
  addOns?: { name: string; quantity: number }[];
  duration?: string;
  referenceNumber: string;
  activity?: string;
  category?: string;
  location?: string;
  locationId?: number;
  notes?: string;
  specialRequests?: string;
  internal_notes?: string; // Staff-only notes, never shown to customer
  guestOfHonorName?: string;
  guestOfHonorAge?: number;
  guestOfHonorGender?: string;
  guestAddress?: string;
  guestCity?: string;
  guestState?: string;
  guestZip?: string;
  guestCountry?: string;
  checked_in_at?: string;
  checked_in_by?: number;
  checked_in_by_user?: {
    id: number;
    name: string;
  };
  appliedFees?: Array<{
    fee_name: string;
    fee_amount: number;
    fee_application_type: 'additive' | 'inclusive';
  }> | null;
}

export interface BookingsPageFilterOptions {
  status: string;
  dateRange: {
    start: string;
    end: string;
  };
  search: string;
  payment: string;
  packageId: string;
  roomId: string;
  customerId: string;
  category: string;
}

export interface BookingsColumnVisibility {
  id: boolean;                    // Confirmation # (booking ID)
  referenceNumber: boolean;       // Reference number
  
  bookingDate: boolean;           // Booking date
  bookingTime: boolean;           // Booking time
  duration: boolean;              // Duration
  
  guestName: boolean;             // Guest name
  guestEmail: boolean;            // Guest email
  guestPhone: boolean;            // Guest phone
  
  guestAddress: boolean;          // Full address (address, city, state, zip, country)
  
  packageName: boolean;           // Package name
  roomName: boolean;              // Room/Space name
  location: boolean;              // Location name
  
  participants: boolean;          // Number of participants
  status: boolean;                // Booking status
  
  paymentMethod: boolean;         // Payment method
  paymentStatus: boolean;         // Payment status
  totalAmount: boolean;           // Total amount
  amountPaid: boolean;            // Amount paid
  fees: boolean;                  // Applied fees
  
  guestOfHonor: boolean;          // Guest of honor info (name, age, gender)
  
  notes: boolean;                 // Customer notes
  specialRequests: boolean;       // Special requests
  
  createdAt: boolean;             // Created date
  updatedAt: boolean;             // Updated date
}

export type BookingsColumnKey = 
  | 'id'
  | 'referenceNumber'
  | 'dateTime'
  | 'customer'
  | 'guestAddress'
  | 'packageRoom'
  | 'location'
  | 'duration'
  | 'participants'
  | 'status'
  | 'paymentMethod'
  | 'paymentStatus'
  | 'amountPaid'
  | 'totalAmount'
  | 'fees'
  | 'guestOfHonor'
  | 'notes'
  | 'specialRequests'
  | 'createdAt'
  | 'updatedAt';

export const DEFAULT_COLUMN_ORDER: BookingsColumnKey[] = [
  'id',
  'referenceNumber',
  'dateTime',
  'customer',
  'guestAddress',
  'packageRoom',
  'location',
  'duration',
  'participants',
  'status',
  'paymentMethod',
  'paymentStatus',
  'amountPaid',
  'totalAmount',
  'fees',
  'guestOfHonor',
  'notes',
  'specialRequests',
  'createdAt',
  'updatedAt'
];

export interface BookingRepriceIntent {
  participants?: number;
  package_id?: number | null;
  booking_date?: string;
  location_id?: number;
  additional_addons?: { addon_id: number; quantity: number }[];
  additional_attractions?: { attraction_id: number; quantity: number }[];
}

export interface BookingQuoteFee {
  fee_name: string;
  fee_label?: string;
  fee_amount: number;
  fee_calculation_type?: 'fixed' | 'percentage';
  fee_application_type: 'additive' | 'inclusive';
}

export interface BookingQuoteLine {
  type: 'package' | 'addon' | 'attraction';
  id: number;
  unit_price: number;
  quantity: number;
  line_total: number;
}

export interface BookingQuote {
  subtotal: number;
  lines: BookingQuoteLine[];
  fees: BookingQuoteFee[];
  persist_fees: BookingQuoteFee[];
  additive_fees: number;
  special_pricing_discount: number;
  membership_discount: number;
  redeemed_credit: number;
  discount_amount: number;
  total_amount: number;
  amount_paid: number;
  remaining_balance: number;
  payment_status: string;
  delta?: number;
  pricing_consistent?: boolean;
}

export type PaymentState = 'paid' | 'partial' | 'pending' | 'refunded' | 'voided';

export interface PaymentStateView {
  state: PaymentState;
  label: string;
  isTerminal: boolean;
  isSettled: boolean;
  total: number;
  amountPaid: number;
  balance: number;
  balanceLabel: string;
  pillClass: string;
  amountClass: string;
}

const PAYMENT_EPSILON = 0.005;
const TERMINAL_PAYMENT_STATES: PaymentState[] = ['refunded', 'voided'];

const toCents = (value: number | string | null | undefined): number => {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
};

export const resolvePaymentState = (input: {
  payment_status?: string | null;
  amount_paid?: number | string | null;
  total_amount?: number | string | null;
}): PaymentStateView => {
  const total = toCents(input.total_amount);
  const amountPaid = toCents(input.amount_paid);
  const balance = Math.round((total - amountPaid) * 100) / 100;
  const stored = (input.payment_status || '').toLowerCase() as PaymentState;
  const amountsKnown = input.total_amount !== undefined && input.total_amount !== null
    && input.amount_paid !== undefined && input.amount_paid !== null;

  if (!amountsKnown && !TERMINAL_PAYMENT_STATES.includes(stored)) {
    const settled = stored === 'paid';
    return {
      state: stored || 'pending',
      label: settled ? 'Paid in Full' : stored === 'partial' ? 'Partially Paid' : 'Unpaid',
      isTerminal: false,
      isSettled: settled,
      total,
      amountPaid,
      balance,
      balanceLabel: settled ? 'Paid in Full' : 'Balance Due',
      pillClass: settled ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800',
      amountClass: settled ? 'text-green-600' : 'text-red-600',
    };
  }

  if (TERMINAL_PAYMENT_STATES.includes(stored)) {
    return {
      state: stored,
      label: stored === 'refunded' ? 'Refunded' : 'Voided',
      isTerminal: true,
      isSettled: true,
      total,
      amountPaid,
      balance,
      balanceLabel: stored === 'refunded' ? 'Refunded' : 'Voided',
      pillClass: 'bg-slate-100 text-slate-700',
      amountClass: 'text-slate-600',
    };
  }

  if (balance <= PAYMENT_EPSILON) {
    return {
      state: 'paid',
      label: 'Paid in Full',
      isTerminal: false,
      isSettled: true,
      total,
      amountPaid,
      balance,
      balanceLabel: balance < -PAYMENT_EPSILON ? 'Credit Due' : 'Paid in Full',
      pillClass: 'bg-green-100 text-green-800',
      amountClass: 'text-green-600',
    };
  }

  const state: PaymentState = amountPaid > 0 ? 'partial' : 'pending';

  return {
    state,
    label: state === 'partial' ? 'Partially Paid' : 'Unpaid',
    isTerminal: false,
    isSettled: false,
    total,
    amountPaid,
    balance,
    balanceLabel: 'Balance Due',
    pillClass: 'bg-red-100 text-red-800',
    amountClass: 'text-red-600',
  };
};

export const derivePaymentStatus = (amountPaid: number, totalAmount: number): 'paid' | 'partial' | 'pending' =>
  resolvePaymentState({ amount_paid: amountPaid, total_amount: totalAmount }).state as 'paid' | 'partial' | 'pending';
