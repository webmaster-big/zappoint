// Types for: src/pages/admin/attractions/CreateAttractions.tsx

export interface CreateAttractionsFormData {
  name: string;
  description: string;
  category: string;
  price: string;
  pricingType: string;
  maxCapacity: string;
  duration: string;
  durationUnit: string;
  images: string[];
  bookingLink: string;
  embedCode: string;
  availability: {
    monday: boolean;
    tuesday: boolean;
    wednesday: boolean;
    thursday: boolean;
    friday: boolean;
    saturday: boolean;
    sunday: boolean;
  };
  id?: string;
}
