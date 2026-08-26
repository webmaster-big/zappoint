import axios from 'axios';
import { API_BASE_URL, getStoredUser } from '../utils/storage';

const api = axios.create({ baseURL: API_BASE_URL });

export interface TargetingOption {
  id: number;
  name: string;
  location_id: number;
  category?: string | null;
}

export interface TargetingOptions {
  locations: { id: number; name: string }[];
  packages: TargetingOption[];
  attractions: TargetingOption[];
  events: TargetingOption[];
}

const EMPTY: TargetingOptions = { locations: [], packages: [], attractions: [], events: [] };

const TTL_MS = 2 * 60 * 1000;

let cached: TargetingOptions | null = null;
let cachedAt = 0;
let inFlight: Promise<TargetingOptions> | null = null;

/**
 * The whole targeting catalog in one request. Held briefly in memory because every picker
 * that opens would otherwise refetch it — but only for TTL_MS, so a package added in
 * another tab shows up rather than staying invisible for the whole session.
 */
export const targetingOptionsService = {
  async get(force = false): Promise<TargetingOptions> {
    const fresh = cached && Date.now() - cachedAt < TTL_MS;
    if (fresh && !force) return cached as TargetingOptions;
    if (inFlight && !force) return inFlight;

    inFlight = api
      .get('/targeting-options', {
        headers: {
          Accept: 'application/json',
          ...(getStoredUser()?.token ? { Authorization: `Bearer ${getStoredUser()?.token}` } : {}),
        },
      })
      .then(({ data }) => {
        cached = (data?.data ?? EMPTY) as TargetingOptions;
        cachedAt = Date.now();
        return cached;
      })
      .catch(() => EMPTY)
      .finally(() => { inFlight = null; });

    return inFlight;
  },

  clear() {
    cached = null;
    cachedAt = 0;
  },
};

export default targetingOptionsService;
