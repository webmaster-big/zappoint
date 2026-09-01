import { useCallback, useEffect, useState } from 'react';
import { CalendarX2, CheckCircle2, Loader2, X } from 'lucide-react';
import checkoutConcernService, {
  type ConcernEntityType,
} from '../../services/CheckoutConcernService';
import EmailInput from '../ui/EmailInput';

export interface ScheduleHelpModalProps {
  locationId?: number | null;
  entityType?: ConcernEntityType;
  entityId?: number | null;
  entityName?: string | null;
  preferredDate?: string;
  preferredTime?: string;
  defaultName?: string;
  defaultPhone?: string;
  defaultEmail?: string;
  className?: string;
}

const ScheduleHelpModal = ({
  locationId,
  entityType,
  entityId,
  entityName,
  preferredDate,
  preferredTime,
  defaultName = '',
  defaultPhone = '',
  defaultEmail = '',
  className = '',
}: ScheduleHelpModalProps) => {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(defaultName);
  const [phone, setPhone] = useState(defaultPhone);
  const [email, setEmail] = useState(defaultEmail);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [sentMessage, setSentMessage] = useState('');

  const close = useCallback(() => {
    setOpen(false);
    setError('');
    setSentMessage(prev => {
      if (prev) setMessage('');
      return '';
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    setName(prev => prev || defaultName);
    setPhone(prev => prev || defaultPhone);
    setEmail(prev => prev || defaultEmail);
  }, [open, defaultName, defaultPhone, defaultEmail]);

  useEffect(() => {
    if (!open) return;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    document.addEventListener('keydown', onEscape);
    return () => document.removeEventListener('keydown', onEscape);
  }, [open, close]);

  if (!locationId) return null;

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
      const confirmation = await checkoutConcernService.submitScheduleConcern({
        location_id: locationId,
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim() || undefined,
        message: message.trim() || undefined,
        entity_type: entityType,
        entity_id: entityId ?? undefined,
        entity_name: entityName ?? undefined,
        preferred_date: preferredDate || undefined,
        preferred_time: preferredTime || undefined,
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
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex items-center gap-1.5 text-xs font-semibold text-blue-800 hover:text-blue-900 hover:underline ${className}`}
      >
        <CalendarX2 size={14} />
        None of these times work — contact me
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-sm p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="schedule-help-title"
          onClick={close}
        >
          <div
            className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl shadow-2xl max-h-[92vh] overflow-y-auto"
            onClick={event => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-400">Schedule help</p>
                <h2 id="schedule-help-title" className="text-lg font-bold text-gray-900 leading-tight mt-0.5">
                  {sentMessage ? "We've got your details" : 'Tell us what you need'}
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
                    Nothing has been booked or charged. Keep browsing if you like — we will reach out on{' '}
                    <span className="font-semibold text-gray-700">{phone}</span>.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={close}
                  className="w-full bg-blue-800 hover:bg-blue-900 text-white px-4 py-3 font-semibold rounded-xl text-sm shadow-md"
                >
                  Back to booking
                </button>
              </div>
            ) : (
              <form onSubmit={submit} className="px-5 pb-5 space-y-3">
                <p className="text-sm text-gray-600 leading-relaxed">
                  Leave your name and number and the team at this venue will contact you about your
                  scheduling concern.
                </p>

                {(entityName || preferredDate) && (
                  <div className="rounded-xl bg-blue-50 border border-blue-100 px-3.5 py-2.5 text-xs text-blue-900">
                    {entityName && <div className="font-semibold">{entityName}</div>}
                    {preferredDate && (
                      <div className="text-blue-800/80">
                        Looking at {preferredDate}
                        {preferredTime ? ` · ${preferredTime}` : ''}
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <label htmlFor="schedule-help-name" className="block text-sm font-medium text-gray-900 mb-1.5">
                    Your name <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="schedule-help-name"
                    type="text"
                    value={name}
                    onChange={event => setName(event.target.value)}
                    autoComplete="name"
                    className="w-full border border-gray-300 rounded-lg px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition"
                    placeholder="Jamie Rivera"
                  />
                </div>

                <div>
                  <label htmlFor="schedule-help-phone" className="block text-sm font-medium text-gray-900 mb-1.5">
                    Mobile number <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="schedule-help-phone"
                    type="tel"
                    value={phone}
                    onChange={event => setPhone(event.target.value)}
                    autoComplete="tel"
                    className="w-full border border-gray-300 rounded-lg px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition"
                    placeholder="(810) 555-0134"
                  />
                </div>

                <div>
                  <label htmlFor="schedule-help-email" className="block text-sm font-medium text-gray-900 mb-1.5">
                    Email <span className="text-gray-400 font-normal">(optional)</span>
                  </label>
                  <EmailInput
                    id="schedule-help-email"
                    value={email}
                    onChange={event => setEmail(event.target.value)}
                    autoComplete="email"
                    className="w-full border border-gray-300 rounded-lg px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition"
                    placeholder="you@example.com"
                  />
                </div>

                <div>
                  <label htmlFor="schedule-help-message" className="block text-sm font-medium text-gray-900 mb-1.5">
                    What would work better? <span className="text-gray-400 font-normal">(optional)</span>
                  </label>
                  <textarea
                    id="schedule-help-message"
                    value={message}
                    onChange={event => setMessage(event.target.value)}
                    rows={3}
                    maxLength={1000}
                    className="w-full border border-gray-300 rounded-lg px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition resize-none"
                    placeholder="We need a Saturday morning slot for 16 kids."
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
                  {submitting && <Loader2 size={16} className="animate-spin" />}
                  {submitting ? 'Sending…' : 'Send this to the venue'}
                </button>

                <p className="text-[11px] text-gray-400 text-center leading-relaxed">
                  This does not book or charge anything. We only use these details to contact you about
                  this request.
                </p>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default ScheduleHelpModal;
