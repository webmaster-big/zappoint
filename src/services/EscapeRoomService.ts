import axios from 'axios';
import { API_BASE_URL, getStoredUser } from '../utils/storage';
import type { WaiverSubmission } from '../types/waiver.types';
import type {
  EscapeRoomBookingGame,
  EscapeRoomGameLink,
  EscapeRoomDay,
  EscapeRoomFormContext,
  EscapeRoomKioskContext,
  EscapeRoomOption,
  EscapeRoomSessionDetail,
  EscapeRoomSubmitResult,
} from '../types/escapeRoom.types';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = getStoredUser()?.token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

const publicApi = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
});

const escapeRoomService = {
  getKiosk: async (locationId: number, link?: EscapeRoomGameLink | null): Promise<EscapeRoomKioskContext> =>
    (await publicApi.get(`/waivers/escape-room/${locationId}`, { params: { recent: 1, ...(link ?? {}) } })).data.data,

  getRoomForm: async (locationId: number, packageId: number, link?: EscapeRoomGameLink | null): Promise<EscapeRoomFormContext> =>
    (await publicApi.get(`/waivers/escape-room/${locationId}/rooms/${packageId}`, { params: { recent: 1, ...(link ?? {}) } })).data.data,

  submit: async (
    locationId: number,
    packageId: number,
    sessionTime: string,
    data: WaiverSubmission,
    shown?: { sessionDate?: string; templateId?: number; templateVersion?: number | null; gameSignature?: string | null },
  ): Promise<EscapeRoomSubmitResult> =>
    (await publicApi.post(`/waivers/escape-room/${locationId}/submit`, {
      ...data,
      package_id: packageId,
      session_time: sessionTime,
      ...(shown?.sessionDate ? { session_date: shown.sessionDate } : {}),
      ...(shown?.templateId ? { waiver_template_id: shown.templateId } : {}),
      ...(shown?.templateVersion ? { waiver_template_version: shown.templateVersion } : {}),
      ...(shown?.gameSignature ? { game_signature: shown.gameSignature } : {}),
    })).data.data,

  getDay: async (locationId: number, date?: string): Promise<EscapeRoomDay> =>
    (await api.get('/escape-rooms/day', { params: date ? { location_id: locationId, date } : { location_id: locationId } })).data.data,

  getRooms: async (locationId: number): Promise<EscapeRoomOption[]> =>
    (await api.get('/escape-rooms/rooms', { params: { location_id: locationId } })).data.data,

  openSession: async (locationId: number, packageId: number, date: string, time: string): Promise<EscapeRoomSessionDetail> =>
    (await api.post('/escape-rooms/sessions', { location_id: locationId, package_id: packageId, date, time })).data.data,

  getSession: async (sessionId: number): Promise<EscapeRoomSessionDetail> =>
    (await api.get(`/escape-rooms/sessions/${sessionId}`)).data.data,

  startPhoto: async (sessionId: number): Promise<EscapeRoomSessionDetail> =>
    (await api.post(`/escape-rooms/sessions/${sessionId}/photo-session`, { verbal_consent: true })).data.data,

  complete: async (sessionId: number, escaped: boolean, completionTime: string | null, withoutPhoto = false): Promise<EscapeRoomSessionDetail> =>
    (await api.post(`/escape-rooms/sessions/${sessionId}/complete`, {
      escaped,
      completion_time: escaped ? completionTime : null,
      ...(withoutPhoto ? { without_photo: true } : {}),
    })).data.data,

  sendToNewPlayers: async (sessionId: number): Promise<EscapeRoomSessionDetail> =>
    (await api.post(`/escape-rooms/sessions/${sessionId}/send-new`)).data.data,

  movePlayer: async (sessionId: number, waiverId: number, packageId: number, time: string): Promise<EscapeRoomSessionDetail> =>
    (await api.post(`/escape-rooms/sessions/${sessionId}/waivers/${waiverId}/move`, { package_id: packageId, time })).data.data,

  removePlayer: async (sessionId: number, waiverId: number): Promise<EscapeRoomSessionDetail> =>
    (await api.post(`/escape-rooms/sessions/${sessionId}/waivers/${waiverId}/remove`)).data.data,

  getBookingGame: async (bookingId: number): Promise<EscapeRoomBookingGame | null> =>
    (await api.get(`/escape-rooms/bookings/${bookingId}`)).data.data ?? null,

  resendToPlayer: async (sessionId: number, waiverId: number, email: string | null): Promise<EscapeRoomSessionDetail> =>
    (await api.post(`/escape-rooms/sessions/${sessionId}/waivers/${waiverId}/resend`, email ? { email } : {})).data.data,

  correctResult: async (sessionId: number, escaped: boolean, completionTime: string | null): Promise<EscapeRoomSessionDetail> =>
    (await api.post(`/escape-rooms/sessions/${sessionId}/result`, {
      escaped,
      completion_time: escaped ? completionTime : null,
    })).data.data,

  linkBooking: async (sessionId: number, waiverId: number, bookingId: number | null): Promise<EscapeRoomSessionDetail> =>
    (await api.post(`/escape-rooms/sessions/${sessionId}/waivers/${waiverId}/booking`, { booking_id: bookingId })).data.data,
};

export default escapeRoomService;
