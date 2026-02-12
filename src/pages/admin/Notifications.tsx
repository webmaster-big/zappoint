import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
  CreditCard,
  ExternalLink
} from 'lucide-react';
import StandardButton from '../../components/ui/StandardButton';
import { useThemeColor } from '../../hooks/useThemeColor';
import type { NotificationsNotification } from '../../types/Notifications.types';
import { API_BASE_URL } from '../../utils/storage';

const Notifications = () => {
  const { themeColor, fullColor } = useThemeColor();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<NotificationsNotification[]>([]);
  const [filter, setFilter] = useState<'all' | 'unread' | 'bookings' | 'purchases'>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(15);
  const [markingAllRead, setMarkingAllRead] = useState(false);
  const [clearingAll, setClearingAll] = useState(false);
  const [markingReadId, setMarkingReadId] = useState<string | null>(null);

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
      payment: {
        icon: CreditCard,
        color: 'text-emerald-600',
        bgColor: 'bg-emerald-50',
        borderColor: 'border-emerald-200'
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

  // Load notifications
  useEffect(() => {
    loadNotifications();
  }, []);

  // Reset to page 1 when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [filter]);

  const loadNotifications = async () => {
    // Only show loading spinner on initial load
    if (notifications.length === 0) {
      setInitialLoading(true);
    }
    try {
      const { token, isCompanyAdmin, locationId } = getUserAuth();

      if (!token) {
        console.error('No auth token found');
        setInitialLoading(false);
        return;
      }

      // Build query parameters - fetch all for client-side pagination
      const params = new URLSearchParams({
        per_page: '500',
        page: '1',
      });

      // Only add location_id if not company_admin
      if (!isCompanyAdmin && locationId) {
        params.append('location_id', locationId.toString());
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
          action_url: notif.action_url || null,
          action_text: notif.action_text || null,
          metadata: notif.metadata || {},
        }));

        setNotifications(transformedNotifications);
      }
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setInitialLoading(false);
    }
  };

  const markAsRead = async (id: string) => {
    try {
      setMarkingReadId(id);
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
    } finally {
      setMarkingReadId(null);
    }
  };

  const markAllAsRead = async () => {
    try {
      setMarkingAllRead(true);
      const { token, locationId } = getUserAuth();

      const response = await fetch(`${API_BASE_URL}/notifications/mark-all-as-read`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          location_id: locationId,
        }),
      });

      const data = await response.json();

      if (data.success) {
        // Reload notifications to get updated data
        await loadNotifications();
        window.dispatchEvent(new Event('zapzone_notifications_updated'));
      }
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    } finally {
      setMarkingAllRead(false);
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
    if (window.confirm('Are you sure you want to clear all notifications? This cannot be undone.')) {
      try {
        setClearingAll(true);
        const { token, locationId } = getUserAuth();

        const response = await fetch(`${API_BASE_URL}/notifications/clear-all`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify({
            location_id: locationId,
          }),
        });

        const data = await response.json();

        if (data.success) {
          setNotifications([]);
          setCurrentPage(1);
          window.dispatchEvent(new Event('zapzone_notifications_updated'));
        }
      } catch (error) {
        console.error('Error clearing all notifications:', error);
      } finally {
        setClearingAll(false);
      }
    }
  };

  const getFilteredNotifications = () => {
    // Client-side filtering
    if (filter === 'unread') return notifications.filter(n => !n.read);
    if (filter === 'bookings') return notifications.filter(n => n.type === 'booking');
    if (filter === 'purchases') return notifications.filter(n => n.type === 'purchase');
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

  // Client-side pagination
  const totalPages = Math.ceil(filteredNotifications.length / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentNotifications = filteredNotifications.slice(indexOfFirstItem, indexOfLastItem);
  const paginate = (page: number) => setCurrentPage(page);

  if (initialLoading) {
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
            <StandardButton
              variant="secondary"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              icon={Filter}
            >
              Filter
            </StandardButton>
            
            {unreadCount > 0 && (
              <StandardButton
                variant="primary"
                size="sm"
                onClick={markAllAsRead}
                icon={markingAllRead ? undefined : CheckCircle}
                disabled={markingAllRead}
              >
                {markingAllRead ? (
                  <span className="flex items-center gap-2">
                    <span className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent"></span>
                    Marking...
                  </span>
                ) : 'Mark all read'}
              </StandardButton>
            )}
          </div>

          {notifications.length > 0 && (
            <StandardButton
              variant="ghost"
              size="sm"
              onClick={clearAllNotifications}
              icon={clearingAll ? undefined : Trash2}
              disabled={clearingAll}
            >
              {clearingAll ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-gray-400 border-t-transparent"></span>
                  Clearing...
                </span>
              ) : 'Clear all'}
            </StandardButton>
          )}
        </div>

        {/* Filter Options */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="flex gap-2 flex-wrap">
              <StandardButton
                variant={filter === 'all' ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => setFilter('all')}
              >
                All
              </StandardButton>
              <StandardButton
                variant={filter === 'unread' ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => setFilter('unread')}
              >
                Unread
              </StandardButton>
              <StandardButton
                variant={filter === 'bookings' ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => setFilter('bookings')}
              >
                Bookings
              </StandardButton>
              <StandardButton
                variant={filter === 'purchases' ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => setFilter('purchases')}
              >
                Purchases
              </StandardButton>
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
          currentNotifications.map((notification) => {
            // Fallback config if notification type is not found
            const config = getNotificationConfig(notification.type);
            const Icon = config.icon;
            
            // Handle notification click - navigate and mark as read
            const handleNotificationClick = () => {
              if (notification.action_url) {
                // Mark as read if not already
                if (!notification.read) {
                  markAsRead(notification.id);
                }
                // Navigate to the action URL with from=notifications so back button returns here
                const separator = notification.action_url.includes('?') ? '&' : '?';
                navigate(`${notification.action_url}${separator}from=notifications`);
              }
            };
            
            // Format display: Put customer name first for quick scanning
            const customerName = notification.metadata?.customerName;
            const displayTitle = customerName 
              ? `${customerName}` 
              : notification.title;
            const displaySubtitle = customerName 
              ? notification.title 
              : null;

            return (
              <div
                key={notification.id}
                onClick={notification.action_url ? handleNotificationClick : undefined}
                className={`rounded-xl shadow-sm border transition-all duration-200 ${
                  notification.action_url ? 'cursor-pointer hover:shadow-md' : ''
                } ${
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
                              {displayTitle}
                            </h3>
                            {!notification.read && (
                              <div className={`w-2 h-2 bg-${fullColor} rounded-full`}></div>
                            )}
                            {notification.action_url && (
                              <ExternalLink className="h-3 w-3 text-gray-400" />
                            )}
                          </div>
                          
                          {displaySubtitle && (
                            <p className="text-gray-500 text-xs mb-1">
                              {displaySubtitle}
                            </p>
                          )}
                          
                          <p className="text-gray-600 text-sm mb-2">
                            {notification.message}
                          </p>

                          {/* Metadata */}
                          {notification.metadata && (
                            <div className="flex items-center gap-4 text-xs text-gray-500 mb-2">
                              {notification.metadata.packageName && (
                                <span>Package: {notification.metadata.packageName}</span>
                              )}
                              {notification.metadata.attractionName && (
                                <span>Attraction: {notification.metadata.attractionName}</span>
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
                            markingReadId === notification.id ? (
                              <div className="p-2">
                                <span className="animate-spin inline-block rounded-full h-3.5 w-3.5 border-2 border-gray-400 border-t-transparent"></span>
                              </div>
                            ) : (
                              <StandardButton
                                variant="ghost"
                                size="sm"
                                onClick={() => markAsRead(notification.id)}
                                icon={Check}
                                title="Mark as read"
                                disabled={markingReadId !== null}
                              />
                            )
                          )}
                          <StandardButton
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteNotification(notification.id)}
                            icon={Trash2}
                            title="Delete notification"
                          />
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
            <div className="text-sm text-gray-800">
              Showing <span className="font-medium">{indexOfFirstItem + 1}</span> to{' '}
              <span className="font-medium">
                {Math.min(indexOfLastItem, filteredNotifications.length)}
              </span>{' '}
              of <span className="font-medium">{filteredNotifications.length}</span> results
            </div>
            <div className="flex gap-1">
              <StandardButton
                variant="secondary"
                size="sm"
                onClick={() => paginate(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
              >
                Previous
              </StandardButton>
              
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                const showPage = page === 1 || 
                                page === totalPages || 
                                (page >= currentPage - 1 && page <= currentPage + 1);
                
                const showEllipsisBefore = page === currentPage - 2 && currentPage > 3;
                const showEllipsisAfter = page === currentPage + 2 && currentPage < totalPages - 2;
                
                if (!showPage && !showEllipsisBefore && !showEllipsisAfter) return null;
                
                if (showEllipsisBefore || showEllipsisAfter) {
                  return <span key={page} className="px-3 py-2 text-gray-400">...</span>;
                }
                
                return (
                  <StandardButton
                    key={page}
                    variant={currentPage === page ? 'primary' : 'secondary'}
                    size="sm"
                    onClick={() => paginate(page)}
                  >
                    {page}
                  </StandardButton>
                );
              })}
              
              <StandardButton
                variant="secondary"
                size="sm"
                onClick={() => paginate(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
              >
                Next
              </StandardButton>
            </div>
          </div>
        </div>
      )}

      {/* Empty State for No Notifications */}
    </div>
  );
};

export default Notifications;