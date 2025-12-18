# Availability Schedules Update

## Summary

Updated the booking system to support the new **multiple availability schedules** structure from the backend. Instead of flat availability fields on the package, packages now have an `availability_schedules` array where each schedule defines its own availability type, day configuration, and time slots.

## Backend API Changes

### New Response Structure

Packages now include an `availability_schedules` array:

```json
{
  "availability_schedules": [
    {
      "id": 1,
      "package_id": 15,
      "availability_type": "weekly",
      "day_configuration": ["monday", "tuesday"],
      "time_slot_start": "13:00:00",
      "time_slot_end": "17:00:00",
      "time_slot_interval": 15,
      "priority": 0,
      "is_active": true,
      "created_at": "2025-12-18T17:27:02.000000Z",
      "updated_at": "2025-12-18T17:27:02.000000Z"
    },
    {
      "id": 2,
      "package_id": 15,
      "availability_type": "weekly",
      "day_configuration": ["wednesday", "thursday"],
      "time_slot_start": "09:00:00",
      "time_slot_end": "17:00:00",
      "time_slot_interval": 45,
      "priority": 0,
      "is_active": true,
      "created_at": "2025-12-18T17:27:02.000000Z",
      "updated_at": "2025-12-18T17:27:02.000000Z"
    }
  ]
}
```

### Key Changes

- **Multiple schedules per package**: A package can have different availability rules for different days
- **Array-based day_configuration**: Allows multiple days per schedule (e.g., `["monday", "tuesday"]`)
- **Per-schedule time slots**: Each schedule has its own start time, end time, and interval
- **Priority system**: Schedules have a priority field for conflict resolution
- **Active flag**: Each schedule can be individually enabled/disabled

## Frontend Updates

### 1. Type Definitions Updated

**Files Modified:**
- `src/types/BookPackage.types.ts`
- `src/types/onsiteBooking.types.ts`

**Changes:**
- Added `AvailabilitySchedule` interface with:
  - `availability_type`: "daily" | "weekly" | "monthly"
  - `day_configuration`: string[] | null
  - `time_slot_start`, `time_slot_end`, `time_slot_interval`
  - `priority`, `is_active`
- Updated package interfaces to include `availability_schedules?: AvailabilitySchedule[]`
- Made old flat availability fields optional for backward compatibility

### 2. Date Picker Logic Updated

**Files Modified:**
- `src/pages/admin/bookings/OnsiteBooking.tsx`
- `src/pages/admin/bookings/BookPackage.tsx`

**Changes:**
The `useEffect` that calculates available dates now:
1. Loops through `availability_schedules` array instead of checking flat fields
2. For each active schedule, checks if the date matches:
   - **Daily**: Always available
   - **Weekly**: Checks if day name is in `day_configuration` array
   - **Monthly**: Checks if day-week pattern matches (e.g., "sunday-first", "monday-last")
3. Breaks as soon as any schedule matches the date

### 3. Time Slot Fetching

**No changes needed** - The existing SSE (Server-Sent Events) logic already:
- Sends `package_id` and `date` to backend
- Backend uses `availability_schedules` to generate time slots
- Returns available slots with auto-assigned rooms

The backend method `getAvailableSlotsAuto()` now uses the new `Package::getTimeSlotsForDate()` method which reads from `availability_schedules`.

## How It Works Now

### Example Scenario

Package "Birthday Party" has 2 schedules:
1. **Monday & Tuesday**: 1:00 PM - 5:00 PM (15-minute intervals)
2. **Wednesday & Thursday**: 9:00 AM - 5:00 PM (45-minute intervals)

### User Experience

1. **Date Selection**:
   - DatePicker shows only dates that match at least one active schedule
   - Monday shows available (matches schedule 1)
   - Wednesday shows available (matches schedule 2)
   - Friday shows unavailable (no matching schedule)

2. **Time Slot Selection**:
   - User selects Monday → Backend returns slots: 1:00 PM, 1:15 PM, 1:30 PM... 5:00 PM
   - User selects Wednesday → Backend returns slots: 9:00 AM, 9:45 AM, 10:30 AM... 5:00 PM
   - Each slot shows available room and room count

3. **Booking Creation**:
   - User books Monday at 2:00 PM
   - Backend automatically assigns available room from package's room list
   - Creates booking with selected date, time, and room

## Monthly Availability Pattern

For monthly schedules, `day_configuration` uses patterns like:
- `"sunday-first"` - First Sunday of the month
- `"monday-second"` - Second Monday
- `"friday-last"` - Last Friday
- `"tuesday-third"` - Third Tuesday

The frontend splits these patterns and matches against:
- Day name (sunday, monday, etc.)
- Week number (first=1, second=2, third=3, fourth=4, last=last week)

## Backward Compatibility

Old flat fields are now **optional** in TypeScript interfaces:
- `availability_type?`
- `available_days?`
- `availableWeekDays?`
- `availableMonthDays?`

This ensures the frontend won't break if old package data still exists, but the logic prioritizes `availability_schedules` when present.

## Testing Checklist

- [x] TypeScript compilation successful
- [ ] Date picker shows correct available dates for weekly schedules
- [ ] Date picker shows correct available dates for monthly schedules  
- [ ] Time slots are fetched and displayed correctly
- [ ] Time slots match the schedule's time configuration
- [ ] Different days show different time intervals (if configured)
- [ ] Booking creation works with new structure
- [ ] Multiple schedules on same day work correctly (priority handling)

## Related Files

- **Type Definitions**: 
  - `src/types/BookPackage.types.ts`
  - `src/types/onsiteBooking.types.ts`
  
- **Booking Pages**:
  - `src/pages/admin/bookings/OnsiteBooking.tsx`
  - `src/pages/admin/bookings/BookPackage.tsx`
  - `src/pages/admin/bookings/ManualBooking.tsx` (no changes - doesn't use availability logic)
  
- **UI Components**:
  - `src/components/ui/DatePicker.tsx` (no changes - already receives computed dates)
  
- **Services**:
  - `src/services/timeSlotService.ts` (no changes - SSE logic unchanged)

## Next Steps

1. Test with actual backend API using packages with multiple schedules
2. Verify time slot generation matches schedule configuration
3. Test edge cases (overlapping schedules, inactive schedules, priority handling)
4. Update package edit functionality to load and display existing schedules
