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

export interface Package {
  id: number;
  location_id: number;
  name: string;
  description: string;
  category: string;
  package_type: string; // 'regular', 'holiday', 'special', 'seasonal', etc.
  features?: string | string[]; // Support both string and array for backward compatibility
  price: number;
  price_per_additional?: number;
  max_participants: number;
  min_participants?: number;
  duration: number;
  duration_unit: 'hours' | 'minutes' | 'hours and minutes';
  price_per_additional_30min?: number;
  price_per_additional_1hr?: number;
  availability_type: 'daily' | 'weekly' | 'monthly';
  available_days?: string[] | number[];
  available_week_days?: string[] | number[];
  available_month_days?: string[] | number[];
  image?: string;
  is_active: boolean;
  partial_payment_percentage?: number;
  partial_payment_fixed?: number;
  has_guest_of_honor?: boolean;
  customer_notes?: string;
  invitation_download_link?: string;
  invitation_file?: string;
  booking_window_days?: number | null;
  min_booking_notice_hours?: number | null;
  availability_schedules?: AvailabilitySchedule[];
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  display_order?: number;
  location?: {
    id: number;
    name: string;
    address: string;
    city: string;
    state: string;
    booking_window_days?: number | null;
  };
  attractions?: Array<{
    id: number;
    name: string;
    price: number;
  }>;
  add_ons?: Array<{
    id: number;
    name: string;
    price: number;
  }>;
  rooms?: Array<{
    id: number;
    name: string;
    capacity?: number;
  }>;
  gift_cards?: Array<{
    id: number;
    code: string;
    value: number;
  }>;
  promos?: Array<{
    id: number;
    code: string;
    name: string;
  }>;
}

export interface PackageFilters {
  location_id?: number;
  category?: string;
  package_type?: string;
  is_active?: boolean;
  search?: string;
  sort_by?: 'id' | 'name' | 'price' | 'created_at' | 'category' | 'display_order';
  sort_order?: 'asc' | 'desc';
  per_page?: number;
  page?: number;
  user_id?: number;
  trashed?: 'only' | 'with'; // 'only' = show only soft-deleted, 'with' = include soft-deleted
}

export interface AvailabilitySchedule {
  availability_type: 'daily' | 'weekly' | 'monthly';
  day_configuration: string[] | null;
  time_slot_start: string;
  time_slot_end: string;
  time_slot_interval: number;
  priority?: number;
  is_active?: boolean;
}

export interface CreatePackageData {
  location_id: number;
  name: string;
  description: string;
  category: string;
  package_type?: string; // 'regular', 'holiday', 'special', 'seasonal', etc.
  features?: string | string[]; // Support both string and array for backward compatibility
  price: number;
  price_per_additional?: number;
  max_participants: number;
  min_participants?: number;
  duration: number;
  duration_unit: 'hours' | 'minutes' | 'hours and minutes';
  price_per_additional_30min?: number;
  price_per_additional_1hr?: number;
  availability_type?: 'daily' | 'weekly' | 'monthly';
  available_days?: string[] | number[];
  available_week_days?: string[] | number[];
  available_month_days?: string[] | number[];
  availability_schedules?: AvailabilitySchedule[];
  image?: string;
  status?: 'active' | 'inactive';
  is_active?: boolean;
  partial_payment_percentage?: number;
  partial_payment_fixed?: number;
  has_guest_of_honor?: boolean;
  customer_notes?: string;
  invitation_download_link?: string;
  invitation_file?: string;
  booking_window_days?: number | null;
  min_booking_notice_hours?: number | null;
  attraction_ids?: (number | undefined)[];
  room_ids?: (number | undefined)[];
  addon_ids?: (number | undefined)[];
  promo_ids?: (number | undefined)[];
  gift_card_ids?: (number | undefined)[];
  display_order?: number;
}

export type UpdatePackageData = Partial<CreatePackageData>;

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: {
    packages: T[];
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

class PackageService {
  async getPackages(filters?: PackageFilters): Promise<PaginatedResponse<Package>> {
    const response = await api.get('/packages', { params: filters });
    return response.data;
  }

  async getPackage(id: number): Promise<ApiResponse<Package>> {
    const response = await api.get(`/packages/${id}`);
    return response.data;
  }

  async createPackage(data: CreatePackageData): Promise<ApiResponse<Package>> {
    const response = await api.post('/packages', data);
    return response.data;
  }

  async updatePackage(id: number, data: UpdatePackageData): Promise<ApiResponse<Package>> {
    const response = await api.put(`/packages/${id}`, data);
    return response.data;
  }

  async deletePackage(id: number): Promise<ApiResponse<null>> {
    const response = await api.delete(`/packages/${id}`);
    return response.data;
  }

  async restorePackage(id: number): Promise<ApiResponse<Package>> {
    const response = await api.post(`/packages/${id}/restore`);
    return response.data;
  }

  async forceDeletePackage(id: number): Promise<ApiResponse<null>> {
    const response = await api.delete(`/packages/${id}/force`);
    return response.data;
  }

  async getPackagesByLocation(locationId: number): Promise<ApiResponse<Package[]>> {
    const response = await api.get(`/packages/location/${locationId}`);
    return response.data;
  }

  async getPackagesByCategory(category: string): Promise<ApiResponse<Package[]>> {
    const response = await api.get(`/packages/category/${category}`);
    return response.data;
  }

  async toggleStatus(id: number): Promise<ApiResponse<Package>> {
    const response = await api.patch(`/packages/${id}/toggle-status`);
    return response.data;
  }

  async attachAttractions(id: number, attractionIds: number[]): Promise<ApiResponse<null>> {
    const response = await api.post(`/packages/${id}/attractions/attach`, {
      attraction_ids: attractionIds,
    });
    return response.data;
  }

  async detachAttractions(id: number, attractionIds: number[]): Promise<ApiResponse<null>> {
    const response = await api.post(`/packages/${id}/attractions/detach`, {
      attraction_ids: attractionIds,
    });
    return response.data;
  }

  async attachAddOns(id: number, addonIds: number[]): Promise<ApiResponse<null>> {
    const response = await api.post(`/packages/${id}/addons/attach`, {
      addon_ids: addonIds,
    });
    return response.data;
  }

  async detachAddOns(id: number, addonIds: number[]): Promise<ApiResponse<null>> {
    const response = await api.post(`/packages/${id}/addons/detach`, {
      addon_ids: addonIds,
    });
    return response.data;
  }

  async bulkImport(packages: Array<CreatePackageData & {
    attraction_ids?: number[];
    addon_ids?: number[];
    room_ids?: number[];
    gift_card_ids?: number[];
    promo_ids?: number[];
  }>): Promise<{
    success: boolean;
    message: string;
    data: {
      imported: Package[];
      imported_count: number;
      failed_count: number;
    };
    errors?: Array<{
      index: number;
      name: string;
      error: string;
    }>;
  }> {
    const response = await api.post('/packages/bulk-import', { packages });
    return response.data;
  }

  async getAvailabilitySchedules(packageId: number): Promise<ApiResponse<AvailabilitySchedule[]>> {
    const response = await api.get(`/packages/${packageId}/availability-schedules`);
    return response.data;
  }

  async storeAvailabilitySchedule(packageId: number, schedule: AvailabilitySchedule): Promise<ApiResponse<AvailabilitySchedule>> {
    const response = await api.post(`/packages/${packageId}/availability-schedules`, schedule);
    return response.data;
  }

  async updateAvailabilitySchedules(
    packageId: number,
    data: { schedules: AvailabilitySchedule[] }
  ): Promise<ApiResponse<AvailabilitySchedule[]>> {
    const response = await api.put(`/packages/${packageId}/availability-schedules`, data);
    return response.data;
  }

  async deleteAvailabilitySchedule(packageId: number, scheduleId: number): Promise<ApiResponse<null>> {
    const response = await api.delete(`/packages/${packageId}/availability-schedules/${scheduleId}`);
    return response.data;
  }

  async bulkUpdateMinNotice(packageIds: number[], minBookingNoticeHours: number | null): Promise<ApiResponse<Package[]>> {
    const response = await api.patch('/packages/bulk-update-min-notice', {
      package_ids: packageIds,
      min_booking_notice_hours: minBookingNoticeHours,
    });
    return response.data;
  }

  async reorderPackages(items: { id: number; display_order: number }[]): Promise<ApiResponse<null>> {
    const response = await api.post('/packages/reorder', { items });
    return response.data;
  }
}

export const packageService = new PackageService();
export default packageService;
