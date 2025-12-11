import React, { useState, useEffect } from 'react';
import { Search, Edit2, Trash2, Users, MapPin, CheckSquare, Square, Plus, X } from 'lucide-react';
import Toast from '../../../components/ui/Toast';
import { roomService, locationService } from '../../../services';
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
        is_available: true
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
        is_available: true
    });

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
            
            const response = await roomService.getRooms(searchFilters);
            
            if (response.data) {
                setRooms(response.data.rooms || []);
                const pagination = response.data.pagination;
                setTotalPages(pagination?.last_page || 1);
            }
        } catch (error) {
            console.error('Error fetching rooms:', error);
            showToast('Error loading rooms', 'error');
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
            is_available: true
        });
        setBulkFormData({
            baseName: '',
            suffixType: 'number',
            count: 1,
            startNumber: 1,
            startLetter: 'A',
            capacity: '',
            is_available: true
        });
        setCreationMode('single');
        setSelectedRoom(null);
    };

    // Handle create room (single or bulk)
    const handleCreateRoom = async (e: React.FormEvent) => {
        e.preventDefault();
        
        try {
            // Use modal location for company_admin, default to 1 otherwise
            const locationId = isCompanyAdmin && modalLocationId ? modalLocationId : 1;
            
            if (creationMode === 'single') {
                await roomService.createRoom({
                    location_id: locationId,
                    name: formData.name,
                    capacity: formData.capacity ? parseInt(formData.capacity) : undefined,
                    is_available: formData.is_available
                });
                showToast('Room created successfully!', 'success');
            } else {
                // Bulk creation
                const roomsToCreate = generateRoomPreview();
                const capacity = bulkFormData.capacity ? parseInt(bulkFormData.capacity) : undefined;
                
                // Create rooms sequentially
                for (const roomName of roomsToCreate) {
                    await roomService.createRoom({
                        location_id: locationId,
                        name: roomName,
                        capacity: capacity,
                        is_available: bulkFormData.is_available
                    });
                }
                
                showToast(`${roomsToCreate.length} rooms created successfully!`, 'success');
            }
            
            setShowCreateModal(false);
            resetForm();
            fetchRooms();
        } catch (error) {
            console.error('Error creating room:', error);
            showToast('Error creating room(s)', 'error');
        }
    };

    // Handle update room
    const handleUpdateRoom = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedRoom) return;

        try {
            await roomService.updateRoom(selectedRoom.id, {
                name: formData.name,
                capacity: formData.capacity ? parseInt(formData.capacity) : undefined,
                is_available: formData.is_available
            });
            
            showToast('Room updated successfully!', 'success');
            setShowEditModal(false);
            resetForm();
            fetchRooms();
        } catch (error) {
            console.error('Error updating room:', error);
            showToast('Error updating room', 'error');
        }
    };

    // Handle delete room
    const handleDeleteRoom = async (roomId: number, roomName: string) => {
        if (!window.confirm(`Are you sure you want to delete "${roomName}"?`)) {
            return;
        }

        try {
            await roomService.deleteRoom(roomId);
            showToast('Room deleted successfully!', 'success');
            fetchRooms();
        } catch (error) {
            console.error('Error deleting room:', error);
            showToast('Error deleting room', 'error');
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
            showToast('Please select rooms to delete', 'info');
            return;
        }

        if (!window.confirm(`Are you sure you want to delete ${selectedRoomIds.size} room(s)?`)) {
            return;
        }

        try {
            await roomService.bulkDeleteRooms(Array.from(selectedRoomIds));
            showToast(`${selectedRoomIds.size} room(s) deleted successfully!`, 'success');
            setSelectedRoomIds(new Set());
            setSelectionMode(false);
            fetchRooms();
        } catch (error) {
            console.error('Error deleting rooms:', error);
            showToast('Error deleting rooms', 'error');
        }
    };

    // Handle edit click
    const handleEditClick = (room: Room) => {
        setSelectedRoom(room);
        setFormData({
            name: room.name,
            capacity: room.capacity?.toString() || '',
            is_available: room.is_available
        });
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
            <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Rooms</h1>
                    <p className="text-gray-600 mt-1">Manage your facility rooms and their availability</p>
                </div>
                <div className="flex items-center gap-2">
                    {rooms.length > 0 && (
                        <button
                            onClick={toggleSelectionMode}
                            className={`${
                                selectionMode 
                                    ? 'bg-gray-500 hover:bg-gray-600' 
                                    : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                            } text-white px-4 py-2 rounded-lg font-semibold whitespace-nowrap transition-colors flex items-center gap-2`}
                        >
                            {selectionMode ? <X className="w-4 h-4" /> : <CheckSquare className="w-4 h-4" />}
                            {selectionMode ? 'Cancel' : 'Select Rooms'}
                        </button>
                    )}
                    <button
                        onClick={() => {
                            resetForm();
                            setShowCreateModal(true);
                        }}
                        className={`bg-${fullColor} hover:bg-${themeColor}-900 text-white px-5 py-2 rounded-lg font-semibold whitespace-nowrap transition-colors flex items-center gap-2`}
                    >
                        <Plus className="w-5 h-5" />
                        Create Room
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
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
                                {selectedRoomIds.size} room{selectedRoomIds.size !== 1 ? 's' : ''} selected
                            </span>
                            {selectedRoomIds.size > 0 && (
                                <button
                                    onClick={handleBulkDelete}
                                    className="text-sm text-red-600 hover:text-red-700 font-medium flex items-center gap-1"
                                >
                                    <Trash2 className="w-4 h-4" />
                                    Delete {selectedRoomIds.size} room{selectedRoomIds.size !== 1 ? 's' : ''}
                                </button>
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
                                        placeholder="Search rooms by name..."
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
                                    <button 
                                        className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                                            filters.is_available === undefined 
                                                ? `bg-${fullColor} text-white` 
                                                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                                        }`}
                                        onClick={() => handleFilterChange('is_available', undefined)}
                                    >
                                        All
                                    </button>
                                    <button 
                                        className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                                            filters.is_available === true 
                                                ? `bg-${fullColor} text-white` 
                                                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                                        }`}
                                        onClick={() => handleFilterChange('is_available', true)}
                                    >
                                        Available
                                    </button>
                                    <button 
                                        className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                                            filters.is_available === false 
                                                ? `bg-${fullColor} text-white` 
                                                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                                        }`}
                                        onClick={() => handleFilterChange('is_available', false)}
                                    >
                                        Unavailable
                                    </button>
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
                                    <button
                                        onClick={() => handleFilterChange('sort_order', filters.sort_order === 'asc' ? 'desc' : 'asc')}
                                        className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm hover:bg-gray-50 transition-colors"
                                    >
                                        {filters.sort_order === 'asc' ? '↑ Asc' : '↓ Desc'}
                                    </button>
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
                                {rooms.map((room) => (
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
                                                    <button
                                                        onClick={() => handleEditClick(room)}
                                                        className={`p-1.5 text-${fullColor} hover:bg-${themeColor}-100 rounded transition-colors`}
                                                        title="Edit room"
                                                    >
                                                        <Edit2 className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteRoom(room.id, room.name)}
                                                        className="p-1.5 text-red-500 hover:bg-red-50 rounded transition-colors"
                                                        title="Delete room"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
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
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">No rooms found</h3>
                        <p className="text-gray-600 text-sm mb-6 text-center max-w-sm">
                            {searchTerm || filters.is_available !== undefined 
                                ? 'No rooms match your search criteria. Try adjusting your filters.'
                                : 'Get started by creating your first room for package bookings'}
                        </p>
                        <button
                            onClick={() => {
                                resetForm();
                                setShowCreateModal(true);
                            }}
                            className={`bg-${fullColor} hover:bg-${themeColor}-700 text-white px-6 py-2.5 rounded-lg font-semibold transition-colors`}
                        >
                            Create Room
                        </button>
                    </div>
                )}

                {/* Pagination */}
                {!loading && totalPages > 1 && (
                            <div className="flex items-center justify-center space-x-2 mt-6">
                                <button
                                    onClick={() => handlePageChange(currentPage - 1)}
                                    disabled={currentPage === 1}
                                    className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Previous
                                </button>
                                
                                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                    const page = i + 1;
                                    return (
                                        <button
                                            key={page}
                                            onClick={() => handlePageChange(page)}
                                            className={`px-3 py-2 text-sm font-medium rounded-md ${
                                                page === currentPage
                                                    ? `bg-${fullColor} text-white`
                                                    : 'text-gray-500 bg-white border border-gray-300 hover:bg-gray-50'
                                            }`}
                                        >
                                            {page}
                                        </button>
                                    );
                                })}
                                
                                <button
                                    onClick={() => handlePageChange(currentPage + 1)}
                                    disabled={currentPage === totalPages}
                                    className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Next
                                </button>
                            </div>
                        )}
            </div>

            {/* Create Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
                        <div className="p-6">
                            <h2 className="text-xl font-semibold text-gray-900 mb-4">Add New Room</h2>
                            
                            {/* Creation Mode Toggle */}
                            <div className="flex gap-2 mb-6 bg-gray-100 p-1 rounded-lg">
                                <button
                                    type="button"
                                    onClick={() => setCreationMode('single')}
                                    className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
                                        creationMode === 'single'
                                            ? `bg-${fullColor} text-white shadow-sm`
                                            : 'text-gray-600 hover:text-gray-900'
                                    }`}
                                >
                                    Single Room
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setCreationMode('multiple')}
                                    className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
                                        creationMode === 'multiple'
                                            ? `bg-${fullColor} text-white shadow-sm`
                                            : 'text-gray-600 hover:text-gray-900'
                                    }`}
                                >
                                    Multiple Rooms
                                </button>
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
                                                Room Name *
                                            </label>
                                            <input
                                                type="text"
                                                name="name"
                                                value={formData.name}
                                                onChange={handleInputChange}
                                                required
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                placeholder="Enter room name"
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
                                                placeholder="Enter capacity for all rooms"
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
                                    <button
                                        type="submit"
                                        className={`flex-1 bg-${fullColor} hover:bg-${themeColor}-700 text-white py-2 px-4 rounded-lg transition-colors`}
                                    >
                                        {creationMode === 'single' ? 'Create Room' : `Create ${generateRoomPreview().length} Rooms`}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowCreateModal(false);
                                            resetForm();
                                        }}
                                        className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-700 py-2 px-4 rounded-lg transition-colors"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Modal */}
            {showEditModal && selectedRoom && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
                        <div className="p-6">
                            <h2 className="text-xl font-semibold text-gray-900 mb-4">Edit Room</h2>
                            <form onSubmit={handleUpdateRoom} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Room Name *
                                    </label>
                                    <input
                                        type="text"
                                        name="name"
                                        value={formData.name}
                                        onChange={handleInputChange}
                                        required
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        placeholder="Enter room name"
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

                                <div className="flex gap-3 pt-4">
                                    <button
                                        type="submit"
                                        className={`flex-1 bg-${fullColor} hover:bg-${themeColor}-700 text-white py-2 px-4 rounded-lg transition-colors`}
                                    >
                                        Update Room
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowEditModal(false);
                                            resetForm();
                                        }}
                                        className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-700 py-2 px-4 rounded-lg transition-colors"
                                    >
                                        Cancel
                                    </button>
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
        </div>
    );
};

export default Rooms;
