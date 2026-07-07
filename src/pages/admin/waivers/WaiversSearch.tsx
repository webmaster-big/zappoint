import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Filter,
  RefreshCcw,
  FileText,
  Printer,
  Trash2,
  Eye,
  Download,
  Plus,
  ClipboardList,
  Settings as SettingsIcon,
  Users,
  X,
  ShieldCheck,
  BarChart3,
  Loader2,
  ChevronRight,
  Link2,
} from 'lucide-react';
import { useThemeColor } from '../../../hooks/useThemeColor';
import { getStoredUser } from '../../../utils/storage';
import waiverService from '../../../services/waiverService';
import bookingService from '../../../services/bookingService';
import type { Booking } from '../../../services/bookingService';
import type { Waiver, WaiverSearchFilters, WaiverSettings, WaiverTemplate, ActivityType } from '../../../types/waiver.types';
import Toast from '../../../components/ui/Toast';
import StandardButton from '../../../components/ui/StandardButton';
import Pagination from '../../../components/ui/Pagination';
import ActionMenu from '../../../components/ui/ActionMenu';
import WaiverPageTour from '../../../components/waiver/tour/WaiverPageTour';
import { WAIVER_RECORDS_STEPS } from '../../../components/waiver/tour/tourSteps';

const sourceLabels: Record<string, string> = {
  checkout: 'Checkout',
  confirmation_email: 'Email link',
  sms_link: 'SMS link',
  kiosk: 'Kiosk',
  staff_sent: 'Staff sent',
  bulk_invite: 'Group invite',
};

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const formatDateTime = (iso?: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
};

const WaiversSearch = () => {
  const navigate = useNavigate();
  const { themeColor, fullColor } = useThemeColor();
  const currentUser = getStoredUser();
  const isAdmin = currentUser?.role === 'company_admin';
  const isManager = currentUser?.role === 'location_manager';

  const [waivers, setWaivers] = useState<Waiver[]>([]);
  const [pagination, setPagination] = useState({ current_page: 1, last_page: 1, total: 0, from: 0, to: 0 });
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [settings, setSettings] = useState<WaiverSettings | null>(null);

  const [filters, setFilters] = useState<WaiverSearchFilters>({ date: todayStr(), status: undefined });
  const [allDates, setAllDates] = useState(false);

  const [autoRefresh, setAutoRefresh] = useState(false);
  const refreshTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // detail / assign / delete modals
  const [detail, setDetail] = useState<{ waiver: Waiver; rendered_body: string } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showAssign, setShowAssign] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Waiver | null>(null);

  const refreshSeconds = settings?.search_auto_refresh_seconds || 30;

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const params: WaiverSearchFilters = { ...filters, per_page: 25, page };
      if (allDates) {
        params.all = 1;
        delete params.date;
      }
      Object.keys(params).forEach((k) => {
        const key = k as keyof WaiverSearchFilters;
        if (params[key] === '' || params[key] === undefined) delete params[key];
      });
      const res = await waiverService.list(params);
      if (res.success) {
        setWaivers((res.data.waivers as Waiver[]) || []);
        setPagination(res.data.pagination as typeof pagination);
      }
    } catch {
      setToast({ message: 'Failed to load waivers', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [filters, allDates, page]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    waiverService.getSettings().then((r) => r.success && setSettings(r.data)).catch(() => {});
  }, []);

  // Auto-refresh polling
  useEffect(() => {
    if (autoRefresh && refreshSeconds > 0) {
      refreshTimer.current = setInterval(() => load(), refreshSeconds * 1000);
    }
    return () => {
      if (refreshTimer.current) clearInterval(refreshTimer.current);
    };
  }, [autoRefresh, refreshSeconds, load]);

  const setFilter = (key: keyof WaiverSearchFilters, value: unknown) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const clearFilters = () => {
    setFilters({ date: todayStr(), status: undefined });
    setAllDates(false);
    setPage(1);
  };

  const openDetail = async (w: Waiver) => {
    setDetailLoading(true);
    try {
      const res = await waiverService.get(w.id);
      if (res.success) setDetail(res.data);
    } catch {
      setToast({ message: 'Failed to load waiver', type: 'error' });
    } finally {
      setDetailLoading(false);
    }
  };

  const handlePrint = async (w: Waiver) => {
    try {
      const blob = await waiverService.print(w.id);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch {
      setToast({ message: 'Print failed — you may not have permission.', type: 'error' });
    }
  };

  const handleExport = async () => {
    try {
      const params: WaiverSearchFilters = { ...filters };
      if (allDates) {
        params.all = 1;
        delete params.date;
      }
      const res = await waiverService.export(params);
      const rows = res?.data?.waivers || [];
      if (!rows.length) {
        setToast({ message: 'Nothing to export for this filter.', type: 'info' });
        return;
      }
      const headers = ['id', 'adult_name', 'email', 'phone', 'selected_date', 'status', 'marketing_consent', 'source', 'template', 'location', 'submitted_at', 'minors'];
      const csv = [
        headers.join(','),
        ...rows.map((r: Record<string, unknown>) =>
          headers.map((h) => `"${String(r[h] ?? '').replace(/"/g, '""')}"`).join(','),
        ),
      ].join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `waivers-${allDates ? 'all' : filters.date}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setToast({ message: 'Export failed — you may not have permission.', type: 'error' });
    }
  };

  const confirmDelete = async (reason: string) => {
    if (!deleteTarget) return;
    try {
      await waiverService.remove(deleteTarget.id, reason);
      setToast({ message: 'Waiver deleted', type: 'success' });
      setDeleteTarget(null);
      load();
    } catch {
      setToast({ message: 'Failed to delete waiver', type: 'error' });
    }
  };

  const inputCls = `pl-9 pr-3 py-1.5 border border-gray-200 rounded-lg w-full text-sm focus:ring-2 focus:ring-${themeColor}-600 focus:border-${themeColor}-600`;
  const fieldCls = `w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-${themeColor}-600`;

  return (
    <div className="min-h-screen px-6 py-8">
      <WaiverPageTour steps={WAIVER_RECORDS_STEPS} storageKey="tour_waiver_records" />
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-3">
        <div data-tour="waivers-heading">
          <h1 className="text-3xl font-bold text-gray-900">Waivers</h1>
          <p className="text-gray-600 mt-1">Look up signed waivers, assign new ones, and manage records.</p>
        </div>
        <div className="mt-4 sm:mt-0 flex items-center gap-2">
          <span data-tour="waivers-manage-menu">
          <ActionMenu
            label="Manage"
            items={[
              { label: 'Templates', icon: FileText, onClick: () => navigate('/waivers/templates') },
              { label: 'Group Invites', icon: Users, onClick: () => navigate('/waivers/bulk') },
              { label: 'Reports', icon: BarChart3, onClick: () => navigate('/waivers/reports') },
              { label: 'Deletion Log', icon: ClipboardList, onClick: () => navigate('/waivers/deletion-log'), hidden: !(isAdmin || isManager), dividerBefore: true },
              { label: 'Settings', icon: SettingsIcon, onClick: () => navigate('/waivers/settings'), hidden: !isAdmin },
            ]}
          />
          </span>
          <span data-tour="waivers-assign-btn">
          <StandardButton variant="primary" size="md" icon={Plus} onClick={() => setShowAssign(true)}>Assign Waiver</StandardButton>
          </span>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 mb-6">
        <div className="flex flex-col lg:flex-row gap-3 lg:items-center justify-between">
          <div className="flex flex-wrap items-center gap-3" data-tour="waivers-date-controls">
            <div className="relative">
              <input
                type="date"
                value={filters.date || ''}
                disabled={allDates}
                onChange={(e) => setFilter('date', e.target.value)}
                className={`border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-${themeColor}-600 disabled:bg-gray-50 disabled:text-gray-400`}
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input type="checkbox" checked={allDates} onChange={(e) => { setAllDates(e.target.checked); setPage(1); }} className={`h-4 w-4 text-${fullColor} rounded border-gray-300`} />
              All dates
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} className={`h-4 w-4 text-${fullColor} rounded border-gray-300`} />
              Auto-refresh ({refreshSeconds}s)
            </label>
          </div>
          <div data-tour="waivers-filter-btns" className="flex gap-1.5">
            <StandardButton variant="secondary" size="sm" icon={Filter} onClick={() => setShowFilters(!showFilters)}>Filters</StandardButton>
            <StandardButton variant="secondary" size="sm" icon={RefreshCcw} onClick={load}>{''}</StandardButton>
            <StandardButton variant="secondary" size="sm" icon={Download} onClick={handleExport}>Export</StandardButton>
          </div>
        </div>

        {showFilters && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <input type="text" placeholder="Adult name" value={filters.adult_name || ''} onChange={(e) => setFilter('adult_name', e.target.value)} className={inputCls} />
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <input type="text" placeholder="Minor name" value={filters.minor_name || ''} onChange={(e) => setFilter('minor_name', e.target.value)} className={inputCls} />
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <input type="text" placeholder="Email" value={filters.email || ''} onChange={(e) => setFilter('email', e.target.value)} className={inputCls} />
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <input type="text" placeholder="Phone" value={filters.phone || ''} onChange={(e) => setFilter('phone', e.target.value)} className={inputCls} />
            </div>
            <div>
              <select value={filters.status || ''} onChange={(e) => setFilter('status', e.target.value || undefined)} className={fieldCls}>
                <option value="">Completed (default)</option>
                <option value="pending">Pending</option>
                <option value="expired">Expired</option>
                <option value="replaced">Replaced</option>
              </select>
            </div>
            <div>
              <select value={filters.source || ''} onChange={(e) => setFilter('source', (e.target.value || undefined) as WaiverSearchFilters['source'])} className={fieldCls}>
                <option value="">Any source</option>
                {Object.entries(sourceLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <select value={filters.marketing_consent_status || ''} onChange={(e) => setFilter('marketing_consent_status', (e.target.value || undefined) as WaiverSearchFilters['marketing_consent_status'])} className={fieldCls}>
                <option value="">Any marketing consent</option>
                <option value="opted_in">Opted in</option>
                <option value="not_opted_in">Not opted in</option>
                <option value="withdrawn">Withdrawn</option>
              </select>
            </div>
            <div className="flex items-end">
              <StandardButton variant="ghost" size="sm" onClick={clearFilters}>Clear</StandardButton>
            </div>
          </div>
        )}
      </div>

      {/* Table */}
      <div data-tour="waivers-table" className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['Name', 'Linked to', 'Minors', 'Date', 'Template', 'Location', 'Source', 'Marketing', 'Submitted', ''].map((h) => (
                  <th key={h} className="px-4 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={10} className="px-6 py-12 text-center"><div className={`animate-spin rounded-full h-8 w-8 border-b-2 border-${fullColor} mx-auto`} /></td></tr>
              ) : waivers.length === 0 ? (
                <tr><td colSpan={10} className="px-6 py-12 text-center"><ShieldCheck className="w-10 h-10 text-gray-300 mx-auto mb-3" /><p className="text-gray-500">No waivers found for this filter.</p></td></tr>
              ) : (
                waivers.map((w) => (
                  <tr key={w.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <span className="text-sm font-medium text-gray-900">{[w.adult_first_name, w.adult_last_name].filter(Boolean).join(' ') || '—'}</span>
                      <div className="text-xs text-gray-400">{w.adult_email || w.adult_phone || ''}</div>
                    </td>
                    <td className="px-4 py-3">
                      {w.booking ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-full">
                          <Link2 className="w-3 h-3" />{w.booking.reference_number || `#${w.booking.id}`}
                        </span>
                      ) : w.attraction_purchase ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-violet-700 bg-violet-50 border border-violet-100 px-2 py-0.5 rounded-full">
                          <Link2 className="w-3 h-3" />AP-{w.attraction_purchase.id}
                        </span>
                      ) : w.event ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-full">
                          <Link2 className="w-3 h-3" />{w.event.name}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{w.minors?.length || 0}</td>
                    <td className="px-4 py-3 text-sm text-gray-600" style={{ fontVariantNumeric: 'tabular-nums' }}>{w.selected_date}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{w.template?.title || '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{w.location?.name || '—'}</td>
                    <td className="px-4 py-3"><span className="text-xs text-gray-500">{sourceLabels[w.source] || w.source}</span></td>
                    <td className="px-4 py-3">
                      {w.marketing_consent_status === 'opted_in' ? (
                        <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">Opted in</span>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{formatDateTime(w.submitted_at)}</td>
                    <td className="px-4 py-3 text-right">
                      <div data-tour="waivers-row-actions" className="flex items-center justify-end gap-1">
                        <button onClick={() => openDetail(w)} className={`p-2 text-gray-400 hover:text-${themeColor}-600 hover:bg-${themeColor}-50 rounded-lg transition-colors`} title="View"><Eye className="w-4 h-4" /></button>
                        <button onClick={() => handlePrint(w)} className={`p-2 text-gray-400 hover:text-${themeColor}-600 hover:bg-${themeColor}-50 rounded-lg transition-colors`} title="Print"><Printer className="w-4 h-4" /></button>
                        {isAdmin && (
                          <button onClick={() => setDeleteTarget(w)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete"><Trash2 className="w-4 h-4" /></button>
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
            <Pagination currentPage={pagination.current_page} totalPages={pagination.last_page} onPageChange={setPage} totalItems={pagination.total} showingFrom={pagination.from} showingTo={pagination.to} />
          </div>
        )}
      </div>

      {detailLoading && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className={`animate-spin rounded-full h-10 w-10 border-b-2 border-${fullColor}`} />
        </div>
      )}

      {detail && <WaiverDetailModal data={detail} onClose={() => setDetail(null)} themeColor={themeColor} />}
      {showAssign && <AssignWaiverModal onClose={() => setShowAssign(false)} onSaved={() => { setShowAssign(false); load(); setToast({ message: 'Waiver assigned & link sent', type: 'success' }); }} themeColor={themeColor} />}
      {deleteTarget && <DeleteWaiverModal waiver={deleteTarget} onCancel={() => setDeleteTarget(null)} onConfirm={confirmDelete} />}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};

/* ---------- Detail modal ---------- */
const WaiverDetailModal = ({ data, onClose, themeColor }: { data: { waiver: Waiver; rendered_body: string }; onClose: () => void; themeColor: string }) => {
  const w = data.waiver;
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{[w.adult_first_name, w.adult_last_name].filter(Boolean).join(' ') || 'Waiver'}</h2>
            <p className="text-xs text-gray-500">{w.template?.title} · {w.selected_date}</p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 overflow-y-auto space-y-5">
          <div className="grid grid-cols-2 gap-3 text-sm">
            {[
              ['Email', w.adult_email], ['Phone', w.adult_phone],
              ['Typed name', w.typed_legal_name], ['Source', sourceLabels[w.source] || w.source],
              ['Marketing', w.marketing_consent_status === 'opted_in' ? 'Opted in' : 'Not opted in'],
              ['Photo/Video', w.photo_video_consent ? 'Consented' : '—'],
            ].map(([k, v]) => (
              <div key={k as string}><span className="text-gray-400">{k}</span><div className="text-gray-900 font-medium">{v || '—'}</div></div>
            ))}
          </div>
          {w.minors && w.minors.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Minors</h3>
              <div className="border border-gray-100 rounded-lg divide-y divide-gray-50">
                {w.minors.map((m, i) => (
                  <div key={i} className="px-3 py-2 flex justify-between text-sm">
                    <span className="text-gray-900">{m.first_name} {m.last_name}</span>
                    <span className="text-gray-400">{[m.date_of_birth, m.relationship].filter(Boolean).join(' · ')}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Agreement</h3>
            <div className={`bg-${themeColor}-50/40 border border-gray-100 rounded-lg p-4 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap max-h-72 overflow-y-auto`} dangerouslySetInnerHTML={{ __html: data.rendered_body }} />
          </div>
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
          <StandardButton variant="secondary" onClick={onClose}>Close</StandardButton>
          <StandardButton variant="primary" icon={Printer} onClick={async () => { try { const blob = await waiverService.print(w.id); const url = URL.createObjectURL(blob); window.open(url, '_blank'); } catch { /* noop */ } }}>Print</StandardButton>
        </div>
      </div>
    </div>
  );
};

/* ---------- Assign modal ---------- */
interface ActivityOption { key: string; type: ActivityType; id: number; name: string }

const AssignWaiverModal = ({ onClose, onSaved, themeColor }: { onClose: () => void; onSaved: () => void; themeColor: string }) => {
  const [templates, setTemplates] = useState<WaiverTemplate[]>([]);
  const [form, setForm] = useState({ waiver_template_id: 0, selected_date: todayStr(), adult_email: '', adult_phone: '' });
  const [activityOptions, setActivityOptions] = useState<ActivityOption[]>([]);
  const [activityKey, setActivityKey] = useState('');
  const [loadingActivities, setLoadingActivities] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [bookingQuery, setBookingQuery] = useState('');
  const [bookingResults, setBookingResults] = useState<Booking[]>([]);
  const [bookingSearching, setBookingSearching] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    waiverService.listTemplates({ status: 'active', per_page: 100 }).then((r) => {
      if (r.success) setTemplates((r.data.waiver_templates as WaiverTemplate[]) || []);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    setActivityKey('');
    setActivityOptions([]);
    const tpl = templates.find((t) => t.id === form.waiver_template_id);
    if (!tpl) return;
    const want: Record<ActivityType, number[]> = {
      package: tpl.assigned_package_ids ?? [],
      attraction: tpl.assigned_attraction_ids ?? [],
      event: tpl.assigned_event_ids ?? [],
      party_type: [],
    };
    const types = (['package', 'attraction', 'event'] as ActivityType[]).filter((t) => want[t].length > 0);
    if (types.length === 0) return;
    setLoadingActivities(true);
    Promise.all(types.map((t) => waiverService.availableActivities(t, tpl.id).catch(() => null)))
      .then((results) => {
        const opts: ActivityOption[] = [];
        types.forEach((t, i) => {
          const r = results[i];
          if (!r?.success) return;
          r.data.available
            .filter((a) => want[t].includes(a.id))
            .forEach((a) => opts.push({ key: `${t}:${a.id}`, type: t, id: a.id, name: a.name }));
        });
        setActivityOptions(opts);
      })
      .finally(() => setLoadingActivities(false));
  }, [form.waiver_template_id, templates]);

  const handleBookingSearch = (q: string) => {
    setBookingQuery(q);
    setSelectedBooking(null);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!q.trim()) { setBookingResults([]); return; }
    searchTimer.current = setTimeout(async () => {
      setBookingSearching(true);
      try {
        const res = await bookingService.searchBookings(q);
        setBookingResults(res.success ? res.data.slice(0, 5) : []);
      } catch {
        setBookingResults([]);
      } finally {
        setBookingSearching(false);
      }
    }, 350);
  };

  const selectBooking = (b: Booking) => {
    setSelectedBooking(b);
    setBookingResults([]);
    setBookingQuery(`${b.reference_number} — ${b.guest_name || b.guest_email || ''}`);
    setForm((f) => ({ ...f, selected_date: b.booking_date || f.selected_date }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.waiver_template_id) { setError('Choose a template'); return; }
    if (!form.adult_email && !form.adult_phone) { setError('Enter an email or phone to send the link'); return; }
    setSaving(true);
    setError(null);
    try {
      const chosen = activityOptions.find((a) => a.key === activityKey);
      await waiverService.assign({
        waiver_template_id: form.waiver_template_id,
        selected_date: form.selected_date,
        adult_email: form.adult_email || undefined,
        adult_phone: form.adult_phone || undefined,
        booking_id: selectedBooking?.id,
        event_id: chosen?.type === 'event' ? chosen.id : undefined,
        activity_name: chosen && chosen.type !== 'event' ? chosen.name : undefined,
      });
      onSaved();
    } catch (err: unknown) {
      const e2 = err as { response?: { data?: { message?: string } } };
      setError(e2.response?.data?.message || 'Failed to assign waiver');
    } finally {
      setSaving(false);
    }
  };

  const fieldCls = `w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 outline-none`;
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
          <h2 className="text-lg font-bold text-gray-900">Assign Waiver</h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4 overflow-y-auto">
          {error && <div className="bg-red-50 border border-red-100 rounded-lg px-3 py-2 text-xs text-red-700">{error}</div>}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Template *</label>
            <select value={form.waiver_template_id} onChange={(e) => setForm((f) => ({ ...f, waiver_template_id: Number(e.target.value) }))} className={fieldCls}>
              <option value={0}>Select a template…</option>
              {templates.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
            </select>
          </div>
          {(activityOptions.length > 0 || loadingActivities) && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Activity <span className="text-gray-400 font-normal">(fills the waiver text)</span></label>
              <select value={activityKey} onChange={(e) => setActivityKey(e.target.value)} disabled={loadingActivities} className={fieldCls}>
                <option value="">{loadingActivities ? 'Loading…' : 'Auto / not specified'}</option>
                {activityOptions.map((a) => (
                  <option key={a.key} value={a.key}>{a.name} ({a.type})</option>
                ))}
              </select>
              <p className="text-[11px] text-gray-400 mt-1">If this template covers one activity it fills in automatically; pick here when it covers several.</p>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Link to booking <span className="text-gray-400 font-normal">(optional — ties this waiver to a specific booking)</span>
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={bookingQuery}
                onChange={(e) => handleBookingSearch(e.target.value)}
                placeholder="Search by ref # or guest name…"
                className={`${fieldCls} pl-9`}
              />
              {bookingSearching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin" />}
            </div>
            {selectedBooking && (
              <div className={`mt-1.5 flex items-center justify-between px-3 py-2 rounded-lg bg-${themeColor}-50 border border-${themeColor}-200 text-sm`}>
                <div>
                  <span className="font-medium text-gray-900">{selectedBooking.guest_name || selectedBooking.guest_email}</span>
                  <span className="text-gray-400 ml-2 text-xs">{selectedBooking.reference_number} · {selectedBooking.booking_date}</span>
                </div>
                <button type="button" onClick={() => { setSelectedBooking(null); setBookingQuery(''); }} className="text-gray-400 hover:text-gray-600 ml-2">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            {!selectedBooking && bookingResults.length > 0 && (
              <div className="mt-1.5 border border-gray-200 rounded-lg overflow-hidden divide-y divide-gray-100">
                {bookingResults.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => selectBooking(b)}
                    className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-gray-50 text-left transition-colors"
                  >
                    <div>
                      <div className="text-sm font-medium text-gray-900">{b.guest_name || b.guest_email || '—'}</div>
                      <div className="text-xs text-gray-400">{b.reference_number} · {b.booking_date}{b.package?.name ? ` · ${b.package.name}` : ''}</div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Booking date *</label>
            <input type="date" value={form.selected_date} onChange={(e) => setForm((f) => ({ ...f, selected_date: e.target.value }))} className={fieldCls} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
            <input type="email" value={form.adult_email} onChange={(e) => setForm((f) => ({ ...f, adult_email: e.target.value }))} className={fieldCls} placeholder="customer@email.com" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone</label>
            <input type="tel" value={form.adult_phone} onChange={(e) => setForm((f) => ({ ...f, adult_phone: e.target.value }))} className={fieldCls} placeholder="(555) 123-4567" />
          </div>
          <p className="text-xs text-gray-400">A waiver link will be sent by email and/or SMS.</p>
          <div className="flex justify-end gap-2 pt-2">
            <StandardButton type="button" variant="secondary" onClick={onClose}>Cancel</StandardButton>
            <StandardButton type="submit" variant="primary" disabled={saving}>{saving ? 'Assigning…' : 'Assign & Send'}</StandardButton>
          </div>
        </form>
      </div>
    </div>
  );
};

/* ---------- Delete modal ---------- */
const DeleteWaiverModal = ({ waiver, onCancel, onConfirm }: { waiver: Waiver; onCancel: () => void; onConfirm: (reason: string) => void }) => {
  const [reason, setReason] = useState('');
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={onCancel}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">Delete Waiver</h2>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-600">
            Delete the waiver for <span className="font-semibold">{[waiver.adult_first_name, waiver.adult_last_name].filter(Boolean).join(' ') || 'this guest'}</span>?
            This is logged and can be reviewed in the deletion log.
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Reason <span className="text-gray-400 font-normal">(recommended)</span></label>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-400 focus:border-red-400 outline-none" placeholder="Why is this being deleted?" />
          </div>
          <div className="flex justify-end gap-2">
            <StandardButton variant="secondary" onClick={onCancel}>Cancel</StandardButton>
            <StandardButton variant="danger" icon={Trash2} onClick={() => onConfirm(reason)}>Delete</StandardButton>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WaiversSearch;
