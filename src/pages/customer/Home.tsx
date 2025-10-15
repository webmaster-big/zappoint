import { useState } from 'react';
import { 
  MapPin, 
  Calendar, 
  Users, 
  Clock, 
  Star, 
  Zap,
  Ticket,
  Package,
  Search,
  ChevronRight
} from 'lucide-react';
import type { Attraction, Package as PackageType, BookingType } from '../../types/customer';

const EntertainmentLandingPage = () => {
  const [selectedLocation, setSelectedLocation] = useState('All Locations');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAttraction, setSelectedAttraction] = useState<Attraction | null>(null);
  const [selectedPackage, setSelectedPackage] = useState<PackageType | null>(null);
  const [showLocationModal, setShowLocationModal] = useState(false);

  const [activeBookingType, setActiveBookingType] = useState<BookingType | null>(null);

  const locations = [
    'Brighton', 'Canton', 'Farmington', 'Lansing', 'Taylor', 
    'Waterford', 'Sterling Heights', 'Battle Creek', 'Ypsilanti', 'Escape Room Zone'
  ];

  // Sample attractions data
  const attractions: Attraction[] = [
    {
      id: 1,
      name: 'Laser Tag Arena',
      description: 'Experience thrilling team battles in our state-of-the-art laser tag arena with special effects.',
      price: 25,
      minAge: 8,
      capacity: 20,
      rating: 4.8,
      image: '/api/placeholder/400/250',
      category: 'adventure',
      availableLocations: ['Brighton', 'Canton', 'Sterling Heights', 'Battle Creek']
    },
    {
      id: 2,
      name: 'VR Experience Zone',
      description: 'Immerse yourself in virtual reality with cutting-edge technology and exciting games.',
      price: 35,
      minAge: 10,
      capacity: 8,
      rating: 4.9,
      image: '/api/placeholder/400/250',
      category: 'technology',
      availableLocations: ['Brighton', 'Farmington', 'Ypsilanti', 'Escape Room Zone']
    },
    {
      id: 3,
      name: 'Bowling Alley',
      description: 'Modern bowling lanes with automatic scoring, cosmic bowling, and premium service.',
      price: 20,
      minAge: 4,
      capacity: 6,
      rating: 4.6,
      image: '/api/placeholder/400/250',
      category: 'sports',
      availableLocations: ['Brighton', 'Lansing', 'Taylor', 'Waterford', 'Sterling Heights']
    },
    {
      id: 4,
      name: 'Escape Room Challenge',
      description: 'Solve puzzles and uncover mysteries in our themed escape rooms. Perfect for groups.',
      price: 30,
      duration: '60 minutes',
      minAge: 12,
      capacity: 6,
      rating: 4.7,
      image: '/api/placeholder/400/250',
      category: 'adventure',
      availableLocations: ['Escape Room Zone', 'Brighton', 'Canton', 'Ypsilanti']
    },
    {
      id: 5,
      name: 'Arcade Zone',
      description: 'Classic and modern arcade games with prize redemption center. Fun for all ages!',
      price: 15,
      minAge: 4,
      capacity: 50,
      rating: 4.5,
      image: '/api/placeholder/400/250',
      category: 'games',
      availableLocations: ['Brighton', 'Canton', 'Farmington', 'Lansing', 'Taylor', 'Waterford', 'Sterling Heights', 'Battle Creek', 'Ypsilanti']
    },
    {
      id: 6,
      name: 'Mini Golf Course',
      description: '18-hole indoor mini golf course with challenging obstacles and tropical theme.',
      price: 18,
      minAge: 5,
      capacity: 4,
      rating: 4.4,
      image: '/api/placeholder/400/250',
      category: 'sports',
      availableLocations: ['Brighton', 'Waterford', 'Battle Creek']
    }
  ];

  // Sample packages data
  const packages: PackageType[] = [
    {
      id: 1,
      name: 'Birthday Bash Package',
      description: 'The perfect birthday celebration! Includes 2 hours of unlimited attractions, private party room, and dedicated host.',
      price: 299,
      duration: '2 hours',
      participants: 'Up to 10 guests',
      includes: ['Unlimited Attractions', 'Private Party Room', 'Dedicated Host', 'Birthday Cake', 'Decorations'],
      rating: 4.9,
      image: '/api/placeholder/400/250',
      category: 'celebration',
      availableLocations: ['Brighton', 'Canton', 'Farmington', 'Lansing', 'Taylor', 'Waterford']
    },
    {
      id: 2,
      name: 'Corporate Team Building',
      description: 'Boost team morale with our corporate package. Includes team-building activities and meeting space.',
      price: 499,
      duration: '3 hours',
      participants: 'Up to 20 employees',
      includes: ['Team Building Activities', 'Meeting Space', 'Catering Options', 'Dedicated Coordinator'],
      rating: 4.8,
      image: '/api/placeholder/400/250',
      category: 'corporate',
      availableLocations: ['Brighton', 'Sterling Heights', 'Battle Creek', 'Ypsilanti']
    },
    {
      id: 3,
      name: 'Family Fun Package',
      description: 'Create lasting memories with our family package. Perfect for family outings with mixed attractions.',
      price: 149,
      duration: '2 hours',
      participants: 'Up to 6 family members',
      includes: ['Mixed Attractions', 'Meal Vouchers', 'Photo Package', 'Priority Access'],
      rating: 4.7,
      image: '/api/placeholder/400/250',
      category: 'family',
      availableLocations: ['Brighton', 'Canton', 'Farmington', 'Lansing', 'Taylor', 'Waterford', 'Sterling Heights', 'Battle Creek', 'Ypsilanti']
    },
    {
      id: 4,
      name: 'Adventure Seeker Package',
      description: 'For thrill-seekers! Includes access to all high-adrenaline attractions with extended play time.',
      price: 79,
      duration: '2.5 hours',
      participants: 'Individual or Group',
      includes: ['Laser Tag', 'VR Experience', 'Escape Room', 'Priority Booking'],
      rating: 4.6,
      image: '/api/placeholder/400/250',
      category: 'adventure',
      availableLocations: ['Brighton', 'Escape Room Zone', 'Battle Creek', 'Ypsilanti']
    },
    {
      id: 5,
      name: 'Date Night Special',
      description: 'Romantic evening package perfect for couples. Includes private bowling and arcade credits.',
      price: 89,
      duration: '2 hours',
      participants: '2 people',
      includes: ['Private Bowling', 'Arcade Credits', 'Dining Credit', 'Photo Memory'],
      rating: 4.8,
      image: '/api/placeholder/400/250',
      category: 'romance',
      availableLocations: ['Brighton', 'Canton', 'Farmington', 'Lansing', 'Sterling Heights']
    },
    {
      id: 6,
      name: 'Ultimate All-Access Pass',
      description: 'Experience everything we have to offer! Unlimited access to all attractions for the entire day.',
      price: 129,
      duration: 'Full Day',
      participants: 'Individual',
      includes: ['All Attractions', 'Unlimited Play', 'Food Discount', 'Express Lane'],
      rating: 4.9,
      image: '/api/placeholder/400/250',
      category: 'premium',
      availableLocations: ['Brighton', 'Canton', 'Farmington', 'Lansing', 'Taylor', 'Waterford', 'Sterling Heights', 'Battle Creek', 'Ypsilanti', 'Escape Room Zone']
    }
  ];


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

  const handleBuyTickets = (attraction: Attraction) => {
    setSelectedAttraction(attraction);
    setActiveBookingType('attraction');
    setShowLocationModal(true);
  };

  const handleBookPackage = (pkg: PackageType) => {
    setSelectedPackage(pkg);
    setActiveBookingType('package');
    setShowLocationModal(true);
  };

  const handleLocationSelect = (location: string) => {
    // Redirect to booking page with selected location and item
    const bookingItem = activeBookingType === 'attraction' ? selectedAttraction : selectedPackage;
    const type = activeBookingType === 'attraction' ? 'attraction' : 'package';
    
    // Store in localStorage for the booking page to access
    localStorage.setItem('bookingData', JSON.stringify({
      type,
      item: bookingItem,
      location,
      timestamp: new Date().toISOString()
    }));

    // Redirect to booking page
    window.location.href = '/booking';
  };

  return (
    <>
      {/* Hero Section */}
      <section className="relative text-white py-38 overflow-hidden" style={{marginTop: '-4rem'}}>
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
          <div className="mb-8">
            <div className="inline-flex items-center space-x-2 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full mb-6">
              <Zap className="w-5 h-5 text-yellow-300" />
              <span className="text-sm font-medium">Premium Entertainment Experience</span>
            </div>
            
            <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-white to-blue-100 bg-clip-text text-transparent">
              Unleash the Fun at ZapZone!
            </h1>
            <p className="text-lg md:text-xl mb-10 text-blue-50 max-w-4xl mx-auto leading-relaxed">
              Discover thrilling attractions and amazing packages across all our locations. 
              From laser tag adventures to unforgettable celebrations - your next adventure awaits!
            </p>
          </div>
          
          {/* Enhanced Search Bar */}
          <div className="max-w-3xl mx-auto">
            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-white/20 to-violet-300/20  blur opacity-75 group-hover:opacity-100 transition duration-1000"></div>
              <div className="relative">
                <Search className="absolute left-6 top-1/2 transform -translate-y-1/2 text-blue-800" size={22} />
                <input
                  type="text"
                  placeholder="Search attractions, or packages..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-16 pr-6 py-5 text-lg text-gray-900 bg-white/95 backdrop-blur-sm  border-0 focus:outline-none focus:ring-4 focus:ring-white/30 shadow-2xl placeholder-gray-500"
                />
                <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
                  <div className="bg-blue-800 text-white px-4 py-2  text-sm font-medium">
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
      <section className="bg-white py-8 border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="space-y-6">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-gray-900 tracking-wide">Select Locations</h3>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setSelectedLocation('All Locations')}
                  className={`px-3 py-2 text-xs font-medium transition-all duration-200 ${
                    selectedLocation === 'All Locations'
                        ? 'bg-blue-800 text-white shadow-sm'
                      : 'bg-gray-50 text-gray-700 hover:bg-gray-100 hover:text-gray-900 hover:shadow-md'
                  }`}
                >
                  All Locations
                </button>
                {locations.map(location => (
                  <button
                    key={location}
                    onClick={() => setSelectedLocation(location)}
                    className={`px-3 py-2 text-xs font-medium transition-all duration-200 ${
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
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Location Info */}
        <div className="mb-8 p-4 bg-yellow-50 border border-yellow-200">
          <div className="flex items-center space-x-2 text-yellow-800">
            <MapPin size={20} />
            <span className="font-semibold">
              {selectedLocation === 'All Locations' 
                ? 'Showing attractions and packages from all locations' 
                : `Showing attractions and packages available at ${selectedLocation}`}
            </span>
          </div>
        </div>

        {/* Attractions Section */}
        <section className="mb-16" >
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-3xl font-bold text-gray-900 flex items-center gap-3" id="attractions">
              <Ticket className="w-8 h-8 text-violet-500" />
              Individual Attractions
            </h2>
            <p className="text-gray-600">
              {filteredAttractions.length} attractions available
            </p>
          </div>

          {filteredAttractions.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 text-lg">No attractions found matching your criteria.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredAttractions.map(attraction => (
                <div key={attraction.id} className="bg-white border border-gray-200 hover:shadow-md transition-shadow overflow-hidden">
                  <div className="h-48 bg-gray-200 relative">
                    <div className="w-full h-full bg-gradient-to-br from-violet-500 to-blue-800 flex items-center justify-center text-white text-lg font-semibold">
                      {attraction.name}
                    </div>
                    <div className="absolute top-3 right-3 bg-yellow-300 text-gray-900 px-3 py-1 font-semibold flex items-center gap-1">
                      <Star size={14} className="fill-current" />
                      {attraction.rating}
                    </div>
                  </div>
                  
                  <div className="p-6">
                    <h3 className="text-xl font-bold text-gray-900 mb-2">
                      {attraction.name}
                    </h3>
                    <p className="text-gray-600 mb-4 line-clamp-2">
                      {attraction.description}
                    </p>
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-2xl font-bold text-gray-900">
                          ${attraction.price}
                        </span>
                        <span className="text-gray-500 text-sm ml-1">per person</span>
                      </div>
                      <button
                        onClick={() => handleBuyTickets(attraction)}
                        className="bg-violet-500 hover:bg-violet-600 text-white px-6 py-2 font-semibold transition flex items-center gap-2"
                      >
                        <Ticket size={18} />
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
          <div className="flex items-center justify-between mb-8" id="packages">
            <h2 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <Package className="w-8 h-8 text-blue-800" />
              Experience Packages
            </h2>
            <p className="text-gray-600">
              {filteredPackages.length} packages available
            </p>
          </div>

          {filteredPackages.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 text-lg">No packages found matching your criteria.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredPackages.map(pkg => (
                <div key={pkg.id} className="bg-white border border-gray-200 hover:shadow-md transition-shadow overflow-hidden">
                  <div className="h-48 bg-gray-200 relative">
                    <div className="w-full h-full bg-gradient-to-br from-blue-800 to-violet-500 flex items-center justify-center text-white text-lg font-semibold">
                      {pkg.name}
                    </div>
                    <div className="absolute top-3 right-3 bg-yellow-300 text-gray-900 px-3 py-1 font-semibold flex items-center gap-1">
                      <Star size={14} className="fill-current" />
                      {pkg.rating}
                    </div>
                  </div>
                  
                  <div className="p-6">
                    <h3 className="text-xl font-bold text-gray-900 mb-2">
                      {pkg.name}
                    </h3>
                    <p className="text-gray-600 mb-4 line-clamp-2">
                      {pkg.description}
                    </p>
                    
                    <div className="space-y-2 mb-4">
                      {pkg.includes.slice(0, 3).map((item: string, index: number) => (
                        <div key={index} className="flex items-center text-sm text-gray-600">
                          <div className="w-2 h-2 bg-green-500 mr-3"></div>
                          {item}
                        </div>
                      ))}
                    </div>
                    
                    <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
                      <div className="flex items-center gap-1">
                        <Clock size={16} />
                        {pkg.duration}
                      </div>
                      <div className="flex items-center gap-1">
                        <Users size={16} />
                        {pkg.participants}
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-2xl font-bold text-gray-900">
                          ${pkg.price}
                        </span>
                        <span className="text-gray-500 text-sm ml-1">package</span>
                      </div>
                      <button
                        onClick={() => handleBookPackage(pkg)}
                        className="bg-blue-800 hover:bg-blue-900 text-white px-6 py-2 font-semibold transition flex items-center gap-2"
                      >
                        <Calendar size={18} />
                        Book Now
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* Location Selection Modal */}
      {showLocationModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white max-w-md w-full p-6">
            <h3 className="text-2xl font-bold text-gray-900 mb-2">
              Select Location
            </h3>
            <p className="text-gray-600 mb-6">
              Choose your preferred location for {activeBookingType === 'attraction' ? selectedAttraction?.name : selectedPackage?.name}
            </p>
            
            <div className="space-y-3 max-h-96 overflow-y-auto">
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
                    className={`w-full p-4 text-left border transition ${
                      isAvailable 
                        ? 'border-gray-300 hover:border-blue-800 hover:bg-blue-50 cursor-pointer' 
                        : 'border-gray-200 bg-gray-100 cursor-not-allowed'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <MapPin size={20} className={isAvailable ? "text-blue-800" : "text-gray-400"} />
                        <span className={isAvailable ? "text-gray-900 font-medium" : "text-gray-500"}>
                          {location}
                        </span>
                      </div>
                      {isAvailable ? (
                        <ChevronRight size={20} className="text-gray-400" />
                      ) : (
                        <span className="text-sm text-gray-500">Not Available</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
            
            <button
              onClick={() => setShowLocationModal(false)}
              className="w-full mt-6 px-4 py-3 border border-gray-300 text-gray-700 hover:bg-gray-50 transition font-semibold"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
            <img src="\Zap-Zone.png" alt="Logo" className="w-3/5 mr-2 mb-5"/>

              <p className="text-gray-400">
                Creating unforgettable experiences through thrilling attractions and amazing entertainment packages.
              </p>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4 text-white">Locations</h4>
              <div className="grid grid-cols-2 gap-2 text-sm text-gray-400">
                {locations.slice(0, 6).map(location => (
                  <div key={location}>{location}</div>
                ))}
              </div>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4 text-white">Contact</h4>
              <div className="space-y-2 text-sm text-gray-400">
                <div>info@zapzone.com</div>
                <div>(555) 123-4567</div>
                <div>Mon-Sun: 9AM-11PM</div>
              </div>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4 text-white">Follow Us</h4>
              <div className="flex space-x-4">
                <div className="w-10 h-10 bg-gray-800 flex items-center justify-center hover:bg-gray-700 transition cursor-pointer">
                  <span className="text-white">FB</span>
                </div>
                <div className="w-10 h-10 bg-gray-800 flex items-center justify-center hover:bg-gray-700 transition cursor-pointer">
                  <span className="text-white">IG</span>
                </div>
                <div className="w-10 h-10 bg-gray-800 flex items-center justify-center hover:bg-gray-700 transition cursor-pointer">
                  <span className="text-white">TW</span>
                </div>
              </div>
            </div>
          </div>
          
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400 text-sm">
            &copy; {new Date().getFullYear()} ZapZone. All rights reserved.
          </div>
        </div>
      </footer>
    </>
  );
};

export default EntertainmentLandingPage;