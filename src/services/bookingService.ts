import axios from 'axios';
import type { BookPackagePackage } from '../types/BookPackage.types';
import type { Package, PackageFilters } from './PackageService';
import { API_BASE_URL, getStoredUser } from '../utils/storage';

const getBestToken = (): string | null => {
  const adminToken = getStoredUser()?.token;
  if (adminToken) return adminToken;
  try {
    const stored = localStorage.getItem('zapzone_customer');
    if (stored) {
      const customer = JSON.parse(stored);
      return customer?.token || null;
    }
  } catch {
  }
  return null;
};

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    const token = getBestToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export interface CreateBookingData {
  customer_id?: number;
  guest_name?: string;
  guest_email?: string;
  guest_phone?: string;
  
  package_id?: number;
  location_id: number;
  room_id?: number;
  created_by?: number;
  gift_card_id?: number;
  promo_id?: number;
  type: 'package';
  
  booking_date: string; // YYYY-MM-DD format
  booking_time: string; // HH:mm format
  
  participants: number;
  duration: number;
  duration_unit: 'hours' | 'minutes' | 'hours and minutes';
  
  total_amount: number;
  amount_paid?: number;
  discount_amount?: number;
  payment_method?: 'card' | 'in-store' | 'paylater' | 'authorize.net';
  payment_status?: 'paid' | 'partial' | 'pending';
  
  status?: 'pending' | 'confirmed' | 'checked-in' | 'completed' | 'cancelled';
  notes?: string;
  special_requests?: string;
  
  attraction_ids?: number[];
  addon_ids?: number[];
  quantity?: number;
  
  additional_attractions?: Array<{
    attraction_id: number;
    quantity: number;
    price_at_booking: number;
  }>;
  additional_addons?: Array<{
    addon_id: number;
    quantity: number;
    price_at_booking: number;
  }>;

  applied_fees?: Array<{
    fee_name: string;
    fee_amount: number;
    fee_application_type: 'additive' | 'inclusive';
  }> | null;

  applied_discounts?: Array<{
    discount_name: string;
    discount_amount: number;
    discount_type: 'fixed' | 'percentage';
    original_price: number;
    special_pricing_id: number | null;
  }> | null;

  membership_id?: number | null;
  membership_applied?: Array<{
    membership_plan_benefit_id: number | null;
    benefit_type: string;
    value_mode: string;
    value_applied: number;
  }> | null;

  promo_code?: string | null;
  gift_card_code?: string | null;
  sms_consent?: boolean;
  send_email?: boolean;
  internal_notes?: string;

  guest_of_honor_name?: string;
  guest_of_honor_age?: number;
  guest_of_honor_gender?: 'male' | 'female' | 'other';
  guest_address?: string;
  guest_city?: string;
  guest_state?: string;
  guest_zip?: string;
  guest_country?: string;
}

export interface UpdateBookingData {
  customer_id?: number;
  guest_name?: string;
  guest_email?: string;
  guest_phone?: string;
  package_id?: number;
  location_id?: number;
  room_id?: number;
  booking_date?: string;
  booking_time?: string;
  participants?: number;
  duration?: number;
  duration_unit?: 'hours' | 'minutes' | 'hours and minutes';
  total_amount?: number;
  amount_paid?: number;
  discount_amount?: number;
  payment_method?: 'card' | 'cash';
  payment_status?: 'paid' | 'partial' | 'pending';
  status?: 'pending' | 'confirmed' | 'checked-in' | 'completed' | 'cancelled';
  notes?: string;
  internal_notes?: string; // Staff-only notes, never shown to customer
  special_requests?: string;
  guest_of_honor_name?: string;
  guest_of_honor_age?: number;
  guest_of_honor_gender?: 'male' | 'female' | 'other';
  send_notification?: boolean; // Control whether to send customer notification on update
  transaction_id?: string; // Payment transaction ID from Authorize.Net
  additional_attractions?: Array<{
    attraction_id: number;
    quantity: number;
    price_at_booking: number;
  }>;
  additional_addons?: Array<{
    addon_id: number;
    quantity: number;
    price_at_booking: number;
  }>;

  applied_fees?: Array<{
    fee_name: string;
    fee_amount: number;
    fee_application_type: 'additive' | 'inclusive';
  }> | null;

  applied_discounts?: Array<{
    discount_name: string;
    discount_amount: number;
    discount_type: 'fixed' | 'percentage';
    original_price: number;
    special_pricing_id: number | null;
  }> | null;
}

export interface BookingFilters {
  status?: 'pending' | 'confirmed' | 'checked-in' | 'completed' | 'cancelled';
  location_id?: number;
  customer_id?: number;
  guest_email?: string;
  date_from?: string;
  date_to?: string;
  booking_date?: string;
  upcoming?: boolean;
  search?: string;
  sort_by?: 'booking_date' | 'booking_time' | 'total_amount' | 'status' | 'created_at';
  sort_order?: 'asc' | 'desc';
  per_page?: number;
  page?: number;
  user_id?: number;
  reference_number?: string;
}

export interface CreateTimeSlotData {
  package_id: number;
  room_id: number;
  booking_id: number;
  customer_id?: number;
  user_id?: number;
  booked_date: string;
  time_slot_start: string;
  duration: number;
  duration_unit: 'hours' | 'minutes' | 'hours and minutes';
  status?: 'booked' | 'completed' | 'cancelled' | 'no_show';
  notes?: string;
}

export interface Booking {
  id: number;
  reference_number: string;
  customer_id?: number;
  guest_name?: string;
  guest_email?: string;
  guest_phone?: string;
  package_id?: number;
  location_id: number;
  room_id?: number;
  created_by?: number;
  gift_card_id?: number;
  promo_id?: number;
  type: 'package';
  booking_date: string;
  booking_time: string;
  participants: number;
  duration: number;
  duration_unit: 'hours' | 'minutes' | 'hours and minutes';
  total_amount: string | number;
  amount_paid: string | number;
  discount_amount?: string | number;
  payment_method?: 'card' | 'cash';
  payment_status: 'paid' | 'partial' | 'pending';
  status: 'pending' | 'confirmed' | 'checked-in' | 'completed' | 'cancelled';
  notes?: string;
  internal_notes?: string; // Staff-only notes, never shown to customer
  special_requests?: string;
  guest_of_honor_name?: string;
  guest_of_honor_age?: number;
  guest_of_honor_gender?: 'male' | 'female' | 'other';
  checked_in_at?: string;
  checked_in_by?: number;
  checked_in_by_user?: {
    id: number;
    name: string;
  };
  completed_at?: string;
  cancelled_at?: string;
  deleted_at?: string;
  waiver_signing_url?: string | null;
  waiver_status?: string | null;
  created_at: string;
  updated_at: string;
  customer?: unknown;
  package?: BookPackagePackage;
  location?: unknown;
  room?: unknown;
  creator?: unknown;
  giftCard?: unknown;
  promo?: unknown;
  attractions?: Array<{
    id: number;
    name: string;
    price?: string | number;
    pivot?: {
      attraction_id: number;
      booking_id: number;
      quantity: number;
      price_at_booking: string | number;
    };
  }>;
  add_ons?: Array<{
    id: number;
    name: string;
    price?: string | number;
    pivot?: {
      add_on_id: number;
      booking_id: number;
      quantity: number;
      price_at_booking: string | number;
    };
  }>;
  payments?: unknown[];
  applied_fees?: Array<{
    fee_name: string;
    fee_amount: number;
    fee_application_type: 'additive' | 'inclusive';
  }> | null;
}

export interface BookingResponse {
  success: boolean;
  data: Booking;
  message?: string;
}

export interface PaginatedBookingResponse {
  success: boolean;
  data: {
    bookings: Booking[];
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

export interface TimeSlotResponse {
  success: boolean;
  data: {
    id: number;
    package_id: number;
    room_id: number;
    booking_id: number;
    customer_id: number;
    booked_date: string;
    time_slot_start: string;
    duration: number;
    duration_unit: string;
    status: string;
    created_at: string;
  };
  message?: string;
}

const bookingService = {
  async getPackageById(packageId: number): Promise<{ success: boolean; data: BookPackagePackage }> {
    const response = await api.get(`/packages/${packageId}`);
    return response.data;
  },

  async getBookings(filters?: BookingFilters): Promise<PaginatedBookingResponse> {
    const params = new URLSearchParams();
    
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          params.append(key, String(value));
        }
      });
    }

    console.log('Booking filters params:', params.toString());

    const useCustomerEndpoint = filters?.customer_id || filters?.guest_email;
    const endpoint = useCustomerEndpoint ? '/customers/bookings' : '/bookings';

    const response = await api.get(`${endpoint}?${params.toString()}`);
    return response.data;
  },

  async getBookingById(bookingId: number): Promise<BookingResponse> {
    const response = await api.get(`/bookings/${bookingId}`);
    return response.data;
  },

  async createBooking(bookingData: CreateBookingData): Promise<BookingResponse> {
    const response = await api.post('/bookings', bookingData);
    return response.data;
  },

  async updateBooking(id: number, data: UpdateBookingData): Promise<BookingResponse> {
    const response = await api.put(`/bookings/${id}`, data);
    return response.data;
  },

  async deleteBooking(id: number): Promise<{ success: boolean; message: string }> {
    const response = await api.delete(`/bookings/${id}`);
    return response.data;
  },

  async cancelBooking(id: number): Promise<BookingResponse> {
    const response = await api.patch(`/bookings/${id}/cancel`);
    return response.data;
  },

  async checkInBooking(referenceNumber: string, userId?: number): Promise<BookingResponse> {
    const payload: { reference_number: string; user_id?: number } = {
      reference_number: referenceNumber
    };
    
    if (userId) {
      payload.user_id = userId;
    }
    
    const response = await api.post('/bookings/check-in', payload);
    return response.data;
  },

  async completeBooking(id: number): Promise<BookingResponse> {
    const response = await api.patch(`/bookings/${id}/complete`);
    return response.data;
  },

  async getBookingsByLocationAndDate(location_id: number, date: string): Promise<{ success: boolean; data: Booking[] }> {
    const response = await api.get('/bookings/location-date', {
      params: { location_id, date }
    });
    return response.data;
  },

  async searchBookings(query: string): Promise<{ success: boolean; data: Booking[] }> {
    const response = await api.get('/bookings/search', {
      params: { query }
    });
    return response.data;
  },

  async getCustomerBookings(email: string): Promise<{ success: boolean; data: Booking[] }> {
    const response = await api.get(`/bookings/customer/${email}`);
    return response.data;
  },

  async getCustomerBookingsFiltered(params: {
    customer_id?: number;
    guest_email?: string;
    search?: string;
    sort_by?: 'booking_date' | 'booking_time' | 'total_amount' | 'status' | 'created_at';
    sort_order?: 'asc' | 'desc';
    per_page?: number;
    page?: number;
  }): Promise<PaginatedBookingResponse> {
    const response = await api.get('/customers/bookings', { params });
    return response.data;
  },

  async createTimeSlot(timeSlotData: CreateTimeSlotData): Promise<TimeSlotResponse> {
    const response = await api.post('/package-time-slots', timeSlotData);
    return response.data;
  },

  async getPackages(filters?: PackageFilters): Promise<{ 
    success: boolean; 
    data: { 
      packages: Package[]; 
      pagination: {
        current_page: number;
        last_page: number;
        per_page: number;
        total: number;
        from: number;
        to: number;
      };
    } 
  }> {
    const response = await api.get('/packages', { params: filters });
    return response.data;
  },

  async storeQrCode(bookingId: number, qrCodeBase64: string, sendEmail: boolean = true): Promise<{ 
    success: boolean; 
    message: string;
    data: {
      qr_code_path: string;
      qr_code_url: string;
    };
  }> {
    const response = await api.post(`/bookings/${bookingId}/qrcode`, {
      qr_code: qrCodeBase64,
      send_email: sendEmail
    });
    return response.data;
  },

  async exportBookings(filters: {
    user_id?: number;
    location_id?: number | number[];
    reference_number?: string;
    status?: string | string[];
    customer_id?: number | number[];
    start_date?: string;
    end_date?: string;
    min_amount?: number;
    max_amount?: number;
    sort_by?: string;
    sort_order?: 'asc' | 'desc';
  }): Promise<{
    success: boolean;
    data: {
      bookings: any[];
    };
  }> {
    const response = await api.get('/bookings/export', { params: filters });
    return response.data;
  },

  async bulkDelete(ids: number[]): Promise<{
    success: boolean;
    message: string;
  }> {
    const response = await api.post('/bookings/bulk-delete', { ids });
    return response.data;
  },

  async updateInternalNotes(bookingId: number, internalNotes: string): Promise<{
    success: boolean;
    message: string;
    data?: any;
  }> {
    const response = await api.patch(`/bookings/${bookingId}/internal-notes`, { internal_notes: internalNotes });
    return response.data;
  },

  async createPackageRoom(data: {
    package_id: number;
    room_id: number;
  }): Promise<{
    success: boolean;
    message: string;
    data: any;
  }> {
    const response = await api.post('/packages/room/create', data);
    return response.data;
  },


  async getTrashedBookings(filters?: {
    search?: string;
    location_id?: number;
    user_id?: number;
    sort_by?: string;
    sort_order?: 'asc' | 'desc';
    per_page?: number;
    page?: number;
  }): Promise<PaginatedBookingResponse> {
    const response = await api.get('/bookings/trashed', { params: filters });
    return response.data;
  },

  async restoreBooking(id: number): Promise<BookingResponse> {
    const response = await api.post(`/bookings/${id}/restore`);
    return response.data;
  },

  async forceDeleteBooking(id: number): Promise<{
    success: boolean;
    message: string;
  }> {
    const response = await api.delete(`/bookings/${id}/force-delete`);
    return response.data;
  },

  async bulkRestore(ids: number[]): Promise<{
    success: boolean;
    message: string;
    data: { restored_count: number };
  }> {
    const response = await api.post('/bookings/bulk-restore', { ids });
    return response.data;
  },

  async bulkImportCsv(
    file: File,
    locationId: number,
    skipDuplicates: boolean = true
  ): Promise<{
    success: true;
    message: string;
    data: {
      imported: number;
      skipped: number;
      errors: { row: number; error: string }[];
      total_rows: number;
    };
  }> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('location_id', locationId.toString());
    formData.append('skip_duplicates', skipDuplicates ? '1' : '0');

    const response = await api.post('/bookings/bulk-import-csv', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },
};

export default bookingService;
