// Types for: src/pages/admin/packages/AddOns.tsx

export interface PackageSpecificPrice {
  package_id: number;
  price: number;
  minimum_quantity: number;
}

export interface AddOnsAddon {
  id: string;
  name: string;
  price: number | null;
  image: string;
  description?: string;
  location: { id?: number; name?: string } | null;
  min_quantity?: number;
  max_quantity?: number;
  is_force_add_on?: boolean;
  price_each_packages?: PackageSpecificPrice[] | null;
}
