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
}

export interface AttendantProfileAddress {
  street: string;
  city: string;
  state: string;
  zipCode: string;
}

export interface AttendantProfileLocation {
  name: string;
  manager: string;
  address: AttendantProfileAddress;
  assignedAreas: string[];
  shift: string;
}

export interface AttendantProfileScheduleDay {
  day: string;
  date: string;
  shift: string;
  area: string;
}

export interface AttendantProfileSchedule {
  currentWeek: AttendantProfileScheduleDay[];
  nextWeek: AttendantProfileScheduleDay[];
}

export interface AttendantProfileData {
  personal: AttendantProfilePersonal;
  location: AttendantProfileLocation;
  schedule: AttendantProfileSchedule;
}
