# Package Service Documentation Summary

## 📚 Documentation Files Created

### 1. **FETCH_PACKAGES_REFERENCE.md** (Complete Guide)
**Purpose:** Comprehensive guide with detailed examples and best practices

**Contents:**
- All 13 service methods with full examples
- Complete React component example
- Authentication and authorization details
- Image handling
- Error handling patterns
- Role-based access control
- Best practices and tips

**Use When:** You need detailed information about how to use the package service

---

### 2. **PACKAGE_FETCH_QUICK_REF.md** (Quick Reference)
**Purpose:** Fast lookup for common patterns and snippets

**Contents:**
- Import statements
- 6 most common fetch patterns
- Data transformation examples
- Useful filter combinations
- useState patterns
- Response structures
- Quick tips

**Use When:** You know what you want to do and just need a quick code snippet

---

### 3. **LARAVEL_PACKAGE_CONTROLLER_MAPPING.md** (Backend Mapping)
**Purpose:** Direct mapping between Laravel backend and TypeScript frontend

**Contents:**
- Side-by-side code comparison for all 13 methods
- Backend route → Frontend method mapping
- Request/response structures
- Authentication flow
- Role-based filtering explanation
- Image handling on both sides
- Quick reference table

**Use When:** You need to understand how backend APIs map to frontend service calls

---

## 🚀 Quick Start

### Step 1: Import the Service
```typescript
import { packageService } from '../services/PackageService';
```

### Step 2: Fetch Packages
```typescript
const response = await packageService.getPackages({
  is_active: true,
  per_page: 20
});
const packages = response.data.packages;
```

### Step 3: Display Images
```typescript
import { ASSET_URL } from '../utils/storage';

<img src={ASSET_URL + package.image[0]} alt={package.name} />
```

---

## 📖 Service Overview

### PackageService Location
`src/services/PackageService.ts`

### Key Features
✅ **Authentication:** JWT token auto-injection  
✅ **Type Safety:** Full TypeScript support  
✅ **Role-Based Access:** Automatic filtering by user role  
✅ **Pagination:** Built-in pagination support  
✅ **Search & Filter:** Multiple filter options  
✅ **Relationships:** Includes location, attractions, add-ons, rooms  
✅ **Image Handling:** Base64 upload and display support  
✅ **Error Handling:** Proper error responses  

---

## 🎯 Common Use Cases

### Use Case 1: Display Package List
**Documentation:** FETCH_PACKAGES_REFERENCE.md → "Complete React Component Example"  
**Quick Reference:** PACKAGE_FETCH_QUICK_REF.md → "Complete Fetch Example"

```typescript
const [packages, setPackages] = useState<Package[]>([]);
const [loading, setLoading] = useState(true);

useEffect(() => {
  const fetchPackages = async () => {
    try {
      const response = await packageService.getPackages();
      setPackages(response.data.packages);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };
  fetchPackages();
}, []);
```

---

### Use Case 2: Get Package Details
**Documentation:** FETCH_PACKAGES_REFERENCE.md → "Get Single Package by ID"  
**Quick Reference:** PACKAGE_FETCH_QUICK_REF.md → "Fetch Single Package"

```typescript
const fetchPackageDetails = async (packageId: number) => {
  const response = await packageService.getPackage(packageId);
  const package = response.data;
  
  // Access all relationships
  console.log('Attractions:', package.attractions);
  console.log('Add-ons:', package.add_ons);
  console.log('Rooms:', package.rooms);
  
  return package;
};
```

---

### Use Case 3: Filter by Location
**Documentation:** FETCH_PACKAGES_REFERENCE.md → "Get Packages by Location"  
**Quick Reference:** PACKAGE_FETCH_QUICK_REF.md → "Fetch by Location"

```typescript
const fetchLocationPackages = async (locationId: number) => {
  const response = await packageService.getPackagesByLocation(locationId);
  return response.data; // Array of packages
};
```

---

### Use Case 4: Search Packages
**Documentation:** FETCH_PACKAGES_REFERENCE.md → "Get All Packages" → "With filters"  
**Quick Reference:** PACKAGE_FETCH_QUICK_REF.md → "Search Packages"

```typescript
const searchPackages = async (searchQuery: string) => {
  const response = await packageService.getPackages({
    search: searchQuery,
    is_active: true,
    sort_by: 'name',
    sort_order: 'asc'
  });
  
  return response.data.packages;
};
```

---

### Use Case 5: Create Booking with Package
**Documentation:** FETCH_PACKAGE_BOOKING_EXAMPLE.md  
**Related:** BOOKING_SERVICE_USAGE.md

```typescript
// 1. Fetch package
const packageResponse = await packageService.getPackage(packageId);
const package = packageResponse.data;

// 2. Create booking
const bookingData = {
  booking_type: 'package',
  package_id: package.id,
  customer_email: 'customer@example.com',
  guest_name: 'John Doe',
  guest_count: 4,
  booking_date: '2024-12-15',
  start_time: '10:00:00',
  payment_method: 'credit'
};

const bookingResponse = await bookingService.createBooking(bookingData);
```

---

## 🔑 Key Concepts

### Response Types

**Paginated Response** (from `getPackages`)
```typescript
{
  success: true,
  data: {
    packages: Package[],
    pagination: {
      current_page: 1,
      last_page: 5,
      per_page: 20,
      total: 95
    }
  }
}
```

**Single Item Response** (from `getPackage`)
```typescript
{
  success: true,
  data: Package
}
```

**Array Response** (from `getPackagesByLocation`, `getPackagesByCategory`)
```typescript
{
  success: true,
  data: Package[]
}
```

### Package Type Structure
```typescript
interface Package {
  id: number;
  location_id: number;
  name: string;
  description: string;
  category: string;
  price: number;
  max_participants: number;
  duration: number;
  duration_unit: 'hours' | 'minutes';
  is_active: boolean;
  image?: string | string[];
  
  // Relationships (optional)
  location?: Location;
  attractions?: Attraction[];
  add_ons?: AddOn[];
  rooms?: Room[];
  gift_cards?: GiftCard[];
  promos?: Promo[];
}
```

---

## 🛠️ Service Methods

### Data Retrieval (Read Operations)
1. `getPackages(filters?)` - Get all packages with pagination
2. `getPackage(id)` - Get single package by ID
3. `getPackagesByLocation(locationId)` - Get packages for specific location
4. `getPackagesByCategory(category)` - Get packages by category

### Data Modification (Write Operations)
5. `createPackage(data)` - Create new package
6. `updatePackage(id, data)` - Update existing package
7. `deletePackage(id)` - Delete package
8. `toggleStatus(id)` - Toggle active/inactive status

### Relationship Management
9. `attachAttractions(id, attractionIds)` - Add attractions to package
10. `detachAttractions(id, attractionIds)` - Remove attractions from package
11. `attachAddOns(id, addonIds)` - Add add-ons to package
12. `detachAddOns(id, addonIds)` - Remove add-ons from package

### Bulk Operations
13. `bulkImport(packages)` - Import multiple packages at once

---

## 🎨 Image Handling

### Display Package Image
```typescript
import { ASSET_URL } from '../utils/storage';

const getPackageImageUrl = (package: Package) => {
  if (!package.image) return '/placeholder.jpg';
  
  const imageUrl = Array.isArray(package.image) 
    ? package.image[0]  // Get first image
    : package.image;
    
  return ASSET_URL + imageUrl;
};

// In JSX
<img 
  src={getPackageImageUrl(package)} 
  alt={package.name}
  className="w-full h-48 object-cover"
/>
```

### Upload Image (Base64)
```typescript
const createPackageWithImage = async (imageBase64: string) => {
  await packageService.createPackage({
    // ... other fields
    image: [imageBase64], // Array of base64 strings
  });
};
```

---

## 🔐 Authentication & Authorization

### Automatic Token Injection
The service automatically includes JWT token from localStorage:
```typescript
// No manual token handling needed!
const response = await packageService.getPackages();
```

### Role-Based Access

**Company Admin:**
- Sees all packages from their company's locations
- Can manage any package in their company

**Location Manager/Staff:**
- Only sees packages from their assigned location
- Can only manage their location's packages

**Public/Guest:**
- Must filter by location_id
- Only sees active packages

---

## 📊 Pagination Example

```typescript
const [packages, setPackages] = useState<Package[]>([]);
const [currentPage, setCurrentPage] = useState(1);
const [totalPages, setTotalPages] = useState(1);

const loadPage = async (page: number) => {
  const response = await packageService.getPackages({
    page,
    per_page: 20,
    is_active: true
  });
  
  setPackages(response.data.packages);
  setCurrentPage(response.data.pagination.current_page);
  setTotalPages(response.data.pagination.last_page);
};

// Load next page
const nextPage = () => {
  if (currentPage < totalPages) {
    loadPage(currentPage + 1);
  }
};
```

---

## 🐛 Error Handling

```typescript
try {
  const response = await packageService.getPackages();
  // Success
} catch (error) {
  if (axios.isAxiosError(error)) {
    switch (error.response?.status) {
      case 401:
        console.error('Unauthorized - please login');
        break;
      case 403:
        console.error('Forbidden - insufficient permissions');
        break;
      case 404:
        console.error('Package not found');
        break;
      default:
        console.error('API Error:', error.response?.data?.message);
    }
  } else {
    console.error('Unexpected error:', error);
  }
}
```

---

## 📱 Related Services

- **BookingService** (`src/services/bookingService.ts`)
  - Use for creating package bookings
  - See: `BOOKING_SERVICE_USAGE.md`

- **AttractionService** (`src/services/AttractionService.ts`)
  - Use for managing attractions that can be part of packages

- **CustomerService** (`src/services/CustomerService.ts`)
  - Use for customer management in package bookings

---

## ✅ Best Practices

1. **Always handle loading states** when fetching data
2. **Use try-catch blocks** for all async operations
3. **Check response structure** before accessing data
4. **Use ASSET_URL** for all image displays
5. **Implement pagination** for large datasets
6. **Cache data** when appropriate to reduce API calls
7. **Validate permissions** on frontend (backend enforces)
8. **Handle empty states** gracefully
9. **Provide user feedback** on errors
10. **Reload data** after mutations

---

## 🎯 Which Documentation to Use?

### I need to understand how to use a specific method
→ **FETCH_PACKAGES_REFERENCE.md**

### I just need a quick code snippet
→ **PACKAGE_FETCH_QUICK_REF.md**

### I want to see how backend APIs map to frontend
→ **LARAVEL_PACKAGE_CONTROLLER_MAPPING.md**

### I need to create a booking with a package
→ **FETCH_PACKAGE_BOOKING_EXAMPLE.md**

### I want to understand booking service methods
→ **BOOKING_SERVICE_USAGE.md**

---

## 📞 Support

For issues or questions:
1. Check the relevant documentation file
2. Review the TypeScript types in `PackageService.ts`
3. Check the Laravel controller: `app/Http/Controllers/Api/PackageController.php`
4. Review existing implementations in the codebase

---

**Last Updated:** November 2025  
**Service Version:** 1.0  
**Backend API Version:** Laravel 11
