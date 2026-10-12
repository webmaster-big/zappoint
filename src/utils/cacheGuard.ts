
const ZAPZONE_CACHE_PREFIXES = ['zapzone-', 'metrics-cache-'] as const;

const METADATA_KEY_CANDIDATES = [
  '/api/events/metadata',
  '/api/bookings/metadata',
  '/api/packages/metadata',
  '/api/addons/metadata',
  '/api/attractions/metadata',
  '/api/attraction-purchases/metadata',
  '/api/customers/metadata',
  '/api/customer-data/metadata',
  '/api/contacts/metadata',
  '/api/rooms/metadata',
  '/api/metrics/metadata',
  '/api/memberships/metadata',
  '/api/waivers/metadata',
] as const;

// Public storefront catalogs hold no per-user data, so they must survive the
// ownership sweep — anonymous shoppers have no user id at all, and purging their
// catalog on every boot made the cache pointless.
const PUBLIC_CACHE_NAMES = ['zapzone-customer-data-v1'] as const;

const isPublicCache = (name: string): boolean =>
  PUBLIC_CACHE_NAMES.some((publicName) => name === publicName);

const isCacheStorageAvailable = (): boolean =>
  typeof window !== 'undefined' && 'caches' in window;

const looksLikeZapzoneCache = (name: string): boolean =>
  !isPublicCache(name) && ZAPZONE_CACHE_PREFIXES.some((prefix) => name.startsWith(prefix));

const getCurrentUserId = (): number | null => {
  try {
    const raw = localStorage.getItem('zapzone_user');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return typeof parsed?.id === 'number' ? parsed.id : null;
  } catch {
    return null;
  }
};

const readCacheUserId = async (cache: Cache): Promise<number | undefined> => {
  for (const key of METADATA_KEY_CANDIDATES) {
    try {
      const res = await cache.match(key);
      if (!res) continue;
      const data = await res.json();
      if (typeof data?.userId === 'number') return data.userId;
    } catch {
    }
  }
  return undefined;
};

const BOOKINGS_WRITE_LOCK = 'zapzone-bookings-cache-write';
const PURGE_LOCK_WAIT_MS = 3000;

const deleteZapzoneCaches = async (): Promise<void> => {
  try {
    const names = await caches.keys();
    await Promise.all(
      names
        .filter(looksLikeZapzoneCache)
        .map((name) => caches.delete(name).catch(() => false)),
    );
  } catch {
  }
};

export const purgeAllZapzoneCaches = async (): Promise<void> => {
  if (!isCacheStorageAvailable()) return;
  if (typeof navigator === 'undefined' || !navigator.locks) {
    await deleteZapzoneCaches();
    return;
  }

  const waited = new AbortController();
  const timer = setTimeout(() => waited.abort(), PURGE_LOCK_WAIT_MS);
  try {
    await navigator.locks.request(BOOKINGS_WRITE_LOCK, { signal: waited.signal }, deleteZapzoneCaches);
  } catch {
    await deleteZapzoneCaches();
  } finally {
    clearTimeout(timer);
  }
};

export const enforceCacheOwnership = async (
  options: { strict?: boolean } = {},
): Promise<void> => {
  if (!isCacheStorageAvailable()) return;
  const currentUserId = getCurrentUserId();

  if (currentUserId === null) {
    await purgeAllZapzoneCaches();
    return;
  }

  try {
    const names = await caches.keys();
    await Promise.all(
      names.filter(looksLikeZapzoneCache).map(async (name) => {
        try {
          const cache = await caches.open(name);
          const ownerId = await readCacheUserId(cache);
          if (ownerId === undefined) {
            if (options.strict) await caches.delete(name);
            return;
          }
          if (ownerId !== currentUserId) {
            await caches.delete(name);
          }
        } catch {
          if (options.strict) {
            try { await caches.delete(name); } catch { /* ignore */ }
          }
        }
      }),
    );
  } catch {
  }
};
