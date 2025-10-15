import { MapPin } from 'lucide-react';

interface LocationSelectorProps {
  selectedLocation: string;
  onLocationChange: (location: string) => void;
  locations: string[];
  className?: string;
}

const LocationSelector = ({ selectedLocation, onLocationChange, locations, className = '' }: LocationSelectorProps) => (
  <div className={`relative ${className}`}>
    <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-blue-800" size={18} />
    <select
      value={selectedLocation}
      onChange={e => onLocationChange(e.target.value)}
      className="pl-10 pr-6 py-2 rounded-none border border-blue-800 bg-white text-gray-900 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-800 focus:bg-blue-50 hover:bg-blue-50 transition-all shadow-none appearance-none"
      style={{ minWidth: 160 }}
    >
      <option value="All Locations">All Locations</option>
      {locations.map(location => (
        <option key={location} value={location}>{location}</option>
      ))}
    </select>
  </div>
);

export default LocationSelector;
