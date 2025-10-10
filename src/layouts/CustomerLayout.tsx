import { useState, useEffect } from 'react';
import { 
  MapPin, 
  Menu,
  X,
  User,
  ChevronRight,
  LogOut,
  Settings,
  Bell
} from 'lucide-react';
import { Link } from 'react-router-dom';

interface CustomerLayoutProps {
  children: React.ReactNode;
  selectedLocation?: string;
  onLocationChange?: (location: string) => void;
}

interface CustomerUser {
  id: string;
  name: string;
  email: string;
  // Add other user properties as needed
}

const CustomerLayout = ({ children, selectedLocation = 'All Locations', onLocationChange }: CustomerLayoutProps) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [customerUser, setCustomerUser] = useState<CustomerUser | null>(null);

  const locations = [
    'Brighton', 'Canton', 'Farmington', 'Lansing', 'Taylor', 
    'Waterford', 'Sterling Heights', 'Battle Creek', 'Ypsilanti', 'Escape Room Zone'
  ];

  // Check for logged-in user on component mount
  useEffect(() => {
    checkUserLoginStatus();
  }, []);

  const checkUserLoginStatus = () => {
    try {
      const userData = localStorage.getItem('customer_user');
      if (userData) {
        const user = JSON.parse(userData);
        setCustomerUser(user);
      } else {
        setCustomerUser(null);
      }
    } catch (error) {
      console.error('Error reading user data from localStorage:', error);
      setCustomerUser(null);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('customer_user');
    setCustomerUser(null);
    setUserMenuOpen(false);
    // Optional: Redirect to home page or login page
    // window.location.href = '/';
  };

  const handleLogin = () => {
    // Optional: Redirect to login page
    // window.location.href = '/login';
    console.log('Redirect to login page');
  };

  const handleCreateAccount = () => {
    // Optional: Redirect to signup page
    // window.location.href = '/signup';
    console.log('Redirect to signup page');
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Minimalistic Header with Blur */}
      <header className="bg-white/80 backdrop-blur-md border-b border-blue-800 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            {/* Minimalistic Logo */}
            <div className="flex items-center">
              <img 
                src="/Zap-Zone.png" 
                alt="ZapZone Logo" 
                className="md:w-35 md:h-12 sm:w-20 sm:h-10 object-contain"
              />
            </div>
            
            {/* Desktop Navigation */}
            <div className="hidden lg:flex items-center space-x-6">
              {/* Navigation Links (only real pages) */}
              <nav className="flex items-center space-x-4">
                {customerUser && (
                  <>
                    <Link to="/customer/reservations" className="text-gray-700 hover:text-blue-800 font-medium transition-colors px-2 py-1">
                      Reservations
                    </Link>
                    <Link to="/customer/gift-cards" className="text-gray-700 hover:text-blue-800 font-medium transition-colors px-2 py-1">
                      Gift Cards
                    </Link>
                   
                  </>
                )}
              </nav>

              {/* Location Selector - updated design */}
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-blue-800" size={18} />
                <select
                  value={selectedLocation}
                  onChange={(e) => onLocationChange?.(e.target.value)}
                  className="pl-10 pr-6 py-2 rounded-none border border-blue-800 bg-white text-gray-900 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-800 focus:bg-blue-50 hover:bg-blue-50 transition-all shadow-none appearance-none"
                  style={{ minWidth: 160 }}
                >
                  <option value="All Locations">All Locations</option>
                  {locations.map(location => (
                    <option key={location} value={location}>{location}</option>
                  ))}
                </select>
              </div>
              
              {/* Auth Buttons - Conditional Rendering */}
              {customerUser ? (
                /* Logged In User Menu + Notification */
                <div className="flex items-center space-x-2 relative">
                  {/* Notification Bell */}
                  <Link to="/customer/notifications" className="p-2 hover:bg-blue-50 text-blue-800 transition-colors">
                    <Bell size={20} />
                  </Link>
                  {/* User Menu */}
                  <div className="relative">
                    <button 
                      className="flex items-center space-x-2 px-4 py-2 text-gray-700 hover:text-blue-800 font-medium transition-colors hover:bg-blue-50"
                      onClick={() => setUserMenuOpen(!userMenuOpen)}
                    >
                      <span>{customerUser.name || 'My Account'}</span>
                      <ChevronRight 
                        size={16} 
                        className={`transition-transform ${userMenuOpen ? 'rotate-90' : ''}`}
                      />
                    </button>
                    {/* User Dropdown Menu */}
                    {userMenuOpen && (
                      <div className="absolute right-0 mt-1 w-48 bg-white border border-blue-800 py-1 z-50">
                        <div className="px-4 py-2 border-b border-blue-200">
                          <p className="text-sm font-medium text-gray-900">{customerUser.name}</p>
                          <p className="text-sm text-gray-500 truncate">{customerUser.email}</p>
                        </div>
                        <button className="w-full flex items-center space-x-2 px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 transition-colors">
                          <Settings size={16} />
                          <span>Account Settings</span>
                        </button>
                        <button 
                          className="w-full flex items-center space-x-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                          onClick={handleLogout}
                        >
                          <LogOut size={16} />
                          <span>Sign Out</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* Not Logged In Auth Buttons */
                <div className="flex items-center space-x-2">
                  <Link 
                    to="/customer/login"
                    className="flex items-center space-x-2 px-4 py-2 text-gray-700 hover:text-blue-800 font-medium transition-colors"
                    onClick={handleLogin}
                  >
                    <span>Sign In</span>
                  </Link>
                  <Link 
                    to="/customer/register"
                    className="flex items-center space-x-2 px-4 py-2 bg-blue-800 text-white font-medium hover:bg-blue-900 transition-colors"
                    onClick={handleCreateAccount}
                  >
                    <span>Create Account</span>
                    <ChevronRight size={16} />
                  </Link>
                </div>
              )}
            </div>

            {/* Mobile Menu Button */}
            <button 
              className="lg:hidden p-2 hover:bg-blue-50 transition-colors border border-blue-800"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X size={24} className="text-blue-800" /> : <Menu size={24} className="text-blue-800" />}
            </button>
          </div>

          {/* Mobile Navigation */}
          {mobileMenuOpen && (
            <div className="lg:hidden py-4 border-t border-blue-800 bg-white/90 backdrop-blur-md">
              <div className="space-y-4">
                {/* Mobile Navigation Links */}
                <div className="flex flex-col space-y-2">
                  {customerUser && (
                    <>
                      <Link to="/customer/reservations" className="text-gray-700 hover:text-blue-800 font-medium px-4 py-2 hover:bg-blue-50 transition-colors">
                        Reservations
                      </Link>
                      <Link to="/customer/gift-cards" className="text-gray-700 hover:text-blue-800 font-medium px-4 py-2 hover:bg-blue-50 transition-colors">
                        Gift Cards
                      </Link>
                    </>
                  )}
                </div>
                
                {/* Mobile Location Selector */}
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-blue-800" size={16} />
                  <select
                    value={selectedLocation}
                    onChange={(e) => onLocationChange?.(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-blue-800 bg-white text-gray-900 font-medium focus:outline-none focus:bg-blue-50"
                  >
                    <option value="All Locations">All Locations</option>
                    {locations.map(location => (
                      <option key={location} value={location}>{location}</option>
                    ))}
                  </select>
                </div>
                
                {/* Mobile Auth Buttons - Conditional Rendering */}
                {customerUser ? (
                  <div className="space-y-2 pt-2">
                    <div className="px-4 py-2 border-b border-blue-200">
                      <p className="font-medium text-gray-900">{customerUser.name}</p>
                      <p className="text-sm text-gray-500">{customerUser.email}</p>
                    </div>
                    <button className="w-full flex items-center justify-center space-x-2 px-4 py-2 border border-blue-800 text-gray-700 font-medium hover:bg-blue-50 transition-colors">
                      <span>Account Settings</span>
                    </button>
                    <button 
                      className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-red-600 text-white font-medium hover:bg-red-700 transition-colors"
                      onClick={handleLogout}
                    >
                      <span>Sign Out</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2 pt-2">
                    <Link 
                      to="/customer/login"
                      className="w-full flex items-center justify-center space-x-2 px-4 py-2 border border-blue-800 text-gray-700 font-medium hover:bg-blue-50 transition-colors"
                      onClick={handleLogin}
                    >
                      <span>Sign In</span>
                    </Link>
                    <Link
                      to="/customer/register"
                      className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-blue-800 text-white font-medium hover:bg-blue-900 transition-colors"
                      onClick={handleCreateAccount}
                    >
                      <span>Create Account</span>
                      <ChevronRight size={16} />
                    </Link>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Page Content */}
      <main>
        {children}
      </main>
    </div>
  );
};

export default CustomerLayout;