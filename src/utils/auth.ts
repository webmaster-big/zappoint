
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

export const getUser = (): UserData | null => {
  try {
    const stored = localStorage.getItem('zapzone_user');
    if (stored) {
      const user = JSON.parse(stored);
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

export const getCustomer = (): CustomerData | null => {
  try {
    const stored = localStorage.getItem('zapzone_customer');
    if (stored) {
      const customer = JSON.parse(stored);
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

export const isAuthenticated = (): boolean => {
  const user = getUser();
  return user !== null && !!user.token;
};

export const isCustomerAuthenticated = (): boolean => {
  const customer = getCustomer();
  return customer !== null && !!customer.token;
};

export const hasRole = (requiredRole: UserData['role'] | UserData['role'][]): boolean => {
  const user = getUser();
  if (!user) return false;
  
  if (Array.isArray(requiredRole)) {
    return requiredRole.includes(user.role);
  }
  
  return user.role === requiredRole;
};

export const getToken = (): string | null => {
  const user = getUser();
  return user?.token || null;
};

export const getCustomerToken = (): string | null => {
  const customer = getCustomer();
  return customer?.token || null;
};

export const logout = (): void => {
  localStorage.removeItem('zapzone_user');
  localStorage.removeItem('zapzone_notifications');
  window.location.href = '/admin';
};

export const customerLogout = (): void => {
  localStorage.removeItem('zapzone_customer');
  window.location.href = '/customer/login';
};

export const getRoleBasedRedirect = (role?: UserData['role']): string => {
  const userRole = role || getUser()?.role;
  
  const redirectPaths: Record<string, string> = {
    'company_admin': '/company/dashboard',
    'location_manager': '/manager/dashboard',
    'attendant': '/attendant/dashboard',
  };
  
  return redirectPaths[userRole || 'attendant'] || '/attendant/dashboard';
};

export const isTokenExpired = (token: string): boolean => {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return true;
    
    const payload = JSON.parse(atob(parts[1]));
    
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

export const validateSession = (): boolean => {
  const user = getUser();
  
  if (!user || !user.token) {
    return false;
  }
  
  if (isTokenExpired(user.token)) {
    logout();
    return false;
  }
  
  return true;
};

export const validateCustomerSession = (): boolean => {
  const customer = getCustomer();
  
  if (!customer || !customer.token) {
    return false;
  }
  
  if (isTokenExpired(customer.token)) {
    customerLogout();
    return false;
  }
  
  return true;
};
