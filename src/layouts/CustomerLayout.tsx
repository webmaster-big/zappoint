import { useState, useEffect } from 'react';
import { 
  Menu,
  X,
  ChevronRight,
  Bell
} from 'lucide-react';
import { Link, useLocation, Outlet } from 'react-router-dom';

interface CustomerUser {
  id: string;
  name: string;
  email: string;
  // Add other user properties as needed
}

const CustomerLayout = () => {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [customerUser, setCustomerUser] = useState<CustomerUser | null>(null);
  const [isLoading, setIsLoading] = useState(true); // Add loading state



  // Check for logged-in user on component mount
  useEffect(() => {
    checkUserLoginStatus();
  }, []);

  // Close mobile menu when location changes (don't affect user state)
  useEffect(() => {
    setMobileMenuOpen(false);
    setUserMenuOpen(false);
  }, [location.pathname]);

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
    } finally {
      setIsLoading(false); // Always set loading to false after check
    }
  };

  console.log(window.location.pathname);

  const handleLogout = () => {
    localStorage.removeItem('customer_user');
    setCustomerUser(null);
    setUserMenuOpen(false);
    // Optional: Redirect to home page or login page
    // window.location.href = '/';
  };

  // Don't render anything until we've checked localStorage
  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-800 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

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
                className="w-28 h-10 sm:w-32 sm:h-12 md:w-36 md:h-14 object-contain"
                style={{ maxWidth: '140px', height: 'auto' }}
              />
            </div>
            
            {/* Desktop Navigation */}
            <div className="hidden lg:flex items-center space-x-6">
              {/* Navigation Links (only real pages) */}
              <nav className="flex items-center space-x-4">
            
                {customerUser && (
                  <>
                      <Link
                  to="/"
                  className={`px-2 py-1 font-medium text-sm transition-colors ${location.pathname === '/' ? 'text-blue-800 border-b-2 border-blue-800' : 'text-gray-700 hover:text-blue-800'}`}
                >
                  Home
                </Link>
                    <Link
                      to="/customer/reservations"
                      className={`px-2 py-1 font-medium text-sm transition-colors ${location.pathname.startsWith('/customer/reservations') ? 'text-blue-800 border-b-2 border-blue-800' : 'text-gray-700 hover:text-blue-800'}`}
                    >
                      Reservations
                    </Link>
                   
                    <Link
                      to="/customer/gift-cards"
                      className={`px-2 py-1 font-medium text-sm transition-colors ${location.pathname.startsWith('/customer/gift-cards') ? 'text-blue-800 border-b-2 border-blue-800' : 'text-gray-700 hover:text-blue-800'}`}
                    >
                      Gift Cards
                    </Link>
                  </>
                )}
              </nav>
              {/* Auth Buttons - Conditional Rendering */}
              {customerUser ? (
                /* Logged In User Menu + Notification */
                <div className="flex items-center space-x-2 relative">
                  {/* Notification Bell */}
                  <Link to="/customer/notifications" className="p-2 hover:bg-blue-50 text-blue-800 transition-colors">
                    <Bell size={16} />
                  </Link>
                  {/* User Menu */}
                  <div className="relative">
                    <button 
                      className="flex items-center space-x-2 px-4 py-2 text-sm text-gray-700 hover:text-blue-800 font-medium transition-colors hover:bg-blue-50"
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
                          <span>Account Settings</span>
                        </button>
                        <button 
                          className="w-full flex items-center space-x-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                          onClick={handleLogout}
                        >
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
                    className="flex items-center text-sm space-x-2 px-5 py-2 rounded-full border border-blue-800 text-blue-800 font-semibold bg-white shadow-sm hover:bg-blue-50 hover:text-blue-900 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-800"
                  >
                    <span>Sign In</span>
                  </Link>
                  <Link 
                    to="/customer/register"
                    className="flex items-center text-sm space-x-2 px-5 py-2 rounded-full bg-blue-800 text-white font-semibold shadow-md hover:from-blue-900 hover:to-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-800"
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
                      <Link
                    to="/"
                    onClick={() => setMobileMenuOpen(false)}
                    className={`px-4 py-2 font-medium text-sm transition-colors ${location.pathname === '/' ? 'text-blue-800 bg-blue-50' : 'text-gray-700 hover:text-blue-800 hover:bg-blue-50'}`}
                  >
                    Home
                  </Link>
                      <Link
                        to="/customer/reservations"
                        onClick={() => setMobileMenuOpen(false)}
                        className={`px-4 py-2 font-medium text-sm transition-colors ${location.pathname.startsWith('/customer/reservations') ? 'text-blue-800 bg-blue-50' : 'text-gray-700 hover:text-blue-800 hover:bg-blue-50'}`}
                      >
                        Reservations
                      </Link>
                      <Link
                        to="/customer/gift-cards"
                        onClick={() => setMobileMenuOpen(false)}
                        className={`px-4 py-2 font-medium text-sm transition-colors ${location.pathname.startsWith('/customer/gift-cards') ? 'text-blue-800 bg-blue-50' : 'text-gray-700 hover:text-blue-800 hover:bg-blue-50'}`}
                      >
                        Gift Cards
                      </Link>
                    </>
                  )}
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
                      className="w-full flex items-center text-sm justify-center space-x-2 px-5 py-2 rounded-full border border-blue-800 text-blue-800 font-semibold bg-white shadow-sm hover:bg-blue-50 hover:text-blue-900 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-800"
                      onClick={() => {
                        setMobileMenuOpen(false);
                      }}
                    >
                      <span>Sign In</span>
                    </Link>
                    <Link
                      to="/customer/register"
                      className="w-full flex items-center text-sm justify-center space-x-2 px-5 py-2 rounded-full bg-gradient-to-r from-blue-800 to-blue-600 text-white font-semibold shadow-md hover:from-blue-900 hover:to-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-800"
                      onClick={() => {
                        setMobileMenuOpen(false);
                      }}
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
        <Outlet />
      </main>
    </div>
  );
};

export default CustomerLayout;