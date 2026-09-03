import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DragEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getImageUrl } from '../../../utils/storage';
import { ArrowLeft, ExternalLink, GripVertical, MapPin, Megaphone, Pencil, Plus, ShieldCheck, Trash2, X } from 'lucide-react';
import { useThemeColor } from '../../../hooks/useThemeColor';
import waiverService from '../../../services/waiverService';
import { locationService } from '../../../services/LocationService';
import type { Location } from '../../../services/LocationService';
import Toast from '../../../components/ui/Toast';
import StandardButton from '../../../components/ui/StandardButton';
import type { WaiverAdRecord, WaiverAdSettings } from '../../../types/waiver.types';

const errorMessage = (e: unknown, fallback: string): string =>
  (e as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;

const STATUS_STYLES: Record<WaiverAdRecord['status'], string> = {
  active: 'bg-green-100 text-green-800',
  scheduled: 'bg-blue-100 text-blue-800',
  expired: 'bg-gray-200 text-gray-700',
  disabled: 'bg-amber-100 text-amber-800',
};

const toLocalInput = (value: string | null): string =>
  value ? value.replace(' ', 'T').slice(0, 16) : '';

const scheduleText = (ad: WaiverAdRecord): string => {
  if (!ad.starts_at && !ad.ends_at) return 'Always shown';
  const from = ad.starts_at ? `From ${new Date(ad.starts_at).toLocaleString()}` : 'No start date';
  const until = ad.ends_at ? `until ${new Date(ad.ends_at).toLocaleString()}` : 'no end date';
  return `${from} · ${until}`;
};

interface AdFormState {
  file: File | null;
  preview: string | null;
  name: string;
  destinationUrl: string;
  startsAt: string;
  endsAt: string;
  locationId: string;
}

const emptyForm: AdFormState = {
  file: null,
  preview: null,
  name: '',
  destinationUrl: '',
  startsAt: '',
  endsAt: '',
  locationId: '',
};

type ModalState =
  | { kind: 'create'; fallback: boolean }
  | { kind: 'edit'; ad: WaiverAdRecord };

const WaiverAds = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const templateId = Number(id);
  const { themeColor, fullColor } = useThemeColor();

  const [templateTitle, setTemplateTitle] = useState('');
  const [settings, setSettings] = useState<WaiverAdSettings | null>(null);
  const [secondsInput, setSecondsInput] = useState('3');
  const [ads, setAds] = useState<WaiverAdRecord[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const [modal, setModal] = useState<ModalState | null>(null);
  const [form, setForm] = useState<AdFormState>(emptyForm);

  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const dragDirty = useRef(false);
  const adsRef = useRef<WaiverAdRecord[]>([]);
  adsRef.current = ads;

  const regularAds = useMemo(() => ads.filter((a) => !a.is_fallback), [ads]);
  const fallbackAd = useMemo(() => ads.find((a) => a.is_fallback) ?? null, [ads]);

  const load = useCallback(async () => {
    try {
      const res = await waiverService.getTemplateAds(templateId);
      if (res.success) {
        setSettings(res.data.settings);
        setSecondsInput(String(res.data.settings.ads_display_seconds));
        setAds(res.data.ads);
      }
    } catch (e) {
      setToast({ message: errorMessage(e, 'Could not load the ads.'), type: 'error' });
    }
  }, [templateId]);

  useEffect(() => {
    if (!templateId) {
      navigate('/waivers/templates', { replace: true });
      return;
    }
    (async () => {
      setLoading(true);
      try {
        const res = await waiverService.getTemplate(templateId);
        if (res.success) setTemplateTitle(res.data.title);
      } catch {
        setToast({ message: 'Failed to load the template', type: 'error' });
      }
      await load();
      setLoading(false);
    })();
  }, [templateId, load]);

  useEffect(() => {
    locationService.getLocations({ per_page: 200 })
      .then((r) => setLocations(r.data || []))
      .catch(() => {});
  }, []);

  const saveSettings = useCallback(
    async (patch: Partial<WaiverAdSettings>) => {
      setBusy(true);
      try {
        const res = await waiverService.updateAdSettings(templateId, patch);
        if (res.success) {
          setSettings(res.data);
          setSecondsInput(String(res.data.ads_display_seconds));
        }
      } catch (e) {
        setToast({ message: errorMessage(e, 'Those settings could not be saved.'), type: 'error' });
      } finally {
        setBusy(false);
      }
    },
    [templateId],
  );

  const commitSeconds = () => {
    if (!settings) return;
    const parsed = Number(secondsInput);
    const clamped = Number.isFinite(parsed) ? Math.min(10, Math.max(1, Math.round(parsed))) : settings.ads_display_seconds;
    setSecondsInput(String(clamped));
    if (clamped !== settings.ads_display_seconds) {
      void saveSettings({ ads_display_seconds: clamped });
    }
  };

  const openCreate = (fallback: boolean) => {
    setForm(emptyForm);
    setModal({ kind: 'create', fallback });
  };

  const openEdit = (ad: WaiverAdRecord) => {
    setForm({
      file: null,
      preview: null,
      name: ad.name ?? '',
      destinationUrl: ad.destination_url ?? '',
      startsAt: toLocalInput(ad.starts_at),
      endsAt: toLocalInput(ad.ends_at),
      locationId: ad.location_id != null ? String(ad.location_id) : '',
    });
    setModal({ kind: 'edit', ad });
  };

  const setFile = (file: File | null) => {
    setForm((f) => ({ ...f, file, preview: null }));
    if (file) {
      const reader = new FileReader();
      reader.onload = () => setForm((f) => (f.file === file ? { ...f, preview: String(reader.result) } : f));
      reader.readAsDataURL(file);
    }
  };

  const submitModal = useCallback(async () => {
    if (!modal) return;
    setBusy(true);
    try {
      const data = new FormData();
      if (form.file) data.append('image', form.file);
      data.append('name', form.name.trim());
      if (modal.kind === 'create') {
        if (form.destinationUrl.trim()) data.append('destination_url', form.destinationUrl.trim());
        if (!modal.fallback) {
          if (form.locationId) data.append('location_id', form.locationId);
          if (form.startsAt) data.append('starts_at', form.startsAt);
          if (form.endsAt) data.append('ends_at', form.endsAt);
        }
        data.append('is_fallback', modal.fallback ? '1' : '0');
        await waiverService.createTemplateAd(templateId, data);
        setToast({ message: modal.fallback ? 'Fallback ad uploaded.' : 'Ad uploaded.', type: 'success' });
      } else {
        const ad = modal.ad;
        if (form.destinationUrl.trim()) {
          data.append('destination_url', form.destinationUrl.trim());
        } else if (ad.destination_url) {
          data.append('clear_link', '1');
        }
        if (!ad.is_fallback) {
          if (!form.startsAt && !form.endsAt) {
            if (ad.starts_at || ad.ends_at) data.append('clear_schedule', '1');
          } else {
            data.append('starts_at', form.startsAt);
            data.append('ends_at', form.endsAt);
          }
          if (form.locationId) {
            data.append('location_id', form.locationId);
          } else if (ad.location_id != null) {
            data.append('location_id', '');
          }
        }
        await waiverService.updateTemplateAd(ad.id, data);
        setToast({ message: 'Ad updated.', type: 'success' });
      }
      setModal(null);
      setForm(emptyForm);
      await load();
    } catch (e) {
      setToast({ message: errorMessage(e, 'That ad could not be saved.'), type: 'error' });
    } finally {
      setBusy(false);
    }
  }, [form, load, modal, templateId]);

  const toggleEnabled = useCallback(
    async (ad: WaiverAdRecord) => {
      setBusy(true);
      try {
        const data = new FormData();
        data.append('is_enabled', ad.is_enabled ? '0' : '1');
        await waiverService.updateTemplateAd(ad.id, data);
        await load();
      } catch (e) {
        setToast({ message: errorMessage(e, 'That change could not be saved.'), type: 'error' });
      } finally {
        setBusy(false);
      }
    },
    [load],
  );

  const removeAd = useCallback(
    async (ad: WaiverAdRecord) => {
      if (!window.confirm(`Delete ${ad.name ? `"${ad.name}"` : 'this ad'}? This cannot be undone.`)) return;
      setBusy(true);
      try {
        await waiverService.deleteTemplateAd(ad.id);
        setToast({ message: 'Ad deleted.', type: 'info' });
        await load();
      } catch (e) {
        setToast({ message: errorMessage(e, 'That ad could not be deleted.'), type: 'error' });
      } finally {
        setBusy(false);
      }
    },
    [load],
  );

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
    dragDirty.current = false;
  };

  const handleDragOver = (e: DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    dragDirty.current = true;
    const from = draggedIndex;
    const regular = adsRef.current.filter((a) => !a.is_fallback);
    const rest = adsRef.current.filter((a) => a.is_fallback);
    const next = [...regular];
    const [moved] = next.splice(from, 1);
    next.splice(index, 0, moved);
    const reordered = [...next, ...rest];
    adsRef.current = reordered;
    setAds(reordered);
    setDraggedIndex(index);
  };

  const handleDragEnd = async () => {
    setDraggedIndex(null);
    if (!dragDirty.current) return;
    dragDirty.current = false;
    try {
      await waiverService.reorderTemplateAds(templateId, adsRef.current.filter((a) => !a.is_fallback).map((a) => a.id));
    } catch (e) {
      setToast({ message: errorMessage(e, 'The new order could not be saved.'), type: 'error' });
      await load();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className={`animate-spin rounded-full h-12 w-12 border-b-2 border-${fullColor}`} />
      </div>
    );
  }

  const labelCls = 'block text-sm font-medium text-gray-700 mb-1.5';
  const fieldCls = `w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 outline-none`;
  const card = 'bg-white rounded-xl shadow-sm border border-gray-100 p-6';

  const renderAdCard = (ad: WaiverAdRecord, index: number | null) => (
    <div
      key={ad.id}
      className={`bg-white border border-gray-200 rounded-2xl p-4 flex flex-col sm:flex-row gap-4 ${index !== null && draggedIndex === index ? 'opacity-50' : ''}`}
      draggable={index !== null}
      onDragStart={index !== null ? () => handleDragStart(index) : undefined}
      onDragOver={index !== null ? (e) => handleDragOver(e, index) : undefined}
      onDragEnd={index !== null ? () => void handleDragEnd() : undefined}
    >
      {index !== null && (
        <div className="hidden sm:flex items-center cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600">
          <GripVertical size={18} />
        </div>
      )}
      <div className="bg-[repeating-conic-gradient(#f3f4f6_0%_25%,white_0%_50%)] bg-[length:16px_16px] rounded-lg w-full sm:w-44 h-28 flex items-center justify-center overflow-hidden shrink-0">
        {ad.image_path ? (
          <img src={getImageUrl(ad.image_path)} alt={ad.name ?? 'Ad'} className="max-h-full max-w-full object-contain" />
        ) : (
          <span className="text-xs text-gray-400">No image</span>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium text-gray-900 truncate">{ad.name || 'Untitled ad'}</p>
          <span className={`text-[11px] rounded-full px-2 py-0.5 ${STATUS_STYLES[ad.status]}`}>{ad.status}</span>
          <span className="text-[11px] rounded-full px-2 py-0.5 bg-gray-100 text-gray-600 inline-flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            {ad.location_name ?? 'All locations'}
          </span>
        </div>
        {ad.destination_url && (
          <p className={`text-xs text-${themeColor}-700 mt-1 truncate inline-flex items-center gap-1 max-w-full`}>
            <ExternalLink className="w-3 h-3 shrink-0" />
            <span className="truncate">{ad.destination_url}</span>
          </p>
        )}
        <p className="text-xs text-gray-500 mt-1">{scheduleText(ad)}</p>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void toggleEnabled(ad)}
            disabled={busy}
            className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 disabled:opacity-40"
          >
            {ad.is_enabled ? 'Disable' : 'Enable'}
          </button>
          <button
            type="button"
            onClick={() => openEdit(ad)}
            disabled={busy}
            className="inline-flex items-center gap-1 text-xs border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 disabled:opacity-40"
          >
            <Pencil className="w-3.5 h-3.5" />
            Edit
          </button>
          <button
            type="button"
            onClick={() => void removeAd(ad)}
            disabled={busy}
            className="inline-flex items-center gap-1 text-xs border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-red-50 text-red-700 disabled:opacity-40"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen px-4 sm:px-6 py-8">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/waivers/templates')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Back to templates"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Megaphone className={`w-6 h-6 text-${themeColor}-700`} />
                Post-Waiver Ads
              </h1>
              <p className="text-gray-500 text-sm mt-0.5">{templateTitle || `Template #${templateId}`}</p>
            </div>
          </div>
          <StandardButton size="sm" icon={Plus} onClick={() => openCreate(false)}>
            Add ad
          </StandardButton>
        </div>

        {settings && (
          <div className={`${card} mb-6`}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-medium text-gray-900">Show an ad after each completed waiver</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  A full-screen ad appears on the kiosk success screen, then it returns to the start screen.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void saveSettings({ ads_enabled: !settings.ads_enabled })}
                disabled={busy}
                aria-label="Toggle ads"
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-40 ${settings.ads_enabled ? `bg-${themeColor}-600` : 'bg-gray-300'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.ads_enabled ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-5">
              <div>
                <label className={labelCls}>Rotation</label>
                <select
                  value={settings.ads_rotation_mode}
                  onChange={(e) => void saveSettings({ ads_rotation_mode: e.target.value as WaiverAdSettings['ads_rotation_mode'] })}
                  disabled={busy}
                  className={fieldCls}
                >
                  <option value="random">Random</option>
                  <option value="ordered">Specific order</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Display duration (seconds)</label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={secondsInput}
                  onChange={(e) => setSecondsInput(e.target.value)}
                  onBlur={commitSeconds}
                  disabled={busy}
                  className={fieldCls}
                />
                <p className="text-[11px] text-gray-400 mt-1">
                  How long the ad holds before the kiosk returns to the start screen
                </p>
              </div>
            </div>
          </div>
        )}

        {ads.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-2xl p-10 text-center">
            <Megaphone className="w-10 h-10 mx-auto text-gray-300 mb-3" />
            <p className="text-gray-900 font-medium mb-1">No ads yet</p>
            <p className="text-sm text-gray-500 max-w-md mx-auto">
              After a guest completes this waiver on the kiosk, a full-screen ad can promote your attractions,
              parties, or memberships — with an optional &ldquo;learn more&rdquo; link sent by email or text.
              Upload your first ad to get started.
            </p>
            <div className="mt-4">
              <StandardButton size="sm" icon={Plus} onClick={() => openCreate(false)}>
                Upload an ad
              </StandardButton>
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <h2 className="font-semibold text-gray-900">Ads</h2>
              <p className="text-xs text-gray-500">
                {settings?.ads_rotation_mode === 'ordered'
                  ? 'Drag to set the display order.'
                  : 'Drag to reorder — the order only matters when rotation is set to specific order.'}
              </p>
            </div>

            {regularAds.length === 0 ? (
              <div className="bg-white border border-dashed border-gray-300 rounded-2xl p-6 text-center text-sm text-gray-500 mb-6">
                No regular ads yet — only the fallback below can show.
              </div>
            ) : (
              <div className="space-y-3 mb-6">{regularAds.map((ad, index) => renderAdCard(ad, index))}</div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-gray-500" />
                Fallback ad
              </h2>
              {!fallbackAd && (
                <StandardButton variant="secondary" size="sm" icon={Plus} onClick={() => openCreate(true)}>
                  Add fallback ad
                </StandardButton>
              )}
            </div>
            <p className="text-xs text-gray-500 mb-3">
              Used only when no regular ad is eligible — for example when every ad is scheduled for another time or
              targets a different location. Only one fallback is allowed.
            </p>
            {fallbackAd ? (
              renderAdCard(fallbackAd, null)
            ) : (
              <div className="bg-white border border-dashed border-gray-300 rounded-2xl p-6 text-center text-sm text-gray-500">
                No fallback ad — when no regular ad is eligible, the kiosk simply returns to the start screen.
              </div>
            )}
          </>
        )}
      </div>

      {modal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" role="dialog">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">
                {modal.kind === 'create'
                  ? modal.fallback ? 'Upload the fallback ad' : 'Upload an ad'
                  : modal.ad.is_fallback ? 'Edit the fallback ad' : 'Edit ad'}
              </h2>
              <button type="button" onClick={() => setModal(null)} aria-label="Close">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label htmlFor="ad-file" className={labelCls}>
                  {modal.kind === 'edit' ? 'Replace image (optional)' : 'Ad image'}
                </label>
                <input
                  id="ad-file"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  className="block w-full text-sm"
                />
                <p className="text-[11px] text-gray-400 mt-1">PNG, JPG, or WEBP up to 8MB. Portrait works best on the kiosk.</p>
              </div>

              {(form.preview || (modal.kind === 'edit' && modal.ad.image_path)) && (
                <div className="bg-[repeating-conic-gradient(#f3f4f6_0%_25%,white_0%_50%)] bg-[length:16px_16px] rounded-lg h-40 flex items-center justify-center overflow-hidden">
                  <img
                    src={form.preview ?? (modal.kind === 'edit' ? getImageUrl(modal.ad.image_path) : '')}
                    alt="Ad preview"
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
              )}

              <div>
                <label htmlFor="ad-name" className={labelCls}>Name (optional)</label>
                <input
                  id="ad-name"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className={fieldCls}
                  placeholder="e.g. Summer Pass Promo"
                />
              </div>

              <div>
                <label htmlFor="ad-url" className={labelCls}>Destination URL (optional)</label>
                <input
                  id="ad-url"
                  type="url"
                  value={form.destinationUrl}
                  onChange={(e) => setForm((f) => ({ ...f, destinationUrl: e.target.value }))}
                  className={fieldCls}
                  placeholder="https://"
                />
                <p className="text-[11px] text-gray-400 mt-1">
                  When set, guests can ask for a &ldquo;learn more&rdquo; link by email or text.
                  {modal.kind === 'edit' && modal.ad.destination_url ? ' Clear the field to remove the link.' : ''}
                </p>
              </div>

              {((modal.kind === 'create' && !modal.fallback) || (modal.kind === 'edit' && !modal.ad.is_fallback)) && (
                <>
                  {locations.length > 0 && (
                    <div>
                      <label htmlFor="ad-location" className={labelCls}>Location</label>
                      <select
                        id="ad-location"
                        value={form.locationId}
                        onChange={(e) => setForm((f) => ({ ...f, locationId: e.target.value }))}
                        className={fieldCls}
                      >
                        <option value="">All locations</option>
                        {locations.map((loc) => (
                          <option key={loc.id} value={loc.id}>{loc.name}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="ad-start" className={labelCls}>Starts (optional)</label>
                      <input
                        id="ad-start"
                        type="datetime-local"
                        value={form.startsAt}
                        onChange={(e) => setForm((f) => ({ ...f, startsAt: e.target.value }))}
                        className={fieldCls}
                      />
                    </div>
                    <div>
                      <label htmlFor="ad-end" className={labelCls}>Ends (optional)</label>
                      <input
                        id="ad-end"
                        type="datetime-local"
                        value={form.endsAt}
                        onChange={(e) => setForm((f) => ({ ...f, endsAt: e.target.value }))}
                        className={fieldCls}
                      />
                    </div>
                  </div>
                  {modal.kind === 'edit' && (modal.ad.starts_at || modal.ad.ends_at) && (
                    <p className="text-[11px] text-gray-400 -mt-2">Clear both dates to remove the schedule.</p>
                  )}
                </>
              )}

              <StandardButton
                fullWidth
                onClick={() => void submitModal()}
                loading={busy}
                disabled={modal.kind === 'create' && !form.file}
              >
                {modal.kind === 'create' ? 'Upload ad' : 'Save changes'}
              </StandardButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WaiverAds;
