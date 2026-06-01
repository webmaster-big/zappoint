
export type MembershipBillingInterval = 'monthly' | 'quarterly' | 'annual' | 'one_time';
export type MembershipUsageType = 'unlimited' | 'limited_visits' | 'punch_card';
export type MembershipLocationAccessMode = 'single' | 'multi' | 'all';
export type MembershipCancellationMode = 'immediate' | 'end_of_term' | 'staff_only';

export type MembershipStatus =
  | 'pending'
  | 'active'
  | 'past_due'
  | 'suspended'
  | 'frozen'
  | 'canceled'
  | 'expired';

export interface MembershipPlanLocationRef {
  id: number;
  name?: string;
}

export type MembershipBenefitType =
  | 'package_discount'
  | 'attraction_discount'
  | 'event_discount'
  | 'addon_discount'
  | 'free_entry_pass'
  | 'guest_pass'
  | 'priority_booking'
  | 'member_only_access'
  | 'birthday_reward';

export type MembershipBenefitScopeType =
  | 'any'
  | 'package'
  | 'attraction'
  | 'event'
  | 'addon'
  | 'category'
  | 'location';

export type MembershipBenefitValueMode = 'percent' | 'fixed' | 'free' | 'count' | 'flag';

export type MembershipBenefitPeriod =
  | 'per_term'
  | 'per_day'
  | 'lifetime';

export interface MembershipPlanBenefit {
  id: number;
  membership_plan_id: number;
  benefit_type: MembershipBenefitType;
  label?: string | null;
  scope_type: MembershipBenefitScopeType;
  scope_id?: number | null;
  scope_ids?: number[] | null;
  scope_category?: string | null;
  value_mode: MembershipBenefitValueMode;
  value: number;
  period?: MembershipBenefitPeriod | null;
  max_redemptions?: number | null;
  priority: number;
  is_stackable: boolean;
  conditions?: Record<string, unknown> | null;
  is_active: boolean;
  requires_manual_redemption: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface CreateMembershipPlanBenefitData {
  benefit_type: MembershipBenefitType;
  label?: string | null;
  scope_type: MembershipBenefitScopeType;
  scope_id?: number | null;
  scope_ids?: number[] | null;
  scope_category?: string | null;
  value_mode: MembershipBenefitValueMode;
  value?: number;
  period?: MembershipBenefitPeriod | null;
  max_redemptions?: number | null;
  priority?: number;
  is_stackable?: boolean;
  conditions?: Record<string, unknown> | null;
  is_active?: boolean;
  requires_manual_redemption?: boolean;
}

export type UpdateMembershipPlanBenefitData = Partial<CreateMembershipPlanBenefitData>;

export interface MembershipBenefitQuoteItem {
  type: 'package' | 'attraction' | 'event' | 'addon';
  id?: number | null;
  category?: string | null;
  unit_price: number;
  quantity?: number;
}

export interface MembershipBenefitQuoteLine {
  index: number;
  type: string;
  id?: number | null;
  line_total: number;
  discount: number;
  benefits: Array<{
    benefit_id: number;
    benefit_type: MembershipBenefitType;
    label?: string | null;
    value_mode: MembershipBenefitValueMode;
    amount: number;
  }>;
}

export interface MembershipBenefitQuotePass {
  benefit_id: number;
  benefit_type: MembershipBenefitType;
  label?: string | null;
  remaining: number | null;
}

export interface MembershipBenefitQuote {
  eligible: boolean;
  reason?: string | null;
  membership_id?: number | null;
  plan_name?: string | null;
  currency_discount: number;
  lines: MembershipBenefitQuoteLine[];
  passes: MembershipBenefitQuotePass[];
  applied: Array<{
    membership_plan_benefit_id: number | null;
    benefit_type: MembershipBenefitType;
    value_mode: MembershipBenefitValueMode;
    value_applied: number;
  }>;
}

export interface MembershipBenefitQuoteRequest {
  location_id?: number | null;
  membership_id?: number | null;
  items: MembershipBenefitQuoteItem[];
}

export interface MembershipBenefitRedemption {
  id: number;
  membership_id: number;
  customer_id: number;
  membership_plan_benefit_id?: number | null;
  location_id?: number | null;
  benefit_type: MembershipBenefitType;
  value_mode: MembershipBenefitValueMode;
  value_applied: number;
  redeemable_type?: string | null;
  redeemable_id?: number | null;
  staff_user_id?: number | null;
  reversed_at?: string | null;
  reversal_reason?: string | null;
  created_at?: string;
  updated_at?: string;
  // eager-loaded
  benefit?: { id: number; label?: string | null; benefit_type: MembershipBenefitType } | null;
  staff?: { id: number; first_name: string; last_name: string } | null;
}

export interface MembershipPlan {
  id: number;
  company_id: number;
  name: string;
  slug?: string | null;
  description?: string | null;
  tier?: string | null;
  price: number;
  billing_interval: MembershipBillingInterval;
  billing_cycle?: 'monthly' | 'annual' | 'custom' | null;
  custom_billing_days?: number | null;
  trial_days: number;            // 0 = no trial; backend default is 0
  term_length_months?: number | null;

  usage_type: MembershipUsageType;
  unlimited_uses: boolean;
  unlimited_visits: boolean;
  included_visits_per_term?: number | null;
  max_visits_per_day?: number | null;
  punch_card_total?: number | null;

  location_access_mode: MembershipLocationAccessMode;
  location?: { id: number; name: string } | null;
  approved_locations?: MembershipPlanLocationRef[];
  valid_locations?: string[];
  location_access_label?: string | null;

  grace_period_days: number;
  failed_payment_retry_days: number;
  cancellation_mode: MembershipCancellationMode;

  discount_percent?: number | null;
  benefits?: string[] | null;
  plan_benefits?: MembershipPlanBenefit[];
  inherits_plan_id?: number | null;
  inherits_plan?: { id: number; name: string; plan_benefits?: MembershipPlanBenefit[] } | null;

  requires_photo: boolean;
  is_family_or_group: boolean;
  max_family_size?: number | null;

  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface MembershipVisit {
  id: number;
  membership_id: number;
  customer_id?: number | null;
  location_id?: number | null;
  staff_user_id?: number | null;
  visited_at: string;
  result: 'allowed' | 'denied' | 'override';
  denial_reason?: string | null;
  counted_against_usage: boolean;
  visits_remaining_after?: number | null;
  notes?: string | null;
  location?: { id: number; name: string } | null;
  staff?: { id: number; first_name: string; last_name: string } | null;
}

export interface MembershipPayment {
  id: number;
  membership_id: number;
  payment_id?: number | null;
  customer_id?: number | null;
  amount: number;
  status: 'succeeded' | 'failed' | 'pending' | 'refunded' | 'voided';
  transaction_id?: string | null;
  description?: string | null;
  retry_attempt?: number;
  charged_at?: string | null;
  failed_at?: string | null;
  failure_reason?: string | null;
}

export interface MembershipNote {
  id: number;
  membership_id: number;
  author_user_id?: number | null;
  body: string;
  created_at: string;
}

export interface MembershipAuditLog {
  id: number;
  membership_id: number;
  user_id?: number | null;
  customer_id?: number | null;
  actor_type?: string | null;
  action: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  note?: string | null;
  created_at: string;
  user?: { id: number; first_name: string; last_name: string } | null;
}

export interface MembershipCustomerRef {
  id: number;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
}

export interface MembershipLocationRef {
  id: number;
  name?: string;
}

export interface Membership {
  id: number;
  customer_id: number;
  membership_plan_id: number;
  membership_group_id?: number | null;
  home_location_id?: number | null;
  sold_at_location_id?: number | null;

  status: MembershipStatus;
  qr_token: string;

  started_at?: string | null;
  current_term_start?: string | null;
  current_term_end?: string | null;
  grace_period_ends_at?: string | null;
  frozen_until?: string | null;
  canceled_at?: string | null;
  cancel_at_period_end: boolean;
  expires_at?: string | null;

  visits_remaining?: number | null;
  visits_used_this_term: number;
  last_visit_at?: string | null;

  photo_path?: string | null;
  photo_taken_at?: string | null;
  photo_by_user_id?: number | null;

  payment_method_label?: string | null;
  payment_profile_token?: string | null;
  recurring_billing_authorized: boolean;
  terms_accepted: boolean;
  is_comped: boolean;
  billing_amount?: number | null;

  customer?: MembershipCustomerRef;
  plan?: MembershipPlan;
  home_location?: MembershipLocationRef;
  sold_at_location?: MembershipLocationRef;
  visits?: MembershipVisit[];
  membership_payments?: MembershipPayment[];
  notes?: MembershipNote[];
  audit_logs?: MembershipAuditLog[];
  benefit_redemptions?: MembershipBenefitRedemption[];

  valid_locations?: string[];
  location_access_label?: string | null;

  created_at: string;
  updated_at: string;
}

export interface MembershipEligibility {
  eligible: boolean;
  reason?: string | null;
  photo_required: boolean;
}

export interface MembershipScanResponse {
  membership: Membership;
  eligibility: MembershipEligibility;
  photo_required: boolean;
  visits_today: number;
  passes?: MembershipBenefitQuotePass[];
}

export interface MembershipReportSummary {
  counts: {
    active: number;
    past_due: number;
    suspended: number;
    frozen: number;
    canceled_in_range: number;
    new_in_range: number;
  };
  mrr: number;
  arr: number;
  failed_payments: number;
  revenue_in_range: number;
  visits_by_location: Array<{ location_id: number; location_name?: string; visits: number }>;
  top_plans: Array<{ plan_id: number; name: string; count: number }>;
  underused_sample: Array<{
    id: number;
    customer_id: number;
    customer_name?: string | null;
    customer_email?: string | null;
    plan_name?: string | null;
    visits_per_term: number;
    visits_used_this_term: number;
    visits_remaining: number;
    term_ends?: string | null;
  }>;
  date_range: { from: string; to: string };
}

export interface CreateMembershipPlanData {
  name: string;
  description?: string | null;
  price: number;
  billing_interval: MembershipBillingInterval;
  trial_days?: number;           // 0 = no trial; >0 = free days before first charge
  term_length_months?: number | null;
  usage_type: MembershipUsageType;
  unlimited_uses?: boolean;
  unlimited_visits?: boolean;
  included_visits_per_term?: number | null;
  max_visits_per_day?: number | null;
  punch_card_total?: number | null;
  location_access_mode: MembershipLocationAccessMode;
  location_id?: number | null;        // ID of the single-mode location
  location_name?: string | null;       // Name alternative — backend resolves to ID
  approved_location_ids?: number[];
  approved_location_names?: string[]; // Alternative to IDs — backend resolves by name
  grace_period_days?: number;
  failed_payment_retry_days?: number;
  cancellation_mode?: MembershipCancellationMode;
  discount_percent?: number | null;
  benefits?: string[] | null;
  requires_photo?: boolean;
  is_family_or_group?: boolean;
  max_family_size?: number | null;
  is_active?: boolean;
}

export type UpdateMembershipPlanData = Partial<CreateMembershipPlanData>;

export interface PurchaseMembershipPayload {
  membership_plan_id: number;
  home_location_id?: number | null;
  home_location_name?: string | null; // Alternative to ID — backend resolves by name
  payment_profile_token?: string | null;
  opaque_data?: { dataDescriptor: string; dataValue: string } | null;
  terms_accepted: boolean;
  recurring_billing_authorized: boolean;
}

export interface CheckInPayload {
  result: 'allowed' | 'denied' | 'override';
  location_id: number;
  override_note?: string;
  photo_base64?: string;
}
