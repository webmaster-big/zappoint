import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Eye, 
  Pencil, 
  Trash2, 
  Search, 
  Filter, 
  RefreshCcw,
  Users,
  DollarSign,
  Zap,
  Star,
  ShoppingCart,
  Download,
  Upload,
  X,
  CheckSquare,
  Square
} from 'lucide-react';
import type {
  ManageAttractionsAttraction,
  ManageAttractionsFilterOptions,
} from '../../../types/manageAttractions.types';

const ManageAttractions = () => {
  const [attractions, setAttractions] = useState<ManageAttractionsAttraction[]>([]);
  const [filteredAttractions, setFilteredAttractions] = useState<ManageAttractionsAttraction[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAttractions, setSelectedAttractions] = useState<string[]>([]);
  const [filters, setFilters] = useState<ManageAttractionsFilterOptions>({
    status: 'all',
    category: 'all',
    search: ''
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [showFilters, setShowFilters] = useState(false);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedForExport, setSelectedForExport] = useState<string[]>([]);
  const [importData, setImportData] = useState<string>("");

  // Export/Import handlers
  const handleOpenExportModal = () => {
    setSelectedForExport(attractions.map(attraction => attraction.id));
    setShowExportModal(true);
  };

  const handleToggleExportSelection = (id: string) => {
    setSelectedForExport(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllForExport = () => {
    if (selectedForExport.length === attractions.length) {
      setSelectedForExport([]);
    } else {
      setSelectedForExport(attractions.map(attraction => attraction.id));
    }
  };

  const handleExport = () => {
    const attractionsToExport = attractions.filter(attraction => selectedForExport.includes(attraction.id || ''));
    const jsonData = JSON.stringify(attractionsToExport, null, 2);
    const blob = new Blob([jsonData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `zapzone-attractions-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setShowExportModal(false);
  };

  const handleImport = () => {
    try {
      const parsedData = JSON.parse(importData);
      if (!Array.isArray(parsedData)) {
        alert('Invalid data format. Please provide a valid JSON array of attractions.');
        return;
      }

      const newAttractions = parsedData.map((attraction: ManageAttractionsAttraction) => ({
        ...attraction,
        id: `attr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      }));

      const updatedAttractions = [...attractions, ...newAttractions];
      setAttractions(updatedAttractions);
      localStorage.setItem('zapzone_attractions', JSON.stringify(updatedAttractions));
      setImportData("");
      setShowImportModal(false);
      alert(`Successfully imported ${newAttractions.length} attraction(s)!`);
    } catch (error) {
      alert('Invalid JSON format. Please check your data and try again.');
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        setImportData(content);
      };
      reader.readAsText(file);
    }
  };

  // Status colors
  const statusColors = {
    active: 'bg-blue-100 text-blue-800',
    inactive: 'bg-gray-100 text-gray-800',
    maintenance: 'bg-yellow-100 text-yellow-800'
  };

  // Calculate metrics data
  const metrics = [
    {
      title: 'Total Attractions',
      value: attractions.length.toString(),
      change: `${attractions.filter(a => a.status === 'active').length} active`,
      accent: 'bg-blue-100 text-blue-800',
      icon: Star,
    },
    {
      title: 'Active Attractions',
      value: attractions.filter(a => a.status === 'active').length.toString(),
      change: `${attractions.filter(a => a.status === 'inactive').length} inactive`,
      accent: 'bg-blue-100 text-blue-800',
      icon: Zap,
    },
    {
      title: 'Avg. Price',
      value: attractions.length > 0 
        ? `$${(attractions.reduce((sum, a) => sum + a.price, 0) / attractions.length).toFixed(2)}` 
        : '$0.00',
      change: 'Per attraction',
      accent: 'bg-blue-100 text-blue-800',
      icon: DollarSign,
    },
    {
      title: 'Total Capacity',
      value: attractions.reduce((sum, a) => sum + a.maxCapacity, 0).toString(),
      change: 'Across all attractions',
      accent: 'bg-blue-100 text-blue-800',
      icon: Users,
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
        const sampleAttractions: ManageAttractionsAttraction[] = [
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
              friday: true,
              saturday: true,
              sunday: true
            },
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

  const handleFilterChange = (key: keyof ManageAttractionsFilterOptions, value: string) => {
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

  const handleStatusChange = (id: string, newStatus: ManageAttractionsAttraction['status']) => {
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

  const handleBulkStatusChange = (newStatus: ManageAttractionsAttraction['status']) => {
    if (selectedAttractions.length === 0) return;
    
    const updatedAttractions = attractions.map(attraction =>
      selectedAttractions.includes(attraction.id) ? { ...attraction, status: newStatus } : attraction
    );
    setAttractions(updatedAttractions);
    setSelectedAttractions([]);
    localStorage.setItem('zapzone_attractions', JSON.stringify(updatedAttractions));
  };

  const copyPurchaseLink = (id: string) => {
    const fullPurchaseLink = `${window.location.origin}/purchase/attraction/${id}`;
    navigator.clipboard.writeText(fullPurchaseLink);
    setCopiedLink(id);
    setTimeout(() => setCopiedLink(null), 2000);
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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-800"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-6 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Manage Attractions</h1>
          <p className="text-gray-600 mt-2">View and manage all attractions in your facility</p>
        </div>
        <div className="mt-4 sm:mt-0 flex gap-2">
          <button
            className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg font-semibold whitespace-nowrap flex items-center gap-2"
            onClick={() => setShowImportModal(true)}
          >
            <Upload size={18} />
            Import
          </button>
          <button
            className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg font-semibold whitespace-nowrap flex items-center gap-2"
            onClick={handleOpenExportModal}
            disabled={attractions.length === 0}
          >
            <Download size={18} />
            Export
          </button>
          <button
            className="bg-blue-700 hover:bg-blue-800 text-white px-6 py-2 rounded-lg font-semibold whitespace-nowrap"
            onClick={() => window.location.href = "/attractions/create"}
          >
            New Attraction
          </button>
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
              placeholder="Search attractions..."
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
              onClick={loadAttractions}
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
                  <option value="maintenance">Maintenance</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-800 mb-1">Category</label>
                <select
                  value={filters.category}
                  onChange={(e) => handleFilterChange('category', e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
                >
                  <option value="all">All Categories</option>
                  {getUniqueCategories().map(category => (
                    <option key={category} value={category}>{category}</option>
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
      {selectedAttractions.length > 0 && (
        <div className="bg-blue-50 p-4 rounded-lg mb-6 flex flex-wrap items-center gap-4">
          <span className="text-blue-800 font-medium">
            {selectedAttractions.length} attraction(s) selected
          </span>
          <div className="flex gap-2">
            <select
              onChange={(e) => handleBulkStatusChange(e.target.value as ManageAttractionsAttraction['status'])}
              className="border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-400"
            >
              <option value="">Change Status</option>
              <option value="active">Activate</option>
              <option value="inactive">Deactivate</option>
              <option value="maintenance">Maintenance</option>
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

      {/* Attractions Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-gray-800 uppercase bg-gray-50 border-b">
              <tr>
                <th scope="col" className="px-6 py-4 font-medium w-12">
                  <input
                    type="checkbox"
                    checked={selectedAttractions.length === currentAttractions.length && currentAttractions.length > 0}
                    onChange={handleSelectAll}
                    className="rounded border-gray-300 text-blue-800 focus:ring-blue-400"
                  />
                </th>
                <th scope="col" className="px-6 py-4 font-medium">Attraction</th>
                <th scope="col" className="px-6 py-4 font-medium">Category</th>
                <th scope="col" className="px-6 py-4 font-medium">Price</th>
                <th scope="col" className="px-6 py-4 font-medium">Capacity</th>
                <th scope="col" className="px-6 py-4 font-medium">Duration</th>
                <th scope="col" className="px-6 py-4 font-medium">Status</th>
                <th scope="col" className="px-6 py-4 font-medium">Purchase Link</th>
                <th scope="col" className="px-6 py-4 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {currentAttractions.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-8 text-center text-gray-800">
                    No attractions found
                  </td>
                </tr>
              ) : (
                currentAttractions.map((attraction) => (
                  <tr key={attraction.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={selectedAttractions.includes(attraction.id)}
                        onChange={() => handleSelectAttraction(attraction.id)}
                        className="rounded border-gray-300 text-blue-800 focus:ring-blue-400"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <div className="font-medium text-gray-900">{attraction.name}</div>
                        <div className="text-xs text-gray-600 mt-1">{attraction.location}</div>
                        <div className="text-xs text-gray-500 mt-1 line-clamp-2">{attraction.description}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {attraction.category}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      ${attraction.price}
                      <span className="text-xs text-gray-600 ml-1">
                        {attraction.pricingType === 'per_person' ? '/person' : 
                         attraction.pricingType === 'per_group' ? '/group' : 
                         attraction.pricingType === 'per_hour' ? '/hour' : ''}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {attraction.maxCapacity} people
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {attraction.duration} {attraction.durationUnit}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <select
                        value={attraction.status}
                        onChange={(e) => handleStatusChange(attraction.id, e.target.value as ManageAttractionsAttraction['status'])}
                        className={`text-xs font-medium px-3 py-1 rounded-full ${statusColors[attraction.status]} border-none focus:ring-2 focus:ring-blue-400`}
                      >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                        <option value="maintenance">Maintenance</option>
                      </select>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => copyPurchaseLink(attraction.id)}
                          className="flex items-center px-3 py-1 bg-blue-100 text-blue-800 rounded-lg hover:bg-blue-200 transition-colors text-xs"
                          title="Copy purchase link"
                        >
                          <ShoppingCart className="h-3 w-3 mr-1" />
                          {copiedLink === attraction.id ? 'Copied!' : 'Copy Link'}
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <Link
                          to={`${window.location.origin}/purchase/attraction/${attraction.id}`}
                          className="text-blue-600 hover:text-blue-800"
                          title="View Purchase Page"
                          target="_blank"
                        >
                          <Eye className="h-4 w-4" />
                        </Link>
                        <Link
                          to={`/edit-attraction/${attraction.id}`}
                          className="text-gray-600 hover:text-gray-800"
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </Link>
                        <button
                          onClick={() => handleDeleteAttraction(attraction.id)}
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
                  {Math.min(indexOfLastItem, filteredAttractions.length)}
                </span>{' '}
                of <span className="font-medium">{filteredAttractions.length}</span> results
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

      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Export Attractions</h3>
                  <p className="text-sm text-gray-500 mt-1">Select attractions to export as JSON</p>
                </div>
                <button
                  onClick={() => setShowExportModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-200">
                <button
                  onClick={handleSelectAllForExport}
                  className="flex items-center gap-2 text-sm font-medium text-blue-700 hover:text-blue-800"
                >
                  {selectedForExport.length === attractions.length ? (
                    <CheckSquare size={18} />
                  ) : (
                    <Square size={18} />
                  )}
                  {selectedForExport.length === attractions.length ? 'Deselect All' : 'Select All'}
                </button>
                <span className="text-sm text-gray-600">
                  {selectedForExport.length} of {attractions.length} selected
                </span>
              </div>

              <div className="space-y-2">
                {attractions.map((attraction) => (
                  <div
                    key={attraction.id}
                    className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                      selectedForExport.includes(attraction.id)
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => handleToggleExportSelection(attraction.id)}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-1">
                        {selectedForExport.includes(attraction.id) ? (
                          <CheckSquare size={18} className="text-blue-700" />
                        ) : (
                          <Square size={18} className="text-gray-400" />
                        )}
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-900">{attraction.name}</h4>
                        <p className="text-sm text-gray-600 mt-1">
                          {attraction.category} • ${attraction.price}
                          <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${statusColors[attraction.status]}`}>
                            {attraction.status}
                          </span>
                        </p>
                        {attraction.description && (
                          <p className="text-xs text-gray-500 mt-1 line-clamp-1">{attraction.description}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setShowExportModal(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleExport}
                disabled={selectedForExport.length === 0}
                className="px-4 py-2 bg-blue-700 text-white rounded-lg hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Download size={18} />
                Export {selectedForExport.length} Attraction{selectedForExport.length !== 1 ? 's' : ''}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Import Attractions</h3>
                  <p className="text-sm text-gray-500 mt-1">Upload or paste JSON data to import attractions</p>
                </div>
                <button
                  onClick={() => {
                    setShowImportModal(false);
                    setImportData('');
                  }}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Upload JSON File
                </label>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleFileUpload}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
              </div>

              <div className="relative mb-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">OR</span>
                </div>
              </div>

              <div className="mb-4">
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Or Paste JSON Data
                  </label>
                  {importData && (
                    <button
                      onClick={() => setImportData('')}
                      className="text-xs text-gray-500 hover:text-gray-700"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <textarea
                  value={importData}
                  onChange={(e) => setImportData(e.target.value)}
                  placeholder='[{"name": "Attraction Name", "category": "Category", "price": 50, ...}]'
                  rows={12}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                />
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-blue-900 mb-2">Import Notes:</h4>
                <ul className="text-xs text-blue-800 space-y-1">
                  <li>• JSON must be an array of attraction objects</li>
                  <li>• Each attraction must have at least a name and price</li>
                  <li>• Imported attractions will be added to existing attractions</li>
                  <li>• New IDs will be generated to avoid conflicts</li>
                </ul>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowImportModal(false);
                  setImportData('');
                }}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleImport}
                disabled={!importData.trim()}
                className="px-4 py-2 bg-blue-700 text-white rounded-lg hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Upload size={18} />
                Import Attractions
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManageAttractions;