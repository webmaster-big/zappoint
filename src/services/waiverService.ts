import axios from 'axios';
import { API_BASE_URL, getStoredUser } from '../utils/storage';
import type {
  ApiResponse,
  Paginated,
  Waiver,
  WaiverTemplate,
  WaiverTemplatePayload,
  WaiverFormContext,
  WaiverSubmission,
  BulkChaperoneView,
  AvailableActivities,
  WaiverSettings,
  WaiverSearchFilters,
  ActivityType,
  WaiverMinor,
  ConnectedWaiver,
} from '../types/waiver.types';

const getAuthToken = (): string | null => {
  const user = getStoredUser();
  if (user?.token) return user.token;
  try {
    const stored = localStorage.getItem('zapzone_customer');
    if (stored) return JSON.parse(stored)?.token || null;
  } catch {
    /* ignore */
  }
  return null;
};

// Authenticated client (staff/admin endpoints)
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
});
api.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Public client (token-addressed customer / kiosk / chaperone endpoints — no auth)
const publicApi = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
});

const waiverService = {
  // ---- public: customer waiver flow ----
  getForm: async (token: string): Promise<WaiverFormContext> =>
    (await publicApi.get<ApiResponse<WaiverFormContext>>(`/waivers/access/${token}`)).data.data,

  getStatus: async (token: string) =>
    (await publicApi.get(`/waivers/status/${token}`)).data,

  submit: async (token: string, data: WaiverSubmission) =>
    (await publicApi.post(`/waivers/access/${token}/submit`, data)).data,

  // ---- public: kiosk ----
  getKioskForm: async (templateId: number): Promise<WaiverFormContext> =>
    (await publicApi.get<ApiResponse<WaiverFormContext>>(`/waivers/kiosk/${templateId}`)).data.data,

  getKioskPreview: async (templateId: number): Promise<WaiverFormContext> =>
    (await api.get<ApiResponse<WaiverFormContext>>(`/waiver-templates/${templateId}/kiosk-preview`)).data.data,

  kioskSubmit: async (templateId: number, data: WaiverSubmission) =>
    (await publicApi.post(`/waivers/kiosk/${templateId}/submit`, data)).data,

  // ---- public: chaperone (bulk) ----
  getBulk: async (manageToken: string): Promise<BulkChaperoneView> =>
    (await publicApi.get<ApiResponse<BulkChaperoneView>>(`/waivers/bulk/${manageToken}`)).data.data,

  addBulkRecipients: async (
    manageToken: string,
    recipients: Array<{ name?: string; email?: string; phone?: string }>,
  ) => (await publicApi.post(`/waivers/bulk/${manageToken}/recipients`, { recipients })).data,

  sendBulk: async (manageToken: string) =>
    (await publicApi.post(`/waivers/bulk/${manageToken}/send`, {})).data,

  resendBulkRecipient: async (manageToken: string, recipientId: number) =>
    (await publicApi.post(`/waivers/bulk/${manageToken}/recipients/${recipientId}/resend`, {})).data,

  // ---- staff: search / view records ----
  list: async (filters: WaiverSearchFilters = {}): Promise<Paginated<Waiver>> =>
    (await api.get('/waivers', { params: filters })).data,

  get: async (id: number): Promise<ApiResponse<{ waiver: Waiver; rendered_body: string }>> =>
    (await api.get(`/waivers/${id}`)).data,

  assign: async (data: {
    waiver_template_id: number;
    selected_date: string;
    customer_id?: number;
    booking_id?: number;
    event_id?: number;
    attraction_purchase_id?: number;
    location_id?: number;
    adult_email?: string;
    adult_phone?: string;
    activity_name?: string;
  }): Promise<ApiResponse<Waiver>> => (await api.post('/waivers/assign', data)).data,

  resendLink: async (id: number) => (await api.post(`/waivers/${id}/resend-link`, {})).data,

  remove: async (id: number, reason?: string) =>
    (await api.delete(`/waivers/${id}`, { data: { reason } })).data,

  print: async (id: number): Promise<Blob> =>
    (await api.get(`/waivers/${id}/print`, { responseType: 'blob' })).data,

  export: async (filters: WaiverSearchFilters = {}) =>
    (await api.get('/waivers/export', { params: filters })).data,

  deletionLog: async (params: { per_page?: number; page?: number } = {}) =>
    (await api.get('/waivers/deletion-log', { params })).data,

  report: async (type: string, params: Record<string, unknown> = {}) =>
    (await api.get(`/waivers/reports/${type}`, { params })).data,

  entityWaivers: async (
    type: 'booking' | 'attraction_purchase' | 'event_purchase' | 'customer',
    id: number,
  ): Promise<ApiResponse<{ waivers: ConnectedWaiver[]; summary: { total: number; completed: number; pending: number } }>> =>
    (await api.get('/waivers/for', { params: { type, id } })).data,

  createKioskSession: async (
    sourceType: 'booking' | 'attraction_purchase' | 'event_purchase' | 'package' | 'attraction' | 'event',
    sourceId: number,
    opts: { selected_date?: string; location_id?: number } = {},
  ): Promise<ApiResponse<{ access_token: string; kiosk_url: string; status: string; already_completed: boolean }>> =>
    (await api.post('/waivers/kiosk-session', { source_type: sourceType, source_id: sourceId, ...opts })).data,

  // ---- staff: templates (builder) ----
  listTemplates: async (params: { status?: string; search?: string; per_page?: number; page?: number } = {}): Promise<Paginated<WaiverTemplate>> =>
    (await api.get('/waiver-templates', { params })).data,

  getTemplate: async (id: number): Promise<ApiResponse<WaiverTemplate>> =>
    (await api.get(`/waiver-templates/${id}`)).data,

  createTemplate: async (data: WaiverTemplatePayload): Promise<ApiResponse<WaiverTemplate>> =>
    (await api.post('/waiver-templates', data)).data,

  updateTemplate: async (id: number, data: WaiverTemplatePayload): Promise<ApiResponse<WaiverTemplate>> =>
    (await api.put(`/waiver-templates/${id}`, data)).data,

  setTemplateStatus: async (id: number, status: string): Promise<ApiResponse<WaiverTemplate>> =>
    (await api.patch(`/waiver-templates/${id}/status`, { status })).data,

  templateVersions: async (id: number) =>
    (await api.get(`/waiver-templates/${id}/versions`)).data,

  contentTokens: async (): Promise<ApiResponse<Record<string, string>>> =>
    (await api.get('/waiver-templates/content-tokens')).data,

  availableActivities: async (type: ActivityType, exceptTemplateId?: number): Promise<ApiResponse<AvailableActivities>> =>
    (await api.get('/waiver-templates/available-activities', {
      params: { type, except_template_id: exceptTemplateId },
    })).data,

  // ---- staff: bulk invites ----
  listBulkInvites: async (params: Record<string, unknown> = {}) =>
    (await api.get('/waiver-bulk-invites', { params })).data,

  getBulkInvite: async (id: number) =>
    (await api.get(`/waiver-bulk-invites/${id}`)).data,

  createBulkInvite: async (data: {
    waiver_template_id: number;
    selected_date: string;
    location_id?: number;
    booking_id?: number;
    event_id?: number;
    chaperone_name: string;
    chaperone_email?: string;
    chaperone_phone?: string;
    allow_shareable_link?: boolean;
  }) => (await api.post('/waiver-bulk-invites', data)).data,

  resendBulkInvite: async (id: number) =>
    (await api.post(`/waiver-bulk-invites/${id}/resend`, {})).data,

  // ---- admin: settings ----
  getSettings: async (): Promise<ApiResponse<WaiverSettings>> =>
    (await api.get('/waiver-settings')).data,

  updateSettings: async (data: Partial<WaiverSettings>): Promise<ApiResponse<WaiverSettings>> =>
    (await api.put('/waiver-settings', data)).data,
};

export type { WaiverMinor };
export { waiverService };
export default waiverService;
