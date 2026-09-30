import type { FollowUpRow, VisitFollowUpSummary } from '../types/visitFollowUp.types';

export const followUpEmailName = (name: string | null | undefined, fallback: string): string =>
  (name ?? '').replace(/\s*\((Customer|Guest)\)\s*$/i, '').trim() || fallback;

export const formatFollowUpTime = (value: string | null): string =>
  value
    ? new Date(value).toLocaleString('en-US', { timeZone: 'America/Detroit', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    : '';

const when = formatFollowUpTime;

const STATUS_WORDS: Record<FollowUpRow['status'], string> = {
  scheduled: 'Scheduled',
  sending: 'Sending',
  sent: 'Sent',
  failed: 'Not delivered',
  skipped: 'Not sent',
  canceled: 'Canceled',
};

export const followUpStatusLine = (row: FollowUpRow): string => {
  switch (row.status) {
    case 'scheduled':
      return `Goes out ${formatFollowUpTime(row.due_at)}`;
    case 'sent':
      return `Sent ${formatFollowUpTime(row.sent_at)}`;
    case 'failed':
      return row.gave_up ? 'Could not be delivered after 3 tries' : 'Delivery failed, trying again soon';
    default:
      return row.error ?? STATUS_WORDS[row.status];
  }
};

export const describeFollowUp = (summary: VisitFollowUpSummary | null | undefined): string | null => {
  if (!summary || !summary.available) return null;

  const thanksName = followUpEmailName(summary.thanks_email.name, 'Thanks for Playing');

  if (summary.handled_by_game) {
    return summary.thanks_email.active
      ? `This is an escape-room booking, so the ${thanksName} email goes out from the game screen with the group photo.`
      : `This is an escape-room booking, and the ${thanksName} email is switched off, so nothing is emailed from the game screen.`;
  }

  const thanks = summary.thanks.find((row) => row.is_current_recipient) ?? summary.thanks[summary.thanks.length - 1];
  const review = summary.reviews.find((row) => row.status === 'scheduled');
  const parts: string[] = [];

  if (thanks?.status === 'sent' && thanks.sent_in_this_action) {
    parts.push(`The ${thanksName} email went to ${thanks.recipient_email_masked}.`);
  } else if (thanks?.status === 'sent') {
    parts.push(`The ${thanksName} email was already sent to ${thanks.recipient_email_masked} on ${when(thanks.sent_at)}, so it was not sent again.`);
  } else if (thanks?.status === 'failed') {
    parts.push(`The ${thanksName} email could not be sent yet and will be retried.`);
  } else if (thanks?.status === 'skipped' && thanks.reason === 'visit_date') {
    parts.push(thanks.error ?? 'Nothing was sent automatically because of the visit date.');
  } else if (!summary.thanks_email.active) {
    parts.push(`The ${thanksName} email is switched off, so no thank-you email went out.`);
  } else if (!summary.recipient_email_masked) {
    parts.push('No email address on file, so no follow-up email went out.');
  }

  if (review) {
    parts.push(`Review request goes out ${when(review.due_at)}.`);
  }

  return parts.length > 0 ? parts.join(' ') : null;
};
