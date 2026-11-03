
import type { SpecialDeal, SpecialPricingBreakdown } from '../types/SpecialPricing.types';
import type { UseMembershipBenefitsResult } from '../hooks/useMembershipBenefits';
import { michiganTodayKey } from './dashboardTimeframe';

export interface AppliedDiscount {
  discount_name: string;
  discount_amount: number;
  discount_type: 'fixed' | 'percentage';
  original_price: number;
  special_pricing_id: number | null;
  source?: 'special_pricing' | 'membership' | 'promo' | 'gift_card';
  code?: string;
  promo_id?: number;
  gift_card_id?: number;
  discount_label?: string;
  unit_discount_amount?: number;
  quantity?: number;
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
    source: 'special_pricing' as const,
    discount_label: d.discount_label,
    unit_discount_amount: d.unit_discount_amount,
    quantity: d.quantity,
  }));
}

export function isSpecialPricingDiscount(d: { source?: string; special_pricing_id?: number | null }): boolean {
  return d.source === 'special_pricing' || !!d.special_pricing_id;
}

export function specialPricingTotal(discounts: Array<{ source?: string; special_pricing_id?: number | null; discount_amount: number }> | null | undefined): number {
  return Math.round((discounts ?? []).filter(isSpecialPricingDiscount).reduce((sum, d) => sum + Number(d.discount_amount || 0), 0) * 100) / 100;
}

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const ordinal = (n: number) => {
  if ([11, 12, 13].includes(n % 100)) return `${n}th`;
  return `${n}${({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th'}`;
};

const formatClock = (time: string) => {
  const [h, m] = time.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
};

const shortDate = (date: string) => new Date(`${date.split('T')[0]}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

const dealWindow = (deal: Pick<SpecialDeal, 'recurrence_type' | 'start_date' | 'end_date'>): string => {
  if (deal.recurrence_type === 'one_time') return '';
  const from = deal.start_date && deal.start_date.split('T')[0] > michiganTodayKey() ? ` from ${shortDate(deal.start_date)}` : '';
  const through = deal.end_date ? ` through ${shortDate(deal.end_date)}` : '';
  return `${from}${through}`;
};

const dealHours = (deal: Pick<SpecialDeal, 'time_start' | 'time_end'>): string => {
  if (deal.time_start && deal.time_end) return `, ${formatClock(deal.time_start)}–${formatClock(deal.time_end)}`;
  if (deal.time_start) return ` from ${formatClock(deal.time_start)}`;
  if (deal.time_end) return ` until ${formatClock(deal.time_end)}`;
  return '';
};

export function perTicketLabel(d: { discount_label?: string | null; discount_type?: string | null; quantity?: number | null }): string {
  if (!d.discount_label) return '';
  return d.discount_type === 'fixed' && (d.quantity ?? 1) > 1 ? `${d.discount_label} each` : d.discount_label;
}

export function perTicketOffLabel(d: { discount_label?: string | null; discount_type?: string | null; quantity?: number | null }): string {
  if (!d.discount_label) return '';
  return d.discount_type === 'fixed' && (d.quantity ?? 1) > 1 ? `${d.discount_label} off each` : `${d.discount_label} off`;
}

export function specialDealWhen(deal: Pick<SpecialDeal, 'recurrence_type' | 'recurrence_value' | 'specific_date' | 'time_start' | 'time_end' | 'recurrence_display' | 'start_date' | 'end_date'>): string {
  let when = deal.recurrence_display;
  if (deal.recurrence_type === 'weekly' && deal.recurrence_value != null) {
    when = `on ${WEEKDAY_NAMES[deal.recurrence_value]}s`;
  } else if (deal.recurrence_type === 'monthly' && deal.recurrence_value != null) {
    when = `on the ${ordinal(deal.recurrence_value)} of each month`;
  } else if (deal.recurrence_type === 'one_time' && deal.specific_date) {
    when = `on ${new Date(`${deal.specific_date}T00:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}`;
  }
  return `${when}${dealHours(deal)}${dealWindow(deal)}`;
}

export function specialDealHeadline(deal: SpecialDeal, unit: 'ticket' | 'person' | 'booking' = 'ticket'): string {
  const amount = deal.discount_type === 'fixed'
    ? `${deal.discount_label} off ${unit === 'booking' ? 'the booking' : `each ${unit}`}`
    : `${deal.discount_label} off`;
  return `${amount} ${deal.discount_type === 'fixed' ? 'for visits' : 'visits'} ${specialDealWhen(deal)}`;
}

export function specialDealBadge(deal: SpecialDeal): string {
  const short = deal.recurrence_type === 'weekly' && deal.recurrence_value != null
    ? `${WEEKDAY_NAMES[deal.recurrence_value]}s`
    : deal.recurrence_type === 'monthly' && deal.recurrence_value != null
      ? `the ${ordinal(deal.recurrence_value)} monthly`
      : deal.specific_date
        ? new Date(`${deal.specific_date}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        : '';
  const where = deal.applies_at_every_location === false && deal.location_names && deal.location_names.length > 0
    ? ` · ${deal.location_names.join(', ')}`
    : '';
  return `${deal.discount_label} off${short ? ` ${short}` : ''}${dealHours(deal)}${dealWindow(deal)}${where}`;
}

export function dealDatesFor(dates: Record<string, Array<{ discount_label: string }>> | null | undefined): Record<string, string> | undefined {
  if (!dates) return undefined;
  const entries = Object.entries(dates).filter(([, list]) => list.length > 0);
  if (entries.length === 0) return undefined;
  return Object.fromEntries(entries.map(([date, list]) => [date, list.map((d) => `${d.discount_label} off`).join(', ')]));
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
