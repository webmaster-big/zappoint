import { useState, useEffect } from 'react';
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
  Sparkles
} from 'lucide-react';
import type { Attraction, Package as PackageType, BookingType } from '../../types/customer';
import { customerService, type GroupedAttraction, type GroupedPackage } from '../../services/CustomerService';
import { ASSET_URL } from '../../utils/storage';
import { generateSlug, generateLocationSlug } from '../../utils/slug';
import { convertTo12Hour, formatDurationDisplay } from '../../utils/timeFormat';

const EntertainmentLandingPage = () => {
  const [selectedLocation, setSelectedLocation] = useState('All Locations');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'packages' | 'attractions'>('all');
  const [selectedAttraction, setSelectedAttraction] = useState<Attraction | null>(null);
  const [selectedPackage, setSelectedPackage] = useState<PackageType | null>(null);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [showAttractionModal, setShowAttractionModal] = useState(false);
  const [showPackageModal, setShowPackageModal] = useState(false);
  const [activeBookingType, setActiveBookingType] = useState<BookingType | null>(null);
  
  // Backend data
  const [attractions, setAttractions] = useState<Attraction[]>([]);
  const [packages, setPackages] = useState<PackageType[]>([]);
  const [locations, setLocations] = useState<string[]>(['All Locations']);
  const [loading, setLoading] = useState(true);

  // Load data from backend on mount
  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reload data when search changes (with debounce)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      loadData();
    }, 500);
    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Fetch grouped attractions and packages from backend
      const [attractionsResponse, packagesResponse] = await Promise.all([
        customerService.getGroupedAttractions(searchQuery || undefined),
        customerService.getGroupedPackages(searchQuery || undefined),
      ]);

      if (attractionsResponse.success && attractionsResponse.data) {
        // Transform grouped attractions to match component format
        // Note: availability is fetched separately when modal opens since grouped endpoint doesn't include it
        const transformedAttractions: Attraction[] = attractionsResponse.data.map((attr: GroupedAttraction) => {
          return {
            id: attr.purchase_links[0]?.attraction_id || 0,
            name: attr.name,
            description: attr.description,
            price: attr.price,
            minAge: attr.min_age,
            capacity: attr.max_capacity,
            rating: attr.rating || 4.5,
            image: Array.isArray(attr.image) ? attr.image[0] : attr.image,
            category: attr.category,
            availableLocations: attr.locations.map(loc => loc.location_name),
            duration: attr.duration === 0 || !attr.duration ? 'Unlimited' : formatDurationDisplay(attr.duration, attr.duration_unit),
            pricingType: attr.pricing_type,
            purchaseLinks: attr.purchase_links,
            availability: undefined, // Will be loaded when modal opens
          };
        });
        setAttractions(transformedAttractions);

        // Extract unique locations from attractions
        const attractionLocations = new Set<string>();
        attractionsResponse.data.forEach((attr: GroupedAttraction) => {
          attr.locations.forEach(loc => attractionLocations.add(loc.location_name));
        });
        
        // Add locations from packages too
        if (packagesResponse.success && packagesResponse.data) {
          packagesResponse.data.forEach((pkg: GroupedPackage) => {
            pkg.locations.forEach(loc => attractionLocations.add(loc.location_name));
          });
        }

        setLocations(['All Locations', ...Array.from(attractionLocations).sort()]);
      }

      if (packagesResponse.success && packagesResponse.data) {
        // Transform grouped packages to match component format
        // Note: availability_schedules is fetched separately when modal opens since grouped endpoint doesn't include it
        const transformedPackages: PackageType[] = packagesResponse.data.map((pkg: GroupedPackage) => {
          // Format participants display with fallbacks
          const minGuests = pkg.min_participants || 1;
          const maxGuests = pkg.max_guests || minGuests;
          
          let participantsText: string;
          if (maxGuests > minGuests) {
            participantsText = `Starts at ${minGuests} guests (up to ${maxGuests})`;
          } else {
            participantsText = `${minGuests} guests`;
          }
          
          return {
            id: pkg.booking_links[0]?.package_id || 0,
            name: pkg.name,
            description: pkg.description,
            price: pkg.price,
            duration: pkg.duration === 0 || !pkg.duration ? 'Unlimited' : formatDurationDisplay(pkg.duration, pkg.duration_unit),
            participants: participantsText,
            includes: [], // This would need to be added to backend if needed
            rating: 4.8, // Default rating, backend doesn't return this yet
            image: Array.isArray(pkg.image) ? pkg.image[0] : pkg.image,
            category: pkg.category,
            availableLocations: pkg.locations.map(loc => loc.location_name),
            bookingLinks: pkg.booking_links,
            availability_schedules: undefined, // Will be loaded when modal opens
            package_type: pkg.package_type || 'regular',
            min_participants: pkg.min_participants,
            max_guests: pkg.max_guests,
            price_per_additional: pkg.price_per_additional,
          };
        });
        setPackages(transformedPackages);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };
  const filteredAttractions = attractions.filter(attraction => {
    const matchesLocation = selectedLocation === 'All Locations' || 
      attraction.availableLocations.includes(selectedLocation);
    const matchesSearch = attraction.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      attraction.description.toLowerCase().includes(searchQuery.toLowerCase());
    
    return matchesLocation && matchesSearch;
  });

  // Filter regular packages only
  const filteredPackages = packages.filter(pkg => {
    const matchesLocation = selectedLocation === 'All Locations' || 
      pkg.availableLocations.includes(selectedLocation);
    const matchesSearch = pkg.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pkg.description.toLowerCase().includes(searchQuery.toLowerCase());
    const isRegular = !pkg.package_type || pkg.package_type === 'regular';
    
    return matchesLocation && matchesSearch && isRegular;
  });

  // Filter special packages (non-regular: custom, holiday, seasonal, special)
  const filteredSpecialPackages = packages.filter(pkg => {
    const matchesLocation = selectedLocation === 'All Locations' || 
      pkg.availableLocations.includes(selectedLocation);
    const matchesSearch = pkg.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pkg.description.toLowerCase().includes(searchQuery.toLowerCase());
    const isSpecial = pkg.package_type && pkg.package_type !== 'regular';
    
    return matchesLocation && matchesSearch && isSpecial;
  });

  const handleAttractionClick = async (attraction: Attraction) => {
    // Fetch full attraction details to get availability schedules
    try {
      const response = await customerService.getAttraction(attraction.id);
      if (response.success && response.data) {
        // Parse availability if it's a string
        let availability = (response.data as any).availability;
        if (typeof availability === 'string') {
          try {
            availability = JSON.parse(availability);
          } catch (e) {
            console.error('Failed to parse availability:', e);
            availability = undefined;
          }
        }
        
        // Merge the full details with the attraction
        setSelectedAttraction({
          ...attraction,
          availability: availability
        });
      } else {
        setSelectedAttraction(attraction);
      }
    } catch (error) {
      console.error('Error fetching attraction details:', error);
      setSelectedAttraction(attraction);
    }
    setShowAttractionModal(true);
  };

  const getImageUrl = (img?: string | null) => {
    if (!img) return '';
    // If already a full URL (http/https) or data URI, use as-is
    if (img.startsWith('http://') || img.startsWith('https://') || img.startsWith('data:')) {
      return img;
    }
    // If already starts with ASSET_URL, use as-is
    if (img.startsWith(ASSET_URL)) {
      return img;
    }
    // Otherwise prefix with ASSET_URL
    return ASSET_URL + img;
  };

  const handlePackageClick = async (pkg: PackageType) => {
    // Fetch full package details to get availability schedules
    try {
      const response = await customerService.getPackage(pkg.id);
      if (response.success && response.data) {
        // Parse availability_schedules if it's a string
        let availability_schedules = (response.data as any).availability_schedules;
        if (typeof availability_schedules === 'string') {
          try {
            availability_schedules = JSON.parse(availability_schedules);
          } catch (e) {
            console.error('Failed to parse availability_schedules:', e);
            availability_schedules = undefined;
          }
        }
        
        // Merge the full details with the package
        setSelectedPackage({
          ...pkg,
          availability_schedules: availability_schedules
        });
      } else {
        setSelectedPackage(pkg);
      }
    } catch (error) {
      console.error('Error fetching package details:', error);
      setSelectedPackage(pkg);
    }
    setShowPackageModal(true);
  };

  const handleBuyTickets = (attraction: Attraction) => {
    setSelectedAttraction(attraction);
    setActiveBookingType('attraction');
    setShowAttractionModal(false);
    setShowLocationModal(true);
  };

  const handleBookPackage = (pkg: PackageType) => {
    setSelectedPackage(pkg);
    setActiveBookingType('package');
    setShowPackageModal(false);
    setShowLocationModal(true);
  };

  const handleLocationSelect = (location: string) => {
    // Get the selected item (attraction or package)
    const bookingItem = activeBookingType === 'attraction' ? selectedAttraction : selectedPackage;
    if (!bookingItem) return;

    // Generate slug-based URL
    const locationSlug = generateLocationSlug(location);
    const itemSlug = generateSlug(bookingItem.name, bookingItem.id);
    
    if (activeBookingType === 'attraction') {
      const url = `${window.location.origin}/purchase/attraction/${locationSlug}/${itemSlug}`;
      window.open(url, '_blank');
    } else if (activeBookingType === 'package') {
      const url = `${window.location.origin}/book/package/${locationSlug}/${itemSlug}`;
      window.open(url, '_blank');
    }
  };

  // Helper function to format time in 12-hour format
  const formatTime = (time: string) => {
    if (!time) return '';
    return convertTo12Hour(time);
  };

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
        .animate-backdrop-fade {
          animation: backdrop-fade 0.2s ease-out;
        }
        .animate-scale-in {
          animation: scale-in 0.3s ease-out;
        }
        
        /* Hide scrollbar but keep functionality */
        .modal-scroll {
          scrollbar-width: none; /* Firefox */
          -ms-overflow-style: none; /* IE and Edge */
        }
        .modal-scroll::-webkit-scrollbar {
          display: none; /* Chrome, Safari, Opera */
        }
        
        /* Gradient indicator for more content - Modern & Minimal */
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
      `}</style>
      {/* Hero Section */}
      <section className="relative text-white py-12 md:py-24 lg:py-38 overflow-hidden pt-20 md:pt-24" style={{marginTop: '-4rem'}}>
        {/* Video Background (hidden on mobile) */}
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
          <div className="absolute inset-0 bg-gradient-to-r from-blue-800/80 to-violet-500/80 mix-blend-multiply"></div>
        </div>
        {/* Static Gradient Background for mobile */}
        <div className="block md:hidden absolute inset-0 z-0 bg-gradient-to-br from-blue-800 via-blue-700 to-violet-600"></div>
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="mb-6 md:mb-8">
            <div className="inline-flex items-center space-x-2 bg-white/10 backdrop-blur-sm px-3 py-1.5 md:px-4 md:py-2 rounded-full mb-4 md:mb-6">
              <Zap className="w-4 h-4 md:w-5 md:h-5 text-yellow-300" />
              <span className="text-xs md:text-sm font-medium">Premium Entertainment Experience</span>
            </div>
            
            <p className="text-3xl sm:text-4xl md:text-5xl lg:text-7xl font-bold mb-4 md:mb-6 text-white">
              Unleash the Fun at ZapZone!
            </p>
            <p className="text-sm sm:text-base md:text-lg lg:text-xl mb-6 md:mb-10 text-blue-50 max-w-4xl mx-auto leading-relaxed px-2">
              Discover thrilling attractions and amazing packages across all our locations. 
              From laser tag adventures to unforgettable celebrations - your next adventure awaits!
            </p>
          </div>
          
          {/* Enhanced Search Bar */}
          <div className="max-w-3xl mx-auto px-2">
            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-white/20 to-violet-300/20 rounded-lg blur opacity-75 group-hover:opacity-100 transition duration-1000"></div>
              <div className="relative">
                <Search className="absolute left-3 md:left-6 top-1/2 transform -translate-y-1/2 text-blue-800" size={18} />
                <input
                  type="text"
                  placeholder="Search attractions or packages..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 md:pl-16 pr-20 md:pr-24 py-3 md:py-5 text-sm md:text-lg text-gray-900 bg-white/95 backdrop-blur-sm rounded-lg border-0 focus:outline-none focus:ring-4 focus:ring-white/30 shadow-2xl placeholder-gray-500"
                />
                <div className="absolute right-2 md:right-4 top-1/2 transform -translate-y-1/2">
                  <div className="bg-blue-800 text-white px-3 py-1.5 md:px-4 md:py-2 rounded text-xs md:text-sm font-medium">
                    Search
                  </div>
                </div>
              </div>
            </div>
            
        
          </div>
        </div>
        
        {/* Floating Elements */}
        <div className="absolute bottom-0 left-0 w-full h-32 bg-gradient-to-t from-gray-50/20 to-transparent"></div>
      </section>

      {/* Unified Filter Bar */}
      <section className="bg-white py-4 md:py-5 border-b border-gray-200 sticky top-16 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            {/* Location Filter */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-gray-500">
                <MapPin size={14} />
                <span className="text-xs font-medium uppercase tracking-wider">Location:</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {locations.map(location => (
                  <button
                    key={location}
                    onClick={() => setSelectedLocation(location)}
                    className={`px-2.5 py-1 text-xs font-medium transition-all duration-200 ${
                      selectedLocation === location
                        ? 'bg-gray-900 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {location === 'All Locations' ? 'All' : location}
                  </button>
                ))}
              </div>
            </div>

            {/* Type Filter */}
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Show:</span>
              <div className="inline-flex border border-gray-300 overflow-hidden">
                <button
                  onClick={() => setActiveFilter('all')}
                  className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition-all duration-200 ${activeFilter === 'all' ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                >
                  All
                </button>
                <button
                  onClick={() => setActiveFilter('packages')}
                  className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition-all duration-200 border-l border-gray-300 flex items-center gap-1 ${activeFilter === 'packages' ? 'bg-blue-800 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                >
                  <Package size={12} />
                  Packages
                </button>
                <button
                  onClick={() => setActiveFilter('attractions')}
                  className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition-all duration-200 border-l border-gray-300 flex items-center gap-1 ${activeFilter === 'attractions' ? 'bg-violet-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                >
                  <Ticket size={12} />
                  Attractions
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

        {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-12">
        {/* Loading State */}
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 md:h-16 md:w-16 border-b-4 border-blue-800"></div>
          </div>
        ) : (
          <>
        {/* Special Packages Section - Only show if there are special packages and filter allows */}
        {filteredSpecialPackages.length > 0 && (activeFilter === 'all' || activeFilter === 'packages') && (
          <section className="mb-10 md:mb-16">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 md:mb-10 gap-2">
              <h2 className="text-xl md:text-3xl font-bold text-gray-900 flex items-center gap-2 md:gap-3" id="special-packages">
                <Sparkles className="w-6 h-6 md:w-8 md:h-8 text-gray-900" />
                Featured Specials
              </h2>
              <p className="text-gray-500 text-xs md:text-sm uppercase tracking-wider font-medium">
                Limited Time Offers
              </p>
            </div>

            <div className={`grid gap-0 ${filteredSpecialPackages.length === 1 ? 'grid-cols-1 max-w-2xl mx-auto' : 'grid-cols-1 md:grid-cols-2'}`}>
              {filteredSpecialPackages.slice(0, 2).map(pkg => {
                // Get display config for package type
                const typeConfig: Record<string, { label: string; bgColor: string; textColor: string }> = {
                  holiday: { label: 'HOLIDAY', bgColor: 'bg-gray-900', textColor: 'text-white' },
                  special: { label: 'SPECIAL', bgColor: 'bg-gray-900', textColor: 'text-white' },
                  seasonal: { label: 'SEASONAL', bgColor: 'bg-gray-900', textColor: 'text-white' },
                  custom: { label: 'EXCLUSIVE', bgColor: 'bg-gray-900', textColor: 'text-white' },
                };
                const config = typeConfig[pkg.package_type || 'custom'] || typeConfig.custom;
                
                return (
                  <div 
                    key={pkg.id} 
                    onClick={() => handlePackageClick(pkg)}
                    className="relative bg-white border-2 border-gray-900 hover:bg-gray-50 transition-all duration-200 cursor-pointer overflow-hidden group"
                  >
                    <div className="flex flex-col md:flex-row">
                      {/* Image Section */}
                      <div className="h-48 md:h-auto md:w-2/5 bg-gray-200 relative">
                        {pkg.image ? (
                          <img 
                            src={getImageUrl(pkg.image)} 
                            alt={pkg.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-gray-900 flex items-center justify-center text-white text-lg font-bold">
                            {pkg.name}
                          </div>
                        )}
                        {/* Type Badge */}
                        <div className={`absolute top-0 left-0 ${config.bgColor} ${config.textColor} px-3 py-1.5 md:px-4 md:py-2 text-xs md:text-sm font-bold tracking-wider`}>
                          {config.label}
                        </div>
                      </div>
                      
                      {/* Content Section */}
                      <div className="flex-1 p-5 md:p-6 flex flex-col justify-between">
                        <div>
                          <h3 className="text-lg md:text-xl font-bold text-gray-900 mb-2 uppercase tracking-wide">
                            {pkg.name}
                          </h3>
                          <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                            {pkg.description}
                          </p>
                          
                          <div className="flex items-center gap-4 text-xs text-gray-500 mb-4 border-t border-gray-200 pt-4">
                            <div className="flex items-center gap-1.5">
                              <Clock size={14} />
                              <span>{pkg.duration}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Users size={14} />
                              <span>{pkg.participants}</span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-2xl md:text-3xl font-bold text-gray-900">
                              ${pkg.price}
                            </span>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleBookPackage(pkg);
                            }}
                            className="bg-gray-900 hover:bg-gray-800 text-white px-5 py-2.5 md:px-6 md:py-3 font-bold uppercase text-xs md:text-sm tracking-wider transition flex items-center gap-2 group-hover:bg-blue-800"
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

        {/* Packages Section */}
        {(activeFilter === 'all' || activeFilter === 'packages') && (
          <section className="mb-10 md:mb-16">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4 md:mb-8 gap-2" id="packages">
              <h2 className="text-xl md:text-3xl font-bold text-gray-900 flex items-center gap-2 md:gap-3">
                <Package className="w-6 h-6 md:w-8 md:h-8 text-blue-800" />
                Experience Packages
              </h2>
              <p className="text-gray-600 text-xs md:text-base">
                {filteredPackages.length} packages available
              </p>
            </div>

            {filteredPackages.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500 text-sm md:text-lg">No packages found matching your criteria.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                {filteredPackages.map(pkg => (
                  <div 
                    key={pkg.id} 
                    onClick={() => handlePackageClick(pkg)}
                    className="bg-white border border-gray-200 hover:shadow-lg transition-all duration-300 cursor-pointer overflow-hidden transform hover:scale-105"
                  >
                    <div className="h-48 bg-gray-200 relative">
                      {pkg.image ? (
                        <img 
                          src={getImageUrl(pkg.image)} 
                          alt={pkg.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-blue-800 to-violet-500 flex items-center justify-center text-white text-lg font-semibold">
                          {pkg.name}
                        </div>
                      )}
                    </div>
                    
                    <div className="p-4 md:p-6">
                      <h3 className="text-lg md:text-xl font-bold text-gray-900 mb-2">
                        {pkg.name}
                      </h3>
                      <p className="text-sm md:text-base text-gray-600 mb-4 line-clamp-2">
                        {pkg.description}
                      </p>
                      
                      <div className="space-y-2 mb-4">
                        {pkg.includes.slice(0, 3).map((item: string, index: number) => (
                          <div key={index} className="flex items-center text-xs md:text-sm text-gray-600">
                            <div className="w-1.5 h-1.5 md:w-2 md:h-2 bg-green-500 rounded-full mr-2 md:mr-3 flex-shrink-0"></div>
                            <span className="line-clamp-1">{item}</span>
                          </div>
                        ))}
                      </div>
                      
                      <div className="flex items-center justify-between text-xs md:text-sm text-gray-500 mb-4">
                        <div className="flex items-center gap-1">
                          <Clock size={14} />
                          <span className="truncate">{pkg.duration}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Users size={14} />
                          <span className="truncate">{pkg.participants}</span>
                        </div>
                      </div>
                      
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div>
                          <span className="text-xl md:text-2xl font-bold text-gray-900">
                            ${pkg.price}
                          </span>
                          <span className="text-gray-500 text-xs md:text-sm ml-1">package</span>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleBookPackage(pkg);
                          }}
                          className="bg-blue-800 hover:bg-blue-900 text-white px-4 py-2 md:px-6 md:py-2 font-semibold transition flex items-center justify-center gap-2 text-sm md:text-base"
                        >
                          <Calendar size={16} />
                          Book Now
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Attractions Section */}
        {(activeFilter === 'all' || activeFilter === 'attractions') && (
          <section className="mb-10 md:mb-16">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4 md:mb-8 gap-2">
              <h2 className="text-xl md:text-3xl font-bold text-gray-900 flex items-center gap-2 md:gap-3" id="attractions">
                <Ticket className="w-6 h-6 md:w-8 md:h-8 text-violet-500" />
                Individual Attractions
              </h2>
              <p className="text-gray-600 text-xs md:text-base">
                {filteredAttractions.length} attractions available
              </p>
            </div>

            {filteredAttractions.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500 text-sm md:text-lg">No attractions found matching your criteria.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                {filteredAttractions.map(attraction => (
                  <div 
                    key={attraction.id} 
                    onClick={() => handleAttractionClick(attraction)}
                    className="bg-white border border-gray-200 hover:shadow-lg transition-all duration-300 cursor-pointer overflow-hidden transform hover:scale-105"
                  >
                    <div className="h-48 bg-gray-200 relative">
                      {attraction.image ? (
                        <img 
                          src={getImageUrl(attraction.image)} 
                          alt={attraction.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-violet-500 to-blue-800 flex items-center justify-center text-white text-lg font-semibold">
                          {attraction.name}
                        </div>
                      )}
                    </div>
                    
                    <div className="p-4 md:p-6">
                      <h3 className="text-lg md:text-xl font-bold text-gray-900 mb-2">
                        {attraction.name}
                      </h3>
                      <p className="text-sm md:text-base text-gray-600 mb-4 line-clamp-2">
                        {attraction.description}
                      </p>
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div>
                          <span className="text-xl md:text-2xl font-bold text-gray-900">
                            ${attraction.price}
                          </span>
                          <span className="text-gray-500 text-xs md:text-sm ml-1">per person</span>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleBuyTickets(attraction);
                          }}
                          className="bg-violet-500 hover:bg-violet-600 text-white px-4 py-2 md:px-6 md:py-2 font-semibold transition flex items-center justify-center gap-2 text-sm md:text-base"
                        >
                          <Ticket size={16} />
                          Buy Tickets
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
          </>
        )}
      </main>

      {/* Attraction Details Modal */}
      {showAttractionModal && selectedAttraction && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-3 md:p-4 z-50 animate-backdrop-fade" onClick={() => setShowAttractionModal(false)}>
          <div 
            className="bg-white max-w-md w-full max-h-[85vh] md:max-h-[80vh] overflow-y-auto modal-scroll shadow-2xl animate-scale-in relative scroll-indicator" 
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
            {/* Modal Header */}
            <div className="sticky top-0 z-10">
              <div className="relative h-24 md:h-28 bg-gradient-to-br from-violet-500 to-blue-800">
                <button
                  type="button"
                  onClick={() => setShowAttractionModal(false)}
                  className="absolute top-2 right-2 md:top-3 md:right-3 p-1.5 bg-white hover:bg-gray-100 text-gray-900 transition-all shadow-lg z-20 rounded-full cursor-pointer"
                >
                  <X size={14} className="md:w-4 md:h-4" />
                </button>
                <div className="absolute inset-0 flex items-center justify-center px-4">
                  <p className="text-lg md:text-2xl font-bold text-center line-clamp-2 text-white">{selectedAttraction.name}</p>
                </div>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-4">
              {/* Price & Duration */}
              <div className="flex items-center justify-between gap-3 mb-4 pb-4 border-b">
                <div className="flex items-center gap-2">
                  <DollarSign className="text-green-600" size={20} />
                  <div>
                    <div className="text-xl md:text-2xl font-bold text-gray-900">${selectedAttraction.price}</div>
                    <div className="text-xs text-gray-500">per person</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <Clock size={16} />
                  <div className="text-right">
                    <div className="text-sm font-semibold">{selectedAttraction.duration || 'Unlimited'}</div>
                    <div className="text-xs text-gray-500">Duration</div>
                  </div>
                </div>
              </div>

              {/* Description */}
              <div className="mb-4">
                <h3 className="text-sm font-bold text-gray-900 mb-1.5">About</h3>
                <p className="text-xs md:text-sm text-gray-600 leading-relaxed">{selectedAttraction.description}</p>
              </div>

              {/* Details Grid */}
              <div className="grid grid-cols-2 gap-2 mb-4">
                <div className="bg-gray-50 p-2.5">
                  <div className="flex items-center gap-1.5 text-gray-500 mb-0.5">
                    <Users size={12} />
                    <span className="text-xs">Capacity</span>
                  </div>
                  <div className="text-sm font-bold text-gray-900">{selectedAttraction.capacity} people</div>
                </div>
                <div className="bg-gray-50 p-2.5">
                  <div className="flex items-center gap-1.5 text-gray-500 mb-0.5">
                    <Ticket size={12} />
                    <span className="text-xs">Category</span>
                  </div>
                  <div className="text-sm font-bold text-gray-900 capitalize">{selectedAttraction.category}</div>
                </div>
              </div>

              {/* Availability Schedule */}
              <div className="mb-4">
                <h3 className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-1.5">
                  <Calendar size={14} className="text-blue-800" />
                  Availability
                </h3>
                {selectedAttraction.availability && Array.isArray(selectedAttraction.availability) && selectedAttraction.availability.length > 0 ? (
                  <div className="space-y-1.5">
                    {selectedAttraction.availability.map((schedule, index) => (
                      schedule.days && Array.isArray(schedule.days) && schedule.days.length > 0 ? (
                        <div key={index} className="bg-blue-50 border border-blue-200 p-2.5">
                          <div className="flex flex-wrap gap-1 mb-1.5">
                            {schedule.days.map((day) => (
                              <span key={day} className="px-1.5 py-0.5 bg-blue-800 text-white text-xs font-medium capitalize">
                                {day.substring(0, 3)}
                              </span>
                            ))}
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-gray-700">
                            <Clock size={12} className="text-blue-600" />
                            <span className="font-medium">
                              {formatTime(schedule.start_time)} - {formatTime(schedule.end_time)}
                            </span>
                          </div>
                        </div>
                      ) : null
                    ))}
                  </div>
                ) : (
                  <div className="bg-gray-50 p-2.5">
                    <p className="text-xs text-gray-500">Contact location for availability details.</p>
                  </div>
                )}
              </div>

              {/* Available Locations */}
              <div className="mb-4">
                <h3 className="text-sm font-bold text-gray-900 mb-2">Locations</h3>
                <div className="flex flex-wrap gap-1.5">
                  {selectedAttraction.availableLocations.map((location) => (
                    <div key={location} className="flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 text-xs">
                      <MapPin size={10} />
                      <span>{location}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleBuyTickets(selectedAttraction);
                  }}
                  className="w-full py-2.5 bg-blue-800 text-white font-semibold text-sm hover:bg-blue-900 transition flex items-center justify-center gap-2"
                >
                  <Ticket size={16} />
                  Buy Tickets
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowAttractionModal(false);
                  }}
                  className="w-full py-2 border border-gray-300 text-gray-600 hover:bg-gray-50 transition text-sm"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Package Details Modal */}
      {showPackageModal && selectedPackage && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-3 md:p-4 z-50 animate-backdrop-fade" onClick={() => setShowPackageModal(false)}>
          <div 
            className="bg-white max-w-md w-full max-h-[85vh] md:max-h-[80vh] overflow-y-auto modal-scroll shadow-2xl animate-scale-in relative scroll-indicator" 
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
            {/* Modal Header */}
            <div className="sticky top-0 z-10">
              <div className="relative h-24 md:h-28 bg-gradient-to-br from-blue-800 to-violet-500">
                <button
                  type="button"
                  onClick={() => setShowPackageModal(false)}
                  className="absolute top-2 right-2 md:top-3 md:right-3 p-1.5 bg-white hover:bg-gray-100 text-gray-900 transition-all shadow-lg z-20 rounded-full cursor-pointer"
                >
                  <X size={14} className="md:w-4 md:h-4" />
                </button>
                <div className="absolute inset-0 flex items-center justify-center px-4">
                  <p className="text-lg md:text-2xl font-bold text-center line-clamp-2 text-white">{selectedPackage.name}</p>
                </div>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-4">
              {/* Price & Duration */}
              <div className="flex items-center justify-between gap-3 mb-4 pb-4 border-b">
                <div className="flex items-center gap-2">
                  <DollarSign className="text-green-600" size={20} />
                  <div>
                    <div className="text-xl md:text-2xl font-bold text-gray-900">${selectedPackage.price}</div>
                    <div className="text-xs text-gray-500">package</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <Clock size={16} />
                  <div className="text-right">
                    <div className="text-sm font-semibold">{selectedPackage.duration}</div>
                    <div className="text-xs text-gray-500">Duration</div>
                  </div>
                </div>
              </div>

              {/* Description */}
              <div className="mb-4">
                <h3 className="text-sm font-bold text-gray-900 mb-1.5">About</h3>
                <p className="text-xs md:text-sm text-gray-600 leading-relaxed">{selectedPackage.description}</p>
              </div>

              {/* Details Grid */}
              <div className="grid grid-cols-1 gap-2 mb-4">
                <div className="bg-gray-50 p-2.5">
                  <div className="flex items-center gap-1.5 text-gray-500 mb-0.5">
                    <Users size={12} />
                    <span className="text-xs">Group Size</span>
                  </div>
                  <div className="text-sm font-bold text-gray-900">{selectedPackage.participants}</div>
                  {selectedPackage.price_per_additional && selectedPackage.price_per_additional > 0 && (
                    <div className="text-xs text-gray-600 mt-1">
                      +${selectedPackage.price_per_additional} per additional guest
                    </div>
                  )}
                </div>
              </div>

              {/* What's Included */}
              {selectedPackage.includes.length > 0 && (
                <div className="mb-4">
                  <h3 className="text-sm font-bold text-gray-900 mb-2">Included</h3>
                  <div className="space-y-1">
                    {selectedPackage.includes.map((item, index) => (
                      <div key={index} className="flex items-center gap-1.5 text-xs text-gray-600">
                        <CheckCircle className="text-green-500 flex-shrink-0" size={12} />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Availability Schedule */}
              <div className="mb-4">
                <h3 className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-1.5">
                  <Calendar size={14} className="text-blue-800" />
                  Availability
                </h3>
                {selectedPackage.availability_schedules && Array.isArray(selectedPackage.availability_schedules) && selectedPackage.availability_schedules.length > 0 ? (
                  <div className="space-y-1.5">
                    {selectedPackage.availability_schedules.map((schedule, index) => (
                      schedule.day_configuration && Array.isArray(schedule.day_configuration) && schedule.day_configuration.length > 0 ? (
                        <div key={index} className="bg-blue-50 border border-blue-200 p-2.5">
                          <div className="flex flex-wrap gap-1 mb-1.5">
                            {schedule.day_configuration.map((day) => (
                              <span key={day} className="px-1.5 py-0.5 bg-blue-800 text-white text-xs font-medium capitalize">
                                {day.substring(0, 3)}
                              </span>
                            ))}
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-gray-700">
                            <Clock size={12} className="text-blue-600" />
                            <span className="font-medium">
                              {formatTime(schedule.time_slot_start)} - {formatTime(schedule.time_slot_end)}
                            </span>
                          </div>
                        </div>
                      ) : null
                    ))}
                  </div>
                ) : (
                  <div className="bg-gray-50 p-2.5">
                    <p className="text-xs text-gray-500">Contact location for availability details.</p>
                  </div>
                )}
              </div>

              {/* Available Locations */}
              <div className="mb-4">
                <h3 className="text-sm font-bold text-gray-900 mb-2">Locations</h3>
                <div className="flex flex-wrap gap-1.5">
                  {selectedPackage.availableLocations.map((location) => (
                    <div key={location} className="flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 text-xs">
                      <MapPin size={10} />
                      <span>{location}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleBookPackage(selectedPackage);
                  }}
                  className="w-full py-2.5 bg-blue-800 text-white font-semibold text-sm hover:bg-blue-900 transition flex items-center justify-center gap-2"
                >
                  <Package size={16} />
                  Book This Package
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowPackageModal(false);
                  }}
                  className="w-full py-2 border border-gray-300 text-gray-600 hover:bg-gray-50 transition text-sm"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Location Selection Modal */}
      {showLocationModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-3 z-50 animate-backdrop-fade" onClick={() => setShowLocationModal(false)}>
          <div className="bg-white max-w-sm w-full shadow-2xl animate-scale-in max-h-[80vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b">
              <h3 className="text-lg font-bold text-gray-900 mb-1">
                Select Location
              </h3>
              <p className="text-xs text-gray-500">
                Choose location for {activeBookingType === 'attraction' ? selectedAttraction?.name : selectedPackage?.name}
              </p>
            </div>
            
            <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
              {locations.map(location => {
                const availableLocations = activeBookingType === 'attraction' 
                  ? selectedAttraction?.availableLocations 
                  : selectedPackage?.availableLocations;
                
                const isAvailable = availableLocations?.includes(location);
                
                return (
                  <button
                    key={location}
                    onClick={() => isAvailable && handleLocationSelect(location)}
                    disabled={!isAvailable}
                    className={`w-full p-2.5 text-left border transition ${
                      isAvailable 
                        ? 'border-gray-200 hover:border-blue-800 hover:bg-blue-50 cursor-pointer' 
                        : 'border-gray-100 bg-gray-50 cursor-not-allowed'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <MapPin size={14} className={isAvailable ? "text-blue-800" : "text-gray-400"} />
                        <span className={`text-sm ${isAvailable ? "text-gray-900 font-medium" : "text-gray-400"}`}>
                          {location}
                        </span>
                      </div>
                      {isAvailable ? (
                        <ChevronRight size={14} className="text-gray-400" />
                      ) : (
                        <span className="text-xs text-gray-400">Unavailable</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
            
            <div className="p-3 border-t">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowLocationModal(false);
                }}
                className="w-full py-2 border border-gray-300 text-gray-600 hover:bg-gray-50 transition text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-blue-900 text-white py-12 md:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 md:gap-10 mb-10 md:mb-12">
            {/* Company Info */}
            <div className="lg:col-span-1 text-center md:text-left">
              <a href="https://bestingames.com/ypsilanti/" target="_blank" rel="noopener noreferrer" className="inline-block">
                <img src="\Zap-Zone.png" alt="Zap Zone Logo" className="w-40 md:w-48 mb-4 md:mb-5 hover:opacity-80 transition"/>
              </a>
              <p className="text-sm md:text-base text-blue-200 leading-relaxed mb-4">
                The Longest Laser Tag Marathon and The Largest Laser Tag Winner Stays on Tournament
              </p>
              <div className="flex space-x-4 mb-6 justify-center md:justify-start">
                <a href="https://www.facebook.com/ZapZoneOffices" target="_blank" rel="noopener noreferrer" 
                   className="w-10 h-10 bg-blue-800 rounded-full flex items-center justify-center hover:bg-blue-700 transition">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                  </svg>
                </a>
                <a href="https://www.instagram.com/zap__zone/" target="_blank" rel="noopener noreferrer" 
                   className="w-10 h-10 bg-blue-800 rounded-full flex items-center justify-center hover:bg-blue-700 transition">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                  </svg>
                </a>
              </div>
            </div>
            
            {/* Locations */}
            <div className="md:col-span-2 lg:ps-20 text-center md:text-left">
              <p className="font-bold mb-4 md:mb-5 text-white text-base md:text-lg uppercase tracking-wider">Locations</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-sm md:text-base text-blue-200">
                <a href="https://bowlerolanesbc.com/" target="_blank" rel="noopener noreferrer" className="block hover:text-white transition-colors duration-200">Battle Creek</a>
                <a href="https://brighton.zap-zone.com/" target="_blank" rel="noopener noreferrer" className="block hover:text-white transition-colors duration-200">Brighton</a>
                <a href="https://canton.zap-zone.com/" target="_blank" rel="noopener noreferrer" className="block hover:text-white transition-colors duration-200">Canton</a>
                <a href="https://farmington.zap-zone.com/" target="_blank" rel="noopener noreferrer" className="block hover:text-white transition-colors duration-200">Farmington</a>
                <a href="https://zapzonexl.com/" target="_blank" rel="noopener noreferrer" className="block hover:text-white transition-colors duration-200">Lansing</a>
                <a href="https://bestingames.com/sterlingheights/" target="_blank" rel="noopener noreferrer" className="block hover:text-white transition-colors duration-200">Sterling Heights</a>
                <a href="https://taylor.zap-zone.com/" target="_blank" rel="noopener noreferrer" className="block hover:text-white transition-colors duration-200">Taylor</a>
                <a href="https://bestingames.com/warren/" target="_blank" rel="noopener noreferrer" className="block hover:text-white transition-colors duration-200">Warren</a>
                <a href="https://waterford.zap-zone.com/" target="_blank" rel="noopener noreferrer" className="block hover:text-white transition-colors duration-200">Waterford</a>
                <a href="https://bestingames.com/ypsilanti/" target="_blank" rel="noopener noreferrer" className="block hover:text-white transition-colors duration-200">Ypsilanti</a>
              </div>
            </div>
            
            {/* Support */}
            <div className="text-center md:text-left">
              <p className="font-bold mb-4 md:mb-5 text-white text-base md:text-lg uppercase tracking-wider">Support</p>
              <div className="space-y-2.5 text-sm md:text-base text-blue-200 mb-6">
                <a href="https://zap-zone.com/contact-us/" target="_blank" rel="noopener noreferrer" className="block hover:text-white transition-colors duration-200">Contact Us</a>
                <a href="https://zap-zone.com/eventcoordinator/" target="_blank" rel="noopener noreferrer" className="block hover:text-white transition-colors duration-200">Event Coordinator</a>
                <a href="https://zap-zone.com/corporate/" target="_blank" rel="noopener noreferrer" className="block hover:text-white transition-colors duration-200">Corporate</a>
                <a href="https://zap-zone.com/#" target="_blank" rel="noopener noreferrer" className="block hover:text-white transition-colors duration-200">Careers</a>
                <a href="https://zap-zone.com/#" target="_blank" rel="noopener noreferrer" className="block hover:text-white transition-colors duration-200">Donations</a>
                <a href="https://zap-zone.com/gift-cards/" target="_blank" rel="noopener noreferrer" className="block hover:text-white transition-colors duration-200">Gift Cards</a>
                <a href="https://zap-zone.com/#" target="_blank" rel="noopener noreferrer" className="block hover:text-white transition-colors duration-200">Invitations</a>
              </div>
            </div>
          </div>
          
          {/* Bottom Bar */}
          <div className="border-t border-blue-800 pt-8">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              <p className="text-blue-200 text-sm text-center md:text-left">
                &copy; {new Date().getFullYear()} Zone Entertainment LLC. All Rights Reserved.
              </p>
              <div className="flex flex-wrap justify-center md:justify-end text-sm text-blue-200">
                <a href="https://zap-zone.com/terms-conditions/" target="_blank" rel="noopener noreferrer" className="hover:text-white transition">Terms & Conditions</a>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
};

export default EntertainmentLandingPage;