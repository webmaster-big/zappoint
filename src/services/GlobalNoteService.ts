import axios from 'axios';
import { API_BASE_URL, getStoredUser } from '../utils/storage';
import type { GlobalNote, CreateGlobalNoteData, UpdateGlobalNoteData, GlobalNoteFilters } from '../types/globalNotes.types';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

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

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

class GlobalNoteService {
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

  async getNotesForPackage(packageId: number): Promise<ApiResponse<GlobalNote[]>> {
    const response = await api.get(`/global-notes/package/${packageId}`);
    return response.data;
  }

  async getGlobalNote(id: number): Promise<ApiResponse<GlobalNote>> {
    const response = await api.get(`/global-notes/${id}`);
    return response.data;
  }

  async createGlobalNote(data: CreateGlobalNoteData): Promise<ApiResponse<GlobalNote>> {
    const response = await api.post('/global-notes', data);
    return response.data;
  }

  async updateGlobalNote(id: number, data: UpdateGlobalNoteData): Promise<ApiResponse<GlobalNote>> {
    const response = await api.put(`/global-notes/${id}`, data);
    return response.data;
  }

  async deleteGlobalNote(id: number): Promise<ApiResponse<null>> {
    const response = await api.delete(`/global-notes/${id}`);
    return response.data;
  }

  async toggleStatus(id: number): Promise<ApiResponse<GlobalNote>> {
    const response = await api.patch(`/global-notes/${id}/toggle-status`);
    return response.data;
  }
}

export const globalNoteService = new GlobalNoteService();
export type { GlobalNote, CreateGlobalNoteData, UpdateGlobalNoteData, GlobalNoteFilters };
