import type { Booking } from './booking';
import type { Package } from './booking';
import type { RevenueData } from './analytics';

export interface DashboardStats {
  totalRevenue: number;
  totalBookings: number;
  totalCustomers: number;
  totalAttractions: number;
  recentBookings: Booking[];
  popularPackages: Package[];
  revenueChart: RevenueData[];
}