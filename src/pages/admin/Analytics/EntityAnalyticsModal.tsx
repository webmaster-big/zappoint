import React, { useEffect, useState } from 'react';
import {
  X,
  TrendingUp,
  Users,
  Activity,
  DollarSign,
  Smartphone,
  Globe,
  Info,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import CounterAnimation from '../../../components/ui/CounterAnimation';
import { useThemeColor } from '../../../hooks/useThemeColor';
import { locationService } from '../../../services/LocationService';
import PageAnalyticsService, {
  type AnalyticsEntityType,
  type EntityDetailResponse,
  type DateRangeFilter,
  type DevicesResponse,
} from '../../../services/PageAnalyticsService';

interface EntityAnalyticsModalProps {
  open: boolean;
  onClose: () => void;
  entityType: AnalyticsEntityType;
  entityId: number;
  entityName?: string;
  filter: DateRangeFilter;
  locations?: Array<{ id: string | number; name: string }>;
}

const formatCurrency = (n: number | null | undefined) => `$${(n ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const formatPct = (n: number | null | undefined) => `${(n ?? 0).toFixed(1)}%`;
const formatDuration = (ms: number | null | undefined) => {
  const v = ms ?? 0;
  if (!v || v < 1000) return `${v}ms`;
  const s = Math.round(v / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
};

const fmtDate = (iso: string | null | undefined): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (diffDays === 0) return `Today at ${timeStr}`;
  if (diffDays === 1) return `Yesterday at ${timeStr}`;
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ` at ${timeStr}`;
};
const fmtEventName = (name: string | null | undefined): string => {
  if (!name) return '—';
  return name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
};

const EntityAnalyticsModal: React.FC<EntityAnalyticsModalProps> = ({
  open,
  onClose,
  entityType,
  entityId,
  entityName,
  filter,
  locations = [],
}) => {
  const { themeColor } = useThemeColor();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<EntityDetailResponse | null>(null);
  const [convSearch, setConvSearch] = useState('');
  const [convPage, setConvPage] = useState(1);
  const CONV_PAGE_SIZE = 10;
  const [devicesTab, setDevicesTab] = useState<'devices' | 'browsers' | 'oses'>('devices');
  const [internalLocations, setInternalLocations] = useState<Array<{ id: string | number; name: string }>>([]);

  // Fetch location names if not provided via prop
  useEffect(() => {
    if (locations.length > 0) return;
    locationService.getLocations({ is_active: true, per_page: 200 })
      .then((res) => {
        const raw = res as unknown as { data?: Array<{ id: number; name: string }>; [k: string]: unknown };
        const list: Array<{ id: number | string; name: string }> = Array.isArray(raw)
          ? (raw as Array<{ id: number; name: string }>)
          : Array.isArray(raw.data) ? raw.data : [];
        if (list.length > 0) setInternalLocations(list);
      })
      .catch(() => {/* silently ignore */});
  }, [locations.length]);

  const resolveLocation = (id: number | null | undefined, name: string | null | undefined): string => {
    if (name) return name;
    if (id == null) return '—';
    const allLocs = locations.length > 0 ? locations : internalLocations;
    const found = allLocs.find((l) => Number(l.id) === id);
    return found ? found.name : `Location ${id}`;
  };

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const d = await PageAnalyticsService.getEntityDetail(entityType, entityId, filter, 'day');
        if (!cancelled) setData(d);
      } catch (e: unknown) {
        const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
          || 'Failed to load entity analytics.';
        if (!cancelled) setError(msg);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, entityType, entityId, filter.from, filter.to, filter.location_id]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-100 p-4 md:p-6 flex items-center justify-between z-10">
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500 font-medium">{entityType}</p>
            <h2 className="text-lg md:text-2xl font-bold text-gray-900">
              {entityName || `${entityType} #${entityId}`}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {filter.from || 'all-time'} → {filter.to || 'today'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 md:p-6">
          {loading && (
            <div className="py-12 flex justify-center">
              <LoadingSpinner size="medium" message="Loading analytics…" />
            </div>
          )}

          {!loading && error && (
            <div className="py-8 text-center">
              <div className="mx-auto mb-3 w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center">
                <Info className="w-6 h-6 text-amber-600" />
              </div>
              <p className="text-sm text-gray-700">{error}</p>
            </div>
          )}

          {!loading && !error && data && (
            <div className="space-y-6">
              {/* KPI cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KpiCard label="Page views" value={data.totals.page_views} icon={TrendingUp} themeColor={themeColor} />
                <KpiCard label="Unique visitors" value={data.totals.unique_visitors} icon={Users} themeColor={themeColor} />
                <KpiCard label="Conversions" value={data.totals.conversions} icon={Activity} themeColor={themeColor} />
                <KpiCard label="Revenue" value={data.totals.conversion_value} prefix="$" icon={DollarSign} themeColor={themeColor} />
                <KpiCard label="Conversion rate" value={data.totals.conversion_rate} suffix="%" themeColor={themeColor} />
                {data.totals.form_start_rate != null && (
                  <KpiCard label="Form-start rate" value={data.totals.form_start_rate} suffix="%" themeColor={themeColor} />
                )}
                {data.totals.form_finish_rate != null && (
                  <KpiCard label="Form-finish rate" value={data.totals.form_finish_rate} suffix="%" themeColor={themeColor} />
                )}
                <KpiCard label="Bounce rate" value={data.totals.bounce_rate} suffix="%" themeColor={themeColor} />
                <KpiCard label="Avg duration" rawValue={formatDuration(data.totals.avg_duration_ms)} themeColor={themeColor} />
              </div>

              {/* Trend */}
              {data.timeseries?.length > 0 && (
                <Section title="Trend">
                  <ResponsiveContainer width="100%" height={260}>
                    <AreaChart data={data.timeseries}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                      <XAxis dataKey="bucket" stroke="#6b7280" />
                      <YAxis yAxisId="left" stroke="#6b7280" />
                      <YAxis yAxisId="right" orientation="right" stroke="#10b981" />
                      <Tooltip />
                      <Legend />
                      <Area yAxisId="left" type="monotone" dataKey="page_views" stroke={`var(--color-${themeColor}-500)`} fill={`var(--color-${themeColor}-200)`} name="Page views" />
                      <Area yAxisId="left" type="monotone" dataKey="conversions" stroke="#f59e0b" fill="#fde68a" name="Conversions" />
                      <Area yAxisId="right" type="monotone" dataKey="revenue" stroke="#10b981" fill="#a7f3d0" name="Revenue ($)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </Section>
              )}

              {/* By path (variants across locations) */}
              {data.by_path?.length > 0 && (
                <Section title="Variants (by URL / location)">
                  <SimpleTable
                    columns={['Path', 'Location', 'Views', 'Conversions', 'Revenue']}
                    rows={data.by_path.map((r) => [
                      r.page_path,
                      resolveLocation(r.location_id, r.location_name),
                      (r.views ?? 0).toLocaleString(),
                      (r.conversions ?? 0).toLocaleString(),
                      formatCurrency(r.revenue),
                    ])}
                  />
                </Section>
              )}

              {/* Sources */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {(data.sources?.utm?.length || data.sources?.direct?.length) ? (
                  <Section title="Traffic sources">
                    <SimpleTable
                      columns={['Source', 'Medium', 'Campaign', 'Visits', 'Revenue']}
                      rows={[
                        ...(data.sources.utm || []).map((s) => [
                          s.source || '—', s.medium || '—', s.campaign || '—',
                          (s.visits ?? 0).toLocaleString(), formatCurrency(s.revenue),
                        ]),
                        ...(data.sources.direct || []).map((s) => [
                          'direct', '—', '—', (s.visits ?? 0).toLocaleString(), formatCurrency(s.revenue),
                        ]),
                      ]}
                    />
                  </Section>
                ) : null}

                {data.sources?.referrers?.length > 0 && (
                  <Section title="Referrers">
                    <SimpleTable
                      columns={['Referrer', 'Visits', 'Revenue']}
                      rows={data.sources.referrers.map((r) => [
                        r.referrer || '—', (r.visits ?? 0).toLocaleString(), formatCurrency(r.revenue),
                      ])}
                    />
                  </Section>
                )}
              </div>

              {/* Devices + Countries */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {(() => {
                  const dev = data.devices as unknown as DevicesResponse;
                  const tabData: Record<'devices' | 'browsers' | 'oses', typeof dev.devices> = {
                    devices:  dev?.devices  ?? [],
                    browsers: dev?.browsers ?? [],
                    oses:     dev?.oses     ?? [],
                  };
                  const hasAny = tabData.devices.length > 0 || tabData.browsers.length > 0 || tabData.oses.length > 0;
                  if (!hasAny) return null;
                  const activeRows = tabData[devicesTab];
                  return (
                    <Section
                      title="Devices"
                      icon={Smartphone}
                      right={
                        <div className="flex gap-1">
                          {(['devices', 'browsers', 'oses'] as const).map((t) => (
                            <button
                              key={t}
                              onClick={() => setDevicesTab(t)}
                              className={`px-2 py-0.5 text-xs rounded-md font-medium transition-colors ${
                                devicesTab === t
                                  ? 'bg-gray-800 text-white'
                                  : 'text-gray-500 hover:bg-gray-100'
                              }`}
                            >
                              {t === 'devices' ? 'Device' : t === 'browsers' ? 'Browser' : 'OS'}
                            </button>
                          ))}
                        </div>
                      }
                    >
                      <SimpleTable
                        columns={['Name', 'Visits', 'Share']}
                        rows={activeRows.map((d) => [
                          d.name, (d.visits ?? 0).toLocaleString(),
                          d.share != null ? formatPct(d.share) : '—',
                        ])}
                      />
                    </Section>
                  );
                })()}

                {data.countries?.length > 0 && (
                  <Section title="Countries" icon={Globe}>
                    <SimpleTable
                      columns={['Country', 'Visits']}
                      rows={data.countries.map((c) => [
                        c.country || 'Unknown', (c.visits ?? 0).toLocaleString(),
                      ])}
                    />
                  </Section>
                )}
              </div>

              {/* Recent conversions */}
              {data.recent_conversions?.length > 0 && (() => {
                const filtered = data.recent_conversions.filter((c) => {
                  if (!convSearch.trim()) return true;
                  const q = convSearch.toLowerCase();
                  return (
                    fmtEventName(c.event_name).toLowerCase().includes(q) ||
                    (c.utm_source || '').toLowerCase().includes(q) ||
                    (c.utm_campaign || '').toLowerCase().includes(q)
                  );
                });
                const totalPages = Math.max(1, Math.ceil(filtered.length / CONV_PAGE_SIZE));
                const safePage = Math.min(convPage, totalPages);
                const pageRows = filtered.slice((safePage - 1) * CONV_PAGE_SIZE, safePage * CONV_PAGE_SIZE);
                return (
                  <Section title={`Recent Conversions (${filtered.length})`}>
                    <div className="mb-3">
                      <input
                        type="text"
                        value={convSearch}
                        onChange={(e) => { setConvSearch(e.target.value); setConvPage(1); }}
                        placeholder="Search by event, UTM source or campaign…"
                        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-offset-0"
                        style={{ focusRingColor: `var(--color-${themeColor}-400)` } as React.CSSProperties}
                      />
                    </div>
                    <SimpleTable
                      columns={['When', 'Event', 'Value', 'UTM Source', 'UTM Campaign']}
                      rows={pageRows.map((c) => [
                        fmtDate(c.created_at),
                        fmtEventName(c.event_name),
                        formatCurrency(c.value),
                        c.utm_source || '—',
                        c.utm_campaign || '—',
                      ])}
                    />
                    {totalPages > 1 && (
                      <div className="flex items-center justify-between mt-3 text-xs text-gray-500">
                        <span>Page {safePage} of {totalPages}</span>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setConvPage((p) => Math.max(1, p - 1))}
                            disabled={safePage === 1}
                            className="px-2 py-1 rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
                          >Prev</button>
                          <button
                            onClick={() => setConvPage((p) => Math.min(totalPages, p + 1))}
                            disabled={safePage === totalPages}
                            className="px-2 py-1 rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
                          >Next</button>
                        </div>
                      </div>
                    )}
                  </Section>
                );
              })()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const KpiCard: React.FC<{
  label: string;
  value?: number;
  rawValue?: string;
  prefix?: string;
  suffix?: string;
  icon?: React.ComponentType<{ className?: string }>;
  themeColor: string;
}> = ({ label, value, rawValue, prefix, suffix, icon: Icon, themeColor }) => (
  <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-100">
    <div className="flex items-center justify-between">
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-gray-600 truncate">{label}</p>
        <div className="text-xl font-bold text-gray-900 mt-1 flex items-baseline">
          {prefix && <span>{prefix}</span>}
          {rawValue != null
            ? <span>{rawValue}</span>
            : <CounterAnimation value={value ?? 0} className="text-xl font-bold text-gray-900" />}
          {suffix && <span className="ml-0.5">{suffix}</span>}
        </div>
      </div>
      {Icon && (
        <div className={`p-2 bg-${themeColor}-50 rounded-lg`}>
          <Icon className={`w-4 h-4 text-${themeColor}-600`} />
        </div>
      )}
    </div>
  </div>
);

const Section: React.FC<{
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
  right?: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, icon: Icon, right, children }) => (
  <div className="bg-white rounded-xl p-3 sm:p-4 shadow-sm border border-gray-100">
    <div className="flex items-center justify-between gap-2 mb-3">
      <div className="flex items-center gap-2">
        {Icon && <Icon className="w-4 h-4 text-gray-500" />}
        <h3 className="text-base font-semibold text-gray-900">{title}</h3>
      </div>
      {right && <div>{right}</div>}
    </div>
    {children}
  </div>
);

const SimpleTable: React.FC<{ columns: string[]; rows: (string | number)[][] }> = ({ columns, rows }) => (
  <div className="overflow-x-auto -mx-3 sm:mx-0">
    <table className="min-w-full text-sm">
      <thead>
        <tr className="text-left text-xs uppercase tracking-wide text-gray-500 border-b border-gray-100">
          {columns.map((c) => <th key={c} className="px-3 py-2 font-medium">{c}</th>)}
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr><td colSpan={columns.length} className="px-3 py-6 text-center text-gray-400">No data</td></tr>
        ) : rows.map((r, i) => (
          <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/60">
            {r.map((cell, j) => (
              <td key={j} className="px-3 py-2 text-gray-800 whitespace-nowrap">{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export default EntityAnalyticsModal;
