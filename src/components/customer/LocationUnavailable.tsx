import { Link } from 'react-router-dom';
import { MapPin } from 'lucide-react';
import { splitLocationName } from '../../utils/locationName';

interface LocationUnavailableProps {
  name?: string | null;
  city?: string | null;
}

const LocationUnavailable = ({ name, city }: LocationUnavailableProps) => {
  const parts = name ? splitLocationName(name, city ?? null) : null;
  const venue = parts ? (parts.secondary ? `${parts.primary} (${parts.secondary})` : parts.primary) : null;

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center px-6 py-16 text-center bg-gray-50">
      <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center mb-5">
        <MapPin className="w-6 h-6 text-blue-800" aria-hidden="true" />
      </div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">
        {venue ? `${venue} is not available for online booking` : 'This location is not available for online booking'}
      </h1>
      <p className="text-gray-600 mb-6 max-w-md">
        This location is not taking bookings on this site right now. Please choose another location.
      </p>
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
