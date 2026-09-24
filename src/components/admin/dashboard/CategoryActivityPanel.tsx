import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  DoorOpen,
  Hammer,
  Layers,
  Loader2,
  PartyPopper,
  Sparkles,
  Ticket,
  Users,
  X,
} from 'lucide-react';
import InfoTooltip from '../../ui/InfoTooltip';
import CalendarDatePicker from '../calendar/CalendarDatePicker';
import { useThemeColor } from '../../../hooks/useThemeColor';
import { AttractionScheduleCard, EventScheduleCard, attractionsForDate, eventsForDate, formatDateKey } from '../calendar/ScheduledActivity';
import { fetchDayBookings } from '../calendar/fetchDayBookings';
import { convertTo12Hour, michiganToday } from '../../../utils/timeFormat';
import { buildActivityBuckets, bucketItemCount, type ActivityBucket, type ActivityBucketKey } from './activityCategories';
import attractionPurchaseService, { type AttractionPurchase } from '../../../services/AttractionPurchaseService';
import eventPurchaseService from '../../../services/EventPurchaseService';
import type { EventPurchase } from '../../../types/event.types';
import { getStoredUser } from '../../../utils/storage';
import type { Booking } from '../../../services/bookingService';

interface BucketStyle {
  icon: React.ComponentType<{ size?: number | string; className?: string }>;
  iconWrap: string;
  ring: string;
  activeRing: string;
  value: string;
}

const BUCKET_STYLES: Record<ActivityBucketKey, BucketStyle> = {
  party_packages: {
    icon: PartyPopper,
    iconWrap: 'bg-blue-100 text-blue-700',
    ring: 'border-gray-100 hover:border-blue-200',
    activeRing: 'border-blue-400 shadow-md',
    value: 'text-blue-700',
  },
  attractions: {
    icon: Ticket,
    iconWrap: 'bg-purple-100 text-purple-700',
    ring: 'border-gray-100 hover:border-purple-200',
    activeRing: 'border-purple-400 shadow-md',
    value: 'text-purple-700',
  },
  escape_rooms: {
    icon: DoorOpen,
    iconWrap: 'bg-emerald-100 text-emerald-700',
    ring: 'border-gray-100 hover:border-emerald-200',
    activeRing: 'border-emerald-400 shadow-md',
    value: 'text-emerald-700',
  },
  rage_rooms: {
    icon: Hammer,
    iconWrap: 'bg-rose-100 text-rose-700',
    ring: 'border-gray-100 hover:border-rose-200',
    activeRing: 'border-rose-400 shadow-md',
    value: 'text-rose-700',
  },
  events: {
    icon: Sparkles,
    iconWrap: 'bg-amber-100 text-amber-700',
    ring: 'border-gray-100 hover:border-amber-200',
    activeRing: 'border-amber-400 shadow-md',
    value: 'text-amber-700',
  },
};

const statusPillClass = (status?: string): string => {
  switch (String(status || '').toLowerCase()) {
    case 'confirmed': return 'bg-green-100 text-green-800';
    case 'pending': return 'bg-yellow-100 text-yellow-800';
    case 'cancelled': return 'bg-red-100 text-red-800';
    case 'checked-in': return 'bg-blue-100 text-blue-800';
    case 'completed': return 'bg-gray-100 text-gray-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

const guestNameOf = (booking: Booking): string => {
  const customer = booking.customer as { first_name?: string; last_name?: string } | undefined;
  if (booking.guest_name) return booking.guest_name;
  if (customer?.first_name || customer?.last_name) {
    return `${customer.first_name ?? ''} ${customer.last_name ?? ''}`.trim();
  }
  return 'Guest';
};

const roomNameOf = (booking: Booking): string => {
  const room = booking.room as { name?: string } | undefined;
  return room?.name ?? '';
};

const STEP_DEBOUNCE_MS = 200;
const PURCHASE_PAGE_SIZE = 100;
const PURCHASE_MAX_PAGES = 50;

interface DayActivity {
  scopeKey: string;
  bookings: Booking[];
  purchases: AttractionPurchase[];
  events: EventPurchase[];
  failed: boolean;
}

const NO_ACTIVITY: DayActivity = { scopeKey: '', bookings: [], purchases: [], events: [], failed: false };

const scopeKeyOf = (dateKey: string, locationId: number | null): string => `${dateKey}|${locationId ?? 'all'}`;

const loadDayPurchases = async (dateKey: string, locationId: number | null, userId?: number) => {
  const collected: AttractionPurchase[] = [];
  let page = 1;
  let lastPage = 1;
  do {
    const response = await attractionPurchaseService.getPurchases({
      scheduled_from: dateKey,
      scheduled_to: dateKey,
      per_page: PURCHASE_PAGE_SIZE,
      page,
      user_id: userId,
      location_id: locationId ?? undefined,
    });
    collected.push(...(response?.data?.purchases || []));
    lastPage = response?.data?.pagination?.last_page ?? 1;
    page += 1;
  } while (page <= lastPage && page <= PURCHASE_MAX_PAGES);

  const unique = new Map<number, AttractionPurchase>();
  for (const purchase of collected) unique.set(purchase.id, purchase);
  return [...unique.values()];
};

const loadDayEvents = async (dateKey: string, locationId: number | null, userId?: number) => {
  const response = await eventPurchaseService.getPurchases({
    start_date: dateKey,
    end_date: dateKey,
    user_id: userId,
    location_id: locationId ?? undefined,
  });
  const raw = response as unknown;
  return Array.isArray(raw) ? (raw as EventPurchase[]) : ((raw as { data?: EventPurchase[] })?.data ?? []);
};

const useDayActivity = (dateKey: string, locationId: number | null) => {
  const scopeKey = scopeKeyOf(dateKey, locationId);
  const [activity, setActivity] = useState<DayActivity>(NO_ACTIVITY);

  useEffect(() => {
    let cancelled = false;
    const userId = getStoredUser()?.id;
    let failed = false;

    const guard = <T,>(promise: Promise<T>, what: string, fallback: T): Promise<T> =>
      promise.catch(error => {
        console.error(`⚠️ [CategoryActivityPanel] Could not load ${what}:`, error);
        failed = true;
        return fallback;
      });

    const timer = window.setTimeout(() => {
      Promise.all([
        guard(fetchDayBookings(dateKey, locationId, { allStatuses: true }), 'the day\'s bookings', [] as Booking[]),
        guard(loadDayPurchases(dateKey, locationId, userId), 'the day\'s attraction tickets', [] as AttractionPurchase[]),
        guard(loadDayEvents(dateKey, locationId, userId), 'the day\'s event registrations', [] as EventPurchase[]),
      ]).then(([bookings, purchases, events]) => {
        if (cancelled) return;
        setActivity({ scopeKey, bookings, purchases, events, failed });
      });
    }, STEP_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [dateKey, locationId, scopeKey]);

  return { activity, ready: activity.scopeKey === scopeKey, scopeKey };
};

const BookingRow: React.FC<{
  booking: Booking;
  onOpen?: (booking: Booking) => void;
}> = ({ booking, onOpen }) => {
  const body = (
    <>
      <span className="flex items-start justify-between gap-3">
        <span className="block min-w-0">
          <span className="block text-sm font-semibold text-gray-900 truncate">
            {booking.package?.name || 'Package booking'}
          </span>
          <span className="block text-xs text-gray-500 truncate">{guestNameOf(booking)}</span>
        </span>
        <span className={`shrink-0 px-2 py-0.5 text-[11px] font-medium rounded-full capitalize ${statusPillClass(booking.status)}`}>
          {booking.status}
        </span>
      </span>
      <span className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-600">
        <span className="font-medium text-gray-800">{convertTo12Hour(booking.booking_time)}</span>
        <span className="inline-flex items-center gap-1">
          <Users className="h-3.5 w-3.5 text-gray-400" />
          {booking.participants} guest{booking.participants === 1 ? '' : 's'}
        </span>
        {roomNameOf(booking) ? <span className="truncate">{roomNameOf(booking)}</span> : null}
        <span className="ml-auto font-medium text-gray-900">${Number(booking.total_amount || 0).toFixed(2)}</span>
      </span>
    </>
  );

  const className = 'block w-full text-left border border-gray-200 rounded-lg p-3 bg-white hover:border-gray-300 hover:shadow-sm transition';

  if (onOpen) {
    return (
      <button type="button" onClick={() => onOpen(booking)} className={className}>
        {body}
      </button>
    );
  }

  return (
    <Link to={`/bookings/${booking.id}`} className={className}>
      {body}
    </Link>
  );
};

const BucketDetail: React.FC<{
  bucket: ActivityBucket;
  dateLabel: string;
  scopeLabel: string;
  onClose: () => void;
  onSelectBooking?: (booking: Booking) => void;
}> = ({ bucket, dateLabel, scopeLabel, onClose, onSelectBooking }) => {
  const style = BUCKET_STYLES[bucket.key];
  const Icon = style.icon;
  const items = bucketItemCount(bucket);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto"
        onClick={event => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`${bucket.label} on ${dateLabel}`}
      >
        <div className="p-4 sm:p-6">
          <div className="flex items-start justify-between gap-4 mb-5">
            <div className="flex items-start gap-3 min-w-0">
              <span className={`p-2 rounded-lg shrink-0 ${style.iconWrap}`}>
                <Icon size={18} />
              </span>
              <div className="min-w-0">
                <h3 className="text-lg sm:text-xl font-semibold text-gray-900">{bucket.label}</h3>
                <p className="text-sm text-gray-500">{dateLabel} · {scopeLabel}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition shrink-0"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-5">
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
              <p className="text-2xl font-bold text-gray-900">{bucket.primary.toLocaleString()}</p>
              <p className="text-xs text-gray-500 capitalize">{bucket.primaryUnit}</p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
              <p className="text-2xl font-bold text-gray-900">{bucket.secondary.toLocaleString()}</p>
              <p className="text-xs text-gray-500 capitalize">{bucket.secondaryUnit}</p>
            </div>
          </div>

          <p className="text-xs text-gray-500 leading-relaxed mb-5">{bucket.explanation}</p>

          {bucket.sources.length > 0 && (
            <div className="mb-5">
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">
                What made up the {bucket.primaryUnit}
              </p>
              <div className="space-y-1.5">
                {bucket.sources.map(source => (
                  <div key={source.label} className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-gray-700 truncate">
                      {source.label}
                      <span className="ml-2 text-xs text-gray-400">{source.category}</span>
                    </span>
                    <span className="font-medium text-gray-900 shrink-0 tabular-nums">{source.count.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {bucket.cancelled > 0 && (
            <p className="text-xs text-gray-500 mb-5">
              {bucket.cancelled} cancelled or refunded {bucket.cancelled === 1 ? 'row is' : 'rows are'} not counted above.
            </p>
          )}

          {items === 0 ? (
            <p className="text-sm text-gray-500 py-6 text-center border border-dashed border-gray-200 rounded-lg">
              Nothing scheduled in {bucket.label} on {dateLabel}.
            </p>
          ) : (
            <div className="space-y-3">
              {bucket.bookings.length > 0 && (
                <div className="space-y-2">
                  {bucket.bookings.map(booking => (
                    <BookingRow key={`booking-${booking.id}`} booking={booking} onOpen={onSelectBooking} />
                  ))}
                </div>
              )}
              {bucket.purchases.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {bucket.purchases.map(purchase => (
                    <AttractionScheduleCard key={`purchase-${purchase.id}`} purchase={purchase} />
                  ))}
                </div>
              )}
              {bucket.eventPurchases.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {bucket.eventPurchases.map(purchase => (
                    <EventScheduleCard key={`event-${purchase.id}`} purchase={purchase} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

interface CategoryActivityPanelProps {
  locationId: number | null;
  scopeLabel: string;
  onSelectBooking?: (booking: Booking) => void;
  className?: string;
}

const CategoryActivityPanel: React.FC<CategoryActivityPanelProps> = ({
  locationId,
  scopeLabel,
  onSelectBooking,
  className,
}) => {
  const { themeColor, fullColor } = useThemeColor();
  const [date, setDate] = useState(() => michiganToday());
  const [openBucket, setOpenBucket] = useState<ActivityBucketKey | null>(null);

  const dateKey = formatDateKey(date);

  const { activity, ready, scopeKey } = useDayActivity(dateKey, locationId);
  const loading = !ready;

  const buckets = useMemo(
    () =>
      ready
        ? buildActivityBuckets({
            bookings: activity.bookings,
            purchases: attractionsForDate(activity.purchases, date),
            events: eventsForDate(activity.events, date),
          })
        : buildActivityBuckets({}),
    [ready, activity, date],
  );

  const shiftDay = useCallback((days: number) => {
    setOpenBucket(null);
    setDate(current => {
      const next = new Date(current);
      next.setDate(next.getDate() + days);
      return next;
    });
  }, []);

  const jumpToDate = useCallback((next: Date) => {
    setOpenBucket(null);
    setDate(next);
  }, []);

  const todayKey = formatDateKey(michiganToday());
  const isToday = dateKey === todayKey;

  const dateLabel = date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const active = ready && openBucket ? buckets.find(bucket => bucket.key === openBucket) ?? null : null;

  useEffect(() => {
    setOpenBucket(null);
  }, [scopeKey]);

  useEffect(() => {
    if (!active) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenBucket(null);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [active]);

  return (
    <div className={`bg-white rounded-xl shadow-sm p-4 sm:p-6 border border-gray-100 ${className ?? ''}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
        <div className="flex items-center gap-2 min-w-0">
          <Layers className="w-5 h-5 text-gray-500 shrink-0" />
          <h2 className="text-lg sm:text-xl font-bold text-gray-900">Activity by Category</h2>
          <InfoTooltip
            content="Everything scheduled at this location for the day shown, grouped by what the guest is here to do. Counts follow the day the activity happens, not the day it was booked. Tap a card to see the bookings and tickets behind the number."
            size={14}
            widthClass="w-72"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => shiftDay(-1)}
            aria-label="Previous day"
            className="p-1.5 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 transition"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <CalendarDatePicker
            value={date}
            onChange={jumpToDate}
            label={dateLabel}
            highlight="day"
            themeColor={themeColor}
            fullColor={fullColor}
            buttonClassName={`flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-800 tabular-nums hover:bg-${themeColor}-50 transition-colors min-w-[10.5rem]`}
          />
          <button
            type="button"
            onClick={() => shiftDay(1)}
            aria-label="Next day"
            className="p-1.5 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 transition"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => { setOpenBucket(null); setDate(michiganToday()); }}
            disabled={isToday}
            className="px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition disabled:opacity-50 disabled:cursor-default"
          >
            Today
          </button>
          {loading && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
        </div>
      </div>

      <p className="text-xs text-gray-500 mb-4">{scopeLabel}</p>

      {ready && activity.failed && (
        <p className="text-xs text-red-600 mb-3">
          Part of this day could not be loaded, so the counts below may be short. Step off this day and back to try again.
        </p>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {buckets.map(bucket => {
          const style = BUCKET_STYLES[bucket.key];
          const Icon = style.icon;
          const items = bucketItemCount(bucket);
          const canOpen = !loading && items > 0;

          return (
            <button
              key={bucket.key}
              type="button"
              onClick={() => canOpen && setOpenBucket(bucket.key)}
              aria-disabled={!canOpen}
              aria-haspopup={canOpen ? 'dialog' : undefined}
              title={
                loading
                  ? `Still counting ${bucket.label} for ${dateLabel}`
                  : canOpen
                    ? `Show the ${items} ${items === 1 ? 'item' : 'items'} in ${bucket.label} on ${dateLabel}`
                    : bucket.cancelled > 0
                      ? `Nothing left in ${bucket.label} on ${dateLabel} — ${bucket.cancelled} cancelled or refunded`
                      : `Nothing scheduled in ${bucket.label} on ${dateLabel}`
              }
              className={`text-left rounded-xl border p-3.5 min-h-[124px] flex flex-col transition-all bg-white ${
                canOpen ? `cursor-pointer ${style.ring} hover:shadow-md` : 'border-gray-100 cursor-default opacity-70'
              } ${openBucket === bucket.key ? style.activeRing : ''}`}
            >
              <span className="flex items-start justify-between gap-1">
                <span className={`p-1.5 rounded-lg shrink-0 ${style.iconWrap}`}>
                  <Icon size={15} />
                </span>
                {canOpen && <ChevronRight className="h-3.5 w-3.5 text-gray-300 shrink-0" />}
              </span>

              <span className="block text-[11px] font-semibold text-gray-700 mt-2 leading-tight">{bucket.label}</span>

              {loading ? (
                <span className="block animate-pulse space-y-1.5 mt-1.5">
                  <span className="block h-6 bg-gray-200 rounded w-12" />
                  <span className="block h-2.5 bg-gray-200 rounded w-20" />
                </span>
              ) : (
                <>
                  <span className={`block text-xl font-bold leading-tight mt-0.5 ${canOpen ? style.value : 'text-gray-400'}`}>
                    {bucket.primary.toLocaleString()}
                    <span className="ml-1 text-[11px] font-medium text-gray-400">{bucket.primaryUnit}</span>
                  </span>
                  <span className="block text-[10px] text-gray-400 leading-snug mt-1">
                    {canOpen
                      ? `${bucket.secondary.toLocaleString()} ${bucket.secondaryUnit}`
                      : bucket.cancelled > 0
                        ? `None scheduled · ${bucket.cancelled} cancelled`
                        : 'None scheduled'}
                  </span>
                  {bucket.categories.length > 0 && (
                    <span className="block text-[10px] text-gray-400 leading-snug mt-auto pt-1 truncate" title={bucket.categories.join(', ')}>
                      {bucket.categories.join(', ')}
                    </span>
                  )}
                </>
              )}
            </button>
          );
        })}
      </div>

      {active && (
        <BucketDetail
          bucket={active}
          dateLabel={dateLabel}
          scopeLabel={scopeLabel}
          onClose={() => setOpenBucket(null)}
          onSelectBooking={
            onSelectBooking
              ? booking => {
                  setOpenBucket(null);
                  onSelectBooking(booking);
                }
              : undefined
          }
        />
      )}
    </div>
  );
};

export default CategoryActivityPanel;
