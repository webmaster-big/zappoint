import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Plus, Minus } from 'lucide-react';
import QRCode from 'qrcode';
import { useThemeColor } from '../../../hooks/useThemeColor';
import Toast from '../../../components/ui/Toast';
import bookingService, { type CreateBookingData } from '../../../services/bookingService';
import { bookingCacheService } from '../../../services/BookingCacheService';
import { packageCacheService } from '../../../services/PackageCacheService';
import EmptyStateModal from '../../../components/ui/EmptyStateModal';
import StandardButton from '../../../components/ui/StandardButton';
import roomService from '../../../services/RoomService';
import { locationService } from '../../../services/LocationService';
import LocationSelector from '../../../components/admin/LocationSelector';
import { getStoredUser, getImageUrl } from '../../../utils/storage';
import { formatDurationDisplay } from '../../../utils/timeFormat';
import { derivePaymentStatus } from '../../../types/Bookings.types';

// Extended booking data interface for manual booking (includes guest of honor fields)
interface ExtendedBookingData extends CreateBookingData {
  guest_of_honor_name?: string;
  guest_of_honor_age?: number;
  guest_of_honor_gender?: 'male' | 'female' | 'other';
  skip_date_validation?: boolean;
  is_manual_entry?: boolean;
  // Optional address fields
  guest_address?: string;
  guest_city?: string;
  guest_state?: string;
  guest_zip?: string;
  guest_country?: string;
}

// Helper function to sort rooms numerically (extracts numbers from room names)
const sortRoomsNumerically = (rooms: any[]): any[] => {
  return [...rooms].sort((a, b) => {
    // Extract numbers from room names (e.g., "Room 1" -> 1, "Space 10" -> 10)
    const numA = parseInt(a.name.replace(/\D/g, '')) || 0;
    const numB = parseInt(b.name.replace(/\D/g, '')) || 0;
    if (numA !== numB) return numA - numB;
    // If no numbers or same numbers, sort alphabetically
    return a.name.localeCompare(b.name);
  });
};

const ManualBooking: React.FC = () => {
  const navigate = useNavigate();
  const { themeColor, fullColor } = useThemeColor();
  const currentUser = getStoredUser();
  const isCompanyAdmin = currentUser?.role === 'company_admin';
  const [locations, setLocations] = useState<Array<{ id: number; name: string; address?: string; city?: string; state?: string }>>([]);
  const [selectedLocation, setSelectedLocation] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [pkg, setPkg] = useState<any>(null);
  const [packages, setPackages] = useState<any[]>([]);
  const [showEmptyModal, setShowEmptyModal] = useState(false);
  const [selectedAddOns, setSelectedAddOns] = useState<{ [id: number]: number }>({});
  const [selectedAttractions, setSelectedAttractions] = useState<{ [id: number]: number }>({});
  const [creatingRoom, setCreatingRoom] = useState(false);
  const [sendEmail, setSendEmail] = useState(true);
  const [calculatedTotal, setCalculatedTotal] = useState(0);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [form, setForm] = useState<{
    customerName: string;
    email: string;
    phone: string;
    packageId: string;
    roomId: string;
    bookingDate: string;
    bookingTime: string;
    participants: number;
    paymentMethod: 'in-store' | 'card' | 'paylater';
    paymentStatus: 'paid' | 'partial' | 'pending';
    status: 'pending' | 'confirmed' | 'checked-in' | 'completed' | 'cancelled';
    notes: string;
    totalAmount: string;
    amountPaid: string;
    guestOfHonorName: string;
    guestOfHonorAge: string;
    guestOfHonorGender: string;
    // Optional address fields
    guestAddress: string;
    guestCity: string;
    guestState: string;
    guestZip: string;
    guestCountry: string;
  }>({
    customerName: '',
    email: '',
    phone: '',
    packageId: '',
    roomId: '',
    bookingDate: '',
    bookingTime: '',
    participants: 1,
    paymentMethod: 'in-store',
    paymentStatus: 'paid',
    status: 'completed',
    notes: '',
    totalAmount: '',
    amountPaid: '',
    guestOfHonorName: '',
    guestOfHonorAge: '',
    guestOfHonorGender: '',
    // Optional address fields
    guestAddress: '',
    guestCity: '',
    guestState: '',
    guestZip: '',
    guestCountry: ''
  });

  // Fetch locations for company admin
  useEffect(() => {
    if (isCompanyAdmin) {
      const fetchLocations = async () => {
        try {
          const response = await locationService.getLocations();
          if (response.success && response.data) {
            setLocations(Array.isArray(response.data) ? response.data : []);
          }
        } catch (error) {
          console.error('Error fetching locations:', error);
        }
      };
      fetchLocations();
    }
  }, [isCompanyAdmin]);

  useEffect(() => {
    loadPackages();
  }, [selectedLocation]);

  useEffect(() => {
    if (form.packageId) {
      loadPackageDetails(parseInt(form.packageId));
    } else {
      setPkg(null);
    }
  }, [form.packageId]);

  const loadPackages = async () => {
    try {
      const user = getStoredUser();
      
      if (!user) {
        console.error('No user found');
        return;
      }

      // Try cache first for faster loading
      const cacheFilters = selectedLocation !== null 
        ? { location_id: selectedLocation, status: 'active' as const }
        : { status: 'active' as const };
      
      const cachedPackages = await packageCacheService.getFilteredPackagesFromCache(cacheFilters);
      
      if (cachedPackages && cachedPackages.length > 0) {
        console.log('📦 Using cached packages:', cachedPackages.length);
        setPackages(cachedPackages);
        return;
      }

      // Use the same method as OnsiteBooking - backend will filter based on user role
      const params: any = {user_id: user.id};
      if (selectedLocation !== null) {
        params.location_id = selectedLocation;
      }
      const response = await bookingService.getPackages(params);
      
      console.log('📦 Packages response:', response);
      
      if (response.success && response.data && response.data.packages) {
        const pkgs = Array.isArray(response.data.packages) ? response.data.packages : [];
        setPackages(pkgs);
        
        // Cache the packages for future use
        if (pkgs.length > 0) {
          await packageCacheService.cachePackages(pkgs);
        }
        
        // Show modal if no packages available
        if (pkgs.length === 0) {
          setShowEmptyModal(true);
        }
      } else {
        setPackages([]);
        setShowEmptyModal(true);
      }
    } catch (error) {
      console.error('Error loading packages:', error);
      setPackages([]);
      setShowEmptyModal(true);
      setToast({ message: 'Failed to load packages', type: 'error' });
    }
  };

  const loadPackageDetails = async (packageId: number) => {
    try {
      const response = await bookingService.getPackageById(packageId);
      console.log('📦 Package data received:', response.data);
      setPkg(response.data);
      
      // Set participants to package minimum if current value is less
      if (response.data?.min_participants && form.participants < response.data.min_participants) {
        setForm(prev => ({
          ...prev,
          participants: response.data.min_participants || 1
        }));
      }
    } catch (error) {
      console.error('Error loading package details:', error);
      setToast({ message: 'Failed to load package details', type: 'error' });
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleAddOnChange = (addOnId: number, change: number) => {
    const addOn = pkg?.add_ons?.find((a: any) => a.id === addOnId);
    const minQty = addOn?.min_quantity ?? 0;
    const maxQty = addOn?.max_quantity ?? 99; // Default max to prevent unrealistic quantities
    
    setSelectedAddOns(prev => {
      const currentValue = prev[addOnId] || 0;
      let newValue = currentValue + change;
      
      // Enforce max quantity limit
      if (newValue > maxQty) {
        newValue = maxQty;
      }
      
      // If decreasing and going to 0 or below, remove the item
      if (newValue <= 0) {
        const { [addOnId]: _removed, ...rest } = prev;
        return rest;
      }
      
      // If setting for first time and min_quantity is set, use min_quantity
      if (currentValue === 0 && change > 0 && minQty > 1) {
        newValue = minQty;
      }
      
      return { ...prev, [addOnId]: newValue };
    });
  };

  const handleAttractionChange = (attractionId: number, change: number) => {
    const attraction = pkg?.attractions?.find((a: any) => a.id === attractionId);
    const minQty = attraction?.min_quantity ?? 0;
    const maxQty = attraction?.max_quantity ?? 99; // Default max to prevent unrealistic quantities
    
    setSelectedAttractions(prev => {
      const currentValue = prev[attractionId] || 0;
      let newValue = currentValue + change;
      
      // Enforce max quantity limit
      if (newValue > maxQty) {
        newValue = maxQty;
      }
      
      // If decreasing and going to 0 or below, remove the item
      if (newValue <= 0) {
        const { [attractionId]: _removed, ...rest } = prev;
        return rest;
      }
      
      // If setting for first time and min_quantity is set, use min_quantity
      if (currentValue === 0 && change > 0 && minQty > 1) {
        newValue = minQty;
      }
      
      return { ...prev, [attractionId]: newValue };
    });
  };

  const handleCreateRoom = async (roomName: string) => {
    if (!roomName.trim()) return;
    
    try {
      setCreatingRoom(true);
      const user = getStoredUser();
      
      if (!user?.location_id) {
        setToast({ message: 'User location not found', type: 'error' });
        return;
      }

      const response = await roomService.createRoom({
        location_id: user.location_id,
        name: roomName.trim(),
        is_available: true
      });

      if (response.success && response.data) {
        // Add room to package_room table
        if (form.packageId) {
          try {
            await bookingService.createPackageRoom({
              package_id: parseInt(form.packageId),
              room_id: response.data.id
            });
          } catch (error) {
            console.error('Error linking space to package:', error);
            // Continue even if linking fails - room is still created
          }
        }

        // Update the package's rooms list
        setPkg((prev: any) => ({
          ...prev,
          rooms: [...(prev.rooms || []), response.data]
        }));

        // Set the newly created space as selected
        setForm(prev => ({
          ...prev,
          roomId: response.data.id.toString()
        }));

        // Reload package details to get updated spaces
        if (form.packageId) {
          await loadPackageDetails(parseInt(form.packageId));
        }
      }
    } catch (error: any) {
      console.error('Error creating Space:', error);
      const errorMsg = error.response?.data?.message || error.message || 'Failed to create Space';
      setToast({ message: errorMsg, type: 'error' });
    } finally {
      setCreatingRoom(false);
    }
  };

  // Calculate total - now updates state for better reactivity
  const calculateTotal = () => {
    if (!pkg) return 0;

    let total = 0;
    const minParticipants = pkg.min_participants || 1;
    const pricePerAdditional = Number(pkg.price_per_additional || 0);

    if (pkg.pricing_type === 'per_person') {
      // Per-person pricing: base price covers all participants
      total += Number(pkg.price) * form.participants;
    } else {
      // Fixed pricing: base price covers min_participants, charge extra for participants beyond min
      if (form.participants <= minParticipants) {
        total += Number(pkg.price);
      } else {
        const extraParticipants = form.participants - minParticipants;
        total += Number(pkg.price) + (extraParticipants * pricePerAdditional);
      }
    }

    Object.entries(selectedAddOns).forEach(([id, quantity]) => {
      const addOn = pkg.add_ons?.find((a: any) => a.id === parseInt(id));
      if (addOn) {
        if (addOn.pricing_type === 'per_person') {
          total += Number(addOn.price) * quantity * form.participants;
        } else {
          total += Number(addOn.price) * quantity;
        }
      }
    });

    Object.entries(selectedAttractions).forEach(([id, quantity]) => {
      const attraction = pkg.attractions?.find((a: any) => a.id === parseInt(id));
      if (attraction) {
        if (attraction.pricing_type === 'per_person') {
          total += Number(attraction.price) * quantity * form.participants;
        } else {
          total += Number(attraction.price) * quantity;
        }
      }
    });

    return total;
  };

  // Recalculate total whenever relevant values change
  useEffect(() => {
    if (pkg) {
      const total = calculateTotal();
      setCalculatedTotal(total);
    }
  }, [pkg, form.participants, selectedAddOns, selectedAttractions]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!form.customerName || !form.email || !form.packageId || !form.bookingDate || !form.bookingTime) {
      setToast({ message: 'Please fill in all required fields', type: 'error' });
      return;
    }

    if (!pkg) {
      setToast({ message: 'Please select a valid package', type: 'error' });
      return;
    }

    // Validate space selection if spaces are available for the package
    if (pkg.rooms && pkg.rooms.length > 0 && !form.roomId) {
      setToast({ message: 'Please select a space for this booking', type: 'error' });
      return;
    }

    try {
      setLoading(true);
      
      const user = getStoredUser();
      const calculatedTotal = calculateTotal();
      const finalTotalAmount = form.totalAmount ? Number(form.totalAmount) : calculatedTotal;
      const finalAmountPaid = form.paymentMethod === 'paylater' ? 0 : (form.amountPaid ? Number(form.amountPaid) : finalTotalAmount);
      
      // Auto-derive payment status from amounts
      const derivedPaymentStatus = derivePaymentStatus(finalAmountPaid, finalTotalAmount);
      
      console.log('📦 Building additional attractions/addons...', {
        selectedAttractions,
        selectedAddOns,
        pkgAttractions: pkg?.attractions,
        pkgAddOns: pkg?.add_ons
      });
      
      // Prepare add-ons with price_at_booking - filter out zero quantities and validate
      const additionalAddons = Object.entries(selectedAddOns)
        .filter(([, quantity]) => quantity > 0)
        .map(([id, quantity]) => {
          const addOn = pkg.add_ons?.find((a: any) => a.id === parseInt(id));
          const addonId = parseInt(id);
          
          if (isNaN(addonId) || !addOn) {
            console.warn(`⚠️ Invalid add-on ID or not found: ${id}, available:`, pkg.add_ons?.map((a: any) => a.id));
            return null;
          }
          
          // price_at_booking is unit price, backend calculates total with quantity
          const unitPrice = Number(addOn.price);
          console.log(`✅ Add-on found: ${addOn.name}, price: ${unitPrice}, quantity: ${quantity}`);
          
          return {
            addon_id: addonId,
            quantity: quantity,
            price_at_booking: unitPrice
          };
        })
        .filter((item): item is { addon_id: number; quantity: number; price_at_booking: number } => item !== null);

      // Prepare attractions with price_at_booking - filter out zero quantities and validate
      const additionalAttractions = Object.entries(selectedAttractions)
        .filter(([, quantity]) => quantity > 0)
        .map(([id, quantity]) => {
          const attraction = pkg.attractions?.find((a: any) => a.id === parseInt(id));
          const attractionId = parseInt(id);
          
          if (isNaN(attractionId) || !attraction) {
            console.warn(`⚠️ Invalid attraction ID or not found: ${id}, available:`, pkg.attractions?.map((a: any) => a.id));
            return null;
          }
          
          // price_at_booking is unit price, backend calculates total with quantity
          const unitPrice = Number(attraction.price);
          console.log(`✅ Attraction found: ${attraction.name}, price: ${unitPrice}, quantity: ${quantity}`);
          
          return {
            attraction_id: attractionId,
            quantity: quantity,
            price_at_booking: unitPrice
          };
        })
        .filter((item): item is { attraction_id: number; quantity: number; price_at_booking: number } => item !== null);
      
      // Calculate duration - convert days to hours if needed (API only accepts minutes, hours, or hours and minutes)
      const durationValue = pkg.duration ? Number(pkg.duration) : 2;
      const durationUnitRaw = pkg.duration_unit || 'hours';
      let finalDuration = durationValue;
      let finalDurationUnit: 'minutes' | 'hours' | 'hours and minutes' = 'hours';
      
      if (durationUnitRaw.toLowerCase() === 'days') {
        finalDuration = durationValue * 24;
        finalDurationUnit = 'hours';
      } else if (durationUnitRaw.toLowerCase() === 'minutes') {
        finalDuration = durationValue;
        finalDurationUnit = 'minutes';
      } else if (durationUnitRaw === 'hours and minutes') {
        finalDuration = durationValue;
        finalDurationUnit = 'hours and minutes';
      } else {
        finalDuration = durationValue;
        finalDurationUnit = 'hours';
      }
      
      // Determine location_id: use selected location (for company admin) or user's location
      const locationId = selectedLocation || user?.location_id || 1;
      
      const bookingData: ExtendedBookingData = {
        guest_name: form.customerName,
        guest_email: form.email,
        guest_phone: form.phone,
        package_id: parseInt(form.packageId),
        room_id: form.roomId ? parseInt(form.roomId) : undefined,
        type: 'package' as const,
        booking_date: form.bookingDate,
        booking_time: form.bookingTime,
        participants: form.participants,
        duration: finalDuration,
        duration_unit: finalDurationUnit,
        total_amount: finalTotalAmount,
        amount_paid: finalAmountPaid,
        payment_method: (form.paymentMethod === 'in-store' ? 'in-store' : form.paymentMethod) as 'card' | 'in-store' | 'paylater',
        payment_status: derivedPaymentStatus,
        status: form.status as 'pending' | 'confirmed' | 'checked-in' | 'completed' | 'cancelled',
        notes: form.notes || undefined,
        location_id: locationId,
        created_by: user?.id,
        additional_addons: additionalAddons.length > 0 ? additionalAddons : undefined,
        additional_attractions: additionalAttractions.length > 0 ? additionalAttractions : undefined,
        guest_of_honor_name: pkg.has_guest_of_honor && form.guestOfHonorName ? form.guestOfHonorName : undefined,
        guest_of_honor_age: pkg.has_guest_of_honor && form.guestOfHonorAge ? parseInt(form.guestOfHonorAge) : undefined,
        guest_of_honor_gender: pkg.has_guest_of_honor && form.guestOfHonorGender ? form.guestOfHonorGender as 'male' | 'female' | 'other' : undefined,
        // Optional address fields
        guest_address: form.guestAddress || undefined,
        guest_city: form.guestCity || undefined,
        guest_state: form.guestState || undefined,
        guest_zip: form.guestZip || undefined,
        guest_country: form.guestCountry || undefined,
        skip_date_validation: true, // Allow past dates for manual booking records
        is_manual_entry: true, // Flag this as a manually entered historical record
      };

      console.log('📤 Sending manual booking request:', bookingData);
      console.log('🎟️ Additional attractions:', additionalAttractions);
      console.log('➕ Additional add-ons:', additionalAddons);
      console.log('\n🔍 === BOOKING REQUEST VALIDATION ===');
      console.log('✅ guest_name:', bookingData.guest_name || '❌ MISSING');
      console.log('✅ guest_email:', bookingData.guest_email || '❌ MISSING');
      console.log('✅ package_id:', bookingData.package_id || '❌ MISSING');
      console.log('✅ room_id:', bookingData.room_id ? `${bookingData.room_id}` : '⚠️ OPTIONAL');
      console.log('✅ booking_time:', bookingData.booking_time || '❌ MISSING');
      console.log('✅ booking_date:', bookingData.booking_date || '❌ MISSING');
      console.log('✅ participants:', bookingData.participants || '❌ MISSING');
      console.log('✅ location_id:', bookingData.location_id || '❌ MISSING');
      console.log('💰 Pricing:', {
        total_amount: bookingData.total_amount,
        amount_paid: bookingData.amount_paid,
        payment_method: bookingData.payment_method,
        payment_status: bookingData.payment_status
      });
      console.log('================================\n');
      
      const response = await bookingService.createBooking(bookingData);
      
      console.log('✅ Booking creation response:', response);
      
      if (response.success && response.data) {
        const bookingId = response.data.id;
        const referenceNumber = response.data.reference_number;
        
        console.log('✅ Booking created:', { bookingId, referenceNumber });
        
        // Add the new booking to cache
        await bookingCacheService.addBookingToCache(response.data);
        
        // Generate QR code with the reference number
        try {
          const qrCodeBase64 = await QRCode.toDataURL(referenceNumber, {
            width: 300,
            margin: 2,
            color: { dark: '#000000', light: '#FFFFFF' }
          });
          
          console.log('📱 QR Code generated for reference:', referenceNumber);
          
          // Store QR code with email preference - this triggers email sending
          const qrResponse = await bookingService.storeQrCode(bookingId, qrCodeBase64, sendEmail);
          console.log('✅ QR code stored with response:', qrResponse);
          console.log('✅ Email preference sent:', sendEmail);
        } catch (qrError) {
          console.error('⚠️ Failed to generate/store QR code:', qrError);
          // Don't fail the entire process if QR code fails
        }
        
        const emailStatus = sendEmail ? ' Confirmation email sent.' : '';
        const successMsg = `Past booking recorded successfully! Reference: ${referenceNumber}${emailStatus}`;
        setToast({ message: successMsg, type: 'success' });
        
        // Navigate after short delay to show toast
        setTimeout(() => {
          navigate('/bookings');
        }, 1500);
      } else {
        const errorMsg = response.message || 'Unknown error occurred';
        console.error('Booking creation failed:', errorMsg);
        setToast({ message: `Failed to create booking: ${errorMsg}`, type: 'error' });
      }
    } catch (error: unknown) {
      console.error('❌ Error creating past booking:', error);
      const err = error as { 
        response?: { 
          data?: { 
            message?: string; 
            error?: string; 
            errors?: Record<string, string[]>;
            id?: number 
          };
          status?: number;
        }; 
        message?: string 
      };
      
      // Log detailed error info for debugging
      if (err.response) {
        console.error('Response status:', err.response.status);
        console.error('Response data:', err.response.data);
      }
      
      // Extract error message from various possible locations
      let errorMsg = 'Unknown error';
      if (err.response?.data?.message) {
        errorMsg = err.response.data.message;
      } else if (err.response?.data?.error) {
        errorMsg = err.response.data.error;
      } else if (err.response?.data?.errors) {
        // Handle Laravel validation errors
        const validationErrors = Object.entries(err.response.data.errors)
          .map(([field, messages]) => `${field}: ${messages.join(', ')}`)
          .join('; ');
        errorMsg = validationErrors;
      } else if (err.message) {
        errorMsg = err.message;
      }
      
      // Check if error response actually contains booking data (false error)
      if (err.response?.data?.id) {
        console.log('Booking may have been created despite error response');
        setToast({ message: 'Booking may have been recorded. Please check the bookings list to confirm.', type: 'info' });
        setTimeout(() => {
          navigate('/bookings');
        }, 2000);
      } else {
        setToast({ message: `Error creating booking: ${errorMsg}`, type: 'error' });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <StandardButton
            variant="secondary"
            icon={ArrowLeft}
            onClick={() => navigate('/bookings')}
          >
            Back to Bookings
          </StandardButton>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Record Past Booking</h1>
              <p className="text-sm text-gray-500 mt-1">Add historical booking records without validation</p>
            </div>
            
            {isCompanyAdmin && (
              <LocationSelector
                locations={locations.map(loc => ({
                  id: loc.id.toString(),
                  name: loc.name,
                  address: loc.address || '',
                  city: loc.city || '',
                  state: loc.state || ''
                }))}
                selectedLocation={selectedLocation?.toString() || ''}
                onLocationChange={(id) => setSelectedLocation(id ? Number(id) : null)}
                themeColor={themeColor}
                fullColor={fullColor}
                variant="compact"
                showAllOption={true}
              />
            )}
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="max-w-7xl mx-auto px-6 py-8">
        <div className={`grid gap-6 transition-all duration-500 ${
          form.packageId 
            ? 'grid-cols-1 lg:grid-cols-3' 
            : 'grid-cols-1'
        }`}>
          
          {/* Main Content - Left Side */}
          <div className={`space-y-6 transition-all duration-500 ${
            form.packageId ? 'lg:col-span-2' : 'col-span-1'
          }`}>
            
            {/* Step 1: Package Selection */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-1">
                    {form.packageId ? 'Selected Package' : 'Select Package'}
                  </h2>
                  <p className="text-sm text-gray-600">
                    {form.packageId ? 'Your chosen package for this booking' : 'Choose the package for this booking'}
                  </p>
                </div>
                {form.packageId && (
                  <StandardButton
                    variant="secondary"
                    icon={ArrowLeft}
                    onClick={() => {
                      setForm(prev => ({ ...prev, packageId: '', roomId: '' }));
                      setPkg(null);
                      setSelectedAddOns({});
                      setSelectedAttractions({});
                    }}
                  >
                    Change Package
                  </StandardButton>
                )}
              </div>
              <div className="grid grid-cols-1 gap-4">
                {Array.isArray(packages) && packages
                  .filter((p: any) => !form.packageId || form.packageId === p.id.toString())
                  .map((p: any) => (
                  <div
                    key={p.id}
                    onClick={() => {
                      if (!form.packageId) {
                        const event = {
                          target: { name: 'packageId', value: p.id.toString() }
                        } as any;
                        handleInputChange(event);
                      }
                    }}
                    className={`border-2 rounded-lg p-5 transition-all ${
                      form.packageId === p.id.toString()
                        ? `border-${themeColor}-500 bg-${themeColor}-50 shadow-sm`
                        : `border-gray-200 hover:border-${themeColor}-300 hover:bg-gray-50 cursor-pointer`
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-bold text-gray-900">{p.name}</h3>
                          {form.packageId === p.id.toString() && (
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-${themeColor}-100 text-${themeColor}-700`}>
                              <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"></path>
                              </svg>
                              Selected
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 mb-3">{p.description}</p>
                        <div className="flex flex-wrap gap-2">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-${themeColor}-50 text-${themeColor}-700 border border-${themeColor}-200`}>
                            {p.category || 'Package'}
                          </span>
                          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-700">
                            {formatDurationDisplay(p.duration, p.duration_unit)}
                          </span>
                          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-700">
                            Up to {p.max_participants} people
                          </span>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="flex items-baseline gap-1 justify-end">
                          <span className="text-sm text-gray-500">$</span>
                          <span className={`text-3xl font-bold text-${themeColor}-600`}>{p.price}</span>
                        </div>
                        <span className="text-xs text-gray-500 mt-1 block">{p.pricing_type === 'per_person' ? 'per person' : 'per booking'}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {pkg && (
              <>
                {/* Step 2: Customer & Booking Info */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <div className="mb-6">
                    <h2 className="text-2xl font-bold text-gray-900 mb-1">Customer & Booking Details</h2>
                    <p className="text-sm text-gray-600">Enter customer information and booking schedule</p>
                  </div>
                  <div className="space-y-6">
                    {/* Customer Info */}
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <div className={`h-1 w-1 rounded-full bg-${themeColor}-600`}></div>
                        Customer Information
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-2">Full Name *</label>
                          <input
                            type="text"
                            name="customerName"
                            value={form.customerName}
                            onChange={handleInputChange}
                            required
                            className={`w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-transparent transition-all`}
                            placeholder="John Doe"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Email Address *</label>
                          <input
                            type="email"
                            name="email"
                            value={form.email}
                            onChange={handleInputChange}
                            required
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring--500 focus:border-transparent transition-all"
                            placeholder="john@example.com"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number</label>
                          <input
                            type="tel"
                            name="phone"
                            value={form.phone}
                            onChange={handleInputChange}
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring--500 focus:border-transparent transition-all"
                            placeholder="+1 (555) 123-4567"
                          />
                        </div>
                        
                        {/* Optional Address Fields */}
                        <div className="md:col-span-2 mt-2">
                          <label className="block text-sm font-medium text-gray-700 mb-2">Address <span className="text-gray-400 font-normal">(Optional)</span></label>
                          <input
                            type="text"
                            name="guestAddress"
                            value={form.guestAddress}
                            onChange={handleInputChange}
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring--500 focus:border-transparent transition-all"
                            placeholder="123 Main St"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">City <span className="text-gray-400 font-normal">(Optional)</span></label>
                          <input
                            type="text"
                            name="guestCity"
                            value={form.guestCity}
                            onChange={handleInputChange}
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring--500 focus:border-transparent transition-all"
                            placeholder="New York"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">State <span className="text-gray-400 font-normal">(Optional)</span></label>
                          <input
                            type="text"
                            name="guestState"
                            value={form.guestState}
                            onChange={handleInputChange}
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring--500 focus:border-transparent transition-all"
                            placeholder="NY"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">ZIP Code <span className="text-gray-400 font-normal">(Optional)</span></label>
                          <input
                            type="text"
                            name="guestZip"
                            value={form.guestZip}
                            onChange={handleInputChange}
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring--500 focus:border-transparent transition-all"
                            placeholder="10001"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Country <span className="text-gray-400 font-normal">(Optional)</span></label>
                          <input
                            type="text"
                            name="guestCountry"
                            value={form.guestCountry}
                            onChange={handleInputChange}
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring--500 focus:border-transparent transition-all"
                            placeholder="United States"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="border-t border-gray-200"></div>

                    {/* Booking Details */}
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <div className={`h-1 w-1 rounded-full bg-${themeColor}-600`}></div>
                        Booking Schedule
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Date *</label>
                          <input
                            type="date"
                            name="bookingDate"
                            value={form.bookingDate}
                            onChange={handleInputChange}
                            required
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring--500 focus:border-transparent transition-all"
                          />
                          <p className="text-xs text-gray-500 mt-1">Past dates allowed for historical records</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Time *</label>
                          <input
                            type="time"
                            name="bookingTime"
                            value={form.bookingTime}
                            onChange={handleInputChange}
                            required
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring--500 focus:border-transparent transition-all"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Participants *</label>
                          <input
                            type="number"
                            name="participants"
                            value={form.participants}
                            onChange={(e) => {
                              let value = parseInt(e.target.value) || 1;
                              // Enforce max_participants as hard upper limit
                              if (pkg?.max_participants && value > pkg.max_participants) {
                                value = pkg.max_participants;
                              }
                              // Enforce minimum of 1
                              if (value < 1) {
                                value = 1;
                              }
                              setForm(prev => ({ ...prev, participants: value }));
                            }}
                            onWheel={(e) => (e.target as HTMLInputElement).blur()}
                            min="1"
                            max={pkg?.max_participants}
                            required
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring--500 focus:border-transparent transition-all"
                          />
                          {pkg && pkg.pricing_type !== 'per_person' && form.participants > (pkg.min_participants || 1) && pkg.price_per_additional && (
                            <p className="text-xs text-amber-600 mt-1.5 flex items-center gap-1">
                              <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                              </svg>
                              {form.participants - (pkg.min_participants || 1)} additional participant{form.participants - (pkg.min_participants || 1) > 1 ? 's' : ''} @ ${pkg.price_per_additional} each
                            </p>
                          )}
                          {pkg && (
                            <p className="text-xs text-gray-500 mt-1">
                              Min: {pkg.min_participants || 1} • Max: {pkg.max_participants} participants
                            </p>
                          )}
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Booking Status *</label>
                          <select
                            name="status"
                            value={form.status}
                            onChange={handleInputChange}
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring--500 focus:border-transparent transition-all"
                          >
                            <option value="completed">Completed</option>
                            <option value="confirmed">Confirmed</option>
                            <option value="checked-in">Checked In</option>
                            <option value="cancelled">Cancelled</option>
                            <option value="pending">Pending</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Room Selection */}
                    {pkg.rooms && pkg.rooms.length > 0 && (
                      <>
                        <div className="border-t border-gray-200"></div>
                        <div>
                          <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                            <div className={`h-1 w-1 rounded-full bg-${themeColor}-600`}></div>
                            Space Selection *
                          </h3>
                          <div className="flex flex-wrap gap-2">
                            {Array.isArray(pkg.rooms) && sortRoomsNumerically(pkg.rooms).map((room: any) => (
                              <StandardButton
                                type="button"
                                key={room.id}
                                variant={form.roomId === room.id.toString() ? 'primary' : 'secondary'}
                                size="sm"
                                onClick={() => {
                                  const event = {
                                    target: { name: 'roomId', value: room.id.toString() }
                                  } as any;
                                  handleInputChange(event);
                                }}
                              >
                                {room.name}
                              </StandardButton>
                            ))}
                            <input
                              type="text"
                              placeholder="Type new Space name"
                              id="new-room-name"
                              className="rounded-lg border border-gray-300 px-4 py-2 text-sm bg-white transition-all placeholder:text-gray-400 focus:ring-2 focus:ring-${themeColor}-500 focus:border-transparent"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  const input = e.target as HTMLInputElement;
                                  handleCreateRoom(input.value);
                                  input.value = '';
                                }
                              }}
                            />
                            <StandardButton
                              type="button"
                              variant="ghost"
                              size="sm"
                              icon={Plus}
                              disabled={creatingRoom}
                              loading={creatingRoom}
                              onClick={() => {
                                const input = document.getElementById('new-room-name') as HTMLInputElement;
                                if (input?.value) {
                                  handleCreateRoom(input.value);
                                  input.value = '';
                                }
                              }}
                            >
                              {''}
                            </StandardButton>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Step 3: Add-ons & Attractions */}
                {((pkg.add_ons && pkg.add_ons.length > 0) || (pkg.attractions && pkg.attractions.length > 0)) && (
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <div className="mb-6">
                      <h2 className="text-2xl font-bold text-gray-900 mb-1">Add-ons & Attractions</h2>
                      <p className="text-sm text-gray-600">Optional extras to enhance the experience</p>
                    </div>
                    <div>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {Array.isArray(pkg.add_ons) && pkg.add_ons.map((addOn: any) => {
                          const isSelected = selectedAddOns[addOn.id] > 0;
                          const quantity = selectedAddOns[addOn.id] || 0;
                          const minQty = addOn.min_quantity ?? 1;
                          const maxQty = addOn.max_quantity ?? 99;
                          
                          return (
                            <div
                              key={addOn.id}
                              className={`rounded-xl overflow-hidden border-2 transition-all ${
                                isSelected 
                                  ? `border-${themeColor}-500 shadow-lg` 
                                  : 'border-gray-200'
                              }`}
                            >
                              {addOn.image && (
                                <img 
                                  src={getImageUrl(addOn.image)} 
                                  alt={addOn.name} 
                                  className="w-full h-24 object-cover" 
                                />
                              )}
                              <div className="p-3">
                                <h4 className="font-semibold text-sm text-gray-900 line-clamp-1 mb-1">{addOn.name}</h4>
                                <div className="flex items-baseline gap-2 mb-1">
                                  <span className={`text-base font-bold text-${themeColor}-600`}>${addOn.price}</span>
                                  <span className="text-xs text-gray-500">{addOn.pricing_type === 'per_person' ? 'per person' : 'per unit'}</span>
                                </div>
                                {/* Show quantity limits */}
                                {(minQty > 1 || maxQty < 99) && (
                                  <p className="text-xs text-gray-400 mb-2">
                                    {minQty > 1 && `Min: ${minQty}`}
                                    {minQty > 1 && maxQty < 99 && ' • '}
                                    {maxQty < 99 && `Max: ${maxQty}`}
                                  </p>
                                )}
                                
                                <div className="flex items-center gap-1">
                                  <StandardButton
                                    type="button"
                                    variant="secondary"
                                    size="sm"
                                    icon={Minus}
                                    onClick={() => handleAddOnChange(addOn.id, -1)}
                                    disabled={!isSelected}
                                  >
                                    {''}
                                  </StandardButton>
                                  <input
                                    type="number"
                                    min="0"
                                    max={maxQty}
                                    value={quantity}
                                    onChange={(e) => {
                                      let newQty = parseInt(e.target.value) || 0;
                                      // Enforce max limit
                                      if (newQty > maxQty) newQty = maxQty;
                                      if (newQty === 0) {
                                        setSelectedAddOns(prev => {
                                          const { [addOn.id]: _removed, ...rest } = prev;
                                          return rest;
                                        });
                                      } else {
                                        setSelectedAddOns(prev => ({ ...prev, [addOn.id]: newQty }));
                                      }
                                    }}
                                    onWheel={(e) => (e.target as HTMLInputElement).blur()}
                                    className="w-14 text-center font-bold text-sm text-gray-900 border border-gray-300 rounded px-1 py-1"
                                  />
                                  <StandardButton
                                    type="button"
                                    variant="primary"
                                    size="sm"
                                    icon={Plus}
                                    onClick={() => handleAddOnChange(addOn.id, 1)}
                                    disabled={quantity >= maxQty}
                                  >
                                    {''}
                                  </StandardButton>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                        
                        {Array.isArray(pkg.attractions) && pkg.attractions.map((attraction: any) => {
                          const isSelected = selectedAttractions[attraction.id] > 0;
                          const quantity = selectedAttractions[attraction.id] || 0;
                          const minQty = attraction.min_quantity ?? 1;
                          const maxQty = attraction.max_quantity ?? 99;
                          
                          return (
                            <div
                              key={attraction.id}
                              className={`rounded-xl overflow-hidden border-2 transition-all ${
                                isSelected 
                                  ? `border-${themeColor}-500 shadow-lg` 
                                  : 'border-gray-200'
                              }`}
                            >
                              {attraction.image && (
                                <img 
                                  src={getImageUrl(attraction.image)} 
                                  alt={attraction.name} 
                                  className="w-full h-24 object-cover" 
                                />
                              )}
                              <div className="p-3">
                                <h4 className="font-semibold text-sm text-gray-900 line-clamp-1 mb-1">{attraction.name}</h4>
                                <div className="flex items-baseline gap-2 mb-1">
                                  <span className={`text-base font-bold text-${themeColor}-600`}>${attraction.price}</span>
                                  <span className="text-xs text-gray-500">{attraction.pricing_type === 'per_person' ? 'per person' : 'per unit'}</span>
                                </div>
                                {/* Show quantity limits */}
                                {(minQty > 1 || maxQty < 99) && (
                                  <p className="text-xs text-gray-400 mb-2">
                                    {minQty > 1 && `Min: ${minQty}`}
                                    {minQty > 1 && maxQty < 99 && ' • '}
                                    {maxQty < 99 && `Max: ${maxQty}`}
                                  </p>
                                )}
                                
                                <div className="flex items-center gap-1">
                                  <StandardButton
                                    type="button"
                                    variant="secondary"
                                    size="sm"
                                    icon={Minus}
                                    onClick={() => handleAttractionChange(attraction.id, -1)}
                                    disabled={!isSelected}
                                  >
                                    {''}
                                  </StandardButton>
                                  <input
                                    type="number"
                                    min="0"
                                    max={maxQty}
                                    value={quantity}
                                    onChange={(e) => {
                                      let newQty = parseInt(e.target.value) || 0;
                                      // Enforce max limit
                                      if (newQty > maxQty) newQty = maxQty;
                                      if (newQty === 0) {
                                        setSelectedAttractions(prev => {
                                          const { [attraction.id]: _removed, ...rest } = prev;
                                          return rest;
                                        });
                                      } else {
                                        setSelectedAttractions(prev => ({ ...prev, [attraction.id]: newQty }));
                                      }
                                    }}
                                    onWheel={(e) => (e.target as HTMLInputElement).blur()}
                                    className="w-14 text-center font-bold text-sm text-gray-900 border border-gray-300 rounded px-1 py-1"
                                  />
                                  <StandardButton
                                    type="button"
                                    variant="primary"
                                    size="sm"
                                    icon={Plus}
                                    onClick={() => handleAttractionChange(attraction.id, 1)}
                                    disabled={quantity >= maxQty}
                                  >
                                    {''}
                                  </StandardButton>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Sidebar - Right Side - Only shows when package is selected */}
          {form.packageId && (
            <div className="lg:col-span-1 transition-all duration-500">
              <div className="sticky top-6 space-y-6">
              
              {/* Package Summary */}
              {pkg && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Selected Package</h3>
                  <div className="p-5">
                    {pkg.image && (
                      <img
                        src={getImageUrl(pkg.image)}
                        alt={pkg.name}
                        className="w-full h-32 object-cover rounded-lg mb-4"
                      />
                    )}
                    <h3 className="font-bold text-gray-900 mb-2">{pkg.name}</h3>
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <div className="bg-gray-50 rounded-lg p-2">
                        <p className="text-xs text-gray-500">Duration</p>
                        <p className="text-sm font-semibold text-gray-900">{formatDurationDisplay(pkg.duration, pkg.duration_unit)}</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-2">
                        <p className="text-xs text-gray-500">Capacity</p>
                        <p className="text-sm font-semibold text-gray-900">{pkg.max_participants} max</p>
                      </div>
                    </div>
                    {pkg.description && (
                      <p className="text-xs text-gray-600 line-clamp-3">{pkg.description}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Payment Summary */}
              {pkg && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Payment Details</h3>
                  <div className="space-y-4">
                    {/* Price Breakdown */}
                    <div className="space-y-2 text-sm">
                      {/* Package Price */}
                      {pkg.pricing_type === 'per_person' ? (
                        <div className="flex justify-between text-gray-700">
                          <span>Package ({form.participants} × ${pkg.price})</span>
                          <span className="font-medium">${(Number(pkg.price) * form.participants).toFixed(2)}</span>
                        </div>
                      ) : (
                        <>
                          {(() => {
                            const minParticipants = pkg.min_participants || 1;
                            const extraParticipants = Math.max(0, form.participants - minParticipants);
                            const pricePerAdditional = Number(pkg.price_per_additional || 0);
                            
                            return (
                              <>
                                <div className="flex justify-between text-gray-700">
                                  <span>Package (base price, up to {minParticipants})</span>
                                  <span className="font-medium">${Number(pkg.price).toFixed(2)}</span>
                                </div>
                                {extraParticipants > 0 && pricePerAdditional > 0 && (
                                  <div className="flex justify-between text-amber-700">
                                    <span>Additional participants ({extraParticipants} × ${pricePerAdditional})</span>
                                    <span className="font-medium">${(pricePerAdditional * extraParticipants).toFixed(2)}</span>
                                  </div>
                                )}
                              </>
                            );
                          })()}
                        </>
                      )}

                      {/* Add-ons */}
                      {Object.entries(selectedAddOns).map(([id, quantity]) => {
                        const addOn = pkg.add_ons?.find((a: any) => a.id === parseInt(id));
                        if (!addOn) return null;
                        const price = addOn.pricing_type === 'per_person' 
                          ? Number(addOn.price) * quantity * form.participants
                          : Number(addOn.price) * quantity;
                        return (
                          <div key={id} className="flex justify-between text-gray-600 text-xs">
                            <span>{addOn.name} ({quantity}{addOn.pricing_type === 'per_person' ? ` × ${form.participants} people` : ''})</span>
                            <span className="font-medium">${price.toFixed(2)}</span>
                          </div>
                        );
                      })}

                      {/* Attractions */}
                      {Object.entries(selectedAttractions).map(([id, quantity]) => {
                        const attraction = pkg.attractions?.find((a: any) => a.id === parseInt(id));
                        if (!attraction) return null;
                        const price = attraction.pricing_type === 'per_person'
                          ? Number(attraction.price) * quantity * form.participants
                          : Number(attraction.price) * quantity;
                        return (
                          <div key={id} className="flex justify-between text-gray-600 text-xs">
                            <span>{attraction.name} ({quantity}{attraction.pricing_type === 'per_person' ? ` × ${form.participants} people` : ''})</span>
                            <span className="font-medium">${price.toFixed(2)}</span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Calculated Total */}
                    <div className={`bg-${themeColor}-50 border border-${themeColor}-200 rounded-lg p-4`}>
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-gray-700">Calculated Total</span>
                        <span className={`text-2xl font-bold text-${fullColor}`}>${Number(calculatedTotal || 0).toFixed(2)}</span>
                      </div>
                    </div>

                    {/* Manual Inputs */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Total Amount</label>
                      <input
                        type="number"
                        name="totalAmount"
                        value={form.totalAmount}
                        onChange={handleInputChange}
                        onWheel={(e) => (e.target as HTMLInputElement).blur()}
                        step="0.01"
                        min="0"
                        placeholder={`${Number(calculatedTotal || 0).toFixed(2)}`}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent"
                      />
                      <p className="text-xs text-gray-500 mt-1">Leave blank to use calculated total</p>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Amount Paid</label>
                      <input
                        type="number"
                        name="amountPaid"
                        value={form.amountPaid}
                        onChange={handleInputChange}
                        onWheel={(e) => (e.target as HTMLInputElement).blur()}
                        step="0.01"
                        min="0"
                        placeholder="Auto-calculated"
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent"
                      />
                      <p className="text-xs text-gray-500 mt-1">Leave blank for auto-calculation</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Payment Method</label>
                      <select
                        name="paymentMethod"
                        value={form.paymentMethod}
                        onChange={handleInputChange}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent"
                      >
                        <option value="in-store">In-Store</option>
                        <option value="card">Card</option>
                        <option value="paylater">Pay Later</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Payment Status</label>
                      {(() => {
                        const calculatedTotal = form.totalAmount ? Number(form.totalAmount) : calculateTotal();
                        const amountPaid = form.paymentMethod === 'paylater' ? 0 : (form.amountPaid ? Number(form.amountPaid) : calculatedTotal);
                        const status = derivePaymentStatus(amountPaid, calculatedTotal);
                        const statusColors: Record<string, string> = {
                          paid: 'bg-green-100 text-green-800',
                          partial: 'bg-yellow-100 text-yellow-800',
                          pending: 'bg-red-100 text-red-800'
                        };
                        return (
                          <div className="w-full px-4 py-2.5 border border-gray-200 rounded-lg bg-gray-50">
                            <span className={`text-sm font-medium px-3 py-1 rounded-full ${statusColors[status]}`}>
                              {status.charAt(0).toUpperCase() + status.slice(1)}
                            </span>
                            <p className="text-xs text-gray-500 mt-2">Auto-calculated based on amounts</p>
                          </div>
                        );
                      })()}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Additional Notes</label>
                      <textarea
                        name="notes"
                        value={form.notes}
                        onChange={handleInputChange}
                        rows={4}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent"
                        placeholder="Add any additional notes..."
                      />
                    </div>

                    {/* Guest of Honor Fields */}
                    {pkg?.has_guest_of_honor && (
                      <>
                        <div className="col-span-2">
                          <h3 className="text-lg font-semibold text-gray-900 mb-4">Guest of Honor</h3>
                        </div>
                        
                        <div className="col-span-1">
                          <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
                          <input
                            type="text"
                            name="guestOfHonorName"
                            value={form.guestOfHonorName}
                            onChange={handleInputChange}
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent"
                            placeholder="Guest of Honor's Name"
                          />
                        </div>

                        <div className="col-span-1">
                          <label className="block text-sm font-medium text-gray-700 mb-2">Age</label>
                          <input
                            type="number"
                            name="guestOfHonorAge"
                            value={form.guestOfHonorAge}
                            onChange={handleInputChange}
                            onWheel={(e) => (e.target as HTMLInputElement).blur()}
                            min="0"
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent"
                            placeholder="Age"
                          />
                        </div>

                        <div className="col-span-1">
                          <label className="block text-sm font-medium text-gray-700 mb-2">Gender</label>
                          <select
                            name="guestOfHonorGender"
                            value={form.guestOfHonorGender}
                            onChange={handleInputChange}
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent"
                          >
                            <option value="">Select Gender</option>
                            <option value="male">Male</option>
                            <option value="female">Female</option>
                            <option value="other">Other</option>
                          </select>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Send Email Receipt Checkbox */}
              {pkg && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <label className="flex items-center space-x-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={sendEmail}
                      onChange={(e) => setSendEmail(e.target.checked)}
                      className={`w-4 h-4 rounded border-gray-300 text-${themeColor}-600 focus:ring-${themeColor}-500 cursor-pointer`}
                    />
                    <span className="text-sm text-gray-700 group-hover:text-gray-900">
                      Send confirmation email to customer
                    </span>
                  </label>
                  {!sendEmail && (
                    <p className="text-xs text-gray-500 mt-2">
                      Customer will not receive a booking confirmation email
                    </p>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              {pkg && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
                  <div className="flex flex-col gap-3">
                    <StandardButton
                      type="submit"
                      variant="primary"
                      icon={Save}
                      disabled={loading || !form.packageId}
                      loading={loading}
                      fullWidth
                      size="lg"
                    >
                      {loading ? 'Processing...' : 'Record Booking'}
                    </StandardButton>
                    <StandardButton
                      type="button"
                      variant="secondary"
                      onClick={() => navigate('/bookings')}
                      disabled={loading}
                      fullWidth
                      size="lg"
                    >
                      Cancel
                    </StandardButton>
                  </div>
                </div>
              )}
              </div>
            </div>
          )}
        </div>
      </form>

      {/* Toast Notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* Empty State Modal */}
      <EmptyStateModal
        type="packages"
        isOpen={showEmptyModal}
        onClose={() => setShowEmptyModal(false)}
      />
    </div>
  );
};

export default ManualBooking;
