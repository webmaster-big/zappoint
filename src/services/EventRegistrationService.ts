import axios from 'axios';
import { API_BASE_URL, getStoredUser } from '../utils/storage';
import type {
  RegistrationCreateResult,
  RegistrationEntryActionResult,
  RegistrationEventOption,
  RegistrationEventDetail,
  RegistrationEventGroupDetail,
  RegistrationEventGroupInput,
  RegistrationEventGroupList,
  RegistrationEventInput,
  RegistrationGroupExportResponse,
  RegistrationEventSummary,
  RegistrationExportResponse,
  RegistrationFormDeleteResult,
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
  if (input.location_ids !== undefined) input.location_ids.forEach((id) => form.append('location_ids[]', String(id)));
  if (input.event_id !== undefined) form.append('event_id', input.event_id === null ? '' : String(input.event_id));
  if (input.event_links) Object.entries(input.event_links).forEach(([locationId, eventId]) => form.append(`event_links[${locationId}]`, String(eventId)));
  if (input.use_event_image) form.append('use_event_image', '1');
  if (input.copy_header_image_from) form.append('copy_header_image_from', String(input.copy_header_image_from));
  if (input.event_date !== undefined) form.append('event_date', input.event_date);
  if (input.description !== undefined) form.append('description', input.description);
  if (input.confirmation_message !== undefined) form.append('confirmation_message', input.confirmation_message);
  if (input.previous_edition_id !== undefined) form.append('previous_edition_id', input.previous_edition_id === null ? '' : String(input.previous_edition_id));
  if (input.is_open !== undefined) form.append('is_open', input.is_open ? '1' : '0');
  if (input.header_image) form.append('header_image', input.header_image);
  if (input.remove_header_image) form.append('remove_header_image', '1');
  return form;
};

const groupFormData = (input: RegistrationEventGroupInput): FormData => {
  const form = new FormData();
  if (input.name !== undefined) form.append('name', input.name);
  if (input.event_date !== undefined) form.append('event_date', input.event_date);
  if (input.description !== undefined) form.append('description', input.description);
  if (input.confirmation_message !== undefined) form.append('confirmation_message', input.confirmation_message);
  if (input.location_id !== undefined) form.append('location_id', String(input.location_id));
  if (input.location_ids !== undefined) input.location_ids.forEach((id) => form.append('location_ids[]', String(id)));
  if (input.event_id !== undefined) form.append('event_id', input.event_id === null ? '' : String(input.event_id));
  if (input.event_links) Object.entries(input.event_links).forEach(([locationId, eventId]) => form.append(`event_links[${locationId}]`, String(eventId)));
  if (input.use_event_image) form.append('use_event_image', '1');
  if (input.copy_header_image_from_group) form.append('copy_header_image_from_group', String(input.copy_header_image_from_group));
  if (input.previous_group_id !== undefined) form.append('previous_group_id', input.previous_group_id === null ? '' : String(input.previous_group_id));
  if (input.is_open !== undefined) form.append('is_open', input.is_open ? '1' : '0');
  if (input.header_image) form.append('header_image', input.header_image);
  if (input.remove_header_image) form.append('remove_header_image', '1');
  if (input.confirm_remove) form.append('confirm_remove', '1');
  if (input.move_form_ids) input.move_form_ids.forEach((id) => form.append('move_form_ids[]', String(id)));
  if (input.expected_location_ids) input.expected_location_ids.forEach((id) => form.append('expected_location_ids[]', String(id)));
  return form;
};

const eventRegistrationService = {
  listGroups: async (params: { year?: number; location_id?: number } = {}): Promise<RegistrationEventGroupList> =>
    (await api.get('/registration-event-groups', { params })).data.data,

  getGroup: async (id: number): Promise<RegistrationEventGroupDetail> =>
    (await api.get(`/registration-event-groups/${id}`)).data.data,

  createGroup: async (input: RegistrationEventGroupInput): Promise<RegistrationEventGroupDetail> =>
    (await api.post('/registration-event-groups', groupFormData(input), multipart)).data.data,

  updateGroup: async (id: number, input: RegistrationEventGroupInput): Promise<RegistrationEventGroupDetail> =>
    (await api.post(`/registration-event-groups/${id}`, groupFormData(input), multipart)).data.data,

  deleteGroup: async (id: number, expectedLocationIds?: number[]): Promise<void> => {
    await api.delete(`/registration-event-groups/${id}`, {
      params: expectedLocationIds ? { expected_location_ids: expectedLocationIds } : undefined,
    });
  },

  exportGroup: async (id: number): Promise<RegistrationGroupExportResponse> =>
    (await api.get(`/registration-event-groups/${id}/export`)).data.data,

  getForm: async (code: string): Promise<RegistrationFormPage> =>
    (await publicApi.get(`/registration-forms/${encodeURIComponent(code)}`)).data.data,

  submit: async (code: string, submission: RegistrationSubmission): Promise<RegistrationSubmitResult> =>
    (await publicApi.post(`/registration-forms/${encodeURIComponent(code)}`, submission)).data.data,

  listEvents: async (params: { location_id?: number } = {}): Promise<RegistrationEventSummary[]> =>
    (await api.get('/registration-events', { params })).data.data.events,

  getEvent: async (id: number): Promise<RegistrationEventDetail> =>
    (await api.get(`/registration-events/${id}`)).data.data,

  createEvent: async (input: RegistrationEventInput): Promise<RegistrationCreateResult> => {
    const response = await api.post('/registration-events', toFormData(input), multipart);
    return { event: response.data.data, created: response.data.created ?? [response.data.data] };
  },

  eventOptions: async (params: { id?: number } = {}): Promise<RegistrationEventOption[]> =>
    (await api.get('/registration-events/event-options', { params })).data.data.events,

  updateEvent: async (id: number, input: Partial<RegistrationEventInput>): Promise<RegistrationEventDetail> =>
    (await api.post(`/registration-events/${id}`, toFormData(input), multipart)).data.data,

  deleteEvent: async (id: number): Promise<RegistrationFormDeleteResult> => {
    const body = (await api.delete(`/registration-events/${id}`)).data as Partial<RegistrationFormDeleteResult>;
    return { group_deleted: Boolean(body.group_deleted), group_id: body.group_id ?? null };
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
