# Quick Package Fetching Reference Card

## Import Statement
```typescript
import { packageService } from '../services/PackageService';
```

## Common Patterns

### 1. Fetch All Packages (Paginated)
```typescript
const response = await packageService.getPackages({
  page: 1,
  per_page: 20
});
const packages = response.data.packages;
```

### 2. Fetch Single Package
```typescript
const response = await packageService.getPackage(packageId);
const package = response.data;
```

### 3. Fetch by Location
```typescript
const response = await packageService.getPackagesByLocation(locationId);
const packages = response.data; // Array
```

### 4. Fetch by Category
```typescript
const response = await packageService.getPackagesByCategory('adventure');
const packages = response.data; // Array
```

### 5. Search Packages
```typescript
const response = await packageService.getPackages({
  search: 'kayak',
  is_active: true
});
```

### 6. Complete Fetch Example with Error Handling
```typescript
const [packages, setPackages] = useState<Package[]>([]);
const [loading, setLoading] = useState(true);
const [error, setError] = useState<string | null>(null);

useEffect(() => {
  const fetchPackages = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await packageService.getPackages({
        is_active: true,
        sort_by: 'name',
        sort_order: 'asc',
        per_page: 50
      });
      
      setPackages(response.data.packages);
    } catch (err) {
      console.error('Error fetching packages:', err);
      setError('Failed to load packages');
    } finally {
      setLoading(false);
    }
  };

  fetchPackages();
}, []);
```

## Data Transformation Examples

### Transform API Package to Component Format
```typescript
// API format to your component format
const transformPackage = (apiPackage: Package) => {
  return {
    id: apiPackage.id.toString(),
    name: apiPackage.name,
    description: apiPackage.description,
    price: apiPackage.price,
    duration: apiPackage.duration,
    durationUnit: apiPackage.duration_unit,
    maxParticipants: apiPackage.max_participants,
    images: apiPackage.image 
      ? (Array.isArray(apiPackage.image) 
          ? apiPackage.image.map(img => ASSET_URL + img) 
          : [ASSET_URL + apiPackage.image])
      : [],
    isActive: apiPackage.is_active,
    location: apiPackage.location?.name || '',
    attractions: apiPackage.attractions || [],
    addOns: apiPackage.add_ons || [],
    rooms: apiPackage.rooms || [],
  };
};

// Usage
const response = await packageService.getPackages();
const transformed = response.data.packages.map(transformPackage);
```

### Extract Room IDs
```typescript
const package = await packageService.getPackage(packageId);
const roomIds = package.data.rooms?.map(room => room.id) || [];
```

### Calculate Total with Add-ons
```typescript
const calculateTotal = (package: Package, selectedAddOnIds: number[]) => {
  let total = package.price;
  
  package.add_ons?.forEach(addon => {
    if (selectedAddOnIds.includes(addon.id)) {
      total += addon.price;
    }
  });
  
  return total;
};
```

## Useful Filters

### Active Packages Only
```typescript
{ is_active: true }
```

### By Location
```typescript
{ location_id: 1 }
```

### By Category with Search
```typescript
{ 
  category: 'adventure', 
  search: 'zip', 
  is_active: true 
}
```

### Sorted by Price (Low to High)
```typescript
{ 
  sort_by: 'price', 
  sort_order: 'asc' 
}
```

### Recent Packages First
```typescript
{ 
  sort_by: 'created_at', 
  sort_order: 'desc' 
}
```

## Image Display Helper
```typescript
import { ASSET_URL } from '../utils/storage';

const getPackageImage = (package: Package) => {
  if (!package.image) return '/placeholder.jpg';
  
  const imageUrl = Array.isArray(package.image) 
    ? package.image[0] 
    : package.image;
    
  return ASSET_URL + imageUrl;
};

// Usage in JSX
<img src={getPackageImage(package)} alt={package.name} />
```

## Common useState Patterns

### Basic Package State
```typescript
const [packages, setPackages] = useState<Package[]>([]);
const [loading, setLoading] = useState(true);
```

### With Pagination
```typescript
const [packages, setPackages] = useState<Package[]>([]);
const [currentPage, setCurrentPage] = useState(1);
const [totalPages, setTotalPages] = useState(1);
const [totalItems, setTotalItems] = useState(0);
```

### With Filters
```typescript
const [packages, setPackages] = useState<Package[]>([]);
const [filters, setFilters] = useState({
  search: '',
  category: '',
  locationId: undefined as number | undefined,
});
```

## Response Structures

### Paginated Response (getPackages)
```typescript
{
  success: true,
  data: {
    packages: Package[],
    pagination: {
      current_page: number,
      last_page: number,
      per_page: number,
      total: number,
      from: number,
      to: number
    }
  }
}
```

### Single Item Response (getPackage)
```typescript
{
  success: true,
  data: Package
}
```

### Array Response (getByLocation, getByCategory)
```typescript
{
  success: true,
  data: Package[]
}
```

## Quick Tips

1. **Always use try-catch** for async calls
2. **Check response.data.packages** for paginated responses
3. **Check response.data** for single/array responses
4. **Use ASSET_URL** for images
5. **Handle loading/error states**
6. **Location-based filtering** is automatic for non-admin users
7. **Max 100 items** per page
8. **Search requires 2+ characters** in backend

## See Full Documentation
- `FETCH_PACKAGES_REFERENCE.md` - Complete guide with examples
- `PackageService.ts` - Service implementation
