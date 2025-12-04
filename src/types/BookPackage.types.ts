// Types for: src/pages/admin/bookings/BookPackage.tsx

export interface BookPackageAttraction { 
  id: number;
  location_id: number;
  name: string; 
  price: string; 
  description?: string;
  image?: string;
  is_active: boolean;
  pivot?: {
    package_id: number;
    attraction_id: number;
  };
}

export interface BookPackageAddOn {
  id: number;
  location_id: number;
  name: string;
  price: string;
  description?: string;
  image?: string;
  is_active: boolean;
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

export interface BookPackagePackage {
  id: number;
  location_id: number;
  name: string;
  description: string;
  category: string;
  features: string;
  price: string;
  price_per_additional: string;
  max_participants: number;
  duration: number;
  duration_unit: "hours" | "minutes";
  price_per_additional_30min?: string | null;
  price_per_additional_1hr?: string | null;
  availability_type: "daily" | "weekly" | "monthly";
  available_days: string[];
  available_week_days: string[];
  available_month_days: string[];
  time_slot_start: string;
  time_slot_end: string;
  time_slot_interval: number;
  image?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
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
