import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { CalendarDays, CalendarRange, ChevronRight, ClipboardList, MapPin, Plus, UserCheck, Users } from 'lucide-react';
import StandardButton from '../../../components/ui/StandardButton';
import Toast from '../../../components/ui/Toast';
import RegistrationMetricTile from '../../../components/admin/registration-events/RegistrationMetricTile';
import RegistrationEventGroupModal, { type RegistrationGroupPrefill } from '../../../components/admin/registration-events/RegistrationEventGroupModal';
import {
  STATUS_LABELS,
  describeFailure,
  statusPillClass,
} from '../../../components/admin/registration-events/registrationEventUi';
import { useThemeColor } from '../../../hooks/useThemeColor';
import eventRegistrationService from '../../../services/EventRegistrationService';
import type { RegistrationEventGroupList } from '../../../types/eventRegistration.types';
import { useLocationScope } from '../../../contexts/LocationContext';
import { formatDateLong } from '../../../utils/timeFormat';
import { locationDisplayName } from '../../../utils/locationName';
import { getStoredUser } from '../../../utils/storage';
import { michiganTodayKey } from '../../../utils/dashboardTimeframe';

type ToastState = { message: string; type: 'success' | 'error' | 'info' } | null;

const EVENT_NOT_FOUND = "That event couldn't be found. It may have been deleted.";

const RegistrationEvents = () => {
  const navigate = useNavigate();
  const routerLocation = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { effectiveLocationId, isCompanyAdmin, locations } = useLocationScope();
  const { themeColor, fullColor } = useThemeColor();
  const currentUser = getStoredUser();
  const [thisYear] = useState(() => Number(michiganTodayKey().slice(0, 4)));
  const requestedYear = Number(searchParams.get('year') ?? 0);
  const year = requestedYear >= 2000 && requestedYear <= 2100 ? requestedYear : thisYear;
  const fromEvent = Number(searchParams.get('from_event') ?? 0);

  const [data, setData] = useState<{ key: string; result: RegistrationEventGroupList } | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const [prefill, setPrefill] = useState<RegistrationGroupPrefill | undefined>(undefined);
  const [showModal, setShowModal] = useState(false);
  const sequence = useRef(0);
  const requestKey = `${year}|${effectiveLocationId ?? 'all'}`;

  const load = useCallback(async () => {
    const current = ++sequence.current;
    const key = `${year}|${effectiveLocationId ?? 'all'}`;
    setLoading(true);
    setLoadError(null);
    try {
      const result = await eventRegistrationService.listGroups({ year, location_id: effectiveLocationId ?? undefined });
      if (current !== sequence.current) return;
      setData({ key, result });
    } catch (error: unknown) {
      if (current !== sequence.current) return;
      setLoadError(describeFailure(error, 'Registration events could not be loaded.').message);
    } finally {
      if (current === sequence.current) setLoading(false);
    }
  }, [year, effectiveLocationId]);

  useEffect(() => {
    if (fromEvent) return;
    void load();
  }, [load, fromEvent]);

  useEffect(() => {
    const deletedName = (routerLocation.state as { deletedName?: string } | null)?.deletedName;
    if (!deletedName) return;
    setToast({ message: `Deleted "${deletedName}"`, type: 'success' });
    navigate(`${routerLocation.pathname}${routerLocation.search}`, { replace: true, state: null });
  }, [routerLocation, navigate]);

  useEffect(() => {
    if (!fromEvent) return undefined;
    let cancelled = false;
    const keepYear = () => setSearchParams(requestedYear ? { year: String(requestedYear) } : {}, { replace: true });
    eventRegistrationService
      .eventOptions({ id: fromEvent })
      .then((options) => {
        if (cancelled) return;
        const option = options[0];
        const forms = option?.registration_form_ids ?? [];
        if (forms.length > 0) {
          navigate(`/registration-events/${forms[forms.length - 1]}`, { replace: true });
          return;
        }
        keepYear();
        if (!option) {
          setToast({ message: EVENT_NOT_FOUND, type: 'info' });
          return;
        }
        setPrefill({ eventId: option.id });
        setShowModal(true);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        keepYear();
        const failure = describeFailure(error, "That event's registration form couldn't be opened. Please try again.");
        if (failure.status !== 401 && failure.status !== 403) setToast({ message: failure.message, type: 'error' });
      });
    return () => {
      cancelled = true;
    };
  }, [fromEvent, navigate, setSearchParams, requestedYear]);

  const openCreate = () => {
    setPrefill(undefined);
    setShowModal(true);
  };

  const closeModal = useCallback(() => setShowModal(false), []);

  const chooseYear = (value: number) => setSearchParams(value === thisYear ? {} : { year: String(value) });

  const sidebarLocation = isCompanyAdmin && effectiveLocationId
    ? locations.find((location) => Number(location.id) === Number(effectiveLocationId))?.name ?? null
    : null;
  const scopeLabel = isCompanyAdmin
    ? sidebarLocation ? locationDisplayName(sidebarLocation) : 'All locations'
    : currentUser?.location_name ? locationDisplayName(currentUser.location_name) : 'Your location';
  const scoped = !isCompanyAdmin || Boolean(sidebarLocation);
  const shown = data && data.key === requestKey ? data.result : null;
  const years = Array.from(new Set([...(data?.result.years ?? []), thisYear, year])).sort((a, b) => b - a);
  const totals = shown?.totals ?? null;
  const groups = shown?.event_groups ?? [];
  const tileAccent = `bg-${themeColor}-100 text-${fullColor}`;
  const venueSummary = (names: string[], count: number) => {
    if (count === 1 && names.length === 1) return locationDisplayName(names[0]);
    return `${count} location form${count === 1 ? '' : 's'}`;
  };

  return (
    <div className="px-4 sm:px-6 py-8 space-y-5">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Registration Forms</h1>
          <p className="text-gray-600 mt-1">Manage events and their participating location forms.</p>
        </div>
        <StandardButton variant="primary" size="md" icon={Plus} onClick={openCreate} className="whitespace-nowrap flex-shrink-0">
          New event
        </StandardButton>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3 flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-2 text-sm font-medium text-gray-800 min-w-0">
          <CalendarDays className={`h-4 w-4 flex-shrink-0 text-${fullColor}`} aria-hidden="true" />
          <span className="truncate">All events · {scopeLabel}</span>
        </span>
        <label className="flex-shrink-0">
          <span className="sr-only">Year</span>
          <select
            value={year}
            onChange={(event) => chooseYear(Number(event.target.value))}
            className={`rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-${themeColor}-800 focus:border-${themeColor}-800`}
          >
            {years.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <RegistrationMetricTile icon={ClipboardList} accent={tileAccent} label="Total entries" value={totals?.total_entries ?? null} hint="Every form submitted, including repeats." />
        <RegistrationMetricTile icon={UserCheck} accent={tileAccent} label="Unique registrations" value={totals?.unique_registrations ?? null} hint="Entries with the same phone and email count once." />
        <RegistrationMetricTile icon={CalendarRange} accent={tileAccent} label="Events" value={totals?.events ?? null} hint={`Total events in ${year}.`} />
        <RegistrationMetricTile icon={MapPin} accent={tileAccent} label="Location forms" value={totals?.location_forms ?? null} hint="Total location forms across all events." />
      </div>
      <p className="text-xs text-gray-500 -mt-2">
        Totals include all {year} events and their location forms{scoped ? ` at ${scopeLabel}` : ''}. They count registrations only, not who attended.
      </p>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">{year} events</h2>
          <span className="text-xs text-gray-500">Newest event first</span>
        </div>

        {loadError ? (
          <div className="p-8 text-center space-y-3">
            <p className="text-sm text-red-700" role="alert">{loadError}</p>
            <StandardButton variant="secondary" size="sm" onClick={() => void load()}>
              Try again
            </StandardButton>
          </div>
        ) : !shown ? (
          <div className="p-4 space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-gray-100 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : groups.length === 0 ? (
          <div className="p-10 text-center">
            <CalendarRange className="w-10 h-10 mx-auto text-gray-300 mb-3" aria-hidden="true" />
            <p className="text-gray-700 font-medium">No events in {year}{scoped ? ` at ${scopeLabel}` : ''} yet</p>
            <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">
              Create an event like Trunk or Treat, pick the locations running it, and each one gets its own sign-up form, QR code and
              registration list.
            </p>
          </div>
        ) : (
          <ul className={`divide-y divide-gray-100 ${loading ? 'opacity-60' : ''}`}>
            {groups.map((group) => (
              <li key={group.id} className="p-4 flex items-center gap-3">
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link to={`/registration-events/event/${group.id}`} className="font-semibold text-gray-900 hover:underline break-words">
                      {group.name}
                    </Link>
                    <span className={statusPillClass(group.status, themeColor, fullColor)}>{STATUS_LABELS[group.status]}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600">
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarDays className="h-4 w-4 text-gray-400" aria-hidden="true" />
                      {formatDateLong(group.event_date)}
                    </span>
                    <span
                      className="inline-flex items-center gap-1.5 min-w-0"
                      title={group.location_names.map((name) => locationDisplayName(name)).join(', ') || undefined}
                    >
                      <MapPin className="h-4 w-4 text-gray-400 flex-shrink-0" aria-hidden="true" />
                      <span className="truncate">{venueSummary(group.location_names, group.location_forms)}</span>
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Users className="h-4 w-4 text-gray-400" aria-hidden="true" />
                      {group.total_entries} entr{group.total_entries === 1 ? 'y' : 'ies'}
                    </span>
                  </div>
                </div>
                <StandardButton
                  variant="secondary"
                  size="sm"
                  icon={ChevronRight}
                  iconPosition="right"
                  onClick={() => navigate(`/registration-events/event/${group.id}`)}
                  className="flex-shrink-0 whitespace-nowrap"
                >
                  View event
                </StandardButton>
              </li>
            ))}
          </ul>
        )}
      </div>

      {showModal && (
        <RegistrationEventGroupModal
          mode="create"
          prefill={prefill}
          onClose={closeModal}
          onSaved={(created) => {
            setShowModal(false);
            navigate(`/registration-events/event/${created.id}`);
          }}
        />
      )}
    </div>
  );
};

export default RegistrationEvents;
