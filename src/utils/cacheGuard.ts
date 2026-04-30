/**
 * Cache Storage tenant guard.
 *
 * The `*CacheService.ts` files use the browser Cache Storage API with
 * GLOBAL cache names (e.g. `zapzone-events-cache-v1`). That cache is shared
 * across users on the same browser. If user A populates it and then user B
 * logs in, B's first paint can be served A's records — a cross-tenant leak.
 *
 * The proper logout flow already clears these caches, but there are several
 * holes:
 *   - Browser closed / crashed before sign-out.
 *   - User switches accounts on the same device.
 *   - Token expiry handled by the 401 interceptor.
 *
 * This guard runs in three places:
 *   1. App boot (from `apiInterceptors.ts`).
 *   2. Whenever `setStoredUser` is called with a different user id.
 *   3. From the 401 response interceptor.
 *
 * Strategy: enumerate every Cache Storage entry whose name matches a known
 * Zapzone prefix; open it; read its `metadata` Response (if any); if the
 * recorded `userId` does not match the currently stored user, delete the
 * cache outright. Caches without resolvable metadata are also purged on
 * user-change to be safe.
 */

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
  '/api/rooms/metadata',
  '/api/metrics/metadata',
] as const;

const isCacheStorageAvailable = (): boolean =>
  typeof window !== 'undefined' && 'caches' in window;

const looksLikeZapzoneCache = (name: string): boolean =>
  ZAPZONE_CACHE_PREFIXES.some((prefix) => name.startsWith(prefix));

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
      // try next candidate
    }
  }
  return undefined;
};

/** Delete every Zapzone-owned cache entry. Used on login / 401 / explicit purge. */
export const purgeAllZapzoneCaches = async (): Promise<void> => {
  if (!isCacheStorageAvailable()) return;
  try {
    const names = await caches.keys();
    await Promise.all(
      names
        .filter(looksLikeZapzoneCache)
        .map((name) => caches.delete(name).catch(() => false)),
    );
  } catch {
    /* ignore */
  }
};

/**
 * Delete any Zapzone cache whose recorded owner doesn't match the current
 * stored user. Safe to call on every page load.
 *
 * If `strict` is true, caches with no resolvable owner metadata are also
 * deleted (use during user-change to be extra safe).
 */
export const enforceCacheOwnership = async (
  options: { strict?: boolean } = {},
): Promise<void> => {
  if (!isCacheStorageAvailable()) return;
  const currentUserId = getCurrentUserId();

  // No user signed in → nothing legitimately needs cached data; purge all.
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
          // If we can't even inspect it, drop it on strict mode.
          if (options.strict) {
            try { await caches.delete(name); } catch { /* ignore */ }
          }
        }
      }),
    );
  } catch {
    /* ignore */
  }
};
