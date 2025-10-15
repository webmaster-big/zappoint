export interface AnalyticsData {
  totalRevenue: number;
  totalBookings: number;
  totalCustomers: number;
  averageBookingValue: number;
  revenueGrowth: number;
  bookingGrowth: number;
  customerGrowth: number;
}

export interface RevenueData {
  date: string;
  revenue: number;
  bookings: number;
}

export interface BookingTrend {
  month: string;
  bookings: number;
  revenue: number;
}

export interface PerformanceMetric {
  attendantId: string;
  attendantName: string;
  totalBookings: number;
  totalRevenue: number;
  customerRating: number;
  efficiency: number;
}