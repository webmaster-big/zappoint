import { useEffect, useState } from 'react';
import { History, Loader2, X } from 'lucide-react';
import StandardButton from '../../ui/StandardButton';
import eventRegistrationService from '../../../services/EventRegistrationService';
import type { RegistrationHistoryResponse } from '../../../types/eventRegistration.types';
import { formatDateLong, formatDateTimeET } from '../../../utils/timeFormat';
import { formatPhoneForDisplay } from '../../../utils/bookingSearch';
import { locationDisplayName } from '../../../utils/locationName';
import { LAST_YEAR_CHIP, THIS_FORM_CHIP, describeFailure } from './registrationEventUi';
import { useThemeColor } from '../../../hooks/useThemeColor';

interface ContactHistoryModalProps {
  eventId: number;
  contactId: number;
  onClose: () => void;
}

const ContactHistoryModal = ({ eventId, contactId, onClose }: ContactHistoryModalProps) => {
  const { themeColor } = useThemeColor();
  const [history, setHistory] = useState<RegistrationHistoryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setHistory(null);
    setError(null);
    eventRegistrationService
      .getContactHistory(eventId, contactId)
      .then((result) => {
        if (!cancelled) setHistory(result);
      })
      .catch((failure: unknown) => {
        if (!cancelled) setError(describeFailure(failure, 'The registration history could not be loaded.').message);
      });
    return () => {
      cancelled = true;
    };
  }, [eventId, contactId]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-backdrop-fade"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col relative animate-scale-in"
        role="dialog"
        aria-modal="true"
        aria-labelledby="registration-history-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`p-2 rounded-lg bg-${themeColor}-100 flex-shrink-0`}>
              <History className={`w-5 h-5 text-${themeColor}-600`} aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h3 id="registration-history-title" className="text-lg font-bold text-gray-900">
                Registration History
              </h3>
              <p className="text-xs text-gray-500">Shows registrations only — not who attended.</p>
            </div>
          </div>
          <StandardButton
            onClick={onClose}
            variant="ghost"
            size="sm"
            icon={X}
            title="Close"
            className="text-gray-400 hover:text-gray-600"
          />
        </div>

        <div className="px-6 py-5 overflow-y-auto space-y-4">
          {error ? (
            <p className="text-sm text-red-700" role="alert">{error}</p>
          ) : !history ? (
            <div className="py-12 flex justify-center" role="status">
              <Loader2 className={`w-6 h-6 animate-spin text-${themeColor}-600`} aria-hidden="true" />
              <span className="sr-only">Loading…</span>
            </div>
          ) : (
            <>
              <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700 space-y-0.5">
                <p className="font-medium text-gray-900 break-all">{history.contact.email}</p>
                <p>{formatPhoneForDisplay(history.contact.phone) || history.contact.phone}</p>
                <p className="text-xs text-gray-500 pt-1">
                  These contact details are one shared record across your registration forms.
                </p>
              </div>

              <ul className="divide-y divide-gray-100 border border-gray-100 rounded-lg">
                {history.history.map((item) => (
                  <li key={item.entry_id} className="px-4 py-3 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-gray-900">{item.event_name}</span>
                      {item.is_current_event && (
                        <span className={THIS_FORM_CHIP}>This form</span>
                      )}
                      {item.is_previous_edition && (
                        <span className={LAST_YEAR_CHIP}>Last year&apos;s edition</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600">
                      {formatDateLong(item.event_date)}
                      {item.location_name ? ` · ${locationDisplayName(item.location_name)}` : ''}
                    </p>
                    <p className="text-sm text-gray-700">
                      Registered {formatDateTimeET(item.registered_at)}
                      {item.name ? (
                        <>
                          {' '}as <span className="font-medium">{item.name}</span>
                        </>
                      ) : null}
                    </p>
                  </li>
                ))}
              </ul>

              {history.other_location_registrations > 0 && (
                <p className="text-sm text-gray-600">
                  Also registered for {history.other_location_registrations} form{history.other_location_registrations === 1 ? '' : 's'} at
                  other locations.
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ContactHistoryModal;
