import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  CalendarDays,
  Download,
  Eye,
  Footprints,
  Mail,
  MousePointerClick,
  Phone,
  ShoppingCart,
  UserCheck,
  X,
} from 'lucide-react';
import { useLocationScope } from '../../../contexts/LocationContext';
import { useThemeColor } from '../../../hooks/useThemeColor';
import visitorTrackingService, {
  type VisitorSession,
  type VisitorSessionDetail,
  type VisitorSessionStats,
} from '../../../services/VisitorTrackingService';
import {
  AdminDataTable,
  AdminTableToolbar,
  TimeFrameSelect,
  useAdminTable,
  toCsv,
  downloadCsv,
} from '../../../components/admin/table';
import type { AdminColumn, AdminFilterDef, DateRangeValue } from '../../../components/admin/table';
import StandardButton from '../../../components/ui/StandardButton';
import CounterAnimation from '../../../components/ui/CounterAnimation';
import Toast from '../../../components/ui/Toast';

const MAX_LOADED_SESSIONS = 3000;

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

const isKnown = (session: VisitorSession): boolean => Boolean(session.guest_phone || session.guest_name);

const VisitorTracking = () => {
  const { effectiveLocationId } = useLocationScope();
  const { themeColor, fullColor } = useThemeColor();

  const [sessions, setSessions] = useState<VisitorSession[]>([]);
  const [stats, setStats] = useState<VisitorSessionStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [capped, setCapped] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [detail, setDetail] = useState<VisitorSessionDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const loadSeq = useRef(0);
  const detailSeq = useRef(0);
  const defaultApplied = useRef(false);

  const loadSessions = useCallback(async () => {
    const seq = ++loadSeq.current;
    const filters = { location_id: effectiveLocationId ?? undefined };
    const cached = visitorTrackingService.peekAll(filters, MAX_LOADED_SESSIONS);
    if (cached) {
      setSessions(cached.sessions.slice(0, MAX_LOADED_SESSIONS));
      setCapped(Boolean(cached.pagination.capped));
      setLoading(false);
    } else {
      setLoading(true);
    }
    try {
      const data = await visitorTrackingService.listAll(filters, MAX_LOADED_SESSIONS);
      if (seq !== loadSeq.current) return;
      setSessions(data.sessions.slice(0, MAX_LOADED_SESSIONS));
      setCapped(Boolean(data.pagination.capped));
    } catch {
      if (seq === loadSeq.current) {
        setToast({ message: 'Could not load visitor sessions — you may not have permission.', type: 'error' });
      }
    } finally {
      if (seq === loadSeq.current) setLoading(false);
    }
  }, [effectiveLocationId]);

  const loadStats = useCallback(() => {
    visitorTrackingService
      .statistics(effectiveLocationId ?? undefined)
      .then(setStats)
      .catch(() => undefined);
  }, [effectiveLocationId]);

  useEffect(() => {
    loadSessions();
    loadStats();
  }, [loadSessions, loadStats]);

  const columns: AdminColumn<VisitorSession>[] = useMemo(
    () => [
      {
        key: 'customer',
        label: 'Customer',
        sortable: true,
        sortValue: s => (s.guest_name || 'zzzz-anonymous').toLowerCase(),
        exportValue: s => s.guest_name || 'Anonymous',
        render: s => (
          <div>
            <div className="font-semibold text-gray-900">
              {s.guest_name || <span className="text-gray-400 font-normal">Anonymous</span>}
            </div>
            {s.guest_email && (
              <a
                href={`mailto:${s.guest_email}`}
                className={`text-xs text-${themeColor}-700 hover:underline inline-flex items-center gap-1 mt-0.5`}
              >
                <Mail size={11} />
                {s.guest_email}
              </a>
            )}
            <div className="text-[11px] text-gray-400 mt-0.5 capitalize">
              {[s.device_type, s.browser].filter(Boolean).join(' · ')}
            </div>
          </div>
        ),
      },
      {
        key: 'phone',
        label: 'Phone',
        sortable: true,
        sortValue: s => s.guest_phone || '',
        exportValue: s => s.guest_phone,
        cellClassName: 'whitespace-nowrap',
        render: s =>
          s.guest_phone ? (
            <a
              href={`tel:${s.guest_phone}`}
              className={`text-sm font-medium text-${themeColor}-700 hover:underline inline-flex items-center gap-1`}
            >
              <Phone size={12} />
              {s.guest_phone}
            </a>
          ) : (
            <span className="text-sm text-gray-400">—</span>
          ),
      },
      {
        key: 'session',
        label: 'Session',
        sortable: true,
        sortValue: s => s.page_views,
        exportValue: s =>
          `${s.entry_page || ''}${s.exit_page && s.exit_page !== s.entry_page ? ` -> ${s.exit_page}` : ''}`,
        render: s => (
          <div>
            <div className="text-sm text-gray-800">
              {pageLabel(s.entry_title, s.entry_page)}
              {s.exit_page && s.exit_page !== s.entry_page && (
                <span className="text-gray-400"> → {pageLabel(s.exit_title, s.exit_page)}</span>
              )}
            </div>
            <div className="text-xs text-gray-500 mt-0.5">
              {s.page_views} page{s.page_views === 1 ? '' : 's'} · {s.clicks} click{s.clicks === 1 ? '' : 's'}
              {s.conversions > 0 && ` · ${s.conversions} purchase${s.conversions === 1 ? '' : 's'}`}
              {' · '}
              {formatDuration(s.duration_ms)}
            </div>
          </div>
        ),
      },
      {
        key: 'pages',
        label: 'Pages',
        group: 'Details',
        sortable: true,
        sortValue: s => s.page_views,
        exportValue: s => s.page_views,
        defaultVisible: false,
        render: s => <span className="text-sm text-gray-800">{s.page_views}</span>,
      },
      {
        key: 'clicks',
        label: 'Clicks',
        group: 'Details',
        sortable: true,
        sortValue: s => s.clicks,
        exportValue: s => s.clicks,
        defaultVisible: false,
        render: s => <span className="text-sm text-gray-800">{s.clicks}</span>,
      },
      {
        key: 'purchases',
        label: 'Purchases',
        group: 'Details',
        sortable: true,
        sortValue: s => s.conversions,
        exportValue: s => s.conversions,
        defaultVisible: false,
        render: s => <span className="text-sm text-gray-800">{s.conversions}</span>,
      },
      {
        key: 'duration',
        label: 'Time on site',
        group: 'Details',
        sortable: true,
        sortValue: s => s.duration_ms,
        exportValue: s => formatDuration(s.duration_ms),
        defaultVisible: false,
        render: s => <span className="text-sm text-gray-800">{formatDuration(s.duration_ms)}</span>,
      },
      {
        key: 'date',
        label: 'Date',
        sortable: true,
        sortValue: s => s.last_seen || s.session_date,
        exportValue: s => `${s.session_date} ${s.first_seen_label}–${s.last_seen_label} ET`,
        cellClassName: 'whitespace-nowrap',
        render: s => (
          <div>
            <div className="text-sm text-gray-800">{s.date_label}</div>
            <div className="text-xs text-gray-500 mt-0.5">
              {s.first_seen_label} – {s.last_seen_label} ET
            </div>
          </div>
        ),
      },
    ],
    [themeColor],
  );

  const filterDefs: AdminFilterDef<VisitorSession>[] = useMemo(
    () => [
      {
        type: 'select',
        key: 'identity',
        label: 'Visitor Type',
        allLabel: 'All visitors',
        options: [
          { value: 'known', label: 'Known customers' },
          { value: 'anonymous', label: 'Anonymous' },
        ],
        predicate: (s, value) => (value === 'known' ? isKnown(s) : !isKnown(s)),
      },
      {
        type: 'select',
        key: 'device',
        label: 'Device',
        allLabel: 'All devices',
        options: [
          { value: 'mobile', label: 'Mobile' },
          { value: 'desktop', label: 'Desktop' },
          { value: 'tablet', label: 'Tablet' },
        ],
        predicate: (s, value) => s.device_type === value,
      },
      {
        type: 'select',
        key: 'activity',
        label: 'Activity',
        allLabel: 'Any activity',
        options: [
          { value: 'purchased', label: 'Made a purchase' },
          { value: 'reached_checkout', label: 'Reached a checkout page' },
          { value: 'clicked', label: 'Clicked something' },
          { value: 'multi_page', label: 'Viewed 2+ pages' },
        ],
        predicate: (s, value) => {
          if (value === 'purchased') return s.conversions > 0;
          if (value === 'reached_checkout') return Boolean(s.reached_checkout);
          if (value === 'clicked') return s.clicks > 0;
          return s.page_views >= 2;
        },
      },
      {
        type: 'daterange',
        key: 'session_date',
        label: 'Session Date',
        getDate: s => s.session_date,
      },
    ],
    [],
  );

  const table = useAdminTable<VisitorSession>({
    data: sessions,
    columns,
    getRowId: s => `${s.visitor_id}|${s.session_date}`,
    storageKey: 'visitor_sessions',
    filterDefs,
    searchFields: s => [
      s.guest_name,
      s.guest_phone,
      s.guest_email,
      s.entry_page,
      s.exit_page,
      s.entry_title,
      s.exit_title,
    ],
    defaultSort: (a, b) => (b.last_seen || b.session_date).localeCompare(a.last_seen || a.session_date),
    itemsPerPage: 10,
  });

  useEffect(() => {
    if (defaultApplied.current) return;
    defaultApplied.current = true;
    table.setFilterValue('identity', 'known');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      const identity = table.filterValues['identity'];
      const device = table.filterValues['device'];
      const activity = table.filterValues['activity'];
      const range = table.filterValues['session_date'] as DateRangeValue | undefined;

      const result = await visitorTrackingService.export({
        location_id: effectiveLocationId ?? undefined,
        identified: identity === 'known' || identity === 'anonymous' ? identity : undefined,
        device_type:
          device === 'mobile' || device === 'desktop' || device === 'tablet' ? device : undefined,
        activity:
          activity === 'purchased' ||
          activity === 'clicked' ||
          activity === 'multi_page' ||
          activity === 'reached_checkout'
            ? activity
            : undefined,
        date_from: range?.start || undefined,
        date_to: range?.end || undefined,
        search: table.searchInput.trim() || undefined,
      });

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

      downloadCsv(`visitor-sessions-export-${new Date().toISOString().split('T')[0]}.csv`, toCsv(headers, rows));
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

  const metrics = [
    { title: 'Sessions Today', value: stats?.sessions_today ?? 0, change: 'One row per visitor per day', icon: Activity, accentColor: 'blue' },
    { title: 'Sessions This Week', value: stats?.sessions_week ?? 0, change: 'Last 7 days', icon: CalendarDays, accentColor: 'indigo' },
    { title: 'Identified Today', value: stats?.identified_today ?? 0, change: 'Gave a name and number', icon: UserCheck, accentColor: 'emerald' },
    { title: 'Known Visitors', value: stats?.identified_total ?? 0, change: 'All-time identified', icon: Footprints, accentColor: 'amber' },
  ];

  return (
    <div className="px-6 py-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Visitor Tracking</h1>
          <p className="text-gray-600 mt-1">
            Every customer visit as its own session — one visitor, one day, Michigan time
          </p>
        </div>
        <div className="flex gap-2 mt-4 sm:mt-0 flex-wrap">
          <StandardButton variant="secondary" size="md" onClick={exportCsv} icon={Download} disabled={exporting}>
            {exporting ? 'Exporting…' : 'Export CSV'}
          </StandardButton>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {metrics.map((metric, index) => {
          const Icon = metric.icon;
          return (
            <div
              key={index}
              className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex flex-col gap-2 hover:shadow-md transition-shadow min-h-[120px]"
            >
              <div className="flex items-center gap-2">
                <div className={`p-2 rounded-lg bg-${metric.accentColor}-100 text-${metric.accentColor}-600`}>
                  <Icon size={20} />
                </div>
                <span className="text-base font-semibold text-gray-800">{metric.title}</span>
              </div>
              <div className="flex items-end gap-2 mt-2">
                <CounterAnimation value={metric.value} className="text-2xl font-bold text-gray-900" />
              </div>
              <p className="text-xs mt-1 text-gray-600">{metric.change}</p>
            </div>
          );
        })}
      </div>

      <TimeFrameSelect table={table} filterKey="session_date" />

      <AdminTableToolbar
        table={table}
        searchPlaceholder="Search by name, phone, email or page..."
        onRefresh={() => {
          loadSessions();
          loadStats();
        }}
      />

      {capped && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
          Showing the {MAX_LOADED_SESSIONS.toLocaleString()} most recent sessions — use Export CSV or the date filter
          for older activity.
        </div>
      )}

      <AdminDataTable
        table={table}
        loading={loading && sessions.length === 0}
        itemLabel="sessions"
        emptyState={
          table.filterValues['identity'] === 'known' && sessions.length > 0 ? (
            <div className="flex flex-col items-center justify-center">
              <div className={`inline-flex p-4 rounded-full bg-${themeColor}-50 mb-4`}>
                <UserCheck className={`h-12 w-12 text-${themeColor}-400`} />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No known customers yet</h3>
              <p className="text-gray-500 text-sm max-w-md">
                Guests appear here once they enter their name and number in the welcome popup.
                There {sessions.length === 1 ? 'is' : 'are'} {sessions.length.toLocaleString()} anonymous
                session{sessions.length === 1 ? '' : 's'} behind this filter.
              </p>
              <StandardButton
                variant="secondary"
                size="sm"
                className="mt-4"
                onClick={() => table.setFilterValue('identity', 'all')}
              >
                Show all visitors
              </StandardButton>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center">
              <div className={`inline-flex p-4 rounded-full bg-${themeColor}-50 mb-4`}>
                <Footprints className={`h-12 w-12 text-${themeColor}-400`} />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No visits recorded</h3>
              <p className="text-gray-500 text-sm">
                {table.searchInput || table.activeFilterCount > 0
                  ? 'Try adjusting your search or filters'
                  : 'Customer visits will appear here as they browse the booking site'}
              </p>
            </div>
          )
        }
        renderActions={session => (
          <button
            className={`p-1 text-${themeColor}-600 hover:text-${fullColor}`}
            title="View session timeline"
            onClick={() => openDetail(session)}
          >
            <Eye className="h-4 w-4" />
          </button>
        )}
      />

      {(detail || detailLoading) && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4"
          onClick={closeDetail}
        >
          <div
            className="bg-white w-full sm:max-w-2xl rounded-t-3xl sm:rounded-xl shadow-2xl max-h-[92vh] flex flex-col"
            onClick={event => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 px-6 pt-5 pb-3 border-b border-gray-100">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Session timeline</p>
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
                        <a
                          href={`tel:${detail.guest.phone}`}
                          className={`text-${themeColor}-700 hover:underline inline-flex items-center gap-1`}
                        >
                          <Phone size={11} />
                          {detail.guest.phone}
                        </a>
                      )}
                      {detail.guest?.email && (
                        <a
                          href={`mailto:${detail.guest.email}`}
                          className={`text-${themeColor}-700 hover:underline inline-flex items-center gap-1`}
                        >
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
              <div className="px-6 py-3 border-b border-gray-100 flex flex-wrap gap-2 text-xs">
                <span className={`rounded-full bg-${themeColor}-50 text-${themeColor}-700 border border-${themeColor}-200 px-2.5 py-1 font-semibold`}>
                  {detail.summary.page_views} pages
                </span>
                <span className="rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 px-2.5 py-1 font-semibold">
                  {detail.summary.clicks} clicks
                </span>
                {detail.summary.conversions > 0 && (
                  <span className="rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 font-semibold">
                    {detail.summary.conversions} purchases
                  </span>
                )}
                <span className="rounded-full bg-gray-50 text-gray-700 border border-gray-200 px-2.5 py-1 font-semibold">
                  {formatDuration(detail.summary.duration_ms)} on site
                </span>
                <span className="rounded-full bg-gray-50 text-gray-600 border border-gray-200 px-2.5 py-1 capitalize">
                  {[detail.device.device_type, detail.device.browser, detail.device.os].filter(Boolean).join(' · ') ||
                    'Unknown device'}
                </span>
              </div>
            )}

            <div className="flex-1 overflow-y-auto px-6 py-4">
              {detailLoading ? (
                <div className="py-14 text-center">
                  <div className={`animate-spin rounded-full h-8 w-8 border-b-2 border-${themeColor}-600 mx-auto`} />
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
                            : `bg-${themeColor}-50 text-${themeColor}-600 border-${themeColor}-100`
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
                            <>
                              Completed <span className="font-semibold">{event.event_name.replace(/_/g, ' ')}</span>
                              {event.conversion_value ? ` — $${Number(event.conversion_value).toFixed(2)}` : ''}
                            </>
                          ) : event.event_type === 'engagement' ? (
                            <>
                              Clicked <span className="font-semibold">"{event.label || event.event_name}"</span>
                            </>
                          ) : (
                            <>
                              Viewed <span className="font-semibold">{pageLabel(event.page_title, event.page_path)}</span>
                            </>
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
