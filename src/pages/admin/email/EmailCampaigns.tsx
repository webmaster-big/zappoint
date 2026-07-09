import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Plus,
  RefreshCcw,
  Send,
  Eye,
  CheckCircle,
  Clock,
  XCircle,
  AlertTriangle,
  Ban,
  Mail,
  Users,
  BarChart3,
  Trash2,
  Download
} from 'lucide-react';
import { useThemeColor } from '../../../hooks/useThemeColor';
import { emailCampaignService } from '../../../services/EmailCampaignService';
import { locationService } from '../../../services/LocationService';
import type { Location } from '../../../services/LocationService';
import LocationSelector from '../../../components/admin/LocationSelector';
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
  EmailCampaign,
  EmailCampaignFilters,
  EmailCampaignStatus,
  EmailCampaignStatistics,
  RecipientType,
} from '../../../types/EmailCampaign.types';

const RECIPIENT_TYPE_LABELS: Record<RecipientType, string> = {
  customers: 'Customers',
  attendants: 'Attendants',
  company_admin: 'Company Admins',
  location_managers: 'Location Managers',
  custom: 'Custom Emails',
};

const EmailCampaigns = () => {
  const { themeColor, fullColor } = useThemeColor();
  const currentUser = getStoredUser();
  const isCompanyAdmin = currentUser?.role === 'company_admin';

  const [campaigns, setCampaigns] = useState<EmailCampaign[]>([]);
  const [statistics, setStatistics] = useState<EmailCampaignStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  const [locations, setLocations] = useState<Location[]>([]);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [cancelConfirm, setCancelConfirm] = useState<number | null>(null);

  const statusConfig: Record<EmailCampaignStatus, { color: string; icon: typeof Clock; label: string }> = {
    pending: { color: 'bg-yellow-100 text-yellow-800', icon: Clock, label: 'Pending' },
    sending: { color: 'bg-blue-100 text-blue-800', icon: Send, label: 'Sending' },
    completed: { color: 'bg-green-100 text-green-800', icon: CheckCircle, label: 'Completed' },
    failed: { color: 'bg-red-100 text-red-800', icon: XCircle, label: 'Failed' },
    cancelled: { color: 'bg-gray-100 text-gray-600', icon: Ban, label: 'Cancelled' }
  };

  useEffect(() => {
    const fetchLocations = async () => {
      if (!isCompanyAdmin) return;
      try {
        const response = await locationService.getLocations();
        const locationsArray = Array.isArray(response.data) ? response.data : [];
        setLocations(locationsArray);
      } catch (error) {
        console.error('Error fetching locations:', error);
        setLocations([]);
      }
    };
    fetchLocations();
  }, [isCompanyAdmin]);

  const loadCampaigns = useCallback(async () => {
    try {
      setLoading(true);

      const baseParams: EmailCampaignFilters = { per_page: 100 };
      if (selectedLocation) {
        baseParams.location_id = parseInt(selectedLocation);
      }

      let allCampaigns: EmailCampaign[] = [];
      let page = 1;
      let lastPage = 1;

      do {
        const response = await emailCampaignService.getCampaigns({ ...baseParams, page });
        if (!response.success) break;
        allCampaigns = allCampaigns.concat(response.data.data);
        lastPage = response.data.last_page;
        page++;
      } while (page <= lastPage);

      setCampaigns(allCampaigns);
    } catch (error) {
      console.error('Error fetching campaigns:', error);
      setToast({ message: 'Failed to load email campaigns', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [selectedLocation]);

  const fetchStatistics = useCallback(async () => {
    try {
      const params: { location_id?: number } = {};
      if (selectedLocation) {
        params.location_id = parseInt(selectedLocation);
      }
      const response = await emailCampaignService.getStatistics(params);
      if (response.success) {
        setStatistics(response.data);
      }
    } catch (error) {
      console.error('Error fetching statistics:', error);
    }
  }, [selectedLocation]);

  useEffect(() => {
    loadCampaigns();
    fetchStatistics();
  }, [loadCampaigns, fetchStatistics]);

  const handleDelete = async (id: number) => {
    try {
      const response = await emailCampaignService.deleteCampaign(id);
      if (response.success) {
        setToast({ message: 'Campaign deleted successfully', type: 'success' });
        loadCampaigns();
        fetchStatistics();
      }
    } catch (error) {
      console.error('Error deleting campaign:', error);
      setToast({ message: 'Failed to delete campaign', type: 'error' });
    } finally {
      setDeleteConfirm(null);
    }
  };

  const handleCancel = async (id: number) => {
    try {
      const response = await emailCampaignService.cancelCampaign(id);
      if (response.success) {
        setToast({ message: 'Campaign cancelled successfully', type: 'success' });
        loadCampaigns();
        fetchStatistics();
      }
    } catch (error) {
      console.error('Error cancelling campaign:', error);
      setToast({ message: 'Failed to cancel campaign', type: 'error' });
    } finally {
      setCancelConfirm(null);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const successRate = (campaign: EmailCampaign) =>
    campaign.total_recipients > 0
      ? Math.round((campaign.sent_count / campaign.total_recipients) * 100)
      : 0;

  const creatorName = (campaign: EmailCampaign) =>
    campaign.creator
      ? `${campaign.creator.first_name} ${campaign.creator.last_name}`
      : campaign.created_by
        ? `User #${campaign.created_by}`
        : '';

  const recipientTypesLabel = (campaign: EmailCampaign) =>
    (campaign.recipient_types || []).map(t => RECIPIENT_TYPE_LABELS[t] || t).join(', ');

  const columns: AdminColumn<EmailCampaign>[] = [
    {
      key: 'id',
      label: 'Campaign #',
      group: 'Identifiers',
      sortable: true,
      sortValue: c => c.id,
      exportValue: c => c.id,
      defaultVisible: false,
      render: c => <span className="text-sm text-gray-900">#{c.id}</span>,
    },
    {
      key: 'campaign',
      label: 'Campaign',
      group: 'Campaign',
      sortable: true,
      sortValue: c => c.name,
      exportValue: c => c.name,
      render: c => (
        <div>
          <p className="font-medium text-gray-900 text-sm">{c.name}</p>
          <p className="text-xs text-gray-500 truncate max-w-md mt-0.5">{c.subject}</p>
        </div>
      ),
    },
    {
      key: 'subject',
      label: 'Subject',
      group: 'Campaign',
      sortable: true,
      sortValue: c => c.subject,
      exportValue: c => c.subject,
      defaultVisible: false,
      render: c => <span className="text-sm text-gray-900 truncate max-w-md block">{c.subject}</span>,
    },
    {
      key: 'template',
      label: 'Template',
      group: 'Campaign',
      sortable: true,
      sortValue: c => c.template?.name || '',
      exportValue: c => c.template?.name || (c.email_template_id ? `Template #${c.email_template_id}` : ''),
      defaultVisible: false,
      render: c => (
        <span className="whitespace-nowrap text-sm text-gray-900">
          {c.template?.name || (c.email_template_id ? `Template #${c.email_template_id}` : '—')}
        </span>
      ),
    },
    {
      key: 'location',
      label: 'Location',
      group: 'Campaign',
      sortable: true,
      sortValue: c => c.location?.name || '',
      exportValue: c => c.location?.name || (c.location_id ? String(c.location_id) : ''),
      defaultVisible: false,
      render: c => <span className="whitespace-nowrap text-sm text-gray-900">{c.location?.name || '—'}</span>,
    },
    {
      key: 'createdBy',
      label: 'Created By',
      group: 'Campaign',
      sortable: true,
      sortValue: c => creatorName(c),
      exportValue: c => creatorName(c),
      defaultVisible: false,
      render: c => <span className="whitespace-nowrap text-sm text-gray-900">{creatorName(c) || '—'}</span>,
    },
    {
      key: 'recipients',
      label: 'Recipients',
      group: 'Recipients',
      sortable: true,
      sortValue: c => c.total_recipients,
      exportValue: c => c.total_recipients,
      render: c => (
        <div className="flex items-center gap-1.5">
          <Users className={`w-4 h-4 text-${themeColor}-500`} />
          <span className="font-medium text-gray-900 text-sm">{c.total_recipients}</span>
        </div>
      ),
    },
    {
      key: 'recipientTypes',
      label: 'Recipient Types',
      group: 'Recipients',
      sortable: true,
      sortValue: c => recipientTypesLabel(c),
      exportValue: c => recipientTypesLabel(c),
      defaultVisible: false,
      render: c => <span className="text-xs text-gray-600">{recipientTypesLabel(c) || '—'}</span>,
    },
    {
      key: 'status',
      label: 'Status',
      group: 'Status',
      sortable: true,
      sortValue: c => c.status,
      exportValue: c => statusConfig[c.status]?.label || c.status,
      render: c => {
        const StatusIcon = statusConfig[c.status]?.icon || Clock;
        return (
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusConfig[c.status]?.color || 'bg-gray-100 text-gray-700'}`}>
            <StatusIcon className="w-3.5 h-3.5" />
            {statusConfig[c.status]?.label || c.status}
          </span>
        );
      },
    },
    {
      key: 'progress',
      label: 'Progress',
      group: 'Status',
      sortable: true,
      sortValue: c => successRate(c),
      exportValue: c => `${c.sent_count}/${c.total_recipients}${c.failed_count > 0 ? ` (${c.failed_count} failed)` : ''}`,
      render: c => (
        <div className="flex items-center gap-2">
          <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden max-w-[120px]">
            <div
              className={`h-full rounded-full ${c.failed_count > 0 ? 'bg-yellow-500' : `bg-${themeColor}-500`}`}
              style={{ width: `${successRate(c)}%` }}
            />
          </div>
          <span className="text-xs text-gray-600 font-medium whitespace-nowrap">
            {c.sent_count}/{c.total_recipients}
          </span>
          {c.failed_count > 0 && (
            <span className="text-xs text-red-500 font-medium whitespace-nowrap">
              ({c.failed_count} failed)
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'scheduledAt',
      label: 'Scheduled At',
      group: 'Dates',
      sortable: true,
      sortValue: c => (c.scheduled_at ? new Date(c.scheduled_at).getTime() : 0),
      exportValue: c => (c.scheduled_at ? new Date(c.scheduled_at).toLocaleString() : ''),
      defaultVisible: false,
      render: c => (
        <span className="whitespace-nowrap text-sm text-gray-500">
          {c.scheduled_at ? formatDate(c.scheduled_at) : '-'}
        </span>
      ),
    },
    {
      key: 'sentAt',
      label: 'Sent At',
      group: 'Dates',
      sortable: true,
      sortValue: c => (c.sent_at ? new Date(c.sent_at).getTime() : 0),
      exportValue: c => (c.sent_at ? new Date(c.sent_at).toLocaleString() : ''),
      render: c => (
        <span className="whitespace-nowrap text-sm text-gray-500">
          {c.sent_at ? formatDate(c.sent_at) : '-'}
        </span>
      ),
    },
    {
      key: 'completedAt',
      label: 'Completed At',
      group: 'Dates',
      sortable: true,
      sortValue: c => (c.completed_at ? new Date(c.completed_at).getTime() : 0),
      exportValue: c => (c.completed_at ? new Date(c.completed_at).toLocaleString() : ''),
      defaultVisible: false,
      render: c => (
        <span className="whitespace-nowrap text-sm text-gray-500">
          {c.completed_at ? formatDate(c.completed_at) : '-'}
        </span>
      ),
    },
    {
      key: 'createdAt',
      label: 'Created At',
      group: 'Dates',
      sortable: true,
      sortValue: c => (c.created_at ? new Date(c.created_at).getTime() : 0),
      exportValue: c => (c.created_at ? new Date(c.created_at).toLocaleString() : ''),
      defaultVisible: false,
      render: c => (
        <span className="whitespace-nowrap text-sm text-gray-500">
          {c.created_at ? formatDate(c.created_at) : '-'}
        </span>
      ),
    },
    {
      key: 'updatedAt',
      label: 'Updated At',
      group: 'Dates',
      sortable: true,
      sortValue: c => (c.updated_at ? new Date(c.updated_at).getTime() : 0),
      exportValue: c => (c.updated_at ? new Date(c.updated_at).toLocaleString() : ''),
      defaultVisible: false,
      render: c => (
        <span className="whitespace-nowrap text-sm text-gray-500">
          {c.updated_at ? formatDate(c.updated_at) : '-'}
        </span>
      ),
    },
  ];

  const templateOptions = useMemo(() => {
    const map = new Map<string, string>();
    campaigns.forEach(c => {
      if (c.email_template_id) {
        map.set(String(c.email_template_id), c.template?.name || `Template #${c.email_template_id}`);
      }
    });
    return [...map.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [campaigns]);

  const creatorOptions = useMemo(() => {
    const map = new Map<string, string>();
    campaigns.forEach(c => {
      if (c.created_by) {
        map.set(
          String(c.created_by),
          c.creator ? `${c.creator.first_name} ${c.creator.last_name}` : `User #${c.created_by}`
        );
      }
    });
    return [...map.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [campaigns]);

  const filterDefs: AdminFilterDef<EmailCampaign>[] = useMemo(() => [
    {
      type: 'select',
      key: 'status',
      label: 'Status',
      allLabel: 'All Statuses',
      options: [
        { value: 'pending', label: 'Pending' },
        { value: 'sending', label: 'Sending' },
        { value: 'completed', label: 'Completed' },
        { value: 'failed', label: 'Failed' },
        { value: 'cancelled', label: 'Cancelled' },
      ],
      predicate: (c, value) => c.status === value,
    },
    {
      type: 'select',
      key: 'recipientType',
      label: 'Recipient Type',
      allLabel: 'All Recipient Types',
      options: Object.entries(RECIPIENT_TYPE_LABELS).map(([value, label]) => ({ value, label })),
      predicate: (c, value) => (c.recipient_types || []).includes(value as RecipientType),
    },
    {
      type: 'select',
      key: 'template',
      label: 'Template',
      allLabel: 'All Templates',
      options: [{ value: 'none', label: 'No Template' }, ...templateOptions],
      predicate: (c, value) =>
        value === 'none' ? !c.email_template_id : String(c.email_template_id || '') === value,
    },
    {
      type: 'select',
      key: 'createdBy',
      label: 'Created By',
      allLabel: 'All Creators',
      options: creatorOptions,
      predicate: (c, value) => String(c.created_by || '') === value,
    },
    {
      type: 'select',
      key: 'sendState',
      label: 'Send State',
      allLabel: 'All Send States',
      options: [
        { value: 'scheduled', label: 'Scheduled (not sent)' },
        { value: 'sent', label: 'Sent' },
        { value: 'unsent', label: 'Not Sent' },
      ],
      predicate: (c, value) => {
        if (value === 'scheduled') return !!c.scheduled_at && !c.sent_at;
        if (value === 'sent') return !!c.sent_at;
        return !c.sent_at;
      },
    },
    {
      type: 'select',
      key: 'failures',
      label: 'Failures',
      allLabel: 'All Campaigns',
      options: [
        { value: 'yes', label: 'Has Failures' },
        { value: 'no', label: 'No Failures' },
      ],
      predicate: (c, value) => (value === 'yes' ? c.failed_count > 0 : c.failed_count === 0),
    },
    {
      type: 'daterange',
      key: 'createdDate',
      label: 'Created Date',
      getDate: c => c.created_at,
    },
    {
      type: 'daterange',
      key: 'scheduledDate',
      label: 'Scheduled Date',
      getDate: c => c.scheduled_at,
    },
    {
      type: 'daterange',
      key: 'sentDate',
      label: 'Sent Date',
      getDate: c => c.sent_at,
    },
    {
      type: 'daterange',
      key: 'completedDate',
      label: 'Completed Date',
      getDate: c => c.completed_at,
    },
  ], [templateOptions, creatorOptions]);

  const table = useAdminTable<EmailCampaign>({
    data: campaigns,
    columns,
    getRowId: c => String(c.id),
    storageKey: 'email_campaigns',
    filterDefs,
    searchFields: c => [
      c.id,
      c.name,
      c.subject,
      creatorName(c),
      c.creator?.email,
      c.template?.name,
      c.location?.name,
      c.status,
    ],
    defaultSort: (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime(),
    itemsPerPage: 10,
  });

  const exportCampaignsCsv = (rows: EmailCampaign[]) => {
    exportTableCsv({
      filename: `email-campaigns-export-${new Date().toISOString().split('T')[0]}.csv`,
      columns,
      rows,
      extraColumns: [
        { label: 'Sent Count', value: c => c.sent_count },
        { label: 'Failed Count', value: c => c.failed_count },
        { label: 'Success Rate (%)', value: c => successRate(c) },
        { label: 'Custom Emails', value: c => (c.custom_emails || []).join('; ') },
        { label: 'Creator Email', value: c => c.creator?.email || '' },
        { label: 'Company', value: c => c.company?.company_name || '' },
      ],
    });
  };

  const handleExportSelected = () => {
    const selected = new Set(table.selectedIds);
    exportCampaignsCsv(campaigns.filter(c => selected.has(String(c.id))));
  };

  const hasActiveCriteria = !!table.searchInput || table.activeFilterCount > 0;

  const emptyState = (
    <div className="flex flex-col items-center justify-center py-4">
      <div className={`inline-flex p-4 rounded-full bg-${themeColor}-50 mb-4`}>
        <Send className={`h-12 w-12 text-${themeColor}-400`} />
      </div>
      <h3 className="text-lg font-medium text-gray-900 mb-2">No campaigns found</h3>
      <p className="text-gray-500 mb-6">
        {hasActiveCriteria
          ? 'Try adjusting your search or filters'
          : 'Get started by creating your first email campaign'}
      </p>
      <Link to="/admin/email/campaigns/create">
        <StandardButton variant="primary" icon={Plus}>
          Create Campaign
        </StandardButton>
      </Link>
    </div>
  );

  const renderRowActions = (campaign: EmailCampaign) => (
    <div className="flex items-center gap-1">
      <Link
        to={`/admin/email/campaigns/${campaign.id}`}
        className="p-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
        title="View Details"
      >
        <Eye className="w-4 h-4" />
      </Link>
      {(campaign.status === 'pending' || campaign.status === 'sending') && (
        <button
          onClick={() => setCancelConfirm(campaign.id)}
          className="p-2 text-orange-600 hover:text-orange-700 hover:bg-orange-50 rounded-lg transition-colors"
          title="Cancel Campaign"
        >
          <Ban className="w-4 h-4" />
        </button>
      )}
      {(campaign.status === 'completed' || campaign.status === 'cancelled' || campaign.status === 'failed') && (
        <button
          onClick={() => setDeleteConfirm(campaign.id)}
          className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
          title="Delete"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      )}
    </div>
  );

  return (
    <div className="px-6 py-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Email Campaigns</h1>
          <p className="text-gray-600 mt-2">Send bulk emails to customers and staff</p>
        </div>
        <div className="flex items-center gap-3 mt-4 sm:mt-0 flex-wrap">
          {isCompanyAdmin && locations.length > 0 && (
            <LocationSelector
              locations={locations}
              selectedLocation={selectedLocation}
              onLocationChange={setSelectedLocation}
              themeColor={themeColor}
              fullColor={fullColor}
              variant="compact"
              showAllOption={true}
            />
          )}
          <Link to="/admin/email/templates">
            <StandardButton variant="secondary" icon={Mail}>
              Templates
            </StandardButton>
          </Link>
          <StandardButton
            variant="secondary"
            icon={RefreshCcw}
            onClick={() => { loadCampaigns(); fetchStatistics(); }}
            disabled={loading}
          >
            Refresh
          </StandardButton>
          <StandardButton
            variant="secondary"
            icon={Download}
            onClick={() => exportCampaignsCsv(table.filteredRows)}
          >
            Export CSV
          </StandardButton>
          <Link to="/admin/email/campaigns/create">
            <StandardButton variant="primary" icon={Plus}>
              New Campaign
            </StandardButton>
          </Link>
        </div>
      </div>

      {statistics && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex flex-col gap-2 hover:shadow-md transition-shadow min-h-[120px]">
            <div className="flex items-center gap-2">
              <div className={`p-2 rounded-lg bg-${themeColor}-100`}>
                <Send size={20} className={`text-${fullColor}`} />
              </div>
              <span className="text-base font-semibold text-gray-800">Total Campaigns</span>
            </div>
            <div className="flex items-end gap-2 mt-2">
              <CounterAnimation value={statistics.total_campaigns} className="text-2xl font-bold text-gray-900" />
            </div>
            <p className="text-xs mt-1 text-gray-400">All time campaigns created</p>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex flex-col gap-2 hover:shadow-md transition-shadow min-h-[120px]">
            <div className="flex items-center gap-2">
              <div className={`p-2 rounded-lg bg-${themeColor}-100`}>
                <CheckCircle size={20} className={`text-${fullColor}`} />
              </div>
              <span className="text-base font-semibold text-gray-800">Emails Sent</span>
            </div>
            <div className="flex items-end gap-2 mt-2">
              <CounterAnimation value={statistics.total_emails_sent} className="text-2xl font-bold text-gray-900" />
            </div>
            <p className="text-xs mt-1 text-gray-400">Successfully delivered emails</p>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex flex-col gap-2 hover:shadow-md transition-shadow min-h-[120px]">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-red-100">
                <XCircle size={20} className="text-red-600" />
              </div>
              <span className="text-base font-semibold text-gray-800">Failed Emails</span>
            </div>
            <div className="flex items-end gap-2 mt-2">
              <CounterAnimation value={statistics.total_emails_failed} className="text-2xl font-bold text-gray-900" />
            </div>
            <p className="text-xs mt-1 text-gray-400">Delivery failures</p>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex flex-col gap-2 hover:shadow-md transition-shadow min-h-[120px]">
            <div className="flex items-center gap-2">
              <div className={`p-2 rounded-lg bg-${themeColor}-100`}>
                <BarChart3 size={20} className={`text-${fullColor}`} />
              </div>
              <span className="text-base font-semibold text-gray-800">Success Rate</span>
            </div>
            <div className="flex items-end gap-2 mt-2">
              <span className="text-2xl font-bold text-green-600">{statistics.success_rate.toFixed(1)}%</span>
            </div>
            <p className="text-xs mt-1 text-gray-400">Email delivery success rate</p>
          </div>
        </div>
      )}

      <AdminTableToolbar
        table={table}
        searchPlaceholder="Search campaigns by name or subject..."
        onRefresh={() => { loadCampaigns(); fetchStatistics(); }}
      />

      <BulkActionsBar table={table} itemLabel="campaign(s)">
        <StandardButton
          variant="secondary"
          size="md"
          icon={Download}
          onClick={handleExportSelected}
        >
          Export Selected
        </StandardButton>
      </BulkActionsBar>

      <div className="hidden md:block">
        <AdminDataTable
          table={table}
          loading={loading && campaigns.length === 0}
          selectable
          itemLabel="campaigns"
          emptyState={emptyState}
          renderActions={renderRowActions}
        />
      </div>

      <div className="md:hidden bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading && campaigns.length === 0 ? (
          <div className="p-8 text-center">
            <div className={`animate-spin w-8 h-8 border-4 border-${themeColor}-200 border-t-${fullColor} rounded-full mx-auto mb-4`}></div>
            <p className="text-gray-500">Loading campaigns...</p>
          </div>
        ) : table.rows.length === 0 ? (
          <div className="px-6 py-12 text-center">{emptyState}</div>
        ) : (
          <>
            <div className="divide-y divide-gray-100">
              {table.rows.map((campaign) => {
                const StatusIcon = statusConfig[campaign.status]?.icon || Clock;
                return (
                  <div key={campaign.id} className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h3 className="font-medium text-gray-900">{campaign.name}</h3>
                        <p className="text-sm text-gray-500 truncate">{campaign.subject}</p>
                      </div>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig[campaign.status]?.color || 'bg-gray-100 text-gray-700'}`}>
                        <StatusIcon className="w-3 h-3" />
                        {statusConfig[campaign.status]?.label || campaign.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-500 mb-3">
                      <span className="flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        {campaign.total_recipients} recipients
                      </span>
                      <span>
                        {campaign.sent_count} sent
                        {campaign.failed_count > 0 && `, ${campaign.failed_count} failed`}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-400">
                        {campaign.sent_at ? formatDate(campaign.sent_at) : 'Not sent yet'}
                      </span>
                      <div className="flex items-center gap-1">
                        <Link
                          to={`/admin/email/campaigns/${campaign.id}`}
                          className="p-2 text-gray-500 hover:text-gray-700"
                        >
                          <Eye className="w-4 h-4" />
                        </Link>
                        {(campaign.status === 'completed' || campaign.status === 'cancelled' || campaign.status === 'failed') && (
                          <button
                            onClick={() => setDeleteConfirm(campaign.id)}
                            className="p-2 text-red-500 hover:text-red-700"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
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
                  itemLabel="campaigns"
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
                <h3 className="text-lg font-semibold text-gray-900">Delete Campaign</h3>
                <p className="text-sm text-gray-500">This action cannot be undone</p>
              </div>
            </div>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete this email campaign? All campaign data and logs will be permanently removed.
            </p>
            <div className="flex items-center gap-3 justify-end">
              <StandardButton variant="secondary" onClick={() => setDeleteConfirm(null)}>
                Cancel
              </StandardButton>
              <StandardButton variant="danger" onClick={() => handleDelete(deleteConfirm)}>
                Delete Campaign
              </StandardButton>
            </div>
          </div>
        </div>
      )}

      {cancelConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-orange-100 rounded-full">
                <AlertTriangle className="w-6 h-6 text-orange-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Cancel Campaign</h3>
                <p className="text-sm text-gray-500">Stop sending remaining emails</p>
              </div>
            </div>
            <p className="text-gray-600 mb-6">
              Are you sure you want to cancel this campaign? Emails that have already been sent will not be affected, but remaining emails will not be sent.
            </p>
            <div className="flex items-center gap-3 justify-end">
              <StandardButton variant="secondary" onClick={() => setCancelConfirm(null)}>
                Keep Sending
              </StandardButton>
              <StandardButton variant="danger" onClick={() => handleCancel(cancelConfirm)}>
                Cancel Campaign
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

export default EmailCampaigns;
