# Customer Reservations - Quick Reference Guide

## Component: `CustomerReservation.tsx`

### API Endpoint
```
GET /customers/bookings
```

### How It Works

#### 1. Customer Identification
The component automatically identifies the customer from localStorage:
```typescript
const customerData = localStorage.getItem('zapzone_customer');
const customer = customerData ? JSON.parse(customerData) : null;
```

Expected localStorage structure:
```json
{
  "id": 123,
  "email": "customer@example.com",
  "name": "John Doe"
}
```

#### 2. API Request Flow
```
User Opens Page
    ↓
Component Loads
    ↓
Fetch Customer Data from localStorage
    ↓
Build API Request with Filters
    ↓
GET /customers/bookings?customer_id=123&page=1&per_page=5&sort_by=booking_date&sort_order=desc
    ↓
Receive Bookings Data
    ↓
Display in UI
```

#### 3. Supported Query Parameters

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `customer_id` | number | Filter by customer ID | `123` |
| `guest_email` | string | Filter by guest email | `guest@example.com` |
| `search` | string | Search term (location, package name, reference) | `"Birthday"` |
| `sort_by` | string | Sort field | `"booking_date"` |
| `sort_order` | string | Sort direction | `"desc"` |
| `page` | number | Current page | `1` |
| `per_page` | number | Items per page (max 100) | `10` |

### Features

#### ✅ Search & Filter
- Search by package name
- Search by reference number
- Search by location name
- Real-time search (triggers on change)

#### ✅ Sorting
- By date (booking_date)
- By status
- By amount (total_amount)
- Ascending or descending

#### ✅ Pagination
- Customizable page size (5, 10, 20, 50)
- Page navigation
- Total results display

#### ✅ QR Code Generation
```typescript
// Simple reference number encoding
await QRCode.toDataURL(booking.reference_number, {
  width: 512,
  margin: 2,
  color: { dark: '#000000', light: '#FFFFFF' }
});
```

**Downloads as:** `zapzone-qrcode-{reference_number}.png`

#### ✅ Receipt Generation
- Professional PDF design
- Includes all booking details
- Customer information
- Package details
- Attractions & add-ons
- Payment summary
- QR code ready format

**Downloads as:** `zapzone-receipt-{reference_number}.pdf`

#### ✅ Booking Cancellation
Flow:
1. Click "Cancel" button
2. View refund policy
3. Confirm understanding
4. Provide cancellation reason
5. Submit cancellation
6. API updates booking status to "cancelled"
7. List refreshes automatically

### UI States

#### Loading State
```
🔄 Loading bookings...
```

#### Empty State
```
📦 No reservations yet
Start by booking a package from our entertainment offerings
[Explore Packages Button]
```

#### Error State
```
⚠️ Error loading bookings
{error message}
```

#### Success State
- List of booking cards
- Each card shows:
  - Package name
  - Status badge (color-coded)
  - Location
  - Date & time
  - Participants count
  - Action buttons
  - Expandable details

### Status Colors

| Status | Background | Text | Border |
|--------|------------|------|--------|
| Confirmed | Green | Dark Green | Light Green |
| Pending | Yellow | Dark Yellow | Light Yellow |
| Cancelled | Red | Dark Red | Light Red |
| Completed | Blue | Dark Blue | Light Blue |
| Checked-in | Purple | Dark Purple | Light Purple |

### Example API Response

```json
{
  "success": true,
  "data": {
    "bookings": [
      {
        "id": 1,
        "reference_number": "ZAP-2024-001",
        "customer_id": 123,
        "guest_name": null,
        "guest_email": null,
        "package_id": 5,
        "location_id": 2,
        "booking_date": "2024-12-25",
        "booking_time": "14:00",
        "participants": 8,
        "duration": 2,
        "duration_unit": "hours",
        "total_amount": "299.00",
        "amount_paid": "299.00",
        "discount_amount": "0.00",
        "payment_method": "card",
        "payment_status": "paid",
        "status": "confirmed",
        "special_requests": "Please include chocolate cake",
        "created_at": "2024-12-15T10:30:00.000000Z",
        "updated_at": "2024-12-15T10:30:00.000000Z",
        "package": {
          "id": 5,
          "name": "Birthday Bash Package",
          "description": "Perfect for birthday celebrations",
          "price": "299.00"
        },
        "location": {
          "id": 2,
          "name": "Brighton"
        },
        "attractions": [
          {
            "id": 1,
            "name": "Laser Tag",
            "pivot": { "quantity": 1 }
          }
        ],
        "addOns": [
          {
            "id": 3,
            "name": "Birthday Cake",
            "pivot": { "quantity": 1 }
          }
        ]
      }
    ],
    "pagination": {
      "current_page": 1,
      "last_page": 3,
      "per_page": 5,
      "total": 12,
      "from": 1,
      "to": 5
    }
  }
}
```

### Testing the Component

#### 1. Test with Valid Customer
```javascript
localStorage.setItem('zapzone_customer', JSON.stringify({
  id: 123,
  email: 'customer@example.com',
  name: 'John Doe'
}));
// Navigate to /customer/reservations
```

#### 2. Test Search
- Type in search box
- Should filter results automatically
- Tests: package name, location, reference number

#### 3. Test Sorting
- Change sort dropdown
- Toggle ascending/descending
- Verify results order changes

#### 4. Test Pagination
- Change page size
- Navigate between pages
- Verify correct data loads

#### 5. Test Downloads
- Click "Download Receipt" - Should generate PDF
- Click "Download QR Code" - Should download PNG

#### 6. Test Cancellation
- Click "Cancel" on confirmed booking
- Read refund policy
- Provide reason
- Confirm cancellation
- Verify booking status updates

### Troubleshooting

#### No bookings showing
- Check `zapzone_customer` in localStorage
- Verify API endpoint is correct
- Check network tab for API errors
- Verify customer has bookings in database

#### QR Code not downloading
- Check browser console for errors
- Verify `qrcode` package is installed
- Check browser allows downloads

#### PDF not generating
- Check `jspdf` and `html2canvas` packages
- Verify no console errors
- Try with different booking data

#### Cancellation not working
- Check API endpoint `/bookings/{id}` accepts PUT
- Verify authentication token is valid
- Check network response for errors

### Browser Requirements

- Modern browser (Chrome, Firefox, Edge, Safari)
- JavaScript enabled
- LocalStorage enabled
- Download permissions allowed

### Performance Tips

1. Implement debounced search (currently fires on every keystroke)
2. Cache booking data in React Query or SWR
3. Add virtual scrolling for large lists
4. Lazy load booking details
5. Optimize receipt HTML generation

### Security Considerations

1. Customer data in localStorage - consider encryption
2. API calls use Bearer token authentication
3. Booking cancellation requires authentication
4. QR codes contain only reference numbers (no sensitive data)
5. Receipts generated client-side (no server storage)
