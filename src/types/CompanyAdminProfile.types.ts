// Types for: src/pages/admin/profile/CompanyAdminProfile.tsx

export interface CompanyAdminProfilePersonal {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  position: string;
  avatar: string;
}

export interface CompanyAdminProfileAddress {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

export interface CompanyAdminProfileCompany {
  name: string;
  industry: string;
  email: string;
  phone: string;
  website: string;
  founded: string;
  description: string;
  address: CompanyAdminProfileAddress;
}

export interface CompanyAdminProfileOperatingHours {
  weekdays: string;
  weekends: string;
  holidays: string;
}

export interface CompanyAdminProfileBusiness {
  totalLocations: number;
  activeLocations: number;
  totalEmployees: number;
  monthlyCapacity: number;
  operatingHours: CompanyAdminProfileOperatingHours;
}

export interface CompanyAdminProfileData {
  personal: CompanyAdminProfilePersonal;
  company: CompanyAdminProfileCompany;
  business: CompanyAdminProfileBusiness;
}
