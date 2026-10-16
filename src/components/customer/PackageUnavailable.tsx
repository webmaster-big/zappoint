import { useEffect, useId, useRef } from 'react';
import { Link } from 'react-router-dom';
import { CalendarOff, Phone } from 'lucide-react';
import { locationDisplayName } from '../../utils/locationName';

interface PackageUnavailableProps {
  packageName?: string | null;
  venueName?: string | null;
  city?: string | null;
  phone?: string | null;
  locationSlug?: string | null;
  retired?: boolean;
  interrupted?: boolean;
  earlierAttempt?: boolean;
  staffHint?: boolean;
}

const PackageUnavailable = ({ packageName, venueName, city, phone, locationSlug, retired = false, interrupted = false, earlierAttempt = false, staffHint = false }: PackageUnavailableProps) => {
  const venue = venueName ? locationDisplayName(venueName, city) : null;
  const backLink = locationSlug ? `/${locationSlug}` : '/';
  const subject = packageName || 'This package';
  const headingRef = useRef<HTMLHeadingElement>(null);
  const interruptedId = useId();

  useEffect(() => {
    if (interrupted) {
      headingRef.current?.focus();
    }
  }, [interrupted]);

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center px-6 py-16 text-center bg-gray-50">
      <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center mb-5">
        <CalendarOff className="w-6 h-6 text-blue-800" aria-hidden="true" />
      </div>
      <h1 ref={headingRef} tabIndex={-1} aria-describedby={interrupted ? interruptedId : undefined} className="text-2xl font-bold text-gray-900 mb-2 focus:outline-none">
        {retired ? `${subject} is not available right now` : `${subject} can't be booked online`}
      </h1>
      <div className="mb-6 max-w-md">
        <p className="text-gray-600">
          {retired
            ? 'Please choose another package.'
            : venue ? `Please call ${venue} to book it.` : 'Please call the venue to book it.'}
        </p>
        {interrupted && (
          <p id={interruptedId} className="mt-3 text-sm font-medium text-gray-700">
            {earlierAttempt
              ? `Nothing new was booked. If an earlier try showed an error, please check your email${retired ? '' : ' before calling'}.`
              : 'Nothing was booked and you have not been charged.'}
          </p>
        )}
        {staffHint && (
          <p className="mt-3 text-sm text-gray-500">
            Staff: your login was not accepted for this venue, so this was handled as an online booking. Sign in to
            the admin again to book it there.
          </p>
        )}
        {phone && (
          <p className="mt-3 text-sm text-gray-500">
            {retired && 'Questions? '}
            <a href={`tel:${phone}`} className="inline-flex items-center gap-1 font-semibold text-blue-800 hover:text-blue-900">
              <Phone className="w-4 h-4" aria-hidden="true" />
              Call {phone}
            </a>
          </p>
        )}
      </div>
      <Link
        to={backLink}
        className="px-6 py-2.5 bg-blue-800 text-white font-semibold rounded-xl hover:bg-blue-900 transition-colors"
      >
        {locationSlug ? 'See what you can book online' : 'See all locations'}
      </Link>
    </div>
  );
};

export default PackageUnavailable;
