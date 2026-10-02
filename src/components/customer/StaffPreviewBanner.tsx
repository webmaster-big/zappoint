import { EyeOff } from 'lucide-react';
import { locationDisplayName } from '../../utils/locationName';

interface StaffPreviewBannerProps {
  name?: string | null;
  city?: string | null;
}

const StaffPreviewBanner = ({ name, city }: StaffPreviewBannerProps) => (
  <div role="status" className="w-full bg-amber-50 border-b border-amber-200 text-amber-900">
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex items-start gap-2 text-sm">
      <EyeOff className="w-4 h-4 mt-0.5 flex-shrink-0" aria-hidden="true" />
      <p>
        <span className="font-semibold">Staff preview.</span>{' '}
        {name ? locationDisplayName(name, city) : 'This location'} is turned off on the booking site, so guests see a
        "not available" page here and cannot book. You can see it because you are logged in as staff.
      </p>
    </div>
  </div>
);

export default StaffPreviewBanner;
