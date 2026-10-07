import axios from 'axios';
import bookingService, { type Booking, type BookingFilters, type BookingSyncInfo, type PaginatedBookingResponse } from './bookingService';
import { metricsCacheService } from './MetricsCacheService';
import { getStoredUser } from '../utils/storage';

const CACHE_NAME = 'zapzone-bookings-cache-v2';
const BOOKINGS_CACHE_KEY = '/api/bookings/cached';
const CACHE_METADATA_KEY = '/api/bookings/metadata';
const BROADCAST_CHANNEL_NAME = 'zapzone-bookings-cache';
const WRITE_LOCK_NAME = 'zapzone-bookings-cache-write';
const FULL_SYNC_LOCK_NAME = 'zapzone-bookings-full-sync';

const SYNC_MIN_INTERVAL_MS = 15 * 1000;
const FULL_SYNC_MIN_GAP_MS = 60 * 1000;
const FULL_SYNC_MAX_AGE_MS = 30 * 60 * 1000;
const FULL_SYNC_MAX_AGE_JITTER_MS = 5 * 60 * 1000;
const FULL_SYNC_BACKOFF_MAX_MS = 30 * 60 * 1000;
const CHANGES_CURSOR_MAX_AGE_MS = 150 * 60 * 1000;
const MISMATCH_FULL_SYNC_MIN_GAP_MS = 10 * 60 * 1000;
const FULL_PAGE_SIZE = 100;
const FULL_MAX_PAGES = 5000;
const CHANGES_PAGE_SIZE = 500;
const CHANGES_MAX_PAGES = 20;
const OTHER_TAB_REFRESH_DELAY_MS = 300;
const SYNC_REQUEST_TIMEOUT_MS = 30 * 1000;
const NOTICE_RETRY_MIN_MS = 30 * 1000;
const NOTICE_RETRY_MAX_MS = 5 * 60 * 1000;

let warmupCompleted = false;

interface CacheMetadata {
  lastUpdated: number;
  locationId?: number;
  userId?: number;
  totalRecords: number;
  cursor?: string;
  scope?: string;
  fullSyncedAt?: number;
  fullSyncStartedAt?: number;
  fullSyncCompletedAt?: number;
  fullSyncFailedAt?: number;
  fullSyncFailures?: number;
  syncedAt?: number;
  syncStartedAt?: number;
  coveredNotificationId?: number;
}

interface CacheBroadcast {
  userId?: number;
  startedAt: number;
}

interface BookingsCacheEntry {
  bookings: Booking[];
  pagination?: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
  filters?: BookingFilters;
}

const newestFirst = (bookings: Booking[]): Booking[] =>
  bookings.sort((a, b) => String(b.booking_date || '').localeCompare(String(a.booking_date || '')) || b.id - a.id);

const updatedAtOf = (booking: Booking): number => Date.parse(String((booking as { updated_at?: string }).updated_at ?? ''));

const isNewerCopy = (current: Booking, incoming: Booking): boolean => {
  const mine = updatedAtOf(current);
  const theirs = updatedAtOf(incoming);
  return Number.isFinite(mine) && Number.isFinite(theirs) && mine > theirs;
};

const keepNewerCopies = (incoming: Booking[], cached: Booking[] | null): Booking[] => {
  if (!cached || cached.length === 0) return incoming;

  const current = new Map(cached.map((booking) => [booking.id, booking]));
  return incoming.map((booking) => {
    const mine = current.get(booking.id);
    return mine && isNewerCopy(mine, booking) ? mine : booking;
  });
};

const isUnprocessable = (error: unknown): boolean => axios.isAxiosError(error) && error.response?.status === 422;

class BookingCacheService {
  private static instance: BookingCacheService;
  private isSyncing: boolean = false;
  private syncPromise: Promise<Booking[]> | null = null;
  private syncScheduled: boolean = false;
  private lastSyncAttemptAt: number = 0;
  private lastFullSyncAt: number = 0;
  private lastFullSyncUserId: number | undefined;
  private catchUpTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingNotificationId: number = 0;
  private memoryCopy: Booking[] | null = null;
  private memoryOwnerId: number | undefined;
  private writeChain: Promise<unknown> = Promise.resolve();
  private channel: BroadcastChannel | null = null;
  private otherTabTimer: ReturnType<typeof setTimeout> | null = null;
  private otherTabStartedAt: number = 0;
  private noticeRetryTimer: ReturnType<typeof setTimeout> | null = null;
  private noticeRetryDelayMs: number = 0;
  private readonly fullSyncMaxAgeMs: number = FULL_SYNC_MAX_AGE_MS + Math.floor(Math.random() * FULL_SYNC_MAX_AGE_JITTER_MS);
  private readonly backoffJitter: number = 0.8 + Math.random() * 0.4;

  private constructor() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.channel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
        this.channel.onmessage = (event: MessageEvent<CacheBroadcast>) => {
          this.scheduleOtherTabRefresh(event.data);
        };
      } catch {
        this.channel = null;
      }
    }
  }

  static getInstance(): BookingCacheService {
    if (!BookingCacheService.instance) {
      BookingCacheService.instance = new BookingCacheService();
    }
    return BookingCacheService.instance;
  }

  private isCacheAvailable(): boolean {
    return 'caches' in window;
  }

  private async getCache(): Promise<Cache | null> {
    if (!this.isCacheAvailable()) {
      console.warn('[BookingCacheService] Cache Storage not available');
      return null;
    }
    return await caches.open(CACHE_NAME);
  }

  private currentUserId(): number | undefined {
    return getStoredUser()?.id ?? undefined;
  }

  private remember(bookings: Booking[]): void {
    this.memoryCopy = bookings;
    this.memoryOwnerId = this.currentUserId();
  }

  private memory(): Booking[] | null {
    return this.memoryOwnerId !== undefined && this.memoryOwnerId === this.currentUserId() ? this.memoryCopy : null;
  }

  private exclusive<T>(task: () => Promise<T>): Promise<T> {
    const run = (): Promise<T> => (typeof navigator !== 'undefined' && navigator.locks
      ? navigator.locks.request(WRITE_LOCK_NAME, task)
      : task());
    const result = this.writeChain.then(run, run);
    this.writeChain = result.catch(() => undefined);
    return result;
  }

  private withFullSyncLock<T>(task: () => Promise<T | null>): Promise<T | null> {
    if (typeof navigator === 'undefined' || !navigator.locks) {
      return task();
    }

    return navigator.locks.request(FULL_SYNC_LOCK_NAME, { ifAvailable: true }, (lock) => (lock ? task() : null));
  }

  private retryNotice(notificationId?: number): void {
    if (!notificationId || this.noticeRetryTimer) return;

    this.noticeRetryDelayMs = this.noticeRetryDelayMs
      ? Math.min(NOTICE_RETRY_MAX_MS, this.noticeRetryDelayMs * 2)
      : NOTICE_RETRY_MIN_MS;
    this.noticeRetryTimer = setTimeout(() => {
      this.noticeRetryTimer = null;
      this.syncNow(notificationId);
    }, this.noticeRetryDelayMs);
  }

  private backoffMs(failures: number): number {
    return Math.min(FULL_SYNC_BACKOFF_MAX_MS, FULL_SYNC_MIN_GAP_MS * 2 ** Math.min(failures, 10)) * this.backoffJitter;
  }

  private broadcast(startedAt: number): void {
    try {
      this.channel?.postMessage({ userId: this.currentUserId(), startedAt } as CacheBroadcast);
    } catch {
      return;
    }
  }

  private scheduleOtherTabRefresh(message: CacheBroadcast | undefined): void {
    if (!message || message.userId !== this.currentUserId()) return;

    this.otherTabStartedAt = Math.max(this.otherTabStartedAt, message.startedAt || 0);
    if (this.otherTabTimer) return;

    this.otherTabTimer = setTimeout(() => {
      this.otherTabTimer = null;
      const startedAt = this.otherTabStartedAt;
      this.otherTabStartedAt = 0;
      void this.refreshFromOtherTab(startedAt);
    }, OTHER_TAB_REFRESH_DELAY_MS);
  }

  private async refreshFromOtherTab(startedAt: number): Promise<void> {
    const bookings = await this.getCachedBookings();
    if (!bookings) return;

    this.remember(bookings);
    window.dispatchEvent(new CustomEvent('bookings-cache-updated', {
      detail: { bookings, source: 'api', startedAt }
    }));
  }

  async cacheBookings(bookings: Booking[], metadata?: Partial<CacheMetadata>): Promise<void> {
    this.remember(bookings);

    const cache = await this.getCache();
    if (!cache) return;

    try {
      const previous = await this.getCacheMetadata();
      const cacheEntry: BookingsCacheEntry = {
        bookings,
      };

      const response = new Response(JSON.stringify(cacheEntry), {
        headers: {
          'Content-Type': 'application/json',
          'X-Cache-Date': new Date().toISOString(),
        },
      });

      await cache.put(BOOKINGS_CACHE_KEY, response);

      const fullMetadata: CacheMetadata = {
        cursor: previous?.cursor,
        scope: previous?.scope,
        fullSyncedAt: previous?.fullSyncedAt,
        fullSyncStartedAt: previous?.fullSyncStartedAt,
        fullSyncCompletedAt: previous?.fullSyncCompletedAt,
        fullSyncFailedAt: previous?.fullSyncFailedAt,
        fullSyncFailures: previous?.fullSyncFailures,
        syncedAt: previous?.syncedAt,
        syncStartedAt: previous?.syncStartedAt,
        coveredNotificationId: previous?.coveredNotificationId,
        lastUpdated: Date.now(),
        totalRecords: bookings.length,
        ...metadata,
        userId: metadata?.userId ?? this.currentUserId(),
      };

      await this.putMetadata(cache, fullMetadata);

      console.log(`[BookingCacheService] Cached ${bookings.length} bookings`);
    } catch (error) {
      console.error('[BookingCacheService] Error caching bookings:', error);
    }
  }

  private async putMetadata(cache: Cache, metadata: CacheMetadata): Promise<void> {
    await cache.put(CACHE_METADATA_KEY, new Response(JSON.stringify(metadata), {
      headers: { 'Content-Type': 'application/json' },
    }));
  }

  private async patchMetadata(patch: Partial<CacheMetadata>): Promise<void> {
    const cache = await this.getCache();
    if (!cache) return;

    try {
      const current = await this.getCacheMetadata();
      if (!current) return;
      await this.putMetadata(cache, { ...current, ...patch });
    } catch (error) {
      console.error('[BookingCacheService] Error updating cache metadata:', error);
    }
  }

  async getCachedBookings(): Promise<Booking[] | null> {
    const cache = await this.getCache();
    if (!cache) return null;

    try {
      const response = await cache.match(BOOKINGS_CACHE_KEY);
      if (!response) return null;

      const data: BookingsCacheEntry = await response.json();
      console.log(`[BookingCacheService] Retrieved ${data.bookings.length} bookings from cache`);
      return data.bookings;
    } catch (error) {
      console.error('[BookingCacheService] Error reading cached bookings:', error);
      return null;
    }
  }

  async getCacheMetadata(): Promise<CacheMetadata | null> {
    const cache = await this.getCache();
    if (!cache) return null;

    try {
      const response = await cache.match(CACHE_METADATA_KEY);
      if (!response) return null;

      return await response.json();
    } catch (error) {
      console.error('[BookingCacheService] Error reading cache metadata:', error);
      return null;
    }
  }

  async isCacheStale(maxAgeMinutes: number = 5): Promise<boolean> {
    const metadata = await this.getCacheMetadata();
    if (!metadata) return true;

    const ageMs = Date.now() - metadata.lastUpdated;
    const maxAgeMs = maxAgeMinutes * 60 * 1000;

    return ageMs > maxAgeMs;
  }

  async fetchAndCacheBookings(
    filters?: BookingFilters,
    forceRefresh: boolean = false
  ): Promise<Booking[]> {
    if (this.isSyncing && this.syncPromise) {
      return this.syncPromise;
    }

    if (!forceRefresh) {
      const cachedBookings = await this.getCachedBookings();
      const isStale = await this.isCacheStale();

      if (cachedBookings && cachedBookings.length > 0) {
        if (isStale) {
          this.syncInBackground(filters);
        }
        return cachedBookings;
      }
    }

    return this.syncFromAPI(filters);
  }

  private async syncFromAPI(filters?: BookingFilters, notificationId?: number): Promise<Booking[]> {
    if (this.isSyncing && this.syncPromise) {
      return this.syncPromise;
    }

    this.isSyncing = true;
    this.lastSyncAttemptAt = Date.now();
    const startedAt = Date.now();

    this.syncPromise = (async () => {
      try {
        const metadata = await this.getCacheMetadata();
        const sameUser = !!metadata && metadata.userId === this.currentUserId();
        let bookings: Booking[] | null = null;
        let fullNeeded = true;

        if (
          sameUser &&
          metadata?.cursor &&
          metadata.scope &&
          metadata.fullSyncedAt &&
          Date.now() - (metadata.syncStartedAt ?? metadata.fullSyncedAt) < CHANGES_CURSOR_MAX_AGE_MS
        ) {
          const changes = await this.syncChanges(startedAt, metadata, true);
          bookings = changes?.bookings ?? null;
          fullNeeded = !changes || changes.wantsFull || Date.now() - metadata.fullSyncedAt > this.fullSyncMaxAgeMs;
        }

        if (fullNeeded) {
          bookings = (await this.syncEverything(startedAt, filters)) ?? bookings;
        }

        this.noticeRetryDelayMs = 0;

        if (bookings) {
          await this.markCovered(notificationId);
          return bookings;
        }

        return (await this.getCachedBookings()) ?? this.memory() ?? [];
      } catch (error) {
        console.error('[BookingCacheService] Error fetching bookings:', error);
        this.retryNotice(notificationId);
        return (await this.getCachedBookings()) ?? this.memory() ?? [];
      } finally {
        this.isSyncing = false;
        this.syncPromise = null;
      }
    })();

    return this.syncPromise;
  }

  private async markCovered(notificationId?: number): Promise<void> {
    if (!notificationId) return;

    await this.exclusive(async () => {
      const metadata = await this.getCacheMetadata();
      if (!metadata || (metadata.coveredNotificationId ?? 0) >= notificationId) return;
      await this.patchMetadata({ coveredNotificationId: notificationId });
    });
  }

  private async syncChanges(startedAt: number, metadata: CacheMetadata, announce: boolean): Promise<{ bookings: Booking[]; wantsFull: boolean } | null> {
    const incoming: Booking[] = [];
    let first: BookingSyncInfo | undefined;
    let beforeId: number | undefined;

    for (let page = 1; ; page += 1) {
      if (page > CHANGES_MAX_PAGES) {
        return null;
      }

      let response: PaginatedBookingResponse;
      try {
        response = await bookingService.getBookings({
          updated_since: metadata.cursor,
          sort_by: 'id',
          sort_order: 'desc',
          per_page: CHANGES_PAGE_SIZE,
          page: 1,
          ...(beforeId !== undefined ? { before_id: beforeId } : {}),
        }, { timeout: SYNC_REQUEST_TIMEOUT_MS });
      } catch (error) {
        if (isUnprocessable(error)) {
          return null;
        }
        throw error;
      }

      const pageSync = response.data?.sync;
      if (!response.success || !pageSync?.cursor || pageSync.scope !== metadata.scope || typeof pageSync.total !== 'number') {
        return null;
      }
      if (!first && (response.data?.pagination?.total ?? 0) > CHANGES_PAGE_SIZE * CHANGES_MAX_PAGES) {
        return null;
      }
      first = first ?? pageSync;

      const rows = response.data?.bookings ?? [];
      incoming.push(...rows);
      if (rows.length < CHANGES_PAGE_SIZE) {
        break;
      }
      beforeId = rows[rows.length - 1].id;
    }

    const sync = first;
    if (!sync) {
      return null;
    }

    const deletedIds = sync.deleted_ids ?? [];

    if (incoming.length === 0 && deletedIds.length === 0 && sync.total === metadata.totalRecords) {
      await this.exclusive(() => this.patchMetadata({ cursor: sync.cursor, syncedAt: Date.now(), syncStartedAt: startedAt, lastUpdated: Date.now() }));
      return { bookings: this.memory() ?? (await this.getCachedBookings()) ?? [], wantsFull: false };
    }

    const outcome = await this.exclusive(async () => {
      const cached = await this.getCachedBookings();
      if (!cached) {
        return null;
      }

      const byId = new Map(cached.map((booking) => [booking.id, booking]));
      const removed = deletedIds.filter((id) => byId.delete(id)).length;
      const changed = incoming.filter((booking) => {
        const current = byId.get(booking.id);
        if (!current) return true;
        if (isNewerCopy(current, booking)) return false;
        return JSON.stringify(current) !== JSON.stringify(booking);
      });
      for (const booking of changed) {
        byId.set(booking.id, booking);
      }
      const bookings = newestFirst([...byId.values()]);
      const wantsFull = bookings.length !== sync.total && Date.now() - (metadata.fullSyncedAt ?? 0) > MISMATCH_FULL_SYNC_MIN_GAP_MS;

      if (changed.length === 0 && removed === 0) {
        this.remember(cached);
        await this.patchMetadata({ cursor: sync.cursor, syncedAt: Date.now(), syncStartedAt: startedAt, lastUpdated: Date.now() });
        return { bookings: cached, changed: false, wantsFull };
      }

      await this.cacheBookings(bookings, { cursor: sync.cursor, syncedAt: Date.now(), syncStartedAt: startedAt });
      return { bookings, changed: true, wantsFull };
    });

    if (!outcome) {
      return null;
    }

    if (outcome.changed && announce) {
      window.dispatchEvent(new CustomEvent('bookings-cache-updated', {
        detail: { bookings: outcome.bookings, source: 'api', startedAt }
      }));
      this.broadcast(startedAt);
    }

    return { bookings: outcome.bookings, wantsFull: outcome.wantsFull };
  }

  private async syncEverything(startedAt: number, filters?: BookingFilters): Promise<Booking[] | null> {
    return this.withFullSyncLock(async () => {
      const userId = this.currentUserId();
      let metadata = await this.getCacheMetadata();
      if (!metadata && userId !== undefined) {
        metadata = await this.exclusive(async () => {
          const current = await this.getCacheMetadata();
          if (current) return current;
          const cache = await this.getCache();
          if (!cache) return null;
          const owner: CacheMetadata = { userId, totalRecords: 0, lastUpdated: 0 };
          await this.putMetadata(cache, owner);
          return owner;
        });
      }
      const sameUser = !!metadata && metadata.userId === userId;
      const failures = sameUser ? (metadata?.fullSyncFailures ?? 0) : 0;

      if (sameUser && metadata) {
        if ((metadata.fullSyncCompletedAt ?? 0) >= startedAt) {
          return null;
        }

        const lastStart = Math.max(this.lastFullSyncUserId === userId ? this.lastFullSyncAt : 0, metadata.fullSyncStartedAt ?? 0);
        if (Date.now() - lastStart < FULL_SYNC_MIN_GAP_MS) {
          return null;
        }

        if (failures > 0 && Date.now() - (metadata.fullSyncFailedAt ?? 0) < this.backoffMs(failures)) {
          return null;
        }
      } else if (this.lastFullSyncUserId === userId && Date.now() - this.lastFullSyncAt < FULL_SYNC_MIN_GAP_MS) {
        return null;
      }

      this.lastFullSyncAt = Date.now();
      this.lastFullSyncUserId = userId;
      if (sameUser) {
        await this.exclusive(() => this.patchMetadata({ fullSyncStartedAt: startedAt }));
      }

      const first: { sync?: BookingSyncInfo } = {};
      let downloaded: Booking[];
      try {
        downloaded = await this.downloadEverything(filters, first);
      } catch (error) {
        if (sameUser) {
          await this.exclusive(() => this.patchMetadata({ fullSyncFailedAt: Date.now(), fullSyncFailures: failures + 1 }));
        }
        throw error;
      }

      const merged = await this.exclusive(async () => {
        const kept = newestFirst(keepNewerCopies(downloaded, sameUser ? await this.getCachedBookings() : null));
        await this.cacheBookings(kept, {
          userId: filters?.user_id,
          cursor: first.sync?.cursor,
          scope: first.sync?.scope,
          fullSyncedAt: first.sync ? startedAt : undefined,
          fullSyncStartedAt: startedAt,
          fullSyncCompletedAt: Date.now(),
          fullSyncFailedAt: undefined,
          fullSyncFailures: 0,
          syncedAt: Date.now(),
          syncStartedAt: startedAt,
        });
        return kept;
      });

      let bookings = merged;
      try {
        const written = await this.getCacheMetadata();
        if (written?.cursor && written.scope && written.fullSyncedAt) {
          bookings = (await this.syncChanges(Date.now(), written, false))?.bookings ?? merged;
        }
      } catch (error) {
        console.warn('[BookingCacheService] Catch-up after the full download failed:', error);
      }

      window.dispatchEvent(new CustomEvent('bookings-cache-updated', {
        detail: { bookings, source: 'api', startedAt }
      }));
      this.broadcast(startedAt);

      return bookings;
    });
  }

  private async downloadEverything(filters: BookingFilters | undefined, first: { sync?: BookingSyncInfo }): Promise<Booking[]> {
    const byId = new Map<number, Booking>();
    let beforeId: number | undefined;

    for (let page = 1; page <= FULL_MAX_PAGES; page += 1) {
      const response: PaginatedBookingResponse = await bookingService.getBookings({
        ...(filters?.user_id ? { user_id: filters.user_id } : {}),
        sync: 1,
        sort_by: 'id',
        sort_order: 'desc',
        per_page: FULL_PAGE_SIZE,
        page: 1,
        ...(beforeId !== undefined ? { before_id: beforeId } : {}),
      }, { timeout: SYNC_REQUEST_TIMEOUT_MS });
      const rows = response.data?.bookings ?? [];

      if (page === 1) {
        first.sync = response.data?.sync;
        if (!first.sync) {
          return this.downloadEverythingByPageNumber(filters, rows, response.data?.pagination?.last_page ?? 1);
        }
      } else {
        const boundary = beforeId;
        if (boundary !== undefined && rows.some((row) => row.id >= boundary)) {
          throw new Error('[BookingCacheService] The bookings list did not page by booking id');
        }
      }

      for (const row of rows) {
        if (!byId.has(row.id)) byId.set(row.id, row);
      }

      if (rows.length < FULL_PAGE_SIZE) {
        break;
      }
      beforeId = rows[rows.length - 1].id;
    }

    return [...byId.values()];
  }

  private async downloadEverythingByPageNumber(filters: BookingFilters | undefined, firstPage: Booking[], lastPage: number): Promise<Booking[]> {
    const byId = new Map<number, Booking>(firstPage.map((row) => [row.id, row]));

    for (let page = 2; page <= Math.min(lastPage, FULL_MAX_PAGES); page += 1) {
      const response: PaginatedBookingResponse = await bookingService.getBookings({
        ...(filters?.user_id ? { user_id: filters.user_id } : {}),
        sort_by: 'id',
        sort_order: 'desc',
        per_page: FULL_PAGE_SIZE,
        page,
      }, { timeout: SYNC_REQUEST_TIMEOUT_MS });
      for (const row of response.data?.bookings ?? []) {
        if (!byId.has(row.id)) byId.set(row.id, row);
      }
    }

    return [...byId.values()];
  }

  syncNow(notificationId?: number): void {
    if (notificationId) {
      this.pendingNotificationId = Math.max(this.pendingNotificationId, notificationId);
    }
    if (this.catchUpTimer) return;

    const requestedAt = Date.now();
    const wait = Math.max(0, SYNC_MIN_INTERVAL_MS - (Date.now() - this.lastSyncAttemptAt));
    this.catchUpTimer = setTimeout(async () => {
      this.catchUpTimer = null;
      if (this.isSyncing && this.syncPromise) {
        void this.syncPromise.finally(() => this.syncNow());
        return;
      }

      const target = this.pendingNotificationId;
      this.pendingNotificationId = 0;

      const metadata = await this.getCacheMetadata();
      const sameUser = !!metadata && metadata.userId === this.currentUserId();
      const coveredElsewhere = sameUser && target > 0 && (metadata?.coveredNotificationId ?? 0) >= target;
      const syncedSinceRequest = sameUser && (metadata?.syncStartedAt ?? 0) >= requestedAt;
      if (coveredElsewhere || syncedSinceRequest) {
        return;
      }

      void this.syncFromAPI(undefined, target || undefined);
    }, wait);
  }

  syncInBackground(filters?: BookingFilters): void {
    if (this.isSyncing || this.syncScheduled) return;
    this.syncScheduled = true;

    setTimeout(async () => {
      try {
        const metadata = await this.getCacheMetadata();
        const lastSyncedAt = Math.max(metadata?.syncedAt ?? metadata?.lastUpdated ?? 0, this.lastSyncAttemptAt);
        if (Date.now() - lastSyncedAt < SYNC_MIN_INTERVAL_MS) {
          return;
        }
        await this.syncFromAPI(filters);
        console.log('[BookingCacheService] Background sync completed');
      } catch (error) {
        console.error('[BookingCacheService] Background sync failed:', error);
      } finally {
        this.syncScheduled = false;
      }
    }, 0);
  }

  async updateBookingInCache(updatedBooking: Booking): Promise<void> {
    const written = await this.exclusive(async () => {
      const cachedBookings = await this.getCachedBookings();
      if (!cachedBookings) return false;

      const index = cachedBookings.findIndex(b => b.id === updatedBooking.id);

      if (index >= 0) {
        cachedBookings[index] = { ...cachedBookings[index], ...updatedBooking };
      } else {
        cachedBookings.unshift(updatedBooking);
      }

      await this.cacheBookings(cachedBookings);
      return true;
    });
    if (!written) return;

    window.dispatchEvent(new CustomEvent('bookings-cache-updated', {
      detail: { booking: updatedBooking, source: 'update' }
    }));
    this.broadcast(0);
    void metricsCacheService.clearAllCaches();
  }

  async addBookingToCache(newBooking: Booking): Promise<void> {
    const added = await this.exclusive(async () => {
      const bookings = (await this.getCachedBookings()) || [];

      if (bookings.some(b => b.id === newBooking.id)) return false;

      bookings.unshift(newBooking);
      await this.cacheBookings(bookings);
      return true;
    });
    if (added) {
      this.broadcast(0);
    }

    window.dispatchEvent(new CustomEvent('bookings-cache-updated', {
      detail: { booking: newBooking, source: 'create' }
    }));
    void metricsCacheService.clearAllCaches();
  }

  async removeBookingFromCache(bookingId: number): Promise<void> {
    const written = await this.exclusive(async () => {
      const cachedBookings = await this.getCachedBookings();
      if (!cachedBookings) return false;

      await this.cacheBookings(cachedBookings.filter(b => b.id !== bookingId));
      return true;
    });
    if (!written) return;

    window.dispatchEvent(new CustomEvent('bookings-cache-updated', {
      detail: { bookingId, source: 'delete' }
    }));
    this.broadcast(0);
    void metricsCacheService.clearAllCaches();
  }

  async getBookingFromCache(bookingId: number): Promise<Booking | null> {
    const cachedBookings = await this.getCachedBookings();
    if (!cachedBookings) return null;

    return cachedBookings.find(b => b.id === bookingId) || null;
  }

  async getFilteredBookingsFromCache(filters: BookingFilters): Promise<Booking[]> {
    const cachedBookings = await this.getCachedBookings();
    console.log('[BookingCacheService] getFilteredBookingsFromCache called with filters:', filters);
    console.log('[BookingCacheService] cachedBookings count:', cachedBookings?.length || 0);
    
    if (!cachedBookings) return [];

    const filtered = cachedBookings.filter(booking => {
      if (filters.location_id && booking.location_id !== filters.location_id) {
        return false;
      }

      if (filters.status && booking.status !== filters.status) {
        return false;
      }

      if (filters.date_from) {
        const bookingDate = new Date(booking.booking_date);
        const fromDate = new Date(filters.date_from);
        if (bookingDate < fromDate) return false;
      }

      if (filters.date_to) {
        const bookingDate = new Date(booking.booking_date);
        const toDate = new Date(filters.date_to);
        if (bookingDate > toDate) return false;
      }

      if (filters.booking_date) {
        const bookingDatePart = booking.booking_date.split('T')[0];
        if (bookingDatePart !== filters.booking_date) {
          return false;
        }
      }

      if (filters.customer_id && booking.customer_id !== filters.customer_id) {
        return false;
      }

      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const customerName = booking.guest_name?.toLowerCase() || '';
        const customerEmail = booking.guest_email?.toLowerCase() || '';
        const refNumber = booking.reference_number?.toLowerCase() || '';
        
        if (!customerName.includes(searchLower) && 
            !customerEmail.includes(searchLower) && 
            !refNumber.includes(searchLower)) {
          return false;
        }
      }

      return true;
    });
    
    console.log('[BookingCacheService] Filtered bookings count:', filtered.length);
    return filtered;
  }

  async clearCache(): Promise<void> {
    if (this.catchUpTimer) {
      clearTimeout(this.catchUpTimer);
      this.catchUpTimer = null;
    }
    if (this.otherTabTimer) {
      clearTimeout(this.otherTabTimer);
      this.otherTabTimer = null;
    }
    if (this.noticeRetryTimer) {
      clearTimeout(this.noticeRetryTimer);
      this.noticeRetryTimer = null;
    }
    this.noticeRetryDelayMs = 0;
    this.pendingNotificationId = 0;
    this.memoryCopy = null;
    this.memoryOwnerId = undefined;
    this.lastFullSyncAt = 0;
    this.lastFullSyncUserId = undefined;

    if (!this.isCacheAvailable()) return;

    try {
      const deleted = await caches.delete(CACHE_NAME);
      if (deleted) {
        console.log('[BookingCacheService] Cache cleared successfully');
      }
      
      warmupCompleted = false;

      window.dispatchEvent(new CustomEvent('bookings-cache-cleared'));
    } catch (error) {
      console.error('[BookingCacheService] Error clearing cache:', error);
    }
  }

  async forceRefresh(filters?: BookingFilters): Promise<Booking[]> {
    return this.fetchAndCacheBookings(filters, true);
  }

  async warmupCache(filters?: BookingFilters): Promise<void> {
    if (warmupCompleted) {
      console.log('[BookingCacheService] Warmup already completed this session');
      return;
    }
    
    const cachedBookings = await this.getCachedBookings();
    
    if (!cachedBookings || cachedBookings.length === 0) {
      console.log('[BookingCacheService] Warming up cache...');
      await this.syncFromAPI(filters);
      console.log('[BookingCacheService] Cache warmup complete');
    } else {
      console.log('[BookingCacheService] Cache already has data, skipping warmup');
    }
    
    warmupCompleted = true;
  }

  async hasCachedData(): Promise<boolean> {
    const cache = await this.getCache();
    if (!cache) return false;
    
    try {
      const response = await cache.match(BOOKINGS_CACHE_KEY);
      return response !== undefined;
    } catch {
      return false;
    }
  }

  async getBookings(filters?: BookingFilters): Promise<Booking[]> {
    return this.fetchAndCacheBookings(filters);
  }

  onCacheUpdate(callback: (event: CustomEvent) => void): () => void {
    const handler = (e: Event) => callback(e as CustomEvent);
    window.addEventListener('bookings-cache-updated', handler);
    return () => window.removeEventListener('bookings-cache-updated', handler);
  }

  onCacheCleared(callback: () => void): () => void {
    window.addEventListener('bookings-cache-cleared', callback);
    return () => window.removeEventListener('bookings-cache-cleared', callback);
  }
}

export const bookingCacheService = BookingCacheService.getInstance();

export type { BookingsCacheEntry, CacheMetadata };
