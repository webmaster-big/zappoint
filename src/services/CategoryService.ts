import axios from 'axios';
import { API_BASE_URL, getStoredUser } from './../utils/storage';


// // Create axios instance with base configuration
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
    console.log('BookingService - Adding auth token to request:', token);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export interface Category {
    id: number;
    name: string;
    description?: string;
    created_at?: string;
    updated_at?: string;
}

export interface CreateCategoryData {
    name: string;
    description?: string;
}

export interface UpdateCategoryData {
    name?: string;
    description?: string;
}

class CategoryService {
    // Get all categories
    async getCategories() {
        const response = await api.get('/categories');
        console.log('CategoryService - Fetched categories:', response.data);
        return response.data;
    }

    // Get single category
    async getCategory(id: number) {
        const response = await api.get(`/categories/${id}`);
        return response.data;
    }

    // Create category
    async createCategory(data: CreateCategoryData) {
        const response = await api.post('/categories', data);
        return response.data;
    }

    // Update category
    async updateCategory(id: number, data: UpdateCategoryData) {
        const response = await api.put(`/categories/${id}`, data);
        return response.data;
    }

    // Delete category
    async deleteCategory(id: number) {
        const response = await api.delete(`/categories/${id}`);
        return response.data;
    }
}

export const categoryService = new CategoryService();
