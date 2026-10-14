import { useCallback, useEffect, useRef, useState } from 'react';

export type CameraState = 'idle' | 'starting' | 'live' | 'denied' | 'unavailable' | 'lost';

export type CameraTurn = 0 | 90 | 270;

interface UsePhotoCameraOptions {
  facingMode?: 'user' | 'environment';
  autoStart?: boolean;
  followDeviceOrientation?: boolean;
}

interface FrameSize {
  width: number;
  height: number;
}

interface SensorReading {
  settled: number | null;
  nearest: number | null;
  confident: boolean;
}

type MotionAccess = 'unknown' | 'granted' | 'denied';

type OrientationPermissionApi = { requestPermission?: () => Promise<'granted' | 'denied' | 'default'> };

const MIN_UPRIGHTNESS = 0.5;
const STAY_DEGREES = 67.5;
const NEAREST_RELEASE_DEGREES = 52;
const CONFIDENT_ON_DEGREES = 25;
const CONFIDENT_OFF_DEGREES = 35;
const SETTLE_MS = 200;
const MOTION_PROMPT_WAIT_MS = 15000;
const NO_READING: SensorReading = { settled: null, nearest: null, confident: false };

const normalizeAngle = (degrees: number): number => ((Math.round(degrees) % 360) + 360) % 360;

const angularGap = (a: number, b: number): number => {
  const gap = Math.abs(a - b) % 360;
  return gap > 180 ? 360 - gap : gap;
};

const nearestQuarter = (degrees: number): number => normalizeAngle(Math.round(degrees / 90) * 90);

const screenAngle = (): number => {
  const angle = typeof screen !== 'undefined' ? screen.orientation?.angle : undefined;
  if (typeof angle === 'number' && Number.isFinite(angle)) return normalizeAngle(angle);
  const legacy = (window as unknown as { orientation?: unknown }).orientation;
  return typeof legacy === 'number' && Number.isFinite(legacy) ? normalizeAngle(legacy) : 0;
};

const screenIsLandscape = (): boolean => {
  const type = typeof screen !== 'undefined' ? screen.orientation?.type : undefined;
  if (typeof type === 'string' && type) return type.startsWith('landscape');
  return window.innerWidth > window.innerHeight;
};

const frameAngle = (width: number, height: number, ui: number, portraitUi: number): number | null => {
  if (width === height) return ui;
  const frameLandscape = width > height;
  if (frameLandscape === screenIsLandscape()) return ui;
  if (!frameLandscape && ui % 180 !== 0) return portraitUi;
  return null;
};

const appleTouchDevice = (): boolean =>
  typeof navigator !== 'undefined' &&
  (/iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

export const motionPromptExpected = (): boolean => {
  const api = (typeof window !== 'undefined' ? window.DeviceOrientationEvent : undefined) as OrientationPermissionApi | undefined;
  return appleTouchDevice() && !!api && typeof api.requestPermission === 'function';
};

export const usePhotoCamera = ({ facingMode = 'user', autoStart = false, followDeviceOrientation = true }: UsePhotoCameraOptions = {}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [state, setState] = useState<CameraState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [frame, setFrame] = useState<FrameSize | null>(null);
  const [reading, setReading] = useState<SensorReading>(NO_READING);
  const [uiAngle, setUiAngle] = useState<number>(() => screenAngle());
  const settledRef = useRef<number | null>(null);
  const upRef = useRef<number | null>(null);
  const nearestRef = useRef<number | null>(null);
  const confidentRef = useRef(false);
  const portraitUiRef = useRef(0);
  const publishedRef = useRef<SensorReading>(NO_READING);
  const startingRef = useRef(false);
  const motionAccess = useRef<MotionAccess>('unknown');
  const motionRequest = useRef<Promise<void> | null>(null);
  const tracksTurns = followDeviceOrientation && facingMode === 'environment';

  const requestMotionAccess = useCallback(() => {
    if (!tracksTurns || motionAccess.current !== 'unknown' || motionRequest.current) return;
    const api = (typeof window !== 'undefined' ? window.DeviceOrientationEvent : undefined) as OrientationPermissionApi | undefined;
    if (!api || typeof api.requestPermission !== 'function') {
      motionAccess.current = 'granted';
      return;
    }
    try {
      motionRequest.current = api
        .requestPermission()
        .then((result) => {
          motionAccess.current = result === 'granted' ? 'granted' : 'denied';
        })
        .catch(() => undefined)
        .finally(() => {
          motionRequest.current = null;
        });
    } catch {
      motionRequest.current = null;
    }
  }, [tracksTurns]);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setFrame(null);
    setState('idle');
  }, []);

  const start = useCallback(async () => {
    requestMotionAccess();

    if (startingRef.current) return false;

    if (!navigator.mediaDevices?.getUserMedia) {
      setState('unavailable');
      setError('This browser cannot open a camera. Use a photo from the device instead.');
      return false;
    }

    startingRef.current = true;
    setState('starting');
    setError(null);

    try {
      const pendingMotion = motionRequest.current;
      if (pendingMotion && appleTouchDevice()) {
        await Promise.race([pendingMotion, new Promise((resolve) => setTimeout(resolve, MOTION_PROMPT_WAIT_MS))]);
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
        if (videoRef.current.videoWidth > 0) {
          setFrame({ width: videoRef.current.videoWidth, height: videoRef.current.videoHeight });
        }
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
    } finally {
      startingRef.current = false;
    }
  }, [facingMode, requestMotionAccess]);

  const isLive = state === 'live';

  useEffect(() => {
    if (!isLive) return;
    const measure = (event?: Event) => {
      const video = videoRef.current;
      if (!video || (event && event.target !== video)) return;
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        setFrame((current) =>
          current && current.width === video.videoWidth && current.height === video.videoHeight
            ? current
            : { width: video.videoWidth, height: video.videoHeight },
        );
      }
    };
    measure();
    document.addEventListener('loadedmetadata', measure, true);
    document.addEventListener('resize', measure, true);
    return () => {
      document.removeEventListener('loadedmetadata', measure, true);
      document.removeEventListener('resize', measure, true);
    };
  }, [isLive]);

  useEffect(() => {
    if (!tracksTurns || !isLive) return;

    let candidate: number | null = null;
    let settle: ReturnType<typeof setTimeout> | null = null;

    const publish = () => {
      const next = { settled: settledRef.current, nearest: nearestRef.current, confident: confidentRef.current };
      const shown = publishedRef.current;
      if (shown.settled === next.settled && shown.nearest === next.nearest && shown.confident === next.confident) return;
      publishedRef.current = next;
      setReading(next);
    };
    const commit = (angle: number) => {
      settledRef.current = angle;
      publish();
    };
    const dropCandidate = () => {
      candidate = null;
      if (settle) clearTimeout(settle);
      settle = null;
    };

    const onOrientation = (event: DeviceOrientationEvent) => {
      if (event.beta === null || event.gamma === null) return;
      const beta = (event.beta * Math.PI) / 180;
      const gamma = (event.gamma * Math.PI) / 180;
      const x = -Math.cos(beta) * Math.sin(gamma);
      const y = Math.sin(beta);
      if (Math.hypot(x, y) < MIN_UPRIGHTNESS) {
        dropCandidate();
        return;
      }
      const up = normalizeAngle((Math.atan2(x, y) * 180) / Math.PI);
      upRef.current = up;
      const near = nearestRef.current;
      if (near === null || angularGap(up, near) > NEAREST_RELEASE_DEGREES) {
        nearestRef.current = nearestQuarter(up);
        confidentRef.current = angularGap(up, nearestRef.current) <= CONFIDENT_ON_DEGREES;
      } else {
        const gap = angularGap(up, near);
        confidentRef.current = confidentRef.current ? gap <= CONFIDENT_OFF_DEGREES : gap <= CONFIDENT_ON_DEGREES;
      }
      const current = settledRef.current;
      if (current === null) {
        commit(nearestQuarter(up));
        return;
      }
      if (angularGap(up, current) <= STAY_DEGREES) {
        dropCandidate();
        publish();
        return;
      }
      const next = nearestQuarter(up);
      publish();
      if (candidate === next) return;
      dropCandidate();
      candidate = next;
      settle = setTimeout(() => {
        if (candidate === next) commit(next);
        candidate = null;
        settle = null;
      }, SETTLE_MS);
    };
    let lastUi = screenAngle();
    const notePortrait = (ui: number) => {
      if (ui % 180 === 0 && !screenIsLandscape()) portraitUiRef.current = ui;
    };
    notePortrait(lastUi);
    const onScreen = () => {
      const ui = screenAngle();
      setUiAngle(ui);
      notePortrait(ui);
      if (ui === lastUi) return;
      lastUi = ui;
      const up = upRef.current;
      if (up !== null && settledRef.current !== ui && angularGap(up, ui) <= STAY_DEGREES) {
        dropCandidate();
        commit(ui);
      }
    };

    onScreen();
    window.addEventListener('deviceorientation', onOrientation);
    window.addEventListener('orientationchange', onScreen);
    window.addEventListener('resize', onScreen);
    screen.orientation?.addEventListener?.('change', onScreen);
    return () => {
      window.removeEventListener('deviceorientation', onOrientation);
      window.removeEventListener('orientationchange', onScreen);
      window.removeEventListener('resize', onScreen);
      screen.orientation?.removeEventListener?.('change', onScreen);
      dropCandidate();
      settledRef.current = null;
      upRef.current = null;
      nearestRef.current = null;
      confidentRef.current = false;
      publishedRef.current = NO_READING;
      setReading(NO_READING);
    };
  }, [tracksTurns, isLive]);

  const turnFor = useCallback(
    (sensor: SensorReading, ui: number, width: number, height: number): CameraTurn => {
      if (!tracksTurns || width <= 0 || height <= 0) return 0;
      const { settled, nearest, confident } = sensor;
      const madeFor = frameAngle(width, height, ui, portraitUiRef.current);
      if (madeFor === null || nearest === null || nearest === madeFor) return 0;
      const device = confident || settled === null || angularGap(nearest, settled) > 90 ? nearest : settled;
      const turn = normalizeAngle(device - madeFor);
      return turn === 90 || turn === 270 ? turn : 0;
    },
    [tracksTurns],
  );

  const turn = frame ? turnFor(reading, uiAngle, frame.width, frame.height) : 0;

  const capture = useCallback((quality = 0.92): string | null => {
    const video = videoRef.current;

    if (!video || !streamRef.current || video.videoWidth === 0) {
      return null;
    }

    const width = video.videoWidth;
    const height = video.videoHeight;
    const quarter = turnFor(
      { settled: settledRef.current, nearest: nearestRef.current, confident: confidentRef.current },
      screenAngle(),
      width,
      height,
    );
    const sideways = quarter !== 0;

    const canvas = document.createElement('canvas');
    canvas.width = sideways ? height : width;
    canvas.height = sideways ? width : height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    if (facingMode === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    if (quarter === 90) {
      ctx.translate(0, canvas.height);
      ctx.rotate(-Math.PI / 2);
    } else if (quarter === 270) {
      ctx.translate(canvas.width, 0);
      ctx.rotate(Math.PI / 2);
    }
    ctx.drawImage(video, 0, 0, width, height);

    return canvas.toDataURL('image/jpeg', quality);
  }, [facingMode, turnFor]);

  const savedSize = frame
    ? turn === 0
      ? frame
      : { width: frame.height, height: frame.width }
    : null;

  useEffect(() => {
    const video = videoRef.current;
    const stream = streamRef.current;
    if (state !== 'live' || !video || !stream || video.srcObject === stream) return;
    video.srcObject = stream;
    void video.play().catch(() => undefined);
  });

  useEffect(() => {
    if (autoStart) void start();
    return () => stop();
  }, [autoStart, start, stop]);

  return { videoRef, state, error, isLive, start, stop, capture, frame, turn, savedSize, requestMotionAccess };
};
