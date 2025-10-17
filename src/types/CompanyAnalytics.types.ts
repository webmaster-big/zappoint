// Types for: src/pages/admin/Analytics/CompanyAnalytics.tsx

export interface CompanyAnalyticsBooking {
  id: string;
  date: string;
  package: string;
  participants: number;
  amount: number;
  status: 'Confirmed' | 'Pending' | 'Cancelled';
  location: string;
}

export interface CompanyAnalyticsTicketPurchase {
  id: string;
  date: string;
  attraction: string;
  quantity: number;
  amount: number;
  status: 'Completed' | 'Pending' | 'Cancelled';
  location: string;
}

export interface CompanyAnalyticsLocationData {
  bookings: CompanyAnalyticsBooking[];
  ticketPurchases: CompanyAnalyticsTicketPurchase[];
}

export interface CompanyAnalyticsLocationMetrics {
  revenue: number;
  bookings: number;
  tickets: number;
  participants: number;
}

export interface CompanyAnalyticsMetrics {
  totalRevenue: number;
  totalBookings: number;
  totalTickets: number;
  totalParticipants: number;
  locationMetrics: Record<string, CompanyAnalyticsLocationMetrics>;
  packageRevenue: Record<string, number>;
  attractionRevenue: Record<string, number>;
}

export interface CompanyAnalyticsMetricCardProps {
  title: string;
  value: string;
  change?: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  trend?: 'up' | 'down';
}

export interface CompanyAnalyticsProps {}
