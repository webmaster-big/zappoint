import { useState, useEffect } from 'react';
import { 
  Search, 
  Filter, 
  RefreshCcw,
  Calendar,
  Users,
  ShoppingCart,
  Clock,
  DollarSign,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type {
  AttendantsPerformanceAttendant,
  AttendantsPerformanceMetric,
  AttendantsPerformanceData,
  AttendantsPerformanceFilterOptions,
} from '../../../types/AttendantsPerformance.types';

const AttendantsPerformance = () => {
  const [performanceData, setPerformanceData] = useState<AttendantsPerformanceData[]>([]);
  const [filteredData, setFilteredData] = useState<AttendantsPerformanceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<AttendantsPerformanceFilterOptions>({
    timeRange: '7',
    department: 'all',
    search: ''
  });
  const [sortBy, setSortBy] = useState<'revenue' | 'bookings' | 'purchases' | 'customers' | 'hours'>('revenue');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showFilters, setShowFilters] = useState(false);
  const [expandedCard, setExpandedCard] = useState<string | null>(null);

  // Time range labels
  const timeRangeLabels = {
    '1': 'Today',
    '7': '7 Days',
    '30': '30 Days',
    '90': '90 Days',
    '365': '1 Year'
  };

  // Department colors
  const departmentColors: Record<string, string> = {
    'Guest Services': 'bg-blue-100 text-blue-800',
    'Entertainment': 'bg-blue-100 text-blue-800',
    'Food & Beverage': 'bg-blue-100 text-blue-800',
    'Maintenance': 'bg-blue-100 text-blue-800',
    'Security': 'bg-red-100 text-red-800',
    'Administration': 'bg-blue-100 text-blue-800'
  };

  // Metric icons and colors
  const metricConfig = {
    revenue: { icon: DollarSign, color: 'text-blue-600', bgColor: 'bg-blue-50' },
    bookings: { icon: Users, color: 'text-blue-600', bgColor: 'bg-blue-50' },
    purchases: { icon: ShoppingCart, color: 'text-blue-600', bgColor: 'bg-blue-50' },
    customers: { icon: Users, color: 'text-blue-600', bgColor: 'bg-blue-50' },
    hours: { icon: Clock, color: 'text-blue-600', bgColor: 'bg-blue-50' }
  };

  // Load performance data
  useEffect(() => {
    loadPerformanceData();
  }, []);

  // Apply filters when data or filters change
  useEffect(() => {
    applyFilters();
  }, [performanceData, filters, sortBy, sortOrder]);

  const loadPerformanceData = () => {
    try {
      const storedAttendants = localStorage.getItem('zapzone_attendants');
      const storedPerformance = localStorage.getItem('zapzone_performance_metrics');
      
      if (storedAttendants && storedPerformance) {
        const attendants = JSON.parse(storedAttendants);
        const performanceMetrics = JSON.parse(storedPerformance);
        
        const combinedData = attendants.map((attendant: AttendantsPerformanceAttendant) => ({
          attendant,
          metrics: performanceMetrics.filter((metric: AttendantsPerformanceMetric) => 
            metric.attendantId === attendant.id
          )
        }));
        
        setPerformanceData(combinedData);
      } else {
        generateSampleData();
      }
    } catch (error) {
      console.error('Error loading performance data:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateSampleData = () => {
    const sampleAttendants: AttendantsPerformanceAttendant[] = [
      {
        id: 'att_1',
        firstName: 'Sarah',
        lastName: 'Johnson',
        email: 'sarah.johnson@zapzone.com',
        department: 'Guest Services',
        position: 'Senior Attendant',
        hireDate: '2024-01-15',
        status: 'active'
      },
      {
        id: 'att_2',
        firstName: 'Mike',
        lastName: 'Chen',
        email: 'mike.chen@zapzone.com',
        department: 'Entertainment',
        position: 'Attendant',
        hireDate: '2024-02-01',
        status: 'active'
      },
      {
        id: 'att_3',
        firstName: 'Emily',
        lastName: 'Rodriguez',
        email: 'emily.rodriguez@zapzone.com',
        department: 'Food & Beverage',
        position: 'Team Lead',
        hireDate: '2023-11-20',
        status: 'active'
      },
      {
        id: 'att_4',
        firstName: 'David',
        lastName: 'Kim',
        email: 'david.kim@zapzone.com',
        department: 'Maintenance',
        position: 'Attendant',
        hireDate: '2024-03-10',
        status: 'active'
      }
    ];

    const timePeriods = ['1', '7', '30', '90', '365'];
    const performanceMetrics: AttendantsPerformanceMetric[] = [];

    sampleAttendants.forEach(attendant => {
      timePeriods.forEach(period => {
        const baseMultiplier = getBaseMultiplier(attendant.position);
        const randomFactor = 0.7 + Math.random() * 0.6;
        
        performanceMetrics.push({
          attendantId: attendant.id,
          period,
          bookingsCreated: Math.floor(baseMultiplier * randomFactor * getPeriodMultiplier(period) * (20 + Math.random() * 30)),
          purchasesProcessed: Math.floor(baseMultiplier * randomFactor * getPeriodMultiplier(period) * (15 + Math.random() * 25)),
          totalRevenue: Math.floor(baseMultiplier * randomFactor * getPeriodMultiplier(period) * (500 + Math.random() * 1500)),
          customersHandled: Math.floor(baseMultiplier * randomFactor * getPeriodMultiplier(period) * (25 + Math.random() * 40)),
          totalHours: Math.floor(baseMultiplier * randomFactor * getPeriodMultiplier(period) * (20 + Math.random() * 30)),
          lastActive: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
          loginCount: Math.floor(baseMultiplier * randomFactor * getPeriodMultiplier(period) * (5 + Math.random() * 15))
        });
      });
    });

    localStorage.setItem('zapzone_attendants', JSON.stringify(sampleAttendants));
    localStorage.setItem('zapzone_performance_metrics', JSON.stringify(performanceMetrics));
    
    const combinedData = sampleAttendants.map(attendant => ({
      attendant,
      metrics: performanceMetrics.filter(metric => metric.attendantId === attendant.id)
    }));
    
    setPerformanceData(combinedData);
  };

  const getBaseMultiplier = (position: string): number => {
    switch (position) {
      case 'Senior Attendant': return 1.4;
      case 'Team Lead': return 1.6;
      case 'Supervisor': return 1.8;
      default: return 1.0;
    }
  };

  const getPeriodMultiplier = (period: string): number => {
    switch (period) {
      case '1': return 1;
      case '7': return 7;
      case '30': return 30;
      case '90': return 90;
      case '365': return 365;
      default: return 1;
    }
  };

  const applyFilters = () => {
    let result = [...performanceData];

    if (filters.search) {
      const searchTerm = filters.search.toLowerCase();
      result = result.filter(data =>
        data.attendant.firstName.toLowerCase().includes(searchTerm) ||
        data.attendant.lastName.toLowerCase().includes(searchTerm) ||
        data.attendant.email.toLowerCase().includes(searchTerm)
      );
    }

    if (filters.department !== 'all') {
      result = result.filter(data => data.attendant.department === filters.department);
    }

    result.sort((a, b) => {
      const metricA = a.metrics.find(m => m.period === filters.timeRange);
      const metricB = b.metrics.find(m => m.period === filters.timeRange);
      
      if (!metricA || !metricB) return 0;

      let valueA, valueB;

      switch (sortBy) {
        case 'revenue':
          valueA = metricA.totalRevenue;
          valueB = metricB.totalRevenue;
          break;
        case 'bookings':
          valueA = metricA.bookingsCreated;
          valueB = metricB.bookingsCreated;
          break;
        case 'purchases':
          valueA = metricA.purchasesProcessed;
          valueB = metricB.purchasesProcessed;
          break;
        case 'customers':
          valueA = metricA.customersHandled;
          valueB = metricB.customersHandled;
          break;
        case 'hours':
          valueA = metricA.totalHours;
          valueB = metricB.totalHours;
          break;
        default:
          valueA = metricA.totalRevenue;
          valueB = metricB.totalRevenue;
      }

      return sortOrder === 'desc' ? valueB - valueA : valueA - valueB;
    });

    setFilteredData(result);
  };

  const handleFilterChange = (key: keyof AttendantsPerformanceFilterOptions, value: string) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleSort = (newSortBy: typeof sortBy) => {
    if (sortBy === newSortBy) {
      setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
    } else {
      setSortBy(newSortBy);
      setSortOrder('desc');
    }
  };

  const getCurrentMetric = (metrics: AttendantsPerformanceMetric[]) => {
    return metrics.find(metric => metric.period === filters.timeRange);
  };

  const formatCurrency = (amount: number) => {
    if (amount >= 1000) {
      return `$${(amount / 1000).toFixed(1)}k`;
    }
    return `$${amount}`;
  };

  const formatLastActive = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

    if (diffMins < 1) return 'Now';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffHours < 48) return '1d';
    
    return `${Math.floor(diffHours / 24)}d`;
  };

  // Calculate overall metrics for the header
  const overallMetrics = filteredData.reduce((acc, data) => {
    const metric = getCurrentMetric(data.metrics);
    if (metric) {
      acc.totalRevenue += metric.totalRevenue;
      acc.totalBookings += metric.bookingsCreated;
      acc.totalPurchases += metric.purchasesProcessed;
      acc.totalCustomers += metric.customersHandled;
      acc.totalHours += metric.totalHours;
    }
    return acc;
  }, {
    totalRevenue: 0,
    totalBookings: 0,
    totalPurchases: 0,
    totalCustomers: 0,
    totalHours: 0
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-800"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-2xl font-bold text-gray-900">Performance</h1>
        
        </div>
        <p className="text-gray-600 text-sm">Staff performance metrics</p>
      </div>

      {/* Time Range Selector - Mobile Optimized */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-gray-400" />
            <span className="text-sm font-medium text-gray-700">Period</span>
          </div>
          <span className="text-sm text-blue-800 font-medium">
            {timeRangeLabels[filters.timeRange]}
          </span>
        </div>
        
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
          {(['1', '7', '30', '90', '365'] as const).map(period => (
            <button
              key={period}
              onClick={() => handleFilterChange('timeRange', period)}
              className={`flex-1 px-2 py-2 text-xs font-medium rounded-md transition-colors ${
                filters.timeRange === period
                  ? 'bg-white text-blue-800 shadow-sm'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              {timeRangeLabels[period]}
            </button>
          ))}
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-4">
        <div className="flex gap-2 mb-3">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search attendants..."
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              className="pl-9 pr-3 py-2 border border-gray-200 rounded-lg w-full focus:ring-2 focus:ring-blue-400 focus:border-blue-400 text-sm"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            <Filter className="h-4 w-4" />
          </button>
            <button
            onClick={loadPerformanceData}
            className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            <RefreshCcw className="h-4 w-4" />
          </button>
        </div>

        {/* Advanced Filters */}
        {showFilters && (
          <div className="space-y-3 pt-3 border-t border-gray-100">
            <div>
              <label className="block text-sm font-medium text-gray-800 mb-1">Department</label>
              <select
                value={filters.department}
                onChange={(e) => handleFilterChange('department', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-400 focus:border-blue-400 text-sm"
              >
                <option value="all">All Departments</option>
                {[...new Set(performanceData.map(d => d.attendant.department))].map(dept => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-800 mb-1">Sort By</label>
              <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
                <button
                  onClick={() => handleSort('revenue')}
                  className={`flex-1 px-2 py-1 text-xs font-medium rounded transition-colors ${
                    sortBy === 'revenue' ? 'bg-white text-blue-800 shadow-sm' : 'text-gray-600'
                  }`}
                >
                  Revenue {sortBy === 'revenue' && (sortOrder === 'desc' ? '↓' : '↑')}
                </button>
                <button
                  onClick={() => handleSort('bookings')}
                  className={`flex-1 px-2 py-1 text-xs font-medium rounded transition-colors ${
                    sortBy === 'bookings' ? 'bg-white text-blue-800 shadow-sm' : 'text-gray-600'
                  }`}
                >
                  Bookings {sortBy === 'bookings' && (sortOrder === 'desc' ? '↓' : '↑')}
                </button>
                <button
                  onClick={() => handleSort('purchases')}
                  className={`flex-1 px-2 py-1 text-xs font-medium rounded transition-colors ${
                    sortBy === 'purchases' ? 'bg-white text-blue-800 shadow-sm' : 'text-gray-600'
                  }`}
                >
                  Sales {sortBy === 'purchases' && (sortOrder === 'desc' ? '↓' : '↑')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Overall Metrics - Mobile Grid */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-blue-100 rounded-lg">
              <DollarSign className="h-3 w-3 text-blue-800" />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-600">Revenue</p>
              <p className="text-lg font-bold text-gray-900">{formatCurrency(overallMetrics.totalRevenue)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-blue-100 rounded-lg">
              <Users className="h-3 w-3 text-blue-800" />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-600">Bookings</p>
              <p className="text-lg font-bold text-gray-900">{overallMetrics.totalBookings}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-blue-100 rounded-lg">
              <ShoppingCart className="h-3 w-3 text-blue-800" />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-600">Purchases</p>
              <p className="text-lg font-bold text-gray-900">{overallMetrics.totalPurchases}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-blue-100 rounded-lg">
              <Clock className="h-3 w-3 text-blue-800" />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-600">Hours</p>
              <p className="text-lg font-bold text-gray-900">{overallMetrics.totalHours}h</p>
            </div>
          </div>
        </div>
      </div>

      {/* Performance Cards - Mobile List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">
            Attendants ({filteredData.length})
          </h3>
          <span className="text-sm text-gray-600">
            {timeRangeLabels[filters.timeRange]}
          </span>
        </div>

        {filteredData.length === 0 ? (
          <div className="bg-white rounded-xl p-8 text-center">
            <p className="text-gray-800">No attendants found</p>
            <p className="text-sm text-gray-600 mt-1">Try adjusting your filters</p>
          </div>
        ) : (
          filteredData.map((data) => {
            const metric = getCurrentMetric(data.metrics);
            if (!metric) return null;

            const isExpanded = expandedCard === data.attendant.id;
            const MetricIcon = metricConfig[sortBy].icon;

            return (
              <div
                key={data.attendant.id}
                className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden"
              >
                {/* Card Header */}
                <div 
                  className="p-4 cursor-pointer"
                  onClick={() => setExpandedCard(isExpanded ? null : data.attendant.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-800 rounded-full flex items-center justify-center text-white font-bold text-sm">
                        {data.attendant.firstName[0]}{data.attendant.lastName[0]}
                      </div>
                      <div>
                        <div className="font-semibold text-gray-900">
                          {data.attendant.firstName} {data.attendant.lastName}
                        </div>
                        <div className="text-xs text-gray-600">{data.attendant.position}</div>
                        <div className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium mt-1 ${
                          departmentColors[data.attendant.department] || 'bg-gray-100 text-gray-800'
                        }`}>
                          {data.attendant.department}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <div className="flex items-center gap-1 justify-end">
                          <MetricIcon className={`h-3 w-3 ${metricConfig[sortBy].color}`} />
                          <span className="font-semibold text-gray-900 text-sm">
                            {sortBy === 'revenue' 
                              ? formatCurrency(metric.totalRevenue)
                              : sortBy === 'hours'
                              ? `${metric.totalHours}h`
                              : metric[sortBy === 'bookings' ? 'bookingsCreated' : 
                                      sortBy === 'purchases' ? 'purchasesProcessed' : 
                                      'customersHandled']
                            }
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          Last: {formatLastActive(metric.lastActive)}
                        </div>
                      </div>
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4 text-gray-400" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-gray-400" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-gray-100 pt-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className={`p-3 rounded-lg ${metricConfig.revenue.bgColor}`}>
                        <div className="flex items-center gap-2">
                          <DollarSign className={`h-3 w-3 ${metricConfig.revenue.color}`} />
                          <span className="text-xs font-medium text-gray-700">Revenue</span>
                        </div>
                        <div className="font-semibold text-gray-900 mt-1">
                          {formatCurrency(metric.totalRevenue)}
                        </div>
                      </div>
                      
                      <div className={`p-3 rounded-lg ${metricConfig.bookings.bgColor}`}>
                        <div className="flex items-center gap-2">
                          <Users className={`h-3 w-3 ${metricConfig.bookings.color}`} />
                          <span className="text-xs font-medium text-gray-700">Bookings</span>
                        </div>
                        <div className="font-semibold text-gray-900 mt-1">
                          {metric.bookingsCreated}
                        </div>
                      </div>
                      
                      <div className={`p-3 rounded-lg ${metricConfig.purchases.bgColor}`}>
                        <div className="flex items-center gap-2">
                          <ShoppingCart className={`h-3 w-3 ${metricConfig.purchases.color}`} />
                          <span className="text-xs font-medium text-gray-700">Purchases</span>
                        </div>
                        <div className="font-semibold text-gray-900 mt-1">
                          {metric.purchasesProcessed}
                        </div>
                      </div>
                      
                      <div className={`p-3 rounded-lg ${metricConfig.customers.bgColor}`}>
                        <div className="flex items-center gap-2">
                          <Users className={`h-3 w-3 ${metricConfig.customers.color}`} />
                          <span className="text-xs font-medium text-gray-700">Customers</span>
                        </div>
                        <div className="font-semibold text-gray-900 mt-1">
                          {metric.customersHandled}
                        </div>
                      </div>
                      
                      <div className={`p-3 rounded-lg ${metricConfig.hours.bgColor}`}>
                        <div className="flex items-center gap-2">
                          <Clock className={`h-3 w-3 ${metricConfig.hours.color}`} />
                          <span className="text-xs font-medium text-gray-700">Hours</span>
                        </div>
                        <div className="font-semibold text-gray-900 mt-1">
                          {metric.totalHours}h
                        </div>
                      </div>
                      
                      <div className="p-3 rounded-lg bg-gray-50">
                        <div className="flex items-center gap-2">
                          <Clock className="h-3 w-3 text-gray-600" />
                          <span className="text-xs font-medium text-gray-700">Logins</span>
                        </div>
                        <div className="font-semibold text-gray-900 mt-1">
                          {metric.loginCount}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default AttendantsPerformance;