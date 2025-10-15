import type { PerformanceMetric } from './analytics';

export interface Account {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'company_admin' | 'location_manager' | 'attendant';
  status: 'active' | 'inactive' | 'suspended';
  createdAt: string;
  lastLogin?: string;
  companyId?: string;
  locationId?: string;
}

export interface Attendant {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: string;
  status: 'active' | 'inactive';
  hireDate: string;
  salary?: number;
  performance?: PerformanceMetric;
}

export interface ActivityLog {
  id: string;
  userId: string;
  userName: string;
  action: string;
  details: string;
  timestamp: string;
  ipAddress?: string;
  userAgent?: string;
}