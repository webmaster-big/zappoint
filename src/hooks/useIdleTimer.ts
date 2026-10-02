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

interface Options {
  seconds: number | null;
  onIdle: () => void;
  enabled?: boolean;
}

export function useIdleTimer({ seconds, onIdle, enabled = true }: Options): void {
  const callback = useRef(onIdle);
  callback.current = onIdle;

  useEffect(() => {
    if (!enabled || !seconds || seconds <= 0) return;

    let timer: ReturnType<typeof setTimeout> | null = null;

    const fire = () => {
      timer = null;
      callback.current();
    };

    const reset = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(fire, seconds * 1000);
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
  }, [seconds, enabled]);
}
