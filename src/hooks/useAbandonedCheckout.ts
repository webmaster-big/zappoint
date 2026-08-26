import { useCallback, useEffect, useRef } from 'react';
import checkoutConcernService, {
  type ConcernEntityType,
} from '../services/CheckoutConcernService';

export interface AbandonedCheckoutState {
  locationId?: number | null;
  name?: string;
  phone?: string;
  email?: string;
  entityType?: ConcernEntityType;
  entityId?: number | null;
  entityName?: string | null;
  preferredDate?: string;
  preferredTime?: string;
  stepLabel?: string;
  estimatedTotal?: number | null;
  items?: { name: string; quantity: number }[];
  reachedDetails?: boolean;
  completed?: boolean;
  enabled?: boolean;
}

const hasEnoughToCallThemBack = (state: AbandonedCheckoutState): boolean =>
  (state.name ?? '').trim().length >= 2 && (state.phone ?? '').replace(/\D/g, '').length >= 7;

export function useAbandonedCheckout(state: AbandonedCheckoutState): { reportNow: () => void } {
  const latest = useRef(state);
  latest.current = state;

  const everReachedDetails = useRef(false);
  if (state.reachedDetails) everReachedDetails.current = true;

  const furthestStepLabel = useRef<string | undefined>(undefined);
  if (state.reachedDetails && state.stepLabel) furthestStepLabel.current = state.stepLabel;

  const reported = useRef(false);

  const report = useCallback(() => {
    const current = latest.current;

    if (reported.current) return;
    if (current.enabled === false || current.completed) return;
    if (!current.locationId) return;
    if (!everReachedDetails.current) return;
    if (!hasEnoughToCallThemBack(current)) return;

    reported.current = true;

    checkoutConcernService.reportAbandonedCheckout({
      location_id: current.locationId,
      name: (current.name ?? '').trim(),
      phone: (current.phone ?? '').trim(),
      email: (current.email ?? '').trim() || undefined,
      entity_type: current.entityType,
      entity_id: current.entityId ?? undefined,
      entity_name: current.entityName ?? undefined,
      preferred_date: current.preferredDate || undefined,
      preferred_time: current.preferredTime || undefined,
      context: {
        step_label: furthestStepLabel.current ?? current.stepLabel,
        estimated_total: current.estimatedTotal ?? undefined,
        page_url: typeof window !== 'undefined' ? window.location.href : undefined,
        items: current.items,
      },
    });
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const onPageHide = (event: PageTransitionEvent) => {
      if (event.persisted) return;
      report();
    };

    window.addEventListener('pagehide', onPageHide);

    return () => window.removeEventListener('pagehide', onPageHide);
  }, [report]);

  return { reportNow: report };
}

export default useAbandonedCheckout;
