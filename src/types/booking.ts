export interface Room { 
  name: string; 
  capacity?: number; 
  price?: number; 
}

export interface AddOn {
  name: string;
  price: number;
  image?: string;
}

export interface GiftCard {
  code: string;
  name: string;
  type: 'fixed' | 'percentage';
  value: number;
  initial_value: number;
  remaining_usage: number;
  max_usage: number;
  status: string;
  expiry_date: string;
  description: string;
}

export interface Promo {
  code: string;
  name: string;
  type: 'fixed' | 'percentage';
  value: number;
  status: string;
  start_date: string;
  end_date: string;
  usage_limit_per_user: number;
  usage_limit_total: number;
  description: string;
}

export interface Package {
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
  addOns: AddOn[];
  giftCards: GiftCard[];
  promos: Promo[];
  duration: string;
  durationUnit: "hours" | "minutes";
  pricePerAdditional30min?: string;
  pricePerAdditional1hr?: string;
  rooms?: (string | Room)[];
  image?: string;
}

export interface BookingData {
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
  paymentMethod: 'credit' | 'debit' | 'cash' | 'e-wallet';
  giftCardCode: string;
  promoCode: string;
  notes: string;
}

export interface Booking {
  id: string;
  type: 'package' | 'attraction';
  packageName?: string;
  customerName: string;
  email: string;
  phone: string;
  date: string;
  time: string;
  participants: number;
  status: 'confirmed' | 'checked-in' | 'completed' | 'cancelled';
  totalAmount: number;
  amountPaid: number;
  createdAt: string;
  paymentMethod: string;
  attractions?: { name: string; quantity: number }[];
  addOns?: { name: string; quantity: number }[];
  duration: string;
  notes?: string;
  checkedInAt?: string;
  completedAt?: string;
}