/**
 * Authentication Helper Utilities
 * Provides helper functions for authentication, token validation, and user session management
 */

export interface UserData {
  id: number;
  name: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  profile_path?: string;
  company: string;
  company_id?: number | null;
  location_id?: number | null;
  location_name?: string;
  position: string;
  role: 'attendant' | 'location_manager' | 'company_admin';
  token: string;
  last_login?: string | null;
}

export interface CustomerData {
  id: number;
  name: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  token: string;
  billing_address?: string;
  billing_city?: string;
  billing_state?: string;
  billing_zip?: string;
  billing_country?: string;
}

/**
 * Get authenticated user data from localStorage
 */
export const getUser = (): UserData | null => {
  try {
    const stored = localStorage.getItem('zapzone_user');
    if (stored) {
      const user = JSON.parse(stored);
      // Validate that user has required fields
      if (user && user.token && user.id) {
        return user;
      }
    }
    return null;
  } catch (error) {
    console.error('Error parsing user data:', error);
    return null;
  }
};

/**
 * Get authenticated customer data from localStorage
 */
export const getCustomer = (): CustomerData | null => {
  try {
    const stored = localStorage.getItem('zapzone_customer');
    if (stored) {
      const customer = JSON.parse(stored);
      // Validate that customer has required fields
      if (customer && customer.token && customer.id) {
        return customer;
      }
    }
    return null;
  } catch (error) {
    console.error('Error parsing customer data:', error);
    return null;
  }
};

/**
 * Check if user is authenticated
 */
export const isAuthenticated = (): boolean => {
  const user = getUser();
  return user !== null && !!user.token;
};

/**
 * Check if customer is authenticated
 */
export const isCustomerAuthenticated = (): boolean => {
  const customer = getCustomer();
  return customer !== null && !!customer.token;
};

/**
 * Check if user has a specific role
 */
export const hasRole = (requiredRole: UserData['role'] | UserData['role'][]): boolean => {
  const user = getUser();
  if (!user) return false;
  
  if (Array.isArray(requiredRole)) {
    return requiredRole.includes(user.role);
  }
  
  return user.role === requiredRole;
};

/**
 * Get user's auth token
 */
export const getToken = (): string | null => {
  const user = getUser();
  return user?.token || null;
};

/**
 * Get customer's auth token
 */
export const getCustomerToken = (): string | null => {
  const customer = getCustomer();
  return customer?.token || null;
};

/**
 * Clear user session and logout
 */
export const logout = (): void => {
  localStorage.removeItem('zapzone_user');
  localStorage.removeItem('zapzone_notifications');
  // Redirect to login
  window.location.href = '/admin';
};

/**
 * Clear customer session and logout
 */
export const customerLogout = (): void => {
  localStorage.removeItem('zapzone_customer');
  // Redirect to customer login
  window.location.href = '/customer/login';
};

/**
 * Get redirect path based on user role
 */
export const getRoleBasedRedirect = (role?: UserData['role']): string => {
  const userRole = role || getUser()?.role;
  
  const redirectPaths: Record<string, string> = {
    'company_admin': '/company/dashboard',
    'location_manager': '/manager/dashboard',
    'attendant': '/attendant/dashboard',
  };
  
  return redirectPaths[userRole || 'attendant'] || '/attendant/dashboard';
};

/**
 * Check if token is expired (basic check)
 * Note: This is a simple check. For production, implement proper JWT validation
 */
export const isTokenExpired = (token: string): boolean => {
  try {
    // Basic JWT structure check
    const parts = token.split('.');
    if (parts.length !== 3) return true;
    
    // Decode payload
    const payload = JSON.parse(atob(parts[1]));
    
    // Check expiration
    if (payload.exp) {
      const currentTime = Math.floor(Date.now() / 1000);
      return payload.exp < currentTime;
    }
    
    return false;
  } catch (error) {
    console.error('Error validating token:', error);
    return true;
  }
};

/**
 * Validate user session
 */
export const validateSession = (): boolean => {
  const user = getUser();
  
  if (!user || !user.token) {
    return false;
  }
  
  // Check if token is expired
  if (isTokenExpired(user.token)) {
    logout();
    return false;
  }
  
  return true;
};

/**
 * Validate customer session
 */
export const validateCustomerSession = (): boolean => {
  const customer = getCustomer();
  
  if (!customer || !customer.token) {
    return false;
  }
  
  // Check if token is expired
  if (isTokenExpired(customer.token)) {
    customerLogout();
    return false;
  }
  
  return true;
};
