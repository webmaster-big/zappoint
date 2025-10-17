// Types for: src/pages/admin/attractions/AttractionPurchases.tsx

export interface AttractionPurchasesPurchase {
  id: string;
  type: string;
  attractionName: string;
  customerName: string;
  email: string;
  phone: string;
  quantity: number;
  status: 'confirmed' | 'pending' | 'cancelled' | 'refunded';
  totalAmount: number;
  createdAt: string;
  paymentMethod: string;
  duration: string;
  activity: string;
}

export interface AttractionPurchasesFilterOptions {
  status: string;
  paymentMethod: string;
  search: string;
  dateRange: string;
}
