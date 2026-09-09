import { feeSupportService } from '../services/FeeSupportService';

export const resolveFeeTotal = async (
  entityType: 'package' | 'attraction' | 'event',
  entityId: number,
  basePrice: number,
  locationId?: number,
): Promise<number | null> => {
  try {
    const response = await feeSupportService.getForEntity({
      entity_type: entityType,
      entity_id: entityId,
      base_price: basePrice,
      location_id: locationId,
    });
    const total = response?.data?.total;
    return typeof total === 'number' && Number.isFinite(total) ? total : null;
  } catch {
    return null;
  }
};
