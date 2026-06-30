import { X, Building2, Pencil, Phone, Mail } from 'lucide-react';
import { useThemeColor } from '../../../hooks/useThemeColor';
import type { Location } from '../../../services/LocationService';

interface LocationsListModalProps {
  isOpen: boolean;
  onClose: () => void;
  locations: Location[];
  onEditLocation: (location: Location) => void;
  loading?: boolean;
}

const LocationsListModal = ({ isOpen, onClose, locations, onEditLocation, loading = false }: LocationsListModalProps) => {
  const { themeColor } = useThemeColor();

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-backdrop-fade"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] flex flex-col animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg bg-${themeColor}-100`}>
              <Building2 className={`w-5 h-5 text-${themeColor}-600`} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">Locations</h3>
              <p className="text-xs text-gray-500">
                {locations.length} location{locations.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 divide-y divide-gray-50">
          {loading ? (
            <div className="flex items-center justify-center py-14">
              <div className={`animate-spin rounded-full h-8 w-8 border-b-2 border-${themeColor}-600`} />
            </div>
          ) : locations.length === 0 ? (
            <div className="px-6 py-10 text-center text-gray-500 text-sm">No locations found.</div>
          ) : (
            locations.map((loc) => (
              <div key={loc.id} className="flex items-start justify-between px-6 py-4 hover:bg-gray-50 gap-4">
                <div className="min-w-0">
                  <p className="font-medium text-gray-900">{loc.name}</p>
                  {(loc.address || loc.city) && (
                    <p className="text-xs text-gray-500 mt-0.5">
                      {[loc.address, loc.city, loc.state, loc.zip_code].filter(Boolean).join(', ')}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-4 mt-1">
                    {loc.phone && (
                      <span className="text-xs text-gray-400 flex items-center gap-1">
                        <Phone className="h-3 w-3 flex-shrink-0" />
                        {loc.phone}
                      </span>
                    )}
                    {loc.email && (
                      <span className="text-xs text-gray-400 flex items-center gap-1">
                        <Mail className="h-3 w-3 flex-shrink-0" />
                        {loc.email}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => onEditLocation(loc)}
                  className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Edit location"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Edit
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default LocationsListModal;