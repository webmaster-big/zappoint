import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { CalendarCheck, CalendarDays, ClipboardList, MapPin, Pencil, Plus, Trash2, Users } from 'lucide-react';
import StandardButton from '../../../components/ui/StandardButton';
import Toast from '../../../components/ui/Toast';
import RegistrationEventFormModal, { type RegistrationFormPrefill } from '../../../components/admin/registration-events/RegistrationEventFormModal';
import {
  STATUS_LABELS,
  describeFailure,
  formatEventDates,
  statusPillClass,
  themedClasses,
} from '../../../components/admin/registration-events/registrationEventUi';
import { useThemeColor } from '../../../hooks/useThemeColor';
import eventRegistrationService from '../../../services/EventRegistrationService';
import type { RegistrationCreateResult, RegistrationEventOption, RegistrationEventSummary } from '../../../types/eventRegistration.types';
import { useLocationScope } from '../../../contexts/LocationContext';
import { formatDateLong } from '../../../utils/timeFormat';
import { locationDisplayName } from '../../../utils/locationName';

type ToastState = { message: string; type: 'success' | 'error' | 'info' } | null;

interface EventFilter {
  id: number;
  name: string;
  dates: string;
  locationId: number;
  venue: string | null;
}

const filterFrom = (option: RegistrationEventOption): EventFilter => ({
  id: option.id,
  name: option.name.trim(),
  dates: formatEventDates(option),
  locationId: option.location_id,
  venue: option.location_name ? locationDisplayName(option.location_name) : null,
});

const EVENT_NOT_FOUND = "That event couldn't be found. It may have been deleted.";

const RegistrationEvents = () => {
  const navigate = useNavigate();
  const routerLocation = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { effectiveLocationId, isCompanyAdmin } = useLocationScope();
  const { themeColor, fullColor } = useThemeColor();
  const theme = themedClasses(themeColor, fullColor);
  const [events, setEvents] = useState<RegistrationEventSummary[]>([]);
  const [eventFilter, setEventFilter] = useState<EventFilter | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const [modalEventId, setModalEventId] = useState<number | null>(null);
  const [prefill, setPrefill] = useState<RegistrationFormPrefill | undefined>(undefined);
  const [showModal, setShowModal] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const sequence = useRef(0);

  const load = useCallback(async () => {
    const current = ++sequence.current;
    setLoading(true);
    setLoadError(null);
    try {
      const result = await eventRegistrationService.listEvents({
        location_id: eventFilter ? eventFilter.locationId : effectiveLocationId ?? undefined,
      });
      if (current !== sequence.current) return;
      setEvents(eventFilter ? result.filter((form) => form.event?.id === eventFilter.id) : result);
    } catch (error: unknown) {
      if (current !== sequence.current) return;
      setLoadError(describeFailure(error, 'Registration forms could not be loaded.').message);
    } finally {
      if (current === sequence.current) setLoading(false);
    }
  }, [effectiveLocationId, eventFilter]);

  const fromEvent = Number(searchParams.get('from_event') ?? 0);
  const filterEventId = Number(searchParams.get('event') ?? 0);
  const filterPending = filterEventId > 0 && eventFilter?.id !== filterEventId;
  const lastLocation = useRef(effectiveLocationId);

  useEffect(() => {
    if (fromEvent || filterPending) return;
    void load();
  }, [load, fromEvent, filterPending]);

  const failLookup = useCallback((error: unknown) => {
    const failure = describeFailure(error, "That event's registration forms couldn't be opened. Please try again.");
    if (failure.status !== 401 && failure.status !== 403) setToast({ message: failure.message, type: 'error' });
  }, []);

  useEffect(() => {
    if (lastLocation.current === effectiveLocationId) return;
    lastLocation.current = effectiveLocationId;
    if (filterEventId) setSearchParams({}, { replace: true });
  }, [effectiveLocationId, filterEventId, setSearchParams]);

  useEffect(() => {
    if (!filterEventId) {
      setEventFilter(null);
      return undefined;
    }
    if (eventFilter?.id === filterEventId) return undefined;
    let cancelled = false;
    eventRegistrationService
      .eventOptions({ id: filterEventId })
      .then((options) => {
        if (cancelled) return;
        if (!options[0]) {
          setSearchParams({}, { replace: true });
          setToast({ message: EVENT_NOT_FOUND, type: 'info' });
          return;
        }
        setEventFilter(filterFrom(options[0]));
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setSearchParams({}, { replace: true });
        failLookup(error);
      });
    return () => {
      cancelled = true;
    };
  }, [filterEventId, eventFilter, setSearchParams, failLookup]);

  useEffect(() => {
    const deletedName = (routerLocation.state as { deletedName?: string } | null)?.deletedName;
    if (!deletedName) return;
    setToast({ message: `Deleted "${deletedName}"`, type: 'success' });
    navigate(`${routerLocation.pathname}${routerLocation.search}`, { replace: true, state: null });
  }, [routerLocation, navigate]);

  useEffect(() => {
    if (!fromEvent) return undefined;
    let cancelled = false;
    eventRegistrationService
      .eventOptions({ id: fromEvent })
      .then((options) => {
        if (cancelled) return;
        const option = options[0];
        const linked = option?.registration_form_ids ?? [];
        if (linked.length === 1) {
          navigate(`/registration-events/${linked[0]}`, { replace: true });
          return;
        }
        if (!option) {
          setSearchParams({}, { replace: true });
          setToast({ message: EVENT_NOT_FOUND, type: 'info' });
          return;
        }
        if (linked.length > 1) {
          setEventFilter(filterFrom(option));
          setSearchParams({ event: String(option.id) }, { replace: true });
          return;
        }
        setSearchParams({}, { replace: true });
        setModalEventId(null);
        setPrefill({ eventId: option.id });
        setShowModal(true);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setSearchParams({}, { replace: true });
        failLookup(error);
      });
    return () => {
      cancelled = true;
    };
  }, [fromEvent, navigate, setSearchParams, failLookup]);

  const openCreate = () => {
    setModalEventId(null);
    setPrefill(undefined);
    setShowModal(true);
  };

  const openEdit = (id: number) => {
    setModalEventId(id);
    setPrefill(undefined);
    setShowModal(true);
  };

  const closeModal = useCallback(() => setShowModal(false), []);

  const handleSaved = (result: RegistrationCreateResult, created: boolean) => {
    setShowModal(false);
    if (created && result.created.length > 1) {
      setToast({ message: `Created ${result.created.length} registration forms, one per location`, type: 'success' });
      void load();
      return;
    }
    if (created) {
      navigate(`/registration-events/${result.event.id}`);
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
    <div className="px-4 sm:px-6 py-8">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Registration Forms</h1>
          <p className="text-gray-600 mt-1">
            A separate sign-up form and QR code for each event. Forms close automatically after the event date.
          </p>
        </div>
        <StandardButton variant="primary" size="md" icon={Plus} onClick={openCreate} className="whitespace-nowrap flex-shrink-0">
          New Registration Form
        </StandardButton>
      </div>

      {eventFilter && (
        <div className={`mb-4 rounded-lg px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 ${theme.softPanel}`}>
          <p className="text-sm text-gray-800">
            Forms for <span className="font-semibold">{eventFilter.name}</span> · {eventFilter.dates}
            {eventFilter.venue ? ` · ${eventFilter.venue}` : ''}
          </p>
          <div className="flex flex-wrap gap-2">
            <StandardButton
              variant="secondary"
              size="sm"
              icon={Plus}
              onClick={() => {
                setModalEventId(null);
                setPrefill({ eventId: eventFilter.id });
                setShowModal(true);
              }}
            >
              New form for this event
            </StandardButton>
            <StandardButton variant="ghost" size="sm" onClick={() => setSearchParams({})}>
              Show all forms
            </StandardButton>
          </div>
        </div>
      )}

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
                    <span className={statusPillClass(event.status, themeColor, fullColor)}>
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
                  {(event.event || event.previous_edition) && (
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                      {event.event && (
                        <span className="inline-flex items-center gap-1">
                          <CalendarCheck className="h-3.5 w-3.5" aria-hidden="true" />
                          Event: {event.event.name} · {formatEventDates(event.event)}
                        </span>
                      )}
                      {event.previous_edition && <span>Last year: {event.previous_edition.name}</span>}
                    </div>
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
                    className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-800"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void remove(event)}
                    disabled={deletingId === event.id}
                    aria-label={`Delete ${event.name}`}
                    className="p-2 rounded-lg text-gray-500 hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {showModal && <RegistrationEventFormModal eventId={modalEventId} prefill={prefill} onClose={closeModal} onSaved={handleSaved} />}
    </div>
  );
};

export default RegistrationEvents;
