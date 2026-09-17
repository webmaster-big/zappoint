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
import { buildBookingUrl } from '../../../utils/bookingPrefill';
import BookingHoverCard from './BookingHoverCard';
import BookingNoteBadges from './BookingNoteBadges';
import { noteFlagsOf, noteSummaryOf, guestNoteOf, staffNoteOf } from '../../../utils/bookingNotes';
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
const WALK_IN_STEP_MINUTES = 5;
const SLOT_HEIGHT = 30;
const MIN_BLOCK_HEIGHT = 8;
const LANE_GAP = 2;

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
  conflicts: BookingClash[];
}

/** A real overlap is a double booking; a pair merely closer than the turnaround is only tight. */
interface BookingClash {
  booking: Booking;
  overlapMinutes: number;
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
          // without this a click from the company-wide view reaches the booking page with no
          // location, and the same package name exists at all ten venues
          locationId: entry.location_id ?? undefined,
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
        ? roomWindows.get(booking.room_id)?.interval_minutes ?? 0
        : 0;
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
        conflicts: [],
      });
    }

    // a space stays shut for its turnaround, so a booking starting inside it clashes too
    const turnaroundOf = (roomId?: number | null) =>
      roomId ? roomWindows.get(roomId)?.interval_minutes ?? 0 : 0;

    for (const column of columns) {
      const bucket = map.get(column.key);
      if (!bucket) continue;
      assignLanes(bucket);
      // measured against every booking in this space, not only the ones this grid draws
      const neighbours = (allDayBookings ?? bookings)
        .filter(b => columnKeyFor(b) === column.key)
        .map(b => {
          const startMinutes = startMinutesOf(b);
          return { booking: b, startMinutes, endMinutes: startMinutes + durationMinutesOf(b) };
        });

      for (const item of bucket) {
        item.conflicts = neighbours
          .filter(other =>
            other.booking.id !== item.booking.id &&
            item.startMinutes < other.endMinutes + turnaroundOf(other.booking.room_id) &&
            item.endMinutes + turnaroundOf(item.booking.room_id) > other.startMinutes)
          .map(other => ({
            booking: other.booking,
            overlapMinutes: Math.max(
              0,
              Math.min(item.endMinutes, other.endMinutes) - Math.max(item.startMinutes, other.startMinutes)
            ),
          }));
      }
    }
    return map;
  }, [columns, bookings, allDayBookings, columnKeyFor, roomWindows]);

  /**
   * Every clashing pair today, derived from the live bookings rather than from the blocks this
   * grid happens to draw — a filter that hides both sides of a clash must not hide the clash.
   */
  const overlapSummary = useMemo(() => {
    const rows: { columnName: string; a: Booking; b: Booking; overlapMinutes: number }[] = [];
    const source = allDayBookings ?? bookings;

    for (const column of columns) {
      const turnaroundOf = (roomId?: number | null) =>
        roomId ? roomWindows.get(roomId)?.interval_minutes ?? 0 : 0;

      const inColumn = source
        .filter(b => columnKeyFor(b) === column.key)
        .map(b => {
          const startMinutes = startMinutesOf(b);
          return { booking: b, startMinutes, endMinutes: startMinutes + durationMinutesOf(b) };
        })
        .sort((x, y) => x.startMinutes - y.startMinutes);

      for (let i = 0; i < inColumn.length; i++) {
        for (let j = i + 1; j < inColumn.length; j++) {
          const a = inColumn[i];
          const b = inColumn[j];
          const ta = turnaroundOf(a.booking.room_id);
          const tb = turnaroundOf(b.booking.room_id);
          if (!(a.startMinutes < b.endMinutes + tb && a.endMinutes + ta > b.startMinutes)) continue;

          rows.push({
            columnName: column.name,
            a: a.booking,
            b: b.booking,
            overlapMinutes: Math.max(0, Math.min(a.endMinutes, b.endMinutes) - Math.max(a.startMinutes, b.startMinutes)),
          });
        }
      }
    }

    return rows.sort((x, y) => y.overlapMinutes - x.overlapMinutes);
  }, [columns, allDayBookings, bookings, columnKeyFor, roomWindows]);

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
  const [hoverCard, setHoverCard] = useState<{ bookingId: number; rect: DOMRect } | null>(null);
  const [walkInPrompt, setWalkInPrompt] = useState<{
    column: ScheduleColumn;
    startMinute: number;
    endMinute: number;
    freeFor: number;
    duration: number;
    packageName: string;
    clash: Booking | null;
    areaClash: Booking | null;
  } | null>(null);

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

  /**
   * Every package attached to this space today. A space's own packages define its schedule and
   * interval, so resolve them by space rather than by the clicked minute.
   */
  const packagesForColumn = React.useCallback(
    (column: ScheduleColumn) => {
      if (column.virtual) {
        const id = Number(column.key.replace('pkg-', ''));
        return windowData.packages.filter(entry => entry.package_id === id);
      }

      return column.roomId === undefined
        ? []
        : windowData.packages.filter(entry => entry.room_ids.includes(column.roomId as number));
    },
    [windowData]
  );

  const offeredStartsFor = React.useCallback(
    (column: ScheduleColumn): number[] => {
      const starts = new Set<number>();
      for (const entry of packagesForColumn(column)) {
        for (const start of entry.start_minutes ?? []) starts.add(start);
      }

      return [...starts].sort((a, b) => a - b);
    },
    [packagesForColumn]
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

  /**
   * The package interval is the CUSTOMER's grid — 4:00, 5:00, 6:00 for an hourly package. Staff
   * are not held to it: a walk-in starts when the guests actually walk in, so a click on the
   * admin schedule lands on a 5-minute grid and 4:05 or 4:10 is a perfectly good start.
   */
  const slotMinuteFor = React.useCallback(
    (column: ScheduleColumn, rawMinute: number): number | null => {
      const columnOpen = column.openMinutes ?? timeline.start;
      const columnClose = column.closeMinutes ?? timeline.end;
      const onFive = (minute: number) => Math.round(minute / WALK_IN_STEP_MINUTES) * WALK_IN_STEP_MINUTES;
      const floor = onFive(columnOpen);

      // a booking still has to finish before the space closes, so the last start is a whole package
      // duration back from closing — not five minutes back. Measured inside the column, since
      // rounding up to exactly the closing minute matches no package.
      const startable = new Set(packagesForSlot(column, Math.min(onFive(rawMinute), columnClose - 1)));
      const durations = (windowData.packages ?? [])
        .filter(entry => startable.has(entry.package_id) && (entry.duration_minutes ?? 0) > 0)
        .map(entry => entry.duration_minutes as number);
      const shortest = durations.length > 0 ? Math.min(...durations) : WALK_IN_STEP_MINUTES;
      const ceiling = Math.max(floor, columnClose - shortest);

      const snapped = Math.min(Math.max(onFive(rawMinute), floor), ceiling);

      const blocked = [
        ...(occupancy.get(column.key) ?? []),
        ...(column.roomId ? roomBreaks.get(column.roomId) ?? [] : []),
        ...column.closedRanges,
      ];
      const free = nextFreeMinute(columnOpen, columnClose, blocked, snapped);

      // nothing is free between here and closing — never hand back a minute the grid knows is blocked
      if (free === null) return null;
      if (free === snapped) return snapped;

      const fromFree = Math.ceil(free / WALK_IN_STEP_MINUTES) * WALK_IN_STEP_MINUTES;

      return fromFree > ceiling ? null : fromFree;
    },
    [occupancy, roomBreaks, timeline, packagesForSlot, windowData]
  );

  /** A walk-in runs for the package's duration, so it is only possible if one fits before the next booking. */
  /**
   * How long this space is really bookable from a minute: a booking must also clear the space's
   * turnaround before the next one starts, which is what the server's conflict check enforces.
   */
  const usableFreeUntil = React.useCallback(
    (column: ScheduleColumn, minute: number): number | null => {
      const columnOpen = column.openMinutes ?? timeline.start;
      const columnClose = column.closeMinutes ?? timeline.end;
      const untilBooking = freeUntilMinute(columnOpen, columnClose, occupancy.get(column.key) ?? [], minute);
      const untilHard = freeUntilMinute(
        columnOpen,
        columnClose,
        [...(column.roomId ? roomBreaks.get(column.roomId) ?? [] : []), ...column.closedRanges],
        minute
      );

      if (untilBooking === null || untilHard === null) return null;

      const turnaround = column.roomId
        ? roomWindows.get(column.roomId)?.interval_minutes ?? 0
        : 0;

      // the turnaround is owed to the next BOOKING; a break or closure needs no such gap, and
      // buffering it there would hide starts the booking page still accepts
      const bookingCap =
        untilBooking >= columnClose ? untilBooking : Math.max(minute, untilBooking - turnaround);

      return Math.min(bookingCap, untilHard);
    },
    [occupancy, roomBreaks, roomWindows, timeline]
  );

  /** Spaces in one area group start apart from each other; the server refuses a booking that does not. */
  const areaStaggerClash = React.useCallback(
    (column: ScheduleColumn, minute: number): Booking | null => {
      if (column.roomId === undefined) return null;

      const space = roomWindows.get(column.roomId);
      const gap = space?.stagger_minutes ?? 0;

      if (!space?.area_group || gap <= 0) return null;

      // the server checks the whole group INCLUDING this space, and scopes the group to one venue
      const peers = new Set(
        [...roomWindows.entries()]
          .filter(([, entry]) => entry.area_group === space.area_group && entry.location_id === space.location_id)
          .map(([roomId]) => roomId)
      );

      return (
        (allDayBookings ?? bookings).find(
          booking =>
            booking.room_id != null &&
            peers.has(booking.room_id) &&
            Math.abs(startMinutesOf(booking) - minute) < gap
        ) ?? null
      );
    },
    [roomWindows, allDayBookings, bookings]
  );

  const walkInFit = React.useCallback(
    (column: ScheduleColumn): {
      fits: boolean;
      freeFor: number;
      shortest: number | null;
      packageName: string | null;
      areaClash: Booking | null;
      blockedByClose: boolean;
    } => {
      const columnClose = column.closeMinutes ?? timeline.end;
      const until = usableFreeUntil(column, nowMinutes);
      const freeFor = Math.max(0, (until ?? columnClose) - nowMinutes);

      // only packages the booking page will actually offer at this minute
      const startable = new Set(packagesForSlot(column, nowMinutes));
      const running = (windowData.packages ?? [])
        .filter(entry => startable.has(entry.package_id) && (entry.duration_minutes ?? 0) > 0);
      const candidates = running
        // it must finish inside its OWN schedule; the column closes when its latest package does
        .filter(entry => nowMinutes + (entry.duration_minutes as number) <= entry.close_minutes)
        .sort((a, b) => (a.duration_minutes ?? 0) - (b.duration_minutes ?? 0));
      // something runs here, but nothing short enough to finish before it closes
      const blockedByClose = running.length > 0 && candidates.length === 0;

      const shortestEntry = candidates[0] ?? null;
      const shortest = shortestEntry?.duration_minutes ?? null;
      const walkInMinute = Math.floor(nowMinutes / WALK_IN_STEP_MINUTES) * WALK_IN_STEP_MINUTES;
      const areaClash = areaStaggerClash(column, walkInMinute);

      return {
        fits: shortest !== null && shortest <= freeFor && areaClash === null,
        freeFor,
        shortest,
        packageName: shortestEntry?.name ?? null,
        areaClash,
        blockedByClose,
      };
    },
    [packagesForSlot, windowData, usableFreeUntil, timeline, nowMinutes, areaStaggerClash]
  );

  /** The next minute a booking can actually START here, not just the first unoccupied minute. */
  /**
   * The next minute staff can actually START a booking here. A start only counts if this space is
   * free at it and a package that runs then still fits before the next booking — otherwise the
   * header would advertise a time the booking page goes on to refuse.
   */
  const nextBookableFrom = React.useCallback(
    (column: ScheduleColumn, atMinute: number): number | null => {
      const columnOpen = column.openMinutes ?? timeline.start;
      const columnClose = column.closeMinutes ?? timeline.end;
      const blocked = [
        ...(occupancy.get(column.key) ?? []),
        ...(column.roomId ? roomBreaks.get(column.roomId) ?? [] : []),
        ...column.closedRanges,
      ];

      for (const start of offeredStartsFor(column).filter(candidate => candidate >= atMinute)) {
        // a start that has gone by is still drawn, but it is never the NEXT one
        if (isViewingToday && start < nowMinutes) continue;
        if (nextFreeMinute(columnOpen, columnClose, blocked, start) !== start) continue;

        const startable = new Set(packagesForSlot(column, start));
        const shortest = (windowData.packages ?? [])
          .filter(entry => startable.has(entry.package_id) && (entry.duration_minutes ?? 0) > 0)
          .reduce<number | null>((best, entry) => {
            const minutes = entry.duration_minutes ?? 0;
            return best === null || minutes < best ? minutes : best;
          }, null);

        if (shortest === null) continue;

        const until = usableFreeUntil(column, start);
        if (until !== null && start + shortest > until) continue;

        return start;
      }

      return null;
    },
    [offeredStartsFor, packagesForSlot, windowData, usableFreeUntil, occupancy, roomBreaks, timeline]
  );

  const goToBooking = React.useCallback(
    (column: ScheduleColumn, minute: number, options?: { walkInOverride?: boolean }) => {
      const { ids: candidates, autoSelect } = offeredCandidates(column, minute);
      // availability stops offering a start once it has gone by, so a deliberate click on an earlier
      // slot today has to carry the same override the walk-in warning uses
      const alreadyStarted = isViewingToday && minute < nowMinutes;
      // the customer grid does not contain 4:05, so the booking page has to be told to keep it
      const offCustomerGrid = !offeredStartsFor(column).includes(minute);

      navigate(
        buildBookingUrl({
          locationId: column.locationId ?? windowData.location_id ?? null,
          date: dateKey(date),
          minute,
          roomId: column.roomId ?? null,
          packageId: autoSelect,
          packageIds: candidates,
          freeUntilMinute: usableFreeUntil(column, minute),
          // the raw start of the next booking, so an overlap can be stated truthfully
          nextBookingMinute: (() => {
            const starts = (occupancy.get(column.key) ?? [])
              .filter(range => range.endMinutes > minute)
              .map(range => range.startMinutes);

            return starts.length > 0 ? Math.min(...starts) : null;
          })(),
          walkIn: isViewingToday || offCustomerGrid,
          walkInOverride: (options?.walkInOverride ?? false) || alreadyStarted,
        })
      );
    },
    [navigate, isViewingToday, windowData, date, offeredCandidates, usableFreeUntil, occupancy, offeredStartsFor, nowMinutes]
  );

  /** A walk-in that runs past the next booking is staff's call to make, but never a silent one. */
  const startWalkIn = React.useCallback(
    (column: ScheduleColumn) => {
      const fit = walkInFit(column);
      // a walk-in records when the guests actually go in, on a 5-minute grid
      const walkInMinute = Math.floor(nowMinutes / WALK_IN_STEP_MINUTES) * WALK_IN_STEP_MINUTES;

      if (fit.fits || (fit.shortest === null && fit.areaClash === null && !fit.blockedByClose)) {
        goToBooking(column, walkInMinute);
        return;
      }

      const endMinute = walkInMinute + (fit.shortest ?? 0);
      const clash = (allDayBookings ?? bookings)
        .filter(b => columnKeyFor(b) === column.key)
        .map(b => ({ booking: b, start: startMinutesOf(b) }))
        .filter(({ start }) => start >= walkInMinute && start < endMinute)
        .sort((a, b) => a.start - b.start)[0]?.booking ?? null;

      setWalkInPrompt({
        column,
        startMinute: walkInMinute,
        endMinute,
        freeFor: fit.freeFor,
        duration: fit.shortest ?? 0,
        packageName: fit.packageName ?? 'the shortest package here',
        clash,
        areaClash: fit.areaClash,
      });
    },
    [walkInFit, goToBooking, nowMinutes, allDayBookings, bookings, columnKeyFor]
  );

  const openBookingForSlot = React.useCallback(
    (column: ScheduleColumn, event: React.MouseEvent<HTMLDivElement>, originMinute: number) => {
      const minute = slotMinuteFor(column, rawMinuteFromPointer(event, originMinute));
      if (minute !== null) goToBooking(column, minute);
    },
    [goToBooking, slotMinuteFor, rawMinuteFromPointer]
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

      {overlapSummary.length > 0 && (() => {
        const doubleBooked = overlapSummary.filter(row => row.overlapMinutes > 0);
        const backToBack = overlapSummary.filter(row => row.overlapMinutes === 0);
        const tone = doubleBooked.length > 0;

        return (
          <div
            className={`flex items-start gap-2 border-b px-3 py-2 text-xs ${
              tone ? 'border-rose-200 bg-rose-50' : 'border-amber-200 bg-amber-50'
            }`}
          >
            <AlertTriangle className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${tone ? 'text-rose-600' : 'text-amber-600'}`} />
            <div className="min-w-0 flex-1">
              <p className={`font-semibold ${tone ? 'text-rose-900' : 'text-amber-900'}`}>
                {doubleBooked.length > 0 && <>{doubleBooked.length} double-booked {doubleBooked.length === 1 ? 'space' : 'spaces'}</>}
                {doubleBooked.length > 0 && backToBack.length > 0 && ' · '}
                {backToBack.length > 0 && <>{backToBack.length} back-to-back with no turnaround</>}
              </p>
              <ul className={`mt-0.5 max-h-24 space-y-0.5 overflow-y-auto pr-1 ${tone ? 'text-rose-800' : 'text-amber-800'}`}>
                {overlapSummary.map(row => (
                  <li key={`${row.a.id}-${row.b.id}`} className="break-words">
                    <span className="font-medium">{row.columnName}</span>: {customerNameOf(row.a)} at{' '}
                    {formatSlotLabel(startMinutesOf(row.a))}{' '}
                    {row.overlapMinutes > 0
                      ? `overlaps ${customerNameOf(row.b)} at ${formatSlotLabel(startMinutesOf(row.b))} by ${row.overlapMinutes} min`
                      : `ends as ${customerNameOf(row.b)} starts at ${formatSlotLabel(startMinutesOf(row.b))} — no time to reset the space`}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        );
      })()}

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
                      (() => {
                        const fit = walkInFit(column);
                        return (
                          <button
                            type="button"
                            onClick={event => {
                              event.stopPropagation();
                              startWalkIn(column);
                            }}
                            title={
                              fit.fits
                                ? `Start a walk-in in ${column.name} at ${formatSlotLabel(nowMinutes)} — ${fit.freeFor} min free`
                                : `Only ${fit.freeFor} min free before the next booking${fit.shortest ? `, and the shortest package here needs ${fit.shortest} min` : ''}`
                            }
                            className={`rounded px-1 text-[9px] font-semibold leading-tight transition focus:outline-none focus:ring-2 ${
                              fit.fits
                                ? 'text-green-700 hover:bg-green-50 hover:text-green-800 focus:ring-green-400'
                                : 'text-amber-700 hover:bg-amber-50 hover:text-amber-800 focus:ring-amber-400'
                            }`}
                          >
                            {fit.fits ? 'Free now · walk-in' : `Free ${fit.freeFor} min · walk-in`}
                          </button>
                        );
                      })()
                    ) : freeFrom?.kind === 'free' ? (
                      (() => {
                        const nextStart = nextBookableFrom(column, freeFrom.atMinute);

                        return nextStart === null ? (
                          <span className="text-[9px] leading-tight font-medium text-gray-500">No more starts today</span>
                        ) : (
                          <span className="text-[9px] leading-tight font-medium text-gray-600">
                            Free {formatSlotLabel(nextStart)}
                          </span>
                        );
                      })()
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
                          setHoverSlot(
                            (() => {
                              const minute = slotMinuteFor(column, rawMinuteFromPointer(event, bandOrigin));
                              return minute === null ? null : { key: column.key, minute };
                            })()
                          )
                        }
                        onMouseLeave={() => setHoverSlot(prev => (prev?.key === column.key ? null : prev))}
                        onKeyDown={event => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            // the same path as a click, so the keyboard cannot drop the override
                            // or the off-grid flag the mouse gets
                            const minute = slotMinuteFor(
                              column,
                              isViewingToday ? Math.max(nowMinutes, bandOrigin) : bandOrigin
                            );
                            if (minute !== null) goToBooking(column, minute);
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
                          className="pointer-events-none absolute inset-x-0 z-[4] border-y border-dashed border-gray-400 bg-gray-300/70"
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
                      <div className="absolute inset-0 z-[6] flex items-start justify-center bg-gray-300/70 pt-3">
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
                      const turnaround = item.booking.room_id
                        ? roomWindows.get(item.booking.room_id)?.interval_minutes ?? 0
                        : 0;
                      if (turnaround <= 0) return null;
                      const strip = availableBand(item.endMinutes, item.endMinutes + turnaround, timeline);
                      if (!strip) return null;

                      return (
                        <div
                          key={`turnaround-${item.booking.id}`}
                          className="pointer-events-none absolute inset-x-0 z-[3] border-y border-amber-200 bg-amber-100/70"
                          style={strip}
                          title={`Resetting ${column.name} — free again at ${formatSlotLabel(item.endMinutes + turnaround)}`}
                        />
                      );
                    })}

                    {items.map(item => {
                      const { top, height } = blockGeometry(item, timeline, MIN_BLOCK_HEIGHT, 2);
                      const widthPercent = 100 / item.laneCount;
                      const tone = STATUS_BG[item.booking.status] ?? 'bg-gray-50 border-gray-400';
                      const noteFlags = noteFlagsOf(item.booking);
                      const noteSummary = noteSummaryOf(item.booking);
                      const doubleBooked = item.conflicts.some(clash => clash.overlapMinutes > 0);
                      const clashing = item.conflicts.length > 0;
                      const overlapLabel = item.conflicts
                        .map(clash =>
                          `${customerNameOf(clash.booking)} at ${formatSlotLabel(startMinutesOf(clash.booking))}` +
                          (clash.overlapMinutes > 0 ? ` (${clash.overlapMinutes} min over)` : ' (no gap between them)')
                        )
                        .join(', ');

                      return (
                        <button
                          key={item.booking.id}
                          type="button"
                          onClick={() => onSelectBooking?.(item.booking)}
                          aria-label={[
                            customerNameOf(item.booking),
                            item.booking.package?.name ?? 'No package',
                            formatRange(item.startMinutes, item.endMinutes),
                            clashing ? `${doubleBooked ? 'OVERLAPS' : 'NO TURNAROUND'}: ${overlapLabel}` : null,
                            noteSummary,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                          onMouseEnter={event => setHoverCard({ bookingId: item.booking.id, rect: event.currentTarget.getBoundingClientRect() })}
                          onMouseLeave={() => setHoverCard(current => (current?.bookingId === item.booking.id ? null : current))}
                          onFocus={event => setHoverCard({ bookingId: item.booking.id, rect: event.currentTarget.getBoundingClientRect() })}
                          onBlur={() => setHoverCard(current => (current?.bookingId === item.booking.id ? null : current))}
                          className={`absolute z-10 flex flex-col overflow-hidden rounded border-l-4 px-1.5 text-left shadow-sm transition hover:z-20 hover:shadow-lg hover:brightness-95 ${
                            height < 30 ? 'py-0.5' : 'py-1'
                          } ${tone} ${
                            doubleBooked ? 'ring-2 ring-rose-500' : clashing ? 'ring-2 ring-amber-400' : ''
                          }`}
                          style={{
                            top,
                            height,
                            left: `calc(${item.lane * widthPercent}% + 2px)`,
                            width: `calc(${widthPercent}% - ${LANE_GAP + 2}px)`,
                          }}
                        >
                          {/* one rail in the corner: siblings, so nothing can paint over anything else */}
                          {(clashing || noteFlags.guest || noteFlags.staff) && (
                            <span className="absolute top-0 right-0 z-20 flex items-center gap-px rounded-bl bg-white/80 pl-px">
                              <BookingNoteBadges flags={noteFlags} height={height} />
                              {clashing && (
                                <span
                                  className={`flex items-center gap-0.5 rounded-bl px-1 py-px text-[8px] font-bold uppercase leading-tight text-white ${
                                    doubleBooked ? 'bg-rose-500' : 'bg-amber-500'
                                  }`}
                                >
                                  <AlertTriangle className="h-2 w-2 shrink-0" />
                                  {height >= 18 && !noteFlags.guest && !noteFlags.staff
                                    ? doubleBooked
                                      ? 'Overlap'
                                      : 'No gap'
                                    : null}
                                </span>
                              )}
                            </span>
                          )}

                          <span className="flex h-full min-w-0 flex-col">
                            {height < 30 ? (
                              // two tight lines: who and when, then what they booked
                              <>
                                <span className="flex min-w-0 items-baseline gap-1 text-[10px] leading-none">
                                  <span className="shrink-0 font-bold tabular-nums text-gray-700">
                                    {formatSlotLabel(item.startMinutes)}
                                  </span>
                                  <span className="truncate font-semibold text-gray-900">
                                    {customerNameOf(item.booking)}
                                  </span>
                                </span>
                                <span className="mt-px truncate text-[9px] leading-none text-gray-600">
                                  {item.booking.package?.name || 'No package'}
                                </span>
                              </>
                            ) : (
                              <>
                                <span className="truncate text-[9px] leading-tight font-bold tabular-nums text-gray-700">
                                  {formatSlotLabel(item.startMinutes)}–{formatSlotLabel(item.endMinutes)}
                                </span>
                                <span className="truncate text-xs font-semibold leading-tight text-gray-900">
                                  {customerNameOf(item.booking)}
                                </span>
                                <span className="truncate text-[9px] leading-tight text-gray-600">
                                  {item.booking.package?.name || 'No package'}
                                </span>
                                {height >= 60 && (
                                  <span className="truncate text-[9px] leading-tight text-gray-600">
                                    {item.booking.participants} {item.booking.participants === 1 ? 'guest' : 'guests'}
                                  </span>
                                )}
                                {height >= 74 && (
                                  <span className="mt-auto flex items-center justify-between gap-1 pt-0.5 text-[9px] leading-tight">
                                    <span className="truncate capitalize text-gray-500">{item.booking.status}</span>
                                    <span className={`font-semibold ${resolvePaymentState(item.booking).amountClass}`}>
                                      ${parseFloat(String(item.booking.total_amount || 0)).toFixed(2)}
                                    </span>
                                  </span>
                                )}
                              </>
                            )}
                          </span>
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

      {hoverCard && (() => {
        // looked up fresh so a re-render (the clock ticks every minute) cannot strand the card
        const item = [...positioned.values()].flat().find(entry => entry.booking.id === hoverCard.bookingId);
        if (!item) return null;

        const hovered = item.booking;
        const payment = resolvePaymentState(hovered);

        return (
          <BookingHoverCard
            anchor={hoverCard.rect}
            guestName={customerNameOf(hovered)}
            timeLabel={formatRange(item.startMinutes, item.endMinutes)}
            packageName={hovered.package?.name || 'No package'}
            participants={hovered.participants}
            amount={parseFloat(String(hovered.total_amount || 0))}
            paymentLabel={payment.label}
            paymentClass={payment.pillClass}
            status={hovered.status}
            reference={hovered.reference_number}
            overlapLabel={
              item.conflicts.length > 0
                ? item.conflicts
                    .map(clash =>
                      `${customerNameOf(clash.booking)} at ${formatSlotLabel(startMinutesOf(clash.booking))}` +
                      (clash.overlapMinutes > 0 ? ` (${clash.overlapMinutes} min over)` : ' (no gap between them)')
                    )
                    .join(', ')
                : null
            }
            overlapTitle={item.conflicts.some(clash => clash.overlapMinutes > 0) ? 'Overlaps' : 'No turnaround'}
            overlapTone={item.conflicts.some(clash => clash.overlapMinutes > 0) ? 'overlap' : 'tight'}
            guestNote={guestNoteOf(hovered)}
            staffNote={staffNoteOf(hovered)}
          />
        );
      })()}

      {walkInPrompt && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setWalkInPrompt(null)}
        >
          <div className="w-full max-w-md rounded-lg bg-white shadow-lg" onClick={event => event.stopPropagation()}>
            <div className="p-6">
              <div className="mb-4 flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-6 w-6 shrink-0 text-amber-500" />
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {walkInPrompt.areaClash
                      ? 'Another space nearby starts too close to this'
                      : walkInPrompt.duration === 0
                        ? 'Nothing here can finish before closing'
                        : 'This walk-in runs past the next booking'}
                  </h3>
                  <p className="mt-1 text-sm text-gray-600">
                    {walkInPrompt.areaClash ? (
                      <>
                        {walkInPrompt.column.name} shares an area with a space that already starts at{' '}
                        {formatSlotLabel(startMinutesOf(walkInPrompt.areaClash))}. They have to start far enough apart
                        for staff to run both.
                      </>
                    ) : walkInPrompt.duration === 0 ? (
                      <>
                        Every package in {walkInPrompt.column.name} would still be running when it closes, so none of
                        them can be started now.
                      </>
                    ) : (
                      <>
                        {walkInPrompt.column.name} is free for {walkInPrompt.freeFor} min, but {walkInPrompt.packageName}{' '}
                        needs {walkInPrompt.duration} min.
                      </>
                    )}
                  </p>
                </div>
              </div>

              <dl className="mb-3 divide-y divide-gray-200 rounded-lg border border-gray-200 text-sm">
                <div className="flex justify-between gap-4 px-3 py-2">
                  <dt className="text-gray-500">Walk-in would run</dt>
                  <dd className="font-medium text-gray-900">
                    {formatSlotLabel(walkInPrompt.startMinute)} – {formatSlotLabel(walkInPrompt.endMinute)}
                  </dd>
                </div>
                <div className="flex justify-between gap-4 px-3 py-2">
                  <dt className="text-gray-500">Space is free for</dt>
                  <dd className="font-medium text-gray-900">{walkInPrompt.freeFor} min</dd>
                </div>
                <div className="flex justify-between gap-4 px-3 py-2">
                  <dt className="text-gray-500">Overlap</dt>
                  <dd className="font-semibold text-amber-700">{walkInPrompt.duration - walkInPrompt.freeFor} min</dd>
                </div>
              </dl>

              {walkInPrompt.clash && (
                <dl className="mb-4 divide-y divide-amber-200 rounded-lg border border-amber-200 bg-amber-50 text-sm">
                  <div className="flex justify-between gap-4 px-3 py-2">
                    <dt className="text-amber-800">Clashes with</dt>
                    <dd className="font-semibold text-amber-900">{customerNameOf(walkInPrompt.clash)}</dd>
                  </div>
                  <div className="flex justify-between gap-4 px-3 py-2">
                    <dt className="text-amber-800">Their booking</dt>
                    <dd className="font-medium text-amber-900">
                      {formatSlotLabel(startMinutesOf(walkInPrompt.clash))} ·{' '}
                      {walkInPrompt.clash.package?.name || 'No package'}
                    </dd>
                  </div>
                </dl>
              )}

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setWalkInPrompt(null)}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const target = walkInPrompt;
                    setWalkInPrompt(null);
                    goToBooking(target.column, target.startMinute, { walkInOverride: true });
                  }}
                  className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700"
                >
                  Start anyway
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DayScheduleGrid;
