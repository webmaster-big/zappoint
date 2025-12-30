import axios from 'axios';
import { API_BASE_URL, getStoredUser } from '../utils/storage';

// Create axios instance with base configuration
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

// Add request interceptor to include auth token
api.interceptors.request.use(
  (config) => {
    const token = getStoredUser()?.token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export interface LocationAnalyticsParams {
  location_id: number;
  date_range?: '7d' | '30d' | '90d' | '1y' | 'custom';
  start_date?: string;
  end_date?: string;
}

export interface CompanyAnalyticsParams {
  company_id: number;
  date_range?: '7d' | '30d' | '90d' | '1y' | 'custom';
  start_date?: string;
  end_date?: string;
  location_ids?: number[];
}

export interface ExportAnalyticsParams extends LocationAnalyticsParams {
  format?: 'json' | 'csv';
  sections?: ('metrics' | 'revenue' | 'packages' | 'attractions' | 'timeslots')[];
}

export interface ExportCompanyAnalyticsParams extends CompanyAnalyticsParams {
  format?: 'json' | 'csv';
  sections?: ('metrics' | 'revenue' | 'packages' | 'attractions' | 'locations')[];
}

export interface LocationAnalyticsResponse {
  location: {
    id: number;
    name: string;
    address: string;
    city: string;
    state: string;
    zip_code: string;
    full_address: string;
  };
  date_range: {
    period: string;
    start_date: string;
    end_date: string;
  };
  key_metrics: {
    location_revenue: {
      value: number;
      change: string;
      trend: 'up' | 'down';
    };
    package_bookings: {
      value: number;
      change: string;
      trend: 'up' | 'down';
    };
    ticket_sales: {
      value: number;
      change: string;
      trend: 'up' | 'down';
    };
    total_visitors: {
      value: number;
      change: string;
      trend: 'up' | 'down';
    };
    active_packages: {
      value: number;
      info: string;
    };
    active_attractions: {
      value: number;
      info: string;
    };
  };
  hourly_revenue: Array<{
    hour: string;
    revenue: number;
    bookings: number;
  }>;
  daily_revenue: Array<{
    day: string;
    date: string;
    revenue: number;
    participants: number;
  }>;
  weekly_trend: Array<{
    week: string;
    week_start: string;
    week_end: string;
    revenue: number;
    bookings: number;
    tickets: number;
  }>;
  package_performance: Array<{
    id: number;
    name: string;
    category: string;
    bookings: number;
    revenue: number;
    participants: number;
    avg_party_size: number;
    price: number;
  }>;
  attraction_performance: Array<{
    id: number;
    name: string;
    category: string;
    sessions: number;
    tickets_sold: number;
    revenue: number;
    utilization: number;
    price: number;
    max_capacity: number;
  }>;
  time_slot_performance: Array<{
    slot: string;
    bookings: number;
    revenue: number;
    avg_value: number;
  }>;
}

export interface CompanyAnalyticsResponse {
  company: {
    id: number;
    name: string;
    total_locations: number;
  };
  date_range: {
    period: string;
    start_date: string;
    end_date: string;
  };
  selected_locations: number[];
  available_locations: Array<{
    id: number;
    name: string;
  }>;
  key_metrics: {
    total_revenue: {
      value: number;
      change: string;
      trend: 'up' | 'down';
    };
    total_locations: {
      value: number;
      info: string;
    };
    package_bookings: {
      value: number;
      change: string;
      trend: 'up' | 'down';
    };
    ticket_purchases: {
      value: number;
      change: string;
      trend: 'up' | 'down';
    };
    total_participants: {
      value: number;
      change: string;
      trend: 'up' | 'down';
    };
    active_packages: {
      value: number;
      info: string;
    };
  };
  revenue_trend: Array<{
    month: string;
    revenue: number;
    bookings: number;
  }>;
  location_performance: Array<{
    location: string;
    location_id: number;
    revenue: number;
    bookings: number;
  }>;
  package_distribution: Array<{
    name: string;
    value: number;
    count: number;
    color: string;
  }>;
  peak_hours: Array<{
    hour: string;
    bookings: number;
  }>;
  daily_performance: Array<{
    day: string;
    date: string;
    revenue: number;
    participants: number;
  }>;
  booking_status: Array<{
    status: string;
    count: number;
    color: string;
  }>;
  top_attractions: Array<{
    id: number;
    name: string;
    tickets_sold: number;
    revenue: number;
  }>;
}

class AnalyticsService {
  /**
   * Get location analytics data
   */
  async getLocationAnalytics(params: LocationAnalyticsParams): Promise<LocationAnalyticsResponse> {
    const response = await api.get('/analytics/location', { params });
    return response.data;
  }

  /**
   * Get company-wide analytics data
   */
  async getCompanyAnalytics(params: CompanyAnalyticsParams): Promise<CompanyAnalyticsResponse> {
    const response = await api.get('/analytics/company', { params });
    return response.data;
  }

  /**
   * Export location analytics
   */
  async exportAnalytics(params: ExportAnalyticsParams): Promise<Blob | any> {
    const response = await api.post('/analytics/location/export', params, {
      responseType: params.format === 'csv' ? 'blob' : 'json',
    });
    return response.data;
  }

  /**
   * Export company analytics
   */
  async exportCompanyAnalytics(params: ExportCompanyAnalyticsParams): Promise<Blob | any> {
    const response = await api.post('/analytics/company/export', params, {
      responseType: params.format === 'csv' ? 'blob' : 'json',
    });
    return response.data;
  }

  /**
   * Download exported analytics file
   */
  downloadExportedFile(data: Blob | any, format: 'json' | 'csv', locationName: string) {
    const blob = format === 'csv' 
      ? data 
      : new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const date = new Date().toISOString().split('T')[0];
    const extension = format === 'csv' ? 'csv' : 'json';
    a.download = `${locationName.toLowerCase().replace(/\s+/g, '-')}-analytics-${date}.${extension}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

export default new AnalyticsService();
