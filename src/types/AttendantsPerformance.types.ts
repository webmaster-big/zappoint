// Types for: src/pages/admin/Attendants/AttendantsPerformance.tsx

export interface AttendantsPerformanceAttendant {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  department: string;
  position: string;
  hireDate: string;
  status: 'active' | 'inactive';
}

export interface AttendantsPerformanceMetric {
  attendantId: string;
  period: string;
  bookingsCreated: number;
  purchasesProcessed: number;
  totalRevenue: number;
  customersHandled: number;
  totalHours: number;
  lastActive: string;
  loginCount: number;
}

export interface AttendantsPerformanceData {
  attendant: AttendantsPerformanceAttendant;
  metrics: AttendantsPerformanceMetric[];
}

export interface AttendantsPerformanceFilterOptions {
  timeRange: '1' | '7' | '30' | '90' | '365';
  department: string;
  search: string;
}
