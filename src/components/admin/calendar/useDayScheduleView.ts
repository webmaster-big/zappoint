import { useEffect, useState } from 'react';

export function useHideEmptySpaces(storageKey: string) {
  const [hideEmptySpaces, setHideEmptySpaces] = useState<boolean>(() => {
    try {
      const raw = sessionStorage.getItem(storageKey);
      return raw === null ? true : raw === 'true';
    } catch {
      return true;
    }
  });

  useEffect(() => {
    try {
      sessionStorage.setItem(storageKey, String(hideEmptySpaces));
    } catch {
      // sessionStorage can throw in private mode; the toggle just will not persist
    }
  }, [storageKey, hideEmptySpaces]);

  return [hideEmptySpaces, setHideEmptySpaces] as const;
}
