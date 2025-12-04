import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Calendar, Users, Tag, Gift, Search, Filter, Download, Upload, X, CheckSquare, Square, Pencil, Trash2, MapPin, Eye } from "lucide-react";
import { useThemeColor } from '../../../hooks/useThemeColor';
import { packageService, type Package } from '../../../services';
import { getStoredUser } from "../../../utils/storage";

interface UserData {
  name: string;
  company: string;
  subcompany?: string;
  position: string;
  role: 'attendant' | 'location_manager' | 'company_admin';
}

const Packages: React.FC = () => {
  const { themeColor, fullColor } = useThemeColor();
  const [packages, setPackages] = useState<Package[]>([]);
  const [filteredPackages, setFilteredPackages] = useState<Package[]>([]);
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterLocation, setFilterLocation] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [sortBy, setSortBy] = useState<string>("name");
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [showExportModal, setShowExportModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedForExport, setSelectedForExport] = useState<number[]>([]);
  const [importData, setImportData] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);

  // Load user data from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('zapzone_user');
    if (stored) {
      setUserData(JSON.parse(stored));
    }
  }, []);

  // Fetch packages from backend
  useEffect(() => {
    const fetchPackages = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await packageService.getPackages({ 
          per_page: 50, // Backend max is 50 for better performance
          sort_by: 'id',
          sort_order: 'desc',
          user_id: getStoredUser()?.id
        });
        
        const packagesData = response.data.packages || [];
        setPackages(packagesData);
        
        // Cache packages in localStorage for offline fallback
        try {
          localStorage.setItem('packages_cache', JSON.stringify(packagesData));
        } catch (cacheErr) {
          console.warn('Failed to cache packages:', cacheErr);
        }
      } catch (err: unknown) {
        console.error('Error fetching packages:', err);
        
        // Detailed error logging
        const error = err as { response?: { status?: number; data?: { message?: string }; headers?: unknown }; request?: unknown; message?: string };
        
        if (error.response) {
          console.error('Response status:', error.response.status);
          console.error('Response data:', error.response.data);
          console.error('Response headers:', error.response.headers);
          
          if (error.response.status === 500) {
            setError('Server error. Please contact support or try again later.');
          } else if (error.response.status === 401) {
            setError('Unauthorized. Please log in again.');
          } else if (error.response.status === 403) {
            setError('Access denied. You do not have permission to view packages.');
          } else {
            setError(error.response.data?.message || 'Failed to load packages');
          }
        } else if (error.request) {
          console.error('No response received:', error.request);
          setError('Network error. Please check your connection.');
        } else {
          console.error('Error message:', error.message);
          setError('An unexpected error occurred.');
        }
        
        // Try to load from localStorage as fallback
        try {
          const cachedPackages = localStorage.getItem('packages_cache');
          if (cachedPackages) {
            const parsed = JSON.parse(cachedPackages);
            setPackages(parsed);
            console.log('Loaded packages from cache');
          } else {
            setPackages([]);
          }
        } catch (cacheErr) {
          console.error('Cache error:', cacheErr);
          setPackages([]);
        }
      } finally {
        setLoading(false);
      }
    };
    
    fetchPackages();
  }, []);

  // Search and filter effect
  useEffect(() => {
    let result = [...packages];

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
      result = result.filter(pkg =>
        pkg.name?.toLowerCase().includes(search) ||
        pkg.description?.toLowerCase().includes(search) ||
        pkg.category?.toLowerCase().includes(search) ||
        pkg.features?.toLowerCase().includes(search)
      );
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
      }

      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    setFilteredPackages(result);
  }, [packages, filterCategory, filterLocation, searchTerm, sortBy, sortOrder]);

  // Get unique categories for filtering
  const categories = ["all", ...new Set(packages.map(pkg => pkg.category).filter(Boolean))];

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

  // Helper for comma-joined or fallback
  const displayList = (arr?: Array<{ name?: string; code?: string; [key: string]: unknown }>, prop?: string) => {
    if (!arr || arr.length === 0) return <span className="text-gray-400 text-sm">None</span>;
    
    if (prop && arr[0] && typeof arr[0] === 'object') {
      return arr.map((item, i) => (
        <span key={i} className="text-sm text-gray-600">
          {String(item[prop] || '')}{i < arr.length - 1 ? ', ' : ''}
        </span>
      ));
    }
    
    return <span className="text-sm text-gray-600">{arr.map(item => item.name || item.code || '').join(", ")}</span>;
  };

  // Format availability text
  const formatAvailability = (pkg: Package) => {
    if (!pkg.availability_type) return "Not specified";
    
    if (pkg.availability_type === "daily") {
      if (!pkg.available_days || pkg.available_days.length === 0) return "No days selected";
      if (pkg.available_days.length === 7) return "Every day";
      return pkg.available_days.map((day) => String(day).substring(0, 3)).join(", ");
    } else if (pkg.availability_type === "weekly") {
      if (!pkg.available_week_days || pkg.available_week_days.length === 0) return "No days selected";
      return pkg.available_week_days.map((day) => `Every ${day}`).join(", ");
    } else if (pkg.availability_type === "monthly") {
      if (!pkg.available_month_days || pkg.available_month_days.length === 0) return "No days selected";
      return pkg.available_month_days.map((day) => {
        const dayStr = String(day);
        if (dayStr === "last") return "Last day of month";
        const suffix = dayStr === "1" ? "st" : dayStr === "2" ? "nd" : dayStr === "3" ? "rd" : "th";
        return `${dayStr}${suffix}`;
      }).join(", ");
    }
    return "Not specified";
  };

  // Domain for booking links
//   or how about using an the url 
  const bookingDomain = window.location.origin; 

  // Export functionality
  const handleOpenExportModal = () => {
    setSelectedForExport(packages.map(pkg => pkg.id));
    setShowExportModal(true);
  };

  const handleToggleExportSelection = (id: number) => {
    setSelectedForExport(prev =>
      prev.includes(id) ? prev.filter(pkgId => pkgId !== id) : [...prev, id]
    );
  };

  const handleSelectAllForExport = () => {
    if (selectedForExport.length === packages.length) {
      setSelectedForExport([]);
    } else {
      setSelectedForExport(packages.map(pkg => pkg.id));
    }
  };

  const handleExport = () => {
    const packagesToExport = packages.filter(pkg => selectedForExport.includes(pkg.id));
    
    // Remove IDs and timestamps from exported data
    const cleanedPackages = packagesToExport.map(pkg => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id: _id, created_at: _created, updated_at: _updated, ...cleanPkg } = pkg;
      return cleanPkg;
    });
    
    const jsonData = JSON.stringify(cleanedPackages, null, 2);
    const blob = new Blob([jsonData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `zapzone-packages-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setShowExportModal(false);
  };

  // Import functionality
  const handleImport = async () => {
    try {
      const parsedData = JSON.parse(importData);
      
      if (!Array.isArray(parsedData)) {
        alert('Invalid JSON format. Please provide an array of packages.');
        return;
      }

      // Validate the structure
      const isValid = parsedData.every(pkg => 
        typeof pkg === 'object' && pkg.name && pkg.price
      );

      if (!isValid) {
        alert('Invalid package data structure. Each package must have at least name and price.');
        return;
      }

      // Prepare packages for bulk import (remove any IDs that might exist)
      const packagesForImport = parsedData.map(pkg => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { id: _id, created_at: _created, updated_at: _updated, ...cleanPkg } = pkg;
        return {
          location_id: cleanPkg.location_id || 1,
          name: cleanPkg.name,
          description: cleanPkg.description || '',
          category: cleanPkg.category || 'Uncategorized',
          features: cleanPkg.features,
          price: Number(cleanPkg.price),
          price_per_additional: cleanPkg.price_per_additional ? Number(cleanPkg.price_per_additional) : undefined,
          max_participants: Number(cleanPkg.max_participants) || 1,
          duration: Number(cleanPkg.duration) || 1,
          duration_unit: cleanPkg.duration_unit || 'hours',
          availability_type: cleanPkg.availability_type || 'daily',
          available_days: cleanPkg.available_days,
          available_week_days: cleanPkg.available_week_days,
          available_month_days: cleanPkg.available_month_days,
          image: cleanPkg.image,
          is_active: cleanPkg.is_active !== false,
          // Include relationship IDs if they exist
          attraction_ids: cleanPkg.attraction_ids || [],
          addon_ids: cleanPkg.addon_ids || [],
          room_ids: cleanPkg.room_ids || [],
          gift_card_ids: cleanPkg.gift_card_ids || [],
          promo_ids: cleanPkg.promo_ids || [],
        };
      });

      // Use bulk import endpoint
      const response = await packageService.bulkImport(packagesForImport);
      
      // Refresh the packages list
      const packagesResponse = await packageService.getPackages({ 
        per_page: 50,
        sort_by: 'id',
        sort_order: 'desc'
      });
      setPackages(packagesResponse.data.packages || []);
      
      setShowImportModal(false);
      setImportData('');
      
      const successCount = response.data.imported_count || 0;
      const failedCount = response.data.failed_count || 0;
      
      if (failedCount > 0) {
        console.error('Import errors:', response.errors);
        alert(`Imported ${successCount} package(s). ${failedCount} failed. Check console for details.`);
      } else {
        alert(`Successfully imported ${successCount} package(s)!`);
      }
    } catch (error) {
      console.error('Import error:', error);
      alert('Error importing packages. Please check the format and try again.');
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

  const handleDelete = async (id: number) => {
    if (window.confirm('Are you sure you want to delete this package? This action cannot be undone.')) {
      try {
        await packageService.deletePackage(id);
        // Remove from local state
        setPackages(prev => prev.filter(pkg => pkg.id !== id));
        alert('Package deleted successfully!');
      } catch (err) {
        console.error('Error deleting package:', err);
        alert('Failed to delete package. Please try again.');
      }
    }
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
          <button 
            onClick={() => window.location.reload()} 
            className={`px-6 py-2 bg-${fullColor} text-white rounded-lg hover:bg-${themeColor}-900`}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full mx-auto px-4 pb-6 flex flex-col items-center">
      <div className="bg-white rounded-xl p-6 w-full shadow-sm border border-gray-100 mt-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900">Packages</h2>
            <p className="text-gray-500 mt-1">Manage and view all your packages</p>
          </div>
          <div className="flex gap-2">
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
              disabled={packages.length === 0}
            >
              <Download size={18} />
              Export
            </button>
            <Link
              to="/packages/create"
              className={`bg-${fullColor} hover:bg-${themeColor}-900 text-white px-6 py-2 rounded-lg font-semibold whitespace-nowrap`}
            >
              Create Package
            </Link>
          </div>
        </div>

        {/* Show create button if no packages */}
        {(packages == null || packages.length === 0) ? (
          <div className="flex flex-col items-center py-12">
            <div className="text-gray-400 mb-2">No packages found</div>
            <p className="text-gray-500 text-sm mb-4">Create your first package to get started</p>
            <button
              className={`bg-${fullColor} hover:bg-${themeColor}-900 text-white px-6 py-2 rounded-lg font-semibold`}
              onClick={() => window.location.href = "/packages/create"}
            >
              Create Package
            </button>
          </div>
        ) : (
          <>
            {/* Search and Filter Section */}
            <div className="mb-6 space-y-4">
              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search packages by name, description, or category..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={`w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 outline-none`}
                />
              </div>

              {/* Filter and Sort Controls */}
              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                <div className="flex flex-col sm:flex-row gap-4 flex-wrap items-start sm:items-center">
                  {/* Location Filter (Company Admin only) */}
                  {isCompanyAdmin && uniqueLocations.length > 0 && (
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-gray-500" />
                      <span className="text-sm font-medium text-gray-700">Location:</span>
                      <select
                        value={filterLocation}
                        onChange={(e) => setFilterLocation(e.target.value)}
                        className={`px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 outline-none`}
                      >
                        <option value="all">All Locations</option>
                        {uniqueLocations.map((location) => (
                          <option key={location.id} value={location.id}>
                            {location.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Category Filter */}
                  {categories.length > 1 && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <Filter className="w-4 h-4 text-gray-500" />
                      <span className="text-sm font-medium text-gray-700">Category:</span>
                      {categories.map((category) => (
                        <button 
                          key={category}
                          className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                            filterCategory === category 
                              ? `bg-${fullColor} text-white` 
                              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                          }`}
                          onClick={() => setFilterCategory(category)}
                        >
                          {category === "all" ? "All" : category}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Sort Controls */}
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-gray-700">Sort by:</span>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className={`px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 outline-none`}
                  >
                    <option value="name">Name</option>
                    <option value="price">Price</option>
                    <option value="category">Category</option>
                  </select>
                  <button
                    onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                    className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm hover:bg-gray-50 transition-colors"
                  >
                    {sortOrder === 'asc' ? '↑ Asc' : '↓ Desc'}
                  </button>
                </div>
              </div>

              {/* Results count */}
              <div className="text-sm text-gray-500">
                Showing {filteredPackages.length} of {packages.length} package{packages.length !== 1 ? 's' : ''}
              </div>
            </div>

            {/* Packages Grid */}
            {filteredPackages.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredPackages.map((pkg) => (
                  <div 
                    key={pkg.id} 
                    className="border border-gray-200 rounded-xl p-5 hover:shadow-md transition-shadow"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-lg text-gray-900 truncate">{pkg.name || "Unnamed Package"}</h3>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="text-sm text-gray-500">{pkg.category || "No category"}</span>
                          <span className={`text-lg font-semibold text-${fullColor}`}>${pkg.price || "0"}</span>
                        </div>
                        {pkg.location && (
                          <div className="flex items-center gap-1 mt-1">
                            <MapPin className="w-3 h-3 text-gray-400" />
                            <span className="text-xs text-gray-500">{pkg.location.name}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2 ml-2">
                        <Link
                          to={`/packages/details/${pkg.id}`}
                          className={`p-2 text-${fullColor} hover:bg-${themeColor}-50 rounded-lg transition-colors`}
                          title="View details"
                        >
                          <Eye size={18} />
                        </Link>
                        <Link
                          to={`/packages/edit/${pkg.id}`}
                          className={`p-2 text-${fullColor} hover:bg-${themeColor}-50 rounded-lg transition-colors`}
                          title="Edit package"
                        >
                          <Pencil size={18} />
                        </Link>
                        <button
                          onClick={() => handleDelete(pkg.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete package"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>

                    <div className="mb-4">
                      <p className="text-sm text-gray-600 line-clamp-2">{pkg.description || "No description"}</p>
                    </div>

                    <div className="grid gap-3 mb-4">
                      {pkg.features && (
                        <div className="flex items-start gap-2">
                          <Tag className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                          <div className="text-sm">
                            <span className="font-medium">Features: </span>
                            <span className="text-gray-600">{pkg.features}</span>
                          </div>
                        </div>
                      )}

                      <div className="flex items-start gap-2">
                        <Calendar className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                        <div className="text-sm">
                          <span className="font-medium">Availability: </span>
                          <span className="text-gray-600">{formatAvailability(pkg)}</span>
                        </div>
                      </div>

                      {pkg.max_participants && (
                        <div className="flex items-start gap-2">
                          <Users className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                          <div className="text-sm">
                            <span className="font-medium">Max Participants: </span>
                            <span className="text-gray-600">{pkg.max_participants}</span>
                            {pkg.price_per_additional && (
                              <span className="text-gray-600"> (${pkg.price_per_additional} per additional)</span>
                            )}
                          </div>
                        </div>
                      )}

                      {pkg.attractions && pkg.attractions.length > 0 && (
                        <div className="flex items-start gap-2">
                          <div className="w-4 h-4 flex-shrink-0" />
                          <div className="text-sm">
                            <span className="font-medium">Attractions: </span>
                            {displayList(pkg.attractions)}
                          </div>
                        </div>
                      )}

                      {pkg.add_ons && pkg.add_ons.length > 0 && (
                        <div className="flex items-start gap-2">
                          <div className="w-4 h-4 flex-shrink-0" />
                          <div className="text-sm">
                            <span className="font-medium">Add-ons: </span>
                            {displayList(pkg.add_ons, 'name')}
                          </div>
                        </div>
                      )}

                      {pkg.promos && pkg.promos.length > 0 && (
                        <div className="flex items-start gap-2">
                          <Tag className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                          <div className="text-sm">
                            <span className="font-medium">Promos: </span>
                            {displayList(pkg.promos, 'name')}
                          </div>
                        </div>
                      )}

                      {pkg.gift_cards && pkg.gift_cards.length > 0 && (
                        <div className="flex items-start gap-2">
                          <Gift className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                          <div className="text-sm">
                            <span className="font-medium">Gift Cards: </span>
                            {displayList(pkg.gift_cards, 'code')}
                          </div>
                        </div>
                      )}
                    </div>

                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 border border-dashed border-gray-300 rounded-xl">
                <div className="text-gray-400 mb-2">No packages found</div>
                <p className="text-gray-500 text-sm mb-4">
                  {searchTerm 
                    ? `No packages match "${searchTerm}"` 
                    : filterLocation !== "all"
                      ? `No packages for the selected location`
                      : filterCategory !== "all" 
                        ? `No packages in the "${filterCategory}" category` 
                        : "Create your first package to get started"
                  }
                </p>
                {(searchTerm || filterCategory !== "all" || filterLocation !== "all") && (
                  <button
                    className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-6 py-2 rounded-lg font-semibold mr-2"
                    onClick={() => {
                      setSearchTerm("");
                      setFilterCategory("all");
                      setFilterLocation("all");
                    }}
                  >
                    Clear Filters
                  </button>
                )}
                <button
                  className={`bg-${fullColor} hover:bg-${themeColor}-900 text-white px-6 py-2 rounded-lg font-semibold`}
                  onClick={() => window.location.href = "/packages/create"}
                >
                  Create Package
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-backdrop-fade">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Export Packages</h3>
                  <p className="text-sm text-gray-500 mt-1">Select packages to export as JSON</p>
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
                  className={`flex items-center gap-2 text-sm font-medium text-${fullColor} hover:text-${themeColor}-900`}
                >
                  {selectedForExport.length === packages.length ? (
                    <CheckSquare size={18} />
                  ) : (
                    <Square size={18} />
                  )}
                  {selectedForExport.length === packages.length ? 'Deselect All' : 'Select All'}
                </button>
                <span className="text-sm text-gray-600">
                  {selectedForExport.length} of {packages.length} selected
                </span>
              </div>

              <div className="space-y-2">
                {packages.map((pkg) => (
                  <div
                    key={pkg.id}
                    className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                      selectedForExport.includes(pkg.id)
                        ? `border-${themeColor}-500 bg-${themeColor}-50`
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => handleToggleExportSelection(pkg.id)}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-1">
                        {selectedForExport.includes(pkg.id) ? (
                          <CheckSquare size={18} className={`text-${fullColor}`} />
                        ) : (
                          <Square size={18} className="text-gray-400" />
                        )}
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-900">{pkg.name || 'Unnamed Package'}</h4>
                        <p className="text-sm text-gray-600 mt-1">{pkg.category} • ${pkg.price}</p>
                        {pkg.description && (
                          <p className="text-xs text-gray-500 mt-1 line-clamp-1">{pkg.description}</p>
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
                className={`px-4 py-2 bg-${fullColor} text-white rounded-lg hover:bg-${themeColor}-900 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2`}
              >
                <Download size={18} />
                Export {selectedForExport.length} Package{selectedForExport.length !== 1 ? 's' : ''}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-backdrop-fade">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Import Packages</h3>
                  <p className="text-sm text-gray-500 mt-1">Upload or paste JSON data to import packages</p>
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
                  Upload or Drag JSON File
                </label>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleFileUpload}
                  className={`block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-${themeColor}-50 file:text-${fullColor} hover:file:bg-${themeColor}-100`}
                />
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
                  placeholder='[{"name": "Package Name", "price": "100", "category": "Type", ...}]'
                  rows={12}
                  className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 font-mono text-sm`}
                />
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-blue-900 mb-2">Import Notes:</h4>
                <ul className="text-xs text-${} space-y-1">
                  <li>• JSON must be an array of package objects</li>
                  <li>• Each package must have at least a name and price</li>
                  <li>• Package IDs will be automatically generated</li>
                  <li>• Existing IDs in the import file will be ignored</li>
                  <li>• You can include relationship IDs (attraction_ids, addon_ids, room_ids, gift_card_ids, promo_ids)</li>
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
                className={`px-4 py-2 bg-${fullColor} text-white rounded-lg hover:bg-${themeColor}-900 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2`}
              >
                <Upload size={18} />
                Import Packages
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Packages;