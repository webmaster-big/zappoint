import { useState, useEffect, useCallback } from 'react';
import {
  Download,
  Users,
  DollarSign,
  Package,
  Ticket,
  TrendingUp,
  Clock,
  X,
  Info,
  Activity,
  Loader2,
} from 'lucide-react';
import { useThemeColor } from '../../../hooks/useThemeColor';
import CounterAnimation from '../../../components/ui/CounterAnimation';
import StandardButton from '../../../components/ui/StandardButton';
import AnalyticsService from '../../../services/AnalyticsService';
import type { LocationAnalyticsResponse } from '../../../services/AnalyticsService';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

const LocationManagerAnalytics: React.FC = () => {
  const { themeColor } = useThemeColor();
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | '1y' | 'custom'>('30d');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [showExportModal, setShowExportModal] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [analyticsData, setAnalyticsData] = useState<LocationAnalyticsResponse | null>(null);
  const [selectedSections, setSelectedSections] = useState<('packages' | 'metrics' | 'revenue' | 'attractions' | 'timeslots')[]>(['metrics', 'revenue', 'packages', 'attractions', 'timeslots']);
  const [exportFormat, setExportFormat] = useState<'json' | 'csv'>('json');
  
  // TODO: Get location_id from authenticated user's location
  const locationId = 1; // Replace with actual location ID from user context

  const fetchAnalytics = useCallback(async () => {
    try {
      setIsLoading(true);
      const params: any = {
        location_id: locationId,
        date_range: dateRange,
      };
      
      // Add custom date range if selected
      if (dateRange === 'custom' && startDate && endDate) {
        params.start_date = startDate;
        params.end_date = endDate;
      }
      
      const data = await AnalyticsService.getLocationAnalytics(params);

      console.log('Fetched Location Analytics:', data);
      setAnalyticsData(data);
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    } finally {
      setIsLoading(false);
    }
  }, [locationId, dateRange, startDate, endDate]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);
  
  const handleExport = async () => {
    if (!analyticsData) return;
    
    setIsExporting(true);
    try {
      const params: any = {
        location_id: locationId,
        date_range: dateRange,
        format: exportFormat,
        sections: selectedSections,
      };
      
      // Add custom date range if selected
      if (dateRange === 'custom' && startDate && endDate) {
        params.start_date = startDate;
        params.end_date = endDate;
      }
      
      const exportData = await AnalyticsService.exportAnalytics(params);
      
      AnalyticsService.downloadExportedFile(
        exportData,
        exportFormat,
        analyticsData.location.name
      );
      
      setShowExportModal(false);
    } catch (error) {
      console.error('Failed to export analytics:', error);
    } finally {
      setIsExporting(false);
    }
  };

  type SectionType = 'packages' | 'metrics' | 'revenue' | 'attractions' | 'timeslots';

  const toggleSection = (sectionId: SectionType) => {
    setSelectedSections(prev =>
      prev.includes(sectionId)
        ? prev.filter(id => id !== sectionId)
        : [...prev, sectionId]
    );
  };

  if (isLoading || !analyticsData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-gray-400 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading analytics...</p>
        </div>
      </div>
    );
  }

  const { location, key_metrics, hourly_revenue, daily_revenue, weekly_trend, package_performance, attraction_performance, time_slot_performance } = analyticsData;
  
  // Key metrics for single location
  const keyMetrics = [
    { label: 'Location Revenue', value: key_metrics.location_revenue.value, icon: DollarSign, change: key_metrics.location_revenue.change + ' vs last period', trend: key_metrics.location_revenue.trend },
    { label: 'Package Bookings', value: key_metrics.package_bookings.value, icon: Package, change: key_metrics.package_bookings.change + ' vs last period', trend: key_metrics.package_bookings.trend },
    { label: 'Ticket Sales', value: key_metrics.ticket_sales.value, icon: Ticket, change: key_metrics.ticket_sales.change + ' vs last period', trend: key_metrics.ticket_sales.trend },
    { label: 'Total Visitors', value: key_metrics.total_visitors.value, icon: Users, change: key_metrics.total_visitors.change + ' vs last period', trend: key_metrics.total_visitors.trend },
    { label: 'Active Packages', value: key_metrics.active_packages.value, icon: Package, change: key_metrics.active_packages.info, trend: 'up' },
    { label: 'Active Attractions', value: key_metrics.active_attractions.value, icon: Activity, change: key_metrics.active_attractions.info, trend: 'up' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-2 sm:p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 flex items-center gap-2 mb-1">
            Location Analytics - {location.name}
          </h1>
          <p className="text-sm md:text-base text-gray-600">
            {location.full_address}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 mt-4 md:mt-0">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as '7d' | '30d' | '90d' | '1y' | 'custom')}
            className={`px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-${themeColor}-500`}
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="1y">Last year</option>
            <option value="custom">Custom Range</option>
          </select>
          {dateRange === 'custom' && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-${themeColor}-500"
                placeholder="Start Date"
              />
              <span className="text-gray-500">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={startDate}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-${themeColor}-500"
                placeholder="End Date"
              />
            </div>
          )}
          <StandardButton
            onClick={() => setShowExportModal(true)}
            variant="secondary"
            size="sm"
            icon={Download}
          >
            Export
          </StandardButton>
        </div>
      </div>

      {/* Key Metrics - 6 columns */}
      <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2 sm:gap-4">
        {keyMetrics.map((metric, index) => {
          const Icon = metric.icon;
          return (
            <div key={index} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-600">{metric.label}</p>
                  <div className="text-2xl font-bold text-gray-900 mt-1">
                    <CounterAnimation
                      value={metric.value}
                      className="text-2xl font-bold text-gray-900"
                    />
                  </div>
                  <p className={`text-xs mt-1 ${
                    metric.trend === 'up' ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {metric.change}
                  </p>
                </div>
                <div className={`p-2 bg-${themeColor}-50 rounded-lg`}>
                  <Icon className={`w-5 h-5 text-${themeColor}-600`} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Charts Grid - 2 columns */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Hourly Revenue Pattern */}
        <div className="bg-white rounded-xl p-3 sm:p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-gray-900">Hourly Revenue Pattern</h3>
              <div className="group relative">
                <Info className="w-4 h-4 text-gray-400 cursor-help" />
                <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-64 p-2 bg-gray-900 text-white text-xs rounded shadow-lg z-10">
                  Revenue and booking patterns throughout the day
                </div>
              </div>
            </div>
            <Clock className="w-4 h-4 text-gray-400" />
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={hourly_revenue}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="hour" stroke="#6b7280" />
              <YAxis yAxisId="left" stroke={`var(--color-${themeColor}-500)`} />
              <YAxis yAxisId="right" orientation="right" stroke="#10b981" />
              <Tooltip />
              <Legend />
              <Line yAxisId="left" type="monotone" dataKey="revenue" stroke={`var(--color-${themeColor}-500)`} strokeWidth={2} name="Revenue ($)" />
              <Line yAxisId="right" type="monotone" dataKey="bookings" stroke="#10b981" strokeWidth={2} name="Bookings" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Daily Performance */}
        <div className="bg-white rounded-xl p-3 sm:p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-gray-900">Daily Performance (Week)</h3>
              <div className="group relative">
                <Info className="w-4 h-4 text-gray-400 cursor-help" />
                <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-64 p-2 bg-gray-900 text-white text-xs rounded shadow-lg z-10">
                  Revenue and participant trends over the last 7 days
                </div>
              </div>
            </div>
            <Activity className="w-4 h-4 text-gray-400" />
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={daily_revenue}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="day" stroke="#6b7280" />
              <YAxis stroke="#6b7280" />
              <Tooltip />
              <Legend />
              <Area type="monotone" dataKey="revenue" stroke={`var(--color-${themeColor}-500)`} fill={`var(--color-${themeColor}-500)`} fillOpacity={0.1} name="Revenue ($)" />
              <Area type="monotone" dataKey="participants" stroke="#10b981" fill="#10b981" fillOpacity={0.1} name="Participants" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Package Performance */}
        <div className="bg-white rounded-xl p-3 sm:p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-gray-900">Package Bookings</h3>
              <div className="group relative">
                <Info className="w-4 h-4 text-gray-400 cursor-help" />
                <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-64 p-2 bg-gray-900 text-white text-xs rounded shadow-lg z-10">
                  Reserved package bookings by type. Packages are group experiences scheduled in advance.
                </div>
              </div>
            </div>
            <Package className="w-4 h-4 text-gray-400" />
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={package_performance}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="name" stroke="#6b7280" />
              <YAxis stroke="#6b7280" />
              <Tooltip />
              <Bar dataKey="bookings" fill={`var(--color-${themeColor}-500)`} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Attraction Utilization */}
        <div className="bg-white rounded-xl p-3 sm:p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-gray-900">Attraction Ticket Sales</h3>
              <div className="group relative">
                <Info className="w-4 h-4 text-gray-400 cursor-help" />
                <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-64 p-2 bg-gray-900 text-white text-xs rounded shadow-lg z-10">
                  Individual ticket purchases shown as utilization % of capacity for each attraction.
                </div>
              </div>
            </div>
            <Ticket className="w-4 h-4 text-gray-400" />
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={attraction_performance} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis type="number" stroke="#6b7280" />
              <YAxis dataKey="name" type="category" stroke="#6b7280" width={80} />
              <Tooltip />
              <Bar dataKey="utilization" fill={`var(--color-${themeColor}-500)`} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Weekly Trend */}
        <div className="bg-white rounded-xl p-3 sm:p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-gray-900">5-Week Trend</h3>
              <div className="group relative">
                <Info className="w-4 h-4 text-gray-400 cursor-help" />
                <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-64 p-2 bg-gray-900 text-white text-xs rounded shadow-lg z-10">
                  Revenue and booking trends over the last 5 weeks
                </div>
              </div>
            </div>
            <TrendingUp className="w-4 h-4 text-gray-400" />
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={weekly_trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="week" stroke="#6b7280" />
              <YAxis yAxisId="left" stroke={`var(--color-${themeColor}-500)`} />
              <YAxis yAxisId="right" orientation="right" stroke="#10b981" />
              <Tooltip />
              <Legend />
              <Line yAxisId="left" type="monotone" dataKey="revenue" stroke={`var(--color-${themeColor}-500)`} strokeWidth={2} name="Revenue ($)" />
              <Line yAxisId="right" type="monotone" dataKey="bookings" stroke="#10b981" strokeWidth={2} name="Bookings" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Time Slot Performance */}
        <div className="bg-white rounded-xl p-3 sm:p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-gray-900">Time Slot Performance</h3>
              <div className="group relative">
                <Info className="w-4 h-4 text-gray-400 cursor-help" />
                <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-64 p-2 bg-gray-900 text-white text-xs rounded shadow-lg z-10">
                  Revenue by time period
                </div>
              </div>
            </div>
            <Clock className="w-4 h-4 text-gray-400" />
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={time_slot_performance}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="slot" stroke="#6b7280" />
              <YAxis stroke="#6b7280" />
              <Tooltip />
              <Bar dataKey="revenue" fill={`var(--color-${themeColor}-500)`} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tables - 2 columns */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Package Details Table */}
        <div className="bg-white rounded-xl shadow-sm p-3 sm:p-6 border border-gray-100">
          <div className="flex items-center gap-2 mb-4">
            <Package className={`w-5 h-5 text-${themeColor}-600`} />
            <h3 className="text-lg font-semibold text-gray-900">Package Bookings</h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 font-medium text-gray-600">Package</th>
                <th className="text-left py-3 font-medium text-gray-600">Bookings</th>
                <th className="text-left py-3 font-medium text-gray-600">Participants</th>
              </tr>
            </thead>
            <tbody>
              {package_performance.map((pkg, index) => (
                <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 font-medium">{pkg.name}</td>
                  <td className="py-3">{pkg.bookings}</td>
                  <td className="py-3">{pkg.avg_party_size}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Attraction Details Table */}
        <div className="bg-white rounded-xl shadow-sm p-3 sm:p-6 border border-gray-100">
          <div className="flex items-center gap-2 mb-4">
            <Ticket className={`w-5 h-5 text-${themeColor}-600`} />
            <h3 className="text-lg font-semibold text-gray-900">Attraction Ticket Sales</h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 font-medium text-gray-600">Attraction</th>
                <th className="text-left py-3 font-medium text-gray-600">Tickets Sold</th>
                <th className="text-left py-3 font-medium text-gray-600">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {attraction_performance.map((attraction, index) => (
                <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 font-medium">{attraction.name}</td>
                  <td className="py-3">{attraction.tickets_sold}</td>
                  <td className="py-3">${attraction.revenue.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full mx-4 p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-semibold text-gray-900">Export Analytics - {location.name}</h3>
              <StandardButton
                onClick={() => setShowExportModal(false)}
                variant="ghost"
                size="sm"
                icon={X}
              />
            </div>
            <div className="space-y-6">
              {/* Date Range Filter */}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Time Period</label>
                <select
                  value={dateRange}
                  onChange={(e) => setDateRange(e.target.value as '7d' | '30d' | '90d' | '1y' | 'custom')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-${themeColor}-500"
                >
                  <option value="7d">Last 7 days</option>
                  <option value="30d">Last 30 days</option>
                  <option value="90d">Last 90 days</option>
                  <option value="1y">Last year</option>
                  <option value="custom">Custom Range</option>
                </select>
                {dateRange === 'custom' && (
                  <div className="mt-3 space-y-2">
                    <div>
                      <label className="text-xs text-gray-600 mb-1 block">Start Date</label>
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-${themeColor}-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-600 mb-1 block">End Date</label>
                      <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        min={startDate}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-${themeColor}-500"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Data Sections to Include */}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Include in Export</label>
                <div className="space-y-2 border border-gray-200 rounded-lg p-3">
                  {([
                    { id: 'metrics', label: 'Key Metrics' },
                    { id: 'revenue', label: 'Revenue Data' },
                    { id: 'packages', label: 'Package Performance' },
                    { id: 'attractions', label: 'Attraction Data' },
                    { id: 'timeslots', label: 'Time Slot Analysis' },
                  ] as { id: SectionType; label: string }[]).map(section => (
                    <label key={section.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
                      <input
                        type="checkbox"
                        checked={selectedSections.includes(section.id)}
                        onChange={() => toggleSection(section.id)}
                        className="w-4 h-4 text-${themeColor}-600 focus:ring-${themeColor}-500 border-gray-300 rounded"
                      />
                      <span className="text-sm text-gray-700">{section.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Export Format */}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Export Format</label>
                <select
                  value={exportFormat}
                  onChange={(e) => setExportFormat(e.target.value as 'json' | 'csv')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-${themeColor}-500"
                >
                  <option value="json">JSON (.json)</option>
                  <option value="csv">CSV (.csv)</option>
                  <option value="excel">Excel (.xlsx)</option>
                </select>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <StandardButton
                  onClick={() => setShowExportModal(false)}
                  variant="secondary"
                  fullWidth
                >
                  Cancel
                </StandardButton>
                <StandardButton
                  onClick={handleExport}
                  variant="primary"
                  fullWidth
                  disabled={isExporting}
                  loading={isExporting}
                  icon={!isExporting ? Download : undefined}
                >
                  Export Data
                </StandardButton>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LocationManagerAnalytics;
