// src/pages/admin/email/CreateEmailCampaign.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Send,
  Eye,
  Mail,
  Users,
  UserCheck,
  Building2,
  MapPin,
  Plus,
  X,
  Info,
  ChevronDown,
  ChevronUp,
  Copy,
  Code,
  TestTube,
  Loader2
} from 'lucide-react';
import { useThemeColor } from '../../../hooks/useThemeColor';
import { emailCampaignService } from '../../../services/EmailCampaignService';
import { locationService } from '../../../services/LocationService';
import StandardButton from '../../../components/ui/StandardButton';
import Toast from '../../../components/ui/Toast';
import { getStoredUser } from '../../../utils/storage';
import type { 
  CreateEmailCampaignData, 
  RecipientType, 
  EmailTemplate,
  EmailTemplateVariable,
  PreviewRecipientsResponse
} from '../../../types/EmailCampaign.types';

interface VariableGroup {
  name: string;
  variables: EmailTemplateVariable[];
}

const CreateEmailCampaign: React.FC = () => {
  const navigate = useNavigate();
  const { themeColor, fullColor } = useThemeColor();
  const currentUser = getStoredUser();
  const isCompanyAdmin = currentUser?.role === 'company_admin';
  const bodyEditorRef = useRef<HTMLDivElement>(null);

  // Form state
  const [formData, setFormData] = useState<CreateEmailCampaignData>({
    name: '',
    subject: '',
    body: '',
    recipient_types: [],
    custom_emails: [],
    recipient_filters: {},
    send_now: true,
    location_id: undefined
  });
  const [customEmailInput, setCustomEmailInput] = useState('');
  const [locations, setLocations] = useState<Array<{ id: number; name: string }>>([]);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  
  // Preview states
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState<{ subject: string; body: string } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [recipientPreview, setRecipientPreview] = useState<PreviewRecipientsResponse['data'] | null>(null);
  const [recipientPreviewLoading, setRecipientPreviewLoading] = useState(false);

  // Test email state
  const [showTestEmailModal, setShowTestEmailModal] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [sendingTest, setSendingTest] = useState(false);

  // Variables panel state
  const [variableGroups, setVariableGroups] = useState<VariableGroup[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    default: true,
    customer: false,
    user: false
  });
  const [copiedVariable, setCopiedVariable] = useState<string | null>(null);
  const [showVariables, setShowVariables] = useState(false);

  // Recipient types configuration
  const recipientTypeConfig: Record<RecipientType, { label: string; icon: React.ElementType; description: string }> = {
    customers: { label: 'Customers', icon: Users, description: 'All active customers' },
    attendants: { label: 'Attendants', icon: UserCheck, description: 'Staff members at location' },
    company_admin: { label: 'Company Admins', icon: Building2, description: 'Company administrators' },
    location_managers: { label: 'Location Managers', icon: MapPin, description: 'Location managers' },
    custom: { label: 'Custom Emails', icon: Mail, description: 'Add specific email addresses' }
  };

  // Fetch initial data
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch locations for company admin
        if (isCompanyAdmin) {
          const locResponse = await locationService.getLocations();
          if (locResponse.success && locResponse.data) {
            setLocations(locResponse.data);
          }
        }

        // Fetch active templates
        const templateResponse = await emailCampaignService.getTemplates({ status: 'active', per_page: 100 });
        if (templateResponse.success) {
          setTemplates(templateResponse.data.data);
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
      }
    };
    fetchData();
  }, [isCompanyAdmin]);

  // Preview recipients when selection changes
  const previewRecipients = useCallback(async () => {
    if (formData.recipient_types.length === 0 && (!formData.custom_emails || formData.custom_emails.length === 0)) {
      setRecipientPreview(null);
      return;
    }

    try {
      setRecipientPreviewLoading(true);
      const response = await emailCampaignService.previewRecipients({
        recipient_types: formData.recipient_types,
        custom_emails: formData.custom_emails,
        recipient_filters: formData.recipient_filters,
        location_id: formData.location_id
      });
      
      if (response.success) {
        setRecipientPreview(response.data);
      }
    } catch (error) {
      console.error('Error previewing recipients:', error);
    } finally {
      setRecipientPreviewLoading(false);
    }
  }, [formData.recipient_types, formData.custom_emails, formData.recipient_filters, formData.location_id]);

  useEffect(() => {
    const debounce = setTimeout(() => {
      previewRecipients();
    }, 500);
    return () => clearTimeout(debounce);
  }, [previewRecipients]);

  // Handle input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'location_id' ? (value ? parseInt(value) : undefined) : value
    }));
  };

  // Handle template selection
  const handleTemplateSelect = (templateId: number | null) => {
    setSelectedTemplate(templateId);
    if (templateId) {
      const template = templates.find(t => t.id === templateId);
      if (template) {
        setFormData(prev => ({
          ...prev,
          subject: template.subject,
          body: template.body,
          email_template_id: templateId
        }));
        if (bodyEditorRef.current) {
          bodyEditorRef.current.innerHTML = template.body;
        }
      }
    }
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

  // Toggle recipient type
  const toggleRecipientType = (type: RecipientType) => {
    setFormData(prev => {
      const types = prev.recipient_types.includes(type)
        ? prev.recipient_types.filter(t => t !== type)
        : [...prev.recipient_types, type];
      return { ...prev, recipient_types: types };
    });
  };

  // Add custom email
  const addCustomEmail = () => {
    const email = customEmailInput.trim().toLowerCase();
    if (!email) return;
    
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setToast({ message: 'Please enter a valid email address', type: 'error' });
      return;
    }

    if (formData.custom_emails?.includes(email)) {
      setToast({ message: 'Email already added', type: 'error' });
      return;
    }

    setFormData(prev => ({
      ...prev,
      custom_emails: [...(prev.custom_emails || []), email]
    }));
    setCustomEmailInput('');

    // Ensure custom is in recipient_types
    if (!formData.recipient_types.includes('custom')) {
      setFormData(prev => ({
        ...prev,
        recipient_types: [...prev.recipient_types, 'custom']
      }));
    }
  };

  // Remove custom email
  const removeCustomEmail = (email: string) => {
    setFormData(prev => {
      const newEmails = prev.custom_emails?.filter(e => e !== email) || [];
      // Remove custom type if no more custom emails
      const newTypes = newEmails.length === 0 
        ? prev.recipient_types.filter(t => t !== 'custom')
        : prev.recipient_types;
      return { ...prev, custom_emails: newEmails, recipient_types: newTypes };
    });
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

  // Preview email content
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
      console.error('Error previewing email:', error);
      setToast({ message: 'Failed to preview email', type: 'error' });
    } finally {
      setPreviewLoading(false);
    }
  };

  // Send test email
  const handleSendTestEmail = async () => {
    if (!testEmail.trim()) {
      setToast({ message: 'Please enter a test email address', type: 'error' });
      return;
    }
    if (!formData.subject || !formData.body) {
      setToast({ message: 'Please enter subject and body before sending test', type: 'error' });
      return;
    }

    try {
      setSendingTest(true);
      const response = await emailCampaignService.sendTestEmail({
        subject: formData.subject,
        body: formData.body,
        test_email: testEmail.trim()
      });
      
      if (response.success) {
        setToast({ message: `Test email sent to ${testEmail}`, type: 'success' });
        setShowTestEmailModal(false);
        setTestEmail('');
      }
    } catch (error) {
      console.error('Error sending test email:', error);
      setToast({ message: 'Failed to send test email', type: 'error' });
    } finally {
      setSendingTest(false);
    }
  };

  // Send campaign
  const handleSend = async () => {
    // Validation
    if (!formData.name.trim()) {
      setToast({ message: 'Please enter a campaign name', type: 'error' });
      return;
    }
    if (!formData.subject.trim()) {
      setToast({ message: 'Please enter an email subject', type: 'error' });
      return;
    }
    if (!formData.body.trim()) {
      setToast({ message: 'Please enter email body content', type: 'error' });
      return;
    }
    if (formData.recipient_types.length === 0) {
      setToast({ message: 'Please select at least one recipient type', type: 'error' });
      return;
    }
    if (formData.recipient_types.includes('custom') && (!formData.custom_emails || formData.custom_emails.length === 0)) {
      setToast({ message: 'Please add at least one custom email address', type: 'error' });
      return;
    }

    try {
      setLoading(true);
      const response = await emailCampaignService.createCampaign({
        ...formData,
        send_now: true
      });

      if (response.success) {
        setToast({ message: `Campaign sent to ${response.data.total_recipients} recipients!`, type: 'success' });
        setTimeout(() => {
          navigate('/admin/email/campaigns');
        }, 1500);
      }
    } catch (error) {
      console.error('Error sending campaign:', error);
      setToast({ message: 'Failed to send campaign', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // Basic text formatting
  const formatText = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    handleBodyChange();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
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
                  <Send className={`w-6 h-6 text-${fullColor}`} />
                  Create Email Campaign
                </h1>
                <p className="text-sm text-gray-500">Send bulk emails to selected recipients</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <StandardButton
                variant="secondary"
                icon={TestTube}
                onClick={() => setShowTestEmailModal(true)}
              >
                Send Test
              </StandardButton>
              <StandardButton
                variant="secondary"
                icon={Eye}
                onClick={handlePreview}
                disabled={previewLoading}
              >
                Preview
              </StandardButton>
              <StandardButton
                variant="primary"
                icon={Send}
                onClick={handleSend}
                disabled={loading}
                loading={loading}
              >
                Send Campaign
              </StandardButton>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Campaign Info */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Campaign Information</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Campaign Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="e.g., January Newsletter"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                {isCompanyAdmin && locations.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Location
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
              </div>

              {/* Template Selection */}
              {templates.length > 0 && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Use Template (Optional)
                  </label>
                  <select
                    value={selectedTemplate || ''}
                    onChange={(e) => handleTemplateSelect(e.target.value ? parseInt(e.target.value) : null)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Start from scratch</option>
                    {templates.map(template => (
                      <option key={template.id} value={template.id}>{template.name}</option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    Select a template to pre-fill the subject and body, or{' '}
                    <Link to="/admin/email/templates/create" className={`text-${fullColor} hover:underline`}>
                      create a new template
                    </Link>
                  </p>
                </div>
              )}
            </div>

            {/* Recipients Selection */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Recipients</h2>
                {recipientPreview && (
                  <span className={`px-3 py-1 rounded-full text-sm font-medium bg-${themeColor}-100 text-${fullColor}`}>
                    {recipientPreviewLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin inline" />
                    ) : (
                      `${recipientPreview.total_recipients} recipients`
                    )}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                {(Object.keys(recipientTypeConfig) as RecipientType[]).filter(type => type !== 'custom').map(type => {
                  const config = recipientTypeConfig[type];
                  const Icon = config.icon;
                  const isSelected = formData.recipient_types.includes(type);
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => toggleRecipientType(type)}
                      className={`flex items-center gap-3 p-4 rounded-lg border-2 transition-colors text-left ${
                        isSelected 
                          ? `border-${themeColor}-500 bg-${themeColor}-50` 
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className={`p-2 rounded-lg ${isSelected ? `bg-${themeColor}-100` : 'bg-gray-100'}`}>
                        <Icon className={`w-5 h-5 ${isSelected ? `text-${fullColor}` : 'text-gray-500'}`} />
                      </div>
                      <div>
                        <p className={`font-medium ${isSelected ? `text-${fullColor}` : 'text-gray-900'}`}>
                          {config.label}
                        </p>
                        <p className="text-xs text-gray-500">{config.description}</p>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Custom Emails */}
              <div className="border-t border-gray-200 pt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Custom Email Addresses
                </label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="email"
                    value={customEmailInput}
                    onChange={(e) => setCustomEmailInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCustomEmail())}
                    placeholder="Enter email address..."
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <StandardButton variant="secondary" icon={Plus} onClick={addCustomEmail}>
                    Add
                  </StandardButton>
                </div>
                {formData.custom_emails && formData.custom_emails.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {formData.custom_emails.map(email => (
                      <span
                        key={email}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 rounded-full text-sm"
                      >
                        {email}
                        <button
                          type="button"
                          onClick={() => removeCustomEmail(email)}
                          className="text-gray-400 hover:text-red-500"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Recipient Preview */}
              {recipientPreview && recipientPreview.total_recipients > 0 && (
                <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Recipient Breakdown</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(recipientPreview.by_type).map(([type, count]) => (
                      <div key={type} className="flex items-center justify-between text-sm">
                        <span className="text-gray-600 capitalize">{type.replace('_', ' ')}</span>
                        <span className="font-medium text-gray-900">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Email Content */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Email Content</h2>
                <button
                  type="button"
                  onClick={() => setShowVariables(!showVariables)}
                  className={`flex items-center gap-1 text-sm ${showVariables ? `text-${fullColor}` : 'text-gray-500 hover:text-gray-700'}`}
                >
                  <Code className="w-4 h-4" />
                  {showVariables ? 'Hide Variables' : 'Show Variables'}
                </button>
              </div>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Subject Line <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="subject"
                  value={formData.subject}
                  onChange={handleInputChange}
                  placeholder="e.g., Happy New Year from {{ company_name }}!"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email Body <span className="text-red-500">*</span>
                </label>
                
                {/* Simple Toolbar */}
                <div className="flex items-center gap-1 p-2 border border-gray-300 border-b-0 rounded-t-lg bg-gray-50">
                  <button type="button" onClick={() => formatText('bold')} className="p-2 hover:bg-gray-200 rounded font-bold" title="Bold">B</button>
                  <button type="button" onClick={() => formatText('italic')} className="p-2 hover:bg-gray-200 rounded italic" title="Italic">I</button>
                  <button type="button" onClick={() => formatText('underline')} className="p-2 hover:bg-gray-200 rounded underline" title="Underline">U</button>
                  <div className="w-px h-6 bg-gray-300 mx-1" />
                  <button type="button" onClick={() => formatText('insertUnorderedList')} className="p-2 hover:bg-gray-200 rounded text-sm" title="Bullet List">• List</button>
                  <button type="button" onClick={() => formatText('insertOrderedList')} className="p-2 hover:bg-gray-200 rounded text-sm" title="Numbered List">1. List</button>
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
                  className="w-full min-h-[250px] px-4 py-3 border border-gray-300 rounded-b-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none prose prose-sm max-w-none"
                  style={{ whiteSpace: 'pre-wrap' }}
                />
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-6">
            {/* Variables Panel (collapsible) */}
            {showVariables && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Code className={`w-5 h-5 text-${fullColor}`} />
                  <h2 className="text-lg font-semibold text-gray-900">Template Variables</h2>
                </div>
                <p className="text-sm text-gray-500 mb-4">
                  Click to insert variables into email body.
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
                        <div className="p-3 space-y-2 max-h-48 overflow-y-auto">
                          {group.variables.map(variable => (
                            <div
                              key={variable.name}
                              className="flex items-center justify-between p-2 bg-gray-50 rounded-lg hover:bg-gray-100 group"
                            >
                              <div className="flex-1 min-w-0">
                                <button
                                  type="button"
                                  onClick={() => insertVariable(variable.name)}
                                  className={`text-xs font-mono text-${fullColor} hover:underline block truncate`}
                                >
                                  {'{{ ' + variable.name + ' }}'}
                                </button>
                                <p className="text-xs text-gray-500 truncate">{variable.description}</p>
                              </div>
                              <button
                                type="button"
                                onClick={() => copyVariable(variable.name)}
                                className="ml-2 p-1 text-gray-400 hover:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity"
                                title="Copy"
                              >
                                {copiedVariable === variable.name ? (
                                  <span className="text-xs text-green-600">✓</span>
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tips */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Info className={`w-5 h-5 text-${fullColor}`} />
                Tips
              </h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-start gap-2">
                  <span className={`text-${fullColor} mt-1`}>•</span>
                  Always send a test email before sending to all recipients
                </li>
                <li className="flex items-start gap-2">
                  <span className={`text-${fullColor} mt-1`}>•</span>
                  Use variables to personalize your emails
                </li>
                <li className="flex items-start gap-2">
                  <span className={`text-${fullColor} mt-1`}>•</span>
                  Keep your subject line clear and engaging
                </li>
                <li className="flex items-start gap-2">
                  <span className={`text-${fullColor} mt-1`}>•</span>
                  Preview your email to see how it looks
                </li>
              </ul>
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
                <h3 className="text-lg font-semibold text-gray-900">Email Preview</h3>
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
                Close
              </StandardButton>
            </div>
          </div>
        </div>
      )}

      {/* Test Email Modal */}
      {showTestEmailModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className={`p-3 bg-${themeColor}-100 rounded-full`}>
                <TestTube className={`w-6 h-6 text-${fullColor}`} />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Send Test Email</h3>
                <p className="text-sm text-gray-500">Preview how your email will look</p>
              </div>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Test Email Address
              </label>
              <input
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="Enter your email..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div className="flex items-center gap-3 justify-end">
              <StandardButton variant="secondary" onClick={() => setShowTestEmailModal(false)}>
                Cancel
              </StandardButton>
              <StandardButton
                variant="primary"
                icon={Send}
                onClick={handleSendTestEmail}
                loading={sendingTest}
                disabled={sendingTest || !testEmail.trim()}
              >
                Send Test
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

export default CreateEmailCampaign;
