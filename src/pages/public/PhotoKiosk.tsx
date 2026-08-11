import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { QRCodeCanvas } from 'qrcode.react';
import { Camera, CheckCircle2, Info, Lock, RefreshCcw, ShieldAlert } from 'lucide-react';
import photoService, { clearDeviceToken, readDeviceToken } from '../../services/PhotoService';
import { usePhotoCamera } from '../../hooks/usePhotoCamera';
import type { KioskContext, KioskSessionHandle } from '../../types/photo.types';

type Screen = 'locked' | 'welcome' | 'camera' | 'preview' | 'qr' | 'disabled';

/**
 * Say what actually went wrong. A bare "could not start" gave staff nothing to act on,
 * and the three causes need three different responses.
 */
const failureText = (e: unknown, fallback: string): string => {
  const err = e as { response?: { status?: number; data?: { message?: string } }; message?: string };
  const status = err?.response?.status;

  if (status === 429) {
    return 'The kiosk is catching its breath. Please wait about a minute and try again.';
  }
  if (status === undefined) {
    return 'The kiosk cannot reach the internet right now. Please check the connection or ask a team member.';
  }
  if (status >= 500) {
    return 'Something went wrong on our side. Please ask a team member for help.';
  }

  return err?.response?.data?.message || fallback;
};

const PhotoKiosk = () => {
  const { locationId: locationParam } = useParams<{ locationId: string }>();
  const locationId = Number(locationParam);

  const [screen, setScreen] = useState<Screen>('locked');
  const [context, setContext] = useState<KioskContext | null>(null);
  const [passcode, setPasscode] = useState('');
  const [lockError, setLockError] = useState<string | null>(null);
  const [unlocking, setUnlocking] = useState(false);
  const [booting, setBooting] = useState(true);

  const [handle, setHandle] = useState<KioskSessionHandle | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [slideshowOptIn, setSlideshowOptIn] = useState(true);
  const [showTooltip, setShowTooltip] = useState(false);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const camera = usePhotoCamera({ facingMode: 'user' });
  const { start: startCamera, stop: stopCamera, capture: capturePhoto } = camera;
  const cameraIsLive = camera.isLive;
  const idleTimer = useRef<number | null>(null);
  const countdownTimer = useRef<number | null>(null);
  const handleRef = useRef<KioskSessionHandle | null>(null);
  const screenRef = useRef<Screen>('locked');
  const capturingRef = useRef(false);

  handleRef.current = handle;
  screenRef.current = screen;

  const idleSeconds = context?.idle_seconds ?? 60;
  const countdownSeconds = context?.countdown_seconds ?? 10;

  const clearIdle = useCallback(() => {
    if (idleTimer.current !== null) {
      window.clearTimeout(idleTimer.current);
      idleTimer.current = null;
    }
  }, []);

  const resetToWelcome = useCallback(
    async (reason: 'timeout' | 'manual') => {
      clearIdle();
      if (countdownTimer.current !== null) {
        window.clearInterval(countdownTimer.current);
        countdownTimer.current = null;
      }
      setCountdown(null);
      setPreviewUrl(null);
      setQrUrl(null);
      setSlideshowOptIn(true);
      capturingRef.current = false;
      stopCamera();

      const current = handleRef.current;
      if (current && reason === 'timeout') {
        try {
          await photoService.kioskTimeout(locationId, current);
        } catch {
          /* the reset still happens on the device */
        }
      }

      setHandle(null);
      setNotice(reason === 'timeout' ? 'The screen reset because nothing happened for a minute.' : null);
      setScreen('welcome');
    },
    [clearIdle, locationId, stopCamera],
  );

  const armIdle = useCallback(() => {
    clearIdle();
    idleTimer.current = window.setTimeout(() => {
      void resetToWelcome('timeout');
    }, idleSeconds * 1000);
  }, [clearIdle, idleSeconds, resetToWelcome]);

  useEffect(() => {
    if (screen === 'locked' || screen === 'welcome' || screen === 'disabled') {
      clearIdle();
      return;
    }
    if (countdown !== null) {
      clearIdle();
      return;
    }
    armIdle();
    return clearIdle;
  }, [screen, countdown, armIdle, clearIdle]);

  useEffect(() => {
    if (!Number.isFinite(locationId)) {
      setBooting(false);
      return;
    }

    const existing = readDeviceToken('kiosk', locationId);
    if (!existing) {
      setBooting(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const ctx = await photoService.getKioskContext(locationId);
        if (cancelled) return;
        setContext(ctx);
        setScreen('welcome');
      } catch (e) {
        const status = (e as { response?: { status?: number } })?.response?.status;
        if (status === 403) {
          clearDeviceToken('kiosk', locationId);
          const message = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
          if (message && message.includes('turned off')) {
            setScreen('disabled');
          }
        }
      } finally {
        if (!cancelled) setBooting(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [locationId]);

  const unlock = useCallback(async () => {
    if (passcode.trim().length === 0) return;
    setUnlocking(true);
    setLockError(null);
    try {
      const payload = await photoService.unlockKiosk(locationId, passcode.trim());
      setContext(payload.context);
      setPasscode('');
      setScreen('welcome');
    } catch (e) {
      setLockError(failureText(e, 'That passcode is not valid for this location.'));
    } finally {
      setUnlocking(false);
    }
  }, [locationId, passcode]);

  const beginSession = useCallback(async () => {
    setBusy(true);
    setNotice(null);
    try {
      const created = await photoService.startKioskSession(locationId);
      setHandle(created);
      setScreen('camera');
      await startCamera();
    } catch (e) {
      setNotice(failureText(e, 'The kiosk could not start. Please ask a team member for help.'));
    } finally {
      setBusy(false);
    }
  }, [locationId, startCamera]);

  const runCountdown = useCallback(() => {
    if (!cameraIsLive || countdown !== null) return;

    clearIdle();
    setCountdown(countdownSeconds);

    // A zero-second setting captures immediately: setting the counter to 0 is what
    // the capture effect waits for, so no ticking interval is needed.
    if (countdownSeconds <= 0) return;

    countdownTimer.current = window.setInterval(() => {
      setCountdown((prev) => {
        if (prev === null) return null;
        if (prev <= 1) {
          if (countdownTimer.current !== null) {
            window.clearInterval(countdownTimer.current);
            countdownTimer.current = null;
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [cameraIsLive, clearIdle, countdown, countdownSeconds]);

  useEffect(() => {
    if (countdown !== 0 || capturingRef.current) return;

    const current = handleRef.current;
    if (!current) {
      setCountdown(null);
      return;
    }

    if (!cameraIsLive) {
      setCountdown(null);
      setNotice('The camera stopped before the photo was taken, so nothing was saved. Please try again.');
      return;
    }

    const dataUrl = capturePhoto();
    setCountdown(null);

    if (!dataUrl) {
      setNotice('The camera stopped before the photo was taken, so nothing was saved. Please try again.');
      return;
    }

    capturingRef.current = true;
    setBusy(true);
    (async () => {
      try {
        const result = await photoService.kioskCapture(locationId, current, dataUrl);

        // The idle timer can reset the kiosk while this request is in flight. Without
        // this check the response would show the previous visitor's photo to whoever
        // walks up next.
        if (handleRef.current?.session_id !== current.session_id) {
          return;
        }

        setPreviewUrl(result.preview_url);
        stopCamera();
        setScreen('preview');
      } catch (e) {
        if (handleRef.current?.session_id !== current.session_id) {
          return;
        }
        setNotice(failureText(e, 'Something went wrong with that photo. Please try again.'));
      } finally {
        capturingRef.current = false;
        setBusy(false);
      }
    })();
  }, [countdown, cameraIsLive, capturePhoto, stopCamera, locationId]);

  const retake = useCallback(async () => {
    const current = handleRef.current;
    if (!current) return;
    setBusy(true);
    try {
      await photoService.kioskRetake(locationId, current);
      setPreviewUrl(null);
      setScreen('camera');
      await startCamera();
    } catch {
      setNotice('That photo could not be discarded. Please ask a team member for help.');
    } finally {
      setBusy(false);
    }
  }, [locationId, startCamera]);

  const accept = useCallback(async () => {
    const current = handleRef.current;
    if (!current) return;
    setBusy(true);
    try {
      const result = await photoService.kioskAccept(locationId, current, slideshowOptIn);
      setQrUrl(result.qr_target_url);
      setScreen('qr');
    } catch (e) {
      setNotice(failureText(e, 'Your photo could not be saved. Please ask a team member for help.'));
    } finally {
      setBusy(false);
    }
  }, [locationId, slideshowOptIn]);

  const activity = useCallback(() => {
    if (screenRef.current === 'locked' || screenRef.current === 'welcome') return;
    if (countdown !== null) return;
    armIdle();
  }, [armIdle, countdown]);

  const venueLine = useMemo(() => {
    if (!context) return '';
    const parts = [context.location.city, context.location.state].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : context.location.name;
  }, [context]);

  if (!Number.isFinite(locationId)) {
    return (
      <div className="min-h-dvh bg-zinc-950 text-white flex items-center justify-center p-8">
        <p className="text-lg">This kiosk link is missing its location.</p>
      </div>
    );
  }

  if (booting) {
    return (
      <div className="min-h-dvh bg-zinc-950 text-white flex items-center justify-center">
        <div className="h-10 w-10 rounded-full border-2 border-yellow-400 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div
      className="min-h-dvh bg-zinc-950 text-white select-none"
      onPointerDown={activity}
      onKeyDown={activity}
      role="presentation"
    >
      <div className="min-h-dvh flex flex-col">
        <header className="flex items-center justify-between px-6 sm:px-10 pt-6">
          <div>
            <img src="/Zap-Zone.png" alt="Zap Zone" className="h-10 sm:h-12 w-auto object-contain" />
            {context && (
              <p className="mt-1 text-xs sm:text-sm uppercase tracking-[0.2em] text-zinc-400">{venueLine}</p>
            )}
          </div>
          {context && screen !== 'locked' && (
            <p className="text-xs sm:text-sm text-zinc-400">{context.capture_date_label}</p>
          )}
        </header>

        <main className="flex-1 flex items-center justify-center px-6 sm:px-10 py-8">
          {screen === 'disabled' && (
            <div className="max-w-md text-center">
              <ShieldAlert className="w-12 h-12 mx-auto text-amber-400 mb-4" />
              <h1 className="text-2xl font-bold mb-2">Photo kiosk is turned off</h1>
              <p className="text-zinc-400">A manager can switch it back on from the photo settings screen.</p>
            </div>
          )}

          {screen === 'locked' && (
            <div className="w-full max-w-sm">
              <div className="flex items-center gap-2 text-zinc-400 mb-6">
                <Lock className="w-4 h-4" />
                <span className="text-xs uppercase tracking-[0.2em]">Device passcode</span>
              </div>
              <h1 className="text-3xl font-bold mb-2">Unlock this kiosk</h1>
              <p className="text-zinc-400 mb-6 text-sm">
                Enter the kiosk passcode for this location. This device gets photo-kiosk access only — never customer
                records, waivers or settings.
              </p>
              <input
                type="password"
                inputMode="numeric"
                autoComplete="off"
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
                className="mt-6 w-full rounded-xl bg-yellow-400 text-zinc-950 font-bold py-4 text-lg disabled:opacity-40"
              >
                {unlocking ? 'Checking…' : 'Start kiosk mode'}
              </button>
            </div>
          )}

          {screen === 'welcome' && context && (
            <div className="w-full max-w-2xl text-center">
              <h1 className="text-4xl sm:text-6xl font-black mb-4 leading-tight">Get your free photo</h1>
              <p className="text-lg sm:text-xl text-zinc-300 mb-6">
                Tap start, strike a pose, and we will send the photo straight to your phone.
              </p>
              <ol className="text-left mx-auto max-w-md space-y-2 text-zinc-300 mb-8">
                <li>1. Stand where you can see yourself on screen.</li>
                <li>
                  2.{' '}
                  {countdownSeconds > 0
                    ? `A ${countdownSeconds}-second countdown gives you time to get ready.`
                    : 'Tap Capture photo and the picture is taken right away.'}
                </li>
                <li>3. Scan the QR code that appears and enter your details to get the photo.</li>
              </ol>
              <p className="text-xs text-zinc-500 mb-8 max-w-lg mx-auto">{context.consent_text}</p>
              {notice && <p className="mb-6 text-sm text-amber-300">{notice}</p>}
              <button
                type="button"
                onClick={() => void beginSession()}
                disabled={busy}
                className="rounded-2xl bg-yellow-400 text-zinc-950 font-black px-12 py-6 text-2xl disabled:opacity-40"
              >
                {busy ? 'One moment…' : 'Start'}
              </button>
            </div>
          )}

          {screen === 'camera' && (
            <div className="w-full max-w-3xl">
              <div className="relative rounded-3xl overflow-hidden bg-black aspect-[4/3]">
                <video
                  ref={camera.videoRef}
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                  style={{ transform: 'scaleX(-1)' }}
                />
                {countdown !== null && countdown > 0 && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                    <span className="text-[9rem] sm:text-[12rem] font-black text-yellow-400 leading-none">
                      {countdown}
                    </span>
                  </div>
                )}
                {(camera.state === 'denied' || camera.state === 'unavailable' || camera.state === 'lost') && (
                  <div className="absolute inset-0 flex items-center justify-center bg-zinc-900/95 p-8 text-center">
                    <div>
                      <ShieldAlert className="w-10 h-10 mx-auto text-amber-400 mb-3" />
                      <p className="text-lg font-semibold mb-2">The camera is not available</p>
                      <p className="text-sm text-zinc-400 max-w-sm">{camera.error}</p>
                      <p className="text-sm text-zinc-400 mt-3">
                        Please ask a team member — they can take the photo for you at the counter.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-6 flex flex-col items-center gap-3">
                {countdown !== null ? (
                  <p className="text-zinc-400 text-sm">Hold still — the idle timer paused during the countdown.</p>
                ) : (
                  <button
                    type="button"
                    onClick={runCountdown}
                    disabled={!cameraIsLive || busy}
                    className="inline-flex items-center gap-3 rounded-2xl bg-yellow-400 text-zinc-950 font-black px-10 py-5 text-xl disabled:opacity-40"
                  >
                    <Camera className="w-6 h-6" />
                    Capture photo
                  </button>
                )}
                {notice && <p className="text-sm text-amber-300">{notice}</p>}
                <button
                  type="button"
                  onClick={() => void resetToWelcome('manual')}
                  className="text-sm text-zinc-500 underline"
                >
                  Start over
                </button>
              </div>
            </div>
          )}

          {screen === 'preview' && previewUrl && (
            <div className="w-full max-w-3xl">
              <h1 className="text-3xl font-bold text-center mb-5">How does this look?</h1>
              <div className="rounded-3xl overflow-hidden bg-black">
                <img src={previewUrl} alt="Your photo" className="w-full block" />
              </div>

              <label className="mt-6 flex items-start gap-3 rounded-2xl bg-zinc-900 border border-zinc-800 p-4 cursor-pointer">
                <input
                  type="checkbox"
                  checked={slideshowOptIn}
                  onChange={(e) => setSlideshowOptIn(e.target.checked)}
                  className="mt-1 h-5 w-5 accent-yellow-400"
                />
                <span className="flex-1">
                  <span className="font-semibold flex items-center gap-2">
                    Show my photo on the venue screen
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        setShowTooltip((v) => !v);
                      }}
                      aria-label="What does this mean?"
                      className="text-zinc-400"
                    >
                      <Info className="w-4 h-4" />
                    </button>
                  </span>
                  {showTooltip && (
                    <span className="block text-sm text-zinc-400 mt-1">
                      {context?.slideshow_tooltip ??
                        'When selected, this photo may appear on a public screen at this venue.'}
                    </span>
                  )}
                </span>
              </label>

              {notice && <p className="mt-4 text-sm text-amber-300 text-center">{notice}</p>}

              <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => void retake()}
                  disabled={busy}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-zinc-700 px-8 py-5 text-lg font-semibold disabled:opacity-40"
                >
                  <RefreshCcw className="w-5 h-5" />
                  Retake
                </button>
                <button
                  type="button"
                  onClick={() => void accept()}
                  disabled={busy}
                  className="rounded-2xl bg-yellow-400 text-zinc-950 font-black px-8 py-5 text-lg disabled:opacity-40"
                >
                  {busy ? 'Saving…' : 'Continue'}
                </button>
              </div>
            </div>
          )}

          {screen === 'qr' && qrUrl && (
            <div className="w-full max-w-xl text-center">
              <CheckCircle2 className="w-12 h-12 mx-auto text-yellow-400 mb-4" />
              <h1 className="text-3xl sm:text-4xl font-bold mb-3">Scan to get your photo</h1>
              <p className="text-zinc-300 mb-8">
                Point your phone camera at the code, then enter your name, email and mobile number to see and download
                your photo.
              </p>
              <div className="inline-block rounded-3xl bg-white p-6">
                <QRCodeCanvas value={qrUrl} size={260} includeMargin={false} level="M" />
              </div>
              <p className="mt-6 text-sm text-zinc-500">
                This code works for the next {context?.qr_valid_hours ?? 12} hours. Your photo page then stays open for{' '}
                {context?.access_valid_days ?? 30} days.
              </p>
              <button
                type="button"
                onClick={() => void resetToWelcome('manual')}
                className="mt-8 rounded-xl border border-zinc-700 px-8 py-3 font-semibold"
              >
                Done
              </button>
            </div>
          )}
        </main>

        {screen !== 'locked' && screen !== 'disabled' && (
          <footer className="px-6 sm:px-10 pb-6 text-center text-xs text-zinc-600">
            One photo per session. This screen resets after {idleSeconds} seconds without activity.
          </footer>
        )}
      </div>
    </div>
  );
};

export default PhotoKiosk;
