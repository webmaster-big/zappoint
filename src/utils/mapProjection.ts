import type { StorefrontLocation } from '../services/StorefrontLocationService';

export const VIEW_WIDTH = 1000;
export const VIEW_HEIGHT = 560;

const PADDING = 90;
const MIN_SPAN_LON = 0.35;
const MIN_SPAN_MERCATOR = 0.26;

export interface PlottedLocation {
  id: number;
  name: string;
  slug: string;
  x: number;
  y: number;
}

export const mercatorY = (latitude: number): number => {
  const clamped = Math.max(-85, Math.min(85, latitude));
  const radians = (clamped * Math.PI) / 180;
  return Math.log(Math.tan(Math.PI / 4 + radians / 2));
};

export const hasCoordinates = (
  location: StorefrontLocation,
): location is StorefrontLocation & { latitude: number; longitude: number } =>
  typeof location.latitude === 'number' &&
  Number.isFinite(location.latitude) &&
  Math.abs(location.latitude) <= 90 &&
  typeof location.longitude === 'number' &&
  Number.isFinite(location.longitude) &&
  Math.abs(location.longitude) <= 180;

export const plotLocations = (locations: StorefrontLocation[]): PlottedLocation[] => {
  const usable = locations.filter(hasCoordinates);
  if (usable.length === 0) return [];

  const xs = usable.map((location) => location.longitude);
  const ys = usable.map((location) => mercatorY(location.latitude));

  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  const centreX = (minX + maxX) / 2;
  const centreY = (minY + maxY) / 2;

  const spanX = Math.max(maxX - minX, MIN_SPAN_LON);
  const spanY = Math.max(maxY - minY, MIN_SPAN_MERCATOR);

  const scale = Math.min((VIEW_WIDTH - PADDING * 2) / spanX, (VIEW_HEIGHT - PADDING * 2) / spanY);

  return usable.map((location) => ({
    id: location.id,
    name: location.name,
    slug: location.slug,
    x: VIEW_WIDTH / 2 + (location.longitude - centreX) * scale,
    y: VIEW_HEIGHT / 2 - (mercatorY(location.latitude) - centreY) * scale,
  }));
};
