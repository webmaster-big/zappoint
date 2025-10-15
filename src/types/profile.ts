export interface Profile {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: string;
  companyId?: string;
  locationId?: string;
  avatar?: string;
  bio?: string;
  preferences?: {
    theme: 'light' | 'dark';
    notifications: boolean;
    language: string;
  };
}