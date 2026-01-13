// Types for: src/pages/admin/packages/AddOns.tsx

export interface AddOnsAddon {
  id: string;
  name: string;
  price: number;
  image: string;
  location: { id?: number; name?: string } | null;
  min_quantity?: number;
  max_quantity?: number;
}
