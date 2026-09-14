import { useMemo } from 'react';
import { useCompanyBrand } from './useCompanyBrand';

export interface LocationBrandView {
  logoPath: string | null;
  name: string;
}

export const useLocationBrand = (
  locationLogoPath?: string | null,
  locationName?: string | null,
): LocationBrandView => {
  const company = useCompanyBrand();

  return useMemo(
    () => ({
      logoPath: locationLogoPath || company.logoPath,
      name: locationName || company.name || 'Zap Zone',
    }),
    [locationLogoPath, locationName, company.logoPath, company.name],
  );
};

export default useLocationBrand;
