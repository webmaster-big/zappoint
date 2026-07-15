import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode, ComponentType } from 'react';
import DOMPurify from 'dompurify';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Download,
  Printer,
  Trash2,
  Plus,
  UserCheck,
  Undo2,
  ClipboardList,
  FileText,
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
import { formatDateLong, formatDateTimeET } from '../../../utils/timeFormat';
import waiverService from '../../../services/waiverService';
import bookingService from '../../../services/bookingService';
import type { Booking } from '../../../services/bookingService';
import attractionPurchaseService from '../../../services/AttractionPurchaseService';
import type { AttractionPurchase } from '../../../services/AttractionPurchaseService';
import eventPurchaseService from '../../../services/EventPurchaseService';
import type { EventPurchase } from '../../../types/event.types';
import type { Waiver, WaiverSearchFilters, WaiverSettings, WaiverTemplate, ActivityType, WaiverStatus } from '../../../types/waiver.types';
import Toast from '../../../components/ui/Toast';
import StandardButton from '../../../components/ui/StandardButton';
import ActionMenu from '../../../components/ui/ActionMenu';
import WaiverPageTour from '../../../components/waiver/tour/WaiverPageTour';
import { WAIVER_RECORDS_STEPS } from '../../../components/waiver/tour/tourSteps';
import {
  AdminDataTable,
  AdminTableToolbar,
  exportTableCsv,
  useAdminTable,
} from '../../../components/admin/table';
import type { AdminColumn, AdminFilterDef } from '../../../components/admin/table';

const sourceLabels: Record<string, string> = {
  checkout: 'Checkout',
  confirmation_email: 'Email link',
  sms_link: 'SMS link',
  kiosk: 'Kiosk',
  staff_sent: 'Staff sent',
  bulk_invite: 'Group invite',
};

const marketingLabels: Record<string, string> = {
  opted_in: 'Opted in',
  not_opted_in: 'Not opted in',
  withdrawn: 'Withdrawn',
};

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const adultName = (w: Waiver) => [w.adult_first_name, w.adult_last_name].filter(Boolean).join(' ');
const minorNames = (w: Waiver) => (w.minors || []).map((m) => [m.first_name, m.last_name].filter(Boolean).join(' ')).join(', ');
const linkedLabel = (w: Waiver) => {
  if (w.booking) return `Booking ${w.booking.reference_number || `#${w.booking.id}`}`;
  if (w.attraction_purchase) return `Attraction AP-${w.attraction_purchase.id}`;
  if (w.event) return `Event ${w.event.name}`;
  return '';
};

const WaiversSearch = () => {
  const navigate = useNavigate();
  const { themeColor, fullColor } = useThemeColor();
  const currentUser = getStoredUser();
  const isAdmin = currentUser?.role === 'company_admin';
  const isManager = currentUser?.role === 'location_manager';

  const [waivers, setWaivers] = useState<Waiver[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [settings, setSettings] = useState<WaiverSettings | null>(null);

  const [scopeDate, setScopeDate] = useState<string>(todayStr());
  const [scopeStatus, setScopeStatus] = useState<string>('');
  const [allDates, setAllDates] = useState(false);

  const [autoRefresh, setAutoRefresh] = useState(false);
  const refreshTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const [detail, setDetail] = useState<{ waiver: Waiver; rendered_body: string } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showAssign, setShowAssign] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Waiver | null>(null);

  const refreshSeconds = settings?.search_auto_refresh_seconds || 30;

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const base: WaiverSearchFilters = { per_page: 200 };
      if (allDates) base.all = 1;
      else if (scopeDate) base.date = scopeDate;
      if (scopeStatus) base.status = scopeStatus as WaiverStatus;

      const collected: Waiver[] = [];
      let currentPage = 1;
      let lastPage = 1;
      do {
        const res = await waiverService.list({ ...base, page: currentPage });
        if (!res.success) break;
        collected.push(...((res.data.waivers as Waiver[]) || []));
        lastPage = res.data.pagination?.last_page ?? 1;
        currentPage++;
      } while (currentPage <= lastPage);

      setWaivers(collected);
    } catch {
      setToast({ message: 'Failed to load waivers', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [scopeDate, scopeStatus, allDates]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    waiverService.getSettings().then((r) => r.success && setSettings(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (autoRefresh && refreshSeconds > 0) {
      refreshTimer.current = setInterval(() => load(), refreshSeconds * 1000);
    }
    return () => {
      if (refreshTimer.current) clearInterval(refreshTimer.current);
    };
  }, [autoRefresh, refreshSeconds, load]);

  const templateOptions = useMemo(() => {
    const map = new Map<string, string>();
    waivers.forEach((w) => { if (w.template?.title) map.set(w.template.title, w.template.title); });
    return [...map.keys()].sort().map((t) => ({ value: t, label: t }));
  }, [waivers]);

  const locationOptions = useMemo(() => {
    const map = new Map<string, string>();
    waivers.forEach((w) => { if (w.location?.name) map.set(w.location.name, w.location.name); });
    return [...map.keys()].sort().map((l) => ({ value: l, label: l }));
  }, [waivers]);

  const columns: AdminColumn<Waiver>[] = [
    {
      key: 'id',
      label: 'ID',
      group: 'Identifiers',
      sortable: true,
      sortValue: (w) => w.id,
      exportValue: (w) => w.id,
      defaultVisible: false,
      render: (w) => <span className="text-sm text-gray-500">#{w.id}</span>,
    },
    {
      key: 'name',
      label: 'Name',
      group: 'Customer',
      sortable: true,
      sortValue: (w) => `${w.adult_last_name || ''} ${w.adult_first_name || ''}`.trim().toLowerCase(),
      exportValue: (w) => adultName(w) || '',
      render: (w) => (
        <div>
          <span className="text-sm font-medium text-gray-900">{adultName(w) || '—'}</span>
          <div className="text-xs text-gray-400">{w.adult_email || w.adult_phone || ''}</div>
        </div>
      ),
    },
    {
      key: 'linked',
      label: 'Linked to',
      group: 'Details',
      sortable: true,
      sortValue: (w) => linkedLabel(w).toLowerCase(),
      exportValue: (w) => linkedLabel(w),
      defaultVisible: false,
      render: (w) => (
        w.booking ? (
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
        )
      ),
    },
    {
      key: 'minors',
      label: 'Minors',
      group: 'Details',
      sortable: true,
      sortValue: (w) => w.minors?.length || 0,
      exportValue: (w) => w.minors?.length || 0,
      render: (w) => <span className="text-sm text-gray-600">{w.minors?.length || 0}</span>,
    },
    {
      key: 'date',
      label: 'Date',
      group: 'Dates',
      sortable: true,
      sortValue: (w) => w.selected_date || '',
      exportValue: (w) => w.selected_date || '',
      defaultVisible: false,
      render: (w) => <span className="text-sm text-gray-600" style={{ fontVariantNumeric: 'tabular-nums' }}>{formatDateLong(w.selected_date)}</span>,
    },
    {
      key: 'template',
      label: 'Template',
      group: 'Details',
      sortable: true,
      sortValue: (w) => w.template?.title || '',
      exportValue: (w) => w.template?.title || '',
      defaultVisible: false,
      render: (w) => <span className="text-sm text-gray-600">{w.template?.title || '—'}</span>,
    },
    {
      key: 'location',
      label: 'Location',
      group: 'Details',
      sortable: true,
      sortValue: (w) => w.location?.name || '',
      exportValue: (w) => w.location?.name || '',
      defaultVisible: false,
      render: (w) => <span className="text-sm text-gray-600">{w.location?.name || '—'}</span>,
    },
    {
      key: 'status',
      label: 'Status',
      group: 'Status',
      sortable: true,
      sortValue: (w) => w.status || '',
      exportValue: (w) => w.status || '',
      defaultVisible: false,
      render: (w) => <span className="text-xs text-gray-600 capitalize">{w.status}</span>,
    },
    {
      key: 'source',
      label: 'Source',
      group: 'Details',
      sortable: true,
      sortValue: (w) => sourceLabels[w.source] || w.source || '',
      exportValue: (w) => sourceLabels[w.source] || w.source || '',
      defaultVisible: false,
      render: (w) => <span className="text-xs text-gray-500">{sourceLabels[w.source] || w.source}</span>,
    },
    {
      key: 'marketing',
      label: 'Marketing',
      group: 'Consent',
      sortable: true,
      sortValue: (w) => w.marketing_consent_status || '',
      exportValue: (w) => marketingLabels[w.marketing_consent_status] || w.marketing_consent_status || '',
      defaultVisible: false,
      render: (w) => (
        w.marketing_consent_status === 'opted_in' ? (
          <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">Opted in</span>
        ) : (
          <span className="text-xs text-gray-400">—</span>
        )
      ),
    },
    {
      key: 'submitted',
      label: 'Submitted',
      group: 'Dates',
      sortable: true,
      sortValue: (w) => (w.submitted_at ? new Date(w.submitted_at).getTime() : 0),
      exportValue: (w) => (w.submitted_at ? new Date(w.submitted_at).toLocaleString() : ''),
      render: (w) => <span className="text-sm text-gray-500">{formatDateTimeET(w.submitted_at)}</span>,
    },
    {
      key: 'check_in',
      label: 'Check-In',
      group: 'Status',
      sortable: true,
      sortValue: (w) => (w.checked_in_at ? 1 : 0),
      exportValue: (w) => (w.checked_in_at ? 'Checked in' : 'Not checked in'),
      render: (w) => (
        w.checked_in_at ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">
            <UserCheck className="w-3 h-3" />Checked In
          </span>
        ) : (
          <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-gray-50 text-gray-500 border border-gray-200">Not Checked In</span>
        )
      ),
    },
  ];

  const filterDefs: AdminFilterDef<Waiver>[] = useMemo(() => [
    {
      type: 'select',
      key: 'check_in',
      label: 'Check-In',
      allLabel: 'Any check-in status',
      options: [
        { value: 'checked_in', label: 'Checked in' },
        { value: 'not_checked_in', label: 'Not checked in' },
      ],
      predicate: (w, value) => (value === 'checked_in' ? !!w.checked_in_at : !w.checked_in_at),
    },
    {
      type: 'select',
      key: 'source',
      label: 'Source',
      allLabel: 'Any source',
      options: Object.entries(sourceLabels).map(([value, label]) => ({ value, label })),
      predicate: (w, value) => w.source === value,
    },
    {
      type: 'select',
      key: 'marketing',
      label: 'Marketing Consent',
      allLabel: 'Any marketing consent',
      options: [
        { value: 'opted_in', label: 'Opted in' },
        { value: 'not_opted_in', label: 'Not opted in' },
        { value: 'withdrawn', label: 'Withdrawn' },
      ],
      predicate: (w, value) => w.marketing_consent_status === value,
    },
    {
      type: 'select',
      key: 'template',
      label: 'Template',
      allLabel: 'Any template',
      options: templateOptions,
      predicate: (w, value) => (w.template?.title || '') === value,
    },
    {
      type: 'select',
      key: 'location',
      label: 'Location',
      allLabel: 'Any location',
      options: locationOptions,
      predicate: (w, value) => (w.location?.name || '') === value,
    },
    {
      type: 'daterange',
      key: 'submitted',
      label: 'Submitted Date',
      getDate: (w) => w.submitted_at,
    },
  ], [templateOptions, locationOptions]);

  const table = useAdminTable<Waiver>({
    data: waivers,
    columns,
    getRowId: (w) => String(w.id),
    storageKey: 'waivers_search_v3',
    filterDefs,
    searchFields: (w) => [
      w.id,
      adultName(w),
      w.adult_email,
      w.adult_phone,
      minorNames(w),
      w.template?.title,
      w.location?.name,
      sourceLabels[w.source] || w.source,
      w.status,
      w.booking?.reference_number,
      w.event?.name,
      linkedLabel(w),
    ],
    defaultSort: (a, b) => (b.submitted_at ? new Date(b.submitted_at).getTime() : 0) - (a.submitted_at ? new Date(a.submitted_at).getTime() : 0),
    itemsPerPage: 25,
  });

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

  const handleExport = () => {
    if (!table.filteredRows.length) {
      setToast({ message: 'Nothing to export for this filter.', type: 'info' });
      return;
    }
    exportTableCsv({
      filename: `waivers-${allDates ? 'all' : scopeDate}-${new Date().toISOString().split('T')[0]}.csv`,
      columns,
      rows: table.filteredRows,
      extraColumns: [
        { label: 'Email', value: (w) => w.adult_email || '' },
        { label: 'Phone', value: (w) => w.adult_phone || '' },
        { label: 'Adult DOB', value: (w) => w.adult_dob || '' },
        { label: 'Relationship', value: (w) => w.relationship || '' },
        { label: 'Typed Legal Name', value: (w) => w.typed_legal_name || '' },
        { label: 'Agreement Accepted', value: (w) => (w.agreement_accepted ? 'Yes' : 'No') },
        { label: 'Electronic Consent', value: (w) => (w.electronic_consent_accepted ? 'Yes' : 'No') },
        { label: 'Photo/Video Consent', value: (w) => (w.photo_video_consent ? 'Yes' : 'No') },
        { label: 'Minor Names', value: (w) => minorNames(w) },
        { label: 'Minor Details', value: (w) => (w.minors || []).map((m) => `${[m.first_name, m.last_name].filter(Boolean).join(' ')}${m.date_of_birth ? ` (DOB ${m.date_of_birth})` : ''}${m.relationship ? ` [${m.relationship}]` : ''}`).join('; ') },
      ],
    });
  };

  const handleCheckIn = async (w: Waiver) => {
    try {
      await waiverService.checkIn(w.id);
      setToast({ message: `${adultName(w) || 'Waiver'} checked in`, type: 'success' });
      load();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setToast({ message: e.response?.data?.message || 'Failed to check in waiver', type: 'error' });
    }
  };

  const handleUndoCheckIn = async (w: Waiver) => {
    try {
      await waiverService.undoCheckIn(w.id);
      setToast({ message: 'Check-in undone', type: 'info' });
      load();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setToast({ message: e.response?.data?.message || 'Failed to undo check-in', type: 'error' });
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

  const clearScope = () => {
    setScopeDate(todayStr());
    setScopeStatus('');
    setAllDates(false);
    table.setSearchInput('');
    table.clearFilters();
    table.setPage(1);
  };

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

      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-4">
        <div className="flex flex-wrap items-center gap-3" data-tour="waivers-date-controls">
          <div className="relative">
            <input
              type="date"
              value={scopeDate}
              disabled={allDates}
              onChange={(e) => { setScopeDate(e.target.value); table.setPage(1); }}
              className={`border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-${themeColor}-600 disabled:bg-gray-50 disabled:text-gray-400`}
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input type="checkbox" checked={allDates} onChange={(e) => { setAllDates(e.target.checked); table.setPage(1); }} className={`h-4 w-4 text-${fullColor} rounded border-gray-300`} />
            All dates
          </label>
          <div>
            <select
              value={scopeStatus}
              onChange={(e) => { setScopeStatus(e.target.value); table.setPage(1); }}
              className={`border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-${themeColor}-600`}
              title="Waiver status scope"
            >
              <option value="">Completed (default)</option>
              <option value="pending">Pending</option>
              <option value="expired">Expired</option>
              <option value="replaced">Replaced</option>
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} className={`h-4 w-4 text-${fullColor} rounded border-gray-300`} />
            Auto-refresh ({refreshSeconds}s)
          </label>
          <StandardButton variant="ghost" size="sm" onClick={clearScope}>Reset</StandardButton>
        </div>
      </div>

      <div data-tour="waivers-filter-btns">
        <AdminTableToolbar
          table={table}
          searchPlaceholder="Search waivers by name, email, phone, minor, reference…"
          onRefresh={load}
          actions={
            <StandardButton variant="secondary" size="sm" icon={Download} onClick={handleExport}>Export</StandardButton>
          }
        />
      </div>

      <div data-tour="waivers-table">
        <AdminDataTable
          table={table}
          loading={loading}
          itemLabel="waivers"
          onRowClick={openDetail}
          emptyState={
            <div className="flex flex-col items-center">
              <ShieldCheck className="w-10 h-10 text-gray-300 mb-3" />
              <p className="text-gray-500">No waivers found for this filter.</p>
            </div>
          }
          renderActions={(w) => (
            <div data-tour="waivers-row-actions" className="flex items-center justify-end gap-1">
              {w.status === 'completed' && !w.checked_in_at && (
                <button onClick={() => handleCheckIn(w)} className="px-2 py-1 inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-100 hover:bg-emerald-100 rounded-lg transition-colors" title="Check in">
                  <UserCheck className="w-3.5 h-3.5" />Check In
                </button>
              )}
              <button onClick={() => handlePrint(w)} className={`p-2 text-gray-400 hover:text-${themeColor}-600 hover:bg-${themeColor}-50 rounded-lg transition-colors`} title="Print"><Printer className="w-4 h-4" /></button>
              {isAdmin && (
                <button onClick={() => setDeleteTarget(w)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete"><Trash2 className="w-4 h-4" /></button>
              )}
            </div>
          )}
        />
      </div>

      {detailLoading && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className={`animate-spin rounded-full h-10 w-10 border-b-2 border-${fullColor}`} />
        </div>
      )}

      {detail && (
        <WaiverDetailModal
          data={detail}
          onClose={() => setDetail(null)}
          onCheckIn={async (w) => { await handleCheckIn(w); openDetail(w); }}
          onUndoCheckIn={async (w) => { await handleUndoCheckIn(w); openDetail(w); }}
        />
      )}
      {showAssign && <AssignWaiverModal onClose={() => setShowAssign(false)} onSaved={() => { setShowAssign(false); load(); setToast({ message: 'Waiver assigned & link sent', type: 'success' }); }} themeColor={themeColor} />}
      {deleteTarget && <DeleteWaiverModal waiver={deleteTarget} onCancel={() => setDeleteTarget(null)} onConfirm={confirmDelete} />}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};

/* ---------- Detail modal ---------- */
const consentPill = (ok: boolean, yes = 'Yes', no = 'No') => (
  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${ok ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{ok ? yes : no}</span>
);

const DetailField = ({ label, value }: { label: string; value: ReactNode }) => (
  <div>
    <div className="text-xs text-gray-400 uppercase tracking-wide">{label}</div>
    <div className="text-sm text-gray-900 font-medium mt-0.5 break-words">{value ?? '—'}</div>
  </div>
);

const DetailSection = ({ icon: Icon, title, children }: { icon: ComponentType<{ className?: string }>; title: string; children: ReactNode }) => (
  <div>
    <h3 className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 pb-1.5 border-b border-gray-100">
      <Icon className="w-3.5 h-3.5" /> {title}
    </h3>
    {children}
  </div>
);

const WaiverDetailModal = ({ data, onClose, onCheckIn, onUndoCheckIn }: {
  data: { waiver: Waiver; rendered_body: string };
  onClose: () => void;
  onCheckIn: (w: Waiver) => Promise<void>;
  onUndoCheckIn: (w: Waiver) => Promise<void>;
}) => {
  const w = data.waiver;
  const [checkInBusy, setCheckInBusy] = useState(false);
  const runCheckInAction = async (action: (w: Waiver) => Promise<void>) => {
    setCheckInBusy(true);
    try {
      await action(w);
    } finally {
      setCheckInBusy(false);
    }
  };
  const fullName = [w.adult_first_name, w.adult_last_name].filter(Boolean).join(' ') || 'Waiver';
  const linked = linkedLabel(w);
  const statusStyle: Record<string, string> = {
    completed: 'bg-green-100 text-green-700',
    pending: 'bg-amber-100 text-amber-700',
    expired: 'bg-red-100 text-red-700',
    voided: 'bg-gray-200 text-gray-600',
  };
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-gray-100 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-bold text-gray-900 truncate">{fullName}</h2>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${statusStyle[w.status] || 'bg-gray-100 text-gray-600'}`}>{w.status.charAt(0).toUpperCase() + w.status.slice(1)}</span>
              {w.checked_in_at ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700"><UserCheck className="w-3 h-3" />Checked In</span>
              ) : (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-500">Not Checked In</span>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-0.5">{w.template?.title || 'Liability Waiver'} · Waiver #{w.id}</p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg shrink-0"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 overflow-y-auto space-y-6">
          <DetailSection icon={Users} title="Participant / Guardian">
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              <DetailField label="Full name" value={fullName} />
              <DetailField label="Date of birth" value={formatDateLong(w.adult_dob)} />
              <DetailField label="Email" value={w.adult_email} />
              <DetailField label="Phone" value={w.adult_phone} />
            </div>
          </DetailSection>

          <DetailSection icon={Link2} title="Visit details">
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              <DetailField label="Location" value={w.location?.name} />
              <DetailField label="Visit date" value={formatDateLong(w.selected_date)} />
              <DetailField label="Linked to" value={linked || 'Walk-in'} />
              <DetailField label="Source" value={sourceLabels[w.source] || w.source} />
              <DetailField label="Submitted" value={formatDateTimeET(w.submitted_at)} />
              <DetailField label="Checked in" value={w.checked_in_at ? formatDateTimeET(w.checked_in_at) : 'Not checked in'} />
            </div>
          </DetailSection>

          {w.minors && w.minors.length > 0 && (
            <DetailSection icon={Users} title={`Minor Participants (${w.minors.length})`}>
              <div className="border border-gray-100 rounded-lg divide-y divide-gray-50">
                {w.minors.map((m, i) => (
                  <div key={i} className="px-3 py-2 flex items-center justify-between text-sm gap-2">
                    <span className="text-gray-900 font-medium">{[m.first_name, m.last_name].filter(Boolean).join(' ')}</span>
                    <span className="text-gray-500 text-right">{[m.date_of_birth ? formatDateLong(m.date_of_birth) : null, m.relationship].filter(Boolean).join(' · ') || '—'}</span>
                  </div>
                ))}
              </div>
            </DetailSection>
          )}

          <DetailSection icon={FileText} title="Waiver Agreement">
            <div className="border border-gray-100 rounded-lg overflow-hidden">
              <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50/60 flex items-center justify-between">
                <span className="text-xs font-bold text-gray-900">{w.template?.title || 'Waiver Agreement'}</span>
                {w.version?.version != null && (
                  <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">v{w.version.version}</span>
                )}
              </div>
              <div
                className="px-4 py-3 h-64 overflow-y-auto text-sm text-gray-700 leading-relaxed whitespace-pre-wrap break-words"
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(data.rendered_body) }}
              />
            </div>
          </DetailSection>

          <DetailSection icon={ShieldCheck} title="Acknowledgment & Signature">
            <div className="bg-gray-50 border border-gray-100 rounded-lg p-4 space-y-2.5">
              <div className="flex items-center justify-between text-sm"><span className="text-gray-600">Agreement accepted</span>{consentPill(!!w.agreement_accepted)}</div>
              <div className="flex items-center justify-between text-sm"><span className="text-gray-600">Electronic consent</span>{consentPill(!!w.electronic_consent_accepted)}</div>
              {w.photo_video_consent !== null && w.photo_video_consent !== undefined && (
                <div className="flex items-center justify-between text-sm"><span className="text-gray-600">Photo / video release</span>{consentPill(!!w.photo_video_consent, 'Agreed', 'Declined')}</div>
              )}
              <div className="flex items-center justify-between text-sm"><span className="text-gray-600">Marketing consent</span><span className="text-gray-900 font-medium">{w.marketing_consent_status === 'opted_in' ? 'Opted in' : 'Not opted in'}</span></div>
              <div className="pt-2.5 mt-1 border-t border-gray-200">
                <div className="text-xs text-gray-400 uppercase tracking-wide">Signed electronically by</div>
                <div className="text-base font-semibold text-gray-900 mt-0.5" style={{ fontFamily: 'Georgia, serif' }}>{w.typed_legal_name || '—'}</div>
                <div className="text-xs text-gray-500 mt-0.5">{formatDateTimeET(w.submitted_at)}</div>
              </div>
            </div>
          </DetailSection>
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
          {w.checked_in_at && (
            <StandardButton variant="secondary" icon={Undo2} disabled={checkInBusy} onClick={() => runCheckInAction(onUndoCheckIn)}>Undo Check-In</StandardButton>
          )}
          <StandardButton variant="secondary" onClick={onClose}>Close</StandardButton>
          <StandardButton variant="secondary" icon={Printer} onClick={async () => { try { const blob = await waiverService.print(w.id); const url = URL.createObjectURL(blob); window.open(url, '_blank'); } catch { /* noop */ } }}>Print</StandardButton>
          {w.status === 'completed' && !w.checked_in_at && (
            <StandardButton variant="primary" icon={UserCheck} disabled={checkInBusy} onClick={() => runCheckInAction(onCheckIn)}>Check In</StandardButton>
          )}
        </div>
      </div>
    </div>
  );
};

/* ---------- Assign modal ---------- */
type LinkType = 'booking' | 'attraction_purchase' | 'event_purchase';
type LinkResult =
  | { kind: 'booking'; data: Booking }
  | { kind: 'attraction_purchase'; data: AttractionPurchase }
  | { kind: 'event_purchase'; data: EventPurchase };

const LINK_TABS: Array<{ type: LinkType; label: string; pill: string }> = [
  { type: 'booking', label: 'Booking', pill: 'bg-blue-100 text-blue-700' },
  { type: 'attraction_purchase', label: 'Attraction', pill: 'bg-violet-100 text-violet-700' },
  { type: 'event_purchase', label: 'Event', pill: 'bg-amber-100 text-amber-700' },
];

interface ActivityOption { key: string; type: ActivityType; id: number; name: string }

const AssignWaiverModal = ({ onClose, onSaved, themeColor }: { onClose: () => void; onSaved: () => void; themeColor: string }) => {
  const [templates, setTemplates] = useState<WaiverTemplate[]>([]);
  const [form, setForm] = useState({ waiver_template_id: 0, selected_date: todayStr(), adult_email: '', adult_phone: '' });
  const [activityOptions, setActivityOptions] = useState<ActivityOption[]>([]);
  const [activityKey, setActivityKey] = useState('');
  const [loadingActivities, setLoadingActivities] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [linkTab, setLinkTab] = useState<LinkType>('booking');
  const [linkQuery, setLinkQuery] = useState('');
  const [linkResults, setLinkResults] = useState<LinkResult[]>([]);
  const [linkSearching, setLinkSearching] = useState(false);
  const [selected, setSelected] = useState<LinkResult | null>(null);
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

  const runSearch = useCallback((tab: LinkType, q: string) => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!q.trim()) { setLinkResults([]); return; }
    searchTimer.current = setTimeout(async () => {
      setLinkSearching(true);
      try {
        if (tab === 'booking') {
          const res = await bookingService.searchBookings(q);
          const rows: LinkResult[] = (res.success ? res.data : []).slice(0, 8).map((d) => ({ kind: 'booking', data: d }));
          setLinkResults(rows);
        } else if (tab === 'attraction_purchase') {
          const res = await attractionPurchaseService.getPurchases({ search: q, per_page: 8 });
          const rows: LinkResult[] = (res.success ? res.data.purchases ?? [] : []).map((d) => ({ kind: 'attraction_purchase', data: d }));
          setLinkResults(rows);
        } else {
          const res = await eventPurchaseService.getPurchases({ search: q, per_page: 8 });
          const rows: LinkResult[] = (res.success ? res.data ?? [] : []).map((d) => ({ kind: 'event_purchase', data: d }));
          setLinkResults(rows);
        }
      } catch {
        setLinkResults([]);
      } finally {
        setLinkSearching(false);
      }
    }, 350);
  }, []);

  const handleQueryChange = (q: string) => {
    setLinkQuery(q);
    setSelected(null);
    runSearch(linkTab, q);
  };

  const handleTabChange = (tab: LinkType) => {
    setLinkTab(tab);
    setLinkQuery('');
    setLinkResults([]);
    setSelected(null);
  };

  const selectResult = (r: LinkResult) => {
    setSelected(r);
    setLinkResults([]);
    let date = '';
    if (r.kind === 'booking') date = r.data.booking_date || '';
    else if (r.kind === 'attraction_purchase') date = r.data.purchase_date || '';
    else date = r.data.purchase_date || '';
    if (date) setForm((f) => ({ ...f, selected_date: date }));
  };

  const clearSelected = () => { setSelected(null); setLinkQuery(''); setLinkResults([]); };

  const resultLabel = (r: LinkResult): { name: string; sub: string } => {
    if (r.kind === 'booking') {
      return {
        name: r.data.guest_name || r.data.guest_email || '—',
        sub: `${r.data.reference_number} · ${r.data.booking_date}${r.data.package?.name ? ` · ${r.data.package.name}` : ''}`,
      };
    }
    if (r.kind === 'attraction_purchase') {
      return {
        name: r.data.guest_name || r.data.guest_email || '—',
        sub: `#${r.data.id} · ${r.data.purchase_date}${r.data.attraction?.name ? ` · ${r.data.attraction.name}` : ''}`,
      };
    }
    return {
      name: r.data.guest_name || r.data.guest_email || '—',
      sub: `${r.data.reference_number} · ${r.data.purchase_date}${r.data.event?.name ? ` · ${r.data.event.name}` : ''}`,
    };
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
        booking_id: selected?.kind === 'booking' ? selected.data.id : undefined,
        attraction_purchase_id: selected?.kind === 'attraction_purchase' ? selected.data.id : undefined,
        event_id: selected?.kind === 'event_purchase' ? selected.data.event_id : (chosen?.type === 'event' ? chosen.id : undefined),
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
  const activeTab = LINK_TABS.find((t) => t.type === linkTab)!;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
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
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Link to purchase <span className="text-gray-400 font-normal">(optional — ties this waiver to a specific transaction)</span>
            </label>
            <div className="flex gap-1.5 mb-2.5 mt-1.5">
              {LINK_TABS.map((tab) => (
                <button
                  key={tab.type}
                  type="button"
                  onClick={() => handleTabChange(tab.type)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${linkTab === tab.type ? tab.pill : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            {selected ? (
              <div className={`flex items-center justify-between px-3 py-2.5 rounded-lg bg-${themeColor}-50 border border-${themeColor}-200`}>
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold flex-shrink-0 ${activeTab.pill}`}>{activeTab.label}</span>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">{resultLabel(selected).name}</div>
                    <div className="text-xs text-gray-400 truncate">{resultLabel(selected).sub}</div>
                  </div>
                </div>
                <button type="button" onClick={clearSelected} className="text-gray-400 hover:text-gray-600 ml-3 flex-shrink-0">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={linkQuery}
                  onChange={(e) => handleQueryChange(e.target.value)}
                  placeholder={`Search ${activeTab.label.toLowerCase()} by ref # or guest name…`}
                  className={`${fieldCls} pl-9`}
                />
                {linkSearching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin" />}
              </div>
            )}
            {!selected && linkResults.length > 0 && (
              <div className="mt-1.5 border border-gray-200 rounded-lg overflow-hidden divide-y divide-gray-100 max-h-48 overflow-y-auto">
                {linkResults.map((r, i) => {
                  const lbl = resultLabel(r);
                  const tab = LINK_TABS.find((t) => t.type === r.kind)!;
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => selectResult(r)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 text-left transition-colors"
                    >
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold flex-shrink-0 ${tab.pill}`}>{tab.label}</span>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-gray-900 truncate">{lbl.name}</div>
                        <div className="text-xs text-gray-400 truncate">{lbl.sub}</div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Visit date *</label>
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
