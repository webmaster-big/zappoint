import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Plus,
  RefreshCcw,
  Bell,
  Edit,
  Trash2,
  Eye,
  Copy,
  Send,
  Calendar,
  Users,
  Package,
  Ticket,
  CreditCard,
  Mail,
  CheckCircle,
  XCircle,
  RotateCcw,
  Shield,
  Sparkles,
  Download
} from 'lucide-react';
import { useThemeColor } from '../../../hooks/useThemeColor';
import { emailNotificationService } from '../../../services/EmailNotificationService';
import { locationService } from '../../../services/LocationService';
import StandardButton from '../../../components/ui/StandardButton';
import Pagination from '../../../components/ui/Pagination';
import Toast from '../../../components/ui/Toast';
import CounterAnimation from '../../../components/ui/CounterAnimation';
import { getStoredUser } from '../../../utils/storage';
import {
  AdminDataTable,
  AdminTableToolbar,
  BulkActionsBar,
  exportTableCsv,
  useAdminTable,
} from '../../../components/admin/table';
import type { AdminColumn, AdminFilterDef } from '../../../components/admin/table';
import type {
  EmailNotification,
  TriggerType,
  EntityType
} from '../../../types/EmailNotification.types';

const FALLBACK_TRIGGER_OPTIONS = [
  { value: 'booking_created', label: 'Booking Created' },
  { value: 'booking_confirmed', label: 'Booking Confirmed' },
  { value: 'booking_updated', label: 'Booking Updated' },
  { value: 'booking_cancelled', label: 'Booking Cancelled' },
  { value: 'booking_reminder', label: 'Booking Reminder' },
  { value: 'purchase_created', label: 'Purchase Created' },
  { value: 'purchase_confirmed', label: 'Purchase Confirmed' },
  { value: 'purchase_cancelled', label: 'Purchase Cancelled' },
  { value: 'payment_received', label: 'Payment Received' },
  { value: 'payment_failed', label: 'Payment Failed' },
  { value: 'payment_refunded', label: 'Payment Refunded' },
];

const EmailNotifications = () => {
  const { themeColor, fullColor } = useThemeColor();
  const currentUser = getStoredUser();
  const isCompanyAdmin = currentUser?.role === 'company_admin';

  const [notifications, setNotifications] = useState<EmailNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [locations, setLocations] = useState<Array<{ id: number; name: string }>>([]);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [resetConfirm, setResetConfirm] = useState<EmailNotification | null>(null);
  const [testEmailModal, setTestEmailModal] = useState<EmailNotification | null>(null);
  const [testEmail, setTestEmail] = useState('');
  const [sendingTest, setSendingTest] = useState(false);
  const [triggerTypes, setTriggerTypes] = useState<Record<string, string>>({});
  const itemsPerPage = 10;

  const stats = {
    total: notifications.length,
    active: notifications.filter(n => n.is_active).length,
    booking: notifications.filter(n => n.trigger_type.startsWith('booking_')).length,
    purchase: notifications.filter(n => n.trigger_type.startsWith('purchase_')).length,
  };

  const getTriggerIcon = (triggerType: TriggerType) => {
    if (triggerType.startsWith('booking_')) return Calendar;
    if (triggerType.startsWith('purchase_')) return Ticket;
    if (triggerType.startsWith('payment_')) return CreditCard;
    return Bell;
  };

  const getTriggerColor = () => {
    return `bg-${themeColor}-100 text-${themeColor}-700 border-${themeColor}-200`;
  };

  const getEntityIcon = (entityType: EntityType) => {
    if (entityType === 'package') return Package;
    if (entityType === 'attraction') return Ticket;
    return Users;
  };

  const formatTriggerType = (triggerType: TriggerType) => {
    return triggerTypes[triggerType] || triggerType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

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

  const loadNotifications = async () => {
    try {
      setLoading(true);
      let all: EmailNotification[] = [];
      let page = 1;
      let lastPage = 1;

      do {
        const response = await emailNotificationService.getAll({ page, per_page: 100 });
        if (!response.success) break;
        all = all.concat(response.data.data);
        lastPage = response.data.last_page;
        page++;
      } while (page <= lastPage);

      setNotifications(all);
    } catch (error) {
      console.error('Error fetching notifications:', error);
      setToast({ message: 'Failed to load email notifications', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, []);

  const handleDelete = async (id: number) => {
    try {
      const response = await emailNotificationService.delete(id);
      if (response.success) {
        setToast({ message: 'Notification deleted successfully', type: 'success' });
        loadNotifications();
      }
    } catch (error: unknown) {
      console.error('Error deleting notification:', error);
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Failed to delete notification';
      setToast({ message, type: 'error' });
    } finally {
      setDeleteConfirm(null);
    }
  };

  const handleResetDefault = async (notification: EmailNotification) => {
    try {
      const response = await emailNotificationService.resetDefault(notification.id);
      if (response.success) {
        setToast({ message: 'Reset to default template', type: 'success' });
        loadNotifications();
      }
    } catch (error) {
      console.error('Error resetting notification:', error);
      setToast({ message: 'Failed to reset notification', type: 'error' });
    } finally {
      setResetConfirm(null);
    }
  };

  const handleToggleStatus = async (notification: EmailNotification) => {
    try {
      const response = await emailNotificationService.toggleStatus(notification.id);
      if (response.success) {
        setToast({
          message: `Notification ${response.data.is_active ? 'activated' : 'deactivated'} successfully`,
          type: 'success'
        });
        loadNotifications();
      }
    } catch (error) {
      console.error('Error toggling status:', error);
      setToast({ message: 'Failed to toggle notification status', type: 'error' });
    }
  };

  const handleDuplicate = async (id: number) => {
    try {
      const response = await emailNotificationService.duplicate(id);
      if (response.success) {
        setToast({ message: 'Notification duplicated successfully', type: 'success' });
        loadNotifications();
      }
    } catch (error) {
      console.error('Error duplicating notification:', error);
      setToast({ message: 'Failed to duplicate notification', type: 'error' });
    }
  };

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

  const columns: AdminColumn<EmailNotification>[] = [
    {
      key: 'id',
      label: 'ID',
      group: 'Identifiers',
      sortable: true,
      sortValue: n => n.id,
      exportValue: n => n.id,
      defaultVisible: false,
      render: n => <span className="text-sm text-gray-900">#{n.id}</span>,
    },
    {
      key: 'name',
      label: 'Notification',
      group: 'Identifiers',
      sortable: true,
      lockVisible: true,
      sortValue: n => n.name,
      exportValue: n => n.name,
      render: n => (
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-medium text-gray-900 text-sm">{n.name}</p>
            {n.is_default ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-700 border border-blue-200">
                <Shield className="w-3 h-3" />
                Default
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-100 text-purple-700 border border-purple-200">
                <Sparkles className="w-3 h-3" />
                Custom
              </span>
            )}
            {n.is_default && (n.is_body_customized || n.is_subject_customized) && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-700 border border-amber-200">
                Edited
              </span>
            )}
          </div>
          {n.location && (
            <p className="text-xs text-gray-500 mt-0.5">{n.location.name}</p>
          )}
        </div>
      ),
    },
    {
      key: 'type',
      label: 'Type',
      group: 'Identifiers',
      sortable: true,
      sortValue: n => (n.is_default ? 'Default' : 'Custom'),
      exportValue: n => (n.is_default ? 'Default' : 'Custom'),
      defaultVisible: false,
      render: n => (
        <span className="text-sm text-gray-900">{n.is_default ? 'Default' : 'Custom'}</span>
      ),
    },
    {
      key: 'trigger',
      label: 'Trigger',
      group: 'Configuration',
      sortable: true,
      sortValue: n => formatTriggerType(n.trigger_type),
      exportValue: n => formatTriggerType(n.trigger_type),
      render: n => {
        const TriggerIcon = getTriggerIcon(n.trigger_type);
        return (
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${getTriggerColor()} border whitespace-nowrap`}>
            <TriggerIcon className="w-3.5 h-3.5" />
            {formatTriggerType(n.trigger_type)}
          </span>
        );
      },
    },
    {
      key: 'entity',
      label: 'Entity',
      group: 'Configuration',
      sortable: true,
      sortValue: n => n.entity_type,
      exportValue: n => n.entity_type,
      render: n => {
        const EntityIcon = getEntityIcon(n.entity_type);
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200 capitalize whitespace-nowrap">
            <EntityIcon className="w-3.5 h-3.5" />
            {n.entity_type}
          </span>
        );
      },
    },
    {
      key: 'location',
      label: 'Location',
      group: 'Configuration',
      sortable: true,
      sortValue: n => n.location?.name || '',
      exportValue: n => n.location?.name || 'All Locations',
      defaultVisible: false,
      render: n => (
        <span className="whitespace-nowrap text-sm text-gray-900">{n.location?.name || 'All Locations'}</span>
      ),
    },
    {
      key: 'recipients',
      label: 'Recipients',
      group: 'Recipients',
      sortable: true,
      sortValue: n => n.recipient_types.length,
      exportValue: n => n.recipient_types.join('; '),
      render: n => (
        <div className="flex items-center gap-1">
          <Users className="w-3.5 h-3.5 text-gray-400" />
          <span className="text-sm text-gray-600">
            {n.recipient_types.length} type{n.recipient_types.length !== 1 ? 's' : ''}
          </span>
        </div>
      ),
    },
    {
      key: 'subject',
      label: 'Subject',
      group: 'Content',
      sortable: true,
      sortValue: n => n.effective_subject || n.subject || '',
      exportValue: n => n.effective_subject || n.subject || '',
      defaultVisible: false,
      render: n => (
        <span className="text-sm text-gray-600 block max-w-xs truncate">
          {n.effective_subject || n.subject || '—'}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      group: 'Status',
      sortable: true,
      sortValue: n => (n.is_active ? 'Active' : 'Inactive'),
      exportValue: n => (n.is_active ? 'Active' : 'Inactive'),
      render: n => (
        <button
          onClick={() => handleToggleStatus(n)}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
            n.is_active
              ? `bg-${themeColor}-100 text-${themeColor}-700 hover:bg-${themeColor}-200`
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          {n.is_active ? (
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
      ),
    },
    {
      key: 'created',
      label: 'Created',
      group: 'Dates',
      sortable: true,
      sortValue: n => new Date(n.created_at || 0).getTime(),
      exportValue: n => (n.created_at ? new Date(n.created_at).toLocaleString() : ''),
      defaultVisible: false,
      render: n => (
        <span className="whitespace-nowrap text-sm text-gray-500">
          {n.created_at
            ? new Date(n.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
            : '—'}
        </span>
      ),
    },
    {
      key: 'updated',
      label: 'Updated',
      group: 'Dates',
      sortable: true,
      sortValue: n => new Date(n.updated_at || 0).getTime(),
      exportValue: n => (n.updated_at ? new Date(n.updated_at).toLocaleString() : ''),
      defaultVisible: false,
      render: n => (
        <span className="whitespace-nowrap text-sm text-gray-500">
          {n.updated_at
            ? new Date(n.updated_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
            : '—'}
        </span>
      ),
    },
  ];

  const triggerOptions = useMemo(() => {
    const entries = Object.entries(triggerTypes);
    if (entries.length > 0) {
      return entries.map(([value, label]) => ({ value, label }));
    }
    return FALLBACK_TRIGGER_OPTIONS;
  }, [triggerTypes]);

  const filterDefs: AdminFilterDef<EmailNotification>[] = useMemo(() => {
    const defs: AdminFilterDef<EmailNotification>[] = [];
    if (isCompanyAdmin && locations.length > 0) {
      defs.push({
        type: 'select',
        key: 'location',
        label: 'Location',
        allLabel: 'All Locations',
        options: locations.map(loc => ({ value: String(loc.id), label: loc.name })),
        predicate: (n, value) => String(n.location_id ?? '') === value,
      });
    }
    defs.push({
      type: 'select',
      key: 'trigger',
      label: 'Trigger Type',
      allLabel: 'All Triggers',
      options: triggerOptions,
      predicate: (n, value) => n.trigger_type === value,
    });
    defs.push({
      type: 'select',
      key: 'entity',
      label: 'Entity Type',
      allLabel: 'All Entities',
      options: [
        { value: 'package', label: 'Packages Only' },
        { value: 'attraction', label: 'Attractions Only' },
      ],
      predicate: (n, value) => n.entity_type === value,
    });
    defs.push({
      type: 'select',
      key: 'status',
      label: 'Status',
      allLabel: 'All Statuses',
      options: [
        { value: 'active', label: 'Active' },
        { value: 'inactive', label: 'Inactive' },
      ],
      predicate: (n, value) => (value === 'active' ? n.is_active : !n.is_active),
    });
    defs.push({
      type: 'select',
      key: 'type',
      label: 'Type',
      allLabel: 'All Types',
      options: [
        { value: 'default', label: 'Default Only' },
        { value: 'custom', label: 'Custom Only' },
      ],
      predicate: (n, value) => (value === 'default' ? !!n.is_default : !n.is_default),
    });
    defs.push({
      type: 'daterange',
      key: 'created',
      label: 'Created Date',
      getDate: n => n.created_at,
    });
    return defs;
  }, [isCompanyAdmin, locations, triggerOptions]);

  const table = useAdminTable<EmailNotification>({
    data: notifications,
    columns,
    getRowId: n => String(n.id),
    storageKey: 'email_notifications',
    filterDefs,
    searchFields: n => [
      n.id,
      n.name,
      n.description,
      n.trigger_type,
      formatTriggerType(n.trigger_type),
      n.entity_type,
      n.effective_subject || n.subject,
      n.location?.name,
      n.recipient_types.join(' '),
    ],
    defaultSort: (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime(),
    itemsPerPage,
  });

  const handleBulkSetActive = async (active: boolean) => {
    if (table.selectedIds.length === 0) return;
    const targets = notifications.filter(
      n => table.selectedIds.includes(String(n.id)) && n.is_active !== active
    );
    if (targets.length === 0) {
      setToast({ message: `Selected notifications are already ${active ? 'active' : 'inactive'}`, type: 'info' });
      table.clearSelection();
      return;
    }
    try {
      await Promise.all(targets.map(n => emailNotificationService.toggleStatus(n.id)));
      setToast({
        message: `${targets.length} notification(s) ${active ? 'activated' : 'deactivated'} successfully`,
        type: 'success'
      });
      table.clearSelection();
      loadNotifications();
    } catch (error) {
      console.error('Error updating notifications:', error);
      setToast({ message: 'Failed to update some notifications', type: 'error' });
      loadNotifications();
    }
  };

  const exportToCsv = () => {
    exportTableCsv({
      filename: `email-notifications-${new Date().toISOString().split('T')[0]}.csv`,
      columns,
      rows: table.filteredRows,
      extraColumns: [
        { label: 'Description', value: n => n.description || '' },
        { label: 'Default Key', value: n => n.default_key || '' },
        { label: 'Edited', value: n => (n.is_default && (n.is_body_customized || n.is_subject_customized) ? 'Yes' : 'No') },
        { label: 'Custom Emails', value: n => n.custom_emails?.join('; ') || '' },
        { label: 'Include QR Code', value: n => (n.include_qr_code ? 'Yes' : 'No') },
        { label: 'Send Before (hours)', value: n => n.send_before_hours ?? '' },
        { label: 'Send After (hours)', value: n => n.send_after_hours ?? '' },
        { label: 'Email Template', value: n => n.email_template?.name || '' },
        { label: 'Entity IDs', value: n => n.entity_ids?.join('; ') || '' },
        { label: 'Logs Count', value: n => n.logs_count ?? '' },
      ],
    });
  };

  const emptyState = (
    <div className="flex flex-col items-center justify-center py-4">
      <div className={`inline-flex p-4 rounded-full bg-${themeColor}-50 mb-4`}>
        <Bell className={`h-12 w-12 text-${themeColor}-400`} />
      </div>
      <h3 className="text-lg font-medium text-gray-900 mb-2">No notifications found</h3>
      <p className="text-gray-500 mb-6">
        {table.searchInput || table.activeFilterCount > 0
          ? 'Try adjusting your search or filters'
          : 'Get started by creating your first email notification'}
      </p>
      <Link to="/admin/email/notifications/create">
        <StandardButton variant="primary" icon={Plus}>
          Create Notification
        </StandardButton>
      </Link>
    </div>
  );

  return (
    <div className="px-6 py-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Email Notifications</h1>
          <p className="text-gray-600 mt-2">Automated email notifications for bookings, purchases, and payments</p>
        </div>
        <div className="flex items-center gap-3 mt-4 sm:mt-0">
          <StandardButton
            variant="secondary"
            icon={RefreshCcw}
            onClick={() => loadNotifications()}
            disabled={loading}
          >
            Refresh
          </StandardButton>
          <StandardButton
            variant="secondary"
            icon={Download}
            onClick={exportToCsv}
          >
            Export CSV
          </StandardButton>
          <Link to="/admin/email/notifications/create">
            <StandardButton variant="primary" icon={Plus}>
              Create Notification
            </StandardButton>
          </Link>
        </div>
      </div>

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

      <AdminTableToolbar
        table={table}
        searchPlaceholder="Search notifications by name, trigger, subject..."
        onRefresh={() => loadNotifications()}
      />

      <BulkActionsBar table={table} itemLabel="notification(s)">
        <StandardButton
          variant="primary"
          size="sm"
          icon={CheckCircle}
          onClick={() => handleBulkSetActive(true)}
        >
          Activate
        </StandardButton>
        <StandardButton
          variant="secondary"
          size="sm"
          icon={XCircle}
          onClick={() => handleBulkSetActive(false)}
        >
          Deactivate
        </StandardButton>
      </BulkActionsBar>

      <div className="hidden md:block">
        <AdminDataTable
          table={table}
          loading={loading && notifications.length === 0}
          selectable
          itemLabel="notifications"
          emptyState={emptyState}
          renderActions={(notification) => (
            <div className="flex items-center justify-end gap-1">
              <button
                onClick={() => setTestEmailModal(notification)}
                className={`p-2 text-${fullColor} hover:text-${themeColor}-700 hover:bg-${themeColor}-50 rounded-lg transition-colors`}
                title="Send Test Email"
              >
                <Send className="w-4 h-4" />
              </button>
              {notification.is_default &&
                (notification.is_body_customized || notification.is_subject_customized) && (
                  <button
                    onClick={() => setResetConfirm(notification)}
                    className="p-2 text-amber-600 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-colors"
                    title="Reset to default template"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                )}
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
              {!notification.is_default && (
                <button
                  onClick={() => setDeleteConfirm(notification.id)}
                  className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
        />
      </div>

      <div className="md:hidden bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading && notifications.length === 0 ? (
          <div className="p-8 text-center">
            <div className={`animate-spin w-8 h-8 border-4 border-${themeColor}-200 border-t-${fullColor} rounded-full mx-auto mb-4`}></div>
            <p className="text-gray-500">Loading notifications...</p>
          </div>
        ) : table.rows.length === 0 ? (
          <div className="px-6 py-12 text-center">{emptyState}</div>
        ) : (
          <>
            <div className="divide-y divide-gray-100">
              {table.rows.map((notification) => {
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
                          disabled={notification.is_default}
                          style={notification.is_default ? { opacity: 0.3, cursor: 'not-allowed' } : {}}
                          title={notification.is_default ? 'Default templates cannot be deleted' : 'Delete'}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {table.totalPages > 1 && (
              <div className="px-4 py-3 border-t border-gray-100">
                <Pagination
                  currentPage={table.page}
                  totalPages={table.totalPages}
                  onPageChange={table.setPage}
                  totalItems={table.totalItems}
                  itemsPerPage={table.itemsPerPage}
                  itemLabel="notifications"
                />
              </div>
            )}
          </>
        )}
      </div>

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

      {resetConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-amber-100 rounded-full">
                <RotateCcw className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Reset to Default</h3>
                <p className="text-sm text-gray-500">{resetConfirm.name}</p>
              </div>
            </div>
            <p className="text-gray-600 mb-6">
              This will discard your custom subject and body and restore the original seeded template.
              This action cannot be undone.
            </p>
            <div className="flex items-center gap-3 justify-end">
              <StandardButton variant="secondary" onClick={() => setResetConfirm(null)}>
                Cancel
              </StandardButton>
              <StandardButton variant="primary" icon={RotateCcw} onClick={() => handleResetDefault(resetConfirm)}>
                Reset Template
              </StandardButton>
            </div>
          </div>
        </div>
      )}

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
