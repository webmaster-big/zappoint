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

export interface TimeSlot {
  start_time: string;
  end_time: string;
  duration: number;
  duration_unit: string;
}

export interface BookedSlot {
  time_slot_start: string;
  duration: number;
  duration_unit: string;
}

export interface AvailableSlotsResponse {
  success: boolean;
  data: {
    available_slots: TimeSlot[];
    booked_slots: BookedSlot[];
  };
}

export interface AvailableSlotsRequest {
  package_id: number;
  room_id: number;
  date: string;
}

const timeSlotService = {
  /**
   * Get available time slots for a package, room, and date via SSE
   * Returns an EventSource for real-time updates
   */
  getAvailableSlotsSSE(params: AvailableSlotsRequest): EventSource {
    // Get JWT token from localStorage
    const token = getStoredUser()?.token;
    
    // Build URL with auth token as query parameter (EventSource doesn't support custom headers)
    let url = `${API_BASE_URL}/package-time-slots/available-slots/${params.package_id}/${params.room_id}/${params.date}`;
    
    if (token) {
      url += `?token=${encodeURIComponent(token)}`;
    }
    
    return new EventSource(url);
  },

  /**
   * Get available time slots for a package, room, and date (one-time fetch)
   * Use this for initial load or when SSE is not needed
   */
  async getAvailableSlots(params: AvailableSlotsRequest): Promise<AvailableSlotsResponse> {
    const response = await api.get(
      `/package-time-slots/available-slots/${params.package_id}/${params.room_id}/${params.date}`
    );
    return response.data;
  },
};

export default timeSlotService;
