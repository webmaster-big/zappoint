import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, AlertTriangle, MapPin, Ban, Plus } from 'lucide-react';
import type { Booking } from '../../../services/bookingService';
import type { Room } from '../../../services/RoomService';
import type { ScheduleDayWindow } from '../../../services/ScheduleWindowService';
import { FALLBACK_DAY_WINDOW } from '../../../services/ScheduleWindowService';
import { customerNameOf } from '../../../utils/bookingSearch';
import { getMichiganNow, michiganToday, dateKey } from '../../../utils/timeFormat';
import { resolvePaymentState } from '../../../types/Bookings.types';
import { buildBookingUrl, snapToInterval, snapToOfferedStart, WALK_IN_SNAP_MINUTES } from '../../../utils/bookingPrefill';
import type { TimeRange } from '../../../utils/scheduleGeometry';
import type { FreeState } from '../../../utils/scheduleGeometry';
import {
  assignLanes,
  availableBand,
  blockGeometry,
  buildTimeline,
  freeState,
  freeUntilMinute,
  minuteAtOffset,
  nextFreeMinute,
} from '../../../utils/scheduleGeometry';

const MINUTES_PER_DAY = 24 * 60;
const SLOT_HEIGHT = 30;
const MIN_BLOCK_HEIGHT = 8;
const LANE_GAP = 2;
const DEFAULT_TURNAROUND_MINUTES = 15;

export const SLOT_COLUMN_WIDTH = 64;
export const ROOM_COLUMN_WIDTH = 132;
const HEADER_LINE = 14;
const HEADER_PAD = 4;

interface ScheduleColumn {
  key: string;
  name: string;
  capacity?: number | null;
  roomId?: number;
  locationId?: number;
  virtual: boolean;
  openMinutes: number | null;
  closeMinutes: number | null;
  closedAllDay: boolean;
  closedReason: string | null;
  bookable: boolean;
  windowKnown: boolean;
  closedRanges: { startMinutes: number; endMinutes: number; reason: string | null }[];
}

interface PositionedBooking {
  booking: Booking;
  startMinutes: number;
  endMinutes: number;
  lane: number;
  laneCount: number;
}

interface DayScheduleGridProps {
  date: Date;
  rooms: Room[];
  bookings: Booking[];
  allDayBookings?: Booking[];
  dayWindow?: ScheduleDayWindow | null;
  hideEmptySpaces?: boolean;
  loading?: boolean;
  locationNames?: Record<number, string>;
  bare?: boolean;
  onSelectBooking?: (booking: Booking) => void;
  emptyMessage?: string;
  themeColor?: string;
  fullColor?: string;
}

const STATUS_BG: Record<string, string> = {
  confirmed: 'bg-green-50 border-green-400',
  pending: 'bg-yellow-50 border-yellow-400',
  'checked-in': 'bg-blue-50 border-blue-400',
  completed: 'bg-gray-50 border-gray-400',
  cancelled: 'bg-red-50 border-red-400',
};

export const durationMinutesOf = (booking: Pick<Booking, 'duration' | 'duration_unit'>): number => {
  const duration = Number(booking.duration);
  if (!Number.isFinite(duration) || duration <= 0) return 60;
  const minutes =
    booking.duration_unit === 'minutes'
      ? duration
      : booking.duration_unit === 'hours'
        ? duration * 60
        : Math.floor(duration) * 60 + Math.round((duration % 1) * 60);
  return Math.min(minutes, MINUTES_PER_DAY);
};

export const startMinutesOf = (booking: Pick<Booking, 'booking_time'>): number => {
  const [hour, minute] = (booking.booking_time || '00:00').split(':').map(Number);
  if (!Number.isFinite(hour)) return 0;
  return hour * 60 + (Number.isFinite(minute) ? minute : 0);
};

const formatSlotLabel = (minutes: number): string => {
  if (!Number.isFinite(minutes)) return '--:--';
  const hour24 = Math.floor(minutes / 60) % 24;
  const minute = Math.round(minutes % 60);
  const hour = hour24 % 12 || 12;
  const meridiem = hour24 >= 12 ? 'PM' : 'AM';
  return `${hour}:${String(minute).padStart(2, '0')} ${meridiem}`;
};

const formatRange = (start: number, end: number): string => `${formatSlotLabel(start)} – ${formatSlotLabel(end)}`;

const DayScheduleGrid: React.FC<DayScheduleGridProps> = ({
  date,
  rooms,
  bookings,
  allDayBookings,
  dayWindow,
  hideEmptySpaces = false,
  loading = false,
  locationNames,
  bare = false,
  onSelectBooking,
  emptyMessage,
  fullColor = 'blue-600',
}) => {
  const windowData = dayWindow ?? FALLBACK_DAY_WINDOW;
  const knownRoomIds = useMemo(() => new Set(rooms.map(room => room.id)), [rooms]);

  const roomWindows = useMemo(() => {
    const map = new Map<number, ScheduleDayWindow['rooms'][number]>();
    for (const entry of windowData.rooms ?? []) map.set(entry.room_id, entry);
    return map;
  }, [windowData]);

  const roomBreaks = useMemo(() => {
    const dayName = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][date.getDay()];
    const map = new Map<number, TimeRange[]>();

    for (const room of rooms) {
      const ranges: TimeRange[] = [];
      for (const brk of room.break_time ?? []) {
        if (!brk.days?.includes(dayName)) continue;
        const [sh, sm] = (brk.start_time || '').split(':').map(Number);
        const [eh, em] = (brk.end_time || '').split(':').map(Number);
        if (!Number.isFinite(sh) || !Number.isFinite(eh)) continue;
        const startMinutes = sh * 60 + (sm || 0);
        const endMinutes = eh * 60 + (em || 0);
        if (endMinutes > startMinutes) ranges.push({ startMinutes, endMinutes });
      }
      if (ranges.length) map.set(room.id, ranges);
    }

    return map;
  }, [rooms, date]);

  const columnKeyFor = React.useCallback(
    (booking: Booking): string => {
      if (booking.room_id && knownRoomIds.has(booking.room_id)) return `room-${booking.room_id}`;
      return booking.package_id ? `pkg-${booking.package_id}` : 'unassigned';
    },
    [knownRoomIds]
  );

  const packageWindows = useMemo(() => {
    const map = new Map<number, { open: number; close: number }>();
    for (const entry of windowData.packages ?? []) {
      map.set(entry.package_id, { open: entry.open_minutes, close: entry.close_minutes });
    }
    return map;
  }, [windowData]);

  const columns = useMemo<ScheduleColumn[]>(() => {
    const counts = new Map<string, number>();
    for (const booking of bookings) {
      const key = columnKeyFor(booking);
      counts.set(key, (counts.get(key) || 0) + 1);
    }

    const roomColumns = rooms
      .filter(room => !hideEmptySpaces || (counts.get(`room-${room.id}`) || 0) > 0)
      .map<ScheduleColumn>(room => {
        const entry = roomWindows.get(room.id);
        return {
          key: `room-${room.id}`,
          name: room.name,
          capacity: room.capacity,
          roomId: room.id,
          locationId: room.location_id,
          virtual: false,
          openMinutes: entry?.open_minutes ?? null,
          closeMinutes: entry?.close_minutes ?? null,
          closedAllDay: entry?.closed_all_day ?? false,
          closedReason: entry?.reason ?? null,
          windowKnown: entry !== undefined,
          bookable: entry ? entry.bookable !== false : true,
          closedRanges: (entry?.closed_ranges ?? []).map(r => ({
            startMinutes: r.start_minutes,
            endMinutes: r.end_minutes,
            reason: r.reason,
          })),
        };
      });

    const virtualMap = new Map<string, ScheduleColumn>();
    for (const booking of bookings) {
      const key = columnKeyFor(booking);
      if (key.startsWith('room-')) continue;
      if (!virtualMap.has(key)) {
        const packageWindow = booking.package_id ? packageWindows.get(booking.package_id) : undefined;
        virtualMap.set(key, {
          key,
          name: booking.package?.name || 'Unassigned',
          virtual: true,
          openMinutes: packageWindow?.open ?? null,
          closeMinutes: packageWindow?.close ?? null,
          closedAllDay: false,
          closedReason: null,
          bookable: !windowData.location_closed,
          windowKnown: true,
          closedRanges: [],
        });
      }
    }

    const bookedPackageIds = new Set(
      bookings.filter(booking => !booking.room_id || !knownRoomIds.has(booking.room_id)).map(booking => booking.package_id)
    );

    if (!hideEmptySpaces) {
      for (const entry of windowData.packages ?? []) {
        if (entry.room_ids.length > 0) continue;
        const key = `pkg-${entry.package_id}`;
        if (virtualMap.has(key) || bookedPackageIds.has(entry.package_id)) continue;
        virtualMap.set(key, {
          key,
          name: entry.name,
          virtual: true,
          openMinutes: entry.open_minutes,
          closeMinutes: entry.close_minutes,
          closedAllDay: false,
          closedReason: null,
          bookable: !windowData.location_closed,
          windowKnown: true,
          closedRanges: [],
        });
      }
    }

    const virtualColumns = [...virtualMap.values()].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    );

    return [...roomColumns, ...virtualColumns];
  }, [rooms, bookings, hideEmptySpaces, columnKeyFor, roomWindows, packageWindows, windowData, knownRoomIds]);

  const occupancy = useMemo(() => {
    const source = allDayBookings ?? bookings;
    const map = new Map<string, TimeRange[]>();
    for (const booking of source) {
      const key = columnKeyFor(booking);
      const startMinutes = startMinutesOf(booking);
      // a space stays shut for its turnaround after a booking ends; without it the band looks
      // free and the booking page then refuses that minute
      const turnaround = booking.room_id
        ? roomWindows.get(booking.room_id)?.interval_minutes ?? DEFAULT_TURNAROUND_MINUTES
        : DEFAULT_TURNAROUND_MINUTES;
      const bucket = map.get(key);
      const range = { startMinutes, endMinutes: startMinutes + durationMinutesOf(booking) + turnaround };
      if (bucket) bucket.push(range);
      else map.set(key, [range]);
    }
    return map;
  }, [allDayBookings, bookings, columnKeyFor, roomWindows]);

  const positioned = useMemo(() => {
    const map = new Map<string, PositionedBooking[]>();
    for (const column of columns) map.set(column.key, []);

    for (const booking of bookings) {
      const key = columnKeyFor(booking);
      const bucket = map.get(key);
      if (!bucket) continue;
      const startMinutes = startMinutesOf(booking);
      bucket.push({
        booking,
        startMinutes,
        endMinutes: startMinutes + durationMinutesOf(booking),
        lane: 0,
        laneCount: 1,
      });
    }

    for (const bucket of map.values()) assignLanes(bucket);
    return map;
  }, [columns, bookings, columnKeyFor]);

  const timeline = useMemo(
    () =>
      buildTimeline(
        windowData.open_minutes,
        windowData.close_minutes,
        windowData.interval_minutes,
        SLOT_HEIGHT,
        [...positioned.values()].flat()
      ),
    [windowData, positioned]
  );

  const showColumnLocation = useMemo(() => {
    if (!locationNames) return false;
    const ids = new Set(columns.filter(column => !column.virtual).map(column => column.locationId));
    return ids.size > 1;
  }, [locationNames, columns]);

  const [nowTick, setNowTick] = useState(() => getMichiganNow());
  const isViewingToday = dateKey(date) === dateKey(michiganToday());
  const isPastDate = dateKey(date) < dateKey(michiganToday());

  useEffect(() => {
    if (!isViewingToday) return;
    const tick = () => setNowTick(getMichiganNow());
    const timer = window.setInterval(tick, 15000);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [isViewingToday]);

  const nowMinutes = nowTick.hour * 60 + nowTick.minute;
  const showNowLine = isViewingToday && nowMinutes >= timeline.start && nowMinutes <= timeline.end;

  const freeFromByColumn = useMemo(() => {
    const map = new Map<string, FreeState>();

    for (const column of columns) {
      if (column.closedAllDay) {
        map.set(column.key, { kind: 'closed' });
        continue;
      }

      const open = column.openMinutes ?? (column.windowKnown && !column.virtual ? null : timeline.start);
      const close = column.closeMinutes ?? (column.windowKnown && !column.virtual ? null : timeline.end);
      const from = isViewingToday ? nowMinutes : (open ?? timeline.start);

      const blocked: TimeRange[] = [
        ...(occupancy.get(column.key) ?? []),
        ...(column.roomId ? roomBreaks.get(column.roomId) ?? [] : []).map(b => ({ ...b, reason: 'On break' })),
        ...column.closedRanges.map(r => ({ ...r, reason: r.reason ?? 'Closed' })),
      ];

      map.set(column.key, freeState(open, close, blocked, from, column.bookable && column.windowKnown));
    }

    return map;
  }, [columns, occupancy, timeline, isViewingToday, nowMinutes, roomBreaks]);

  const headerHeight = useMemo(() => {
    const hasSecondLine = columns.some(
      column =>
        column.closedAllDay ||
        column.virtual ||
        showColumnLocation ||
        freeFromByColumn.get(column.key) !== undefined
    );
    return (hasSecondLine ? HEADER_LINE * 2 + 2 : HEADER_LINE) + HEADER_PAD * 2;
  }, [columns, showColumnLocation, freeFromByColumn]);


  const navigate = useNavigate();
  const [hoverSlot, setHoverSlot] = useState<{ key: string; minute: number } | null>(null);

  const packagesForSlot = React.useCallback(
    (column: ScheduleColumn, minute: number): number[] => {
      if (!column.virtual) {
        return (windowData.packages ?? [])
          .filter(
            entry =>
              column.roomId !== undefined &&
              entry.room_ids.includes(column.roomId) &&
              minute >= entry.open_minutes &&
              minute < entry.close_minutes &&
              !(entry.closed_ranges ?? []).some(
                range => minute >= range.start_minutes && minute < range.end_minutes
              )
          )
          .map(entry => entry.package_id);
      }

      const id = Number(column.key.replace('pkg-', ''));
      return Number.isInteger(id) && id > 0 ? [id] : [];
    },
    [windowData]
  );

  const rawMinuteFromPointer = React.useCallback(
    (event: React.MouseEvent<HTMLDivElement>, originMinute: number): number => {
      const bounds = event.currentTarget.getBoundingClientRect();
      return minuteAtOffset(originMinute, event.clientY - bounds.top, timeline.pxPerMinute);
    },
    [timeline]
  );

  const offeredStartsFor = React.useCallback(
    (column: ScheduleColumn, minute: number): number[] => {
      const ids = packagesForSlot(column, minute);
      if (ids.length === 0) return [];

      const starts = new Set<number>();
      for (const id of ids) {
        const entry = windowData.packages.find(candidate => candidate.package_id === id);
        for (const start of entry?.start_minutes ?? []) starts.add(start);
      }

      return [...starts].sort((a, b) => a - b);
    },
    [packagesForSlot, windowData]
  );

  /**
   * Auto-select only a package that really has a start at this minute — otherwise the booking
   * page refuses the prefilled time. The full list is still offered so staff can choose.
   */
  const offeredCandidates = React.useCallback(
    (column: ScheduleColumn, minute: number): { ids: number[]; autoSelect: number | null } => {
      const ids = packagesForSlot(column, minute);
      const offering = ids.filter(id => {
        const entry = windowData.packages.find(candidate => candidate.package_id === id);
        return entry?.start_minutes ? entry.start_minutes.includes(minute) : true;
      });

      const lone = offering.length === 1 ? offering[0] : null;
      return { ids, autoSelect: lone ?? (offering.length === 0 && ids.length === 1 ? ids[0] : null) };
    },
    [packagesForSlot, windowData]
  );

  const slotMinuteFor = React.useCallback(
    (column: ScheduleColumn, rawMinute: number): number => {
      const floor = isViewingToday ? nowMinutes : undefined;
      const columnOpen = column.openMinutes ?? timeline.start;
      const columnClose = column.closeMinutes ?? timeline.end;
      const offered = offeredStartsFor(column, rawMinute).filter(start => start < columnClose);
      const onGrid = !isViewingToday && offered.length > 0 ? snapToOfferedStart(offered, rawMinute, floor) : null;
      const snapped =
        onGrid ??
        (isViewingToday
          ? Math.max(
              snapToInterval(rawMinute, WALK_IN_SNAP_MINUTES),
              snapToInterval(nowMinutes, WALK_IN_SNAP_MINUTES)
            )
          : snapToInterval(rawMinute, timeline.interval, floor));

      const blocked = [
        ...(occupancy.get(column.key) ?? []),
        ...(column.roomId ? roomBreaks.get(column.roomId) ?? [] : []),
        ...column.closedRanges,
      ];
      const free = nextFreeMinute(columnOpen, columnClose, blocked, snapped);

      if (free === null || free === snapped) return snapped;

      const fromFree = snapToInterval(free, timeline.interval, isViewingToday ? Math.max(free, nowMinutes) : free);

      if (onGrid === null) return fromFree;

      const freeOffered = offered.find(
        start => start >= free && nextFreeMinute(columnOpen, columnClose, blocked, start) === start
      );

      return freeOffered ?? fromFree;
    },
    [offeredStartsFor, isViewingToday, nowMinutes, occupancy, roomBreaks, timeline]
  );

  const openBookingForSlot = React.useCallback(
    (column: ScheduleColumn, event: React.MouseEvent<HTMLDivElement>, originMinute: number) => {
      const minute = slotMinuteFor(column, rawMinuteFromPointer(event, originMinute));

      const blocked = [
        ...(occupancy.get(column.key) ?? []),
        ...(column.roomId ? roomBreaks.get(column.roomId) ?? [] : []),
        ...column.closedRanges,
      ];
      const columnOpen = column.openMinutes ?? timeline.start;
      const columnClose = column.closeMinutes ?? timeline.end;

      const { ids: candidates, autoSelect } = offeredCandidates(column, minute);

      navigate(
        buildBookingUrl({
          locationId: column.locationId ?? windowData.location_id ?? null,
          date: dateKey(date),
          minute,
          roomId: column.roomId ?? null,
          packageId: autoSelect,
          packageIds: candidates,
          freeUntilMinute: freeUntilMinute(columnOpen, columnClose, blocked, minute),
          walkIn: isViewingToday,
        })
      );
    },
    [navigate, rawMinuteFromPointer, slotMinuteFor, isViewingToday, windowData, date, offeredCandidates, occupancy, roomBreaks, timeline]
  );

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const didAutoScroll = useRef(false);

  useEffect(() => {
    if (loading || didAutoScroll.current || !showNowLine) return;
    const el = scrollRef.current;
    if (!el) return;
    didAutoScroll.current = true;
    el.scrollTop = Math.max(0, (nowMinutes - timeline.start) * timeline.pxPerMinute - el.clientHeight / 3);
  }, [loading, showNowLine, nowMinutes, timeline]);

  const frame = bare ? '' : 'rounded-lg border border-gray-200';

  if (loading) {
    return (
      <div className={`${frame} p-4`}>
        <div className="animate-pulse space-y-2">
          <div className="h-8 rounded bg-gray-200" />
          {[0, 1, 2, 3, 4, 5].map(row => (
            <div key={row} className="flex gap-2">
              <div className="h-10 rounded bg-gray-100" style={{ width: SLOT_COLUMN_WIDTH }} />
              <div className="h-10 flex-1 rounded bg-gray-100" />
              <div className="h-10 flex-1 rounded bg-gray-100" />
              <div className="h-10 flex-1 rounded bg-gray-100" />
            </div>
          ))}
        </div>
        <p className="mt-3 text-center text-xs text-gray-400">
          Loading the schedule for {date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}…
        </p>
      </div>
    );
  }

  if (columns.length === 0) {
    return (
      <div className={`${frame} p-8 text-center text-gray-500`}>
        <p>{rooms.length === 0 ? 'No spaces configured for this location.' : (emptyMessage ?? 'Nothing to show for this day.')}</p>
        {rooms.length === 0 && <p className="mt-2 text-sm">Add spaces in the Spaces section to see the daily schedule.</p>}
      </div>
    );
  }

  const bodyHeight = timeline.total * timeline.pxPerMinute;

  return (
    <div className={bare ? '' : 'rounded-lg border border-gray-200'}>
      {windowData.location_closed && (
        <div className="flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
          <Ban className="h-3.5 w-3.5 shrink-0" />
          This location is closed for the day. Every space below is marked unavailable.
        </div>
      )}

      <div ref={scrollRef} className="overflow-auto" style={{ maxHeight: '70vh' }}>
        <div className="inline-flex min-w-full">
          <div
            className="sticky left-0 z-40 shrink-0 bg-white"
            style={{ width: SLOT_COLUMN_WIDTH, minWidth: SLOT_COLUMN_WIDTH }}
          >
            <div
              className="sticky top-0 z-10 flex items-center justify-center gap-1 border-b border-r border-gray-200 bg-gray-50 px-1 text-xs font-semibold text-gray-700"
              style={{ height: headerHeight }}
            >
              <Clock className="h-3.5 w-3.5" />
              Time
            </div>
            <div className="relative border-r border-gray-200" style={{ height: bodyHeight }}>
              {timeline.slots.map(minutes => (
                <div
                  key={minutes}
                  className="absolute left-0 right-0 flex items-start justify-end pr-2 text-[0.7rem] tabular-nums text-gray-500"
                  style={{ top: (minutes - timeline.start) * timeline.pxPerMinute, height: SLOT_HEIGHT }}
                >
                  <span className={minutes % 60 === 0 ? 'font-semibold text-gray-700' : ''}>
                    {formatSlotLabel(minutes)}
                    {minutes >= MINUTES_PER_DAY ? ' +1' : ''}
                  </span>
                </div>
              ))}
              {showNowLine && (
                <div
                  className="absolute left-0 right-0 z-20 flex items-center justify-end pr-1"
                  style={{ top: (nowMinutes - timeline.start) * timeline.pxPerMinute - 7 }}
                >
                  <span className="rounded bg-red-500 px-1 py-0.5 text-[0.6rem] font-bold text-white">
                    {formatSlotLabel(nowMinutes)}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="flex">
            {columns.map(column => {
              const items = positioned.get(column.key) ?? [];
              const open = column.openMinutes ?? (column.windowKnown && !column.virtual ? null : timeline.start);
              const close = column.closeMinutes ?? (column.windowKnown && !column.virtual ? null : timeline.end);
              const band = column.closedAllDay || !column.bookable ? null : availableBand(open, close, timeline);
              const bookable = Boolean(band) && !isPastDate && column.windowKnown;
              const bandOrigin = Math.max(open ?? timeline.start, timeline.start);
              const freeFrom = freeFromByColumn.get(column.key);

              return (
                <div
                  key={column.key}
                  className="shrink-0 border-r border-gray-200"
                  style={{ width: ROOM_COLUMN_WIDTH, minWidth: ROOM_COLUMN_WIDTH }}
                >
                  <div
                    className={`sticky top-0 z-30 flex flex-col items-center justify-center gap-0.5 border-b border-gray-200 px-1 leading-none ${
                      column.virtual ? 'bg-amber-50 text-amber-800' : 'bg-gray-50 text-gray-700'
                    }`}
                    style={{ height: headerHeight }}
                    title={
                      column.virtual
                        ? `${column.name} — no room assigned`
                        : [
                            column.name,
                            column.locationId && locationNames?.[column.locationId],
                            column.capacity ? `max ${column.capacity}` : null,
                            column.closedAllDay ? column.closedReason ?? 'Closed' : null,
                          ]
                            .filter(Boolean)
                            .join(' · ')
                    }
                  >
                    <span className="w-full truncate text-center text-[11px] font-semibold leading-tight">{column.name}</span>
                    {column.closedAllDay || freeFrom?.kind === 'closed' ? (
                      <span className="flex items-center gap-1 text-[9px] leading-tight font-medium text-gray-500">
                        <Ban className="h-2.5 w-2.5" />
                        {column.closedReason ?? 'Not bookable'}
                      </span>
                    ) : freeFrom?.kind === 'booked' ? (
                      <span className="text-[9px] leading-tight font-medium text-gray-500">Booked until close</span>
                    ) : freeFrom?.kind === 'blocked' ? (
                      <span className="text-[9px] leading-tight font-medium text-gray-500">{freeFrom.reason}</span>
                    ) : freeFrom?.kind === 'day-over' ? (
                      <span className="text-[9px] leading-tight font-medium text-gray-500">Closed for the day</span>
                    ) : freeFrom?.kind === 'free' && isViewingToday && freeFrom.atMinute <= nowMinutes ? (
                      <span className="text-[9px] leading-tight font-semibold text-green-700">Free now</span>
                    ) : freeFrom?.kind === 'free' ? (
                      <span className="text-[9px] leading-tight font-medium text-gray-600">Free {formatSlotLabel(freeFrom.atMinute)}</span>
                    ) : column.virtual ? (
                      <span className="flex items-center gap-1 text-[9px] leading-tight font-normal text-amber-600">
                        <AlertTriangle className="h-2.5 w-2.5" />
                        No room
                      </span>
                    ) : showColumnLocation ? (
                      <span className="flex w-full items-center justify-center gap-1 text-[9px] leading-tight font-normal text-gray-500">
                        <MapPin className="h-2.5 w-2.5 shrink-0" />
                        <span className="truncate">{(column.locationId && locationNames?.[column.locationId]) || 'Unknown'}</span>
                      </span>
                    ) : null}
                  </div>

                  <div className="relative bg-white" style={{ height: bodyHeight }}>
                    {band && !bookable && (
                      <div className="absolute inset-x-0 bg-gray-100" style={band} title={`Available ${formatRange(open as number, close as number)}`} />
                    )}

                    {band && bookable && (
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={event => openBookingForSlot(column, event, bandOrigin)}
                        onMouseMove={event =>
                          setHoverSlot({ key: column.key, minute: slotMinuteFor(column, rawMinuteFromPointer(event, bandOrigin)) })
                        }
                        onMouseLeave={() => setHoverSlot(prev => (prev?.key === column.key ? null : prev))}
                        onKeyDown={event => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            const keyboardMinute = slotMinuteFor(
                              column,
                              isViewingToday ? Math.max(nowMinutes, bandOrigin) : bandOrigin
                            );
                            const keyboardOffer = offeredCandidates(column, keyboardMinute);
                            navigate(
                              buildBookingUrl({
                                locationId: column.locationId ?? windowData.location_id ?? null,
                                date: dateKey(date),
                                minute: keyboardMinute,
                                roomId: column.roomId ?? null,
                                packageId: keyboardOffer.autoSelect,
                                packageIds: keyboardOffer.ids,
                                freeUntilMinute: freeUntilMinute(
                                  open,
                                  close,
                                  [
                                    ...(occupancy.get(column.key) ?? []),
                                    ...(column.roomId ? roomBreaks.get(column.roomId) ?? [] : []),
                                    ...column.closedRanges,
                                  ],
                                  keyboardMinute
                                ),
                                walkIn: isViewingToday,
                              })
                            );
                          }
                        }}
                        className="absolute inset-x-0 cursor-pointer bg-gray-100 transition hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-gray-400"
                        style={band}
                        title={`Available ${formatRange(open as number, close as number)} — click to start a booking`}
                        aria-label={`Start a booking in ${column.name}`}
                      />
                    )}

                    {hoverSlot?.key === column.key && bookable && (
                      <div
                        className="pointer-events-none absolute inset-x-0 z-[5] flex items-center gap-1 border-y border-dashed border-gray-400 bg-white/70 px-1"
                        style={{
                          top: (hoverSlot.minute - timeline.start) * timeline.pxPerMinute,
                          height: Math.max(14, timeline.interval * timeline.pxPerMinute),
                        }}
                      >
                        <Plus className="h-3 w-3 shrink-0 text-gray-600" />
                        <span className="truncate text-[9px] leading-tight font-semibold text-gray-700">
                          {formatSlotLabel(hoverSlot.minute)}
                        </span>
                      </div>
                    )}

                    {column.closedRanges.map((closure, index) => {
                      const closedBand = availableBand(closure.startMinutes, closure.endMinutes, timeline);
                      if (!closedBand) return null;
                      return (
                        <div
                          key={`closed-${index}`}
                          className="pointer-events-none absolute inset-x-0 border-y border-dashed border-red-200 bg-red-50/80"
                          style={closedBand}
                          title={`${closure.reason ?? 'Closed'} ${formatRange(closure.startMinutes, closure.endMinutes)}`}
                        >
                          <span className="block px-1 pt-0.5 text-[0.6rem] font-medium text-red-500">
                            {closure.reason ?? 'Closed'}
                          </span>
                        </div>
                      );
                    })}

                    {(column.roomId ? roomBreaks.get(column.roomId) ?? [] : []).map((brk, index) => {
                      const band = availableBand(brk.startMinutes, brk.endMinutes, timeline);
                      if (!band) return null;
                      return (
                        <div
                          key={`break-${index}`}
                          className="pointer-events-none absolute inset-x-0 border-y border-dashed border-gray-300 bg-white"
                          style={band}
                          title={`Break ${formatRange(brk.startMinutes, brk.endMinutes)}`}
                        >
                          <span className="block px-1 pt-0.5 text-[0.6rem] font-medium text-gray-400">Break</span>
                        </div>
                      );
                    })}

                    {timeline.slots.map(minutes => (
                      <div
                        key={minutes}
                        className={`pointer-events-none absolute inset-x-0 border-t ${minutes % 60 === 0 ? 'border-gray-200' : 'border-gray-100'}`}
                        style={{ top: (minutes - timeline.start) * timeline.pxPerMinute }}
                      />
                    ))}

                    {column.closedAllDay && (
                      <div className="absolute inset-0 flex items-start justify-center bg-gray-50/80 pt-3">
                        <span className="rounded bg-white/90 px-1.5 py-0.5 text-[9px] leading-tight font-medium text-gray-500">
                          {column.closedReason ?? 'Closed'}
                        </span>
                      </div>
                    )}

                    {showNowLine && (
                      <div
                        className="pointer-events-none absolute inset-x-0 z-20 border-t-2 border-red-500"
                        style={{ top: (nowMinutes - timeline.start) * timeline.pxPerMinute }}
                      />
                    )}

                    {items.map(item => {
                      const { top, height } = blockGeometry(item, timeline, MIN_BLOCK_HEIGHT, 2);
                      const widthPercent = 100 / item.laneCount;
                      const tone = STATUS_BG[item.booking.status] ?? 'bg-gray-50 border-gray-400';

                      return (
                        <button
                          key={item.booking.id}
                          type="button"
                          onClick={() => onSelectBooking?.(item.booking)}
                          title={`${customerNameOf(item.booking)} · ${item.booking.package?.name ?? 'No package'} · ${formatRange(item.startMinutes, item.endMinutes)}`}
                          className={`absolute z-10 flex flex-col overflow-hidden rounded border-l-4 px-1.5 py-1 text-left shadow-sm transition hover:z-20 hover:brightness-95 ${tone}`}
                          style={{
                            top,
                            height,
                            left: `calc(${item.lane * widthPercent}% + 2px)`,
                            width: `calc(${widthPercent}% - ${LANE_GAP + 2}px)`,
                          }}
                        >
                          <span className="text-[9px] leading-tight font-bold leading-tight tabular-nums text-gray-700">
                            {formatSlotLabel(item.startMinutes)}–{formatSlotLabel(item.endMinutes)}
                          </span>
                          <span className="truncate text-xs font-semibold leading-tight text-gray-900">
                            {customerNameOf(item.booking)}
                          </span>
                          {height > 52 && (
                            <span className="truncate text-[9px] leading-tight leading-tight text-gray-600">
                              {item.booking.package?.name || 'No package'}
                            </span>
                          )}
                          {height > 72 && (
                            <span className="mt-auto flex items-center justify-between gap-1 pt-0.5 text-[9px] leading-tight">
                              <span className="truncate capitalize text-gray-500">{item.booking.status}</span>
                              <span className={`font-semibold ${resolvePaymentState(item.booking).amountClass}`}>
                                ${parseFloat(String(item.booking.total_amount || 0)).toFixed(2)}
                              </span>
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-gray-100 bg-gray-50 px-3 py-1.5 text-[0.7rem] text-gray-600">
        <span>
          <span className={`font-semibold text-${fullColor}`}>{bookings.length}</span> booking
          {bookings.length === 1 ? '' : 's'} across <span className="font-semibold">{columns.filter(c => !c.virtual).length}</span> space
          {columns.filter(c => !c.virtual).length === 1 ? '' : 's'}
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-3.5 rounded-sm bg-gray-100 ring-1 ring-inset ring-gray-300" aria-hidden="true" />
          Available
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-3.5 rounded-sm border-l-4 border-green-400 bg-green-50" aria-hidden="true" />
          Booked
        </span>
        {!windowData.has_schedule && <span className="text-gray-500">No package schedule for this day — showing a default window.</span>}
      </div>
    </div>
  );
};

export default DayScheduleGrid;
