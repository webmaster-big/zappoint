import axios from 'axios';
import { API_BASE_URL, getStoredUser } from '../utils/storage';
import type {
  CustomerPhotoPage,
  KioskAcceptResult,
  KioskCaptureResult,
  KioskContext,
  KioskSessionHandle,
  LocationPhotoSettingRecord,
  PhotoCaptureContext,
  PhotoDeliveryRecord,
  PhotoLibraryResponse,
  PhotoMessageTemplateRecord,
  PhotoOverlayResponse,
  PhotoRecord,
  PhotoSessionRecord,
  PhotoSettingsResponse,
  PhotoTemplatesResponse,
  PhotoWaiverMatch,
  QrResolution,
  SlideshowFeed,
  SlideshowQueueResponse,
} from '../types/photo.types';

const KIOSK_TOKEN_KEY = 'zapzone_photo_kiosk_device';
const SLIDESHOW_TOKEN_KEY = 'zapzone_photo_slideshow_device';

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

const deviceKey = (mode: 'kiosk' | 'slideshow', locationId: number) =>
  `${mode === 'kiosk' ? KIOSK_TOKEN_KEY : SLIDESHOW_TOKEN_KEY}_${locationId}`;

export const readDeviceToken = (mode: 'kiosk' | 'slideshow', locationId: number): string | null => {
  try {
    return localStorage.getItem(deviceKey(mode, locationId));
  } catch {
    return null;
  }
};

export const writeDeviceToken = (mode: 'kiosk' | 'slideshow', locationId: number, token: string): void => {
  try {
    localStorage.setItem(deviceKey(mode, locationId), token);
  } catch {
    /* private browsing — the device will need the passcode again on reload */
  }
};

export const clearDeviceToken = (mode: 'kiosk' | 'slideshow', locationId: number): void => {
  try {
    localStorage.removeItem(deviceKey(mode, locationId));
  } catch {
    /* ignore */
  }
};

const deviceHeaders = (token: string | null, sessionSecret?: string) => {
  const headers: Record<string, string> = {};
  if (token) headers['X-Photo-Device'] = token;
  if (sessionSecret) headers['X-Kiosk-Session'] = sessionSecret;
  return { headers };
};

const photoService = {
  // ---- staff capture and delivery ----
  getCaptureContext: async (locationId: number): Promise<PhotoCaptureContext> =>
    (await api.get('/photo-sessions/context', { params: { location_id: locationId } })).data.data,

  startSession: async (locationId: number): Promise<PhotoSessionRecord> =>
    (await api.post('/photo-sessions', { location_id: locationId, verbal_consent: true })).data.data,

  getSession: async (sessionId: number): Promise<PhotoSessionRecord> =>
    (await api.get(`/photo-sessions/${sessionId}`)).data.data,

  listSessions: async (params: Record<string, unknown> = {}) =>
    (await api.get('/photo-sessions', { params })).data.data,

  addCapturedPhoto: async (sessionId: number, dataUrl: string): Promise<PhotoSessionRecord> =>
    (await api.post(`/photo-sessions/${sessionId}/photos`, { image: dataUrl, source: 'camera' })).data.data,

  uploadPhoto: async (sessionId: number, file: File): Promise<PhotoSessionRecord> => {
    const form = new FormData();
    form.append('file', file);
    const res = await api.post(`/photo-sessions/${sessionId}/photos`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data.data;
  },

  removePhoto: async (sessionId: number, photoId: number): Promise<PhotoSessionRecord> =>
    (await api.delete(`/photo-sessions/${sessionId}/photos/${photoId}`)).data.data,

  reorderPhotos: async (sessionId: number, order: number[]): Promise<PhotoSessionRecord> =>
    (await api.post(`/photo-sessions/${sessionId}/photos/reorder`, { order })).data.data,

  searchWaivers: async (q: string, locationId?: number | null): Promise<PhotoWaiverMatch[]> =>
    (await api.get('/photo-sessions/waiver-search', {
      params: locationId != null ? { q, location_id: locationId } : { q },
    })).data.data,

  deliver: async (
    sessionId: number,
    payload: { method: 'waiver_message' | 'staff_qr'; schedule?: string; waiver_ids?: number[] },
  ): Promise<{ data: PhotoSessionRecord; message?: string }> => {
    const res = await api.post(`/photo-sessions/${sessionId}/deliver`, payload);
    return { data: res.data.data, message: res.data.message };
  },

  discardSession: async (sessionId: number): Promise<void> => {
    await api.delete(`/photo-sessions/${sessionId}`);
  },

  // ---- daily photo library ----
  getLibrary: async (params: Record<string, unknown>): Promise<PhotoLibraryResponse> =>
    (await api.get('/photo-library', { params })).data.data,

  getLibraryPhoto: async (photoId: number): Promise<PhotoRecord & { session: PhotoSessionRecord }> =>
    (await api.get(`/photo-library/${photoId}`)).data.data,

  downloadPhotoUrl: (photoId: number): string => `${API_BASE_URL}/photo-library/${photoId}/download`,

  downloadPhoto: async (photoId: number): Promise<Blob> =>
    (await api.get(`/photo-library/${photoId}/download`, { responseType: 'blob' })).data,

  downloadPhotos: async (photoIds: number[]): Promise<Blob> =>
    (await api.post('/photo-library/download', { photo_ids: photoIds }, { responseType: 'blob' })).data,

  sendPhoto: async (
    photoId: number,
    payload: { waiver_ids: number[]; schedule?: string },
  ): Promise<PhotoSessionRecord> => (await api.post(`/photo-library/${photoId}/send`, payload)).data.data,

  // ---- slideshow queue ----
  getSlideshowQueues: async (locationId: number): Promise<SlideshowQueueResponse> =>
    (await api.get('/slideshow-queues', { params: { location_id: locationId } })).data.data,

  getSlideshowQueue: async (queueId: number) =>
    (await api.get(`/slideshow-queues/${queueId}`)).data.data,

  updateSlideshowPhoto: async (
    photoId: number,
    payload: { slideshow_state?: string; slideshow_priority?: number },
  ): Promise<PhotoRecord> => (await api.patch(`/slideshow-photos/${photoId}`, payload)).data.data,

  reorderSlideshow: async (queueId: number, order: number[]) =>
    (await api.post(`/slideshow-queues/${queueId}/reorder`, { order })).data.data,

  setSlideshowPaused: async (queueId: number, isPaused: boolean) =>
    (await api.post(`/slideshow-queues/${queueId}/paused`, { is_paused: isPaused })).data.data,

  // ---- overlays ----
  getOverlays: async (locationId: number): Promise<PhotoOverlayResponse> =>
    (await api.get('/photo-overlays', { params: { location_id: locationId } })).data.data,

  createOverlay: async (form: FormData) =>
    (await api.post('/photo-overlays', form, { headers: { 'Content-Type': 'multipart/form-data' } })).data.data,

  updateOverlay: async (overlayId: number, form: FormData) =>
    (await api.post(`/photo-overlays/${overlayId}`, form, { headers: { 'Content-Type': 'multipart/form-data' } })).data
      .data,

  deleteOverlay: async (overlayId: number): Promise<void> => {
    await api.delete(`/photo-overlays/${overlayId}`);
  },

  // ---- delivery log ----
  getDeliveries: async (params: Record<string, unknown>) =>
    (await api.get('/photo-deliveries', { params })).data.data,

  retryDelivery: async (deliveryId: number): Promise<PhotoDeliveryRecord> =>
    (await api.post(`/photo-deliveries/${deliveryId}/retry`)).data.data,

  cancelDelivery: async (deliveryId: number): Promise<PhotoDeliveryRecord> =>
    (await api.post(`/photo-deliveries/${deliveryId}/cancel`)).data.data,

  // ---- settings, passcodes and templates ----
  getSettings: async (locationId: number): Promise<PhotoSettingsResponse> =>
    (await api.get('/photo-settings', { params: { location_id: locationId } })).data.data,

  updateSettings: async (payload: Record<string, unknown>): Promise<LocationPhotoSettingRecord> =>
    (await api.put('/photo-settings', payload)).data.data,

  rotatePasscode: async (locationId: number, mode: 'kiosk' | 'slideshow'): Promise<LocationPhotoSettingRecord> =>
    (await api.post('/photo-settings/passcode', { location_id: locationId, mode })).data.data,

  getTemplates: async (): Promise<PhotoTemplatesResponse> => (await api.get('/photo-templates')).data.data,

  updateTemplate: async (
    templateId: number,
    payload: { email_subject: string; email_body: string; sms_body: string; is_active?: boolean },
  ): Promise<PhotoMessageTemplateRecord> => (await api.put(`/photo-templates/${templateId}`, payload)).data.data,

  resetTemplate: async (templateId: number): Promise<PhotoMessageTemplateRecord> =>
    (await api.post(`/photo-templates/${templateId}/reset`)).data.data,

  // ---- reports ----
  getReport: async (type: string, params: Record<string, unknown> = {}) =>
    (await api.get(`/photo-reports/${type}`, { params })).data.data,

  // ---- kiosk (device, passcode protected) ----
  unlockKiosk: async (
    locationId: number,
    passcode: string,
  ): Promise<{ token: string; expires_at: string; context: KioskContext }> => {
    const res = await publicApi.post(`/photos/kiosk/${locationId}/unlock`, { passcode });
    const payload = res.data.data;
    writeDeviceToken('kiosk', locationId, payload.token);
    return payload;
  },

  getKioskContext: async (locationId: number): Promise<KioskContext> =>
    (await publicApi.get(`/photos/kiosk/${locationId}`, deviceHeaders(readDeviceToken('kiosk', locationId)))).data.data,

  startKioskSession: async (locationId: number): Promise<KioskSessionHandle> =>
    (
      await publicApi.post(
        `/photos/kiosk/${locationId}/sessions`,
        {},
        deviceHeaders(readDeviceToken('kiosk', locationId)),
      )
    ).data.data,

  kioskCapture: async (
    locationId: number,
    handle: KioskSessionHandle,
    dataUrl: string,
  ): Promise<KioskCaptureResult> =>
    (
      await publicApi.post(
        `/photos/kiosk/${locationId}/sessions/${handle.session_id}/capture`,
        { image: dataUrl },
        deviceHeaders(readDeviceToken('kiosk', locationId), handle.session_secret),
      )
    ).data.data,

  kioskRetake: async (locationId: number, handle: KioskSessionHandle): Promise<void> => {
    await publicApi.post(
      `/photos/kiosk/${locationId}/sessions/${handle.session_id}/retake`,
      {},
      deviceHeaders(readDeviceToken('kiosk', locationId), handle.session_secret),
    );
  },

  kioskAccept: async (
    locationId: number,
    handle: KioskSessionHandle,
    slideshowOptIn: boolean,
  ): Promise<KioskAcceptResult> =>
    (
      await publicApi.post(
        `/photos/kiosk/${locationId}/sessions/${handle.session_id}/accept`,
        { slideshow_opt_in: slideshowOptIn },
        deviceHeaders(readDeviceToken('kiosk', locationId), handle.session_secret),
      )
    ).data.data,

  kioskTimeout: async (locationId: number, handle: KioskSessionHandle): Promise<void> => {
    await publicApi.post(
      `/photos/kiosk/${locationId}/sessions/${handle.session_id}/timeout`,
      {},
      deviceHeaders(readDeviceToken('kiosk', locationId), handle.session_secret),
    );
  },

  // ---- slideshow (device, passcode protected) ----
  unlockSlideshow: async (
    locationId: number,
    passcode: string,
  ): Promise<{ token: string; expires_at: string; feed: SlideshowFeed }> => {
    const res = await publicApi.post(`/photos/slideshow/${locationId}/unlock`, { passcode });
    const payload = res.data.data;
    writeDeviceToken('slideshow', locationId, payload.token);
    return payload;
  },

  getSlideshowFeed: async (locationId: number): Promise<SlideshowFeed> =>
    (
      await publicApi.get(
        `/photos/slideshow/${locationId}/feed`,
        deviceHeaders(readDeviceToken('slideshow', locationId)),
      )
    ).data.data,

  // ---- customer-facing ----
  resolveQr: async (qrToken: string): Promise<QrResolution> =>
    (await publicApi.get(`/photos/qr/${qrToken}`)).data.data,

  getCustomerPage: async (accessToken: string): Promise<CustomerPhotoPage> =>
    (await publicApi.get(`/photos/access/${accessToken}`)).data.data,

  submitCustomerContact: async (
    accessToken: string,
    payload: { name: string; email: string; phone: string; marketing_consent: boolean },
  ): Promise<CustomerPhotoPage> =>
    (await publicApi.post(`/photos/access/${accessToken}/contact`, payload)).data.data,

  customerDownloadUrl: (accessToken: string, photoId: number): string =>
    `${API_BASE_URL}/photos/access/${accessToken}/photos/${photoId}/download`,
};

export default photoService;
