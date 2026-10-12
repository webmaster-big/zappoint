import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Building2, Calendar, CheckCircle2, ChevronLeft, ChevronRight, Clock, DoorOpen, LayoutGrid, Package as PackageIcon, ShieldCheck, Sun, X } from 'lucide-react';
import StandardButton from '../../ui/StandardButton';
import { packageService, roomService, attractionService } from '../../../services';
import { eventService } from '../../../services/EventService';
import {
  dayOffService,
  type AvailabilityBlock,
  type BlockingScope,
  type BlockPayload,
  type UpdateDayOffData,
} from '../../../services/DayOffService';
import { describeBlockedPeriod, describeOperatingWindow, operatingWindowError } from '../../../utils/dayOffClosure';
import { getStoredUser } from '../../../utils/storage';

type FormMode = 'create' | 'edit' | 'bulk';
type WindowChoice = 'full_day' | 'operating_window';

interface PickItem {
  id: number;
  name: string;
  category?: string | null;
}

interface Resources {
  packages: PickItem[];
  rooms: PickItem[];
  attractions: PickItem[];
  events: PickItem[];
}

interface LocationOption {
  id: number;
  name: string;
}

export interface AvailabilityBlockFormProps {
  mode: FormMode;
  source?: AvailabilityBlock | null;
  duplicate?: boolean;
  isCompanyAdmin: boolean;
  locations: LocationOption[];
  defaultLocationId: number | null;
  themeColor: string;
  fullColor: string;
  onCancel: () => void;
  onSaved: (message: string, type?: 'success' | 'info' | 'error') => void;
  onPartialSave?: () => void;
  onBusyChange?: (busy: boolean) => void;
  olderPartners?: AvailabilityBlock[];
}

const RESOURCE_TTL = 120000;
const resourceCache = new Map<number, { at: number; data: Resources }>();

const eventList = (response: unknown): Array<{ id: number; name: string; location_id?: number | null }> => {
  if (Array.isArray(response)) return response;
  const data = (response as { data?: unknown })?.data;
  if (Array.isArray(data)) return data;
  const nested = (data as { events?: unknown } | undefined)?.events;
  return Array.isArray(nested) ? nested : [];
};

const loadResources = async (locationId: number): Promise<Resources> => {
  const cached = resourceCache.get(locationId);
  if (cached && Date.now() - cached.at < RESOURCE_TTL) return cached.data;

  const [packages, rooms, attractions, events] = await Promise.all([
    packageService.getAllPackages({ location_id: locationId, is_active: true }),
    roomService.getAllRooms({ location_id: locationId }),
    attractionService.getAllAttractions({ location_id: locationId, is_active: true }),
    eventService.getEvents({ location_id: locationId, is_active: true, per_page: 100 }),
  ]);

  const toItems = (list: Array<{ id: number; name: string; category?: string | null; location_id?: number | null }>): PickItem[] =>
    list
      .filter(item => item.location_id === undefined || item.location_id === null || Number(item.location_id) === locationId)
      .map(item => ({ id: item.id, name: item.name, category: item.category ?? null }))
      .sort((a, b) => a.name.localeCompare(b.name));

  const data: Resources = {
    packages: toItems(packages),
    rooms: toItems(rooms),
    attractions: toItems(attractions),
    events: toItems(eventList(events)),
  };

  resourceCache.set(locationId, { at: Date.now(), data });
  return data;
};

const SCOPES: Array<{ key: BlockingScope; label: string; hint: string; icon: typeof Building2 }> = [
  { key: 'location', label: 'Entire location', hint: 'Everything at this location', icon: Building2 },
  { key: 'packages', label: 'Birthday packages', hint: 'Choose packages', icon: PackageIcon },
  { key: 'rooms', label: 'Rooms', hint: 'Choose rooms / spaces', icon: DoorOpen },
  { key: 'attractions', label: 'Attractions', hint: 'Choose one or more', icon: LayoutGrid },
  { key: 'events', label: 'Events', hint: 'Choose events', icon: Calendar },
];

const SCOPE_FIELD: Record<Exclude<BlockingScope, 'location'>, 'package_ids' | 'room_ids' | 'attraction_ids' | 'event_ids'> = {
  packages: 'package_ids',
  rooms: 'room_ids',
  attractions: 'attraction_ids',
  events: 'event_ids',
};

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const pad = (value: number) => String(value).padStart(2, '0');

const todayString = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};

const shortTime = (time?: string | null): string => (time ? time.slice(0, 5) : '');

const roleLabel = (role?: string | null): string => {
  if (role === 'company_admin') return 'Company admin';
  if (role === 'location_manager') return 'Location manager';
  return role ? role.replace(/_/g, ' ') : '';
};

const scopeFromSource = (source?: AvailabilityBlock | null): BlockingScope | null => {
  if (!source) return 'location';
  return source.scope === 'mixed' ? null : source.scope;
};

const combinesWithPartners = (source: AvailabilityBlock | null | undefined, partners: AvailabilityBlock[]): boolean =>
  !!source && partners.length > 0 && ![source, ...partners].some(half => half.time_start && half.time_end);

const windowFromSource = (source?: AvailabilityBlock | null, partners: AvailabilityBlock[] = []): { choice: WindowChoice | null; opensAt: string; closesAt: string } => {
  if (!source || source.block_type === 'full_day') return { choice: 'full_day', opensAt: '', closesAt: '' };
  if (source.block_type === 'operating_window') {
    return { choice: 'operating_window', opensAt: shortTime(source.opens_at), closesAt: shortTime(source.closes_at) };
  }
  const halves = combinesWithPartners(source, partners) ? [source, ...partners] : [source];
  if (halves.some(half => half.time_start && half.time_end)) return { choice: null, opensAt: '', closesAt: '' };
  const opens = halves.filter(half => !half.time_start && half.time_end).map(half => shortTime(half.time_end)).sort().pop() ?? '';
  const closes = halves.filter(half => half.time_start && !half.time_end).map(half => shortTime(half.time_start)).sort()[0] ?? '';
  if (!opens && !closes) return { choice: null, opensAt: '', closesAt: '' };
  return { choice: 'operating_window', opensAt: opens, closesAt: closes };
};

const errorMessage = (error: unknown, fallback: string): { message: string; fields: Record<string, string> } => {
  const data = (error as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } })?.response?.data;
  const fields: Record<string, string> = {};
  Object.entries(data?.errors ?? {}).forEach(([key, messages]) => {
    if (Array.isArray(messages) && messages[0]) fields[key] = messages[0];
  });
  return { message: data?.message || (error instanceof Error ? error.message : fallback), fields };
};

const AvailabilityBlockForm: React.FC<AvailabilityBlockFormProps> = ({
  mode,
  source = null,
  duplicate = false,
  isCompanyAdmin,
  locations,
  defaultLocationId,
  themeColor,
  fullColor,
  onCancel,
  onSaved,
  onPartialSave,
  olderPartners = [],
  onBusyChange,
}) => {
  const currentUser = getStoredUser();
  const editing = mode === 'edit' && !!source;
  const isLegacy = source?.block_type === 'legacy_closure';
  const initialWindow = windowFromSource(source, olderPartners);

  const [locationId, setLocationId] = useState<number | null>(source?.location_id ?? defaultLocationId);
  const [date, setDate] = useState<string>(editing ? (source?.date ?? '') : '');
  const [bulkYear, setBulkYear] = useState<number>(new Date().getFullYear());
  const [bulkDates, setBulkDates] = useState<Set<string>>(new Set());
  const [windowChoice, setWindowChoice] = useState<WindowChoice | null>(initialWindow.choice);
  const [opensAt, setOpensAt] = useState(initialWindow.opensAt);
  const [closesAt, setClosesAt] = useState(initialWindow.closesAt);
  const [scope, setScope] = useState<BlockingScope | null>(scopeFromSource(source));
  const [selected, setSelected] = useState<Record<Exclude<BlockingScope, 'location'>, number[]>>({
    packages: source?.package_ids ?? [],
    rooms: source?.room_ids ?? [],
    attractions: source?.attraction_ids ?? [],
    events: source?.event_ids ?? [],
  });
  const [groupName, setGroupName] = useState(source?.group_name ?? '');
  const [reason, setReason] = useState(source?.reason ?? '');
  const [isRecurring, setIsRecurring] = useState<boolean>(source?.is_recurring ?? false);
  const [resources, setResources] = useState<Resources | null>(null);
  const [loadingResources, setLoadingResources] = useState(false);
  const [resourceError, setResourceError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [bulkFailures, setBulkFailures] = useState<Array<{ date: string; message: string }>>([]);

  useEffect(() => {
    onBusyChange?.(saving);
  }, [saving, onBusyChange]);

  useEffect(() => {
    if (!locationId) {
      setResources(null);
      return;
    }
    let cancelled = false;
    setLoadingResources(true);
    setResourceError(null);
    loadResources(locationId)
      .then(data => {
        if (!cancelled) setResources(data);
      })
      .catch(() => {
        if (!cancelled) setResourceError('Could not load this location’s packages, rooms and attractions. Close and try again.');
      })
      .finally(() => {
        if (!cancelled) setLoadingResources(false);
      });
    return () => {
      cancelled = true;
    };
  }, [locationId]);

  const windowProblem = windowChoice === 'operating_window' ? operatingWindowError(opensAt, closesAt) : null;

  const preview = useMemo(() => {
    if (windowChoice === 'full_day') return 'Closed all day — nothing can be booked online.';
    if (windowChoice !== 'operating_window' || windowProblem) return null;
    return `${describeOperatingWindow(opensAt, closesAt)}. ${describeBlockedPeriod(opensAt, closesAt)}.`;
  }, [windowChoice, opensAt, closesAt, windowProblem]);

  const changeLocation = (next: number | null) => {
    if (next !== locationId) {
      setSelected({ packages: [], rooms: [], attractions: [], events: [] });
    }
    setLocationId(next);
  };

  const toggleItem = (key: Exclude<BlockingScope, 'location'>, id: number) => {
    setSelected(prev => ({
      ...prev,
      [key]: prev[key].includes(id) ? prev[key].filter(existing => existing !== id) : [...prev[key], id],
    }));
  };

  const setItems = (key: Exclude<BlockingScope, 'location'>, ids: number[]) => {
    setSelected(prev => ({ ...prev, [key]: Array.from(new Set(ids)) }));
  };

  const validate = (): Record<string, string> => {
    const found: Record<string, string> = {};
    if (!locationId) found.location_id = 'Choose the location to block.';
    if (mode === 'bulk') {
      if (bulkDates.size === 0) found.date = 'Pick at least one date.';
    } else if (!date) {
      found.date = 'Pick the date to block.';
    }
    const isLeapDay = (value: string) => value.slice(5, 10) === '02-29';
    const keepsOwnLeapDay = editing && !!source?.is_recurring && (source.date ?? '').split('T')[0] === date;
    if (isRecurring && !keepsOwnLeapDay && (mode === 'bulk' ? Array.from(bulkDates).some(isLeapDay) : isLeapDay(date))) {
      found.date = 'A yearly block cannot fall on February 29, because most years do not have that day. Use February 28 or March 1, or make it a one-time block.';
    }
    if (!windowChoice) found.block_type = 'Choose a full-day closure or the hours it stays open.';
    if (windowProblem) found.opens_at = windowProblem;
    if (!scope) found.scope = 'Choose what to block.';
    if (scope && scope !== 'location' && selected[scope].length === 0) {
      found[SCOPE_FIELD[scope]] = `Choose at least one of the ${SCOPES.find(s => s.key === scope)?.label.toLowerCase()}.`;
    }
    if (!groupName.trim()) found.group_name = 'Enter the group or event this block is for.';
    if (!reason.trim()) found.reason = 'Enter the reason for this block.';
    return found;
  };

  const payloadFor = (forDate: string): BlockPayload => {
    const payload: BlockPayload = {
      location_id: locationId as number,
      date: forDate,
      block_type: windowChoice as WindowChoice,
      opens_at: windowChoice === 'operating_window' && opensAt ? opensAt : null,
      closes_at: windowChoice === 'operating_window' && closesAt ? closesAt : null,
      scope: scope as BlockingScope,
      reason: reason.trim(),
      group_name: groupName.trim(),
      is_recurring: isRecurring,
    };
    if (scope && scope !== 'location') {
      payload[SCOPE_FIELD[scope]] = selected[scope];
    }
    return payload;
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setServerError(null);
    setBulkFailures([]);
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setSaving(true);
    try {
      if (mode === 'bulk') {
        const dates = Array.from(bulkDates).sort();
        const failures: Array<{ date: string; message: string }> = [];
        let created = 0;
        for (const [index, forDate] of dates.entries()) {
          setProgress(`Saving ${index + 1} of ${dates.length}…`);
          try {
            await dayOffService.createDayOff(payloadFor(forDate));
            created += 1;
          } catch (error) {
            failures.push({ date: forDate, message: errorMessage(error, 'Could not save this date.').message });
          }
        }
        setProgress(null);
        if (failures.length === 0) {
          onSaved(`Blocked ${created} date${created === 1 ? '' : 's'}.`, 'success');
          return;
        }
        setBulkFailures(failures);
        setBulkDates(new Set(failures.map(failure => failure.date)));
        if (created > 0) {
          onPartialSave?.();
          setServerError(`Blocked ${created} date${created === 1 ? '' : 's'}. The dates still selected below were not saved.`);
        } else {
          setServerError('None of the dates were saved.');
        }
        return;
      }

      if (editing && source) {
        const changes: UpdateDayOffData = { ...payloadFor(date) };
        delete changes.location_id;
        const response = await dayOffService.updateDayOff(source.id, changes);
        const merged = response.merged_day_off_ids?.length ?? 0;
        if (response.message === 'Nothing changed') {
          onSaved('Nothing changed.', 'info');
        } else if (merged > 0) {
          onSaved(`Block updated. ${merged} older block${merged === 1 ? '' : 's'} for the same day ${merged === 1 ? 'was' : 'were'} merged into it.`, 'success');
        } else {
          onSaved('Block updated.', 'success');
        }
        return;
      }

      await dayOffService.createDayOff(payloadFor(date));
      onSaved('Block saved.', 'success');
    } catch (error) {
      const { message, fields } = errorMessage(error, 'Could not save this block.');
      setErrors(fields);
      setServerError(message);
    } finally {
      setSaving(false);
      setProgress(null);
    }
  };

  const isPastDay = (value: string) => value < todayString();

  const renderPicker = (key: Exclude<BlockingScope, 'location'>, label: string) => {
    const items = resources?.[key] ?? [];
    const chosen = selected[key];
    const birthdayIds = key === 'packages'
      ? items.filter(item => (item.category ?? '').toLowerCase().includes('birthday')).map(item => item.id)
      : [];
    const field = SCOPE_FIELD[key];

    return (
      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-medium text-gray-700">
            {label} <span className="text-red-500">*</span>
            {chosen.length > 0 && <span className="ml-1 text-gray-500">({chosen.length} chosen)</span>}
          </span>
          <div className="flex flex-wrap gap-1">
            {birthdayIds.length > 0 && (
              <button type="button" onClick={() => setItems(key, [...chosen, ...birthdayIds])} className="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700 hover:bg-gray-50">
                All Birthday packages
              </button>
            )}
            {items.length > 0 && (
              <button type="button" onClick={() => setItems(key, items.map(item => item.id))} className="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700 hover:bg-gray-50">
                Select all
              </button>
            )}
            {chosen.length > 0 && (
              <button type="button" onClick={() => setItems(key, [])} className="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700 hover:bg-gray-50">
                Clear
              </button>
            )}
          </div>
        </div>
        {loadingResources ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : resourceError ? (
          <p className="text-sm text-red-600">{resourceError}</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-gray-500">Nothing to choose at this location.</p>
        ) : (
          <div className="max-h-44 overflow-y-auto rounded-lg border border-gray-200 bg-white">
            {items.map(item => (
              <label key={item.id} className="flex cursor-pointer items-center gap-2 border-b border-gray-100 px-3 py-2 last:border-b-0 hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={chosen.includes(item.id)}
                  onChange={() => toggleItem(key, item.id)}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <span className="min-w-0 flex-1 truncate text-sm text-gray-800">{item.name}</span>
                {item.category && <span className="shrink-0 text-xs text-gray-400">{item.category}</span>}
              </label>
            ))}
          </div>
        )}
        {chosen.some(id => !items.some(item => item.id === id)) && !loadingResources && items.length > 0 && (
          <p className="mt-1 text-xs text-amber-700">Some chosen items are no longer active at this location; they stay on the block until you clear them.</p>
        )}
        {errors[field] && <p className="mt-1 text-xs text-red-600">{errors[field]}</p>}
      </div>
    );
  };

  const fieldError = (key: string) => errors[key] ? <p className="mt-1 text-xs text-red-600">{errors[key]}</p> : null;

  const title = mode === 'bulk' ? 'Block several dates' : editing ? 'Edit block' : duplicate ? 'Copy block' : 'Add a block';

  return (
    <form onSubmit={submit} className="flex max-h-[90vh] flex-col" noValidate>
      <div className="flex items-start justify-between border-b border-gray-100 px-6 py-4">
        <div>
          <h2 id="availability-block-form-title" className="text-lg font-semibold text-gray-900">{title}</h2>
          <p className="mt-0.5 text-xs text-gray-500">Guests cannot buy online during a block. Staff are warned before booking inside one.</p>
        </div>
        <button type="button" onClick={onCancel} disabled={saving} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600" aria-label="Close">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
        {isLegacy && editing && (
          <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              This block was saved in the older format (<span className="font-medium">{source?.window_label}</span>). Choose a full-day closure or the hours it stays open; a day can no longer be split into two separate windows.
              {olderPartners.length > 0 && (
                <> The other older block for this day ({olderPartners.map(partner => partner.window_label).join(', ')}) is merged into this one when you save, as long as you keep the same date, repeat setting, location and items, and the new hours still include it.{combinesWithPartners(source, olderPartners) ? ' The hours below already combine both.' : ''}</>
              )}
            </p>
          </div>
        )}
        {editing && source?.scope === 'mixed' && (
          <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>This block covered more than one kind of item ({source.scope_label}). Choose one kind to keep it on.</p>
          </div>
        )}

        <div className="flex items-start gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-gray-600" />
          <p className="text-sm text-gray-700">
            Recorded as <span className="font-semibold text-gray-900">{[currentUser?.first_name, currentUser?.last_name].filter(Boolean).join(' ') || currentUser?.email || 'you'}</span>
            {currentUser?.role && <span className="text-gray-500"> · {roleLabel(currentUser.role)}</span>}
            {editing && source?.set_by && source.set_by.id !== currentUser?.id && (
              <span className="block text-xs text-gray-500">Originally set by {source.set_by.name}</span>
            )}
          </p>
        </div>

        {isCompanyAdmin && !editing ? (
          <div>
            <label htmlFor="block-location" className="mb-1 block text-sm font-medium text-gray-700">Location <span className="text-red-500">*</span></label>
            <select
              id="block-location"
              value={locationId ?? ''}
              onChange={event => changeLocation(event.target.value ? Number(event.target.value) : null)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              disabled={saving}
            >
              <option value="">Choose a location</option>
              {locations.map(location => (
                <option key={location.id} value={location.id}>{location.name}</option>
              ))}
            </select>
            {fieldError('location_id')}
          </div>
        ) : (
          <p className="text-sm text-gray-700">
            Location: <span className="font-semibold text-gray-900">{locations.find(location => location.id === locationId)?.name ?? source?.location_name ?? currentUser?.location_name ?? 'Not set'}</span>
          </p>
        )}

        {mode === 'bulk' ? (
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Dates <span className="text-red-500">*</span> <span className="font-normal text-gray-500">({bulkDates.size} chosen)</span></span>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setBulkYear(year => year - 1)} disabled={saving} className="rounded-full p-1 hover:bg-gray-100" aria-label="Previous year">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="min-w-[3rem] text-center text-sm font-semibold">{bulkYear}</span>
                <button type="button" onClick={() => setBulkYear(year => year + 1)} disabled={saving} className="rounded-full p-1 hover:bg-gray-100" aria-label="Next year">
                  <ChevronRight className="h-4 w-4" />
                </button>
                {bulkDates.size > 0 && (
                  <button type="button" onClick={() => setBulkDates(new Set())} disabled={saving} className="text-xs text-red-600 hover:text-red-800">Clear</button>
                )}
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {MONTHS.map((monthName, monthIndex) => {
                const firstWeekday = new Date(bulkYear, monthIndex, 1).getDay();
                const days = new Date(bulkYear, monthIndex + 1, 0).getDate();
                return (
                  <div key={monthName} className="rounded-lg border border-gray-200 p-2">
                    <h4 className="mb-1 text-center text-xs font-semibold text-gray-700">{monthName}</h4>
                    <div className="grid grid-cols-7 gap-0.5 text-[11px]">
                      {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
                        <div key={index} className="py-0.5 text-center text-gray-400">{day}</div>
                      ))}
                      {Array.from({ length: firstWeekday }).map((_, index) => <div key={`blank-${index}`} />)}
                      {Array.from({ length: days }).map((_, index) => {
                        const value = `${bulkYear}-${pad(monthIndex + 1)}-${pad(index + 1)}`;
                        const past = isPastDay(value);
                        const on = bulkDates.has(value);
                        const failed = bulkFailures.some(failure => failure.date === value);
                        return (
                          <button
                            key={value}
                            type="button"
                            disabled={past || saving}
                            onClick={() => setBulkDates(prev => {
                              const next = new Set(prev);
                              if (next.has(value)) next.delete(value); else next.add(value);
                              return next;
                            })}
                            className={`rounded py-0.5 text-center transition-colors ${past ? 'cursor-not-allowed text-gray-300' : on ? (failed ? 'bg-red-600 text-white' : `bg-${fullColor} text-white`) : 'text-gray-700 hover:bg-gray-100'}`}
                          >
                            {index + 1}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
            {fieldError('date')}
          </div>
        ) : (
          <div>
            <label htmlFor="block-date" className="mb-1 block text-sm font-medium text-gray-700">Date <span className="text-red-500">*</span></label>
            <input
              id="block-date"
              type="date"
              value={date}
              min={editing ? undefined : todayString()}
              onChange={event => setDate(event.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              disabled={saving}
            />
            {fieldError('date')}
          </div>
        )}

        <div>
          <span className="mb-2 block text-sm font-medium text-gray-700">What should be blocked? <span className="text-red-500">*</span></span>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {SCOPES.map(option => {
              const on = scope === option.key;
              const Icon = option.icon;
              return (
                <button
                  key={option.key}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setScope(option.key)}
                  disabled={saving}
                  className={`flex items-start gap-2 rounded-lg border-2 p-2.5 text-left transition-colors ${on ? `border-${fullColor} bg-${themeColor}-50` : 'border-gray-200 hover:border-gray-300'}`}
                >
                  <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${on ? `text-${fullColor}` : 'text-gray-500'}`} />
                  <span>
                    <span className="block text-sm font-medium text-gray-900">{option.label}</span>
                    <span className="block text-xs text-gray-500">{option.hint}</span>
                  </span>
                </button>
              );
            })}
          </div>
          {fieldError('scope')}
          {scope && scope !== 'location' && (
            <div className="mt-3">
              {renderPicker(scope, SCOPES.find(option => option.key === scope)?.label ?? '')}
            </div>
          )}
        </div>

        <div>
          <span className="mb-2 block text-sm font-medium text-gray-700">When <span className="text-red-500">*</span></span>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              type="button"
              aria-pressed={windowChoice === 'full_day'}
              onClick={() => setWindowChoice('full_day')}
              disabled={saving}
              className={`flex items-start gap-2 rounded-lg border-2 p-2.5 text-left ${windowChoice === 'full_day' ? `border-${fullColor} bg-${themeColor}-50` : 'border-gray-200 hover:border-gray-300'}`}
            >
              <Sun className="mt-0.5 h-4 w-4 shrink-0 text-gray-600" />
              <span>
                <span className="block text-sm font-medium text-gray-900">Closed all day</span>
                <span className="block text-xs text-gray-500">Full-day closure</span>
              </span>
            </button>
            <button
              type="button"
              aria-pressed={windowChoice === 'operating_window'}
              onClick={() => setWindowChoice('operating_window')}
              disabled={saving}
              className={`flex items-start gap-2 rounded-lg border-2 p-2.5 text-left ${windowChoice === 'operating_window' ? `border-${fullColor} bg-${themeColor}-50` : 'border-gray-200 hover:border-gray-300'}`}
            >
              <Clock className="mt-0.5 h-4 w-4 shrink-0 text-gray-600" />
              <span>
                <span className="block text-sm font-medium text-gray-900">Open for set hours</span>
                <span className="block text-xs text-gray-500">One continuous window; blocked outside it</span>
              </span>
            </button>
          </div>
          {fieldError('block_type')}

          {windowChoice === 'operating_window' && (
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="block-opens" className="mb-1 block text-xs font-medium text-gray-700">Opens at</label>
                <input id="block-opens" type="time" value={opensAt} onChange={event => setOpensAt(event.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" disabled={saving} />
                <p className="mt-1 text-xs text-gray-500">Leave blank to open at the usual time.</p>
              </div>
              <div>
                <label htmlFor="block-closes" className="mb-1 block text-xs font-medium text-gray-700">Closes at</label>
                <input id="block-closes" type="time" value={closesAt} onChange={event => setClosesAt(event.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" disabled={saving} />
                <p className="mt-1 text-xs text-gray-500">Leave blank to close at the usual time. 12:00 AM means midnight.</p>
              </div>
            </div>
          )}
          {windowChoice === 'operating_window' && windowProblem && (opensAt || closesAt || errors.opens_at) && (
            <p className="mt-2 text-xs text-red-600">{windowProblem}</p>
          )}
          {errors.closes_at && <p className="mt-1 text-xs text-red-600">{errors.closes_at}</p>}
          {preview && (
            <p className="mt-2 flex items-start gap-1.5 text-xs text-gray-600">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-500" />
              {preview}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="block-group" className="mb-1 block text-sm font-medium text-gray-700">Group or event name <span className="text-red-500">*</span></label>
            <input
              id="block-group"
              type="text"
              maxLength={150}
              value={groupName}
              onChange={event => setGroupName(event.target.value)}
              placeholder="e.g. Acme Corp holiday party"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              disabled={saving}
            />
            {fieldError('group_name')}
          </div>
          <div>
            <label htmlFor="block-reason" className="mb-1 block text-sm font-medium text-gray-700">Reason <span className="text-red-500">*</span></label>
            <input
              id="block-reason"
              type="text"
              maxLength={255}
              value={reason}
              onChange={event => setReason(event.target.value)}
              placeholder="e.g. Private buyout, maintenance, holiday"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              disabled={saving}
            />
            {fieldError('reason')}
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-800">
          <input type="checkbox" checked={isRecurring} onChange={event => setIsRecurring(event.target.checked)} className="h-4 w-4 rounded border-gray-300" disabled={saving} />
          Repeat every year on this date
        </label>

        {serverError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            <p>{serverError}</p>
            {bulkFailures.length > 0 && (
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs">
                {bulkFailures.map(failure => (
                  <li key={failure.date}>{failure.date}: {failure.message}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-col-reverse gap-2 border-t border-gray-100 px-6 py-3 sm:flex-row sm:justify-end">
        <StandardButton type="button" variant="secondary" size="md" onClick={onCancel} disabled={saving}>Cancel</StandardButton>
        <StandardButton type="submit" variant="primary" size="md" loading={saving}>
          {progress ?? (mode === 'bulk' ? `Block ${bulkDates.size || ''} date${bulkDates.size === 1 ? '' : 's'}` : editing ? 'Save changes' : 'Save block')}
        </StandardButton>
      </div>
    </form>
  );
};

export default AvailabilityBlockForm;
