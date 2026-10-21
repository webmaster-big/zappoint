import axios from 'axios';
import { API_BASE_URL, getStoredUser } from '../utils/storage';
import type {
  RegistrationEntryActionResult,
  RegistrationEventDetail,
  RegistrationEventInput,
  RegistrationEventSummary,
  RegistrationExportResponse,
  RegistrationFormPage,
  RegistrationGroupsQuery,
  RegistrationGroupsResponse,
  RegistrationHistoryResponse,
  RegistrationSubmission,
  RegistrationSubmitResult,
} from '../types/eventRegistration.types';

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
  timeout: 15000,
  headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
});

const multipart = { headers: { 'Content-Type': 'multipart/form-data' } };

const toFormData = (input: Partial<RegistrationEventInput>): FormData => {
  const form = new FormData();
  if (input.name !== undefined) form.append('name', input.name);
  if (input.location_id !== undefined) form.append('location_id', String(input.location_id));
  if (input.event_date !== undefined) form.append('event_date', input.event_date);
  if (input.description !== undefined) form.append('description', input.description);
  if (input.confirmation_message !== undefined) form.append('confirmation_message', input.confirmation_message);
  if (input.previous_edition_id !== undefined) form.append('previous_edition_id', input.previous_edition_id === null ? '' : String(input.previous_edition_id));
  if (input.is_open !== undefined) form.append('is_open', input.is_open ? '1' : '0');
  if (input.header_image) form.append('header_image', input.header_image);
  if (input.remove_header_image) form.append('remove_header_image', '1');
  return form;
};

const eventRegistrationService = {
  getForm: async (code: string): Promise<RegistrationFormPage> =>
    (await publicApi.get(`/registration-forms/${encodeURIComponent(code)}`)).data.data,

  submit: async (code: string, submission: RegistrationSubmission): Promise<RegistrationSubmitResult> =>
    (await publicApi.post(`/registration-forms/${encodeURIComponent(code)}`, submission)).data.data,

  listEvents: async (params: { location_id?: number } = {}): Promise<RegistrationEventSummary[]> =>
    (await api.get('/registration-events', { params })).data.data.events,

  getEvent: async (id: number): Promise<RegistrationEventDetail> =>
    (await api.get(`/registration-events/${id}`)).data.data,

  createEvent: async (input: RegistrationEventInput): Promise<RegistrationEventDetail> =>
    (await api.post('/registration-events', toFormData(input), multipart)).data.data,

  updateEvent: async (id: number, input: Partial<RegistrationEventInput>): Promise<RegistrationEventDetail> =>
    (await api.post(`/registration-events/${id}`, toFormData(input), multipart)).data.data,

  deleteEvent: async (id: number): Promise<void> => {
    await api.delete(`/registration-events/${id}`);
  },

  listRegistrations: async (id: number, query: RegistrationGroupsQuery = {}): Promise<RegistrationGroupsResponse> =>
    (await api.get(`/registration-events/${id}/registrations`, { params: query })).data.data,

  exportRegistrations: async (id: number): Promise<RegistrationExportResponse> =>
    (await api.get(`/registration-events/${id}/registrations/export`)).data.data,

  getContactHistory: async (id: number, contactId: number): Promise<RegistrationHistoryResponse> =>
    (await api.get(`/registration-events/${id}/contacts/${contactId}/history`)).data.data,

  hideEntry: async (id: number, entryId: number): Promise<RegistrationEntryActionResult> =>
    (await api.post(`/registration-events/${id}/entries/${entryId}/hide`)).data.data,

  restoreEntry: async (id: number, entryId: number): Promise<RegistrationEntryActionResult> =>
    (await api.post(`/registration-events/${id}/entries/${entryId}/restore`)).data.data,
};

export default eventRegistrationService;
