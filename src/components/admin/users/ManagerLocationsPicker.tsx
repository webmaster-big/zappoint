import { MapPin } from 'lucide-react';

interface ManagerLocationsPickerProps {
  locations: Array<{ id: number; name: string }>;
  homeLocationId: number | null;
  selectedIds: number[];
  onChange: (ids: number[]) => void;
  themeColor: string;
  disabled?: boolean;
  error?: string;
}

const ManagerLocationsPicker = ({
  locations,
  homeLocationId,
  selectedIds,
  onChange,
  themeColor,
  disabled = false,
  error,
}: ManagerLocationsPickerProps) => {
  const others = locations.filter((location) => location.id !== homeLocationId);

  const toggle = (id: number) =>
    onChange(selectedIds.includes(id) ? selectedIds.filter((selected) => selected !== id) : [...selectedIds, id]);

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">Other locations this manager can manage</label>
      <p className="text-xs text-gray-500 mb-2">
        They switch between their locations from the sidebar and work in one location at a time.
      </p>
      {others.length === 0 ? (
        <p className="text-xs text-gray-400">
          {homeLocationId ? 'There are no other locations to add.' : 'Choose a home location first.'}
        </p>
      ) : (
        <div className={`max-h-44 overflow-y-auto border ${error ? 'border-red-400' : 'border-gray-200'} rounded-lg divide-y divide-gray-100`}>
          {others.map((location) => (
            <label
              key={location.id}
              className={`flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 ${disabled ? 'cursor-not-allowed opacity-70' : 'cursor-pointer hover:bg-gray-50'}`}
            >
              <input
                type="checkbox"
                checked={selectedIds.includes(location.id)}
                onChange={() => toggle(location.id)}
                disabled={disabled}
                className={`rounded border-gray-300 text-${themeColor}-600 focus:ring-${themeColor}-500`}
              />
              <MapPin className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
              <span className="truncate">{location.name}</span>
            </label>
          ))}
        </div>
      )}
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
};

export default ManagerLocationsPicker;
