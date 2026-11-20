import { Package as PackageIcon } from 'lucide-react';
import CustomPackageBadge from '../CustomPackageBadge';
import {
  CUSTOM_PACKAGE_LABEL,
  ONE_TIME_ADD_ONS_LABEL,
  bookingCategoryOf,
  bookingDisplayName,
  customTermsOf,
  formatMoney,
  isCustomBooking,
  oneTimeAddOnsOf,
  priceFieldLabel,
  pricingTypeLabel,
  toCents,
  type CustomBookingSource,
} from '../../../utils/customBooking';

export interface CustomPackageDetailsProps {
  booking: CustomBookingSource & { participants?: number | string | null };
}

const customGuestsText = (booking: CustomPackageDetailsProps['booking']): string => {
  const count = Math.max(0, Math.floor(Number(booking.participants) || 0));
  const guests = `${count} ${count === 1 ? 'guest' : 'guests'}`;
  const terms = customTermsOf(booking);
  if (!terms || terms.maxGuests <= 0) return guests;
  return `${guests} (allowed ${terms.minGuests}–${terms.maxGuests})`;
};

export const CustomPackageSection = ({ booking }: CustomPackageDetailsProps) => {
  if (!isCustomBooking(booking)) return null;
  const terms = customTermsOf(booking);
  const rows: Array<[string, string]> = [
    ['Category', bookingCategoryOf(booking) || '—'],
    ['Guests', customGuestsText(booking)],
  ];
  if (terms) {
    rows.push(['Pricing', pricingTypeLabel(terms.pricingType)]);
    rows.push([priceFieldLabel(terms.pricingType), formatMoney(toCents(terms.price))]);
  }

  return (
    <div className="mb-6">
      <h4 className="text-sm font-semibold text-gray-700 uppercase mb-3">{CUSTOM_PACKAGE_LABEL}</h4>
      <div className="bg-gray-50 rounded-lg p-4">
        <div className="flex items-center min-w-0">
          <PackageIcon className="h-4 w-4 text-gray-400 mr-3 shrink-0" />
          <span className="font-medium text-gray-900 break-words min-w-0">
            {bookingDisplayName(booking, CUSTOM_PACKAGE_LABEL)}
          </span>
          <CustomPackageBadge className="ml-2 shrink-0" />
        </div>
        <div className="mt-3 ml-7 space-y-1.5">
          {rows.map(([label, value]) => (
            <div key={label} className="flex justify-between items-start gap-4">
              <span className="text-sm text-gray-600">{label}</span>
              <span className="text-sm font-medium text-gray-900 text-right">{value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export const OneTimeAddOnsSection = ({ booking }: CustomPackageDetailsProps) => {
  const lines = oneTimeAddOnsOf(booking);
  if (lines.length === 0) return null;

  return (
    <div className="mb-6">
      <h4 className="text-sm font-semibold text-gray-700 uppercase mb-3">{ONE_TIME_ADD_ONS_LABEL}</h4>
      <div className="bg-gray-50 rounded-lg p-4 space-y-2">
        {lines.map((line, index) => (
          <div key={index} className="flex items-center justify-between py-2 border-b border-gray-200 last:border-0">
            <span className="text-sm font-medium text-gray-900 break-words min-w-0">{line.name}</span>
            <div className="flex items-center gap-4 ml-4 shrink-0">
              <span className="text-sm text-gray-600">
                {line.quantity} × {formatMoney(toCents(line.unitPrice))}
              </span>
              <span className="text-sm font-medium text-gray-900">{formatMoney(toCents(line.total))}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
