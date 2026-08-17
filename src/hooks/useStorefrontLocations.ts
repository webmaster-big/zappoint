import { useEffect, useState } from 'react';
import {
  fetchStorefrontLocations,
  readCachedStorefrontLocations,
  type StorefrontLocation,
} from '../services/StorefrontLocationService';

export interface UseStorefrontLocationsResult {
  locations: StorefrontLocation[];
  loaded: boolean;
  failed: boolean;
}

export const useStorefrontLocations = (): UseStorefrontLocationsResult => {
  const [locations, setLocations] = useState<StorefrontLocation[]>(() => readCachedStorefrontLocations());
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    fetchStorefrontLocations()
      .then((rows) => {
        if (cancelled) return;
        setLocations(rows);
        setFailed(false);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { locations, loaded, failed };
};
