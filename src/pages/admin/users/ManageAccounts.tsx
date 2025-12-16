import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { 
  Eye, 
  Pencil, 
  Trash2, 
  Plus, 
  Search, 
  Filter, 
  RefreshCcw,
  Users,
  Mail,
  Phone,
  MapPin,
  Send,
  X,
  Copy,
  Shield,
  UserCheck,
  CheckCircle
} from 'lucide-react';
import { useThemeColor } from '../../../hooks/useThemeColor';
import CounterAnimation from '../../../components/ui/CounterAnimation';
import { API_BASE_URL } from '../../../utils/storage';
import { locationService } from '../../../services';
import { userService } from '../../../services/UserService';
import type { 
  ManageAccountsAccount, 
  ManageAccountsFilterOptions, 
  ManageAccountsInvitationModalProps 
} from '../../../types/ManageAccounts.types';

const InvitationModal: React.FC<ManageAccountsInvitationModalProps> = ({ 
  isOpen, 
  onClose, 
  onSendInvitation,
  defaultEmail = '',
  defaultUserType = 'attendant'
}) => {
  const { themeColor, fullColor } = useThemeColor();
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
      
      // Fetch locations when modal opens
      fetchLocations();
    }
  }, [isOpen, defaultEmail, defaultUserType]);

  const fetchLocations = async () => {
    try {
      const response = await locationService.getLocations({ per_page: 100 });
      console.log('Location API Response:', response);

      if (response.success) {
        // API returns data as array directly, not data.locations
        const locationsList = Array.isArray(response.data) ? response.data : [];
        console.log('Locations list:', locationsList);
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

    // Validate location selection for attendant
    if (userType === 'attendant' && !selectedLocationId) {
      setError('Please select a location for the attendant');
      return;
    }

    setIsSending(true);
    setError('');
    setSuccess(false);

    try {
      // Map userType to backend role
      const role = userType === 'manager' ? 'location_manager' : userType === 'company_admin' ? 'company_admin' : 'attendant';

      // Get optional user data for company_id and location_id
      const userData = localStorage.getItem('zapzone_user');
      const user = userData ? JSON.parse(userData) : null;

      // Prepare request body
      const requestBody: Record<string, string> = {
        email: email,
        role: role,
      };

      // Add company_id if available
      if (user?.company_id) {
        requestBody.company_id = String(user.company_id);
      }

      // Add location_id based on user type
      if (role === 'attendant' && selectedLocationId) {
        // For attendant, use the selected location
        requestBody.location_id = selectedLocationId;
      } else if (role === 'location_manager' && user?.location_id) {
        // For manager, use current user's location
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
      console.log(data)

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to create invitation');
      }

      // Set the generated link from backend
      setGeneratedLink(data.data.link);
      setSuccess(true);

      // Call the parent callback
      if (onSendInvitation) {
        onSendInvitation(email, userType);
      }

      // Show success message
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
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Send Account Invitation</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            disabled={isSending}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Success Message */}
          {success && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex items-start gap-2">
              <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-green-800">Invitation sent successfully!</p>
                <p className="text-xs text-green-600 mt-1">The invitation email has been sent to {email}</p>
              </div>
            </div>
          )}

          {/* Error Message */}
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
                setSelectedLocationId(''); // Reset location when user type changes
              }}
              disabled={isSending || success}
              className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 disabled:bg-gray-100 disabled:cursor-not-allowed`}
            >
              <option value="company_admin">Company Admin</option>
              <option value="manager">Location Manager</option>
              <option value="attendant">Attendant</option>
            </select>
          </div>

          {/* Location Selector - Only for Attendant */}
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

          {/* Show generated link after successful creation */}
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
                <button
                  onClick={copyToClipboard}
                  className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  title="Copy to clipboard"
                >
                  <Copy className="h-4 w-4" />
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                This link will expire once the account is created
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            disabled={isSending}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            {success ? 'Close' : 'Cancel'}
          </button>
          {!success && (
            <button
              onClick={handleSend}
              disabled={!email || isSending}
              className={`flex-1 px-4 py-2 bg-${fullColor} text-white rounded-lg hover:bg-${themeColor}-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2`}
            >
              {isSending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Send Invitation
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const ManageAccounts = () => {
  const { themeColor, fullColor } = useThemeColor();
  const [accounts, setAccounts] = useState<ManageAccountsAccount[]>([]);
  const [filteredAccounts, setFilteredAccounts] = useState<ManageAccountsAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [filters, setFilters] = useState<ManageAccountsFilterOptions>({
    status: 'all',
    department: 'all',
    userType: 'all',
    location: 'all',
    search: ''
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [showFilters, setShowFilters] = useState(false);
  const [showInvitationModal, setShowInvitationModal] = useState(false);

  // Locations
  const locations = [
    'Brighton', 'Canton', 'Farmington', 'Lansing', 'Taylor', 
    'Waterford', 'Sterling Heights', 'Battle Creek', 'Ypsilanti', 'Escape Room Zone'
  ];

  // Status colors
  const statusColors = {
    active: 'bg-green-100 text-green-800',
    inactive: 'bg-gray-100 text-gray-800'
  };

  // User type badge color
  const userTypeBadgeColor = `bg-${themeColor}-100 text-${fullColor}`;

  // Department badge color
  const departmentBadgeColor = `bg-${themeColor}-100 text-${fullColor}`;
  const foodBeverageBadgeColor = 'bg-yellow-100 text-yellow-800';

  // Calculate metrics data
  // Calculate new accounts in the last 30 days
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

  // Load accounts from backend API
  useEffect(() => {
    loadAccounts();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Apply filters when accounts or filters change
  useEffect(() => {
    applyFilters();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accounts, filters]);

  const loadAccounts = useCallback(async () => {
    try {
      const userData = localStorage.getItem('zapzone_user');
      const authToken = userData ? JSON.parse(userData).token : null;

      if (!authToken) {
        console.error('No auth token found');
        setLoading(false);
        return;
      }

      // Build query parameters
      const params = new URLSearchParams();
      if (filters.status !== 'all') params.append('status', filters.status);
      if (filters.userType !== 'all') {
        const roleMap: Record<string, string> = {
          'manager': 'location_manager',
          'attendant': 'attendant',
          'company_admin': 'company_admin'
        };
        params.append('role', roleMap[filters.userType] || filters.userType);
      }
      if (filters.location !== 'all') params.append('location_id', filters.location);
      if (filters.search) params.append('search', filters.search);

      const response = await fetch(`${API_BASE_URL}/users?${params.toString()}`, {
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

      // Transform backend users to frontend account format
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
  }, [filters.status, filters.userType, filters.location, filters.search]);

  const applyFilters = () => {
    let result = [...accounts];

    // Apply search filter
    if (filters.search) {
      const searchTerm = filters.search.toLowerCase();
      result = result.filter(account =>
        account.firstName.toLowerCase().includes(searchTerm) ||
        account.lastName.toLowerCase().includes(searchTerm) ||
        account.email.toLowerCase().includes(searchTerm) ||
        account.employeeId.toLowerCase().includes(searchTerm) ||
        account.department.toLowerCase().includes(searchTerm) ||
        account.location.toLowerCase().includes(searchTerm)
      );
    }

    // Apply status filter
    if (filters.status !== 'all') {
      result = result.filter(account => account.status === filters.status);
    }

    // Apply department filter
    if (filters.department !== 'all') {
      result = result.filter(account => account.department === filters.department);
    }

    // Apply user type filter
    if (filters.userType !== 'all') {
      result = result.filter(account => account.userType === filters.userType);
    }

    // Apply location filter
    if (filters.location !== 'all') {
      result = result.filter(account => account.location === filters.location);
    }

    setFilteredAccounts(result);
    setCurrentPage(1);
  };

  const handleFilterChange = (key: keyof ManageAccountsFilterOptions, value: string) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const clearFilters = () => {
    setFilters({
      status: 'all',
      department: 'all',
      userType: 'all',
      location: 'all',
      search: ''
    });
  };

  const handleSelectAccount = (id: string) => {
    setSelectedAccounts(prev =>
      prev.includes(id)
        ? prev.filter(accountId => accountId !== id)
        : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedAccounts.length === currentAccounts.length) {
      setSelectedAccounts([]);
    } else {
      setSelectedAccounts(currentAccounts.map(account => account.id));
    }
  };

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

      // Update local state
      const updatedAccounts = accounts.map(account =>
        account.id === id ? { ...account, status: newStatus } : account
      );
      setAccounts(updatedAccounts);
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

      // Update local state
      const updatedAccounts = accounts.filter(account => account.id !== id);
      setAccounts(updatedAccounts);
    } catch (error) {
      console.error('Error deleting account:', error);
      alert('Failed to delete account. Please try again.');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedAccounts.length === 0) return;
    
    if (!window.confirm(`Are you sure you want to delete ${selectedAccounts.length} account(s)? This action cannot be undone.`)) {
      return;
    }

    try {
      // Convert string IDs to numbers for the API
      const ids = selectedAccounts.map(id => parseInt(id));
      
      // Use the bulk delete API endpoint
      const response = await userService.bulkDelete(ids);

      if (!response.success) {
        throw new Error(response.message || 'Failed to delete accounts');
      }

      // Update local state
      const updatedAccounts = accounts.filter(account => !selectedAccounts.includes(account.id));
      setAccounts(updatedAccounts);
      setSelectedAccounts([]);
      
      alert(`Successfully deleted ${selectedAccounts.length} account(s)`);
    } catch (error) {
      console.error('Error deleting accounts:', error);
      alert('Failed to delete some accounts. Please try again.');
    }
  };

  const handleBulkStatusChange = async (newStatus: ManageAccountsAccount['status']) => {
    if (selectedAccounts.length === 0) return;
    
    try {
      const userData = localStorage.getItem('zapzone_user');
      const authToken = userData ? JSON.parse(userData).token : null;

      if (!authToken) {
        alert('Authentication required. Please log in again.');
        return;
      }

      // Update status for all selected accounts
      await Promise.all(selectedAccounts.map(id => 
        fetch(`${API_BASE_URL}/users/${id}/toggle-status`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`,
          },
        })
      ));

      // Update local state
      const updatedAccounts = accounts.map(account =>
        selectedAccounts.includes(account.id) ? { ...account, status: newStatus } : account
      );
      setAccounts(updatedAccounts);
      setSelectedAccounts([]);
    } catch (error) {
      console.error('Error updating account status:', error);
      alert('Failed to update some account statuses. Please try again.');
    }
  };

  // Send invitation to create account
  const handleSendInvitation = () => {
    // The actual API call is handled in the modal
    // Reload accounts to get updated data from backend
    loadAccounts();
  };

  // Open invitation modal for new invitation
  const handleInviteAccount = () => {
    setShowInvitationModal(true);
  };

  // Get unique values for filters
  const getUniqueDepartments = () => {
    const departments = accounts.map(account => account.department);
    return [...new Set(departments)];
  };

  // Format last login date
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

  console.log('Filtered Accounts:', filteredAccounts);

  // Pagination
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentAccounts = filteredAccounts.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredAccounts.length / itemsPerPage);

  const paginate = (pageNumber: number) => setCurrentPage(pageNumber);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className={`animate-spin rounded-full h-12 w-12 border-b-2 border-${fullColor}`}></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 px-6 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Manage Accounts</h1>
          <p className="text-gray-600 mt-2">Manage all attendant and location manager accounts</p>
        </div>
        <div className="flex gap-2 mt-4 sm:mt-0">
          <button
            onClick={() => handleInviteAccount()}
            className={`inline-flex items-center px-4 py-2 bg-${fullColor} text-white rounded-lg hover:bg-${fullColor}-900 transition-colors`}
          >
            <Send className="h-5 w-5 mr-2" />
            Send Invitation
          </button>
          {/* <Link
            to="/accounts/create"
            className={`inline-flex items-center px-4 py-2 bg-${fullColor} text-white rounded-lg hover:bg-${themeColor}-900 transition-colors`}
          >
            <Plus className="h-5 w-5 mr-2" />
            Create Account
          </Link> */}
        </div>
      </div>

      {/* Metrics Grid */}
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

      {/* Filters and Search */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-6">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="relative flex-1 max-w-lg">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search accounts..."
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              className={`pl-9 pr-3 py-2 border border-gray-200 rounded-lg w-full focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500`}
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              <Filter className="h-4 w-4 mr-1" />
              Filters
            </button>
            <button
              onClick={loadAccounts}
              className="flex items-center px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              <RefreshCcw className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Advanced Filters */}
        {showFilters && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-800 mb-1">Status</label>
                <select
                  value={filters.status}
                  onChange={(e) => handleFilterChange('status', e.target.value)}
                  className={`w-full border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500`}
                >
                  <option value="all">All Statuses</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-800 mb-1">User Type</label>
                <select
                  value={filters.userType}
                  onChange={(e) => handleFilterChange('userType', e.target.value)}
                  className={`w-full border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500`}
                >
                  <option value="all">All Types</option>
                  <option value="manager">Managers</option>
                  <option value="attendant">Attendants</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-800 mb-1">Department</label>
                <select
                  value={filters.department}
                  onChange={(e) => handleFilterChange('department', e.target.value)}
                  className={`w-full border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500`}
                >
                  <option value="all">All Departments</option>
                  {getUniqueDepartments().map(dept => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-800 mb-1">Location</label>
                <select
                  value={filters.location}
                  onChange={(e) => handleFilterChange('location', e.target.value)}
                  className={`w-full border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500`}
                >
                  <option value="all">All Locations</option>
                  {locations.map(location => (
                    <option key={location} value={location}>{location}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <button
                onClick={clearFilters}
                className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800"
              >
                Clear Filters
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bulk Actions */}
      {selectedAccounts.length > 0 && (
        <div className={`bg-${themeColor}-50 p-4 rounded-lg mb-6 flex flex-wrap items-center gap-4`}>
          <span className={`text-${fullColor} font-medium`}>
            {selectedAccounts.length} account(s) selected
          </span>
          <div className="flex gap-2">
            <select
              onChange={(e) => handleBulkStatusChange(e.target.value as ManageAccountsAccount['status'])}
              className={`border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-${themeColor}-500`}
            >
              <option value="">Change Status</option>
              <option value="active">Activate</option>
              <option value="inactive">Deactivate</option>
            </select>
            <button
              onClick={handleBulkDelete}
              className="flex items-center px-3 py-2 bg-red-100 text-red-800 rounded-lg hover:bg-red-200"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Delete
            </button>
          </div>
        </div>
      )}

      {/* Accounts Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-gray-800 uppercase bg-gray-50 border-b">
              <tr>
                <th scope="col" className="px-6 py-4 font-medium w-12">
                  <input
                    type="checkbox"
                    checked={selectedAccounts.length === currentAccounts.length && currentAccounts.length > 0}
                    onChange={handleSelectAll}
                    className={`rounded border-gray-300 text-${fullColor} focus:ring-${themeColor}-500`}
                  />
                </th>
                <th scope="col" className="px-6 py-4 font-medium">Account</th>
                <th scope="col" className="px-6 py-4 font-medium">Contact</th>
                <th scope="col" className="px-6 py-4 font-medium">Type & Location</th>
                <th scope="col" className="px-6 py-4 font-medium">Department</th>
                {/* Account Status column removed */}
                <th scope="col" className="px-6 py-4 font-medium">Last Login</th>
                <th scope="col" className="px-6 py-4 font-medium">Status</th>
                <th scope="col" className="px-6 py-4 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {currentAccounts.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-8 text-center text-gray-800">
                    No accounts found
                  </td>
                </tr>
              ) : (
                currentAccounts.map((account) => (
                  <tr key={account.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={selectedAccounts.includes(account.id)}
                        onChange={() => handleSelectAccount(account.id)}
                        className={`rounded border-gray-300 text-${fullColor} focus:ring-${themeColor}-500`}
                      />
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div>
                          <div className="font-medium text-gray-900">
                            {account.firstName} {account.lastName}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-sm">
                          <Mail className="h-3 w-3 text-gray-400" />
                          <span className="text-gray-900">{account.email}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          {account.phone ? <><Phone className="h-3 w-3 text-gray-400" />
                          <span className="text-gray-600">{account.phone}</span></> : null}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-2">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${userTypeBadgeColor}`}>
                          {account.userType === 'manager' ? 'Location Manager' : account.userType === 'company_admin' ? 'Company Admin' : 'Attendant'}
                        </span>
                       
                       {account.location !== 'Unknown' ? <div className="flex items-center gap-1 text-xs text-gray-600">
                          <MapPin className="h-3 w-3" />
                          {account.location}
                        </div> : null} 
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${account.department === 'Food & Beverage' ? foodBeverageBadgeColor : departmentBadgeColor}`}>
                        {account.department}
                      </span>
                    </td>
                    {/* Account Status cell removed */}
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatLastLogin(account.lastLogin)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <select
                        value={account.status}
                        onChange={(e) => handleStatusChange(account.id, e.target.value as ManageAccountsAccount['status'])}
                        className={`text-xs font-medium px-3 py-1 rounded-full ${statusColors[account.status]} border-none focus:ring-2 focus:ring-${themeColor}-500`}
                      >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        {/* No invite button, all accounts are created */}
                        <Link
                          to={`/accounts/${account.id}`}
                          className={`text-${fullColor} hover:text-${fullColor}`}
                          title="View Profile"
                        >
                          <Eye className="h-4 w-4" />
                        </Link>
                        <Link
                          to={`/accounts/edit/${account.id}`}
                          className="text-gray-600 hover:text-gray-800"
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </Link>
                        <button
                          onClick={() => handleDeleteAccount(account.id)}
                          className="text-red-600 hover:text-red-800"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="bg-white px-6 py-4 border-t border-gray-100">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-800">
                Showing <span className="font-medium">{indexOfFirstItem + 1}</span> to{' '}
                <span className="font-medium">
                  {Math.min(indexOfLastItem, filteredAccounts.length)}
                </span>{' '}
                of <span className="font-medium">{filteredAccounts.length}</span> results
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => paginate(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50"
                >
                  Previous
                </button>
                
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    onClick={() => paginate(page)}
                    className={`px-3 py-2 border rounded-lg text-sm font-medium ${
                      currentPage === page
                        ? `border-${fullColor} bg-${fullColor} text-white`
                        : 'border-gray-200 text-gray-800 hover:bg-gray-50'
                    }`}
                  >
                    {page}
                  </button>
                ))}
                
                <button
                  onClick={() => paginate(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Invitation Modal */}
      <InvitationModal
        isOpen={showInvitationModal}
        onClose={() => setShowInvitationModal(false)}
        onSendInvitation={handleSendInvitation}
        defaultEmail=''
        defaultUserType='attendant'
      />
    </div>
  );
};

export default ManageAccounts;