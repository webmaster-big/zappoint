// Types for: src/pages/admin/packages/CreatePackage.tsx

export type CreatePackageDurationUnit = "hours" | "minutes";
export type CreatePackageAvailabilityType = "daily" | "weekly" | "monthly";

export interface CreatePackageAttraction {
  name: string;
  price: number;
  unit?: string;
}

export interface CreatePackageAddOn {
  name: string;
  price: number;
}

export interface CreatePackageRoom {
  name: string;
}

export interface CreatePackagePromo {
  name: string;
  code: string;
  description: string;
}

export interface CreatePackageGiftCard {
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
