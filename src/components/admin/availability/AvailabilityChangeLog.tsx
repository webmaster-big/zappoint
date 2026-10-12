import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, CalendarCheck, CalendarOff, CalendarPlus, Loader2, Pencil, RefreshCcw } from 'lucide-react';
import Pagination from '../../ui/Pagination';
import {
  dayOffService,
  type AvailabilityChange,
  type BlockSnapshot,
  type ChangeAction,
  type Pagination as PageInfo,
} from '../../../services/DayOffService';

interface AvailabilityChangeLogProps {
  dayOffId?: number;
  locationId?: number | null;
  showLocation?: boolean;
  perPage?: number;
}

const ACTIONS: Record<ChangeAction, { label: string; className: string; icon: typeof CalendarPlus }> = {
  created: { label: 'Blocked', className: 'bg-red-50 text-red-700 border-red-200', icon: CalendarPlus },
  updated: { label: 'Changed', className: 'bg-blue-50 text-blue-700 border-blue-200', icon: Pencil },
  deleted: { label: 'Removed', className: 'bg-gray-100 text-gray-700 border-gray-200', icon: CalendarOff },
  booked_inside_block: { label: 'Booked inside block', className: 'bg-amber-50 text-amber-800 border-amber-200', icon: CalendarCheck },
  booking_removed: { label: 'Booking removed', className: 'bg-gray-100 text-gray-700 border-gray-200', icon: CalendarOff },
};

const FIELD_LABELS: Partial<Record<keyof BlockSnapshot, string>> = {
  location_id: 'Location',
  date: 'Date',
  is_recurring: 'Repeats every year',
  block_type: 'Kind',
  opens_at: 'Opens at',
  closes_at: 'Closes at',
  time_start: 'Closed from (older format)',
  time_end: 'Closed until (older format)',
  reason: 'Reason',
  group_name: 'Group or event',
  package_ids: 'Packages',
  room_ids: 'Rooms',
  attraction_ids: 'Attractions',
  event_ids: 'Events',
};

const KIND_LABELS: Record<string, string> = {
  full_day: 'Closed all day',
  operating_window: 'Open for set hours',
  legacy_closure: 'Closed hours (older format)',
};

const formatClock = (value: string): string => {
  const [hours, minutes] = value.split(':').map(Number);
  if (!Number.isFinite(hours)) return value;
  if (hours === 0 && (minutes || 0) === 0) return '12:00 AM';
  const period = hours >= 12 ? 'PM' : 'AM';
  return `${hours % 12 || 12}:${String(minutes || 0).padStart(2, '0')} ${period}`;
};

const formatDay = (value: string): string => {
  const [year, month, day] = value.split('T')[0].split('-').map(Number);
  if (!year || !month || !day) return value;
  return new Date(year, month - 1, day).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
};

const formatValue = (field: keyof BlockSnapshot, value: unknown): string => {
  if (value === null || value === undefined || value === '') return '—';
  if (field === 'is_recurring') return value ? 'Yes' : 'No';
  if (field === 'block_type') return KIND_LABELS[String(value)] ?? String(value);
  if (field === 'date') return formatDay(String(value));
  if (['opens_at', 'closes_at', 'time_start', 'time_end'].includes(field)) return formatClock(String(value));
  if (Array.isArray(value)) return `${value.length} chosen (#${value.join(', #')})`;
  return String(value);
};

const formatWhen = (value: string | null): string => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString('en-US', { timeZone: 'America/Detroit', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });
};

const ChangeEntry: React.FC<{ change: AvailabilityChange; showLocation: boolean }> = ({ change, showLocation }) => {
  const action = ACTIONS[change.action] ?? ACTIONS.updated;
  const Icon = action.icon;
  const fields = (change.changed_fields ?? []).filter(
    (field): field is keyof BlockSnapshot => field in FIELD_LABELS
  );
  const context = change.context ?? {};

  return (
    <li className="rounded-lg border border-gray-200 bg-white px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${action.className}`}>
          <Icon className="h-3 w-3" />
          {action.label}
        </span>
        <span className="text-xs text-gray-500">
          {formatWhen(change.created_at)} · {change.changed_by?.name ?? 'Unknown employee'}
          {change.changed_by?.role ? ` (${change.changed_by.role.replace(/_/g, ' ')})` : ''}
          {showLocation && change.location_name ? ` · ${change.location_name}` : ''}
          {change.previous_location_name ? ` · moved from ${change.previous_location_name}` : ''}
        </span>
      </div>
      <p className="mt-1 text-sm text-gray-800">{change.summary}</p>
      {change.action === 'updated' && fields.length > 0 && (
        <ul className="mt-2 space-y-1">
          {fields.map(field => (
            <li key={field} className="flex flex-wrap items-center gap-1 text-xs text-gray-600">
              <span className="font-medium text-gray-700">{FIELD_LABELS[field]}:</span>
              <span className="line-through decoration-gray-400">
                {field === 'location_id' && change.previous_location_name ? change.previous_location_name : formatValue(field, change.before?.[field])}
              </span>
              <ArrowRight className="h-3 w-3" />
              <span className="text-gray-900">
                {field === 'location_id' && change.location_name ? change.location_name : formatValue(field, change.after?.[field])}
              </span>
            </li>
          ))}
        </ul>
      )}
      {(change.action === 'booked_inside_block' || change.action === 'booking_removed') && (
        <p className="mt-1 text-xs text-gray-600">
          {[
            typeof context.reference === 'string' ? `Reference ${context.reference}` : null,
            typeof context.guest_name === 'string' ? `Guest ${context.guest_name}` : null,
          ].filter(Boolean).join(' · ')}
        </p>
      )}
    </li>
  );
};

const AvailabilityChangeLog: React.FC<AvailabilityChangeLogProps> = ({ dayOffId, locationId = null, showLocation = false, perPage = 20 }) => {
  const [changes, setChanges] = useState<AvailabilityChange[]>([]);
  const [pageInfo, setPageInfo] = useState<PageInfo | null>(null);
  const [page, setPage] = useState(1);
  const [action, setAction] = useState<ChangeAction | ''>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const latestRequest = useRef(0);

  const load = useCallback(async () => {
    const request = ++latestRequest.current;
    setLoading(true);
    setError(null);
    try {
      const response = await dayOffService.getChangeLog({
        day_off_id: dayOffId,
        location_id: locationId ?? undefined,
        action: action || undefined,
        page,
        per_page: perPage,
      });
      if (request !== latestRequest.current) return;
      setChanges(response.data.changes);
      setPageInfo(response.data.pagination);
    } catch (err) {
      if (request !== latestRequest.current) return;
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(message || 'Could not load the change history.');
    } finally {
      if (request === latestRequest.current) setLoading(false);
    }
  }, [dayOffId, locationId, action, page, perPage]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [locationId]);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <select
          value={action}
          onChange={event => {
            setAction(event.target.value as ChangeAction | '');
            setPage(1);
          }}
          className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
          aria-label="Filter changes"
        >
          <option value="">All changes</option>
          <option value="created">Blocked</option>
          <option value="updated">Changed</option>
          <option value="deleted">Removed</option>
          <option value="booked_inside_block">Booked inside a block</option>
          <option value="booking_removed">Booking removed</option>
        </select>
        <button type="button" onClick={load} className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2 py-1.5 text-xs text-gray-700 hover:bg-gray-50">
          <RefreshCcw className="h-3.5 w-3.5" />
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : changes.length === 0 ? (
        <p className="py-6 text-center text-sm text-gray-500">No changes recorded yet.</p>
      ) : (
        <ul className="space-y-2">
          {changes.map(change => (
            <ChangeEntry key={change.id} change={change} showLocation={showLocation} />
          ))}
        </ul>
      )}

      {pageInfo && pageInfo.last_page > 1 && (
        <div className="mt-4 flex justify-center">
          <Pagination currentPage={pageInfo.current_page} totalPages={pageInfo.last_page} onPageChange={setPage} />
        </div>
      )}

      <p className="mt-3 text-xs text-gray-500">Every change is kept permanently and cannot be edited or removed.</p>
    </div>
  );
};

export default AvailabilityChangeLog;
