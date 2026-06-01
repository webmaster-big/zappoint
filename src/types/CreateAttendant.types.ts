
export interface CreateAttendantFormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  hireDate: string;
  position: string;
  employeeId: string;
  
  department: string;
  shift: string;
  assignedAreas: string[];
  status: string;

  username: string;
  password: string;
  confirmPassword: string;
}
