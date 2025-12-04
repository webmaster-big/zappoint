// Types for: src/pages/admin/profile/CompanyAdminProfile.tsx

export interface CompanyAdminProfilePersonal {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  position: string;
  avatar: string;
  employeeId: string;
  department: string;
}

export interface CompanyAdminProfileCompany {
  name: string;
  industry: string;
  email: string;
  phone: string;
  website: string;
  foundedDate: string;
  description: string;
  logoPath: string;
  taxId: string;
  registrationNumber: string;
  companySize: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

export interface CompanyAdminProfileBusiness {
  totalLocations: number;
  totalEmployees: number;
}

export interface CompanyAdminProfileData {
  personal: CompanyAdminProfilePersonal;
  company: CompanyAdminProfileCompany;
  business: CompanyAdminProfileBusiness;
}
