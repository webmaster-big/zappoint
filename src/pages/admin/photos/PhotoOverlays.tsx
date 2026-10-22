import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Layers,
  MapPin,
  Plus,
  RefreshCcw,
  Trash2,
  X,
} from 'lucide-react';
import { useThemeColor } from '../../../hooks/useThemeColor';
import { useLocationScope } from '../../../contexts/LocationContext';
import photoService from '../../../services/PhotoService';
import escapeRoomService from '../../../services/EscapeRoomService';
import Toast from '../../../components/ui/Toast';
import StandardButton from '../../../components/ui/StandardButton';
import { getStoredUser } from '../../../utils/storage';
import { dateKey, parseLocalDate } from '../../../utils/timeFormat';
import { locationShortName } from '../../../utils/locationName';
import type {
  PhotoEventDay,
  PhotoOverlayCopies,
  PhotoOverlayRecord,
  PhotoOverlayResponse,
} from '../../../types/photo.types';
import type { EscapeRoomOption } from '../../../types/escapeRoom.types';

const errorMessage = (e: unknown, fallback: string): string =>
  (e as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;

const STATUS_STYLES: Record<PhotoOverlayRecord['status'], string> = {
  active: 'bg-green-100 text-green-800',
  scheduled: 'bg-blue-100 text-blue-800',
  expired: 'bg-gray-200 text-gray-700',
  disabled: 'bg-gray-100 text-gray-500',
};

const NO_EVENT_FRAMES = "This server can't save event frames yet. Nothing was saved.";
const FORM_NOT_LISTED = "That event's day has passed, or its form was removed.";

type ToastState = { message: string; type: 'success' | 'error' | 'info' } | null;

interface EventDaysState {
  locationId: number;
  available: boolean;
  forms: PhotoEventDay[];
  error: string | null;
}

interface FrameLink {
  formId: number;
  locationId: number | null;
  switched: boolean;
}

const shortDay = (day: string): string => {
  const date = parseLocalDate(day);
  return Number.isNaN(date.getTime())
    ? day
    : date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
};

const dayRange = (first: string | null | undefined, last: string | null | undefined): string => {
  const start = first || last;
  const end = last || first;
  if (!start || !end) return '';
  return start === end ? shortDay(start) : `${shortDay(start)} – ${shortDay(end)}`;
};

const dayAfter = (day: string): string => {
  const date = parseLocalDate(day);
  date.setDate(date.getDate() + 1);
  return dateKey(date);
};

const formatInstant = (value: string): string => new Date(value).toLocaleString();

const joinNames = (names: string[]): string =>
  names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;

const venueName = (name: string | null | undefined): string => (name ? locationShortName(name) : 'another location');

const reasonText = (reason: string | null | undefined): string => {
  const text = (reason ?? '').trim().replace(/\.$/, '');
  return text ? text.charAt(0).toLowerCase() + text.slice(1) : '';
};

const copiesSummary = (copies: PhotoOverlayCopies): string => {
  const parts: string[] = [];
  if (copies.created.length > 0) {
    parts.push(`Also added at ${joinNames(copies.created.map((copy) => venueName(copy.location_name)))}.`);
  }
  if (copies.skipped.length > 0) {
    const skipped = copies.skipped.map((skip) => {
      const why = reasonText(skip.reason);
      return why ? `${venueName(skip.location_name)} (${why})` : venueName(skip.location_name);
    });
    parts.push(`Not added at ${joinNames(skipped)}.`);
  }
  return parts.join(' ');
};

const eventOptionLabel = (form: PhotoEventDay): string =>
  `${form.name} · ${dayRange(form.first_day, form.event_date)}${form.has_frame ? ' (has a frame)' : ''}`;

const isEventFrame = (overlay: PhotoOverlayRecord): boolean =>
  overlay.event != null || overlay.registration_event_id != null;

const eventFrameIsOver = (overlay: PhotoOverlayRecord, now: number): boolean => {
  const event = overlay.event;
  if (!event) return false;
  if (event.location_form_removed) return true;
  const end = Date.parse(event.effective_end ?? event.window_end ?? '');
  if (!Number.isNaN(end)) return end <= now;
  return overlay.status === 'expired' && !event.never_runs;
};

const scheduleLine = (overlay: PhotoOverlayRecord): string | null => {
  const event = overlay.event;
  if (!event) {
    return `${overlay.starts_at ? `From ${formatInstant(overlay.starts_at)}` : 'No start date'} · ${
      overlay.ends_at ? `until ${formatInstant(overlay.ends_at)}` : 'no end date'
    }`;
  }
  if (event.effective_start || event.effective_end) {
    return `${event.effective_start ? `From ${formatInstant(event.effective_start)}` : 'No start'} · ${
      event.effective_end ? `until ${formatInstant(event.effective_end)}` : 'no end'
    }`;
  }
  if (event.never_runs && (overlay.starts_at || overlay.ends_at)) {
    return `Its own hours: ${overlay.starts_at ? `from ${formatInstant(overlay.starts_at)}` : 'no start'} · ${
      overlay.ends_at ? `until ${formatInstant(overlay.ends_at)}` : 'no end'
    }`;
  }
  return null;
};

const PhotoOverlays = () => {
  const { themeColor } = useThemeColor();
  const { effectiveLocationId, isCompanyAdmin, locations, setSelectedLocationId } = useLocationScope();
  const [searchParams, setSearchParams] = useSearchParams();

  const [data, setData] = useState<PhotoOverlayResponse | null>(null);
  const [loadedAt, setLoadedAt] = useState(() => Date.now());
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [priority, setPriority] = useState(0);
  const [appliesTo, setAppliesTo] = useState('');
  const [limitHours, setLimitHours] = useState(false);
  const [copyToSiblings, setCopyToSiblings] = useState(false);
  const [rooms, setRooms] = useState<EscapeRoomOption[]>([]);
  const [eventDays, setEventDays] = useState<EventDaysState | null>(null);
  const [showPast, setShowPast] = useState(false);
  const [linkVersion, setLinkVersion] = useState(0);
  const frameLink = useRef<FrameLink | null>(null);
  const linkRead = useRef(false);
  const eventDaysSeq = useRef(0);

  const canCopyFrames = useMemo(() => {
    const role = getStoredUser()?.role ?? '';
    return role === 'company_admin' || role === 'admin';
  }, []);

  const load = useCallback(async () => {
    if (!effectiveLocationId) return;
    setLoading(true);
    try {
      setData(await photoService.getOverlays(effectiveLocationId));
      setLoadedAt(Date.now());
    } catch (e) {
      setToast({ message: errorMessage(e, 'Could not load the overlays.'), type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [effectiveLocationId]);

  const loadEventDays = useCallback(async (locationId: number) => {
    const seq = ++eventDaysSeq.current;
    try {
      const result = await photoService.getEventDays(locationId);
      if (seq === eventDaysSeq.current) {
        setEventDays({ locationId, available: result.available, forms: result.forms, error: null });
      }
    } catch (e) {
      if (seq === eventDaysSeq.current) {
        setEventDays({
          locationId,
          available: false,
          forms: [],
          error: errorMessage(e, 'The event days could not be loaded.'),
        });
      }
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    setAppliesTo('');
    setLimitHours(false);
    setCopyToSiblings(false);
    setRooms([]);
    if (!effectiveLocationId) return;
    void escapeRoomService
      .getRooms(effectiveLocationId)
      .then((list) => {
        if (!cancelled) setRooms(Array.isArray(list) ? list : []);
      })
      .catch(() => {
        if (!cancelled) setRooms([]);
      });
    return () => {
      cancelled = true;
    };
  }, [effectiveLocationId]);

  useEffect(() => {
    setEventDays(null);
    if (!effectiveLocationId) {
      eventDaysSeq.current += 1;
      return;
    }
    void loadEventDays(effectiveLocationId);
  }, [effectiveLocationId, loadEventDays]);

  useEffect(() => {
    if (!searchParams.has('event') && !searchParams.has('location')) {
      linkRead.current = false;
      return;
    }
    if (linkRead.current) return;
    linkRead.current = true;
    const formId = Number(searchParams.get('event'));
    const linkLocation = Number(searchParams.get('location'));
    frameLink.current =
      Number.isInteger(formId) && formId > 0
        ? {
            formId,
            locationId: Number.isInteger(linkLocation) && linkLocation > 0 ? linkLocation : null,
            switched: false,
          }
        : null;
    setSearchParams({}, { replace: true });
    setLinkVersion((version) => version + 1);
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    const link = frameLink.current;
    if (!link) return;
    const target = link.locationId ?? effectiveLocationId;
    if (!target) {
      frameLink.current = null;
      return;
    }
    if (Number(effectiveLocationId) !== target) {
      if (!isCompanyAdmin) {
        frameLink.current = null;
        setToast({ message: 'That form is at another location.', type: 'info' });
        return;
      }
      if (!link.switched) {
        frameLink.current = { ...link, switched: true };
        const listed = locations.find((location) => Number(location.id) === target)?.name;
        setSelectedLocationId(target);
        setToast({
          message: `Switched to ${listed ? locationShortName(listed) : 'that location'} to add this frame`,
          type: 'info',
        });
      }
      return;
    }
    if (!eventDays || eventDays.locationId !== target) return;
    frameLink.current = null;
    if (eventDays.error) {
      setToast({ message: eventDays.error, type: 'error' });
      return;
    }
    if (!eventDays.available) {
      setToast({ message: 'Event registrations are not set up yet.', type: 'info' });
      return;
    }
    const form = eventDays.forms.find((item) => item.id === link.formId);
    if (!form) {
      setToast({ message: FORM_NOT_LISTED, type: 'info' });
      return;
    }
    setAppliesTo(`event:${form.id}`);
    setLimitHours(false);
    setCopyToSiblings(false);
    setShowForm(true);
  }, [effectiveLocationId, eventDays, isCompanyAdmin, linkVersion, locations, setSelectedLocationId]);

  const eventForms = useMemo(
    () => (eventDays && eventDays.locationId === Number(effectiveLocationId) ? eventDays.forms : []),
    [effectiveLocationId, eventDays],
  );

  const chosenEvent = useMemo(
    () => (appliesTo.startsWith('event:') ? eventForms.find((form) => `event:${form.id}` === appliesTo) ?? null : null),
    [appliesTo, eventForms],
  );

  const currentVenue = useMemo(() => {
    const listed = locations.find((location) => Number(location.id) === Number(effectiveLocationId))?.name;
    const own = isCompanyAdmin ? null : ((getStoredUser()?.location_name as string | undefined) || null);
    const venue = listed ?? own;
    return venue ? locationShortName(venue) : 'this location';
  }, [effectiveLocationId, isCompanyAdmin, locations]);

  const { currentOverlays, pastOverlays } = useMemo(() => {
    const all = data?.overlays ?? [];
    return {
      currentOverlays: all.filter((overlay) => !eventFrameIsOver(overlay, loadedAt)),
      pastOverlays: all.filter((overlay) => eventFrameIsOver(overlay, loadedAt)),
    };
  }, [data, loadedAt]);

  const chooseAppliesTo = useCallback(
    (value: string) => {
      setAppliesTo(value);
      setCopyToSiblings(false);
      setLimitHours(value.startsWith('event:') && Boolean(startsAt || endsAt));
    },
    [endsAt, startsAt],
  );

  const create = useCallback(async () => {
    if (!effectiveLocationId || !file || name.trim().length === 0) return;
    const eventId = appliesTo.startsWith('event:') ? Number(appliesTo.slice('event:'.length)) : null;
    const roomId = appliesTo.startsWith('room:') ? appliesTo.slice('room:'.length) : '';
    const withHours = eventId === null || limitHours;
    const copyFrame =
      eventId !== null &&
      copyToSiblings &&
      canCopyFrames &&
      Boolean(chosenEvent?.siblings.some((sibling) => sibling.usable));
    setBusy(true);
    try {
      const form = new FormData();
      form.append('location_id', String(effectiveLocationId));
      form.append('name', name.trim());
      form.append('image', file);
      if (withHours && startsAt) form.append('starts_at', startsAt);
      if (withHours && endsAt) form.append('ends_at', endsAt);
      form.append('priority', String(priority));
      if (roomId) form.append('package_id', roomId);
      if (eventId !== null) form.append('registration_event_id', String(eventId));
      if (copyFrame) form.append('also_other_locations', '1');
      const { overlay, copies } = await photoService.createOverlay(form);
      if (eventId !== null && Number(overlay?.registration_event_id ?? 0) !== eventId) {
        const removed = overlay?.id
          ? await photoService.deleteOverlay(overlay.id).then(
              () => true,
              () => false,
            )
          : false;
        setToast({
          message: removed
            ? NO_EVENT_FRAMES
            : `This server can't save event frames yet, and the everyday frame it saved instead could not be removed. Delete “${name.trim()}” below.`,
          type: 'error',
        });
        await load();
        return;
      }
      const summary = copiesSummary(copies);
      setToast({
        message: summary ? `Overlay uploaded. ${summary}` : 'Overlay uploaded.',
        type: copies.skipped.length > 0 ? 'info' : 'success',
      });
      setShowForm(false);
      setName('');
      setFile(null);
      setStartsAt('');
      setEndsAt('');
      setPriority(0);
      setAppliesTo('');
      setLimitHours(false);
      setCopyToSiblings(false);
      await load();
      if (eventId !== null) void loadEventDays(effectiveLocationId);
    } catch (e) {
      setToast({ message: errorMessage(e, 'That overlay could not be saved.'), type: 'error' });
    } finally {
      setBusy(false);
    }
  }, [
    appliesTo,
    canCopyFrames,
    chosenEvent,
    copyToSiblings,
    effectiveLocationId,
    endsAt,
    file,
    limitHours,
    load,
    loadEventDays,
    name,
    priority,
    startsAt,
  ]);

  const toggleEnabled = useCallback(
    async (overlay: PhotoOverlayRecord) => {
      setBusy(true);
      try {
        const form = new FormData();
        form.append('is_enabled', overlay.is_enabled ? '0' : '1');
        await photoService.updateOverlay(overlay.id, form);
        await load();
      } catch (e) {
        setToast({ message: errorMessage(e, 'That change could not be saved.'), type: 'error' });
      } finally {
        setBusy(false);
      }
    },
    [load],
  );

  const changeRoom = useCallback(
    async (overlay: PhotoOverlayRecord, roomId: string) => {
      setBusy(true);
      try {
        const form = new FormData();
        form.append('package_id', roomId);
        await photoService.updateOverlay(overlay.id, form);
        setToast({
          message: roomId ? 'Saved. This overlay is now used only for that room\'s group photos.' : 'Saved. This overlay is now used for all photos at this location.',
          type: 'success',
        });
        await load();
      } catch (e) {
        setToast({ message: errorMessage(e, 'That change could not be saved.'), type: 'error' });
      } finally {
        setBusy(false);
      }
    },
    [load],
  );

  const remove = useCallback(
    async (overlay: PhotoOverlayRecord) => {
      if (
        !window.confirm(
          `Delete “${overlay.name}”? Photos already taken keep this frame in the image, but the library will no longer show which frame they used.`,
        )
      ) {
        return;
      }
      setBusy(true);
      try {
        await photoService.deleteOverlay(overlay.id);
        setToast({
          message: 'Overlay deleted. New photos use the date layer only unless another overlay is active.',
          type: 'info',
        });
        await load();
        if (isEventFrame(overlay) && effectiveLocationId) void loadEventDays(effectiveLocationId);
      } catch (e) {
        setToast({ message: errorMessage(e, 'That overlay could not be deleted.'), type: 'error' });
      } finally {
        setBusy(false);
      }
    },
    [effectiveLocationId, load, loadEventDays],
  );

  if (!effectiveLocationId) {
    return (
      <div className="min-h-screen px-6 py-8">
        <div className="max-w-lg mx-auto text-center bg-white border border-gray-200 rounded-2xl p-8">
          <MapPin className="w-10 h-10 mx-auto text-gray-400 mb-3" />
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Choose a location first</h1>
          <p className="text-gray-600 text-sm">
            {isCompanyAdmin ? 'Overlays are stored per location.' : 'Your account is not assigned to a location yet.'}
          </p>
        </div>
      </div>
    );
  }

  const fieldCls = `w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-${themeColor}-600`;
  const roomActive = (data?.overlays ?? []).some((other) => other.package_id && other.is_active);
  const siblings = chosenEvent && canCopyFrames ? chosenEvent.siblings : [];
  const usableSiblings = siblings.filter((sibling) => sibling.usable);
  const skippedSiblings = siblings.filter((sibling) => !sibling.usable);
  const showHours = !chosenEvent || limitHours;

  const renderCard = (overlay: PhotoOverlayRecord) => {
    const event = overlay.event ?? null;
    const eventFrame = isEventFrame(overlay);
    const schedule = scheduleLine(overlay);
    return (
      <div key={overlay.id} className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <div className="bg-[repeating-conic-gradient(#f3f4f6_0%_25%,white_0%_50%)] bg-[length:16px_16px] aspect-video flex items-center justify-center">
          {overlay.image_url ? (
            <img src={overlay.image_url} alt={overlay.name} className="max-h-full max-w-full object-contain" />
          ) : (
            <span className="text-xs text-gray-400">No image</span>
          )}
        </div>

        <div className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-medium text-gray-900 break-words">{overlay.name}</p>
              <p className="text-xs text-gray-500 mt-0.5">Priority {overlay.priority}</p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className={`text-[11px] rounded-full px-2 py-0.5 ${STATUS_STYLES[overlay.status]}`}>
                {overlay.status}
              </span>
              {overlay.package_id ? (
                <span className="text-[11px] rounded-full bg-gray-100 text-gray-700 px-2 py-0.5">
                  Room: {overlay.room_name ?? 'escape room'}
                </span>
              ) : null}
              {overlay.is_active && (
                <span className="text-[11px] rounded-full bg-green-600 text-white px-2 py-0.5 text-right">
                  {eventFrame
                    ? 'used for new photos today'
                    : overlay.package_id
                      ? `used for ${overlay.room_name ?? 'this room'}'s group photos`
                      : roomActive
                        ? 'used for all other new photos'
                        : 'used for new photos'}
                </span>
              )}
            </div>
          </div>

          {schedule && <p className="text-xs text-gray-500 mt-2">{schedule}</p>}

          {eventFrame && (
            <p className="mt-2 flex items-start gap-1.5 text-xs text-gray-700">
              <CalendarDays className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400" aria-hidden="true" />
              <span className="min-w-0 break-words">
                Applies to: Event{event ? ` · ${event.name}` : ''}
                {event && dayRange(event.first_day, event.event_date)
                  ? ` · ${dayRange(event.first_day, event.event_date)}`
                  : ''}
              </span>
            </p>
          )}

          {event?.location_form_removed ? (
            <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              Event removed. This frame is no longer used; upload it again for the event&apos;s current form.
            </p>
          ) : event?.never_runs ? (
            <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              Its hours fall outside the event&apos;s day(s), so it is never used.
            </p>
          ) : null}

          {!eventFrame && (rooms.length > 0 || overlay.package_id) && (
            <div className="mt-3">
              <label htmlFor={`ov-room-${overlay.id}`} className="block text-xs text-gray-500 mb-1">
                Applies to
              </label>
              <select
                id={`ov-room-${overlay.id}`}
                value={overlay.package_id ? String(overlay.package_id) : ''}
                disabled={busy}
                onChange={(e) => void changeRoom(overlay, e.target.value)}
                className={`${fieldCls} disabled:opacity-60`}
              >
                <option value="">All photos at this location</option>
                {rooms.map((room) => (
                  <option key={room.id} value={String(room.id)}>
                    {room.name}
                  </option>
                ))}
                {overlay.package_id && !rooms.some((room) => room.id === overlay.package_id) && (
                  <option value={String(overlay.package_id)}>{overlay.room_name ?? 'Escape room'}</option>
                )}
              </select>
            </div>
          )}

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => void toggleEnabled(overlay)}
              disabled={busy}
              className="flex-1 text-xs border border-gray-200 rounded-lg py-2 hover:bg-gray-50 disabled:opacity-40"
            >
              {overlay.is_enabled ? 'Disable' : 'Enable'}
            </button>
            <button
              type="button"
              onClick={() => void remove(overlay)}
              disabled={busy}
              className="inline-flex items-center justify-center gap-1 text-xs border border-gray-200 rounded-lg px-3 py-2 hover:bg-red-50 text-red-700 disabled:opacity-40"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen px-4 sm:px-6 py-8">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="max-w-5xl mx-auto">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Layers className={`w-6 h-6 text-${themeColor}-700`} />
              Photo overlays
            </h1>
            <p className="text-sm text-gray-600 mt-1">{data?.date_layer_note}</p>
          </div>
          <div className="flex gap-2">
            <StandardButton variant="secondary" size="sm" icon={RefreshCcw} onClick={() => void load()} loading={loading}>
              Refresh
            </StandardButton>
            <StandardButton size="sm" icon={Plus} onClick={() => setShowForm(true)}>
              Upload overlay
            </StandardButton>
          </div>
        </div>

        {(data?.conflicts.length ?? 0) > 0 && (
          <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="flex items-center gap-2 font-medium text-amber-900">
              <AlertTriangle className="w-4 h-4" />
              Overlapping schedules
            </p>
            <ul className="mt-2 space-y-1 text-sm text-amber-900">
              {data?.conflicts.map((conflict, i) => (
                <li key={`${conflict.overlay_id}-${conflict.conflicts_with_id}-${i}`}>
                  &ldquo;{conflict.overlay_name}&rdquo; overlaps &ldquo;{conflict.conflicts_with_name}&rdquo; —{' '}
                  {conflict.winner_name ? (
                    <>&ldquo;{conflict.winner_name}&rdquo; is used for new photos.</>
                  ) : (
                    'the higher priority one is used for new photos.'
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {!loading && (data?.overlays.length ?? 0) === 0 && (
          <div className="bg-white border border-gray-200 rounded-2xl p-10 text-center">
            <Layers className="w-10 h-10 mx-auto text-gray-300 mb-3" />
            <p className="text-gray-900 font-medium mb-1">No overlays yet</p>
            <p className="text-sm text-gray-500">
              Photos still work — they get the capture date layer only until you upload an overlay.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{currentOverlays.map(renderCard)}</div>

        {pastOverlays.length > 0 && (
          <div className="mt-6">
            <button
              type="button"
              onClick={() => setShowPast((open) => !open)}
              aria-expanded={showPast}
              className="flex w-full items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 text-left text-sm font-medium text-gray-900 hover:bg-gray-50"
            >
              <span>Past events ({pastOverlays.length})</span>
              {showPast ? (
                <ChevronUp className="w-4 h-4 shrink-0 text-gray-500" />
              ) : (
                <ChevronDown className="w-4 h-4 shrink-0 text-gray-500" />
              )}
            </button>
            {showPast && <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">{pastOverlays.map(renderCard)}</div>}
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" role="dialog">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">Upload an overlay</h2>
              <button type="button" onClick={() => setShowForm(false)} aria-label="Close">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <p className="text-sm text-gray-600">
                Use a transparent PNG designed wide at 16:9, for example 1920 × 1080, so its edges line up with landscape
                group photos. A frame of another shape is scaled to cover the picture and its edges may be cut off. The
                capture date is drawn on top.
              </p>

              <div>
                <label htmlFor="ov-name" className="block text-sm text-gray-700 mb-1">
                  Name
                </label>
                <input id="ov-name" value={name} onChange={(e) => setName(e.target.value)} className={fieldCls} />
              </div>

              <div>
                <label htmlFor="ov-file" className="block text-sm text-gray-700 mb-1">
                  Overlay image
                </label>
                <input
                  id="ov-file"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  className="block w-full text-sm"
                />
              </div>

              <div>
                <label htmlFor="ov-room" className="block text-sm text-gray-700 mb-1">
                  Applies to
                </label>
                <select
                  id="ov-room"
                  value={appliesTo}
                  onChange={(e) => chooseAppliesTo(e.target.value)}
                  className={fieldCls}
                >
                  <option value="">All photos at this location</option>
                  {rooms.length > 0 && (
                    <optgroup label="Escape rooms">
                      {rooms.map((room) => (
                        <option key={room.id} value={`room:${room.id}`}>
                          {room.name}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {eventForms.length > 0 && (
                    <optgroup label="Event days">
                      {eventForms.map((form) => (
                        <option key={form.id} value={`event:${form.id}`}>
                          {eventOptionLabel(form)}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
                {chosenEvent ? (
                  <div className="mt-2 space-y-1.5 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-700">
                    <p>
                      Used for every photo at {currentVenue} from 6:00 AM{' '}
                      {shortDay(chosenEvent.first_day || chosenEvent.event_date)} to 6:00 AM{' '}
                      {shortDay(dayAfter(chosenEvent.event_date))}, except escape-room group photos. Photos already
                      taken keep their frame.
                    </p>
                    {chosenEvent.day_count > 3 && (
                      <p className="text-amber-800">
                        This event runs {chosenEvent.day_count} days, and the frame is used on every one of them.
                      </p>
                    )}
                    <p>Leave the date off the artwork. Each photo already gets its capture date on top.</p>
                  </div>
                ) : (
                  <p className="mt-1 text-xs text-gray-500">
                    A room overlay is used only for that escape room&apos;s group photos.
                    {eventForms.length > 0 && ' An event-day overlay is used only on that event’s day(s).'} The date
                    stamp is added on top as usual.
                  </p>
                )}
              </div>

              {siblings.length > 0 && (
                <div className="rounded-lg border border-gray-200 p-3 space-y-2">
                  <p className="text-xs font-medium text-gray-600">This event&apos;s other locations</p>
                  {usableSiblings.length > 0 && (
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={copyToSiblings}
                        onChange={(e) => setCopyToSiblings(e.target.checked)}
                        className={`mt-0.5 h-5 w-5 shrink-0 accent-${themeColor}-700`}
                      />
                      <span className="text-sm text-gray-800">
                        Also use it at {joinNames(usableSiblings.map((sibling) => venueName(sibling.location_name)))}
                        <span className="block text-xs text-gray-500 mt-0.5">
                          Each location gets its own copy, used on its own event day. Change or delete a copy from
                          that location&apos;s overlays.
                        </span>
                      </span>
                    </label>
                  )}
                  {skippedSiblings.length > 0 && (
                    <ul className="space-y-0.5 text-xs text-gray-400">
                      {skippedSiblings.map((sibling) => (
                        <li key={sibling.form_id}>
                          {venueName(sibling.location_name)}
                          {sibling.reason ? `: ${sibling.reason}` : ''}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {chosenEvent && (
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={limitHours}
                    onChange={(e) => setLimitHours(e.target.checked)}
                    className={`mt-0.5 h-5 w-5 shrink-0 accent-${themeColor}-700`}
                  />
                  <span className="text-sm text-gray-800">
                    Only during certain hours
                    <span className="block text-xs text-gray-500 mt-0.5">
                      Optional. The hours must fall inside the event&apos;s day(s).
                    </span>
                  </span>
                </label>
              )}

              {showHours && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="ov-start" className="block text-sm text-gray-700 mb-1">
                      Starts (optional)
                    </label>
                    <input
                      id="ov-start"
                      type="datetime-local"
                      value={startsAt}
                      onChange={(e) => setStartsAt(e.target.value)}
                      className={fieldCls}
                    />
                  </div>
                  <div>
                    <label htmlFor="ov-end" className="block text-sm text-gray-700 mb-1">
                      Ends (optional)
                    </label>
                    <input
                      id="ov-end"
                      type="datetime-local"
                      value={endsAt}
                      onChange={(e) => setEndsAt(e.target.value)}
                      className={fieldCls}
                    />
                  </div>
                </div>
              )}

              <div>
                <label htmlFor="ov-priority" className="block text-sm text-gray-700 mb-1">
                  Priority when schedules overlap
                </label>
                <input
                  id="ov-priority"
                  type="number"
                  min={0}
                  max={100}
                  value={priority}
                  onChange={(e) => setPriority(Number(e.target.value))}
                  className={fieldCls}
                />
              </div>

              <StandardButton
                fullWidth
                onClick={() => void create()}
                loading={busy}
                disabled={!file || name.trim().length === 0}
              >
                Save overlay
              </StandardButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PhotoOverlays;
