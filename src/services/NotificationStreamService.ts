import axios from 'axios';
import { API_BASE_URL, getStoredUser } from '../utils/storage';
import { isTerminalLocked } from '../utils/terminalLock';

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
type ErrorCallback = (error: unknown) => void;

interface LiveFeed {
  cursor?: string;
  items?: StreamNotificationData[];
}

const LIVE_FEED_POLL_MS = 20000;
const LIVE_FEED_TIMEOUT_MS = 15000;
const LIVE_FEED_RESUME_WITHIN_MS = 60000;

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = getStoredUser()?.token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

class NotificationStreamService {
  private generation = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private cursor: string | null = null;
  private locationId: number | null = null;
  private disconnectedAt = 0;
  private onNotificationCallback: NotificationCallback | null = null;
  private onErrorCallback: ErrorCallback | null = null;

  connect(
    locationId: number,
    onNotification: NotificationCallback,
    onError?: ErrorCallback
  ): void {
    this.disconnect();

    const resume = this.locationId === locationId && Date.now() - this.disconnectedAt < LIVE_FEED_RESUME_WITHIN_MS;

    this.onNotificationCallback = onNotification;
    this.onErrorCallback = onError || null;
    this.locationId = locationId;
    this.cursor = resume ? this.cursor : null;

    void this.poll(this.generation);
  }

  private async poll(generation: number): Promise<void> {
    if (generation !== this.generation) {
      return;
    }

    if (!isTerminalLocked()) {
      try {
        const response = await api.get('/notifications/live', {
          params: { location_id: this.locationId, ...(this.cursor ? { after: this.cursor } : {}) },
          timeout: LIVE_FEED_TIMEOUT_MS,
        });

        if (generation !== this.generation) {
          return;
        }

        if (!isTerminalLocked()) {
          const feed = response.data?.data as LiveFeed | undefined;
          if (feed?.cursor) {
            this.cursor = feed.cursor;
          }

          for (const item of feed?.items ?? []) {
            this.onNotificationCallback?.(this.transformToNotification(item));
          }
        }
      } catch (error) {
        if (generation !== this.generation) {
          return;
        }

        const status = axios.isAxiosError(error) ? error.response?.status : undefined;
        if (status !== 401 && status !== 403) {
          this.onErrorCallback?.(error);
        }
      }
    }

    if (generation === this.generation) {
      this.timer = setTimeout(() => void this.poll(generation), LIVE_FEED_POLL_MS);
    }
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
    this.generation += 1;

    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    if (this.onNotificationCallback) {
      this.disconnectedAt = Date.now();
    }

    this.onNotificationCallback = null;
    this.onErrorCallback = null;
  }

  getConnectionState(): number | null {
    return this.onNotificationCallback ? 1 : null;
  }

  isConnected(): boolean {
    return this.onNotificationCallback !== null;
  }
}

export const notificationStreamService = new NotificationStreamService();
