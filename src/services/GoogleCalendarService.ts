import axios from 'axios';
import { API_BASE_URL, getStoredUser } from '../utils/storage';
import type {
  GoogleCalendarStatus,
  GoogleCalendarAuthUrl,
  GoogleCalendar,
  GoogleCalendarSyncResult,
  GoogleCalendarResyncResult,
  GoogleCalendarSetCalendarData,
  GoogleCalendarSyncData,
  GoogleCalendarConnection,
} from '../types/googleCalendar.types';
import type { SettingsApiResponse } from '../types/settings.types';

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

export const getGoogleCalendarStatus = async (
  locationId: number
): Promise<SettingsApiResponse<GoogleCalendarStatus>> => {
  const response = await api.get<SettingsApiResponse<GoogleCalendarStatus>>(
    '/google-calendar/status',
    { params: { location_id: locationId } }
  );
  return response.data;
};

export const getGoogleCalendarAuthUrl = async (
  locationId: number
): Promise<SettingsApiResponse<GoogleCalendarAuthUrl>> => {
  const response = await api.get<SettingsApiResponse<GoogleCalendarAuthUrl>>(
    '/google-calendar/auth-url',
    { params: { location_id: locationId } }
  );
  return response.data;
};

export const disconnectGoogleCalendar = async (
  locationId: number
): Promise<SettingsApiResponse> => {
  const response = await api.post<SettingsApiResponse>(
    '/google-calendar/disconnect',
    { location_id: locationId }
  );
  return response.data;
};

export const listGoogleCalendars = async (
  locationId: number
): Promise<SettingsApiResponse<GoogleCalendar[]>> => {
  const response = await api.get<SettingsApiResponse<GoogleCalendar[]>>(
    '/google-calendar/calendars',
    { params: { location_id: locationId } }
  );
  return response.data;
};

export const setGoogleCalendar = async (
  data: GoogleCalendarSetCalendarData
): Promise<SettingsApiResponse> => {
  const response = await api.put<SettingsApiResponse>(
    '/google-calendar/calendar',
    data
  );
  return response.data;
};

export const syncGoogleCalendar = async (
  data: GoogleCalendarSyncData
): Promise<SettingsApiResponse<GoogleCalendarSyncResult>> => {
  const response = await api.post<SettingsApiResponse<GoogleCalendarSyncResult>>(
    '/google-calendar/sync',
    data
  );
  return response.data;
};

export const syncSingleBooking = async (
  bookingId: number
): Promise<SettingsApiResponse> => {
  const response = await api.post<SettingsApiResponse>(
    `/google-calendar/sync/${bookingId}`
  );
  return response.data;
};

export const resyncGoogleCalendar = async (
  data: GoogleCalendarSyncData
): Promise<SettingsApiResponse<GoogleCalendarResyncResult>> => {
  const response = await api.post<SettingsApiResponse<GoogleCalendarResyncResult>>(
    '/google-calendar/resync',
    data
  );
  return response.data;
};

export const removeBookingEvent = async (
  bookingId: number
): Promise<SettingsApiResponse> => {
  const response = await api.delete<SettingsApiResponse>(
    `/google-calendar/bookings/${bookingId}/event`
  );
  return response.data;
};

export const getAllGoogleCalendarConnections = async (): Promise<SettingsApiResponse<GoogleCalendarConnection[]>> => {
  const response = await api.get<SettingsApiResponse<GoogleCalendarConnection[]>>(
    '/google-calendar/connections'
  );
  return response.data;
};
