import type { Membership, MembershipPlan } from '../types/Membership.types';

export const MEMBERSHIP_STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-800',
  pending: 'bg-yellow-100 text-yellow-800',
  past_due: 'bg-orange-100 text-orange-800',
  suspended: 'bg-red-100 text-red-800',
  frozen: 'bg-blue-100 text-blue-800',
  canceled: 'bg-gray-100 text-gray-800',
  expired: 'bg-gray-100 text-gray-800',
};

export const MEMBERSHIP_STATUS_LABELS: Record<string, string> = {
  active: 'Active',
  pending: 'Pending',
  past_due: 'Past Due',
  suspended: 'Suspended',
  frozen: 'Frozen',
  canceled: 'Canceled',
  expired: 'Expired',
};

export function membershipStatusBadgeClass(status: string): string {
  return MEMBERSHIP_STATUS_COLORS[status] || 'bg-gray-100 text-gray-700';
}

export function membershipStatusLabel(status: string): string {
  return MEMBERSHIP_STATUS_LABELS[status] || status.replace(/_/g, ' ');
}

export function formatMembershipDate(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString();
}

export function formatMembershipPrice(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '$0.00';
  const n = typeof value === 'string' ? parseFloat(value) : value;
  if (Number.isNaN(n)) return '$0.00';
  return `$${n.toFixed(2)}`;
}

export function billingIntervalLabel(
  plan: Pick<MembershipPlan, 'billing_interval'> | null | undefined,
): string {
  if (!plan?.billing_interval) return '—';
  const v = String(plan.billing_interval);
  return v.charAt(0).toUpperCase() + v.slice(1).replace(/_/g, ' ');
}

export function usageSummary(
  plan: MembershipPlan | null | undefined,
  m: Membership | null | undefined,
): string {
  if (!plan) return '—';
  if (plan.unlimited_uses || plan.unlimited_visits) {
    return 'Unlimited this term';
  }
  if (plan.included_visits_per_term && m) {
    return `${m.visits_used_this_term ?? 0} of ${plan.included_visits_per_term} visits used`;
  }
  return '—';
}
