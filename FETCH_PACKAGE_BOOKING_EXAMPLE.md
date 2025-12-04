# Fetch Package and Create Booking - Complete Example

This guide shows how to fetch a specific package from the backend and use that data to create a booking.

## 1. Fetch Package Data

### Using the Booking Service

```typescript
import bookingService from '../services/bookingService';

// Fetch package by ID
const fetchPackageForBooking = async (packageId: number) => {
  try {
    const response = await bookingService.getPackageById(packageId);
    
    if (response.success && response.data) {
      const pkg = response.data;
      console.log('Package loaded:', pkg);
      return pkg;
    }
  } catch (error) {
    console.error('Error fetching package:', error);
    throw error;
  }
};
```

## 2. Package Response Structure

Based on your example, the package data structure is:

```typescript
interface PackageResponse {
  success: boolean;
  data: {
    id: number;
    location_id: number;
    name: string;
    description: string;
    category: string;
    features: string;
    price: string;
    price_per_additional: string;
    max_participants: number;
    duration: number;
    duration_unit: 'hours' | 'minutes' | 'days';
    price_per_additional_30min: string | null;
    price_per_additional_1hr: string | null;
    availability_type: 'daily' | 'weekly' | 'monthly';
    available_days: string[];
    available_week_days: string[];
    available_month_days: string[];
    time_slot_start: string;
    time_slot_end: string;
    time_slot_interval: number;
    image: string[];
    is_active: boolean;
    created_at: string;
    updated_at: string;
    location: {
      id: number;
      company_id: number;
      name: string;
      address: string;
      city: string;
      state: string;
      zip_code: string;
      phone: string;
      email: string;
      timezone: string;
      is_active: boolean;
      created_at: string | null;
      updated_at: string | null;
    };
    attractions: Array<{
      id: number;
      location_id: number;
      name: string;
      price: string;
      description: string | null;
      image: string | null;
      is_active: boolean;
      pivot: {
        package_id: number;
        attraction_id: number;
      };
    }>;
    add_ons: Array<{
      id: number;
      location_id: number;
      name: string;
      price: string;
      description: string | null;
      image: string | null;
      is_active: boolean;
      pivot: {
        package_id: number;
        add_on_id: number;
      };
    }>;
    rooms: Array<{
      id: number;
      location_id: number;
      name: string;
      capacity: number | null;
      is_available: boolean;
      pivot: {
        package_id: number;
        room_id: number;
      };
    }>;
    gift_cards: Array<{
      id: number;
      code: string;
      type: 'fixed' | 'percentage';
      discount_value: number;
      status: 'active' | 'inactive';
    }>;
    promos: Array<{
      id: number;
      code: string;
      type: 'fixed' | 'percentage';
      discount_value: number;
      status: 'active' | 'inactive';
    }>;
  };
}
```

## 3. Complete Booking Flow Example

### Step 1: Fetch Package

```typescript
const BookingFlow: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [pkg, setPkg] = useState<PackageResponse['data'] | null>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const loadPackage = async () => {
      if (!id) return;
      
      try {
        setLoading(true);
        const response = await bookingService.getPackageById(Number(id));
        
        if (response.success && response.data) {
          setPkg(response.data);
        }
      } catch (error) {
        console.error('Error loading package:', error);
        alert('Failed to load package details');
      } finally {
        setLoading(false);
      }
    };
    
    loadPackage();
  }, [id]);
  
  if (loading) return <div>Loading package...</div>;
  if (!pkg) return <div>Package not found</div>;
  
  return <BookingForm pkg={pkg} />;
};
```

### Step 2: Display Package Information

```typescript
const BookingForm: React.FC<{ pkg: PackageResponse['data'] }> = ({ pkg }) => {
  // State for booking selections
  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [participants, setParticipants] = useState<number>(pkg.max_participants);
  const [selectedAddOns, setSelectedAddOns] = useState<{ [id: number]: number }>({});
  const [selectedAttractions, setSelectedAttractions] = useState<{ [id: number]: number }>({});
  
  return (
    <div className="booking-form">
      {/* Package Header */}
      <div className="package-header">
        <h1>{pkg.name}</h1>
        <p>{pkg.description}</p>
        <div className="package-details">
          <span>Category: {pkg.category}</span>
          <span>Duration: {pkg.duration} {pkg.duration_unit}</span>
          <span>Base Price: ${pkg.price}</span>
          <span>Max Participants: {pkg.max_participants}</span>
        </div>
      </div>
      
      {/* Room Selection */}
      {pkg.rooms && pkg.rooms.length > 0 && (
        <div className="room-selection">
          <h3>Select a Room</h3>
          {pkg.rooms.map((room) => (
            <div
              key={room.id}
              className={`room-card ${selectedRoomId === room.id ? 'selected' : ''}`}
              onClick={() => setSelectedRoomId(room.id)}
            >
              <h4>{room.name}</h4>
              {room.capacity && <p>Capacity: {room.capacity}</p>}
              {!room.is_available && <span className="unavailable">Unavailable</span>}
            </div>
          ))}
        </div>
      )}
      
      {/* Add-ons Selection */}
      {pkg.add_ons && pkg.add_ons.length > 0 && (
        <div className="addons-selection">
          <h3>Add-ons</h3>
          {pkg.add_ons.map((addon) => (
            <div key={addon.id} className="addon-item">
              <div>
                <h4>{addon.name}</h4>
                <p>${addon.price}</p>
              </div>
              <input
                type="number"
                min="0"
                value={selectedAddOns[addon.id] || 0}
                onChange={(e) => setSelectedAddOns({
                  ...selectedAddOns,
                  [addon.id]: parseInt(e.target.value) || 0
                })}
              />
            </div>
          ))}
        </div>
      )}
      
      {/* Attractions Selection */}
      {pkg.attractions && pkg.attractions.length > 0 && (
        <div className="attractions-selection">
          <h3>Additional Attractions</h3>
          {pkg.attractions.map((attraction) => (
            <div key={attraction.id} className="attraction-item">
              <div>
                <h4>{attraction.name}</h4>
                <p>${attraction.price}</p>
              </div>
              <input
                type="number"
                min="0"
                value={selectedAttractions[attraction.id] || 0}
                onChange={(e) => setSelectedAttractions({
                  ...selectedAttractions,
                  [attraction.id]: parseInt(e.target.value) || 0
                })}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
```

### Step 3: Create Booking with Package Data

```typescript
const handleCreateBooking = async () => {
  if (!pkg || !selectedRoomId) {
    alert('Please select a room');
    return;
  }
  
  try {
    // Prepare attraction IDs (only those with quantity > 0)
    const attractionIds = Object.entries(selectedAttractions)
      .filter(([, qty]) => qty > 0)
      .map(([id]) => Number(id));
    
    // Prepare addon IDs (only those with quantity > 0)
    const addonIds = Object.entries(selectedAddOns)
      .filter(([, qty]) => qty > 0)
      .map(([id]) => Number(id));
    
    // Calculate total amount
    const basePrice = Number(pkg.price);
    const addonsTotal = pkg.add_ons.reduce((sum, addon) => {
      const qty = selectedAddOns[addon.id] || 0;
      return sum + (Number(addon.price) * qty);
    }, 0);
    const attractionsTotal = pkg.attractions.reduce((sum, attraction) => {
      const qty = selectedAttractions[attraction.id] || 0;
      return sum + (Number(attraction.price) * qty);
    }, 0);
    
    // Additional participants cost
    const additionalParticipantsCost = participants > pkg.max_participants
      ? (participants - pkg.max_participants) * Number(pkg.price_per_additional)
      : 0;
    
    const totalAmount = basePrice + addonsTotal + attractionsTotal + additionalParticipantsCost;
    
    // Create booking data
    const bookingData = {
      // Guest information (if not logged in)
      guest_first_name: "John",
      guest_last_name: "Doe",
      guest_email: "john.doe@example.com",
      guest_phone: "1234567890",
      
      // Or use customer_id if logged in
      // customer_id: 123,
      
      // Package information from fetched data
      location_id: pkg.location_id,
      package_id: pkg.id,
      room_id: selectedRoomId,
      type: 'package' as const,
      
      // Booking details
      booking_date: selectedDate,
      booking_time: selectedTime,
      participants: participants,
      
      // Duration from package
      duration: pkg.duration,
      duration_unit: pkg.duration_unit as 'minutes' | 'hours',
      
      // Payment information
      total_amount: totalAmount,
      amount_paid: totalAmount, // Full payment
      payment_method: 'credit' as const,
      payment_status: 'paid' as const,
      status: 'confirmed' as const,
      
      // Selected items
      attraction_ids: attractionIds.length > 0 ? attractionIds : undefined,
      addon_ids: addonIds.length > 0 ? addonIds : undefined,
      
      // Optional fields
      notes: "Booking created from package selection",
    };
    
    // Create the booking
    const response = await bookingService.createBooking(bookingData);
    
    if (response.success && response.data) {
      console.log('Booking created successfully:', response.data);
      
      // Create time slot
      try {
        await bookingService.createTimeSlot({
          package_id: pkg.id,
          room_id: selectedRoomId,
          booking_id: response.data.id,
          customer_id: response.data.customer_id,
          booked_date: selectedDate,
          time_slot_start: selectedTime,
          duration: pkg.duration,
          duration_unit: pkg.duration_unit as 'minutes' | 'hours',
          status: 'booked',
          notes: "Time slot for booking #" + response.data.id,
        });
      } catch (timeSlotError) {
        console.error('Time slot creation failed:', timeSlotError);
        // Booking was created successfully, but time slot failed
      }
      
      // Navigate to confirmation page
      alert(`Booking created! Reference: ${response.data.reference_number}`);
      // navigate(`/booking-confirmation/${response.data.reference_number}`);
    }
  } catch (error) {
    console.error('Error creating booking:', error);
    alert('Failed to create booking. Please try again.');
  }
};
```

## 4. Using Your Example Data

Based on your provided JSON response, here's how to use it:

```typescript
// Example: Package ID 12 from your response
const packageId = 12;

// Fetch the package
const response = await bookingService.getPackageById(packageId);

// Your response will look like:
// {
//   "success": true,
//   "data": {
//     "id": 12,
//     "location_id": 1,
//     "name": "test package2",
//     "description": "adasdlasdhag akjsdhkasjdh asdkjads",
//     "category": "Birthday",
//     "price": "399.00",
//     "max_participants": 10,
//     "duration": 4,
//     "duration_unit": "hours",
//     ...
//   }
// }

const pkg = response.data;

// Access package data
console.log('Package Name:', pkg.name); // "test package2"
console.log('Price:', pkg.price); // "399.00"
console.log('Location:', pkg.location.name); // "brighton"
console.log('Rooms:', pkg.rooms); // Array of 2 rooms
console.log('Add-ons:', pkg.add_ons); // Array of 2 add-ons

// Create booking using this package
const bookingData = {
  guest_first_name: "Jane",
  guest_last_name: "Smith",
  guest_email: "jane@example.com",
  guest_phone: "5551234567",
  location_id: pkg.location_id, // 1
  package_id: pkg.id, // 12
  room_id: pkg.rooms[0].id, // 1 (test room)
  type: 'package' as const,
  booking_date: "2025-11-24", // Last Sunday of November (matches "Sunday-last")
  booking_time: "14:00", // Between 11:00:00 and 23:30:00
  participants: 8, // Less than max_participants (10)
  duration: pkg.duration, // 4
  duration_unit: pkg.duration_unit as 'hours', // "hours"
  total_amount: Number(pkg.price), // 399.00
  amount_paid: Number(pkg.price), // 399.00
  payment_method: 'credit' as const,
  payment_status: 'paid' as const,
  status: 'confirmed' as const,
  addon_ids: [1, 2], // Both add-ons from the package
};

// Submit the booking
const bookingResponse = await bookingService.createBooking(bookingData);
```

## 5. Calculate Available Dates Based on Package

```typescript
const calculateAvailableDates = (pkg: PackageResponse['data']) => {
  const dates: Date[] = [];
  const today = new Date();
  
  // Generate dates for next 90 days
  for (let i = 0; i < 90; i++) {
    const date = new Date();
    date.setDate(today.getDate() + i);
    
    let isAvailable = false;
    
    if (pkg.availability_type === 'monthly') {
      // For your example: "Sunday-last"
      const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
      
      pkg.available_month_days.forEach(pattern => {
        if (pattern.includes('-')) {
          const [patternDay, patternWeek] = pattern.split('-');
          
          if (patternDay === dayName && patternWeek === 'last') {
            // Check if this is last occurrence of this day in the month
            const nextWeek = new Date(date);
            nextWeek.setDate(date.getDate() + 7);
            
            if (nextWeek.getMonth() !== date.getMonth()) {
              isAvailable = true;
            }
          }
        }
      });
    }
    
    if (isAvailable) {
      dates.push(date);
    }
  }
  
  return dates;
};

// Usage
const availableDates = calculateAvailableDates(pkg);
console.log('Available booking dates:', availableDates);
// Example output: [Nov 24, 2025, Dec 29, 2025, ...]
```

## 6. Calculate Total Cost with Package Data

```typescript
const calculateBookingTotal = (
  pkg: PackageResponse['data'],
  participants: number,
  selectedAddOns: { [id: number]: number },
  selectedAttractions: { [id: number]: number }
) => {
  // Base package price
  let total = Number(pkg.price);
  
  // Additional participants cost
  if (participants > pkg.max_participants) {
    const additionalCount = participants - pkg.max_participants;
    total += additionalCount * Number(pkg.price_per_additional);
  }
  
  // Add-ons cost
  pkg.add_ons.forEach(addon => {
    const quantity = selectedAddOns[addon.id] || 0;
    total += Number(addon.price) * quantity;
  });
  
  // Attractions cost
  pkg.attractions.forEach(attraction => {
    const quantity = selectedAttractions[attraction.id] || 0;
    total += Number(attraction.price) * quantity;
  });
  
  return total;
};

// Usage with your package data
const total = calculateBookingTotal(
  pkg,
  12, // 12 participants (2 more than max_participants of 10)
  { 1: 2, 2: 1 }, // 2x "test add on" + 1x "Alfreda Gallegos"
  {} // No additional attractions
);

console.log('Total Cost:', total);
// Calculation:
// Base: $399.00
// Additional 2 participants: 2 x $24.00 = $48.00
// Add-on 1 (qty 2): 2 x $0.00 = $0.00
// Add-on 2 (qty 1): 1 x $0.00 = $0.00
// Total: $447.00
```

## 7. Full Integration Example

```typescript
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import bookingService from '../services/bookingService';

const PackageBookingPage: React.FC = () => {
  const { packageId } = useParams<{ packageId: string }>();
  const navigate = useNavigate();
  
  const [pkg, setPkg] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null);
  const [participants, setParticipants] = useState<number>(1);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedTime, setSelectedTime] = useState<string>('');
  
  // Load package
  useEffect(() => {
    const loadPackage = async () => {
      if (!packageId) return;
      
      try {
        const response = await bookingService.getPackageById(Number(packageId));
        if (response.success && response.data) {
          setPkg(response.data);
          setParticipants(response.data.max_participants);
          
          // Auto-select first room if available
          if (response.data.rooms.length > 0) {
            setSelectedRoomId(response.data.rooms[0].id);
          }
        }
      } catch (error) {
        console.error('Error loading package:', error);
        alert('Failed to load package');
      } finally {
        setLoading(false);
      }
    };
    
    loadPackage();
  }, [packageId]);
  
  // Create booking
  const handleBookNow = async () => {
    if (!pkg || !selectedRoomId || !selectedDate || !selectedTime) {
      alert('Please fill in all required fields');
      return;
    }
    
    try {
      const bookingData = {
        guest_first_name: "Customer",
        guest_last_name: "Name",
        guest_email: "customer@example.com",
        guest_phone: "1234567890",
        location_id: pkg.location_id,
        package_id: pkg.id,
        room_id: selectedRoomId,
        type: 'package' as const,
        booking_date: selectedDate,
        booking_time: selectedTime,
        participants: participants,
        duration: pkg.duration,
        duration_unit: pkg.duration_unit as 'minutes' | 'hours',
        total_amount: Number(pkg.price),
        amount_paid: Number(pkg.price),
        payment_method: 'credit' as const,
        payment_status: 'paid' as const,
        status: 'confirmed' as const,
      };
      
      const response = await bookingService.createBooking(bookingData);
      
      if (response.success && response.data) {
        alert('Booking created successfully!');
        navigate(`/booking-confirmation/${response.data.reference_number}`);
      }
    } catch (error) {
      console.error('Booking error:', error);
      alert('Failed to create booking');
    }
  };
  
  if (loading) return <div>Loading...</div>;
  if (!pkg) return <div>Package not found</div>;
  
  return (
    <div>
      <h1>{pkg.name}</h1>
      <p>{pkg.description}</p>
      <p>Price: ${pkg.price}</p>
      <p>Duration: {pkg.duration} {pkg.duration_unit}</p>
      
      {/* Room selection, date/time pickers, etc. */}
      
      <button onClick={handleBookNow}>Book Now</button>
    </div>
  );
};

export default PackageBookingPage;
```

This example shows the complete flow from fetching a package to creating a booking using that package's data!
