# Booking Service Usage Guide

## Overview
The `BookingService` provides comprehensive methods for managing bookings in your application, fully integrated with the Laravel backend API.

## Features
- ✅ Create, Read, Update, Delete bookings
- ✅ Check-in, Complete, Cancel bookings
- ✅ Paginated booking lists with filters
- ✅ Search bookings
- ✅ Filter by status, location, customer, date range
- ✅ Get bookings by location and date
- ✅ Time slot management

## Installation & Import

```typescript
import bookingService from '../services/BookingService';
import type { CreateBookingData, Booking, BookingFilters } from '../services/BookingService';
```

---

## Main Methods

### 1. **CREATE BOOKING** (Main Method)

Create a new booking with comprehensive validation matching the Laravel backend.

```typescript
const createNewBooking = async () => {
  try {
    const bookingData: CreateBookingData = {
      // Customer Info (either customer_id OR guest details required)
      customer_id: 123, // Use this if customer exists
      // OR for walk-in/guest bookings:
      // guest_name: "John Doe",
      // guest_email: "john@example.com",
      // guest_phone: "+1234567890",
      
      // Required fields
      location_id: 1,
      type: 'package',
      booking_date: '2025-11-15', // YYYY-MM-DD
      booking_time: '14:30', // HH:mm (24-hour format)
      participants: 10,
      duration: 2,
      duration_unit: 'hours',
      total_amount: 399.00,
      
      // Optional package & room
      package_id: 12,
      room_id: 1,
      
      // Payment details
      amount_paid: 399.00,
      payment_method: 'credit',
      payment_status: 'paid', // or 'partial'
      discount_amount: 0,
      
      // Status (defaults to 'pending' if not provided)
      status: 'confirmed',
      
      // Additional info
      notes: 'Birthday celebration',
      special_requests: 'Need birthday cake setup',
      created_by: 5, // User ID of staff member creating booking
      
      // Related items (optional)
      attraction_ids: [1, 2, 3],
      addon_ids: [1, 2],
      
      // Promo/Gift card (optional)
      promo_id: 10,
      gift_card_id: 5,
    };

    const response = await bookingService.createBooking(bookingData);
    
    if (response.success) {
      console.log('Booking created:', response.data);
      console.log('Reference number:', response.data.reference_number);
      
      // After booking created, create time slot
      await bookingService.createTimeSlot({
        package_id: response.data.package_id!,
        room_id: response.data.room_id!,
        booking_id: response.data.id,
        customer_id: response.data.customer_id,
        booked_date: response.data.booking_date,
        time_slot_start: response.data.booking_time,
        duration: response.data.duration,
        duration_unit: response.data.duration_unit,
        status: 'booked',
      });
    }
  } catch (error) {
    console.error('Error creating booking:', error);
  }
};
```

---

### 2. **GET BOOKINGS** (List with Filters & Pagination)

Retrieve bookings with flexible filtering and pagination.

```typescript
const fetchBookings = async () => {
  try {
    const filters: BookingFilters = {
      status: 'confirmed',
      location_id: 1,
      booking_date: '2025-11-15',
      search: 'john',
      sort_by: 'booking_date',
      sort_order: 'desc',
      per_page: 15,
      page: 1,
    };

    const response = await bookingService.getBookings(filters);
    
    if (response.success) {
      console.log('Bookings:', response.data.bookings);
      console.log('Pagination:', response.data.pagination);
      // {
      //   current_page: 1,
      //   last_page: 5,
      //   per_page: 15,
      //   total: 67,
      //   from: 1,
      //   to: 15
      // }
    }
  } catch (error) {
    console.error('Error fetching bookings:', error);
  }
};
```

**Available Filters:**
- `status` - Filter by booking status
- `location_id` - Filter by location
- `customer_id` - Filter by customer
- `date_from` / `date_to` - Date range
- `booking_date` - Specific date
- `upcoming` - Only upcoming bookings (boolean)
- `search` - Search by reference, name, email, phone
- `sort_by` - Sort field (booking_date, booking_time, total_amount, status, created_at)
- `sort_order` - 'asc' or 'desc'
- `per_page` - Items per page
- `page` - Current page number

---

### 3. **GET SINGLE BOOKING**

Retrieve a specific booking with all relations.

```typescript
const getBooking = async (id: number) => {
  try {
    const response = await bookingService.getBookingById(id);
    
    if (response.success) {
      const booking = response.data;
      console.log('Booking details:', booking);
      console.log('Customer:', booking.customer);
      console.log('Package:', booking.package);
      console.log('Attractions:', booking.attractions);
      console.log('Add-ons:', booking.addOns);
    }
  } catch (error) {
    console.error('Error fetching booking:', error);
  }
};
```

---

### 4. **UPDATE BOOKING**

Update an existing booking's details.

```typescript
const updateBooking = async (id: number) => {
  try {
    const updates = {
      booking_date: '2025-11-20',
      booking_time: '16:00',
      participants: 15,
      status: 'confirmed',
      notes: 'Updated booking details',
    };

    const response = await bookingService.updateBooking(id, updates);
    
    if (response.success) {
      console.log('Booking updated:', response.data);
    }
  } catch (error) {
    console.error('Error updating booking:', error);
  }
};
```

---

### 5. **STATUS MANAGEMENT**

#### Check-In Booking
```typescript
const checkIn = async (bookingId: number) => {
  try {
    const response = await bookingService.checkInBooking(bookingId);
    
    if (response.success) {
      console.log('Booking checked in:', response.data);
      console.log('Checked in at:', response.data.checked_in_at);
    }
  } catch (error) {
    console.error('Error checking in:', error);
  }
};
```

#### Complete Booking
```typescript
const completeBooking = async (bookingId: number) => {
  try {
    const response = await bookingService.completeBooking(bookingId);
    
    if (response.success) {
      console.log('Booking completed:', response.data);
      console.log('Completed at:', response.data.completed_at);
    }
  } catch (error) {
    console.error('Error completing booking:', error);
  }
};
```

#### Cancel Booking
```typescript
const cancelBooking = async (bookingId: number) => {
  try {
    const response = await bookingService.cancelBooking(bookingId);
    
    if (response.success) {
      console.log('Booking cancelled:', response.data);
      console.log('Cancelled at:', response.data.cancelled_at);
    }
  } catch (error) {
    console.error('Error cancelling booking:', error);
  }
};
```

---

### 6. **DELETE BOOKING**

Permanently delete a booking.

```typescript
const deleteBooking = async (bookingId: number) => {
  if (confirm('Are you sure you want to delete this booking?')) {
    try {
      const response = await bookingService.deleteBooking(bookingId);
      
      if (response.success) {
        console.log(response.message);
      }
    } catch (error) {
      console.error('Error deleting booking:', error);
    }
  }
};
```

---

### 7. **SEARCH BOOKINGS**

Search across multiple fields.

```typescript
const searchBookings = async (searchTerm: string) => {
  try {
    const response = await bookingService.searchBookings(searchTerm);
    
    if (response.success) {
      console.log('Search results:', response.data);
    }
  } catch (error) {
    console.error('Error searching:', error);
  }
};

// Searches in: reference_number, guest_name, guest_email, guest_phone,
// customer first_name, last_name, email, phone
```

---

### 8. **GET BOOKINGS BY LOCATION & DATE**

Retrieve all bookings for a specific location and date.

```typescript
const getLocationBookings = async () => {
  try {
    const response = await bookingService.getBookingsByLocationAndDate(
      1, // location_id
      '2025-11-15' // date
    );
    
    if (response.success) {
      console.log('Bookings for location on date:', response.data);
    }
  } catch (error) {
    console.error('Error fetching location bookings:', error);
  }
};
```

---

## Complete Example: Booking Flow

Here's a complete example of the booking flow used in `BookPackage.tsx` and `OnsiteBooking.tsx`:

```typescript
const handleCompleteBooking = async () => {
  try {
    // Step 1: Create the booking
    const bookingData: CreateBookingData = {
      customer_id: customerData.id,
      package_id: selectedPackage.id,
      location_id: selectedPackage.location_id,
      room_id: selectedRoom,
      type: 'package',
      booking_date: selectedDate,
      booking_time: selectedTime,
      participants: participantCount,
      duration: selectedPackage.duration,
      duration_unit: selectedPackage.duration_unit,
      total_amount: calculatedTotal,
      amount_paid: paymentType === 'full' ? calculatedTotal : partialAmount,
      payment_method: paymentMethod,
      payment_status: paymentType === 'full' ? 'paid' : 'partial',
      status: 'confirmed',
      notes: bookingNotes,
      special_requests: specialRequests,
      attraction_ids: selectedAttractions.map(a => a.id),
      addon_ids: selectedAddOns.map(a => a.id),
      promo_id: appliedPromo?.id,
      gift_card_id: appliedGiftCard?.id,
      created_by: currentUser.id,
    };

    const bookingResponse = await bookingService.createBooking(bookingData);

    if (bookingResponse.success) {
      // Step 2: Create time slot
      await bookingService.createTimeSlot({
        package_id: selectedPackage.id,
        room_id: selectedRoom,
        booking_id: bookingResponse.data.id,
        customer_id: bookingResponse.data.customer_id,
        booked_date: selectedDate,
        time_slot_start: selectedTime,
        duration: selectedPackage.duration,
        duration_unit: selectedPackage.duration_unit,
        status: 'booked',
        notes: bookingNotes,
      });

      // Step 3: Show success message
      alert(`Booking successful! Reference: ${bookingResponse.data.reference_number}`);
      
      // Step 4: Redirect to booking confirmation
      navigate(`/booking-confirmation/${bookingResponse.data.reference_number}`);
    }
  } catch (error) {
    console.error('Booking error:', error);
    alert('Failed to create booking. Please try again.');
  }
};
```

---

## Status Flow

```
pending → confirmed → checked-in → completed
          ↓
       cancelled
```

**Status Transitions:**
- `pending` → `confirmed`: When payment is received/confirmed
- `confirmed` → `checked-in`: When customer arrives (via checkInBooking)
- `checked-in` → `completed`: When service is finished (via completeBooking)
- `pending/confirmed` → `cancelled`: Cancel booking (via cancelBooking)

---

## Error Handling

All methods return standardized responses:

```typescript
{
  success: boolean;
  data: Booking | Booking[] | { bookings: Booking[], pagination: {...} };
  message?: string;
}
```

Always wrap calls in try-catch blocks and handle errors appropriately.

---

## TypeScript Types

All types are exported from `BookingService.ts`:

```typescript
import type {
  CreateBookingData,
  UpdateBookingData,
  BookingFilters,
  Booking,
  BookingResponse,
  PaginatedBookingResponse,
  CreateTimeSlotData,
} from '../services/BookingService';
```

---

## Backend API Routes

The service integrates with these Laravel routes:

```php
// CRUD operations
GET    /api/bookings              // List bookings (paginated)
POST   /api/bookings              // Create booking
GET    /api/bookings/{id}         // Get single booking
PUT    /api/bookings/{id}         // Update booking
DELETE /api/bookings/{id}         // Delete booking

// Status management
PATCH  /api/bookings/{id}/cancel    // Cancel booking
PATCH  /api/bookings/{id}/check-in  // Check in booking
PATCH  /api/bookings/{id}/complete  // Complete booking

// Specialized queries
GET    /api/bookings/location-date  // Get by location & date
GET    /api/bookings/search         // Search bookings
```

---

## Notes

1. **Authentication**: All requests automatically include the auth token from `localStorage.getItem('zapzone_token')`
2. **Reference Numbers**: Auto-generated by backend in format `BK20251115ABCDEF`
3. **Customer Requirements**: Must provide either `customer_id` OR `guest_name` + `guest_email`
4. **Time Format**: Use 24-hour format for `booking_time` (e.g., "14:30")
5. **Date Format**: Use ISO format for `booking_date` (e.g., "2025-11-15")

---

## Support

For issues or questions, refer to the Laravel backend controller at:
`App\Http\Controllers\Api\BookingController.php`
