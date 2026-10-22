import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  CalendarDays,
  Camera,
  ChevronRight,
  ClipboardList,
  CopyPlus,
  Download,
  History,
  MapPin,
  Pencil,
  Plus,
  Search,
  UserCheck,
  Users,
} from 'lucide-react';
import StandardButton from '../../../components/ui/StandardButton';
import Toast from '../../../components/ui/Toast';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import RegistrationMetricTile from '../../../components/admin/registration-events/RegistrationMetricTile';
import RegistrationEventGroupModal, {
  type RegistrationGroupModalMode,
  type RegistrationGroupPrefill,
} from '../../../components/admin/registration-events/RegistrationEventGroupModal';
import {
  STATUS_LABELS,
  describeFailure,
  fileSlug,
  nextYearDate,
  statusPillClass,
  themedClasses,
  yearShift,
} from '../../../components/admin/registration-events/registrationEventUi';
import type { StaffRequestFailure } from '../../../components/admin/registration-events/registrationEventUi';
import { downloadCsv, toCsv } from '../../../components/admin/table';
import eventRegistrationService from '../../../services/EventRegistrationService';
import type { RegistrationEventGroupDetail } from '../../../types/eventRegistration.types';
import { useLocationScope } from '../../../contexts/LocationContext';
import { useThemeColor } from '../../../hooks/useThemeColor';
import { formatDateLong, formatDateTimeET } from '../../../utils/timeFormat';
import { formatPhoneForDisplay } from '../../../utils/bookingSearch';
import { locationDisplayName } from '../../../utils/locationName';

type ToastState = { message: string; type: 'success' | 'error' | 'info' } | null;

interface GroupPageState {
  removedVenue?: string;
  openEdit?: boolean;
  addLocations?: { locationIds: number[]; eventLinks?: Record<number, number> };
}

type PendingModal = { mode: 'edit' } | { mode: 'add-locations'; locationIds: number[]; eventLinks?: Record<number, number> };

const yesNo = (value: boolean): string => (value ? 'Yes' : 'No');

const RegistrationEventGroupView = ({ groupId }: { groupId: number }) => {
  const navigate = useNavigate();
  const routerLocation = useLocation();
  const { effectiveLocationId, isCompanyAdmin, switchLocation, canSwitchLocation } = useLocationScope();
  const { themeColor, fullColor } = useThemeColor();
  const theme = themedClasses(themeColor, fullColor);
  const [group, setGroup] = useState<RegistrationEventGroupDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState<StaffRequestFailure | null>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<{ mode: RegistrationGroupModalMode; prefill?: RegistrationGroupPrefill } | null>(null);
  const [exporting, setExporting] = useState(false);
  const [pendingModal, setPendingModal] = useState<PendingModal | null>(null);

  const load = useCallback(async () => {
    try {
      setGroup(await eventRegistrationService.getGroup(groupId));
      setFailure(null);
    } catch (error: unknown) {
      setFailure(describeFailure(error, 'This event could not be loaded.'));
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const state = routerLocation.state as GroupPageState | null;
    if (!state) return;
    if (state.removedVenue) setToast({ message: `Removed ${state.removedVenue} from this event`, type: 'success' });
    if (state.openEdit) setPendingModal({ mode: 'edit' });
    if (state.addLocations) setPendingModal({ mode: 'add-locations', ...state.addLocations });
    navigate(routerLocation.pathname, { replace: true, state: null });
  }, [routerLocation, navigate]);

  useEffect(() => {
    if (!pendingModal || !group) return;
    setPendingModal(null);
    if (!group.can_manage || (pendingModal.mode === 'add-locations' && !isCompanyAdmin)) {
      setToast({ message: 'Only a company admin can change this event.', type: 'info' });
      return;
    }
    if (pendingModal.mode === 'edit') {
      setModal({ mode: 'edit' });
      return;
    }
    const inEvent = new Set(group.forms.map((form) => form.location_id));
    const fresh = pendingModal.locationIds.filter((id) => !inEvent.has(id));
    if (fresh.length === 0) {
      const names = group.forms
        .filter((form) => pendingModal.locationIds.includes(form.location_id))
        .map((form) => (form.location_name ? locationDisplayName(form.location_name) : 'That location'));
      setToast({ message: `${names.join(', ') || 'That location'} ${names.length > 1 ? 'are' : 'is'} already in this event.`, type: 'info' });
      return;
    }
    setModal({ mode: 'add-locations', prefill: { locationIds: fresh, eventLinks: pendingModal.eventLinks } });
  }, [pendingModal, group, isCompanyAdmin]);

  const closeModal = useCallback(() => setModal(null), []);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <LoadingSpinner size="medium" />
      </div>
    );
  }

  if (failure || !group) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="text-center max-w-md space-y-4">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto" />
          <h1 className="text-xl font-bold text-gray-900">{failure?.message ?? 'This event could not be loaded.'}</h1>
          <div className="flex flex-col sm:flex-row gap-2 justify-center">
            {failure?.switchLocationId && canSwitchLocation && (
              <StandardButton variant="primary" onClick={() => void switchLocation(failure.switchLocationId as number, `/registration-events/event/${groupId}`)}>
                Switch to that location
              </StandardButton>
            )}
            {failure && !failure.switchLocationId && (failure.status === null || failure.status >= 500) && (
              <StandardButton
                variant="primary"
                onClick={() => {
                  setLoading(true);
                  void load();
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

  const year = group.event_date.slice(0, 4);
  const allLocations = group.forms.length === group.location_forms_total;
  const soleVenue = group.forms.length === 1 && group.forms[0].location_name ? locationDisplayName(group.forms[0].location_name) : null;
  const scopeLabel = allLocations ? 'All participating locations' : soleVenue ? `${soleVenue} only` : `${group.forms.length} of your locations`;
  const needle = group.forms.length > 1 ? search.trim().toLowerCase() : '';
  const forms = group.forms.filter((form) => !needle || (form.location_name ?? '').toLowerCase().includes(needle));
  const tileAccent = `bg-${themeColor}-100 text-${fullColor}`;

  const startNextEdition = () => {
    const shifted = yearShift(group.name, 1);
    setModal({
      mode: 'create',
      prefill: {
        name: shifted !== group.name ? shifted : `${group.name} ${Number(year) + 1}`,
        eventDate: nextYearDate(group.event_date),
        description: group.description ?? '',
        confirmationMessage: group.confirmation_message ?? '',
        locationIds: group.forms.map((form) => form.location_id),
        previousGroupId: group.id,
        previousGroupName: group.name,
        copyHeaderFromGroup: group.header_image_path ? group.id : null,
        headerImagePath: group.header_image_path,
      },
    });
  };

  const exportCsv = async () => {
    setExporting(true);
    try {
      const result = await eventRegistrationService.exportGroup(group.id);
      const csv = toCsv(
        [
          'Location',
          'Entry ID',
          'Registered',
          'Name',
          'Email',
          'Phone',
          'Contact ID',
          'Entries with same contact',
          'Same contact details',
          'Registered before',
          ...(result.has_previous_group ? ["Registered for last year's event"] : []),
        ],
        result.rows.map((row) => [
          row.location_name ? locationDisplayName(row.location_name) : '',
          row.entry_id,
          formatDateTimeET(row.registered_at),
          row.name,
          row.email,
          formatPhoneForDisplay(row.phone) || row.phone,
          row.contact_id,
          row.same_contact_entries,
          yesNo(row.is_duplicate),
          yesNo(row.returning),
          ...(result.has_previous_group ? [yesNo(row.registered_previous_edition)] : []),
        ]),
      );
      downloadCsv(`${fileSlug(group.name, 'event')}-registrations-${new Date().toISOString().slice(0, 10)}.csv`, csv);
      if (result.capped) {
        setToast({ message: `The export holds the first ${result.rows.length.toLocaleString()} of ${result.total.toLocaleString()} entries.`, type: 'info' });
      }
    } catch (error: unknown) {
      setToast({ message: describeFailure(error, 'The export failed. Please try again.').message, type: 'error' });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="px-4 sm:px-6 py-8 max-w-5xl mx-auto space-y-5">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="space-y-3">
        <StandardButton variant="ghost" size="sm" icon={ArrowLeft} onClick={() => navigate(`/registration-events?year=${year}`)}>
          All events
        </StandardButton>
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
          <div className="space-y-1.5 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 break-words">{group.name}</h1>
              <span className={statusPillClass(group.status, themeColor, fullColor)}>{STATUS_LABELS[group.status]}</span>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600">
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="h-4 w-4 text-gray-400" aria-hidden="true" />
                {formatDateLong(group.event_date)}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-4 w-4 text-gray-400" aria-hidden="true" />
                {group.location_forms_total} participating location{group.location_forms_total === 1 ? '' : 's'}
              </span>
            </div>
            {(group.previous_group || group.next_group) && (
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                {group.previous_group && (
                  <Link to={`/registration-events/event/${group.previous_group.id}`} className={theme.link}>
                    Last year&apos;s event: {group.previous_group.name}
                  </Link>
                )}
                {group.next_group && (
                  <Link to={`/registration-events/event/${group.next_group.id}`} className={theme.link}>
                    Next year&apos;s event: {group.next_group.name}
                  </Link>
                )}
              </div>
            )}
          </div>
          {group.can_manage && (
            <div className="flex flex-wrap gap-2 flex-shrink-0">
              <StandardButton variant="secondary" size="sm" icon={Pencil} onClick={() => setModal({ mode: 'edit' })}>
                Edit event
              </StandardButton>
              {isCompanyAdmin && (
                <StandardButton variant="primary" size="sm" icon={Plus} onClick={() => setModal({ mode: 'add-locations' })}>
                  Add location form
                </StandardButton>
              )}
              {!group.next_group && (
                <StandardButton variant="secondary" size="sm" icon={CopyPlus} onClick={startNextEdition}>
                  Next year&apos;s event
                </StandardButton>
              )}
            </div>
          )}
        </div>
      </div>

      <div className={`rounded-lg px-4 py-3 text-sm text-gray-800 flex items-center gap-2 ${theme.softPanel}`}>
        <MapPin className={`h-4 w-4 flex-shrink-0 ${theme.icon}`} aria-hidden="true" />
        <span>
          <span className="font-semibold">This event</span> · {scopeLabel}
        </span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <RegistrationMetricTile icon={ClipboardList} accent={tileAccent} label="Total entries" value={group.counts.total_entries} hint="Every form submitted, including repeats." />
        <RegistrationMetricTile
          icon={UserCheck}
          accent={tileAccent}
          label="Unique registrations"
          value={group.counts.unique_registrations}
          hint="Entries with the same phone and the same email count once."
        />
        <RegistrationMetricTile
          icon={MapPin}
          accent={tileAccent}
          label="Location forms"
          value={group.counts.location_forms}
          hint={allLocations ? 'Participating locations for this event.' : 'Your locations in this event.'}
        />
        <RegistrationMetricTile
          icon={History}
          accent={tileAccent}
          label="Registered before"
          value={group.counts.registered_before}
          hint="Registered for an earlier event that had already taken place."
        />
      </div>
      <p className="text-xs text-gray-500 -mt-2">
        {allLocations
          ? 'Combined registrations for this event across all participating locations.'
          : `Registrations for this event at ${soleVenue ?? 'your locations'}.`}{' '}
        They don&apos;t show who attended.
      </p>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <div className="p-4 border-b border-gray-100 space-y-3">
          <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <MapPin className={`h-5 w-5 ${theme.icon}`} aria-hidden="true" />
            Participating location forms
          </h2>
          {group.forms.length > 1 && (
            <label className="relative block">
              <span className="sr-only">Search locations</span>
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" aria-hidden="true" />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search locations"
                className={`${theme.input} pl-9`}
              />
            </label>
          )}
        </div>

        {forms.length === 0 ? (
          <p className="p-8 text-center text-sm text-gray-500">No locations match.</p>
        ) : (
          <ul className="p-3 space-y-2">
            {forms.map((form) => {
              const highlighted = isCompanyAdmin && effectiveLocationId !== null && Number(effectiveLocationId) === form.location_id;
              return (
                <li
                  key={form.id}
                  className={`relative rounded-lg border p-3 sm:p-4 flex items-center gap-3 transition-colors ${highlighted ? `border-${themeColor}-300 bg-${themeColor}-50` : 'border-gray-100 hover:bg-gray-100'}`}
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link to={`/registration-events/${form.id}`} className="font-semibold text-gray-900 hover:underline break-words after:absolute after:inset-0 after:rounded-lg">
                        {form.location_name ? locationDisplayName(form.location_name) : 'Location'}
                      </Link>
                      <span className={statusPillClass(form.status, themeColor, fullColor)}>{STATUS_LABELS[form.status]}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600">
                      <span className="inline-flex items-center gap-1.5">
                        <CalendarDays className="h-4 w-4 text-gray-400" aria-hidden="true" />
                        {formatDateLong(form.event_date)}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Users className="h-4 w-4 text-gray-400" aria-hidden="true" />
                        {form.total_entries} entr{form.total_entries === 1 ? 'y' : 'ies'} · {form.unique_registrations} unique
                      </span>
                      {form.photo_frames && (
                        <span className="inline-flex items-center gap-1.5 min-w-0">
                          <Camera className="h-4 w-4 text-gray-400 flex-shrink-0" aria-hidden="true" />
                          <span className="truncate">
                            {form.photo_frames.frames.length > 0 ? `Frame: ${form.photo_frames.frames[0].name}` : 'No frame'}
                          </span>
                        </span>
                      )}
                    </div>
                  </div>
                  <StandardButton
                    variant="secondary"
                    size="sm"
                    icon={ChevronRight}
                    iconPosition="right"
                    onClick={() => navigate(`/registration-events/${form.id}`)}
                    className="relative z-10 flex-shrink-0 whitespace-nowrap"
                  >
                    View form
                  </StandardButton>
                </li>
              );
            })}
          </ul>
        )}

        <div className="p-4 border-t border-gray-100 flex justify-end">
          <StandardButton variant="secondary" size="sm" icon={Download} onClick={() => void exportCsv()} loading={exporting} disabled={exporting}>
            Export event CSV
          </StandardButton>
        </div>
      </div>

      {modal && (
        <RegistrationEventGroupModal
          key={modal.mode}
          mode={modal.mode}
          group={modal.mode === 'create' ? null : group}
          prefill={modal.prefill}
          onClose={closeModal}
          onSaved={(saved) => {
            const mode = modal.mode;
            setModal(null);
            if (mode === 'create') {
              navigate(`/registration-events/event/${saved.id}`);
              return;
            }
            setGroup(saved);
            setToast({ message: mode === 'add-locations' ? 'Location forms added' : 'Event saved', type: 'success' });
          }}
          onDeleted={() => navigate('/registration-events', { state: { deletedName: group.name } })}
        />
      )}
    </div>
  );
};

const RegistrationEventGroupPage = () => {
  const { groupId = '' } = useParams<{ groupId: string }>();
  return <RegistrationEventGroupView key={groupId} groupId={Number(groupId)} />;
};

export default RegistrationEventGroupPage;
