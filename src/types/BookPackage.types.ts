// Types for: src/pages/admin/bookings/BookPackage.tsx

export interface BookPackageAttraction { 
  id: number;
  location_id: number;
  name: string; 
  price: string; 
  description?: string;
  image?: string;
  is_active: boolean;
  min_quantity?: number;
  max_quantity?: number;
  pivot?: {
    package_id: number;
    attraction_id: number;
  };
}

export interface PackageSpecificPrice {
  package_id: number;
  price: number;
  minimum_quantity: number;
}

export interface BookPackageAddOn {
  id: number;
  location_id: number;
  name: string;
  price: string | null;
  description?: string;
  image?: string;
  is_active: boolean;
  min_quantity?: number;
  max_quantity?: number;
  is_force_add_on?: boolean;
  price_each_packages?: PackageSpecificPrice[] | null;
  pivot?: {
    package_id: number;
    add_on_id: number;
  };
}

export interface BookPackageRoom { 
  id: number;
  location_id: number;
  name: string; 
  capacity: number | null; 
  is_available: boolean;
  pivot?: {
    package_id: number;
    room_id: number;
  };
}

export interface BookPackagePromoOrGiftCard { 
  id: number;
  name: string; 
  code: string; 
  description?: string;
  discount_type?: string;
  discount_value?: string;
}

export interface BookPackageAvailabilitySchedule {
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

export interface BookPackagePackage {
  id: number;
  location_id: number;
  name: string;
  description: string;
  category: string;
  features: string;
  price: string;
  price_per_additional: string;
  min_participants?: number;
  max_participants: number;
  duration: number;
  duration_unit: "hours" | "minutes" | "hours and minutes";
  price_per_additional_30min?: string | null;
  price_per_additional_1hr?: string | null;
  availability_type?: "daily" | "weekly" | "monthly";
  available_days?: string[];
  available_week_days?: string[];
  available_month_days?: string[];
  time_slot_start?: string;
  time_slot_end?: string;
  time_slot_interval?: number;
  availability_schedules?: BookPackageAvailabilitySchedule[];
  image?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  partial_payment_percentage?: number | null;
  partial_payment_fixed?: number | null;
  has_guest_of_honor?: boolean;
  location?: {
    id: number;
    company_id: number;
    name: string;
    address: string;
    city: string;
    state: string;
    zip_code: string;
    phone: string;
    email: string;
  };
  attractions: BookPackageAttraction[];
  add_ons: BookPackageAddOn[];
  rooms: BookPackageRoom[];
  promos: BookPackagePromoOrGiftCard[];
  gift_cards: BookPackagePromoOrGiftCard[];
}

export interface BookPackageBooking {
  packageId: string;
  date: string;
  time: string;
  duration: string;
  room: string;
  status?: string;
}
