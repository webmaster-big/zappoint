// src/pages/admin/email/EmailCampaigns.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Search,
  Plus,
  RefreshCcw,
  Filter,
  Send,
  Eye,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  Clock,
  XCircle,
  AlertTriangle,
  Ban,
  Mail,
  Users,
  BarChart3,
  Trash2,
  RotateCcw
} from 'lucide-react';
import { useThemeColor } from '../../../hooks/useThemeColor';
import { emailCampaignService } from '../../../services/EmailCampaignService';
import { locationService } from '../../../services/LocationService';
import StandardButton from '../../../components/ui/StandardButton';
import Toast from '../../../components/ui/Toast';
import CounterAnimation from '../../../components/ui/CounterAnimation';
import { getStoredUser } from '../../../utils/storage';
import type { EmailCampaign, EmailCampaignFilters, EmailCampaignStatus, EmailCampaignStatistics } from '../../../types/EmailCampaign.types';

const EmailCampaigns: React.FC = () => {
  const { themeColor, fullColor } = useThemeColor();
  const currentUser = getStoredUser();
  const isCompanyAdmin = currentUser?.role === 'company_admin';

  // State
  const [campaigns, setCampaigns] = useState<EmailCampaign[]>([]);
  const [statistics, setStatistics] = useState<EmailCampaignStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  const [locations, setLocations] = useState<Array<{ id: number; name: string }>>([]);
  const [filters, setFilters] = useState<{
    status: EmailCampaignStatus | 'all';
    search: string;
  }>({
    status: 'all',
    search: ''
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [itemsPerPage] = useState(10);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [activeDropdown, setActiveDropdown] = useState<number | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [cancelConfirm, setCancelConfirm] = useState<number | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // Status configuration
  const statusConfig: Record<EmailCampaignStatus, { color: string; icon: React.ElementType; label: string }> = {
    pending: { color: 'bg-yellow-100 text-yellow-800', icon: Clock, label: 'Pending' },
    sending: { color: 'bg-blue-100 text-blue-800', icon: Send, label: 'Sending' },
    completed: { color: 'bg-green-100 text-green-800', icon: CheckCircle, label: 'Completed' },
    failed: { color: 'bg-red-100 text-red-800', icon: XCircle, label: 'Failed' },
    cancelled: { color: 'bg-gray-100 text-gray-600', icon: Ban, label: 'Cancelled' }
  };

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

  // Fetch campaigns
  const fetchCampaigns = useCallback(async () => {
    try {
      setLoading(true);
      
      const apiFilters: EmailCampaignFilters = {
        page: currentPage,
        per_page: itemsPerPage
      };

      if (filters.status !== 'all') {
        apiFilters.status = filters.status;
      }
      if (filters.search.trim()) {
        apiFilters.search = filters.search.trim();
      }
      if (selectedLocation) {
        apiFilters.location_id = parseInt(selectedLocation);
      }

      const response = await emailCampaignService.getCampaigns(apiFilters);
      
      if (response.success) {
        setCampaigns(response.data.data);
        setTotalPages(response.data.last_page);
        setTotalItems(response.data.total);
      }
    } catch (error) {
      console.error('Error fetching campaigns:', error);
      setToast({ message: 'Failed to load email campaigns', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [currentPage, itemsPerPage, filters, selectedLocation]);

  // Fetch statistics
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
    fetchCampaigns();
    fetchStatistics();
  }, [fetchCampaigns, fetchStatistics]);

  // Handle delete campaign
  const handleDelete = async (id: number) => {
    try {
      const response = await emailCampaignService.deleteCampaign(id);
      if (response.success) {
        setToast({ message: 'Campaign deleted successfully', type: 'success' });
        fetchCampaigns();
        fetchStatistics();
      }
    } catch (error) {
      console.error('Error deleting campaign:', error);
      setToast({ message: 'Failed to delete campaign', type: 'error' });
    } finally {
      setDeleteConfirm(null);
    }
  };

  // Handle cancel campaign
  const handleCancel = async (id: number) => {
    try {
      const response = await emailCampaignService.cancelCampaign(id);
      if (response.success) {
        setToast({ message: 'Campaign cancelled successfully', type: 'success' });
        fetchCampaigns();
        fetchStatistics();
      }
    } catch (error) {
      console.error('Error cancelling campaign:', error);
      setToast({ message: 'Failed to cancel campaign', type: 'error' });
    } finally {
      setCancelConfirm(null);
    }
  };

  // Handle resend campaign
  const handleResend = async (id: number, type: 'failed' | 'all') => {
    try {
      const response = await emailCampaignService.resendCampaign(id, type);
      if (response.success) {
        setToast({ message: `Resending emails to ${type === 'failed' ? 'failed recipients' : 'all recipients'}`, type: 'success' });
        fetchCampaigns();
      }
    } catch (error) {
      console.error('Error resending campaign:', error);
      setToast({ message: 'Failed to resend campaign', type: 'error' });
    } finally {
      setActiveDropdown(null);
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

  return (
    <div className="px-6 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Email Campaigns</h1>
          <p className="text-gray-600 mt-2">Send bulk emails to customers and staff</p>
        </div>
        <div className="flex items-center gap-3 mt-4 sm:mt-0">
          <Link to="/admin/email/templates">
            <StandardButton variant="secondary" icon={Mail}>
              Templates
            </StandardButton>
          </Link>
          <StandardButton
            variant="secondary"
            icon={RefreshCcw}
            onClick={() => { fetchCampaigns(); fetchStatistics(); }}
            disabled={loading}
          >
            Refresh
          </StandardButton>
          <Link to="/admin/email/campaigns/create">
            <StandardButton variant="primary" icon={Plus}>
              New Campaign
            </StandardButton>
          </Link>
        </div>
      </div>

      {/* Statistics Cards - Dashboard Style */}
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

      {/* Filters Section */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-6">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="relative flex-1 max-w-lg">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-600" />
            </div>
            <input
              type="text"
              placeholder="Search campaigns by name or subject..."
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
              onClick={() => { fetchCampaigns(); fetchStatistics(); }}
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
            <div className={`grid grid-cols-1 ${isCompanyAdmin && locations.length > 0 ? 'md:grid-cols-2' : 'md:grid-cols-1'} gap-3`}>
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

              {/* Status Filter */}
              <div>
                <label className="block text-xs font-medium text-gray-800 mb-1">Status</label>
                <select
                  value={filters.status}
                  onChange={(e) => {
                    setFilters(prev => ({ ...prev, status: e.target.value as EmailCampaignStatus | 'all' }));
                    setCurrentPage(1);
                  }}
                  className={`w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-${themeColor}-600 focus:border-${themeColor}-600`}
                >
                  <option value="all">All Statuses</option>
                  <option value="pending">Pending</option>
                  <option value="sending">Sending</option>
                  <option value="completed">Completed</option>
                  <option value="failed">Failed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>
            <div className="mt-3 flex justify-end">
              <StandardButton
                onClick={() => {
                  setFilters({ status: 'all', search: '' });
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

      {/* Campaigns Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className={`animate-spin w-8 h-8 border-4 border-${themeColor}-200 border-t-${fullColor} rounded-full mx-auto mb-4`}></div>
            <p className="text-gray-500">Loading campaigns...</p>
          </div>
        ) : campaigns.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <div className="flex flex-col items-center justify-center">
              <div className={`inline-flex p-4 rounded-full bg-${themeColor}-50 mb-4`}>
                <Send className={`h-12 w-12 text-${themeColor}-400`} />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No campaigns found</h3>
              <p className="text-gray-500 mb-6">
                {filters.search || filters.status !== 'all'
                  ? 'Try adjusting your search or filters'
                  : 'Get started by creating your first email campaign'}
              </p>
              <Link to="/admin/email/campaigns/create">
                <StandardButton variant="primary" icon={Plus}>
                  Create Campaign
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
                    <th className="px-4 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Campaign</th>
                    <th className="px-4 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Recipients</th>
                    <th className="px-4 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Progress</th>
                    <th className="px-4 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Sent At</th>
                    <th className="px-4 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {campaigns.map((campaign) => {
                    const StatusIcon = statusConfig[campaign.status]?.icon || Clock;
                    const successRate = campaign.total_recipients > 0 
                      ? Math.round((campaign.sent_count / campaign.total_recipients) * 100) 
                      : 0;
                    return (
                      <tr key={campaign.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-4">
                          <div>
                            <p className="font-medium text-gray-900 text-sm">{campaign.name}</p>
                            <p className="text-xs text-gray-500 truncate max-w-md mt-0.5">{campaign.subject}</p>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-1.5">
                            <Users className={`w-4 h-4 text-${themeColor}-500`} />
                            <span className="font-medium text-gray-900 text-sm">{campaign.total_recipients}</span>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusConfig[campaign.status]?.color || 'bg-gray-100 text-gray-700'}`}>
                            <StatusIcon className="w-3.5 h-3.5" />
                            {statusConfig[campaign.status]?.label || campaign.status}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden max-w-[120px]">
                              <div 
                                className={`h-full rounded-full ${campaign.failed_count > 0 ? 'bg-yellow-500' : `bg-${themeColor}-500`}`}
                                style={{ width: `${successRate}%` }}
                              />
                            </div>
                            <span className="text-xs text-gray-600 font-medium">
                              {campaign.sent_count}/{campaign.total_recipients}
                            </span>
                            {campaign.failed_count > 0 && (
                              <span className="text-xs text-red-500 font-medium">
                                ({campaign.failed_count} failed)
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-500">
                          {campaign.sent_at ? formatDate(campaign.sent_at) : '-'}
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center justify-end gap-1">
                            <Link
                              to={`/admin/email/campaigns/${campaign.id}`}
                              className="p-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                              title="View Details"
                            >
                              <Eye className="w-4 h-4" />
                            </Link>
                            <div className="relative">
                              <button
                                onClick={() => setActiveDropdown(activeDropdown === campaign.id ? null : campaign.id)}
                                className="p-2 text-gray-600 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                              >
                                <MoreVertical className="w-4 h-4" />
                              </button>
                              {activeDropdown === campaign.id && (
                                <>
                                  {/* Backdrop to close dropdown */}
                                  <div 
                                    className="fixed inset-0 z-40" 
                                    onClick={() => setActiveDropdown(null)}
                                  />
                                  <div className="absolute right-0 bottom-full mb-1 w-48 bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-50">
                                    <Link
                                      to={`/admin/email/campaigns/${campaign.id}`}
                                      className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                                    >
                                      <Eye className="w-4 h-4" />
                                      View Details
                                    </Link>
                                    {campaign.status === 'completed' && campaign.failed_count > 0 && (
                                      <button
                                        onClick={() => handleResend(campaign.id, 'failed')}
                                        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-yellow-600 hover:bg-yellow-50"
                                      >
                                        <RotateCcw className="w-4 h-4" />
                                        Resend Failed
                                      </button>
                                    )}
                                    {(campaign.status === 'pending' || campaign.status === 'sending') && (
                                      <button
                                        onClick={() => {
                                          setCancelConfirm(campaign.id);
                                          setActiveDropdown(null);
                                        }}
                                        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-orange-600 hover:bg-orange-50"
                                      >
                                        <Ban className="w-4 h-4" />
                                        Cancel Campaign
                                      </button>
                                    )}
                                    {(campaign.status === 'completed' || campaign.status === 'cancelled' || campaign.status === 'failed') && (
                                      <>
                                        <hr className="my-1" />
                                        <button
                                          onClick={() => {
                                            setDeleteConfirm(campaign.id);
                                            setActiveDropdown(null);
                                          }}
                                          className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                                        >
                                          <Trash2 className="w-4 h-4" />
                                          Delete
                                        </button>
                                      </>
                                    )}
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {/* Spacer to ensure dropdown visibility with few rows */}
              {campaigns.length <= 3 && <div className="h-48" />}
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden divide-y divide-gray-100">
              {campaigns.map((campaign) => {
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

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
                <p className="text-sm text-gray-500">
                  Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems} campaigns
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

      {/* Cancel Confirmation Modal */}
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

export default EmailCampaigns;
