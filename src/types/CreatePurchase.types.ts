// Types for: src/pages/admin/attractions/CreatePurchase.tsx

export interface CreatePurchaseAddOn {
  id: number;
  name: string;
  price: number;
  description?: string;
  image?: string;
  is_active?: boolean;
  min_quantity?: number;
  max_quantity?: number;
}

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
  availability?: Record<string, boolean> | Array<{ days: string[]; start_time: string; end_time: string }>;
  addOns?: CreatePurchaseAddOn[];
  addOnsOrder?: string[];
}

export interface CreatePurchaseCustomerInfo {
  name: string;
  email: string;
  phone: string;
}
