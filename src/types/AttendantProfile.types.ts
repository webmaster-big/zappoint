// Types for: src/pages/admin/profile/AttendantProfile.tsx

export interface AttendantProfilePersonal {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  position: string;
  avatar: string;
  hireDate: string;
  employeeId: string;
  department: string;
  shift: string;
  status: string;
}

export interface AttendantProfileAddress {
  street: string;
  city: string;
  state: string;
  zipCode: string;
}

export interface AttendantProfileLocation {
  name: string;
  email: string;
  phone: string;
  address: AttendantProfileAddress;
  timezone: string;
  isActive: boolean;
}

export interface AttendantProfileData {
  personal: AttendantProfilePersonal;
  location: AttendantProfileLocation;
}
