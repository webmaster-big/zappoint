import axios from 'axios';
import { API_BASE_URL, getStoredUser } from '../utils/storage';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
});

api.interceptors.request.use(config => {
  const token = getStoredUser()?.token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export interface WorkLocation {
  id: number;
  name: string;
  slug?: string | null;
  city?: string | null;
  state?: string | null;
}

export interface StaffLocationState {
  active_location_id: number | null;
  active_location_name: string | null;
  home_location_id: number | null;
  can_switch: boolean;
  locations: WorkLocation[];
}

export async function getStaffLocations(): Promise<StaffLocationState> {
  const response = await api.get('/staff-locations');
  return response.data?.data as StaffLocationState;
}

export async function activateStaffLocation(locationId: number): Promise<StaffLocationState> {
  const response = await api.put('/staff-locations/active', { location_id: locationId });
  return response.data?.data as StaffLocationState;
}

export function storeStaffLocationState(state: StaffLocationState): boolean {
  const user = getStoredUser();
  if (!user) return false;

  const activeChanged = Number(user.location_id ?? 0) !== Number(state.active_location_id ?? 0);
  const next = {
    ...user,
    location_id: state.active_location_id,
    location_name: state.active_location_name ?? user.location_name ?? '',
    home_location_id: state.home_location_id,
    work_locations: Array.isArray(state.locations) ? state.locations : [],
  };

  if (JSON.stringify(next) !== JSON.stringify(user)) {
    localStorage.setItem('zapzone_user', JSON.stringify(next));
  }

  return activeChanged;
}

const preferenceKey = (userId: number) => `zapzone_manager_location_${userId}`;

export function rememberManagerLocation(userId: number, locationId: number): void {
  try {
    localStorage.setItem(preferenceKey(userId), String(locationId));
  } catch {
    return;
  }
}

export function rememberedManagerLocation(userId: number): number | null {
  try {
    const value = Number(localStorage.getItem(preferenceKey(userId)));
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

export function pathAfterLocationSwitch(pathname: string, role: string): string | null {
  if (!/\/\d+(\/|$)/.test(pathname)) return null;
  return role === 'location_manager' ? '/manager/dashboard' : null;
}
