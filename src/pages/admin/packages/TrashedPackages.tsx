import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Trash2, RotateCcw, Search, AlertTriangle, MapPin, Tag, Users, Package as PackageIcon } from "lucide-react";
import StandardButton from '../../../components/ui/StandardButton';
import { useThemeColor } from '../../../hooks/useThemeColor';
import { packageService, type Package } from '../../../services';
import { packageCacheService } from '../../../services/PackageCacheService';
import { getStoredUser } from "../../../utils/storage";
import Toast from '../../../components/ui/Toast';

interface UserData {
  name: string;
  company: string;
  subcompany?: string;
  position: string;
  role: 'attendant' | 'location_manager' | 'company_admin';
}

const TrashedPackages: React.FC = () => {
  const { themeColor, fullColor } = useThemeColor();
  const [trashedPackages, setTrashedPackages] = useState<Package[]>([]);
  const [filteredPackages, setFilteredPackages] = useState<Package[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [filterLocation, setFilterLocation] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [showForceDeleteModal, setShowForceDeleteModal] = useState<Package | null>(null);

  // Load user data from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('zapzone_user');
    if (stored) {
      setUserData(JSON.parse(stored));
    }
  }, []);

  // Fetch trashed packages from backend
  useEffect(() => {
    fetchTrashedPackages();
  }, []);

  const fetchTrashedPackages = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Check cache first for faster loading
      const hasCachedData = await packageCacheService.hasCachedData();
      
      if (hasCachedData) {
        console.log('[TrashedPackages] Checking cache for deleted packages...');
        const cachedPackages = await packageCacheService.getCachedPackages();
        
        if (cachedPackages && cachedPackages.length > 0) {
          // Filter only packages with deleted_at set (soft-deleted)
          const deletedFromCache = cachedPackages.filter(
            (pkg: Package) => pkg.deleted_at !== null && pkg.deleted_at !== undefined
          );
          
          if (deletedFromCache.length > 0) {
            console.log('[TrashedPackages] Found', deletedFromCache.length, 'deleted packages in cache');
            setTrashedPackages(deletedFromCache);
            setLoading(false);
            return;
          }
        }
      }
      
      // No cached deleted packages, fetch from API with trashed filter
      console.log('[TrashedPackages] Fetching from API...');
      const response = await packageService.getPackages({ 
        per_page: 50,
        sort_by: 'id',
        sort_order: 'desc',
        user_id: getStoredUser()?.id,
        trashed: 'only' // Only get soft-deleted packages (deleted_at IS NOT NULL)
      });
      
      const packagesData = response.data.packages || [];
      // Extra safety: filter only packages with deleted_at set (not null)
      const deletedPackages = packagesData.filter((pkg: Package) => pkg.deleted_at !== null && pkg.deleted_at !== undefined);
      setTrashedPackages(deletedPackages);
      
      console.log('[TrashedPackages] Loaded', deletedPackages.length, 'deleted packages from API');
    } catch (err: unknown) {
      console.error('Error fetching trashed packages:', err);
      const error = err as { response?: { status?: number; data?: { message?: string } } };
      
      if (error.response) {
        if (error.response.status === 500) {
          setError('Server error. Please contact support or try again later.');
        } else if (error.response.status === 401) {
          setError('Unauthorized. Please log in again.');
        } else {
          setError(error.response.data?.message || 'Failed to load trashed packages');
        }
      } else {
        setError('An unexpected error occurred.');
      }
      setTrashedPackages([]);
    } finally {
      setLoading(false);
    }
  };

  // Search and filter effect
  useEffect(() => {
    let result = [...trashedPackages];

    // Filter by location
    if (filterLocation !== "all") {
      const locationId = parseInt(filterLocation);
      result = result.filter(pkg => pkg.location_id === locationId);
    }

    // Filter by search term
    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase();
      result = result.filter(pkg => {
        return pkg.name?.toLowerCase().includes(search) ||
          pkg.description?.toLowerCase().includes(search) ||
          pkg.category?.toLowerCase().includes(search);
      });
    }

    setFilteredPackages(result);
  }, [trashedPackages, filterLocation, searchTerm]);

  // Get unique locations for filtering
  const uniqueLocations = trashedPackages
    .filter(pkg => pkg.location)
    .reduce((acc, pkg) => {
      if (pkg.location && !acc.find(loc => loc.id === pkg.location!.id)) {
        acc.push({ id: pkg.location.id, name: pkg.location.name });
      }
      return acc;
    }, [] as Array<{ id: number; name: string }>);

  const isCompanyAdmin = userData?.role === 'company_admin';

  // Restore a soft-deleted package
  const handleRestore = async (pkg: Package) => {
    try {
      setActionLoading(pkg.id);
      await packageService.restorePackage(pkg.id);
      
      // Remove from local state
      setTrashedPackages(prev => prev.filter(p => p.id !== pkg.id));
      
      // Update cache - add the restored package back
      const restoredPkg = { ...pkg, deleted_at: null };
      await packageCacheService.updatePackageInCache(restoredPkg);
      
      setToast({ message: `Package "${pkg.name}" restored successfully!`, type: 'success' });
    } catch (err) {
      console.error('Error restoring package:', err);
      setToast({ message: 'Failed to restore package. Please try again.', type: 'error' });
    } finally {
      setActionLoading(null);
    }
  };

  // Permanently delete a package
  const handleForceDelete = async (pkg: Package) => {
    try {
      setActionLoading(pkg.id);
      await packageService.forceDeletePackage(pkg.id);
      
      // Remove from local state
      setTrashedPackages(prev => prev.filter(p => p.id !== pkg.id));
      
      // Remove from cache permanently
      await packageCacheService.removePackageFromCache(pkg.id);
      
      setToast({ message: `Package "${pkg.name}" permanently deleted!`, type: 'success' });
      setShowForceDeleteModal(null);
    } catch (err) {
      console.error('Error permanently deleting package:', err);
      setToast({ message: 'Failed to permanently delete package. Please try again.', type: 'error' });
    } finally {
      setActionLoading(null);
    }
  };

  // Format deleted date
  const formatDeletedDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'Unknown';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="flex flex-col items-center justify-center min-h-96">
          <div className={`animate-spin rounded-full h-12 w-12 border-b-2 border-${fullColor} mb-4`}></div>
          <p className="text-gray-500">Loading deleted packages...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {/* Toast Notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Trash2 className={`w-7 h-7 text-${fullColor}`} />
            Deleted Packages
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage soft-deleted packages. Restore or permanently delete them.
          </p>
        </div>
        <Link to="/packages">
          <StandardButton variant="secondary" size="md" icon={PackageIcon}>
            Back to Packages
          </StandardButton>
        </Link>
      </div>

      {/* Warning Banner */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div>
          <h3 className="text-sm font-semibold text-amber-800">Warning</h3>
          <p className="text-sm text-amber-700">
            Permanently deleted packages cannot be recovered. Make sure you want to delete them before proceeding.
          </p>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search deleted packages..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500`}
              />
            </div>
          </div>

          {/* Location Filter (for company admin) */}
          {isCompanyAdmin && uniqueLocations.length > 0 && (
            <div className="sm:w-48">
              <select
                value={filterLocation}
                onChange={(e) => setFilterLocation(e.target.value)}
                className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500`}
              >
                <option value="all">All Locations</option>
                {uniqueLocations.map(loc => (
                  <option key={loc.id} value={loc.id}>{loc.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Packages Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {filteredPackages.length === 0 ? (
          <div className="p-12 text-center">
            <div className={`w-16 h-16 rounded-full bg-${themeColor}-100 flex items-center justify-center mx-auto mb-4`}>
              <Trash2 className={`w-8 h-8 text-${fullColor}`} />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Deleted Packages</h3>
            <p className="text-gray-500">
              {searchTerm || filterLocation !== "all" 
                ? "No deleted packages match your search criteria."
                : "There are no deleted packages to manage."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Package
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Price
                  </th>
                  {isCompanyAdmin && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Location
                    </th>
                  )}
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Deleted At
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredPackages.map((pkg) => (
                  <tr key={pkg.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 bg-${themeColor}-100 rounded-lg flex items-center justify-center`}>
                          <PackageIcon className={`w-5 h-5 text-${fullColor}`} />
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">{pkg.name}</div>
                          <div className="text-sm text-gray-500 flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            Max {pkg.max_participants} participants
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        <Tag className="w-3 h-3" />
                        {pkg.category || 'Uncategorized'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-medium text-gray-900">
                        ${Number(pkg.price).toFixed(2)}
                      </span>
                    </td>
                    {isCompanyAdmin && (
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-1 text-sm text-gray-600">
                          <MapPin className="w-3 h-3" />
                          {pkg.location?.name || 'Unknown'}
                        </span>
                      </td>
                    )}
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-500">
                        {formatDeletedDate(pkg.deleted_at)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <StandardButton
                          onClick={() => handleRestore(pkg)}
                          variant="secondary"
                          size="sm"
                          icon={RotateCcw}
                          disabled={actionLoading === pkg.id}
                        >
                          {actionLoading === pkg.id ? 'Restoring...' : 'Restore'}
                        </StandardButton>
                        <StandardButton
                          onClick={() => setShowForceDeleteModal(pkg)}
                          variant="danger"
                          size="sm"
                          icon={Trash2}
                          disabled={actionLoading === pkg.id}
                        >
                          Delete Forever
                        </StandardButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Summary */}
      {filteredPackages.length > 0 && (
        <div className="mt-4 text-sm text-gray-500 text-center">
          Showing {filteredPackages.length} deleted package{filteredPackages.length !== 1 ? 's' : ''}
        </div>
      )}

      {/* Force Delete Confirmation Modal */}
      {showForceDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center justify-center w-12 h-12 bg-red-100 rounded-full mx-auto mb-4">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 text-center mb-2">
                Permanently Delete Package?
              </h3>
              <p className="text-sm text-gray-500 text-center mb-4">
                Are you sure you want to permanently delete <strong>"{showForceDeleteModal.name}"</strong>? 
                This action cannot be undone and all associated data will be lost forever.
              </p>
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-6">
                <p className="text-xs text-red-700 text-center">
                  ⚠️ This will permanently remove the package and its images from the system.
                </p>
              </div>
            </div>
            <div className="px-6 py-4 bg-gray-50 rounded-b-lg flex justify-end gap-3">
              <StandardButton
                onClick={() => setShowForceDeleteModal(null)}
                variant="secondary"
                size="md"
                disabled={actionLoading === showForceDeleteModal.id}
              >
                Cancel
              </StandardButton>
              <StandardButton
                onClick={() => handleForceDelete(showForceDeleteModal)}
                variant="danger"
                size="md"
                icon={Trash2}
                disabled={actionLoading === showForceDeleteModal.id}
              >
                {actionLoading === showForceDeleteModal.id ? 'Deleting...' : 'Delete Forever'}
              </StandardButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TrashedPackages;
