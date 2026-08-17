import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { StorefrontLocation } from '../../services/StorefrontLocationService';
import { locationShortName } from '../../utils/locationName';
import { tileConfig } from '../../utils/mapTiles';

interface LocationsMapProps {
  locations: StorefrontLocation[];
  activeSlug?: string | null;
  className?: string;
}

type Located = StorefrontLocation & { latitude: number; longitude: number };

const hasCoordinates = (location: StorefrontLocation): location is Located =>
  typeof location.latitude === 'number' &&
  Number.isFinite(location.latitude) &&
  typeof location.longitude === 'number' &&
  Number.isFinite(location.longitude);

const escapeHtml = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const pinIcon = (label: string, active: boolean) =>
  L.divIcon({
    className: '',
    html: `<div class="zz-pin${active ? ' zz-pin--active' : ''}">
        <span class="zz-pin__dot"></span>
        <span class="zz-pin__label">${escapeHtml(label)}</span>
      </div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });

/** Keeps the viewport around whichever pins are currently visible. */
const FitToPins: React.FC<{ positions: Array<[number, number]> }> = ({ positions }) => {
  const map = useMap();

  useEffect(() => {
    if (positions.length === 0) return;
    map.fitBounds(L.latLngBounds(positions), { padding: [60, 60], maxZoom: 11 });
  }, [map, positions]);

  return null;
};

let tileNoticeShown = false;

const LocationsMap: React.FC<LocationsMapProps> = ({ locations, activeSlug = null, className = '' }) => {
  const navigate = useNavigate();
  const tiles = useMemo(() => tileConfig(), []);
  const plottable = useMemo(() => locations.filter(hasCoordinates), [locations]);
  const positions = useMemo(
    () => plottable.map((location) => [location.latitude, location.longitude] as [number, number]),
    [plottable],
  );

  // Said once, to the console, not to the customer.
  useEffect(() => {
    if (!tiles.licensedForProduction && !tileNoticeShown) {
      tileNoticeShown = true;
      console.info(
        '[LocationsMap] Using OpenStreetMap tiles. They need no key and are fine for development, ' +
        'but their usage policy does not cover a commercial site at scale. Set VITE_MAPTILER_KEY ' +
        'or VITE_STADIA_MAPS_KEY before launch.',
      );
    }
  }, [tiles]);

  if (plottable.length === 0) return null;

  return (
    <div
      className={`zz-map relative ${className}`}
      role="region"
      aria-label={`Map of our ${plottable.length} Michigan locations`}
    >
      <MapContainer
        // Scrolling the page must not zoom the map out from under the reader.
        scrollWheelZoom={false}
        center={[44.3, -85.6]}
        zoom={6}
        className="w-full h-full"
      >
        <TileLayer url={tiles.url} attribution={tiles.attribution} maxZoom={tiles.maxZoom} />
        <FitToPins positions={positions} />

        {plottable.map((location) => {
          const label = locationShortName(location.name, location.city);
          const address = [location.address, location.city, location.state, location.zip_code]
            .filter(Boolean)
            .join(', ');

          return (
            <Marker
              key={location.id}
              position={[location.latitude, location.longitude]}
              icon={pinIcon(label, location.slug === activeSlug)}
              title={`${label} — click to open`}
              alt={label}
              eventHandlers={{
                click: () => navigate(`/${location.slug}`),
                mouseover: (event) => event.target.openPopup(),
                mouseout: (event) => event.target.closePopup(),
              }}
            >
              <Popup>
                <span className="zz-popup">
                  <strong>{label}</strong>
                  {address && <span>{address}</span>}
                  <em>Click the pin to open this location</em>
                </span>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
};

export default LocationsMap;
