// Types for: src/pages/admin/bookings/BookPackage.tsx

export interface BookPackageAttraction { 
  name: string; 
  price: number; 
  unit?: string; 
}

export interface BookPackageRoom { 
  name: string; 
  capacity: number; 
  price: number; 
}

export interface BookPackagePromoOrGiftCard { 
  name: string; 
  code: string; 
  description?: string; 
}

export interface BookPackagePackage {
  id: string;
  name: string;
  description: string;
  category: string;
  features: string;
  attractions: (string | { name: string; price: number; unit?: string })[];
  rooms: (string | BookPackageRoom)[];
  price: string;
  maxParticipants: string;
  pricePerAdditional: string;
  duration: string;
  durationUnit: "hours" | "minutes";
  pricePerAdditional30min: string;
  pricePerAdditional1hr: string;
  promos: BookPackagePromoOrGiftCard[];
  giftCards: BookPackagePromoOrGiftCard[];
  addOns: { name: string; price: number; unit?: string; image?: string }[];
  availabilityType: "daily" | "weekly" | "monthly";
  availableDays: string[];
  availableWeekDays: string[];
  availableMonthDays: string[];
  image?: string;
}

export interface BookPackageBooking {
  packageId: string;
  date: string;
  time: string;
  duration: string;
  room: string;
  status?: string;
}
