import { useState, useEffect, useRef } from 'react';
import {
  Home,
  Calendar,
  Package,
  Users,
  User,
  Ticket,
  BarChart3,
  DollarSign,
  FileText,
  ChevronDown,
  Search,
  Bell,
  Dot,
  Settings,
  Menu,
  Moon,
  Sun,
  LogOut
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useTheme } from '../../contexts/ThemeContext';

// Types
interface NavItem {
  label: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  href?: string;
  items?: NavItem[];
  section?: string;
  description?: string; // Add description for search results
}

interface UserData {
  name: string;
  company: string;
  subcompany?: string;
  position: string;
  role: 'attendant' | 'location_manager' | 'company_admin';
}

interface SidebarProps {
  user: UserData;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  handleSignOut: () => void;
}

// Helper function to add descriptions to navigation items
const addDescriptions = (navItems: NavItem[]): NavItem[] => {
  const descriptions: Record<string, string> = {
    'Dashboard': 'Overview of your account and recent activity',
    'Manage Attractions': 'View and edit all available attractions',
    'Create Attractions': 'Add new attractions to your offerings',
    'Calendar View': 'See all bookings in a calendar format',
    'Bookings': 'Manage existing bookings and reservations',
    'Create Bookings': 'Create new bookings for customers',
    'Check-in with QR Scanner': 'Scan QR codes for customer check-ins',
    'Packages': 'View and manage package offerings',
    'Create Package': 'Create new package deals',
    'Promos': 'Manage promotional offers and discounts',
    'Gift Cards': 'Handle gift card sales and redemptions',
    'Customer Analytics': 'Analytics and insights about your customers',
    'Customers': 'View and manage customer information',
    'Profile': 'Update your personal profile information',
    'Settings': 'Configure application settings',
    'Attendants Management': 'Manage attendant accounts and permissions',
    'Create Account': 'Create new user accounts',
    'Account Activity Log': 'View user activity history',
    'Attendants Performance': 'Monitor attendant performance metrics',
    'Analytics & Reports': 'Business intelligence and reporting',
    'Accounting': 'Financial management and reporting',
    'Activity Logs': 'System-wide activity tracking',
    'Notifications': 'Manage your notification preferences',
    'User Management': 'Administer user accounts and permissions'
  };

  return navItems.map(item => {
    const newItem = { ...item };
    
    // Add description if available
    if (descriptions[item.label]) {
      newItem.description = descriptions[item.label];
    }
    
    // Recursively process nested items
    if (item.items && item.items.length > 0) {
      newItem.items = addDescriptions(item.items);
    }
    
    return newItem;
  });
};

// Grouped navigation for sidebar sections
const getNavigation = (role: UserData['role']): NavItem[] => {
  const commonItems: NavItem[] = [
    { label: 'Bookings', icon: Calendar, items: [
      { label: 'Calendar View', href: '/bookings/calendar', icon: Dot },
      { label: 'Bookings', href: '/bookings', icon: Dot },
      { label: 'Create Bookings', href: '/bookings/create', icon: Dot },
      { label: 'Check-in with QR Scanner', href: '/bookings/check-in', icon: Dot }
    ]},
    { label: 'Packages', icon: Package, items: [
      { label: 'Packages', href: '/packages', icon: Dot },
      { label: 'Create Package', href: '/packages/create', icon: Dot }
    ]},
    { label: 'Customers', icon: Users, items: [
      { label: 'Customer Analytics', href: '/customers/analytics', icon: Dot },
      { label: 'Customers', href: '/customers', icon: Dot }
    ]},
  ];

  let roleNavigation: NavItem[] = [];
  
  switch(role) {
    case 'attendant':
      roleNavigation = [
        { label: 'Dashboard', icon: Home, href: '/attendant/dashboard' },
        { label: 'Attractions', icon: Ticket, items: [
          { label: 'Manage Attractions', href: '/attractions', icon: Dot },
          { label: 'Create Attractions', href: '/attractions/create', icon: Dot },
          { label: 'Purchases', href: '/attractions/purchases', icon: Dot },
          { label: 'Create Purchase', href: '/attractions/purchases/create', icon: Dot }
        ]},
        { label: 'Bookings', icon: Calendar, items: [
          { label: 'Calendar View', href: '/bookings/calendar', icon: Dot },
          { label: 'Bookings', href: '/bookings', icon: Dot },
          { label: 'Create Bookings', href: '/bookings/create', icon: Dot },
          { label: 'Check-in with QR Scanner', href: '/bookings/check-in', icon: Dot }
        ]},
        { label: 'Packages', icon: Package, items: [
          { label: 'Packages', href: '/packages', icon: Dot },
          { label: 'Create Package', href: '/packages/create', icon: Dot },
          { label: 'Promos', href: '/packages/promos', icon: Dot },
          { label: 'Gift Cards', href: '/packages/gift-cards', icon: Dot }
        ]},
        { label: 'Customers', icon: Users, items: [
          { label: 'Customer Analytics', href: '/customers/analytics', icon: Dot },
          { label: 'Customers', href: '/customers', icon: Dot }
        ]},
        { label: 'Profile', icon: User, href: '/attendant/profile' },
        { label: 'Settings', icon: Settings, href: '/attendant/settings' }
      ];
      break;
    case 'location_manager':
      roleNavigation = [
        { label: 'Dashboard', icon: Home, href: '/manager/dashboard' },
        { label: 'Attractions', icon: Ticket, items: [
          { label: 'Manage Attractions', href: '/attractions', icon: Dot },
          { label: 'Create Attractions', href: '/attractions/create', icon: Dot },
          { label: 'Purchases', href: '/attractions/purchases', icon: Dot },
          { label: 'Create Purchase', href: '/attractions/purchases/create', icon: Dot }
        ]},
        { label: 'Bookings', icon: Calendar, items: [
          { label: 'Calendar View', href: '/bookings/calendar', icon: Dot },
          { label: 'Bookings', href: '/bookings', icon: Dot },
          { label: 'Create Bookings', href: '/bookings/create', icon: Dot },
          { label: 'Check-in with QR Scanner', href: '/bookings/check-in', icon: Dot }
        ]},
        { label: 'Packages', icon: Package, items: [
          { label: 'Packages', href: '/packages', icon: Dot },
          { label: 'Create Package', href: '/packages/create', icon: Dot },
          { label: 'Promos', href: '/packages/promos', icon: Dot },
          { label: 'Gift Cards', href: '/packages/gift-cards', icon: Dot }
        ]},
        { label: 'Customers', icon: Users, items: [
          { label: 'Customer Analytics', href: '/customers/analytics', icon: Dot },
          { label: 'Customers', href: '/customers', icon: Dot }
        ]},
        { label: 'Attendants Management', icon: Users, items: [
          { label: 'Create Account', href: '/users/create', icon: Dot },
          { label: 'Account Activity Log', href: '/users/activity', icon: Dot },
          { label: 'Attendants Performance', href: '/users/performance', icon: Dot },
        ]},
        { label: 'Analytics & Reports', icon: BarChart3, href: '/analytics' },
        { label: 'Notifications', icon: Bell, href: '/notifications' },
        { label: 'Profile', icon: User, href: '/profile' },
        { label: 'Settings', icon: Settings, href: '/manager/settings' }
      ];
      break;
    case 'company_admin':
      roleNavigation = [
        { label: 'Dashboard', icon: Home, href: '/company/dashboard' },
        { label: 'Attractions', icon: Ticket, items: [
          { label: 'Manage Attractions', href: '/attractions', icon: Dot },
          { label: 'Create Attractions', href: '/attractions/create', icon: Dot },
          { label: 'Purchases', href: '/attractions/purchases', icon: Dot },
          { label: 'Create Purchase', href: '/attractions/purchases/create', icon: Dot }
        ]},
        { label: 'Bookings', icon: Calendar, items: [
          { label: 'Calendar View', href: '/bookings/calendar', icon: Dot },
          { label: 'Bookings', href: '/bookings', icon: Dot },
          { label: 'Create Bookings', href: '/bookings/create', icon: Dot },
          { label: 'Check-in with QR Scanner', href: '/bookings/check-in', icon: Dot }
        ]},
        { label: 'Packages', icon: Package, items: [
          { label: 'Packages', href: '/packages', icon: Dot },
          { label: 'Create Package', href: '/packages/create', icon: Dot },
          { label: 'Promos', href: '/packages/promos', icon: Dot },
          { label: 'Gift Cards', href: '/packages/gift-cards', icon: Dot }
        ]},
        { label: 'Customers', icon: Users, items: [
          { label: 'Customer Analytics', href: '/customers/analytics', icon: Dot },
          { label: 'Customers', href: '/customers', icon: Dot }
        ]},
        { label: 'User Management', icon: Users, items: [
          { label: 'Create Accounts', href: '/admin/users/create', icon: Dot },
          { label: 'Activity Log', href: '/admin/activity', icon: Dot },
          { label: 'Attendants Performance', href: '/admin/performance', icon: Dot },
        ]},
        { label: 'Analytics & Reports', icon: BarChart3, href: '/analytics' },
        { label: 'Accounting', icon: DollarSign, href: '/accounting' },
        { label: 'Activity Logs', icon: FileText, href: '/admin/activity-logs' },
        { label: 'Notifications', icon: Bell, href: '/notifications' },
        { label: 'Profile', icon: User, href: '/profile' },
        { label: 'Settings', icon: Settings, href: '/admin/settings' }
      ];
      break;
    default:
      roleNavigation = [
        ...commonItems,
        { label: 'Settings', icon: Settings, href: '/settings' }
      ];
  }
  
  return addDescriptions(roleNavigation);
};

const Sidebar: React.FC<SidebarProps> = ({ user, isOpen, setIsOpen, handleSignOut }) => {
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const [openDropdowns, setOpenDropdowns] = useState<Record<string, boolean>>({});
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const profileDropdownRef = useRef<HTMLDivElement>(null);
  const [searchValue, setSearchValue] = useState('');
  const [searchSuggestions, setSearchSuggestions] = useState<{ label: string; href: string; description?: string }[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Close sidebar when clicking outside on mobile
    const handleClickOutside = (event: MouseEvent) => {
      const sidebar = document.getElementById('sidebar');
      if (isOpen && sidebar && !sidebar.contains(event.target as Node)) {
        setIsOpen(false);
      }
      // Close profile dropdown when clicking outside
      if (showProfileDropdown && profileDropdownRef.current && 
          !profileDropdownRef.current.contains(event.target as Node)) {
        setShowProfileDropdown(false);
      }
      // Close search suggestions when clicking outside
      if (showSuggestions && searchRef.current && 
          !searchRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, setIsOpen, showProfileDropdown, showSuggestions]);

  if (!user) return null;
  const navigation = getNavigation(user.role);

  // Flatten all links for search (role-based)
  const getAllLinks = (nav: NavItem[]): { label: string; href: string; description?: string }[] => {
    const links: { label: string; href: string; description?: string }[] = [];
    nav.forEach(item => {
      if (item.href) links.push({ label: item.label, href: item.href, description: item.description });
      if (item.items) links.push(...getAllLinks(item.items));
    });
    return links;
  };
  const allLinks = getAllLinks(navigation);

  // Handle search input changes
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchValue(value);

    // Show suggestions matching input
    if (value.trim()) {
      const suggestions = allLinks
        .filter(link => link.label.toLowerCase().includes(value.toLowerCase()))
        .slice(0, 5); // Show up to 5 suggestions
      setSearchSuggestions(suggestions);
      setShowSuggestions(true);
    } else {
      setSearchSuggestions([]);
      setShowSuggestions(false);
    }
  };

  // Handle search selection
  const handleSearchSelect = (suggestion: { label: string; href: string }) => {
    window.location.href = suggestion.href;
    setSearchValue('');
    setSearchSuggestions([]);
    setShowSuggestions(false);
    setIsOpen(false);
  };

  const toggleDropdown = (label: string) => {
    setOpenDropdowns(prev => ({
      ...prev,
      [label]: !prev[label]
    }));
  };

  const NavItemComponent: React.FC<{ item: NavItem; depth?: number }> = ({ item, depth = 0 }) => {
    const hasItems = item.items && item.items.length > 0;
    // Check if any child is active
    const isChildActive = hasItems && item.items!.some(child => child.href && location.pathname === child.href);
    const isDropdownOpen = openDropdowns[item.label] || isChildActive;
    const isActive = item.href && location.pathname === item.href;
    const content = (
      <>
        {(() => {
          const Icon = item.icon;
          // @ts-expect-error lucide-react icons accept 'size' prop
          return <Icon size={18} className={isActive ? 'text-blue-800' : 'stroke-1'} />;
        })()}
        <span className="ml-3 text-sm flex-1">{item.label}</span>
        {hasItems && (
          <ChevronDown
            size={16}
            className={`ml-auto transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`}
          />
        )}
      </>
    );
    // Only close sidebar on navigation for mobile screens
    const handleNavClick = () => {
      if (window.innerWidth < 1024) {
        setIsOpen(false);
      }
    };
    return (
      <div>
        {hasItems ? (
          <div
            className={`flex items-center p-2 rounded-lg cursor-pointer transition-colors ${isActive || isChildActive ? 'bg-blue-100 text-blue-800 font-semibold' : 'hover:bg-gray-100 text-gray-800'} ${depth > 0 ? 'pl-8' : ''}`}
            onClick={() => toggleDropdown(item.label)}
          >
            {content}
          </div>
        ) : item.href ? (
          <Link
            to={item.href}
            className={`flex items-center p-2 rounded-lg transition-colors ${isActive ? 'bg-blue-100 text-blue-800 font-semibold' : 'hover:bg-gray-100 text-gray-800'} ${depth > 0 ? 'pl-8' : ''}`}
            onClick={handleNavClick}
          >
            {content}
          </Link>
        ) : null}
        {hasItems && isDropdownOpen && (
          <div className="mt-1 ml-2 space-y-1 border-l border-gray-200">
            {(item.items ?? []).map((subItem, index) => (
              <NavItemComponent key={index} item={subItem} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
      {/* Floating Toggle Button */}
      {!isOpen && (
        <button
          className="fixed top-4 right-4 z-50 p-2 rounded bg-blue-800 text-white shadow-lg lg:hidden"
          style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.12)' }}
          onClick={() => setIsOpen(true)}
        >
          <Menu size={20} />
        </button>
      )}
      {/* Sidebar */}
      <aside
        id="sidebar"
        className={`fixed top-0 left-0 z-50 w-64 h-screen bg-white via-white to-white shadow-md transition-transform transform
          ${isOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 lg:static lg:inset-0`}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center justify-center w-full ">
              <img src="\Zap-Zone.png" alt="Logo" className="w-3/5 mr-2"/>
            </div>
          </div>
          {/* Search */}
          <div className="p-4" ref={searchRef}>
            <div className="relative">
              <Search size={18} className="absolute left-3 top-2.5 text-gray-800" />
              <input
                type="text"
                placeholder="Search..."
                className="w-full pl-10 pr-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-800 focus:border-blue-800"
                value={searchValue}
                onChange={handleSearchChange}
                onFocus={() => searchValue.trim() && setShowSuggestions(true)}
                autoComplete="off"
              />
              {/* Custom search suggestions dropdown */}
              {showSuggestions && searchSuggestions.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded shadow-lg z-50 max-h-60 overflow-y-auto">
                  {searchSuggestions.map(suggestion => (
                    <button
                      key={suggestion.href}
                      className="w-full text-left px-4 py-2 text-sm hover:bg-blue-50 transition-colors"
                      onClick={() => handleSearchSelect(suggestion)}
                    >
                      <div className="font-medium text-gray-900">{suggestion.label}</div>
                      {suggestion.description && (
                        <div className="text-xs text-gray-500 mt-1">{suggestion.description}</div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          {/* Navigation */}
          <nav className="flex-1 px-4 py-4 space-y-2 hidden-scrollbar  overflow-y-auto">
            {navigation.map((item, idx) => (
              <NavItemComponent key={idx} item={item} />
            ))}
          </nav>
          {/* User profile & Notifications */}
          <div className="p-4 border-t border-gray-200">
            {/* User Profile Dropdown */}
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="w-10 h-10 bg-blue-200 rounded-full flex items-center justify-center">
                  <User size={20} className="text-blue-800" />
                </div>
                <div className="ml-3 text-left">
                  <p className="text-sm font-medium text-gray-900">{user.name}</p>
                  <p className="text-xs text-gray-500">{user.position}</p>
                  <p className="text-xs text-gray-500">
                    {user.company}
                    {user.subcompany && ` • ${user.subcompany}`}
                  </p>
                </div>
              </div>
              <div className="relative" ref={profileDropdownRef}>
                <button
                  className="p-2 rounded-full hover:bg-blue-100 focus:outline-none"
                  onClick={() => setShowProfileDropdown((prev: boolean) => !prev)}
                  id="profile-dropdown-toggle"
                  type="button"
                >
                  <ChevronDown size={18} className="text-blue-800" />
                </button>
                {showProfileDropdown && (
                  <div className="absolute right-0 bottom-0 mb-10 w-48 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden">
                    <div className="p-2">
                      {/* Theme Toggle */}
                      <button
                        onClick={toggleTheme}
                        className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
                      >
                        {theme === 'light' ? (
                          <>
                            <Moon size={16} className="text-gray-600" />
                            <span>Dark Mode</span>
                          </>
                        ) : (
                          <>
                            <Sun size={16} className="text-gray-600" />
                            <span>Light Mode</span>
                          </>
                        )}
                      </button>
                      
                      {/* Divider */}
                      <div className="border-t border-gray-100 my-2"></div>
                      
                      {/* Sign Out */}
                      <button
                        onClick={handleSignOut}
                        className="w-full flex items-center gap-3 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <LogOut size={16} className="text-red-600" />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;