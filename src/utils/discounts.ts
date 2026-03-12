// Applied Discounts utilities for booking/purchase discount snapshots

import type { SpecialPricingBreakdown } from '../types/SpecialPricing.types';

/**
 * Represents a discount snapshot stored on a booking/purchase record.
 * Captures the exact discounts applied at the time of purchase.
 */
export interface AppliedDiscount {
  discount_name: string;
  discount_amount: number;
  discount_type: 'fixed' | 'percentage';
  original_price: number;
  special_pricing_id: number | null;
}

/**
 * Build an applied_discounts array from the special pricing breakdown.
 * This creates a snapshot of the discounts at the time of booking/purchase.
 */
export function buildAppliedDiscounts(breakdown: SpecialPricingBreakdown | null): AppliedDiscount[] {
  if (!breakdown || !breakdown.has_special_pricing || !breakdown.discounts_applied || breakdown.discounts_applied.length === 0) {
    return [];
  }

  return breakdown.discounts_applied.map((d) => ({
    discount_name: d.name,
    discount_amount: d.discount_amount,
    discount_type: d.discount_type,
    original_price: breakdown.original_price,
    special_pricing_id: d.special_pricing_id,
  }));
}

/**
 * Get the total discount amount from applied discounts.
 */
export function getTotalDiscountAmount(appliedDiscounts: AppliedDiscount[] | null): number {
  if (!appliedDiscounts) return 0;
  return appliedDiscounts.reduce((sum, d) => sum + d.discount_amount, 0);
}
