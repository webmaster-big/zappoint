import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Calendar, Package, User, Home, MapPin, AlertCircle, ArrowLeft, Bell, BellOff, Save, Plus, Minus, Gift } from 'lucide-react';
import QRCode from 'qrcode';
import StandardButton from '../../../components/ui/StandardButton';
import { useThemeColor } from '../../../hooks/useThemeColor';
import ChangeReasonModal from '../../../components/admin/bookings/ChangeReasonModal';
import OverlapOverrideDialog from '../../../components/admin/bookings/OverlapOverrideDialog';
import InternalNotesLog from '../../../components/admin/bookings/InternalNotesLog';
import BookingChangeHistory from '../../../components/admin/bookings/BookingChangeHistory';
import bookingService, { type Booking } from '../../../services/bookingService';
import { bookingCacheService } from '../../../services/BookingCacheService';
import packageService from '../../../services/PackageService';
import type { Package as PackageType } from '../../../services/PackageService';
import { packagePriceForParticipants, participantLabelFor } from '../../../utils/packagePricing';
import { resolvePaymentState, type BookingQuote } from '../../../types/Bookings.types';
import roomService from '../../../services/RoomService';
import { roomCacheService } from '../../../services/RoomCacheService';
import { packageCacheService } from '../../../services/PackageCacheService';
import timeSlotService, { type TimeSlot } from '../../../services/timeSlotService';
import { dayOffService, type DayOff } from '../../../services/DayOffService';
import { isSlotBlockedByClosure } from '../../../utils/dayOffClosure';
import locationService, { type Location } from '../../../services/LocationService';
import locationChangeRequestService from '../../../services/LocationChangeRequestService';
import DatePicker from '../../../components/ui/DatePicker';
import { useSpecialDeals } from '../../../hooks/useSpecialDeals';
import EmailInput from '../../../components/ui/EmailInput';
import { formatTimeTo12Hour, getStoredUser, getImageUrl } from '../../../utils/storage';
import type { AppliedFee } from '../../../utils/fees';
import { clampAddOnQuantity, getAddOnMinQuantity, isForceAddOn, seedForcedAddOns } from '../../../utils/addOnQuantity';
import { describeFollowUp } from '../../../utils/visitFollowUpNotice';
import { scheduleMatchesDate } from '../../../utils/packageSchedule';
import CustomPackageBadge from '../../../components/admin/CustomPackageBadge';
import { categoryService, type Category } from '../../../services/CategoryService';
import addOnService, { type AddOn } from '../../../services/AddOnService';
import { addOnCacheService } from '../../../services/AddOnCacheService';
import {
  CUSTOM_PACKAGE_LABEL,
  CUSTOM_PACKAGE_LIMITS,
  CUSTOM_PACKAGE_MESSAGES,
  ONE_TIME_ADD_ONS_LABEL,
  capacityText,
  catalogErrorKey,
  centsToDollars,
  customPackagePayload,
  customQuoteFromInput,
  customTermsInputFrom,
  customTermsOf,
  durationText,
  emptyCustomFeeInput,
  emptyOneTimeAddOnInput,
  endTimeText,
  feeErrorKey,
  feeLineLabel,
  formatMoney,
  isCustomBooking,
  oneTimeAddOnErrorKey,
  packageLineLabel,
  participantsHint,
  priceFieldLabel,
  pricingTypeLabel,
  toAppliedFees,
  toCents,
  validateCustomTerms,
  type CustomFeeInput,
  type CustomTermsInput,
  type OneTimeAddOnInput,
} from '../../../utils/customBooking';

const parseLocalDate = (isoDateString: string): Date => {
  const [year, month, day] = isoDateString.split('T')[0].split('-').map(Number);
  return new Date(year, month - 1, day);
};

type CustomFeeRow = CustomFeeInput & { rowKey: number };
type OneTimeAddOnRow = OneTimeAddOnInput & { rowKey: number };
type CustomEditorInput = Omit<CustomTermsInput, 'fees' | 'oneTimeAddOns'> & {
  fees: CustomFeeRow[];
  oneTimeAddOns: OneTimeAddOnRow[];
};

interface CustomCatalogAddOn {
  id: number;
  name: string;
  price: number | string | null;
  image?: string;
  min_quantity?: number | null;
  max_quantity?: number | null;
}

const fetchRoomsForLocation = async (locationId: number): Promise<Array<{ id: number; name: string }>> => {
  const cachedRooms = await roomCacheService.getFilteredRoomsFromCache({ location_id: locationId });
  if (cachedRooms && cachedRooms.length > 0) {
    roomCacheService.syncInBackground();
    return cachedRooms.map(room => ({ id: room.id, name: room.name }));
  }
  const rooms = await roomService.getAllRooms({ location_id: locationId });
  return rooms.map((room) => ({ id: room.id, name: room.name }));
};

const fetchLocationAddOns = async (locationId: number): Promise<AddOn[]> => {
  const cachedAddOns = await addOnCacheService.getFilteredAddOnsFromCache({ location_id: locationId, is_active: true });
  if (cachedAddOns.length > 0) {
    addOnCacheService.syncInBackground({ user_id: getStoredUser()?.id });
    return cachedAddOns;
  }
  return addOnService.getAllAddOns({ location_id: locationId, is_active: true });
};

const catalogQuantityRange = (addOn: { min_quantity?: number | null; max_quantity?: number | null } | null | undefined) => {
  const max = Number(addOn?.max_quantity);
  return {
    min: Math.max(1, Math.floor(Number(addOn?.min_quantity) || 0)),
    max: Number.isInteger(max) && max >= 1 ? max : CUSTOM_PACKAGE_LIMITS.catalogQuantityMax,
  };
};

const customInputClass = (themeColor: string) =>
  `w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-${themeColor}-500 focus:border-transparent`;

const NO_CUSTOM_ADD_ONS: CustomCatalogAddOn[] = [];

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
  const [showReasonPrompt, setShowReasonPrompt] = useState(false);
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
    sendNotification: true,
    guestOfHonorName: '',
    guestOfHonorAge: '',
    guestOfHonorGender: '',
  });

  const [availableDates, setAvailableDates] = useState<Date[]>([]);
  const [availableTimeSlots, setAvailableTimeSlots] = useState<TimeSlot[]>([]);
  const [blockedTimeSlots, setBlockedTimeSlots] = useState<TimeSlot[]>([]);
  const [loadingTimeSlots, setLoadingTimeSlots] = useState(false);
  const [dayOffs, setDayOffs] = useState<Date[]>([]);
  const [dayOffsWithTime, setDayOffsWithTime] = useState<DayOffWithTime[]>([]);
  const [appliedFees, setAppliedFees] = useState<AppliedFee[]>([]);
  const [quote, setQuote] = useState<BookingQuote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [selectedAddOns, setSelectedAddOns] = useState<{ [id: number]: number }>({});
  const [customInput, setCustomInput] = useState<CustomEditorInput | null>(null);
  const [customTermsUnavailable, setCustomTermsUnavailable] = useState(false);
  const [categoryNames, setCategoryNames] = useState<string[]>([]);
  const [categoriesStatus, setCategoriesStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [locationAddOns, setLocationAddOns] = useState<AddOn[]>([]);
  const [customAddOnsNotice, setCustomAddOnsNotice] = useState<string | null>(null);
  const [customSubmitAttempted, setCustomSubmitAttempted] = useState(false);
  const [customTouched, setCustomTouched] = useState<Record<string, true>>({});
  const customLocationRequestRef = useRef(0);
  const customRowKeyRef = useRef(0);
  const isCustom = isCustomBooking(originalBooking);
  const showGuestOfHonor = isCustom || !!packageDetails?.has_guest_of_honor;

  const nextCustomRowKey = () => {
    customRowKeyRef.current += 1;
    return customRowKeyRef.current;
  };

  const withCustomRowKeys = (input: CustomTermsInput): CustomEditorInput => ({
    ...input,
    fees: input.fees.map((fee) => ({ ...fee, rowKey: nextCustomRowKey() })),
    oneTimeAddOns: input.oneTimeAddOns.map((line) => ({ ...line, rowKey: nextCustomRowKey() })),
  });

  const loadPackagesAndRoomsForLocation = useCallback(async (locationId: number) => {
    const [packagesResult, roomsResult] = await Promise.all([
      (async () => {
        const cachedPackages = await packageCacheService.getFilteredPackagesFromCache({ location_id: locationId });
        if (cachedPackages.length > 0) {
          packageCacheService.syncInBackground();
          return cachedPackages;
        }
        return packageService.getAllPackages({ location_id: locationId });
      })(),

      fetchRoomsForLocation(locationId)
    ]);

    setAvailablePackages(packagesResult);
    setAvailableRooms(roomsResult);
  }, []);

  const loadCustomLocationData = useCallback(async (locationId: number) => {
    const request = ++customLocationRequestRef.current;
    const [roomsResult, addOnsResult] = await Promise.all([
      fetchRoomsForLocation(locationId),
      fetchLocationAddOns(locationId).catch((error) => {
        console.error('Error loading add-ons for location:', error);
        return [] as AddOn[];
      }),
    ]);
    if (request !== customLocationRequestRef.current) return;
    setAvailableRooms(roomsResult);
    setLocationAddOns(addOnsResult);
  }, []);

  const loadCategories = useCallback(async () => {
    setCategoriesStatus('loading');
    try {
      const response = await categoryService.getCategories();
      const list: Category[] = Array.isArray(response?.data) ? response.data : [];
      const names = list
        .map((category) => (typeof category?.name === 'string' ? category.name : ''))
        .filter((name) => name.trim() !== '');
      setCategoryNames(Array.from(new Set(names)));
      setCategoriesStatus('ready');
    } catch (error) {
      console.error('Error loading categories:', error);
      setCategoriesStatus('error');
    }
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

        if (isCustomBooking(bookingData)) {
          try {
            const fresh = await bookingService.getBookingById(Number(bookingData.id));
            if (fresh.success && fresh.data) {
              bookingData = fresh.data;
              await bookingCacheService.updateBookingInCache(fresh.data);
            }
          } catch (error) {
            console.error('Error loading custom package details:', error);
          }
        }

        const customBooking = isCustomBooking(bookingData);
        if (customBooking) {
          const terms = customTermsOf(bookingData);
          setCustomInput(terms ? withCustomRowKeys(customTermsInputFrom(terms)) : null);
          setCustomTermsUnavailable(!terms);
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
          sendNotification: true,
          guestOfHonorName: bookingData.guest_of_honor_name || '',
          guestOfHonorAge: bookingData.guest_of_honor_age ? String(bookingData.guest_of_honor_age) : '',
          guestOfHonorGender: bookingData.guest_of_honor_gender || '',
        });

        if (bookingData.applied_fees && Array.isArray(bookingData.applied_fees)) {
          setAppliedFees(bookingData.applied_fees);
        }

        setLoading(false);

        const locationId = bookingData.location_id;
        const packageId = bookingData.package_id;

        await Promise.all([
          customBooking ? loadCustomLocationData(locationId) : loadPackagesAndRoomsForLocation(locationId),

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

  useEffect(() => {
    if (isCustom) loadCategories();
  }, [isCustom, loadCategories]);

  const handleCustomLocationChange = async (locationId: number) => {
    if (!locationId || !originalBooking) return;
    const returningHome = locationId === Number(originalBooking.location_id);
    const droppedNames = returningHome
      ? []
      : Object.entries(selectedAddOns)
          .filter(([, quantity]) => quantity > 0)
          .map(([addOnId]) => customAddOnName(Number(addOnId)));
    const locationName = locations.find((loc) => loc.id === locationId)?.name || 'this location';

    setFormData(prev => ({ ...prev, locationId, roomId: null }));
    setSelectedAddOns(returningHome ? { ...originalAddOnSelection } : {});
    setCustomAddOnsNotice(
      droppedNames.length > 0 ? `Removed add-ons not offered at ${locationName}: ${droppedNames.join(', ')}.` : null
    );
    setAvailableRooms([]);
    setLocationAddOns([]);

    try {
      await loadCustomLocationData(locationId);
    } catch (error) {
      console.error('Error loading location data:', error);
    }
  };

  const handleLocationChange = async (locationId: number) => {
    if (isCustom) {
      await handleCustomLocationChange(locationId);
      return;
    }
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

  const clampParticipantsToPackage = (pkg: PackageType) => {
    setFormData(prev => ({
      ...prev,
      participants: Math.min(pkg.max_participants || Number.MAX_SAFE_INTEGER, Math.max(pkg.min_participants || 1, prev.participants)),
    }));
  };

  const handlePackageChange = async (packageId: number) => {
    setFormData(prev => ({ ...prev, packageId, date: '', time: '' }));
    setAvailableTimeSlots([]);
    setSelectedAddOns({});
    
    try {
      const cachedPackage = availablePackages.find(pkg => pkg.id === packageId);
      if (cachedPackage) {
        setPackageDetails(cachedPackage);
        clampParticipantsToPackage(cachedPackage);
        setSelectedAddOns(seedForcedAddOns(cachedPackage as any));
        return;
      }
      
      const packageResponse = await packageService.getPackage(packageId);
      if (packageResponse.success && packageResponse.data) {
        setPackageDetails(packageResponse.data);
        clampParticipantsToPackage(packageResponse.data);
        setSelectedAddOns(seedForcedAddOns(packageResponse.data as any));
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
            const targetsAttractionOrEvent = !!(dayOff.attraction_ids?.length || dayOff.event_ids?.length);
            const targetsPackageOrRoom = !!(dayOff.package_ids?.length || dayOff.room_ids?.length);
            if (targetsAttractionOrEvent && !targetsPackageOrRoom) return;
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
    const closures = dayOffsWithTime.filter(dayOff => {
      if (dayOff.date.getFullYear() !== selectedDateObj.getFullYear() ||
          dayOff.date.getMonth() !== selectedDateObj.getMonth() ||
          dayOff.date.getDate() !== selectedDateObj.getDate()) {
        return false;
      }
      if (dayOff.package_ids && dayOff.package_ids.length > 0) {
        return dayOff.package_ids.includes(packageDetails.id);
      }
      if (dayOff.room_ids && dayOff.room_ids.length > 0) {
        return false;
      }
      return true;
    });

    if (closures.length === 0) return false;

    return isSlotBlockedByClosure(slotStartTime, slotEndTime, closures);
  };

  const dayOffAppliesToPackage = (dayOff: { package_ids?: number[] | null; room_ids?: number[] | null }, packageId: number): boolean => {
    if (dayOff.package_ids && dayOff.package_ids.length > 0) {
      return dayOff.package_ids.includes(packageId);
    }
    if (dayOff.room_ids && dayOff.room_ids.length > 0) {
      return false;
    }
    return true;
  };

  const filteredDayOffsWithTime = useMemo(() => {
    if (!packageDetails) return dayOffsWithTime;
    return dayOffsWithTime.filter(d => dayOffAppliesToPackage(d, packageDetails.id));
  }, [dayOffsWithTime, packageDetails]);

  const originalAddOnSelection = useMemo(() => {
    const selection: { [id: number]: number } = {};
    (originalBooking?.add_ons || []).forEach((a) => {
      const addonId = a.pivot?.add_on_id ?? a.id;
      const qty = Number(a.pivot?.quantity ?? 0);
      if (addonId && qty > 0) selection[addonId] = qty;
    });
    return selection;
  }, [originalBooking]);

  const customAddOns = useMemo(() => {
    if (!isCustom || !originalBooking) return NO_CUSTOM_ADD_ONS;
    const locationId = Number(formData.locationId);
    const atOriginalLocation = locationId === Number(originalBooking.location_id);
    const keptIds = new Set(atOriginalLocation ? Object.keys(originalAddOnSelection).map(Number) : []);
    const list: CustomCatalogAddOn[] = locationAddOns
      .filter((addOn) => Number(addOn.location_id) === locationId)
      .filter((addOn) => keptIds.has(addOn.id) || (addOn.is_active !== false && addOn.price !== null && addOn.price !== undefined))
      .map((addOn) => ({
        id: addOn.id,
        name: addOn.name,
        price: addOn.price,
        image: addOn.image,
        min_quantity: addOn.min_quantity ?? null,
        max_quantity: addOn.max_quantity ?? null,
      }));
    if (atOriginalLocation) {
      (originalBooking.add_ons || []).forEach((a) => {
        const addonId = Number(a.pivot?.add_on_id ?? a.id);
        if (!addonId || list.some((addOn) => addOn.id === addonId)) return;
        const stored = a as { image?: string; min_quantity?: number | null; max_quantity?: number | null };
        list.push({
          id: addonId,
          name: a.name,
          price: a.pivot?.price_at_booking ?? a.price ?? 0,
          image: stored.image,
          min_quantity: stored.min_quantity ?? null,
          max_quantity: stored.max_quantity ?? null,
        });
      });
    }
    return list;
  }, [isCustom, originalBooking, formData.locationId, locationAddOns, originalAddOnSelection]);

  const availableAddOns = useMemo(() => {
    if (isCustom) return customAddOns as any[];
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
  }, [isCustom, customAddOns, packageDetails, originalBooking]);

  const customAddOnName = (addOnId: number): string =>
    availableAddOns.find((a: any) => a.id === addOnId)?.name
      || (originalBooking?.add_ons || []).find((a) => (a.pivot?.add_on_id ?? a.id) === addOnId)?.name
      || `Add-on #${addOnId}`;

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
    if (!addOn) return;

    setSelectedAddOns(prev => {
      const currentValue = prev[addOnId] || 0;
      const newValue = clampAddOnQuantity(addOn, formData.packageId, currentValue, currentValue + change);

      if (newValue <= 0) {
        const { [addOnId]: _removed, ...rest } = prev;
        return rest;
      }

      return { ...prev, [addOnId]: newValue };
    });
  };

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

  const customCatalogLines = useMemo(() => {
    if (!isCustom) return [];
    return Object.entries(selectedAddOns)
      .map(([addOnId, quantity]) => {
        const id = Number(addOnId);
        const addOn = availableAddOns.find((a: any) => a.id === id);
        if (!addOn || quantity <= 0) return null;
        const range = catalogQuantityRange(addOn);
        return {
          id,
          name: String(addOn.name ?? ''),
          quantity,
          minQuantity: addOn.min_quantity ?? null,
          maxQuantity: addOn.max_quantity ?? null,
          unitPrice: getAddOnUnitPrice(id, addOn),
          valid: quantity >= range.min && quantity <= range.max,
        };
      })
      .filter((line): line is NonNullable<typeof line> => line !== null);
  }, [isCustom, selectedAddOns, availableAddOns, getAddOnUnitPrice]);

  const customQuote = useMemo(() => {
    if (!isCustom || !customInput) return null;
    return customQuoteFromInput(
      customInput,
      formData.participants,
      customCatalogLines.filter((line) => line.valid).map(({ unitPrice, quantity }) => ({ unitPrice, quantity })),
    );
  }, [isCustom, customInput, formData.participants, customCatalogLines]);

  const customErrors = useMemo((): Record<string, string> => {
    if (!isCustom || !customInput) return {};
    return validateCustomTerms(customInput, {
      participants: formData.participants,
      locationId: formData.locationId,
      roomId: formData.roomId,
      catalog: customCatalogLines.map(({ id, name, quantity, minQuantity, maxQuantity }) => ({ id, name, quantity, minQuantity, maxQuantity })),
      amountPaid: originalAmountPaid,
      totalCents: customQuote ? customQuote.totalCents : null,
    });
  }, [isCustom, customInput, formData.participants, formData.locationId, formData.roomId, customCatalogLines, originalAmountPaid, customQuote]);

  useEffect(() => {
    if (customSubmitAttempted && Object.keys(customErrors).length === 0) setCustomSubmitAttempted(false);
  }, [customSubmitAttempted, customErrors]);

  const updateCustomInput = (patch: Partial<Omit<CustomEditorInput, 'fees' | 'oneTimeAddOns'>>) => {
    setCustomInput((prev) => (prev ? { ...prev, ...patch } : prev));
  };

  const touchCustomField = (key: string) => {
    setCustomTouched((prev) => (prev[key] ? prev : { ...prev, [key]: true }));
  };

  const focusCustomField = (elementId: string) => {
    window.requestAnimationFrame(() => document.getElementById(elementId)?.focus());
  };

  const addCustomFee = () => {
    if (!customInput || customInput.fees.length >= CUSTOM_PACKAGE_LIMITS.feesMax) return;
    const rowKey = nextCustomRowKey();
    setCustomInput((prev) => (prev ? { ...prev, fees: [...prev.fees, { ...emptyCustomFeeInput(), rowKey }] } : prev));
    focusCustomField(`custom-fee-name-${rowKey}`);
  };

  const updateCustomFee = (rowKey: number, patch: Partial<CustomFeeInput>) => {
    setCustomInput((prev) => (prev
      ? { ...prev, fees: prev.fees.map((fee) => (fee.rowKey === rowKey ? { ...fee, ...patch } : fee)) }
      : prev));
  };

  const removeCustomFee = (rowKey: number) => {
    setCustomInput((prev) => (prev ? { ...prev, fees: prev.fees.filter((fee) => fee.rowKey !== rowKey) } : prev));
  };

  const addOneTimeAddOn = () => {
    if (!customInput || customInput.oneTimeAddOns.length >= CUSTOM_PACKAGE_LIMITS.oneTimeAddOnsMax) return;
    const rowKey = nextCustomRowKey();
    setCustomInput((prev) => (prev
      ? { ...prev, oneTimeAddOns: [...prev.oneTimeAddOns, { ...emptyOneTimeAddOnInput(), rowKey }] }
      : prev));
    focusCustomField(`custom-addon-name-${rowKey}`);
  };

  const updateOneTimeAddOn = (rowKey: number, patch: Partial<OneTimeAddOnInput>) => {
    setCustomInput((prev) => (prev
      ? { ...prev, oneTimeAddOns: prev.oneTimeAddOns.map((line) => (line.rowKey === rowKey ? { ...line, ...patch } : line)) }
      : prev));
  };

  const removeOneTimeAddOn = (rowKey: number) => {
    setCustomInput((prev) => (prev
      ? { ...prev, oneTimeAddOns: prev.oneTimeAddOns.filter((line) => line.rowKey !== rowKey) }
      : prev));
  };

  const setCustomAddOnQuantity = (addOnId: number, typed: number, maxQty: number) => {
    const quantity = Math.max(0, Math.min(maxQty, Number.isFinite(typed) ? Math.floor(typed) : 0));
    setSelectedAddOns((prev) => {
      if (quantity <= 0) {
        const { [addOnId]: _removed, ...rest } = prev;
        return rest;
      }
      return { ...prev, [addOnId]: quantity };
    });
  };

  useEffect(() => {
    if (!originalBooking?.id || !formData.packageId) return;

    let cancelled = false;
    setQuoteLoading(true);

    const handle = window.setTimeout(async () => {
      const packageChanged = formData.packageId !== originalBooking.package_id;
      try {
        const res = await bookingService.repriceBooking(Number(originalBooking.id), {
          participants: formData.participants,
          package_id: formData.packageId,
          booking_date: formData.date || undefined,
          booking_time: formData.time || undefined,
          location_id: formData.locationId || undefined,
          additional_addons: buildAdditionalAddons().map(({ addon_id, quantity }) => ({ addon_id, quantity })),
          ...(packageChanged ? { additional_attractions: [] } : {}),
        });
        if (cancelled) return;
        if (res.success && res.data) {
          setQuote(res.data);
          setQuoteError(null);
        } else {
          setQuote(null);
          setQuoteError(res.message || 'Could not price this booking.');
        }
      } catch (err) {
        if (!cancelled) {
          setQuote(null);
          setQuoteError(
            (err as { response?: { data?: { message?: string } } })?.response?.data?.message
              || 'Could not reach the pricing service. Refresh before saving.'
          );
        }
      } finally {
        if (!cancelled) setQuoteLoading(false);
      }
    }, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [originalBooking, formData.participants, formData.packageId, formData.date, formData.time, formData.locationId, buildAdditionalAddons]);

  const { dealDates } = useSpecialDeals('package', formData.packageId || null, formData.locationId || null);

  const dateMinParticipants = Math.max(1, Number((availableTimeSlots[0] as { min_participants?: number } | undefined)?.min_participants ?? packageDetails?.min_participants ?? 1));

  // the package's advance booking notice is a rule for CUSTOMERS booking online; staff working
  // the desk are not held to it, so it never thins the admin list
  const filteredTimeSlots = availableTimeSlots;

  /**
   * Availability no longer offers starts that have already passed, so a booking being edited later
   * the same day would lose its own time from the list. Keep it selectable and clearly marked.
   */
  const displayedTimeSlots: TimeSlot[] = (() => {
    const listed: TimeSlot[] = [...filteredTimeSlots];
    const isListed = (start: string) => listed.some(slot => slot.start_time === start);

    [
      ...blockedTimeSlots,
    ].forEach(slot => {
      if (!isListed(slot.start_time)) listed.push({ ...slot, blocked: true });
    });

    if (
      formData.time &&
      !isListed(formData.time) &&
      originalBooking &&
      originalBooking.booking_time?.slice(0, 5) === formData.time &&
      originalBooking.booking_date?.split('T')[0] === formData.date
    ) {
      const unit = originalBooking.duration_unit || 'hours';
      const raw = Number(originalBooking.duration) || 0;
      const durationMinutes = unit === 'minutes' ? Math.round(raw) : Math.round(raw * 60);
      const [startHours, startMinutes] = formData.time.split(':').map(Number);
      const endTotal = (startHours * 60 + startMinutes + durationMinutes) % (24 * 60);

      const current: TimeSlot = {
        start_time: formData.time,
        end_time: `${String(Math.floor(endTotal / 60)).padStart(2, '0')}:${String(endTotal % 60).padStart(2, '0')}`,
        duration: raw,
        duration_unit: unit,
        room_id: originalBooking.room_id ?? null,
      };

      listed.push(isTimeSlotRestricted(current.start_time, current.end_time) ? { ...current, blocked: true } : current);
    }

    return listed.sort((a, b) => a.start_time.localeCompare(b.start_time));
  })();

  const selectedSlotIsBlocked = displayedTimeSlots.some(slot => slot.blocked && slot.start_time === formData.time);

  useEffect(() => {
    if (!packageDetails) return;

    const today = new Date();
    const dates: Date[] = [];

    const packageWindow = packageDetails.booking_window_days;
    const locationWindow = packageDetails.location?.booking_window_days;
    const bookingWindowDays = packageWindow ?? locationWindow ?? null;
    const maxDays = bookingWindowDays === null ? 730 : Math.max(1, bookingWindowDays);

    for (let i = 0; i < maxDays; i++) {
      const date = new Date();
      date.setDate(today.getDate() + i);

      let isAvailable = false;

      if (packageDetails.availability_schedules && packageDetails.availability_schedules.length > 0) {
        for (const schedule of packageDetails.availability_schedules) {
          if (schedule.is_active && scheduleMatchesDate(schedule, date)) {
            isAvailable = true;
            break;
          }
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
      setBlockedTimeSlots([]);
      return;
    }

    setLoadingTimeSlots(true);

    const eventSource = timeSlotService.getAvailableSlotsSSE({
      package_id: packageDetails.id,
      date: formData.date,
      include_blocked: true,
    });

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const slots: TimeSlot[] = Array.isArray(data.available_slots) ? data.available_slots : [];
        setAvailableTimeSlots(slots.filter(slot => !slot.blocked));
        setBlockedTimeSlots(slots.filter(slot => slot.blocked));
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
      [name]: name === 'participants' ? (parseInt(value, 10) || 0) : name === 'roomId' ? Number(value) : value
    }));
  };

  // Editing a booking is a guest-visible change, so it cannot be saved without a recorded
  // reason. The form is validated first so staff are not asked for a reason on a doomed save.
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!originalBooking) {
      alert('Booking data not found');
      return;
    }

    if (isCustom) {
      if (!customInput || !customQuote) return;
      if (Object.keys(customErrors).length > 0) {
        setCustomSubmitAttempted(true);
        window.requestAnimationFrame(() => {
          document.querySelector('[data-custom-error]')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
        return;
      }
    }

    setShowReasonPrompt(true);
  };

  const overrideTokenRef = useRef<string | null>(null);
  const [overrideGate, setOverrideGate] = useState<{ conflicts: string[]; reason: string } | null>(null);

  const performSubmit = async (changeReason: string) => {
    if (!originalBooking) return;

    setSubmitting(true);

    try {
      const isPackageChanged = !isCustom && formData.packageId !== originalBooking.package_id;
      const additionalAddons = buildAdditionalAddons();
      const statusChanged = formData.status !== originalBooking.status;
      const closingVisit = statusChanged && (formData.status === 'completed' || formData.status === 'cancelled');
      const sendUpdateEmail = formData.sendNotification && !(statusChanged && formData.status === 'completed');
      const customPricing = isCustom && customInput && customQuote
        ? {
            custom_package: customPackagePayload(customInput),
            total_amount: centsToDollars(customQuote.totalCents),
            applied_fees: customQuote.fees.length > 0 ? toAppliedFees(customQuote) : null,
          }
        : null;

      if (isCustom && !customPricing) {
        setSubmitting(false);
        setShowReasonPrompt(false);
        return;
      }

      const response = await bookingService.updateBooking(Number(originalBooking.id), {
        change_reason: changeReason,
        guest_name: formData.customerName,
        guest_email: formData.email,
        guest_phone: formData.phone,
        booking_date: formData.date,
        booking_time: formData.time,
        participants: formData.participants,
        ...(statusChanged && { status: formData.status }),
        location_id: formData.locationId || undefined,
        package_id: isCustom ? undefined : formData.packageId || undefined,
        room_id: formData.roomId || null,
        notes: formData.notes,
        send_notification: sendUpdateEmail,
        ...(addOnsChanged && { additional_addons: additionalAddons }),
        ...(isPackageChanged && { additional_attractions: [] }),
        ...(customPricing ?? {}),
        ...(quote && {
          total_amount: quote.total_amount,
          discount_amount: quote.discount_amount,
          applied_fees: quote.persist_fees.length > 0 ? quote.persist_fees : null,
          ...(quote.applied_discounts && { applied_discounts: quote.applied_discounts.length > 0 ? quote.applied_discounts : null }),
        }),
        guest_of_honor_name: showGuestOfHonor ? (formData.guestOfHonorName.trim() || null) : undefined,
        guest_of_honor_age: showGuestOfHonor ? (formData.guestOfHonorAge ? parseInt(formData.guestOfHonorAge) : null) : undefined,
        guest_of_honor_gender: showGuestOfHonor ? ((formData.guestOfHonorGender as 'male' | 'female' | 'other') || null) : undefined,
        overlap_override_token: overrideTokenRef.current || undefined,
      });

      // one approval, one save: the server burns the token anyway, so never resend it
      overrideTokenRef.current = null;

      if (response.success) {
        if (response.data) {
          await bookingCacheService.updateBookingInCache(response.data);
        }

        if (sendUpdateEmail && !closingVisit) {
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
        
        const followUpNotice = formData.status === 'completed' && response.follow_up ? describeFollowUp(response.follow_up) : null;
        alert(followUpNotice ? `Booking updated successfully! ${followUpNotice}` : 'Booking updated successfully!');
        navigate(getBackPath());
      } else {
        alert('Failed to update booking. Please try again.');
        setSubmitting(false);
        setShowReasonPrompt(false);
      }
    } catch (error) {
      console.error('Error updating booking:', error);
      const failure = (error as {
        response?: { status?: number; data?: { message?: string; requires_override?: boolean; conflicts?: string[]; errors?: { change_reason?: string[] } } };
      })?.response;

      // the move runs into something the page could not see — a slot taken since it loaded, a
      // break, another booking. Ask for the manager's PIN rather than leaving staff with an
      // error they cannot act on.
      if (failure?.status === 409 && failure.data?.requires_override) {
        const reasons = (failure.data.conflicts ?? []).map(
          reason => `${reason.charAt(0).toUpperCase()}${reason.slice(1)}.`
        );
        setOverrideGate({
          // never leave the dialog with nothing to approve: with an empty list it would offer a
          // plain Continue that closes without saving, and the edit would vanish silently
          conflicts: reasons.length > 0 ? reasons : ['That space is not free at the new time.'],
          reason: changeReason,
        });
        setSubmitting(false);
        setShowReasonPrompt(false);
        return;
      }

      if (isCustom && (failure?.data as { code?: string } | undefined)?.code === 'CUSTOM_PRICE_MISMATCH' && formData.locationId) {
        void refreshCustomAddOns(formData.locationId);
      }

      const message = failure?.data?.errors?.change_reason?.[0] ?? failure?.data?.message;
      alert(message ?? 'Error updating booking. Please try again.');
      setSubmitting(false);
      setShowReasonPrompt(false);
    }
  };

  const refreshCustomAddOns = async (locationId: number) => {
    const request = customLocationRequestRef.current;
    try {
      const fresh = await addOnService.getAllAddOns({ location_id: locationId, is_active: true });
      if (request === customLocationRequestRef.current) setLocationAddOns(fresh);
    } catch (error) {
      console.error('Error refreshing add-ons:', error);
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

  const customFieldError = (key: string, touchKey?: string) => {
    const message = customErrors[key];
    if (!message || (touchKey && !customSubmitAttempted && !customTouched[touchKey])) return null;
    return <p className="text-xs text-red-600 mt-1" data-custom-error>{message}</p>;
  };

  const customLabelClass = 'block text-xs font-medium text-gray-600 mb-1';
  const customFieldClass = customInputClass(themeColor);
  const customRemoveButtonClass = 'inline-flex items-center justify-center shrink-0 h-9 w-9 rounded-lg border border-gray-300 bg-white text-base leading-none text-gray-700 hover:bg-gray-100 transition-colors';
  const originalCustomCategory = originalBooking?.custom_package_category ?? '';
  const customCategoryOptions = [
    ...categoryNames,
    ...[originalCustomCategory, customInput?.category ?? '']
      .filter((name, index, names) => name.trim() !== '' && !categoryNames.includes(name) && names.indexOf(name) === index),
  ];
  const customEndText = isCustom && customInput ? endTimeText(formData.date, formData.time, customInput.durationMinutes) : '';

  const customPackageSection = (
    <div>
      <h3 className="text-xl font-bold mb-4 text-neutral-900 flex flex-wrap items-center gap-2">
        <Package className={`w-5 h-5 text-${themeColor}-600`} /> {CUSTOM_PACKAGE_LABEL}
        <CustomPackageBadge size="sm" />
      </h3>
      {!customInput || customTermsUnavailable ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700" data-custom-error>
          This booking's custom package details could not be loaded. Refresh the page to try again.
        </div>
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-6 gap-3">
            <div className="col-span-6 sm:col-span-3 min-w-0">
              <label htmlFor="custom-package-name" className={customLabelClass}>Booking Name *</label>
              <input
                id="custom-package-name"
                type="text"
                maxLength={CUSTOM_PACKAGE_LIMITS.nameMaxLength}
                placeholder="e.g. Team Outing"
                value={customInput.name}
                onChange={(e) => updateCustomInput({ name: e.target.value })}
                aria-invalid={!!customErrors.name}
                className={customFieldClass}
              />
              {customFieldError('name')}
            </div>
            <div className="col-span-6 sm:col-span-3 min-w-0">
              <label htmlFor="custom-package-category" className={customLabelClass}>Category *</label>
              <select
                id="custom-package-category"
                value={customInput.category}
                onChange={(e) => updateCustomInput({ category: e.target.value })}
                aria-invalid={!!customErrors.category}
                className={customFieldClass}
              >
                <option value="" disabled>Select a category</option>
                {customCategoryOptions.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
              {categoriesStatus === 'error' && (
                <p className="text-xs text-red-600 mt-1">
                  {CUSTOM_PACKAGE_MESSAGES.categoriesFailed}{' '}
                  <button type="button" onClick={() => void loadCategories()} className={`font-medium underline text-${themeColor}-600`}>
                    Retry
                  </button>
                </p>
              )}
              {categoriesStatus === 'ready' && categoryNames.length === 0 && (
                <p className="text-xs text-gray-500 mt-1">{CUSTOM_PACKAGE_MESSAGES.noCategories}</p>
              )}
              {customFieldError('category')}
            </div>
            <div className="col-span-2 min-w-0">
              <label htmlFor="custom-package-duration" className={customLabelClass}>Duration (min) *</label>
              <input
                id="custom-package-duration"
                type="number"
                min={1}
                max={CUSTOM_PACKAGE_LIMITS.durationMaxMinutes}
                step={1}
                placeholder="e.g. 90"
                value={customInput.durationMinutes}
                onChange={(e) => updateCustomInput({ durationMinutes: e.target.value })}
                onWheel={(e) => e.currentTarget.blur()}
                aria-invalid={!!customErrors.durationMinutes}
                className={customFieldClass}
              />
              {customFieldError('durationMinutes')}
            </div>
            <div className="col-span-2 min-w-0">
              <label htmlFor="custom-package-min-guests" className={customLabelClass}>Min. Guests</label>
              <input
                id="custom-package-min-guests"
                type="number"
                min={1}
                max={CUSTOM_PACKAGE_LIMITS.guestsMax}
                step={1}
                placeholder="Optional"
                value={customInput.minGuests}
                onChange={(e) => updateCustomInput({ minGuests: e.target.value })}
                onWheel={(e) => e.currentTarget.blur()}
                aria-invalid={!!customErrors.minGuests}
                className={customFieldClass}
              />
              {customFieldError('minGuests')}
            </div>
            <div className="col-span-2 min-w-0">
              <label htmlFor="custom-package-max-guests" className={customLabelClass}>Max. Guests *</label>
              <input
                id="custom-package-max-guests"
                type="number"
                min={1}
                max={CUSTOM_PACKAGE_LIMITS.guestsMax}
                step={1}
                placeholder="e.g. 30"
                value={customInput.maxGuests}
                onChange={(e) => updateCustomInput({ maxGuests: e.target.value })}
                onWheel={(e) => e.currentTarget.blur()}
                aria-invalid={!!customErrors.maxGuests}
                className={customFieldClass}
              />
              {customFieldError('maxGuests')}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="min-w-0">
              <label htmlFor="custom-package-pricing" className={customLabelClass}>Pricing</label>
              <select
                id="custom-package-pricing"
                value={customInput.pricingType}
                onChange={(e) => updateCustomInput({ pricingType: e.target.value === 'per_guest' ? 'per_guest' : 'per_booking' })}
                className={customFieldClass}
              >
                <option value="per_booking">{pricingTypeLabel('per_booking')}</option>
                <option value="per_guest">{pricingTypeLabel('per_guest')}</option>
              </select>
            </div>
            <div className="min-w-0">
              <label htmlFor="custom-package-price" className={customLabelClass}>{priceFieldLabel(customInput.pricingType)} *</label>
              <div className="flex items-center gap-1.5">
                <span className="text-sm text-gray-500" aria-hidden="true">$</span>
                <input
                  id="custom-package-price"
                  type="number"
                  min={0}
                  max={CUSTOM_PACKAGE_LIMITS.priceMax}
                  step="0.01"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={customInput.price}
                  onChange={(e) => updateCustomInput({ price: e.target.value })}
                  onWheel={(e) => e.currentTarget.blur()}
                  aria-invalid={!!customErrors.price}
                  className={customFieldClass}
                />
              </div>
              {customInput.pricingType === 'per_guest' && (
                <p className="text-xs text-gray-500 mt-1">Uses the participant count.</p>
              )}
              {customFieldError('price')}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-medium text-gray-700">Fees</span>
              <StandardButton
                type="button"
                variant="secondary"
                size="sm"
                onClick={addCustomFee}
                disabled={customInput.fees.length >= CUSTOM_PACKAGE_LIMITS.feesMax}
              >
                + Add Fee
              </StandardButton>
            </div>
            {customInput.fees.map((fee, index) => {
              const isPercent = fee.type === 'percent';
              return (
                <div key={fee.rowKey} className="rounded-lg border border-gray-200 bg-gray-50 p-2 space-y-2">
                  <div className="flex items-end gap-2">
                    <div className="flex-1 min-w-0">
                      <label htmlFor={`custom-fee-name-${fee.rowKey}`} className={customLabelClass}>Fee Name</label>
                      <input
                        id={`custom-fee-name-${fee.rowKey}`}
                        type="text"
                        maxLength={CUSTOM_PACKAGE_LIMITS.lineNameMaxLength}
                        placeholder="e.g. Venue Fee"
                        value={fee.name}
                        onChange={(e) => updateCustomFee(fee.rowKey, { name: e.target.value })}
                        onBlur={() => touchCustomField(`fee.${fee.rowKey}.name`)}
                        className={customFieldClass}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeCustomFee(fee.rowKey)}
                      title="Remove fee"
                      aria-label="Remove fee"
                      className={customRemoveButtonClass}
                    >
                      ×
                    </button>
                  </div>
                  {customFieldError(feeErrorKey(index, 'name'), `fee.${fee.rowKey}.name`)}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="min-w-0">
                      <label htmlFor={`custom-fee-type-${fee.rowKey}`} className={customLabelClass}>Fee Type</label>
                      <select
                        id={`custom-fee-type-${fee.rowKey}`}
                        value={fee.type}
                        onChange={(e) => updateCustomFee(fee.rowKey, { type: e.target.value === 'percent' ? 'percent' : 'flat' })}
                        className={customFieldClass}
                      >
                        <option value="flat">Flat fee</option>
                        <option value="percent">Percent</option>
                      </select>
                    </div>
                    <div className="min-w-0">
                      <label htmlFor={`custom-fee-amount-${fee.rowKey}`} className={customLabelClass}>{isPercent ? 'Rate (%)' : 'Amount'}</label>
                      <div className="flex items-center gap-1.5">
                        {!isPercent && <span className="text-sm text-gray-500" aria-hidden="true">$</span>}
                        <input
                          id={`custom-fee-amount-${fee.rowKey}`}
                          type="number"
                          min={0}
                          max={isPercent ? CUSTOM_PACKAGE_LIMITS.percentMax : CUSTOM_PACKAGE_LIMITS.priceMax}
                          step="0.01"
                          inputMode="decimal"
                          placeholder="0.00"
                          value={fee.amount}
                          onChange={(e) => updateCustomFee(fee.rowKey, { amount: e.target.value })}
                          onBlur={() => touchCustomField(`fee.${fee.rowKey}.amount`)}
                          onWheel={(e) => e.currentTarget.blur()}
                          className={customFieldClass}
                        />
                        {isPercent && <span className="text-sm text-gray-500" aria-hidden="true">%</span>}
                      </div>
                      {customFieldError(feeErrorKey(index, 'amount'), `fee.${fee.rowKey}.amount`)}
                    </div>
                  </div>
                </div>
              );
            })}
            {customInput.fees.length > 0 && (
              <p className="text-xs text-gray-500">Percentage fees use the package and add-ons subtotal.</p>
            )}
            {customFieldError('fees')}
          </div>
        </div>
      )}
    </div>
  );

  const customOneTimeAddOnsPanel = customInput ? (
    <div className="mb-4 space-y-3">
      <StandardButton
        type="button"
        variant="secondary"
        size="sm"
        onClick={addOneTimeAddOn}
        disabled={customInput.oneTimeAddOns.length >= CUSTOM_PACKAGE_LIMITS.oneTimeAddOnsMax}
      >
        + Add One-Time Add-on
      </StandardButton>
      {customInput.oneTimeAddOns.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
          <p className="text-xs font-medium text-gray-700">{ONE_TIME_ADD_ONS_LABEL}</p>
          <p className="text-xs text-gray-500 mb-2">These add-ons apply only to this booking.</p>
          <div className="space-y-3">
            {customInput.oneTimeAddOns.map((line, index) => (
              <div key={line.rowKey}>
                <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto] sm:grid-cols-[minmax(0,1.45fr)_minmax(0,0.55fr)_minmax(0,0.85fr)_auto] items-end gap-2">
                  <div className="col-span-3 sm:col-span-1 min-w-0">
                    <label htmlFor={`custom-addon-name-${line.rowKey}`} className={customLabelClass}>Add-on Name</label>
                    <input
                      id={`custom-addon-name-${line.rowKey}`}
                      type="text"
                      maxLength={CUSTOM_PACKAGE_LIMITS.lineNameMaxLength}
                      placeholder="e.g. Glow Bracelets"
                      value={line.name}
                      onChange={(e) => updateOneTimeAddOn(line.rowKey, { name: e.target.value })}
                      onBlur={() => touchCustomField(`addon.${line.rowKey}.name`)}
                      className={customFieldClass}
                    />
                  </div>
                  <div className="min-w-0">
                    <label htmlFor={`custom-addon-quantity-${line.rowKey}`} className={customLabelClass}>Qty.</label>
                    <input
                      id={`custom-addon-quantity-${line.rowKey}`}
                      type="number"
                      min={1}
                      max={CUSTOM_PACKAGE_LIMITS.oneTimeQuantityMax}
                      step={1}
                      value={line.quantity}
                      onChange={(e) => updateOneTimeAddOn(line.rowKey, { quantity: e.target.value })}
                      onBlur={() => touchCustomField(`addon.${line.rowKey}.quantity`)}
                      onWheel={(e) => e.currentTarget.blur()}
                      className={customFieldClass}
                    />
                  </div>
                  <div className="min-w-0">
                    <label htmlFor={`custom-addon-price-${line.rowKey}`} className={customLabelClass}>Unit Price</label>
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm text-gray-500" aria-hidden="true">$</span>
                      <input
                        id={`custom-addon-price-${line.rowKey}`}
                        type="number"
                        min={0}
                        max={CUSTOM_PACKAGE_LIMITS.priceMax}
                        step="0.01"
                        inputMode="decimal"
                        placeholder="0.00"
                        value={line.unitPrice}
                        onChange={(e) => updateOneTimeAddOn(line.rowKey, { unitPrice: e.target.value })}
                        onBlur={() => touchCustomField(`addon.${line.rowKey}.unitPrice`)}
                        onWheel={(e) => e.currentTarget.blur()}
                        className={customFieldClass}
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeOneTimeAddOn(line.rowKey)}
                    title="Remove add-on"
                    aria-label="Remove add-on"
                    className={customRemoveButtonClass}
                  >
                    ×
                  </button>
                </div>
                {customFieldError(oneTimeAddOnErrorKey(index, 'name'), `addon.${line.rowKey}.name`)}
                {customFieldError(oneTimeAddOnErrorKey(index, 'quantity'), `addon.${line.rowKey}.quantity`)}
                {customFieldError(oneTimeAddOnErrorKey(index, 'unitPrice'), `addon.${line.rowKey}.unitPrice`)}
              </div>
            ))}
          </div>
        </div>
      )}
      {customFieldError('oneTimeAddOns')}
    </div>
  ) : null;

  const customSummaryBlock = customInput ? (
    <div className="pb-4 border-b border-gray-100">
      <div className="flex items-center gap-2 mb-1">
        <p className="text-sm text-gray-500">{CUSTOM_PACKAGE_LABEL}</p>
        <CustomPackageBadge />
      </div>
      <p className="font-semibold text-gray-900 break-words">{customInput.name.trim() || CUSTOM_PACKAGE_LABEL}</p>
      <dl className="mt-2 space-y-1 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-gray-500">Category</dt>
          <dd className="text-gray-900 text-right break-words">{customInput.category || 'Choose a category'}</dd>
        </div>
        {durationText(customInput.durationMinutes) && (
          <div className="flex justify-between gap-3">
            <dt className="text-gray-500">Duration</dt>
            <dd className="text-gray-900 text-right">{durationText(customInput.durationMinutes)}</dd>
          </div>
        )}
        {capacityText(customInput.minGuests, customInput.maxGuests) && (
          <div className="flex justify-between gap-3">
            <dt className="text-gray-500">Guests</dt>
            <dd className="text-gray-900 text-right">{capacityText(customInput.minGuests, customInput.maxGuests)}</dd>
          </div>
        )}
        <div className="flex justify-between gap-3">
          <dt className="text-gray-500">Pricing</dt>
          <dd className="text-gray-900 text-right">{pricingTypeLabel(customInput.pricingType)}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-gray-500">{priceFieldLabel(customInput.pricingType)}</dt>
          <dd className="text-gray-900 text-right">
            {customInput.price.trim() === '' ? '—' : formatMoney(toCents(customInput.price))}
          </dd>
        </div>
      </dl>
    </div>
  ) : null;

  const customPaymentSummary = (() => {
    if (!customInput || !customQuote) return null;
    const totalCents = customQuote.totalCents;
    const totalChanged = totalCents !== toCents(originalBooking?.total_amount ?? 0);
    const paymentState = resolvePaymentState({
      payment_status: originalBooking?.payment_status,
      amount_paid: originalAmountPaid,
      total_amount: centsToDollars(totalCents),
    });
    const catalogRows = customCatalogLines.filter((line) => line.valid);
    const oneTimeRows = customInput.oneTimeAddOns
      .map((line) => {
        const quantity = Math.floor(Number(line.quantity));
        return {
          rowKey: line.rowKey,
          name: line.name.trim() || 'One-time add-on',
          quantity,
          cents: Math.max(0, toCents(line.unitPrice)) * quantity,
          listed: Number.isFinite(quantity) && quantity > 0 && line.unitPrice.trim() !== '',
        };
      })
      .filter((row) => row.listed);

    return (
      <div>
        <p className="text-sm text-gray-500 mb-3">Payment Breakdown</p>
        <div className="space-y-2">
          <div className="flex justify-between gap-3">
            <span className="text-sm text-gray-600">{packageLineLabel(customInput.pricingType, formData.participants, customInput.price)}</span>
            <span className="font-medium text-gray-900">{formatMoney(customQuote.packageCents)}</span>
          </div>

          {catalogRows.length > 0 && (
            <div className="pt-2 border-t border-gray-100">
              <p className="text-xs text-gray-500 mb-2">Add-ons</p>
              {catalogRows.map((line) => (
                <div key={line.id} className="flex justify-between gap-3 text-sm">
                  <span className="text-gray-600 break-words">
                    {line.name} {line.quantity > 1 && `×${line.quantity}`}
                  </span>
                  <span className="text-gray-900">{formatMoney(Math.max(0, toCents(line.unitPrice)) * line.quantity)}</span>
                </div>
              ))}
            </div>
          )}

          {oneTimeRows.length > 0 && (
            <div className="pt-2 border-t border-gray-100">
              <p className="text-xs text-gray-500 mb-2">{ONE_TIME_ADD_ONS_LABEL}</p>
              {oneTimeRows.map((row) => (
                <div key={row.rowKey} className="flex justify-between gap-3 text-sm">
                  <span className="text-gray-600 break-words">
                    {row.name} {row.quantity > 1 && `×${row.quantity}`}
                  </span>
                  <span className="text-gray-900">{formatMoney(row.cents)}</span>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-between pt-2 border-t border-gray-100">
            <span className="text-sm text-gray-600">Subtotal</span>
            <span className="font-medium text-gray-900">{formatMoney(customQuote.subtotalCents)}</span>
          </div>

          {customQuote.fees.map((fee, index) => (
            <div key={`${fee.name}-${index}`} className="flex justify-between gap-3">
              <span className="text-sm text-gray-600 break-words">{feeLineLabel(fee) || 'Fee'}</span>
              <span className="font-medium text-gray-900">+{formatMoney(fee.cents)}</span>
            </div>
          ))}

          <div className="flex justify-between pt-3 border-t border-gray-200">
            <span className="text-sm font-semibold text-gray-900">Total Amount</span>
            <span className="font-bold text-gray-900">
              {formatMoney(totalCents)}
              {totalChanged && <span className="ml-1 text-xs text-orange-600">(Updated)</span>}
            </span>
          </div>
          {customFieldError('total')}

          <div className="flex justify-between">
            <span className="text-sm text-gray-600">Amount Paid</span>
            <span className="font-semibold text-green-600">${originalAmountPaid.toFixed(2)}</span>
          </div>
          {customFieldError('amountPaid')}

          <div className="flex justify-between pt-2 border-t border-gray-100">
            <span className={`text-sm font-medium ${paymentState.isSettled ? 'text-green-700' : 'text-red-700'}`}>
              {paymentState.balanceLabel}
            </span>
            <span className={`font-bold ${paymentState.amountClass}`}>
              {paymentState.isSettled && paymentState.balance >= -0.005
                ? paymentState.label
                : `$${Math.abs(paymentState.balance).toFixed(2)}`}
            </span>
          </div>
        </div>
      </div>
    );
  })();

  return (
    <>
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
                    <option value="" disabled={isCustom}>Select a location</option>
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>{loc?.name}</option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500">
                    {isCustom
                      ? "Changing the location resets the space and removes add-ons that aren't offered there."
                      : 'Changing the location resets the selected package, space, date, and time.'}
                  </p>
                  {isCustom && customFieldError('location')}
                  {isCustom && customAddOnsNotice && (
                    <div className="rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
                      {customAddOnsNotice}
                    </div>
                  )}

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

            {isCustom ? customPackageSection : (
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
                      {pkg.name} - ${Number(pkg.price).toFixed(2)}{pkg.available_online === false ? ' · Hidden from booking site' : ''}
                    </option>
                  ))}
                </select>
                {packageDetails && (
                  <div className={`bg-${themeColor}-50 border border-${themeColor}-100 rounded-lg p-3`}>
                    <p className="text-sm text-gray-700">
                      <span className="font-medium">Selected:</span> {packageDetails.name} • ${Number(packageDetails.price).toFixed(2)}
                      {packageDetails.available_online === false && (
                        <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium amber-tone bg-amber-100 text-amber-800">
                          Hidden from booking site
                        </span>
                      )}
                    </p>
                  </div>
                )}
              </div>
            </div>
            )}

            <div>
              <h3 className={`text-xl font-bold mb-4 text-neutral-900 flex items-center gap-2`}>
                <Home className={`w-5 h-5 text-${themeColor}-600`} /> Space Assignment{isCustom ? ' *' : ''}
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
              {isCustom && customFieldError('room')}
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
                    <EmailInput
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
              <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-4">
                {originalBooking && <InternalNotesLog bookingId={Number(originalBooking.id)} />}
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
                        setBlockedTimeSlots([]);
                      }}
                      dayOffs={dayOffs}
                      dayOffsWithTime={filteredDayOffsWithTime}
                      allowBlockedDates
                      dealDates={dealDates}
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
                  {isCustom ? (
                    <input
                      type="time"
                      name="time"
                      required
                      value={formData.time ? formData.time.slice(0, 5) : ''}
                      onChange={handleInputChange}
                      className={`w-full rounded-md border border-gray-200 px-4 py-2 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 bg-white text-neutral-900 text-base transition-all`}
                    />
                  ) : !formData.date ? (
                    <p className="text-sm text-gray-400 py-2">Select a date first to see available times.</p>
                  ) : loadingTimeSlots ? (
                    <div className="flex items-center justify-center p-4">
                      <div className={`animate-spin rounded-full h-6 w-6 border-b-2 border-${fullColor}`}></div>
                      <span className="ml-2 text-sm text-gray-600">Loading available times...</span>
                    </div>
                  ) : displayedTimeSlots.length > 0 ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {displayedTimeSlots.map((slot) => (
                        <label
                          key={slot.start_time}
                          title={slot.blocked ? 'Inside a blocked period — guests cannot book this time online' : undefined}
                          className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition ${
                            formData.time === slot.start_time
                              ? slot.blocked
                                ? 'border-red-500 bg-red-50'
                                : `border-${themeColor}-600 bg-${themeColor}-50`
                              : slot.blocked
                                ? 'border-dashed border-red-200 bg-red-50/40 hover:border-red-300'
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
                          {slot.blocked && (
                            <span className="ml-auto text-[11px] font-semibold px-1.5 py-0.5 rounded-full bg-red-100 text-red-800">Blocked</span>
                          )}
                        </label>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400 py-2">No available times for the selected date.</p>
                  )}
                  {isCustom ? (
                    customEndText && <p className="text-xs text-gray-500 mt-2">{customEndText}</p>
                  ) : formData.time && (
                    <p className="text-xs text-gray-500 mt-2">
                      Selected: <span className="font-medium text-gray-700">{formatTimeTo12Hour(formData.time)}</span>
                    </p>
                  )}
                  {selectedSlotIsBlocked && (
                    <p className="text-xs text-red-700 mt-1">
                      This time is inside a blocked period. Guests cannot book it online; if you move the booking here you will be asked to confirm when you save.
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
                      min={dateMinParticipants}
                      max={packageDetails?.max_participants || undefined}
                      required
                      value={formData.participants}
                      onChange={handleInputChange}
                      onBlur={isCustom ? undefined : () => setFormData(prev => ({
                        ...prev,
                        participants: Math.min(packageDetails?.max_participants || Number.MAX_SAFE_INTEGER, Math.max(dateMinParticipants, prev.participants)),
                      }))}
                      aria-invalid={isCustom ? !!customErrors.participants : undefined}
                      className={`w-full rounded-md border border-gray-200 px-4 py-2 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 bg-white text-neutral-900 text-base transition-all`}
                    />
                    {isCustom && customInput && (
                      <p className="text-xs text-gray-500 mt-1">{participantsHint(customInput.minGuests, customInput.maxGuests)}</p>
                    )}
                    {isCustom && customFieldError('participants')}
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
                    {formData.status === 'completed' && originalBooking?.status !== 'completed' && (
                      <p className="text-xs text-gray-500 mt-1">
                        Saving as Completed emails the guest the Thanks for Playing email now and a review request later, instead of a
                        booking update email. Escape-room bookings send it from the game screen instead, and visits more than 3 days
                        old are not emailed automatically.
                      </p>
                    )}
                  </div>
                </div>

              </div>
            </div>

            {(isCustom || availableAddOns.length > 0) && (
              <div>
                <h3 className={`text-xl font-bold mb-4 text-neutral-900 flex items-center gap-2`}>
                  <Gift className={`w-5 h-5 text-${themeColor}-600`} /> Add-ons
                </h3>
                <p className="text-sm text-gray-500 mb-4">Add or adjust extras for this booking. Changing add-ons updates the total.</p>
                {isCustom && customOneTimeAddOnsPanel}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {availableAddOns.map((addOn: any) => {
                    const quantity = selectedAddOns[addOn.id] || 0;
                    const isSelected = quantity > 0;
                    const maxQty = addOn.max_quantity ?? 99;
                    const isForced = isForceAddOn(addOn, formData.packageId);
                    const minQty = isForced ? Math.max(1, getAddOnMinQuantity(addOn, formData.packageId)) : getAddOnMinQuantity(addOn, formData.packageId);
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
                          {(isForced || minQty > 1) && (
                            <p className={`text-[10px] mb-1 ${isForced ? 'text-amber-700' : 'text-gray-400'}`}>{isForced ? `Required · min ${minQty}` : `Min ${minQty}`}</p>
                          )}
                          <div className="flex items-center gap-1">
                            <StandardButton
                              type="button"
                              variant="secondary"
                              size="sm"
                              icon={Minus}
                              onClick={() => handleAddOnChange(addOn.id, -1)}
                              disabled={isForced ? quantity <= minQty : !isSelected}
                            >
                              {''}
                            </StandardButton>
                            <input
                              type="number"
                              min={isForced ? minQty : 0}
                              max={maxQty}
                              value={quantity}
                              onChange={(e) => {
                                if (isCustom) {
                                  setCustomAddOnQuantity(addOn.id, parseInt(e.target.value) || 0, maxQty);
                                  return;
                                }
                                const newQty = clampAddOnQuantity(addOn, formData.packageId, quantity, parseInt(e.target.value) || 0);
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
                          {isCustom && customFieldError(catalogErrorKey(addOn.id))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {showGuestOfHonor && (
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
              <h3 className={`text-xl font-bold mb-4 text-neutral-900`}>Email Notification</h3>
              <div className="flex items-center justify-between bg-white border border-gray-200 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  {formData.sendNotification ? (
                    <Bell size={18} className="text-green-600" />
                  ) : (
                    <BellOff size={18} className="text-gray-400" />
                  )}
                  <span className="text-sm text-gray-700">
                    {formData.status === 'completed' && originalBooking?.status !== 'completed'
                      ? 'No update email: completing sends the Thanks for Playing email instead'
                      : formData.sendNotification ? 'Customer will receive update' : 'Silent update (no email)'}
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
                disabled={submitting || quoteLoading || quoteError !== null || (isCustom && (!customInput || customTermsUnavailable))}
                loading={submitting}
              >
                {submitting ? 'Saving...' : quoteLoading ? 'Pricing...' : 'Save Changes'}
              </StandardButton>
            </div>
          </form>

          {originalBooking?.id && (
            <div className="mt-8 border-t border-gray-200 pt-6">
              <BookingChangeHistory
                bookingId={Number(originalBooking.id)}
                themeColor={themeColor}
                fullColor={fullColor}
              />
            </div>
          )}
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

            {isCustom && customSummaryBlock}

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
              {isCustom && customEndText && <p className="text-sm text-gray-600">{customEndText}</p>}
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

            {isCustom ? customPaymentSummary : (
            <div>
              <p className="text-sm text-gray-500 mb-3">Applied Fees</p>
              <div className="space-y-2 mb-4">
                {(quote ? quote.fees : appliedFees).length === 0 && (
                  <p className="text-xs text-gray-400">No fees configured for this package.</p>
                )}
                {(quote ? quote.fees : appliedFees).map((fee, index) => (
                  <div key={`${fee.fee_name}-${index}`} className="flex items-center justify-between rounded border border-gray-200 bg-gray-50 px-3 py-2">
                    <span className="text-sm text-gray-700">
                      {fee.fee_name}
                      {(fee as { fee_label?: string }).fee_label ? (
                        <span className="ml-1 text-xs text-gray-400">({(fee as { fee_label?: string }).fee_label})</span>
                      ) : null}
                      <span className="ml-1 text-xs text-gray-400">{fee.fee_application_type}</span>
                    </span>
                    <span className="text-sm font-medium text-gray-900">${Number(fee.fee_amount).toFixed(2)}</span>
                  </div>
                ))}
                <p className="text-xs text-gray-400">
                  Fees come from this location's fee settings and recalculate with the participant count.
                </p>
              </div>

              <p className="text-sm text-gray-500 mb-3">Payment Breakdown</p>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">
                    Package
                    {packageDetails?.pricing_type === 'per_person' ? (
                      <span className="text-xs text-gray-400 ml-1">
                        ({formData.participants} × ${Number(packageDetails.price).toFixed(2)} per {participantLabelFor(packageDetails.participant_label)})
                      </span>
                    ) : packageDetails?.min_participants && packageDetails.min_participants > 1 ? (
                      <span className="text-xs text-gray-400 ml-1">(up to {packageDetails.min_participants} people)</span>
                    ) : null}
                  </span>
                  <span className="font-medium text-gray-900">
                    ${(packageDetails?.pricing_type === 'per_person'
                      ? packagePriceForParticipants({
                          pricingType: 'per_person',
                          price: packageDetails?.price ?? 0,
                          participants: formData.participants,
                        })
                      : Number(packageDetails?.price ?? 0)
                    ).toFixed(2)}
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
                  const isPerPlayer = packageDetails?.pricing_type === 'per_person';
                  const minParticipants = packageDetails?.min_participants || 1;
                  const pricePerAdditional = Number(packageDetails?.price_per_additional || 0);
                  const additionalCount = Math.max(0, formData.participants - minParticipants);
                  const additionalParticipantCost = isPerPlayer ? 0 : additionalCount * pricePerAdditional;

                  const storedTotal = Number(originalBooking?.total_amount || 0);
                  const total = quote ? quote.total_amount : storedTotal;
                  const paid = quote ? quote.amount_paid : originalAmountPaid;
                  const discount = quote ? quote.discount_amount : Number(originalBooking?.discount_amount || 0);
                  const totalChanged = quote ? Math.abs(quote.total_amount - storedTotal) > 0.005 : false;

                  const paymentState = resolvePaymentState({
                    payment_status: quote ? quote.payment_status : originalBooking?.payment_status,
                    amount_paid: paid,
                    total_amount: total,
                  });

                  return (
                    <>
                      {quoteError && (
                        <div className="rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700">
                          {quoteError}
                        </div>
                      )}

                      {quote && quote.pricing_consistent === false && (
                        <div className="rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
                          This booking's stored total predates the current pricing rules. Only the change you make
                          here is applied to it, so the original agreed price is preserved.
                        </div>
                      )}

                      {!isPerPlayer && additionalCount > 0 && pricePerAdditional > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">
                            +{additionalCount} extra participant{additionalCount > 1 ? 's' : ''} &times; ${pricePerAdditional.toFixed(2)}
                          </span>
                          <span className="text-gray-900">${additionalParticipantCost.toFixed(2)}</span>
                        </div>
                      )}

                      {quote && quote.subtotal > 0 && (
                        <div className="flex justify-between pt-2 border-t border-gray-100">
                          <span className="text-sm text-gray-600">Subtotal</span>
                          <span className="font-medium text-gray-900">${quote.subtotal.toFixed(2)}</span>
                        </div>
                      )}

                      {quote && quote.fees.map((fee, index) => (
                        <div key={`${fee.fee_name}-${index}`} className="flex justify-between">
                          <span className="text-sm text-gray-600">
                            {fee.fee_name}
                            {fee.fee_label && <span className="ml-1 text-xs text-gray-400">({fee.fee_label})</span>}
                          </span>
                          <span className="font-medium text-gray-900">${Number(fee.fee_amount).toFixed(2)}</span>
                        </div>
                      ))}

                      {discount > 0 && (
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Discount</span>
                          <span className="font-medium text-green-600">-${discount.toFixed(2)}</span>
                        </div>
                      )}

                      <div className="flex justify-between pt-3 border-t border-gray-200">
                        <span className="text-sm font-semibold text-gray-900">Total Amount</span>
                        <span className="font-bold text-gray-900">
                          ${total.toFixed(2)}
                          {quoteLoading && <span className="ml-1 text-xs text-gray-400">(updating...)</span>}
                          {!quoteLoading && totalChanged && <span className="ml-1 text-xs text-orange-600">(Updated)</span>}
                        </span>
                      </div>

                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Amount Paid</span>
                        <span className="font-semibold text-green-600">${paid.toFixed(2)}</span>
                      </div>

                      <div className="flex justify-between pt-2 border-t border-gray-100">
                        <span className={`text-sm font-medium ${paymentState.isSettled ? 'text-green-700' : 'text-red-700'}`}>
                          {paymentState.balanceLabel}
                        </span>
                        <span className={`font-bold ${paymentState.amountClass}`}>
                          {paymentState.isSettled && paymentState.balance >= -0.005
                            ? paymentState.label
                            : `$${Math.abs(paymentState.balance).toFixed(2)}`}
                        </span>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
            )}
          </div>
        </div>
      </div>
    </div>

      <ChangeReasonModal
        open={showReasonPrompt}
        title="Why are you changing this booking?"
        summary={originalBooking ? `Booking ${originalBooking.reference_number}` : undefined}
        confirmLabel="Save booking"
        submitting={submitting}
        onCancel={() => setShowReasonPrompt(false)}
        onConfirm={performSubmit}
        themeColor={themeColor}
        fullColor={fullColor}
      />

      {overrideGate && (
        <OverlapOverrideDialog
          conflicts={overrideGate.conflicts}
          onlineSlotsLost={[]}
          locationId={formData.locationId || originalBooking?.location_id || null}
          onCancel={() => setOverrideGate(null)}
          onConfirm={() => setOverrideGate(null)}
          onApproved={(token, approvedBy) => {
            overrideTokenRef.current = token;
            const reason = overrideGate.reason;
            setOverrideGate(null);
            console.log(`${approvedBy} approved moving this booking.`);
            // the gate is satisfied; run the same save again, reason and all
            void performSubmit(reason);
          }}
        />
      )}
    </>
  );
};

export default EditBooking;
