import axios from 'axios';
import { API_BASE_URL, getStoredUser } from '../utils/storage';
import type { GlobalNote, CreateGlobalNoteData, UpdateGlobalNoteData, GlobalNoteFilters } from '../types/globalNotes.types';

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

// API Response types
interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

class GlobalNoteService {
  /**
   * Get all global notes with optional filters
   */
  async getGlobalNotes(filters?: GlobalNoteFilters): Promise<ApiResponse<GlobalNote[]>> {
    const params = new URLSearchParams();
    
    if (filters?.is_active !== undefined) {
      params.append('is_active', String(filters.is_active));
    }
    if (filters?.package_id !== undefined) {
      params.append('package_id', String(filters.package_id));
    }
    
    const response = await api.get(`/global-notes?${params.toString()}`);
    return response.data;
  }

  /**
   * Get notes for a specific package (including global notes that apply to it)
   */
  async getNotesForPackage(packageId: number): Promise<ApiResponse<GlobalNote[]>> {
    const response = await api.get(`/global-notes/package/${packageId}`);
    return response.data;
  }

  /**
   * Get a single global note by ID
   */
  async getGlobalNote(id: number): Promise<ApiResponse<GlobalNote>> {
    const response = await api.get(`/global-notes/${id}`);
    return response.data;
  }

  /**
   * Create a new global note
   */
  async createGlobalNote(data: CreateGlobalNoteData): Promise<ApiResponse<GlobalNote>> {
    const response = await api.post('/global-notes', data);
    return response.data;
  }

  /**
   * Update an existing global note
   */
  async updateGlobalNote(id: number, data: UpdateGlobalNoteData): Promise<ApiResponse<GlobalNote>> {
    const response = await api.put(`/global-notes/${id}`, data);
    return response.data;
  }

  /**
   * Delete a global note
   */
  async deleteGlobalNote(id: number): Promise<ApiResponse<null>> {
    const response = await api.delete(`/global-notes/${id}`);
    return response.data;
  }

  /**
   * Toggle the active status of a global note
   */
  async toggleStatus(id: number): Promise<ApiResponse<GlobalNote>> {
    const response = await api.patch(`/global-notes/${id}/toggle-status`);
    return response.data;
  }
}

export const globalNoteService = new GlobalNoteService();
export type { GlobalNote, CreateGlobalNoteData, UpdateGlobalNoteData, GlobalNoteFilters };
