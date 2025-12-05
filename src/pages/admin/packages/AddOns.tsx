import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit, Trash2, Utensils, Download, Upload, X, CheckSquare, Square } from 'lucide-react';
import { useThemeColor } from '../../../hooks/useThemeColor';
import { addOnService } from '../../../services';
import Toast from '../../../components/ui/Toast';
import type { AddOnsAddon } from '../../../types/addOns.types';
import { getStoredUser, API_BASE_URL, ASSET_URL } from '../../../utils/storage';

const ManageAddons = () => {
  const { themeColor, fullColor } = useThemeColor();
  const [addons, setAddons] = useState<AddOnsAddon[]>([]);
  const [filteredAddons, setFilteredAddons] = useState<AddOnsAddon[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(8);
  const [showModal, setShowModal] = useState(false);
  const [editingAddon, setEditingAddon] = useState<AddOnsAddon | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedForExport, setSelectedForExport] = useState<string[]>([]);
  const [importData, setImportData] = useState<string>("");
  const [formData, setFormData] = useState({
    name: '',
    price: '',
    image: ''
  });
  const [loading, setLoading] = useState(false);
  
  // Location filtering for company_admin
  const currentUser = getStoredUser();
  const isCompanyAdmin = currentUser?.role === 'company_admin';
  const [locations, setLocations] = useState<Array<{ id: number; name: string }>>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<number | null>(null);
  
  // Toast state
  const [toast, setToast] = useState<{ message: string; type?: "success" | "error" | "info" } | null>(null);
  const showToast = (message: string, type?: "success" | "error" | "info") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Fetch locations for company_admin
  useEffect(() => {
    const fetchLocations = async () => {
      if (isCompanyAdmin) {
        try {
          const response = await fetch(`${API_BASE_URL}/locations`, {
            headers: {
              'Authorization': `Bearer ${currentUser?.token}`,
              'Content-Type': 'application/json'
            }
          });
          const data = await response.json();
          console.log('Locations data:', data);
          if (data.success && data.data) {
            // For company_admin, backend should already filter by company
            // If not, we'll show all locations since we don't have company_id in stored user
            setLocations(data.data);
            // Set first location as default if available
            if (data.data.length > 0 && selectedLocationId === null) {
              setSelectedLocationId(data.data[0].id);
            }
          }
        } catch (error) {
          console.error('Error fetching locations:', error);
        }
      }
    };
    fetchLocations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCompanyAdmin, currentUser]);

  // Load addons from backend
  useEffect(() => {
    loadAddons();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLocationId]);

  // Filter addons based on search
  useEffect(() => {
    if (searchTerm) {
      const filtered = addons.filter(addon =>
        addon.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredAddons(filtered);
    } else {
      setFilteredAddons(addons);
    }
    setCurrentPage(1);
  }, [searchTerm, addons]);

  const loadAddons = async () => {
    try {
      setLoading(true);
      
      const params: any = {
        user_id: getStoredUser()?.id,
      };
      
      // For company_admin, only add location_id if a specific location is selected
      // For location_manager/attendant, backend filters by their location automatically
      if (isCompanyAdmin && selectedLocationId) {
        params.location_id = selectedLocationId;
      }
      
      const response = await addOnService.getAddOns(params);
      console.log('Add-ons response:', response);
      
      if (response.data && response.data.add_ons) {
        const formattedAddons: AddOnsAddon[] = response.data.add_ons.map(addon => {
          // Normalize image to a full URL when possible. If backend returns a full URL, keep it.
          let imageFull = '';
          if (addon.image) {
            const imgStr = String(addon.image);
            if (imgStr.startsWith('http') || imgStr.startsWith(ASSET_URL)) {
              imageFull = imgStr;
            } else {
              imageFull = `${ASSET_URL}${imgStr}`;
            }
          }

          return {
            id: addon.id.toString(),
            name: addon.name,
            price: addon.price || 0,
            image: imageFull,
            location: addon.location && typeof addon.location === 'object' ? addon.location : null,
          };
        });
        setAddons(formattedAddons);
      }
    } catch (error) {
      console.error('Error loading addons:', error);
      showToast('Error loading add-ons', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Convert to base64 and store in formData
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({
          ...prev,
          image: reader.result as string
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.price) {
      showToast('Please fill in all required fields', 'error');
      return;
    }

    try {
      setLoading(true);
      const price = parseFloat(formData.price);

      if (editingAddon) {
        // Update existing add-on
        const updatePayload: any = {
          name: formData.name,
          price: price,
          description: '',
          is_active: true,
        };
        
        // Add image only if it's a new base64 image (not the existing URL)
        if (formData.image && formData.image.startsWith('data:image')) {
          updatePayload.image = formData.image;
        }

        console.log('Updating add-on ID:', editingAddon.id);
        console.log('Update payload:', {
          ...updatePayload,
          image: updatePayload.image ? `[base64 ${updatePayload.image.substring(0, 50)}...]` : 'no change'
        });
        
        const result = await addOnService.updateAddOn(parseInt(editingAddon.id), updatePayload);
        console.log('Update result:', result);
        showToast('Add-on updated successfully!', 'success');
      } else {
        // Create new add-on
        // Determine location_id based on role
        let locationId: number;
        
        if (isCompanyAdmin) {
          // For company_admin, use selected location or require selection
          if (!selectedLocationId) {
            showToast('Please select a location first', 'error');
            setLoading(false);
            return;
          }
          locationId = selectedLocationId;
        } else {
          // For location_manager/attendant, use their assigned location
          locationId = currentUser?.location_id || 1;
        }

        const createPayload: any = {
          location_id: locationId,
          name: formData.name,
          price: price,
          description: '',
          is_active: true,
        };
        
        // Add image if provided
        if (formData.image && formData.image.startsWith('data:image')) {
          createPayload.image = formData.image;
        }
        
        console.log('Creating add-on with payload:', {
          ...createPayload,
          image: createPayload.image ? `[base64 ${createPayload.image.substring(0, 50)}...]` : 'none'
        });
        
        const result = await addOnService.createAddOn(createPayload);
        console.log('Create result:', result);
        showToast('Add-on created successfully!', 'success');
      }

      await loadAddons();
      resetForm();
      setShowModal(false);
    } catch (error: any) {
      console.error('Error saving add-on:', error);
      console.error('Error response data:', error?.response?.data);
      console.error('Error response status:', error?.response?.status);
      console.error('Full error:', JSON.stringify(error?.response, null, 2));
      const errorMessage = error?.response?.data?.message || error?.response?.data?.error || 'Error saving add-on';
      showToast(errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (addon: AddOnsAddon) => {
    setEditingAddon(addon);
    // Remove ASSET_URL prefix if present for proper display in modal
    const imageUrl = addon.image?.startsWith(ASSET_URL) 
      ? addon.image 
      : addon.image;
    setFormData({
      name: addon.name,
      price: addon.price.toString(),
      image: imageUrl
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this add-on?')) {
      try {
        setLoading(true);
        await addOnService.deleteAddOn(parseInt(id));
        showToast('Add-on deleted successfully!', 'success');
        await loadAddons();
      } catch (error) {
        console.error('Error deleting add-on:', error);
        showToast('Error deleting add-on', 'error');
      } finally {
        setLoading(false);
      }
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      price: '',
      image: ''
    });
    setEditingAddon(null);
  };

  const handleModalClose = () => {
    setShowModal(false);
    resetForm();
  };

  // Export functionality
  const handleOpenExportModal = () => {
    setSelectedForExport(addons.map(addon => addon.id || ''));
    setShowExportModal(true);
  };

  const handleToggleExportSelection = (id: string) => {
    setSelectedForExport(prev =>
      prev.includes(id) ? prev.filter(addonId => addonId !== id) : [...prev, id]
    );
  };

  const handleSelectAllForExport = () => {
    if (selectedForExport.length === addons.length) {
      setSelectedForExport([]);
    } else {
      setSelectedForExport(addons.map(addon => addon.id || ''));
    }
  };

  const handleExport = () => {
    const addonsToExport = addons.filter(addon => selectedForExport.includes(addon.id || ''));
    const jsonData = JSON.stringify(addonsToExport, null, 2);
    const blob = new Blob([jsonData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `zapzone-addons-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setShowExportModal(false);
  };

  // Import functionality
  const handleImport = () => {
    try {
      const parsedData = JSON.parse(importData);
      
      if (!Array.isArray(parsedData)) {
        alert('Invalid JSON format. Please provide an array of add-ons.');
        return;
      }

      // Validate the structure
      const isValid = parsedData.every(addon => 
        typeof addon === 'object' && addon.name && addon.price
      );

      if (!isValid) {
        alert('Invalid add-on data structure. Each add-on must have at least name and price.');
        return;
      }

      // Generate new IDs for imported add-ons to avoid conflicts
      const importedAddons = parsedData.map(addon => ({
        ...addon,
        id: addon.id || `addon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        price: typeof addon.price === 'number' ? addon.price : parseFloat(addon.price)
      }));

      // Merge with existing add-ons
      const updatedAddons = [...addons, ...importedAddons];
      setAddons(updatedAddons);
      localStorage.setItem('zapzone_addons', JSON.stringify(updatedAddons));
      
      setShowImportModal(false);
      setImportData('');
      alert(`Successfully imported ${importedAddons.length} add-on(s)!`);
    } catch (error) {
      alert('Error parsing JSON. Please check the format and try again.');
      console.error('Import error:', error);
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

  // Pagination
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentAddons = filteredAddons.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredAddons.length / itemsPerPage);

  const paginate = (pageNumber: number) => setCurrentPage(pageNumber);

  if (loading && addons.length === 0) {
    return (
      <div className="w-full mx-auto px-4 pb-6 flex flex-col items-center">
        <div className="p-6 w-full mt-8">
          <div className="flex flex-col items-center justify-center py-20">
            <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mb-4"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full mx-auto px-4 pb-6 flex flex-col items-center">
      <div className="bg-white rounded-xl p-6 w-full shadow-sm border border-gray-100 mt-8 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900">Manage Add-ons</h2>
            <p className="text-gray-500 mt-1">Food, beverage and other items for your attractions</p>
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
              disabled={addons.length === 0}
            >
              <Download size={18} />
              Export
            </button>
            <button
              onClick={() => setShowModal(true)}
              className={`bg-${fullColor} hover:bg-${themeColor}-900 text-white px-6 py-2 rounded-lg font-semibold whitespace-nowrap inline-flex items-center gap-2`}
            >
              <Plus className="h-5 w-5" />
              Add New Add-on
            </button>
          </div>
        </div>

        {/* Search Bar and Location Filter */}
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search add-ons by name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 outline-none`}
              />
            </div>
            
            {/* Location Filter for Company Admin */}
            {isCompanyAdmin && locations.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-700 whitespace-nowrap">Location:</span>
                <select
                  value={selectedLocationId || ''}
                  onChange={(e) => {
                    setSelectedLocationId(e.target.value ? Number(e.target.value) : null);
                    setCurrentPage(1);
                  }}
                  className={`px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 outline-none min-w-[200px]`}
                >
                  <option value="">All Locations</option>
                  {locations.map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          
          {/* Results count */}
          <div className="text-sm text-gray-500">
            Showing {filteredAddons.length} add-on{filteredAddons.length !== 1 ? 's' : ''}
          </div>
        </div>

        {/* Add-ons Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-6">
          {currentAddons.length === 0 ? (
            <div className="col-span-full text-center py-12 border border-dashed border-gray-300 rounded-xl bg-gray-50">
              <div className={`inline-flex p-4 rounded-full bg-${themeColor}-50 mb-4`}>
                <Utensils className={`h-12 w-12 text-${themeColor}-400`} />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No add-ons found</h3>
              <p className="text-gray-500 mb-4">
                {searchTerm ? `No add-ons match "${searchTerm}"` : 'Get started by creating your first add-on'}
              </p>
              {searchTerm && (
                <button
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-6 py-2 rounded-lg font-semibold mr-2"
                  onClick={() => setSearchTerm("")}
                >
                  Clear Search
                </button>
              )}
              <button
                onClick={() => setShowModal(true)}
                className={`bg-${themeColor}-700 hover:bg-${fullColor} text-white px-6 py-2 rounded-lg font-semibold`}
              >
                Create Add-on
              </button>
            </div>
          ) : (
            currentAddons.map((addon, index) => (
              <div 
                key={addon.id} 
                className="border border-gray-200 rounded-xl overflow-hidden hover:shadow-md transition-all duration-300 animate-fade-in-up"
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                <div className="h-40 bg-gradient-to-br from-gray-50 to-gray-100 relative">
                  {addon.image ? (
                    <img
                      src={addon.image}
                      alt={addon.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-gray-50 via-gray-100 to-gray-50">
                      <div className={`p-4 rounded-full bg-${themeColor}-50 mb-2`}>
                        <Utensils className={`h-8 w-8 text-${themeColor}-400`} />
                      </div>
                      <span className="text-xs text-gray-400 font-medium">No Image</span>
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-gray-900 text-base mb-3">{addon.name}</h3>
                  {/* Location */}
                  {addon.location && (
                    <div className="text-sm text-gray-500 mb-2 flex items-center gap-1">
                      {addon.location.name}
                    </div>
                  )}
                  <div className="flex justify-between items-center">
                    <span className={`text-lg font-semibold text-${fullColor}`}>
                      ${Number(addon.price).toFixed(2)}
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEdit(addon)}
                        className={`p-2 text-gray-600 hover:text-${themeColor}-700 hover:bg-${themeColor}-50 rounded-lg transition-colors`}
                        title="Edit add-on"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(addon.id)}
                        className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete add-on"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-gray-100">
            <div className="text-sm text-gray-700">
              Showing <span className="font-medium">{indexOfFirstItem + 1}</span> to{' '}
              <span className="font-medium">
                {Math.min(indexOfLastItem, filteredAddons.length)}
              </span>{' '}
              of <span className="font-medium">{filteredAddons.length}</span> results
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => paginate(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className={`px-4 py-2 border rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  currentPage === 1
                    ? 'border-gray-200 text-gray-400 bg-gray-50'
                    : `border-${themeColor}-200 text-${fullColor} hover:bg-${themeColor}-50`
                }`}
              >
                Previous
              </button>
              
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                // Show first, last, current, and adjacent pages
                const showPage = page === 1 || 
                                page === totalPages || 
                                (page >= currentPage - 1 && page <= currentPage + 1);
                
                // Show ellipsis
                const showEllipsisBefore = page === currentPage - 2 && currentPage > 3;
                const showEllipsisAfter = page === currentPage + 2 && currentPage < totalPages - 2;
                
                if (!showPage && !showEllipsisBefore && !showEllipsisAfter) return null;
                
                if (showEllipsisBefore || showEllipsisAfter) {
                  return (
                    <span key={page} className="px-3 py-2 text-gray-400">
                      ...
                    </span>
                  );
                }
                
                return (
                  <button
                    key={page}
                    onClick={() => paginate(page)}
                    className={`px-3 py-2 border rounded-lg text-sm font-medium transition-colors ${
                      currentPage === page
                        ? `border-${fullColor} bg-${fullColor} text-white shadow-sm`
                        : `border-gray-200 text-gray-700 hover:border-${themeColor}-300 hover:bg-${themeColor}-50`
                    }`}
                  >
                    {page}
                  </button>
                );
              })}
              
              <button
                onClick={() => paginate(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className={`px-4 py-2 border rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  currentPage === totalPages
                    ? 'border-gray-200 text-gray-400 bg-gray-50'
                    : `border-${themeColor}-200 text-${fullColor} hover:bg-${themeColor}-50`
                }`}
              >
                Next
              </button>
            </div>
          </div>
        )}

        {/* Add/Edit Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-backdrop-fade">
            <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl animate-scale-in">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">
                {editingAddon ? 'Edit Add-on' : 'Add New Add-on'}
              </h2>
              
              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Image Upload */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Add-on Image
                  </label>
                  <div className="flex items-center justify-center w-full">
                    <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-gray-200 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors">
                      {formData.image ? (
                        <div className="relative w-full h-full">
                          <img
                            src={formData.image}
                            alt="Preview"
                            className="w-full h-full object-cover rounded-lg"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center rounded-lg">
                            <span className="text-white text-sm font-medium">Click to change</span>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-6">
                          <div className={`p-3 rounded-full bg-${themeColor}-50 mb-3`}>
                            <Utensils className={`h-8 w-8 text-${themeColor}-400`} />
                          </div>
                          <p className="text-sm text-gray-700 font-medium">Click to upload image</p>
                          <p className="text-xs text-gray-500 mt-1">PNG, JPG up to 5MB</p>
                        </div>
                      )}
                      <input
                        type="file"
                        className="hidden"
                        accept="image/*"
                        onChange={handleImageUpload}
                      />
                    </label>
                  </div>
                </div>

                {/* Name Input */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Add-on Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    className={`w-full border border-gray-200 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 outline-none`}
                    placeholder="e.g., Cheese Pizza, French Fries"
                    required
                  />
                </div>

                {/* Price Input */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Price <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <span className="text-gray-500 font-medium">$</span>
                    </div>
                    <input
                      type="number"
                      name="price"
                      min="0"
                      step="0.01"
                      value={formData.price}
                      onChange={handleInputChange}
                      className={`w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 outline-none`}
                      placeholder="0.00"
                      required
                    />
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleModalClose}
                    className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className={`flex-1 px-4 py-2.5 bg-${fullColor} text-white rounded-lg hover:bg-${themeColor}-900 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {loading ? 'Saving...' : (editingAddon ? 'Update Add-on' : 'Create Add-on')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Export Modal */}
        {showExportModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-backdrop-fade">
            <div className="bg-white rounded-xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col animate-scale-in">
              <div className="p-6 border-b border-gray-200">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">Export Add-ons</h3>
                    <p className="text-sm text-gray-500 mt-1">Select add-ons to export as JSON</p>
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
                    {selectedForExport.length === addons.length ? (
                      <CheckSquare size={18} />
                    ) : (
                      <Square size={18} />
                    )}
                    {selectedForExport.length === addons.length ? 'Deselect All' : 'Select All'}
                  </button>
                  <span className="text-sm text-gray-600">
                    {selectedForExport.length} of {addons.length} selected
                  </span>
                </div>

                <div className="space-y-2">
                  {addons.map((addon) => (
                    <div
                      key={addon.id}
                      className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                        selectedForExport.includes(addon.id || '')
                          ? `border-${themeColor}-500 bg-${themeColor}-50`
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => handleToggleExportSelection(addon.id || '')}
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-1">
                          {selectedForExport.includes(addon.id || '') ? (
                            <CheckSquare size={18} className={`text-${fullColor}`} />
                          ) : (
                            <Square size={18} className="text-gray-400" />
                          )}
                        </div>
                        <div className="flex-1 flex items-center gap-3">
                          {addon.image ? (
                            <img
                              src={addon.image}
                              alt={addon.name}
                              className="w-12 h-12 object-cover rounded-lg"
                            />
                          ) : (
                            <div className={`w-12 h-12 bg-gradient-to-br from-${themeColor}-50 to-${themeColor}-100 rounded-lg flex items-center justify-center`}>
                              <Utensils className={`h-5 w-5 text-${themeColor}-400`} />
                            </div>
                          )}
                          <div className="flex-1">
                            <h4 className="font-semibold text-gray-900">{addon.name}</h4>
                            <p className="text-sm text-gray-600">${Number(addon.price).toFixed(2)}</p>
                          </div>
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
                  Export {selectedForExport.length} Add-on{selectedForExport.length !== 1 ? 's' : ''}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Import Modal */}
        {showImportModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-backdrop-fade">
            <div className="bg-white rounded-xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col animate-scale-in">
              <div className="p-6 border-b border-gray-200">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">Import Add-ons</h3>
                    <p className="text-sm text-gray-500 mt-1">Upload or paste JSON data to import add-ons</p>
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
                    placeholder='[{"name": "Pizza Slice", "price": 3.99, "image": "..."}, {"name": "Burger", "price": 5.99}]'
                    rows={12}
                    className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 font-mono text-sm`}
                  />
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-blue-900 mb-2">Import Notes:</h4>
                  <ul className="text-xs text-blue-800 space-y-1">
                    <li>• JSON must be an array of add-on objects</li>
                    <li>• Each add-on must have at least a name and price</li>
                    <li>• Imported add-ons will be added to existing add-ons</li>
                    <li>• New IDs will be generated to avoid conflicts</li>
                    <li>• Images should be base64 encoded or URLs</li>
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
                  Import Add-ons
                </button>
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
    </div>
  );
};

export default ManageAddons;