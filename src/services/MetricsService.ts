import { API_BASE_URL, getStoredUser } from '../utils/storage';

export interface DashboardMetrics {
  totalBookings: number;
  totalRevenue: number;
  totalCustomers: number;
  confirmedBookings: number;
  pendingBookings: number;
  completedBookings: number;
  cancelledBookings: number;
  checkedInBookings: number;
  totalParticipants: number;
  bookingRevenue: number;
  purchaseRevenue: number;
  totalPurchases: number;
}

export type TimeframeType = 'last_24h' | 'last_7d' | 'last_30d' | 'all_time' | 'custom';

export interface TimeframeInfo {
  type: TimeframeType;
  date_from: string | null;
  date_to: string | null;
  description: string;
}

export interface RecentPurchase {
  id: number;
  customer_name: string;
  attraction_name: string | null;
  location_name: string | null;
  quantity: number;
  total_amount: number;
  status: string;
  payment_method: string;
  purchase_date: string;
  created_at: string;
}

export interface LocationStats {
  [locationId: number]: {
    name: string;
    bookings: number;
    purchases: number;
    revenue: number;
    participants: number;
    utilization: number;
  };
}

export interface LocationDetails {
  id: number;
  name: string;
  address: string;
  city: string;
  state: string;
  phone: string;
  email: string;
}

export interface DashboardResponse {
  timeframe: TimeframeInfo;
  metrics: DashboardMetrics;
  recentPurchases: RecentPurchase[];
  locationStats?: LocationStats; // Only for company_admin
  locationDetails?: LocationDetails; // Only for manager/attendant
}

export interface RecentBooking {
  id: number;
  reference_number: string;
  customer_name: string;
  customer_email: string | null;
  package_name: string | null;
  location_name: string | null;
  room_name: string | null;
  booking_date: string;
  booking_time: string;
  participants: number;
  total_amount: number;
  status: string;
  payment_status: string;
  payment_method: string;
  created_at: string;
}

export interface AttendantResponse {
  timeframe: TimeframeInfo;
  metrics: DashboardMetrics;
  recentPurchases: RecentPurchase[];
  recentBookings: RecentBooking[];
}

class MetricsService {
  /**
   * Get dashboard metrics based on authenticated user's role and location
   * - company_admin: All locations (no location filter)
   * - location_manager: Their specific location only
   * - attendant: Their specific location only
   */
  async getDashboardMetrics(params?: {
    timeframe?: TimeframeType;
    date_from?: string;
    date_to?: string;
  }): Promise<DashboardResponse> {
    const user = getStoredUser();
    if (!user || !user.id) {
      console.error('❌ User not authenticated in MetricsService');
      throw new Error('User not authenticated');
    }

    const queryParams = new URLSearchParams();
    
    if (params?.timeframe) {
      queryParams.append('timeframe', params.timeframe);
    }
    if (params?.date_from) {
      queryParams.append('date_from', params.date_from);
    }
    if (params?.date_to) {
      queryParams.append('date_to', params.date_to);
    }

    const url = `${API_BASE_URL}/metrics/dashboard/${user.id}${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    
    console.log('🌐 Metrics API Request:', {
      url,
      userId: user.id,
      params: params,
      hasToken: !!user.token
    });
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${user.token || ''}`,
      },
    });

    console.log('📡 Metrics API Response:', {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API Error Response:', errorText);
      throw new Error(`Failed to fetch dashboard metrics: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log('✅ Metrics API Data:', data);
    return data;
  }

  /**
   * Get attendant-specific metrics with recent transactions
   */
  async getAttendantMetrics(params?: {
    location_id?: number;
    timeframe?: TimeframeType;
    date_from?: string;
    date_to?: string;
  }): Promise<AttendantResponse> {
    const queryParams = new URLSearchParams();
    
    if (params?.location_id) {
      queryParams.append('location_id', params.location_id.toString());
    }
    if (params?.timeframe) {
      queryParams.append('timeframe', params.timeframe);
    }
    if (params?.date_from) {
      queryParams.append('date_from', params.date_from);
    }
    if (params?.date_to) {
      queryParams.append('date_to', params.date_to);
    }

    const url = `${API_BASE_URL}/metrics/attendant${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getStoredUser()?.token || ''}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch attendant metrics: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  }
}

export const metricsService = new MetricsService();
export default metricsService;
