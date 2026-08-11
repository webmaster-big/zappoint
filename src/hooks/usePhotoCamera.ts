import { useCallback, useEffect, useRef, useState } from 'react';

export type CameraState = 'idle' | 'starting' | 'live' | 'denied' | 'unavailable' | 'lost';

interface UsePhotoCameraOptions {
  facingMode?: 'user' | 'environment';
  autoStart?: boolean;
}

export const usePhotoCamera = ({ facingMode = 'user', autoStart = false }: UsePhotoCameraOptions = {}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [state, setState] = useState<CameraState>('idle');
  const [error, setError] = useState<string | null>(null);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setState('idle');
  }, []);

  const start = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setState('unavailable');
      setError('This browser cannot open a camera. Use a photo from the device instead.');
      return false;
    }

    setState('starting');
    setError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }

      stream.getVideoTracks().forEach((track) => {
        track.addEventListener('ended', () => setState('lost'));
      });

      setState('live');
      return true;
    } catch (e) {
      const name = (e as { name?: string })?.name;
      if (name === 'NotAllowedError' || name === 'SecurityError') {
        setState('denied');
        setError(
          'Camera access is blocked. Allow the camera for this site in your browser settings, then try again.',
        );
      } else if (name === 'NotFoundError' || name === 'OverconstrainedError') {
        setState('unavailable');
        setError('No camera was found on this device.');
      } else {
        setState('unavailable');
        setError('The camera could not be opened. Please try again.');
      }
      return false;
    }
  }, [facingMode]);

  const capture = useCallback((quality = 0.92): string | null => {
    const video = videoRef.current;

    if (!video || !streamRef.current || video.videoWidth === 0) {
      return null;
    }

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    if (facingMode === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    return canvas.toDataURL('image/jpeg', quality);
  }, [facingMode]);

  const isLive = state === 'live';

  useEffect(() => {
    if (autoStart) void start();
    return () => stop();
  }, [autoStart, start, stop]);

  return { videoRef, state, error, isLive, start, stop, capture };
};
