# Laravel Package Controller ↔️ TypeScript Service Mapping

## Complete Method Mapping Reference

This document shows the direct mapping between Laravel backend methods and TypeScript frontend service methods.

---

## 1. Index / Get All Packages

### Laravel (Backend)
```php
// Route: GET /api/packages
public function index(Request $request): JsonResponse
{
    $query = Package::with(['location', 'attractions', 'addOns', 'rooms']);
    
    // Role-based filtering, pagination, search, sort
    $packages = $query->paginate($perPage);
    
    return response()->json([
        'success' => true,
        'data' => [
            'packages' => PackageResource::collection($packages),
            'pagination' => [...]
        ]
    ]);
}
```

### TypeScript (Frontend)
```typescript
async getPackages(filters?: PackageFilters): Promise<PaginatedResponse<Package>> {
  const response = await api.get('/packages', { params: filters });
  return response.data;
}

// Usage
const response = await packageService.getPackages({
  page: 1,
  per_page: 20,
  search: 'adventure',
  category: 'family',
  location_id: 1,
  sort_by: 'price',
  sort_order: 'asc'
});
```

**Response Structure:**
```typescript
{
  success: true,
  data: {
    packages: Package[],
    pagination: {
      current_page: 1,
      last_page: 5,
      per_page: 20,
      total: 95,
      from: 1,
      to: 20
    }
  }
}
```

---

## 2. Show / Get Single Package

### Laravel (Backend)
```php
// Route: GET /api/packages/{id}
public function show(Request $request, Package $package): JsonResponse
{
    // Authorization check
    $package->load(['location', 'attractions', 'addOns', 'rooms', 'giftCards', 'promos']);
    
    return response()->json([
        'success' => true,
        'data' => new PackageResource($package)
    ]);
}
```

### TypeScript (Frontend)
```typescript
async getPackage(id: number): Promise<ApiResponse<Package>> {
  const response = await api.get(`/packages/${id}`);
  return response.data;
}

// Usage
const response = await packageService.getPackage(5);
const package = response.data;
```

**Response Structure:**
```typescript
{
  success: true,
  data: {
    id: 5,
    name: "Adventure Package",
    description: "...",
    price: 99.99,
    location: { id: 1, name: "Downtown" },
    attractions: [{ id: 3, name: "Zip Line" }],
    add_ons: [{ id: 1, name: "Photos" }],
    rooms: [{ id: 2, name: "Party Room" }],
    // ... other fields
  }
}
```

---

## 3. Store / Create Package

### Laravel (Backend)
```php
// Route: POST /api/packages
public function store(StorePackageRequest $request): JsonResponse
{
    $validated = $request->validated();
    
    // Handle image upload
    // Set location_id based on role
    $package = Package::create($validated);
    
    // Handle attraction_ids, addon_ids, room_ids, etc.
    
    return response()->json([
        'success' => true,
        'message' => 'Package created successfully',
        'data' => new PackageResource($package)
    ], 201);
}
```

### TypeScript (Frontend)
```typescript
async createPackage(data: CreatePackageData): Promise<ApiResponse<Package>> {
  const response = await api.post('/packages', data);
  return response.data;
}

// Usage
const response = await packageService.createPackage({
  location_id: 1,
  name: "New Package",
  description: "Great package!",
  category: "adventure",
  price: 149.99,
  max_participants: 10,
  duration: 4,
  duration_unit: "hours",
  availability_type: "daily",
  is_active: true
});
```

---

## 4. Update Package

### Laravel (Backend)
```php
// Route: PUT /api/packages/{id}
public function update(UpdatePackageRequest $request, Package $package): JsonResponse
{
    // Authorization check
    // Handle image updates
    $package->update($validated);
    
    // Sync relationships
    
    return response()->json([
        'success' => true,
        'message' => 'Package updated successfully',
        'data' => new PackageResource($package)
    ]);
}
```

### TypeScript (Frontend)
```typescript
async updatePackage(id: number, data: UpdatePackageData): Promise<ApiResponse<Package>> {
  const response = await api.put(`/packages/${id}`, data);
  return response.data;
}

// Usage
const response = await packageService.updatePackage(5, {
  price: 159.99,
  max_participants: 12,
  description: "Updated description"
});
```

---

## 5. Destroy / Delete Package

### Laravel (Backend)
```php
// Route: DELETE /api/packages/{id}
public function destroy(Request $request, Package $package): JsonResponse
{
    // Authorization check
    // Delete associated images
    $package->delete();
    
    return response()->json([
        'success' => true,
        'message' => 'Package deleted successfully'
    ]);
}
```

### TypeScript (Frontend)
```typescript
async deletePackage(id: number): Promise<ApiResponse<null>> {
  const response = await api.delete(`/packages/${id}`);
  return response.data;
}

// Usage
await packageService.deletePackage(5);
```

---

## 6. Get by Location

### Laravel (Backend)
```php
// Route: GET /api/packages/location/{locationId}
public function getByLocation(Request $request, int $locationId): JsonResponse
{
    // Authorization check
    $packages = Package::with(['attractions', 'addOns', 'rooms'])
        ->byLocation($locationId)
        ->active()
        ->orderBy('name')
        ->get();
    
    return response()->json([
        'success' => true,
        'data' => PackageResource::collection($packages)
    ]);
}
```

### TypeScript (Frontend)
```typescript
async getPackagesByLocation(locationId: number): Promise<ApiResponse<Package[]>> {
  const response = await api.get(`/packages/location/${locationId}`);
  return response.data;
}

// Usage
const response = await packageService.getPackagesByLocation(1);
const packages = response.data; // Array of Package
```

---

## 7. Get by Category

### Laravel (Backend)
```php
// Route: GET /api/packages/category/{category}
public function getByCategory(Request $request, string $category): JsonResponse
{
    $packages = Package::with(['location', 'attractions', 'addOns', 'rooms'])
        ->byCategory($category)
        ->active()
        // Filter by user's accessible locations
        ->orderBy('name')
        ->get();
    
    return response()->json([
        'success' => true,
        'data' => PackageResource::collection($packages)
    ]);
}
```

### TypeScript (Frontend)
```typescript
async getPackagesByCategory(category: string): Promise<ApiResponse<Package[]>> {
  const response = await api.get(`/packages/category/${category}`);
  return response.data;
}

// Usage
const response = await packageService.getPackagesByCategory('adventure');
const packages = response.data; // Array
```

---

## 8. Toggle Status

### Laravel (Backend)
```php
// Route: PATCH /api/packages/{id}/toggle-status
public function toggleStatus(Request $request, Package $package): JsonResponse
{
    // Authorization check
    $package->update(['is_active' => !$package->is_active]);
    
    return response()->json([
        'success' => true,
        'message' => 'Package status updated successfully',
        'data' => new PackageResource($package)
    ]);
}
```

### TypeScript (Frontend)
```typescript
async toggleStatus(id: number): Promise<ApiResponse<Package>> {
  const response = await api.patch(`/packages/${id}/toggle-status`);
  return response.data;
}

// Usage
const response = await packageService.toggleStatus(5);
const updatedPackage = response.data;
console.log(`Package is now ${updatedPackage.is_active ? 'active' : 'inactive'}`);
```

---

## 9. Attach Attractions

### Laravel (Backend)
```php
// Route: POST /api/packages/{id}/attractions/attach
public function attachAttractions(Request $request, Package $package): JsonResponse
{
    $validated = $request->validate([
        'attraction_ids' => 'required|array',
        'attraction_ids.*' => 'exists:attractions,id',
    ]);
    
    $package->attractions()->attach($validated['attraction_ids']);
    
    return response()->json([
        'success' => true,
        'message' => 'Attractions attached successfully'
    ]);
}
```

### TypeScript (Frontend)
```typescript
async attachAttractions(id: number, attractionIds: number[]): Promise<ApiResponse<null>> {
  const response = await api.post(`/packages/${id}/attractions/attach`, {
    attraction_ids: attractionIds,
  });
  return response.data;
}

// Usage
await packageService.attachAttractions(5, [1, 2, 3]);
```

---

## 10. Detach Attractions

### Laravel (Backend)
```php
// Route: POST /api/packages/{id}/attractions/detach
public function detachAttractions(Request $request, Package $package): JsonResponse
{
    $validated = $request->validate([
        'attraction_ids' => 'required|array',
        'attraction_ids.*' => 'exists:attractions,id',
    ]);
    
    $package->attractions()->detach($validated['attraction_ids']);
    
    return response()->json([
        'success' => true,
        'message' => 'Attractions detached successfully'
    ]);
}
```

### TypeScript (Frontend)
```typescript
async detachAttractions(id: number, attractionIds: number[]): Promise<ApiResponse<null>> {
  const response = await api.post(`/packages/${id}/attractions/detach`, {
    attraction_ids: attractionIds,
  });
  return response.data;
}

// Usage
await packageService.detachAttractions(5, [1]);
```

---

## 11. Attach Add-ons

### Laravel (Backend)
```php
// Route: POST /api/packages/{id}/addons/attach
public function attachAddOns(Request $request, Package $package): JsonResponse
{
    $validated = $request->validate([
        'addon_ids' => 'required|array',
        'addon_ids.*' => 'exists:add_ons,id',
    ]);
    
    $package->addOns()->attach($validated['addon_ids']);
    
    return response()->json([
        'success' => true,
        'message' => 'Add-ons attached successfully'
    ]);
}
```

### TypeScript (Frontend)
```typescript
async attachAddOns(id: number, addonIds: number[]): Promise<ApiResponse<null>> {
  const response = await api.post(`/packages/${id}/addons/attach`, {
    addon_ids: addonIds,
  });
  return response.data;
}

// Usage
await packageService.attachAddOns(5, [1, 2]);
```

---

## 12. Detach Add-ons

### Laravel (Backend)
```php
// Route: POST /api/packages/{id}/addons/detach
public function detachAddOns(Request $request, Package $package): JsonResponse
{
    $validated = $request->validate([
        'addon_ids' => 'required|array',
        'addon_ids.*' => 'exists:add_ons,id',
    ]);
    
    $package->addOns()->detach($validated['addon_ids']);
    
    return response()->json([
        'success' => true,
        'message' => 'Add-ons detached successfully'
    ]);
}
```

### TypeScript (Frontend)
```typescript
async detachAddOns(id: number, addonIds: number[]): Promise<ApiResponse<null>> {
  const response = await api.post(`/packages/${id}/addons/detach`, {
    addon_ids: addonIds,
  });
  return response.data;
}

// Usage
await packageService.detachAddOns(5, [1]);
```

---

## 13. Bulk Import

### Laravel (Backend)
```php
// Route: POST /api/packages/bulk-import
public function bulkImport(Request $request): JsonResponse
{
    // Validate array of packages
    // Create each package with relationships
    
    return response()->json([
        'success' => true,
        'message' => count($importedPackages) . ' packages imported successfully',
        'data' => [
            'imported' => $importedPackages,
            'imported_count' => count($importedPackages),
            'failed_count' => count($errors)
        ],
        'errors' => $errors
    ], count($errors) > 0 ? 207 : 201);
}
```

### TypeScript (Frontend)
```typescript
async bulkImport(packages: Array<CreatePackageData & {
  attraction_ids?: number[];
  addon_ids?: number[];
  room_ids?: number[];
  gift_card_ids?: number[];
  promo_ids?: number[];
}>): Promise<BulkImportResponse> {
  const response = await api.post('/packages/bulk-import', { packages });
  return response.data;
}

// Usage
const response = await packageService.bulkImport([
  {
    location_id: 1,
    name: "Package 1",
    description: "...",
    price: 99.99,
    // ... other fields
    attraction_ids: [1, 2],
    addon_ids: [1]
  },
  {
    location_id: 1,
    name: "Package 2",
    // ...
  }
]);

console.log(`Imported: ${response.data.imported_count}`);
console.log(`Failed: ${response.data.failed_count}`);
```

---

## Authentication Flow

### Laravel
```php
// In routes/api.php
Route::middleware('auth:sanctum')->group(function () {
    Route::apiResource('packages', PackageController::class);
    // ... other routes
});

// Authorization checks in controller
if ($user->role === 'company_admin') {
    // Company admin logic
} else {
    // Location-based logic
}
```

### TypeScript
```typescript
// Automatic token injection in interceptor
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  }
);

// No manual token handling needed in service methods
```

---

## Role-Based Data Filtering

### Backend Behavior

**Company Admin:**
- Can see all packages from their company's locations
- Can optionally filter by specific location_id
- Can create/update packages for any company location

**Location Manager/Staff:**
- Can only see packages from their location
- location_id automatically set to their location
- Cannot access other locations

**Public/Guest:**
- Must specify location_id in filter
- Only sees active packages

### Frontend Usage

**No special handling needed!** The backend automatically filters based on the authenticated user's role. Just call the service methods normally:

```typescript
// Will automatically return appropriate packages based on user role
const response = await packageService.getPackages();
```

---

## Image Handling

### Laravel Upload (Base64)
```php
private function handleImageUpload($image): string
{
    if (is_string($image) && strpos($image, 'data:image') === 0) {
        // Extract and decode base64
        $filename = uniqid() . '.' . $imageType;
        $path = 'images/packages';
        file_put_contents($fullPath . '/' . $filename, $imageData);
        return $path . '/' . $filename;
    }
    return $image;
}
```

### TypeScript Display
```typescript
import { ASSET_URL } from '../utils/storage';

const imageUrl = Array.isArray(package.image) 
  ? ASSET_URL + package.image[0] 
  : ASSET_URL + package.image;

<img src={imageUrl} alt={package.name} />
```

---

## Quick Reference Table

| Backend Route | HTTP Method | Frontend Method | Returns |
|--------------|-------------|-----------------|---------|
| `/packages` | GET | `getPackages(filters?)` | Paginated list |
| `/packages/{id}` | GET | `getPackage(id)` | Single package |
| `/packages` | POST | `createPackage(data)` | Created package |
| `/packages/{id}` | PUT | `updatePackage(id, data)` | Updated package |
| `/packages/{id}` | DELETE | `deletePackage(id)` | Success message |
| `/packages/location/{id}` | GET | `getPackagesByLocation(id)` | Array of packages |
| `/packages/category/{cat}` | GET | `getPackagesByCategory(cat)` | Array of packages |
| `/packages/{id}/toggle-status` | PATCH | `toggleStatus(id)` | Updated package |
| `/packages/{id}/attractions/attach` | POST | `attachAttractions(id, ids)` | Success message |
| `/packages/{id}/attractions/detach` | POST | `detachAttractions(id, ids)` | Success message |
| `/packages/{id}/addons/attach` | POST | `attachAddOns(id, ids)` | Success message |
| `/packages/{id}/addons/detach` | POST | `detachAddOns(id, ids)` | Success message |
| `/packages/bulk-import` | POST | `bulkImport(packages)` | Import results |

---

## See Also
- `FETCH_PACKAGES_REFERENCE.md` - Complete usage guide
- `PACKAGE_FETCH_QUICK_REF.md` - Quick reference patterns
- `PackageService.ts` - Service implementation
