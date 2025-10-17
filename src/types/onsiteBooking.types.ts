// Types for: src/pages/admin/bookings/OnsiteBooking.tsx

export interface OnsiteBookingRoom { 
  name: string; 
  capacity?: number; 
  price?: number; 
}

export interface OnsiteBookingAddOn {
  name: string;
  price: number;
  image?: string;
}

export interface OnsiteBookingPackage {
  id: string;
  name: string;
  description: string;
  price: number;
  pricePerAdditional?: number;
  maxParticipants: number;
  category: string;
  features: string;
  availabilityType: string;
  availableDays: string[];
  availableWeekDays: string[];
  availableMonthDays: string[];
  attractions: string[];
  addOns: OnsiteBookingAddOn[];
  giftCards: OnsiteBookingGiftCard[];
  promos: OnsiteBookingPromo[];
  duration: string;
  durationUnit: "hours" | "minutes";
  pricePerAdditional30min: string;
  pricePerAdditional1hr: string;
  rooms?: (string | OnsiteBookingRoom)[];
  image?: string;
}

export interface OnsiteBookingGiftCard {
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

export interface OnsiteBookingAttraction {
  id: string;
  name: string;
  description: string;
  price: number;
  pricingType: 'per_person' | 'per_unit' | 'fixed' | 'per_lane';
  maxCapacity: number;
  category: string;
}

export interface OnsiteBookingData {
  packageId: string | null;
  selectedAttractions: { id: string; quantity: number }[];
  selectedAddOns: { name: string; quantity: number }[];
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
