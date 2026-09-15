import { useEffect, useState } from 'react';
import { getScheduleDayWindow, type ScheduleDayWindow } from '../../../services/ScheduleWindowService';
import { dateKey } from '../../../utils/timeFormat';

const VERSION = 'v2';

export function useHideEmptySpaces(storageKey: string) {
  const versionedKey = `${storageKey}:${VERSION}`;

  const [hideEmptySpaces, setHideEmptySpaces] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem(versionedKey) === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      sessionStorage.setItem(versionedKey, String(hideEmptySpaces));
    } catch {
      // sessionStorage can throw in private mode; the toggle just will not persist
    }
  }, [versionedKey, hideEmptySpaces]);

  return [hideEmptySpaces, setHideEmptySpaces] as const;
}

export function useScheduleDayWindow(date: Date, locationId: number | null | undefined) {
  const [dayWindow, setDayWindow] = useState<ScheduleDayWindow | null>(null);
  const [windowLoading, setWindowLoading] = useState(true);

  const key = dateKey(date);

  useEffect(() => {
    let cancelled = false;
    setWindowLoading(true);

    getScheduleDayWindow(key, locationId ?? null)
      .then(result => {
        if (!cancelled) setDayWindow(result);
      })
      .catch(() => {
        if (!cancelled) setDayWindow(null);
      })
      .finally(() => {
        if (!cancelled) setWindowLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [key, locationId]);

  return { dayWindow, windowLoading };
}
