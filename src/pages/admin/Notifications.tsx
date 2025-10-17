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
import type { NotificationsNotification } from '../../types/Notifications.types';

const Notifications = () => {
  const [notifications, setNotifications] = useState<NotificationsNotification[]>([]);
  const [filter, setFilter] = useState<'all' | 'unread' | 'bookings' | 'purchases'>('all');
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);

  // Notification type configurations
  const     notificationConfig = {
    booking: {
      icon: Calendar,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200'
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

  // Priority colors
  const priorityColors = {
    low: 'text-gray-500',
    medium: 'text-yellow-500',
    high: 'text-red-500'
  };

  // Load notifications from localStorage
  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = () => {
    try {
      const storedNotifications = localStorage.getItem('zapzone_notifications');
      if (storedNotifications) {
        setNotifications(JSON.parse(storedNotifications));
      } else {
        // Generate sample notifications
        const sampleNotifications = generateSampleNotifications();
        setNotifications(sampleNotifications);
        localStorage.setItem('zapzone_notifications', JSON.stringify(sampleNotifications));
      }
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateSampleNotifications = (): NotificationsNotification[] => {
    const sampleData: NotificationsNotification[] = [
      // Booking notifications
      {
        id: 'notif_1',
        type: 'booking',
        title: 'New Package Booking',
        message: 'Weekend Family Package booked by Sarah Johnson',
        timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // 5 minutes ago
        read: false,
        priority: 'high',
        metadata: {
          bookingId: 'BK-001',
          customerName: 'Sarah Johnson',
          packageName: 'Weekend Family Package',
          amount: 199
        }
      },
      {
        id: 'notif_2',
        type: 'booking',
        title: 'Package Booking',
        message: 'VR Experience Pack booked by Mike Chen',
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
        read: true,
        priority: 'medium',
        metadata: {
          bookingId: 'BK-002',
          customerName: 'Mike Chen',
          packageName: 'VR Experience Pack',
          amount: 89
        }
      },
      // Purchase notifications
      {
        id: 'notif_3',
        type: 'purchase',
        title: 'New Ticket Purchase',
        message: 'Laser Tag tickets purchased by Emma Wilson',
        timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(), // 15 minutes ago
        read: false,
        priority: 'high',
        metadata: {
          purchaseId: 'TKT-001',
          customerName: 'Emma Wilson',
          attractionName: 'Laser Tag Arena',
          amount: 75
        }
      },
      {
        id: 'notif_4',
        type: 'purchase',
        title: 'Ticket Purchase',
        message: 'Bowling tickets purchased by Alex Rodriguez',
        timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(), // 1 hour ago
        read: false,
        priority: 'medium',
        metadata: {
          purchaseId: 'TKT-002',
          customerName: 'Alex Rodriguez',
          attractionName: 'Bowling Lanes',
          amount: 60
        }
      },
      // System notifications
      {
        id: 'notif_5',
        type: 'system',
        title: 'System Update',
        message: 'Scheduled maintenance tonight at 2:00 AM',
        timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(), // 3 hours ago
        read: true,
        priority: 'medium'
      },
      {
        id: 'notif_6',
        type: 'system',
        title: 'New Feature',
        message: 'Mobile booking now available for customers',
        timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(), // 6 hours ago
        read: true,
        priority: 'low'
      },
      // Attendant notifications
      {
        id: 'notif_7',
        type: 'attendant',
        title: 'Staff Update',
        message: 'New attendant profile created: Lisa Wang',
        timestamp: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(), // 8 hours ago
        read: true,
        priority: 'low'
      },
      // Customer notifications
      {
        id: 'notif_8',
        type: 'customer',
        title: 'Customer Check-in',
        message: 'John Smith checked in with party of 4',
        timestamp: new Date(Date.now() - 25 * 60 * 1000).toISOString(), // 25 minutes ago
        read: false,
        priority: 'medium'
      },
      {
        id: 'notif_9',
        type: 'purchase',
        title: 'New Ticket Purchase',
        message: 'Escape Room tickets purchased by David Kim',
        timestamp: new Date(Date.now() - 45 * 60 * 1000).toISOString(), // 45 minutes ago
        read: false,
        priority: 'high',
        metadata: {
          purchaseId: 'TKT-003',
          customerName: 'David Kim',
          attractionName: 'Escape Room',
          amount: 120
        }
      },
      {
        id: 'notif_10',
        type: 'booking',
        title: 'New Package Booking',
        message: 'Birthday Bundle booked by Maria Garcia',
        timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(), // 12 hours ago
        read: true,
        priority: 'high',
        metadata: {
          bookingId: 'BK-003',
          customerName: 'Maria Garcia',
          packageName: 'Birthday Bundle',
          amount: 299
        }
      }
    ];

    return sampleData.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  };

  const markAsRead = (id: string) => {
    const updatedNotifications = notifications.map(notification =>
      notification.id === id ? { ...notification, read: true } : notification
    );
    setNotifications(updatedNotifications);
    localStorage.setItem('zapzone_notifications', JSON.stringify(updatedNotifications));
    window.dispatchEvent(new Event('zapzone_notifications_updated'));
  };

  const markAllAsRead = () => {
    const updatedNotifications = notifications.map(notification => ({
      ...notification,
      read: true
    }));
    setNotifications(updatedNotifications);
    localStorage.setItem('zapzone_notifications', JSON.stringify(updatedNotifications));
    window.dispatchEvent(new Event('zapzone_notifications_updated'));
  };

  const deleteNotification = (id: string) => {
    const updatedNotifications = notifications.filter(notification => notification.id !== id);
    setNotifications(updatedNotifications);
    localStorage.setItem('zapzone_notifications', JSON.stringify(updatedNotifications));
    window.dispatchEvent(new Event('zapzone_notifications_updated'));
  };

  const clearAllNotifications = () => {
    if (window.confirm('Are you sure you want to clear all notifications?')) {
      setNotifications([]);
      localStorage.setItem('zapzone_notifications', JSON.stringify([]));
      window.dispatchEvent(new Event('zapzone_notifications_updated'));
    }
  };

  const getFilteredNotifications = () => {
    let filtered = notifications;

    switch (filter) {
      case 'unread':
        filtered = filtered.filter(notification => !notification.read);
        break;
      case 'bookings':
        filtered = filtered.filter(notification => notification.type === 'booking');
        break;
      case 'purchases':
        filtered = filtered.filter(notification => notification.type === 'purchase');
        break;
      default:
        filtered = notifications;
    }

    return filtered;
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-800"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 py-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-800 rounded-lg">
              <Bell className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
              <p className="text-gray-600 text-sm">Stay updated with recent activities</p>
            </div>
          </div>
          
          {unreadCount > 0 && (
            <div className="bg-blue-800 text-white px-3 py-1 rounded-full text-sm font-medium">
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
                className="flex items-center gap-2 px-3 py-2 text-sm text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
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
                    ? 'bg-blue-800 text-white'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilter('unread')}
                className={`px-3 py-2 text-sm rounded-lg transition-colors ${
                  filter === 'unread'
                    ? 'bg-blue-800 text-white'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                Unread
              </button>
              <button
                onClick={() => setFilter('bookings')}
                className={`px-3 py-2 text-sm rounded-lg transition-colors ${
                  filter === 'bookings'
                    ? 'bg-blue-800 text-white'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                Bookings
              </button>
              <button
                onClick={() => setFilter('purchases')}
                className={`px-3 py-2 text-sm rounded-lg transition-colors ${
                  filter === 'purchases'
                    ? 'bg-blue-800 text-white'
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
            const config = notificationConfig[notification.type] || {
              icon: Bell,
              color: 'text-gray-500',
              bgColor: 'bg-gray-100',
              borderColor: 'border-gray-200'
            };
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
                              <div className="w-2 h-2 bg-blue-800 rounded-full"></div>
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
                              className="p-1 text-gray-400 hover:text-blue-800 transition-colors"
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

      {/* Empty State for No Notifications */}
      {notifications.length === 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center mt-8">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Bell className="h-8 w-8 text-blue-800" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No notifications yet</h3>
          <p className="text-gray-600 text-sm mb-4">
            Notifications about bookings, purchases, and system updates will appear here.
          </p>
          <button
            onClick={loadNotifications}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-800 text-white rounded-lg hover:bg-blue-900 transition-colors"
          >
            <RefreshCcw className="h-4 w-4" />
            Load Sample Notifications
          </button>
        </div>
      )}
    </div>
  );
};

export default Notifications;