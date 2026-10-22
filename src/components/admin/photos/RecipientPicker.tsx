import { useCallback, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Mail, MessageSquare, Search, X } from 'lucide-react';
import { useThemeColor } from '../../../hooks/useThemeColor';
import photoService from '../../../services/PhotoService';
import StandardButton from '../../ui/StandardButton';
import { parseLocalDate } from '../../../utils/timeFormat';
import { isRegistration, receivingCount, recipientKey } from '../../../utils/photoRecipients';
import type { PhotoPeopleSearchResult, PhotoRecipientMatch, PhotoRegistrationMatch } from '../../../types/photo.types';

const MIN_QUERY = 2;
const MAX_QUERY = 120;

const errorMessage = (e: unknown, fallback: string): string =>
  (e as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;

const formatDay = (day: string | null | undefined, options: Intl.DateTimeFormatOptions): string => {
  if (!day) return '';
  const date = parseLocalDate(day);
  return Number.isNaN(date.getTime()) ? day : date.toLocaleDateString('en-US', options);
};

const shortDate = (day: string | null | undefined): string => {
  if (!day) return '';
  const date = parseLocalDate(day);
  if (Number.isNaN(date.getTime())) return day;
  return date.toLocaleDateString(
    'en-US',
    date.getFullYear() === new Date().getFullYear()
      ? { month: 'short', day: 'numeric' }
      : { month: 'short', day: 'numeric', year: 'numeric' },
  );
};

const dayRange = (first: string | null, last: string | null): string => {
  const start = first || last;
  const end = last || first;
  if (!start || !end) return '';
  return start === end ? shortDate(start) : `${shortDate(start)} – ${shortDate(end)}`;
};

const joinNames = (names: string[]): string =>
  names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;

const sourceLabel = (row: PhotoRecipientMatch, photoDay: string): string => {
  if (isRegistration(row)) {
    const when = row.covers_photo_day ? photoDay : dayRange(row.first_day, row.event_date);
    return ['Event registration', row.event_name, when].filter(Boolean).join(' · ');
  }
  return row.signed_on ? `Waiver · signed ${shortDate(row.signed_on)}` : 'Waiver';
};

interface Section {
  key: string;
  title: string;
  rows: PhotoRecipientMatch[];
}

interface RecipientPickerProps {
  photoSessionId: number;
  locationId: number | null;
  variant: 'capture' | 'library';
  selected: PhotoRecipientMatch[];
  onSelectedChange: (next: PhotoRecipientMatch[]) => void;
  textRegistrants: boolean;
  onTextRegistrantsChange: (value: boolean) => void;
  onError: (message: string) => void;
  heading?: string;
}

const RecipientPicker = ({
  photoSessionId,
  locationId,
  variant,
  selected,
  onSelectedChange,
  textRegistrants,
  onTextRegistrantsChange,
  onError,
  heading,
}: RecipientPickerProps) => {
  const { themeColor } = useThemeColor();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PhotoPeopleSearchResult | null>(null);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const searchSeq = useRef(0);

  const term = query.trim();

  const runSearch = useCallback(async () => {
    if (term.length < MIN_QUERY) return;
    const seq = ++searchSeq.current;
    setSearching(true);
    setSearched(false);
    try {
      const found = await photoService.searchPeople(term, photoSessionId, locationId);
      if (seq !== searchSeq.current) return;
      setResults(found);
      setSearched(true);
    } catch (e) {
      if (seq === searchSeq.current) onError(errorMessage(e, 'The search failed.'));
    } finally {
      if (seq === searchSeq.current) setSearching(false);
    }
  }, [locationId, onError, photoSessionId, term]);

  const selectedKeys = useMemo(() => new Set(selected.map(recipientKey)), [selected]);

  const toggle = useCallback(
    (row: PhotoRecipientMatch) => {
      const key = recipientKey(row);
      const next = selectedKeys.has(key) ? selected.filter((item) => recipientKey(item) !== key) : [...selected, row];
      onSelectedChange(next);
      if (!next.some((item) => isRegistration(item) && item.can_text)) onTextRegistrantsChange(false);
    },
    [onSelectedChange, onTextRegistrantsChange, selected, selectedKeys],
  );

  const sections = useMemo<Section[]>(() => {
    if (!results) return [];
    const list: Section[] = [
      {
        key: 'photo-day',
        title: variant === 'capture' ? "Today's event registrations" : "Event registrations on the photo's day",
        rows: results.registrations.filter((row) => row.covers_photo_day),
      },
      { key: 'waivers', title: 'Waivers', rows: results.waivers },
      {
        key: 'other-days',
        title: 'Other event registrations',
        rows: results.registrations.filter((row) => !row.covers_photo_day),
      },
    ];
    return list.filter((section) => section.rows.length > 0);
  }, [results, variant]);

  const photoDay = variant === 'capture' ? 'Today' : 'Photo day';
  const matchCount = results ? results.waivers.length + results.registrations.length : 0;
  const receiving = receivingCount(selected, textRegistrants);
  const textable = selected.some((row) => isRegistration(row) && row.can_text);
  const textOnly = selected.filter(
    (row): row is PhotoRegistrationMatch => isRegistration(row) && row.contactable && !row.can_email && row.can_text,
  );
  const chipCls = 'inline-flex items-center gap-1 text-[11px] rounded-full px-2 py-0.5';

  const renderRow = (row: PhotoRecipientMatch) => {
    const key = recipientKey(row);
    const checked = selectedKeys.has(key);
    return (
      <li key={key}>
        <label
          className={`flex items-start gap-3 rounded-xl border p-3 ${
            row.contactable
              ? `cursor-pointer ${checked ? `border-${themeColor}-600 bg-${themeColor}-50` : 'border-gray-200 hover:bg-gray-50'}`
              : 'border-gray-200 bg-gray-50 cursor-not-allowed'
          }`}
        >
          <input
            type="checkbox"
            checked={checked}
            disabled={!row.contactable}
            onChange={() => toggle(row)}
            className={`mt-0.5 h-5 w-5 shrink-0 accent-${themeColor}-700`}
          />
          <span className="flex-1 min-w-0">
            <span className="block text-sm font-medium text-gray-900 break-words">{row.name}</span>
            <span className="block text-xs text-gray-500 break-words">
              {row.email_masked || 'no email'} · {row.phone_masked || 'no phone'}
            </span>
            <span className="mt-1.5 flex flex-wrap gap-1">
              <span
                className={`${chipCls} ${
                  isRegistration(row) ? `bg-${themeColor}-100 text-${themeColor}-800` : 'bg-sky-100 text-sky-800'
                }`}
              >
                {sourceLabel(row, photoDay)}
              </span>
              {row.unavailable_reason && (
                <span className={`${chipCls} bg-amber-100 text-amber-800`}>{row.unavailable_reason}</span>
              )}
              {row.has_email && (
                <span className={`${chipCls} bg-gray-100 text-gray-700`}>
                  <Mail className="w-3 h-3" /> email
                </span>
              )}
              {row.has_phone && (
                <span className={`${chipCls} bg-gray-100 text-gray-700`}>
                  <MessageSquare className="w-3 h-3" /> SMS
                </span>
              )}
              {row.photo_video_consent === false && (
                <span className={`${chipCls} bg-red-100 text-red-800`}>declined the photo release</span>
              )}
              {row.photo_video_consent === null && (
                <span className={`${chipCls} bg-gray-200 text-gray-700`}>photo release never asked</span>
              )}
            </span>
          </span>
        </label>
      </li>
    );
  };

  return (
    <div className="min-w-0">
      {heading && <h2 className="font-semibold text-gray-900 mb-3">{heading}</h2>}
      <div className="flex gap-2 mb-4">
        <label className="relative flex-1 min-w-0">
          <span className="sr-only">Search by name, phone or email</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void runSearch();
              }
            }}
            maxLength={MAX_QUERY}
            autoComplete="off"
            enterKeyHint="search"
            placeholder="Name, phone or email"
            className={`w-full border border-gray-200 rounded-lg pl-9 pr-3 py-2.5 text-base sm:text-sm focus:ring-2 focus:ring-${themeColor}-600`}
          />
        </label>
        <StandardButton
          onClick={() => void runSearch()}
          loading={searching}
          disabled={term.length < MIN_QUERY}
          className="shrink-0"
        >
          Search
        </StandardButton>
      </div>

      {searched && matchCount === 0 && (
        <p className="text-sm text-gray-500 py-4">
          No waivers or event registrations matched.
          {results?.reference_day &&
            ` Event registrations are listed for ${formatDay(results.reference_day, {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            })} (±1 day).`}
        </p>
      )}

      {sections.length > 0 && (
        <div className={`space-y-4 overflow-y-auto ${variant === 'library' ? 'max-h-72' : 'max-h-[28rem]'}`}>
          {sections.map((section) => (
            <section key={section.key}>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                {section.title} ({section.rows.length})
              </h3>
              <ul className="space-y-2">{section.rows.map(renderRow)}</ul>
            </section>
          ))}
        </div>
      )}

      {selected.length > 0 && (
        <div className="mt-4 border-t border-gray-100 pt-4">
          <p className="text-sm font-medium text-gray-900 mb-2">
            {selected.length} selected
            {receiving !== selected.length && (
              <span className="font-normal text-gray-600"> · {receiving} will receive the link</span>
            )}
          </p>
          <ul className="flex flex-wrap gap-2" aria-label="Selected people">
            {selected.map((row) => (
              <li
                key={recipientKey(row)}
                className="inline-flex max-w-full items-center rounded-full bg-gray-100 pl-3 text-sm text-gray-800"
              >
                <span className="min-w-0 truncate">{row.name}</span>
                <span className="ml-1.5 shrink-0 text-xs text-gray-500">
                  {isRegistration(row) ? 'registration' : 'waiver'}
                </span>
                <button
                  type="button"
                  onClick={() => toggle(row)}
                  aria-label={`Remove ${row.name}`}
                  className="ml-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-gray-500 hover:bg-gray-200 hover:text-gray-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>

          {textable && (
            <label className="mt-3 flex items-start gap-3 rounded-xl border border-gray-200 p-3 cursor-pointer">
              <input
                type="checkbox"
                checked={textRegistrants}
                onChange={(e) => onTextRegistrantsChange(e.target.checked)}
                className={`mt-0.5 h-5 w-5 shrink-0 accent-${themeColor}-700`}
              />
              <span className="text-sm text-gray-800">
                Also text the selected event registrations (only if the guest asked for a text)
              </span>
            </label>
          )}

          {!textRegistrants && textOnly.length > 0 && (
            <p className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              <AlertTriangle className="mt-0.5 w-4 h-4 shrink-0" />
              <span>
                {joinNames(textOnly.map((row) => row.name))} {textOnly.length === 1 ? 'is' : 'are'} only reachable by
                text. Tick &ldquo;Also text&hellip;&rdquo; to send.
              </span>
            </p>
          )}

          <p className="mt-3 text-xs text-gray-500">
            Waivers and registrations that share an email or mobile number are recorded individually but only sent once.
          </p>
        </div>
      )}
    </div>
  );
};

export default RecipientPicker;
