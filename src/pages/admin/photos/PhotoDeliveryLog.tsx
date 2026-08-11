import { useCallback, useEffect, useState } from 'react';
import { Mail, MessageSquare, RefreshCcw, Send, XCircle } from 'lucide-react';
import { useThemeColor } from '../../../hooks/useThemeColor';
import { useLocationScope } from '../../../contexts/LocationContext';
import photoService from '../../../services/PhotoService';
import Toast from '../../../components/ui/Toast';
import StandardButton from '../../../components/ui/StandardButton';
import type { PhotoDeliveryRecord } from '../../../types/photo.types';

const errorMessage = (e: unknown, fallback: string): string =>
  (e as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;

const STATUS_STYLES: Record<string, string> = {
  sent: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
  scheduled: 'bg-blue-100 text-blue-800',
  queued: 'bg-gray-100 text-gray-700',
  canceled: 'bg-gray-200 text-gray-600',
  skipped: 'bg-amber-100 text-amber-800',
};

interface Paginated {
  data: PhotoDeliveryRecord[];
  current_page: number;
  last_page: number;
  total: number;
}

const PhotoDeliveryLog = () => {
  const { themeColor } = useThemeColor();
  const { effectiveLocationId } = useLocationScope();

  const [page, setPage] = useState<Paginated | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [status, setStatus] = useState('');
  const [channel, setChannel] = useState('');
  const [kind, setKind] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [includeDuplicates, setIncludeDuplicates] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = { page: pageNumber, per_page: 25 };
      if (effectiveLocationId) params.location_id = effectiveLocationId;
      if (status) params.status = status;
      if (channel) params.channel = channel;
      if (kind) params.kind = kind;
      if (from) params.from = from;
      if (to) params.to = to;
      if (includeDuplicates) params.include_duplicates = 1;
      setPage(await photoService.getDeliveries(params));
    } catch (e) {
      setToast({ message: errorMessage(e, 'Could not load the delivery log.'), type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [channel, effectiveLocationId, from, includeDuplicates, kind, pageNumber, status, to]);

  useEffect(() => {
    void load();
  }, [load]);

  const retry = useCallback(
    async (delivery: PhotoDeliveryRecord) => {
      setBusyId(delivery.id);
      try {
        await photoService.retryDelivery(delivery.id);
        setToast({ message: 'Delivery sent.', type: 'success' });
        await load();
      } catch (e) {
        setToast({ message: errorMessage(e, 'The retry failed.'), type: 'error' });
        await load();
      } finally {
        setBusyId(null);
      }
    },
    [load],
  );

  const cancel = useCallback(
    async (delivery: PhotoDeliveryRecord) => {
      setBusyId(delivery.id);
      try {
        await photoService.cancelDelivery(delivery.id);
        setToast({ message: 'Scheduled delivery canceled.', type: 'info' });
        await load();
      } catch (e) {
        setToast({ message: errorMessage(e, 'That delivery could not be canceled.'), type: 'error' });
      } finally {
        setBusyId(null);
      }
    },
    [load],
  );

  const fieldCls = `border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-${themeColor}-600`;

  return (
    <div className="min-h-screen px-4 sm:px-6 py-8">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="max-w-7xl mx-auto">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Send className={`w-6 h-6 text-${themeColor}-700`} />
              Photo delivery log
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              Email and SMS are tracked separately, so a session shows as partly delivered when one channel succeeds and
              another fails.
            </p>
          </div>
          <StandardButton variant="secondary" size="sm" icon={RefreshCcw} onClick={() => void load()} loading={loading}>
            Refresh
          </StandardButton>
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-5">
          <select value={status} onChange={(e) => { setStatus(e.target.value); setPageNumber(1); }} className={fieldCls}>
            <option value="">All statuses</option>
            <option value="sent">Sent</option>
            <option value="failed">Failed</option>
            <option value="scheduled">Scheduled</option>
            <option value="canceled">Canceled</option>
            <option value="skipped">Skipped (duplicate destination)</option>
          </select>
          <select value={channel} onChange={(e) => { setChannel(e.target.value); setPageNumber(1); }} className={fieldCls}>
            <option value="">Both channels</option>
            <option value="email">Email</option>
            <option value="sms">SMS</option>
          </select>
          <select value={kind} onChange={(e) => { setKind(e.target.value); setPageNumber(1); }} className={fieldCls}>
            <option value="">All kinds</option>
            <option value="immediate">Immediate</option>
            <option value="next_day">9:00 AM next day</option>
            <option value="kiosk">Kiosk</option>
          </select>
          <input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPageNumber(1); }} className={fieldCls} aria-label="From date" />
          <input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPageNumber(1); }} className={fieldCls} aria-label="To date" />
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={includeDuplicates}
              onChange={(e) => { setIncludeDuplicates(e.target.checked); setPageNumber(1); }}
              className={`h-4 w-4 accent-${themeColor}-700`}
            />
            Show deduplicated waiver links
          </label>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3">Session</th>
                  <th className="px-4 py-3">Channel</th>
                  <th className="px-4 py-3">Destination</th>
                  <th className="px-4 py-3">Kind</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">When</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(page?.data ?? []).map((delivery) => (
                  <tr key={delivery.id} className={delivery.is_duplicate ? 'bg-gray-50/60' : undefined}>
                    <td className="px-4 py-3">
                      <p className="text-gray-900">#{delivery.photo_session_id}</p>
                      <p className="text-xs text-gray-500 capitalize">
                        {delivery.session_source ?? '—'}
                        {delivery.location_name && ` · ${delivery.location_name}`}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 text-gray-700">
                        {delivery.channel === 'email' ? (
                          <Mail className="w-4 h-4" />
                        ) : (
                          <MessageSquare className="w-4 h-4" />
                        )}
                        {delivery.channel === 'email' ? 'Email' : 'SMS'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-gray-900">{delivery.destination_masked}</p>
                      {delivery.recipient_name && <p className="text-xs text-gray-500">{delivery.recipient_name}</p>}
                      {delivery.is_duplicate && (
                        <p className="text-xs text-amber-700">
                          same destination as #{delivery.duplicate_of_id} — recorded, not sent twice
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {delivery.kind === 'next_day' ? '9:00 AM next day' : delivery.kind}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs rounded-full px-2 py-0.5 ${STATUS_STYLES[delivery.status] ?? 'bg-gray-100 text-gray-700'}`}
                      >
                        {delivery.status}
                      </span>
                      {delivery.error && <p className="text-xs text-red-600 mt-1 max-w-xs">{delivery.error}</p>}
                      {delivery.attempts > 1 && (
                        <p className="text-xs text-gray-500 mt-1">{delivery.attempts} attempts</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {delivery.sent_at
                        ? new Date(delivery.sent_at).toLocaleString()
                        : delivery.scheduled_for
                          ? `scheduled ${new Date(delivery.scheduled_for).toLocaleString()}`
                          : delivery.created_at
                            ? new Date(delivery.created_at).toLocaleString()
                            : '—'}
                      {delivery.opened_at && <p className="text-xs text-green-700">link opened</p>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        {delivery.can_retry && !delivery.is_duplicate && (
                          <button
                            type="button"
                            onClick={() => void retry(delivery)}
                            disabled={busyId === delivery.id}
                            className="inline-flex items-center gap-1 text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 hover:bg-gray-50 disabled:opacity-40"
                          >
                            <RefreshCcw className="w-3.5 h-3.5" />
                            {delivery.status === 'sent' ? 'Resend' : 'Retry'}
                          </button>
                        )}
                        {delivery.can_cancel && (
                          <button
                            type="button"
                            onClick={() => void cancel(delivery)}
                            disabled={busyId === delivery.id}
                            className="inline-flex items-center gap-1 text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 hover:bg-red-50 text-red-700 disabled:opacity-40"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            Cancel
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!loading && (page?.data.length ?? 0) === 0 && (
            <div className="p-10 text-center text-sm text-gray-500">No deliveries match these filters.</div>
          )}

          {page && page.last_page > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 text-sm">
              <span className="text-gray-500">
                Page {page.current_page} of {page.last_page} · {page.total} rows
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPageNumber((n) => Math.max(1, n - 1))}
                  disabled={page.current_page <= 1}
                  className="border border-gray-200 rounded-lg px-3 py-1.5 disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => setPageNumber((n) => n + 1)}
                  disabled={page.current_page >= page.last_page}
                  className="border border-gray-200 rounded-lg px-3 py-1.5 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PhotoDeliveryLog;
