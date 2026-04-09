// Types for: src/pages/admin/packages/Promo.tsx

export type PromoStatus = "active" | "inactive" | "expired" | "exhausted";
export type PromoType = "fixed" | "percentage";
export type CodeMode = "single" | "unique";

export interface PromoItem {
  id: number;
  code: string;
  code_mode: CodeMode;
  batch_id: string | null;
  name: string;
  type: PromoType;
  value: number;
  start_date: string;
  end_date: string;
  usage_limit_total: number | null;
  usage_limit_per_user: number;
  current_usage: number;
  status: PromoStatus;
  description?: string;
  created_by: number;
  created_at: string;
  updated_at?: string;
  deleted?: boolean;
  creator?: { id: number; first_name: string; last_name: string };
  packages?: { id: number; name: string }[];
}

export interface PromoBatch {
  batch_id: string;
  name: string;
  type: PromoType;
  value: string;
  start_date: string;
  end_date: string;
  created_at: string;
  total_codes: number;
  total_used: number;
  active_codes: number;
  exhausted_codes: number;
}

export interface BatchSummary {
  total_codes: number;
  total_used: number;
  active_codes: number;
  exhausted_codes: number;
  inactive_codes: number;
}

export interface GenerateBulkPayload {
  name: string;
  type: PromoType;
  value: number;
  start_date: string;
  end_date: string;
  description?: string;
  created_by: number;
  quantity: number;
  code_prefix?: string;
  code_length?: number;
  usage_limit_per_code?: number;
}

export interface GenerateBulkResponseData {
  batch_id: string;
  quantity: number;
  prefix: string;
  sample_codes: string[];
  promo_name: string;
  type: PromoType;
  value: number;
  start_date: string;
  end_date: string;
}

export interface BatchDetailResponse {
  batch_id: string;
  summary: BatchSummary;
  promos: PromoItem[];
  pagination: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number | null;
    to: number | null;
  };
}

export interface BatchDetailFilters {
  status?: PromoStatus;
  used?: boolean;
  sort_by?: 'code' | 'status' | 'current_usage' | 'created_at';
  sort_order?: 'asc' | 'desc';
  per_page?: number;
  page?: number;
}
