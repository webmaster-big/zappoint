import { useCallback, useEffect, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Clock,
  Copy,
  Eye,
  EyeOff,
  ExternalLink,
  MapPin,
  MonitorPlay,
  Pause,
  Play,
  RefreshCcw,
  Trash2,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { useThemeColor } from '../../../hooks/useThemeColor';
import { useLocationScope } from '../../../contexts/LocationContext';
import photoService from '../../../services/PhotoService';
import Toast from '../../../components/ui/Toast';
import StandardButton from '../../../components/ui/StandardButton';
import type { SlideshowQueueResponse } from '../../../types/photo.types';

const errorMessage = (e: unknown, fallback: string): string =>
  (e as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;

const SlideshowQueuePage = () => {
  const { themeColor } = useThemeColor();
  const { effectiveLocationId, isCompanyAdmin } = useLocationScope();

  const [data, setData] = useState<SlideshowQueueResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showPast, setShowPast] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const load = useCallback(async () => {
    if (!effectiveLocationId) return;
    setLoading(true);
    try {
      setData(await photoService.getSlideshowQueues(effectiveLocationId));
    } catch (e) {
      setToast({ message: errorMessage(e, 'Could not load the slideshow queue.'), type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [effectiveLocationId]);

  useEffect(() => {
    void load();
  }, [load]);

  const setState = useCallback(
    async (photoId: number, slideshowState: 'visible' | 'hidden' | 'removed') => {
      setBusy(true);
      try {
        await photoService.updateSlideshowPhoto(photoId, { slideshow_state: slideshowState });
        await load();
      } catch (e) {
        setToast({ message: errorMessage(e, 'That change could not be saved.'), type: 'error' });
      } finally {
        setBusy(false);
      }
    },
    [load],
  );

  const move = useCallback(
    async (photoId: number, direction: -1 | 1) => {
      if (!data) return;
      const ids = data.active.photos.map((p) => p.id);
      const from = ids.indexOf(photoId);
      const to = from + direction;
      if (from < 0 || to < 0 || to >= ids.length) return;
      const next = [...ids];
      [next[from], next[to]] = [next[to], next[from]];
      setBusy(true);
      try {
        await photoService.reorderSlideshow(data.active.id, next);
        await load();
      } catch (e) {
        setToast({ message: errorMessage(e, 'Could not reorder the queue.'), type: 'error' });
      } finally {
        setBusy(false);
      }
    },
    [data, load],
  );

  const togglePause = useCallback(async () => {
    if (!data) return;
    setBusy(true);
    try {
      await photoService.setSlideshowPaused(data.active.id, !data.active.is_paused);
      await load();
    } catch (e) {
      setToast({ message: errorMessage(e, 'Could not change the slideshow.'), type: 'error' });
    } finally {
      setBusy(false);
    }
  }, [data, load]);

  const copy = useCallback(async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setToast({ message: `${label} copied.`, type: 'success' });
    } catch {
      setToast({ message: 'Copying is blocked in this browser — select the text instead.', type: 'info' });
    }
  }, []);

  if (!effectiveLocationId) {
    return (
      <div className="min-h-screen px-6 py-8">
        <div className="max-w-lg mx-auto text-center bg-white border border-gray-200 rounded-2xl p-8">
          <MapPin className="w-10 h-10 mx-auto text-gray-400 mb-3" />
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Choose a location first</h1>
          <p className="text-gray-600 text-sm">
            {isCompanyAdmin
              ? 'Each location runs its own slideshow queue and display passcode.'
              : 'Your account is not assigned to a location yet.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 sm:px-6 py-8">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="max-w-6xl mx-auto">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <MonitorPlay className={`w-6 h-6 text-${themeColor}-700`} />
              Slideshow queue
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              Kiosk photos join today&apos;s queue the moment the customer accepts them. The queue closes at{' '}
              {data?.cutoff_hour ?? 6}:00 AM location time and a fresh one opens.
            </p>
          </div>
          <StandardButton variant="secondary" size="sm" icon={RefreshCcw} onClick={() => void load()} loading={loading}>
            Refresh
          </StandardButton>
        </div>

        {data && (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
              <div className="bg-white border border-gray-200 rounded-2xl p-5">
                <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">Active queue</p>
                <p className="text-lg font-semibold text-gray-900">{data.active.label}</p>
                <p className="text-sm text-gray-600 mt-1">
                  {data.active.visible_photos} showing of {data.active.total_photos} stored
                </p>
                {data.active.closes_at && (
                  <p className="mt-2 inline-flex items-center gap-1 text-xs text-gray-500">
                    <Clock className="w-3.5 h-3.5" />
                    Closes {new Date(data.active.closes_at).toLocaleString()}
                  </p>
                )}
                <div className="mt-4">
                  <StandardButton
                    size="sm"
                    variant={data.active.is_paused ? 'primary' : 'secondary'}
                    icon={data.active.is_paused ? Play : Pause}
                    onClick={() => void togglePause()}
                    disabled={busy}
                  >
                    {data.active.is_paused ? 'Resume slideshow' : 'Pause slideshow'}
                  </StandardButton>
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-2xl p-5">
                <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">Display</p>
                <p
                  className={`inline-flex items-center gap-1.5 text-sm font-medium ${
                    data.settings.display_online ? 'text-green-700' : 'text-amber-700'
                  }`}
                >
                  {data.settings.display_online ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
                  {data.settings.display_online ? 'Reporting in' : 'Not reporting'}
                </p>
                <p className="text-sm text-gray-600 mt-1">
                  {data.settings.last_seen_at
                    ? `Last seen ${new Date(data.settings.last_seen_at).toLocaleString()}`
                    : 'No display has opened this slideshow yet.'}
                </p>
                <p className="text-sm text-gray-600 mt-2">
                  Each photo shows for {data.settings.slideshow_duration_seconds} seconds.
                </p>
                {!data.settings.slideshow_enabled && (
                  <p className="mt-2 text-sm text-amber-800">The slideshow is turned off in photo settings.</p>
                )}
              </div>

              <div className="bg-white border border-gray-200 rounded-2xl p-5">
                <p className="text-xs uppercase tracking-wide text-gray-500 mb-2">Display URL and passcode</p>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <code className="flex-1 truncate bg-gray-50 border border-gray-200 rounded px-2 py-1 text-xs">
                      {data.settings.slideshow_url}
                    </code>
                    <button
                      type="button"
                      onClick={() => void copy(data.settings.slideshow_url, 'Slideshow URL')}
                      aria-label="Copy slideshow URL"
                      className="p-1.5 rounded hover:bg-gray-100"
                    >
                      <Copy className="w-4 h-4 text-gray-600" />
                    </button>
                    <a
                      href={data.settings.slideshow_url}
                      target="_blank"
                      rel="noreferrer"
                      aria-label="Open slideshow"
                      className="p-1.5 rounded hover:bg-gray-100"
                    >
                      <ExternalLink className="w-4 h-4 text-gray-600" />
                    </a>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 bg-gray-50 border border-gray-200 rounded px-2 py-1 tracking-[0.2em]">
                      {data.settings.slideshow_passcode}
                    </code>
                    <button
                      type="button"
                      onClick={() => void copy(data.settings.slideshow_passcode, 'Passcode')}
                      aria-label="Copy passcode"
                      className="p-1.5 rounded hover:bg-gray-100"
                    >
                      <Copy className="w-4 h-4 text-gray-600" />
                    </button>
                  </div>
                </div>
                <p className="mt-3 text-xs text-gray-500">
                  The URL and passcode grant picture playback only. They never open customers, waivers, reports or
                  settings.
                </p>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden mb-6">
              <div className="px-5 py-4 border-b border-gray-100">
                <h2 className="font-semibold text-gray-900">Photos in today&apos;s rotation</h2>
              </div>

              {data.active.photos.length === 0 ? (
                <div className="p-8 text-center text-gray-500 text-sm">
                  Nothing in the queue yet. Kiosk photos land here as soon as a customer accepts one with the slideshow
                  box ticked.
                </div>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {data.active.photos.map((photo, i) => (
                    <li key={photo.id} className="flex flex-wrap items-center gap-4 px-5 py-3">
                      <span className="text-sm text-gray-400 w-6">{i + 1}</span>
                      {photo.thumbnail_url ? (
                        <img
                          src={photo.thumbnail_url}
                          alt={`Photo ${photo.id}`}
                          className="h-14 w-14 rounded-lg object-cover bg-gray-100"
                        />
                      ) : (
                        <div className="h-14 w-14 rounded-lg bg-gray-100" />
                      )}
                      <div className="flex-1 min-w-[10rem]">
                        <p className="text-sm text-gray-900">
                          {photo.captured_at ? new Date(photo.captured_at).toLocaleTimeString() : '—'}
                        </p>
                        <p className="text-xs text-gray-500 capitalize">
                          {photo.session_source ?? photo.source} ·{' '}
                          {photo.slideshow_eligible ? photo.slideshow_state : 'not eligible'}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => void move(photo.id, -1)}
                          disabled={i === 0 || busy}
                          aria-label="Move up"
                          className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30"
                        >
                          <ArrowUp className="w-4 h-4 text-gray-600" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void move(photo.id, 1)}
                          disabled={i === data.active.photos.length - 1 || busy}
                          aria-label="Move down"
                          className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30"
                        >
                          <ArrowDown className="w-4 h-4 text-gray-600" />
                        </button>
                        {photo.slideshow_state === 'visible' ? (
                          <button
                            type="button"
                            onClick={() => void setState(photo.id, 'hidden')}
                            disabled={busy}
                            className="inline-flex items-center gap-1 text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 hover:bg-gray-50"
                          >
                            <EyeOff className="w-3.5 h-3.5" />
                            Hide
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => void setState(photo.id, 'visible')}
                            disabled={busy}
                            className="inline-flex items-center gap-1 text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 hover:bg-gray-50"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            Restore
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => void setState(photo.id, 'removed')}
                          disabled={busy}
                          className="inline-flex items-center gap-1 text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 hover:bg-red-50 text-red-700"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Remove
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
              <button
                type="button"
                onClick={() => setShowPast((v) => !v)}
                className="w-full flex items-center justify-between px-5 py-4 text-left"
              >
                <h2 className="font-semibold text-gray-900">Past slideshows ({data.past.length})</h2>
                <span className="text-sm text-gray-500">{showPast ? 'Hide' : 'Show'}</span>
              </button>

              {showPast && (
                <ul className="divide-y divide-gray-100">
                  {data.past.length === 0 && (
                    <li className="px-5 py-6 text-sm text-gray-500">No closed queues yet.</li>
                  )}
                  {data.past.map((queue) => (
                    <li key={queue.id} className="flex items-center justify-between gap-4 px-5 py-3">
                      <div>
                        <p className="text-sm text-gray-900">{queue.label}</p>
                        <p className="text-xs text-gray-500">
                          {queue.visible_photos} showing of {queue.total_photos} stored ·{' '}
                          {queue.status === 'closed' ? 'closed' : 'active'}
                          {queue.closed_at && ` ${new Date(queue.closed_at).toLocaleString()}`}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default SlideshowQueuePage;
