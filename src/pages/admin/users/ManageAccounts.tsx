import { useState, useEffect } from 'react';
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
  UserCheck
} from 'lucide-react';

// Types
interface Account {
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

interface FilterOptions {
  status: string;
  department: string;
  userType: string;
  location: string;
  search: string;
}

interface InvitationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSendInvitation: (email: string, userType: 'attendant' | 'manager') => void;
  loading?: boolean;
  defaultEmail?: string;
  defaultUserType?: 'attendant' | 'manager';
}

const InvitationModal: React.FC<InvitationModalProps> = ({ 
  isOpen, 
  onClose, 
  onSendInvitation, 
  loading = false,
  defaultEmail = '',
  defaultUserType = 'attendant'
}) => {
  const [email, setEmail] = useState(defaultEmail);
  const [userType, setUserType] = useState<'attendant' | 'manager'>(defaultUserType);
  const [generatedLink, setGeneratedLink] = useState('');

  useEffect(() => {
    if (isOpen) {
      setEmail(defaultEmail);
      setUserType(defaultUserType);
      // Generate a unique invitation link
      const token = Math.random().toString(36).substring(2) + Date.now().toString(36);
      const link = `${window.location.origin}/register?token=${token}&type=${userType}`;
      setGeneratedLink(link);
    }
  }, [isOpen, defaultEmail, defaultUserType, userType]);

  const handleSend = () => {
    if (email && generatedLink) {
      onSendInvitation(email, userType);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedLink);
    alert('Link copied to clipboard!');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-lg max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Send Account Invitation</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              User Type
            </label>
            <select
              value={userType}
              onChange={(e) => setUserType(e.target.value as 'attendant' | 'manager')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-800 focus:border-blue-800"
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
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-800 focus:border-blue-800"
            />
          </div>

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
              This link will expire once the account is created or after 7 days
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={!email || loading}
            className="flex-1 px-4 py-2 bg-blue-800 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
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
        </div>
      </div>
    </div>
  );
};

const ManageAccounts = () => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [filteredAccounts, setFilteredAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [filters, setFilters] = useState<FilterOptions>({
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
  const [sendingInvitation, setSendingInvitation] = useState(false);
  const [selectedAccountForInvite, setSelectedAccountForInvite] = useState<Account | null>(null);

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

  // User type colors
  const userTypeColors = {
    attendant: 'bg-blue-100 text-blue-800',
    manager: 'bg-blue-100 text-blue-800'
  };

  // Department colors
  const departmentColors: Record<string, string> = {
    'Guest Services': 'bg-blue-100 text-blue-800',
    'Entertainment': 'bg-blue-100 text-blue-800',
    'Food & Beverage': 'bg-yellow-100 text-yellow-800',
    'Maintenance': 'bg-blue-100 text-blue-800',
    'Security': 'bg-blue-100 text-blue-800',
    'Administration': 'bg-blue-100 text-blue-800'
  };

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
      accent: 'bg-blue-100 text-blue-800',
      icon: Users,
    },
    {
      title: 'Location Managers',
      value: accounts.filter(a => a.userType === 'manager').length.toString(),
      change: `${accounts.filter(a => a.userType === 'manager' && a.status === 'active').length} active`,
      accent: 'bg-blue-100 text-blue-800',
      icon: Shield,
    },
    {
      title: 'Attendants',
      value: accounts.filter(a => a.userType === 'attendant').length.toString(),
      change: `${accounts.filter(a => a.userType === 'attendant' && a.status === 'active').length} active`,
      accent: 'bg-blue-100 text-blue-800',
      icon: UserCheck,
    },
    {
      title: 'New Accounts',
      value: newAccountsCount.toString(),
      change: 'Last 30 days',
      accent: 'bg-blue-100 text-blue-800',
      icon: Plus,
    }
  ];

  // Load accounts from localStorage
  useEffect(() => {
    loadAccounts();
  }, []);

  // Apply filters when accounts or filters change
  useEffect(() => {
    applyFilters();
  }, [accounts, filters]);

  const loadAccounts = () => {
    try {
      const storedAccounts = localStorage.getItem('zapzone_accounts');
      if (storedAccounts) {
        const parsedAccounts = JSON.parse(storedAccounts);
        setAccounts(parsedAccounts);
      } else {
        // Sample data for demonstration
        const sampleAccounts: Account[] = [
          // Location Managers
          {
            id: 'mgr_1',
            firstName: 'John',
            lastName: 'Smith',
            email: 'john.smith@zapzone.com',
            phone: '(555) 111-2222',
            hireDate: '2023-05-15',
            position: 'Location Manager',
            employeeId: 'ZAP-MGR-001',
            department: 'Administration',
            location: 'Brighton',
            userType: 'manager',
            status: 'active',
            username: 'john.smith',
            createdAt: '2023-05-15T08:00:00Z',
            accountCreated: true,
            lastLogin: '2024-01-15T14:30:00Z'
          },
          {
            id: 'mgr_2',
            firstName: 'Sarah',
            lastName: 'Wilson',
            email: 'sarah.wilson@zapzone.com',
            phone: '(555) 222-3333',
            hireDate: '2024-01-10',
            position: 'Location Manager',
            employeeId: 'ZAP-MGR-002',
            department: 'Administration',
            location: 'Canton',
            userType: 'manager',
            status: 'active',
            username: 'sarah.wilson',
            createdAt: '2024-01-10T09:00:00Z',
            accountCreated: false,
            invitationSent: true,
            invitationLink: `${window.location.origin}/register?token=xyz789&type=manager`,
            invitationExpiry: '2024-12-31T23:59:59Z'
          },
          // Attendants
          {
            id: 'att_1',
            firstName: 'Mike',
            lastName: 'Chen',
            email: 'mike.chen@zapzone.com',
            phone: '(555) 333-4444',
            hireDate: '2024-02-01',
            position: 'Senior Attendant',
            employeeId: 'ZAP-ATT-001',
            department: 'Guest Services',
            location: 'Brighton',
            userType: 'attendant',
            shift: 'Morning Shift (8:00 AM - 4:00 PM)',
            assignedAreas: ['Laser Tag Arena', 'Bowling Alley'],
            status: 'active',
            username: 'mike.chen',
            createdAt: '2024-02-01T09:30:00Z',
            accountCreated: true,
            lastLogin: '2024-01-15T08:15:00Z'
          },
          {
            id: 'att_2',
            firstName: 'Emily',
            lastName: 'Rodriguez',
            email: 'emily.rodriguez@zapzone.com',
            phone: '(555) 444-5555',
            hireDate: '2023-11-20',
            position: 'Team Lead',
            employeeId: 'ZAP-ATT-002',
            department: 'Entertainment',
            location: 'Canton',
            userType: 'attendant',
            shift: 'Weekend Shift (10:00 AM - 6:00 PM)',
            assignedAreas: ['VR Experience', 'Arcade Zone'],
            status: 'inactive',
            username: 'emily.rodriguez',
            createdAt: '2023-11-20T14:15:00Z',
            accountCreated: false
          },
          {
            id: 'att_3',
            firstName: 'David',
            lastName: 'Kim',
            email: 'david.kim@zapzone.com',
            phone: '(555) 555-6666',
            hireDate: '2024-03-10',
            position: 'Attendant',
            employeeId: 'ZAP-ATT-003',
            department: 'Maintenance',
            location: 'Farmington',
            userType: 'attendant',
            shift: 'Night Shift (6:00 PM - 2:00 AM)',
            assignedAreas: ['Escape Room', 'VR Experience'],
            status: 'active',
            username: 'david.kim',
            createdAt: '2024-03-10T10:00:00Z',
            accountCreated: false,
            invitationSent: true,
            invitationLink: `${window.location.origin}/register?token=abc123&type=attendant`,
            invitationExpiry: '2024-12-31T23:59:59Z'
          }
        ];
        setAccounts(sampleAccounts);
        localStorage.setItem('zapzone_accounts', JSON.stringify(sampleAccounts));
      }
    } catch (error) {
      console.error('Error loading accounts:', error);
    } finally {
      setLoading(false);
    }
  };

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

  const handleFilterChange = (key: keyof FilterOptions, value: any) => {
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

  const handleStatusChange = (id: string, newStatus: Account['status']) => {
    const updatedAccounts = accounts.map(account =>
      account.id === id ? { ...account, status: newStatus } : account
    );
    setAccounts(updatedAccounts);
    localStorage.setItem('zapzone_accounts', JSON.stringify(updatedAccounts));
  };

  const handleDeleteAccount = (id: string) => {
    if (window.confirm('Are you sure you want to delete this account? This action cannot be undone.')) {
      const updatedAccounts = accounts.filter(account => account.id !== id);
      setAccounts(updatedAccounts);
      localStorage.setItem('zapzone_accounts', JSON.stringify(updatedAccounts));
    }
  };

  const handleBulkDelete = () => {
    if (selectedAccounts.length === 0) return;
    
    if (window.confirm(`Are you sure you want to delete ${selectedAccounts.length} account(s)? This action cannot be undone.`)) {
      const updatedAccounts = accounts.filter(account => !selectedAccounts.includes(account.id));
      setAccounts(updatedAccounts);
      setSelectedAccounts([]);
      localStorage.setItem('zapzone_accounts', JSON.stringify(updatedAccounts));
    }
  };

  const handleBulkStatusChange = (newStatus: Account['status']) => {
    if (selectedAccounts.length === 0) return;
    
    const updatedAccounts = accounts.map(account =>
      selectedAccounts.includes(account.id) ? { ...account, status: newStatus } : account
    );
    setAccounts(updatedAccounts);
    setSelectedAccounts([]);
    localStorage.setItem('zapzone_accounts', JSON.stringify(updatedAccounts));
  };

  // Send invitation to create account
  const handleSendInvitation = (email: string, userType: 'attendant' | 'manager') => {
    setSendingInvitation(true);
    
    // Simulate API call
    setTimeout(() => {
      const token = Math.random().toString(36).substring(2) + Date.now().toString(36);
      const invitationLink = `${window.location.origin}/register?token=${token}&type=${userType}`;
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + 7);

      let updatedAccounts: Account[];
      
      if (selectedAccountForInvite) {
        // Update existing account
        updatedAccounts = accounts.map(account => {
          if (account.id === selectedAccountForInvite.id) {
            return {
              ...account,
              invitationSent: true,
              invitationLink: invitationLink,
              invitationExpiry: expiryDate.toISOString()
            };
          }
          return account;
        });
      } else {
        // Create new account entry
        const newAccount: Account = {
          id: `new_${Date.now()}`,
          firstName: '',
          lastName: '',
          email: email,
          phone: '',
          hireDate: new Date().toISOString().split('T')[0],
          position: userType === 'manager' ? 'Location Manager' : 'Attendant',
          employeeId: `ZAP-${userType === 'manager' ? 'MGR' : 'ATT'}-${String(accounts.length + 1).padStart(3, '0')}`,
          department: userType === 'manager' ? 'Administration' : 'Guest Services',
          location: 'Brighton',
          userType: userType,
          status: 'inactive',
          username: email.split('@')[0],
          createdAt: new Date().toISOString(),
          accountCreated: false,
          invitationSent: true,
          invitationLink: invitationLink,
          invitationExpiry: expiryDate.toISOString()
        };
        updatedAccounts = [...accounts, newAccount];
      }

      setAccounts(updatedAccounts);
      localStorage.setItem('zapzone_accounts', JSON.stringify(updatedAccounts));
      
      setSendingInvitation(false);
      setShowInvitationModal(false);
      setSelectedAccountForInvite(null);
      
      alert(`Invitation sent successfully to ${email}`);
    }, 2000);
  };

  // Open invitation modal for specific account or new invitation
  const handleInviteAccount = (account?: Account) => {
    if (account) {
      setSelectedAccountForInvite(account);
      setShowInvitationModal(true);
    } else {
      setSelectedAccountForInvite(null);
      setShowInvitationModal(true);
    }
  };

  // Get unique values for filters
  const getUniqueDepartments = () => {
    const departments = accounts.map(account => account.department);
    return [...new Set(departments)];
  };

  // const getUniqueUserTypes = () => {
  //   const userTypes = accounts.map(account => account.userType);
  //   return [...new Set(userTypes)];
  // };

  // // Calculate experience in months
  // const getExperience = (hireDate: string) => {
  //   const hire = new Date(hireDate);
  //   const today = new Date();
  //   const months = (today.getFullYear() - hire.getFullYear()) * 12 + (today.getMonth() - hire.getMonth());
  //   return Math.max(0, months);
  // };

  // // Check if invitation is expired
  // const isInvitationExpired = (expiryDate?: string) => {
  //   if (!expiryDate) return true;
  //   return new Date(expiryDate) < new Date();
  // };

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

  // Pagination
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentAccounts = filteredAccounts.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredAccounts.length / itemsPerPage);

  const paginate = (pageNumber: number) => setCurrentPage(pageNumber);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-800"></div>
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
            className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <Send className="h-5 w-5 mr-2" />
            Send Invitation
          </button>
          <Link
            to="/accounts/create"
            className="inline-flex items-center px-4 py-2 bg-blue-800 text-white rounded-lg hover:bg-blue-900 transition-colors"
          >
            <Plus className="h-5 w-5 mr-2" />
            Create Account
          </Link>
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
                <h3 className="text-2xl font-bold text-gray-900">{metric.value}</h3>
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
              className="pl-9 pr-3 py-2 border border-gray-200 rounded-lg w-full focus:ring-2 focus:ring-blue-800 focus:border-blue-800"
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
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-800 focus:border-blue-800"
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
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-800 focus:border-blue-800"
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
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-800 focus:border-blue-800"
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
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-800 focus:border-blue-800"
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
        <div className="bg-blue-50 p-4 rounded-lg mb-6 flex flex-wrap items-center gap-4">
          <span className="text-blue-800 font-medium">
            {selectedAccounts.length} account(s) selected
          </span>
          <div className="flex gap-2">
            <select
              onChange={(e) => handleBulkStatusChange(e.target.value as Account['status'])}
              className="border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-800"
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
                    className="rounded border-gray-300 text-blue-800 focus:ring-blue-800"
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
                        className="rounded border-gray-300 text-blue-800 focus:ring-blue-800"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div>
                          <div className="font-medium text-gray-900">
                            {account.firstName} {account.lastName}
                          </div>
                          <div className="text-xs text-gray-600 mt-1">
                            {account.position} • {account.employeeId}
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
                          <Phone className="h-3 w-3 text-gray-400" />
                          <span className="text-gray-600">{account.phone}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-2">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${userTypeColors[account.userType]}`}>
                          {account.userType === 'manager' ? 'Location Manager' : 'Attendant'}
                        </span>
                        <div className="flex items-center gap-1 text-xs text-gray-600">
                          <MapPin className="h-3 w-3" />
                          {account.location}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${departmentColors[account.department] || 'bg-gray-100 text-gray-800'}`}>
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
                        onChange={(e) => handleStatusChange(account.id, e.target.value as Account['status'])}
                        className={`text-xs font-medium px-3 py-1 rounded-full ${statusColors[account.status]} border-none focus:ring-2 focus:ring-blue-800`}
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
                          className="text-blue-800 hover:text-blue-800"
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
                        ? 'border-blue-800 bg-blue-800 text-white'
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
        onClose={() => {
          setShowInvitationModal(false);
          setSelectedAccountForInvite(null);
        }}
        onSendInvitation={handleSendInvitation}
        loading={sendingInvitation}
        defaultEmail={selectedAccountForInvite?.email || ''}
        defaultUserType={selectedAccountForInvite?.userType || 'attendant'}
      />
    </div>
  );
};

export default ManageAccounts;