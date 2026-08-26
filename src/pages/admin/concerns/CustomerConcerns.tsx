import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CalendarX2,
  CheckCircle2,
  Inbox,
  Mail,
  PhoneCall,
  Search,
  ShoppingCart,
} from 'lucide-react';
import { useLocationScope } from '../../../contexts/LocationContext';
import checkoutConcernService, {
  type CheckoutConcern,
  type CheckoutConcernStats,
  type ConcernKind,
  type ConcernStatus,
} from '../../../services/CheckoutConcernService';
import Pagination from '../../../components/ui/Pagination';
import Toast from '../../../components/ui/Toast';

const KIND_TABS: { value: 'all' | ConcernKind; label: string }[] = [
  { value: 'all', label: 'Everything' },
  { value: 'schedule_help', label: 'Schedule help' },
  { value: 'abandoned_checkout', label: 'Left unfinished' },
];

const STATUS_TABS: { value: 'all' | ConcernStatus; label: string }[] = [
  { value: 'new', label: 'Needs a call' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'all', label: 'All' },
];

const STATUS_STYLES: Record<ConcernStatus, string> = {
  new: 'bg-amber-50 text-amber-700 border-amber-200',
  contacted: 'bg-blue-50 text-blue-700 border-blue-200',
  resolved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
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

const CustomerConcerns = () => {
  const { effectiveLocationId } = useLocationScope();

  const [concerns, setConcerns] = useState<CheckoutConcern[]>([]);
  const [stats, setStats] = useState<CheckoutConcernStats | null>(null);
  const [pagination, setPagination] = useState({ current_page: 1, last_page: 1, per_page: 20, total: 0 });
  const [page, setPage] = useState(1);
  const [kind, setKind] = useState<'all' | ConcernKind>('all');
  const [status, setStatus] = useState<'all' | ConcernStatus>('new');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const requestSeq = useRef(0);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => setPage(1), [kind, status, debouncedSearch, effectiveLocationId]);

  const load = useCallback(async () => {
    const seq = ++requestSeq.current;
    try {
      setLoading(true);
      const result = await checkoutConcernService.list({
        page,
        per_page: 20,
        location_id: effectiveLocationId ?? undefined,
        kind: kind === 'all' ? undefined : kind,
        status: status === 'all' ? undefined : status,
        search: debouncedSearch || undefined,
      });
      if (seq !== requestSeq.current) return;
      setConcerns(result.concerns);
      setPagination(result.pagination);
    } catch {
      if (seq !== requestSeq.current) return;
      setToast({ message: 'Could not load customer concerns — you may not have permission.', type: 'error' });
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }, [page, effectiveLocationId, kind, status, debouncedSearch, refreshTick]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    checkoutConcernService
      .statistics(effectiveLocationId ?? undefined)
      .then(result => {
        if (!cancelled) setStats(result);
      })
      .catch(() => {
        if (!cancelled) setStats(null);
      });
    return () => {
      cancelled = true;
    };
  }, [effectiveLocationId, refreshTick]);

  const setConcernStatus = async (concern: CheckoutConcern, next: ConcernStatus) => {
    try {
      setSavingId(concern.id);
      const updated = await checkoutConcernService.updateStatus(concern.id, next);
      setConcerns(prev =>
        status === 'all' || status === next
          ? prev.map(row => (row.id === updated.id ? updated : row))
          : prev.filter(row => row.id !== updated.id),
      );
      setToast({
        message: next === 'resolved' ? 'Marked resolved.' : next === 'contacted' ? 'Marked as contacted.' : 'Reopened.',
        type: 'success',
      });
      setRefreshTick(tick => tick + 1);
    } catch {
      setToast({ message: 'That did not save. Please try again.', type: 'error' });
    } finally {
      setSavingId(null);
    }
  };

  const summary = useMemo(
    () => [
      { label: 'Waiting on a call', value: stats?.open ?? 0, icon: PhoneCall, tone: 'text-amber-600' },
      { label: 'Schedule help', value: stats?.schedule_help ?? 0, icon: CalendarX2, tone: 'text-blue-700' },
      { label: 'Left unfinished', value: stats?.abandoned_checkout ?? 0, icon: ShoppingCart, tone: 'text-purple-700' },
      { label: 'Today', value: stats?.today ?? 0, icon: Inbox, tone: 'text-emerald-600' },
    ],
    [stats],
  );

  return (
    <div className="min-h-screen px-4 sm:px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Customer Concerns</h1>
        <p className="text-gray-600 mt-1">
          Guests who asked for help with the schedule, and guests who left checkout with their details
          filled in. Both are expecting nothing — a call is a pleasant surprise.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {summary.map(card => (
          <div key={card.label} className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3.5">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
              <card.icon size={14} className={card.tone} />
              {card.label}
            </div>
            <p className="text-2xl font-bold text-gray-900 mt-1 tabular-nums">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-4 border-b border-gray-100 flex flex-col lg:flex-row lg:items-center gap-3">
          <div className="flex flex-wrap gap-1.5">
            {STATUS_TABS.map(tab => (
              <button
                key={tab.value}
                type="button"
                onClick={() => setStatus(tab.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  status === tab.value ? 'bg-blue-800 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-1.5 lg:ml-2">
            {KIND_TABS.map(tab => (
              <button
                key={tab.value}
                type="button"
                onClick={() => setKind(tab.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                  kind === tab.value
                    ? 'border-blue-800 text-blue-800 bg-blue-50'
                    : 'border-gray-200 text-gray-500 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative lg:ml-auto lg:w-72">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Name, phone, email or item"
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['Guest', 'Reach them on', 'What they wanted', 'Why', 'Status', 'When', ''].map(header => (
                  <th
                    key={header}
                    className="px-4 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap"
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-800 mx-auto" />
                  </td>
                </tr>
              ) : concerns.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <Inbox className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">Nothing here — no guest is waiting on a call.</p>
                  </td>
                </tr>
              ) : (
                concerns.map(concern => (
                  <tr key={concern.id} className="hover:bg-gray-50 transition-colors align-top">
                    <td className="px-4 py-3">
                      <p className="text-sm font-semibold text-gray-900">{concern.name}</p>
                      {concern.location?.name && (
                        <p className="text-xs text-gray-400 mt-0.5">{concern.location.name}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <a
                        href={`tel:${concern.phone}`}
                        className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-800 hover:underline"
                      >
                        <PhoneCall size={13} />
                        {concern.phone}
                      </a>
                      {concern.email && (
                        <a
                          href={`mailto:${concern.email}`}
                          className="mt-1 flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700"
                        >
                          <Mail size={12} />
                          {concern.email}
                        </a>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-gray-700">{formatWhen(concern)}</p>
                      {concern.context?.step_label && (
                        <p className="text-xs text-gray-400 mt-0.5">Reached: {concern.context.step_label}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 max-w-xs">
                      <span
                        className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                          concern.kind === 'schedule_help'
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-purple-50 text-purple-700 border-purple-200'
                        }`}
                      >
                        {concern.kind === 'schedule_help' ? <CalendarX2 size={11} /> : <ShoppingCart size={11} />}
                        {concern.kind === 'schedule_help' ? 'Schedule help' : 'Left unfinished'}
                      </span>
                      {concern.message && (
                        <p className="text-xs text-gray-600 mt-1.5 leading-relaxed">“{concern.message}”</p>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full border capitalize ${STATUS_STYLES[concern.status]}`}
                      >
                        {concern.status === 'new' ? 'Needs a call' : concern.status}
                      </span>
                      {concern.handler && (
                        <p className="text-[11px] text-gray-400 mt-1">
                          by {concern.handler.first_name} {concern.handler.last_name}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                      {new Date(concern.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex flex-col gap-1.5">
                        {concern.status !== 'contacted' && (
                          <button
                            type="button"
                            disabled={savingId === concern.id}
                            onClick={() => setConcernStatus(concern, 'contacted')}
                            className="text-xs font-semibold text-blue-800 hover:underline disabled:opacity-50 text-left"
                          >
                            Mark contacted
                          </button>
                        )}
                        {concern.status !== 'resolved' && (
                          <button
                            type="button"
                            disabled={savingId === concern.id}
                            onClick={() => setConcernStatus(concern, 'resolved')}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:underline disabled:opacity-50"
                          >
                            <CheckCircle2 size={12} />
                            Resolve
                          </button>
                        )}
                        {concern.status !== 'new' && (
                          <button
                            type="button"
                            disabled={savingId === concern.id}
                            onClick={() => setConcernStatus(concern, 'new')}
                            className="text-xs font-semibold text-gray-500 hover:underline disabled:opacity-50 text-left"
                          >
                            Reopen
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {pagination.last_page > 1 && (
          <div className="px-6 py-4 border-t border-gray-100">
            <Pagination
              currentPage={pagination.current_page}
              totalPages={pagination.last_page}
              onPageChange={setPage}
              totalItems={pagination.total}
              itemsPerPage={pagination.per_page}
              itemLabel="concerns"
            />
          </div>
        )}
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};

export default CustomerConcerns;
