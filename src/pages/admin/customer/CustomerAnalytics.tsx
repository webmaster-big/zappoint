import React, { useState } from 'react';
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
} from 'lucide-react';
import { useThemeColor } from '../../../hooks/useThemeColor';

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
import type { CustomerAnalyticsCustomerData, CustomerAnalyticsAnalyticsData } from '../../../types/CustomerAnalytics.types';

const CustomerAnalytics: React.FC = () => {
  const { themeColor, fullColor } = useThemeColor();
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | '1y'>('30d');

  // Sample customer data
  const customerData: CustomerAnalyticsCustomerData[] = [
  { id: '1', name: 'John Smith', email: 'john@email.com', joinDate: '2024-01-15', totalSpent: 1250, bookings: 8, lastActivity: '2024-09-20', status: 'active', satisfaction: 4.8 },
  { id: '2', name: 'Sarah Johnson', email: 'sarah@email.com', joinDate: '2024-02-20', totalSpent: 850, bookings: 5, lastActivity: '2024-09-18', status: 'active', satisfaction: 4.5 },
  { id: '3', name: 'Mike Wilson', email: 'mike@email.com', joinDate: '2024-03-10', totalSpent: 420, bookings: 3, lastActivity: '2024-09-15', status: 'active', satisfaction: 4.2 },
  { id: '4', name: 'Emily Davis', email: 'emily@email.com', joinDate: '2024-06-05', totalSpent: 680, bookings: 4, lastActivity: '2024-09-10', status: 'active', satisfaction: 4.9 },
  { id: '5', name: 'David Brown', email: 'david@email.com', joinDate: '2024-07-12', totalSpent: 320, bookings: 2, lastActivity: '2024-08-28', status: 'inactive', satisfaction: 3.8 },
  ];

  // Analytics data
  const analyticsData: CustomerAnalyticsAnalyticsData = {
    customerGrowth: [
      { month: 'Jan', customers: 120, growth: 5 },
      { month: 'Feb', customers: 145, growth: 12 },
      { month: 'Mar', customers: 168, growth: 8 },
      { month: 'Apr', customers: 192, growth: 14 },
      { month: 'May', customers: 210, growth: 9 },
      { month: 'Jun', customers: 235, growth: 12 },
      { month: 'Jul', customers: 258, growth: 10 },
      { month: 'Aug', customers: 285, growth: 11 },
      { month: 'Sep', customers: 312, growth: 9 },
    ],
    revenueTrend: [
      { month: 'Jan', revenue: 12500, bookings: 45 },
      { month: 'Feb', revenue: 14200, bookings: 52 },
      { month: 'Mar', revenue: 15800, bookings: 58 },
      { month: 'Apr', revenue: 17200, bookings: 63 },
      { month: 'May', revenue: 18900, bookings: 69 },
      { month: 'Jun', revenue: 21500, bookings: 78 },
      { month: 'Jul', revenue: 23800, bookings: 85 },
      { month: 'Aug', revenue: 26500, bookings: 92 },
      { month: 'Sep', revenue: 28900, bookings: 98 },
    ],
    bookingTimeDistribution: [
      { time: '8 AM', count: 10 },
      { time: '9 AM', count: 18 },
      { time: '10 AM', count: 32 },
      { time: '11 AM', count: 40 },
      { time: '12 PM', count: 55 },
      { time: '1 PM', count: 60 },
      { time: '2 PM', count: 48 },
      { time: '3 PM', count: 35 },
      { time: '4 PM', count: 28 },
      { time: '5 PM', count: 22 },
      { time: '6 PM', count: 15 },
    ],
    bookingsPerCustomer: [
      { name: 'John Smith', bookings: 8 },
      { name: 'Sarah Johnson', bookings: 5 },
      { name: 'Mike Wilson', bookings: 3 },
      { name: 'Emily Davis', bookings: 4 },
      { name: 'David Brown', bookings: 2 },
    ],
    statusDistribution: [
      { status: 'active', count: 4, color: '#10b981' },
      { status: 'inactive', count: 1, color: '#ef4444' },
      { status: 'new', count: 0, color: '#3b82f6' },
    ],
    // locationDistribution removed
    activityHours: [
      { hour: '8 AM', activity: 12 },
      { hour: '10 AM', activity: 45 },
      { hour: '12 PM', activity: 78 },
      { hour: '2 PM', activity: 65 },
      { hour: '4 PM', activity: 89 },
      { hour: '6 PM', activity: 95 },
      { hour: '8 PM', activity: 72 },
      { hour: '10 PM', activity: 38 },
    ],
    customerLifetimeValue: [
      { segment: 'High Value', value: 45, color: '#10b981' },
      { segment: 'Medium Value', value: 30, color: '#3b82f6' },
      { segment: 'Low Value', value: 25, color: '#ef4444' },
    ],
    satisfactionScores: [
      { rating: 5, count: 145, percentage: 46 },
      { rating: 4, count: 98, percentage: 31 },
      { rating: 3, count: 42, percentage: 13 },
      { rating: 2, count: 18, percentage: 6 },
      { rating: 1, count: 9, percentage: 4 },
    ],
    repeatCustomers: [
      { month: 'Jan', repeatRate: 62 },
      { month: 'Feb', repeatRate: 65 },
      { month: 'Mar', repeatRate: 68 },
      { month: 'Apr', repeatRate: 71 },
      { month: 'May', repeatRate: 73 },
      { month: 'Jun', repeatRate: 75 },
      { month: 'Jul', repeatRate: 76 },
      { month: 'Aug', repeatRate: 78 },
      { month: 'Sep', repeatRate: 80 },
    ],
  };

  // Key metrics
  const keyMetrics = [
    { label: 'Total Customers', value: '312', change: '+12%', icon: Users, trend: 'up' },
    { label: 'Active Customers', value: '285', change: '+8%', icon: Activity, trend: 'up' },
    { label: 'Avg. Satisfaction', value: '4.6/5', change: '+0.2', icon: Star, trend: 'up' },
    { label: 'Repeat Rate', value: '78%', change: '+5%', icon: Repeat, trend: 'up' },
    { label: 'Avg. Revenue/Customer', value: '$92.63', change: '+3.2%', icon: DollarSign, trend: 'up' },
    { label: 'New Customers (30d)', value: '42', change: '+15%', icon: TrendingUp, trend: 'up' },
  ];

  // Colors for charts
  // COLORS removed

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
        <div className="flex items-center gap-3 mt-4 md:mt-0">
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
            <button className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm flex items-center gap-2 hover:bg-gray-50">
              <Download className="w-4 h-4" />
              Export
            </button>
          </div>
      </div>

      {/* Key Metrics Grid */}
  <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2 sm:gap-4">
        {keyMetrics.map((metric, index) => {
          const Icon = metric.icon;
          return (
            <div key={index} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">{metric.label}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{metric.value}</p>
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
            <h3 className="text-lg font-semibold text-gray-900">Booking Time Distribution</h3>
            <Clock className="w-4 h-4 text-gray-400" />
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={analyticsData.bookingTimeDistribution}>
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
            <h3 className="text-lg font-semibold text-gray-900">Customer Growth</h3>
            <Filter className="w-4 h-4 text-gray-400" />
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={analyticsData.customerGrowth}>
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
            <h3 className="text-lg font-semibold text-gray-900">Revenue & Bookings Trend</h3>
            <Filter className="w-4 h-4 text-gray-400" />
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={analyticsData.revenueTrend}>
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
            <h3 className="text-lg font-semibold text-gray-900">Bookings per Customer</h3>
            <Repeat className="w-4 h-4 text-gray-400" />
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={analyticsData.bookingsPerCustomer}>
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
            <h3 className="text-lg font-semibold text-gray-900">Customer Status Distribution</h3>
            <Activity className="w-4 h-4 text-gray-400" />
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={analyticsData.statusDistribution}
                cx="50%"
                cy="50%"
                labelLine={false}
                outerRadius={80}
                fill="#8884d8"
                dataKey="count"
                nameKey="status"
                label={({ status, count }) => `${status}: ${count}`}
              >
                {analyticsData.statusDistribution.map((entry, index) => (
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
            <h3 className="text-lg font-semibold text-gray-900">Customer Activity by Hour</h3>
            <Clock className="w-4 h-4 text-gray-400" />
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={analyticsData.activityHours}>
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
            <h3 className="text-lg font-semibold text-gray-900">Customer Value Segments</h3>
            <DollarSign className="w-4 h-4 text-gray-400" />
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={analyticsData.customerLifetimeValue}
                cx="50%"
                cy="50%"
                labelLine={false}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
                nameKey="segment"
                label={({ segment, value }) => `${segment}: ${value}%`}
              >
                {analyticsData.customerLifetimeValue.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Satisfaction Scores */}
  <div className="bg-white rounded-xl p-3 sm:p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Customer Satisfaction</h3>
            <Star className="w-4 h-4 text-gray-400" />
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={analyticsData.satisfactionScores}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="rating" stroke="#6b7280" />
              <YAxis stroke="#6b7280" />
              <Tooltip />
              <Bar dataKey="percentage" fill="#f59e0b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top 5 Most Purchased Activities by Customer */}
      {/* Top 5 Tables in grid-2 */}
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
  <div className="bg-white rounded-xl shadow-sm p-3 sm:p-6 border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Activity className={`w-5 h-5 text-${themeColor}-600`} />
            Top 5 Most Purchased Activities by Customer
          </h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 font-medium text-gray-600">Customer</th>
                <th className="text-left py-3 font-medium text-gray-600">Activity</th>
                <th className="text-left py-3 font-medium text-gray-600">Purchases</th>
              </tr>
            </thead>
            <tbody>
              {/* Example static data, replace with dynamic if available */}
              <tr className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-3">John Smith</td>
                <td className="py-3">Laser Tag</td>
                <td className="py-3 font-medium">12</td>
              </tr>
              <tr className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-3">Sarah Johnson</td>
                <td className="py-3">Bowling</td>
                <td className="py-3 font-medium">10</td>
              </tr>
              <tr className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-3">Emily Davis</td>
                <td className="py-3">Arcade</td>
                <td className="py-3 font-medium">9</td>
              </tr>
              <tr className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-3">Mike Wilson</td>
                <td className="py-3">Mini Golf</td>
                <td className="py-3 font-medium">8</td>
              </tr>
              <tr className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-3">David Brown</td>
                <td className="py-3">Bumper Cars</td>
                <td className="py-3 font-medium">7</td>
              </tr>
            </tbody>
          </table>
        </div>
  <div className="bg-white rounded-xl shadow-sm p-3 sm:p-6 border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-green-600" />
            Top 5 Most Booked Packages by Customer
          </h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 font-medium text-gray-600">Customer</th>
                <th className="text-left py-3 font-medium text-gray-600">Package</th>
                <th className="text-left py-3 font-medium text-gray-600">Bookings</th>
              </tr>
            </thead>
            <tbody>
              {/* Example static data, replace with dynamic if available */}
              <tr className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-3">John Smith</td>
                <td className="py-3">Family Fun Pack</td>
                <td className="py-3 font-medium">15</td>
              </tr>
              <tr className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-3">Sarah Johnson</td>
                <td className="py-3">Birthday Bash</td>
                <td className="py-3 font-medium">13</td>
              </tr>
              <tr className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-3">Emily Davis</td>
                <td className="py-3">Weekend Adventure</td>
                <td className="py-3 font-medium">11</td>
              </tr>
              <tr className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-3">Mike Wilson</td>
                <td className="py-3">Couple's Retreat</td>
                <td className="py-3 font-medium">9</td>
              </tr>
              <tr className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-3">David Brown</td>
                <td className="py-3">Kids Zone</td>
                <td className="py-3 font-medium">8</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Customers Table */}
  <div className="bg-white rounded-xl shadow-sm p-3 sm:p-6 border border-gray-100">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900">Recent Customers</h3>
          <button className={`text-sm text-${themeColor}-600 hover:text-${themeColor}-700 flex items-center gap-1`}>
            View All <ChevronDown className="w-4 h-4" />
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 font-medium text-gray-600">Customer</th>
                <th className="text-left py-3 font-medium text-gray-600">Join Date</th>
                <th className="text-left py-3 font-medium text-gray-600">Total Spent</th>
                <th className="text-left py-3 font-medium text-gray-600">Bookings</th>
                <th className="text-left py-3 font-medium text-gray-600">Satisfaction</th>
                <th className="text-left py-3 font-medium text-gray-600">Status</th>
              </tr>
            </thead>
            <tbody>
              {customerData.map((customer) => (
                <tr key={customer.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3">
                    <div>
                      <div className="font-medium text-gray-900">{customer.name}</div>
                      <div className="text-xs text-gray-500">{customer.email}</div>
                    </div>
                  </td>
                  {/* Location column removed */}
                  <td className="py-3 text-gray-600">{new Date(customer.joinDate).toLocaleDateString()}</td>
                  <td className="py-3 font-medium">${customer.totalSpent}</td>
                  <td className="py-3 text-gray-600">{customer.bookings}</td>
                  <td className="py-3">
                    <div className="flex items-center gap-1">
                      <Star className="w-3 h-3 text-yellow-400 fill-current" />
                      <span className="text-sm font-medium">{customer.satisfaction}</span>
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
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default CustomerAnalytics;