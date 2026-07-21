import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Calendar, Package, User, Home, MapPin, AlertCircle, ArrowLeft, Bell, BellOff, Save, Plus, Minus, Gift } from 'lucide-react';
import QRCode from 'qrcode';
import StandardButton from '../../../components/ui/StandardButton';
import { useThemeColor } from '../../../hooks/useThemeColor';
import bookingService, { type Booking } from '../../../services/bookingService';
import { bookingCacheService } from '../../../services/BookingCacheService';
import packageService from '../../../services/PackageService';
import type { Package as PackageType } from '../../../services/PackageService';
import roomService from '../../../services/RoomService';
import { roomCacheService } from '../../../services/RoomCacheService';
import { packageCacheService } from '../../../services/PackageCacheService';
import timeSlotService, { type TimeSlot } from '../../../services/timeSlotService';
import { dayOffService, type DayOff } from '../../../services/DayOffService';
import locationService, { type Location } from '../../../services/LocationService';
import locationChangeRequestService from '../../../services/LocationChangeRequestService';
import DatePicker from '../../../components/ui/DatePicker';
import { formatTimeTo12Hour, getStoredUser, getImageUrl } from '../../../utils/storage';
import type { AppliedFee } from '../../../utils/fees';
import type { AppliedDiscount } from '../../../utils/discounts';

const parseLocalDate = (isoDateString: string): Date => {
  const [year, month, day] = isoDateString.split('-').map(Number);
  return new Date(year, month - 1, day);
};

interface DayOffWithTime {
  date: Date;
  time_start?: string | null;
  time_end?: string | null;
  reason?: string;
  package_ids?: number[] | null;
  room_ids?: number[] | null;
}

const EditBooking: React.FC = () => {
  const { themeColor, fullColor } = useThemeColor();
  const navigate = useNavigate();
  const isCompanyAdmin = getStoredUser()?.role === 'company_admin';
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const referenceNumber = searchParams.get('ref');
  const from = searchParams.get('from');
  const getBackPath = () => {
    switch (from) {
      case 'notifications': return '/notifications';
      case 'dashboard': return -1 as any;
      case 'payments': return '/payments';
      case 'calendar': return '/bookings/calendar';
      case 'space-schedule': return '/bookings/space-schedule';
      default: return '/bookings';
    }
  };
  const getBackLabel = () => {
    switch (from) {
      case 'notifications': return 'Notifications';
      case 'dashboard': return 'Dashboard';
      case 'payments': return 'Payments';
      case 'calendar': return 'Calendar';
      case 'space-schedule': return 'Space Schedule';
      default: return 'Bookings';
    }
  };
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [originalBooking, setOriginalBooking] = useState<Booking | null>(null);
  const [packageDetails, setPackageDetails] = useState<PackageType | null>(null);
  const [originalAmountPaid, setOriginalAmountPaid] = useState<number>(0);
  const [availablePackages, setAvailablePackages] = useState<PackageType[]>([]);
  const [availableRooms, setAvailableRooms] = useState<Array<{id: number; name: string}>>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [locationBookings, setLocationBookings] = useState<Booking[]>([]);
  const [loadingLocationBookings, setLoadingLocationBookings] = useState(false);
  const [requestToLocation, setRequestToLocation] = useState<number | ''>('');
  const [requestReason, setRequestReason] = useState('');
  const [submittingRequest, setSubmittingRequest] = useState(false);
  const [requestSubmitted, setRequestSubmitted] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    customerName: '',
    email: '',
    phone: '',
    date: '',
    time: '',
    participants: 0,
    status: 'pending' as 'pending' | 'confirmed' | 'checked-in' | 'completed' | 'cancelled',
    locationId: null as number | null,
    packageId: null as number | null,
    roomId: null as number | null,
    notes: '',
    internalNotes: '',
    sendNotification: true,
    guestOfHonorName: '',
    guestOfHonorAge: '',
    guestOfHonorGender: '',
  });

  const [availableDates, setAvailableDates] = useState<Date[]>([]);
  const [availableTimeSlots, setAvailableTimeSlots] = useState<TimeSlot[]>([]);
  const [loadingTimeSlots, setLoadingTimeSlots] = useState(false);
  const [dayOffs, setDayOffs] = useState<Date[]>([]);
  const [dayOffsWithTime, setDayOffsWithTime] = useState<DayOffWithTime[]>([]);
  const [appliedFees, setAppliedFees] = useState<AppliedFee[]>([]);
  const [appliedDiscounts, setAppliedDiscounts] = useState<AppliedDiscount[]>([]);
  const [selectedAddOns, setSelectedAddOns] = useState<{ [id: number]: number }>({});

  const loadPackagesAndRoomsForLocation = useCallback(async (locationId: number) => {
    const [packagesResult, roomsResult] = await Promise.all([
      (async () => {
        const cachedPackages = await packageCacheService.getCachedPackages();
        if (cachedPackages && cachedPackages.length > 0) {
          packageCacheService.syncInBackground();
          return cachedPackages.filter((pkg: PackageType) => pkg.location_id === locationId);
        }
        const response = await packageService.getPackages({ location_id: locationId });
        return response.success && response.data ? (response.data.packages || []) : [];
      })(),

      (async () => {
        const cachedRooms = await roomCacheService.getFilteredRoomsFromCache({ location_id: locationId });
        if (cachedRooms && cachedRooms.length > 0) {
          roomCacheService.syncInBackground();
          return cachedRooms.map(room => ({ id: room.id, name: room.name }));
        }
        const response = await roomService.getRooms({ location_id: locationId });
        if (response.success && response.data) {
          const rooms = response.data.rooms || response.data;
          const roomsArray = Array.isArray(rooms) ? rooms : [];
          roomCacheService.cacheRooms(roomsArray);
          return roomsArray.map((room: any) => ({ id: room.id, name: room.name }));
        }
        return [];
      })()
    ]);

    setAvailablePackages(packagesResult);
    setAvailableRooms(roomsResult);
  }, []);

  useEffect(() => {
    const loadLocations = async () => {
      try {
        const response = await locationService.getLocations({ per_page: 100 });
        if (response.success && response.data) {
          setLocations(response.data);
        }
      } catch {
      }
    };

    loadLocations();
  }, []);

  useEffect(() => {
    const loadBookingAndPackage = async () => {
      if (!id && !referenceNumber) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      try {
        let bookingData: Booking | null = null;
        
        if (id) {
          bookingData = await bookingCacheService.getBookingFromCache(Number(id));
          if (bookingData) {
            console.log('Loaded booking from cache by ID:', bookingData.id);
          }
        } else if (referenceNumber) {
          const cachedBookings = await bookingCacheService.getCachedBookings();
          if (cachedBookings) {
            bookingData = cachedBookings.find(b => b.reference_number === referenceNumber) || null;
            if (bookingData) {
              console.log('Loaded booking from cache by reference number:', bookingData.reference_number);
            }
          }
        }
        
        if (!bookingData) {
          if (referenceNumber) {
            const response = await bookingService.getBookings({ reference_number: referenceNumber });
            if (response.success && response.data && response.data.bookings.length > 0) {
              bookingData = response.data.bookings[0];
              console.log('Loaded booking from API by reference number:', bookingData);
              await bookingCacheService.updateBookingInCache(bookingData);
            }
          } else if (id) {
            const response = await bookingService.getBookingById(Number(id));
            if (response.success && response.data) {
              bookingData = response.data;
              console.log('Loaded booking from API by ID:', bookingData.id);
              await bookingCacheService.updateBookingInCache(bookingData);
            }
          }
        }

        if (!bookingData) {
          setNotFound(true);
          setLoading(false);
          return;
        }

        setOriginalBooking(bookingData);
        setOriginalAmountPaid(Number(bookingData.amount_paid || 0));

        const initialAddOns: { [id: number]: number } = {};
        (bookingData.add_ons || []).forEach((a) => {
          const addonId = a.pivot?.add_on_id ?? a.id;
          const qty = Number(a.pivot?.quantity ?? 0);
          if (addonId && qty > 0) initialAddOns[addonId] = qty;
        });
        setSelectedAddOns(initialAddOns);

        setFormData({
          customerName: bookingData.guest_name || '',
          email: bookingData.guest_email || '',
          phone: bookingData.guest_phone || '',
          date: bookingData.booking_date.split('T')[0],
          time: bookingData.booking_time,
          participants: bookingData.participants,
          status: bookingData.status,
          locationId: bookingData.location_id ?? null,
          packageId: bookingData.package_id || null,
          roomId: bookingData.room_id || null,
          notes: bookingData.notes || '',
          internalNotes: bookingData.internal_notes || '',
          sendNotification: true,
          guestOfHonorName: bookingData.guest_of_honor_name || '',
          guestOfHonorAge: bookingData.guest_of_honor_age ? String(bookingData.guest_of_honor_age) : '',
          guestOfHonorGender: bookingData.guest_of_honor_gender || '',
        });

        if (bookingData.applied_fees && Array.isArray(bookingData.applied_fees)) {
          setAppliedFees(bookingData.applied_fees);
        }

        if ((bookingData as any).applied_discounts && Array.isArray((bookingData as any).applied_discounts)) {
          setAppliedDiscounts((bookingData as any).applied_discounts);
        }
        
        setLoading(false);

        const locationId = bookingData.location_id;
        const packageId = bookingData.package_id;

        await Promise.all([
          loadPackagesAndRoomsForLocation(locationId),

          (async () => {
            if (!packageId) return;
            const cachedPackages = await packageCacheService.getCachedPackages();
            if (cachedPackages) {
              const found = cachedPackages.find((pkg: PackageType) => pkg.id === packageId);
              if (found) {
                setPackageDetails(found);
                return;
              }
            }
            const response = await packageService.getPackage(packageId);
            if (response.success && response.data) {
              setPackageDetails(response.data);
            }
          })()
        ]);

      } catch (error) {
        console.error('Error loading booking:', error);
        setNotFound(true);
        setLoading(false);
      }
    };

    loadBookingAndPackage();
  }, [id, referenceNumber]);

  const handleLocationChange = async (locationId: number) => {
    setFormData(prev => ({ ...prev, locationId, packageId: null, roomId: null, date: '', time: '' }));
    setPackageDetails(null);
    setAvailablePackages([]);
    setAvailableRooms([]);
    setAvailableDates([]);
    setAvailableTimeSlots([]);

    if (!locationId) return;

    try {
      await loadPackagesAndRoomsForLocation(locationId);
    } catch (error) {
      console.error('Error loading location data:', error);
    }
  };

  const handleSubmitLocationRequest = async () => {
    if (!originalBooking || requestToLocation === '') return;
    setSubmittingRequest(true);
    setRequestError(null);
    try {
      const res = await locationChangeRequestService.create(originalBooking.id, {
        to_location_id: Number(requestToLocation),
        reason: requestReason.trim() || undefined,
      });
      if (res.success) {
        setRequestSubmitted(true);
      }
    } catch (err: unknown) {
      const e = err as { response?: { status?: number; data?: { message?: string } } };
      setRequestError(e?.response?.data?.message || 'Failed to submit request. Please try again.');
    } finally {
      setSubmittingRequest(false);
    }
  };

  useEffect(() => {
    const locId = formData.locationId;
    const dateStr = formData.date;

    if (!isCompanyAdmin || !locId || !dateStr) {
      setLocationBookings([]);
      setLoadingLocationBookings(false);
      return;
    }

    let cancelled = false;
    setLoadingLocationBookings(true);

    (async () => {
      try {
        const response = await bookingService.getBookingsByLocationAndDate(locId, dateStr);
        if (!cancelled) {
          setLocationBookings(response.success && response.data ? response.data : []);
        }
      } catch {
        if (!cancelled) setLocationBookings([]);
      } finally {
        if (!cancelled) setLoadingLocationBookings(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [formData.locationId, formData.date, isCompanyAdmin]);

  const handlePackageChange = async (packageId: number) => {
    setFormData(prev => ({ ...prev, packageId, date: '', time: '' }));
    setAvailableTimeSlots([]);
    setSelectedAddOns({});
    
    try {
      const cachedPackage = availablePackages.find(pkg => pkg.id === packageId);
      if (cachedPackage) {
        setPackageDetails(cachedPackage);
        return;
      }
      
      const packageResponse = await packageService.getPackage(packageId);
      if (packageResponse.success && packageResponse.data) {
        setPackageDetails(packageResponse.data);
      }
    } catch (error) {
      console.error('Error loading package:', error);
    }
  };

  useEffect(() => {
    const fetchDayOffs = async () => {
      if (!packageDetails?.location_id) return;

      try {
        const response = await dayOffService.getDayOffsByLocation(packageDetails.location_id);
        if (response.success && response.data) {
          const allDayOffs: DayOffWithTime[] = [];
          const today = new Date();
          today.setHours(0, 0, 0, 0);

          response.data.forEach((dayOff: DayOff) => {
            const offDate = parseLocalDate(dayOff.date);
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
      } catch {
      }
    };

    fetchDayOffs();
  }, [packageDetails?.location_id]);

  const isTimeSlotRestricted = (slotStartTime: string, slotEndTime: string): boolean => {
    if (!formData.date || dayOffsWithTime.length === 0 || !packageDetails) return false;

    const selectedDateObj = parseLocalDate(formData.date);
    const partialDayOff = dayOffsWithTime.find(dayOff => {
      if (dayOff.date.getFullYear() !== selectedDateObj.getFullYear() ||
          dayOff.date.getMonth() !== selectedDateObj.getMonth() ||
          dayOff.date.getDate() !== selectedDateObj.getDate()) {
        return false;
      }
      if (dayOff.package_ids && dayOff.package_ids.length > 0) {
        if (!dayOff.package_ids.includes(packageDetails.id)) return false;
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

  const dayOffAppliesToPackage = (dayOff: { package_ids?: number[] | null }, packageId: number): boolean => {
    if (!dayOff.package_ids || dayOff.package_ids.length === 0) return true;
    return dayOff.package_ids.includes(packageId);
  };

  const filteredDayOffsWithTime = useMemo(() => {
    if (!packageDetails) return dayOffsWithTime;
    return dayOffsWithTime.filter(d => dayOffAppliesToPackage(d, packageDetails.id));
  }, [dayOffsWithTime, packageDetails]);

  const availableAddOns = useMemo(() => {
    const list: any[] = Array.isArray((packageDetails as any)?.add_ons)
      ? [...(packageDetails as any).add_ons]
      : [];
    const ids = new Set(list.map((a: any) => a.id));
    (originalBooking?.add_ons || []).forEach((a) => {
      const addonId = a.pivot?.add_on_id ?? a.id;
      if (!ids.has(addonId)) {
        list.push({
          id: addonId,
          name: a.name,
          price: a.price ?? a.pivot?.price_at_booking ?? 0,
          pricing_type: 'flat',
        });
        ids.add(addonId);
      }
    });
    return list;
  }, [packageDetails, originalBooking]);

  const frozenAddOnPrices = useMemo(() => {
    const map: { [id: number]: number } = {};
    (originalBooking?.add_ons || []).forEach((a) => {
      const addonId = a.pivot?.add_on_id ?? a.id;
      if (addonId != null && a.pivot?.price_at_booking != null) {
        map[addonId] = Number(a.pivot.price_at_booking);
      }
    });
    return map;
  }, [originalBooking]);

  const getAddOnUnitPrice = useCallback((addonId: number, addOn: any) => {
    if (Object.prototype.hasOwnProperty.call(frozenAddOnPrices, addonId)) {
      return frozenAddOnPrices[addonId];
    }
    return Number(addOn?.price) || 0;
  }, [frozenAddOnPrices]);

  const handleAddOnChange = (addOnId: number, change: number) => {
    const addOn = availableAddOns.find((a: any) => a.id === addOnId);
    const minQty = addOn?.min_quantity ?? 0;
    const maxQty = addOn?.max_quantity ?? 99;

    setSelectedAddOns(prev => {
      const currentValue = prev[addOnId] || 0;
      let newValue = currentValue + change;

      if (newValue > maxQty) newValue = maxQty;

      if (newValue <= 0) {
        const { [addOnId]: _removed, ...rest } = prev;
        return rest;
      }

      if (currentValue === 0 && change > 0 && minQty > 1) newValue = minQty;

      return { ...prev, [addOnId]: newValue };
    });
  };

  const computeAddonsTotal = useCallback((addons: { [id: number]: number }, participants: number) => {
    return Object.entries(addons).reduce((sum, [id, quantity]) => {
      const addonId = parseInt(id);
      const addOn = availableAddOns.find((a: any) => a.id === addonId);
      if (!addOn) return sum;
      const price = getAddOnUnitPrice(addonId, addOn);
      const lineTotal = addOn.pricing_type === 'per_person'
        ? price * quantity * participants
        : price * quantity;
      return sum + lineTotal;
    }, 0);
  }, [availableAddOns, getAddOnUnitPrice]);

  const buildAdditionalAddons = useCallback(() => {
    return Object.entries(selectedAddOns)
      .filter(([, quantity]) => quantity > 0)
      .map(([id, quantity]) => {
        const addonId = parseInt(id);
        const addOn = availableAddOns.find((a: any) => a.id === addonId);
        if (isNaN(addonId) || !addOn) return null;
        return {
          addon_id: addonId,
          quantity,
          price_at_booking: getAddOnUnitPrice(addonId, addOn),
        };
      })
      .filter((item): item is { addon_id: number; quantity: number; price_at_booking: number } => item !== null);
  }, [selectedAddOns, availableAddOns, getAddOnUnitPrice]);

  const addOnsChanged = useMemo(() => {
    const originalMap: { [id: number]: number } = {};
    (originalBooking?.add_ons || []).forEach((a) => {
      const addonId = a.pivot?.add_on_id ?? a.id;
      const qty = Number(a.pivot?.quantity ?? 0);
      if (addonId && qty > 0) originalMap[addonId] = qty;
    });
    const norm = (m: { [id: number]: number }) =>
      Object.entries(m)
        .filter(([, q]) => q > 0)
        .map(([id, q]) => `${id}:${q}`)
        .sort()
        .join(',');
    return norm(originalMap) !== norm(selectedAddOns);
  }, [originalBooking, selectedAddOns]);

  const filteredTimeSlots = availableTimeSlots.filter(slot => {
    if (isTimeSlotRestricted(slot.start_time, slot.end_time)) return false;

    const noticeHoursValue = Number(packageDetails?.min_booking_notice_hours) || 0;
    if (noticeHoursValue > 0 && formData.date) {
      const now = new Date();
      const noticeMs = noticeHoursValue * 60 * 60 * 1000;
      const earliestBookableTime = new Date(now.getTime() + noticeMs);

      const [slotHours, slotMinutes] = slot.start_time.split(':').map(Number);
      const slotDate = parseLocalDate(formData.date);
      slotDate.setHours(slotHours, slotMinutes, 0, 0);

      if (slotDate < earliestBookableTime) return false;
    }

    return true;
  });

  const getWeekOfMonth = (date: Date): number => {
    const firstDayOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
    const dayOfMonth = date.getDate();
    const firstDayWeekday = firstDayOfMonth.getDay();
    return Math.ceil((dayOfMonth + firstDayWeekday) / 7);
  };

  const isLastWeekOfMonth = (date: Date): boolean => {
    const lastDayOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    const daysUntilEndOfMonth = lastDayOfMonth.getDate() - date.getDate();
    return daysUntilEndOfMonth < 7;
  };

  useEffect(() => {
    if (!packageDetails) return;

    const today = new Date();
    const dates: Date[] = [];

    const packageWindow = packageDetails.booking_window_days;
    const locationWindow = packageDetails.location?.booking_window_days;
    const bookingWindowDays = packageWindow ?? locationWindow ?? null;
    const maxDays = bookingWindowDays === null ? 730 : Math.max(1, bookingWindowDays);

    const noticeHours = Number(packageDetails.min_booking_notice_hours) || 0;
    const earliestBookableTime = new Date(today.getTime() + noticeHours * 60 * 60 * 1000);
    const earliestBookableDate = new Date(earliestBookableTime.getFullYear(), earliestBookableTime.getMonth(), earliestBookableTime.getDate());

    for (let i = 0; i < maxDays; i++) {
      const date = new Date();
      date.setDate(today.getDate() + i);

      const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      if (dateOnly < earliestBookableDate) continue;

      let isAvailable = false;

      if (packageDetails.availability_schedules && packageDetails.availability_schedules.length > 0) {
        for (const schedule of packageDetails.availability_schedules) {
          if (!schedule.is_active) continue;

          if (schedule.availability_type === "daily") {
            isAvailable = true;
            break;
          } else if (schedule.availability_type === "weekly") {
            const dayName = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][date.getDay()];
            if (schedule.day_configuration && schedule.day_configuration.includes(dayName)) {
              isAvailable = true;
              break;
            }
          } else if (schedule.availability_type === "monthly") {
            const dayName = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][date.getDay()];
            const weekOfMonth = getWeekOfMonth(date);
            const isInLastWeek = isLastWeekOfMonth(date);

            if (schedule.day_configuration) {
              for (const pattern of schedule.day_configuration) {
                const [day, week] = pattern.split('-');
                if (day === dayName) {
                  if ((week === 'last' && isInLastWeek) ||
                      (week === 'first' && weekOfMonth === 1) ||
                      (week === 'second' && weekOfMonth === 2) ||
                      (week === 'third' && weekOfMonth === 3) ||
                      (week === 'fourth' && weekOfMonth === 4)) {
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

    if (formData.date) {
      const currentDate = parseLocalDate(formData.date);
      const alreadyIncluded = dates.some(d => d.toDateString() === currentDate.toDateString());
      if (!alreadyIncluded) {
        dates.unshift(currentDate);
      }
    }

    setAvailableDates(dates);
  }, [packageDetails, formData.date]);

  useEffect(() => {
    if (!packageDetails || !formData.date) {
      setAvailableTimeSlots([]);
      return;
    }

    setLoadingTimeSlots(true);

    const eventSource = timeSlotService.getAvailableSlotsSSE({
      package_id: packageDetails.id,
      date: formData.date,
    });

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setAvailableTimeSlots(data.available_slots);
        setLoadingTimeSlots(false);
      } catch {
      }
    };

    eventSource.onerror = () => {
      setLoadingTimeSlots(false);
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [formData.date, packageDetails]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    if (name === 'packageId') {
      handlePackageChange(Number(value));
      return;
    }
    
    setFormData(prev => ({
      ...prev,
      [name]: name === 'participants' || name === 'roomId' ? Number(value) : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!originalBooking) {
      alert('Booking data not found');
      return;
    }

    setSubmitting(true);

    try {
      let updatedTotal: number | undefined = undefined;
      const isPackageChanged = formData.packageId !== originalBooking.package_id;
      const isParticipantsChanged = formData.participants !== originalBooking.participants;

      const originalFees = originalBooking.applied_fees || [];
      const feesChanged = JSON.stringify(appliedFees) !== JSON.stringify(originalFees);

      if (isPackageChanged || isParticipantsChanged || feesChanged || addOnsChanged) {
        const basePackagePrice = packageDetails ? Number(packageDetails.price) : 0;
        const minParticipants = packageDetails?.min_participants || 1;
        const pricePerAdditional = Number(packageDetails?.price_per_additional || 0);
        const additionalCount = Math.max(0, formData.participants - minParticipants);
        const packagePrice = basePackagePrice + (additionalCount * pricePerAdditional);

        const attractionsTotal = isPackageChanged
          ? 0
          : (originalBooking.attractions || []).reduce((sum, attr) => {
              const price = Number(attr.pivot?.price_at_booking || 0);
              const qty = Number(attr.pivot?.quantity || 1);
              return sum + (price * qty);
            }, 0);

        const addonsTotal = computeAddonsTotal(selectedAddOns, formData.participants);

        const additiveFeeTotal = appliedFees
          .filter(f => f.fee_application_type === 'additive')
          .reduce((sum, f) => sum + f.fee_amount, 0);

        updatedTotal = packagePrice + attractionsTotal + addonsTotal + additiveFeeTotal;
      }

      const additionalAddons = buildAdditionalAddons();

      const response = await bookingService.updateBooking(Number(originalBooking.id), {
        guest_name: formData.customerName,
        guest_email: formData.email,
        guest_phone: formData.phone,
        booking_date: formData.date,
        booking_time: formData.time,
        participants: formData.participants,
        status: formData.status,
        location_id: formData.locationId || undefined,
        package_id: formData.packageId || undefined,
        room_id: formData.roomId || null,
        notes: formData.notes,
        internal_notes: formData.internalNotes,
        send_notification: formData.sendNotification,
        applied_fees: appliedFees.length > 0 ? appliedFees : null,
        applied_discounts: appliedDiscounts.length > 0 ? appliedDiscounts : null,
        discount_amount: originalBooking.discount_amount ? Number(originalBooking.discount_amount) : undefined,
        ...(addOnsChanged && { additional_addons: additionalAddons }),
        ...(isPackageChanged && { additional_attractions: [] }),
        ...(updatedTotal !== undefined && { total_amount: updatedTotal, amount_paid: originalAmountPaid }),
        guest_of_honor_name: packageDetails?.has_guest_of_honor && formData.guestOfHonorName ? formData.guestOfHonorName : undefined,
        guest_of_honor_age: packageDetails?.has_guest_of_honor && formData.guestOfHonorAge ? parseInt(formData.guestOfHonorAge) : undefined,
        guest_of_honor_gender: packageDetails?.has_guest_of_honor && formData.guestOfHonorGender ? formData.guestOfHonorGender as 'male' | 'female' | 'other' : undefined,
      });

      if (response.success) {
        if (response.data) {
          await bookingCacheService.updateBookingInCache(response.data);
        }

        if (formData.sendNotification) {
          try {
            const refNumber = response.data?.reference_number || originalBooking.reference_number;
            const qrCodeBase64 = await QRCode.toDataURL(refNumber, {
              width: 300,
              margin: 2,
              color: { dark: '#000000', light: '#FFFFFF' }
            });
            await bookingService.storeQrCode(Number(originalBooking.id), qrCodeBase64, true);
            console.log('✅ QR code stored and email sent for updated booking');
          } catch (qrError) {
            console.error('⚠️ Failed to generate/store QR code for email:', qrError);
          }
        }
        
        alert('Booking updated successfully!');
        navigate(getBackPath());
      } else {
        alert('Failed to update booking. Please try again.');
        setSubmitting(false);
      }
    } catch (error) {
      console.error('Error updating booking:', error);
      alert('Error updating booking. Please try again.');
      setSubmitting(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'checked-in': return `bg-${themeColor}-100 text-${fullColor}`;
      case 'completed': return 'bg-blue-100 text-blue-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className={`animate-spin rounded-full h-10 w-10 border-b-2 border-${fullColor}`}></div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-3" />
          <h1 className="text-xl font-bold text-gray-800 mb-2">Booking Not Found</h1>
          <p className="text-gray-500 text-sm mb-4">The booking you're looking for doesn't exist.</p>
          <StandardButton variant="primary" size="sm" onClick={() => navigate(getBackPath())}>
            Back to {getBackLabel()}
          </StandardButton>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full mx-auto sm:px-4 md:mt-8 pb-6 flex flex-col md:flex-row gap-8 md:gap-12">
      <div className="flex-1 mx-auto">
        <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6 md:p-8">
          <div className="flex items-center gap-3 mb-6">
            <button
              onClick={() => navigate(getBackPath())}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft size={24} />
            </button>
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-neutral-900 tracking-tight">Edit Booking</h2>
              <p className="text-sm text-gray-500 mt-1">
                Reference: <span className="font-medium text-gray-700">{originalBooking?.reference_number}</span>
              </p>
            </div>
            <span className={`ml-auto px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(formData.status)}`}>
              {formData.status.charAt(0).toUpperCase() + formData.status.slice(1).replace('-', ' ')}
            </span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            {isCompanyAdmin && (
              <div>
                <h3 className={`text-xl font-bold mb-4 text-neutral-900 flex items-center gap-2`}>
                  <MapPin className={`w-5 h-5 text-${themeColor}-600`} /> Location
                </h3>
                <div className="space-y-3">
                  <select
                    name="locationId"
                    value={formData.locationId || ''}
                    onChange={(e) => handleLocationChange(Number(e.target.value))}
                    className={`w-full rounded-md border border-gray-200 px-4 py-2 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 bg-white text-neutral-900 text-base transition-all`}
                  >
                    <option value="">Select a location</option>
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>{loc?.name}</option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500">
                    Changing the location resets the selected package, space, date, and time.
                  </p>

                  {formData.locationId && formData.date && (
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                      <div className="flex items-start gap-2 mb-2">
                        <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                        <p className="text-sm font-semibold text-neutral-800">
                          Existing bookings at {locations.find(l => l.id === formData.locationId)?.name || 'this location'} on{' '}
                          {new Date(formData.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>
                      </div>
                      {loadingLocationBookings ? (
                        <p className="text-sm text-gray-500">Checking existing bookings...</p>
                      ) : (() => {
                        const others = locationBookings.filter(b => b.id !== originalBooking?.id);
                        if (others.length === 0) {
                          return <p className="text-sm text-green-700">No other bookings at this location on this date.</p>;
                        }
                        return (
                          <ul className="space-y-1.5">
                            {others.map((b) => {
                              const roomName = (b.room as { name?: string } | null | undefined)?.name
                                || (b.room_id ? `Space #${b.room_id}` : 'No space');
                              return (
                                <li key={b.id} className="text-sm text-gray-700 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                                  <span className="font-medium text-neutral-800">{formatTimeTo12Hour(b.booking_time)}</span>
                                  <span className="text-gray-300">•</span>
                                  <span>{roomName}</span>
                                  <span className="text-gray-300">•</span>
                                  <span className="text-gray-500 break-all">{b.guest_name || b.reference_number}</span>
                                </li>
                              );
                            })}
                          </ul>
                        );
                      })()}
                    </div>
                  )}
                </div>
              </div>
            )}

            {!isCompanyAdmin && originalBooking && (
              <div>
                <h3 className="text-xl font-bold mb-4 text-neutral-900 flex items-center gap-2">
                  <MapPin className={`w-5 h-5 text-${themeColor}-600`} /> Request Location Change
                </h3>
                {requestSubmitted ? (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-green-700">
                    Your location change request has been submitted. The booking stays at its current location until a manager at the destination or an admin approves it.
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm text-gray-500">
                      Request moving this booking to another location. It stays here until the destination location or an admin approves it.
                    </p>
                    <select
                      value={requestToLocation}
                      onChange={(e) => { setRequestToLocation(e.target.value ? Number(e.target.value) : ''); setRequestError(null); }}
                      className={`w-full rounded-md border border-gray-200 px-4 py-2 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 bg-white text-neutral-900 text-base transition-all`}
                    >
                      <option value="">Select destination location</option>
                      {locations.filter((loc) => loc.id !== formData.locationId).map((loc) => (
                        <option key={loc.id} value={loc.id}>{loc.name}</option>
                      ))}
                    </select>
                    <textarea
                      value={requestReason}
                      onChange={(e) => setRequestReason(e.target.value)}
                      placeholder="Reason for the change (optional)"
                      rows={2}
                      className={`w-full rounded-md border border-gray-200 px-4 py-2 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 bg-white text-neutral-900 text-sm transition-all`}
                    />
                    {requestError && <p className="text-sm text-red-600">{requestError}</p>}
                    <div>
                      <StandardButton
                        type="button"
                        variant="primary"
                        size="md"
                        onClick={handleSubmitLocationRequest}
                        disabled={submittingRequest || requestToLocation === ''}
                        loading={submittingRequest}
                      >
                        {submittingRequest ? 'Submitting...' : 'Submit Request'}
                      </StandardButton>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div>
              <h3 className={`text-xl font-bold mb-4 text-neutral-900 flex items-center gap-2`}>
                <Package className={`w-5 h-5 text-${themeColor}-600`} /> Package / Party
              </h3>
              <div className="space-y-3">
                <select
                  name="packageId"
                  value={formData.packageId || ''}
                  onChange={handleInputChange}
                  required
                  className={`w-full rounded-md border border-gray-200 px-4 py-2 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 bg-white text-neutral-900 text-base transition-all`}
                >
                  <option value="">Select a package</option>
                  {availablePackages.map((pkg) => (
                    <option key={pkg.id} value={pkg.id}>
                      {pkg.name} - ${Number(pkg.price).toFixed(2)}
                    </option>
                  ))}
                </select>
                {packageDetails && (
                  <div className={`bg-${themeColor}-50 border border-${themeColor}-100 rounded-lg p-3`}>
                    <p className="text-sm text-gray-700">
                      <span className="font-medium">Selected:</span> {packageDetails.name} • ${Number(packageDetails.price).toFixed(2)}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div>
              <h3 className={`text-xl font-bold mb-4 text-neutral-900 flex items-center gap-2`}>
                <Home className={`w-5 h-5 text-${themeColor}-600`} /> Space Assignment
              </h3>
              {availableRooms.length > 0 ? (
                <select
                  name="roomId"
                  value={formData.roomId || ''}
                  onChange={handleInputChange}
                  className={`w-full rounded-md border border-gray-200 px-4 py-2 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 bg-white text-neutral-900 text-base transition-all`}
                >
                  <option value="">Select a space</option>
                  {availableRooms.map((room) => (
                    <option key={room.id} value={room.id}>{room.name}</option>
                  ))}
                </select>
              ) : (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <p className="text-sm text-gray-600">
                    No spaces available for this location
                  </p>
                </div>
              )}
            </div>

            <div>
              <h3 className={`text-xl font-bold mb-4 text-neutral-900 flex items-center gap-2`}>
                <User className={`w-5 h-5 text-${themeColor}-600`} /> Customer Information
              </h3>
              <div className="space-y-5">
                <div>
                  <label className="block font-semibold mb-2 text-base text-neutral-800">Full Name</label>
                  <input
                    type="text"
                    name="customerName"
                    required
                    value={formData.customerName}
                    onChange={handleInputChange}
                    className={`w-full rounded-md border border-gray-200 px-4 py-2 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 bg-white text-neutral-900 text-base transition-all placeholder:text-gray-400`}
                    placeholder="Enter customer name"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-semibold mb-2 text-base text-neutral-800">
                      Email
                    </label>
                    <input
                      type="email"
                      name="email"
                      required
                      value={formData.email}
                      onChange={handleInputChange}
                      className={`w-full rounded-md border border-gray-200 px-4 py-2 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 bg-white text-neutral-900 text-base transition-all placeholder:text-gray-400`}
                      placeholder="customer@example.com"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-2 text-base text-neutral-800">
                      Phone
                    </label>
                    <input
                      type="tel"
                      name="phone"
                      required
                      value={formData.phone}
                      onChange={handleInputChange}
                      className={`w-full rounded-md border border-gray-200 px-4 py-2 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 bg-white text-neutral-900 text-base transition-all placeholder:text-gray-400`}
                      placeholder="(555) 123-4567"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h3 className={`text-xl font-bold mb-4 text-neutral-900 flex items-center gap-2`}>
                <Calendar className={`w-5 h-5 text-${themeColor}-600`} /> Booking Details
              </h3>
              <div className="space-y-5">
                <div>
                  <label className="block font-semibold mb-2 text-base text-neutral-800">Date</label>
                  {packageDetails?.availability_schedules && packageDetails.availability_schedules.length > 0 ? (
                    <DatePicker
                      selectedDate={formData.date}
                      availableDates={availableDates}
                      onChange={(date) => {
                        setFormData(prev => ({ ...prev, date, time: '' }));
                        setAvailableTimeSlots([]);
                      }}
                      dayOffs={dayOffs}
                      dayOffsWithTime={filteredDayOffsWithTime}
                    />
                  ) : (
                    <input
                      type="date"
                      name="date"
                      required
                      value={formData.date}
                      onChange={handleInputChange}
                      className={`w-full rounded-md border border-gray-200 px-4 py-2 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 bg-white text-neutral-900 text-base transition-all`}
                    />
                  )}
                </div>

                <div>
                  <label className="block font-semibold mb-2 text-base text-neutral-800">Time</label>
                  {!formData.date ? (
                    <p className="text-sm text-gray-400 py-2">Select a date first to see available times.</p>
                  ) : loadingTimeSlots ? (
                    <div className="flex items-center justify-center p-4">
                      <div className={`animate-spin rounded-full h-6 w-6 border-b-2 border-${fullColor}`}></div>
                      <span className="ml-2 text-sm text-gray-600">Loading available times...</span>
                    </div>
                  ) : filteredTimeSlots.length > 0 ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {filteredTimeSlots.map((slot) => (
                        <label
                          key={slot.start_time}
                          className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition ${
                            formData.time === slot.start_time
                              ? `border-${themeColor}-600 bg-${themeColor}-50`
                              : 'border-gray-300 bg-white hover:border-gray-400'
                          }`}
                        >
                          <input
                            type="radio"
                            name="timeSelection"
                            value={slot.start_time}
                            checked={formData.time === slot.start_time}
                            onChange={() => {
                              setFormData(prev => ({
                                ...prev,
                                time: slot.start_time,
                                roomId: slot.room_id || prev.roomId,
                              }));
                            }}
                            className={`accent-${themeColor}-600`}
                          />
                          <div className="flex flex-col">
                            <span className="text-sm text-gray-800">{formatTimeTo12Hour(slot.start_time)}</span>
                            <span className="text-xs text-gray-500">{formatTimeTo12Hour(slot.end_time)}</span>
                          </div>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400 py-2">No available times for the selected date.</p>
                  )}
                  {formData.time && (
                    <p className="text-xs text-gray-500 mt-2">
                      Selected: <span className="font-medium text-gray-700">{formatTimeTo12Hour(formData.time)}</span>
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-semibold mb-2 text-base text-neutral-800">
                      Participants
                    </label>
                    <input
                      type="number"
                      name="participants"
                      min="1"
                      required
                      value={formData.participants}
                      onChange={handleInputChange}
                      className={`w-full rounded-md border border-gray-200 px-4 py-2 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 bg-white text-neutral-900 text-base transition-all`}
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-2 text-base text-neutral-800">Status</label>
                    <select
                      name="status"
                      required
                      value={formData.status}
                      onChange={handleInputChange}
                      className={`w-full rounded-md border border-gray-200 px-4 py-2 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 bg-white text-neutral-900 text-base transition-all`}
                    >
                      <option value="pending">Pending</option>
                      <option value="confirmed">Confirmed</option>
                      <option value="checked-in">Checked In</option>
                      <option value="completed">Completed</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                </div>

              </div>
            </div>

            {availableAddOns.length > 0 && (
              <div>
                <h3 className={`text-xl font-bold mb-4 text-neutral-900 flex items-center gap-2`}>
                  <Gift className={`w-5 h-5 text-${themeColor}-600`} /> Add-ons
                </h3>
                <p className="text-sm text-gray-500 mb-4">Add or adjust extras for this booking. Changing add-ons updates the total.</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {availableAddOns.map((addOn: any) => {
                    const quantity = selectedAddOns[addOn.id] || 0;
                    const isSelected = quantity > 0;
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
                            className="w-full h-20 object-cover"
                          />
                        )}
                        <div className="p-3">
                          <h4 className="font-medium text-sm text-gray-900 line-clamp-1">{addOn.name}</h4>
                          <div className="flex items-baseline gap-1 mb-2">
                            <span className={`text-sm font-bold text-${themeColor}-600`}>${getAddOnUnitPrice(addOn.id, addOn).toFixed(2)}</span>
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
                                if (newQty > maxQty) newQty = maxQty;
                                if (newQty <= 0) {
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
                </div>
              </div>
            )}

            {packageDetails?.has_guest_of_honor && (
              <div>
                <h3 className={`text-xl font-bold mb-4 text-neutral-900 flex items-center gap-2`}>
                  <User className={`w-5 h-5 text-${themeColor}-600`} /> Guest of Honor
                </h3>
                <div className="space-y-5">
                  <div>
                    <label className="block font-semibold mb-2 text-base text-neutral-800">Name</label>
                    <input
                      type="text"
                      name="guestOfHonorName"
                      value={formData.guestOfHonorName}
                      onChange={handleInputChange}
                      className={`w-full rounded-md border border-gray-200 px-4 py-2 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 bg-white text-neutral-900 text-base transition-all placeholder:text-gray-400`}
                      placeholder="Guest name"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block font-semibold mb-2 text-base text-neutral-800">Age</label>
                      <input
                        type="number"
                        name="guestOfHonorAge"
                        value={formData.guestOfHonorAge}
                        onChange={handleInputChange}
                        min="0"
                        className={`w-full rounded-md border border-gray-200 px-4 py-2 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 bg-white text-neutral-900 text-base transition-all`}
                      />
                    </div>
                    <div>
                      <label className="block font-semibold mb-2 text-base text-neutral-800">Gender</label>
                      <select
                        name="guestOfHonorGender"
                        value={formData.guestOfHonorGender}
                        onChange={handleInputChange}
                        className={`w-full rounded-md border border-gray-200 px-4 py-2 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 bg-white text-neutral-900 text-base transition-all`}
                      >
                        <option value="">Select</option>
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div>
              <h3 className={`text-xl font-bold mb-4 text-neutral-900`}>Customer Notes</h3>
              <textarea
                name="notes"
                rows={3}
                value={formData.notes}
                onChange={handleInputChange}
                className={`w-full rounded-md border border-gray-200 px-4 py-2 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 bg-white text-neutral-900 text-base transition-all placeholder:text-gray-400 resize-none`}
                placeholder="Special requests or notes from the customer..."
              />
            </div>

            <div>
              <div className="flex items-center gap-2 mb-4">
                <AlertCircle className={`w-5 h-5 text-amber-600`} />
                <h3 className="text-xl font-bold text-neutral-900">Internal Staff Notes</h3>
                <span className="text-xs text-amber-700 font-medium bg-amber-100 px-2 py-0.5 rounded">Staff Only</span>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-3">Private notes visible only to staff. Never shown to customers.</p>
                <textarea
                  name="internalNotes"
                  rows={3}
                  value={formData.internalNotes}
                  onChange={handleInputChange}
                  className={`w-full rounded-md border border-amber-200 px-4 py-2 focus:ring-2 focus:ring-amber-400 focus:border-transparent resize-none bg-white text-base placeholder:text-gray-400`}
                  placeholder="e.g., VIP customer, dietary restrictions, special arrangements..."
                />
              </div>
            </div>

            <div>
              <h3 className={`text-xl font-bold mb-4 text-neutral-900`}>Email Notification</h3>
              <div className="flex items-center justify-between bg-white border border-gray-200 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  {formData.sendNotification ? (
                    <Bell size={18} className="text-green-600" />
                  ) : (
                    <BellOff size={18} className="text-gray-400" />
                  )}
                  <span className="text-sm text-gray-700">
                    {formData.sendNotification ? 'Customer will receive update' : 'Silent update (no email)'}
                  </span>
                </div>
                <div className="flex items-center">
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, sendNotification: false }))}
                    className={`px-3 py-1 text-xs font-medium rounded-l-lg border transition-colors ${
                      !formData.sendNotification 
                        ? 'bg-gray-700 text-white border-gray-700' 
                        : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    Don't Send
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, sendNotification: true }))}
                    className={`px-3 py-1 text-xs font-medium rounded-r-lg border-t border-r border-b transition-colors ${
                      formData.sendNotification 
                        ? 'bg-green-600 text-white border-green-600' 
                        : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    Send Email
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4">
              <StandardButton
                variant="secondary"
                size="lg"
                onClick={() => navigate(getBackPath())}
                disabled={submitting}
              >
                Cancel
              </StandardButton>
              <StandardButton
                variant="primary"
                size="lg"
                icon={Save}
                type="submit"
                disabled={submitting}
                loading={submitting}
              >
                {submitting ? 'Saving...' : 'Save Changes'}
              </StandardButton>
            </div>
          </form>
        </div>
      </div>

      <div className="w-full md:w-96 md:sticky md:top-8 md:self-start">
        <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-6 md:p-8 shadow-none">
          <h2 className={`text-xl font-bold mb-4 text-${fullColor} pb-2`}>Booking Summary</h2>
          
          <div className="space-y-4">
            {packageDetails && (
              <div className="pb-4 border-b border-gray-100">
                <p className="text-sm text-gray-500 mb-1">Package</p>
                <p className="font-semibold text-gray-900">{packageDetails.name}</p>
                <p className="text-sm text-gray-600 mt-1">${Number(packageDetails.price).toFixed(2)}</p>
              </div>
            )}

            <div className="pb-4 border-b border-gray-100">
              <p className="text-sm text-gray-500 mb-1">Space</p>
              <p className="font-medium text-gray-900">
                {formData.roomId 
                  ? availableRooms.find(r => r.id === formData.roomId)?.name || 'Selected' 
                  : 'Not assigned'}
              </p>
            </div>

            <div className="pb-4 border-b border-gray-100">
              <p className="text-sm text-gray-500 mb-1">Customer</p>
              <p className="font-medium text-gray-900">{formData.customerName || 'Not specified'}</p>
              <p className="text-sm text-gray-600">{formData.email || 'No email'}</p>
              <p className="text-sm text-gray-600">{formData.phone || 'No phone'}</p>
            </div>

            <div className="pb-4 border-b border-gray-100">
              <p className="text-sm text-gray-500 mb-1">Date & Time</p>
              <p className="font-medium text-gray-900">
                {formData.date ? new Date(formData.date + 'T00:00:00').toLocaleDateString('en-US', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                }) : 'Not set'}
              </p>
              <p className="text-sm text-gray-600">
                {formData.time ? new Date(`2000-01-01T${formData.time}`).toLocaleTimeString('en-US', { 
                  hour: 'numeric', 
                  minute: '2-digit', 
                  hour12: true 
                }) : 'Not set'}
              </p>
            </div>

            <div className="pb-4 border-b border-gray-100">
              <p className="text-sm text-gray-500 mb-1">Participants</p>
              <p className="font-medium text-gray-900">{formData.participants || 0} people</p>
            </div>

            <div className="pb-4 border-b border-gray-100">
              <p className="text-sm text-gray-500 mb-1">Status</p>
              <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(formData.status)}`}>
                {formData.status.charAt(0).toUpperCase() + formData.status.slice(1).replace('-', ' ')}
              </span>
            </div>

            {formData.notes && (
              <div className="pb-4 border-b border-gray-100">
                <p className="text-sm text-gray-500 mb-1">Customer Notes</p>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{formData.notes}</p>
              </div>
            )}

            {formData.internalNotes && (
              <div className="pb-4 border-b border-gray-100">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-sm text-gray-500">Internal Notes</p>
                  <span className="text-xs text-amber-700 font-medium bg-amber-100 px-1.5 py-0.5 rounded">Staff Only</span>
                </div>
                <p className="text-sm text-amber-800 bg-amber-50 p-2 rounded whitespace-pre-wrap">{formData.internalNotes}</p>
              </div>
            )}

            <div>
              <p className="text-sm text-gray-500 mb-3">Applied Fees</p>
              <div className="space-y-3 mb-4">
                {appliedFees.map((fee, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-3 bg-gray-50 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-400 font-medium">Fee #{index + 1}</span>
                      <button
                        type="button"
                        onClick={() => setAppliedFees(appliedFees.filter((_, i) => i !== index))}
                        className="text-red-400 hover:text-red-600 text-xs font-medium"
                      >
                        Remove
                      </button>
                    </div>
                    <input
                      type="text"
                      placeholder="Fee name"
                      value={fee.fee_name}
                      onChange={(e) => {
                        const updated = [...appliedFees];
                        updated[index] = { ...updated[index], fee_name: e.target.value };
                        setAppliedFees(updated);
                      }}
                      className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          value={fee.fee_amount}
                          onChange={(e) => {
                            const updated = [...appliedFees];
                            updated[index] = { ...updated[index], fee_amount: parseFloat(e.target.value) || 0 };
                            setAppliedFees(updated);
                          }}
                          className="w-full border border-gray-300 rounded pl-6 pr-2 py-1.5 text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      <select
                        value={fee.fee_application_type}
                        onChange={(e) => {
                          const updated = [...appliedFees];
                          updated[index] = { ...updated[index], fee_application_type: e.target.value as 'additive' | 'inclusive' };
                          setAppliedFees(updated);
                        }}
                        className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="additive">Additive</option>
                        <option value="inclusive">Inclusive</option>
                      </select>
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setAppliedFees([...appliedFees, { fee_name: '', fee_amount: 0, fee_application_type: 'additive' }])}
                  className={`text-xs text-${fullColor} hover:underline`}
                >
                  + Add Fee
                </button>
                {appliedFees.length > 0 && (
                  <div className="text-xs text-gray-500 text-right">
                    Additive Fees: ${appliedFees.filter(f => f.fee_application_type === 'additive').reduce((sum, f) => sum + f.fee_amount, 0).toFixed(2)}
                  </div>
                )}
              </div>

              <p className="text-sm text-gray-500 mb-3">Payment Breakdown</p>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">
                    Package
                    {packageDetails?.min_participants && packageDetails.min_participants > 1 && (
                      <span className="text-xs text-gray-400 ml-1">(up to {packageDetails.min_participants} people)</span>
                    )}
                  </span>
                  <span className="font-medium text-gray-900">
                    ${packageDetails ? Number(packageDetails.price).toFixed(2) : '0.00'}
                  </span>
                </div>
                
                {formData.packageId === originalBooking?.package_id && originalBooking?.attractions && originalBooking.attractions.length > 0 && (
                  <div className="pt-2 border-t border-gray-100">
                    <p className="text-xs text-gray-500 mb-2">Attractions</p>
                    {originalBooking.attractions.map((attr, idx) => {
                      const price = Number(attr.pivot?.price_at_booking || 0);
                      const qty = Number(attr.pivot?.quantity || 1);
                      return (
                        <div key={idx} className="flex justify-between text-sm">
                          <span className="text-gray-600">
                            {attr.name} {qty > 1 && `×${qty}`}
                          </span>
                          <span className="text-gray-900">${(price * qty).toFixed(2)}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
                
                {Object.keys(selectedAddOns).length > 0 && (
                  <div className="pt-2 border-t border-gray-100">
                    <p className="text-xs text-gray-500 mb-2">Add-ons</p>
                    {Object.entries(selectedAddOns).map(([id, qty]) => {
                      const addOn = availableAddOns.find((a: any) => a.id === parseInt(id));
                      if (!addOn) return null;
                      const unit = getAddOnUnitPrice(parseInt(id), addOn);
                      const lineTotal = addOn.pricing_type === 'per_person'
                        ? unit * qty * formData.participants
                        : unit * qty;
                      return (
                        <div key={id} className="flex justify-between text-sm">
                          <span className="text-gray-600">
                            {addOn.name} {qty > 1 && `×${qty}`}{addOn.pricing_type === 'per_person' ? ` × ${formData.participants}` : ''}
                          </span>
                          <span className="text-gray-900">${lineTotal.toFixed(2)}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
                
                {(() => {
                  const basePackagePrice = packageDetails ? Number(packageDetails.price) : 0;
                  const minParticipants = packageDetails?.min_participants || 1;
                  const pricePerAdditional = Number(packageDetails?.price_per_additional || 0);
                  const additionalCount = Math.max(0, formData.participants - minParticipants);
                  const additionalParticipantCost = additionalCount * pricePerAdditional;
                  const packagePrice = basePackagePrice + additionalParticipantCost;
                  
                  const attractionsTotal = formData.packageId !== originalBooking?.package_id
                    ? 0
                    : (originalBooking?.attractions || []).reduce((sum, attr) => {
                        const price = Number(attr.pivot?.price_at_booking || 0);
                        const qty = Number(attr.pivot?.quantity || 1);
                        return sum + (price * qty);
                      }, 0);

                  const addonsTotal = computeAddonsTotal(selectedAddOns, formData.participants);

                  const originalTotal = Number(originalBooking?.total_amount || 0);

                  const additiveFeeTotal = appliedFees
                    .filter(f => f.fee_application_type === 'additive')
                    .reduce((sum, f) => sum + f.fee_amount, 0);

                  const isPackageChanged = formData.packageId !== originalBooking?.package_id;
                  const isParticipantsChanged = formData.participants !== originalBooking?.participants;
                  const originalFees = originalBooking?.applied_fees || [];
                  const feesChanged = JSON.stringify(appliedFees) !== JSON.stringify(originalFees);
                  const needsRecalc = isPackageChanged || isParticipantsChanged || feesChanged || addOnsChanged;
                  
                  const calculatedTotal = packagePrice + attractionsTotal + addonsTotal + additiveFeeTotal;
                  const displayTotal = needsRecalc ? calculatedTotal : originalTotal;
                  const balance = displayTotal - originalAmountPaid;
                  
                  return (
                    <>
                      {additionalCount > 0 && pricePerAdditional > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">
                            +{additionalCount} extra participant{additionalCount > 1 ? 's' : ''} × ${pricePerAdditional.toFixed(2)}
                          </span>
                          <span className="text-gray-900">${additionalParticipantCost.toFixed(2)}</span>
                        </div>
                      )}

                      {additiveFeeTotal > 0 && (
                        <div className="flex justify-between pt-2 border-t border-gray-100">
                          <span className="text-sm text-gray-600">Additive Fees</span>
                          <span className="font-medium text-gray-900">${additiveFeeTotal.toFixed(2)}</span>
                        </div>
                      )}

                      <div className="flex justify-between pt-3 border-t border-gray-200">
                        <span className="text-sm font-semibold text-gray-900">Total Amount</span>
                        <span className="font-bold text-gray-900">
                          ${displayTotal.toFixed(2)}
                          {needsRecalc && (
                            <span className="text-xs text-orange-600 ml-1">(Updated)</span>
                          )}
                        </span>
                      </div>
                      
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Amount Paid</span>
                        <span className="font-semibold text-green-600">${originalAmountPaid.toFixed(2)}</span>
                      </div>
                      
                      {balance > 0 && (
                        <div className="flex justify-between pt-2 border-t border-gray-100">
                          <span className="text-sm font-medium text-red-700">Balance Due</span>
                          <span className="font-bold text-red-600">${balance.toFixed(2)}</span>
                        </div>
                      )}
                      
                      {balance <= 0 && (
                        <div className="flex justify-between pt-2 border-t border-gray-100">
                          <span className="text-sm font-medium text-green-700">Payment Status</span>
                          <span className="font-bold text-green-600">Fully Paid</span>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditBooking;
