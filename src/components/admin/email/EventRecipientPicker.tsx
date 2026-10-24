import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, Loader2, MapPin, RefreshCcw, Search, X } from 'lucide-react';
import eventRegistrationService from '../../../services/EventRegistrationService';
import { describeFailure, STATUS_LABELS } from '../registration-events/registrationEventUi';
import { formatDateLong } from '../../../utils/timeFormat';
import { locationDisplayName } from '../../../utils/locationName';
import type { RegistrationEventSummary, RegistrationFormStatus } from '../../../types/eventRegistration.types';

const MAX_EVENT_FORMS = 100;

interface EventRecipientPickerProps {
  selectedIds: number[];
  onChange: (ids: number[]) => void;
  themeColor: string;
  fullColor: string;
  disabled?: boolean;
}

interface PickerEvent {
  key: string;
  name: string;
  eventDate: string;
  status: RegistrationFormStatus;
  forms: RegistrationEventSummary[];
}

const formLocation = (form: RegistrationEventSummary) =>
  form.location_name ? locationDisplayName(form.location_name) : `Location ${form.location_id}`;

const peopleLabel = (count: number) => `${count} ${count === 1 ? 'person' : 'people'}`;

const eventStatus = (forms: RegistrationEventSummary[]): RegistrationFormStatus => {
  if (forms.some(form => form.status === 'open')) return 'open';
  return forms.every(form => form.status === 'past') ? 'past' : 'closed';
};

const groupForms = (forms: RegistrationEventSummary[]): PickerEvent[] => {
  const events = new Map<string, PickerEvent>();

  forms.forEach(form => {
    const key = form.group ? `group-${form.group.id}` : `form-${form.id}`;
    const existing = events.get(key);

    if (existing) {
      existing.forms.push(form);
      return;
    }

    events.set(key, {
      key,
      name: form.group?.name ?? form.name,
      eventDate: form.group?.event_date ?? form.event_date,
      status: form.status,
      forms: [form],
    });
  });

  return [...events.values()]
    .map(event => ({
      ...event,
      status: eventStatus(event.forms),
      forms: [...event.forms].sort((a, b) => formLocation(a).localeCompare(formLocation(b))),
    }))
    .sort((a, b) => b.eventDate.localeCompare(a.eventDate) || a.name.localeCompare(b.name));
};

const EventRecipientPicker = ({ selectedIds, onChange, fullColor, disabled = false }: EventRecipientPickerProps) => {
  const [forms, setForms] = useState<RegistrationEventSummary[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [limitMessage, setLimitMessage] = useState<string | null>(null);
  const latest = useRef({ selectedIds, onChange });

  useEffect(() => {
    latest.current = { selectedIds, onChange };
  });

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const list = await eventRegistrationService.listEvents();
      setForms(list);
      const known = new Set(list.map(form => form.id));
      const { selectedIds: current, onChange: notify } = latest.current;
      const kept = current.filter(id => known.has(id));
      if (kept.length !== current.length) {
        notify(kept);
      }
    } catch (error) {
      setLoadError(describeFailure(error, 'Could not load your events. Please try again.').message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const locations = useMemo(() => {
    const names = new Map<number, string>();
    (forms ?? []).forEach(form => names.set(form.location_id, formLocation(form)));
    return [...names.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [forms]);

  const multiLocation = locations.length > 1;

  const visibleEvents = useMemo(() => {
    const term = search.trim().toLowerCase();
    const shown = (forms ?? []).filter(form => {
      if (locationFilter && String(form.location_id) !== locationFilter) return false;
      if (!term) return true;
      return `${form.group?.name ?? ''} ${form.name} ${formLocation(form)}`.toLowerCase().includes(term);
    });
    return groupForms(shown);
  }, [forms, search, locationFilter]);

  const allEvents = useMemo(() => groupForms(forms ?? []), [forms]);
  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);
  const shownIds = useMemo(() => visibleEvents.flatMap(event => event.forms.map(form => form.id)), [visibleEvents]);
  const allShownChosen = shownIds.length > 0 && shownIds.every(id => selected.has(id));
  const pickedEvents = allEvents.filter(event => event.forms.some(form => selected.has(form.id))).length;

  const apply = (next: number[]) => {
    if (next.length > MAX_EVENT_FORMS) {
      setLimitMessage(`One campaign can cover up to ${MAX_EVENT_FORMS} registration forms. Narrow the list or send a second campaign.`);
      return;
    }
    setLimitMessage(null);
    onChange(next);
  };

  const toggleIds = (ids: number[], on: boolean) => {
    if (on) {
      apply([...selectedIds, ...ids.filter(id => !selected.has(id))]);
    } else {
      const removing = new Set(ids);
      apply(selectedIds.filter(id => !removing.has(id)));
    }
  };

  const summary = () => {
    if (selectedIds.length === 0) return 'No events picked yet';
    const events = `${pickedEvents} event${pickedEvents === 1 ? '' : 's'} picked`;
    return multiLocation ? `${events} · ${selectedIds.length} location form${selectedIds.length === 1 ? '' : 's'}` : events;
  };

  const statusChip = (status: RegistrationFormStatus) => (
    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full shrink-0 ${status === 'open' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'}`}>
      {STATUS_LABELS[status]}
    </span>
  );

  if (loading && forms === null) {
    return (
      <div className="space-y-2" aria-busy="true">
        {[1, 2, 3].map(i => <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />)}
      </div>
    );
  }

  if (loadError && forms === null) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-700 flex flex-wrap items-center justify-between gap-2">
        <span>{loadError}</span>
        <button type="button" onClick={load} className="inline-flex items-center gap-1 text-sm font-medium text-red-700 hover:underline">
          <RefreshCcw className="w-3.5 h-3.5" />
          Try again
        </button>
      </div>
    );
  }

  if ((forms ?? []).length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 px-4 py-5 text-center">
        <CalendarDays className="w-6 h-6 text-gray-300 mx-auto mb-2" />
        <p className="text-sm text-gray-600">There are no registration forms yet.</p>
        <p className="text-xs text-gray-500 mt-1">
          Create one under{' '}
          <Link to="/registration-events" className={`text-${fullColor} hover:underline`}>Events, Registration Forms</Link>.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-gray-800">{summary()}</p>
        <div className="flex items-center gap-3">
          {selectedIds.length > 0 && (
            <button type="button" onClick={() => apply([])} disabled={disabled} className="text-xs font-medium text-gray-500 hover:underline disabled:opacity-50">
              Clear
            </button>
          )}
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-700 disabled:opacity-50"
            title="Reload the list of events"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCcw className="w-3.5 h-3.5" />}
            Refresh
          </button>
        </div>
      </div>

      <div className={`grid grid-cols-1 gap-2 ${multiLocation ? 'sm:grid-cols-[1fr_auto]' : ''}`}>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            aria-label={multiLocation ? 'Search events or locations' : 'Search events'}
            placeholder={multiLocation ? 'Search events or locations…' : 'Search events…'}
            className="w-full rounded-lg border border-gray-300 pl-9 pr-8 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          {search && (
            <button type="button" onClick={() => setSearch('')} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        {multiLocation && (
          <select
            value={locationFilter}
            onChange={e => setLocationFilter(e.target.value)}
            aria-label="Show events at"
            className="w-full sm:w-56 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">All locations</option>
            {locations.map(location => (
              <option key={location.id} value={location.id}>{location.name}</option>
            ))}
          </select>
        )}
      </div>

      <div className="rounded-lg border border-gray-200">
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-gray-50 border-b border-gray-200 rounded-t-lg">
          <span className="text-xs text-gray-500">
            {visibleEvents.length} event{visibleEvents.length === 1 ? '' : 's'} shown
            {locationFilter ? ` at ${locations.find(location => String(location.id) === locationFilter)?.name ?? 'this location'}` : ''}
          </span>
          <button
            type="button"
            onClick={() => toggleIds(shownIds, !allShownChosen)}
            disabled={disabled || shownIds.length === 0}
            className={`text-xs font-semibold text-${fullColor} hover:underline disabled:text-gray-300 disabled:no-underline`}
          >
            {allShownChosen ? 'Remove all shown' : 'Choose all shown'}
          </button>
        </div>

        {visibleEvents.length === 0 ? (
          <p className="px-3 py-4 text-sm text-gray-500">No events match this search{locationFilter ? ' at this location' : ''}.</p>
        ) : (
          <ul className="max-h-80 overflow-y-auto divide-y divide-gray-100">
            {visibleEvents.map(event => {
              const ids = event.forms.map(form => form.id);
              const chosen = ids.filter(id => selected.has(id)).length;
              const allChosen = chosen === ids.length;
              const people = event.forms.reduce((sum, form) => sum + form.unique_registrations, 0);

              if (event.forms.length === 1) {
                const form = event.forms[0];
                return (
                  <li key={event.key}>
                    <label className={`flex items-start gap-3 px-3 py-2.5 ${disabled ? 'cursor-not-allowed opacity-70' : 'cursor-pointer hover:bg-gray-100'}`}>
                      <input
                        type="checkbox"
                        checked={selected.has(form.id)}
                        onChange={() => toggleIds([form.id], !selected.has(form.id))}
                        disabled={disabled}
                        className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium text-gray-900 break-words">{event.name}</span>
                          {statusChip(form.status)}
                        </span>
                        <span className="block text-xs text-gray-500 mt-0.5">
                          {formatDateLong(form.event_date)}
                          {multiLocation ? ` · ${formLocation(form)}` : ''}
                          {` · ${peopleLabel(form.unique_registrations)}`}
                        </span>
                      </span>
                    </label>
                  </li>
                );
              }

              return (
                <li key={event.key} className="py-1">
                  <label className={`flex items-start gap-3 px-3 py-2 ${disabled ? 'cursor-not-allowed opacity-70' : 'cursor-pointer hover:bg-gray-100'}`}>
                    <input
                      type="checkbox"
                      checked={allChosen}
                      ref={element => {
                        if (element) element.indeterminate = chosen > 0 && !allChosen;
                      }}
                      onChange={() => toggleIds(ids, !allChosen)}
                      disabled={disabled}
                      className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-gray-900 break-words">{event.name}</span>
                        {statusChip(event.status)}
                      </span>
                      <span className="block text-xs text-gray-500 mt-0.5">
                        {formatDateLong(event.eventDate)} · {event.forms.length} locations · {peopleLabel(people)}
                        {chosen > 0 && !allChosen ? ` · ${chosen} of ${ids.length} picked` : ''}
                      </span>
                    </span>
                  </label>
                  <div className="pl-10 pr-3 pb-1 grid grid-cols-1 sm:grid-cols-2 gap-x-3">
                    {event.forms.map(form => (
                      <label
                        key={form.id}
                        className={`flex items-center gap-2 px-2 py-1.5 rounded-md ${disabled ? 'cursor-not-allowed opacity-70' : 'cursor-pointer hover:bg-gray-100'}`}
                      >
                        <input
                          type="checkbox"
                          checked={selected.has(form.id)}
                          onChange={() => toggleIds([form.id], !selected.has(form.id))}
                          disabled={disabled}
                          className="h-4 w-4 shrink-0 rounded border-gray-300"
                        />
                        <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        <span className="min-w-0 break-words text-sm text-gray-700">{formLocation(form)}</span>
                        <span className="ml-auto shrink-0 text-xs text-gray-500">{peopleLabel(form.unique_registrations)}</span>
                      </label>
                    ))}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {limitMessage && <p className="text-xs text-red-600">{limitMessage}</p>}
      {loadError && forms !== null && <p className="text-xs text-red-600">{loadError}</p>}
    </div>
  );
};

export default EventRecipientPicker;
