// Types for: src/pages/admin/customer/CustomerAnalytics.tsx

export interface CustomerAnalyticsCustomerData {
  id: string;
  name: string;
  email: string;
  joinDate: string;
  totalSpent: number;
  bookings: number;
  lastActivity: string;
  status: 'active' | 'inactive' | 'new';
}

export interface CustomerAnalyticsAnalyticsData {
  customerGrowth: { month: string; customers: number; growth: number }[];
  revenueTrend: { month: string; revenue: number; bookings: number }[];
  activityHours: { hour: string; activity: number }[];
  bookingTimeDistribution: { time: string; count: number }[];
  customerLifetimeValue: { segment: string; value: number; color: string }[];
  repeatCustomers: { month: string; repeatRate: number }[];
  bookingsPerCustomer: { name: string; bookings: number }[];
  statusDistribution: { status: string; count: number; color: string }[];
}
