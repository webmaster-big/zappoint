import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import {
  Home,
  Calendar,
  Package,
  Users,
  User,
  Ticket,
  BarChart3,
  ChevronDown,
  Search,
  Bell,
  Dot,
  Settings,
  Menu,
  Moon,
  Sun,
  LogOut,
  X,
  CalendarDays,
  List,
  Plus,
  ScanLine,
  ShoppingCart,
  LayoutGrid,
  PieChart,
  DoorOpen,
  UtensilsCrossed,
  Tag,
  Gift,
  FileText,
  UserCog,
  CalendarOff,
  Sparkles,
  CreditCard,
  Mail,
  Send
} from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTheme } from '../../contexts/ThemeContext';
import { useThemeColor } from '../../hooks/useThemeColor';
import type { NavItem, UserData, SidebarProps } from '../../types/sidebar.types';
import { API_BASE_URL, getImageUrl } from '../../utils/storage';
import { notificationStreamService, type NotificationObject } from '../../services/NotificationStreamService';
import { bookingCacheService } from '../../services/BookingCacheService';
import { roomCacheService } from '../../services/RoomCacheService';
import { packageCacheService } from '../../services/PackageCacheService';
import { addOnCacheService } from '../../services/AddOnCacheService';
import { attractionCacheService } from '../../services/AttractionCacheService';
import { attractionPurchaseCacheService } from '../../services/AttractionPurchaseCacheService';

// Helper function to add descriptions to navigation items
const addDescriptions = (navItems: NavItem[]): NavItem[] => {
  const descriptions: Record<string, string> = {
    'Dashboard': 'Overview of your account and recent activity',
    'Attractions': 'Manage all attraction-related activities',
    'Manage Attractions': 'View and edit all available attractions',
    'Create Attractions': 'Add new attractions to your offerings',
    'Manage Purchases': 'View and manage attraction purchases',
    'Create Purchase': 'Add a new purchase for attractions',
    'Check-in Scanner': 'Scan QR codes to check in attraction tickets',
    'Calendar View': 'See all bookings in a calendar format',
    'Space Schedule': 'Daily space allocation and booking timeline',
    'Bookings': 'Manage existing bookings and reservations',
    'Manage Bookings': 'View and edit all bookings',
    'Create Bookings': 'Create new bookings for customers',
    'Check-in with QR Scanner': 'Scan QR codes for customer check-ins',
    'Packages': 'View and manage package offerings',
    'Manage Packages': 'View and edit all packages',
    'Create Package': 'Create new package deals',
    'Space': 'Manage package Spaces and availability',
    'Add-ons': 'Manage package add-ons and extras',
    'Promos': 'Manage promotional offers and discounts',
    'Gift Cards': 'Handle gift card sales and redemptions',
    'Customer Analytics': 'Analytics and insights about your customers',
    'Customers': 'View and manage customer information',
    'Profile': 'Update your personal profile information',
    'Settings': 'Configure application settings',
    'Attendants Management': 'Manage attendant accounts and permissions',
    'Manage Attendants': 'View and edit attendant accounts',
    'Create Attendant': 'Create new attendant account',
    'Activity Log': 'View user activity history',
    'Create Account': 'Create new user accounts',
    'Account Activity Log': 'View user activity history',
    'Analytics & Reports': 'Business intelligence and reporting',
    'Activity Logs': 'System-wide activity tracking',
    'Day Offs': 'Manage blocked dates and holidays',
    'Notifications': 'Manage your notification preferences',
    'User Management': 'Administer user accounts and permissions',
    'Manage Accounts': 'View and edit user accounts',
    'Payments': 'Manage and view all payment transactions'
  };

  return navItems.map(item => {
    const newItem = { ...item };
    // Add description if available
    if (descriptions[item.label]) {
      newItem.description = descriptions[item.label];
    }
  // ...existing code...
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
      { label: 'Room Schedule', href: '/bookings/room-schedule', icon: Dot },
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
        { label: 'Dashboard', icon: Home, href: '/attendant/dashboard', section: 'General' },
        { label: 'Attractions', icon: Ticket, section: 'Attractions', items: [
          { label: 'Manage Attractions', href: '/attractions', icon: List },
          { label: 'Create Attractions', href: '/attractions/create', icon: Plus },
          { label: 'Manage Purchases', href: '/attractions/purchases', icon: ShoppingCart },
          { label: 'Create Purchase', href: '/attractions/purchases/create', icon: Plus },
          { label: 'Check-in Scanner', href: '/attractions/check-in', icon: ScanLine }
        ]},
        { label: 'Bookings', icon: Calendar, section: 'Bookings', items: [
          { label: 'Calendar View', href: '/bookings/calendar', icon: CalendarDays },
          { label: 'Space Schedule', href: '/bookings/space-schedule', icon: LayoutGrid },
          { label: 'Manage Bookings', href: '/bookings', icon: List },
          { label: 'Create Bookings', href: '/bookings/create', icon: Plus },
          { label: 'Check-in Scanner', href: '/bookings/check-in', icon: ScanLine }
        ]},
        { label: 'Packages', icon: Package, section: 'Packages', items: [
          { label: 'Manage Packages', href: '/packages', icon: List },
          { label: 'Custom Packages', href: '/packages/custom', icon: Sparkles },
          { label: 'Create Package', href: '/packages/create', icon: Plus },
          { label: 'Space', href: '/packages/rooms', icon: DoorOpen },
          { label: 'Add-ons', href: '/packages/add-ons', icon: UtensilsCrossed },
          { label: 'Promos', href: '/packages/promos', icon: Tag },
          { label: 'Gift Cards', href: '/packages/gift-cards', icon: Gift }
        ]},
        { label: 'Email Campaigns', icon: Mail, section: 'Communication', items: [
          { label: 'Email Templates', href: '/admin/email/templates', icon: FileText },
          { label: 'Create Template', href: '/admin/email/templates/create', icon: Plus },
          { label: 'Campaigns', href: '/admin/email/campaigns', icon: Send },
          { label: 'Create Campaign', href: '/admin/email/campaigns/create', icon: Plus },
          { label: 'Email Notifications', href: '/admin/email/notifications', icon: Bell },
          { label: 'Create Notification', href: '/admin/email/notifications/create', icon: Plus }
        ]},
        { label: 'Profile', icon: User, href: '/attendant/profile', section: 'Account' },
        { label: 'Settings', icon: Settings, href: '/attendant/settings', section: 'Account' }
      ];
      break;
    case 'location_manager':
      roleNavigation = [
        { label: 'Dashboard', icon: Home, href: '/manager/dashboard', section: 'General' },
        { label: 'Attractions', icon: Ticket, section: 'Attractions', items: [
          { label: 'Manage Attractions', href: '/attractions', icon: List },
          { label: 'Create Attractions', href: '/attractions/create', icon: Plus },
          { label: 'Manage Purchases', href: '/attractions/purchases', icon: ShoppingCart },
          { label: 'Create Purchase', href: '/attractions/purchases/create', icon: Plus },
          { label: 'Check-in Scanner', href: '/attractions/check-in', icon: ScanLine }
        ]},
        { label: 'Bookings', icon: Calendar, section: 'Bookings', items: [
          { label: 'Calendar View', href: '/bookings/calendar', icon: CalendarDays },
          { label: 'Space Schedule', href: '/bookings/space-schedule', icon: LayoutGrid },
          { label: 'Manage Bookings', href: '/bookings', icon: List },
          { label: 'Create Bookings', href: '/bookings/create', icon: Plus },
          { label: 'Check-in Scanner', href: '/bookings/check-in', icon: ScanLine }
        ]},
        { label: 'Packages', icon: Package, section: 'Packages', items: [
          { label: 'Manage Packages', href: '/packages', icon: List },
          { label: 'Custom Packages', href: '/packages/custom', icon: Sparkles },
          { label: 'Create Package', href: '/packages/create', icon: Plus },
          { label: 'Space', href: '/packages/rooms', icon: DoorOpen },
          { label: 'Add-ons', href: '/packages/add-ons', icon: UtensilsCrossed },
          { label: 'Promos', href: '/packages/promos', icon: Tag },
          { label: 'Gift Cards', href: '/packages/gift-cards', icon: Gift }
        ]},
        { label: 'Customers', icon: Users, section: 'Customers', items: [
          { label: 'Customer Analytics', href: '/customers/analytics', icon: PieChart },
          { label: 'Customers', href: '/customers', icon: Users }
        ]},
        { label: 'Email Campaigns', icon: Mail, section: 'Communication', items: [
          { label: 'Email Templates', href: '/admin/email/templates', icon: FileText },
          { label: 'Create Template', href: '/admin/email/templates/create', icon: Plus },
          { label: 'Campaigns', href: '/admin/email/campaigns', icon: Send },
          { label: 'Create Campaign', href: '/admin/email/campaigns/create', icon: Plus },
          { label: 'Email Notifications', href: '/admin/email/notifications', icon: Bell },
          { label: 'Create Notification', href: '/admin/email/notifications/create', icon: Plus }
        ]},
        { label: 'Payments', icon: CreditCard, href: '/manager/payments', section: 'Financial' },
        { label: 'Attendants Management', icon: UserCog, section: 'Team', items: [
          { label: 'Manage Attendants', href: '/manager/attendants', icon: Users },
          { label: 'Activity Log', href: '/manager/attendants/activity', icon: FileText },
          { label: 'Day Offs', href: '/manager/day-offs', icon: CalendarOff },
        ]},
        { label: 'Analytics & Reports', icon: BarChart3, href: '/manager/analytics', section: 'Reports' },
        { label: 'Profile', icon: User, href: '/manager/profile', section: 'Account' },
        { label: 'Settings', icon: Settings, href: '/manager/settings', section: 'Account' }
      ];
      break;
    case 'company_admin':
      roleNavigation = [
        { label: 'Dashboard', icon: Home, href: '/company/dashboard', section: 'General' },
        { label: 'Attractions', icon: Ticket, section: 'Attractions', items: [
          { label: 'Manage Attractions', href: '/attractions', icon: List },
          { label: 'Create Attractions', href: '/attractions/create', icon: Plus },
          { label: 'Manage Purchases', href: '/attractions/purchases', icon: ShoppingCart },
          { label: 'Create Purchase', href: '/attractions/purchases/create', icon: Plus },
          { label: 'Check-in Scanner', href: '/attractions/check-in', icon: ScanLine }
        ]},
        { label: 'Bookings', icon: Calendar, section: 'Bookings', items: [
          { label: 'Calendar View', href: '/bookings/calendar', icon: CalendarDays },
          { label: 'Space Schedule', href: '/bookings/space-schedule', icon: LayoutGrid },
          { label: 'Manage Bookings', href: '/bookings', icon: List },
          { label: 'Create Bookings', href: '/bookings/create', icon: Plus },
          { label: 'Check-in Scanner', href: '/bookings/check-in', icon: ScanLine }
        ]},
        { label: 'Packages', icon: Package, section: 'Packages', items: [
          { label: 'Manage Packages', href: '/packages', icon: List },
          { label: 'Custom Packages', href: '/packages/custom', icon: Sparkles },
          { label: 'Create Package', href: '/packages/create', icon: Plus },
          { label: 'Space', href: '/packages/rooms', icon: DoorOpen },
          { label: 'Add-ons', href: '/packages/add-ons', icon: UtensilsCrossed },
          { label: 'Promos', href: '/packages/promos', icon: Tag },
          { label: 'Gift Cards', href: '/packages/gift-cards', icon: Gift }
        ]},
        { label: 'Customers', icon: Users, section: 'Customers', items: [
          { label: 'Customer Analytics', href: '/customers/analytics', icon: PieChart },
          { label: 'Customers', href: '/customers', icon: Users }
        ]},
        { label: 'Email Campaigns', icon: Mail, section: 'Communication', items: [
          { label: 'Email Templates', href: '/admin/email/templates', icon: FileText },
          { label: 'Create Template', href: '/admin/email/templates/create', icon: Plus },
          { label: 'Campaigns', href: '/admin/email/campaigns', icon: Send },
          { label: 'Create Campaign', href: '/admin/email/campaigns/create', icon: Plus },
          { label: 'Email Notifications', href: '/admin/email/notifications', icon: Bell },
          { label: 'Create Notification', href: '/admin/email/notifications/create', icon: Plus }
        ]},
        { label: 'Payments', icon: CreditCard, href: '/admin/payments', section: 'Financial' },
        { label: 'User Management', icon: UserCog, section: 'Administration', items: [
          { label: 'Manage Accounts', href: '/admin/users', icon: Users },
          { label: 'Activity Log', href: '/admin/activity', icon: FileText },
          { label: 'Day Offs', href: '/admin/day-offs', icon: CalendarOff },
        ]},
        { label: 'Analytics & Reports', icon: BarChart3, href: '/admin/analytics', section: 'Reports' },
        { label: 'Profile', icon: User, href: '/admin/profile', section: 'Account' },
        { label: 'Settings', icon: Settings, href: '/admin/settings', section: 'Account' }
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

const Sidebar: React.FC<SidebarProps> = ({ user, isOpen, setIsOpen, handleSignOut, isMinimized = false, setIsMinimized }) => {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const { themeColor, fullColor } = useThemeColor();
  const location = useLocation();
  
  // Initialize openDropdowns from localStorage to persist state across navigation
  const [openDropdowns, setOpenDropdowns] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('zapzone_sidebar_dropdowns');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const profileDropdownRef = useRef<HTMLDivElement>(null);
  const [searchValue, setSearchValue] = useState('');
  const [companyLogo, setCompanyLogo] = useState<string | null>(null);
  const [searchSuggestions, setSearchSuggestions] = useState<{ label: string; href: string; description?: string; fragmentId?: string }[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLElement>(null);
  
  // Sidebar layout preference
  const [sidebarLayout, setSidebarLayout] = useState<'dropdown' | 'grouped'>('dropdown');
  
  // Persist openDropdowns to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('zapzone_sidebar_dropdowns', JSON.stringify(openDropdowns));
  }, [openDropdowns]);
  
  // Ref to track pending scroll restoration
  const pendingScrollRef = useRef<number | null>(null);
  
  // Use useLayoutEffect to restore scroll position BEFORE browser paints (prevents blinking)
  useLayoutEffect(() => {
    const navElement = navRef.current;
    if (!navElement) return;
    
    const savedScrollPosition = sessionStorage.getItem('zapzone_sidebar_scroll');
    if (savedScrollPosition) {
      const scrollPos = parseInt(savedScrollPosition, 10);
      if (scrollPos > 0) {
        // Immediately set scroll position before paint
        navElement.scrollTop = scrollPos;
        pendingScrollRef.current = scrollPos;
        
        // Double-check after a microtask in case React batched updates reset it
        queueMicrotask(() => {
          if (navElement && pendingScrollRef.current !== null) {
            navElement.scrollTop = pendingScrollRef.current;
          }
        });
      }
    }
  }, [location.pathname]);
  
  // Additional scroll restoration after render completes
  useEffect(() => {
    const navElement = navRef.current;
    if (!navElement || pendingScrollRef.current === null) return;
    
    // Restore scroll after layout is complete
    const scrollPos = pendingScrollRef.current;
    navElement.scrollTop = scrollPos;
    
    // Use requestAnimationFrame as final fallback
    const rafId = requestAnimationFrame(() => {
      if (navElement) {
        navElement.scrollTop = scrollPos;
        pendingScrollRef.current = null;
      }
    });
    
    return () => cancelAnimationFrame(rafId);
  }, [location.pathname]);
  
  // Save scroll position continuously as user scrolls
  useEffect(() => {
    const navElement = navRef.current;
    if (!navElement) return;
    
    const handleScroll = () => {
      const scrollTop = navElement.scrollTop;
      sessionStorage.setItem('zapzone_sidebar_scroll', String(scrollTop));
    };
    
    navElement.addEventListener('scroll', handleScroll, { passive: true });
    return () => navElement.removeEventListener('scroll', handleScroll);
  }, []);
  
  // Helper function to save scroll position immediately
  const saveScrollPosition = () => {
    if (navRef.current) {
      const scrollTop = navRef.current.scrollTop;
      sessionStorage.setItem('zapzone_sidebar_scroll', String(scrollTop));
      pendingScrollRef.current = scrollTop;
    }
  };

  // Load company logo on mount and listen for updates
  useEffect(() => {
    // Load from localStorage first
    const loadCompanyLogo = () => {
      const storedLogo = localStorage.getItem('company_logo_path');
      if (storedLogo) {
        setCompanyLogo(storedLogo);
        return;
      }
      
      // Try to get from cached company data
      const user = JSON.parse(localStorage.getItem('zapzone_user') || '{}');
      if (user.company_id) {
        const cachedCompany = localStorage.getItem(`company_${user.company_id}`);
        if (cachedCompany) {
          const companyData = JSON.parse(cachedCompany);
          if (companyData.logo_path) {
            setCompanyLogo(companyData.logo_path);
            localStorage.setItem('company_logo_path', companyData.logo_path);
          }
        }
      }
    };
    
    loadCompanyLogo();
    
    // Listen for logo updates
    const handleLogoUpdate = (event: CustomEvent<{ logoPath: string }>) => {
      if (event.detail?.logoPath) {
        setCompanyLogo(event.detail.logoPath);
      }
    };
    
    window.addEventListener('zapzone_company_logo_updated', handleLogoUpdate as EventListener);
    window.addEventListener('storage', loadCompanyLogo);
    
    return () => {
      window.removeEventListener('zapzone_company_logo_updated', handleLogoUpdate as EventListener);
      window.removeEventListener('storage', loadCompanyLogo);
    };
  }, []);

  // Unread notifications count from localStorage (zapzone_notifications)
  const [unreadNotifications, setUnreadNotifications] = useState<number>(0);
  const isStreamConnectedRef = useRef<boolean>(false);
  const notificationCountRef = useRef<number>(0);
  
  // Toast notification state
  const [showToast, setShowToast] = useState(false);
  const [toastData, setToastData] = useState<{ title: string; message: string; type: string } | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Get CSS variable value for the current theme color
  const getThemeColorValue = () => {
    if (typeof window === 'undefined') return '#1e40af'; // Default blue-800
    
    // Create a temporary element to get computed color value
    const temp = document.createElement('div');
    temp.className = `bg-${fullColor}`;
    temp.style.display = 'none';
    document.body.appendChild(temp);
    const color = window.getComputedStyle(temp).backgroundColor;
    document.body.removeChild(temp);
    
    return color || '#1e40af';
  };

  // Helper to get unread count from localStorage
  const getUnreadCount = async () => {
    try {
      const user = JSON.parse(localStorage.getItem('zapzone_user') || '{}');
      const token = user.token;
      const isCompanyAdmin = user.role === 'company_admin';
      const locationId = user.location_id;

      if (!token) return 0;

      // Build query parameters
      const params = new URLSearchParams({
        per_page: '1', // We only need the count
        unread: 'true',
      });

      // Only add location_id if not company_admin
      if (!isCompanyAdmin && locationId) {
        params.append('location_id', locationId.toString());
      }

      const response = await fetch(`${API_BASE_URL}/notifications?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      // Handle authentication errors - token is invalid/expired (HTTP status)
      if (response.status === 401 || response.status === 403) {
        console.warn('[AdminSidebar] Authentication failed (HTTP status), logging out user');
        forceLogout();
        return 0;
      }

      // Check content type - if it's HTML, it means auth failed and server returned login page
      const contentType = response.headers.get('content-type');
      if (contentType && !contentType.includes('application/json')) {
        console.warn('[AdminSidebar] Received non-JSON response (likely HTML error page), logging out user');
        forceLogout();
        return 0;
      }

      let data;
      try {
        data = await response.json();
      } catch (parseError) {
        // If JSON parsing fails, it's likely an HTML error page (auth failure)
        console.warn('[AdminSidebar] Failed to parse JSON response (received HTML), logging out user');
        forceLogout();
        return 0;
      }

      // Handle authentication errors from response body (Laravel often returns this way)
      if (
        data.message === 'Unauthenticated.' || 
        data.message === 'Unauthenticated' ||
        data.error === 'Unauthenticated.' ||
        data.error === 'Unauthenticated' ||
        (data.success === false && (data.message?.toLowerCase().includes('unauthenticated') || data.message?.toLowerCase().includes('unauthorized')))
      ) {
        console.warn('[AdminSidebar] Authentication failed (response body), logging out user');
        forceLogout();
        return 0;
      }

      if (data.success) {
        return data.data.pagination.total || 0;
      }
      return 0;
    } catch (error) {
      console.error('[AdminSidebar] Error fetching unread notifications count:', error);
      // If there's any network error or unexpected error, it might be auth-related
      return 0;
    }
  };

  // Force logout helper - clears all storage and redirects
  const forceLogout = async () => {
    console.warn('[AdminSidebar] Forcing logout - clearing all user data');
    
    // Clear all caches
    await Promise.all([
      bookingCacheService.clearCache(),
      roomCacheService.clearCache(),
      packageCacheService.clearCache(),
      addOnCacheService.clearCache(),
      attractionCacheService.clearCache(),
      attractionPurchaseCacheService.clearCache()
    ]);
    
    // Clear all possible user data
    localStorage.removeItem('zapzone_user');
    localStorage.removeItem('zapzone_token');
    sessionStorage.clear();
    
    // Disconnect notification stream
    notificationStreamService.disconnect();
    
    // Force hard redirect to login page
    window.location.replace('/admin');
  };


  // Initialize notification count FIRST before SSE connection - Critical timing!
  useEffect(() => {
    // Initialize notification count from backend API IMMEDIATELY on mount
    const initializeCount = async () => {
      const count = await getUnreadCount();
      notificationCountRef.current = count;
    };
    
    initializeCount();
  }, []);

  // Sync unread count on mount, when localStorage changes, and when custom event is dispatched
  useEffect(() => {
    const updateUnread = async () => {
      const count = await getUnreadCount();
      setUnreadNotifications(count);
    };
    
    updateUnread();
    
    window.addEventListener('zapzone_notifications_updated', updateUnread);
    return () => {
      window.removeEventListener('zapzone_notifications_updated', updateUnread);
    };
  }, []);

  // Setup SSE connection for real-time notifications
  useEffect(() => {
    if (!user) {
      return;
    }

    // Try to get location_id from user prop first, then from localStorage
    let locationId = user.location_id;
    let userId = user.id;
    
    if (!locationId || !userId) {
      try {
        const storedUser = localStorage.getItem('zapzone_user');
        if (storedUser) {
          const parsedUser = JSON.parse(storedUser);
          locationId = locationId || parsedUser.location_id;
          userId = userId || parsedUser.id;
        }
      } catch (error) {
        // Error parsing localStorage
      }
    }
    
    if (!locationId) {
      console.warn('[AdminSidebar] User has no location_id, cannot connect to notification stream');
      return;
    }

    if (isStreamConnectedRef.current) {
      return;
    }

    // Handle incoming notifications
    const handleNotification = async (notification: NotificationObject) => {
      // RULE 1: Never notify the user who created the notification
      // If notification.user_id exists and matches the current logged-in user's id, skip it
      // This means the current user created this notification, so don't show it to them
      if (notification.user_id !== null && notification.user_id !== undefined && notification.user_id === userId) {
        return;
      }

      // RULE 2: Location-based filtering when user_id is null (broadcast/system notifications)
      // If notification.user_id is null, it's a system or broadcast notification
      // In this case, only show to users at the matching location (unless company_admin)
      if (user.role !== 'company_admin') {
        // If notification has a location_id and it doesn't match user's location, skip
        if (notification.location_id !== null && notification.location_id !== undefined && notification.location_id !== locationId) {
          return;
        }
        
        // If notification has no user_id and no location_id, it might be a global system notification
        // We'll allow these through for all users
      }
      
      // Company admins see all notifications from all locations
      
      // Get new count from backend
      const newCount = await getUnreadCount();
      
      // CRITICAL: Only show toast if count increased (meaning this is a genuinely NEW notification)
      const countIncreased = newCount > notificationCountRef.current;
      
      // Update the count
      notificationCountRef.current = newCount;
      
      // Update unread count display
      setUnreadNotifications(newCount);
      
      // Only show toast if count increased
      if (countIncreased) {
        // Refresh purchase cache in background so management pages get fresh data
        attractionPurchaseCacheService.syncInBackground();
        bookingCacheService.syncInBackground();

        // Show toast for this new notification
        if (toastTimeoutRef.current) {
          clearTimeout(toastTimeoutRef.current);
        }
        
        setToastData({
          title: notification.title,
          message: notification.message,
          type: notification.type
        });
        setShowToast(true);
        
        toastTimeoutRef.current = setTimeout(() => {
          setShowToast(false);
        }, 5000);
        
        // Optional: Show browser notification if permitted
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification(notification.title, {
            body: notification.message,
            icon: '/Zap-Zone.png',
            tag: notification.id
          });
        }
      }
    };

    // Handle connection errors
    const handleError = (error?: any) => {
      // Stream connection error - might be auth failure
      console.warn('[AdminSidebar] Notification stream connection error:', error);
      
      // If error indicates authentication failure, force logout
      if (error && typeof error === 'object') {
        const errorMessage = error.message || error.toString?.() || '';
        if (
          errorMessage.toLowerCase().includes('401') ||
          errorMessage.toLowerCase().includes('403') ||
          errorMessage.toLowerCase().includes('unauthenticated') ||
          errorMessage.toLowerCase().includes('unauthorized')
        ) {
          console.warn('[AdminSidebar] Stream authentication error detected, logging out user');
          forceLogout();
        }
      }
    };

    // Connect to the notification stream
    notificationStreamService.connect(locationId, handleNotification, handleError);
    isStreamConnectedRef.current = true;

    // Request notification permission on mount (optional)
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    // Cleanup on unmount
    return () => {
      notificationStreamService.disconnect();
      isStreamConnectedRef.current = false;
      
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
    };
  }, [user]);

  // Optionally, update unread count when sidebar opens (for SPA navigation)
  useEffect(() => {
    if (isOpen) {
      getUnreadCount().then(count => setUnreadNotifications(count));
    }
  }, [isOpen]);
  
  // Load and listen for sidebar layout changes
  useEffect(() => {
    const savedLayout = localStorage.getItem('zapzone_sidebar_layout');
    if (savedLayout === 'dropdown' || savedLayout === 'grouped') {
      setSidebarLayout(savedLayout);
    }
    
    const handleLayoutChange = () => {
      const newLayout = localStorage.getItem('zapzone_sidebar_layout');
      if (newLayout === 'dropdown' || newLayout === 'grouped') {
        setSidebarLayout(newLayout);
      }
    };
    
    window.addEventListener('zapzone_sidebar_layout_changed', handleLayoutChange);
    return () => {
      window.removeEventListener('zapzone_sidebar_layout_changed', handleLayoutChange);
    };
  }, []);

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
  let navigation = getNavigation(user.role);
  
  // Transform navigation for grouped layout
  if (sidebarLayout === 'grouped') {
    const groupedNav: NavItem[] = [];
    const seenSections = new Set<string>();
    
    navigation.forEach(item => {
      // Add section header if this is a new section
      if (item.section && !seenSections.has(item.section)) {
        seenSections.add(item.section);
        groupedNav.push({
          label: item.section,
          icon: item.icon,
          isGroupHeader: true
        });
      }
      
      if (item.items && item.items.length > 0) {
        // Add flat items from dropdown
        item.items.forEach(subItem => {
          groupedNav.push({
            ...subItem,
            isGrouped: true
          });
        });
      } else {
        // Add standalone items
        groupedNav.push({
          ...item,
          isGrouped: true
        });
      }
    });
    
    navigation = groupedNav;
  }

  // Flatten all links for search (role-based)
  const getAllLinks = (nav: NavItem[]): { label: string; href: string; description?: string; fragmentId?: string }[] => {
    const links: { label: string; href: string; description?: string; fragmentId?: string }[] = [];
    nav.forEach(item => {
      if (item.href) {
        links.push({ label: item.label, href: item.href, description: item.description });
      }
      if (item.items) links.push(...getAllLinks(item.items));
    });
    return links;
  };
  const allLinks = getAllLinks(navigation);

  // Handle search input changes
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchValue(value);

    // Show suggestions matching input (label or fragmentId)
    if (value.trim()) {
      const suggestions = allLinks
        .filter(link =>
          link.label.toLowerCase().includes(value.toLowerCase()) ||
          (link.fragmentId && link.fragmentId.toLowerCase().includes(value.toLowerCase()))
        )
        .slice(0, 5); // Show up to 5 suggestions
      setSearchSuggestions(suggestions);
      setShowSuggestions(true);
    } else {
      setSearchSuggestions([]);
      setShowSuggestions(false);
    }
  };

  // Handle search selection

  const toggleDropdown = (label: string) => {
    // Save scroll position before state change
    saveScrollPosition();
    
    setOpenDropdowns(prev => ({
      ...prev,
      [label]: !prev[label]
    }));
  };

  const NavItemComponent: React.FC<{ item: NavItem; depth?: number }> = ({ item, depth = 0 }) => {
    // Handle group headers for grouped layout
    if (item.isGroupHeader && sidebarLayout === 'grouped' && !isMinimized) {
      return (
        <div className="mt-4 first:mt-0">
          <div className="border-t border-gray-200 mb-3 first:border-0"></div>
          <div className="px-2 pb-2 text-xs font-bold text-gray-500 uppercase tracking-wider">
            {item.label}
          </div>
        </div>
      );
    }
    
    const hasItems = item.items && item.items.length > 0;
    // Check if any child is active
    const isChildActive = hasItems && item.items!.some(child => child.href && location.pathname === child.href);
    const isDropdownOpen = openDropdowns[item.label] || isChildActive;
    const isActive = item.href && location.pathname === item.href;
    const [showTooltip, setShowTooltip] = useState(false);
    const [showDropdownMenu, setShowDropdownMenu] = useState(false);
    const itemRef = useRef<HTMLDivElement>(null);
    const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });

    // Calculate tooltip position when showing
    const handleMouseEnter = () => {
      if (isMinimized && depth === 0 && itemRef.current) {
        const rect = itemRef.current.getBoundingClientRect();
        setTooltipPosition({
          top: rect.top + rect.height / 2,
          left: rect.right + 8
        });
        setShowTooltip(true);
      }
    };

    const content = (
      <>
        {(() => {
          const Icon = item.icon;
          const iconSize = item.isGrouped ? 16 : 18;
          // @ts-expect-error lucide-react icons accept 'size' prop
          return <Icon size={iconSize} className={`transition-all duration-200 ${isActive ? `text-${fullColor}` : 'stroke-1'}`} />;
        })()}
        {!isMinimized && (
          <span className="ml-3 text-sm flex-1 relative transition-all duration-300 opacity-100">
            {item.label}
          </span>
        )}
        {hasItems && !isMinimized && (
          <ChevronDown
            size={16}
            className={`ml-auto transition-all duration-300 ease-in-out ${isDropdownOpen ? 'rotate-180' : ''}`}
          />
        )}
      </>
    );
    
    // Only close sidebar on navigation for mobile screens
    const handleNavClick = () => {
      // Save scroll position immediately before navigation
      saveScrollPosition();
      
      if (window.innerWidth < 1024) {
        setIsOpen(false);
      }
      if (isMinimized) {
        setShowDropdownMenu(false);
      }
    };

    return (
      <div className="relative" ref={itemRef}>
        {hasItems ? (
          <div
            className={`flex items-center p-2 rounded-lg cursor-pointer transition-all duration-200 ease-in-out ${isActive || isChildActive ? `bg-${themeColor}-100 text-${fullColor} font-semibold` : 'hover:bg-gray-100 text-gray-800'} ${depth > 0 ? 'pl-8' : ''} ${isMinimized && depth === 0 ? 'justify-center' : ''}`}
            onClick={() => {
              if (isMinimized && depth === 0) {
                setShowDropdownMenu(!showDropdownMenu);
              } else {
                toggleDropdown(item.label);
              }
            }}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={() => {
              if (isMinimized && depth === 0) {
                setShowTooltip(false);
                if (!showDropdownMenu) {
                  setShowDropdownMenu(false);
                }
              }
            }}
          >
            {content}
          </div>
        ) : item.href ? (
          <Link
            to={item.href}
            className={`flex items-center p-2 rounded-lg transition-colors ${isActive ? `bg-${themeColor}-100 text-${fullColor} font-semibold` : 'hover:bg-gray-100 text-gray-800'} ${!isMinimized && (depth > 0 || item.isGrouped) ? 'pl-5' : ''} ${isMinimized && depth === 0 ? 'justify-center' : ''}`}
            onClick={handleNavClick}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={() => isMinimized && depth === 0 && setShowTooltip(false)}
          >
            {content}
          </Link>
        ) : null}
        
        {/* Tooltip for minimized state - render using fixed positioning */}
        {isMinimized && depth === 0 && showTooltip && !showDropdownMenu && (
          <div 
            className="fixed px-3 py-2 bg-gray-900 text-white text-sm rounded-lg whitespace-nowrap pointer-events-none" 
            style={{ 
              zIndex: 9999,
              top: `${tooltipPosition.top}px`,
              left: `${tooltipPosition.left}px`,
              transform: 'translateY(-50%)'
            }}
          >
            {item.label}
            <div className="absolute left-0 top-1/2 -translate-x-1 -translate-y-1/2 w-2 h-2 bg-gray-900 rotate-45"></div>
          </div>
        )}

        {/* Dropdown menu for minimized state - render using fixed positioning */}
        {isMinimized && depth === 0 && hasItems && showDropdownMenu && (
          <div 
            className="fixed bg-white border border-gray-200 rounded-lg shadow-lg py-2 min-w-[200px]"
            style={{ 
              zIndex: 9999,
              top: `${tooltipPosition.top}px`,
              left: `${tooltipPosition.left}px`,
              transform: 'translateY(-50%)'
            }}
            onMouseLeave={() => setShowDropdownMenu(false)}
          >
            <div className="px-3 py-2 border-b border-gray-100 font-semibold text-sm text-gray-900">
              {item.label}
            </div>
            {(item.items ?? []).map((subItem, index) => (
              <Link
                key={index}
                to={subItem.href || '#'}
                className={`flex items-center gap-3 px-3 py-2 text-sm transition-all duration-200 ease-in-out ${
                  subItem.href && location.pathname === subItem.href
                    ? `bg-${themeColor}-50 text-${fullColor} font-semibold`
                    : 'hover:bg-gray-50 text-gray-800'
                }`}
                onClick={handleNavClick}
              >
                {(() => {
                  const SubIcon = subItem.icon;
                  // @ts-expect-error lucide-react icons accept 'size' prop
                  return <SubIcon size={16} />;
                })()}
                <span>{subItem.label}</span>
              </Link>
            ))}
          </div>
        )}
        
        {hasItems && isDropdownOpen && !isMinimized && (
          <div className="mt-1 space-y-1 border-gray-200">
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
      {/* Toast Notification - Right Top */}
      {showToast && toastData && (
        <div 
          className="fixed top-6 right-6 z-[9999] animate-slideDown"
          style={{ maxWidth: '90vw', width: '450px' }}
        >
          <div 
            className="relative rounded-2xl shadow-2xl overflow-hidden backdrop-blur-sm"
            style={{ 
              background: 'linear-gradient(135deg, rgba(255,255,255,0.98) 0%, rgba(255,255,255,0.95) 100%)',
              boxShadow: '0 20px 60px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.05)'
            }}
          >
            {/* Animated gradient border */}
            <div 
              className="absolute inset-0 rounded-2xl"
              style={{
                background: `linear-gradient(135deg, ${getThemeColorValue()}, ${getThemeColorValue()}dd)`,
                opacity: 0.1,
                zIndex: 0
              }}
            />
            
            {/* Colored accent bar */}
            <div 
              className="absolute top-0 left-0 right-0 h-1.5"
              style={{ 
                background: `linear-gradient(90deg, ${getThemeColorValue()}, ${getThemeColorValue()}cc)`,
                boxShadow: `0 2px 8px ${getThemeColorValue()}40`
              }}
            />
            
            <div className="relative p-5">
              <div className="flex items-start gap-4">
                {/* Animated Icon */}
                <div 
                  className="flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center relative"
                  style={{ 
                    background: `linear-gradient(135deg, ${getThemeColorValue()}15, ${getThemeColorValue()}08)`,
                    boxShadow: `0 4px 12px ${getThemeColorValue()}20`
                  }}
                >
                  <div 
                    className="absolute inset-0 rounded-xl animate-pulse"
                    style={{ 
                      background: `radial-gradient(circle, ${getThemeColorValue()}30, transparent)`,
                      opacity: 0.5
                    }}
                  />
                  <Bell 
                    size={22} 
                    style={{ color: getThemeColorValue() }}
                    className="relative z-10"
                  />
                </div>
                
                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h4 className="text-base font-bold text-gray-900 mb-0.5">
                        {toastData.title}
                      </h4>
                      <div className="flex items-center gap-2">
                        <span 
                          className="inline-flex items-center py-0.5 rounded-lg text-xs font-semibold"
                          style={{ 
                            background: `linear-gradient(135deg, ${getThemeColorValue()}20, ${getThemeColorValue()}10)`,
                            color: getThemeColorValue(),
                            border: `1px solid ${getThemeColorValue()}30`
                          }}
                        >
                          {toastData.type === 'booking' ? 'Booking' : 'Purchase'}
                        </span>
                        <span className="text-xs font-medium text-gray-400">• Just now</span>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowToast(false)}
                      className="flex-shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all"
                      aria-label="Close notification"
                    >
                      <X size={18} />
                    </button>
                  </div>
                  <p className="text-sm text-gray-700 leading-relaxed font-medium">
                    {toastData.message}
                  </p>
                </div>
              </div>
              
              {/* Enhanced Progress bar */}
              <div className="mt-4 -mx-5 -mb-5 h-1.5 bg-gray-100 overflow-hidden">
                <div 
                  className="h-full animate-shrink relative"
                  style={{ 
                    background: `linear-gradient(90deg, ${getThemeColorValue()}, ${getThemeColorValue()}cc)`,
                    boxShadow: `0 0 8px ${getThemeColorValue()}60`
                  }}
                >
                  <div 
                    className="absolute inset-0 opacity-50"
                    style={{
                      background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)',
                      animation: 'shimmer 2s infinite'
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
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
          className={`fixed top-4 right-4 z-50 p-2 rounded bg-${fullColor} text-white shadow-lg lg:hidden`}
          style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.12)' }}
          onClick={() => setIsOpen(true)}
        >
          <Menu size={20} />
        </button>
      )}
      {/* Sidebar */}
      <aside
        id="sidebar"
        className={`fixed top-0 left-0 z-50 h-screen bg-white via-white to-white shadow-md transition-all duration-300 ease-in-out transform animate-slide-in-from-left
          ${isOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 lg:static lg:inset-0 ${isMinimized ? 'w-20' : 'w-64'}`}
        style={{ overflow: 'visible' }}
      >
        <div className="flex flex-col h-full" style={{ overflow: 'visible' }}>
          {/* Header with Logo and Minimize Button */}
          <div className="relative flex items-center justify-center p-4 border-b border-gray-200 transition-all duration-300">
            <div className="flex items-center justify-center w-full transition-all duration-300">
              {companyLogo ? (
                <img 
                  src={getImageUrl(companyLogo)}
                  alt="Company Logo" 
                  className={`object-contain transition-all duration-300 ${isMinimized ? 'w-10 h-10' : 'max-h-12 max-w-[80%]'}`}
                  onError={(e) => {
                    console.error('Company logo failed to load, falling back to default');
                    e.currentTarget.style.display = 'none';
                    e.currentTarget.nextElementSibling?.classList.remove('hidden');
                  }}
                />
              ) : null}
              <img 
                src="/Zap-Zone.png" 
                alt="Logo" 
                className={`object-contain transition-all duration-300 ${isMinimized ? 'w-10 h-10' : 'w-3/5'} ${companyLogo ? 'hidden' : ''}`}
              />
            </div>
            
            {/* Minimize/Maximize Toggle Button - Desktop only, positioned on the right border */}
            <button
              onClick={() => setIsMinimized && setIsMinimized(!isMinimized)}
              className={`hidden lg:flex absolute -right-3 top-1/2 -translate-y-1/2 items-center justify-center w-6 h-6 rounded-full bg-white border-2 border-gray-200 hover:border-${themeColor}-600 hover:bg-${themeColor}-50 text-gray-600 hover:text-${themeColor}-600 transition-all duration-300 shadow-sm hover:shadow-md z-10`}
              title={isMinimized ? 'Expand sidebar' : 'Minimize sidebar'}
            >
              <ChevronDown 
                size={14} 
                className={`transition-all duration-300 ease-in-out ${isMinimized ? 'rotate-90' : '-rotate-90'}`}
              />
            </button>
          </div>

          {/* Search and Notifications */}
          <div className="p-4" ref={searchRef}>
            {isMinimized ? (
              <div className="flex items-center justify-center">
                {/* Notification Icon with Badge - Minimized */}
                <Link
                  to="/notifications"
                  className={`relative p-2 rounded-md hover:bg-${themeColor}-50 transition-colors flex-shrink-0`}
                  onClick={() => {
                    if (window.innerWidth < 1024) {
                      setIsOpen(false);
                    }
                  }}
                >
                  <Bell size={20} className="text-gray-700" />
                  {unreadNotifications > 0 && (
                    <span
                      className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center px-1 text-xs font-bold text-white rounded-full border-2 border-white"
                      style={{
                        backgroundColor: getThemeColorValue(),
                        fontSize: '10px'
                      }}
                    >
                      {unreadNotifications > 99 ? '99+' : unreadNotifications}
                    </span>
                  )}
                </Link>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search size={18} className="absolute left-3 top-2.5 text-gray-800" />
                  <input
                    type="text"
                    placeholder="Search..."
                    className={`w-full pl-10 pr-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-${fullColor} focus:border-${fullColor}`}
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
                          className={`w-full text-left px-4 py-2 text-sm hover:bg-${themeColor}-50 transition-colors`}
                          onClick={() => {
                            navigate(suggestion.href);
                            setSearchValue('');
                            setSearchSuggestions([]);
                            setShowSuggestions(false);
                            setIsOpen(false);
                          }}
                        >
                          <div className="font-medium text-gray-900 transition-colors duration-200">{suggestion.label}</div>
                          {suggestion.description && (
                            <div className="text-xs text-gray-500 mt-1 transition-colors duration-200">{suggestion.description}</div>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                
                {/* Notification Icon with Badge */}
                <Link
                  to="/notifications"
                  className={`relative p-2 rounded-md hover:bg-${themeColor}-50 transition-colors flex-shrink-0`}
                  onClick={() => {
                    if (window.innerWidth < 1024) {
                      setIsOpen(false);
                    }
                  }}
                >
                  <Bell size={20} className="text-gray-700" />
                  {unreadNotifications > 0 && (
                    <span
                      className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center px-1 text-xs font-bold text-white rounded-full border-2 border-white"
                      style={{
                        backgroundColor: getThemeColorValue(),
                        fontSize: '10px'
                      }}
                    >
                      {unreadNotifications > 99 ? '99+' : unreadNotifications}
                    </span>
                  )}
                </Link>
              </div>
            )}
          </div>
          {/* Navigation */}
          <nav 
            ref={navRef} 
            className="flex-1 px-4 py-4 space-y-2 hidden-scrollbar" 
            style={{ 
              overflowY: 'auto', 
              overflowX: 'visible', 
              overflowAnchor: 'none',
              scrollBehavior: 'auto',
              contain: 'layout style'
            }}
          >
            {navigation.map((item, idx) => (
              <NavItemComponent key={`${item.label}-${idx}`} item={item} />
            ))}
          </nav>
          {/* User profile & Notifications */}
          <div className="p-4 border-t border-gray-200">
            {/* User Profile Dropdown */}
            {isMinimized ? (
              <div className="flex items-center justify-center relative" ref={profileDropdownRef}>
                <button
                  className={`w-10 h-10 rounded-full flex items-center justify-center hover:ring-2 hover:ring-${themeColor}-300 transition-all overflow-hidden`}
                  onClick={() => setShowProfileDropdown((prev: boolean) => !prev)}
                  type="button"
                >
                  {user.profile_path ? (
                    <img 
                      src={getImageUrl(user.profile_path)}
                      alt={user.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        // Fallback to icon if image fails to load
                        e.currentTarget.style.display = 'none';
                        const parent = e.currentTarget.parentElement;
                        if (parent) {
                          parent.classList.add(`bg-${themeColor}-200`);
                          const icon = parent.querySelector('svg');
                          if (icon) icon.classList.remove('hidden');
                        }
                      }}
                    />
                  ) : (
                    <div className={`w-full h-full bg-${themeColor}-200 rounded-full flex items-center justify-center`}>
                      <User size={20} className={`text-${fullColor}`} />
                    </div>
                  )}
                  <User size={20} className={`text-${fullColor} transition-all duration-200 ${user.profile_path ? 'hidden' : ''}`} />
                </button>
                {showProfileDropdown && (
                  <div className="absolute left-full ml-2 bottom-0 w-48 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden transition-all duration-200 ease-in-out">
                    <div className="p-3 border-b border-gray-100">
                      <p className="text-sm font-medium text-gray-900">{user.name}</p>
                      <p className="text-xs text-gray-500">{user.position}</p>
                      <p className="text-xs text-gray-500">
                        {user.role === 'company_admin' ? user.company : user.location_name || user.company}
                      </p>
                    </div>
                    <div className="p-2">
                      {/* Theme Toggle */}
                      <button
                        onClick={toggleTheme}
                        className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg transition-all duration-200 ease-in-out"
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
                        className="w-full flex items-center gap-3 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200 ease-in-out"
                      >
                        <LogOut size={16} className="text-red-600 transition-all duration-200" />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center overflow-hidden ${!user.profile_path ? `bg-${themeColor}-200` : ''}`}>
                    {user.profile_path ? (
                      <img 
                        src={getImageUrl(user.profile_path)}
                        alt={user.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          // Fallback to icon if image fails to load
                          e.currentTarget.style.display = 'none';
                          const parent = e.currentTarget.parentElement;
                          if (parent) {
                            parent.classList.add(`bg-${themeColor}-200`);
                            const icon = parent.querySelector('svg');
                            if (icon) icon.classList.remove('hidden');
                          }
                        }}
                      />
                    ) : null}
                    <User size={20} className={`text-${fullColor} ${user.profile_path ? 'hidden' : ''}`} />
                  </div>
                  <div className="ml-3 text-left">
                    <p className="text-sm font-medium text-gray-900">{user.name}</p>
                    <p className="text-xs text-gray-500">{user.position}</p>
                    <p className="text-xs text-gray-500">
                      {user.role === 'company_admin' ? user.company : user.location_name || user.company}
                    </p>
                  </div>
                </div>
                <div className="relative" ref={profileDropdownRef}>
                  <button
                    className={`p-2 rounded-full hover:bg-${themeColor}-100 focus:outline-none transition-all duration-200 ease-in-out`}
                    onClick={() => setShowProfileDropdown((prev: boolean) => !prev)}
                    id="profile-dropdown-toggle"
                    type="button"
                  >
                    <ChevronDown size={18} className={`text-${fullColor} transition-transform duration-300 ease-in-out`} />
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
                          className="w-full flex items-center gap-3 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200 ease-in-out"
                        >
                          <LogOut size={16} className="text-red-600" />
                          <span>Sign Out</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;