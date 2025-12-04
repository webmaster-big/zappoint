# Packages 500 Error Troubleshooting Guide

## Error Description
**Error:** `500 (Internal Server Error)`  
**Component:** `Packages.tsx`  
**Line:** Error fetching packages

## What Was Fixed

### 1. Enhanced Error Handling
Added comprehensive error catching and logging:
- Detailed error information in console
- User-friendly error messages
- Network error detection
- Authorization error handling

### 2. Fallback Cache System
- Packages are now cached in localStorage on successful load
- If backend fails, app attempts to load from cache
- User can still view previously loaded packages

### 3. Better Error Messages
- **500 Error:** "Server error. Please contact support or try again later."
- **401 Error:** "Unauthorized. Please log in again."
- **403 Error:** "Access denied. You do not have permission to view packages."
- **Network Error:** "Network error. Please check your connection."

## Diagnosing the 500 Error

### Check Browser Console
The enhanced error logging now shows:
```
Response status: 500
Response data: { ... } <- Backend error details
Response headers: { ... }
```

### Common Causes of 500 Error

#### 1. Backend Database Issue
**Symptoms:** 500 error on all package requests

**Check Laravel Logs:**
```bash
# In your Laravel project
tail -f storage/logs/laravel.log
```

**Possible Issues:**
- Database connection failed
- Missing migration or column
- Invalid SQL query

**Solution:**
```bash
# Check database connection
php artisan tinker
>>> DB::connection()->getPdo();

# Run migrations
php artisan migrate

# Clear cache
php artisan cache:clear
php artisan config:clear
```

#### 2. Missing or Invalid Relationships
**Symptoms:** Error mentions relationships (location, attractions, etc.)

**Backend Fix (PackageController):**
```php
// Check if relationships exist before loading
$packages->load(['location', 'attractions', 'addOns', 'rooms']);
```

**Possible Issues:**
- Package has location_id that doesn't exist in locations table
- Orphaned records
- Missing foreign keys

**Solution:**
```sql
-- Find packages with invalid location_id
SELECT * FROM packages WHERE location_id NOT IN (SELECT id FROM locations);

-- Fix or delete orphaned records
DELETE FROM packages WHERE location_id NOT IN (SELECT id FROM locations);
```

#### 3. Memory Exhaustion
**Symptoms:** 500 error when loading many packages

**Backend Issue:**
- Loading too much data at once
- Not using pagination properly

**Laravel Solution:**
```php
// In PackageController::index()
// Already fixed: uses select() to limit columns
$query = Package::select('id', 'location_id', 'name', ...);

// Increase memory limit temporarily (not recommended long-term)
ini_set('memory_limit', '256M');
```

#### 4. Authentication/Token Issue
**Symptoms:** 500 error immediately on load

**Check:**
- Token exists in localStorage
- Token is valid
- User data is correct

**Frontend Check:**
```javascript
// In browser console
console.log('Token:', localStorage.getItem('token'));
console.log('User:', localStorage.getItem('zapzone_user'));
```

**Solution:**
```javascript
// Clear and re-login
localStorage.clear();
// Navigate to /login
```

#### 5. CORS or Middleware Issue
**Symptoms:** 500 error with CORS warnings

**Backend Check (Laravel):**
```php
// app/Http/Middleware/Authenticate.php
// Make sure middleware isn't blocking requests

// config/cors.php
'paths' => ['api/*'],
'allowed_origins' => ['*'], // Or specific domain
```

## Step-by-Step Debugging

### Step 1: Check Backend Logs
```bash
# Laravel
tail -f storage/logs/laravel.log

# Look for:
# - SQL errors
# - Missing relationships
# - Memory errors
```

### Step 2: Test API Directly
```bash
# Using curl or Postman
curl -H "Authorization: Bearer YOUR_TOKEN" \
     http://your-backend-url/api/packages?per_page=50&sort_by=id&sort_order=desc

# Expected response:
{
  "success": true,
  "data": {
    "packages": [...],
    "pagination": {...}
  }
}
```

### Step 3: Check Database
```sql
-- Check if packages table exists
SHOW TABLES LIKE 'packages';

-- Check table structure
DESCRIBE packages;

-- Check for data
SELECT COUNT(*) FROM packages;

-- Check for orphaned relationships
SELECT p.id, p.name, p.location_id 
FROM packages p 
LEFT JOIN locations l ON p.location_id = l.id 
WHERE l.id IS NULL;
```

### Step 4: Verify Backend Route
```bash
# Check if route exists
php artisan route:list | grep packages

# Should show:
GET|HEAD  api/packages ............... packages.index › Api\PackageController@index
```

### Step 5: Test Backend Directly
```php
// In Laravel tinker
php artisan tinker

>>> use App\Models\Package;
>>> Package::with(['location', 'attractions', 'addOns', 'rooms'])->paginate(50);
```

## Quick Fixes

### Fix 1: Reload and Clear Cache
```javascript
// In browser console
localStorage.removeItem('packages_cache');
window.location.reload();
```

### Fix 2: Try Without Relationships
Temporarily modify backend to not load relationships:
```php
// In PackageController::index()
// Comment out this line temporarily
// $packages->load(['location', 'attractions', 'addOns', 'rooms']);
```

### Fix 3: Reduce Page Size
```typescript
// In Packages.tsx
const response = await packageService.getPackages({ 
  per_page: 10, // Reduce from 50
  sort_by: 'id',
  sort_order: 'desc'
});
```

### Fix 4: Check User Authentication
```typescript
// In Packages.tsx, add this before fetchPackages
const token = localStorage.getItem('token');
if (!token) {
  setError('Not authenticated. Please log in.');
  setLoading(false);
  return;
}
```

## Frontend Changes Made

### Error State Display
The error screen now shows:
- Specific error message based on status code
- Retry button to reload
- Error details in console for debugging

### Fallback Cache
If backend fails:
1. App tries to load from localStorage
2. Shows cached packages (if available)
3. Displays error message but keeps UI functional

### Console Logging
Enhanced logging shows:
- Full error object
- Response status and data
- Request details
- Cache operations

## Testing the Fix

### 1. Test Error Display
```javascript
// In browser console, simulate errors
localStorage.removeItem('packages_cache');
// Then trigger a 500 error to see the message
```

### 2. Test Cache Fallback
```javascript
// Load packages once successfully
// Then disconnect internet or backend
// Reload page - should load from cache
```

### 3. Test Error Recovery
- Fix backend issue
- Click "Retry" button
- Should load successfully

## Prevention

### Backend Best Practices
1. Always use pagination
2. Select only needed columns
3. Load relationships after pagination
4. Add proper error handling
5. Log errors for debugging

### Frontend Best Practices
1. Always handle errors
2. Provide user feedback
3. Cache data when possible
4. Add retry mechanisms
5. Log errors for debugging

## Need More Help?

### Check These Files
1. **Backend:** `app/Http/Controllers/Api/PackageController.php`
2. **Frontend:** `src/pages/admin/packages/Packages.tsx`
3. **Service:** `src/services/PackageService.ts`
4. **Laravel Logs:** `storage/logs/laravel.log`

### Enable Debug Mode (Laravel)
```env
# .env
APP_DEBUG=true
LOG_LEVEL=debug
```

### Common Solutions Summary
- ✅ Run `php artisan migrate`
- ✅ Run `php artisan cache:clear`
- ✅ Check database connection
- ✅ Verify token is valid
- ✅ Check Laravel logs
- ✅ Test API endpoint directly
- ✅ Verify relationships exist
- ✅ Check for orphaned records

---

**Status:** Enhanced error handling implemented  
**Fallback:** localStorage cache system active  
**User Impact:** Better error messages and graceful degradation
