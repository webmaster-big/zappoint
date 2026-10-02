import { normalizeCategory } from './venueCategories';
import type { GroupedAttraction, GroupedEvent, GroupedPackage } from '../services/CustomerService';

export interface StorefrontCategory {
  key: string;
  label: string;
}

export const EVENTS_CATEGORY_LABEL = 'Events';

export const categoryKeyOf = (value?: string | null) =>
  (value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export const categoryLabelOfPackage = (pkg: { display_label?: string | null; category?: string | null }) =>
  normalizeCategory(pkg.display_label || pkg.category);

export const isUpcomingEvent = (
  evt: { start_date?: string | null; end_date?: string | null },
  now: Date = new Date(),
) => {
  const endDate = (evt.end_date || evt.start_date || '').substring(0, 10);
  if (!endDate) return false;
  return new Date(`${endDate}T23:59:59`) >= now;
};

export const storefrontCategoryPath = (locationSlug: string, categoryKey: string) =>
  `/${locationSlug}?category=${encodeURIComponent(categoryKey)}`;

const ownRowsByLocation = <L extends { location_id: number; description?: unknown }>(rows: L[]) => {
  const own = new Map<number, L>();
  rows.forEach(row => {
    if (row.description === undefined || own.has(row.location_id)) return;
    own.set(row.location_id, row);
  });
  return own;
};

const locationIdsOf = (rows: Array<{ location_id: number }>) =>
  Array.from(new Set(rows.map(row => row.location_id)));

export const buildLocationCategories = (
  attractions: GroupedAttraction[],
  packages: GroupedPackage[],
  events: GroupedEvent[],
  now: Date = new Date(),
): Record<number, StorefrontCategory[]> => {
  const labelsByLocation = new Map<number, Map<string, string>>();

  const add = (locationId: number, label: string) => {
    const key = categoryKeyOf(label);
    if (!key) return;
    let labels = labelsByLocation.get(locationId);
    if (!labels) {
      labels = new Map();
      labelsByLocation.set(locationId, labels);
    }
    if (!labels.has(key)) labels.set(key, label.trim());
  };

  packages.forEach(pkg => {
    const own = ownRowsByLocation(pkg.locations);
    locationIdsOf(pkg.locations).forEach(locationId =>
      add(locationId, categoryLabelOfPackage(own.get(locationId) ?? pkg)));
  });

  attractions.forEach(attraction => {
    const own = ownRowsByLocation(attraction.locations);
    locationIdsOf(attraction.locations).forEach(locationId =>
      add(locationId, normalizeCategory((own.get(locationId) ?? attraction).category)));
  });

  events
    .filter(evt => isUpcomingEvent(evt, now))
    .forEach(evt => locationIdsOf(evt.locations).forEach(locationId => add(locationId, EVENTS_CATEGORY_LABEL)));

  const result: Record<number, StorefrontCategory[]> = {};
  labelsByLocation.forEach((labels, locationId) => {
    result[locationId] = Array.from(labels, ([key, label]) => ({ key, label })).sort((a, b) =>
      a.label.localeCompare(b.label),
    );
  });
  return result;
};
