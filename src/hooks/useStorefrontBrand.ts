import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useStorefrontLocations } from './useStorefrontLocations';
import { useCompanyBrand } from './useCompanyBrand';
import {
  findLocationBySlug,
  findLocationById,
  type StorefrontLocation,
} from '../services/StorefrontLocationService';
import { useCartSafe } from '../contexts/CartContext';

const CART_SCOPED_ROOTS = ['cart', 'checkout'];
const PURCHASE_ROOT = 'purchase';

export interface StorefrontBrandView {
  location: StorefrontLocation | null;
  logoPath: string | null;
  homeHref: string;
  name: string;
}

const slugSegmentOf = (segments: string[]): string | undefined => {
  if (segments[0] === PURCHASE_ROOT) return segments[2];
  return segments[0];
};

export const useStorefrontBrand = (): StorefrontBrandView => {
  const { pathname } = useLocation();
  const { locations } = useStorefrontLocations();
  const company = useCompanyBrand();
  const cartLocationId = useCartSafe()?.locationId ?? null;

  return useMemo(() => {
    const segments = pathname.split('/').filter(Boolean);
    const bySlug = findLocationBySlug(locations, slugSegmentOf(segments));
    const fromCart = CART_SCOPED_ROOTS.includes(segments[0])
      ? findLocationById(locations, cartLocationId)
      : null;
    const location = bySlug ?? fromCart;

    return {
      location,
      logoPath: location?.logo_path ?? company.logoPath,
      homeHref: location ? `/${location.slug}` : '/',
      name: location?.name ?? company.name ?? 'Zap Zone',
    };
  }, [pathname, locations, cartLocationId, company.logoPath, company.name]);
};

export default useStorefrontBrand;
