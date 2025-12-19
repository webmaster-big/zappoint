// Types for: src/pages/admin/Analytics/LocationManagerAnalytics.tsx

export interface LocationManagerAnalyticsBooking {
  id: string;
  date: string;
  package: string;
  participants: number;
  amount: number;
  status: 'Confirmed' | 'Pending' | 'Cancelled';
  location: string;
  customer: string;
  duration: string;
}

export interface LocationManagerAnalyticsTicketPurchase {
  id: string;
  date: string;
  attraction: string;
  quantity: number;
  amount: number;
  status: 'Completed' | 'Pending' | 'Cancelled';
  location: string;
  customer: string;
  timeSlot: 'Morning' | 'Afternoon' | 'Evening';
}

export interface LocationManagerAnalyticsData {
  bookings: LocationManagerAnalyticsBooking[];
  ticketPurchases: LocationManagerAnalyticsTicketPurchase[];
}

export interface LocationManagerAnalyticsMetrics {
  totalRevenue: number;
  totalBookings: number;
  totalTickets: number;
  totalParticipants: number;
  packageRevenue: Record<string, number>;
  attractionRevenue: Record<string, number>;
  timeSlotRevenue: {
    Morning: number;
    Afternoon: number;
    Evening: number;
  };
  timeSlotCounts: {
    Morning: number;
    Afternoon: number;
    Evening: number;
  };
  attractionPopularity: Record<string, number>;
  bookingStatus: Record<string, number>;
  purchaseStatus: Record<string, number>;
  avgBookingValue: number;
  avgPurchaseValue: number;
  bookingRevenue: number;
  purchaseRevenue: number;
  occupancyRate: number;
  dailyRevenue: { date: string; amount: number }[];
  dayRevenue: Record<string, number>;
  dayBookingCount: Record<string, number>;
  recentTransactions: Array<{
    type: 'Package Booking' | 'Ticket Purchase';
    name: string;
    amount: number;
    date: string;
    customer: string;
    status: string;
  }>;
  revenueChange: number;
  revenueGrowth: 'up' | 'down';
}

export interface LocationManagerAnalyticsMetricCardProps {
  title: string;
  value: string;
  change?: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  trend?: 'up' | 'down';
  subtitle?: string;
}
