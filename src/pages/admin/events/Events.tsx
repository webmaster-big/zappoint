import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Pencil,
  Trash2,
  Calendar,
  Zap,
  Star,
  DollarSign,
  Download,
} from 'lucide-react';
import { useThemeColor } from '../../../hooks/useThemeColor';
import StandardButton from '../../../components/ui/StandardButton';
import CounterAnimation from '../../../components/ui/CounterAnimation';
import Toast from '../../../components/ui/Toast';
import { eventService } from '../../../services/EventService';
import { eventCacheService } from '../../../services/EventCacheService';
import { useLocationScope } from '../../../contexts/LocationContext';
import { getStoredUser } from '../../../utils/storage';
import type { Event } from '../../../types/event.types';
import {
  AdminDataTable,
  AdminTableToolbar,
  BulkActionsBar,
  exportTableCsv,
  useAdminTable,
} from '../../../components/admin/table';
import type { AdminColumn, AdminFilterDef } from '../../../components/admin/table';

const localToday = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const scheduleState = (event: Event): 'upcoming' | 'ongoing' | 'past' => {
  const today = localToday();
  const start = (event.start_date || '').substring(0, 10);
  const end = (event.end_date || event.start_date || '').substring(0, 10);
  if (start > today) return 'upcoming';
  if (end < today) return 'past';
  return 'ongoing';
};

const formatDate = (date: string) => {
  return new Date(date.substring(0, 10) + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const formatTime = (time: string) => {
  const [h, m] = time.split(':');
  const hour = parseInt(h);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  return `${hour % 12 || 12}:${m} ${ampm}`;
};

const formatDateTime = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const Events = () => {
  const { themeColor, fullColor } = useThemeColor();
  const navigate = useNavigate();
  const currentUser = getStoredUser();
  const { effectiveLocationId } = useLocationScope();
  const selectedLocation = effectiveLocationId;

  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    fetchEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLocation]);

  const fetchEvents = async (forceRefresh = false) => {
    setLoading(true);
    try {
      const cached = !forceRefresh ? await eventCacheService.getCachedEvents() : null;
      if (cached && cached.length > 0) {
        let list = cached;
        if (selectedLocation) list = list.filter(e => e.location_id === selectedLocation);
        setEvents(list);
        setLoading(false);
        eventCacheService.syncInBackground({ user_id: currentUser?.id });
        return;
      }

      const filters: Record<string, unknown> = {};
      if (selectedLocation) filters.location_id = selectedLocation;
      const res = await eventService.getEvents(filters);
      let list: Event[] = [];
      if (Array.isArray(res.data)) {
        list = res.data;
      } else if (res.data && typeof res.data === 'object') {
        const obj = res.data as Record<string, unknown>;
        if (Array.isArray(obj.events)) list = obj.events as Event[];
        else if (Array.isArray(obj.data)) list = obj.data as Event[];
      }
      if (list.length === 0 && Array.isArray(res)) {
        list = res as unknown as Event[];
      }
      setEvents(list);
      await eventCacheService.cacheEvents(list);
    } catch (err: unknown) {
      setToast({ message: (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to load events', type: 'error' });
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (id: number, newStatus: string) => {
    try {
      await eventService.toggleStatus(id);
      const isActive = newStatus === 'active';
      setEvents(prev => {
        const updated = prev.map(e => e.id === id ? { ...e, is_active: isActive } : e);
        const found = updated.find(e => e.id === id);
        if (found) eventCacheService.updateEventInCache(found);
        return updated;
      });
      setToast({ message: 'Event status updated', type: 'success' });
    } catch (err: unknown) {
      setToast({ message: (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to update status', type: 'error' });
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this event?')) return;
    setDeletingId(id);
    try {
      await eventService.deleteEvent(id);
      setEvents(prev => prev.filter(e => e.id !== id));
      await eventCacheService.removeEventFromCache(id);
      setToast({ message: 'Event deleted', type: 'success' });
    } catch (err: unknown) {
      setToast({ message: (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to delete event', type: 'error' });
    } finally {
      setDeletingId(null);
    }
  };

  const statusColors: Record<string, string> = {
    active: `bg-${themeColor}-100 text-${fullColor}`,
    inactive: 'bg-gray-100 text-gray-800',
  };

  const columns: AdminColumn<Event>[] = [
    {
      key: 'id',
      label: 'Event #',
      group: 'Identifiers',
      sortable: true,
      sortValue: e => e.id,
      exportValue: e => e.id,
      defaultVisible: false,
      render: e => <span className="text-sm text-gray-900">#{e.id}</span>,
    },
    {
      key: 'event',
      label: 'Event',
      group: 'Event',
      sortable: true,
      sortValue: e => e.name,
      exportValue: e => e.name,
      render: e => (
        <div>
          <div className="font-medium text-gray-900">{e.name}</div>
          <div className="text-xs text-gray-600 mt-1">{e.location?.name || '—'}</div>
          <div className="text-xs text-gray-500 mt-1">
            {e.date_type === 'one_time' ? 'One Time' : 'Date Range'}
          </div>
        </div>
      ),
    },
    {
      key: 'location',
      label: 'Location',
      group: 'Event',
      sortable: true,
      sortValue: e => e.location?.name || '',
      exportValue: e => e.location?.name || '',
      defaultVisible: false,
      render: e => <span className="whitespace-nowrap text-sm text-gray-900">{e.location?.name || '—'}</span>,
    },
    {
      key: 'description',
      label: 'Description',
      group: 'Event',
      sortable: true,
      sortValue: e => e.description || '',
      exportValue: e => e.description || '',
      defaultVisible: false,
      render: e => e.description
        ? <span className="text-sm text-gray-600 block max-w-xs truncate">{e.description}</span>
        : <span className="text-gray-300">—</span>,
    },
    {
      key: 'dateType',
      label: 'Date Type',
      group: 'Schedule',
      sortable: true,
      sortValue: e => e.date_type,
      exportValue: e => (e.date_type === 'one_time' ? 'One Time' : 'Date Range'),
      defaultVisible: false,
      render: e => (
        <span className="whitespace-nowrap text-sm text-gray-900">
          {e.date_type === 'one_time' ? 'One Time' : 'Date Range'}
        </span>
      ),
    },
    {
      key: 'date',
      label: 'Date',
      group: 'Schedule',
      sortable: true,
      sortValue: e => (e.start_date || '').substring(0, 10),
      exportValue: e => e.date_type === 'one_time' || !e.end_date
        ? formatDate(e.start_date)
        : `${formatDate(e.start_date)} – ${formatDate(e.end_date)}`,
      render: e => (
        <span className="whitespace-nowrap text-sm text-gray-900">
          {e.date_type === 'one_time' ? (
            formatDate(e.start_date)
          ) : (
            <span>{formatDate(e.start_date)} – {formatDate(e.end_date!)}</span>
          )}
        </span>
      ),
    },
    {
      key: 'time',
      label: 'Time',
      group: 'Schedule',
      sortable: true,
      sortValue: e => e.time_start,
      exportValue: e => `${formatTime(e.time_start)} – ${formatTime(e.time_end)}`,
      render: e => (
        <span className="whitespace-nowrap text-sm text-gray-900">
          {formatTime(e.time_start)} – {formatTime(e.time_end)}
        </span>
      ),
    },
    {
      key: 'schedule',
      label: 'Schedule',
      group: 'Schedule',
      sortable: true,
      sortValue: e => scheduleState(e),
      exportValue: e => scheduleState(e),
      defaultVisible: false,
      render: e => <span className="capitalize whitespace-nowrap text-sm text-gray-900">{scheduleState(e)}</span>,
    },
    {
      key: 'interval',
      label: 'Slot Interval',
      group: 'Schedule',
      sortable: true,
      sortValue: e => e.interval_minutes,
      exportValue: e => e.interval_minutes,
      defaultVisible: false,
      render: e => <span className="whitespace-nowrap text-sm text-gray-900">{e.interval_minutes} min</span>,
    },
    {
      key: 'maxPerSlot',
      label: 'Max Per Slot',
      group: 'Schedule',
      sortable: true,
      sortValue: e => e.max_bookings_per_slot ?? 0,
      exportValue: e => e.max_bookings_per_slot ?? '',
      defaultVisible: false,
      render: e => (
        <span className="whitespace-nowrap text-sm text-gray-900">
          {e.max_bookings_per_slot ?? '—'}
        </span>
      ),
    },
    {
      key: 'price',
      label: 'Price',
      group: 'Pricing',
      sortable: true,
      sortValue: e => parseFloat(e.price) || 0,
      exportValue: e => (parseFloat(e.price) || 0).toFixed(2),
      render: e => (
        <span className="whitespace-nowrap text-sm text-gray-900">
          ${parseFloat(e.price).toFixed(2)}
        </span>
      ),
    },
    {
      key: 'addOns',
      label: 'Add-ons',
      group: 'Pricing',
      sortable: true,
      sortValue: e => e.add_ons?.length ?? 0,
      exportValue: e => (e.add_ons || []).map(a => a.name).join('; '),
      defaultVisible: false,
      render: e => (
        <span className="whitespace-nowrap text-sm text-gray-900">
          {(e.add_ons?.length ?? 0) > 0 ? `${e.add_ons!.length} add-on(s)` : '—'}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      group: 'Status',
      sortable: true,
      sortValue: e => (e.is_active ? 'active' : 'inactive'),
      exportValue: e => (e.is_active ? 'Active' : 'Inactive'),
      render: e => (
        <select
          value={e.is_active ? 'active' : 'inactive'}
          onChange={(ev) => handleToggleStatus(e.id, ev.target.value)}
          className={`text-xs font-medium px-3 py-1 rounded-full ${statusColors[e.is_active ? 'active' : 'inactive']} border-none focus:ring-2 focus:ring-${themeColor}-400`}
        >
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      ),
    },
    {
      key: 'created',
      label: 'Created',
      group: 'Dates',
      sortable: true,
      sortValue: e => new Date(e.created_at || 0).getTime(),
      exportValue: e => (e.created_at ? new Date(e.created_at).toLocaleString() : ''),
      defaultVisible: false,
      render: e => (
        <span className="whitespace-nowrap text-sm text-gray-500">
          {e.created_at ? formatDateTime(e.created_at) : '—'}
        </span>
      ),
    },
    {
      key: 'updated',
      label: 'Updated',
      group: 'Dates',
      sortable: true,
      sortValue: e => new Date(e.updated_at || 0).getTime(),
      exportValue: e => (e.updated_at ? new Date(e.updated_at).toLocaleString() : ''),
      defaultVisible: false,
      render: e => (
        <span className="whitespace-nowrap text-sm text-gray-500">
          {e.updated_at ? formatDateTime(e.updated_at) : '—'}
        </span>
      ),
    },
  ];

  const filterDefs = useMemo<AdminFilterDef<Event>[]>(() => [
    {
      type: 'select',
      key: 'status',
      label: 'Status',
      allLabel: 'All Statuses',
      options: [
        { value: 'active', label: 'Active' },
        { value: 'inactive', label: 'Inactive' },
      ],
      predicate: (e, value) => (value === 'active' ? e.is_active : !e.is_active),
    },
    {
      type: 'select',
      key: 'dateType',
      label: 'Date Type',
      allLabel: 'All Types',
      options: [
        { value: 'one_time', label: 'One Time' },
        { value: 'date_range', label: 'Date Range' },
      ],
      predicate: (e, value) => e.date_type === value,
    },
    {
      type: 'select',
      key: 'schedule',
      label: 'Schedule',
      allLabel: 'All Schedules',
      options: [
        { value: 'upcoming', label: 'Upcoming' },
        { value: 'ongoing', label: 'Ongoing' },
        { value: 'past', label: 'Past' },
      ],
      predicate: (e, value) => scheduleState(e) === value,
    },
    {
      type: 'daterange',
      key: 'startDate',
      label: 'Event Start Date',
      getDate: e => e.start_date,
    },
    {
      type: 'daterange',
      key: 'createdDate',
      label: 'Created Date',
      getDate: e => e.created_at,
    },
    {
      type: 'numberrange',
      key: 'price',
      label: 'Price ($)',
      getValue: e => parseFloat(e.price) || 0,
    },
    {
      type: 'select',
      key: 'addOns',
      label: 'Add-ons',
      allLabel: 'All Events',
      options: [
        { value: 'with', label: 'With Add-ons' },
        { value: 'without', label: 'Without Add-ons' },
      ],
      predicate: (e, value) =>
        value === 'with' ? (e.add_ons?.length ?? 0) > 0 : (e.add_ons?.length ?? 0) === 0,
    },
    {
      type: 'select',
      key: 'timeOfDay',
      label: 'Time of Day',
      allLabel: 'All Times',
      options: [
        { value: 'morning', label: 'Morning (before 12 PM)' },
        { value: 'afternoon', label: 'Afternoon (12–5 PM)' },
        { value: 'evening', label: 'Evening (after 5 PM)' },
      ],
      predicate: (e, value) => {
        const hour = parseInt((e.time_start || '0').split(':')[0], 10) || 0;
        if (value === 'morning') return hour < 12;
        if (value === 'afternoon') return hour >= 12 && hour < 17;
        return hour >= 17;
      },
    },
  ], []);

  const table = useAdminTable<Event>({
    data: events,
    columns,
    getRowId: e => String(e.id),
    storageKey: 'events',
    filterDefs,
    searchFields: e => [
      e.id,
      e.name,
      e.description,
      e.location?.name,
      e.date_type === 'one_time' ? 'one time' : 'date range',
    ],
    itemsPerPage: 10,
  });

  const handleBulkDelete = async () => {
    if (table.selectedIds.length === 0) return;
    if (!confirm(`Delete ${table.selectedIds.length} event(s)?`)) return;
    const ids = table.selectedIds.map(Number);
    for (const id of ids) {
      try { await eventService.deleteEvent(id); } catch {}
    }
    setEvents(prev => prev.filter(e => !ids.includes(e.id)));
    for (const id of ids) {
      await eventCacheService.removeEventFromCache(id);
    }
    table.clearSelection();
    setToast({ message: `${ids.length} event(s) deleted`, type: 'success' });
  };

  const exportToCSV = () => {
    exportTableCsv({
      filename: `events-export-${new Date().toISOString().split('T')[0]}.csv`,
      columns,
      rows: table.filteredRows,
      extraColumns: [
        { label: 'Location ID', value: e => e.location_id },
        { label: 'Start Date', value: e => (e.start_date || '').substring(0, 10) },
        { label: 'End Date', value: e => (e.end_date || '').substring(0, 10) },
        { label: 'Time Start', value: e => e.time_start },
        { label: 'Time End', value: e => e.time_end },
        { label: 'Features', value: e => (e.features || []).join('; ') },
      ],
    });
  };

  const metrics = [
    {
      title: 'Total Events',
      value: events.length.toString(),
      change: `${events.filter(e => e.is_active).length} active`,
      accent: `bg-${themeColor}-100 text-${fullColor}`,
      icon: Star,
    },
    {
      title: 'Active Events',
      value: events.filter(e => e.is_active).length.toString(),
      change: `${events.filter(e => !e.is_active).length} inactive`,
      accent: `bg-${themeColor}-100 text-${fullColor}`,
      icon: Zap,
    },
    {
      title: 'Avg. Price',
      value: events.length > 0
        ? `$${(events.reduce((sum, e) => sum + Number(e.price), 0) / events.length).toFixed(2)}`
        : '$0.00',
      change: 'Per event',
      accent: `bg-${themeColor}-100 text-${fullColor}`,
      icon: DollarSign,
    },
    {
      title: 'Date Range Events',
      value: events.filter(e => e.date_type === 'date_range').length.toString(),
      change: `${events.filter(e => e.date_type === 'one_time').length} one-time`,
      accent: `bg-${themeColor}-100 text-${fullColor}`,
      icon: Calendar,
    },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className={`animate-spin rounded-full h-12 w-12 border-b-2 border-${fullColor}`}></div>
      </div>
    );
  }

  return (
    <div className="px-6 py-8">
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Events</h1>
          <p className="text-gray-600 mt-1">View and manage all events</p>
        </div>
        <div className="mt-4 sm:mt-0 flex items-center gap-2">
          <StandardButton
            onClick={exportToCSV}
            variant="secondary"
            size="md"
            icon={Download}
          >
            Export CSV
          </StandardButton>
          <StandardButton
            onClick={() => navigate('/events/create')}
            variant="primary"
            size="md"
          >
            New Event
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
              <div className="flex items-center gap-2 mb-2">
                <div className={`p-2 rounded-lg ${metric.accent}`}>
                  <Icon size={20} />
                </div>
                <span className="text-base font-semibold text-gray-800">{metric.title}</span>
              </div>
              <div className="flex items-end gap-2 mt-2">
                <CounterAnimation value={metric.value} className="text-2xl font-bold text-gray-900" />
              </div>
              <p className="text-xs mt-1 text-gray-400">{metric.change}</p>
            </div>
          );
        })}
      </div>

      <AdminTableToolbar
        table={table}
        searchPlaceholder="Search events..."
        onRefresh={() => fetchEvents(true)}
      />

      <BulkActionsBar table={table} itemLabel="event(s)">
        <StandardButton
          onClick={handleBulkDelete}
          variant="danger"
          size="md"
          icon={Trash2}
        >
          Delete
        </StandardButton>
      </BulkActionsBar>

      <AdminDataTable
        table={table}
        loading={loading}
        selectable
        itemLabel="events"
        emptyMessage="No events found"
        renderActions={(event) => (
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(`/events/${event.id}/edit`)}
              className="text-gray-600 hover:text-gray-800"
              title="Edit"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <StandardButton
              onClick={() => handleDelete(event.id)}
              disabled={deletingId === event.id}
              variant="danger"
              size="sm"
              icon={Trash2}
              className="text-red-600 hover:text-red-800 p-1"
              title="Delete"
            />
          </div>
        )}
      />
    </div>
  );
};

export default Events;
