// Types for: src/pages/admin/bookings/CalendarView.tsx

export interface CalendarViewBooking {
  id: string;
  type: 'package';
  packageName: string;
  customerName: string;
  email: string;
  phone: string;
  date: string;
  time: string;
  participants: number;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'checked-in';
  totalAmount: number;
  amountPaid: number;
  createdAt: string;
  paymentMethod: string;
  attractions?: { name: string; quantity: number }[];
  addOns?: { name: string; quantity: number; price: number }[];
  duration?: string;
  notes?: string;
}

export interface CalendarViewFilterOptions {
  view: 'day' | 'week' | 'month' | 'range';
  packages: string[];
  dateRange: {
    start: string;
    end: string;
  };
  search: string;
}
