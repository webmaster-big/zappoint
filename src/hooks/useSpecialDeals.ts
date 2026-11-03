import { useEffect, useMemo, useState } from 'react';
import { specialPricingService } from '../services/SpecialPricingService';
import type { SpecialDealsResponse } from '../types/SpecialPricing.types';
import { dealDatesFor } from '../utils/discounts';

export function useSpecialDeals(
  entityType: 'package' | 'attraction' | 'event',
  entityId: number | null | undefined,
  locationId: number | null | undefined,
) {
  const [data, setData] = useState<SpecialDealsResponse | null>(null);

  useEffect(() => {
    if (!entityId) {
      setData(null);
      return;
    }
    let cancelled = false;
    specialPricingService
      .getDeals({ entity_type: entityType, entity_id: entityId, location_id: locationId || undefined, days: 180 })
      .then((res) => { if (!cancelled) setData(res); })
      .catch(() => { if (!cancelled) setData(null); });
    return () => { cancelled = true; };
  }, [entityType, entityId, locationId]);

  const dealDates = useMemo(() => dealDatesFor(data?.dates), [data]);

  return { deals: data?.deals ?? [], dealDates };
}
