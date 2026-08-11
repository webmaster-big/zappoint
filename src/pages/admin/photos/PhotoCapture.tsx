import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Camera,
  CheckCircle2,
  Clock,
  Image as ImageIcon,
  Mail,
  MapPin,
  MessageSquare,
  QrCode,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { useThemeColor } from '../../../hooks/useThemeColor';
import { useLocationScope } from '../../../contexts/LocationContext';
import { usePhotoCamera } from '../../../hooks/usePhotoCamera';
import photoService from '../../../services/PhotoService';
import Toast from '../../../components/ui/Toast';
import StandardButton from '../../../components/ui/StandardButton';
import type {
  PhotoCaptureContext,
  PhotoSessionRecord,
  PhotoWaiverMatch,
} from '../../../types/photo.types';

type Step = 'consent' | 'capture' | 'delivery' | 'done';

const errorMessage = (e: unknown, fallback: string): string =>
  (e as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;

const PhotoCapture = () => {
  const { themeColor } = useThemeColor();
  const { effectiveLocationId, isCompanyAdmin } = useLocationScope();

  const [context, setContext] = useState<PhotoCaptureContext | null>(null);
  const [session, setSession] = useState<PhotoSessionRecord | null>(null);
  const [step, setStep] = useState<Step>('consent');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const [method, setMethod] = useState<'waiver_message' | 'staff_qr' | null>(null);
  const [schedule, setSchedule] = useState<'immediate' | 'next_day_9am'>('immediate');
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState<PhotoWaiverMatch[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [selected, setSelected] = useState<PhotoWaiverMatch[]>([]);
  const [deliveryNote, setDeliveryNote] = useState<string | null>(null);
  const [slideshowOptIn, setSlideshowOptIn] = useState(false);

  const camera = usePhotoCamera({ facingMode: 'environment' });
  const { start: startCamera, stop: stopCamera, capture: capturePhoto } = camera;
  const fileInput = useRef<HTMLInputElement | null>(null);

  const photoCount = session?.photos.length ?? 0;
  const maxPhotos = session?.max_photos ?? context?.limits.staff_max_photos ?? 3;
  const atCap = photoCount >= maxPhotos;
  const readyPhotos = useMemo(
    () => (session?.photos ?? []).filter((photo) => photo.processing_status === 'ready'),
    [session],
  );

  useEffect(() => {
    if (!effectiveLocationId) {
      setContext(null);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const ctx = await photoService.getCaptureContext(effectiveLocationId);
        if (!cancelled) setContext(ctx);
      } catch (e) {
        if (!cancelled) setToast({ message: errorMessage(e, 'Could not load this location.'), type: 'error' });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [effectiveLocationId]);

  const startSession = useCallback(async () => {
    if (!effectiveLocationId || !consent) return;
    setBusy(true);
    try {
      const created = await photoService.startSession(effectiveLocationId);
      setSession(created);
      setStep('capture');
      await startCamera();
    } catch (e) {
      setToast({ message: errorMessage(e, 'Could not start the session.'), type: 'error' });
    } finally {
      setBusy(false);
    }
  }, [consent, effectiveLocationId, startCamera]);

  const takePhoto = useCallback(async () => {
    if (!session || atCap) return;
    const dataUrl = capturePhoto();
    if (!dataUrl) {
      setToast({ message: 'The camera did not return an image. Try again.', type: 'error' });
      return;
    }
    setBusy(true);
    try {
      setSession(await photoService.addCapturedPhoto(session.id, dataUrl));
    } catch (e) {
      setToast({ message: errorMessage(e, 'That photo could not be added.'), type: 'error' });
    } finally {
      setBusy(false);
    }
  }, [atCap, capturePhoto, session]);

  const uploadPhoto = useCallback(
    async (file: File) => {
      if (!session) return;
      setBusy(true);
      try {
        setSession(await photoService.uploadPhoto(session.id, file));
      } catch (e) {
        setToast({ message: errorMessage(e, 'That file could not be uploaded.'), type: 'error' });
      } finally {
        setBusy(false);
        if (fileInput.current) fileInput.current.value = '';
      }
    },
    [session],
  );

  const removePhoto = useCallback(
    async (photoId: number) => {
      if (!session) return;
      setBusy(true);
      try {
        setSession(await photoService.removePhoto(session.id, photoId));
      } catch (e) {
        setToast({ message: errorMessage(e, 'That photo could not be removed.'), type: 'error' });
      } finally {
        setBusy(false);
      }
    },
    [session],
  );

  const movePhoto = useCallback(
    async (photoId: number, direction: -1 | 1) => {
      if (!session) return;
      const ids = session.photos.map((p) => p.id);
      const from = ids.indexOf(photoId);
      const to = from + direction;
      if (from < 0 || to < 0 || to >= ids.length) return;
      const next = [...ids];
      [next[from], next[to]] = [next[to], next[from]];
      setBusy(true);
      try {
        setSession(await photoService.reorderPhotos(session.id, next));
      } catch (e) {
        setToast({ message: errorMessage(e, 'Could not reorder the photos.'), type: 'error' });
      } finally {
        setBusy(false);
      }
    },
    [session],
  );

  const runSearch = useCallback(async () => {
    if (query.trim().length < 2) return;
    setSearching(true);
    setSearched(false);
    try {
      setMatches(await photoService.searchWaivers(query.trim(), effectiveLocationId));
      setSearched(true);
    } catch (e) {
      setToast({ message: errorMessage(e, 'The waiver search failed.'), type: 'error' });
    } finally {
      setSearching(false);
    }
  }, [effectiveLocationId, query]);

  const toggleWaiver = useCallback((waiver: PhotoWaiverMatch) => {
    setSelected((prev) =>
      prev.some((w) => w.id === waiver.id) ? prev.filter((w) => w.id !== waiver.id) : [...prev, waiver],
    );
  }, []);

  const deliver = useCallback(async () => {
    if (!session || !method) return;
    setBusy(true);
    try {
      const result = await photoService.deliver(session.id, {
        method,
        schedule: method === 'waiver_message' ? schedule : undefined,
        waiver_ids: method === 'waiver_message' ? selected.map((w) => w.id) : undefined,
        slideshow_opt_in: slideshowOptIn,
      });
      setSession(result.data);
      setDeliveryNote(result.message ?? null);
      stopCamera();
      setStep('done');
    } catch (e) {
      setToast({ message: errorMessage(e, 'Delivery failed.'), type: 'error' });
    } finally {
      setBusy(false);
    }
  }, [method, schedule, selected, session, slideshowOptIn, stopCamera]);

  const resetAll = useCallback(() => {
    stopCamera();
    setSession(null);
    setStep('consent');
    setConsent(false);
    setMethod(null);
    setSchedule('immediate');
    setQuery('');
    setMatches([]);
    setSearched(false);
    setSelected([]);
    setDeliveryNote(null);
    setSlideshowOptIn(false);
  }, [stopCamera]);

  const discard = useCallback(async () => {
    if (!session) return;
    setBusy(true);
    try {
      await photoService.discardSession(session.id);
      setToast({ message: 'Session discarded.', type: 'info' });
      resetAll();
    } catch (e) {
      setToast({ message: errorMessage(e, 'Could not discard the session.'), type: 'error' });
    } finally {
      setBusy(false);
    }
  }, [resetAll, session]);

  if (!effectiveLocationId) {
    return (
      <div className="min-h-screen px-6 py-8">
        <div className="max-w-lg mx-auto text-center bg-white border border-gray-200 rounded-2xl p-8">
          <MapPin className="w-10 h-10 mx-auto text-gray-400 mb-3" />
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Choose a location first</h1>
          <p className="text-gray-600 text-sm">
            {isCompanyAdmin
              ? 'Pick a location in the sidebar. Photos, overlays and slideshows are all per location.'
              : 'Your account is not assigned to a location yet. Ask a manager to set one.'}
          </p>
        </div>
      </div>
    );
  }

  const selectableCount = selected.filter((w) => w.contactable).length;

  return (
    <div className="min-h-screen px-4 sm:px-6 py-8">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="max-w-6xl mx-auto">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Camera className={`w-6 h-6 text-${themeColor}-700`} />
              Take and send photos
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              {context?.location.name}
              {context && ` · operating day ${context.operating_day}`}
              {context && ` · ${context.has_overlay ? `overlay: ${context.active_overlay?.name}` : 'date layer only'}`}
            </p>
          </div>
          {session && step !== 'done' && (
            <button type="button" onClick={() => void discard()} className="text-sm text-gray-500 underline">
              Discard session
            </button>
          )}
        </div>

        <ol className="flex items-center gap-2 mb-6 text-xs">
          {(['consent', 'capture', 'delivery', 'done'] as Step[]).map((s, i) => {
            const order: Step[] = ['consent', 'capture', 'delivery', 'done'];
            const active = order.indexOf(step) >= i;
            const labels: Record<Step, string> = {
              consent: 'Consent',
              capture: 'Capture',
              delivery: 'Delivery',
              done: 'Sent',
            };
            return (
              <li key={s} className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center justify-center h-6 w-6 rounded-full font-semibold ${
                    active ? `bg-${themeColor}-700 text-white` : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {i + 1}
                </span>
                <span className={active ? 'text-gray-900 font-medium' : 'text-gray-500'}>{labels[s]}</span>
                {i < 3 && <span className="w-6 h-px bg-gray-300" />}
              </li>
            );
          })}
        </ol>

        {step === 'consent' && (
          <div className="bg-white border border-gray-200 rounded-2xl p-6 max-w-2xl">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Confirm the customer wants the photo</h2>
            <p className="text-sm text-gray-600 mb-5">
              Ask the customer out loud before you capture anything. Up to {maxPhotos} photos can go in one session, and
              the branded preview is shown before you choose how to send them.
            </p>
            <label className="flex items-start gap-3 cursor-pointer mb-6">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className={`mt-1 h-5 w-5 accent-${themeColor}-700`}
              />
              <span className="text-sm text-gray-800">
                I asked the customer and they agreed to have their photo taken.
              </span>
            </label>
            <StandardButton onClick={() => void startSession()} disabled={!consent || busy} loading={busy} icon={Camera}>
              Start photo session
            </StandardButton>
          </div>
        )}

        {step === 'capture' && session && (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <div className="lg:col-span-3">
              <div className="bg-black rounded-2xl overflow-hidden aspect-[4/3] relative">
                <video ref={camera.videoRef} playsInline muted className="w-full h-full object-cover" />
                {(camera.state === 'denied' || camera.state === 'unavailable' || camera.state === 'lost') && (
                  <div className="absolute inset-0 bg-gray-900/95 text-white flex items-center justify-center p-6 text-center">
                    <div>
                      <AlertTriangle className="w-8 h-8 mx-auto text-amber-400 mb-2" />
                      <p className="font-semibold mb-1">Camera unavailable</p>
                      <p className="text-sm text-gray-300 max-w-xs">{camera.error}</p>
                      <p className="text-sm text-gray-300 mt-2">You can still upload a photo from this device.</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                <StandardButton onClick={() => void takePhoto()} disabled={!camera.isLive || atCap || busy} icon={Camera}>
                  Take photo
                </StandardButton>
                <StandardButton
                  variant="secondary"
                  onClick={() => fileInput.current?.click()}
                  disabled={atCap || busy}
                  icon={Upload}
                >
                  Upload from device
                </StandardButton>
                {camera.state !== 'live' && (
                  <StandardButton variant="ghost" onClick={() => void startCamera()}>
                    Retry camera
                  </StandardButton>
                )}
                <input
                  ref={fileInput}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void uploadPhoto(file);
                  }}
                />
              </div>

              {atCap && (
                <p className="mt-3 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  {maxPhotos} photos is the locked maximum for a staff session. Remove one to swap it out.
                </p>
              )}
            </div>

            <div className="lg:col-span-2">
              <div className="bg-white border border-gray-200 rounded-2xl p-4">
                <h2 className="font-semibold text-gray-900 mb-1">
                  This session ({photoCount}/{maxPhotos})
                </h2>
                <p className="text-xs text-gray-500 mb-4">
                  Each photo already carries the location overlay and the capture date.
                </p>

                {photoCount === 0 && (
                  <div className="text-center py-8 text-gray-400">
                    <ImageIcon className="w-8 h-8 mx-auto mb-2" />
                    <p className="text-sm">No photos yet</p>
                  </div>
                )}

                <ul className="space-y-3">
                  {session.photos.map((photo, i) => (
                    <li key={photo.id} className="flex gap-3 items-center">
                      {photo.thumbnail_url ? (
                        <img
                          src={photo.thumbnail_url}
                          alt={`Photo ${i + 1}`}
                          className="h-16 w-16 rounded-lg object-cover bg-gray-100"
                        />
                      ) : (
                        <div className="h-16 w-16 rounded-lg bg-gray-100 flex items-center justify-center">
                          <ImageIcon className="w-5 h-5 text-gray-400" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">Photo {i + 1}</p>
                        <p className="text-xs text-gray-500 capitalize">{photo.source}</p>
                        {photo.processing_status === 'failed' && (
                          <p className="text-xs text-red-600">Processing failed</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => void movePhoto(photo.id, -1)}
                          disabled={i === 0 || busy}
                          aria-label="Move earlier"
                          className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30"
                        >
                          <ArrowLeft className="w-4 h-4 text-gray-600" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void movePhoto(photo.id, 1)}
                          disabled={i === session.photos.length - 1 || busy}
                          aria-label="Move later"
                          className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30"
                        >
                          <ArrowRight className="w-4 h-4 text-gray-600" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void removePhoto(photo.id)}
                          disabled={busy}
                          aria-label="Remove photo"
                          className="p-1.5 rounded hover:bg-red-50 disabled:opacity-30"
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>

                {readyPhotos.length > 0 && (
                  <div className="mt-5">
                    <p className="text-xs font-medium text-gray-700 mb-2">Branded preview</p>
                    <img
                      src={readyPhotos[0].delivery_url ?? ''}
                      alt="Branded preview"
                      className="w-full rounded-lg border border-gray-200"
                    />
                  </div>
                )}

                <StandardButton
                  className="mt-5"
                  fullWidth
                  onClick={() => setStep('delivery')}
                  disabled={readyPhotos.length === 0 || busy}
                >
                  Continue to delivery
                </StandardButton>
              </div>
            </div>
          </div>
        )}

        {step === 'delivery' && session && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setMethod('waiver_message')}
                className={`text-left bg-white border-2 rounded-2xl p-5 transition-colors ${
                  method === 'waiver_message' ? `border-${themeColor}-700` : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Mail className={`w-5 h-5 text-${themeColor}-700`} />
                  <span className="font-semibold text-gray-900">Waiver message delivery</span>
                  <span className="ml-auto text-[11px] uppercase tracking-wide text-gray-500">Default</span>
                </div>
                <p className="text-sm text-gray-600">
                  Search completed waivers by name, phone or email. Every available email and mobile number on the
                  waivers you pick receives the secure link.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setMethod('staff_qr')}
                className={`text-left bg-white border-2 rounded-2xl p-5 transition-colors ${
                  method === 'staff_qr' ? `border-${themeColor}-700` : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <QrCode className={`w-5 h-5 text-${themeColor}-700`} />
                  <span className="font-semibold text-gray-900">Direct staff QR</span>
                </div>
                <p className="text-sm text-gray-600">
                  Show a code on this device. The customer scans it and opens the photos straight away. No form is shown
                  and no customer information is requested.
                </p>
              </button>
            </div>

            {method === 'waiver_message' && (
              <div className="bg-white border border-gray-200 rounded-2xl p-5">
                {(context?.channels.sms_note || context?.channels.email_note) && (
                  <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3">
                    <p className="flex items-center gap-2 text-sm font-medium text-amber-900">
                      <AlertTriangle className="w-4 h-4" />
                      Not every channel is sending
                    </p>
                    {context?.channels.email_note && (
                      <p className="mt-1 text-sm text-amber-900">{context.channels.email_note}</p>
                    )}
                    {context?.channels.sms_note && (
                      <p className="mt-1 text-sm text-amber-900">{context.channels.sms_note}</p>
                    )}
                  </div>
                )}

                <h2 className="font-semibold text-gray-900 mb-3">Find the waiver</h2>
                <div className="flex gap-2 mb-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void runSearch();
                      }}
                      placeholder="Name, phone or email"
                      className={`w-full border border-gray-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-${themeColor}-600`}
                    />
                  </div>
                  <StandardButton onClick={() => void runSearch()} loading={searching} disabled={query.trim().length < 2}>
                    Search
                  </StandardButton>
                </div>

                {searched && matches.length === 0 && (
                  <p className="text-sm text-gray-500 py-4">No completed waivers matched that search.</p>
                )}

                <ul className="space-y-2 max-h-80 overflow-y-auto">
                  {matches.map((waiver) => {
                    const checked = selected.some((w) => w.id === waiver.id);
                    return (
                      <li key={waiver.id}>
                        <label
                          className={`flex items-start gap-3 rounded-xl border p-3 ${
                            waiver.contactable
                              ? `cursor-pointer ${checked ? `border-${themeColor}-600 bg-${themeColor}-50/50` : 'border-gray-200'}`
                              : 'border-gray-200 bg-gray-50 cursor-not-allowed'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={!waiver.contactable}
                            onChange={() => toggleWaiver(waiver)}
                            className={`mt-1 h-4 w-4 accent-${themeColor}-700`}
                          />
                          <span className="flex-1 min-w-0">
                            <span className="block text-sm font-medium text-gray-900">{waiver.name}</span>
                            <span className="block text-xs text-gray-500">
                              {waiver.email_masked || 'no email'} · {waiver.phone_masked || 'no phone'}
                              {waiver.signed_on && ` · signed ${waiver.signed_on}`}
                            </span>
                            <span className="mt-1 flex flex-wrap gap-1">
                              {waiver.unavailable_reason && (
                                <span className="text-[11px] rounded-full bg-amber-100 px-2 py-0.5 text-amber-800">
                                  {waiver.unavailable_reason}
                                </span>
                              )}
                              {waiver.has_email && (
                                <span className="inline-flex items-center gap-1 text-[11px] rounded-full bg-gray-100 px-2 py-0.5 text-gray-700">
                                  <Mail className="w-3 h-3" /> email
                                </span>
                              )}
                              {waiver.has_phone && (
                                <span className="inline-flex items-center gap-1 text-[11px] rounded-full bg-gray-100 px-2 py-0.5 text-gray-700">
                                  <MessageSquare className="w-3 h-3" /> SMS
                                </span>
                              )}
                              {waiver.photo_video_consent === false && (
                                <span className="text-[11px] rounded-full bg-red-100 px-2 py-0.5 text-red-800">
                                  declined the photo release
                                </span>
                              )}
                              {waiver.photo_video_consent === null && (
                                <span className="text-[11px] rounded-full bg-gray-200 px-2 py-0.5 text-gray-700">
                                  photo release never asked
                                </span>
                              )}
                            </span>
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>

                {selected.length > 0 && (
                  <div className="mt-4 border-t border-gray-100 pt-4">
                    <p className="text-sm font-medium text-gray-900 mb-2">
                      Selected ({selectableCount} will receive the link)
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {selected.map((waiver) => (
                        <span
                          key={waiver.id}
                          className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-800"
                        >
                          {waiver.name}
                          <button type="button" onClick={() => toggleWaiver(waiver)} aria-label={`Remove ${waiver.name}`}>
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                    <p className="mt-2 text-xs text-gray-500">
                      Waivers that share an email or mobile number are recorded individually but only sent once.
                    </p>
                  </div>
                )}

                <div className="mt-5 border-t border-gray-100 pt-4">
                  <p className="text-sm font-medium text-gray-900 mb-2">When should it go out?</p>
                  <div className="space-y-2">
                    <label className="flex items-center gap-3 cursor-pointer text-sm">
                      <input
                        type="radio"
                        name="schedule"
                        checked={schedule === 'immediate'}
                        onChange={() => setSchedule('immediate')}
                        className={`accent-${themeColor}-700`}
                      />
                      <span>Send immediately</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer text-sm">
                      <input
                        type="radio"
                        name="schedule"
                        checked={schedule === 'next_day_9am'}
                        onChange={() => setSchedule('next_day_9am')}
                        className={`accent-${themeColor}-700`}
                      />
                      <span>
                        9:00 AM tomorrow
                        <span className="text-gray-500"> ({context?.location.timezone ?? 'America/Detroit'})</span>
                      </span>
                    </label>
                  </div>
                </div>
              </div>
            )}

            <label className="flex items-start gap-3 bg-white border border-gray-200 rounded-2xl p-4 cursor-pointer">
              <input
                type="checkbox"
                checked={slideshowOptIn}
                onChange={(e) => setSlideshowOptIn(e.target.checked)}
                className={`mt-1 h-5 w-5 accent-${themeColor}-700`}
              />
              <span className="flex-1">
                <span className="block text-sm font-medium text-gray-900">
                  Also show these photos on the venue slideshow
                </span>
                <span className="block text-xs text-gray-500 mt-0.5">
                  They appear on the public screen within a few seconds. Please ask the customer first, and leave this
                  unticked if they would rather not be shown. You can add or remove any photo later from the photo
                  library.
                </span>
              </span>
            </label>

            <div className="flex flex-wrap gap-3">
              <StandardButton variant="secondary" onClick={() => setStep('capture')} icon={ArrowLeft}>
                Back to capture
              </StandardButton>
              <StandardButton
                onClick={() => void deliver()}
                loading={busy}
                disabled={!method || busy || (method === 'waiver_message' && selectableCount === 0)}
              >
                {method === 'staff_qr' ? 'Show the QR code' : 'Send photos'}
              </StandardButton>
            </div>
          </div>
        )}

        {step === 'done' && session && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white border border-gray-200 rounded-2xl p-6">
              <CheckCircle2 className="w-8 h-8 text-green-600 mb-3" />
              <h2 className="text-lg font-semibold text-gray-900 mb-1">
                {session.delivery_method === 'staff_qr' ? 'Ready to scan' : 'Delivery recorded'}
              </h2>
              <p className="text-sm text-gray-600 mb-4">{deliveryNote ?? 'The session is complete.'}</p>

              <dl className="text-sm space-y-2">
                <div className="flex justify-between gap-4">
                  <dt className="text-gray-500">Photos</dt>
                  <dd className="text-gray-900">{session.photo_count}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-gray-500">Customer page expires</dt>
                  <dd className="text-gray-900">
                    {session.access_expires_at ? new Date(session.access_expires_at).toLocaleDateString() : '—'}
                  </dd>
                </div>
                {session.delivery_method === 'staff_qr' && (
                  <div className="flex justify-between gap-4">
                    <dt className="text-gray-500">QR expires</dt>
                    <dd className="text-gray-900">
                      {session.qr_expires_at ? new Date(session.qr_expires_at).toLocaleString() : '—'}
                    </dd>
                  </div>
                )}
              </dl>

              {session.deliveries.length > 0 && (
                <div className="mt-5 border-t border-gray-100 pt-4">
                  <p className="text-sm font-medium text-gray-900 mb-2">Channels</p>
                  <ul className="space-y-1 text-sm">
                    {session.deliveries.map((delivery) => (
                      <li key={delivery.id} className="flex items-center justify-between gap-3">
                        <span className="text-gray-700">
                          {delivery.channel === 'email' ? 'Email' : 'SMS'} · {delivery.destination_masked}
                          {delivery.is_duplicate && (
                            <span className="ml-2 text-xs text-gray-500">(same destination — not sent twice)</span>
                          )}
                        </span>
                        <span
                          className={`text-xs rounded-full px-2 py-0.5 ${
                            delivery.status === 'sent'
                              ? 'bg-green-100 text-green-800'
                              : delivery.status === 'failed'
                                ? 'bg-red-100 text-red-800'
                                : delivery.status === 'scheduled'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {delivery.status}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <StandardButton className="mt-6" onClick={resetAll} icon={Camera}>
                Start a new session
              </StandardButton>
            </div>

            {session.delivery_method === 'staff_qr' && (
              <div className="bg-white border border-gray-200 rounded-2xl p-6 text-center">
                <div className="inline-block rounded-2xl bg-white p-4 border border-gray-100">
                  <QRCodeCanvas value={session.qr_target_url} size={230} includeMargin={false} level="M" />
                </div>
                <p className="mt-4 text-sm text-gray-700 font-medium">Hold this up for the customer to scan.</p>
                <p className="mt-2 text-xs text-gray-500 max-w-xs mx-auto">
                  No form is shown and no name, email, phone or marketing question is asked. Closing this screen does not
                  invalidate the code.
                </p>
                <p className="mt-3 inline-flex items-center gap-1 text-xs text-gray-500">
                  <Clock className="w-3.5 h-3.5" />
                  Active for {context?.limits.qr_valid_hours ?? 12} hours
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default PhotoCapture;
