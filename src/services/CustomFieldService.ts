import axios from 'axios';
import { API_BASE_URL, getStoredUser } from '../utils/storage';

const api = axios.create({ baseURL: API_BASE_URL });

const authHeaders = () => {
  const token = getStoredUser()?.token;
  return {
    Accept: 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

export type CustomFieldAudience = 'customer' | 'admin' | 'both';

export interface CustomField {
  id: number;
  company_id?: number | null;
  label: string;
  type: 'checkbox';
  help_text?: string | null;
  is_required: boolean;
  audience: CustomFieldAudience;
  location_ids?: number[] | null;
  package_ids?: number[] | null;
  attraction_ids?: number[] | null;
  event_ids?: number[] | null;
  display_order?: number;
  is_active: boolean;
  /** False when this account may read the question but not change it (a manager looking at a company-wide one). */
  can_manage?: boolean;
}

/** What a purchase page needs to render — no targeting details leak to guests. */
export interface ApplicableCustomField {
  id: number;
  label: string;
  type: 'checkbox';
  help_text?: string | null;
  is_required: boolean;
}

export interface CustomFieldPayload {
  label: string;
  help_text?: string | null;
  is_required?: boolean;
  audience?: CustomFieldAudience;
  location_ids?: number[] | null;
  package_ids?: number[] | null;
  attraction_ids?: number[] | null;
  event_ids?: number[] | null;
  display_order?: number;
  is_active?: boolean;
}

/** The first required box still unticked, for a submit-button hint. */
export const firstMissingRequired = (
  fields: ApplicableCustomField[],
  answers: Record<number, boolean>,
): ApplicableCustomField | null =>
  fields.find(field => field.is_required && !answers[field.id]) ?? null;

/**
 * Keeps only the answers that belong to the questions now on screen. Without this, a
 * staff terminal carries the last guest's tick into the next booking and records it as
 * answered.
 */
export const pruneCustomFieldAnswers = (
  answers: Record<number, boolean>,
  fields: ApplicableCustomField[],
): Record<number, boolean> => {
  const kept: Record<number, boolean> = {};
  fields.forEach(field => { if (answers[field.id]) kept[field.id] = true; });
  return kept;
};

export const toCustomFieldPayload = (answers: Record<number, boolean>) =>
  Object.entries(answers).map(([id, value]) => ({ id: Number(id), value }));

const withRetry = async <T,>(attempt: () => Promise<T>, fallback: T): Promise<T> => {
  try {
    return await attempt();
  } catch {
    try {
      await new Promise(resolve => setTimeout(resolve, 400));
      return await attempt();
    } catch {
      return fallback;
    }
  }
};

export const customFieldService = {
  async list(): Promise<CustomField[]> {
    const { data } = await api.get('/custom-fields', { headers: authHeaders() });
    return (data?.data ?? []) as CustomField[];
  },

  async create(payload: CustomFieldPayload): Promise<CustomField> {
    const { data } = await api.post('/custom-fields', payload, { headers: authHeaders() });
    return data.data as CustomField;
  },

  async update(id: number, payload: Partial<CustomFieldPayload>): Promise<CustomField> {
    const { data } = await api.put(`/custom-fields/${id}`, payload, { headers: authHeaders() });
    return data.data as CustomField;
  },

  async remove(id: number): Promise<void> {
    await api.delete(`/custom-fields/${id}`, { headers: authHeaders() });
  },

  /**
   * Questions a given item should ask. Public, so it works for guests mid-checkout;
   * a failure returns nothing rather than blocking the purchase. Whether the staff or
   * customer set comes back is decided by the token on the request, not by us.
   */
  async applicable(params: {
    itemType: 'package' | 'attraction' | 'event';
    itemId: number;
  }): Promise<ApplicableCustomField[] | null> {
    return withRetry(async () => {
      const { data } = await api.get('/custom-fields/applicable', {
        headers: authHeaders(),
        params: {
          item_type: params.itemType,
          item_id: params.itemId,
        },
      });
      return (data?.data ?? []) as ApplicableCustomField[];
    }, null);
  },

  /**
   * The union of questions raised by every line of a multi-item order, asked once —
   * mirrors what the API validates so a guest never answers the same box twice. One
   * request for the whole cart: a request per line used to spend the guest's rate-limit
   * allowance before they reached the pay button.
   */
  async applicableForItems(
    items: { type: 'package' | 'attraction' | 'event'; id: number }[],
  ): Promise<ApplicableCustomField[] | null> {
    if (!items.length) return [];

    return withRetry(async () => {
      const { data } = await api.get('/custom-fields/applicable', {
        headers: authHeaders(),
        params: { items: items.map(item => `${item.type}:${item.id}`).join(',') },
      });
      return (data?.data ?? []) as ApplicableCustomField[];
    }, null);
  },
};

export default customFieldService;
