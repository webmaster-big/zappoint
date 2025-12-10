import React, { useState, useEffect } from 'react';
import { Search, Edit2, Trash2, Users, MapPin, CheckSquare, Square } from 'lucide-react';
import Toast from '../../../components/ui/Toast';
import { roomService } from '../../../services';
import type { Room, RoomFilters } from '../../../services/RoomService';
import { useThemeColor } from '../../../hooks/useThemeColor';
import { getStoredUser } from '../../../utils/storage';
import { API_BASE_URL } from '../../../utils/storage';

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
    const [locations, setLocations] = useState<Array<{ id: number; name: string }>>([]);
    const [selectedLocationId, setSelectedLocationId] = useState<number | null>(null);

    // Form state for create/edit
    const [formData, setFormData] = useState({
        name: '',
        capacity: '',
        is_available: true
    });

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
        setSelectedRoom(null);
    };

    // Handle create room
    const handleCreateRoom = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            // Use selected location for company_admin, default to 1 otherwise
            const locationId = isCompanyAdmin && selectedLocationId ? selectedLocationId : 1;
            
            await roomService.createRoom({
                location_id: locationId,
                name: formData.name,
                capacity: formData.capacity ? parseInt(formData.capacity) : undefined,
                is_available: formData.is_available
            });
            
            showToast('Room created successfully!', 'success');
            setShowCreateModal(false);
            resetForm();
            fetchRooms();
        } catch (error) {
            console.error('Error creating room:', error);
            showToast('Error creating room', 'error');
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
        <div className="w-full mx-auto px-4 pb-6 flex flex-col items-center">
            <div className="bg-white rounded-xl p-6 w-full shadow-sm border border-gray-100 mt-8">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                    <div>
                        <h2 className="text-2xl font-semibold text-gray-900">Rooms</h2>
                        <p className="text-gray-500 mt-1">Manage your facility rooms and their availability</p>
                    </div>
                    <div className="flex gap-2">
                        {rooms.length > 0 && (
                            <button
                                onClick={toggleSelectionMode}
                                className={`${
                                    selectionMode 
                                        ? 'bg-gray-500 hover:bg-gray-600' 
                                        : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                                } text-white px-4 py-2 rounded-lg font-semibold whitespace-nowrap transition-colors`}
                            >
                                {selectionMode ? 'Cancel' : 'Select'}
                            </button>
                        )}
                        <button
                            onClick={() => {
                                resetForm();
                                setShowCreateModal(true);
                            }}
                            className={`bg-${fullColor} hover:bg-${themeColor}-900 text-white px-6 py-2 rounded-lg font-semibold whitespace-nowrap`}
                        >
                            Create Room
                        </button>
                    </div>
                </div>

                {/* Show create button if no rooms */}
                {(rooms == null || rooms.length === 0) && !loading ? (
                    <div className="flex flex-col items-center py-12">
                        <MapPin className="w-12 h-12 text-gray-400 mb-4" />
                        <div className="text-gray-400 mb-2">No rooms found</div>
                        <p className="text-gray-500 text-sm mb-4">Create your first room to get started</p>
                        <button
                            onClick={() => {
                                resetForm();
                                setShowCreateModal(true);
                            }}
                            className={`bg-${fullColor} hover:bg-${themeColor}-900 text-white px-6 py-2 rounded-lg font-semibold`}
                        >
                            Create Room
                        </button>
                    </div>
                ) : (
                    <>
                        {/* Bulk Actions Bar */}
                        {selectionMode && (
                            <div className={`mb-4 p-4 bg-${themeColor}-50 border border-${themeColor}-200 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3`}>
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={selectAllRooms}
                                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                                            selectedRoomIds.size === rooms.length
                                                ? `bg-${fullColor} text-white`
                                                : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                                        }`}
                                    >
                                        {selectedRoomIds.size === rooms.length ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                                        {selectedRoomIds.size === rooms.length ? 'Deselect All' : 'Select All'}
                                    </button>
                                    <span className="text-sm text-gray-700 font-medium">
                                        {selectedRoomIds.size} room{selectedRoomIds.size !== 1 ? 's' : ''} selected
                                    </span>
                                </div>
                                {selectedRoomIds.size > 0 && (
                                    <button
                                        onClick={handleBulkDelete}
                                        className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                        Delete Selected
                                    </button>
                                )}
                            </div>
                        )}

                        {/* Search and Filter Section */}
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

                        {/* Rooms Grid */}
                        {loading ? (
                            <div className="flex justify-center items-center py-12">
                                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-300"></div>
                            </div>
                        ) : rooms.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {rooms.map((room) => (
                                    <div 
                                        key={room.id} 
                                        className={`relative border rounded-xl p-5 transition-all ${
                                            selectionMode 
                                                ? 'cursor-pointer hover:shadow-lg' 
                                                : 'hover:shadow-md'
                                        } ${
                                            selectedRoomIds.has(room.id)
                                                ? `border-${fullColor} bg-${themeColor}-50 shadow-md`
                                                : 'border-gray-200'
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

                                        <div className="flex justify-between items-start mb-4">
                                            <div className="flex-1 min-w-0 pr-8">
                                                <h3 className="font-semibold text-lg text-gray-900 truncate">{room.name}</h3>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span
                                                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                                            room.is_available
                                                                ? 'bg-green-100 text-green-800'
                                                                : 'bg-red-100 text-red-800'
                                                        }`}
                                                    >
                                                        {room.is_available ? 'Available' : 'Unavailable'}
                                                    </span>
                                                </div>
                                            </div>
                                            {!selectionMode && (
                                                <div className="flex gap-2 ml-2">
                                                    <button
                                                        onClick={() => handleEditClick(room)}
                                                        className={`p-2 text-${fullColor} hover:bg-${themeColor}-50 rounded-lg transition-colors`}
                                                        title="Edit room"
                                                    >
                                                        <Edit2 className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteRoom(room.id, room.name)}
                                                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                        title="Delete room"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        <div className="space-y-3">
                                            {room.capacity && (
                                                <div className="flex items-center gap-2 text-sm text-gray-600">
                                                    <Users className="w-4 h-4" />
                                                    <span>Capacity: {room.capacity} people</span>
                                                </div>
                                            )}

                                            <div className="text-xs text-gray-500 pt-2 border-t">
                                                Created: {new Date(room.created_at).toLocaleDateString()}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-12 text-gray-500">
                                No rooms match your search criteria.
                            </div>
                        )}

                        {/* Pagination */}
                        {totalPages > 1 && (
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
                    </>
                )}
            </div>

            {/* Create Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
                        <div className="p-6">
                            <h2 className="text-xl font-semibold text-gray-900 mb-4">Add New Room</h2>
                            <form onSubmit={handleCreateRoom} className="space-y-4">
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
                                        Create Room
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
