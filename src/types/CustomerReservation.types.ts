// Types for: src/pages/customer/CustomerReservation.tsx

export type CustomerReservationSortBy = 'date' | 'status' | 'amount';
export type CustomerReservationSortOrder = 'asc' | 'desc';

export interface CustomerReservationReservation {
  id: string;
  referenceNumber: string;
  package: {
    id: string;
    name: string;
    price: number;
    duration: string;
    participants: string;
    includes: string[];
  };
  location: string;
  bookingDate: string;
  bookingTime: string;
  status: 'confirmed' | 'pending' | 'cancelled' | 'refunded';
  paymentId: string;
  totalAmount: number;
  participantsCount: number;
  specialRequests?: string;
  createdAt: string;
}
