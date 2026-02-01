// Types for: src/pages/admin/bookings/Bookings.tsx

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
  paymentStatus: 'paid' | 'partial' | 'pending';
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
  // Guest of Honor fields
  guestOfHonorName?: string;
  guestOfHonorAge?: number;
  guestOfHonorGender?: string;
  // Address fields
  guestAddress?: string;
  guestCity?: string;
  guestState?: string;
  guestZip?: string;
  guestCountry?: string;
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

// Column visibility configuration - granular control for all available fields
export interface BookingsColumnVisibility {
  // Booking identifiers
  id: boolean;                    // Confirmation # (booking ID)
  referenceNumber: boolean;       // Reference number
  
  // Date & Time group
  bookingDate: boolean;           // Booking date
  bookingTime: boolean;           // Booking time
  duration: boolean;              // Duration
  
  // Customer info group (displayed together in Customer column)
  guestName: boolean;             // Guest name
  guestEmail: boolean;            // Guest email
  guestPhone: boolean;            // Guest phone
  
  // Customer address group
  guestAddress: boolean;          // Full address (address, city, state, zip, country)
  
  // Package & Room group
  packageName: boolean;           // Package name
  roomName: boolean;              // Room/Space name
  location: boolean;              // Location name
  
  // Booking details
  participants: boolean;          // Number of participants
  status: boolean;                // Booking status
  
  // Payment group
  paymentMethod: boolean;         // Payment method
  paymentStatus: boolean;         // Payment status
  totalAmount: boolean;           // Total amount
  amountPaid: boolean;            // Amount paid
  
  // Guest of Honor group
  guestOfHonor: boolean;          // Guest of honor info (name, age, gender)
  
  // Notes group
  notes: boolean;                 // Customer notes
  specialRequests: boolean;       // Special requests
  
  // Timestamps
  createdAt: boolean;             // Created date
  updatedAt: boolean;             // Updated date
}

// Column key type for drag-and-drop ordering
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
  | 'guestOfHonor'
  | 'notes'
  | 'specialRequests'
  | 'createdAt'
  | 'updatedAt';

// Default column order
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
  'guestOfHonor',
  'notes',
  'specialRequests',
  'createdAt',
  'updatedAt'
];

// Helper to derive payment status from amounts
export const derivePaymentStatus = (amountPaid: number, totalAmount: number): 'paid' | 'partial' | 'pending' => {
  if (amountPaid <= 0) return 'pending';
  if (amountPaid >= totalAmount) return 'paid';
  return 'partial';
};
