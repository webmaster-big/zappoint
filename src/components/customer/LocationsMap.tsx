import { useMemo } from 'react';
import type { StorefrontLocation } from '../../services/StorefrontLocationService';
import { plotLocations, VIEW_HEIGHT, VIEW_WIDTH } from '../../utils/mapProjection';

interface LocationsMapProps {
  locations: StorefrontLocation[];
  activeSlug?: string | null;
  className?: string;
}

const GRID_COLUMNS = 7;
const GRID_ROWS = 4;

const LocationsMap: React.FC<LocationsMapProps> = ({ locations, activeSlug = null, className = '' }) => {
  const points = useMemo(() => plotLocations(locations), [locations]);

  if (points.length === 0) return null;

  return (
    <svg
      viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
      preserveAspectRatio="xMidYMid slice"
      className={className}
      role="presentation"
      aria-hidden="true"
      focusable="false"
    >
      <g stroke="currentColor" strokeWidth="1" opacity="0.3">
        {Array.from({ length: GRID_COLUMNS - 1 }).map((_, index) => {
          const x = (VIEW_WIDTH / GRID_COLUMNS) * (index + 1);
          return <line key={`v${index}`} x1={x} y1="0" x2={x} y2={VIEW_HEIGHT} />;
        })}
        {Array.from({ length: GRID_ROWS - 1 }).map((_, index) => {
          const y = (VIEW_HEIGHT / GRID_ROWS) * (index + 1);
          return <line key={`h${index}`} x1="0" y1={y} x2={VIEW_WIDTH} y2={y} />;
        })}
      </g>

      <g fill="currentColor">
        {points.map((point) => {
          const isActive = activeSlug !== null && point.slug === activeSlug;
          return (
            <g key={point.id} data-slug={point.slug}>
              <circle cx={point.x} cy={point.y} r={isActive ? 46 : 30} opacity="0.14" />
              <circle cx={point.x} cy={point.y} r={isActive ? 20 : 13} opacity="0.4" />
              <circle cx={point.x} cy={point.y} r={isActive ? 8 : 5.5} />
            </g>
          );
        })}
      </g>
    </svg>
  );
};

export default LocationsMap;
