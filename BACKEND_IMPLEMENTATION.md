# Backend Implementation Guide - Attraction Check-In System

## Laravel Controller Methods

### File: `app/Http/Controllers/AttractionPurchaseController.php`

Add these two public methods to your existing `AttractionPurchaseController`:

```php
<?php

namespace App\Http\Controllers;

use App\Models\AttractionPurchase;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class AttractionPurchaseController extends Controller
{
    /**
     * Verify a purchase ticket without modifying it
     * GET /api/attraction-purchases/{id}/verify
     * 
     * @param int $id
     * @return JsonResponse
     */
    public function verify(int $id): JsonResponse
    {
        try {
            $purchase = AttractionPurchase::with(['attraction', 'customer'])
                ->findOrFail($id);

            return response()->json([
                'success' => true,
                'data' => [
                    'id' => $purchase->id,
                    'attraction_id' => $purchase->attraction_id,
                    'customer_id' => $purchase->customer_id,
                    'guest_name' => $purchase->guest_name,
                    'guest_email' => $purchase->guest_email,
                    'guest_phone' => $purchase->guest_phone,
                    'quantity' => $purchase->quantity,
                    'total_amount' => $purchase->total_amount,
                    'payment_method' => $purchase->payment_method,
                    'status' => $purchase->status,
                    'purchase_date' => $purchase->purchase_date,
                    'notes' => $purchase->notes,
                    'created_at' => $purchase->created_at,
                    'updated_at' => $purchase->updated_at,
                    'attraction' => $purchase->attraction ? [
                        'id' => $purchase->attraction->id,
                        'name' => $purchase->attraction->name,
                        'price' => $purchase->attraction->price,
                        'pricing_type' => $purchase->attraction->pricing_type,
                    ] : null,
                    'customer' => $purchase->customer ? [
                        'id' => $purchase->customer->id,
                        'first_name' => $purchase->customer->first_name,
                        'last_name' => $purchase->customer->last_name,
                        'email' => $purchase->customer->email,
                    ] : null,
                ],
            ], 200);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Purchase not found',
            ], 404);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to verify purchase',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Check-in a purchase ticket (mark as used/completed)
     * PATCH /api/attraction-purchases/{id}/check-in
     * 
     * @param int $id
     * @return JsonResponse
     */
    public function checkIn(int $id): JsonResponse
    {
        try {
            $purchase = AttractionPurchase::with(['attraction', 'customer'])
                ->findOrFail($id);

            // Validate ticket status
            if ($purchase->status === 'completed') {
                return response()->json([
                    'success' => false,
                    'message' => 'This ticket has already been used',
                    'data' => $purchase,
                ], 400);
            }

            if ($purchase->status === 'cancelled') {
                return response()->json([
                    'success' => false,
                    'message' => 'This ticket has been cancelled and cannot be used',
                    'data' => $purchase,
                ], 400);
            }

            // Check in the ticket - mark as completed
            $purchase->status = 'completed';
            $purchase->save();

            // Reload with relationships
            $purchase->load(['attraction', 'customer']);

            return response()->json([
                'success' => true,
                'message' => 'Ticket checked in successfully',
                'data' => [
                    'id' => $purchase->id,
                    'attraction_id' => $purchase->attraction_id,
                    'customer_id' => $purchase->customer_id,
                    'guest_name' => $purchase->guest_name,
                    'guest_email' => $purchase->guest_email,
                    'guest_phone' => $purchase->guest_phone,
                    'quantity' => $purchase->quantity,
                    'total_amount' => $purchase->total_amount,
                    'payment_method' => $purchase->payment_method,
                    'status' => $purchase->status,
                    'purchase_date' => $purchase->purchase_date,
                    'notes' => $purchase->notes,
                    'created_at' => $purchase->created_at,
                    'updated_at' => $purchase->updated_at,
                    'attraction' => $purchase->attraction ? [
                        'id' => $purchase->attraction->id,
                        'name' => $purchase->attraction->name,
                        'price' => $purchase->attraction->price,
                        'pricing_type' => $purchase->attraction->pricing_type,
                    ] : null,
                    'customer' => $purchase->customer ? [
                        'id' => $purchase->customer->id,
                        'first_name' => $purchase->customer->first_name,
                        'last_name' => $purchase->customer->last_name,
                        'email' => $purchase->customer->email,
                    ] : null,
                ],
            ], 200);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Purchase not found',
            ], 404);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to check in ticket',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    // ... your other existing methods (index, store, update, delete, etc.)
}
```

---

## API Routes

### File: `routes/api.php`

Add these two routes to your existing attraction-purchases routes:

```php
<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AttractionPurchaseController;

// Existing attraction-purchases routes
Route::prefix('attraction-purchases')->group(function () {
    Route::get('/', [AttractionPurchaseController::class, 'index']);
    Route::post('/', [AttractionPurchaseController::class, 'store']);
    Route::get('/{id}', [AttractionPurchaseController::class, 'show']);
    Route::put('/{id}', [AttractionPurchaseController::class, 'update']);
    Route::delete('/{id}', [AttractionPurchaseController::class, 'destroy']);
    Route::patch('/{id}/complete', [AttractionPurchaseController::class, 'markAsCompleted']);
    Route::patch('/{id}/cancel', [AttractionPurchaseController::class, 'cancel']);
    Route::post('/{id}/send-receipt', [AttractionPurchaseController::class, 'sendReceipt']);
    
    // NEW ROUTES FOR CHECK-IN SYSTEM
    Route::get('/{id}/verify', [AttractionPurchaseController::class, 'verify']);
    Route::patch('/{id}/check-in', [AttractionPurchaseController::class, 'checkIn']);
});
```

---

## Database Schema

Make sure your `attraction_purchases` table has the `status` column with these possible values:

```php
// In your migration file
$table->enum('status', ['pending', 'completed', 'cancelled'])->default('pending');
```

**Status Flow:**
- `pending` → Purchase created, not yet used
- `completed` → Ticket checked in and used
- `cancelled` → Purchase refunded/cancelled

---

## Model Configuration

### File: `app/Models/AttractionPurchase.php`

Ensure your model has the necessary relationships:

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AttractionPurchase extends Model
{
    protected $fillable = [
        'attraction_id',
        'customer_id',
        'guest_name',
        'guest_email',
        'guest_phone',
        'quantity',
        'total_amount',
        'payment_method',
        'status',
        'purchase_date',
        'notes',
        'created_by',
    ];

    protected $casts = [
        'purchase_date' => 'date',
        'total_amount' => 'decimal:2',
        'quantity' => 'integer',
    ];

    /**
     * Get the attraction for this purchase
     */
    public function attraction(): BelongsTo
    {
        return $this->belongsTo(Attraction::class);
    }

    /**
     * Get the customer for this purchase (if registered customer)
     */
    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    /**
     * Get the user who created this purchase
     */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
```

---

## Testing the Endpoints

### 1. Test Verify Endpoint

```bash
# Using curl
curl -X GET "http://your-api.com/api/attraction-purchases/123/verify" \
  -H "Accept: application/json"

# Using Postman
GET http://your-api.com/api/attraction-purchases/123/verify
Headers: Accept: application/json
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "id": 123,
    "status": "pending",
    "quantity": 2,
    "total_amount": "50.00",
    "attraction": {
      "id": 5,
      "name": "Zip Line Adventure"
    }
  }
}
```

### 2. Test Check-In Endpoint

```bash
# Using curl
curl -X PATCH "http://your-api.com/api/attraction-purchases/123/check-in" \
  -H "Accept: application/json"

# Using Postman
PATCH http://your-api.com/api/attraction-purchases/123/check-in
Headers: Accept: application/json
```

**Expected Response (Success):**
```json
{
  "success": true,
  "message": "Ticket checked in successfully",
  "data": {
    "id": 123,
    "status": "completed",
    "updated_at": "2025-11-06T14:30:00.000000Z"
  }
}
```

**Expected Response (Already Used):**
```json
{
  "success": false,
  "message": "This ticket has already been used"
}
```

---

## Complete Implementation Checklist

- [ ] Add `verify()` method to `AttractionPurchaseController`
- [ ] Add `checkIn()` method to `AttractionPurchaseController`
- [ ] Add verify route: `GET /api/attraction-purchases/{id}/verify`
- [ ] Add check-in route: `PATCH /api/attraction-purchases/{id}/check-in`
- [ ] Ensure `status` column exists in database with enum values
- [ ] Verify `attraction()` relationship exists in `AttractionPurchase` model
- [ ] Verify `customer()` relationship exists in `AttractionPurchase` model
- [ ] Test verify endpoint with valid purchase ID
- [ ] Test verify endpoint with invalid purchase ID (404)
- [ ] Test check-in endpoint with pending purchase
- [ ] Test check-in endpoint with already completed purchase (400)
- [ ] Test check-in endpoint with cancelled purchase (400)
- [ ] Test check-in endpoint with invalid ID (404)
- [ ] Verify CORS is enabled for frontend domain
- [ ] Test integration with frontend scanner at `/attractions/check-in`

---

## Error Handling

The endpoints handle these scenarios:

| Scenario | HTTP Status | Response |
|----------|-------------|----------|
| Valid ticket (pending) | 200 | Check-in successful, status updated to completed |
| Already used ticket | 400 | Error message: "Ticket already been used" |
| Cancelled ticket | 400 | Error message: "Ticket has been cancelled" |
| Invalid purchase ID | 404 | Error message: "Purchase not found" |
| Server error | 500 | Error message with details |

---

## Security Considerations (Optional)

If you want to add authentication/authorization:

```php
// Add middleware to routes
Route::middleware(['auth:sanctum'])->group(function () {
    Route::get('/attraction-purchases/{id}/verify', [AttractionPurchaseController::class, 'verify']);
    Route::patch('/attraction-purchases/{id}/check-in', [AttractionPurchaseController::class, 'checkIn']);
});

// Or add permission checks in the controller
public function checkIn(int $id): JsonResponse
{
    // Check if user has permission
    if (!auth()->user()->can('checkin-tickets')) {
        return response()->json([
            'success' => false,
            'message' => 'Unauthorized',
        ], 403);
    }
    
    // ... rest of the method
}
```

---

## Frontend Integration

Once the backend is deployed, update the frontend API base URL:

**File:** `src/utils/storage.ts`
```typescript
export const API_BASE_URL = 'https://your-backend-api.com/api';
```

The frontend will automatically call:
- `GET /attraction-purchases/{id}/verify` - When QR code is scanned
- `PATCH /attraction-purchases/{id}/check-in` - After verification succeeds

---

## Summary

**Two new public methods needed:**
1. ✅ `verify(int $id)` - Verify ticket without changing it
2. ✅ `checkIn(int $id)` - Mark ticket as used (pending → completed)

**Two new API routes needed:**
1. ✅ `GET /api/attraction-purchases/{id}/verify`
2. ✅ `PATCH /api/attraction-purchases/{id}/check-in`

Copy the controller methods and routes above into your Laravel backend, and the check-in system will be fully operational! 🚀
