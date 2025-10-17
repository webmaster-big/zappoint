// Types for: src/pages/admin/Attendants/ManageAttendants.tsx

export interface ManageAttendantsAttendant {
  id: string;
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
  status: 'active' | 'inactive';
  username: string;
  createdAt: string;
  accountCreated?: boolean;
  invitationSent?: boolean;
  invitationLink?: string;
  invitationExpiry?: string;
}

export interface ManageAttendantsFilterOptions {
  status: string;
  department: string;
  search: string;
}

export interface ManageAttendantsInvitationModalProps {
  attendantName: string;
  generatedLink: string;
  loading: boolean;
  onClose: () => void;
  onSendInvitation: (email: string) => void;
}
