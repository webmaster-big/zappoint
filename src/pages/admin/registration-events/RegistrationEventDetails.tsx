import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  CalendarCheck,
  Camera,
  CalendarClock,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Download,
  EyeOff,
  History,
  Lock,
  LockOpen,
  Mail,
  MapPin,
  Pencil,
  RotateCcw,
  Search,
  UserCheck,
  Users,
} from 'lucide-react';
import StandardButton from '../../../components/ui/StandardButton';
import Toast from '../../../components/ui/Toast';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import Pagination from '../../../components/ui/Pagination';
import RegistrationEventFormModal from '../../../components/admin/registration-events/RegistrationEventFormModal';
import RegistrationQrPanel from '../../../components/admin/registration-events/RegistrationQrPanel';
import ContactHistoryModal from '../../../components/admin/registration-events/ContactHistoryModal';
import RegistrationMetricTile from '../../../components/admin/registration-events/RegistrationMetricTile';
import RegistrationRowMenu from '../../../components/admin/registration-events/RegistrationRowMenu';
import {
  LAST_YEAR_CHIP,
  SAME_CONTACT_CHIP,
  STATUS_LABELS,
  describeFailure,
  fileSlug,
  formatEventDates,
  registeredBeforeChip,
  statusPillClass,
  themedClasses,
} from '../../../components/admin/registration-events/registrationEventUi';
import { downloadCsv, toCsv } from '../../../components/admin/table';
import eventRegistrationService from '../../../services/EventRegistrationService';
import type {
  RegistrationCounts,
  RegistrationEntryRow,
  RegistrationEventDetail,
  RegistrationGroup,
  RegistrationListFilter,
  RegistrationPagination,
} from '../../../types/eventRegistration.types';
import { useLocationScope } from '../../../contexts/LocationContext';
import { useThemeColor } from '../../../hooks/useThemeColor';
import { formatDateLong, formatDateTimeET } from '../../../utils/timeFormat';
import { formatPhoneForDisplay } from '../../../utils/bookingSearch';
import { locationDisplayName } from '../../../utils/locationName';

type ToastState = { message: string; type: 'success' | 'error' | 'info' } | null;

interface LoadFailure {
  message: string;
  switchLocationId: number | null;
  status: number | null;
}

const PER_PAGE = 25;

const MAX_SEARCH = 100;

const yesNo = (value: boolean): string => (value ? 'Yes' : 'No');

const editionLabel = (edition: { name: string; event_date: string } | null | undefined): string => {
  if (!edition) return '';
  const year = edition.event_date.slice(0, 4);
  return edition.name.includes(year) ? edition.name : `${edition.name} (${year})`;
};

const RegistrationEventDetailsPage = ({ eventId }: { eventId: number }) => {
  const navigate = useNavigate();
  const { switchLocation, canSwitchLocation } = useLocationScope();
  const { themeColor, fullColor } = useThemeColor();
  const theme = themedClasses(themeColor, fullColor);
  const [event, setEvent] = useState<RegistrationEventDetail | null>(null);
  const [loadingEvent, setLoadingEvent] = useState(true);
  const [failure, setFailure] = useState<LoadFailure | null>(null);
  const [counts, setCounts] = useState<RegistrationCounts | null>(null);
  const [groups, setGroups] = useState<RegistrationGroup[]>([]);
  const [pagination, setPagination] = useState<RegistrationPagination | null>(null);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<RegistrationListFilter>('all');
  const [page, setPage] = useState(1);
  const [toast, setToast] = useState<ToastState>(null);
  const [showEdit, setShowEdit] = useState(false);
  const [historyContactId, setHistoryContactId] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set());
  const [acting, setActing] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  const listSequence = useRef(0);

  const notify = useCallback((message: string, type: 'success' | 'error' | 'info') => setToast({ message, type }), []);

  const loadEvent = useCallback(async () => {
    try {
      const result = await eventRegistrationService.getEvent(eventId);
      setEvent(result);
      setCounts(result.counts);
      setFailure(null);
    } catch (error: unknown) {
      const described = describeFailure(error, 'This registration form could not be loaded.');
      setFailure({ message: described.message, switchLocationId: described.switchLocationId, status: described.status });
    } finally {
      setLoadingEvent(false);
    }
  }, [eventId]);

  const loadList = useCallback(async () => {
    const current = ++listSequence.current;
    setListLoading(true);
    setListError(null);
    try {
      const result = await eventRegistrationService.listRegistrations(eventId, {
        search: search || undefined,
        filter,
        page,
        per_page: PER_PAGE,
      });
      if (current !== listSequence.current) return;
      setGroups(result.groups);
      setPagination(result.pagination);
      setCounts(result.counts);
      if (result.pagination.current_page !== page) setPage(result.pagination.current_page);
    } catch (error: unknown) {
      if (current !== listSequence.current) return;
      setListError(describeFailure(error, 'Registrations could not be loaded.').message);
    } finally {
      if (current === listSequence.current) setListLoading(false);
    }
  }, [eventId, search, filter, page, reloadTick]);

  useEffect(() => {
    void loadEvent();
  }, [loadEvent]);

  useEffect(() => {
    if (!event) return;
    void loadList();
  }, [event, loadList]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim().slice(0, MAX_SEARCH));
      setPage(1);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const closeEdit = useCallback(() => setShowEdit(false), []);
  const closeHistory = useCallback(() => setHistoryContactId(null), []);

  const hasPreviousEdition = Boolean(event?.previous_edition);

  useEffect(() => {
    if (filter === 'previous_edition' && !hasPreviousEdition) setFilter('all');
  }, [filter, hasPreviousEdition]);

  const toggleExpanded = (contactId: number) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(contactId)) next.delete(contactId);
      else next.add(contactId);
      return next;
    });
  };

  const toggleOpen = async () => {
    if (!event) return;
    setActing('toggle');
    try {
      const updated = await eventRegistrationService.updateEvent(event.id, { is_open: !event.is_open });
      setEvent((current) => (current ? { ...updated, can_manage_event: current.can_manage_event, group_form_count: current.group_form_count } : updated));
      setCounts(updated.counts);
      notify(updated.is_open ? 'Registration reopened' : 'Registration closed', 'success');
    } catch (error: unknown) {
      notify(describeFailure(error, 'The form could not be updated.').message, 'error');
    } finally {
      setActing(null);
    }
  };

  const toggleEntry = async (entry: RegistrationEntryRow) => {
    if (!event) return;
    const hiding = entry.hidden_at === null;
    if (hiding && !window.confirm('Hide this entry? It stops counting everywhere but stays in the Hidden list, where you can restore it.')) {
      return;
    }
    setActing(`entry-${entry.id}`);
    try {
      const result = hiding
        ? await eventRegistrationService.hideEntry(event.id, entry.id)
        : await eventRegistrationService.restoreEntry(event.id, entry.id);
      setCounts(result.counts);
      notify(hiding ? 'Entry hidden' : 'Entry restored', 'success');
      setReloadTick((tick) => tick + 1);
    } catch (error: unknown) {
      notify(describeFailure(error, 'The entry could not be updated.').message, 'error');
    } finally {
      setActing(null);
    }
  };

  const exportCsv = async () => {
    if (!event) return;
    setActing('export');
    try {
      const result = await eventRegistrationService.exportRegistrations(event.id);
      const previousLabel = editionLabel(event.previous_edition);
      const csv = toCsv(
        [
          'Entry ID',
          'Registered',
          'Name',
          'Email',
          'Phone',
          'Contact ID',
          'Entries with same contact',
          'Same contact details',
          'Registered before',
          ...(previousLabel ? [`Registered for ${previousLabel}`] : []),
        ],
        result.rows.map((row) => [
          row.entry_id,
          formatDateTimeET(row.registered_at),
          row.name,
          row.email,
          formatPhoneForDisplay(row.phone) || row.phone,
          row.contact_id,
          row.same_contact_entries,
          yesNo(row.is_duplicate),
          yesNo(row.returning),
          ...(previousLabel ? [yesNo(row.registered_previous_edition)] : []),
        ]),
      );
      const venueSlug = event.location_name ? `${fileSlug(event.location_name, 'location')}-` : '';
      downloadCsv(`${fileSlug(event.name, 'registrations')}-${venueSlug}registrations-${new Date().toISOString().slice(0, 10)}.csv`, csv);
      if (result.capped) {
        notify(`The export holds the first ${result.rows.length.toLocaleString()} of ${result.total.toLocaleString()} entries.`, 'info');
      }
    } catch (error: unknown) {
      notify(describeFailure(error, 'The export failed. Please try again.').message, 'error');
    } finally {
      setActing(null);
    }
  };

  if (loadingEvent) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <LoadingSpinner size="medium" />
      </div>
    );
  }

  if (failure || !event) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="text-center max-w-md space-y-4">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto" />
          <h1 className="text-xl font-bold text-gray-900">{failure?.message ?? 'This registration form could not be loaded.'}</h1>
          <div className="flex flex-col sm:flex-row gap-2 justify-center">
            {failure?.switchLocationId && canSwitchLocation && (
              <StandardButton variant="primary" onClick={() => void switchLocation(failure.switchLocationId as number, `/registration-events/${eventId}`)}>
                Switch to that location
              </StandardButton>
            )}
            {failure && !failure.switchLocationId && (failure.status === null || failure.status >= 500) && (
              <StandardButton
                variant="primary"
                onClick={() => {
                  setLoadingEvent(true);
                  void loadEvent();
                }}
              >
                Try again
              </StandardButton>
            )}
            <StandardButton variant="secondary" icon={ArrowLeft} onClick={() => navigate('/registration-events')}>
              Back to all events
            </StandardButton>
          </div>
        </div>
      </div>
    );
  }

  const tallies = counts ?? event.counts;
  const past = event.status === 'past';
  const firstShown = pagination && pagination.total > 0 ? (pagination.current_page - 1) * pagination.per_page + 1 : 0;
  const lastShown = pagination ? Math.min(pagination.current_page * pagination.per_page, pagination.total) : 0;
  const previousName = editionLabel(event.previous_edition);
  const tileAccent = `bg-${themeColor}-100 text-${fullColor}`;
  const unfiltered = filter === 'all' && !search;
  const venue = event.location_name ? locationDisplayName(event.location_name) : 'This location';
  const shortVenue = venue.replace(/\s*\(.*\)\s*$/, '');
  const eventName = event.group?.name ?? event.name;
  const eventPath = event.group ? `/registration-events/event/${event.group.id}` : '/registration-events';

  return (
    <div className="px-4 sm:px-6 py-8 max-w-5xl mx-auto space-y-5">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="space-y-3">
        <StandardButton variant="ghost" size="sm" icon={ArrowLeft} onClick={() => navigate(eventPath)}>
          {event.group ? eventName : 'All events'}
        </StandardButton>
        <nav aria-label="Breadcrumb" className="text-sm text-gray-500 flex flex-wrap items-center gap-1.5">
          <Link to="/registration-events" className="hover:underline">All events</Link>
          {event.group && (
            <>
              <span aria-hidden="true">/</span>
              <Link to={eventPath} className="hover:underline">{eventName}</Link>
            </>
          )}
          <span aria-hidden="true">/</span>
          <span className="text-gray-700">{shortVenue}</span>
        </nav>
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
          <div className="space-y-1.5 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 break-words">{venue}</h1>
              <span className={statusPillClass(event.status, themeColor, fullColor)}>{STATUS_LABELS[event.status]}</span>
            </div>
            <p className="inline-flex flex-wrap items-center gap-1.5 text-sm text-gray-600">
              <CalendarDays className="h-4 w-4 text-gray-400" aria-hidden="true" />
              {eventName} · {formatDateLong(event.event_date)}
            </p>
            {event.event && (
              <p className="flex flex-wrap items-center gap-1.5 text-sm text-gray-600">
                <CalendarCheck className="h-4 w-4 text-gray-400" aria-hidden="true" />
                For the event{' '}
                <Link to={`/events/${event.event.id}/edit`} className={theme.link}>
                  {event.event.name}
                </Link>
                <span>· {formatEventDates(event.event)}</span>
              </p>
            )}
            {(event.previous_edition || event.next_edition) && (
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                {event.previous_edition && (
                  <Link to={`/registration-events/${event.previous_edition.id}`} className={theme.link}>
                    Last year&apos;s form: {previousName}
                  </Link>
                )}
                {event.next_edition && (
                  <Link to={`/registration-events/${event.next_edition.id}`} className={theme.link}>
                    Next year&apos;s form: {event.next_edition.name}
                  </Link>
                )}
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2 flex-shrink-0">
            <StandardButton variant="secondary" size="sm" icon={Pencil} onClick={() => setShowEdit(true)} disabled={acting !== null}>
              Edit form
            </StandardButton>
            <StandardButton
              variant="secondary"
              size="sm"
              icon={event.is_open ? Lock : LockOpen}
              onClick={() => void toggleOpen()}
              disabled={past || acting !== null}
              loading={acting === 'toggle'}
              title={past ? 'Registration closed automatically after the event date.' : undefined}
            >
              {event.is_open ? 'Close registration' : 'Reopen registration'}
            </StandardButton>
          </div>
        </div>
        {past && (
          <p className="text-sm text-gray-600">Registration closed automatically after the event date. Everything stays here.</p>
        )}
      </div>

      <div className={`rounded-lg px-4 py-3 text-sm text-gray-800 flex items-center gap-2 ${theme.softPanel}`}>
        <MapPin className={`h-4 w-4 flex-shrink-0 ${theme.icon}`} aria-hidden="true" />
        <span>
          <span className="font-semibold">This event</span> · {shortVenue} only
        </span>
      </div>

      {event.photo_frames && (
        <div className="flex items-start gap-2 text-sm text-gray-600">
          <Camera className={`h-4 w-4 mt-0.5 flex-shrink-0 ${theme.icon}`} aria-hidden="true" />
          {event.photo_frames.frames.length > 0 ? (
            <p className="min-w-0">
              Photo frame: <span className="font-medium text-gray-800">{event.photo_frames.frames[0].name}</span>
              {!event.photo_frames.frames[0].is_enabled ? ' (turned off)' : event.photo_frames.frames[0].never_runs ? ' (never used)' : ''}
              {event.photo_frames.frames.length > 1 ? ` +${event.photo_frames.frames.length - 1} more` : ''}
              {' · used for photos on '}
              {event.photo_frames.first_day === event.photo_frames.event_date
                ? formatDateLong(event.photo_frames.event_date)
                : `${formatDateLong(event.photo_frames.first_day)} – ${formatDateLong(event.photo_frames.event_date)}`}
              {' · '}
              <Link to="/photos/overlays" className={theme.link}>
                Photo overlays
              </Link>
            </p>
          ) : past ? (
            <p>No photo frame. The event day has passed.</p>
          ) : (
            <p>
              No photo frame.{' '}
              <Link to={`/photos/overlays?event=${event.id}&location=${event.location_id}`} className={theme.link}>
                Add one
              </Link>
            </p>
          )}
        </div>
      )}

      {event.photo_frames && (
        <div className="flex items-start gap-2 text-sm text-gray-600 -mt-2">
          <Mail className={`h-4 w-4 mt-0.5 flex-shrink-0 ${theme.icon}`} aria-hidden="true" />
          <p className="min-w-0">
            {event.photo_email_active === false ? (
              <>
                The <span className="font-medium text-gray-800">Event registration photos</span> email is switched off, so people who
                registered get the usual photo email.{' '}
              </>
            ) : (
              <>
                Photos sent to people who registered use the <span className="font-medium text-gray-800">Event registration photos</span>{' '}
                email.{' '}
              </>
            )}
            <Link to={`/photos/settings?location=${event.location_id}#registration-email`} className={theme.link}>
              {event.photo_email_active === false ? 'Turn it on or edit it' : 'Edit its wording'}
            </Link>
          </p>
        </div>
      )}

      <div className={`grid grid-cols-2 gap-3 sm:gap-4 ${hasPreviousEdition ? 'lg:grid-cols-3 xl:grid-cols-5' : 'lg:grid-cols-4'}`}>
        <RegistrationMetricTile
          icon={ClipboardList}
          accent={tileAccent}
          label="Total entries"
          value={tallies.total_entries}
          hint={
            tallies.hidden_entries > 0
              ? `Every form submitted, including repeats. ${tallies.hidden_entries} hidden entr${tallies.hidden_entries === 1 ? 'y is' : 'ies are'} not counted.`
              : 'Every form submitted, including repeats.'
          }
        />
        <RegistrationMetricTile
          icon={UserCheck}
          accent={tileAccent}
          label="Unique registrations"
          value={tallies.unique_registrations}
          hint="Entries with the same phone and the same email count once."
        />
        <RegistrationMetricTile
          icon={Users}
          accent={tileAccent}
          label="Same-contact groups"
          value={tallies.duplicate_groups}
          hint={`${tallies.duplicate_groups} contact${tallies.duplicate_groups === 1 ? '' : 's'} with multiple entries.`}
        />
        <RegistrationMetricTile
          icon={History}
          accent={tileAccent}
          label="Registered before"
          value={tallies.returning_contacts}
          hint="Registered for an earlier event that had already taken place."
        />
        {hasPreviousEdition && (
          <RegistrationMetricTile
            icon={CalendarClock}
            accent={tileAccent}
            label={`Registered for ${previousName}`}
            value={tallies.previous_edition_registrants}
            hint="The same person also registered for last year's edition here."
          />
        )}
      </div>
      <p className="text-xs text-gray-500 -mt-2">
        Registration totals for {shortVenue}&apos;s {eventName} form only. They don&apos;t show who attended.
        {tallies.hidden_entries > 0 && filter !== 'hidden' && (
          <>
            {' '}
            <button
              type="button"
              onClick={() => {
                setFilter('hidden');
                setPage(1);
              }}
              className={theme.link}
            >
              View {tallies.hidden_entries} hidden entr{tallies.hidden_entries === 1 ? 'y' : 'ies'}
            </button>
          </>
        )}
      </p>

      <RegistrationQrPanel event={event} onNotify={notify} />

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <div className="p-4 border-b border-gray-100 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <Users className={`h-5 w-5 ${theme.icon}`} aria-hidden="true" />
              Registrations
            </h2>
            <StandardButton variant="secondary" size="sm" icon={Download} onClick={() => void exportCsv()} loading={acting === 'export'} disabled={acting !== null}>
              Export CSV
            </StandardButton>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <label className="relative flex-1">
              <span className="sr-only">Search registrations</span>
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" aria-hidden="true" />
              <input
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                maxLength={MAX_SEARCH}
                placeholder="Search name, email or phone"
                className={`${theme.input} pl-9`}
              />
            </label>
            <label className="sm:w-64">
              <span className="sr-only">Show</span>
              <select
                value={filter}
                onChange={(e) => {
                  setFilter(e.target.value as RegistrationListFilter);
                  setPage(1);
                }}
                className={theme.input}
              >
                <option value="all">All registrations</option>
                <option value="duplicates">Same contact details</option>
                <option value="returning">Registered before</option>
                {hasPreviousEdition && <option value="previous_edition">Registered for {previousName}</option>}
                <option value="hidden">Hidden ({tallies.hidden_entries})</option>
              </select>
            </label>
          </div>
          {pagination && (
            <p className="text-xs text-gray-500">
              {pagination.total === 0
                ? 'No matching contacts'
                : `Showing ${firstShown}–${lastShown} of ${pagination.total} contact${pagination.total === 1 ? '' : 's'}${unfiltered ? ` · ${tallies.total_entries} entr${tallies.total_entries === 1 ? 'y' : 'ies'}` : ''}`}
            </p>
          )}
        </div>

        {listError ? (
          <div className="p-6 text-center space-y-3">
            <p className="text-sm text-red-700" role="alert">{listError}</p>
            <StandardButton variant="secondary" size="sm" onClick={() => void loadList()}>
              Try again
            </StandardButton>
          </div>
        ) : listLoading && groups.length === 0 ? (
          <div className="p-4 space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : groups.length === 0 ? (
          <div className="p-10 text-center">
            <Users className="w-10 h-10 mx-auto text-gray-300 mb-3" aria-hidden="true" />
            <p className="text-gray-700 font-medium">{unfiltered ? 'No one has registered yet.' : 'No registrations match.'}</p>
            {unfiltered && (
              <p className="text-sm text-gray-500 mt-1">Share the QR code or link above. Registrations show up here as soon as guests submit the form.</p>
            )}
          </div>
        ) : (
          <ul className={`divide-y divide-gray-100 ${listLoading ? 'opacity-60' : ''}`}>
            {groups.map((group) => {
              const open = expanded.has(group.contact_id);
              const primaryName = group.entries[0]?.name ?? group.names[0] ?? group.email;
              const otherNames = Math.max(group.names.length - 1, 0);
              return (
                <li key={group.contact_id}>
                  <div className="flex items-center gap-2 px-4 py-3">
                    <button
                      type="button"
                      onClick={() => toggleExpanded(group.contact_id)}
                      aria-expanded={open}
                      className="flex-1 min-w-0 grid grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[minmax(0,1fr)_7rem_11rem] items-center gap-x-3 gap-y-0.5 text-left"
                    >
                      <span className="min-w-0 flex items-center gap-2">
                        <span className="font-medium text-gray-900 truncate">
                          {primaryName}
                          {otherNames > 0 ? ` +${otherNames}` : ''}
                        </span>
                        {group.is_duplicate && <span className={`${SAME_CONTACT_CHIP} hidden sm:inline`}>Same contact ×{group.entry_count}</span>}
                      </span>
                      <span className="text-sm text-gray-600 text-right sm:text-left">
                        {group.entry_count} entr{group.entry_count === 1 ? 'y' : 'ies'}
                      </span>
                      <span className="col-span-2 sm:col-span-1 text-xs sm:text-sm text-gray-500 sm:text-gray-600">
                        {formatDateLong(group.last_registered_at.slice(0, 10))}
                      </span>
                    </button>
                    {open ? (
                      <ChevronUp className="h-4 w-4 text-gray-400 flex-shrink-0 hidden sm:block" aria-hidden="true" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0 hidden sm:block" aria-hidden="true" />
                    )}
                    <RegistrationRowMenu
                      label={`Actions for ${primaryName}`}
                      items={[
                        {
                          label: open ? 'Hide details' : 'Show details',
                          icon: open ? ChevronUp : ChevronDown,
                          onClick: () => toggleExpanded(group.contact_id),
                          returnFocus: true,
                        },
                        {
                          label: group.other_event_count > 0
                            ? `Registration history (${group.other_event_count} other form${group.other_event_count === 1 ? '' : 's'})`
                            : 'Registration history',
                          icon: History,
                          onClick: () => setHistoryContactId(group.contact_id),
                          hidden: filter === 'hidden',
                        },
                      ]}
                    />
                  </div>
                  {open && (
                    <div className="px-4 pb-4 space-y-3">
                      <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm text-gray-700 space-y-1">
                        <p className="break-all">{group.email}</p>
                        <p>{formatPhoneForDisplay(group.phone) || group.phone}</p>
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {group.is_duplicate && <span className={SAME_CONTACT_CHIP}>Same contact ×{group.entry_count}</span>}
                          {group.registered_before_other_name && (
                            <span className="text-xs text-gray-500">These contact details registered before under another name</span>
                          )}
                        </div>
                      </div>
                      <ul className="rounded-lg border border-gray-100 divide-y divide-gray-100">
                        {group.entries.map((entry) => (
                          <li key={entry.id} className="px-3 py-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                            <div className="min-w-0 space-y-1">
                              <p className="text-sm font-medium text-gray-900 break-words">{entry.name}</p>
                              <p className="text-xs text-gray-500">Registered {formatDateTimeET(entry.registered_at)}</p>
                              {(entry.returning || entry.registered_previous_edition) && (
                                <div className="flex flex-wrap gap-1.5">
                                  {entry.returning && <span className={registeredBeforeChip(themeColor, fullColor)}>Registered before</span>}
                                  {entry.registered_previous_edition && <span className={LAST_YEAR_CHIP}>Registered for {previousName}</span>}
                                </div>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => void toggleEntry(entry)}
                              disabled={acting !== null}
                              className="self-start sm:self-center inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-50"
                            >
                              {entry.hidden_at === null ? (
                                <Fragment>
                                  <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
                                  Hide
                                </Fragment>
                              ) : (
                                <Fragment>
                                  <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                                  Restore
                                </Fragment>
                              )}
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {pagination && (
          <Pagination
            currentPage={pagination.current_page}
            totalPages={pagination.last_page}
            onPageChange={setPage}
            className="p-4 border-t border-gray-100"
          />
        )}
      </div>

      {showEdit && (
        <RegistrationEventFormModal
          eventId={event.id}
          canRemove={Boolean(event.can_manage_event)}
          onClose={closeEdit}
          onSaved={(updated) => {
            setShowEdit(false);
            setEvent((current) => (current ? { ...updated, can_manage_event: current.can_manage_event, group_form_count: current.group_form_count } : updated));
            setCounts(updated.counts);
            notify('Form saved', 'success');
          }}
          onRemoved={(eventDeleted, groupId, groupName) => {
            if (!eventDeleted && groupId !== null) {
              navigate(`/registration-events/event/${groupId}`, { state: { removedVenue: venue } });
              return;
            }
            navigate('/registration-events', { state: { deletedName: groupName ?? eventName } });
          }}
        />
      )}

      {historyContactId !== null && (
        <ContactHistoryModal eventId={event.id} contactId={historyContactId} onClose={closeHistory} />
      )}
    </div>
  );
};

const RegistrationEventDetails = () => {
  const { id = '' } = useParams<{ id: string }>();
  return <RegistrationEventDetailsPage key={id} eventId={Number(id)} />;
};

export default RegistrationEventDetails;
