import type { EmailTemplate, EmailTemplateVariablesData } from '../types/EmailCampaign.types';

export const EVENT_PHOTOS_CATEGORY = 'event_photos';

export const EVENT_PHOTO_SMS_LIMIT = 600;

export const TEMPLATE_SUBJECT_LIMIT = 255;

export const EVENT_PHOTO_STARTER = {
  name: 'Event registration photos',
  subject: 'Your photos from {{ event_name }} at {{ location_name }}',
  body: '<p>Hi {{ first_name }},</p><p>Thanks for joining us for {{ event_name }} at {{ location_name }}. Your photos are ready to view and download.</p><p><a href="{{ photo_link }}">View your photos</a></p><p>This link works until {{ expires_on }}.</p><p>{{ links }}</p><p>{{ business_name }}<br>{{ location_phone }}</p>',
};

export const EMAIL_TEMPLATE_CATEGORIES = [
  { value: 'onboarding', label: 'Onboarding' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'transactional', label: 'Transactional' },
  { value: 'newsletter', label: 'Newsletter' },
  { value: 'reminder', label: 'Reminder' },
  { value: 'notification', label: 'Notification' },
  { value: EVENT_PHOTOS_CATEGORY, label: 'Event photos' },
  { value: 'other', label: 'Other' },
];

export const emailTemplateCategoryLabel = (category?: string | null): string =>
  EMAIL_TEMPLATE_CATEGORIES.find(option => option.value === category)?.label ?? (category || 'Uncategorized');

const COMPANY_LEVEL_ROLES = ['company_admin', 'admin', 'owner'];

const EVENT_PHOTO_ROLES = [...COMPANY_LEVEL_ROLES, 'location_manager'];

export const isCompanyLevelRole = (role?: string | null): boolean => COMPANY_LEVEL_ROLES.includes(role ?? '');

export const canManageEventPhotoEmails = (role?: string | null): boolean => EVENT_PHOTO_ROLES.includes(role ?? '');

export const isSharedEventPhotoTemplate = (
  template: Pick<EmailTemplate, 'category' | 'all_locations' | 'location_ids'>,
): boolean => template.category === EVENT_PHOTOS_CATEGORY && !template.all_locations && (template.location_ids ?? []).length > 1;

export const templateLocationSummary = (
  template: Pick<EmailTemplate, 'all_locations' | 'location_names' | 'location_ids' | 'location'>,
): string => {
  if (template.all_locations === undefined) {
    return template.location?.name ?? 'Every location';
  }

  if (template.all_locations) {
    return 'Every location';
  }

  const names = template.location_names ?? [];

  if (names.length === 0) {
    const count = (template.location_ids ?? []).length;
    return count === 1 ? '1 location' : `${count} locations`;
  }

  return names.length <= 2 ? names.join(', ') : `${names[0]} + ${names.length - 1} more`;
};

export const templateCoversLocation = (
  template: Pick<EmailTemplate, 'all_locations' | 'location_ids' | 'location_id'>,
  locationId: number,
): boolean =>
  template.all_locations === undefined
    ? !template.location_id || template.location_id === locationId
    : template.all_locations || (template.location_ids ?? []).includes(locationId);

export interface TemplateLocationsValue {
  allLocations: boolean;
  selectedIds: number[];
}

export const templateLocationsFrom = (
  template: Pick<EmailTemplate, 'all_locations' | 'location_ids' | 'location_id' | 'target_locations'>,
): TemplateLocationsValue => {
  const ids = template.location_ids?.length ? template.location_ids : template.location_id ? [template.location_id] : [];
  const deleted = new Set((template.target_locations ?? []).filter((target) => target.name === null).map((target) => target.id));

  return { allLocations: template.all_locations ?? ids.length === 0, selectedIds: ids.filter((id) => !deleted.has(id)) };
};

export const templateLocationIds = (value: TemplateLocationsValue): number[] => (value.allLocations ? [] : value.selectedIds);

export const templatePreviewLocationId = (value: TemplateLocationsValue, locations: Array<{ id: number }>): number | undefined => {
  const ids = templateLocationIds(value);

  return ids.find((id) => locations.some((location) => location.id === id)) ?? ids[0];
};

export interface TemplateVariableGroup {
  key: string;
  title: string;
  note?: string;
  variables: Array<{ name: string; description: string }>;
}

const GROUP_TITLES: Record<string, string> = {
  event: 'Event Photo Variables',
  default: 'Default Variables',
  customer: 'Customer Variables',
  user: 'User Variables',
};

const toVariables = (values: Record<string, string> | undefined) =>
  values && typeof values === 'object'
    ? Object.entries(values).map(([name, description]) => ({ name, description: String(description) }))
    : [];

export const templateVariableGroups = (data: EmailTemplateVariablesData | null, eventPhotos: boolean): TemplateVariableGroup[] => {
  if (!data) return [];

  const event: TemplateVariableGroup = {
    key: 'event',
    title: GROUP_TITLES.event,
    note: eventPhotos
      ? 'Filled in for each person when their photos are sent. A link name gives that link\'s address for the photo\'s location.'
      : 'Only filled in when this template is emailed to event registrants from a campaign.',
    variables: toVariables(data.event),
  };
  const general = (['default', 'customer', 'user'] as const).map((key) => ({
    key,
    title: GROUP_TITLES[key],
    variables: toVariables(data[key]),
  }));

  return (eventPhotos ? [event, general[0]] : [...general, event]).filter((group) => group.variables.length > 0);
};

export const escapeHtml = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const linkHref = (raw: string): string => {
  const value = raw.trim();

  return /^\{\{\s*[A-Za-z0-9_]+\s*\}\}$/.test(value) || /^(https?:\/\/|mailto:|tel:)/i.test(value) ? value : `https://${value}`;
};

export const insertAtCaret = (
  field: HTMLInputElement | HTMLTextAreaElement | null,
  current: string,
  token: string,
): { value: string; caret: number } => {
  const start = field?.selectionStart ?? current.length;
  const end = field?.selectionEnd ?? current.length;

  return { value: current.slice(0, start) + token + current.slice(end), caret: start + token.length };
};
