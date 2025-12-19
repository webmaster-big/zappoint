import { useState, useEffect, useCallback } from 'react';
import {
  Download,
  Users,
  DollarSign,
  Package,
  Ticket,
  MapPin,
  TrendingUp,
  Clock,
  X,
  Filter,
  Info,
  Activity,
  Loader2,
  Building2,
  Boxes,
} from 'lucide-react';
import { useThemeColor } from '../../../hooks/useThemeColor';
import CounterAnimation from '../../../components/ui/CounterAnimation';
import StandardButton from '../../../components/ui/StandardButton';
import AnalyticsService from '../../../services/AnalyticsService';
import type { CompanyAnalyticsResponse } from '../../../services/AnalyticsService';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';

const CompanyAnalytics: React.FC = () => {
  const { themeColor } = useThemeColor();
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | '1y'>('30d');
  const [selectedLocations, setSelectedLocations] = useState<number[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [analyticsData, setAnalyticsData] = useState<CompanyAnalyticsResponse | null>(null);
  const [exportFormat, setExportFormat] = useState<'json' | 'csv'>('json');
  
  // TODO: Get company_id from authenticated user's company
  const companyId = 1; // Replace with actual company ID from user context

  const fetchAnalytics = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await AnalyticsService.getCompanyAnalytics({
        company_id: companyId,
        date_range: dateRange,
        location_ids: selectedLocations.length > 0 ? selectedLocations : undefined
      });
      console.log('Fetched Company Analytics:', data);
      setAnalyticsData(data);
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    } finally {
      setIsLoading(false);
    }
  }, [companyId, dateRange, selectedLocations]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);
  
  const toggleLocation = (locationId: number) => {
    setSelectedLocations(prev =>
      prev.includes(locationId) ? prev.filter(l => l !== locationId) : [...prev, locationId]
    );
  };
  
  const handleExport = async () => {
    if (!analyticsData) return;
    
    setIsExporting(true);
    try {
      const exportData = await AnalyticsService.exportCompanyAnalytics({
        company_id: companyId,
        date_range: dateRange,
        location_ids: selectedLocations.length > 0 ? selectedLocations : undefined,
        format: exportFormat,
      });
      
      AnalyticsService.downloadExportedFile(
        exportData,
        exportFormat,
        analyticsData.company.name
      );
      
      setShowExportModal(false);
    } catch (error) {
      console.error('Failed to export analytics:', error);
    } finally {
      setIsExporting(false);
    }
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

  const { company, key_metrics, revenue_trend, location_performance, package_distribution, peak_hours, daily_performance, booking_status, top_attractions } = analyticsData;
  
  // All available locations for filter
  const allLocations = location_performance.map(loc => ({
    id: loc.location_id,
    name: loc.location,
  }));

  return (
    <div className="min-h-screen bg-gray-50 p-2 sm:p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 flex items-center gap-2 mb-1">
            Company Analytics
          </h1>
          <p className="text-sm md:text-base text-gray-600">
            {selectedLocations.length > 0
              ? `${selectedLocations.length} location${selectedLocations.length !== 1 ? 's' : ''} selected`
              : `All ${company.total_locations} locations`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 mt-4 md:mt-0">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as '7d' | '30d' | '90d' | '1y')}
            className={`px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-${themeColor}-500`}
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="1y">Last year</option>
          </select>
          <StandardButton
            onClick={() => setShowFilters(!showFilters)}
            variant={showFilters ? "primary" : "secondary"}
            size="sm"
            icon={Filter}
          >
            Locations
            {selectedLocations.length > 0 && (
              <span className="ml-1 px-2 py-0.5 rounded-full text-xs bg-white text-gray-900">
                {selectedLocations.length}
              </span>
            )}
          </StandardButton>
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

      {/* Location Filter */}
      {showFilters && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-medium text-gray-700">Select Locations</label>
            <StandardButton
              onClick={() => setSelectedLocations([])}
              variant="ghost"
              size="sm"
            >
              Clear All
            </StandardButton>
          </div>
          <div className="flex flex-wrap gap-2">
            {allLocations.map(location => (
              <StandardButton
                key={location.id}
                onClick={() => toggleLocation(location.id)}
                variant={selectedLocations.includes(location.id) ? "primary" : "ghost"}
                size="sm"
              >
                {location.name}
              </StandardButton>
            ))}
          </div>
        </div>
      )}

      {/* Key Metrics - 6 columns like CustomerAnalytics */}
      <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2 sm:gap-4">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-600">Total Revenue</p>
              <div className="text-2xl font-bold text-gray-900 mt-1">
                $<CounterAnimation
                  value={key_metrics.total_revenue.value}
                  className="text-2xl font-bold text-gray-900"
                />
              </div>
              <p className={`text-xs mt-1 ${
                key_metrics.total_revenue.change.includes('+') ? 'text-green-600' : 'text-red-600'
              }`}>
                {key_metrics.total_revenue.change}
              </p>
            </div>
            <div className={`p-2 bg-${themeColor}-50 rounded-lg`}>
              <DollarSign className={`w-5 h-5 text-${themeColor}-600`} />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-600">Total Locations</p>
              <div className="text-2xl font-bold text-gray-900 mt-1">
                <CounterAnimation
                  value={key_metrics.total_locations.value}
                  className="text-2xl font-bold text-gray-900"
                />
              </div>
              <p className="text-xs mt-1 text-gray-600">
                {key_metrics.total_locations.info}
              </p>
            </div>
            <div className={`p-2 bg-${themeColor}-50 rounded-lg`}>
              <Building2 className={`w-5 h-5 text-${themeColor}-600`} />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-600">Package Bookings</p>
              <div className="text-2xl font-bold text-gray-900 mt-1">
                <CounterAnimation
                  value={key_metrics.package_bookings.value}
                  className="text-2xl font-bold text-gray-900"
                />
              </div>
              <p className={`text-xs mt-1 ${
                key_metrics.package_bookings.change.includes('+') ? 'text-green-600' : 'text-red-600'
              }`}>
                {key_metrics.package_bookings.change}
              </p>
            </div>
            <div className={`p-2 bg-${themeColor}-50 rounded-lg`}>
              <Package className={`w-5 h-5 text-${themeColor}-600`} />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-600">Ticket Purchases</p>
              <div className="text-2xl font-bold text-gray-900 mt-1">
                <CounterAnimation
                  value={key_metrics.ticket_purchases.value}
                  className="text-2xl font-bold text-gray-900"
                />
              </div>
              <p className={`text-xs mt-1 ${
                key_metrics.ticket_purchases.change.includes('+') ? 'text-green-600' : 'text-red-600'
              }`}>
                {key_metrics.ticket_purchases.change}
              </p>
            </div>
            <div className={`p-2 bg-${themeColor}-50 rounded-lg`}>
              <Ticket className={`w-5 h-5 text-${themeColor}-600`} />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-600">Total Participants</p>
              <div className="text-2xl font-bold text-gray-900 mt-1">
                <CounterAnimation
                  value={key_metrics.total_participants.value}
                  className="text-2xl font-bold text-gray-900"
                />
              </div>
              <p className={`text-xs mt-1 ${
                key_metrics.total_participants.change.includes('+') ? 'text-green-600' : 'text-red-600'
              }`}>
                {key_metrics.total_participants.change}
              </p>
            </div>
            <div className={`p-2 bg-${themeColor}-50 rounded-lg`}>
              <Users className={`w-5 h-5 text-${themeColor}-600`} />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-600">Active Packages</p>
              <div className="text-2xl font-bold text-gray-900 mt-1">
                <CounterAnimation
                  value={key_metrics.active_packages.value}
                  className="text-2xl font-bold text-gray-900"
                />
              </div>
              <p className="text-xs mt-1 text-gray-600">
                {key_metrics.active_packages.info}
              </p>
            </div>
            <div className={`p-2 bg-${themeColor}-50 rounded-lg`}>
              <Boxes className={`w-5 h-5 text-${themeColor}-600`} />
            </div>
          </div>
        </div>
      </div>

      {/* Charts Grid - 2 columns */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Revenue & Bookings Trend */}
        <div className="bg-white rounded-xl p-3 sm:p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-gray-900">Revenue & Package Bookings</h3>
              <div className="group relative">
                <Info className="w-4 h-4 text-gray-400 cursor-help" />
                <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-64 p-2 bg-gray-900 text-white text-xs rounded shadow-lg z-10">
                  Total revenue and package booking trends across all locations. Revenue includes both packages and attraction tickets.
                </div>
              </div>
            </div>
            <TrendingUp className="w-4 h-4 text-gray-400" />
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={revenue_trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="month" stroke="#6b7280" />
              <YAxis yAxisId="left" stroke={`var(--color-${themeColor}-500)`} />
              <YAxis yAxisId="right" orientation="right" stroke="#10b981" />
              <Tooltip />
              <Legend />
              <Line yAxisId="left" type="monotone" dataKey="revenue" stroke={`var(--color-${themeColor}-500)`} strokeWidth={2} name="Revenue ($)" />
              <Line yAxisId="right" type="monotone" dataKey="bookings" stroke="#10b981" strokeWidth={2} name="Bookings" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Top Locations Performance */}
        <div className="bg-white rounded-xl p-3 sm:p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-gray-900">Location Performance</h3>
              <div className="group relative">
                <Info className="w-4 h-4 text-gray-400 cursor-help" />
                <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-64 p-2 bg-gray-900 text-white text-xs rounded shadow-lg z-10">
                  Revenue comparison across all locations
                </div>
              </div>
            </div>
            <MapPin className="w-4 h-4 text-gray-400" />
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={location_performance.slice(0, 8)}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="location" stroke="#6b7280" />
              <YAxis stroke="#6b7280" />
              <Tooltip />
              <Bar dataKey="revenue" fill={`var(--color-${themeColor}-500)`} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Package Distribution */}
        <div className="bg-white rounded-xl p-3 sm:p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-gray-900">Package Distribution</h3>
              <div className="group relative">
                <Info className="w-4 h-4 text-gray-400 cursor-help" />
                <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-64 p-2 bg-gray-900 text-white text-xs rounded shadow-lg z-10">
                  Distribution of package bookings by type. Packages are group experiences that can be reserved in advance.
                </div>
              </div>
            </div>
            <Package className="w-4 h-4 text-gray-400" />
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={package_distribution}
                cx="50%"
                cy="50%"
                labelLine={false}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
                label={({ name, value }) => `${name}: ${value}%`}
              >
                {package_distribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Peak Hours */}
        <div className="bg-white rounded-xl p-3 sm:p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-gray-900">Peak Activity Hours</h3>
              <div className="group relative">
                <Info className="w-4 h-4 text-gray-400 cursor-help" />
                <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-64 p-2 bg-gray-900 text-white text-xs rounded shadow-lg z-10">
                  Hourly activity patterns for package bookings and ticket purchases across all locations
                </div>
              </div>
            </div>
            <Clock className="w-4 h-4 text-gray-400" />
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={peak_hours}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="hour" stroke="#6b7280" />
              <YAxis stroke="#6b7280" />
              <Tooltip />
              <Bar dataKey="bookings" fill={`var(--color-${themeColor}-500)`} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Daily Performance */}
        <div className="bg-white rounded-xl p-3 sm:p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-gray-900">Daily Performance (7 Days)</h3>
              <div className="group relative">
                <Info className="w-4 h-4 text-gray-400 cursor-help" />
                <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-64 p-2 bg-gray-900 text-white text-xs rounded shadow-lg z-10">
                  Revenue and participant trends over the last week
                </div>
              </div>
            </div>
            <Activity className="w-4 h-4 text-gray-400" />
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={daily_performance}>
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

        {/* Booking Status */}
        <div className="bg-white rounded-xl p-3 sm:p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-gray-900">Booking Status</h3>
              <div className="group relative">
                <Info className="w-4 h-4 text-gray-400 cursor-help" />
                <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-64 p-2 bg-gray-900 text-white text-xs rounded shadow-lg z-10">
                  Current status of all bookings
                </div>
              </div>
            </div>
            <Activity className="w-4 h-4 text-gray-400" />
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={booking_status}
                cx="50%"
                cy="50%"
                labelLine={false}
                outerRadius={80}
                fill="#8884d8"
                dataKey="count"
                label={({ status, count }) => `${status}: ${count}`}
              >
                {booking_status.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tables - 2 columns */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Top Locations Table */}
        <div className="bg-white rounded-xl shadow-sm p-3 sm:p-6 border border-gray-100">
          <div className="flex items-center gap-2 mb-4">
            <MapPin className={`w-5 h-5 text-${themeColor}-600`} />
            <h3 className="text-lg font-semibold text-gray-900">Top Locations by Revenue</h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 font-medium text-gray-600">Location</th>
                <th className="text-left py-3 font-medium text-gray-600">Revenue</th>
                <th className="text-left py-3 font-medium text-gray-600">Packages</th>
              </tr>
            </thead>
            <tbody>
              {location_performance.slice(0, 6).map((location, index) => (
                <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 font-medium">{location.location}</td>
                  <td className="py-3">${location.revenue.toLocaleString()}</td>
                  <td className="py-3">{location.bookings}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Top Attractions Table */}
        <div className="bg-white rounded-xl shadow-sm p-3 sm:p-6 border border-gray-100">
          <div className="flex items-center gap-2 mb-4">
            <Ticket className={`w-5 h-5 text-${themeColor}-600`} />
            <h3 className="text-lg font-semibold text-gray-900">Top Attractions (Ticket Sales)</h3>
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
              {top_attractions.map((attraction, index) => (
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
              <h3 className="text-lg font-semibold text-gray-900">Export Analytics</h3>
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
                  onChange={(e) => setDateRange(e.target.value as '7d' | '30d' | '90d' | '1y')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-${themeColor}-500"
                >
                  <option value="7d">Last 7 days</option>
                  <option value="30d">Last 30 days</option>
                  <option value="90d">Last 90 days</option>
                  <option value="1y">Last year</option>
                </select>
              </div>

              {/* Location Filter */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700">Locations</label>
                  <StandardButton
                    onClick={() => setSelectedLocations([])}
                    variant="ghost"
                    size="sm"
                  >
                    Clear All
                  </StandardButton>
                </div>
                <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-3">
                  <div className="space-y-2">
                    {allLocations.map(location => (
                      <label key={location.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
                        <input
                          type="checkbox"
                          checked={selectedLocations.includes(location.id)}
                          onChange={() => toggleLocation(location.id)}
                          className="w-4 h-4 text-${themeColor}-600 focus:ring-${themeColor}-500 border-gray-300 rounded"
                        />
                        <span className="text-sm text-gray-700">{location.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  {selectedLocations.length > 0 ? `${selectedLocations.length} location(s) selected` : 'All locations selected'}
                </p>
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

export default CompanyAnalytics;
