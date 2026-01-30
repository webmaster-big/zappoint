// Types for: src/pages/admin/Attendants/AttendantActivityLogs.tsx

// Import shared types from LocationActivityLogs
import type { 
  UserReference, 
  LoginLogoutInfo,
  BookingCreatedMetadata,
  BookingEditedMetadata,
  BookingStatusChangedMetadata,
  PaymentRecordedMetadata,
  PaymentStatusChangedMetadata,
  PaymentRefundedMetadata,
  AttractionPurchaseCreatedMetadata,
  GiftCardRedeemedMetadata,
  GenericDeletedMetadata,
  BulkDeleteMetadata 
} from './LocationActivityLogs.types';

// Re-export for convenience
export type { 
  UserReference, 
  LoginLogoutInfo,
  BookingCreatedMetadata,
  BookingEditedMetadata,
  BookingStatusChangedMetadata,
  PaymentRecordedMetadata,
  PaymentStatusChangedMetadata,
  PaymentRefundedMetadata,
  AttractionPurchaseCreatedMetadata,
  GiftCardRedeemedMetadata,
  GenericDeletedMetadata,
  BulkDeleteMetadata 
};

// Union type for all metadata variants
export type ActivityLogMetadata =
  | BookingCreatedMetadata
  | BookingEditedMetadata
  | BookingStatusChangedMetadata
  | PaymentRecordedMetadata
  | PaymentStatusChangedMetadata
  | PaymentRefundedMetadata
  | AttractionPurchaseCreatedMetadata
  | GiftCardRedeemedMetadata
  | GenericDeletedMetadata
  | BulkDeleteMetadata
  | Record<string, unknown>;

export interface AttendantActivityLogsLog {
  id: string;
  attendantId: string;
  attendantName: string;
  userId?: string;
  userType?: string;
  action: string;
  resourceType: 'package' | 'customer' | 'purchase' | 'attraction' | 'booking' | 'attendant' | 'addon' | 'attraction_purchase' | 'gift_card' | 'payment' | 'room' | 'user' | 'general';
  resourceId?: string;
  resourceName?: string;
  details: string;
  metadata?: ActivityLogMetadata;
  timestamp: string;
  severity: 'info' | 'success' | 'warning' | 'error';
}

export interface AttendantActivityLogsFilterOptions {
  action: string;
  resourceType: string;
  attendant: string;
  dateRange: string;
  search: string;
}
