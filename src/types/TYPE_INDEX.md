# Type Definition Index

This document maps all type files to their corresponding TSX components.

## Admin Analytics ✅
- **CompanyAnalytics.types.ts** → `src/pages/admin/analytics/CompanyAnalytics.tsx`
- **LocationManagerAnalytics.types.ts** → `src/pages/admin/analytics/LocationManagerAnalytics.tsx`

## Admin Bookings ✅
- **CalendarView.types.ts** → `src/pages/admin/bookings/CalendarView.tsx`
- **Bookings.types.ts** → `src/pages/admin/bookings/Bookings.tsx`
- **CheckIn.types.ts** → `src/pages/admin/bookings/CheckIn.tsx`
- **OnsiteBooking.types.ts** → `src/pages/admin/bookings/OnsiteBooking.tsx`
- **BookPackage.types.ts** → `src/pages/admin/bookings/BookPackage.tsx`

## Admin Attractions ✅
- **ManageAttractions.types.ts** → `src/pages/admin/attractions/ManageAttractions.tsx`
- **CreateAttractions.types.ts** → `src/pages/admin/attractions/CreateAttractions.tsx`
- **AttractionPurchases.types.ts** → `src/pages/admin/attractions/AttractionPurchases.tsx`
- **PurchaseAttraction.types.ts** → `src/pages/admin/attractions/PurchaseAttraction.tsx`
- **CreatePurchase.types.ts** → `src/pages/admin/attractions/CreatePurchase.tsx`

## Admin Packages & Add-ons ✅
- **AddOns.types.ts** → `src/pages/admin/packages/AddOns.tsx`
- **CreatePackage.types.ts** → `src/pages/admin/packages/CreatePackage.tsx`
- **GiftCard.types.ts** → `src/pages/admin/packages/GiftCard.tsx`
- **Promo.types.ts** → `src/pages/admin/packages/Promo.tsx`
- Packages.tsx has no custom types (uses inline any[])

## Admin Users & Accounts ✅
- **ManageAccounts.types.ts** → `src/pages/admin/users/ManageAccounts.tsx`
- **CreateAccounts.types.ts** → `src/pages/admin/users/CreateAccounts.tsx`

## Admin Attendants ✅
- **ManageAttendants.types.ts** → `src/pages/admin/attendants/ManageAttendants.tsx`
- **AttendantsPerformance.types.ts** → `src/pages/admin/attendants/AttendantsPerformance.tsx`
- **AttendantActivityLogs.types.ts** → `src/pages/admin/attendants/AttendantActivityLogs.tsx`

## Admin Activity & Notifications ✅
- **Notifications.types.ts** → `src/pages/admin/activity/Notifications.tsx`
- **LocationActivityLogs.types.ts** → `src/pages/admin/activity/LocationActivityLogs.tsx`

## Admin Customer Management ✅
- **CustomerAnalytics.types.ts** → `src/pages/admin/customer/CustomerAnalytics.tsx`
- **Customers.types.ts** → `src/pages/admin/customer/Customers.tsx`

## Customer Portal ✅
- **CustomerReservation.types.ts** → `src/pages/customer/CustomerReservation.tsx`
- **CustomerGiftCards.types.ts** → `src/pages/customer/CustomerGiftCards.tsx`
- **CustomerNotifications.types.ts** → `src/pages/customer/CustomerNotifications.tsx`
- **CustomerHome.types.ts** → `src/pages/customer/CustomerHome.tsx`
- CustomerLogin.tsx and CustomerRegister.tsx have no custom types

## Dashboards ✅
- AttendantDashboard.tsx has no custom types (uses inline any[])
- ManagerDashboard.tsx has no custom types (uses inline any[])
- CompanyDashboard.tsx has no custom types (uses inline any[])

## Auth ✅
- Login.tsx has no custom types

## Profiles ✅
- AttendantProfile.tsx has no custom types
- CompanyAdminProfile.tsx has no custom types
- LocationManagerProfile.tsx has no custom types

---

## Naming Convention

All interfaces are prefixed with their component name to avoid conflicts:
- `CompanyAnalyticsBooking` instead of just `Booking`
- `CalendarViewBooking` instead of just `Booking`
- `CustomerReservationReservation` instead of just `Reservation`

This ensures no naming collisions even when multiple components use similar concepts.

---

## Summary

**Total Type Files Created:** 26
- Analytics: 2 files
- Bookings: 5 files
- Attractions: 5 files
- Packages: 4 files
- Users: 2 files
- Attendants: 3 files
- Activity: 2 files
- Customer Management: 2 files
- Customer Portal: 4 files

**Components Without Custom Types:** 10
- Dashboards (3): AttendantDashboard, ManagerDashboard, CompanyDashboard
- Auth (1): Login
- Profiles (3): AttendantProfile, CompanyAdminProfile, LocationManagerProfile
- Customer (2): CustomerLogin, CustomerRegister
- Packages (1): Packages
