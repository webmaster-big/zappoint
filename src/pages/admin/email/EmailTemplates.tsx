// src/pages/admin/email/EmailTemplates.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Search,
  Plus,
  Filter,
  RefreshCcw,
  FileText,
  Edit,
  Trash2,
  Copy,
  Eye,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
  X,
  CheckCircle,
  Clock,
  Archive,
  Mail
} from 'lucide-react';
import { useThemeColor } from '../../../hooks/useThemeColor';
import { emailCampaignService } from '../../../services/EmailCampaignService';
import { locationService } from '../../../services/LocationService';
import StandardButton from '../../../components/ui/StandardButton';
import Toast from '../../../components/ui/Toast';
import { getStoredUser } from '../../../utils/storage';
import type { EmailTemplate, EmailTemplateFilters, EmailTemplateStatus } from '../../../types/EmailCampaign.types';

const EmailTemplates: React.FC = () => {
  const { themeColor, fullColor } = useThemeColor();
  const currentUser = getStoredUser();
  const isCompanyAdmin = currentUser?.role === 'company_admin';

  // State
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  const [locations, setLocations] = useState<Array<{ id: number; name: string }>>([]);
  const [filters, setFilters] = useState<{
    status: EmailTemplateStatus | 'all';
    category: string;
    search: string;
  }>({
    status: 'all',
    category: 'all',
    search: ''
  });
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [itemsPerPage] = useState(10);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [activeDropdown, setActiveDropdown] = useState<number | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<EmailTemplate | null>(null);

  // Status configuration
  const statusConfig: Record<EmailTemplateStatus, { color: string; icon: React.ElementType; label: string }> = {
    draft: { color: 'bg-yellow-100 text-yellow-800', icon: Clock, label: 'Draft' },
    active: { color: 'bg-green-100 text-green-800', icon: CheckCircle, label: 'Active' },
    archived: { color: 'bg-gray-100 text-gray-600', icon: Archive, label: 'Archived' }
  };

  // Categories for filtering
  const categories = [
    { value: 'all', label: 'All Categories' },
    { value: 'onboarding', label: 'Onboarding' },
    { value: 'marketing', label: 'Marketing' },
    { value: 'transactional', label: 'Transactional' },
    { value: 'newsletter', label: 'Newsletter' },
    { value: 'reminder', label: 'Reminder' },
    { value: 'notification', label: 'Notification' },
    { value: 'other', label: 'Other' }
  ];

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

  // Fetch templates
  const fetchTemplates = useCallback(async () => {
    try {
      setLoading(true);
      
      const apiFilters: EmailTemplateFilters = {
        page: currentPage,
        per_page: itemsPerPage
      };

      if (filters.status !== 'all') {
        apiFilters.status = filters.status;
      }
      if (filters.category !== 'all') {
        apiFilters.category = filters.category;
      }
      if (filters.search.trim()) {
        apiFilters.search = filters.search.trim();
      }
      if (selectedLocation) {
        apiFilters.location_id = parseInt(selectedLocation);
      }

      const response = await emailCampaignService.getTemplates(apiFilters);
      
      if (response.success) {
        setTemplates(response.data.data);
        setTotalPages(response.data.last_page);
        setTotalItems(response.data.total);
      }
    } catch (error) {
      console.error('Error fetching templates:', error);
      setToast({ message: 'Failed to load email templates', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [currentPage, itemsPerPage, filters, selectedLocation]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  // Handle delete template
  const handleDelete = async (id: number) => {
    try {
      const response = await emailCampaignService.deleteTemplate(id);
      if (response.success) {
        setToast({ message: 'Template deleted successfully', type: 'success' });
        fetchTemplates();
      }
    } catch (error) {
      console.error('Error deleting template:', error);
      setToast({ message: 'Failed to delete template', type: 'error' });
    } finally {
      setDeleteConfirm(null);
    }
  };

  // Handle duplicate template
  const handleDuplicate = async (id: number) => {
    try {
      const response = await emailCampaignService.duplicateTemplate(id);
      if (response.success) {
        setToast({ message: 'Template duplicated successfully', type: 'success' });
        fetchTemplates();
      }
    } catch (error) {
      console.error('Error duplicating template:', error);
      setToast({ message: 'Failed to duplicate template', type: 'error' });
    } finally {
      setActiveDropdown(null);
    }
  };

  // Handle status change
  const handleStatusChange = async (id: number, newStatus: EmailTemplateStatus) => {
    try {
      const response = await emailCampaignService.updateTemplateStatus(id, newStatus);
      if (response.success) {
        setToast({ message: `Template ${newStatus === 'active' ? 'activated' : newStatus === 'archived' ? 'archived' : 'set to draft'}`, type: 'success' });
        fetchTemplates();
      }
    } catch (error) {
      console.error('Error updating status:', error);
      setToast({ message: 'Failed to update template status', type: 'error' });
    } finally {
      setActiveDropdown(null);
    }
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Mail className={`w-7 h-7 text-${fullColor}`} />
              Email Templates
            </h1>
            <p className="text-gray-600 mt-1">Create and manage reusable email templates</p>
          </div>
          <div className="flex items-center gap-3">
            <StandardButton
              variant="secondary"
              icon={RefreshCcw}
              onClick={() => fetchTemplates()}
              disabled={loading}
            >
              Refresh
            </StandardButton>
            <Link to="/admin/email/templates/create">
              <StandardButton variant="primary" icon={Plus}>
                Create Template
              </StandardButton>
            </Link>
          </div>
        </div>
      </div>

      {/* Filters Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6">
        <div className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search templates by name or subject..."
                value={filters.search}
                onChange={(e) => {
                  setFilters(prev => ({ ...prev, search: e.target.value }));
                  setCurrentPage(1);
                }}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              {filters.search && (
                <button
                  onClick={() => setFilters(prev => ({ ...prev, search: '' }))}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Location Filter (Company Admin only) */}
            {isCompanyAdmin && locations.length > 0 && (
              <select
                value={selectedLocation}
                onChange={(e) => {
                  setSelectedLocation(e.target.value);
                  setCurrentPage(1);
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All Locations</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id.toString()}>
                    {loc.name}
                  </option>
                ))}
              </select>
            )}

            {/* Status Filter */}
            <select
              value={filters.status}
              onChange={(e) => {
                setFilters(prev => ({ ...prev, status: e.target.value as EmailTemplateStatus | 'all' }));
                setCurrentPage(1);
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Statuses</option>
              <option value="draft">Draft</option>
              <option value="active">Active</option>
              <option value="archived">Archived</option>
            </select>

            {/* Category Filter */}
            <select
              value={filters.category}
              onChange={(e) => {
                setFilters(prev => ({ ...prev, category: e.target.value }));
                setCurrentPage(1);
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {categories.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>

            {/* Filter Toggle */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`p-2 rounded-lg border ${showFilters ? `bg-${themeColor}-50 border-${themeColor}-300 text-${fullColor}` : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}
            >
              <Filter className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Templates Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className={`animate-spin w-8 h-8 border-4 border-${themeColor}-200 border-t-${fullColor} rounded-full mx-auto mb-4`}></div>
            <p className="text-gray-500">Loading templates...</p>
          </div>
        ) : templates.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No templates found</h3>
            <p className="text-gray-500 mb-6">Get started by creating your first email template</p>
            <Link to="/admin/email/templates/create">
              <StandardButton variant="primary" icon={Plus}>
                Create Template
              </StandardButton>
            </Link>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Template</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Category</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Status</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Created</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {templates.map((template) => {
                    const StatusIcon = statusConfig[template.status]?.icon || Clock;
                    return (
                      <tr key={template.id} className="hover:bg-gray-50 transition-colors">
                        <td className="py-4 px-4">
                          <div>
                            <p className="font-medium text-gray-900">{template.name}</p>
                            <p className="text-sm text-gray-500 truncate max-w-md">{template.subject}</p>
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 capitalize">
                            {template.category || 'Uncategorized'}
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${statusConfig[template.status]?.color || 'bg-gray-100 text-gray-700'}`}>
                            <StatusIcon className="w-3.5 h-3.5" />
                            {statusConfig[template.status]?.label || template.status}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-sm text-gray-500">
                          {formatDate(template.created_at)}
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => setPreviewTemplate(template)}
                              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                              title="Preview"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <Link
                              to={`/admin/email/templates/edit/${template.id}`}
                              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                              title="Edit"
                            >
                              <Edit className="w-4 h-4" />
                            </Link>
                            <div className="relative">
                              <button
                                onClick={() => setActiveDropdown(activeDropdown === template.id ? null : template.id)}
                                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                              >
                                <MoreVertical className="w-4 h-4" />
                              </button>
                              {activeDropdown === template.id && (
                                <div className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10">
                                  <button
                                    onClick={() => handleDuplicate(template.id)}
                                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                                  >
                                    <Copy className="w-4 h-4" />
                                    Duplicate
                                  </button>
                                  {template.status !== 'active' && (
                                    <button
                                      onClick={() => handleStatusChange(template.id, 'active')}
                                      className="w-full flex items-center gap-2 px-4 py-2 text-sm text-green-600 hover:bg-green-50"
                                    >
                                      <CheckCircle className="w-4 h-4" />
                                      Set Active
                                    </button>
                                  )}
                                  {template.status !== 'draft' && (
                                    <button
                                      onClick={() => handleStatusChange(template.id, 'draft')}
                                      className="w-full flex items-center gap-2 px-4 py-2 text-sm text-yellow-600 hover:bg-yellow-50"
                                    >
                                      <Clock className="w-4 h-4" />
                                      Set as Draft
                                    </button>
                                  )}
                                  {template.status !== 'archived' && (
                                    <button
                                      onClick={() => handleStatusChange(template.id, 'archived')}
                                      className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
                                    >
                                      <Archive className="w-4 h-4" />
                                      Archive
                                    </button>
                                  )}
                                  <hr className="my-1" />
                                  <button
                                    onClick={() => {
                                      setDeleteConfirm(template.id);
                                      setActiveDropdown(null);
                                    }}
                                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                    Delete
                                  </button>
                                </div>
                              )}
                            </div>
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
              {templates.map((template) => {
                const StatusIcon = statusConfig[template.status]?.icon || Clock;
                return (
                  <div key={template.id} className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h3 className="font-medium text-gray-900">{template.name}</h3>
                        <p className="text-sm text-gray-500 truncate">{template.subject}</p>
                      </div>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig[template.status]?.color || 'bg-gray-100 text-gray-700'}`}>
                        <StatusIcon className="w-3 h-3" />
                        {statusConfig[template.status]?.label || template.status}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-3">
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span className="px-2 py-0.5 bg-gray-100 rounded capitalize">{template.category || 'Uncategorized'}</span>
                        <span>{formatDate(template.created_at)}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setPreviewTemplate(template)}
                          className="p-2 text-gray-500 hover:text-gray-700"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <Link
                          to={`/admin/email/templates/edit/${template.id}`}
                          className="p-2 text-gray-500 hover:text-gray-700"
                        >
                          <Edit className="w-4 h-4" />
                        </Link>
                        <button
                          onClick={() => setDeleteConfirm(template.id)}
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
                  Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems} templates
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

      {/* Preview Modal */}
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
                <StandardButton variant="primary" icon={Edit}>
                  Edit Template
                </StandardButton>
              </Link>
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

      {/* Click outside to close dropdown */}
      {activeDropdown && (
        <div
          className="fixed inset-0 z-0"
          onClick={() => setActiveDropdown(null)}
        />
      )}
    </div>
  );
};

export default EmailTemplates;
