import contactService, { type Contact, type ContactFilters } from './ContactService';

const CACHE_NAME = 'zapzone-contacts-cache-v1';
const CONTACTS_CACHE_KEY = '/api/contacts/cached';
const CACHE_METADATA_KEY = '/api/contacts/metadata';

interface CacheMetadata {
  lastUpdated: number;
  locationId?: number;
  userId?: number;
  companyId?: number;
  totalRecords: number;
}

interface ContactsCacheEntry {
  contacts: Contact[];
}

class ContactCacheService {
  private static instance: ContactCacheService;
  private isSyncing: boolean = false;
  private syncPromise: Promise<Contact[]> | null = null;

  private constructor() {}

  static getInstance(): ContactCacheService {
    if (!ContactCacheService.instance) {
      ContactCacheService.instance = new ContactCacheService();
    }
    return ContactCacheService.instance;
  }

  private isCacheAvailable(): boolean {
    return 'caches' in window;
  }

  private async getCache(): Promise<Cache | null> {
    if (!this.isCacheAvailable()) {
      console.warn('[ContactCacheService] Cache Storage not available');
      return null;
    }
    return await caches.open(CACHE_NAME);
  }

  async cacheContacts(contacts: Contact[], metadata?: Partial<CacheMetadata>): Promise<void> {
    const cache = await this.getCache();
    if (!cache) return;

    try {
      const cacheEntry: ContactsCacheEntry = { contacts };

      const response = new Response(JSON.stringify(cacheEntry), {
        headers: {
          'Content-Type': 'application/json',
          'X-Cache-Date': new Date().toISOString(),
        },
      });

      await cache.put(CONTACTS_CACHE_KEY, response);

      const fullMetadata: CacheMetadata = {
        lastUpdated: Date.now(),
        totalRecords: contacts.length,
        ...metadata,
      };

      const metadataResponse = new Response(JSON.stringify(fullMetadata), {
        headers: { 'Content-Type': 'application/json' },
      });

      await cache.put(CACHE_METADATA_KEY, metadataResponse);
    } catch (error) {
      console.error('[ContactCacheService] Error caching contacts:', error);
    }
  }

  async getCachedContacts(): Promise<Contact[] | null> {
    const cache = await this.getCache();
    if (!cache) return null;

    try {
      const response = await cache.match(CONTACTS_CACHE_KEY);
      if (!response) return null;

      const data: ContactsCacheEntry = await response.json();
      return data.contacts;
    } catch (error) {
      console.error('[ContactCacheService] Error reading cached contacts:', error);
      return null;
    }
  }

  async getCacheMetadata(): Promise<CacheMetadata | null> {
    const cache = await this.getCache();
    if (!cache) return null;

    try {
      const response = await cache.match(CACHE_METADATA_KEY);
      if (!response) return null;

      return await response.json();
    } catch (error) {
      console.error('[ContactCacheService] Error reading cache metadata:', error);
      return null;
    }
  }

  async isCacheStale(maxAgeMinutes: number = 5): Promise<boolean> {
    const metadata = await this.getCacheMetadata();
    if (!metadata) return true;

    const ageMs = Date.now() - metadata.lastUpdated;
    return ageMs > maxAgeMinutes * 60 * 1000;
  }

  async getContacts(filters: ContactFilters): Promise<Contact[]> {
    if (this.isSyncing && this.syncPromise) {
      return this.syncPromise;
    }

    const cached = await this.getCachedContacts();
    if (cached && cached.length > 0) {
      if (await this.isCacheStale()) {
        this.syncInBackground(filters);
      }
      return cached;
    }

    return this.syncFromAPI(filters);
  }

  async forceRefresh(filters: ContactFilters): Promise<Contact[]> {
    if (this.isSyncing && this.syncPromise) {
      return this.syncPromise;
    }
    return this.syncFromAPI(filters);
  }

  private async syncFromAPI(filters: ContactFilters): Promise<Contact[]> {
    this.isSyncing = true;

    this.syncPromise = (async () => {
      try {
        const baseFilters: ContactFilters = {
          ...filters,
          per_page: 200,
          sort_by: 'created_at',
          sort_order: 'desc',
        };

        let allContacts: Contact[] = [];
        let page = 1;
        let lastPage = 1;

        do {
          const response = await contactService.getContacts({ ...baseFilters, page });
          if (!response.success || !response.data) break;
          allContacts = allContacts.concat(response.data.contacts);
          lastPage = response.data.pagination.last_page;
          page++;
        } while (page <= lastPage);

        await this.cacheContacts(allContacts, {
          companyId: filters.company_id,
          locationId: filters.location_id,
          userId: filters.user_id,
        });

        window.dispatchEvent(new CustomEvent('contacts-cache-updated', {
          detail: { contacts: allContacts, source: 'api' },
        }));

        return allContacts;
      } catch (error) {
        console.error('[ContactCacheService] Error fetching contacts:', error);
        const cached = await this.getCachedContacts();
        return cached || [];
      } finally {
        this.isSyncing = false;
        this.syncPromise = null;
      }
    })();

    return this.syncPromise;
  }

  syncInBackground(filters: ContactFilters): void {
    if (this.isSyncing) return;

    setTimeout(async () => {
      try {
        await this.syncFromAPI(filters);
      } catch (error) {
        console.error('[ContactCacheService] Background sync failed:', error);
      }
    }, 0);
  }

  async hasCachedData(): Promise<boolean> {
    const cache = await this.getCache();
    if (!cache) return false;

    try {
      const response = await cache.match(CONTACTS_CACHE_KEY);
      return response !== undefined;
    } catch {
      return false;
    }
  }

  async clearCache(): Promise<void> {
    if (!this.isCacheAvailable()) return;

    try {
      await caches.delete(CACHE_NAME);
      window.dispatchEvent(new CustomEvent('contacts-cache-cleared'));
    } catch (error) {
      console.error('[ContactCacheService] Error clearing cache:', error);
    }
  }

  onCacheUpdate(callback: (event: CustomEvent) => void): () => void {
    const handler = (e: Event) => callback(e as CustomEvent);
    window.addEventListener('contacts-cache-updated', handler);
    return () => window.removeEventListener('contacts-cache-updated', handler);
  }
}

export const contactCacheService = ContactCacheService.getInstance();
export default contactCacheService;
