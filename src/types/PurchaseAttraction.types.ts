// Types for: src/pages/admin/attractions/PurchaseAttraction.tsx

export interface PurchaseAttractionAttraction {
  id: string;
  name: string;
  description: string;
  location: string;
  duration: string;
  durationUnit: string;
  maxCapacity: number;
  price: number;
  pricingType: 'per_person' | 'fixed' | 'per_group' | 'per_hour' | 'per_game';
  images: string[];
  purchaseLink: string;
}

export interface PurchaseAttractionCustomerInfo {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}
