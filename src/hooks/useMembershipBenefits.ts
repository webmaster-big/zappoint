import { useEffect, useRef, useState } from 'react';
import membershipService from '../services/MembershipService';
import type {
  MembershipBenefitQuoteItem,
  MembershipBenefitQuoteLine,
  MembershipBenefitQuotePass,
  MembershipBenefitQuote,
} from '../types/Membership.types';

export interface UseMembershipBenefitsResult {
  loading: boolean;
  membershipId: number | null;
  planName: string | null;
  discount: number;
  passes: MembershipBenefitQuotePass[];
  lines: MembershipBenefitQuoteLine[];
  applied: MembershipBenefitQuote['applied'];
  eligible: boolean;
  reason: string | null;
}

const EMPTY: UseMembershipBenefitsResult = {
  loading: false,
  membershipId: null,
  planName: null,
  discount: 0,
  passes: [],
  lines: [],
  applied: [],
  eligible: false,
  reason: null,
};

export function useMembershipBenefits(
  customerId: number | null | undefined,
  locationId: number | null | undefined,
  items: MembershipBenefitQuoteItem[],
  options: { self?: boolean } = {},
): UseMembershipBenefitsResult {
  const self = !!options.self;
  const [membershipId, setMembershipId] = useState<number | null>(null);
  const [result, setResult] = useState<UseMembershipBenefitsResult>(EMPTY);
  const lookupSeq = useRef(0);
  const quoteSeq = useRef(0);

  useEffect(() => {
    if (!self && !customerId) {
      setMembershipId(null);
      setResult(EMPTY);
      return;
    }
    const seq = ++lookupSeq.current;
    (async () => {
      try {
        let id: number | null = null;
        if (self) {
          const membership = await membershipService.myMembership();
          id = membership && (membership.status === 'active' || membership.status === 'past_due') ? membership.id : null;
        } else {
          // Fetch latest memberships for this customer (no status filter so past_due is included)
          const { data } = await membershipService.listMemberships({
            customer_id: customerId,
            per_page: 5,
          });
          const usable = data.find((m) => m.status === 'active' || m.status === 'past_due');
          id = usable?.id ?? null;
        }
        if (seq !== lookupSeq.current) return;
        setMembershipId(id);
      } catch {
        if (seq !== lookupSeq.current) return;
        setMembershipId(null);
      }
    })();
  }, [self, customerId]);

  const itemsKey = JSON.stringify(items);
  useEffect(() => {
    if (!membershipId || items.length === 0) {
      setResult({ ...EMPTY, membershipId });
      return;
    }
    const seq = ++quoteSeq.current;
    setResult((prev) => ({ ...prev, loading: true, membershipId }));
    (async () => {
      try {
        const quote = await membershipService.quoteBenefits({
          location_id: locationId ?? null,
          membership_id: membershipId,
          items,
        });
        if (seq !== quoteSeq.current) return;
        setResult({
          loading: false,
          membershipId,
          planName: quote.plan_name ?? null,
          discount: Number(quote.currency_discount || 0),
          passes: quote.passes || [],
          lines: quote.lines || [],
          applied: quote.applied || [],
          eligible: !!quote.eligible,
          reason: quote.reason ?? null,
        });
      } catch {
        if (seq !== quoteSeq.current) return;
        setResult({ ...EMPTY, membershipId });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [membershipId, locationId, itemsKey]);

  return result;
}

export default useMembershipBenefits;
