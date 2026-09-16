import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Calendar, ChevronLeft, ChevronRight, Clock, Users, Package as PackageIcon, X, Coffee, Info, Loader2, Eye, EyeOff, Edit, LogIn, CheckCircle, FileText, Save, DollarSign, Search, RotateCw, LocateFixed, Plus, ZoomIn, ZoomOut, AlertCircle } from 'lucide-react';
import { useThemeColor } from '../../../hooks/useThemeColor';
import { useLocationScope } from '../../../contexts/LocationContext';
import CustomerSearch from '../../../components/admin/calendar/CustomerSearch';
import { matchesBookingSearch } from '../../../utils/bookingSearch';
import bookingService from '../../../services/bookingService';
import { bookingCacheService } from '../../../services/BookingCacheService';
import { createPayment, PAYMENT_TYPE } from '../../../services/PaymentService';
import { roomService } from '../../../services/RoomService';
import { roomCacheService } from '../../../services/RoomCacheService';
import { dayOffService, type DayOff } from '../../../services/DayOffService';
import { getStoredUser } from '../../../utils/storage';
import StandardButton from '../../../components/ui/StandardButton';
import CategoryTabs from '../../../components/admin/CategoryTabs';
import { formatDurationDisplay, getMichiganNow } from '../../../utils/timeFormat';
import { normalizeCategory } from '../../../utils/venueCategories';
import type { Booking } from '../../../services/bookingService';
import type { Room } from '../../../services/RoomService';
import { resolvePaymentState } from '../../../types/Bookings.types';
import { useScheduleDayWindow } from '../../../components/admin/calendar/useDayScheduleView';
import { cardFromPayments } from '../../../utils/cardLabel';
import type { FreeState, TimeRange } from '../../../utils/scheduleGeometry';
import { freeState, freeUntilMinute, minuteAtOffset, nextFreeMinute } from '../../../utils/scheduleGeometry';
import { buildBookingUrl, snapToInterval, snapToOfferedStart } from '../../../utils/bookingPrefill';
import { DEFAULT_SLOT_CLEANUP_MINUTES } from '../../../utils/timeSlots';

const parseLocalDate = (isoDateString: string): Date => {
  if (!isoDateString) return new Date();
  const [year, month, day] = isoDateString.split('T')[0].split('-').map(Number);
  return new Date(year, month - 1, day);
};

const timeToMinutes = (time: string): number => {
  if (!time) return 0;
  const [h, m] = time.split(':').map(Number);
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
};

const minutesToTime = (minutes: number): string => {
  if (!Number.isFinite(minutes)) return '00:00';
  const wrapped = ((minutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(wrapped / 60)).padStart(2, '0')}:${String(wrapped % 60).padStart(2, '0')}`;
};

const durationToMinutes = (duration: number, unit: 'hours' | 'minutes' | 'hours and minutes'): number => {
  const value = Number(duration);
  if (!Number.isFinite(value) || value <= 0) return 0;
  if (unit === 'hours and minutes') {
    const hours = Math.floor(value);
    const mins = Math.round((value % 1) * 60);
    return hours * 60 + mins;
  }
  return unit === 'hours' ? value * 60 : value;
};

const minutesToLabel = (mins: number): string => {
  const h24 = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  const ampm = h24 >= 12 ? 'PM' : 'AM';
  const h = h24 % 12 || 12;
  return m === 0 ? `${h} ${ampm}` : `${h}:${String(m).padStart(2, '0')} ${ampm}`;
};

const michiganToday = (): Date => {
  const now = getMichiganNow();
  return new Date(now.year, now.month - 1, now.day);
};

const dateKeyOf = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const ZOOM_LEVELS = [1, 1.6, 2.4];
const COLUMN_WIDTH = 150;
const GUTTER_WIDTH = 76;
const UNCATEGORISED_LABEL = 'No category';
const VIEW_STATE_KEY = 'spaceScheduleViewState:v2';

interface ScheduleViewState {
  categoryFilter?: string;
  statusFilter?: string;
  searchInput?: string;
  hideEmptySpaces?: boolean;
  zoomLevel?: number;
}

const readViewState = (): ScheduleViewState => {
  try {
    const raw = sessionStorage.getItem(VIEW_STATE_KEY);
    return raw ? (JSON.parse(raw) as ScheduleViewState) : {};
  } catch {
    return {};
  }
};

const writeViewState = (state: ScheduleViewState): void => {
  try {
    sessionStorage.setItem(VIEW_STATE_KEY, JSON.stringify(state));
  } catch {
    return;
  }
};

const STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'pending', label: 'Pending' },
  { value: 'checked-in', label: 'Checked-in' },
];

const PACKAGE_COLORS = [
  { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-300' },
  { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-300' },
  { bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-300' },
  { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-300' },
  { bg: 'bg-pink-100', text: 'text-pink-800', border: 'border-pink-300' },
  { bg: 'bg-teal-100', text: 'text-teal-800', border: 'border-teal-300' },
  { bg: 'bg-indigo-100', text: 'text-indigo-800', border: 'border-indigo-300' },
  { bg: 'bg-amber-100', text: 'text-amber-800', border: 'border-amber-300' },
  { bg: 'bg-cyan-100', text: 'text-cyan-800', border: 'border-cyan-300' },
  { bg: 'bg-rose-100', text: 'text-rose-800', border: 'border-rose-300' },
  { bg: 'bg-lime-100', text: 'text-lime-800', border: 'border-lime-300' },
  { bg: 'bg-fuchsia-100', text: 'text-fuchsia-800', border: 'border-fuchsia-300' },
];

const packageColorFor = (packageName: string) => {
  let hash = 0;
  for (let i = 0; i < packageName.length; i++) {
    const char = packageName.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return PACKAGE_COLORS[Math.abs(hash) % PACKAGE_COLORS.length];
};

interface ScheduleColumn {
  key: string;
  name: string;
  capacity?: number;
  roomId?: number;
  locationId?: number;
  virtual: boolean;
  openMinutes?: number | null;
  closeMinutes?: number | null;
}

interface PositionedBooking {
  booking: Booking;
  startMin: number;
  endMin: number;
  top: number;
  height: number;
  lane: number;
  laneCount: number;
  clipped: boolean;
}

const assignLanes = (list: PositionedBooking[]): void => {
  list.sort((a, b) => a.top - b.top || b.height - a.height || a.booking.id - b.booking.id);
  let clusterStart = 0;
  let clusterMaxBottom = -1;
  let laneEnds: number[] = [];
  const finishCluster = (end: number) => {
    const laneCount = Math.max(1, laneEnds.length);
    for (let i = clusterStart; i < end; i++) list[i].laneCount = laneCount;
  };
  list.forEach((item, index) => {
    if (index > 0 && item.top >= clusterMaxBottom) {
      finishCluster(index);
      clusterStart = index;
      laneEnds = [];
    }
    let lane = laneEnds.findIndex(end => end <= item.top);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(0);
    }
    laneEnds[lane] = item.top + item.height;
    item.lane = lane;
    clusterMaxBottom = Math.max(clusterMaxBottom, item.top + item.height);
  });
  finishCluster(list.length);
};

const SpaceSchedule = () => {
  const { themeColor, fullColor } = useThemeColor();
  const navigate = useNavigate();
  const { effectiveLocationId } = useLocationScope();
  const savedViewState = useRef(readViewState()).current;
  const [selectedDate, setSelectedDate] = useState(() => michiganToday());
  const [spaces, setSpaces] = useState<Room[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [dayOffs, setDayOffs] = useState<DayOff[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => michiganToday());
  const spacesLoadedRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [categoryFilter, setCategoryFilter] = useState(savedViewState.categoryFilter ?? 'all');
  const [statusFilter, setStatusFilter] = useState(savedViewState.statusFilter ?? 'all');
  const [searchInput, setSearchInput] = useState(savedViewState.searchInput ?? '');
  const [hideEmptySpaces, setHideEmptySpaces] = useState(savedViewState.hideEmptySpaces ?? false);
  const [zoomLevel, setZoomLevel] = useState(() => {
    const saved = savedViewState.zoomLevel;
    return typeof saved === 'number' && Number.isInteger(saved) && saved >= 0 && saved < ZOOM_LEVELS.length ? saved : 1;
  });

  const [nowTick, setNowTick] = useState(() => getMichiganNow());
  const [loadedDateKey, setLoadedDateKey] = useState('');

  const [checkInLoading, setCheckInLoading] = useState(false);
  const [showCheckInConfirm, setShowCheckInConfirm] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [tempNotes, setTempNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'in-store'>('in-store');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [processingPayment, setProcessingPayment] = useState(false);

  useEffect(() => {
    const id = window.setInterval(() => setNowTick(getMichiganNow()), 60000);
    const onVisible = () => {
      if (!document.hidden) setNowTick(getMichiganNow());
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  useEffect(() => {
    writeViewState({ categoryFilter, statusFilter, searchInput, hideEmptySpaces, zoomLevel });
  }, [categoryFilter, statusFilter, searchInput, hideEmptySpaces, zoomLevel]);

  const pxPerMinute = ZOOM_LEVELS[zoomLevel];

  const formatTime12Hour = (time: string): string => {
    const [hourStr, minuteStr] = time.split(':');
    let hour = parseInt(hourStr);
    const minute = minuteStr || '00';
    const ampm = hour >= 12 ? 'PM' : 'AM';
    hour = hour % 12 || 12;
    return `${hour}:${minute} ${ampm}`;
  };

  const calculateEndTime = (startTime: string, duration: number, unit: 'hours' | 'minutes' | 'hours and minutes'): string => {
    const [hourStr, minuteStr] = startTime.split(':');
    let hour = parseInt(hourStr);
    let minute = parseInt(minuteStr);
    minute += durationToMinutes(duration, unit);
    hour += Math.floor(minute / 60);
    minute = minute % 60;
    hour = hour % 24;
    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  };

  const formatDuration = (duration: number, unit: 'hours' | 'minutes' | 'hours and minutes'): string => {
    return formatDurationDisplay(duration, unit);
  };

  const getDayName = (date: Date): string => {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    return days[date.getDay()];
  };

  const currentDayName = useMemo(() => getDayName(selectedDate), [selectedDate]);

  const displaySpaces = useMemo(
    () => (effectiveLocationId ? spaces.filter(s => s.location_id === effectiveLocationId) : spaces),
    [spaces, effectiveLocationId]
  );

  useEffect(() => {
    if (!effectiveLocationId) {
      setDayOffs([]);
      return;
    }
    let cancelled = false;
    dayOffService
      .getDayOffsByLocation(effectiveLocationId)
      .then(res => {
        if (!cancelled && res.success && res.data) setDayOffs(res.data);
      })
      .catch(() => {
        if (!cancelled) setDayOffs([]);
      });
    return () => {
      cancelled = true;
    };
  }, [effectiveLocationId]);

  const spaceClosures = useMemo(() => {
    const map = new Map<number, { fullDay: boolean; ranges: Array<{ time_start: string | null; time_end: string | null }> }>();
    const selY = selectedDate.getFullYear();
    const selM = selectedDate.getMonth();
    const selD = selectedDate.getDate();
    const appliesOnDate = (d: DayOff) => {
      const od = parseLocalDate(d.date);
      const exact = od.getFullYear() === selY && od.getMonth() === selM && od.getDate() === selD;
      const recurring = d.is_recurring && od.getMonth() === selM && od.getDate() === selD;
      return exact || recurring;
    };
    const relevant = dayOffs.filter(appliesOnDate);
    for (const space of displaySpaces) {
      const forSpace = relevant.filter(d => {
        const isLocationWide = !d.package_ids?.length && !d.room_ids?.length && !d.attraction_ids?.length && !d.event_ids?.length;
        const targetsRoom = !!d.room_ids?.length && d.room_ids.includes(space.id);
        return isLocationWide || targetsRoom;
      });
      if (forSpace.length === 0) continue;
      const fullDay = forSpace.some(d => !d.time_start && !d.time_end);
      const ranges = forSpace
        .filter(d => d.time_start || d.time_end)
        .map(d => ({ time_start: d.time_start ?? null, time_end: d.time_end ?? null }));
      map.set(space.id, { fullDay, ranges });
    }
    return map;
  }, [dayOffs, selectedDate, displaySpaces]);

  const getSpaceClosureLabel = useCallback(
    (spaceId: number): string | null => {
      const c = spaceClosures.get(spaceId);
      if (!c) return null;
      if (c.fullDay) return 'Closed all day';
      const parts = c.ranges.map(r => {
        if (r.time_start && r.time_end) return `${formatTime12Hour(r.time_start)}–${formatTime12Hour(r.time_end)}`;
        if (r.time_start) return `after ${formatTime12Hour(r.time_start)}`;
        if (r.time_end) return `until ${formatTime12Hour(r.time_end)}`;
        return '';
      }).filter(Boolean);
      return parts.length ? `Closed ${parts.join(', ')}` : 'Closed';
    },
    [spaceClosures]
  );

  const naturalSort = (a: Room, b: Room): number => {
    const chunksA = a.name.match(/(\d+|\D+)/g) || [];
    const chunksB = b.name.match(/(\d+|\D+)/g) || [];
    const maxLength = Math.max(chunksA.length, chunksB.length);
    for (let i = 0; i < maxLength; i++) {
      const chunkA = chunksA[i] || '';
      const chunkB = chunksB[i] || '';
      const isNumA = /^\d+$/.test(chunkA);
      const isNumB = /^\d+$/.test(chunkB);
      if (isNumA && isNumB) {
        const diff = parseInt(chunkA) - parseInt(chunkB);
        if (diff !== 0) return diff;
      } else {
        const comparison = chunkA.toLowerCase().localeCompare(chunkB.toLowerCase());
        if (comparison !== 0) return comparison;
      }
    }
    return 0;
  };

  const loadSpaces = useCallback(async () => {
    if (spacesLoadedRef.current) return;
    const user = getStoredUser();

    try {
      const cachedRooms = await roomCacheService.getCachedRooms();
      if (cachedRooms && cachedRooms.length > 0) {
        setSpaces([...cachedRooms].sort(naturalSort));
      }
    } catch (error) {
      console.error('Error reading cached spaces:', error);
    }

    try {
      const spacesResponse = await roomService.getRooms({
        user_id: user?.id,
        per_page: 500,
        include_unavailable: true
      });
      const fetchedSpaces: Room[] = Array.isArray(spacesResponse.data) ? spacesResponse.data : spacesResponse.data.rooms || [];
      setSpaces([...fetchedSpaces].sort(naturalSort));
      spacesLoadedRef.current = true;
      const bookableSpaces = fetchedSpaces.filter(room => room.is_available !== false);
      if (bookableSpaces.length > 0) {
        await roomCacheService.cacheRooms(bookableSpaces);
      }
    } catch (error) {
      console.error('Error loading spaces:', error);
    }
  }, []);

  const loadBookings = useCallback(async () => {
    try {
      setBookingsLoading(true);
      const dateStr = dateKeyOf(selectedDate);

      const hasCachedBookings = await bookingCacheService.hasCachedData();
      if (hasCachedBookings) {
        const cachedBookings = await bookingCacheService.getFilteredBookingsFromCache({
          booking_date: dateStr,
          location_id: effectiveLocationId ?? undefined,
        });
        setBookings((cachedBookings || []) as Booking[]);
        bookingCacheService.syncInBackground();
      } else {
        const bookingsResponse = await bookingService.getBookings({
          booking_date: dateStr,
          user_id: getStoredUser()?.id,
          location_id: effectiveLocationId ?? undefined,
          per_page: 100,
        });
        const fetchedBookings = bookingsResponse.data.bookings || [];
        setBookings(fetchedBookings);
        bookingCacheService.syncInBackground();
      }
      setLoadedDateKey(dateStr);
    } catch (error) {
      console.error('Error loading bookings:', error);
    } finally {
      setBookingsLoading(false);
    }
  }, [selectedDate, effectiveLocationId]);

  useEffect(() => {
    const init = async () => {
      await Promise.all([loadSpaces(), loadBookings()]);
      setInitialLoading(false);
    };
    init();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!initialLoading) {
      loadBookings();
    }
  }, [selectedDate, effectiveLocationId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const unsubRoom = roomCacheService.onCacheUpdate(async (event: CustomEvent) => {
      if (event.detail?.source === 'api') {
        const cachedRooms = await roomCacheService.getCachedRooms();
        if (cachedRooms) {
          const sortedSpaces = [...cachedRooms].sort(naturalSort);
          setSpaces(sortedSpaces);
        }
      }
    });
    const unsubBooking = bookingCacheService.onCacheUpdate(async (event: CustomEvent) => {
      if (event.detail?.source === 'api') {
        loadBookings();
      }
    });
    return () => { unsubRoom(); unsubBooking(); };
  }, [loadBookings]);

  const goToPreviousDay = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() - 1);
    setSelectedDate(newDate);
    setCalendarMonth(newDate);
  };

  const goToNextDay = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + 1);
    setSelectedDate(newDate);
    setCalendarMonth(newDate);
  };

  const goToToday = () => {
    const today = michiganToday();
    setSelectedDate(today);
    setCalendarMonth(today);
  };

  const goToPreviousMonth = () => {
    const newMonth = new Date(calendarMonth);
    newMonth.setMonth(newMonth.getMonth() - 1);
    setCalendarMonth(newMonth);
  };

  const goToNextMonth = () => {
    const newMonth = new Date(calendarMonth);
    newMonth.setMonth(newMonth.getMonth() + 1);
    setCalendarMonth(newMonth);
  };

  const selectDate = (date: Date) => {
    setSelectedDate(date);
    setShowCalendar(false);
  };

  const openBookingFromSearch = (booking: Booking) => {
    const bookingDate = parseLocalDate(booking.booking_date);
    if (!Number.isNaN(bookingDate.getTime())) {
      setSelectedDate(bookingDate);
      setCalendarMonth(bookingDate);
    }
    setSelectedBooking(booking);
  };

  const getCalendarDays = (): (Date | null)[] => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    const days: (Date | null)[] = [];
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }
    return days;
  };

  const isSameDay = (date1: Date, date2: Date): boolean => {
    return date1.getDate() === date2.getDate() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getFullYear() === date2.getFullYear();
  };

  const isToday = (date: Date): boolean => {
    return date.getFullYear() === nowTick.year &&
           date.getMonth() === nowTick.month - 1 &&
           date.getDate() === nowTick.day;
  };

  const isMichiganToday = isToday(selectedDate);
  const isPastDate = dateKeyOf(selectedDate) < dateKeyOf(michiganToday());
  const nowMinutes = nowTick.hour * 60 + nowTick.minute;

  const activeBookings = useMemo(
    () => bookings.filter(b => b.status === 'confirmed' || b.status === 'checked-in' || b.status === 'pending'),
    [bookings]
  );

  const categoryOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const b of activeBookings) {
      const key = normalizeCategory(b.package?.category) || UNCATEGORISED_LABEL;
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => a[0].localeCompare(b[0], undefined, { sensitivity: 'base' }))
      .map(([value, count]) => ({ value, label: value, count }));
  }, [activeBookings]);

  const effectiveCategory = useMemo(
    () => (categoryFilter !== 'all' && categoryOptions.some(o => o.value === categoryFilter) ? categoryFilter : 'all'),
    [categoryFilter, categoryOptions]
  );

  const filteredBookings = useMemo(() => {
    const term = searchInput.trim().toLowerCase();
    return activeBookings.filter(b => {
      if (effectiveCategory !== 'all' && (normalizeCategory(b.package?.category) || UNCATEGORISED_LABEL) !== effectiveCategory) return false;
      if (statusFilter !== 'all' && b.status !== statusFilter) return false;
      if (term && !matchesBookingSearch(b, term)) return false;
      return true;
    });
  }, [activeBookings, effectiveCategory, statusFilter, searchInput]);

  const knownRoomIds = useMemo(() => new Set(displaySpaces.map(s => s.id)), [displaySpaces]);

  const columnKeyFor = useCallback(
    (b: Booking): string => {
      if (b.room_id && knownRoomIds.has(b.room_id)) return `room-${b.room_id}`;
      return b.package_id ? `pkg-${b.package_id}` : 'unassigned';
    },
    [knownRoomIds]
  );

  const { dayWindow } = useScheduleDayWindow(selectedDate, effectiveLocationId);

  const roomWindows = useMemo(() => {
    const map = new Map<
      number,
      { open: number | null; close: number | null; closed: boolean; bookable: boolean; reason: string | null }
    >();
    for (const entry of dayWindow?.rooms ?? []) {
      map.set(entry.room_id, {
        open: entry.open_minutes,
        close: entry.close_minutes,
        closed: entry.closed_all_day,
        bookable: entry.bookable !== false,
        reason: entry.reason,
      });
    }
    return map;
  }, [dayWindow]);

  const columns = useMemo<ScheduleColumn[]>(() => {
    const roomBookingCount = new Map<number, number>();
    for (const b of filteredBookings) {
      if (b.room_id && knownRoomIds.has(b.room_id)) roomBookingCount.set(b.room_id, (roomBookingCount.get(b.room_id) || 0) + 1);
    }
    const roomColumns: ScheduleColumn[] = displaySpaces
      .filter(space => !hideEmptySpaces || (roomBookingCount.get(space.id) || 0) > 0)
      .map(space => ({
        key: `room-${space.id}`,
        name: space.name,
        capacity: space.capacity,
        roomId: space.id,
        locationId: space.location_id,
        virtual: false,
        openMinutes: roomWindows.get(space.id)?.open ?? null,
        closeMinutes: roomWindows.get(space.id)?.close ?? null,
      }));
    const virtualMap = new Map<string, ScheduleColumn>();
    for (const b of filteredBookings) {
      const key = columnKeyFor(b);
      if (key.startsWith('room-')) continue;
      if (!virtualMap.has(key)) {
        const packageWindow = (dayWindow?.packages ?? []).find(entry => entry.package_id === b.package_id);
        virtualMap.set(key, {
          key,
          name: b.package?.name || 'Unassigned',
          locationId: packageWindow?.location_id ?? b.location_id ?? undefined,
          virtual: true,
          openMinutes: packageWindow?.open_minutes ?? null,
          closeMinutes: packageWindow?.close_minutes ?? null,
        });
      }
    }
    if (!hideEmptySpaces) {
      for (const entry of dayWindow?.packages ?? []) {
        if (entry.room_ids.length > 0) continue;
        const key = `pkg-${entry.package_id}`;
        if (virtualMap.has(key)) continue;
        virtualMap.set(key, {
          key,
          name: entry.name,
          virtual: true,
          openMinutes: entry.open_minutes,
          closeMinutes: entry.close_minutes,
        });
      }
    }
    const virtualColumns = [...virtualMap.values()].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
    return [...roomColumns, ...virtualColumns];
  }, [displaySpaces, filteredBookings, hideEmptySpaces, knownRoomIds, columnKeyFor, roomWindows, dayWindow]);

  const roomBreaks = useMemo(() => {
    const map = new Map<number, Array<{ start: number; end: number }>>();
    for (const space of displaySpaces) {
      if (!space.break_time?.length) continue;
      const list: Array<{ start: number; end: number }> = [];
      for (const brk of space.break_time) {
        if (!brk.days.includes(currentDayName)) continue;
        const start = timeToMinutes(brk.start_time);
        const end = timeToMinutes(brk.end_time);
        if (end > start) list.push({ start, end });
      }
      if (list.length) map.set(space.id, list);
    }
    return map;
  }, [displaySpaces, currentDayName]);

  const windowExtentRef = useRef<{ key: string; start: number; end: number } | null>(null);

  const timeWindow = useMemo(() => {
    let earliest = Infinity;
    let latest = -Infinity;
    for (const b of filteredBookings) {
      const start = timeToMinutes(b.booking_time);
      const end = start + Math.max(15, durationToMinutes(b.duration, b.duration_unit));
      if (start < earliest) earliest = start;
      if (end > latest) latest = end;
    }
    for (const [, breaks] of roomBreaks) {
      for (const brk of breaks) {
        if (brk.start < earliest) earliest = brk.start;
        if (brk.end > latest) latest = brk.end;
      }
    }
    for (const [, closure] of spaceClosures) {
      if (closure.fullDay) continue;
      for (const r of closure.ranges) {
        if (r.time_start) {
          const t = timeToMinutes(r.time_start);
          if (t < earliest) earliest = t;
          if (t > latest) latest = t;
        }
        if (r.time_end) {
          const t = timeToMinutes(r.time_end);
          if (t < earliest) earliest = t;
          if (t > latest) latest = t;
        }
      }
    }
    if (dayWindow) {
      if (dayWindow.open_minutes < earliest) earliest = dayWindow.open_minutes;
      if (dayWindow.close_minutes > latest) latest = dayWindow.close_minutes;
    }
    if (!Number.isFinite(earliest) || !Number.isFinite(latest)) {
      earliest = 10 * 60;
      latest = 22 * 60;
    }
    if (isMichiganToday) {
      if (nowMinutes < earliest) earliest = nowMinutes;
      if (nowMinutes > latest) latest = nowMinutes;
    }
    let start = Math.max(0, Math.floor(earliest / 60) * 60 - 60);
    let end = Math.ceil(latest / 60) * 60 + 60;
    const extentKey = `${dateKeyOf(selectedDate)}:${effectiveLocationId ?? 'all'}`;
    const prev = windowExtentRef.current;
    if (prev && prev.key === extentKey) {
      start = Math.min(start, prev.start);
      end = Math.max(end, prev.end);
    }
    windowExtentRef.current = { key: extentKey, start, end };
    return { start, end, total: end - start };
  }, [filteredBookings, roomBreaks, spaceClosures, isMichiganToday, nowMinutes, selectedDate, effectiveLocationId, dayWindow]);

  const positionedByColumn = useMemo(() => {
    const map = new Map<string, PositionedBooking[]>();
    for (const column of columns) map.set(column.key, []);
    for (const b of filteredBookings) {
      const key = columnKeyFor(b);
      const list = map.get(key);
      if (!list) continue;
      const startMin = timeToMinutes(b.booking_time);
      const rawEnd = startMin + Math.max(15, durationToMinutes(b.duration, b.duration_unit));
      const endMin = Math.min(timeWindow.end, rawEnd);
      list.push({
        booking: b,
        startMin,
        endMin,
        top: (startMin - timeWindow.start) * pxPerMinute,
        height: Math.max(8, (endMin - startMin) * pxPerMinute - 2),
        lane: 0,
        laneCount: 1,
        clipped: rawEnd > timeWindow.end,
      });
    }
    for (const list of map.values()) assignLanes(list);
    return map;
  }, [columns, filteredBookings, timeWindow, columnKeyFor, pxPerMinute]);

  const freeFromByColumn = useMemo(() => {
    const map = new Map<string, FreeState>();

    for (const column of columns) {
      const closure = column.roomId ? spaceClosures.get(column.roomId) : undefined;
      if (closure?.fullDay || roomWindows.get(column.roomId ?? -1)?.closed) {
        map.set(column.key, { kind: 'closed' });
        continue;
      }

      const open = column.openMinutes ?? (column.virtual ? timeWindow.start : null);
      const close = column.closeMinutes ?? (column.virtual ? timeWindow.end : null);
      const space = column.roomId !== undefined
        ? (dayWindow?.rooms ?? []).find(entry => entry.room_id === column.roomId)
        : undefined;
      // the space is still shut for its turnaround, so it is not free the moment a booking ends
      const columnTurnaround = space?.interval_minutes ?? DEFAULT_SLOT_CLEANUP_MINUTES;
      const blocked = [
        ...activeBookings
          .filter(b => columnKeyFor(b) === column.key)
          .map(b => {
            const startMinutes = timeToMinutes(b.booking_time);
            return {
              startMinutes,
              endMinutes: startMinutes + Math.max(15, durationToMinutes(b.duration, b.duration_unit)) + columnTurnaround,
            };
          }),
        ...(column.roomId ? (roomBreaks.get(column.roomId) || []).map(b => ({ startMinutes: b.start, endMinutes: b.end, reason: 'On break' })) : []),
        ...(closure?.ranges || []).map(r => ({
          startMinutes: r.time_start ? timeToMinutes(r.time_start) : (open ?? timeWindow.start),
          endMinutes: r.time_end ? timeToMinutes(r.time_end) : (close ?? timeWindow.end),
          reason: 'Closed',
        })),
      ];

      map.set(column.key, freeState(open, close, blocked, isMichiganToday ? nowMinutes : (open ?? timeWindow.start), roomWindows.get(column.roomId ?? -1)?.bookable !== false));
    }

    return map;
  }, [columns, activeBookings, columnKeyFor, roomBreaks, spaceClosures, roomWindows, dayWindow, timeWindow, isMichiganToday, nowMinutes]);

  const hourMarks = useMemo(() => {
    const marks: number[] = [];
    for (let m = timeWindow.start; m <= timeWindow.end; m += 60) marks.push(m);
    return marks;
  }, [timeWindow]);

  const daySummary = useMemo(() => {
    const guests = filteredBookings.reduce((sum, b) => sum + (Number(b.participants) || 0), 0);
    const unassigned = filteredBookings.filter(b => !b.room_id || !knownRoomIds.has(b.room_id)).length;
    return { count: filteredBookings.length, guests, unassigned };
  }, [filteredBookings, knownRoomIds]);

  const nowLineTop = isMichiganToday && nowMinutes >= timeWindow.start && nowMinutes <= timeWindow.end
    ? (nowMinutes - timeWindow.start) * pxPerMinute
    : null;

  const scrollToNow = () => {
    if (nowLineTop === null || !scrollRef.current) return;
    scrollRef.current.scrollTo({ top: Math.max(0, nowLineTop - scrollRef.current.clientHeight / 3), behavior: 'smooth' });
  };

  const pendingZoomAnchor = useRef<number | null>(null);

  const changeZoom = (next: number) => {
    if (next === zoomLevel || next < 0 || next >= ZOOM_LEVELS.length) return;
    const el = scrollRef.current;
    if (el) pendingZoomAnchor.current = (el.scrollTop + el.clientHeight / 2) / pxPerMinute;
    setZoomLevel(next);
  };

  useEffect(() => {
    const el = scrollRef.current;
    const anchor = pendingZoomAnchor.current;
    pendingZoomAnchor.current = null;
    if (!el || anchor === null) return;
    el.scrollTop = Math.max(0, anchor * pxPerMinute - el.clientHeight / 2);
  }, [pxPerMinute]);

  const [weekCounts, setWeekCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cached = await bookingCacheService.getCachedBookings();
        if (cancelled || !cached) return;
        const counts: Record<string, number> = {};
        for (const b of cached) {
          if (effectiveLocationId && b.location_id !== effectiveLocationId) continue;
          if (b.status !== 'confirmed' && b.status !== 'checked-in' && b.status !== 'pending') continue;
          const key = (b.booking_date || '').split('T')[0];
          counts[key] = (counts[key] || 0) + 1;
        }
        setWeekCounts(counts);
      } catch {
        return;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [effectiveLocationId, bookings]);

  const weekDays = useMemo(() => {
    const base = michiganToday();
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      return d;
    });
  }, [nowTick.year, nowTick.month, nowTick.day]); // eslint-disable-line react-hooks/exhaustive-deps

  const hasActiveFilters = effectiveCategory !== 'all' || statusFilter !== 'all' || searchInput.trim() !== '';

  const clearFilters = () => {
    setCategoryFilter('all');
    setStatusFilter('all');
    setSearchInput('');
  };

  const lastScrolledDay = useRef('');
  useEffect(() => {
    if (initialLoading || !scrollRef.current) return;
    const dayKey = dateKeyOf(selectedDate);
    if (loadedDateKey !== dayKey) return;
    if (lastScrolledDay.current === dayKey) return;
    lastScrolledDay.current = dayKey;
    if (nowLineTop !== null) {
      scrollRef.current.scrollTop = Math.max(0, nowLineTop - scrollRef.current.clientHeight / 3);
    } else {
      scrollRef.current.scrollTop = 0;
    }
  }, [selectedDate, initialLoading, loadedDateKey, filteredBookings.length]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable)) return;
      if (initialLoading || selectedBooking || showCalendar || showPaymentModal) return;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goToPreviousDay();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        goToNextDay();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [initialLoading, selectedBooking, showCalendar, showPaymentModal, selectedDate]); // eslint-disable-line react-hooks/exhaustive-deps

  if (initialLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className={`animate-spin rounded-full h-12 w-12 border-b-2 border-${fullColor}`}></div>
      </div>
    );
  }

  const handleOpenPaymentModal = () => {
    if (!selectedBooking) return;
    const remainingAmount = Math.max(0, Number(selectedBooking.total_amount || 0) - Number(selectedBooking.amount_paid || 0));
    setPaymentAmount((Math.floor(remainingAmount * 100) / 100).toFixed(2));
    setPaymentMethod('in-store');
    setPaymentNotes('');
    setShowPaymentModal(true);
  };

  const handleClosePaymentModal = () => {
    setShowPaymentModal(false);
    setPaymentAmount('');
    setPaymentMethod('in-store');
    setPaymentNotes('');
  };

  const handleSubmitPayment = async () => {
    if (!selectedBooking) return;
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) return;

    const remainingAmount = Math.round((Number(selectedBooking.total_amount || 0) - Number(selectedBooking.amount_paid || 0)) * 100) / 100;
    if (Math.round(amount * 100) / 100 > remainingAmount + 0.01) return;

    try {
      setProcessingPayment(true);
      const bookingResponse = await bookingService.getBookingById(selectedBooking.id);
      if (!bookingResponse.success || !bookingResponse.data) throw new Error('Failed to get booking details');

      const booking = bookingResponse.data;
      await createPayment({
        payable_id: selectedBooking.id,
        payable_type: PAYMENT_TYPE.BOOKING,
        customer_id: booking.customer_id || null,
        location_id: booking.location_id,
        amount,
        currency: 'USD',
        method: paymentMethod === 'in-store' ? 'cash' : paymentMethod,
        status: 'completed',
        notes: paymentNotes || `In-store payment for booking ${selectedBooking.reference_number}`,
      });

      const newAmountPaid = Number(selectedBooking.amount_paid || 0) + amount;
      const newPaymentStatus = resolvePaymentState({
        payment_status: selectedBooking.payment_status,
        amount_paid: newAmountPaid,
        total_amount: selectedBooking.total_amount,
      }).state;
      const updateResponse = await bookingService.updateBooking(selectedBooking.id, {
        amount_paid: newAmountPaid,
        status: 'confirmed',
      });

      if (updateResponse.success && updateResponse.data) {
        await bookingCacheService.updateBookingInCache(updateResponse.data);
      }

      setSelectedBooking({ ...selectedBooking, amount_paid: newAmountPaid, payment_status: newPaymentStatus } as Booking);
      setBookings(prev => prev.map(b => b.id === selectedBooking.id ? { ...b, amount_paid: newAmountPaid, payment_status: newPaymentStatus } as Booking : b));
      handleClosePaymentModal();
    } catch (error) {
      console.error('Error processing payment:', error);
    } finally {
      setProcessingPayment(false);
    }
  };

  const renderBookingBlock = (item: PositionedBooking) => {
    const { booking } = item;
    const color = packageColorFor(booking.package?.name || '');
    const laneWidth = 100 / item.laneCount;
    // below one line of text there is no room for a label, so show the block alone
    const tiny = item.height < 24;
    const compact = !tiny && item.height < 60;
    const medium = item.height >= 60 && item.height < 140;
    const timeLabel = `${formatTime12Hour(booking.booking_time)} – ${formatTime12Hour(calculateEndTime(booking.booking_time, booking.duration, booking.duration_unit))}`;
    const inProgress = isMichiganToday && nowMinutes >= item.startMin && nowMinutes < item.endMin;
    const needsCheckIn = inProgress && booking.status !== 'checked-in';
    return (
      <button
        key={booking.id}
        type="button"
        onClick={() => setSelectedBooking(booking)}
        className={`absolute text-left rounded-lg border ${color.bg} ${color.border} shadow-sm hover:shadow-md hover:brightness-[0.98] transition overflow-hidden z-10 ${
          needsCheckIn ? 'ring-2 ring-red-400' : inProgress ? 'ring-2 ring-emerald-400' : ''
        }`}
        style={{
          top: item.top,
          height: item.height,
          left: `calc(${item.lane * laneWidth}% + 3px)`,
          width: `calc(${laneWidth}% - 6px)`,
        }}
      >
        <div className={`h-full flex flex-col ${tiny ? '' : compact ? 'px-2 py-0.5 justify-center' : 'p-2'}`}>
          {tiny ? null : compact ? (
            <div className={`flex items-center gap-1.5 text-xs ${color.text} min-w-0`}>
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                booking.status === 'confirmed' ? 'bg-green-500' :
                booking.status === 'pending' ? 'bg-yellow-500' : 'bg-blue-500'
              }`} />
              <span className="font-semibold truncate">{booking.guest_name || 'Walk-in'}</span>
              {item.laneCount === 1 && (
                <span className="opacity-70 flex-shrink-0">{formatTime12Hour(booking.booking_time)}</span>
              )}
            </div>
          ) : (
            <>
              {!medium && (
                <div className="flex items-center justify-between gap-1 mb-1">
                  <span className={`px-1.5 py-0.5 text-[9px] font-bold uppercase rounded-full text-white flex-shrink-0 ${
                    booking.status === 'confirmed' ? 'bg-green-500' :
                    booking.status === 'pending' ? 'bg-yellow-500' : 'bg-blue-500'
                  }`}>
                    {booking.status}
                  </span>
                  <span className={`text-[10px] font-medium ${color.text} opacity-70 truncate`}>
                    #{booking.reference_number?.slice(-6)}
                  </span>
                </div>
              )}
              <div className={`font-bold text-xs ${color.text} flex items-center gap-1.5 truncate`}>
                <span className="truncate">{timeLabel}</span>
                {needsCheckIn && (
                  <span className="flex items-center gap-0.5 px-1.5 py-px rounded-full bg-red-500 text-white text-[9px] font-bold uppercase">
                    <AlertCircle className="w-2.5 h-2.5" />
                    Check in
                  </span>
                )}
                {inProgress && !needsCheckIn && (
                  <span className="px-1.5 py-px rounded-full bg-emerald-500 text-white text-[9px] font-bold uppercase">Now</span>
                )}
              </div>
              <div className={`font-semibold text-sm ${color.text} truncate`}>{booking.guest_name || 'Walk-in'}</div>
              {!medium && (
                <>
                  <div className={`text-xs ${color.text} opacity-80 truncate`}>{booking.package?.name || 'N/A'}</div>
                  <div className={`text-xs ${color.text} opacity-70 flex items-center gap-1`}>
                    <Users className="w-3 h-3" />
                    {booking.participants} {booking.participants === 1 ? 'guest' : 'guests'}
                  </div>
                  <div className={`mt-auto pt-1 flex items-center justify-between text-xs`}>
                    <span className={`font-bold ${color.text}`}>${Number(booking.total_amount || 0).toFixed(2)}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${resolvePaymentState(booking).pillClass}`}>
                      {resolvePaymentState(booking).label}
                    </span>
                  </div>
                </>
              )}
            </>
          )}
        </div>
        {item.clipped && (
          <div className="absolute bottom-0 inset-x-0 border-b-2 border-dashed border-current opacity-60 flex justify-center pointer-events-none">
            {item.height >= 56 && (
              <span className={`text-[9px] font-semibold ${color.text} bg-white/70 rounded-t px-1`}>continues past midnight</span>
            )}
          </div>
        )}
      </button>
    );
  };

  const packagesForSlot = (column: ScheduleColumn, minute: number): number[] => {
    if (column.virtual) {
      const id = Number(column.key.replace('pkg-', ''));
      return Number.isInteger(id) && id > 0 ? [id] : [];
    }
    return (dayWindow?.packages ?? [])
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
  };

  const blockedRangesFor = (column: ScheduleColumn): TimeRange[] => {
    const closure = column.roomId ? spaceClosures.get(column.roomId) : undefined;
    const open = column.openMinutes ?? timeWindow.start;
    const close = column.closeMinutes ?? timeWindow.end;
    // the space stays shut for its turnaround after a booking ends, so the booking page
    // refuses that minute even though the band would otherwise look free
    const turnaround = turnaroundFor(column);

    return [
      ...activeBookings
        .filter(b => columnKeyFor(b) === column.key)
        .map(b => {
          const startMinutes = timeToMinutes(b.booking_time);
          return {
            startMinutes,
            endMinutes: startMinutes + Math.max(15, durationToMinutes(b.duration, b.duration_unit)) + turnaround,
          };
        }),
      ...(column.roomId ? (roomBreaks.get(column.roomId) || []).map(b => ({ startMinutes: b.start, endMinutes: b.end })) : []),
      ...(closure?.ranges || []).map(r => ({
        startMinutes: r.time_start ? timeToMinutes(r.time_start) : open,
        endMinutes: r.time_end ? timeToMinutes(r.time_end) : close,
      })),
    ];
  };

  const intervalForColumn = (column: ScheduleColumn): number => {
    if (column.virtual) {
      const packageId = Number(column.key.replace('pkg-', ''));
      const entry = (dayWindow?.packages ?? []).find(candidate => candidate.package_id === packageId);
      if (entry?.interval_minutes) return entry.interval_minutes;
    }

    return dayWindow?.interval_minutes ?? 15;
  };

  /** How long this space stays shut after a booking ends, mirroring the server's conflict check. */
  const turnaroundFor = (column: ScheduleColumn): number => {
    if (column.roomId === undefined) return DEFAULT_SLOT_CLEANUP_MINUTES;
    const space = (dayWindow?.rooms ?? []).find(entry => entry.room_id === column.roomId);
    return space?.interval_minutes ?? DEFAULT_SLOT_CLEANUP_MINUTES;
  };

  const offeredStartsFor = (column: ScheduleColumn, minute: number): number[] => {
    const ids = packagesForSlot(column, minute);
    if (ids.length === 0) return [];

    const starts = new Set<number>();
    for (const id of ids) {
      const entry = (dayWindow?.packages ?? []).find(candidate => candidate.package_id === id);
      for (const start of entry?.start_minutes ?? []) starts.add(start);
    }

    return [...starts].sort((a, b) => a - b);
  };

  /** The next minute staff can actually START a booking here, not just the first unoccupied minute. */
  const nextBookableFrom = (column: ScheduleColumn, atMinute: number): number => {
    const offered = offeredStartsFor(column, atMinute).filter(start => start >= atMinute);
    return offered.length > 0 ? Math.min(...offered) : atMinute;
  };

  const slotMinuteFor = (column: ScheduleColumn, rawMinute: number): number => {
    const interval = intervalForColumn(column);
    const columnClose = column.closeMinutes ?? timeWindow.end;
    const offered = offeredStartsFor(column, rawMinute).filter(start => start < columnClose);
    const floor = isMichiganToday ? nowMinutes : undefined;
    // Always land on a start time the packages in this space actually offer, today included —
    // the interval is only a fallback for a stretch no package covers.
    const onGrid = offered.length > 0 ? snapToOfferedStart(offered, rawMinute, floor) : null;
    const snapped = onGrid ?? snapToInterval(rawMinute, interval, floor);
    const columnOpen = column.openMinutes ?? timeWindow.start;
    const blocked = blockedRangesFor(column);
    const free = nextFreeMinute(columnOpen, columnClose, blocked, snapped);

    if (free === null || free === snapped) return snapped;

    const fromFree = snapToInterval(free, interval, isMichiganToday ? Math.max(free, nowMinutes) : free);

    if (onGrid === null) return fromFree;

    const freeOffered = offered.find(
      start => start >= free && nextFreeMinute(columnOpen, columnClose, blocked, start) === start
    );

    return freeOffered ?? fromFree;
  };

  /**
   * Auto-select only a package that really has a start at this minute — otherwise the booking
   * page refuses the prefilled time. The full list is still offered so staff can choose.
   */
  const offeredCandidates = (column: ScheduleColumn, minute: number): { ids: number[]; autoSelect: number | null } => {
    const ids = packagesForSlot(column, minute);
    const offering = ids.filter(id => {
      const entry = (dayWindow?.packages ?? []).find(candidate => candidate.package_id === id);
      return entry?.start_minutes ? entry.start_minutes.includes(minute) : true;
    });

    const lone = offering.length === 1 ? offering[0] : null;
    return { ids, autoSelect: lone ?? (offering.length === 0 && ids.length === 1 ? ids[0] : null) };
  };

  const navigateToSlot = (column: ScheduleColumn, minute: number) => {
    const { ids: candidates, autoSelect } = offeredCandidates(column, minute);

    navigate(
      buildBookingUrl({
        locationId: column.locationId ?? effectiveLocationId ?? dayWindow?.location_id ?? null,
        date: dateKeyOf(selectedDate),
        minute,
        roomId: column.roomId ?? null,
        packageId: autoSelect,
        packageIds: candidates,
        freeUntilMinute: freeUntilMinute(
          column.openMinutes ?? timeWindow.start,
          column.closeMinutes ?? timeWindow.end,
          blockedRangesFor(column),
          minute
        ),
        walkIn: isMichiganToday,
      })
    );
  };

  const openBookingForSlot = (column: ScheduleColumn, event: React.MouseEvent<HTMLDivElement>, originMinute: number) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const clickedMinute = minuteAtOffset(originMinute, event.clientY - bounds.top, pxPerMinute);
    navigateToSlot(column, slotMinuteFor(column, clickedMinute));
  };

  const renderColumnBackground = (column: ScheduleColumn) => {
    const closure = column.roomId ? spaceClosures.get(column.roomId) : undefined;
    const breaks = column.roomId ? roomBreaks.get(column.roomId) || [] : [];
    const roomWindow = column.roomId ? roomWindows.get(column.roomId) : undefined;
    const openMinutes = column.openMinutes ?? null;
    const closeMinutes = column.closeMinutes ?? null;
    const availableFrom = openMinutes === null ? null : Math.max(openMinutes, timeWindow.start);
    const availableTo = closeMinutes === null ? null : Math.min(closeMinutes, timeWindow.end);
    const showsAvailable =
      availableFrom !== null && availableTo !== null && availableTo > availableFrom && !roomWindow?.closed && roomWindow?.bookable !== false;
    const slotIsBookable = showsAvailable && !isPastDate;

    return (
      <>
        {showsAvailable && (
          <div
            role={slotIsBookable ? 'button' : undefined}
            tabIndex={slotIsBookable ? 0 : undefined}
            onClick={slotIsBookable ? event => openBookingForSlot(column, event, availableFrom) : undefined}
            onKeyDown={
              slotIsBookable
                ? event => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      navigateToSlot(
                        column,
                        slotMinuteFor(column, isMichiganToday ? Math.max(nowMinutes, availableFrom) : availableFrom)
                      );
                    }
                  }
                : undefined
            }
            className={`absolute inset-x-0 z-[1] bg-gray-100 ${slotIsBookable ? 'cursor-pointer transition hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-gray-400' : ''}`}
            style={{
              top: (availableFrom - timeWindow.start) * pxPerMinute,
              height: (availableTo - availableFrom) * pxPerMinute,
            }}
            title={`Available ${formatTime12Hour(minutesToTime(availableFrom))} – ${formatTime12Hour(minutesToTime(availableTo))}${
              slotIsBookable ? ' — click to start a booking' : ''
            }`}
            aria-label={
              slotIsBookable
                ? `Start a booking in ${column.name}`
                : `${column.name} available ${formatTime12Hour(minutesToTime(availableFrom))} to ${formatTime12Hour(minutesToTime(availableTo))}`
            }
          />
        )}
        {!showsAvailable && !closure?.fullDay && roomWindow?.reason && (
          <div className="absolute inset-0 z-[1] flex items-start justify-center bg-gray-50/70 pt-8">
            <span className="rounded-full border border-gray-200 bg-white/80 px-2 py-0.5 text-[10px] font-medium text-gray-500">
              {roomWindow.reason}
            </span>
          </div>
        )}
        {closure?.fullDay && (
          <div className="absolute inset-0 bg-red-50/80 z-[5] flex items-start justify-center pt-8">
            <span className="text-[10px] font-semibold text-red-500 bg-white/80 border border-red-200 rounded-full px-2 py-0.5">Closed all day</span>
          </div>
        )}
        {!closure?.fullDay && closure?.ranges.map((r, i) => {
          const start = Math.max(r.time_start ? timeToMinutes(r.time_start) : timeWindow.start, timeWindow.start);
          const end = Math.min(r.time_end ? timeToMinutes(r.time_end) : timeWindow.end, timeWindow.end);
          if (end <= start) return null;
          return (
            <div
              key={`closure-${i}`}
              className="absolute left-0.5 right-0.5 bg-red-50/90 border border-dashed border-red-200 rounded z-[5] flex items-center justify-center"
              style={{ top: (start - timeWindow.start) * pxPerMinute, height: (end - start) * pxPerMinute }}
            >
              <span className="text-[10px] font-medium text-red-500">Closed</span>
            </div>
          );
        })}
        {breaks.map((brk, i) => (
          <div
            key={`break-${i}`}
            className="absolute left-0.5 right-0.5 bg-gray-100 border-2 border-dashed border-gray-300 rounded z-[4] flex flex-col items-center justify-center"
            style={{ top: (brk.start - timeWindow.start) * pxPerMinute, height: (brk.end - brk.start) * pxPerMinute }}
          >
            <Coffee className="w-4 h-4 text-gray-400" />
            <span className="text-[10px] font-medium text-gray-500 mt-0.5">Break</span>
          </div>
        ))}
      </>
    );
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Space Schedule</h1>
          <p className="text-gray-600">Daily space allocation and booking timeline — all times shown in Michigan time</p>
        </div>
        <Link
          to="/bookings/create"
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg bg-${fullColor} text-white text-sm font-semibold hover:opacity-90 transition shadow-sm`}
        >
          <Plus className="w-4 h-4" />
          New Booking
        </Link>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-stretch rounded-lg border border-gray-200">
              <button
                type="button"
                onClick={goToPreviousDay}
                aria-label="Previous day"
                className="px-2.5 rounded-l-lg text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="relative border-x border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowCalendar(!showCalendar)}
                  className="flex items-center gap-2 px-3.5 py-2 hover:bg-gray-50 transition"
                >
                  <Calendar className={`w-4 h-4 text-${fullColor}`} />
                  <span className="text-sm font-semibold text-gray-900 whitespace-nowrap">
                    {selectedDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                </button>

              {showCalendar && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowCalendar(false)}
                  />

                  <div className="absolute top-full left-0 mt-2 bg-white rounded-lg shadow-xl border border-gray-200 p-4 z-50 animate-scale-in">
                    <div className="flex items-center justify-between mb-4">
                      <button
                        onClick={goToPreviousMonth}
                        className="p-2 hover:bg-gray-100 rounded-lg transition"
                      >
                        <ChevronLeft className="w-5 h-5 text-gray-600" />
                      </button>
                      <div className="text-base font-semibold text-gray-900">
                        {calendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                      </div>
                      <button
                        onClick={goToNextMonth}
                        className="p-2 hover:bg-gray-100 rounded-lg transition"
                      >
                        <ChevronRight className="w-5 h-5 text-gray-600" />
                      </button>
                    </div>

                    <div className="grid grid-cols-7 gap-1 mb-2">
                      {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
                        <div key={day} className="text-center text-xs font-medium text-gray-500 py-2">
                          {day}
                        </div>
                      ))}
                    </div>

                    <div className="grid grid-cols-7 gap-1">
                      {getCalendarDays().map((day, index) => {
                        if (!day) {
                          return <div key={`empty-${index}`} className="aspect-square" />;
                        }

                        const isSelected = isSameDay(day, selectedDate);
                        const isTodayDate = isToday(day);
                        const isPast = day < michiganToday();

                        return (
                          <button
                            key={index}
                            onClick={() => selectDate(day)}
                            className={`
                              aspect-square flex items-center justify-center rounded-lg text-sm font-medium transition-all
                              ${isSelected
                                ? `bg-${fullColor} text-white shadow-md`
                                : isTodayDate
                                ? `bg-${themeColor}-100 text-${fullColor} font-semibold`
                                : isPast
                                ? 'text-gray-400 hover:bg-gray-100'
                                : 'text-gray-700 hover:bg-gray-100'
                              }
                            `}
                          >
                            {day.getDate()}
                          </button>
                        );
                      })}
                    </div>

                    <div className="mt-4 pt-4 border-t border-gray-200 flex gap-2">
                      <button
                        onClick={goToToday}
                        className={`flex-1 px-3 py-2 text-sm font-medium text-${fullColor} bg-${themeColor}-50 hover:bg-${themeColor}-100 rounded-lg transition`}
                      >
                        Today
                      </button>
                      <button
                        onClick={() => setShowCalendar(false)}
                        className="flex-1 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                </>
              )}
              </div>
              <button
                type="button"
                onClick={goToNextDay}
                aria-label="Next day"
                className="px-2.5 rounded-r-lg text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {isMichiganToday ? (
              <span className={`px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide rounded-full bg-${themeColor}-100 text-${fullColor}`}>
                Today
              </span>
            ) : (
              <button
                type="button"
                onClick={goToToday}
                className={`px-3 py-1.5 text-sm font-semibold rounded-lg text-${fullColor} bg-${themeColor}-50 hover:bg-${themeColor}-100 transition`}
              >
                Today
              </button>
            )}
            {nowLineTop !== null && (
              <button
                type="button"
                onClick={scrollToNow}
                title="Scroll to current time"
                className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-semibold text-red-500 bg-red-50 hover:bg-red-100 transition"
              >
                <LocateFixed className="w-3.5 h-3.5" />
                {formatTime12Hour(`${nowTick.hour}:${String(nowTick.minute).padStart(2, '0')}`)}
              </button>
            )}
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-4 text-sm text-gray-500">
              <span>
                <span className="font-semibold text-gray-900">{daySummary.count}</span> bookings
              </span>
              <span>
                <span className="font-semibold text-gray-900">{daySummary.guests}</span> guests
              </span>
              {daySummary.unassigned > 0 && (
                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-amber-100 text-amber-700">
                  {daySummary.unassigned} no room
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={() => loadBookings()}
              title="Refresh bookings"
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition"
            >
              <RotateCw className={`w-4 h-4 ${bookingsLoading ? 'animate-spin' : ''}`} />
            </button>
            <div className="relative group">
              <button className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition">
                <Info className="w-5 h-5" />
              </button>
              <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 p-4 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                <div className="text-xs font-semibold text-gray-800 mb-3">Legend</div>

                <div className="mb-3">
                  <div className="text-xs font-medium text-gray-600 mb-2">Booking Status</div>
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-green-500 text-white rounded-full text-[10px] font-semibold">Confirmed</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-yellow-500 text-white rounded-full text-[10px] font-semibold">Pending</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-blue-500 text-white rounded-full text-[10px] font-semibold">Checked-in</span>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-gray-200">
                  <div className="text-xs font-medium text-gray-600 mb-2">Color Coding</div>
                  <p className="text-xs text-gray-500 mb-2">Each package has a unique color</p>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-3 h-3 bg-gray-100 rounded ring-1 ring-inset ring-gray-300" />
                    <span className="text-gray-600 text-xs">Available — click to book</span>
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-3 h-3 bg-gray-200 rounded border border-dashed border-gray-400 flex items-center justify-center">
                      <Coffee className="w-1.5 h-1.5 text-gray-500" />
                    </div>
                    <span className="text-gray-600 text-xs">Break Time</span>
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-3 h-0.5 bg-red-500 rounded" />
                    <span className="text-gray-600 text-xs">Current time (Michigan)</span>
                  </div>
                  <p className="text-xs text-gray-400">Tip: use ← → keys to move between days</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-1.5 overflow-x-auto pb-1">
          {weekDays.map(day => {
            const key = dateKeyOf(day);
            const count = weekCounts[key] || 0;
            const isSelected = isSameDay(day, selectedDate);
            const isTodayChip = isToday(day);
            return (
              <button
                key={key}
                type="button"
                onClick={() => selectDate(day)}
                className={`flex flex-col items-center px-3 py-1.5 rounded-lg border text-xs transition flex-shrink-0 ${
                  isSelected
                    ? `border-${themeColor}-300 bg-${themeColor}-50 text-${fullColor} font-semibold`
                    : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                <span className={`uppercase tracking-wide text-[10px] ${isTodayChip && !isSelected ? `text-${fullColor} font-bold` : 'opacity-70'}`}>
                  {isTodayChip ? 'Today' : day.toLocaleDateString('en-US', { weekday: 'short' })}
                </span>
                <span className="flex items-center gap-1 font-semibold text-sm">
                  {day.getDate()}
                  {count > 0 && (
                    <span className={`px-1 rounded-full text-[10px] font-bold ${isSelected ? `bg-${themeColor}-100` : 'bg-gray-100 text-gray-500'}`}>
                      {count}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-2 pt-3 border-t border-gray-100 flex flex-wrap items-center gap-x-3 gap-y-2">
          <div className="flex-1 min-w-[240px] [&>div]:mb-0">
            <CategoryTabs
              options={categoryOptions}
              value={effectiveCategory}
              onChange={setCategoryFilter}
              totalCount={activeBookings.length}
            />
          </div>
          <div className="flex items-center gap-1.5">
            <CustomerSearch
              locationId={effectiveLocationId}
              onSelect={openBookingFromSearch}
              placeholder="Find any booking"
              className="w-52"
              themeColor={themeColor}
              fullColor={fullColor}
            />
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                type="text"
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                placeholder="Filter this day"
                className="w-40 pl-8 pr-2.5 py-1.5 border border-gray-200 rounded-lg bg-gray-50 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="px-2.5 py-1.5 border border-gray-200 rounded-lg bg-gray-50 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {STATUS_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setHideEmptySpaces(v => !v)}
              aria-pressed={hideEmptySpaces}
              title={hideEmptySpaces ? 'Show empty spaces' : 'Hide empty spaces'}
              className={`p-2 rounded-lg border transition ${
                hideEmptySpaces
                  ? `border-${themeColor}-200 bg-${themeColor}-50 text-${fullColor}`
                  : 'border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100'
              }`}
            >
              {hideEmptySpaces ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
            <div className="flex items-center rounded-lg border border-gray-200">
              <button
                type="button"
                onClick={() => changeZoom(zoomLevel - 1)}
                disabled={zoomLevel === 0}
                title="Compact view"
                className="p-2 rounded-l-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => changeZoom(zoomLevel + 1)}
                disabled={zoomLevel === ZOOM_LEVELS.length - 1}
                title="Expanded view"
                className="p-2 rounded-r-lg border-l border-gray-200 text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
            </div>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                title="Clear filters"
                className="p-2 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        {columns.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <div className={`w-20 h-20 rounded-full bg-${themeColor}-100 flex items-center justify-center mb-4`}>
              <Calendar className={`w-10 h-10 text-${fullColor}`} />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Spaces To Show</h3>
            <p className="text-gray-600 text-center max-w-md">
              No spaces are configured for this location, so there is no schedule to display.
            </p>
          </div>
        ) : (
          <>
            {activeBookings.length === 0 && (
              <div className="flex items-center gap-2 border-b border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-600">
                <Calendar className="h-4 w-4 shrink-0 text-gray-400" />
                <span>
                  No bookings for {selectedDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} — every space below is open for its scheduled hours.
                </span>
              </div>
            )}
            {activeBookings.length > 0 && filteredBookings.length === 0 && (
              <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-600">
                <Search className="h-4 w-4 shrink-0 text-gray-400" />
                <span>
                  {activeBookings.length} {activeBookings.length === 1 ? 'booking is' : 'bookings are'} scheduled this day, but none match the current filters.
                </span>
                <StandardButton variant="secondary" size="sm" onClick={clearFilters}>
                  Clear filters
                </StandardButton>
              </div>
            )}
          <div ref={scrollRef} className="overflow-auto max-h-[72vh] relative">
            <div className="min-w-max">
              <div className="sticky top-0 z-30 flex bg-gray-50 border-b border-gray-200">
                <div
                  className="sticky left-0 z-40 bg-gray-50 border-r border-gray-200 flex items-center justify-center px-1 py-1"
                  style={{ width: GUTTER_WIDTH, minWidth: GUTTER_WIDTH }}
                >
                  <Clock className="w-4 h-4 text-gray-500" />
                </div>
                {columns.map(column => (
                  <div
                    key={column.key}
                    className="px-1 py-1 text-center border-r border-gray-200"
                    style={{ width: COLUMN_WIDTH, minWidth: COLUMN_WIDTH }}
                  >
                    <div className="flex flex-col items-center gap-0.5 leading-none">
                      <span className="text-[11px] font-semibold text-gray-700 leading-tight truncate max-w-full">{column.name}</span>
                      {column.virtual ? (
                        <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 leading-tight rounded-full">
                          No room assigned
                        </span>
                      ) : null}
                      {column.roomId && spaceClosures.has(column.roomId) && (
                        <span className="text-[10px] font-semibold text-red-600 bg-red-50 border border-red-200 px-1.5 leading-tight rounded-full">
                          {getSpaceClosureLabel(column.roomId)}
                        </span>
                      )}
                      {(() => {
                        const state = freeFromByColumn.get(column.key);
                        if (!state) return null;
                        if (state.kind === 'closed') {
                          return <span className="text-[10px] font-medium text-gray-500">Not bookable</span>;
                        }
                        if (state.kind === 'booked') {
                          return <span className="text-[10px] font-medium text-gray-500">Booked until close</span>;
                        }
                        if (state.kind === 'day-over') {
                          return <span className="text-[10px] font-medium text-gray-500">Closed for the day</span>;
                        }
                        if (state.kind === 'blocked') {
                          return <span className="text-[10px] font-medium text-gray-500">{state.reason}</span>;
                        }
                        if (isMichiganToday && state.atMinute <= nowMinutes) {
                          return <span className="text-[10px] font-semibold text-green-700">Free now</span>;
                        }
                        return (
                          <span className="text-[10px] font-medium text-gray-600">
                            Free {formatTime12Hour(minutesToTime(nextBookableFrom(column, state.atMinute)))}
                          </span>
                        );
                      })()}
                    </div>
                  </div>
                ))}
              </div>

              <div className="relative flex">
                <div
                  className="sticky left-0 z-20 bg-white border-r border-gray-200"
                  style={{ width: GUTTER_WIDTH, minWidth: GUTTER_WIDTH, height: timeWindow.total * pxPerMinute }}
                >
                  {hourMarks.map(mark => (
                    <div
                      key={mark}
                      className={`absolute right-2 text-xs font-medium text-gray-500 ${
                        mark === timeWindow.start ? 'translate-y-0.5' : mark === timeWindow.end ? '-translate-y-full' : '-translate-y-1/2'
                      }`}
                      style={{ top: (mark - timeWindow.start) * pxPerMinute }}
                    >
                      {minutesToLabel(mark)}
                    </div>
                  ))}
                  {nowLineTop !== null && (
                    <div
                      className="absolute right-1 z-30 -translate-y-1/2 px-1.5 py-0.5 rounded bg-red-500 text-white text-[10px] font-bold whitespace-nowrap"
                      style={{ top: nowLineTop }}
                    >
                      {formatTime12Hour(`${nowTick.hour}:${String(nowTick.minute).padStart(2, '0')}`)}
                    </div>
                  )}
                </div>

                <div className="relative flex" style={{ height: timeWindow.total * pxPerMinute }}>
                  <div className="absolute inset-0 pointer-events-none">
                    {hourMarks.map(mark => (
                      <div key={mark}>
                        <div
                          className="absolute left-0 right-0 border-t border-gray-200"
                          style={{ top: (mark - timeWindow.start) * pxPerMinute }}
                        />
                        {mark + 30 < timeWindow.end && (
                          <div
                            className="absolute left-0 right-0 border-t border-dashed border-gray-100"
                            style={{ top: (mark + 30 - timeWindow.start) * pxPerMinute }}
                          />
                        )}
                      </div>
                    ))}
                  </div>

                  {columns.map(column => (
                    <div
                      key={column.key}
                      className={`relative border-r border-gray-200 ${column.virtual ? 'bg-amber-50/20' : ''}`}
                      style={{ width: COLUMN_WIDTH, minWidth: COLUMN_WIDTH }}
                    >
                      {renderColumnBackground(column)}
                      {(positionedByColumn.get(column.key) || []).map(renderBookingBlock)}
                    </div>
                  ))}

                  {nowLineTop !== null && (
                    <div
                      className="absolute left-0 right-0 z-20 pointer-events-none"
                      style={{ top: nowLineTop }}
                    >
                      <div className="h-0.5 bg-red-500 shadow-[0_1px_3px_rgba(239,68,68,0.4)]" />
                      <div className="absolute -top-[3px] left-0 w-2 h-2 rounded-full bg-red-500" />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          </>
        )}
      </div>


      {selectedBooking && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-backdrop-fade" onClick={() => setSelectedBooking(null)}>
          <div className="bg-white rounded-lg shadow-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-semibold text-gray-900">Booking Details</h3>
                <StandardButton
                  variant="ghost"
                  size="sm"
                  icon={X}
                  onClick={() => setSelectedBooking(null)}
                >
                  {''}
                </StandardButton>
              </div>

              <div className="mb-6">
                <h4 className="text-sm font-semibold text-gray-700 uppercase mb-3">Customer Information</h4>
                <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                  <div className="flex items-center">
                    <Users className="h-4 w-4 text-gray-400 mr-3" />
                    <span className="font-medium text-gray-900">{selectedBooking.guest_name || 'Guest'}</span>
                  </div>
                  {selectedBooking.guest_email && (
                    <div className="text-sm text-gray-600 ml-7">{selectedBooking.guest_email}</div>
                  )}
                  {selectedBooking.guest_phone && (
                    <div className="text-sm text-gray-600 ml-7">{selectedBooking.guest_phone}</div>
                  )}
                </div>
              </div>

              <div className="mb-6">
                <h4 className="text-sm font-semibold text-gray-700 uppercase mb-3">Booking Information</h4>
                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Reference Number</span>
                    <span className="font-mono font-medium text-gray-900">#{selectedBooking.reference_number}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Status</span>
                    <span className={`px-3 py-1 text-xs font-medium rounded-full ${
                      selectedBooking.status === 'confirmed' ? 'bg-green-100 text-green-800' :
                      selectedBooking.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                      selectedBooking.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                      selectedBooking.status === 'checked-in' ? `bg-${themeColor}-100 text-${fullColor}` :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {selectedBooking.status}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mb-6">
                <h4 className="text-sm font-semibold text-gray-700 uppercase mb-3">Date & Time</h4>
                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  <div className="flex items-center">
                    <Calendar className="h-4 w-4 text-gray-400 mr-3" />
                    <span className="text-sm text-gray-900">{parseLocalDate(selectedBooking.booking_date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                  </div>
                  <div className="flex items-center">
                    <Clock className="h-4 w-4 text-gray-400 mr-3" />
                    <span className="text-sm font-medium text-gray-900">
                      {formatTime12Hour(selectedBooking.booking_time)} - {formatTime12Hour(calculateEndTime(selectedBooking.booking_time, selectedBooking.duration, selectedBooking.duration_unit))}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                    <span className="text-sm text-gray-600">Duration</span>
                    <span className="text-sm font-medium text-gray-900">{formatDuration(selectedBooking.duration, selectedBooking.duration_unit)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Participants</span>
                    <span className="text-sm font-medium text-gray-900">{selectedBooking.participants}</span>
                  </div>
                </div>
              </div>

              <div className="mb-6">
                <h4 className="text-sm font-semibold text-gray-700 uppercase mb-3">Package</h4>
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <PackageIcon className="h-4 w-4 text-gray-400 mr-3" />
                      <span className="font-medium text-gray-900">{selectedBooking.package?.name || 'N/A'}</span>
                    </div>
                    {selectedBooking.package?.price && (
                      <span className="text-sm font-medium text-gray-900">${Number(selectedBooking.package.price).toFixed(2)}</span>
                    )}
                  </div>
                  {selectedBooking.package?.description && (
                    <p className="text-sm text-gray-600 mt-2 ml-7">{selectedBooking.package.description}</p>
                  )}
                </div>
              </div>

              {(selectedBooking as any).guest_of_honor_name && (
                <div className="mb-6">
                  <h4 className="text-sm font-semibold text-gray-700 uppercase mb-3">Guest of Honor</h4>
                  <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Name</span>
                      <span className="text-sm font-medium text-gray-900">{(selectedBooking as any).guest_of_honor_name}</span>
                    </div>
                    {(selectedBooking as any).guest_of_honor_age && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Age</span>
                        <span className="text-sm font-medium text-gray-900">{(selectedBooking as any).guest_of_honor_age} years old</span>
                      </div>
                    )}
                    {(selectedBooking as any).guest_of_honor_gender && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Gender</span>
                        <span className="text-sm font-medium text-gray-900 capitalize">{(selectedBooking as any).guest_of_honor_gender}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {(selectedBooking.special_requests || selectedBooking.notes) && (
                <div className="mb-6">
                  <h4 className="text-sm font-semibold text-gray-700 uppercase mb-3">Notes & Requests</h4>
                  <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                    {selectedBooking.special_requests && (
                      <div>
                        <span className="text-xs font-medium text-gray-600 uppercase">Special Requests</span>
                        <p className="text-sm text-gray-900 mt-1">{selectedBooking.special_requests}</p>
                      </div>
                    )}
                    {selectedBooking.notes && (
                      <div className={selectedBooking.special_requests ? 'pt-3 border-t border-gray-200' : ''}>
                        <span className="text-xs font-medium text-gray-600 uppercase">Internal Notes</span>
                        <p className="text-sm text-gray-900 mt-1">{selectedBooking.notes}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="border-t pt-6">
                <h4 className="text-sm font-semibold text-gray-700 uppercase mb-3">Payment Details</h4>
                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Payment Method</span>
                    <span className="text-sm font-medium text-gray-900 capitalize">{selectedBooking.payment_method || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Payment Status</span>
                    <span className={`px-3 py-1 text-xs font-medium rounded-full ${resolvePaymentState(selectedBooking).pillClass}`}>
                      {resolvePaymentState(selectedBooking).label}
                    </span>
                  </div>
                  {cardFromPayments(selectedBooking.payments) && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Card</span>
                      <span className="text-sm font-medium text-gray-900">{cardFromPayments(selectedBooking.payments)?.label}</span>
                    </div>
                  )}
                  <div className="pt-3 border-t border-gray-200">
                    <div className="flex justify-between items-center text-base">
                      <span className="font-medium text-gray-900">Total Amount</span>
                      <span className="font-semibold text-gray-900 text-lg">${parseFloat(String(selectedBooking.total_amount)).toFixed(2)}</span>
                    </div>
                    {selectedBooking.payment_status === 'partial' && (
                      <div className="flex justify-between items-center mt-2 text-sm">
                        <span className="text-gray-600">Amount Paid</span>
                        <span className="text-gray-900">${parseFloat(String(selectedBooking.amount_paid)).toFixed(2)}</span>
                      </div>
                    )}
                    {selectedBooking.applied_fees && selectedBooking.applied_fees.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-gray-100">
                        <p className="text-xs text-gray-500 mb-1">Fees</p>
                        {selectedBooking.applied_fees.map((fee: { fee_name: string; fee_amount: number; fee_application_type: string }, i: number) => (
                          <div key={i} className="flex justify-between text-xs">
                            <span className="text-gray-600">{fee.fee_name} <span className="text-gray-400">({fee.fee_application_type})</span></span>
                            <span className="text-gray-900">${fee.fee_amount.toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {(selectedBooking as any).applied_discounts && (selectedBooking as any).applied_discounts.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-gray-100">
                        <p className="text-xs text-gray-500 mb-1">Discounts</p>
                        {(selectedBooking as any).applied_discounts.map((d: { discount_name: string; discount_amount: number; discount_type: string }, i: number) => (
                          <div key={i} className="flex justify-between text-xs">
                            <span className="text-gray-600">{d.discount_name} <span className="text-gray-400">({d.discount_type})</span></span>
                            <span className="text-green-600">-${d.discount_amount.toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="mb-6">
                <h4 className="text-sm font-semibold text-gray-700 uppercase mb-3 flex items-center gap-2">
                  <FileText size={14} /> Internal Notes
                </h4>
                <div className="bg-gray-50 rounded-lg p-4">
                  {editingNotes ? (
                    <div className="space-y-3">
                      <textarea
                        value={tempNotes}
                        onChange={(e) => setTempNotes(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                        rows={3}
                        placeholder="Add internal notes..."
                      />
                      <div className="flex gap-2 justify-end">
                        <StandardButton
                          variant="ghost"
                          size="sm"
                          onClick={() => { setEditingNotes(false); setTempNotes((selectedBooking as any).internal_notes || ''); }}
                        >
                          Cancel
                        </StandardButton>
                        <StandardButton
                          variant="primary"
                          size="sm"
                          icon={savingNotes ? Loader2 : Save}
                          disabled={savingNotes}
                          onClick={async () => {
                            setSavingNotes(true);
                            try {
                              await bookingService.updateInternalNotes(selectedBooking.id, tempNotes);
                              setSelectedBooking({ ...selectedBooking, internal_notes: tempNotes } as any);
                              setBookings(prev => prev.map(b => b.id === selectedBooking.id ? { ...b, internal_notes: tempNotes } as any : b));
                              setEditingNotes(false);
                            } catch (err) {
                              console.error('Failed to save notes:', err);
                            } finally {
                              setSavingNotes(false);
                            }
                          }}
                        >
                          {savingNotes ? 'Saving...' : 'Save'}
                        </StandardButton>
                      </div>
                    </div>
                  ) : (
                    <div
                      className="cursor-pointer hover:bg-gray-100 rounded p-2 -m-2 transition-colors"
                      onClick={() => { setTempNotes((selectedBooking as any).internal_notes || ''); setEditingNotes(true); }}
                    >
                      {(selectedBooking as any).internal_notes ? (
                        <p className="text-sm text-gray-900 whitespace-pre-wrap">{(selectedBooking as any).internal_notes}</p>
                      ) : (
                        <p className="text-sm text-gray-400 italic">Click to add internal notes...</p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-gray-200 space-y-2">
                <div className="flex gap-2">
                  <Link
                    to={`/bookings/${selectedBooking.id}?from=space-schedule`}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    onClick={() => { setSelectedBooking(null); setEditingNotes(false); }}
                  >
                    <Eye size={15} />
                    View
                  </Link>
                  <Link
                    to={`/bookings/edit/${selectedBooking.id}?from=space-schedule`}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    onClick={() => { setSelectedBooking(null); setEditingNotes(false); }}
                  >
                    <Edit size={15} />
                    Edit
                  </Link>
                  {selectedBooking.status !== 'checked-in' && selectedBooking.status !== 'completed' && selectedBooking.status !== 'cancelled' && selectedBooking.payment_status === 'paid' && (
                    !showCheckInConfirm ? (
                      <button
                        onClick={() => setShowCheckInConfirm(true)}
                        className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-emerald-700 bg-white border border-emerald-300 rounded-lg hover:bg-emerald-50 transition-colors"
                      >
                        <LogIn size={15} />
                        Check In
                      </button>
                    ) : null
                  )}
                  {selectedBooking.status !== 'checked-in' && selectedBooking.status !== 'completed' && selectedBooking.status !== 'cancelled' && selectedBooking.payment_status !== 'paid' && (
                    <button
                      onClick={handleOpenPaymentModal}
                      className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-amber-700 bg-white border border-amber-300 rounded-lg hover:bg-amber-50 transition-colors"
                    >
                      <DollarSign size={15} />
                      Process Payment
                    </button>
                  )}
                  {selectedBooking.status === 'checked-in' && (
                    <div className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg">
                      <CheckCircle size={15} />
                      Checked In
                    </div>
                  )}
                </div>

                {showCheckInConfirm && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <p className="text-sm text-amber-800 font-medium mb-2">Confirm check-in for this party?</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowCheckInConfirm(false)}
                        className="flex-1 px-3 py-2 text-sm font-medium rounded-lg bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                      <button
                        disabled={checkInLoading}
                        onClick={async () => {
                          setCheckInLoading(true);
                          try {
                            await bookingService.checkInBooking(selectedBooking.reference_number);
                            setSelectedBooking({ ...selectedBooking, status: 'checked-in' } as any);
                            setBookings(prev => prev.map(b => b.id === selectedBooking.id ? { ...b, status: 'checked-in' } as any : b));
                            setShowCheckInConfirm(false);
                          } catch (err) {
                            console.error('Check-in failed:', err);
                          } finally {
                            setCheckInLoading(false);
                          }
                        }}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
                      >
                        {checkInLoading ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                        {checkInLoading ? 'Checking in...' : 'Confirm'}
                      </button>
                    </div>
                  </div>
                )}

                <StandardButton
                  onClick={() => { setSelectedBooking(null); setEditingNotes(false); setShowCheckInConfirm(false); }}
                  variant="secondary"
                  size="md"
                  className="w-full"
                >
                  Close
                </StandardButton>
              </div>
            </div>
          </div>
        </div>
      )}

      {showPaymentModal && selectedBooking && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={handleClosePaymentModal}>
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className={`p-6 border-b border-gray-100 bg-${themeColor}-50`}>
              <h2 className="text-xl font-bold text-gray-900">Process Payment</h2>
              <p className="text-sm text-gray-600 mt-1">Booking: {selectedBooking.reference_number}</p>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Total Amount:</span>
                  <span className="font-semibold">${Number(selectedBooking.total_amount || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Already Paid:</span>
                  <span className="font-semibold text-green-600">${Number(selectedBooking.amount_paid || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm pt-2 border-t border-gray-200">
                  <span className="text-gray-900 font-medium">Remaining Balance:</span>
                  <span className="font-bold text-red-600">${(Number(selectedBooking.total_amount || 0) - Number(selectedBooking.amount_paid || 0)).toFixed(2)}</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Payment Amount *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                  <input type="number" step="0.01" min="0.01"
                    max={(Number(selectedBooking.total_amount || 0) - Number(selectedBooking.amount_paid || 0)).toFixed(2)}
                    value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)}
                    className={`w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-transparent`}
                    placeholder="0.00" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Payment Method *</label>
                <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as 'card' | 'in-store')}
                  className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-transparent`}>
                  <option value="in-store">In-Store</option>
                  <option value="card">Card</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Notes (Optional)</label>
                <textarea value={paymentNotes} onChange={(e) => setPaymentNotes(e.target.value)} rows={3}
                  className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-transparent`}
                  placeholder="Add any notes about this payment..." />
              </div>
            </div>
            <div className="p-6 border-t border-gray-100 flex gap-3 justify-end">
              <StandardButton variant="secondary" onClick={handleClosePaymentModal} disabled={processingPayment}>Cancel</StandardButton>
              <StandardButton variant="primary" onClick={handleSubmitPayment}
                disabled={processingPayment || !paymentAmount || parseFloat(paymentAmount) <= 0}
                loading={processingPayment}>
                {processingPayment ? 'Processing...' : 'Process Payment'}
              </StandardButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SpaceSchedule;
