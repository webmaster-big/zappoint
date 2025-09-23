import { useLocation } from 'react-router-dom';
import { useEffect } from 'react';

const titles: Record<string, string> = {
  '/': 'Zap Zone',
  '/home': 'Home',
  '/bookings': 'Bookings',
  '/bookings/calendar': 'Calendar View',
  '/bookings/create': 'Create Booking',
  '/bookings/check-in': 'Check-in',
  '/packages': 'Packages',
  '/packages/create': 'Create Package',
  '/packages/promos': 'Promos',
  '/packages/gift-cards': 'Gift Cards',
  '/customers': 'Customers',
  '/customers/analytics': 'Customer Analytics',
  '/attractions': 'Attractions',
  '/attractions/create': 'Create Attraction',
  '/attractions/purchases': 'Attraction Purchases',
  '/attractions/purchases/create': 'Create Purchase',
  '/attendant/dashboard': 'Attendant Dashboard',
  '/manager/dashboard': 'Manager Dashboard',
  '/company/dashboard': 'Company Dashboard',
  '/admin/activity': 'Activity Log',
  '/admin/performance': 'Attendants Performance',
  '/admin/activity-logs': 'Activity Logs',
  '/analytics': 'Analytics & Reports',
  '/accounting': 'Accounting',
  '/notifications': 'Notifications',
  '/profile': 'Profile',
  '/attendant/profile': 'Attendant Profile',
  '/attendant/settings': 'Attendant Settings',
  '/manager/settings': 'Manager Settings',
  '/admin/settings': 'Admin Settings',
  '/users/create': 'Create Account',
  '/users/activity': 'Account Activity Log',
  '/users/performance': 'Attendants Performance',
  '/admin/users/create': 'Create Accounts',
  '/embed/booking/:packageId': 'Booking Widget',
};

const PageTitleSetter = () => {
  const location = useLocation();

  useEffect(() => {
    document.title = titles[location.pathname] || 'Zap Zone';
  }, [location.pathname]);

  return null;
};

export default PageTitleSetter;
