import { useEffect, useState } from 'react';
import { MapPin } from 'lucide-react';
import LogoUploadField from '../ui/LogoUploadField';
import { publishLocationLogo } from '../../hooks/useLocationLogo';
import locationService, { type Location } from '../../services/LocationService';
import { useThemeColor } from '../../hooks/useThemeColor';

const LocationLogosSection = () => {
  const { themeColor } = useThemeColor();
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    locationService
      .getLocations({ per_page: 100 })
      .then((res) => {
        if (cancelled) return;
        setLocations(Array.isArray(res?.data) ? res.data : []);
      })
      .catch(() => {
        if (!cancelled) setError('The locations could not be loaded.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const saveLogo = async (locationId: number, next: string | null) => {
    const res = await locationService.updateLocationLogo(locationId, next);
    if (!res.success || !res.data) {
      throw new Error(res.message || 'The logo could not be saved.');
    }
    const savedPath = res.data.logo_path ?? null;
    setLocations((prev) => prev.map((l) => (l.id === locationId ? { ...l, logo_path: savedPath } : l)));
    publishLocationLogo(locationId, savedPath);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 flex items-center">
          <MapPin size={20} className={`mr-2 text-${themeColor}-600`} />
          Location Logos
        </h2>
        <p className="text-sm text-gray-600 mt-1">
          Each location shows its own logo across the admin area and the customer storefront.
          A location with no logo of its own falls back to the company logo.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10">
          <div className={`animate-spin rounded-full h-8 w-8 border-b-2 border-${themeColor}-600`} />
        </div>
      ) : error ? (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
      ) : locations.length === 0 ? (
        <p className="text-sm text-gray-500">No locations yet.</p>
      ) : (
        <div className="space-y-6">
          {locations.map((loc) => (
            <div key={loc.id} className="border border-gray-200 rounded-lg p-4">
              <LogoUploadField
                label={loc.name}
                value={loc.logo_path ?? null}
                onUpload={(dataUri) => saveLogo(loc.id, dataUri)}
                onRemove={() => saveLogo(loc.id, null)}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default LocationLogosSection;
