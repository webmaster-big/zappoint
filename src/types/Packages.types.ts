// Types for: src/pages/admin/packages/Packages.tsx

export interface PackagesPackage {
  id: string;
  name: string;
  description: string;
  category: string;
  features: string;
  attractions: string[];
  rooms: Array<{ name: string }>;
  price: string | number;
  maxParticipants: string | number;
  pricePerAdditional: string | number;
  duration: string;
  durationUnit: "hours" | "minutes" | "hours and minutes";
  promos: Array<{ name: string; code: string; description: string }>;
  giftCards: Array<{ name: string; code: string; description: string }>;
  addOns: Array<{ name: string; price: number }>;
  availabilityType: "daily" | "weekly" | "monthly";
  availableDays?: string[];
  availableWeekDays?: string[];
  availableMonthDays?: string[];
  image?: string;
}
