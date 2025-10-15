export interface Attraction {
  id: string;
  name: string;
  description: string;
  price: number;
  pricingType: 'per_person' | 'per_unit' | 'fixed' | 'per_lane';
  maxCapacity: number;
  category: string;
  unit?: string;
  image?: string;
}

export interface Purchase {
  id: string;
  attractionId: string;
  attractionName: string;
  customerName: string;
  email: string;
  phone: string;
  quantity: number;
  totalAmount: number;
  paymentMethod: string;
  status: 'pending' | 'completed' | 'cancelled';
  purchaseDate: string;
  notes?: string;
}