import { useState, useEffect, useMemo } from 'react';
import {
  Eye,
  Pencil,
  Trash2,
  Plus,
  Users,
  Mail,
  Phone,
  MapPin,
  Send,
  X,
  Copy,
  Shield,
  UserCheck,
  CheckCircle,
  UserPlus,
  Building2,
  KeyRound,
  Download
} from 'lucide-react';
import { useThemeColor } from '../../../hooks/useThemeColor';
import CounterAnimation from '../../../components/ui/CounterAnimation';
import StandardButton from '../../../components/ui/StandardButton';
import ActionMenu from '../../../components/ui/ActionMenu';
import { API_BASE_URL } from '../../../utils/storage';
import { locationService } from '../../../services';
import { userService } from '../../../services/UserService';
import { getStoredUser } from '../../../utils/storage';
import CreateStaffAccountModal from '../../../components/admin/users/CreateStaffAccountModal';
import CreateLocationModal from '../../../components/admin/users/CreateLocationModal';
import EditLocationModal from '../../../components/admin/users/EditLocationModal';
import LocationsListModal from '../../../components/admin/users/LocationsListModal';
import ResendCredentialsModal from '../../../components/admin/users/ResendCredentialsModal';
import AccountViewModal from '../../../components/admin/users/AccountViewModal';
import AccountEditModal from '../../../components/admin/users/AccountEditModal';
import type { Location } from '../../../services/LocationService';
import type {
  ManageAccountsAccount,
  ManageAccountsInvitationModalProps
} from '../../../types/ManageAccounts.types';
import {
  AdminDataTable,
  AdminTableToolbar,
  BulkActionsBar,
  exportTableCsv,
  useAdminTable,
} from '../../../components/admin/table';
import type { AdminColumn, AdminFilterDef } from '../../../components/admin/table';

const InvitationModal: React.FC<ManageAccountsInvitationModalProps> = ({
  isOpen,
  onClose,
  onSendInvitation,
  defaultEmail = '',
  defaultUserType = 'attendant'
}) => {
  const { themeColor } = useThemeColor();
  const [email, setEmail] = useState(defaultEmail);
  const [userType, setUserType] = useState<'attendant' | 'manager' | 'company_admin'>(defaultUserType as 'attendant' | 'manager' | 'company_admin');
  const [selectedLocationId, setSelectedLocationId] = useState<string>('');
  const [locations, setLocations] = useState<Array<{ id: number; name: string }>>([]);
  const [generatedLink, setGeneratedLink] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setEmail(defaultEmail);
      setUserType(defaultUserType);
      setSelectedLocationId('');
      setGeneratedLink('');
      setError('');
      setSuccess(false);

      fetchLocations();
    }
  }, [isOpen, defaultEmail, defaultUserType]);

  const fetchLocations = async () => {
    try {
      const response = await locationService.getLocations({ per_page: 100 });

      if (response.success) {
        const locationsList = Array.isArray(response.data) ? response.data : [];
        setLocations(locationsList);
      }
    } catch (error) {
      console.error('Error fetching locations:', error);
    }
  };

  const handleSend = async () => {
    if (!email) {
      setError('Please enter an email address');
      return;
    }

    if (userType === 'attendant' && !selectedLocationId) {
      setError('Please select a location for the attendant');
      return;
    }

    setIsSending(true);
    setError('');
    setSuccess(false);

    try {
      const role = userType === 'manager' ? 'location_manager' : userType === 'company_admin' ? 'company_admin' : 'attendant';

      const userData = localStorage.getItem('zapzone_user');
      const user = userData ? JSON.parse(userData) : null;

      const requestBody: Record<string, string> = {
        email: email,
        role: role,
      };

      if (user?.company_id) {
        requestBody.company_id = String(user.company_id);
      }

      if (role === 'attendant' && selectedLocationId) {
        requestBody.location_id = selectedLocationId;
      } else if (role === 'location_manager' && user?.location_id) {
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-backdrop-fade" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-lg max-w-md w-full" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Send Account Invitation</h3>
          <StandardButton
            onClick={onClose}
            disabled={isSending}
            variant="ghost"
            size="sm"
            icon={X}
          />
        </div>

        <div className="p-6 space-y-4">
          {success && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex items-start gap-2">
              <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-green-800">Invitation sent successfully!</p>
                <p className="text-xs text-green-600 mt-1">The invitation email has been sent to {email}</p>
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
              onChange={(e) => {
                setUserType(e.target.value as 'attendant' | 'manager' | 'company_admin');
                setSelectedLocationId('');
              }}
              disabled={isSending || success}
              className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 disabled:bg-gray-100 disabled:cursor-not-allowed`}
            >
              <option value="company_admin">Company Admin</option>
              <option value="manager">Location Manager</option>
              <option value="attendant">Attendant</option>
            </select>
          </div>

          {userType === 'attendant' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Location <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedLocationId}
                onChange={(e) => setSelectedLocationId(e.target.value)}
                disabled={isSending || success}
                className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 disabled:bg-gray-100 disabled:cursor-not-allowed`}
              >
                <option value="">Select a location</option>
                {locations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name}
                  </option>
                ))}
              </select>
            </div>
          )}

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
                  onClick={copyToClipboard}
                  variant="secondary"
                  size="md"
                  icon={Copy}
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
            onClick={onClose}
            disabled={isSending}
            variant="secondary"
            size="md"
            fullWidth
          >
            {success ? 'Close' : 'Cancel'}
          </StandardButton>
          {!success && (
            <StandardButton
              onClick={handleSend}
              disabled={!email || isSending}
              variant="primary"
              size="md"
              icon={isSending ? undefined : Send}
              loading={isSending}
              fullWidth
            >
              {isSending ? 'Sending...' : 'Send Invitation'}
            </StandardButton>
          )}
        </div>
      </div>
    </div>
  );
};

const ManageAccounts = () => {
  const { themeColor, fullColor } = useThemeColor();
  const [accounts, setAccounts] = useState<ManageAccountsAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvitationModal, setShowInvitationModal] = useState(false);
  const [showCreateStaffModal, setShowCreateStaffModal] = useState(false);
  const [showCreateLocationModal, setShowCreateLocationModal] = useState(false);
  const [resendTarget, setResendTarget] = useState<{ id: number; first_name?: string; last_name?: string; email: string } | null>(null);
  const [viewTarget, setViewTarget] = useState<ManageAccountsAccount | null>(null);
  const [editTarget, setEditTarget] = useState<ManageAccountsAccount | null>(null);
  const currentUser = getStoredUser();
  const isCompanyAdmin = currentUser?.role === 'company_admin';
  const [locationsData, setLocationsData] = useState<Location[]>([]);
  const [locationsLoading, setLocationsLoading] = useState(false);
  const [showLocationsModal, setShowLocationsModal] = useState(false);
  const [editLocationTarget, setEditLocationTarget] = useState<Location | null>(null);

  const statusColors: Record<ManageAccountsAccount['status'], string> = {
    active: 'bg-green-100 text-green-800',
    inactive: 'bg-gray-100 text-gray-800'
  };

  const userTypeBadgeColor = `bg-${themeColor}-100 text-${fullColor}`;

  const departmentBadgeColor = `bg-${themeColor}-100 text-${fullColor}`;
  const foodBeverageBadgeColor = 'bg-yellow-100 text-yellow-800';

  const newAccountsCount = accounts.filter(a => {
    const created = new Date(a.createdAt);
    const now = new Date();
    const diffDays = (now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
    return diffDays <= 30;
  }).length;

  const metrics = [
    {
      title: 'Total Accounts',
      value: accounts.length.toString(),
      change: `${accounts.filter(a => a.status === 'active').length} active`,
      accent: `bg-${themeColor}-100 text-${fullColor}`,
      icon: Users,
    },
    {
      title: 'Location Managers',
      value: accounts.filter(a => a.userType === 'manager').length.toString(),
      change: `${accounts.filter(a => a.userType === 'manager' && a.status === 'active').length} active`,
      accent: `bg-${themeColor}-100 text-${fullColor}`,
      icon: Shield,
    },
    {
      title: 'Attendants',
      value: accounts.filter(a => a.userType === 'attendant').length.toString(),
      change: `${accounts.filter(a => a.userType === 'attendant' && a.status === 'active').length} active`,
      accent: `bg-${themeColor}-100 text-${fullColor}`,
      icon: UserCheck,
    },
    {
      title: 'New Accounts',
      value: newAccountsCount.toString(),
      change: 'Last 30 days',
      accent: `bg-${themeColor}-100 text-${fullColor}`,
      icon: Plus,
    }
  ];

  const loadLocations = async () => {
    try {
      setLocationsLoading(true);
      const res = await locationService.getLocations();
      if (res.success) {
        setLocationsData(Array.isArray(res.data) ? res.data : []);
      }
    } catch {
      setLocationsData([]);
    } finally {
      setLocationsLoading(false);
    }
  };

  const loadAccounts = async () => {
    try {
      const userData = localStorage.getItem('zapzone_user');
      const authToken = userData ? JSON.parse(userData).token : null;

      if (!authToken) {
        console.error('No auth token found');
        setLoading(false);
        return;
      }

      const response = await fetch(`${API_BASE_URL}/users`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to load accounts');
      }

      const transformedAccounts: ManageAccountsAccount[] = data.data.users.map((user: Record<string, unknown>) => ({
        id: String(user.id),
        firstName: String(user.first_name || ''),
        lastName: String(user.last_name || ''),
        email: String(user.email || ''),
        phone: String(user.phone || ''),
        hireDate: String(user.hire_date || (typeof user.created_at === 'string' ? user.created_at.split('T')[0] : '')),
        position: String(user.position || (user.role === 'company_admin' ? 'Company Admin' : user.role === 'location_manager' ? 'Location Manager' : 'Attendant')),
        employeeId: String(user.employee_id || `ZAP-${user.id}`),
        department: String(user.department || 'Administration'),
        location: (user.location as { name?: string })?.name || 'Unknown',
        userType: user.role === 'location_manager' ? 'manager' : (user.role === 'company_admin' ? 'company_admin' : 'attendant'),
        shift: String(user.shift || ''),
        assignedAreas: [],
        status: (user.status as 'active' | 'inactive') || 'active',
        username: typeof user.email === 'string' ? user.email.split('@')[0] : '',
        createdAt: String(user.created_at || ''),
        accountCreated: true,
        lastLogin: user.last_login ? String(user.last_login) : undefined,
      }));

      setAccounts(transformedAccounts);
    } catch (error) {
      console.error('Error loading accounts:', error);
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAccounts();
    if (isCompanyAdmin) {
      loadLocations();
    }
  }, []);

  const handleStatusChange = async (id: string, newStatus: ManageAccountsAccount['status']) => {
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

      setAccounts(prev => prev.map(account =>
        account.id === id ? { ...account, status: newStatus } : account
      ));
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Failed to update account status. Please try again.');
    }
  };

  const handleDeleteAccount = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this account? This action cannot be undone.')) {
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
        throw new Error(data.message || 'Failed to delete account');
      }

      setAccounts(prev => prev.filter(account => account.id !== id));
    } catch (error) {
      console.error('Error deleting account:', error);
      alert('Failed to delete account. Please try again.');
    }
  };

  const handleSendInvitation = () => {
    loadAccounts();
  };

  const handleInviteAccount = () => {
    setShowInvitationModal(true);
  };

  const formatLastLogin = (lastLogin?: string) => {
    if (!lastLogin) return 'Never';
    const date = new Date(lastLogin);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;

    return date.toLocaleDateString();
  };

  const roleLabel = (account: ManageAccountsAccount) =>
    account.userType === 'manager' ? 'Location Manager' : account.userType === 'company_admin' ? 'Company Admin' : 'Attendant';

  const columns: AdminColumn<ManageAccountsAccount>[] = [
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
      key: 'account',
      label: 'Account',
      group: 'Account',
      sortable: true,
      sortValue: a => `${a.firstName} ${a.lastName}`,
      exportValue: a => `${a.firstName} ${a.lastName}`,
      render: a => (
        <div className="font-medium text-gray-900">
          {a.firstName} {a.lastName}
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
            {a.phone ? <><Phone className="h-3 w-3 text-gray-400" />
            <span className="text-gray-600">{a.phone}</span></> : null}
          </div>
        </div>
      ),
    },
    {
      key: 'typeLocation',
      label: 'Type & Location',
      group: 'Role & Location',
      sortable: true,
      sortValue: a => `${roleLabel(a)} ${a.location}`,
      exportValue: a => roleLabel(a),
      render: a => (
        <div className="space-y-2">
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${userTypeBadgeColor}`}>
            {roleLabel(a)}
          </span>
          {a.location !== 'Unknown' ? <div className="flex items-center gap-1 text-xs text-gray-600">
            <MapPin className="h-3 w-3" />
            {a.location}
          </div> : null}
        </div>
      ),
    },
    {
      key: 'department',
      label: 'Department',
      group: 'Account',
      sortable: true,
      sortValue: a => a.department,
      exportValue: a => a.department,
      render: a => (
        <span className={`inline-flex items-center whitespace-nowrap px-2.5 py-0.5 rounded-full text-xs font-medium ${a.department === 'Food & Beverage' ? foodBeverageBadgeColor : departmentBadgeColor}`}>
          {a.department}
        </span>
      ),
    },
    {
      key: 'position',
      label: 'Position',
      group: 'Account',
      sortable: true,
      sortValue: a => a.position,
      exportValue: a => a.position,
      defaultVisible: false,
      render: a => <span className="whitespace-nowrap text-sm text-gray-900">{a.position || '—'}</span>,
    },
    {
      key: 'lastLogin',
      label: 'Last Login',
      group: 'Activity',
      sortable: true,
      sortValue: a => (a.lastLogin ? new Date(a.lastLogin).getTime() : 0),
      exportValue: a => (a.lastLogin ? new Date(a.lastLogin).toLocaleString() : 'Never'),
      render: a => <span className="whitespace-nowrap text-sm text-gray-900">{formatLastLogin(a.lastLogin)}</span>,
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
          {a.createdAt ? new Date(a.createdAt).toLocaleDateString() : '—'}
        </span>
      ),
    },
    {
      key: 'hireDate',
      label: 'Hire Date',
      group: 'Dates',
      sortable: true,
      sortValue: a => a.hireDate,
      exportValue: a => a.hireDate,
      defaultVisible: false,
      render: a => <span className="whitespace-nowrap text-sm text-gray-500">{a.hireDate || '—'}</span>,
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
          onChange={(e) => handleStatusChange(a.id, e.target.value as ManageAccountsAccount['status'])}
          className={`text-xs font-medium px-3 py-1 rounded-full ${statusColors[a.status]} border-none focus:ring-2 focus:ring-${themeColor}-500`}
        >
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      ),
    },
  ];

  const departmentOptions = useMemo(() => {
    const unique = [...new Set(accounts.map(a => a.department).filter(Boolean))].sort();
    return unique.map(dept => ({ value: dept, label: dept }));
  }, [accounts]);

  const locationOptions = useMemo(() => {
    const names = new Set<string>();
    accounts.forEach(a => {
      if (a.location && a.location !== 'Unknown') names.add(a.location);
    });
    locationsData.forEach(l => {
      if (l.name) names.add(l.name);
    });
    return [...names].sort().map(name => ({ value: name, label: name }));
  }, [accounts, locationsData]);

  const filterDefs: AdminFilterDef<ManageAccountsAccount>[] = useMemo(() => [
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
      key: 'userType',
      label: 'User Type',
      allLabel: 'All Types',
      options: [
        { value: 'company_admin', label: 'Company Admins' },
        { value: 'manager', label: 'Location Managers' },
        { value: 'attendant', label: 'Attendants' },
      ],
      predicate: (a, value) => a.userType === value,
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
      key: 'location',
      label: 'Location',
      allLabel: 'All Locations',
      options: locationOptions,
      predicate: (a, value) => a.location === value,
    },
    {
      type: 'select',
      key: 'lastLogin',
      label: 'Last Login',
      allLabel: 'Any Time',
      options: [
        { value: 'never', label: 'Never' },
        { value: 'today', label: 'Today' },
        { value: '7', label: 'Last 7 Days' },
        { value: '30', label: 'Last 30 Days' },
      ],
      predicate: (a, value) => {
        if (value === 'never') return !a.lastLogin;
        if (!a.lastLogin) return false;
        const diffDays = Math.floor((Date.now() - new Date(a.lastLogin).getTime()) / (1000 * 60 * 60 * 24));
        if (value === 'today') return diffDays === 0;
        if (value === '7') return diffDays <= 7;
        if (value === '30') return diffDays <= 30;
        return true;
      },
    },
    {
      type: 'daterange',
      key: 'createdDate',
      label: 'Created Date',
      getDate: a => a.createdAt,
    },
    {
      type: 'daterange',
      key: 'hireDate',
      label: 'Hire Date',
      getDate: a => a.hireDate,
    },
  ], [departmentOptions, locationOptions]);

  const table = useAdminTable<ManageAccountsAccount>({
    data: accounts,
    columns,
    getRowId: a => a.id,
    storageKey: 'accounts',
    filterDefs,
    searchFields: a => [
      a.firstName,
      a.lastName,
      a.email,
      a.phone,
      a.employeeId,
      a.department,
      a.location,
      a.position,
    ],
    defaultSort: (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime(),
    itemsPerPage: 10,
  });

  const handleBulkDelete = async () => {
    if (table.selectedIds.length === 0) return;

    if (!window.confirm(`Are you sure you want to delete ${table.selectedIds.length} account(s)? This action cannot be undone.`)) {
      return;
    }

    try {
      const ids = table.selectedIds.map(id => parseInt(id));

      const response = await userService.bulkDelete(ids);

      if (!response.success) {
        throw new Error(response.message || 'Failed to delete accounts');
      }

      const deletedCount = table.selectedIds.length;
      setAccounts(prev => prev.filter(account => !table.selectedIds.includes(account.id)));
      table.clearSelection();

      alert(`Successfully deleted ${deletedCount} account(s)`);
    } catch (error) {
      console.error('Error deleting accounts:', error);
      alert('Failed to delete some accounts. Please try again.');
    }
  };

  const handleBulkStatusChange = async (newStatus: ManageAccountsAccount['status']) => {
    if (table.selectedIds.length === 0) return;

    try {
      const userData = localStorage.getItem('zapzone_user');
      const authToken = userData ? JSON.parse(userData).token : null;

      if (!authToken) {
        alert('Authentication required. Please log in again.');
        return;
      }

      await Promise.all(table.selectedIds.map(id =>
        fetch(`${API_BASE_URL}/users/${id}/toggle-status`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`,
          },
        })
      ));

      setAccounts(prev => prev.map(account =>
        table.selectedIds.includes(account.id) ? { ...account, status: newStatus } : account
      ));
      table.clearSelection();
    } catch (error) {
      console.error('Error updating account status:', error);
      alert('Failed to update some account statuses. Please try again.');
    }
  };

  const exportToCSV = () => {
    exportTableCsv({
      filename: `accounts-export-${new Date().toISOString().split('T')[0]}.csv`,
      columns,
      rows: table.filteredRows,
      extraColumns: [
        { label: 'User ID', value: a => a.id },
        { label: 'First Name', value: a => a.firstName },
        { label: 'Last Name', value: a => a.lastName },
        { label: 'Phone', value: a => a.phone },
        { label: 'Location', value: a => (a.location !== 'Unknown' ? a.location : '') },
        { label: 'Username', value: a => a.username },
        { label: 'Shift', value: a => a.shift || '' },
      ],
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className={`animate-spin rounded-full h-12 w-12 border-b-2 border-${fullColor}`}></div>
      </div>
    );
  }

  return (
    <div className="px-6 py-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Manage Accounts</h1>
          <p className="text-gray-600 mt-2">Manage all attendant and location manager accounts</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 mt-4 sm:mt-0">
          {isCompanyAdmin && (
            <ActionMenu
              label="Locations"
              icon={MapPin}
              items={[
                { label: 'View Locations', icon: MapPin, onClick: () => setShowLocationsModal(true) },
                { label: 'Add Location', icon: Building2, onClick: () => setShowCreateLocationModal(true) },
              ]}
            />
          )}
          <StandardButton
            onClick={() => handleInviteAccount()}
            variant="secondary"
            size="md"
            icon={Send}
          >
            Send Invitation
          </StandardButton>
          <StandardButton
            onClick={() => setShowCreateStaffModal(true)}
            variant="primary"
            size="md"
            icon={UserPlus}
          >
            Create Staff Account
          </StandardButton>
        </div>
      </div>

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
        searchPlaceholder="Search accounts..."
        onRefresh={() => loadAccounts()}
        actions={
          <StandardButton
            onClick={exportToCSV}
            variant="secondary"
            size="sm"
            icon={Download}
          >
            Export CSV
          </StandardButton>
        }
      />

      <BulkActionsBar table={table} itemLabel="account(s)">
        <select
          onChange={(e) => handleBulkStatusChange(e.target.value as ManageAccountsAccount['status'])}
          className={`border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-${themeColor}-500`}
        >
          <option value="">Change Status</option>
          <option value="active">Activate</option>
          <option value="inactive">Deactivate</option>
        </select>
        <StandardButton
          onClick={handleBulkDelete}
          variant="danger"
          size="sm"
          icon={Trash2}
        >
          Delete
        </StandardButton>
      </BulkActionsBar>

      <AdminDataTable
        table={table}
        selectable
        itemLabel="accounts"
        emptyMessage="No accounts found"
        renderActions={(account) => (
          <div className="flex items-center gap-3">
            <button
              onClick={() => setViewTarget(account)}
              className={`text-${themeColor}-600 hover:text-${themeColor}-800`}
              title="View Profile"
            >
              <Eye className="h-4 w-4" />
            </button>
            <button
              onClick={() => setEditTarget(account)}
              className="text-gray-600 hover:text-gray-800"
              title="Edit"
            >
              <Pencil className="h-4 w-4" />
            </button>
            {isCompanyAdmin && (
              <StandardButton
                onClick={() => setResendTarget({
                  id: parseInt(account.id, 10),
                  first_name: account.firstName,
                  last_name: account.lastName,
                  email: account.email,
                })}
                variant="ghost"
                size="sm"
                icon={KeyRound}
                className="text-amber-600 hover:text-amber-800"
                title="Resend credentials"
              />
            )}
            <StandardButton
              onClick={() => handleDeleteAccount(account.id)}
              variant="ghost"
              size="sm"
              icon={Trash2}
              className="text-red-600 hover:text-red-800"
              title="Delete"
            />
          </div>
        )}
      />

      <InvitationModal
        isOpen={showInvitationModal}
        onClose={() => setShowInvitationModal(false)}
        onSendInvitation={handleSendInvitation}
        defaultEmail=''
        defaultUserType='attendant'
      />

      <CreateStaffAccountModal
        isOpen={showCreateStaffModal}
        onClose={() => setShowCreateStaffModal(false)}
        onCreated={() => loadAccounts()}
      />

      <CreateLocationModal
        isOpen={showCreateLocationModal}
        onClose={() => setShowCreateLocationModal(false)}
      />

      <ResendCredentialsModal
        isOpen={resendTarget !== null}
        onClose={() => setResendTarget(null)}
        user={resendTarget}
      />

      <AccountViewModal
        isOpen={viewTarget !== null}
        onClose={() => setViewTarget(null)}
        account={viewTarget}
      />

      <AccountEditModal
        isOpen={editTarget !== null}
        onClose={() => setEditTarget(null)}
        account={editTarget}
        onSaved={(updated) => {
          setAccounts((prev) =>
            prev.map((a) => (a.id === updated.id ? updated : a))
          );
          setEditTarget(null);
        }}
      />

      <LocationsListModal
        isOpen={showLocationsModal}
        onClose={() => setShowLocationsModal(false)}
        locations={locationsData}
        loading={locationsLoading}
        onEditLocation={(loc) => setEditLocationTarget(loc)}
      />

      <EditLocationModal
        isOpen={editLocationTarget !== null}
        onClose={() => setEditLocationTarget(null)}
        location={editLocationTarget}
        elevated={showLocationsModal}
        onUpdated={(updated) => {
          setLocationsData((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
          setEditLocationTarget(null);
        }}
      />
    </div>
  );
};

export default ManageAccounts;
