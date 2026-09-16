import axios from 'axios';
import { API_BASE_URL, getStoredUser } from '../utils/storage';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

api.interceptors.request.use(config => {
  const token = getStoredUser()?.token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export interface ScheduleClosedRange {
  start_minutes: number;
  end_minutes: number;
  reason: string | null;
}

export interface ScheduleRoomWindow {
  room_id: number;
  location_id: number;
  interval_minutes: number | null;
  open_minutes: number | null;
  close_minutes: number | null;
  closed_all_day: boolean;
  closed_ranges?: ScheduleClosedRange[];
  bookable?: boolean;
  reason: string | null;
}

export interface SchedulePackageWindow {
  package_id: number;
  name: string;
  location_id: number;
  open_minutes: number;
  close_minutes: number;
  interval_minutes: number;
  duration_minutes?: number;
  start_minutes?: number[];
  closed_ranges?: ScheduleClosedRange[];
  room_ids: number[];
}

export interface ScheduleDayWindow {
  date: string;
  weekday: string;
  location_id: number | null;
  open_minutes: number;
  close_minutes: number;
  interval_minutes: number;
  has_schedule: boolean;
  location_closed: boolean;
  rooms: ScheduleRoomWindow[];
  packages: SchedulePackageWindow[];
}

export const FALLBACK_DAY_WINDOW: ScheduleDayWindow = {
  date: '',
  weekday: '',
  location_id: null,
  open_minutes: 10 * 60,
  close_minutes: 22 * 60,
  interval_minutes: 30,
  has_schedule: false,
  location_closed: false,
  rooms: [],
  packages: [],
};

export async function getScheduleDayWindow(
  date: string,
  locationId?: number | null,
): Promise<ScheduleDayWindow> {
  const params: Record<string, string | number> = { date };
  if (locationId != null) params.location_id = locationId;

  const response = await api.get('/schedule/day-window', { params });
  const data = response.data?.data;

  if (!data || typeof data.open_minutes !== 'number') {
    return { ...FALLBACK_DAY_WINDOW, date };
  }

  return data as ScheduleDayWindow;
}
