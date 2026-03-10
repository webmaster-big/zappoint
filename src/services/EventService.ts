import axios from 'axios';
import { API_BASE_URL, getStoredUser } from '../utils/storage';
import type {
  Event,
  CreateEventData,
  UpdateEventData,
  EventFilters,
} from '../types/event.types';

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
  (error) => Promise.reject(error)
);

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

class EventService {
  /** List all events (admin) */
  async getEvents(filters?: EventFilters): Promise<ApiResponse<Event[]>> {
    const response = await api.get('/events', { params: filters });
    return response.data;
  }

  /** Get a single event */
  async getEvent(id: number): Promise<ApiResponse<Event>> {
    const response = await api.get(`/events/${id}`);
    return response.data;
  }

  /** Create a new event */
  async createEvent(data: CreateEventData): Promise<ApiResponse<Event>> {
    const response = await api.post('/events', data);
    return response.data;
  }

  /** Update an event */
  async updateEvent(id: number, data: UpdateEventData): Promise<ApiResponse<Event>> {
    const response = await api.put(`/events/${id}`, data);
    return response.data;
  }

  /** Delete an event (soft delete) */
  async deleteEvent(id: number): Promise<ApiResponse<null>> {
    const response = await api.delete(`/events/${id}`);
    return response.data;
  }

  /** Toggle event active/inactive */
  async toggleStatus(id: number): Promise<ApiResponse<Event>> {
    const response = await api.patch(`/events/${id}/toggle-status`);
    return response.data;
  }

  /** Get active events for a location (public) */
  async getEventsByLocation(locationId: number): Promise<ApiResponse<Event[]>> {
    const response = await api.get(`/events/location/${locationId}`);
    return response.data;
  }

  /** Get a single event (public) – fetches from grouped-by-name and finds the matching event_id */
  async getPublicEvent(eventId: number): Promise<ApiResponse<Event>> {
    const response = await api.get('/events/grouped-by-name');
    const groups = response.data?.data || [];
    for (const group of groups) {
      const loc = group.locations?.find((l: { event_id: number }) => l.event_id === eventId);
      if (loc) {
        return {
          success: true,
          data: {
            id: eventId,
            name: group.name,
            description: group.description,
            image: group.image,
            date_type: group.date_type,
            start_date: group.start_date,
            end_date: group.end_date,
            time_start: group.time_start,
            time_end: group.time_end,
            interval_minutes: group.interval_minutes,
            max_bookings_per_slot: group.max_bookings_per_slot,
            price: group.price,
            features: group.features,
            location_id: loc.location_id,
            location: { id: loc.location_id, name: loc.location_name },
            is_active: true,
            add_ons: loc.add_ons || [],
            add_ons_order: (loc.add_ons || []).map((a: { id: number }) => a.id),
          } as Event,
        };
      }
    }
    return { success: false, data: null as unknown as Event, message: 'Event not found' };
  }

  /** Get available dates for an event (public) */
  async getAvailableDates(eventId: number): Promise<{ dates: string[] }> {
    const response = await api.get(`/events/${eventId}/available-dates`);
    return response.data;
  }

  /** Get available time slots for a specific date (public) */
  async getAvailableTimeSlots(eventId: number, date: string): Promise<{ date: string; time_slots: string[] }> {
    const response = await api.get(`/events/${eventId}/available-time-slots/${date}`);
    return response.data;
  }
}

export const eventService = new EventService();
export default eventService;
