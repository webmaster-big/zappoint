# Package Service Reference Guide

## Overview
Complete guide for fetching and managing packages using the PackageService. This service is fully integrated with the Laravel backend API and includes authentication handling.

## Service Location
`src/services/PackageService.ts`

## API Endpoints Reference (Laravel Backend)

### Package Controller Endpoints
```
GET    /api/packages                        - List all packages (with filters)
POST   /api/packages                        - Create new package
GET    /api/packages/{id}                   - Get specific package
PUT    /api/packages/{id}                   - Update package
DELETE /api/packages/{id}                   - Delete package
GET    /api/packages/location/{locationId}  - Get packages by location
GET    /api/packages/category/{category}    - Get packages by category
PATCH  /api/packages/{id}/toggle-status     - Toggle active status
POST   /api/packages/{id}/attractions/attach   - Attach attractions
POST   /api/packages/{id}/attractions/detach   - Detach attractions
POST   /api/packages/{id}/addons/attach        - Attach add-ons
POST   /api/packages/{id}/addons/detach        - Detach add-ons
POST   /api/packages/bulk-import            - Bulk import packages
```

## Available Methods

### 1. Get All Packages (with Filters & Pagination)

**Method:** `getPackages(filters?: PackageFilters)`

**Backend Behavior:**
- Role-based filtering (company_admin sees all company packages, others see location-specific)
- Supports pagination, search, sorting, and category filtering
- Returns packages with related data (location, attractions, add-ons, rooms)

**Usage Example:**
```typescript
import { packageService } from '../services/PackageService';

// Basic fetch - all packages
const fetchAllPackages = async () => {
  try {
    const response = await packageService.getPackages();
    console.log('Packages:', response.data.packages);
    console.log('Pagination:', response.data.pagination);
  } catch (error) {
    console.error('Error fetching packages:', error);
  }
};

// With filters
const fetchFilteredPackages = async () => {
  try {
    const response = await packageService.getPackages({
      location_id: 1,           // Filter by location
      category: 'adventure',    // Filter by category
      search: 'kayak',          // Search in name/description
      is_active: true,          // Only active packages
      sort_by: 'price',         // Sort by price
      sort_order: 'asc',        // Ascending order
      per_page: 20,             // Items per page (max 100)
      page: 1,                  // Page number
    });
    
    const packages = response.data.packages;
    const pagination = response.data.pagination;
    
    console.log(`Found ${pagination.total} packages`);
    console.log(`Page ${pagination.current_page} of ${pagination.last_page}`);
  } catch (error) {
    console.error('Error:', error);
  }
};
```

**Response Format:**
```typescript
{
  success: true,
  data: {
    packages: [
      {
        id: 1,
        location_id: 1,
        name: "Adventure Package",
        description: "Thrilling outdoor activities",
        category: "adventure",
        price: 99.99,
        max_participants: 10,
        duration: 4,
        duration_unit: "hours",
        is_active: true,
        image: ["images/packages/abc123.jpg"],
        location: {
          id: 1,
          name: "Downtown Location",
          address: "123 Main St",
          city: "Seattle",
          state: "WA"
        },
        attractions: [
          { id: 5, name: "Zip Line", price: 30 }
        ],
        add_ons: [
          { id: 2, name: "Photo Package", price: 15 }
        ],
        rooms: [
          { id: 1, name: "Party Room A", capacity: 15 }
        ],
        gift_cards: [],
        promos: []
      }
    ],
    pagination: {
      current_page: 1,
      last_page: 3,
      per_page: 15,
      total: 42,
      from: 1,
      to: 15
    }
  }
}
```

### 2. Get Single Package by ID

**Method:** `getPackage(id: number)`

**Backend Behavior:**
- Checks user authorization (company_admin or location-based access)
- Returns package with all relationships loaded
- Returns 403 if unauthorized

**Usage Example:**
```typescript
const fetchSinglePackage = async (packageId: number) => {
  try {
    const response = await packageService.getPackage(packageId);
    const pkg = response.data;
    
    console.log('Package:', pkg.name);
    console.log('Price:', pkg.price);
    console.log('Attractions:', pkg.attractions?.length || 0);
    console.log('Rooms:', pkg.rooms?.length || 0);
    
    return pkg;
  } catch (error) {
    console.error('Error fetching package:', error);
    throw error;
  }
};
```

### 3. Get Packages by Location

**Method:** `getPackagesByLocation(locationId: number)`

**Backend Behavior:**
- Returns active packages for specific location
- Includes all relationships
- Authorization check for company_admin and staff

**Usage Example:**
```typescript
const fetchLocationPackages = async (locationId: number) => {
  try {
    const response = await packageService.getPackagesByLocation(locationId);
    const packages = response.data; // Array of packages
    
    console.log(`Found ${packages.length} packages at this location`);
    
    return packages;
  } catch (error) {
    console.error('Error fetching location packages:', error);
    return [];
  }
};
```

### 4. Get Packages by Category

**Method:** `getPackagesByCategory(category: string)`

**Backend Behavior:**
- Returns active packages in specific category
- Filtered by user's accessible locations
- Sorted by name

**Usage Example:**
```typescript
const fetchCategoryPackages = async (category: string) => {
  try {
    const response = await packageService.getPackagesByCategory(category);
    const packages = response.data;
    
    return packages;
  } catch (error) {
    console.error('Error fetching category packages:', error);
    return [];
  }
};

// Common categories
const adventurePackages = await fetchCategoryPackages('adventure');
const familyPackages = await fetchCategoryPackages('family');
const groupPackages = await fetchCategoryPackages('group');
```

### 5. Create New Package

**Method:** `createPackage(data: CreatePackageData)`

**Backend Behavior:**
- Handles image uploads (base64 or file)
- Creates package with relationships (attractions, add-ons, rooms, etc.)
- Sets location_id based on user role
- Returns created package with all relationships

**Usage Example:**
```typescript
const createNewPackage = async () => {
  try {
    const response = await packageService.createPackage({
      location_id: 1,
      name: "Summer Adventure Pack",
      description: "Perfect for summer fun!",
      category: "adventure",
      features: "Zip line, kayaking, picnic",
      price: 149.99,
      max_participants: 12,
      duration: 6,
      duration_unit: "hours",
      availability_type: "daily",
      is_active: true,
      // Optional: will be set automatically
      // attraction_ids: [1, 2, 3],
      // addon_ids: [1],
      // room_ids: [2]
    });
    
    console.log('Package created:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error creating package:', error);
    throw error;
  }
};
```

### 6. Update Package

**Method:** `updatePackage(id: number, data: UpdatePackageData)`

**Backend Behavior:**
- Authorization check
- Updates package and relationships
- Handles image replacements
- Syncs relationships (attractions, add-ons, etc.)

**Usage Example:**
```typescript
const updateExistingPackage = async (packageId: number) => {
  try {
    const response = await packageService.updatePackage(packageId, {
      price: 159.99,           // Update price
      max_participants: 15,    // Update capacity
      description: "Updated description",
      // Partial update - only send what changed
    });
    
    console.log('Package updated:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error updating package:', error);
    throw error;
  }
};
```

### 7. Toggle Package Status

**Method:** `toggleStatus(id: number)`

**Backend Behavior:**
- Toggles is_active status
- Authorization check

**Usage Example:**
```typescript
const togglePackageStatus = async (packageId: number) => {
  try {
    const response = await packageService.toggleStatus(packageId);
    const updatedPackage = response.data;
    
    console.log(`Package is now ${updatedPackage.is_active ? 'active' : 'inactive'}`);
    return updatedPackage;
  } catch (error) {
    console.error('Error toggling status:', error);
    throw error;
  }
};
```

### 8. Manage Attractions

**Methods:** 
- `attachAttractions(id: number, attractionIds: number[])`
- `detachAttractions(id: number, attractionIds: number[])`

**Usage Example:**
```typescript
// Attach attractions to package
const addAttractions = async (packageId: number) => {
  try {
    await packageService.attachAttractions(packageId, [5, 6, 7]);
    console.log('Attractions attached successfully');
  } catch (error) {
    console.error('Error attaching attractions:', error);
  }
};

// Remove attractions from package
const removeAttractions = async (packageId: number) => {
  try {
    await packageService.detachAttractions(packageId, [5]);
    console.log('Attractions removed successfully');
  } catch (error) {
    console.error('Error detaching attractions:', error);
  }
};
```

### 9. Manage Add-ons

**Methods:**
- `attachAddOns(id: number, addonIds: number[])`
- `detachAddOns(id: number, addonIds: number[])`

**Usage Example:**
```typescript
// Attach add-ons
const addAddOns = async (packageId: number) => {
  try {
    await packageService.attachAddOns(packageId, [1, 2, 3]);
    console.log('Add-ons attached successfully');
  } catch (error) {
    console.error('Error:', error);
  }
};

// Remove add-ons
const removeAddOns = async (packageId: number) => {
  try {
    await packageService.detachAddOns(packageId, [1]);
    console.log('Add-ons removed successfully');
  } catch (error) {
    console.error('Error:', error);
  }
};
```

## Complete React Component Example

```typescript
import React, { useState, useEffect } from 'react';
import { packageService, type Package } from '../services/PackageService';
import { ASSET_URL } from '../utils/storage';

const PackageList: React.FC = () => {
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');

  // Fetch packages
  const loadPackages = async () => {
    try {
      setLoading(true);
      const response = await packageService.getPackages({
        search: searchQuery,
        category: selectedCategory || undefined,
        page: currentPage,
        per_page: 12,
        sort_by: 'name',
        sort_order: 'asc',
      });

      setPackages(response.data.packages);
      setTotalPages(response.data.pagination.last_page);
    } catch (error) {
      console.error('Error loading packages:', error);
    } finally {
      setLoading(false);
    }
  };

  // Load on mount and when filters change
  useEffect(() => {
    loadPackages();
  }, [currentPage, searchQuery, selectedCategory]);

  // Handle package status toggle
  const handleToggleStatus = async (packageId: number) => {
    try {
      await packageService.toggleStatus(packageId);
      // Reload packages to get updated status
      loadPackages();
    } catch (error) {
      console.error('Error toggling status:', error);
    }
  };

  if (loading) {
    return <div>Loading packages...</div>;
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Packages</h1>

      {/* Search & Filter */}
      <div className="mb-6 flex gap-4">
        <input
          type="text"
          placeholder="Search packages..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="px-4 py-2 border rounded-lg"
        />
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="px-4 py-2 border rounded-lg"
        >
          <option value="">All Categories</option>
          <option value="adventure">Adventure</option>
          <option value="family">Family</option>
          <option value="group">Group</option>
        </select>
      </div>

      {/* Package Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {packages.map((pkg) => (
          <div key={pkg.id} className="border rounded-lg p-4 shadow-sm">
            {/* Package Image */}
            {pkg.image && (
              <img
                src={ASSET_URL + (Array.isArray(pkg.image) ? pkg.image[0] : pkg.image)}
                alt={pkg.name}
                className="w-full h-48 object-cover rounded-lg mb-4"
              />
            )}

            {/* Package Info */}
            <h3 className="font-semibold text-lg mb-2">{pkg.name}</h3>
            <p className="text-gray-600 text-sm mb-4">{pkg.description}</p>
            
            <div className="mb-4">
              <p className="text-2xl font-bold text-blue-600">${pkg.price}</p>
              <p className="text-sm text-gray-500">
                {pkg.duration} {pkg.duration_unit} • Max {pkg.max_participants} guests
              </p>
            </div>

            {/* Attractions & Add-ons */}
            {pkg.attractions && pkg.attractions.length > 0 && (
              <p className="text-xs text-gray-500 mb-2">
                {pkg.attractions.length} Attractions included
              </p>
            )}

            {/* Status Toggle */}
            <button
              onClick={() => handleToggleStatus(pkg.id)}
              className={`w-full py-2 rounded-lg text-sm font-medium ${
                pkg.is_active
                  ? 'bg-green-100 text-green-700'
                  : 'bg-gray-100 text-gray-700'
              }`}
            >
              {pkg.is_active ? 'Active' : 'Inactive'}
            </button>
          </div>
        ))}
      </div>

      {/* Pagination */}
      <div className="mt-8 flex justify-center gap-2">
        <button
          onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
          disabled={currentPage === 1}
          className="px-4 py-2 border rounded-lg disabled:opacity-50"
        >
          Previous
        </button>
        <span className="px-4 py-2">
          Page {currentPage} of {totalPages}
        </span>
        <button
          onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
          disabled={currentPage === totalPages}
          className="px-4 py-2 border rounded-lg disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  );
};

export default PackageList;
```

## Key Features

### Authentication
- Automatic JWT token injection via axios interceptor
- Token stored in localStorage
- All requests authenticated automatically

### Role-Based Access
- **Company Admin**: Can see all packages from their company's locations
- **Location Manager/Staff**: Can only see packages from their location
- **Public Access**: Can filter by location_id parameter

### Image Handling
- Backend supports base64 image upload
- Multiple images per package (array)
- Images stored in `/public/images/packages/`
- Frontend uses ASSET_URL for image display

### Pagination
- Default: 15 items per page
- Maximum: 100 items per page
- Returns full pagination metadata

### Filtering & Sorting
- Search by name or description
- Filter by category, location, active status
- Sort by name, price, created_at, category
- Ascending or descending order

## Error Handling

```typescript
try {
  const response = await packageService.getPackages();
  // Handle success
} catch (error) {
  if (axios.isAxiosError(error)) {
    if (error.response?.status === 403) {
      console.error('Unauthorized access');
    } else if (error.response?.status === 404) {
      console.error('Package not found');
    } else {
      console.error('API Error:', error.response?.data?.message);
    }
  } else {
    console.error('Unexpected error:', error);
  }
}
```

## Best Practices

1. **Always handle loading states** when fetching packages
2. **Use pagination** for large datasets
3. **Implement error handling** with user-friendly messages
4. **Cache package data** when appropriate
5. **Reload data** after mutations (create, update, delete)
6. **Use ASSET_URL** for image paths
7. **Handle empty states** gracefully
8. **Validate user permissions** on frontend
9. **Use TypeScript types** for type safety
10. **Debounce search inputs** to reduce API calls

## Related Documentation
- `BOOKING_SERVICE_USAGE.md` - Booking service reference
- `FETCH_PACKAGE_BOOKING_EXAMPLE.md` - Package booking examples
- `TYPE_MAPPING.md` - Type definitions mapping
