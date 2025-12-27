import React, { useState, useEffect } from 'react';
import { Search, Edit2, Trash2, Calendar, MapPin, CheckSquare, Square, Plus, X, CalendarOff, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import StandardButton from '../../../components/ui/StandardButton';
import Toast from '../../../components/ui/Toast';
import { dayOffService, locationService } from '../../../services';
import LocationSelector from '../../../components/admin/LocationSelector';
import type { DayOff, DayOffFilters } from '../../../services/DayOffService';
import type { Location } from '../../../services/LocationService';
import { useThemeColor } from '../../../hooks/useThemeColor';
import { getStoredUser } from '../../../utils/storage';

const DayOffs: React.FC = () => {
    const { themeColor, fullColor } = useThemeColor();
    
    // State management
    const [dayOffs, setDayOffs] = useState<DayOff[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filters, setFilters] = useState<DayOffFilters>({
        is_recurring: undefined,
        upcoming_only: true,
        sort_by: 'date',
        sort_order: 'asc',
        per_page: 20,
        page: 1
    });
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [selectedDayOff, setSelectedDayOff] = useState<DayOff | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    
    // Bulk selection state
    const [selectionMode, setSelectionMode] = useState(false);
    const [selectedDayOffIds, setSelectedDayOffIds] = useState<Set<number>>(new Set());
    
    // Location filtering for company_admin
    const currentUser = getStoredUser();
    const isCompanyAdmin = currentUser?.role === 'company_admin';
    const [locations, setLocations] = useState<Location[]>([]);
    const [selectedLocationId, setSelectedLocationId] = useState<number | null>(null);
    const [modalLocationId, setModalLocationId] = useState<number | null>(null);

    // Form state for create/edit
    const [formData, setFormData] = useState({
        date: '',
        reason: '',
        is_recurring: false
    });

    // Multi-select calendar state
    const [showBulkModal, setShowBulkModal] = useState(false);
    const [bulkYear, setBulkYear] = useState(new Date().getFullYear());
    const [bulkSelectedDates, setBulkSelectedDates] = useState<Set<string>>(new Set());
    const [bulkReason, setBulkReason] = useState('');
    const [bulkIsRecurring, setBulkIsRecurring] = useState(false);
    const [bulkCreating, setBulkCreating] = useState(false);

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
                    const response = await locationService.getLocations();
                    if (response.success && response.data) {
                        const locationsArray = Array.isArray(response.data) ? response.data : [];
                        setLocations(locationsArray);
                        // Set first location as default if available
                        if (locationsArray.length > 0 && selectedLocationId === null) {
                            setSelectedLocationId(locationsArray[0].id);
                        }
                    }
                } catch (error) {
                    console.error('Error fetching locations:', error);
                }
            }
        };
        fetchLocations();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Fetch day offs
    const fetchDayOffs = React.useCallback(async () => {
        try {
            setLoading(true);
            const searchFilters: DayOffFilters = {
                ...filters,
                page: currentPage,
                user_id: getStoredUser()?.id,
                location_id: isCompanyAdmin && selectedLocationId ? selectedLocationId : undefined
            };
            
            const response = await dayOffService.getDayOffs(searchFilters);
            
            if (response.data) {
                let filteredDayOffs = response.data.day_offs || [];
                
                // Client-side search filtering by reason
                if (searchTerm) {
                    filteredDayOffs = filteredDayOffs.filter(dayOff => 
                        dayOff.reason?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        dayOff.date.includes(searchTerm)
                    );
                }
                
                setDayOffs(filteredDayOffs);
                const pagination = response.data.pagination;
                setTotalPages(pagination?.last_page || 1);
            }
        } catch (error) {
            console.error('Error fetching Day Offs:', error);
            showToast('Error loading Day Offs', 'error');
        } finally {
            setLoading(false);
        }
    }, [filters, searchTerm, currentPage, isCompanyAdmin, selectedLocationId]);

    useEffect(() => {
        fetchDayOffs();
    }, [fetchDayOffs]);

    // Handle form input changes
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;
        if (type === 'checkbox') {
            const checked = (e.target as HTMLInputElement).checked;
            setFormData(prev => ({ ...prev, [name]: checked }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    // Reset form
    const resetForm = () => {
        setFormData({
            date: '',
            reason: '',
            is_recurring: false
        });
        setSelectedDayOff(null);
    };

    // Handle create day off
    const handleCreateDayOff = async (e: React.FormEvent) => {
        e.preventDefault();
        
        try {
            // Use modal location for company_admin, default to user's location_id otherwise
            const locationId = isCompanyAdmin && modalLocationId 
                ? modalLocationId 
                : (currentUser?.location_id || 1);
            
            await dayOffService.createDayOff({
                location_id: locationId,
                date: formData.date,
                reason: formData.reason || undefined,
                is_recurring: formData.is_recurring
            });
            
            showToast('Day Off created successfully!', 'success');
            setShowCreateModal(false);
            resetForm();
            fetchDayOffs();
        } catch (error: unknown) {
            console.error('Error creating Day Off:', error);
            const message = error instanceof Error ? error.message : 'Error creating Day Off';
            showToast(message, 'error');
        }
    };

    // Handle update day off
    const handleUpdateDayOff = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedDayOff) return;

        try {
            await dayOffService.updateDayOff(selectedDayOff.id, {
                date: formData.date,
                reason: formData.reason || undefined,
                is_recurring: formData.is_recurring
            });
            
            showToast('Day Off updated successfully!', 'success');
            setShowEditModal(false);
            resetForm();
            fetchDayOffs();
        } catch (error: unknown) {
            console.error('Error updating Day Off:', error);
            const message = error instanceof Error ? error.message : 'Error updating Day Off';
            showToast(message, 'error');
        }
    };

    // Handle delete day off
    const handleDeleteDayOff = async (dayOffId: number, dayOffDate: string) => {
        if (!window.confirm(`Are you sure you want to delete the Day Off on "${dayOffDate}"?`)) {
            return;
        }

        try {
            await dayOffService.deleteDayOff(dayOffId);
            showToast('Day Off deleted successfully!', 'success');
            fetchDayOffs();
        } catch (error) {
            console.error('Error deleting Day Off:', error);
            showToast('Error deleting Day Off', 'error');
        }
    };

    // Toggle selection mode
    const toggleSelectionMode = () => {
        setSelectionMode(!selectionMode);
        setSelectedDayOffIds(new Set());
    };

    // Toggle day off selection
    const toggleDayOffSelection = (dayOffId: number) => {
        const newSelected = new Set(selectedDayOffIds);
        if (newSelected.has(dayOffId)) {
            newSelected.delete(dayOffId);
        } else {
            newSelected.add(dayOffId);
        }
        setSelectedDayOffIds(newSelected);
    };

    // Select all day offs
    const selectAllDayOffs = () => {
        if (selectedDayOffIds.size === dayOffs.length) {
            setSelectedDayOffIds(new Set());
        } else {
            setSelectedDayOffIds(new Set(dayOffs.map(dayOff => dayOff.id)));
        }
    };

    // Handle bulk delete
    const handleBulkDelete = async () => {
        if (selectedDayOffIds.size === 0) {
            showToast('Please select Day Offs to delete', 'info');
            return;
        }

        if (!window.confirm(`Are you sure you want to delete ${selectedDayOffIds.size} Day Off(s)?`)) {
            return;
        }

        try {
            await dayOffService.bulkDeleteDayOffs(Array.from(selectedDayOffIds));
            showToast(`${selectedDayOffIds.size} Day Off(s) deleted successfully!`, 'success');
            setSelectedDayOffIds(new Set());
            setSelectionMode(false);
            fetchDayOffs();
        } catch (error) {
            console.error('Error deleting Day Offs:', error);
            showToast('Error deleting Day Offs', 'error');
        }
    };

    // Handle edit click
    const handleEditClick = (dayOff: DayOff) => {
        setSelectedDayOff(dayOff);
        setFormData({
            date: dayOff.date.split('T')[0], // Extract date part
            reason: dayOff.reason || '',
            is_recurring: dayOff.is_recurring
        });
        setShowEditModal(true);
    };

    // Handle filter changes
    const handleFilterChange = (key: keyof DayOffFilters, value: boolean | undefined) => {
        setFilters(prev => ({ ...prev, [key]: value }));
        setCurrentPage(1);
    };

    // Handle search
    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
        setCurrentPage(1);
    };

    // Pagination
    const handlePageChange = (page: number) => {
        setCurrentPage(page);
    };

    // Format date for display
    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { 
            weekday: 'short',
            month: 'short', 
            day: 'numeric', 
            year: 'numeric' 
        });
    };

    // Check if date is in the past
    const isPastDate = (dateString: string) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const date = new Date(dateString);
        return date < today;
    };

    // Bulk calendar helper functions
    const getDaysInMonth = (year: number, month: number) => {
        return new Date(year, month + 1, 0).getDate();
    };

    const getFirstDayOfMonth = (year: number, month: number) => {
        return new Date(year, month, 1).getDay();
    };

    const formatDateString = (year: number, month: number, day: number) => {
        return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    };

    const toggleBulkDate = (dateStr: string) => {
        setBulkSelectedDates(prev => {
            const newSet = new Set(prev);
            if (newSet.has(dateStr)) {
                newSet.delete(dateStr);
            } else {
                newSet.add(dateStr);
            }
            return newSet;
        });
    };

    const isBulkDatePast = (dateStr: string) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const date = new Date(dateStr);
        return date < today;
    };

    const handleBulkCreateDayOffs = async () => {
        if (bulkSelectedDates.size === 0) {
            setToast({ message: 'Please select at least one date', type: 'info' });
            return;
        }

        setBulkCreating(true);
        let successCount = 0;
        let failCount = 0;

        const sortedDates = Array.from(bulkSelectedDates).sort();

        // Use modal location for company_admin, default to user's location_id otherwise
        const locationId = isCompanyAdmin && modalLocationId 
            ? modalLocationId 
            : (currentUser?.location_id || 1);

        for (const dateStr of sortedDates) {
            try {
                await dayOffService.createDayOff({
                    location_id: locationId,
                    date: dateStr,
                    reason: bulkReason || undefined,
                    is_recurring: bulkIsRecurring
                });
                successCount++;
            } catch (error) {
                console.error(`Failed to create day off for ${dateStr}:`, error);
                failCount++;
            }
        }

        setBulkCreating(false);

        if (successCount > 0) {
            setToast({ 
                message: `Created ${successCount} day off${successCount > 1 ? 's' : ''}${failCount > 0 ? ` (${failCount} failed)` : ''}`, 
                type: failCount > 0 ? 'info' : 'success' 
            });
            fetchDayOffs();
        } else {
            setToast({ message: 'Failed to create day offs', type: 'error' });
        }

        setShowBulkModal(false);
        setBulkSelectedDates(new Set());
        setBulkReason('');
        setBulkIsRecurring(false);
    };

    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                        'July', 'August', 'September', 'October', 'November', 'December'];

    return (
        <div className="px-6 py-8">
            {/* Page Header with Action Buttons */}
            <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Day Offs</h1>
                    <p className="text-gray-600 mt-1">Manage blocked dates and holidays for your locations</p>
                </div>
                <div className="flex items-center gap-2">
                    {dayOffs.length > 0 && (
                        <StandardButton
                            onClick={toggleSelectionMode}
                            variant={selectionMode ? "secondary" : "secondary"}
                            size="md"
                            icon={selectionMode ? X : CheckSquare}
                        >
                            {selectionMode ? 'Cancel' : 'Select'}
                        </StandardButton>
                    )}
                    <StandardButton
                        onClick={() => {
                            setBulkYear(new Date().getFullYear());
                            setBulkSelectedDates(new Set());
                            setBulkReason('');
                            setBulkIsRecurring(false);
                            if (isCompanyAdmin && locations.length > 0) {
                                setModalLocationId(locations[0].id);
                            }
                            setShowBulkModal(true);
                        }}
                        variant="secondary"
                        size="md"
                        icon={Calendar}
                    >
                        Bulk Add
                    </StandardButton>
                    <StandardButton
                        onClick={() => {
                            resetForm();
                            if (isCompanyAdmin && locations.length > 0) {
                                setModalLocationId(locations[0].id);
                            }
                            setShowCreateModal(true);
                        }}
                        variant="primary"
                        size="md"
                        icon={Plus}
                    >
                        Add Day Off
                    </StandardButton>
                </div>
            </div>

            {/* Main Content */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                {/* Selection Info Bar */}
                {selectionMode && dayOffs.length > 0 && (
                    <div className={`mb-4 p-3 bg-${themeColor}-50 border border-${themeColor}-200 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3`}>
                        <div className="flex items-center gap-3 flex-wrap">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={selectedDayOffIds.size === dayOffs.length}
                                    onChange={selectAllDayOffs}
                                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                                <span className="text-sm font-medium text-gray-700">
                                    Select All
                                </span>
                            </label>
                            <span className="text-sm text-gray-600">
                                {selectedDayOffIds.size} Day Off{selectedDayOffIds.size !== 1 ? 's' : ''} selected
                            </span>
                            {selectedDayOffIds.size > 0 && (
                                <StandardButton
                                    onClick={handleBulkDelete}
                                    variant="danger"
                                    size="sm"
                                    icon={Trash2}
                                >
                                    Delete {selectedDayOffIds.size}
                                </StandardButton>
                            )}
                        </div>
                    </div>
                )}

                {/* Search and Filter Section */}
                {!loading && (
                    <div className="mb-6 space-y-4">
                        {/* Search Bar and Location Filter */}
                        <div className="flex flex-col sm:flex-row gap-3">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Search by date or reason..."
                                    value={searchTerm}
                                    onChange={handleSearch}
                                    className={`w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 outline-none`}
                                />
                            </div>
                            
                            {/* Location Filter for Company Admin */}
                            {isCompanyAdmin && locations.length > 0 && (
                                <div className="min-w-[200px]">
                                    <LocationSelector
                                        locations={locations.map(loc => ({
                                            id: loc.id.toString(),
                                            name: loc.name,
                                            address: loc.address || '',
                                            city: loc.city || '',
                                            state: loc.state || ''
                                        }))}
                                        selectedLocation={selectedLocationId?.toString() || ''}
                                        onLocationChange={(locationId) => {
                                            setSelectedLocationId(locationId ? Number(locationId) : null);
                                            setCurrentPage(1);
                                        }}
                                        themeColor={themeColor}
                                        fullColor={fullColor}
                                        variant="compact"
                                        showAllOption={true}
                                    />
                                </div>
                            )}
                        </div>

                        {/* Filter and Sort Controls */}
                        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                            {/* Type Filter */}
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-medium text-gray-700">Filter:</span>
                                <StandardButton
                                    variant={filters.upcoming_only === true ? "primary" : "secondary"}
                                    size="sm"
                                    onClick={() => handleFilterChange('upcoming_only', true)}
                                >
                                    Upcoming
                                </StandardButton>
                                <StandardButton
                                    variant={filters.upcoming_only === false || filters.upcoming_only === undefined ? "primary" : "secondary"}
                                    size="sm"
                                    onClick={() => handleFilterChange('upcoming_only', undefined)}
                                >
                                    All Dates
                                </StandardButton>
                                <StandardButton
                                    variant={filters.is_recurring === true ? "primary" : "secondary"}
                                    size="sm"
                                    onClick={() => handleFilterChange('is_recurring', filters.is_recurring === true ? undefined : true)}
                                    icon={RefreshCw}
                                >
                                    Recurring Only
                                </StandardButton>
                            </div>

                            {/* Sort Controls */}
                            <div className="flex items-center gap-3">
                                <span className="text-sm font-medium text-gray-700">Sort by:</span>
                                <select
                                    value={filters.sort_by || 'date'}
                                    onChange={(e) => setFilters(prev => ({ ...prev, sort_by: e.target.value as 'date' | 'created_at' }))}
                                    className={`px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 outline-none`}
                                >
                                    <option value="date">Date</option>
                                    <option value="created_at">Created</option>
                                </select>
                                <StandardButton
                                    onClick={() => setFilters(prev => ({ ...prev, sort_order: prev.sort_order === 'asc' ? 'desc' : 'asc' }))}
                                    variant="secondary"
                                    size="sm"
                                >
                                    {filters.sort_order === 'asc' ? '↑ Asc' : '↓ Desc'}
                                </StandardButton>
                            </div>
                        </div>

                        {/* Results count */}
                        <div className="text-sm text-gray-500">
                            Showing {dayOffs.length} day off{dayOffs.length !== 1 ? 's' : ''}
                        </div>
                    </div>
                )}

                {/* Day Offs Grid */}
                {loading ? (
                    <div className="flex justify-center items-center py-12">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-300"></div>
                    </div>
                ) : dayOffs.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {dayOffs.map((dayOff) => (
                            <div 
                                key={dayOff.id} 
                                className={`relative border-2 rounded-lg p-4 transition-all ${
                                    selectionMode 
                                        ? 'cursor-pointer hover:shadow-lg hover:scale-105' 
                                        : 'hover:shadow-md hover:border-gray-300'
                                } ${
                                    selectedDayOffIds.has(dayOff.id)
                                        ? `border-${fullColor} bg-${themeColor}-50 shadow-lg scale-105`
                                        : isPastDate(dayOff.date)
                                            ? 'border-gray-200 bg-gray-50 opacity-75'
                                            : 'border-gray-200 bg-white'
                                }`}
                                onClick={() => selectionMode && toggleDayOffSelection(dayOff.id)}
                            >
                                {/* Selection Checkbox */}
                                {selectionMode && (
                                    <div className="absolute top-3 right-3">
                                        {selectedDayOffIds.has(dayOff.id) ? (
                                            <CheckSquare className={`w-6 h-6 text-${fullColor}`} />
                                        ) : (
                                            <Square className="w-6 h-6 text-gray-400" />
                                        )}
                                    </div>
                                )}

                                <div className="flex justify-between items-start mb-3">
                                    <div className="flex-1 min-w-0 pr-8">
                                        <div className="flex items-center gap-2 mb-1">
                                            <Calendar className={`w-4 h-4 ${isPastDate(dayOff.date) ? 'text-gray-400' : `text-${fullColor}`}`} />
                                            <h3 className="font-semibold text-base text-gray-900">
                                                {formatDate(dayOff.date)}
                                            </h3>
                                        </div>
                                        <div className="flex items-center gap-2 flex-wrap">
                                            {dayOff.is_recurring && (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700">
                                                    <RefreshCw className="w-3 h-3" />
                                                    Recurring
                                                </span>
                                            )}
                                            {isPastDate(dayOff.date) && (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                                                    Past
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    {!selectionMode && (
                                        <div className="flex gap-1 ml-2">
                                            <StandardButton
                                                onClick={() => handleEditClick(dayOff)}
                                                variant="ghost"
                                                size="sm"
                                                className="p-1.5"
                                                icon={Edit2}
                                                title="Edit Day Off"
                                            />
                                            <StandardButton
                                                onClick={() => handleDeleteDayOff(dayOff.id, formatDate(dayOff.date))}
                                                variant="danger"
                                                size="sm"
                                                className="p-1.5"
                                                icon={Trash2}
                                                title="Delete Day Off"
                                            />
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-2 mt-3 pt-3 border-t border-gray-100">
                                    {dayOff.reason && (
                                        <div className="text-sm text-gray-700">
                                            <span className="font-medium">Reason:</span> {dayOff.reason}
                                        </div>
                                    )}

                                    {dayOff.location && (
                                        <div className="flex items-center gap-2 text-sm text-gray-600">
                                            <MapPin className="w-4 h-4 text-gray-400" />
                                            <span>{dayOff.location.name}</span>
                                        </div>
                                    )}

                                    <div className="text-xs text-gray-500">
                                        Created {new Date(dayOff.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center py-16">
                        <div className={`w-16 h-16 rounded-full bg-${themeColor}-100 flex items-center justify-center mb-4`}>
                            <CalendarOff className={`w-8 h-8 text-${fullColor}`} />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">No Day Offs found</h3>
                        <p className="text-gray-600 text-sm mb-6 text-center max-w-sm">
                            {searchTerm || filters.is_recurring !== undefined 
                                ? 'No day offs match your search criteria. Try adjusting your filters.'
                                : 'Get started by adding blocked dates or holidays for your location'}
                        </p>
                        <StandardButton
                            onClick={() => {
                                resetForm();
                                if (isCompanyAdmin && locations.length > 0) {
                                    setModalLocationId(locations[0].id);
                                }
                                setShowCreateModal(true);
                            }}
                            variant="primary"
                            size="md"
                        >
                            Add Day Off
                        </StandardButton>
                    </div>
                )}

                {/* Pagination */}
                {!loading && totalPages > 1 && (
                    <div className="flex items-center justify-center space-x-2 mt-6">
                        <StandardButton
                            onClick={() => handlePageChange(currentPage - 1)}
                            disabled={currentPage === 1}
                            variant="secondary"
                            size="sm"
                        >
                            Previous
                        </StandardButton>
                        
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                            const page = i + 1;
                            return (
                                <StandardButton
                                    key={page}
                                    onClick={() => handlePageChange(page)}
                                    variant={page === currentPage ? "primary" : "secondary"}
                                    size="sm"
                                >
                                    {page}
                                </StandardButton>
                            );
                        })}
                        
                        <StandardButton
                            onClick={() => handlePageChange(currentPage + 1)}
                            disabled={currentPage === totalPages}
                            variant="secondary"
                            size="sm"
                        >
                            Next
                        </StandardButton>
                    </div>
                )}
            </div>

            {/* Create Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={() => setShowCreateModal(false)}>
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
                        <div className="p-6">
                            <h2 className="text-xl font-semibold text-gray-900 mb-4">Add New Day Off</h2>
                            
                            <form onSubmit={handleCreateDayOff} className="space-y-4">
                                {/* Location Selector for Company Admin */}
                                {isCompanyAdmin && (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Location <span className="text-red-500">*</span>
                                        </label>
                                        <LocationSelector
                                            locations={locations.map(loc => ({
                                                id: loc.id.toString(),
                                                name: loc.name,
                                                address: '',
                                                city: '',
                                                state: ''
                                            }))}
                                            selectedLocation={modalLocationId?.toString() || ''}
                                            onLocationChange={(locationId) => {
                                                setModalLocationId(locationId ? Number(locationId) : null);
                                            }}
                                            themeColor={themeColor}
                                            fullColor={fullColor}
                                            layout="grid"
                                            maxWidth="100%"
                                            showAllOption={false}
                                        />
                                    </div>
                                )}

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Date <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="date"
                                        name="date"
                                        value={formData.date}
                                        onChange={handleInputChange}
                                        required
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Reason
                                    </label>
                                    <input
                                        type="text"
                                        name="reason"
                                        value={formData.reason}
                                        onChange={handleInputChange}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        placeholder="e.g., Holiday, Maintenance, etc."
                                    />
                                </div>

                                <div className="flex items-center">
                                    <input
                                        type="checkbox"
                                        name="is_recurring"
                                        checked={formData.is_recurring}
                                        onChange={handleInputChange}
                                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                    />
                                    <label className="ml-2 block text-sm text-gray-900">
                                        Recurring annually
                                    </label>
                                </div>

                                <div className="flex gap-3 pt-4">
                                    <StandardButton
                                        type="submit"
                                        variant="primary"
                                        size="md"
                                        className="flex-1"
                                    >
                                        Add Day Off
                                    </StandardButton>
                                    <StandardButton
                                        type="button"
                                        onClick={() => {
                                            setShowCreateModal(false);
                                            resetForm();
                                        }}
                                        variant="secondary"
                                        size="md"
                                        className="flex-1"
                                    >
                                        Cancel
                                    </StandardButton>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Modal */}
            {showEditModal && selectedDayOff && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={() => setShowEditModal(false)}>
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
                        <div className="p-6">
                            <h2 className="text-xl font-semibold text-gray-900 mb-4">Edit Day Off</h2>
                            <form onSubmit={handleUpdateDayOff} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Date <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="date"
                                        name="date"
                                        value={formData.date}
                                        onChange={handleInputChange}
                                        required
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Reason
                                    </label>
                                    <input
                                        type="text"
                                        name="reason"
                                        value={formData.reason}
                                        onChange={handleInputChange}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        placeholder="e.g., Holiday, Maintenance, etc."
                                    />
                                </div>

                                <div className="flex items-center">
                                    <input
                                        type="checkbox"
                                        name="is_recurring"
                                        checked={formData.is_recurring}
                                        onChange={handleInputChange}
                                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                    />
                                    <label className="ml-2 block text-sm text-gray-900">
                                        Recurring annually
                                    </label>
                                </div>

                                <div className="flex gap-3 pt-4">
                                    <StandardButton
                                        type="submit"
                                        variant="primary"
                                        size="md"
                                        className="flex-1"
                                    >
                                        Update Day Off
                                    </StandardButton>
                                    <StandardButton
                                        type="button"
                                        onClick={() => {
                                            setShowEditModal(false);
                                            resetForm();
                                        }}
                                        variant="secondary"
                                        size="md"
                                        className="flex-1"
                                    >
                                        Cancel
                                    </StandardButton>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Bulk Create Modal */}
            {showBulkModal && (
                <div className="fixed inset-0 z-50 overflow-y-auto">
                    <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
                        <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={() => !bulkCreating && setShowBulkModal(false)} />
                        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
                        <div className="inline-block overflow-hidden text-left align-bottom transition-all transform bg-white rounded-lg shadow-xl sm:my-8 sm:align-middle sm:w-full sm:max-w-6xl max-h-[90vh] overflow-y-auto">
                            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10">
                                <h3 className="text-lg font-semibold text-gray-900">Bulk Add Day Offs</h3>
                                <div className="flex items-center gap-4">
                                    <button
                                        onClick={() => setBulkYear(prev => prev - 1)}
                                        className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                                        disabled={bulkCreating}
                                    >
                                        <ChevronLeft className="w-5 h-5" />
                                    </button>
                                    <span className="text-lg font-bold min-w-[60px] text-center">{bulkYear}</span>
                                    <button
                                        onClick={() => setBulkYear(prev => prev + 1)}
                                        className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                                        disabled={bulkCreating}
                                    >
                                        <ChevronRight className="w-5 h-5" />
                                    </button>
                                </div>
                                <button
                                    onClick={() => !bulkCreating && setShowBulkModal(false)}
                                    className="text-gray-400 hover:text-gray-600"
                                    disabled={bulkCreating}
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="p-6">
                                {/* Location selector for company admin */}
                                {isCompanyAdmin && (
                                    <div className="mb-4">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                                        <select
                                            value={modalLocationId || ''}
                                            onChange={(e) => setModalLocationId(Number(e.target.value))}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                            disabled={bulkCreating}
                                        >
                                            {locations.map(loc => (
                                                <option key={loc.id} value={loc.id}>{loc.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                {/* Selected count */}
                                <div className="mb-4 flex items-center justify-between">
                                    <span className="text-sm text-gray-600">
                                        {bulkSelectedDates.size} date{bulkSelectedDates.size !== 1 ? 's' : ''} selected
                                    </span>
                                    {bulkSelectedDates.size > 0 && (
                                        <button
                                            onClick={() => setBulkSelectedDates(new Set())}
                                            className="text-sm text-red-600 hover:text-red-800"
                                            disabled={bulkCreating}
                                        >
                                            Clear all
                                        </button>
                                    )}
                                </div>

                                {/* Calendar grid - 12 months */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
                                    {monthNames.map((monthName, monthIndex) => (
                                        <div key={monthIndex} className="border border-gray-200 rounded-lg p-3">
                                            <h4 className="text-sm font-semibold text-gray-700 mb-2 text-center">{monthName}</h4>
                                            <div className="grid grid-cols-7 gap-1 text-xs">
                                                {/* Day headers */}
                                                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
                                                    <div key={i} className="text-center text-gray-400 font-medium py-1">{day}</div>
                                                ))}
                                                {/* Empty cells for first day offset */}
                                                {Array.from({ length: getFirstDayOfMonth(bulkYear, monthIndex) }).map((_, i) => (
                                                    <div key={`empty-${i}`} />
                                                ))}
                                                {/* Day cells */}
                                                {Array.from({ length: getDaysInMonth(bulkYear, monthIndex) }).map((_, dayIndex) => {
                                                    const day = dayIndex + 1;
                                                    const dateStr = formatDateString(bulkYear, monthIndex, day);
                                                    const isSelected = bulkSelectedDates.has(dateStr);
                                                    const isPast = isBulkDatePast(dateStr);
                                                    
                                                    return (
                                                        <button
                                                            key={day}
                                                            onClick={() => !isPast && !bulkCreating && toggleBulkDate(dateStr)}
                                                            disabled={isPast || bulkCreating}
                                                            className={`
                                                                p-1 rounded text-center transition-colors
                                                                ${isPast 
                                                                    ? 'text-gray-300 cursor-not-allowed' 
                                                                    : isSelected 
                                                                        ? `bg-${themeColor}-500 text-white hover:bg-${themeColor}-600` 
                                                                        : 'hover:bg-gray-100 text-gray-700'
                                                                }
                                                            `}
                                                            style={isSelected && !isPast ? { backgroundColor: fullColor, color: 'white' } : undefined}
                                                        >
                                                            {day}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Reason and recurring options */}
                                <div className="space-y-4 border-t pt-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Reason (optional - applies to all selected dates)
                                        </label>
                                        <input
                                            type="text"
                                            value={bulkReason}
                                            onChange={(e) => setBulkReason(e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                            placeholder="e.g., Holiday, Maintenance, etc."
                                            disabled={bulkCreating}
                                        />
                                    </div>

                                    <div className="flex items-center">
                                        <input
                                            type="checkbox"
                                            checked={bulkIsRecurring}
                                            onChange={(e) => setBulkIsRecurring(e.target.checked)}
                                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                            disabled={bulkCreating}
                                        />
                                        <label className="ml-2 block text-sm text-gray-900">
                                            Recurring annually
                                        </label>
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex gap-3 pt-6">
                                    <StandardButton
                                        onClick={handleBulkCreateDayOffs}
                                        variant="primary"
                                        size="md"
                                        className="flex-1"
                                        disabled={bulkSelectedDates.size === 0 || bulkCreating}
                                    >
                                        {bulkCreating 
                                            ? 'Creating...' 
                                            : `Create ${bulkSelectedDates.size} Day Off${bulkSelectedDates.size !== 1 ? 's' : ''}`
                                        }
                                    </StandardButton>
                                    <StandardButton
                                        onClick={() => setShowBulkModal(false)}
                                        variant="secondary"
                                        size="md"
                                        className="flex-1"
                                        disabled={bulkCreating}
                                    >
                                        Cancel
                                    </StandardButton>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

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

export default DayOffs;
