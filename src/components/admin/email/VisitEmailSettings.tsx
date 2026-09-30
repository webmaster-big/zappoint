import { Link } from 'react-router-dom';
import { AlertTriangle, Gift, Info, SlidersHorizontal, Star } from 'lucide-react';
import PromoCodePicker from './PromoCodePicker';
import ReviewLinksPanel from './ReviewLinksPanel';
import type { EmailPromoSummary, VisitActivityFilter, VisitEmailOverride } from '../../../types/EmailNotification.types';

interface VisitEmailSettingsProps {
  triggerType: string;
  promoId: number | null;
  onPromoChange: (promoId: number | null) => void;
  locationId: number | null;
  locations: Array<{ id: number; name: string }>;
  promoSummary?: EmailPromoSummary | null;
  disabled?: boolean;
  fromName?: string | null;
  onFromNameChange?: (value: string) => void;
  reviewUrl?: string | null;
  onReviewUrlChange?: (value: string) => void;
  activityFilter?: VisitActivityFilter | null;
  onActivityFilterChange?: (value: VisitActivityFilter | null) => void;
  canFilterActivity?: boolean;
  overrides?: VisitEmailOverride[];
}

const VisitEmailSettings = ({
  triggerType,
  promoId,
  onPromoChange,
  locationId,
  locations,
  promoSummary = null,
  disabled = false,
  fromName = '',
  onFromNameChange,
  reviewUrl = '',
  onReviewUrlChange,
  activityFilter = null,
  onActivityFilterChange,
  canFilterActivity = false,
  overrides = [],
}: VisitEmailSettingsProps) => {
  const isThanks = triggerType === 'visit_completed';
  const replacedEverywhere = overrides.find((override) => override.covers_everything);

  return (
    <>
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-3">
        <div className="flex items-center gap-2">
          <Info className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-semibold text-gray-900">How this email is sent</h2>
        </div>
        {isThanks ? (
          <>
            <p className="text-sm text-gray-700">
              Goes to each guest as soon as staff mark the visit complete: Complete &amp; Send on the escape-room game screen (with the group
              photo and finish time), Result only when staff choose to email the players, or setting a party booking or an event purchase to
              Completed. It is never sent from checkout, check-in or imports, and each guest gets it once per visit.
            </p>
            <p className="text-sm text-gray-700">
              Visits more than 3 days old, or still in the future, are marked Completed without an email. Staff can still send it with Send
              now on the booking or purchase.
            </p>
            <p className="text-xs text-gray-500">
              Party bookings include the group photo only when staff sent that party&apos;s photo from the photo library to the party&apos;s
              waivers. Event purchases never include a photo.
            </p>
          </>
        ) : (
          <p className="text-sm text-gray-700">
            Goes out automatically the number of hours set above after staff mark the visit complete, to the same guests. An email that
            would land between 8 PM and 9 AM waits until 9 AM. Each guest is asked at most once every 30 days and can unsubscribe, and a
            rating of 2 stars or fewer alerts the location in Notifications.
          </p>
        )}
        <p className="text-sm text-gray-700">
          <span className="font-medium">Recipients:</span> the guests of the visit. That is the booker for parties and events, and every
          player with an email address on their waiver for escape-room games. Guests who unsubscribed, withdrew marketing consent on their
          waiver or are marked inactive in Contacts get no review requests and no offers.
        </p>
        <p className="text-xs text-gray-500">
          When more than one active email of this kind fits a visit, only the most specific one is sent: an email aimed at particular
          packages or events first, then one limited to escape rooms (or to everything except escape rooms), then one for all packages or
          all events, then one for every visit. A location&apos;s own email beats a company-wide one at the same level, and a copy beats the
          default when they are equal. Duplicate the default to give one brand, location or activity its own version.
        </p>
      </div>

      {overrides.length > 0 && (
        <div className="bg-amber-50 rounded-xl border border-amber-200 p-5 space-y-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-700" />
            <h2 className="text-base font-semibold text-amber-900">
              {replacedEverywhere ? 'This email is never sent' : 'Other emails are sent instead for some visits'}
            </h2>
          </div>
          {replacedEverywhere && (
            <p className="text-sm text-amber-900">
              &ldquo;{replacedEverywhere.name}&rdquo; is active and covers every visit this one does, so guests get that one. Switch one of
              them off, or narrow one of them to a location or activity.
            </p>
          )}
          <ul className="text-sm text-amber-900 list-disc pl-5 space-y-0.5">
            {overrides.map((override) => (
              <li key={override.id}>
                <Link to={`/admin/email/notifications/${override.id}`} className="underline">
                  {override.name}
                </Link>
                {override.location_name ? ` · ${override.location_name}` : ' · every location'}
                {isThanks ? ` · ${override.promo_code ? `code ${override.promo_code}` : 'no promo code'}` : ''}
              </li>
            ))}
          </ul>
          {isThanks && (
            <p className="text-xs text-amber-800">Changing the promo code here does not change the code in these emails.</p>
          )}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-5 h-5 text-gray-600" />
          <h2 className="text-lg font-semibold text-gray-900">Sender and activity</h2>
        </div>
        <div>
          <label htmlFor="visit-from-name" className="block text-sm font-medium text-gray-700 mb-1">
            Sender name
          </label>
          <input
            id="visit-from-name"
            type="text"
            maxLength={120}
            value={fromName ?? ''}
            disabled={disabled || !onFromNameChange}
            onChange={(event) => onFromNameChange?.(event.target.value)}
            placeholder="Your company name"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm disabled:bg-gray-100"
          />
          <p className="text-xs text-gray-500 mt-1">
            The name guests see in their inbox, for example Escape Room Zone. Leave it blank to use the company name.
          </p>
        </div>
        {canFilterActivity && (
          <div>
            <label htmlFor="visit-activity" className="block text-sm font-medium text-gray-700 mb-1">
              Activity
            </label>
            <select
              id="visit-activity"
              value={activityFilter ?? ''}
              disabled={disabled || !onActivityFilterChange}
              onChange={(event) => onActivityFilterChange?.((event.target.value || null) as VisitActivityFilter | null)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white disabled:bg-gray-100"
            >
              <option value="">Every activity</option>
              <option value="escape_room">Escape rooms only</option>
              <option value="not_escape_room">Everything except escape rooms</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Escape rooms only covers every package flagged as an escape room, including rooms added later, so the email never needs its
              package list updated.
            </p>
          </div>
        )}
        {!isThanks && (
          <div>
            <label htmlFor="visit-review-url" className="block text-sm font-medium text-gray-700 mb-1">
              Public review link for this email
            </label>
            <input
              id="visit-review-url"
              type="url"
              maxLength={500}
              value={reviewUrl ?? ''}
              disabled={disabled || !onReviewUrlChange}
              onChange={(event) => onReviewUrlChange?.(event.target.value)}
              placeholder="https://g.page/r/..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm disabled:bg-gray-100"
            />
            <p className="text-xs text-gray-500 mt-1">
              Optional. Use it when this email is for a brand with its own listing. Leave it blank to use each location&apos;s review link.
            </p>
          </div>
        )}
      </div>

      {isThanks ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Gift className="w-5 h-5 text-amber-600" />
            <h2 className="text-lg font-semibold text-gray-900">Return-visit offer</h2>
          </div>
          <PromoCodePicker
            value={promoId}
            onChange={onPromoChange}
            locationId={locationId}
            locations={locations}
            summary={promoSummary}
            disabled={disabled}
          />
          <p className="text-xs text-gray-500 mt-3">
            The offer appears where <span className="font-mono">{'{{promo_section}}'}</span> sits in the email, and is added above the
            sign-off if the wording leaves it out. A paragraph that uses <span className="font-mono">{'{{promo_code}}'}</span> or{' '}
            <span className="font-mono">{'{{promo_offer}}'}</span> is left out when there is no usable code. An email with a code also gets an
            unsubscribe link and the location&apos;s address.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Star className="w-5 h-5 text-amber-500" />
            <h2 className="text-lg font-semibold text-gray-900">Ratings and review links</h2>
          </div>
          <ReviewLinksPanel />
        </div>
      )}
    </>
  );
};

export default VisitEmailSettings;
