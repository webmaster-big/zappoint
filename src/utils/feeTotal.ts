import { feeSupportService } from '../services/FeeSupportService';
import type { FeeBreakdown } from '../types/FeeSupport.types';

export const resolveFeeBreakdown = async (
  entityType: 'package' | 'attraction' | 'event',
  entityId: number,
  basePrice: number,
  locationId?: number,
): Promise<FeeBreakdown | null> => {
  try {
    const response = await feeSupportService.getForEntity({
      entity_type: entityType,
      entity_id: entityId,
      base_price: basePrice,
      location_id: locationId,
    });
    const total = response?.data?.total;
    return typeof total === 'number' && Number.isFinite(total) ? response.data : null;
  } catch {
    return null;
  }
};

export const resolveFeeTotal = async (
  entityType: 'package' | 'attraction' | 'event',
  entityId: number,
  basePrice: number,
  locationId?: number,
): Promise<number | null> => (await resolveFeeBreakdown(entityType, entityId, basePrice, locationId))?.total ?? null;
