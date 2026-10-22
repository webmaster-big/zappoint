import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { isAxiosError } from 'axios';
import { CalendarCheck, CalendarRange, ImageIcon, MapPin, Trash2, Upload, X } from 'lucide-react';
import StandardButton from '../../ui/StandardButton';
import eventRegistrationService from '../../../services/EventRegistrationService';
import type {
  RegistrationEventGroupDetail,
  RegistrationEventGroupInput,
  RegistrationEventGroupSummary,
  RegistrationEventOption,
  RegistrationMergeCandidate,
  RegistrationOptionGroup,
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

export type RegistrationGroupModalMode = 'create' | 'edit' | 'add-locations';

export interface RegistrationGroupPrefill {
  name?: string;
  eventDate?: string;
  description?: string;
  confirmationMessage?: string;
  locationIds?: number[];
  previousGroupId?: number | null;
  previousGroupName?: string | null;
  eventId?: number | null;
  eventLinks?: Record<number, number>;
  copyHeaderFromGroup?: number | null;
  headerImagePath?: string | null;
}

interface RegistrationEventGroupModalProps {
  mode: RegistrationGroupModalMode;
  group?: RegistrationEventGroupDetail | null;
  prefill?: RegistrationGroupPrefill;
  onClose: () => void;
  onSaved: (group: RegistrationEventGroupDetail) => void;
  onDeleted?: () => void;
}

interface RemovalResponse {
  code?: string;
  message?: string;
}

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

const RegistrationEventGroupModal = ({ mode, group, prefill, onClose, onSaved, onDeleted }: RegistrationEventGroupModalProps) => {
  const navigate = useNavigate();
  const { isCompanyAdmin, locations, effectiveLocationId } = useLocationScope();
  const { themeColor, fullColor } = useThemeColor();
  const theme = themedClasses(themeColor, fullColor);
  const currentUser = getStoredUser();
  const ownLocationId: number | null = currentUser?.location_id ?? null;
  const creating = mode === 'create';
  const editing = mode === 'edit';
  const adding = mode === 'add-locations';
  const nextEditionMode = creating && Boolean(prefill?.previousGroupId);
  const existingLocations = useMemo(() => (group ? group.forms.map((form) => form.location_id) : []), [group]);
  const openStates = useMemo(() => (group ? group.forms.map((form) => form.is_open) : []), [group]);
  const allOpen = openStates.length > 0 && openStates.every(Boolean);
  const mixedOpen = editing && openStates.some(Boolean) && openStates.some((value) => !value);
  const candidates = useMemo(() => {
    const byLocation = new Map<number, RegistrationMergeCandidate>();
    (creating ? [] : group?.merge_candidates ?? []).forEach((candidate) => {
      if (!byLocation.has(candidate.location_id)) byLocation.set(candidate.location_id, candidate);
    });
    return byLocation;
  }, [creating, group]);
  const prefillLinks = useMemo<Record<number, number>>(() => (adding ? prefill?.eventLinks ?? {} : {}), [adding, prefill]);

  const initialLocations = (): number[] => {
    if (!creating) {
      const extra = adding ? (prefill?.locationIds ?? []).filter((id) => !existingLocations.includes(id)) : [];
      return [...existingLocations, ...extra];
    }
    if (prefill?.locationIds?.length) return prefill.locationIds;
    if (!isCompanyAdmin) return ownLocationId ? [ownLocationId] : [];
    if (effectiveLocationId) return [effectiveLocationId];
    return locations.length === 1 ? [Number(locations[0].id)] : [];
  };

  const [name, setName] = useState(creating ? prefill?.name ?? '' : group?.name ?? '');
  const [eventDate, setEventDate] = useState(creating ? prefill?.eventDate ?? '' : group?.event_date ?? '');
  const [description, setDescription] = useState(creating ? prefill?.description ?? '' : group?.description ?? '');
  const [confirmationMessage, setConfirmationMessage] = useState(creating ? prefill?.confirmationMessage ?? '' : group?.confirmation_message ?? '');
  const [locationIds, setLocationIds] = useState<number[]>(initialLocations);
  const [previousGroupId, setPreviousGroupId] = useState(() => {
    const id = creating ? prefill?.previousGroupId : group?.previous_group?.id;
    return id ? String(id) : '';
  });
  const [sourceEventId, setSourceEventId] = useState<number | null>(null);
  const [today] = useState(() => michiganTodayKey());
  const [useEventImage, setUseEventImage] = useState(false);
  const [copyHeaderFromGroup, setCopyHeaderFromGroup] = useState<number | null>(creating ? prefill?.copyHeaderFromGroup ?? null : null);
  const [isOpen, setIsOpen] = useState(() => (editing ? allOpen : true));
  const [openTouched, setOpenTouched] = useState(false);
  const [moveChoice, setMoveChoice] = useState<Record<number, boolean>>({});
  const [linking, setLinking] = useState(false);
  const [linkError, setLinkError] = useState<{ locationId: number; message: string } | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [eventOptions, setEventOptions] = useState<RegistrationEventOption[]>([]);
  const [optionsLoaded, setOptionsLoaded] = useState(false);
  const [previousOptions, setPreviousOptions] = useState<RegistrationEventGroupSummary[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const prefillApplied = useRef(false);
  const autoFilled = useRef<{ name?: string; description?: string; date?: string }>({
    date: nextEditionMode ? prefill?.eventDate : undefined,
  });

  const year = Number((eventDate || today).slice(0, 4));

  useEffect(() => {
    let cancelled = false;
    const wanted = creating
      ? (prefill?.eventId ? [prefill.eventId] : [])
      : Object.values(prefillLinks);
    eventRegistrationService
      .eventOptions()
      .then(async (options) => {
        const missing = wanted.filter((id) => !options.some((option) => option.id === id));
        const extra = (await Promise.all(missing.map((id) => eventRegistrationService.eventOptions({ id }).catch(() => [])))).flat();
        if (cancelled) return;
        setEventOptions([...options, ...extra]);
        setOptionsLoaded(true);
      })
      .catch(() => {
        if (cancelled) return;
        setEventOptions([]);
        setOptionsLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (adding || !Number.isFinite(year)) return undefined;
    let cancelled = false;
    Promise.all([eventRegistrationService.listGroups({ year: year - 1 }), eventRegistrationService.listGroups({ year })])
      .then(([earlier, current]) => {
        if (!cancelled) setPreviousOptions([...earlier.event_groups, ...current.event_groups]);
      })
      .catch(() => {
        if (!cancelled) setPreviousOptions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [adding, year]);

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
      if (event.key === 'Escape' && !saving && !deleting && !linking) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, saving, deleting, linking]);

  const listedLocations = useMemo(() => new Set(locations.map((location) => Number(location.id))), [locations]);
  const sidebarLocation = isCompanyAdmin && creating && !nextEditionMode && effectiveLocationId ? Number(effectiveLocationId) : null;

  const sourceVenues = useMemo<Set<number> | null>(() => {
    if (!isCompanyAdmin || nextEditionMode) return new Set(locationIds);
    if (sidebarLocation !== null) return new Set([sidebarLocation, ...locationIds]);
    return null;
  }, [isCompanyAdmin, nextEditionMode, sidebarLocation, locationIds]);

  const sourceEvent = useMemo(
    () => (sourceEventId === null ? null : eventOptions.find((option) => option.id === sourceEventId) ?? null),
    [eventOptions, sourceEventId],
  );

  const groupSource = useMemo(() => {
    if (creating || !group) return null;
    const linked = group.forms.find((form) => form.event)?.event;
    return linked ? eventOptions.find((option) => option.id === linked.id) ?? null : null;
  }, [creating, group, eventOptions]);

  const matchSource = creating ? sourceEvent : groupSource;

  const sourceChoices = useMemo(
    () => eventOptions
      .filter((option) => sourceVenues === null || sourceVenues.has(option.location_id))
      .filter((option) => !isCompanyAdmin || listedLocations.has(option.location_id))
      .filter((option) => option.id === sourceEventId || eventLastDay(option) >= today)
      .sort((a, b) => eventFirstDay(a).localeCompare(eventFirstDay(b)) || a.name.localeCompare(b.name) || a.id - b.id),
    [eventOptions, sourceVenues, isCompanyAdmin, listedLocations, sourceEventId, today],
  );

  const previousChoices = useMemo(() => {
    const unique = new Map<number, RegistrationEventGroupSummary>();
    previousOptions.forEach((option) => unique.set(option.id, option));
    return Array.from(unique.values())
      .filter((option) => option.id !== group?.id)
      .filter((option) => !eventDate || option.event_date < eventDate || String(option.id) === previousGroupId)
      .sort((a, b) => b.event_date.localeCompare(a.event_date));
  }, [previousOptions, group, eventDate, previousGroupId]);

  const isNewLocation = (id: number) => !existingLocations.includes(id);

  const willMove = (id: number) => candidates.has(id) && isNewLocation(id) && locationIds.includes(id) && (moveChoice[id] ?? true);

  const linkFor = (locationId: number): RegistrationEventOption | null => {
    if (!creating && !isNewLocation(locationId)) return null;
    const chosen = prefillLinks[locationId];
    if (chosen) return eventOptions.find((option) => option.id === chosen) ?? null;
    if (!matchSource) return null;
    return matchingEventAt(matchSource, locationId, eventOptions, today);
  };

  const formDateFor = (locationId: number): string => {
    const link = linkFor(locationId);
    return link && link.id !== matchSource?.id ? eventLastDay(link) : eventDate;
  };

  const chooseSource = (id: number | null, options: RegistrationEventOption[] = eventOptions) => {
    setSourceEventId(id);
    setLinkError(null);
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
    setUseEventImage(source.has_image && !file && !copyHeaderFromGroup);
    if (isCompanyAdmin && !nextEditionMode) {
      const venues = new Set<number>(sidebarLocation !== null ? locationIds : []);
      if (listedLocations.has(source.location_id)) venues.add(source.location_id);
      if (sidebarLocation === null) {
        locations.forEach((location) => {
          const locationId = Number(location.id);
          const match = locationId === source.location_id ? null : matchingEventAt(source, locationId, options, today);
          if (match && match.is_active && match.registration_form_ids.length === 0 && eventLastDay(match) >= today) venues.add(locationId);
        });
      }
      setLocationIds(Array.from(venues));
      setErrors((current) => ({ ...current, location_ids: '', location_id: '' }));
    }
  };

  useEffect(() => {
    if (prefillApplied.current || !creating || !prefill?.eventId || eventOptions.length === 0) return;
    if (isCompanyAdmin && locations.length === 0) return;
    prefillApplied.current = true;
    const wanted = eventOptions.find((option) => option.id === prefill.eventId);
    if (wanted && (!isCompanyAdmin || listedLocations.has(wanted.location_id))) chooseSource(wanted.id, eventOptions);
  });

  const venueName = (id: number | null) => {
    if (id === null) return null;
    const known = locations.find((location) => Number(location.id) === id)?.name
      ?? group?.forms.find((form) => form.location_id === id)?.location_name
      ?? (id === ownLocationId ? currentUser?.location_name : null);
    return known ? locationDisplayName(known) : null;
  };

  const copiedImage = copyHeaderFromGroup && prefill?.headerImagePath ? getImageUrl(prefill.headerImagePath) : null;
  const eventImage = creating && useEventImage && sourceEvent?.image ? getImageUrl(sourceEvent.image) : null;
  const existingImage = editing && group?.header_image_path && !removeImage ? getImageUrl(group.header_image_path) : null;
  const shownImage = filePreview ?? existingImage ?? copiedImage ?? eventImage;

  const toggleLocation = (id: number) => {
    if (adding && !isNewLocation(id)) return;
    setLinkError((current) => (current?.locationId === id ? null : current));
    setLocationIds((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]));
    setErrors((current) => ({ ...current, location_ids: '', location_id: '' }));
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
    setCopyHeaderFromGroup(null);
    setUseEventImage(false);
  };

  const clearImage = () => {
    if (file) {
      setFile(null);
      return;
    }
    if (copiedImage) {
      setCopyHeaderFromGroup(null);
      return;
    }
    if (eventImage) {
      setUseEventImage(false);
      return;
    }
    setRemoveImage(true);
  };

  const linksFor = (ids: number[]): Record<number, number> => {
    const links: Record<number, number> = {};
    ids.forEach((id) => {
      const chosen = prefillLinks[id];
      const link = chosen ? null : linkFor(id);
      if (chosen) links[id] = chosen;
      else if (link) links[id] = link.id;
    });
    return links;
  };

  const updateWithConfirmation = async (input: RegistrationEventGroupInput): Promise<RegistrationEventGroupDetail | null> => {
    if (!group) return null;
    try {
      return await eventRegistrationService.updateGroup(group.id, input);
    } catch (error: unknown) {
      const body = isAxiosError<RemovalResponse>(error) ? error.response?.data : undefined;
      if (isAxiosError(error) && error.response?.status === 409 && body?.code === 'REMOVAL_NEEDS_CONFIRMATION') {
        if (!window.confirm(`${body.message ?? 'Some of these locations have registrations.'} Remove them anyway?`)) return null;
        return eventRegistrationService.updateGroup(group.id, { ...input, confirm_remove: true });
      }
      throw error;
    }
  };

  const addedLocations = locationIds.filter((id) => isNewLocation(id));
  const removedLocations = existingLocations.filter((id) => !locationIds.includes(id));
  const waitingForEvents = !creating && !optionsLoaded && addedLocations.length > 0 && Boolean(group?.forms.some((form) => form.event));
  const movingLocations = addedLocations.filter((id) => willMove(id));
  const newFormLocations = addedLocations.filter((id) => !willMove(id));
  const moveFormIds = movingLocations.flatMap((id) => {
    const candidate = candidates.get(id);
    return candidate ? [candidate.id] : [];
  });
  const movable = addedLocations.flatMap((id) => {
    const candidate = candidates.get(id);
    return candidate ? [candidate] : [];
  });

  const existingGroup = useMemo(() => {
    if (!creating || !sourceEvent || nextEditionMode) return null;
    const related = [
      sourceEvent,
      ...locations
        .map((location) => Number(location.id))
        .filter((id) => id !== sourceEvent.location_id)
        .map((id) => matchingEventAt(sourceEvent, id, eventOptions, today)),
    ];
    const found = new Map<number, RegistrationOptionGroup>();
    related.forEach((option) => option?.registration_groups?.forEach((candidate) => {
      if (!found.has(candidate.id)) found.set(candidate.id, candidate);
    }));
    if (found.size === 0) return null;
    const ticked = new Set(locationIds);
    const groups = Array.from(found.values());
    const reach = (candidate: RegistrationOptionGroup) => candidate.forms.filter((form) => !ticked.has(form.location_id)).length;
    const splitsOther = (candidate: RegistrationOptionGroup) => groups.some((other) => other.id !== candidate.id
      && other.forms.some((form) => ticked.has(form.location_id) && form.event_id === null && !candidate.forms.some((own) => own.location_id === form.location_id))
      && other.forms.some((form) => !ticked.has(form.location_id) || form.event_id !== null));
    const safe = new Set(groups.filter((candidate) => !splitsOther(candidate)).map((candidate) => candidate.id));
    return [...groups].sort((a, b) => Number(safe.has(b.id)) - Number(safe.has(a.id)) || reach(b) - reach(a) || b.forms.length - a.forms.length)[0];
  }, [creating, sourceEvent, nextEditionMode, locations, eventOptions, today, locationIds]);
  const groupFormAt = (id: number) => existingGroup?.forms.find((form) => form.location_id === id) ?? null;
  const joinVenues = existingGroup
    ? locationIds.filter((id) => {
      if (groupFormAt(id)) return false;
      const link = linkFor(id);
      return !link || link.registration_form_ids.length === 0;
    })
    : [];
  const unlinkedInGroup = existingGroup
    ? locationIds.flatMap((id) => {
      const form = groupFormAt(id);
      const link = linkFor(id);
      return form && form.event_id === null && link && link.registration_form_ids.length === 0
        ? [{ locationId: id, formId: form.id, eventId: link.id, formDate: form.event_date }]
        : [];
    })
    : [];

  const alreadyInGroup = existingGroup
    ? locationIds.flatMap((id) => {
      const form = groupFormAt(id);
      if (!form || unlinkedInGroup.some((item) => item.locationId === id)) return [];
      const link = linkFor(id);
      return link && link.registration_form_ids.length > 0 ? [] : [{ locationId: id, formId: form.id }];
    })
    : [];

  const linkExistingForm = async (item: { locationId: number; formId: number; eventId: number }) => {
    setLinking(true);
    setLinkError(null);
    try {
      await eventRegistrationService.updateEvent(item.formId, { event_id: item.eventId });
      navigate(`/registration-events/${item.formId}`);
    } catch (error: unknown) {
      setLinkError({ locationId: item.locationId, message: describeFailure(error, "That form couldn't be linked. Please try again.").message });
      setLinking(false);
    }
  };

  const joinExistingGroup = () => {
    if (!existingGroup) return;
    navigate(`/registration-events/event/${existingGroup.id}`, {
      state: { addLocations: { locationIds: joinVenues, eventLinks: linksFor(joinVenues) } },
    });
  };

  const save = async () => {
    const nextErrors: Record<string, string> = {};
    if (!adding && !name.trim()) nextErrors.name = 'Please give the event a name.';
    if (locationIds.length === 0) nextErrors.location_ids = 'Choose at least one location.';
    if (adding && addedLocations.length === 0) nextErrors.location_ids = 'Tick the locations to add.';
    if (!adding && !eventDate) nextErrors.event_date = 'Choose the event date.';
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setSaving(true);
    setErrors({});
    setFormError(null);
    try {
      if (creating) {
        const created = await eventRegistrationService.createGroup({
          name: name.trim(),
          event_date: eventDate,
          description,
          confirmation_message: confirmationMessage,
          location_ids: locationIds,
          event_id: sourceEvent ? sourceEvent.id : null,
          event_links: linksFor(locationIds),
          use_event_image: !file && !copiedImage && useEventImage,
          copy_header_image_from_group: !file && copiedImage ? copyHeaderFromGroup : null,
          previous_group_id: previousGroupId ? Number(previousGroupId) : null,
          is_open: isOpen,
          header_image: file,
        });
        onSaved(created);
        return;
      }

      if (!group) return;
      const input: RegistrationEventGroupInput = {};
      if (adding) {
        input.location_ids = [...existingLocations, ...addedLocations];
        input.expected_location_ids = existingLocations;
        input.event_links = linksFor(addedLocations);
        if (moveFormIds.length > 0) input.move_form_ids = moveFormIds;
      } else {
        const previousId = previousGroupId ? Number(previousGroupId) : null;
        if (name.trim() !== group.name) input.name = name.trim();
        if (eventDate !== group.event_date) input.event_date = eventDate;
        if (description !== (group.description ?? '')) input.description = description;
        if (confirmationMessage !== (group.confirmation_message ?? '')) input.confirmation_message = confirmationMessage;
        if (previousId !== (group.previous_group?.id ?? null)) input.previous_group_id = previousId;
        if (file) input.header_image = file;
        else if (removeImage) input.remove_header_image = true;
        if (addedLocations.length > 0 || removedLocations.length > 0) {
          input.location_ids = locationIds;
          input.expected_location_ids = existingLocations;
          input.event_links = linksFor(addedLocations);
          if (moveFormIds.length > 0) input.move_form_ids = moveFormIds;
        }
        if (openTouched && (mixedOpen || isOpen !== allOpen)) input.is_open = isOpen;
      }
      const updated = await updateWithConfirmation(input);
      if (updated) onSaved(updated);
    } catch (error: unknown) {
      const fields = fieldErrorsFrom(error);
      const locationsField = Object.keys(fields).find((key) => key.startsWith('location_ids'));
      if (locationsField) fields.location_ids = fields[locationsField];
      if (Object.keys(fields).length > 0) {
        setErrors(fields);
      } else {
        setFormError(describeFailure(error, 'The event could not be saved. Please try again.').message);
      }
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!group) return;
    const count = group.location_forms_total;
    const confirmed = window.confirm(
      `Delete "${group.name}"? Its ${count} location form${count === 1 ? '' : 's'}, QR code${count === 1 ? '' : 's'} and registration list${count === 1 ? '' : 's'} will be removed.`,
    );
    if (!confirmed) return;
    setDeleting(true);
    setFormError(null);
    try {
      await eventRegistrationService.deleteGroup(group.id, existingLocations);
      onDeleted?.();
    } catch (error: unknown) {
      setFormError(describeFailure(error, 'The event could not be deleted.').message);
      setDeleting(false);
    }
  };

  const error = (field: string) =>
    errors[field] ? <p className="mt-1 text-sm text-red-600">{errors[field]}</p> : null;

  const inputClass = (field: string) => (errors[field] ? theme.invalidInput : theme.input);

  const fixedVenue = venueName(locationIds[0] ?? null);
  const fixedLink = locationIds[0] !== undefined ? linkFor(locationIds[0]) : null;
  const showVenueChoices = isCompanyAdmin;
  const allSelected = locations.length > 0 && locations.every((location) => locationIds.includes(Number(location.id)));
  const existingForms = creating && sourceEvent
    ? (sourceVenues === null ? locations.map((location) => Number(location.id)) : locationIds).flatMap((id) => {
      const link = linkFor(id);
      return link && link.registration_form_ids.length > 0
        ? [{ locationId: id, formId: link.registration_form_ids[link.registration_form_ids.length - 1] }]
        : [];
    })
    : [];
  const otherDates = matchSource || Object.keys(prefillLinks).length > 0
    ? (creating ? locationIds : newFormLocations)
      .filter((id) => formDateFor(id) !== eventDate)
      .map((id) => `${venueName(id) ?? 'Another location'} ${formatDateLong(formDateFor(id))}`)
    : [];

  const title = creating ? (nextEditionMode ? "Next Year's Event" : 'New Event') : editing ? 'Edit Event' : 'Add Location Forms';
  const subtitle = creating
    ? 'Each location you pick gets its own form, QR code and registration list.'
    : editing
      ? 'Changes here apply to every location form in this event.'
      : `New forms copy "${group?.name ?? 'this event'}": its name, date, picture and messages.`;
  const saveLabel = creating
    ? locationIds.length > 1 ? `Create event · ${locationIds.length} locations` : 'Create event'
    : adding
      ? addedLocations.length > 1 ? `Add ${addedLocations.length} location forms` : 'Add location form'
      : 'Save changes';

  const venueLine = (id: number, checked: boolean) => {
    if (!creating && !isNewLocation(id)) {
      if (adding) return 'Already in this event';
      return checked ? 'In this event' : 'Will be removed';
    }
    if (!creating && candidates.has(id)) {
      if (!checked) return 'Has its own form · tick to move it in';
      if (willMove(id)) return 'Moves its existing form in';
    }
    if (!creating && !checked) return null;
    const link = linkFor(id);
    if (!matchSource) return creating ? null : 'New form';
    const prefix = creating ? 'Its event' : 'New form · its event';
    return link
      ? `${prefix}: ${formatEventDates(link)}${link.registration_form_ids.length > 0 ? ' · has a form' : ''}`
      : creating ? 'No matching event' : 'New form · no matching event';
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-backdrop-fade">
      <div
        className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto relative animate-scale-in"
        role="dialog"
        aria-modal="true"
        aria-labelledby="registration-group-modal-title"
      >
        <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`p-2 rounded-lg bg-${themeColor}-100 flex-shrink-0`}>
              <CalendarRange className={`w-5 h-5 text-${themeColor}-600`} aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h3 id="registration-group-modal-title" className="text-lg font-bold text-gray-900">{title}</h3>
              <p className="text-xs text-gray-500">{subtitle}</p>
            </div>
          </div>
          <StandardButton
            onClick={onClose}
            disabled={saving || deleting || linking}
            variant="ghost"
            size="sm"
            icon={X}
            title="Close"
            className="text-gray-400 hover:text-gray-600"
          />
        </div>

        <div className="px-6 py-5 space-y-5">
          {creating && (
            <div className={`rounded-lg p-4 space-y-2 ${theme.softPanel}`}>
              <label htmlFor="registration-group-source" className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                <CalendarCheck className={`h-4 w-4 ${theme.icon}`} aria-hidden="true" />
                Start from an event <span className="font-normal text-gray-500">(optional)</span>
              </label>
              <select
                id="registration-group-source"
                value={sourceEventId === null ? '' : String(sourceEventId)}
                onChange={(event) => chooseSource(event.target.value ? Number(event.target.value) : null)}
                className={inputClass('event_id')}
              >
                <option value="">No linked event</option>
                {sourceChoices.map((option) => (
                  <option key={option.id} value={String(option.id)}>
                    {option.name.trim()} — {formatEventDates(option)}
                    {isCompanyAdmin && (sourceVenues === null ? locations.length > 1 : sourceVenues.size > 1) && option.location_name ? ` · ${locationDisplayName(option.location_name)}` : ''}
                    {option.registration_form_ids.length > 0 ? ' · has a form' : ''}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-600">
                {sourceVenues === null
                  ? "Fills in the name, date, description and picture from Manage Events, ticks the other locations running the same event, and links each location's form to its own event."
                  : sidebarLocation !== null
                    ? 'Fills in the name, date, description and picture, and links the form to that event. Other locations running it show their date under Locations: tick them to add their own forms.'
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
              {existingGroup && (joinVenues.length > 0 || unlinkedInGroup.length > 0 || alreadyInGroup.length > 0) && (
                <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 space-y-2">
                  <p className="text-xs text-gray-700">
                    <span className="font-semibold text-gray-900">&ldquo;{existingGroup.name}&rdquo;</span> already has registration forms for this event.
                    {joinVenues.length > 0 && (existingGroup.can_manage
                      ? ` Add ${joinVenues.map((id) => venueName(id) ?? 'this location').join(', ')} to it so its numbers stay together.`
                      : ` Only a company admin can add ${joinVenues.map((id) => venueName(id) ?? 'this location').join(', ')} to it. Creating here makes a separate event.`)}
                  </p>
                  {existingGroup.can_manage && joinVenues.length > 0 && (
                    <StandardButton variant="primary" size="sm" onClick={joinExistingGroup} disabled={saving || linking}>
                      Add to &ldquo;{existingGroup.name}&rdquo;
                    </StandardButton>
                  )}
                  {unlinkedInGroup.map((item) => (
                    <div key={item.locationId} className="space-y-1">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-xs text-gray-700">
                        <span>
                          {venueName(item.locationId) ?? 'This location'} is already in it with a form for {formatDateLong(item.formDate)}, but its form isn&apos;t linked to this event.
                        </span>
                        <StandardButton
                          variant="secondary"
                          size="sm"
                          onClick={() => void linkExistingForm(item)}
                          disabled={saving || linking}
                          loading={linking}
                          className="self-start sm:self-auto whitespace-nowrap"
                        >
                          Link its form
                        </StandardButton>
                      </div>
                      {linkError?.locationId === item.locationId && (
                        <p className="text-xs text-red-600" role="alert">{linkError.message}</p>
                      )}
                    </div>
                  ))}
                  {alreadyInGroup.map((item) => (
                    <p key={item.locationId} className="text-xs text-gray-700">
                      {venueName(item.locationId) ?? 'This location'} is already in it.{' '}
                      <Link to={`/registration-events/${item.formId}`} className={theme.link}>
                        Open its form
                      </Link>
                    </p>
                  ))}
                </div>
              )}
              {error('event_id')}
            </div>
          )}

          {!adding && (
            <div>
              <label htmlFor="registration-group-name" className="block text-sm font-semibold text-gray-800 mb-1.5">
                Event name <span className="text-red-500">*</span>
              </label>
              <input
                id="registration-group-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={120}
                placeholder="e.g. Trunk or Treat 2026"
                className={inputClass('name')}
              />
              {error('name')}
            </div>
          )}

          <div>
            <span className="block text-sm font-semibold text-gray-800 mb-1.5">{showVenueChoices ? 'Locations' : 'Location'}</span>
            {showVenueChoices ? (
              <div className="space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {locations.map((location) => {
                    const id = Number(location.id);
                    const checked = locationIds.includes(id);
                    const locked = adding && !isNewLocation(id);
                    const line = venueLine(id, checked);
                    const removing = editing && !checked && !isNewLocation(id);
                    return (
                      <label
                        key={id}
                        className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${locked ? 'cursor-default opacity-70' : 'cursor-pointer'} ${checked ? `border-${themeColor}-300 bg-${themeColor}-50 text-gray-900` : 'border-gray-200 text-gray-700 hover:bg-gray-50'}`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={locked}
                          onChange={() => toggleLocation(id)}
                          className={`mt-0.5 h-4 w-4 ${theme.accent}`}
                        />
                        <span className="min-w-0">
                          <span className="block truncate">{locationDisplayName(location.name)}</span>
                          {line && (
                            <span className={`block text-xs truncate ${removing ? 'text-red-600' : 'text-gray-500'}`}>{line}</span>
                          )}
                        </span>
                      </label>
                    );
                  })}
                </div>
                {movable.length > 0 && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 space-y-3">
                    {movable.map((candidate) => {
                      const move = moveChoice[candidate.location_id] ?? true;
                      const place = venueName(candidate.location_id) ?? 'This location';
                      const entries = `${candidate.total_entries} registration${candidate.total_entries === 1 ? '' : 's'}`;
                      const source = candidate.group_name
                        ? `“${candidate.group_name}”${candidate.group_event_date ? ` (${formatDateLong(candidate.group_event_date)})` : ''}`
                        : null;
                      const movingTogether = candidate.group_id === null
                        ? 0
                        : movable.filter((item) => item.group_id === candidate.group_id && (moveChoice[item.location_id] ?? true)).length;
                      const staying = candidate.group_location_forms - movingTogether;
                      const sourceLine = source === null
                        ? null
                        : move
                          ? staying <= 0
                            ? `Its other event ${source} will be merged into this one.`
                            : `It's part of the other event ${source}; ${staying} of its ${candidate.group_location_forms} location forms will stay there.`
                          : `${place} will then have two forms: the existing one stays in the other event ${source}.`;
                      return (
                        <fieldset key={candidate.location_id} className="space-y-1.5">
                          <legend className="text-xs text-amber-900">
                            <span className="font-semibold">{place}</span> already has its own form for this event ({formatDateLong(candidate.event_date)}, {entries}).
                          </legend>
                          <div className="flex flex-col sm:flex-row sm:flex-wrap gap-x-4 gap-y-1 text-xs text-amber-900">
                            <label className="inline-flex items-center gap-1.5 cursor-pointer">
                              <input
                                type="radio"
                                name={`registration-move-${candidate.location_id}`}
                                checked={move}
                                onChange={() => setMoveChoice((current) => ({ ...current, [candidate.location_id]: true }))}
                                className={`h-3.5 w-3.5 ${theme.accent}`}
                              />
                              Move it into this event (keeps its QR code and registrations)
                            </label>
                            <label className="inline-flex items-center gap-1.5 cursor-pointer">
                              <input
                                type="radio"
                                name={`registration-move-${candidate.location_id}`}
                                checked={!move}
                                onChange={() => setMoveChoice((current) => ({ ...current, [candidate.location_id]: false }))}
                                className={`h-3.5 w-3.5 ${theme.accent}`}
                              />
                              Make a new form
                            </label>
                          </div>
                          {sourceLine && <p className="text-xs text-amber-800">{sourceLine}</p>}
                        </fieldset>
                      );
                    })}
                  </div>
                )}
                {error('move_form_ids')}
                {creating && locations.length > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      setLocationIds(allSelected ? [] : locations.map((location) => Number(location.id)));
                      setErrors((current) => ({ ...current, location_ids: '', location_id: '' }));
                    }}
                    className={`text-sm ${theme.link}`}
                  >
                    {allSelected ? 'Clear all' : 'Select all locations'}
                  </button>
                )}
                <p className="text-xs text-gray-500">
                  {creating
                    ? locationIds.length > 1
                      ? `${locationIds.length} location forms will be created, each with its own QR code and registration list.`
                      : 'Pick every location running this event. Each one gets its own form.'
                    : adding
                      ? movingLocations.length > 0
                        ? 'New locations get their own form, QR code and registration list. A moved form keeps its QR code and registrations.'
                        : 'Each location you tick gets its own form, QR code and registration list.'
                      : removedLocations.length > 0
                        ? "Unticked locations' forms, QR codes and lists will be removed when you save."
                        : 'Tick a location to add its form, or untick one to remove it.'}
                </p>
              </div>
            ) : (
              <div className={`flex items-start gap-2 rounded-lg border px-3 py-2 ${fixedVenue ? `border-${themeColor}-200 bg-${themeColor}-50` : 'border-amber-200 bg-amber-50'}`}>
                <MapPin className={`w-4 h-4 mt-0.5 shrink-0 ${fixedVenue ? `text-${fullColor}` : 'text-amber-700'}`} aria-hidden="true" />
                <div className="min-w-0">
                  <p className="text-sm text-neutral-700">
                    {creating ? 'Creating at ' : 'At '}
                    <span className="font-semibold text-neutral-900">{fixedVenue ?? 'no location assigned'}</span>
                  </p>
                  {creating && sourceEvent && (
                    <p className="text-xs text-gray-600">
                      {fixedLink ? `Linked to its event: ${formatEventDates(fixedLink)}` : "No matching event at this location, so the form won't be linked."}
                    </p>
                  )}
                </div>
              </div>
            )}
            {error('location_ids')}
            {error('location_id')}
            {error('event_links')}
          </div>

          {!adding && (
            <div>
              <label htmlFor="registration-group-date" className="block text-sm font-semibold text-gray-800 mb-1.5">
                Event date <span className="text-red-500">*</span>
              </label>
              <input
                id="registration-group-date"
                type="date"
                value={eventDate}
                onChange={(event) => setEventDate(event.target.value)}
                className={inputClass('event_date')}
              />
              <p className="mt-1 text-xs text-gray-500">
                {editing ? 'Applies to every location form. Registration closes automatically after this date.' : 'Registration closes automatically after this date.'}
              </p>
              {otherDates.length > 0 && (
                <p className="mt-1 text-xs text-gray-600">
                  Locations linked to their own event close after that event instead: {otherDates.join(' · ')}.
                </p>
              )}
              {error('event_date')}
            </div>
          )}

          {adding && otherDates.length > 0 && (
            <p className="text-xs text-gray-600">New forms linked to their own event close after that event: {otherDates.join(' · ')}.</p>
          )}

          {!adding && (
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
              {creating && sourceEvent?.has_image && !file && !copiedImage && (
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
          )}

          {!adding && (
            <div>
              <label htmlFor="registration-group-description" className="block text-sm font-semibold text-gray-800 mb-1.5">
                Description <span className="font-normal text-gray-500">(optional)</span>
              </label>
              <textarea
                id="registration-group-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={3}
                maxLength={2000}
                placeholder="Shown under the event name on every location's form"
                className={inputClass('description')}
              />
              {error('description')}
            </div>
          )}

          {!adding && (
            <div>
              <label htmlFor="registration-group-confirmation" className="block text-sm font-semibold text-gray-800 mb-1.5">
                Confirmation message <span className="font-normal text-gray-500">(optional)</span>
              </label>
              <textarea
                id="registration-group-confirmation"
                value={confirmationMessage}
                onChange={(event) => setConfirmationMessage(event.target.value)}
                rows={2}
                maxLength={500}
                placeholder="Shown after someone registers, e.g. See you at 6 pm!"
                className={inputClass('confirmation_message')}
              />
              {error('confirmation_message')}
            </div>
          )}

          {!adding && (
            <div>
              <label htmlFor="registration-group-previous" className="block text-sm font-semibold text-gray-800 mb-1.5">
                Last year&apos;s event <span className="font-normal text-gray-500">(optional)</span>
              </label>
              <select
                id="registration-group-previous"
                value={previousGroupId}
                onChange={(event) => setPreviousGroupId(event.target.value)}
                className={inputClass('previous_group_id')}
              >
                <option value="">None</option>
                {previousChoices.map((option) => (
                  <option key={option.id} value={String(option.id)}>
                    {option.name} — {formatDateLong(option.event_date)}
                  </option>
                ))}
                {previousGroupId && !previousChoices.some((option) => String(option.id) === previousGroupId) && (
                  <option value={previousGroupId}>{prefill?.previousGroupName ?? group?.previous_group?.name ?? "Last year's event"}</option>
                )}
              </select>
              <p className="mt-1 text-xs text-gray-500">
                Each location&apos;s form links to the same location&apos;s form in last year&apos;s event, so you can see who came back.
              </p>
              {error('previous_group_id')}
            </div>
          )}

          {(creating || editing) && (
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={isOpen}
                ref={(element) => {
                  if (element) element.indeterminate = mixedOpen && !openTouched;
                }}
                onChange={(event) => {
                  setIsOpen(event.target.checked);
                  setOpenTouched(true);
                }}
                className={`mt-0.5 h-4 w-4 ${theme.accent}`}
              />
              <span>
                <span className="block text-sm font-semibold text-gray-800">Accepting registrations</span>
                <span className="block text-xs text-gray-500">
                  {creating
                    ? 'Turn off to stop new sign-ups. Each form also closes automatically after its date.'
                    : mixedOpen && !openTouched
                      ? 'Open at some locations and closed at others. Tick to open every location form, or untick to close them all.'
                      : 'Applies to every location form. Each form also closes automatically after its date.'}
                </span>
              </span>
            </label>
          )}

          {formError && <p className="text-sm text-red-700" role="alert">{formError}</p>}
        </div>

        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 flex flex-wrap items-center justify-end gap-3">
          {editing && group?.can_manage && (
            <StandardButton
              variant="ghost"
              size="md"
              icon={Trash2}
              onClick={() => void remove()}
              disabled={saving || deleting || linking}
              loading={deleting}
              className="mr-auto text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              Delete event
            </StandardButton>
          )}
          <StandardButton variant="secondary" size="md" onClick={onClose} disabled={saving || deleting || linking}>
            Cancel
          </StandardButton>
          <StandardButton
            variant="primary"
            size="md"
            onClick={() => void save()}
            disabled={saving || deleting || waitingForEvents || linking}
            loading={saving || waitingForEvents}
          >
            {saveLabel}
          </StandardButton>
        </div>
      </div>
    </div>
  );
};

export default RegistrationEventGroupModal;
