import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Plus,
  RefreshCcw,
  FileText,
  Edit,
  Trash2,
  Eye,
  X,
  CheckCircle,
  Clock,
  Archive,
  Download,
  LayoutTemplate,
  CopyPlus
} from 'lucide-react';
import { useThemeColor } from '../../../hooks/useThemeColor';
import { emailCampaignService } from '../../../services/EmailCampaignService';
import { locationService } from '../../../services/LocationService';
import StandardButton from '../../../components/ui/StandardButton';
import Toast from '../../../components/ui/Toast';
import CounterAnimation from '../../../components/ui/CounterAnimation';
import { getStoredUser } from '../../../utils/storage';
import { requestErrorMessage } from '../../../utils/requestError';
import {
  EMAIL_TEMPLATE_CATEGORIES,
  EVENT_PHOTOS_CATEGORY,
  canManageEventPhotoEmails,
  emailTemplateCategoryLabel,
  isCompanyLevelRole,
  isSharedEventPhotoTemplate,
  templateCoversLocation,
  templateLocationSummary,
} from '../../../utils/emailTemplateOptions';
import {
  AdminDataTable,
  AdminTableToolbar,
  BulkActionsBar,
  exportTableCsv,
  useAdminTable,
} from '../../../components/admin/table';
import type { AdminColumn, AdminFilterDef } from '../../../components/admin/table';
import type { EmailTemplate, EmailTemplateStatus } from '../../../types/EmailCampaign.types';

const EmailTemplates: React.FC = () => {
  const { themeColor, fullColor } = useThemeColor();
  const navigate = useNavigate();
  const currentUser = getStoredUser();
  const isCompanyLevel = isCompanyLevelRole(currentUser?.role);
  const canEventPhotos = canManageEventPhotoEmails(currentUser?.role);
  const [duplicatingId, setDuplicatingId] = useState<number | null>(null);
  const [bulkUpdating, setBulkUpdating] = useState(false);

  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [locations, setLocations] = useState<Array<{ id: number; name: string }>>([]);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<EmailTemplate | null>(null);

  const templateStats = {
    total: templates.length,
    active: templates.filter(t => t.status === 'active').length,
    draft: templates.filter(t => t.status === 'draft').length,
    archived: templates.filter(t => t.status === 'archived').length
  };

  const statusConfig: Record<EmailTemplateStatus, { color: string; icon: React.ElementType; label: string }> = {
    draft: { color: 'bg-yellow-100 text-yellow-800', icon: Clock, label: 'Draft' },
    active: { color: 'bg-green-100 text-green-800', icon: CheckCircle, label: 'Active' },
    archived: { color: 'bg-gray-100 text-gray-600', icon: Archive, label: 'Archived' }
  };

  useEffect(() => {
    const fetchLocations = async () => {
      if (isCompanyLevel) {
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
  }, [isCompanyLevel]);

  const fetchTemplates = useCallback(async () => {
    try {
      setLoading(true);
      let allTemplates: EmailTemplate[] = [];
      let page = 1;
      let lastPage = 1;

      do {
        const response = await emailCampaignService.getTemplates({ page, per_page: 100 });
        if (!response.success) break;
        allTemplates = allTemplates.concat(response.data.data);
        lastPage = response.data.last_page;
        page++;
      } while (page <= lastPage);

      setTemplates(allTemplates);
    } catch (error) {
      console.error('Error fetching templates:', error);
      setToast({ message: 'Failed to load email templates', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const handleDelete = async (id: number) => {
    try {
      const response = await emailCampaignService.deleteTemplate(id);
      if (response.success) {
        setToast({ message: 'Template deleted successfully', type: 'success' });
        fetchTemplates();
      }
    } catch (error) {
      console.error('Error deleting template:', error);
      setToast({ message: requestErrorMessage(error, 'Failed to delete template'), type: 'error' });
    } finally {
      setDeleteConfirm(null);
    }
  };

  const handleDuplicate = async (template: EmailTemplate) => {
    try {
      setDuplicatingId(template.id);
      const response = await emailCampaignService.duplicateTemplate(template.id);
      if (response.success && response.data) {
        navigate(`/admin/email/templates/edit/${response.data.id}`);
      }
    } catch (error) {
      console.error('Error duplicating template:', error);
      setToast({ message: requestErrorMessage(error, 'The template could not be copied'), type: 'error' });
    } finally {
      setDuplicatingId(null);
    }
  };

  const canDuplicate = (template: EmailTemplate) =>
    (template.category !== EVENT_PHOTOS_CATEGORY || canEventPhotos) && (isCompanyLevel || !isSharedEventPhotoTemplate(template));

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const creatorName = (t: EmailTemplate) =>
    t.creator ? `${t.creator.first_name} ${t.creator.last_name}` : '';

  const columns: AdminColumn<EmailTemplate>[] = [
    {
      key: 'id',
      label: 'ID',
      group: 'Identifiers',
      sortable: true,
      sortValue: t => t.id,
      exportValue: t => t.id,
      defaultVisible: false,
      render: t => <span className="text-sm text-gray-900">#{t.id}</span>,
    },
    {
      key: 'template',
      label: 'Template',
      group: 'Template',
      sortable: true,
      sortValue: t => t.name,
      exportValue: t => t.name,
      render: t => (
        <div>
          <p className="font-medium text-gray-900 text-sm">{t.name}</p>
          <p className="text-xs text-gray-500 truncate max-w-md mt-0.5">{t.subject}</p>
        </div>
      ),
    },
    {
      key: 'subject',
      label: 'Subject',
      group: 'Template',
      sortable: true,
      sortValue: t => t.subject,
      exportValue: t => t.subject,
      defaultVisible: false,
      render: t => <span className="text-sm text-gray-900 truncate max-w-md block">{t.subject}</span>,
    },
    {
      key: 'category',
      label: 'Category',
      group: 'Template',
      sortable: true,
      sortValue: t => emailTemplateCategoryLabel(t.category),
      exportValue: t => emailTemplateCategoryLabel(t.category),
      render: t => (
        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-${themeColor}-50 text-${themeColor}-700 border border-${themeColor}-200`}>
          {emailTemplateCategoryLabel(t.category)}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      group: 'Status',
      sortable: true,
      sortValue: t => t.status,
      exportValue: t => t.status,
      render: t => {
        const StatusIcon = statusConfig[t.status]?.icon || Clock;
        return (
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusConfig[t.status]?.color || 'bg-gray-100 text-gray-700'}`}>
            <StatusIcon className="w-3.5 h-3.5" />
            {statusConfig[t.status]?.label || t.status}
          </span>
        );
      },
    },
    {
      key: 'location',
      label: 'Locations',
      group: 'Ownership',
      sortable: true,
      sortValue: t => templateLocationSummary(t),
      exportValue: t => (t.all_locations ? 'Every location' : (t.location_names ?? []).join('; ') || templateLocationSummary(t)),
      render: t => (
        <span className="text-sm text-gray-900" title={t.all_locations ? undefined : (t.location_names ?? []).join(', ')}>
          {templateLocationSummary(t)}
        </span>
      ),
    },
    {
      key: 'creator',
      label: 'Created By',
      group: 'Ownership',
      sortable: true,
      sortValue: t => creatorName(t),
      exportValue: t => creatorName(t),
      defaultVisible: false,
      render: t => <span className="text-sm text-gray-900">{creatorName(t) || '—'}</span>,
    },
    {
      key: 'created',
      label: 'Created',
      group: 'Dates',
      sortable: true,
      sortValue: t => new Date(t.created_at || 0).getTime(),
      exportValue: t => (t.created_at ? new Date(t.created_at).toLocaleString() : ''),
      render: t => <span className="whitespace-nowrap text-sm text-gray-500">{formatDate(t.created_at)}</span>,
    },
    {
      key: 'updated',
      label: 'Updated',
      group: 'Dates',
      sortable: true,
      sortValue: t => new Date(t.updated_at || 0).getTime(),
      exportValue: t => (t.updated_at ? new Date(t.updated_at).toLocaleString() : ''),
      defaultVisible: false,
      render: t => <span className="whitespace-nowrap text-sm text-gray-500">{formatDate(t.updated_at)}</span>,
    },
  ];

  const filterDefs: AdminFilterDef<EmailTemplate>[] = useMemo(() => {
    const defs: AdminFilterDef<EmailTemplate>[] = [
      {
        type: 'select',
        key: 'status',
        label: 'Status',
        allLabel: 'All Statuses',
        options: [
          { value: 'draft', label: 'Draft' },
          { value: 'active', label: 'Active' },
          { value: 'archived', label: 'Archived' },
        ],
        predicate: (t, value) => t.status === value,
      },
      {
        type: 'select',
        key: 'category',
        label: 'Category',
        allLabel: 'All Categories',
        options: EMAIL_TEMPLATE_CATEGORIES,
        predicate: (t, value) => (t.category || '') === value,
      },
      {
        type: 'daterange',
        key: 'created',
        label: 'Created Date',
        getDate: t => t.created_at,
      },
      {
        type: 'daterange',
        key: 'updated',
        label: 'Updated Date',
        getDate: t => t.updated_at,
      },
    ];
    if (isCompanyLevel && locations.length > 0) {
      defs.splice(2, 0, {
        type: 'select',
        key: 'location',
        label: 'Location',
        allLabel: 'All Locations',
        options: locations.map(loc => ({ value: String(loc.id), label: loc.name })),
        predicate: (t, value) => templateCoversLocation(t, Number(value)),
      });
    }
    return defs;
  }, [isCompanyLevel, locations]);

  const table = useAdminTable<EmailTemplate>({
    data: templates,
    columns,
    getRowId: t => String(t.id),
    storageKey: 'email_templates',
    filterDefs,
    searchFields: t => [
      t.id,
      t.name,
      t.subject,
      t.category,
      emailTemplateCategoryLabel(t.category),
      t.status,
      creatorName(t),
      templateLocationSummary(t),
      ...(t.location_names ?? []),
    ],
    defaultSort: (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime(),
    itemsPerPage: 10,
  });

  const handleBulkStatusChange = async (newStatus: EmailTemplateStatus) => {
    const ids = [...table.selectedIds];
    if (ids.length === 0 || bulkUpdating) return;
    setBulkUpdating(true);
    const failures: unknown[] = [];
    for (const id of ids) {
      try {
        await emailCampaignService.updateTemplateStatus(Number(id), newStatus);
      } catch (error) {
        failures.push(error);
      }
    }
    if (failures.length === 0) {
      setToast({ message: `${ids.length} template(s) updated successfully`, type: 'success' });
    } else {
      console.error('Error updating templates:', failures);
      const updated = ids.length - failures.length;
      setToast({
        message: `${updated} updated, ${failures.length} not changed. ${requestErrorMessage(failures[0], 'Some templates could not be updated.')}`,
        type: 'error'
      });
    }
    setBulkUpdating(false);
    table.clearSelection();
    fetchTemplates();
  };

  const exportToCsv = () => {
    exportTableCsv({
      filename: `email-templates-export-${new Date().toISOString().split('T')[0]}.csv`,
      columns,
      rows: table.filteredRows,
      extraColumns: [
        { label: 'Body (HTML)', value: t => t.body },
        { label: 'Company', value: t => t.company?.company_name || '' },
        { label: 'Location IDs', value: t => (t.all_locations ? '' : (t.location_ids ?? []).join('; ')) },
        { label: 'Creator Email', value: t => t.creator?.email || '' },
      ],
    });
  };

  return (
    <div className="px-6 py-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Email Templates</h1>
          <p className="text-gray-600 mt-2">Create and manage reusable email templates</p>
        </div>
        <div className="flex items-center gap-3 mt-4 sm:mt-0">
          <StandardButton
            variant="secondary"
            icon={RefreshCcw}
            onClick={() => fetchTemplates()}
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
          <Link to="/admin/email/templates/create">
            <StandardButton variant="primary" icon={Plus}>
              Create Template
            </StandardButton>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex flex-col gap-2 hover:shadow-md transition-shadow min-h-[120px]">
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-lg bg-${themeColor}-100`}>
              <LayoutTemplate size={20} className={`text-${fullColor}`} />
            </div>
            <span className="text-base font-semibold text-gray-800">Total Templates</span>
          </div>
          {loading ? (
            <div className="animate-pulse space-y-2 mt-2">
              <div className="h-8 bg-gray-200 rounded w-16"></div>
              <div className="h-3 bg-gray-200 rounded w-20"></div>
            </div>
          ) : (
            <>
              <div className="flex items-end gap-2 mt-2">
                <CounterAnimation value={templateStats.total} className="text-2xl font-bold text-gray-900" />
              </div>
              <p className="text-xs mt-1 text-gray-400">All templates in system</p>
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
                <CounterAnimation value={templateStats.active} className="text-2xl font-bold text-gray-900" />
              </div>
              <p className="text-xs mt-1 text-gray-400">Ready to use in campaigns</p>
            </>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex flex-col gap-2 hover:shadow-md transition-shadow min-h-[120px]">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-yellow-100">
              <Clock size={20} className="text-yellow-600" />
            </div>
            <span className="text-base font-semibold text-gray-800">Draft</span>
          </div>
          {loading ? (
            <div className="animate-pulse space-y-2 mt-2">
              <div className="h-8 bg-gray-200 rounded w-16"></div>
              <div className="h-3 bg-gray-200 rounded w-20"></div>
            </div>
          ) : (
            <>
              <div className="flex items-end gap-2 mt-2">
                <CounterAnimation value={templateStats.draft} className="text-2xl font-bold text-gray-900" />
              </div>
              <p className="text-xs mt-1 text-gray-400">Work in progress</p>
            </>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex flex-col gap-2 hover:shadow-md transition-shadow min-h-[120px]">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-gray-100">
              <Archive size={20} className="text-gray-600" />
            </div>
            <span className="text-base font-semibold text-gray-800">Archived</span>
          </div>
          {loading ? (
            <div className="animate-pulse space-y-2 mt-2">
              <div className="h-8 bg-gray-200 rounded w-16"></div>
              <div className="h-3 bg-gray-200 rounded w-20"></div>
            </div>
          ) : (
            <>
              <div className="flex items-end gap-2 mt-2">
                <CounterAnimation value={templateStats.archived} className="text-2xl font-bold text-gray-900" />
              </div>
              <p className="text-xs mt-1 text-gray-400">No longer in use</p>
            </>
          )}
        </div>
      </div>

      <AdminTableToolbar
        table={table}
        searchPlaceholder="Search templates by name, subject, or category..."
        onRefresh={() => fetchTemplates()}
      />

      <BulkActionsBar table={table} itemLabel="template(s)">
        <select
          onChange={(e) => {
            if (e.target.value) {
              handleBulkStatusChange(e.target.value as EmailTemplateStatus);
            }
          }}
          disabled={bulkUpdating}
          className={`border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-${themeColor}-400 disabled:opacity-60`}
        >
          <option value="">Change Status</option>
          <option value="draft">Mark as Draft</option>
          <option value="active">Mark as Active</option>
          <option value="archived">Archive</option>
        </select>
      </BulkActionsBar>

      <AdminDataTable
        table={table}
        loading={loading && templates.length === 0}
        selectable
        itemLabel="templates"
        emptyState={
          <div className="flex flex-col items-center justify-center py-4">
            <div className={`inline-flex p-4 rounded-full bg-${themeColor}-50 mb-4`}>
              <FileText className={`h-12 w-12 text-${themeColor}-400`} />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No templates found</h3>
            <p className="text-gray-500 mb-6">
              {table.searchInput || table.activeFilterCount > 0
                ? 'Try adjusting your search or filters'
                : 'Get started by creating your first email template'}
            </p>
            <Link to="/admin/email/templates/create">
              <StandardButton variant="primary" icon={Plus}>
                Create Template
              </StandardButton>
            </Link>
          </div>
        }
        renderActions={(template) => (
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPreviewTemplate(template)}
              className="p-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
              title="Preview"
            >
              <Eye className="w-4 h-4" />
            </button>
            <Link
              to={`/admin/email/templates/edit/${template.id}`}
              className="p-2 text-green-600 hover:text-green-700 hover:bg-green-50 rounded-lg transition-colors"
              title={template.can_manage === false ? 'View' : 'Edit'}
            >
              <Edit className="w-4 h-4" />
            </Link>
            {canDuplicate(template) && (
              <button
                onClick={() => void handleDuplicate(template)}
                disabled={duplicatingId !== null}
                className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                title={isCompanyLevel ? 'Duplicate' : 'Duplicate for my location'}
              >
                <CopyPlus className="w-4 h-4" />
              </button>
            )}
            {template.can_manage !== false && (
              <button
                onClick={() => setDeleteConfirm(template.id)}
                className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                title="Delete"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      />

      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-red-100 rounded-full">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Delete Template</h3>
                <p className="text-sm text-gray-500">This action cannot be undone</p>
              </div>
            </div>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete this email template? Any campaigns using this template will not be affected.
            </p>
            <div className="flex items-center gap-3 justify-end">
              <StandardButton variant="secondary" onClick={() => setDeleteConfirm(null)}>
                Cancel
              </StandardButton>
              <StandardButton variant="danger" onClick={() => handleDelete(deleteConfirm)}>
                Delete Template
              </StandardButton>
            </div>
          </div>
        </div>
      )}

      {previewTemplate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{previewTemplate.name}</h3>
                <p className="text-sm text-gray-500">Template Preview</p>
              </div>
              <button
                onClick={() => setPreviewTemplate(null)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <div className="mb-4">
                <label className="text-sm font-medium text-gray-500">Subject</label>
                <p className="text-gray-900 mt-1">{previewTemplate.subject}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Body</label>
                <div
                  className="mt-2 prose prose-sm max-w-none border border-gray-200 rounded-lg p-4 bg-gray-50"
                  dangerouslySetInnerHTML={{ __html: previewTemplate.body }}
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-200 bg-gray-50">
              <StandardButton variant="secondary" onClick={() => setPreviewTemplate(null)}>
                Close
              </StandardButton>
              <Link to={`/admin/email/templates/edit/${previewTemplate.id}`}>
                <StandardButton variant="primary" icon={previewTemplate.can_manage === false ? Eye : Edit}>
                  {previewTemplate.can_manage === false ? 'View Template' : 'Edit Template'}
                </StandardButton>
              </Link>
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

export default EmailTemplates;
