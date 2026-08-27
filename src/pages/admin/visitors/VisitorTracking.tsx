import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  CalendarDays,
  Download,
  Eye,
  Footprints,
  Inbox,
  Mail,
  MousePointerClick,
  Phone,
  RefreshCw,
  Search,
  ShoppingCart,
  UserCheck,
  X,
} from 'lucide-react';
import { useLocationScope } from '../../../contexts/LocationContext';
import visitorTrackingService, {
  type VisitorSession,
  type VisitorSessionDetail,
  type VisitorSessionStats,
} from '../../../services/VisitorTrackingService';
import Pagination from '../../../components/ui/Pagination';
import Toast from '../../../components/ui/Toast';
import { toCsv, downloadCsv } from '../../../components/admin/table';

const formatDuration = (ms: number): string => {
  const totalSeconds = Math.round(ms / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes < 60) return seconds ? `${minutes}m ${seconds}s` : `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
};

const pageLabel = (title: string | null, path: string | null): string => {
  if (title && title.trim()) return title.trim();
  if (path) return path;
  return '—';
};

const VisitorTracking = () => {
  const { effectiveLocationId } = useLocationScope();

  const [sessions, setSessions] = useState<VisitorSession[]>([]);
  const [stats, setStats] = useState<VisitorSessionStats | null>(null);
  const [pagination, setPagination] = useState({ current_page: 1, last_page: 1, per_page: 20, total: 0 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [identifiedOnly, setIdentifiedOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [detail, setDetail] = useState<VisitorSessionDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const requestSeq = useRef(0);
  const detailSeq = useRef(0);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, dateFrom, dateTo, identifiedOnly, effectiveLocationId]);

  const filters = useMemo(
    () => ({
      location_id: effectiveLocationId ?? undefined,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
      identified_only: identifiedOnly || undefined,
      search: debouncedSearch || undefined,
    }),
    [effectiveLocationId, dateFrom, dateTo, identifiedOnly, debouncedSearch],
  );

  useEffect(() => {
    const seq = ++requestSeq.current;
    setLoading(true);
    visitorTrackingService
      .list({ ...filters, page, per_page: 20 })
      .then(data => {
        if (seq !== requestSeq.current) return;
        setSessions(data.sessions);
        setPagination(data.pagination);
      })
      .catch(() => {
        if (seq !== requestSeq.current) return;
        setToast({ message: 'Could not load visitor sessions — you may not have permission.', type: 'error' });
      })
      .finally(() => {
        if (seq === requestSeq.current) setLoading(false);
      });
  }, [filters, page, refreshTick]);

  useEffect(() => {
    let cancelled = false;
    visitorTrackingService
      .statistics(effectiveLocationId ?? undefined)
      .then(data => {
        if (!cancelled) setStats(data);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [effectiveLocationId, refreshTick]);

  const openDetail = useCallback((session: VisitorSession) => {
    const seq = ++detailSeq.current;
    setDetailLoading(true);
    setDetail(null);
    visitorTrackingService
      .detail(session.visitor_id, session.session_date)
      .then(data => {
        if (seq === detailSeq.current) setDetail(data);
      })
      .catch(() => {
        if (seq === detailSeq.current) setToast({ message: 'Could not load this session.', type: 'error' });
      })
      .finally(() => {
        if (seq === detailSeq.current) setDetailLoading(false);
      });
  }, []);

  const closeDetail = useCallback(() => {
    detailSeq.current += 1;
    setDetail(null);
    setDetailLoading(false);
  }, []);

  const exportCsv = async () => {
    setExporting(true);
    try {
      const result = await visitorTrackingService.export(filters);
      if (!result.sessions.length) {
        setToast({ message: 'Nothing to export for these filters.', type: 'error' });
        return;
      }

      const headers = [
        'Customer', 'Phone', 'Email', 'Date', 'First seen (ET)', 'Last seen (ET)',
        'Pages viewed', 'Clicks', 'Purchases', 'Time on site', 'Entry page', 'Exit page',
        'Device', 'Browser', 'Session actions (ET)',
      ];
      const rows = result.sessions.map(s => [
        s.guest_name || 'Anonymous',
        s.guest_phone,
        s.guest_email,
        s.session_date,
        s.first_seen_label,
        s.last_seen_label,
        s.page_views,
        s.clicks,
        s.conversions,
        formatDuration(s.duration_ms),
        s.entry_page,
        s.exit_page,
        s.device_type,
        s.browser,
        s.actions,
      ]);

      downloadCsv(`visitor-sessions-${new Date().toISOString().split('T')[0]}.csv`, toCsv(headers, rows));
      setToast({
        message: result.truncated
          ? `Exported the ${result.max_sessions} most recent sessions — narrow the date range to get the rest.`
          : `Exported ${result.sessions.length} session${result.sessions.length === 1 ? '' : 's'}.`,
        type: 'success',
      });
    } catch {
      setToast({ message: 'Export failed — please try again.', type: 'error' });
    } finally {
      setExporting(false);
    }
  };

  const summary = useMemo(
    () => [
      { label: 'Sessions today', value: stats?.sessions_today ?? 0, icon: Activity, tone: 'text-blue-700 bg-blue-50 border-blue-100' },
      { label: 'Sessions this week', value: stats?.sessions_week ?? 0, icon: CalendarDays, tone: 'text-indigo-700 bg-indigo-50 border-indigo-100' },
      { label: 'Identified today', value: stats?.identified_today ?? 0, icon: UserCheck, tone: 'text-emerald-700 bg-emerald-50 border-emerald-100' },
      { label: 'Known visitors', value: stats?.identified_total ?? 0, icon: Footprints, tone: 'text-amber-700 bg-amber-50 border-amber-100' },
    ],
    [stats],
  );

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Visitor Tracking</h1>
          <p className="text-sm text-gray-500 mt-1">
            Every customer visit as its own session — pages, clicks and time on site. All times are Michigan (ET);
            a session covers one visitor's activity for one day.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setRefreshTick(t => t + 1)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            <RefreshCw size={15} />
            Refresh
          </button>
          <button
            type="button"
            onClick={exportCsv}
            disabled={exporting}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-800 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-900 disabled:opacity-60"
          >
            <Download size={15} />
            {exporting ? 'Exporting…' : 'Export CSV'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {summary.map(card => (
          <div key={card.label} className={`rounded-xl border px-4 py-3 ${card.tone}`}>
            <div className="flex items-center gap-2">
              <card.icon size={16} />
              <span className="text-xs font-semibold uppercase tracking-wide opacity-80">{card.label}</span>
            </div>
            <p className="text-2xl font-bold mt-1">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="p-4 border-b border-gray-100 flex flex-col lg:flex-row lg:items-center gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Search by name, phone or email…"
              className="w-full border border-gray-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={dateFrom}
              onChange={event => setDateFrom(event.target.value)}
              className="border border-gray-200 rounded-lg px-2.5 py-2 text-sm text-gray-700"
              aria-label="From date"
            />
            <span className="text-xs text-gray-400">to</span>
            <input
              type="date"
              value={dateTo}
              onChange={event => setDateTo(event.target.value)}
              className="border border-gray-200 rounded-lg px-2.5 py-2 text-sm text-gray-700"
              aria-label="To date"
            />
            <label className="inline-flex items-center gap-2 text-sm text-gray-700 whitespace-nowrap pl-1">
              <input
                type="checkbox"
                checked={identifiedOnly}
                onChange={event => setIdentifiedOnly(event.target.checked)}
                className="rounded border-gray-300 text-blue-700 focus:ring-blue-600"
              />
              Known customers only
            </label>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['Customer', 'Phone', 'Session', 'Date', ''].map(header => (
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
                  <td colSpan={5} className="px-4 py-14 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-800 mx-auto" />
                  </td>
                </tr>
              ) : sessions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-14 text-center text-gray-500">
                    <Inbox size={32} className="mx-auto mb-2 text-gray-300" />
                    No visits recorded for these filters yet.
                  </td>
                </tr>
              ) : (
                sessions.map(session => (
                  <tr key={`${session.visitor_id}-${session.session_date}`} className="hover:bg-gray-50 transition-colors align-top">
                    <td className="px-4 py-3.5">
                      <div className="font-semibold text-gray-900">{session.guest_name || 'Anonymous'}</div>
                      {session.guest_email && (
                        <a href={`mailto:${session.guest_email}`} className="text-xs text-blue-700 hover:underline inline-flex items-center gap-1 mt-0.5">
                          <Mail size={11} />
                          {session.guest_email}
                        </a>
                      )}
                      <div className="text-[11px] text-gray-400 mt-0.5 capitalize">
                        {[session.device_type, session.browser].filter(Boolean).join(' · ')}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      {session.guest_phone ? (
                        <a href={`tel:${session.guest_phone}`} className="text-sm font-medium text-blue-700 hover:underline inline-flex items-center gap-1">
                          <Phone size={12} />
                          {session.guest_phone}
                        </a>
                      ) : (
                        <span className="text-sm text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="text-sm text-gray-800">
                        {pageLabel(session.entry_title, session.entry_page)}
                        {session.exit_page && session.exit_page !== session.entry_page && (
                          <span className="text-gray-400"> → {pageLabel(session.exit_title, session.exit_page)}</span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {session.page_views} page{session.page_views === 1 ? '' : 's'} · {session.clicks} click{session.clicks === 1 ? '' : 's'}
                        {session.conversions > 0 && ` · ${session.conversions} purchase${session.conversions === 1 ? '' : 's'}`}
                        {' · '}
                        {formatDuration(session.duration_ms)}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <div className="text-sm text-gray-800">{session.date_label}</div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {session.first_seen_label} – {session.last_seen_label} ET
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => openDetail(session)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                      >
                        <Eye size={13} />
                        View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {pagination.last_page > 1 && (
          <div className="p-4 border-t border-gray-100">
            <Pagination
              currentPage={pagination.current_page}
              totalPages={pagination.last_page}
              onPageChange={setPage}
              totalItems={pagination.total}
              itemsPerPage={pagination.per_page}
              itemLabel="sessions"
            />
          </div>
        )}
      </div>

      {(detail || detailLoading) && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-sm p-0 sm:p-4"
          onClick={closeDetail}
        >
          <div
            className="bg-white w-full sm:max-w-2xl rounded-t-3xl sm:rounded-2xl shadow-2xl max-h-[92vh] flex flex-col"
            onClick={event => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3 border-b border-gray-100">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-400">Session timeline</p>
                {detail ? (
                  <>
                    <h2 className="text-lg font-bold text-gray-900 leading-tight mt-0.5">
                      {detail.guest?.name || 'Anonymous visitor'}
                    </h2>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-gray-500">
                      <span>{detail.date_label}</span>
                      <span>
                        {detail.summary.first_seen_label} – {detail.summary.last_seen_label} ET
                      </span>
                      {detail.guest?.phone && (
                        <a href={`tel:${detail.guest.phone}`} className="text-blue-700 hover:underline inline-flex items-center gap-1">
                          <Phone size={11} />
                          {detail.guest.phone}
                        </a>
                      )}
                      {detail.guest?.email && (
                        <a href={`mailto:${detail.guest.email}`} className="text-blue-700 hover:underline inline-flex items-center gap-1">
                          <Mail size={11} />
                          {detail.guest.email}
                        </a>
                      )}
                    </div>
                  </>
                ) : (
                  <h2 className="text-lg font-bold text-gray-900 leading-tight mt-0.5">Loading…</h2>
                )}
              </div>
              <button
                type="button"
                onClick={closeDetail}
                aria-label="Close"
                className="p-1.5 -mr-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <X size={18} />
              </button>
            </div>

            {detail && (
              <div className="px-5 py-3 border-b border-gray-100 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-blue-50 text-blue-700 border border-blue-100 px-2.5 py-1 font-semibold">
                  {detail.summary.page_views} pages
                </span>
                <span className="rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100 px-2.5 py-1 font-semibold">
                  {detail.summary.clicks} clicks
                </span>
                {detail.summary.conversions > 0 && (
                  <span className="rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 px-2.5 py-1 font-semibold">
                    {detail.summary.conversions} purchases
                  </span>
                )}
                <span className="rounded-full bg-gray-50 text-gray-700 border border-gray-200 px-2.5 py-1 font-semibold">
                  {formatDuration(detail.summary.duration_ms)} on site
                </span>
                <span className="rounded-full bg-gray-50 text-gray-600 border border-gray-200 px-2.5 py-1 capitalize">
                  {[detail.device.device_type, detail.device.browser, detail.device.os].filter(Boolean).join(' · ') || 'Unknown device'}
                </span>
              </div>
            )}

            <div className="flex-1 overflow-y-auto px-5 py-4">
              {detailLoading ? (
                <div className="py-14 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-800 mx-auto" />
                </div>
              ) : detail ? (
                <ol className="space-y-2.5">
                  {detail.timeline.map(event => (
                    <li key={event.id} className="flex items-start gap-3">
                      <span
                        className={`mt-0.5 rounded-lg p-1.5 border ${
                          event.event_type === 'conversion'
                            ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                            : event.event_type === 'engagement'
                            ? 'bg-indigo-50 text-indigo-600 border-indigo-100'
                            : 'bg-blue-50 text-blue-600 border-blue-100'
                        }`}
                      >
                        {event.event_type === 'conversion' ? (
                          <ShoppingCart size={13} />
                        ) : event.event_type === 'engagement' ? (
                          <MousePointerClick size={13} />
                        ) : (
                          <Eye size={13} />
                        )}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-800 break-words">
                          {event.event_type === 'conversion' ? (
                            <>Completed <span className="font-semibold">{event.event_name.replace(/_/g, ' ')}</span>
                              {event.conversion_value ? ` — $${Number(event.conversion_value).toFixed(2)}` : ''}</>
                          ) : event.event_type === 'engagement' ? (
                            <>Clicked <span className="font-semibold">"{event.label || event.event_name}"</span></>
                          ) : (
                            <>Viewed <span className="font-semibold">{pageLabel(event.page_title, event.page_path)}</span></>
                          )}
                        </p>
                        <p className="text-[11px] text-gray-400 mt-0.5">
                          {event.page_path}
                          {event.event_type === 'page_view' && event.duration_ms
                            ? ` · ${formatDuration(event.duration_ms)} on page`
                            : ''}
                          {event.event_type === 'page_view' && event.scroll_depth
                            ? ` · scrolled ${event.scroll_depth}%`
                            : ''}
                        </p>
                      </div>
                      <span className="text-xs text-gray-500 whitespace-nowrap mt-0.5">{event.time_label}</span>
                    </li>
                  ))}
                </ol>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};

export default VisitorTracking;
