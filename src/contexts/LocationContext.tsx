import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import locationService, { type Location } from '../services/LocationService';
import {
  activateStaffLocation,
  getStaffLocations,
  pathAfterLocationSwitch,
  rememberManagerLocation,
  storeStaffLocationState,
  type WorkLocation,
} from '../services/StaffLocationService';
import { purgeAllZapzoneCaches } from '../utils/cacheGuard';
import { getStoredUser } from '../utils/storage';

export const LOCATION_SCOPE_ENABLED = true;

const STORAGE_KEY = 'zapzone_selected_location';
const LOCATIONS_CACHE_KEY = 'zapzone_locations';

interface LocationContextType {
  selectedLocationId: number | null;
  setSelectedLocationId: (id: number | null) => void;
  effectiveLocationId: number | null;
  locations: Location[];
  loadingLocations: boolean;
  isCompanyAdmin: boolean;
  workLocations: WorkLocation[];
  canSwitchLocation: boolean;
  switchingLocationId: number | null;
  switchLocation: (id: number) => Promise<void>;
}

const LocationContext = createContext<LocationContextType | undefined>(undefined);

const storedWorkLocations = (user: { work_locations?: unknown } | null): WorkLocation[] =>
  Array.isArray(user?.work_locations) ? (user?.work_locations as WorkLocation[]) : [];

export const LocationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const user = getStoredUser();
  const userId: number | null = user?.id ?? null;
  const role: string = user?.role ?? '';
  const isCompanyAdmin = role === 'company_admin';
  const isLocationManager = role === 'location_manager';
  const ownLocationId: number | null = user?.location_id ?? null;

  const [selectedLocationId, setSelectedLocationIdState] = useState<number | null>(() => {
    if (!isCompanyAdmin) return null;
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved || saved === 'all') return null;
    const n = Number(saved);
    return Number.isFinite(n) && n > 0 ? n : null;
  });

  const [locations, setLocations] = useState<Location[]>(() => {
    try {
      const cached = localStorage.getItem(LOCATIONS_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      /* ignore malformed cache */
    }
    return [];
  });
  const [loadingLocations, setLoadingLocations] = useState(false);
  const [fetchedWorkLocations, setFetchedWorkLocations] = useState<{ userId: number | null; list: WorkLocation[] } | null>(null);
  const [switchingLocationId, setSwitchingLocationId] = useState<number | null>(null);
  const [, setUserVersion] = useState(0);
  const workLocations: WorkLocation[] = !isLocationManager
    ? []
    : (fetchedWorkLocations && fetchedWorkLocations.userId === userId ? fetchedWorkLocations.list : storedWorkLocations(user));

  useEffect(() => {
    const refresh = () => setUserVersion((version) => version + 1);
    window.addEventListener('zapzone_profile_updated', refresh);
    return () => window.removeEventListener('zapzone_profile_updated', refresh);
  }, []);

  const setSelectedLocationId = useCallback((id: number | null) => {
    setSelectedLocationIdState(id);
    if (id === null) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, String(id));
  }, []);

  useEffect(() => {
    if (!isCompanyAdmin || !LOCATION_SCOPE_ENABLED) return;
    let cancelled = false;
    (async () => {
      setLoadingLocations(true);
      try {
        const res = await locationService.getLocations({ per_page: 100 });
        if (!cancelled && res?.data) {
          setLocations(res.data);
          try {
            localStorage.setItem(LOCATIONS_CACHE_KEY, JSON.stringify(res.data));
          } catch {
            /* ignore quota errors */
          }
        }
      } catch {
        /* keep any cached list */
      } finally {
        if (!cancelled) setLoadingLocations(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isCompanyAdmin]);

  useEffect(() => {
    if (!isLocationManager || !LOCATION_SCOPE_ENABLED) return;
    let cancelled = false;
    (async () => {
      try {
        const state = await getStaffLocations();
        if (cancelled || !state) return;
        setFetchedWorkLocations({ userId, list: Array.isArray(state.locations) ? state.locations : [] });
        if (Number(state.active_location_id ?? 0) !== Number(getStoredUser()?.location_id ?? 0)) {
          await purgeAllZapzoneCaches();
          storeStaffLocationState(state);
          window.location.reload();
          return;
        }
        storeStaffLocationState(state);
      } catch {
        return;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLocationManager, userId]);

  useEffect(() => {
    if (!isLocationManager) return;
    const onStorage = (event: StorageEvent) => {
      if (event.key !== 'zapzone_user' || !event.newValue) return;
      try {
        const next = JSON.parse(event.newValue);
        if (next?.id === userId && Number(next?.location_id ?? 0) !== Number(ownLocationId ?? 0)) {
          void purgeAllZapzoneCaches().finally(() => window.location.reload());
        }
      } catch {
        return;
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [isLocationManager, userId, ownLocationId]);

  const switchLocation = useCallback(async (id: number) => {
    if (!isLocationManager || switchingLocationId !== null) return;
    if (Number(id) === Number(ownLocationId)) return;

    setSwitchingLocationId(id);
    try {
      const state = await activateStaffLocation(id);
      await purgeAllZapzoneCaches();
      storeStaffLocationState(state);
      if (userId) rememberManagerLocation(userId, id);
      const target = pathAfterLocationSwitch(window.location.pathname, role);
      if (target) window.location.assign(target);
      else window.location.reload();
    } catch (error) {
      setSwitchingLocationId(null);
      const status = (error as { response?: { status?: number } })?.response?.status;
      if (status !== 401 && status !== 403) {
        window.dispatchEvent(new CustomEvent('api:notify', {
          detail: { message: 'Could not switch locations. Please try again.', type: 'error' },
        }));
      }
    }
  }, [isLocationManager, switchingLocationId, ownLocationId, userId, role]);

  const effectiveLocationId = isCompanyAdmin ? selectedLocationId : ownLocationId;
  const canSwitchLocation = isLocationManager && workLocations.length > 1;

  return (
    <LocationContext.Provider
      value={{
        selectedLocationId,
        setSelectedLocationId,
        effectiveLocationId,
        locations,
        loadingLocations,
        isCompanyAdmin,
        workLocations,
        canSwitchLocation,
        switchingLocationId,
        switchLocation,
      }}
    >
      {children}
    </LocationContext.Provider>
  );
};

export const useLocationScope = () => {
  const ctx = useContext(LocationContext);
  if (!ctx) throw new Error('useLocationScope must be used within a LocationProvider');
  return ctx;
};

export const useOptionalLocationScope = (): LocationContextType | null =>
  useContext(LocationContext) ?? null;
