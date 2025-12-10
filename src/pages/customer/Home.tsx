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
  DollarSign
} from 'lucide-react';
import type { Attraction, Package as PackageType, BookingType } from '../../types/customer';
import { customerService, type GroupedAttraction, type GroupedPackage } from '../../services/CustomerService';
import { ASSET_URL } from '../../utils/storage';
import { generateSlug, generateLocationSlug } from '../../utils/slug';

const EntertainmentLandingPage = () => {
  const [selectedLocation, setSelectedLocation] = useState('All Locations');
  const [searchQuery, setSearchQuery] = useState('');
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
  }, []);

  // Reload data when search changes (with debounce)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      loadData();
    }, 500);
    return () => clearTimeout(timeoutId);
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
        const transformedAttractions: Attraction[] = attractionsResponse.data.map((attr: GroupedAttraction) => ({
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
          duration: `${attr.duration} ${attr.duration_unit}`,
          pricingType: attr.pricing_type,
          purchaseLinks: attr.purchase_links,
        }));
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
        const transformedPackages: PackageType[] = packagesResponse.data.map((pkg: GroupedPackage) => ({
          id: pkg.booking_links[0]?.package_id || 0,
          name: pkg.name,
          description: pkg.description,
          price: pkg.price,
          duration: `${pkg.duration} hours`,
          participants: `Up to ${pkg.max_guests} guests`,
          includes: [], // This would need to be added to backend if needed
          rating: 4.8, // Default rating, backend doesn't return this yet
          image: Array.isArray(pkg.image) ? pkg.image[0] : pkg.image,
          category: pkg.category,
          availableLocations: pkg.locations.map(loc => loc.location_name),
          bookingLinks: pkg.booking_links,
        }));
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

  const filteredPackages = packages.filter(pkg => {
    const matchesLocation = selectedLocation === 'All Locations' || 
      pkg.availableLocations.includes(selectedLocation);
    const matchesSearch = pkg.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pkg.description.toLowerCase().includes(searchQuery.toLowerCase());
    
    return matchesLocation && matchesSearch;
  });

  const handleAttractionClick = (attraction: Attraction) => {
    setSelectedAttraction(attraction);
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

  const handlePackageClick = (pkg: PackageType) => {
    setSelectedPackage(pkg);
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
      `}</style>
      {/* Hero Section */}
      <section className="relative text-white py-12 md:py-24 lg:py-38 overflow-hidden" style={{marginTop: '-4rem'}}>
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
            
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-7xl font-bold mb-4 md:mb-6 bg-gradient-to-r from-white to-blue-100 bg-clip-text text-transparent">
              Unleash the Fun at ZapZone!
            </h1>
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

      {/* Location Selector Only */}
      <section className="bg-white py-4 md:py-8 border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="space-y-3 md:space-y-6">
            <div className="space-y-2 md:space-y-3">
              <div className="flex flex-col gap-2">
                <h3 className="text-xs md:text-sm font-semibold text-gray-900 tracking-wide">Select Locations</h3>
              <div className="flex flex-wrap gap-1.5 md:gap-2">
                {locations.map(location => (
                  <button
                    key={location}
                    onClick={() => setSelectedLocation(location)}
                    className={`px-2.5 py-1.5 md:px-3 md:py-2 text-xs font-medium rounded transition-all duration-200 ${
                      selectedLocation === location
                        ? 'bg-blue-800 text-white shadow-sm'
                      : 'bg-gray-50 text-gray-700 hover:bg-gray-100 hover:text-gray-900 hover:shadow-md'
                    }`}
                  >
                    {location}
                  </button>
                ))}
              </div>
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
            {/* Location Info */}
            <div className="mb-6 md:mb-8 p-3 md:p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-start md:items-center space-x-2 text-yellow-800">
                <MapPin size={18} className="flex-shrink-0 mt-0.5 md:mt-0" />
                <span className="font-semibold text-xs md:text-sm">
                  {selectedLocation === 'All Locations' 
                    ? 'Showing attractions and packages from all locations' 
                    : `Showing attractions and packages available at ${selectedLocation}`}
                </span>
              </div>
            </div>        {/* Attractions Section */}
        <section className="mb-10 md:mb-16" >
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
                        className="bg-violet-500 hover:bg-violet-600 text-white px-4 py-2 md:px-6 md:py-2 rounded font-semibold transition flex items-center justify-center gap-2 text-sm md:text-base"
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

        {/* Packages Section */}
        <section>
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
                        className="bg-blue-800 hover:bg-blue-900 text-white px-4 py-2 md:px-6 md:py-2 rounded font-semibold transition flex items-center justify-center gap-2 text-sm md:text-base"
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
          </>
        )}
      </main>

      {/* Attraction Details Modal */}
      {showAttractionModal && selectedAttraction && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-3 md:p-4 z-50 animate-backdrop-fade" onClick={() => setShowAttractionModal(false)}>
          <div className="bg-white max-w-2xl w-full max-h-[85vh] md:max-h-[90vh] overflow-y-auto shadow-2xl animate-scale-in" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="sticky top-0 z-10">
              <div className="relative h-40 md:h-56 bg-gradient-to-br from-violet-500 to-blue-800">
                <button
                  type="button"
                  onClick={() => setShowAttractionModal(false)}
                  className="absolute top-3 right-3 md:top-4 md:right-4 p-2 md:p-2.5 bg-white hover:bg-gray-100 text-gray-900 transition-all shadow-lg z-20 rounded-full cursor-pointer"
                >
                  <X size={20} className="md:w-6 md:h-6" />
                </button>
                <div className="absolute inset-0 flex items-center justify-center px-4">
                  <div className="text-center">
                    <h2 className="text-2xl md:text-4xl font-bold text-white mb-2 line-clamp-2">{selectedAttraction.name}</h2>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-4 md:p-6 lg:p-8">
              {/* Price & Duration */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4 md:mb-6 pb-4 md:pb-6 border-b">
                <div className="flex items-center gap-2">
                  <DollarSign className="text-green-600" size={24} />
                  <div>
                    <div className="text-2xl md:text-3xl font-bold text-gray-900">${selectedAttraction.price}</div>
                    <div className="text-xs md:text-sm text-gray-500">per person</div>
                  </div>
                </div>
                {selectedAttraction.duration && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <Clock size={20} />
                    <div>
                      <div className="text-sm md:text-base font-semibold">{selectedAttraction.duration}</div>
                      <div className="text-xs md:text-sm text-gray-500">Duration</div>
                    </div>
                  </div>
                )}
              </div>

              {/* Description */}
              <div className="mb-4 md:mb-6">
                <h3 className="text-lg md:text-xl font-bold text-gray-900 mb-2 md:mb-3">About This Attraction</h3>
                <p className="text-sm md:text-base text-gray-700 leading-relaxed">{selectedAttraction.description}</p>
              </div>

              {/* Details Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 md:gap-4 mb-4 md:mb-6">
                <div className="bg-gray-50 p-3 md:p-4">
                  <div className="flex items-center gap-1.5 md:gap-2 text-gray-600 mb-1">
                    <Users size={16} className="md:w-[18px] md:h-[18px]" />
                    <span className="text-xs font-medium">Capacity</span>
                  </div>
                  <div className="text-base md:text-lg font-bold text-gray-900">{selectedAttraction.capacity}</div>
                  <div className="text-xs text-gray-500">people</div>
                </div>
               
                <div className="bg-gray-50 p-3 md:p-4 col-span-2 sm:col-span-1">
                  <div className="flex items-center gap-1.5 md:gap-2 text-gray-600 mb-1">
                    <Clock size={16} className="md:w-[18px] md:h-[18px]" />
                    <span className="text-xs font-medium">Duration</span>
                  </div>
                  <div className="text-base md:text-lg font-bold text-gray-900">{selectedAttraction.duration?.split(' ')[0]}</div>
                  <div className="text-xs text-gray-500">{selectedAttraction.duration?.split(' ')[1] || 'min'}</div>
                </div>
              </div>

              {/* Category & Pricing */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4 mb-4 md:mb-6">
                <div>
                  <h3 className="text-xs md:text-sm font-medium text-gray-600 mb-2">Category</h3>
                  <span className="inline-block px-3 py-1.5 md:px-4 md:py-2 bg-violet-100 text-violet-800 capitalize font-medium text-xs md:text-sm">
                    {selectedAttraction.category}
                  </span>
                </div>
                <div>
                  <h3 className="text-xs md:text-sm font-medium text-gray-600 mb-2">Pricing Type</h3>
                  <span className="inline-block px-3 py-1.5 md:px-4 md:py-2 bg-green-100 text-green-800 font-medium text-xs md:text-sm">
                    Per Person
                  </span>
                </div>
              </div>

              {/* Availability Schedule */}
              <div className="mb-4 md:mb-6 bg-blue-50 p-3 md:p-4">
                <h3 className="text-xs md:text-sm font-bold text-gray-900 mb-2 md:mb-3 flex items-center gap-2">
                  <Calendar size={16} className="text-blue-800 md:w-[18px] md:h-[18px]" />
                  Available Days
                </h3>
                <div className="flex flex-wrap gap-1.5 md:gap-2">
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
                    <span key={day} className="px-2 py-1 md:px-3 md:py-1 bg-blue-800 text-white text-xs md:text-sm font-medium">
                      {day}
                    </span>
                  ))}
                </div>
                <p className="text-xs text-gray-600 mt-2">Open all week</p>
              </div>

              {/* Available Locations */}
              <div className="mb-4 md:mb-6">
                <h3 className="text-base md:text-lg font-bold text-gray-900 mb-2 md:mb-3">Available Locations</h3>
                <div className="flex flex-wrap gap-2">
                  {selectedAttraction.availableLocations.map((location) => (
                    <div key={location} className="flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-800 border border-blue-200">
                      <MapPin size={16} />
                      <span className="font-medium">{location}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleBuyTickets(selectedAttraction);
                }}
                className="w-full py-4 bg-blue-800 text-white font-bold text-lg hover:bg-blue-900 transition flex items-center justify-center gap-2"
              >
                <Ticket size={24} />
                Buy Tickets
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Package Details Modal */}
      {showPackageModal && selectedPackage && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-3 md:p-4 z-50 animate-backdrop-fade" onClick={() => setShowPackageModal(false)}>
          <div className="bg-white max-w-2xl w-full max-h-[85vh] md:max-h-[90vh] overflow-y-auto shadow-2xl animate-scale-in" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="sticky top-0 z-10">
              <div className="relative h-40 md:h-56 bg-gradient-to-br from-blue-800 to-violet-500">
                <button
                  type="button"
                  onClick={() => setShowPackageModal(false)}
                  className="absolute top-3 right-3 md:top-4 md:right-4 p-2 md:p-2.5 bg-white hover:bg-gray-100 text-gray-900 transition-all shadow-lg z-20 rounded-full cursor-pointer"
                >
                  <X size={20} className="md:w-6 md:h-6" />
                </button>
                <div className="absolute inset-0 flex items-center justify-center px-4">
                  <div className="text-center">
                    <h2 className="text-2xl md:text-4xl font-bold text-white mb-2 line-clamp-2">{selectedPackage.name}</h2>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-4 md:p-6 lg:p-8">
              {/* Price & Duration */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4 md:mb-6 pb-4 md:pb-6 border-b">
                <div className="flex items-center gap-2">
                  <DollarSign className="text-green-600" size={24} />
                  <div>
                    <div className="text-2xl md:text-3xl font-bold text-gray-900">${selectedPackage.price}</div>
                    <div className="text-xs md:text-sm text-gray-500">total package price</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <Clock size={20} />
                  <div>
                    <div className="text-sm md:text-base font-semibold">{selectedPackage.duration}</div>
                    <div className="text-xs md:text-sm text-gray-500">Duration</div>
                  </div>
                </div>
              </div>

              {/* Description */}
              <div className="mb-4 md:mb-6">
                <h3 className="text-lg md:text-xl font-bold text-gray-900 mb-2 md:mb-3">Package Details</h3>
                <p className="text-sm md:text-base text-gray-700 leading-relaxed">{selectedPackage.description}</p>
              </div>

              {/* Participants & Pricing Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4 mb-4 md:mb-6">
                <div className="bg-gray-50 p-3 md:p-4">
                  <div className="flex items-center gap-1.5 md:gap-2 text-gray-600 mb-1">
                    <Users size={18} />
                    <span className="text-xs md:text-sm font-medium">Group Size</span>
                  </div>
                  <div className="text-base md:text-lg font-bold text-gray-900">{selectedPackage.participants}</div>
                  <div className="text-xs text-gray-500 mt-1">Max capacity</div>
                </div>
                <div className="bg-green-50 p-3 md:p-4 border border-green-200">
                  <div className="flex items-center gap-1.5 md:gap-2 text-green-700 mb-1">
                    <DollarSign size={18} />
                    <span className="text-xs md:text-sm font-medium">Per Person</span>
                  </div>
                  <div className="text-base md:text-lg font-bold text-green-900">
                    ${(selectedPackage.price / parseInt(selectedPackage.participants.match(/\d+/)?.[0] || '1')).toFixed(2)}
                  </div>
                  <div className="text-xs text-green-600 mt-1">Best value!</div>
                </div>
              </div>

              {/* What's Included */}
              <div className="mb-4 md:mb-6">
                <h3 className="text-base md:text-lg font-bold text-gray-900 mb-2 md:mb-3">What's Included</h3>
                <div className="grid grid-cols-1 gap-2 md:gap-3">
                  {selectedPackage.includes.map((item, index) => (
                    <div key={index} className="flex items-start gap-2 md:gap-3 bg-gray-50 p-2.5 md:p-3">
                      <CheckCircle className="text-green-600 flex-shrink-0 mt-0.5" size={16} />
                      <span className="text-gray-700 text-xs md:text-sm">{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Category & Package Type */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4 mb-4 md:mb-6">
                <div>
                  <h3 className="text-xs md:text-sm font-medium text-gray-600 mb-2">Category</h3>
                  <span className="inline-block px-3 py-1.5 md:px-4 md:py-2 bg-blue-100 text-blue-800 capitalize font-medium text-xs md:text-sm">
                    {selectedPackage.category}
                  </span>
                </div>
                <div>
                  <h3 className="text-xs md:text-sm font-medium text-gray-600 mb-2">Package Type</h3>
                  <span className="inline-block px-3 py-1.5 md:px-4 md:py-2 bg-purple-100 text-purple-800 font-medium text-xs md:text-sm">
                    All-Inclusive
                  </span>
                </div>
              </div>

              {/* Available Locations */}
              <div className="mb-4 md:mb-6">
                <h3 className="text-base md:text-lg font-bold text-gray-900 mb-2 md:mb-3">Available Locations</h3>
                <div className="flex flex-wrap gap-2">
                  {selectedPackage.availableLocations.map((location) => (
                    <div key={location} className="flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-800 border border-blue-200">
                      <MapPin size={16} />
                      <span className="font-medium">{location}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleBookPackage(selectedPackage);
                }}
                className="w-full py-4 bg-blue-800 text-white font-bold text-lg hover:bg-blue-900 transition flex items-center justify-center gap-2"
              >
                <Package size={24} />
                Book This Package
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Location Selection Modal */}
      {showLocationModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-3 md:p-4 z-50 animate-backdrop-fade" onClick={() => setShowLocationModal(false)}>
          <div className="bg-white max-w-md w-full shadow-2xl animate-scale-in max-h-[85vh] md:max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 md:p-6 border-b">
              <h3 className="text-xl md:text-2xl font-bold text-gray-900 mb-2">
                Select Location
              </h3>
              <p className="text-sm md:text-base text-gray-600">
                Choose your preferred location for {activeBookingType === 'attraction' ? selectedAttraction?.name : selectedPackage?.name}
              </p>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-2 md:space-y-3">
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
                    className={`w-full p-3 md:p-4 text-left border transition ${
                      isAvailable 
                        ? 'border-gray-300 hover:border-blue-800 hover:bg-blue-50 cursor-pointer' 
                        : 'border-gray-200 bg-gray-100 cursor-not-allowed'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2 md:space-x-3">
                        <MapPin size={18} className={isAvailable ? "text-blue-800" : "text-gray-400"} />
                        <span className={`text-sm md:text-base ${isAvailable ? "text-gray-900 font-medium" : "text-gray-500"}`}>
                          {location}
                        </span>
                      </div>
                      {isAvailable ? (
                        <ChevronRight size={18} className="text-gray-400" />
                      ) : (
                        <span className="text-xs md:text-sm text-gray-500">Not Available</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
            
            <div className="p-4 md:p-6 border-t">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowLocationModal(false);
                }}
                className="w-full px-4 py-2.5 md:py-3 border border-gray-300 text-gray-700 hover:bg-gray-50 transition font-semibold text-sm md:text-base"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-8 md:py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 md:gap-8">
            <div>
            <img src="\Zap-Zone.png" alt="Logo" className="w-2/5 md:w-3/5 mr-2 mb-4 md:mb-5"/>

              <p className="text-sm md:text-base text-gray-400">
                Creating unforgettable experiences through thrilling attractions and amazing entertainment packages.
              </p>
            </div>
            
            <div>
              <h4 className="font-semibold mb-3 md:mb-4 text-white text-sm md:text-base">Locations</h4>
              <div className="grid grid-cols-2 gap-2 text-xs md:text-sm text-gray-400">
                {locations.slice(0, 6).map(location => (
                  <div key={location}>{location}</div>
                ))}
              </div>
            </div>
            
            <div>
              <h4 className="font-semibold mb-3 md:mb-4 text-white text-sm md:text-base">Contact</h4>
              <div className="space-y-2 text-xs md:text-sm text-gray-400">
                <div>info@zapzone.com</div>
                <div>(555) 123-4567</div>
                <div>Mon-Sun: 9AM-11PM</div>
              </div>
            </div>
            
            <div>
              <h4 className="font-semibold mb-3 md:mb-4 text-white text-sm md:text-base">Follow Us</h4>
              <div className="flex space-x-3 md:space-x-4">
                <div className="w-8 h-8 md:w-10 md:h-10 bg-gray-800 rounded flex items-center justify-center hover:bg-gray-700 transition cursor-pointer">
                  <span className="text-white text-xs md:text-sm">FB</span>
                </div>
                <div className="w-8 h-8 md:w-10 md:h-10 bg-gray-800 rounded flex items-center justify-center hover:bg-gray-700 transition cursor-pointer">
                  <span className="text-white text-xs md:text-sm">IG</span>
                </div>
                <div className="w-8 h-8 md:w-10 md:h-10 bg-gray-800 rounded flex items-center justify-center hover:bg-gray-700 transition cursor-pointer">
                  <span className="text-white text-xs md:text-sm">TW</span>
                </div>
              </div>
            </div>
          </div>
          
          <div className="border-t border-gray-800 mt-6 md:mt-8 pt-6 md:pt-8 text-center text-gray-400 text-xs md:text-sm">
            &copy; {new Date().getFullYear()} ZapZone. All rights reserved.
          </div>
        </div>
      </footer>
    </>
  );
};

export default EntertainmentLandingPage;