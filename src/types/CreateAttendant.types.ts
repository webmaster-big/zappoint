// Types for: src/pages/admin/users/CreateAttendant.tsx

export interface CreateAttendantFormData {
  // Personal Information
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  hireDate: string;
  position: string;
  employeeId: string;
  
  // Work Details
  department: string;
  shift: string;
  assignedAreas: string[];
  status: string;

  // Login Credentials
  username: string;
  password: string;
  confirmPassword: string;
}
