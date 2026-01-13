import React, { useState, useEffect } from 'react';
import { Search, Edit2, Trash2, Users, MapPin, CheckSquare, Square, Plus, X, Clock, Layers, Timer } from 'lucide-react';

// Break time type
interface BreakTime {
    days: string[];
    start_time: string;
    end_time: string;
}

const DAYS_OF_WEEK = [
    { value: 'monday', label: 'Mon' },
    { value: 'tuesday', label: 'Tue' },
    { value: 'wednesday', label: 'Wed' },
    { value: 'thursday', label: 'Thu' },
    { value: 'friday', label: 'Fri' },
    { value: 'saturday', label: 'Sat' },
    { value: 'sunday', label: 'Sun' }
];
import StandardButton from '../../../components/ui/StandardButton';
import Toast from '../../../components/ui/Toast';
import { roomService, locationService } from '../../../services';
import { roomCacheService } from '../../../services/RoomCacheService';
import LocationSelector from '../../../components/admin/LocationSelector';
import type { Room, RoomFilters } from '../../../services/RoomService';
import type { Location } from '../../../services/LocationService';
import { useThemeColor } from '../../../hooks/useThemeColor';
import { getStoredUser } from '../../../utils/storage';

const Rooms: React.FC = () => {
    const { themeColor, fullColor } = useThemeColor();
    
    // State management
    const [rooms, setRooms] = useState<Room[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filters, setFilters] = useState<RoomFilters>({
        is_available: undefined,
        sort_by: 'name',
        sort_order: 'asc',
        per_page: 20,
        page: 1
    });
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    
    // Bulk selection state
    const [selectionMode, setSelectionMode] = useState(false);
    const [selectedRoomIds, setSelectedRoomIds] = useState<Set<number>>(new Set());
    
    // Location filtering for company_admin
    const currentUser = getStoredUser();
    const isCompanyAdmin = currentUser?.role === 'company_admin';
    const [locations, setLocations] = useState<Location[]>([]);
    const [selectedLocationId, setSelectedLocationId] = useState<number | null>(null);
    const [modalLocationId, setModalLocationId] = useState<number | null>(null);

    // Form state for create/edit
    const [formData, setFormData] = useState({
        name: '',
        capacity: '',
        is_available: true,
        break_time: [] as BreakTime[],
        area_group: '',
        booking_interval: '15'
    });

    // Bulk creation state
    const [creationMode, setCreationMode] = useState<'single' | 'multiple'>('single');
    const [bulkFormData, setBulkFormData] = useState({
        baseName: '',
        suffixType: 'number' as 'number' | 'letter',
        count: 1,
        startNumber: 1,
        startLetter: 'A',
        capacity: '',
        is_available: true,
        break_time: [] as BreakTime[],
        area_group: '',
        booking_interval: '15'
    });

    // Break time form state
    const [showBreakTimeForm, setShowBreakTimeForm] = useState(false);
    const [newBreakTime, setNewBreakTime] = useState<BreakTime>({
        days: [],
        start_time: '12:00',
        end_time: '13:00'
    });

    // Area group interval update modal state
    const [showAreaGroupModal, setShowAreaGroupModal] = useState(false);
    const [selectedAreaGroup, setSelectedAreaGroup] = useState<string>('');
    const [areaGroupInterval, setAreaGroupInterval] = useState<string>('15');

    // Generate preview of rooms to be created
    const generateRoomPreview = (): string[] => {
        const { baseName, suffixType, count, startNumber, startLetter } = bulkFormData;
        if (!baseName || count < 1) return [];

        const rooms: string[] = [];
        for (let i = 0; i < count; i++) {
            if (suffixType === 'number') {
                rooms.push(`${baseName} ${startNumber + i}`);
            } else {
                const charCode = startLetter.charCodeAt(0) + i;
                if (charCode <= 90) { // Limit to A-Z
                    rooms.push(`${baseName} ${String.fromCharCode(charCode)}`);
                }
            }
        }
        return rooms;
    };

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
                    console.log('Locations data:', response);
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

    // Fetch rooms
    const fetchRooms = React.useCallback(async () => {
        try {
            setLoading(true);
            const searchFilters = {
                ...filters,
                search: searchTerm || undefined,
                page: currentPage,
                user_id: getStoredUser()?.id,
                location_id: isCompanyAdmin && selectedLocationId ? selectedLocationId : undefined
            };
            
            // Try cache first for faster loading (only for first page with no search/filters)
            if (currentPage === 1 && !searchTerm && !filters.is_available) {
                const cachedRooms = await roomCacheService.getFilteredRoomsFromCache(
                    isCompanyAdmin && selectedLocationId ? { location_id: selectedLocationId } : {}
                );
                
                if (cachedRooms && cachedRooms.length > 0) {
                    setRooms(cachedRooms);
                    setTotalPages(1); // Cache doesn't have pagination info
                    setLoading(false);
                    return;
                }
            }
            
            // Fall back to API for filtered/paginated results
            const response = await roomService.getRooms(searchFilters);
            
            if (response.data) {
                setRooms(response.data.rooms || []);
                const pagination = response.data.pagination;
                setTotalPages(pagination?.last_page || 1);
                
                // Cache the rooms for next time (only first page without filters)
                if (currentPage === 1 && !searchTerm && response.data.rooms) {
                    await roomCacheService.cacheRooms(response.data.rooms);
                }
            }
        } catch (error) {
            console.error('Error fetching Spaces:', error);
            showToast('Error loading Spaces', 'error');
        } finally {
            setLoading(false);
        }
    }, [filters, searchTerm, currentPage, isCompanyAdmin, selectedLocationId]);

    useEffect(() => {
        fetchRooms();
    }, [fetchRooms]);

    // Handle form input changes
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
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
            name: '',
            capacity: '',
            is_available: true,
            break_time: [],
            area_group: '',
            booking_interval: '15'
        });
        setBulkFormData({
            baseName: '',
            suffixType: 'number',
            count: 1,
            startNumber: 1,
            startLetter: 'A',
            capacity: '',
            is_available: true,
            break_time: [],
            area_group: '',
            booking_interval: '15'
        });
        setCreationMode('single');
        setSelectedRoom(null);
        setShowBreakTimeForm(false);
        setNewBreakTime({ days: [], start_time: '12:00', end_time: '13:00' });
    };

    // Break time helpers
    const addBreakTime = (isBulk: boolean = false) => {
        if (newBreakTime.days.length === 0) {
            showToast('Please select at least one day', 'error');
            return;
        }
        if (!newBreakTime.start_time || !newBreakTime.end_time) {
            showToast('Please set start and end time', 'error');
            return;
        }
        if (newBreakTime.start_time >= newBreakTime.end_time) {
            showToast('End time must be after start time', 'error');
            return;
        }

        if (isBulk) {
            setBulkFormData(prev => ({
                ...prev,
                break_time: [...prev.break_time, { ...newBreakTime }]
            }));
        } else {
            setFormData(prev => ({
                ...prev,
                break_time: [...prev.break_time, { ...newBreakTime }]
            }));
        }
        setNewBreakTime({ days: [], start_time: '12:00', end_time: '13:00' });
        setShowBreakTimeForm(false);
    };

    const removeBreakTime = (index: number, isBulk: boolean = false) => {
        if (isBulk) {
            setBulkFormData(prev => ({
                ...prev,
                break_time: prev.break_time.filter((_, i) => i !== index)
            }));
        } else {
            setFormData(prev => ({
                ...prev,
                break_time: prev.break_time.filter((_, i) => i !== index)
            }));
        }
    };

    const toggleBreakTimeDay = (day: string) => {
        setNewBreakTime(prev => ({
            ...prev,
            days: prev.days.includes(day)
                ? prev.days.filter(d => d !== day)
                : [...prev.days, day]
        }));
    };

    const selectAllBreakTimeDays = () => {
        const allDays = DAYS_OF_WEEK.map(d => d.value);
        const allSelected = allDays.every(day => newBreakTime.days.includes(day));
        setNewBreakTime(prev => ({
            ...prev,
            days: allSelected ? [] : allDays
        }));
    };

    const formatTime12Hour = (time24: string): string => {
        const [hours, minutes] = time24.split(':').map(Number);
        const period = hours >= 12 ? 'PM' : 'AM';
        const hours12 = hours % 12 || 12;
        return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`;
    };

    // Handle create room (single or bulk)
    const handleCreateRoom = async (e: React.FormEvent) => {
        e.preventDefault();
        
        try {
            // Use modal location for company_admin, default to 1 otherwise
            const locationId = isCompanyAdmin && modalLocationId ? modalLocationId : 1;
            
            if (creationMode === 'single') {
                const createResponse = await roomService.createRoom({
                    location_id: locationId,
                    name: formData.name,
                    capacity: formData.capacity ? parseInt(formData.capacity) : undefined,
                    is_available: formData.is_available,
                    break_time: formData.break_time.length > 0 ? formData.break_time : undefined,
                    area_group: formData.area_group || undefined,
                    booking_interval: formData.booking_interval ? parseInt(formData.booking_interval) : 15
                });
                // Sync cache with newly created room
                if (createResponse.data) {
                    await roomCacheService.addRoomToCache(createResponse.data);
                }
                showToast('Space created successfully!', 'success');
            } else {
                // Bulk creation
                const roomsToCreate = generateRoomPreview();
                const capacity = bulkFormData.capacity ? parseInt(bulkFormData.capacity) : undefined;
                
                // Create rooms sequentially and collect created rooms
                const createdRooms = [];
                for (const roomName of roomsToCreate) {
                    const createRes = await roomService.createRoom({
                        location_id: locationId,
                        name: roomName,
                        capacity: capacity,
                        is_available: bulkFormData.is_available,
                        break_time: bulkFormData.break_time.length > 0 ? bulkFormData.break_time : undefined,
                        area_group: bulkFormData.area_group || undefined,
                        booking_interval: bulkFormData.booking_interval ? parseInt(bulkFormData.booking_interval) : 15
                    });
                    if (createRes.data) {
                        createdRooms.push(createRes.data);
                    }
                }
                
                // Sync cache with all newly created rooms
                if (createdRooms.length > 0) {
                    await roomCacheService.addRoomsToCache(createdRooms);
                }
                
                showToast(`${roomsToCreate.length} Spaces created successfully!`, 'success');
            }
            
            setShowCreateModal(false);
            resetForm();
            fetchRooms();
        } catch (error) {
            console.error('Error creating Space:', error);
            showToast('Error creating Space(s)', 'error');
        }
    };

    // Handle update room
    const handleUpdateRoom = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedRoom) return;

        try {
            const updateResponse = await roomService.updateRoom(selectedRoom.id, {
                name: formData.name,
                capacity: formData.capacity ? parseInt(formData.capacity) : undefined,
                is_available: formData.is_available,
                break_time: formData.break_time.length > 0 ? formData.break_time : undefined,
                area_group: formData.area_group || undefined,
                booking_interval: formData.booking_interval ? parseInt(formData.booking_interval) : 15
            });
            
            // Sync cache with updated room
            if (updateResponse.data) {
                await roomCacheService.updateRoomInCache(updateResponse.data);
            }
            
            showToast('Space updated successfully!', 'success');
            setShowEditModal(false);
            resetForm();
            fetchRooms();
        } catch (error) {
            console.error('Error updating Space:', error);
            showToast('Error updating Space', 'error');
        }
    };

    // Handle delete room
    const handleDeleteRoom = async (roomId: number, roomName: string) => {
        if (!window.confirm(`Are you sure you want to delete "${roomName}" Space?`)) {
            return;
        }

        try {
            await roomService.deleteRoom(roomId);
            // Remove from cache
            await roomCacheService.removeRoomFromCache(roomId);
            showToast('Space deleted successfully!', 'success');
            fetchRooms();
        } catch (error) {
            console.error('Error deleting Space:', error);
            showToast('Error deleting Space', 'error');
        }
    };

    // Toggle selection mode
    const toggleSelectionMode = () => {
        setSelectionMode(!selectionMode);
        setSelectedRoomIds(new Set());
    };

    // Toggle room selection
    const toggleRoomSelection = (roomId: number) => {
        const newSelected = new Set(selectedRoomIds);
        if (newSelected.has(roomId)) {
            newSelected.delete(roomId);
        } else {
            newSelected.add(roomId);
        }
        setSelectedRoomIds(newSelected);
    };

    // Select all rooms
    const selectAllRooms = () => {
        if (selectedRoomIds.size === rooms.length) {
            setSelectedRoomIds(new Set());
        } else {
            setSelectedRoomIds(new Set(rooms.map(room => room.id)));
        }
    };

    // Handle bulk delete
    const handleBulkDelete = async () => {
        if (selectedRoomIds.size === 0) {
            showToast('Please select Spaces to delete', 'info');
            return;
        }

        if (!window.confirm(`Are you sure you want to delete ${selectedRoomIds.size} Space(s)?`)) {
            return;
        }

        try {
            const roomIdsToDelete = Array.from(selectedRoomIds);
            await roomService.bulkDeleteRooms(roomIdsToDelete);
            // Remove from cache
            await roomCacheService.removeRoomsFromCache(roomIdsToDelete);
            showToast(`${selectedRoomIds.size} Space(s) deleted successfully!`, 'success');
            setSelectedRoomIds(new Set());
            setSelectionMode(false);
            fetchRooms();
        } catch (error) {
            console.error('Error deleting Spaces:', error);
            showToast('Error deleting Spaces', 'error');
        }
    };

    // Get unique area groups from rooms
    const getUniqueAreaGroups = (): string[] => {
        const groups = rooms
            .map(room => room.area_group)
            .filter((group): group is string => !!group);
        return [...new Set(groups)].sort();
    };

    // Handle area group interval update
    const handleAreaGroupIntervalUpdate = async () => {
        if (!selectedAreaGroup) {
            showToast('Please select an area group', 'error');
            return;
        }
        
        const interval = parseInt(areaGroupInterval);
        if (isNaN(interval) || interval < 0) {
            showToast('Please enter a valid interval', 'error');
            return;
        }

        try {
            const response = await roomService.updateBookingIntervalByAreaGroup(selectedAreaGroup, interval);
            showToast(response.message || `Booking interval updated for area group "${selectedAreaGroup}"`, 'success');
            setShowAreaGroupModal(false);
            setSelectedAreaGroup('');
            setAreaGroupInterval('15');
            fetchRooms();
        } catch (error) {
            console.error('Error updating area group interval:', error);
            showToast('Error updating booking interval', 'error');
        }
    };

    // Handle edit click
    const handleEditClick = (room: Room) => {
        setSelectedRoom(room);
        setFormData({
            name: room.name,
            capacity: room.capacity?.toString() || '',
            is_available: room.is_available,
            break_time: (room as any).break_time || [],
            area_group: room.area_group || '',
            booking_interval: room.booking_interval?.toString() || '15'
        });
        setShowBreakTimeForm(false);
        setShowEditModal(true);
    };

    // Handle filter changes
    const handleFilterChange = (key: keyof RoomFilters, value: string | number | boolean | undefined) => {
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

    return (
        <div className="px-6 py-8">
            {/* Page Header with Action Buttons */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Spaces</h1>
                    <p className="text-gray-600 mt-2">Manage your facility Spaces and their availability</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    {getUniqueAreaGroups().length > 0 && (
                        <StandardButton
                            onClick={() => setShowAreaGroupModal(true)}
                            variant="secondary"
                            size="md"
                            icon={Layers}
                        >
                            Area Group Settings
                        </StandardButton>
                    )}
                    {rooms.length > 0 && (
                        <StandardButton
                            onClick={toggleSelectionMode}
                            variant={selectionMode ? "secondary" : "secondary"}
                            size="md"
                            icon={selectionMode ? X : CheckSquare}
                        >
                            {selectionMode ? 'Cancel' : 'Select Spaces'}
                        </StandardButton>
                    )}
                    <StandardButton
                        onClick={() => {
                            resetForm();
                            setShowCreateModal(true);
                        }}
                        variant="primary"
                        size="md"
                        icon={Plus}
                    >
                        Create Room
                    </StandardButton>
                </div>
            </div>

            {/* Main Content */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                {/* Selection Info Bar */}
                {selectionMode && rooms.length > 0 && (
                    <div className={`mb-4 p-3 bg-${themeColor}-50 border border-${themeColor}-200 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3`}>
                        <div className="flex items-center gap-3 flex-wrap">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={selectedRoomIds.size === rooms.length}
                                    onChange={selectAllRooms}
                                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                                <span className="text-sm font-medium text-gray-700">
                                    Select All
                                </span>
                            </label>
                            <span className="text-sm text-gray-600">
                                {selectedRoomIds.size} Space{selectedRoomIds.size !== 1 ? 's' : ''} selected
                            </span>
                            {selectedRoomIds.size > 0 && (
                                <StandardButton
                                    onClick={handleBulkDelete}
                                    variant="danger"
                                    size="sm"
                                    icon={Trash2}
                                >
                                    Delete {selectedRoomIds.size} Space{selectedRoomIds.size !== 1 ? 's' : ''}
                                </StandardButton>
                            )}
                        </div>
                    </div>
                )}

                {/* Search and Filter Section - Always visible */}
                {!loading && (
                    <div className="mb-6 space-y-4">
                            {/* Search Bar and Location Filter */}
                            <div className="flex flex-col sm:flex-row gap-3">
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                                    <input
                                        type="text"
                                        placeholder="Search Spaces by name..."
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
                                {/* Status Filter */}
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-sm font-medium text-gray-700">Status:</span>
                                    <StandardButton
                                        variant={filters.is_available === undefined ? "primary" : "secondary"}
                                        size="sm"
                                        onClick={() => handleFilterChange('is_available', undefined)}
                                    >
                                        All
                                    </StandardButton>
                                    <StandardButton
                                        variant={filters.is_available === true ? "primary" : "secondary"}
                                        size="sm"
                                        onClick={() => handleFilterChange('is_available', true)}
                                    >
                                        Available
                                    </StandardButton>
                                    <StandardButton
                                        variant={filters.is_available === false ? "primary" : "secondary"}
                                        size="sm"
                                        onClick={() => handleFilterChange('is_available', false)}
                                    >
                                        Unavailable
                                    </StandardButton>
                                </div>

                                {/* Sort Controls */}
                                <div className="flex items-center gap-3">
                                    <span className="text-sm font-medium text-gray-700">Sort by:</span>
                                    <select
                                        value={filters.sort_by || 'name'}
                                        onChange={(e) => handleFilterChange('sort_by', e.target.value)}
                                        className={`px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 outline-none`}
                                    >
                                        <option value="name">Name</option>
                                        <option value="capacity">Capacity</option>
                                        <option value="created_at">Date</option>
                                    </select>
                                    <StandardButton
                                        onClick={() => handleFilterChange('sort_order', filters.sort_order === 'asc' ? 'desc' : 'asc')}
                                        variant="secondary"
                                        size="sm"
                                    >
                                        {filters.sort_order === 'asc' ? '↑ Asc' : '↓ Desc'}
                                    </StandardButton>
                                </div>
                            </div>

                            {/* Results count */}
                            <div className="text-sm text-gray-500">
                                Showing {rooms.length} room{rooms.length !== 1 ? 's' : ''}
                            </div>
                        </div>
                )}

                {/* Rooms Grid */}
                {loading ? (
                    <div className="flex justify-center items-center py-12">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-300"></div>
                    </div>
                ) : rooms.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                {[...rooms]
                                     .sort((a, b) =>
                                       a.name.localeCompare(b.name, undefined, {
                                         numeric: true,
                                         sensitivity: "base",
                                       })
                                     )
                                     .map((room) => (
                                    <div 
                                        key={room.id} 
                                        className={`relative border-2 rounded-lg p-4 transition-all ${
                                            selectionMode 
                                                ? 'cursor-pointer hover:shadow-lg hover:scale-105' 
                                                : 'hover:shadow-md hover:border-gray-300'
                                        } ${
                                            selectedRoomIds.has(room.id)
                                                ? `border-${fullColor} bg-${themeColor}-50 shadow-lg scale-105`
                                                : 'border-gray-200 bg-white'
                                        }`}
                                        onClick={() => selectionMode && toggleRoomSelection(room.id)}
                                    >
                                        {/* Selection Checkbox */}
                                        {selectionMode && (
                                            <div className="absolute top-3 right-3">
                                                {selectedRoomIds.has(room.id) ? (
                                                    <CheckSquare className={`w-6 h-6 text-${fullColor}`} />
                                                ) : (
                                                    <Square className="w-6 h-6 text-gray-400" />
                                                )}
                                            </div>
                                        )}

                                        <div className="flex justify-between items-start mb-3">
                                            <div className="flex-1 min-w-0 pr-8">
                                                <h3 className="font-semibold text-base text-gray-900 truncate mb-1">{room.name}</h3>
                                                <span
                                                    className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                                        room.is_available
                                                            ? 'bg-green-100 text-green-700'
                                                            : 'bg-red-100 text-red-700'
                                                    }`}
                                                >
                                                    {room.is_available ? 'Available' : 'Unavailable'}
                                                </span>
                                            </div>
                                            {!selectionMode && (
                                                <div className="flex gap-1 ml-2">
                                                    <StandardButton
                                                        onClick={() => handleEditClick(room)}
                                                        variant="ghost"
                                                        size="sm"
                                                        className="p-1.5"
                                                        icon={Edit2}
                                                        title="Edit Space"
                                                    />
                                                    <StandardButton
                                                        onClick={() => handleDeleteRoom(room.id, room.name)}
                                                        variant="danger"
                                                        size="sm"
                                                        className="p-1.5"
                                                        icon={Trash2}
                                                        title="Delete Space"
                                                    />
                                                </div>
                                            )}
                                        </div>

                                        <div className="space-y-2 mt-3 pt-3 border-t border-gray-100">
                                            {room.capacity && (
                                                <div className="flex items-center gap-2 text-sm text-gray-700">
                                                    <Users className="w-4 h-4 text-gray-400" />
                                                    <span className="font-medium">{room.capacity}</span>
                                                    <span className="text-gray-500">people</span>
                                                </div>
                                            )}

                                            {room.area_group && (
                                                <div className="flex items-center gap-2 text-sm text-gray-700">
                                                    <Layers className="w-4 h-4 text-gray-400" />
                                                    <span className="font-medium">{room.area_group}</span>
                                                    {room.booking_interval && (
                                                        <span className="text-xs text-gray-500">({room.booking_interval}min interval)</span>
                                                    )}
                                                </div>
                                            )}

                                            <div className="text-xs text-gray-500">
                                                {new Date(room.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                ) : (
                    <div className="flex flex-col items-center py-16">
                        <div className={`w-16 h-16 rounded-full bg-${themeColor}-100 flex items-center justify-center mb-4`}>
                            <MapPin className={`w-8 h-8 text-${fullColor}`} />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">No Spaces found</h3>
                        <p className="text-gray-600 text-sm mb-6 text-center max-w-sm">
                            {searchTerm || filters.is_available !== undefined 
                                ? 'No rooms match your search criteria. Try adjusting your filters.'
                                : 'Get started by creating your first Space for package bookings'}
                        </p>
                        <StandardButton
                            onClick={() => {
                                resetForm();
                                setShowCreateModal(true);
                            }}
                            variant="primary"
                            size="md"
                        >
                            Create Room
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
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
                        <div className="p-6 overflow-y-auto flex-1">
                            <h2 className="text-xl font-semibold text-gray-900 mb-4">Add New Space</h2>
                            
                            {/* Creation Mode Toggle */}
                            <div className="flex gap-2 mb-6 bg-gray-100 p-1 rounded-lg">
                                <StandardButton
                                    type="button"
                                    onClick={() => setCreationMode('single')}
                                    variant={creationMode === 'single' ? "primary" : "secondary"}
                                    size="sm"
                                    className="flex-1"
                                >
                                    Single Room
                                </StandardButton>
                                <StandardButton
                                    type="button"
                                    onClick={() => setCreationMode('multiple')}
                                    variant={creationMode === 'multiple' ? "primary" : "secondary"}
                                    size="sm"
                                    className="flex-1"
                                >
                                    Multiple Rooms
                                </StandardButton>
                            </div>

                            <form onSubmit={handleCreateRoom} className="space-y-4">
                                {/* Location Selector */}
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

                                {creationMode === 'single' ? (
                                    <>
                                        {/* Single Room Form */}
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Space Name *
                                            </label>
                                            <input
                                                type="text"
                                                name="name"
                                                value={formData.name}
                                                onChange={handleInputChange}
                                                required
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                placeholder="Enter Space name"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Capacity (people)
                                            </label>
                                            <input
                                                type="number"
                                                name="capacity"
                                                value={formData.capacity}
                                                onChange={handleInputChange}
                                                min="1"
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                placeholder="Enter capacity"
                                            />
                                        </div>

                                        <div className="flex items-center">
                                            <input
                                                type="checkbox"
                                                name="is_available"
                                                checked={formData.is_available}
                                                onChange={handleInputChange}
                                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                            />
                                            <label className="ml-2 block text-sm text-gray-900">
                                                Available for booking
                                            </label>
                                        </div>

                                        {/* Area Group & Booking Interval Section */}
                                        <div className="border-t border-gray-200 pt-4">
                                            <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                                                <Layers className="w-4 h-4" />
                                                Stagger Booking Settings
                                            </h4>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-xs font-medium text-gray-600 mb-1">
                                                        Area Group
                                                    </label>
                                                    <input
                                                        type="text"
                                                        name="area_group"
                                                        value={formData.area_group}
                                                        onChange={handleInputChange}
                                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                                                        placeholder="e.g., Zone A"
                                                    />
                                                    <p className="text-xs text-gray-500 mt-1">Rooms in the same group share stagger rules</p>
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-gray-600 mb-1">
                                                        Booking Interval (min)
                                                    </label>
                                                    <input
                                                        type="number"
                                                        name="booking_interval"
                                                        value={formData.booking_interval}
                                                        onChange={handleInputChange}
                                                        min="5"
                                                        max="120"
                                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                                                        placeholder="15"
                                                    />
                                                    <p className="text-xs text-gray-500 mt-1">Minutes between bookings in group</p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Break Time Section - Single Mode */}
                                        <div className="border-t border-gray-200 pt-4">
                                            <div className="flex items-center justify-between mb-3">
                                                <label className="block text-sm font-medium text-gray-700">
                                                    Break Times
                                                </label>
                                                <StandardButton
                                                    type="button"
                                                    onClick={() => setShowBreakTimeForm(!showBreakTimeForm)}
                                                    variant="secondary"
                                                    size="sm"
                                                    icon={showBreakTimeForm ? X : Plus}
                                                >
                                                    {showBreakTimeForm ? 'Cancel' : 'Add Break Time'}
                                                </StandardButton>
                                            </div>

                                            {/* Existing Break Times */}
                                            {formData.break_time.length > 0 && (
                                                <div className="space-y-2 mb-3">
                                                    {formData.break_time.map((bt, index) => (
                                                        <div key={index} className={`flex items-center justify-between p-3 bg-${themeColor}-50 border border-${themeColor}-200 rounded-lg`}>
                                                            <div className="flex items-center gap-2">
                                                                <Clock className={`w-4 h-4 text-${fullColor}`} />
                                                                <div>
                                                                    <div className="text-sm font-medium text-gray-900">
                                                                        {formatTime12Hour(bt.start_time)} - {formatTime12Hour(bt.end_time)}
                                                                    </div>
                                                                    <div className="text-xs text-gray-500">
                                                                        {bt.days.map(d => d.charAt(0).toUpperCase() + d.slice(1, 3)).join(', ')}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <StandardButton
                                                                type="button"
                                                                onClick={() => removeBreakTime(index, false)}
                                                                variant="danger"
                                                                size="sm"
                                                                icon={Trash2}
                                                                className="p-1.5"
                                                            />
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {/* Add Break Time Form */}
                                            {showBreakTimeForm && (
                                                <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg space-y-3">
                                                    <div>
                                                        <div className="flex items-center justify-between mb-2">
                                                            <label className="block text-xs font-medium text-gray-600">Select Days</label>
                                                            <button
                                                                type="button"
                                                                onClick={selectAllBreakTimeDays}
                                                                className={`text-xs font-medium px-2 py-1 rounded transition-colors ${
                                                                    DAYS_OF_WEEK.every(d => newBreakTime.days.includes(d.value))
                                                                        ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                                                        : `bg-${themeColor}-100 text-${fullColor} hover:bg-${themeColor}-200`
                                                                }`}
                                                            >
                                                                {DAYS_OF_WEEK.every(d => newBreakTime.days.includes(d.value)) ? 'Deselect All' : 'Select All'}
                                                            </button>
                                                        </div>
                                                        <div className="flex flex-wrap gap-2">
                                                            {DAYS_OF_WEEK.map(day => (
                                                                <button
                                                                    key={day.value}
                                                                    type="button"
                                                                    onClick={() => toggleBreakTimeDay(day.value)}
                                                                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                                                                        newBreakTime.days.includes(day.value)
                                                                            ? `bg-${fullColor} text-white`
                                                                            : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100'
                                                                    }`}
                                                                >
                                                                    {day.label}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <div>
                                                            <label className="block text-xs font-medium text-gray-600 mb-1">Start Time</label>
                                                            <input
                                                                type="time"
                                                                value={newBreakTime.start_time}
                                                                onChange={(e) => setNewBreakTime(prev => ({ ...prev, start_time: e.target.value }))}
                                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="block text-xs font-medium text-gray-600 mb-1">End Time</label>
                                                            <input
                                                                type="time"
                                                                value={newBreakTime.end_time}
                                                                onChange={(e) => setNewBreakTime(prev => ({ ...prev, end_time: e.target.value }))}
                                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                            />
                                                        </div>
                                                    </div>
                                                    <StandardButton
                                                        type="button"
                                                        onClick={() => addBreakTime(false)}
                                                        variant="primary"
                                                        size="sm"
                                                        className="w-full"
                                                        icon={Plus}
                                                    >
                                                        Add This Break Time
                                                    </StandardButton>
                                                </div>
                                            )}
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        {/* Multiple Rooms Form */}
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Base Name *
                                            </label>
                                            <input
                                                type="text"
                                                value={bulkFormData.baseName}
                                                onChange={(e) => setBulkFormData({ ...bulkFormData, baseName: e.target.value })}
                                                required
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                placeholder="e.g., Table"
                                            />
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                                    Suffix Type *
                                                </label>
                                                <select
                                                    value={bulkFormData.suffixType}
                                                    onChange={(e) => setBulkFormData({ ...bulkFormData, suffixType: e.target.value as 'number' | 'letter' })}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                >
                                                    <option value="number">Number</option>
                                                    <option value="letter">Letter</option>
                                                </select>
                                            </div>

                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                                    Count *
                                                </label>
                                                <input
                                                    type="number"
                                                    value={bulkFormData.count}
                                                    onChange={(e) => setBulkFormData({ ...bulkFormData, count: parseInt(e.target.value) || 1 })}
                                                    min="1"
                                                    max="50"
                                                    required
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Start {bulkFormData.suffixType === 'number' ? 'Number' : 'Letter'} *
                                            </label>
                                            {bulkFormData.suffixType === 'number' ? (
                                                <input
                                                    type="number"
                                                    value={bulkFormData.startNumber}
                                                    onChange={(e) => setBulkFormData({ ...bulkFormData, startNumber: parseInt(e.target.value) || 1 })}
                                                    min="1"
                                                    required
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                />
                                            ) : (
                                                <input
                                                    type="text"
                                                    value={bulkFormData.startLetter}
                                                    onChange={(e) => {
                                                        const val = e.target.value.toUpperCase();
                                                        if (val.length <= 1 && /^[A-Z]?$/.test(val)) {
                                                            setBulkFormData({ ...bulkFormData, startLetter: val || 'A' });
                                                        }
                                                    }}
                                                    maxLength={1}
                                                    required
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                    placeholder="A"
                                                />
                                            )}
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Capacity (people)
                                            </label>
                                            <input
                                                type="number"
                                                value={bulkFormData.capacity}
                                                onChange={(e) => setBulkFormData({ ...bulkFormData, capacity: e.target.value })}
                                                min="1"
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                placeholder="Enter capacity for all Spaces"
                                            />
                                        </div>

                                        <div className="flex items-center">
                                            <input
                                                type="checkbox"
                                                checked={bulkFormData.is_available}
                                                onChange={(e) => setBulkFormData({ ...bulkFormData, is_available: e.target.checked })}
                                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                            />
                                            <label className="ml-2 block text-sm text-gray-900">
                                                Available for booking
                                            </label>
                                        </div>

                                        {/* Area Group & Booking Interval Section - Bulk Mode */}
                                        <div className="border-t border-gray-200 pt-4">
                                            <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                                                <Layers className="w-4 h-4" />
                                                Stagger Booking Settings (applies to all)
                                            </h4>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-xs font-medium text-gray-600 mb-1">
                                                        Area Group
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={bulkFormData.area_group}
                                                        onChange={(e) => setBulkFormData({ ...bulkFormData, area_group: e.target.value })}
                                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                                                        placeholder="e.g., Zone A"
                                                    />
                                                    <p className="text-xs text-gray-500 mt-1">Rooms in the same group share stagger rules</p>
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-gray-600 mb-1">
                                                        Booking Interval (min)
                                                    </label>
                                                    <input
                                                        type="number"
                                                        value={bulkFormData.booking_interval}
                                                        onChange={(e) => setBulkFormData({ ...bulkFormData, booking_interval: e.target.value })}
                                                        min="5"
                                                        max="120"
                                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                                                        placeholder="15"
                                                    />
                                                    <p className="text-xs text-gray-500 mt-1">Minutes between bookings in group</p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Break Time Section - Bulk Mode */}
                                        <div className="border-t border-gray-200 pt-4">
                                            <div className="flex items-center justify-between mb-3">
                                                <label className="block text-sm font-medium text-gray-700">
                                                    Break Times (applies to all)
                                                </label>
                                                <StandardButton
                                                    type="button"
                                                    onClick={() => setShowBreakTimeForm(!showBreakTimeForm)}
                                                    variant="secondary"
                                                    size="sm"
                                                    icon={showBreakTimeForm ? X : Plus}
                                                >
                                                    {showBreakTimeForm ? 'Cancel' : 'Add Break Time'}
                                                </StandardButton>
                                            </div>

                                            {/* Existing Break Times */}
                                            {bulkFormData.break_time.length > 0 && (
                                                <div className="space-y-2 mb-3">
                                                    {bulkFormData.break_time.map((bt, index) => (
                                                        <div key={index} className={`flex items-center justify-between p-3 bg-${themeColor}-50 border border-${themeColor}-200 rounded-lg`}>
                                                            <div className="flex items-center gap-2">
                                                                <Clock className={`w-4 h-4 text-${fullColor}`} />
                                                                <div>
                                                                    <div className="text-sm font-medium text-gray-900">
                                                                        {formatTime12Hour(bt.start_time)} - {formatTime12Hour(bt.end_time)}
                                                                    </div>
                                                                    <div className="text-xs text-gray-500">
                                                                        {bt.days.map(d => d.charAt(0).toUpperCase() + d.slice(1, 3)).join(', ')}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <StandardButton
                                                                type="button"
                                                                onClick={() => removeBreakTime(index, true)}
                                                                variant="danger"
                                                                size="sm"
                                                                icon={Trash2}
                                                                className="p-1.5"
                                                            />
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {/* Add Break Time Form */}
                                            {showBreakTimeForm && (
                                                <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg space-y-3">
                                                    <div>
                                                        <div className="flex items-center justify-between mb-2">
                                                            <label className="block text-xs font-medium text-gray-600">Select Days</label>
                                                            <button
                                                                type="button"
                                                                onClick={selectAllBreakTimeDays}
                                                                className={`text-xs font-medium px-2 py-1 rounded transition-colors ${
                                                                    DAYS_OF_WEEK.every(d => newBreakTime.days.includes(d.value))
                                                                        ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                                                        : `bg-${themeColor}-100 text-${fullColor} hover:bg-${themeColor}-200`
                                                                }`}
                                                            >
                                                                {DAYS_OF_WEEK.every(d => newBreakTime.days.includes(d.value)) ? 'Deselect All' : 'Select All'}
                                                            </button>
                                                        </div>
                                                        <div className="flex flex-wrap gap-2">
                                                            {DAYS_OF_WEEK.map(day => (
                                                                <button
                                                                    key={day.value}
                                                                    type="button"
                                                                    onClick={() => toggleBreakTimeDay(day.value)}
                                                                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                                                                        newBreakTime.days.includes(day.value)
                                                                            ? `bg-${fullColor} text-white`
                                                                            : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100'
                                                                    }`}
                                                                >
                                                                    {day.label}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <div>
                                                            <label className="block text-xs font-medium text-gray-600 mb-1">Start Time</label>
                                                            <input
                                                                type="time"
                                                                value={newBreakTime.start_time}
                                                                onChange={(e) => setNewBreakTime(prev => ({ ...prev, start_time: e.target.value }))}
                                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="block text-xs font-medium text-gray-600 mb-1">End Time</label>
                                                            <input
                                                                type="time"
                                                                value={newBreakTime.end_time}
                                                                onChange={(e) => setNewBreakTime(prev => ({ ...prev, end_time: e.target.value }))}
                                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                            />
                                                        </div>
                                                    </div>
                                                    <StandardButton
                                                        type="button"
                                                        onClick={() => addBreakTime(true)}
                                                        variant="primary"
                                                        size="sm"
                                                        className="w-full"
                                                        icon={Plus}
                                                    >
                                                        Add This Break Time
                                                    </StandardButton>
                                                </div>
                                            )}
                                        </div>

                                        {/* Preview */}
                                        {bulkFormData.baseName && generateRoomPreview().length > 0 && (
                                            <div className={`bg-${themeColor}-50 border border-${fullColor} rounded-lg p-4`}>
                                                <p className="text-sm font-medium text-gray-700 mb-2">
                                                    Preview ({generateRoomPreview().length} rooms):
                                                </p>
                                                <div className="flex flex-wrap gap-2">
                                                    {generateRoomPreview().slice(0, 10).map((name, idx) => (
                                                        <span
                                                            key={idx}
                                                            className={`px-2 py-1 bg-${fullColor} text-white text-xs rounded-lg`}
                                                        >
                                                            {name}
                                                        </span>
                                                    ))}
                                                    {generateRoomPreview().length > 10 && (
                                                        <span className="px-2 py-1 bg-gray-200 text-gray-600 text-xs rounded-lg">
                                                            +{generateRoomPreview().length - 10} more
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}

                                <div className="flex gap-3 pt-4">
                                    <StandardButton
                                        type="submit"
                                        variant="primary"
                                        size="md"
                                        className="flex-1"
                                    >
                                        {creationMode === 'single' ? 'Create Room' : `Create ${generateRoomPreview().length} Rooms`}
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
            {showEditModal && selectedRoom && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={() => setShowEditModal(false)}>
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
                        <div className="p-6 overflow-y-auto flex-1">
                            <h2 className="text-xl font-semibold text-gray-900 mb-4">Edit Space</h2>
                            <form onSubmit={handleUpdateRoom} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Space Name *
                                    </label>
                                    <input
                                        type="text"
                                        name="name"
                                        value={formData.name}
                                        onChange={handleInputChange}
                                        required
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        placeholder="Enter Space name"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Capacity (people)
                                    </label>
                                    <input
                                        type="number"
                                        name="capacity"
                                        value={formData.capacity}
                                        onChange={handleInputChange}
                                        min="1"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        placeholder="Enter capacity"
                                    />
                                </div>

                                <div className="flex items-center">
                                    <input
                                        type="checkbox"
                                        name="is_available"
                                        checked={formData.is_available}
                                        onChange={handleInputChange}
                                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                    />
                                    <label className="ml-2 block text-sm text-gray-900">
                                        Available for booking
                                    </label>
                                </div>

                                {/* Area Group & Booking Interval Section - Edit Modal */}
                                <div className="border-t border-gray-200 pt-4">
                                    <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                                        <Layers className="w-4 h-4" />
                                        Stagger Booking Settings
                                    </h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-medium text-gray-600 mb-1">
                                                Area Group
                                            </label>
                                            <input
                                                type="text"
                                                name="area_group"
                                                value={formData.area_group}
                                                onChange={handleInputChange}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                                                placeholder="e.g., Zone A"
                                            />
                                            <p className="text-xs text-gray-500 mt-1">Rooms in same group share stagger rules</p>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-gray-600 mb-1">
                                                Booking Interval (min)
                                            </label>
                                            <input
                                                type="number"
                                                name="booking_interval"
                                                value={formData.booking_interval}
                                                onChange={handleInputChange}
                                                min="5"
                                                max="120"
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                                                placeholder="15"
                                            />
                                            <p className="text-xs text-gray-500 mt-1">Minutes between bookings</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Break Time Section - Edit Modal */}
                                <div className="border-t border-gray-200 pt-4">
                                    <div className="flex items-center justify-between mb-3">
                                        <label className="block text-sm font-medium text-gray-700">
                                            Break Times
                                        </label>
                                        <StandardButton
                                            type="button"
                                            onClick={() => setShowBreakTimeForm(!showBreakTimeForm)}
                                            variant="secondary"
                                            size="sm"
                                            icon={showBreakTimeForm ? X : Plus}
                                        >
                                            {showBreakTimeForm ? 'Cancel' : 'Add Break Time'}
                                        </StandardButton>
                                    </div>

                                    {/* Existing Break Times */}
                                    {formData.break_time.length > 0 && (
                                        <div className="space-y-2 mb-3">
                                            {formData.break_time.map((bt, index) => (
                                                <div key={index} className={`flex items-center justify-between p-3 bg-${themeColor}-50 border border-${themeColor}-200 rounded-lg`}>
                                                    <div className="flex items-center gap-2">
                                                        <Clock className={`w-4 h-4 text-${fullColor}`} />
                                                        <div>
                                                            <div className="text-sm font-medium text-gray-900">
                                                                {formatTime12Hour(bt.start_time)} - {formatTime12Hour(bt.end_time)}
                                                            </div>
                                                            <div className="text-xs text-gray-500">
                                                                {bt.days.map(d => d.charAt(0).toUpperCase() + d.slice(1, 3)).join(', ')}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <StandardButton
                                                        type="button"
                                                        onClick={() => removeBreakTime(index, false)}
                                                        variant="danger"
                                                        size="sm"
                                                        icon={Trash2}
                                                        className="p-1.5"
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Add Break Time Form */}
                                    {showBreakTimeForm && (
                                        <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg space-y-3">
                                            <div>
                                                <div className="flex items-center justify-between mb-2">
                                                    <label className="block text-xs font-medium text-gray-600">Select Days</label>
                                                    <button
                                                        type="button"
                                                        onClick={selectAllBreakTimeDays}
                                                        className={`text-xs font-medium px-2 py-1 rounded transition-colors ${
                                                            DAYS_OF_WEEK.every(d => newBreakTime.days.includes(d.value))
                                                                ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                                                : `bg-${themeColor}-100 text-${fullColor} hover:bg-${themeColor}-200`
                                                        }`}
                                                    >
                                                        {DAYS_OF_WEEK.every(d => newBreakTime.days.includes(d.value)) ? 'Deselect All' : 'Select All'}
                                                    </button>
                                                </div>
                                                <div className="flex flex-wrap gap-2">
                                                    {DAYS_OF_WEEK.map(day => (
                                                        <button
                                                            key={day.value}
                                                            type="button"
                                                            onClick={() => toggleBreakTimeDay(day.value)}
                                                            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                                                                newBreakTime.days.includes(day.value)
                                                                    ? `bg-${fullColor} text-white`
                                                                    : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100'
                                                            }`}
                                                        >
                                                            {day.label}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <label className="block text-xs font-medium text-gray-600 mb-1">Start Time</label>
                                                    <input
                                                        type="time"
                                                        value={newBreakTime.start_time}
                                                        onChange={(e) => setNewBreakTime(prev => ({ ...prev, start_time: e.target.value }))}
                                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-gray-600 mb-1">End Time</label>
                                                    <input
                                                        type="time"
                                                        value={newBreakTime.end_time}
                                                        onChange={(e) => setNewBreakTime(prev => ({ ...prev, end_time: e.target.value }))}
                                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                    />
                                                </div>
                                            </div>
                                            <StandardButton
                                                type="button"
                                                onClick={() => addBreakTime(false)}
                                                variant="primary"
                                                size="sm"
                                                className="w-full"
                                                icon={Plus}
                                            >
                                                Add This Break Time
                                            </StandardButton>
                                        </div>
                                    )}
                                </div>

                                <div className="flex gap-3 pt-4">
                                    <StandardButton
                                        type="submit"
                                        variant="primary"
                                        size="md"
                                        className="flex-1"
                                    >
                                        Update Room
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

            {/* Area Group Settings Modal */}
            {showAreaGroupModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={() => setShowAreaGroupModal(false)}>
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
                        <div className="p-6">
                            <div className="flex items-center gap-3 mb-4">
                                <div className={`w-10 h-10 rounded-full bg-${themeColor}-100 flex items-center justify-center`}>
                                    <Layers className={`w-5 h-5 text-${fullColor}`} />
                                </div>
                                <div>
                                    <h2 className="text-xl font-semibold text-gray-900">Area Group Settings</h2>
                                    <p className="text-sm text-gray-500">Update booking interval for all rooms in an area group</p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Select Area Group
                                    </label>
                                    <select
                                        value={selectedAreaGroup}
                                        onChange={(e) => {
                                            setSelectedAreaGroup(e.target.value);
                                            // Set the current interval for this group
                                            const roomInGroup = rooms.find(r => r.area_group === e.target.value);
                                            if (roomInGroup?.booking_interval) {
                                                setAreaGroupInterval(roomInGroup.booking_interval.toString());
                                            }
                                        }}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    >
                                        <option value="">-- Select an area group --</option>
                                        {getUniqueAreaGroups().map(group => {
                                            const roomCount = rooms.filter(r => r.area_group === group).length;
                                            return (
                                                <option key={group} value={group}>
                                                    {group} ({roomCount} room{roomCount !== 1 ? 's' : ''})
                                                </option>
                                            );
                                        })}
                                    </select>
                                </div>

                                {selectedAreaGroup && (
                                    <>
                                        <div className={`p-3 bg-${themeColor}-50 border border-${themeColor}-200 rounded-lg`}>
                                            <div className="flex items-center gap-2 mb-2">
                                                <Timer className={`w-4 h-4 text-${fullColor}`} />
                                                <span className="text-sm font-medium text-gray-700">Rooms in "{selectedAreaGroup}":</span>
                                            </div>
                                            <div className="flex flex-wrap gap-1">
                                                {rooms
                                                    .filter(r => r.area_group === selectedAreaGroup)
                                                    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }))
                                                    .map(room => (
                                                        <span key={room.id} className={`px-2 py-0.5 bg-${fullColor} text-white text-xs rounded`}>
                                                            {room.name}
                                                        </span>
                                                    ))
                                                }
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Booking Interval (minutes)
                                            </label>
                                            <input
                                                type="number"
                                                value={areaGroupInterval}
                                                onChange={(e) => setAreaGroupInterval(e.target.value)}
                                                min="0"
                                                max="120"
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                placeholder="15"
                                            />
                                            <p className="text-xs text-gray-500 mt-1">
                                                Time gap required between bookings in this area group. Set to 0 to allow simultaneous bookings.
                                            </p>
                                        </div>
                                    </>
                                )}

                                <div className="flex gap-3 pt-4">
                                    <StandardButton
                                        onClick={handleAreaGroupIntervalUpdate}
                                        variant="primary"
                                        size="md"
                                        className="flex-1"
                                        disabled={!selectedAreaGroup}
                                    >
                                        Update All Rooms
                                    </StandardButton>
                                    <StandardButton
                                        onClick={() => {
                                            setShowAreaGroupModal(false);
                                            setSelectedAreaGroup('');
                                            setAreaGroupInterval('15');
                                        }}
                                        variant="secondary"
                                        size="md"
                                        className="flex-1"
                                    >
                                        Cancel
                                    </StandardButton>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Rooms;
