import { isAxiosError } from 'axios';
import type { RegistrationFormStatus } from '../../../types/eventRegistration.types';
import { requestErrorMessage } from '../../../utils/requestError';

export const STATUS_LABELS: Record<RegistrationFormStatus, string> = {
  open: 'Open',
  closed: 'Closed',
  past: 'Date passed',
};

export const STATUS_PILL: Record<RegistrationFormStatus, string> = {
  open: 'bg-blue-50 text-blue-800 border border-blue-200',
  closed: 'bg-gray-100 text-gray-700 border border-gray-200',
  past: 'bg-gray-100 text-gray-700 border border-gray-200',
};

export const SAME_CONTACT_CHIP = 'amber-tone bg-amber-100 text-amber-800 border border-amber-200';
export const REGISTERED_BEFORE_CHIP = 'bg-blue-50 text-blue-800 border border-blue-200';
export const LAST_YEAR_CHIP = 'bg-gray-100 text-gray-700 border border-gray-200';

export const MODULE_UNAVAILABLE_MESSAGE = 'Registration forms are not set up yet.';

export interface StaffRequestFailure {
  message: string;
  unavailable: boolean;
  switchLocationId: number | null;
  status: number | null;
}

export const describeFailure = (error: unknown, fallback: string): StaffRequestFailure => {
  const response = isAxiosError<{ code?: string; message?: string; switch_location_id?: number }>(error) ? error.response : undefined;
  const unavailable = response?.data?.code === 'MODULE_UNAVAILABLE';
  const switchLocationId = typeof response?.data?.switch_location_id === 'number' ? response.data.switch_location_id : null;

  return {
    message: unavailable ? MODULE_UNAVAILABLE_MESSAGE : requestErrorMessage(error, fallback),
    unavailable,
    switchLocationId,
    status: response?.status ?? null,
  };
};

export const fieldErrorsFrom = (error: unknown): Record<string, string> => {
  const errors = isAxiosError<{ errors?: Record<string, string[]> }>(error) ? error.response?.data?.errors : undefined;
  const mapped: Record<string, string> = {};
  if (errors) {
    Object.entries(errors).forEach(([field, messages]) => {
      if (messages?.[0]) mapped[field] = messages[0];
    });
  }
  return mapped;
};

export const fileSlug = (value: string, fallback: string): string =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || fallback;
