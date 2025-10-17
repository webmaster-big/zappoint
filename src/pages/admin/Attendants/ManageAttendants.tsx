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
  User,
  Mail,
  Phone,
  MapPin,
  Send,
  X,
  Copy
} from 'lucide-react';
import type {
  ManageAttendantsAttendant,
  ManageAttendantsFilterOptions,
} from '../../../types/ManageAttendants.types';

interface InvitationModalProps {
  isOpen: boolean;
  attendantName: string;
  generatedLink: string;
  loading?: boolean;
  onClose: () => void;
  onSendInvitation: (email: string) => void;
}

const InvitationModal: React.FC<InvitationModalProps> = ({ 
  isOpen, 
  onClose, 
  onSendInvitation, 
  loading = false 
}) => {
  const [email, setEmail] = useState('');
  const [generatedLink, setGeneratedLink] = useState('');

  useEffect(() => {
    if (isOpen) {
      // Generate a unique invitation link
      const token = Math.random().toString(36).substring(2) + Date.now().toString(36);
      const link = `${window.location.origin}/register?token=${token}&type=attendant`;
      setGeneratedLink(link);
    } else {
      // Reset form when modal closes
      setEmail('');
      setGeneratedLink('');
    }
  }, [isOpen]);

  const handleSend = () => {
    if (email && generatedLink) {
      onSendInvitation(email);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedLink);
    // You could add a toast notification here
    alert('Link copied to clipboard!');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-lg max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Send Invitation</h3>
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
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter attendant's email address"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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

const ManageAttendants = () => {
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
  const [sendingInvitation, setSendingInvitation] = useState(false);
  const [selectedAttendantForInvite, setSelectedAttendantForInvite] = useState<ManageAttendantsAttendant | null>(null);

  // Status colors
  const statusColors = {
    active: 'bg-blue-100 text-blue-800',
    inactive: 'bg-gray-100 text-gray-800'
  };

  // Department colors
  const departmentColors: Record<string, string> = {
    'Guest Services': 'bg-blue-100 text-blue-800',
    'Entertainment': 'bg-blue-100 text-blue-800',
    'Food & Beverage': 'bg-blue-100 text-blue-800',
    'Maintenance': 'bg-blue-100 text-blue-800',
    'Security': 'bg-red-100 text-red-800',
    'Administration': 'bg-blue-100 text-blue-800'
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
      accent: 'bg-blue-100 text-blue-800',
      icon: Users,
    },
    {
      title: 'Active Attendants',
      value: attendants.filter(a => a.status === 'active').length.toString(),
      change: `${attendants.filter(a => a.status === 'inactive').length} inactive`,
      accent: 'bg-blue-100 text-blue-800',
      icon: User,
    },
    {
      title: 'New Attendants',
      value: newAttendantsCount.toString(),
      change: 'Last 30 days',
      accent: 'bg-green-100 text-green-800',
      icon: Plus,
    },
    {
      title: 'Departments',
      value: [...new Set(attendants.map(a => a.department))].length.toString(),
      change: 'Different departments',
      accent: 'bg-blue-100 text-blue-800',
      icon: MapPin,
    }
  ];

  // Load attendants from localStorage
  useEffect(() => {
    loadAttendants();
  }, []);

  // Apply filters when attendants or filters change
  useEffect(() => {
    applyFilters();
  }, [attendants, filters]);

  const loadAttendants = () => {
    try {
      const storedAttendants = localStorage.getItem('zapzone_attendants');
      if (storedAttendants) {
        const parsedAttendants = JSON.parse(storedAttendants);
        setAttendants(parsedAttendants);
      } else {
        // Sample data for demonstration (all accounts already created)
        const sampleAttendants: ManageAttendantsAttendant[] = [
          {
            id: 'att_1',
            firstName: 'Sarah',
            lastName: 'Johnson',
            email: 'sarah.johnson@zapzone.com',
            phone: '(555) 123-4567',
            hireDate: '2024-01-15',
            position: 'Senior Attendant',
            employeeId: 'ZAP-001',
            department: 'Guest Services',
            shift: 'Evening Shift (2:00 PM - 10:00 PM)',
            assignedAreas: ['Laser Tag Arena', 'Bowling Alley'],
            status: 'active',
            username: 'sarah.johnson',
            createdAt: '2024-01-15T08:00:00Z',
            accountCreated: true
          },
          {
            id: 'att_2',
            firstName: 'Mike',
            lastName: 'Chen',
            email: 'mike.chen@zapzone.com',
            phone: '(555) 234-5678',
            hireDate: '2024-02-01',
            position: 'Attendant',
            employeeId: 'ZAP-002',
            department: 'Entertainment',
            shift: 'Morning Shift (8:00 AM - 4:00 PM)',
            assignedAreas: ['VR Experience', 'Arcade Zone'],
            status: 'active',
            username: 'mike.chen',
            createdAt: '2024-02-01T09:30:00Z',
            accountCreated: true
          },
          {
            id: 'att_3',
            firstName: 'Emily',
            lastName: 'Rodriguez',
            email: 'emily.rodriguez@zapzone.com',
            phone: '(555) 345-6789',
            hireDate: '2023-11-20',
            position: 'Team Lead',
            employeeId: 'ZAP-003',
            department: 'Food & Beverage',
            shift: 'Weekend Shift (10:00 AM - 6:00 PM)',
            assignedAreas: ['Food & Beverage', 'Customer Service'],
            status: 'inactive',
            username: 'emily.rodriguez',
            createdAt: '2023-11-20T14:15:00Z',
            accountCreated: true
          },
          {
            id: 'att_4',
            firstName: 'David',
            lastName: 'Kim',
            email: 'david.kim@zapzone.com',
            phone: '(555) 456-7890',
            hireDate: '2024-03-10',
            position: 'Attendant',
            employeeId: 'ZAP-004',
            department: 'Maintenance',
            shift: 'Night Shift (6:00 PM - 2:00 AM)',
            assignedAreas: ['Escape Room', 'VR Experience'],
            status: 'active',
            username: 'david.kim',
            createdAt: '2024-03-10T10:00:00Z',
            accountCreated: true
          }
        ];
        setAttendants(sampleAttendants);
        localStorage.setItem('zapzone_attendants', JSON.stringify(sampleAttendants));
      }
    } catch (error) {
      console.error('Error loading attendants:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
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

  const handleStatusChange = (id: string, newStatus: ManageAttendantsAttendant['status']) => {
    const updatedAttendants = attendants.map(attendant =>
      attendant.id === id ? { ...attendant, status: newStatus } : attendant
    );
    setAttendants(updatedAttendants);
    localStorage.setItem('zapzone_attendants', JSON.stringify(updatedAttendants));
  };

  const handleDeleteAttendant = (id: string) => {
    if (window.confirm('Are you sure you want to delete this attendant? This action cannot be undone.')) {
      const updatedAttendants = attendants.filter(attendant => attendant.id !== id);
      setAttendants(updatedAttendants);
      localStorage.setItem('zapzone_attendants', JSON.stringify(updatedAttendants));
    }
  };

  const handleBulkDelete = () => {
    if (selectedAttendants.length === 0) return;
    
    if (window.confirm(`Are you sure you want to delete ${selectedAttendants.length} attendant(s)? This action cannot be undone.`)) {
      const updatedAttendants = attendants.filter(attendant => !selectedAttendants.includes(attendant.id));
      setAttendants(updatedAttendants);
      setSelectedAttendants([]);
      localStorage.setItem('zapzone_attendants', JSON.stringify(updatedAttendants));
    }
  };

  const handleBulkStatusChange = (newStatus: ManageAttendantsAttendant['status']) => {
    if (selectedAttendants.length === 0) return;
    
    const updatedAttendants = attendants.map(attendant =>
      selectedAttendants.includes(attendant.id) ? { ...attendant, status: newStatus } : attendant
    );
    setAttendants(updatedAttendants);
    setSelectedAttendants([]);
    localStorage.setItem('zapzone_attendants', JSON.stringify(updatedAttendants));
  };

  // Send invitation to create account
  const handleSendInvitation = (email: string) => {
    setSendingInvitation(true);
    
    // Simulate API call
    setTimeout(() => {
      const token = Math.random().toString(36).substring(2) + Date.now().toString(36);
      const invitationLink = `${window.location.origin}/register?token=${token}&type=attendant`;
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + 7); // 7 days from now

      const updatedAttendants = attendants.map(attendant => {
        if (attendant.email === email || attendant.id === selectedAttendantForInvite?.id) {
          return {
            ...attendant,
            invitationSent: true,
            invitationLink: invitationLink,
            invitationExpiry: expiryDate.toISOString()
          };
        }
        return attendant;
      });

      setAttendants(updatedAttendants);
      localStorage.setItem('zapzone_attendants', JSON.stringify(updatedAttendants));
      
      setSendingInvitation(false);
      setShowInvitationModal(false);
      setSelectedAttendantForInvite(null);
      
      // Show success message
      alert(`Invitation sent successfully to ${email}`);
    }, 2000);
  };

  // Open invitation modal for specific attendant
  const handleInviteAttendant = (attendant?: ManageAttendantsAttendant) => {
    if (attendant) {
      setSelectedAttendantForInvite(attendant);
      setShowInvitationModal(true);
    } else {
      setSelectedAttendantForInvite(null);
      setShowInvitationModal(true);
    }
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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-800"></div>
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
            className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <Send className="h-5 w-5 mr-2" />
            Send Invitation
          </button>
          <Link
            to="/manager/attendants/create"
            className="inline-flex items-center px-4 py-2 bg-blue-800 text-white rounded-lg hover:bg-blue-900 transition-colors"
          >
            <Plus className="h-5 w-5 mr-2" />
            New Attendant
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
              placeholder="Search attendants..."
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              className="pl-9 pr-3 py-2 border border-gray-200 rounded-lg w-full focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
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
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
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
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
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
        <div className="bg-blue-50 p-4 rounded-lg mb-6 flex flex-wrap items-center gap-4">
          <span className="text-blue-800 font-medium">
            {selectedAttendants.length} attendant(s) selected
          </span>
          <div className="flex gap-2">
            <select
              onChange={(e) => handleBulkStatusChange(e.target.value as ManageAttendantsAttendant['status'])}
              className="border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-400"
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
                    className="rounded border-gray-300 text-blue-800 focus:ring-blue-400"
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
                        className="rounded border-gray-300 text-blue-800 focus:ring-blue-400"
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
                        className={`text-xs font-medium px-3 py-1 rounded-full ${statusColors[attendant.status]} border-none focus:ring-2 focus:ring-blue-400`}
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
                          className="text-blue-600 hover:text-blue-800"
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
          setSelectedAttendantForInvite(null);
        }}
        onSendInvitation={handleSendInvitation}
        loading={sendingInvitation}
      />
    </div>
  );
};

export default ManageAttendants;