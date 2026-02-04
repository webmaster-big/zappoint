import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Plus, Minus, Calendar, Clock } from 'lucide-react';
import QRCode from 'qrcode';
import { useThemeColor } from '../../../hooks/useThemeColor';
import Toast from '../../../components/ui/Toast';
import DatePicker from '../../../components/ui/DatePicker';
import bookingService, { type CreateBookingData } from '../../../services/bookingService';
import { bookingCacheService } from '../../../services/BookingCacheService';
import { packageCacheService } from '../../../services/PackageCacheService';
import timeSlotService, { type TimeSlot } from '../../../services/timeSlotService';
import { dayOffService, type DayOff } from '../../../services/DayOffService';
import EmptyStateModal from '../../../components/ui/EmptyStateModal';
import StandardButton from '../../../components/ui/StandardButton';
import roomService from '../../../services/RoomService';
import { locationService } from '../../../services/LocationService';
import LocationSelector from '../../../components/admin/LocationSelector';
import { getStoredUser, getImageUrl, formatTimeTo12Hour } from '../../../utils/storage';
import { formatDurationDisplay } from '../../../utils/timeFormat';
import { derivePaymentStatus } from '../../../types/Bookings.types';

// Helper function to parse ISO date string (YYYY-MM-DD) in local timezone
const parseLocalDate = (isoDateString: string): Date => {
  const [year, month, day] = isoDateString.split('-').map(Number);
  return new Date(year, month - 1, day);
};

// Interface for day offs with time info for partial closures
interface DayOffWithTime {
  date: Date;
  time_start?: string | null;
  time_end?: string | null;
  reason?: string;
  package_ids?: number[] | null;
  room_ids?: number[] | null;
}

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
  // Email notification flags
  sent_email_to_staff?: boolean;
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
  
  // Booking mode: 'flexible' (original - allows past dates, manual selection) or 'standard' (like OnsiteBooking)
  const [bookingMode, setBookingMode] = useState<'flexible' | 'standard'>('standard');
  
  const [locations, setLocations] = useState<Array<{ id: number; name: string; address?: string; city?: string; state?: string }>>([]);
  const [selectedLocation, setSelectedLocation] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingPackages, setLoadingPackages] = useState(true);
  const [pkg, setPkg] = useState<any>(null);
  const [packages, setPackages] = useState<any[]>([]);
  const [showEmptyModal, setShowEmptyModal] = useState(false);
  const [selectedAddOns, setSelectedAddOns] = useState<{ [id: number]: number }>({});
  const [selectedAttractions, setSelectedAttractions] = useState<{ [id: number]: number }>({});
  const [creatingRoom, setCreatingRoom] = useState(false);
  const [sendEmail, setSendEmail] = useState(true);
  const [sendEmailToStaff, setSendEmailToStaff] = useState(true);
  const [calculatedTotal, setCalculatedTotal] = useState(0);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  
  // Standard mode specific state (like OnsiteBooking)
  const [availableDates, setAvailableDates] = useState<Date[]>([]);
  const [availableTimeSlots, setAvailableTimeSlots] = useState<TimeSlot[]>([]);
  const [loadingTimeSlots, setLoadingTimeSlots] = useState(false);
  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null);
  const [dayOffs, setDayOffs] = useState<Date[]>([]);
  const [dayOffsWithTime, setDayOffsWithTime] = useState<DayOffWithTime[]>([]);
  
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
    status: 'confirmed', // Default to confirmed for manual booking
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

  // Helper function to get week of month (1-5, where 5 is last week)
  const getWeekOfMonth = (date: Date): number => {
    const firstDayOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
    const dayOfMonth = date.getDate();
    const firstDayWeekday = firstDayOfMonth.getDay();
    return Math.ceil((dayOfMonth + firstDayWeekday) / 7);
  };

  // Helper function to check if date is in last week of month
  const isLastWeekOfMonth = (date: Date): boolean => {
    const lastDayOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    const daysUntilEndOfMonth = lastDayOfMonth.getDate() - date.getDate();
    return daysUntilEndOfMonth < 7;
  };

  // Helper function to check if a time slot conflicts with a partial day off
  const isTimeSlotRestricted = (slotStartTime: string, slotEndTime: string): boolean => {
    if (!form.bookingDate || dayOffsWithTime.length === 0 || !pkg) return false;
    
    const selectedDateObj = parseLocalDate(form.bookingDate);
    const partialDayOff = dayOffsWithTime.find(dayOff => {
      if (dayOff.date.getFullYear() !== selectedDateObj.getFullYear() ||
          dayOff.date.getMonth() !== selectedDateObj.getMonth() ||
          dayOff.date.getDate() !== selectedDateObj.getDate()) {
        return false;
      }
      if (dayOff.package_ids && dayOff.package_ids.length > 0) {
        if (!dayOff.package_ids.includes(pkg.id)) {
          return false;
        }
      }
      return true;
    });
    
    if (!partialDayOff) return false;
    
    const toMinutes = (timeStr: string): number => {
      const [hours, minutes] = timeStr.split(':').map(Number);
      return hours * 60 + minutes;
    };
    
    const slotStart = toMinutes(slotStartTime);
    const slotEnd = toMinutes(slotEndTime);
    
    if (partialDayOff.time_start) {
      const closesAt = toMinutes(partialDayOff.time_start);
      if (slotStart >= closesAt) return true;
      if (slotEnd > closesAt) return true;
    }
    
    if (partialDayOff.time_end) {
      const opensAt = toMinutes(partialDayOff.time_end);
      if (slotStart < opensAt) return true;
    }
    
    return false;
  };

  // Filter available time slots based on partial day offs
  const filteredTimeSlots = availableTimeSlots.filter(slot => 
    !isTimeSlotRestricted(slot.start_time, slot.end_time)
  );

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
    setLoadingPackages(true);
    try {
      const user = getStoredUser();
      
      if (!user) {
        console.error('No user found');
        setLoadingPackages(false);
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
        setLoadingPackages(false);
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
    } finally {
      setLoadingPackages(false);
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
      
      // Reset date/time when package changes in standard mode
      if (bookingMode === 'standard') {
        setForm(prev => ({
          ...prev,
          bookingDate: '',
          bookingTime: '',
          roomId: ''
        }));
        setSelectedRoomId(null);
      }
    } catch (error) {
      console.error('Error loading package details:', error);
      setToast({ message: 'Failed to load package details', type: 'error' });
    }
  };

  // Standard Mode: Calculate available dates based on package availability schedules
  useEffect(() => {
    if (bookingMode !== 'standard' || !pkg) {
      setAvailableDates([]);
      return;
    }
    
    console.log('📅 Calculating available dates for package:', pkg.name);
    
    const today = new Date();
    const dates: Date[] = [];
    
    // Determine booking window
    const packageWindow = pkg.booking_window_days;
    const locationWindow = pkg.location?.booking_window_days;
    const bookingWindowDays = packageWindow ?? locationWindow ?? null;
    const maxDays = bookingWindowDays === null ? 730 : Math.max(1, bookingWindowDays);
    
    for (let i = 0; i < maxDays; i++) {
      const date = new Date();
      date.setDate(today.getDate() + i);
      
      let isAvailable = false;
      
      if (pkg.availability_schedules && pkg.availability_schedules.length > 0) {
        for (const schedule of pkg.availability_schedules) {
          if (!schedule.is_active) continue;
          
          if (schedule.availability_type === "daily") {
            isAvailable = true;
            break;
          } 
          else if (schedule.availability_type === "weekly") {
            const dayName = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][date.getDay()];
            if (schedule.day_configuration && schedule.day_configuration.includes(dayName)) {
              isAvailable = true;
              break;
            }
          } 
          else if (schedule.availability_type === "monthly") {
            const dayName = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][date.getDay()];
            const weekOfMonth = getWeekOfMonth(date);
            const isInLastWeek = isLastWeekOfMonth(date);
            
            if (schedule.day_configuration) {
              for (const pattern of schedule.day_configuration) {
                const [day, week] = pattern.split('-');
                
                if (day === dayName) {
                  if (week === 'last' && isInLastWeek) {
                    isAvailable = true;
                    break;
                  } else if (week === 'first' && weekOfMonth === 1) {
                    isAvailable = true;
                    break;
                  } else if (week === 'second' && weekOfMonth === 2) {
                    isAvailable = true;
                    break;
                  } else if (week === 'third' && weekOfMonth === 3) {
                    isAvailable = true;
                    break;
                  } else if (week === 'fourth' && weekOfMonth === 4) {
                    isAvailable = true;
                    break;
                  }
                }
              }
            }
          }
          
          if (isAvailable) break;
        }
      }
      
      if (isAvailable) {
        dates.push(date);
      }
    }
    
    console.log(`📅 Total available dates found: ${dates.length}`);
    setAvailableDates(dates);
  }, [pkg, bookingMode]);

  // Standard Mode: Fetch day offs for the selected location
  useEffect(() => {
    if (bookingMode !== 'standard') return;
    
    const fetchDayOffs = async () => {
      const locationId = selectedLocation || (isCompanyAdmin ? null : currentUser?.location_id);
      if (!locationId) return;
      
      try {
        const response = await dayOffService.getDayOffsByLocation(locationId);
        if (response.success && response.data) {
          const allDayOffs: DayOffWithTime[] = [];
          const today = new Date();
          
          response.data.forEach((dayOff: DayOff) => {
            const offDate = new Date(dayOff.date);
            const hasTimeRestriction = dayOff.time_start || dayOff.time_end;
            
            const dayOffData = {
              time_start: hasTimeRestriction ? dayOff.time_start : null,
              time_end: hasTimeRestriction ? dayOff.time_end : null,
              reason: dayOff.reason,
              package_ids: dayOff.package_ids || null,
              room_ids: dayOff.room_ids || null
            };
            
            if (dayOff.is_recurring) {
              const currentYearDate = new Date(today.getFullYear(), offDate.getMonth(), offDate.getDate());
              const nextYearDate = new Date(today.getFullYear() + 1, offDate.getMonth(), offDate.getDate());
              
              if (currentYearDate >= today) {
                allDayOffs.push({ ...dayOffData, date: currentYearDate });
              }
              allDayOffs.push({ ...dayOffData, date: nextYearDate });
            } else {
              if (offDate >= today) {
                allDayOffs.push({ ...dayOffData, date: offDate });
              }
            }
          });
          
          const fullDayOffDates = allDayOffs
            .filter(d => !d.time_start && !d.time_end && !d.package_ids && !d.room_ids)
            .map(d => d.date);
          
          const partialOrSpecificDayOffs = allDayOffs.filter(d => 
            d.time_start || d.time_end || d.package_ids || d.room_ids
          );
          
          setDayOffs(fullDayOffDates);
          setDayOffsWithTime(partialOrSpecificDayOffs);
        }
      } catch (error) {
        console.error('Error fetching day offs:', error);
      }
    };
    
    fetchDayOffs();
  }, [selectedLocation, isCompanyAdmin, currentUser?.location_id, bookingMode]);

  // Standard Mode: Fetch available time slots via SSE when date changes
  useEffect(() => {
    if (bookingMode !== 'standard' || !pkg || !form.bookingDate) {
      setAvailableTimeSlots([]);
      return;
    }
    
    console.log('🕐 Fetching time slots for:', {
      package_id: pkg.id,
      package_name: pkg.name,
      date: form.bookingDate,
    });
    
    setLoadingTimeSlots(true);
    
    const eventSource = timeSlotService.getAvailableSlotsSSE({
      package_id: pkg.id,
      date: form.bookingDate,
    });
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('✅ Received time slots:', {
          available_count: data.available_slots?.length || 0,
        });
        
        setAvailableTimeSlots(data.available_slots);
        setLoadingTimeSlots(false);
      } catch (err) {
        console.error('❌ Error parsing SSE data:', err);
      }
    };
    
    eventSource.onerror = () => {
      console.error('❌ SSE connection error');
      setLoadingTimeSlots(false);
      eventSource.close();
    };
    
    return () => {
      eventSource.close();
    };
  }, [form.bookingDate, pkg, bookingMode]);

  // Handle time slot selection in standard mode (auto-assigns room)
  const handleTimeSlotSelect = (slot: TimeSlot) => {
    setForm(prev => ({
      ...prev,
      bookingTime: slot.start_time,
      roomId: slot.room_id?.toString() || ''
    }));
    setSelectedRoomId(slot.room_id || null);
    console.log('🏠 Room auto-assigned from time slot:', {
      time: slot.start_time,
      room_id: slot.room_id,
      room_name: slot.room_name
    });
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
        // Email notification flags
        sent_email_to_staff: sendEmailToStaff,
        // Only skip validation in flexible mode (for past date entries)
        skip_date_validation: bookingMode === 'flexible',
        is_manual_entry: true,
      };

      console.log('📤 Sending manual booking request:', bookingData);
      console.log('📅 Booking mode:', bookingMode);
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
        const successMsg = bookingMode === 'standard'
          ? `Booking created successfully! Reference: ${referenceNumber}${emailStatus}`
          : `Booking recorded successfully! Reference: ${referenceNumber}${emailStatus}`;
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
      console.error('❌ Error creating booking:', error);
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
      {/* Compact Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            {/* Left: Back + Title */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => navigate('/bookings')}
                className="p-1.5 rounded-md hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div>
                <h1 className="text-lg font-semibold text-gray-900">Manual Booking</h1>
                <p className="text-xs text-gray-500">
                  {bookingMode === 'standard' ? 'With availability validation' : 'Flexible mode (past dates allowed)'}
                </p>
              </div>
            </div>
            
            {/* Right: Toggle + Location */}
            <div className="flex items-center gap-2">
              {/* Compact Mode Toggle */}
              <div className="flex items-center bg-gray-100 rounded-md p-0.5">
                <button
                  type="button"
                  onClick={() => {
                    setBookingMode('standard');
                    setForm(prev => ({ ...prev, bookingDate: '', bookingTime: '', roomId: '' }));
                    setSelectedRoomId(null);
                  }}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium transition-all ${
                    bookingMode === 'standard'
                      ? `bg-white shadow-sm text-${fullColor}`
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Calendar className="h-3.5 w-3.5" />
                  Standard
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setBookingMode('flexible');
                    setForm(prev => ({ ...prev, bookingDate: '', bookingTime: '', roomId: '' }));
                  }}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium transition-all ${
                    bookingMode === 'flexible'
                      ? `bg-white shadow-sm text-${fullColor}`
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Clock className="h-3.5 w-3.5" />
                  Flexible
                </button>
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
      </div>

      <form onSubmit={handleSubmit} className="max-w-7xl mx-auto px-4 py-4">
        <div className={`grid gap-4 transition-all duration-500 ${
          form.packageId 
            ? 'grid-cols-1 lg:grid-cols-3' 
            : 'grid-cols-1'
        }`}>
          
          {/* Main Content - Left Side with independent scrolling */}
          <div className={`space-y-4 transition-all duration-500 ${
            form.packageId ? 'lg:col-span-2 lg:max-h-[calc(100vh-140px)] lg:overflow-y-auto lg:pr-2' : 'col-span-1'
          }`}>
            
            {/* Step 1: Package Selection */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-gray-900">
                    {form.packageId ? 'Selected Package' : 'Select Package'}
                  </h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {form.packageId ? 'Your chosen package' : 'Choose a package for this booking'}
                  </p>
                </div>
                {form.packageId && (
                  <button
                    type="button"
                    onClick={() => {
                      setForm(prev => ({ ...prev, packageId: '', roomId: '' }));
                      setPkg(null);
                      setSelectedAddOns({});
                      setSelectedAttractions({});
                    }}
                    className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
                  >
                    <ArrowLeft className="h-3 w-3" />
                    Change
                  </button>
                )}
              </div>
              
              {/* Loading State for Packages */}
              {loadingPackages ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <div className={`animate-spin rounded-full h-8 w-8 border-2 border-gray-200 border-t-${themeColor}-600`}></div>
                  <p className="text-sm text-gray-500 mt-3">Loading packages...</p>
                </div>
              ) : (
              <div className="grid grid-cols-1 gap-3">
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
                    className={`border rounded-lg p-3 transition-all ${
                      form.packageId === p.id.toString()
                        ? `border-${themeColor}-500 bg-${themeColor}-50`
                        : `border-gray-200 hover:border-${themeColor}-300 hover:bg-gray-50 cursor-pointer`
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-semibold text-gray-900 truncate">{p.name}</h3>
                          {form.packageId === p.id.toString() && (
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-${themeColor}-100 text-${themeColor}-700`}>
                              ✓
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{p.description}</p>
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-${themeColor}-50 text-${themeColor}-700`}>
                            {p.category || 'Package'}
                          </span>
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-600">
                            {formatDurationDisplay(p.duration, p.duration_unit)}
                          </span>
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-600">
                            Max {p.max_participants}
                          </span>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <span className={`text-lg font-bold text-${themeColor}-600`}>${p.price}</span>
                        <span className="text-[10px] text-gray-500 block">{p.pricing_type === 'per_person' ? '/person' : '/booking'}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              )}
            </div>

            {pkg && (
              <>
                {/* Step 2: Customer & Booking Info */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                  <div className="mb-4">
                    <h2 className="text-base font-semibold text-gray-900">Customer & Booking Details</h2>
                    <p className="text-xs text-gray-500 mt-0.5">Enter customer information and schedule</p>
                  </div>
                  <div className="space-y-4">
                    {/* Customer Info */}
                    <div>
                      <h3 className="text-xs font-medium text-gray-700 mb-3 uppercase tracking-wide">
                        Customer Information
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="md:col-span-2">
                          <label className="block text-xs font-medium text-gray-600 mb-1">Full Name *</label>
                          <input
                            type="text"
                            name="customerName"
                            value={form.customerName}
                            onChange={handleInputChange}
                            required
                            className={`w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-${themeColor}-500 focus:border-transparent`}
                            placeholder="John Doe"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Email *</label>
                          <input
                            type="email"
                            name="email"
                            value={form.email}
                            onChange={handleInputChange}
                            required
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-${themeColor}-500 focus:border-transparent"
                            placeholder="john@example.com"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Phone</label>
                          <input
                            type="tel"
                            name="phone"
                            value={form.phone}
                            onChange={handleInputChange}
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-${themeColor}-500 focus:border-transparent"
                            placeholder="+1 (555) 123-4567"
                          />
                        </div>
                        
                        {/* Optional Address Fields */}
                        <div className="md:col-span-2 mt-1">
                          <label className="block text-xs font-medium text-gray-600 mb-1">Address <span className="text-gray-400">(Optional)</span></label>
                          <input
                            type="text"
                            name="guestAddress"
                            value={form.guestAddress}
                            onChange={handleInputChange}
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-${themeColor}-500 focus:border-transparent"
                            placeholder="123 Main St"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">City</label>
                          <input
                            type="text"
                            name="guestCity"
                            value={form.guestCity}
                            onChange={handleInputChange}
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-${themeColor}-500 focus:border-transparent"
                            placeholder="New York"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">State</label>
                          <input
                            type="text"
                            name="guestState"
                            value={form.guestState}
                            onChange={handleInputChange}
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-${themeColor}-500 focus:border-transparent"
                            placeholder="NY"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">ZIP Code</label>
                          <input
                            type="text"
                            name="guestZip"
                            value={form.guestZip}
                            onChange={handleInputChange}
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-${themeColor}-500 focus:border-transparent"
                            placeholder="10001"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Country</label>
                          <input
                            type="text"
                            name="guestCountry"
                            value={form.guestCountry}
                            onChange={handleInputChange}
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-${themeColor}-500 focus:border-transparent"
                            placeholder="United States"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="border-t border-gray-100 my-3"></div>

                    {/* Booking Details - Standard Mode with DatePicker and Time Slots */}
                    {bookingMode === 'standard' ? (
                      <div className="space-y-4">
                        <h3 className="text-xs font-medium text-gray-700 uppercase tracking-wide">
                          Select Date & Time
                        </h3>
                        
                        {/* Date Picker */}
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-2">Date *</label>
                          <DatePicker
                            selectedDate={form.bookingDate}
                            onChange={(date: string) => {
                              setForm(prev => ({ ...prev, bookingDate: date, bookingTime: '', roomId: '' }));
                              setSelectedRoomId(null);
                            }}
                            availableDates={availableDates}
                            dayOffs={dayOffs}
                            dayOffsWithTime={dayOffsWithTime}
                          />
                        </div>

                        {/* Time Slots */}
                        {form.bookingDate && (
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-2">
                              Time * {loadingTimeSlots && <span className="text-gray-400">(Loading...)</span>}
                            </label>
                            
                            {loadingTimeSlots ? (
                              <div className="flex flex-col items-center justify-center py-6 bg-gray-50 rounded-lg">
                                <div className={`animate-spin rounded-full h-6 w-6 border-2 border-gray-200 border-t-${themeColor}-600`}></div>
                                <p className="text-sm text-gray-500 mt-2">Loading available times...</p>
                              </div>
                            ) : filteredTimeSlots.length > 0 ? (
                              <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-1.5">
                                {filteredTimeSlots.map((slot) => (
                                  <button
                                    key={`${slot.start_time}-${slot.room_id}`}
                                    type="button"
                                    onClick={() => handleTimeSlotSelect(slot)}
                                    className={`px-2 py-1.5 rounded border text-xs font-medium transition-all ${
                                      form.bookingTime === slot.start_time
                                        ? `border-${themeColor}-500 bg-${themeColor}-50 text-${fullColor}`
                                        : 'border-gray-200 hover:border-gray-300 text-gray-700'
                                    }`}
                                  >
                                    {formatTimeTo12Hour(slot.start_time)}
                                  </button>
                                ))}
                              </div>
                            ) : (
                              <div className="text-center py-4 text-gray-500 bg-gray-50 rounded-md text-xs">
                                No available time slots for this date
                              </div>
                            )}

                            {form.bookingTime && selectedRoomId && (
                              <p className={`mt-2 text-xs text-${fullColor}`}>
                                ✓ Room auto-assigned
                              </p>
                            )}
                          </div>
                        )}

                        {/* Participants */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Participants *</label>
                            <input
                              type="number"
                              name="participants"
                              value={form.participants}
                              onChange={(e) => {
                                let value = parseInt(e.target.value) || 1;
                                if (pkg?.max_participants && value > pkg.max_participants) {
                                  value = pkg.max_participants;
                                }
                                if (value < 1) {
                                  value = 1;
                                }
                                setForm(prev => ({ ...prev, participants: value }));
                              }}
                              onWheel={(e) => (e.target as HTMLInputElement).blur()}
                              min="1"
                              max={pkg?.max_participants}
                              required
                              className={`w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-${themeColor}-500 focus:border-transparent`}
                            />
                            {pkg && (
                              <p className="text-[10px] text-gray-500 mt-0.5">
                                Min: {pkg.min_participants || 1} • Max: {pkg.max_participants}
                              </p>
                            )}
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Status *</label>
                            <select
                              name="status"
                              value={form.status}
                              onChange={handleInputChange}
                              className={`w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-${themeColor}-500 focus:border-transparent`}
                            >
                              <option value="confirmed">Confirmed</option>
                              <option value="pending">Pending</option>
                              <option value="checked-in">Checked In</option>
                              <option value="completed">Completed</option>
                              <option value="cancelled">Cancelled</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* Flexible Mode - Original date/time inputs */
                      <div>
                        <h3 className="text-xs font-medium text-gray-700 mb-3 uppercase tracking-wide">
                          Booking Schedule
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Date *</label>
                            <input
                              type="date"
                              name="bookingDate"
                              value={form.bookingDate}
                              onChange={handleInputChange}
                              required
                              className={`w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-${themeColor}-500 focus:border-transparent`}
                            />
                            <p className="text-[10px] text-gray-500 mt-0.5">Past dates allowed</p>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Time *</label>
                            <input
                              type="time"
                              name="bookingTime"
                              value={form.bookingTime}
                              onChange={handleInputChange}
                              required
                              className={`w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-${themeColor}-500 focus:border-transparent`}
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Participants *</label>
                            <input
                              type="number"
                              name="participants"
                              value={form.participants}
                              onChange={(e) => {
                                let value = parseInt(e.target.value) || 1;
                                if (pkg?.max_participants && value > pkg.max_participants) {
                                  value = pkg.max_participants;
                                }
                                if (value < 1) {
                                  value = 1;
                                }
                                setForm(prev => ({ ...prev, participants: value }));
                              }}
                              onWheel={(e) => (e.target as HTMLInputElement).blur()}
                              min="1"
                              max={pkg?.max_participants}
                              required
                              className={`w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-${themeColor}-500 focus:border-transparent`}
                            />
                            {pkg && pkg.pricing_type !== 'per_person' && form.participants > (pkg.min_participants || 1) && pkg.price_per_additional && (
                              <p className="text-[10px] text-amber-600 mt-0.5">
                                +{form.participants - (pkg.min_participants || 1)} extra @ ${pkg.price_per_additional} each
                              </p>
                            )}
                            {pkg && (
                              <p className="text-[10px] text-gray-500 mt-0.5">
                                Min: {pkg.min_participants || 1} • Max: {pkg.max_participants}
                              </p>
                            )}
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Status *</label>
                            <select
                              name="status"
                              value={form.status}
                              onChange={handleInputChange}
                              className={`w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-${themeColor}-500 focus:border-transparent`}
                            >
                              <option value="confirmed">Confirmed</option>
                              <option value="completed">Completed</option>
                              <option value="checked-in">Checked In</option>
                              <option value="cancelled">Cancelled</option>
                              <option value="pending">Pending</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Room Selection - Only show in Flexible mode */}
                    {bookingMode === 'flexible' && pkg.rooms && pkg.rooms.length > 0 && (
                      <>
                        <div className="border-t border-gray-100 my-3"></div>
                        <div>
                          <h3 className="text-xs font-medium text-gray-700 mb-2 uppercase tracking-wide">
                            Space Selection *
                          </h3>
                          <div className="flex flex-wrap gap-1.5">
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
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                    <div className="mb-3">
                      <h2 className="text-base font-semibold text-gray-900">Add-ons & Attractions</h2>
                      <p className="text-xs text-gray-500 mt-0.5">Optional extras</p>
                    </div>
                    <div>
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                        {Array.isArray(pkg.add_ons) && pkg.add_ons.map((addOn: any) => {
                          const isSelected = selectedAddOns[addOn.id] > 0;
                          const quantity = selectedAddOns[addOn.id] || 0;
                          const maxQty = addOn.max_quantity ?? 99;
                          
                          return (
                            <div
                              key={addOn.id}
                              className={`rounded-lg overflow-hidden border transition-all ${
                                isSelected 
                                  ? `border-${themeColor}-500 bg-${themeColor}-50` 
                                  : 'border-gray-200 hover:border-gray-300'
                              }`}
                            >
                              {addOn.image && (
                                <img 
                                  src={getImageUrl(addOn.image)} 
                                  alt={addOn.name} 
                                  className="w-full h-16 object-cover" 
                                />
                              )}
                              <div className="p-2">
                                <h4 className="font-medium text-xs text-gray-900 line-clamp-1">{addOn.name}</h4>
                                <div className="flex items-baseline gap-1">
                                  <span className={`text-sm font-bold text-${themeColor}-600`}>${addOn.price}</span>
                                  <span className="text-[10px] text-gray-500">{addOn.pricing_type === 'per_person' ? '/person' : '/unit'}</span>
                                </div>
                                
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
            <div className="lg:col-span-1 transition-all duration-500 lg:sticky lg:top-20 lg:max-h-[calc(100vh-120px)] lg:overflow-y-auto">
              <div className="space-y-4">
              
              {/* Package Summary */}
              {pkg && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                  <div className="flex items-start gap-4">
                    {pkg.image && (
                      <img
                        src={getImageUrl(pkg.image)}
                        alt={pkg.name}
                        className="w-20 h-20 object-cover rounded-lg flex-shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm text-gray-900 truncate">{pkg.name}</h3>
                      <div className="flex flex-col gap-1 mt-2">
                        <span className="text-sm text-gray-500">{formatDurationDisplay(pkg.duration, pkg.duration_unit)}</span>
                        <span className="text-sm text-gray-500">Up to {pkg.max_participants} guests</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Payment Summary */}
              {pkg && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                  <h3 className="text-sm font-semibold text-gray-900 mb-4">Payment Details</h3>
                  <div className="space-y-4">
                    {/* Price Breakdown */}
                    <div className="space-y-1.5 text-xs">
                      {/* Package Price */}
                      {pkg.pricing_type === 'per_person' ? (
                        <div className="flex justify-between text-gray-600">
                          <span>{form.participants} × ${pkg.price}</span>
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
                    <div className={`bg-${themeColor}-50 border border-${themeColor}-200 rounded-lg p-3`}>
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-gray-700">Total</span>
                        <span className={`text-xl font-bold text-${fullColor}`}>${Number(calculatedTotal || 0).toFixed(2)}</span>
                      </div>
                    </div>

                    {/* Manual Inputs */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1.5">Total Amount</label>
                        <input
                          type="number"
                          name="totalAmount"
                          value={form.totalAmount}
                          onChange={handleInputChange}
                          onWheel={(e) => (e.target as HTMLInputElement).blur()}
                          step="0.01"
                          min="0"
                          placeholder={`${Number(calculatedTotal || 0).toFixed(2)}`}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1.5">Amount Paid</label>
                        <input
                          type="number"
                          name="amountPaid"
                          value={form.amountPaid}
                          onChange={handleInputChange}
                          onWheel={(e) => (e.target as HTMLInputElement).blur()}
                          step="0.01"
                          min="0"
                          placeholder="Auto"
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1.5">Method</label>
                        <select
                          name="paymentMethod"
                          value={form.paymentMethod}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent"
                        >
                          <option value="in-store">In-Store</option>
                          <option value="card">Card</option>
                          <option value="paylater">Pay Later</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1.5">Status</label>
                        {(() => {
                          const calculatedTotal = form.totalAmount ? Number(form.totalAmount) : calculateTotal();
                          const amountPaid = form.paymentMethod === 'paylater' ? 0 : (form.amountPaid ? Number(form.amountPaid) : calculatedTotal);
                          const status = derivePaymentStatus(amountPaid, calculatedTotal);
                          const statusColors: Record<string, string> = {
                            paid: 'bg-green-100 text-green-700',
                            partial: 'bg-yellow-100 text-yellow-700',
                            pending: 'bg-red-100 text-red-700'
                          };
                          return (
                            <div className={`text-sm font-medium px-3 py-2 rounded-lg text-center ${statusColors[status]}`}>
                              {status.charAt(0).toUpperCase() + status.slice(1)}
                            </div>
                          );
                        })()}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1.5">Notes</label>
                      <textarea
                        name="notes"
                        value={form.notes}
                        onChange={handleInputChange}
                        rows={2}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent"
                        placeholder="Additional notes..."
                      />
                    </div>

                    {/* Guest of Honor Fields */}
                    {pkg?.has_guest_of_honor && (
                      <div className="border-t border-gray-100 pt-4">
                        <h4 className="text-xs font-medium text-gray-700 mb-3 uppercase tracking-wide">Guest of Honor</h4>
                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Name</label>
                            <input
                              type="text"
                              name="guestOfHonorName"
                              value={form.guestOfHonorName}
                              onChange={handleInputChange}
                              className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg"
                              placeholder="Name"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Age</label>
                            <input
                              type="number"
                              name="guestOfHonorAge"
                              value={form.guestOfHonorAge}
                              onChange={handleInputChange}
                              onWheel={(e) => (e.target as HTMLInputElement).blur()}
                              min="0"
                              className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg"
                              placeholder="Age"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Gender</label>
                            <select
                              name="guestOfHonorGender"
                              value={form.guestOfHonorGender}
                              onChange={handleInputChange}
                              className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg"
                            >
                              <option value="">-</option>
                              <option value="male">Male</option>
                              <option value="female">Female</option>
                              <option value="other">Other</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Email Options & Actions */}
              {pkg && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                  <h4 className="text-xs font-medium text-gray-700 mb-3 uppercase tracking-wide">Notifications</h4>
                  <div className="space-y-3">
                    <label className="flex items-center gap-3 cursor-pointer hover:bg-gray-50 p-2 rounded-lg -mx-2 transition-colors">
                      <input
                        type="checkbox"
                        checked={sendEmail}
                        onChange={(e) => setSendEmail(e.target.checked)}
                        className={`w-4 h-4 rounded border-gray-300 text-${themeColor}-600 focus:ring-${themeColor}-500`}
                      />
                      <span className="text-sm text-gray-700">Send confirmation email to customer</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer hover:bg-gray-50 p-2 rounded-lg -mx-2 transition-colors">
                      <input
                        type="checkbox"
                        checked={sendEmailToStaff}
                        onChange={(e) => setSendEmailToStaff(e.target.checked)}
                        className={`w-4 h-4 rounded border-gray-300 text-${themeColor}-600 focus:ring-${themeColor}-500`}
                      />
                      <span className="text-sm text-gray-700">Send notification to staff</span>
                    </label>
                  </div>
                  
                  <div className="mt-4 pt-4 border-t border-gray-100 space-y-2">
                    <StandardButton
                      type="submit"
                      variant="primary"
                      icon={Save}
                      disabled={loading || !form.packageId || !form.bookingDate || !form.bookingTime}
                      loading={loading}
                      fullWidth
                      size="md"
                    >
                      {loading ? 'Processing...' : (bookingMode === 'standard' ? 'Create Booking' : 'Record Booking')}
                    </StandardButton>
                    <StandardButton
                      type="button"
                      variant="secondary"
                      onClick={() => navigate('/bookings')}
                      disabled={loading}
                      fullWidth
                      size="md"
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
