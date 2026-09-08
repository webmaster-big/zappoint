import React, { useEffect, useMemo, useState } from 'react';
import { Clock, Users, AlertTriangle, MapPin } from 'lucide-react';
import type { Booking } from '../../../services/bookingService';
import type { Room } from '../../../services/RoomService';
import { customerNameOf } from '../../../utils/bookingSearch';
import { getMichiganNow, michiganToday, dateKey } from '../../../utils/timeFormat';

const SLOT_MINUTES = 15;
const ROW_HEIGHT = 44;
const MINUTES_PER_DAY = 24 * 60;

export const SLOT_COLUMN_WIDTH = 76;
export const ROOM_COLUMN_WIDTH = 132;

interface TimeSlot {
  label: string;
  minutes: number;
}

interface ScheduleColumn {
  key: string;
  name: string;
  capacity?: number | null;
  roomId?: number;
  locationId?: number;
  virtual: boolean;
}

interface Cell {
  bookings: Booking[];
  rowSpan: number;
}

interface DayScheduleGridProps {
  date: Date;
  rooms: Room[];
  bookings: Booking[];
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
  confirmed: 'bg-green-50 border-green-300',
  pending: 'bg-yellow-50 border-yellow-300',
  'checked-in': 'bg-blue-50 border-blue-300',
  completed: 'bg-gray-50 border-gray-300',
  cancelled: 'bg-red-50 border-red-300',
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
  const hour24 = Math.floor(minutes / 60) % 24;
  const minute = minutes % 60;
  const hour = hour24 % 12 || 12;
  const meridiem = hour24 >= 12 ? 'PM' : 'AM';
  return `${hour}:${String(minute).padStart(2, '0')} ${meridiem}`;
};

const formatRange = (start: number, end: number): string => `${formatSlotLabel(start)} – ${formatSlotLabel(end)}`;

const DayScheduleGrid: React.FC<DayScheduleGridProps> = ({
  date,
  rooms,
  bookings,
  hideEmptySpaces = true,
  loading = false,
  locationNames,
  bare = false,
  onSelectBooking,
  emptyMessage,
  themeColor = 'blue',
  fullColor = 'blue-600',
}) => {
  const knownRoomIds = useMemo(() => new Set(rooms.map(room => room.id)), [rooms]);

  const columnKeyFor = React.useCallback(
    (booking: Booking): string => {
      if (booking.room_id && knownRoomIds.has(booking.room_id)) return `room-${booking.room_id}`;
      return booking.package_id ? `pkg-${booking.package_id}` : 'unassigned';
    },
    [knownRoomIds]
  );

  const columns = useMemo<ScheduleColumn[]>(() => {
    const counts = new Map<string, number>();
    for (const booking of bookings) {
      const key = columnKeyFor(booking);
      counts.set(key, (counts.get(key) || 0) + 1);
    }

    const roomColumns = rooms
      .filter(room => !hideEmptySpaces || (counts.get(`room-${room.id}`) || 0) > 0)
      .map<ScheduleColumn>(room => ({
        key: `room-${room.id}`,
        name: room.name,
        capacity: room.capacity,
        roomId: room.id,
        locationId: room.location_id,
        virtual: false,
      }));

    const virtualMap = new Map<string, ScheduleColumn>();
    for (const booking of bookings) {
      const key = columnKeyFor(booking);
      if (key.startsWith('room-')) continue;
      if (!virtualMap.has(key)) {
        virtualMap.set(key, { key, name: booking.package?.name || 'Unassigned', virtual: true });
      }
    }
    const virtualColumns = [...virtualMap.values()].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    );

    return [...roomColumns, ...virtualColumns];
  }, [rooms, bookings, hideEmptySpaces, columnKeyFor]);

  const slots = useMemo<TimeSlot[]>(() => {
    if (bookings.length === 0) return [];

    const covered = new Set<number>();
    for (const booking of bookings) {
      const start = startMinutesOf(booking);
      const end = start + durationMinutesOf(booking);
      const first = Math.floor(start / SLOT_MINUTES) * SLOT_MINUTES;
      for (let minutes = first; minutes < end; minutes += SLOT_MINUTES) covered.add(minutes);
    }

    return [...covered]
      .sort((a, b) => a - b)
      .map(minutes => ({ minutes, label: formatSlotLabel(minutes) }));
  }, [bookings]);

  const layout = useMemo(() => {
    const map = new Map<string, Map<number, Cell>>();
    const suppressed = new Set<string>();

    for (const column of columns) {
      const columnBookings = bookings
        .filter(booking => columnKeyFor(booking) === column.key)
        .sort((a, b) => startMinutesOf(a) - startMinutesOf(b));

      const anchored = new Map<number, Booking[]>();
      for (const booking of columnBookings) {
        const start = startMinutesOf(booking);
        let index = -1;
        for (let i = 0; i < slots.length; i += 1) {
          if (slots[i].minutes <= start) index = i;
          else break;
        }
        if (index < 0) index = 0;
        const bucket = anchored.get(index);
        if (bucket) bucket.push(booking);
        else anchored.set(index, [booking]);
      }

      const cells = new Map<number, Cell>();
      let index = 0;
      while (index < slots.length) {
        const group = anchored.get(index);
        if (!group || group.length === 0) {
          index += 1;
          continue;
        }

        const absorbed = [...group];
        let end = Math.max(...group.map(booking => startMinutesOf(booking) + durationMinutesOf(booking)));
        let next = index + 1;
        while (next < slots.length && slots[next].minutes < end) {
          const extra = anchored.get(next);
          if (extra) {
            for (const booking of extra) {
              absorbed.push(booking);
              end = Math.max(end, startMinutesOf(booking) + durationMinutesOf(booking));
            }
          }
          suppressed.add(`${column.key}:${next}`);
          next += 1;
        }

        cells.set(index, { bookings: absorbed, rowSpan: next - index });
        index = next;
      }

      map.set(column.key, cells);
    }

    return { map, suppressed };
  }, [columns, bookings, slots, columnKeyFor]);

  const showColumnLocation = useMemo(() => {
    if (!locationNames) return false;
    const ids = new Set(columns.filter(column => !column.virtual).map(column => column.locationId));
    return ids.size > 1;
  }, [locationNames, columns]);

  const [nowTick, setNowTick] = useState(() => getMichiganNow());

  const isViewingToday = dateKey(date) === dateKey(michiganToday());

  useEffect(() => {
    if (!isViewingToday) return;
    const tick = () => setNowTick(getMichiganNow());
    const timer = window.setInterval(tick, 60000);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [isViewingToday]);

  const nowMinutes = nowTick.hour * 60 + nowTick.minute;

  const nowMarker = useMemo(() => {
    if (!isViewingToday || slots.length === 0) return { index: -1, exact: false };
    const exact = slots.findIndex(slot => nowMinutes >= slot.minutes && nowMinutes < slot.minutes + SLOT_MINUTES);
    if (exact !== -1) return { index: exact, exact: true };
    const next = slots.findIndex(slot => slot.minutes > nowMinutes);
    return { index: next, exact: false };
  }, [isViewingToday, slots, nowMinutes]);

  const hiddenSpaceCount = useMemo(() => {
    if (!hideEmptySpaces) return 0;
    const shown = columns.filter(column => !column.virtual).length;
    return Math.max(0, rooms.length - shown);
  }, [hideEmptySpaces, columns, rooms.length]);

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

  if (rooms.length === 0 && columns.length === 0) {
    return (
      <div className={`${frame} p-8 text-center text-gray-500`}>
        <p>No spaces configured for this location.</p>
        <p className="mt-2 text-sm">Add spaces in the Spaces section to see the daily schedule.</p>
      </div>
    );
  }

  if (slots.length === 0 || columns.length === 0) {
    return (
      <div className={`${frame} p-8 text-center text-gray-500`}>
        <p>
          {emptyMessage ??
            `No bookings for ${date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}.`}
        </p>
      </div>
    );
  }

  return (
    <div className={bare ? 'overflow-x-auto' : 'overflow-x-auto rounded-lg border border-gray-200'}>
      <table className="border-collapse" style={{ minWidth: '100%' }}>
        <thead>
          <tr className="border-b-2 border-gray-200 bg-gray-50">
            <th
              className="sticky left-0 z-20 border-r border-gray-200 bg-gray-50 px-2 py-2 text-left text-xs font-semibold text-gray-700"
              style={{ width: SLOT_COLUMN_WIDTH, minWidth: SLOT_COLUMN_WIDTH }}
            >
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                Time
              </span>
            </th>
            {columns.map(column => (
              <th
                key={column.key}
                className={`border-r border-gray-200 px-1.5 py-2 text-center text-xs font-semibold ${
                  column.virtual ? 'bg-amber-50 text-amber-800' : 'text-gray-700'
                }`}
                style={{ width: ROOM_COLUMN_WIDTH, minWidth: ROOM_COLUMN_WIDTH, maxWidth: ROOM_COLUMN_WIDTH }}
                title={
                  column.virtual
                    ? `${column.name} — no room assigned`
                    : [
                        column.name,
                        column.locationId && locationNames?.[column.locationId],
                        column.capacity ? `max ${column.capacity}` : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')
                }
              >
                <div className="flex flex-col items-center gap-0.5">
                  <span className="w-full truncate leading-tight">{column.name}</span>
                  {column.virtual ? (
                    <span className="flex items-center gap-1 text-[0.65rem] font-normal text-amber-600">
                      <AlertTriangle className="h-2.5 w-2.5" />
                      No room
                    </span>
                  ) : showColumnLocation ? (
                    <span className="flex w-full items-center justify-center gap-1 text-[0.65rem] font-normal text-gray-500">
                      <MapPin className="h-2.5 w-2.5 shrink-0" />
                      <span className="truncate">
                        {(column.locationId && locationNames?.[column.locationId]) || 'Unknown'}
                      </span>
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[0.65rem] font-normal text-gray-500">
                      <Users className="h-2.5 w-2.5" />
                      {column.capacity ? `Max ${column.capacity}` : 'No max'}
                    </span>
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {slots.map((slot, slotIndex) => (
            <tr
              key={slot.minutes}
              className={
                slotIndex === nowMarker.index
                  ? 'border-b border-gray-100 border-t-2 border-t-red-500'
                  : 'border-b border-gray-100'
              }
              title={
                slotIndex === nowMarker.index
                  ? nowMarker.exact
                    ? 'Now'
                    : 'Everything above this line is in the past'
                  : undefined
              }
            >
              <td
                className={`sticky left-0 z-10 border-r border-gray-200 bg-white px-2 py-1 text-xs font-medium ${
                  slotIndex === nowMarker.index && nowMarker.exact ? 'text-red-600' : 'text-gray-600'
                }`}
                style={{ height: ROW_HEIGHT, width: SLOT_COLUMN_WIDTH, minWidth: SLOT_COLUMN_WIDTH }}
              >
                {slotIndex === nowMarker.index && nowMarker.exact ? (
                  <span className="flex items-center gap-1">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" aria-hidden="true" />
                    <span className="sr-only">Current time: </span>
                    {slot.label}
                  </span>
                ) : (
                  <span className="flex items-center gap-1">
                    {slot.label}
                    {slot.minutes >= MINUTES_PER_DAY && (
                      <span className="rounded bg-gray-100 px-1 text-[0.6rem] text-gray-500" title="Next day">
                        +1
                      </span>
                    )}
                  </span>
                )}
              </td>
              {columns.map(column => {
                if (layout.suppressed.has(`${column.key}:${slotIndex}`)) return null;

                const cell = layout.map.get(column.key)?.get(slotIndex);
                if (!cell) {
                  return (
                    <td
                      key={column.key}
                      className={`border-r border-gray-200 text-center text-xs text-gray-300 ${
                        column.virtual ? 'bg-amber-50/40' : `hover:bg-${themeColor}-50`
                      }`}
                      style={{ height: ROW_HEIGHT, width: ROOM_COLUMN_WIDTH, minWidth: ROOM_COLUMN_WIDTH }}
                    >
                      —
                    </td>
                  );
                }

                return (
                  <td
                    key={column.key}
                    rowSpan={cell.rowSpan}
                    className="border-r border-gray-200 p-1 align-top"
                    style={{ width: ROOM_COLUMN_WIDTH, minWidth: ROOM_COLUMN_WIDTH }}
                  >
                    <div className="flex h-full flex-col gap-1">
                      {cell.bookings.map(booking => {
                        const start = startMinutesOf(booking);
                        const end = start + durationMinutesOf(booking);
                        const tone = STATUS_BG[booking.status] ?? 'bg-gray-50 border-gray-300';
                        return (
                          <button
                            key={booking.id}
                            type="button"
                            onClick={() => onSelectBooking?.(booking)}
                            title={`${customerNameOf(booking)} · ${booking.package?.name ?? 'No package'} · ${formatRange(start, end)}`}
                            className={`flex min-h-0 flex-1 flex-col rounded border-l-2 px-1.5 py-1 text-left transition hover:brightness-95 ${tone}`}
                          >
                            <span className="text-[0.65rem] font-bold leading-tight text-gray-700 tabular-nums">
                              {formatSlotLabel(start)}–{formatSlotLabel(end)}
                            </span>
                            <span className="truncate text-xs font-semibold leading-tight text-gray-900">
                              {customerNameOf(booking)}
                            </span>
                            <span className="truncate text-[0.65rem] leading-tight text-gray-600">
                              {booking.package?.name || 'No package'}
                            </span>
                            <span className="mt-auto flex items-center justify-between gap-1 pt-0.5 text-[0.65rem]">
                              <span className="truncate capitalize text-gray-500">{booking.status}</span>
                              <span
                                className={`font-semibold ${
                                  booking.payment_status === 'paid'
                                    ? 'text-green-700'
                                    : booking.payment_status === 'partial'
                                      ? 'text-yellow-700'
                                      : 'text-red-700'
                                }`}
                              >
                                ${parseFloat(String(booking.total_amount || 0)).toFixed(2)}
                              </span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className={`border-t border-gray-100 bg-gray-50 px-3 py-1.5 text-[0.7rem] text-gray-600`}>
        <span className={`font-semibold text-${fullColor}`}>{bookings.length}</span> booking
        {bookings.length === 1 ? '' : 's'} across <span className="font-semibold">{columns.length}</span> column
        {columns.length === 1 ? '' : 's'}
        {hiddenSpaceCount > 0 ? ` · ${hiddenSpaceCount} empty space${hiddenSpaceCount === 1 ? '' : 's'} hidden` : ''}
      </div>
    </div>
  );
};

export default DayScheduleGrid;
