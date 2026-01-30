// Types for: src/pages/admin/LocationActivityLogs.tsx

// Base interfaces for common patterns
export interface UserReference {
  user_id: number;
  name: string | null;
  email: string | null;
}

export interface LoginLogoutInfo {
  ip_address: string;
  user_agent: string;
}

// Booking-related metadata
export interface BookingCreatedMetadata {
  reference_number: string;
  customer_name: string;
  customer_id: number | null;
  guest_email: string | null;
  created_by: string;
  created_at: string;
  booking_details: {
    booking_date: string;
    booking_time: string;
    duration: number;
    duration_unit: string;
    participants: number;
  };
  package: {
    id: number;
    name: string;
  };
  room: {
    id: number;
    name: string;
  };
  location: {
    id: number;
    name: string;
  };
  financial?: {
    total_amount: number;
    amount_paid: number;
    discount_amount: number;
  };
}

export interface BookingEditedMetadata {
  reference_number: string;
  customer_name: string;
  customer_id: number | null;
  updated_by: string;
  updated_at: string;
  changes: Record<string, { from: unknown; to: unknown }>;
  updated_fields: string[];
  booking_date: string;
  booking_time: string;
  total_amount: number;
  amount_paid: number;
  status: string;
  payment_status: string;
}

export interface BookingStatusChangedMetadata {
  reference_number: string;
  customer_name: string;
  customer_id: number | null;
  changed_by: string;
  changed_at: string;
  status_change: {
    from: string;
    to: string;
  };
  booking_date: string;
  booking_time: string;
  total_amount: number;
  amount_paid: number;
}

// Payment-related metadata
export interface PaymentRecordedMetadata {
  transaction_id: string;
  recorded_by: string;
  recorded_at: string;
  payment_details: {
    amount: number;
    currency: string;
    method: string;
    status: string;
  };
  customer: {
    id: number | null;
    name: string;
  };
  payable: {
    type: string;
    id: number;
  };
  location_id: number;
  notes: string | null;
}

export interface PaymentStatusChangedMetadata {
  transaction_id: string;
  changed_by: string;
  changed_at: string;
  status_change: {
    from: string;
    to: string;
  };
  payment_details: {
    amount: number;
    method: string;
  };
  customer: {
    id: number | null;
    name: string;
  };
  payable: {
    type: string;
    id: number;
  };
  notes: string | null;
}

export interface PaymentRefundedMetadata {
  transaction_id: string;
  refunded_by: string;
  refunded_at: string;
  payment_details: {
    amount: number;
    method: string;
    original_status: string;
    new_status: string;
  };
  customer: {
    id: number | null;
    name: string;
  };
  payable: {
    type: string;
    id: number;
  };
}

// User-related metadata
export interface UserLoginMetadata {
  login_at: string;
  user_details: {
    user_id: number;
    name: string;
    email: string;
    role: string;
    location_id: number | null;
    company_id: number | null;
  };
  login_info: LoginLogoutInfo;
}

export interface UserLogoutMetadata {
  logout_at: string;
  user_details: {
    id: number;
    name: string;
    email: string;
  };
  logout_info: LoginLogoutInfo;
}

export interface UserCreatedMetadata {
  created_by: UserReference;
  created_at: string;
  user_details: {
    user_id: number;
    name: string;
    email: string;
    role: string;
    location_id: number | null;
    company_id: number | null;
  };
}

export interface UserDeletedMetadata {
  deleted_by: UserReference;
  deleted_at: string;
  user_details: {
    user_id: number;
    name: string;
    location_id: number | null;
  };
}

// Attraction purchase metadata
export interface AttractionPurchaseCreatedMetadata {
  created_by: UserReference;
  created_at: string;
  purchase_details: {
    purchase_id: number;
    attraction_id: number;
    attraction_name: string;
    quantity: number;
    total_amount: number;
    amount_paid: number;
    payment_method: string;
    status: string;
  };
  customer_details: {
    customer_id: number;
    name: string;
    email: string;
    phone: string | null;
  };
}

// Gift card metadata
export interface GiftCardRedeemedMetadata {
  redeemed_by: UserReference;
  redeemed_at: string;
  gift_card_details: {
    gift_card_id: number;
    code: string;
  };
  redemption_details: {
    customer_id: number | null;
    amount_redeemed: number;
    previous_balance: number;
    remaining_balance: number;
  };
}

// Day off metadata
export interface DayOffCreatedMetadata {
  created_by: UserReference;
  created_at: string;
  day_off_details: {
    day_off_id: number;
    date: string;
    time_start: string | null;
    time_end: string | null;
    reason: string | null;
    is_recurring: boolean;
    location_id: number;
    scope: string;
  };
  affected_resources: {
    package_ids: number[] | null;
    room_ids: number[] | null;
  };
}

// Generic delete metadata
export interface GenericDeletedMetadata {
  deleted_by: UserReference;
  deleted_at: string;
  [key: string]: unknown;
}

// Bulk operations metadata
export interface BulkDeleteMetadata {
  deleted_by: UserReference;
  deleted_at: string;
  deleted_count: number;
  [key: string]: unknown;
}

// Union type for all metadata variants
export type ActivityLogMetadata =
  | UserLoginMetadata
  | UserLogoutMetadata
  | UserCreatedMetadata
  | UserDeletedMetadata
  | BookingCreatedMetadata
  | BookingEditedMetadata
  | BookingStatusChangedMetadata
  | PaymentRecordedMetadata
  | PaymentStatusChangedMetadata
  | PaymentRefundedMetadata
  | AttractionPurchaseCreatedMetadata
  | GiftCardRedeemedMetadata
  | DayOffCreatedMetadata
  | GenericDeletedMetadata
  | BulkDeleteMetadata
  | Record<string, unknown>;

export interface LocationActivityLogsActivityLog {
  id: string;
  userId: string;
  userName: string;
  userType: 'company_admin' | 'location_manager' | 'attendant' | 'system';
  userRole?: string;
  location: string;
  action: string;
  resourceType: 'package' | 'customer' | 'purchase' | 'attraction' | 'booking' | 'attendant' | 'manager' | 'inventory' | 'settings' | 'general' | 'addon' | 'attraction_purchase' | 'authorize_net_account' | 'company' | 'contact' | 'customer_notification' | 'day_off' | 'gift_card' | 'location' | 'notification' | 'package_time_slot' | 'payment' | 'promo' | 'room' | 'user';
  resourceId?: string;
  resourceName?: string;
  details: string;
  metadata?: ActivityLogMetadata;
  timestamp: string;
  severity: 'info' | 'success' | 'warning' | 'error';
}

export interface LocationActivityLogsFilterOptions {
  action: string;
  resourceType: string;
  user: string;
  userType: string;
  dateRange: string;
  search: string;
}

export interface LocationActivityLogsLocationData {
  name: string;
  id: number;
  managers: string[];
  attendants: string[];
  recentActivity: number;
}
