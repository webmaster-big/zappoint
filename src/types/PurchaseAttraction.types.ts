// Types for: src/pages/admin/attractions/PurchaseAttraction.tsx

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
  availability: Record<string, boolean>;
}

export interface PurchaseAttractionCustomerInfo {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}
