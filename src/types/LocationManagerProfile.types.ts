// Types for: src/pages/admin/profile/LocationManagerProfile.tsx

export interface LocationManagerProfilePersonal {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  position: string;
  avatar: string;
  department: string;
  employeeId: string;
  shift: string;
  hireDate: string;
  status: string;
}

export interface LocationManagerProfileAddress {
  street: string;
  city: string;
  state: string;
  zipCode: string;
}

export interface LocationManagerProfileLocation {
  name: string;
  email: string;
  phone: string;
  address: LocationManagerProfileAddress;
  timezone: string;
  isActive: boolean;
}

export interface LocationManagerProfileData {
  personal: LocationManagerProfilePersonal;
  location: LocationManagerProfileLocation;
}
