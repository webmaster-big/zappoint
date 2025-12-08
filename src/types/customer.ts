// Customer-related type definitions

// User types
export interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  totalBookings: number;
  totalSpent: number;
  lastVisit: string;
  createdAt: string;
  status: 'active' | 'inactive';
}

export interface CustomerUser {
  id: string;
  name: string;
  email: string;
  phone?: string;
  dateOfBirth?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface CustomerDemographic {
  ageGroup: string;
  count: number;
  percentage: number;
}

// Attraction types
export interface AttractionPurchaseLink {
  location: string;
  url: string;
  attraction_id: number;
  location_id: number;
}

export interface Attraction {
  id: number;
  name: string;
  description: string;
  price: number;
  minAge: number;
  capacity: number;
  rating: number;
  image: string;
  category: 'adventure' | 'technology' | 'sports' | 'games' | string;
  availableLocations: string[];
  duration?: string;
  pricingType?: string;
  purchaseLinks?: AttractionPurchaseLink[];
}

// Package types
export interface PackageBookingLink {
  location: string;
  url: string;
  package_id: number;
  location_id: number;
}

export interface Package {
  id: number;
  name: string;
  description: string;
  price: number;
  duration: string;
  participants: string;
  includes: string[];
  rating: number;
  image: string;
  category: 'celebration' | 'corporate' | 'family' | 'adventure' | 'romance' | 'premium' | string;
  availableLocations: string[];
  bookingLinks?: PackageBookingLink[];
}

// Reservation types
export type ReservationStatus = 'confirmed' | 'pending' | 'cancelled' | 'refunded';

export interface ReservationPackage {
  id: string;
  name: string;
  price: number;
  duration: string;
  participants: string;
  includes: string[];
}

export interface Reservation {
  id: string;
  referenceNumber: string;
  package: ReservationPackage;
  location: string;
  bookingDate: string;
  bookingTime: string;
  status: ReservationStatus;
  paymentId: string;
  totalAmount: number;
  participantsCount: number;
  specialRequests?: string;
  createdAt: string;
}

// Gift Card types
export type GiftCardType = 'fixed' | 'percentage';
export type GiftCardStatus = 'active' | 'inactive' | 'expired' | 'redeemed' | 'cancelled' | 'deleted';

export interface GiftCard {
  code: string;
  type: GiftCardType;
  initial_value: number;
  balance: number;
  max_usage: number;
  description: string;
  status: GiftCardStatus;
  expiry_date?: string;
}

export interface OwnedGiftCard extends GiftCard {
  redeemed: boolean;
}

// Notification types
export type NotificationType = 'booking' | 'payment' | 'promotion' | 'gift_card' | 'reminder';
export type NotificationStatus = 'unread' | 'read' | 'archived';

export interface NotificationMetadata {
  bookingId?: string;
  amount?: number;
  expiryDate?: string;
  location?: string;
}

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  status: NotificationStatus;
  createdAt: string;
  actionUrl?: string;
  actionText?: string;
  metadata?: NotificationMetadata;
}

// Booking types
export type BookingType = 'attraction' | 'package';

export interface BookingData {
  type: BookingType;
  item: Attraction | Package;
  location: string;
  timestamp: string;
}

// Location types
export type Location = string;

// Filter and sorting types
export type SortBy = 'date' | 'status' | 'amount';
export type SortOrder = 'asc' | 'desc';
export type FilterStatus = 'all' | 'unread' | 'read';

// Form types
export interface LoginFormData {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface RegisterFormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
  // Billing Information
  address: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  agreeToTerms: boolean;
}

// Legacy form data for backward compatibility
export type CustomerRegistrationForm = RegisterFormData;
export type CustomerLoginForm = LoginFormData;

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface PaginationMeta {
  currentPage: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  meta: PaginationMeta;
}