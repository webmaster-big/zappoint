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
  async getEvents(filters?: EventFilters): Promise<ApiResponse<Event[]>> {
    const response = await api.get('/events', { params: filters });
    return response.data;
  }

  async getEvent(id: number): Promise<ApiResponse<Event>> {
    const response = await api.get(`/events/${id}`);
    return response.data;
  }

  async createEvent(data: CreateEventData): Promise<ApiResponse<Event>> {
    const response = await api.post('/events', data);
    return response.data;
  }

  async updateEvent(id: number, data: UpdateEventData): Promise<ApiResponse<Event>> {
    const response = await api.put(`/events/${id}`, data);
    return response.data;
  }

  async deleteEvent(id: number): Promise<ApiResponse<null>> {
    const response = await api.delete(`/events/${id}`);
    return response.data;
  }

  async toggleStatus(id: number): Promise<ApiResponse<Event>> {
    const response = await api.patch(`/events/${id}/toggle-status`);
    return response.data;
  }

  async getEventsByLocation(locationId: number): Promise<ApiResponse<Event[]>> {
    const response = await api.get(`/events/location/${locationId}`);
    return response.data;
  }

  async getPublicEvent(eventId: number): Promise<ApiResponse<Event>> {
    // The grouped payload holds every event, so the storefront cache already has it —
    // fetching the whole catalog again to render one event page is pure waste.
    let groups: any[] = [];
    try {
      const { customerDataCacheService } = await import('./CustomerDataCacheService');
      groups = await customerDataCacheService.getGroupedEvents();
    } catch {
      groups = [];
    }

    if (!Array.isArray(groups) || groups.length === 0) {
      const response = await api.get('/events/grouped-by-name');
      groups = response.data?.data || [];
    }
    // The group's scalars belong to whichever row sorted first, so an event sold at
    // several venues would hand this page another venue's dates, times and price.
    const definedOnly = (o: Record<string, unknown>) =>
      Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));

    for (const group of groups) {
      const loc = group.locations?.find((l: { event_id: number }) => l.event_id === eventId);
      if (loc) {
        const src = { ...group, ...definedOnly(loc) };
        return {
          success: true,
          data: {
            id: eventId,
            name: group.name,
            description: src.description,
            image: loc.image || group.image,
            date_type: src.date_type,
            start_date: src.start_date,
            end_date: src.end_date,
            time_start: src.time_start,
            time_end: src.time_end,
            interval_minutes: src.interval_minutes,
            max_bookings_per_slot: src.max_bookings_per_slot,
            max_tickets_per_slot: src.max_tickets_per_slot,
            price: src.price,
            features: src.features,
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

  async getAvailableDates(eventId: number): Promise<{ dates: string[] }> {
    const response = await api.get(`/events/${eventId}/available-dates`);
    return response.data;
  }

  async getAvailableTimeSlots(eventId: number, date: string): Promise<{ date: string; time_slots: string[]; remaining_tickets?: Record<string, number> | null }> {
    const response = await api.get(`/events/${eventId}/available-time-slots/${date}`);
    return response.data;
  }
}

export const eventService = new EventService();
export default eventService;
