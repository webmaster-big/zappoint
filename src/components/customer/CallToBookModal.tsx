import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Loader2, Phone, PhoneCall, X } from 'lucide-react';
import checkoutConcernService, {
  type ConcernEntityType,
} from '../../services/CheckoutConcernService';
import { getGuestIdentity } from '../../utils/guestIdentity';

export interface CallToBookModalProps {
  open: boolean;
  onClose: () => void;
  locationId?: number | null;
  venueName?: string | null;
  venuePhone?: string | null;
  entityType?: ConcernEntityType;
  entityId?: number | null;
  entityName?: string | null;
}

const CallToBookModal = ({
  open,
  onClose,
  locationId,
  venueName,
  venuePhone,
  entityType,
  entityId,
  entityName,
}: CallToBookModalProps) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [sentMessage, setSentMessage] = useState('');

  const close = useCallback(() => {
    setError('');
    setSentMessage(prev => {
      if (prev) setMessage('');
      return '';
    });
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const identity = getGuestIdentity();
    if (identity) {
      setName(prev => prev || identity.name);
      setPhone(prev => prev || identity.phone);
      setEmail(prev => prev || identity.email || '');
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    document.addEventListener('keydown', onEscape);
    return () => document.removeEventListener('keydown', onEscape);
  }, [open, close]);

  if (!open || !locationId) return null;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    if (name.trim().length < 2) {
      setError('Please tell us your name.');
      return;
    }
    if (phone.replace(/\D/g, '').length < 7) {
      setError('Please give us a number we can reach you on.');
      return;
    }

    setSubmitting(true);

    try {
      const confirmation = await checkoutConcernService.submitCallToBook({
        location_id: locationId,
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim() || undefined,
        message: message.trim() || undefined,
        entity_type: entityType,
        entity_id: entityId ?? undefined,
        entity_name: entityName ?? undefined,
        context: {
          page_url: typeof window !== 'undefined' ? window.location.href : undefined,
        },
      });
      setSentMessage(confirmation);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'We could not send that. Please call the venue directly.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-sm p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="call-to-book-title"
      onClick={close}
    >
      <div
        className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl shadow-2xl max-h-[92vh] overflow-y-auto"
        onClick={event => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-400">Call to book</p>
            <h2 id="call-to-book-title" className="text-lg font-bold text-gray-900 leading-tight mt-0.5">
              {sentMessage ? "We've got your details" : 'This one is booked by phone'}
            </h2>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="p-1.5 -mr-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X size={18} />
          </button>
        </div>

        {sentMessage ? (
          <div className="px-5 pb-5 pt-2">
            <div className="flex flex-col items-center text-center gap-3 py-4">
              <CheckCircle2 size={44} className="text-emerald-500" />
              <p className="text-sm text-gray-700 leading-relaxed">{sentMessage}</p>
              <p className="text-xs text-gray-500">
                Nothing has been booked or charged. We will reach out on{' '}
                <span className="font-semibold text-gray-700">{phone}</span>.
              </p>
            </div>
            <button
              type="button"
              onClick={close}
              className="w-full bg-blue-800 hover:bg-blue-900 text-white px-4 py-3 font-semibold rounded-xl text-sm shadow-md"
            >
              Back to browsing
            </button>
          </div>
        ) : (
          <div className="px-5 pb-5 space-y-4">
            {entityName && (
              <div className="rounded-xl bg-blue-50 border border-blue-100 px-3.5 py-2.5 text-xs text-blue-900">
                <div className="font-semibold">{entityName}</div>
                <div className="text-blue-800/80">Scheduled personally with the venue</div>
              </div>
            )}

            <div className="rounded-2xl border border-teal-100 bg-teal-50 px-4 py-4 text-center">
              <p className="text-sm font-semibold text-teal-900">{venueName || 'This venue'}</p>
              {venuePhone ? (
                <>
                  <a
                    href={`tel:${venuePhone}`}
                    className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-teal-700 hover:bg-teal-800 px-4 py-3 text-sm font-semibold text-white shadow-md"
                  >
                    <PhoneCall size={16} />
                    Call {venuePhone}
                  </a>
                  <p className="mt-2 text-[11px] text-teal-800/80">
                    Fastest option — the team can check dates and book you on the spot.
                  </p>
                </>
              ) : (
                <p className="mt-1 text-xs text-teal-800/80">Leave your details below and the team will call you.</p>
              )}
            </div>

            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-gray-200" />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                or let us call you
              </span>
              <div className="h-px flex-1 bg-gray-200" />
            </div>

            <form onSubmit={submit} className="space-y-3">
              <div>
                <label htmlFor="call-to-book-name" className="block text-sm font-medium text-gray-900 mb-1.5">
                  Your name <span className="text-red-500">*</span>
                </label>
                <input
                  id="call-to-book-name"
                  type="text"
                  value={name}
                  onChange={event => setName(event.target.value)}
                  autoComplete="name"
                  className="w-full border border-gray-300 rounded-lg px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition"
                  placeholder="Jamie Rivera"
                />
              </div>

              <div>
                <label htmlFor="call-to-book-phone" className="block text-sm font-medium text-gray-900 mb-1.5">
                  Mobile number <span className="text-red-500">*</span>
                </label>
                <input
                  id="call-to-book-phone"
                  type="tel"
                  value={phone}
                  onChange={event => setPhone(event.target.value)}
                  autoComplete="tel"
                  className="w-full border border-gray-300 rounded-lg px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition"
                  placeholder="(810) 555-0134"
                />
              </div>

              <div>
                <label htmlFor="call-to-book-message" className="block text-sm font-medium text-gray-900 mb-1.5">
                  What would you like to book? <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <textarea
                  id="call-to-book-message"
                  value={message}
                  onChange={event => setMessage(event.target.value)}
                  rows={3}
                  maxLength={1000}
                  className="w-full border border-gray-300 rounded-lg px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition resize-none"
                  placeholder="A Saturday afternoon for 12 people, if possible."
                />
              </div>

              {error && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-blue-800 hover:bg-blue-900 disabled:opacity-60 disabled:cursor-not-allowed text-white px-4 py-3 font-semibold rounded-xl inline-flex items-center justify-center gap-2 text-sm shadow-md"
              >
                {submitting ? <Loader2 size={16} className="animate-spin" /> : <Phone size={15} />}
                {submitting ? 'Sending…' : 'Request a call back'}
              </button>

              <p className="text-[11px] text-gray-400 text-center leading-relaxed">
                This does not book or charge anything. We only use these details to contact you about
                this request.
              </p>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

export default CallToBookModal;
