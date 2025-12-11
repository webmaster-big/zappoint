import React, { useState, useRef, useEffect } from 'react';
import { MapPin, ChevronDown, Check, Building2, MapPinned } from 'lucide-react';

export interface Location {
  id: string | number;
  name: string;
  address?: string;
  city?: string;
  state?: string;
}

interface LocationSelectorProps {
  locations: Location[];
  selectedLocation: string;
  onLocationChange: (locationId: string) => void;
  themeColor?: string;
  fullColor?: string;
  showAllOption?: boolean;
  className?: string;
  variant?: 'default' | 'compact';
  layout?: 'grid' | 'scroll' | 'auto';
  maxWidth?: string | number;
}

const LocationSelector: React.FC<LocationSelectorProps> = ({
  locations,
  selectedLocation,
  onLocationChange,
  themeColor = 'blue',
  fullColor = 'blue-600',
  showAllOption = true,
  className = '',
  variant = 'default',
  layout = 'auto',
  maxWidth,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedLocationData = locations.find(loc => loc.id.toString() === selectedLocation);
  const displayText = selectedLocation === '' || selectedLocation === 'all' 
    ? 'All Locations' 
    : selectedLocationData?.name || 'Select Location';

  const handleLocationSelect = (locationId: string) => {
    onLocationChange(locationId);
    setIsOpen(false);
  };

  if (variant === 'compact') {
    return (
      <div className={`relative ${className}`} ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg hover:border-${themeColor}-400 focus:outline-none focus:ring-2 focus:ring-${themeColor}-400 transition-all whitespace-nowrap`}
        >
          <MapPin className={`h-4 w-4 text-${fullColor}`} />
          <span className="text-sm font-medium text-gray-900">{displayText}</span>
          <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {isOpen && (
          <div className="absolute right-0 z-50 mt-2 w-72 bg-white rounded-lg shadow-xl border border-gray-200 max-h-96 overflow-y-auto">
            {showAllOption && (
              <button
                type="button"
                onClick={() => handleLocationSelect('')}
                className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-${themeColor}-50 transition-colors text-left ${
                  selectedLocation === '' ? `bg-${themeColor}-50` : ''
                }`}
              >
                <div className={`flex-shrink-0 w-8 h-8 rounded-full bg-${themeColor}-100 flex items-center justify-center`}>
                  <Building2 className={`h-4 w-4 text-${fullColor}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">All Locations</p>
                  <p className="text-xs text-gray-500">View all locations</p>
                </div>
                {selectedLocation === '' && (
                  <Check className={`h-4 w-4 text-${fullColor} flex-shrink-0`} />
                )}
              </button>
            )}
            
            {locations.map((location) => (
              <button
                key={location.id}
                type="button"
                onClick={() => handleLocationSelect(location.id.toString())}
                className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-${themeColor}-50 transition-colors text-left border-t border-gray-100 ${
                  selectedLocation === location.id.toString() ? `bg-${themeColor}-50` : ''
                }`}
              >
                <div className={`flex-shrink-0 w-8 h-8 rounded-full bg-${themeColor}-100 flex items-center justify-center`}>
                  <MapPinned className={`h-4 w-4 text-${fullColor}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{location.name}</p>
                  {(location.address || location.city) && (
                    <p className="text-xs text-gray-500 truncate">
                      {location.address || `${location.city}, ${location.state}`}
                    </p>
                  )}
                </div>
                {selectedLocation === location.id.toString() && (
                  <Check className={`h-4 w-4 text-${fullColor} flex-shrink-0`} />
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Responsive layout logic
  let effectiveLayout = layout;
  if (layout === 'auto') {
    effectiveLayout = locations.length > 4 ? 'scroll' : 'grid';
  }

  // Scrollable horizontal pill selector
  if (effectiveLayout === 'scroll') {
    return (
      <div className={`space-y-3 ${className}`} style={maxWidth ? { maxWidth } : undefined}>
        <label className="block text-sm font-medium text-gray-800 mb-3">
          <MapPin className="inline h-4 w-4 mr-2" />
          Select Location
        </label>
        <div className="flex gap-2 overflow-x-auto pb-2 hide-scrollbar" style={{ WebkitOverflowScrolling: 'touch' }}>
          {showAllOption && (
            <button
              type="button"
              onClick={() => handleLocationSelect('')}
              className={`flex-shrink-0 px-4 py-2 rounded-full border-2 transition-all duration-200 text-sm font-medium whitespace-nowrap ${
                selectedLocation === ''
                  ? `border-${fullColor} bg-${themeColor}-50 shadow`
                  : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
              }`}
            >
              <Building2 className={`inline h-4 w-4 mr-1 ${selectedLocation === '' ? 'text-' + fullColor : 'text-gray-400'}`} />
              All Locations
              {selectedLocation === '' && (
                <Check className={`inline h-4 w-4 ml-1 text-${fullColor}`} />
              )}
            </button>
          )}
          {locations.map((location) => (
            <button
              key={location.id}
              type="button"
              onClick={() => handleLocationSelect(location.id.toString())}
              className={`flex-shrink-0 px-4 py-2 rounded-full border-2 transition-all duration-200 text-sm font-medium whitespace-nowrap ${
                selectedLocation === location.id.toString()
                  ? `border-${fullColor} bg-${themeColor}-50 shadow`
                  : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
              }`}
            >
              <MapPinned className={`inline h-4 w-4 mr-1 ${selectedLocation === location.id.toString() ? 'text-' + fullColor : 'text-gray-400'}`} />
              {location.name}
              {selectedLocation === location.id.toString() && (
                <Check className={`inline h-4 w-4 ml-1 text-${fullColor}`} />
              )}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Grid layout (default)
  return (
    <div className={`space-y-3 ${className}`} style={maxWidth ? { maxWidth } : undefined}>
      <label className="block text-sm font-medium text-gray-800 mb-3">
        <MapPin className="inline h-4 w-4 mr-2" />
        Select Location
      </label>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {showAllOption && (
          <button
            type="button"
            onClick={() => handleLocationSelect('')}
            className={`relative p-4 rounded-xl border-2 transition-all duration-200 text-left ${
              selectedLocation === ''
                ? `border-${fullColor} bg-${themeColor}-50 shadow-lg`
                : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-md'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className={`flex-shrink-0 w-10 h-10 rounded-lg ${
                selectedLocation === '' ? `bg-${fullColor}` : `bg-${themeColor}-100`
              } flex items-center justify-center transition-colors`}>
                <Building2 className={`h-5 w-5 ${
                  selectedLocation === '' ? 'text-white' : `text-${fullColor}`
                }`} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-gray-900 mb-1">All Locations</h3>
                <p className="text-xs text-gray-500">View data from all locations</p>
              </div>
              {selectedLocation === '' && (
                <div className={`absolute top-3 right-3 w-5 h-5 rounded-full bg-${fullColor} flex items-center justify-center`}>
                  <Check className="h-3 w-3 text-white" />
                </div>
              )}
            </div>
          </button>
        )}
        {locations.map((location) => (
          <button
            key={location.id}
            type="button"
            onClick={() => handleLocationSelect(location.id.toString())}
            className={`relative p-4 rounded-xl border-2 transition-all duration-200 text-left ${
              selectedLocation === location.id.toString()
                ? `border-${fullColor} bg-${themeColor}-50 shadow-lg`
                : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-md'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className={`flex-shrink-0 w-10 h-10 rounded-lg ${
                selectedLocation === location.id.toString() ? `bg-${fullColor}` : `bg-${themeColor}-100`
              } flex items-center justify-center transition-colors`}>
                <MapPinned className={`h-5 w-5 ${
                  selectedLocation === location.id.toString() ? 'text-white' : `text-${fullColor}`
                }`} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-gray-900 mb-1 truncate">{location.name}</h3>
                {(location.address || location.city) && (
                  <p className="text-xs text-gray-500 truncate">
                    {location.address || `${location.city}, ${location.state}`}
                  </p>
                )}
              </div>
              {selectedLocation === location.id.toString() && (
                <div className={`absolute top-3 right-3 w-5 h-5 rounded-full bg-${fullColor} flex items-center justify-center`}>
                  <Check className="h-3 w-3 text-white" />
                </div>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default LocationSelector;
