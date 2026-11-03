import { useCallback, useEffect, useRef, useState } from 'react';
import { specialPricingService } from '../services/SpecialPricingService';
import { isSpecialPricingDiscount, specialPricingTotal, type AppliedDiscount } from '../utils/discounts';

interface Visit {
  entityId: number | null;
  date: string;
  time: string;
  quantity: number;
}

interface SpecialRepricingOptions {
  entityType: 'attraction' | 'event';
  purchaseId: number | null;
  ready: boolean;
  isOrderLine: boolean;
  original: Visit;
  current: Visit;
  originalSpecial: AppliedDiscount[];
  appliedDiscounts: AppliedDiscount[];
  setAppliedDiscounts: (list: AppliedDiscount[]) => void;
  discountAmount: number;
  setDiscountAmount: (value: number) => void;
  dateWord: string;
}

const cents = (n: number) => Math.round(n * 100) / 100;
const money = (n: number) => `$${n.toFixed(2)}`;
const idsOf = (list: AppliedDiscount[]) => list.map((d) => d.special_pricing_id ?? d.discount_name).join('|');
const namesOf = (list: AppliedDiscount[]) => list.map((d) => d.discount_name).join(', ');
const hhmm = (time: string) => (time || '').slice(0, 5);

export function useSpecialRepricing(options: SpecialRepricingOptions) {
  const [notice, setNotice] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const latest = useRef(options);
  latest.current = options;
  const rawDiscount = useRef<number | null>(null);
  const lastSetDiscount = useRef<number | null>(null);

  const { ready, isOrderLine, entityType, purchaseId, dateWord } = options;
  const { entityId, date, time, quantity } = options.current;
  const { entityId: originalEntityId, date: originalDate, time: originalTime, quantity: originalQuantity } = options.original;

  useEffect(() => {
    const applySpecial = (target: AppliedDiscount[]) => {
      const { appliedDiscounts, discountAmount, setAppliedDiscounts, setDiscountAmount } = latest.current;
      const currentSpecial = appliedDiscounts.filter(isSpecialPricingDiscount);
      const delta = cents(specialPricingTotal(target) - specialPricingTotal(currentSpecial));
      if (Math.abs(delta) < 0.005 && idsOf(target) === idsOf(currentSpecial)) return;

      const base = rawDiscount.current !== null && lastSetDiscount.current === discountAmount ? rawDiscount.current : discountAmount;
      const raw = cents(base + delta);
      rawDiscount.current = raw;
      lastSetDiscount.current = Math.max(0, raw);
      setAppliedDiscounts([...target, ...appliedDiscounts.filter((d) => !isSpecialPricingDiscount(d))]);
      setDiscountAmount(Math.max(0, raw));
    };

    if (!ready || !purchaseId || !entityId || !date) {
      setChecking(false);
      setFailed(false);
      return;
    }

    const sameTime = hhmm(time) === hhmm(originalTime);
    const sameVisit = date === originalDate && sameTime && quantity === originalQuantity && entityId === originalEntityId;

    if (sameVisit) {
      setChecking(false);
      setFailed(false);
      setNotice(null);
      if (!isOrderLine) applySpecial(latest.current.originalSpecial);
      return;
    }

    let cancelled = false;
    setChecking(true);
    setFailed(false);
    const handle = window.setTimeout(async () => {
      try {
        const quote = await specialPricingService.quotePurchaseSpecial(
          entityType,
          purchaseId,
          entityType === 'attraction'
            ? { attraction_id: entityId, quantity, scheduled_date: date, scheduled_time: hhmm(time) || null }
            : { quantity, purchase_date: date, purchase_time: hhmm(time) || null }
        );
        if (cancelled) return;

        const target = quote.special_discounts;
        if (!isOrderLine) applySpecial(target);

        const where = date !== originalDate
          ? `on the new ${dateWord}`
          : !sameTime
            ? 'at the new time'
            : entityId !== originalEntityId
              ? 'for the new attraction'
              : `for ${quantity} ticket${quantity === 1 ? '' : 's'}`;

        if (!quote.changed) {
          setNotice(null);
        } else if (isOrderLine) {
          setNotice(`The special price ${where} would be ${money(quote.proposed_special)} off (these tickets got ${money(quote.given_special)} off). Bulk-order tickets keep the price that was paid.`);
        } else if (target.length === 0) {
          setNotice(`${namesOf(latest.current.originalSpecial) || 'The special price'} does not apply ${where} — the ${money(quote.given_special)} special discount is removed.`);
        } else {
          setNotice(`${namesOf(target)} applies ${where}: ${money(quote.special_pricing_discount)} off (was ${money(quote.given_special)} off).`);
        }
      } catch {
        if (!cancelled) {
          setFailed(true);
          setNotice('Could not check the special price for this change. Try again before saving.');
        }
      } finally {
        if (!cancelled) setChecking(false);
      }
    }, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [ready, purchaseId, isOrderLine, entityType, entityId, date, time, quantity, dateWord, originalEntityId, originalDate, originalTime, originalQuantity, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  return { notice, checking, failed: failed && !isOrderLine, retry };
}
