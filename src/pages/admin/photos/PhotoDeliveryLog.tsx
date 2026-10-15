import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { convertTo12Hour, parseLocalDate } from '../../../utils/timeFormat';
import { Loader2, Mail, MessageSquare, RefreshCcw, Send, Smartphone, XCircle } from 'lucide-react';
import { useThemeColor } from '../../../hooks/useThemeColor';
import { useLocationScope } from '../../../contexts/LocationContext';
import photoService from '../../../services/PhotoService';
import Toast from '../../../components/ui/Toast';
import StandardButton from '../../../components/ui/StandardButton';
import type { PhotoDeliveryRecord } from '../../../types/photo.types';
import { OUTCOME_TONE_BADGE, mergeDeliveries } from '../../../utils/photoDeliveryOutcome';

const errorMessage = (e: unknown, fallback: string): string =>
  (e as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;

interface Paginated {
  data: PhotoDeliveryRecord[];
  current_page: number;
  last_page: number;
  total: number;
}

const CARRIER_RECHECK_MS = 10000;
const CARRIER_RECHECK_LIMIT = 18;
const CHECKS_PAUSED =
  'Checking the newest texts is paused because this sign-in checked very often. Press Refresh in a minute.';

const isRateLimited = (e: unknown): boolean => (e as { response?: { status?: number } })?.response?.status === 429;

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
  const [outcome, setOutcome] = useState('');
  const [loading, setLoading] = useState(false);
  const [busyIds, setBusyIds] = useState<number[]>([]);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const loadSeq = useRef(0);
  const rowEdits = useRef(0);
  const [recheckRounds, setRecheckRounds] = useState(0);

  const load = useCallback(async () => {
    const seq = ++loadSeq.current;
    setLoading(true);
    setRecheckRounds(0);
    try {
      const params: Record<string, unknown> = { page: pageNumber, per_page: 25 };
      if (effectiveLocationId) params.location_id = effectiveLocationId;
      if (status) params.status = status;
      if (channel) params.channel = channel;
      if (kind) params.kind = kind;
      if (from) params.from = from;
      if (to) params.to = to;
      if (includeDuplicates) params.include_duplicates = 1;
      if (outcome) params.outcome = outcome;
      const loaded: Paginated = await photoService.getDeliveries(params);
      if (seq !== loadSeq.current) return;
      setPage(loaded);
      const waitingIds = loaded.data
        .filter((delivery) => delivery.carrier_pending ?? delivery.awaiting_carrier)
        .map((delivery) => delivery.id)
        .slice(0, 50);
      if (waitingIds.length > 0) {
        const edits = rowEdits.current;
        try {
          const checked = await photoService.refreshDeliveryStatus(waitingIds);
          if (seq !== loadSeq.current) return;
          if (edits === rowEdits.current) {
            setPage((prev) => (prev ? { ...prev, data: mergeDeliveries(prev.data, checked.deliveries) } : prev));
          }
        } catch (checkError) {
          if (seq !== loadSeq.current) return;
          if (isRateLimited(checkError)) setRecheckRounds(CARRIER_RECHECK_LIMIT);
          setToast({
            message: isRateLimited(checkError)
              ? CHECKS_PAUSED
              : 'The text provider could not be asked about the newest texts just now.',
            type: 'info',
          });
        }
      }
    } catch (e) {
      if (seq === loadSeq.current) setToast({ message: errorMessage(e, 'Could not load the delivery log.'), type: 'error' });
    } finally {
      if (seq === loadSeq.current) setLoading(false);
    }
  }, [channel, effectiveLocationId, from, includeDuplicates, kind, outcome, pageNumber, status, to]);

  const pendingIds = useMemo(
    () =>
      (page?.data ?? [])
        .filter((delivery) => delivery.carrier_pending ?? delivery.awaiting_carrier)
        .map((delivery) => delivery.id)
        .slice(0, 50),
    [page],
  );

  useEffect(() => {
    if (loading || pendingIds.length === 0 || recheckRounds >= CARRIER_RECHECK_LIMIT) return undefined;
    const timer = window.setTimeout(() => {
      const seq = loadSeq.current;
      const edits = rowEdits.current;
      photoService
        .refreshDeliveryStatus(pendingIds)
        .then((checked) => {
          if (seq !== loadSeq.current) return;
          if (edits === rowEdits.current) {
            setPage((prev) => (prev ? { ...prev, data: mergeDeliveries(prev.data, checked.deliveries) } : prev));
          }
          setRecheckRounds((n) => n + 1);
        })
        .catch((checkError) => {
          if (seq !== loadSeq.current) return;
          setRecheckRounds(CARRIER_RECHECK_LIMIT);
          if (isRateLimited(checkError)) setToast({ message: CHECKS_PAUSED, type: 'info' });
        });
    }, CARRIER_RECHECK_MS);
    return () => window.clearTimeout(timer);
  }, [loading, pendingIds, recheckRounds]);

  const loadRef = useRef(load);

  useEffect(() => {
    loadRef.current = load;
    void load();
  }, [load]);

  const retry = useCallback(
    async (delivery: PhotoDeliveryRecord) => {
      setBusyIds((prev) => [...prev, delivery.id]);
      try {
        const result = await photoService.retryDelivery(delivery.id);
        setToast({ message: result.message, type: 'success' });
        await loadRef.current();
      } catch (e) {
        setToast({ message: errorMessage(e, 'The retry failed.'), type: 'error' });
        await loadRef.current();
      } finally {
        setBusyIds((prev) => prev.filter((id) => id !== delivery.id));
      }
    },
    [],
  );

  const confirmReceived = useCallback(
    async (delivery: PhotoDeliveryRecord) => {
      rowEdits.current += 1;
      setBusyIds((prev) => [...prev, delivery.id]);
      try {
        const result = await photoService.confirmTextReceived(delivery.id);
        setPage((prev) => (prev ? { ...prev, data: mergeDeliveries(prev.data, [result.data]) } : prev));
        setToast({ message: result.message, type: 'success' });
      } catch (e) {
        const current = (e as { response?: { data?: { data?: PhotoDeliveryRecord } } })?.response?.data?.data;
        if (current) setPage((prev) => (prev ? { ...prev, data: mergeDeliveries(prev.data, [current]) } : prev));
        setToast({ message: errorMessage(e, 'That could not be saved.'), type: 'error' });
      } finally {
        rowEdits.current += 1;
        setBusyIds((prev) => prev.filter((id) => id !== delivery.id));
      }
    },
    [],
  );

  const cancel = useCallback(
    async (delivery: PhotoDeliveryRecord) => {
      setBusyIds((prev) => [...prev, delivery.id]);
      try {
        await photoService.cancelDelivery(delivery.id);
        setToast({ message: 'Scheduled delivery canceled.', type: 'info' });
        await loadRef.current();
      } catch (e) {
        setToast({ message: errorMessage(e, 'That delivery could not be canceled.'), type: 'error' });
      } finally {
        setBusyIds((prev) => prev.filter((id) => id !== delivery.id));
      }
    },
    [],
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
              Email and SMS are tracked separately. A text only shows as delivered once the phone carrier confirms it, and
              as received once the guest opens its link or a staff member sees it on their phone.
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
            <option value="skipped">Not sent (channel off)</option>
          </select>
          <select value={outcome} onChange={(e) => { setOutcome(e.target.value); setPageNumber(1); }} className={fieldCls} aria-label="Text outcome">
            <option value="">Any text outcome</option>
            <option value="not_delivered">Text not delivered</option>
            <option value="awaiting_carrier">Text waiting for the carrier</option>
            <option value="reached_phone">Text reached the phone</option>
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
            <option value="escape_room">Escape room</option>
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
                      {delivery.kind === 'next_day'
                        ? '9:00 AM next day'
                        : delivery.kind === 'escape_room'
                          ? 'Escape room'
                          : delivery.kind}
                      {delivery.kind === 'escape_room' && delivery.escape_room && (
                        <Link
                          to={`/photos/escape-rooms?date=${delivery.escape_room.session_date}&session=${delivery.escape_room.id}`}
                          className="block text-xs text-gray-500 underline underline-offset-2"
                        >
                          {delivery.escape_room.room_name ?? 'Game'} ·{' '}
                          {parseLocalDate(String(delivery.escape_room.session_date).split('T')[0]).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ·{' '}
                          {convertTo12Hour(delivery.escape_room.session_time.slice(0, 5))} game
                        </Link>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 text-xs rounded-full px-2 py-0.5 ${OUTCOME_TONE_BADGE[delivery.outcome_tone] ?? 'bg-gray-100 text-gray-700'}`}
                      >
                        {delivery.awaiting_carrier && <Loader2 className="w-3 h-3 animate-spin" />}
                        {delivery.outcome_label ?? delivery.status}
                      </span>
                      {(delivery.outcome_detail ?? delivery.error) && (
                        <p
                          className={`text-xs mt-1 max-w-xs ${
                            delivery.outcome_tone === 'danger' ? 'text-red-600' : 'text-gray-600'
                          }`}
                        >
                          {delivery.outcome_detail ?? delivery.error}
                        </p>
                      )}
                      {delivery.receipt_confirmed_by_name && (
                        <p className="text-xs text-gray-500 mt-1">confirmed by {delivery.receipt_confirmed_by_name}</p>
                      )}
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
                      {delivery.opened_at && <p className="text-xs text-green-700">link opened from this message</p>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {delivery.can_confirm_receipt && (
                          <button
                            type="button"
                            onClick={() => void confirmReceived(delivery)}
                            disabled={busyIds.includes(delivery.id)}
                            className="inline-flex items-center gap-1 text-xs border border-green-300 text-green-800 rounded-lg px-2.5 py-1.5 hover:bg-green-50 disabled:opacity-40"
                          >
                            <Smartphone className="w-3.5 h-3.5" />
                            Guest received it
                          </button>
                        )}
                        {delivery.can_retry && !delivery.is_duplicate && delivery.retry_useful !== false && (
                          <button
                            type="button"
                            onClick={() => void retry(delivery)}
                            disabled={busyIds.includes(delivery.id)}
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
                            disabled={busyIds.includes(delivery.id)}
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
