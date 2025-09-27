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
  Clock,
  User,
  Mail,
  Phone,
  MapPin
} from 'lucide-react';

// Types
interface Attendant {
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
}

interface FilterOptions {
  status: string;
  department: string;
  search: string;
}

const ManageAttendants = () => {
  const [attendants, setAttendants] = useState<Attendant[]>([]);
  const [filteredAttendants, setFilteredAttendants] = useState<Attendant[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAttendants, setSelectedAttendants] = useState<string[]>([]);
  const [filters, setFilters] = useState<FilterOptions>({
    status: 'all',
    department: 'all',
    search: ''
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [showFilters, setShowFilters] = useState(false);

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
    'Maintenance': 'bg-yellow-100 text-yellow-800',
    'Security': 'bg-red-100 text-red-800',
    'Administration': 'bg-blue-100 text-blue-800'
  };

  // Calculate metrics data
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
      title: 'Avg. Experience',
      value: attendants.length > 0 
        ? `${Math.round(attendants.reduce((sum, a) => {
            const hireDate = new Date(a.hireDate);
            const today = new Date();
            const months = (today.getFullYear() - hireDate.getFullYear()) * 12 + (today.getMonth() - hireDate.getMonth());
            return sum + Math.max(0, months);
          }, 0) / attendants.length)} months` 
        : '0 months',
      change: 'Average tenure',
      accent: 'bg-blue-100 text-blue-800',
      icon: Clock,
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
        // Sample data for demonstration
        const sampleAttendants: Attendant[] = [
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
            createdAt: '2024-01-15T08:00:00Z'
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
            createdAt: '2024-02-01T09:30:00Z'
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
            createdAt: '2023-11-20T14:15:00Z'
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
            createdAt: '2024-03-10T10:00:00Z'
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

  const handleStatusChange = (id: string, newStatus: Attendant['status']) => {
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

  const handleBulkStatusChange = (newStatus: Attendant['status']) => {
    if (selectedAttendants.length === 0) return;
    
    const updatedAttendants = attendants.map(attendant =>
      selectedAttendants.includes(attendant.id) ? { ...attendant, status: newStatus } : attendant
    );
    setAttendants(updatedAttendants);
    setSelectedAttendants([]);
    localStorage.setItem('zapzone_attendants', JSON.stringify(updatedAttendants));
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
        <Link
          to="/attendants/create"
          className="mt-4 sm:mt-0 inline-flex items-center px-4 py-2 bg-blue-800 text-white rounded-lg hover:bg-blue-900 transition-colors"
        >
          <Plus className="h-5 w-5 mr-2" />
          New Attendant
        </Link>
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
              onChange={(e) => handleBulkStatusChange(e.target.value as Attendant['status'])}
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
                <th scope="col" className="px-6 py-4 font-medium">Shift</th>
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
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {attendant.shift.split('(')[0].trim()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {getExperience(attendant.hireDate)} months
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <select
                        value={attendant.status}
                        onChange={(e) => handleStatusChange(attendant.id, e.target.value as Attendant['status'])}
                        className={`text-xs font-medium px-3 py-1 rounded-full ${statusColors[attendant.status]} border-none focus:ring-2 focus:ring-blue-400`}
                      >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
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
    </div>
  );
};

export default ManageAttendants;