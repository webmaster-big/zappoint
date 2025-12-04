// Types for: src/pages/admin/attractions/ManageAttractions.tsx

export interface ManageAttractionsAttraction {
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
  locationId?: number;
  locationName?: string;
  images: string[];
  status: 'active' | 'inactive' | 'maintenance';
  createdAt: string;
  availability: Record<string, boolean>;
}

export interface ManageAttractionsFilterOptions {
  status: string;
  category: string;
  search: string;
}
