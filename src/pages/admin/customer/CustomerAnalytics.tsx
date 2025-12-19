import React, { useState, useEffect } from 'react';
import {
  Users,
  TrendingUp,
  DollarSign,
  Star,
  Activity,
  Repeat,
  Clock,
  Filter,
  Download,
  ChevronDown,
  Info,
  FileText,
  FileSpreadsheet,
  Receipt,
  X,
} from 'lucide-react';
import { useThemeColor } from '../../../hooks/useThemeColor';
import CounterAnimation from '../../../components/ui/CounterAnimation';
import StandardButton from '../../../components/ui/StandardButton';
import { customerService } from '../../../services/CustomerService';
import { locationService } from '../../../services/LocationService';
import LocationSelector from '../../../components/admin/LocationSelector';
import { getStoredUser, API_BASE_URL } from '../../../utils/storage';

// Recharts for charts
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
import type { CustomerAnalyticsAnalyticsData } from '../../../types/CustomerAnalytics.types';

const CustomerAnalytics: React.FC = () => {
  const { themeColor, fullColor } = useThemeColor();
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | '1y'>('30d');
  const [selectedLocation, setSelectedLocation] = useState<number | null>(null);
  const [locations, setLocations] = useState<Array<{ id: number; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [keyMetrics, setKeyMetrics] = useState<any[]>([]);
  const [analyticsData, setAnalyticsData] = useState<CustomerAnalyticsAnalyticsData | null>(null);
  const [topActivities, setTopActivities] = useState<any[]>([]);
  const [topPackages, setTopPackages] = useState<any[]>([]);
  const [recentCustomers, setRecentCustomers] = useState<any[]>([]);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFormat, setExportFormat] = useState<'csv' | 'pdf' | 'receipt'>('csv');
  const [exportSections, setExportSections] = useState<string[]>(['customers', 'revenue', 'bookings', 'activities', 'packages']);
  const [isExporting, setIsExporting] = useState(false);
  const [exportDateRange, setExportDateRange] = useState<'7d' | '30d' | '90d' | '1y' | 'all' | ''>('all');
  const [exportLocation, setExportLocation] = useState<number | null>(null);
  
  const user = getStoredUser();
  const isCompanyAdmin = user?.role === 'company_admin';

  // Fetch locations for company admin
  useEffect(() => {
    if (isCompanyAdmin) {
      fetchLocations();
    }
  }, [isCompanyAdmin]);

  // Fetch analytics data when date range or location changes
  useEffect(() => {
    fetchAnalytics();
  }, [dateRange, selectedLocation]);

  const fetchLocations = async () => {
    try {
      const response = await locationService.getLocations();
      if (response.success && response.data) {
        setLocations(Array.isArray(response.data) ? response.data : []);
      }
    } catch (error) {
      console.error('Error fetching locations:', error);
    }
  };

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const params: any = {
        user_id: user?.id,
        date_range: dateRange,
      };
      
      if (selectedLocation !== null) {
        params.location_id = selectedLocation;
      }

      const response = await customerService.getAnalytics(params);
      
      if (response.success) {
        setKeyMetrics(response.data.keyMetrics);
        setAnalyticsData(response.data.analyticsData);
        setTopActivities(response.data.topActivities);
        setTopPackages(response.data.topPackages);
        setRecentCustomers(response.data.recentCustomers);
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  // Icon mapping for metrics
  const iconMap: Record<string, any> = {
    'Total Customers': Users,
    'Active Customers': Activity,
    'Total Revenue': DollarSign,
    'Repeat Rate': Repeat,
    'Avg. Revenue/Customer': DollarSign,
    'New Customers (30d)': TrendingUp,
  };

  // Tooltip descriptions for metrics
  const metricTooltips: Record<string, string> = {
    'Total Customers': 'Total number of unique customers who have made bookings or purchases.',
    'Active Customers': 'Customers who have made at least one booking in the last 30 days.',
    'Total Revenue': 'Combined revenue from all bookings and attraction purchases in the selected period.',
    'Repeat Rate': 'Percentage of customers who made more than one booking, indicating customer loyalty.',
    'Avg. Revenue/Customer': 'Average amount spent per customer, calculated from total revenue divided by customer count.',
    'New Customers (30d)': 'Number of first-time customers who joined in the last 30 days.',
  };

  const handleExport = async () => {
    try {
      setIsExporting(true);
      
      const params: any = {
        user_id: user?.id,
        format: exportFormat,
        include_sections: exportSections,
      };
      
      // Add date_range (defaults to 'all' if not set)
      params.date_range = exportDateRange || 'all';
      
      // Only add location_id if selected
      if (exportLocation !== null) {
        params.location_id = exportLocation;
      }

      const response = await fetch(`${API_BASE_URL}/customers/analytics/export`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user?.token}`,
        },
        body: JSON.stringify(params),
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        
        const contentDisposition = response.headers.get('Content-Disposition');
        const filenameMatch = contentDisposition?.match(/filename="(.+)"/);  
        
        // Use proper file extension based on format
        const fileExtension = exportFormat === 'receipt' ? 'png' : exportFormat;
        const filename = filenameMatch ? filenameMatch[1] : `analytics_export_${Date.now()}.${fileExtension}`;        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        setShowExportModal(false);
      } else {
        const errorText = await response.text();
        console.error('Export failed:', errorText);
        alert(`Export failed: ${response.status} - Please try again or contact support.`);
      }
    } catch (error) {
      console.error('Error exporting analytics:', error);
      alert('Failed to export analytics. Please check your connection and try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const toggleSection = (section: string) => {
    setExportSections(prev => 
      prev.includes(section) 
        ? prev.filter(s => s !== section)
        : [...prev, section]
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-2 sm:p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 flex items-center gap-2 mb-1">
            <Users className={`w-6 h-6 text-${themeColor}-600`} />
            Customer Analytics
          </h1>
          <p className="text-sm md:text-base text-gray-600">
            Comprehensive insights into customer behavior and performance
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 mt-4 md:mt-0">
            {isCompanyAdmin && locations.length > 0 && (
              <LocationSelector
                variant="compact"
                locations={locations}
                selectedLocation={selectedLocation?.toString() || ''}
                onLocationChange={(id) => setSelectedLocation(id ? parseInt(id) : null)}
                themeColor={themeColor}
                fullColor={fullColor}
                showAllOption={true}
              />
            )}
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
              variant="primary"
              size="md"
              onClick={() => setShowExportModal(true)}
              icon={Download}
            >
              Export
            </StandardButton>
          </div>
      </div>

      {/* Key Metrics Grid */}
  <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2 sm:gap-4">
        {keyMetrics.map((metric, index) => {
          const Icon = iconMap[metric.label] || Users;
          const tooltip = metricTooltips[metric.label] || '';
          return (
            <div key={index} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 group relative">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-1">
                    <p className="text-sm font-medium text-gray-600">{metric.label}</p>
                    {tooltip && (
                      <div className="relative">
                        <Info className="w-3 h-3 text-gray-400 cursor-help" />
                        <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-48 p-2 bg-gray-900 text-white text-xs rounded shadow-lg z-10">
                          {tooltip}
                        </div>
                      </div>
                    )}
                  </div>
                  <CounterAnimation value={metric.value} className="text-2xl font-bold text-gray-900 mt-1" />
                  <p className={`text-xs mt-1 ${
                    metric.trend === 'up' ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {metric.change} from previous period
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

  {/* Charts Grid - now 2 columns for better balance */}
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Booking Time Distribution Chart */}
  <div className="bg-white rounded-xl p-3 sm:p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-gray-900">Booking Time Distribution</h3>
              <div className="group relative">
                <Info className="w-4 h-4 text-gray-400 cursor-help" />
                <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-64 p-2 bg-gray-900 text-white text-xs rounded shadow-lg z-10">
                  Shows which hours of the day customers prefer to make bookings. Helps identify peak booking times.
                </div>
              </div>
            </div>
            <Clock className="w-4 h-4 text-gray-400" />
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={analyticsData?.bookingTimeDistribution || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="time" stroke="#6b7280" />
              <YAxis stroke="#6b7280" />
              <Tooltip />
              <Bar dataKey="count" fill={`var(--color-${themeColor}-500)`} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        {/* Customer Growth Chart */}
  <div className="bg-white rounded-xl p-3 sm:p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-gray-900">Customer Growth</h3>
              <div className="group relative">
                <Info className="w-4 h-4 text-gray-400 cursor-help" />
                <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-64 p-2 bg-gray-900 text-white text-xs rounded shadow-lg z-10">
                  Tracks total customer count over the past 9 months. Shows how your customer base is expanding.
                </div>
              </div>
            </div>
            <Filter className="w-4 h-4 text-gray-400" />
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={analyticsData?.customerGrowth || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="month" stroke="#6b7280" />
              <YAxis stroke="#6b7280" />
              <Tooltip />
              <Area 
                type="monotone" 
                dataKey="customers" 
                stroke={`var(--color-${themeColor}-500)`}
                fill={`var(--color-${themeColor}-500)`}
                fillOpacity={0.1}
                name="Total Customers"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Revenue Trend */}
  <div className="bg-white rounded-xl p-3 sm:p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-gray-900">Revenue & Bookings Trend</h3>
              <div className="group relative">
                <Info className="w-4 h-4 text-gray-400 cursor-help" />
                <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-64 p-2 bg-gray-900 text-white text-xs rounded shadow-lg z-10">
                  Displays monthly revenue and total bookings. Helps correlate booking volume with revenue performance.
                </div>
              </div>
            </div>
            <Filter className="w-4 h-4 text-gray-400" />
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={analyticsData?.revenueTrend || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="month" stroke="#6b7280" />
              <YAxis yAxisId="left" stroke={`var(--color-${themeColor}-500)`} />
              <YAxis yAxisId="right" orientation="right" stroke="#10b981" />
              <Tooltip />
              <Legend />
              <Line 
                yAxisId="left"
                type="monotone" 
                dataKey="revenue" 
                stroke={`var(--color-${themeColor}-500)`}
                strokeWidth={2}
                name="Revenue ($)"
              />
              <Line 
                yAxisId="right"
                type="monotone" 
                dataKey="bookings" 
                stroke="#10b981" 
                strokeWidth={2}
                name="Bookings"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Bookings per Customer Chart */}
  <div className="bg-white rounded-xl p-3 sm:p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-gray-900">Bookings per Customer</h3>
              <div className="group relative">
                <Info className="w-4 h-4 text-gray-400 cursor-help" />
                <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-64 p-2 bg-gray-900 text-white text-xs rounded shadow-lg z-10">
                  Shows top customers by number of bookings. Identifies your most frequent customers.
                </div>
              </div>
            </div>
            <Repeat className="w-4 h-4 text-gray-400" />
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={analyticsData?.bookingsPerCustomer || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="name" stroke="#6b7280" />
              <YAxis stroke="#6b7280" />
              <Tooltip />
              <Bar dataKey="bookings" fill={`var(--color-${themeColor}-500)`} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Customer Status Distribution Chart */}
  <div className="bg-white rounded-xl p-3 sm:p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-gray-900">Customer Status Distribution</h3>
              <div className="group relative">
                <Info className="w-4 h-4 text-gray-400 cursor-help" />
                <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-64 p-2 bg-gray-900 text-white text-xs rounded shadow-lg z-10">
                  Breakdown of customers by activity status: Active (booked within last 30 days), Inactive (booked before 30 days ago), New (new customers in last 30 days).
                </div>
              </div>
            </div>
            <Activity className="w-4 h-4 text-gray-400" />
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={analyticsData?.statusDistribution || []}
                cx="50%"
                cy="50%"
                labelLine={false}
                outerRadius={80}
                fill="#8884d8"
                dataKey="count"
                nameKey="status"
                label={({ status, count }) => `${status}: ${count}`}
              >
                {(analyticsData?.statusDistribution || []).map((entry, index) => (
                  <Cell key={`cell-status-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Activity by Hour */}
  <div className="bg-white rounded-xl p-3 sm:p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-gray-900">Customer Activity by Hour</h3>
              <div className="group relative">
                <Info className="w-4 h-4 text-gray-400 cursor-help" />
                <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-64 p-2 bg-gray-900 text-white text-xs rounded shadow-lg z-10">
                  Shows when customers are most active on your platform. Helps optimize staffing and promotional timing.
                </div>
              </div>
            </div>
            <Clock className="w-4 h-4 text-gray-400" />
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={analyticsData?.activityHours || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="hour" stroke="#6b7280" />
              <YAxis stroke="#6b7280" />
              <Tooltip />
              <Bar dataKey="activity" fill={`var(--color-${themeColor}-600)`} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Customer Lifetime Value */}
  <div className="bg-white rounded-xl p-3 sm:p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-gray-900">Customer Value Segments</h3>
              <div className="group relative">
                <Info className="w-4 h-4 text-gray-400 cursor-help" />
                <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-64 p-2 bg-gray-900 text-white text-xs rounded shadow-lg z-10">
                  Categorizes customers by total spending: High Value ($1000+), Medium Value ($500-$999), Low Value (under $500).
                </div>
              </div>
            </div>
            <DollarSign className="w-4 h-4 text-gray-400" />
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={analyticsData?.customerLifetimeValue || []}
                cx="50%"
                cy="50%"
                labelLine={false}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
                nameKey="segment"
                label={({ segment, value }) => `${segment}: ${value}%`}
              >
                {(analyticsData?.customerLifetimeValue || []).map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Repeat Customers */}
  <div className="bg-white rounded-xl p-3 sm:p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-gray-900">Repeat Customer Rate</h3>
              <div className="group relative">
                <Info className="w-4 h-4 text-gray-400 cursor-help" />
                <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-64 p-2 bg-gray-900 text-white text-xs rounded shadow-lg z-10">
                  Percentage of customers who made multiple bookings each month. Higher rates indicate better customer loyalty.
                </div>
              </div>
            </div>
            <Repeat className="w-4 h-4 text-gray-400" />
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={analyticsData?.repeatCustomers || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="month" stroke="#6b7280" />
              <YAxis stroke="#6b7280" />
              <Tooltip />
              <Line type="monotone" dataKey="repeatRate" stroke="#10b981" strokeWidth={2} name="Repeat Rate %" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top 5 Most Purchased Activities by Customer */}
      {/* Top 5 Tables in grid-2 */}
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
  <div className="bg-white rounded-xl shadow-sm p-3 sm:p-6 border border-gray-100">
          <div className="flex items-center gap-2 mb-4">
            <Activity className={`w-5 h-5 text-${themeColor}-600`} />
            <h3 className="text-lg font-semibold text-gray-900">Top 5 Most Purchased Activities by Customer</h3>
            <div className="group relative">
              <Info className="w-4 h-4 text-gray-400 cursor-help" />
              <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-64 p-2 bg-gray-900 text-white text-xs rounded shadow-lg z-10">
                Shows which individual activities are most popular among your top customers. Helps identify trending attractions.
              </div>
            </div>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 font-medium text-gray-600">Customer</th>
                <th className="text-left py-3 font-medium text-gray-600">Activity</th>
                <th className="text-left py-3 font-medium text-gray-600">Purchases</th>
              </tr>
            </thead>
            <tbody>
              {topActivities.length > 0 ? (
                topActivities.map((activity, index) => (
                  <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3">{activity.customer}</td>
                    <td className="py-3">{activity.activity}</td>
                    <td className="py-3 font-medium">{activity.purchases}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3} className="py-8 text-center text-gray-500">
                    No activity data available
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
  <div className="bg-white rounded-xl shadow-sm p-3 sm:p-6 border border-gray-100">
          <div className="flex items-center gap-2 mb-4">
            <DollarSign className="w-5 h-5 text-green-600" />
            <h3 className="text-lg font-semibold text-gray-900">Top 5 Most Booked Packages by Customer</h3>
            <div className="group relative">
              <Info className="w-4 h-4 text-gray-400 cursor-help" />
              <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-64 p-2 bg-gray-900 text-white text-xs rounded shadow-lg z-10">
                Displays the most popular package deals among customers. Reveals which bundles drive the most bookings.
              </div>
            </div>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 font-medium text-gray-600">Customer</th>
                <th className="text-left py-3 font-medium text-gray-600">Package</th>
                <th className="text-left py-3 font-medium text-gray-600">Bookings</th>
              </tr>
            </thead>
            <tbody>
              {topPackages.length > 0 ? (
                topPackages.map((pkg, index) => (
                  <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3">{pkg.customer}</td>
                    <td className="py-3">{pkg.package}</td>
                    <td className="py-3 font-medium">{pkg.bookings}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3} className="py-8 text-center text-gray-500">
                    No package data available
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Customers Table */}
  <div className="bg-white rounded-xl shadow-sm p-3 sm:p-6 border border-gray-100">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-gray-900">Recent Customers</h3>
            <div className="group relative">
              <Info className="w-4 h-4 text-gray-400 cursor-help" />
              <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-64 p-2 bg-gray-900 text-white text-xs rounded shadow-lg z-10">
                List of recent customers with their activity summary. Shows join date, spending, booking count, and current status.
              </div>
            </div>
          </div>
          <StandardButton variant="ghost" size="sm" icon={ChevronDown}>
            View All
          </StandardButton>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 font-medium text-gray-600">Customer</th>
                <th className="text-left py-3 font-medium text-gray-600">Join Date</th>
                <th className="text-left py-3 font-medium text-gray-600">Total Spent</th>
                <th className="text-left py-3 font-medium text-gray-600">Bookings</th>
                <th className="text-left py-3 font-medium text-gray-600">Last Activity</th>
                <th className="text-left py-3 font-medium text-gray-600">Status</th>
              </tr>
            </thead>
            <tbody>
              {recentCustomers.length > 0 ? (
                recentCustomers.map((customer) => (
                  <tr key={customer.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3">
                      <div>
                        <div className="font-medium text-gray-900">{customer.name}</div>
                        <div className="text-xs text-gray-500">{customer.email}</div>
                      </div>
                    </td>
                    <td className="py-3 text-gray-600">{new Date(customer.joinDate).toLocaleDateString()}</td>
                    <td className="py-3 font-medium">${customer.totalSpent}</td>
                    <td className="py-3 text-gray-600">{customer.bookings}</td>
                    <td className="py-3">
                      <div className="flex items-center gap-1">
                        <Activity className="w-3 h-3 text-gray-400" />
                        <span className="text-sm font-medium">{new Date(customer.lastActivity).toLocaleDateString()}</span>
                      </div>
                    </td>
                    <td className="py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        customer.status === 'active' 
                          ? 'bg-green-100 text-green-800'
                          : customer.status === 'new'
                          ? `bg-${themeColor}-100 text-${fullColor}`
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {customer.status}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-gray-500">
                    No customer data available
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-semibold text-gray-900">Export Analytics</h3>
              <StandardButton
                variant="ghost"
                size="sm"
                onClick={() => setShowExportModal(false)}
                icon={X}
              />
            </div>
            
            {/* Format Selection */}
            <div className="mb-5">
              <label className="block text-sm font-medium text-gray-700 mb-2">Export Format</label>
              <div className="flex gap-4">
                {[
                  { value: 'csv', label: 'CSV', icon: FileSpreadsheet },
                  { value: 'pdf', label: 'PDF', icon: FileText },
                  { value: 'receipt', label: 'Receipt', icon: Receipt }
                ].map((format) => {
                  const Icon = format.icon;
                  return (
                    <label
                      key={format.value}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <input
                        type="radio"
                        name="format"
                        value={format.value}
                        checked={exportFormat === format.value}
                        onChange={() => setExportFormat(format.value as 'csv' | 'pdf' | 'receipt')}
                        className="w-4 h-4 text-blue-600"
                      />
                      <Icon className="w-4 h-4 text-gray-500" />
                      <span className="text-sm text-gray-700">{format.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Date Range Selection */}
            <div className="mb-5">
              <label className="block text-sm font-medium text-gray-700 mb-2">Date Range</label>
              <select 
                value={exportDateRange}
                onChange={(e) => setExportDateRange(e.target.value as '7d' | '30d' | '90d' | '1y' | 'all' | '')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Time</option>
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
                <option value="90d">Last 90 days</option>
                <option value="1y">Last year</option>
              </select>
            </div>

            {/* Location Selection for Company Admin */}
            {isCompanyAdmin && locations.length > 0 && (
              <div className="mb-5">
                <label className="block text-sm font-medium text-gray-700 mb-2">Location</label>
                <select 
                  value={exportLocation ?? ''}
                  onChange={(e) => setExportLocation(e.target.value ? parseInt(e.target.value) : null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Locations</option>
                  {locations.map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Sections Selection */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Include Sections</label>
              <div className="space-y-2">
                {[
                  { id: 'customers', label: 'Customers', icon: Users },
                  { id: 'revenue', label: 'Revenue', icon: DollarSign },
                  { id: 'bookings', label: 'Bookings', icon: Activity },
                  { id: 'activities', label: 'Activities', icon: TrendingUp },
                  { id: 'packages', label: 'Packages', icon: Star }
                ].map((section) => {
                  const Icon = section.icon;
                  return (
                    <label
                      key={section.id}
                      className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded"
                    >
                      <input
                        type="checkbox"
                        checked={exportSections.includes(section.id)}
                        onChange={() => toggleSection(section.id)}
                        className="w-4 h-4 text-blue-600 rounded"
                      />
                      <Icon className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-700">{section.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <StandardButton
                variant="secondary"
                size="md"
                onClick={() => setShowExportModal(false)}
                disabled={isExporting}
                className="flex-1"
              >
                Cancel
              </StandardButton>
              <StandardButton
                variant="primary"
                size="md"
                onClick={handleExport}
                disabled={isExporting || exportSections.length === 0}
                loading={isExporting}
                icon={Download}
                className="flex-1"
              >
                {isExporting ? 'Exporting...' : 'Export'}
              </StandardButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerAnalytics;