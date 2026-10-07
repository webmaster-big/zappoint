import axios from 'axios';
import { API_BASE_URL, getStoredUser } from '../utils/storage';
import { isTerminalLocked } from '../utils/terminalLock';

export interface StreamNotificationData {
  id: number;
  type: string;
  priority: string;
  title: string;
  message: string;
  user_id: number | null;
  location_id: number | null;
  created_at: string;
}

export interface NotificationObject {
  id: string;
  type: string;
  title: string;
  message: string;
  data: StreamNotificationData;
  read: boolean;
  timestamp: string;
  created_at: string;
  user_id?: number | null;
  location_id?: number | null;
}

type NotificationsCallback = (notifications: NotificationObject[]) => void;
type UnreadCallback = (count: number, polledAt: number) => void;
type ErrorCallback = (error: unknown) => void;
type UnauthorizedCallback = () => void;

interface LiveFeed {
  cursor?: string;
  unread?: number;
  items?: StreamNotificationData[];
}

const LIVE_FEED_POLL_MS = 20000;
const LIVE_FEED_TIMEOUT_MS = 15000;
const LIVE_FEED_RESUME_WITHIN_MS = 60000;
const UNREAD_COUNT_EVERY_POLLS = 3;

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
  private pollCount = 0;
  private onNotificationsCallback: NotificationsCallback | null = null;
  private onUnreadCallback: UnreadCallback | null = null;
  private onErrorCallback: ErrorCallback | null = null;
  private onUnauthorizedCallback: UnauthorizedCallback | null = null;

  connect(
    locationId: number | null,
    onNotifications: NotificationsCallback,
    onUnread: UnreadCallback,
    onError?: ErrorCallback,
    onUnauthorized?: UnauthorizedCallback
  ): void {
    this.disconnect();

    const resume = this.locationId === locationId && Date.now() - this.disconnectedAt < LIVE_FEED_RESUME_WITHIN_MS;

    this.onNotificationsCallback = onNotifications;
    this.onUnreadCallback = onUnread;
    this.onErrorCallback = onError || null;
    this.onUnauthorizedCallback = onUnauthorized || null;
    this.locationId = locationId;
    this.cursor = resume ? this.cursor : null;
    this.pollCount = 0;

    void this.poll(this.generation);
  }

  private async poll(generation: number): Promise<void> {
    if (generation !== this.generation) {
      return;
    }

    if (!isTerminalLocked() && getStoredUser()?.token) {
      const polledAt = Date.now();
      const wantsCount = this.pollCount > 0 && this.pollCount % UNREAD_COUNT_EVERY_POLLS === 0;
      this.pollCount += 1;

      try {
        const params: Record<string, string | number> = {};
        if (this.locationId !== null) {
          params.location_id = this.locationId;
        }
        if (this.cursor) {
          params.after = this.cursor;
        }
        if (wantsCount) {
          params.count = 1;
        }

        const response = await api.get('/notifications/feed', { params, timeout: LIVE_FEED_TIMEOUT_MS });

        if (generation !== this.generation) {
          return;
        }

        if (!isTerminalLocked()) {
          const feed = response.data?.data as LiveFeed | undefined;
          if (feed?.cursor) {
            this.cursor = feed.cursor;
          }
          if (typeof feed?.unread === 'number') {
            this.onUnreadCallback?.(feed.unread, polledAt);
          }

          const items = (feed?.items ?? []).map((item) => this.transformToNotification(item));
          if (items.length > 0) {
            this.onNotificationsCallback?.(items);
          }
        }
      } catch (error) {
        if (generation !== this.generation) {
          return;
        }

        const status = axios.isAxiosError(error) ? error.response?.status : undefined;
        if (status === 401) {
          if (!isTerminalLocked()) {
            this.onUnauthorizedCallback?.();
          }
        } else if (status !== 403) {
          this.onErrorCallback?.(error);
        }
      }
    }

    if (generation === this.generation) {
      this.timer = setTimeout(() => void this.poll(generation), LIVE_FEED_POLL_MS);
    }
  }

  private transformToNotification(data: StreamNotificationData): NotificationObject {
    return {
      id: `notification_${data.id}`,
      type: data.type,
      title: data.title,
      message: data.message,
      data,
      read: false,
      timestamp: data.created_at,
      created_at: data.created_at,
      user_id: data.user_id,
      location_id: data.location_id,
    };
  }

  disconnect(): void {
    this.generation += 1;

    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    if (this.onNotificationsCallback) {
      this.disconnectedAt = Date.now();
    }

    this.onNotificationsCallback = null;
    this.onUnreadCallback = null;
    this.onErrorCallback = null;
    this.onUnauthorizedCallback = null;
  }

  getConnectionState(): number | null {
    return this.onNotificationsCallback ? 1 : null;
  }

  isConnected(): boolean {
    return this.onNotificationsCallback !== null;
  }
}

export const notificationStreamService = new NotificationStreamService();
