import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { Link } from 'react-router-dom';
import { CalendarCheck, ClipboardList, ImageIcon, Loader2, MapPin, Trash2, Upload, X } from 'lucide-react';
import StandardButton from '../../ui/StandardButton';
import eventRegistrationService from '../../../services/EventRegistrationService';
import type {
  RegistrationCreateResult,
  RegistrationEventDetail,
  RegistrationEventInput,
  RegistrationEventOption,
  RegistrationEventSummary,
} from '../../../types/eventRegistration.types';
import { useLocationScope } from '../../../contexts/LocationContext';
import { useThemeColor } from '../../../hooks/useThemeColor';
import { getImageUrl, getStoredUser } from '../../../utils/storage';
import { formatDateLong } from '../../../utils/timeFormat';
import { locationDisplayName } from '../../../utils/locationName';
import { michiganTodayKey } from '../../../utils/dashboardTimeframe';
import {
  describeFailure,
  eventFirstDay,
  eventLastDay,
  fieldErrorsFrom,
  formatEventDates,
  matchingEventAt,
  themedClasses,
} from './registrationEventUi';

export interface RegistrationFormPrefill {
  name?: string;
  locationIds?: number[];
  eventDate?: string;
  description?: string;
  confirmationMessage?: string;
  previousEditionId?: number | null;
  eventId?: number | null;
  copyHeaderImageFrom?: number | null;
  headerImagePath?: string | null;
}

interface RegistrationEventFormModalProps {
  eventId: number | null;
  prefill?: RegistrationFormPrefill;
  onClose: () => void;
  onSaved: (result: RegistrationCreateResult, created: boolean) => void;
}

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

const RegistrationEventFormModal = ({ eventId, prefill, onClose, onSaved }: RegistrationEventFormModalProps) => {
  const { isCompanyAdmin, locations, effectiveLocationId } = useLocationScope();
  const { themeColor, fullColor } = useThemeColor();
  const theme = themedClasses(themeColor, fullColor);
  const currentUser = getStoredUser();
  const editing = eventId !== null;
  const ownLocationId: number | null = currentUser?.location_id ?? null;
  const locationsLocked = !editing && Boolean(prefill?.previousEditionId);

  const initialLocations = (): number[] => {
    if (prefill?.locationIds?.length) return prefill.locationIds;
    if (!isCompanyAdmin) return ownLocationId ? [ownLocationId] : [];
    if (effectiveLocationId) return [effectiveLocationId];
    return locations.length === 1 ? [Number(locations[0].id)] : [];
  };

  const [loading, setLoading] = useState(editing);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [detail, setDetail] = useState<RegistrationEventDetail | null>(null);
  const [name, setName] = useState(prefill?.name ?? '');
  const [locationIds, setLocationIds] = useState<number[]>(() => (editing ? [] : initialLocations()));
  const [eventDate, setEventDate] = useState(prefill?.eventDate ?? '');
  const [description, setDescription] = useState(prefill?.description ?? '');
  const [confirmationMessage, setConfirmationMessage] = useState(prefill?.confirmationMessage ?? '');
  const [previousEditionId, setPreviousEditionId] = useState(prefill?.previousEditionId ? String(prefill.previousEditionId) : '');
  const [linkedEventId, setLinkedEventId] = useState(prefill?.eventId ? String(prefill.eventId) : '');
  const [sourceEventId, setSourceEventId] = useState<number | null>(null);
  const [today] = useState(() => michiganTodayKey());
  const [useEventImage, setUseEventImage] = useState(false);
  const [copyHeaderFrom, setCopyHeaderFrom] = useState<number | null>(prefill?.copyHeaderImageFrom ?? null);
  const [isOpen, setIsOpen] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [editions, setEditions] = useState<RegistrationEventSummary[]>([]);
  const [eventOptions, setEventOptions] = useState<RegistrationEventOption[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const prefillApplied = useRef(false);
  const autoFilled = useRef<{ name?: string; description?: string; date?: string }>({
    date: prefill?.previousEditionId ? prefill.eventDate : undefined,
  });

  const singleLocation = locationIds.length === 1 ? locationIds[0] : null;

  useEffect(() => {
    if (eventId === null) return undefined;
    let cancelled = false;
    eventRegistrationService
      .getEvent(eventId)
      .then((event) => {
        if (cancelled) return;
        setDetail(event);
        setName(event.name);
        setLocationIds([event.location_id]);
        setEventDate(event.event_date);
        setDescription(event.description ?? '');
        setConfirmationMessage(event.confirmation_message ?? '');
        setPreviousEditionId(event.previous_edition ? String(event.previous_edition.id) : '');
        setLinkedEventId(event.event ? String(event.event.id) : '');
        setIsOpen(event.is_open);
        setLoading(false);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setLoadError(describeFailure(error, 'This form could not be loaded.').message);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  useEffect(() => {
    let cancelled = false;
    const wanted = prefill?.eventId ?? null;
    eventRegistrationService
      .eventOptions()
      .then(async (options) => {
        const missing = wanted !== null && !options.some((option) => option.id === wanted);
        const extra = missing ? await eventRegistrationService.eventOptions({ id: wanted }).catch(() => []) : [];
        if (!cancelled) setEventOptions([...options, ...extra]);
      })
      .catch(() => {
        if (!cancelled) setEventOptions([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setEditions([]);
    if (!singleLocation) return undefined;
    let cancelled = false;
    eventRegistrationService
      .listEvents({ location_id: singleLocation })
      .then((events) => {
        if (!cancelled) setEditions(events);
      })
      .catch(() => {
        if (!cancelled) setEditions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [singleLocation]);

  useEffect(() => {
    if (!file) {
      setFilePreview(null);
      return undefined;
    }
    const url = URL.createObjectURL(file);
    setFilePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, saving]);

  const sourceEvent = useMemo(
    () => (sourceEventId === null ? null : eventOptions.find((option) => option.id === sourceEventId) ?? null),
    [eventOptions, sourceEventId],
  );

  const choosableLocations = useMemo(
    () => (isCompanyAdmin && !locationsLocked ? null : new Set(locationIds)),
    [isCompanyAdmin, locationsLocked, locationIds],
  );

  const listedLocations = useMemo(() => new Set(locations.map((location) => Number(location.id))), [locations]);

  const sourceChoices = useMemo(
    () => eventOptions
      .filter((option) => (choosableLocations === null ? listedLocations.has(option.location_id) : choosableLocations.has(option.location_id)))
      .filter((option) => option.id === sourceEventId || eventLastDay(option) >= today)
      .sort((a, b) => eventFirstDay(a).localeCompare(eventFirstDay(b)) || a.name.localeCompare(b.name) || a.id - b.id),
    [eventOptions, choosableLocations, listedLocations, sourceEventId, today],
  );

  const linkFor = (locationId: number): RegistrationEventOption | null =>
    sourceEvent ? matchingEventAt(sourceEvent, locationId, eventOptions, today) : null;

  const formDateFor = (locationId: number): string => {
    const link = linkFor(locationId);
    return link && link.id !== sourceEvent?.id ? eventLastDay(link) : eventDate;
  };

  const linkableEvents = useMemo(
    () => eventOptions.filter((option) => singleLocation !== null && option.location_id === singleLocation),
    [eventOptions, singleLocation],
  );

  const editionOptions = useMemo(
    () => editions
      .filter((event) => event.id !== eventId)
      .filter((event) => !eventDate || event.event_date < eventDate || String(event.id) === previousEditionId)
      .sort((a, b) => b.event_date.localeCompare(a.event_date)),
    [editions, eventId, eventDate, previousEditionId],
  );

  const chooseSource = (id: number | null, options: RegistrationEventOption[] = eventOptions) => {
    setSourceEventId(id);
    setErrors((current) => ({ ...current, event_id: '', event_links: '' }));
    const source = id === null ? null : options.find((option) => option.id === id) ?? null;
    if (!source) {
      setUseEventImage(false);
      return;
    }
    const filled = autoFilled.current;
    const replaceable = (current: string, previous: string | undefined) => !current.trim() || current === previous;
    const nextName = source.name.trim();
    const nextDescription = source.description ?? '';
    const nextDate = eventLastDay(source);
    setName((current) => (replaceable(current, filled.name) ? nextName : current));
    setDescription((current) => (replaceable(current, filled.description) ? nextDescription : current));
    setEventDate((current) => (replaceable(current, filled.date) ? nextDate : current));
    autoFilled.current = { name: nextName, description: nextDescription, date: nextDate };
    setUseEventImage(source.has_image && !file && !copyHeaderFrom);
    if (isCompanyAdmin && !locationsLocked) {
      const venues = new Set<number>(listedLocations.has(source.location_id) ? [source.location_id] : []);
      locations.forEach((location) => {
        const id = Number(location.id);
        const match = id === source.location_id ? null : matchingEventAt(source, id, options, today);
        if (match && match.is_active && match.registration_form_ids.length === 0 && eventLastDay(match) >= today) venues.add(id);
      });
      const next = Array.from(venues);
      if (!(locationIds.length === 1 && next.length === 1 && next[0] === locationIds[0])) {
        setPreviousEditionId('');
      }
      setLocationIds(next);
      setErrors((current) => ({ ...current, location_ids: '', location_id: '', previous_edition_id: '' }));
    }
  };

  useEffect(() => {
    if (prefillApplied.current || editing || !prefill?.eventId || eventOptions.length === 0) return;
    if (isCompanyAdmin && locations.length === 0) return;
    prefillApplied.current = true;
    const wanted = eventOptions.find((option) => option.id === prefill.eventId);
    if (wanted && (!isCompanyAdmin || listedLocations.has(wanted.location_id))) chooseSource(wanted.id, eventOptions);
  });

  const locationLocked = Boolean(detail?.location_locked);
  const copiedImage = copyHeaderFrom && prefill?.headerImagePath ? getImageUrl(prefill.headerImagePath) : null;
  const eventImage = !editing && useEventImage && sourceEvent?.image ? getImageUrl(sourceEvent.image) : null;
  const existingImage = detail?.header_image_path && !removeImage ? getImageUrl(detail.header_image_path) : null;
  const shownImage = filePreview ?? existingImage ?? copiedImage ?? eventImage;

  const venueName = (id: number | null) => {
    if (id === null) return null;
    const known = locations.find((location) => Number(location.id) === id)?.name
      ?? (detail?.location_id === id ? detail.location_name : null)
      ?? (id === ownLocationId ? currentUser?.location_name : null);
    return known ? locationDisplayName(known) : null;
  };

  const toggleLocation = (id: number) => {
    setLocationIds((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]));
    setPreviousEditionId('');
    setErrors((current) => ({ ...current, location_ids: '', location_id: '', previous_edition_id: '' }));
  };

  const changeEditLocation = (next: number) => {
    if (locationIds[0] === next) return;
    setLocationIds([next]);
    setPreviousEditionId('');
    setLinkedEventId('');
    setErrors((current) => ({ ...current, location_id: '', previous_edition_id: '', event_id: '' }));
  };

  const pickFile = (event: ChangeEvent<HTMLInputElement>) => {
    const chosen = event.target.files?.[0];
    event.target.value = '';
    if (!chosen) return;
    if (!IMAGE_TYPES.includes(chosen.type)) {
      setErrors((current) => ({ ...current, header_image: 'Please choose a PNG, JPEG or WebP image.' }));
      return;
    }
    if (chosen.size > MAX_IMAGE_BYTES) {
      setErrors((current) => ({ ...current, header_image: 'That image is larger than 8 MB. Please use a smaller file.' }));
      return;
    }
    setErrors((current) => ({ ...current, header_image: '' }));
    setFile(chosen);
    setRemoveImage(false);
    setCopyHeaderFrom(null);
    setUseEventImage(false);
  };

  const clearImage = () => {
    if (file) {
      setFile(null);
      return;
    }
    if (copiedImage) {
      setCopyHeaderFrom(null);
      return;
    }
    if (eventImage) {
      setUseEventImage(false);
      return;
    }
    setRemoveImage(true);
  };

  const save = async () => {
    const nextErrors: Record<string, string> = {};
    if (!name.trim()) nextErrors.name = 'Please give the form a name.';
    if (locationIds.length === 0) nextErrors[editing ? 'location_id' : 'location_ids'] = 'Choose at least one location.';
    if (!eventDate) nextErrors.event_date = 'Choose the event date.';
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setSaving(true);
    setErrors({});
    setFormError(null);
    try {
      if (eventId === null) {
        const eventLinks: Record<number, number> = {};
        locationIds.forEach((id) => {
          const link = linkFor(id);
          if (link) eventLinks[id] = link.id;
        });
        const input: RegistrationEventInput = {
          name: name.trim(),
          location_ids: locationIds,
          event_date: eventDate,
          description,
          confirmation_message: confirmationMessage,
          previous_edition_id: singleLocation && previousEditionId ? Number(previousEditionId) : null,
          event_id: sourceEvent ? sourceEvent.id : null,
          event_links: eventLinks,
          use_event_image: !file && !copiedImage && useEventImage,
          copy_header_image_from: !file && copiedImage ? copyHeaderFrom : null,
          is_open: isOpen,
          header_image: file,
        };
        onSaved(await eventRegistrationService.createEvent(input), true);
      } else {
        const input: Partial<RegistrationEventInput> = {};
        const previousId = previousEditionId ? Number(previousEditionId) : null;
        const linkedId = linkedEventId ? Number(linkedEventId) : null;
        if (!detail || name.trim() !== detail.name) input.name = name.trim();
        if (!detail || locationIds[0] !== detail.location_id) input.location_id = locationIds[0];
        if (!detail || eventDate !== detail.event_date) input.event_date = eventDate;
        if (!detail || description !== (detail.description ?? '')) input.description = description;
        if (!detail || confirmationMessage !== (detail.confirmation_message ?? '')) input.confirmation_message = confirmationMessage;
        if (!detail || previousId !== (detail.previous_edition?.id ?? null)) input.previous_edition_id = previousId;
        if (!detail || linkedId !== (detail.event?.id ?? null)) input.event_id = linkedId;
        if (!detail || isOpen !== detail.is_open) input.is_open = isOpen;
        if (file) input.header_image = file;
        else if (removeImage) input.remove_header_image = true;
        const updated = await eventRegistrationService.updateEvent(eventId, input);
        onSaved({ event: updated, created: [updated] }, false);
      }
    } catch (error: unknown) {
      const fields = fieldErrorsFrom(error);
      const locationsField = Object.keys(fields).find((key) => key.startsWith('location_ids'));
      if (locationsField) fields.location_ids = fields[locationsField];
      if (Object.keys(fields).length > 0) {
        setErrors(fields);
      } else {
        setFormError(describeFailure(error, 'The form could not be saved. Please try again.').message);
      }
    } finally {
      setSaving(false);
    }
  };

  const error = (field: string) =>
    errors[field] ? <p className="mt-1 text-sm text-red-600">{errors[field]}</p> : null;

  const inputClass = (field: string) => (errors[field] ? theme.invalidInput : theme.input);

  const allSelected = locations.length > 0 && locations.every((location) => locationIds.includes(Number(location.id)));
  const fixedVenue = venueName(locationIds[0] ?? null);
  const fixedLink = locationIds[0] !== undefined ? linkFor(locationIds[0]) : null;
  const showVenueChoices = isCompanyAdmin && !editing && !locationsLocked;
  const existingForms = sourceEvent
    ? (choosableLocations === null ? locations.map((location) => Number(location.id)) : locationIds).flatMap((id) => {
      const link = linkFor(id);
      return link && link.registration_form_ids.length > 0
        ? [{ locationId: id, formId: link.registration_form_ids[link.registration_form_ids.length - 1] }]
        : [];
    })
    : [];
  const otherDates = !editing && sourceEvent
    ? locationIds
      .filter((id) => formDateFor(id) !== eventDate)
      .map((id) => `${venueName(id) ?? 'Another location'} ${formatDateLong(formDateFor(id))}`)
    : [];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-backdrop-fade">
      <div
        className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto relative animate-scale-in"
        role="dialog"
        aria-modal="true"
        aria-labelledby="registration-form-modal-title"
      >
        <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`p-2 rounded-lg bg-${themeColor}-100 flex-shrink-0`}>
              <ClipboardList className={`w-5 h-5 text-${themeColor}-600`} aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h3 id="registration-form-modal-title" className="text-lg font-bold text-gray-900">
                {editing ? 'Edit Registration Form' : 'New Registration Form'}
              </h3>
              <p className="text-xs text-gray-500">
                {editing ? 'Changes apply to the form guests see right away.' : 'Guests sign up by scanning the QR code for this form.'}
              </p>
            </div>
          </div>
          <StandardButton
            onClick={onClose}
            disabled={saving}
            variant="ghost"
            size="sm"
            icon={X}
            title="Close"
            className="text-gray-400 hover:text-gray-600"
          />
        </div>

        {loading ? (
          <div className="py-12 flex justify-center" role="status">
            <Loader2 className={`w-6 h-6 animate-spin text-${themeColor}-600`} aria-hidden="true" />
            <span className="sr-only">Loading…</span>
          </div>
        ) : loadError ? (
          <div className="p-6">
            <p className="text-sm text-red-700" role="alert">{loadError}</p>
          </div>
        ) : (
          <div className="px-6 py-5 space-y-5">
            {!editing && (
              <div className={`rounded-lg p-4 space-y-2 ${theme.softPanel}`}>
                <label htmlFor="registration-form-source" className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                  <CalendarCheck className={`h-4 w-4 ${theme.icon}`} aria-hidden="true" />
                  Start from an event <span className="font-normal text-gray-500">(optional)</span>
                </label>
                <select
                  id="registration-form-source"
                  value={sourceEventId === null ? '' : String(sourceEventId)}
                  onChange={(event) => chooseSource(event.target.value ? Number(event.target.value) : null)}
                  className={inputClass('event_id')}
                >
                  <option value="">No linked event</option>
                  {sourceChoices.map((option) => (
                    <option key={option.id} value={String(option.id)}>
                      {option.name.trim()} — {formatEventDates(option)}
                      {choosableLocations === null && locations.length > 1 && option.location_name ? ` · ${locationDisplayName(option.location_name)}` : ''}
                      {option.registration_form_ids.length > 0 ? ' · has a form' : ''}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-600">
                  {choosableLocations === null
                    ? "Fills in the name, date, description and picture, ticks the other locations running the same event, and links each form to its own location's event."
                    : 'Fills in the name, date, description and picture, and links the form to that event.'}
                </p>
                {existingForms.length > 0 && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 space-y-1">
                    {existingForms.map(({ locationId, formId }) => (
                      <p key={locationId} className="text-xs text-amber-900">
                        {venueName(locationId) ?? 'This location'} already has a form for this event.{' '}
                        <Link to={`/registration-events/${formId}`} className="font-semibold underline">
                          Open it
                        </Link>
                      </p>
                    ))}
                  </div>
                )}
                {error('event_id')}
              </div>
            )}

            <div>
              <label htmlFor="registration-form-name" className="block text-sm font-semibold text-gray-800 mb-1.5">
                Event name <span className="text-red-500">*</span>
              </label>
              <input
                id="registration-form-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={120}
                placeholder="e.g. Halloween Bash 2026"
                className={inputClass('name')}
              />
              {error('name')}
            </div>

            <div>
              <span className="block text-sm font-semibold text-gray-800 mb-1.5">
                {showVenueChoices ? 'Locations' : 'Location'}
              </span>
              {showVenueChoices ? (
                <div className="space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {locations.map((location) => {
                      const id = Number(location.id);
                      const checked = locationIds.includes(id);
                      const link = linkFor(id);
                      return (
                        <label
                          key={id}
                          className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm cursor-pointer ${checked ? `border-${themeColor}-300 bg-${themeColor}-50 text-gray-900` : 'border-gray-200 text-gray-700 hover:bg-gray-50'}`}
                        >
                          <input type="checkbox" checked={checked} onChange={() => toggleLocation(id)} className={`mt-0.5 h-4 w-4 ${theme.accent}`} />
                          <span className="min-w-0">
                            <span className="block truncate">{locationDisplayName(location.name)}</span>
                            {sourceEvent && (
                              <span className="block text-xs text-gray-500 truncate">
                                {link
                                  ? `Its event: ${formatEventDates(link)}${link.registration_form_ids.length > 0 ? ' · has a form' : ''}`
                                  : 'No matching event'}
                              </span>
                            )}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                  {locations.length > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        setLocationIds(allSelected ? [] : locations.map((location) => Number(location.id)));
                        setPreviousEditionId('');
                        setErrors((current) => ({ ...current, location_ids: '', location_id: '', previous_edition_id: '' }));
                      }}
                      className={`text-sm ${theme.link}`}
                    >
                      {allSelected ? 'Clear all' : 'Select all locations'}
                    </button>
                  )}
                  <p className="text-xs text-gray-500">
                    {locationIds.length > 1
                      ? `${locationIds.length} separate forms will be created — one per location, each with its own QR code and list.`
                      : 'Pick several locations to create a separate form for each one in one go.'}
                  </p>
                </div>
              ) : isCompanyAdmin && editing && !locationLocked ? (
                <select
                  value={locationIds[0] ? String(locationIds[0]) : ''}
                  onChange={(event) => changeEditLocation(Number(event.target.value))}
                  className={inputClass('location_id')}
                  aria-label="Location"
                >
                  {locations.map((location) => (
                    <option key={location.id} value={String(location.id)}>
                      {locationDisplayName(location.name)}
                    </option>
                  ))}
                </select>
              ) : (
                <div className={`flex items-start gap-2 rounded-lg border px-3 py-2 ${fixedVenue ? `border-${themeColor}-200 bg-${themeColor}-50` : 'border-amber-200 bg-amber-50'}`}>
                  <MapPin className={`w-4 h-4 mt-0.5 shrink-0 ${fixedVenue ? `text-${fullColor}` : 'text-amber-700'}`} aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="text-sm text-neutral-700">
                      {editing ? 'At ' : 'Creating at '}
                      <span className="font-semibold text-neutral-900">{fixedVenue ?? 'no location assigned'}</span>
                    </p>
                    {!editing && sourceEvent && (
                      <p className="text-xs text-gray-600">
                        {fixedLink ? `Linked to its event: ${formatEventDates(fixedLink)}` : "No matching event at this location, so the form won't be linked."}
                      </p>
                    )}
                  </div>
                </div>
              )}
              {locationLocked && isCompanyAdmin && (
                <p className="mt-1 text-xs text-gray-500">
                  The location is fixed once people have registered or another form links to this one.
                </p>
              )}
              {error('location_ids')}
              {error('location_id')}
              {error('event_links')}
            </div>

            <div>
              <label htmlFor="registration-form-date" className="block text-sm font-semibold text-gray-800 mb-1.5">
                Event date <span className="text-red-500">*</span>
              </label>
              <input
                id="registration-form-date"
                type="date"
                value={eventDate}
                onChange={(event) => setEventDate(event.target.value)}
                className={inputClass('event_date')}
              />
              <p className="mt-1 text-xs text-gray-500">Registration closes automatically after this date.</p>
              {otherDates.length > 0 && (
                <p className="mt-1 text-xs text-gray-600">
                  Locations linked to their own event close after that event instead: {otherDates.join(' · ')}.
                </p>
              )}
              {error('event_date')}
            </div>

            {editing && (
              <div>
                <label htmlFor="registration-form-linked" className="block text-sm font-semibold text-gray-800 mb-1.5">
                  Linked event <span className="font-normal text-gray-500">(optional)</span>
                </label>
                <select
                  id="registration-form-linked"
                  value={linkedEventId}
                  onChange={(event) => setLinkedEventId(event.target.value)}
                  className={inputClass('event_id')}
                >
                  <option value="">No linked event</option>
                  {linkableEvents.map((option) => (
                    <option key={option.id} value={String(option.id)}>
                      {option.name.trim()} — {formatEventDates(option)}
                    </option>
                  ))}
                  {detail?.event && !linkableEvents.some((option) => option.id === detail.event?.id) && (
                    <option value={String(detail.event.id)}>{detail.event.name}</option>
                  )}
                </select>
                <p className="mt-1 text-xs text-gray-500">The event in Manage Events at this location that this form is for.</p>
                {error('event_id')}
              </div>
            )}

            <div>
              <span className="block text-sm font-semibold text-gray-800 mb-1.5">Header image</span>
              {shownImage ? (
                <div className="space-y-2">
                  <div className="overflow-hidden rounded-lg border border-gray-200 bg-gray-900">
                    <img src={shownImage} alt="" className="block w-full max-h-56 object-contain" />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <Upload className="w-3.5 h-3.5" aria-hidden="true" />
                      Replace
                    </button>
                    <button
                      type="button"
                      onClick={clearImage}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-600 bg-white border border-gray-300 rounded-lg hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                      Remove
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-gray-300 px-4 py-6 text-sm text-gray-600 hover:border-gray-400"
                >
                  <ImageIcon className="h-6 w-6 text-gray-400" aria-hidden="true" />
                  Choose an image
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={pickFile}
                className="sr-only"
                aria-label="Header image file"
              />
              {!editing && sourceEvent?.has_image && !file && !copiedImage && (
                <label className="mt-2 flex items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" checked={useEventImage} onChange={(event) => setUseEventImage(event.target.checked)} className={`h-4 w-4 ${theme.accent}`} />
                  Use the event&apos;s picture
                </label>
              )}
              <p className="mt-1 text-xs text-gray-500">
                PNG, JPEG or WebP up to 8 MB. Wide images work best, e.g. 1600 × 800. Put anything written on the image
                (date, time, ages) in the description too.
              </p>
              {error('header_image')}
            </div>

            <div>
              <label htmlFor="registration-form-description" className="block text-sm font-semibold text-gray-800 mb-1.5">
                Description <span className="font-normal text-gray-500">(optional)</span>
              </label>
              <textarea
                id="registration-form-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={3}
                maxLength={2000}
                placeholder="Shown under the event name on the form"
                className={inputClass('description')}
              />
              {error('description')}
            </div>

            <div>
              <label htmlFor="registration-form-confirmation" className="block text-sm font-semibold text-gray-800 mb-1.5">
                Confirmation message <span className="font-normal text-gray-500">(optional)</span>
              </label>
              <textarea
                id="registration-form-confirmation"
                value={confirmationMessage}
                onChange={(event) => setConfirmationMessage(event.target.value)}
                rows={2}
                maxLength={500}
                placeholder="Shown after someone registers, e.g. See you at 6 pm!"
                className={inputClass('confirmation_message')}
              />
              {error('confirmation_message')}
            </div>

            <div>
              <label htmlFor="registration-form-previous" className="block text-sm font-semibold text-gray-800 mb-1.5">
                Last year&apos;s edition <span className="font-normal text-gray-500">(optional)</span>
              </label>
              {singleLocation ? (
                <>
                  <select
                    id="registration-form-previous"
                    value={previousEditionId}
                    onChange={(event) => setPreviousEditionId(event.target.value)}
                    className={inputClass('previous_edition_id')}
                  >
                    <option value="">None</option>
                    {editionOptions.map((option) => (
                      <option key={option.id} value={String(option.id)}>
                        {option.name} — {formatDateLong(option.event_date)}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-gray-500">
                    Pick the same event from last year at this location to see who registered for it then.
                  </p>
                </>
              ) : (
                <p className="text-sm text-gray-500">
                  {locationIds.length > 1
                    ? "Create the forms first, then open each one to link last year's edition at that location."
                    : 'Choose a location first.'}
                </p>
              )}
              {error('previous_edition_id')}
            </div>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={isOpen}
                onChange={(event) => setIsOpen(event.target.checked)}
                className={`mt-0.5 h-4 w-4 ${theme.accent}`}
              />
              <span>
                <span className="block text-sm font-semibold text-gray-800">Accepting registrations</span>
                <span className="block text-xs text-gray-500">Turn off to stop new sign-ups. It also closes automatically after the event date.</span>
              </span>
            </label>

            {formError && <p className="text-sm text-red-700" role="alert">{formError}</p>}
          </div>
        )}

        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 flex justify-end gap-3">
          <StandardButton variant="secondary" size="md" onClick={onClose} disabled={saving}>
            Cancel
          </StandardButton>
          <StandardButton
            variant="primary"
            size="md"
            onClick={() => void save()}
            disabled={saving || loading || Boolean(loadError)}
            loading={saving}
          >
            {editing ? 'Save changes' : locationIds.length > 1 ? `Create ${locationIds.length} forms` : 'Create form'}
          </StandardButton>
        </div>
      </div>
    </div>
  );
};

export default RegistrationEventFormModal;
