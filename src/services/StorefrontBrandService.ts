import axios from 'axios';
import { API_BASE_URL } from '../utils/storage';

export interface StorefrontBrand {
  name: string | null;
  logo_path: string | null;
}

const CACHE_KEY = 'zapzone_storefront_brand';
const BRAND_URL = '/storefront/brand';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { Accept: 'application/json' },
});

const asText = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() !== '' ? value : null;

const toBrand = (value: unknown): StorefrontBrand | null => {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  const brand = { name: asText(row.name), logo_path: asText(row.logo_path) };
  return brand.name || brand.logo_path ? brand : null;
};

export const readCachedStorefrontBrand = (): StorefrontBrand | null => {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? toBrand(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
};

const cache = (brand: StorefrontBrand) => {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(brand));
  } catch {
    /* ignore quota errors */
  }
};

let inFlight: Promise<StorefrontBrand | null> | null = null;
let resolved: StorefrontBrand | null | undefined;
let primeCount = 0;

const load = async (): Promise<StorefrontBrand | null> => {
  const brand = toBrand((await api.get(BRAND_URL)).data?.data);
  if (brand) cache(brand);
  return brand;
};

export const primeStorefrontBrandLogo = (logoPath: string | null): void => {
  const next: StorefrontBrand = { name: resolved?.name ?? readCachedStorefrontBrand()?.name ?? null, logo_path: logoPath };
  resolved = next;
  primeCount += 1;
  cache(next);
};

export const fetchStorefrontBrand = (): Promise<StorefrontBrand | null> => {
  if (resolved !== undefined) return Promise.resolve(resolved);
  if (inFlight) return inFlight;

  const primeSeenAtStart = primeCount;
  inFlight = load()
    .then((brand) => {
      if (primeCount !== primeSeenAtStart) return resolved ?? brand;
      resolved = brand;
      return brand;
    })
    .finally(() => {
      inFlight = null;
    });

  return inFlight;
};
