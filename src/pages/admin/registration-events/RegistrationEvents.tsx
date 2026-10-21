import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CalendarDays, ClipboardList, MapPin, Pencil, Plus, Trash2, Users } from 'lucide-react';
import StandardButton from '../../../components/ui/StandardButton';
import Toast from '../../../components/ui/Toast';
import RegistrationEventFormModal from '../../../components/admin/registration-events/RegistrationEventFormModal';
import {
  STATUS_LABELS,
  STATUS_PILL,
  describeFailure,
} from '../../../components/admin/registration-events/registrationEventUi';
import eventRegistrationService from '../../../services/EventRegistrationService';
import type { RegistrationEventDetail, RegistrationEventSummary } from '../../../types/eventRegistration.types';
import { useLocationScope } from '../../../contexts/LocationContext';
import { formatDateLong } from '../../../utils/timeFormat';
import { locationDisplayName } from '../../../utils/locationName';

type ToastState = { message: string; type: 'success' | 'error' | 'info' } | null;

const RegistrationEvents = () => {
  const navigate = useNavigate();
  const { effectiveLocationId, isCompanyAdmin } = useLocationScope();
  const [events, setEvents] = useState<RegistrationEventSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const [modalEventId, setModalEventId] = useState<number | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const sequence = useRef(0);

  const load = useCallback(async () => {
    const current = ++sequence.current;
    setLoading(true);
    setLoadError(null);
    try {
      const result = await eventRegistrationService.listEvents({ location_id: effectiveLocationId ?? undefined });
      if (current !== sequence.current) return;
      setEvents(result);
    } catch (error: unknown) {
      if (current !== sequence.current) return;
      setLoadError(describeFailure(error, 'Registration forms could not be loaded.').message);
    } finally {
      if (current === sequence.current) setLoading(false);
    }
  }, [effectiveLocationId]);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = () => {
    setModalEventId(null);
    setShowModal(true);
  };

  const openEdit = (id: number) => {
    setModalEventId(id);
    setShowModal(true);
  };

  const closeModal = useCallback(() => setShowModal(false), []);

  const handleSaved = (event: RegistrationEventDetail, created: boolean) => {
    setShowModal(false);
    if (created) {
      navigate(`/registration-events/${event.id}`);
      return;
    }
    setToast({ message: 'Registration form saved', type: 'success' });
    void load();
  };

  const remove = async (event: RegistrationEventSummary) => {
    const confirmed = window.confirm(
      `Delete "${event.name}"? Its QR code and link will stop working and its registrations will no longer count in other forms' history. To stop new sign-ups but keep everything, close the form instead.`,
    );
    if (!confirmed) return;
    setDeletingId(event.id);
    try {
      await eventRegistrationService.deleteEvent(event.id);
      setToast({ message: 'Registration form deleted', type: 'success' });
      void load();
    } catch (error: unknown) {
      setToast({ message: describeFailure(error, 'The form could not be deleted.').message, type: 'error' });
    } finally {
      setDeletingId(null);
    }
  };

  const showVenue = isCompanyAdmin && effectiveLocationId === null;

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Registration Forms</h1>
          <p className="text-gray-600 text-sm mt-1">
            A separate sign-up form and QR code for each event. Forms close automatically after the event date.
          </p>
        </div>
        <StandardButton variant="primary" size="md" icon={Plus} onClick={openCreate}>
          New registration form
        </StandardButton>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-700">
            {events.length} form{events.length === 1 ? '' : 's'}
          </span>
          <span className="text-xs text-gray-500">Newest event first</span>
        </div>

        {loading && events.length === 0 ? (
          <div className="p-4 space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-gray-100 rounded-md animate-pulse" />
            ))}
          </div>
        ) : loadError ? (
          <div className="p-8 text-center space-y-3">
            <p className="text-sm text-red-700" role="alert">{loadError}</p>
            <StandardButton variant="secondary" size="sm" onClick={() => void load()}>
              Try again
            </StandardButton>
          </div>
        ) : events.length === 0 ? (
          <div className="p-10 text-center">
            <ClipboardList className="w-10 h-10 mx-auto text-gray-300 mb-3" />
            <p className="text-gray-700 font-medium">No registration forms yet</p>
            <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">
              Create a form for an event like Halloween or Christmas. Guests scan its QR code, enter their name, phone and
              email, and you see every registration here. To try it end to end, make a test form, register, then delete it.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {events.map((event) => (
              <li key={event.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      to={`/registration-events/${event.id}`}
                      className="font-semibold text-gray-900 hover:underline break-words"
                    >
                      {event.name}
                    </Link>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_PILL[event.status]}`}>
                      {STATUS_LABELS[event.status]}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600">
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarDays className="h-4 w-4 text-gray-400" aria-hidden="true" />
                      {formatDateLong(event.event_date)}
                    </span>
                    {showVenue && event.location_name && (
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin className="h-4 w-4 text-gray-400" aria-hidden="true" />
                        {locationDisplayName(event.location_name)}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1.5">
                      <Users className="h-4 w-4 text-gray-400" aria-hidden="true" />
                      {event.total_entries} total {event.total_entries === 1 ? 'entry' : 'entries'} · {event.unique_registrations} unique
                    </span>
                  </div>
                  {event.previous_edition && (
                    <p className="text-xs text-gray-500">Last year: {event.previous_edition.name}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <StandardButton variant="secondary" size="sm" onClick={() => navigate(`/registration-events/${event.id}`)}>
                    View
                  </StandardButton>
                  <button
                    type="button"
                    onClick={() => openEdit(event.id)}
                    aria-label={`Edit ${event.name}`}
                    className="p-2 rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-800"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void remove(event)}
                    disabled={deletingId === event.id}
                    aria-label={`Delete ${event.name}`}
                    className="p-2 rounded-md text-gray-500 hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {showModal && <RegistrationEventFormModal eventId={modalEventId} onClose={closeModal} onSaved={handleSaved} />}
    </div>
  );
};

export default RegistrationEvents;
