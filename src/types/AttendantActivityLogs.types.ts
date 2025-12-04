// Types for: src/pages/admin/Attendants/AttendantActivityLogs.tsx

export interface AttendantActivityLogsLog {
  id: string;
  attendantId: string;
  attendantName: string;
  userId?: string;
  userType?: string;
  action: string;
  resourceType: 'package' | 'customer' | 'purchase' | 'attraction' | 'booking' | 'attendant';
  resourceId?: string;
  resourceName?: string;
  details: string;
  timestamp: string;
  severity: 'info' | 'success' | 'warning';
}

export interface AttendantActivityLogsFilterOptions {
  action: string;
  resourceType: string;
  attendant: string;
  dateRange: string;
  search: string;
}
