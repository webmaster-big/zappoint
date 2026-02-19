import axios from 'axios';
import { API_BASE_URL, getStoredUser } from '../utils/storage';
import type {
  GoogleCalendarStatus,
  GoogleCalendarAuthUrl,
  GoogleCalendar,
  GoogleCalendarSyncResult,
  GoogleCalendarSetCalendarData,
  GoogleCalendarSyncData,
} from '../types/googleCalendar.types';
import type { SettingsApiResponse } from '../types/settings.types';

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

/**
 * Get Google Calendar connection status for a location
 */
export const getGoogleCalendarStatus = async (
  locationId: number
): Promise<SettingsApiResponse<GoogleCalendarStatus>> => {
  const response = await api.get<SettingsApiResponse<GoogleCalendarStatus>>(
    '/google-calendar/status',
    { params: { location_id: locationId } }
  );
  return response.data;
};

/**
 * Get Google OAuth authorization URL for a location
 */
export const getGoogleCalendarAuthUrl = async (
  locationId: number
): Promise<SettingsApiResponse<GoogleCalendarAuthUrl>> => {
  const response = await api.get<SettingsApiResponse<GoogleCalendarAuthUrl>>(
    '/google-calendar/auth-url',
    { params: { location_id: locationId } }
  );
  return response.data;
};

/**
 * Disconnect Google Calendar for a location
 */
export const disconnectGoogleCalendar = async (
  locationId: number
): Promise<SettingsApiResponse> => {
  const response = await api.post<SettingsApiResponse>(
    '/google-calendar/disconnect',
    { location_id: locationId }
  );
  return response.data;
};

/**
 * List available Google Calendars for a location
 */
export const listGoogleCalendars = async (
  locationId: number
): Promise<SettingsApiResponse<GoogleCalendar[]>> => {
  const response = await api.get<SettingsApiResponse<GoogleCalendar[]>>(
    '/google-calendar/calendars',
    { params: { location_id: locationId } }
  );
  return response.data;
};

/**
 * Set which Google Calendar to use for a location
 */
export const setGoogleCalendar = async (
  data: GoogleCalendarSetCalendarData
): Promise<SettingsApiResponse> => {
  const response = await api.put<SettingsApiResponse>(
    '/google-calendar/calendar',
    data
  );
  return response.data;
};

/**
 * Bulk sync existing bookings to Google Calendar
 */
export const syncGoogleCalendar = async (
  data: GoogleCalendarSyncData
): Promise<SettingsApiResponse<GoogleCalendarSyncResult>> => {
  const response = await api.post<SettingsApiResponse<GoogleCalendarSyncResult>>(
    '/google-calendar/sync',
    data
  );
  return response.data;
};

/**
 * Sync a single booking to Google Calendar
 */
export const syncSingleBooking = async (
  bookingId: number
): Promise<SettingsApiResponse> => {
  const response = await api.post<SettingsApiResponse>(
    `/google-calendar/sync/${bookingId}`
  );
  return response.data;
};

/**
 * Remove a booking event from Google Calendar
 */
export const removeBookingEvent = async (
  bookingId: number
): Promise<SettingsApiResponse> => {
  const response = await api.delete<SettingsApiResponse>(
    `/google-calendar/bookings/${bookingId}/event`
  );
  return response.data;
};
