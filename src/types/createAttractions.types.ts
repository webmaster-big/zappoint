// Types for: src/pages/admin/attractions/CreateAttractions.tsx

export interface AttractionAvailabilitySchedule {
  days: string[];
  start_time: string;
  end_time: string;
}

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
  availability_schedules: AttractionAvailabilitySchedule[];
  // Legacy availability structure (for backward compatibility)
  availability?: {
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
