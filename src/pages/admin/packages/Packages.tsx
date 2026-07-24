import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Users, Tag, Search, Download, Upload, X, CheckSquare, Square, Pencil, Trash2, MapPin, Eye, Power, Plus, FileText, Clock, Copy, DollarSign, Percent, GripVertical, CalendarDays } from "lucide-react";
import StandardButton from '../../../components/ui/StandardButton';
import ActionMenu from '../../../components/ui/ActionMenu';
import { useThemeColor } from '../../../hooks/useThemeColor';
import { packageService, locationService, type Package, type CreatePackageData } from '../../../services';
import { packageCacheService } from '../../../services/PackageCacheService';
import { getStoredUser } from "../../../utils/storage";
import { useLocationScope } from '../../../contexts/LocationContext';
import { createSlugWithId } from '../../../utils/slug';

interface UserData {
  name: string;
  company: string;
  subcompany?: string;
  position: string;
  role: 'attendant' | 'location_manager' | 'company_admin';
}

const Packages: React.FC = () => {
  const navigate = useNavigate();
  const { themeColor, fullColor } = useThemeColor();
  const { effectiveLocationId } = useLocationScope();
  const [packages, setPackages] = useState<Package[]>([]);
  const [filteredPackages, setFilteredPackages] = useState<Package[]>([]);
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [sortBy, setSortBy] = useState<string>("name");
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [showExportModal, setShowExportModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedForExport, setSelectedForExport] = useState<number[]>([]);
  const [importData, setImportData] = useState<string>("");
  const [importLocationId, setImportLocationId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  
  const [selectedForBulkUpdate, setSelectedForBulkUpdate] = useState<number[]>([]);
  const [showBulkMinNoticeModal, setShowBulkMinNoticeModal] = useState(false);
  const [bulkMinNoticeHours, setBulkMinNoticeHours] = useState<string>("");
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [duplicatingId, setDuplicatingId] = useState<number | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [showDuplicateLocationModal, setShowDuplicateLocationModal] = useState(false);
  const [packageToDuplicate, setPackageToDuplicate] = useState<Package | null>(null);
  const [duplicateTargetLocationId, setDuplicateTargetLocationId] = useState<number | null>(null);
  const [allLocations, setAllLocations] = useState<Array<{ id: number; name: string }>>([]);

  useEffect(() => {
    const stored = localStorage.getItem('zapzone_user');
    if (stored) {
      setUserData(JSON.parse(stored));
    }
  }, []);

  useEffect(() => {
    const currentUser = getStoredUser();
    if (currentUser?.role === 'company_admin') {
      locationService.getLocations().then(res => {
        if (res.success && Array.isArray(res.data)) {
          setAllLocations(res.data.map(l => ({ id: l.id, name: l.name })));
        }
      }).catch(() => {});
    } else if (currentUser?.location_id) {
      setAllLocations([{ id: currentUser.location_id, name: currentUser.location_name || 'My Location' }]);
    }
  }, []);

  useEffect(() => {
    const fetchPackages = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const hasCachedData = await packageCacheService.hasCachedData();
        
        if (hasCachedData) {
          console.log('[Packages] Loading from cache...');
          const cachedPackages = await packageCacheService.getCachedPackages();
          
          if (cachedPackages && cachedPackages.length > 0) {
            const regularPackages = cachedPackages.filter(
              (pkg: Package) => (!pkg.package_type || pkg.package_type === 'regular') && !pkg.deleted_at
            );
            console.log('[Packages] Loaded from cache:', regularPackages.length, 'packages');
            setPackages(regularPackages);
            setLoading(false);

            packageCacheService.syncInBackground({ user_id: getStoredUser()?.id });
            return;
          }
        }
        
        console.log('[Packages] Fetching from API...');
        const response = await packageService.getPackages({ 
          per_page: 50, // Backend max is 50 for better performance
          sort_by: 'id',
          sort_order: 'desc',
          user_id: getStoredUser()?.id
        });
        
        const packagesData = response.data.packages || [];
        
        const regularPackages = packagesData.filter(
          (pkg: Package) => (!pkg.package_type || pkg.package_type === 'regular') && !pkg.deleted_at
        );
        
        setPackages(regularPackages);
        
        await packageCacheService.cachePackages(packagesData);
        console.log('[Packages] Cached', packagesData.length, 'packages');
      } catch (err: unknown) {
        console.error('Error fetching packages:', err);
        
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
        
        try {
          const cachedPackages = await packageCacheService.getCachedPackages();
          if (cachedPackages && cachedPackages.length > 0) {
            const regularPackages = cachedPackages.filter(
              (pkg: Package) => (!pkg.package_type || pkg.package_type === 'regular') && !pkg.deleted_at
            );
            setPackages(regularPackages);
            console.log('Loaded packages from cache fallback');
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

  useEffect(() => {
    const unsubscribe = packageCacheService.onCacheUpdate((event: CustomEvent) => {
      if (event.detail?.source === 'api') {
        const refreshFromCache = async () => {
          const cachedPackages = await packageCacheService.getCachedPackages();
          if (cachedPackages && cachedPackages.length > 0) {
            const regularPackages = cachedPackages.filter(
              (pkg: Package) => (!pkg.package_type || pkg.package_type === 'regular') && !pkg.deleted_at
            );
            setPackages(regularPackages);
          }
        };
        refreshFromCache();
      }
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    let result = [...packages];

    if (effectiveLocationId) {
      result = result.filter(pkg => pkg.location_id === effectiveLocationId);
    }

    if (filterCategory !== "all") {
      result = result.filter(pkg => pkg.category === filterCategory);
    }

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
      } else if (sortBy === 'display_order') {
        aValue = a.display_order ?? 0;
        bValue = b.display_order ?? 0;
      }

      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    setFilteredPackages(result);
  }, [packages, filterCategory, effectiveLocationId, searchTerm, sortBy, sortOrder]);

  const categories = ["all", ...new Set(packages.map(pkg => pkg.category).filter(Boolean))];

  const isCompanyAdmin = userData?.role === 'company_admin';

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    setFilteredPackages(prev => {
      const updated = [...prev];
      const draggedItem = updated[draggedIndex];
      updated.splice(draggedIndex, 1);
      updated.splice(index, 0, draggedItem);
      setDraggedIndex(index);
      return updated;
    });
  };

  const handleDragEnd = async () => {
    setDraggedIndex(null);
    const reorderItems = filteredPackages.map((pkg, idx) => ({
      id: pkg.id,
      display_order: idx,
    }));
    try {
      await packageService.reorderPackages(reorderItems);
      setPackages(prev =>
        prev.map(pkg => {
          const reordered = reorderItems.find(r => r.id === pkg.id);
          return reordered ? { ...pkg, display_order: reordered.display_order } : pkg;
        })
      );
      alert('Display order updated successfully!');
    } catch {
      alert('Failed to update display order. Please try again.');
    }
  };

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
    
    const cleanedPackages = packagesToExport.map(pkg => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id: _id, created_at: _created, updated_at: _updated, location_id: _lid, location: _loc, ...cleanPkg } = pkg;
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

  const handleImport = async () => {
    try {
      const parsedData = JSON.parse(importData);
      
      if (!Array.isArray(parsedData)) {
        alert('Invalid JSON format. Please provide an array of packages.');
        return;
      }

      const isValid = parsedData.every(pkg => 
        typeof pkg === 'object' && pkg.name && pkg.price
      );

      if (!isValid) {
        alert('Invalid package data structure. Each package must have at least name and price.');
        return;
      }

      const currentUser = getStoredUser();
      const targetLocationId = importLocationId || currentUser?.location_id || 1;

      const packagesForImport = parsedData.map(pkg => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { id: _id, created_at: _created, updated_at: _updated, location_id: _lid, location: _loc, ...cleanPkg } = pkg;
        return {
          location_id: targetLocationId,
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
          attraction_ids: cleanPkg.attraction_ids || [],
          addon_ids: cleanPkg.addon_ids || [],
          room_ids: cleanPkg.room_ids || [],
        };
      });

      const response = await packageService.bulkImport(packagesForImport);
      
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
        setPackages(prev => prev.filter(pkg => pkg.id !== id));
        await packageCacheService.removePackageFromCache(id);
        alert('Package deleted successfully!');
      } catch (err) {
        console.error('Error deleting package:', err);
        alert('Failed to delete package. Please try again.');
      }
    }
  };

  const handleToggleStatus = async (id: number) => {
    try {
      const response = await packageService.toggleStatus(id);
      
      setPackages(prev => prev.map(pkg => 
        pkg.id === id ? { ...pkg, is_active: response.data.is_active } : pkg
      ));
      
      await packageCacheService.updatePackageInCache(response.data);
      
      const statusText = response.data.is_active ? 'activated' : 'deactivated';
      alert(`Package ${statusText} successfully!`);
    } catch (err) {
      console.error('Error toggling package status:', err);
      alert('Failed to update package status. Please try again.');
    }
  };

  const handleDuplicatePackage = (pkg: Package) => {
    setPackageToDuplicate(pkg);
    setDuplicateTargetLocationId(pkg.location_id);
    setShowDuplicateLocationModal(true);
  };

  const handleConfirmDuplicate = async () => {
    if (!packageToDuplicate || !duplicateTargetLocationId) return;
    try {
      setDuplicatingId(packageToDuplicate.id);
      setShowDuplicateLocationModal(false);

      const response = await packageService.getPackage(packageToDuplicate.id);
      const original = response.data;

      const duplicateData: CreatePackageData = {
        location_id: duplicateTargetLocationId,
        name: `${original.name} (Copy)`,
        description: original.description,
        category: original.category,
        package_type: original.package_type || 'regular',
        features: original.features,
        price: original.price,
        price_per_additional: original.price_per_additional,
        max_participants: original.max_participants,
        duration: original.duration,
        duration_unit: original.duration_unit,
        price_per_additional_30min: original.price_per_additional_30min,
        price_per_additional_1hr: original.price_per_additional_1hr,
        availability_type: original.availability_type,
        available_days: original.available_days,
        available_week_days: original.available_week_days,
        available_month_days: original.available_month_days,
        availability_schedules: original.availability_schedules,
        image: original.image,
        is_active: false,
        partial_payment_percentage: original.partial_payment_percentage,
        partial_payment_fixed: original.partial_payment_fixed,
        has_guest_of_honor: original.has_guest_of_honor,
        customer_notes: original.customer_notes,
        invitation_download_link: original.invitation_download_link,
        booking_window_days: original.booking_window_days,
        min_booking_notice_hours: original.min_booking_notice_hours,
        attraction_ids: original.attractions?.map(a => a.id),
        room_ids: original.rooms?.map(r => r.id),
        addon_ids: original.add_ons?.map(a => a.id),
      };

      const createResponse = await packageService.createPackage(duplicateData);

      if (createResponse.success && createResponse.data) {
        await packageCacheService.addPackageToCache(createResponse.data);
        setPackages(prev => [createResponse.data, ...prev]);
        const targetName = allLocations.find(l => l.id === duplicateTargetLocationId)?.name || '';
        alert(`"${original.name}" duplicated successfully${targetName ? ` to ${targetName}` : ''}!`);
      }
    } catch (error) {
      console.error('Error duplicating package:', error);
      alert('Failed to duplicate package. Please try again.');
    } finally {
      setDuplicatingId(null);
      setPackageToDuplicate(null);
      setDuplicateTargetLocationId(null);
    }
  };

  const handleSelectForBulkUpdate = (id: number) => {
    setSelectedForBulkUpdate(prev =>
      prev.includes(id) ? prev.filter(pkgId => pkgId !== id) : [...prev, id]
    );
  };

  const handleSelectAllForBulkUpdate = () => {
    if (selectedForBulkUpdate.length === filteredPackages.length) {
      setSelectedForBulkUpdate([]);
    } else {
      setSelectedForBulkUpdate(filteredPackages.map(pkg => pkg.id));
    }
  };

  const handleBulkUpdateMinNotice = async () => {
    if (selectedForBulkUpdate.length === 0) return;
    
    try {
      setBulkUpdating(true);
      const minHours = bulkMinNoticeHours ? parseInt(bulkMinNoticeHours) : null;
      
      const response = await packageService.bulkUpdateMinNotice(selectedForBulkUpdate, minHours);
      
      if (response.success) {
        const responseData = response.data as unknown as { packages?: Package[] } | Package[];
        const updatedPackages: Package[] = Array.isArray(responseData) 
          ? responseData 
          : (responseData?.packages || []);
        
        if (Array.isArray(updatedPackages) && updatedPackages.length > 0) {
          setPackages(prev => prev.map(pkg => {
            const updated = updatedPackages.find((up: Package) => up.id === pkg.id);
            return updated || pkg;
          }));
          
          for (const updatedPkg of updatedPackages) {
            await packageCacheService.updatePackageInCache(updatedPkg);
          }
        } else {
          setPackages(prev => prev.map(pkg => {
            if (selectedForBulkUpdate.includes(pkg.id)) {
              return { ...pkg, min_booking_notice_hours: minHours };
            }
            return pkg;
          }));
        }
        
        alert(`Advance booking time updated successfully for ${selectedForBulkUpdate.length} package(s)!`);
        setShowBulkMinNoticeModal(false);
        setSelectedForBulkUpdate([]);
        setBulkMinNoticeHours("");
      }
    } catch (err) {
      console.error('Error bulk updating packages:', err);
      alert('Failed to update packages. Please try again.');
    } finally {
      setBulkUpdating(false);
    }
  };

  const formatMinNotice = (hours: number | null | undefined): string => {
    if (!hours || hours === 0) return 'No buffer';
    if (hours >= 24) {
      const days = hours / 24;
      return `${days % 1 === 0 ? days : days.toFixed(1)}d buffer`;
    }
    return `${hours}h buffer`;
  };

  const formatCreatedAt = (dateStr: string): string => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
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
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Packages</h1>
          <p className="text-gray-600 mt-1">Manage and view all your packages</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {selectedForBulkUpdate.length > 0 && (
            <StandardButton
              variant="primary"
              size="md"
              icon={Clock}
              onClick={() => setShowBulkMinNoticeModal(true)}
            >
              Set Advance Time ({selectedForBulkUpdate.length})
            </StandardButton>
          )}
          <ActionMenu
            items={[
              { label: 'Fee Supports', icon: DollarSign, onClick: () => navigate('/fee-supports?entity_type=package') },
              { label: 'Special Pricing', icon: Percent, onClick: () => navigate('/special-pricings?entity_type=package') },
              { label: 'Global Notes', icon: FileText, onClick: () => navigate('/packages/global-notes') },
              { label: 'Import Packages', icon: Upload, onClick: () => setShowImportModal(true), dividerBefore: true },
              { label: 'Export Packages', icon: Download, onClick: handleOpenExportModal, disabled: packages.length === 0 },
              { label: 'Deleted Packages', icon: Trash2, onClick: () => navigate('/packages/trashed'), dividerBefore: true, danger: true },
            ]}
          />
          <Link to="/packages/create">
            <StandardButton
              variant="primary"
              size="md"
              icon={Plus}
            >
              Create Package
            </StandardButton>
          </Link>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        {(packages == null || packages.length === 0) ? (
          <div className="flex flex-col items-center py-16">
            <div className={`w-16 h-16 rounded-full bg-${themeColor}-100 flex items-center justify-center mb-4`}>
              <Tag className={`w-8 h-8 text-${fullColor}`} />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No packages found</h3>
            <p className="text-gray-600 text-sm mb-6 text-center max-w-sm">Create your first package to get started</p>
            <Link to="/packages/create">
              <StandardButton
                variant="primary"
                size="md"
                icon={Plus}
              >
                Create Package
              </StandardButton>
            </Link>
          </div>
        ) : (
          <>
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <div className="relative flex-1 max-w-lg">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-gray-600" />
              </div>
              <input
                type="text"
                placeholder="Search packages..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`pl-9 pr-3 py-1.5 border border-gray-200 rounded-lg w-full text-sm focus:ring-2 focus:ring-${themeColor}-600 focus:border-${themeColor}-600`}
              />
            </div>
            
            <div className="flex flex-wrap gap-1 items-center">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className={`px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-${themeColor}-600 focus:border-${themeColor}-600`}
              >
                <option value="name">Sort: Name</option>
                <option value="price">Sort: Price</option>
                <option value="category">Sort: Category</option>
                <option value="display_order">Sort: Display Order</option>
              </select>
              <StandardButton
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                variant="secondary"
                size="sm"
              >
                {sortOrder === 'asc' ? '↑' : '↓'}
              </StandardButton>
            </div>
          </div>

          {categories.length > 1 && (
            <div className="flex items-center gap-2 flex-wrap mt-3">
              {categories.map((category) => (
                <StandardButton 
                  key={category}
                  variant={filterCategory === category ? "primary" : "secondary"}
                  size="sm"
                  onClick={() => setFilterCategory(category)}
                  className="rounded-full"
                >
                  {category === "all" ? "All Categories" : category}
                </StandardButton>
              ))}
            </div>
          )}

          <div className="text-sm text-gray-500 mt-3">
            Showing {filteredPackages.length} of {packages.length} package{packages.length !== 1 ? 's' : ''}
          </div>
        </div>

        {filteredPackages.length > 0 ? (
          <>
            <div className="flex items-center gap-2 mb-4">
              <button
                onClick={handleSelectAllForBulkUpdate}
                className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-800"
              >
                {selectedForBulkUpdate.length === filteredPackages.length ? (
                  <CheckSquare className={`w-5 h-5 text-${fullColor}`} />
                ) : (
                  <Square className="w-5 h-5" />
                )}
                <span>Select all for bulk update</span>
              </button>
              {selectedForBulkUpdate.length > 0 && (
                <span className="text-sm text-gray-500">
                  ({selectedForBulkUpdate.length} selected)
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredPackages.map((pkg, index) => (
              <div 
                key={pkg.id} 
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragEnd={handleDragEnd}
                className={`border-2 rounded-lg overflow-hidden hover:shadow-lg hover:scale-105 transition-all bg-white ${
                  selectedForBulkUpdate.includes(pkg.id) 
                    ? `border-${fullColor} ring-2 ring-${themeColor}-100` 
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div className="cursor-grab mr-1 flex-shrink-0 mt-0.5">
                      <GripVertical className="w-4 h-4 text-gray-400" />
                    </div>
                    <button
                      onClick={() => handleSelectForBulkUpdate(pkg.id)}
                      className="mr-2 flex-shrink-0"
                    >
                      {selectedForBulkUpdate.includes(pkg.id) ? (
                        <CheckSquare className={`w-5 h-5 text-${fullColor}`} />
                      ) : (
                        <Square className="w-5 h-5 text-gray-300 hover:text-gray-400" />
                      )}
                    </button>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-base text-gray-900 truncate mb-1">{pkg.name || "Unnamed Package"}</h3>
                      {pkg.name?.includes('(Copy)') && (
                        <div className="flex items-center gap-1 mb-1">
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-700 border border-amber-300">
                            <Copy className="w-2.5 h-2.5" />
                            Copy
                          </span>
                        </div>
                      )}
                      {pkg.location && (
                        <div className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-gray-400" />
                          <span className="text-xs text-gray-500">{pkg.location.name}</span>
                        </div>
                      )}
                      {pkg.created_at && (
                        <div className="flex items-center gap-1 mt-0.5">
                          <CalendarDays className="w-3 h-3 text-gray-400" />
                          <span className="text-xs text-gray-400">{formatCreatedAt(pkg.created_at)}</span>
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
                    <div className="flex flex-wrap gap-1">
                      <span className={`inline-block px-2 py-1 rounded text-xs font-medium bg-${themeColor}-100 text-${fullColor}`}>
                        {pkg.category || "Uncategorized"}
                      </span>
                      {pkg.min_booking_notice_hours && pkg.min_booking_notice_hours > 0 && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-700">
                          <Clock className="w-3 h-3" />
                          {formatMinNotice(pkg.min_booking_notice_hours)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-gray-100">
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-lg font-bold text-gray-900">${pkg.price || "0"}</span>
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
                      <button
                        onClick={() => handleDuplicatePackage(pkg)}
                        className={`flex-1 p-1.5 text-${fullColor} hover:bg-${themeColor}-100 rounded transition-colors flex items-center justify-center disabled:opacity-50`}
                        title="Duplicate package"
                        disabled={duplicatingId === pkg.id}
                      >
                        {duplicatingId === pkg.id ? (
                          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
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
            ))}
          </div>
          </>
        ) : (
          <div className="flex flex-col items-center py-16">
            <div className={`w-16 h-16 rounded-full bg-${themeColor}-100 flex items-center justify-center mb-4`}>
              <Tag className={`w-8 h-8 text-${fullColor}`} />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No packages found</h3>
            <p className="text-gray-600 text-sm mb-6 text-center max-w-sm">
              {searchTerm
                ? `No packages match "${searchTerm}"`
                : filterCategory !== "all"
                  ? `No packages in the "${filterCategory}" category`
                  : "Create your first package to get started"
              }
            </p>
            {(searchTerm || filterCategory !== "all") && (
              <StandardButton
                variant="secondary"
                size="md"
                className="mr-2"
                onClick={() => {
                  setSearchTerm("");
                  setFilterCategory("all");
                }}
              >
                Clear Filters
              </StandardButton>
            )}
            <Link to="/packages/create">
              <StandardButton
                variant="primary"
                size="md"
                icon={Plus}
              >
                Create Package
              </StandardButton>
            </Link>
          </div>
        )}
      </>
    )}
  </div>

      {showExportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Export Packages</h3>
                  <p className="text-sm text-gray-500 mt-1">Select packages to export as JSON</p>
                </div>
                <StandardButton
                  onClick={() => setShowExportModal(false)}
                  variant="ghost"
                  size="sm"
                  icon={X}
                >
                  {""}
                </StandardButton>
              </div>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-200">
                <StandardButton
                  onClick={handleSelectAllForExport}
                  variant="ghost"
                  size="sm"
                  icon={selectedForExport.length === packages.length ? CheckSquare : Square}
                >
                  {selectedForExport.length === packages.length ? 'Deselect All' : 'Select All'}
                </StandardButton>
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
                Export {selectedForExport.length} Package{selectedForExport.length !== 1 ? 's' : ''}
              </StandardButton>
            </div>
          </div>
        </div>
      )}

      {showImportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Import Packages</h3>
                  <p className="text-sm text-gray-500 mt-1">Upload or paste JSON data to import packages</p>
                </div>
                <StandardButton
                  onClick={() => {
                    setShowImportModal(false);
                    setImportData('');
                    setImportLocationId(null);
                  }}
                  variant="ghost"
                  size="sm"
                  icon={X}
                >
                  {""}
                </StandardButton>
              </div>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              {isCompanyAdmin && allLocations.length > 1 && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Import to Location
                  </label>
                  <select
                    value={importLocationId ?? ''}
                    onChange={(e) => setImportLocationId(e.target.value ? Number(e.target.value) : null)}
                    className={`w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500`}
                  >
                    <option value="">Select a location...</option>
                    {allLocations.map(loc => (
                      <option key={loc.id} value={loc.id}>{loc.name}</option>
                    ))}
                  </select>
                </div>
              )}
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
                  placeholder='[{"name": "Package Name", "price": "100", "category": "Type", ...}]'
                  rows={12}
                  className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 font-mono text-sm`}
                />
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-blue-900 mb-2">Import Notes:</h4>
                <ul className="text-xs text-blue-800 space-y-1">
                  <li>• JSON must be an array of package objects</li>
                  <li>• Each package must have at least a name and price</li>
                  <li>• Package IDs and location data will be ignored; packages will be registered to the selected location</li>
                  <li>• You can include relationship IDs (attraction_ids, addon_ids, room_ids)</li>
                </ul>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <StandardButton
                onClick={() => {
                  setShowImportModal(false);
                  setImportData('');
                  setImportLocationId(null);
                }}
                variant="secondary"
                size="md"
              >
                Cancel
              </StandardButton>
              <StandardButton
                onClick={handleImport}
                disabled={!importData.trim() || (isCompanyAdmin && allLocations.length > 1 && !importLocationId)}
                variant="primary"
                size="md"
                icon={Upload}
              >
                Import Packages
              </StandardButton>
            </div>
          </div>
        </div>
      )}

      {showBulkMinNoticeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Set Advance Booking Time</h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Prevent last-minute bookings for {selectedForBulkUpdate.length} package{selectedForBulkUpdate.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowBulkMinNoticeModal(false);
                    setBulkMinNoticeHours("");
                  }}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Block bookings within this many hours of the time slot
                </label>
                
                <div className="flex flex-wrap gap-2 mb-3">
                  {[
                    { hours: 2, label: '2 hours' },
                    { hours: 6, label: '6 hours' },
                    { hours: 24, label: '1 day' },
                    { hours: 48, label: '2 days' },
                    { hours: 168, label: '1 week' },
                  ].map(({ hours, label }) => (
                    <button
                      key={hours}
                      type="button"
                      onClick={() => setBulkMinNoticeHours(String(hours))}
                      className={`px-3 py-1.5 text-sm rounded-lg border transition-all ${
                        bulkMinNoticeHours === String(hours)
                          ? `bg-${themeColor}-100 border-${fullColor} text-${fullColor} font-medium`
                          : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    max="8760"
                    value={bulkMinNoticeHours}
                    onChange={(e) => setBulkMinNoticeHours(e.target.value)}
                    placeholder="Custom hours"
                    className={`flex-1 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-${themeColor}-500 focus:border-${fullColor} border-gray-200`}
                  />
                  <span className="text-sm text-gray-500">hours</span>
                </div>
                
                <button
                  type="button"
                  onClick={() => setBulkMinNoticeHours("")}
                  className={`mt-2 px-3 py-1.5 text-sm rounded-lg border transition-all ${
                    bulkMinNoticeHours === ""
                      ? `bg-${themeColor}-100 border-${fullColor} text-${fullColor} font-medium`
                      : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  Allow last-minute bookings (no buffer)
                </button>
                
                {bulkMinNoticeHours && parseInt(bulkMinNoticeHours) > 0 && (
                  <p className={`text-xs text-${themeColor}-600 mt-2`}>
                    Last-minute bookings blocked: Customers cannot book within {bulkMinNoticeHours} hours ({(parseInt(bulkMinNoticeHours) / 24).toFixed(1)} days) of the time slot
                  </p>
                )}
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <StandardButton
                onClick={() => {
                  setShowBulkMinNoticeModal(false);
                  setBulkMinNoticeHours("");
                }}
                variant="secondary"
                size="md"
              >
                Cancel
              </StandardButton>
              <StandardButton
                onClick={handleBulkUpdateMinNotice}
                disabled={bulkUpdating}
                variant="primary"
                size="md"
                icon={Clock}
              >
                {bulkUpdating ? 'Updating...' : `Update ${selectedForBulkUpdate.length} Package${selectedForBulkUpdate.length !== 1 ? 's' : ''}`}
              </StandardButton>
            </div>
          </div>
        </div>
      )}

      {showDuplicateLocationModal && packageToDuplicate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Duplicate Package</h3>
                  <p className="text-sm text-gray-500 mt-1">Select the location for the duplicate</p>
                </div>
                <button
                  onClick={() => {
                    setShowDuplicateLocationModal(false);
                    setPackageToDuplicate(null);
                    setDuplicateTargetLocationId(null);
                  }}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
            </div>
            <div className="p-6">
              <p className="text-sm text-gray-700 mb-4">
                Duplicating: <span className="font-semibold">{packageToDuplicate.name}</span>
              </p>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Destination Location
              </label>
              {allLocations.length > 1 ? (
                <select
                  value={duplicateTargetLocationId ?? ''}
                  onChange={(e) => setDuplicateTargetLocationId(Number(e.target.value))}
                  className={`w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500`}
                >
                  {allLocations.map(loc => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name}{loc.id === packageToDuplicate.location_id ? ' (current)' : ''}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-sm text-gray-600 px-3 py-2 bg-gray-50 rounded-lg border border-gray-200">
                  {allLocations[0]?.name || 'Current location'}
                </p>
              )}
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <StandardButton
                onClick={() => {
                  setShowDuplicateLocationModal(false);
                  setPackageToDuplicate(null);
                  setDuplicateTargetLocationId(null);
                }}
                variant="secondary"
                size="md"
              >
                Cancel
              </StandardButton>
              <StandardButton
                onClick={handleConfirmDuplicate}
                disabled={!duplicateTargetLocationId}
                variant="primary"
                size="md"
                icon={Copy}
              >
                Duplicate
              </StandardButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Packages;
