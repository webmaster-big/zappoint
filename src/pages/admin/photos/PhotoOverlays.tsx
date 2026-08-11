import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Layers, MapPin, Plus, RefreshCcw, Trash2, X } from 'lucide-react';
import { useThemeColor } from '../../../hooks/useThemeColor';
import { useLocationScope } from '../../../contexts/LocationContext';
import photoService from '../../../services/PhotoService';
import Toast from '../../../components/ui/Toast';
import StandardButton from '../../../components/ui/StandardButton';
import type { PhotoOverlayRecord, PhotoOverlayResponse } from '../../../types/photo.types';

const errorMessage = (e: unknown, fallback: string): string =>
  (e as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;

const STATUS_STYLES: Record<PhotoOverlayRecord['status'], string> = {
  active: 'bg-green-100 text-green-800',
  scheduled: 'bg-blue-100 text-blue-800',
  expired: 'bg-gray-200 text-gray-700',
  disabled: 'bg-gray-100 text-gray-500',
};

const PhotoOverlays = () => {
  const { themeColor } = useThemeColor();
  const { effectiveLocationId, isCompanyAdmin } = useLocationScope();

  const [data, setData] = useState<PhotoOverlayResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [priority, setPriority] = useState(0);

  const load = useCallback(async () => {
    if (!effectiveLocationId) return;
    setLoading(true);
    try {
      setData(await photoService.getOverlays(effectiveLocationId));
    } catch (e) {
      setToast({ message: errorMessage(e, 'Could not load the overlays.'), type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [effectiveLocationId]);

  useEffect(() => {
    void load();
  }, [load]);

  const create = useCallback(async () => {
    if (!effectiveLocationId || !file || name.trim().length === 0) return;
    setBusy(true);
    try {
      const form = new FormData();
      form.append('location_id', String(effectiveLocationId));
      form.append('name', name.trim());
      form.append('image', file);
      if (startsAt) form.append('starts_at', startsAt);
      if (endsAt) form.append('ends_at', endsAt);
      form.append('priority', String(priority));
      await photoService.createOverlay(form);
      setToast({ message: 'Overlay uploaded.', type: 'success' });
      setShowForm(false);
      setName('');
      setFile(null);
      setStartsAt('');
      setEndsAt('');
      setPriority(0);
      await load();
    } catch (e) {
      setToast({ message: errorMessage(e, 'That overlay could not be saved.'), type: 'error' });
    } finally {
      setBusy(false);
    }
  }, [effectiveLocationId, endsAt, file, load, name, priority, startsAt]);

  const toggleEnabled = useCallback(
    async (overlay: PhotoOverlayRecord) => {
      setBusy(true);
      try {
        const form = new FormData();
        form.append('is_enabled', overlay.is_enabled ? '0' : '1');
        await photoService.updateOverlay(overlay.id, form);
        await load();
      } catch (e) {
        setToast({ message: errorMessage(e, 'That change could not be saved.'), type: 'error' });
      } finally {
        setBusy(false);
      }
    },
    [load],
  );

  const remove = useCallback(
    async (overlay: PhotoOverlayRecord) => {
      setBusy(true);
      try {
        await photoService.deleteOverlay(overlay.id);
        setToast({
          message: 'Overlay deleted. New photos use the date layer only unless another overlay is active.',
          type: 'info',
        });
        await load();
      } catch (e) {
        setToast({ message: errorMessage(e, 'That overlay could not be deleted.'), type: 'error' });
      } finally {
        setBusy(false);
      }
    },
    [load],
  );

  if (!effectiveLocationId) {
    return (
      <div className="min-h-screen px-6 py-8">
        <div className="max-w-lg mx-auto text-center bg-white border border-gray-200 rounded-2xl p-8">
          <MapPin className="w-10 h-10 mx-auto text-gray-400 mb-3" />
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Choose a location first</h1>
          <p className="text-gray-600 text-sm">
            {isCompanyAdmin ? 'Overlays are stored per location.' : 'Your account is not assigned to a location yet.'}
          </p>
        </div>
      </div>
    );
  }

  const fieldCls = `w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-${themeColor}-600`;

  return (
    <div className="min-h-screen px-4 sm:px-6 py-8">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="max-w-5xl mx-auto">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Layers className={`w-6 h-6 text-${themeColor}-700`} />
              Photo overlays
            </h1>
            <p className="text-sm text-gray-600 mt-1">{data?.date_layer_note}</p>
          </div>
          <div className="flex gap-2">
            <StandardButton variant="secondary" size="sm" icon={RefreshCcw} onClick={() => void load()} loading={loading}>
              Refresh
            </StandardButton>
            <StandardButton size="sm" icon={Plus} onClick={() => setShowForm(true)}>
              Upload overlay
            </StandardButton>
          </div>
        </div>

        {(data?.conflicts.length ?? 0) > 0 && (
          <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="flex items-center gap-2 font-medium text-amber-900">
              <AlertTriangle className="w-4 h-4" />
              Overlapping schedules
            </p>
            <ul className="mt-2 space-y-1 text-sm text-amber-900">
              {data?.conflicts.map((conflict, i) => (
                <li key={`${conflict.overlay_id}-${conflict.conflicts_with_id}-${i}`}>
                  &ldquo;{conflict.overlay_name}&rdquo; overlaps &ldquo;{conflict.conflicts_with_name}&rdquo; — the
                  higher priority one is used for new photos.
                </li>
              ))}
            </ul>
          </div>
        )}

        {!loading && (data?.overlays.length ?? 0) === 0 && (
          <div className="bg-white border border-gray-200 rounded-2xl p-10 text-center">
            <Layers className="w-10 h-10 mx-auto text-gray-300 mb-3" />
            <p className="text-gray-900 font-medium mb-1">No overlays yet</p>
            <p className="text-sm text-gray-500">
              Photos still work — they get the capture date layer only until you upload an overlay.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {(data?.overlays ?? []).map((overlay) => (
            <div key={overlay.id} className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
              <div className="bg-[repeating-conic-gradient(#f3f4f6_0%_25%,white_0%_50%)] bg-[length:16px_16px] aspect-video flex items-center justify-center">
                {overlay.image_url ? (
                  <img src={overlay.image_url} alt={overlay.name} className="max-h-full max-w-full object-contain" />
                ) : (
                  <span className="text-xs text-gray-400">No image</span>
                )}
              </div>

              <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-gray-900">{overlay.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">Priority {overlay.priority}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`text-[11px] rounded-full px-2 py-0.5 ${STATUS_STYLES[overlay.status]}`}>
                      {overlay.status}
                    </span>
                    {overlay.is_active && (
                      <span className="text-[11px] rounded-full bg-green-600 text-white px-2 py-0.5">
                        used for new photos
                      </span>
                    )}
                  </div>
                </div>

                <p className="text-xs text-gray-500 mt-2">
                  {overlay.starts_at ? `From ${new Date(overlay.starts_at).toLocaleString()}` : 'No start date'}
                  {' · '}
                  {overlay.ends_at ? `until ${new Date(overlay.ends_at).toLocaleString()}` : 'no end date'}
                </p>

                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    onClick={() => void toggleEnabled(overlay)}
                    disabled={busy}
                    className="flex-1 text-xs border border-gray-200 rounded-lg py-2 hover:bg-gray-50 disabled:opacity-40"
                  >
                    {overlay.is_enabled ? 'Disable' : 'Enable'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void remove(overlay)}
                    disabled={busy}
                    className="inline-flex items-center justify-center gap-1 text-xs border border-gray-200 rounded-lg px-3 py-2 hover:bg-red-50 text-red-700 disabled:opacity-40"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" role="dialog">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">Upload an overlay</h2>
              <button type="button" onClick={() => setShowForm(false)} aria-label="Close">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <p className="text-sm text-gray-600">
                Use a transparent PNG sized to your photo frame. It is scaled to cover the picture, then the capture date
                is drawn on top.
              </p>

              <div>
                <label htmlFor="ov-name" className="block text-sm text-gray-700 mb-1">
                  Name
                </label>
                <input id="ov-name" value={name} onChange={(e) => setName(e.target.value)} className={fieldCls} />
              </div>

              <div>
                <label htmlFor="ov-file" className="block text-sm text-gray-700 mb-1">
                  Overlay image
                </label>
                <input
                  id="ov-file"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  className="block w-full text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="ov-start" className="block text-sm text-gray-700 mb-1">
                    Starts (optional)
                  </label>
                  <input
                    id="ov-start"
                    type="datetime-local"
                    value={startsAt}
                    onChange={(e) => setStartsAt(e.target.value)}
                    className={fieldCls}
                  />
                </div>
                <div>
                  <label htmlFor="ov-end" className="block text-sm text-gray-700 mb-1">
                    Ends (optional)
                  </label>
                  <input
                    id="ov-end"
                    type="datetime-local"
                    value={endsAt}
                    onChange={(e) => setEndsAt(e.target.value)}
                    className={fieldCls}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="ov-priority" className="block text-sm text-gray-700 mb-1">
                  Priority when schedules overlap
                </label>
                <input
                  id="ov-priority"
                  type="number"
                  min={0}
                  max={100}
                  value={priority}
                  onChange={(e) => setPriority(Number(e.target.value))}
                  className={fieldCls}
                />
              </div>

              <StandardButton
                fullWidth
                onClick={() => void create()}
                loading={busy}
                disabled={!file || name.trim().length === 0}
              >
                Save overlay
              </StandardButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PhotoOverlays;
