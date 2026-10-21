import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  ClipboardList,
  CopyPlus,
  Download,
  EyeOff,
  History,
  Lock,
  LockOpen,
  MapPin,
  Pencil,
  RotateCcw,
  Search,
  Trash2,
  UserCheck,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import StandardButton from '../../../components/ui/StandardButton';
import Toast from '../../../components/ui/Toast';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import CounterAnimation from '../../../components/ui/CounterAnimation';
import Pagination from '../../../components/ui/Pagination';
import RegistrationEventFormModal, { type RegistrationFormPrefill } from '../../../components/admin/registration-events/RegistrationEventFormModal';
import RegistrationQrPanel from '../../../components/admin/registration-events/RegistrationQrPanel';
import ContactHistoryModal from '../../../components/admin/registration-events/ContactHistoryModal';
import {
  LAST_YEAR_CHIP,
  SAME_CONTACT_CHIP,
  STATUS_LABELS,
  describeFailure,
  formatEventDates,
  registeredBeforeChip,
  statusPillClass,
  themedClasses,
  fileSlug,
  nextYearDate,
  yearShift,
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

const yesNo = (value: boolean): string => (value ? 'Yes' : 'No');

const MAX_SEARCH = 100;

const editionLabel = (edition: { name: string; event_date: string } | null | undefined): string => {
  if (!edition) return '';
  const year = edition.event_date.slice(0, 4);
  return edition.name.includes(year) ? edition.name : `${edition.name} (${year})`;
};

const MetricTile = ({ icon: Icon, label, value, hint, accent }: { icon: LucideIcon; label: string; value: number; hint: string; accent: string }) => (
  <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex flex-col gap-2 hover:shadow-md transition-shadow min-h-[120px]">
    <div className="flex items-center gap-2 mb-2">
      <div className={`p-2 rounded-lg ${accent}`}>
        <Icon size={20} />
      </div>
      <span className="text-base font-semibold text-gray-800">{label}</span>
    </div>
    <div className="flex items-end gap-2 mt-2">
      <CounterAnimation value={value} className="text-2xl font-bold text-gray-900" />
    </div>
    <p className="text-xs mt-1 text-gray-400">{hint}</p>
  </div>
);

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
  const [nextEdition, setNextEdition] = useState<RegistrationFormPrefill | null>(null);
  const [historyContactId, setHistoryContactId] = useState<number | null>(null);
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
  const closeNextEdition = useCallback(() => setNextEdition(null), []);

  const startNextEdition = () => {
    if (!event) return;
    const shifted = yearShift(event.name, 1);
    setNextEdition({
      name: shifted !== event.name ? shifted : `${event.name} ${Number(event.event_date.slice(0, 4)) + 1}`,
      locationIds: [event.location_id],
      eventDate: nextYearDate(event.event_date),
      description: event.description ?? '',
      confirmationMessage: event.confirmation_message ?? '',
      previousEditionId: event.id,
      copyHeaderImageFrom: event.header_image_path ? event.id : null,
      headerImagePath: event.header_image_path,
    });
  };
  const closeHistory = useCallback(() => setHistoryContactId(null), []);

  const hasPreviousEdition = Boolean(event?.previous_edition);

  useEffect(() => {
    if (filter === 'previous_edition' && !hasPreviousEdition) setFilter('all');
  }, [filter, hasPreviousEdition]);

  const toggleOpen = async () => {
    if (!event) return;
    setActing('toggle');
    try {
      const updated = await eventRegistrationService.updateEvent(event.id, { is_open: !event.is_open });
      setEvent(updated);
      setCounts(updated.counts);
      notify(updated.is_open ? 'Registration reopened' : 'Registration closed', 'success');
    } catch (error: unknown) {
      notify(describeFailure(error, 'The form could not be updated.').message, 'error');
    } finally {
      setActing(null);
    }
  };

  const remove = async () => {
    if (!event) return;
    const confirmed = window.confirm(
      `Delete "${event.name}"? Its QR code and link will stop working and its registrations will no longer count in other forms' history. To stop new sign-ups but keep everything, close the form instead.`,
    );
    if (!confirmed) return;
    setActing('delete');
    try {
      await eventRegistrationService.deleteEvent(event.id);
      navigate('/registration-events', { state: { deletedName: event.name } });
    } catch (error: unknown) {
      notify(describeFailure(error, 'The form could not be deleted.').message, 'error');
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
      downloadCsv(`${fileSlug(event.name, 'registrations')}-registrations-${new Date().toISOString().slice(0, 10)}.csv`, csv);
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
              Back to Registration Forms
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

  return (
    <div className="px-4 sm:px-6 py-8 max-w-5xl mx-auto space-y-5">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="space-y-3">
        <StandardButton variant="ghost" size="sm" icon={ArrowLeft} onClick={() => navigate('/registration-events')}>
          Back to Registration Forms
        </StandardButton>
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
          <div className="space-y-1.5 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 break-words">{event.name}</h1>
              <span className={statusPillClass(event.status, themeColor, fullColor)}>
                {STATUS_LABELS[event.status]}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600">
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="h-4 w-4 text-gray-400" aria-hidden="true" />
                {formatDateLong(event.event_date)}
              </span>
              {event.location_name && (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-4 w-4 text-gray-400" aria-hidden="true" />
                  {locationDisplayName(event.location_name)}
                </span>
              )}
            </div>
            {event.event && (
              <p className="inline-flex items-center gap-1.5 text-sm text-gray-600">
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
                    Last year&apos;s edition: {event.previous_edition.name}
                  </Link>
                )}
                {event.next_edition && (
                  <Link to={`/registration-events/${event.next_edition.id}`} className={theme.link}>
                    Next edition: {event.next_edition.name}
                  </Link>
                )}
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2 flex-shrink-0">
            <StandardButton variant="secondary" size="sm" icon={Pencil} onClick={() => setShowEdit(true)} disabled={acting !== null}>
              Edit
            </StandardButton>
            {!event.next_edition && (
              <StandardButton variant="secondary" size="sm" icon={CopyPlus} onClick={startNextEdition}>
                Next year&apos;s edition
              </StandardButton>
            )}
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
            <StandardButton variant="danger" size="sm" icon={Trash2} onClick={() => void remove()} disabled={acting !== null} loading={acting === 'delete'}>
              Delete
            </StandardButton>
          </div>
        </div>
        {past && (
          <p className="text-sm text-gray-600">Registration closed automatically after the event date. Everything stays here.</p>
        )}
      </div>

      <RegistrationQrPanel event={event} onNotify={notify} />

      <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 ${hasPreviousEdition ? 'lg:grid-cols-3 xl:grid-cols-5' : 'lg:grid-cols-4'}`}>
        <MetricTile
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
        <MetricTile
          icon={UserCheck}
          accent={tileAccent}
          label="Unique registrations"
          value={tallies.unique_registrations}
          hint="Entries with the same phone and the same email count once — e.g. a parent who registers 3 children with their own details: 3 entries, 1 unique."
        />
        <MetricTile
          icon={Users}
          accent={tileAccent}
          label="Same-contact groups"
          value={tallies.duplicate_groups}
          hint={`${tallies.duplicate_groups} group${tallies.duplicate_groups === 1 ? '' : 's'} covering ${tallies.entries_in_duplicate_groups} entr${tallies.entries_in_duplicate_groups === 1 ? 'y' : 'ies'}.`}
        />
        <MetricTile
          icon={History}
          accent={tileAccent}
          label="Registered before"
          value={tallies.returning_contacts}
          hint="Registered for an earlier event that had already taken place."
        />
        {hasPreviousEdition && (
          <MetricTile
            icon={CalendarClock}
            accent={tileAccent}
            label={`Registered for ${previousName}`}
            value={tallies.previous_edition_registrants}
            hint="The same person also registered for last year's edition."
          />
        )}
      </div>
      <p className="text-xs text-gray-500 -mt-2">
        These numbers count registrations only. They don&apos;t show who attended.
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

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <div className="p-4 border-b border-gray-100 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <Users className="h-5 w-5 text-gray-500" aria-hidden="true" />
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
              <div key={i} className="h-16 bg-gray-100 rounded-md animate-pulse" />
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
            {groups.map((group) => (
              <li key={group.contact_id} className="p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                  <div className="min-w-0 space-y-1">
                    <p className="font-medium text-gray-900 break-all">{group.email}</p>
                    <p className="text-sm text-gray-600">
                      {formatPhoneForDisplay(group.phone) || group.phone} · {group.entry_count} entr{group.entry_count === 1 ? 'y' : 'ies'}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {group.is_duplicate && (
                        <span className={SAME_CONTACT_CHIP}>
                          Same contact ×{group.entry_count}
                        </span>
                      )}
                      {group.registered_before_other_name && (
                        <span className="text-xs text-gray-500">These contact details registered before under another name</span>
                      )}
                    </div>
                  </div>
                  {filter !== 'hidden' && (
                    <StandardButton variant="ghost" size="sm" icon={History} onClick={() => setHistoryContactId(group.contact_id)}>
                      {group.other_event_count > 0
                        ? `Registration history (${group.other_event_count} other form${group.other_event_count === 1 ? '' : 's'})`
                        : 'Registration history'}
                    </StandardButton>
                  )}
                </div>
                <ul className="rounded-lg border border-gray-100 divide-y divide-gray-100">
                  {group.entries.map((entry) => (
                    <li key={entry.id} className="px-3 py-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div className="min-w-0 space-y-1">
                        <p className="text-sm font-medium text-gray-900 break-words">{entry.name}</p>
                        <p className="text-xs text-gray-500">Registered {formatDateTimeET(entry.registered_at)}</p>
                        {(entry.returning || entry.registered_previous_edition) && (
                          <div className="flex flex-wrap gap-1.5">
                            {entry.returning && (
                              <span className={registeredBeforeChip(themeColor, fullColor)}>Registered before</span>
                            )}
                            {entry.registered_previous_edition && (
                              <span className={LAST_YEAR_CHIP}>Registered for {previousName}</span>
                            )}
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
                          <>
                            <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
                            Hide
                          </>
                        ) : (
                          <>
                            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                            Restore
                          </>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
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
          onClose={closeEdit}
          onSaved={(result) => {
            setShowEdit(false);
            setEvent(result.event);
            setCounts(result.event.counts);
            notify('Registration form saved', 'success');
          }}
        />
      )}

      {nextEdition && (
        <RegistrationEventFormModal
          eventId={null}
          prefill={nextEdition}
          onClose={closeNextEdition}
          onSaved={(result) => {
            setNextEdition(null);
            navigate(`/registration-events/${result.event.id}`);
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
