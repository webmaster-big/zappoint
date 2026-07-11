import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import locationService, { type Location } from '../services/LocationService';
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
}

const LocationContext = createContext<LocationContextType | undefined>(undefined);

export const LocationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const user = getStoredUser();
  const isCompanyAdmin = user?.role === 'company_admin';
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

  const effectiveLocationId = isCompanyAdmin ? selectedLocationId : ownLocationId;

  return (
    <LocationContext.Provider
      value={{ selectedLocationId, setSelectedLocationId, effectiveLocationId, locations, loadingLocations, isCompanyAdmin }}
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
