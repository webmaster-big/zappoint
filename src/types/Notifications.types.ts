// Types for: src/pages/admin/Notifications.tsx

export interface NotificationsNotification {
  id: string;
  type: 'booking' | 'purchase' | 'system' | 'attendant' | 'customer' | 'payment' | 'promotion' | 'gift_card' | 'reminder' | 'staff';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  priority: 'low' | 'medium' | 'high';
  action_url?: string;
  action_text?: string;
  metadata?: {
    bookingId?: string;
    purchaseId?: string;
    paymentId?: string;
    customerName?: string;
    amount?: number;
    packageName?: string;
    attractionName?: string;
  };
}
