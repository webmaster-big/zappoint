// Types for: src/pages/admin/packages/GiftCard.tsx

export type GiftCardStatus = "active" | "inactive" | "expired" | "redeemed" | "cancelled" | "deleted";
export type GiftCardType = "fixed" | "percentage";

export interface GiftCardItem {
  code: string;
  type: GiftCardType;
  initial_value: number;
  balance: number;
  max_usage: number;
  description: string;
  status: GiftCardStatus;
  expiry_date?: string; // ISO string
  created_by: string; // admin id
  created_at: string; // ISO string
  updated_at?: string; // ISO string
  deleted?: boolean;
}
