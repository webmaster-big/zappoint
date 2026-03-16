import { useState, useEffect, useCallback } from 'react';
import {
  Download,
  RefreshCcw,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  TrendingDown,
  Minus,
  Hash,
  DollarSign,
  Tag,
  Receipt,
  BadgePercent,
  Landmark,
  CircleDollarSign,
} from 'lucide-react';
import { useThemeColor } from '../../../hooks/useThemeColor';
import StandardButton from '../../../components/ui/StandardButton';
import LocationSelector from '../../../components/admin/LocationSelector';
import Toast from '../../../components/ui/Toast';
import CounterAnimation from '../../../components/ui/CounterAnimation';
import { accountingAnalyticsService } from '../../../services/AccountingAnalyticsService';
import { locationService } from '../../../services/LocationService';
import { getStoredUser } from '../../../utils/storage';
import type {
  AccountingReportResponse,
  CategoryData,
  CategoryItem,
} from '../../../types/AccountingAnalytics.types';

// Format currency helper
const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(value);
};

// Calculate percentage change
const calculateChange = (primary: number, compare: number): { value: number; display: string; direction: 'up' | 'down' | 'neutral' } => {
  if (compare === 0 && primary === 0) return { value: 0, display: '0%', direction: 'neutral' };
  if (compare === 0) return { value: 100, display: '+100%', direction: 'up' };
  const change = ((primary - compare) / compare) * 100;
  const sign = change >= 0 ? '+' : '';
  const direction = change > 0 ? 'up' : change < 0 ? 'down' : 'neutral';
  return { value: change, display: `${sign}${change.toFixed(1)}%`, direction };
};

// Format date range for display
const formatDateRange = (start: string, end: string): string => {
  const s = new Date(start + 'T00:00:00');
  const e = new Date(end + 'T00:00:00');
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
  const optsNoYear: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  if (start === end) return s.toLocaleDateString('en-US', opts);
  return `${s.toLocaleDateString('en-US', optsNoYear)} - ${e.toLocaleDateString('en-US', opts)}`;
};

const AccountingAnalytics: React.FC = () => {
  const { themeColor, fullColor } = useThemeColor();
  const user = getStoredUser();
  const isCompanyAdmin = user?.role === 'company_admin';
  const isLocationManager = user?.role === 'location_manager';

  // State
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reportData, setReportData] = useState<AccountingReportResponse['data'] | null>(null);
  const [showCompare, setShowCompare] = useState(false);
  
  // Date range selection
  const [startDate, setStartDate] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState<string>('');
  const [compareStartDate, setCompareStartDate] = useState<string>('');
  const [compareEndDate, setCompareEndDate] = useState<string>('');
  
  // View mode
  const [viewMode, setViewMode] = useState<'booked_for' | 'booked_on'>('booked_for');
  
  // Location
  const [locations, setLocations] = useState<Array<{ id: string | number; name: string }>>([]);
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  
  // Categories
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(['Parties', 'Attractions', 'Events', 'Add-ons'])
  );
  
  // Toast
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Fetch locations
  useEffect(() => {
    const fetchLocations = async () => {
      try {
        const response = await locationService.getLocations();
        const locs = response.data || response;
        
        if (isLocationManager && user?.location_id) {
          const userLocation = locs.find((l: { id: number; name: string }) => l.id === user.location_id);
          if (userLocation) {
            setLocations([{ id: userLocation.id, name: userLocation.name }]);
            setSelectedLocation(userLocation.id.toString());
          }
        } else {
          setLocations(locs.map((l: { id: number; name: string }) => ({ id: l.id, name: l.name })));
          if (locs.length > 0) {
            setSelectedLocation(locs[0].id.toString());
          }
        }
      } catch (error) {
        console.error('Failed to fetch locations:', error);
        setToast({ message: 'Failed to load locations', type: 'error' });
      }
    };
    fetchLocations();
  }, [isLocationManager, user?.location_id]);

  // Fetch report
  const fetchReport = useCallback(async (showRefreshing = false) => {
    if (!selectedLocation || !startDate) return;

    if (showRefreshing) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const response = await accountingAnalyticsService.getReport({
        location_id: parseInt(selectedLocation),
        start_date: startDate,
        end_date: endDate || undefined,
        compare_start_date: compareStartDate || undefined,
        compare_end_date: compareEndDate || undefined,
        view_mode: viewMode,
      });

      if (response.success) {
        setReportData(response.data);
      }
    } catch (error) {
      console.error('Failed to fetch report:', error);
      const axiosError = error as { response?: { status?: number } };
      if (axiosError.response?.status === 404) {
        setToast({ message: 'No data found for selected date', type: 'error' });
      } else {
        setToast({ message: 'Failed to load report', type: 'error' });
      }
      setReportData(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedLocation, startDate, endDate, compareStartDate, compareEndDate, viewMode]);

  useEffect(() => {
    if (selectedLocation) {
      fetchReport();
    }
  }, [fetchReport, selectedLocation]);

  // Toggle category
  const toggleCategory = (name: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  // Export
  const handleExport = async () => {
    if (!selectedLocation || !startDate) return;
    try {
      accountingAnalyticsService.downloadCSV(parseInt(selectedLocation), startDate, endDate || undefined, viewMode);
      setToast({ message: 'Downloading CSV...', type: 'success' });
    } catch {
      setToast({ message: 'Export failed', type: 'error' });
    }
  };

  // Loading
  if (loading && !reportData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className={`animate-spin rounded-full h-12 w-12 border-b-2 border-${fullColor}`}></div>
      </div>
    );
  }

  return (
    <div className="px-6 py-8">
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Accounting & Analytics</h1>
          <p className="text-gray-600 mt-1">
            {viewMode === 'booked_for' ? 'Events scheduled for selected dates' : 'Purchases made on selected dates'}
          </p>
        </div>
        <div className="mt-4 sm:mt-0 flex items-center gap-2">
          {isCompanyAdmin && locations.length > 1 && (
            <LocationSelector
              locations={locations}
              selectedLocation={selectedLocation}
              onLocationChange={setSelectedLocation}
              themeColor={themeColor}
              fullColor={fullColor}
              showAllOption={false}
              variant="compact"
            />
          )}
        </div>
      </div>

      {/* Action Buttons Row */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className={`px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-${themeColor}-600 focus:border-${themeColor}-600`}
        />
        <span className="text-gray-400 text-sm">to</span>
        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          min={startDate}
          className={`px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-${themeColor}-600 focus:border-${themeColor}-600`}
        />
        <select
          value={viewMode}
          onChange={(e) => setViewMode(e.target.value as 'booked_for' | 'booked_on')}
          className={`px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-${themeColor}-600 focus:border-${themeColor}-600`}
        >
          <option value="booked_for">Booked For</option>
          <option value="booked_on">Created On</option>
        </select>
        <StandardButton
          onClick={() => setShowCompare(!showCompare)}
          variant={showCompare ? 'primary' : 'secondary'}
          size="sm"
        >
          {showCompare ? 'Hide Compare' : 'Compare'}
        </StandardButton>
        <StandardButton onClick={() => fetchReport(true)} variant="secondary" size="sm" icon={RefreshCcw} loading={refreshing}>
          {''}
        </StandardButton>
        <StandardButton onClick={() => handleExport()} variant="secondary" size="sm" icon={Download}>
          CSV
        </StandardButton>
      </div>

      {/* Compare Date Row */}
      {showCompare && (
        <div className="mb-6 flex flex-wrap items-center gap-2 bg-gray-50 rounded-lg px-4 py-3 border border-gray-200">
          <span className="text-sm font-medium text-gray-700">Compare with:</span>
          <input
            type="date"
            value={compareStartDate}
            onChange={(e) => setCompareStartDate(e.target.value)}
            className={`px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-${themeColor}-600 focus:border-${themeColor}-600`}
          />
          <span className="text-gray-400 text-sm">to</span>
          <input
            type="date"
            value={compareEndDate}
            onChange={(e) => setCompareEndDate(e.target.value)}
            min={compareStartDate}
            className={`px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-${themeColor}-600 focus:border-${themeColor}-600`}
          />
          {(compareStartDate || compareEndDate) && (
            <button
              onClick={() => { setCompareStartDate(''); setCompareEndDate(''); }}
              className="text-sm text-red-500 hover:text-red-700"
            >
              Clear
            </button>
          )}
        </div>
      )}

      {/* Comparison Banner */}
      {reportData?.comparison && reportData.compare_start_date && (
        <div className={`mb-6 bg-${themeColor}-50 border border-${themeColor}-200 rounded-lg p-4 flex items-center gap-3`}>
          <span className="text-lg">📊</span>
          <div>
            <p className={`font-medium text-${themeColor}-900`}>
              Comparing: {formatDateRange(reportData.start_date, reportData.end_date)} vs {formatDateRange(reportData.compare_start_date, reportData.compare_end_date!)}
            </p>
            <p className={`text-sm text-${themeColor}-600`}>View Mode: {reportData.view_mode_label}</p>
          </div>
        </div>
      )}

      {/* Key Metrics */}
      {reportData?.primary?.summary && (() => {
        const summary = reportData.primary.summary;
        const comparison = reportData.comparison?.summary;
        const metrics = [
          { label: 'Qty Sold', value: summary.quantity_sold, compareValue: comparison?.quantity_sold, icon: Hash, isCurrency: false, tooltip: 'Total number of items sold', change: comparison ? calculateChange(summary.quantity_sold, comparison.quantity_sold) : null },
          { label: 'Gross Sales', value: summary.gross_sales, compareValue: comparison?.gross_sales, icon: DollarSign, isCurrency: true, tooltip: 'Total revenue before discounts', change: comparison ? calculateChange(summary.gross_sales, comparison.gross_sales) : null },
          { label: 'Discounts', value: summary.discount_amount, compareValue: comparison?.discount_amount, icon: Tag, isCurrency: true, isNegative: true, tooltip: 'Total discounts applied', change: comparison ? calculateChange(summary.discount_amount, comparison.discount_amount) : null },
          { label: 'Net Sales', value: summary.net_sales, compareValue: comparison?.net_sales, icon: Receipt, isCurrency: true, tooltip: 'Gross sales minus discounts', change: comparison ? calculateChange(summary.net_sales, comparison.net_sales) : null },
          { label: 'Fees', value: summary.fee_amount, compareValue: comparison?.fee_amount, icon: BadgePercent, isCurrency: true, tooltip: 'Service and processing fees', change: comparison ? calculateChange(summary.fee_amount, comparison.fee_amount) : null },
          { label: 'Tax', value: summary.tax_amount, compareValue: comparison?.tax_amount, icon: Landmark, isCurrency: true, tooltip: 'Tax amount collected', change: comparison ? calculateChange(summary.tax_amount, comparison.tax_amount) : null },
          { label: 'Total Billed', value: summary.total_billed, compareValue: comparison?.total_billed, icon: CircleDollarSign, isCurrency: true, tooltip: 'Total amount invoiced (after discounts, with fees)', change: comparison ? calculateChange(summary.total_billed, comparison.total_billed) : null },
          { label: 'Collected', value: summary.grand_total, compareValue: comparison?.grand_total, icon: DollarSign, isCurrency: true, tooltip: 'Amount actually collected so far', change: comparison ? calculateChange(summary.grand_total, comparison.grand_total) : null },
        ];
        return (
          <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-2 sm:gap-3 mb-6">
            {metrics.map((metric, index) => {
              const Icon = metric.icon;
              return (
                <div key={index} className="bg-white rounded-xl p-3 shadow-sm border border-gray-100 group relative">
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-medium text-gray-500">{metric.label}</p>
                      <div className="mt-1">
                        {metric.isCurrency ? (
                          <span className={`text-sm font-bold ${metric.isNegative ? 'text-red-600' : 'text-gray-900'}`}>
                            {metric.isNegative ? '-' : ''}{formatCurrency(metric.value)}
                          </span>
                        ) : (
                          <CounterAnimation value={metric.value} className="text-sm font-bold text-gray-900" />
                        )}
                      </div>
                      {metric.change ? (
                        <div className="mt-0.5">
                          <p className="text-[10px] text-gray-400">
                            vs {metric.isCurrency ? `${metric.isNegative ? '-' : ''}${formatCurrency(metric.compareValue!)}` : metric.compareValue}
                          </p>
                          <p className={`text-[10px] flex items-center gap-0.5 ${
                            metric.change.direction === 'up' ? 'text-green-600' : metric.change.direction === 'down' ? 'text-red-600' : 'text-gray-400'
                          }`}>
                            {metric.change.direction === 'up' ? <TrendingUp className="w-2.5 h-2.5" /> : metric.change.direction === 'down' ? <TrendingDown className="w-2.5 h-2.5" /> : <Minus className="w-2.5 h-2.5" />}
                            {metric.change.display}
                          </p>
                        </div>
                      ) : (
                        <p className="text-[10px] mt-0.5 text-gray-400">&nbsp;</p>
                      )}
                    </div>
                    <div className={`p-1 bg-${themeColor}-50 rounded-md flex-shrink-0`}>
                      <Icon className={`w-3.5 h-3.5 text-${themeColor}-600`} />
                    </div>
                  </div>
                  {/* Tooltip */}
                  <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover:block w-48 px-2.5 py-1.5 bg-gray-900 text-white text-xs rounded-lg shadow-lg z-50 text-center pointer-events-none">
                    {metric.tooltip}
                    <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-gray-900"></div>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* Categories */}
      {reportData?.primary?.categories && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Sales by Category</h2>
              <p className="text-sm text-gray-500">Breakdown by Parties, Attractions, Events, and Add-ons</p>
            </div>
            <div className="flex gap-2 text-sm">
              <button
                onClick={() => setExpandedCategories(new Set(reportData.primary.categories.map(c => c.name)))}
                className={`text-${themeColor}-600 hover:text-${themeColor}-700 font-medium`}
              >
                Expand All
              </button>
              <span className="text-gray-300">|</span>
              <button
                onClick={() => setExpandedCategories(new Set())}
                className="text-gray-500 hover:text-gray-700"
              >
                Collapse All
              </button>
            </div>
          </div>
          <div className="divide-y divide-gray-100">
            {reportData.primary.categories.map((category) => (
              <CategorySection
                key={category.name}
                category={category}
                comparisonCategory={reportData.comparison?.categories.find(c => c.name === category.name) ?? null}
                isExpanded={expandedCategories.has(category.name)}
                onToggle={() => toggleCategory(category.name)}
                themeColor={themeColor}
              />
            ))}
          </div>
        </div>
      )}

      {/* No Data */}
      {!reportData && !loading && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
          <p className="text-gray-500">No data available for the selected date range.</p>
        </div>
      )}
    </div>
  );
};

// Category Section
interface CategorySectionProps {
  category: CategoryData;
  comparisonCategory: CategoryData | null;
  isExpanded: boolean;
  onToggle: () => void;
  themeColor: string;
}

const CategorySection: React.FC<CategorySectionProps> = ({
  category,
  comparisonCategory,
  isExpanded,
  onToggle,
  themeColor,
}) => {
  // Build a lookup of comparison items by name
  const comparisonItemMap = new Map<string, CategoryItem>();
  if (comparisonCategory) {
    comparisonCategory.items.forEach(item => comparisonItemMap.set(item.name, item));
  }
  return (
    <div>
      <button
        onClick={onToggle}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
          <span className="font-semibold text-gray-900">{category.name}</span>
          {category.is_informational && (
            <span className="px-2 py-0.5 text-xs bg-yellow-100 text-yellow-700 rounded-full">
              Informational
            </span>
          )}
        </div>
        <div className="flex items-center gap-4 text-sm text-gray-500">
          <span>{category.summary.quantity_sold} items</span>
          <span className="font-medium text-gray-900">{formatCurrency(category.summary.grand_total)}</span>
        </div>
      </button>

      {isExpanded && (
        <div className="px-6 pb-4">
          {category.items.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-2 font-medium text-gray-600">Item</th>
                    <th className="text-left py-3 px-2 font-medium text-gray-600">Category</th>
                    <th className="text-right py-3 px-2 font-medium text-gray-600">Qty</th>
                    <th className="text-right py-3 px-2 font-medium text-gray-600">Gross</th>
                    <th className="text-right py-3 px-2 font-medium text-gray-600">Discount</th>
                    <th className="text-right py-3 px-2 font-medium text-gray-600">Net</th>
                    <th className="text-right py-3 px-2 font-medium text-gray-600">Fees</th>
                    <th className="text-right py-3 px-2 font-medium text-gray-600">Tax</th>
                    <th className="text-right py-3 px-2 font-medium text-gray-600">Total Billed</th>
                    <th className="text-right py-3 px-2 font-medium text-gray-600">Collected</th>
                    <th className="text-right py-3 px-2 font-medium text-gray-600">Balance Due</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {category.items.map((item, index) => {
                    const compareItem = comparisonItemMap.get(item.name);
                    const change = compareItem ? calculateChange(item.grand_total, compareItem.grand_total) : null;
                    return (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="py-3 px-2 font-medium text-gray-900">{item.name}</td>
                        <td className="py-3 px-2 text-gray-600">{item.sub_category}</td>
                        <td className="py-3 px-2 text-right text-gray-900">{item.quantity_sold}</td>
                        <td className="py-3 px-2 text-right text-gray-900">{formatCurrency(item.gross_sales)}</td>
                        <td className="py-3 px-2 text-right text-red-600">-{formatCurrency(item.discount_amount)}</td>
                        <td className="py-3 px-2 text-right text-gray-900">{formatCurrency(item.net_sales)}</td>
                        <td className="py-3 px-2 text-right text-gray-900">{formatCurrency(item.fee_amount)}</td>
                        <td className="py-3 px-2 text-right text-gray-900">{formatCurrency(item.tax_amount)}</td>
                        <td className="py-3 px-2 text-right text-gray-900">{formatCurrency(item.total_billed)}</td>
                        <td className="py-3 px-2 text-right font-semibold text-gray-900">
                          <div>{formatCurrency(item.grand_total)}</div>
                          {compareItem && change && (
                            <div className="flex items-center justify-end gap-1 mt-0.5">
                              <span className="text-[10px] text-gray-400">vs {formatCurrency(compareItem.grand_total)}</span>
                              <span className={`text-[10px] font-medium px-1 py-px rounded ${
                                change.direction === 'up' ? 'bg-green-100 text-green-700' : change.direction === 'down' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
                              }`}>
                                {change.direction === 'up' ? '▲' : change.direction === 'down' ? '▼' : ''}{change.display}
                              </span>
                            </div>
                          )}
                        </td>
                        <td className={`py-3 px-2 text-right font-semibold ${item.balance_due > 0 ? 'text-orange-600' : 'text-gray-400'}`}>{formatCurrency(item.balance_due)}</td>
                      </tr>
                    );
                  })}
                  <tr className={`bg-${themeColor}-50 font-semibold`}>
                    <td className="py-3 px-2 text-gray-900" colSpan={2}>SUBTOTAL</td>
                    <td className="py-3 px-2 text-right text-gray-900">{category.summary.quantity_sold}</td>
                    <td className="py-3 px-2 text-right text-gray-900">{formatCurrency(category.summary.gross_sales)}</td>
                    <td className="py-3 px-2 text-right text-red-600">-{formatCurrency(category.summary.discount_amount)}</td>
                    <td className="py-3 px-2 text-right text-gray-900">{formatCurrency(category.summary.net_sales)}</td>
                    <td className="py-3 px-2 text-right text-gray-900">{formatCurrency(category.summary.fee_amount)}</td>
                    <td className="py-3 px-2 text-right text-gray-900">{formatCurrency(category.summary.tax_amount)}</td>
                    <td className="py-3 px-2 text-right text-gray-900">{formatCurrency(category.summary.total_billed)}</td>
                    <td className={`py-3 px-2 text-right text-${themeColor}-700`}>
                      <div>{formatCurrency(category.summary.grand_total)}</div>
                      {comparisonCategory && (() => {
                        const subtotalChange = calculateChange(category.summary.grand_total, comparisonCategory.summary.grand_total);
                        return (
                          <div className="flex items-center justify-end gap-1 mt-0.5">
                            <span className="text-[10px] text-gray-400">vs {formatCurrency(comparisonCategory.summary.grand_total)}</span>
                            <span className={`text-[10px] font-medium px-1 py-px rounded ${
                              subtotalChange.direction === 'up' ? 'bg-green-100 text-green-700' : subtotalChange.direction === 'down' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
                            }`}>
                              {subtotalChange.direction === 'up' ? '▲' : subtotalChange.direction === 'down' ? '▼' : ''}{subtotalChange.display}
                            </span>
                          </div>
                        );
                      })()}
                    </td>
                    <td className={`py-3 px-2 text-right font-semibold ${category.summary.balance_due > 0 ? 'text-orange-600' : 'text-gray-400'}`}>{formatCurrency(category.summary.balance_due)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              No {category.name.toLowerCase()} for this date
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AccountingAnalytics;
