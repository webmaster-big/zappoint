import type { RefObject } from 'react';
import { Camera } from 'lucide-react';
import { EVENT_PHOTO_SMS_LIMIT } from '../../../utils/emailTemplateOptions';

interface EventPhotoEmailSettingsProps {
  attachPhotos: boolean;
  onAttachPhotosChange: (value: boolean) => void;
  smsBody: string;
  onSmsBodyChange: (value: string) => void;
  smsRef: RefObject<HTMLTextAreaElement | null>;
  onSmsFocus: () => void;
  disabled?: boolean;
}

const EventPhotoEmailSettings = ({
  attachPhotos,
  onAttachPhotosChange,
  smsBody,
  onSmsBodyChange,
  smsRef,
  onSmsFocus,
  disabled = false,
}: EventPhotoEmailSettingsProps) => (
  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
    <h2 className="text-lg font-semibold text-gray-900 mb-1 flex items-center gap-2">
      <Camera className="w-5 h-5 text-gray-500" aria-hidden="true" />
      Event photo delivery
    </h2>
    <p className="text-sm text-gray-600 mb-2">
      While this template is active, people who registered for an event at its locations get it when staff send them their photos.
      Change the wording here once and every location it covers uses the new wording.
    </p>
    <p className="text-xs text-gray-500 mb-4">
      Each location can have one active event photo email. A template for chosen locations is used before one for every location, and a
      location without one sends the usual photo email.
    </p>

    <label className={`flex items-start gap-2 text-sm text-gray-800 mb-4 ${disabled ? 'opacity-70' : ''}`}>
      <input
        type="checkbox"
        checked={attachPhotos}
        onChange={(e) => onAttachPhotosChange(e.target.checked)}
        disabled={disabled}
        className="mt-0.5 h-4 w-4"
      />
      <span>Attach the photos to the email as well as the link</span>
    </label>

    <label htmlFor="event-photo-sms" className="block text-sm font-medium text-gray-700 mb-1">
      Text message <span className="font-normal text-gray-400">(optional)</span>
    </label>
    <textarea
      id="event-photo-sms"
      ref={smsRef}
      rows={3}
      maxLength={EVENT_PHOTO_SMS_LIMIT}
      value={smsBody}
      onChange={(e) => onSmsBodyChange(e.target.value)}
      onFocus={onSmsFocus}
      disabled={disabled}
      placeholder="Your photos from {{ event_name }} are ready: {{ photo_link }}"
      className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
    />
    <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between mt-1">
      <p className="text-xs text-gray-500">
        Only sent when staff tick &ldquo;Also text the selected event registrations&rdquo; while sending photos. Leave it empty to use the
        usual photo text.
      </p>
      <p className="text-xs text-gray-400 shrink-0">
        {smsBody.length}/{EVENT_PHOTO_SMS_LIMIT}
      </p>
    </div>
  </div>
);

export default EventPhotoEmailSettings;
