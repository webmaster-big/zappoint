import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  TrendingUp,
  Users,
  DollarSign,
  Eye,
  MousePointer2,
  Clock,
  Info,
  Globe,
  Smartphone,
  Repeat,
  Sparkles,
  Search,
  Tag,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';
import { useLocationScope } from '../../../contexts/LocationContext';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import StandardButton from '../../../components/ui/StandardButton';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import CounterAnimation from '../../../components/ui/CounterAnimation';
import DateRangeCalendar from '../../../components/ui/DateRangeCalendar';
import Pagination from '../../../components/ui/Pagination';
import { useThemeColor } from '../../../hooks/useThemeColor';
import PageAnalyticsService, {
  type AnalyticsEntityType,
  type AttributionRow,
  type ConversionRow,
  type DateRangeFilter,
  type DevicesResponse,
  type FunnelStep,
  type LandingPageRow,
  type LeaderboardRow,
  type LiveResponse,
  type OverviewMetrics,
  type PaginatedResponse,
  type PromoPerformanceRow,
  type SearchesResponse,
  type SourcesResponse,
  type TimeseriesResponse,
  type TopPageRow,
} from '../../../services/PageAnalyticsService';
import EntityAnalyticsModal from './EntityAnalyticsModal';


const PIE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#84cc16', '#ec4899'];

const fmtCurrency = (n: number) =>
  `$${(n ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtPct = (n: number) => `${(n ?? 0).toFixed(1)}%`;
const fmtDuration = (ms: number) => {
  if (!ms || ms < 1000) return `${ms ?? 0}ms`;
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
};

const fmtDate = (iso: string): string => {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    const now = new Date();
    const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    if (d.toDateString() === now.toDateString()) return `Today at ${time}`;
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return `Yesterday at ${time}`;
    const dateStr = d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      ...(d.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}),
    });
    return `${dateStr} at ${time}`;
  } catch { return iso; }
};

const fmtEventName = (name: string): string => {
  if (!name) return '—';
  return name.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
};

const fmtEntityLabel = (type: string): string => {
  const labels: Record<string, string> = {
    package:             'Package',
    attraction:          'Attraction',
    event:               'Event',
    booking:             'Booking',
    attraction_purchase: 'Attraction Ticket',
    event_purchase:      'Event Ticket',
    gift_card:           'Gift Card',
    promo:               'Promo Code',
  };
  return labels[type] ?? type.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
};
const todayStr = () => new Date().toISOString().slice(0, 10);
const daysAgoStr = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};

type RangePreset = '7d' | '30d' | '90d' | '1y' | 'custom';

const presetToRange = (p: RangePreset): { from: string; to: string } => {
  const to = todayStr();
  switch (p) {
    case '7d': return { from: daysAgoStr(6), to };
    case '30d': return { from: daysAgoStr(29), to };
    case '90d': return { from: daysAgoStr(89), to };
    case '1y': return { from: daysAgoStr(364), to };
    default: return { from: '', to: '' };
  }
};


const PageAnalytics: React.FC = () => {
  const { themeColor } = useThemeColor();
  const { effectiveLocationId, locations: scopeLocations } = useLocationScope();

  const [preset, setPreset] = useState<RangePreset>('30d');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const selectedLocationId = effectiveLocationId === null ? '' : String(effectiveLocationId);
  const locationOverride: number | undefined = selectedLocationId ? Number(selectedLocationId) : undefined;

  const [entityTypeForLeaderboard, setEntityTypeForLeaderboard] = useState<AnalyticsEntityType>('package');
  const [leaderboardSort, setLeaderboardSort] = useState<'views' | 'unique_visitors' | 'conversions' | 'revenue' | 'conversion_rate' | 'form_starts'>('revenue');

  const [devicesTab, setDevicesTab] = useState<'devices' | 'browsers' | 'oses'>('devices');

  const [conversionsPage, setConversionsPage] = useState(1);
  const conversionsPerPage = 20;
  const [convSearch, setConvSearch] = useState('');

  const [drillEntity, setDrillEntity] = useState<{ type: AnalyticsEntityType; id: number; name?: string } | null>(null);

  const [overview, setOverview] = useState<OverviewMetrics | null>(null);
  const [timeseries, setTimeseries] = useState<TimeseriesResponse | null>(null);
  const [topPages, setTopPages] = useState<TopPageRow[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [sources, setSources] = useState<SourcesResponse | null>(null);
  const [devices, setDevices] = useState<DevicesResponse | null>(null);
  const [funnel, setFunnel] = useState<FunnelStep[]>([]);
  const [landing, setLanding] = useState<LandingPageRow[]>([]);
  const [conversions, setConversions] = useState<PaginatedResponse<ConversionRow> | null>(null);
  const [searches, setSearches] = useState<SearchesResponse | null>(null);
  const [promos, setPromos] = useState<PromoPerformanceRow[]>([]);
  const [attribution, setAttribution] = useState<AttributionRow[]>([]);
  const [live, setLive] = useState<LiveResponse | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const filter: DateRangeFilter = useMemo(() => {
    if (preset === 'custom') {
      return {
        from: startDate || undefined,
        to: endDate || undefined,
        location_id: locationOverride,
      };
    }
    const r = presetToRange(preset);
    return { from: r.from, to: r.to, location_id: locationOverride };
  }, [preset, startDate, endDate, locationOverride]);

  const fetchAll = useCallback(async () => {
    if (preset === 'custom' && (!startDate || !endDate)) return;
    setIsLoading(true);
    setLoadError(null);
    try {
      const [
        ov, ts, tp, lb, src, dev, fn, lp, conv, srch, prm, attr,
      ] = await Promise.all([
        PageAnalyticsService.getOverview(filter),
        PageAnalyticsService.getTimeseries(filter, 'day').catch((): TimeseriesResponse => ({ bucket: 'day', series: [] })),
        PageAnalyticsService.getTopPages(filter, 10).catch((): TopPageRow[] => []),
        PageAnalyticsService.getEntitiesLeaderboard(filter, entityTypeForLeaderboard, leaderboardSort, 25).catch((): LeaderboardRow[] => []),
        PageAnalyticsService.getSources(filter).catch((): SourcesResponse => ({ utm: [], direct: [], referrers: [] })),
        PageAnalyticsService.getDevices(filter).catch((): DevicesResponse => ({ devices: [], browsers: [], oses: [], sources: [] })),
        PageAnalyticsService.getFunnel(filter).catch((): FunnelStep[] => []),
        PageAnalyticsService.getLandingPages(filter, 10).catch((): LandingPageRow[] => []),
        PageAnalyticsService.getConversions(filter, conversionsPage, conversionsPerPage).catch((): PaginatedResponse<ConversionRow> => ({ data: [], current_page: 1, per_page: conversionsPerPage, total: 0, last_page: 1 })),
        PageAnalyticsService.getSearches(filter).catch(() => ({ top_queries: [], zero_result_queries: [] })),
        PageAnalyticsService.getPromoPerformance(filter).catch(() => []),
        PageAnalyticsService.getAttribution(filter).catch(() => []),
      ]);
      setOverview(ov);
      setTimeseries(ts);
      setTopPages(tp);
      setLeaderboard(lb);
      setSources(src);
      setDevices(dev);
      setFunnel(fn);
      setLanding(lp);
      setConversions(conv);
      setSearches(srch);
      setPromos(prm);
      setAttribution(attr);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      const status = (e as { response?: { status?: number } })?.response?.status;
      if (status === 403) {
        setLoadError(msg || 'You do not have access to page analytics for this scope.');
      } else {
        setLoadError(msg || 'Failed to load page analytics. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [filter, entityTypeForLeaderboard, leaderboardSort, conversionsPage, preset, startDate, endDate]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const l = await PageAnalyticsService.getLive(5, locationOverride);
        if (!cancelled) setLive(l);
      } catch {
      }
    };
    tick();
    const id = window.setInterval(tick, 15_000);
    return () => { cancelled = true; window.clearInterval(id); };
  }, [locationOverride]);

  if (isLoading && !overview) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner size="medium" message="Loading page analytics…" />
      </div>
    );
  }

  if (loadError && !overview) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white border border-gray-200 rounded-xl p-6 text-center shadow-sm">
          <div className="mx-auto mb-3 w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center">
            <Info className="w-6 h-6 text-amber-600" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Page Analytics unavailable</h2>
          <p className="text-sm text-gray-600 mb-4">{loadError}</p>
          <StandardButton onClick={fetchAll} variant="primary" size="sm" icon={RefreshCw}>Retry</StandardButton>
        </div>
      </div>
    );
  }

  const ov = overview ?? {
    page_views: 0, unique_visitors: 0, sessions: 0, conversions: 0,
    conversion_rate: 0, conversion_value: 0, bounce_rate: 0, avg_duration_ms: 0,
  } as OverviewMetrics;

  const deviceTabData: Record<'devices' | 'browsers' | 'oses', Array<{ name: string; value: number }>> = {
    devices:  (Array.isArray(devices?.devices)  ? devices!.devices  : []).map((d) => ({ name: d.name,    value: d.visits })),
    browsers: (Array.isArray(devices?.browsers) ? devices!.browsers : []).map((d) => ({ name: d.name, value: d.visits })),
    oses:     (Array.isArray(devices?.oses)     ? devices!.oses     : []).map((d) => ({ name: d.name,    value: d.visits })),
  };
  const activeDeviceData = deviceTabData[devicesTab];

  return (
    <div className="min-h-screen bg-gray-50 p-2 sm:p-4 md:p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 flex items-center gap-2 mb-1">
            <Activity className={`w-6 h-6 text-${themeColor}-600`} /> Page Analytics
          </h1>
          <p className="text-sm md:text-base text-gray-600">
            Visitors, engagement and conversions across your booking pages.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 mt-4 md:mt-0">
          <select
            value={preset}
            onChange={(e) => setPreset(e.target.value as RangePreset)}
            className={`px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-${themeColor}-500`}
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="1y">Last year</option>
            <option value="custom">Custom range</option>
          </select>
          {preset === 'custom' && (
            <div className="w-56">
              <DateRangeCalendar
                startDate={startDate}
                endDate={endDate}
                onChange={(s, e) => { setStartDate(s); setEndDate(e); }}
                themeColor={themeColor}
              />
            </div>
          )}
          <StandardButton onClick={fetchAll} variant="secondary" size="sm" icon={RefreshCw}>
            Refresh
          </StandardButton>
        </div>
      </div>

      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
          </span>
          <span className="text-sm font-medium text-gray-900">Right now</span>
          <span className="text-2xl font-bold text-gray-900">
            <CounterAnimation value={live?.active_visitors ?? 0} className="text-2xl font-bold" />
          </span>
          <span className="text-sm text-gray-600">
            visitor{(live?.active_visitors ?? 0) === 1 ? '' : 's'}
            {live?.active_sessions != null && ` · ${live.active_sessions} session${live.active_sessions === 1 ? '' : 's'}`}
          </span>
        </div>
        {live?.by_page && live.by_page.length > 0 && (
          <div className="text-xs text-gray-600 flex flex-wrap gap-3 max-w-xl justify-end">
            {live.by_page.slice(0, 4).map((p, i) => (
              <span key={i} className="bg-gray-100 px-2 py-1 rounded">
                <span className="font-semibold">{p.visitors}</span> · {p.page_title || p.page_path}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2 sm:gap-3">
        <KpiCard label="Page views" value={ov.page_views} icon={Eye} themeColor={themeColor}
          tooltip="Total number of page loads across all tracked booking pages in the selected period." />
        <KpiCard label="Unique visitors" value={ov.unique_visitors} icon={Users} themeColor={themeColor}
          tooltip="Count of distinct visitors identified by browser session or tracking cookie." />
        <KpiCard label="Sessions" value={ov.sessions} icon={Repeat} themeColor={themeColor}
          tooltip="Total visit sessions started. A single visitor can start multiple sessions across different times or devices." />
        <KpiCard label="Conversions" value={ov.conversions} icon={MousePointer2} themeColor={themeColor}
          tooltip="Number of completed booking events (e.g. form submissions or purchases) recorded in the period." />
        <KpiCard label="Conv. rate" value={ov.conversion_rate} suffix="%" themeColor={themeColor} icon={TrendingUp}
          tooltip="Conversions ÷ unique visitors × 100. Shows what share of visitors completed a booking." />
        <KpiCard label="Revenue" value={ov.conversion_value} prefix="$" icon={DollarSign} themeColor={themeColor}
          tooltip="Total dollar value attributed to conversion events tracked on your booking pages." />
        <KpiCard label="Bounce rate" value={ov.bounce_rate} suffix="%" themeColor={themeColor}
          tooltip="Percentage of visitors who viewed only one page and left without any further interaction." />
        <KpiCard label="Avg duration" rawValue={fmtDuration(ov.avg_duration_ms)} themeColor={themeColor} icon={Clock}
          tooltip="Average time visitors spent on your pages per session, measured from first to last tracked event." />
        {ov.new_visitors != null && (
          <KpiCard label="New visitors" value={ov.new_visitors} themeColor={themeColor}
            tooltip="Visitors seen for the first time in this period — no prior tracking record found." />
        )}
        {ov.returning_visitors != null && (
          <KpiCard label="Returning" value={ov.returning_visitors} themeColor={themeColor}
            tooltip="Visitors who had a tracked session on your pages before the selected date range." />
        )}
      </div>

      {timeseries && timeseries.series?.length > 0 && (
        <Section title="Traffic & conversions" subtitle={`Bucket: ${timeseries.bucket}`}>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={timeseries.series}>
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Section title="Top pages">
          <SimpleTable
            columns={['Path', 'Views', 'Visitors', 'Conv.', 'Rate', 'Revenue']}
            rows={topPages.map((r) => [
              <span title={r.page_title || ''} className="text-gray-800">{r.page_path}</span>,
              (r.views ?? 0).toLocaleString(),
              (r.unique_visitors ?? 0).toLocaleString(),
              (r.conversions ?? 0).toLocaleString(),
              fmtPct(r.conversion_rate),
              fmtCurrency(r.revenue),
            ])}
          />
        </Section>

        <Section
          title="Top entities"
          right={
            <div className="flex items-center gap-2">
              <select
                value={entityTypeForLeaderboard}
                onChange={(e) => setEntityTypeForLeaderboard(e.target.value as AnalyticsEntityType)}
                className="px-2 py-1 text-xs border border-gray-300 rounded-md"
              >
                <option value="package">Packages</option>
                <option value="attraction">Attractions</option>
                <option value="event">Events</option>
              </select>
              <select
                value={leaderboardSort}
                onChange={(e) => setLeaderboardSort(e.target.value as typeof leaderboardSort)}
                className="px-2 py-1 text-xs border border-gray-300 rounded-md"
              >
                <option value="revenue">Revenue</option>
                <option value="conversions">Conversions</option>
                <option value="conversion_rate">Conv. rate</option>
                <option value="views">Views</option>
                <option value="unique_visitors">Visitors</option>
                <option value="form_starts">Form starts</option>
              </select>
            </div>
          }
        >
          <SimpleTable
            columns={['Name', 'Views', 'Form starts', 'Conv.', 'Rate', 'Revenue', '']}
            rows={leaderboard.map((r) => [
              r.name || `#${r.entity_id}`,
              (r.views ?? 0).toLocaleString(),
              (r.form_starts ?? 0).toLocaleString(),
              (r.conversions ?? 0).toLocaleString(),
              fmtPct(r.conversion_rate),
              fmtCurrency(r.revenue),
              <button
                onClick={() => setDrillEntity({
                  type: r.entity_type || entityTypeForLeaderboard,
                  id: r.entity_id,
                  name: r.name || undefined,
                })}
                disabled={!r.entity_id}
                className={`text-${themeColor}-600 hover:text-${themeColor}-800 disabled:text-gray-300 disabled:cursor-not-allowed inline-flex items-center text-xs font-medium`}
              >
                Detail <ChevronRight className="w-3 h-3" />
              </button>,
            ])}
          />
        </Section>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Section title="Funnel" subtitle="View → engage → convert">
          {funnel.length === 0 ? (
            <p className="text-sm text-gray-400 py-6 text-center">No funnel data yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={funnel} layout="vertical" margin={{ left: 32 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis type="number" stroke="#6b7280" />
                <YAxis type="category" dataKey="step" stroke="#6b7280" width={120} />
                <Tooltip
                  formatter={(value: number, _name: string, p: { payload?: FunnelStep }) =>
                    [`${value.toLocaleString()}${p.payload?.rate != null ? ` (${fmtPct(p.payload.rate)})` : ''}`, 'Count']
                  }
                />
                <Bar dataKey="count" fill={`var(--color-${themeColor}-500)`} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Section>

        <Section title="Devices" icon={Smartphone}
          right={
            <div className="flex border border-gray-200 rounded-lg overflow-hidden text-xs">
              {(['devices', 'browsers', 'oses'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setDevicesTab(tab)}
                  className={`px-3 py-1 capitalize transition-colors ${
                    devicesTab === tab
                      ? `bg-${themeColor}-600 text-white`
                      : 'bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {tab === 'oses' ? 'OS' : tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>
          }
        >
          {activeDeviceData.length === 0 ? (
            <p className="text-sm text-gray-400 py-6 text-center">No {devicesTab} data yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={activeDeviceData}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {activeDeviceData.map((_e, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Section>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Section title="Traffic sources" icon={Globe}>
          <SimpleTable
            columns={['Source', 'Medium', 'Campaign', 'Visits', 'Conv.', 'Revenue']}
            rows={[
              ...(Array.isArray(sources?.utm) ? sources!.utm : []).map((s) => [
                s.source || '—', s.medium || '—', s.campaign || '—',
                (s.visits ?? 0).toLocaleString(), (s.conversions ?? 0).toLocaleString(), fmtCurrency(s.revenue),
              ]),
              ...(Array.isArray(sources?.direct) ? sources!.direct : []).map((s) => [
                'direct', '—', '—',
                (s.visits ?? 0).toLocaleString(), (s.conversions ?? 0).toLocaleString(), fmtCurrency(s.revenue),
              ]),
            ]}
          />
          {Array.isArray(sources?.referrers) && sources!.referrers.length > 0 && (
            <>
              <p className="text-xs uppercase text-gray-500 mt-4 mb-2 font-medium">Referrers</p>
              <SimpleTable
                columns={['Referrer', 'Visits', 'Conv.', 'Revenue']}
                rows={sources!.referrers.map((r) => [
                  r.referrer || '—',
                  (r.visits ?? 0).toLocaleString(),
                  (r.conversions ?? 0).toLocaleString(),
                  fmtCurrency(r.revenue),
                ])}
              />
            </>
          )}
        </Section>
        <Section title="Top landing pages">
          <SimpleTable
            columns={['Path', 'Entries', 'Bounce rate', 'Conv.', 'Revenue']}
            rows={landing.map((r) => [
              <span title={r.page_title || ''}>{r.page_path}</span>,
              (r.entries ?? 0).toLocaleString(),
              fmtPct(r.bounce_rate),
              (r.conversions ?? 0).toLocaleString(),
              fmtCurrency(r.revenue),
            ])}
          />
        </Section>
      </div>

      {(promos.length > 0 || (Array.isArray(searches?.top_queries) && searches!.top_queries.length > 0)) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {promos.length > 0 && (
            <Section title="Promo performance" icon={Tag}>
              <SimpleTable
                columns={['Code', 'Uses', 'Applied', 'Failures', 'Revenue']}
                rows={promos.map((p) => [
                  p.code,
                  (p.validations ?? 0).toLocaleString(),
                  (p.applications ?? 0).toLocaleString(),
                  (p.failures ?? 0).toLocaleString(),
                  fmtCurrency(p.revenue),
                ])}
              />
            </Section>
          )}
          {Array.isArray(searches?.top_queries) && searches!.top_queries.length > 0 && (
            <Section title="Searches" icon={Search}>
              <div className="space-y-4">
                <div>
                  <p className="text-xs uppercase text-gray-500 mb-2 font-medium">Top queries</p>
                  <SimpleTable
                    columns={['Query', 'Searches', 'Avg results']}
                    rows={searches!.top_queries.map((q) => [
                      q.query, (q.searches ?? 0).toLocaleString(), (q.results_avg ?? 0).toFixed(1),
                    ])}
                  />
                </div>
                {Array.isArray(searches?.zero_result_queries) && searches!.zero_result_queries.length > 0 && (
                  <div>
                    <p className="text-xs uppercase text-gray-500 mb-2 font-medium">Zero-result queries</p>
                    <SimpleTable
                      columns={['Query', 'Searches']}
                      rows={searches!.zero_result_queries.map((q) => [q.query, (q.searches ?? 0).toLocaleString()])}
                    />
                  </div>
                )}
              </div>
            </Section>
          )}
        </div>
      )}

      {attribution.length > 0 && (
        <Section title="Attribution" subtitle="First-touch vs last-touch revenue" icon={Sparkles}>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={attribution.slice(0, 10)}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis
                dataKey={(r: AttributionRow) => `${r.source || 'direct'}/${r.medium || '—'}`}
                stroke="#6b7280"
              />
              <YAxis stroke="#6b7280" />
              <Tooltip formatter={(v: number) => fmtCurrency(v)} />
              <Legend />
              <Bar dataKey="first_touch_revenue" fill={`var(--color-${themeColor}-500)`} name="First-touch $" radius={[4, 4, 0, 0]} />
              <Bar dataKey="last_touch_revenue" fill="#10b981" name="Last-touch $" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Section>
      )}

      <Section title="Recent Conversions">
        <div className="mb-3">
          <input
            type="text"
            value={convSearch}
            onChange={(e) => setConvSearch(e.target.value)}
            placeholder="Search by event, entity, UTM source or campaign…"
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2"
          />
        </div>
        <SimpleTable
          columns={['When', 'Event', 'Entity', 'Value', 'UTM source', 'UTM campaign']}
          rows={(conversions?.data ?? []).filter((c) => {
            if (!convSearch.trim()) return true;
            const q = convSearch.toLowerCase();
            return (
              fmtEventName(c.event_name).toLowerCase().includes(q) ||
              (c.entity_name || '').toLowerCase().includes(q) ||
              (c.entity_type || '').toLowerCase().includes(q) ||
              (c.utm_source || '').toLowerCase().includes(q) ||
              (c.utm_campaign || '').toLowerCase().includes(q)
            );
          }).map((c) => [
            fmtDate(c.created_at),
            fmtEventName(c.event_name),
            c.entity_type
              ? (c.entity_name || `${fmtEntityLabel(c.entity_type)} #${c.entity_id ?? '—'}`)
              : '—',
            fmtCurrency(c.conversion_value),
            c.utm_source || '—',
            c.utm_campaign || '—',
          ])}
        />
        {conversions && conversions.last_page > 1 && (
          <div className="mt-3">
            <Pagination
              currentPage={conversions.current_page}
              totalPages={conversions.last_page}
              totalItems={conversions.total}
              itemsPerPage={conversions.per_page}
              itemLabel="conversions"
              onPageChange={(p) => { setConversionsPage(p); setConvSearch(''); }}
            />
          </div>
        )}
      </Section>

      {drillEntity && (
        <EntityAnalyticsModal
          open={!!drillEntity}
          onClose={() => setDrillEntity(null)}
          entityType={drillEntity.type}
          entityId={drillEntity.id}
          entityName={drillEntity.name}
          filter={filter}
          locations={scopeLocations}
        />
      )}
    </div>
  );
};


const KpiCard: React.FC<{
  label: string;
  value?: number;
  rawValue?: string;
  prefix?: string;
  suffix?: string;
  icon?: React.ComponentType<{ className?: string }>;
  themeColor: string;
  tooltip?: string;
}> = ({ label, value, rawValue, prefix, suffix, icon: Icon, themeColor, tooltip }) => (
  <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 group relative">
    <div className="flex items-center justify-between">
      <div className="flex-1 min-w-0">
        <p className="text-xs sm:text-sm font-medium text-gray-600 truncate flex items-center gap-1">
          {label}
          {tooltip && <Info className="w-3 h-3 text-gray-400 flex-shrink-0" />}
        </p>
        <div className="text-xl sm:text-2xl font-bold text-gray-900 mt-1 flex items-baseline">
          {prefix && <span>{prefix}</span>}
          {rawValue != null
            ? <span>{rawValue}</span>
            : <CounterAnimation value={value ?? 0} className="text-xl sm:text-2xl font-bold text-gray-900" />}
          {suffix && <span className="ml-0.5">{suffix}</span>}
        </div>
      </div>
      {Icon && (
        <div className={`p-2 bg-${themeColor}-50 rounded-lg`}>
          <Icon className={`w-5 h-5 text-${themeColor}-600`} />
        </div>
      )}
    </div>
    {tooltip && (
      <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover:block w-52 px-2.5 py-1.5 bg-gray-900 text-white text-xs rounded-lg shadow-lg z-50 text-center pointer-events-none">
        {tooltip}
        <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-gray-900"></div>
      </div>
    )}
  </div>
);

const Section: React.FC<{
  title: string;
  subtitle?: string;
  icon?: React.ComponentType<{ className?: string }>;
  right?: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, subtitle, icon: Icon, right, children }) => (
  <div className="bg-white rounded-xl p-3 sm:p-4 shadow-sm border border-gray-100">
    <div className="flex items-start justify-between mb-3 gap-3">
      <div className="flex items-center gap-2">
        {Icon && <Icon className="w-4 h-4 text-gray-500" />}
        <div>
          <h3 className="text-base sm:text-lg font-semibold text-gray-900">{title}</h3>
          {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
        </div>
      </div>
      {right}
    </div>
    {children}
  </div>
);

const SimpleTable: React.FC<{ columns: string[]; rows: React.ReactNode[][] }> = ({ columns, rows }) => (
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

export default PageAnalytics;
