// Types for: src/pages/admin/attractions/CreatePurchase.tsx

export interface CreatePurchaseAttraction {
  id: string;
  name: string;
  description: string;
  category: string;
  price: number;
  pricingType: string;
  maxCapacity: number;
  duration: string;
  durationUnit: string;
  location: string;
  locationId?: number; // Location ID from the API
  images: string[];
  status: string;
  createdAt?: string;
  availability?: Record<string, boolean>;
}

export interface CreatePurchaseCustomerInfo {
  name: string;
  email: string;
  phone: string;
}
