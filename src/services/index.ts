// Import all services
import { packageService } from './PackageService';
import { addOnService } from './AddOnService';
import { attractionService } from './AttractionService';
import { roomService } from './RoomService';
import { giftCardService } from './GiftCardService';
import { promoService } from './PromoService';
import { notificationStreamService } from './NotificationStreamService';
import { metricsService } from './MetricsService';
import { userService } from './UserService';
import { locationService } from './LocationService';
import { dayOffService } from './DayOffService';

// Cache service exports
export { bookingCacheService } from './BookingCacheService';
export { roomCacheService } from './RoomCacheService';
export { packageCacheService } from './PackageCacheService';
export { addOnCacheService } from './AddOnCacheService';
export { attractionCacheService } from './AttractionCacheService';
export { customerCacheService } from './CustomerCacheService';

// Service exports for easy importing
export { packageService } from './PackageService';
export type { Package, PackageFilters, CreatePackageData, UpdatePackageData } from './PackageService';

export { addOnService } from './AddOnService';
export type { AddOn, AddOnFilters, CreateAddOnData, UpdateAddOnData } from './AddOnService';

export { attractionService } from './AttractionService';
export type { Attraction, AttractionFilters, CreateAttractionData, UpdateAttractionData } from './AttractionService';

export { roomService } from './RoomService';
export type { Room, RoomFilters, CreateRoomData, UpdateRoomData } from './RoomService';

export { dayOffService } from './DayOffService';
export type { DayOff, DayOffFilters, CreateDayOffData, UpdateDayOffData, CheckDateData } from './DayOffService';

export { giftCardService } from './GiftCardService';
export type { GiftCard, GiftCardFilters, CreateGiftCardData, UpdateGiftCardData } from './GiftCardService';

export { promoService } from './PromoService';
export type { Promo, PromoFilters, CreatePromoData, UpdatePromoData } from './PromoService';

export { notificationStreamService } from './NotificationStreamService';
export type { StreamNotificationData, NotificationObject } from './NotificationStreamService';

export { metricsService } from './MetricsService';
export type { 
  DashboardMetrics, 
  RecentPurchase, 
  LocationStats, 
  LocationDetails, 
  DashboardResponse,
  RecentBooking,
  AttendantResponse 
} from './MetricsService';

export { userService } from './UserService';
export type { User, UserFilters } from './UserService';

// Settings service exports
export * from './SettingsService';

// Payment service exports
export * from './PaymentService';

// Location service exports
export { locationService } from './LocationService';
export { categoryService } from './CategoryService';
export type { Category, CreateCategoryData, UpdateCategoryData } from './CategoryService';
export type { Location, LocationFilters, CreateLocationData, UpdateLocationData } from './LocationService';

// Analytics service exports
export { default as analyticsService } from './AnalyticsService';
export type { 
  LocationAnalyticsParams, 
  CompanyAnalyticsParams,
  ExportAnalyticsParams, 
  ExportCompanyAnalyticsParams,
  LocationAnalyticsResponse,
  CompanyAnalyticsResponse
} from './AnalyticsService';

// Common API response types
export type { ApiResponse, PaginatedResponse } from './PackageService';

// Services object for convenient access
export const services = {
  packages: packageService,
  addOns: addOnService,
  attractions: attractionService,
  rooms: roomService,
  giftCards: giftCardService,
  promos: promoService,
  notificationStream: notificationStreamService,
  metrics: metricsService,
  users: userService,
  locations: locationService,
  dayOffs: dayOffService,
};