// src/pages/admin/email/EmailNotifications.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Search,
  Plus,
  Filter,
  RefreshCcw,
  Bell,
  Edit,
  Trash2,
  Eye,
  ChevronLeft,
  ChevronRight,
  Copy,
  Send,
  Calendar,
  Users,
  Package,
  Ticket,
  CreditCard,
  Mail,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { useThemeColor } from '../../../hooks/useThemeColor';
import { emailNotificationService } from '../../../services/EmailNotificationService';
import { locationService } from '../../../services/LocationService';
import StandardButton from '../../../components/ui/StandardButton';
import Toast from '../../../components/ui/Toast';
import CounterAnimation from '../../../components/ui/CounterAnimation';
import { getStoredUser } from '../../../utils/storage';
import type { 
  EmailNotification, 
  EmailNotificationFilters, 
  TriggerType,
  EntityType
} from '../../../types/EmailNotification.types';

const EmailNotifications: React.FC = () => {
  const { themeColor, fullColor } = useThemeColor();
  const currentUser = getStoredUser();
  const isCompanyAdmin = currentUser?.role === 'company_admin';

  // State
  const [notifications, setNotifications] = useState<EmailNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  const [locations, setLocations] = useState<Array<{ id: number; name: string }>>([]);
  const [filters, setFilters] = useState<{
    triggerType: TriggerType | 'all';
    entityType: EntityType | 'all';
    isActive: 'all' | 'true' | 'false';
    search: string;
  }>({
    triggerType: 'all',
    entityType: 'all',
    isActive: 'all',
    search: ''
  });
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [itemsPerPage] = useState(10);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [testEmailModal, setTestEmailModal] = useState<EmailNotification | null>(null);
  const [testEmail, setTestEmail] = useState('');
  const [sendingTest, setSendingTest] = useState(false);
  const [triggerTypes, setTriggerTypes] = useState<Record<string, string>>({});

  // Statistics (calculated from loaded notifications)
  const stats = {
    total: totalItems,
    active: notifications.filter(n => n.is_active).length,
    inactive: notifications.filter(n => !n.is_active).length,
    booking: notifications.filter(n => n.trigger_type.startsWith('booking_')).length,
    purchase: notifications.filter(n => n.trigger_type.startsWith('purchase_')).length,
    payment: notifications.filter(n => n.trigger_type.startsWith('payment_')).length,
  };

  // Get trigger type category icon
  const getTriggerIcon = (triggerType: TriggerType) => {
    if (triggerType.startsWith('booking_')) return Calendar;
    if (triggerType.startsWith('purchase_')) return Ticket;
    if (triggerType.startsWith('payment_')) return CreditCard;
    return Bell;
  };

  // Get trigger type category color
  const getTriggerColor = () => {
    return `bg-${themeColor}-100 text-${themeColor}-700 border-${themeColor}-200`;
  };

  // Get entity type icon
  const getEntityIcon = (entityType: EntityType) => {
    if (entityType === 'package') return Package;
    if (entityType === 'attraction') return Ticket;
    return Users;
  };

  // Fetch trigger types
  useEffect(() => {
    const fetchTriggerTypes = async () => {
      try {
        const response = await emailNotificationService.getTriggerTypes();
        if (response.success) {
          setTriggerTypes(response.flat);
        }
      } catch (error) {
        console.error('Error fetching trigger types:', error);
      }
    };
    fetchTriggerTypes();
  }, []);

  // Fetch locations for company admin
  useEffect(() => {
    const fetchLocations = async () => {
      if (isCompanyAdmin) {
        try {
          const response = await locationService.getLocations();
          if (response.success && response.data) {
            setLocations(response.data);
          }
        } catch (error) {
          console.error('Error fetching locations:', error);
        }
      }
    };
    fetchLocations();
  }, [isCompanyAdmin]);

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      
      const apiFilters: EmailNotificationFilters = {
        page: currentPage,
        per_page: itemsPerPage
      };

      if (filters.triggerType !== 'all') {
        apiFilters.trigger_type = filters.triggerType;
      }
      if (filters.entityType !== 'all') {
        apiFilters.entity_type = filters.entityType;
      }
      if (filters.isActive !== 'all') {
        apiFilters.is_active = filters.isActive === 'true';
      }
      if (filters.search.trim()) {
        apiFilters.search = filters.search.trim();
      }
      if (selectedLocation) {
        apiFilters.location_id = parseInt(selectedLocation);
      }

      const response = await emailNotificationService.getAll(apiFilters);
      
      if (response.success) {
        setNotifications(response.data.data);
        setTotalPages(response.data.last_page);
        setTotalItems(response.data.total);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
      setToast({ message: 'Failed to load email notifications', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [currentPage, itemsPerPage, filters, selectedLocation]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Handle delete notification
  const handleDelete = async (id: number) => {
    try {
      const response = await emailNotificationService.delete(id);
      if (response.success) {
        setToast({ message: 'Notification deleted successfully', type: 'success' });
        fetchNotifications();
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
      setToast({ message: 'Failed to delete notification', type: 'error' });
    } finally {
      setDeleteConfirm(null);
    }
  };

  // Handle toggle status
  const handleToggleStatus = async (notification: EmailNotification) => {
    try {
      const response = await emailNotificationService.toggleStatus(notification.id);
      if (response.success) {
        setToast({ 
          message: `Notification ${response.data.is_active ? 'activated' : 'deactivated'} successfully`, 
          type: 'success' 
        });
        fetchNotifications();
      }
    } catch (error) {
      console.error('Error toggling status:', error);
      setToast({ message: 'Failed to toggle notification status', type: 'error' });
    }
  };

  // Handle duplicate
  const handleDuplicate = async (id: number) => {
    try {
      const response = await emailNotificationService.duplicate(id);
      if (response.success) {
        setToast({ message: 'Notification duplicated successfully', type: 'success' });
        fetchNotifications();
      }
    } catch (error) {
      console.error('Error duplicating notification:', error);
      setToast({ message: 'Failed to duplicate notification', type: 'error' });
    }
  };

  // Handle send test email
  const handleSendTestEmail = async () => {
    if (!testEmailModal || !testEmail.trim()) return;

    try {
      setSendingTest(true);
      const response = await emailNotificationService.sendTestEmail(testEmailModal.id, {
        test_email: testEmail.trim()
      });
      if (response.success) {
        setToast({ message: 'Test email sent successfully', type: 'success' });
        setTestEmailModal(null);
        setTestEmail('');
      }
    } catch (error) {
      console.error('Error sending test email:', error);
      setToast({ message: 'Failed to send test email', type: 'error' });
    } finally {
      setSendingTest(false);
    }
  };

  // Format trigger type for display
  const formatTriggerType = (triggerType: TriggerType) => {
    return triggerTypes[triggerType] || triggerType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  return (
    <div className="px-6 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Email Notifications</h1>
          <p className="text-gray-600 mt-2">Automated email notifications for bookings, purchases, and payments</p>
        </div>
        <div className="flex items-center gap-3 mt-4 sm:mt-0">
          <StandardButton
            variant="secondary"
            icon={RefreshCcw}
            onClick={() => fetchNotifications()}
            disabled={loading}
          >
            Refresh
          </StandardButton>
          <Link to="/admin/email/notifications/create">
            <StandardButton variant="primary" icon={Plus}>
              Create Notification
            </StandardButton>
          </Link>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex flex-col gap-2 hover:shadow-md transition-shadow min-h-[120px]">
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-lg bg-${themeColor}-100`}>
              <Bell size={20} className={`text-${fullColor}`} />
            </div>
            <span className="text-base font-semibold text-gray-800">Total Notifications</span>
          </div>
          {loading ? (
            <div className="animate-pulse space-y-2 mt-2">
              <div className="h-8 bg-gray-200 rounded w-16"></div>
              <div className="h-3 bg-gray-200 rounded w-20"></div>
            </div>
          ) : (
            <>
              <div className="flex items-end gap-2 mt-2">
                <CounterAnimation value={stats.total} className="text-2xl font-bold text-gray-900" />
              </div>
              <p className="text-xs mt-1 text-gray-400">All configured notifications</p>
            </>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex flex-col gap-2 hover:shadow-md transition-shadow min-h-[120px]">
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-lg bg-${themeColor}-100`}>
              <CheckCircle size={20} className={`text-${fullColor}`} />
            </div>
            <span className="text-base font-semibold text-gray-800">Active</span>
          </div>
          {loading ? (
            <div className="animate-pulse space-y-2 mt-2">
              <div className="h-8 bg-gray-200 rounded w-16"></div>
              <div className="h-3 bg-gray-200 rounded w-20"></div>
            </div>
          ) : (
            <>
              <div className="flex items-end gap-2 mt-2">
                <CounterAnimation value={stats.active} className="text-2xl font-bold text-gray-900" />
              </div>
              <p className="text-xs mt-1 text-gray-400">Currently sending emails</p>
            </>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex flex-col gap-2 hover:shadow-md transition-shadow min-h-[120px]">
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-lg bg-${themeColor}-100`}>
              <Calendar size={20} className={`text-${fullColor}`} />
            </div>
            <span className="text-base font-semibold text-gray-800">Booking Triggers</span>
          </div>
          {loading ? (
            <div className="animate-pulse space-y-2 mt-2">
              <div className="h-8 bg-gray-200 rounded w-16"></div>
              <div className="h-3 bg-gray-200 rounded w-20"></div>
            </div>
          ) : (
            <>
              <div className="flex items-end gap-2 mt-2">
                <CounterAnimation value={stats.booking} className="text-2xl font-bold text-gray-900" />
              </div>
              <p className="text-xs mt-1 text-gray-400">Booking event notifications</p>
            </>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex flex-col gap-2 hover:shadow-md transition-shadow min-h-[120px]">
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-lg bg-${themeColor}-100`}>
              <Ticket size={20} className={`text-${fullColor}`} />
            </div>
            <span className="text-base font-semibold text-gray-800">Purchase Triggers</span>
          </div>
          {loading ? (
            <div className="animate-pulse space-y-2 mt-2">
              <div className="h-8 bg-gray-200 rounded w-16"></div>
              <div className="h-3 bg-gray-200 rounded w-20"></div>
            </div>
          ) : (
            <>
              <div className="flex items-end gap-2 mt-2">
                <CounterAnimation value={stats.purchase} className="text-2xl font-bold text-gray-900" />
              </div>
              <p className="text-xs mt-1 text-gray-400">Purchase event notifications</p>
            </>
          )}
        </div>
      </div>

      {/* Filters Section */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-6">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="relative flex-1 max-w-lg">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-600" />
            </div>
            <input
              type="text"
              placeholder="Search notifications by name..."
              value={filters.search}
              onChange={(e) => {
                setFilters(prev => ({ ...prev, search: e.target.value }));
                setCurrentPage(1);
              }}
              className={`pl-9 pr-3 py-1.5 border border-gray-200 rounded-lg w-full text-sm focus:ring-2 focus:ring-${themeColor}-600 focus:border-${themeColor}-600`}
            />
          </div>
          <div className="flex gap-1">
            <StandardButton
              onClick={() => setShowFilters(!showFilters)}
              variant="secondary"
              size="sm"
              icon={Filter}
            >
              Filters
            </StandardButton>
            <StandardButton
              onClick={fetchNotifications}
              variant="secondary"
              size="sm"
              icon={RefreshCcw}
            >
              {''}
            </StandardButton>
          </div>
        </div>
        
        {/* Advanced Filters */}
        {showFilters && (
          <div className="mt-3 p-3 bg-gray-50 rounded-lg">
            <div className={`grid grid-cols-1 ${isCompanyAdmin && locations.length > 0 ? 'md:grid-cols-4' : 'md:grid-cols-3'} gap-3`}>
              {/* Location Filter (Company Admin only) */}
              {isCompanyAdmin && locations.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-gray-800 mb-1">Location</label>
                  <select
                    value={selectedLocation}
                    onChange={(e) => {
                      setSelectedLocation(e.target.value);
                      setCurrentPage(1);
                    }}
                    className={`w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-${themeColor}-600 focus:border-${themeColor}-600`}
                  >
                    <option value="">All Locations</option>
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id.toString()}>
                        {loc.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Trigger Type Filter */}
              <div>
                <label className="block text-xs font-medium text-gray-800 mb-1">Trigger Type</label>
                <select
                  value={filters.triggerType}
                  onChange={(e) => {
                    setFilters(prev => ({ ...prev, triggerType: e.target.value as TriggerType | 'all' }));
                    setCurrentPage(1);
                  }}
                  className={`w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-${themeColor}-600 focus:border-${themeColor}-600`}
                >
                  <option value="all">All Triggers</option>
                  <optgroup label="Booking">
                    <option value="booking_created">Booking Created</option>
                    <option value="booking_confirmed">Booking Confirmed</option>
                    <option value="booking_updated">Booking Updated</option>
                    <option value="booking_cancelled">Booking Cancelled</option>
                    <option value="booking_reminder">Booking Reminder</option>
                  </optgroup>
                  <optgroup label="Purchase">
                    <option value="purchase_created">Purchase Created</option>
                    <option value="purchase_confirmed">Purchase Confirmed</option>
                    <option value="purchase_cancelled">Purchase Cancelled</option>
                  </optgroup>
                  <optgroup label="Payment">
                    <option value="payment_received">Payment Received</option>
                    <option value="payment_failed">Payment Failed</option>
                    <option value="payment_refunded">Payment Refunded</option>
                  </optgroup>
                </select>
              </div>

              {/* Entity Type Filter */}
              <div>
                <label className="block text-xs font-medium text-gray-800 mb-1">Entity Type</label>
                <select
                  value={filters.entityType}
                  onChange={(e) => {
                    setFilters(prev => ({ ...prev, entityType: e.target.value as EntityType | 'all' }));
                    setCurrentPage(1);
                  }}
                  className={`w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-${themeColor}-600 focus:border-${themeColor}-600`}
                >
                  <option value="all">All Entities</option>
                  <option value="package">Packages Only</option>
                  <option value="attraction">Attractions Only</option>
                </select>
              </div>

              {/* Status Filter */}
              <div>
                <label className="block text-xs font-medium text-gray-800 mb-1">Status</label>
                <select
                  value={filters.isActive}
                  onChange={(e) => {
                    setFilters(prev => ({ ...prev, isActive: e.target.value as 'all' | 'true' | 'false' }));
                    setCurrentPage(1);
                  }}
                  className={`w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-${themeColor}-600 focus:border-${themeColor}-600`}
                >
                  <option value="all">All Statuses</option>
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </select>
              </div>
            </div>
            <div className="mt-3 flex justify-end">
              <StandardButton
                onClick={() => {
                  setFilters({ triggerType: 'all', entityType: 'all', isActive: 'all', search: '' });
                  setSelectedLocation('');
                  setCurrentPage(1);
                }}
                variant="ghost"
                size="sm"
              >
                Clear Filters
              </StandardButton>
            </div>
          </div>
        )}
      </div>

      {/* Notifications Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className={`animate-spin w-8 h-8 border-4 border-${themeColor}-200 border-t-${fullColor} rounded-full mx-auto mb-4`}></div>
            <p className="text-gray-500">Loading notifications...</p>
          </div>
        ) : notifications.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <div className="flex flex-col items-center justify-center">
              <div className={`inline-flex p-4 rounded-full bg-${themeColor}-50 mb-4`}>
                <Bell className={`h-12 w-12 text-${themeColor}-400`} />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No notifications found</h3>
              <p className="text-gray-500 mb-6">
                {filters.search || filters.triggerType !== 'all' || filters.entityType !== 'all' || filters.isActive !== 'all'
                  ? 'Try adjusting your search or filters'
                  : 'Get started by creating your first email notification'}
              </p>
              <Link to="/admin/email/notifications/create">
                <StandardButton variant="primary" icon={Plus}>
                  Create Notification
                </StandardButton>
              </Link>
            </div>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-4 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Notification</th>
                    <th className="px-4 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Trigger</th>
                    <th className="px-4 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Entity</th>
                    <th className="px-4 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Recipients</th>
                    <th className="px-4 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {notifications.map((notification) => {
                    const TriggerIcon = getTriggerIcon(notification.trigger_type);
                    const EntityIcon = getEntityIcon(notification.entity_type);
                    return (
                      <tr key={notification.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-4">
                          <div>
                            <p className="font-medium text-gray-900 text-sm">{notification.name}</p>
                            {notification.location && (
                              <p className="text-xs text-gray-500 mt-0.5">{notification.location.name}</p>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${getTriggerColor()} border`}>
                            <TriggerIcon className="w-3.5 h-3.5" />
                            {formatTriggerType(notification.trigger_type)}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200 capitalize`}>
                            <EntityIcon className="w-3.5 h-3.5" />
                            {notification.entity_type}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-1">
                            <Users className="w-3.5 h-3.5 text-gray-400" />
                            <span className="text-sm text-gray-600">
                              {notification.recipient_types.length} type{notification.recipient_types.length !== 1 ? 's' : ''}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <button
                            onClick={() => handleToggleStatus(notification)}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                              notification.is_active
                                ? `bg-${themeColor}-100 text-${themeColor}-700 hover:bg-${themeColor}-200`
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                          >
                            {notification.is_active ? (
                              <>
                                <CheckCircle className="w-3.5 h-3.5" />
                                Active
                              </>
                            ) : (
                              <>
                                <XCircle className="w-3.5 h-3.5" />
                                Inactive
                              </>
                            )}
                          </button>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => setTestEmailModal(notification)}
                              className={`p-2 text-${fullColor} hover:text-${themeColor}-700 hover:bg-${themeColor}-50 rounded-lg transition-colors`}
                              title="Send Test Email"
                            >
                              <Send className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDuplicate(notification.id)}
                              className={`p-2 text-${fullColor} hover:text-${themeColor}-700 hover:bg-${themeColor}-50 rounded-lg transition-colors`}
                              title="Duplicate"
                            >
                              <Copy className="w-4 h-4" />
                            </button>
                            <Link
                              to={`/admin/email/notifications/${notification.id}`}
                              className="p-2 text-gray-600 hover:text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
                              title="View Details"
                            >
                              <Eye className="w-4 h-4" />
                            </Link>
                            <Link
                              to={`/admin/email/notifications/edit/${notification.id}`}
                              className={`p-2 text-${fullColor} hover:text-${themeColor}-700 hover:bg-${themeColor}-50 rounded-lg transition-colors`}
                              title="Edit"
                            >
                              <Edit className="w-4 h-4" />
                            </Link>
                            <button
                              onClick={() => setDeleteConfirm(notification.id)}
                              className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden divide-y divide-gray-100">
              {notifications.map((notification) => {
                const TriggerIcon = getTriggerIcon(notification.trigger_type);
                return (
                  <div key={notification.id} className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h3 className="font-medium text-gray-900">{notification.name}</h3>
                        {notification.location && (
                          <p className="text-xs text-gray-500">{notification.location.name}</p>
                        )}
                      </div>
                      <button
                        onClick={() => handleToggleStatus(notification)}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                          notification.is_active
                            ? `bg-${themeColor}-100 text-${themeColor}-700`
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {notification.is_active ? 'Active' : 'Inactive'}
                      </button>
                    </div>
                    <div className="flex items-center gap-2 mb-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${getTriggerColor()} border`}>
                        <TriggerIcon className="w-3 h-3" />
                        {formatTriggerType(notification.trigger_type)}
                      </span>
                      <span className="text-xs text-gray-500 capitalize">{notification.entity_type}</span>
                    </div>
                    <div className="flex items-center justify-between mt-3">
                      <span className="text-xs text-gray-500">
                        {notification.recipient_types.length} recipient type{notification.recipient_types.length !== 1 ? 's' : ''}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setTestEmailModal(notification)}
                          className={`p-2 text-${fullColor} hover:text-${themeColor}-700`}
                          title="Test"
                        >
                          <Send className="w-4 h-4" />
                        </button>
                        <Link
                          to={`/admin/email/notifications/${notification.id}`}
                          className="p-2 text-gray-500 hover:text-gray-700"
                        >
                          <Eye className="w-4 h-4" />
                        </Link>
                        <Link
                          to={`/admin/email/notifications/edit/${notification.id}`}
                          className="p-2 text-gray-500 hover:text-gray-700"
                        >
                          <Edit className="w-4 h-4" />
                        </Link>
                        <button
                          onClick={() => setDeleteConfirm(notification.id)}
                          className="p-2 text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
                <p className="text-sm text-gray-500">
                  Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems} notifications
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="p-2 rounded-lg border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-sm text-gray-600">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="p-2 rounded-lg border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-red-100 rounded-full">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Delete Notification</h3>
                <p className="text-sm text-gray-500">This action cannot be undone</p>
              </div>
            </div>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete this email notification? All associated logs will also be deleted.
            </p>
            <div className="flex items-center gap-3 justify-end">
              <StandardButton variant="secondary" onClick={() => setDeleteConfirm(null)}>
                Cancel
              </StandardButton>
              <StandardButton variant="danger" onClick={() => handleDelete(deleteConfirm)}>
                Delete Notification
              </StandardButton>
            </div>
          </div>
        </div>
      )}

      {/* Test Email Modal */}
      {testEmailModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className={`p-3 bg-${themeColor}-100 rounded-full`}>
                <Mail className={`w-6 h-6 text-${fullColor}`} />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Send Test Email</h3>
                <p className="text-sm text-gray-500">{testEmailModal.name}</p>
              </div>
            </div>
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <input
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="Enter test email address..."
                className={`w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-${themeColor}-600 focus:border-${themeColor}-600`}
              />
              <p className="mt-2 text-xs text-gray-500">
                A test email with sample data will be sent to this address.
              </p>
            </div>
            <div className="flex items-center gap-3 justify-end">
              <StandardButton 
                variant="secondary" 
                onClick={() => {
                  setTestEmailModal(null);
                  setTestEmail('');
                }}
              >
                Cancel
              </StandardButton>
              <StandardButton 
                variant="primary" 
                icon={Send}
                onClick={handleSendTestEmail}
                disabled={!testEmail.trim() || sendingTest}
              >
                {sendingTest ? 'Sending...' : 'Send Test'}
              </StandardButton>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
};

export default EmailNotifications;
