import { useCallback, useEffect, useRef, useState } from 'react';
import { X, Tablet, Search, Loader2, ChevronRight } from 'lucide-react';
import { useThemeColor } from '../../hooks/useThemeColor';
import waiverService from '../../services/waiverService';
import bookingService from '../../services/bookingService';
import locationService from '../../services/LocationService';
import type { Location as LocationOption } from '../../services/LocationService';
import { useLocationScope } from '../../contexts/LocationContext';
import { getStoredUser } from '../../utils/storage';
import attractionPurchaseService from '../../services/AttractionPurchaseService';
import eventPurchaseService from '../../services/EventPurchaseService';
import { packageCacheService } from '../../services/PackageCacheService';
import { attractionCacheService } from '../../services/AttractionCacheService';
import { eventCacheService } from '../../services/EventCacheService';
import type { Package } from '../../services/PackageService';
import type { Attraction } from '../../services/AttractionService';
import type { Event, EventPurchase } from '../../types/event.types';
import type { WaiverTemplate } from '../../types/waiver.types';
import type { Booking } from '../../services/bookingService';
import type { AttractionPurchase } from '../../services/AttractionPurchaseService';

type SourceType = 'booking' | 'attraction_purchase' | 'event_purchase' | 'package' | 'attraction' | 'event';

type SearchResult =
  | { kind: 'booking'; data: Booking }
  | { kind: 'attraction_purchase'; data: AttractionPurchase }
  | { kind: 'event_purchase'; data: EventPurchase };

interface Props {
  templateId?: number;
  isPreview?: boolean;
  assignedPackageIds?: number[] | null;
  assignedAttractionIds?: number[] | null;
  assignedEventIds?: number[] | null;
  /** When the caller has no template in hand, pass the choices and let the modal ask. */
  templates?: WaiverTemplate[];
  /** Launched by staff from the desk — the kiosk then offers a way back to check-in. */
  staffReturn?: boolean;
  onClose: () => void;
}

const PURCHASE_SOURCE_OPTIONS: Array<{ value: SourceType; label: string; hint: string; badge: string }> = [
  { value: 'booking', label: 'Booking', hint: 'Prefills customer name, package & date', badge: 'bg-blue-100 text-blue-700' },
  { value: 'attraction_purchase', label: 'Attraction Purchase', hint: 'Prefills customer & attraction from a purchase', badge: 'bg-violet-100 text-violet-700' },
  { value: 'event_purchase', label: 'Event Purchase', hint: 'Prefills customer & event from a purchase', badge: 'bg-amber-100 text-amber-700' },
];

const ACTIVITY_SOURCE_OPTIONS: Array<{ value: SourceType; label: string; hint: string }> = [
  { value: 'package', label: 'Package', hint: 'Pre-selects activity only — customer fills their own info' },
  { value: 'attraction', label: 'Attraction', hint: 'Pre-selects attraction only' },
  { value: 'event', label: 'Event', hint: 'Pre-selects event only' },
];

const isPurchaseType = (t: SourceType) =>
  t === 'booking' || t === 'attraction_purchase' || t === 'event_purchase';

export default function KioskSessionModal({
  templateId,
  isPreview,
  assignedPackageIds,
  assignedAttractionIds,
  assignedEventIds,
  templates,
  staffReturn,
  onClose,
}: Props) {
  const { themeColor, fullColor } = useThemeColor();
  const { locations: scopedLocations, effectiveLocationId } = useLocationScope();

  const [storedUser] = useState(() => getStoredUser());
  const isCompanyAdmin = storedUser?.role === 'company_admin';
  const userLocationId: number | null = storedUser?.location_id ?? null;
  const userLocationName: string = storedUser?.location_name ?? '';

  // The templates list is only passed when the caller had no template in hand (the records page).
  // Default to the active catch-all so the common desk case is one tap, but keep the choice visible —
  // a kiosk launched against the wrong template collects a legally wrong signature.
  const [pickedTemplateId, setPickedTemplateId] = useState<number | ''>(() => {
    if (templateId != null) return templateId;
    const active = (templates ?? []).filter((t) => t.status === 'active');
    return active.find((t) => t.is_default)?.id ?? active[0]?.id ?? '';
  });
  const picked = templateId == null ? (templates ?? []).find((t) => t.id === pickedTemplateId) ?? null : null;

  const effectiveTemplateId = templateId ?? (pickedTemplateId === '' ? null : Number(pickedTemplateId));
  const effectiveIsPreview = templateId != null ? !!isPreview : picked != null && picked.status !== 'active';
  const effectivePackageIds = templateId != null ? assignedPackageIds : picked?.assigned_package_ids;
  const effectiveAttractionIds = templateId != null ? assignedAttractionIds : picked?.assigned_attraction_ids;
  const effectiveEventIds = templateId != null ? assignedEventIds : picked?.assigned_event_ids;

  const [mode, setMode] = useState<'generic' | 'bound'>('generic');
  const [sourceType, setSourceType] = useState<SourceType>('booking');

  const [locations, setLocations] = useState<LocationOption[]>(scopedLocations);
  const [selectedLocationId, setSelectedLocationId] = useState<number | ''>(
    isCompanyAdmin ? (effectiveLocationId ?? '') : '',
  );

  const [packages, setPackages] = useState<Package[]>([]);
  const [attractions, setAttractions] = useState<Attraction[]>([]);
  const [events, setEvents] = useState<Event[]>([]);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      setPackages(effectivePackageIds != null ? pkgs.filter((p) => effectivePackageIds.includes(p.id)) : pkgs);
      setAttractions(effectiveAttractionIds != null ? attrs.filter((a) => effectiveAttractionIds.includes(a.id)) : attrs);
      setEvents(effectiveEventIds != null ? evts.filter((e) => effectiveEventIds.includes(e.id)) : evts);
    })();
  }, [effectivePackageIds, effectiveAttractionIds, effectiveEventIds]);

  useEffect(() => {
    if (scopedLocations.length > 0) {
      setLocations(scopedLocations);
      return;
    }
    if (!isCompanyAdmin) return;
    (async () => {
      try {
        const res = await locationService.getLocations({ per_page: 100 });
        setLocations(res?.data ?? []);
      } catch {
        setLocations([]);
      }
    })();
  }, [isCompanyAdmin, scopedLocations]);

  useEffect(() => {
    setSelectedResult(null);
    setSearchQuery('');
    setSearchResults([]);
    setSelectedActivityId('');
    setError(null);
  }, [sourceType]);

  const runSearch = useCallback(async (q: string, type: SourceType) => {
    if (!q.trim()) { setSearchResults([]); return; }
    setSearching(true);
    try {
      if (type === 'booking') {
        const res = await bookingService.getBookings({ search: q, per_page: 8 });
        setSearchResults(
          res.success ? (res.data.bookings ?? []).map((d) => ({ kind: 'booking' as const, data: d })) : [],
        );
      } else if (type === 'attraction_purchase') {
        const res = await attractionPurchaseService.getPurchases({ search: q, per_page: 8 });
        setSearchResults(
          res.success ? (res.data.purchases ?? []).map((d) => ({ kind: 'attraction_purchase' as const, data: d })) : [],
        );
      } else if (type === 'event_purchase') {
        const res = await eventPurchaseService.getPurchases({ search: q, per_page: 8 });
        setSearchResults(
          res.success ? (res.data ?? []).map((d) => ({ kind: 'event_purchase' as const, data: d })) : [],
        );
      }
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  const handleQueryChange = (q: string) => {
    setSearchQuery(q);
    setSelectedResult(null);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => runSearch(q, sourceType), 300);
  };

  const getResultDisplay = (r: SearchResult) => {
    if (r.kind === 'booking') {
      const name = r.data.guest_name || r.data.guest_email || '—';
      const sub = [r.data.reference_number, r.data.booking_date, r.data.package?.name].filter(Boolean).join(' · ');
      return { name, sub, badge: 'Booking', badgeColor: 'bg-blue-100 text-blue-700' };
    }
    if (r.kind === 'attraction_purchase') {
      const name =
        r.data.guest_name ||
        r.data.guest_email ||
        (r.data.customer ? `${r.data.customer.first_name} ${r.data.customer.last_name}` : '—');
      const sub = [`#${r.data.id}`, r.data.purchase_date, r.data.attraction?.name].filter(Boolean).join(' · ');
      return { name, sub, badge: 'Attraction', badgeColor: 'bg-violet-100 text-violet-700' };
    }
    const name =
      r.data.guest_name ||
      r.data.guest_email ||
      (r.data.customer ? `${r.data.customer.first_name} ${r.data.customer.last_name}` : '—');
    const sub = [r.data.reference_number, r.data.purchase_date, r.data.event?.name].filter(Boolean).join(' · ');
    return { name, sub, badge: 'Event', badgeColor: 'bg-amber-100 text-amber-700' };
  };

  const searchPlaceholder =
    sourceType === 'booking'
      ? 'Ref #, guest name, or email…'
      : sourceType === 'attraction_purchase'
        ? 'Guest name, email, or attraction name…'
        : 'Guest name, email, or event name…';

  const resolvedLocationId: number | null = isCompanyAdmin
    ? (selectedLocationId === '' ? null : selectedLocationId)
    : userLocationId;

  const canLaunch = () => {
    if (!effectiveTemplateId) return false;
    if (mode === 'generic') {
      if (isCompanyAdmin && selectedLocationId === '') return false;
      return true;
    }
    if (isPurchaseType(sourceType)) return selectedResult !== null;
    return selectedActivityId !== '';
  };

  const launch = async () => {
    setError(null);
    if (!effectiveTemplateId) {
      setError('Choose a waiver template first.');
      return;
    }
    if (mode === 'generic') {
      const params = new URLSearchParams();
      if (effectiveIsPreview) params.set('preview', '1');
      if (resolvedLocationId != null) params.set('location_id', String(resolvedLocationId));
      if (staffReturn) params.set('staff', '1');
      const qs = params.toString();
      // named window so a shift does not end with eight kiosk tabs open
      window.open(`/waiver/kiosk/${effectiveTemplateId}${qs ? `?${qs}` : ''}`, 'zapzone-waiver-kiosk', 'noopener');
      onClose();
      return;
    }
    setLaunching(true);
    try {
      const sourceId = isPurchaseType(sourceType)
        ? selectedResult!.data.id
        : Number(selectedActivityId);

      const res = await waiverService.createKioskSession(sourceType, sourceId, { template_id: effectiveTemplateId });
      if (!res.success || !res.data?.kiosk_url) throw new Error(res.data?.status ?? 'Failed to create session');
      const boundUrl = staffReturn
        ? `${res.data.kiosk_url}${res.data.kiosk_url.includes('?') ? '&' : '?'}staff=1`
        : res.data.kiosk_url;
      window.open(boundUrl, 'zapzone-waiver-kiosk', 'noopener');
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to launch kiosk session');
    } finally {
      setLaunching(false);
    }
  };

  const fieldCls = `w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-${themeColor}-500 focus:border-transparent`;
  const activityOptions = sourceType === 'package' ? packages : sourceType === 'attraction' ? attractions : events;

  const visibleActivityOptions = ACTIVITY_SOURCE_OPTIONS.filter((opt) => {
    if (opt.value === 'package') return effectivePackageIds == null || effectivePackageIds.length > 0;
    if (opt.value === 'attraction') return effectiveAttractionIds == null || effectiveAttractionIds.length > 0;
    if (opt.value === 'event') return effectiveEventIds == null || effectiveEventIds.length > 0;
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col">
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Tablet className={`w-5 h-5 text-${fullColor}`} />
            <h2 className="text-base font-semibold text-gray-900">Launch Kiosk</h2>
            {effectiveIsPreview && (
              <span className="text-xs font-medium bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Preview mode</span>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4 overflow-y-auto max-h-[72vh]">
          {effectiveIsPreview && (
            <div className="flex gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-3">
              <svg className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-xs text-amber-800 leading-relaxed">
                This template is <span className="font-semibold">not active</span> — the kiosk will open in preview mode and submissions will be blocked. Activate the template from the templates list to accept real waivers.
              </p>
            </div>
          )}
          {templateId == null && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">Waiver template</label>
              <select
                value={pickedTemplateId}
                onChange={(e) => setPickedTemplateId(e.target.value === '' ? '' : Number(e.target.value))}
                className={fieldCls}
              >
                <option value="">Select a template…</option>
                {(templates ?? []).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                    {t.status !== 'active' ? ' (inactive — preview only)' : ''}
                    {t.is_default ? ' · default' : ''}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-gray-500 mt-1">
                The guest signs whichever template you launch — check it matches the activity.
              </p>
            </div>
          )}

          {/* Mode toggle */}
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

          {mode === 'generic' && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Location</p>
              {isCompanyAdmin ? (
                <>
                  <select
                    value={selectedLocationId}
                    onChange={(e) => setSelectedLocationId(e.target.value === '' ? '' : Number(e.target.value))}
                    className={fieldCls}
                  >
                    <option value="">— select a location —</option>
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>{loc?.name}</option>
                    ))}
                  </select>
                  {selectedLocationId === '' && (
                    <p className="text-xs text-amber-600 mt-1.5">Select a location — waivers from this kiosk will be associated with it.</p>
                  )}
                </>
              ) : (
                <div className="px-3 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-700">
                  {userLocationName ? userLocationName : userLocationId != null ? `Location #${userLocationId}` : 'No location assigned'}
                </div>
              )}
            </div>
          )}

          {mode === 'bound' && (
            <div className="space-y-4">
              {/* Purchase type picker */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Link to a purchase</p>
                <div className="space-y-1.5">
                  {PURCHASE_SOURCE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setSourceType(opt.value)}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg border text-left transition-all ${sourceType === opt.value ? `border-${themeColor}-400 bg-${themeColor}-50` : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'}`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${opt.badge}`}>{opt.label}</span>
                        <span className="text-xs text-gray-400 truncate">{opt.hint}</span>
                      </div>
                      {sourceType === opt.value && <ChevronRight className={`w-4 h-4 text-${fullColor} flex-shrink-0 ml-2`} />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Search input for purchase types */}
              {isPurchaseType(sourceType) && (
                <div className="space-y-2">
                  {selectedResult ? (
                    <div className={`flex items-center justify-between px-3 py-2.5 rounded-lg bg-${themeColor}-50 border border-${themeColor}-200`}>
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${getResultDisplay(selectedResult).badgeColor}`}>
                          {getResultDisplay(selectedResult).badge}
                        </span>
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-gray-900 truncate">{getResultDisplay(selectedResult).name}</div>
                          <div className="text-xs text-gray-400 truncate">{getResultDisplay(selectedResult).sub}</div>
                        </div>
                      </div>
                      <button
                        onClick={() => { setSelectedResult(null); setSearchQuery(''); setSearchResults([]); }}
                        className="text-gray-400 hover:text-gray-600 ml-3 flex-shrink-0"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => handleQueryChange(e.target.value)}
                          placeholder={searchPlaceholder}
                          className={`${fieldCls} pl-9`}
                          autoComplete="off"
                        />
                        {searching && (
                          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin" />
                        )}
                      </div>

                      {searchResults.length > 0 && (
                        <div className="border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100 shadow-sm">
                          {searchResults.map((r, i) => {
                            const d = getResultDisplay(r);
                            return (
                              <button
                                key={i}
                                onClick={() => { setSelectedResult(r); setSearchResults([]); setSearchQuery(''); }}
                                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 text-left transition-colors"
                              >
                                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${d.badgeColor}`}>{d.badge}</span>
                                <div className="min-w-0 flex-1">
                                  <div className="text-sm font-medium text-gray-900 truncate">{d.name}</div>
                                  <div className="text-xs text-gray-400 truncate">{d.sub}</div>
                                </div>
                                <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {!searching && searchQuery.trim().length > 0 && searchResults.length === 0 && (
                        <p className="text-xs text-gray-400 text-center py-2">No results found — try a different name, email, or ref #.</p>
                      )}

                      {searchQuery.trim().length === 0 && (
                        <p className="text-xs text-gray-400">Start typing to search — name, email, or reference number.</p>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Activity-only source types */}
              {visibleActivityOptions.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Or link to an activity (no customer prefill)</p>
                  <div className="space-y-1.5">
                    {visibleActivityOptions.map((opt) => (
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

                  {!isPurchaseType(sourceType) && (
                    <div className="mt-3">
                      {activityOptions.length === 0 ? (
                        <p className="text-xs text-gray-400 italic">
                          No {sourceType}s found{assignedPackageIds?.length || assignedAttractionIds?.length || assignedEventIds?.length ? ' assigned to this template' : ''}.
                        </p>
                      ) : (
                        <select
                          value={selectedActivityId}
                          onChange={(e) => setSelectedActivityId(e.target.value === '' ? '' : Number(e.target.value))}
                          className={fieldCls}
                        >
                          <option value="">— select a {sourceType} —</option>
                          {activityOptions.map((a) => (
                            <option key={a.id} value={a.id}>{a.name}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  )}
                </div>
              )}
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
