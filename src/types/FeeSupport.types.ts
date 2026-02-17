// Types for Fee Support feature

export interface FeeSupport {
  id: number;
  company_id: number;
  location_id: number | null;
  fee_name: string;
  fee_amount: string; // Decimal string from API
  fee_calculation_type: 'fixed' | 'percentage';
  fee_application_type: 'additive' | 'inclusive';
  entity_ids: number[];
  entity_type: 'package' | 'attraction';
  is_active: boolean;
  created_at: string;
  updated_at: string;
  company?: { id: number; name: string };
  location?: { id: number; name: string } | null;
}

export interface FeeSupportFormData {
  company_id: number;
  location_id?: number | null;
  fee_name: string;
  fee_amount: number;
  fee_calculation_type: 'fixed' | 'percentage';
  fee_application_type: 'additive' | 'inclusive';
  entity_ids: number[];
  entity_type: 'package' | 'attraction';
  is_active: boolean;
}

export interface FeeSupportFilters {
  per_page?: number;
  page?: number;
  company_id?: number;
  location_id?: number;
  entity_type?: 'package' | 'attraction';
  fee_calculation_type?: 'fixed' | 'percentage';
  fee_application_type?: 'additive' | 'inclusive';
  is_active?: boolean;
  search?: string;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
  user_id?: number;
}

export interface FeeBreakdownItem {
  fee_support_id: number;
  fee_name: string;
  fee_label: string;
  fee_calculation_type: 'fixed' | 'percentage';
  fee_application_type: 'additive' | 'inclusive';
  fee_amount: number;
  displayed_base_price: number;
  total: number;
}

export interface FeeBreakdown {
  original_base_price: number;
  displayed_base_price: number;
  fees: FeeBreakdownItem[];
  total: number;
}

export interface FeeSupportListFilters {
  entity_type: 'all' | 'package' | 'attraction';
  calculation_type: 'all' | 'fixed' | 'percentage';
  application_type: 'all' | 'additive' | 'inclusive';
  status: 'all' | 'active' | 'inactive';
  search: string;
}
