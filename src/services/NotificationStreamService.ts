import { API_BASE_URL } from '../utils/storage';

export interface StreamNotificationData {
  id: number;
  type: 'booking' | 'attraction_purchase' | 'event_purchase';
  reference_number?: string;
  customer_name: string;
  package_name?: string;
  location_name?: string;
  booking_date?: string;
  booking_time?: string;
  attraction_name?: string;
  event_name?: string;
  quantity?: number;
  total_amount: number;
  status: string;
  payment_method?: string;
  purchase_date?: string;
  purchase_time?: string;
  created_at: string;
  timestamp: string;
  user_id?: number;
  location_id?: number;
}

export interface NotificationObject {
  id: string;
  type: 'booking' | 'attraction_purchase' | 'event_purchase';
  title: string;
  message: string;
  data: StreamNotificationData;
  read: boolean;
  timestamp: string;
  created_at: string;
  user_id?: number;
  location_id?: number;
}

type NotificationCallback = (notification: NotificationObject) => void;
type ErrorCallback = (error: Event) => void;

class NotificationStreamService {
  private eventSource: EventSource | null = null;
  private onNotificationCallback: NotificationCallback | null = null;
  private onErrorCallback: ErrorCallback | null = null;

  connect(
    locationId: number,
    onNotification: NotificationCallback,
    onError?: ErrorCallback
  ): void {
    if (this.eventSource) {
      this.disconnect();
    }

    this.onNotificationCallback = onNotification;
    this.onErrorCallback = onError || null;

    const url = `${API_BASE_URL}/stream/notifications?location_id=${locationId}`;

    this.eventSource = new EventSource(url);

    this.eventSource.addEventListener('notification', (event: MessageEvent) => {
      try {
        const data: StreamNotificationData = JSON.parse(event.data);
        const notification = this.transformToNotification(data);

        if (this.onNotificationCallback) {
          this.onNotificationCallback(notification);
        }
      } catch (error) {
        console.error('[NotificationStream] Error parsing notification:', error);
      }
    });

    this.eventSource.addEventListener('open', () => {
    });

    this.eventSource.addEventListener('error', (event: Event) => {
      console.error('[NotificationStream] Connection error:', event);
      
      if (this.eventSource?.readyState === EventSource.CLOSED) {
      } else if (this.eventSource?.readyState === EventSource.CONNECTING) {
      }

      if (this.onErrorCallback) {
        this.onErrorCallback(event);
      }
    });

    this.eventSource.addEventListener('message', (_event: MessageEvent) => {
    });
  }

  private formatBookingDate(dateString: string): string {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return dateString;
    }
  }

  private transformToNotification(data: StreamNotificationData): NotificationObject {
    const title = data.type === 'booking' 
      ? 'New Booking' 
      : data.type === 'event_purchase' 
        ? 'New Event Purchase' 
        : 'New Attraction Purchase';
    
    let message: string;
    if (data.type === 'booking') {
      message = `${data.customer_name} booked ${data.package_name || 'a package'} for ${this.formatBookingDate(data.booking_date || '')}`;
    } else if (data.type === 'event_purchase') {
      message = `${data.customer_name} purchased ${data.quantity}x ${data.event_name || 'event'}`;
    } else {
      message = `${data.customer_name} purchased ${data.quantity}x ${data.attraction_name}`;
    }

    return {
      id: `${data.type}_${data.id}_${Date.now()}`,
      type: data.type,
      title,
      message,
      data,
      read: false,
      timestamp: data.timestamp,
      created_at: data.created_at,
      user_id: data.user_id,
      location_id: data.location_id
    };
  }

  disconnect(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
      this.onNotificationCallback = null;
      this.onErrorCallback = null;
    }
  }

  getConnectionState(): number | null {
    return this.eventSource?.readyState ?? null;
  }

  isConnected(): boolean {
    return this.eventSource?.readyState === EventSource.OPEN;
  }
}

export const notificationStreamService = new NotificationStreamService();
