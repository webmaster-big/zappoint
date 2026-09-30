import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MailCheck, Star } from 'lucide-react';
import visitFollowUpService from '../../../services/VisitFollowUpService';
import { followUpEmailName, followUpStatusLine, formatFollowUpTime } from '../../../utils/visitFollowUpNotice';
import type { FollowUpRow, FollowUpStatus, VisitFollowUpSummary } from '../../../types/visitFollowUp.types';

type StaffVisitType = 'booking' | 'event_purchase';

interface VisitFollowUpCardProps {
  visitType: StaffVisitType;
  visitId: number;
  themeColor: string;
  className?: string;
  refreshKey?: string | number;
}

const STATUS_LABELS: Record<FollowUpStatus, string> = {
  scheduled: 'Scheduled',
  sending: 'Sending',
  sent: 'Sent',
  failed: 'Not delivered',
  skipped: 'Not sent',
  canceled: 'Canceled',
};

const STATUS_STYLES: Record<FollowUpStatus, string> = {
  scheduled: 'bg-blue-50 text-blue-800 border-blue-200',
  sending: 'bg-blue-50 text-blue-800 border-blue-200',
  sent: 'bg-green-50 text-green-800 border-green-200',
  failed: 'bg-red-50 text-red-800 border-red-200',
  skipped: 'bg-gray-50 text-gray-700 border-gray-200',
  canceled: 'bg-gray-50 text-gray-700 border-gray-200',
};

export const RatingStars = ({ rating }: { rating: number }) => (
  <span className="inline-flex items-center gap-0.5" aria-label={`${rating} out of 5 stars`}>
    {[1, 2, 3, 4, 5].map((star) => (
      <Star key={star} className={`w-3.5 h-3.5 ${star <= rating ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`} />
    ))}
  </span>
);

const errorMessage = (error: unknown, fallback: string): string =>
  (error as { response?: { data?: { message?: string } } }).response?.data?.message ?? fallback;

const VisitFollowUpCard = ({ visitType, visitId, themeColor, className = '', refreshKey }: VisitFollowUpCardProps) => {
  const [summary, setSummary] = useState<VisitFollowUpSummary | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      setSummary(await visitFollowUpService.getForVisit(visitType, visitId));
    } catch {
      setSummary(null);
    }
  }, [visitType, visitId]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  if (!summary || !summary.available) return null;

  const thanksName = followUpEmailName(summary.thanks_email.name, 'Thanks for Playing');
  const reviewName = followUpEmailName(summary.review_email.name, 'Review Request');
  const hours = summary.review_email.hours ?? 24;
  const noun = visitType === 'booking' ? 'booking' : 'purchase';
  const rows = [...summary.thanks, ...summary.reviews];
  const maxAge = summary.max_visit_age_days ?? 3;
  const hasCurrentThanks = summary.thanks.some((row) => row.is_current_recipient);
  const oldAddressOnly = summary.thanks.length > 0 && !hasCurrentThanks;

  const act = async (key: string, action: () => Promise<VisitFollowUpSummary | { message: string; data: VisitFollowUpSummary }>, success: string) => {
    setBusy(key);
    setNotice(null);
    try {
      const result = await action();
      const next = 'data' in result && 'message' in result ? result.data : (result as VisitFollowUpSummary);
      setSummary(next);
      setNotice({ ok: true, text: 'message' in result ? result.message : success });
    } catch (error) {
      setNotice({ ok: false, text: errorMessage(error, 'That did not work. Please try again.') });
      void load();
    } finally {
      setBusy(null);
    }
  };

  const renderRow = (row: FollowUpRow) => {
    const isReview = row.kind === 'review';
    const canSendNow = summary.completed
      && ['scheduled', 'failed', 'skipped', 'canceled'].includes(row.status)
      && row.is_current_recipient !== false
      && !['opted_out', 'redirected', 'left_game'].includes(row.reason ?? '')
      && !(isReview && row.reason === 'asked_recently');
    const sendLabel = row.status === 'failed' ? 'Try again' : row.attempts > 0 ? 'Send again' : 'Send now';
    const canCancel = row.status === 'scheduled' || (row.status === 'failed' && !row.gave_up);

    return (
      <li key={row.id} className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 py-2">
        <div className="min-w-0">
          <p className="text-sm text-gray-900">
            {isReview ? reviewName : thanksName}
            <span className={`ml-2 inline-flex items-center px-2 py-0.5 rounded-full border text-xs font-medium ${STATUS_STYLES[row.status]}`}>
              {STATUS_LABELS[row.status]}
            </span>
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            To {row.recipient_email_masked} · {followUpStatusLine(row)}
          </p>
          {row.status === 'failed' && row.error && <p className="text-xs text-red-600 mt-0.5 break-words">{row.error}</p>}
          {row.rating !== null && (
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-700">
              <RatingStars rating={row.rating} />
              <span>Rated {formatFollowUpTime(row.rated_at)}</span>
              {row.comment && <span className="italic text-gray-600 break-words">&ldquo;{row.comment}&rdquo;</span>}
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          {canSendNow && (
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void act(`send-${row.id}`, () => visitFollowUpService.sendNow(row.id), 'Email sent.')}
              className="min-h-[34px] px-3 py-1.5 rounded-lg border border-gray-300 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {busy === `send-${row.id}` ? 'Sending…' : sendLabel}
            </button>
          )}
          {canCancel && (
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void act(`cancel-${row.id}`, () => visitFollowUpService.cancel(row.id), 'The email will not be sent.')}
              className="min-h-[34px] px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-100 disabled:opacity-50"
            >
              {busy === `cancel-${row.id}` ? 'Canceling…' : 'Don’t send'}
            </button>
          )}
        </div>
      </li>
    );
  };

  return (
    <div className={`bg-white rounded-xl border border-gray-200 p-5 ${className}`}>
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-lg bg-${themeColor}-50`}>
          <MailCheck className={`w-5 h-5 text-${themeColor}-700`} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-900">Follow-up emails</p>

          {summary.is_ticket_order_line ? (
            <p className="text-sm text-gray-600 mt-0.5">
              This ticket belongs to a bulk ticket order. Orders are checked in but never marked Completed, so follow-up emails are not sent
              for them.
            </p>
          ) : summary.handled_by_game ? (
            <p className="text-sm text-gray-600 mt-0.5">
              {summary.thanks_email.active
                ? `This is an escape-room booking. ${thanksName} goes to the players from the game screen when staff press Complete & Send, with the group photo and finish time.`
                : `This is an escape-room booking, and ${thanksName} is switched off, so the group photo cannot be emailed from the game screen.`}
              {summary.review_email.active ? ` Each player gets ${reviewName} afterwards.` : ''}
            </p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-gray-600 mt-0.5">
              {summary.completed
                ? summary.recipient_email_masked
                  ? `Nothing has been sent for this ${noun} yet.`
                  : `This ${noun} has no email address, so no follow-up emails can be sent.`
                : `When this ${noun} is set to Completed, ${thanksName} goes to ${summary.recipient_email_masked ?? 'the guest'} right away and ${reviewName} follows about ${hours} ${hours === 1 ? 'hour' : 'hours'} later (never overnight). Visits more than ${maxAge} days old or still ahead are not emailed automatically.`}
            </p>
          ) : null}

          {!summary.is_ticket_order_line && (!summary.thanks_email.active || !summary.review_email.active) && (
            <p className="text-xs text-amber-700 mt-1">
              {!summary.thanks_email.active && `${thanksName} is switched off in Email Notifications. `}
              {!summary.review_email.active && `${reviewName} is switched off in Email Notifications.`}
            </p>
          )}

          {summary.thanks_email.promo?.problem && !summary.handled_by_game && (
            <p className="text-xs text-amber-700 mt-1">{summary.thanks_email.promo.problem}</p>
          )}

          {rows.length > 0 && <ul className="mt-2 divide-y divide-gray-100">{rows.map(renderRow)}</ul>}

          {summary.can_send_thanks && !hasCurrentThanks && (
            <button
              type="button"
              disabled={busy !== null}
              onClick={() =>
                void act('thanks', () => visitFollowUpService.sendThanks(visitType, visitId), `${thanksName} sent.`)
              }
              className={`mt-3 min-h-[36px] px-3 py-1.5 rounded-lg bg-${themeColor}-700 text-xs font-semibold text-white hover:bg-${themeColor}-900 disabled:opacity-50`}
            >
              {busy === 'thanks'
                ? 'Sending…'
                : oldAddressOnly && summary.recipient_email_masked
                  ? `Send ${thanksName} to ${summary.recipient_email_masked}`
                  : `Send ${thanksName} now`}
            </button>
          )}

          {notice && <p className={`text-xs mt-2 ${notice.ok ? 'text-green-700' : 'text-red-600'}`}>{notice.text}</p>}

          <p className="text-xs text-gray-500 mt-2">
            Edit the wording and promo code in{' '}
            {summary.thanks_email.id ? (
              <Link to={`/admin/email/notifications/edit/${summary.thanks_email.id}`} className="underline">
                {thanksName}
              </Link>
            ) : (
              thanksName
            )}
            {' '}and{' '}
            {summary.review_email.id ? (
              <Link to={`/admin/email/notifications/edit/${summary.review_email.id}`} className="underline">
                {reviewName}
              </Link>
            ) : (
              reviewName
            )}
            .
          </p>
        </div>
      </div>
    </div>
  );
};

export default VisitFollowUpCard;
