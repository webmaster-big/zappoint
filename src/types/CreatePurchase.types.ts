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
  images: string[];
  status: string;
}

export interface CreatePurchaseCustomerInfo {
  name: string;
  email: string;
  phone: string;
}
