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
  Square,
  Link2
} from 'lucide-react';
import { formatDurationDisplay } from '../../../utils/timeFormat';
import { useThemeColor } from '../../../hooks/useThemeColor';
import CounterAnimation from '../../../components/ui/CounterAnimation';
import StandardButton from '../../../components/ui/StandardButton';
import type {
  ManageAttractionsAttraction,
  ManageAttractionsFilterOptions,
} from '../../../types/manageAttractions.types';
import { attractionService } from '../../../services/AttractionService';
import { attractionCacheService } from '../../../services/AttractionCacheService';
import type { Attraction } from '../../../services/AttractionService';
import { locationService } from '../../../services/LocationService';
import LocationSelector from '../../../components/admin/LocationSelector';
import Toast from '../../../components/ui/Toast';
import { createSlugWithId } from '../../../utils/slug';
import { getStoredUser } from '../../../utils/storage';

const ManageAttractions = () => {
  const { themeColor, fullColor } = useThemeColor();
  const currentUser = getStoredUser();
  const isCompanyAdmin = currentUser?.role === 'company_admin';
  const [locations, setLocations] = useState<Array<{ id: number; name: string; address?: string; city?: string; state?: string }>>([]);
  const [selectedLocation, setSelectedLocation] = useState<number | null>(null);
  const [attractions, setAttractions] = useState<ManageAttractionsAttraction[]>([]);

  // Get auth token from localStorage
  const getAuthToken = () => {
    const userData = localStorage.getItem('zapzone_user');
    if (userData) {
      try {
        const user = JSON.parse(userData);
        return user.token;
      } catch (error) {
        console.error('Error parsing user data:', error);
        return null;
      }
    }
    return null;
  };
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
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

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

  const handleImport = async () => {
    try {
      const parsedData = JSON.parse(importData);
      if (!Array.isArray(parsedData)) {
        setToast({ message: 'Invalid data format. Please provide a valid JSON array of attractions.', type: 'error' });
        return;
      }

      // Get the current user's location_id
      const currentUser = getStoredUser();
      const userLocationId = currentUser?.location_id || 1;

      // Convert to API format - use user's location_id for all imports
      const attractionsToImport = parsedData.map((attraction: ManageAttractionsAttraction) => ({
        location_id: userLocationId, // Use logged-in user's location_id
        name: attraction.name,
        description: attraction.description,
        price: Number(attraction.price),
        pricing_type: attraction.pricingType || 'per_person',
        max_capacity: Number(attraction.maxCapacity),
        category: attraction.category,
        duration: attraction.duration ? Number(attraction.duration) : undefined,
        duration_unit: attraction.durationUnit as 'hours' | 'minutes' | 'hours and minutes',
        availability: Array.isArray(attraction.availability) ? attraction.availability : [{
          days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
          start_time: '09:00',
          end_time: '17:00'
        }],
        image: attraction.images?.[0],
        is_active: attraction.status === 'active',
      }));

      // Use bulk import endpoint
      try {
        const response = await attractionService.bulkImport({ attractions: attractionsToImport });
        
        setImportData("");
        setShowImportModal(false);
        
        const successCount = response.data.imported_count || 0;
        const failedCount = response.data.failed_count || 0;
        
        if (failedCount > 0) {
          console.error('Import errors:', response.errors);
          setToast({ message: `Imported ${successCount} attraction(s). ${failedCount} failed. Check console for details.`, type: 'info' });
        } else {
          setToast({ message: `Successfully imported ${successCount} attraction(s)!`, type: 'success' });
        }
        
        loadAttractions(); // Reload the list
      } catch (err) {
        console.error('Bulk import failed, trying individual imports...', err);
        
        // Fallback: import one by one if bulk endpoint fails
        let successCount = 0;
        for (const attraction of attractionsToImport) {
          try {
            await attractionService.createAttraction(attraction);
            successCount++;
          } catch (err) {
            console.error('Failed to import attraction:', err);
          }
        }

        setImportData("");
        setShowImportModal(false);
        setToast({ message: `Successfully imported ${successCount} of ${attractionsToImport.length} attraction(s)!`, type: 'success' });
        loadAttractions();
      }
    } catch (error) {
      console.error('Import error:', error);
      setToast({ message: 'Invalid JSON format. Please check your data and try again.', type: 'error' });
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
    active: `bg-${themeColor}-100 text-${fullColor}`,
    inactive: 'bg-gray-100 text-gray-800',
    maintenance: 'bg-yellow-100 text-yellow-800',
  };

  // Calculate metrics data
  const metrics = [
    {
      title: 'Total Attractions',
      value: attractions.length.toString(),
      change: `${attractions.filter(a => a.status === 'active').length} active`,
      accent: `bg-${themeColor}-100 text-${fullColor}`,
      icon: Star,
    },
    {
      title: 'Active Attractions',
      value: attractions.filter(a => a.status === 'active').length.toString(),
      change: `${attractions.filter(a => a.status === 'inactive').length} inactive`,
      accent: `bg-${themeColor}-100 text-${fullColor}`,
      icon: Zap,
    },
    {
      title: 'Avg. Price',
      value: attractions.length > 0 
        ? `$${(attractions.reduce((sum, a) => sum + Number(a.price), 0) / attractions.length).toFixed(2)}` 
        : '$0.00',
      change: 'Per attraction',
      accent: `bg-${themeColor}-100 text-${fullColor}`,
      icon: DollarSign,
    },
    {
      title: 'Total Capacity',
      value: attractions.reduce((sum, a) => sum + a.maxCapacity, 0).toString(),
      change: 'Across all attractions',
      accent: `bg-${themeColor}-100 text-${fullColor}`,
      icon: Users,
    }
  ];

  // Fetch locations for company admin
  useEffect(() => {
    if (isCompanyAdmin) {
      const fetchLocations = async () => {
        try {
          const response = await locationService.getLocations();
          if (response.success && response.data) {
            setLocations(Array.isArray(response.data) ? response.data : []);
          }
        } catch (error) {
          console.error('Error fetching locations:', error);
        }
      };
      fetchLocations();
    }
  }, [isCompanyAdmin]);

  // Load attractions from localStorage
  useEffect(() => {
    loadAttractions();
  }, [selectedLocation]);

  // Apply filters when attractions or filters change
  useEffect(() => {
    applyFilters();
  }, [attractions, filters]);

  const loadAttractions = async () => {
    try {
      setLoading(true);
      const authToken = getAuthToken();
      console.log('🔐 Loading attractions - Auth Token:', authToken ? 'Present' : 'Missing');
      
      // Check cache first for instant loading
      const cachedAttractions = await attractionCacheService.getCachedAttractions();
      
      if (cachedAttractions && cachedAttractions.length > 0) {
        // Convert cached API format to component format
        const convertedAttractions: ManageAttractionsAttraction[] = cachedAttractions
          .filter((attr: Attraction & { location?: { id: number; name: string } }) => {
            // Apply location filter if set
            if (selectedLocation !== null && attr.location_id !== selectedLocation) {
              return false;
            }
            return true;
          })
          .map((attr: Attraction & { location?: { id: number; name: string } }) => ({
            id: attr.id.toString(),
            name: attr.name,
            description: attr.description,
            category: attr.category,
            price: attr.price,
            pricingType: attr.pricing_type,
            maxCapacity: attr.max_capacity,
            duration: attr.duration?.toString() || '',
            durationUnit: attr.duration_unit || 'minutes',
            location: attr.location?.name || '',
            locationId: attr.location_id,
            locationName: attr.location?.name || '',
            images: attr.image ? (Array.isArray(attr.image) ? attr.image : [attr.image]) : [],
            status: attr.is_active ? 'active' : 'inactive',
            createdAt: attr.created_at,
            availability: typeof attr.availability === 'object' ? attr.availability as Record<string, boolean> : {
              monday: true,
              tuesday: true,
              wednesday: true,
              thursday: true,
              friday: true,
              saturday: true,
              sunday: true
            },
          }));
        setAttractions(convertedAttractions);
        setLoading(false);
        return;
      }
      
      const params: Record<string, string | number | boolean | undefined> = {
        search: filters.search || undefined,
        category: filters.category !== 'all' ? filters.category : undefined,
        per_page: 100, 
        user_id: getStoredUser()?.id
      };
      
      // Only add is_active filter if status is not 'all'
      if (filters.status !== 'all') {
        params.is_active = filters.status === 'active';
      }
      
      if (selectedLocation !== null) {
        params.location_id = selectedLocation;
      }
      
      const response = await attractionService.getAttractions(params);
      
      // Cache the fetched attractions
      await attractionCacheService.cacheAttractions(response.data.attractions);

      // Convert API format to component format
      const convertedAttractions: ManageAttractionsAttraction[] = response.data.attractions.map((attr: Attraction & { location?: { id: number; name: string } }) => ({
        id: attr.id.toString(),
        name: attr.name,
        description: attr.description,
        category: attr.category,
        price: attr.price,
        pricingType: attr.pricing_type,
        maxCapacity: attr.max_capacity,
        duration: attr.duration?.toString() || '',
        durationUnit: attr.duration_unit || 'minutes',
        location: attr.location?.name || '',
        locationId: attr.location_id,
        locationName: attr.location?.name || '',
        images: attr.image ? (Array.isArray(attr.image) ? attr.image : [attr.image]) : [],
        status: attr.is_active ? 'active' : 'inactive',
        createdAt: attr.created_at,
        availability: typeof attr.availability === 'object' ? attr.availability as Record<string, boolean> : {
          monday: true,
          tuesday: true,
          wednesday: true,
          thursday: true,
          friday: true,
          saturday: true,
          sunday: true
        },
      }));

      setAttractions(convertedAttractions);
    } catch (error) {
      console.error('Error loading attractions:', error);
      setToast({ message: 'Failed to load attractions', type: 'error' });
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

  const handleStatusChange = async (id: string, newStatus: ManageAttractionsAttraction['status']) => {
    try {
      if (newStatus === 'active') {
        await attractionService.activateAttraction(Number(id));
      } else {
        await attractionService.deactivateAttraction(Number(id));
      }
      
      // Update attraction status in state without full reload
      setAttractions(prev => prev.map(attraction => 
        attraction.id === id ? { ...attraction, status: newStatus } : attraction
      ));
      
      // Update cache with new status
      const cachedAttraction = await attractionCacheService.getAttractionFromCache(Number(id));
      if (cachedAttraction) {
        await attractionCacheService.updateAttractionInCache({
          ...cachedAttraction,
          is_active: newStatus === 'active'
        });
      }
      
      setToast({ message: 'Status updated successfully', type: 'success' });
    } catch (error) {
      console.error('Error updating status:', error);
      setToast({ message: 'Failed to update status', type: 'error' });
    }
  };

  const handleDeleteAttraction = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this attraction? This action cannot be undone.')) {
      try {
        await attractionService.deleteAttraction(Number(id));
        
        // Remove attraction from state without full reload
        setAttractions(prev => prev.filter(attraction => attraction.id !== id));
        
        // Remove from cache
        await attractionCacheService.removeAttractionFromCache(Number(id));
        
        setToast({ message: 'Attraction deleted successfully', type: 'success' });
      } catch (error) {
        console.error('Error deleting attraction:', error);
        setToast({ message: 'Failed to delete attraction', type: 'error' });
      }
    }
  };

  const handleBulkDelete = async () => {
    if (selectedAttractions.length === 0) return;
    
    if (window.confirm(`Are you sure you want to delete ${selectedAttractions.length} attraction(s)? This action cannot be undone.`)) {
      try {
        // Delete each attraction
        await Promise.all(
          selectedAttractions.map(id => attractionService.deleteAttraction(Number(id)))
        );
        
        // Remove attractions from state without full reload
        setAttractions(prev => prev.filter(attraction => !selectedAttractions.includes(attraction.id)));
        
        // Remove from cache
        await Promise.all(
          selectedAttractions.map(id => attractionCacheService.removeAttractionFromCache(Number(id)))
        );
        
        setToast({ message: `${selectedAttractions.length} attraction(s) deleted successfully`, type: 'success' });
        setSelectedAttractions([]);
      } catch (error) {
        console.error('Error deleting attractions:', error);
        setToast({ message: 'Failed to delete some attractions', type: 'error' });
      }
    }
  };

  const handleBulkStatusChange = async (newStatus: ManageAttractionsAttraction['status']) => {
    if (selectedAttractions.length === 0) return;
    
    try {
      // Update each attraction's status
      await Promise.all(
        selectedAttractions.map(id => 
          newStatus === 'active' 
            ? attractionService.activateAttraction(Number(id))
            : attractionService.deactivateAttraction(Number(id))
        )
      );
      
      // Update attractions status in state without full reload
      setAttractions(prev => prev.map(attraction => 
        selectedAttractions.includes(attraction.id) 
          ? { ...attraction, status: newStatus }
          : attraction
      ));
      
      // Update cache for each attraction
      await Promise.all(
        selectedAttractions.map(async (id) => {
          const cachedAttraction = await attractionCacheService.getAttractionFromCache(Number(id));
          if (cachedAttraction) {
            await attractionCacheService.updateAttractionInCache({
              ...cachedAttraction,
              is_active: newStatus === 'active'
            });
          }
        })
      );
      
      setToast({ message: `${selectedAttractions.length} attraction(s) updated successfully`, type: 'success' });
      setSelectedAttractions([]);
    } catch (error) {
      console.error('Error updating attractions:', error);
      setToast({ message: 'Failed to update some attractions', type: 'error' });
    }
  };

  const copyPurchaseLink = (attraction: ManageAttractionsAttraction) => {
    // Create a URL-friendly location slug from location name or use location_id
    const locationSlug = attraction.locationName 
      ? attraction.locationName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
      : `location-${attraction.locationId || '1'}`;
    const attractionSlug = createSlugWithId(attraction.name, attraction.id);
    const fullPurchaseLink = `${window.location.origin}/purchase/attraction/${locationSlug}/${attractionSlug}`;
    navigator.clipboard.writeText(fullPurchaseLink);
    setCopiedLink(attraction.id);
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
        <div className={`animate-spin rounded-full h-12 w-12 border-b-2 border-${fullColor}`}></div>
      </div>
    );
  }

  return (
    <div className="px-6 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Manage Attractions</h1>
          <p className="text-gray-600 mt-2">View and manage all attractions in your facility</p>
        </div>
        <div className="mt-4 sm:mt-0 flex gap-2">
          {isCompanyAdmin && (
            <LocationSelector
              variant="compact"
              locations={locations}
              selectedLocation={selectedLocation?.toString() || ''}
              onLocationChange={(id) => setSelectedLocation(id ? Number(id) : null)}
              themeColor={themeColor}
              fullColor={fullColor}
              showAllOption={true}
            />
          )}
          <StandardButton
            onClick={() => setShowImportModal(true)}
            variant="secondary"
            size="md"
            icon={Upload}
          >
            Import
          </StandardButton>
          <StandardButton
            onClick={handleOpenExportModal}
            disabled={attractions.length === 0}
            variant="secondary"
            size="md"
            icon={Download}
          >
            Export
          </StandardButton>
          <StandardButton
            onClick={() => window.location.href = "/attractions/create"}
            variant="primary"
            size="md"
          >
            New Attraction
          </StandardButton>
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
              <Search className="h-4 w-4 text-gray-600" />
            </div>
            <input
              type="text"
              placeholder="Search attractions..."
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              className={`pl-9 pr-3 py-1.5 border border-gray-200 rounded-lg w-full text-sm focus:ring-2 focus:ring-${themeColor}-600 focus:border-${themeColor}-600`}
            />
          </div>
          <div className="flex gap-1">
            <StandardButton
              onClick={() => setShowFilters(!showFilters)}
              variant="secondary"
              size="sm"
              icon={Filter}
            >
              Filters
            </StandardButton>
            <StandardButton
              onClick={loadAttractions}
              variant="secondary"
              size="sm"
              icon={RefreshCcw}
            >
              {''}
            </StandardButton>
          </div>
        </div>

        {/* Advanced Filters */}
        {showFilters && (
          <div className="mt-3 p-3 bg-gray-50 rounded-lg">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-800 mb-1">Status</label>
                <select
                  value={filters.status}
                  onChange={(e) => handleFilterChange('status', e.target.value)}
                  className={`w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-${themeColor}-600 focus:border-${themeColor}-600`}
                >
                  <option value="all">All Statuses</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-800 mb-1">Category</label>
                <select
                  value={filters.category}
                  onChange={(e) => handleFilterChange('category', e.target.value)}
                  className={`w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-${themeColor}-600 focus:border-${themeColor}-600`}
                >
                  <option value="all">All Categories</option>
                  {getUniqueCategories().map(category => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-3 flex justify-end">
              <StandardButton
                onClick={clearFilters}
                variant="ghost"
                size="sm"
              >
                Clear Filters
              </StandardButton>
            </div>
          </div>
        )}
      </div>

      {/* Bulk Actions */}
      {selectedAttractions.length > 0 && (
        <div className={`bg-${themeColor}-50 p-4 rounded-lg mb-6 flex flex-wrap items-center gap-4`}>
          <span className={`text-${fullColor} font-medium`}>
            {selectedAttractions.length} attraction(s) selected
          </span>
          <div className="flex gap-2">
            <select
              onChange={(e) => handleBulkStatusChange(e.target.value as ManageAttractionsAttraction['status'])}
              className={`border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-${themeColor}-400`}
            >
              <option value="">Change Status</option>
              <option value="active">Activate</option>
              <option value="inactive">Deactivate</option>
            </select>
            <StandardButton
              onClick={handleBulkDelete}
              variant="danger"
              size="md"
              icon={Trash2}
            >
              Delete
            </StandardButton>
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
                    className={`rounded border-gray-300 text-${fullColor} focus:ring-${themeColor}-400`}
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
                        className={`rounded border-gray-300 text-${fullColor} focus:ring-${themeColor}-400`}
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
                      {attraction.duration === '0' || !attraction.duration ? 'Unlimited' : formatDurationDisplay(parseFloat(attraction.duration), attraction.durationUnit)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <select
                        value={attraction.status}
                        onChange={(e) => handleStatusChange(attraction.id, e.target.value as ManageAttractionsAttraction['status'])}
                        className={`text-xs font-medium px-3 py-1 rounded-full ${statusColors[attraction.status]} border-none focus:ring-2 focus:ring-${themeColor}-400`}
                      >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <StandardButton
                          onClick={() => copyPurchaseLink(attraction)}
                          variant="ghost"
                          size="sm"
                          icon={ShoppingCart}
                          className={`bg-${themeColor}-100 text-${fullColor} hover:bg-${themeColor}-200 text-xs`}
                          title="Copy purchase link"
                        >
                          {copiedLink === attraction.id ? 'Copied!' : 'Copy Link'}
                        </StandardButton>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <Link
                          to={`${window.location.origin}/purchase/attraction/${attraction.locationName ? attraction.locationName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') : `location-${attraction.locationId || '1'}`}/${createSlugWithId(attraction.name, attraction.id)}`}
                          className={`text-${themeColor}-600 hover:text-${fullColor}`}
                          title="View Purchase Page"
                          target="_blank"
                        >
                          <Link2 className="h-4 w-4" />
                        </Link>
                        <Link
                          to={`/attractions/details/${createSlugWithId(attraction.name, attraction.id)}`}
                          className={`text-${fullColor} hover:text-${themeColor}-900`}
                          title="View Details"
                        >
                          <Eye className="h-4 w-4" />
                        </Link>
                        <Link
                          to={`/attractions/edit/${attraction.id}`}
                          className="text-gray-600 hover:text-gray-800"
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </Link>
                        <StandardButton
                          onClick={() => handleDeleteAttraction(attraction.id)}
                          variant="danger"
                          size="sm"
                          icon={Trash2}
                          className="text-red-600 hover:text-red-800 p-1"
                          title="Delete"
                        />
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
                <StandardButton
                  onClick={() => paginate(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  variant="secondary"
                  size="sm"
                >
                  Previous
                </StandardButton>
                
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <StandardButton
                    key={page}
                    onClick={() => paginate(page)}
                    variant={currentPage === page ? 'primary' : 'secondary'}
                    size="sm"
                  >
                    {page}
                  </StandardButton>
                ))}
                
                <StandardButton
                  onClick={() => paginate(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  variant="secondary"
                  size="sm"
                >
                  Next
                </StandardButton>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-backdrop-fade" onClick={() => setShowExportModal(false)}>
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Export Attractions</h3>
                  <p className="text-sm text-gray-500 mt-1">Select attractions to export as JSON</p>
                </div>
                <StandardButton
                  onClick={() => setShowExportModal(false)}
                  variant="ghost"
                  size="md"
                  icon={X}
                  className="p-2"
                />
              </div>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-200">
                <StandardButton
                  onClick={handleSelectAllForExport}
                  variant="ghost"
                  size="sm"
                  icon={selectedForExport.length === attractions.length ? CheckSquare : Square}
                >
                  {selectedForExport.length === attractions.length ? 'Deselect All' : 'Select All'}
                </StandardButton>
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
                        ? `border-${themeColor}-500 bg-${themeColor}-50`
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => handleToggleExportSelection(attraction.id)}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-1">
                        {selectedForExport.includes(attraction.id) ? (
                          <CheckSquare size={18} className={`text-${themeColor}-700`} />
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
              <StandardButton
                onClick={() => setShowExportModal(false)}
                variant="secondary"
                size="md"
              >
                Cancel
              </StandardButton>
              <StandardButton
                onClick={handleExport}
                disabled={selectedForExport.length === 0}
                variant="primary"
                size="md"
                icon={Download}
              >
                Export {selectedForExport.length} Attraction{selectedForExport.length !== 1 ? 's' : ''}
              </StandardButton>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-backdrop-fade" onClick={() => { setShowImportModal(false); setImportData(''); }}>
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Import Attractions</h3>
                  <p className="text-sm text-gray-500 mt-1">Upload or paste JSON data to import attractions</p>
                </div>
                <StandardButton
                  onClick={() => {
                    setShowImportModal(false);
                    setImportData('');
                  }}
                  variant="ghost"
                  size="sm"
                  icon={X}
                />
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
                  className={`block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-${themeColor}-50 file:text-${themeColor}-700 hover:file:bg-${themeColor}-100`}
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
                    <StandardButton
                      onClick={() => setImportData('')}
                      variant="ghost"
                      size="sm"
                    >
                      Clear
                    </StandardButton>
                  )}
                </div>
                <textarea
                  value={importData}
                  onChange={(e) => setImportData(e.target.value)}
                  placeholder='[{"name": "Attraction Name", "category": "Category", "price": 50, ...}]'
                  rows={12}
                  className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 font-mono text-sm`}
                />
              </div>

              <div className={`bg-${themeColor}-50 border border-${themeColor}-200 rounded-lg p-4`}>
                <h4 className={`text-sm font-semibold text-${themeColor}-900 mb-2`}>Import Notes:</h4>
                <ul className={`text-xs text-${fullColor} space-y-1`}>
                  <li>• JSON must be an array of attraction objects</li>
                  <li>• Each attraction must have at least a name and price</li>
                  <li>• Imported attractions will be added to existing attractions</li>
                  <li>• New IDs will be generated to avoid conflicts</li>
                </ul>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <StandardButton
                onClick={() => {
                  setShowImportModal(false);
                  setImportData('');
                }}
                variant="secondary"
              >
                Cancel
              </StandardButton>
              <StandardButton
                onClick={handleImport}
                disabled={!importData.trim()}
                variant="primary"
                icon={Upload}
              >
                Import Attractions
              </StandardButton>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 animate-slide-in-right">
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(null)}
          />
        </div>
      )}
    </div>
  );
};

export default ManageAttractions;