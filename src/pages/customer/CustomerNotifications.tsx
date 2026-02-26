import { useState, useEffect, useCallback, useRef } from 'react';
import { Bell, Check, X, Calendar, Gift, Info, CheckCircle, Clock } from 'lucide-react';
import {
  customerNotificationService,
  type CustomerNotification,
  type CustomerNotificationType,
} from '../../services/CustomerNotificationService';
import Toast from '../../components/ui/Toast';
import Pagination from '../../components/ui/Pagination';

type FilterTab = 'all' | 'unread' | 'read';

const CustomerNotifications = () => {
  const [notifications, setNotifications] = useState<CustomerNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const [filter, setFilter] = useState<FilterTab>('all');
  const [typeFilter, setTypeFilter] = useState<CustomerNotificationType | 'all'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [lastPage, setLastPage] = useState(1);

  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const toastTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    if (toastTimeout.current) clearTimeout(toastTimeout.current);
    setToast({ message, type });
    toastTimeout.current = setTimeout(() => setToast(null), 3000);
  };

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params: Record<string, unknown> = {
        per_page: pageSize,
        page: currentPage,
      };

      if (filter === 'unread') params.is_read = false;
      else if (filter === 'read') params.is_read = true;
      if (typeFilter !== 'all') params.type = typeFilter;

      const res = await customerNotificationService.getNotifications(params as never);

      if (res.success && res.data) {
        setNotifications(res.data.notifications);
        setTotalItems(res.data.pagination.total);
        setLastPage(res.data.pagination.last_page);
      } else {
        setNotifications([]);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load notifications';
      setError(msg);
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, [filter, typeFilter, currentPage, pageSize]);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await customerNotificationService.getUnreadCount();
      if (res.success) setUnreadCount(res.data.unread_count);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);
  useEffect(() => { fetchUnreadCount(); }, [fetchUnreadCount]);

  const markAsRead = async (id: number) => {
    try {
      setActionLoading(id);
      await customerNotificationService.markAsRead(id);
      setNotifications(prev => prev.map(n => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)));
      setUnreadCount(prev => Math.max(0, prev - 1));
      showToast('Marked as read', 'success');
    } catch {
      showToast('Failed to mark as read', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const markAllAsRead = async () => {
    try {
      setActionLoading(-1);
      await customerNotificationService.markAllAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, read_at: n.read_at || new Date().toISOString() })));
      setUnreadCount(0);
      showToast('All notifications marked as read', 'success');
    } catch {
      showToast('Failed to mark all as read', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const deleteNotification = async (id: number) => {
    try {
      setActionLoading(id);
      await customerNotificationService.deleteNotification(id);
      setNotifications(prev => prev.filter(n => n.id !== id));
      setSelectedIds(prev => prev.filter(sid => sid !== id));
      setTotalItems(prev => prev - 1);
      showToast('Notification deleted', 'success');
    } catch {
      showToast('Failed to delete notification', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleBulkAction = async (action: 'read' | 'delete') => {
    if (selectedIds.length === 0) return;
    setActionLoading(-1);
    try {
      if (action === 'delete') {
        await Promise.all(selectedIds.map(id => customerNotificationService.deleteNotification(id)));
        setNotifications(prev => prev.filter(n => !selectedIds.includes(n.id)));
        setTotalItems(prev => prev - selectedIds.length);
        showToast(`${selectedIds.length} notifications deleted`, 'success');
      } else {
        await Promise.all(selectedIds.map(id => customerNotificationService.markAsRead(id)));
        setNotifications(prev =>
          prev.map(n => selectedIds.includes(n.id) ? { ...n, read_at: n.read_at || new Date().toISOString() } : n)
        );
        fetchUnreadCount();
        showToast(`${selectedIds.length} notifications marked as read`, 'success');
      }
    } catch {
      showToast('Bulk action failed', 'error');
    } finally {
      setSelectedIds([]);
      setActionLoading(null);
    }
  };

  const toggleSelection = (id: number) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(sid => sid !== id) : [...prev, id]);
  };

  const selectAll = () => {
    setSelectedIds(selectedIds.length === notifications.length ? [] : notifications.map(n => n.id));
  };

  const isUnread = (n: CustomerNotification) => !n.read_at;

  const getIcon = (type: CustomerNotificationType) => {
    switch (type) {
      case 'booking': return <Calendar className="w-4 h-4" />;
      case 'payment': return <CheckCircle className="w-4 h-4" />;
      case 'promotion': return <Gift className="w-4 h-4" />;
      case 'gift_card': return <Gift className="w-4 h-4" />;
      case 'reminder': return <Clock className="w-4 h-4" />;
      case 'attraction': return <Info className="w-4 h-4" />;
      default: return <Info className="w-4 h-4" />;
    }
  };

  const getColor = (type: CustomerNotificationType) => {
    switch (type) {
      case 'booking': return 'text-blue-600 bg-blue-50';
      case 'payment': return 'text-emerald-600 bg-emerald-50';
      case 'promotion': return 'text-purple-600 bg-purple-50';
      case 'gift_card': return 'text-pink-600 bg-pink-50';
      case 'reminder': return 'text-amber-600 bg-amber-50';
      case 'attraction': return 'text-indigo-600 bg-indigo-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${Math.floor(diffInHours)}h ago`;
    if (diffInHours < 48) return 'Yesterday';
    return date.toLocaleDateString();
  };

  const localUnread = notifications.filter(n => !n.read_at).length;

  return (
    <>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes shimmer { 0% { background-position: -400px 0; } 100% { background-position: 400px 0; } }
        .fade-in { animation: fadeIn 0.25s ease-out; }
        .slide-up { animation: slideUp 0.35s ease-out both; }
        .hover-lift { transition: all 0.2s ease; }
        .hover-lift:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,0,0,0.06); }
        .skeleton { background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%); background-size: 800px 100%; animation: shimmer 1.5s infinite linear; border-radius: 8px; }
        [data-tooltip] { position: relative; }
        [data-tooltip]:hover::after { content: attr(data-tooltip); position: absolute; bottom: calc(100% + 6px); left: 50%; transform: translateX(-50%); padding: 4px 10px; font-size: 11px; font-weight: 500; color: #fff; background: #1e293b; border-radius: 6px; white-space: nowrap; z-index: 50; pointer-events: none; animation: fadeIn 0.15s ease-out; }
        [data-tooltip]:hover::before { content: ''; position: absolute; bottom: calc(100% + 2px); left: 50%; transform: translateX(-50%); border: 4px solid transparent; border-top-color: #1e293b; z-index: 50; pointer-events: none; animation: fadeIn 0.15s ease-out; }
      `}</style>

      <div className="min-h-screen bg-gray-50/80">
        {/* Hero */}
        <section className="relative bg-gradient-to-br from-blue-900 via-blue-800 to-violet-700 text-white py-6 md:py-8 overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.06),transparent_60%)]" />
          <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 slide-up">
            <div className="flex items-end justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="p-1.5 bg-white/10 backdrop-blur rounded-lg border border-white/10">
                    <Bell className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-blue-200/70 text-xs font-semibold uppercase tracking-widest">Notifications</span>
                </div>
                <h1 className="text-xl font-bold" style={{ color: 'white' }}>Notifications</h1>
                <p className="text-blue-200/60 text-sm mt-0.5">Stay updated with your bookings and offers</p>
              </div>
              {unreadCount > 0 && (
                <span className="text-xs font-medium bg-white/10 border border-white/10 backdrop-blur px-3 py-1 rounded-full text-blue-100">
                  {unreadCount} unread
                </span>
              )}
            </div>
          </div>
        </section>

        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {/* Controls */}
          <div className="bg-white border border-gray-100 rounded-xl p-4 mb-5 slide-up">
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
              {/* Filter Tabs */}
              <div className="flex gap-1.5">
                {(['all', 'unread', 'read'] as FilterTab[]).map(tab => (
                  <button
                    key={tab}
                    onClick={() => { setFilter(tab); setCurrentPage(1); }}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${
                      filter === tab
                        ? 'bg-blue-700 text-white'
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-150'
                    }`}
                  >
                    {tab === 'all' ? `All (${totalItems})` : tab === 'unread' ? `Unread (${unreadCount})` : 'Read'}
                  </button>
                ))}
              </div>

              {/* Type Filter */}
              <select
                value={typeFilter}
                onChange={(e) => { setTypeFilter(e.target.value as CustomerNotificationType | 'all'); setCurrentPage(1); }}
                className="text-xs border border-gray-200 rounded-md px-2.5 py-1.5 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="all">All Types</option>
                <option value="booking">Bookings</option>
                <option value="payment">Payments</option>
                <option value="promotion">Promotions</option>
                <option value="gift_card">Gift Cards</option>
                <option value="reminder">Reminders</option>
                <option value="attraction">Attractions</option>
                <option value="general">General</option>
              </select>
            </div>

            {/* Bulk Actions */}
            {selectedIds.length > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-3">
                <span className="text-xs text-gray-500">{selectedIds.length} selected</span>
                <button
                  onClick={() => handleBulkAction('read')}
                  disabled={actionLoading === -1}
                  className="px-2.5 py-1 text-xs font-semibold bg-emerald-50 text-emerald-700 rounded-md hover:bg-emerald-100 transition disabled:opacity-50"
                >
                  Mark Read
                </button>
                <button
                  onClick={() => handleBulkAction('delete')}
                  disabled={actionLoading === -1}
                  className="px-2.5 py-1 text-xs font-semibold bg-red-50 text-red-700 rounded-md hover:bg-red-100 transition disabled:opacity-50"
                >
                  Delete
                </button>
              </div>
            )}

            {/* Quick Actions */}
            <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-3">
              <button onClick={selectAll} className="text-xs text-blue-700 hover:text-blue-800 font-semibold">
                {selectedIds.length === notifications.length && notifications.length > 0 ? 'Deselect All' : 'Select All'}
              </button>
              {localUnread > 0 && (
                <button
                  onClick={markAllAsRead}
                  disabled={actionLoading === -1}
                  className="text-xs text-emerald-700 hover:text-emerald-800 font-semibold disabled:opacity-50"
                >
                  {actionLoading === -1 ? 'Marking…' : 'Mark All Read'}
                </button>
              )}
            </div>
          </div>

          {/* Loading Skeleton */}
          {loading && (
            <div className="space-y-2.5">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="bg-white border border-gray-100 rounded-lg p-4 slide-up" style={{ animationDelay: `${i * 0.06}s` }}>
                  <div className="flex items-start gap-3">
                    <div className="skeleton w-8 h-8 rounded-lg shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="skeleton h-4 w-3/5 rounded" />
                      <div className="skeleton h-3 w-4/5 rounded" />
                      <div className="skeleton h-3 w-2/5 rounded" />
                    </div>
                    <div className="skeleton h-4 w-12 rounded" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Error */}
          {!loading && error && (
            <div className="bg-red-50 border border-red-100 rounded-lg p-5 text-center">
              <p className="text-sm text-red-700 mb-3">{error}</p>
              <button
                onClick={fetchNotifications}
                className="px-4 py-1.5 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-medium"
              >
                Retry
              </button>
            </div>
          )}

          {/* Notifications List */}
          {!loading && !error && (
            <div className="space-y-2">
              {notifications.length === 0 ? (
                <div className="text-center py-16 bg-white border border-gray-100 rounded-xl">
                  <Bell className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                  <h3 className="text-base font-semibold text-gray-800 mb-1">No notifications</h3>
                  <p className="text-sm text-gray-500">
                    {filter === 'all' ? "You're all caught up!" : `No ${filter} notifications.`}
                  </p>
                </div>
              ) : (
                notifications.map((notification, idx) => (
                  <div
                    key={notification.id}
                    className={`bg-white border rounded-lg hover-lift slide-up transition ${
                      isUnread(notification) ? 'border-blue-100' : 'border-gray-100'
                    }`}
                    style={{ animationDelay: `${idx * 0.03}s` }}
                  >
                    <div className="p-3.5">
                      <div className="flex items-start gap-3">
                        {/* Checkbox */}
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(notification.id)}
                          onChange={() => toggleSelection(notification.id)}
                          className="mt-1 rounded text-blue-600"
                        />

                        {/* Icon */}
                        <div className={`p-2 rounded-lg shrink-0 ${getColor(notification.type)}`}>
                          {getIcon(notification.type)}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <h3 className={`text-sm font-semibold leading-tight ${isUnread(notification) ? 'text-gray-900' : 'text-gray-600'}`}>
                                {notification.title}
                                {isUnread(notification) && (
                                  <span className="ml-1.5 inline-block w-1.5 h-1.5 bg-blue-600 rounded-full align-middle" />
                                )}
                              </h3>
                              <p className="text-xs text-gray-500 mt-0.5 line-clamp-2 leading-relaxed">
                                {notification.message}
                              </p>

                              {/* Extra data */}
                              {notification.data && Object.keys(notification.data).length > 0 && (() => {
                                const d = notification.data as Record<string, string | number | undefined>;
                                return (
                                  <div className="mt-1.5 flex flex-wrap gap-1.5 text-xs text-gray-400">
                                    {d.booking_id && <span className="bg-gray-50 px-2 py-0.5 rounded font-medium">Booking: {String(d.booking_id)}</span>}
                                    {d.amount && <span className="bg-gray-50 px-2 py-0.5 rounded font-medium">${String(d.amount)}</span>}
                                    {d.location && <span className="bg-gray-50 px-2 py-0.5 rounded font-medium">{String(d.location)}</span>}
                                  </div>
                                );
                              })()}

                              {/* Priority */}
                              {notification.priority && notification.priority !== 'normal' && (
                                <div className="mt-1.5">
                                  <span className={`text-xs px-2 py-0.5 font-semibold rounded-full ${
                                    notification.priority === 'urgent' ? 'bg-red-100 text-red-700' :
                                    notification.priority === 'high' ? 'bg-orange-100 text-orange-700' :
                                    'bg-gray-100 text-gray-600'
                                  }`}>
                                    {notification.priority}
                                  </span>
                                </div>
                              )}
                            </div>

                            {/* Time & Actions */}
                            <div className="flex flex-col items-end gap-1.5 shrink-0">
                              <span className="text-xs text-gray-400 font-medium">{formatDate(notification.created_at)}</span>
                              <div className="flex gap-0.5">
                                {isUnread(notification) ? (
                                  <button
                                    onClick={() => markAsRead(notification.id)}
                                    disabled={actionLoading === notification.id}
                                    className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-md transition disabled:opacity-50"
                                    data-tooltip="Mark as read"
                                  >
                                    {actionLoading === notification.id ? (
                                      <span className="block w-3.5 h-3.5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                                    ) : <Check size={13} />}
                                  </button>
                                ) : (
                                  <button className="p-1.5 text-gray-300 rounded-md" disabled data-tooltip="Already read">
                                    <Bell size={13} />
                                  </button>
                                )}
                                <button
                                  onClick={() => deleteNotification(notification.id)}
                                  disabled={actionLoading === notification.id}
                                  className="p-1.5 text-red-500 hover:bg-red-50 rounded-md transition disabled:opacity-50"
                                  data-tooltip="Delete notification"
                                >
                                  {actionLoading === notification.id ? (
                                    <span className="block w-3.5 h-3.5 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                                  ) : <X size={13} />}
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
          )}

          {/* Pagination */}
          {!loading && !error && totalItems > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-5 bg-white border border-gray-100 rounded-xl px-4 py-3">
              <div className="flex items-center gap-3 text-xs text-gray-500">
                <select
                  value={pageSize}
                  onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                  className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  {[5, 10, 20, 50].map(size => (
                    <option key={size} value={size}>{size} / page</option>
                  ))}
                </select>
              </div>
              <Pagination
                currentPage={currentPage}
                totalPages={lastPage}
                onPageChange={setCurrentPage}
                totalItems={totalItems}
                itemsPerPage={pageSize}
                compact
              />
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default CustomerNotifications;
