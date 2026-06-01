
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

export const derivePaymentStatus = (amountPaid: number, totalAmount: number): 'paid' | 'partial' | 'pending' => {
  if (amountPaid <= 0) return 'pending';
  if (amountPaid >= totalAmount) return 'paid';
  return 'partial';
};
