import { useEffect, useMemo, useState } from 'react';
import {
  fetchStorefrontBrand,
  primeStorefrontBrandLogo,
  readCachedStorefrontBrand,
  type StorefrontBrand,
} from '../services/StorefrontBrandService';

export const COMPANY_LOGO_UPDATED_EVENT = 'zapzone_company_logo_updated';

const readAdminCompanyLogo = (): string | null => {
  try {
    const stored = localStorage.getItem('company_logo_path');
    if (stored) return stored;

    const companyId = JSON.parse(localStorage.getItem('zapzone_user') || '{}')?.company_id;
    if (!companyId) return null;

    const cached = localStorage.getItem(`company_${companyId}`);
    const logoPath = cached ? JSON.parse(cached)?.logo_path : null;
    if (logoPath) {
      localStorage.setItem('company_logo_path', logoPath);
      return logoPath;
    }
  } catch {
    /* ignore malformed cache */
  }

  return null;
};

export interface CompanyBrand {
  name: string | null;
  logoPath: string | null;
}

export const useCompanyBrand = (): CompanyBrand => {
  const adminLogo = useMemo(readAdminCompanyLogo, []);
  const [brand, setBrand] = useState<StorefrontBrand | null>(
    () => readCachedStorefrontBrand() ?? { name: null, logo_path: readAdminCompanyLogo() },
  );

  useEffect(() => {
    const apply = (logoPath: string | null) => {
      if (!logoPath) return;
      primeStorefrontBrandLogo(logoPath);
      setBrand((prev) => ({ name: prev?.name ?? null, logo_path: logoPath }));
    };

    const sync = () => apply(readAdminCompanyLogo());
    const onCompanyLogo = (event: Event) =>
      apply((event as CustomEvent<{ logoPath?: string }>).detail?.logoPath ?? null);

    window.addEventListener(COMPANY_LOGO_UPDATED_EVENT, onCompanyLogo);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(COMPANY_LOGO_UPDATED_EVENT, onCompanyLogo);
      window.removeEventListener('storage', sync);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    fetchStorefrontBrand()
      .then((next) => {
        if (!cancelled && next) setBrand(next);
      })
      .catch(() => {
        /* keep whatever was cached */
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return {
    name: brand?.name ?? null,
    logoPath: brand?.logo_path ?? adminLogo,
  };
};

export default useCompanyBrand;
