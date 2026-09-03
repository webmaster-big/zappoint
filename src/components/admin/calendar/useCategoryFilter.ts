import { useEffect, useMemo, useState } from 'react';
import { normalizeCategory } from '../../../utils/venueCategories';

export type CategorySource = 'booking' | 'attraction' | 'event';

export const EVENTS_CATEGORY_KEY = '__events';
export const UNCATEGORISED_CATEGORY_KEY = '__uncategorised';

export interface CalendarCategory {
  key: string;
  label: string;
  count: number;
  sources: CategorySource[];
}

export interface CategorisedBooking {
  package?: { category?: string | null } | null;
}

export interface CategorisedAttraction {
  attraction?: { category?: string | null } | null;
}

export interface CategoryFilterState {
  categories: CalendarCategory[];
  selected: string[];
  isAll: boolean;
  shows: (key: string) => boolean;
  showsBooking: (booking: CategorisedBooking) => boolean;
  showsAttraction: (purchase: CategorisedAttraction) => boolean;
  showsEvents: () => boolean;
  toggle: (key: string) => void;
  showAll: () => void;
}

export const categoryKeyOf = (value?: string | null): string => {
  const normalized = normalizeCategory(value);
  return normalized === '' ? UNCATEGORISED_CATEGORY_KEY : normalized;
};

export const categoryLabelOf = (key: string): string => {
  if (key === EVENTS_CATEGORY_KEY) return 'Events';
  if (key === UNCATEGORISED_CATEGORY_KEY) return 'No category';
  return key;
};

const sortCategories = (a: CalendarCategory, b: CalendarCategory): number => {
  const rank = (key: string) => (key === EVENTS_CATEGORY_KEY ? 1 : key === UNCATEGORISED_CATEGORY_KEY ? 2 : 0);
  if (rank(a.key) !== rank(b.key)) return rank(a.key) - rank(b.key);
  return a.label.localeCompare(b.label, undefined, { sensitivity: 'base' });
};

export const buildCalendarCategories = (input: {
  bookings?: CategorisedBooking[];
  attractions?: CategorisedAttraction[];
  events?: unknown[];
}): CalendarCategory[] => {
  const found = new Map<string, CalendarCategory>();

  const add = (key: string, source: CategorySource) => {
    const existing = found.get(key);
    if (existing) {
      existing.count += 1;
      if (!existing.sources.includes(source)) existing.sources.push(source);
      return;
    }
    found.set(key, { key, label: categoryLabelOf(key), count: 1, sources: [source] });
  };

  (input.bookings ?? []).forEach((booking) => add(categoryKeyOf(booking.package?.category), 'booking'));
  (input.attractions ?? []).forEach((purchase) => add(categoryKeyOf(purchase.attraction?.category), 'attraction'));
  (input.events ?? []).forEach(() => add(EVENTS_CATEGORY_KEY, 'event'));

  return [...found.values()].sort(sortCategories);
};

/**
 * @param categories only those present in the data on screen, from buildCalendarCategories
 * @param seed       what to start from, so a day modal opens on the page's own selection
 * @param resetOn    changing this starts over: pass the selected day so one day's choice
 *                   does not silently carry into the next day a manager opens
 */
export const useCategoryFilter = (
  categories: CalendarCategory[],
  seed?: string[],
  resetOn?: string | null,
): CategoryFilterState => {
  const seedKey = (seed ?? []).join('|') + '@' + (resetOn ?? '');

  const [chosen, setChosen] = useState<string[] | null>(null);

  useEffect(() => {
    setChosen(null);
  }, [seedKey]);

  const selected = useMemo(
    () => (chosen ?? seed ?? []).filter((key) => categories.some((category) => category.key === key)),
    [chosen, seed, categories],
  );

  const isAll = selected.length === 0;
  const shows = (key: string) => isAll || selected.includes(key);

  return {
    categories,
    selected,
    isAll,
    shows,
    showsBooking: (booking) => shows(categoryKeyOf(booking.package?.category)),
    showsAttraction: (purchase) => shows(categoryKeyOf(purchase.attraction?.category)),
    showsEvents: () => shows(EVENTS_CATEGORY_KEY),
    toggle: (key) =>
      setChosen(selected.includes(key) ? selected.filter((k) => k !== key) : [...selected, key]),
    showAll: () => setChosen([]),
  };
};

export const sourceOf = (category: CalendarCategory): CategorySource | 'mixed' =>
  category.sources.length > 1 ? 'mixed' : category.sources[0] ?? 'booking';
