import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import type { ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import {
  MapPin,
  Calendar,
  Users,
  Clock,
  Zap,
  Ticket,
  Package,
  Search,
  ChevronRight,
  X,
  CheckCircle,
  DollarSign,
  Sparkles,
  Phone,
  ShoppingCart
} from 'lucide-react';
import type { Attraction, Package as PackageType, BookingType } from '../../types/customer';
import { type GroupedAttraction, type GroupedPackage, type GroupedEvent } from '../../services/CustomerService';
import { customerDataCacheService } from '../../services/CustomerDataCacheService';
import { ASSET_URL } from '../../utils/storage';
import { generateSlug, generateLocationSlug } from '../../utils/slug';
import { convertTo12Hour, formatDurationDisplay, getUpcomingAttractionSessions, getUpcomingPackageSessions } from '../../utils/timeFormat';
import { useStorefrontLocations } from '../../hooks/useStorefrontLocations';
import { useCart } from '../../contexts/CartContext';
import LocationConfirmModal from '../../components/customer/LocationConfirmModal';
import { findLocationBySlug } from '../../services/StorefrontLocationService';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import SiteFooter from '../../components/customer/SiteFooter';
import NotFound from '../NotFound';
// import MembershipCarousel from '../../components/customer/MembershipCarousel';


interface LocationRef {
  id?: number;
  name: string;
}

interface DisplayEventLocation {
  location_id: number;
  location_name: string;
  location_slug: string;
  event_id: number;
  address: string;
  city: string;
  state: string;
  phone: string;
}

interface DisplayEvent {
  id: number;
  name: string;
  description: string | null;
  image: string | null;
  date_type: 'one_time' | 'date_range';
  start_date: string;
  end_date: string | null;
  time_start: string;
  time_end: string;
  interval_minutes: number;
  max_bookings_per_slot: number | null;
  price: string;
  features: string[] | null;
  availableLocations: string[];
  locations: DisplayEventLocation[];
  purchaseLinks: Array<{ location: string; url: string; event_id: number; location_id: number }>;
}

type StorefrontFilter =
  | { kind: 'all' }
  | { kind: 'category'; key: string };

interface FilterChip {
  key: string;
  label: string;
  value: StorefrontFilter;
  icon?: ReactNode;
  isCategory?: boolean;
}

const CART_ENABLED = true;

const categoryKeyOf = (value?: string | null) =>
  (value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const EVENTS_CATEGORY_LABEL = 'Events';

// A package shown as "Escape Room" belongs under that name, not under its
// internal category, so the storefront filters read the way guests think.
const categoryLabelOfPackage = (pkg: { display_label?: string | null; category?: string | null }) =>
  (pkg.display_label || pkg.category || '').trim();

const EntertainmentLandingPage = () => {
  const { locationSlug } = useParams<{ locationSlug?: string }>();
  const { locations: storefrontLocations, loaded: storefrontLoaded } = useStorefrontLocations();
  const activeLocation = useMemo(
    () => findLocationBySlug(storefrontLocations, locationSlug),
    [storefrontLocations, locationSlug],
  );
  const isSingleLocationPage = Boolean(locationSlug);

  const [selectedLocation, setSelectedLocation] = useState('All Locations');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<StorefrontFilter>(() => {
    const fromUrl = new URLSearchParams(window.location.search).get('category');
    const key = categoryKeyOf(fromUrl);
    return key ? { kind: 'category', key } : { kind: 'all' };
  });
  const [cartNotice, setCartNotice] = useState<{ key: string; message: string } | null>(null);
  const { addItem: addToCart } = useCart();
  const selectFilter = useCallback((next: StorefrontFilter) => {
    setActiveFilter(next);
    const params = new URLSearchParams(window.location.search);
    if (next.kind === 'category') {
      params.set('category', next.key);
    } else {
      params.delete('category');
    }
    const query = params.toString();
    window.history.replaceState(null, '', `${window.location.pathname}${query ? `?${query}` : ''}`);
  }, []);
  const chipRailRef = useRef<HTMLDivElement | null>(null);
  const [chipsOverflowRight, setChipsOverflowRight] = useState(false);

  // Categories run off the edge on a phone, and a row that simply gets clipped looks
  // like the whole list. A fading edge with an arrow says "there is more, keep sliding".
  const measureChipRail = useCallback(() => {
    const rail = chipRailRef.current;
    if (!rail) return;
    setChipsOverflowRight(rail.scrollWidth - rail.clientWidth - rail.scrollLeft > 8);
  }, []);

  const scrollToResults = useCallback(() => {
    requestAnimationFrame(() => {
      const content = document.querySelector('.zz-results');
      if (content) {
        window.scrollTo({ top: Math.max(0, content.getBoundingClientRect().top + window.scrollY - 90), behavior: 'smooth' });
      }
    });
  }, []);
  const [selectedAttraction, setSelectedAttraction] = useState<Attraction | null>(null);
  const [selectedPackage, setSelectedPackage] = useState<PackageType | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<DisplayEvent | null>(null);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [showAttractionModal, setShowAttractionModal] = useState(false);
  const [showPackageModal, setShowPackageModal] = useState(false);
  const [showEventModal, setShowEventModal] = useState(false);
  const [activeBookingType, setActiveBookingType] = useState<BookingType | null>(null);
  
  const [attractions, setAttractions] = useState<Attraction[]>([]);
  const [packages, setPackages] = useState<PackageType[]>([]);
  const [events, setEvents] = useState<DisplayEvent[]>([]);
  const [locations, setLocations] = useState<string[]>(['All Locations']);
  const [dataLoading, setDataLoading] = useState(true);

  const processData = useCallback((
    attractionsData: GroupedAttraction[],
    packagesData: GroupedPackage[],
    eventsData: GroupedEvent[],
  ) => {
    const allLocations = new Set<string>();

    const transformedAttractions: Attraction[] = attractionsData.map((attr: GroupedAttraction) => {
      attr.locations.forEach(loc => allLocations.add(loc.location_name));
      return {
        id: attr.purchase_links[0]?.attraction_id || 0,
        name: attr.name,
        description: attr.description,
        price: attr.price,
        minAge: attr.min_age,
        capacity: attr.max_capacity,
        displayCapacityToCustomers: attr.display_capacity_to_customers ?? true,
        rating: attr.rating || 4.5,
        image: Array.isArray(attr.image) ? attr.image[0] : attr.image,
        category: attr.category,
        availableLocations: attr.locations.map(loc => loc.location_name),
        availableLocationIds: attr.locations.map(loc => loc.location_id),
        duration: !attr.duration || attr.duration === 0 || String(attr.duration) === '0' ? 'Unlimited' : formatDurationDisplay(attr.duration, attr.duration_unit),
        pricingType: attr.pricing_type,
        purchaseLinks: attr.purchase_links,
        availability: attr.availability,
        special_pricing: attr.special_pricing,
      };
    });
    setAttractions(transformedAttractions);

    packagesData.forEach((pkg: GroupedPackage) => {
      pkg.locations.forEach(loc => allLocations.add(loc.location_name));
    });
    const transformedPackages: PackageType[] = packagesData.map((pkg: GroupedPackage) => {
      const minGuests = pkg.min_participants || 1;
      const maxGuests = pkg.max_guests || minGuests;
      const unit = (pkg.participant_label || 'guest').toLowerCase();
      const participantsText = pkg.pricing_type === 'per_person'
        ? (maxGuests > minGuests ? `${minGuests}–${maxGuests} ${unit}s` : `${minGuests} ${unit}s`)
        : (maxGuests > minGuests
          ? `Starts at ${minGuests} ${unit}s (up to ${maxGuests})`
          : `${minGuests} ${unit}s`);
      return {
        id: pkg.booking_links[0]?.package_id || 0,
        name: pkg.name,
        description: pkg.description,
        price: pkg.price,
        duration: !pkg.duration || pkg.duration === 0 || String(pkg.duration) === '0' ? 'Unlimited' : formatDurationDisplay(pkg.duration, pkg.duration_unit),
        participants: participantsText,
        includes: [],
        rating: 4.8,
        image: Array.isArray(pkg.image) ? pkg.image[0] : pkg.image,
        category: pkg.category,
        availableLocations: pkg.locations.map(loc => loc.location_name),
        availableLocationIds: pkg.locations.map(loc => loc.location_id),
        bookingLinks: pkg.booking_links,
        availability_schedules: pkg.availability_schedules,
        package_type: pkg.package_type || 'regular',
        min_participants: pkg.min_participants,
        max_guests: pkg.max_guests,
        price_per_additional: pkg.price_per_additional,
        pricing_type: pkg.pricing_type || 'base',
        participant_label: pkg.participant_label,
        display_label: pkg.display_label,
        special_pricing: pkg.special_pricing,
      };
    });
    setPackages(transformedPackages);

    eventsData.forEach((evt: GroupedEvent) => {
      evt.locations.forEach(loc => allLocations.add(loc.location_name));
    });
    const transformedEvents: DisplayEvent[] = eventsData
      .filter((evt: GroupedEvent) => {
        const endDate = (evt.end_date || evt.start_date).substring(0, 10);
        return new Date(endDate + 'T23:59:59') >= new Date();
      })
      .map((evt: GroupedEvent) => ({
        id: evt.purchase_links[0]?.event_id || 0,
        name: evt.name,
        description: evt.description,
        image: evt.image,
        date_type: evt.date_type,
        start_date: evt.start_date,
        end_date: evt.end_date,
        time_start: evt.time_start,
        time_end: evt.time_end,
        interval_minutes: evt.interval_minutes,
        max_bookings_per_slot: evt.max_bookings_per_slot,
        price: evt.price,
        features: evt.features,
        availableLocations: evt.locations.map(loc => loc.location_name),
        locations: evt.locations.map(loc => ({
          location_id: loc.location_id,
          location_name: loc.location_name,
          location_slug: loc.location_slug,
          event_id: loc.event_id,
          address: loc.address,
          city: loc.city,
          state: loc.state,
          phone: loc.phone,
        })),
        purchaseLinks: evt.purchase_links,
      }));
    setEvents(transformedEvents);

    setLocations(['All Locations', ...Array.from(allLocations).sort()]);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadData = async () => {
      try {
        const cached = await customerDataCacheService.getCachedAll();
        if (cached && !cancelled && (cached.attractions.length > 0 || cached.packages.length > 0 || cached.events.length > 0)) {
          processData(cached.attractions, cached.packages, cached.events);
          setDataLoading(false);
        }

        const fresh = await customerDataCacheService.getWithBackgroundSync();
        if (!cancelled) {
          processData(fresh.attractions, fresh.packages, fresh.events);
          setDataLoading(false);
        }
      } catch (error) {
        console.error('Error loading data:', error);
        if (!cancelled) setDataLoading(false);
      }
    };

    loadData();
    return () => { cancelled = true; };
  }, [processData]);

  useEffect(() => {
    measureChipRail();
    window.addEventListener('resize', measureChipRail);
    return () => window.removeEventListener('resize', measureChipRail);
  }, [measureChipRail, dataLoading, packages.length, attractions.length, events.length, activeFilter]);

  useEffect(() => {
    // A shared link like /brighton?category=escape-room must survive the switch,
    // so only clear the filter when the URL itself carries none.
    const fromUrl = categoryKeyOf(new URLSearchParams(window.location.search).get('category'));
    setActiveFilter(fromUrl ? { kind: 'category', key: fromUrl } : { kind: 'all' });
    setSearchQuery('');
  }, [locationSlug]);

  useEffect(() => {
    const unsubscribe = customerDataCacheService.onCacheUpdate((event: CustomEvent) => {
      if (event.detail?.source === 'api' && event.detail?.data) {
        const { attractions: a, packages: p, events: e } = event.detail.data;
        processData(a, p, e);
      }
    });
    return () => unsubscribe();
  }, [processData]);
  const matchesLocationScope = useCallback(
    (locationIds: number[] | undefined, locationNames: string[]) => {
      if (activeLocation) {
        return (locationIds ?? []).includes(activeLocation.id);
      }
      return selectedLocation === 'All Locations' || locationNames.includes(selectedLocation);
    },
    [activeLocation, selectedLocation],
  );

  const matchesSearch = useCallback(
    (name: string, description?: string | null) => {
      const query = searchQuery.trim().toLowerCase();
      if (!query) return true;
      return name.toLowerCase().includes(query) || (description || '').toLowerCase().includes(query);
    },
    [searchQuery],
  );

  const locationAttractions = attractions.filter(attraction =>
    matchesLocationScope(attraction.availableLocationIds, attraction.availableLocations),
  );
  const locationPackages = packages.filter(pkg =>
    matchesLocationScope(pkg.availableLocationIds, pkg.availableLocations),
  );

  const filteredAttractions = locationAttractions.filter(attraction =>
    matchesSearch(attraction.name, attraction.description),
  );
  const filteredPackages = locationPackages.filter(pkg => matchesSearch(pkg.name, pkg.description));
  const filteredSpecialPackages = filteredPackages.filter(
    pkg => pkg.package_type && pkg.package_type !== 'regular',
  );
  const filteredEvents = events.filter(
    evt =>
      matchesLocationScope(evt.locations.map(loc => loc.location_id), evt.availableLocations) &&
      matchesSearch(evt.name, evt.description),
  );

  const categoryChips = (() => {
    const byKey = new Map<string, string>();
    const add = (label: string) => {
      const key = categoryKeyOf(label);
      if (!key || byKey.has(key)) return;
      byKey.set(key, label.trim());
    };
    locationPackages.forEach(pkg => add(categoryLabelOfPackage(pkg)));
    locationAttractions.forEach(attraction => add(attraction.category ?? ''));
    if (filteredEvents.length > 0) add(EVENTS_CATEGORY_LABEL);
    return Array.from(byKey, ([key, label]) => ({ key, label })).sort((a, b) =>
      a.label.localeCompare(b.label),
    );
  })();

  const reconciledFilter: StorefrontFilter =
    activeFilter.kind === 'category' && !categoryChips.some(chip => chip.key === activeFilter.key)
      ? { kind: 'all' }
      : activeFilter;

  const effectiveFilter: StorefrontFilter = reconciledFilter;

  const activeCategoryKey = effectiveFilter.kind === 'category' ? effectiveFilter.key : null;
  const isEventsCategory = activeCategoryKey === categoryKeyOf(EVENTS_CATEGORY_LABEL);

  const shownPackages = activeCategoryKey === null
    ? filteredPackages
    : filteredPackages.filter(pkg => categoryKeyOf(categoryLabelOfPackage(pkg)) === activeCategoryKey);
  const packageSections = (() => {
    const groups = new Map<string, typeof shownPackages>();
    shownPackages.forEach(p => {
      const k = (p.display_label || '').trim();
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k)!.push(p);
    });
    if (groups.size === 0) groups.set('', []);
    return [...groups.entries()]
      .map(([label, items]) => ({ label, items }))
      .sort((x, y) => (x.label === '' ? -1 : y.label === '' ? 1 : x.label.localeCompare(y.label)));
  })();
  const shownAttractions = activeCategoryKey === null
    ? filteredAttractions
    : (isEventsCategory ? [] : filteredAttractions.filter(a => categoryKeyOf(a.category) === activeCategoryKey));
  const shownSpecialPackages = activeCategoryKey === null
    ? filteredSpecialPackages
    : filteredSpecialPackages.filter(pkg => categoryKeyOf(categoryLabelOfPackage(pkg)) === activeCategoryKey);
  const shownEvents = activeCategoryKey === null || isEventsCategory ? filteredEvents : [];

  const showSpecialsSection = shownSpecialPackages.length > 0;
  const showPackagesSection = shownPackages.length > 0;
  const showAttractionsSection = shownAttractions.length > 0;
  const showEventsSection = shownEvents.length > 0;

  const activeChipKey = effectiveFilter.kind === 'category' ? `cat:${effectiveFilter.key}` : 'all';

  const filterChips: FilterChip[] = [
    { key: 'all', label: 'All', value: { kind: 'all' } },
    ...categoryChips.map(chip => ({
      key: `cat:${chip.key}`,
      label: chip.label,
      value: { kind: 'category', key: chip.key } as StorefrontFilter,
      isCategory: true,
    })),
  ];

  const flashCartNotice = (key: string, message: string) => {
    setCartNotice({ key, message });
    window.setTimeout(() => {
      setCartNotice(current => (current?.key === key ? null : current));
    }, 3200);
  };

  const handleAddAttractionToCart = (attraction: Attraction) => {
    const key = `attraction-${attraction.id}`;
    if (!activeLocation) {
      flashCartNotice(key, 'Choose a location first.');
      return;
    }
    const link = attraction.purchaseLinks?.find(l => l.location_id === activeLocation.id);
    if (!link) {
      flashCartNotice(key, 'Not available at this location.');
      return;
    }
    const special = attraction.special_pricing;
    const price = special?.has_special_pricing ? Number(special.discounted_price) : Number(attraction.price);
    const result = addToCart({
      type: 'attraction',
      id: link.attraction_id,
      name: attraction.name,
      image: attraction.image ?? null,
      locationId: activeLocation.id,
      locationName: activeLocation.name,
      unitPrice: Number.isFinite(price) ? price : 0,
      quantity: 1,
    });
    flashCartNotice(key, result.ok ? 'Added to your cart.' : result.message ?? 'Could not add that.');
  };

  const handleAddEventToCart = (evt: DisplayEvent) => {
    const key = `event-${evt.name}-${evt.start_date}`;
    if (!activeLocation) {
      flashCartNotice(key, 'Choose a location first.');
      return;
    }
    const match = evt.locations.find(loc => loc.location_id === activeLocation.id);
    const price = Number(parseFloat(evt.price));
    const result = addToCart({
      type: 'event',
      id: match?.event_id ?? evt.id,
      name: evt.name,
      image: evt.image ?? null,
      locationId: activeLocation.id,
      locationName: activeLocation.name,
      unitPrice: Number.isFinite(price) ? price : 0,
      quantity: 1,
      scheduledDate: evt.start_date,
    });
    flashCartNotice(key, result.ok ? 'Added to your cart.' : result.message ?? 'Could not add that.');
  };

  const upgradeSuggestion = useMemo(() => {
    if (!selectedPackage) return null;
    
    const candidates = packages.filter(pkg => {
      if (pkg.id === selectedPackage.id) return false;
      if (pkg.price <= selectedPackage.price) return false;
      if (activeLocation) {
        return (pkg.availableLocationIds ?? []).includes(activeLocation.id);
      }
      const sharedLocs = pkg.availableLocations.filter(loc =>
        selectedPackage.availableLocations.includes(loc)
      );
      return sharedLocs.length > 0;
    });
    
    if (candidates.length === 0) return null;
    
    candidates.sort((a, b) => a.price - b.price);
    const upgrade = candidates[0];
    
    const highlights: string[] = [];
    const priceDiff = upgrade.price - selectedPackage.price;
    
    if (upgrade.duration !== selectedPackage.duration) {
      highlights.push(`${upgrade.duration} duration`);
    }
    
    if (upgrade.max_guests && selectedPackage.max_guests && upgrade.max_guests > selectedPackage.max_guests) {
      highlights.push(`Up to ${upgrade.max_guests} guests`);
    } else if (upgrade.participants !== selectedPackage.participants) {
      highlights.push(upgrade.participants);
    }
    
    highlights.push(`Only $${priceDiff.toFixed(0)} more`);
    
    return { package: upgrade, highlights, priceDiff };
  }, [selectedPackage, packages, activeLocation]);

  const handleAttractionClick = (attraction: Attraction) => {
    setSelectedAttraction(attraction);
    setShowAttractionModal(true);
  };

  const getImageUrl = (img?: string | null) => {
    if (!img) return '';
    if (img.startsWith('http://') || img.startsWith('https://') || img.startsWith('data:')) {
      return img;
    }
    if (img.startsWith(ASSET_URL)) {
      return img;
    }
    return ASSET_URL + img;
  };

  const handlePackageClick = (pkg: PackageType) => {
    setSelectedPackage(pkg);
    setShowPackageModal(true);
  };

  const slugForLocation = (locationId: number | undefined, locationName: string): string => {
    const match = locationId === undefined
      ? undefined
      : storefrontLocations.find(loc => loc.id === locationId);
    return match?.slug ?? generateLocationSlug(locationName);
  };

  const attractionUrlFor = (attraction: Attraction, target: LocationRef): string | null => {
    const link = attraction.purchaseLinks?.find(l =>
      target.id === undefined ? l.location === target.name : l.location_id === target.id);
    if (!link) return null;
    const itemSlug = generateSlug(attraction.name, link.attraction_id);
    return `${window.location.origin}/purchase/attraction/${slugForLocation(link.location_id, link.location)}/${itemSlug}`;
  };

  const packageUrlFor = (pkg: PackageType, target: LocationRef): string | null => {
    const link = pkg.bookingLinks?.find(l =>
      target.id === undefined ? l.location === target.name : l.location_id === target.id);
    if (!link) return null;
    const itemSlug = generateSlug(pkg.name, link.package_id);
    return `${window.location.origin}/book/package/${slugForLocation(link.location_id, link.location)}/${itemSlug}`;
  };

  const eventUrlFor = (evt: DisplayEvent, target: LocationRef): string | null => {
    const locData = evt.locations.find(loc =>
      target.id === undefined ? loc.location_name === target.name : loc.location_id === target.id);
    if (!locData) return null;
    const locationSlug = storefrontLocations.find(loc => loc.id === locData.location_id)?.slug
      ?? (locData.location_slug || generateLocationSlug(locData.location_name)).toLowerCase();
    const eventSlug = generateSlug(evt.name, locData.event_id);
    return `${window.location.origin}/purchase/event/${locationSlug}/${eventSlug}`;
  };

  const handleBuyTickets = (attraction: Attraction) => {
    if (activeLocation) {
      const url = attractionUrlFor(attraction, activeLocation);
      if (!url) return;
      setShowAttractionModal(false);
      window.open(url, '_blank');
      return;
    }
    setSelectedAttraction(attraction);
    setActiveBookingType('attraction');
    setShowAttractionModal(false);
    setShowLocationModal(true);
  };

  const handleBookPackage = (pkg: PackageType) => {
    if (activeLocation) {
      const url = packageUrlFor(pkg, activeLocation);
      if (!url) return;
      setShowPackageModal(false);
      window.open(url, '_blank');
      return;
    }
    setSelectedPackage(pkg);
    setActiveBookingType('package');
    setShowPackageModal(false);
    setShowLocationModal(true);
  };

  const handleEventClick = (evt: DisplayEvent) => {
    setSelectedEvent(evt);
    setShowEventModal(true);
  };

  const handleBuyEventTickets = (evt: DisplayEvent) => {
    if (activeLocation) {
      const url = eventUrlFor(evt, activeLocation);
      if (!url) return;
      setShowEventModal(false);
      window.open(url, '_blank');
      return;
    }
    setShowEventModal(false);
    setSelectedEvent(evt);
    setActiveBookingType('event');
    setShowLocationModal(true);
  };

  const handleLocationSelect = (location: string) => {
    const target: LocationRef = { name: location };

    const url = activeBookingType === 'event'
      ? (selectedEvent ? eventUrlFor(selectedEvent, target) : null)
      : activeBookingType === 'attraction'
      ? (selectedAttraction ? attractionUrlFor(selectedAttraction, target) : null)
      : activeBookingType === 'package'
      ? (selectedPackage ? packageUrlFor(selectedPackage, target) : null)
      : null;

    if (url) window.open(url, '_blank');
  };

  const formatTime = (time: string) => {
    if (!time) return '';
    return convertTo12Hour(time);
  };

  const formatDiscountLabel = (label: string) =>
    label.replace(/([\d.]+)(%)/g, (_, num, suffix) => parseFloat(num) + suffix);

  const easternTimeAbbr = (() => {
    const now = new Date();
    const abbr = now.toLocaleString('en-US', { timeZone: 'America/Detroit', timeZoneName: 'short' })
      .match(/(EST|EDT|ET)/)?.[1] ?? 'ET';
    return abbr;
  })();

  if (isSingleLocationPage && !activeLocation) {
    if (!storefrontLoaded) {
      return (
        <div className="min-h-[60vh] flex items-center justify-center">
          <LoadingSpinner size="medium" />
        </div>
      );
    }

    if (storefrontLocations.length === 0) {
      return (
        <div className="min-h-[60vh] flex flex-col items-center justify-center px-6 text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">We could not load our locations</h1>
          <p className="text-gray-600 mb-6 max-w-md">
            Something went wrong on our end, so we cannot tell which venue this page belongs to. Please try again.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="px-6 py-2.5 bg-blue-800 text-white font-semibold rounded-xl hover:bg-blue-900 transition-colors"
          >
            Try again
          </button>
        </div>
      );
    }

    return <NotFound />;
  }

  const locationAddress = activeLocation
    ? [activeLocation.address, activeLocation.city, activeLocation.state].filter(Boolean).join(', ')
    : '';

  return (
    <>
      <style>{`
        @keyframes backdrop-fade {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scale-in {
          from { 
            opacity: 0;
            transform: scale(0.95);
          }
          to { 
            opacity: 1;
            transform: scale(1);
          }
        }
        @keyframes slide-up {
          from { 
            opacity: 0;
            transform: translateY(12px);
          }
          to { 
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        .animate-backdrop-fade {
          animation: backdrop-fade 0.2s ease-out;
        }
        .animate-scale-in {
          animation: scale-in 0.3s ease-out;
        }
        .animate-slide-up {
          animation: slide-up 0.4s ease-out both;
        }
        .animate-slide-up-delay {
          animation: slide-up 0.4s ease-out 0.1s both;
        }
        
        .modal-scroll {
          scrollbar-width: none; /* Firefox */
          -ms-overflow-style: none; /* IE and Edge */
        }
        .modal-scroll::-webkit-scrollbar {
          display: none; /* Chrome, Safari, Opera */
        }
        
        .scroll-indicator::after {
          content: '';
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          height: 60px;
          background: linear-gradient(to top, rgba(255, 255, 255, 0.97) 0%, rgba(255, 255, 255, 0) 100%);
          pointer-events: none;
          opacity: 1;
          transition: opacity 0.2s ease;
        }
        
        .scroll-indicator::before {
          content: '';
          position: absolute;
          bottom: 16px;
          left: 50%;
          transform: translateX(-50%);
          width: 4px;
          height: 4px;
          background: rgba(0, 0, 0, 0.3);
          border-radius: 50%;
          pointer-events: none;
          z-index: 10;
          animation: pulse-scroll 2s ease-in-out infinite;
          box-shadow: 0 0 0 0 rgba(0, 0, 0, 0.2);
          transition: opacity 0.2s ease;
        }
        
        @keyframes pulse-scroll {
          0%, 100% {
            opacity: 0.4;
            transform: translateX(-50%) scale(1);
          }
          50% {
            opacity: 0.8;
            transform: translateX(-50%) scale(1.5);
          }
        }
        
        .scroll-indicator.scrolled-bottom::after,
        .scroll-indicator.scrolled-bottom::before {
          opacity: 0 !important;
          display: none;
        }
        
        .discount-overlay {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          background: linear-gradient(to top, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.45) 60%, transparent 100%);
          padding: 24px 10px 10px;
          display: flex;
          flex-wrap: wrap;
          gap: 5px;
          align-items: flex-end;
          pointer-events: none;
          z-index: 5;
        }
        .discount-pill {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          color: white;
          font-weight: 700;
          letter-spacing: 0.4px;
          text-transform: uppercase;
          border-radius: 999px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: calc(100% - 12px);
          flex-shrink: 1;
        }
        .discount-pill-primary {
          background: linear-gradient(135deg, #059669 0%, #10b981 100%);
          font-size: 12px;
          padding: 6px 14px;
          box-shadow: 0 2px 12px rgba(5, 150, 105, 0.55);
        }
        .discount-pill-secondary {
          background: rgba(13, 148, 136, 0.88);
          backdrop-filter: blur(6px);
          font-size: 11px;
          padding: 5px 12px;
          box-shadow: 0 1px 6px rgba(0,0,0,0.25);
        }
        .zz-chip-row {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .zz-chip-row::-webkit-scrollbar {
          display: none;
        }
        .discount-pill-more {
          display: inline-flex;
          align-items: center;
          background: rgba(255,255,255,0.18);
          backdrop-filter: blur(6px);
          border: 1px solid rgba(255,255,255,0.35);
          color: white;
          font-size: 11px;
          font-weight: 600;
          padding: 5px 11px;
          border-radius: 999px;
        }
      `}</style>
      {!isSingleLocationPage && (
      <section className="relative text-white py-16 md:py-28 lg:py-40 overflow-hidden pt-24 md:pt-28" style={{marginTop: '-4rem'}}>
        <div className="hidden md:block absolute inset-0 z-0">
          <div style={{ position: 'relative', paddingTop: '56.25%' }}>
            <iframe
              src="https://customer-bu7vnagrw6ivkw73.cloudflarestream.com/ced085083150e980c481a28d1eab6747/iframe?muted=true&loop=true&autoplay=true&poster=https%3A%2F%2Fcustomer-bu7vnagrw6ivkw73.cloudflarestream.com%2Fced085083150e980c481a28d1eab6747%2Fthumbnails%2Fthumbnail.jpg%3Ftime%3D%26height%3D600&controls=false"
              loading="lazy"
              style={{ border: 'none', position: 'absolute', top: 0, left: 0, height: '100%', width: '100%', objectFit: 'cover' }}
              allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
              allowFullScreen={true}
            />
          </div>
          <div className="absolute inset-0 bg-gradient-to-br from-blue-900/85 via-blue-800/75 to-blue-700/80"></div>
        </div>
        <div className="block md:hidden absolute inset-0 z-0 bg-gradient-to-br from-blue-900 via-blue-800 to-blue-700"></div>
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="mb-8 md:mb-10 animate-slide-up">
            <div className="inline-flex items-center space-x-2 bg-white/15 backdrop-blur-md px-4 py-2 md:px-5 md:py-2.5 rounded-full mb-5 md:mb-7 border border-white/20">
              {activeLocation ? (
                <>
                  <MapPin className="w-4 h-4 md:w-5 md:h-5 text-yellow-300" />
                  <span className="text-xs md:text-sm font-semibold tracking-wide">{locationAddress || activeLocation.name}</span>
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 md:w-5 md:h-5 text-yellow-300" />
                  <span className="text-xs md:text-sm font-semibold tracking-wide">Premium Entertainment Experience</span>
                </>
              )}
            </div>

            <p className="text-3xl sm:text-4xl md:text-5xl lg:text-7xl font-extrabold mb-5 md:mb-7 text-white leading-tight drop-shadow-3xl">
              {activeLocation ? `Unleash the Fun at ${activeLocation.name}!` : 'Unleash the Fun at ZapZone!'}
            </p>
            <p className="text-sm sm:text-base md:text-lg lg:text-xl mb-8 md:mb-12 text-blue-100/90 max-w-3xl mx-auto leading-relaxed px-2">
              {activeLocation
                ? `Everything you can book at ${activeLocation.name} — attractions, packages and events, all in one place.`
                : 'Discover thrilling attractions and amazing packages across all our locations. From laser tag adventures to unforgettable celebrations — your next adventure awaits!'}
            </p>
          </div>
          
          <div className="max-w-3xl mx-auto px-2 animate-slide-up-delay">
            <div className="relative group">
              <div className="absolute -inset-1.5 bg-gradient-to-r from-white/25 via-blue-300/25 to-blue-300/25 rounded-2xl blur-lg opacity-75 group-hover:opacity-100 transition duration-500"></div>
              <div className="relative">
                <Search className="absolute left-4 md:left-6 top-1/2 transform -translate-y-1/2 text-blue-800" size={20} />
                <input
                  type="text"
                  placeholder="Search attractions or packages..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 md:pl-16 pr-20 md:pr-28 py-4 md:py-5 text-sm md:text-lg text-gray-900 bg-white rounded-xl border-0 focus:outline-none focus:ring-4 focus:ring-white/30 shadow-2xl placeholder-gray-400"
                />
                <div className="absolute right-2.5 md:right-3 top-1/2 transform -translate-y-1/2">
                  <div className="bg-gradient-to-r from-blue-800 to-blue-700 text-white px-4 py-2 md:px-5 md:py-2.5 rounded-lg text-xs md:text-sm font-semibold shadow-md hover:shadow-lg transition">
                    Search
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center gap-6 md:gap-10 mt-10 md:mt-14 animate-slide-up-delay">
            {activeLocation ? (
              <>
                <div className="text-center">
                  <div className="text-2xl md:text-3xl font-bold text-white">{filteredPackages.length}</div>
                  <div className="text-xs md:text-sm text-blue-200/80">Packages</div>
                </div>
                <div className="w-px h-8 bg-white/20"></div>
                <div className="text-center">
                  <div className="text-2xl md:text-3xl font-bold text-white">{filteredAttractions.length}</div>
                  <div className="text-xs md:text-sm text-blue-200/80">Attractions</div>
                </div>
                <div className="w-px h-8 bg-white/20"></div>
                <div className="text-center">
                  <div className="text-2xl md:text-3xl font-bold text-white">{filteredEvents.length}</div>
                  <div className="text-xs md:text-sm text-blue-200/80">Events</div>
                </div>
              </>
            ) : (
              <>
                <div className="text-center">
                  <div className="text-2xl md:text-3xl font-bold text-white">10+</div>
                  <div className="text-xs md:text-sm text-blue-200/80">Locations</div>
                </div>
                <div className="w-px h-8 bg-white/20"></div>
                <div className="text-center">
                  <div className="text-2xl md:text-3xl font-bold text-white">{packages.length}+</div>
                  <div className="text-xs md:text-sm text-blue-200/80">Packages</div>
                </div>
                <div className="w-px h-8 bg-white/20"></div>
                <div className="text-center">
                  <div className="text-2xl md:text-3xl font-bold text-white">{attractions.length}+</div>
                  <div className="text-xs md:text-sm text-blue-200/80">Attractions</div>
                </div>
              </>
            )}
          </div>
        </div>
        
        <div className="absolute bottom-0 left-0 w-full h-40 bg-gradient-to-t from-gray-50 to-transparent"></div>
      </section>
      )}

      <section
        className="bg-white/95 backdrop-blur-sm py-4 md:py-5 border-b border-gray-100 sticky z-30 shadow-sm"
        style={{ top: isSingleLocationPage ? 'var(--zz-header-h, 80px)' : '4rem' }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {isSingleLocationPage ? (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 min-w-0">
                  <h1 className="inline-flex items-center gap-1.5 text-sm font-bold text-gray-900 min-w-0">
                    <MapPin size={14} className="text-blue-800 flex-shrink-0" />
                    <span className="truncate">{activeLocation?.name}</span>
                  </h1>
                  {locationAddress && (
                    <span className="text-xs text-gray-500 truncate">{locationAddress}</span>
                  )}
                  {activeLocation?.phone && (
                    <a
                      href={`tel:${activeLocation.phone}`}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-blue-800 transition-colors"
                    >
                      <Phone size={12} />
                      {activeLocation.phone}
                    </a>
                  )}
                </div>
                <div className="relative w-full sm:w-64 lg:w-72 flex-shrink-0">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={15} />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search this location..."
                    aria-label="Search attractions, packages and events at this location"
                    className="w-full pl-9 pr-3 py-2 text-sm text-gray-900 bg-gray-50 border border-gray-200 rounded-lg transition focus:outline-none focus:ring-2 focus:ring-blue-800/20 focus:border-blue-800 focus:bg-white placeholder-gray-400"
                  />
                </div>
              </div>

              <div className="zz-filter-bar flex items-center gap-2 min-w-0">
                <span className="hidden sm:inline text-xs font-semibold text-gray-400 uppercase tracking-wider flex-shrink-0">
                  Show:
                </span>
                <div className="relative min-w-0 flex-1">
                <div
                  ref={chipRailRef}
                  onScroll={measureChipRail}
                  className="flex items-center gap-1.5 overflow-x-auto zz-chip-row -mx-1 px-1 py-0.5"
                >
                  {filterChips.map(chip => {
                    const isActive = chip.key === activeChipKey;
                    return (
                      <button
                        key={chip.key}
                        type="button"
                        onClick={() => {
                          selectFilter(chip.value); scrollToResults();
                        }}
                        aria-pressed={isActive}
                        className={`px-3.5 py-1.5 text-xs font-semibold rounded-full whitespace-nowrap transition-colors inline-flex items-center gap-1.5 flex-shrink-0 ${chip.isCategory ? 'capitalize' : ''} ${
                          isActive ? 'bg-blue-800 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {chip.icon}
                        {chip.label}
                      </button>
                    );
                  })}
                </div>
                {chipsOverflowRight && (
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pl-6 pr-0.5 bg-gradient-to-l from-white via-white/90 to-transparent">
                    <ChevronRight size={16} className="text-blue-800 animate-pulse" />
                  </div>
                )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 text-gray-400">
                  <MapPin size={14} />
                  <span className="text-xs font-semibold uppercase tracking-wider">Location:</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {locations.map(location => (
                    <button
                      key={location}
                      onClick={() => setSelectedLocation(location)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all duration-200 ${
                        selectedLocation === location
                          ? 'bg-gray-900 text-white shadow-md'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {location === 'All Locations' ? 'All' : location}
                    </button>
                  ))}
                </div>
              </div>

              <div className="zz-filter-bar flex items-center gap-3">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Show:</span>
                <div className="flex flex-wrap items-center gap-1.5">
                  {filterChips.map(chip => (
                    <button
                      key={chip.key}
                      onClick={() => { selectFilter(chip.value); scrollToResults(); }}
                      aria-pressed={chip.key === activeChipKey}
                      className={`px-3.5 py-1.5 text-xs font-semibold rounded-full whitespace-nowrap transition-colors ${chip.isCategory ? 'capitalize' : ''} ${
                        chip.key === activeChipKey ? 'bg-blue-800 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {isSingleLocationPage && activeLocation && !dataLoading && (
        <LocationConfirmModal
          location={activeLocation}
          locations={storefrontLocations}
          counts={{
            packages: filteredPackages.length,
            attractions: filteredAttractions.length,
            events: filteredEvents.length,
          }}
        />
      )}

      <main className="zz-results max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-12">
        {showSpecialsSection && (
          <section className="mb-12 md:mb-20">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 md:mb-10 gap-2">
              <h2 className="text-xl md:text-3xl font-bold text-gray-900 flex items-center gap-2 md:gap-3" id="special-packages">
                <div className="p-2 bg-amber-50 rounded-xl">
                  <Sparkles className="w-5 h-5 md:w-6 md:h-6 text-amber-500" />
                </div>
                Featured Specials
              </h2>
              <p className="text-gray-400 text-xs md:text-sm uppercase tracking-wider font-semibold">
                Limited Time Offers
              </p>
            </div>

            <div className={`grid gap-5 ${shownSpecialPackages.length === 1 ? 'grid-cols-1 max-w-2xl mx-auto' : shownSpecialPackages.length === 2 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'}`}>
              {shownSpecialPackages.map(pkg => {
                const typeConfig: Record<string, { label: string; bgColor: string; textColor: string }> = {
                  holiday: { label: 'HOLIDAY', bgColor: 'bg-red-600', textColor: 'text-white' },
                  special: { label: 'SPECIAL', bgColor: 'bg-amber-500', textColor: 'text-white' },
                  seasonal: { label: 'SEASONAL', bgColor: 'bg-emerald-600', textColor: 'text-white' },
                  custom: { label: 'EXCLUSIVE', bgColor: 'bg-gray-900', textColor: 'text-white' },
                };
                const config = typeConfig[pkg.package_type || 'custom'] || typeConfig.custom;
                
                return (
                  <div 
                    key={pkg.id} 
                    onClick={() => handlePackageClick(pkg)}
                    className="relative bg-white border border-gray-200 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 cursor-pointer overflow-hidden group card-hover"
                  >
                    <div className="flex flex-col md:flex-row">
                      <div className="aspect-video md:aspect-auto md:h-auto md:w-2/5 bg-gray-50 relative overflow-hidden rounded-t-2xl md:rounded-l-2xl md:rounded-tr-none">
                        {pkg.image ? (
                          <img 
                            src={getImageUrl(pkg.image)} 
                            alt={pkg.name}
                            className="absolute inset-0 w-full h-full object-contain"
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-gray-900 to-gray-700 flex items-center justify-center text-white text-lg font-bold">
                            {pkg.name}
                          </div>
                        )}
                        {pkg.special_pricing?.has_special_pricing && pkg.special_pricing.discounts_applied.length > 0 && (
                          <div className="discount-overlay">
                            {pkg.special_pricing.discounts_applied.slice(0, 2).map((d, i) => (
                              <span key={i} className={`discount-pill ${i === 0 ? 'discount-pill-primary' : 'discount-pill-secondary'}`}>
                                <Sparkles size={i === 0 ? 12 : 10} />
                                <span>{d.name}: {formatDiscountLabel(d.discount_label)}</span>
                              </span>
                            ))}
                            {pkg.special_pricing.discounts_applied.length > 2 && (
                              <span className="discount-pill-more">+{pkg.special_pricing.discounts_applied.length - 2} more</span>
                            )}
                          </div>
                        )}
                        <div className={`absolute top-3 left-3 ${config.bgColor} ${config.textColor} px-3 py-1.5 md:px-4 md:py-2 text-xs md:text-sm font-bold tracking-wider rounded-lg shadow-md`}>
                          <span className="flex items-center gap-1.5">
                            <Sparkles size={12} />
                            {config.label}
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex-1 p-5 md:p-7 flex flex-col justify-between">
                        <div>
                          <h3 className="text-lg md:text-xl font-bold text-gray-900 mb-2 tracking-wide">
                            {pkg.name}
                          </h3>
                          <p className="text-sm text-gray-500 mb-4 line-clamp-2 leading-relaxed">
                            {pkg.description}
                          </p>
                          
                          <div className="flex items-center gap-4 text-xs text-gray-500 mb-4 border-t border-gray-100 pt-4">
                            <div className="flex items-center gap-1.5 bg-gray-50 px-2.5 py-1.5 rounded-md">
                              <Clock size={13} className="text-blue-600" />
                              <span className="font-medium">{pkg.duration}</span>
                            </div>
                            <div className="flex items-center gap-1.5 bg-gray-50 px-2.5 py-1.5 rounded-md">
                              <Users size={13} className="text-blue-600" />
                              <span className="font-medium">{pkg.participants}</span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <div>
                            {pkg.special_pricing?.has_special_pricing ? (
                              <div className="flex items-center gap-2">
                                <span className="text-base text-gray-400 line-through font-semibold">${pkg.special_pricing.original_price}</span>
                                <span className="text-emerald-500 text-lg font-bold">→</span>
                                <span className="text-2xl md:text-3xl font-extrabold text-emerald-600">
                                  ${pkg.special_pricing.discounted_price}
                                </span>
                              </div>
                            ) : (
                              <span className="text-2xl md:text-3xl font-extrabold text-gray-900">
                                ${pkg.price}
                              </span>
                            )}
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleBookPackage(pkg);
                            }}
                            className="bg-gradient-to-r from-blue-800 to-blue-700 hover:from-blue-900 hover:to-blue-800 text-white px-5 py-2.5 md:px-6 md:py-3 font-bold uppercase text-xs md:text-sm tracking-wider transition-all rounded-lg flex items-center gap-2 shadow-md hover:shadow-lg"
                          >
                            Book Now
                            <ChevronRight size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {showPackagesSection && packageSections.map((sec, secIndex) => (
          <section className="mb-12 md:mb-20" key={sec.label || 'packages'}>
            <div className="flex flex-col md:flex-row md:items-end md:justify-between mb-6 md:mb-10 gap-2" id={secIndex === 0 ? 'packages' : undefined}>
              <div>
                <h2 className="text-xl md:text-3xl font-bold text-gray-900 flex items-center gap-2 md:gap-3">
                  <div className="p-2 bg-blue-50 rounded-xl">
                    <Package className="w-5 h-5 md:w-6 md:h-6 text-blue-800" />
                  </div>
                  {sec.label || 'Experience Packages'}
                </h2>
                <p className="text-gray-400 text-xs md:text-sm mt-1 ml-12">
                  {sec.label ? `Book your ${sec.label.toLowerCase()} experience` : 'Choose your perfect entertainment experience'}
                </p>
              </div>
              {!dataLoading && (
                <p className="text-gray-500 text-xs md:text-sm font-medium bg-gray-100 px-3 py-1.5 rounded-full">
                  {sec.items.length} {sec.label ? `available` : `package${sec.items.length !== 1 ? 's' : ''} available`}
                </p>
              )}
            </div>
            {dataLoading ? (
              <div className="flex flex-col items-center justify-center py-16">
                <img src="/Zap-Zone.png" alt="Loading" className="w-36 h-20 object-contain animate-bounce" />
                <p className="text-gray-400 text-xs mt-3">Loading packages...</p>
              </div>
            ) : sec.items.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500 text-sm md:text-lg">No packages found matching your criteria.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-7">
                {sec.items.map(pkg => (
                  <div 
                    key={pkg.id} 
                    onClick={() => handlePackageClick(pkg)}
                    className="bg-white border border-gray-100 rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 cursor-pointer overflow-hidden card-hover group flex flex-col h-full"
                  >
                    <div className="aspect-video bg-gray-50 relative overflow-hidden flex-shrink-0">
                      {pkg.image ? (
                        <img 
                          src={getImageUrl(pkg.image)} 
                          alt={pkg.name}
                          className="absolute inset-0 w-full h-full object-contain group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-blue-700 to-blue-800 flex items-center justify-center text-white text-lg font-semibold">
                          {pkg.name}
                        </div>
                      )}
                      {pkg.special_pricing?.has_special_pricing && pkg.special_pricing.discounts_applied.length > 0 && (
                        <div className="discount-overlay">
                          {pkg.special_pricing.discounts_applied.slice(0, 2).map((d, i) => (
                            <span key={i} className={`discount-pill ${i === 0 ? 'discount-pill-primary' : 'discount-pill-secondary'}`}>
                              <Sparkles size={i === 0 ? 12 : 10} />
                              <span>{d.name}: {formatDiscountLabel(d.discount_label)}</span>
                            </span>
                          ))}
                          {pkg.special_pricing.discounts_applied.length > 2 && (
                            <span className="discount-pill-more">+{pkg.special_pricing.discounts_applied.length - 2} more</span>
                          )}
                        </div>
                      )}
                      <div className="absolute top-3 left-3">
                        <span className="px-2.5 py-1 bg-white/90 backdrop-blur-sm text-gray-700 text-xs font-semibold rounded-lg shadow-sm capitalize">
                          {pkg.display_label || pkg.category || 'Package'}
                        </span>
                      </div>
                    </div>
                    
                    <div className="p-5 md:p-6 flex flex-col flex-1">
                      <h3 className="text-lg md:text-xl font-bold text-gray-900 mb-2 group-hover:text-blue-800 transition-colors">
                        {pkg.name}
                      </h3>
                      <p className="text-sm text-gray-500 mb-4 line-clamp-2 leading-relaxed">
                        {pkg.description}
                      </p>
                      
                      <div className="space-y-2 mb-4">
                        {pkg.includes.slice(0, 3).map((item: string, index: number) => (
                          <div key={index} className="flex items-center text-xs md:text-sm text-gray-600">
                            <CheckCircle className="w-3.5 h-3.5 text-emerald-500 mr-2 flex-shrink-0" />
                            <span className="line-clamp-1">{item}</span>
                          </div>
                        ))}
                      </div>
                      
                      <div className="flex items-center gap-3 text-xs text-gray-400 mb-5 pt-3 border-t border-gray-50">
                        <div className="flex items-center gap-1.5 bg-gray-50 px-2.5 py-1.5 rounded-lg">
                          <Clock size={13} className="text-blue-600" />
                          <span className="font-medium text-gray-600 truncate">{pkg.duration}</span>
                        </div>
                        <div className="flex items-center gap-1.5 bg-gray-50 px-2.5 py-1.5 rounded-lg">
                          <Users size={13} className="text-blue-600" />
                          <span className="font-medium text-gray-600 truncate">{pkg.participants}</span>
                        </div>
                      </div>
                      
                      <div className="mt-auto">
                        <div className="flex items-end justify-between gap-3 mb-3">
                          <div>
                            {pkg.special_pricing?.has_special_pricing ? (
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-gray-400 line-through font-semibold">${pkg.special_pricing.original_price}</span>
                                <span className="text-emerald-500 font-bold">→</span>
                                <span className="text-2xl font-extrabold text-emerald-600">
                                  ${pkg.special_pricing.discounted_price}
                                </span>
                                <span className="text-gray-400 text-xs">{pkg.pricing_type === 'per_person' ? `/ ${(pkg.participant_label || 'player').toLowerCase()}` : '/ package'}</span>
                              </div>
                            ) : (
                              <>
                                <span className="text-2xl font-extrabold text-gray-900">
                                  ${pkg.price}
                                </span>
                                <span className="text-gray-400 text-xs ml-1">{pkg.pricing_type === 'per_person' ? `/ ${(pkg.participant_label || 'player').toLowerCase()}` : '/ package'}</span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-wrap items-stretch gap-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePackageClick(pkg);
                            }}
                            className="flex-1 basis-28 whitespace-nowrap border border-blue-200 text-blue-800 hover:bg-blue-50 px-3 py-2.5 font-semibold rounded-lg transition-all inline-flex items-center justify-center gap-1.5 text-sm cursor-pointer"
                          >
                            Learn more
                          </button>
                          <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleBookPackage(pkg);
                          }}
                          className="flex-1 basis-28 whitespace-nowrap bg-blue-800 hover:bg-blue-900 text-white px-5 py-2.5 font-semibold rounded-lg transition-all inline-flex items-center justify-center gap-2 text-sm shadow-md hover:shadow-lg cursor-pointer"
                        >
                          <Calendar size={15} />
                          Book Now
                        </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        ))}

        {showAttractionsSection && (
          <section className="mb-12 md:mb-20">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between mb-6 md:mb-10 gap-2">
              <div>
                <h2 className="text-xl md:text-3xl font-bold text-gray-900 flex items-center gap-2 md:gap-3" id="attractions">
                  <div className="p-2 bg-blue-50 rounded-xl">
                    <Ticket className="w-5 h-5 md:w-6 md:h-6 text-blue-600" />
                  </div>
                  Individual Attractions
                </h2>
                <p className="text-gray-400 text-xs md:text-sm mt-1 ml-12">
                  Pick your thrill, one at a time
                </p>
              </div>
              {!dataLoading && (
                <p className="text-gray-500 text-xs md:text-sm font-medium bg-gray-100 px-3 py-1.5 rounded-full">
                  {shownAttractions.length} attraction{shownAttractions.length !== 1 ? 's' : ''} available
                </p>
              )}
            </div>

            {dataLoading ? (
              <div className="flex flex-col items-center justify-center py-16">
                <img src="/Zap-Zone.png" alt="Loading" className="w-36 h-20 object-contain animate-bounce" />
                <p className="text-gray-400 text-xs mt-3">Loading attractions...</p>
              </div>
            ) : shownAttractions.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500 text-sm md:text-lg">No attractions found matching your criteria.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-7">
                {shownAttractions.map(attraction => {
                  return (
                  <div 
                    key={attraction.id} 
                    onClick={() => handleAttractionClick(attraction)}
                    className="bg-white border border-gray-100 rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 cursor-pointer overflow-hidden card-hover group flex flex-col h-full"
                  >
                    <div className="aspect-video bg-gray-50 relative overflow-hidden flex-shrink-0">
                      {attraction.image ? (
                        <img 
                          src={getImageUrl(attraction.image)} 
                          alt={attraction.name}
                          className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center text-white text-lg font-semibold">
                          {attraction.name}
                        </div>
                      )}
                      {attraction.special_pricing?.has_special_pricing && attraction.special_pricing.discounts_applied.length > 0 && (
                        <div className="discount-overlay">
                          {attraction.special_pricing.discounts_applied.slice(0, 2).map((d, i) => (
                            <span key={i} className={`discount-pill ${i === 0 ? 'discount-pill-primary' : 'discount-pill-secondary'}`}>
                              <Sparkles size={i === 0 ? 12 : 10} />
                              <span>{d.name}: {formatDiscountLabel(d.discount_label)}</span>
                            </span>
                          ))}
                          {attraction.special_pricing.discounts_applied.length > 2 && (
                            <span className="discount-pill-more">+{attraction.special_pricing.discounts_applied.length - 2} more</span>
                          )}
                        </div>
                      )}
                      <div className="absolute top-3 left-3">
                        <span className="px-2.5 py-1 bg-white/90 backdrop-blur-sm text-gray-700 text-xs font-semibold rounded-lg shadow-sm capitalize">
                          {attraction.category || 'Attraction'}
                        </span>
                      </div>
                    </div>
                    
                    <div className="p-5 md:p-6 flex flex-col flex-1">
                      <h3 className="text-lg md:text-xl font-bold text-gray-900 mb-2 group-hover:text-blue-800 transition-colors">
                        {attraction.name}
                      </h3>
                      <p className="text-sm text-gray-500 mb-3 line-clamp-2 leading-relaxed">
                        {attraction.description}
                      </p>

                      <div className="mt-auto">
                        <div className="flex items-end justify-between gap-3 mb-3">
                          <div>
                            {attraction.special_pricing?.has_special_pricing ? (
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-gray-400 line-through font-semibold">${attraction.special_pricing.original_price}</span>
                                <span className="text-emerald-500 font-bold">→</span>
                                <span className="text-2xl font-extrabold text-emerald-600">
                                  ${attraction.special_pricing.discounted_price}
                                </span>
                                <span className="text-gray-400 text-xs">/ person</span>
                              </div>
                            ) : (
                              <>
                                <span className="text-2xl font-extrabold text-gray-900">
                                  ${attraction.price}
                                </span>
                                <span className="text-gray-400 text-xs ml-1">/ person</span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-wrap items-stretch gap-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAttractionClick(attraction);
                            }}
                            className="flex-1 basis-28 whitespace-nowrap border border-blue-200 text-blue-800 hover:bg-blue-50 px-3 py-2.5 font-semibold rounded-lg transition-all inline-flex items-center justify-center gap-1.5 text-sm cursor-pointer"
                          >
                            Learn more
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleBuyTickets(attraction);
                            }}
                            className="flex-1 basis-28 whitespace-nowrap px-4 py-2.5 font-semibold rounded-lg transition-all inline-flex items-center justify-center gap-2 text-sm bg-blue-800 hover:bg-blue-900 text-white shadow-md hover:shadow-lg cursor-pointer"
                          >
                            <Ticket size={15} />
                            Buy now
                          </button>
                          {CART_ENABLED && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAddAttractionToCart(attraction);
                              }}
                              className="flex-1 basis-28 whitespace-nowrap px-4 py-2.5 font-semibold rounded-lg transition-colors inline-flex items-center justify-center gap-2 text-sm border border-blue-800 text-blue-800 hover:bg-blue-50 cursor-pointer"
                            >
                              <ShoppingCart size={15} />
                              Add to cart
                            </button>
                          )}
                        </div>
                        {cartNotice?.key === `attraction-${attraction.id}` && (
                          <p className="mt-2 text-xs font-semibold text-blue-800">{cartNotice.message}</p>
                        )}
                      </div>
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* <MembershipCarousel /> */}

        {showEventsSection && (
        <section className="mb-12 md:mb-20">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between mb-6 md:mb-10 gap-2">
            <div>
              <h2 className="text-xl md:text-3xl font-bold text-gray-900 flex items-center gap-2 md:gap-3" id="events">
                <div className="p-2 bg-blue-50 rounded-xl">
                  <Calendar className="w-5 h-5 md:w-6 md:h-6 text-blue-600" />
                </div>
                Upcoming Events
              </h2>
              <p className="text-gray-400 text-xs md:text-sm mt-1 ml-12">
                Don't miss out on exciting events
              </p>
            </div>
            {!dataLoading && (
              <p className="text-gray-500 text-xs md:text-sm font-medium bg-gray-100 px-3 py-1.5 rounded-full">
                {filteredEvents.length} event{filteredEvents.length !== 1 ? 's' : ''} available
              </p>
            )}
          </div>

          {dataLoading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <img src="/Zap-Zone.png" alt="Loading" className="w-36 h-20 object-contain animate-bounce" />
              <p className="text-gray-400 text-xs mt-3">Loading events...</p>
            </div>
          ) : filteredEvents.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 text-sm md:text-lg">No upcoming events found matching your criteria.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-7">
              {filteredEvents.map((evt) => {
                return (
                  <div
                    key={`${evt.name}-${evt.start_date}`}
                    onClick={() => handleEventClick(evt)}
                    className="bg-white border border-gray-100 rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 cursor-pointer overflow-hidden card-hover group flex flex-col h-full"
                  >
                    <div className="aspect-video bg-gray-50 relative overflow-hidden flex-shrink-0">
                      {evt.image ? (
                        <img
                          src={getImageUrl(evt.image)}
                          alt={evt.name}
                          className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center text-white text-lg font-semibold">
                          {evt.name}
                        </div>
                      )}
                      <div className="absolute top-3 left-3">
                        <span className="px-2.5 py-1 bg-white/90 backdrop-blur-sm text-gray-700 text-xs font-semibold rounded-lg shadow-sm">
                          Event
                        </span>
                      </div>
                    </div>

                    <div className="p-5 md:p-6 flex flex-col flex-1">
                      <h3 className="text-lg md:text-xl font-bold text-gray-900 mb-2 group-hover:text-blue-800 transition-colors">
                        {evt.name}
                      </h3>
                      {evt.description && (
                        <p className="text-sm text-gray-500 mb-3 line-clamp-2 leading-relaxed whitespace-pre-line">{evt.description}</p>
                      )}

                      <div className="mt-auto">
                        <div className="flex items-end justify-between gap-3 mb-3">
                          <div>
                            <span className="text-2xl font-extrabold text-gray-900">
                              ${parseFloat(evt.price).toFixed(2)}
                            </span>
                            <span className="text-gray-400 text-xs ml-1">/ ticket</span>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-stretch gap-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEventClick(evt);
                            }}
                            className="flex-1 basis-28 whitespace-nowrap border border-blue-200 text-blue-800 hover:bg-blue-50 px-3 py-2.5 font-semibold rounded-lg transition-all inline-flex items-center justify-center gap-1.5 text-sm cursor-pointer"
                          >
                            Learn more
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleBuyEventTickets(evt);
                            }}
                            className="flex-1 basis-28 whitespace-nowrap px-4 py-2.5 font-semibold rounded-lg transition-all inline-flex items-center justify-center gap-2 text-sm bg-blue-800 hover:bg-blue-900 text-white shadow-md hover:shadow-lg cursor-pointer"
                          >
                            <Ticket size={15} />
                            Buy now
                          </button>
                          {CART_ENABLED && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAddEventToCart(evt);
                              }}
                              className="flex-1 basis-28 whitespace-nowrap px-4 py-2.5 font-semibold rounded-lg transition-colors inline-flex items-center justify-center gap-2 text-sm border border-blue-800 text-blue-800 hover:bg-blue-50 cursor-pointer"
                            >
                              <ShoppingCart size={15} />
                              Add to cart
                            </button>
                          )}
                        </div>
                        {cartNotice?.key === `event-${evt.name}-${evt.start_date}` && (
                          <p className="mt-2 text-xs font-semibold text-blue-800">{cartNotice.message}</p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
        )}
      </main>

      {showAttractionModal && selectedAttraction && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 md:p-4 z-50 animate-backdrop-fade" onClick={() => setShowAttractionModal(false)}>
          <div 
            className="bg-white rounded-2xl max-w-md w-full max-h-[85vh] md:max-h-[80vh] overflow-y-auto modal-scroll shadow-2xl animate-scale-in relative scroll-indicator" 
            onClick={(e) => e.stopPropagation()}
            onScroll={(e) => {
              const target = e.currentTarget;
              if (target.scrollTop > 5) {
                target.classList.add('scrolled-bottom');
              } else {
                target.classList.remove('scrolled-bottom');
              }
            }}
          >
            <div className="sticky top-0 z-10">
              <div className="relative h-28 md:h-32 bg-gradient-to-br from-blue-700 to-blue-800 rounded-t-2xl">
                <button
                  type="button"
                  onClick={() => setShowAttractionModal(false)}
                  className="absolute top-3 right-3 p-2 bg-white/90 backdrop-blur-sm hover:bg-white text-gray-900 transition-all shadow-lg z-20 rounded-full cursor-pointer"
                >
                  <X size={14} className="md:w-4 md:h-4" />
                </button>
                <div className="absolute inset-0 flex items-center justify-center px-6">
                  <p className="text-lg md:text-2xl font-bold text-center line-clamp-2 text-white drop-shadow-md">{selectedAttraction.name}</p>
                </div>
              </div>
            </div>

            <div className="p-5">
              <div className="flex items-center justify-between gap-3 mb-5 pb-5 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center">
                    <DollarSign className="text-emerald-600" size={20} />
                  </div>
                  <div>
                    {selectedAttraction.special_pricing?.has_special_pricing ? (
                      <>
                        <div className="text-sm text-gray-400 line-through">${selectedAttraction.special_pricing.original_price}</div>
                        <div className="text-xl md:text-2xl font-extrabold text-emerald-600">${selectedAttraction.special_pricing.discounted_price}</div>
                        <div className="text-xs text-gray-400">per person</div>
                      </>
                    ) : (
                      <>
                        <div className="text-xl md:text-2xl font-extrabold text-gray-900">${selectedAttraction.price}</div>
                        <div className="text-xs text-gray-400">per person</div>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-sm font-bold text-gray-900">{selectedAttraction.duration || 'Unlimited'}</div>
                    <div className="text-xs text-gray-400">Duration</div>
                  </div>
                  <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                    <Clock size={18} className="text-blue-600" />
                  </div>
                </div>
              </div>

              {selectedAttraction.special_pricing?.has_special_pricing && selectedAttraction.special_pricing.discounts_applied.length > 0 && (
                <div className="mb-5 bg-emerald-50 border border-emerald-100 rounded-xl p-3">
                  <h3 className="text-xs font-bold text-emerald-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    Active Discounts
                  </h3>
                  <div className="space-y-1.5">
                    {selectedAttraction.special_pricing.discounts_applied.map((d, i) => (
                      <div key={i} className="flex items-center justify-between bg-white rounded-lg px-3 py-2">
                        <div>
                          <div className="text-sm font-semibold text-gray-900">{d.name}</div>
                          {d.description && <div className="text-xs text-gray-500">{d.description}</div>}
                          {d.recurrence_display && <div className="text-[11px] text-gray-400 mt-0.5">{d.recurrence_display}</div>}
                        </div>
                        <span className="text-sm font-bold text-emerald-600">{formatDiscountLabel(d.discount_label)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 pt-2 border-t border-emerald-200 flex items-center justify-between text-xs">
                    <span className="text-emerald-700 font-medium">Total Savings</span>
                    <span className="text-emerald-700 font-bold">{Math.round(selectedAttraction.special_pricing.total_discount)}% off</span>
                  </div>
                </div>
              )}

              <div className="mb-5">
                <h3 className="text-sm font-bold text-gray-900 mb-2">About</h3>
                <p className="text-xs md:text-sm text-gray-500 leading-relaxed">{selectedAttraction.description}</p>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-5">
                {(selectedAttraction.displayCapacityToCustomers !== false) && (
                  <div className="bg-gray-50 p-3 rounded-xl">
                    <div className="flex items-center gap-1.5 text-gray-400 mb-1">
                      <Users size={12} />
                      <span className="text-xs font-medium">Capacity</span>
                    </div>
                    <div className="text-sm font-bold text-gray-900">{selectedAttraction.capacity} people</div>
                  </div>
                )}
                <div className="bg-gray-50 p-3 rounded-xl">
                  <div className="flex items-center gap-1.5 text-gray-400 mb-1">
                    <Ticket size={12} />
                    <span className="text-xs font-medium">Category</span>
                  </div>
                  <div className="text-sm font-bold text-gray-900 capitalize">{selectedAttraction.category}</div>
                </div>
              </div>

              {Array.isArray(selectedAttraction.availability)
                && selectedAttraction.availability.some(s => Array.isArray(s.days) && s.days.length > 0) && (
              <div className="mb-5">
                <h3 className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-1.5">
                  <Calendar size={14} className="text-blue-800" />
                  Availability
                </h3>
                {selectedAttraction.availability && Array.isArray(selectedAttraction.availability) && selectedAttraction.availability.length > 0 ? (
                  <>
                    <div className="space-y-2 mb-4">
                      {selectedAttraction.availability.map((schedule, index) => (
                        schedule.days && Array.isArray(schedule.days) && schedule.days.length > 0 ? (
                          <div key={index} className="bg-blue-50/60 border border-blue-100 p-3 rounded-xl">
                            <div className="flex flex-wrap gap-1 mb-2">
                              {schedule.days.map((day) => (
                                <span key={day} className="px-2 py-0.5 bg-blue-800 text-white text-xs font-medium capitalize rounded-md">
                                  {day.substring(0, 3)}
                                </span>
                              ))}
                            </div>
                            <div className="flex items-center gap-1.5 text-xs text-gray-600">
                              <Clock size={12} className="text-blue-600" />
                              <span className="font-medium">
                                {formatTime(schedule.start_time)} - {formatTime(schedule.end_time)}
                              </span>
                            </div>
                          </div>
                        ) : null
                      ))}
                    </div>

                    {(() => {
                      const sessions = getUpcomingAttractionSessions(selectedAttraction.availability, 5);
                      if (sessions.length === 0) return null;
                      return (
                        <div>
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Upcoming Sessions ({easternTimeAbbr})</p>
                          <div className="space-y-1.5">
                            {sessions.map((session, idx) => (
                              <div
                                key={idx}
                                className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs ${
                                  session.hasEnded
                                    ? 'bg-gray-50 text-gray-400 line-through'
                                    : session.isToday && session.hasStarted
                                      ? 'bg-emerald-50 border border-emerald-200 text-gray-700'
                                      : session.isToday && !session.hasStarted
                                        ? 'bg-blue-50 border border-blue-100 text-gray-700'
                                        : 'bg-gray-50 text-gray-600'
                                }`}
                              >
                                <span className="font-semibold">
                                  {session.label}
                                  {session.isToday && session.hasStarted && !session.hasEnded && (
                                    <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded-full uppercase">Now</span>
                                  )}
                                  {session.isToday && !session.hasStarted && !session.hasEnded && (
                                    <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-bold rounded-full uppercase">Soon</span>
                                  )}
                                  {session.hasEnded && (
                                    <span className="ml-1.5 text-[10px] text-gray-400 font-normal no-underline" style={{ textDecoration: 'none' }}>Ended</span>
                                  )}
                                </span>
                                <span className="font-medium">{session.startTime} – {session.endTime}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}
                  </>
                ) : (
                  <div className="bg-gray-50 p-3 rounded-xl">
                    <p className="text-xs text-gray-400">Contact location for availability details.</p>
                  </div>
                )}
              </div>
              )}

              {!activeLocation && (
                <div className="mb-5">
                  <h3 className="text-sm font-bold text-gray-900 mb-2">Locations</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedAttraction.availableLocations.map((location) => (
                      <div key={location} className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-50 text-gray-600 text-xs rounded-lg">
                        <MapPin size={11} className="text-blue-600" />
                        <span className="font-medium">{location}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2.5">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleBuyTickets(selectedAttraction);
                  }}
                  className="w-full py-3 font-semibold text-sm rounded-xl transition-all flex items-center justify-center gap-2 bg-gradient-to-r from-blue-800 to-blue-700 text-white hover:from-blue-900 hover:to-blue-800 shadow-md hover:shadow-lg cursor-pointer"
                >
                  <Ticket size={16} />
                  Buy Tickets
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowAttractionModal(false);
                  }}
                  className="w-full py-2.5 border border-gray-200 text-gray-500 hover:bg-gray-50 rounded-xl transition text-sm"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showPackageModal && selectedPackage && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 md:p-4 z-50 animate-backdrop-fade" onClick={() => setShowPackageModal(false)}>
          <div 
            className="bg-white rounded-2xl max-w-md w-full max-h-[85vh] md:max-h-[80vh] overflow-y-auto modal-scroll shadow-2xl animate-scale-in relative scroll-indicator" 
            onClick={(e) => e.stopPropagation()}
            onScroll={(e) => {
              const target = e.currentTarget;
              if (target.scrollTop > 5) {
                target.classList.add('scrolled-bottom');
              } else {
                target.classList.remove('scrolled-bottom');
              }
            }}
          >
            <div className="sticky top-0 z-10">
              <div className="relative h-28 md:h-32 bg-gradient-to-br from-blue-800 to-blue-700 rounded-t-2xl">
                <button
                  type="button"
                  onClick={() => setShowPackageModal(false)}
                  className="absolute top-3 right-3 p-2 bg-white/90 backdrop-blur-sm hover:bg-white text-gray-900 transition-all shadow-lg z-20 rounded-full cursor-pointer"
                >
                  <X size={14} className="md:w-4 md:h-4" />
                </button>
                <div className="absolute inset-0 flex items-center justify-center px-6">
                  <p className="text-lg md:text-2xl font-bold text-center line-clamp-2 text-white drop-shadow-md">{selectedPackage.name}</p>
                </div>
              </div>
            </div>

            <div className="p-5">
              <div className="flex items-center justify-between gap-3 mb-5 pb-5 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center">
                    <DollarSign className="text-emerald-600" size={20} />
                  </div>
                  <div>
                    {selectedPackage.special_pricing?.has_special_pricing ? (
                      <>
                        <div className="text-sm text-gray-400 line-through">${selectedPackage.special_pricing.original_price}</div>
                        <div className="text-xl md:text-2xl font-extrabold text-emerald-600">${selectedPackage.special_pricing.discounted_price}</div>
                        <div className="text-xs text-gray-400">package</div>
                      </>
                    ) : (
                      <>
                        <div className="text-xl md:text-2xl font-extrabold text-gray-900">${selectedPackage.price}</div>
                        <div className="text-xs text-gray-400">package</div>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-sm font-bold text-gray-900">{selectedPackage.duration}</div>
                    <div className="text-xs text-gray-400">Duration</div>
                  </div>
                  <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                    <Clock size={18} className="text-blue-600" />
                  </div>
                </div>
              </div>

              {selectedPackage.special_pricing?.has_special_pricing && selectedPackage.special_pricing.discounts_applied.length > 0 && (
                <div className="mb-5 bg-emerald-50 border border-emerald-100 rounded-xl p-3">
                  <h3 className="text-xs font-bold text-emerald-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    Active Discounts
                  </h3>
                  <div className="space-y-1.5">
                    {selectedPackage.special_pricing.discounts_applied.map((d, i) => (
                      <div key={i} className="flex items-center justify-between bg-white rounded-lg px-3 py-2">
                        <div>
                          <div className="text-sm font-semibold text-gray-900">{d.name}</div>
                          {d.description && <div className="text-xs text-gray-500">{d.description}</div>}
                          {d.recurrence_display && <div className="text-[11px] text-gray-400 mt-0.5">{d.recurrence_display}</div>}
                        </div>
                        <span className="text-sm font-bold text-emerald-600">{formatDiscountLabel(d.discount_label)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 pt-2 border-t border-emerald-200 flex items-center justify-between text-xs">
                    <span className="text-emerald-700 font-medium">Total Savings</span>
                    <span className="text-emerald-700 font-bold">{Math.round(selectedPackage.special_pricing.total_discount)}% off</span>
                  </div>
                </div>
              )}

              <div className="mb-5">
                <h3 className="text-sm font-bold text-gray-900 mb-2">About</h3>
                <p className="text-xs md:text-sm text-gray-500 leading-relaxed">{selectedPackage.description}</p>
              </div>

              <div className="grid grid-cols-1 gap-3 mb-5">
                <div className="bg-gray-50 p-3 rounded-xl">
                  <div className="flex items-center gap-1.5 text-gray-400 mb-1">
                    <Users size={12} />
                    <span className="text-xs font-medium">Group Size</span>
                  </div>
                  <div className="text-sm font-bold text-gray-900">{selectedPackage.participants}</div>
                  {selectedPackage.price_per_additional && selectedPackage.price_per_additional > 0 && (
                    <div className="text-xs text-gray-500 mt-1">
                      +${selectedPackage.price_per_additional} per additional guest
                    </div>
                  )}
                </div>
              </div>

              {selectedPackage.includes.length > 0 && (
                <div className="mb-5">
                  <h3 className="text-sm font-bold text-gray-900 mb-2">Included</h3>
                  <div className="space-y-1.5">
                    {selectedPackage.includes.map((item, index) => (
                      <div key={index} className="flex items-center gap-2 text-xs text-gray-600">
                        <CheckCircle className="text-emerald-500 flex-shrink-0" size={13} />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {Array.isArray(selectedPackage.availability_schedules)
                && selectedPackage.availability_schedules.some(s =>
                  (Array.isArray(s.day_configuration) && s.day_configuration.length > 0)
                  || s.availability_type === 'daily') && (
              <div className="mb-5">
                <h3 className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-1.5">
                  <Calendar size={14} className="text-blue-800" />
                  Availability
                </h3>
                {selectedPackage.availability_schedules && Array.isArray(selectedPackage.availability_schedules) && selectedPackage.availability_schedules.length > 0 ? (
                  <>
                    <div className="space-y-2 mb-4">
                      {selectedPackage.availability_schedules.map((schedule, index) => (
                        (schedule.day_configuration && Array.isArray(schedule.day_configuration) && schedule.day_configuration.length > 0)
                          || schedule.availability_type === 'daily' ? (
                          <div key={index} className="bg-blue-50/60 border border-blue-100 p-3 rounded-xl">
                            <div className="flex flex-wrap gap-1 mb-2">
                              {(schedule.day_configuration ?? []).length > 0
                                ? (schedule.day_configuration ?? []).map((day) => (
                                    <span key={day} className="px-2 py-0.5 bg-blue-800 text-white text-xs font-medium capitalize rounded-md">
                                      {day.substring(0, 3)}
                                    </span>
                                  ))
                                : (
                                  <span className="px-2 py-0.5 bg-blue-800 text-white text-xs font-medium rounded-md">
                                    Every day
                                  </span>
                                )}
                            </div>
                            <div className="flex items-center gap-1.5 text-xs text-gray-600">
                              <Clock size={12} className="text-blue-600" />
                              <span className="font-medium">
                                {formatTime(schedule.time_slot_start)} - {formatTime(schedule.time_slot_end)}
                              </span>
                            </div>
                          </div>
                        ) : null
                      ))}
                    </div>

                    {(() => {
                      const sessions = getUpcomingPackageSessions(selectedPackage.availability_schedules!, 5);
                      if (sessions.length === 0) return null;
                      return (
                        <div>
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Upcoming Sessions ({easternTimeAbbr})</p>
                          <div className="space-y-1.5">
                            {sessions.map((session, idx) => (
                              <div
                                key={idx}
                                className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs ${
                                  session.hasEnded
                                    ? 'bg-gray-50 text-gray-400 line-through'
                                    : session.isToday && session.hasStarted
                                      ? 'bg-emerald-50 border border-emerald-200 text-gray-700'
                                      : session.isToday && !session.hasStarted
                                        ? 'bg-blue-50 border border-blue-100 text-gray-700'
                                        : 'bg-gray-50 text-gray-600'
                                }`}
                              >
                                <span className="font-semibold">
                                  {session.label}
                                  {session.isToday && session.hasStarted && !session.hasEnded && (
                                    <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded-full uppercase">Now</span>
                                  )}
                                  {session.isToday && !session.hasStarted && !session.hasEnded && (
                                    <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-bold rounded-full uppercase">Soon</span>
                                  )}
                                  {session.hasEnded && (
                                    <span className="ml-1.5 text-[10px] text-gray-400 font-normal no-underline" style={{ textDecoration: 'none' }}>Ended</span>
                                  )}
                                </span>
                                <span className="font-medium">{session.startTime} – {session.endTime}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}
                  </>
                ) : (
                  <div className="bg-gray-50 p-3 rounded-xl">
                    <p className="text-xs text-gray-400">Contact location for availability details.</p>
                  </div>
                )}
              </div>
              )}

              {!activeLocation && (
                <div className="mb-5">
                  <h3 className="text-sm font-bold text-gray-900 mb-2">Locations</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedPackage.availableLocations.map((location) => (
                      <div key={location} className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-50 text-gray-600 text-xs rounded-lg">
                        <MapPin size={11} className="text-blue-600" />
                        <span className="font-medium">{location}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {upgradeSuggestion && (
                <div className="mb-5 bg-gray-50 rounded-xl p-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Consider upgrading</p>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-bold text-gray-900">{upgradeSuggestion.package.name}</span>
                    <span className="text-sm font-bold text-blue-800">${upgradeSuggestion.package.price}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {upgradeSuggestion.highlights.map((h, i) => (
                      <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 bg-white text-gray-600 text-[11px] rounded-full shadow-sm">
                        <CheckCircle size={10} className="text-emerald-500" />
                        {h}
                      </span>
                    ))}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowPackageModal(false);
                      setTimeout(() => {
                        handlePackageClick(upgradeSuggestion.package);
                      }, 200);
                    }}
                    className="w-full py-2 bg-blue-800 text-white text-sm font-semibold rounded-lg hover:bg-blue-900 transition-all flex items-center justify-center gap-1.5"
                  >
                    View Upgrade
                    <ChevronRight size={14} />
                  </button>
                </div>
              )}

              <div className="space-y-2.5">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleBookPackage(selectedPackage);
                  }}
                  className="w-full py-3 bg-gradient-to-r from-blue-800 to-blue-700 text-white font-semibold text-sm rounded-xl hover:from-blue-900 hover:to-blue-800 transition-all flex items-center justify-center gap-2 shadow-md hover:shadow-lg"
                >
                  <Package size={16} />
                  Book This Package
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowPackageModal(false);
                  }}
                  className="w-full py-2.5 border border-gray-200 text-gray-500 hover:bg-gray-50 rounded-xl transition text-sm"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showEventModal && selectedEvent && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 md:p-4 z-50 animate-backdrop-fade" onClick={() => setShowEventModal(false)}>
          <div 
            className="bg-white rounded-2xl max-w-md w-full max-h-[85vh] md:max-h-[80vh] overflow-y-auto modal-scroll shadow-2xl animate-scale-in relative scroll-indicator" 
            onClick={(e) => e.stopPropagation()}
            onScroll={(e) => {
              const target = e.currentTarget;
              if (target.scrollTop > 5) {
                target.classList.add('scrolled-bottom');
              } else {
                target.classList.remove('scrolled-bottom');
              }
            }}
          >
            <div className="sticky top-0 z-10">
              <div className="relative h-28 md:h-32 bg-gradient-to-br from-blue-600 to-blue-800 rounded-t-2xl">
                <button
                  type="button"
                  onClick={() => setShowEventModal(false)}
                  className="absolute top-3 right-3 p-2 bg-white/90 backdrop-blur-sm hover:bg-white text-gray-900 transition-all shadow-lg z-20 rounded-full cursor-pointer"
                >
                  <X size={14} className="md:w-4 md:h-4" />
                </button>
                <div className="absolute inset-0 flex items-center justify-center px-6">
                  <p className="text-lg md:text-2xl font-bold text-center line-clamp-2 text-white drop-shadow-md">{selectedEvent.name}</p>
                </div>
              </div>
            </div>

            <div className="p-5">
              <div className="flex items-center justify-between gap-3 mb-5 pb-5 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center">
                    <DollarSign className="text-emerald-600" size={20} />
                  </div>
                  <div>
                    <div className="text-xl md:text-2xl font-extrabold text-gray-900">${parseFloat(selectedEvent.price).toFixed(2)}</div>
                    <div className="text-xs text-gray-400">per ticket</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-sm font-bold text-gray-900">
                      {selectedEvent.date_type === 'one_time' ? 'One-Time' : 'Date Range'}
                    </div>
                    <div className="text-xs text-gray-400">Event Type</div>
                  </div>
                  <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                    <Calendar size={18} className="text-blue-600" />
                  </div>
                </div>
              </div>

              {selectedEvent.description && (
                <div className="mb-5">
                  <h3 className="text-sm font-bold text-gray-900 mb-2">About</h3>
                  <p className="text-xs md:text-sm text-gray-500 leading-relaxed whitespace-pre-line">{selectedEvent.description}</p>
                </div>
              )}

              <div className="mb-5">
                <h3 className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-1.5">
                  <Calendar size={14} className="text-blue-600" />
                  Date & Time
                </h3>
                <div className="space-y-2">
                  <div className="bg-blue-50/60 border border-blue-100 p-3 rounded-xl">
                    <div className="flex items-center gap-1.5 text-xs text-gray-600 mb-1">
                      <Calendar size={12} className="text-blue-600" />
                      <span className="font-semibold">
                        {(() => {
                          const startStr = selectedEvent.start_date.substring(0, 10);
                          const endStr = (selectedEvent.end_date || selectedEvent.start_date).substring(0, 10);
                          return selectedEvent.date_type === 'one_time'
                            ? new Date(startStr + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
                            : `${new Date(startStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} — ${new Date(endStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`;
                        })()}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-gray-600">
                      <Clock size={12} className="text-blue-600" />
                      <span className="font-medium">{formatTime(selectedEvent.time_start)} – {formatTime(selectedEvent.time_end)} ({easternTimeAbbr})</span>
                    </div>
                  </div>
                </div>
              </div>

              {selectedEvent.features && selectedEvent.features.length > 0 && (
                <div className="mb-5">
                  <h3 className="text-sm font-bold text-gray-900 mb-2">What's Included</h3>
                  <div className="space-y-1.5">
                    {selectedEvent.features.map((f, i) => (
                      <div key={i} className="flex items-center text-xs md:text-sm text-gray-600">
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-500 mr-2 flex-shrink-0" />
                        <span>{f}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mb-5">
                <h3 className="text-sm font-bold text-gray-900 mb-2">{activeLocation ? 'Location' : 'Locations'}</h3>
                <div className="space-y-2">
                  {(activeLocation
                    ? selectedEvent.locations.filter((loc) => loc.location_id === activeLocation.id)
                    : selectedEvent.locations
                  ).map((loc) => (
                    <div key={loc.location_id} className="flex items-start gap-2.5 px-3 py-2.5 bg-gray-50 rounded-xl">
                      <MapPin size={14} className="text-blue-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <div className="text-xs font-semibold text-gray-900">{loc.location_name}</div>
                        {loc.address && (
                          <div className="text-xs text-gray-400">{loc.address}{loc.city ? `, ${loc.city}` : ''}{loc.state ? `, ${loc.state}` : ''}</div>
                        )}
                        {loc.phone && (
                          <div className="text-xs text-gray-400 mt-0.5">{loc.phone}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2.5">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleBuyEventTickets(selectedEvent);
                  }}
                  className="w-full py-3 font-semibold text-sm rounded-xl transition-all flex items-center justify-center gap-2 bg-blue-800 hover:bg-blue-900 text-white shadow-md hover:shadow-lg cursor-pointer"
                >
                  <Ticket size={16} />
                  Get Tickets
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowEventModal(false);
                  }}
                  className="w-full py-2.5 border border-gray-200 text-gray-500 hover:bg-gray-50 rounded-xl transition text-sm"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showLocationModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 z-50 animate-backdrop-fade" onClick={() => setShowLocationModal(false)}>
          <div className="bg-white rounded-2xl max-w-sm w-full shadow-2xl animate-scale-in max-h-[80vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900 mb-1">
                Select Location
              </h3>
              <p className="text-xs text-gray-400">
                Choose location for {activeBookingType === 'attraction' ? selectedAttraction?.name : activeBookingType === 'event' ? selectedEvent?.name : selectedPackage?.name}
              </p>
            </div>
            
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {locations.filter(location => location !== 'All Locations').map(location => {
                const availableLocations = activeBookingType === 'attraction' 
                  ? selectedAttraction?.availableLocations 
                  : activeBookingType === 'event'
                  ? selectedEvent?.availableLocations
                  : selectedPackage?.availableLocations;
                
                const isAvailable = availableLocations?.includes(location);
                
                return (
                  <button
                    key={location}
                    onClick={() => isAvailable && handleLocationSelect(location)}
                    disabled={!isAvailable}
                    className={`w-full p-3 text-left border rounded-xl transition-all ${
                      isAvailable 
                        ? 'border-gray-100 hover:border-blue-400 hover:bg-blue-50 hover:shadow-md cursor-pointer' 
                        : 'border-gray-50 bg-gray-50/50 cursor-not-allowed opacity-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2.5">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isAvailable ? 'bg-blue-50' : 'bg-gray-100'}`}>
                          <MapPin size={14} className={isAvailable ? "text-blue-600" : "text-gray-300"} />
                        </div>
                        <span className={`text-sm ${isAvailable ? "text-gray-900 font-medium" : "text-gray-400"}`}>
                          {location}
                        </span>
                      </div>
                      {isAvailable ? (
                        <ChevronRight size={14} className="text-gray-300" />
                      ) : (
                        <span className="text-[10px] text-gray-300 uppercase tracking-wider font-medium">Unavailable</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
            
            <div className="p-3 border-t border-gray-100">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowLocationModal(false);
                }}
                className="w-full py-2.5 border border-gray-200 text-gray-500 hover:bg-gray-50 rounded-xl transition text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <SiteFooter />
    </>
  );
};

export default EntertainmentLandingPage;
