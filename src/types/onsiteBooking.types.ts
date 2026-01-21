// Types for: src/pages/admin/bookings/OnsiteBooking.tsx

export interface OnsiteBookingRoom { 
  id?: number;
  name: string; 
  capacity?: number; 
  price?: number; 
}

export interface PackageSpecificPrice {
  package_id: number;
  price: number;
  minimum_quantity: number;
}

export interface OnsiteBookingAddOn {
  id?: number;
  name: string;
  price: number | null;
  image?: string;
  min_quantity?: number;
  max_quantity?: number;
  is_force_add_on?: boolean;
  price_each_packages?: PackageSpecificPrice[] | null;
}

export interface OnsiteBookingAttraction {
  id: number;
  name: string;
  price: number;
  description?: string;
  pricingType?: string;
  image?: string;
  min_quantity?: number;
  max_quantity?: number;
}

export interface OnsiteBookingAvailabilitySchedule {
  id: number;
  package_id: number;
  availability_type: "daily" | "weekly" | "monthly";
  day_configuration: string[] | null;
  time_slot_start: string;
  time_slot_end: string;
  time_slot_interval: number;
  priority: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface OnsiteBookingPackage {
  id: number;
  name: string;
  description: string;
  price: number;
  pricePerAdditional?: number;
  minParticipants?: number;
  maxParticipants: number;
  category: string;
  features: string;
  availabilityType?: string;
  availableDays?: string[];
  availableWeekDays?: string[];
  availableMonthDays?: string[];
  availability_schedules?: OnsiteBookingAvailabilitySchedule[];
  attractions: OnsiteBookingAttraction[];
  addOns: OnsiteBookingAddOn[];
  giftCards: OnsiteBookingGiftCard[];
  promos: OnsiteBookingPromo[];
  duration: string;
  durationUnit: "hours" | "minutes" | "hours and minutes";
  pricePerAdditional30min: string;
  pricePerAdditional1hr: string;
  partialPaymentPercentage?: number;
  partialPaymentFixed?: number;
  has_guest_of_honor?: boolean;
  rooms?: (string | OnsiteBookingRoom)[];
  image?: string;
}

export interface OnsiteBookingGiftCard {
  id?: number;
  code: string;
  type: 'fixed' | 'percentage';
  value: number;
  initial_value: number;
  remaining_usage: number;
  max_usage: number;
  status: string;
  expiry_date: string;
  description: string;
}

export interface OnsiteBookingPromo {
  id?: number;
  code: string;
  type: 'fixed' | 'percentage';
  value: number;
  status: string;
  start_date: string;
  end_date: string;
  usage_limit_per_user: number;
  usage_limit_total: number;
  description: string;
}

export interface OnsiteBookingData {
  packageId: number | null;
  selectedAttractions: { id: string; quantity: number }[];
  selectedAddOns: { id?: number; name: string; quantity: number; isForced?: boolean }[];
  date: string;
  time: string;
  participants: number;
  customer: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
  };
  room: string;
  promoCode: string;
  giftCardCode: string;
  paymentMethod: string;
  total: number;
}
