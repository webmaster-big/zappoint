// Types for: src/pages/admin/packages/Promo.tsx

export type PromoStatus = "active" | "inactive" | "expired" | "exhausted";
export type PromoType = "fixed" | "percentage";

export interface PromoItem {
  code: string;
  type: PromoType;
  value: number;
  start_date: string; // ISO string
  end_date: string; // ISO string
  usage_limit_total: number;
  usage_limit_per_user: number;
  status: PromoStatus;
  description?: string;
  created_by: string;
  created_at: string;
  updated_at?: string;
  deleted?: boolean;
}
