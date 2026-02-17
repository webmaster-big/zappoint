/**
 * Special Pricing Types
 * 
 * Defines types for the automatic discount system that supports
 * weekly, monthly, and one-time discounts for packages and attractions.
 */

export type DiscountType = 'fixed' | 'percentage';
export type RecurrenceType = 'one_time' | 'weekly' | 'monthly';
export type EntityType = 'package' | 'attraction' | 'all';

export interface SpecialPricing {
  id: number;
  company_id: number;
  location_id: number | null;
  name: string;
  description: string | null;
  discount_amount: string; // decimal as string from API
  discount_type: DiscountType;
  recurrence_type: RecurrenceType;
  recurrence_value: number | null; // 0-6 for weekly (day of week), 1-31 for monthly
  specific_date: string | null; // YYYY-MM-DD for one_time
  start_date: string | null;
  end_date: string | null;
  time_start: string | null; // HH:mm:ss
  time_end: string | null;
  entity_type: EntityType;
  entity_ids: number[] | null;
  priority: number;
  is_stackable: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  company?: { id: number; name: string };
  location?: { id: number; name: string } | null;
  recurrence_display?: string;
  upcoming_dates?: string[];
}

export interface DiscountApplied {
  special_pricing_id: number;
  name: string;
  description: string | null;
  discount_label: string; // e.g., "10%" or "$15.00"
  discount_type: DiscountType;
  discount_amount: number;
  is_stackable: boolean;
  recurrence_display: string;
}

export interface SpecialPricingBreakdown {
  original_price: number;
  discounted_price: number;
  total_discount: number;
  discounts_applied: DiscountApplied[];
  has_special_pricing: boolean;
}

export interface CreateSpecialPricingData {
  company_id: number;
  location_id?: number | null;
  name: string;
  description?: string | null;
  discount_amount: number;
  discount_type: DiscountType;
  recurrence_type: RecurrenceType;
  recurrence_value?: number | null; // Required for weekly/monthly
  specific_date?: string | null; // Required for one_time
  start_date?: string | null;
  end_date?: string | null;
  time_start?: string | null;
  time_end?: string | null;
  entity_type: EntityType;
  entity_ids?: number[] | null;
  priority?: number;
  is_stackable?: boolean;
  is_active?: boolean;
}

export interface SpecialPricingFormData {
  company_id: number;
  location_id: number | null;
  name: string;
  description: string;
  discount_amount: number;
  discount_type: DiscountType;
  recurrence_type: RecurrenceType;
  recurrence_value: number | null;
  specific_date: string | null;
  start_date: string | null;
  end_date: string | null;
  time_start: string | null;
  time_end: string | null;
  entity_type: EntityType;
  entity_ids: number[];
  priority: number;
  is_stackable: boolean;
  is_active: boolean;
}

export interface SpecialPricingListFilters {
  entity_type: 'all' | 'package' | 'attraction';
  recurrence_type: 'all' | 'one_time' | 'weekly' | 'monthly';
  discount_type: 'all' | 'fixed' | 'percentage';
  status: 'all' | 'active' | 'inactive';
  search: string;
}

export interface SpecialPricingListParams {
  per_page?: number;
  company_id?: number;
  location_id?: number;
  entity_type?: EntityType;
  recurrence_type?: RecurrenceType;
  discount_type?: DiscountType;
  is_active?: boolean;
  upcoming_only?: boolean;
  search?: string;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
  user_id?: number;
}

export interface SpecialPricingApiResponse {
  success: boolean;
  data: {
    special_pricings: SpecialPricing[];
    pagination?: {
      current_page: number;
      last_page: number;
      per_page: number;
      total: number;
      from: number;
      to: number;
    };
  };
  message?: string;
}

export const DAY_OF_WEEK_OPTIONS = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

export const RECURRENCE_TYPE_OPTIONS = [
  { value: 'one_time', label: 'One-Time', description: 'Specific date only' },
  { value: 'weekly', label: 'Weekly', description: 'Every week on selected day' },
  { value: 'monthly', label: 'Monthly', description: 'Every month on selected day' },
];

export const DISCOUNT_TYPE_OPTIONS = [
  { value: 'fixed', label: 'Fixed Amount', icon: '$' },
  { value: 'percentage', label: 'Percentage', icon: '%' },
];

export const ENTITY_TYPE_OPTIONS = [
  { value: 'all', label: 'All (Packages & Attractions)' },
  { value: 'package', label: 'Packages Only' },
  { value: 'attraction', label: 'Attractions Only' },
];

/**
 * Helper function to get ordinal suffix for day of month
 */
export function getOrdinalSuffix(n: number): string {
  if ([11, 12, 13].includes(n % 100)) return 'th';
  switch (n % 10) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    default: return 'th';
  }
}

/**
 * Generate day of month options (1-31)
 */
export const DAY_OF_MONTH_OPTIONS = Array.from({ length: 31 }, (_, i) => ({
  value: i + 1,
  label: `${i + 1}${getOrdinalSuffix(i + 1)}`,
}));
