// Types for: src/pages/customer/CustomerHome.tsx

export interface CustomerHomePackage {
  id: string;
  name: string;
  description: string;
  price: number;
  duration: string;
  participants: string;
  image: string;
  rating: number;
  reviewsCount: number;
  includes: string[];
}

export interface CustomerHomePromotion {
  id: string;
  title: string;
  description: string;
  discount: number;
  validUntil: string;
  image: string;
}
