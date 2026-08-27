export interface AddOnQtyRules {
  min_quantity?: number | null;
  max_quantity?: number | null;
  is_force_add_on?: boolean;
  price_each_packages?: Array<{ package_id: number; price: number; minimum_quantity: number }> | null;
}

export const isForceAddOn = (addOn: AddOnQtyRules | undefined | null, packageId: number | null | undefined): boolean => {
  if (!addOn?.is_force_add_on || packageId == null) return false;
  if (Array.isArray(addOn.price_each_packages) && addOn.price_each_packages.length > 0) {
    return addOn.price_each_packages.some(p => Number(p.package_id) === Number(packageId));
  }
  return false;
};

export const getAddOnMinQuantity = (addOn: AddOnQtyRules | undefined | null, packageId: number | null | undefined): number => {
  if (packageId != null && Array.isArray(addOn?.price_each_packages) && addOn.price_each_packages.length > 0) {
    const match = addOn.price_each_packages.find(p => Number(p.package_id) === Number(packageId));
    if (match) return Math.max(1, Number(match.minimum_quantity) || 1);
  }
  return Math.max(0, Number(addOn?.min_quantity) || 0);
};

export const clampAddOnQuantity = (
  addOn: AddOnQtyRules | undefined | null,
  packageId: number | null | undefined,
  currentQty: number,
  requestedQty: number,
): number => {
  const forced = isForceAddOn(addOn, packageId);
  const minQty = forced ? Math.max(1, getAddOnMinQuantity(addOn, packageId)) : getAddOnMinQuantity(addOn, packageId);
  const maxQty = addOn?.max_quantity ?? 99;
  let qty = Number.isFinite(requestedQty) ? Math.floor(requestedQty) : 0;
  if (qty > maxQty) qty = maxQty;
  if (forced) return Math.max(minQty, qty);
  if (qty > 0 && qty < minQty) qty = qty < currentQty ? 0 : minQty;
  return Math.max(0, qty);
};

export const seedForcedAddOns = (
  pkg: { id: number; add_ons?: Array<AddOnQtyRules & { id: number }> | null } | null | undefined,
): { [id: number]: number } => {
  const seeded: { [id: number]: number } = {};
  if (!pkg) return seeded;
  (pkg.add_ons || []).forEach(addOn => {
    if (isForceAddOn(addOn, pkg.id)) seeded[addOn.id] = Math.max(1, getAddOnMinQuantity(addOn, pkg.id));
  });
  return seeded;
};
