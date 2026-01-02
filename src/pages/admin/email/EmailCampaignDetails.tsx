// src/pages/admin/email/EmailCampaignDetails.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Send,
  RefreshCcw,
  Mail,
  Users,
  CheckCircle,
  XCircle,
  Clock,
  Ban,
  AlertTriangle,
  RotateCcw,
  Trash2,
  ChevronLeft,
  ChevronRight,

  Calendar,
  User,
  MapPin,
  Loader2
} from 'lucide-react';
import { useThemeColor } from '../../../hooks/useThemeColor';
import { emailCampaignService } from '../../../services/EmailCampaignService';
import StandardButton from '../../../components/ui/StandardButton';
import Toast from '../../../components/ui/Toast';
import CounterAnimation from '../../../components/ui/CounterAnimation';

import type { EmailCampaign, EmailCampaignStatus } from '../../../types/EmailCampaign.types';

const EmailCampaignDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { themeColor, fullColor } = useThemeColor();

  // State
  const [campaign, setCampaign] = useState<EmailCampaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  
  // Logs pagination
  const [logsPage, setLogsPage] = useState(1);
  const logsPerPage = 10;

  // Status configuration
  const statusConfig: Record<EmailCampaignStatus, { color: string; bgColor: string; icon: React.ElementType; label: string }> = {
    pending: { color: 'text-yellow-800', bgColor: 'bg-yellow-100', icon: Clock, label: 'Pending' },
    sending: { color: 'text-blue-800', bgColor: 'bg-blue-100', icon: Send, label: 'Sending' },
    completed: { color: 'text-green-800', bgColor: 'bg-green-100', icon: CheckCircle, label: 'Completed' },
    failed: { color: 'text-red-800', bgColor: 'bg-red-100', icon: XCircle, label: 'Failed' },
    cancelled: { color: 'text-gray-600', bgColor: 'bg-gray-100', icon: Ban, label: 'Cancelled' }
  };

  // Fetch campaign details
  const fetchCampaign = useCallback(async () => {
    if (!id) {
      navigate('/admin/email/campaigns');
      return;
    }

    try {
      setLoading(true);
      const response = await emailCampaignService.getCampaign(parseInt(id));
      
      if (response.success && response.data) {
        setCampaign(response.data);
      } else {
        setToast({ message: 'Campaign not found', type: 'error' });
        setTimeout(() => navigate('/admin/email/campaigns'), 1500);
      }
    } catch (error) {
      console.error('Error fetching campaign:', error);
      setToast({ message: 'Failed to load campaign details', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => {
    fetchCampaign();
  }, [fetchCampaign]);

  // Handle delete
  const handleDelete = async () => {
    if (!campaign) return;

    try {
      setActionLoading(true);
      const response = await emailCampaignService.deleteCampaign(campaign.id);
      if (response.success) {
        setToast({ message: 'Campaign deleted successfully', type: 'success' });
        setTimeout(() => navigate('/admin/email/campaigns'), 1500);
      }
    } catch (error) {
      console.error('Error deleting campaign:', error);
      setToast({ message: 'Failed to delete campaign', type: 'error' });
    } finally {
      setActionLoading(false);
      setShowDeleteConfirm(false);
    }
  };

  // Handle cancel
  const handleCancel = async () => {
    if (!campaign) return;

    try {
      setActionLoading(true);
      const response = await emailCampaignService.cancelCampaign(campaign.id);
      if (response.success) {
        setToast({ message: 'Campaign cancelled successfully', type: 'success' });
        fetchCampaign();
      }
    } catch (error) {
      console.error('Error cancelling campaign:', error);
      setToast({ message: 'Failed to cancel campaign', type: 'error' });
    } finally {
      setActionLoading(false);
      setShowCancelConfirm(false);
    }
  };

  // Handle resend
  const handleResend = async (type: 'failed' | 'all') => {
    if (!campaign) return;

    try {
      setActionLoading(true);
      const response = await emailCampaignService.resendCampaign(campaign.id, type);
      if (response.success) {
        setToast({ message: `Resending to ${type === 'failed' ? 'failed recipients' : 'all recipients'}...`, type: 'success' });
        fetchCampaign();
      }
    } catch (error) {
      console.error('Error resending campaign:', error);
      setToast({ message: 'Failed to resend campaign', type: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  // Format date
  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Get paginated logs
  const getPaginatedLogs = () => {
    if (!campaign?.logs) return [];
    const start = (logsPage - 1) * logsPerPage;
    const end = start + logsPerPage;
    return campaign.logs.slice(start, end);
  };

  const totalLogsPages = campaign?.logs ? Math.ceil(campaign.logs.length / logsPerPage) : 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className={`w-10 h-10 text-${fullColor} animate-spin mx-auto mb-4`} />
          <p className="text-gray-500">Loading campaign details...</p>
        </div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <XCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Campaign Not Found</h2>
          <p className="text-gray-500 mb-6">The campaign you're looking for doesn't exist.</p>
          <Link to="/admin/email/campaigns">
            <StandardButton variant="primary">Back to Campaigns</StandardButton>
          </Link>
        </div>
      </div>
    );
  }

  const StatusIcon = statusConfig[campaign.status]?.icon || Clock;
  const successRate = campaign.total_recipients > 0 
    ? Math.round((campaign.sent_count / campaign.total_recipients) * 100) 
    : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/admin/email/campaigns')}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <Mail className={`w-6 h-6 text-${fullColor}`} />
                  Campaign Details
                </h1>
                <p className="text-sm text-gray-500">{campaign.name}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <StandardButton
                variant="secondary"
                icon={RefreshCcw}
                onClick={fetchCampaign}
              >
                Refresh
              </StandardButton>
              {(campaign.status === 'pending' || campaign.status === 'sending') && (
                <StandardButton
                  variant="danger"
                  icon={Ban}
                  onClick={() => setShowCancelConfirm(true)}
                >
                  Cancel
                </StandardButton>
              )}
              {campaign.status === 'completed' && campaign.failed_count > 0 && (
                <StandardButton
                  variant="primary"
                  icon={RotateCcw}
                  onClick={() => handleResend('failed')}
                  disabled={actionLoading}
                >
                  Resend Failed
                </StandardButton>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Status and Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <p className="text-sm text-gray-500 mb-1">Status</p>
            <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full ${statusConfig[campaign.status]?.bgColor} ${statusConfig[campaign.status]?.color}`}>
              <StatusIcon className="w-4 h-4" />
              <span className="font-medium">{statusConfig[campaign.status]?.label}</span>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <p className="text-sm text-gray-500 mb-1">Total Recipients</p>
            <p className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Users className={`w-6 h-6 text-${fullColor}`} />
              <CounterAnimation value={campaign.total_recipients} />
            </p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <p className="text-sm text-gray-500 mb-1">Sent Successfully</p>
            <p className="text-2xl font-bold text-green-600 flex items-center gap-2">
              <CheckCircle className="w-6 h-6" />
              <CounterAnimation value={campaign.sent_count} />
            </p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <p className="text-sm text-gray-500 mb-1">Failed</p>
            <p className={`text-2xl font-bold flex items-center gap-2 ${campaign.failed_count > 0 ? 'text-red-600' : 'text-gray-400'}`}>
              <XCircle className="w-6 h-6" />
              <CounterAnimation value={campaign.failed_count} />
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Campaign Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Email Content */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Email Content</h2>
              
              <div className="mb-4">
                <label className="text-sm font-medium text-gray-500">Subject</label>
                <p className="text-gray-900 mt-1 font-medium">{campaign.subject}</p>
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-500">Body</label>
                <div 
                  className="mt-2 prose prose-sm max-w-none border border-gray-200 rounded-lg p-4 bg-gray-50"
                  dangerouslySetInnerHTML={{ __html: campaign.body }}
                />
              </div>
            </div>

            {/* Logs */}
            {campaign.logs && campaign.logs.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-4 border-b border-gray-200">
                  <h2 className="text-lg font-semibold text-gray-900">Delivery Logs</h2>
                  <p className="text-sm text-gray-500">Detailed log of each email sent</p>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Recipient</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Type</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Status</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Sent At</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {getPaginatedLogs().map((log) => (
                        <tr key={log.id} className="hover:bg-gray-50">
                          <td className="py-3 px-4 text-sm text-gray-900">{log.recipient_email}</td>
                          <td className="py-3 px-4">
                            <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded capitalize">
                              {log.recipient_type}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            {log.status === 'sent' ? (
                              <span className="inline-flex items-center gap-1 text-xs text-green-600">
                                <CheckCircle className="w-3.5 h-3.5" />
                                Sent
                              </span>
                            ) : log.status === 'failed' ? (
                              <span className="inline-flex items-center gap-1 text-xs text-red-600" title={log.error_message}>
                                <XCircle className="w-3.5 h-3.5" />
                                Failed
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs text-yellow-600">
                                <Clock className="w-3.5 h-3.5" />
                                Pending
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-500">
                            {log.sent_at ? formatDate(log.sent_at) : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Logs Pagination */}
                {totalLogsPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
                    <p className="text-sm text-gray-500">
                      Showing {((logsPage - 1) * logsPerPage) + 1} to {Math.min(logsPage * logsPerPage, campaign.logs.length)} of {campaign.logs.length} logs
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setLogsPage(prev => Math.max(1, prev - 1))}
                        disabled={logsPage === 1}
                        className="p-2 rounded-lg border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <span className="text-sm text-gray-600">
                        Page {logsPage} of {totalLogsPages}
                      </span>
                      <button
                        onClick={() => setLogsPage(prev => Math.min(totalLogsPages, prev + 1))}
                        disabled={logsPage === totalLogsPages}
                        className="p-2 rounded-lg border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Sidebar Info */}
          <div className="lg:col-span-1 space-y-6">
            {/* Campaign Details */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Campaign Details</h3>
              
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <Calendar className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-gray-700">Created</p>
                    <p className="text-sm text-gray-500">{formatDate(campaign.created_at)}</p>
                  </div>
                </div>

                {campaign.sent_at && (
                  <div className="flex items-start gap-3">
                    <Send className="w-5 h-5 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-gray-700">Sent At</p>
                      <p className="text-sm text-gray-500">{formatDate(campaign.sent_at)}</p>
                    </div>
                  </div>
                )}

                {campaign.completed_at && (
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-gray-700">Completed At</p>
                      <p className="text-sm text-gray-500">{formatDate(campaign.completed_at)}</p>
                    </div>
                  </div>
                )}

                {campaign.creator && (
                  <div className="flex items-start gap-3">
                    <User className="w-5 h-5 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-gray-700">Created By</p>
                      <p className="text-sm text-gray-500">
                        {campaign.creator.first_name} {campaign.creator.last_name}
                      </p>
                    </div>
                  </div>
                )}

                {campaign.location && (
                  <div className="flex items-start gap-3">
                    <MapPin className="w-5 h-5 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-gray-700">Location</p>
                      <p className="text-sm text-gray-500">{campaign.location.name}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Recipients Summary */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Recipients</h3>
              
              <div className="space-y-2">
                {campaign.recipient_types.map(type => (
                  <div key={type} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                    <span className="text-sm text-gray-600 capitalize">{type.replace('_', ' ')}</span>
                    <span className={`text-xs px-2 py-0.5 rounded bg-${themeColor}-100 text-${fullColor}`}>
                      Included
                    </span>
                  </div>
                ))}
                {campaign.custom_emails && campaign.custom_emails.length > 0 && (
                  <div className="pt-2">
                    <p className="text-xs text-gray-500 mb-2">Custom Emails ({campaign.custom_emails.length})</p>
                    <div className="flex flex-wrap gap-1">
                      {campaign.custom_emails.slice(0, 5).map(email => (
                        <span key={email} className="text-xs px-2 py-0.5 bg-gray-100 rounded-full truncate max-w-[150px]">
                          {email}
                        </span>
                      ))}
                      {campaign.custom_emails.length > 5 && (
                        <span className="text-xs px-2 py-0.5 bg-gray-100 rounded-full">
                          +{campaign.custom_emails.length - 5} more
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Success Rate */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Success Rate</h3>
              <div className="relative pt-1">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">Delivery Rate</span>
                  <span className="text-sm font-semibold text-gray-900">{successRate}%</span>
                </div>
                <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className={`h-full ${successRate >= 90 ? 'bg-green-500' : successRate >= 70 ? 'bg-yellow-500' : 'bg-red-500'}`}
                    style={{ width: `${successRate}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Actions */}
            {(campaign.status === 'completed' || campaign.status === 'cancelled' || campaign.status === 'failed') && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 className="font-semibold text-gray-900 mb-4">Actions</h3>
                <div className="space-y-2">
                  {campaign.failed_count > 0 && (
                    <StandardButton
                      variant="secondary"
                      icon={RotateCcw}
                      fullWidth
                      onClick={() => handleResend('failed')}
                      disabled={actionLoading}
                    >
                      Resend to Failed Recipients
                    </StandardButton>
                  )}
                  <StandardButton
                    variant="danger"
                    icon={Trash2}
                    fullWidth
                    onClick={() => setShowDeleteConfirm(true)}
                    disabled={actionLoading}
                  >
                    Delete Campaign
                  </StandardButton>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
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
              Are you sure you want to delete this campaign? All data including logs will be permanently removed.
            </p>
            <div className="flex items-center gap-3 justify-end">
              <StandardButton variant="secondary" onClick={() => setShowDeleteConfirm(false)}>
                Cancel
              </StandardButton>
              <StandardButton
                variant="danger"
                onClick={handleDelete}
                loading={actionLoading}
                disabled={actionLoading}
              >
                Delete Campaign
              </StandardButton>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Confirmation Modal */}
      {showCancelConfirm && (
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
              Are you sure you want to cancel this campaign? Emails already sent will not be affected.
            </p>
            <div className="flex items-center gap-3 justify-end">
              <StandardButton variant="secondary" onClick={() => setShowCancelConfirm(false)}>
                Keep Sending
              </StandardButton>
              <StandardButton
                variant="danger"
                onClick={handleCancel}
                loading={actionLoading}
                disabled={actionLoading}
              >
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
    </div>
  );
};

export default EmailCampaignDetails;
