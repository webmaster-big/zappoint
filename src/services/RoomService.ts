import axios from 'axios';
import { API_BASE_URL, getStoredUser } from '../utils/storage';

// Create axios instance with base configuration
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

// Add request interceptor to include auth token
api.interceptors.request.use(
  (config) => {
    const token = getStoredUser()?.token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Types
export interface Room {
  id: number;
  location_id: number;
  name: string;
  capacity?: number;
  is_available: boolean;
  created_at: string;
  updated_at: string;
}

export interface RoomFilters {
  location_id?: number;
  is_available?: boolean;
  search?: string;
  sort_by?: 'name' | 'capacity' | 'created_at';
  sort_order?: 'asc' | 'desc';
  per_page?: number;
  page?: number;
  user_id?: number;
}

export interface CreateRoomData {
  location_id: number;
  name: string;
  capacity?: number;
  is_available?: boolean;
}

export type UpdateRoomData = Partial<CreateRoomData>;

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: {
    rooms: T[];
    pagination: {
      current_page: number;
      last_page: number;
      per_page: number;
      total: number;
      from: number;
      to: number;
    };
  };
}

class RoomService {
  /**
   * Get all rooms with optional filters
   */
  async getRooms(filters?: RoomFilters): Promise<PaginatedResponse<Room>> {
    const response = await api.get('/rooms', { params: filters });
    return response.data;
  }

  /**
   * Get a specific room by ID
   */
  async getRoom(id: number): Promise<ApiResponse<Room>> {
    const response = await api.get(`/rooms/${id}`);
    return response.data;
  }

  /**
   * Create a new room
   */
  async createRoom(data: CreateRoomData): Promise<ApiResponse<Room>> {
    const response = await api.post('/rooms', data);
    return response.data;
  }

  /**
   * Update an existing room
   */
  async updateRoom(id: number, data: UpdateRoomData): Promise<ApiResponse<Room>> {
    const response = await api.put(`/rooms/${id}`, data);
    return response.data;
  }

  /**
   * Delete a room
   */
  async deleteRoom(id: number): Promise<ApiResponse<null>> {
    const response = await api.delete(`/rooms/${id}`);
    return response.data;
  }

  /**
   * Bulk delete rooms
   */
  async bulkDeleteRooms(ids: number[]): Promise<ApiResponse<{ deleted_count: number }>> {
    const response = await api.post('/rooms/bulk-delete', { ids });
    return response.data;
  }
}

// Export a singleton instance
export const roomService = new RoomService();
export default roomService;
