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
  User,
  Mail,
  Phone,
  MapPin,
  Send,
  X,
  Copy,
  CheckCircle
} from 'lucide-react';
import { useThemeColor } from '../../../hooks/useThemeColor';
import CounterAnimation from '../../../components/ui/CounterAnimation';
import { API_BASE_URL } from '../../../utils/storage';
import type {
  ManageAttendantsAttendant,
  ManageAttendantsFilterOptions,
} from '../../../types/ManageAttendants.types';

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
  const { themeColor, fullColor } = useThemeColor();
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
      // Map userType to backend role
      const role = userType === 'manager' ? 'location_manager' : 'attendant';

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

      // Add location_id (required for attendant and manager roles)
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-backdrop-fade">
      <div className="bg-white rounded-xl shadow-lg max-w-md w-full">
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
            <div className="p-3 bg-${themeColor}-50 border border-${themeColor}-200 rounded-lg flex items-start gap-2">
              <CheckCircle className="w-5 h-5 text-${themeColor}-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-${themeColor}-800">Invitation sent successfully!</p>
                <p className="text-xs text-${themeColor}-600 mt-1">The invitation email has been sent to {email}</p>
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

const ManageAttendants = () => {
  const { themeColor, fullColor } = useThemeColor();
  const [attendants, setAttendants] = useState<ManageAttendantsAttendant[]>([]);
  const [filteredAttendants, setFilteredAttendants] = useState<ManageAttendantsAttendant[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAttendants, setSelectedAttendants] = useState<string[]>([]);
  const [filters, setFilters] = useState<ManageAttendantsFilterOptions>({
    status: 'all',
    department: 'all',
    search: ''
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [showFilters, setShowFilters] = useState(false);
  const [showInvitationModal, setShowInvitationModal] = useState(false);

  // Status colors
  const statusColors = {
    active: `bg-${themeColor}-100 text-${fullColor}`,
    inactive: 'bg-gray-100 text-gray-800'
  };

  // Department colors
  const departmentColors: Record<string, string> = {
    'Guest Services': `bg-${themeColor}-100 text-${fullColor}`,
    'Entertainment': `bg-${themeColor}-100 text-${fullColor}`,
    'Food & Beverage': `bg-${themeColor}-100 text-${fullColor}`,
    'Maintenance': `bg-${themeColor}-100 text-${fullColor}`,
    'Security': 'bg-red-100 text-red-800',
    'Administration': `bg-${themeColor}-100 text-${fullColor}`
  };

  // Calculate metrics data
  // Calculate new attendants in the last 30 days
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

  // Apply filters callback
  const applyFilters = useCallback(() => {
    let result = [...attendants];

    // Apply search filter
    if (filters.search) {
      const searchTerm = filters.search.toLowerCase();
      result = result.filter(attendant =>
        attendant.firstName.toLowerCase().includes(searchTerm) ||
        attendant.lastName.toLowerCase().includes(searchTerm) ||
        attendant.email.toLowerCase().includes(searchTerm) ||
        attendant.employeeId.toLowerCase().includes(searchTerm) ||
        attendant.department.toLowerCase().includes(searchTerm)
      );
    }

    // Apply status filter
    if (filters.status !== 'all') {
      result = result.filter(attendant => attendant.status === filters.status);
    }

    // Apply department filter
    if (filters.department !== 'all') {
      result = result.filter(attendant => attendant.department === filters.department);
    }

    setFilteredAttendants(result);
    setCurrentPage(1); // Reset to first page when filters change
  }, [attendants, filters]);

  // Load attendants from backend API
  useEffect(() => {
    loadAttendants();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Apply filters when attendants or filters change
  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  const loadAttendants = async () => {
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
      if (filters.department !== 'all') params.append('department', filters.department);
      if (filters.search) params.append('search', filters.search);
      params.append('role', 'attendant'); // Only fetch attendants

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

      // Transform backend users to frontend attendant format
      const transformedAttendants: ManageAttendantsAttendant[] = data.data.users.map((user: Record<string, unknown>) => ({
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
      }));

      setAttendants(transformedAttendants);
    } catch (error) {
      console.error('Error loading attendants:', error);
      setAttendants([]);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key: keyof ManageAttendantsFilterOptions, value: string) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const clearFilters = () => {
    setFilters({
      status: 'all',
      department: 'all',
      search: ''
    });
  };

  const handleSelectAttendant = (id: string) => {
    setSelectedAttendants(prev =>
      prev.includes(id)
        ? prev.filter(attendantId => attendantId !== id)
        : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedAttendants.length === currentAttendants.length) {
      setSelectedAttendants([]);
    } else {
      setSelectedAttendants(currentAttendants.map(attendant => attendant.id));
    }
  };

  const handleStatusChange = async (id: string, newStatus: ManageAttendantsAttendant['status']) => {
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
      const updatedAttendants = attendants.map(attendant =>
        attendant.id === id ? { ...attendant, status: newStatus } : attendant
      );
      setAttendants(updatedAttendants);
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

      // Update local state
      const updatedAttendants = attendants.filter(attendant => attendant.id !== id);
      setAttendants(updatedAttendants);
    } catch (error) {
      console.error('Error deleting attendant:', error);
      alert('Failed to delete attendant. Please try again.');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedAttendants.length === 0) return;
    
    if (!window.confirm(`Are you sure you want to delete ${selectedAttendants.length} attendant(s)? This action cannot be undone.`)) {
      return;
    }

    try {
      const userData = localStorage.getItem('zapzone_user');
      const authToken = userData ? JSON.parse(userData).token : null;

      if (!authToken) {
        alert('Authentication required. Please log in again.');
        return;
      }

      // Delete all selected attendants
      await Promise.all(selectedAttendants.map(id => 
        fetch(`${API_BASE_URL}/users/${id}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`,
          },
        })
      ));

      // Update local state
      const updatedAttendants = attendants.filter(attendant => !selectedAttendants.includes(attendant.id));
      setAttendants(updatedAttendants);
      setSelectedAttendants([]);
    } catch (error) {
      console.error('Error deleting attendants:', error);
      alert('Failed to delete some attendants. Please try again.');
    }
  };

  const handleBulkStatusChange = async (newStatus: ManageAttendantsAttendant['status']) => {
    if (selectedAttendants.length === 0) return;
    
    try {
      const userData = localStorage.getItem('zapzone_user');
      const authToken = userData ? JSON.parse(userData).token : null;

      if (!authToken) {
        alert('Authentication required. Please log in again.');
        return;
      }

      // Update status for all selected attendants
      await Promise.all(selectedAttendants.map(id => 
        fetch(`${API_BASE_URL}/users/${id}/toggle-status`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`,
          },
        })
      ));

      // Update local state
      const updatedAttendants = attendants.map(attendant =>
        selectedAttendants.includes(attendant.id) ? { ...attendant, status: newStatus } : attendant
      );
      setAttendants(updatedAttendants);
      setSelectedAttendants([]);
    } catch (error) {
      console.error('Error updating attendant status:', error);
      alert('Failed to update some attendant statuses. Please try again.');
    }
  };

  // Send invitation to create account
  const handleSendInvitation = () => {
    // The actual API call is handled in the modal
    // Reload attendants to get updated data from backend
    loadAttendants();
  };

  // Open invitation modal for specific attendant
  const handleInviteAttendant = () => {
    setShowInvitationModal(true);
  };

  // Get unique departments
  const getUniqueDepartments = () => {
    const departments = attendants.map(attendant => attendant.department);
    return [...new Set(departments)];
  };

  // Calculate experience in months
  const getExperience = (hireDate: string) => {
    const hire = new Date(hireDate);
    const today = new Date();
    const months = (today.getFullYear() - hire.getFullYear()) * 12 + (today.getMonth() - hire.getMonth());
    return Math.max(0, months);
  };

  // // Check if invitation is expired
  // const isInvitationExpired = (expiryDate?: string) => {
  //   if (!expiryDate) return true;
  //   return new Date(expiryDate) < new Date();
  // };

  // Pagination
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentAttendants = filteredAttendants.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredAttendants.length / itemsPerPage);

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
          <h1 className="text-3xl font-bold text-gray-900">Manage Attendants</h1>
          <p className="text-gray-600 mt-2">View and manage all staff members in your facility</p>
        </div>
        <div className="flex gap-2 mt-4 sm:mt-0">
          <button
            onClick={() => handleInviteAttendant()}
            className={`inline-flex items-center px-4 py-2 bg-${fullColor} text-white rounded-lg hover:bg-${themeColor}-900 transition-colors`}
          >
            <Send className="h-5 w-5 mr-2" />
            Send Invitation
          </button>
          {/* <Link
            to="/manager/attendants/create"
            className={`inline-flex items-center px-4 py-2 bg-${fullColor} text-white rounded-lg hover:bg-${themeColor}-900 transition-colors`}
          >
            <Plus className="h-5 w-5 mr-2" />
            New Attendant
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
              placeholder="Search attendants..."
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              className={`pl-9 pr-3 py-2 border border-gray-200 rounded-lg w-full focus:ring-2 focus:ring-${themeColor}-400 focus:border-${themeColor}-400`}
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
              onClick={loadAttendants}
              className="flex items-center px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              <RefreshCcw className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Advanced Filters */}
        {showFilters && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-800 mb-1">Status</label>
                <select
                  value={filters.status}
                  onChange={(e) => handleFilterChange('status', e.target.value)}
                  className={`w-full border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-${themeColor}-400 focus:border-${themeColor}-400`}
                >
                  <option value="all">All Statuses</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-800 mb-1">Department</label>
                <select
                  value={filters.department}
                  onChange={(e) => handleFilterChange('department', e.target.value)}
                  className={`w-full border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-${themeColor}-400 focus:border-${themeColor}-400`}
                >
                  <option value="all">All Departments</option>
                  {getUniqueDepartments().map(dept => (
                    <option key={dept} value={dept}>{dept}</option>
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
      {selectedAttendants.length > 0 && (
        <div className={`bg-${themeColor}-50 p-4 rounded-lg mb-6 flex flex-wrap items-center gap-4`}>
          <span className={`text-${fullColor} font-medium`}>
            {selectedAttendants.length} attendant(s) selected
          </span>
          <div className="flex gap-2">
            <select
              onChange={(e) => handleBulkStatusChange(e.target.value as ManageAttendantsAttendant['status'])}
              className={`border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-${themeColor}-400`}
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

      {/* Attendants Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-gray-800 uppercase bg-gray-50 border-b">
              <tr>
                <th scope="col" className="px-6 py-4 font-medium w-12">
                  <input
                    type="checkbox"
                    checked={selectedAttendants.length === currentAttendants.length && currentAttendants.length > 0}
                    onChange={handleSelectAll}
                    className={`rounded border-gray-300 text-${fullColor} focus:ring-${themeColor}-400`}
                  />
                </th>
                <th scope="col" className="px-6 py-4 font-medium">Attendant</th>
                <th scope="col" className="px-6 py-4 font-medium">Contact</th>
                <th scope="col" className="px-6 py-4 font-medium">Position</th>
                <th scope="col" className="px-6 py-4 font-medium">Department</th>
                {/* Account Status column removed */}
                <th scope="col" className="px-6 py-4 font-medium">Experience</th>
                <th scope="col" className="px-6 py-4 font-medium">Status</th>
                <th scope="col" className="px-6 py-4 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {currentAttendants.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-8 text-center text-gray-800">
                    No attendants found
                  </td>
                </tr>
              ) : (
                currentAttendants.map((attendant) => (
                  <tr key={attendant.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={selectedAttendants.includes(attendant.id)}
                        onChange={() => handleSelectAttendant(attendant.id)}
                        className={`rounded border-gray-300 text-${fullColor} focus:ring-${themeColor}-400`}
                      />
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div>
                          <div className="font-medium text-gray-900">
                            {attendant.firstName} {attendant.lastName}
                          </div>
                          <div className="text-xs text-gray-600 mt-1">ID: {attendant.employeeId}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-sm">
                          <Mail className="h-3 w-3 text-gray-400" />
                          <span className="text-gray-900">{attendant.email}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <Phone className="h-3 w-3 text-gray-400" />
                          <span className="text-gray-600">{attendant.phone}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {attendant.position}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${departmentColors[attendant.department] || 'bg-gray-100 text-gray-800'}`}>
                        {attendant.department}
                      </span>
                    </td>
                    {/* Account Status cell removed */}
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {getExperience(attendant.hireDate)} months
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <select
                        value={attendant.status}
                        onChange={(e) => handleStatusChange(attendant.id, e.target.value as ManageAttendantsAttendant['status'])}
                        className={`text-xs font-medium px-3 py-1 rounded-full ${statusColors[attendant.status]} border-none focus:ring-2 focus:ring-${themeColor}-400`}
                      >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        {/* No invite button, all accounts are created */}
                        <Link
                          to={`/attendants/${attendant.id}`}
                          className={`text-${themeColor}-600 hover:text-${fullColor}`}
                          title="View Profile"
                        >
                          <Eye className="h-4 w-4" />
                        </Link>
                        <Link
                          to={`/attendants/edit/${attendant.id}`}
                          className="text-gray-600 hover:text-gray-800"
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </Link>
                        <button
                          onClick={() => handleDeleteAttendant(attendant.id)}
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
                  {Math.min(indexOfLastItem, filteredAttendants.length)}
                </span>{' '}
                of <span className="font-medium">{filteredAttendants.length}</span> results
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
      />
    </div>
  );
};

export default ManageAttendants;