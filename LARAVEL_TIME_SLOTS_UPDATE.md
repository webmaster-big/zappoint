# Laravel Package Controller - Time Slots Update

## Database Migration

First, add these columns to your `packages` table:

```php
// In your packages migration file
Schema::table('packages', function (Blueprint $table) {
    $table->time('time_slot_start')->nullable()->after('availability');
    $table->time('time_slot_end')->nullable()->after('time_slot_start');
    $table->integer('time_slot_interval')->default(30)->after('time_slot_end'); // in minutes
});
```

## Controller Update

Update your `PackageController@store` method to include time slot validation and storage:

```php
public function store(Request $request): JsonResponse
{
    $validated = $request->validate([
        // ... existing validation rules ...
        'name' => 'required|string|max:255',
        'description' => 'required|string',
        'category' => 'required|string|max:100',
        'features' => 'nullable|string',
        'price' => 'required|numeric|min:0',
        'max_participants' => 'required|integer|min:1',
        'price_per_additional' => 'nullable|numeric|min:0',
        'duration' => 'required|integer|min:1',
        'duration_unit' => 'required|in:hours,minutes',
        'availability_type' => 'required|in:daily,weekly,monthly',
        'availability' => 'nullable|array',
        
        // NEW: Time slot validation
        'time_slot_start' => 'required|date_format:H:i',
        'time_slot_end' => 'required|date_format:H:i|after:time_slot_start',
        'time_slot_interval' => 'required|integer|min:15|max:240', // 15 min to 4 hours
        
        'location_id' => 'required|exists:locations,id',
        'image' => 'nullable|string',
        'status' => 'nullable|in:active,inactive',
        
        // Related IDs
        'attraction_ids' => 'nullable|array',
        'attraction_ids.*' => 'exists:attractions,id',
        'addon_ids' => 'nullable|array',
        'addon_ids.*' => 'exists:add_ons,id',
        'room_ids' => 'nullable|array',
        'room_ids.*' => 'exists:rooms,id',
        'promo_ids' => 'nullable|array',
        'promo_ids.*' => 'exists:promos,id',
        'gift_card_ids' => 'nullable|array',
        'gift_card_ids.*' => 'exists:gift_cards,id',
    ]);

    DB::beginTransaction();
    try {
        // Create the package
        $package = Package::create([
            'location_id' => $validated['location_id'],
            'name' => $validated['name'],
            'description' => $validated['description'],
            'category' => $validated['category'],
            'features' => $validated['features'] ?? null,
            'price' => $validated['price'],
            'max_participants' => $validated['max_participants'],
            'price_per_additional' => $validated['price_per_additional'] ?? null,
            'duration' => $validated['duration'],
            'duration_unit' => $validated['duration_unit'],
            'availability_type' => $validated['availability_type'],
            'availability' => $validated['availability'] ?? null,
            
            // NEW: Store time slot data
            'time_slot_start' => $validated['time_slot_start'],
            'time_slot_end' => $validated['time_slot_end'],
            'time_slot_interval' => $validated['time_slot_interval'],
            
            'image' => $validated['image'] ?? null,
            'is_active' => isset($validated['status']) && $validated['status'] === 'active',
            'created_by' => auth()->id() ?? 1,
        ]);

        // Handle attraction IDs
        if (isset($validated['attraction_ids']) && is_array($validated['attraction_ids'])) {
            foreach ($validated['attraction_ids'] as $attractionId) {
                PackageAttraction::create([
                    'package_id' => $package->id,
                    'attraction_id' => $attractionId,
                ]);
            }
        }

        // Handle add-on IDs
        if (isset($validated['addon_ids']) && is_array($validated['addon_ids'])) {
            foreach ($validated['addon_ids'] as $addonId) {
                PackageAddOn::create([
                    'package_id' => $package->id,
                    'add_on_id' => $addonId,
                ]);
            }
        }

        // Handle room IDs
        if (isset($validated['room_ids']) && is_array($validated['room_ids'])) {
            foreach ($validated['room_ids'] as $roomId) {
                PackageRoom::create([
                    'package_id' => $package->id,
                    'room_id' => $roomId,
                ]);
            }
        }

        // Handle gift card IDs
        if (isset($validated['gift_card_ids']) && is_array($validated['gift_card_ids'])) {
            foreach ($validated['gift_card_ids'] as $giftCardId) {
                PackageGiftCard::create([
                    'package_id' => $package->id,
                    'gift_card_id' => $giftCardId,
                ]);
            }
        }

        // Handle promo IDs
        if (isset($validated['promo_ids']) && is_array($validated['promo_ids'])) {
            foreach ($validated['promo_ids'] as $promoId) {
                PackagePromo::create([
                    'package_id' => $package->id,
                    'promo_id' => $promoId,
                ]);
            }
        }

        DB::commit();

        return response()->json([
            'success' => true,
            'message' => 'Package created successfully',
            'data' => new PackageResource($package->load([
                'location',
                'attractions',
                'addOns',
                'rooms',
                'promos',
                'giftCards'
            ])),
        ], 201);
    } catch (\Exception $e) {
        DB::rollBack();
        
        return response()->json([
            'success' => false,
            'message' => 'Failed to create package',
            'error' => $e->getMessage(),
        ], 500);
    }
}
```

## Package Model Update

Add the new fields to your `Package` model's `$fillable` array:

```php
class Package extends Model
{
    protected $fillable = [
        // ... existing fields ...
        'location_id',
        'name',
        'description',
        'category',
        'features',
        'price',
        'max_participants',
        'price_per_additional',
        'duration',
        'duration_unit',
        'availability_type',
        'availability',
        
        // NEW: Add these
        'time_slot_start',
        'time_slot_end',
        'time_slot_interval',
        
        'image',
        'is_active',
        'created_by',
    ];

    protected $casts = [
        'availability' => 'array',
        'is_active' => 'boolean',
        'price' => 'decimal:2',
        'price_per_additional' => 'decimal:2',
        
        // NEW: Cast time slots
        'time_slot_start' => 'string',
        'time_slot_end' => 'string',
        'time_slot_interval' => 'integer',
    ];
}
```

## Helper Method (Optional)

You can add a helper method to your Package model to generate available time slots:

```php
// In Package.php model
public function getAvailableTimeSlotsAttribute()
{
    if (!$this->time_slot_start || !$this->time_slot_end || !$this->time_slot_interval) {
        return [];
    }

    $slots = [];
    $start = Carbon::parse($this->time_slot_start);
    $end = Carbon::parse($this->time_slot_end);
    $interval = $this->time_slot_interval;

    while ($start->lessThan($end)) {
        $slots[] = $start->format('H:i');
        $start->addMinutes($interval);
    }

    return $slots;
}
```

## API Resource Update

Update your `PackageResource` to include time slot information:

```php
class PackageResource extends JsonResource
{
    public function toArray($request)
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'description' => $this->description,
            'category' => $this->category,
            'features' => $this->features,
            'price' => $this->price,
            'max_participants' => $this->max_participants,
            'price_per_additional' => $this->price_per_additional,
            'duration' => $this->duration,
            'duration_unit' => $this->duration_unit,
            'availability_type' => $this->availability_type,
            'availability' => $this->availability,
            
            // NEW: Add time slot fields
            'time_slot_start' => $this->time_slot_start,
            'time_slot_end' => $this->time_slot_end,
            'time_slot_interval' => $this->time_slot_interval,
            'available_time_slots' => $this->available_time_slots, // If you added the helper method
            
            'image' => $this->image,
            'is_active' => $this->is_active,
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
            
            // Relationships
            'location' => new LocationResource($this->whenLoaded('location')),
            'attractions' => AttractionResource::collection($this->whenLoaded('attractions')),
            'addOns' => AddOnResource::collection($this->whenLoaded('addOns')),
            'rooms' => RoomResource::collection($this->whenLoaded('rooms')),
            'promos' => PromoResource::collection($this->whenLoaded('promos')),
            'giftCards' => GiftCardResource::collection($this->whenLoaded('giftCards')),
        ];
    }
}
```

## Usage Example

When customers book this package, you can use the time slot information to:

1. **Show available booking times** based on `time_slot_start`, `time_slot_end`, and `time_slot_interval`
2. **Validate booking times** against the configured slots
3. **Display time picker** with only valid time slots
4. **Calculate availability** for specific dates and times

Example booking validation:

```php
// In BookingController or similar
public function validateBookingTime(Request $request, Package $package)
{
    $requestedTime = $request->input('booking_time'); // e.g., "10:30"
    
    $availableSlots = $package->available_time_slots;
    
    if (!in_array($requestedTime, $availableSlots)) {
        return response()->json([
            'success' => false,
            'message' => 'The selected time slot is not available for this package.',
            'available_slots' => $availableSlots,
        ], 422);
    }
    
    // Continue with booking...
}
```
