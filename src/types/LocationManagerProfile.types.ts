// Types for: src/pages/admin/profile/LocationManagerProfile.tsx

export interface LocationManagerProfilePersonal {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  position: string;
  avatar: string;
  department: string;
}

export interface LocationManagerProfileAddress {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

export interface LocationManagerProfileLocation {
  name: string;
  type: string;
  email: string;
  phone: string;
  address: LocationManagerProfileAddress;
  facilities: string[];
  capacity: number;
  squareFootage: string;
}

export interface LocationManagerProfilePerformance {
  monthlyVisitors: number;
  customerRating: number;
  totalBookings: number;
  revenueThisMonth: number;
  teamSize: number;
  occupancyRate: number;
}

export interface LocationManagerProfileData {
  personal: LocationManagerProfilePersonal;
  location: LocationManagerProfileLocation;
  performance: LocationManagerProfilePerformance;
}
