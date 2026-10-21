import { useEffect, useState } from 'react';
import { History, Loader2, X } from 'lucide-react';
import eventRegistrationService from '../../../services/EventRegistrationService';
import type { RegistrationHistoryResponse } from '../../../types/eventRegistration.types';
import { formatDateLong, formatDateTimeET } from '../../../utils/timeFormat';
import { formatPhoneForDisplay } from '../../../utils/bookingSearch';
import { locationDisplayName } from '../../../utils/locationName';
import { LAST_YEAR_CHIP, REGISTERED_BEFORE_CHIP, describeFailure } from './registrationEventUi';

interface ContactHistoryModalProps {
  eventId: number;
  contactId: number;
  onClose: () => void;
}

const ContactHistoryModal = ({ eventId, contactId, onClose }: ContactHistoryModalProps) => {
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
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="bg-white w-full sm:max-w-2xl rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[90vh] flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-labelledby="registration-history-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-gray-100 px-5 py-4 flex items-start justify-between gap-3">
          <div>
            <h2 id="registration-history-title" className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <History className="h-5 w-5 text-gray-500" aria-hidden="true" />
              Registration history
            </h2>
            <p className="text-sm text-gray-600 mt-0.5">Shows registrations only — not who attended.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1.5 rounded-md text-gray-400 hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-4">
          {error ? (
            <p className="text-sm text-red-700" role="alert">{error}</p>
          ) : !history ? (
            <div className="flex items-center gap-2 text-sm text-gray-500" role="status">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Loading…
            </div>
          ) : (
            <>
              <div className="rounded-md border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700 space-y-0.5">
                <p className="font-medium text-gray-900 break-all">{history.contact.email}</p>
                <p>{formatPhoneForDisplay(history.contact.phone) || history.contact.phone}</p>
                <p className="text-xs text-gray-500 pt-1">
                  These contact details are one shared record across your registration forms.
                </p>
              </div>

              <ul className="divide-y divide-gray-100 border border-gray-100 rounded-md">
                {history.history.map((item) => (
                  <li key={item.entry_id} className="px-4 py-3 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-gray-900">{item.event_name}</span>
                      {item.is_current_event && (
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${REGISTERED_BEFORE_CHIP}`}>This form</span>
                      )}
                      {item.is_previous_edition && (
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${LAST_YEAR_CHIP}`}>Last year&apos;s edition</span>
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
