// Types for Accounting & Analytics API

export interface AccountingSummary {
  quantity_sold: number;
  gross_sales: number;
  net_sales: number;
  fee_amount: number;
  discount_amount: number;
  tax_amount: number;
  total_billed: number;  // what was invoiced
  grand_total: number;   // what was collected
  balance_due: number;   // what's still owed
}

export interface CategoryItem {
  name: string;
  sub_category: string;
  quantity_sold: number;
  gross_sales: number;
  net_sales: number;
  fee_amount: number;
  discount_amount: number;
  tax_amount: number;
  total_billed: number;  // what was invoiced
  grand_total: number;   // what was collected
  balance_due: number;   // what's still owed
}

export interface CategoryData {
  name: string;
  is_informational?: boolean; // Add-ons category has this = true (visibility only, already in other totals)
  items: CategoryItem[];
  summary: AccountingSummary;
}

export interface ReportData {
  summary: AccountingSummary;
  categories: CategoryData[];
  note?: string; // Explains Add-ons visibility
}

export interface FiltersApplied {
  payment_status: 'paid' | 'partial' | 'pending' | 'all';
  include_addons_breakdown: boolean;
  category_filter: string | null;
}

export interface LocationInfo {
  id: number;
  name: string;
  company_name: string | null;
  timezone: string;
}

export interface AccountingReportResponse {
  success: boolean;
  data: {
    location: LocationInfo;
    start_date: string;
    end_date: string;
    compare_start_date: string | null;
    compare_end_date: string | null;
    filters_applied: FiltersApplied;
    view_mode: 'booked_on' | 'booked_for';
    view_mode_label: string;
    primary: ReportData;
    comparison: ReportData | null;
    generated_at: string;
  };
}

export interface DailySummary {
  date: string;
  day_of_week: string;
  summary: AccountingSummary;
}

export interface SummaryTrendResponse {
  success: boolean;
  data: {
    location: LocationInfo;
    date_range: {
      start_date: string;
      end_date: string;
      total_days: number;
    };
    view_mode: 'booked_on' | 'booked_for';
    daily_data: DailySummary[];
    range_totals: AccountingSummary;
    generated_at: string;
  };
}

export interface AccountingReportParams {
  location_id: number;
  start_date: string;
  end_date?: string; // Optional, defaults to start_date for single-day report
  compare_start_date?: string;
  compare_end_date?: string;
  view_mode?: 'booked_on' | 'booked_for';
  payment_status?: 'paid' | 'partial' | 'pending' | 'all';
  include_addons_breakdown?: boolean;
  category_filter?: string;
}

export interface SummaryTrendParams {
  location_id: number;
  start_date: string;
  end_date: string;
  view_mode?: 'booked_on' | 'booked_for';
}

export interface ExportParams {
  location_id: number;
  start_date: string;
  end_date?: string;
  view_mode?: 'booked_on' | 'booked_for';
  format: 'json' | 'csv';
}
