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
  DollarSign,
  Clock,
  MapPin,
  Zap,
  Image as ImageIcon
} from 'lucide-react';

// Types
interface Attraction {
  id: string;
  name: string;
  description: string;
  category: string;
  price: number;
  pricingType: string;
  maxCapacity: number;
  duration: string;
  durationUnit: string;
  location: string;
  images: string[];
  status: 'active' | 'inactive' | 'maintenance';
  createdAt: string;
  availability: Record<string, boolean>;
  timeSlots: string[];
}

interface FilterOptions {
  status: string;
  category: string;
  search: string;
}

const ManageAttractions = () => {
  const [attractions, setAttractions] = useState<Attraction[]>([]);
  const [filteredAttractions, setFilteredAttractions] = useState<Attraction[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAttractions, setSelectedAttractions] = useState<string[]>([]);
  const [filters, setFilters] = useState<FilterOptions>({
    status: 'all',
    category: 'all',
    search: ''
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [showFilters, setShowFilters] = useState(false);

  // Status colors
  const statusColors = {
    active: 'bg-green-100 text-green-800',
    inactive: 'bg-gray-100 text-gray-800',
    maintenance: 'bg-yellow-100 text-yellow-800'
  };

  // Calculate metrics data
  const metrics = [
    {
      title: 'Total Attractions',
      value: attractions.length.toString(),
      change: `${attractions.filter(a => a.status === 'active').length} active`,
      icon: Zap,
      accent: 'bg-blue-100 text-blue-700',
    },
    {
      title: 'Active Attractions',
      value: attractions.filter(a => a.status === 'active').length.toString(),
      change: `${attractions.filter(a => a.status === 'inactive').length} inactive`,
      icon: Zap,
      accent: 'bg-blue-100 text-blue-700',
    },
    {
      title: 'Avg. Price',
      value: attractions.length > 0 
        ? `$${(attractions.reduce((sum, a) => sum + a.price, 0) / attractions.length).toFixed(2)}` 
        : '$0.00',
      change: 'Per attraction',
      icon: DollarSign,
      accent: 'bg-blue-100 text-blue-700',
    },
    {
      title: 'Total Capacity',
      value: attractions.reduce((sum, a) => sum + a.maxCapacity, 0).toString(),
      change: 'Across all attractions',
      icon: Users,
      accent: 'bg-blue-100 text-blue-700',
    }
  ];

  // Load attractions from localStorage
  useEffect(() => {
    loadAttractions();
  }, []);

  // Apply filters when attractions or filters change
  useEffect(() => {
    applyFilters();
  }, [attractions, filters]);

  const loadAttractions = () => {
    try {
      const storedAttractions = localStorage.getItem('zapzone_attractions');
      if (storedAttractions) {
        const parsedAttractions = JSON.parse(storedAttractions);
        setAttractions(parsedAttractions);
      } else {
        // Sample data for demonstration
        const sampleAttractions: Attraction[] = [
          {
            id: 'attr_1',
            name: 'Laser Tag Arena',
            description: 'Exciting laser tag experience for all ages with futuristic equipment and obstacles',
            category: 'Adventure',
            price: 25,
            pricingType: 'per_person',
            maxCapacity: 20,
            duration: '30',
            durationUnit: 'minutes',
            location: 'Main Arena, Zone A',
            images: ['laser-tag.jpg'],
            status: 'active',
            createdAt: '2024-01-10T10:30:00Z',
            availability: {
              monday: true,
              tuesday: true,
              wednesday: true,
              thursday: true,
              friday: true,
              saturday: true,
              sunday: true
            },
            timeSlots: ['10:00 AM', '11:00 AM', '12:00 PM', '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM', '6:00 PM', '7:00 PM', '8:00 PM']
          },
          {
            id: 'attr_2',
            name: 'Bowling Lanes',
            description: 'Modern bowling lanes with automatic scoring and shoe rental included',
            category: 'Sports',
            price: 20,
            pricingType: 'per_lane',
            maxCapacity: 6,
            duration: '60',
            durationUnit: 'minutes',
            location: 'West Wing, Lane Area',
            images: ['bowling.jpg'],
            status: 'active',
            createdAt: '2024-01-12T14:45:00Z',
            availability: {
              monday: true,
              tuesday: true,
              wednesday: true,
              thursday: true,
              friday: true,
              saturday: true,
              sunday: true
            },
            timeSlots: ['11:00 AM', '12:00 PM', '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM', '6:00 PM', '7:00 PM', '8:00 PM', '9:00 PM']
          },
          {
            id: 'attr_3',
            name: 'VR Experience',
            description: 'Immersive virtual reality experiences with the latest technology',
            category: 'Entertainment',
            price: 35,
            pricingType: 'per_person',
            maxCapacity: 4,
            duration: '20',
            durationUnit: 'minutes',
            location: 'Tech Zone, VR Room',
            images: ['vr-experience.jpg'],
            status: 'maintenance',
            createdAt: '2024-01-05T09:15:00Z',
            availability: {
              monday: false,
              tuesday: false,
              wednesday: true,
              thursday: true,
              Friday: true,
              saturday: true,
              sunday: true
            },
            timeSlots: ['12:00 PM', '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM', '6:00 PM', '7:00 PM']
          },
          {
            id: 'attr_4',
            name: 'Rock Climbing Wall',
            description: 'Indoor rock climbing wall with varying difficulty levels and safety equipment',
            category: 'Adventure',
            price: 18,
            pricingType: 'per_person',
            maxCapacity: 10,
            duration: '45',
            durationUnit: 'minutes',
            location: 'Adventure Zone, East Wall',
            images: ['rock-climbing.jpg'],
            status: 'active',
            createdAt: '2024-01-18T11:45:00Z',
            availability: {
              monday: true,
              tuesday: true,
              wednesday: true,
              thursday: true,
              friday: true,
              saturday: true,
              sunday: false
            },
            timeSlots: ['10:00 AM', '11:00 AM', '12:00 PM', '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM']
          },
          {
            id: 'attr_5',
            name: 'Escape Room',
            description: 'Challenging puzzle rooms with different themes and difficulty levels',
            category: 'Entertainment',
            price: 120,
            pricingType: 'per_group',
            maxCapacity: 8,
            duration: '60',
            durationUnit: 'minutes',
            location: 'Puzzle Corridor, Room 3',
            images: ['escape-room.jpg'],
            status: 'inactive',
            createdAt: '2024-01-22T16:20:00Z',
            availability: {
              monday: false,
              tuesday: false,
              wednesday: false,
              thursday: true,
              friday: true,
              saturday: true,
              sunday: true
            },
            timeSlots: ['4:00 PM', '5:00 PM', '6:00 PM', '7:00 PM', '8:00 PM', '9:00 PM']
          }
        ];
        setAttractions(sampleAttractions);
        localStorage.setItem('zapzone_attractions', JSON.stringify(sampleAttractions));
      }
    } catch (error) {
      console.error('Error loading attractions:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let result = [...attractions];

    // Apply search filter
    if (filters.search) {
      const searchTerm = filters.search.toLowerCase();
      result = result.filter(attraction =>
        attraction.name.toLowerCase().includes(searchTerm) ||
        attraction.description.toLowerCase().includes(searchTerm) ||
        attraction.location.toLowerCase().includes(searchTerm) ||
        attraction.category.toLowerCase().includes(searchTerm)
      );
    }

    // Apply status filter
    if (filters.status !== 'all') {
      result = result.filter(attraction => attraction.status === filters.status);
    }

    // Apply category filter
    if (filters.category !== 'all') {
      result = result.filter(attraction => attraction.category === filters.category);
    }

    setFilteredAttractions(result);
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
      category: 'all',
      search: ''
    });
  };

  const handleSelectAttraction = (id: string) => {
    setSelectedAttractions(prev =>
      prev.includes(id)
        ? prev.filter(attractionId => attractionId !== id)
        : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedAttractions.length === currentAttractions.length) {
      setSelectedAttractions([]);
    } else {
      setSelectedAttractions(currentAttractions.map(attraction => attraction.id));
    }
  };

  const handleStatusChange = (id: string, newStatus: Attraction['status']) => {
    const updatedAttractions = attractions.map(attraction =>
      attraction.id === id ? { ...attraction, status: newStatus } : attraction
    );
    setAttractions(updatedAttractions);
    localStorage.setItem('zapzone_attractions', JSON.stringify(updatedAttractions));
  };

  const handleDeleteAttraction = (id: string) => {
    if (window.confirm('Are you sure you want to delete this attraction? This action cannot be undone.')) {
      const updatedAttractions = attractions.filter(attraction => attraction.id !== id);
      setAttractions(updatedAttractions);
      localStorage.setItem('zapzone_attractions', JSON.stringify(updatedAttractions));
    }
  };

  const handleBulkDelete = () => {
    if (selectedAttractions.length === 0) return;
    
    if (window.confirm(`Are you sure you want to delete ${selectedAttractions.length} attraction(s)? This action cannot be undone.`)) {
      const updatedAttractions = attractions.filter(attraction => !selectedAttractions.includes(attraction.id));
      setAttractions(updatedAttractions);
      setSelectedAttractions([]);
      localStorage.setItem('zapzone_attractions', JSON.stringify(updatedAttractions));
    }
  };

  const handleBulkStatusChange = (newStatus: Attraction['status']) => {
    if (selectedAttractions.length === 0) return;
    
    const updatedAttractions = attractions.map(attraction =>
      selectedAttractions.includes(attraction.id) ? { ...attraction, status: newStatus } : attraction
    );
    setAttractions(updatedAttractions);
    setSelectedAttractions([]);
    localStorage.setItem('zapzone_attractions', JSON.stringify(updatedAttractions));
  };

  // Get unique categories
  const getUniqueCategories = () => {
    const categories = attractions.map(attraction => attraction.category);
    return [...new Set(categories)];
  };

  // Pagination
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentAttractions = filteredAttractions.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredAttractions.length / itemsPerPage);

  const paginate = (pageNumber: number) => setCurrentPage(pageNumber);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-700"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 px-6 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Manage Attractions</h1>
          <p className="text-gray-600 mt-2">View and manage all attractions in your facility</p>
        </div>
        <Link
          to="/create-attraction"
          className="mt-4 sm:mt-0 inline-flex items-center px-4 py-2 bg-blue-700 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-5 w-5 mr-2" />
          New Attraction
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
              <div className="flex items-center gap-2">
                <div className={`p-2 rounded-lg ${metric.accent}`}><Icon size={20} /></div>
                <span className="text-base font-semibold text-gray-700">{metric.title}</span>
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
              placeholder="Search attractions..."
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              className="pl-9 pr-3 py-1.5 border border-gray-200 rounded-lg w-full text-sm focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
            />
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 text-sm"
            >
              <Filter className="h-4 w-4 mr-1" />
              Filters
            </button>
            <button
              onClick={loadAttractions}
              className="flex items-center px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 text-sm"
            >
              <RefreshCcw className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Advanced Filters */}
        {showFilters && (
          <div className="mt-3 p-3 bg-gray-50 rounded-lg">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={filters.status}
                  onChange={(e) => handleFilterChange('status', e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
                >
                  <option value="all">All Statuses</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="maintenance">Maintenance</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Category</label>
                <select
                  value={filters.category}
                  onChange={(e) => handleFilterChange('category', e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
                >
                  <option value="all">All Categories</option>
                  {getUniqueCategories().map(category => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-3 flex justify-end">
              <button
                onClick={clearFilters}
                className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800"
              >
                Clear Filters
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bulk Actions */}
      {selectedAttractions.length > 0 && (
        <div className="bg-blue-50 p-4 rounded-lg mb-6 flex flex-wrap items-center gap-4">
          <span className="text-blue-800 font-medium">
            {selectedAttractions.length} attraction(s) selected
          </span>
          <div className="flex gap-2">
            <select
              onChange={(e) => handleBulkStatusChange(e.target.value as Attraction['status'])}
              className="border border-gray-200 rounded-lg px-3 py-1 focus:ring-2 focus:ring-blue-400"
            >
              <option value="">Change Status</option>
              <option value="active">Activate</option>
              <option value="inactive">Deactivate</option>
              <option value="maintenance">Maintenance</option>
            </select>
            <button
              onClick={handleBulkDelete}
              className="flex items-center px-3 py-1 bg-red-100 text-red-700 rounded-lg hover:bg-red-200"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Delete
            </button>
          </div>
        </div>
      )}

      {/* Attractions Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium w-12">
                  <input
                    type="checkbox"
                    checked={selectedAttractions.length === currentAttractions.length && currentAttractions.length > 0}
                    onChange={handleSelectAll}
                    className="rounded border-gray-300 text-blue-700 focus:ring-blue-400"
                  />
                </th>
                <th scope="col" className="px-4 py-3 font-medium">Attraction</th>
                <th scope="col" className="px-4 py-3 font-medium">Category</th>
                <th scope="col" className="px-4 py-3 font-medium">Location</th>
                <th scope="col" className="px-4 py-3 font-medium">Price</th>
                <th scope="col" className="px-4 py-3 font-medium">Capacity</th>
                <th scope="col" className="px-4 py-3 font-medium">Duration</th>
                <th scope="col" className="px-4 py-3 font-medium">Status</th>
                <th scope="col" className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {currentAttractions.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-8 text-center text-gray-700">
                    No attractions found
                  </td>
                </tr>
              ) : (
                currentAttractions.map((attraction) => (
                  <tr key={attraction.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={selectedAttractions.includes(attraction.id)}
                        onChange={() => handleSelectAttraction(attraction.id)}
                        className="rounded border-gray-300 text-blue-700 focus:ring-blue-400"
                      />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center">
                        {attraction.images && attraction.images.length > 0 ? (
                          <div className="w-10 h-10 bg-gray-200 rounded-md flex items-center justify-center mr-3">
                            <ImageIcon className="h-5 w-5 text-gray-400" />
                          </div>
                        ) : (
                          <div className="w-10 h-10 bg-blue-100 rounded-md flex items-center justify-center mr-3">
                            <Zap className="h-5 w-5 text-blue-700" />
                          </div>
                        )}
                        <div>
                          <div className="font-medium text-gray-900">{attraction.name}</div>
                          <div className="text-xs text-gray-700 line-clamp-1">{attraction.description}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                      {attraction.category}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center text-sm text-gray-900">
                        <MapPin className="h-4 w-4 text-gray-400 mr-1" />
                        {attraction.location}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                      <div className="flex items-center">
                        <DollarSign className="h-4 w-4 text-gray-400 mr-1" />
                        {attraction.price}
                        <span className="text-xs text-gray-700 ml-1">
                          {attraction.pricingType === 'per_person' ? '/person' : 
                           attraction.pricingType === 'per_group' ? '/group' : 
                           attraction.pricingType === 'per_hour' ? '/hour' : ''}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                      <div className="flex items-center">
                        <Users className="h-4 w-4 text-gray-400 mr-1" />
                        {attraction.maxCapacity}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                      <div className="flex items-center">
                        <Clock className="h-4 w-4 text-gray-400 mr-1" />
                        {attraction.duration} {attraction.durationUnit}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <select
                        value={attraction.status}
                        onChange={(e) => handleStatusChange(attraction.id, e.target.value as Attraction['status'])}
                        className={`text-xs font-medium px-2 py-1 rounded-full ${statusColors[attraction.status]} border-none focus:ring-2 focus:ring-blue-400`}
                      >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                        <option value="maintenance">Maintenance</option>
                      </select>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center gap-2">
                        <Link
                          to={`/book/attraction/${attraction.id}`}
                          className="p-1 text-blue-700 hover:text-blue-800"
                          title="View Booking Page"
                        >
                          <Eye className="h-4 w-4" />
                        </Link>
                        <Link
                          to={`/edit-attraction/${attraction.id}`}
                          className="p-1 text-gray-600 hover:text-gray-800"
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </Link>
                        <button
                          onClick={() => handleDeleteAttraction(attraction.id)}
                          className="p-1 text-red-600 hover:text-red-800"
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
              <div className="text-sm text-gray-700">
                Showing <span className="font-medium">{indexOfFirstItem + 1}</span> to{' '}
                <span className="font-medium">
                  {Math.min(indexOfLastItem, filteredAttractions.length)}
                </span>{' '}
                of <span className="font-medium">{filteredAttractions.length}</span> results
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => paginate(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Previous
                </button>
                
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    onClick={() => paginate(page)}
                    className={`px-3 py-1 border rounded-lg text-sm font-medium ${
                      currentPage === page
                        ? 'border-blue-700 bg-blue-700 text-white'
                        : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {page}
                  </button>
                ))}
                
                <button
                  onClick={() => paginate(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
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

export default ManageAttractions;