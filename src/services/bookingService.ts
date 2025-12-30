import axios from 'axios';
import type { BookPackagePackage } from '../types/BookPackage.types';
import type { Package, PackageFilters } from './PackageService';
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
    console.log('BookingService - Adding auth token to request:', token);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Enhanced interfaces matching Laravel backend
export interface CreateBookingData {
  // Customer information (either customer_id OR guest details required)
  customer_id?: number;
  guest_name?: string;
  guest_email?: string;
  guest_phone?: string;
  
  // Booking details
  package_id?: number;
  location_id: number;
  room_id?: number;
  created_by?: number;
  gift_card_id?: number;
  promo_id?: number;
  type: 'package';
  
  // Date and time
  booking_date: string; // YYYY-MM-DD format
  booking_time: string; // HH:mm format
  
  // Participants and duration
  participants: number;
  duration: number;
  duration_unit: 'hours' | 'minutes' | 'hours and minutes';
  
  // Payment
  total_amount: number;
  amount_paid?: number;
  discount_amount?: number;
  payment_method?: 'card' | 'cash' | 'paylater';
  payment_status?: 'paid' | 'partial' | 'pending';
  
  // Status and notes
  status?: 'pending' | 'confirmed' | 'checked-in' | 'completed' | 'cancelled';
  notes?: string;
  special_requests?: string;
  
  // Related items
  attraction_ids?: number[];
  addon_ids?: number[];
  quantity?: number;
  
  // Detailed attraction/addon data with individual quantities and prices
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
  completed_at?: string;
  cancelled_at?: string;
  created_at: string;
  updated_at: string;
  // Relations
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
  /**
   * Fetch a specific package by ID with all relations
   */
  async getPackageById(packageId: number): Promise<{ success: boolean; data: BookPackagePackage }> {
    const response = await api.get(`/packages/${packageId}`);
    return response.data;
  },

  /**
   * Get all bookings with optional filters (Paginated)
   */
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

    // Use customer bookings endpoint if customer_id or guest_email is provided
    const useCustomerEndpoint = filters?.customer_id || filters?.guest_email;
    const endpoint = useCustomerEndpoint ? '/customers/bookings' : '/bookings';

    const response = await api.get(`${endpoint}?${params.toString()}`);
    return response.data;
  },

  /**
   * Get booking by ID
   */
  async getBookingById(bookingId: number): Promise<BookingResponse> {
    const response = await api.get(`/bookings/${bookingId}`);
    return response.data;
  },

  /**
   * Create a new booking (Main CREATE method)
   */
  async createBooking(bookingData: CreateBookingData): Promise<BookingResponse> {
    const response = await api.post('/bookings', bookingData);
    return response.data;
  },

  /**
   * Update an existing booking
   */
  async updateBooking(id: number, data: UpdateBookingData): Promise<BookingResponse> {
    const response = await api.put(`/bookings/${id}`, data);
    return response.data;
  },

  /**
   * Delete a booking
   */
  async deleteBooking(id: number): Promise<{ success: boolean; message: string }> {
    const response = await api.delete(`/bookings/${id}`);
    return response.data;
  },

  /**
   * Cancel a booking
   */
  async cancelBooking(id: number): Promise<BookingResponse> {
    const response = await api.patch(`/bookings/${id}/cancel`);
    return response.data;
  },

  /**
   * Check in a booking
   */
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

  /**
   * Complete a booking
   */
  async completeBooking(id: number): Promise<BookingResponse> {
    const response = await api.patch(`/bookings/${id}/complete`);
    return response.data;
  },

  /**
   * Get bookings by location and date
   */
  async getBookingsByLocationAndDate(location_id: number, date: string): Promise<{ success: boolean; data: Booking[] }> {
    const response = await api.get('/bookings/location-date', {
      params: { location_id, date }
    });
    return response.data;
  },

  /**
   * Search bookings
   */
  async searchBookings(query: string): Promise<{ success: boolean; data: Booking[] }> {
    const response = await api.get('/bookings/search', {
      params: { query }
    });
    return response.data;
  },

  /**
   * Get bookings by customer email (Legacy method)
   */
  async getCustomerBookings(email: string): Promise<{ success: boolean; data: Booking[] }> {
    const response = await api.get(`/bookings/customer/${email}`);
    return response.data;
  },

  /**
   * Get customer bookings with filters and pagination (NEW)
   */
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

  /**
   * Create a time slot record for a booking
   */
  async createTimeSlot(timeSlotData: CreateTimeSlotData): Promise<TimeSlotResponse> {
    const response = await api.post('/package-time-slots', timeSlotData);
    return response.data;
  },

  /**
   * Get all packages (for onsite booking and package selection)
   */
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

  /**
   * Store QR code for a booking
   */
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

  /**
   * Export bookings with advanced filters
   */
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

  /**
   * Bulk delete bookings
   */
  async bulkDelete(ids: number[]): Promise<{
    success: boolean;
    message: string;
  }> {
    const response = await api.post('/bookings/bulk-delete', { ids });
    return response.data;
  },

  /**
   * Update internal notes for a booking
   */
  async updateInternalNotes(bookingId: number, internalNotes: string): Promise<{
    success: boolean;
    message: string;
    data?: any;
  }> {
    const response = await api.patch(`/bookings/${bookingId}/internal-notes`, { internal_notes: internalNotes });
    return response.data;
  },

  /**
   * Create package room association
   */
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
};

export default bookingService;
