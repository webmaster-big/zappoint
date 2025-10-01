import { useState, useEffect } from 'react';
import { 
  Search, 
  Filter, 
  RefreshCcw,
  Download,
  ShoppingCart,
  Eye,
  Edit,
  LogIn,
  LogOut,
  Clock,
  Users,
  Zap,
  Trash2,
  Plus
} from 'lucide-react';

// Types
interface ActivityLog {
  id: string;
  attendantId: string;
  attendantName: string;
  action: string;
  resourceType: 'package' | 'customer' | 'purchase' | 'attraction' | 'booking' | 'attendant';
  resourceId?: string;
  resourceName?: string;
  details: string;
  timestamp: string;
  severity: 'info' | 'success' | 'warning';
}

interface FilterOptions {
  action: string;
  resourceType: string;
  attendant: string;
  dateRange: string;
  search: string;
}

const AttendantActivityLogs = () => {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<FilterOptions>({
    action: 'all',
    resourceType: 'all',
    attendant: 'all',
    dateRange: 'all',
    search: ''
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);
  const [showFilters, setShowFilters] = useState(false);

  // Action icons and colors
  const actionIcons = {
    created: Plus,
    updated: Edit,
    deleted: Trash2,
    viewed: Eye,
    checked_in: LogIn,
    checked_out: LogOut,
    purchased: ShoppingCart,
    logged_in: LogIn,
    logged_out: LogOut
  };

  const severityColors = {
    info: 'bg-blue-100 text-blue-800',
    success: 'bg-green-100 text-green-800',
    warning: 'bg-yellow-100 text-yellow-800',
  };

  const resourceTypeColors = {
    package: 'bg-blue-100 text-blue-800',
    customer: 'bg-blue-100 text-blue-800',
    purchase: 'bg-blue-100 text-blue-800',
    attraction: 'bg-blue-100 text-blue-800',
    booking: 'bg-blue-100 text-blue-800',
    attendant: 'bg-blue-100 text-blue-800'
  };

    const isToday = (date: Date) => {
    const today = new Date();
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
  };


  // Calculate metrics
  const metrics = [
    {
      title: 'Total Activities',
      value: logs.length.toString(),
      change: 'All time',
      accent: 'bg-blue-100 text-blue-800',
      icon: Clock,
    },
    {
      title: 'Today Activities',
      value: logs.filter(log => isToday(new Date(log.timestamp))).length.toString(),
      change: 'Last 24 hours',
      accent: 'bg-blue-100 text-blue-800',
      icon: Zap,
    },
    {
      title: 'Purchases Made',
      value: logs.filter(log => log.action === 'purchased').length.toString(),
      change: 'Total sales',
      accent: 'bg-blue-100 text-blue-800',
      icon: ShoppingCart,
    },
    {
      title: 'Active Attendants',
      value: [...new Set(logs.filter(log => 
        isToday(new Date(log.timestamp)) && log.action === 'logged_in'
      ).map(log => log.attendantId))].length.toString(),
      change: 'Logged in today',
      accent: 'bg-blue-100 text-blue-800',
      icon: Users,
    }
  ];

  // Load logs from localStorage
  useEffect(() => {
    loadLogs();
  }, []);

  // Apply filters when logs or filters change
  useEffect(() => {
    applyFilters();
  }, [logs, filters]);

  const loadLogs = () => {
    try {
      const storedLogs = localStorage.getItem('zapzone_activity_logs');
      if (storedLogs) {
        const parsedLogs = JSON.parse(storedLogs);
        setLogs(parsedLogs);
      } else {
        // Generate sample activity logs
        const sampleLogs = generateSampleLogs();
        setLogs(sampleLogs);
        localStorage.setItem('zapzone_activity_logs', JSON.stringify(sampleLogs));
      }
    } catch (error) {
      console.error('Error loading activity logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateSampleLogs = (): ActivityLog[] => {
    const attendants = [
      { id: 'att_1', name: 'Sarah Johnson' },
      { id: 'att_2', name: 'Mike Chen' },
      { id: 'att_3', name: 'Emily Rodriguez' },
      { id: 'att_4', name: 'David Kim' }
    ];

    type ResourceType = 'package' | 'customer' | 'purchase' | 'attraction' | 'booking' | 'attendant';
    const actions: Array<{
      action: string;
      resourceType: ResourceType;
      details: string;
      severity: 'info' | 'success' | 'warning';
    }> = [
      // Package actions
      { action: 'created', resourceType: 'package', details: 'Created new package {name}', severity: 'success' },
      { action: 'updated', resourceType: 'package', details: 'Updated package {name}', severity: 'info' },
      { action: 'deleted', resourceType: 'package', details: 'Deleted package {name}', severity: 'warning' },
      // Customer actions
      { action: 'created', resourceType: 'customer', details: 'Created customer profile for {name}', severity: 'success' },
      { action: 'updated', resourceType: 'customer', details: 'Updated customer {name} profile', severity: 'info' },
      { action: 'viewed', resourceType: 'customer', details: 'Viewed customer {name} details', severity: 'info' },
      { action: 'checked_in', resourceType: 'customer', details: 'Checked in customer {name}', severity: 'success' },
      { action: 'checked_out', resourceType: 'customer', details: 'Checked out customer {name}', severity: 'info' },
      // Purchase actions
      { action: 'purchased', resourceType: 'purchase', details: 'Processed purchase for {name}', severity: 'success' },
      { action: 'viewed', resourceType: 'purchase', details: 'Viewed purchase details #{id}', severity: 'info' },
      { action: 'updated', resourceType: 'purchase', details: 'Updated purchase #{id}', severity: 'info' },
      // Attraction actions
      { action: 'created', resourceType: 'attraction', details: 'Created attraction {name}', severity: 'success' },
      { action: 'updated', resourceType: 'attraction', details: 'Updated attraction {name}', severity: 'info' },
      { action: 'viewed', resourceType: 'attraction', details: 'Viewed attraction {name} details', severity: 'info' },
      // Booking actions
      { action: 'created', resourceType: 'booking', details: 'Created booking for {name}', severity: 'success' },
      { action: 'updated', resourceType: 'booking', details: 'Updated booking #{id}', severity: 'info' },
      { action: 'viewed', resourceType: 'booking', details: 'Viewed booking details #{id}', severity: 'info' },
    ];

    const sampleLogs: ActivityLog[] = [];
    const now = new Date();
    
    // Generate logs for the last 7 days
    for (let i = 0; i < 150; i++) {
      const attendant = attendants[Math.floor(Math.random() * attendants.length)];
      const actionConfig = actions[Math.floor(Math.random() * actions.length)];
      const hoursAgo = Math.floor(Math.random() * 168); // 7 days in hours
      const timestamp = new Date(now.getTime() - hoursAgo * 60 * 60 * 1000);
      
      const resourceNames = {
        package: ['Weekend Special', 'Family Package', 'VR Experience Pack', 'Birthday Bundle'],
        customer: ['John Smith', 'Emma Wilson', 'Alex Johnson', 'Sarah Brown', 'Mike Davis'],
        attraction: ['Laser Tag Arena', 'Bowling Lanes', 'VR Experience', 'Escape Room'],
        purchase: ['Purchase'],
        booking: ['Booking']
      };

      const resourceType = actionConfig.resourceType as keyof typeof resourceNames;
      const resourceName = resourceNames[resourceType]
        ? resourceNames[resourceType][Math.floor(Math.random() * resourceNames[resourceType].length)]
        : undefined;

      sampleLogs.push({
        id: `log_${i + 1}`,
        attendantId: attendant.id,
        attendantName: attendant.name,
        action: actionConfig.action,
        resourceType: resourceType,
        resourceId: `res_${Math.random().toString(36).substr(2, 9)}`,
        resourceName,
        details: actionConfig.details.replace('{name}', resourceName || 'item').replace('{id}', (i + 1).toString()),
        timestamp: timestamp.toISOString(),
        severity: actionConfig.severity
      });
    }

    // Sort by timestamp descending
    return sampleLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  };


  const applyFilters = () => {
    let result = [...logs];

    // Apply search filter
    if (filters.search) {
      const searchTerm = filters.search.toLowerCase();
      result = result.filter(log =>
        log.attendantName.toLowerCase().includes(searchTerm) ||
        log.details.toLowerCase().includes(searchTerm) ||
        log.resourceType.toLowerCase().includes(searchTerm) ||
        (log.resourceName && log.resourceName.toLowerCase().includes(searchTerm))
      );
    }

    // Apply action filter
    if (filters.action !== 'all') {
      result = result.filter(log => log.action === filters.action);
    }

    // Apply resource type filter
    if (filters.resourceType !== 'all') {
      result = result.filter(log => log.resourceType === filters.resourceType);
    }

    // Apply attendant filter
    if (filters.attendant !== 'all') {
      result = result.filter(log => log.attendantId === filters.attendant);
    }

    // Apply date range filter
    if (filters.dateRange !== 'all') {
      const now = new Date();
      let startDate: Date;

      switch (filters.dateRange) {
        case 'today':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case 'yesterday':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
          break;
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
          break;
        default:
          startDate = new Date(0);
      }

      result = result.filter(log => new Date(log.timestamp) >= startDate);
    }

    setFilteredLogs(result);
    setCurrentPage(1);
  };

  const handleFilterChange = (key: keyof FilterOptions, value: any) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const clearFilters = () => {
    setFilters({
      action: 'all',
      resourceType: 'all',
      attendant: 'all',
      dateRange: 'all',
      search: ''
    });
  };

  const exportLogs = () => {
    const csvContent = [
      ['Timestamp', 'Attendant', 'Action', 'Resource Type', 'Resource Name', 'Details', 'Severity'],
      ...filteredLogs.map(log => [
        new Date(log.timestamp).toLocaleString(),
        log.attendantName,
        log.action,
        log.resourceType,
        log.resourceName || '',
        log.details,
        log.severity
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `activity-logs-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Get unique values for filters
  const getUniqueAttendants = () => {
    const attendants = logs.map(log => ({ id: log.attendantId, name: log.attendantName }));
    return [...new Map(attendants.map(item => [item.id, item])).values()];
  };

  const getUniqueActions = () => {
    return [...new Set(logs.map(log => log.action))];
  };

  const getUniqueResourceTypes = () => {
    return [...new Set(logs.map(log => log.resourceType))];
  };

  // Format timestamp
  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString();
  };

  // Pagination
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentLogs = filteredLogs.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage);

  const paginate = (pageNumber: number) => setCurrentPage(pageNumber);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-800"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 px-6 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Activity Logs</h1>
          <p className="text-gray-600 mt-2">Track all attendant activities and system events</p>
        </div>
        
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {metrics.map((metric, index) => {
          const Icon = metric.icon;
          return (
            <div
              key={index}
              className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex flex-col gap-2 hover:shadow-md transition-shadow min-h-[120px]"
            >
              <div className="flex items-center gap-2 mb-2">
                <div className={`p-2 rounded-lg ${metric.accent}`}>
                  <Icon size={20} />
                </div>
                <span className="text-base font-semibold text-gray-800">{metric.title}</span>
              </div>
              <div className="flex items-end gap-2 mt-2">
                <h3 className="text-2xl font-bold text-gray-900">{metric.value}</h3>
              </div>
              <p className="text-xs mt-1 text-gray-400">{metric.change}</p>
            </div>
          );
        })}
      </div>

      {/* Filters and Search */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-6">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="relative flex-1 max-w-lg">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search activities..."
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              className="pl-9 pr-3 py-2 border border-gray-200 rounded-lg w-full focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              <Filter className="h-4 w-4 mr-1" />
              Filters
            </button>
              <button
            onClick={exportLogs}
            className="inline-flex items-center px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </button>
          <button
            onClick={loadLogs}
            className="inline-flex items-center px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            <RefreshCcw className="h-4 w-4" />
          </button>
          </div>
        </div>

        {/* Advanced Filters */}
        {showFilters && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-800 mb-1">Action</label>
                <select
                  value={filters.action}
                  onChange={(e) => handleFilterChange('action', e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
                >
                  <option value="all">All Actions</option>
                  {getUniqueActions().map(action => (
                    <option key={action} value={action}>
                      {action.charAt(0).toUpperCase() + action.slice(1).replace('_', ' ')}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-800 mb-1">Resource Type</label>
                <select
                  value={filters.resourceType}
                  onChange={(e) => handleFilterChange('resourceType', e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
                >
                  <option value="all">All Types</option>
                  {getUniqueResourceTypes().map(type => (
                    <option key={type} value={type}>
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-800 mb-1">Attendant</label>
                <select
                  value={filters.attendant}
                  onChange={(e) => handleFilterChange('attendant', e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
                >
                  <option value="all">All Attendants</option>
                  {getUniqueAttendants().map(attendant => (
                    <option key={attendant.id} value={attendant.id}>
                      {attendant.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-800 mb-1">Date Range</label>
                <select
                  value={filters.dateRange}
                  onChange={(e) => handleFilterChange('dateRange', e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
                >
                  <option value="all">All Time</option>
                  <option value="today">Today</option>
                  <option value="yesterday">Yesterday</option>
                  <option value="week">Last 7 Days</option>
                  <option value="month">Last 30 Days</option>
                </select>
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <button
                onClick={clearFilters}
                className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800"
              >
                Clear Filters
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Activity Logs List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900">Recent Activities</h3>
          <p className="text-sm text-gray-600 mt-1">
            Showing {currentLogs.length} of {filteredLogs.length} activities
          </p>
        </div>

        <div className="divide-y divide-gray-100">
          {currentLogs.length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-800">
              No activity logs found matching your filters
            </div>
          ) : (
            currentLogs.map((log) => {
              const ActionIcon = actionIcons[log.action as keyof typeof actionIcons] || Clock;
              
              return (
                <div key={log.id} className="p-6 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start gap-4">
                    <div className={`p-2 rounded-lg ${severityColors[log.severity]}`}>
                      <ActionIcon size={16} />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="font-medium text-gray-900">{log.attendantName}</span>
                        <span className="text-gray-400">•</span>
                        <span className="text-sm text-gray-600">{log.details}</span>
                      </div>
                      
                      <div className="flex items-center gap-3 mt-2 flex-wrap">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${resourceTypeColors[log.resourceType]}`}>
                          {log.resourceType.charAt(0).toUpperCase() + log.resourceType.slice(1)}
                        </span>
                        <span className="text-xs text-gray-500 capitalize">
                          {log.action.replace('_', ' ')}
                        </span>
                        {log.resourceName && (
                          <>
                            <span className="text-gray-400">•</span>
                            <span className="text-xs text-gray-600">{log.resourceName}</span>
                          </>
                        )}
                        <span className="text-gray-400">•</span>
                        <span className="text-xs text-gray-500" title={new Date(log.timestamp).toLocaleString()}>
                          {formatTimestamp(log.timestamp)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="bg-white px-6 py-4 border-t border-gray-100">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-800">
                Showing <span className="font-medium">{indexOfFirstItem + 1}</span> to{' '}
                <span className="font-medium">
                  {Math.min(indexOfLastItem, filteredLogs.length)}
                </span>{' '}
                of <span className="font-medium">{filteredLogs.length}</span> activities
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => paginate(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50"
                >
                  Previous
                </button>
                
                {/* Pagination buttons limited to 3 */}
                {(() => {
                  let start = 1;
                  let end = totalPages;
                  if (totalPages > 3) {
                    if (currentPage <= 2) {
                      start = 1;
                      end = 3;
                    } else if (currentPage >= totalPages - 1) {
                      start = totalPages - 2;
                      end = totalPages;
                    } else {
                      start = currentPage - 1;
                      end = currentPage + 1;
                    }
                  }
                  return Array.from({ length: end - start + 1 }, (_, i) => start + i).map((page) => (
                    <button
                      key={page}
                      onClick={() => paginate(page)}
                      className={`px-3 py-2 border rounded-lg text-sm font-medium ${
                        currentPage === page
                          ? 'border-blue-800 bg-blue-800 text-white'
                          : 'border-gray-200 text-gray-800 hover:bg-gray-50'
                      }`}
                    >
                      {page}
                    </button>
                  ));
                })()}
                
                <button
                  onClick={() => paginate(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AttendantActivityLogs;