import axios from 'axios';
import { API_BASE_URL, getStoredUser } from './../utils/storage';


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
    async getCategories() {
        const response = await api.get('/categories');
        console.log('CategoryService - Fetched categories:', response.data);
        return response.data;
    }

    async getCategory(id: number) {
        const response = await api.get(`/categories/${id}`);
        return response.data;
    }

    async createCategory(data: CreateCategoryData) {
        const response = await api.post('/categories', data);
        return response.data;
    }

    async updateCategory(id: number, data: UpdateCategoryData) {
        const response = await api.put(`/categories/${id}`, data);
        return response.data;
    }

    async deleteCategory(id: number) {
        const response = await api.delete(`/categories/${id}`);
        return response.data;
    }
}

export const categoryService = new CategoryService();
