import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  CalendarX2,
  CheckCircle2,
  Inbox,
  Mail,
  Phone,
  PhoneCall,
  RefreshCw,
  ShoppingCart,
  Undo2,
} from 'lucide-react';
import { useThemeColor } from '../../../hooks/useThemeColor';
import checkoutConcernService, {
  type CheckoutConcern,
  type CheckoutConcernStats,
  type ConcernKind,
  type ConcernStatus,
} from '../../../services/CheckoutConcernService';

interface LocationConcernsPanelProps {
  locationId: number | null;
  locationName?: string | null;
  limit?: number;
}

const KIND_BADGES: Record<ConcernKind, { label: string; className: string }> = {
  schedule_help: { label: 'Schedule help', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  call_to_book: { label: 'Call to book', className: 'bg-teal-50 text-teal-700 border-teal-200' },
  abandoned_checkout: { label: 'Left unfinished', className: 'bg-purple-50 text-purple-700 border-purple-200' },
};

const STATUS_STYLES: Record<ConcernStatus, string> = {
  new: 'bg-amber-50 text-amber-700 border-amber-200',
  contacted: 'bg-blue-50 text-blue-700 border-blue-200',
  resolved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

const STATUS_LABELS: Record<ConcernStatus, string> = {
  new: 'Needs a call',
  contacted: 'Contacted',
  resolved: 'Resolved',
};

const formatWhen = (concern: CheckoutConcern): string => {
  const parts = [
    concern.entity_name,
    concern.preferred_date
      ? new Date(`${concern.preferred_date.split('T')[0]}T00:00:00`).toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
        })
      : null,
    concern.preferred_time,
  ].filter(Boolean);

  return parts.length ? parts.join(' · ') : 'Nothing chosen yet';
};

const formatAge = (iso: string): string => {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const minutes = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'yesterday' : `${days}d ago`;
};

const LocationConcernsPanel = ({ locationId, locationName, limit = 5 }: LocationConcernsPanelProps) => {
  const { themeColor, fullColor } = useThemeColor();
  const [concerns, setConcerns] = useState<CheckoutConcern[]>([]);
  const [stats, setStats] = useState<CheckoutConcernStats | null>(null);
  const [openTotal, setOpenTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<number | null>(null);
  const loadSeq = useRef(0);

  const load = useCallback(async () => {
    if (!locationId) {
      setConcerns([]);
      setStats(null);
      setLoading(false);
      return;
    }
    const seq = ++loadSeq.current;
    setLoading(true);
    setError(null);
    try {
      const [page, statistics] = await Promise.all([
        checkoutConcernService.list({ location_id: locationId, open_only: true, per_page: limit }),
        checkoutConcernService.statistics(locationId),
      ]);
      if (seq !== loadSeq.current) return;
      setConcerns(page.concerns);
      setOpenTotal(page.pagination.total);
      setStats(statistics);
    } catch {
      if (seq === loadSeq.current) setError('Could not load customer concerns for this location.');
    } finally {
      if (seq === loadSeq.current) setLoading(false);
    }
  }, [locationId, limit]);

  useEffect(() => {
    load();
  }, [load]);

  const setStatus = async (concern: CheckoutConcern, next: ConcernStatus) => {
    try {
      setSavingId(concern.id);
      await checkoutConcernService.updateStatus(concern.id, next);
      await load();
    } catch {
      setError('That did not save. Please try again.');
    } finally {
      setSavingId(null);
    }
  };

  const counters = [
    { label: 'Needs a call', value: stats?.open ?? 0, icon: PhoneCall, className: 'bg-amber-50 text-amber-700 border-amber-200' },
    { label: 'Schedule help', value: stats?.schedule_help ?? 0, icon: CalendarX2, className: 'bg-blue-50 text-blue-700 border-blue-200' },
    { label: 'Call to book', value: stats?.call_to_book ?? 0, icon: Phone, className: 'bg-teal-50 text-teal-700 border-teal-200' },
    { label: 'Left unfinished', value: stats?.abandoned_checkout ?? 0, icon: ShoppingCart, className: 'bg-purple-50 text-purple-700 border-purple-200' },
    { label: 'Today', value: stats?.today ?? 0, icon: Inbox, className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  ];

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 md:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div>
          <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <PhoneCall className={`w-4 h-4 text-${fullColor}`} /> Customer Concerns
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Guests at {locationName || 'this location'} waiting on a call back
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => load()}
            disabled={loading || !locationId}
            className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 disabled:opacity-40"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
          <Link
            to="/customer-concerns"
            className={`inline-flex items-center gap-1 text-xs font-medium text-${themeColor}-700 hover:underline`}
          >
            View all <ArrowRight size={12} />
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 mb-4">
        {counters.map(counter => {
          const Icon = counter.icon;
          return (
            <div key={counter.label} className={`rounded-lg border px-2.5 py-2 ${counter.className}`}>
              <div className="flex items-center gap-1.5">
                <Icon size={12} />
                <span className="text-[10px] font-semibold uppercase tracking-wide truncate">{counter.label}</span>
              </div>
              <p className="text-lg font-bold mt-0.5 leading-none">{counter.value}</p>
            </div>
          );
        })}
      </div>

      {error && <p className="text-xs text-rose-600 mb-3">{error}</p>}

      {loading && concerns.length === 0 ? (
        <div className="space-y-2">
          {[0, 1, 2].map(row => (
            <div key={row} className="h-14 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : concerns.length === 0 ? (
        <div className="text-center py-6">
          <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
          <p className="text-sm font-medium text-gray-700">Nobody is waiting on a call</p>
          <p className="text-xs text-gray-400 mt-0.5">New concerns from this location land here.</p>
        </div>
      ) : (
        <>
        <div className="divide-y divide-gray-100 border border-gray-100 rounded-lg">
          {concerns.map(concern => {
            const badge = KIND_BADGES[concern.kind] ?? KIND_BADGES.schedule_help;
            const saving = savingId === concern.id;
            return (
              <div key={concern.id} className="p-3 flex flex-col lg:flex-row lg:items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-gray-900">{concern.name}</span>
                    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${badge.className}`}>
                      {concern.kind === 'schedule_help' ? <CalendarX2 size={10} /> : concern.kind === 'call_to_book' ? <Phone size={10} /> : <ShoppingCart size={10} />}
                      {badge.label}
                    </span>
                    <span className={`inline-flex text-[10px] font-semibold px-2 py-0.5 rounded-full border ${STATUS_STYLES[concern.status] ?? STATUS_STYLES.new}`}>
                      {STATUS_LABELS[concern.status] ?? concern.status}
                    </span>
                    <span className="text-[11px] text-gray-400">{formatAge(concern.created_at)}</span>
                  </div>
                  <p className="text-xs text-gray-600 mt-1">{formatWhen(concern)}</p>
                  {concern.message && (
                    <p className="text-xs text-gray-500 mt-1 italic line-clamp-2">“{concern.message}”</p>
                  )}
                  <div className="flex flex-wrap items-center gap-3 mt-1.5">
                    {concern.phone && (
                      <a
                        href={`tel:${concern.phone}`}
                        className={`inline-flex items-center gap-1 text-xs font-medium text-${themeColor}-700 hover:underline`}
                      >
                        <Phone size={11} /> {concern.phone}
                      </a>
                    )}
                    {concern.email && (
                      <a
                        href={`mailto:${concern.email}`}
                        className="inline-flex items-center gap-1 text-xs text-gray-500 hover:underline"
                      >
                        <Mail size={11} /> {concern.email}
                      </a>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {concern.status === 'new' ? (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => setStatus(concern, 'contacted')}
                      className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100 disabled:opacity-50"
                    >
                      <PhoneCall size={12} /> Mark contacted
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => setStatus(concern, 'new')}
                      className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                    >
                      <Undo2 size={12} /> Reopen
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => setStatus(concern, 'resolved')}
                    className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg border border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 disabled:opacity-50"
                  >
                    <CheckCircle2 size={12} /> Resolve
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        {openTotal > concerns.length && (
          <div className="mt-2 text-center">
            <Link to="/customer-concerns" className={`text-xs text-${themeColor}-700 hover:underline`}>
              Showing {concerns.length} of {openTotal} waiting on a call — see the rest
            </Link>
          </div>
        )}
        </>
      )}
    </div>
  );
};

export default LocationConcernsPanel;
