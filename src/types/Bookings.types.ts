// Types for: src/pages/admin/bookings/Bookings.tsx

export interface BookingsPageBooking {
  id: string;
  type: 'package';
  packageName: string;
  room: string;
  customerName: string;
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
  paymentMethod: string;
  attractions?: { name: string; quantity: number }[];
  addOns?: { name: string; quantity: number }[];
  duration?: string;
  referenceNumber: string;
  activity?: string;
  location?: string;
}

export interface BookingsPageFilterOptions {
  status: string;
  dateRange: {
    start: string;
    end: string;
  };
  search: string;
  payment: string;
}
