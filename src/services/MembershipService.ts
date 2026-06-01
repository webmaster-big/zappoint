import axios from 'axios';
import { API_BASE_URL, getStoredUser } from '../utils/storage';
import type {
  Membership,
  MembershipPlan,
  MembershipEligibility,
  MembershipScanResponse,
  MembershipReportSummary,
  CreateMembershipPlanData,
  UpdateMembershipPlanData,
  PurchaseMembershipPayload,
  CheckInPayload,
  MembershipPlanBenefit,
  CreateMembershipPlanBenefitData,
  UpdateMembershipPlanBenefitData,
  MembershipBenefitQuote,
  MembershipBenefitQuoteRequest,
  MembershipBenefitRedemption,
  MembershipBenefitQuotePass,
  MembershipVisit,
} from '../types/Membership.types';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const admin = getStoredUser();
  let token: string | null = admin?.token || null;
  if (!token) {
    try {
      const raw = localStorage.getItem('zapzone_customer');
      const c = raw ? JSON.parse(raw) : null;
      token = c?.token || null;
    } catch {
    }
  }
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

function unwrap<T>(payload: unknown): T {
  if (payload && typeof payload === 'object' && 'data' in (payload as Record<string, unknown>)) {
    return (payload as { data: T }).data;
  }
  return payload as T;
}


async function listPlans(params: Record<string, unknown> = {}): Promise<MembershipPlan[]> {
  const res = await api.get('/membership-plans', { params });
  const payload = res.data?.data; // { success, data: <paginator|array> }
  if (payload && typeof payload === 'object' && Array.isArray(payload.data)) {
    return payload.data as MembershipPlan[];
  }
  if (Array.isArray(payload)) return payload;
  return [];
}

async function publicPlans(params: Record<string, unknown> = {}): Promise<MembershipPlan[]> {
  const res = await api.get('/membership-plans/public', { params });
  return unwrap<MembershipPlan[]>(res.data);
}

async function getPlan(id: number): Promise<MembershipPlan> {
  const res = await api.get(`/membership-plans/${id}`);
  return unwrap<MembershipPlan>(res.data);
}

async function createPlan(data: CreateMembershipPlanData): Promise<MembershipPlan> {
  const res = await api.post('/membership-plans', data);
  return unwrap<MembershipPlan>(res.data);
}

async function updatePlan(id: number, data: UpdateMembershipPlanData): Promise<MembershipPlan> {
  const res = await api.put(`/membership-plans/${id}`, data);
  return unwrap<MembershipPlan>(res.data);
}

async function deletePlan(id: number): Promise<void> {
  await api.delete(`/membership-plans/${id}`);
}

async function togglePlanStatus(id: number): Promise<MembershipPlan> {
  const res = await api.patch(`/membership-plans/${id}/toggle-status`);
  return unwrap<MembershipPlan>(res.data);
}


async function listMemberships(params: Record<string, unknown> = {}): Promise<{
  data: Membership[];
  meta?: Record<string, unknown>;
}> {
  const res = await api.get('/memberships', { params });
  const body = res.data;
  const payload = body?.data;
  if (payload && typeof payload === 'object' && Array.isArray(payload.data)) {
    const { data: items, ...meta } = payload as { data: Membership[] } & Record<string, unknown>;
    return { data: items, meta };
  }
  if (Array.isArray(payload)) return { data: payload };
  return { data: [] };
}

async function getMembership(id: number): Promise<Membership> {
  const res = await api.get(`/memberships/${id}`);
  return unwrap<Membership>(res.data);
}

async function myMembership(): Promise<Membership | null> {
  const res = await api.get('/memberships/me');
  const payload = unwrap<Membership | null>(res.data);
  return payload || null;
}

async function purchaseMembership(payload: PurchaseMembershipPayload): Promise<Membership> {
  const res = await api.post('/memberships/purchase', payload);
  return unwrap<Membership>(res.data);
}

async function createMembership(payload: Record<string, unknown>): Promise<Membership> {
  const res = await api.post('/memberships', payload);
  return unwrap<Membership>(res.data);
}

async function updateMembershipStatus(id: number, status: string, note?: string): Promise<Membership> {
  const res = await api.patch(`/memberships/${id}/status`, { status, note });
  return unwrap<Membership>(res.data);
}

async function freezeMembership(id: number, until: string, note?: string): Promise<Membership> {
  const res = await api.patch(`/memberships/${id}/freeze`, { until, note });
  return unwrap<Membership>(res.data);
}

async function cancelMembership(id: number, mode: 'immediate' | 'end_of_term', note?: string): Promise<Membership> {
  const res = await api.patch(`/memberships/${id}/cancel`, { effective: mode, note });
  return unwrap<Membership>(res.data);
}

async function changeMembershipPlan(id: number, newPlanId: number, note?: string): Promise<Membership> {
  const res = await api.patch(`/memberships/${id}/change-plan`, { membership_plan_id: newPlanId, note });
  return unwrap<Membership>(res.data);
}

async function updatePaymentMethod(
  id: number,
  payload: {
    payment_method_label: string;
    payment_profile_token?: string;
    opaque_data?: { dataDescriptor: string; dataValue: string };
  }
): Promise<Membership> {
  const res = await api.patch(`/memberships/${id}/payment-method`, payload);
  return unwrap<Membership>(res.data);
}

async function upgradePlan(
  id: number,
  newPlanId: number,
  opaqueData?: { dataDescriptor: string; dataValue: string },
): Promise<Membership> {
  const res = await api.post(`/memberships/${id}/upgrade-plan`, {
    membership_plan_id: newPlanId,
    ...(opaqueData ? { opaque_data: opaqueData } : {}),
  });
  return unwrap<Membership>(res.data);
}

async function retryPayment(id: number): Promise<void> {
  await api.post(`/memberships/${id}/retry-payment`);
}

async function refundMembershipPayment(
  membershipId: number,
  paymentId: number,
  amount?: number,
  note?: string,
): Promise<import('../types/Membership.types').MembershipPayment> {
  const res = await api.post(`/memberships/${membershipId}/payments/${paymentId}/refund`, {
    ...(amount !== undefined ? { amount } : {}),
    ...(note ? { note } : {}),
  });
  return unwrap<import('../types/Membership.types').MembershipPayment>(res.data);
}

async function voidMembershipPayment(
  membershipId: number,
  paymentId: number,
  note?: string,
): Promise<import('../types/Membership.types').MembershipPayment> {
  const res = await api.post(`/memberships/${membershipId}/payments/${paymentId}/void`, {
    ...(note ? { note } : {}),
  });
  return unwrap<import('../types/Membership.types').MembershipPayment>(res.data);
}

async function uploadMembershipPhoto(id: number, file: File | Blob): Promise<Membership> {
  const form = new FormData();
  form.append('photo', file);
  const res = await api.post(`/memberships/${id}/photo`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return unwrap<Membership>(res.data);
}

async function addMembershipNote(id: number, body: string): Promise<void> {
  await api.post(`/memberships/${id}/notes`, { content: body });
}

async function getEligibility(id: number, locationId?: number): Promise<MembershipEligibility> {
  const res = await api.get(`/memberships/${id}/eligibility`, {
    params: locationId ? { location_id: locationId } : {},
  });
  return unwrap<MembershipEligibility>(res.data);
}


async function scanMembershipQr(qrToken: string, locationId?: number): Promise<MembershipScanResponse> {
  const res = await api.post('/memberships/scan', { qr_token: qrToken, location_id: locationId });
  return unwrap<MembershipScanResponse>(res.data);
}

async function checkInMembership(id: number, payload: CheckInPayload): Promise<Membership> {
  const res = await api.post(`/memberships/${id}/check-in`, payload);
  return unwrap<Membership>(res.data);
}

async function redeemPass(
  membershipId: number,
  benefitId: number,
  locationId?: number,
  note?: string
): Promise<{ redemption: MembershipBenefitRedemption; visit: MembershipVisit; passes: MembershipBenefitQuotePass[] }> {
  const res = await api.post(`/memberships/${membershipId}/redeem-pass`, {
    benefit_id:  benefitId,
    location_id: locationId,
    note,
  });
  return unwrap(res.data);
}


async function reportSummary(params: { from?: string; to?: string; location_id?: number } = {}): Promise<MembershipReportSummary> {
  const res = await api.get('/membership-reports/summary', { params });
  return unwrap<MembershipReportSummary>(res.data);
}


async function listPlanBenefits(planId: number): Promise<MembershipPlanBenefit[]> {
  const res = await api.get(`/membership-plans/${planId}/benefits`);
  return unwrap<MembershipPlanBenefit[]>(res.data);
}

async function createPlanBenefit(planId: number, data: CreateMembershipPlanBenefitData): Promise<MembershipPlanBenefit> {
  const res = await api.post(`/membership-plans/${planId}/benefits`, data);
  return unwrap<MembershipPlanBenefit>(res.data);
}

async function updatePlanBenefit(
  planId: number,
  benefitId: number,
  data: UpdateMembershipPlanBenefitData,
): Promise<MembershipPlanBenefit> {
  const res = await api.put(`/membership-plans/${planId}/benefits/${benefitId}`, data);
  return unwrap<MembershipPlanBenefit>(res.data);
}

async function deletePlanBenefit(planId: number, benefitId: number): Promise<void> {
  await api.delete(`/membership-plans/${planId}/benefits/${benefitId}`);
}


async function quoteBenefits(payload: MembershipBenefitQuoteRequest): Promise<MembershipBenefitQuote> {
  const res = await api.post('/memberships/benefits/quote', payload);
  return unwrap<MembershipBenefitQuote>(res.data);
}

export const membershipService = {
  listPlans,
  publicPlans,
  getPlan,
  createPlan,
  updatePlan,
  deletePlan,
  togglePlanStatus,
  listMemberships,
  getMembership,
  myMembership,
  purchaseMembership,
  createMembership,
  updateMembershipStatus,
  freezeMembership,
  cancelMembership,
  changeMembershipPlan,
  updatePaymentMethod,
  upgradePlan,
  retryPayment,
  refundMembershipPayment,
  voidMembershipPayment,
  uploadMembershipPhoto,
  addMembershipNote,
  getEligibility,
  scanMembershipQr,
  checkInMembership,
  redeemPass,
  listPlanBenefits,
  createPlanBenefit,
  updatePlanBenefit,
  deletePlanBenefit,
  quoteBenefits,
  reportSummary,
};

export default membershipService;
