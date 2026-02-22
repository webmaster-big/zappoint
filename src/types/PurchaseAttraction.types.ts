// Types for: src/pages/admin/attractions/PurchaseAttraction.tsx

export interface PurchaseAttractionAddOn {
  id: number;
  name: string;
  price: number;
  description?: string;
  image?: string;
  is_active?: boolean;
  min_quantity?: number;
  max_quantity?: number;
}

export interface PurchaseAttractionAttraction {
  id: string;
  name: string;
  description: string;
  category: string;
  location: string;
  locationId?: number; // Location ID from the API
  duration: string;
  durationUnit: string;
  maxCapacity: number;
  price: number;
  pricingType: 'per_person' | 'fixed' | 'per_group' | 'per_hour' | 'per_game';
  images: string[];
  status: 'active' | 'inactive';
  createdAt: string;
  availability: Record<string, boolean> | Array<{ days: string[]; start_time: string; end_time: string }>;
  addOns?: PurchaseAttractionAddOn[];
  addOnsOrder?: string[];
}

export interface PurchaseAttractionCustomerInfo {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  // Billing Information
  address?: string;
  address2?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
}
