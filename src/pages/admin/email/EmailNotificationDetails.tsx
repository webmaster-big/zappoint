// src/pages/admin/email/EmailNotificationDetails.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Edit,
  Trash2,
  Send,
  Copy,
  Power,
  Bell,
  Calendar,
  Ticket,
  CreditCard,
  Package,
  Users,
  Clock,
  QrCode,
  Mail,
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCcw,
  ChevronLeft,
  ChevronRight,
  X,
  Eye,
  RotateCcw
} from 'lucide-react';
import { useThemeColor } from '../../../hooks/useThemeColor';
import { emailNotificationService } from '../../../services/EmailNotificationService';
import StandardButton from '../../../components/ui/StandardButton';
import Toast from '../../../components/ui/Toast';

import type { 
  EmailNotification, 
  EmailNotificationLog,
  TriggerType,
  EntityType,
  RecipientType
} from '../../../types/EmailNotification.types';

const EmailNotificationDetails: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { themeColor, fullColor } = useThemeColor();

  // State
  const [notification, setNotification] = useState<EmailNotification | null>(null);
  const [logs, setLogs] = useState<EmailNotificationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [logsLoading, setLogsLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [testEmailModal, setTestEmailModal] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [sendingTest, setSendingTest] = useState(false);
  const [previewModal, setPreviewModal] = useState(false);
  
  // Logs pagination
  const [logsPage, setLogsPage] = useState(1);
  const [logsTotalPages, setLogsTotalPages] = useState(1);
  const [logsTotalItems, setLogsTotalItems] = useState(0);
  const logsPerPage = 10;

  // Trigger type labels
  const triggerTypeLabels: Record<string, string> = {
    booking_created: 'Booking Created',
    booking_confirmed: 'Booking Confirmed',
    booking_updated: 'Booking Updated',
    booking_rescheduled: 'Booking Rescheduled',
    booking_cancelled: 'Booking Cancelled',
    booking_checked_in: 'Booking Checked In',
    booking_completed: 'Booking Completed',
    booking_reminder: 'Booking Reminder',
    booking_followup: 'Booking Follow-up',
    booking_no_show: 'Booking No-Show',
    payment_received: 'Payment Received',
    payment_failed: 'Payment Failed',
    payment_refunded: 'Payment Refunded',
    payment_partial: 'Partial Payment',
    payment_pending: 'Payment Pending',
    purchase_created: 'Purchase Created',
    purchase_confirmed: 'Purchase Confirmed',
    purchase_cancelled: 'Purchase Cancelled',
    purchase_completed: 'Purchase Completed',
    purchase_checked_in: 'Purchase Checked In',
    purchase_refunded: 'Purchase Refunded',
    purchase_reminder: 'Purchase Reminder',
    purchase_followup: 'Purchase Follow-up',
  };

  // Recipient type labels
  const recipientTypeLabels: Record<RecipientType, string> = {
    customer: 'Customer',
    staff: 'Staff',
    company_admin: 'Company Admin',
    location_manager: 'Location Manager',
    custom: 'Custom Email',
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

  // Get log status config
  const getLogStatusConfig = (status: string) => {
    switch (status) {
      case 'sent':
        return { color: `bg-${themeColor}-100 text-${themeColor}-700`, icon: CheckCircle, label: 'Sent' };
      case 'failed':
        return { color: 'bg-red-100 text-red-700', icon: XCircle, label: 'Failed' };
      case 'pending':
      default:
        return { color: 'bg-gray-100 text-gray-700', icon: Clock, label: 'Pending' };
    }
  };

  // Fetch notification
  useEffect(() => {
    const fetchNotification = async () => {
      if (!id) return;

      try {
        setLoading(true);
        const response = await emailNotificationService.getById(parseInt(id));
        if (response.success && response.data) {
          setNotification(response.data);
        }
      } catch (error) {
        console.error('Error fetching notification:', error);
        setToast({ message: 'Failed to load notification', type: 'error' });
      } finally {
        setLoading(false);
      }
    };
    fetchNotification();
  }, [id]);

  // Fetch logs
  const fetchLogs = useCallback(async () => {
    if (!id) return;

    try {
      setLogsLoading(true);
      const response = await emailNotificationService.getLogs(parseInt(id), {
        page: logsPage,
        per_page: logsPerPage
      });
      if (response.success && response.data) {
        setLogs(response.data.data);
        setLogsTotalPages(response.data.last_page);
        setLogsTotalItems(response.data.total);
      }
    } catch (error) {
      console.error('Error fetching logs:', error);
    } finally {
      setLogsLoading(false);
    }
  }, [id, logsPage]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Handle delete
  const handleDelete = async () => {
    if (!id) return;

    try {
      const response = await emailNotificationService.delete(parseInt(id));
      if (response.success) {
        setToast({ message: 'Notification deleted successfully', type: 'success' });
        setTimeout(() => {
          navigate('/admin/email/notifications');
        }, 1500);
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
      setToast({ message: 'Failed to delete notification', type: 'error' });
    } finally {
      setDeleteConfirm(false);
    }
  };

  // Handle toggle status
  const handleToggleStatus = async () => {
    if (!notification) return;

    try {
      const response = await emailNotificationService.toggleStatus(notification.id);
      if (response.success) {
        setNotification(response.data);
        setToast({
          message: `Notification ${response.data.is_active ? 'activated' : 'deactivated'} successfully`,
          type: 'success'
        });
      }
    } catch (error) {
      console.error('Error toggling status:', error);
      setToast({ message: 'Failed to toggle notification status', type: 'error' });
    }
  };

  // Handle duplicate
  const handleDuplicate = async () => {
    if (!notification) return;

    try {
      const response = await emailNotificationService.duplicate(notification.id);
      if (response.success) {
        setToast({ message: 'Notification duplicated successfully', type: 'success' });
        navigate(`/admin/email/notifications/edit/${response.data.id}`);
      }
    } catch (error) {
      console.error('Error duplicating notification:', error);
      setToast({ message: 'Failed to duplicate notification', type: 'error' });
    }
  };

  // Handle send test email
  const handleSendTestEmail = async () => {
    if (!notification || !testEmail.trim()) return;

    try {
      setSendingTest(true);
      const response = await emailNotificationService.sendTestEmail(notification.id, {
        test_email: testEmail.trim()
      });
      if (response.success) {
        setToast({ message: 'Test email sent successfully', type: 'success' });
        setTestEmailModal(false);
        setTestEmail('');
        fetchLogs(); // Refresh logs
      }
    } catch (error) {
      console.error('Error sending test email:', error);
      setToast({ message: 'Failed to send test email', type: 'error' });
    } finally {
      setSendingTest(false);
    }
  };

  // Handle resend log
  const handleResendLog = async (logId: number) => {
    if (!notification) return;

    try {
      const response = await emailNotificationService.resendLog(notification.id, logId);
      if (response.success) {
        setToast({ message: 'Email resent successfully', type: 'success' });
        fetchLogs();
      }
    } catch (error) {
      console.error('Error resending email:', error);
      setToast({ message: 'Failed to resend email', type: 'error' });
    }
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="px-6 py-8">
        <div className="flex items-center justify-center h-64">
          <div className={`animate-spin w-8 h-8 border-4 border-${themeColor}-200 border-t-${fullColor} rounded-full`}></div>
        </div>
      </div>
    );
  }

  if (!notification) {
    return (
      <div className="px-6 py-8">
        <div className="text-center py-12">
          <Bell className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h2 className="text-lg font-medium text-gray-900">Notification not found</h2>
          <p className="text-gray-500 mt-2">The notification you're looking for doesn't exist.</p>
          <Link to="/admin/email/notifications" className="mt-4 inline-block">
            <StandardButton variant="primary">Back to Notifications</StandardButton>
          </Link>
        </div>
      </div>
    );
  }

  const TriggerIcon = getTriggerIcon(notification.trigger_type);
  const EntityIcon = getEntityIcon(notification.entity_type);

  return (
    <div className="px-6 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/admin/email/notifications')}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold text-gray-900">{notification.name}</h1>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                notification.is_active
                  ? `bg-${themeColor}-100 text-${themeColor}-700`
                  : 'bg-gray-100 text-gray-600'
              }`}>
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
              </span>
            </div>
            <p className="text-gray-600 mt-1">
              Created on {formatDate(notification.created_at)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <StandardButton
            variant="secondary"
            icon={Send}
            onClick={() => setTestEmailModal(true)}
          >
            Send Test
          </StandardButton>
          <StandardButton
            variant="secondary"
            icon={Copy}
            onClick={handleDuplicate}
          >
            Duplicate
          </StandardButton>
          <StandardButton
            variant={notification.is_active ? 'secondary' : 'primary'}
            icon={Power}
            onClick={handleToggleStatus}
          >
            {notification.is_active ? 'Deactivate' : 'Activate'}
          </StandardButton>
          <Link to={`/admin/email/notifications/edit/${notification.id}`}>
            <StandardButton variant="primary" icon={Edit}>
              Edit
            </StandardButton>
          </Link>
          <StandardButton
            variant="danger"
            icon={Trash2}
            onClick={() => setDeleteConfirm(true)}
          >
            Delete
          </StandardButton>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Configuration */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Configuration</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Trigger Type */}
              <div>
                <label className="text-sm font-medium text-gray-500">Trigger Type</label>
                <div className="mt-1 flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium ${getTriggerColor()} border`}>
                    <TriggerIcon className="w-4 h-4" />
                    {triggerTypeLabels[notification.trigger_type] || notification.trigger_type}
                  </span>
                </div>
              </div>

              {/* Entity Type */}
              <div>
                <label className="text-sm font-medium text-gray-500">Applies To</label>
                <div className="mt-1 flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 border border-gray-200 capitalize">
                    <EntityIcon className="w-4 h-4" />
                    {notification.entity_type === 'all' ? 'All Entities' : notification.entity_type + 's'}
                  </span>
                </div>
              </div>

              {/* Location */}
              <div>
                <label className="text-sm font-medium text-gray-500">Location</label>
                <p className="mt-1 text-gray-900">
                  {notification.location?.name || 'All Locations'}
                </p>
              </div>

              {/* Include QR Code */}
              <div>
                <label className="text-sm font-medium text-gray-500">QR Code</label>
                <div className="mt-1 flex items-center gap-2">
                  {notification.include_qr_code ? (
                    <span className={`inline-flex items-center gap-1.5 text-${fullColor}`}>
                      <QrCode className="w-4 h-4" />
                      Included
                    </span>
                  ) : (
                    <span className="text-gray-500">Not included</span>
                  )}
                </div>
              </div>

              {/* Reminder/Follow-up timing */}
              {(notification.send_before_hours || notification.send_after_hours) && (
                <div className="md:col-span-2">
                  <label className="text-sm font-medium text-gray-500">Timing</label>
                  <div className={`mt-1 flex items-center gap-2 text-${themeColor}-700 bg-${themeColor}-50 p-2 rounded-lg`}>
                    <Clock className="w-4 h-4" />
                    <span>
                      {notification.send_before_hours && `${notification.send_before_hours} hours before event`}
                      {notification.send_after_hours && `${notification.send_after_hours} hours after event`}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Recipients */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-gray-600" />
              Recipients
            </h2>
            
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {notification.recipient_types.map((type) => (
                  <span
                    key={type}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-${themeColor}-50 text-${themeColor}-700 border border-${themeColor}-200`}
                  >
                    <Users className="w-3.5 h-3.5" />
                    {recipientTypeLabels[type] || type}
                  </span>
                ))}
              </div>

              {notification.custom_emails && notification.custom_emails.length > 0 && (
                <div className="pt-3 border-t border-gray-200">
                  <label className="text-sm font-medium text-gray-500">Custom Email Addresses</label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {notification.custom_emails.map((email) => (
                      <span
                        key={email}
                        className="inline-flex items-center gap-1.5 px-2 py-1 bg-gray-100 rounded text-sm text-gray-700"
                      >
                        <Mail className="w-3.5 h-3.5" />
                        {email}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Email Content */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Email Content</h2>
              <StandardButton
                variant="secondary"
                size="sm"
                icon={Eye}
                onClick={() => setPreviewModal(true)}
              >
                Preview
              </StandardButton>
            </div>
            
            {notification.email_template ? (
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">Using template:</p>
                <p className="font-medium text-gray-900">{notification.email_template.name}</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Subject</label>
                  <p className="mt-1 text-gray-900">{notification.subject || '(No subject)'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Body Preview</label>
                  <div 
                    className="mt-2 prose prose-sm max-w-none border border-gray-200 rounded-lg p-4 bg-gray-50 max-h-48 overflow-y-auto"
                    dangerouslySetInnerHTML={{ __html: notification.body || '<p class="text-gray-400">(No content)</p>' }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Logs */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                Notification Logs
                <span className="ml-2 text-sm font-normal text-gray-500">({logsTotalItems} total)</span>
              </h2>
              <StandardButton
                variant="secondary"
                size="sm"
                icon={RefreshCcw}
                onClick={fetchLogs}
                disabled={logsLoading}
              >
                Refresh
              </StandardButton>
            </div>

            {logsLoading ? (
              <div className="p-8 text-center">
                <div className={`animate-spin w-6 h-6 border-4 border-${themeColor}-200 border-t-${fullColor} rounded-full mx-auto`}></div>
              </div>
            ) : logs.length === 0 ? (
              <div className="p-8 text-center">
                <Mail className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No emails sent yet</p>
              </div>
            ) : (
              <>
                <div className="divide-y divide-gray-100">
                  {logs.map((log) => {
                    const statusConfig = getLogStatusConfig(log.status);
                    const StatusIcon = statusConfig.icon;
                    return (
                      <div key={log.id} className="p-4 hover:bg-gray-50 transition-colors">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig.color}`}>
                                <StatusIcon className="w-3 h-3" />
                                {statusConfig.label}
                              </span>
                              <span className="text-sm text-gray-500">
                                {recipientTypeLabels[log.recipient_type] || log.recipient_type}
                              </span>
                            </div>
                            <p className="text-sm font-medium text-gray-900 mt-1">{log.recipient_email}</p>
                            <p className="text-xs text-gray-500 mt-0.5">{log.subject}</p>
                            {log.error_message && (
                              <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" />
                                {log.error_message}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500">
                              {log.sent_at ? formatDate(log.sent_at) : formatDate(log.created_at)}
                            </span>
                            {log.status === 'failed' && (
                              <button
                                onClick={() => handleResendLog(log.id)}
                                className={`p-1.5 text-${fullColor} hover:bg-${themeColor}-50 rounded transition-colors`}
                                title="Resend"
                              >
                                <RotateCcw className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Logs Pagination */}
                {logsTotalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
                    <p className="text-sm text-gray-500">
                      Page {logsPage} of {logsTotalPages}
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setLogsPage(prev => Math.max(1, prev - 1))}
                        disabled={logsPage === 1}
                        className="p-2 rounded-lg border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setLogsPage(prev => Math.min(logsTotalPages, prev + 1))}
                        disabled={logsPage === logsTotalPages}
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
        </div>

        {/* Sidebar - Stats */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 sticky top-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Statistics</h3>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-gray-500" />
                  <span className="text-sm text-gray-600">Total Sent</span>
                </div>
                <span className="text-lg font-semibold text-gray-900">{logsTotalItems}</span>
              </div>

              <div className={`flex items-center justify-between p-3 bg-${themeColor}-50 rounded-lg`}>
                <div className="flex items-center gap-2">
                  <CheckCircle className={`w-4 h-4 text-${fullColor}`} />
                  <span className={`text-sm text-${themeColor}-700`}>Successful</span>
                </div>
                <span className={`text-lg font-semibold text-${themeColor}-700`}>
                  {logs.filter(l => l.status === 'sent').length}
                </span>
              </div>

              <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-red-600" />
                  <span className="text-sm text-red-700">Failed</span>
                </div>
                <span className="text-lg font-semibold text-red-700">
                  {logs.filter(l => l.status === 'failed').length}
                </span>
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-gray-600" />
                  <span className="text-sm text-gray-700">Pending</span>
                </div>
                <span className="text-lg font-semibold text-gray-700">
                  {logs.filter(l => l.status === 'pending').length}
                </span>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-gray-200">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Quick Actions</h4>
              <div className="space-y-2">
                <StandardButton
                  variant="secondary"
                  icon={Send}
                  onClick={() => setTestEmailModal(true)}
                  className="w-full"
                >
                  Send Test Email
                </StandardButton>
                <Link to={`/admin/email/notifications/edit/${notification.id}`} className="block">
                  <StandardButton variant="secondary" icon={Edit} className="w-full">
                    Edit Notification
                  </StandardButton>
                </Link>
              </div>
            </div>
          </div>
        </div>
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
              Are you sure you want to delete "{notification.name}"? All associated logs will also be deleted.
            </p>
            <div className="flex items-center gap-3 justify-end">
              <StandardButton variant="secondary" onClick={() => setDeleteConfirm(false)}>
                Cancel
              </StandardButton>
              <StandardButton variant="danger" onClick={handleDelete}>
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
                <p className="text-sm text-gray-500">{notification.name}</p>
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
                  setTestEmailModal(false);
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

      {/* Preview Modal */}
      {previewModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Email Preview</h3>
                <p className="text-sm text-gray-500">{notification.name}</p>
              </div>
              <button
                onClick={() => setPreviewModal(false)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <div className="mb-4">
                <label className="text-sm font-medium text-gray-500">Subject</label>
                <p className="text-gray-900 mt-1">{notification.subject || notification.email_template?.subject || '(No subject)'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Body</label>
                <div 
                  className="mt-2 prose prose-sm max-w-none border border-gray-200 rounded-lg p-4 bg-gray-50"
                  dangerouslySetInnerHTML={{ __html: notification.body || '<p class="text-gray-400">(No content)</p>' }}
                />
              </div>
              {notification.include_qr_code && (
                <div className="mt-4 p-4 bg-gray-100 rounded-lg text-center">
                  <QrCode className="w-16 h-16 mx-auto text-gray-400" />
                  <p className="text-sm text-gray-500 mt-2">QR Code will appear here</p>
                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-200 bg-gray-50">
              <StandardButton variant="secondary" onClick={() => setPreviewModal(false)}>
                Close
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

export default EmailNotificationDetails;
