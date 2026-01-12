/**
 * CustomerCacheService
 * 
 * A service that uses the Cache Storage API to cache customer data for faster
 * access across dashboard components and customer management pages.
 * 
 * Features:
 * - Store customers in Cache Storage (not localStorage/sessionStorage)
 * - Provide cached data as primary source for rendering
 * - Update cache when customers are modified
 * - Background sync on page navigation
 * - Clear cache on logout
 */

import { customerService, type CustomerListItem, type CustomerListFilters, type PaginatedResponse } from './CustomerService';

const CACHE_NAME = 'zapzone-customers-cache-v1';
const CUSTOMERS_CACHE_KEY = '/api/customers/cached';
const CACHE_METADATA_KEY = '/api/customers/metadata';

// Track if warmup already happened this session
let warmupCompleted = false;

// Cache metadata for tracking staleness
interface CacheMetadata {
  lastUpdated: number;
  userId?: number;
  totalRecords: number;
}

// Cache entry structure
interface CustomersCacheEntry {
  customers: CustomerListItem[];
  pagination?: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
  filters?: CustomerListFilters;
}

class CustomerCacheService {
  private static instance: CustomerCacheService;
  private isSyncing: boolean = false;
  private syncPromise: Promise<CustomerListItem[]> | null = null;

  private constructor() {}

  static getInstance(): CustomerCacheService {
    if (!CustomerCacheService.instance) {
      CustomerCacheService.instance = new CustomerCacheService();
    }
    return CustomerCacheService.instance;
  }

  /**
   * Check if Cache Storage is available
   */
  private isCacheAvailable(): boolean {
    return 'caches' in window;
  }

  /**
   * Get the cache instance
   */
  private async getCache(): Promise<Cache | null> {
    if (!this.isCacheAvailable()) {
      console.warn('[CustomerCacheService] Cache Storage not available');
      return null;
    }
    return await caches.open(CACHE_NAME);
  }

  /**
   * Store customers in cache
   */
  async cacheCustomers(customers: CustomerListItem[], metadata?: Partial<CacheMetadata>): Promise<void> {
    const cache = await this.getCache();
    if (!cache) return;

    try {
      const cacheEntry: CustomersCacheEntry = {
        customers,
      };

      // Create a Response object to store in cache
      const response = new Response(JSON.stringify(cacheEntry), {
        headers: {
          'Content-Type': 'application/json',
          'X-Cache-Date': new Date().toISOString(),
        },
      });

      await cache.put(CUSTOMERS_CACHE_KEY, response);

      // Store metadata
      const fullMetadata: CacheMetadata = {
        lastUpdated: Date.now(),
        totalRecords: customers.length,
        ...metadata,
      };

      const metadataResponse = new Response(JSON.stringify(fullMetadata), {
        headers: { 'Content-Type': 'application/json' },
      });

      await cache.put(CACHE_METADATA_KEY, metadataResponse);

      console.log(`[CustomerCacheService] Cached ${customers.length} customers`);
    } catch (error) {
      console.error('[CustomerCacheService] Error caching customers:', error);
    }
  }

  /**
   * Get customers from cache
   */
  async getCachedCustomers(): Promise<CustomerListItem[] | null> {
    const cache = await this.getCache();
    if (!cache) return null;

    try {
      const response = await cache.match(CUSTOMERS_CACHE_KEY);
      if (!response) return null;

      const data: CustomersCacheEntry = await response.json();
      console.log(`[CustomerCacheService] Retrieved ${data.customers.length} customers from cache`);
      return data.customers;
    } catch (error) {
      console.error('[CustomerCacheService] Error reading cached customers:', error);
      return null;
    }
  }

  /**
   * Get cache metadata
   */
  async getCacheMetadata(): Promise<CacheMetadata | null> {
    const cache = await this.getCache();
    if (!cache) return null;

    try {
      const response = await cache.match(CACHE_METADATA_KEY);
      if (!response) return null;

      return await response.json();
    } catch (error) {
      console.error('[CustomerCacheService] Error reading cache metadata:', error);
      return null;
    }
  }

  /**
   * Check if cache is stale (older than specified minutes)
   */
  async isCacheStale(maxAgeMinutes: number = 5): Promise<boolean> {
    const metadata = await this.getCacheMetadata();
    if (!metadata) return true;

    const ageMs = Date.now() - metadata.lastUpdated;
    const maxAgeMs = maxAgeMinutes * 60 * 1000;

    return ageMs > maxAgeMs;
  }

  /**
   * Fetch customers from API and update cache
   * Returns cached data immediately if available, then syncs in background
   */
  async fetchAndCacheCustomers(
    userId: number,
    filters?: CustomerListFilters,
    forceRefresh: boolean = false
  ): Promise<CustomerListItem[]> {
    // If already syncing, return the existing promise
    if (this.isSyncing && this.syncPromise) {
      return this.syncPromise;
    }

    // Check cache first (unless force refresh)
    if (!forceRefresh) {
      const cachedCustomers = await this.getCachedCustomers();
      const isStale = await this.isCacheStale();

      if (cachedCustomers && cachedCustomers.length > 0) {
        // If cache is stale, sync in background
        if (isStale) {
          this.syncInBackground(userId, filters);
        }
        return cachedCustomers;
      }
    }

    // No cache or force refresh - fetch from API
    return this.syncFromAPI(userId, filters);
  }

  /**
   * Sync customers from API
   */
  private async syncFromAPI(userId: number, filters?: CustomerListFilters): Promise<CustomerListItem[]> {
    this.isSyncing = true;

    this.syncPromise = (async () => {
      try {
        // Fetch all customers with high per_page to get most data
        const response: PaginatedResponse<CustomerListItem> = await customerService.fetchCustomerList(userId, {
          ...filters,
          per_page: 1000, // Get a large batch
        });

        const customers = response.data?.customers || [];

        // Cache the customers
        await this.cacheCustomers(customers, {
          userId,
        });

        // Dispatch event to notify components
        window.dispatchEvent(new CustomEvent('customers-cache-updated', {
          detail: { customers, source: 'api' }
        }));

        return customers;
      } catch (error) {
        console.error('[CustomerCacheService] Error fetching customers:', error);
        // Return cached data as fallback
        const cached = await this.getCachedCustomers();
        return cached || [];
      } finally {
        this.isSyncing = false;
        this.syncPromise = null;
      }
    })();

    return this.syncPromise;
  }

  /**
   * Sync customers in background without blocking
   */
  syncInBackground(userId: number, filters?: CustomerListFilters): void {
    if (this.isSyncing) return;

    // Use setTimeout to ensure it runs in background
    setTimeout(async () => {
      try {
        await this.syncFromAPI(userId, filters);
        console.log('[CustomerCacheService] Background sync completed');
      } catch (error) {
        console.error('[CustomerCacheService] Background sync failed:', error);
      }
    }, 0);
  }

  /**
   * Update a single customer in cache
   */
  async updateCustomerInCache(updatedCustomer: CustomerListItem): Promise<void> {
    const cachedCustomers = await this.getCachedCustomers();
    if (!cachedCustomers) return;

    const index = cachedCustomers.findIndex(c => c.id === updatedCustomer.id);
    
    if (index >= 0) {
      // Update existing customer
      cachedCustomers[index] = updatedCustomer;
    } else {
      // Add new customer at the beginning
      cachedCustomers.unshift(updatedCustomer);
    }

    await this.cacheCustomers(cachedCustomers);

    // Dispatch update event
    window.dispatchEvent(new CustomEvent('customers-cache-updated', {
      detail: { customer: updatedCustomer, source: 'update' }
    }));
  }

  /**
   * Add a new customer to cache
   */
  async addCustomerToCache(newCustomer: CustomerListItem): Promise<void> {
    const cachedCustomers = await this.getCachedCustomers();
    const customers = cachedCustomers || [];

    // Check if customer already exists
    const exists = customers.some(c => c.id === newCustomer.id);
    if (!exists) {
      customers.unshift(newCustomer);
      await this.cacheCustomers(customers);
    }

    // Dispatch update event
    window.dispatchEvent(new CustomEvent('customers-cache-updated', {
      detail: { customer: newCustomer, source: 'create' }
    }));
  }

  /**
   * Remove a customer from cache
   */
  async removeCustomerFromCache(customerId: number): Promise<void> {
    const cachedCustomers = await this.getCachedCustomers();
    if (!cachedCustomers) return;

    const filteredCustomers = cachedCustomers.filter(c => c.id !== customerId);
    await this.cacheCustomers(filteredCustomers);

    // Dispatch update event
    window.dispatchEvent(new CustomEvent('customers-cache-updated', {
      detail: { customerId, source: 'delete' }
    }));
  }

  /**
   * Get a single customer from cache by ID
   */
  async getCustomerFromCache(customerId: number): Promise<CustomerListItem | null> {
    const cachedCustomers = await this.getCachedCustomers();
    if (!cachedCustomers) return null;

    return cachedCustomers.find(c => c.id === customerId) || null;
  }

  /**
   * Get customers from cache filtered by criteria
   */
  async getFilteredCustomersFromCache(filters: CustomerListFilters): Promise<CustomerListItem[]> {
    const cachedCustomers = await this.getCachedCustomers();
    console.log('[CustomerCacheService] getFilteredCustomersFromCache called with filters:', filters);
    console.log('[CustomerCacheService] cachedCustomers count:', cachedCustomers?.length || 0);
    
    if (!cachedCustomers) return [];

    let filtered = cachedCustomers.filter(customer => {
      // Filter by status
      if (filters.status && customer.status !== filters.status) {
        return false;
      }

      // Filter by search query
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const firstName = customer.first_name?.toLowerCase() || '';
        const lastName = customer.last_name?.toLowerCase() || '';
        const email = customer.email?.toLowerCase() || '';
        const phone = customer.phone?.toLowerCase() || '';
        const fullName = `${firstName} ${lastName}`;
        
        if (!firstName.includes(searchLower) && 
            !lastName.includes(searchLower) && 
            !fullName.includes(searchLower) &&
            !email.includes(searchLower) && 
            !phone.includes(searchLower)) {
          return false;
        }
      }

      return true;
    });

    // Apply sorting
    if (filters.sort_by) {
      filtered = this.sortCustomers(filtered, filters.sort_by, filters.sort_order || 'asc');
    }

    // Apply pagination
    if (filters.page && filters.per_page) {
      const start = (filters.page - 1) * filters.per_page;
      const end = start + filters.per_page;
      filtered = filtered.slice(start, end);
    }
    
    console.log('[CustomerCacheService] Filtered customers count:', filtered.length);
    return filtered;
  }

  /**
   * Sort customers by field
   */
  private sortCustomers(
    customers: CustomerListItem[], 
    sortBy: string, 
    sortOrder: 'asc' | 'desc'
  ): CustomerListItem[] {
    return [...customers].sort((a, b) => {
      let aValue: string | number;
      let bValue: string | number;

      switch (sortBy) {
        case 'first_name':
          aValue = a.first_name?.toLowerCase() || '';
          bValue = b.first_name?.toLowerCase() || '';
          break;
        case 'last_name':
          aValue = a.last_name?.toLowerCase() || '';
          bValue = b.last_name?.toLowerCase() || '';
          break;
        case 'email':
          aValue = a.email?.toLowerCase() || '';
          bValue = b.email?.toLowerCase() || '';
          break;
        case 'created_at':
          aValue = new Date(a.created_at).getTime();
          bValue = new Date(b.created_at).getTime();
          break;
        case 'last_visit':
          aValue = a.last_visit ? new Date(a.last_visit).getTime() : 0;
          bValue = b.last_visit ? new Date(b.last_visit).getTime() : 0;
          break;
        case 'total_spent':
          aValue = a.total_spent || 0;
          bValue = b.total_spent || 0;
          break;
        case 'total_bookings':
          aValue = a.total_bookings || 0;
          bValue = b.total_bookings || 0;
          break;
        default:
          aValue = a.first_name?.toLowerCase() || '';
          bValue = b.first_name?.toLowerCase() || '';
      }

      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }

  /**
   * Clear all customer cache data
   * Call this on user logout
   */
  async clearCache(): Promise<void> {
    if (!this.isCacheAvailable()) return;

    try {
      await caches.delete(CACHE_NAME);
      warmupCompleted = false;
      console.log('[CustomerCacheService] Cache cleared');
    } catch (error) {
      console.error('[CustomerCacheService] Error clearing cache:', error);
    }
  }

  /**
   * Warmup cache on app start / dashboard navigation
   * This should be called once per session to pre-populate the cache
   */
  async warmupCache(userId: number): Promise<void> {
    if (warmupCompleted) {
      console.log('[CustomerCacheService] Warmup already completed this session');
      return;
    }

    console.log('[CustomerCacheService] Starting cache warmup...');
    
    try {
      // Check if we have valid cache
      const metadata = await this.getCacheMetadata();
      const isStale = await this.isCacheStale(10); // Consider stale after 10 minutes for warmup

      if (metadata && !isStale) {
        console.log('[CustomerCacheService] Cache is fresh, skipping warmup');
        warmupCompleted = true;
        return;
      }

      // Fetch and cache customers
      await this.syncFromAPI(userId);
      warmupCompleted = true;
      console.log('[CustomerCacheService] Cache warmup completed');
    } catch (error) {
      console.error('[CustomerCacheService] Cache warmup failed:', error);
    }
  }

  /**
   * Get total count from cache
   */
  async getTotalCountFromCache(): Promise<number> {
    const metadata = await this.getCacheMetadata();
    return metadata?.totalRecords || 0;
  }

  /**
   * Reset warmup flag (for testing or when user context changes)
   */
  resetWarmup(): void {
    warmupCompleted = false;
  }
}

// Export singleton instance
export const customerCacheService = CustomerCacheService.getInstance();
export default customerCacheService;
