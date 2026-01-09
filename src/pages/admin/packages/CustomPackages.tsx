import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Users, Tag, Search, Pencil, Trash2, MapPin, Eye, Power, Sparkles, CalendarHeart, Calendar } from "lucide-react";
import StandardButton from '../../../components/ui/StandardButton';
import { useThemeColor } from '../../../hooks/useThemeColor';
import { packageService, packageCacheService, type Package } from '../../../services';
import { getStoredUser } from "../../../utils/storage";
import { createSlugWithId } from '../../../utils/slug';
import Toast from '../../../components/ui/Toast';

interface UserData {
  name: string;
  company: string;
  subcompany?: string;
  position: string;
  role: 'attendant' | 'location_manager' | 'company_admin';
}

// Package type configuration for display
const packageTypeConfig: Record<string, { label: string; icon: React.ElementType; color: string; bgColor: string }> = {
  custom: { label: 'Custom', icon: Sparkles, color: 'text-blue-600', bgColor: 'bg-blue-50' },
  holiday: { label: 'Holiday', icon: CalendarHeart, color: 'text-red-600', bgColor: 'bg-red-50' },
  special: { label: 'Special', icon: Sparkles, color: 'text-purple-600', bgColor: 'bg-purple-50' },
  seasonal: { label: 'Seasonal', icon: Calendar, color: 'text-orange-600', bgColor: 'bg-orange-50' },
};

const CustomPackages: React.FC = () => {
  const { themeColor, fullColor } = useThemeColor();
  const [packages, setPackages] = useState<Package[]>([]);
  const [filteredPackages, setFilteredPackages] = useState<Package[]>([]);
  const [filterType, setFilterType] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterLocation, setFilterLocation] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [sortBy, setSortBy] = useState<string>("name");
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Load user data from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('zapzone_user');
    if (stored) {
      setUserData(JSON.parse(stored));
    }
  }, []);

  // Fetch packages from backend (non-regular only)
  useEffect(() => {
    const fetchPackages = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Check cache first
        const cachedPackages = await packageCacheService.getCachedPackages();
        
        if (cachedPackages && cachedPackages.length > 0) {
          // Filter to only show non-regular packages from cache
          // Also filter out soft-deleted packages
          const customPackages = cachedPackages.filter(
            (pkg: Package) => pkg.package_type && pkg.package_type !== 'regular' && !pkg.deleted_at
          );
          setPackages(customPackages);
          setLoading(false);
          return;
        }
        
        // If no cache, fetch from API
        const response = await packageService.getPackages({ 
          per_page: 50,
          sort_by: 'id',
          sort_order: 'desc',
          user_id: getStoredUser()?.id
        });
        
        const packagesData = response.data.packages || [];
        
        // Cache the fetched data
        await packageCacheService.cachePackages(packagesData);
        
        // Filter to only show non-regular packages
        // Also filter out soft-deleted packages
        const customPackages = packagesData.filter(
          (pkg: Package) => pkg.package_type && pkg.package_type !== 'regular' && !pkg.deleted_at
        );
        
        setPackages(customPackages);
      } catch (err: unknown) {
        console.error('Error fetching packages:', err);
        const error = err as { response?: { status?: number; data?: { message?: string } } };
        
        if (error.response) {
          if (error.response.status === 500) {
            setError('Server error. Please contact support or try again later.');
          } else if (error.response.status === 401) {
            setError('Unauthorized. Please log in again.');
          } else {
            setError(error.response.data?.message || 'Failed to load packages');
          }
        } else {
          setError('Network error. Please check your connection.');
        }
        setPackages([]);
      } finally {
        setLoading(false);
      }
    };
    
    fetchPackages();
  }, []);

  // Search and filter effect
  useEffect(() => {
    let result = [...packages];

    // Filter by package type
    if (filterType !== "all") {
      result = result.filter(pkg => pkg.package_type === filterType);
    }

    // Filter by location (for company-admin users)
    if (filterLocation !== "all") {
      const locationId = parseInt(filterLocation);
      result = result.filter(pkg => pkg.location_id === locationId);
    }

    // Filter by category
    if (filterCategory !== "all") {
      result = result.filter(pkg => pkg.category === filterCategory);
    }

    // Filter by search term
    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase();
      result = result.filter(pkg => {
        const featuresStr = Array.isArray(pkg.features) 
          ? pkg.features.join(' ').toLowerCase() 
          : pkg.features?.toLowerCase() || '';
        
        return pkg.name?.toLowerCase().includes(search) ||
          pkg.description?.toLowerCase().includes(search) ||
          pkg.category?.toLowerCase().includes(search) ||
          featuresStr.includes(search);
      });
    }

    // Sort packages
    result.sort((a, b) => {
      let aValue: string | number = '';
      let bValue: string | number = '';

      if (sortBy === 'name') {
        aValue = (a.name || '').toLowerCase();
        bValue = (b.name || '').toLowerCase();
      } else if (sortBy === 'price') {
        aValue = Number(a.price) || 0;
        bValue = Number(b.price) || 0;
      } else if (sortBy === 'category') {
        aValue = (a.category || '').toLowerCase();
        bValue = (b.category || '').toLowerCase();
      } else if (sortBy === 'type') {
        aValue = (a.package_type || '').toLowerCase();
        bValue = (b.package_type || '').toLowerCase();
      }

      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    setFilteredPackages(result);
  }, [packages, filterType, filterCategory, filterLocation, searchTerm, sortBy, sortOrder]);

  // Get unique categories for filtering
  const categories = ["all", ...new Set(packages.map(pkg => pkg.category).filter(Boolean))];

  // Get unique package types for filtering
  const packageTypes = ["all", ...new Set(packages.map(pkg => pkg.package_type).filter(Boolean))];

  // Get unique locations for filtering (for company-admin)
  const uniqueLocations = packages
    .filter(pkg => pkg.location)
    .reduce((acc, pkg) => {
      if (pkg.location && !acc.find(loc => loc.id === pkg.location!.id)) {
        acc.push({ id: pkg.location.id, name: pkg.location.name });
      }
      return acc;
    }, [] as Array<{ id: number; name: string }>);
  
  const isCompanyAdmin = userData?.role === 'company_admin';

  const handleDelete = async (id: number) => {
    if (window.confirm('Are you sure you want to delete this package? This action cannot be undone.')) {
      try {
        await packageService.deletePackage(id);
        setPackages(prev => prev.filter(pkg => pkg.id !== id));
        
        // Remove from cache
        await packageCacheService.removePackageFromCache(id);
        
        setToast({ message: 'Package deleted successfully!', type: 'success' });
      } catch (err) {
        console.error('Error deleting package:', err);
        setToast({ message: 'Failed to delete package. Please try again.', type: 'error' });
      }
    }
  };

  const handleToggleStatus = async (id: number) => {
    try {
      const response = await packageService.toggleStatus(id);
      
      const updatedPackage = { ...packages.find(pkg => pkg.id === id)!, is_active: response.data.is_active };
      
      setPackages(prev => prev.map(pkg => 
        pkg.id === id ? updatedPackage : pkg
      ));
      
      // Update cache
      await packageCacheService.updatePackageInCache(updatedPackage);
      
      const statusText = response.data.is_active ? 'activated' : 'deactivated';
      setToast({ message: `Package ${statusText} successfully!`, type: 'success' });
    } catch (err) {
      console.error('Error toggling package status:', err);
      setToast({ message: 'Failed to update package status. Please try again.', type: 'error' });
    }
  };

  const getPackageTypeDisplay = (type: string) => {
    const config = packageTypeConfig[type];
    if (!config) {
      return { label: type.charAt(0).toUpperCase() + type.slice(1), icon: Tag, color: 'text-gray-600', bgColor: 'bg-gray-50' };
    }
    return config;
  };

  if (loading) {
    return (
      <div className="w-full mx-auto px-4 pb-6 flex flex-col items-center justify-center min-h-96">
        <div className="text-center">
          <div className={`animate-spin rounded-full h-12 w-12 border-b-2 border-${fullColor} mx-auto mb-4`}></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full mx-auto px-4 pb-6 flex flex-col items-center justify-center min-h-96">
        <div className="text-center">
          <p className="text-red-500 text-lg mb-4">{error}</p>
          <StandardButton 
            onClick={() => window.location.reload()} 
            variant="primary"
            size="md"
          >
            Retry
          </StandardButton>
        </div>
      </div>
    );
  }

  return (
    <div className="px-6 py-8">
      {/* Page Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Custom Packages</h1>
          <p className="text-gray-600 mt-1">Holiday, special, seasonal, and promotional packages</p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/packages/trashed">
            <StandardButton
              variant="ghost"
              size="md"
              icon={Trash2}
            >
              Deleted
            </StandardButton>
          </Link>
          <Link to="/packages/create">
            <StandardButton
              variant="primary"
              size="md"
              icon={Sparkles}
            >
              Create Custom Package
            </StandardButton>
          </Link>
        </div>
      </div>

      {/* Main Content */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        {/* Filters */}
        <div className="flex flex-wrap gap-4 mb-6 pb-4 border-b border-gray-100">
          {/* Package Type Filter */}
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-gray-500" />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className={`rounded-md border border-gray-200 px-3 py-1.5 text-sm bg-white focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500`}
            >
              <option value="all">All Types</option>
              {packageTypes.filter(t => t !== 'all').map((type) => (
                <option key={type} value={type}>
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </option>
              ))}
            </select>
          </div>

          {/* Category Filter */}
          <div className="flex items-center gap-2">
            <Tag className="w-4 h-4 text-gray-500" />
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className={`rounded-md border border-gray-200 px-3 py-1.5 text-sm bg-white focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500`}
            >
              <option value="all">All Categories</option>
              {categories.filter(c => c !== 'all').map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* Location Filter (for company admin) */}
          {isCompanyAdmin && uniqueLocations.length > 0 && (
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-gray-500" />
              <select
                value={filterLocation}
                onChange={(e) => setFilterLocation(e.target.value)}
                className={`rounded-md border border-gray-200 px-3 py-1.5 text-sm bg-white focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500`}
              >
                <option value="all">All Locations</option>
                {uniqueLocations.map((loc) => (
                  <option key={loc.id} value={loc.id}>{loc.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Sort */}
          <div className="flex items-center gap-2 ml-auto">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="rounded-md border border-gray-200 px-3 py-1.5 text-sm bg-white"
            >
              <option value="name">Sort by Name</option>
              <option value="price">Sort by Price</option>
              <option value="category">Sort by Category</option>
              <option value="type">Sort by Type</option>
            </select>
            <button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="px-2 py-1.5 rounded-md border border-gray-200 text-sm hover:bg-gray-50"
            >
              {sortOrder === 'asc' ? '↑' : '↓'}
            </button>
          </div>

          {/* Search */}
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search packages..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`w-full pl-9 pr-4 py-1.5 rounded-md border border-gray-200 text-sm focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500`}
            />
          </div>
        </div>

        {/* Package Grid */}
        {filteredPackages.length === 0 ? (
          <div className="text-center py-12">
            <Sparkles className="w-12 h-12 mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No custom packages found</h3>
            <p className="text-gray-500 mb-4">
              {packages.length === 0 
                ? "Create a holiday, special, or promotional package to get started."
                : "Try adjusting your filters or search term."}
            </p>
            <Link to="/packages/create">
              <StandardButton variant="primary" size="md" icon={Sparkles}>
                Create Custom Package
              </StandardButton>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredPackages.map((pkg) => {
              const typeDisplay = getPackageTypeDisplay(pkg.package_type);
              const TypeIcon = typeDisplay.icon;
              
              return (
                <div
                  key={pkg.id}
                  className="border-2 border-gray-200 rounded-lg overflow-hidden hover:shadow-lg hover:scale-105 hover:border-gray-300 transition-all bg-white"
                >
                  <div className="p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-base text-gray-900 truncate mb-1">{pkg.name || "Unnamed Package"}</h3>
                        {pkg.location && (
                          <div className="flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-gray-400" />
                            <span className="text-xs text-gray-500">{pkg.location.name}</span>
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => handleToggleStatus(pkg.id)}
                        className={`ml-2 p-1.5 rounded-lg transition-colors ${
                          pkg.is_active
                            ? `bg-green-100 text-green-600 hover:bg-green-200`
                            : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                        }`}
                        title={pkg.is_active ? 'Active - Click to deactivate' : 'Inactive - Click to activate'}
                      >
                        <Power className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="mb-3">
                      <p className="text-sm text-gray-600 line-clamp-2 mb-2">{pkg.description || "No description"}</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${typeDisplay.bgColor} ${typeDisplay.color}`}>
                          <TypeIcon className="w-3 h-3" />
                          {typeDisplay.label}
                        </span>
                        {pkg.category && (
                          <span className={`inline-block px-2 py-1 rounded text-xs font-medium bg-${themeColor}-100 text-${fullColor}`}>
                            {pkg.category}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="pt-3 border-t border-gray-100">
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-lg font-bold text-gray-900">${Number(pkg.price).toFixed(2)}</span>
                        {pkg.max_participants && (
                          <div className="flex items-center gap-1 text-xs text-gray-500">
                            <Users className="w-3 h-3" />
                            <span>{pkg.max_participants}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <Link
                          to={`/packages/details/${createSlugWithId(pkg.name, pkg.id)}`}
                          className={`flex-1 p-1.5 text-${fullColor} hover:bg-${themeColor}-100 rounded transition-colors flex items-center justify-center`}
                          title="View details"
                        >
                          <Eye className="w-4 h-4" />
                        </Link>
                        <Link
                          to={`/packages/edit/${pkg.id}`}
                          className={`flex-1 p-1.5 text-${fullColor} hover:bg-${themeColor}-100 rounded transition-colors flex items-center justify-center`}
                          title="Edit package"
                        >
                          <Pencil className="w-4 h-4" />
                        </Link>
                        <StandardButton
                          onClick={() => handleDelete(pkg.id)}
                          variant="danger"
                          size="sm"
                          icon={Trash2}
                          className="flex-1"
                        >
                          {""}
                        </StandardButton>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Summary */}
        {filteredPackages.length > 0 && (
          <div className="mt-6 pt-4 border-t border-gray-100 text-sm text-gray-500">
            Showing {filteredPackages.length} of {packages.length} custom package{packages.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50">
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

export default CustomPackages;
