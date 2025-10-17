# Type System Mapping and Organization

## Overview
This document provides a comprehensive mapping of all TypeScript interfaces and types used throughout the application, with clear naming conventions to indicate their purpose and location.

---

## Naming Convention
- **Admin[Entity]** - Types used in admin/manager/attendant pages
- **Customer[Entity]** - Types used in customer-facing pages
- **[Entity]Form** - Form data types
- **[Entity]Response** - API response types
- **[Entity]Filter** - Filter/search types
- **[Entity]Meta** - Metadata types

---

## 1. AUTH TYPES (`/types/auth.ts`)

### Used By: Login, Register (Admin & Customer)

```typescript
// Admin Authentication
export interface AdminUser {
  id: string;
  username: string;
  email: string;
  role: 'company_admin' | 'location_manager' | 'attendant';
  firstName?: string;
  lastName?: string;
  companyId?: string;
  locationId?: string;
}

export interface AdminLoginForm {
  email: string;
  password: string;
}

export interface AdminRegisterForm {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
  phone?: string;
  companyName: string;
}

// Customer Authentication
export interface CustomerAuthUser {
  id: string;
  name: string;
  email: string;
  phone?: string;
  dateOfBirth?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface CustomerLoginForm {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface CustomerRegisterForm {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
  agreeToTerms: boolean;
}
```

**Pages Using These:**
- `/pages/auth/Login.tsx` → AdminLoginForm, AdminUser
- `/pages/auth/Register.tsx` → AdminRegisterForm, AdminUser
- `/pages/customer/CustomerLogin.tsx` → CustomerLoginForm, CustomerAuthUser
- `/pages/customer/CustomerRegister.tsx` → CustomerRegisterForm, CustomerAuthUser

---

## 2. CUSTOMER TYPES (`/types/customer.ts`)

### 2.1 Customer Profile & Management

```typescript
// For Admin Customer Management Pages
export interface AdminCustomerRecord {
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

export interface AdminCustomerDemographic {
  ageGroup: string;
  count: number;
  percentage: number;
}

export interface AdminCustomerFilter {
  search: string;
  status: 'all' | 'active' | 'inactive';
  sortBy: 'name' | 'email' | 'totalBookings' | 'totalSpent' | 'lastVisit';
  sortOrder: 'asc' | 'desc';
}
```

**Pages Using These:**
- `/pages/admin/customer/Customers.tsx` → AdminCustomerRecord, AdminCustomerFilter
- `/pages/admin/customer/CustomerAnalytics.tsx` → AdminCustomerDemographic

---

### 2.2 Customer-Facing Entertainment

```typescript
// Attractions
export interface CustomerAttraction {
  id: number;
  name: string;
  description: string;
  price: number;
  minAge: number;
  capacity: number;
  rating: number;
  image: string;
  category: 'adventure' | 'technology' | 'sports' | 'games';
  availableLocations: string[];
  duration?: string;
}

// Packages
export interface CustomerPackage {
  id: number;
  name: string;
  description: string;
  price: number;
  duration: string;
  participants: string;
  includes: string[];
  rating: number;
  image: string;
  category: 'celebration' | 'corporate' | 'family' | 'adventure' | 'romance' | 'premium';
  availableLocations: string[];
}

// Booking Flow
export type CustomerBookingType = 'attraction' | 'package';

export interface CustomerBookingData {
  type: CustomerBookingType;
  item: CustomerAttraction | CustomerPackage;
  location: string;
  timestamp: string;
}
```

**Pages Using These:**
- `/pages/customer/Home.tsx` → CustomerAttraction, CustomerPackage, CustomerBookingType, CustomerBookingData

---

### 2.3 Customer Reservations

```typescript
export type CustomerReservationStatus = 'confirmed' | 'pending' | 'cancelled' | 'refunded';

export interface CustomerReservationPackage {
  id: string;
  name: string;
  price: number;
  duration: string;
  participants: string;
  includes: string[];
}

export interface CustomerReservation {
  id: string;
  referenceNumber: string;
  package: CustomerReservationPackage;
  location: string;
  bookingDate: string;
  bookingTime: string;
  status: CustomerReservationStatus;
  paymentId: string;
  totalAmount: number;
  participantsCount: number;
  specialRequests?: string;
  createdAt: string;
}

export interface CustomerReservationFilter {
  search: string;
  sortBy: 'date' | 'status' | 'amount';
  sortOrder: 'asc' | 'desc';
  currentPage: number;
  pageSize: number;
}
```

**Pages Using These:**
- `/pages/customer/CustomerReservation.tsx` → CustomerReservation, CustomerReservationStatus, CustomerReservationFilter

---

### 2.4 Customer Gift Cards

```typescript
export type CustomerGiftCardType = 'fixed' | 'percentage';
export type CustomerGiftCardStatus = 'active' | 'inactive' | 'expired' | 'redeemed' | 'cancelled' | 'deleted';

export interface CustomerGiftCard {
  code: string;
  type: CustomerGiftCardType;
  initial_value: number;
  balance: number;
  max_usage: number;
  description: string;
  status: CustomerGiftCardStatus;
  expiry_date?: string;
}

export interface CustomerOwnedGiftCard extends CustomerGiftCard {
  redeemed: boolean;
}

export interface CustomerGiftCardFilter {
  search: string;
  tab: 'available' | 'owned';
}
```

**Pages Using These:**
- `/pages/customer/CustomerGiftCards.tsx` → CustomerGiftCard, CustomerOwnedGiftCard, CustomerGiftCardFilter

---

### 2.5 Customer Notifications

```typescript
export type CustomerNotificationType = 'booking' | 'payment' | 'promotion' | 'gift_card' | 'reminder';
export type CustomerNotificationStatus = 'unread' | 'read' | 'archived';

export interface CustomerNotificationMeta {
  bookingId?: string;
  amount?: number;
  expiryDate?: string;
  location?: string;
}

export interface CustomerNotification {
  id: string;
  type: CustomerNotificationType;
  title: string;
  message: string;
  status: CustomerNotificationStatus;
  createdAt: string;
  actionUrl?: string;
  actionText?: string;
  metadata?: CustomerNotificationMeta;
}

export interface CustomerNotificationFilter {
  filter: 'all' | 'unread' | 'read';
  typeFilter: CustomerNotificationType | 'all';
  selectedIds: string[];
  currentPage: number;
  pageSize: number;
}
```

**Pages Using These:**
- `/pages/customer/CustomerNotifications.tsx` → CustomerNotification, CustomerNotificationFilter

---

## 3. ADMIN BOOKING TYPES (`/types/booking.ts`)

### Used By: Admin Booking Management Pages

```typescript
export interface AdminRoom {
  name: string;
  capacity?: number;
  price?: number;
}

export interface AdminAddOn {
  name: string;
  price: number;
  image?: string;
}

export interface AdminGiftCard {
  code: string;
  name: string;
  type: 'fixed' | 'percentage';
  value: number;
  initial_value: number;
  remaining_usage: number;
  max_usage: number;
  status: string;
  expiry_date: string;
  description: string;
}

export interface AdminPromo {
  code: string;
  name: string;
  type: 'fixed' | 'percentage';
  value: number;
  status: string;
  start_date: string;
  end_date: string;
  usage_limit_per_user: number;
  usage_limit_total: number;
  description: string;
}

export interface AdminPackage {
  id: string;
  name: string;
  description: string;
  price: number;
  pricePerAdditional?: number;
  maxParticipants: number;
  category: string;
  features: string;
  availabilityType: string;
  availableDays: string[];
  availableWeekDays: string[];
  availableMonthDays: string[];
  attractions: string[];
  addOns: AdminAddOn[];
  giftCards: AdminGiftCard[];
  promos: AdminPromo[];
  duration: string;
  durationUnit: "hours" | "minutes";
  pricePerAdditional30min?: string;
  pricePerAdditional1hr?: string;
  rooms?: (string | AdminRoom)[];
  image?: string;
}

export interface AdminBookingForm {
  packageId: string | null;
  selectedAttractions: { id: string; quantity: number }[];
  selectedAddOns: { name: string; quantity: number }[];
  date: string;
  time: string;
  participants: number;
  customer: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
  };
  paymentMethod: 'credit' | 'debit' | 'cash' | 'e-wallet';
  giftCardCode: string;
  promoCode: string;
  notes: string;
}

export interface AdminBooking {
  id: string;
  type: 'package' | 'attraction';
  packageName: string;
  customerName: string;
  email: string;
  phone: string;
  date: string;
  time: string;
  participants: number;
  status: 'confirmed' | 'checked-in' | 'completed' | 'cancelled';
  totalAmount: number;
  amountPaid: number;
  createdAt: string;
  paymentMethod: string;
  attractions?: { name: string; quantity: number }[];
  addOns?: { name: string; quantity: number }[];
  duration: string;
  location?: string;
  referenceNumber?: string;
}

export interface AdminBookingFilter {
  search: string;
  status: 'all' | 'confirmed' | 'checked-in' | 'completed' | 'cancelled';
  dateFrom: string;
  dateTo: string;
  sortBy: 'date' | 'customer' | 'amount';
  sortOrder: 'asc' | 'desc';
}
```

**Pages Using These:**
- `/pages/admin/bookings/Bookings.tsx` → AdminBooking, AdminBookingFilter
- `/pages/admin/bookings/BookPackage.tsx` → AdminPackage, AdminBookingForm
- `/pages/admin/bookings/OnsiteBooking.tsx` → AdminBookingForm, AdminPackage
- `/pages/admin/bookings/CheckIn.tsx` → AdminBooking
- `/pages/admin/bookings/CalendarView.tsx` → AdminBooking
- `/pages/admin/packages/Packages.tsx` → AdminPackage
- `/pages/admin/packages/CreatePackage.tsx` → AdminPackage, AdminAddOn
- `/pages/admin/packages/AddOns.tsx` → AdminAddOn
- `/pages/admin/packages/GiftCard.tsx` → AdminGiftCard
- `/pages/admin/packages/Promo.tsx` → AdminPromo

---

## 4. ADMIN ATTRACTION TYPES (`/types/attraction.ts`)

### Used By: Admin Attraction Management Pages

```typescript
export interface AdminAttraction {
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

export interface AdminAttractionPurchase {
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

export interface AdminAttractionFilter {
  search: string;
  category: string;
  pricingType: string;
  sortBy: 'name' | 'price' | 'capacity';
  sortOrder: 'asc' | 'desc';
}
```

**Pages Using These:**
- `/pages/admin/attractions/ManageAttractions.tsx` → AdminAttraction, AdminAttractionFilter
- `/pages/admin/attractions/CreateAttractions.tsx` → AdminAttraction
- `/pages/admin/attractions/PurchaseAttraction.tsx` → AdminAttraction
- `/pages/admin/attractions/AttractionPurchases.tsx` → AdminAttractionPurchase
- `/pages/admin/attractions/CreatePurchase.tsx` → AdminAttractionPurchase

---

## 5. ADMIN DASHBOARD TYPES (`/types/dashboard.ts`)

### Used By: Dashboard and Analytics Pages

```typescript
export interface AdminDashboardStats {
  totalRevenue: number;
  totalBookings: number;
  totalCustomers: number;
  averageBookingValue: number;
  revenueGrowth: number;
  bookingsGrowth: number;
  customersGrowth: number;
}

export interface AdminRevenueData {
  month: string;
  revenue: number;
  bookings: number;
}

export interface AdminPopularPackage {
  name: string;
  bookings: number;
  revenue: number;
}

export interface AdminPopularAttraction {
  name: string;
  purchases: number;
  revenue: number;
}

export interface AdminLocationPerformance {
  location: string;
  revenue: number;
  bookings: number;
  customers: number;
}

export interface AdminAttendantPerformance {
  id: string;
  name: string;
  location: string;
  totalBookings: number;
  totalRevenue: number;
  customerRating: number;
  efficiency: number;
}

export interface AdminActivityLog {
  id: string;
  timestamp: string;
  user: string;
  role: string;
  action: string;
  details: string;
  location?: string;
}
```

**Pages Using These:**
- `/pages/admin/CompanyDashboard.tsx` → AdminDashboardStats, AdminRevenueData, AdminLocationPerformance
- `/pages/admin/ManagerDashboard.tsx` → AdminDashboardStats, AdminRevenueData
- `/pages/admin/AttendantDashboard.tsx` → AdminDashboardStats
- `/pages/admin/Analytics/CompanyAnalytics.tsx` → All dashboard types
- `/pages/admin/Analytics/LocationManagerAnalytics.tsx` → Location-specific types
- `/pages/admin/Attendants/AttendantsPerformance.tsx` → AdminAttendantPerformance
- `/pages/admin/LocationActivityLogs.tsx` → AdminActivityLog
- `/pages/admin/Attendants/AttendantActivityLogs.tsx` → AdminActivityLog

---

## 6. ADMIN ACCOUNT TYPES (`/types/account.ts`)

### Used By: User Management Pages

```typescript
export interface AdminAccount {
  id: string;
  name: string;
  email: string;
  role: 'company_admin' | 'location_manager' | 'attendant';
  location?: string;
  status: 'active' | 'inactive';
  createdAt: string;
  lastLogin?: string;
}

export interface AdminAttendant {
  id: string;
  name: string;
  email: string;
  phone: string;
  location: string;
  hireDate: string;
  status: 'active' | 'inactive';
  totalBookings: number;
  performanceScore: number;
}

export interface AdminAccountForm {
  name: string;
  email: string;
  password: string;
  role: 'location_manager' | 'attendant';
  location?: string;
  phone?: string;
}

export interface AdminAttendantForm {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
  location: string;
  hireDate: string;
}
```

**Pages Using These:**
- `/pages/admin/users/ManageAccounts.tsx` → AdminAccount
- `/pages/admin/users/CreateAccounts.tsx` → AdminAccountForm
- `/pages/admin/users/CreateAttendant.tsx` → AdminAttendantForm
- `/pages/admin/Attendants/ManageAttendants.tsx` → AdminAttendant

---

## 7. ADMIN PROFILE TYPES (`/types/profile.ts`)

### Used By: Profile Pages

```typescript
export interface AdminCompanyProfile {
  id: string;
  companyName: string;
  email: string;
  phone: string;
  address: string;
  totalLocations: number;
  totalEmployees: number;
  subscriptionPlan: string;
  subscriptionStatus: 'active' | 'inactive' | 'trial';
  createdAt: string;
}

export interface AdminLocationManagerProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  location: string;
  role: 'location_manager';
  hireDate: string;
  totalBookingsManaged: number;
  totalRevenue: number;
}

export interface AdminAttendantProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  location: string;
  role: 'attendant';
  hireDate: string;
  totalBookingsProcessed: number;
  performanceScore: number;
  customerRating: number;
}
```

**Pages Using These:**
- `/pages/admin/profile/CompanyAdminProfile.tsx` → AdminCompanyProfile
- `/pages/admin/profile/LocationManagerProfile.tsx` → AdminLocationManagerProfile
- `/pages/admin/profile/AttendantProfile.tsx` → AdminAttendantProfile

---

## 8. ADMIN NOTIFICATION TYPES (`/types/notification.ts`)

### Used By: Admin Notification Pages

```typescript
export type AdminNotificationType = 'system' | 'booking' | 'payment' | 'staff' | 'customer';
export type AdminNotificationPriority = 'low' | 'medium' | 'high' | 'urgent';
export type AdminNotificationStatus = 'unread' | 'read' | 'archived';

export interface AdminNotification {
  id: string;
  type: AdminNotificationType;
  priority: AdminNotificationPriority;
  title: string;
  message: string;
  status: AdminNotificationStatus;
  createdAt: string;
  actionUrl?: string;
  actionText?: string;
  relatedUser?: string;
  relatedLocation?: string;
}

export interface AdminNotificationFilter {
  status: 'all' | 'unread' | 'read';
  type: AdminNotificationType | 'all';
  priority: AdminNotificationPriority | 'all';
  selectedIds: string[];
}
```

**Pages Using These:**
- `/pages/admin/Notifications.tsx` → AdminNotification, AdminNotificationFilter

---

## 9. COMMON TYPES (`/types/common.ts`)

### Used By: Multiple Pages Across Admin and Customer

```typescript
// Pagination
export interface PaginationMeta {
  currentPage: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

// API Responses
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  meta: PaginationMeta;
}

// Locations
export type LocationName = string;

// Date/Time
export interface TimeSlot {
  time: string;
  available: boolean;
}

export interface DateAvailability {
  date: string;
  slots: TimeSlot[];
}

// Payment
export type PaymentMethod = 'credit' | 'debit' | 'cash' | 'e-wallet' | 'bank_transfer';

export interface PaymentInfo {
  method: PaymentMethod;
  amount: number;
  currency: string;
  transactionId?: string;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
}

// Sort and Filter
export type SortOrder = 'asc' | 'desc';
```

**Pages Using These:**
- All pages that implement pagination
- All pages that make API calls
- All pages with payment functionality
- All pages with sorting/filtering

---

## Summary Statistics

- **Total Type Files**: 10
- **Total Interfaces**: 60+
- **Admin Pages**: 30+
- **Customer Pages**: 6
- **Shared Types**: 15+

## Migration Plan

1. **Phase 1**: Update all type files with new naming conventions
2. **Phase 2**: Update admin pages to use new type names
3. **Phase 3**: Update customer pages to use new type names
4. **Phase 4**: Remove duplicate/conflicting types
5. **Phase 5**: Validate all imports and type usage
