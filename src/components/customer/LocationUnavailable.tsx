import { Link } from 'react-router-dom';
import { MapPin, Phone } from 'lucide-react';
import { locationDisplayName } from '../../utils/locationName';

interface LocationUnavailableProps {
  name?: string | null;
  city?: string | null;
  phone?: string | null;
}

const LocationUnavailable = ({ name, city, phone }: LocationUnavailableProps) => {
  const venue = name ? locationDisplayName(name, city) : null;

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center px-6 py-16 text-center bg-gray-50">
      <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center mb-5">
        <MapPin className="w-6 h-6 text-blue-800" aria-hidden="true" />
      </div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">
        {venue ? `${venue} is not available for online booking` : 'This location is not available for online booking'}
      </h1>
      <div className="mb-6 max-w-md">
        <p className="text-gray-600">
          This location is not taking bookings on this site right now. Please choose another location.
        </p>
        {phone && (
          <p className="text-sm text-gray-500 mt-3">
            Already have a booking here?{' '}
            <a href={`tel:${phone}`} className="inline-flex items-center gap-1 font-semibold text-blue-800 hover:text-blue-900">
              <Phone className="w-3.5 h-3.5" aria-hidden="true" />
              Call {phone}
            </a>
          </p>
        )}
      </div>
      <Link
        to="/"
        className="px-6 py-2.5 bg-blue-800 text-white font-semibold rounded-xl hover:bg-blue-900 transition-colors"
      >
        See all locations
      </Link>
    </div>
  );
};

export default LocationUnavailable;
