import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode, RefObject } from 'react';
import { motionPromptExpected } from '../../../hooks/usePhotoCamera';

interface Size {
  width: number;
  height: number;
}

interface Props {
  videoRef: RefObject<HTMLVideoElement | null>;
  frame: Size | null;
  savedSize: Size | null;
  live: boolean;
  starting?: boolean;
  roundedClassName?: string;
  children?: ReactNode;
}

type Shape = 'Landscape' | 'Portrait' | 'Square';

const BUTTON_ROW_PX = 64;
const REVEAL_AFTER_TURN_MS = 350;

const shapeOf = (size: Size | null): Shape | null => {
  if (!size) return null;
  if (size.width > size.height) return 'Landscape';
  if (size.width < size.height) return 'Portrait';
  return 'Square';
};

const touchDevice = (): boolean => typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)').matches;

export const MotionAccessNote = ({ className = '' }: { className?: string }) =>
  motionPromptExpected() ? (
    <p className={`text-xs text-gray-500 ${className}`}>
      If the phone asks to use motion and orientation, tap Allow. It lets photos taken sideways save the right way up.
    </p>
  ) : null;

const CameraViewfinder = ({ videoRef, frame, savedSize, live, starting = false, roundedClassName = 'rounded-2xl', children }: Props) => {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const [lastFrame, setLastFrame] = useState<Size | null>(null);

  useEffect(() => {
    if (frame) setLastFrame(frame);
  }, [frame]);

  const touch = touchDevice();
  const tallScreen = touch && typeof window !== 'undefined' && window.innerHeight > window.innerWidth;
  const guess = starting ? lastFrame ?? (tallScreen ? { width: 9, height: 16 } : null) : null;
  const shown = frame ?? guess ?? { width: 4, height: 3 };
  const shape = live ? shapeOf(savedSize) : null;

  useEffect(() => {
    if (!live) return;
    const reveal = () => {
      const wrapper = wrapperRef.current;
      const box = boxRef.current;
      if (!wrapper || !box) return;
      const top = box.getBoundingClientRect().top;
      const bottom = wrapper.getBoundingClientRect().bottom;
      if (top < 0 || bottom + BUTTON_ROW_PX > window.innerHeight) {
        box.scrollIntoView({ block: 'start', behavior: 'smooth' });
      }
    };
    let pending: ReturnType<typeof setTimeout> | null = null;
    const onTurn = () => {
      if (pending) clearTimeout(pending);
      pending = setTimeout(reveal, REVEAL_AFTER_TURN_MS);
    };
    reveal();
    window.addEventListener('orientationchange', onTurn);
    screen.orientation?.addEventListener?.('change', onTurn);
    return () => {
      window.removeEventListener('orientationchange', onTurn);
      screen.orientation?.removeEventListener?.('change', onTurn);
      if (pending) clearTimeout(pending);
    };
  }, [live]);

  return (
    <div ref={wrapperRef}>
      <div className="flex justify-center">
        <div
          ref={boxRef}
          className={`relative w-full overflow-hidden bg-black scroll-mt-3 max-w-[calc(60vh*var(--frame-ratio))] supports-[height:1svh]:max-w-[calc(60svh*var(--frame-ratio))] ${roundedClassName}`}
          style={{ aspectRatio: `${shown.width} / ${shown.height}`, '--frame-ratio': shown.width / shown.height } as CSSProperties}
        >
          <video ref={videoRef} playsInline muted className="w-full h-full object-contain" />
          {shape && (
            <span className="absolute bottom-2 left-2 right-2 w-fit rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-semibold text-white">
              {shape === 'Portrait' && touch ? 'Portrait photo · turn sideways for landscape' : `${shape} photo`}
            </span>
          )}
          {children}
        </div>
      </div>
      {live && touch && (
        <p className="mt-2 text-xs text-gray-600">
          Hold the phone sideways for a wide group photo. If the label still says Portrait, turn off the phone&rsquo;s rotation lock.
        </p>
      )}
    </div>
  );
};

export default CameraViewfinder;
