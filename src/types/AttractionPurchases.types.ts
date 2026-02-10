// Types for: src/pages/admin/attractions/AttractionPurchases.tsx

export interface AttractionPurchasesPurchase {
  id: string;
  type: string;
  attractionName: string;
  customerName: string;
  email: string;
  phone: string;
  quantity: number;
  status: 'confirmed' | 'pending' | 'checked-in' | 'cancelled' | 'refunded';
  totalAmount: number;
  amountPaid: number;
  createdAt: string;
  paymentMethod: string;
  duration: string;
  activity: string;
  locationId?: number;
}

export interface AttractionPurchasesFilterOptions {
  status: string;
  paymentMethod: string;
  search: string;
  dateRange: string;
}
