import React, { useCallback, useEffect, useState } from 'react';
import { History, Loader2, MessageSquare, RotateCw, ShieldCheck, User } from 'lucide-react';
import bookingService, { type BookingChangeLogEntry } from '../../../services/bookingService';
import { formatLocalDateTime } from '../../../utils/timeFormat';

const FIELD_LABELS: Record<string, string> = {
  booking_date: 'Date',
  booking_time: 'Time',
  participants: 'Guests',
  duration: 'Duration',
  duration_unit: 'Duration unit',
  room_id: 'Room',
  package_id: 'Package',
  total_amount: 'Total',
  amount_paid: 'Amount paid',
  discount_amount: 'Discount',
  status: 'Status',
  payment_status: 'Payment status',
  payment_method: 'Payment method',
  guest_name: 'Guest name',
  guest_email: 'Guest email',
  guest_phone: 'Guest phone',
  internal_notes: 'Internal notes',
  notes: 'Notes',
  special_requests: 'Special requests',
  location_id: 'Location',
  addons: 'Add-ons',
  attractions: 'Attractions',
  guest_of_honor_name: 'Guest of honour',
};

const labelFor = (field: string): string =>
  FIELD_LABELS[field] ?? field.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

const describeObject = (row: Record<string, unknown>): string => {
  // Prefer a human label; fall back to key: value pairs rather than emitting "undefined".
  const label = [row.name, row.title, row.label].find(v => typeof v === 'string' && v !== '');
  const quantity = row.quantity;
  if (typeof label === 'string') {
    return quantity === null || quantity === undefined ? label : `${label} ×${quantity}`;
  }
  const pairs = Object.entries(row)
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
    .map(([k, v]) => `${labelFor(k)}: ${String(v)}`);
  return pairs.length > 0 ? pairs.join(', ') : '—';
};

/** Renders a change value as something a human can read - never "[object Object]", "undefined" or "null". */
const renderValue = (value: unknown): string => {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number' || typeof value === 'string') return String(value);
  if (Array.isArray(value)) {
    const parts = value
      .filter(item => item !== null && item !== undefined && item !== '')
      .map(item => (typeof item === 'object' ? describeObject(item as Record<string, unknown>) : String(item)))
      .filter(part => part !== '' && part !== '—');
    return parts.length > 0 ? parts.join(', ') : 'none';
  }
  if (typeof value === 'object') return describeObject(value as Record<string, unknown>);
  return String(value);
};

interface BookingChangeHistoryProps {
  bookingId: number;
  themeColor?: string;
  fullColor?: string;
  className?: string;
}

const BookingChangeHistory: React.FC<BookingChangeHistoryProps> = ({
  bookingId,
  themeColor = 'blue',
  fullColor = 'blue-800',
  className,
}) => {
  const [logs, setLogs] = useState<BookingChangeLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await bookingService.getChangeLogs(bookingId);
      setLogs(res?.data?.logs ?? []);
    } catch {
      setError('Could not load the change history.');
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className={className}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h4 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
          <History className={`h-4 w-4 text-${fullColor}`} />
          Change history
          <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[0.65rem] font-medium text-gray-600">
            <ShieldCheck className="h-3 w-3" />
            Permanent record
          </span>
        </h4>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          aria-label="Refresh change history"
          className="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 disabled:opacity-40"
        >
          <RotateCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {loading && logs.length === 0 ? (
        <div className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-4 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading history…
        </div>
      ) : error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-700">{error}</div>
      ) : logs.length === 0 ? (
        <div className="rounded-lg border border-gray-200 px-3 py-4 text-sm text-gray-500">
          No changes recorded for this booking yet.
        </div>
      ) : (
        <ol className="space-y-2">
          {logs.map(log => {
            const fields = log.changes ? Object.entries(log.changes) : [];
            return (
              <li key={log.id} className="rounded-lg border border-gray-200 bg-white">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-gray-100 px-3 py-2">
                  <span className="text-sm font-semibold text-gray-900">{log.action}</span>
                  <span className="text-xs tabular-nums text-gray-500">
                    {log.changed_at ? formatLocalDateTime(log.changed_at) : '—'}
                  </span>
                </div>

                <div className="px-3 py-2">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-600">
                    <span className="flex items-center gap-1 font-medium text-gray-800">
                      <User className="h-3 w-3 text-gray-400" />
                      {log.employee_name}
                    </span>
                    {log.employee_role && (
                      <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[0.65rem] capitalize text-gray-600">
                        {log.employee_role.replace(/_/g, ' ')}
                      </span>
                    )}
                  </div>

                  {log.reason ? (
                    <p className={`mt-2 flex gap-1.5 rounded-md bg-${themeColor}-50 px-2 py-1.5 text-xs text-gray-800`}>
                      <MessageSquare className={`mt-0.5 h-3 w-3 shrink-0 text-${fullColor}`} />
                      <span>
                        <span className="font-medium">Reason: </span>
                        {log.reason}
                      </span>
                    </p>
                  ) : (
                    <p className="mt-2 text-xs italic text-gray-400">No reason recorded</p>
                  )}

                  {fields.length > 0 && (
                    <div className="mt-2 overflow-x-auto">
                      <table className="w-full min-w-[22rem] border-collapse text-xs">
                        <thead>
                          <tr className="text-left text-[0.65rem] uppercase tracking-wide text-gray-400">
                            <th className="py-1 pr-2 font-semibold">Field</th>
                            <th className="py-1 pr-2 font-semibold">Was</th>
                            <th className="py-1 font-semibold">Now</th>
                          </tr>
                        </thead>
                        <tbody>
                          {fields.map(([field, change]) => {
                            const redacted = Boolean((change as { redacted?: boolean } | null)?.redacted);
                            if (redacted) {
                              return (
                                <tr key={field} className="border-t border-gray-100 align-top">
                                  <td className="py-1 pr-2 font-medium text-gray-700">{labelFor(field)}</td>
                                  <td className="py-1 pr-2 text-gray-500" colSpan={2}>
                                    Changed{' '}
                                    <span className="text-gray-400">
                                      ({renderValue(change?.from)} → {renderValue(change?.to)})
                                    </span>
                                    <span className="ml-1 text-gray-400" title="Note text is deliberately not copied into the permanent log">
                                      — text not recorded
                                    </span>
                                  </td>
                                </tr>
                              );
                            }
                            return (
                            <tr key={field} className="border-t border-gray-100 align-top">
                              <td className="py-1 pr-2 font-medium text-gray-700">{labelFor(field)}</td>
                              <td className="py-1 pr-2 text-red-700 line-through decoration-red-300">
                                {renderValue(change?.from)}
                              </td>
                              <td className="py-1 font-medium text-green-700">{renderValue(change?.to)}</td>
                            </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {fields.length === 0 && log.description && (
                    <p className="mt-2 text-xs text-gray-600">{log.description}</p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
};

export default BookingChangeHistory;
