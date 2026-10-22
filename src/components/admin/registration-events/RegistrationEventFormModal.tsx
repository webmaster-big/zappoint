import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardList, ImageIcon, Loader2, MapPin, Trash2, Upload, X } from 'lucide-react';
import StandardButton from '../../ui/StandardButton';
import eventRegistrationService from '../../../services/EventRegistrationService';
import type {
  RegistrationEventDetail,
  RegistrationEventInput,
  RegistrationEventOption,
} from '../../../types/eventRegistration.types';
import { useThemeColor } from '../../../hooks/useThemeColor';
import { getImageUrl } from '../../../utils/storage';
import { locationDisplayName } from '../../../utils/locationName';
import { describeFailure, fieldErrorsFrom, formatEventDates, themedClasses } from './registrationEventUi';

interface RegistrationEventFormModalProps {
  eventId: number;
  canRemove?: boolean;
  onClose: () => void;
  onSaved: (event: RegistrationEventDetail) => void;
  onRemoved?: (eventDeleted: boolean, groupId: number | null, groupName: string | null) => void;
}

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

const RegistrationEventFormModal = ({ eventId, canRemove = false, onClose, onSaved, onRemoved }: RegistrationEventFormModalProps) => {
  const { themeColor, fullColor } = useThemeColor();
  const theme = themedClasses(themeColor, fullColor);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [detail, setDetail] = useState<RegistrationEventDetail | null>(null);
  const [name, setName] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [description, setDescription] = useState('');
  const [confirmationMessage, setConfirmationMessage] = useState('');
  const [linkedEventId, setLinkedEventId] = useState('');
  const [isOpen, setIsOpen] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [eventOptions, setEventOptions] = useState<RegistrationEventOption[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    eventRegistrationService
      .getEvent(eventId)
      .then((event) => {
        if (cancelled) return;
        setDetail(event);
        setName(event.name);
        setEventDate(event.event_date);
        setDescription(event.description ?? '');
        setConfirmationMessage(event.confirmation_message ?? '');
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
    eventRegistrationService
      .eventOptions()
      .then((options) => {
        if (!cancelled) setEventOptions(options);
      })
      .catch(() => {
        if (!cancelled) setEventOptions([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

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
      if (event.key === 'Escape' && !saving && !removing) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, saving, removing]);

  const linkableEvents = useMemo(
    () => eventOptions
      .filter((option) => detail !== null && option.location_id === detail.location_id)
      .sort((a, b) => (b.start_date ?? '').localeCompare(a.start_date ?? '')),
    [eventOptions, detail],
  );

  const grouped = Boolean(detail?.group);
  const lastForm = grouped && (detail?.group_form_count ?? 1) <= 1;
  const venue = detail?.location_name ? locationDisplayName(detail.location_name) : null;
  const existingImage = detail?.header_image_path && !removeImage ? getImageUrl(detail.header_image_path) : null;
  const shownImage = filePreview ?? existingImage;

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
    if (!detail) return;
    const nextErrors: Record<string, string> = {};
    if (!grouped && !name.trim()) nextErrors.name = 'Please give the form a name.';
    if (!eventDate) nextErrors.event_date = 'Choose the event date.';
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setSaving(true);
    setErrors({});
    setFormError(null);
    try {
      const input: Partial<RegistrationEventInput> = {};
      const linkedId = linkedEventId ? Number(linkedEventId) : null;
      if (!grouped && name.trim() !== detail.name) input.name = name.trim();
      if (eventDate !== detail.event_date) input.event_date = eventDate;
      if (description !== (detail.description ?? '')) input.description = description;
      if (confirmationMessage !== (detail.confirmation_message ?? '')) input.confirmation_message = confirmationMessage;
      if (linkedId !== (detail.event?.id ?? null)) input.event_id = linkedId;
      if (isOpen !== detail.is_open) input.is_open = isOpen;
      if (file) input.header_image = file;
      else if (removeImage) input.remove_header_image = true;
      onSaved(await eventRegistrationService.updateEvent(detail.id, input));
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

  const remove = async () => {
    if (!detail) return;
    const eventName = detail.group?.name ?? detail.name;
    const confirmed = window.confirm(
      grouped && !lastForm
        ? `Remove ${venue ?? 'this location'} from "${eventName}"? Its QR code and link stop working and its registrations no longer count in other forms' history.`
        : `Delete "${eventName}"? Its form, QR code and registration list will be removed.`,
    );
    if (!confirmed) return;
    setRemoving(true);
    setFormError(null);
    try {
      const result = await eventRegistrationService.deleteEvent(detail.id);
      onRemoved?.(!grouped || result.group_deleted, result.group_id, detail.group?.name ?? detail.name);
    } catch (error: unknown) {
      setFormError(describeFailure(error, grouped && !lastForm ? 'The location could not be removed.' : 'The event could not be deleted.').message);
      setRemoving(false);
    }
  };

  const error = (field: string) =>
    errors[field] ? <p className="mt-1 text-sm text-red-600">{errors[field]}</p> : null;

  const inputClass = (field: string) => (errors[field] ? theme.invalidInput : theme.input);

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
              <h3 id="registration-form-modal-title" className="text-lg font-bold text-gray-900">Edit Form</h3>
              <p className="text-xs text-gray-500 truncate">
                {grouped ? `Changes apply to ${venue ?? 'this location'}'s form only.` : 'Changes apply to the form guests see right away.'}
              </p>
            </div>
          </div>
          <StandardButton
            onClick={onClose}
            disabled={saving || removing}
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
            <div className={`flex items-start gap-2 rounded-lg border px-3 py-2 border-${themeColor}-200 bg-${themeColor}-50`}>
              <MapPin className={`w-4 h-4 mt-0.5 shrink-0 text-${fullColor}`} aria-hidden="true" />
              <div className="min-w-0 space-y-0.5">
                <p className="text-sm text-neutral-700">
                  {grouped ? (
                    <>
                      <span className="font-semibold text-neutral-900">{venue ?? 'This location'}</span> · {detail?.group?.name}
                    </>
                  ) : (
                    <>
                      At <span className="font-semibold text-neutral-900">{venue ?? 'this location'}</span>
                    </>
                  )}
                </p>
                {grouped && detail?.group && (
                  <p className="text-xs text-gray-600">
                    The event&apos;s name and locations are changed on the event.{' '}
                    {detail.can_manage_event ? (
                      <Link to={`/registration-events/event/${detail.group.id}`} state={{ openEdit: true }} className={theme.link}>
                        Edit event
                      </Link>
                    ) : (
                      'Ask a company admin to change them.'
                    )}
                  </p>
                )}
              </div>
            </div>

            {!grouped && (
              <div>
                <label htmlFor="registration-form-name" className="block text-sm font-semibold text-gray-800 mb-1.5">
                  Event name <span className="text-red-500">*</span>
                </label>
                <input
                  id="registration-form-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  maxLength={120}
                  className={inputClass('name')}
                />
                {error('name')}
              </div>
            )}

            <div>
              <label htmlFor="registration-form-date" className="block text-sm font-semibold text-gray-800 mb-1.5">
                Event date at this location <span className="text-red-500">*</span>
              </label>
              <input
                id="registration-form-date"
                type="date"
                value={eventDate}
                onChange={(event) => setEventDate(event.target.value)}
                className={inputClass('event_date')}
              />
              <p className="mt-1 text-xs text-gray-500">Registration closes automatically after this date.</p>
              {error('event_date')}
            </div>

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
              <p className="mt-1 text-xs text-gray-500">PNG, JPEG or WebP up to 8 MB. Wide images work best, e.g. 1600 × 800.</p>
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

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={isOpen}
                onChange={(event) => setIsOpen(event.target.checked)}
                className={`mt-0.5 h-4 w-4 ${theme.accent}`}
              />
              <span>
                <span className="block text-sm font-semibold text-gray-800">Accepting registrations</span>
                <span className="block text-xs text-gray-500">Turn off to stop new sign-ups at this location. It also closes automatically after the event date.</span>
              </span>
            </label>

            {formError && <p className="text-sm text-red-700" role="alert">{formError}</p>}
          </div>
        )}

        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 flex flex-wrap items-center justify-end gap-3">
          {canRemove && detail && (
            <StandardButton
              variant="ghost"
              size="md"
              icon={Trash2}
              onClick={() => void remove()}
              disabled={saving || removing}
              loading={removing}
              className="mr-auto text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              {grouped && !lastForm ? 'Remove location' : lastForm ? 'Delete event' : 'Delete form'}
            </StandardButton>
          )}
          <StandardButton variant="secondary" size="md" onClick={onClose} disabled={saving || removing}>
            Cancel
          </StandardButton>
          <StandardButton
            variant="primary"
            size="md"
            onClick={() => void save()}
            disabled={saving || removing || loading || Boolean(loadError)}
            loading={saving}
          >
            Save changes
          </StandardButton>
        </div>
      </div>
    </div>
  );
};

export default RegistrationEventFormModal;
