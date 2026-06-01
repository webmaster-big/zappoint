import axios from 'axios';
import { API_BASE_URL, getStoredUser } from '../utils/storage';

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

export interface TimeSlot {
  start_time: string;
  end_time: string;
  duration: number;
  duration_unit: string;
  room_id?: number;
  room_name?: string;
  available_rooms_count?: number;
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
  date: string;
}

const timeSlotService = {
  getAvailableSlotsSSE(params: AvailableSlotsRequest): EventSource {
    const token = getStoredUser()?.token;
    
    let url = `${API_BASE_URL}/package-time-slots/available-slots/${params.package_id}/${params.date}`;
    
    if (token) {
      url += `?token=${encodeURIComponent(token)}`;
    }
    
    return new EventSource(url);
  },

  async getAvailableSlots(params: AvailableSlotsRequest): Promise<AvailableSlotsResponse> {
    const response = await api.get(
      `/package-time-slots/available-slots/${params.package_id}/${params.date}`
    );
    return response.data;
  },
};

export default timeSlotService;
