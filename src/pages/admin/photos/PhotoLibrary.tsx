import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  Download,
  Images,
  MapPin,
  RefreshCcw,
  Search,
  Send,
  X,
} from 'lucide-react';
import { useThemeColor } from '../../../hooks/useThemeColor';
import { useLocationScope } from '../../../contexts/LocationContext';
import photoService from '../../../services/PhotoService';
import Toast from '../../../components/ui/Toast';
import StandardButton from '../../../components/ui/StandardButton';
import type { PhotoLibraryResponse, PhotoRecord, PhotoWaiverMatch } from '../../../types/photo.types';

const errorMessage = (e: unknown, fallback: string): string =>
  (e as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;

const saveBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const PhotoLibrary = () => {
  const { themeColor } = useThemeColor();
  const { effectiveLocationId, isCompanyAdmin } = useLocationScope();

  const [library, setLibrary] = useState<PhotoLibraryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [source, setSource] = useState<'' | 'staff' | 'kiosk'>('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [preview, setPreview] = useState<PhotoRecord | null>(null);

  const [sendFor, setSendFor] = useState<PhotoRecord | null>(null);
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState<PhotoWaiverMatch[]>([]);
  const [searching, setSearching] = useState(false);
  const [chosen, setChosen] = useState<number[]>([]);
  const [schedule, setSchedule] = useState<'immediate' | 'next_day_9am'>('immediate');
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    if (!effectiveLocationId) return;
    setLoading(true);
    try {
      const params: Record<string, unknown> = { location_id: effectiveLocationId };
      if (source) params.source = source;
      if (from) params.from = from;
      if (to) params.to = to;
      setLibrary(await photoService.getLibrary(params));
    } catch (e) {
      setToast({ message: errorMessage(e, 'Could not load the photo library.'), type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [effectiveLocationId, from, source, to]);

  useEffect(() => {
    void load();
  }, [load]);

  const allPhotos = useMemo(() => (library?.days ?? []).flatMap((day) => day.photos), [library]);

  const toggle = useCallback((photoId: number) => {
    setSelectedIds((prev) => (prev.includes(photoId) ? prev.filter((id) => id !== photoId) : [...prev, photoId]));
  }, []);

  const toggleDay = useCallback((photos: PhotoRecord[]) => {
    const ids = photos.map((p) => p.id);
    setSelectedIds((prev) => {
      const allSelected = ids.every((id) => prev.includes(id));
      return allSelected ? prev.filter((id) => !ids.includes(id)) : [...new Set([...prev, ...ids])];
    });
  }, []);

  const downloadOne = useCallback(async (photo: PhotoRecord) => {
    try {
      const blob = await photoService.downloadPhoto(photo.id);
      saveBlob(blob, `zapzone-${photo.operating_day ?? 'photo'}-${photo.id}.jpg`);
    } catch (e) {
      setToast({ message: errorMessage(e, 'That download failed.'), type: 'error' });
    }
  }, []);

  const downloadSelected = useCallback(async () => {
    if (selectedIds.length === 0) return;
    try {
      const blob = await photoService.downloadPhotos(selectedIds);
      saveBlob(blob, `zapzone-photos-${new Date().toISOString().slice(0, 10)}.zip`);
    } catch (e) {
      setToast({ message: errorMessage(e, 'The bulk download failed.'), type: 'error' });
    }
  }, [selectedIds]);

  const runSearch = useCallback(async () => {
    if (query.trim().length < 2) return;
    setSearching(true);
    try {
      setMatches(await photoService.searchWaivers(query.trim(), effectiveLocationId));
    } catch (e) {
      setToast({ message: errorMessage(e, 'The waiver search failed.'), type: 'error' });
    } finally {
      setSearching(false);
    }
  }, [effectiveLocationId, query]);

  const send = useCallback(async () => {
    if (!sendFor || chosen.length === 0) return;
    setSending(true);
    try {
      await photoService.sendPhoto(sendFor.id, { waiver_ids: chosen, schedule });
      setToast({ message: 'Sent using the normal waiver message delivery flow.', type: 'success' });
      setSendFor(null);
      setChosen([]);
      setMatches([]);
      setQuery('');
      void load();
    } catch (e) {
      setToast({ message: errorMessage(e, 'That send failed.'), type: 'error' });
    } finally {
      setSending(false);
    }
  }, [chosen, load, schedule, sendFor]);

  if (!effectiveLocationId) {
    return (
      <div className="min-h-screen px-6 py-8">
        <div className="max-w-lg mx-auto text-center bg-white border border-gray-200 rounded-2xl p-8">
          <MapPin className="w-10 h-10 mx-auto text-gray-400 mb-3" />
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Choose a location first</h1>
          <p className="text-gray-600 text-sm">
            {isCompanyAdmin
              ? 'Pick a location in the sidebar to see its photos grouped by operating day.'
              : 'Your account is not assigned to a location yet.'}
          </p>
        </div>
      </div>
    );
  }

  const fieldCls = `border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-${themeColor}-600`;

  return (
    <div className="min-h-screen px-4 sm:px-6 py-8">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="max-w-7xl mx-auto">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Images className={`w-6 h-6 text-${themeColor}-700`} />
              Daily photo library
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              Grouped by operating day. A day runs 6:00 AM to 5:59 AM the next morning, in this location&apos;s time
              zone.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select value={source} onChange={(e) => setSource(e.target.value as '' | 'staff' | 'kiosk')} className={fieldCls}>
              <option value="">All sources</option>
              <option value="staff">Staff sessions</option>
              <option value="kiosk">Kiosk sessions</option>
            </select>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={fieldCls} aria-label="From day" />
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={fieldCls} aria-label="To day" />
            <StandardButton variant="secondary" size="sm" icon={RefreshCcw} onClick={() => void load()} loading={loading}>
              Refresh
            </StandardButton>
          </div>
        </div>

        {selectedIds.length > 0 && (
          <div className="mb-5 flex flex-wrap items-center gap-3 bg-white border border-gray-200 rounded-xl px-4 py-3">
            <span className="text-sm text-gray-800">{selectedIds.length} selected</span>
            <StandardButton size="sm" icon={Download} onClick={() => void downloadSelected()}>
              Download selected
            </StandardButton>
            <button type="button" onClick={() => setSelectedIds([])} className="text-sm text-gray-500 underline">
              Clear
            </button>
          </div>
        )}

        {library?.truncated && (
          <p className="mb-4 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            Showing the most recent 1,500 photos. Narrow the date range to see older days.
          </p>
        )}

        {!loading && allPhotos.length === 0 && (
          <div className="bg-white border border-gray-200 rounded-2xl p-10 text-center">
            <Images className="w-10 h-10 mx-auto text-gray-300 mb-3" />
            <p className="text-gray-900 font-medium mb-1">No photos in this range</p>
            <p className="text-sm text-gray-500">
              Photos appear here once a staff session or kiosk capture finishes processing. Retaken and abandoned
              captures are discarded and never stored.
            </p>
          </div>
        )}

        <div className="space-y-8">
          {(library?.days ?? []).map((day) => (
            <section key={day.operating_day}>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                  <CalendarDays className="w-4 h-4 text-gray-500" />
                  {day.label}
                  <span className="text-sm font-normal text-gray-500">
                    {day.photo_count} photo{day.photo_count === 1 ? '' : 's'} · {day.staff_count} staff ·{' '}
                    {day.kiosk_count} kiosk
                  </span>
                </h2>
                <button
                  type="button"
                  onClick={() => toggleDay(day.photos)}
                  className={`text-sm text-${themeColor}-700 underline`}
                >
                  Select this day
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                {day.photos.map((photo) => (
                  <div key={photo.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setPreview(photo)}
                        className="block w-full aspect-square bg-gray-100"
                      >
                        {photo.thumbnail_url ? (
                          <img
                            src={photo.thumbnail_url}
                            alt={`Photo ${photo.id}`}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="flex items-center justify-center h-full text-xs text-gray-400">
                            No preview
                          </span>
                        )}
                      </button>
                      <label className="absolute top-2 left-2 bg-white/90 rounded p-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(photo.id)}
                          onChange={() => toggle(photo.id)}
                          aria-label={`Select photo ${photo.id}`}
                          className={`h-4 w-4 accent-${themeColor}-700`}
                        />
                      </label>
                    </div>

                    <div className="p-3 space-y-2">
                      <div className="flex flex-wrap gap-1">
                        <span className="text-[11px] rounded-full bg-gray-100 px-2 py-0.5 text-gray-700 capitalize">
                          {photo.session?.source ?? photo.session_source ?? photo.source}
                        </span>
                        {photo.slideshow_eligible ? (
                          <span
                            className={`text-[11px] rounded-full px-2 py-0.5 ${
                              photo.slideshow_state === 'visible'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-gray-200 text-gray-700'
                            }`}
                          >
                            slideshow {photo.slideshow_state}
                          </span>
                        ) : (
                          <span className="text-[11px] rounded-full bg-gray-100 px-2 py-0.5 text-gray-500">
                            not on slideshow
                          </span>
                        )}
                        <span
                          className={`text-[11px] rounded-full px-2 py-0.5 ${
                            photo.session?.access_status === 'active'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          link {photo.session?.access_status ?? 'unknown'}
                        </span>
                      </div>

                      <p className="text-[11px] text-gray-500">
                        {photo.capture_date}
                        {photo.download_count > 0 && ` · ${photo.download_count} download(s)`}
                      </p>

                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => void downloadOne(photo)}
                          className="flex-1 inline-flex items-center justify-center gap-1 text-xs border border-gray-200 rounded-lg py-1.5 hover:bg-gray-50"
                        >
                          <Download className="w-3.5 h-3.5" />
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSendFor(photo);
                            setChosen([]);
                            setMatches([]);
                            setQuery('');
                          }}
                          disabled={photo.session?.access_status !== 'active'}
                          className="flex-1 inline-flex items-center justify-center gap-1 text-xs border border-gray-200 rounded-lg py-1.5 hover:bg-gray-50 disabled:opacity-40"
                        >
                          <Send className="w-3.5 h-3.5" />
                          Send
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>

      {preview && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" role="dialog">
          <div className="max-w-3xl w-full">
            <div className="flex justify-end mb-2">
              <button type="button" onClick={() => setPreview(null)} aria-label="Close preview" className="text-white">
                <X className="w-6 h-6" />
              </button>
            </div>
            <img src={preview.delivery_url ?? ''} alt={`Photo ${preview.id}`} className="w-full rounded-xl" />
            <div className="mt-3 flex flex-wrap gap-3 justify-center">
              <StandardButton size="sm" icon={Download} onClick={() => void downloadOne(preview)}>
                Download
              </StandardButton>
              {preview.session?.photo_link && (
                <a
                  href={preview.session.photo_link}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-white underline self-center"
                >
                  Open the customer page
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {sendFor && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" role="dialog">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">Send this photo from the backend</h2>
              <button type="button" onClick={() => setSendFor(null)} aria-label="Close">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-5">
              <p className="text-sm text-gray-600 mb-4">
                This uses the normal waiver message delivery flow, and the action is recorded in the activity log.
              </p>

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
                <StandardButton size="sm" onClick={() => void runSearch()} loading={searching}>
                  Search
                </StandardButton>
              </div>

              <ul className="space-y-2 max-h-56 overflow-y-auto mb-4">
                {matches.map((waiver) => (
                  <li key={waiver.id}>
                    <label
                      className={`flex items-start gap-3 rounded-xl border p-3 ${
                        waiver.contactable ? 'cursor-pointer border-gray-200' : 'border-gray-200 bg-gray-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={chosen.includes(waiver.id)}
                        disabled={!waiver.contactable}
                        onChange={() =>
                          setChosen((prev) =>
                            prev.includes(waiver.id) ? prev.filter((id) => id !== waiver.id) : [...prev, waiver.id],
                          )
                        }
                        className={`mt-1 h-4 w-4 accent-${themeColor}-700`}
                      />
                      <span className="flex-1">
                        <span className="block text-sm font-medium text-gray-900">{waiver.name}</span>
                        <span className="block text-xs text-gray-500">
                          {waiver.email_masked || 'no email'} · {waiver.phone_masked || 'no phone'}
                        </span>
                        {!waiver.contactable && (
                          <span className="text-[11px] text-amber-800">no contact method on this waiver</span>
                        )}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>

              <div className="space-y-2 mb-5">
                <label className="flex items-center gap-3 cursor-pointer text-sm">
                  <input
                    type="radio"
                    name="lib-schedule"
                    checked={schedule === 'immediate'}
                    onChange={() => setSchedule('immediate')}
                    className={`accent-${themeColor}-700`}
                  />
                  <span>Send immediately</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer text-sm">
                  <input
                    type="radio"
                    name="lib-schedule"
                    checked={schedule === 'next_day_9am'}
                    onChange={() => setSchedule('next_day_9am')}
                    className={`accent-${themeColor}-700`}
                  />
                  <span>9:00 AM tomorrow, location time</span>
                </label>
              </div>

              <StandardButton fullWidth onClick={() => void send()} loading={sending} disabled={chosen.length === 0}>
                Send to {chosen.length} waiver{chosen.length === 1 ? '' : 's'}
              </StandardButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PhotoLibrary;
