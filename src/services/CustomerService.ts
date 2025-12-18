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

// Types
export interface Customer {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
}

export interface CustomerListItem {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  created_at: string;
  last_visit?: string;
  total_spent: number;
  total_bookings: number;
  total_purchase_tickets: number;
  total_ticket_quantity: number;
  status?: string;
  satisfaction?: number;
  tags?: string[];
}

export interface CustomerListFilters {
  status?: string;
  search?: string;
  sort_by?: 'first_name' | 'last_name' | 'email' | 'created_at' | 'last_visit' | 'total_spent' | 'total_bookings';
  sort_order?: 'asc' | 'desc';
  per_page?: number;
  page?: number;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: {
    customers: T[];
    pagination: {
      current_page: number;
      last_page: number;
      per_page: number;
      total: number;
      from: number;
      to: number;
    };
  };
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  total?: number;
}

// Types for grouped attractions
export interface GroupedAttractionLocation {
  location_id: number;
  location_name: string;
  location_slug: string;
  attraction_id: number;
  address: string;
  city: string;
  state: string;
  phone: string;
}

export interface AttractionPurchaseLink {
  location: string;
  url: string;
  attraction_id: number;
  location_id: number;
}

export interface AttractionAvailabilitySchedule {
  days: string[];
  start_time: string;
  end_time: string;
}

export interface GroupedAttraction {
  name: string;
  description: string;
  price: number;
  pricing_type: string;
  category: string;
  max_capacity: number;
  duration: number;
  duration_unit: string;
  image: string | string[];
  rating: number;
  min_age: number;
  locations: GroupedAttractionLocation[];
  purchase_links: AttractionPurchaseLink[];
  availability?: AttractionAvailabilitySchedule[];
}

// Types for grouped packages
export interface GroupedPackageLocation {
  location_id: number;
  location_name: string;
  location_slug: string;
  package_id: number;
  address: string;
  city: string;
  state: string;
  phone: string;
}

export interface PackageBookingLink {
  location: string;
  url: string;
  package_id: number;
  location_id: number;
}

export interface PackageAvailabilitySchedule {
  id?: number;
  package_id?: number;
  availability_type: string;
  day_configuration: string[];
  time_slot_start: string;
  time_slot_end: string;
  time_slot_interval?: number;
  priority?: number;
  is_active?: boolean;
}

export interface PackageAvailabilitySchedule {
  id?: number;
  package_id?: number;
  availability_type: string;
  day_configuration: string[];
  time_slot_start: string;
  time_slot_end: string;
  time_slot_interval?: number;
  priority?: number;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface GroupedPackage {
  name: string;
  description: string;
  price: number;
  category: string;
  max_guests: number;
  duration: number;
  image: string | string[];
  locations: GroupedPackageLocation[];
  booking_links: PackageBookingLink[];
  availability_schedules?: PackageAvailabilitySchedule[];
}

/**
 * Customer Service
 * Handles all customer-related API calls
 */
class CustomerService {
  /**
   * Search customers by email or name
   */
  async searchCustomers(query: string): Promise<ApiResponse<Customer[]>> {
    const response = await api.get('/customers/search', {
      params: { q: query },
    });
    return response.data;
  }

  /**
   * Get attractions grouped by name with all available locations
   */
  async getGroupedAttractions(search?: string): Promise<ApiResponse<GroupedAttraction[]>> {
    const params = search ? { search } : {};
    const response = await api.get('/attractions/grouped', { params });
    return response.data;
  }

  /**
   * Get single attraction details by ID
   */
  async getAttraction(id: number): Promise<ApiResponse<any>> {
    const response = await api.get(`/attractions/${id}`);
    return response.data;
  }

  /**
   * Get packages grouped by name with all available locations
   */
  async getGroupedPackages(search?: string): Promise<ApiResponse<GroupedPackage[]>> {
    const params = search ? { search } : {};
    const response = await api.get('/packages/grouped-by-name', { params });
    return response.data;
  }

  /**
   * Get single package details by ID
   */
  async getPackage(id: number): Promise<ApiResponse<any>> {
    const response = await api.get(`/packages/${id}`);
    return response.data;
  }

  /**
   * Register a new customer
   */
  async register(data: {
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    password: string;
    password_confirmation: string;
    date_of_birth?: string;
  }): Promise<ApiResponse<Customer>> {
    const response = await api.post('/customers', data);
    return response.data;
  }

  /**
   * Login customer
   */
  async login(email: string, password: string): Promise<{
    user: any;
    role: string;
    token: string;
  }> {
    const response = await api.post('/customer-login', { email, password });
    return response.data;
  }

  /**
   * Logout customer
   */
  async logout(token: string): Promise<{ message: string }> {
    const response = await api.post('/logout', {}, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return response.data;
  }

  /**
   * Get customer by ID
   */
  async getCustomerById(id: number): Promise<ApiResponse<Customer>> {
    const response = await api.get(`/customers/${id}`);
    return response.data;
  }

  /**
   * Fetch customer list with filters and pagination
   */
  async fetchCustomerList(userId: number, filters?: CustomerListFilters): Promise<PaginatedResponse<CustomerListItem>> {
    const response = await api.get(`/customers/list/${userId}`, { params: filters });
    return response.data;
  }

  /**
   * Get customer analytics with optional location filter
   */
  async getAnalytics(params: {
    user_id?: number;
    date_range?: '7d' | '30d' | '90d' | '1y';
    location_id?: number;
  }): Promise<{
    success: boolean;
    data: {
      keyMetrics: Array<{
        label: string;
        value: string;
        change: string;
        trend: 'up' | 'down';
      }>;
      analyticsData: {
        customerGrowth: Array<{ month: string; customers: number; growth: number }>;
        revenueTrend: Array<{ month: string; revenue: number; bookings: number }>;
        bookingTimeDistribution: Array<{ time: string; count: number }>;
        bookingsPerCustomer: Array<{ name: string; bookings: number }>;
        statusDistribution: Array<{ status: string; count: number; color: string }>;
        activityHours: Array<{ hour: string; activity: number }>;
        customerLifetimeValue: Array<{ segment: string; value: number; color: string }>;
        repeatCustomers: Array<{ month: string; repeatRate: number }>;
      };
      topActivities: Array<{ customer: string; activity: string; purchases: number }>;
      topPackages: Array<{ customer: string; package: string; bookings: number }>;
      recentCustomers: Array<{
        id: string;
        name: string;
        email: string;
        joinDate: string;
        totalSpent: number;
        bookings: number;
        lastActivity: string;
        status: string;
      }>;
    };
  }> {
    const response = await api.get('/customers/analytics', { params });
    return response.data;
  }
}

// Export a singleton instance
export const customerService = new CustomerService();
export default customerService;
