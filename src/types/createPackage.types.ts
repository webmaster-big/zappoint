// Types for: src/pages/admin/packages/CreatePackage.tsx

export type CreatePackageDurationUnit = "hours" | "minutes" | "hours and minutes";
export type CreatePackageAvailabilityType = "daily" | "weekly" | "monthly";

export interface CreatePackageAttraction {
  id: number;
  name: string;
  price: number;
  unit?: string;
}

export interface CreatePackageAddOn {
  id: number;
  name: string;
  price: number;
}

export interface CreatePackageRoom {
  id: number;
  name: string;
  area_group?: string;
}

export interface CreatePackagePromo {
  id: number;
  name: string;
  code: string;
  description: string;
}

export interface CreatePackageGiftCard {
  id: number;
  name: string;
  code: string;
  description: string;
}

export interface CreatePackageForm {
  name: string;
  description: string;
  category: string;
  features: string;
  attractions: string[];
  rooms: string[];
  price: string;
  maxParticipants: string;
  pricePerAdditional: string;
  duration: string;
  durationUnit: CreatePackageDurationUnit;
  promos: string[];
  giftCards: string[];
  addOns: string[];
  availabilityType: CreatePackageAvailabilityType;
  availableDays: string[];
  availableWeekDays: string[];
  availableMonthDays: string[];
  image: string;
}
