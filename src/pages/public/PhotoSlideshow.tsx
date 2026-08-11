import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Lock, PauseCircle, ShieldAlert, WifiOff } from 'lucide-react';
import photoService, { clearDeviceToken, readDeviceToken } from '../../services/PhotoService';
import type { SlideshowFeed } from '../../types/photo.types';

const POLL_MS = 10000;

const PhotoSlideshow = () => {
  const { locationId: locationParam } = useParams<{ locationId: string }>();
  const locationId = Number(locationParam);

  const [feed, setFeed] = useState<SlideshowFeed | null>(null);
  const [locked, setLocked] = useState(true);
  const [booting, setBooting] = useState(true);
  const [passcode, setPasscode] = useState('');
  const [lockError, setLockError] = useState<string | null>(null);
  const [unlocking, setUnlocking] = useState(false);
  const [disabled, setDisabled] = useState(false);
  const [offline, setOffline] = useState(false);
  const [index, setIndex] = useState(0);

  const feedRef = useRef<SlideshowFeed | null>(null);
  feedRef.current = feed;

  const photos = feed?.photos ?? [];
  const duration = (feed?.duration_seconds ?? 8) * 1000;
  const paused = feed?.is_paused ?? false;

  const refresh = useCallback(async () => {
    if (!Number.isFinite(locationId)) return;
    try {
      const next = await photoService.getSlideshowFeed(locationId);
      setFeed(next);
      setOffline(false);
      setDisabled(false);
    } catch (e) {
      const status = (e as { response?: { status?: number } })?.response?.status;
      const message = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;

      if (status === 403 && message?.includes('turned off')) {
        setDisabled(true);
        return;
      }
      if (status === 403) {
        clearDeviceToken('slideshow', locationId);
        setLocked(true);
        return;
      }
      setOffline(true);
    }
  }, [locationId]);

  useEffect(() => {
    if (!Number.isFinite(locationId)) {
      setBooting(false);
      return;
    }
    if (!readDeviceToken('slideshow', locationId)) {
      setBooting(false);
      return;
    }

    let cancelled = false;
    (async () => {
      await refresh();
      if (!cancelled) {
        setLocked(false);
        setBooting(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [locationId, refresh]);

  useEffect(() => {
    if (locked || disabled) return;
    const id = window.setInterval(() => void refresh(), POLL_MS);
    return () => window.clearInterval(id);
  }, [locked, disabled, refresh]);

  useEffect(() => {
    if (locked || disabled || paused || photos.length === 0) return;

    const id = window.setTimeout(() => {
      setIndex((prev) => (photos.length === 0 ? 0 : (prev + 1) % photos.length));
    }, duration);

    return () => window.clearTimeout(id);
  }, [locked, disabled, paused, photos.length, duration, index]);

  useEffect(() => {
    if (photos.length > 0 && index >= photos.length) setIndex(0);
  }, [photos.length, index]);

  const unlock = useCallback(async () => {
    if (passcode.trim().length === 0) return;
    setUnlocking(true);
    setLockError(null);
    try {
      const payload = await photoService.unlockSlideshow(locationId, passcode.trim());
      setFeed(payload.feed);
      setPasscode('');
      setLocked(false);
      void document.documentElement.requestFullscreen?.().catch(() => undefined);
    } catch (e) {
      const message = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setLockError(message || 'That passcode is not valid for this location.');
    } finally {
      setUnlocking(false);
    }
  }, [locationId, passcode]);

  if (!Number.isFinite(locationId)) {
    return (
      <div className="min-h-dvh bg-black text-white flex items-center justify-center p-8">
        <p>This slideshow link is missing its location.</p>
      </div>
    );
  }

  if (booting) {
    return (
      <div className="min-h-dvh bg-black flex items-center justify-center">
        <div className="h-10 w-10 rounded-full border-2 border-yellow-400 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (locked) {
    return (
      <div className="min-h-dvh bg-black text-white flex items-center justify-center px-6">
        <div className="w-full max-w-sm">
          <div className="flex items-center gap-2 text-zinc-400 mb-6">
            <Lock className="w-4 h-4" />
            <span className="text-xs uppercase tracking-[0.2em]">Display passcode</span>
          </div>
          <h1 className="text-3xl font-bold mb-2">Start the venue slideshow</h1>
          <p className="text-zinc-400 mb-6 text-sm">
            Enter this location&apos;s slideshow passcode. This display gets picture playback only — never customer
            records, waivers or settings.
          </p>
          <input
            type="password"
            inputMode="numeric"
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void unlock();
            }}
            placeholder="Passcode"
            className="w-full rounded-xl bg-zinc-900 border border-zinc-700 px-4 py-4 text-center text-2xl tracking-[0.35em] focus:outline-none focus:ring-2 focus:ring-yellow-400"
          />
          {lockError && (
            <p className="mt-3 text-sm text-red-400" role="alert">
              {lockError}
            </p>
          )}
          <button
            type="button"
            onClick={() => void unlock()}
            disabled={unlocking || passcode.trim().length === 0}
            className="mt-6 w-full rounded-xl bg-yellow-400 text-black font-bold py-4 text-lg disabled:opacity-40"
          >
            {unlocking ? 'Checking…' : 'Start slideshow'}
          </button>
        </div>
      </div>
    );
  }

  if (disabled) {
    return (
      <div className="min-h-dvh bg-black text-white flex items-center justify-center px-6 text-center">
        <div>
          <ShieldAlert className="w-12 h-12 mx-auto text-amber-400 mb-4" />
          <h1 className="text-2xl font-bold mb-2">The slideshow is turned off</h1>
          <p className="text-zinc-400">A manager can switch it back on from the photo settings screen.</p>
        </div>
      </div>
    );
  }

  const current = photos[index];

  return (
    <div className="min-h-dvh bg-black text-white overflow-hidden relative">
      {current ? (
        <img
          key={current.id}
          src={current.url}
          alt=""
          className="absolute inset-0 w-full h-full object-contain"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <p className="text-5xl sm:text-7xl font-black tracking-tight text-yellow-400 mb-4">ZAP ZONE</p>
            <p className="text-xl sm:text-2xl text-zinc-300">{feed?.location_name}</p>
            <p className="mt-6 text-zinc-500">Take a photo at the kiosk and it appears here.</p>
          </div>
        </div>
      )}

      <div className="absolute top-5 left-6 flex items-center gap-3">
        <span className="text-xl font-black tracking-tight text-yellow-400 drop-shadow">ZAP ZONE</span>
        {paused && (
          <span className="inline-flex items-center gap-1 rounded-full bg-black/60 px-3 py-1 text-xs">
            <PauseCircle className="w-3.5 h-3.5" />
            Paused
          </span>
        )}
        {offline && (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 text-amber-200 px-3 py-1 text-xs">
            <WifiOff className="w-3.5 h-3.5" />
            Reconnecting — showing the cached rotation
          </span>
        )}
      </div>

      {photos.length > 0 && (
        <div className="absolute bottom-5 right-6 text-xs text-white/70">
          {index + 1} / {photos.length}
        </div>
      )}
    </div>
  );
};

export default PhotoSlideshow;
