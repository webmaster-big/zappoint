// src/pages/admin/email/EditEmailTemplate.tsx
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Save,
  Eye,
  FileText,
  Info,
  ChevronDown,
  ChevronUp,
  Copy,
  X,
  Mail,
  Code,
  Loader2
} from 'lucide-react';
import { useThemeColor } from '../../../hooks/useThemeColor';
import { emailCampaignService } from '../../../services/EmailCampaignService';
import { locationService } from '../../../services/LocationService';
import StandardButton from '../../../components/ui/StandardButton';
import Toast from '../../../components/ui/Toast';
import { getStoredUser } from '../../../utils/storage';
import type { UpdateEmailTemplateData, EmailTemplateStatus, EmailTemplateVariable, EmailTemplate } from '../../../types/EmailCampaign.types';

interface VariableGroup {
  name: string;
  variables: EmailTemplateVariable[];
}

const EditEmailTemplate: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { fullColor } = useThemeColor();
  const currentUser = getStoredUser();
  const isCompanyAdmin = currentUser?.role === 'company_admin';
  const bodyEditorRef = useRef<HTMLDivElement>(null);

  // Form state
  const [formData, setFormData] = useState<UpdateEmailTemplateData>({
    name: '',
    subject: '',
    body: '',
    status: 'draft',
    category: '',
    location_id: undefined
  });
  const [originalTemplate, setOriginalTemplate] = useState<EmailTemplate | null>(null);
  const [locations, setLocations] = useState<Array<{ id: number; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState<{ subject: string; body: string } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Variables panel state
  const [variableGroups, setVariableGroups] = useState<VariableGroup[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    default: true,
    customer: false,
    user: false
  });
  const [copiedVariable, setCopiedVariable] = useState<string | null>(null);

  // Categories
  const categories = [
    { value: '', label: 'Select Category' },
    { value: 'onboarding', label: 'Onboarding' },
    { value: 'marketing', label: 'Marketing' },
    { value: 'transactional', label: 'Transactional' },
    { value: 'newsletter', label: 'Newsletter' },
    { value: 'reminder', label: 'Reminder' },
    { value: 'notification', label: 'Notification' },
    { value: 'other', label: 'Other' }
  ];

  // Fetch template and data on mount
  useEffect(() => {
    const fetchData = async () => {
      if (!id) {
        navigate('/admin/email/templates');
        return;
      }

      try {
        setLoading(true);

        // Fetch template
        const templateResponse = await emailCampaignService.getTemplate(parseInt(id));
        if (templateResponse.success && templateResponse.data) {
          const template = templateResponse.data;
          setOriginalTemplate(template);
          setFormData({
            name: template.name,
            subject: template.subject,
            body: template.body,
            status: template.status,
            category: template.category || '',
            location_id: template.location_id
          });
          
          // Set body content in editor
          if (bodyEditorRef.current) {
            bodyEditorRef.current.innerHTML = template.body;
          }
        } else {
          setToast({ message: 'Template not found', type: 'error' });
          setTimeout(() => navigate('/admin/email/templates'), 1500);
          return;
        }

        // Fetch locations for company admin
        if (isCompanyAdmin) {
          const locResponse = await locationService.getLocations();
          if (locResponse.success && locResponse.data) {
            setLocations(locResponse.data);
          }
        }

        // Fetch available variables
        const varResponse = await emailCampaignService.getTemplateVariables();
        if (varResponse.success) {
          const groups: VariableGroup[] = [
            { name: 'default', variables: varResponse.data.default || [] },
            { name: 'customer', variables: varResponse.data.customer || [] },
            { name: 'user', variables: varResponse.data.user || [] }
          ];
          setVariableGroups(groups);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        setToast({ message: 'Failed to load template', type: 'error' });
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id, isCompanyAdmin, navigate]);

  // Set body content when template is loaded
  useEffect(() => {
    if (bodyEditorRef.current && formData.body && !loading) {
      bodyEditorRef.current.innerHTML = formData.body;
    }
  }, [loading, formData.body]);

  // Handle input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'location_id' ? (value ? parseInt(value) : undefined) : value
    }));
  };

  // Handle body content change
  const handleBodyChange = () => {
    if (bodyEditorRef.current) {
      setFormData(prev => ({
        ...prev,
        body: bodyEditorRef.current?.innerHTML || ''
      }));
    }
  };

  // Insert variable at cursor position
  const insertVariable = (variable: string) => {
    const variableText = `{{ ${variable} }}`;
    
    if (bodyEditorRef.current) {
      bodyEditorRef.current.focus();
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const textNode = document.createTextNode(variableText);
        range.insertNode(textNode);
        range.setStartAfter(textNode);
        range.setEndAfter(textNode);
        selection.removeAllRanges();
        selection.addRange(range);
      } else {
        bodyEditorRef.current.innerHTML += variableText;
      }
      handleBodyChange();
    }
  };

  // Copy variable to clipboard
  const copyVariable = (variable: string) => {
    const variableText = `{{ ${variable} }}`;
    navigator.clipboard.writeText(variableText);
    setCopiedVariable(variable);
    setTimeout(() => setCopiedVariable(null), 2000);
  };

  // Toggle variable group
  const toggleGroup = (groupName: string) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupName]: !prev[groupName]
    }));
  };

  // Format group name
  const formatGroupName = (name: string) => {
    return name.charAt(0).toUpperCase() + name.slice(1) + ' Variables';
  };

  // Preview template
  const handlePreview = async () => {
    if (!formData.subject || !formData.body) {
      setToast({ message: 'Please enter subject and body to preview', type: 'error' });
      return;
    }

    try {
      setPreviewLoading(true);
      const response = await emailCampaignService.previewContent({
        subject: formData.subject,
        body: formData.body
      });
      
      if (response.success) {
        setPreviewData(response.data);
        setShowPreview(true);
      }
    } catch (error) {
      console.error('Error previewing template:', error);
      setToast({ message: 'Failed to preview template', type: 'error' });
    } finally {
      setPreviewLoading(false);
    }
  };

  // Save template
  const handleSave = async (status?: EmailTemplateStatus) => {
    if (!id) return;

    // Validation
    if (!formData.name?.trim()) {
      setToast({ message: 'Please enter a template name', type: 'error' });
      return;
    }
    if (!formData.subject?.trim()) {
      setToast({ message: 'Please enter an email subject', type: 'error' });
      return;
    }
    if (!formData.body?.trim()) {
      setToast({ message: 'Please enter email body content', type: 'error' });
      return;
    }

    try {
      setSaving(true);
      const updateData: UpdateEmailTemplateData = { ...formData };
      if (status) {
        updateData.status = status;
      }

      const response = await emailCampaignService.updateTemplate(parseInt(id), updateData);

      if (response.success) {
        setToast({ message: 'Template updated successfully!', type: 'success' });
        setTimeout(() => {
          navigate('/admin/email/templates');
        }, 1500);
      }
    } catch (error) {
      console.error('Error saving template:', error);
      setToast({ message: 'Failed to save template', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  // Basic text formatting
  const formatText = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    handleBodyChange();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className={`w-10 h-10 text-${fullColor} animate-spin mx-auto mb-4`} />
          <p className="text-gray-500">Loading template...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/admin/email/templates')}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <Mail className={`w-6 h-6 text-${fullColor}`} />
                  Edit Email Template
                </h1>
                <p className="text-sm text-gray-500">
                  Editing: {originalTemplate?.name || 'Template'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <StandardButton
                variant="secondary"
                icon={Eye}
                onClick={handlePreview}
                disabled={previewLoading}
              >
                Preview
              </StandardButton>
              <StandardButton
                variant="secondary"
                icon={Save}
                onClick={() => handleSave()}
                disabled={saving}
              >
                Save Changes
              </StandardButton>
              {formData.status !== 'active' && (
                <StandardButton
                  variant="primary"
                  icon={FileText}
                  onClick={() => handleSave('active')}
                  disabled={saving}
                  loading={saving}
                >
                  Save & Activate
                </StandardButton>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Basic Info */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Template Information</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Template Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="e.g., Welcome Email"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Category
                  </label>
                  <select
                    name="category"
                    value={formData.category}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {categories.map(cat => (
                      <option key={cat.value} value={cat.value}>{cat.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {isCompanyAdmin && locations.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Location (Optional)
                    </label>
                    <select
                      name="location_id"
                      value={formData.location_id || ''}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">All Locations</option>
                      {locations.map(loc => (
                        <option key={loc.id} value={loc.id}>{loc.name}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Status
                  </label>
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="draft">Draft</option>
                    <option value="active">Active</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Email Content */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Email Content</h2>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Subject Line <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="subject"
                  value={formData.subject}
                  onChange={handleInputChange}
                  placeholder="e.g., Welcome to {{ company_name }}, {{ recipient_first_name }}!"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">You can use variables in the subject line</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email Body <span className="text-red-500">*</span>
                </label>
                
                {/* Simple Toolbar */}
                <div className="flex items-center gap-1 p-2 border border-gray-300 border-b-0 rounded-t-lg bg-gray-50">
                  <button
                    type="button"
                    onClick={() => formatText('bold')}
                    className="p-2 hover:bg-gray-200 rounded font-bold"
                    title="Bold"
                  >
                    B
                  </button>
                  <button
                    type="button"
                    onClick={() => formatText('italic')}
                    className="p-2 hover:bg-gray-200 rounded italic"
                    title="Italic"
                  >
                    I
                  </button>
                  <button
                    type="button"
                    onClick={() => formatText('underline')}
                    className="p-2 hover:bg-gray-200 rounded underline"
                    title="Underline"
                  >
                    U
                  </button>
                  <div className="w-px h-6 bg-gray-300 mx-1" />
                  <button
                    type="button"
                    onClick={() => formatText('insertUnorderedList')}
                    className="p-2 hover:bg-gray-200 rounded text-sm"
                    title="Bullet List"
                  >
                    • List
                  </button>
                  <button
                    type="button"
                    onClick={() => formatText('insertOrderedList')}
                    className="p-2 hover:bg-gray-200 rounded text-sm"
                    title="Numbered List"
                  >
                    1. List
                  </button>
                  <div className="w-px h-6 bg-gray-300 mx-1" />
                  <button
                    type="button"
                    onClick={() => {
                      const url = prompt('Enter URL:');
                      if (url) formatText('createLink', url);
                    }}
                    className="p-2 hover:bg-gray-200 rounded text-sm text-blue-600"
                    title="Insert Link"
                  >
                    Link
                  </button>
                </div>
                
                {/* Content Editable Editor */}
                <div
                  ref={bodyEditorRef}
                  contentEditable
                  onInput={handleBodyChange}
                  className="w-full min-h-[300px] px-4 py-3 border border-gray-300 rounded-b-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none prose prose-sm max-w-none"
                  style={{ whiteSpace: 'pre-wrap' }}
                />
                <p className="text-xs text-gray-500 mt-1">Click on a variable in the panel to insert it at cursor position</p>
              </div>
            </div>
          </div>

          {/* Variables Panel */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 sticky top-24">
              <div className="flex items-center gap-2 mb-4">
                <Code className={`w-5 h-5 text-${fullColor}`} />
                <h2 className="text-lg font-semibold text-gray-900">Template Variables</h2>
              </div>
              <p className="text-sm text-gray-500 mb-4">
                Click to insert or copy variables that will be replaced with actual data when sent.
              </p>

              <div className="space-y-3">
                {variableGroups.map(group => (
                  <div key={group.name} className="border border-gray-200 rounded-lg overflow-hidden">
                    <button
                      type="button"
                      onClick={() => toggleGroup(group.name)}
                      className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 transition-colors"
                    >
                      <span className="font-medium text-gray-700">{formatGroupName(group.name)}</span>
                      {expandedGroups[group.name] ? (
                        <ChevronUp className="w-4 h-4 text-gray-500" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-gray-500" />
                      )}
                    </button>
                    {expandedGroups[group.name] && (
                      <div className="p-3 space-y-2 max-h-64 overflow-y-auto">
                        {group.variables.map(variable => (
                          <div
                            key={variable.name}
                            className="flex items-center justify-between p-2 bg-gray-50 rounded-lg hover:bg-gray-100 group"
                          >
                            <div className="flex-1 min-w-0">
                              <button
                                type="button"
                                onClick={() => insertVariable(variable.name)}
                                className={`text-sm font-mono text-${fullColor} hover:underline block truncate`}
                              >
                                {'{{ ' + variable.name + ' }}'}
                              </button>
                              <p className="text-xs text-gray-500 truncate">{variable.description}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => copyVariable(variable.name)}
                              className="ml-2 p-1.5 text-gray-400 hover:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity"
                              title="Copy to clipboard"
                            >
                              {copiedVariable === variable.name ? (
                                <span className="text-xs text-green-600">Copied!</span>
                              ) : (
                                <Copy className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        ))}
                        {group.variables.length === 0 && (
                          <p className="text-sm text-gray-400 text-center py-2">No variables available</p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                <div className="flex items-start gap-2">
                  <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-blue-700">
                    Variables are automatically replaced with recipient-specific data when emails are sent. Use them to personalize your emails.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Preview Modal */}
      {showPreview && previewData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Template Preview</h3>
                <p className="text-sm text-gray-500">Variables replaced with sample data</p>
              </div>
              <button
                onClick={() => setShowPreview(false)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <div className="mb-4">
                <label className="text-sm font-medium text-gray-500">Subject</label>
                <p className="text-gray-900 mt-1 font-medium">{previewData.subject}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Body</label>
                <div 
                  className="mt-2 prose prose-sm max-w-none border border-gray-200 rounded-lg p-4 bg-gray-50"
                  dangerouslySetInnerHTML={{ __html: previewData.body }}
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-200 bg-gray-50">
              <StandardButton variant="secondary" onClick={() => setShowPreview(false)}>
                Close Preview
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

export default EditEmailTemplate;
