
export type GiftCardStatus = "active" | "inactive" | "expired" | "redeemed" | "cancelled" | "deleted";
export type GiftCardType = "fixed" | "percentage";

export interface GiftCardItem {
  id: number;
  code: string;
  type: GiftCardType;
  initial_value: number;
  balance: number;
  max_usage: number;
  description: string;
  status: GiftCardStatus;
  expiry_date?: string; // ISO string
  created_by: string; // admin id
  location_id?: number; // location scope
  location_ids?: number[] | null;
  package_ids?: number[] | null;
  attraction_ids?: number[] | null;
  event_ids?: number[] | null;
  created_at: string; // ISO string
  updated_at?: string; // ISO string
  deleted?: boolean;
}
