import axios from 'axios';
import { API_BASE_URL, getStoredUser } from '../utils/storage';
import type {
  GuestRatingFilters,
  GuestRatingsResponse,
  VisitFeedbackPage,
  VisitFollowUpSummary,
  VisitType,
} from '../types/visitFollowUp.types';

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

const visitFollowUpService = {
  getForVisit: async (visitType: VisitType, visitId: number): Promise<VisitFollowUpSummary> =>
    (await api.get('/visit-follow-ups/visit', { params: { visit_type: visitType, visit_id: visitId } })).data.data,

  sendThanks: async (visitType: Exclude<VisitType, 'escape_room_session'>, visitId: number): Promise<VisitFollowUpSummary> =>
    (await api.post('/visit-follow-ups/send-thanks', { visit_type: visitType, visit_id: visitId })).data.data,

  sendNow: async (followUpId: number): Promise<{ message: string; data: VisitFollowUpSummary }> => {
    const response = await api.post(`/visit-follow-ups/${followUpId}/send-now`);
    return { message: response.data.message, data: response.data.data };
  },

  cancel: async (followUpId: number): Promise<VisitFollowUpSummary> =>
    (await api.post(`/visit-follow-ups/${followUpId}/cancel`)).data.data,

  getRatings: async (filters: GuestRatingFilters = {}): Promise<GuestRatingsResponse> =>
    (await api.get('/visit-follow-ups/ratings', { params: filters })).data.data,

  getFeedback: async (token: string): Promise<VisitFeedbackPage> =>
    (await publicApi.get(`/visit-feedback/${encodeURIComponent(token)}`)).data.data,

  rate: async (token: string, rating: number, comment?: string): Promise<VisitFeedbackPage> =>
    (await publicApi.post(`/visit-feedback/${encodeURIComponent(token)}`, comment === undefined ? { rating } : { rating, comment })).data.data,

  unsubscribe: async (token: string): Promise<VisitFeedbackPage> =>
    (await publicApi.post(`/visit-feedback/${encodeURIComponent(token)}/unsubscribe`)).data.data,
};

export default visitFollowUpService;
