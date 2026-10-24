import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  Save,
  Eye,
  FileText,
  X,
  Mail,
  MapPin,
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
  Image,
  Loader2,
  Check,
  Undo2,
  Redo2
} from 'lucide-react';
import { useThemeColor } from '../../../hooks/useThemeColor';
import { emailCampaignService } from '../../../services/EmailCampaignService';
import { locationService } from '../../../services/LocationService';
import StandardButton from '../../../components/ui/StandardButton';
import Toast from '../../../components/ui/Toast';
import TemplateLocationsPicker from '../../../components/admin/email/TemplateLocationsPicker';
import EventPhotoEmailSettings from '../../../components/admin/email/EventPhotoEmailSettings';
import TemplateVariablesPanel from '../../../components/admin/email/TemplateVariablesPanel';
import { useTemplateFieldInsert, TEMPLATE_FIELD_LABELS } from '../../../hooks/useTemplateFieldInsert';
import { getStoredUser } from '../../../utils/storage';
import { locationShortName } from '../../../utils/locationName';
import { requestErrorMessage } from '../../../utils/requestError';
import {
  EMAIL_TEMPLATE_CATEGORIES,
  EVENT_PHOTOS_CATEGORY,
  EVENT_PHOTO_SMS_LIMIT,
  EVENT_PHOTO_STARTER,
  TEMPLATE_SUBJECT_LIMIT,
  canManageEventPhotoEmails,
  escapeHtml,
  insertAtCaret,
  isCompanyLevelRole,
  linkHref,
  templateLocationIds,
  templatePreviewLocationId,
  templateVariableGroups,
} from '../../../utils/emailTemplateOptions';
import type { TemplateLocationsValue } from '../../../utils/emailTemplateOptions';
import type { CreateEmailTemplateData, EmailTemplateStatus, EmailTemplateVariablesData } from '../../../types/EmailCampaign.types';
import { safeHtml } from '../../../utils/safeHtml';

const CreateEmailTemplate: React.FC = () => {
  const navigate = useNavigate();
  const doneTimer = useRef<number | null>(null);

  useEffect(() => () => {
    if (doneTimer.current !== null) window.clearTimeout(doneTimer.current);
  }, []);
  const [searchParams] = useSearchParams();
  const { fullColor } = useThemeColor();
  const currentUser = getStoredUser();
  const isCompanyLevel = isCompanyLevelRole(currentUser?.role);
  const canEventPhotos = canManageEventPhotoEmails(currentUser?.role);
  const bodyEditorRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const subjectInputRef = useRef<HTMLInputElement>(null);
  const smsRef = useRef<HTMLTextAreaElement>(null);
  const prefillRead = useRef(false);

  const [formData, setFormData] = useState<CreateEmailTemplateData>({
    name: '',
    subject: '',
    body: '',
    status: 'draft',
    category: ''
  });
  const [locationsValue, setLocationsValue] = useState<TemplateLocationsValue>({ allLocations: true, selectedIds: [] });
  const [locationError, setLocationError] = useState<string | null>(null);
  const [attachPhotos, setAttachPhotos] = useState(true);
  const [smsBody, setSmsBody] = useState('');
  const [locations, setLocations] = useState<Array<{ id: number; name: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState<{ subject: string; body: string } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [showImageSizeModal, setShowImageSizeModal] = useState(false);
  const [pendingImageFile, setPendingImageFile] = useState<File | null>(null);
  
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkText, setLinkText] = useState('');

  const [variablesData, setVariablesData] = useState<EmailTemplateVariablesData | null>(null);

  const isEventPhotos = formData.category === EVENT_PHOTOS_CATEGORY;
  const categories = [
    { value: '', label: 'Select Category' },
    ...EMAIL_TEMPLATE_CATEGORIES.filter(category => category.value !== EVENT_PHOTOS_CATEGORY || canEventPhotos)
  ];
  const linkShortcuts = isEventPhotos
    ? Object.keys(variablesData?.event ?? {}).filter(name => name === 'photo_link' || name.startsWith('link_'))
    : [];

  const handleBodyChange = () => {
    if (bodyEditorRef.current) {
      setFormData(prev => ({
        ...prev,
        body: bodyEditorRef.current?.innerHTML || ''
      }));
    }
  };

  const { activeField, setActiveField, focusedField, insertIntoBody, resetSelection } = useTemplateFieldInsert(bodyEditorRef, handleBodyChange);
  const insertTarget = activeField === 'sms' && !isEventPhotos ? 'body' : activeField;

  useEffect(() => {
    const fetchData = async () => {
      try {
        if (isCompanyLevel) {
          const locResponse = await locationService.getLocations();
          if (locResponse.success && locResponse.data) {
            setLocations(locResponse.data);
          }
        }

        const varResponse = await emailCampaignService.getTemplateVariables();
        if (varResponse.success && varResponse.data) {
          setVariablesData(varResponse.data);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };
    fetchData();
  }, [isCompanyLevel]);

  useEffect(() => {
    if (prefillRead.current) return;
    prefillRead.current = true;
    if (searchParams.get('category') !== EVENT_PHOTOS_CATEGORY || !canEventPhotos) return;
    setFormData(prev => ({
      ...prev,
      category: EVENT_PHOTOS_CATEGORY,
      name: prev.name || EVENT_PHOTO_STARTER.name,
      subject: prev.subject || EVENT_PHOTO_STARTER.subject,
      body: prev.body || EVENT_PHOTO_STARTER.body
    }));
    if (bodyEditorRef.current && !bodyEditorRef.current.innerHTML.trim()) {
      bodyEditorRef.current.innerHTML = EVENT_PHOTO_STARTER.body;
      resetSelection();
    }
    const target = Number(searchParams.get('location'));
    if (isCompanyLevel && Number.isInteger(target) && target > 0) {
      setLocationsValue({ allLocations: false, selectedIds: [target] });
    }
  }, [searchParams, canEventPhotos, isCompanyLevel, resetSelection]);

  const applyCategory = (category: string) => {
    const useStarter = category === EVENT_PHOTOS_CATEGORY && !formData.subject.trim() && !formData.body.trim();
    setFormData(prev => ({
      ...prev,
      category,
      ...(useStarter
        ? { name: prev.name || EVENT_PHOTO_STARTER.name, subject: EVENT_PHOTO_STARTER.subject, body: EVENT_PHOTO_STARTER.body }
        : {})
    }));
    if (useStarter && bodyEditorRef.current) {
      bodyEditorRef.current.innerHTML = EVENT_PHOTO_STARTER.body;
      resetSelection();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (name === 'category') {
      applyCategory(value);
      return;
    }
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const insertVariable = (variable: string) => {
    const variableText = `{{ ${variable} }}`;
    const focused = focusedField(subjectInputRef.current, smsRef.current) ?? insertTarget;
    const target = focused === 'sms' && !isEventPhotos ? 'body' : focused;

    if (target === 'body') {
      insertIntoBody('insertText', variableText);
      return;
    }

    const field = target === 'subject' ? subjectInputRef.current : smsRef.current;
    const limit = target === 'subject' ? TEMPLATE_SUBJECT_LIMIT : EVENT_PHOTO_SMS_LIMIT;
    const { value, caret } = insertAtCaret(field, target === 'subject' ? formData.subject : smsBody, variableText);

    if (value.length > limit) {
      setToast({ message: `The ${TEMPLATE_FIELD_LABELS[target]} can be up to ${limit} characters.`, type: 'error' });
      return;
    }

    if (target === 'subject') {
      setFormData(prev => ({ ...prev, subject: value }));
    } else {
      setSmsBody(value);
    }

    requestAnimationFrame(() => {
      field?.focus();
      field?.setSelectionRange(caret, caret);
    });
  };

  const handlePreview = async () => {
    if (!formData.subject || !formData.body) {
      setToast({ message: 'Please enter subject and body to preview', type: 'error' });
      return;
    }

    const previewLocationId = isCompanyLevel ? templatePreviewLocationId(locationsValue, locations) : undefined;

    try {
      setPreviewLoading(true);
      const response = await emailCampaignService.previewContent({
        subject: formData.subject,
        body: formData.body,
        ...(previewLocationId ? { location_id: previewLocationId } : {})
      });
      
      if (response.success) {
        setPreviewData(response.data);
        setShowPreview(true);
      }
    } catch (error) {
      console.error('Error previewing template:', error);
      setToast({ message: requestErrorMessage(error, 'Failed to preview template'), type: 'error' });
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleSave = async (status: EmailTemplateStatus = 'draft') => {
    if (!formData.name.trim()) {
      setToast({ message: 'Please enter a template name', type: 'error' });
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

    const locationIds = templateLocationIds(locationsValue);
    if (isCompanyLevel && !locationsValue.allLocations && locationIds.length === 0) {
      setLocationError('Tick at least one location, or choose Every location.');
      setToast({ message: 'Choose which locations use this template', type: 'error' });
      return;
    }
    setLocationError(null);

    try {
      setLoading(true);
      const response = await emailCampaignService.createTemplate({
        name: formData.name,
        subject: formData.subject,
        body: formData.body,
        category: formData.category,
        status,
        ...(isCompanyLevel ? { location_ids: locationIds } : {}),
        ...(isEventPhotos ? { attach_photos: attachPhotos, sms_body: smsBody.trim() === '' ? null : smsBody } : {})
      });

      if (response.success) {
        setToast({ message: `Template ${status === 'active' ? 'created and activated' : 'saved as draft'}!`, type: 'success' });
        doneTimer.current = window.setTimeout(() => navigate('/admin/email/templates'), 1500);
        return;
      }
      setLoading(false);
    } catch (error) {
      console.error('Error saving template:', error);
      const fieldError = (error as { response?: { data?: { errors?: Record<string, string[]> } } })?.response?.data?.errors?.location_ids?.[0];
      if (fieldError) setLocationError(fieldError);
      setToast({ message: requestErrorMessage(error, 'Failed to save template'), type: 'error' });
      setLoading(false);
    }
  };

  const formatText = (command: string, value?: string) => {
    if (bodyEditorRef.current) {
      bodyEditorRef.current.focus();
    }
    
    setTimeout(() => {
      document.execCommand(command, false, value);
      handleBodyChange();
    }, 0);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setToast({ message: 'Please select a valid image file (PNG, JPG, GIF, WebP)', type: 'error' });
      if (imageInputRef.current) imageInputRef.current.value = '';
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setToast({ message: 'Image must be less than 5MB', type: 'error' });
      if (imageInputRef.current) imageInputRef.current.value = '';
      return;
    }

    setPendingImageFile(file);
    setShowImageSizeModal(true);
  };

  const handleImageUpload = async (maxWidth: string) => {
    if (!pendingImageFile) return;

    try {
      setUploadingImage(true);
      setShowImageSizeModal(false);
      
      const response = await emailCampaignService.uploadImage(pendingImageFile);
      
      if (response.success) {
        insertIntoBody(
          'insertHTML',
          `<img src="${escapeHtml(response.data.url)}" alt="${escapeHtml(response.data.original_name)}" style="max-width: ${maxWidth}; height: auto; display: block; margin: 10px 0;" />`
        );
        setToast({ message: 'Image uploaded and inserted!', type: 'success' });
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      setToast({ message: 'Failed to upload image', type: 'error' });
    } finally {
      setUploadingImage(false);
      setPendingImageFile(null);
      if (imageInputRef.current) {
        imageInputRef.current.value = '';
      }
    }
  };

  const handleToolbarClick = (e: React.MouseEvent, command: string, value?: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    document.execCommand(command, false, value);
    handleBodyChange();
  };

  const insertLink = () => {
    if (!linkUrl.trim()) {
      setToast({ message: 'Please enter a URL', type: 'error' });
      return;
    }
    
    const url = linkHref(linkUrl);
    const text = linkText.trim() || url;
    
    insertIntoBody(
      'insertHTML',
      `<a href="${escapeHtml(url)}" target="_blank" style="color: #3182ce; text-decoration: underline;">${escapeHtml(text)}</a>`
    );
    
    setShowLinkModal(false);
    setLinkUrl('');
    setLinkText('');
  };

  const applyTextColor = (color: string) => {
    if (bodyEditorRef.current) {
      bodyEditorRef.current.focus();
      document.execCommand('foreColor', false, color);
      handleBodyChange();
    }
  };

  const applyHighlight = (color: string) => {
    if (bodyEditorRef.current) {
      bodyEditorRef.current.focus();
      document.execCommand('hiliteColor', false, color);
      handleBodyChange();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
                  Create Email Template
                </h1>
                <p className="text-sm text-gray-500">Design a reusable email template with dynamic variables</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
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
                onClick={() => handleSave('draft')}
                disabled={loading}
              >
                Save Draft
              </StandardButton>
              <StandardButton
                variant="primary"
                icon={FileText}
                onClick={() => handleSave('active')}
                disabled={loading}
                loading={loading}
              >
                Save & Activate
              </StandardButton>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
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

              {isCompanyLevel && locations.length > 0 && (
                <div className="mb-4">
                  <TemplateLocationsPicker
                    locations={locations}
                    value={locationsValue}
                    onChange={(value) => {
                      setLocationsValue(value);
                      setLocationError(null);
                    }}
                    error={locationError ?? undefined}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {isEventPhotos
                      ? 'People who registered for an event at these locations get this email with their photos.'
                      : 'Staff at these locations can use this template.'}
                  </p>
                </div>
              )}

              {!isCompanyLevel && (
                <p className="flex items-start gap-2 text-sm text-gray-600">
                  <MapPin className="w-4 h-4 mt-0.5 text-gray-400 flex-shrink-0" />
                  <span>
                    For {currentUser?.location_name ? locationShortName(currentUser.location_name) : 'your location'} only. A company admin can
                    share a template with other locations.
                  </span>
                </p>
              )}
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Email Content</h2>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Subject Line <span className="text-red-500">*</span>
                </label>
                <input
                  ref={subjectInputRef}
                  type="text"
                  name="subject"
                  value={formData.subject}
                  onChange={handleInputChange}
                  onFocus={() => setActiveField('subject')}
                  maxLength={TEMPLATE_SUBJECT_LIMIT}
                  placeholder="e.g., Welcome to {{ company_name }}, {{ recipient_first_name }}!"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">You can use variables in the subject line</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email Body <span className="text-red-500">*</span>
                </label>
                
                <div className="flex flex-wrap items-center gap-1 p-2 border border-gray-300 border-b-0 rounded-t-lg bg-gray-50">
                  <button
                    type="button"
                    onMouseDown={(e) => handleToolbarClick(e, 'undo')}
                    className="p-1.5 hover:bg-gray-200 rounded text-gray-600"
                    title="Undo (Ctrl+Z)"
                  >
                    <Undo2 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onMouseDown={(e) => handleToolbarClick(e, 'redo')}
                    className="p-1.5 hover:bg-gray-200 rounded text-gray-600"
                    title="Redo (Ctrl+Y)"
                  >
                    <Redo2 className="w-4 h-4" />
                  </button>
                  <div className="w-px h-5 bg-gray-300 mx-1" />
                  
                  <button
                    type="button"
                    onMouseDown={(e) => handleToolbarClick(e, 'formatBlock', 'p')}
                    className="px-2 py-1 text-xs hover:bg-gray-200 rounded text-gray-600 border border-gray-300 bg-white"
                    title="Normal Text (Remove heading/list)"
                  >
                    <Type className="w-4 h-4 inline mr-1" />
                    Normal
                  </button>
                  <div className="w-px h-5 bg-gray-300 mx-1" />
                  
                  <button
                    type="button"
                    onMouseDown={(e) => handleToolbarClick(e, 'bold')}
                    className="p-1.5 hover:bg-gray-200 rounded text-gray-600"
                    title="Bold (Ctrl+B)"
                  >
                    <Bold className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onMouseDown={(e) => handleToolbarClick(e, 'italic')}
                    className="p-1.5 hover:bg-gray-200 rounded text-gray-600"
                    title="Italic (Ctrl+I)"
                  >
                    <Italic className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onMouseDown={(e) => handleToolbarClick(e, 'underline')}
                    className="p-1.5 hover:bg-gray-200 rounded text-gray-600"
                    title="Underline (Ctrl+U)"
                  >
                    <Underline className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onMouseDown={(e) => handleToolbarClick(e, 'strikeThrough')}
                    className="p-1.5 hover:bg-gray-200 rounded text-gray-600"
                    title="Strikethrough"
                  >
                    <Strikethrough className="w-4 h-4" />
                  </button>
                  <div className="w-px h-5 bg-gray-300 mx-1" />
                  
                  <div className="flex items-center gap-0.5">
                    <button
                      type="button"
                      onMouseDown={(e) => { e.preventDefault(); applyTextColor('#e53e3e'); }}
                      className="w-5 h-5 rounded border border-gray-300 bg-red-500 hover:ring-2 hover:ring-red-300"
                      title="Red Text"
                    />
                    <button
                      type="button"
                      onMouseDown={(e) => { e.preventDefault(); applyTextColor('#3182ce'); }}
                      className="w-5 h-5 rounded border border-gray-300 bg-blue-500 hover:ring-2 hover:ring-blue-300"
                      title="Blue Text"
                    />
                    <button
                      type="button"
                      onMouseDown={(e) => { e.preventDefault(); applyTextColor('#38a169'); }}
                      className="w-5 h-5 rounded border border-gray-300 bg-green-500 hover:ring-2 hover:ring-green-300"
                      title="Green Text"
                    />
                    <button
                      type="button"
                      onMouseDown={(e) => { e.preventDefault(); applyTextColor('#000000'); }}
                      className="w-5 h-5 rounded border border-gray-300 bg-black hover:ring-2 hover:ring-gray-400"
                      title="Black Text"
                    />
                  </div>
                  <div className="w-px h-5 bg-gray-300 mx-1" />
                  
                  <button
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); applyHighlight('#fef08a'); }}
                    className="p-1.5 hover:bg-gray-200 rounded text-yellow-600"
                    title="Highlight Yellow"
                  >
                    <Highlighter className="w-4 h-4" />
                  </button>
                  <div className="w-px h-5 bg-gray-300 mx-1" />
                  
                  <button
                    type="button"
                    onMouseDown={(e) => handleToolbarClick(e, 'formatBlock', 'h1')}
                    className="p-1.5 hover:bg-gray-200 rounded text-gray-600"
                    title="Heading 1"
                  >
                    <Heading1 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onMouseDown={(e) => handleToolbarClick(e, 'formatBlock', 'h2')}
                    className="p-1.5 hover:bg-gray-200 rounded text-gray-600"
                    title="Heading 2"
                  >
                    <Heading2 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onMouseDown={(e) => handleToolbarClick(e, 'formatBlock', 'blockquote')}
                    className="p-1.5 hover:bg-gray-200 rounded text-gray-600"
                    title="Quote"
                  >
                    <Quote className="w-4 h-4" />
                  </button>
                  <div className="w-px h-5 bg-gray-300 mx-1" />
                  
                  <button
                    type="button"
                    onMouseDown={(e) => handleToolbarClick(e, 'justifyLeft')}
                    className="p-1.5 hover:bg-gray-200 rounded text-gray-600"
                    title="Align Left"
                  >
                    <AlignLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onMouseDown={(e) => handleToolbarClick(e, 'justifyCenter')}
                    className="p-1.5 hover:bg-gray-200 rounded text-gray-600"
                    title="Align Center"
                  >
                    <AlignCenter className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onMouseDown={(e) => handleToolbarClick(e, 'justifyRight')}
                    className="p-1.5 hover:bg-gray-200 rounded text-gray-600"
                    title="Align Right"
                  >
                    <AlignRight className="w-4 h-4" />
                  </button>
                  <div className="w-px h-5 bg-gray-300 mx-1" />
                  
                  <button
                    type="button"
                    onMouseDown={(e) => handleToolbarClick(e, 'insertUnorderedList')}
                    className="p-1.5 hover:bg-gray-200 rounded text-gray-600"
                    title="Bullet List"
                  >
                    <List className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onMouseDown={(e) => handleToolbarClick(e, 'insertOrderedList')}
                    className="p-1.5 hover:bg-gray-200 rounded text-gray-600"
                    title="Numbered List"
                  >
                    <ListOrdered className="w-4 h-4" />
                  </button>
                  <div className="w-px h-5 bg-gray-300 mx-1" />
                  
                  <button
                    type="button"
                    onClick={() => setShowLinkModal(true)}
                    className="p-1.5 hover:bg-gray-200 rounded text-gray-600"
                    title="Insert Link"
                  >
                    <LinkIcon className="w-4 h-4" />
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => imageInputRef.current?.click()}
                    disabled={uploadingImage}
                    className="p-1.5 hover:bg-gray-200 rounded text-gray-600 disabled:opacity-50"
                    title="Insert Image"
                  >
                    {uploadingImage ? <Loader2 className="w-4 h-4 animate-spin" /> : <Image className="w-4 h-4" />}
                  </button>
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
                    onChange={handleImageSelect}
                    className="hidden"
                  />
                  
                  <button
                    type="button"
                    onMouseDown={(e) => handleToolbarClick(e, 'removeFormat')}
                    className="p-1.5 hover:bg-gray-200 rounded text-gray-600 ml-auto"
                    title="Clear Formatting"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                
                <div className="relative">
                  {!formData.body && (
                    <div 
                      className="absolute top-3 left-4 text-gray-400 pointer-events-none select-none z-0"
                      aria-hidden="true"
                    >
                      <p className="text-base">Start composing your email...</p>
                      <p className="text-sm mt-2">💡 Tips:</p>
                      <ul className="text-sm ml-4 list-disc">
                        <li>Use the toolbar above to format text</li>
                        <li>Click variables on the right to insert them</li>
                        <li>Use {`{{ variable_name }}`} syntax for dynamic content</li>
                        <li>Preview your email before saving</li>
                      </ul>
                    </div>
                  )}
                  <div
                    ref={bodyEditorRef}
                    contentEditable
                    suppressContentEditableWarning
                    onInput={handleBodyChange}
                    onFocus={(e) => {
                      setActiveField('body');
                      e.currentTarget.classList.add('ring-2', 'ring-blue-500', 'border-blue-500');
                    }}
                    onBlur={(e) => {
                      e.currentTarget.classList.remove('ring-2', 'ring-blue-500', 'border-blue-500');
                    }}
                    className="w-full min-h-[400px] overflow-y-auto px-4 py-3 border border-gray-300 rounded-b-lg focus:outline-none bg-white transition-all resize-y relative z-10"
                    style={{ whiteSpace: 'pre-wrap' }}
                    onKeyDown={(e) => {
                      if (e.ctrlKey || e.metaKey) {
                        if (e.key === 'b') { e.preventDefault(); formatText('bold'); }
                        if (e.key === 'i') { e.preventDefault(); formatText('italic'); }
                        if (e.key === 'u') { e.preventDefault(); formatText('underline'); }
                      }
                    }}
                  />
                </div>
                <div className="flex items-center justify-between mt-1">
                  <p className="text-xs text-gray-500">Click on a variable in the panel to insert it at cursor position. Supports Ctrl+B (bold), Ctrl+I (italic), Ctrl+U (underline).</p>
                  <p className="text-xs text-gray-400">{formData.body ? `${formData.body.length} characters` : '0 characters'}</p>
                </div>
              </div>
            </div>

            {isEventPhotos && (
              <EventPhotoEmailSettings
                attachPhotos={attachPhotos}
                onAttachPhotosChange={setAttachPhotos}
                smsBody={smsBody}
                onSmsBodyChange={setSmsBody}
                smsRef={smsRef}
                onSmsFocus={() => setActiveField('sms')}
              />
            )}
          </div>

          <div className="lg:col-span-1">
            <TemplateVariablesPanel
              key={isEventPhotos ? 'event' : 'general'}
              groups={templateVariableGroups(variablesData, isEventPhotos)}
              targetLabel={TEMPLATE_FIELD_LABELS[insertTarget]}
              onInsert={insertVariable}
              iconClassName={`text-${fullColor}`}
            />
          </div>
        </div>
      </div>

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
                  dangerouslySetInnerHTML={{ __html: safeHtml(previewData.body) }}
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

      {showImageSizeModal && pendingImageFile && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-blue-100 rounded-full">
                <Image className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Select Image Size</h3>
                <p className="text-sm text-gray-500">{pendingImageFile.name}</p>
              </div>
            </div>
            
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
                className="p-3 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors text-center"
              >
                <div className="text-sm font-medium text-gray-900">Small</div>
                <div className="text-xs text-gray-500">200px width</div>
              </button>
              <button
                type="button"
                onClick={() => handleImageUpload('400px')}
                className="p-3 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors text-center"
              >
                <div className="text-sm font-medium text-gray-900">Medium</div>
                <div className="text-xs text-gray-500">400px width</div>
              </button>
              <button
                type="button"
                onClick={() => handleImageUpload('600px')}
                className="p-3 border-2 border-blue-500 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors text-center"
              >
                <div className="text-sm font-medium text-blue-700">Large</div>
                <div className="text-xs text-blue-600">600px width</div>
              </button>
              <button
                type="button"
                onClick={() => handleImageUpload('100%')}
                className="p-3 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors text-center"
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
            
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  URL <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  inputMode="url"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="https://example.com"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  autoFocus
                />
                {linkShortcuts.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs text-gray-500 mb-1">Or link to:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {linkShortcuts.map(name => (
                        <button
                          key={name}
                          type="button"
                          onClick={() => setLinkUrl(`{{ ${name} }}`)}
                          className="px-2 py-1 rounded-md border border-gray-200 bg-gray-50 hover:bg-gray-100 text-xs font-mono text-blue-700"
                        >
                          {name === 'photo_link' ? 'their photos' : name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Display Text <span className="text-gray-400">(optional)</span>
                </label>
                <input
                  type="text"
                  value={linkText}
                  onChange={(e) => setLinkText(e.target.value)}
                  placeholder="Click here"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">If empty, the URL will be shown</p>
              </div>
            </div>
            
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowLinkModal(false);
                  setLinkUrl('');
                  setLinkText('');
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={insertLink}
                className={`px-4 py-2 bg-${fullColor} text-white rounded-lg hover:opacity-90 flex items-center gap-2`}
              >
                <Check className="w-4 h-4" />
                Insert Link
              </button>
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

export default CreateEmailTemplate;
