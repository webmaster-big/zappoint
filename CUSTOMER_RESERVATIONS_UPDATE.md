# Customer Reservations Page - API Integration Update

## Summary
Updated the `CustomerReservation.tsx` component to integrate with the Laravel backend API for fetching customer bookings, generating QR codes matching `BookPackage.tsx`, and creating professional receipt designs.

## Changes Made

### 1. **API Integration** (`src/pages/customer/CustomerReservation.tsx`)

#### Backend Endpoint Used:
```
GET /customers/bookings
```

#### Query Parameters Supported:
- `search` - Search by location, reference number, or package name
- `customer_id` - Filter by customer ID
- `guest_email` - Filter by guest email (also searches customer table)
- `sort_by` - Sort field (booking_date, booking_time, total_amount, status, created_at)
- `sort_order` - Sort direction (asc/desc)
- `per_page` - Items per page (max 100)
- `page` - Current page number

#### Features Implemented:
- ✅ Real-time data fetching from Laravel API
- ✅ Search functionality (package name, reference number, location)
- ✅ Sorting (by date, status, amount)
- ✅ Pagination with customizable page size
- ✅ Loading and error states
- ✅ Customer identification via localStorage (`zapzone_customer`)
- ✅ Automatic filtering by customer_id or guest_email

### 2. **QR Code Generation** (Matching `BookPackage.tsx`)

#### Implementation:
```typescript
const qrCodeDataURL = await QRCode.toDataURL(booking.reference_number, {
  width: 512,
  margin: 2,
  color: {
    dark: '#000000',
    light: '#FFFFFF'
  }
});
```

#### Features:
- Uses reference number only (simple and consistent with BookPackage.tsx)
- 512x512 pixel resolution
- Black on white color scheme
- 2-pixel margin
- Downloads as PNG with filename: `zapzone-qrcode-{reference_number}.png`

### 3. **Professional Receipt Design**

#### Design Features:
- **Modern Layout**: Gradient header with ZapZone branding
- **Organized Sections**:
  - Receipt header with reference number and issue date
  - Customer information card
  - Booking details card
  - Package details with styled borders
  - Attractions and add-ons lists
  - Special requests section
  - Comprehensive payment summary
  - Status badge
  - Professional footer

#### Styling:
- Clean typography with proper hierarchy
- Color-coded sections:
  - Blue gradient header
  - Blue accent for customer info
  - Green accent for booking details
  - Yellow highlights for attractions
  - Blue highlights for add-ons
  - Cyan for special requests
- Proper spacing and padding
- Border accents for visual separation
- Status-based color coding

#### Export:
- Generates as PDF
- Filename: `zapzone-receipt-{reference_number}.pdf`
- A4 page size
- High-quality rendering (scale: 2)
- Multi-page support for long receipts

### 4. **Updated Booking Service** (`src/services/bookingService.ts`)

```typescript
async getBookings(filters?: BookingFilters): Promise<PaginatedBookingResponse> {
  // Automatically routes to /customers/bookings if customer_id or guest_email present
  const useCustomerEndpoint = filters?.customer_id || (filters as any)?.guest_email;
  const endpoint = useCustomerEndpoint ? '/customers/bookings' : '/bookings';
  
  const response = await api.get(`${endpoint}?${params.toString()}`);
  return response.data;
}
```

### 5. **Type Safety**

#### Updated Imports:
```typescript
import { bookingService, type Booking } from '../../services/bookingService';
import type { BookPackagePackage } from '../../types/BookPackage.types';
```

#### Helper Functions:
```typescript
const getLocationName = (booking: Booking): string => {
  const location = booking.location as any;
  return location?.name || 'N/A';
};

const getPackageName = (booking: Booking): string => {
  const pkg = booking.package as BookPackagePackage | undefined;
  return pkg?.name || 'N/A';
};
```

### 6. **Enhanced UI/UX**

#### New Features:
- Loading spinner with message
- Error alerts with retry capability
- Empty state with call-to-action
- Improved pagination display showing total records
- Status badges with color coding:
  - Confirmed: Green
  - Pending: Yellow
  - Cancelled: Red
  - Completed: Blue
  - Checked-in: Purple

#### Interactions:
- Expandable booking cards
- Modal dialogs for:
  - Booking details
  - Refund policy
  - Cancellation confirmation
- Download buttons for:
  - PDF receipts
  - QR codes

### 7. **Cancellation Flow**

```typescript
const confirmCancellation = async () => {
  await bookingService.updateBooking(selectedBooking.id, {
    status: 'cancelled',
    notes: `Cancellation reason: ${cancelReason}`
  });
  await fetchBookings(); // Refresh list
  alert('Booking cancelled successfully...');
};
```

## Testing Checklist

- [ ] Test with valid customer_id
- [ ] Test with guest_email
- [ ] Test search functionality
- [ ] Test sorting (all options)
- [ ] Test pagination
- [ ] Test QR code download
- [ ] Test receipt PDF download
- [ ] Test cancellation flow
- [ ] Test with no bookings
- [ ] Test error handling
- [ ] Test loading states

## API Response Format Expected

```json
{
  "success": true,
  "data": {
    "bookings": [
      {
        "id": 1,
        "reference_number": "ZAP-2024-001",
        "booking_date": "2024-12-25",
        "booking_time": "14:00",
        "participants": 8,
        "total_amount": "299.00",
        "amount_paid": "299.00",
        "status": "confirmed",
        "payment_status": "paid",
        "payment_method": "card",
        "special_requests": "...",
        "package": { ... },
        "location": { ... },
        "attractions": [ ... ],
        "addOns": [ ... ],
        "created_at": "2024-12-15T10:30:00Z"
      }
    ],
    "pagination": {
      "current_page": 1,
      "last_page": 5,
      "per_page": 10,
      "total": 42,
      "from": 1,
      "to": 10
    }
  }
}
```

## Files Modified

1. `src/pages/customer/CustomerReservation.tsx` - Complete rewrite
2. `src/services/bookingService.ts` - Updated getBookings method

## Files Backed Up

- `src/pages/customer/CustomerReservation.tsx.backup`

## Dependencies Used

- `qrcode` - QR code generation
- `jspdf` - PDF generation
- `html2canvas` - HTML to canvas conversion
- `lucide-react` - Icons
- `axios` - HTTP requests

## Notes

1. **Authentication**: The component retrieves customer data from `localStorage.getItem('zapzone_customer')`
2. **Fallback**: If no customer data exists, the component still works but shows empty state
3. **Error Handling**: All API calls are wrapped in try-catch with user-friendly error messages
4. **Performance**: Debounced search could be added for better performance with large datasets
5. **Accessibility**: Consider adding ARIA labels for screen readers

## Future Enhancements

1. Add email receipt functionality
2. Add print receipt option
3. Implement booking modification
4. Add filters by date range
5. Add booking reminders
6. Implement real-time status updates
7. Add booking history export (CSV/Excel)
8. Add sharing functionality for bookings
