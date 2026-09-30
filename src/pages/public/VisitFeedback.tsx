import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { CheckCircle2, ExternalLink, Loader2, RefreshCw, Star } from 'lucide-react';
import visitFollowUpService from '../../services/VisitFollowUpService';
import type { VisitFeedbackPage } from '../../types/visitFollowUp.types';

const LABELS: Record<number, string> = {
  1: 'Poor',
  2: 'Not great',
  3: 'Okay',
  4: 'Great',
  5: 'Amazing',
};

const formatDay = (value: string | null): string => {
  if (!value) return '';
  const [year, month, day] = value.split('T')[0].split('-').map(Number);

  return new Date(year, month - 1, day).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
};

const errorMessage = (error: unknown, fallback: string): string =>
  (error as { response?: { data?: { message?: string } } }).response?.data?.message ?? fallback;

const VisitFeedback = () => {
  const { token = '' } = useParams<{ token: string }>();
  const [searchParams] = useSearchParams();
  const requestedRating = Number(searchParams.get('rating'));
  const wantsUnsubscribe = searchParams.get('unsubscribe') === '1';

  const [page, setPage] = useState<VisitFeedbackPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<'missing' | 'failed' | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [rating, setRating] = useState<number>(requestedRating >= 1 && requestedRating <= 5 ? requestedRating : 0);
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    visitFollowUpService
      .getFeedback(token)
      .then((data) => {
        if (!alive) return;
        setPage(data);
        document.title = `${data.opt_out_only ? 'Email preferences' : 'Rate your visit'} · ${data.brand_name ?? data.location_name ?? data.company_name ?? 'Feedback'}`;
        setComment(data.comment ?? '');
        if (data.rating && !(requestedRating >= 1 && requestedRating <= 5)) {
          setRating(data.rating);
        }
        setSaved(data.rating !== null && !(requestedRating >= 1 && requestedRating <= 5 && requestedRating !== data.rating));
      })
      .catch((e) => {
        if (!alive) return;
        const status = (e as { response?: { status?: number } }).response?.status;
        setLoadError(status === 404 ? 'missing' : 'failed');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [token, requestedRating, attempt]);

  const submit = async () => {
    if (rating < 1) {
      setError('Tap a star to choose your rating.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      setPage(await visitFollowUpService.rate(token, rating, comment));
      setSaved(true);
    } catch (e) {
      setError(errorMessage(e, 'Your rating could not be saved. Please try again.'));
    } finally {
      setSaving(false);
    }
  };

  const unsubscribe = async () => {
    setSaving(true);
    setError(null);
    try {
      setPage(await visitFollowUpService.unsubscribe(token));
    } catch (e) {
      setError(errorMessage(e, 'That did not work. Please try again.'));
    } finally {
      setSaving(false);
    }
  };

  const venue = page?.location_name ?? page?.brand_name ?? page?.company_name ?? 'us';
  const showUnsubscribe = wantsUnsubscribe || page?.opt_out_only === true;

  return (
    <div className="min-h-screen bg-gray-50 flex items-start sm:items-center justify-center px-4 py-10">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-200 p-6 sm:p-8">
        {loading ? (
          <div className="flex flex-col items-center py-10 text-gray-500">
            <Loader2 className="w-7 h-7 animate-spin mb-3" />
            <p className="text-sm">Loading…</p>
          </div>
        ) : loadError === 'failed' ? (
          <div className="text-center py-6 space-y-4">
            <h1 className="text-lg font-semibold text-gray-900">We could not load this page</h1>
            <p className="text-sm text-gray-600">Check your connection and try again in a moment.</p>
            <button
              type="button"
              onClick={() => {
                setLoading(true);
                setLoadError(null);
                setAttempt((value) => value + 1);
              }}
              className="inline-flex items-center justify-center gap-2 w-full min-h-[44px] rounded-lg bg-gray-900 text-white text-sm font-semibold hover:bg-gray-700"
            >
              <RefreshCw className="w-4 h-4" />
              Try again
            </button>
          </div>
        ) : loadError === 'missing' || !page ? (
          <div className="text-center py-6">
            <h1 className="text-lg font-semibold text-gray-900">We could not find this link</h1>
            <p className="text-sm text-gray-600 mt-2">Open it again from your email, making sure the whole link was copied.</p>
          </div>
        ) : showUnsubscribe ? (
          <div className="text-center space-y-4">
            {page.unsubscribed ? (
              <>
                <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
                <h1 className="text-lg font-semibold text-gray-900">You are unsubscribed</h1>
                <p className="text-sm text-gray-600">We will not send you any more review requests or offers. Thanks for letting us know.</p>
              </>
            ) : (
              <>
                <h1 className="text-lg font-semibold text-gray-900">Stop review requests and offers?</h1>
                <p className="text-sm text-gray-600">
                  We will stop asking you to rate your visits and stop sending you return-visit offers from{' '}
                  {page.company_name ?? venue}, at all of our locations. Booking confirmations, receipts and your photos still arrive as usual.
                </p>
                <button
                  type="button"
                  onClick={() => void unsubscribe()}
                  disabled={saving}
                  className="w-full min-h-[44px] rounded-lg bg-gray-900 text-white text-sm font-semibold hover:bg-gray-700 disabled:opacity-50"
                >
                  {saving ? 'Saving…' : 'Yes, unsubscribe me'}
                </button>
              </>
            )}
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>
        ) : (
          <div className="space-y-5">
            <div className="text-center">
              <h1 className="text-xl font-semibold text-gray-900">
                {saved ? 'Thank you!' : `How was ${page.activity_name ?? 'your visit'}?`}
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                {page.first_name ? `${page.first_name}, t` : 'T'}hanks for visiting {venue}
                {page.visit_date ? ` on ${formatDay(page.visit_date)}` : ''}.
              </p>
            </div>

            <div className="flex justify-center gap-1" role="radiogroup" aria-label="Your rating">
              {[1, 2, 3, 4, 5].map((stars) => (
                <button
                  key={stars}
                  type="button"
                  role="radio"
                  aria-checked={rating === stars}
                  aria-label={`${stars} ${stars === 1 ? 'star' : 'stars'}, ${LABELS[stars]}`}
                  onClick={() => {
                    setRating(stars);
                    setSaved(false);
                  }}
                  className="p-1.5 rounded-lg hover:bg-amber-50"
                >
                  <Star className={`w-10 h-10 ${stars <= rating ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`} />
                </button>
              ))}
            </div>
            <p className="text-center text-sm font-medium text-gray-700 h-5">{rating > 0 ? LABELS[rating] : 'Tap a star'}</p>

            <div>
              <label htmlFor="feedback-comment" className="block text-sm font-medium text-gray-700 mb-1">
                Anything you'd like to tell us? <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <textarea
                id="feedback-comment"
                value={comment}
                maxLength={2000}
                onChange={(event) => {
                  setComment(event.target.value);
                  setSaved(false);
                }}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            {saved ? (
              <p className="flex items-center justify-center gap-2 text-sm text-emerald-700">
                <CheckCircle2 className="w-4 h-4" />
                Your feedback is saved. Our team reads every one.
              </p>
            ) : (
              <button
                type="button"
                onClick={() => void submit()}
                disabled={saving || rating < 1}
                className="w-full min-h-[44px] rounded-lg bg-gray-900 text-white text-sm font-semibold hover:bg-gray-700 disabled:opacity-50"
              >
                {saving ? 'Sending…' : page.rating ? 'Update my rating' : 'Send my rating'}
              </button>
            )}

            {saved && page.review_url && (
              <div className="pt-4 border-t border-gray-100 text-center space-y-3">
                <p className="text-sm text-gray-700">Would you share it publicly too? It helps other groups find us.</p>
                <a
                  href={page.review_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 w-full min-h-[44px] rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700"
                >
                  Leave a public review
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default VisitFeedback;
