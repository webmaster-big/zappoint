import { useState, useEffect } from 'react';
import { Bell, Check, X, Calendar, Gift, Info, CheckCircle, Clock } from 'lucide-react';
import type { 
  Notification, 
  NotificationType, 
  NotificationStatus
} from '../../types/customer';

const sampleNotifications: Notification[] = [
  {
    id: '1',
    type: 'booking',
    title: 'Booking Confirmed',
    message: 'Your Birthday Bash Package booking at Brighton location has been confirmed for December 25, 2024.',
    status: 'unread',
    createdAt: '2024-12-16T10:30:00Z',
    actionUrl: '/customer/reservations',
    actionText: 'View Booking',
    metadata: {
      bookingId: 'ZAP-2024-001',
      location: 'Brighton'
    }
  },
  {
    id: '2',
    type: 'payment',
    title: 'Payment Successful',
    message: 'Payment of $299.00 for your Birthday Bash Package has been processed successfully.',
    status: 'unread',
    createdAt: '2024-12-16T10:25:00Z',
    actionUrl: '/customer/reservations',
    actionText: 'View Receipt',
    metadata: {
      amount: 299,
      bookingId: 'ZAP-2024-001'
    }
  },
  {
    id: '3',
    type: 'promotion',
    title: 'Special Holiday Offer!',
    message: 'Get 20% off on all Family Fun Packages this holiday season. Valid until December 31st.',
    status: 'read',
    createdAt: '2024-12-15T14:00:00Z',
    actionUrl: '/',
    actionText: 'Browse Packages',
    metadata: {
      expiryDate: '2024-12-31'
    }
  },
  {
    id: '4',
    type: 'reminder',
    title: 'Upcoming Booking Reminder',
    message: 'Your Family Fun Package booking is scheduled for tomorrow at 4:00 PM at Canton location.',
    status: 'read',
    createdAt: '2024-12-19T09:00:00Z',
    actionUrl: '/customer/reservations',
    actionText: 'View Details',
    metadata: {
      bookingId: 'ZAP-2024-002',
      location: 'Canton'
    }
  },
  {
    id: '5',
    type: 'gift_card',
    title: 'Gift Card Purchase Complete',
    message: 'Your $50 ZapZone Gift Card has been successfully purchased. Code: GC-50-OWNED',
    status: 'read',
    createdAt: '2024-12-14T16:20:00Z',
    actionUrl: '/customer/gift-cards',
    actionText: 'View Gift Cards',
    metadata: {
      amount: 50
    }
  },
  {
    id: '7',
    type: 'booking',
    title: 'Booking Cancelled',
    message: 'Your Corporate Team Building booking has been cancelled as requested. Refund will be processed within 3-5 business days.',
    status: 'read',
    createdAt: '2024-12-10T15:45:00Z',
    actionUrl: '/customer/reservations',
    actionText: 'View Reservations',
    metadata: {
      bookingId: 'ZAP-2024-003',
      amount: 499
    }
  }
];


const CustomerNotifications = () => {
  // Get customer from localStorage
  // const getCustomer = () => {
  //   const customerData = localStorage.getItem('zapzone_customer');
  //   return customerData ? JSON.parse(customerData) : null;
  // };

  // const customer = getCustomer();
  // const isLoggedIn = customer && customer.token;

  const [notifications, setNotifications] = useState<Notification[]>(sampleNotifications);
  const [filteredNotifications, setFilteredNotifications] = useState<Notification[]>(sampleNotifications);
  const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all');
  const [typeFilter, setTypeFilter] = useState<NotificationType | 'all'>('all');
  const [selectedNotifications, setSelectedNotifications] = useState<string[]>([]);
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);

  useEffect(() => {
    let filtered = notifications;

    // Filter by read status
    if (filter === 'unread') {
      filtered = filtered.filter(n => n.status === 'unread');
    } else if (filter === 'read') {
      filtered = filtered.filter(n => n.status === 'read');
    }

    // Filter by type
    if (typeFilter !== 'all') {
      filtered = filtered.filter(n => n.type === typeFilter);
    }

    // Sort by date (newest first)
    filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Pagination
    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    let page = currentPage;
    if (page > totalPages) page = totalPages;
    const startIdx = (page - 1) * pageSize;
    const endIdx = startIdx + pageSize;
    setFilteredNotifications(filtered.slice(startIdx, endIdx));
  }, [notifications, filter, typeFilter, currentPage, pageSize]);

  const markAsRead = (notificationId: string) => {
    setNotifications(prev => 
      prev.map(n => 
        n.id === notificationId ? { ...n, status: 'read' as NotificationStatus } : n
      )
    );
  };

  const markAsUnread = (notificationId: string) => {
    setNotifications(prev => 
      prev.map(n => 
        n.id === notificationId ? { ...n, status: 'unread' as NotificationStatus } : n
      )
    );
  };

  const deleteNotification = (notificationId: string) => {
    setNotifications(prev => prev.filter(n => n.id !== notificationId));
    setSelectedNotifications(prev => prev.filter(id => id !== notificationId));
  };

  const markAllAsRead = () => {
    setNotifications(prev => 
      prev.map(n => ({ ...n, status: 'read' as NotificationStatus }))
    );
  };

  const handleBulkAction = (action: 'read' | 'unread' | 'delete') => {
    if (action === 'delete') {
      setNotifications(prev => prev.filter(n => !selectedNotifications.includes(n.id)));
    } else {
      setNotifications(prev => 
        prev.map(n => 
          selectedNotifications.includes(n.id) 
            ? { ...n, status: action as NotificationStatus }
            : n
        )
      );
    }
    setSelectedNotifications([]);
  };

  const toggleNotificationSelection = (notificationId: string) => {
    setSelectedNotifications(prev => 
      prev.includes(notificationId)
        ? prev.filter(id => id !== notificationId)
        : [...prev, notificationId]
    );
  };

  const selectAllNotifications = () => {
    setSelectedNotifications(
      selectedNotifications.length === filteredNotifications.length
        ? []
        : filteredNotifications.map(n => n.id)
    );
  };

  const getNotificationIcon = (type: NotificationType) => {
    switch (type) {
      case 'booking': return <Calendar className="w-5 h-5" />;
      case 'payment': return <CheckCircle className="w-5 h-5" />;
      case 'promotion': return <Gift className="w-5 h-5" />;
      case 'gift_card': return <Gift className="w-5 h-5" />;
      case 'reminder': return <Clock className="w-5 h-5" />;
      default: return <Info className="w-5 h-5" />;
    }
  };

  const getNotificationColor = (type: NotificationType) => {
    switch (type) {
      case 'booking': return 'text-blue-600 bg-blue-50';
      case 'payment': return 'text-green-600 bg-green-50';
      case 'promotion': return 'text-purple-600 bg-purple-50';
      case 'gift_card': return 'text-pink-600 bg-pink-50';
      case 'reminder': return 'text-yellow-600 bg-yellow-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 1) {
      return 'Just now';
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)} hours ago`;
    } else if (diffInHours < 48) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString();
    }
  };

  const unreadCount = notifications.filter(n => n.status === 'unread').length;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-3">
              Notifications
              {unreadCount > 0 && (
                <span className="bg-red-500 text-white text-xs px-2 py-0.5 font-medium">
                  {unreadCount} unread
                </span>
              )}
            </h1>
            <p className="text-gray-600 mt-1 text-sm">Stay updated with your bookings, payments, and special offers</p>
          </div>

          {/* Controls */}
          <div className="bg-white border border-gray-200 mb-6">
            <div className="p-4">
              <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                {/* Filters */}
                <div className="flex flex-wrap gap-2">
                  <button
                    className={`px-4 py-2 text-sm font-medium transition ${
                      filter === 'all' 
                        ? 'bg-blue-800 text-white' 
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                    onClick={() => setFilter('all')}
                  >
                    All ({notifications.length})
                  </button>
                  <button
                    className={`px-4 py-2 text-sm font-medium transition ${
                      filter === 'unread' 
                        ? 'bg-blue-800 text-white' 
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                    onClick={() => setFilter('unread')}
                  >
                    Unread ({unreadCount})
                  </button>
                  <button
                    className={`px-4 py-2 text-sm font-medium transition ${
                      filter === 'read' 
                        ? 'bg-blue-800 text-white' 
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                    onClick={() => setFilter('read')}
                  >
                    Read ({notifications.filter(n => n.status === 'read').length})
                  </button>
                </div>

                {/* Type Filter */}
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-gray-700">Type:</label>
                  <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value as NotificationType | 'all')}
                    className="border border-gray-300 px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-800"
                  >
                    <option value="all">All Types</option>
                    <option value="booking">Bookings</option>
                    <option value="payment">Payments</option>
                    <option value="promotion">Promotions</option>
                    <option value="gift_card">Gift Cards</option>
                    <option value="reminder">Reminders</option>
                  </select>
                </div>
              </div>

              {/* Bulk Actions */}
              {selectedNotifications.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600">
                      {selectedNotifications.length} selected
                    </span>
                    <button
                      onClick={() => handleBulkAction('read')}
                      className="px-3 py-1 text-xs bg-green-100 text-green-800 hover:bg-green-200 transition"
                    >
                      Mark as Read
                    </button>
                    <button
                      onClick={() => handleBulkAction('unread')}
                      className="px-3 py-1 text-xs bg-blue-100 text-blue-800 hover:bg-blue-200 transition"
                    >
                      Mark as Unread
                    </button>
                    <button
                      onClick={() => handleBulkAction('delete')}
                      className="px-3 py-1 text-xs bg-red-100 text-red-800 hover:bg-red-200 transition"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}

              {/* Quick Actions */}
              <div className="mt-4 pt-4 border-t border-gray-200 flex items-center gap-2">
                <button
                  onClick={selectAllNotifications}
                  className="text-sm text-blue-800 hover:text-blue-900 font-medium"
                >
                  {selectedNotifications.length === filteredNotifications.length ? 'Deselect All' : 'Select All'}
                </button>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-sm text-green-700 hover:text-green-800 font-medium"
                  >
                    Mark All as Read
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Notifications List */}
          <div className="space-y-3">
            {filteredNotifications.length === 0 ? (
              <div className="text-center py-12 bg-white border border-gray-200">
                <Bell className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No notifications found</h3>
                <p className="text-gray-600">
                  {filter === 'all' 
                    ? "You don't have any notifications yet."
                    : `No ${filter} notifications to show.`}
                </p>
              </div>
            ) : (
              filteredNotifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`bg-white border transition-all duration-200 hover:shadow-md ${
                    notification.status === 'unread' 
                      ? 'border-blue-200 bg-blue-50/30' 
                      : 'border-gray-200'
                  }`}
                >
                  <div className="p-4">
                    <div className="flex items-start gap-4">
                      {/* Checkbox */}
                      <input
                        type="checkbox"
                        checked={selectedNotifications.includes(notification.id)}
                        onChange={() => toggleNotificationSelection(notification.id)}
                        className="mt-1"
                      />

                      {/* Icon */}
                      <div className={`p-2 ${getNotificationColor(notification.type)}`}>
                        {getNotificationIcon(notification.type)}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h3 className={`text-base font-medium ${
                              notification.status === 'unread' ? 'text-gray-900' : 'text-gray-700'
                            }`}>
                              {notification.title}
                              {notification.status === 'unread' && (
                                <span className="ml-2 w-2 h-2 bg-blue-600 inline-block rounded-full"></span>
                              )}
                            </h3>
                            <p className="text-gray-600 mt-1 text-sm line-clamp-2">
                              {notification.message}
                            </p>
                            
                            {/* Metadata */}
                            {notification.metadata && (
                              <div className="mt-2 flex flex-wrap gap-4 text-xs text-gray-500">
                                {notification.metadata.bookingId && (
                                  <span>Booking: {notification.metadata.bookingId}</span>
                                )}
                                {notification.metadata.amount && (
                                  <span>Amount: ${notification.metadata.amount}</span>
                                )}
                                {notification.metadata.location && (
                                  <span>Location: {notification.metadata.location}</span>
                                )}
                              </div>
                            )}

                            {/* Action Button */}
                            {notification.actionUrl && notification.actionText && (
                              <div className="mt-3">
                                <a
                                  href={notification.actionUrl}
                                  className="inline-flex items-center text-xs text-blue-800 hover:text-blue-900 font-medium"
                                >
                                  {notification.actionText}
                                  <svg className="ml-1 w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                  </svg>
                                </a>
                              </div>
                            )}
                          </div>

                          <div className="flex flex-col items-end gap-2">
                            <span className="text-xs text-gray-500">
                              {formatDate(notification.createdAt)}
                            </span>
                            
                            {/* Actions */}
                            <div className="flex gap-1">
                              {notification.status === 'unread' ? (
                                <button
                                  onClick={() => markAsRead(notification.id)}
                                  className="p-1 text-green-600 hover:bg-green-50 transition"
                                  title="Mark as read"
                                >
                                  <Check size={16} />
                                </button>
                              ) : (
                                <button
                                  onClick={() => markAsUnread(notification.id)}
                                  className="p-1 text-blue-600 hover:bg-blue-50 transition"
                                  title="Mark as unread"
                                >
                                  <Bell size={16} />
                                </button>
                              )}
                              <button
                                onClick={() => deleteNotification(notification.id)}
                                className="p-1 text-red-600 hover:bg-red-50 transition"
                                title="Delete notification"
                              >
                                <X size={16} />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Pagination Controls */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 mt-8">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-600">Rows per page:</span>
              <select
                value={pageSize}
                onChange={e => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                className="border border-gray-300 rounded px-2 py-1 text-xs"
              >
                {[5, 10, 20, 50].map(size => (
                  <option key={size} value={size}>{size}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-2 py-1 border border-gray-300 text-gray-700 rounded disabled:opacity-50 text-xs"
              >
                Prev
              </button>
              <span className="text-xs text-gray-600">
                Page {currentPage} of {Math.max(1, Math.ceil(notifications.filter(n => {
                  let match = true;
                  if (filter === 'unread') match = n.status === 'unread';
                  else if (filter === 'read') match = n.status === 'read';
                  if (typeFilter !== 'all') match = match && n.type === typeFilter;
                  return match;
                }).length / pageSize))}
              </span>
              <button
                onClick={() => setCurrentPage(p => p + 1)}
                disabled={currentPage >= Math.ceil(notifications.filter(n => {
                  let match = true;
                  if (filter === 'unread') match = n.status === 'unread';
                  else if (filter === 'read') match = n.status === 'read';
                  if (typeFilter !== 'all') match = match && n.type === typeFilter;
                  return match;
                }).length / pageSize)}
                className="px-2 py-1 border border-gray-300 text-gray-700 rounded disabled:opacity-50 text-xs"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>
  );
};

export default CustomerNotifications;