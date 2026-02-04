// src/pages/admin/email/CreateEmailNotification.tsx
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Save,
  Eye,
  Copy,
  X,
  Bell,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  List,
  ListOrdered,
  Link as LinkIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Heading1,
  Heading2,
  Quote,
  Type,
  Highlighter,
  Loader2,
  Check,
  Calendar,
  Ticket,
  CreditCard,
  Clock,
  QrCode,
  Plus,
  ChevronDown,
  ChevronUp,
  Info,
  Code,
  Image,
  Undo2,
  Redo2
} from 'lucide-react';
import { useThemeColor } from '../../../hooks/useThemeColor';
import { emailNotificationService } from '../../../services/EmailNotificationService';
import { emailCampaignService } from '../../../services/EmailCampaignService';
import { locationService } from '../../../services/LocationService';
import StandardButton from '../../../components/ui/StandardButton';
import Toast from '../../../components/ui/Toast';
import { getStoredUser } from '../../../utils/storage';
import type { 
  CreateEmailNotificationData, 
  TriggerType, 
  EntityType, 
  RecipientType 
} from '../../../types/EmailNotification.types';
import type { EmailTemplate } from '../../../types/EmailCampaign.types';

interface VariableItem {
  name: string;
  description: string;
}

interface VariableGroup {
  name: string;
  variables: VariableItem[];
}

const CreateEmailNotification: React.FC = () => {
  const navigate = useNavigate();
  const { themeColor, fullColor } = useThemeColor();
  const currentUser = getStoredUser();
  const isCompanyAdmin = currentUser?.role === 'company_admin';
  const bodyEditorRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [formData, setFormData] = useState<CreateEmailNotificationData>({
    name: '',
    trigger_type: 'booking_created',
    entity_type: 'all',
    entity_ids: [],
    location_id: undefined,
    email_template_id: undefined,
    subject: '',
    body: '',
    recipient_types: ['customer'],
    custom_emails: [],
    include_qr_code: false,
    is_active: true,
    send_before_hours: undefined,
    send_after_hours: undefined
  });

  // UI state
  const [locations, setLocations] = useState<Array<{ id: number; name: string }>>([]);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [entities, setEntities] = useState<Array<{ id: number; name: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [useTemplate, setUseTemplate] = useState(false);
  const [customEmail, setCustomEmail] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [showImageSizeModal, setShowImageSizeModal] = useState(false);
  const [pendingImageFile, setPendingImageFile] = useState<File | null>(null);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkText, setLinkText] = useState('');
  
  // Variables panel state
  const [variableGroups, setVariableGroups] = useState<VariableGroup[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [copiedVariable, setCopiedVariable] = useState<string | null>(null);

  // Trigger type configurations
  const bookingTriggers = [
    { value: 'booking_created', label: 'Booking Created' },
    { value: 'booking_confirmed', label: 'Booking Confirmed' },
    { value: 'booking_updated', label: 'Booking Updated' },
    { value: 'booking_rescheduled', label: 'Booking Rescheduled' },
    { value: 'booking_cancelled', label: 'Booking Cancelled' },
    { value: 'booking_checked_in', label: 'Booking Checked In' },
    { value: 'booking_completed', label: 'Booking Completed' },
    { value: 'booking_reminder', label: 'Booking Reminder' },
    { value: 'booking_followup', label: 'Booking Follow-up' },
    { value: 'booking_no_show', label: 'Booking No-Show' },
  ];

  const purchaseTriggers = [
    { value: 'purchase_created', label: 'Purchase Created' },
    { value: 'purchase_confirmed', label: 'Purchase Confirmed' },
    { value: 'purchase_cancelled', label: 'Purchase Cancelled' },
    { value: 'purchase_completed', label: 'Purchase Completed' },
    { value: 'purchase_checked_in', label: 'Purchase Checked In' },
    { value: 'purchase_refunded', label: 'Purchase Refunded' },
    { value: 'purchase_reminder', label: 'Purchase Reminder' },
    { value: 'purchase_followup', label: 'Purchase Follow-up' },
  ];

  const paymentTriggers = [
    { value: 'payment_received', label: 'Payment Received' },
    { value: 'payment_failed', label: 'Payment Failed' },
    { value: 'payment_refunded', label: 'Payment Refunded' },
    { value: 'payment_partial', label: 'Partial Payment' },
    { value: 'payment_pending', label: 'Payment Pending' },
  ];

  // Get available triggers based on entity type
  const getAvailableTriggers = () => {
    const entityType = formData.entity_type;
    if (entityType === 'package') {
      return [
        { label: 'Booking Events', icon: Calendar, options: bookingTriggers },
        { label: 'Payment Events', icon: CreditCard, options: paymentTriggers },
      ];
    } else if (entityType === 'attraction') {
      return [
        { label: 'Purchase Events', icon: Ticket, options: purchaseTriggers },
        { label: 'Payment Events', icon: CreditCard, options: paymentTriggers },
      ];
    } else {
      return [
        { label: 'Booking Events', icon: Calendar, options: bookingTriggers },
        { label: 'Purchase Events', icon: Ticket, options: purchaseTriggers },
        { label: 'Payment Events', icon: CreditCard, options: paymentTriggers },
      ];
    }
  };

  // Recipient type options
  const recipientTypeOptions: Array<{ value: RecipientType; label: string }> = [
    { value: 'customer', label: 'Customer' },
    { value: 'staff', label: 'Staff' },
    { value: 'company_admin', label: 'Company Admin' },
    { value: 'location_manager', label: 'Location Manager' },
    { value: 'custom', label: 'Custom Emails' },
  ];

  const isReminderTrigger = formData.trigger_type.endsWith('_reminder');
  const isFollowupTrigger = formData.trigger_type.endsWith('_followup');

  // Fetch initial data
  useEffect(() => {
    const fetchData = async () => {
      try {
        if (isCompanyAdmin) {
          const locResponse = await locationService.getLocations();
          if (locResponse.success && locResponse.data) {
            setLocations(locResponse.data);
          }
        }
        const templateResponse = await emailCampaignService.getTemplates({ status: 'active', per_page: 100 });
        if (templateResponse.success && templateResponse.data) {
          setTemplates(templateResponse.data.data);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };
    fetchData();
  }, [isCompanyAdmin]);

  // Reset trigger when entity type changes
  useEffect(() => {
    const availableTriggers = getAvailableTriggers();
    const allOptions = availableTriggers.flatMap(g => g.options.map(o => o.value));
    if (!allOptions.includes(formData.trigger_type)) {
      if (allOptions.length > 0) {
        setFormData(prev => ({ ...prev, trigger_type: allOptions[0] as TriggerType }));
      }
    }
  }, [formData.entity_type]);

  // Fetch variables when trigger type changes
  useEffect(() => {
    const fetchVariables = async () => {
      try {
        const response = await emailNotificationService.getVariables(formData.trigger_type);
        if (response.success && response.data) {
          const groups: VariableGroup[] = [];
          if (response.data.specific) {
            Object.entries(response.data.specific).forEach(([groupName, vars]) => {
              if (vars && typeof vars === 'object') {
                groups.push({
                  name: groupName,
                  variables: Object.entries(vars).map(([name, description]) => ({
                    name,
                    description: String(description)
                  }))
                });
              }
            });
          }
          if (response.data.common) {
            Object.entries(response.data.common).forEach(([groupName, vars]) => {
              if (vars && typeof vars === 'object') {
                groups.push({
                  name: groupName,
                  variables: Object.entries(vars).map(([name, description]) => ({
                    name,
                    description: String(description)
                  }))
                });
              }
            });
          }
          setVariableGroups(groups);
          // Expand first group by default
          if (groups.length > 0) {
            setExpandedGroups({ [groups[0].name]: true });
          }
        }
      } catch (error) {
        console.error('Error fetching variables:', error);
      }
    };
    fetchVariables();
  }, [formData.trigger_type]);

  // Fetch entities when entity type changes
  useEffect(() => {
    if (formData.entity_type === 'all') {
      setEntities([]);
      setFormData(prev => ({ ...prev, entity_ids: [] }));
      return;
    }
    const fetchEntities = async () => {
      try {
        const response = await emailNotificationService.getEntities(formData.entity_type, formData.location_id || undefined);
        if (response.success && response.data) {
          setEntities(response.data);
        }
      } catch (error) {
        console.error('Error fetching entities:', error);
      }
    };
    fetchEntities();
  }, [formData.entity_type, formData.location_id]);

  // Handle input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else if (name === 'location_id' || name === 'email_template_id' || name === 'send_before_hours' || name === 'send_after_hours') {
      setFormData(prev => ({ ...prev, [name]: value ? parseInt(value) : undefined }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  // Handle entity type change
  const handleEntityTypeChange = (entityType: EntityType) => {
    setFormData(prev => ({ ...prev, entity_type: entityType, entity_ids: [] }));
  };

  // Handle recipient type toggle
  const handleRecipientTypeToggle = (type: RecipientType) => {
    setFormData(prev => {
      const types = prev.recipient_types?.includes(type)
        ? prev.recipient_types.filter(t => t !== type)
        : [...(prev.recipient_types || []), type];
      if (type === 'custom' && !types.includes('custom')) {
        return { ...prev, recipient_types: types, custom_emails: [] };
      }
      return { ...prev, recipient_types: types };
    });
  };

  // Add custom email
  const addCustomEmail = () => {
    const email = customEmail.trim().toLowerCase();
    if (!email) return;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setToast({ message: 'Please enter a valid email address', type: 'error' });
      return;
    }
    if (formData.custom_emails?.includes(email)) {
      setToast({ message: 'Email already added', type: 'error' });
      return;
    }
    setFormData(prev => ({ ...prev, custom_emails: [...(prev.custom_emails || []), email] }));
    setCustomEmail('');
  };

  // Remove custom email
  const removeCustomEmail = (email: string) => {
    setFormData(prev => ({ ...prev, custom_emails: prev.custom_emails?.filter(e => e !== email) || [] }));
  };

  // Handle body content change
  const handleBodyChange = () => {
    if (bodyEditorRef.current) {
      setFormData(prev => ({ ...prev, body: bodyEditorRef.current?.innerHTML || '' }));
    }
  };

  // Toolbar click handler
  const handleToolbarClick = (e: React.MouseEvent, command: string, value?: string) => {
    e.preventDefault();
    e.stopPropagation();
    document.execCommand(command, false, value);
    handleBodyChange();
  };

  // Apply text color
  const applyTextColor = (color: string) => {
    if (bodyEditorRef.current) {
      bodyEditorRef.current.focus();
      document.execCommand('foreColor', false, color);
      handleBodyChange();
    }
  };

  // Apply highlight
  const applyHighlight = (color: string) => {
    if (bodyEditorRef.current) {
      bodyEditorRef.current.focus();
      document.execCommand('hiliteColor', false, color);
      handleBodyChange();
    }
  };

  // Insert link
  const insertLink = () => {
    if (!linkUrl.trim()) {
      setToast({ message: 'Please enter a URL', type: 'error' });
      return;
    }
    const url = linkUrl.startsWith('http') ? linkUrl : `https://${linkUrl}`;
    const text = linkText.trim() || url;
    if (bodyEditorRef.current) {
      bodyEditorRef.current.focus();
      const linkHtml = `<a href="${url}" target="_blank" style="color: #3182ce; text-decoration: underline;">${text}</a>`;
      document.execCommand('insertHTML', false, linkHtml);
      handleBodyChange();
    }
    setShowLinkModal(false);
    setLinkUrl('');
    setLinkText('');
  };

  // Handle image file selection - show size modal
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setToast({ message: 'Please select a valid image file (PNG, JPG, GIF, WebP)', type: 'error' });
      if (imageInputRef.current) imageInputRef.current.value = '';
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      setToast({ message: 'Image must be less than 5MB', type: 'error' });
      if (imageInputRef.current) imageInputRef.current.value = '';
      return;
    }

    // Store file and show size picker modal
    setPendingImageFile(file);
    setShowImageSizeModal(true);
  };

  // Upload and insert image with selected size
  const handleImageUpload = async (maxWidth: string) => {
    if (!pendingImageFile) return;

    try {
      setUploadingImage(true);
      setShowImageSizeModal(false);
      
      const response = await emailCampaignService.uploadImage(pendingImageFile);
      
      if (response.success) {
        // Insert image at cursor position with chosen size
        if (bodyEditorRef.current) {
          bodyEditorRef.current.focus();
          const imgHtml = `<img src="${response.data.url}" alt="${response.data.original_name}" style="max-width: ${maxWidth}; height: auto; display: block; margin: 10px 0;" />`;
          document.execCommand('insertHTML', false, imgHtml);
          handleBodyChange();
        }
        setToast({ message: 'Image uploaded and inserted!', type: 'success' });
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      setToast({ message: 'Failed to upload image', type: 'error' });
    } finally {
      setUploadingImage(false);
      setPendingImageFile(null);
      if (imageInputRef.current) imageInputRef.current.value = '';
    }
  };

  // Insert variable
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

  // Copy variable
  const copyVariable = (variable: string) => {
    navigator.clipboard.writeText(`{{ ${variable} }}`);
    setCopiedVariable(variable);
    setTimeout(() => setCopiedVariable(null), 2000);
  };

  // Toggle variable group - only one open at a time
  const toggleGroup = (groupName: string) => {
    setExpandedGroups(prev => {
      const isCurrentlyOpen = prev[groupName];
      // Close all groups, then toggle the clicked one
      const allClosed = Object.keys(prev).reduce((acc, key) => ({ ...acc, [key]: false }), {} as Record<string, boolean>);
      return { ...allClosed, [groupName]: !isCurrentlyOpen };
    });
  };

  // Format group name
  const formatGroupName = (name: string) => {
    return name.charAt(0).toUpperCase() + name.slice(1).replace(/_/g, ' ') + ' Variables';
  };

  // Handle form submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name?.trim()) {
      setToast({ message: 'Please enter a notification name', type: 'error' });
      return;
    }
    if (!formData.recipient_types || formData.recipient_types.length === 0) {
      setToast({ message: 'Please select at least one recipient type', type: 'error' });
      return;
    }
    if (formData.recipient_types.includes('custom') && (!formData.custom_emails || formData.custom_emails.length === 0)) {
      setToast({ message: 'Please add at least one custom email address', type: 'error' });
      return;
    }
    if (!useTemplate && !formData.subject?.trim()) {
      setToast({ message: 'Please enter an email subject', type: 'error' });
      return;
    }
    if (!useTemplate && !formData.body?.trim()) {
      setToast({ message: 'Please enter an email body', type: 'error' });
      return;
    }
    if (isReminderTrigger && !formData.send_before_hours) {
      setToast({ message: 'Please specify hours before event for reminder', type: 'error' });
      return;
    }
    if (isFollowupTrigger && !formData.send_after_hours) {
      setToast({ message: 'Please specify hours after event for follow-up', type: 'error' });
      return;
    }

    try {
      setLoading(true);
      const submitData: CreateEmailNotificationData = {
        ...formData,
        email_template_id: useTemplate ? formData.email_template_id : undefined,
        subject: useTemplate ? undefined : formData.subject,
        body: useTemplate ? undefined : formData.body,
      };
      const response = await emailNotificationService.create(submitData);
      if (response.success) {
        setToast({ message: 'Email notification created successfully', type: 'success' });
        setTimeout(() => navigate('/admin/email/notifications'), 1500);
      }
    } catch (error: unknown) {
      console.error('Error creating notification:', error);
      setToast({ message: 'Failed to create notification', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const availableTriggers = getAvailableTriggers();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/admin/email/notifications')}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <Bell className={`w-6 h-6 text-${fullColor}`} />
                  Create Email Notification
                </h1>
                <p className="text-sm text-gray-500">Set up automated email notifications for events</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <StandardButton
                variant="secondary"
                icon={Eye}
                onClick={() => setShowPreview(true)}
              >
                Preview
              </StandardButton>
              <StandardButton
                variant="primary"
                icon={loading ? Loader2 : Save}
                onClick={handleSubmit}
                disabled={loading}
                loading={loading}
              >
                Create Notification
              </StandardButton>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Basic Info & Trigger Config */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Notification Settings</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notification Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="e.g., Booking Confirmation Email"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                {isCompanyAdmin && locations.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
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
                    Apply To <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.entity_type}
                    onChange={(e) => handleEntityTypeChange(e.target.value as EntityType)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="all">All (Packages & Attractions)</option>
                    <option value="package">Packages Only</option>
                    <option value="attraction">Attractions Only</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Trigger Event <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.trigger_type}
                    onChange={(e) => setFormData(prev => ({ 
                      ...prev, 
                      trigger_type: e.target.value as TriggerType,
                      send_before_hours: undefined,
                      send_after_hours: undefined
                    }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {availableTriggers.map((group) => (
                      <optgroup key={group.label} label={group.label}>
                        {group.options.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>

                {/* Timing for Reminder/Follow-up */}
                {(isReminderTrigger || isFollowupTrigger) && (
                  <div className="md:col-span-2">
                    <div className={`flex items-center gap-3 p-3 rounded-lg border bg-${themeColor}-50 border-${themeColor}-200`}>
                      <Clock className={`w-4 h-4 text-${fullColor}`} />
                      <span className={`text-sm text-${fullColor}`}>Send</span>
                      <input
                        type="number"
                        name={isReminderTrigger ? 'send_before_hours' : 'send_after_hours'}
                        value={isReminderTrigger ? formData.send_before_hours || '' : formData.send_after_hours || ''}
                        onChange={handleInputChange}
                        min="1"
                        placeholder="24"
                        className={`w-20 border border-${themeColor}-300 rounded px-2 py-1 text-sm`}
                      />
                      <span className={`text-sm text-${fullColor}`}>
                        hours {isReminderTrigger ? 'before' : 'after'} the event
                      </span>
                    </div>
                  </div>
                )}

                {/* Entity Selection */}
                {formData.entity_type !== 'all' && entities.length > 0 && (
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Select {formData.entity_type === 'package' ? 'Packages' : 'Attractions'}
                    </label>
                    <div className="max-h-32 overflow-y-auto border border-gray-200 rounded-lg p-2 grid grid-cols-2 md:grid-cols-3 gap-2">
                      {entities.map(entity => (
                        <label key={entity.id} className="flex items-center gap-2 p-2 rounded hover:bg-gray-50 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formData.entity_ids?.includes(entity.id) || false}
                            onChange={() => {
                              setFormData(prev => ({
                                ...prev,
                                entity_ids: prev.entity_ids?.includes(entity.id)
                                  ? prev.entity_ids.filter(id => id !== entity.id)
                                  : [...(prev.entity_ids || []), entity.id]
                              }));
                            }}
                            className={`w-4 h-4 rounded border-gray-300 text-${themeColor}-600 focus:ring-${themeColor}-500`}
                          />
                          <span className="text-sm text-gray-700 truncate">{entity.name}</span>
                        </label>
                      ))}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Leave empty to apply to all</p>
                  </div>
                )}

                <div className="md:col-span-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      name="is_active"
                      checked={formData.is_active}
                      onChange={handleInputChange}
                      className={`w-4 h-4 rounded border-gray-300 text-${themeColor}-600 focus:ring-${themeColor}-500`}
                    />
                    <span className="text-sm text-gray-700">Active (will send emails when triggered)</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Recipients */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Recipients</h2>
              
              <div className="flex flex-wrap gap-2 mb-4">
                {recipientTypeOptions.map(opt => {
                  const isSelected = formData.recipient_types?.includes(opt.value);
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => handleRecipientTypeToggle(opt.value)}
                      className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                        isSelected 
                          ? `border-${themeColor}-500 bg-${themeColor}-50 text-${themeColor}-700` 
                          : 'border-gray-200 hover:border-gray-300 text-gray-700'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>

              {formData.recipient_types?.includes('custom') && (
                <div className="pt-4 border-t border-gray-200">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Custom Email Addresses</label>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="email"
                      value={customEmail}
                      onChange={(e) => setCustomEmail(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addCustomEmail())}
                      placeholder="Enter email address..."
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                    <StandardButton type="button" variant="secondary" icon={Plus} onClick={addCustomEmail}>
                      Add
                    </StandardButton>
                  </div>
                  {formData.custom_emails && formData.custom_emails.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {formData.custom_emails.map(email => (
                        <span key={email} className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 rounded-full text-sm text-gray-700">
                          {email}
                          <button type="button" onClick={() => removeCustomEmail(email)} className="hover:text-red-500">
                            <X className="w-4 h-4" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="pt-4 border-t border-gray-200 mt-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    name="include_qr_code"
                    checked={formData.include_qr_code}
                    onChange={handleInputChange}
                    className={`w-4 h-4 rounded border-gray-300 text-${themeColor}-600 focus:ring-${themeColor}-500`}
                  />
                  <QrCode className="w-4 h-4 text-gray-600" />
                  <span className="text-sm text-gray-700">Include QR code for check-in</span>
                </label>
              </div>
            </div>

            {/* Email Content */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Email Content</h2>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useTemplate}
                    onChange={(e) => setUseTemplate(e.target.checked)}
                    className={`w-4 h-4 rounded border-gray-300 text-${themeColor}-600 focus:ring-${themeColor}-500`}
                  />
                  <span className="text-sm text-gray-700">Use Existing Template</span>
                </label>
              </div>

              {useTemplate ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Select Template</label>
                  <select
                    name="email_template_id"
                    value={formData.email_template_id || ''}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Choose a template...</option>
                    {templates.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Subject Line <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="subject"
                      value={formData.subject || ''}
                      onChange={handleInputChange}
                      placeholder="e.g., Your booking has been confirmed!"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">You can use variables like {'{{ customer_name }}'}</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email Body <span className="text-red-500">*</span>
                    </label>
                    
                    {/* Toolbar */}
                    <div className="flex flex-wrap items-center gap-1 p-2 border border-gray-300 border-b-0 rounded-t-lg bg-gray-50">
                      <button type="button" onMouseDown={(e) => handleToolbarClick(e, 'undo')} className="p-1.5 hover:bg-gray-200 rounded text-gray-600" title="Undo">
                        <Undo2 className="w-4 h-4" />
                      </button>
                      <button type="button" onMouseDown={(e) => handleToolbarClick(e, 'redo')} className="p-1.5 hover:bg-gray-200 rounded text-gray-600" title="Redo">
                        <Redo2 className="w-4 h-4" />
                      </button>
                      <div className="w-px h-5 bg-gray-300 mx-1" />
                      <button type="button" onMouseDown={(e) => handleToolbarClick(e, 'formatBlock', 'p')} className="px-2 py-1 text-xs hover:bg-gray-200 rounded text-gray-600 border border-gray-300 bg-white" title="Normal Text">
                        <Type className="w-4 h-4 inline mr-1" />Normal
                      </button>
                      <div className="w-px h-5 bg-gray-300 mx-1" />
                      <button type="button" onMouseDown={(e) => handleToolbarClick(e, 'bold')} className="p-1.5 hover:bg-gray-200 rounded text-gray-600" title="Bold">
                        <Bold className="w-4 h-4" />
                      </button>
                      <button type="button" onMouseDown={(e) => handleToolbarClick(e, 'italic')} className="p-1.5 hover:bg-gray-200 rounded text-gray-600" title="Italic">
                        <Italic className="w-4 h-4" />
                      </button>
                      <button type="button" onMouseDown={(e) => handleToolbarClick(e, 'underline')} className="p-1.5 hover:bg-gray-200 rounded text-gray-600" title="Underline">
                        <Underline className="w-4 h-4" />
                      </button>
                      <button type="button" onMouseDown={(e) => handleToolbarClick(e, 'strikeThrough')} className="p-1.5 hover:bg-gray-200 rounded text-gray-600" title="Strikethrough">
                        <Strikethrough className="w-4 h-4" />
                      </button>
                      <div className="w-px h-5 bg-gray-300 mx-1" />
                      <div className="flex items-center gap-0.5">
                        <button type="button" onMouseDown={(e) => { e.preventDefault(); applyTextColor('#e53e3e'); }} className="w-5 h-5 rounded border border-gray-300 bg-red-500 hover:ring-2 hover:ring-red-300" title="Red" />
                        <button type="button" onMouseDown={(e) => { e.preventDefault(); applyTextColor('#3182ce'); }} className="w-5 h-5 rounded border border-gray-300 bg-blue-500 hover:ring-2 hover:ring-blue-300" title="Blue" />
                        <button type="button" onMouseDown={(e) => { e.preventDefault(); applyTextColor('#38a169'); }} className="w-5 h-5 rounded border border-gray-300 bg-green-500 hover:ring-2 hover:ring-green-300" title="Green" />
                        <button type="button" onMouseDown={(e) => { e.preventDefault(); applyTextColor('#000000'); }} className="w-5 h-5 rounded border border-gray-300 bg-black hover:ring-2 hover:ring-gray-400" title="Black" />
                      </div>
                      <div className="w-px h-5 bg-gray-300 mx-1" />
                      <button type="button" onMouseDown={(e) => { e.preventDefault(); applyHighlight('#fef08a'); }} className="p-1.5 hover:bg-gray-200 rounded text-yellow-600" title="Highlight">
                        <Highlighter className="w-4 h-4" />
                      </button>
                      <div className="w-px h-5 bg-gray-300 mx-1" />
                      <button type="button" onMouseDown={(e) => handleToolbarClick(e, 'formatBlock', 'h1')} className="p-1.5 hover:bg-gray-200 rounded text-gray-600" title="Heading 1">
                        <Heading1 className="w-4 h-4" />
                      </button>
                      <button type="button" onMouseDown={(e) => handleToolbarClick(e, 'formatBlock', 'h2')} className="p-1.5 hover:bg-gray-200 rounded text-gray-600" title="Heading 2">
                        <Heading2 className="w-4 h-4" />
                      </button>
                      <button type="button" onMouseDown={(e) => handleToolbarClick(e, 'formatBlock', 'blockquote')} className="p-1.5 hover:bg-gray-200 rounded text-gray-600" title="Quote">
                        <Quote className="w-4 h-4" />
                      </button>
                      <div className="w-px h-5 bg-gray-300 mx-1" />
                      <button type="button" onMouseDown={(e) => handleToolbarClick(e, 'justifyLeft')} className="p-1.5 hover:bg-gray-200 rounded text-gray-600" title="Align Left">
                        <AlignLeft className="w-4 h-4" />
                      </button>
                      <button type="button" onMouseDown={(e) => handleToolbarClick(e, 'justifyCenter')} className="p-1.5 hover:bg-gray-200 rounded text-gray-600" title="Align Center">
                        <AlignCenter className="w-4 h-4" />
                      </button>
                      <button type="button" onMouseDown={(e) => handleToolbarClick(e, 'justifyRight')} className="p-1.5 hover:bg-gray-200 rounded text-gray-600" title="Align Right">
                        <AlignRight className="w-4 h-4" />
                      </button>
                      <div className="w-px h-5 bg-gray-300 mx-1" />
                      <button type="button" onMouseDown={(e) => handleToolbarClick(e, 'insertUnorderedList')} className="p-1.5 hover:bg-gray-200 rounded text-gray-600" title="Bullet List">
                        <List className="w-4 h-4" />
                      </button>
                      <button type="button" onMouseDown={(e) => handleToolbarClick(e, 'insertOrderedList')} className="p-1.5 hover:bg-gray-200 rounded text-gray-600" title="Numbered List">
                        <ListOrdered className="w-4 h-4" />
                      </button>
                      <div className="w-px h-5 bg-gray-300 mx-1" />
                      <button type="button" onClick={() => setShowLinkModal(true)} className="p-1.5 hover:bg-gray-200 rounded text-gray-600" title="Insert Link">
                        <LinkIcon className="w-4 h-4" />
                      </button>
                      <button type="button" onClick={() => imageInputRef.current?.click()} disabled={uploadingImage} className="p-1.5 hover:bg-gray-200 rounded text-gray-600 disabled:opacity-50" title="Insert Image">
                        {uploadingImage ? <Loader2 className="w-4 h-4 animate-spin" /> : <Image className="w-4 h-4" />}
                      </button>
                      <input ref={imageInputRef} type="file" accept="image/*" onChange={handleImageSelect} className="hidden" />
                      <button type="button" onMouseDown={(e) => handleToolbarClick(e, 'removeFormat')} className="p-1.5 hover:bg-gray-200 rounded text-gray-600 ml-auto" title="Clear Formatting">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    
                    {/* Editor */}
                    <div className="relative">
                      {!formData.body && (
                        <div className="absolute top-3 left-4 text-gray-400 pointer-events-none select-none z-0">
                          <p className="text-base">Start composing your email...</p>
                          <p className="text-sm mt-2">💡 Click variables on the right to insert them</p>
                        </div>
                      )}
                      <div
                        ref={bodyEditorRef}
                        contentEditable
                        suppressContentEditableWarning
                        onInput={handleBodyChange}
                        onFocus={(e) => e.currentTarget.classList.add('ring-2', 'ring-blue-500', 'border-blue-500')}
                        onBlur={(e) => e.currentTarget.classList.remove('ring-2', 'ring-blue-500', 'border-blue-500')}
                        className="w-full min-h-[300px] overflow-y-auto px-4 py-3 border border-gray-300 rounded-b-lg focus:outline-none bg-white transition-all resize-y relative z-10"
                        style={{ whiteSpace: 'pre-wrap' }}
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Click on a variable in the panel to insert it at cursor position.</p>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Variables Panel - Right Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 sticky top-24">
              <div className="flex items-center gap-2 mb-4">
                <Code className={`w-5 h-5 text-${fullColor}`} />
                <h2 className="text-lg font-semibold text-gray-900">Template Variables</h2>
              </div>
              <p className="text-sm text-gray-500 mb-4">
                Click to insert or copy variables for the <span className="font-medium">{formData.trigger_type.replace(/_/g, ' ')}</span> trigger.
              </p>

              <div className="space-y-3 max-h-[500px] overflow-y-auto">
                {variableGroups.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    <Code className="w-8 h-8 mx-auto mb-2" />
                    <p className="text-sm">Loading variables...</p>
                  </div>
                ) : (
                  variableGroups.map(group => (
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
                                <p className="text-xs text-gray-500 truncate" title={variable.description}>
                                  {variable.description}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => copyVariable(variable.name)}
                                className="ml-2 p-1.5 text-gray-400 hover:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity"
                                title="Copy to clipboard"
                              >
                                {copiedVariable === variable.name ? (
                                  <Check className="w-4 h-4 text-green-600" />
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
                  ))
                )}
              </div>

              <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                <div className="flex items-start gap-2">
                  <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-blue-700">
                    Variables are automatically replaced with actual data when emails are sent.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Email Preview</h3>
                <p className="text-sm text-gray-500">Preview with sample variable data</p>
              </div>
              <button onClick={() => setShowPreview(false)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <div className="mb-4">
                <label className="text-sm font-medium text-gray-500">Subject</label>
                <p className="text-gray-900 mt-1 font-medium">{formData.subject || '(No subject)'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Body</label>
                <div 
                  className="mt-2 prose prose-sm max-w-none border border-gray-200 rounded-lg p-4 bg-gray-50"
                  dangerouslySetInnerHTML={{ __html: formData.body || '<p class="text-gray-400">(No content)</p>' }}
                />
              </div>
              {formData.include_qr_code && (
                <div className="mt-4 p-4 bg-gray-100 rounded-lg text-center">
                  <QrCode className="w-16 h-16 mx-auto text-gray-400" />
                  <p className="text-xs text-gray-500 mt-2">QR Code will appear here</p>
                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-200 bg-gray-50">
              <StandardButton variant="secondary" onClick={() => setShowPreview(false)}>
                Close Preview
              </StandardButton>
            </div>
          </div>
        </div>
      )}

      {/* Image Size Picker Modal */}
      {showImageSizeModal && pendingImageFile && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className={`p-3 bg-${themeColor}-100 rounded-full`}>
                <Image className={`w-6 h-6 text-${fullColor}`} />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Select Image Size</h3>
                <p className="text-sm text-gray-500">{pendingImageFile.name}</p>
              </div>
            </div>
            
            {/* Image Preview */}
            <div className="mb-4 p-4 bg-gray-50 rounded-lg flex justify-center">
              <img 
                src={URL.createObjectURL(pendingImageFile)} 
                alt="Preview" 
                className="max-h-32 max-w-full object-contain rounded"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-3 mb-4">
              <button
                type="button"
                onClick={() => handleImageUpload('200px')}
                className={`p-3 border-2 border-gray-200 rounded-lg hover:border-${themeColor}-500 hover:bg-${themeColor}-50 transition-colors text-center`}
              >
                <div className="text-sm font-medium text-gray-900">Small</div>
                <div className="text-xs text-gray-500">200px width</div>
              </button>
              <button
                type="button"
                onClick={() => handleImageUpload('400px')}
                className={`p-3 border-2 border-gray-200 rounded-lg hover:border-${themeColor}-500 hover:bg-${themeColor}-50 transition-colors text-center`}
              >
                <div className="text-sm font-medium text-gray-900">Medium</div>
                <div className="text-xs text-gray-500">400px width</div>
              </button>
              <button
                type="button"
                onClick={() => handleImageUpload('600px')}
                className={`p-3 border-2 border-${themeColor}-500 bg-${themeColor}-50 rounded-lg hover:bg-${themeColor}-100 transition-colors text-center`}
              >
                <div className={`text-sm font-medium text-${fullColor}`}>Large</div>
                <div className={`text-xs text-${themeColor}-600`}>600px width</div>
              </button>
              <button
                type="button"
                onClick={() => handleImageUpload('100%')}
                className={`p-3 border-2 border-gray-200 rounded-lg hover:border-${themeColor}-500 hover:bg-${themeColor}-50 transition-colors text-center`}
              >
                <div className="text-sm font-medium text-gray-900">Full Width</div>
                <div className="text-xs text-gray-500">100% width</div>
              </button>
            </div>
            
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setShowImageSizeModal(false);
                  setPendingImageFile(null);
                  if (imageInputRef.current) imageInputRef.current.value = '';
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Link Modal */}
      {showLinkModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-blue-100 rounded-full">
                <LinkIcon className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Insert Link</h3>
                <p className="text-sm text-gray-500">Add a hyperlink to your email</p>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">URL</label>
                <input
                  type="url"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="https://example.com"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Link Text (optional)</label>
                <input
                  type="text"
                  value={linkText}
                  onChange={(e) => setLinkText(e.target.value)}
                  placeholder="Click here"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button type="button" onClick={() => { setShowLinkModal(false); setLinkUrl(''); setLinkText(''); }} className="px-4 py-2 text-gray-600 hover:text-gray-800">
                Cancel
              </button>
              <StandardButton variant="primary" onClick={insertLink}>
                Insert Link
              </StandardButton>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};

export default CreateEmailNotification;
