import axios from 'axios';
import { API_BASE_URL, getStoredUser } from '../utils/storage';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

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
  total_event_purchases?: number;
  total_event_tickets?: number;
  event_purchase_spent?: number;
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

export interface SpecialPricingDiscount {
  special_pricing_id: number;
  name: string;
  description?: string;
  discount_label: string;
  discount_type: string;
  discount_amount: number;
  is_stackable: boolean;
  recurrence_display?: string;
}

export interface SpecialPricing {
  original_price: number;
  discounted_price: number;
  total_discount: number;
  has_special_pricing: boolean;
  discounts_applied: SpecialPricingDiscount[];
}

export interface GroupedAttraction {
  name: string;
  description: string;
  price: number;
  pricing_type: string;
  category: string;
  max_capacity: number;
  display_capacity_to_customers?: boolean;
  duration: number;
  duration_unit: string;
  image: string | string[];
  rating: number;
  min_age: number;
  locations: GroupedAttractionLocation[];
  purchase_links: AttractionPurchaseLink[];
  availability?: AttractionAvailabilitySchedule[];
  display_order?: number;
  special_pricing?: SpecialPricing;
}

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
  min_participants: number;
  max_guests: number;
  price_per_additional?: number;
  duration: number;
  duration_unit?: 'hours' | 'minutes' | 'hours and minutes';
  image: string | string[];
  locations: GroupedPackageLocation[];
  booking_links: PackageBookingLink[];
  availability_schedules?: PackageAvailabilitySchedule[];
  package_type?: string;
  display_order?: number;
  special_pricing?: SpecialPricing;
}

export interface GroupedEventLocation {
  location_id: number;
  location_name: string;
  location_slug: string;
  event_id: number;
  address: string;
  city: string;
  state: string;
  phone: string;
  add_ons: Array<{
    id: number;
    name: string;
    price: string;
    description?: string;
    image?: string;
  }>;
}

export interface EventPurchaseLink {
  location: string;
  url: string;
  event_id: number;
  location_id: number;
}

export interface GroupedEvent {
  name: string;
  description: string | null;
  image: string | null;
  date_type: 'one_time' | 'date_range';
  start_date: string;
  end_date: string | null;
  time_start: string;
  time_end: string;
  interval_minutes: number;
  max_bookings_per_slot: number | null;
  price: string;
  features: string[] | null;
  locations: GroupedEventLocation[];
  purchase_links: EventPurchaseLink[];
}

class CustomerService {
  async searchCustomers(query: string): Promise<ApiResponse<Customer[]>> {
    const response = await api.get('/customers/search', {
      params: { q: query },
    });
    return response.data;
  }

  async getGroupedAttractions(search?: string, date?: string): Promise<ApiResponse<GroupedAttraction[]>> {
    const params: Record<string, string> = {};
    if (search) params.search = search;
    if (date) params.date = date;
    const response = await api.get('/attractions/grouped', { params });
    return response.data;
  }

  async getAttraction(id: number): Promise<ApiResponse<any>> {
    const response = await api.get(`/attractions/${id}`);
    return response.data;
  }

  async getGroupedPackages(search?: string, date?: string): Promise<ApiResponse<GroupedPackage[]>> {
    const params: Record<string, string> = {};
    if (search) params.search = search;
    if (date) params.date = date;
    const response = await api.get('/packages/grouped-by-name', { params });
    return response.data;
  }

  async getGroupedEvents(search?: string): Promise<ApiResponse<GroupedEvent[]>> {
    const params = search ? { search } : {};
    const response = await api.get('/events/grouped-by-name', { params });
    return response.data;
  }

  async getPackage(id: number): Promise<ApiResponse<any>> {
    const response = await api.get(`/packages/${id}`);
    return response.data;
  }

  async register(data: {
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    password: string;
    password_confirmation: string;
    address?: string;
    address2?: string;
    city?: string;
    state?: string; // 2-letter state code (e.g., 'CA', 'NY')
    zip?: string;
    country?: string; // 2-letter country code (e.g., 'US', 'CA')
  }): Promise<ApiResponse<Customer>> {
    const response = await api.post('/customers', data);
    return response.data;
  }

  async login(email: string, password: string): Promise<{
    user: any;
    role: string;
    token: string;
  }> {
    const response = await api.post('/customer-login', { email, password });
    return response.data;
  }

  async logout(token: string): Promise<{ message: string }> {
    const response = await api.post('/logout', {}, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return response.data;
  }

  async getCustomerById(id: number): Promise<ApiResponse<Customer>> {
    const response = await api.get(`/customers/${id}`);
    return response.data;
  }

  async fetchCustomerList(userId: number, filters?: CustomerListFilters): Promise<PaginatedResponse<CustomerListItem>> {
    const response = await api.get(`/customers/list/${userId}`, { params: filters });
    return response.data;
  }

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
      topEvents?: Array<{ customer: string; event: string; purchases: number }>;
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

export const customerService = new CustomerService();
export default customerService;
