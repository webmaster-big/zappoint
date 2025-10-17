// Types for: src/pages/admin/users/CreateAccounts.tsx

export interface CreateAccountsFormData {
  userType: 'attendant' | 'manager';
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  hireDate: string;
  position: string;
  employeeId: string;
  department: string;
  location: string;
  shift: string;
  assignedAreas: string[];
  status: 'active' | 'inactive';
  username: string;
  password: string;
  confirmPassword: string;
}

export interface CreateAccountsDepartment {
  id: string;
  name: string;
  userTypes: ('attendant' | 'manager')[];
}

export interface CreateAccountsLocation {
  id: string;
  name: string;
  managers: string[];
}
