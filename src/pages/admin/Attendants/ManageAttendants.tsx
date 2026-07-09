import { useEffect, useMemo, useState } from 'react';
import {
  Eye,
  Pencil,
  Trash2,
  Plus,
  Users,
  User,
  Mail,
  Phone,
  MapPin,
  Send,
  X,
  Copy,
  CheckCircle,
  UserPlus,
  Building2,
  Download,
} from 'lucide-react';
import StandardButton from '../../../components/ui/StandardButton';
import { useThemeColor } from '../../../hooks/useThemeColor';
import CounterAnimation from '../../../components/ui/CounterAnimation';
import { API_BASE_URL, getStoredUser, setStoredUser } from '../../../utils/storage';
import { userService } from '../../../services/UserService';
import { locationService } from '../../../services/LocationService';
import type { Location } from '../../../services/LocationService';
import CreateStaffAccountModal from '../../../components/admin/users/CreateStaffAccountModal';
import AttendantViewModal from '../../../components/admin/users/AttendantViewModal';
import AttendantEditModal from '../../../components/admin/users/AttendantEditModal';
import EditLocationModal from '../../../components/admin/users/EditLocationModal';
import type { ManageAttendantsAttendant } from '../../../types/ManageAttendants.types';
import {
  AdminDataTable,
  AdminTableToolbar,
  BulkActionsBar,
  exportTableCsv,
  useAdminTable,
} from '../../../components/admin/table';
import type { AdminColumn, AdminFilterDef } from '../../../components/admin/table';

type AttendantRow = ManageAttendantsAttendant & { locationId: string };

const getExperience = (hireDate: string) => {
  const hire = new Date(hireDate);
  const today = new Date();
  const months = (today.getFullYear() - hire.getFullYear()) * 12 + (today.getMonth() - hire.getMonth());
  return Math.max(0, months);
};

const formatDateOnly = (dateString: string) =>
  new Date(dateString.substring(0, 10) + 'T00:00:00').toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

const formatDateTime = (dateString: string) =>
  new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

interface InvitationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSendInvitation: (email: string, userType: 'attendant' | 'manager') => void;
}

const InvitationModal: React.FC<InvitationModalProps> = ({
  isOpen,
  onClose,
  onSendInvitation
}) => {
  const { themeColor } = useThemeColor();
  const [email, setEmail] = useState('');
  const [userType, setUserType] = useState<'attendant' | 'manager'>('attendant');
  const [generatedLink, setGeneratedLink] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setEmail('');
      setUserType('attendant');
      setGeneratedLink('');
      setError('');
      setSuccess(false);
    }
  }, [isOpen]);

  const handleSend = async () => {
    if (!email) {
      setError('Please enter an email address');
      return;
    }

    setIsSending(true);
    setError('');
    setSuccess(false);

    try {
      const role = userType === 'manager' ? 'location_manager' : 'attendant';

      const userData = localStorage.getItem('zapzone_user');
      const user = userData ? JSON.parse(userData) : null;

      const requestBody: Record<string, string> = {
        email: email,
        role: role,
      };

      if (user?.company_id) {
        requestBody.company_id = String(user.company_id);
      }

      if (user?.location_id) {
        requestBody.location_id = String(user.location_id);
      }

      const response = await fetch(`${API_BASE_URL}/shareable-tokens`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to create invitation');
      }

      setGeneratedLink(data.data.link);
      setSuccess(true);

      if (onSendInvitation) {
        onSendInvitation(email, userType);
      }

      setTimeout(() => {
        setSuccess(false);
      }, 3000);

    } catch (err) {
      console.error('Error sending invitation:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to send invitation. Please try again.';
      setError(errorMessage);
    } finally {
      setIsSending(false);
    }
  };

  const copyToClipboard = () => {
    if (generatedLink) {
      navigator.clipboard.writeText(generatedLink);
      alert('Link copied to clipboard!');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-backdrop-fade">
      <div className="bg-white rounded-xl shadow-lg max-w-md w-full">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Send Account Invitation</h3>
          <StandardButton
            variant="ghost"
            size="sm"
            icon={X}
            onClick={onClose}
            disabled={isSending}
          />
        </div>

        <div className="p-6 space-y-4">
          {success && (
            <div className="p-3 bg-${themeColor}-50 border border-${themeColor}-200 rounded-lg flex items-start gap-2">
              <CheckCircle className="w-5 h-5 text-${themeColor}-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-${themeColor}-800">Invitation sent successfully!</p>
                <p className="text-xs text-${themeColor}-600 mt-1">The invitation email has been sent to {email}</p>
              </div>
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              User Type
            </label>
            <select
              value={userType}
              onChange={(e) => setUserType(e.target.value as 'attendant' | 'manager')}
              disabled={isSending || success}
              className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 disabled:bg-gray-100 disabled:cursor-not-allowed`}
            >
              <option value="attendant">Attendant</option>
              <option value="manager">Location Manager</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter email address"
              disabled={isSending || success}
              className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 disabled:bg-gray-100 disabled:cursor-not-allowed`}
            />
          </div>

          {generatedLink && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Invitation Link
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={generatedLink}
                  readOnly
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-sm text-gray-600"
                />
                <StandardButton
                  variant="secondary"
                  size="md"
                  icon={Copy}
                  onClick={copyToClipboard}
                  title="Copy to clipboard"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                This link will expire once the account is created
              </p>
            </div>
          )}
        </div>

        <div className="flex gap-3 p-6 border-t border-gray-200">
          <StandardButton
            variant="secondary"
            size="md"
            onClick={onClose}
            disabled={isSending}
            className="flex-1"
          >
            {success ? 'Close' : 'Cancel'}
          </StandardButton>
          {!success && (
            <StandardButton
              variant="primary"
              size="md"
              icon={Send}
              onClick={handleSend}
              disabled={!email || isSending}
              loading={isSending}
              className="flex-1"
            >
              {isSending ? 'Sending...' : 'Send Invitation'}
            </StandardButton>
          )}
        </div>
      </div>
    </div>
  );
};

const ManageAttendants = () => {
  const { themeColor, fullColor } = useThemeColor();
  const currentUser = getStoredUser();
  const isLocationManager = currentUser?.role === 'location_manager';
  const isCompanyAdmin = currentUser?.role === 'company_admin';
  const [attendants, setAttendants] = useState<AttendantRow[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvitationModal, setShowInvitationModal] = useState(false);
  const [showCreateStaffModal, setShowCreateStaffModal] = useState(false);
  const [viewTarget, setViewTarget] = useState<AttendantRow | null>(null);
  const [editTarget, setEditTarget] = useState<AttendantRow | null>(null);
  const [locationInfo, setLocationInfo] = useState<Location | null>(null);
  const [editLocationTarget, setEditLocationTarget] = useState<Location | null>(null);

  const statusColors = {
    active: `bg-${themeColor}-100 text-${fullColor}`,
    inactive: 'bg-gray-100 text-gray-800'
  };

  const departmentColors: Record<string, string> = {
    'Guest Services': `bg-${themeColor}-100 text-${fullColor}`,
    'Entertainment': `bg-${themeColor}-100 text-${fullColor}`,
    'Food & Beverage': `bg-${themeColor}-100 text-${fullColor}`,
    'Maintenance': `bg-${themeColor}-100 text-${fullColor}`,
    'Security': 'bg-red-100 text-red-800',
    'Administration': `bg-${themeColor}-100 text-${fullColor}`
  };

  const newAttendantsCount = attendants.filter(a => {
    const created = new Date(a.createdAt);
    const now = new Date();
    const diffDays = (now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
    return diffDays <= 30;
  }).length;

  const metrics = [
    {
      title: 'Total Attendants',
      value: attendants.length.toString(),
      change: `${attendants.filter(a => a.status === 'active').length} active`,
      accent: `bg-${themeColor}-100 text-${fullColor}`,
      icon: Users,
    },
    {
      title: 'Active Attendants',
      value: attendants.filter(a => a.status === 'active').length.toString(),
      change: `${attendants.filter(a => a.status === 'inactive').length} inactive`,
      accent: `bg-${themeColor}-100 text-${fullColor}`,
      icon: User,
    },
    {
      title: 'New Attendants',
      value: newAttendantsCount.toString(),
      change: 'Last 30 days',
      accent: `bg-${themeColor}-100 text-${fullColor}`,
      icon: Plus,
    },
    {
      title: 'Departments',
      value: [...new Set(attendants.map(a => a.department))].length.toString(),
      change: 'Different departments',
      accent: `bg-${themeColor}-100 text-${fullColor}`,
      icon: MapPin,
    }
  ];

  const loadAttendants = async () => {
    try {
      const userData = localStorage.getItem('zapzone_user');
      const authToken = userData ? JSON.parse(userData).token : null;

      if (!authToken) {
        console.error('No auth token found');
        setLoading(false);
        return;
      }

      const params = new URLSearchParams();
      params.append('role', 'attendant');

      const response = await fetch(`${API_BASE_URL}/users?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to load attendants');
      }

      const transformedAttendants: AttendantRow[] = data.data.users.map((user: Record<string, unknown>) => ({
        id: String(user.id),
        firstName: String(user.first_name || ''),
        lastName: String(user.last_name || ''),
        email: String(user.email || ''),
        phone: String(user.phone || ''),
        hireDate: String(user.hire_date || (typeof user.created_at === 'string' ? user.created_at.split('T')[0] : '')),
        position: String(user.position || 'Attendant'),
        employeeId: String(user.employee_id || `ZAP-${user.id}`),
        department: String(user.department || 'Guest Services'),
        shift: String(user.shift || ''),
        assignedAreas: [],
        status: (user.status as 'active' | 'inactive') || 'active',
        username: typeof user.email === 'string' ? user.email.split('@')[0] : '',
        createdAt: String(user.created_at || ''),
        accountCreated: true,
        locationId: user.location_id != null ? String(user.location_id) : '',
      }));

      setAttendants(transformedAttendants);
    } catch (error) {
      console.error('Error loading attendants:', error);
      setAttendants([]);
    } finally {
      setLoading(false);
    }
  };

  const loadLocationInfo = async () => {
    if (!currentUser?.location_id) return;
    try {
      const res = await locationService.getLocation(currentUser.location_id);
      if (res.success && res.data) {
        setLocationInfo(res.data);
      }
    } catch {
      setLocationInfo(null);
    }
  };

  const loadLocations = async () => {
    try {
      const response = await locationService.getLocations();
      setLocations(Array.isArray(response.data) ? response.data : []);
    } catch {
      setLocations([]);
    }
  };

  useEffect(() => {
    loadAttendants();
    if (isLocationManager) {
      loadLocationInfo();
    }
    if (isCompanyAdmin) {
      loadLocations();
    }
  }, []);

  const handleStatusChange = async (id: string, newStatus: AttendantRow['status']) => {
    try {
      const userData = localStorage.getItem('zapzone_user');
      const authToken = userData ? JSON.parse(userData).token : null;

      if (!authToken) {
        alert('Authentication required. Please log in again.');
        return;
      }

      const response = await fetch(`${API_BASE_URL}/users/${id}/toggle-status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to update status');
      }

      setAttendants(prev => prev.map(attendant =>
        attendant.id === id ? { ...attendant, status: newStatus } : attendant
      ));
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Failed to update attendant status. Please try again.');
    }
  };

  const handleDeleteAttendant = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this attendant? This action cannot be undone.')) {
      return;
    }

    try {
      const userData = localStorage.getItem('zapzone_user');
      const authToken = userData ? JSON.parse(userData).token : null;

      if (!authToken) {
        alert('Authentication required. Please log in again.');
        return;
      }

      const response = await fetch(`${API_BASE_URL}/users/${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to delete attendant');
      }

      setAttendants(prev => prev.filter(attendant => attendant.id !== id));
    } catch (error) {
      console.error('Error deleting attendant:', error);
      alert('Failed to delete attendant. Please try again.');
    }
  };

  const locationNameById = useMemo(() => {
    const map: Record<string, string> = {};
    locations.forEach(l => {
      map[String(l.id)] = l.name;
    });
    return map;
  }, [locations]);

  const getLocationName = (id: string) => (id ? locationNameById[id] || '' : '');

  const columns: AdminColumn<AttendantRow>[] = [
    {
      key: 'userId',
      label: 'User ID',
      group: 'Identifiers',
      sortable: true,
      sortValue: a => Number(a.id),
      exportValue: a => a.id,
      defaultVisible: false,
      render: a => <span className="whitespace-nowrap text-sm text-gray-900">#{a.id}</span>,
    },
    {
      key: 'employeeId',
      label: 'Employee ID',
      group: 'Identifiers',
      sortable: true,
      sortValue: a => a.employeeId,
      exportValue: a => a.employeeId,
      defaultVisible: false,
      render: a => <span className="whitespace-nowrap text-sm text-gray-900">{a.employeeId}</span>,
    },
    {
      key: 'attendant',
      label: 'Attendant',
      group: 'Attendant',
      sortable: true,
      sortValue: a => `${a.firstName} ${a.lastName}`.trim().toLowerCase(),
      exportValue: a => `${a.firstName} ${a.lastName}`.trim(),
      lockVisible: true,
      render: a => (
        <div>
          <div className="font-medium text-gray-900">
            {a.firstName} {a.lastName}
          </div>
          <div className="text-xs text-gray-600 mt-1">ID: {a.employeeId}</div>
        </div>
      ),
    },
    {
      key: 'contact',
      label: 'Contact',
      group: 'Contact',
      sortable: true,
      sortValue: a => a.email,
      exportValue: a => a.email,
      render: a => (
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm">
            <Mail className="h-3 w-3 text-gray-400" />
            <span className="text-gray-900">{a.email}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Phone className="h-3 w-3 text-gray-400" />
            <span className="text-gray-600">{a.phone}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'position',
      label: 'Position',
      group: 'Role',
      sortable: true,
      sortValue: a => a.position,
      exportValue: a => a.position,
      render: a => <span className="whitespace-nowrap text-sm text-gray-900">{a.position}</span>,
    },
    {
      key: 'department',
      label: 'Department',
      group: 'Role',
      sortable: true,
      sortValue: a => a.department,
      exportValue: a => a.department,
      render: a => (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${departmentColors[a.department] || 'bg-gray-100 text-gray-800'}`}>
          {a.department}
        </span>
      ),
    },
    {
      key: 'shift',
      label: 'Shift',
      group: 'Role',
      sortable: true,
      sortValue: a => a.shift,
      exportValue: a => a.shift,
      defaultVisible: false,
      render: a => <span className="whitespace-nowrap text-sm text-gray-900">{a.shift || '—'}</span>,
    },
    {
      key: 'location',
      label: 'Location',
      group: 'Role',
      sortable: true,
      sortValue: a => getLocationName(a.locationId),
      exportValue: a => getLocationName(a.locationId) || a.locationId,
      defaultVisible: false,
      render: a => <span className="whitespace-nowrap text-sm text-gray-900">{getLocationName(a.locationId) || '—'}</span>,
    },
    {
      key: 'experience',
      label: 'Experience',
      group: 'Dates',
      sortable: true,
      sortValue: a => getExperience(a.hireDate),
      exportValue: a => `${getExperience(a.hireDate)} months`,
      render: a => <span className="whitespace-nowrap text-sm text-gray-900">{getExperience(a.hireDate)} months</span>,
    },
    {
      key: 'hireDate',
      label: 'Hire Date',
      group: 'Dates',
      sortable: true,
      sortValue: a => a.hireDate,
      exportValue: a => a.hireDate,
      defaultVisible: false,
      render: a => (
        <span className="whitespace-nowrap text-sm text-gray-500">
          {a.hireDate ? formatDateOnly(a.hireDate) : '—'}
        </span>
      ),
    },
    {
      key: 'createdAt',
      label: 'Created',
      group: 'Dates',
      sortable: true,
      sortValue: a => new Date(a.createdAt || 0).getTime(),
      exportValue: a => (a.createdAt ? new Date(a.createdAt).toLocaleString() : ''),
      defaultVisible: false,
      render: a => (
        <span className="whitespace-nowrap text-sm text-gray-500">
          {a.createdAt ? formatDateTime(a.createdAt) : '—'}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      group: 'Status',
      sortable: true,
      sortValue: a => a.status,
      exportValue: a => a.status,
      render: a => (
        <select
          value={a.status}
          onChange={(e) => handleStatusChange(a.id, e.target.value as AttendantRow['status'])}
          className={`text-xs font-medium px-3 py-1 rounded-full ${statusColors[a.status]} border-none focus:ring-2 focus:ring-${themeColor}-400`}
        >
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      ),
    },
  ];

  const departmentOptions = useMemo(() => {
    const unique = [...new Set(attendants.map(a => a.department).filter(Boolean))].sort();
    return unique.map(d => ({ value: d, label: d }));
  }, [attendants]);

  const positionOptions = useMemo(() => {
    const unique = [...new Set(attendants.map(a => a.position).filter(Boolean))].sort();
    return unique.map(p => ({ value: p, label: p }));
  }, [attendants]);

  const shiftOptions = useMemo(() => {
    const unique = [...new Set(attendants.map(a => a.shift).filter(Boolean))].sort();
    return unique.map(s => ({ value: s, label: s }));
  }, [attendants]);

  const locationOptions = useMemo(
    () => locations.map(l => ({ value: String(l.id), label: l.name })),
    [locations]
  );

  const filterDefs: AdminFilterDef<AttendantRow>[] = useMemo(() => {
    const defs: AdminFilterDef<AttendantRow>[] = [
      {
        type: 'select',
        key: 'status',
        label: 'Status',
        allLabel: 'All Statuses',
        options: [
          { value: 'active', label: 'Active' },
          { value: 'inactive', label: 'Inactive' },
        ],
        predicate: (a, value) => a.status === value,
      },
      {
        type: 'select',
        key: 'department',
        label: 'Department',
        allLabel: 'All Departments',
        options: departmentOptions,
        predicate: (a, value) => a.department === value,
      },
      {
        type: 'select',
        key: 'position',
        label: 'Position',
        allLabel: 'All Positions',
        options: positionOptions,
        predicate: (a, value) => a.position === value,
      },
      {
        type: 'select',
        key: 'shift',
        label: 'Shift',
        allLabel: 'All Shifts',
        options: shiftOptions,
        predicate: (a, value) => a.shift === value,
      },
      {
        type: 'select',
        key: 'account',
        label: 'Account',
        allLabel: 'All Accounts',
        options: [
          { value: 'created', label: 'Account Created' },
          { value: 'pending', label: 'Invitation Pending' },
        ],
        predicate: (a, value) =>
          value === 'created' ? a.accountCreated !== false : a.accountCreated === false,
      },
      {
        type: 'daterange',
        key: 'hireDate',
        label: 'Hire Date',
        getDate: a => a.hireDate,
      },
      {
        type: 'daterange',
        key: 'createdDate',
        label: 'Created Date',
        getDate: a => a.createdAt,
      },
      {
        type: 'numberrange',
        key: 'experience',
        label: 'Experience (months)',
        getValue: a => getExperience(a.hireDate),
      },
    ];
    if (isCompanyAdmin) {
      defs.splice(4, 0, {
        type: 'select',
        key: 'location',
        label: 'Location',
        allLabel: 'All Locations',
        options: locationOptions,
        predicate: (a, value) => a.locationId === value,
      });
    }
    return defs;
  }, [departmentOptions, positionOptions, shiftOptions, locationOptions, isCompanyAdmin]);

  const table = useAdminTable<AttendantRow>({
    data: attendants,
    columns,
    getRowId: a => a.id,
    storageKey: 'attendants',
    filterDefs,
    searchFields: a => [
      a.firstName,
      a.lastName,
      `${a.firstName} ${a.lastName}`,
      a.email,
      a.phone,
      a.employeeId,
      a.department,
      a.position,
    ],
    defaultSort: (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime(),
    itemsPerPage: 10,
  });

  const handleBulkDelete = async () => {
    if (table.selectedIds.length === 0) return;

    if (!window.confirm(`Are you sure you want to delete ${table.selectedIds.length} attendant(s)? This action cannot be undone.`)) {
      return;
    }

    try {
      const ids = table.selectedIds.map(id => parseInt(id));

      const response = await userService.bulkDelete(ids);

      if (!response.success) {
        throw new Error(response.message || 'Failed to delete attendants');
      }

      const deletedCount = table.selectedIds.length;
      const deletedIds = [...table.selectedIds];
      setAttendants(prev => prev.filter(attendant => !deletedIds.includes(attendant.id)));
      table.clearSelection();

      alert(`Successfully deleted ${deletedCount} attendant(s)`);
    } catch (error) {
      console.error('Error deleting attendants:', error);
      alert('Failed to delete some attendants. Please try again.');
    }
  };

  const handleBulkStatusChange = async (newStatus: AttendantRow['status']) => {
    if (table.selectedIds.length === 0) return;

    try {
      const userData = localStorage.getItem('zapzone_user');
      const authToken = userData ? JSON.parse(userData).token : null;

      if (!authToken) {
        alert('Authentication required. Please log in again.');
        return;
      }

      const selected = [...table.selectedIds];

      await Promise.all(selected.map(id =>
        fetch(`${API_BASE_URL}/users/${id}/toggle-status`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`,
          },
        })
      ));

      setAttendants(prev => prev.map(attendant =>
        selected.includes(attendant.id) ? { ...attendant, status: newStatus } : attendant
      ));
      table.clearSelection();
    } catch (error) {
      console.error('Error updating attendant status:', error);
      alert('Failed to update some attendant statuses. Please try again.');
    }
  };

  const exportToCSV = () => {
    exportTableCsv({
      filename: `attendants-export-${new Date().toISOString().split('T')[0]}.csv`,
      columns,
      rows: table.filteredRows,
      extraColumns: [
        { label: 'First Name', value: a => a.firstName },
        { label: 'Last Name', value: a => a.lastName },
        { label: 'Phone', value: a => a.phone },
        { label: 'Username', value: a => a.username },
        { label: 'Account Created', value: a => (a.accountCreated === false ? 'No' : 'Yes') },
      ],
    });
  };

  const handleSendInvitation = () => {
    loadAttendants();
  };

  const handleInviteAttendant = () => {
    setShowInvitationModal(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className={`animate-spin rounded-full h-12 w-12 border-b-2 border-${fullColor}`}></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 px-6 py-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Manage Attendants</h1>
          <p className="text-gray-600 mt-2">View and manage all staff members in your facility</p>
        </div>
        <div className="flex gap-2 mt-4 sm:mt-0">
          <StandardButton
            variant="secondary"
            size="md"
            icon={Download}
            onClick={exportToCSV}
          >
            Export CSV
          </StandardButton>
          <StandardButton
            variant="secondary"
            size="md"
            icon={Send}
            onClick={() => handleInviteAttendant()}
          >
            Send Invitation
          </StandardButton>
          <StandardButton
            variant="primary"
            size="md"
            icon={UserPlus}
            onClick={() => setShowCreateStaffModal(true)}
          >
            Create Staff Account
          </StandardButton>
        </div>
      </div>

      {isLocationManager && locationInfo && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-6 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg bg-${themeColor}-100`}>
                <Building2 className={`h-5 w-5 text-${themeColor}-600`} />
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Your Location</p>
                <p className="font-semibold text-gray-900">{locationInfo.name}</p>
                {(locationInfo.address || locationInfo.city) && (
                  <p className="text-xs text-gray-500 mt-0.5">
                    {[locationInfo.address, locationInfo.city, locationInfo.state, locationInfo.zip_code].filter(Boolean).join(', ')}
                  </p>
                )}
                <div className="flex gap-4 mt-1">
                  {locationInfo.phone && (
                    <span className="text-xs text-gray-400 flex items-center gap-1">
                      <Phone className="h-3 w-3" />{locationInfo.phone}
                    </span>
                  )}
                  {locationInfo.email && (
                    <span className="text-xs text-gray-400 flex items-center gap-1">
                      <Mail className="h-3 w-3" />{locationInfo.email}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <button
              onClick={() => setEditLocationTarget(locationInfo)}
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              title="Edit location details"
            >
              <Pencil className="h-4 w-4" />
              Edit
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {metrics.map((metric, index) => {
          const Icon = metric.icon;
          return (
            <div
              key={index}
              className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex flex-col gap-2 hover:shadow-md transition-shadow min-h-[120px]"
            >
              <div className="flex items-center gap-2 mb-2">
                <div className={`p-2 rounded-lg ${metric.accent}`}>
                  <Icon size={20} />
                </div>
                <span className="text-base font-semibold text-gray-800">{metric.title}</span>
              </div>
              <div className="flex items-end gap-2 mt-2">
                <CounterAnimation value={metric.value} className="text-2xl font-bold text-gray-900" />
              </div>
              <p className="text-xs mt-1 text-gray-400">{metric.change}</p>
            </div>
          );
        })}
      </div>

      <AdminTableToolbar
        table={table}
        searchPlaceholder="Search attendants..."
        onRefresh={loadAttendants}
      />

      <BulkActionsBar table={table} itemLabel="attendant(s)">
        <select
          onChange={(e) => {
            if (e.target.value) {
              handleBulkStatusChange(e.target.value as AttendantRow['status']);
            }
          }}
          className={`border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-${themeColor}-400`}
        >
          <option value="">Change Status</option>
          <option value="active">Activate</option>
          <option value="inactive">Deactivate</option>
        </select>
        <StandardButton
          variant="danger"
          size="md"
          icon={Trash2}
          onClick={handleBulkDelete}
        >
          Delete
        </StandardButton>
      </BulkActionsBar>

      <AdminDataTable
        table={table}
        selectable
        itemLabel="attendants"
        emptyMessage="No attendants found"
        renderActions={(attendant) => (
          <div className="flex items-center gap-3">
            <button
              onClick={() => setViewTarget(attendant)}
              className={`text-${themeColor}-600 hover:text-${themeColor}-800`}
              title="View Profile"
            >
              <Eye className="h-4 w-4" />
            </button>
            <button
              onClick={() => setEditTarget(attendant)}
              className="text-gray-600 hover:text-gray-800"
              title="Edit"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <StandardButton
              variant="danger"
              size="sm"
              icon={Trash2}
              onClick={() => handleDeleteAttendant(attendant.id)}
              title="Delete"
              className="!p-1 !bg-transparent hover:!bg-red-50"
            />
          </div>
        )}
      />

      <InvitationModal
        isOpen={showInvitationModal}
        onClose={() => setShowInvitationModal(false)}
        onSendInvitation={handleSendInvitation}
      />

      <CreateStaffAccountModal
        isOpen={showCreateStaffModal}
        onClose={() => setShowCreateStaffModal(false)}
        onCreated={() => loadAttendants()}
      />

      <AttendantViewModal
        isOpen={viewTarget !== null}
        onClose={() => setViewTarget(null)}
        attendant={viewTarget}
      />

      <AttendantEditModal
        isOpen={editTarget !== null}
        onClose={() => setEditTarget(null)}
        attendant={editTarget}
        onSaved={(updated) => {
          setAttendants((prev) =>
            prev.map((a) => (a.id === updated.id ? { ...a, ...updated } : a))
          );
          setEditTarget(null);
        }}
      />

      <EditLocationModal
        isOpen={editLocationTarget !== null}
        onClose={() => setEditLocationTarget(null)}
        location={editLocationTarget}
        onUpdated={(updated) => {
          setLocationInfo(updated);
          setEditLocationTarget(null);
          const storedUser = getStoredUser();
          if (storedUser && storedUser.location_id === updated.id) {
            setStoredUser({ ...storedUser, location_name: updated.name }, true);
          }
        }}
      />
    </div>
  );
};

export default ManageAttendants;
