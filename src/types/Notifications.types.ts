// Types for: src/pages/admin/Notifications.tsx

export interface NotificationsNotification {
  id: string;
  type: 'booking' | 'purchase' | 'system' | 'attendant' | 'customer';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  priority: 'low' | 'medium' | 'high';
  metadata?: {
    bookingId?: string;
    purchaseId?: string;
    customerName?: string;
    amount?: number;
    packageName?: string;
    attractionName?: string;
  };
}
