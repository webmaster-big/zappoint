import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { ImageIcon, Loader2, MapPin, Trash2, X } from 'lucide-react';
import StandardButton from '../../ui/StandardButton';
import LocationSelector from '../LocationSelector';
import eventRegistrationService from '../../../services/EventRegistrationService';
import type {
  RegistrationEventDetail,
  RegistrationEventInput,
  RegistrationEventSummary,
} from '../../../types/eventRegistration.types';
import { useLocationScope } from '../../../contexts/LocationContext';
import { useThemeColor } from '../../../hooks/useThemeColor';
import { getImageUrl, getStoredUser } from '../../../utils/storage';
import { formatDateLong } from '../../../utils/timeFormat';
import { locationDisplayName } from '../../../utils/locationName';
import { describeFailure, fieldErrorsFrom } from './registrationEventUi';

interface RegistrationEventFormModalProps {
  eventId: number | null;
  onClose: () => void;
  onSaved: (event: RegistrationEventDetail, created: boolean) => void;
}

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

const inputClass = (invalid: boolean) =>
  `w-full rounded-md border px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 ${
    invalid ? 'border-red-500' : 'border-gray-300'
  }`;

const RegistrationEventFormModal = ({ eventId, onClose, onSaved }: RegistrationEventFormModalProps) => {
  const { isCompanyAdmin, locations, effectiveLocationId } = useLocationScope();
  const { themeColor, fullColor } = useThemeColor();
  const currentUser = getStoredUser();
  const editing = eventId !== null;

  const [loading, setLoading] = useState(editing);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [detail, setDetail] = useState<RegistrationEventDetail | null>(null);
  const [name, setName] = useState('');
  const [locationId, setLocationId] = useState<string>(() => {
    if (editing) return '';
    if (!isCompanyAdmin) return currentUser?.location_id ? String(currentUser.location_id) : '';
    if (effectiveLocationId) return String(effectiveLocationId);
    return locations.length > 0 ? String(locations[0].id) : '';
  });
  const [eventDate, setEventDate] = useState('');
  const [description, setDescription] = useState('');
  const [confirmationMessage, setConfirmationMessage] = useState('');
  const [previousEditionId, setPreviousEditionId] = useState('');
  const [isOpen, setIsOpen] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [editions, setEditions] = useState<RegistrationEventSummary[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (eventId === null) return undefined;
    let cancelled = false;
    eventRegistrationService
      .getEvent(eventId)
      .then((event) => {
        if (cancelled) return;
        setDetail(event);
        setName(event.name);
        setLocationId(String(event.location_id));
        setEventDate(event.event_date);
        setDescription(event.description ?? '');
        setConfirmationMessage(event.confirmation_message ?? '');
        setPreviousEditionId(event.previous_edition ? String(event.previous_edition.id) : '');
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
    if (!locationId) {
      setEditions([]);
      return undefined;
    }
    let cancelled = false;
    eventRegistrationService
      .listEvents({ location_id: Number(locationId) })
      .then((events) => {
        if (!cancelled) setEditions(events);
      })
      .catch(() => {
        if (!cancelled) setEditions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [locationId]);

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

  const editionOptions = useMemo(
    () => editions
      .filter((event) => event.id !== eventId)
      .filter((event) => !eventDate || event.event_date < eventDate || String(event.id) === previousEditionId)
      .sort((a, b) => b.event_date.localeCompare(a.event_date)),
    [editions, eventId, eventDate, previousEditionId],
  );

  const locationLocked = Boolean(detail?.location_locked);
  const existingImage = detail?.header_image_path && !removeImage ? getImageUrl(detail.header_image_path) : null;
  const shownImage = filePreview ?? existingImage;
  const locationName = isCompanyAdmin
    ? locations.find((location) => String(location.id) === locationId)?.name ?? detail?.location_name ?? null
    : detail?.location_name ?? currentUser?.location_name ?? null;

  const changeLocation = (next: string) => {
    if (next === locationId) return;
    setLocationId(next);
    setPreviousEditionId('');
    setErrors((current) => ({ ...current, location_id: '', previous_edition_id: '' }));
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
  };

  const clearImage = () => {
    if (file) {
      setFile(null);
      return;
    }
    setRemoveImage(true);
  };

  const save = async () => {
    const nextErrors: Record<string, string> = {};
    if (!name.trim()) nextErrors.name = 'Please give the form a name.';
    if (!locationId) nextErrors.location_id = 'Choose a location for this form.';
    if (!eventDate) nextErrors.event_date = 'Choose the event date.';
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    const input: RegistrationEventInput = {
      name: name.trim(),
      location_id: Number(locationId),
      event_date: eventDate,
      description,
      confirmation_message: confirmationMessage,
      previous_edition_id: previousEditionId ? Number(previousEditionId) : null,
      is_open: isOpen,
      header_image: file,
      remove_header_image: !file && removeImage,
    };

    setSaving(true);
    setErrors({});
    setFormError(null);
    try {
      const saved = eventId === null
        ? await eventRegistrationService.createEvent(input)
        : await eventRegistrationService.updateEvent(eventId, input);
      onSaved(saved, eventId === null);
    } catch (error: unknown) {
      const fields = fieldErrorsFrom(error);
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

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4">
      <div
        className="bg-white w-full sm:max-w-2xl rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[92vh] overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="registration-form-modal-title"
      >
        <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between">
          <h2 id="registration-form-modal-title" className="text-lg font-bold text-gray-900">
            {editing ? 'Edit registration form' : 'New registration form'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Close"
            className="p-1.5 rounded-md text-gray-400 hover:bg-gray-100"
          >
            <X size={18} />
          </button>
        </div>

        {loading ? (
          <div className="p-10 flex items-center justify-center gap-2 text-sm text-gray-500" role="status">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Loading…
          </div>
        ) : loadError ? (
          <div className="p-6">
            <p className="text-sm text-red-700" role="alert">{loadError}</p>
          </div>
        ) : (
          <div className="p-5 space-y-5">
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
                className={inputClass(Boolean(errors.name))}
              />
              {error('name')}
            </div>

            <div>
              <span className="block text-sm font-semibold text-gray-800 mb-1.5">Location</span>
              {isCompanyAdmin && !locationLocked ? (
                <LocationSelector
                  locations={locations}
                  selectedLocation={locationId}
                  onLocationChange={changeLocation}
                  themeColor={themeColor}
                  fullColor={fullColor}
                  showAllOption={false}
                  variant="compact"
                />
              ) : (
                <div className="flex items-start gap-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
                  <MapPin className="w-4 h-4 mt-0.5 shrink-0 text-gray-500" aria-hidden="true" />
                  <p className="text-sm text-gray-700">
                    {editing ? 'At ' : 'Creating at '}
                    <span className="font-semibold text-gray-900">{locationName ? locationDisplayName(locationName) : 'no location assigned'}</span>
                  </p>
                </div>
              )}
              {locationLocked && isCompanyAdmin && (
                <p className="mt-1 text-xs text-gray-500">
                  The location is fixed once people have registered or another form links to this one.
                </p>
              )}
              {error('location_id')}
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
                className={inputClass(Boolean(errors.event_date))}
              />
              <p className="mt-1 text-xs text-gray-500">Registration closes automatically after this date.</p>
              {error('event_date')}
            </div>

            <div>
              <span className="block text-sm font-semibold text-gray-800 mb-1.5">Header image</span>
              {shownImage ? (
                <div className="relative overflow-hidden rounded-md border border-gray-200 bg-gray-900">
                  <img src={shownImage} alt="" className="block w-full max-h-56 object-contain" />
                  <button
                    type="button"
                    onClick={clearImage}
                    className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-md bg-white/90 px-2 py-1 text-xs font-medium text-gray-800 hover:bg-white"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    Remove
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed border-gray-300 px-4 py-6 text-sm text-gray-600 hover:border-gray-400"
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
              {shownImage && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-2 text-sm font-medium text-blue-700 hover:underline"
                >
                  Replace image
                </button>
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
                className={inputClass(Boolean(errors.description))}
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
                className={inputClass(Boolean(errors.confirmation_message))}
              />
              {error('confirmation_message')}
            </div>

            <div>
              <label htmlFor="registration-form-previous" className="block text-sm font-semibold text-gray-800 mb-1.5">
                Last year&apos;s edition <span className="font-normal text-gray-500">(optional)</span>
              </label>
              <select
                id="registration-form-previous"
                value={previousEditionId}
                onChange={(event) => setPreviousEditionId(event.target.value)}
                disabled={!locationId}
                className={inputClass(Boolean(errors.previous_edition_id))}
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
              {error('previous_edition_id')}
            </div>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={isOpen}
                onChange={(event) => setIsOpen(event.target.checked)}
                className="mt-0.5 h-4 w-4 accent-blue-600"
              />
              <span>
                <span className="block text-sm font-semibold text-gray-800">Accepting registrations</span>
                <span className="block text-xs text-gray-500">Turn off to stop new sign-ups. It also closes automatically after the event date.</span>
              </span>
            </label>

            {formError && <p className="text-sm text-red-700" role="alert">{formError}</p>}
          </div>
        )}

        <div className="sticky bottom-0 bg-white border-t border-gray-100 px-5 py-4 flex flex-col sm:flex-row gap-2">
          <StandardButton
            variant="primary"
            size="md"
            onClick={() => void save()}
            disabled={saving || loading || Boolean(loadError)}
            loading={saving}
            fullWidth
          >
            {editing ? 'Save changes' : 'Create form'}
          </StandardButton>
          <StandardButton variant="secondary" size="md" onClick={onClose} disabled={saving} fullWidth>
            Cancel
          </StandardButton>
        </div>
      </div>
    </div>
  );
};

export default RegistrationEventFormModal;
