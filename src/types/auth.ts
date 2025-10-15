export interface User {
  id: string;
  username: string;
  email: string;
  role: 'company_admin' | 'location_manager' | 'attendant' | 'customer';
  firstName?: string;
  lastName?: string;
  companyId?: string;
  locationId?: string;
}

export interface LoginFormData {
  email: string;
  password: string;
}

export interface RegisterFormData {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
  phone?: string;
}