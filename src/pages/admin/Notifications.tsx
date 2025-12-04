import { useState, useEffect } from 'react';
import { 
  Bell,
  Ticket,
  Users,
  Calendar,
  DollarSign,
  Zap,
  Check,
  CheckCircle,
  Clock,
  Filter,
  Trash2,
  RefreshCcw
} from 'lucide-react';
import { useThemeColor } from '../../hooks/useThemeColor';
import type { NotificationsNotification } from '../../types/Notifications.types';
import { API_BASE_URL } from '../../utils/storage';

const Notifications = () => {
  const { themeColor, fullColor } = useThemeColor();
  const [notifications, setNotifications] = useState<NotificationsNotification[]>([]);
  const [filter, setFilter] = useState<'all' | 'unread' | 'bookings' | 'purchases'>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalNotifications, setTotalNotifications] = useState(0);

  // Helper function to get user auth data
  const getUserAuth = () => {
    const user = JSON.parse(localStorage.getItem('zapzone_user') || '{}');
    return {
      token: user.token,
      isCompanyAdmin: user.role === 'company_admin',
      locationId: user.location_id,
    };
  };

  // Notification type configurations
  const getNotificationConfig = (type: string) => {
    const configs: Record<string, any> = {
      booking: {
        icon: Calendar,
        color: `text-${themeColor}-600`,
        bgColor: `bg-${themeColor}-50`,
        borderColor: `border-${themeColor}-200`
      },
      purchase: {
        icon: Ticket,
        color: 'text-green-600',
        bgColor: 'bg-green-50',
        borderColor: 'border-green-200'
      },
      system: {
        icon: Zap,
        color: 'text-purple-600',
        bgColor: 'bg-purple-50',
        borderColor: 'border-purple-200'
      },
      attendant: {
        icon: Users,
        color: 'text-orange-600',
        bgColor: 'bg-orange-50',
        borderColor: 'border-orange-200'
      },
      customer: {
        icon: Users,
        color: 'text-indigo-600',
        bgColor: 'bg-indigo-50',
        borderColor: 'border-indigo-200'
      }
    };
    return configs[type] || {
      icon: Bell,
      color: 'text-gray-500',
      bgColor: 'bg-gray-100',
      borderColor: 'border-gray-200'
    };
  };

  // Priority colors
  const priorityColors = {
    low: 'text-gray-500',
    medium: 'text-yellow-500',
    high: 'text-red-500'
  };

  // Load notifications from localStorage
  useEffect(() => {
    loadNotifications();
  }, [filter, currentPage]);

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const { token, isCompanyAdmin, locationId } = getUserAuth();

      if (!token) {
        console.error('No auth token found');
        setLoading(false);
        return;
      }

      // Build query parameters
      const params = new URLSearchParams({
        per_page: '15',
        page: currentPage.toString(),
      });

      // Only add location_id if not company_admin
      if (!isCompanyAdmin && locationId) {
        params.append('location_id', locationId.toString());
      }

      // Add filter parameters
      if (filter === 'unread') {
        params.append('unread', 'true');
      } else if (filter === 'bookings') {
        params.append('type', 'booking');
      } else if (filter === 'purchases') {
        params.append('type', 'purchase');
      }

      const response = await fetch(`${API_BASE_URL}/notifications?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (data.success) {
        // Transform API response to match component format
        const transformedNotifications = data.data.notifications.map((notif: any) => ({
          id: notif.id.toString(),
          type: notif.type,
          title: notif.title,
          message: notif.message,
          timestamp: notif.created_at,
          read: notif.status === 'read',
          priority: notif.priority || 'medium',
          metadata: notif.metadata || {},
        }));

        setNotifications(transformedNotifications);
        setTotalPages(data.data.pagination.last_page);
        setTotalNotifications(data.data.pagination.total);
      }
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (id: string) => {
    try {
      const { token } = getUserAuth();

      const response = await fetch(`${API_BASE_URL}/notifications/${id}/mark-as-read`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (data.success) {
        // Update local state
        const updatedNotifications = notifications.map(notification =>
          notification.id === id ? { ...notification, read: true } : notification
        );
        setNotifications(updatedNotifications);
        window.dispatchEvent(new Event('zapzone_notifications_updated'));
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const { token, isCompanyAdmin, locationId } = getUserAuth();

      // Build query parameters
      const params = new URLSearchParams();
      
      // Only add location_id if not company_admin
      if (!isCompanyAdmin && locationId) {
        params.append('location_id', locationId.toString());
      }

      const url = `${API_BASE_URL}/notifications/mark-all-as-read${params.toString() ? `?${params.toString()}` : ''}`;

      const response = await fetch(url, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (data.success) {
        // Reload notifications to get updated data
        await loadNotifications();
        window.dispatchEvent(new Event('zapzone_notifications_updated'));
      }
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  const deleteNotification = async (id: string) => {
    try {
      const { token } = getUserAuth();

      const response = await fetch(`${API_BASE_URL}/notifications/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (data.success) {
        // Update local state
        const updatedNotifications = notifications.filter(notification => notification.id !== id);
        setNotifications(updatedNotifications);
        window.dispatchEvent(new Event('zapzone_notifications_updated'));
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  const clearAllNotifications = async () => {
    if (window.confirm('Are you sure you want to clear all notifications?')) {
      try {
        const { token } = getUserAuth();

        // Delete all notifications one by one (or implement a bulk delete endpoint)
        const deletePromises = notifications.map(notification =>
          fetch(`${API_BASE_URL}/notifications/${notification.id}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          })
        );

        await Promise.all(deletePromises);
        setNotifications([]);
        window.dispatchEvent(new Event('zapzone_notifications_updated'));
      } catch (error) {
        console.error('Error clearing all notifications:', error);
      }
    }
  };

  const getFilteredNotifications = () => {
    // Filtering is now handled by the API
    return notifications;
  };

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

  const unreadCount = notifications.filter(n => !n.read).length;
  const filteredNotifications = getFilteredNotifications();

  if (loading) {
    return (
      <div className="min-h-screen px-4 py-6 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-800 mb-4"></div>
          <p className="text-gray-600">Loading notifications...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 py-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <div className={`p-2 bg-${fullColor} rounded-lg`}>
              <Bell className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
              <p className="text-gray-600 text-sm">Stay updated with recent activities</p>
            </div>
          </div>
          
          {unreadCount > 0 && (
            <div className={`bg-${fullColor} text-white px-3 py-1 rounded-full text-sm font-medium`}>
              {unreadCount} new
            </div>
          )}
        </div>
      </div>

      {/* Actions Bar */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
            >
              <Filter className="h-4 w-4" />
              Filter
            </button>
            
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className={`flex items-center gap-2 px-3 py-2 text-sm text-${fullColor} hover:bg-${themeColor}-50 rounded-lg transition-colors`}
              >
                <CheckCircle className="h-4 w-4" />
                Mark all read
              </button>
            )}
          </div>

          {notifications.length > 0 && (
            <button
              onClick={clearAllNotifications}
              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              <Trash2 className="h-4 w-4" />
              Clear all
            </button>
          )}
        </div>

        {/* Filter Options */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setFilter('all')}
                className={`px-3 py-2 text-sm rounded-lg transition-colors ${
                  filter === 'all'
                    ? `bg-${fullColor} text-white`
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilter('unread')}
                className={`px-3 py-2 text-sm rounded-lg transition-colors ${
                  filter === 'unread'
                    ? `bg-${fullColor} text-white`
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                Unread
              </button>
              <button
                onClick={() => setFilter('bookings')}
                className={`px-3 py-2 text-sm rounded-lg transition-colors ${
                  filter === 'bookings'
                    ? `bg-${fullColor} text-white`
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                Bookings
              </button>
              <button
                onClick={() => setFilter('purchases')}
                className={`px-3 py-2 text-sm rounded-lg transition-colors ${
                  filter === 'purchases'
                    ? `bg-${fullColor} text-white`
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                Purchases
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Notifications List */}
      <div className="space-y-3">
        {filteredNotifications.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
            <Bell className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No notifications</h3>
            <p className="text-gray-600 text-sm">
              {filter === 'all' 
                ? "You're all caught up!" 
                : `No ${filter} notifications found`}
            </p>
          </div>
        ) : (
          filteredNotifications.map((notification) => {
            // Fallback config if notification type is not found
            const config = getNotificationConfig(notification.type);
            const Icon = config.icon;

            return (
              <div
                key={notification.id}
                className={` rounded-xl shadow-sm border transition-all duration-200 ${
                  notification.read 
                    ? 'border-gray-100 bg-gray-100' 
                    : 'border-gray-100 bg-white'
                }`}
              >
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    {/* Icon */}
                    <div className={`p-2 rounded-lg ${config.bgColor} flex-shrink-0`}>
                      <Icon className={`h-4 w-4 ${config.color}`} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className={`font-semibold text-sm ${
                              notification.read ? 'text-gray-800' : 'text-gray-900'
                            }`}>
                              {notification.title}
                            </h3>
                            {!notification.read && (
                              <div className={`w-2 h-2 bg-${fullColor} rounded-full`}></div>
                            )}
                          </div>
                          
                          <p className="text-gray-600 text-sm mb-2">
                            {notification.message}
                          </p>

                          {/* Metadata */}
                          {notification.metadata && (
                            <div className="flex items-center gap-4 text-xs text-gray-500 mb-2">
                              {notification.metadata.customerName && (
                                <span>Customer: {notification.metadata.customerName}</span>
                              )}
                              {notification.metadata.amount && (
                                <span className="flex items-center gap-1">
                                  <DollarSign className="h-3 w-3" />
                                  {notification.metadata.amount}
                                </span>
                              )}
                            </div>
                          )}

                          {/* Timestamp and Priority */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 text-xs text-gray-500">
                              <Clock className="h-3 w-3" />
                              <span>{formatTimestamp(notification.timestamp)}</span>
                              <span className={`${priorityColors[notification.priority]}`}>
                                {notification.priority}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {!notification.read && (
                            <button
                              onClick={() => markAsRead(notification.id)}
                              className={`p-1 text-gray-400 hover:text-${fullColor} transition-colors`}
                              title="Mark as read"
                            >
                              <Check className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            onClick={() => deleteNotification(notification.id)}
                            className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                            title="Delete notification"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
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
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mt-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              Showing page {currentPage} of {totalPages} ({totalNotifications} total)
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className={`px-3 py-2 text-sm rounded-lg transition-colors ${
                  currentPage === 1
                    ? 'text-gray-400 cursor-not-allowed'
                    : `text-${fullColor} hover:bg-${themeColor}-50`
                }`}
              >
                Previous
              </button>
              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className={`px-3 py-2 text-sm rounded-lg transition-colors ${
                  currentPage === totalPages
                    ? 'text-gray-400 cursor-not-allowed'
                    : `text-${fullColor} hover:bg-${themeColor}-50`
                }`}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Empty State for No Notifications */}
    </div>
  );
};

export default Notifications;