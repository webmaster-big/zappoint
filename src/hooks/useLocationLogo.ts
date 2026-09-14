import { useEffect, useState } from 'react';
import { useOptionalLocationScope } from '../contexts/LocationContext';
import { useCompanyBrand } from './useCompanyBrand';
import locationService from '../services/LocationService';

const CACHE_KEY = 'zapzone_location_logos';

type LogoCache = Record<string, string | null>;

const readCache = (): LogoCache => {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === 'object' ? (parsed as LogoCache) : {};
  } catch {
    return {};
  }
};

const writeCache = (locationId: number, logoPath: string | null) => {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ...readCache(), [locationId]: logoPath }));
  } catch {
    /* ignore quota errors */
  }
};

export const LOCATION_LOGO_UPDATED_EVENT = 'zapzone_location_logo_updated';

export interface LocationLogoUpdate {
  locationId: number;
  logoPath: string | null;
}

export const publishLocationLogo = (locationId: number, logoPath: string | null) => {
  writeCache(locationId, logoPath);
  window.dispatchEvent(
    new CustomEvent<LocationLogoUpdate>(LOCATION_LOGO_UPDATED_EVENT, { detail: { locationId, logoPath } }),
  );
};

export const useLocationLogo = (): string | null => {
  const scope = useOptionalLocationScope();
  const locationId = scope?.effectiveLocationId ?? null;
  const scopeRow = locationId ? scope?.locations.find((l) => l.id === locationId) ?? null : null;

  const company = useCompanyBrand();
  const [locationLogo, setLocationLogo] = useState<string | null>(null);

  useEffect(() => {
    if (!locationId) {
      setLocationLogo(null);
      return;
    }

    setLocationLogo(readCache()[locationId] ?? null);

    const onLogoUpdate = (event: Event) => {
      const detail = (event as CustomEvent<LocationLogoUpdate>).detail;
      if (detail && detail.locationId === locationId) setLocationLogo(detail.logoPath);
    };

    window.addEventListener(LOCATION_LOGO_UPDATED_EVENT, onLogoUpdate);
    return () => window.removeEventListener(LOCATION_LOGO_UPDATED_EVENT, onLogoUpdate);
  }, [locationId]);

  useEffect(() => {
    if (!locationId || !scopeRow) return;

    const logoPath = scopeRow.logo_path ?? null;
    writeCache(locationId, logoPath);
    setLocationLogo(logoPath);
  }, [locationId, scopeRow]);

  useEffect(() => {
    if (!locationId || scopeRow) return;

    let cancelled = false;
    locationService
      .getLocation(locationId)
      .then((res) => {
        if (cancelled || !res?.data) return;
        const logoPath = res.data.logo_path ?? null;
        writeCache(locationId, logoPath);
        setLocationLogo(logoPath);
      })
      .catch(() => {
        /* keep whatever was cached */
      });

    return () => {
      cancelled = true;
    };
  }, [locationId, scopeRow]);

  return locationLogo ?? company.logoPath;
};

export default useLocationLogo;
