import { useState, useEffect, useCallback } from 'react';
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
  Plus,
  X
} from 'lucide-react';

import CounterAnimation from '../../../components/ui/CounterAnimation';
import type {
  AttendantActivityLogsLog,
  AttendantActivityLogsFilterOptions,
} from '../../../types/AttendantActivityLogs.types';
import { useThemeColor } from '../../../hooks/useThemeColor';
import { API_BASE_URL, getStoredUser } from '../../../utils/storage';
import { getAuthToken } from '../../../services';

const AttendantActivityLogs = () => {
  const { themeColor, fullColor } = useThemeColor();
  const currentUser = getStoredUser();
  const userLocationId = currentUser?.location_id;

  const [filteredLogs, setFilteredLogs] = useState<AttendantActivityLogsLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFilters, setExportFilters] = useState<AttendantActivityLogsFilterOptions>({
    action: 'all',
    resourceType: 'all',
    attendant: 'all',
    dateRange: 'all',
    search: ''
  });
  const [exportSelectedUsers, setExportSelectedUsers] = useState<string[]>([]);
  const [showAllUsers, setShowAllUsers] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [filters, setFilters] = useState<AttendantActivityLogsFilterOptions>({
    action: 'all',
    resourceType: 'all',
    attendant: 'all',
    dateRange: 'all',
    search: ''
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);
  const [showFilters, setShowFilters] = useState(false);
  const [totalLogs, setTotalLogs] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

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

  const getSeverityColors = (severity: string) => {
    const colors: Record<string, string> = {
      info: `bg-${themeColor}-100 text-${fullColor}`,
      success: 'bg-green-100 text-green-800',
      warning: 'bg-yellow-100 text-yellow-800',
      error: 'bg-red-100 text-red-800'
    };
    return colors[severity] || `bg-${themeColor}-100 text-${fullColor}`;
  };

  const getResourceTypeColors = (resourceType: string) => {
    const colors: Record<string, string> = {
      package: 'bg-purple-100 text-purple-800',
      customer: `bg-${themeColor}-100 text-${fullColor}`,
      purchase: 'bg-green-100 text-green-800',
      attraction: 'bg-orange-100 text-orange-800',
      booking: 'bg-indigo-100 text-indigo-800',
      attendant: 'bg-pink-100 text-pink-800',
      manager: 'bg-red-100 text-red-800',
      inventory: `bg-${themeColor}-100 text-${fullColor}`,
      settings: 'bg-gray-100 text-gray-800'
    };
    return colors[resourceType] || `bg-${themeColor}-100 text-${fullColor}`;
  };

  const getUserTypeColors = (userType: string) => {
    const colors: Record<string, string> = {
      company_admin: 'bg-purple-100 text-purple-800',
      location_manager: 'bg-blue-100 text-blue-800',
      attendant: `bg-${themeColor}-100 text-${fullColor}`,
      system: 'bg-gray-100 text-gray-800'
    };
    return colors[userType] || `bg-${themeColor}-100 text-${fullColor}`;
  };

  // Helper function to check if a date is today
  const isToday = (date: Date) => {
    const today = new Date();
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
  };

  // Calculate metrics for location
  const getLocationMetrics = () => {
    const locationLogs = filteredLogs;
    const todayLogs = locationLogs.filter(log => isToday(new Date(log.timestamp)));
    const attendantLogs = locationLogs.filter(log => log.userType === 'attendant');

    return [
      {
        title: 'Total Activities',
        value: totalLogs.toString(),
        change: 'All activities',
        accent: `bg-${themeColor}-100 text-${fullColor}`,
        icon: Clock,
      },
      {
        title: "Today's Activities",
        value: todayLogs.length.toString(),
        change: 'Last 24 hours',
        accent: `bg-${themeColor}-100 text-${fullColor}`,
        icon: Zap,
      },
      {
        title: 'Purchases Made',
        value: locationLogs.filter(log => log.action === 'purchased').length.toString(),
        change: 'Total sales',
        accent: `bg-${themeColor}-100 text-${fullColor}`,
        icon: ShoppingCart,
      },
      {
        title: 'Active Attendants',
        value: [...new Set(todayLogs.filter(log => 
          log.action === 'logged_in'
        ).map(log => log.userId))].length.toString(),
        change: 'Logged in today',
        accent: `bg-${themeColor}-100 text-${fullColor}`,
        icon: Users,
      }
    ];
  };

  const metrics = getLocationMetrics();

  const loadLogs = useCallback(async () => {
    if (filteredLogs.length === 0) {
      setLoading(true);
    } else {
      setIsRefreshing(true);
    }
    try {
      const token = getAuthToken();
      const params = new URLSearchParams();
      
      // Pagination
      params.append('per_page', itemsPerPage.toString());
      params.append('page', currentPage.toString());
      
      // Location filter - always filter by user's location
      if (userLocationId) {
        params.append('location_id', userLocationId.toString());
      }
      
      // Search filter
      if (filters.search) {
        params.append('search', filters.search);
      }
      
      // Action filter
      if (filters.action !== 'all') {
        params.append('action', filters.action);
      }
      
      // Resource type filter
      if (filters.resourceType !== 'all') {
        params.append('category', filters.resourceType);
      }
      
      // Attendant filter - single user selection
      if (filters.attendant !== 'all') {
        params.append('user_id[]', filters.attendant);
      }
      
      // Date range filter
      if (filters.dateRange !== 'all') {
        const now = new Date();
        let startDate: Date;

        switch (filters.dateRange) {
          case 'today':
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            params.append('start_date', startDate.toISOString().split('T')[0]);
            break;
          case 'yesterday': {
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
            const endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
            params.append('start_date', startDate.toISOString().split('T')[0]);
            params.append('end_date', endDate.toISOString().split('T')[0]);
            break;
          }
          case 'week':
            params.append('recent_days', '7');
            break;
          case 'month':
            params.append('recent_days', '30');
            break;
        }
      }
      
      // Sort
      params.append('sort_by', 'created_at');
      params.append('sort_order', 'desc');

      const response = await fetch(`${API_BASE_URL}/activity-logs?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        const activityLogs = data.data?.activity_logs || [];
        const pagination = data.data?.pagination || {};
        
        // Transform API data to match component structure
        const transformedLogs = activityLogs.map((log: any) => ({
          id: log.id?.toString() || '',
          userId: log.user_id?.toString() || 'system',
          attendantId: log.user_id?.toString() || 'system',
          attendantName: log.user?.first_name && log.user?.last_name 
            ? `${log.user.first_name} ${log.user.last_name}` 
            : log.user?.email || 'System',
          userType: log.user?.role || 'system',
          action: log.action || 'unknown',
          resourceType: log.category || log.entity_type || 'general',
          resourceId: log.entity_id?.toString() || '',
          resourceName: log.metadata?.resource_name || log.entity_type || '',
          details: log.description || '',
          timestamp: log.created_at || new Date().toISOString(),
          severity: determineSeverity(log.action || '')
        }));
        
        setFilteredLogs(transformedLogs);
        setTotalLogs(pagination.total || 0);
        setTotalPages(pagination.last_page || 1);
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('Backend error:', response.status, errorData);
        setFilteredLogs([]);
        setTotalLogs(0);
        setTotalPages(0);
      }
    } catch (error) {
      console.error('Error loading activity logs:', error);
      setFilteredLogs([]);
      setTotalLogs(0);
      setTotalPages(0);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [itemsPerPage, currentPage, userLocationId, filters]);

  // Load initial data
  useEffect(() => {
    if (userLocationId) {
      loadLogs();
    }
  }, [filters, currentPage, loadLogs, userLocationId]);

  const determineSeverity = (action: string): 'info' | 'success' | 'warning' | 'error' => {
    if (action.includes('delete') || action.includes('reject')) return 'error';
    if (action.includes('create') || action.includes('approve') || action.includes('purchase')) return 'success';
    if (action.includes('update') || action.includes('edit')) return 'warning';
    return 'info';
  };

  const handleFilterChange = (key: keyof AttendantActivityLogsFilterOptions, value: string) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setFilters({
      action: 'all',
      resourceType: 'all',
      attendant: 'all',
      dateRange: 'all',
      search: ''
    });
    setCurrentPage(1);
  };

  const handleExportWithFilters = async () => {
    setIsExporting(true);
    try {
      const token = getAuthToken();
      const params = new URLSearchParams();
      
      params.append('per_page', '100');
      
      // Location filter
      if (userLocationId) {
        params.append('location_id', userLocationId.toString());
      }
      
      // Search filter
      if (exportFilters.search) {
        params.append('search', exportFilters.search);
      }
      
      // Action filter
      if (exportFilters.action !== 'all') {
        params.append('action', exportFilters.action);
      }
      
      // Resource type filter
      if (exportFilters.resourceType !== 'all') {
        params.append('entity_type', exportFilters.resourceType);
      }
      
      // User filter
      if (exportSelectedUsers.length > 0) {
        exportSelectedUsers.forEach(userId => {
          params.append('user_id[]', userId);
        });
      }
      
      // Date range filter
      if (exportFilters.dateRange !== 'all') {
        const now = new Date();
        let startDate: Date;

        switch (exportFilters.dateRange) {
          case 'today':
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            params.append('start_date', startDate.toISOString().split('T')[0]);
            break;
          case 'yesterday': {
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
            const endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
            params.append('start_date', startDate.toISOString().split('T')[0]);
            params.append('end_date', endDate.toISOString().split('T')[0]);
            break;
          }
          case 'week':
            params.append('recent_days', '7');
            break;
          case 'month':
            params.append('recent_days', '30');
            break;
        }
      }
      
      params.append('sort_by', 'created_at');
      params.append('sort_order', 'desc');

      // Fetch all pages
      let allLogs: any[] = [];
      let currentPage = 1;
      let hasMorePages = true;

      while (hasMorePages) {
        params.set('page', currentPage.toString());
        
        const response = await fetch(`${API_BASE_URL}/activity-logs?${params.toString()}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const data = await response.json();
          const activityLogs = data.data?.activity_logs || [];
          const pagination = data.data?.pagination || {};
          
          allLogs = [...allLogs, ...activityLogs];
          
          hasMorePages = currentPage < pagination.last_page;
          currentPage++;
        } else {
          hasMorePages = false;
        }
      }

      // Transform logs
      const transformedLogs = allLogs.map((log: any) => ({
        timestamp: log.created_at || new Date().toISOString(),
        attendantName: log.user?.first_name && log.user?.last_name 
          ? `${log.user.first_name} ${log.user.last_name}` 
          : log.user?.email || 'System',
        userType: log.user?.role || 'system',
        userId: log.user_id?.toString() || 'system',
        action: log.action || 'unknown',
        resourceType: log.category || log.entity_type || 'general',
        resourceName: log.metadata?.resource_name || log.entity_type || '',
        details: log.description || '',
        severity: determineSeverity(log.action || '')
      }));

      // Generate CSV
      const csvContent = [
        ['Timestamp', 'Attendant', 'User Type', 'Action', 'Resource Type', 'Resource Name', 'Details', 'Severity'],
        ...transformedLogs.map(log => [
          new Date(log.timestamp).toLocaleString(),
          log.attendantName,
          log.userType,
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
      a.download = `attendant-activity-logs-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
      
      setShowExportModal(false);
    } catch (error) {
      console.error('Error exporting logs:', error);
      alert('Failed to export logs. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportFilterChange = (key: keyof AttendantActivityLogsFilterOptions, value: string) => {
    setExportFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleUserToggle = (userId: string) => {
    setExportSelectedUsers(prev => {
      if (prev.includes(userId)) {
        return prev.filter(id => id !== userId);
      } else {
        return [...prev, userId];
      }
    });
  };

  const handleSelectAllUsers = (users: { id: string; name: string; type: string }[]) => {
    if (exportSelectedUsers.length === users.length) {
      setExportSelectedUsers([]);
    } else {
      setExportSelectedUsers(users.map(u => u.id));
    }
  };

  // Get unique values for filters
  const getUniqueUsers = () => {
    const users = filteredLogs
      .map(log => ({ id: log.userId, name: log.attendantName, type: log.userType }));
    return [...new Map(users.map(item => [item.id, item])).values()];
  };

  const getUniqueAttendants = () => {
    const attendants = filteredLogs.map(log => ({ id: log.attendantId, name: log.attendantName }));
    return [...new Map(attendants.map(item => [item.id, item])).values()];
  };

  const getUniqueActions = () => {
    return [...new Set(filteredLogs.map(log => log.action))];
  };

  const getUniqueResourceTypes = () => {
    return [...new Set(filteredLogs.map(log => log.resourceType))];
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
  const currentLogs = filteredLogs;

  const paginate = (pageNumber: number) => setCurrentPage(pageNumber);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className={`animate-spin rounded-full h-12 w-12 border-b-2 border-${fullColor}`}></div>
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
        
        <div className="flex gap-2 mt-4 sm:mt-0">
          <button
            onClick={() => setShowExportModal(true)}
            className={`inline-flex items-center px-4 py-2 border bg-${fullColor} text-white border-gray-200 rounded-lg hover:bg-${themeColor}-600`}
          >
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </button>
          <button
            onClick={loadLogs}
            className="inline-flex items-center px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50"
            disabled={isRefreshing}
          >
            <RefreshCcw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto animate-slideUp">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Export Activity Logs</h2>
              <button
                onClick={() => setShowExportModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            <div className="p-6">
              <p className="text-sm text-gray-600 mb-6">
                Configure filters to export specific activity logs. All matching records will be included in the CSV file.
              </p>

              {/* Users Checklist */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-800 mb-2">Users</label>
                <div className="border border-gray-200 rounded-lg p-3">
                  {(() => {
                    const allUsers = getUniqueUsers();
                    const filteredUsers = userSearchQuery
                      ? allUsers.filter(user => 
                          user.name.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
                          user.type.toLowerCase().includes(userSearchQuery.toLowerCase())
                        )
                      : allUsers;
                    
                    const displayedUsers = showAllUsers
                      ? filteredUsers
                      : [
                          ...filteredUsers.filter(u => exportSelectedUsers.includes(u.id)),
                          ...filteredUsers.filter(u => !exportSelectedUsers.includes(u.id)).slice(0, Math.max(0, 5 - exportSelectedUsers.filter(id => filteredUsers.some(u => u.id === id)).length))
                        ].filter((user, index, self) => 
                          index === self.findIndex(u => u.id === user.id)
                        ).slice(0, showAllUsers ? undefined : Math.max(5, exportSelectedUsers.length));
                    
                    const selectedCount = exportSelectedUsers.length;
                    const hasMore = filteredUsers.length > displayedUsers.length;

                    return (
                      <>
                        <div className="mb-3">
                          <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                              <Search className="h-4 w-4 text-gray-400" />
                            </div>
                            <input
                              type="text"
                              placeholder="Search users..."
                              value={userSearchQuery}
                              onChange={(e) => setUserSearchQuery(e.target.value)}
                              className={`pl-9 pr-3 py-2 border border-gray-200 rounded-lg w-full text-sm focus:ring-2 focus:ring-${themeColor}-400 focus:border-${themeColor}-400`}
                            />
                          </div>
                        </div>

                        <div className="flex items-center mb-2 pb-2 border-b border-gray-200">
                          <label className="flex items-center cursor-pointer hover:bg-gray-50 p-1 rounded flex-1">
                            <input
                              type="checkbox"
                              checked={filteredUsers.length > 0 && exportSelectedUsers.length === filteredUsers.length}
                              onChange={() => handleSelectAllUsers(filteredUsers)}
                              className={`mr-2 h-4 w-4 rounded border-gray-300 text-${fullColor} focus:ring-${themeColor}-400`}
                            />
                            <span className="text-sm font-medium text-gray-700">
                              Select All ({filteredUsers.length})
                            </span>
                          </label>
                          {selectedCount > 0 && (
                            <span className={`text-xs px-2 py-1 rounded-full bg-${themeColor}-100 text-${fullColor} font-medium`}>
                              {selectedCount} selected
                            </span>
                          )}
                        </div>

                        <div className={`space-y-1 ${showAllUsers ? 'max-h-60 overflow-y-auto' : ''}`}>
                          {displayedUsers.length > 0 ? (
                            displayedUsers.map(user => (
                              <label
                                key={user.id}
                                className="flex items-center cursor-pointer hover:bg-gray-50 p-2 rounded transition-colors"
                              >
                                <input
                                  type="checkbox"
                                  checked={exportSelectedUsers.includes(user.id)}
                                  onChange={() => handleUserToggle(user.id)}
                                  className={`mr-2 h-4 w-4 rounded border-gray-300 text-${fullColor} focus:ring-${themeColor}-400`}
                                />
                                <span className="text-sm text-gray-700 flex-1">{user.name}</span>
                                <span className={`text-xs px-2 py-0.5 rounded-full ${getUserTypeColors(user.type)}`}>
                                  {user.type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                                </span>
                              </label>
                            ))
                          ) : (
                            <p className="text-sm text-gray-500 text-center py-2">
                              {userSearchQuery ? 'No users found matching your search' : 'No users available'}
                            </p>
                          )}
                        </div>

                        {hasMore && (
                          <button
                            onClick={() => setShowAllUsers(!showAllUsers)}
                            className={`mt-2 w-full text-sm text-${fullColor} hover:underline py-1`}
                          >
                            {showAllUsers ? 'Show Less' : `Show ${filteredUsers.length - displayedUsers.length} More`}
                          </button>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* Search Filter */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-800 mb-2">Search</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-4 w-4 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    placeholder="Search activities, users, or details..."
                    value={exportFilters.search}
                    onChange={(e) => handleExportFilterChange('search', e.target.value)}
                    className={`pl-9 pr-3 py-2 border border-gray-200 rounded-lg w-full focus:ring-2 focus:ring-${themeColor}-400 focus:border-${themeColor}-400`}
                  />
                </div>
              </div>

              {/* Filter Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-800 mb-2">Action</label>
                  <select
                    value={exportFilters.action}
                    onChange={(e) => handleExportFilterChange('action', e.target.value)}
                    className={`w-full border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-${themeColor}-400 focus:border-${themeColor}-400`}
                  >
                    <option value="all">All Actions</option>
                    <option value="created">Created</option>
                    <option value="updated">Updated</option>
                    <option value="deleted">Deleted</option>
                    <option value="viewed">Viewed</option>
                    <option value="checked_in">Checked In</option>
                    <option value="checked_out">Checked Out</option>
                    <option value="purchased">Purchased</option>
                    <option value="logged_in">Logged In</option>
                    <option value="logged_out">Logged Out</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-800 mb-2">Resource Type</label>
                  <select
                    value={exportFilters.resourceType}
                    onChange={(e) => handleExportFilterChange('resourceType', e.target.value)}
                    className={`w-full border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-${themeColor}-400 focus:border-${themeColor}-400`}
                  >
                    <option value="all">All Types</option>
                    <option value="package">Package</option>
                    <option value="customer">Customer</option>
                    <option value="purchase">Purchase</option>
                    <option value="attraction">Attraction</option>
                    <option value="booking">Booking</option>
                    <option value="attendant">Attendant</option>
                    <option value="manager">Manager</option>
                    <option value="inventory">Inventory</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-800 mb-2">Date Range</label>
                  <select
                    value={exportFilters.dateRange}
                    onChange={(e) => handleExportFilterChange('dateRange', e.target.value)}
                    className={`w-full border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-${themeColor}-400 focus:border-${themeColor}-400`}
                  >
                    <option value="all">All Time</option>
                    <option value="today">Today</option>
                    <option value="yesterday">Yesterday</option>
                    <option value="week">Last 7 Days</option>
                    <option value="month">Last 30 Days</option>
                  </select>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 justify-end pt-4 border-t border-gray-200">
                <button
                  onClick={() => setShowExportModal(false)}
                  className="px-4 py-2 border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50"
                  disabled={isExporting}
                >
                  Cancel
                </button>
                <button
                  onClick={handleExportWithFilters}
                  disabled={isExporting}
                  className={`px-4 py-2 bg-${fullColor} text-white rounded-lg hover:opacity-90 disabled:opacity-50 flex items-center gap-2`}
                >
                  {isExporting ? (
                    <>
                      <RefreshCcw className="h-4 w-4 animate-spin" />
                      Exporting...
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4" />
                      Export CSV
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
                <CounterAnimation value={metric.value} className="text-2xl font-bold text-gray-900" />
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
              className={`pl-9 pr-3 py-2 border border-gray-200 rounded-lg w-full focus:ring-2 focus:ring-${themeColor}-400 focus:border-${themeColor}-400`}
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
                  className={`w-full border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-${themeColor}-400 focus:border-${themeColor}-400`}
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
                  className={`w-full border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-${themeColor}-400 focus:border-${themeColor}-400`}
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
                  className={`w-full border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-${themeColor}-400 focus:border-${themeColor}-400`}
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
                  className={`w-full border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-${themeColor}-400 focus:border-${themeColor}-400`}
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
            Showing {currentLogs.length} of {totalLogs} activities
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
                    <div className={getSeverityColors(log.severity) + ' p-2 rounded-lg'}>
                      <ActionIcon size={16} />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 flex-wrap mb-2">
                        <span className="font-medium text-gray-900">{log.attendantName}</span>
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getUserTypeColors(log.userType)}`}>
                          {log.userType.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                        </span>
                        <span className="text-gray-400">•</span>
                        <span className="text-sm text-gray-600">{log.details}</span>
                      </div>
                      
                      <div className="flex items-center gap-3 mt-2 flex-wrap">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getResourceTypeColors(log.resourceType)}`}>
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
                  {Math.min(indexOfLastItem, totalLogs)}
                </span>{' '}
                of <span className="font-medium">{totalLogs}</span> activities
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
                          ? `border-${fullColor} bg-${fullColor} text-white`
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