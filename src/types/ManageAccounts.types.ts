// Types for: src/pages/admin/users/ManageAccounts.tsx

export interface ManageAccountsAccount {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  hireDate: string;
  position: string;
  employeeId: string;
  department: string;
  location: string;
  userType: 'attendant' | 'manager';
  shift?: string;
  assignedAreas?: string[];
  status: 'active' | 'inactive';
  username: string;
  createdAt: string;
  accountCreated?: boolean;
  invitationSent?: boolean;
  invitationLink?: string;
  invitationExpiry?: string;
  lastLogin?: string;
}

export interface ManageAccountsFilterOptions {
  status: string;
  department: string;
  userType: string;
  location: string;
  search: string;
}

export interface ManageAccountsInvitationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSendInvitation: (email: string, userType: 'attendant' | 'manager') => void;
  loading?: boolean;
  defaultEmail?: string;
  defaultUserType?: 'attendant' | 'manager';
}
