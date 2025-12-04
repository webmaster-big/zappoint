# 🚀 Package Fetching - 30 Second Guide

## Import
```typescript
import { packageService } from '../services/PackageService';
```

## Common Tasks

### 📋 Get All Packages
```typescript
const response = await packageService.getPackages();
const packages = response.data.packages;
```

### 🔍 Get One Package
```typescript
const response = await packageService.getPackage(5);
const package = response.data;
```

### 📍 Filter by Location
```typescript
const response = await packageService.getPackagesByLocation(1);
const packages = response.data;
```

### 🏷️ Filter by Category
```typescript
const response = await packageService.getPackagesByCategory('adventure');
const packages = response.data;
```

### 🔎 Search
```typescript
const response = await packageService.getPackages({ 
  search: 'kayak' 
});
```

## Display Image
```typescript
import { ASSET_URL } from '../utils/storage';

<img src={ASSET_URL + package.image[0]} alt={package.name} />
```

## Handle Errors
```typescript
try {
  const response = await packageService.getPackages();
} catch (error) {
  console.error('Failed to load packages:', error);
}
```

## Need More Details?

| Task | Documentation |
|------|---------------|
| Full examples | **FETCH_PACKAGES_REFERENCE.md** |
| Quick snippets | **PACKAGE_FETCH_QUICK_REF.md** |
| Backend mapping | **LARAVEL_PACKAGE_CONTROLLER_MAPPING.md** |
| Overview | **PACKAGE_SERVICE_DOCS_INDEX.md** |

## Response Types

**List (paginated):**
```typescript
response.data.packages // Array
response.data.pagination // Pagination info
```

**Single item:**
```typescript
response.data // Package object
```

**Location/Category (array):**
```typescript
response.data // Array of packages
```

---

**That's it! You're ready to fetch packages! 🎉**
