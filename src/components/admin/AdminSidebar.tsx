import { useState, useEffect } from 'react';
import {
  Home,
  Calendar,
  Package,
  Users,
  Clock,
  User,
  Ticket,
  BarChart3,
  DollarSign,
  FileText,
  ChevronDown,
  Search,
  Bell,
  X,
  Dot
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

// Types
interface NavItem {
  label: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  href?: string;
  items?: NavItem[];
  section?: string; // Add section for grouping
}

interface UserData {
  name: string;
  company: string;
  subcompany?: string;
  position: string;
  role: 'attendee' | 'location_manager' | 'company_admin';
}


interface SidebarProps {
  user: UserData;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

// Grouped navigation for sidebar sections
const getNavigation = (role: UserData['role']): NavItem[] => {
  const commonItems: NavItem[] = [
    { label: 'Dashboard', icon: Home, href: '/dashboard' },
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
    { label: 'Shift Management', icon: Clock, href: '/shift-management' }
  ];

  switch(role) {
    case 'attendee':
      return [
        { label: 'Dashboard', icon: Home, href: '/attendee/dashboard' },
        { label: 'Attractions', icon: Ticket, items: [
          { label: 'Manage Attractions', href: '/activities', icon: Dot },
          { label: 'Create Attractions', href: '/activities/create', icon: Dot }
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
        { label: 'Shift Management', icon: Clock, href: '/attendee/shift-management' },
        { label: 'Profile', icon: User, href: '/attendee/profile' }
      ];
    case 'location_manager':
      return [
        { label: 'Dashboard', icon: Home, href: '/manager/dashboard' },
        { label: 'Activities/Attractions', icon: Ticket, items: [
          { label: 'Manage Attractions', href: '/activities', icon: Dot },
          { label: 'Create Attractions', href: '/activities/create', icon: Dot }
        ]},
        { label: 'Calendar & Resource', icon: Calendar, items: [
          { label: 'Calendar View', href: '/calendar', icon: Dot },
          { label: 'Occupancy Reports', href: '/occupancy', icon: Dot },
          { label: 'Resource Management', href: '/resources', icon: Dot }
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
        { label: 'Shift Management', icon: Clock, href: '/shift-management' },
        { label: 'Attendees Management', icon: Users, items: [
          { label: 'Create Attendees', href: '/users/create', icon: Dot },
          { label: 'Account Activity Log', href: '/users/activity', icon: Dot },
          { label: 'Attendees Performance', href: '/users/performance', icon: Dot },
          { label: 'Package Deals', href: '/users/packages', icon: Dot }
        ]},
        { label: 'Analytics & Reports', icon: BarChart3, href: '/analytics' },
        { label: 'Notifications', icon: Bell, href: '/notifications' },
        { label: 'Profile', icon: User, href: '/profile' }
      ];
    case 'company_admin':
      return [
        { label: 'Dashboard', icon: Home, href: '/dashboard' },
        { label: 'Attractions', icon: Ticket, items: [
          { label: 'Manage Attractions', href: '/activities', icon: Dot },
          { label: 'Create Attractions', href: '/activities/create', icon: Dot }
        ]},
        { label: 'Calendar & Resource', icon: Calendar, items: [
          { label: 'Calendar View', href: '/calendar', icon: Dot },
          { label: 'Occupancy Reports', href: '/occupancy', icon: Dot },
          { label: 'Resource Management', href: '/resources', icon: Dot }
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
        { label: 'Shift Management', icon: Clock, href: '/shift-management' },
        { label: 'User Management', icon: Users, items: [
          { label: 'Create Accounts', href: '/admin/users/create', icon: Dot },
          { label: 'Activity Log', href: '/admin/activity', icon: Dot },
          { label: 'Attendees Performance', href: '/admin/performance', icon: Dot },
          { label: 'Package Deals', href: '/admin/packages', icon: Dot }
        ]},
        { label: 'Analytics & Reports', icon: BarChart3, href: '/analytics' },
        { label: 'Accounting', icon: DollarSign, href: '/accounting' },
        { label: 'Activity Logs', icon: FileText, href: '/admin/activity-logs' },
        { label: 'Notifications', icon: Bell, href: '/notifications' },
        { label: 'Profile', icon: User, href: '/profile' }
      ];
    default:
      return commonItems;
  }
};

const Sidebar: React.FC<SidebarProps> = ({ user, isOpen, setIsOpen }) => {
  const location = useLocation();
  const [openDropdowns, setOpenDropdowns] = useState<Record<string, boolean>>({});
  const navigation = getNavigation(user.role);

  useEffect(() => {
    // Close sidebar when clicking outside on mobile
    const handleClickOutside = (event: MouseEvent) => {
      const sidebar = document.getElementById('sidebar');
      if (isOpen && sidebar && !sidebar.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, setIsOpen]);

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
          return <Icon size={18} className={isActive ? 'text-blue-700' : 'stroke-1'} />;
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
    return (
      <div>
        {hasItems ? (
          <div
            className={`flex items-center p-2 rounded-lg cursor-pointer transition-colors ${isActive || isChildActive ? 'bg-blue-100 text-blue-700 font-semibold' : 'hover:bg-gray-100 text-gray-700'} ${depth > 0 ? 'pl-8' : ''}`}
            onClick={() => toggleDropdown(item.label)}
          >
            {content}
          </div>
        ) : item.href ? (
          <Link
            to={item.href}
            className={`flex items-center p-2 rounded-lg transition-colors ${isActive ? 'bg-blue-100 text-blue-700 font-semibold' : 'hover:bg-gray-100 text-gray-700'} ${depth > 0 ? 'pl-8' : ''}`}
            onClick={() => setIsOpen(false)}
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
      {/* Sidebar */}
      <aside
        id="sidebar"
        className={`fixed top-0 left-0 z-50 w-64 h-screen bg-white via-white to-white shadow-md transition-transform transform
          ${isOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 lg:static lg:inset-0`}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-blue-400 rounded-lg flex items-center justify-center">
                <span className="text-black font-bold text-sm">Z</span>
              </div>
              <span className="ml-2 font-semibold text-gray-800">Zapzone</span>
            </div>
            <button
              className="lg:hidden p-1 rounded-md hover:bg-gray-100"
              onClick={() => setIsOpen(false)}
            >
              <X size={20} />
            </button>
          </div>
          {/* Search */}
          <div className="p-4">
            <div className="relative">
              <Search size={18} className="absolute left-3 top-2.5 text-gray-400" />
              <input
                type="text"
                placeholder="Search..."
                className="w-full pl-10 pr-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
              />
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
            
            <div className="flex items-center">
              <div className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center">
                <User size={20} className="text-gray-600" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-900">{user.name}</p>
                <p className="text-xs text-gray-500">{user.position}</p>
                <p className="text-xs text-gray-500">
                  {user.company}
                  {user.subcompany && ` • ${user.subcompany}`}
                </p>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;