import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CalendarX2,
  CheckCircle2,
  Download,
  Inbox,
  Mail,
  Phone,
  PhoneCall,
  ShoppingCart,
  Undo2,
} from 'lucide-react';
import { useLocationScope } from '../../../contexts/LocationContext';
import { useThemeColor } from '../../../hooks/useThemeColor';
import checkoutConcernService, {
  type CheckoutConcern,
  type CheckoutConcernStats,
  type ConcernKind,
  type ConcernStatus,
} from '../../../services/CheckoutConcernService';
import {
  AdminDataTable,
  AdminTableToolbar,
  useAdminTable,
  exportTableCsv,
} from '../../../components/admin/table';
import type { AdminColumn, AdminFilterDef } from '../../../components/admin/table';
import StandardButton from '../../../components/ui/StandardButton';
import CounterAnimation from '../../../components/ui/CounterAnimation';
import Toast from '../../../components/ui/Toast';

const MAX_LOADED_CONCERNS = 3000;

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

const CustomerConcerns = () => {
  const { effectiveLocationId } = useLocationScope();
  const { themeColor } = useThemeColor();

  const [concerns, setConcerns] = useState<CheckoutConcern[]>([]);
  const [stats, setStats] = useState<CheckoutConcernStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const loadSeq = useRef(0);
  const defaultApplied = useRef(false);

  const loadConcerns = useCallback(async () => {
    const seq = ++loadSeq.current;
    setLoading(true);
    try {
      const all: CheckoutConcern[] = [];
      let page = 1;
      let lastPage = 1;
      do {
        const result = await checkoutConcernService.list({
          location_id: effectiveLocationId ?? undefined,
          page,
          per_page: 100,
        });
        if (seq !== loadSeq.current) return;
        all.push(...result.concerns);
        lastPage = result.pagination.last_page;
        page += 1;
      } while (page <= lastPage && all.length < MAX_LOADED_CONCERNS);

      setConcerns(all.slice(0, MAX_LOADED_CONCERNS));
    } catch {
      if (seq === loadSeq.current) {
        setToast({ message: 'Could not load customer concerns — you may not have permission.', type: 'error' });
      }
    } finally {
      if (seq === loadSeq.current) setLoading(false);
    }
  }, [effectiveLocationId]);

  const loadStats = useCallback(() => {
    checkoutConcernService
      .statistics(effectiveLocationId ?? undefined)
      .then(setStats)
      .catch(() => setStats(null));
  }, [effectiveLocationId]);

  useEffect(() => {
    loadConcerns();
    loadStats();
  }, [loadConcerns, loadStats]);

  const setConcernStatus = async (concern: CheckoutConcern, next: ConcernStatus) => {
    try {
      setSavingId(concern.id);
      const updated = await checkoutConcernService.updateStatus(concern.id, next);
      setConcerns(prev => prev.map(row => (row.id === updated.id ? updated : row)));
      setToast({
        message: next === 'resolved' ? 'Marked resolved.' : next === 'contacted' ? 'Marked as contacted.' : 'Reopened.',
        type: 'success',
      });
      loadStats();
    } catch {
      setToast({ message: 'That did not save. Please try again.', type: 'error' });
    } finally {
      setSavingId(null);
    }
  };

  const columns: AdminColumn<CheckoutConcern>[] = useMemo(
    () => [
      {
        key: 'guest',
        label: 'Guest',
        sortable: true,
        sortValue: c => (c.name || '').toLowerCase(),
        exportValue: c => c.name,
        render: c => (
          <div>
            <div className="font-semibold text-gray-900">{c.name}</div>
            {c.location?.name && <div className="text-xs text-gray-400 mt-0.5">{c.location.name}</div>}
          </div>
        ),
      },
      {
        key: 'contact',
        label: 'Reach them on',
        sortValue: c => c.phone || '',
        exportValue: c => [c.phone, c.email].filter(Boolean).join(' / '),
        cellClassName: 'whitespace-nowrap',
        render: c => (
          <div className="space-y-0.5">
            {c.phone && (
              <a
                href={`tel:${c.phone}`}
                className={`text-sm font-medium text-${themeColor}-700 hover:underline inline-flex items-center gap-1`}
              >
                <Phone size={12} />
                {c.phone}
              </a>
            )}
            {c.email && (
              <a
                href={`mailto:${c.email}`}
                className="text-xs text-gray-500 hover:underline flex items-center gap-1"
              >
                <Mail size={11} />
                {c.email}
              </a>
            )}
          </div>
        ),
      },
      {
        key: 'wanted',
        label: 'What they wanted',
        sortValue: c => c.entity_name || '',
        exportValue: c => formatWhen(c),
        render: c => (
          <div>
            <p className="text-sm text-gray-800">{formatWhen(c)}</p>
            {c.context?.step_label && <p className="text-xs text-gray-400 mt-0.5">Reached: {c.context.step_label}</p>}
          </div>
        ),
      },
      {
        key: 'why',
        label: 'Why',
        sortable: true,
        sortValue: c => c.kind,
        exportValue: c => {
          const badge = KIND_BADGES[c.kind] ?? KIND_BADGES.schedule_help;
          return c.message ? `${badge.label}: ${c.message}` : badge.label;
        },
        render: c => {
          const badge = KIND_BADGES[c.kind] ?? KIND_BADGES.schedule_help;
          return (
            <div className="max-w-xs">
              <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${badge.className}`}>
                {c.kind === 'schedule_help' ? <CalendarX2 size={11} /> : c.kind === 'call_to_book' ? <Phone size={11} /> : <ShoppingCart size={11} />}
                {badge.label}
              </span>
              {c.message && <p className="text-xs text-gray-600 mt-1.5 leading-relaxed">“{c.message}”</p>}
            </div>
          );
        },
      },
      {
        key: 'status',
        label: 'Status',
        sortable: true,
        sortValue: c => c.status,
        exportValue: c => STATUS_LABELS[c.status] ?? c.status,
        render: c => (
          <div>
            <span className={`inline-flex text-[11px] font-semibold px-2 py-0.5 rounded-full border ${STATUS_STYLES[c.status] ?? STATUS_STYLES.new}`}>
              {STATUS_LABELS[c.status] ?? c.status}
            </span>
            {c.handler && (
              <p className="text-xs text-gray-400 mt-1">
                by {c.handler.first_name} {c.handler.last_name}
              </p>
            )}
          </div>
        ),
      },
      {
        key: 'when',
        label: 'When',
        sortable: true,
        sortValue: c => c.created_at,
        exportValue: c => new Date(c.created_at).toLocaleString(),
        cellClassName: 'whitespace-nowrap',
        render: c => <span className="text-sm text-gray-600">{new Date(c.created_at).toLocaleString()}</span>,
      },
    ],
    [themeColor],
  );

  const filterDefs: AdminFilterDef<CheckoutConcern>[] = useMemo(
    () => [
      {
        type: 'select',
        key: 'status',
        label: 'Status',
        allLabel: 'All statuses',
        options: [
          { value: 'new', label: 'Needs a call' },
          { value: 'contacted', label: 'Contacted' },
          { value: 'resolved', label: 'Resolved' },
        ],
        predicate: (c, value) => c.status === value,
      },
      {
        type: 'select',
        key: 'kind',
        label: 'Kind',
        allLabel: 'Everything',
        options: [
          { value: 'schedule_help', label: 'Schedule help' },
          { value: 'call_to_book', label: 'Call to book' },
          { value: 'abandoned_checkout', label: 'Left unfinished' },
        ],
        predicate: (c, value) => c.kind === value,
      },
      {
        type: 'daterange',
        key: 'created',
        label: 'Received Date',
        getDate: c => c.created_at,
      },
    ],
    [],
  );

  const table = useAdminTable<CheckoutConcern>({
    data: concerns,
    columns,
    getRowId: c => String(c.id),
    storageKey: 'customer_concerns',
    filterDefs,
    searchFields: c => [c.name, c.phone, c.email, c.entity_name, c.message, c.location?.name],
    defaultSort: (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime(),
    itemsPerPage: 10,
  });

  useEffect(() => {
    if (defaultApplied.current) return;
    defaultApplied.current = true;
    table.setFilterValue('status', 'new');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const exportToCSV = () => {
    if (!table.filteredRows.length) {
      setToast({ message: 'Nothing to export for these filters.', type: 'error' });
      return;
    }
    exportTableCsv({
      filename: `customer-concerns-export-${new Date().toISOString().split('T')[0]}.csv`,
      columns,
      rows: table.filteredRows,
    });
  };

  const metrics = [
    { title: 'Waiting on a Call', value: stats?.open ?? 0, change: 'Open concerns', icon: PhoneCall, accentColor: 'amber' },
    { title: 'Schedule Help', value: stats?.schedule_help ?? 0, change: 'Calendar did not work', icon: CalendarX2, accentColor: 'blue' },
    { title: 'Call to Book', value: stats?.call_to_book ?? 0, change: 'No online schedule', icon: Phone, accentColor: 'teal' },
    { title: 'Left Unfinished', value: stats?.abandoned_checkout ?? 0, change: 'Closed checkout mid-way', icon: ShoppingCart, accentColor: 'purple' },
    { title: 'Today', value: stats?.today ?? 0, change: 'Received today', icon: Inbox, accentColor: 'emerald' },
  ];

  return (
    <div className="px-6 py-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Customer Concerns</h1>
          <p className="text-gray-600 mt-1">
            Guests who asked for schedule help, want to book by phone, or left checkout with their details filled in
          </p>
        </div>
        <div className="flex gap-2 mt-4 sm:mt-0 flex-wrap">
          <StandardButton variant="secondary" size="md" onClick={exportToCSV} icon={Download}>
            Export CSV
          </StandardButton>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
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

      <AdminTableToolbar
        table={table}
        searchPlaceholder="Search by name, phone, email, item or message..."
        onRefresh={() => {
          loadConcerns();
          loadStats();
        }}
      />

      <AdminDataTable
        table={table}
        loading={loading && concerns.length === 0}
        itemLabel="concerns"
        emptyState={
          <div className="flex flex-col items-center justify-center">
            <div className={`inline-flex p-4 rounded-full bg-${themeColor}-50 mb-4`}>
              <Inbox className={`h-12 w-12 text-${themeColor}-400`} />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Nothing here</h3>
            <p className="text-gray-500 text-sm">
              {table.searchInput || table.activeFilterCount > 0
                ? 'Try adjusting your search or filters'
                : 'No guest is waiting on a call'}
            </p>
          </div>
        }
        renderActions={concern => (
          <div className="flex items-center gap-1">
            {concern.status !== 'contacted' && concern.status !== 'resolved' && (
              <StandardButton
                variant="secondary"
                size="sm"
                icon={PhoneCall}
                disabled={savingId === concern.id}
                onClick={() => setConcernStatus(concern, 'contacted')}
              >
                Mark contacted
              </StandardButton>
            )}
            {concern.status !== 'resolved' && (
              <StandardButton
                variant="primary"
                size="sm"
                icon={CheckCircle2}
                disabled={savingId === concern.id}
                onClick={() => setConcernStatus(concern, 'resolved')}
              >
                Resolve
              </StandardButton>
            )}
            {concern.status === 'resolved' && (
              <StandardButton
                variant="secondary"
                size="sm"
                icon={Undo2}
                disabled={savingId === concern.id}
                onClick={() => setConcernStatus(concern, 'new')}
              >
                Reopen
              </StandardButton>
            )}
          </div>
        )}
      />

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};

export default CustomerConcerns;
