// Types for: src/pages/admin/LocationActivityLogs.tsx

export interface LocationActivityLogsActivityLog {
  id: string;
  userId: string;
  userName: string;
  userType: 'attendant' | 'manager' | 'system';
  userRole?: string;
  location: string;
  action: string;
  resourceType: 'package' | 'customer' | 'purchase' | 'attraction' | 'booking' | 'attendant' | 'manager' | 'inventory' | 'settings';
  resourceId?: string;
  resourceName?: string;
  details: string;
  timestamp: string;
  severity: 'info' | 'success' | 'warning' | 'error';
}

export interface LocationActivityLogsFilterOptions {
  action: string;
  resourceType: string;
  user: string;
  userType: string;
  dateRange: string;
  search: string;
}

export interface LocationActivityLogsLocationData {
  name: string;
  managers: string[];
  attendants: string[];
  recentActivity: number;
}
