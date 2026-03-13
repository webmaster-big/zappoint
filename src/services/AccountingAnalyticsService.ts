import axios from 'axios';
import { API_BASE_URL, getStoredUser } from '../utils/storage';
import type {
  AccountingReportResponse,
  SummaryTrendResponse,
  AccountingReportParams,
  SummaryTrendParams,
  ExportParams,
} from '../types/AccountingAnalytics.types';

// Create axios instance with base configuration
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

// Add request interceptor to include auth token
api.interceptors.request.use(
  (config) => {
    const token = getStoredUser()?.token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

/**
 * Accounting & Analytics Service
 * Provides financial reporting data for accounting teams
 */
export const accountingAnalyticsService = {
  /**
   * Get accounting report for a specific date
   * @param params - Report parameters including location_id, date, and optional filters
   * @returns Accounting report with categorized sales data
   */
  async getReport(params: AccountingReportParams): Promise<AccountingReportResponse> {
    const queryParams = new URLSearchParams();
    
    queryParams.append('location_id', params.location_id.toString());
    queryParams.append('start_date', params.start_date);
    
    if (params.end_date) {
      queryParams.append('end_date', params.end_date);
    }
    if (params.compare_start_date) {
      queryParams.append('compare_start_date', params.compare_start_date);
    }
    if (params.compare_end_date) {
      queryParams.append('compare_end_date', params.compare_end_date);
    }
    if (params.view_mode) {
      queryParams.append('view_mode', params.view_mode);
    }
    if (params.payment_status) {
      queryParams.append('payment_status', params.payment_status);
    }
    if (params.include_addons_breakdown !== undefined) {
      queryParams.append('include_addons_breakdown', params.include_addons_breakdown.toString());
    }
    if (params.category_filter) {
      queryParams.append('category_filter', params.category_filter);
    }
    
    const response = await api.get<AccountingReportResponse>(
      `/accounting-analytics/report?${queryParams.toString()}`
    );
    return response.data;
  },

  /**
   * Get summary trend for a date range
   * @param params - Trend parameters including location_id, start_date, end_date
   * @returns Daily summary data for the date range
   */
  async getSummaryTrend(params: SummaryTrendParams): Promise<SummaryTrendResponse> {
    const queryParams = new URLSearchParams();
    
    queryParams.append('location_id', params.location_id.toString());
    queryParams.append('start_date', params.start_date);
    queryParams.append('end_date', params.end_date);
    
    if (params.view_mode) {
      queryParams.append('view_mode', params.view_mode);
    }
    
    const response = await api.get<SummaryTrendResponse>(
      `/accounting-analytics/summary-trend?${queryParams.toString()}`
    );
    return response.data;
  },

  /**
   * Export report data
   * @param params - Export parameters including format (json or csv)
   * @returns Export blob or JSON data
   */
  async exportReport(params: ExportParams): Promise<Blob | object> {
    const queryParams = new URLSearchParams();
    
    queryParams.append('location_id', params.location_id.toString());
    queryParams.append('start_date', params.start_date);
    if (params.end_date) {
      queryParams.append('end_date', params.end_date);
    }
    queryParams.append('format', params.format);
    
    if (params.view_mode) {
      queryParams.append('view_mode', params.view_mode);
    }
    
    if (params.format === 'csv') {
      const response = await api.get(
        `/accounting-analytics/export?${queryParams.toString()}`,
        { responseType: 'blob' }
      );
      return response.data;
    }
    
    const response = await api.get(
      `/accounting-analytics/export?${queryParams.toString()}`
    );
    return response.data;
  },

  /**
   * Download CSV export directly
   * Opens the download in a new window
   */
  downloadCSV(locationId: number, startDate: string, endDate: string | undefined, viewMode: 'booked_on' | 'booked_for' = 'booked_for'): void {
    const queryParams = new URLSearchParams({
      location_id: locationId.toString(),
      start_date: startDate,
      view_mode: viewMode,
      format: 'csv',
    });
    if (endDate) {
      queryParams.append('end_date', endDate);
    }
    
    // Using fetch with blob and creating a download link
    api.get(`/accounting-analytics/export?${queryParams.toString()}`, {
      responseType: 'blob',
    }).then((response) => {
      const blob = new Blob([response.data], { type: 'text/csv' });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      const filename = endDate && endDate !== startDate ? `accounting-report-${startDate}-to-${endDate}.csv` : `accounting-report-${startDate}.csv`;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    }).catch((error) => {
      console.error('Failed to download CSV:', error);
    });
  },
};

export default accountingAnalyticsService;
