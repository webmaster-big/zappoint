import { useEffect, useRef, useState } from 'react';
import { X, Tablet, Search, Loader2, ChevronRight } from 'lucide-react';
import { useThemeColor } from '../../hooks/useThemeColor';
import waiverService from '../../services/waiverService';
import { bookingService } from '../../services/bookingService';
import { packageCacheService } from '../../services/PackageCacheService';
import { attractionCacheService } from '../../services/AttractionCacheService';
import { eventCacheService } from '../../services/EventCacheService';
import type { Package } from '../../services/PackageService';
import type { Attraction } from '../../services/AttractionService';
import type { Event } from '../../types/event.types';
import type { Booking } from '../../services/bookingService';

type SourceType = 'booking' | 'attraction_purchase' | 'event_purchase' | 'package' | 'attraction' | 'event';

interface Props {
  templateId: number;
  isPreview: boolean;
  assignedPackageIds?: number[] | null;
  assignedAttractionIds?: number[] | null;
  assignedEventIds?: number[] | null;
  onClose: () => void;
}

const SOURCE_OPTIONS: Array<{ value: SourceType; label: string; hint: string }> = [
  { value: 'booking', label: 'Booking', hint: 'Prefills customer name, package & date' },
  { value: 'attraction_purchase', label: 'Attraction Purchase', hint: 'Prefills customer & attraction from a purchase' },
  { value: 'event_purchase', label: 'Event Purchase', hint: 'Prefills customer & event from a purchase' },
  { value: 'package', label: 'Package', hint: 'Pre-selects activity only — customer fills their own info' },
  { value: 'attraction', label: 'Attraction', hint: 'Pre-selects attraction only' },
  { value: 'event', label: 'Event', hint: 'Pre-selects event only' },
];

export default function KioskSessionModal({
  templateId,
  isPreview,
  assignedPackageIds,
  assignedAttractionIds,
  assignedEventIds,
  onClose,
}: Props) {
  const { themeColor, fullColor } = useThemeColor();

  const [mode, setMode] = useState<'generic' | 'bound'>('generic');
  const [sourceType, setSourceType] = useState<SourceType>('booking');

  const [packages, setPackages] = useState<Package[]>([]);
  const [attractions, setAttractions] = useState<Attraction[]>([]);
  const [events, setEvents] = useState<Event[]>([]);

  const [bookingQuery, setBookingQuery] = useState('');
  const [bookingResults, setBookingResults] = useState<Booking[]>([]);
  const [bookingSearching, setBookingSearching] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [purchaseId, setPurchaseId] = useState('');
  const [selectedActivityId, setSelectedActivityId] = useState<number | ''>('');

  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [pkgs, attrs, evts] = await Promise.all([
        packageCacheService.getPackages().catch(() => [] as Package[]),
        attractionCacheService.getAttractions().catch(() => [] as Attraction[]),
        eventCacheService.getEvents().catch(() => [] as Event[]),
      ]);
      setPackages(assignedPackageIds?.length ? pkgs.filter((p) => assignedPackageIds.includes(p.id)) : pkgs);
      setAttractions(assignedAttractionIds?.length ? attrs.filter((a) => assignedAttractionIds.includes(a.id)) : attrs);
      setEvents(assignedEventIds?.length ? evts.filter((e) => assignedEventIds.includes(e.id)) : evts);
    })();
  }, [assignedPackageIds, assignedAttractionIds, assignedEventIds]);

  useEffect(() => {
    setSelectedBooking(null);
    setBookingQuery('');
    setBookingResults([]);
    setPurchaseId('');
    setSelectedActivityId('');
    setError(null);
  }, [sourceType]);

  const handleBookingSearch = (q: string) => {
    setBookingQuery(q);
    setSelectedBooking(null);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!q.trim()) { setBookingResults([]); return; }
    searchTimer.current = setTimeout(async () => {
      setBookingSearching(true);
      try {
        const res = await bookingService.searchBookings(q);
        setBookingResults(res.success ? res.data.slice(0, 6) : []);
      } catch {
        setBookingResults([]);
      } finally {
        setBookingSearching(false);
      }
    }, 350);
  };

  const canLaunch = () => {
    if (mode === 'generic') return true;
    if (sourceType === 'booking') return selectedBooking !== null;
    if (sourceType === 'attraction_purchase' || sourceType === 'event_purchase')
      return purchaseId.trim() !== '' && !isNaN(Number(purchaseId));
    return selectedActivityId !== '';
  };

  const launch = async () => {
    setError(null);
    if (mode === 'generic') {
      window.open(`/waiver/kiosk/${templateId}${isPreview ? '?preview=1' : ''}`, '_blank', 'noopener');
      onClose();
      return;
    }
    setLaunching(true);
    try {
      let sourceId: number;
      if (sourceType === 'booking') sourceId = selectedBooking!.id;
      else if (sourceType === 'attraction_purchase' || sourceType === 'event_purchase')
        sourceId = Number(purchaseId);
      else sourceId = Number(selectedActivityId);

      const res = await waiverService.createKioskSession(sourceType, sourceId);
      if (!res.success || !res.data?.kiosk_url) throw new Error(res.data?.status ?? 'Failed to create session');
      window.open(res.data.kiosk_url, '_blank', 'noopener');
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to launch kiosk session');
    } finally {
      setLaunching(false);
    }
  };

  const fieldCls = `w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-${themeColor}-500 focus:border-transparent`;

  const activityOptions = sourceType === 'package' ? packages : sourceType === 'attraction' ? attractions : events;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col">
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Tablet className={`w-5 h-5 text-${fullColor}`} />
            <h2 className="text-base font-semibold text-gray-900">Launch Kiosk</h2>
            {isPreview && (
              <span className="text-xs font-medium bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Preview mode</span>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4 overflow-y-auto max-h-[70vh]">
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setMode('generic')}
              className={`p-4 rounded-xl border-2 text-left transition-all ${mode === 'generic' ? `border-${themeColor}-500 bg-${themeColor}-50` : 'border-gray-200 hover:border-gray-300'}`}
            >
              <div className="font-medium text-sm text-gray-900">Generic walk-in</div>
              <div className="text-xs text-gray-500 mt-0.5">Customer fills all their own info</div>
            </button>
            <button
              onClick={() => setMode('bound')}
              className={`p-4 rounded-xl border-2 text-left transition-all ${mode === 'bound' ? `border-${themeColor}-500 bg-${themeColor}-50` : 'border-gray-200 hover:border-gray-300'}`}
            >
              <div className="font-medium text-sm text-gray-900">Prefilled session</div>
              <div className="text-xs text-gray-500 mt-0.5">Link to a booking, purchase, or activity</div>
            </button>
          </div>

          {mode === 'bound' && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                {SOURCE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setSourceType(opt.value)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg border text-left transition-all ${sourceType === opt.value ? `border-${themeColor}-400 bg-${themeColor}-50` : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'}`}
                  >
                    <div>
                      <span className="text-sm font-medium text-gray-900">{opt.label}</span>
                      <span className="text-xs text-gray-400 ml-2">{opt.hint}</span>
                    </div>
                    {sourceType === opt.value && <ChevronRight className={`w-4 h-4 text-${fullColor} flex-shrink-0`} />}
                  </button>
                ))}
              </div>

              <div className="pt-1">
                {sourceType === 'booking' && (
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-gray-600">Search booking by reference # or guest name</label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        value={bookingQuery}
                        onChange={(e) => handleBookingSearch(e.target.value)}
                        placeholder="e.g. ZZ-00123 or John Smith"
                        className={`${fieldCls} pl-9`}
                      />
                      {bookingSearching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin" />}
                    </div>
                    {selectedBooking && (
                      <div className={`flex items-center justify-between px-3 py-2 rounded-lg bg-${themeColor}-50 border border-${themeColor}-200 text-sm`}>
                        <div>
                          <span className="font-medium text-gray-900">{selectedBooking.guest_name || selectedBooking.guest_email}</span>
                          <span className="text-gray-400 ml-2 text-xs">{selectedBooking.reference_number}</span>
                        </div>
                        <button onClick={() => { setSelectedBooking(null); setBookingQuery(''); }} className="text-gray-400 hover:text-gray-600 ml-2">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                    {!selectedBooking && bookingResults.length > 0 && (
                      <div className="border border-gray-200 rounded-lg overflow-hidden divide-y divide-gray-100">
                        {bookingResults.map((b) => (
                          <button
                            key={b.id}
                            onClick={() => { setSelectedBooking(b); setBookingResults([]); setBookingQuery(b.reference_number); }}
                            className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-50 text-left transition-colors"
                          >
                            <div>
                              <div className="text-sm font-medium text-gray-900">{b.guest_name || b.guest_email || '—'}</div>
                              <div className="text-xs text-gray-400">{b.reference_number} · {b.booking_date}</div>
                            </div>
                            <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {(sourceType === 'attraction_purchase' || sourceType === 'event_purchase') && (
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-gray-600">
                      {sourceType === 'attraction_purchase' ? 'Attraction Purchase' : 'Event Purchase'} ID
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={purchaseId}
                      onChange={(e) => setPurchaseId(e.target.value)}
                      placeholder="Enter purchase ID"
                      className={fieldCls}
                    />
                    <p className="text-xs text-gray-400">Find the ID in the purchases list for this {sourceType === 'attraction_purchase' ? 'attraction' : 'event'}.</p>
                  </div>
                )}

                {(sourceType === 'package' || sourceType === 'attraction' || sourceType === 'event') && (
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-gray-600">Select {sourceType}</label>
                    {activityOptions.length === 0 ? (
                      <p className="text-xs text-gray-400 italic">No {sourceType}s found{assignedPackageIds?.length || assignedAttractionIds?.length || assignedEventIds?.length ? ' assigned to this template' : ''}.</p>
                    ) : (
                      <select
                        value={selectedActivityId}
                        onChange={(e) => setSelectedActivityId(e.target.value === '' ? '' : Number(e.target.value))}
                        className={fieldCls}
                      >
                        <option value="">— select —</option>
                        {activityOptions.map((a) => (
                          <option key={a.id} value={a.id}>{a.name}</option>
                        ))}
                      </select>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {error && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            Cancel
          </button>
          <button
            onClick={launch}
            disabled={!canLaunch() || launching}
            className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-${themeColor}-600 hover:bg-${themeColor}-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {launching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Tablet className="w-4 h-4" />}
            Open Kiosk
          </button>
        </div>
      </div>
    </div>
  );
}
