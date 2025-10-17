// Types for: src/pages/customer/CustomerNotifications.tsx

export type CustomerNotificationsType = 'booking' | 'promotion' | 'system' | 'reminder';

export interface CustomerNotificationsItem {
  id: string;
  type: CustomerNotificationsType;
  title: string;
  message: string;
  timestamp: string;
  isRead: boolean;
  actionUrl?: string;
}
