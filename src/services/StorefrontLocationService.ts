import axios from 'axios';
import { API_BASE_URL } from '../utils/storage';
import { generateLocationSlug } from '../utils/slug';

export interface StorefrontLocation {
  id: number;
  name: string;
  slug: string;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip_code?: string | null;
  phone?: string | null;
  email?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  /** False when the slug was derived here because the server had none to give. */
  hasStoredSlug?: boolean;
}

const CACHE_KEY = 'zapzone_storefront_locations';
const STOREFRONT_URL = '/storefront/locations';
const LOCATIONS_URL = '/locations';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { Accept: 'application/json' },
});

const asText = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() !== '' ? value : null;

const asCoordinate = (value: unknown, limit: number): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed) || Math.abs(parsed) > limit) return null;
  return parsed;
};

const toStorefrontLocation = (value: unknown): StorefrontLocation | null => {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;

  const id = typeof row.id === 'number' ? row.id : Number(row.id);
  const name = asText(row.name);
  if (!Number.isFinite(id) || !name) return null;

  const stored = asText(row.slug);
  const slug = stored ?? generateLocationSlug(asText(row.city) ?? name);
  if (!slug) return null;

  return {
    id,
    name,
    slug,
    hasStoredSlug: stored !== null,
    address: asText(row.address),
    city: asText(row.city),
    state: asText(row.state),
    zip_code: asText(row.zip_code),
    phone: asText(row.phone),
    latitude: asCoordinate(row.latitude, 90),
    longitude: asCoordinate(row.longitude, 180),
  };
};

/**
 * Two locations in the same city derive the same slug, and the second card would then link
 * to the first one's page. The server numbers its duplicates, so do the same here for the
 * rows that arrive without a stored slug.
 */
const dedupeDerivedSlugs = (rows: StorefrontLocation[]): StorefrontLocation[] => {
  const taken = new Set(rows.filter((row) => row.hasStoredSlug).map((row) => row.slug.toLowerCase()));

  return rows.map((row) => {
    if (row.hasStoredSlug) return row;

    let slug = row.slug;
    let suffix = 2;
    while (taken.has(slug.toLowerCase())) {
      slug = `${row.slug}-${suffix}`;
      suffix += 1;
    }
    taken.add(slug.toLowerCase());

    return slug === row.slug ? row : { ...row, slug };
  });
};

const readRows = (payload: unknown): StorefrontLocation[] => {
  const data = (payload as { data?: unknown })?.data;
  if (!Array.isArray(data)) return [];

  const rows = data
    .map(toStorefrontLocation)
    .filter((row): row is StorefrontLocation => row !== null)
    .sort((a, b) => a.name.localeCompare(b.name));

  return dedupeDerivedSlugs(rows);
};

export const readCachedStorefrontLocations = (): StorefrontLocation[] => {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.map(toStorefrontLocation).filter((row): row is StorefrontLocation => row !== null)
      : [];
  } catch {
    return [];
  }
};

const cache = (rows: StorefrontLocation[]) => {
  if (rows.length === 0) return;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(rows));
  } catch {
    /* ignore quota errors */
  }
};

let inFlight: Promise<StorefrontLocation[]> | null = null;

const load = async (): Promise<StorefrontLocation[]> => {
  try {
    const rows = readRows((await api.get(STOREFRONT_URL)).data);
    if (rows.length > 0) {
      cache(rows);
      return rows;
    }
  } catch {
    /* the narrow endpoint may not be deployed yet; the locations table still is */
  }

  const rows = readRows((await api.get(LOCATIONS_URL)).data);
  cache(rows);
  return rows;
};

export const fetchStorefrontLocations = (): Promise<StorefrontLocation[]> => {
  if (inFlight) return inFlight;

  inFlight = load().finally(() => {
    inFlight = null;
  });

  return inFlight;
};

export const findLocationBySlug = (
  locations: StorefrontLocation[],
  slug: string | undefined,
): StorefrontLocation | null => {
  if (!slug) return null;
  const wanted = slug.trim().toLowerCase();
  return locations.find((location) => location.slug.toLowerCase() === wanted) ?? null;
};

export const findLocationById = (
  locations: StorefrontLocation[],
  id: number | null | undefined,
): StorefrontLocation | null => {
  if (id === null || id === undefined) return null;
  return locations.find((location) => location.id === id) ?? null;
};
