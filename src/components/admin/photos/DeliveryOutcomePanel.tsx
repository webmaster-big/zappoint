import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
  Mail,
  MessageSquare,
  RefreshCcw,
  Smartphone,
  XCircle,
} from 'lucide-react';
import photoService from '../../../services/PhotoService';
import type { PhotoDeliveryRecord, PhotoSendOutcome } from '../../../types/photo.types';
import { OUTCOME_TONE_BADGE, channelName, mergeDeliveries, recipientLabel } from '../../../utils/photoDeliveryOutcome';

const POLL_INTERVAL_MS = 5000;
const PAUSED_INTERVAL_MS = 60000;
const POLL_LIMIT = 24;

type RefreshResult = 'ok' | 'stale' | 'paused' | 'failed' | 'signed_out';

const errorMessage = (e: unknown, fallback: string): string =>
  (e as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;

const statusOf = (e: unknown): number | undefined => (e as { response?: { status?: number } })?.response?.status;

const RESULT_STYLE = {
  sent: { icon: CheckCircle2, iconClass: 'text-green-600', box: 'border-green-200 bg-green-50' },
  partial: { icon: AlertTriangle, iconClass: 'text-amber-600', box: 'border-amber-200 bg-amber-50' },
  failed: { icon: XCircle, iconClass: 'text-red-600', box: 'border-red-200 bg-red-50' },
  scheduled: { icon: Clock, iconClass: 'text-blue-600', box: 'border-blue-200 bg-blue-50' },
  waiting: { icon: Loader2, iconClass: 'text-blue-600 animate-spin', box: 'border-blue-200 bg-blue-50' },
} as const;

const OutcomeBadge = ({ delivery, className, polling }: { delivery: PhotoDeliveryRecord; className: string; polling: boolean }) => (
  <span className={`items-center gap-1 rounded-full px-2 py-0.5 text-xs ${OUTCOME_TONE_BADGE[delivery.outcome_tone]} ${className}`}>
    {delivery.awaiting_carrier && polling && <Loader2 className="w-3 h-3 animate-spin" />}
    {delivery.outcome_label}
  </span>
);

interface DeliveryOutcomePanelProps {
  outcome: PhotoSendOutcome;
  deliveries: PhotoDeliveryRecord[];
  onResultChange?: (result: PhotoSendOutcome['result']) => void;
}

const DeliveryOutcomePanel = ({ outcome, deliveries, onResultChange }: DeliveryOutcomePanelProps) => {
  const [summary, setSummary] = useState<PhotoSendOutcome>(outcome);
  const [rows, setRows] = useState<PhotoDeliveryRecord[]>(() =>
    deliveries.filter((delivery) => outcome.delivery_ids.includes(delivery.id)),
  );
  const [checks, setChecks] = useState(0);
  const [pollTick, setPollTick] = useState(0);
  const [checking, setChecking] = useState(false);
  const [checkFailed, setCheckFailed] = useState(false);
  const [checkPaused, setCheckPaused] = useState(false);
  const [refreshDue, setRefreshDue] = useState(false);
  const [busyIds, setBusyIds] = useState<number[]>([]);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const mounted = useRef(true);
  const mutations = useRef(0);
  const refreshes = useRef(0);
  const busyCount = useRef(0);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    onResultChange?.(summary.result);
  }, [onResultChange, summary.result]);

  const deliveryIds = summary.delivery_ids;

  const refresh = useCallback(async (): Promise<RefreshResult> => {
    if (!mounted.current) return 'stale';
    if (deliveryIds.length === 0) return 'ok';
    const startedAt = mutations.current;
    const sequence = ++refreshes.current;
    setChecking(true);
    try {
      const result = await photoService.refreshDeliveryStatus(deliveryIds);
      if (!mounted.current || startedAt !== mutations.current || sequence !== refreshes.current) return 'stale';
      setRows((prev) => mergeDeliveries(prev, result.deliveries));
      if (result.outcome) setSummary(result.outcome);
      setCheckFailed(false);
      setCheckPaused(false);
      setRefreshDue(false);
      return 'ok';
    } catch (e) {
      if (!mounted.current) return 'stale';
      const stale = startedAt !== mutations.current || sequence !== refreshes.current;
      if (statusOf(e) === 401) {
        setChecks(POLL_LIMIT);
        setRefreshDue(false);
        setNotice({ tone: 'error', text: 'You are signed out, so this screen stopped checking. The delivery log keeps the result.' });
        return 'signed_out';
      }
      if (statusOf(e) === 429) {
        setRefreshDue(true);
        setCheckPaused(true);
        setCheckFailed(false);
        return 'paused';
      }
      if (stale) return 'stale';
      setRefreshDue(true);
      setCheckFailed(true);
      setCheckPaused(false);
      return 'failed';
    } finally {
      if (mounted.current && sequence === refreshes.current) setChecking(false);
    }
  }, [deliveryIds]);

  const waiting = summary.carrier_pending > 0 || rows.some((row) => row.carrier_pending ?? row.awaiting_carrier);
  const keepChecking = waiting || refreshDue;

  useEffect(() => {
    if (!keepChecking || checks >= POLL_LIMIT) return undefined;
    const timer = window.setTimeout(
      () => {
        if (busyCount.current > 0) {
          setPollTick((n) => n + 1);
          return;
        }
        void refresh().then((result) => {
          if (!mounted.current) return;
          if (result === 'paused') setPollTick((n) => n + 1);
          else setChecks((n) => n + 1);
        });
      },
      checkPaused ? PAUSED_INTERVAL_MS : POLL_INTERVAL_MS,
    );
    return () => window.clearTimeout(timer);
  }, [keepChecking, checks, pollTick, checkPaused, refresh]);

  const startBusy = useCallback((id: number) => {
    mutations.current += 1;
    busyCount.current += 1;
    setBusyIds((prev) => [...prev, id]);
    setNotice(null);
  }, []);

  const endBusy = useCallback((id: number) => {
    mutations.current += 1;
    busyCount.current = Math.max(0, busyCount.current - 1);
    setBusyIds((prev) => prev.filter((busyId) => busyId !== id));
  }, []);

  const confirmReceived = useCallback(async (delivery: PhotoDeliveryRecord) => {
    startBusy(delivery.id);
    try {
      const result = await photoService.confirmTextReceived(delivery.id);
      setRows((prev) => mergeDeliveries(prev, [result.data]));
      setSummary((prev) => ({ ...prev, ask_for_receipt: false }));
      setNotice({ tone: 'success', text: result.message });
    } catch (e) {
      const current = (e as { response?: { data?: { data?: PhotoDeliveryRecord } } })?.response?.data?.data;
      if (current) setRows((prev) => mergeDeliveries(prev, [current]));
      setNotice({ tone: 'error', text: errorMessage(e, 'That could not be saved. Try again.') });
    } finally {
      endBusy(delivery.id);
      setChecks(0);
      if (busyCount.current === 0) void refresh();
      else setRefreshDue(true);
    }
  }, [refresh, startBusy, endBusy]);

  const retry = useCallback(
    async (delivery: PhotoDeliveryRecord) => {
      startBusy(delivery.id);
      try {
        const result = await photoService.retryDelivery(delivery.id);
        setRows((prev) => mergeDeliveries(prev, [result.data]));
        setNotice({ tone: 'success', text: result.message });
      } catch (e) {
        const failedRow = (e as { response?: { data?: { data?: PhotoDeliveryRecord } } })?.response?.data?.data;
        if (failedRow) setRows((prev) => mergeDeliveries(prev, [failedRow]));
        setNotice({ tone: 'error', text: errorMessage(e, 'It did not go out again.') });
      } finally {
        endBusy(delivery.id);
        setChecks(0);
        if (busyCount.current === 0) void refresh();
        else setRefreshDue(true);
      }
    },
    [refresh, startBusy, endBusy],
  );

  const polling = keepChecking && checks < POLL_LIMIT;
  const timedOut = waiting && checks >= POLL_LIMIT;
  const style =
    RESULT_STYLE[summary.result === 'sent' && waiting ? (polling ? 'waiting' : 'scheduled') : summary.result] ?? RESULT_STYLE.partial;
  const Icon = style.icon;

  return (
    <div>
      <div className={`rounded-xl border p-4 ${style.box}`} role="status" aria-live="polite">
        <div className="flex items-start gap-3">
          <Icon className={`w-6 h-6 mt-0.5 shrink-0 ${style.iconClass}`} />
          <div className="min-w-0">
            <p className="font-semibold text-gray-900">{summary.headline}</p>
            <p className="mt-1 text-sm text-gray-700">{summary.message}</p>
            {timedOut && (
              <p className="mt-2 text-sm text-gray-700">
                The phone carrier has not answered yet. The delivery log keeps checking for three days.
              </p>
            )}
          </div>
        </div>
      </div>

      {summary.ask_for_receipt && (
        <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
          <p className="flex items-center gap-2 font-medium">
            <Smartphone className="w-4 h-4" />
            Is the text on the guest&apos;s phone?
          </p>
          <p className="mt-1">
            Texting is not confirmed as working yet. Ask the guest to check their phone. If the photo text is there, tap
            &ldquo;Guest received it&rdquo;. Texting then counts as confirmed once the phone carrier reports the text delivered,
            or after three days if the carrier reports no problem. The guest opening the link from the text confirms it at once.
          </p>
        </div>
      )}

      <ul className="mt-4 divide-y divide-gray-100 border-y border-gray-100">
        {rows.map((delivery) => {
          const busy = busyIds.includes(delivery.id);
          const canRetry =
            delivery.can_retry &&
            delivery.retry_useful !== false &&
            !(summary.texts_blocked && delivery.channel === 'sms') &&
            !delivery.is_duplicate &&
            (delivery.outcome === 'failed' || delivery.outcome === 'not_delivered');
          return (
            <li key={delivery.id} className="py-3">
              <div className="flex items-start gap-3">
                {delivery.channel === 'email' ? (
                  <Mail className="w-4 h-4 mt-0.5 shrink-0 text-gray-500" />
                ) : (
                  <MessageSquare className="w-4 h-4 mt-0.5 shrink-0 text-gray-500" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900 break-words">
                    {channelName(delivery)} · {delivery.destination_masked}
                    {recipientLabel(delivery) && <span className="text-gray-500"> · {recipientLabel(delivery)}</span>}
                  </p>
                  <OutcomeBadge delivery={delivery} polling={polling} className="mt-1 inline-flex sm:hidden" />
                  {delivery.outcome_detail && <p className="mt-0.5 text-xs text-gray-600">{delivery.outcome_detail}</p>}
                </div>
                <OutcomeBadge delivery={delivery} polling={polling} className="hidden shrink-0 sm:inline-flex" />
              </div>
              {(delivery.can_confirm_receipt || canRetry) && (
                <div className="mt-2 flex flex-wrap gap-2 pl-7">
                  {delivery.can_confirm_receipt && (
                    <button
                      type="button"
                      onClick={() => void confirmReceived(delivery)}
                      disabled={busy}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-green-300 bg-white px-2.5 py-1.5 text-xs font-medium text-green-800 hover:bg-green-50 disabled:opacity-40"
                    >
                      <Smartphone className="w-3.5 h-3.5" />
                      Guest received it
                    </button>
                  )}
                  {canRetry && (
                    <button
                      type="button"
                      onClick={() => void retry(delivery)}
                      disabled={busy}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs hover:bg-gray-50 disabled:opacity-40"
                    >
                      <RefreshCcw className="w-3.5 h-3.5" />
                      Retry
                    </button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {(keepChecking || checkFailed || checkPaused) && (
        <button
          type="button"
          onClick={() => {
            setChecks(0);
            void refresh();
          }}
          disabled={checking}
          className="mt-3 inline-flex items-center gap-1.5 text-sm text-gray-700 underline underline-offset-2 disabled:opacity-50"
        >
          <RefreshCcw className={`w-4 h-4 ${checking ? 'animate-spin' : ''}`} />
          Check again now
        </button>
      )}
      {checkFailed && (
        <p className="mt-2 text-sm text-amber-800" aria-live="polite">
          {checks >= POLL_LIMIT
            ? 'This screen could not check the delivery status just now. Tap “Check again now” to try again.'
            : 'This screen could not check the delivery status just now. It will try again shortly.'}
        </p>
      )}
      {checkPaused && (
        <p className="mt-2 text-sm text-amber-800" aria-live="polite">
          Checking is paused for a minute because this sign-in checked very often. It tries again in a minute.
        </p>
      )}
      {notice && (
        <p className={`mt-3 text-sm ${notice.tone === 'success' ? 'text-green-800' : 'text-red-700'}`} aria-live="polite">
          {notice.text}
        </p>
      )}
    </div>
  );
};

export default DeliveryOutcomePanel;
