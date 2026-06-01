
import type { SpecialPricingBreakdown } from '../types/SpecialPricing.types';
import type { UseMembershipBenefitsResult } from '../hooks/useMembershipBenefits';

export interface AppliedDiscount {
  discount_name: string;
  discount_amount: number;
  discount_type: 'fixed' | 'percentage';
  original_price: number;
  special_pricing_id: number | null;
}

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
 * Build AppliedDiscount entries for membership benefit savings.
 * Pass an optional `getItemName` to resolve human-readable names for each discounted item.
 * Returns [] when no discount applies so callers can spread safely.
 */
export function buildMembershipDiscount(
  membershipBenefits: Pick<UseMembershipBenefitsResult, 'discount' | 'planName' | 'lines'>,
  originalSubtotal: number,
  getItemName?: (type: string, id: number | null | undefined) => string | undefined,
): AppliedDiscount[] {
  if (!membershipBenefits.discount || membershipBenefits.discount <= 0) return [];

  const plan = membershipBenefits.planName ? ` (${membershipBenefits.planName})` : '';

  // Per-line breakdown – one entry per discounted item.
  if (membershipBenefits.lines && membershipBenefits.lines.length > 0) {
    return membershipBenefits.lines
      .filter((line) => line.discount > 0)
      .map((line) => {
        const itemName = getItemName?.(line.type, line.id);
        const typeLabel = line.type.charAt(0).toUpperCase() + line.type.slice(1); // e.g. "Package"
        const label = itemName
          ? `${itemName} — Member Savings${plan}`
          : `${typeLabel} — Member Savings${plan}`;
        return {
          discount_name: label,
          discount_amount: line.discount,
          discount_type: 'fixed' as const,
          original_price: line.line_total,
          special_pricing_id: null,
        };
      });
  }

  // Fallback: single summary entry.
  return [{
    discount_name: `Member Savings${plan}`,
    discount_amount: membershipBenefits.discount,
    discount_type: 'fixed' as const,
    original_price: originalSubtotal,
    special_pricing_id: null,
  }];
}

export function getTotalDiscountAmount(appliedDiscounts: AppliedDiscount[] | null): number {
  if (!appliedDiscounts) return 0;
  return appliedDiscounts.reduce((sum, d) => sum + d.discount_amount, 0);
}
