import { useEffect, useRef } from 'react';

const ACTIVITY_EVENTS = [
  'mousemove',
  'mousedown',
  'keydown',
  'touchstart',
  'touchmove',
  'scroll',
  'wheel',
  'pointerdown',
] as const;

const SHARED_ACTIVITY_WRITE_EVERY_MS = 5000;

interface Options {
  seconds: number | null;
  onIdle: () => void;
  enabled?: boolean;
  sharedActivityKey?: string;
}

const readSharedActivity = (key: string): number => {
  try {
    return Number(localStorage.getItem(key)) || 0;
  } catch {
    return 0;
  }
};

const writeSharedActivity = (key: string, at: number): void => {
  try {
    localStorage.setItem(key, String(at));
  } catch {
    return;
  }
};

export function useIdleTimer({ seconds, onIdle, enabled = true, sharedActivityKey }: Options): void {
  const callback = useRef(onIdle);
  callback.current = onIdle;

  useEffect(() => {
    if (!enabled || !seconds || seconds <= 0) return;

    let timer: ReturnType<typeof setTimeout> | null = null;
    let lastSharedWrite = 0;
    const idleMs = seconds * 1000;
    const sharedWriteEveryMs = Math.min(SHARED_ACTIVITY_WRITE_EVERY_MS, idleMs / 4);

    const fire = () => {
      timer = null;
      if (sharedActivityKey) {
        const quietFor = Date.now() - readSharedActivity(sharedActivityKey);
        if (quietFor < idleMs) {
          timer = setTimeout(fire, idleMs - quietFor);
          return;
        }
      }
      callback.current();
    };

    const reset = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(fire, idleMs);
      if (sharedActivityKey && Date.now() - lastSharedWrite >= sharedWriteEveryMs) {
        lastSharedWrite = Date.now();
        writeSharedActivity(sharedActivityKey, lastSharedWrite);
      }
    };

    reset();

    ACTIVITY_EVENTS.forEach((event) => {
      window.addEventListener(event, reset, { passive: true });
    });

    const onVisibility = () => {
      if (document.visibilityState === 'visible') reset();
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      if (timer) clearTimeout(timer);
      ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, reset));
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [seconds, enabled, sharedActivityKey]);
}
