import { useCallback, useEffect, useRef, useState } from 'react';
import { ScanLine } from 'lucide-react';

const HOLD_MS = 1200;

/**
 * The way out of a staff-launched kiosk.
 *
 * Rendered only by WaiverKiosk, and only when the launcher set `?staff=1` — never from
 * WaiverShell, which is shared with the page customers open from their email.
 *
 * It is press-and-hold rather than a tap because this tablet is handed to guests: a guest
 * brushing the corner should do nothing, while staff who know the gesture get out in about a
 * second. The kiosk is opened with window.open, so closing the tab drops the desk straight back
 * onto the check-in screen it left — same scan, same scroll. Navigation is only the fallback for
 * when the browser refuses to close the tab.
 */
export default function StaffReturnControl() {
  const [progress, setProgress] = useState(0);
  const frame = useRef<number | null>(null);
  const start = useRef<number | null>(null);

  const cancel = useCallback(() => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    start.current = null;
    setProgress(0);
  }, []);

  const leave = useCallback(() => {
    cancel();
    window.close();
    // A tab the script did not open will not close; land on check-in instead.
    window.setTimeout(() => {
      if (!window.closed) window.location.assign('/check-in');
    }, 150);
  }, [cancel]);

  const tick = useCallback(
    (now: number) => {
      if (start.current === null) start.current = now;
      const pct = Math.min(1, (now - start.current) / HOLD_MS);
      setProgress(pct);
      if (pct >= 1) {
        leave();
        return;
      }
      frame.current = requestAnimationFrame(tick);
    },
    [leave],
  );

  const begin = useCallback(() => {
    if (frame.current !== null) return;
    frame.current = requestAnimationFrame(tick);
  }, [tick]);

  useEffect(() => cancel, [cancel]);

  return (
    <div className="flex justify-center">
      <button
        type="button"
        aria-label="Hold to exit the kiosk and return to staff screens"
        onPointerDown={begin}
        onPointerUp={cancel}
        onPointerLeave={cancel}
        onPointerCancel={cancel}
        onContextMenu={(e) => e.preventDefault()}
        className="relative overflow-hidden select-none inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white/70 px-3 py-1.5 text-[11px] font-medium text-gray-400 transition-colors hover:text-gray-600"
      >
        <span
          className="absolute inset-y-0 left-0 bg-gray-200"
          style={{ width: `${progress * 100}%` }}
          aria-hidden="true"
        />
        <ScanLine className="relative h-3 w-3" />
        <span className="relative">
          {progress > 0 ? 'Keep holding…' : 'Staff — hold to exit kiosk'}
        </span>
      </button>
    </div>
  );
}
