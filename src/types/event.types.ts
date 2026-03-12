// Types for Events & Event Purchases

export interface Event {
  id: number;
  location_id: number;
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
  add_ons_order: number[] | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  location?: { id: number; name: string };
  add_ons?: EventAddOn[];
  event_purchases?: EventPurchase[];
}

export interface EventAddOn {
  id: number;
  name: string;
  price: string;
  description?: string;
  image?: string;
  is_active?: boolean;
  min_quantity?: number;
  max_quantity?: number;
}

export interface EventPurchase {
  id: number;
  reference_number: string;
  event_id: number;
  customer_id: number | null;
  location_id: number;
  guest_name: string | null;
  guest_email: string | null;
  guest_phone: string | null;
  purchase_date: string;
  purchase_time: string;
  quantity: number;
  total_amount: string;
  amount_paid: string;
  discount_amount: string | null;
  payment_method: 'card' | 'in-store' | 'paylater' | 'authorize.net' | null;
  payment_status: 'paid' | 'partial' | 'pending';
  status: 'pending' | 'confirmed' | 'checked-in' | 'completed' | 'cancelled';
  transaction_id: string | null;
  notes: string | null;
  special_requests: string | null;
  applied_fees: Array<{ fee_name: string; fee_amount: number; fee_application_type: string }> | null;
  applied_discounts: Array<{ discount_name: string; discount_amount: number; discount_type: string; original_price: number; special_pricing_id: number | null }> | null;
  checked_in_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  event?: Event;
  customer?: {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
    phone?: string;
  };
  location?: { id: number; name: string };
  add_ons?: (EventAddOn & { pivot: EventPurchaseAddOnPivot })[];
}

export interface EventPurchaseAddOnPivot {
  event_purchase_id: number;
  add_on_id: number;
  quantity: number;
  price_at_purchase: string;
}

export interface CreateEventData {
  location_id: number;
  name: string;
  description?: string;
  image?: string;
  date_type: 'one_time' | 'date_range';
  start_date: string;
  end_date?: string;
  time_start: string;
  time_end: string;
  interval_minutes: number;
  max_bookings_per_slot?: number | null;
  price?: number;
  features?: string[];
  add_on_ids?: number[];
  add_ons_order?: number[];
  is_active?: boolean;
}

export type UpdateEventData = Partial<CreateEventData>;

export interface CreateEventPurchaseData {
  event_id: number;
  customer_id?: number | null;
  location_id: number;
  guest_name?: string;
  guest_email?: string;
  guest_phone?: string;
  sms_consent?: boolean;
  purchase_date: string;
  purchase_time: string;
  quantity: number;
  total_amount?: number;
  amount_paid?: number;
  discount_amount?: number;
  payment_method?: string;
  payment_status?: string;
  transaction_id?: string;
  notes?: string;
  special_requests?: string;
  send_email?: boolean;
  applied_fees?: Array<{
    fee_name: string;
    fee_amount: number;
    fee_application_type: string;
  }> | null;
  applied_discounts?: Array<{
    discount_name: string;
    discount_amount: number;
    discount_type: 'fixed' | 'percentage';
    original_price: number;
    special_pricing_id: number | null;
  }> | null;
  add_ons?: Array<{
    add_on_id: number;
    quantity: number;
    price_at_purchase: number;
  }>;
}

export type UpdateEventPurchaseData = Partial<CreateEventPurchaseData> & {
  status?: string;
};

export interface EventFilters {
  location_id?: number;
  is_active?: boolean;
  user_id?: number;
  per_page?: number;
  page?: number;
}

export interface EventPurchaseFilters {
  event_id?: number;
  location_id?: number;
  status?: string;
  customer_id?: number;
  purchase_date?: string;
  per_page?: number;
  page?: number;
}
